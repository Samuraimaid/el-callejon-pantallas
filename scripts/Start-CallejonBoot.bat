@echo off
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0Start-CallejonBoot.ps1" %*
