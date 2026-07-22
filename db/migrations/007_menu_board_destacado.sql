-- Menú board McD-style: destacado (foto grande) + número de combo 1–12
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/007_menu_board_destacado.sql

ALTER TABLE productos_menu
    ADD COLUMN IF NOT EXISTS destacado BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE productos_menu
    ADD COLUMN IF NOT EXISTS numero_combo SMALLINT;

ALTER TABLE productos_menu
    DROP CONSTRAINT IF EXISTS productos_menu_numero_combo_check;

ALTER TABLE productos_menu
    ADD CONSTRAINT productos_menu_numero_combo_check
    CHECK (numero_combo IS NULL OR (numero_combo BETWEEN 1 AND 12));

COMMENT ON COLUMN productos_menu.destacado IS
    'true = bloque foto grande / hero rotativo en TVs de menú';
COMMENT ON COLUMN productos_menu.numero_combo IS
    'Número visible 1–12 en menú board; NULL = auto por orden';

-- Seed: primeros 6 platillos numerados; 3 destacados
UPDATE productos_menu SET numero_combo = 1, destacado = TRUE
WHERE codigo = 'PLT-CORDON';
UPDATE productos_menu SET numero_combo = 2, destacado = TRUE
WHERE codigo = 'PLT-CANELON';
UPDATE productos_menu SET numero_combo = 3, destacado = TRUE
WHERE codigo = 'PLT-LASANA';
UPDATE productos_menu SET numero_combo = 4 WHERE codigo = 'PLT-CARNE-ASA';
UPDATE productos_menu SET numero_combo = 5 WHERE codigo = 'PLT-POLLO-PLAN';
UPDATE productos_menu SET numero_combo = 6 WHERE codigo = 'PLT-CHULETA';
UPDATE productos_menu SET numero_combo = 7 WHERE codigo = 'PLT-PESCADO';
UPDATE productos_menu SET numero_combo = 8 WHERE codigo = 'PLT-BISTEC';
UPDATE productos_menu SET numero_combo = 9 WHERE codigo = 'PLT-CAMARONES';
UPDATE productos_menu SET numero_combo = 10 WHERE codigo = 'PLT-COSTILLA';
UPDATE productos_menu SET numero_combo = 11 WHERE codigo = 'PLT-BUFFET-A';
UPDATE productos_menu SET numero_combo = 12 WHERE codigo = 'PLT-BUFFET-N';
