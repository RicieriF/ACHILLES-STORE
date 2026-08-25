@echo off
set ARGS=
if /I "%~1"=="--debug" set ARGS=-DebugMode
if /I "%~1"=="--no-open" set ARGS=-NoOpen
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher\achilles-launcher.ps1" -Action Start %ARGS%
if errorlevel 1 pause
