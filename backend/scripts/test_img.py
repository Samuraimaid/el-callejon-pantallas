from PIL import Image
import io
import sys

print("start", flush=True)
img = Image.new("RGB", (64, 64), (180, 40, 40))
b = io.BytesIO()
img.save(b, "JPEG")
raw = b.getvalue()
print("raw", len(raw), flush=True)

from app.services.product_images import absolute_path, process_to_white_background

print("processing...", flush=True)
out = process_to_white_background(raw)
print("out", len(out), flush=True)
p = absolute_path("plato_preestablecido", "PLT-TEST")
p.write_bytes(out)
print("saved", p, p.exists(), p.stat().st_size, flush=True)
