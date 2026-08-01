@echo off
REM Inicia ambient_host_player via PowerShell (autoplay, sin duplicar proceso)
cd /d "%~dp0.."
set AMBIENT_AUTOPLAY=%AMBIENT_AUTOPLAY%
if "%AMBIENT_AUTOPLAY%"=="" set AMBIENT_AUTOPLAY=default
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0Start-AmbientHost.ps1" -AutoPlay %AMBIENT_AUTOPLAY%
