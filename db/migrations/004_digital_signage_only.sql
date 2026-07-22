-- =============================================================================
-- Migración: POS/ERP → Cartelería digital pura
-- Ejecutar SOLO si la BD ya existía con el schema POS anterior.
-- Preferible: borrar data/postgres y reiniciar docker compose (init limpio).
--
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/004_digital_signage_only.sql
-- =============================================================================

-- Eliminar vistas y tablas de negocio POS
DROP VIEW IF EXISTS v_mesas_estado CASCADE;
DROP VIEW IF EXISTS v_colas_despacho CASCADE;

DROP TABLE IF EXISTS factura_pagos CASCADE;
DROP TABLE IF EXISTS facturas CASCADE;
DROP TABLE IF EXISTS movimientos_caja CASCADE;
DROP TABLE IF EXISTS egresos CASCADE;
DROP TABLE IF EXISTS turnos_caja CASCADE;
DROP TABLE IF EXISTS cajas CASCADE;
DROP TABLE IF EXISTS orden_item_componentes CASCADE;
DROP TABLE IF EXISTS orden_items CASCADE;
DROP TABLE IF EXISTS ordenes CASCADE;
DROP TABLE IF EXISTS reglas_descuento CASCADE;
DROP TABLE IF EXISTS componentes_platillo CASCADE;
DROP TABLE IF EXISTS mesas CASCADE;

-- Renombrar catálogo si aún se llama productos_fijos
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'productos_fijos'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'productos_menu'
    ) THEN
        ALTER TABLE productos_fijos RENAME TO productos_menu;
    END IF;
END $$;

-- Quitar columnas de promo POS si existen
ALTER TABLE productos_menu DROP COLUMN IF EXISTS es_canelones;

-- Añadir orden_display si falta
ALTER TABLE productos_menu ADD COLUMN IF NOT EXISTS orden_display SMALLINT NOT NULL DEFAULT 0;

-- Convertir enum de tipo si es el viejo
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_producto_fijo')
       AND NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_producto_menu') THEN
        CREATE TYPE tipo_producto_menu AS ENUM (
            'plato_preestablecido', 'extra', 'bebida_jugo',
            'bebida_soda', 'licor', 'cafe'
        );
        -- Eliminar filas de envase_llevar (ya no aplican)
        DELETE FROM productos_menu WHERE tipo::text = 'envase_llevar';
        ALTER TABLE productos_menu
            ALTER COLUMN tipo TYPE tipo_producto_menu
            USING tipo::text::tipo_producto_menu;
        DROP TYPE tipo_producto_fijo;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'tipo_producto_menu: %', SQLERRM;
END $$;

-- Roles simplificados
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rol_usuario') THEN
        -- Mapear roles viejos a admin/operador vía texto intermedio
        ALTER TABLE usuarios ALTER COLUMN rol DROP DEFAULT;
        ALTER TABLE usuarios ALTER COLUMN rol TYPE TEXT USING
            CASE
                WHEN rol::text IN ('admin', 'gerente') THEN 'admin'
                ELSE 'operador'
            END;
        DROP TYPE IF EXISTS rol_usuario CASCADE;
        CREATE TYPE rol_usuario AS ENUM ('admin', 'operador');
        ALTER TABLE usuarios
            ALTER COLUMN rol TYPE rol_usuario USING rol::rol_usuario;
        ALTER TABLE usuarios ALTER COLUMN rol SET DEFAULT 'operador';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'rol_usuario migrate: %', SQLERRM;
END $$;

-- Campañas: columnas avanzadas
ALTER TABLE campanas_publicidad ADD COLUMN IF NOT EXISTS mostrar_logo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE campanas_publicidad ADD COLUMN IF NOT EXISTS tamano_fuente VARCHAR(20) NOT NULL DEFAULT 'mediano';
ALTER TABLE campanas_publicidad ADD COLUMN IF NOT EXISTS efectos_aleatorios BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE campanas_publicidad ADD COLUMN IF NOT EXISTS mostrar_spotify BOOLEAN NOT NULL DEFAULT TRUE;

-- Liberar efecto_visual a VARCHAR
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campanas_publicidad'
          AND column_name = 'efecto_visual'
          AND udt_name = 'efecto_visual_publicidad'
    ) THEN
        ALTER TABLE campanas_publicidad ALTER COLUMN efecto_visual DROP DEFAULT;
        ALTER TABLE campanas_publicidad
            ALTER COLUMN efecto_visual TYPE VARCHAR(40) USING efecto_visual::text;
        ALTER TABLE campanas_publicidad ALTER COLUMN efecto_visual SET DEFAULT 'fade';
    END IF;
END $$;

-- Tipos POS residuales
DROP TYPE IF EXISTS tipo_mesa CASCADE;
DROP TYPE IF EXISTS estado_mesa CASCADE;
DROP TYPE IF EXISTS tipo_componente CASCADE;
DROP TYPE IF EXISTS cola_despacho CASCADE;
DROP TYPE IF EXISTS estado_orden CASCADE;
DROP TYPE IF EXISTS tipo_item_orden CASCADE;
DROP TYPE IF EXISTS metodo_pago CASCADE;
DROP TYPE IF EXISTS tipo_descuento CASCADE;
DROP TYPE IF EXISTS tipo_movimiento_caja CASCADE;
DROP TYPE IF EXISTS tipo_egreso CASCADE;
DROP TYPE IF EXISTS efecto_visual_publicidad CASCADE;

-- Usuario de servicio para TVs de menú (idempotente)
INSERT INTO usuarios (codigo, username, nombre, rol, pin_hash, password_hash, activo)
VALUES ('TV01', 'pantallas', 'Servicio TVs menú', 'operador', '1234', '1234', TRUE)
ON CONFLICT (codigo) DO NOTHING;
