// Letras sincronizadas desde LRCLIB (https://lrclib.net): gratis, abierta y sin cuenta.
const { simplify, cleanTitle, firstArtist } = require('./text');

const API = 'https://lrclib.net/api';
// LRCLIB pide identificar la app que consulta.
const HEADERS = { 'User-Agent': 'Vinilify/0.1 (vinilo de Spotify para el escritorio)' };
const cache = new Map();

// "[01:23.45] texto" → { t: 83450, text }
function parseLrc(lrc) {
  const lines = [];
  for (const raw of String(lrc || '').split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const [, min, sec] of stamps) lines.push({ t: Math.round((Number(min) * 60 + Number(sec)) * 1000), text });
  }
  return lines.sort((a, b) => a.t - b.t);
}

async function request(path, params) {
  const res = await fetch(`${API}${path}?${new URLSearchParams(params)}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  return res.json();
}

// Devuelve las líneas sincronizadas de la canción, o null si LRCLIB no las tiene.
async function fetchLyrics({ id, name, artists, album, durationMs }) {
  if (cache.has(id)) return cache.get(id);
  const artist = firstArtist(artists);
  const seconds = Math.round((durationMs || 0) / 1000);
  let synced = null;
  try {
    // 1) Coincidencia exacta (título, artista, álbum y duración).
    const exact = await request('/get', {
      track_name: name, artist_name: artist, album_name: album || '', duration: String(seconds),
    });
    synced = exact?.syncedLyrics || null;
    // 2) Búsqueda más laxa con el título limpio ("- feat. …", "(Remastered)"…), exigiendo duración parecida.
    if (!synced) {
      const found = await request('/search', { track_name: cleanTitle(name), artist_name: artist }) || [];
      const match = found.find((r) => r.syncedLyrics
        && Math.abs((r.duration || 0) - seconds) <= 3
        && simplify(r.artistName).includes(simplify(artist)));
      synced = match?.syncedLyrics || null;
    }
  } catch {
    return null; // Sin conexión o LRCLIB caído: se reintenta la próxima vez que suene.
  }
  const lines = synced ? parseLrc(synced) : null;
  const result = lines?.length ? lines : null;
  cache.set(id, result);
  return result;
}

module.exports = { fetchLyrics };
