"""
Descarga imágenes distintas para sodas, cafés y licores (no jugos genéricos).
Usa URLs públicas Unsplash (uso no comercial local / señalética).

Ejecutar en el host:
  docker run --rm -v c:/EL_CALLEJON_POS/frontend/public/images/bebidas:/out python:3.11-slim ...
o:
  python scripts/download_bebida_images.py
"""
from __future__ import annotations

import io
import sys
import urllib.request
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Instale pillow: pip install pillow")
    sys.exit(1)

OUT = Path(__file__).resolve().parents[1] / "frontend" / "public" / "images" / "bebidas"
OUT.mkdir(parents=True, exist_ok=True)

# Foto Unsplash por producto (w=480 crop)
# Si falla la descarga se genera un placeholder de color distintivo.
UNSPLASH = {
    # Sodas / comerciales
    "SOD-COCA": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-COCA-P": "https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-PEPSI": "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=480&h=480&q=75",
    "SOD-PEPSI-P": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-SPRITE": "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-SPRITE-P": "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?auto=format&fit=crop&w=480&h=480&q=75",
    "SOD-SEVEN": "https://images.unsplash.com/photo-1527960471264-932f39eb5846?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-FANTA": "https://images.unsplash.com/photo-1624517452488-04869289c4ca?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-FANTA-P": "https://images.unsplash.com/photo-1624517452488-04869289c4ca?auto=format&fit=crop&w=480&h=480&q=75",
    "SOD-TORONJA": "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-UVA": "https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-GINGER": "https://images.unsplash.com/photo-1595981267035-7b04ca84a82d?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-TONICA": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-TE-F": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-ENERGY": "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-GATORADE": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=480&h=480&q=80",
    "SOD-POWERADE": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=480&h=480&q=80",
    "AGU-500": "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?auto=format&fit=crop&w=480&h=480&q=80",
    "AGU-1L": "https://images.unsplash.com/photo-1560023907-5f339617ea55?auto=format&fit=crop&w=480&h=480&q=80",
    "AGU-GAS-500": "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=480&h=480&q=80",
    # Cafés
    "CAF-NEGRO": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=480&h=480&q=80",
    "CAF-EXPRESSO": "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=480&h=480&q=80",
    "CAF-CON-LECHE": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=480&h=480&q=80",
    "CAF-CAPPUCCINO": "https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=480&h=480&q=80",
    "CAF-LATTE": "https://images.unsplash.com/photo-1561882468-9110e03e0f78?auto=format&fit=crop&w=480&h=480&q=80",
    "CAF-MOCHA": "https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?auto=format&fit=crop&w=480&h=480&q=80",
    # Licores / cócteles
    "LIC-CERVEZA-N": "https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-CERVEZA-I": "https://images.unsplash.com/photo-1535958636474-b021ee887b13?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-MICHELADA": "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-MARGARITA": "https://images.unsplash.com/photo-1556855810-ac404aa91e85?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-PINA-COL": "https://images.unsplash.com/photo-1587223962930-cb7f31384c19?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-CUBA": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-BLOODY": "https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-SANGRIA": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-TEQUILA": "https://images.unsplash.com/photo-1516535794938-6063878f08cc?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-RON-A": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=480&h=480&q=70",
    "LIC-RON-W": "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-VODKA": "https://images.unsplash.com/photo-1608885898957-a3e5859b3e3a?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-WHISKY": "https://images.unsplash.com/photo-1527281400683-1aae777175f8?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-GIN": "https://images.unsplash.com/photo-1514361892635-6b07e31e75f9?auto=format&fit=crop&w=480&h=480&q=80",
    "LIC-BRANDY": "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?auto=format&fit=crop&w=480&h=480&q=70",
    # Jugos naturales (variados, no todos iguales)
    "JUG-LIMONADA": "https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=480&h=480&q=80",
    "JUG-MARACUYA": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=480&h=480&q=80",
    "JUG-HORCHATA": "https://images.unsplash.com/photo-1577805947697-89e18249d767?auto=format&fit=crop&w=480&h=480&q=80",
    "JUG-CHICHA": "https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=480&h=480&q=70",
    "JUG-CACAO": "https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=480&h=480&q=80",
}

# Colores de respaldo por código (si falla red)
COLORS = {
    "SOD-COCA": (180, 20, 30),
    "SOD-COCA-P": (200, 30, 40),
    "SOD-PEPSI": (20, 40, 140),
    "SOD-PEPSI-P": (30, 50, 160),
    "SOD-SPRITE": (40, 180, 90),
    "SOD-SPRITE-P": (50, 190, 100),
    "SOD-SEVEN": (200, 220, 80),
    "SOD-FANTA": (240, 120, 20),
    "SOD-FANTA-P": (250, 140, 30),
    "SOD-TORONJA": (230, 90, 70),
    "SOD-UVA": (120, 40, 160),
    "SOD-GINGER": (210, 160, 60),
    "SOD-TONICA": (180, 200, 210),
    "SOD-TE-F": (180, 140, 60),
    "SOD-ENERGY": (40, 200, 80),
    "SOD-GATORADE": (30, 120, 200),
    "SOD-POWERADE": (20, 80, 180),
    "AGU-500": (100, 180, 220),
    "AGU-1L": (80, 160, 210),
    "AGU-GAS-500": (140, 200, 230),
    "CAF-NEGRO": (60, 40, 30),
    "CAF-EXPRESSO": (50, 30, 20),
    "CAF-CON-LECHE": (160, 120, 90),
    "CAF-CAPPUCCINO": (180, 140, 110),
    "CAF-LATTE": (200, 170, 140),
    "CAF-MOCHA": (100, 60, 40),
    "LIC-CERVEZA-N": (210, 160, 40),
    "LIC-CERVEZA-I": (220, 170, 50),
    "LIC-MICHELADA": (180, 100, 40),
    "LIC-MARGARITA": (160, 220, 120),
    "LIC-PINA-COL": (240, 220, 140),
    "LIC-CUBA": (140, 40, 40),
    "LIC-BLOODY": (160, 30, 30),
    "LIC-SANGRIA": (150, 30, 50),
    "LIC-TEQUILA": (220, 200, 120),
    "LIC-RON-A": (140, 70, 30),
    "LIC-RON-W": (200, 180, 140),
    "LIC-VODKA": (200, 210, 220),
    "LIC-WHISKY": (160, 100, 40),
    "LIC-GIN": (180, 210, 200),
    "LIC-BRANDY": (130, 60, 30),
    "JUG-LIMONADA": (230, 220, 80),
    "JUG-MARACUYA": (240, 180, 40),
    "JUG-HORCHATA": (230, 210, 170),
    "JUG-CHICHA": (200, 140, 80),
    "JUG-CACAO": (90, 50, 30),
}


def placeholder(codigo: str, dest: Path) -> None:
    from PIL import ImageDraw, ImageFont

    rgb = COLORS.get(codigo, (100, 80, 60))
    im = Image.new("RGB", (480, 480), rgb)
    draw = ImageDraw.Draw(im)
    # glass shape
    draw.ellipse([140, 80, 340, 400], fill=(255, 255, 255, 40), outline=(255, 255, 255))
    draw.rectangle([180, 120, 300, 380], fill=(255, 255, 255))
    label = codigo.replace("-", " ")
    draw.text((40, 420), label[:22], fill=(255, 255, 255))
    im.save(dest, "JPEG", quality=88)


def download(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "ElCallejonPantallas/1.0 (local signage)"},
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()
        im = Image.open(io.BytesIO(data)).convert("RGB")
        im = im.resize((480, 480), Image.Resampling.LANCZOS)
        im.save(dest, "JPEG", quality=88)
        return True
    except Exception as e:
        print(f"  FAIL {dest.name}: {e}")
        return False


def main() -> None:
    print(f"Salida: {OUT}")
    ok = 0
    for codigo, url in UNSPLASH.items():
        dest = OUT / f"{codigo}.jpg"
        print(f"→ {codigo}")
        if download(url, dest):
            ok += 1
            print(f"  OK {dest.name} ({dest.stat().st_size} bytes)")
        else:
            placeholder(codigo, dest)
            print(f"  placeholder {dest.name}")
            ok += 1
    print(f"Listo: {ok}/{len(UNSPLASH)} imágenes")


if __name__ == "__main__":
    main()
