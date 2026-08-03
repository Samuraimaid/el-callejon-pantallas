"""API de respaldos automáticos personalizables."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import require_caja
from app.services import backup_config as bak

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
        "modes": {
            "content": "Sin software: multimedia, campañas, BD, configs de usuario",
            "full": "Con software: content + código + scripts + compose",
            "migrate": "Paquete migración: full + instalador listo para otro PC",
        },
        "notes": [
            "El backup lo ejecuta Windows (Task Scheduler), no el contenedor Docker.",
            "Tras cambiar horario, re-registre la tarea o reinicie INSTALLAR/Register-DailyBackup.",
            "POST /api/backup/run encola un respaldo inmediato (worker cada pocos min).",
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
    # Señal para que el worker Windows re-registre el horario
    try:
        bak.request_run  # noqa: B018 — ensure module loaded
        req_path = bak._config_path().parent / "backup_schedule_reload.flag"
        req_path.write_text(str(int(__import__("time").time())), encoding="utf-8")
    except Exception:
        pass
    return {
        "ok": True,
        "config": cfg,
        **cfg,
        "message": "Config de respaldo guardada. El worker aplicará el nuevo horario.",
    }


@router.get("/status")
async def status(_user=Depends(require_caja)) -> dict[str, Any]:
    cfg = bak.get_config()
    pending = bak.peek_request()
    return {
        "ok": True,
        "enabled": cfg.get("enabled"),
        "time": cfg.get("time"),
        "days": cfg.get("days"),
        "mode": cfg.get("mode"),
        "incremental": cfg.get("incremental"),
        "last_run": cfg.get("last_run"),
        "last_status": cfg.get("last_status"),
        "last_path": cfg.get("last_path"),
        "last_error": cfg.get("last_error"),
        "pending_request": pending,
        "history": bak.get_history(15),
    }


@router.get("/history")
async def history(
    limit: int = 20, _user=Depends(require_caja)
) -> dict[str, Any]:
    return {"ok": True, "history": bak.get_history(limit)}


@router.post("/run")
async def run_now(
    body: BackupRunIn | None = None, _user=Depends(require_caja)
) -> dict[str, Any]:
    """
    Encola un respaldo inmediato.
    El script Register-DailyBackup / worker en Windows lo ejecuta.
    """
    b = body or BackupRunIn()
    include = None
    if b.include is not None:
        include = b.include.model_dump(exclude_none=True)
    res = bak.request_run(
        mode=b.mode,
        destination=b.destination,
        incremental=b.incremental,
        migrate_bundle=b.migrate_bundle,
        include=include,
    )
    return {
        **res,
        "message": (
            "Respaldo encolado. El worker de Windows lo ejecutará en breve "
            "(tarea ElCallejon-BackupWorker). "
            "También puede lanzar: scripts\\Backup-Callejon.bat"
        ),
    }


@router.post("/run/content")
async def run_content(_user=Depends(require_caja)) -> dict[str, Any]:
    """Atajo: respaldo sin software (solo datos/multimedia)."""
    return await run_now(
        BackupRunIn(mode="content", incremental=True, migrate_bundle=False)
    )


@router.post("/run/full")
async def run_full(_user=Depends(require_caja)) -> dict[str, Any]:
    """Atajo: respaldo con software."""
    return await run_now(
        BackupRunIn(mode="full", incremental=True, migrate_bundle=False)
    )


@router.post("/run/migrate")
async def run_migrate(_user=Depends(require_caja)) -> dict[str, Any]:
    """Atajo: paquete migración (datos + software + instalador)."""
    return await run_now(
        BackupRunIn(mode="migrate", incremental=False, migrate_bundle=True)
    )
