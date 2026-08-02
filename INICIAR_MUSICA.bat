@echo off
:: ============================================================
::  El Callejon - Arrancar musica ambiente YA (doble clic)
::  Relanza ambient_host_player + vigilante si hace falta
:: ============================================================
cd /d "%~dp0"
title El Callejon - Musica ambiente
echo.
echo  Iniciando reproductor ambiente (puerto 8788)...
echo.
:: Manual: al hacer doble clic SI queremos musica (default = likes/shuffle)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\Ensure-AmbientRunning.ps1" -ProjectRoot "%CD%" -AutoPlay default
if errorlevel 1 (
  echo.
  echo  Hubo un problema. Revise scripts\generated\ambient-ensure.log
  echo  y scripts\generated\ambient.log
  pause
  exit /b 1
)
echo.
echo  Listo. Compruebe: http://127.0.0.1:8788/health
echo  Panel admin - pestana Ambiente (no deberia decir HOST OFFLINE).
echo.
timeout /t 4 >nul
exit /b 0
