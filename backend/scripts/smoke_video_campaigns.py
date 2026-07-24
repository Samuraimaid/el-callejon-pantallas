#!/usr/bin/env python3
"""
Diagnóstico de campañas en VIDEO (cartelería El Callejón).

Comprueba:
  1) API de campañas por zona (TV3–TV6)
  2) Integridad de slides de video (media_tipo + video_url)
  3) Archivos en disco (IMAGE_ROOT/videos)
  4) HTTP: frontend (:5173) y backend (:8000) sirven el MP4
  5) Range requests (necesario para <video>)
  6) PUT no borra video_url (regresión del schema SlideIn)
  7) Upload de un video de prueba (opcional, --upload)
  8) Reparación de slides huérfanos en disco (--repair)

Uso:
  python backend/scripts/smoke_video_campaigns.py
  python backend/scripts/smoke_video_campaigns.py --base http://localhost:8000 --fe http://localhost:5173
  python backend/scripts/smoke_video_campaigns.py --repair
  python backend/scripts/smoke_video_campaigns.py --upload
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ZONAS = ("TV3", "TV4", "TV5", "TV6")
DEFAULT_API = os.environ.get("SMOKE_API", "http://localhost:8000")
DEFAULT_FE = os.environ.get("SMOKE_FE", "http://localhost:5173")
# Ruta host (compose monta frontend/public/images → /app/static/images)
def _default_disk() -> Path:
    env = os.environ.get("IMAGE_ROOT") or os.environ.get("SMOKE_DISK")
    if env:
        return Path(env)
    here = Path(__file__).resolve()
    # .../backend/scripts/this.py → repo/frontend/public/images
    try:
        candidate = here.parents[2] / "frontend" / "public" / "images"
        if candidate.is_dir():
            return candidate
    except IndexError:
        pass
    for p in (Path("/app/static/images"), Path("frontend/public/images")):
        if p.is_dir():
            return p
    return Path("/app/static/images")


DEFAULT_DISK = _default_disk()


class Report:
    def __init__(self) -> None:
        self.ok = 0
        self.fail = 0
        self.warn = 0
        self.lines: list[str] = []

    def pass_(self, msg: str) -> None:
        self.ok += 1
        self.lines.append(f"  OK   {msg}")
        print(f"  OK   {msg}")

    def fail_(self, msg: str) -> None:
        self.fail += 1
        self.lines.append(f"  FAIL {msg}")
        print(f"  FAIL {msg}")

    def warn_(self, msg: str) -> None:
        self.warn += 1
        self.lines.append(f"  WARN {msg}")
        print(f"  WARN {msg}")


def http(
    method: str,
    url: str,
    data: bytes | None = None,
    headers: dict | None = None,
    timeout: float = 20,
) -> tuple[int, bytes, dict]:
    h = dict(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return res.status, res.read(), dict(res.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(str(e)) from e


def http_json(
    method: str,
    url: str,
    payload: dict | None = None,
    token: str | None = None,
    timeout: float = 20,
) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    code, raw, _ = http(method, url, data=body, headers=headers, timeout=timeout)
    try:
        return code, json.loads(raw.decode("utf-8", errors="replace") or "{}")
    except json.JSONDecodeError:
        return code, {"_raw": raw[:200].decode("utf-8", errors="replace")}


def login(api: str) -> str | None:
    for user, pw in (("admin", "1234"), ("pantallas", "1234"), ("caja", "1234")):
        code, data = http_json(
            "POST", f"{api}/api/auth/login", {"usuario": user, "password": pw}
        )
        if code in (200, 201) and data.get("access_token"):
            return data["access_token"]
    return None


def section(title: str) -> None:
    print(f"\n== {title} ==")


def check_campanas(api: str, fe: str, disk: Path, r: Report) -> list[dict]:
    section("1) API campañas + integridad video")
    all_video_slides: list[dict] = []
    for zona in ZONAS:
        try:
            code, data = http_json("GET", f"{api}/api/publicidad/{zona}")
        except RuntimeError as e:
            r.fail_(f"{zona}: API no responde ({e})")
            continue
        if code != 200:
            r.fail_(f"{zona}: HTTP {code}")
            continue
        slides = data.get("slides") or []
        r.pass_(f"{zona}: {len(slides)} slides, activo={data.get('activo')}")

        for s in slides:
            sid = s.get("id")
            mt = (s.get("media_tipo") or "").lower()
            vu = (s.get("video_url") or "").strip()
            iu = (s.get("imagen_url") or "").strip()
            if mt == "video" or vu:
                all_video_slides.append({"zona": zona, **s})
                if not vu:
                    r.fail_(
                        f"{zona} slide {sid}: media_tipo=video pero video_url vacío"
                    )
                elif mt != "video":
                    r.warn_(
                        f"{zona} slide {sid}: tiene video_url pero media_tipo={mt!r}"
                    )
                else:
                    r.pass_(f"{zona} slide {sid}: video OK → {vu}")
            # Huérfanos lógicos: texto "Video" sin media
            if (s.get("texto_principal") or "").strip().lower() == "video" and not vu and not iu:
                r.fail_(
                    f"{zona} slide {sid}: texto 'Video' sin imagen_url ni video_url "
                    "(posible PUT que borró el video)"
                )

    if not all_video_slides:
        r.warn_("Ningún slide de video en TV3–TV6 (puede ser esperado si no subiste)")
    return all_video_slides


def check_disk_and_http(
    fe: str, api: str, disk: Path, video_slides: list[dict], r: Report
) -> list[Path]:
    section("2) Archivos en disco + HTTP Range")
    vdir = disk / "videos"
    if not vdir.is_dir():
        r.fail_(f"No existe carpeta videos: {vdir}")
        files: list[Path] = []
    else:
        files = sorted(vdir.glob("*.mp4")) + sorted(vdir.glob("*.webm"))
        r.pass_(f"En disco: {len(files)} video(s) en {vdir}")
        for f in files:
            r.pass_(f"  {f.name} ({f.stat().st_size // 1024} KB)")

    # Cada slide de video debe ser descargable
    urls_checked: set[str] = set()
    for s in video_slides:
        vu = (s.get("video_url") or "").strip()
        if not vu or vu in urls_checked:
            continue
        urls_checked.add(vu)
        # Ruta relativa
        rel = vu if vu.startswith("/") else f"/{vu}"
        for label, base in (("FE", fe), ("API", api)):
            url = f"{base.rstrip('/')}{rel}"
            try:
                # HEAD a veces no está en StaticFiles; usamos Range GET
                req = urllib.request.Request(url, method="GET")
                req.add_header("Range", "bytes=0-1023")
                with urllib.request.urlopen(req, timeout=25) as res:
                    code = res.status
                    ct = res.headers.get("Content-Type", "")
                    cl = res.headers.get("Content-Length", "?")
                    body = res.read(16)
                if code in (200, 206) and body:
                    r.pass_(
                        f"{label} {rel}: HTTP {code} type={ct} first_chunk={len(body)}B len={cl}"
                    )
                else:
                    r.fail_(f"{label} {rel}: HTTP {code} vacío o inválido")
            except Exception as e:  # noqa: BLE001
                err = str(e)
                # Desde el contenedor backend, :5173 del host o Host=frontend
                # a veces no es alcanzable; la TV usa el host LAN. Si API sirve
                # el MP4 (StaticFiles), el caso crítico ya está cubierto.
                if label == "FE" and (
                    "403" in err
                    or "Forbidden" in err
                    or "Connection refused" in err
                    or "111" in err
                    or "timed out" in err.lower()
                ):
                    r.warn_(
                        f"{label} {rel}: {e} "
                        "(esperado si el smoke corre dentro de Docker; "
                        "verificar en el PC con localhost:5173)"
                    )
                else:
                    r.fail_(f"{label} {rel}: {e}")

        # ¿Existe en disco?
        name = Path(rel).name
        local = vdir / name
        if local.is_file():
            r.pass_(f"Disco OK: {name}")
        else:
            r.fail_(f"Disco MISSING: {local}")

    # Archivos en disco no referenciados
    referenced = {Path((s.get("video_url") or "")).name for s in video_slides}
    for f in files:
        if f.name not in referenced:
            r.warn_(f"Video huérfano en disco (no en ninguna campaña): {f.name}")

    return files


def check_put_preserves_video(api: str, token: str | None, r: Report) -> None:
    section("3) Regresión: PUT no borra video_url")
    if not token:
        r.fail_("Sin token de login — no se puede probar PUT")
        return

    zona = "TV3"
    code, before = http_json("GET", f"{api}/api/publicidad/{zona}")
    if code != 200:
        r.fail_(f"GET {zona} -> {code}")
        return

    # Slide sintético solo en memoria del PUT (lo añadimos y quitamos)
    probe_id = "smoke-video-probe"
    slides = list(before.get("slides") or [])
    slides.append(
        {
            "id": probe_id,
            "media_tipo": "video",
            "imagen_url": "",
            "video_url": "/images/videos/__smoke_probe__.mp4",
            "texto_principal": "Smoke probe",
            "texto_secundario": "no borrar",
            "animacion_texto": "fade-in-up",
            "tamano_texto": "mediano",
        }
    )
    put_body = {
        "activo": before.get("activo", True),
        "duracion_slide": before.get("duracion_slide", 7000),
        "efecto_visual": before.get("efecto_visual", "fade"),
        "mostrar_logo": before.get("mostrar_logo", True),
        "tamano_fuente": before.get("tamano_fuente", "mediano"),
        "efectos_aleatorios": before.get("efectos_aleatorios", False),
        "mostrar_mensajes": before.get("mostrar_mensajes", True),
        "duracion_mensaje": before.get("duracion_mensaje", 9000),
        "mensajes": before.get("mensajes") or [],
        "slides": slides,
    }
    code, after = http_json("PUT", f"{api}/api/publicidad/{zona}", put_body, token=token)
    if code != 200:
        r.fail_(f"PUT con video -> {code} {after}")
        return

    found = next((s for s in (after.get("slides") or []) if s.get("id") == probe_id), None)
    if not found:
        r.fail_("PUT: slide probe no aparece en respuesta")
    elif (found.get("video_url") or "") != "/images/videos/__smoke_probe__.mp4":
        r.fail_(
            f"PUT: video_url perdido/alterado → {found.get('video_url')!r} "
            f"media_tipo={found.get('media_tipo')!r}"
        )
    elif found.get("media_tipo") != "video":
        r.fail_(f"PUT: media_tipo={found.get('media_tipo')!r} (esperado video)")
    else:
        r.pass_("PUT conserva media_tipo=video y video_url")

    # Restaurar campaña original
    restore = {
        **put_body,
        "slides": before.get("slides") or [],
    }
    code2, _ = http_json(
        "PUT", f"{api}/api/publicidad/{zona}", restore, token=token
    )
    if code2 == 200:
        r.pass_("Campaña TV3 restaurada tras probe")
    else:
        r.warn_(f"No se pudo restaurar TV3 tras probe (HTTP {code2})")


def check_upload(api: str, token: str | None, disk: Path, r: Report) -> None:
    section("4) Upload video de prueba")
    if not token:
        r.fail_("Sin token — skip upload")
        return

    # Mini MP4 válido (ftyp + free + mdat mínimo) — muchos players lo rechazan,
    # pero el backend solo valida content-type y lo guarda.
    # Usamos un archivo real de la carpeta si existe; si no, bytes dummy.
    real = next(iter(sorted((disk / "videos").glob("*.mp4"))), None)
    if real and real.stat().st_size < 2_000_000:
        payload = real.read_bytes()
        fname = "smoke-copy.mp4"
    else:
        # Header ftyp isom mínimo + padding
        payload = (
            b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41"
            + b"\x00\x00\x00\x08free"
            + b"\x00\x00\x00\x08mdat"
            + b"\x00" * 256
        )
        fname = "smoke-tiny.mp4"

    boundary = "----SmokeBoundary7MA4YWxkTrZu0gW"
    body = (
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="file"; filename="{fname}"\r\n'
            f"Content-Type: video/mp4\r\n\r\n"
        ).encode("utf-8")
        + payload
        + (
            f"\r\n--{boundary}\r\n"
            f'Content-Disposition: form-data; name="texto_principal"\r\n\r\n'
            f"Smoke video\r\n"
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="texto_secundario"\r\n\r\n'
            f"test\r\n"
            f"--{boundary}--\r\n"
        ).encode("utf-8")
    )
    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Authorization": f"Bearer {token}",
    }
    try:
        code, raw, _ = http(
            "POST",
            f"{api}/api/publicidad/TV3/subir-slide",
            data=body,
            headers=headers,
            timeout=60,
        )
        data = json.loads(raw.decode("utf-8", errors="replace") or "{}")
    except Exception as e:  # noqa: BLE001
        r.fail_(f"upload excepción: {e}")
        return

    if code not in (200, 201):
        r.fail_(f"upload HTTP {code}: {data}")
        return

    vu = data.get("video_url") or ""
    mt = data.get("media_tipo")
    if mt != "video" or not vu:
        r.fail_(f"upload respuesta incompleta: media_tipo={mt} video_url={vu!r}")
        return
    r.pass_(f"upload OK → {vu}")

    # Quitar el slide de smoke de la campaña
    campana = data.get("campana") or {}
    slides = [
        s
        for s in (campana.get("slides") or [])
        if s.get("id") != data.get("slide_id")
        and (s.get("video_url") or "") != vu
    ]
    code2, _ = http_json(
        "PUT",
        f"{api}/api/publicidad/TV3",
        {
            "slides": slides,
            "activo": campana.get("activo", True),
            "duracion_slide": campana.get("duracion_slide", 7000),
            "efecto_visual": campana.get("efecto_visual", "fade"),
            "mostrar_logo": campana.get("mostrar_logo", True),
            "tamano_fuente": campana.get("tamano_fuente", "mediano"),
            "efectos_aleatorios": campana.get("efectos_aleatorios", False),
            "mostrar_mensajes": campana.get("mostrar_mensajes", True),
            "duracion_mensaje": campana.get("duracion_mensaje", 9000),
            "mensajes": campana.get("mensajes") or [],
        },
        token=token,
    )
    if code2 == 200:
        r.pass_("slide de smoke eliminado de la campaña")
    else:
        r.warn_(f"no se pudo limpiar slide smoke (HTTP {code2})")

    # Borrar archivo smoke si se creó
    name = Path(vu).name
    local = disk / "videos" / name
    if local.is_file() and name.startswith("pub-") and "smoke" in fname:
        try:
            local.unlink()
            r.pass_(f"archivo smoke borrado: {name}")
        except OSError:
            r.warn_(f"no se pudo borrar {local}")


def repair_orphans(api: str, token: str | None, disk: Path, r: Report) -> None:
    section("5) Repair: enlazar videos huérfanos a slides rotos")
    if not token:
        r.fail_("Sin token — no repair")
        return

    vdir = disk / "videos"
    files = list(vdir.glob("pub-*.mp4")) + list(vdir.glob("pub-*.webm"))
    if not files:
        r.warn_("No hay archivos pub-* para reparar")
        return

    for zona in ZONAS:
        code, data = http_json("GET", f"{api}/api/publicidad/{zona}")
        if code != 200:
            continue
        slides = list(data.get("slides") or [])
        changed = False
        zkey = zona.lower()

        # 1) slides con id que coincide con archivo pub-{zona}-{id}.mp4
        for s in slides:
            sid = str(s.get("id") or "")
            vu = (s.get("video_url") or "").strip()
            if vu:
                continue
            candidates = [
                f
                for f in files
                if f.stem.endswith(sid) or f.name == f"pub-{zkey}-{sid}{f.suffix}"
            ]
            if not candidates:
                # también pub-tv3-{id}
                candidates = [f for f in files if sid and sid in f.stem]
            if candidates:
                f = candidates[0]
                s["media_tipo"] = "video"
                s["video_url"] = f"/images/videos/{f.name}"
                s["imagen_url"] = ""
                changed = True
                r.pass_(f"{zona}: reparado slide {sid} → {s['video_url']}")

        # 2) archivos de esta zona no referenciados → agregar slide
        referenced = {
            Path((s.get("video_url") or "")).name for s in slides if s.get("video_url")
        }
        for f in files:
            if f.name in referenced:
                continue
            # pub-tv3-xxx
            if zkey not in f.name.lower() and f"pub-{zkey}-" not in f.name.lower():
                continue
            slides.insert(
                0,
                {
                    "id": f.stem.split("-")[-1][:10],
                    "media_tipo": "video",
                    "imagen_url": "",
                    "video_url": f"/images/videos/{f.name}",
                    "texto_principal": "Video",
                    "texto_secundario": "El Callejón",
                    "animacion_texto": "fade-in-up",
                    "tamano_texto": "mediano",
                },
            )
            referenced.add(f.name)
            changed = True
            r.pass_(f"{zona}: agregado slide huérfano {f.name}")

        if not changed:
            continue

        body = {
            "activo": data.get("activo", True),
            "duracion_slide": data.get("duracion_slide", 7000),
            "efecto_visual": data.get("efecto_visual", "fade"),
            "mostrar_logo": data.get("mostrar_logo", True),
            "tamano_fuente": data.get("tamano_fuente", "mediano"),
            "efectos_aleatorios": data.get("efectos_aleatorios", False),
            "mostrar_mensajes": data.get("mostrar_mensajes", True),
            "duracion_mensaje": data.get("duracion_mensaje", 9000),
            "mensajes": data.get("mensajes") or [],
            "slides": slides,
        }
        code2, after = http_json(
            "PUT", f"{api}/api/publicidad/{zona}", body, token=token
        )
        if code2 == 200:
            vids = [
                s
                for s in (after.get("slides") or [])
                if s.get("media_tipo") == "video" or s.get("video_url")
            ]
            r.pass_(f"{zona}: guardado con {len(vids)} video(s)")
        else:
            r.fail_(f"{zona}: repair PUT HTTP {code2} {after}")


def main() -> int:
    ap = argparse.ArgumentParser(description="Smoke / diagnóstico campañas video")
    ap.add_argument("--base", "--api", dest="api", default=DEFAULT_API)
    ap.add_argument("--fe", default=DEFAULT_FE)
    ap.add_argument("--disk", type=Path, default=DEFAULT_DISK)
    ap.add_argument(
        "--repair",
        action="store_true",
        help="Repara slides con video_url vacío enlazando archivos en disco",
    )
    ap.add_argument(
        "--upload",
        action="store_true",
        help="Prueba subida real de un video (se limpia después)",
    )
    ap.add_argument(
        "--skip-put",
        action="store_true",
        help="No ejecuta la prueba de PUT (solo lectura)",
    )
    args = ap.parse_args()
    api = args.api.rstrip("/")
    fe = args.fe.rstrip("/")
    disk = args.disk

    print("Diagnóstico campañas VIDEO — El Callejón")
    print(f"  API : {api}")
    print(f"  FE  : {fe}")
    print(f"  DISK: {disk}")

    r = Report()

    section("0) Salud")
    try:
        code, _, _ = http("GET", f"{api}/health", timeout=8)
        if code == 200:
            r.pass_(f"API health {code}")
        else:
            r.fail_(f"API health {code}")
    except RuntimeError as e:
        r.fail_(f"API down: {e}")
        print("\nNo se puede continuar sin API.")
        return 2

    try:
        code, _, _ = http("GET", f"{fe}/", timeout=8)
        if code == 200:
            r.pass_(f"Frontend {code}")
        else:
            r.warn_(f"Frontend HTTP {code}")
    except RuntimeError as e:
        r.warn_(f"Frontend no responde en {fe}: {e}")

    token = login(api)
    if token:
        r.pass_("Login OK")
    else:
        r.warn_("Login falló (algunas pruebas se saltan)")

    video_slides = check_campanas(api, fe, disk, r)
    check_disk_and_http(fe, api, disk, video_slides, r)

    if not args.skip_put:
        check_put_preserves_video(api, token, r)

    if args.upload:
        check_upload(api, token, disk, r)

    if args.repair:
        repair_orphans(api, token, disk, r)
        # re-check
        video_slides = check_campanas(api, fe, disk, r)
        check_disk_and_http(fe, api, disk, video_slides, r)

    section("Resumen")
    print(f"  OK={r.ok}  FAIL={r.fail}  WARN={r.warn}")
    if r.fail:
        print(
            "\nCausas frecuentes:\n"
            "  • PUT /api/publicidad/{zona} con schema SlideIn sin video_url\n"
            "    (al guardar en admin se borraba el video) — ya corregido en routers.\n"
            "  • video_url vacío en DB aunque el archivo exista en /images/videos\n"
            "    → ejecutar con --repair\n"
            "  • Backend no montaba StaticFiles /images (404 en :8000)\n"
            "  • TV en standby / modo evento tapa la campaña\n"
        )
        return 1
    print("\nTodo en orden para videos (o no hay videos configurados).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
