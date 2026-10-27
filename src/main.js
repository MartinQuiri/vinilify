const {
  app, BrowserWindow, Tray, Menu, screen, ipcMain, shell, powerSaveBlocker, clipboard,
} = require('electron');
const fs = require('fs');
const path = require('path');
const { Spotify, REDIRECT_URI } = require('./spotify');
const { WindowsMedia } = require('./windowsMedia');
const { DEFAULT_LANG, LANGUAGES, normalize: normalizeLang, translate } = require('./i18n');
const { fetchLyrics } = require('./lyrics');
const { findHiresCover } = require('./covers');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const MINI_SIZES = { small: 200, medium: 280, large: 380 };
// La ventana mini es más alta que ancha: debajo del disco van el título y el volumen al pasar el mouse.
const miniHeight = (size) => Math.round(size * 1.32);
const POLL_PLAYING_MS = 2000;
const POLL_IDLE_MS = 5000;
const EXTRAS_EVERY_MS = 30000;

let spotify;
let settings;
let settingsFile;
let tray;
let miniWin = null;
let fullWin = null;
let setupWin = null;
let settingsWin = null;
let sleepBlocker = null;

// Dos fuentes posibles:
//  - 'windows': por defecto y sin cuenta; lee la app de Spotify a través de Windows.
//  - 'api': si el usuario conectó su cuenta (opcional); suma la cola y el buscador.
let state = { status: 'loading', source: 'windows' };
let pollTimer = null;
let lastExtrasAt = 0;
let lastExtrasTrackId = null;
const media = new WindowsMedia();
let history = [];
let historyFile;

// ---------- Ajustes ----------

function loadSettings() {
  settingsFile = path.join(app.getPath('userData'), 'settings.json');
  try {
    settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {
    settings = {};
  }
  settings = { miniSize: 'medium', showMini: true, ...settings };
  if (!settings.language) {
    settings.language = installerLanguage() || DEFAULT_LANG;
    saveSettings();
  }
}

// El instalador pregunta el idioma y lo deja en language.txt junto al ejecutable (ver build/installer.nsh).
function installerLanguage() {
  if (!app.isPackaged) return null;
  try {
    return normalizeLang(fs.readFileSync(path.join(path.dirname(process.execPath), 'language.txt'), 'utf8').trim());
  } catch {
    return null;
  }
}

function saveSettings() {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

// Texto en el idioma elegido.
const t = (key, vars) => translate(settings?.language, key, vars);

function setLanguage(lang) {
  settings.language = normalizeLang(lang);
  saveSettings();
  setState({ lang: settings.language });
  for (const [win, key] of [[setupWin, 'setupWindowTitle'], [settingsWin, 'settingsWindowTitle']]) {
    if (win && !win.isDestroyed()) win.setTitle(t(key));
  }
  lastTrayKey = '';
  refreshTray();
}

// ---------- Estado compartido con las ventanas ----------

// Las ventanas reciben solo lo que cambió (las portadas en base64 pesan) y lo mezclan con lo que ya tienen.
function setState(patch) {
  if ('progressMs' in patch) patch.progressAt = Date.now();
  state = { ...state, ...patch };
  broadcast('state', patch);
  refreshTray();
}

// Posición actual de la canción, contando lo que avanzó desde el último dato.
function currentProgress() {
  const elapsed = state.isPlaying && state.progressAt ? Date.now() - state.progressAt : 0;
  return Math.min(state.durationMs || Infinity, (state.progressMs || 0) + elapsed);
}

function broadcast(channel, payload) {
  for (const win of [miniWin, fullWin, setupWin, settingsWin]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function toast(message) {
  broadcast('toast', message);
}

// ---------- Fuente Windows (sin cuenta) ----------

function loadHistory() {
  historyFile = path.join(app.getPath('userData'), 'history.json');
  try {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch {
    history = [];
  }
}

// "Recientes" sin API: Vinilify recuerda lo que fue sonando.
function rememberTrack(track) {
  if (!track?.name) return;
  history = [track, ...history.filter((t) => t.id !== track.id)].slice(0, 8);
  fs.writeFile(historyFile, JSON.stringify(history), () => {});
}

const recentFromHistory = (currentId) => history.filter((t) => t.id !== currentId).slice(0, 4);

// Portadas en alta resolución encontradas en iTunes, por canción.
const hiresCovers = new Map();

let mediaCover = { id: null, url: '' };
function onWindowsMedia(m) {
  if (spotify.loggedIn) return;
  if (m.type === 'none' || !m.title) {
    setState({ source: 'windows', status: 'idle', isPlaying: false, supportsVolume: false, canSeek: false });
    return;
  }
  const id = `${m.title}|${m.artist}|${m.album}`;
  if ('cover' in m) mediaCover = { id, url: m.cover || '' };
  const cover = mediaCover.id === id ? mediaCover.url : '';
  if (state.track && state.track.id !== id && state.source === 'windows') rememberTrack(state.track);

  const patch = {
    source: 'windows',
    status: 'playing',
    isPlaying: m.playing,
    progressMs: m.positionMs,
    durationMs: m.durationMs,
    canSeek: m.canSeek,
    supportsVolume: m.volume >= 0,
    volume: m.volume >= 0 ? m.volume : null,
    shuffle: m.shuffle ?? null,
    repeat: m.repeat ?? null,
    canLike: false,
    queue: [],
  };
  // La canción (con su portada) y los recientes solo se mandan cuando cambian: son lo más pesado.
  // `thumb` es la portada de Windows (etiqueta del disco y color); `cover`, la de alta si se encontró.
  if (state.track?.id !== id || state.track?.thumb !== cover) {
    patch.track = {
      id, uri: null, name: m.title, artists: m.artist, album: m.album,
      cover: hiresCovers.get(id) || cover, thumb: cover, durationMs: m.durationMs, url: '',
    };
    patch.recent = recentFromHistory(id);
  }
  setState(patch);
  trackChanged(state.track);
}

// Lo que se busca una vez por canción: la letra, la portada en alta (sin cuenta) y si tiene "Me gusta".
let trackHooksFor = null;
function trackChanged(track) {
  if (!track?.name || track.id === trackHooksFor) return;
  trackHooksFor = track.id;
  setState({ lyrics: null, liked: null });

  fetchLyrics(track).then((lines) => {
    if (state.track?.id === track.id) setState({ lyrics: { id: track.id, lines } });
  });
  if (state.source === 'windows') {
    findHiresCover(track).then((url) => {
      if (!url) return;
      hiresCovers.set(track.id, url);
      if (state.track?.id === track.id) setState({ track: { ...state.track, cover: url } });
    });
  }
  if (state.source === 'api') checkLiked(track);
}

media.on('media', onWindowsMedia);

// Elige la fuente según haya o no cuenta conectada.
function startSource() {
  if (spotify.loggedIn) {
    media.stop();
    poll();
  } else {
    clearTimeout(pollTimer);
    setState({ source: 'windows', queue: [], recent: recentFromHistory(state.track?.id) });
    media.start();
  }
}

// ---------- Spotify ----------

// Las imágenes vienen de mayor a menor (640, 300, 64).
const pickThumb = (images = []) => (images[1] || images[0])?.url || '';

function toTrack(item) {
  if (!item) return null;
  const images = item.album?.images?.length ? item.album.images : item.images || item.show?.images || [];
  return {
    id: item.id || item.uri,
    uri: item.uri,
    name: item.name,
    artists: item.artists ? item.artists.map((a) => a.name).join(', ') : item.show?.name || '',
    album: item.album?.name || item.show?.publisher || '',
    albumUri: item.album?.uri || null,
    cover: images[0]?.url || '',
    thumb: pickThumb(images),
    durationMs: item.duration_ms || 0,
    url: item.external_urls?.spotify || '',
  };
}

function uniqueTracks(tracks, excludeId, limit) {
  const seen = new Set([excludeId]);
  const out = [];
  for (const t of tracks) {
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
    if (out.length === limit) break;
  }
  return out;
}

async function fetchExtras(currentId) {
  const [queue, recent] = await Promise.allSettled([
    spotify.get('/me/player/queue'),
    spotify.get('/me/player/recently-played?limit=12'),
  ]);
  const patch = {};
  if (queue.status === 'fulfilled' && queue.value) {
    patch.queue = uniqueTracks((queue.value.queue || []).map(toTrack), currentId, 6);
  }
  if (recent.status === 'fulfilled' && recent.value) {
    const tracks = (recent.value.items || []).map((i) => i.track && { ...toTrack(i.track), contextUri: i.context?.uri });
    patch.recent = uniqueTracks(tracks, currentId, 4);
  }
  lastExtrasAt = Date.now();
  lastExtrasTrackId = currentId;
  setState(patch);
}

function schedulePoll(ms) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, ms);
}

async function poll() {
  if (!spotify.loggedIn) return startSource();

  try {
    const player = await spotify.get('/me/player?additional_types=track,episode');
    const track = toTrack(player?.item);
    const device = player?.device;
    const common = {
      source: 'api',
      canSeek: true,
      canLike: true,
      shuffle: player ? Boolean(player.shuffle_state) : null,
      repeat: player?.repeat_state || null,
      deviceId: device?.id || state.deviceId || null,
      volume: device?.volume_percent ?? null,
      supportsVolume: Boolean(device?.supports_volume),
      contextUri: player?.context?.uri || null,
    };
    if (!track) {
      setState({ ...common, status: 'idle', isPlaying: false, track: state.track || null });
    } else {
      setState({
        ...common,
        status: 'playing',
        isPlaying: Boolean(player.is_playing),
        progressMs: player.progress_ms || 0,
        durationMs: player.item.duration_ms || 0,
        track,
      });
      trackChanged(track);
    }
    const id = track?.id || null;
    if (id !== lastExtrasTrackId || Date.now() - lastExtrasAt > EXTRAS_EVERY_MS) {
      fetchExtras(id).catch(() => {});
    }
    schedulePoll(state.isPlaying ? POLL_PLAYING_MS : POLL_IDLE_MS);
  } catch (err) {
    // Si la sesión caducó del todo, se vuelve a la fuente sin cuenta.
    if (!spotify.loggedIn) return startSource();
    if (err.status === 429) return schedulePoll(err.retryAfter * 1000);
    // Error de red u otro fallo temporal: mantenemos lo último que se mostró.
    schedulePoll(10000);
  }
}

function reportCommandError(err) {
  if (err.status === 403) toast(t('premiumNeeded'));
  else if (err.status === 404) toast(t('openSpotifyFirst'));
  else toast(err.message);
}

// Los comandos se mandan al último dispositivo conocido para que funcionen aunque Spotify esté en pausa.
function withDevice(route) {
  if (!state.deviceId) return route;
  return route + (route.includes('?') ? '&' : '?') + `device_id=${encodeURIComponent(state.deviceId)}`;
}

async function command(method, route, body) {
  if (!spotify.loggedIn) return false;
  try {
    await spotify.request(method, route, body);
    return true;
  } catch (err) {
    reportCommandError(err);
    return false;
  } finally {
    schedulePoll(600);
  }
}

const NEXT_REPEAT = { off: 'context', context: 'track', track: 'off' };

async function control(action) {
  const withApi = spotify.loggedIn;
  switch (action) {
    case 'toggle':
      setState({ isPlaying: !state.isPlaying, progressMs: currentProgress() });
      if (!withApi) return media.send('toggle');
      return command('PUT', withDevice(state.isPlaying ? '/me/player/play' : '/me/player/pause'));
    case 'next':
    case 'previous':
      if (!withApi) return media.send(action);
      return command('POST', withDevice(`/me/player/${action}`));
    case 'shuffle': {
      const on = !state.shuffle;
      setState({ shuffle: on });
      if (!withApi) return media.send(`shuffle ${on ? 'on' : 'off'}`);
      return command('PUT', withDevice(`/me/player/shuffle?state=${on}`));
    }
    case 'repeat': {
      // Ciclo como en Spotify: desactivado → toda la lista → una canción → desactivado.
      const next = NEXT_REPEAT[state.repeat || 'off'];
      setState({ repeat: next });
      if (!withApi) return media.send(`repeat ${next}`);
      return command('PUT', withDevice(`/me/player/repeat?state=${next}`));
    }
    case 'like':
      return toggleLike();
    default:
  }
}

// "Me gusta" usa la biblioteca nueva de Spotify (/me/library): el endpoint clásico está bloqueado
// para apps en modo desarrollo.
async function checkLiked(track) {
  if (!track?.uri || !spotify.hasScope('user-library-read')) return;
  try {
    const [liked] = await spotify.get(`/me/library/contains?uris=${encodeURIComponent(track.uri)}`);
    if (state.track?.id === track.id) setState({ liked: Boolean(liked) });
  } catch {
    // Sin dato: el corazón queda vacío.
  }
}

async function toggleLike() {
  const track = state.track;
  if (!spotify.loggedIn || !track?.uri) return;
  if (!spotify.hasScope('user-library-modify')) {
    toast(t('likePermission'));
    return login();
  }
  const liked = !state.liked;
  setState({ liked });
  try {
    await spotify.request(liked ? 'PUT' : 'DELETE', `/me/library?uris=${encodeURIComponent(track.uri)}`);
    toast(t(liked ? 'likedToast' : 'unlikedToast'));
  } catch (err) {
    setState({ liked: !liked });
    toast(t('likeFailed', { error: err.message }));
  }
}

async function addToQueue(uri) {
  if (!spotify.loggedIn || !uri) return;
  try {
    await spotify.request('POST', withDevice(`/me/player/queue?uri=${encodeURIComponent(uri)}`));
    toast(t('queuedToast'));
    lastExtrasAt = 0; // Para que "A continuación" se actualice en el próximo sondeo.
    schedulePoll(800);
  } catch (err) {
    reportCommandError(err);
  }
}

function seek(ms) {
  const position = Math.max(0, Math.round(ms));
  setState({ progressMs: position });
  if (!spotify.loggedIn) return media.send(`seek ${position}`);
  return command('PUT', withDevice(`/me/player/seek?position_ms=${position}`));
}

let volumeTimer = null;
let volumeSentAt = 0;
function setVolume(percent) {
  const volume = Math.max(0, Math.min(100, Math.round(percent)));
  setState({ volume });
  // Sin cuenta: es el volumen de Spotify en el mezclador de Windows, local e instantáneo.
  if (!spotify.loggedIn) return media.send(`volume ${volume}`);
  // Con cuenta: mientras se arrastra se manda en vivo, pero como mucho cada 120 ms (y siempre el último valor).
  clearTimeout(volumeTimer);
  const send = () => {
    volumeSentAt = Date.now();
    command('PUT', withDevice(`/me/player/volume?volume_percent=${volume}`));
  };
  const wait = 120 - (Date.now() - volumeSentAt);
  if (wait <= 0) send();
  else volumeTimer = setTimeout(send, wait);
}

// Reproduce una canción, álbum, artista o playlist. Para canciones intenta mantener el contexto
// (álbum/playlist de donde viene) para que la cola siga teniendo sentido.
async function play({ uri, contextUri }) {
  if (!uri || !spotify.loggedIn) return;
  const isItem = /^spotify:(track|episode):/.test(uri);
  const attempts = !isItem
    ? [{ context_uri: uri }]
    : [contextUri && !contextUri.includes(':artist:') && { context_uri: contextUri, offset: { uri } }, { uris: [uri] }].filter(Boolean);
  let lastErr;
  for (const body of attempts) {
    try {
      await spotify.request('PUT', withDevice('/me/player/play'), body);
      schedulePoll(600);
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  reportCommandError(lastErr);
}

async function search(query) {
  const q = String(query || '').trim();
  if (!q || !spotify.loggedIn) return null;
  const r = await spotify.get('/search?' + new URLSearchParams({ q, type: 'track,artist,album,playlist', limit: '8' }));
  const items = (group) => (group?.items || []).filter(Boolean);
  return {
    tracks: items(r.tracks).map(toTrack),
    // Igual que en searchTrackPage: `next` no es confiable.
    tracksHasMore: (r.tracks?.items || []).length > 0,
    artists: items(r.artists).map((a) => ({ uri: a.uri, name: a.name, image: pickThumb(a.images), sub: t('artist') })),
    albums: items(r.albums).map((a) => ({
      uri: a.uri, name: a.name, image: pickThumb(a.images), sub: a.artists.map((x) => x.name).join(', '),
    })),
    playlists: items(r.playlists).map((p) => ({
      uri: p.uri, name: p.name, image: pickThumb(p.images), sub: p.owner?.display_name || 'Playlist',
    })),
  };
}

const PAGE = 10;

// Una página cruda de canciones de la búsqueda. En modo desarrollo Spotify no informa si hay más
// páginas (`next` siempre vacío) y a veces devuelve menos de las pedidas aunque haya más, así que
// se asume que hay más mientras la página traiga algo.
async function searchTrackPage(q, offset) {
  const r = await spotify.get('/search?' + new URLSearchParams({
    q, type: 'track', limit: String(PAGE), offset: String(Math.max(0, Math.floor(offset))),
  }));
  const items = (r.tracks?.items || []).filter(Boolean);
  return { items, full: items.length > 0 };
}

// "Ver más" de la búsqueda normal.
async function searchTracks(query, offset = 0) {
  const q = String(query || '').trim();
  if (!q || !spotify.loggedIn) return null;
  const { items, full } = await searchTrackPage(q, offset);
  return { tracks: items.map(toTrack), nextOffset: offset + items.length, hasMore: full };
}

// Canciones de un artista. El endpoint de "más populares" está bloqueado para apps en modo desarrollo,
// así que se busca por nombre y se quedan solo las canciones donde participa ese artista (por su id):
// así no se cuelan otros artistas que se llaman igual.
async function artistTracks(artistId, name, offset = 0) {
  if (!spotify.loggedIn || !artistId) return null;
  const q = `artist:"${String(name || '').replace(/"/g, '')}"`;
  const tracks = [];
  let next = offset;
  let full = true;
  // Se piden páginas hasta juntar 10 canciones suyas (máximo 6 pedidos por clic).
  for (let i = 0; i < 6 && full && tracks.length < PAGE; i++) {
    const page = await searchTrackPage(q, next);
    next += page.items.length;
    full = page.full;
    tracks.push(...page.items.filter((t) => t.artists?.some((a) => a.id === artistId)).map(toTrack));
  }
  return { tracks, nextOffset: next, hasMore: full };
}

async function login() {
  if (!spotify.clientId) return openSetup();
  try {
    await spotify.login();
    trackHooksFor = null; // Con los permisos nuevos se vuelve a mirar "Me gusta" de la canción actual.
    broadcast('setup:done');
    broadcast('account:changed');
    toast(t('accountConnectedToast'));
    startSource();
  } catch (err) {
    broadcast('setup:error', err.message);
    toast(err.message);
  }
}

function logout() {
  spotify.logout();
  broadcast('account:changed');
  toast(t('accountDisconnectedToast'));
  startSource();
}

// ---------- Ventanas ----------

const preload = path.join(__dirname, 'preload.js');
const rendererPage = path.join(__dirname, 'renderer', 'index.html');

function windowPrefs() {
  return { preload, contextIsolation: true, sandbox: true, backgroundThrottling: false };
}

function miniDefaultPosition(size) {
  const { workArea } = screen.getPrimaryDisplay();
  return { x: workArea.x + workArea.width - size - 24, y: workArea.y + workArea.height - miniHeight(size) - 24 };
}

function isVisibleSomewhere(x, y, size) {
  return screen.getAllDisplays().some(({ workArea: a }) =>
    x + size / 2 >= a.x && x + size / 2 <= a.x + a.width && y + size / 2 >= a.y && y + size / 2 <= a.y + a.height);
}

function openMini() {
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.showInactive();
    return;
  }
  const size = MINI_SIZES[settings.miniSize] || MINI_SIZES.medium;
  let pos = settings.miniPosition;
  if (!pos || !isVisibleSomewhere(pos.x, pos.y, size)) pos = miniDefaultPosition(size);

  miniWin = new BrowserWindow({
    ...pos,
    width: size,
    height: miniHeight(size),
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: 'Vinilify',
    icon: APP_ICON,
    webPreferences: windowPrefs(),
  });
  miniWin.setAlwaysOnTop(true, 'floating');
  miniWin.loadFile(rendererPage, { query: { mode: 'mini' } });
  miniWin.once('ready-to-show', () => miniWin.showInactive());
  miniWin.webContents.on('did-finish-load', () => miniWin.webContents.send('state', state));
  const win = miniWin;
  miniWin.on('closed', () => {
    if (miniWin === win) miniWin = null;
  });
  settings.showMini = true;
  saveSettings();
  refreshTray();
}

function closeMini() {
  settings.showMini = false;
  saveSettings();
  if (miniWin && !miniWin.isDestroyed()) miniWin.close();
  refreshTray();
}

function setMiniSize(key) {
  settings.miniSize = key;
  saveSettings();
  if (miniWin && !miniWin.isDestroyed()) {
    const [x, y] = miniWin.getPosition();
    const size = MINI_SIZES[key];
    miniWin.setBounds({ x, y, width: size, height: miniHeight(size) });
  }
  refreshTray();
}

function targetDisplay() {
  const displays = screen.getAllDisplays();
  const saved = displays.find((d) => d.id === settings.fullDisplayId);
  if (saved) return saved;
  const primary = screen.getPrimaryDisplay();
  return displays.find((d) => d.id !== primary.id) || primary;
}

function openFull(display = targetDisplay()) {
  if (fullWin && !fullWin.isDestroyed()) {
    const current = screen.getDisplayMatching(fullWin.getBounds());
    if (current.id === display.id) {
      fullWin.focus();
      return;
    }
    fullWin.destroy();
  }
  const win = new BrowserWindow({
    ...display.bounds,
    frame: false,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0d',
    title: 'Vinilify',
    icon: APP_ICON,
    webPreferences: windowPrefs(),
  });
  fullWin = win;
  win.loadFile(rendererPage, { query: { mode: 'full' } });
  win.webContents.on('did-finish-load', () => win.webContents.send('state', state));
  // Se muestra cuando la página avisa que ya pintó la canción (ver 'renderer:ready'),
  // para no enseñar un vinilo vacío. Por si el aviso no llega, se muestra igual a los 2,5 s.
  setTimeout(() => !win.isDestroyed() && !win.isVisible() && win.show(), 2500);
  // El mini no tiene sentido encima de la pantalla completa en el mismo monitor.
  if (miniWin && !miniWin.isDestroyed() && screen.getDisplayMatching(miniWin.getBounds()).id === display.id) {
    miniWin.hide();
  }
  win.on('closed', () => {
    // Si se reemplazó por otra ventana (cambio de pantalla), esta ya no manda.
    if (fullWin !== win) return;
    fullWin = null;
    if (miniWin && !miniWin.isDestroyed() && !miniWin.isVisible()) miniWin.showInactive();
    if (sleepBlocker !== null) powerSaveBlocker.stop(sleepBlocker);
    sleepBlocker = null;
    refreshTray();
  });
  // Mientras está en pantalla completa, que el monitor no se apague solo.
  if (sleepBlocker === null) sleepBlocker = powerSaveBlocker.start('prevent-display-sleep');
  refreshTray();
}

function closeFull() {
  if (fullWin && !fullWin.isDestroyed()) fullWin.close();
}

function chooseFullDisplay(display) {
  settings.fullDisplayId = display.id;
  saveSettings();
  if (fullWin && !fullWin.isDestroyed()) openFull(display);
  refreshTray();
}

// Ventana con la misma guía que aparece al pulsar "Buscar" sin cuenta (index.html en modo "setup").
function openSetup() {
  if (setupWin && !setupWin.isDestroyed()) {
    setupWin.focus();
    return;
  }
  setupWin = new BrowserWindow({
    width: 700,
    height: 900,
    minWidth: 520,
    minHeight: 500,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0d',
    title: t('setupWindowTitle'),
    icon: APP_ICON,
    webPreferences: windowPrefs(),
  });
  setupWin.loadFile(rendererPage, { query: { mode: 'setup' } });
  setupWin.webContents.on('did-finish-load', () => setupWin.webContents.send('state', state));
  setupWin.on('closed', () => {
    setupWin = null;
  });
}

// Configuración: idioma, cuenta de Spotify (Client ID) e inicio con Windows (index.html en modo "settings").
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 620,
    height: 720,
    minWidth: 480,
    minHeight: 520,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0b0d',
    title: t('settingsWindowTitle'),
    icon: APP_ICON,
    webPreferences: windowPrefs(),
  });
  settingsWin.loadFile(rendererPage, { query: { mode: 'settings' } });
  settingsWin.webContents.on('did-finish-load', () => settingsWin.webContents.send('state', state));
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

// ---------- Bandeja del sistema ----------

// Icono de la app (assets/icon.ico trae varios tamaños; Windows elige el adecuado para la bandeja).
const APP_ICON = path.join(__dirname, '..', 'assets', 'icon.ico');

function buildMenu() {
  const nowPlaying = state.track
    ? `${state.isPlaying ? '▶' : '❚❚'}  ${state.track.name} — ${state.track.artists}`
    : t('nothingPlaying');
  const primary = screen.getPrimaryDisplay();
  const fullTarget = targetDisplay();
  const fullOpen = Boolean(fullWin && !fullWin.isDestroyed());
  const miniOpen = Boolean(miniWin && !miniWin.isDestroyed());

  // La cuenta es opcional: sin ella Vinilify funciona leyendo Spotify desde Windows.
  const account = spotify.loggedIn
    ? [
      { label: t('trayConnected'), enabled: false },
      { label: t('trayDisconnect'), click: logout },
    ]
    : [{ label: t('trayConnect'), click: openSetup }];

  return Menu.buildFromTemplate([
    { label: nowPlaying.length > 60 ? nowPlaying.slice(0, 59) + '…' : nowPlaying, enabled: false },
    { type: 'separator' },
    { label: fullOpen ? t('exitFullscreen') : t('fullscreen'), click: () => (fullOpen ? closeFull() : openFull()) },
    {
      label: t('fullscreenOn'),
      submenu: screen.getAllDisplays().map((d, i) => ({
        label: `${d.label || t('screenN', { n: i + 1 })} (${d.size.width}×${d.size.height})${d.id === primary.id ? ` · ${t('main')}` : ''}`,
        type: 'radio',
        checked: d.id === fullTarget.id,
        click: () => chooseFullDisplay(d),
      })),
    },
    { type: 'separator' },
    { label: t('miniVinyl'), type: 'checkbox', checked: miniOpen, click: () => (miniOpen ? closeMini() : openMini()) },
    {
      label: t('miniSize'),
      submenu: ['small', 'medium', 'large'].map((key) => ({
        label: t(key), type: 'radio', checked: settings.miniSize === key, click: () => setMiniSize(key),
      })),
    },
    { type: 'separator' },
    ...account,
    {
      label: t('startWithWindows'),
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked }),
    },
    { label: t('traySettings'), click: openSettings },
    { type: 'separator' },
    { label: t('quit'), click: () => app.quit() },
  ]);
}

function loginItemOptions() {
  // En desarrollo el ejecutable es electron.exe y necesita la ruta de la app como argumento.
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}

let lastTrayKey = '';
function refreshTray() {
  if (!tray) return;
  const key = JSON.stringify([state.status, state.isPlaying, state.track?.id, settings, Boolean(fullWin), Boolean(miniWin), spotify.loggedIn, spotify.clientId]);
  if (key === lastTrayKey) return;
  lastTrayKey = key;
  tray.setToolTip(state.track ? `Vinilify · ${state.track.name} — ${state.track.artists}` : 'Vinilify');
  tray.setContextMenu(buildMenu());
}

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('state:get', () => state);
  ipcMain.on('renderer:ready', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win && win === fullWin && !win.isVisible()) win.show();
  });
  ipcMain.on('control', (_e, action) => control(action));
  ipcMain.on('seek', (_e, ms) => seek(Number(ms) || 0));
  ipcMain.on('volume', (_e, percent) => setVolume(Number(percent) || 0));
  ipcMain.on('play', (_e, target) => play(target || {}));
  ipcMain.on('queue:add', (_e, uri) => addToQueue(String(uri || '')));
  ipcMain.handle('search', (_e, query) => search(query).catch((err) => ({ error: err.message })));
  ipcMain.handle('search:tracks', (_e, query, offset) => searchTracks(query, offset).catch((err) => ({ error: err.message })));
  ipcMain.handle('artist:tracks', (_e, id, name, offset) => artistTracks(id, name, offset).catch((err) => ({ error: err.message })));
  ipcMain.on('full:open', () => openFull());
  ipcMain.on('full:close', closeFull);
  ipcMain.on('full:to-mini', () => {
    closeFull();
    openMini();
  });
  ipcMain.on('mini:close', closeMini);
  ipcMain.on('menu:show', (e) => buildMenu().popup({ window: BrowserWindow.fromWebContents(e.sender) }));
  ipcMain.on('open-track', () => state.track?.url && shell.openExternal(state.track.url));
  // Sin cuenta no se puede poner una canción concreta; se abre la búsqueda en la app de Spotify.
  ipcMain.on('open-in-spotify', (_e, query) => {
    const q = String(query || '').trim();
    if (q) shell.openExternal(`spotify:search:${encodeURIComponent(q)}`);
  });
  ipcMain.on('clipboard', (_e, text) => clipboard.writeText(String(text || '')));

  ipcMain.on('mini:move', (_e, { x, y }) => {
    if (!miniWin || miniWin.isDestroyed()) return;
    const size = MINI_SIZES[settings.miniSize];
    miniWin.setBounds({ x: Math.round(x), y: Math.round(y), width: size, height: miniHeight(size) });
  });
  ipcMain.on('mini:moved', () => {
    if (!miniWin || miniWin.isDestroyed()) return;
    const [x, y] = miniWin.getPosition();
    settings.miniPosition = { x, y };
    saveSettings();
  });

  ipcMain.on('settings:open', openSettings);
  ipcMain.handle('settings:get', () => ({
    lang: settings.language,
    languages: LANGUAGES,
    clientId: spotify.clientId,
    loggedIn: spotify.loggedIn,
    openAtLogin: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
  }));
  ipcMain.on('settings:language', (_e, lang) => setLanguage(lang));
  ipcMain.on('settings:login-item', (_e, on) => {
    app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: Boolean(on) });
    lastTrayKey = '';
    refreshTray();
  });
  ipcMain.on('account:logout', logout);

  ipcMain.handle('setup:get', () => ({
    clientId: spotify.clientId,
    loggedIn: spotify.loggedIn,
    redirectUri: REDIRECT_URI,
  }));
  ipcMain.handle('setup:connect', (_e, clientId) => {
    const id = String(clientId || '').trim();
    if (!/^[0-9a-f]{32}$/i.test(id)) return { ok: false, error: t('clientIdInvalid') };
    spotify.setClientId(id);
    login();
    return { ok: true };
  });
  ipcMain.on('setup:dashboard', () => shell.openExternal('https://developer.spotify.com/dashboard'));
  ipcMain.on('setup:close', () => setupWin && !setupWin.isDestroyed() && setupWin.close());
}

// ---------- Arranque ----------

app.on('second-instance', () => openFull());
app.on('window-all-closed', () => {
  // App de bandeja: sigue viva aunque no haya ventanas abiertas.
});
app.on('before-quit', () => media.stop());

// `--demo`: datos inventados para ver el diseño sin conectar Spotify.
function demoCover(hue, text) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300">
<defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 70% 55%)"/><stop offset="1" stop-color="hsl(${hue + 40} 60% 22%)"/></linearGradient></defs>
<rect width="300" height="300" fill="url(#g)"/><circle cx="210" cy="90" r="50" fill="hsl(${hue - 30} 80% 70%)" opacity=".7"/>
<text x="24" y="270" font-family="Segoe UI" font-weight="700" font-size="30" fill="white">${text}</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function startDemo() {
  const track = (i, name, artists, hue) => {
    const cover = demoCover(hue, name);
    return { id: `demo${i}`, name, artists, album: 'Álbum de prueba', cover, thumb: cover, url: '' };
  };
  const tracks = [
    track(0, 'Luz de Medianoche', 'Los Surcos', 330),
    track(1, 'Aguja', 'Vinilo Club', 200),
    track(2, 'Lado B', 'Púa', 40),
    track(3, 'Treinta y Tres', 'Revoluciones', 140),
    track(4, 'Funda', 'La Tornamesa', 270),
    track(5, 'Estática', 'Analógico', 10),
  ];
  setState({
    source: 'api', canSeek: true, canLike: true, liked: true, shuffle: true, repeat: 'track',
    lyrics: {
      id: 'demo0',
      lines: ['Gira el disco en la madrugada', 'la aguja cae sobre el surco', 'y la noche se vuelve canción',
        'treinta y tres vueltas por minuto', 'lado A, lado B, otra vez', 'luz de medianoche en el salón']
        .flatMap((text, i) => [{ t: 30000 + i * 7000, text }, { t: 30000 + i * 7000 + 3500, text: `${text} (eco)` }]),
    },
    status: 'playing', isPlaying: true, progressMs: 42000, durationMs: 214000, volume: 65, supportsVolume: true,
    track: tracks[0], queue: tracks.slice(1), recent: tracks.slice(3).reverse(),
  });
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.vinilify.app');
  loadSettings();
  loadHistory();
  spotify = new Spotify(path.join(app.getPath('userData'), 'spotify.json'));
  spotify.t = t; // la página que se abre al autorizar y los errores salen en el idioma elegido
  await spotify.load();
  state.lang = settings.language;
  registerIpc();

  tray = new Tray(APP_ICON);
  // Clic derecho: menú. Doble clic: muestra el mini vinilo.
  tray.on('double-click', () => openMini());
  refreshTray();

  screen.on('display-added', () => { lastTrayKey = ''; refreshTray(); });
  screen.on('display-removed', () => { lastTrayKey = ''; refreshTray(); });

  if (settings.showMini) openMini();
  if (process.argv.includes('--full')) openFull();
  if (process.argv.includes('--demo')) return startDemo();
  startSource();
});
