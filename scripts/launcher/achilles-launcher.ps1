[CmdletBinding()]
param(
  [ValidateSet("Setup", "Start", "Stop", "Restart", "Status", "Update", "InstallShortcuts", "EnableAutostart", "DisableAutostart")]
  [string]$Action = "Start",
  [switch]$DebugMode,
  [switch]$NoOpen,
  [switch]$KeepDatabase
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [System.Text.UTF8Encoding]::new()
$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$RuntimeDir = Join-Path $ProjectRoot ".runtime"
$LogDir = Join-Path $ProjectRoot ".logs"
$PidFile = Join-Path $RuntimeDir "processes.json"
$Ports = @{ Storefront = 3000; Admin = 3001; Backend = 9000; Postgres = 5432 }
$script:UseSimpleAdmin = $true

function Write-Title { Write-Host "`n========================================"; Write-Host "          ACHILLES STORE"; Write-Host "========================================`n" }
function Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Fail([string]$Text) { Write-Host "[ERRO] $Text" -ForegroundColor Red }
function Ensure-Directory([string]$Path) { if (-not (Test-Path -LiteralPath $Path)) { New-Item -ItemType Directory -Path $Path | Out-Null } }
function Write-SanitizedLog([string]$Text) { $safe=$Text -replace '(?i)(password|token|secret|authorization|cookie|database_url)(\s*[:=]\s*)[^\s,;]+','$1$2[REDACTED]';Add-Content -LiteralPath (Join-Path $LogDir "launcher.log") -Value $safe }
function Require-Command([string]$Name, [string]$Friendly) { if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "$Friendly não foi encontrado. Execute SETUP_ACHILLES.bat após instalar o requisito." }; Ok $Friendly }
function Assert-Node { Require-Command "node" "Node.js"; $major = [int]((node --version).TrimStart("v").Split(".")[0]); if ($major -ne 24) { throw "A Achilles Store exige Node 24. Versão encontrada: $(node --version)." }; Ok "Node 24" }
function Assert-Environment {
  $envFile = Join-Path $ProjectRoot ".env"
  if (-not (Test-Path -LiteralPath $envFile)) { throw "O arquivo .env está ausente. Copie .env.example para .env, preencha somente valores locais e execute SETUP_ACHILLES.bat." }
  $databaseLine = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
  if (-not $databaseLine) { throw "DATABASE_URL não foi configurada no .env." }
  if ($databaseLine -match 'achilles_store_e2e') { throw "Inicialização abortada: o uso diário nunca pode acessar achilles_store_e2e." }
  $adminFlag = Get-Content -LiteralPath $envFile | Where-Object { $_ -match '^ACHILLES_SIMPLE_ADMIN=' } | Select-Object -First 1
  $script:UseSimpleAdmin = (-not $adminFlag) -or ($adminFlag -notmatch '=false$')
  Ok "Ambiente operacional achilles_store"
}
function Assert-Tools { Assert-Node; Require-Command "pnpm" "pnpm"; Require-Command "docker" "Docker"; docker info *> $null; if ($LASTEXITCODE -ne 0) { throw "O Docker está instalado, mas o serviço não está disponível. Inicie o Docker Desktop e tente novamente." }; Ok "Docker daemon" }
function Wait-Http([string]$Name, [string]$Url, [int]$TimeoutSeconds = 180) { $deadline=(Get-Date).AddSeconds($TimeoutSeconds); do { try { $r=Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 4; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 300) { Ok $Name; return } } catch {}; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); throw "$Name não iniciou. Consulte os arquivos em .logs e tente novamente." }
function Invoke-Migrations { Push-Location $ProjectRoot;try{$previous=$ErrorActionPreference;$ErrorActionPreference="Continue";$migrationOutput=& pnpm db:migrate 2>&1;$migrationCode=$LASTEXITCODE;if($migrationCode-eq 0){$structureOutput=& pnpm seed:production 2>&1;$structureCode=$LASTEXITCODE}else{$structureOutput=@();$structureCode=1};$ErrorActionPreference=$previous;if($migrationCode-ne 0){Write-SanitizedLog ($migrationOutput -join "`n");throw "As migrations falharam. Consulte .logs/launcher.log."};if($structureCode-ne 0){Write-SanitizedLog ($structureOutput -join "`n");throw "A estrutura mínima da loja não pôde ser preparada. Consulte .logs/launcher.log."};if($DebugMode){$migrationOutput|Out-Host;$structureOutput|Out-Host}else{Ok "Migrations e estrutura mínima"}}finally{$ErrorActionPreference="Stop";Pop-Location} }
function Test-Http([string]$Url) { try { $r=Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2; return $r.StatusCode -ge 200 -and $r.StatusCode -lt 500 } catch { return $false } }
function Test-AchillesService([string]$Name,[int]$Port) { $route=if($Name-eq"Backend"){"health"}else{"api/health"};try{$payload=Invoke-RestMethod -Uri "http://localhost:$Port/$route" -TimeoutSec 2;return $payload.status-eq"ok" -and $payload.service-eq $(if($Name-eq"Backend"){"commerce"}elseif($Name-eq"Admin"){"simple-admin"}else{"storefront"})}catch{return $false} }
function Ensure-Postgres {
  $composeFile = Join-Path $ProjectRoot "docker-compose.yml"
  docker compose -f $composeFile up -d postgres | Out-Host
  $containerId = (docker compose -f $composeFile ps -q postgres).Trim()
  if (-not $containerId) { throw "O container PostgreSQL não foi encontrado após a inicialização." }
  $deadline = (Get-Date).AddSeconds(90)
  do {
    $state = docker inspect --format='{{.State.Health.Status}}' $containerId 2>$null
    if ($state -eq "healthy") { Ok "PostgreSQL"; return }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "O PostgreSQL não ficou saudável. Verifique o Docker Desktop."
}
function Read-Processes {
  if (-not (Test-Path -LiteralPath $PidFile)) { return @() }
  $parsed = Get-Content -Raw -LiteralPath $PidFile | ConvertFrom-Json
  if ($parsed.PSObject.Properties.Name -contains "value") { return @($parsed.value) }
  return @($parsed)
}
function Start-ServiceProcess([string]$Name,[string]$Filter,[string]$Log,[int]$Port) {
  if (Test-AchillesService $Name $Port) { Ok "$Name já está disponível"; return $null }
  $known = Read-Processes | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if ($known -and (Get-Process -Id $known.pid -ErrorAction SilentlyContinue)) {
    Ok "$Name pertence à Achilles Store e será reutilizado"
    return $null
  }
  $occupied=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($occupied) { throw "A porta $Port, reservada para $Name, está ocupada por outro aplicativo. Feche-o e tente novamente." }
  $runner=Join-Path $PSScriptRoot "run-service.ps1"; $window=if($DebugMode){"Normal"}else{"Hidden"}
  $logPath = Join-Path $LogDir $Log
  $arguments = @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$runner`"",
    "-ProjectRoot", "`"$ProjectRoot`"", "-Filter", $Filter,
    "-LogPath", "`"$logPath`""
  )
  $process=Start-Process powershell.exe -ArgumentList $arguments -WorkingDirectory $ProjectRoot -WindowStyle $window -PassThru
  Start-Sleep -Milliseconds 800
  if ($process.HasExited) { throw "$Name não iniciou. Consulte $Log." }
  return [pscustomobject]@{ name=$Name; pid=$process.Id; port=$Port; startedAt=(Get-Date).ToString("o") }
}
function Stop-Tree([int]$Id) { if($Id -le 0){throw "PID inválido no registro do launcher."};$children=Get-CimInstance Win32_Process -Filter "ParentProcessId=$Id" -ErrorAction SilentlyContinue; foreach($child in $children){Stop-Tree $child.ProcessId}; Stop-Process -Id $Id -ErrorAction SilentlyContinue }
function Invoke-Stop { foreach($entry in (Read-Processes)){ $id=[int]$entry.pid;$process=Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue;if(-not$process){continue};$expected=(Join-Path $PSScriptRoot "run-service.ps1");if($process.CommandLine -notlike "*$expected*"){throw "O PID $id não pertence ao launcher Achilles. Nenhum processo foi parado."};Stop-Tree $id;Write-Host "[OK] $($entry.name) parado." }; if(Test-Path -LiteralPath $PidFile){Remove-Item -LiteralPath $PidFile}; if(-not $KeepDatabase){$answer=Read-Host "Também deseja desligar o banco local? S/N";if($answer -match '^[sS]'){docker compose -f (Join-Path $ProjectRoot "docker-compose.yml") down;Ok "Banco local desligado sem apagar volumes"}} }
function Invoke-Status { Write-Title; $checks=@(@("PostgreSQL",$Ports.Postgres,$null),@("Backend",$Ports.Backend,"http://localhost:9000/health"),@("Admin",$Ports.Admin,"http://localhost:3001/api/health"),@("Storefront",$Ports.Storefront,"http://localhost:3000/api/health"));foreach($c in $checks){$online=if($c[2]){Test-Http $c[2]}else{[bool](Get-NetTCPConnection -LocalPort $c[1] -State Listen -ErrorAction SilentlyContinue)};Write-Host ("{0,-14} {1,-8} porta {2}" -f $c[0],$(if($online){"ONLINE"}else{"OFFLINE"}),$c[1]) -ForegroundColor $(if($online){"Green"}else{"Yellow"})} }
function Invoke-Start { Write-Title; Ensure-Directory $RuntimeDir;Ensure-Directory $LogDir;Assert-Tools;Assert-Environment;if(-not(Test-Path -LiteralPath (Join-Path $ProjectRoot "node_modules"))){throw "Dependências ausentes. Execute SETUP_ACHILLES.bat."};Ensure-Postgres;Invoke-Migrations;$processes=@(Read-Processes|Where-Object{Get-Process -Id $_.pid -ErrorAction SilentlyContinue});$processes+=Start-ServiceProcess "Backend" "@achilles/commerce" "commerce.log" $Ports.Backend;$processes+=Start-ServiceProcess "Storefront" "@achilles/storefront" "storefront.log" $Ports.Storefront;$processes+=Start-ServiceProcess "Admin" "@achilles/simple-admin" "admin.log" $Ports.Admin;$processes=@($processes|Where-Object{$_}|Sort-Object name -Unique);ConvertTo-Json -InputObject @($processes) -Depth 4|Set-Content -LiteralPath $PidFile;Wait-Http "Backend" "http://localhost:9000/health";Wait-Http "Storefront" "http://localhost:3000/api/health";Wait-Http "Admin" "http://localhost:3001/api/health";$adminUrl=if($script:UseSimpleAdmin){"http://localhost:3001"}else{"http://localhost:9000/app"};Write-Host "`nACHILLES STORE PRONTA`n" -ForegroundColor Green;Write-Host "Loja: http://localhost:3000`nAdmin: $adminUrl`nBackend: http://localhost:9000";if(-not$NoOpen){Start-Process "http://localhost:3000";Start-Process $adminUrl} }
function Invoke-Setup { Write-Title;Ensure-Directory $RuntimeDir;Ensure-Directory $LogDir;Assert-Tools;Assert-Environment;Push-Location $ProjectRoot;try{pnpm install --frozen-lockfile;if($LASTEXITCODE-ne 0){throw "A instalação das dependências falhou."};Ensure-Postgres;Invoke-Migrations;pnpm typecheck;if($LASTEXITCODE-ne 0){throw "A validação TypeScript falhou."}}finally{Pop-Location};Write-Host "`nCONFIGURAÇÃO CONCLUÍDA`n`nAgora use:`nSTART_ACHILLES.bat" -ForegroundColor Green }
function Invoke-Update { Push-Location $ProjectRoot;try{if(git status --porcelain){throw "Existem mudanças locais. O update foi interrompido para não sobrescrever seu trabalho."};git pull --ff-only origin main;if($LASTEXITCODE-ne 0){throw "Não foi possível atualizar a branch main."};pnpm install --frozen-lockfile;Invoke-Migrations;pnpm typecheck}finally{Pop-Location} }
function Install-Shortcuts { $desktop=[Environment]::GetFolderPath("Desktop");$shell=New-Object -ComObject WScript.Shell;$items=@(@("ACHILLES STORE","START_ACHILLES.bat"),@("ACHILLES STORE - PARAR","STOP_ACHILLES.bat"),@("ACHILLES STORE - STATUS","STATUS_ACHILLES.bat"),@("ACHILLES STORE - ATUALIZAR","UPDATE_ACHILLES.bat"));foreach($item in $items){$shortcut=$shell.CreateShortcut((Join-Path $desktop "$($item[0]).lnk"));$shortcut.TargetPath=Join-Path $ProjectRoot $item[1];$shortcut.WorkingDirectory=$ProjectRoot;$shortcut.Save()};Ok "Atalhos instalados na Área de Trabalho" }
function Enable-Autostart { $answer=Read-Host "Iniciar a Achilles Store automaticamente após o login? S/N";if($answer-notmatch'^[sS]'){return};schtasks /Create /TN "ACHILLES STORE" /SC ONLOGON /TR "`"$(Join-Path $ProjectRoot 'START_ACHILLES.bat')`" --no-open" /F|Out-Host;Ok "Inicialização automática habilitada" }
function Disable-Autostart { schtasks /Delete /TN "ACHILLES STORE" /F 2>$null|Out-Null;Ok "Inicialização automática desabilitada" }

try { switch($Action){"Setup"{Invoke-Setup};"Start"{Invoke-Start};"Stop"{Invoke-Stop};"Restart"{$KeepDatabase=$true;Invoke-Stop;Invoke-Start};"Status"{Invoke-Status};"Update"{Invoke-Update};"InstallShortcuts"{Install-Shortcuts};"EnableAutostart"{Enable-Autostart};"DisableAutostart"{Disable-Autostart}} } catch { Fail $_.Exception.Message; Write-SanitizedLog "$(Get-Date -Format o) $($_.Exception.Message)"; exit 1 }
