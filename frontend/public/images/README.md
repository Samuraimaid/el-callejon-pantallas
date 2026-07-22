# Imágenes El Callejón — clasificación

Organización de fotos para menú TV y campañas de publicidad (Barra / VIP).

## `platillos/` — Menú TV #1 (fotos de platos)

| Archivo | Representa | Código producto |
|---------|------------|-----------------|
| `cordon-bleu.jpg` | Cordon Bleu | PLT-CORDON |
| `canelones.jpg` | Canelones | PLT-CANELON |
| `relleno.jpg` | Lasaña / rellenos | PLT-LASANA |
| `carne-asada.jpg` | Carne asada | PLT-CARNE-ASA |
| `PLT-POLLO-PLAN.jpg` / `pollo-salsa.jpg` | Pollo a la plancha / en salsa | PLT-POLLO-PLAN |
| `lomo-cerdo.jpg` | Chuleta / lomo | PLT-CHULETA |
| `PLT-PESCADO.jpg` / `pescado-frito.jpg` | Pescado frito entero | PLT-PESCADO |
| `churrasco.jpg` / `PLT-BISTEC.jpg` | Bistec / churrasco | PLT-BISTEC |
| `PLT-CAMARONES.jpg` / `camarones-ajillo.jpg` | Camarones en salsa | PLT-CAMARONES |
| `PLT-COSTILLA.jpg` / `costilla-bbq.jpg` | Costilla BBQ | PLT-COSTILLA |
| `asados-parrilla.jpg` / `asados-casa.jpg` | Asados / parrilla (extra) | — |
| `especial-casa-1.jpg` / `especial-casa-2.jpg` | Especiales fotografiados en local | — |

Subidas del admin (rembg): `platillos/{CODIGO}.jpg`.

## `bebidas/` — Complementos / jugos

| Archivo | Uso |
|---------|-----|
| `jugos-naturales.jpg` | Jugos y bebidas en menú y publicidad |

## `slides/` — Carrusel publicidad (TVs Barra / VIP)

### Comida y especialidades

| Archivo | Tema |
|---------|------|
| `slide-costilla-bbq.jpg` | Costilla / asados |
| `slide-camarones.jpg` | Mariscos |
| `slide-pescado.jpg` | Pescado fresco |
| `slide-pollo-salsa.jpg` | Pollo de la casa |
| `slide-platos-mixtos.jpg` | Buffet / varios platos |
| `slide-picada-fritura.jpg` | Picada y frituras |
| `slide-brochetas.jpg` | Parrilla / brochetas |
| `slide-asados-1.jpg` / `slide-asados-2.jpg` | Asados y parrilla (fotos nuevas) |
| `slide-platillo-casa-1.jpg` / `slide-platillo-casa-2.jpg` | Platillos de la casa |
| `slide-mesa-1.jpg` / `slide-mesa-2.jpg` | Mesa para compartir / variedad |

### Ambiente del local

| Archivo | Tema |
|---------|------|
| `slide-ambiente-luz-1.jpg` / `slide-ambiente-luz-2.jpg` | Ambiente e iluminación |
| `slide-ambiente-salon-1.jpg` … `slide-ambiente-salon-6.jpg` | Salón / comedor (HEIC + DNG) |
| `slide1-buffet.jpg` … `slide9-patio.jpg` | Ambiente legacy |
| `slide-local-1.jpg` … `slide-local-6.jpg` | Fotos locales (alias históricos) |

## `publicidad/` — Material de campañas

| Archivo | Tema |
|---------|------|
| `buffet-platos.jpg` | Variedad de platos |
| `picada-fritura.jpg` | Picada |
| `brochetas-parrilla.jpg` | Parrilla |
| `asados-parrilla-1.jpg` / `asados-parrilla-2.jpg` | Asados (tonos cálidos) |
| `platillo-casa-1.jpg` … `platillo-casa-14.jpg` | Platillos fotografiados en el local (HEIC + DNG/JPG) |
| `mesa-compartir-1.jpg` / `mesa-compartir-2.jpg` | Mesa compartida / buffet informal |

### Origen de fotos nuevas (HEIC convertidas)

| Origen HEIC (orden alfabético) | Destino clasificado |
|--------------------------------|---------------------|
| tonos azul/fríos | `slide-ambiente-luz-*` |
| interior neutro | `slide-ambiente-salon-*` |
| naranja/rojo fuerte | `asados-parrilla-*` / `slide-asados-*` |
| comida cálida | `platillo-casa-*` |
| horizontal / mesa | `mesa-compartir-*` |

## Campañas actuales (texto UTF-8)

- **Barra:** costilla, camarones, picada, jugos, barra, asados, bienvenida, especialidades.
- **VIP:** almuerzo, pescado, pollo, salón, buffet, costilla, ambiente León, platillos, marca VIP.

Textos con acentos correctos: Callejón, León, Cócteles, Porción, Tradición, Salón, etc.

## Notas técnicas

- Preferir JPEG 1200–1600 px de lado largo, calidad ~85–90.
- HEIC del teléfono: convertir con ImageMagick (`docker run … dpokidov/imagemagick`).
- Algunos archivos `.DNG` del iPhone son JPEG con extensión DNG: renombrar/redimensionar basta (no hace falta rawpy).
- El admin puede subir slides nuevos desde **Gestionar Campañas** (recorte + procesamiento).
- Carpetas temporales `_raw_convert/` y `_previews/` son de trabajo; no se sirven en las TVs.
