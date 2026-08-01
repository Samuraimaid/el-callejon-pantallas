-- 012: Programación de modo evento (inicio/fin automáticos)
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/012_evento_schedule.sql

INSERT INTO config_sistema (clave, valor, actualizado_en)
VALUES (
    'evento_schedule',
    '{
      "enabled": false,
      "titulo": "",
      "starts_at": null,
      "ends_at": null,
      "auto_applied": false
    }'::jsonb,
    NOW()
)
ON CONFLICT (clave) DO NOTHING;
