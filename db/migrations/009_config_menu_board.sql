-- Configuración visual de menú board (TV #1 y #2)
-- docker exec -i el_callejon_db psql -U callejon -d el_callejon_pos < db/migrations/009_config_menu_board.sql

CREATE TABLE IF NOT EXISTS config_sistema (
    clave           VARCHAR(80) PRIMARY KEY,
    valor           JSONB NOT NULL DEFAULT '{}'::jsonb,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO config_sistema (clave, valor)
VALUES (
    'menu_board',
    '{
      "comidas": {
        "leftTitle": "",
        "rightTitle": "",
        "showTitles": false,
        "showSubtitles": false,
        "leftMaxCards": 5,
        "rightMaxCards": 5,
        "heroTitle": "Menú del día",
        "heroIntervalMs": 5000
      },
      "complementos": {
        "leftTitle": "",
        "rightTitle": "",
        "showTitles": false,
        "showSubtitles": false,
        "leftMaxCards": 6,
        "rightMaxCards": 6,
        "heroTitle": "Complementos",
        "heroIntervalMs": 5000
      }
    }'::jsonb
)
ON CONFLICT (clave) DO NOTHING;
