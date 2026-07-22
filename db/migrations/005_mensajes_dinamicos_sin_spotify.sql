-- Reemplaza banner Spotify por mensajes dinámicos (Chef / ¿Sabías qué?)
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/005_mensajes_dinamicos_sin_spotify.sql

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS mostrar_mensajes BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS duracion_mensaje INTEGER NOT NULL DEFAULT 9000;

ALTER TABLE campanas_publicidad
    ADD COLUMN IF NOT EXISTS mensajes JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Migrar flag antiguo si existía
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'campanas_publicidad' AND column_name = 'mostrar_spotify'
    ) THEN
        UPDATE campanas_publicidad
        SET mostrar_mensajes = COALESCE(mostrar_spotify, TRUE)
        WHERE TRUE;
        ALTER TABLE campanas_publicidad DROP COLUMN mostrar_spotify;
    END IF;
END $$;

ALTER TABLE campanas_publicidad
    DROP CONSTRAINT IF EXISTS campanas_publicidad_duracion_mensaje_check;

ALTER TABLE campanas_publicidad
    ADD CONSTRAINT campanas_publicidad_duracion_mensaje_check
    CHECK (duracion_mensaje >= 3000 AND duracion_mensaje <= 60000);

-- Seed mensajes si la zona quedó vacía
UPDATE campanas_publicidad
SET mensajes = '[
  {"id":"b1","categoria":"chef","texto":"Prueba nuestros jugos naturales 100% frescos elaborados al instante"},
  {"id":"b2","categoria":"sabias","texto":"Desde 1990 servimos el sabor de León con la calma de lo bien hecho"},
  {"id":"b3","categoria":"chef","texto":"Pregunta por el cóctel de la casa y la cerveza bien fría de la barra"},
  {"id":"b4","categoria":"sabias","texto":"También para llevar: el mismo sabor de El Callejón en tu mesa de casa"}
]'::jsonb
WHERE zona = 'BARRA_BEBIDAS'
  AND (mensajes IS NULL OR mensajes = '[]'::jsonb);

UPDATE campanas_publicidad
SET mensajes = '[
  {"id":"v1","categoria":"sabias","texto":"Disfruta de nuestro salón VIP climatizado para tus eventos privados"},
  {"id":"v2","categoria":"chef","texto":"Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente"},
  {"id":"v3","categoria":"sabias","texto":"El Callejón VIP es ideal para reuniones de familia y celebraciones"},
  {"id":"v4","categoria":"chef","texto":"Combina tu buffet favorito con un jugo natural en el rincón más fresco del restaurante"}
]'::jsonb
WHERE zona = 'SALON_VIP'
  AND (mensajes IS NULL OR mensajes = '[]'::jsonb);
