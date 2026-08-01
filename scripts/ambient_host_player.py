#!/usr/bin/env python3
"""
Reproductor de música ambiente en el PC Windows (host).
- Lee MP3 desde C:\\EL_CALLEJON_POS\\Music (subcarpetas = playlists)
- Sale por el dispositivo de audio predeterminado de Windows
  (Bluetooth o jack 3.5 → amplificador)
- API HTTP en :8788 para el backend Docker y el panel estilo Winamp

Uso:
  python scripts/ambient_host_player.py
  python scripts/ambient_host_player.py --music "C:\\EL_CALLEJON_POS\\Music" --port 8788

No embebe el EXE de Winamp (imposible en web); el panel web imita Winamp clásico
y controla este servicio (o VLC si está instalado).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import random
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AUDIO_EXT = {".mp3", ".MP3", ".m4a", ".flac", ".wav", ".ogg", ".wma"}
_INVALID_FS = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def find_vlc() -> str | None:
    candidates = [
        os.environ.get("VLC_PATH"),
        r"C:\Program Files\VideoLAN\VLC\vlc.exe",
        r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
    ]
    for c in candidates:
        if c and Path(c).is_file():
            return c
    return None


def find_winamp() -> str | None:
    candidates = [
        os.environ.get("WINAMP_PATH"),
        r"C:\Program Files (x86)\Winamp\winamp.exe",
        r"C:\Program Files\Winamp\winamp.exe",
    ]
    for c in candidates:
        if c and Path(c).is_file():
            return c
    return None


_NOISE_RE = re.compile(
    r"\s*[\(\[\{]?\s*("
    r"official(\s+music)?\s+video|official\s+hd\s+video|official\s+video|"
    r"lyric\s+video|lyrics?|video\s+oficial|videoclip(\s+oficial)?|"
    r"audio\s+oficial|hd|4k|remaster(ed|izado)?(\s+\d{4})?|live|en\s+vivo|"
    r"visualizer|topic|audio|hq"
    r")\s*[\)\]\}]?\s*",
    re.I,
)


def _scrub_meta(s: str) -> str:
    s = _NOISE_RE.sub(" ", s or "")
    s = re.sub(r"[\(\[\{][^\)\]\}]{0,40}[\)\]\}]", " ", s)
    s = s.replace("_", " ")
    s = re.sub(r"\s+", " ", s).strip(" -_|")
    return s[:120]


def parse_tags_from_name(path: Path) -> dict:
    """Extrae artista/titulo limpios desde el nombre de archivo."""
    stem = path.stem
    artist, title = "", stem
    # "Artist - Title"
    if " - " in stem:
        artist, title = stem.split(" - ", 1)
    artist = _scrub_meta(artist) or path.parent.name[:80]
    title = _scrub_meta(title) or stem[:120]
    # Evitar que la carpeta quede como artista si es basura
    if artist.lower() in ("(raiz)", "raiz", "music", "musica"):
        artist = "Desconocido"
    return {
        "title": title[:120],
        "artist": artist[:80],
        "album": path.parent.name[:80],
    }


def _safe_filename(s: str, max_len: int = 80) -> str:
    s = _INVALID_FS.sub("", s or "")
    s = re.sub(r"\s+", " ", s).strip(" .")
    if not s:
        s = "track"
    return s[:max_len]


def _needs_name_cleanup(stem: str) -> bool:
    """True si el nombre de archivo aun tiene basura de YouTube/rips."""
    if _NOISE_RE.search(stem or ""):
        return True
    if re.search(r"[\(\[\{].*[\)\]\}]", stem or ""):
        return True
    if "_" in (stem or ""):
        return True
    return False


def _fetch_itunes_cover_bytes(artist: str, title: str) -> bytes | None:
    """Descarga caratula (JPEG) desde iTunes Search API. Sin API key."""
    term = urllib.parse.quote(f"{artist} {title}")
    url = (
        f"https://itunes.apple.com/search?term={term}"
        f"&media=music&entity=song&limit=5"
    )
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "ElCallejonAmbient/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode("utf-8", errors="replace"))
        art = None
        for item in data.get("results") or []:
            art = item.get("artworkUrl100") or item.get("artworkUrl60")
            if art:
                art = art.replace("100x100bb", "300x300bb").replace(
                    "60x60bb", "300x300bb"
                )
                break
        if not art:
            return None
        req2 = urllib.request.Request(art, headers={"User-Agent": "ElCallejonAmbient/1.0"})
        with urllib.request.urlopen(req2, timeout=12) as r2:
            blob = r2.read()
        if len(blob) < 200:
            return None
        return blob
    except Exception:
        return None


def _write_id3_tags(
    path: Path,
    *,
    artist: str,
    title: str,
    album: str,
    cover_jpeg: bytes | None,
) -> bool:
    """
    Escribe metadatos ID3v2 en el archivo (definitivo).
    Requiere mutagen; si no esta, retorna False.
    """
    try:
        from mutagen.id3 import (
            APIC,
            ID3,
            TALB,
            TIT2,
            TPE1,
            TXXX,
            ID3NoHeaderError,
        )
        from mutagen.mp3 import MP3
    except ImportError:
        return False

    # Solo MP3 tiene ID3 clasico; otros formatos se renombran igual
    if path.suffix.lower() not in (".mp3",):
        return False

    try:
        try:
            tags = ID3(path)
        except ID3NoHeaderError:
            tags = ID3()

        tags.delall("TIT2")
        tags.delall("TPE1")
        tags.delall("TALB")
        tags.add(TIT2(encoding=3, text=title))
        tags.add(TPE1(encoding=3, text=artist))
        tags.add(TALB(encoding=3, text=album or "El Callejon"))
        tags.delall("TXXX:callejon_normalized")
        tags.add(
            TXXX(
                encoding=3,
                desc="callejon_normalized",
                text="1",
            )
        )
        if cover_jpeg:
            tags.delall("APIC")
            tags.add(
                APIC(
                    encoding=3,
                    mime="image/jpeg",
                    type=3,  # cover (front)
                    desc="Cover",
                    data=cover_jpeg,
                )
            )
        tags.save(path, v2_version=3)
        return True
    except Exception as e:
        print("id3 write error:", path, e, file=sys.stderr)
        return False


def _file_already_normalized(path: Path) -> bool:
    """Si ya tiene marca ID3 o nombre limpio Artist - Title, no reprocesar."""
    stem = path.stem
    if _needs_name_cleanup(stem):
        return False
    if " - " not in stem:
        return False
    # Marca ID3
    try:
        from mutagen.id3 import ID3, ID3NoHeaderError

        try:
            tags = ID3(path)
        except ID3NoHeaderError:
            return False
        for frame in tags.getall("TXXX"):
            if getattr(frame, "desc", "") == "callejon_normalized":
                return True
        # Si tiene TIT2 + TPE1 y APIC, consideramos listo
        if tags.get("TIT2") and tags.get("TPE1") and tags.getall("APIC"):
            return True
    except ImportError:
        # Sin mutagen: si el nombre ya esta limpio, no renombrar otra vez
        return True
    except Exception:
        pass
    return False


class AmbientPlayer:
    def __init__(self, music_root: Path):
        self.music_root = music_root.resolve()
        self.vlc = find_vlc()
        self.winamp = find_winamp()
        self.lock = threading.RLock()
        self.tracks: list[dict] = []
        self.playlist: list[int] = []  # indices into tracks
        self.pos = 0
        self.playing = False
        self.paused = False
        # Modes: all_shuffle | all_order | folder_shuffle | folder_order
        self.play_mode = "all_shuffle"
        self.shuffle = True
        self.repeat = True
        self.volume = 70  # 0-100 (hint; OS device volume is primary)
        self.folder_filter: str | None = None  # playlist/carpeta
        self.active_playlist: str | None = None  # "likes" | nombre custom | None
        self.likes: set[str] = set()  # track rels
        self.user_playlists: dict[str, list[str]] = {}  # name -> [rel, ...]
        self.proc: subprocess.Popen | None = None
        self._stop_flag = threading.Event()
        self._worker: threading.Thread | None = None
        self.started_at = 0.0
        self.current: dict | None = None
        self.pause_on_event = True
        # Generación de reproducción: next/prev/play incrementan para que el
        # worker NO haga pos+=1 al morir el proceso (evita saltar 2 pistas y
        # que status/broadcast queden en la canción anterior a la que suena).
        self._play_gen = 0
        self._playlists_path = self.music_root / ".callejon_playlists.json"
        self._load_playlists()
        self.scan()

    def _load_playlists(self) -> None:
        try:
            if self._playlists_path.is_file():
                data = json.loads(self._playlists_path.read_text(encoding="utf-8"))
                self.likes = set(data.get("likes") or [])
                pls = data.get("playlists") or {}
                if isinstance(pls, dict):
                    self.user_playlists = {
                        str(k): [str(x) for x in (v or [])]
                        for k, v in pls.items()
                    }
        except Exception:
            self.likes = set()
            self.user_playlists = {}

    def _save_playlists(self) -> None:
        try:
            self._playlists_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "likes": sorted(self.likes),
                "playlists": self.user_playlists,
            }
            self._playlists_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as e:
            print("playlist save error:", e, file=sys.stderr)

    def scan(self) -> dict:
        tracks = []
        if not self.music_root.is_dir():
            self.tracks = []
            return {"ok": False, "error": f"No existe {self.music_root}", "count": 0}
        for p in sorted(self.music_root.rglob("*")):
            if not p.is_file() or p.suffix not in AUDIO_EXT:
                continue
            if p.name.endswith(".part"):
                continue
            # Preferir tags ID3 si existen
            meta = parse_tags_from_name(p)
            try:
                from mutagen.id3 import ID3, ID3NoHeaderError

                try:
                    tags = ID3(p)
                    if tags.get("TIT2"):
                        meta["title"] = str(tags.get("TIT2"))[:120]
                    if tags.get("TPE1"):
                        meta["artist"] = str(tags.get("TPE1"))[:80]
                    if tags.get("TALB"):
                        meta["album"] = str(tags.get("TALB"))[:80]
                except ID3NoHeaderError:
                    pass
            except ImportError:
                pass
            rel = p.relative_to(self.music_root)
            folder = rel.parts[0] if len(rel.parts) > 1 else "(raíz)"
            tracks.append(
                {
                    "id": len(tracks),
                    "path": str(p),
                    "rel": str(rel).replace("\\", "/"),
                    "folder": folder,
                    **meta,
                    "bytes": p.stat().st_size,
                }
            )
        self.tracks = tracks
        self._rebuild_playlist()
        folders = sorted({t["folder"] for t in tracks})
        return {
            "ok": True,
            "count": len(tracks),
            "folders": folders,
            # Motor real de reproducción (winamp solo se detecta; play usa VLC o WMP)
            "engine": "vlc" if self.vlc else "wmp",
            "winamp_installed": bool(self.winamp),
        }

    def _remap_playlist_rel(self, old_rel: str, new_rel: str) -> None:
        if old_rel in self.likes:
            self.likes.discard(old_rel)
            self.likes.add(new_rel)
        for name, rels in list(self.user_playlists.items()):
            self.user_playlists[name] = [
                new_rel if x == old_rel else x for x in rels
            ]

    def normalize_library(self, *, force: bool = False) -> dict:
        """
        Proceso UNA VEZ por archivo (salvo force=True):
        1) Limpia artista/titulo
        2) Renombra archivo a "Artista - Titulo.ext"
        3) Escribe metadatos ID3 + caratula (iTunes)
        Actualiza likes/playlists si cambia la ruta.
        """
        # No normalizar mientras suena (evitar file lock en Windows)
        was_playing = False
        with self.lock:
            was_playing = self.playing and not self.paused
            if was_playing:
                self.paused = True
                self._kill_proc()

        renamed = 0
        tagged = 0
        covers = 0
        skipped = 0
        errors: list[str] = []
        mutagen_ok = True
        try:
            import mutagen  # noqa: F401
        except ImportError:
            mutagen_ok = False
            errors.append(
                "mutagen no instalado: solo se renombran archivos. "
                "pip install mutagen  para ID3+caratula"
            )

        # Trabajar sobre lista de paths actuales (rescan interno al final)
        paths: list[Path] = []
        if self.music_root.is_dir():
            for p in sorted(self.music_root.rglob("*")):
                if p.is_file() and p.suffix in AUDIO_EXT and not p.name.endswith(".part"):
                    paths.append(p)

        for path in paths:
            try:
                if not force and _file_already_normalized(path):
                    skipped += 1
                    continue

                meta = parse_tags_from_name(path)
                # Preferir ID3 si ya hay y force
                try:
                    from mutagen.id3 import ID3, ID3NoHeaderError

                    try:
                        tags = ID3(path)
                        if tags.get("TIT2"):
                            meta["title"] = _scrub_meta(str(tags.get("TIT2"))) or meta["title"]
                        if tags.get("TPE1"):
                            meta["artist"] = _scrub_meta(str(tags.get("TPE1"))) or meta["artist"]
                    except ID3NoHeaderError:
                        pass
                except Exception:
                    pass

                artist = meta["artist"]
                title = meta["title"]
                album = meta.get("album") or path.parent.name

                old_rel = str(path.relative_to(self.music_root)).replace("\\", "/")
                new_stem = f"{_safe_filename(artist, 60)} - {_safe_filename(title, 80)}"
                new_path = path.with_name(new_stem + path.suffix.lower())

                # Colision: agregar sufijo corto
                if new_path.exists() and new_path.resolve() != path.resolve():
                    h = hashlib.md5(old_rel.encode()).hexdigest()[:4]
                    new_path = path.with_name(f"{new_stem} [{h}]{path.suffix.lower()}")

                if new_path.resolve() != path.resolve():
                    path.rename(new_path)
                    path = new_path
                    renamed += 1

                new_rel = str(path.relative_to(self.music_root)).replace("\\", "/")
                if old_rel != new_rel:
                    self._remap_playlist_rel(old_rel, new_rel)

                cover = _fetch_itunes_cover_bytes(artist, title)
                if cover:
                    covers += 1
                if mutagen_ok and path.suffix.lower() == ".mp3":
                    if _write_id3_tags(
                        path,
                        artist=artist,
                        title=title,
                        album=album,
                        cover_jpeg=cover,
                    ):
                        tagged += 1
                # Pausa corta para no saturar iTunes
                time.sleep(0.15)
            except Exception as e:
                errors.append(f"{path.name}: {e}")
                print("normalize error:", path, e, file=sys.stderr)

        self._save_playlists()
        # Rescan con nombres nuevos
        scan_info = self.scan()

        # Reanudar si estaba sonando
        if was_playing and self.playlist:
            with self.lock:
                self.paused = False
                self.playing = True
                self._play_gen += 1
                if self.pos >= len(self.playlist):
                    self.pos = 0
                self._apply_current_from_pos()
                self._kill_proc()
            self.ensure_worker()

        return {
            "ok": True,
            "renamed": renamed,
            "tagged": tagged,
            "covers_downloaded": covers,
            "skipped_already_ok": skipped,
            "errors": errors[:20],
            "error_count": len(errors),
            "mutagen": mutagen_ok,
            "library_count": scan_info.get("count"),
            "message": (
                f"Normalizacion: {renamed} renombrados, {tagged} con ID3, "
                f"{covers} caratulas, {skipped} ya listos"
            ),
        }

    def _apply_mode_flags(self) -> None:
        mode = self.play_mode or "all_shuffle"
        self.shuffle = mode in (
            "all_shuffle",
            "folder_shuffle",
            "playlist_shuffle",
            "likes_shuffle",
        )

    def _rel_to_index(self, rel: str) -> int | None:
        for i, t in enumerate(self.tracks):
            if t.get("rel") == rel:
                return i
        return None

    def _rebuild_playlist(self) -> None:
        self._apply_mode_flags()
        idxs = list(range(len(self.tracks)))
        mode = self.play_mode or "all_shuffle"

        if mode in ("likes_shuffle", "likes_order") or self.active_playlist == "likes":
            rels = list(self.likes)
            idxs = []
            for r in rels:
                i = self._rel_to_index(r)
                if i is not None:
                    idxs.append(i)
        elif mode in ("playlist_shuffle", "playlist_order") or (
            self.active_playlist and self.active_playlist != "likes"
        ):
            name = self.active_playlist or ""
            rels = list(self.user_playlists.get(name) or [])
            idxs = []
            for r in rels:
                i = self._rel_to_index(r)
                if i is not None:
                    idxs.append(i)
        elif mode in ("folder_shuffle", "folder_order") and self.folder_filter:
            idxs = [
                i
                for i in idxs
                if self.tracks[i]["folder"] == self.folder_filter
            ]
        # all_* -> todos los tracks

        if self.shuffle:
            random.shuffle(idxs)
        self.playlist = idxs
        self.pos = 0

    def status(self) -> dict:
        with self.lock:
            cur = self.current
            return {
                "ok": True,
                "playing": self.playing and not self.paused,
                "paused": self.paused,
                "shuffle": self.shuffle,
                "repeat": self.repeat,
                "play_mode": self.play_mode,
                "volume": self.volume,
                "folder": self.folder_filter,
                "position": self.pos,
                "playlist_len": len(self.playlist),
                "library_count": len(self.tracks),
                "engine": "vlc" if self.vlc else "wmp",
                "winamp_installed": bool(self.winamp),
                "music_root": str(self.music_root),
                "pause_on_event": self.pause_on_event,
                "current": cur,
                "elapsed_s": (
                    max(0, int(time.time() - self.started_at))
                    if self.playing and cur and not self.paused
                    else 0
                ),
                "folders": sorted({t["folder"] for t in self.tracks}),
                "liked": bool(
                    cur and cur.get("rel") and cur.get("rel") in self.likes
                ),
                "likes_count": len(self.likes),
                "active_playlist": self.active_playlist,
                "playlists": {
                    "likes": sorted(self.likes),
                    **{k: list(v) for k, v in self.user_playlists.items()},
                },
                "playlist_names": ["likes"] + sorted(self.user_playlists.keys()),
                "modes": [
                    "all_shuffle",
                    "all_order",
                    "folder_shuffle",
                    "folder_order",
                    "likes_shuffle",
                    "likes_order",
                    "playlist_shuffle",
                    "playlist_order",
                ],
            }

    def library(self, folder: str | None = None) -> dict:
        items = self.tracks
        if folder:
            items = [t for t in items if t["folder"] == folder]
        # cap payload
        slim = [
            {
                "id": t["id"],
                "title": t["title"],
                "artist": t["artist"],
                "folder": t["folder"],
                "rel": t["rel"],
            }
            for t in items[:500]
        ]
        return {
            "ok": True,
            "count": len(items),
            "items": slim,
            "folders": sorted({t["folder"] for t in self.tracks}),
        }

    def _kill_proc(self) -> None:
        if self.proc and self.proc.poll() is None:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=2)
            except Exception:
                try:
                    self.proc.kill()
                except Exception:
                    pass
        self.proc = None

    def _start_process(self, path: str) -> subprocess.Popen:
        if self.vlc:
            return subprocess.Popen(
                [
                    self.vlc,
                    "-I",
                    "dummy",
                    "--quiet",
                    "--play-and-exit",
                    "--no-video",
                    f"--gain={max(0.05, min(2.0, self.volume / 50.0)):.2f}",
                    path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
        # Windows Media Player via PowerShell (default audio device: BT or jack)
        if sys.platform == "win32":
            ps = f"""
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName presentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Volume = {max(0.0, min(1.0, self.volume / 100.0))}
$p.Open([uri]'{path.replace("'", "''")}')
Start-Sleep -Milliseconds 400
$p.Play()
while ($true) {{
  Start-Sleep -Milliseconds 400
  if ($p.NaturalDuration.HasTimeSpan) {{
    if ($p.Position -ge $p.NaturalDuration.TimeSpan) {{ break }}
  }}
  if ($p.Position.TotalSeconds -gt 0 -and $p.DownloadProgress -eq 1) {{
    # keep looping until near end
  }}
}}
$p.Close()
"""
            return subprocess.Popen(
                [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    ps,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        raise RuntimeError("No hay motor de audio (instale VLC)")

    def _worker_loop(self) -> None:
        while not self._stop_flag.is_set():
            with self.lock:
                if not self.playing or self.paused or not self.playlist:
                    path = None
                    gen = self._play_gen
                else:
                    if self.pos >= len(self.playlist):
                        if self.repeat:
                            self._rebuild_playlist()
                        else:
                            self.playing = False
                            self.current = None
                            continue
                    self._apply_current_from_pos()
                    path = (self.current or {}).get("path")
                    gen = self._play_gen
            if not self.playing or self.paused or not path:
                time.sleep(0.25)
                continue
            try:
                with self.lock:
                    # Si next/prev ya cambió de generación, no reiniciar la pista vieja
                    if self._play_gen != gen:
                        continue
                    self._kill_proc()
                    self.proc = self._start_process(path)
                    proc = self.proc
                    gen = self._play_gen
                while proc.poll() is None:
                    if self._stop_flag.is_set():
                        break
                    with self.lock:
                        if self._play_gen != gen:
                            self._kill_proc()
                            break
                        if not self.playing:
                            self._kill_proc()
                            break
                        if self.paused:
                            # MediaPlayer/VLC dummy: soft pause = wait
                            while (
                                self.paused
                                and self.playing
                                and self._play_gen == gen
                                and not self._stop_flag.is_set()
                            ):
                                time.sleep(0.2)
                            if not self.playing or self._play_gen != gen:
                                self._kill_proc()
                                break
                    time.sleep(0.2)
                with self.lock:
                    # Solo avanzar si esta generación terminó sola (no next/prev)
                    if (
                        self.playing
                        and not self.paused
                        and self._play_gen == gen
                    ):
                        self.pos += 1
                        # Actualizar current YA: no dejar la pista terminada en status
                        self._apply_current_from_pos()
            except Exception as e:
                print("play error:", e, file=sys.stderr)
                with self.lock:
                    if self._play_gen == gen:
                        self.pos += 1
                        self._apply_current_from_pos()
                time.sleep(0.5)

    def ensure_worker(self) -> None:
        if self._worker and self._worker.is_alive():
            return
        self._stop_flag.clear()
        self._worker = threading.Thread(target=self._worker_loop, daemon=True)
        self._worker.start()

    def _apply_current_from_pos(self) -> None:
        """Actualiza `current` al track de playlist[pos] (antes de reproducir)."""
        if not self.playlist:
            self.current = None
            return
        if self.pos >= len(self.playlist):
            if self.repeat:
                self._rebuild_playlist()
            else:
                self.current = None
                return
        if self.pos < 0:
            self.pos = 0
        ti = self.playlist[self.pos]
        track = self.tracks[ti]
        self.current = {
            "id": track["id"],
            "title": track["title"],
            "artist": track["artist"],
            "album": track["album"],
            "folder": track["folder"],
            "rel": track["rel"],
            "path": track["path"],
            "started_at": time.time(),
        }
        self.started_at = time.time()

    def play(self, folder: str | None = None, track_id: int | None = None) -> dict:
        with self.lock:
            if folder is not None:
                self.folder_filter = folder or None
                # Si eligen carpeta, pasar a modo carpeta manteniendo shuffle
                if folder:
                    if self.shuffle or (self.play_mode or "").endswith("shuffle"):
                        self.play_mode = "folder_shuffle"
                    else:
                        self.play_mode = "folder_order"
                else:
                    if self.shuffle:
                        self.play_mode = "all_shuffle"
                    else:
                        self.play_mode = "all_order"
                self._rebuild_playlist()
            if track_id is not None:
                # jump playlist to that track
                for i, idx in enumerate(self.playlist):
                    if self.tracks[idx]["id"] == track_id:
                        self.pos = i
                        break
                else:
                    # force into playlist
                    if 0 <= track_id < len(self.tracks):
                        self.playlist = [track_id] + [
                            i for i in self.playlist if i != track_id
                        ]
                        self.pos = 0
            self.playing = True
            self.paused = False
            self._play_gen += 1
            self._apply_current_from_pos()
            self._kill_proc()
        self.ensure_worker()
        return self.status()

    def pause(self) -> dict:
        with self.lock:
            self.paused = True
            self._play_gen += 1  # cancela avance automático al matar proceso
            self._kill_proc()
        return self.status()

    def resume(self) -> dict:
        with self.lock:
            self.paused = False
            self.playing = True
            self._play_gen += 1
            if not self.current:
                self._apply_current_from_pos()
        self.ensure_worker()
        return self.status()

    def stop(self) -> dict:
        with self.lock:
            self.playing = False
            self.paused = False
            self.current = None
            self._play_gen += 1
            self._kill_proc()
        return self.status()

    def next(self) -> dict:
        with self.lock:
            self.pos += 1
            self.paused = False
            self.playing = True
            self._play_gen += 1
            # current = pista NUEVA antes de devolver status (banner/API)
            self._apply_current_from_pos()
            self._kill_proc()
        self.ensure_worker()
        return self.status()

    def prev(self) -> dict:
        with self.lock:
            self.pos = max(0, self.pos - 1)
            self.paused = False
            self.playing = True
            self._play_gen += 1
            self._apply_current_from_pos()
            self._kill_proc()
        self.ensure_worker()
        return self.status()

    def set_shuffle(self, on: bool) -> dict:
        with self.lock:
            # Compat: toggle shuffle manteniendo scope (all vs folder)
            scope_folder = (self.play_mode or "").startswith("folder")
            if on:
                self.play_mode = "folder_shuffle" if scope_folder else "all_shuffle"
            else:
                self.play_mode = "folder_order" if scope_folder else "all_order"
            self.shuffle = bool(on)
            cur_id = self.current["id"] if self.current else None
            self._rebuild_playlist()
            if cur_id is not None:
                for i, idx in enumerate(self.playlist):
                    if self.tracks[idx]["id"] == cur_id:
                        self.pos = i
                        break
        return self.status()

    def set_play_mode(
        self, mode: str, folder: str | None = None
    ) -> dict:
        """
        all_shuffle | all_order | folder_shuffle | folder_order
        """
        allowed = {
            "all_shuffle",
            "all_order",
            "folder_shuffle",
            "folder_order",
            "shuffle_all",
            "repeat_all",
            "shuffle_folder",
            "repeat_folder",
        }
        m = (mode or "").strip().lower()
        aliases = {
            "shuffle_all": "all_shuffle",
            "repeat_all": "all_order",
            "shuffle_folder": "folder_shuffle",
            "repeat_folder": "folder_order",
        }
        m = aliases.get(m, m)
        if m not in allowed and m not in (
            "all_shuffle",
            "all_order",
            "folder_shuffle",
            "folder_order",
        ):
            m = "all_shuffle"
        with self.lock:
            self.play_mode = m
            if m.startswith("likes"):
                self.active_playlist = "likes"
                self.folder_filter = None
            elif m.startswith("playlist"):
                # active_playlist se fija con playlist/play
                self.folder_filter = None
            elif m in ("folder_shuffle", "folder_order"):
                self.active_playlist = None
                if folder is not None:
                    self.folder_filter = folder or None
                if not self.folder_filter and self.tracks:
                    self.folder_filter = self.tracks[0]["folder"]
            else:
                self.active_playlist = None
                self.folder_filter = None
            cur_id = self.current["id"] if self.current else None
            self._rebuild_playlist()
            if cur_id is not None:
                for i, idx in enumerate(self.playlist):
                    if self.tracks[idx]["id"] == cur_id:
                        self.pos = i
                        break
        return self.status()

    def set_volume(self, vol: int) -> dict:
        with self.lock:
            self.volume = max(0, min(100, int(vol)))
        return self.status()

    def set_pause_on_event(self, on: bool) -> dict:
        with self.lock:
            self.pause_on_event = bool(on)
        return self.status()

    def like_track(self, rel: str | None = None, liked: bool | None = None) -> dict:
        """Toggle me gusta (lista Me gusta)."""
        with self.lock:
            if not rel and self.current:
                rel = self.current.get("rel")
            if not rel:
                return {**self.status(), "ok": False, "error": "sin pista"}
            if liked is None:
                if rel in self.likes:
                    self.likes.discard(rel)
                    liked = False
                else:
                    self.likes.add(rel)
                    liked = True
            else:
                if liked:
                    self.likes.add(rel)
                else:
                    self.likes.discard(rel)
            self._save_playlists()
            st = self.status()
            st["liked"] = liked
            return st

    def create_playlist(self, name: str) -> dict:
        name = (name or "").strip()[:60]
        if not name or name.lower() == "likes":
            return {**self.status(), "ok": False, "error": "nombre invalido"}
        with self.lock:
            if name not in self.user_playlists:
                self.user_playlists[name] = []
                self._save_playlists()
        return self.status()

    def delete_playlist(self, name: str) -> dict:
        name = (name or "").strip()
        with self.lock:
            if name in self.user_playlists:
                del self.user_playlists[name]
                if self.active_playlist == name:
                    self.active_playlist = None
                    self.play_mode = "all_shuffle"
                    self._rebuild_playlist()
                self._save_playlists()
        return self.status()

    def add_to_playlist(
        self, name: str, rel: str | None = None
    ) -> dict:
        name = (name or "").strip()
        with self.lock:
            if not rel and self.current:
                rel = self.current.get("rel")
            if not rel:
                return {**self.status(), "ok": False, "error": "sin pista"}
            if name == "likes":
                self.likes.add(rel)
            else:
                if name not in self.user_playlists:
                    self.user_playlists[name] = []
                if rel not in self.user_playlists[name]:
                    self.user_playlists[name].append(rel)
            self._save_playlists()
        return self.status()

    def remove_from_playlist(self, name: str, rel: str) -> dict:
        name = (name or "").strip()
        with self.lock:
            if name == "likes":
                self.likes.discard(rel)
            elif name in self.user_playlists:
                self.user_playlists[name] = [
                    x for x in self.user_playlists[name] if x != rel
                ]
            self._save_playlists()
            if self.active_playlist == name or (
                name == "likes" and self.active_playlist == "likes"
            ):
                self._rebuild_playlist()
        return self.status()

    def play_user_playlist(
        self, name: str, *, shuffle: bool = True
    ) -> dict:
        """Reproduce lista Me gusta o una lista custom."""
        name = (name or "likes").strip()
        with self.lock:
            self.active_playlist = name
            self.folder_filter = None
            if name == "likes":
                self.play_mode = "likes_shuffle" if shuffle else "likes_order"
            else:
                self.play_mode = (
                    "playlist_shuffle" if shuffle else "playlist_order"
                )
            self.playing = True
            self.paused = False
            self._play_gen += 1
            self._rebuild_playlist()
            if not self.playlist:
                self.playing = False
                return {
                    **self.status(),
                    "ok": False,
                    "error": "lista vacia",
                }
            self.pos = 0
            self._apply_current_from_pos()
            self._kill_proc()
        self.ensure_worker()
        return self.status()

    def event_hook(self, modo_evento: bool) -> dict:
        """Llamado cuando el sistema de pantallas entra/sale de modo evento."""
        with self.lock:
            should = self.pause_on_event
        if modo_evento and should:
            return self.pause()
        if not modo_evento and should:
            # no auto-resume forzado — el operador decide; opcional resume
            return self.status()
        return self.status()


PLAYER: AmbientPlayer | None = None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quieter
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _json(self, code: int, data: dict) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._json(200, {"ok": True})

    def do_GET(self):
        assert PLAYER
        u = urllib.parse.urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        qs = urllib.parse.parse_qs(u.query)
        if path in ("/", "/status"):
            return self._json(200, PLAYER.status())
        if path == "/library":
            folder = (qs.get("folder") or [None])[0]
            return self._json(200, PLAYER.library(folder))
        if path == "/playlists":
            with PLAYER.lock:
                return self._json(
                    200,
                    {
                        "ok": True,
                        "likes": sorted(PLAYER.likes),
                        "playlists": {
                            k: list(v)
                            for k, v in PLAYER.user_playlists.items()
                        },
                        "names": ["likes"]
                        + sorted(PLAYER.user_playlists.keys()),
                    },
                )
        if path == "/health":
            return self._json(200, {"ok": True, "service": "ambient-host"})
        return self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        assert PLAYER
        u = urllib.parse.urlparse(self.path)
        path = u.path.rstrip("/") or "/"
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            body = {}

        if path == "/mode":
            return self._json(
                200,
                PLAYER.set_play_mode(
                    str(body.get("mode") or "all_shuffle"),
                    folder=body.get("folder"),
                ),
            )
        if path == "/play":
            return self._json(
                200,
                PLAYER.play(
                    folder=body.get("folder"),
                    track_id=body.get("track_id"),
                ),
            )
        if path == "/pause":
            return self._json(200, PLAYER.pause())
        if path == "/resume":
            return self._json(200, PLAYER.resume())
        if path == "/stop":
            return self._json(200, PLAYER.stop())
        if path == "/next":
            return self._json(200, PLAYER.next())
        if path == "/prev":
            return self._json(200, PLAYER.prev())
        if path == "/shuffle":
            return self._json(200, PLAYER.set_shuffle(bool(body.get("on", True))))
        if path == "/volume":
            return self._json(200, PLAYER.set_volume(int(body.get("volume", 70))))
        if path == "/scan":
            # Scan + normalizacion definitiva (rename + ID3 + caratula)
            info = PLAYER.scan()
            # Normalizar en el mismo hilo del request puede tardar; hacerlo aqui
            # porque el operador lo lanza a proposito (Scan)
            force = bool(body.get("force", False))
            norm = PLAYER.normalize_library(force=force)
            out = {**info, **norm, "ok": True}
            out["message"] = norm.get("message") or "Scan + normalizacion completados"
            return self._json(200, out)
        if path == "/normalize":
            force = bool(body.get("force", False))
            return self._json(200, PLAYER.normalize_library(force=force))
        if path == "/pause_on_event":
            return self._json(
                200, PLAYER.set_pause_on_event(bool(body.get("on", True)))
            )
        if path == "/event_hook":
            return self._json(
                200, PLAYER.event_hook(bool(body.get("modo_evento", False)))
            )
        if path == "/like":
            return self._json(
                200,
                PLAYER.like_track(
                    rel=body.get("rel"),
                    liked=body.get("liked"),
                ),
            )
        if path == "/playlist/create":
            return self._json(
                200, PLAYER.create_playlist(str(body.get("name") or ""))
            )
        if path == "/playlist/delete":
            return self._json(
                200, PLAYER.delete_playlist(str(body.get("name") or ""))
            )
        if path == "/playlist/add":
            return self._json(
                200,
                PLAYER.add_to_playlist(
                    str(body.get("name") or ""),
                    rel=body.get("rel"),
                ),
            )
        if path == "/playlist/remove":
            return self._json(
                200,
                PLAYER.remove_from_playlist(
                    str(body.get("name") or ""),
                    str(body.get("rel") or ""),
                ),
            )
        if path == "/playlist/play":
            return self._json(
                200,
                PLAYER.play_user_playlist(
                    str(body.get("name") or "likes"),
                    shuffle=bool(body.get("shuffle", True)),
                ),
            )
        return self._json(404, {"ok": False, "error": "not found"})


def main() -> int:
    global PLAYER
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--music",
        default=os.environ.get("MUSIC_ROOT", r"C:\EL_CALLEJON_POS\Music"),
    )
    ap.add_argument("--port", type=int, default=int(os.environ.get("AMBIENT_PORT", "8788")))
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument(
        "--autoplay",
        default=os.environ.get("AMBIENT_AUTOPLAY", ""),
        help="likes | all_shuffle | default (likes si hay, sino all_shuffle) | off",
    )
    args = ap.parse_args()
    root = Path(args.music)
    PLAYER = AmbientPlayer(root)
    info = PLAYER.scan()
    print("Ambient host player")
    print("  music :", root)
    print("  tracks:", info.get("count"))
    print("  folders:", ", ".join(info.get("folders") or []))
    print("  engine:", info.get("engine"))
    print("  likes :", len(PLAYER.likes))
    print("  listen: http://127.0.0.1:%s" % args.port)
    print("  jack/BT: use Windows default playback device")

    # Arranque autonomo de musica
    ap_mode = (args.autoplay or "").strip().lower()
    if ap_mode and ap_mode not in ("0", "off", "false", "no", "none"):
        try:
            if ap_mode in ("default", "auto", "1", "true", "yes"):
                if PLAYER.likes:
                    st = PLAYER.play_user_playlist("likes", shuffle=True)
                    print("  autoplay: Me gusta (shuffle)", st.get("playlist_len"))
                else:
                    st = PLAYER.set_play_mode("all_shuffle")
                    st = PLAYER.play(folder="")
                    print("  autoplay: shuffle todas las carpetas")
            elif ap_mode in ("likes", "me_gusta", "favorites"):
                st = PLAYER.play_user_playlist("likes", shuffle=True)
                if not st.get("ok") and st.get("error") == "lista vacia":
                    PLAYER.set_play_mode("all_shuffle")
                    PLAYER.play(folder="")
                    print("  autoplay: likes vacia -> shuffle todas")
                else:
                    print("  autoplay: Me gusta")
            elif ap_mode in ("all_shuffle", "shuffle", "all"):
                PLAYER.set_play_mode("all_shuffle")
                PLAYER.play(folder="")
                print("  autoplay: shuffle todas")
            else:
                print("  autoplay: modo desconocido", ap_mode)
        except Exception as e:
            print("  autoplay error:", e, file=sys.stderr)

    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("bye")
        PLAYER.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
