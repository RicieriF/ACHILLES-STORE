@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launcher\achilles-launcher.ps1" -Action Update
if errorlevel 1 pause
