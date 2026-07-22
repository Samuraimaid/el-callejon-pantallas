# Imágenes locales — El Callejón POS

Coloca aquí las fotos del restaurante (descargadas de Facebook u otras redes).
El frontend **no depende de URLs externas**.

## Estructura

```
public/images/
├── platillos/          # Fotos de platos del menú
│   ├── cordon-bleu.jpg
│   ├── canelones.jpg
│   ├── carne-asada.jpg
│   ├── churrasco.jpg
│   ├── pollo-asado.jpg
│   ├── lomo-cerdo.jpg
│   └── relleno.jpg
├── bebidas/
│   └── jugos-naturales.jpg
└── slides/             # Carrusel TVs #3 y #4 (y fallbacks)
    ├── slide1-buffet.jpg
    ├── slide2-ambiente.jpg
    ├── slide3-salon.jpg
    ├── slide4-detalle.jpg
    ├── slide5-bienvenidos.jpg
    ├── slide6-para-llevar.jpg
    ├── slide7-familia.jpg
    ├── slide8-barra.jpg
    └── slide9-patio.jpg
```

## Mapeo en código

Definido en `src/lib/constants.js`:

| Constante | Uso |
|-----------|-----|
| `PLATILLO_IMAGES` | Código producto → foto (TVs comida) |
| `CAROUSEL_SLIDES` | 6 slides del carrusel bebidas |
| `CATEGORIA_IMAGES` | Miniaturas extras/jugos/cafés |

## Cómo reemplazar una foto

1. Guarda el archivo con el **mismo nombre** en la carpeta indicada.
2. Recarga la pantalla TV (Ctrl+F5). No hace falta rebuild de Docker si el volumen monta `public/`.

> En `docker-compose.yml` el frontend monta `./frontend/public` — los cambios de imagen se ven al instante.
