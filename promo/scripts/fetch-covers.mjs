// Descarga portadas reales (1000 px) desde la API pública de iTunes para usarlas en el video.
// Las portadas tienen derechos de sus discográficas: quedan solo en public/covers (ignorado por git).
import fs from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('public/covers');
const ALBUMS = [
  { slug: 'lux', artist: 'ROSALÍA', album: 'LUX', track: 'Berghain' },
  { slug: 'motomami', artist: 'ROSALÍA', album: 'MOTOMAMI', track: 'SAOKO' },
  { slug: 'elmalquerer', artist: 'ROSALÍA', album: 'El Mal Querer', track: 'MALAMENTE' },
  { slug: 'dtmf', artist: 'Bad Bunny', album: 'DeBÍ TiRAR MáS FOToS', track: 'DtMF' },
  { slug: 'grasa', artist: 'Nathy Peluso', album: 'GRASA', track: 'Envidia' },
  { slug: 'papota', artist: 'CA7RIEL & Paco Amoroso', album: 'PAPOTA', track: 'EL DÍA DEL AMIGO' },
  { slug: 'gnx', artist: 'Kendrick Lamar', album: 'GNX', track: 'luther' },
  { slug: 'hmhas', artist: 'Billie Eilish', album: 'HIT ME HARD AND SOFT', track: 'BIRDS OF A FEATHER' },
  { slug: 'ram', artist: 'Daft Punk', album: 'Random Access Memories', track: 'Get Lucky' },
  { slug: 'currents', artist: 'Tame Impala', album: 'Currents', track: 'The Less I Know The Better' },
  { slug: 'blonde', artist: 'Frank Ocean', album: 'Blonde', track: 'Pink + White' },
  { slug: 'monlaferte', artist: 'Mon Laferte', album: 'Mon Laferte, Vol. 1', track: 'Tu Falta De Querer' },
];

const simplify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

await fs.mkdir(OUT, { recursive: true });
const found = [];
for (const a of ALBUMS) {
  const mainArtist = simplify(a.artist.split(' & ')[0]);
  let match = null;
  // Primero artista + álbum; si no aparece, solo el álbum. Siempre se exige que coincidan ambos.
  const attempts = ['US', 'CL', 'MX', 'ES'].flatMap((country) => [`${mainArtist} ${simplify(a.album)}`, simplify(a.album)]
    .map((term) => ({ term, country })));
  for (const { term, country } of attempts) {
    const url = 'https://itunes.apple.com/search?' + new URLSearchParams({ term, country, entity: 'album', limit: '50' });
    const { results = [] } = await (await fetch(url)).json();
    match = results.find((r) => simplify(r.collectionName) === simplify(a.album) && simplify(r.artistName).includes(mainArtist))
      || results.find((r) => simplify(r.collectionName).startsWith(simplify(a.album)) && simplify(r.artistName).includes(mainArtist)
        && !/remix|live|single|ep$/i.test(r.collectionName));
    if (match) break;
  }
  if (!match) {
    console.log('✗ sin resultado:', a.artist, '—', a.album);
    continue;
  }
  const art = match.artworkUrl100.replace(/\/\d+x\d+bb\./, '/1000x1000bb.');
  const img = Buffer.from(await (await fetch(art)).arrayBuffer());
  await fs.writeFile(path.join(OUT, `${a.slug}.jpg`), img);
  found.push({ ...a, album: match.collectionName, file: `covers/${a.slug}.jpg` });
  console.log('✓', a.artist, '—', match.collectionName);
}
await fs.writeFile(path.join(OUT, 'covers.json'), JSON.stringify(found, null, 2));
