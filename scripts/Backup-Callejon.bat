@echo off
cd /d "%~dp0.."
title El Callejon - Respaldo
echo.
echo  Respaldo El Callejon (use -Mode content^|full^|migrate)
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Backup-Callejon.ps1" -FromConfig %*
if errorlevel 1 pause
echo.
pause
