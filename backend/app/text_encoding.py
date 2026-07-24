"""Utilidades UTF-8: reparar mojibake (TambiÃ©n → También)."""

from __future__ import annotations

from typing import Any


def fix_mojibake(value: str | None) -> str:
    """
    Corrige texto UTF-8 mal interpretado como Latin-1/CP1252.
    Aplica hasta 2 pasadas (doble encoding).
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    if not value:
        return value

    s = value
    for _ in range(2):
        if not _looks_mojibake(s):
            break
        try:
            fixed = s.encode("latin-1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            break
        if fixed == s:
            break
        s = fixed
    return s


def _looks_mojibake(s: str) -> bool:
    markers = (
        "Ã",
        "Â",
        "ð",
        "ï¿½",
        "Ã¡",
        "Ã©",
        "Ã­",
        "Ã³",
        "Ãº",
        "Ã±",
        "Ã‘",
        "â€",
    )
    return any(m in s for m in markers)


def fix_obj_strings(obj: Any) -> Any:
    """Recorre dict/list y corrige strings."""
    if isinstance(obj, str):
        return fix_mojibake(obj)
    if isinstance(obj, list):
        return [fix_obj_strings(x) for x in obj]
    if isinstance(obj, dict):
        return {k: fix_obj_strings(v) for k, v in obj.items()}
    return obj
