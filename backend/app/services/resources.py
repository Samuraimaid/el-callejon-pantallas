"""Sensor de recursos del servidor y política anti-cuello de botella."""

from __future__ import annotations

import os
import time
from typing import Any

try:
    import psutil
except ImportError:  # pragma: no cover
    psutil = None  # type: ignore

# Umbrales %
CPU_OK = 50.0
CPU_BUSY = 75.0
RAM_OK = 70.0
RAM_BUSY = 85.0

_last_sample: dict[str, Any] = {
    "ts": 0.0,
    "cpu_percent": 0.0,
    "ram_percent": 0.0,
    "ram_available_mb": 0,
    "disk_percent": 0.0,
    "level": "ok",  # ok | warm | hot
    "policy": {},
}


def _sample_now() -> dict[str, Any]:
    cpu = 0.0
    ram_pct = 0.0
    ram_avail = 0
    disk_pct = 0.0
    if psutil:
        # interval=None usa delta desde última llamada; primera puede ser 0
        cpu = float(psutil.cpu_percent(interval=0.15))
        vm = psutil.virtual_memory()
        ram_pct = float(vm.percent)
        ram_avail = int(vm.available / (1024 * 1024))
        try:
            disk_pct = float(psutil.disk_usage("/").percent)
        except Exception:
            disk_pct = 0.0
    else:
        # fallback /proc (Linux)
        try:
            load1 = os.getloadavg()[0]
            ncpu = os.cpu_count() or 1
            cpu = min(100.0, (load1 / ncpu) * 100.0)
        except OSError:
            cpu = 0.0
        try:
            with open("/proc/meminfo", encoding="utf-8") as f:
                info = {}
                for line in f:
                    parts = line.split(":")
                    if len(parts) == 2:
                        info[parts[0]] = int(parts[1].strip().split()[0])
                total = info.get("MemTotal", 1)
                avail = info.get("MemAvailable", info.get("MemFree", 0))
                ram_pct = 100.0 * (1.0 - avail / total)
                ram_avail = avail // 1024
        except OSError:
            pass

    if cpu >= CPU_BUSY or ram_pct >= RAM_BUSY:
        level = "hot"
    elif cpu >= CPU_OK or ram_pct >= RAM_OK:
        level = "warm"
    else:
        level = "ok"

    return {
        "ts": time.time(),
        "cpu_percent": round(cpu, 1),
        "ram_percent": round(ram_pct, 1),
        "ram_available_mb": ram_avail,
        "disk_percent": round(disk_pct, 1),
        "level": level,
        "psutil": bool(psutil),
    }


def get_resources(force: bool = False) -> dict[str, Any]:
    global _last_sample
    now = time.time()
    if force or now - float(_last_sample.get("ts") or 0) > 1.5:
        sample = _sample_now()
        sample["policy"] = build_policy(sample)
        _last_sample = sample
    return dict(_last_sample)


def build_policy(sample: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Decide límites globales según carga.
    - ok: entrega normal, 1 TV a la vez, ffmpeg permitido
    - warm: solo 1 transferencia, sin ffmpeg nuevo, videos más espaciados
    - hot: pausar videos y ffmpeg; solo menús prioritarios
    """
    s = sample or get_resources()
    level = s.get("level") or "ok"

    # Presupuestos de caché por TV (MB) — el servidor manda el techo a cada TV
    if level == "hot":
        budget = {
            1: 40,
            2: 40,
            3: 25,
            4: 25,
            5: 25,
            6: 25,
        }
        return {
            "level": level,
            "allow_transfer": True,  # menús sí, cola prioritaria
            "allow_video_play": False,
            "allow_ffmpeg": False,
            "max_concurrent_transfers": 1,
            "transfer_chunk_pause_ms": 120,
            "video_min_gap_s": 9999,
            "priority_only_menus": True,
            "cache_budget_mb": budget,
            "message": "Carga alta: priorizando menús TV1–2; videos en pausa",
        }
    if level == "warm":
        budget = {
            1: 70,
            2: 70,
            3: 50,
            4: 50,
            5: 50,
            6: 50,
        }
        return {
            "level": level,
            "allow_transfer": True,
            "allow_video_play": True,
            "allow_ffmpeg": False,
            "max_concurrent_transfers": 1,
            "transfer_chunk_pause_ms": 40,
            "video_min_gap_s": 90,
            "priority_only_menus": False,
            "cache_budget_mb": budget,
            "message": "Carga media: 1 transferencia a la vez; sin reescalar video",
        }

    budget = {
        1: 100,
        2: 100,
        3: 180,
        4: 180,
        5: 180,
        6: 180,
    }
    return {
        "level": "ok",
        "allow_transfer": True,
        "allow_video_play": True,
        "allow_ffmpeg": True,
        "max_concurrent_transfers": 1,
        "transfer_chunk_pause_ms": 0,
        "video_min_gap_s": 45,
        "priority_only_menus": False,
        "cache_budget_mb": budget,
        "message": "Carga normal: entrega serial TV1–2 prioritarias",
    }


def should_allow_ffmpeg() -> bool:
    return bool(get_resources()["policy"].get("allow_ffmpeg"))


def should_allow_video_play() -> bool:
    return bool(get_resources()["policy"].get("allow_video_play"))
