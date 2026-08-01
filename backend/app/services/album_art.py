"""
Limpieza de metadatos de pistas + carátula (iTunes Search API, sin API key).
"""

from __future__ import annotations

import hashlib
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx

from app.config import get_settings

# Sufijos basura típicos de YouTube / rips
_NOISE = re.compile(
    r"""
    \s*[\(\[\{]?\s*(
        official(\s+music)?\s+video|
        official\s+hd\s+video|
        official\s+video|
        lyric\s+video|
        lyrics?|
        video\s+oficial|
        videoclip(\s+oficial)?|
        audio\s+oficial|
        hd|
        4k|
        remaster(ed|izado)?(\s+\d{4})?|
        live|
        en\s+vivo|
        visualizer|
        topic|
        audio|
        hq|
        ft\.?|feat\.?
    )\s*[\)\]\}]?\s*
    """,
    re.I | re.VERBOSE,
)

_MULTI_SPACE = re.compile(r"\s+")
_cache_meta: dict[str, dict[str, Any]] = {}
_CACHE_TTL = 86400 * 7  # 7 días en memoria


def clean_title_artist(title: str, artist: str = "") -> dict[str, str]:
    """Deja artista + título legibles (sin basura de filename YouTube)."""
    t = (title or "").strip()
    a = (artist or "").strip()

    # Si title trae "Artist - Song" y artist vacío/carpeta
    if " - " in t and (not a or a.startswith("(") or len(a) < 2):
        left, right = t.split(" - ", 1)
        a, t = left.strip(), right.strip()

    def scrub(s: str) -> str:
        s = _NOISE.sub(" ", s)
        s = re.sub(r"[\(\[\{][^\)\]\}]{0,40}[\)\]\}]", " ", s)
        s = s.replace("_", " ")
        s = _MULTI_SPACE.sub(" ", s).strip(" -_|")
        return s[:120]

    t = scrub(t)
    a = scrub(a)
    if not t:
        t = "Sin título"
    if not a:
        a = "Desconocido"
    return {"title": t, "artist": a}


def _covers_dir() -> Path:
    root = Path(get_settings().image_root)
    d = root / "covers"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _cache_key(artist: str, title: str) -> str:
    raw = f"{artist}|{title}".lower().encode("utf-8")
    return hashlib.sha1(raw).hexdigest()[:16]


async def fetch_cover_url(artist: str, title: str) -> str | None:
    """
    Busca carátula en iTunes y la cachea en /images/covers/{key}.jpg
    Devuelve URL pública /images/covers/...
    """
    cleaned = clean_title_artist(title, artist)
    artist, title = cleaned["artist"], cleaned["title"]
    key = _cache_key(artist, title)
    now = time.time()

    mem = _cache_meta.get(key)
    if mem and (now - float(mem.get("ts") or 0)) < _CACHE_TTL:
        return mem.get("url")

    dest = _covers_dir() / f"{key}.jpg"
    public = f"/images/covers/{key}.jpg"
    if dest.is_file() and dest.stat().st_size > 500:
        _cache_meta[key] = {"url": public, "ts": now}
        return public

    term = quote(f"{artist} {title}")
    api = f"https://itunes.apple.com/search?term={term}&media=music&entity=song&limit=5"
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(api)
            if r.status_code != 200:
                _cache_meta[key] = {"url": None, "ts": now}
                return None
            data = r.json()
            results = data.get("results") or []
            art = None
            for item in results:
                art = item.get("artworkUrl100") or item.get("artworkUrl60")
                if art:
                    # 100x100 -> 300x300
                    art = art.replace("100x100bb", "300x300bb").replace(
                        "60x60bb", "300x300bb"
                    )
                    break
            if not art:
                _cache_meta[key] = {"url": None, "ts": now}
                return None
            img = await client.get(art)
            if img.status_code != 200 or len(img.content) < 200:
                _cache_meta[key] = {"url": None, "ts": now}
                return None
            dest.write_bytes(img.content)
            _cache_meta[key] = {"url": public, "ts": now}
            return public
    except Exception:
        _cache_meta[key] = {"url": None, "ts": now}
        return None


async def enrich_track(cur: dict | None) -> dict | None:
    """Añade title/artist limpios + cover_url a current del ambient."""
    if not cur:
        return cur
    cleaned = clean_title_artist(cur.get("title") or "", cur.get("artist") or "")
    out = dict(cur)
    out["title_raw"] = cur.get("title")
    out["artist_raw"] = cur.get("artist")
    out["title"] = cleaned["title"]
    out["artist"] = cleaned["artist"]
    cover = await fetch_cover_url(cleaned["artist"], cleaned["title"])
    if cover:
        out["cover_url"] = cover
        out["album_art"] = cover
    return out
