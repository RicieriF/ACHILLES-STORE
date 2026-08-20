@echo off
setlocal
cd /d "%~dp0"
echo [ACHILLES] Iniciando PostgreSQL...
call pnpm docker:up
if errorlevel 1 goto :docker_failed
echo [OK] PostgreSQL solicitado ao Docker.

echo [ACHILLES] Iniciando Commerce e Storefront...
start "ACHILLES DEV" /D "%~dp0" cmd /k pnpm dev

call :wait_url "http://localhost:9000/ready" "Commerce" 180
if errorlevel 1 goto :runtime_failed
echo [OK] Commerce OK.

call :wait_url "http://localhost:3000/api/health" "Storefront" 120
if errorlevel 1 goto :runtime_failed
echo [OK] Storefront OK.
echo [OK] Admin ready.

start "" "http://localhost:3000"
start "" "http://localhost:9000/app"
echo [ACHILLES] Loja e Admin abertos.
exit /b 0

:wait_url
set "ACHILLES_URL=%~1"
set "ACHILLES_SERVICE=%~2"
set "ACHILLES_TIMEOUT=%~3"
powershell -NoProfile -Command "$deadline=(Get-Date).AddSeconds(%ACHILLES_TIMEOUT%); do { try { $response=Invoke-WebRequest -UseBasicParsing -Uri '%ACHILLES_URL%' -TimeoutSec 3; if ($response.StatusCode -eq 200) { exit 0 } } catch {}; Start-Sleep -Seconds 2 } while ((Get-Date) -lt $deadline); Write-Host '[ERRO] %ACHILLES_SERVICE% nao respondeu HTTP 200 em %ACHILLES_TIMEOUT%s.'; exit 1"
exit /b %errorlevel%

:docker_failed
echo [ERRO] Docker/PostgreSQL nao iniciou. Confirme que Docker Desktop esta ativo.
pause
exit /b 1

:runtime_failed
echo [ERRO] Runtime incompleto. Consulte a janela ACHILLES DEV e execute pnpm db:migrate se necessario.
pause
exit /b 1
