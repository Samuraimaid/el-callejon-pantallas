-- 010: Cartelería industrial — telemetría de pantallas + slides con video/animación
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/010_digital_signage_industrial.sql

-- Estado de las 6 pantallas (heartbeat + control remoto)
CREATE TABLE IF NOT EXISTS pantallas_estado (
    id              SMALLINT PRIMARY KEY CHECK (id BETWEEN 1 AND 6),
    etiqueta        VARCHAR(80) NOT NULL DEFAULT '',
    ruta            VARCHAR(80) NOT NULL DEFAULT '',
    en_linea        BOOLEAN NOT NULL DEFAULT FALSE,
    ultimo_ping     TIMESTAMPTZ,
    latencia_ms     INTEGER,
    estado          VARCHAR(20) NOT NULL DEFAULT 'offline'
                    CHECK (estado IN ('online','weak','offline','error','standby')),
    power_on        BOOLEAN NOT NULL DEFAULT TRUE,
    volumen         SMALLINT NOT NULL DEFAULT 80 CHECK (volumen BETWEEN 0 AND 100),
    modo_evento     BOOLEAN NOT NULL DEFAULT FALSE,
    error_msg       TEXT,
    snapshot_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pantallas_estado (id, etiqueta, ruta) VALUES
    (1, 'TV #1 · Menú Comidas', '/tv/1'),
    (2, 'TV #2 · Complementos', '/tv/2'),
    (3, 'TV #3 · Publicidad Barra', '/tv/3'),
    (4, 'TV #4 · Publicidad Parrilla', '/tv/4'),
    (5, 'TV #5 · VIP Ambiente', '/tv/5'),
    (6, 'TV #6 · VIP Platillos', '/tv/6')
ON CONFLICT (id) DO NOTHING;

-- Fotos de modo evento (cumpleaños / privados)
CREATE TABLE IF NOT EXISTS evento_media (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo          VARCHAR(160) NOT NULL DEFAULT '',
    media_url       TEXT NOT NULL,
    media_tipo      VARCHAR(20) NOT NULL DEFAULT 'image'
                    CHECK (media_tipo IN ('image','video')),
    orientacion     VARCHAR(20) NOT NULL DEFAULT 'horizontal'
                    CHECK (orientacion IN ('horizontal','vertical','square')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    orden           SMALLINT NOT NULL DEFAULT 0,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evento_media_activo ON evento_media (activo, orden);

-- Nota: slides JSONB ya soporta campos extra (video_url, animacion_texto, media_tipo)
-- sin ALTER de columnas. Convención:
-- {
--   "id":"s1",
--   "media_tipo":"image"|"video",
--   "imagen_url":"/images/slides/...",
--   "video_url":"/images/videos/...",
--   "texto_principal":"...",
--   "texto_secundario":"...",
--   "animacion_texto":"fade-in-up"|"bounce"|"marquee"|"none",
--   "tamano_texto":"pequeno"|"mediano"|"grande"
-- }
