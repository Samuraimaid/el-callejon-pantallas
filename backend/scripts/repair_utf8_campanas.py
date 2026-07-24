#!/usr/bin/env python3
"""Repara mojibake en slides y mensajes de todas las campañas."""
from __future__ import annotations

import asyncio
import json
import sys

sys.path.insert(0, "/app")

from sqlalchemy import text

from app.db import AsyncSessionLocal
from app.text_encoding import fix_obj_strings

ZONAS = ("TV3", "TV4", "TV5", "TV6", "BARRA_BEBIDAS", "SALON_VIP")


async def main() -> None:
    async with AsyncSessionLocal() as db:
        for zona in ZONAS:
            r = await db.execute(
                text(
                    """
                    SELECT slides, mensajes
                    FROM campanas_publicidad
                    WHERE zona::text = :z
                    LIMIT 1
                    """
                ),
                {"z": zona},
            )
            row = r.mappings().first()
            if not row:
                print(f"skip {zona}")
                continue
            slides = row["slides"]
            mensajes = row["mensajes"]
            if isinstance(slides, str):
                slides = json.loads(slides)
            if isinstance(mensajes, str):
                mensajes = json.loads(mensajes)
            slides = fix_obj_strings(slides or [])
            mensajes = fix_obj_strings(mensajes or [])
            await db.execute(
                text(
                    """
                    UPDATE campanas_publicidad
                    SET slides = CAST(:s AS jsonb),
                        mensajes = CAST(:m AS jsonb),
                        actualizado_en = NOW()
                    WHERE zona::text = :z
                    """
                ),
                {
                    "s": json.dumps(slides, ensure_ascii=False),
                    "m": json.dumps(mensajes, ensure_ascii=False),
                    "z": zona,
                },
            )
            sample = (mensajes[0].get("texto") if mensajes else "") or ""
            print(f"OK {zona}: msgs={len(mensajes)} slides={len(slides)} sample={sample[:70]}")
        await db.commit()
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
