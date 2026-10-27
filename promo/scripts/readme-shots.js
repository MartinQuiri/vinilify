// Capturas del README con canciones reales del Billboard Hot 100 (portadas oficiales vía Spotify).
// Abre la app real en modo demo, le pasa esos datos y fotografía la pantalla completa, el modo
// protección y el mini vinilo. Necesita la cuenta conectada en Vinilify (solo hace búsquedas).
// Uso (con Vinilify cerrado): electron scripts/readme-shots.js   (desde la carpeta promo)
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOCS = path.join(ROOT, 'docs');
const { Spotify } = require(path.join(ROOT, 'src/spotify'));

// Billboard Hot 100, top 10 de octubre de 2026.
const SONGS = {
  main: ['Patient Zero', 'Taylor Swift'],
  mini: ['Housewife', 'Tate McRae'],
  protect: ['Expectations', 'Olivia Rodrigo'],
  next: [['Solar Eclipse', 'Drake'], ['Bby Wow', 'KAROL G'], ['Petal', 'Ariana Grande'], ['Lies', 'Zach Bryan'], ['Babydoll', 'Dominic Fike'], ['Nicole Kidman', 'Adéla']],
  recent: [["Choosin' Texas", 'Ella Langley'], ['Been By Now', 'Morgan Wallen'], ['Babylon', 'Taylor Swift'], ['Last Thing You Need', 'Morgan Wallen']],
};

const simplify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Misma carpeta de datos que la app: en Windows la llave que descifra los tokens vive ahí.
// En modo demo la app no toca la sesión ni el historial.
const realUserData = path.join(app.getPath('appData'), 'Vinilify');
app.setPath('userData', realUserData);
process.argv.push('--demo', '--full');

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
    cover: images[0]?.url, thumb: (images[1] || images[0])?.url, durationMs: t.duration_ms, url: '',
  };
}

process.on('unhandledRejection', (err) => {
  console.log('Error:', err?.message || err);
  app.exit(1);
});

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
  const next = [];
  for (const s of SONGS.next) next.push(await findTrack(spotify, s));
  const recent = [];
  for (const s of SONGS.recent) recent.push(await findTrack(spotify, s));

  require(path.join(ROOT, 'src/main.js'));
  await wait(3500);
  const find = (mode) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes(`mode=${mode}`));
  const full = find('full');
  if (!full) throw new Error('No se abrió la pantalla completa');

  const stateFor = (track, progress) => ({
    source: 'api', status: 'playing', isPlaying: true, canSeek: true, canLike: true, liked: true,
    shuffle: false, repeat: 'off', volume: 70, supportsVolume: true, lyrics: null,
    track, durationMs: track.durationMs, progressMs: Math.round(track.durationMs * progress), progressAt: Date.now(),
    queue: next, recent,
  });
  const show = async (win, patch) => {
    win.webContents.send('state', patch);
    await wait(2500); // fundido de portada + carga de imágenes
  };
  const save = async (win, name, width) => {
    let img = await win.webContents.capturePage();
    if (width) img = img.resize({ width, quality: 'best' });
    fs.writeFileSync(path.join(DOCS, name), img.toPNG());
    console.log('→', path.join('docs', name));
  };

  // Pantalla completa
  await show(full, stateFor(main, 0.36));
  await full.webContents.executeJavaScript("document.body.classList.add('awake')");
  await wait(400);
  await save(full, 'pantalla-completa.png', 1600);

  // Modo protección
  await full.webContents.executeJavaScript("document.body.classList.remove('awake')");
  await show(full, stateFor(protect, 0.52));
  await full.webContents.executeJavaScript("document.getElementById('btn-protect').click()");
  await wait(2200);
  await save(full, 'modo-proteccion.png', 1600);

  // Mini vinilo (con el mouse encima: título y volumen). Se abre con el botón "cambiar a mini".
  ipcMain.emit('full:to-mini', {});
  await wait(2500);
  const miniWin = find('mini');
  if (!miniWin) throw new Error('No se abrió el mini vinilo');
  miniWin.show();
  await show(miniWin, stateFor(mini, 0.2));
  await miniWin.webContents.executeJavaScript("document.body.classList.add('awake')");
  await wait(1800); // que termine el fundido de la tarjeta del título
  await save(miniWin, 'mini.png');
  app.exit(0);
});
