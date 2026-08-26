@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title ACHILLES STORE - CONTROL CENTER

set "ROOT=%~dp0"
set "LAUNCHER=%ROOT%scripts\launcher\achilles-launcher.ps1"
set "CLI=0"
set "POST_STATUS=0"
set "POST_UPDATE=0"

if not exist "%LAUNCHER%" (
  echo [ERRO] O painel principal da Achilles Store nao foi encontrado.
  echo Consulte: .logs\launcher.log
  pause
  exit /b 1
)

if "%~1"=="" goto MENU
set "CLI=1"
if /I "%~1"=="--start" goto START_SILENT
if /I "%~1"=="--stop" goto STOP
if /I "%~1"=="--restart" goto RESTART
if /I "%~1"=="--status" goto STATUS
if /I "%~1"=="--update" goto UPDATE
if /I "%~1"=="--setup" goto SETUP
if /I "%~1"=="--debug" goto DEBUG
echo [ERRO] Argumento desconhecido: %~1
echo Use --start, --stop, --restart, --status, --update, --setup ou --debug.
exit /b 2

:MENU
set "CLI=0"
set "POST_STATUS=0"
set "POST_UPDATE=0"
cls
echo ============================================================
echo                ACHILLES STORE - CONTROL CENTER
echo ============================================================
echo.
echo OPERACAO
echo [1] LIGAR TUDO
echo [2] DESLIGAR TUDO
echo [3] REINICIAR SERVICOS
echo [4] STATUS
echo.
echo MANUTENCAO
echo [5] ATUALIZAR PROJETO
echo [6] CONFIGURACAO INICIAL / REPARAR
echo [7] MODO DEBUG
echo [8] ABRIR LOGS
echo.
echo ACESSOS
echo [9]  ABRIR LOJA
echo [10] ABRIR PAINEL ADMIN
echo [11] ABRIR ADMIN AVANCADO
echo.
echo INICIALIZACAO
echo [12] ATIVAR INICIO AUTOMATICO
echo [13] DESATIVAR INICIO AUTOMATICO
echo [14] CRIAR ATALHO NA AREA DE TRABALHO
echo.
echo [0] SAIR
echo.
set "OPT="
set /p "OPT=Escolha uma opcao: "
if not defined OPT goto END
if "%OPT%"=="1" goto START
if "%OPT%"=="2" goto STOP
if "%OPT%"=="3" goto RESTART
if "%OPT%"=="4" goto STATUS
if "%OPT%"=="5" goto UPDATE
if "%OPT%"=="6" goto SETUP
if "%OPT%"=="7" goto DEBUG
if "%OPT%"=="8" goto LOGS
if "%OPT%"=="9" goto OPEN_STORE
if "%OPT%"=="10" goto OPEN_ADMIN
if "%OPT%"=="11" goto OPEN_ADVANCED
if "%OPT%"=="12" goto AUTOSTART_ON
if "%OPT%"=="13" goto AUTOSTART_OFF
if "%OPT%"=="14" goto SHORTCUT
if "%OPT%"=="0" goto END
echo Opcao invalida.
timeout /t 2 >nul
goto MENU

:START
set "ACTION=Start"
set "EXTRA="
set "POST_STATUS=1"
goto RUN

:START_SILENT
set "ACTION=Start"
set "EXTRA=-NoOpen"
set "POST_STATUS=0"
goto RUN

:STOP
set "ACTION=Stop"
set "EXTRA="
goto RUN

:RESTART
set "ACTION=Restart"
set "EXTRA="
set "POST_STATUS=1"
goto RUN

:STATUS
set "ACTION=Status"
set "EXTRA="
goto RUN

:UPDATE
set "ACTION=Update"
set "EXTRA="
set "POST_STATUS=1"
set "POST_UPDATE=1"
goto RUN

:SETUP
set "ACTION=Setup"
set "EXTRA="
goto RUN

:DEBUG
set "ACTION=Start"
set "EXTRA=-DebugMode"
set "POST_STATUS=1"
goto RUN

:AUTOSTART_ON
set "ACTION=EnableAutostart"
set "EXTRA="
goto RUN

:AUTOSTART_OFF
set "ACTION=DisableAutostart"
set "EXTRA="
goto RUN

:SHORTCUT
set "ACTION=InstallShortcuts"
set "EXTRA="
goto RUN

:RUN
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Action %ACTION% %EXTRA%
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" goto RUN_ERROR
if "%POST_UPDATE%"=="1" if "%CLI%"=="0" (
  choice /C SN /N /M "Reiniciar os servicos Achilles agora? S/N "
  if errorlevel 2 goto AFTER_ACTION
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Action Restart
  set "RC=!ERRORLEVEL!"
  if not "!RC!"=="0" goto RUN_ERROR
)
:AFTER_ACTION
if "%POST_STATUS%"=="1" (
  echo.
  echo STATUS FINAL
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Action Status
)
if "%CLI%"=="1" exit /b 0
echo.
echo [OK] Operacao concluida.
echo.
pause
goto MENU

:RUN_ERROR
echo.
echo [ERRO] A operacao nao foi concluida.
echo Consulte os arquivos em .logs
if "%CLI%"=="1" exit /b %RC%
echo.
pause
goto MENU

:LOGS
if not exist "%ROOT%.logs" mkdir "%ROOT%.logs" >nul 2>&1
start "" explorer.exe "%ROOT%.logs"
goto MENU

:OPEN_STORE
set "SERVICE_NAME=A loja"
set "HEALTH_URL=http://localhost:3000/api/health"
set "OPEN_URL=http://localhost:3000"
goto OPEN_ACCESS

:OPEN_ADMIN
set "SERVICE_NAME=O painel administrativo"
set "HEALTH_URL=http://localhost:3001/api/health"
set "OPEN_URL=http://localhost:3001"
goto OPEN_ACCESS

:OPEN_ADVANCED
set "SERVICE_NAME=O admin avancado"
set "HEALTH_URL=http://localhost:9000/health"
set "OPEN_URL=http://localhost:9000/app"
goto OPEN_ACCESS

:OPEN_ACCESS
powershell.exe -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri '%HEALTH_URL%' -TimeoutSec 3;if($r.StatusCode-ge 200-and$r.StatusCode-lt 300){exit 0}}catch{};exit 1"
if not errorlevel 1 (
  start "" "%OPEN_URL%"
  goto MENU
)
echo.
echo %SERVICE_NAME% esta desligada.
choice /C SN /N /M "Deseja iniciar a Achilles Store agora? S/N "
if errorlevel 2 goto MENU
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%" -Action Start -NoOpen
if errorlevel 1 goto RUN_ERROR
powershell.exe -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing -Uri '%HEALTH_URL%' -TimeoutSec 3;if($r.StatusCode-ge 200-and$r.StatusCode-lt 300){exit 0}}catch{};exit 1"
if errorlevel 1 goto RUN_ERROR
start "" "%OPEN_URL%"
goto MENU

:END
endlocal
exit /b 0
