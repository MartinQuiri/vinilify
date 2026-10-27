// Vinilify recreado en React con su CSS real (app.css sale de src/renderer/style.css).
// Mismo DOM que src/renderer/index.html; el estado (giro, brazo, progreso, hover…) lo decide cada cuadro del video.
// Cada parte se puede mover por separado (`fx`) o mostrar sola (`only`), para armar la app pieza por pieza.
import { Img, staticFile } from 'remotion';
import type { CSSProperties, ReactNode } from 'react';
import './app.css';

export type Track = { name: string; artists: string; album?: string; cover: string; durationMs?: number };

export type Piece =
  | 'backdrop' | 'sleeve' | 'disc' | 'sheen' | 'arm' | 'record' | 'info' | 'eyebrow' | 'title' | 'artist' | 'album'
  | 'progress' | 'tools' | 'volume' | 'lyrics-btn' | 'lyrics' | 'strip' | 'recent' | 'next' | 'controls' | 'corner'
  | 'shuffle' | 'previous' | 'play' | 'nextBtn' | 'repeat' | 'sep' | 'like' | 'searchBtn' | 'protect' | 'toMini'
  | 'settings' | 'expand' | 'close' | 'search' | 'modal' | 'settingsView' | 'toast' | 'dim';

export type SearchView =
  | { kind: 'hint'; query: string }
  | { kind: 'results'; query: string; tracks: Row[]; artists: Tile[]; albums: Tile[] }
  | { kind: 'artist'; query: string; name: string; image: string; tracks: Row[] };
export type Row = { name: string; artists: string; thumb: string; durationMs: number };
export type Tile = { name: string; sub: string; image: string };

export type AppProps = {
  mode?: 'full' | 'mini' | 'settings';
  width?: number; // tamaño de la "ventana" en px CSS
  height?: number;
  track: Track;
  accent: string;
  playing?: boolean;
  progress?: number; // 0–1
  angle?: number; // giro del disco
  arm?: number; // grados del brazo
  awake?: boolean;
  protect?: boolean;
  dim?: number; // 0–1 del velo oscuro del modo protección
  scrubbing?: boolean;
  shuffle?: boolean;
  repeat?: 'off' | 'context' | 'track';
  liked?: boolean;
  volume?: number;
  lyrics?: { on: boolean; prev: string; cur: string; next: string } | null;
  recent?: Track[];
  upNext?: Track[];
  search?: SearchView | null;
  connect?: boolean;
  settings?: { lang: 'en' | 'es'; clientId: string; connected: boolean; loginItem: boolean } | null;
  toast?: string | null;
  hover?: string[]; // claves: 'like', 'play', 'scrub', 'volume', 'lyrics-btn', 'row-2', 'add-2', 'tile-0', 'next-1', 'more', 'es'…
  fx?: Partial<Record<Piece | string, CSSProperties>>;
  only?: Array<Piece | string> | null; // si se da, solo esas partes quedan visibles
  backdropOn?: [number, number]; // opacidad de las dos capas del fondo
  backdropCovers?: [string, string];
  style?: CSSProperties;
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const cover = (name: string) => (name.startsWith('http') ? name : staticFile(name));

const ICONS = {
  shuffle: 'M10.6 9.2 5.4 4 4 5.4l5.2 5.2zM14.5 4l2 2L4 18.6 5.4 20 18 7.5l2 2V4zm.3 9.4-1.4 1.4 3.1 3.1-2 2.1H20v-5.5l-2 2z',
  previous: 'M6 5h2v14H6zM20 5v14L9 12z',
  play: 'M7 4.5v15L20 12z',
  pause: 'M6 4h4.5v16H6zM13.5 4H18v16h-4.5z',
  next: 'M16 5h2v14h-2zM4 5v14l11-7z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z',
  repeatOne: 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zm-4-2V9h-1l-2 1v1h1.5v4z',
  heart: 'M16.5 3c-1.7 0-3.4.8-4.5 2.1C10.9 3.8 9.2 3 7.5 3 4.4 3 2 5.4 2 8.5c0 3.8 3.4 6.9 8.6 11.5l1.4 1.3 1.4-1.3C18.6 15.4 22 12.3 22 8.5 22 5.4 19.6 3 16.5 3zm-4.4 15.6-.1.1-.1-.1C7.1 14.2 4 11.4 4 8.5 4 6.5 5.5 5 7.5 5c1.5 0 3 1 3.6 2.4h1.9C13.5 6 15 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.9-3.1 5.7-7.9 10.1z',
  heartOn: 'm12 21.3-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z',
  search: 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
  moon: 'M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4a5.4 5.4 0 0 1-4.4 2.3 5.4 5.4 0 0 1-3.1-9.8L12 3z',
  toMini: 'M3 5h18v8h-2V7H5v10h6v2H3zM13 15h8v6h-8z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  expand: 'M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z',
  close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z',
  lyrics: 'M4 5h16v2H4zm0 4h11v2H4zm0 4h16v2H4zm0 4h9v2H4z',
  queue: 'M3 6h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm14-1v-3h2v3h3v2h-3v3h-2v-3h-3v-2z',
  open: 'M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14zM5 6h6v2H6v10h10v-5h2v7H4V6z',
};
const Icon = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}><path d={d} /></svg>
);

export function Tonearm() {
  return (
    <>
      <defs>
        <linearGradient id="cyl" x1="0" x2="1">
          <stop offset="0" stopColor="#4a4a50" /><stop offset=".38" stopColor="#d8d8dc" /><stop offset=".5" stopColor="#ffffff" />
          <stop offset=".62" stopColor="#c4c4c9" /><stop offset="1" stopColor="#55555b" />
        </linearGradient>
        <radialGradient id="hub" cx=".35" cy=".3" r=".85">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".45" stopColor="#c2c2c7" /><stop offset="1" stopColor="#5e5e64" />
        </radialGradient>
        <radialGradient id="plinth" cx=".4" cy=".3" r=".9">
          <stop offset="0" stopColor="#303036" /><stop offset="1" stopColor="#121215" />
        </radialGradient>
        <linearGradient id="shell" x1="0" x2="1">
          <stop offset="0" stopColor="#f0f0f2" /><stop offset=".55" stopColor="#b4b4ba" /><stop offset="1" stopColor="#76767c" />
        </linearGradient>
      </defs>
    </>
  );
}

function ArmShape() {
  return (
    <>
      <g transform="rotate(14 100 6)">
        <rect x="98.7" y="-2" width="2.6" height="5" fill="#6a6a70" />
        <rect x="95.6" y="-12" width="8.8" height="10.4" rx="1.4" fill="url(#cyl)" />
        <rect x="95.6" y="-12" width="8.8" height="1.6" rx=".8" fill="#2a2a2f" />
        <path d="M95.6 -7.6h8.8M95.6 -5.6h8.8" stroke="rgba(0,0,0,.3)" strokeWidth=".3" />
      </g>
      <path d="M100 6 L86.2 64.5 Q85 70.5 81.6 75.4" fill="none" stroke="#5f5f66" strokeWidth="2.3" strokeLinecap="round" />
      <path d="M100 6 L86.2 64.5 Q85 70.5 81.6 75.4" fill="none" stroke="#c9c9ce" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M100 6 L86.2 64.5 Q85 70.5 81.6 75.4" fill="none" stroke="#ffffff" strokeWidth=".45" strokeLinecap="round" opacity=".85" />
      <g transform="rotate(36 80.6 78)">
        <path d="M83.7 76.6 q3.4 .3 4.1 3" fill="none" stroke="#a8a8ae" strokeWidth=".8" strokeLinecap="round" />
        <path d="M77.2 74.4 h6.8 l-.5 5.4 h-5.8 z" fill="url(#shell)" stroke="#4e4e54" strokeWidth=".3" />
        <rect x="77.9" y="79.6" width="5.4" height="4.4" rx=".5" fill="#151518" stroke="#2c2c31" strokeWidth=".3" />
        <rect x="77.9" y="81" width="5.4" height=".8" fill="var(--accent)" />
        <circle cx="78.9" cy="77" r=".45" fill="#3a3a40" />
        <circle cx="82.3" cy="77" r=".45" fill="#3a3a40" />
        <path d="M80.6 84 v1.4" stroke="#e8e8ea" strokeWidth=".35" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="6" r="4.8" fill="#1b1b1f" stroke="#45454b" strokeWidth=".4" />
      <circle cx="100" cy="6" r="3.4" fill="url(#hub)" />
      <circle cx="100" cy="6" r=".9" fill="#38383e" />
    </>
  );
}

export function App(props: AppProps) {
  const {
    mode = 'full', track, accent, playing = true, progress = 0.3, angle = 0, arm, awake = false, protect = false, dim,
    scrubbing = false, shuffle = false, repeat = 'off', liked = false, volume = 62, lyrics = null, recent = [], upNext = [],
    search = null, connect = false, settings = null, toast = null, hover = [], fx = {}, only = null, style,
  } = props;
  const width = props.width ?? (mode === 'mini' ? 280 : 1920);
  const height = props.height ?? (mode === 'mini' ? 370 : 1080);
  const vw = width / 100;
  const vh = height / 100;
  const h = (k: string) => (hover.includes(k) ? ' hover' : '');
  // Con `only`, la raíz queda oculta y cada parte elegida se vuelve visible (visibility se hereda y se puede reactivar).
  const piece = (k: string, extra?: CSSProperties): CSSProperties => {
    const own = fx[k];
    // Si la parte ya tiene su propio transform (el giro del disco), el de `fx` se le suma por fuera.
    const transform = own?.transform && extra?.transform ? `${own.transform} ${extra.transform}` : undefined;
    return {
      ...(only ? { visibility: only.includes(k) ? 'visible' : undefined } : {}),
      ...extra,
      ...own,
      ...(transform ? { transform } : {}),
    };
  };
  const duration = track.durationMs ?? 149000;
  const armDeg = arm ?? (playing ? progress * 16 : mode === 'mini' ? -17 : -26);
  const cls = [
    'vf', `mode-${mode}`, playing ? 'is-playing' : '', awake ? 'awake' : '', protect ? 'protect' : '', search ? 'searching' : '',
    scrubbing ? 'scrubbing' : '', volume === 0 ? 'vol-mute' : volume < 50 ? 'vol-low' : '', connect ? 'modal-open' : '',
  ].filter(Boolean).join(' ');
  const [bdA, bdB] = props.backdropOn ?? [1, 0];
  const [coverA, coverB] = props.backdropCovers ?? [track.cover, track.cover];
  const eq = (i: number) => (playing ? 25 + 75 * Math.abs(Math.sin(angle * 0.09 + i * 1.1)) : 30);

  return (
    <div
      className={cls}
      data-status="playing"
      style={{
        width, height, ['--vw' as string]: `${vw}px`, ['--vh' as string]: `${vh}px`, ['--vmin' as string]: `${Math.min(vw, vh)}px`,
        ['--accent' as string]: accent, ['--arm' as string]: `${armDeg}deg`, ...(only ? { visibility: 'hidden' } : {}), ...style,
        ...(mode === 'settings' ? { overflow: 'hidden' } : {}),
      }}
    >
      {mode === 'settings' && settings ? (
        <SettingsView settings={settings} h={h} piece={piece} />
      ) : (
        <>
          <div className="backdrop" style={piece('backdrop')}>
            <div className={`bd${bdA ? ' on' : ''}`} style={{ backgroundImage: `url(${cover(coverA)})`, opacity: bdA }} />
            <div className={`bd${bdB ? ' on' : ''}`} style={{ backgroundImage: `url(${cover(coverB)})`, opacity: bdB }} />
          </div>

          <main className="stage" style={piece('stage')}>
            <div className="deck" style={piece('deck')}>
              <div className="sleeve" style={piece('sleeve')}><Img src={cover(track.cover)} /></div>
              <div className="record" style={piece('record')}>
                <div className="disc" style={piece('disc', { transform: `rotate(${angle}deg)` })}>
                  <div className="label"><Img src={cover(track.cover)} /></div>
                </div>
                <div className="sheen" style={piece('sheen')} />
                <svg className="tonearm" viewBox="0 0 100 100" style={piece('arm')}>
                  <Tonearm />
                  <g className="plinth">
                    <circle cx="100" cy="6" r="10" fill="url(#plinth)" stroke="#3a3a40" strokeWidth=".45" />
                    <circle cx="100" cy="6" r="7.6" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth=".35" />
                    <circle cx="100" cy="6" r="6.2" fill="#0d0d10" stroke="#26262b" strokeWidth=".4" />
                  </g>
                  <g className="arm"><ArmShape /></g>
                </svg>
              </div>
            </div>

            <section className="info" style={piece('info')}>
              <p className="eyebrow" style={piece('eyebrow')}>
                <span className="eq">{[0, 1, 2].map((i) => <i key={i} style={{ height: `${eq(i)}%` }} />)}</span>
                <span>{playing ? 'Now playing' : 'Paused'}</span>
              </p>
              <h1 className="title" style={piece('title')}>{track.name}</h1>
              <p className="artist" style={piece('artist')}>{track.artists}</p>
              <p className="album" style={piece('album')}>{track.album ?? track.name}</p>
              <div className="progress" style={piece('progress')}>
                <div className={`scrub${h('scrub')}`}>
                  <div className="bar"><i style={{ width: `${progress * 100}%` }} /></div>
                  <span className="knob" style={{ left: `${progress * 100}%` }} />
                </div>
                <div className="times"><span>{fmt(progress * duration)}</span><span>{fmt(duration)}</span></div>
              </div>
              <div className="tools" style={piece('tools')}>
                <div className={`volume${h('volume')}`} style={piece('volume')}>
                  <button className="vol-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M3.5 9.2h3.8L12 5v14l-4.7-4.2H3.5z" />
                      <path className="wave wave1" d="M15 9.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path className="wave wave2" d="M17.6 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path className="mute-x" d="M15.5 9.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <div className="vol-slide" style={fx['vol-slide']}>
                    <input type="range" readOnly value={volume} min={0} max={100} className={h('volume').trim()} style={{ ['--val' as string]: `${volume}%` }} />
                  </div>
                  <span className="vol-value" style={fx['vol-value']}>{Math.round(volume)}</span>
                </div>
                {mode === 'full' ? (
                  <button className={`lyrics-btn${lyrics?.on ? ' on' : ''}${h('lyrics-btn')}`} style={piece('lyrics-btn')}>
                    <Icon d={ICONS.lyrics} />
                    <span>Lyrics</span>
                  </button>
                ) : null}
              </div>
              {lyrics?.on ? (
                <div className="lyrics" style={piece('lyrics')}>
                  <p className="line" data-pos="prev" style={fx['lyric-prev']}>{lyrics.prev}</p>
                  <p className="line" data-pos="cur" style={fx['lyric-cur']}>{lyrics.cur}</p>
                  <p className="line" data-pos="next" style={fx['lyric-next']}>{lyrics.next}</p>
                </div>
              ) : null}
            </section>
          </main>

          <footer className="strip" style={piece('strip')}>
            {recent.length ? <Group id="recent-group" title="Recent" items={recent} prefix="recent" h={h} piece={piece} fx={fx} /> : null}
            {upNext.length ? <Group id="next-group" title="Up next" items={upNext} prefix="next" h={h} piece={piece} fx={fx} /> : null}
          </footer>

          <div className="controls" style={piece('controls')}>
            <button className={`only-full toggle-btn${shuffle ? ' on' : ''}${h('shuffle')}`} id="btn-shuffle" style={piece('shuffle')}><Icon d={ICONS.shuffle} /></button>
            <button className={h('previous')} style={piece('previous')}><Icon d={ICONS.previous} /></button>
            <button className={`play${h('play')}`} style={piece('play')}><Icon d={playing ? ICONS.pause : ICONS.play} /></button>
            <button className={h('nextBtn')} style={piece('nextBtn')}><Icon d={ICONS.next} /></button>
            <button className={`only-full toggle-btn${repeat !== 'off' ? ' on' : ''}${repeat === 'track' ? ' one' : ''}${h('repeat')}`} id="btn-repeat" style={piece('repeat')}>
              <Icon d={repeat === 'track' ? ICONS.repeatOne : ICONS.repeat} />
            </button>
            <span className="controls-sep only-full" style={piece('sep')} />
            <button className={`only-full toggle-btn${liked ? ' on' : ''}${h('like')}`} id="btn-like" style={piece('like')}>
              <Icon d={liked ? ICONS.heartOn : ICONS.heart} />
            </button>
          </div>

          <div className="corner" style={piece('corner')}>
            {search ? null : (
              <button className={`only-full search-btn${h('searchBtn')}`} style={piece('searchBtn')}><Icon d={ICONS.search} /><span>Search</span></button>
            )}
            <button className={`only-full corner-toggle${protect ? ' on' : ''}${h('protect')}`} style={piece('protect')}><Icon d={ICONS.moon} /></button>
            <button className={`only-full${h('toMini')}`} style={piece('toMini')}><Icon d={ICONS.toMini} /></button>
            <button className={h('settings')} style={piece('settings')}><Icon d={ICONS.gear} /></button>
            <button className={`only-mini${h('expand')}`} style={piece('expand')}><Icon d={ICONS.expand} /></button>
            <button className={h('close')} style={piece('close')}><Icon d={ICONS.close} /></button>
          </div>

          {search ? <SearchPanel view={search} h={h} piece={piece} fx={fx} /> : null}
          {connect ? <ConnectModal piece={piece} /> : null}
          <div className={`toast${toast ? ' show' : ''}`} style={piece('toast')}>{toast}</div>
          {mode === 'full' ? (
            <div style={piece('dim', { position: 'absolute', inset: 0, zIndex: 5, background: '#000', opacity: (dim ?? (protect ? 1 : 0)) * 0.28, pointerEvents: 'none' })} />
          ) : null}
        </>
      )}
    </div>
  );
}

type PieceFn = (k: string, extra?: CSSProperties) => CSSProperties;
type HoverFn = (k: string) => string;

function Group({ id, title, items, prefix, h, piece, fx }: {
  id: string; title: string; items: Track[]; prefix: string; h: HoverFn; piece: PieceFn; fx: AppProps['fx'];
}) {
  return (
    <div className="group" id={id} style={piece(prefix)}>
      <h3>{title}</h3>
      <ul>
        {items.map((t, i) => (
          <li key={i} className={h(`${prefix}-${i}`).trim()} style={piece(`${prefix}-${i}`, fx?.[`${prefix}-item`])}>
            <Img src={cover(t.cover)} />
            <span className="name">{t.name}</span>
            <span className="by">{t.artists}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrackRow({ t, i, h, piece }: { t: Row; i: number; h: HoverFn; piece: PieceFn }) {
  return (
    <button className={`row${h(`row-${i}`)}`} style={piece(`row-${i}`)}>
      <Img src={cover(t.thumb)} />
      <span className="text"><span className="name">{t.name}</span><span className="sub">{t.artists}</span></span>
      <span className={`add-queue${h(`add-${i}`)}${h(`added-${i}`) ? ' done' : ''}`}><Icon d={ICONS.queue} /></span>
      <span className="time">{fmt(t.durationMs)}</span>
    </button>
  );
}

function SearchPanel({ view, h, piece, fx }: { view: SearchView; h: HoverFn; piece: PieceFn; fx: AppProps['fx'] }) {
  return (
    <aside className="search" style={piece('search')}>
      <div className={`search-box${view.query ? ' focus' : ''}`} style={piece('search-box')}>
        <Icon d={ICONS.search} />
        <input readOnly value={view.query} placeholder="Songs, artists, albums or playlists" />
        <button><Icon d={ICONS.close} /></button>
      </div>
      <div className="results" style={piece('results', fx?.results)}>
        {view.kind === 'hint' ? <p className="hint">Type to search Spotify. Click a result to play it.</p> : null}
        {view.kind === 'results' ? (
          <>
            <h4>Songs</h4>
            <div className="track-list">
              {view.tracks.map((t, i) => <TrackRow key={i} t={t} i={i} h={h} piece={piece} />)}
              <button className={`more${h('more')}`}>See more songs</button>
            </div>
            <h4>Artists</h4>
            <div className="tiles">
              {view.artists.map((t, i) => (
                <div key={i} className={`tile round${h(`tile-${i}`)}`} style={piece(`tile-${i}`)}>
                  <Img src={cover(t.image)} /><span className="name">{t.name}</span><span className="sub">{t.sub}</span>
                </div>
              ))}
            </div>
            <h4>Albums</h4>
            <div className="tiles">
              {view.albums.map((t, i) => (
                <div key={i} className={`tile${h(`album-${i}`)}`} style={piece(`album-${i}`)}>
                  <Img src={cover(t.image)} /><span className="name">{t.name}</span><span className="sub">{t.sub}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
        {view.kind === 'artist' ? (
          <>
            <button className={`back${h('back')}`}>← Back to results</button>
            <div className="artist-head" style={piece('artist-head')}>
              <Img src={cover(view.image)} />
              <div className="artist-info"><span className="sub">Artist</span><h3>{view.name}</h3></div>
              <button className={`play-artist${h('play-artist')}`}><Icon d={ICONS.play} /><span>Play</span></button>
            </div>
            <h4>Songs</h4>
            <div className="track-list">
              {view.tracks.map((t, i) => <TrackRow key={i} t={t} i={i} h={h} piece={piece} />)}
              <button className={`more${h('more')}`}>See more songs</button>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}

function ConnectModal({ piece }: { piece: PieceFn }) {
  const copy = <button>Copy</button>;
  return (
    <div className="modal" style={piece('modal')}>
      <div className="sheet" style={piece('sheet')}>
        <button className="sheet-close"><Icon d={ICONS.close} /></button>
        <p className="sheet-eyebrow">Optional · about 5 minutes</p>
        <h2>To search you need your own Spotify API</h2>
        <p className="sheet-lead">
          With your own Spotify API, Vinilify adds search, the “Up next” queue and “Like”. Spotify only allows these features for apps
          registered by each user. It’s free and you only do it once. Everything else works without it.
        </p>
        <ol className="steps">
          <li style={piece('step-1')}>
            <h3>Open the Spotify developer dashboard</h3>
            <p>Log in with your Spotify account and click <b>Create app</b>.</p>
            <button className="open-link">developer.spotify.com/dashboard<Icon d={ICONS.open} /></button>
          </li>
          <li style={piece('step-2')}>
            <h3>Fill in the form like this</h3>
            <dl className="fields">
              <div><dt>App name</dt><dd><code>Vinilify</code>{copy}</dd></div>
              <div><dt>App description</dt><dd><code>Spotify vinyl on my desktop</code>{copy}</dd></div>
              <div><dt>Website</dt><dd className="muted">Leave it empty</dd></div>
              <div>
                <dt>Redirect URIs</dt><dd><code>http://127.0.0.1:8888/callback</code>{copy}</dd>
                <small>Paste it and click <b>Add</b>. It must be exactly this.</small>
              </div>
              <div><dt>Which API/SDKs…?</dt><dd>Check only <b>Web API</b></dd></div>
            </dl>
            <p>Accept the terms and click <b>Save</b>.</p>
          </li>
          <li style={piece('step-3')}>
            <h3>Copy the Client ID and paste it here</h3>
            <p>It’s at the top of your newly created app’s page.</p>
            <form className="connect-form"><input readOnly placeholder="Client ID (32 characters)" /><button type="button">Connect</button></form>
            <p className="connect-status" />
          </li>
        </ol>
        <p className="sheet-note">Spotify requires the account that creates the app to have Premium. Your data stays on this PC.</p>
      </div>
    </div>
  );
}

function SettingsView({ settings, h, piece }: { settings: NonNullable<AppProps['settings']>; h: HoverFn; piece: PieceFn }) {
  const es = settings.lang === 'es';
  return (
    <div className="settings" style={piece('settingsView')}>
      <h2>{es ? 'Configuración' : 'Settings'}</h2>
      <section className="set-block" style={piece('set-lang')}>
        <div className="set-head"><h3>{es ? 'Idioma' : 'Language'}</h3><p>{es ? 'El idioma de Vinilify.' : 'Vinilify’s language.'}</p></div>
        <div className="segmented">
          <button className={`${!es ? 'on' : ''}${h('en')}`}>English</button>
          <button className={`${es ? 'on' : ''}${h('es')}`}>Español</button>
        </div>
      </section>
      <section className="set-block" style={piece('set-account')}>
        <div className="set-head">
          <h3>{es ? 'Cuenta de Spotify' : 'Spotify account'}</h3>
          <span className={`account-status${settings.connected ? ' ok' : ''}`}>{settings.connected ? (es ? 'Conectada' : 'Connected') : es ? 'Sin conectar' : 'Not connected'}</span>
        </div>
        <p className="set-hint">{es ? 'Opcional: suma el buscador, la cola y «Me gusta».' : 'Optional: adds search, the queue and “Like”.'}</p>
        <label className="field-label">Client ID</label>
        <form className="connect-form">
          <input readOnly value={settings.clientId} placeholder="Client ID (32 characters)" className={settings.clientId ? 'focus' : ''} />
          <button type="button" className={h('connect')}>{settings.connected ? (es ? 'Volver a conectar' : 'Reconnect') : es ? 'Conectar' : 'Connect'}</button>
        </form>
        <p className="connect-status" />
        <div className="set-actions">
          <button className="text-btn">{es ? '¿Cómo consigo un Client ID?' : 'How do I get a Client ID?'}</button>
          <button className="ghost-btn">{es ? 'Desconectar' : 'Disconnect'}</button>
        </div>
      </section>
      <section className="set-block set-row" style={piece('set-login')}>
        <div className="set-head"><h3>{es ? 'Iniciar con Windows' : 'Start with Windows'}</h3><p>{es ? 'Abre Vinilify en la bandeja al prender el PC.' : 'Opens Vinilify in the tray when you turn on your PC.'}</p></div>
        <label className="switch"><input type="checkbox" readOnly checked={settings.loginItem} /><span /></label>
      </section>
    </div>
  );
}

export const ICON_PATHS = ICONS;
export type { ReactNode };
