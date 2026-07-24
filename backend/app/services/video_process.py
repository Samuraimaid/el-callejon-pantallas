"""Post-proceso de videos: reescala a 1080p H.264 para TVs y LAN."""

from __future__ import annotations

import json
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any, Callable

from app.config import get_settings

MAX_W = 1920
MAX_H = 1080
# ~3 min @ 8 Mbps rough upper; hard cap bytes
MAX_UPLOAD_BYTES = 280 * 1024 * 1024


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def probe_video(path: Path) -> dict[str, Any]:
    if not shutil.which("ffprobe"):
        return {"width": 0, "height": 0, "duration": 0, "codec": "", "ok": False}
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,codec_name,duration",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        str(path),
    ]
    try:
        raw = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=60)
        data = json.loads(raw.decode("utf-8", errors="replace"))
        streams = data.get("streams") or []
        st = streams[0] if streams else {}
        fmt = data.get("format") or {}
        w = int(st.get("width") or 0)
        h = int(st.get("height") or 0)
        dur = float(st.get("duration") or fmt.get("duration") or 0)
        return {
            "width": w,
            "height": h,
            "duration": dur,
            "codec": str(st.get("codec_name") or ""),
            "ok": w > 0 and h > 0,
        }
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError, ValueError):
        return {"width": 0, "height": 0, "duration": 0, "codec": "", "ok": False}


def needs_transcode(meta: dict[str, Any], src: Path) -> bool:
    if not meta.get("ok"):
        return True
    w, h = int(meta.get("width") or 0), int(meta.get("height") or 0)
    if w > MAX_W or h > MAX_H:
        return True
    codec = (meta.get("codec") or "").lower()
    if codec not in ("h264", "avc1"):
        return True
    # WebM / odd containers → always remux/transcode to mp4
    if src.suffix.lower() not in (".mp4", ".m4v"):
        return True
    return False


def transcode_to_1080p(
    src: Path,
    dest: Path,
    *,
    on_progress: Callable[[int, str], None] | None = None,
) -> dict[str, Any]:
    """
    Escala a max 1920x1080, H.264 yuv420p + AAC.
    Si no hay ffmpeg, copia el archivo y reporta warning.
    Respeta sensor de carga: si CPU alta, solo copia sin reescalar.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    meta = probe_video(src)

    try:
        from app.services.resources import should_allow_ffmpeg

        allow_ff = should_allow_ffmpeg()
    except Exception:
        allow_ff = True

    if not allow_ff:
        if on_progress:
            on_progress(60, "cpu-alta-copia-sin-reescalar")
        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)
        if on_progress:
            on_progress(100, "copiado-sin-ffmpeg")
        return {
            "transcoded": False,
            "reason": "recursos_ocupados_skip_ffmpeg",
            "meta": meta,
            "path": str(dest),
        }

    if not ffmpeg_available():
        if on_progress:
            on_progress(50, "sin-ffmpeg-copiando")
        if src.resolve() != dest.resolve():
            shutil.copy2(src, dest)
        if on_progress:
            on_progress(100, "copiado")
        return {
            "transcoded": False,
            "reason": "ffmpeg_no_disponible",
            "meta": meta,
            "path": str(dest),
        }

    if not needs_transcode(meta, src):
        if on_progress:
            on_progress(40, "ya-1080p")
        # remux ligero a mp4 si hace falta
        if src.suffix.lower() == ".mp4" and src.resolve() != dest.resolve():
            shutil.copy2(src, dest)
        elif src.resolve() != dest.resolve():
            cmd = [
                "ffmpeg",
                "-y",
                "-i",
                str(src),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(dest),
            ]
            subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        if on_progress:
            on_progress(100, "listo")
        return {"transcoded": False, "reason": "ya_compatible", "meta": meta, "path": str(dest)}

    if on_progress:
        on_progress(15, "transcodificando-1080p")

    # scale down only, keep aspect, pad not required (object-cover on TV)
    vf = (
        f"scale='min({MAX_W},iw)':'min({MAX_H},ih)':"
        "force_original_aspect_ratio=decrease"
    )
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(src),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-max_muxing_queue_size",
        "1024",
        str(dest),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=1800)

    if on_progress:
        on_progress(90, "generando-poster")

    poster = dest.with_suffix(".jpg")
    try:
        subprocess.check_call(
            [
                "ffmpeg",
                "-y",
                "-ss",
                "0.5",
                "-i",
                str(dest),
                "-frames:v",
                "1",
                "-q:v",
                "4",
                str(poster),
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=60,
        )
    except subprocess.SubprocessError:
        poster = None

    out_meta = probe_video(dest)
    if on_progress:
        on_progress(100, "listo")
    return {
        "transcoded": True,
        "reason": "reescala_1080p",
        "meta_in": meta,
        "meta_out": out_meta,
        "path": str(dest),
        "poster": str(poster) if poster and poster.is_file() else None,
    }


def videos_dir() -> Path:
    root = Path(get_settings().image_root)
    d = root / "videos"
    d.mkdir(parents=True, exist_ok=True)
    return d


def new_video_paths(zona_tag: str = "batch") -> tuple[str, Path, Path]:
    slide_id = uuid.uuid4().hex[:10]
    fname = f"pub-{zona_tag.lower()}-{slide_id}.mp4"
    raw_name = f"raw-{zona_tag.lower()}-{slide_id}.bin"
    vdir = videos_dir()
    return slide_id, vdir / raw_name, vdir / fname
