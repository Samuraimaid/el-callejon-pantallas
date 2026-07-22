-- Migración incremental (BD ya inicializada)
-- Aplicar: docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/001_auth_catalog_expand.sql

ALTER TYPE tipo_producto_fijo ADD VALUE IF NOT EXISTS 'licor';
ALTER TYPE tipo_producto_fijo ADD VALUE IF NOT EXISTS 'cafe';

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(40);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_hash TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_username_key'
    ) THEN
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_username_key UNIQUE (username);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios (username) WHERE activo;
