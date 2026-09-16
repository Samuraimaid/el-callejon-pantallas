import urllib.request
import json

base_fe = 'https://callejon-frontend-836176703716.us-central1.run.app'
base_be = 'https://callejon-backend-836176703716.us-central1.run.app'

print('=== VERIFYING BACKEND /api/landing ===')
with urllib.request.urlopen(f'{base_be}/api/landing') as r:
    data = json.loads(r.read().decode('utf-8'))
    info = data.get('info_general', {})
    print('Logo URL:', info.get('logo_url'))
    print('Map Embed URL:', info.get('google_maps_embed_url'))
    print('Mostrar Precios:', info.get('mostrar_precios'))
    menu = data.get('menu_items', [])
    print(f'Total Menu Items: {len(menu)}')
    for item in menu:
        print(f"  * {item.get('codigo', 'N/A')} | {item.get('nombre')} | NIO {item.get('precio_nio')} | Cat: {item.get('categoria')} | Dest: {item.get('destacado')}")

print('\n=== VERIFYING FRONTEND ASSETS ===')
assets = [
    '/logo-el-callejon.png',
    '/images/platillos/verduras-salteadas.jpg',
    '/images/platillos/ensalada-campesina.jpg',
    '/images/platillos/cordon-bleu.jpg',
    '/images/platillos/canelones.jpg'
]

for a in assets:
    url = f'{base_fe}{a}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as r:
            print(f'{a}: HTTP {r.status} ({len(r.read())} bytes)')
    except Exception as e:
        print(f'{a}: FAILED -> {e}')
