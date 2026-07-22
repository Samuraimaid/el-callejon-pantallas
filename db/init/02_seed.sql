-- =============================================================================
-- Seed — Cartelería digital El Callejón (León, Nicaragua)
-- Precios base en Córdobas (C$)
-- =============================================================================

-- Credenciales dev (password/PIN: 1234). bcrypt al primer login.
INSERT INTO usuarios (codigo, username, nombre, rol, pin_hash, password_hash, activo) VALUES
    ('ADM01', 'admin',     'Administrador',        'admin',    '1234', '1234', TRUE),
    ('OPR01', 'operador',  'Operador Pantallas',   'operador', '1234', '1234', TRUE),
    ('TV01',  'pantallas', 'Servicio TVs menú',    'operador', '1234', '1234', TRUE);

-- -----------------------------------------------------------------------------
-- 12 PLATILLOS
-- -----------------------------------------------------------------------------
INSERT INTO productos_menu (
    codigo, nombre, tipo, descripcion, precio_unitario,
    stock_disponible, stock_minimo, unidad, activo, orden_display
) VALUES
    ('PLT-CORDON',    'Cordon Bleu',              'plato_preestablecido', 'Con guarnición de la casa',           180.00, 40, 5, 'plato', TRUE, 1),
    ('PLT-CANELON',   'Canelones de carne',       'plato_preestablecido', 'Especialidad de la casa',             150.00, 50, 5, 'plato', TRUE, 2),
    ('PLT-LASANA',    'Lasaña mixta',             'plato_preestablecido', 'Carne y pollo',                       160.00, 30, 5, 'plato', TRUE, 3),
    ('PLT-CARNE-ASA', 'Carne asada',              'plato_preestablecido', 'Con gallo pinto y tajadas',           190.00, 45, 5, 'plato', TRUE, 4),
    ('PLT-POLLO-PLAN','Pollo a la plancha',       'plato_preestablecido', 'Con vegetales',                       160.00, 45, 5, 'plato', TRUE, 5),
    ('PLT-CHULETA',   'Chuleta de cerdo',         'plato_preestablecido', 'Ahumada con ensalada',                170.00, 35, 5, 'plato', TRUE, 6),
    ('PLT-PESCADO',   'Filete de pescado',        'plato_preestablecido', 'Empanizado o al ajillo',              185.00, 30, 5, 'plato', TRUE, 7),
    ('PLT-BISTEC',    'Bistec encebollado',       'plato_preestablecido', 'Con arroz y frijoles',                175.00, 40, 5, 'plato', TRUE, 8),
    ('PLT-CAMARONES', 'Camarones al ajillo',      'plato_preestablecido', 'Porción generosa',                    220.00, 25, 5, 'plato', TRUE, 9),
    ('PLT-COSTILLA',  'Costilla BBQ',             'plato_preestablecido', 'Con papas fritas',                    200.00, 28, 5, 'plato', TRUE, 10),
    ('PLT-BUFFET-A',  'Buffet adulto',            'plato_preestablecido', 'Acceso buffet completo',              220.00, 999, 0, 'plato', TRUE, 11),
    ('PLT-BUFFET-N',  'Buffet niño',              'plato_preestablecido', 'Hasta 10 años',                       140.00, 999, 0, 'plato', TRUE, 12);

-- -----------------------------------------------------------------------------
-- 10 EXTRAS
-- -----------------------------------------------------------------------------
INSERT INTO productos_menu (
    codigo, nombre, tipo, descripcion, precio_unitario,
    stock_disponible, stock_minimo, unidad, activo, orden_display
) VALUES
    ('EXT-QUESO',     'Porción de queso',         'extra', 'Rallado o en lonjas',        25.00, 80, 10, 'porcion', TRUE, 1),
    ('EXT-AGUACATE',  'Porción de aguacate',      'extra', NULL,                          30.00, 60, 10, 'porcion', TRUE, 2),
    ('EXT-DOBLE-PRO', 'Doble proteína',           'extra', 'Recargo proteína extra',     45.00, 100, 10, 'und', TRUE, 3),
    ('EXT-TORTILLA',  'Tortillas extras (3)',     'extra', NULL,                          15.00, 120, 20, 'pack', TRUE, 4),
    ('EXT-CREMA',     'Porción de crema',         'extra', NULL,                          12.00, 90, 15, 'porcion', TRUE, 5),
    ('EXT-CUAJADA',   'Porción de cuajada',       'extra', NULL,                          20.00, 70, 10, 'porcion', TRUE, 6),
    ('EXT-TAJADAS',   'Tajadas extras',           'extra', NULL,                          20.00, 80, 10, 'porcion', TRUE, 7),
    ('EXT-PAPAS',     'Papas fritas extras',      'extra', NULL,                          35.00, 60, 10, 'porcion', TRUE, 8),
    ('EXT-ARROZ',     'Porción de arroz extra',   'extra', NULL,                          15.00, 100, 15, 'porcion', TRUE, 9),
    ('EXT-POSTRE',    'Postre del día',           'extra', NULL,                          40.00, 30, 5,  'und', TRUE, 10);

-- -----------------------------------------------------------------------------
-- 5 JUGOS
-- -----------------------------------------------------------------------------
INSERT INTO productos_menu (
    codigo, nombre, tipo, descripcion, precio_unitario,
    stock_disponible, stock_minimo, unidad, activo, orden_display
) VALUES
    ('JUG-CHICHA',    'Chicha de maíz',           'bebida_jugo', 'Vaso 12 oz', 30.00, 80, 10, 'vaso', TRUE, 1),
    ('JUG-CACAO',     'Cacao natural',            'bebida_jugo', 'Vaso 12 oz', 35.00, 70, 10, 'vaso', TRUE, 2),
    ('JUG-LIMONADA',  'Limonada natural',         'bebida_jugo', 'Vaso 12 oz', 28.00, 90, 10, 'vaso', TRUE, 3),
    ('JUG-MARACUYA',  'Jugo de maracuyá',         'bebida_jugo', 'Vaso 12 oz', 35.00, 80, 10, 'vaso', TRUE, 4),
    ('JUG-HORCHATA',  'Horchata',                 'bebida_jugo', 'Vaso 12 oz', 30.00, 75, 10, 'vaso', TRUE, 5);

-- -----------------------------------------------------------------------------
-- 20 BEBIDAS / SODAS
-- -----------------------------------------------------------------------------
INSERT INTO productos_menu (
    codigo, nombre, tipo, descripcion, precio_unitario,
    stock_disponible, stock_minimo, unidad, activo, orden_display
) VALUES
    ('SOD-COCA',      'Coca-Cola lata',           'bebida_soda', '355 ml', 25.00, 120, 20, 'lata', TRUE, 1),
    ('SOD-COCA-P',    'Coca-Cola personal',       'bebida_soda', '500 ml', 30.00, 100, 20, 'bot', TRUE, 2),
    ('SOD-PEPSI',     'Pepsi lata',               'bebida_soda', '355 ml', 25.00, 100, 20, 'lata', TRUE, 3),
    ('SOD-PEPSI-P',   'Pepsi personal',           'bebida_soda', '500 ml', 30.00, 90,  15, 'bot', TRUE, 4),
    ('SOD-SPRITE',    'Sprite lata',              'bebida_soda', '355 ml', 25.00, 80,  15, 'lata', TRUE, 5),
    ('SOD-SPRITE-P',  'Sprite personal',          'bebida_soda', '500 ml', 30.00, 70,  15, 'bot', TRUE, 6),
    ('SOD-FANTA',     'Fanta naranja lata',       'bebida_soda', '355 ml', 25.00, 80,  15, 'lata', TRUE, 7),
    ('SOD-FANTA-P',   'Fanta personal',           'bebida_soda', '500 ml', 30.00, 70,  15, 'bot', TRUE, 8),
    ('SOD-SEVEN',     '7UP lata',                 'bebida_soda', '355 ml', 25.00, 60,  10, 'lata', TRUE, 9),
    ('SOD-UVA',       'Soda uva',                 'bebida_soda', '355 ml', 25.00, 50,  10, 'lata', TRUE, 10),
    ('SOD-TORONJA',   'Soda toronja',             'bebida_soda', '355 ml', 25.00, 50,  10, 'lata', TRUE, 11),
    ('SOD-GINGER',    'Ginger Ale',               'bebida_soda', '355 ml', 28.00, 40,  10, 'lata', TRUE, 12),
    ('SOD-TONICA',    'Agua tónica',              'bebida_soda', '355 ml', 28.00, 40,  10, 'lata', TRUE, 13),
    ('SOD-ENERGY',    'Bebida energética',        'bebida_soda', '250 ml', 45.00, 40,  8,  'lata', TRUE, 14),
    ('AGU-500',       'Agua embotellada 500 ml',  'bebida_soda', NULL,     15.00, 150, 25, 'bot', TRUE, 15),
    ('AGU-1L',        'Agua embotellada 1 L',     'bebida_soda', NULL,     25.00, 80,  15, 'bot', TRUE, 16),
    ('AGU-GAS-500',   'Agua con gas 500 ml',      'bebida_soda', NULL,     20.00, 60,  10, 'bot', TRUE, 17),
    ('SOD-TE-F',      'Té frío limón',            'bebida_soda', '500 ml', 28.00, 50,  10, 'bot', TRUE, 18),
    ('SOD-GATORADE',  'Gatorade',                 'bebida_soda', '500 ml', 35.00, 40,  8,  'bot', TRUE, 19),
    ('SOD-POWERADE',  'Powerade',                 'bebida_soda', '500 ml', 35.00, 40,  8,  'bot', TRUE, 20);

-- -----------------------------------------------------------------------------
-- 15 LICORES
-- -----------------------------------------------------------------------------
INSERT INTO productos_menu (
    codigo, nombre, tipo, descripcion, precio_unitario,
    stock_disponible, stock_minimo, unidad, activo, orden_display
) VALUES
    ('LIC-RON-W',     'Ron blanco shot',          'licor', '1 oz',           40.00, 60, 10, 'shot', TRUE, 1),
    ('LIC-RON-A',     'Ron añejo shot',           'licor', '1 oz',           55.00, 50, 10, 'shot', TRUE, 2),
    ('LIC-VODKA',     'Vodka shot',               'licor', '1 oz',           45.00, 50, 10, 'shot', TRUE, 3),
    ('LIC-WHISKY',    'Whisky shot',              'licor', '1 oz',           70.00, 40, 8,  'shot', TRUE, 4),
    ('LIC-TEQUILA',   'Tequila shot',             'licor', '1 oz',           50.00, 45, 8,  'shot', TRUE, 5),
    ('LIC-GIN',       'Gin shot',                 'licor', '1 oz',           50.00, 40, 8,  'shot', TRUE, 6),
    ('LIC-BRANDY',    'Brandy shot',              'licor', '1 oz',           55.00, 35, 8,  'shot', TRUE, 7),
    ('LIC-CERVEZA-N', 'Cerveza nacional',         'licor', 'Botella 350 ml', 40.00, 100, 20, 'bot', TRUE, 8),
    ('LIC-CERVEZA-I', 'Cerveza importada',        'licor', 'Botella 330 ml', 60.00, 60, 15, 'bot', TRUE, 9),
    ('LIC-MICHELADA', 'Michelada',                'licor', 'Vaso',           70.00, 80, 10, 'vaso', TRUE, 10),
    ('LIC-CUBA',      'Cuba libre',               'licor', 'Vaso',           80.00, 80, 10, 'vaso', TRUE, 11),
    ('LIC-PINA-COL',  'Piña colada',              'licor', 'Vaso',           95.00, 50, 10, 'vaso', TRUE, 12),
    ('LIC-MARGARITA', 'Margarita',                'licor', 'Vaso',           90.00, 50, 10, 'vaso', TRUE, 13),
    ('LIC-BLOODY',    'Bloody Mary',              'licor', 'Vaso',           85.00, 40, 8,  'vaso', TRUE, 14),
    ('LIC-SANGRIA',   'Sangría copa',             'licor', 'Copa',           75.00, 40, 8,  'copa', TRUE, 15);

-- -----------------------------------------------------------------------------
-- 6 CAFÉS
-- -----------------------------------------------------------------------------
INSERT INTO productos_menu (
    codigo, nombre, tipo, descripcion, precio_unitario,
    stock_disponible, stock_minimo, unidad, activo, orden_display
) VALUES
    ('CAF-NEGRO',     'Café negro',               'cafe', 'Taza', 20.00, 200, 20, 'taza', TRUE, 1),
    ('CAF-CON-LECHE', 'Café con leche',           'cafe', 'Taza', 25.00, 180, 20, 'taza', TRUE, 2),
    ('CAF-EXPRESSO',  'Espresso',                 'cafe', 'Shot', 22.00, 150, 15, 'taza', TRUE, 3),
    ('CAF-CAPPUCCINO','Cappuccino',               'cafe', 'Taza', 35.00, 120, 15, 'taza', TRUE, 4),
    ('CAF-LATTE',     'Café latte',               'cafe', 'Taza', 35.00, 120, 15, 'taza', TRUE, 5),
    ('CAF-MOCHA',     'Mocha',                    'cafe', 'Taza', 40.00, 100, 10, 'taza', TRUE, 6);

-- -----------------------------------------------------------------------------
-- Campañas publicitarias independientes (Barra + VIP)
-- -----------------------------------------------------------------------------
INSERT INTO campanas_publicidad (
    zona, activo, duracion_slide, efecto_visual,
    mostrar_logo, tamano_fuente, efectos_aleatorios,
    mostrar_mensajes, duracion_mensaje, mensajes, slides
) VALUES
(
    'BARRA_BEBIDAS', TRUE, 7000, 'zoom-in',
    TRUE, 'mediano', FALSE,
    TRUE, 9000,
    '[
      {"id":"b1","categoria":"chef","texto":"Prueba nuestros jugos naturales 100% frescos elaborados al instante"},
      {"id":"b2","categoria":"sabias","texto":"Desde 1990 servimos el sabor de León con la calma de lo bien hecho"},
      {"id":"b3","categoria":"chef","texto":"Pregunta por el cóctel de la casa y la cerveza bien fría de la barra"},
      {"id":"b4","categoria":"sabias","texto":"También para llevar: el mismo sabor de El Callejón en tu mesa de casa"}
    ]'::jsonb,
    '[
      {"id":"s1","imagen_url":"/images/slides/slide1-buffet.jpg","texto_principal":"Tradición, sabor y detalles","texto_secundario":"que se recuerdan desde 1990"},
      {"id":"s2","imagen_url":"/images/bebidas/jugos-naturales.jpg","texto_principal":"Bebidas naturales","texto_secundario":"para compartir y refrescar tu paladar"},
      {"id":"s3","imagen_url":"/images/slides/slide8-barra.jpg","texto_principal":"Barra de licores","texto_secundario":"Cócteles, cerveza y premium"},
      {"id":"s4","imagen_url":"/images/slides/slide5-bienvenidos.jpg","texto_principal":"¡Bienvenidos!","texto_secundario":"El sabor que forma parte de tu historia"},
      {"id":"s5","imagen_url":"/images/platillos/carne-asada.jpg","texto_principal":"Cada platillo cuenta","texto_secundario":"una historia de sabor"},
      {"id":"s6","imagen_url":"/images/slides/slide6-para-llevar.jpg","texto_principal":"También para llevar","texto_secundario":"Pregunte en recepción"}
    ]'::jsonb
),
(
    'SALON_VIP', TRUE, 8000, 'fade',
    TRUE, 'grande', TRUE,
    TRUE, 10000,
    '[
      {"id":"v1","categoria":"sabias","texto":"Disfruta de nuestro salón VIP climatizado para tus eventos privados"},
      {"id":"v2","categoria":"chef","texto":"Reserva el área VIP: ambiente íntimo, mesas amplias y servicio preferente"},
      {"id":"v3","categoria":"sabias","texto":"El Callejón VIP es ideal para reuniones de familia y celebraciones"},
      {"id":"v4","categoria":"chef","texto":"Combina tu buffet favorito con un jugo natural en el rincón más fresco del restaurante"}
    ]'::jsonb,
    '[
      {"id":"v1","imagen_url":"/images/slides/slide3-salon.jpg","texto_principal":"Disfrutá tu almuerzo","texto_secundario":"en nuestro ambiente climatizado VIP"},
      {"id":"v2","imagen_url":"/images/slides/slide7-familia.jpg","texto_principal":"Donde cada plato se siente","texto_secundario":"como en casa"},
      {"id":"v3","imagen_url":"/images/slides/slide2-ambiente.jpg","texto_principal":"Un espacio pensado","texto_secundario":"para disfrutar cada momento"},
      {"id":"v4","imagen_url":"/images/slides/slide9-patio.jpg","texto_principal":"Tu próximo lugar favorito","texto_secundario":"te está esperando"},
      {"id":"v5","imagen_url":"/images/slides/slide4-detalle.jpg","texto_principal":"Cada detalle importa","texto_secundario":"cada sabor permanece"},
      {"id":"v6","imagen_url":"/images/slides/slide5-bienvenidos.jpg","texto_principal":"El Callejón VIP","texto_secundario":"León, Nicaragua"}
    ]'::jsonb
);
