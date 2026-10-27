# Color de acento de cada portada, con la misma fórmula que la app (accentFrom en src/renderer/app.js).
import colorsys
import json
from pathlib import Path

import numpy as np
from PIL import Image

PROMO = Path(__file__).resolve().parent.parent
out = {}
for folder in ['bb', 'be']:
    for img in sorted((PROMO / 'public' / 'covers' / folder).glob('*.jpg')):
        px = np.asarray(Image.open(img).convert('RGB').resize((24, 24), Image.BILINEAR)).reshape(-1, 3).astype(float)
        mx, mn = px.max(1), px.min(1)
        w = ((mx - mn) / 255) ** 2 * (mx / 255) + 0.002
        r, g, b = (px * w[:, None]).sum(0) / w.sum()
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        out[f'covers/{folder}/{img.name}'] = f'hsl({round(h * 360)} {round(max(s, 0.35) * 100)}% 62%)'
(PROMO / 'src' / 'ui' / 'accents.json').write_text(json.dumps(out, indent=1))
print(json.dumps(out, indent=1))
