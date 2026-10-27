// Capturas del README con canciones reales (Billboard Hot 100, portadas oficiales vía Spotify).
// Abre la app real en modo demo, le pasa esos datos y fotografía cada función. El buscador y la vista
// de artista usan búsquedas reales con la cuenta conectada en Vinilify (solo lectura).
// Uso (con Vinilify cerrado): electron scripts/readme-shots.js --lang=en|es   (desde la carpeta promo)
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const LANG = (process.argv.find((a) => a.startsWith('--lang=')) || '--lang=en').slice(7);
const DOCS = path.join(ROOT, 'docs', LANG);
fs.mkdirSync(DOCS, { recursive: true });
const { Spotify } = require(path.join(ROOT, 'src/spotify'));

// Billboard Hot 100, top 10 de octubre de 2026.
const SONGS = {
  main: ['Patient Zero', 'Taylor Swift'],
  mini: ['Housewife', 'Tate McRae'],
  protect: ['Expectations', 'Olivia Rodrigo'],
  next: [['Solar Eclipse', 'Drake'], ['Bby Wow', 'KAROL G'], ['Petal', 'Ariana Grande'], ['Lies', 'Zach Bryan'], ['Babydoll', 'Dominic Fike'], ['Nicole Kidman', 'Adéla']],
  recent: [["Choosin' Texas", 'Ella Langley'], ['Been By Now', 'Morgan Wallen'], ['Babylon', 'Taylor Swift'], ['Last Thing You Need', 'Morgan Wallen']],
  // Para la foto con letra: grabación famosa de una canción con letra de dominio público (John Newton, 1779).
  lyrics: ['Amazing Grace', 'Judy Collins'],
};
const SEARCH_QUERY = 'Bad Bunny';
const LYRIC_FOCUS = /lost/i; // línea que queda resaltada en la foto

const simplify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Misma carpeta de datos que la app: en Windows la llave que descifra los tokens vive ahí.
// En modo demo la app no toca la sesión ni el historial.
const realUserData = path.join(app.getPath('appData'), 'Vinilify');
app.setPath('userData', realUserData);
process.argv.push('--demo', '--full');

process.on('unhandledRejection', (err) => {
  console.log('Error:', err?.message || err);
  app.exit(1);
});

async function findTrack(spotify, [name, artist]) {
  const r = await spotify.get('/search?' + new URLSearchParams({ q: `${name} ${artist}`, type: 'track', limit: '10' }));
  const items = (r.tracks?.items || []).filter(Boolean);
  const t = items.find((x) => simplify(x.name).startsWith(simplify(name)) && x.artists.some((a) => simplify(a.name) === simplify(artist)))
    || items.find((x) => x.artists.some((a) => simplify(a.name) === simplify(artist)));
  if (!t) throw new Error(`No encontré «${name}» de ${artist}`);
  const images = t.album.images;
  console.log('✓', t.name, '—', t.artists.map((a) => a.name).join(', '));
  return {
    id: t.id, uri: t.uri, name: t.name, artists: t.artists.map((a) => a.name).join(', '), album: t.album.name,
    albumUri: t.album.uri, cover: images[0]?.url, thumb: (images[1] || images[0])?.url, durationMs: t.duration_ms, url: '',
  };
}

// Letra sincronizada desde LRCLIB (la misma fuente que usa la app).
async function lrclibLines(name, artist) {
  const res = await fetch('https://lrclib.net/api/search?' + new URLSearchParams({ track_name: name, artist_name: artist }), {
    headers: { 'User-Agent': 'Vinilify/0.1 (capturas del README)' },
  });
  const found = (await res.json()).find((x) => x.syncedLyrics);
  if (!found) throw new Error(`LRCLIB no tiene letra sincronizada de «${name}»`);
  return found.syncedLyrics.split('\n').map((raw) => {
    const m = raw.match(/\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
    return m ? { t: Math.round((Number(m[1]) * 60 + Number(m[2])) * 1000), text: m[3].trim() } : null;
  }).filter(Boolean);
}

app.whenReady().then(async () => {
  const spotify = new Spotify(path.join(realUserData, 'spotify.json'));
  await spotify.load();
  if (!spotify.loggedIn) {
    console.log('Hace falta la cuenta de Spotify conectada en Vinilify.');
    return app.exit(1);
  }
  const main = await findTrack(spotify, SONGS.main);
  const mini = await findTrack(spotify, SONGS.mini);
  const protect = await findTrack(spotify, SONGS.protect);
  const sung = await findTrack(spotify, SONGS.lyrics);
  const next = [];
  for (const s of SONGS.next) next.push(await findTrack(spotify, s));
  const recent = [];
  for (const s of SONGS.recent) recent.push(await findTrack(spotify, s));
  const lines = await lrclibLines(...SONGS.lyrics);
  console.log('✓ letra:', lines.length, 'líneas');

  // El idioma de las capturas se pone como en la app; al final se deja el que tenía el usuario.
  let originalLang = null;
  try {
    originalLang = JSON.parse(fs.readFileSync(path.join(realUserData, 'settings.json'), 'utf8')).language || null;
  } catch {
    // Sin ajustes guardados.
  }
  const restoreLang = () => originalLang && ipcMain.emit('settings:language', {}, originalLang);

  require(path.join(ROOT, 'src/main.js'));
  await wait(3500);
  ipcMain.emit('settings:language', {}, LANG);
  await wait(500);
  const find = (mode) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes(`mode=${mode}`));
  const full = find('full');
  if (!full) throw new Error('No se abrió la pantalla completa');
  const js = (win, code) => win.webContents.executeJavaScript(code);
  full.webContents.on('console-message', (e) => console.log('[consola]', e.message));
  full.on('closed', () => console.log('[aviso] se cerró la pantalla completa'));

  const stateFor = (track, progressMs, extra = {}) => ({
    source: 'api', status: 'playing', isPlaying: true, canSeek: true, canLike: true, liked: true,
    shuffle: false, repeat: 'off', volume: 70, supportsVolume: true, lyrics: null,
    track, durationMs: track.durationMs, progressMs: Math.round(progressMs), progressAt: Date.now(),
    queue: next, recent, ...extra,
  });
  const show = async (win, patch) => {
    win.webContents.send('state', patch);
    await wait(2500); // fundido de portada + carga de imágenes
  };
  const save = async (win, name, format = 'jpg') => {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(DOCS, name), format === 'png' ? img.toPNG() : img.toJPEG(92));
    console.log('→', path.join('docs', LANG, name), img.getSize());
  };
  const awake = (on) => js(full, `document.body.classList.${on ? 'add' : 'remove'}('awake')`);

  // La preferencia de letra del usuario se guarda en el perfil real: se respeta y se restaura al final.
  const lyricsPref = await js(full, "localStorage.getItem('vinilify.lyrics')");

  // 1) Pantalla completa
  await show(full, stateFor(main, main.durationMs * 0.36));
  await awake(true);
  await wait(500);
  await save(full, 'fullscreen.jpg');
  await awake(false);

  // 2) Letra sincronizada
  const focus = lines.find((l) => LYRIC_FOCUS.test(l.text)) || lines[Math.floor(lines.length / 3)];
  await show(full, stateFor(sung, focus.t + 600, { lyrics: { id: sung.id, lines }, queue: next.slice(2), recent }));
  await js(full, "if (document.getElementById('lyrics').hidden) document.getElementById('btn-lyrics').click()");
  await wait(1500);
  await save(full, 'lyrics.jpg');
  await js(full, "if (!document.getElementById('lyrics').hidden) document.getElementById('btn-lyrics').click()");

  // 3) Buscador y 4) vista de artista (búsquedas reales)
  await show(full, stateFor(main, main.durationMs * 0.4));
  await js(full, `document.querySelector('[data-action=search]').click();
    const i = document.getElementById('search-input'); i.value = ${JSON.stringify(SEARCH_QUERY)}; i.dispatchEvent(new Event('input'));`);
  await wait(4000);
  console.log('[buscador] panel oculto:', await js(full, "document.getElementById('search').hidden"), '| modal oculto:', await js(full, "document.getElementById('connect').hidden"), '| fuente:', await js(full, 'document.body.dataset.status'));
  await save(full, 'search.jpg');
  await js(full, "document.querySelector('.tile[data-kind=artist]').click()");
  await wait(5000);
  await save(full, 'artist.jpg');
  await js(full, "document.querySelector('[data-action=search-close]').click()");

  // 5) Sin cuenta: al pulsar Buscar aparece la guía para conectar la API (opcional)
  await show(full, stateFor(main, main.durationMs * 0.45, { source: 'windows', queue: [], canLike: false, liked: null }));
  await js(full, "document.querySelector('[data-action=search]').click()");
  await wait(1200);
  // La guía rellena el Client ID guardado: en una imagen pública debe quedar vacío.
  await js(full, "document.getElementById('connect-id').value = ''; document.activeElement?.blur()");
  await wait(200);
  await save(full, 'no-account.jpg');
  await js(full, "document.querySelector('[data-action=connect-close]').click()");

  // 6) Modo protección
  await show(full, stateFor(protect, protect.durationMs * 0.52));
  await js(full, "document.getElementById('btn-protect').click()");
  await wait(3200);
  // Sin los controles de arriba (aparecen solo al mover el mouse).
  await js(full, "document.body.classList.remove('awake'); document.body.classList.add('sleepy')");
  await wait(600);
  await save(full, 'protection.jpg');

  await js(full, lyricsPref === null ? "localStorage.removeItem('vinilify.lyrics')" : `localStorage.setItem('vinilify.lyrics', ${JSON.stringify(lyricsPref)})`);

  // 7) Mini vinilo (con el mouse encima: título y volumen). Se abre con el botón "cambiar a mini".
  ipcMain.emit('full:to-mini', {});
  await wait(2500);
  const miniWin = find('mini');
  if (!miniWin) throw new Error('No se abrió el mini vinilo');
  miniWin.show();
  await show(miniWin, stateFor(mini, mini.durationMs * 0.2));
  await js(miniWin, "document.body.classList.add('awake')");
  await wait(1800); // que termine el fundido de la tarjeta del título
  await save(miniWin, 'mini.png', 'png');
  restoreLang();
  await wait(300);
  app.exit(0);
});
