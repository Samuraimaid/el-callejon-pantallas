-- Campañas publicitarias por zona (TVs 70")
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/002_campanas_publicidad.sql

DO $$ BEGIN
    CREATE TYPE zona_publicidad AS ENUM ('BARRA_BEBIDAS', 'SALON_VIP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE efecto_visual_publicidad AS ENUM ('zoom-in', 'fade', 'slide-left');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS campanas_publicidad (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zona            zona_publicidad NOT NULL UNIQUE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    duracion_slide  INTEGER NOT NULL DEFAULT 7000 CHECK (duracion_slide >= 2000 AND duracion_slide <= 60000),
    efecto_visual   efecto_visual_publicidad NOT NULL DEFAULT 'fade',
    slides          JSONB NOT NULL DEFAULT '[]'::jsonb,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campanas_zona_activo ON campanas_publicidad (zona) WHERE activo;

-- Seeds por zona (idempotente)
INSERT INTO campanas_publicidad (zona, activo, duracion_slide, efecto_visual, slides)
VALUES
(
    'BARRA_BEBIDAS',
    TRUE,
    7000,
    'zoom-in',
    '[
      {"id":"s1","imagen_url":"/images/slides/slide1-buffet.jpg","texto_principal":"Tradición, sabor y detalles","texto_secundario":"que se recuerdan desde 1990"},
      {"id":"s2","imagen_url":"/images/bebidas/jugos-naturales.jpg","texto_principal":"Bebidas naturales","texto_secundario":"para compartir y refrescar tu paladar"},
      {"id":"s3","imagen_url":"/images/slides/slide8-barra.jpg","texto_principal":"Barra de licores","texto_secundario":"Cócteles, cerveza y premium"},
      {"id":"s4","imagen_url":"/images/slides/slide5-bienvenidos.jpg","texto_principal":"¡Bienvenidos!","texto_secundario":"El sabor que forma parte de tu historia"},
      {"id":"s5","imagen_url":"/images/platillos/carne-asada.jpg","texto_principal":"Cada platillo cuenta","texto_secundario":"una historia de sabor"},
      {"id":"s6","imagen_url":"/images/slides/slide6-para-llevar.jpg","texto_principal":"También para llevar","texto_secundario":"Pregunte en caja"}
    ]'::jsonb
),
(
    'SALON_VIP',
    TRUE,
    8000,
    'fade',
    '[
      {"id":"v1","imagen_url":"/images/slides/slide3-salon.jpg","texto_principal":"Disfrutá tu almuerzo","texto_secundario":"en nuestro ambiente climatizado VIP"},
      {"id":"v2","imagen_url":"/images/slides/slide7-familia.jpg","texto_principal":"Donde cada plato se siente","texto_secundario":"como en casa"},
      {"id":"v3","imagen_url":"/images/slides/slide2-ambiente.jpg","texto_principal":"Un espacio pensado","texto_secundario":"para disfrutar cada momento"},
      {"id":"v4","imagen_url":"/images/slides/slide9-patio.jpg","texto_principal":"Tu próximo lugar favorito","texto_secundario":"te está esperando"},
      {"id":"v5","imagen_url":"/images/slides/slide4-detalle.jpg","texto_principal":"Cada detalle importa","texto_secundario":"cada sabor permanece"},
      {"id":"v6","imagen_url":"/images/slides/slide5-bienvenidos.jpg","texto_principal":"El Callejón VIP","texto_secundario":"León, Nicaragua"}
    ]'::jsonb
)
ON CONFLICT (zona) DO NOTHING;
