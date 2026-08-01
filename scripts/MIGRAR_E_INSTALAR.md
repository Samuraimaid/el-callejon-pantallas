# Migrar e instalar El Callejón en otro PC

## Qué incluye este kit

| Comando | Uso |
|---------|-----|
| `scripts\Install-Callejon.bat` | Instalación completa (admin, deps, Docker, stack, QR) |
| `scripts\Start-Callejon.bat` | Solo arrancar + hub QR |
| `scripts\Backup-CallejonUSB.bat` | Respaldo a USB (código + multimedia + DB + Music) |

## Flujo recomendado (PC actual → USB → PC nuevo)

### 1. Respaldo en el PC actual

1. Ideal: `docker compose stop` (backup de Postgres más limpio).
2. Ejecutar **como administrador**:

```bat
scripts\Backup-CallejonUSB.bat
```

3. Elija la letra de la USB. Se crea algo como:

```text
E:\EL_CALLEJON_BACKUP_20260408-1530\
  ├── backend, frontend, db, scripts…
  ├── Music\                 ← MP3 ambiente
  ├── frontend\public\images ← fotos y videos de campañas
  ├── data\postgres          ← base de datos
  ├── .env                   ← secretos (no compartir)
  ├── LEAME_RESTAURAR.txt
  └── BACKUP_MANIFEST.json
```

### 2. En el PC nuevo

1. Copie la carpeta del backup a `C:\EL_CALLEJON_POS` (o deje en la USB si es rápida).
2. Doble clic (o clic derecho → Ejecutar como administrador):

```bat
scripts\Install-Callejon.bat
```

Equivale a:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
cd C:\EL_CALLEJON_POS
.\scripts\Install-Callejon.ps1
```

### 3. Qué hace el instalador

1. **Eleva a Administrador** (UAC).
2. Revisa **CPU, RAM, disco, Windows 64-bit**.
3. Detecta **Docker, Python, VLC, winget**.
4. Instala **Docker Desktop** con winget si falta.
5. Espera al motor Docker / WSL2.
6. Abre **firewall** TCP 5173, 8000, 8788 (red privada).
7. Escribe **LAN_IP** en `.env` y regenera JWT si es plantilla débil.
8. `docker compose up -d --build`.
9. Aplica migraciones SQL.
10. Genera `scripts\generated\hub.html` con **dos QR**:
    - **Pantallas** → `http://IP:5173/` (lobby TVs)
    - **Control** → `http://IP:5173/login` (solo staff)
11. Abre el navegador.

## Seguridad: lobby ≠ control

- El **hub de Smart TVs** (`/`) **ya no muestra** el botón “Centro de Control”.
- El personal entra por URL directa:
  - `http://IP:5173/login` o `http://IP:5173/control`
- Recomendación: use control en el **PC del bar** o tablet; no lo deje de favorito en las TVs del salón.
- Cambie la contraseña de admin (por defecto de demo) en el primer uso.
- Cambie `POSTGRES_PASSWORD` y `JWT_SECRET` en `.env` en producción.

## Arranque diario / autónomo al encender el PC

**Opción A – automático (recomendado en el PC servidor):**

```bat
scripts\Register-Autostart.bat
```

Registra **dos tareas** al iniciar sesión:

| Tarea | Delay | Qué hace |
|-------|-------|----------|
| `ElCallejon-Ambient` | **10 s** | `ambient_host_player.py` + autoplay (**música sin esperar Docker**) |
| `ElCallejon-Boot` | **20 s** | Docker + contenedores + QR admin + reconfirma música |

Autoplay: **Me gusta** si hay likes; si no, **shuffle todas las carpetas**.

```bat
scripts\Start-AmbientHost.bat
scripts\Start-CallejonBoot.bat
```

Quitar: `scripts\Register-Autostart.ps1 -Unregister`  
Logs: `scripts\generated\ambient.log` y `boot.log`

**Opción B – manual:**

```bat
scripts\Start-AmbientHost.bat
scripts\Start-Callejon.bat
```

## Requisitos mínimos (recomendados)

| Recurso | Mínimo | Ideal |
|---------|--------|-------|
| SO | Windows 10/11 64-bit | Windows 11 |
| RAM | 4 GB | 8–16 GB |
| Disco libre | 15 GB | 40 GB+ (videos/música) |
| Red | Ethernet o Wi‑Fi estable | Ethernet al router |
| Software | Docker Desktop | + VLC + Python (ambiente) |

## Sugerencias de operación

1. **USB de backup recurrente** (semanal): campañas y `Music` crecen; no confíe solo en un disco.
2. **Kiosco en TVs** (Chrome/Edge en stick o PC HDMI):

   ```bat
   chrome.exe --kiosk --app=http://192.168.x.x:5173/tv/3
   ```

3. **No suba** `.env` ni `data/postgres` a GitHub público.
4. Si Docker pide reinicio tras instalar WSL2, complete el reinicio y vuelva a ejecutar el instalador con `-SkipDockerInstall` si Docker ya está.
5. Tras migrar, verifique en el Centro de Control que las 6 zonas y el menú cargan; re-escanee música ambiente (`Scan` en panel Ambiente).

## Solución de problemas

| Síntoma | Qué hacer |
|---------|-----------|
| Docker no arranca | Abrir Docker Desktop, aceptar WSL2, reiniciar PC |
| TVs no ven el hub | Misma red Wi‑Fi; firewall; usar IP de `ipconfig` en `.env` → `LAN_IP=` |
| Pantalla negra | Ctrl+F5; revisar que no esté en “En reposo” en el panel |
| Música no suena | `start_ambient_player.bat`; dispositivo de audio predeterminado Windows |
| Backup enorme | Excluya `.git` (por defecto) o mueva MP4 viejos de `Music` |

## Comandos útiles

```powershell
# Solo hub QR (stack ya corriendo)
.\scripts\Start-Callejon.ps1 -NoCompose

# Instalar sin reconstruir imágenes
.\scripts\Install-Callejon.ps1 -NoBuild

# Backup a ruta fija
.\scripts\Backup-CallejonUSB.ps1 -Destination "E:\CallejonFull"
```
