"""Smoke test cartelería digital — auth, menú, publicidad, health."""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


def req(method: str, url: str, body: dict | None = None, token: str | None = None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=15) as res:
        return json.loads(res.read().decode())


def main() -> int:
    print("HEALTH", req("GET", f"{BASE}/health"))
    login = req(
        "POST",
        f"{BASE}/api/auth/login",
        {"usuario": "admin", "password": "1234"},
    )
    token = login["access_token"]
    print("LOGIN", login["usuario"]["nombre"], login["usuario"]["rol"])

    menu = req("GET", f"{BASE}/api/productos/menu", token=token)
    print("MENU conteos", menu.get("conteos"))

    prods = req("GET", f"{BASE}/api/productos?solo_activos=false", token=token)
    print("PRODUCTOS", len(prods))
    if prods:
        p = prods[0]
        patched = req(
            "PATCH",
            f"{BASE}/api/productos/{p['id']}",
            {"precio_unitario": float(p["precio_unitario"])},
            token=token,
        )
        print("PATCH", patched["codigo"], patched["precio_unitario"])

    barra = req("GET", f"{BASE}/api/publicidad/BARRA_BEBIDAS")
    vip = req("GET", f"{BASE}/api/publicidad/SALON_VIP")
    print(
        "PUB",
        "barra",
        len(barra.get("slides") or []),
        "vip",
        len(vip.get("slides") or []),
    )

    print(
        "MSG barra",
        len(barra.get("mensajes") or []),
        "vip",
        len(vip.get("mensajes") or []),
    )

    print("OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print("FAIL", e, file=sys.stderr)
        raise SystemExit(1)
