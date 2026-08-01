-- master_power global (persistido en config_sistema)
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/013_master_power.sql

INSERT INTO config_sistema (clave, valor, actualizado_en)
VALUES ('master_power', '{"on": true}'::jsonb, NOW())
ON CONFLICT (clave) DO NOTHING;
