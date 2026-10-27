# Hoja de contacto: junta los fotogramas de out/stills en una grilla con el número de cuadro.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

stills = Path(__file__).resolve().parent.parent / 'out' / 'stills'
names = sys.argv[1:] or sorted(p.stem[1:] for p in stills.glob('f*.jpg'))
files = [stills / f'f{int(n):04d}.jpg' for n in names]
w, h = 960, 540
cols = 2
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), (40, 40, 40))
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 28)
for i, f in enumerate(files):
    im = Image.open(f).resize((w, h))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 130, 40), fill=(255, 40, 80))
    d.text((8, 4), f.stem[1:], font=font, fill='white')
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
out = stills.parent / 'contact.jpg'
sheet.save(out, quality=82)
print(out)
