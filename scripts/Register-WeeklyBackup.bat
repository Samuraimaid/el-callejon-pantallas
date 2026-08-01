@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Register-WeeklyBackup.ps1" %*
if errorlevel 1 pause
