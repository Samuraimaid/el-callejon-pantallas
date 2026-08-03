@echo off
cd /d "%~dp0.."
title El Callejon - Actualizar Docker Desktop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Update-DockerDesktop.ps1" %*
if errorlevel 1 pause
