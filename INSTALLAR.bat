@echo off
:: ============================================================
::  El Callejon - Instalador PC SERVIDOR (doble clic)
::  Solicita Administrador y prepara todo el sistema
:: ============================================================
cd /d "%~dp0"
title El Callejon - Instalador servidor
echo.
echo  ================================================
echo   El Callejon - Instalador PC servidor
echo   Pantallas digitales + musica ambiente
echo  ================================================
echo.
echo  Se pediran permisos de Administrador...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Install-Callejon.ps1" -StartAmbient %*
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo.
  echo  ERROR codigo %ERR%. Revise el mensaje anterior.
  pause
  exit /b %ERR%
)
echo.
pause
