-- Expansión campañas: logo, fuente, efectos aleatorios + efectos libres (varchar)
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/003_publicidad_avanzada.sql

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS mostrar_logo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS tamano_fuente VARCHAR(20) NOT NULL DEFAULT 'mediano';

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS efectos_aleatorios BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS mostrar_spotify BOOLEAN NOT NULL DEFAULT TRUE;

-- Liberar efecto_visual de enum rígido → VARCHAR (10 efectos + futuro)
DO $$
BEGIN
    -- Solo si la columna sigue siendo el enum
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campanas_publicidad'
          AND column_name = 'efecto_visual'
          AND udt_name = 'efecto_visual_publicidad'
    ) THEN
        ALTER TABLE campanas_publicidad
            ALTER COLUMN efecto_visual DROP DEFAULT;
        ALTER TABLE campanas_publicidad
            ALTER COLUMN efecto_visual TYPE VARCHAR(40)
            USING efecto_visual::text;
        ALTER TABLE campanas_publicidad
            ALTER COLUMN efecto_visual SET DEFAULT 'fade';
    END IF;
END $$;

ALTER TABLE campanas_publicidad
    DROP CONSTRAINT IF EXISTS campanas_publicidad_tamano_fuente_check;

ALTER TABLE campanas_publicidad
    ADD CONSTRAINT campanas_publicidad_tamano_fuente_check
    CHECK (tamano_fuente IN ('pequeno', 'mediano', 'grande'));
