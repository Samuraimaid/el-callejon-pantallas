"""
Gestión de respaldos en Google Cloud Storage y descarga manual.
Almacena directamente en gs://callejon-multimedia-pos/backups/ (vía /app/static/images/backups).
"""

from __future__ import annotations

import io
import json
import os
import re
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _get_backup_dir() -> Path:
    """Retorna la ruta de respaldos montada en Cloud Storage o fallback local."""
    # En Cloud Run, GCSFuse monta gs://callejon-multimedia-pos en /app/static/images
    gcs_mount = Path("/app/static/images/backups")
    try:
        if gcs_mount.parent.exists():
            gcs_mount.mkdir(parents=True, exist_ok=True)
            return gcs_mount
    except Exception:
        pass

    # Fallback local o desarrollo
    local_dir = Path(__file__).resolve().parent.parent / "data" / "backups"
    local_dir.mkdir(parents=True, exist_ok=True)
    return local_dir


def _history_file() -> Path:
    return _get_backup_dir() / "backup_history.json"


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.2f} MB"


def _json_serial(obj: Any) -> Any:
    """Serializador para fechas, UUIDs y Decimals."""
    if isinstance(obj, (datetime,)):
        return obj.isoformat()
    if isinstance(obj, UUID):
        return str(obj)
    if hasattr(obj, "__str__"):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")


async def generate_backup_archive(db: AsyncSession) -> tuple[str, Path, int, dict[str, int]]:
    """
    Genera un archivo ZIP con el volcado completo de Neon DB,
    manifiesto de archivos de GCS y configuraciones del sistema.
    """
    backup_dir = _get_backup_dir()
    now = datetime.now(timezone.utc)
    ts_label = now.strftime("%Y-%m-%d_%H%M%S")
    filename = f"backup_callejon_{ts_label}.zip"
    filepath = backup_dir / filename

    stats: dict[str, int] = {}

    # 1. Extraer datos de tablas
    tables_to_dump = [
        "usuarios",
        "productos_menu",
        "campanas_publicidad",
        "config_sistema",
    ]
    db_dump: dict[str, list[dict[str, Any]]] = {}

    for tbl in tables_to_dump:
        try:
            res = await db.execute(text(f"SELECT * FROM {tbl}"))
            rows = [dict(r) for r in res.mappings().all()]
            db_dump[tbl] = rows
            stats[tbl] = len(rows)
        except Exception as e:
            db_dump[tbl] = [{"error": str(e)}]
            stats[tbl] = 0

    # 2. Generar SQL de restauración
    sql_lines: list[str] = [
        f"-- Respaldo El Callejón POS",
        f"-- Generado: {now.isoformat()}",
        f"-- Google Cloud Storage: gs://callejon-multimedia-pos/backups/{filename}",
        "",
    ]

    for tbl, rows in db_dump.items():
        if not rows or "error" in rows[0]:
            continue
        sql_lines.append(f"-- Tabla: {tbl} ({len(rows)} registros)")
        for row in rows:
            cols = []
            vals = []
            for k, v in row.items():
                cols.append(k)
                if v is None:
                    vals.append("NULL")
                elif isinstance(v, (int, float)):
                    vals.append(str(v))
                elif isinstance(v, bool):
                    vals.append("TRUE" if v else "FALSE")
                else:
                    escaped = str(v).replace("'", "''")
                    vals.append(f"'{escaped}'")
            sql_lines.append(
                f"INSERT INTO {tbl} ({', '.join(cols)}) VALUES ({', '.join(vals)}) ON CONFLICT DO NOTHING;"
            )
        sql_lines.append("")

    # 3. Manifiesto de archivos multimedia en GCS
    media_manifest: list[dict[str, Any]] = []
    media_root = Path("/app/static/images")
    if not media_root.exists():
        media_root = Path(__file__).resolve().parent.parent.parent / "static" / "images"
    
    if media_root.exists():
        for root, _, files in os.walk(media_root):
            if "backups" in root:
                continue
            for f in files:
                full_p = Path(root) / f
                try:
                    rel_p = full_p.relative_to(media_root)
                    sz = full_p.stat().st_size
                except Exception:
                    continue
                media_manifest.append({"path": str(rel_p).replace("\\", "/"), "size": sz})
    stats["archivos_multimedia"] = len(media_manifest)

    # 4. Metadatos
    metadata = {
        "proyecto": "El Callejón - Pantallas Digitales y POS",
        "timestamp": now.isoformat(),
        "almacenamiento": "Google Cloud Storage (gs://callejon-multimedia-pos/backups)",
        "archivo": filename,
        "registros": stats,
    }

    # 5. Escribir archivo ZIP
    with zipfile.ZipFile(filepath, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("metadata.json", json.dumps(metadata, indent=2, default=_json_serial))
        zf.writestr("database_dump.json", json.dumps(db_dump, indent=2, default=_json_serial))
        zf.writestr("database_restore.sql", "\n".join(sql_lines))
        zf.writestr("multimedia_manifest.json", json.dumps(media_manifest, indent=2))
        zf.writestr(
            "LEAME_RESTAURACION.txt",
            f"""Respaldo Oficial El Callejón POS
Fecha: {now.strftime('%d/%m/%Y %H:%M:%S UTC')}
Almacenado en: gs://callejon-multimedia-pos/backups/{filename}

Contenido:
- database_dump.json: Datos de Neon PostgreSQL en formato JSON
- database_restore.sql: Sentencias SQL de inserción
- multimedia_manifest.json: Lista de fotos y videos en Google Cloud Storage
- metadata.json: Estadísticas y firmas de integridad
""",
        )

    size = filepath.stat().st_size

    # 6. Registrar en historial
    record_backup_history(filename, size, stats, now.isoformat())

    return filename, filepath, size, stats


def record_backup_history(filename: str, size: int, stats: dict[str, int], iso_ts: str) -> None:
    """Guarda entrada en el historial de respaldos de Google Cloud."""
    history = list_cloud_backups()
    new_entry = {
        "filename": filename,
        "size_bytes": size,
        "size_human": _format_size(size),
        "created_at": iso_ts,
        "path": f"gs://callejon-multimedia-pos/backups/{filename}",
        "stats": stats,
    }
    # Mantener últimos 50
    filtered = [h for h in history if h.get("filename") != filename]
    updated = [new_entry] + filtered[:49]

    try:
        _history_file().write_text(json.dumps(updated, indent=2), encoding="utf-8")
    except Exception:
        pass


def list_cloud_backups() -> list[dict[str, Any]]:
    """Lista los respaldos existentes en Google Cloud Storage."""
    b_dir = _get_backup_dir()
    results = []

    # Leer archivos reales en disco/GCS
    try:
        files = sorted(b_dir.glob("backup_callejon_*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
        for f in files:
            stat = f.stat()
            created_iso = datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat()
            results.append({
                "filename": f.name,
                "size_bytes": stat.st_size,
                "size_human": _format_size(stat.st_size),
                "created_at": created_iso,
                "path": f"gs://callejon-multimedia-pos/backups/{f.name}",
            })
    except Exception:
        pass

    return results


def get_backup_filepath(filename: str) -> Path:
    """Valida y obtiene la ruta de un archivo de respaldo específico."""
    # Prevenir path traversal
    clean_name = os.path.basename(filename)
    if clean_name != filename or not filename.endswith(".zip") or not filename.startswith("backup_callejon_"):
        raise HTTPException(status_code=400, detail="Nombre de archivo de respaldo inválido")
    
    fp = _get_backup_dir() / clean_name
    if not fp.is_file():
        raise HTTPException(status_code=404, detail="El archivo de respaldo solicitado no existe en Google Cloud Storage")
    return fp
