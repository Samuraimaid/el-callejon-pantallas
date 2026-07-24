"""Cola de jobs de video multi-pantalla con progreso."""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import AsyncSessionLocal
from app.services import pantallas as pant_svc
from app.services import publicidad as pub
from app.services.perfiles import get_perfil, pick_template_pair
from app.services.video_process import (
    MAX_UPLOAD_BYTES,
    new_video_paths,
    transcode_to_1080p,
    videos_dir,
)
from app.ws_manager import CHANNEL_ADMIN, CHANNEL_ALL, CHANNEL_PANTALLAS, ws_manager

ZONAS_OK = frozenset({"TV3", "TV4", "TV5", "TV6"})


def _map_job(row: Any) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "batch_id": str(row["batch_id"]),
        "filename": row.get("filename") or "",
        "status": row["status"],
        "progress": int(row.get("progress") or 0),
        "stage": row.get("stage") or "",
        "zonas": row.get("zonas") if isinstance(row.get("zonas"), list) else (
            json.loads(row["zonas"]) if isinstance(row.get("zonas"), str) else []
        ),
        "video_url": row.get("video_url"),
        "poster_url": row.get("poster_url"),
        "slide_ids": row.get("slide_ids") if isinstance(row.get("slide_ids"), list) else (
            json.loads(row["slide_ids"]) if isinstance(row.get("slide_ids"), str) else []
        ),
        "error_msg": row.get("error_msg"),
        "meta": row.get("meta") if isinstance(row.get("meta"), dict) else (
            json.loads(row["meta"]) if isinstance(row.get("meta"), str) else {}
        ),
        "creado_en": (
            row["creado_en"].isoformat() if row.get("creado_en") else None
        ),
        "actualizado_en": (
            row["actualizado_en"].isoformat() if row.get("actualizado_en") else None
        ),
    }


async def get_job(db: AsyncSession, job_id: str) -> dict[str, Any]:
    result = await db.execute(
        text("SELECT * FROM video_jobs WHERE id = CAST(:id AS uuid)"),
        {"id": job_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, "Job no encontrado")
    return _map_job(row)


async def get_batch(db: AsyncSession, batch_id: str) -> dict[str, Any]:
    result = await db.execute(
        text(
            """
            SELECT * FROM video_jobs
            WHERE batch_id = CAST(:b AS uuid)
            ORDER BY creado_en ASC
            """
        ),
        {"b": batch_id},
    )
    jobs = [_map_job(r) for r in result.mappings().all()]
    if not jobs:
        raise HTTPException(404, "Lote no encontrado")
    total = len(jobs)
    done = sum(1 for j in jobs if j["status"] in ("ready", "error", "cancelled"))
    ready = sum(1 for j in jobs if j["status"] == "ready")
    errs = sum(1 for j in jobs if j["status"] == "error")
    avg = int(sum(j["progress"] for j in jobs) / total) if total else 0
    status = "processing"
    if done == total:
        status = "ready" if errs == 0 else ("error" if ready == 0 else "partial")
    return {
        "batch_id": batch_id,
        "status": status,
        "progress": avg,
        "total": total,
        "ready": ready,
        "errors": errs,
        "done": done,
        "jobs": jobs,
        "message": _batch_message(status, ready, total, errs),
    }


def _batch_message(status: str, ready: int, total: int, errs: int) -> str:
    if status == "processing":
        return (
            f"Procesando videos… {ready}/{total} listos. "
            "En cuanto terminen se mostrarán en las pantallas seleccionadas."
        )
    if status == "ready":
        return f"Listo: {ready} video(s) ya están en las campañas."
    if status == "partial":
        return f"Parcial: {ready} OK, {errs} con error de {total}."
    return f"Error al procesar {errs} de {total} video(s)."


async def _update_job(
    db: AsyncSession,
    job_id: str,
    *,
    status: str | None = None,
    progress: int | None = None,
    stage: str | None = None,
    video_url: str | None = None,
    poster_url: str | None = None,
    slide_ids: list | None = None,
    error_msg: str | None = None,
    meta: dict | None = None,
) -> None:
    sets = ["actualizado_en = NOW()"]
    params: dict[str, Any] = {"id": job_id}
    if status is not None:
        sets.append("status = :status")
        params["status"] = status
    if progress is not None:
        sets.append("progress = :progress")
        params["progress"] = max(0, min(100, int(progress)))
    if stage is not None:
        sets.append("stage = :stage")
        params["stage"] = stage[:80]
    if video_url is not None:
        sets.append("video_url = :video_url")
        params["video_url"] = video_url
    if poster_url is not None:
        sets.append("poster_url = :poster_url")
        params["poster_url"] = poster_url
    if slide_ids is not None:
        sets.append("slide_ids = CAST(:slide_ids AS jsonb)")
        params["slide_ids"] = json.dumps(slide_ids, ensure_ascii=False)
    if error_msg is not None:
        sets.append("error_msg = :error_msg")
        params["error_msg"] = error_msg
    if meta is not None:
        sets.append("meta = CAST(:meta AS jsonb)")
        params["meta"] = json.dumps(meta, ensure_ascii=False)
    await db.execute(
        text(f"UPDATE video_jobs SET {', '.join(sets)} WHERE id = CAST(:id AS uuid)"),
        params,
    )
    await db.commit()


async def _broadcast_job(batch_id: str, job: dict | None = None) -> None:
    payload = {
        "t": "vidjob",
        "batch_id": batch_id,
        "job": job,
    }
    try:
        async with AsyncSessionLocal() as db:
            batch = await get_batch(db, batch_id)
            payload["batch"] = {
                "status": batch["status"],
                "progress": batch["progress"],
                "ready": batch["ready"],
                "total": batch["total"],
                "message": batch["message"],
            }
    except Exception:
        pass
    await ws_manager.publish(CHANNEL_ADMIN, payload)
    await ws_manager.publish(CHANNEL_ALL, payload)


async def create_multi_upload(
    db: AsyncSession,
    files: list[UploadFile],
    *,
    zonas: list[str],
    perfil_clave: str = "restaurante_diario",
    append: bool = True,
    activar_modo_evento: bool | None = None,
) -> dict[str, Any]:
    zonas = [z.upper() for z in zonas if z.upper() in ZONAS_OK]
    if not zonas:
        raise HTTPException(400, "Marque al menos una pantalla (TV3–TV6)")
    if not files:
        raise HTTPException(400, "No hay archivos de video")

    try:
        perfil = await get_perfil(db, perfil_clave)
    except HTTPException:
        perfil = {
            "clave": perfil_clave,
            "plantillas": {},
            "modo_evento": False,
        }

    batch_id = str(uuid.uuid4())
    job_rows: list[dict] = []

    # Guardar archivos raw en disco y crear jobs
    for f in files:
        ctype = (f.content_type or "").lower()
        name = f.filename or "video.mp4"
        if not ctype.startswith("video/") and not name.lower().endswith(
            (".mp4", ".webm", ".mov", ".m4v", ".mkv")
        ):
            continue
        raw = await f.read()
        if not raw:
            continue
        if len(raw) > MAX_UPLOAD_BYTES:
            raise HTTPException(400, f"{name}: supera el límite de tamaño")

        slide_id, raw_path, out_path = new_video_paths("multi")
        raw_path.write_bytes(raw)

        job_id = str(uuid.uuid4())
        await db.execute(
            text(
                """
                INSERT INTO video_jobs
                    (id, batch_id, filename, status, progress, stage, zonas, meta)
                VALUES
                    (CAST(:id AS uuid), CAST(:batch AS uuid), :filename,
                     'queued', 5, 'en-cola', CAST(:zonas AS jsonb),
                     CAST(:meta AS jsonb))
                """
            ),
            {
                "id": job_id,
                "batch": batch_id,
                "filename": name[:260],
                "zonas": json.dumps(zonas, ensure_ascii=False),
                "meta": json.dumps(
                    {
                        "raw_path": str(raw_path),
                        "out_path": str(out_path),
                        "slide_id": slide_id,
                        "perfil": perfil_clave,
                        "append": append,
                        "index": len(job_rows),
                    },
                    ensure_ascii=False,
                ),
            },
        )
        job_rows.append({"id": job_id, "filename": name})

    await db.commit()
    if not job_rows:
        raise HTTPException(400, "Ningún archivo de video válido")

    # Modo evento en TVs de publicidad seleccionadas
    if activar_modo_evento is None:
        activar_modo_evento = bool(perfil.get("modo_evento"))
    if activar_modo_evento:
        for z in zonas:
            try:
                tid = int(z.replace("TV", ""))
                await pant_svc.apply_control(db, tv_id=tid, modo_evento=True)
            except Exception:
                pass

    # Lanzar workers en background
    for jr in job_rows:
        asyncio.create_task(_process_job(jr["id"], batch_id))

    batch = await get_batch(db, batch_id)
    await _broadcast_job(batch_id)
    return {
        "ok": True,
        "batch_id": batch_id,
        "jobs": job_rows,
        "zonas": zonas,
        "perfil": perfil_clave,
        "message": batch["message"],
        "batch": batch,
    }


async def _process_job(job_id: str, batch_id: str) -> None:
    async with AsyncSessionLocal() as db:
        try:
            job = await get_job(db, job_id)
            meta = job.get("meta") or {}
            raw_path = Path(meta["raw_path"])
            out_path = Path(meta["out_path"])
            slide_id = meta.get("slide_id") or uuid.uuid4().hex[:10]
            perfil_clave = meta.get("perfil") or "restaurante_diario"
            zonas = job.get("zonas") or []
            index = int(meta.get("index") or 0)

            await _update_job(
                db, job_id, status="processing", progress=10, stage="analizando"
            )
            await _broadcast_job(batch_id)

            def on_prog(p: int, stage: str) -> None:
                # progress 10–85 for ffmpeg
                mapped = 10 + int(p * 0.75)
                # sync update from thread? we run ffmpeg sync in executor
                pass

            loop = asyncio.get_event_loop()
            await _update_job(
                db, job_id, status="processing", progress=20, stage="reescalando-1080p"
            )
            await _broadcast_job(batch_id)

            result = await loop.run_in_executor(
                None,
                lambda: transcode_to_1080p(raw_path, out_path),
            )

            video_url = f"/images/videos/{out_path.name}"
            poster_url = None
            if result.get("poster"):
                poster_path = Path(result["poster"])
                if poster_path.is_file():
                    poster_url = f"/images/videos/{poster_path.name}"

            # cleanup raw
            try:
                if raw_path.is_file() and raw_path.resolve() != out_path.resolve():
                    raw_path.unlink()
            except OSError:
                pass

            await _update_job(
                db,
                job_id,
                progress=88,
                stage="publicando-en-tvs",
                video_url=video_url,
                poster_url=poster_url,
                meta={**meta, "process": {
                    "transcoded": result.get("transcoded"),
                    "reason": result.get("reason"),
                    "meta_out": result.get("meta_out") or result.get("meta"),
                }},
            )
            await _broadcast_job(batch_id)

            try:
                perfil = await get_perfil(db, perfil_clave)
            except Exception:
                perfil = {"plantillas": {}}

            slide_ids = []
            for zona in zonas:
                if zona not in ZONAS_OK:
                    continue
                principal, secundario = pick_template_pair(
                    perfil.get("plantillas") or {}, zona, index
                )
                campana = await pub.get_campana(db, zona)
                slides = list(campana.get("slides") or [])
                # Evitar duplicar mismo video_url
                slides = [
                    s
                    for s in slides
                    if (s.get("video_url") or "") != video_url
                ]
                sid = f"{slide_id}-{zona.lower()[-1]}"
                slides.insert(
                    0,
                    {
                        "id": sid,
                        "media_tipo": "video",
                        "imagen_url": poster_url or "",
                        "video_url": video_url,
                        "texto_principal": principal,
                        "texto_secundario": secundario,
                        "animacion_texto": "fade-in-up",
                        "tamano_texto": "mediano",
                        "processing": False,
                    },
                )
                await pub.update_campana(db, zona, slides=slides)
                slide_ids.append({"zona": zona, "id": sid})

            await _update_job(
                db,
                job_id,
                status="ready",
                progress=100,
                stage="listo",
                slide_ids=slide_ids,
            )
            job2 = await get_job(db, job_id)
            await _broadcast_job(batch_id, job2)
            # TVs refrescan por t=pub del update_campana
            await ws_manager.publish(
                CHANNEL_PANTALLAS,
                {
                    "t": "vidready",
                    "batch_id": batch_id,
                    "video_url": video_url,
                    "zonas": zonas,
                },
            )
        except Exception as e:  # noqa: BLE001
            try:
                await _update_job(
                    db,
                    job_id,
                    status="error",
                    progress=100,
                    stage="error",
                    error_msg=str(e)[:500],
                )
                await _broadcast_job(batch_id)
            except Exception:
                pass


async def list_recent_batches(db: AsyncSession, limit: int = 8) -> list[dict]:
    result = await db.execute(
        text(
            """
            SELECT batch_id::text AS batch_id,
                   MAX(actualizado_en) AS last_u,
                   COUNT(*) AS n
            FROM video_jobs
            GROUP BY batch_id
            ORDER BY last_u DESC NULLS LAST
            LIMIT :lim
            """
        ),
        {"lim": limit},
    )
    out = []
    for r in result.mappings().all():
        try:
            out.append(await get_batch(db, r["batch_id"]))
        except HTTPException:
            continue
    return out
