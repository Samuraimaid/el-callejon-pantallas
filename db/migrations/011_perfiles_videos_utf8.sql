-- 011: Perfiles de campaña, plantillas editables, jobs de video, volumen 25%
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/011_perfiles_videos_utf8.sql

-- Volumen por defecto industrial: 25%
ALTER TABLE pantallas_estado
    ALTER COLUMN volumen SET DEFAULT 25;

UPDATE pantallas_estado
SET volumen = 25
WHERE volumen = 80 OR volumen IS NULL;

-- Perfiles de campaña (Restaurante diario, Evento, festivos León…)
CREATE TABLE IF NOT EXISTS perfiles_campana (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave           VARCHAR(64) NOT NULL UNIQUE,
    nombre          VARCHAR(120) NOT NULL,
    tipo            VARCHAR(24) NOT NULL DEFAULT 'diario'
                    CHECK (tipo IN ('diario', 'evento', 'festivo', 'custom')),
    descripcion     TEXT NOT NULL DEFAULT '',
    editable        BOOLEAN NOT NULL DEFAULT TRUE,
    modo_evento     BOOLEAN NOT NULL DEFAULT FALSE,
    zonas           JSONB NOT NULL DEFAULT '["TV3","TV4","TV5","TV6"]'::jsonb,
    -- config visual compartida
    config          JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- plantillas de texto por zona: { "TV3": [ {principal, secundario}, ... ], ... }
    plantillas      JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- mensajes dinámicos por zona (opcional)
    mensajes        JSONB NOT NULL DEFAULT '{}'::jsonb,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    orden           SMALLINT NOT NULL DEFAULT 0,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_tipo ON perfiles_campana (tipo, activo);

-- Cola / progreso de post-proceso de videos
CREATE TABLE IF NOT EXISTS video_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL,
    filename        VARCHAR(260) NOT NULL DEFAULT '',
    status          VARCHAR(24) NOT NULL DEFAULT 'queued'
                    CHECK (status IN (
                        'queued', 'uploading', 'processing', 'ready', 'error', 'cancelled'
                    )),
    progress        SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    stage           VARCHAR(80) NOT NULL DEFAULT 'queued',
    zonas           JSONB NOT NULL DEFAULT '[]'::jsonb,
    video_url       TEXT,
    poster_url      TEXT,
    slide_ids       JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_msg       TEXT,
    meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_video_jobs_batch ON video_jobs (batch_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs (status);

-- Seeds de perfiles (ON CONFLICT actualiza plantillas UTF-8)
INSERT INTO perfiles_campana (clave, nombre, tipo, descripcion, editable, modo_evento, zonas, plantillas, mensajes, orden)
VALUES
(
    'restaurante_diario',
    'Restaurante · Diario',
    'diario',
    'Uso diario del local. Editable. Ideal para almuerzo y operación normal.',
    TRUE,
    FALSE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [
        {"principal": "Barra de El Callejón", "secundario": "Cócteles, cerveza y el toque de la casa"},
        {"principal": "Bebidas naturales", "secundario": "Jugos frescos elaborados al instante"},
        {"principal": "Para compartir", "secundario": "Picada, salsas y el sabor que une la mesa"},
        {"principal": "¡Bienvenidos a El Callejón!", "secundario": "Buffet y restaurante · León, Nicaragua"}
      ],
      "TV4": [
        {"principal": "A la parrilla", "secundario": "Cortes jugosos con sazón de León"},
        {"principal": "Costilla BBQ", "secundario": "Sabor ahumado que se recuerda"},
        {"principal": "El sabor de la casa", "secundario": "Platillos calientes recién preparados"},
        {"principal": "Buffet y porciones", "secundario": "Sabor, variedad y buena atención"}
      ],
      "TV5": [
        {"principal": "Salón VIP", "secundario": "Espacio íntimo para reuniones y celebraciones"},
        {"principal": "Tu lugar favorito en León", "secundario": "Ambiente cómodo para disfrutar sin prisa"},
        {"principal": "El Callejón VIP", "secundario": "León, Nicaragua · desde 1990"},
        {"principal": "Como en casa", "secundario": "Donde cada plato se siente especial"}
      ],
      "TV6": [
        {"principal": "Especial del chef", "secundario": "Siempre algo nuevo que probar"},
        {"principal": "Pescado fresco", "secundario": "Preparado al momento, aquí o para llevar"},
        {"principal": "Variedad VIP", "secundario": "Para todos los gustos en la mesa"},
        {"principal": "El Callejón · León", "secundario": "La Colonia, 2½ cuadras abajo · 11 a.m. – 3 p.m."}
      ]
    }'::jsonb,
    '{
      "TV3": [
        {"id": "rd-t3-1", "categoria": "chef", "texto": "Prueba nuestros jugos naturales 100% frescos elaborados al instante"},
        {"id": "rd-t3-2", "categoria": "sabias", "texto": "También para llevar: el mismo sabor de El Callejón en tu mesa de casa · WhatsApp 8512-1494"}
      ],
      "TV4": [
        {"id": "rd-t4-1", "categoria": "chef", "texto": "Costilla BBQ, camarones y pescado fresco: el sabor de la casa"},
        {"id": "rd-t4-2", "categoria": "sabias", "texto": "Nuestros asados se preparan al momento con sazón de León"}
      ],
      "TV5": [
        {"id": "rd-t5-1", "categoria": "sabias", "texto": "Disfruta de nuestro salón VIP climatizado para tus eventos privados"},
        {"id": "rd-t5-2", "categoria": "chef", "texto": "Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente"}
      ],
      "TV6": [
        {"id": "rd-t6-1", "categoria": "chef", "texto": "Pregunta por las recomendaciones del chef del día"},
        {"id": "rd-t6-2", "categoria": "sabias", "texto": "Cada platillo cuenta una historia de sabor desde 1990 en León"}
      ]
    }'::jsonb,
    10
),
(
    'modo_evento',
    'Modo Evento',
    'evento',
    'Perfil independiente para cumpleaños y eventos privados. Activa modo evento en las TVs seleccionadas.',
    TRUE,
    TRUE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [{"principal": "Celebramos contigo", "secundario": "Evento privado · El Callejón"}],
      "TV4": [{"principal": "¡Felicidades!", "secundario": "La mesa está lista para tu celebración"}],
      "TV5": [{"principal": "Salón VIP · Evento", "secundario": "Un espacio solo para ustedes"}],
      "TV6": [{"principal": "Buen provecho", "secundario": "El sabor de la casa en tu día especial"}]
    }'::jsonb,
    '{
      "TV3": [{"id": "ev-1", "categoria": "sabias", "texto": "Gracias por celebrar con nosotros en El Callejón"}],
      "TV4": [{"id": "ev-2", "categoria": "chef", "texto": "Menú especial del evento · pregunta a tu mesero"}],
      "TV5": [{"id": "ev-3", "categoria": "sabias", "texto": "Salón VIP reservado para su celebración"}],
      "TV6": [{"id": "ev-4", "categoria": "chef", "texto": "Brindemos por los momentos que unen la mesa"}]
    }'::jsonb,
    20
),
(
    'semana_santa_leon',
    'Semana Santa · León',
    'festivo',
    'Sugerencia festiva León: procesiones y almuerzos en familia. Editable.',
    TRUE,
    FALSE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [{"principal": "Semana Santa en León", "secundario": "Almuerza con la familia en El Callejón"}],
      "TV4": [{"principal": "Tradición y buen sabor", "secundario": "Platillos de la casa para estos días"}],
      "TV5": [{"principal": "Reuniones en familia", "secundario": "Salón VIP disponible para reservar"}],
      "TV6": [{"principal": "El Callejón te espera", "secundario": "Horario de almuerzo · León, Nicaragua"}]
    }'::jsonb,
    '{}'::jsonb,
    30
),
(
    'purisima',
    'La Gritería / Purísima',
    'festivo',
    'Sugerencia: temporada de La Purísima y Gritería en León.',
    TRUE,
    FALSE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [{"principal": "¡Quién causa tanta alegría!", "secundario": "La Purísima se celebra también en la mesa"}],
      "TV4": [{"principal": "Sabor de temporada", "secundario": "Comparte en familia en El Callejón"}],
      "TV5": [{"principal": "Gritería con los tuyos", "secundario": "Reserva tu mesa VIP"}],
      "TV6": [{"principal": "Tradición nicaragüense", "secundario": "El Callejón · León"}]
    }'::jsonb,
    '{}'::jsonb,
    40
),
(
    'independencia',
    'Fiestas Patrias',
    'festivo',
    'Sugerencia: 14–15 de septiembre y ambiente patriótico.',
    TRUE,
    FALSE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [{"principal": "¡Viva Nicaragua!", "secundario": "Celebra las fiestas patrias con nosotros"}],
      "TV4": [{"principal": "Sabor nica de verdad", "secundario": "Asados y platillos de la casa"}],
      "TV5": [{"principal": "Patria y buena mesa", "secundario": "Salón VIP para tu grupo"}],
      "TV6": [{"principal": "El Callejón · León", "secundario": "Orgullo de comer en casa"}]
    }'::jsonb,
    '{}'::jsonb,
    50
),
(
    'navidad_fin_ano',
    'Navidad y Fin de Año',
    'festivo',
    'Sugerencia: cena de empresa, familia y brindis de año nuevo.',
    TRUE,
    FALSE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [{"principal": "Felices fiestas", "secundario": "Brinda con nosotros esta temporada"}],
      "TV4": [{"principal": "Mesa de celebración", "secundario": "Lo mejor de la casa para tu reunión"}],
      "TV5": [{"principal": "Cena de fin de año", "secundario": "Reserva el salón VIP"}],
      "TV6": [{"principal": "Gracias por un año juntos", "secundario": "El Callejón · León, Nicaragua"}]
    }'::jsonb,
    '{}'::jsonb,
    60
),
(
    'dia_madre_padre',
    'Día de la Madre / Padre',
    'festivo',
    'Sugerencia: almuerzos especiales para mamá y papá.',
    TRUE,
    FALSE,
    '["TV3","TV4","TV5","TV6"]'::jsonb,
    '{
      "TV3": [{"principal": "Hoy se celebra en familia", "secundario": "Mesa lista en El Callejón"}],
      "TV4": [{"principal": "Un almuerzo para recordar", "secundario": "Platillos favoritos de la casa"}],
      "TV5": [{"principal": "Mesa VIP familiar", "secundario": "Ambiente especial para los tuyos"}],
      "TV6": [{"principal": "Gracias, mamá · Gracias, papá", "secundario": "El Callejón te acompaña"}]
    }'::jsonb,
    '{}'::jsonb,
    70
)
ON CONFLICT (clave) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    tipo = EXCLUDED.tipo,
    descripcion = EXCLUDED.descripcion,
    plantillas = EXCLUDED.plantillas,
    mensajes = EXCLUDED.mensajes,
    actualizado_en = NOW();
