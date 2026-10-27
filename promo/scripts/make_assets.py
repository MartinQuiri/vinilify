# Recursos del video: el vinilo del logo aislado (PNG con transparencia) y las portadas del Billboard.
import json
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

PROMO = Path(__file__).resolve().parent.parent
ROOT = PROMO.parent
PUBLIC = PROMO / 'public'

# 1) Vinilo del icono: el disco ocupa la zona oscura/azul del centro. Se detecta y se recorta en círculo.
icon = Image.open(ROOT / 'assets' / 'icon.png').convert('RGBA')
a = np.asarray(icon).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
# El disco es negro con brillos azules; las esquinas transparentes del icono no cuentan.
dark = ((r + g + b) / 3 < 95) & (a[..., 3] > 200)
ys, xs = np.nonzero(dark)
cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
# Unos píxeles menos que el borde detectado, para que no quede el halo claro del fondo del icono.
radius = max(xs.max() - xs.min(), ys.max() - ys.min()) / 2 - 7
print(f'disco: centro ({cx:.0f}, {cy:.0f}) radio {radius:.0f}')
size = int(radius * 2)
crop = icon.crop((int(cx - radius), int(cy - radius), int(cx - radius) + size, int(cy - radius) + size))
ss = 4
mask = Image.new('L', (size * ss, size * ss), 0)
ImageDraw.Draw(mask).ellipse((0, 0, size * ss - 1, size * ss - 1), fill=255)
mask = mask.resize((size, size), Image.LANCZOS)
crop.putalpha(mask)
crop.resize((1024, 1024), Image.LANCZOS).save(PUBLIC / 'brand' / 'vinyl.png') if (PUBLIC / 'brand').exists() else None
(PUBLIC / 'brand').mkdir(exist_ok=True)
crop.resize((1024, 1024), Image.LANCZOS).save(PUBLIC / 'brand' / 'vinyl.png')

# 2) Portadas del Billboard (las mismas que usan las tomas), en 640 px.
tracks = json.loads((PUBLIC / 'rec' / 'tracks.json').read_text(encoding='utf-8'))
out = PUBLIC / 'covers' / 'bb'
out.mkdir(parents=True, exist_ok=True)
for key, t in tracks.items():
    dest = out / f'{key}.jpg'
    if not dest.exists():
        urllib.request.urlretrieve(t['cover'], dest)
    print('portada', key, '-', t['name'])
