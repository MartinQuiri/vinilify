const api = window.vinilify;
// full: pantalla completa · mini: vinilo flotante · setup: ventana con la guía para conectar la cuenta.
const mode = ['mini', 'setup'].includes(new URLSearchParams(location.search).get('mode'))
  ? new URLSearchParams(location.search).get('mode')
  : 'full';
const $ = (id) => document.getElementById(id);

const RPM = 100 / 3;
const DEG_PER_MS = (RPM * 360) / 60000;
const ARM_REST = mode === 'mini' ? -17 : -26;
const ARM_START = 0;
const ARM_SWEEP = 16;
// Al arrastrar la línea de tiempo de punta a punta, el disco da 4 vueltas.
const SCRUB_DEG = 4 * 360;

const MESSAGES = {
  loading: ['', '', ''],
  idle: ['En silencio', 'Nada sonando', 'Abre Spotify y pon una canción: el vinilo empezará a girar.'],
};

let state = { status: 'loading' };
let shownTrackId = null;
let backdropIndex = 0;

document.body.classList.add(`mode-${mode}`);

// ---------- Estado ----------

// Llegan solo los campos que cambiaron; se mezclan con lo que ya había.
function applyState(patch) {
  if (!patch) return;
  state = { ...state, ...patch };
  render();
}

api.onState(applyState);
// Por si el primer estado llegó antes de que esta página estuviera escuchando.
api.getState().then(applyState);

// Posición actual: el último dato más lo que avanzó desde entonces.
function elapsedMs() {
  const playing = state.status === 'playing' && state.isPlaying;
  const since = playing && state.progressAt ? Date.now() - state.progressAt : 0;
  return Math.min(state.durationMs || 0, (state.progressMs || 0) + since);
}

function render() {
  const { status, track } = state;
  document.body.dataset.status = status;
  document.body.classList.toggle('is-playing', status === 'playing' && Boolean(state.isPlaying));
  document.body.classList.toggle('no-seek', !state.canSeek);

  if (status === 'playing' && track) {
    $('eyebrow').textContent = state.isPlaying ? 'Sonando ahora' : 'En pausa';
    if (track.id !== shownTrackId) showTrack(track);
    else if (track.cover && $('sleeve-img').getAttribute('src') !== track.cover) {
      // La portada llegó después que el título: se pone sin repetir el fundido.
      $('sleeve-img').src = track.cover;
      $('label-img').src = track.thumb || track.cover;
      setBackdrop(track.cover);
      loadAccent(track);
    }
  } else if (status === 'loading') {
    // Aún no se sabe nada (Vinilify recién arrancando): mejor no mostrar textos que cambiarán enseguida.
  } else {
    const [eyebrow, title, sub] = MESSAGES[status] || MESSAGES.idle;
    $('eyebrow').textContent = eyebrow;
    $('title').textContent = title;
    $('artist').textContent = sub;
    $('album').textContent = '';
    shownTrackId = null;
    signalReady();
  }

  renderVolume();
  renderToggles();
  renderLyricsVisibility();
  if (mode === 'full') {
    renderStrip('next', status === 'playing' ? state.queue : []);
    renderStrip('recent', status === 'logged-out' || status === 'setup' ? [] : state.recent);
  }
}

// La ventana de pantalla completa se mantiene oculta hasta que esto avisa que ya hay algo que mostrar.
let readySent = false;
function signalReady() {
  if (readySent) return;
  readySent = true;
  // Sin requestAnimationFrame: en una ventana oculta no se ejecuta.
  setTimeout(() => api.ready(), 30);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const imageSettled = (img) => (img.complete
  ? Promise.resolve()
  : new Promise((r) => {
    img.addEventListener('load', r, { once: true });
    img.addEventListener('error', r, { once: true });
  }));

// Sin portada se quita el atributo (un src vacío deja el icono de imagen rota).
function setImage(img, url) {
  if (url) img.src = url;
  else img.removeAttribute('src');
}

let hasShownTrack = false;
// Aleatorio, repetir y Me gusta. Se esconden si la fuente no los informa.
function renderToggles() {
  const shuffle = $('btn-shuffle');
  shuffle.hidden = state.shuffle == null;
  shuffle.classList.toggle('on', Boolean(state.shuffle));
  shuffle.title = state.shuffle ? 'Aleatorio: activado' : 'Aleatorio';

  const repeat = $('btn-repeat');
  repeat.hidden = state.repeat == null;
  repeat.classList.toggle('on', state.repeat === 'context' || state.repeat === 'track');
  repeat.classList.toggle('one', state.repeat === 'track');
  repeat.title = { context: 'Repetir: toda la lista', track: 'Repetir: esta canción' }[state.repeat] || 'Repetir';

  // Sin cuenta el corazón se muestra igual: al pulsarlo aparece la guía para conectarla.
  const like = $('btn-like');
  like.classList.toggle('on', Boolean(state.liked));
  like.title = state.liked ? 'Quitar de Me gusta' : 'Me gusta';
}

// ---------- Letra sincronizada ----------

// Oculta por defecto; se recuerda si el usuario la activa.
let lyricsOn = false;
try {
  lyricsOn = localStorage.getItem('vinilify.lyrics') === 'on';
} catch {
  // Sin almacenamiento: se queda oculta.
}
let lyricIndex = -2;

function currentLyrics() {
  const l = state.lyrics;
  return l && l.id === state.track?.id && l.lines?.length ? l.lines : null;
}

function renderLyricsVisibility() {
  const lines = currentLyrics();
  $('lyrics').hidden = !(lyricsOn && lines && state.status === 'playing');
  $('btn-lyrics').classList.toggle('on', lyricsOn);
  $('btn-lyrics').title = lyricsOn ? 'Ocultar la letra' : 'Mostrar la letra';
  $('btn-lyrics').hidden = !lines || state.status !== 'playing';
}

// Se llama varias veces por segundo: solo toca el DOM cuando cambia la línea.
function updateLyrics(elapsed) {
  const lines = currentLyrics();
  if (!lines || $('lyrics').hidden) return;
  // Un poco de adelanto para que la línea aparezca justo cuando empieza a cantarse.
  const t = elapsed + 250;
  let i = -1;
  while (i + 1 < lines.length && lines[i + 1].t <= t) i++;
  if (i === lyricIndex) return;
  lyricIndex = i;
  const text = (k) => (lines[k]?.text ?? '') || (k >= 0 && k < lines.length ? '♪' : '');
  const box = $('lyrics');
  box.classList.remove('step');
  void box.offsetWidth; // reinicia la animación de entrada
  box.classList.add('step');
  box.querySelector('[data-pos="prev"]').textContent = text(i - 1);
  box.querySelector('[data-pos="cur"]').textContent = i < 0 ? '♪' : text(i);
  box.querySelector('[data-pos="next"]').textContent = text(i + 1);
}

function showTrack(track) {
  lyricIndex = -2;
  shownTrackId = track.id;
  const apply = () => {
    setImage($('sleeve-img'), track.cover);
    setImage($('label-img'), track.thumb || track.cover);
    $('title').textContent = track.name;
    $('artist').textContent = track.artists;
    $('album').textContent = track.album;
    setBackdrop(track.cover);
    return loadAccent(track);
  };

  // La primera canción se pone al instante (sin el fundido de cambio) y se espera a que carguen
  // las portadas antes de mostrar la ventana.
  if (!hasShownTrack) {
    hasShownTrack = true;
    const accent = apply();
    const images = Promise.all([imageSettled($('sleeve-img')), imageSettled($('label-img')), accent]);
    Promise.race([images, delay(1500)]).then(signalReady);
    return;
  }

  document.body.classList.add('swapping');
  setTimeout(() => {
    if (shownTrackId !== track.id) return;
    apply();
    document.body.classList.remove('swapping');
  }, 380);
}

function loadAccent(track) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const accent = accentFrom(img);
      if (accent && shownTrackId === track.id) document.documentElement.style.setProperty('--accent', accent);
      resolve();
    };
    img.onerror = resolve;
    img.src = track.thumb || track.cover;
  });
}

function setBackdrop(url) {
  if (mode !== 'full' || !url) return;
  const layers = document.querySelectorAll('.bd');
  backdropIndex = 1 - backdropIndex;
  layers[backdropIndex].style.backgroundImage = `url("${url}")`;
  layers[backdropIndex].classList.add('on');
  layers[1 - backdropIndex].classList.remove('on');
}

// Color dominante de la portada, ponderado por saturación y llevado a una luminosidad legible.
function accentFrom(img) {
  try {
    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    let r = 0, g = 0, b = 0, total = 0;
    for (let i = 0; i < px.length; i += 4) {
      const max = Math.max(px[i], px[i + 1], px[i + 2]);
      const min = Math.min(px[i], px[i + 1], px[i + 2]);
      const w = ((max - min) / 255) ** 2 * (max / 255) + 0.002;
      r += px[i] * w;
      g += px[i + 1] * w;
      b += px[i + 2] * w;
      total += w;
    }
    const [h, s] = rgbToHsl(r / total, g / total, b / total);
    return `hsl(${Math.round(h)} ${Math.round(Math.max(s, 0.35) * 100)}% 62%)`;
  } catch {
    return null;
  }
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderStrip(name, tracks = []) {
  const list = $(name);
  const key = tracks.map((t) => t.id).join('|');
  $(`${name}-group`).hidden = tracks.length === 0;
  if (list.dataset.key === key) return;
  list.dataset.key = key;
  list.replaceChildren(...tracks.map((t, i) => {
    const li = el('li');
    li.style.setProperty('--i', i);
    li.dataset.id = t.id;
    if (t.uri) li.dataset.uri = t.uri;
    // Las de la cola se tocan dentro del contexto actual (álbum/playlist); las recientes, en el suyo.
    if (name === 'recent' && t.contextUri) li.dataset.context = t.contextUri;
    li.dataset.query = `${t.name} ${t.artists}`;
    li.title = t.uri ? `Reproducir «${t.name}»` : `Buscar «${t.name}» en Spotify`;
    const img = el('img');
    img.src = t.thumb || t.cover;
    img.alt = '';
    li.append(img, el('span', 'name', t.name), el('span', 'by', t.artists));
    return li;
  }));
}

for (const name of ['next', 'recent']) {
  $(name).addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    // Sin cuenta no hay forma de poner una canción concreta: se abre su búsqueda en la app de Spotify.
    if (!li.dataset.uri) return api.openInSpotify(li.dataset.query);
    api.play(li.dataset.uri, name === 'next' ? state.contextUri : li.dataset.context);
  });
}

// ---------- Volumen ----------

const volume = $('volume');
let volumeTouchedAt = 0;
let volumeBeforeMute = 50;

function paintVolume(v) {
  v = Number(v);
  volume.value = v;
  volume.style.setProperty('--val', `${v}%`);
  $('volume-value').textContent = v;
  // El icono cambia: dos ondas, una onda o tachado.
  document.body.classList.toggle('vol-mute', v === 0);
  document.body.classList.toggle('vol-low', v > 0 && v < 50);
}

function renderVolume() {
  const available = state.status === 'playing' && state.supportsVolume && state.volume != null;
  $('volume-row').hidden = !available;
  // Mientras el usuario mueve la barra no la pisamos con lo que llega de Spotify.
  if (available && performance.now() - volumeTouchedAt > 1500) paintVolume(state.volume);
}

function changeVolume(v) {
  volumeTouchedAt = performance.now();
  paintVolume(v);
  api.setVolume(v);
}

volume.addEventListener('input', () => changeVolume(Number(volume.value)));

// Mientras se arrastra, la barra queda desplegada aunque el mouse se salga de la zona.
const volumeRow = $('volume-row');
let collapseTimer;
volume.addEventListener('pointerdown', () => {
  clearTimeout(collapseTimer);
  volumeRow.classList.add('active');
});
document.addEventListener('pointerup', () => {
  if (!volumeRow.classList.contains('active')) return;
  collapseTimer = setTimeout(() => volumeRow.classList.remove('active'), 700);
});
// La rueda del mouse sobre el volumen también lo cambia.
volumeRow.addEventListener('wheel', (e) => {
  e.preventDefault();
  changeVolume(Math.max(0, Math.min(100, Number(volume.value) + (e.deltaY < 0 ? 5 : -5))));
}, { passive: false });

// ---------- Giro del disco, brazo y línea de tiempo ----------

const disc = $('disc');
let angle = 0;
let speed = 0;
let lastFrame = performance.now();
let scrubbing = null;

function frame(now) {
  const dt = Math.min(now - lastFrame, 100);
  lastFrame = now;
  const playing = document.body.classList.contains('is-playing') && !scrubbing;
  // Arranca y frena con inercia, como un plato de verdad.
  const target = playing ? DEG_PER_MS : 0;
  speed += (target - speed) * Math.min(1, dt / (playing ? 700 : 450));
  if (speed < 1e-5) speed = 0;
  angle = (angle + speed * dt) % 360;
  disc.style.transform = `rotate(${angle}deg)`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function fmt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function showProgress(p, playing) {
  const duration = state.durationMs || 0;
  $('bar').style.width = `${p * 100}%`;
  $('knob').style.left = `${p * 100}%`;
  $('elapsed').textContent = fmt(p * duration);
  $('duration').textContent = fmt(duration);
  const arm = playing ? ARM_START + p * ARM_SWEEP : ARM_REST;
  document.documentElement.style.setProperty('--arm', `${arm}deg`);
}

setInterval(() => {
  if (scrubbing) return;
  const playing = state.status === 'playing' && state.isPlaying;
  const duration = state.durationMs || 0;
  const elapsed = elapsedMs();
  showProgress(duration ? elapsed / duration : 0, playing);
  updateLyrics(elapsed);
}, 200);

const scrub = $('scrub');
const fractionAt = (e) => {
  const r = scrub.getBoundingClientRect();
  return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
};

scrub.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || state.status !== 'playing' || !state.durationMs || !state.canSeek) return;
  e.stopPropagation();
  scrub.setPointerCapture(e.pointerId);
  const p = fractionAt(e);
  scrubbing = { p };
  document.body.classList.add('scrubbing');
  showProgress(p, true);
});
scrub.addEventListener('pointermove', (e) => {
  if (!scrubbing) return;
  const p = fractionAt(e);
  // El disco gira hacia adelante o hacia atrás siguiendo el arrastre, como al mover el plato con la mano.
  angle = (angle + (p - scrubbing.p) * SCRUB_DEG) % 360;
  disc.style.transform = `rotate(${angle}deg)`;
  scrubbing.p = p;
  showProgress(p, true);
});
const endScrub = () => {
  if (!scrubbing) return;
  const ms = scrubbing.p * state.durationMs;
  scrubbing = null;
  document.body.classList.remove('scrubbing');
  state = { ...state, progressMs: ms, progressAt: Date.now() };
  api.seek(ms);
};
scrub.addEventListener('pointerup', endScrub);
scrub.addEventListener('pointercancel', endScrub);

// ---------- Buscador ----------

let searchSeq = 0;
let searchTimer = null;
const searchPanel = $('search');
const searchInput = $('search-input');

function openSearch() {
  if (mode !== 'full') return;
  // El buscador necesita la API de Spotify: sin cuenta se muestra la guía para conectarla.
  if (state.source !== 'api') return openConnect();
  searchPanel.hidden = false;
  document.body.classList.add('searching');
  searchInput.focus();
  searchInput.select();
}

function closeSearch() {
  searchPanel.hidden = true;
  document.body.classList.remove('searching');
}

function hint(text) {
  $('results').replaceChildren(el('p', 'hint', text));
}

// Últimos resultados, para volver a ellos desde la vista de un artista.
let lastQuery = '';
let lastResults = null;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (!q) {
    searchSeq++;
    lastResults = null;
    return hint('Escribe para buscar en Spotify. Haz clic en un resultado para que suene.');
  }
  searchTimer = setTimeout(async () => {
    const seq = ++searchSeq;
    const results = await api.search(q);
    if (seq !== searchSeq) return;
    lastQuery = q;
    lastResults = results;
    renderResults(results);
  }, 300);
});

function trackRow(t) {
  const row = el('button', `row${t.id === state.track?.id ? ' current' : ''}`);
  row.dataset.uri = t.uri;
  if (t.albumUri) row.dataset.context = t.albumUri;
  const img = el('img');
  if (t.thumb) img.src = t.thumb;
  img.alt = '';
  const text = el('span', 'text');
  text.append(el('span', 'name', t.name), el('span', 'sub', t.artists));
  // "+" aparece al pasar el mouse: agrega la canción a la cola sin cortar la que suena.
  const add = el('span', 'add-queue');
  add.dataset.add = t.uri;
  add.title = 'Agregar a la cola';
  add.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 6h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm14-1v-3h2v3h3v2h-3v3h-2v-3h-3v-2z"/></svg>';
  row.append(img, text, add, el('span', 'time', fmt(t.durationMs)));
  return row;
}

// Lista de canciones con "Ver más". `loadPage(offset)` trae la página siguiente
// ({ tracks, nextOffset, hasMore }); `first` es la primera, ya cargada.
function pagedTracks(loadPage, first) {
  const box = el('div', 'track-list');
  const more = el('button', 'more', 'Ver más canciones');
  const seen = new Set();
  let offset = 0;
  const append = (page) => {
    offset = page.nextOffset;
    // Spotify repite canciones entre páginas y tiene la misma canción como single y en el álbum:
    // se muestran una sola vez (misma canción = mismo nombre y mismos artistas).
    // Se compara sin tildes, mayúsculas ni símbolos: Spotify no siempre codifica igual las letras.
    const simplify = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const keyOf = (t) => `${simplify(t.name)}|${simplify(t.artists)}`;
    const fresh = page.tracks.filter((t) => {
      const key = keyOf(t);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    more.before(...fresh.map(trackRow));
    more.hidden = !page.hasMore;
  };
  box.append(more);
  append(first);

  more.addEventListener('click', async () => {
    more.disabled = true;
    more.textContent = 'Cargando…';
    const page = await loadPage(offset);
    more.disabled = false;
    if (!page || page.error) {
      more.textContent = 'No se pudo cargar. Reintentar';
      return;
    }
    more.textContent = 'Ver más canciones';
    append(page);
  });
  return box;
}

function renderResults(r) {
  if (!r) return hint('Conecta Spotify para buscar.');
  if (r.error) return hint(r.error);
  const parts = [];
  if (r.tracks.length) {
    const query = lastQuery;
    const first = { tracks: r.tracks, nextOffset: r.tracks.length, hasMore: r.tracksHasMore };
    parts.push(el('h4', null, 'Canciones'), pagedTracks((offset) => api.searchTracks(query, offset), first));
  }
  const tileGroup = (title, items, kind) => {
    if (!items.length) return;
    parts.push(el('h4', null, title));
    const grid = el('div', 'tiles');
    for (const item of items) {
      // div y no button: Chromium centra el contenido de los botones y el texto largo se desborda por ambos lados.
      const tile = el('div', `tile${kind === 'artist' ? ' round' : ''}`);
      tile.setAttribute('role', 'button');
      tile.tabIndex = 0;
      tile.dataset.uri = item.uri;
      tile.dataset.kind = kind;
      tile.dataset.name = item.name;
      if (item.image) tile.dataset.image = item.image;
      tile.title = kind === 'artist' ? `Ver canciones de ${item.name}` : `Reproducir «${item.name}»`;
      const img = el('img');
      if (item.image) img.src = item.image;
      img.alt = '';
      tile.append(img, el('span', 'name', item.name), el('span', 'sub', item.sub));
      grid.append(tile);
    }
    parts.push(grid);
  };
  tileGroup('Artistas', r.artists, 'artist');
  tileGroup('Álbumes', r.albums, 'album');
  tileGroup('Playlists', r.playlists, 'playlist');
  if (!parts.length) return hint('Sin resultados.');
  $('results').replaceChildren(...parts);
  $('results').scrollTop = 0;
}

// Vista de un artista: cabecera con su foto y botón para reproducirlo, y sus canciones por páginas.
async function openArtist({ uri, name, image }) {
  const seq = ++searchSeq;
  const back = el('button', 'back', '← Volver a los resultados');
  back.dataset.nav = 'back';

  const head = el('div', 'artist-head');
  const img = el('img');
  if (image) img.src = image;
  img.alt = '';
  const info = el('div', 'artist-info');
  info.append(el('span', 'sub', 'Artista'), el('h3', null, name));
  const playAll = el('button', 'play-artist');
  playAll.dataset.uri = uri;
  playAll.title = `Reproducir ${name}`;
  playAll.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15L20 12z"/></svg><span>Reproducir</span>';
  head.append(img, info, playAll);

  const results = $('results');
  results.replaceChildren(back, head, el('p', 'hint', 'Cargando canciones…'));
  results.scrollTop = 0;

  const artistId = uri.split(':').pop();
  const loadPage = (offset) => api.artistTracks(artistId, name, offset);
  const page = await loadPage(0);
  if (seq !== searchSeq) return;
  if (!page || page.error || !page.tracks.length) {
    results.replaceChildren(back, head, el('p', 'hint', page?.error || 'No se encontraron canciones.'));
    return;
  }
  results.replaceChildren(back, head, el('h4', null, 'Canciones'), pagedTracks(loadPage, page));
}

$('results').addEventListener('click', (e) => {
  if (e.target.closest('[data-nav="back"]')) {
    searchSeq++;
    return renderResults(lastResults);
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    add.classList.add('done');
    return api.addToQueue(add.dataset.add);
  }
  const item = e.target.closest('[data-uri]');
  if (!item) return;
  if (item.dataset.kind === 'artist') {
    return openArtist({ uri: item.dataset.uri, name: item.dataset.name, image: item.dataset.image });
  }
  api.play(item.dataset.uri, item.dataset.context);
});
$('results').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.tile')) e.target.click();
});

// ---------- Guía para conectar la API de Spotify ----------

const connectModal = $('connect');
const connectInput = $('connect-id');

function connectStatus(text, kind = '') {
  $('connect-status').textContent = text;
  $('connect-status').className = `connect-status ${kind}`;
}

const CONNECT_TITLES = {
  search: 'Para buscar necesitas tu propia API de Spotify',
  like: 'Para «Me gusta» necesitas tu propia API de Spotify',
  setup: 'Conecta tu cuenta de Spotify',
};

let connectReason = 'setup';
function openConnect(reason = 'search') {
  connectReason = reason;
  $('connect-title').textContent = CONNECT_TITLES[reason] || CONNECT_TITLES.setup;
  connectModal.hidden = false;
  document.body.classList.add('modal-open');
  connectStatus('');
  $('connect-submit').disabled = false;
  api.setup.get().then(({ clientId, redirectUri }) => {
    $('connect-redirect').textContent = redirectUri;
    if (clientId && !connectInput.value) connectInput.value = clientId;
  });
}

function closeConnect() {
  // En la ventana de configuración la guía es todo el contenido: cerrarla cierra la ventana.
  if (mode === 'setup') return api.setup.close();
  connectModal.hidden = true;
  document.body.classList.remove('modal-open');
}

// Clic fuera de la tarjeta la cierra.
connectModal.addEventListener('click', (e) => {
  if (e.target === connectModal) closeConnect();
});

connectModal.querySelectorAll('[data-copy], [data-copy-from]').forEach((btn) => {
  btn.addEventListener('click', () => {
    api.copy(btn.dataset.copy ?? $(btn.dataset.copyFrom).textContent);
    btn.textContent = '¡Copiado!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copiar';
      btn.classList.remove('copied');
    }, 1400);
  });
});

$('connect-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await api.setup.connect(connectInput.value);
  if (!result.ok) return connectStatus(result.error, 'error');
  $('connect-submit').disabled = true;
  connectStatus('Se abrió el navegador: pulsa «Aceptar» para autorizar a Vinilify…');
});

api.setup.onDone(() => {
  if (connectModal.hidden) return;
  connectStatus('¡Listo! Cuenta conectada.', 'ok');
  state = { ...state, source: 'api' };
  setTimeout(() => {
    closeConnect();
    if (mode === 'full' && connectReason === 'search') openSearch();
  }, 1200);
});

api.setup.onError((message) => {
  if (connectModal.hidden) return;
  $('connect-submit').disabled = false;
  connectStatus(message, 'error');
});

// ---------- Modo protección de pantalla ----------
// Para dejar Vinilify en una segunda pantalla: atenúa, deja solo el vinilo, el título, el artista y la
// línea de tiempo, y lo mueve muy lentamente para que nada quede fijo en el mismo píxel.
// Se activa con su botón o solo, tras 5 minutos sin pasar el mouse por la ventana.

const PROTECT_AFTER_MS = 5 * 60 * 1000;
let protectManual = false;
let protectAuto = false;
let protectTimer;

function applyProtect() {
  const on = protectManual || protectAuto;
  document.body.classList.toggle('protect', on);
  $('btn-protect').classList.toggle('on', on);
  $('btn-protect').title = on ? 'Salir del modo protección' : 'Modo protección de pantalla';
  if (on) closeSearch();
}

function toggleProtect() {
  const on = protectManual || protectAuto;
  protectManual = !on;
  protectAuto = false;
  applyProtect();
}

// Cada movimiento del mouse sobre la ventana reinicia la cuenta y saca del modo automático
// (el modo activado con el botón se queda hasta volver a pulsarlo).
function armAutoProtect() {
  clearTimeout(protectTimer);
  if (protectAuto) {
    protectAuto = false;
    applyProtect();
  }
  protectTimer = setTimeout(() => {
    const busy = ['searching', 'modal-open'].some((c) => document.body.classList.contains(c));
    if (busy) return armAutoProtect();
    protectAuto = true;
    applyProtect();
  }, PROTECT_AFTER_MS);
}

// ---------- Botones y atajos ----------

const actions = {
  expand: () => api.openFull(),
  close: () => (mode === 'mini' ? api.closeMini() : api.closeFull()),
  'to-mini': () => api.toMini(),
  search: openSearch,
  'search-close': closeSearch,
  'connect-close': closeConnect,
  'open-dashboard': () => api.setup.openDashboard(),
  like: () => (state.source === 'api' ? api.control('like') : openConnect('like')),
  protect: toggleProtect,
  lyrics: () => {
    lyricsOn = !lyricsOn;
    try {
      localStorage.setItem('vinilify.lyrics', lyricsOn ? 'on' : 'off');
    } catch {
      // Sin almacenamiento: vale solo para esta sesión.
    }
    lyricIndex = -2;
    renderLyricsVisibility();
  },
  mute: () => {
    const current = Number(volume.value);
    if (current > 0) {
      volumeBeforeMute = current;
      changeVolume(0);
    } else {
      changeVolume(volumeBeforeMute || 50);
    }
  },
};

document.querySelectorAll('[data-action]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    (actions[action] || (() => api.control(action)))();
  });
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (mode !== 'setup') api.showMenu();
});

let toastTimer;
api.onToast((message) => {
  const node = $('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3500);
});

if (mode === 'mini') {
  // Arrastre manual: las regiones "drag" de Windows se comen el hover y los clics.
  let drag = null;
  document.addEventListener('mouseenter', () => document.body.classList.add('awake'));
  document.addEventListener('mouseleave', () => {
    if (!drag) document.body.classList.remove('awake');
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button, input')) return;
    drag = { dx: e.screenX - window.screenX, dy: e.screenY - window.screenY, moved: false };
    document.body.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.moved = true;
    document.body.classList.add('dragging');
    api.moveMini(e.screenX - drag.dx, e.screenY - drag.dy);
  });
  document.addEventListener('pointerup', () => {
    if (drag?.moved) api.miniMoved();
    drag = null;
    document.body.classList.remove('dragging');
  });
  document.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button, input')) api.openFull();
  });
} else if (mode === 'setup') {
  openConnect('setup');
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeConnect();
  });
} else {
  // Pantalla completa: los controles y el cursor se esconden solos (salvo con el buscador abierto).
  let sleepTimer;
  const wake = () => {
    document.body.classList.add('awake');
    document.body.classList.remove('sleepy');
    clearTimeout(sleepTimer);
    sleepTimer = setTimeout(() => {
      const busy = ['searching', 'modal-open'].some((c) => document.body.classList.contains(c));
      if (busy || scrubbing) return wake();
      document.body.classList.remove('awake');
      document.body.classList.add('sleepy');
    }, 2500);
  };
  document.addEventListener('mousemove', () => {
    wake();
    armAutoProtect();
  });
  wake();
  armAutoProtect();

  $('title').addEventListener('click', () => state.status === 'playing' && api.openTrack());

  document.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input');
    if (e.key === 'Escape') {
      if (!connectModal.hidden) return closeConnect();
      if (!searchPanel.hidden) return closeSearch();
      return api.closeFull();
    }
    if ((e.ctrlKey && e.key.toLowerCase() === 'f') || (!typing && e.key === '/')) {
      e.preventDefault();
      return openSearch();
    }
    if (typing) return;
    if (e.key === ' ') {
      // Evita que el espacio además "pulse" el botón que tenga el foco.
      e.preventDefault();
      api.control('toggle');
    }
    else if (e.key === 'ArrowRight') api.control('next');
    else if (e.key === 'ArrowLeft') api.control('previous');
    else if (e.key.toLowerCase() === 'p') toggleProtect();
    else if (e.key.toLowerCase() === 'l') actions.lyrics();
  });
}
