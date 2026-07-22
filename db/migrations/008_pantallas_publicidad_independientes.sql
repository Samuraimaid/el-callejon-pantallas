-- 008: TVs #3–#6 independientes (una campaña cada una)
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/008_pantallas_publicidad_independientes.sql

-- Nuevos valores de enum (idempotente en PG 16)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                   WHERE t.typname = 'zona_publicidad' AND e.enumlabel = 'TV3') THEN
        ALTER TYPE zona_publicidad ADD VALUE 'TV3';
    END IF;
END$$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                   WHERE t.typname = 'zona_publicidad' AND e.enumlabel = 'TV4') THEN
        ALTER TYPE zona_publicidad ADD VALUE 'TV4';
    END IF;
END$$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                   WHERE t.typname = 'zona_publicidad' AND e.enumlabel = 'TV5') THEN
        ALTER TYPE zona_publicidad ADD VALUE 'TV5';
    END IF;
END$$;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
                   WHERE t.typname = 'zona_publicidad' AND e.enumlabel = 'TV6') THEN
        ALTER TYPE zona_publicidad ADD VALUE 'TV6';
    END IF;
END$$;

-- Insertar campañas si no existen (contenido se completa con script Python o abajo)
INSERT INTO campanas_publicidad (
    zona, activo, duracion_slide, efecto_visual,
    mostrar_logo, tamano_fuente, efectos_aleatorios,
    mostrar_mensajes, duracion_mensaje, mensajes, slides
)
SELECT
    'TV3'::zona_publicidad, TRUE, 7000, 'zoom-in',
    TRUE, 'mediano', FALSE,
    TRUE, 9000,
    COALESCE((SELECT mensajes FROM campanas_publicidad WHERE zona = 'BARRA_BEBIDAS'), '[]'::jsonb),
    COALESCE((SELECT slides FROM campanas_publicidad WHERE zona = 'BARRA_BEBIDAS'), '[]'::jsonb)
WHERE NOT EXISTS (SELECT 1 FROM campanas_publicidad WHERE zona = 'TV3');

INSERT INTO campanas_publicidad (
    zona, activo, duracion_slide, efecto_visual,
    mostrar_logo, tamano_fuente, efectos_aleatorios,
    mostrar_mensajes, duracion_mensaje, mensajes, slides
)
SELECT
    'TV4'::zona_publicidad, TRUE, 6500, 'slide-left',
    TRUE, 'mediano', TRUE,
    TRUE, 8500,
    COALESCE((SELECT mensajes FROM campanas_publicidad WHERE zona = 'BARRA_BEBIDAS'), '[]'::jsonb),
    '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM campanas_publicidad WHERE zona = 'TV4');

INSERT INTO campanas_publicidad (
    zona, activo, duracion_slide, efecto_visual,
    mostrar_logo, tamano_fuente, efectos_aleatorios,
    mostrar_mensajes, duracion_mensaje, mensajes, slides
)
SELECT
    'TV5'::zona_publicidad, TRUE, 8000, 'fade',
    TRUE, 'grande', FALSE,
    TRUE, 10000,
    COALESCE((SELECT mensajes FROM campanas_publicidad WHERE zona = 'SALON_VIP'), '[]'::jsonb),
    COALESCE((SELECT slides FROM campanas_publicidad WHERE zona = 'SALON_VIP'), '[]'::jsonb)
WHERE NOT EXISTS (SELECT 1 FROM campanas_publicidad WHERE zona = 'TV5');

INSERT INTO campanas_publicidad (
    zona, activo, duracion_slide, efecto_visual,
    mostrar_logo, tamano_fuente, efectos_aleatorios,
    mostrar_mensajes, duracion_mensaje, mensajes, slides
)
SELECT
    'TV6'::zona_publicidad, TRUE, 7500, 'scale-soft',
    TRUE, 'grande', TRUE,
    TRUE, 9000,
    COALESCE((SELECT mensajes FROM campanas_publicidad WHERE zona = 'SALON_VIP'), '[]'::jsonb),
    '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM campanas_publicidad WHERE zona = 'TV6');
