@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-servicio.ps1" -Uninstall
if errorlevel 1 pause
