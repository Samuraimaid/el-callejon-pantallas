"""Smoke tests cartelería industrial v2."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def req(method: str, path: str, data=None, token=None, expect=(200, 201)):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode("utf-8")
    r = urllib.request.Request(
        BASE + path, data=body, headers=headers, method=method
    )
    try:
        with urllib.request.urlopen(r, timeout=15) as res:
            code = res.status
            raw = res.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        code = e.code
        raw = e.read().decode("utf-8", errors="replace")
    ok = code in expect
    print(f"{'OK' if ok else 'FAIL'} {method} {path} -> {code}")
    if not ok:
        print(" ", raw[:200])
    try:
        return code, json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return code, {}


def main() -> int:
    fails = 0
    code, _ = req("GET", "/health")
    fails += code not in (200, 201)
    code, _ = req("GET", "/red")
    fails += code not in (200, 201)

    code, login = req(
        "POST",
        "/api/auth/login",
        {"usuario": "admin", "password": "1234"},
    )
    if code not in (200, 201):
        code, login = req(
            "POST",
            "/api/auth/login",
            {"usuario": "pantallas", "password": "1234"},
        )
    token = login.get("access_token")
    fails += not token

    code, _ = req("GET", "/api/productos/menu", token=token)
    fails += code not in (200, 201)

    code, _ = req("GET", "/api/publicidad/TV3")
    fails += code not in (200, 201)

    code, _ = req("GET", "/api/config/menu-board")
    fails += code not in (200, 201)

    code, _ = req("GET", "/api/pantallas/estado/public")
    fails += code not in (200, 201)

    code, _ = req(
        "POST",
        "/api/pantallas/1/heartbeat",
        {
            "latencia_ms": 40,
            "snapshot": {"screen": "comidas", "n_platillos": 12},
            "clear_error": True,
        },
    )
    fails += code not in (200, 201)

    if token:
        code, st = req("GET", "/api/pantallas/estado", token=token)
        fails += code not in (200, 201)
        code, st = req(
            "POST",
            "/api/pantallas/control",
            {"tv_id": 1, "volumen": 70},
            token=token,
        )
        fails += code not in (200, 201)
        # restore
        req(
            "POST",
            "/api/pantallas/control",
            {"tv_id": 1, "volumen": 80, "power_on": True, "modo_evento": False},
            token=token,
        )

    print("---")
    if fails:
        print(f"SMOKE FAIL ({fails} checks)")
        return 1
    print("SMOKE OK industrial v2")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
