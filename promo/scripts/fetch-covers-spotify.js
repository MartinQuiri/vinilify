// Portadas oficiales vía la cuenta de Spotify conectada en Vinilify (solo búsquedas, no cambia nada).
// Uso: electron scripts/fetch-covers-spotify.js   (desde la carpeta promo)
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { Spotify } = require('../../src/spotify');

const OUT = path.resolve(__dirname, '../public/covers');
const ALBUMS = [
  { slug: 'lux', artist: 'ROSALÍA', album: 'LUX', track: 'Berghain' },
  { slug: 'motomami', artist: 'ROSALÍA', album: 'MOTOMAMI', track: 'SAOKO' },
  { slug: 'elmalquerer', artist: 'ROSALÍA', album: 'EL MAL QUERER', track: 'MALAMENTE' },
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

app.setPath('userData', path.join(app.getPath('appData'), 'Vinilify'));
app.whenReady().then(async () => {
  const spotify = new Spotify(path.join(app.getPath('userData'), 'spotify.json'));
  await spotify.load();
  if (!spotify.loggedIn) {
    console.log('No hay cuenta conectada en Vinilify.');
    return app.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const found = [];
  for (const a of ALBUMS) {
    const main = simplify(a.artist.split(' & ')[0]);
    const r = await spotify.get('/search?' + new URLSearchParams({ q: `${a.album} ${a.artist.split(' & ')[0]}`, type: 'album', limit: '10' }));
    const items = (r.albums?.items || []).filter(Boolean);
    const match = items.find((x) => simplify(x.name) === simplify(a.album) && x.artists.some((y) => simplify(y.name) === main))
      || items.find((x) => simplify(x.name).startsWith(simplify(a.album)) && x.artists.some((y) => simplify(y.name) === main));
    if (!match) {
      console.log('✗ sin resultado:', a.artist, '—', a.album, '| vistos:', items.map((x) => x.name).join(' / '));
      continue;
    }
    const img = Buffer.from(await (await fetch(match.images[0].url)).arrayBuffer());
    fs.writeFileSync(path.join(OUT, `${a.slug}.jpg`), img);
    found.push({ ...a, album: match.name, file: `covers/${a.slug}.jpg` });
    console.log('✓', a.artist, '—', match.name, `(${match.images[0].width}px)`);
  }
  fs.writeFileSync(path.join(OUT, 'covers.json'), JSON.stringify(found, null, 2));
  app.exit(0);
});
