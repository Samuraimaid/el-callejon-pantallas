-- =============================================================================
-- El Callejón — Sistema de Gestión de Pantallas Digitales (cartelería en vivo)
-- León, Nicaragua | PostgreSQL 16
-- Tablas: usuarios | productos_menu | campanas_publicidad
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
CREATE TYPE rol_usuario AS ENUM (
    'admin',
    'operador'
);

CREATE TYPE tipo_producto_menu AS ENUM (
    'plato_preestablecido',
    'extra',
    'bebida_jugo',
    'bebida_soda',
    'licor',
    'cafe'
);

CREATE TYPE zona_publicidad AS ENUM ('BARRA_BEBIDAS', 'SALON_VIP');

-- -----------------------------------------------------------------------------
-- Usuarios (auth del Centro de Control)
-- -----------------------------------------------------------------------------
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          VARCHAR(20) NOT NULL UNIQUE,
    username        VARCHAR(40) UNIQUE,
    nombre          VARCHAR(120) NOT NULL,
    rol             rol_usuario NOT NULL DEFAULT 'operador',
    pin_hash        TEXT,
    password_hash   TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_rol_activo ON usuarios (rol, activo);
CREATE INDEX idx_usuarios_username ON usuarios (username) WHERE activo;

-- -----------------------------------------------------------------------------
-- Menú del día (precios / stock / activo → TVs 50" menú en vivo)
-- -----------------------------------------------------------------------------
CREATE TABLE productos_menu (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo              VARCHAR(30) NOT NULL UNIQUE,
    nombre              VARCHAR(160) NOT NULL,
    tipo                tipo_producto_menu NOT NULL,
    descripcion         TEXT,
    precio_unitario     NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
    stock_disponible    INTEGER NOT NULL DEFAULT 0 CHECK (stock_disponible >= 0),
    stock_minimo        INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
    -- true = sin control de existencias (siempre disponible si activo)
    es_ilimitado        BOOLEAN NOT NULL DEFAULT FALSE,
    -- Menú board estilo franquicia (TVs 50")
    destacado           BOOLEAN NOT NULL DEFAULT FALSE,
    numero_combo        SMALLINT
        CHECK (numero_combo IS NULL OR (numero_combo BETWEEN 1 AND 12)),
    unidad              VARCHAR(20) NOT NULL DEFAULT 'und',
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    orden_display       SMALLINT NOT NULL DEFAULT 0,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_productos_menu_tipo_activo ON productos_menu (tipo, activo);
CREATE INDEX idx_productos_menu_stock ON productos_menu (stock_disponible)
    WHERE activo AND stock_disponible <= stock_minimo;

-- -----------------------------------------------------------------------------
-- Campañas publicitarias (Barra 50" #3-#4 · VIP 60" #5-#6) — independientes
-- slides JSON: [{id, imagen_url, texto_principal, texto_secundario}, ...]
-- -----------------------------------------------------------------------------
CREATE TABLE campanas_publicidad (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona                zona_publicidad NOT NULL UNIQUE,
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    duracion_slide      INTEGER NOT NULL DEFAULT 7000
        CHECK (duracion_slide >= 2000 AND duracion_slide <= 60000),
    efecto_visual       VARCHAR(40) NOT NULL DEFAULT 'fade',
    mostrar_logo        BOOLEAN NOT NULL DEFAULT TRUE,
    tamano_fuente       VARCHAR(20) NOT NULL DEFAULT 'mediano'
        CHECK (tamano_fuente IN ('pequeno', 'mediano', 'grande')),
    efectos_aleatorios  BOOLEAN NOT NULL DEFAULT FALSE,
    -- Widget flotante: Recomendaciones del Chef / ¿Sabías qué?
    mostrar_mensajes    BOOLEAN NOT NULL DEFAULT TRUE,
    duracion_mensaje    INTEGER NOT NULL DEFAULT 9000
        CHECK (duracion_mensaje >= 3000 AND duracion_mensaje <= 60000),
    mensajes            JSONB NOT NULL DEFAULT '[]'::jsonb,
    slides              JSONB NOT NULL DEFAULT '[]'::jsonb,
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campanas_zona_activo ON campanas_publicidad (zona) WHERE activo;

-- -----------------------------------------------------------------------------
-- Triggers actualizado_en
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_usuarios_upd
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TRIGGER trg_productos_menu_upd
    BEFORE UPDATE ON productos_menu
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TRIGGER trg_campanas_upd
    BEFORE UPDATE ON campanas_publicidad
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

COMMENT ON TABLE usuarios IS 'Auth del Centro de Control de Pantallas';
COMMENT ON TABLE productos_menu IS 'Menú del día: precios, stock y activos para TVs 50" #1 y #2';
COMMENT ON TABLE campanas_publicidad IS 'Campañas independientes BARRA_BEBIDAS y SALON_VIP';
