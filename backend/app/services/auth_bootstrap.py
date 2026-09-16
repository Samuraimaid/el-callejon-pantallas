"""Servicio de inicialización y actualización de usuarios del sistema."""

from __future__ import annotations

import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.security import hash_password

logger = logging.getLogger("callejon.auth_bootstrap")

INITIAL_USERS = [
    {
        "codigo": "MARLON",
        "username": "Marlon",
        "nombre": "Marlon",
        "password": "Sazon de 25 años",
        "rol": "admin",
    },
    {
        "codigo": "FABIO",
        "username": "Fabio",
        "nombre": "Fabio",
        "password": "El peluka sapbe",
        "rol": "admin",
    },
    {
        "codigo": "INVITADO",
        "username": "Invitado",
        "nombre": "Invitado",
        "password": "Cordon Blue 2026",
        "rol": "operador",
    },
]


async def ensure_initial_users(db: AsyncSession) -> None:
    """Asegura que los 3 usuarios existan con sus contraseñas encriptadas en Bcrypt."""
    for u in INITIAL_USERS:
        try:
            res = await db.execute(
                text(
                    """
                    SELECT id, password_hash
                    FROM usuarios
                    WHERE LOWER(username) = LOWER(:u) OR LOWER(codigo) = LOWER(:c)
                    """
                ),
                {"u": u["username"], "c": u["codigo"]},
            )
            row = res.mappings().first()
            hashed = hash_password(u["password"])

            if row:
                await db.execute(
                    text(
                        """
                        UPDATE usuarios
                        SET password_hash = :pwd,
                            username = :u,
                            nombre = :nom,
                            rol = :rol::rol_usuario,
                            activo = TRUE,
                            actualizado_en = NOW()
                        WHERE id = :id
                        """
                    ),
                    {
                        "id": row["id"],
                        "pwd": hashed,
                        "u": u["username"],
                        "nom": u["nombre"],
                        "rol": u["rol"],
                    },
                )
            else:
                await db.execute(
                    text(
                        """
                        INSERT INTO usuarios (codigo, username, nombre, rol, password_hash, activo)
                        VALUES (:c, :u, :nom, :rol::rol_usuario, :pwd, TRUE)
                        """
                    ),
                    {
                        "c": u["codigo"],
                        "u": u["username"],
                        "nom": u["nombre"],
                        "rol": u["rol"],
                        "pwd": hashed,
                    },
                )
            await db.commit()
        except Exception as e:
            logger.warning("No se pudo bootstrap usuario %s: %s", u["username"], e)
            await db.rollback()
