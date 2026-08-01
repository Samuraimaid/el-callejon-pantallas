"""
Puerta PIN del Centro de Control (acceso unico).

- 3 intentos fallidos -> bloqueo 30s
- Luego 60s, 120s, 240s... (duplica)
- PIN persistido en app/data/admin_pin.json (4-8 digitos)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import time
from pathlib import Path
from typing import Any

PIN_TOKEN_TTL_S = int(os.environ.get("ADMIN_PIN_TOKEN_TTL", "43200"))  # 12h
PIN_SECRET = os.environ.get("JWT_SECRET", "el-callejon-pin-dev")
_PIN_FILE = Path(__file__).resolve().parent.parent / "data" / "admin_pin.json"
_DEFAULT_PIN = str(os.environ.get("ADMIN_PIN") or "2580").strip()

_state: dict[str, Any] = {
    "fails_in_round": 0,
    "lock_level": 0,
    "locked_until": 0.0,
    "total_fails": 0,
}


def _now() -> float:
    return time.time()


def _base_lock_seconds(level: int) -> int:
    if level <= 0:
        return 0
    return int(30 * (2 ** (level - 1)))


def _hash_pin(pin: str) -> str:
    return hashlib.sha256(f"ec-pin|{pin}".encode("utf-8")).hexdigest()


def _load_pin_hash() -> str:
    try:
        if _PIN_FILE.is_file():
            data = json.loads(_PIN_FILE.read_text(encoding="utf-8"))
            h = data.get("pin_hash")
            if h:
                return str(h)
    except Exception:
        pass
    # seed desde env / default
    return _hash_pin(_DEFAULT_PIN)


def _save_pin_hash(pin_hash: str) -> None:
    _PIN_FILE.parent.mkdir(parents=True, exist_ok=True)
    _PIN_FILE.write_text(
        json.dumps(
            {"pin_hash": pin_hash, "updated_at": int(_now())},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def validate_pin_format(pin: str) -> str | None:
    """None si OK; mensaje de error si no."""
    p = str(pin or "").strip()
    if not re.fullmatch(r"\d{4,8}", p):
        return "El PIN debe tener entre 4 y 8 digitos numericos"
    return None


def status(client_key: str = "default") -> dict[str, Any]:
    st = _state
    now = _now()
    locked_until = float(st.get("locked_until") or 0)
    remaining = max(0, int(locked_until - now))
    locked = remaining > 0
    fails = int(st.get("fails_in_round") or 0)
    level = int(st.get("lock_level") or 0)
    return {
        "ok": True,
        "locked": locked,
        "retry_after_s": remaining if locked else 0,
        "attempts_left": 0 if locked else max(0, 3 - fails),
        "fails_in_round": fails,
        "lock_level": level,
        "next_lock_s": _base_lock_seconds(level + 1) if not locked else remaining,
        "pin_configured": True,
        "pin_only": True,
    }


def verify_pin(pin: str, *, client_key: str = "default") -> dict[str, Any]:
    global _state
    st = status(client_key)
    if st["locked"]:
        return {
            **st,
            "ok": False,
            "error": "locked",
            "message": f"Demasiados intentos. Espere {st['retry_after_s']}s.",
        }

    pin_clean = str(pin or "").strip()
    expected_hash = _load_pin_hash()
    got = _hash_pin(pin_clean)

    if hmac.compare_digest(got, expected_hash):
        _state["fails_in_round"] = 0
        _state["lock_level"] = 0
        _state["locked_until"] = 0.0
        token = issue_pin_token()
        st_ok = status(client_key)
        return {
            **st_ok,
            "ok": True,
            "pin_token": token,
            "expires_in_s": PIN_TOKEN_TTL_S,
            "message": "PIN correcto",
        }

    _state["fails_in_round"] = int(_state.get("fails_in_round") or 0) + 1
    _state["total_fails"] = int(_state.get("total_fails") or 0) + 1
    fails = int(_state["fails_in_round"])

    if fails >= 3:
        level = int(_state.get("lock_level") or 0) + 1
        _state["lock_level"] = level
        _state["fails_in_round"] = 0
        lock_s = _base_lock_seconds(level)
        _state["locked_until"] = _now() + lock_s
        st2 = status(client_key)
        return {
            **st2,
            "ok": False,
            "error": "locked",
            "message": f"3 intentos fallidos. Bloqueado {lock_s}s.",
        }

    st2 = status(client_key)
    return {
        **st2,
        "ok": False,
        "error": "invalid",
        "message": f"PIN incorrecto. Quedan {st2['attempts_left']} intento(s).",
    }


def change_pin(old_pin: str, new_pin: str) -> dict[str, Any]:
    err = validate_pin_format(new_pin)
    if err:
        return {"ok": False, "error": "format", "message": err}

    old_h = _hash_pin(str(old_pin or "").strip())
    if not hmac.compare_digest(old_h, _load_pin_hash()):
        return {"ok": False, "error": "invalid_old", "message": "PIN actual incorrecto"}

    new_clean = str(new_pin).strip()
    if hmac.compare_digest(old_h, _hash_pin(new_clean)):
        return {"ok": False, "error": "same", "message": "El PIN nuevo es igual al actual"}

    _save_pin_hash(_hash_pin(new_clean))
    # reset locks
    _state["fails_in_round"] = 0
    _state["lock_level"] = 0
    _state["locked_until"] = 0.0
    return {
        "ok": True,
        "message": "PIN actualizado",
        "digits": len(new_clean),
    }


def issue_pin_token() -> str:
    exp = int(_now()) + PIN_TOKEN_TTL_S
    nonce = secrets.token_hex(8)
    payload = f"pinok.{exp}.{nonce}"
    sig = hmac.new(
        PIN_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:24]
    return f"{payload}.{sig}"


def validate_pin_token(token: str | None) -> bool:
    if not token or not isinstance(token, str):
        return False
    parts = token.strip().split(".")
    if len(parts) != 4 or parts[0] != "pinok":
        return False
    try:
        exp = int(parts[1])
    except ValueError:
        return False
    if _now() > exp:
        return False
    payload = f"{parts[0]}.{parts[1]}.{parts[2]}"
    expect = hmac.new(
        PIN_SECRET.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:24]
    return hmac.compare_digest(expect, parts[3])
