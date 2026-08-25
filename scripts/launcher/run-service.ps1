param([string]$ProjectRoot,[string]$Filter,[string]$LogPath)
$ErrorActionPreference="Continue";Set-Location $ProjectRoot
pnpm --filter $Filter dev 2>&1 | ForEach-Object { $line="$_" -replace '(?i)(password|token|secret|authorization|cookie|database_url)(\s*[:=]\s*)[^\s,;]+','$1$2[REDACTED]';Add-Content -LiteralPath $LogPath -Value $line }
