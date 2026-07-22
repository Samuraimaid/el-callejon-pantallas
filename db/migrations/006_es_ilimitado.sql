-- Stock flexible: productos sin control de existencias
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/006_es_ilimitado.sql

ALTER TABLE productos_menu
    ADD COLUMN IF NOT EXISTS es_ilimitado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN productos_menu.es_ilimitado IS
    'Si true, no se descuenta stock; solo se agota al desactivar (activo=false)';
