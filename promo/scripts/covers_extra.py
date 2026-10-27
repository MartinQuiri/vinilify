# Portadas propias para las dos obras de dominio público / libres del video, y color de acento de cada
# portada (mismo cálculo que la app: promedio ponderado por saturación, llevado a luminosidad 62 %).
import colorsys
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'covers'
FONTS = Path('C:/Windows/Fonts')


def font(name, size):
    return ImageFont.truetype(str(FONTS / name), size)


def gymnopedie():
    # Papel crema, tipografía clásica y un círculo que recuerda al disco.
    s = 1000
    img = Image.new('RGB', (s, s), (236, 228, 212))
    d = ImageDraw.Draw(img)
    d.ellipse((560, 120, 900, 460), fill=(28, 34, 52))
    d.ellipse((700, 260, 760, 320), fill=(236, 228, 212))
    d.text((80, 560), 'Gymnopédie', font=font('georgiai.ttf', 118), fill=(28, 34, 52))
    d.text((84, 700), 'No. 1', font=font('georgia.ttf', 84), fill=(176, 72, 52))
    d.line((84, 830, 916, 830), fill=(28, 34, 52), width=3)
    d.text((84, 852), 'ERIK SATIE  ·  KEVIN MACLEOD', font=font('segoeuib.ttf', 34), fill=(28, 34, 52))
    noise = Image.effect_noise((s, s), 14).convert('RGB').filter(ImageFilter.GaussianBlur(0.6))
    return Image.blend(img, noise, 0.06)


def cielito():
    # Rojo profundo con franjas tipo papel picado.
    s = 1000
    img = Image.new('RGB', (s, s), (150, 28, 40))
    d = ImageDraw.Draw(img)
    for i, color in enumerate([(244, 190, 60), (36, 120, 90), (240, 236, 226)]):
        y = 90 + i * 70
        for x in range(-40, s + 40, 80):
            d.polygon([(x, y), (x + 80, y), (x + 40, y + 50)], fill=color)
    d.text((70, 520), 'Cielito', font=font('georgiai.ttf', 150), fill=(250, 240, 226))
    d.text((70, 680), 'Lindo', font=font('georgiai.ttf', 150), fill=(250, 240, 226))
    d.text((74, 880), 'QUIRINO MENDOZA Y CORTÉS  ·  1882', font=font('segoeuib.ttf', 32), fill=(250, 240, 226))
    return img


def accent(path):
    img = Image.open(path).convert('RGB').resize((24, 24))
    r = g = b = total = 0
    for pr, pg, pb in img.getdata():
        mx, mn = max(pr, pg, pb), min(pr, pg, pb)
        w = ((mx - mn) / 255) ** 2 * (mx / 255) + 0.002
        r, g, b, total = r + pr * w, g + pg * w, b + pb * w, total + w
    h, _, s = colorsys.rgb_to_hls(r / total / 255, g / total / 255, b / total / 255)
    rr, gg, bb = colorsys.hls_to_rgb(h, 0.62, max(s, 0.35))
    return '#%02x%02x%02x' % (round(rr * 255), round(gg * 255), round(bb * 255))


gymnopedie().save(ROOT / 'gymnopedie.jpg', quality=92)
cielito().save(ROOT / 'cielito.jpg', quality=92)

meta = json.loads((ROOT / 'covers.json').read_text(encoding='utf-8'))
meta = [m for m in meta if m['slug'] not in ('gymnopedie', 'cielito')]
meta += [
    {'slug': 'cielito', 'artist': 'Quirino Mendoza y Cortés', 'album': 'Canciones mexicanas (1882)',
     'track': 'Cielito Lindo', 'file': 'covers/cielito.jpg'},
    {'slug': 'gymnopedie', 'artist': 'Kevin MacLeod', 'album': 'Satie: Gymnopédies',
     'track': 'Gymnopedie No 1', 'file': 'covers/gymnopedie.jpg'},
]
for m in meta:
    m['accent'] = accent(ROOT / f"{m['slug']}.jpg")
(ROOT / 'covers.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
print('\n'.join(f"{m['slug']:12} {m['accent']}" for m in meta))
