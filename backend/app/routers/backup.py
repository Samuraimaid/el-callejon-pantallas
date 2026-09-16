from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.deps import require_caja
from app.services import backup_config as bak
from app.services import cloud_backup

router = APIRouter(prefix="/api/backup", tags=["backup"])


class IncludeIn(BaseModel):
    music: bool | None = None
    images: bool | None = None
    videos: bool | None = None
    postgres: bool | None = None
    env: bool | None = None
    config: bool | None = None
    source_code: bool | None = None
    installer: bool | None = None
    docker_compose: bool | None = None


class BackupConfigIn(BaseModel):
    enabled: bool | None = None
    time: str | None = Field(default=None, description="HH:MM 24h, ej. 15:30")
    days: list[int] | None = Field(
        default=None, description="0=dom … 6=sáb; default todos"
    )
    destination: str | None = None
    mode: str | None = Field(
        default=None,
        description="content (sin software) | full (con software) | migrate",
    )
    incremental: bool | None = None
    keep_days: int | None = Field(default=None, ge=1, le=365)
    keep_full_count: int | None = Field(default=None, ge=1, le=30)
    include: IncludeIn | None = None
    migrate_bundle: bool | None = None


class BackupRunIn(BaseModel):
    mode: str | None = None
    destination: str | None = None
    incremental: bool | None = None
    migrate_bundle: bool | None = None
    include: IncludeIn | None = None


@router.get("/config")
async def get_config(_user=Depends(require_caja)) -> dict[str, Any]:
    cfg = bak.get_config()
    return {
        "ok": True,
        "config": cfg,
        **cfg,
        "destination": "Google Cloud Storage (gs://callejon-multimedia-pos/backups)",
        "modes": {
            "content": "Sin software: multimedia, campañas, BD, configs de usuario",
            "full": "Con software: content + código + scripts + compose",
            "migrate": "Paquete migración: full + instalador listo para otro PC",
        },
        "notes": [
            "Respaldos administrados directamente en Google Cloud Storage (gs://callejon-multimedia-pos/backups).",
            "Descarga manual en cualquier momento en formato ZIP.",
        ],
    }


@router.put("/config")
async def put_config(
    body: BackupConfigIn, _user=Depends(require_caja)
) -> dict[str, Any]:
    patch = body.model_dump(exclude_none=True)
    if "include" in patch and isinstance(patch["include"], dict):
        patch["include"] = {k: v for k, v in patch["include"].items() if v is not None}
    cfg = bak.update_config(patch)
    return {
        "ok": True,
        "config": cfg,
        **cfg,
        "destination": "Google Cloud Storage (gs://callejon-multimedia-pos/backups)",
        "message": "Configuración de respaldo guardada.",
    }


@router.get("/status")
async def status(_user=Depends(require_caja)) -> dict[str, Any]:
    cfg = bak.get_config()
    cloud_list = cloud_backup.list_cloud_backups()
    last_cloud = cloud_list[0] if cloud_list else None

    last_run = last_cloud["created_at"] if last_cloud else cfg.get("last_run")
    last_status = "success" if last_cloud else (cfg.get("last_status") or "—")
    last_path = last_cloud["path"] if last_cloud else (cfg.get("last_path") or "gs://callejon-multimedia-pos/backups/")
    last_size = last_cloud.get("size_human") if last_cloud else None

    return {
        "ok": True,
        "enabled": cfg.get("enabled", True),
        "time": cfg.get("time", "15:30"),
        "days": cfg.get("days", [0, 1, 2, 3, 4, 5, 6]),
        "mode": cfg.get("mode", "content"),
        "destination": "Google Cloud Storage (gs://callejon-multimedia-pos/backups)",
        "incremental": cfg.get("incremental", True),
        "last_run": last_run,
        "last_status": last_status,
        "last_path": last_path,
        "last_size": last_size,
        "last_error": cfg.get("last_error"),
        "pending_request": None,
        "history": cloud_list if cloud_list else bak.get_history(15),
    }


@router.get("/history")
async def history(
    limit: int = 20, _user=Depends(require_caja)
) -> dict[str, Any]:
    cloud_list = cloud_backup.list_cloud_backups()
    return {"ok": True, "history": cloud_list[:limit]}


@router.post("/run")
async def run_now(
    body: BackupRunIn | None = None,
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    """Genera y almacena un respaldo directamente en Google Cloud Storage."""
    filename, path, size, stats = await cloud_backup.generate_backup_archive(db)
    return {
        "ok": True,
        "filename": filename,
        "size": size,
        "size_human": cloud_backup._format_size(size),
        "path": f"gs://callejon-multimedia-pos/backups/{filename}",
        "stats": stats,
        "message": f"Respaldo generado y guardado en Google Cloud Storage ({cloud_backup._format_size(size)}).",
    }


@router.post("/run/content")
async def run_content(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await run_now(BackupRunIn(mode="content"), db, _user)


@router.post("/run/full")
async def run_full(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await run_now(BackupRunIn(mode="full"), db, _user)


@router.post("/run/migrate")
async def run_migrate(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
) -> dict[str, Any]:
    return await run_now(BackupRunIn(mode="migrate"), db, _user)


@router.get("/download/{filename}")
async def download_backup(
    filename: str,
    _user=Depends(require_caja),
):
    """Descarga manual de un archivo de respaldo específico desde Google Cloud Storage."""
    file_path = cloud_backup.get_backup_filepath(filename)
    return FileResponse(
        path=str(file_path),
        media_type="application/zip",
        filename=filename,
    )


@router.get("/download-now")
async def download_now(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_caja),
):
    """Genera un respaldo al vuelo y lo envía directamente para descarga en el navegador."""
    filename, file_path, _, _ = await cloud_backup.generate_backup_archive(db)
    return FileResponse(
        path=str(file_path),
        media_type="application/zip",
        filename=filename,
    )

