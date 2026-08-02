-- Dias de la semana en que un producto se muestra en pantallas de menu (TV #1/#2)
-- null o [] = todos los dias
-- 0=domingo … 6=sabado (igual que JavaScript Date.getDay() y promos del menu board)
--
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/014_producto_dias_semana.sql

ALTER TABLE productos_menu
    ADD COLUMN IF NOT EXISTS dias_semana JSONB DEFAULT NULL;

COMMENT ON COLUMN productos_menu.dias_semana IS
    'Array JSON de dias 0=dom..6=sab en que se muestra en TVs de menu. NULL = todos los dias.';
