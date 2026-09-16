-- =============================================================================
-- Migración 015: Añadir usuarios Marlon, Fabio e Invitado
-- =============================================================================

INSERT INTO usuarios (codigo, username, nombre, rol, password_hash, activo)
VALUES
    ('MARLON', 'Marlon', 'Marlon', 'admin', 'Sazon de 25 años', TRUE),
    ('FABIO', 'Fabio', 'Fabio', 'admin', 'El peluka sapbe', TRUE),
    ('INVITADO', 'Invitado', 'Invitado', 'operador', 'Cordon Blue 2026', TRUE)
ON CONFLICT (codigo) DO UPDATE
SET username = EXCLUDED.username,
    nombre = EXCLUDED.nombre,
    rol = EXCLUDED.rol,
    password_hash = EXCLUDED.password_hash,
    activo = TRUE,
    actualizado_en = NOW();
