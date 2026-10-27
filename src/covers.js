// Portadas en alta resolución (modo sin cuenta). Windows entrega la portada a ~300 px; la búsqueda de
// iTunes la tiene a 1000 px. Solo se usa si título, artista y duración coinciden: si iTunes no tiene la
// canción, o tiene otra con el mismo nombre, se queda la de Windows.
const { simplify, cleanTitle, firstArtist } = require('./text');

const cache = new Map();

async function findHiresCover({ id, name, artists, durationMs }) {
  if (cache.has(id)) return cache.get(id);
  const title = simplify(cleanTitle(name));
  const artist = simplify(firstArtist(artists));
  let url = null;
  try {
    const res = await fetch('https://itunes.apple.com/search?' + new URLSearchParams({
      term: `${firstArtist(artists)} ${cleanTitle(name)}`, entity: 'song', limit: '15',
    }), { signal: AbortSignal.timeout(8000) });
    const { results = [] } = res.ok ? await res.json() : {};
    const match = results.find((r) => simplify(cleanTitle(r.trackName)) === title
      && simplify(r.artistName).includes(artist)
      && Math.abs((r.trackTimeMillis || 0) - durationMs) <= 3000);
    url = match?.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/1000x1000bb.') || null;
  } catch {
    return null; // Sin conexión: no se guarda en caché para reintentar.
  }
  cache.set(id, url);
  return url;
}

module.exports = { findHiresCover };
