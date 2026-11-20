@echo off
REM Doble clic: eleva a Administrador y corre el instalador NSSM de CeereLITE.
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-servicio.ps1"
if errorlevel 1 pause
