@echo off
REM Reproductor de ambiente El Callejón (Windows host)
REM Audio sale por el dispositivo predeterminado (Bluetooth o jack 3.5)

cd /d "%~dp0.."
set MUSIC_ROOT=%CD%\Music
set AMBIENT_PORT=8788

echo.
echo  El Callejon - Ambient host player
echo  Music: %MUSIC_ROOT%
echo  API:   http://127.0.0.1:%AMBIENT_PORT%
echo  Jack/BT: Configurar en Windows como dispositivo de reproduccion
echo.

if exist "%USERPROFILE%\.local\bin\python3.14.exe" (
  "%USERPROFILE%\.local\bin\python3.14.exe" scripts\ambient_host_player.py --music "%MUSIC_ROOT%" --port %AMBIENT_PORT%
) else if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
  "%LocalAppData%\Programs\Python\Python312\python.exe" scripts\ambient_host_player.py --music "%MUSIC_ROOT%" --port %AMBIENT_PORT%
) else (
  python scripts\ambient_host_player.py --music "%MUSIC_ROOT%" --port %AMBIENT_PORT%
)
pause
