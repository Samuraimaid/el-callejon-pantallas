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
import json
import os
import random
import subprocess
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

AUDIO_EXT = {".mp3", ".MP3", ".m4a", ".flac", ".wav", ".ogg", ".wma"}


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


def parse_tags_from_name(path: Path) -> dict:
    stem = path.stem
    # "Artist - Title"
    if " - " in stem:
        artist, title = stem.split(" - ", 1)
        return {
            "title": title.strip()[:120],
            "artist": artist.strip()[:80],
            "album": path.parent.name[:80],
        }
    return {
        "title": stem[:120],
        "artist": path.parent.name[:80],
        "album": path.parent.name[:80],
    }


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
        self.shuffle = True
        self.repeat = True
        self.volume = 70  # 0-100 (hint; OS device volume is primary)
        self.folder_filter: str | None = None  # playlist/carpeta
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
        self.scan()

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
            rel = p.relative_to(self.music_root)
            folder = rel.parts[0] if len(rel.parts) > 1 else "(raíz)"
            meta = parse_tags_from_name(p)
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

    def _rebuild_playlist(self) -> None:
        idxs = list(range(len(self.tracks)))
        if self.folder_filter:
            idxs = [
                i
                for i in idxs
                if self.tracks[i]["folder"] == self.folder_filter
            ]
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
            self.shuffle = bool(on)
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
            return self._json(200, PLAYER.scan())
        if path == "/pause_on_event":
            return self._json(
                200, PLAYER.set_pause_on_event(bool(body.get("on", True)))
            )
        if path == "/event_hook":
            return self._json(
                200, PLAYER.event_hook(bool(body.get("modo_evento", False)))
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
    args = ap.parse_args()
    root = Path(args.music)
    PLAYER = AmbientPlayer(root)
    info = PLAYER.scan()
    print("Ambient host player")
    print("  music :", root)
    print("  tracks:", info.get("count"))
    print("  folders:", ", ".join(info.get("folders") or []))
    print("  engine:", info.get("engine"))
    print("  listen: http://127.0.0.1:%s" % args.port)
    print("  jack/BT: use Windows default playback device")
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("bye")
        PLAYER.stop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
