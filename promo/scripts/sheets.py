# Hojas de contacto de una carpeta de fotogramas (t00.00.jpg…): 4 columnas × 6 filas con el tiempo.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

folder = Path(sys.argv[1])
prefix = sys.argv[2]
files = sorted(folder.glob('t*.jpg'))
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 22)
w, h, cols, rows = 480, 270, 4, 6
for s in range(0, len(files), cols * rows):
    chunk = files[s:s + cols * rows]
    sheet = Image.new('RGB', (cols * w, rows * h), (30, 30, 30))
    for i, f in enumerate(chunk):
        im = Image.open(f).resize((w, h))
        d = ImageDraw.Draw(im)
        label = f.stem[1:].lstrip('0') or '0'
        d.rectangle((0, 0, 92, 28), fill=(255, 40, 80))
        d.text((6, 2), label + 's', font=font, fill='white')
        sheet.paste(im, ((i % cols) * w, (i // cols) * h))
    out = folder.parent / f'{prefix}-{s // (cols * rows) + 1}.jpg'
    sheet.save(out, quality=80)
    print(out)
