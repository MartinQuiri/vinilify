// Utilidades para comparar títulos y artistas que vienen de fuentes distintas (Spotify, LRCLIB, iTunes).

// Sin tildes, mayúsculas ni símbolos: "DESPECHÁ" y "Despecha" quedan iguales.
function simplify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// Quita los agregados típicos del título: " - feat. X", "(with X)", "(Remastered 2011)"…
function cleanTitle(name) {
  return String(name || '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s*[([](feat|ft|with|con|remaster|live|en vivo|version|versión)[^)\]]*[)\]]/gi, '')
    .trim();
}

// "ROSALÍA, Rauw Alejandro" → "ROSALÍA"
function firstArtist(artists) {
  return String(artists || '').split(',')[0].trim();
}

module.exports = { simplify, cleanTitle, firstArtist };
