@echo off
:: Instalador El Callejón — solicita Administrador automáticamente
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Callejon.ps1" %*
if errorlevel 1 pause
