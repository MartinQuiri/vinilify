import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from 'remotion';
import type { CSSProperties, ReactNode } from 'react';
import { SANS } from './fonts';
import { App } from './ui/App';
import type { AppProps, SearchView, Track } from './ui/App';
import { accentOf, artistView, BAD_GUY, FAKE_CLIENT_ID, RECENT, searchResults, TRACKS, UP_NEXT } from './ui/data';
import { Cursor, cursorAt } from './film/Cursor';
import type { Stop } from './film/Cursor';
import { lyricsAt } from './film/lyrics';
import { CoverWall, Desktop, GlowText, LightSweep, VinylMark } from './film/Pieces';
import { Cam, Halo, L } from './film/Stage';
import { BEAT, DURATION, S, SONG_START, beat as B, easeIn, easeInOut, easeOut, mix, p, spring } from './film/time';
import { DimWord, LikeWord, LouderWord, QueueWord, RepeatWord, ShuffleWord, SkipWord, Statement } from './film/Words';

// ---------- Estado de la app a lo largo del video ----------

const HERO = TRACKS.wnl;
const PINK = accentOf(HERO);
const DROP = B(S.drop1);
const songT = (f: number) => SONG_START + f / 30;
// 33⅓ rpm = 200°/s; arranca con inercia, como el disco real.
const spin = (f: number, from = DROP) => {
  const t = f - from;
  if (t <= 0) return 0;
  return 6.667 * (t - 12 * (1 - Math.exp(-t / 12)));
};
const heroProgress = (f: number) => songT(f) / (HERO.durationMs! / 1000);

const base = (f: number): AppProps => ({
  track: HERO, accent: PINK, recent: RECENT, upNext: UP_NEXT, playing: f >= DROP, progress: heroProgress(f), angle: spin(f),
});

// Entrada en 3D: con t=0 la pieza está lejos/desenfocada; con t=1, en su lugar.
type FlyFrom = { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; s?: number; blur?: number };
function fly(t: number, o: FlyFrom): CSSProperties {
  if (t >= 1) return {};
  const u = 1 - t;
  return {
    opacity: Math.min(1, t * 1.8),
    transform: `perspective(1400px) translate3d(${u * (o.x ?? 0)}px, ${u * (o.y ?? 0)}px, ${u * (o.z ?? 0)}px) rotateX(${u * (o.rx ?? 0)}deg) rotateY(${u * (o.ry ?? 0)}deg) rotateZ(${u * (o.rz ?? 0)}deg) scale(${mix(o.s ?? 1, 1, t)})`,
    filter: o.blur ? `blur(${u * o.blur}px)` : undefined,
  };
}
const rise = (t: number, y = 14): CSSProperties => (t >= 1 ? {} : { opacity: t, transform: `translateY(${(1 - t) * y}px)` });

// Tramo del video con fundido corto en los bordes (los cortes caen en los golpes).
function Seg({ f, from, to, fade = 5, children }: { f: number; from: number; to: number; fade?: number; children: ReactNode }) {
  if (f < from - fade || f >= to + fade) return null;
  const o = Math.min(p(f, from - fade, from + fade, easeInOut), 1 - p(f, to - fade, to + fade, easeInOut));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
}

// Texto alineado a la izquierda (al lado de una pieza flotante).
const left = (x: number, width = 760): CSSProperties => ({ left: x, right: 'auto', width, textAlign: 'left' });

// ---------- 1. Logo y muro de portadas ----------

function Intro({ f }: { f: number }) {
  const ring = p(f, 4, 46, easeInOut);
  const mark = p(f, 26, 74);
  const out = p(f, B(57.5), B(59));
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: 1 - mark * 0.85 }}>
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffc2d8" /><stop offset="1" stopColor="#ff4f8b" /></linearGradient>
        </defs>
        <circle
          cx={960} cy={470} r={150} fill="none" stroke="url(#ring)" strokeWidth={2.5} pathLength={1} strokeDasharray={1}
          strokeDashoffset={1 - ring} transform="rotate(-90 960 470)" style={{ filter: 'drop-shadow(0 0 10px rgba(255,90,150,.9))' }}
        />
      </svg>
      <VinylMark size={300} y={470} rotate={mix(-140, 0, p(f, 26, 96))} opacity={mark} scale={mix(0.86, 1, mark)} glow={mark} />
      <GlowText text="Vinilify" reveal={p(f, 66, 92)} y={712} size={104} weight={600} />
    </AbsoluteFill>
  );
}

function Wall({ f }: { f: number }) {
  const a = B(59);
  const out = p(f, B(66.4), B(67));
  return (
    <AbsoluteFill>
      <CoverWall frame={f - a} opacity={p(f, a, a + 18) * (1 - out)} />
      <GlowText text="Whatever you’re playing," reveal={p(f, a + 8, a + 28)} out={out} y={490} size={84} />
      <GlowText text="now it spins." reveal={p(f, B(63), B(63) + 22)} out={out} y={590} size={84} />
    </AbsoluteFill>
  );
}

// ---------- 2. La app se arma pieza por pieza y la aguja cae en el drop ----------

function Assemble({ f }: { f: number }) {
  const pp = (a: number, b: number, e = easeOut) => p(f, B(a), B(b), e);
  const fx: Record<string, CSSProperties> = {};
  fx.disc = fly(pp(67, 69), { y: 420, z: -500, s: 0.7, blur: 16 });
  fx.sheen = fly(pp(67, 69), { y: 420, z: -500, s: 0.7 });
  fx.sleeve = fly(pp(69, 71), { x: -620, ry: 40, blur: 14 });
  fx.arm = fly(pp(71, 73), { x: 260, y: -260, rz: 25, blur: 10 });
  fx.eyebrow = fly(pp(75, 76.5), { y: 30, blur: 10 });
  fx.title = fly(pp(75.4, 77), { y: 40, blur: 14 });
  fx.artist = fly(pp(75.8, 77.4), { y: 30, blur: 10 });
  fx.album = fly(pp(76.2, 77.8), { y: 30, blur: 10 });
  fx.progress = { ...fly(pp(76.8, 78.4), { blur: 6 }), clipPath: `inset(0 ${(1 - pp(76.8, 78.6, easeInOut)) * 100}% 0 0)` };
  fx.tools = fly(pp(77.4, 79), { y: 20, blur: 8 });
  ['shuffle', 'previous', 'play', 'nextBtn', 'repeat', 'sep', 'like'].forEach((k, i) => {
    fx[k] = fly(pp(78.6 + i * 0.25, 79.8 + i * 0.25, spring), { y: -40, s: 0.3 });
  });
  fx.corner = fly(pp(79.6, 81), { x: 120, blur: 8 });
  for (let i = 0; i < 6; i++) {
    fx[`recent-${i}`] = fly(pp(80 + i * 0.18, 81.4 + i * 0.18), { y: 90, s: 0.85, blur: 8 });
    fx[`next-${i}`] = fly(pp(80.4 + i * 0.18, 81.8 + i * 0.18), { y: 90, s: 0.85, blur: 8 });
  }
  fx.recent = { opacity: pp(80, 81) };
  fx.next = { opacity: pp(80.4, 81.4) };

  // El fondo se enciende de a poco y explota con el drop.
  const glow = f < DROP ? pp(71, 81) * 0.35 : mix(0.35, 1, p(f, DROP, DROP + 10));
  // En el silencio el brazo sale de su apoyo y cae sobre el disco justo en el golpe.
  const armRest = mix(-60, -26, pp(71, 73));
  const arm = f < B(81.6) ? armRest : f < DROP ? mix(-26, heroProgress(DROP) * 16, p(f, B(81.6), DROP, easeInOut)) : heroProgress(f) * 16;
  const angle = f < DROP ? (1 - pp(67, 70)) * -260 : spin(f);

  // Cámara: primero el disco solo; al llegar el sobre se abre para que entren los dos (nada queda cortado);
  // luego retrocede hasta la app entera; en el drop, un golpe de zoom.
  const widen = pp(68.6, 70.6, easeInOut);
  const pull = pp(73, 77.5, easeInOut);
  const camX = mix(mix(L.record.x, 600, widen), 960, pull);
  const camZ = mix(mix(1.42, 1.18, widen), 1, pull);
  const bump = f >= DROP ? Math.exp(-(f - DROP) / 7) * 0.035 : 0;
  const push = p(f, DROP, B(91), easeInOut);
  const flash = f >= DROP ? Math.exp(-(f - DROP) / 5) : 0;
  return (
    <AbsoluteFill>
      <Cam cx={camX} cy={mix(L.record.y, 540, pull)} zoom={camZ + bump + push * 0.06} ry={mix(10, 0, pull) - push * 3}>
        <App
          {...base(f)} angle={angle} arm={arm} awake={f >= B(78)} fx={fx} backdropOn={[glow, 0]}
          style={{ background: f < DROP ? '#000' : undefined }}
        />
      </Cam>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 40% 45%, ${PINK}, transparent 60%)`, opacity: flash * 0.35, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
}

// ---------- 3. Letra sincronizada ----------

function Lyrics({ f }: { f: number }) {
  const on = f >= B(92);
  const l = lyricsAt(songT(f));
  const step = p(l.since * 30, 0, 14);
  const fx: Record<string, CSSProperties> = {
    'lyric-cur': step < 1 ? { transform: `translateY(${(1 - step) * 13}px)`, opacity: mix(0.2, 1, step) } : {},
    'lyric-prev': step < 1 ? { transform: `translateY(${(1 - step) * 10}px)`, opacity: mix(0.3, 1, step) } : {},
    'lyric-next': step < 1 ? { transform: `translateY(${(1 - step) * 10}px)`, opacity: mix(0.3, 1, step) } : {},
    lyrics: rise(p(f, B(92), B(93.2)), 30),
  };
  // Antes del clic la fila de herramientas está a y=600; con la letra activada sube a y=528.
  const t = p(f, B(92.2), B(94.2), easeInOut);
  // Al final la letra llena el cuadro sin que se vea el borde del fondo (con zoom 2,3 se ven x 1083–1917).
  const cx = on ? mix(1262, 1500, t) : 1262;
  const cy = on ? mix(528, 640, t) : 600;
  const zoom = on ? mix(3.2, 2.3, t) : mix(2.6, 3.2, p(f, B(91), B(92), easeInOut));
  const stops: Stop[] = [{ f: B(90.6), x: 1500, y: 760 }, { f: B(91.6), x: 1243, y: 600 }, { f: B(92), x: 1243, y: 600, click: true }];
  const c = cursorAt(stops, f);
  // El puntero vive en el diseño sin letra (y=600); después del clic se desvanece, así que basta con esa cuenta.
  const cs = { x: 960 + (c.x - cx) * zoom + 8, y: 540 + (c.y - 600 + (on ? 528 - cy + 72 : 600 - cy) - (on ? 72 : 0)) * zoom + 8 };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Cam cx={cx} cy={cy} zoom={zoom}>
        <App
          {...base(f)} awake lyrics={on ? { on: true, prev: l.prev, cur: l.cur, next: l.next } : null}
          hover={f >= B(91.5) && f < B(93) ? ['lyrics-btn'] : []} only={['backdrop', 'tools', 'lyrics']} fx={fx}
        />
      </Cam>
      <Cursor x={cs.x} y={cs.y} size={44} press={c.press} opacity={1 - p(f, B(92.6), B(93.2))} />
      <GlowText text="Lyrics, in sync." reveal={p(f, B(94), B(95))} out={p(f, B(98.4), B(99))} y={190} size={72} />
    </AbsoluteFill>
  );
}

// ---------- 4. Controles de cerca ----------

const CONTROL_WORDS = [ShuffleWord, RepeatWord, LikeWord, SkipWord];
function Controls({ f }: { f: number }) {
  // Durante el fundido de entrada (antes del golpe 99) se queda en la primera palabra.
  const k = Math.max(0, Math.min(3, Math.floor((f - B(99)) / (2 * BEAT))));
  const Word = CONTROL_WORDS[k];
  const r = f - B(99 + 2 * k);
  const Z = 3;
  const sx = (x: number) => 960 + (x - L.controls.x) * Z;
  const sy = (y: number) => 650 + (y - L.controls.y) * Z;
  const stops: Stop[] = [
    { f: B(98.8), x: 900, y: 140 },
    { f: B(99.5), x: L.shuffle.x, y: L.shuffle.y, click: true },
    { f: B(101.5), x: L.repeat.x, y: L.repeat.y, click: true },
    { f: B(102.3), x: L.repeat.x, y: L.repeat.y, click: true },
    { f: B(103.5), x: L.like.x, y: L.like.y, click: true },
    { f: B(105.5), x: L.next.x, y: L.next.y, click: true },
  ];
  const c = cursorAt(stops, f);
  const likePop = p(f, B(103.5), B(103.5) + 10, (x) => x);
  const skip = p(f, B(105.5), B(105.5) + 8, (x) => x);
  const hoverKey = f > B(105) ? 'nextBtn' : f > B(103) ? 'like' : f > B(101) ? 'repeat' : f > B(99.2) ? 'shuffle' : '';
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Halo x={960} y={650} w={1500} h={500} color={PINK} />
      <Cam cx={L.controls.x} cy={L.controls.y} zoom={Z} y={650} rx={mix(18, 0, p(f, B(99), B(100.5), easeOut))}>
        <App
          {...base(f)} awake only={['controls']} shuffle={f >= B(99.5)} repeat={f >= B(102.3) ? 'track' : f >= B(101.5) ? 'context' : 'off'}
          liked={f >= B(103.5)} hover={[hoverKey]}
          fx={{
            like: likePop > 0 && likePop < 1 ? { transform: `scale(${1 + Math.sin(likePop * Math.PI) * 0.35})` } : {},
            nextBtn: skip > 0 && skip < 1 ? { transform: `translateX(${Math.sin(skip * Math.PI) * 6}px)` } : {},
          }}
        />
      </Cam>
      <Word r={r} y={330} size={120} />
      <Cursor x={sx(c.x) + 10} y={sy(c.y) + 10} size={46} press={c.press} />
    </AbsoluteFill>
  );
}

// ---------- 5. Arrastrar la línea de tiempo ----------

function Scrub({ f }: { f: number }) {
  const p0 = heroProgress(B(107.4));
  const prog =
    f < B(107.6) ? heroProgress(f)
      : f < B(109.6) ? mix(p0, p0 + 0.42, p(f, B(107.6), B(109.6), easeInOut))
        : mix(p0 + 0.42, p0 + 0.2, p(f, B(109.6), B(111), easeInOut));
  const scrubbing = f >= B(107.4) && f < B(111.3);
  const angle = spin(f) + (prog - heroProgress(f)) * 2400;
  // Sin la letra, la barra queda a y=529 (la misma medida que en la app real).
  const BAR_Y = 529;
  const knobX = 1195 + prog * 610;
  const Z = 1.12;
  const cam = { cx: 1110, cy: 470, y: 600 };
  const c = cursorAt([{ f: B(106.8), x: 1500, y: 700 }, { f: B(107.4), x: 1195 + p0 * 610, y: BAR_Y, click: true }], f);
  const cx = scrubbing ? knobX : c.x;
  const cy = scrubbing ? BAR_Y : c.y;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* Fondo fijo a pantalla completa: la cámara se mueve, pero no se le ven los bordes */}
      <App {...base(f)} only={['backdrop']} />
      <Cam {...cam} zoom={Z} ry={mix(-5, -2, p(f, B(107), B(112), easeInOut))}>
        <App
          {...base(f)} progress={prog} angle={angle} arm={prog * 16} scrubbing={scrubbing} hover={scrubbing ? ['scrub'] : []}
          only={['record', 'progress']}
        />
      </Cam>
      <Cursor x={960 + (cx - cam.cx) * Z + 8} y={cam.y + (cy - cam.cy) * Z + 8} size={34} press={scrubbing ? 0.35 : c.press} />
      {/* Encima de la barra, alineado con su inicio */}
      <GlowText text="Scrub." reveal={p(f, B(107), B(108))} out={p(f, B(111.4), B(112))} y={560} size={96} style={left(960 + (1195 - cam.cx) * Z, 600)} />
    </AbsoluteFill>
  );
}

// ---------- 6. Volumen ----------

function Volume({ f }: { f: number }) {
  const open = p(f, B(112.5), B(113.3), easeOut);
  const vol = mix(38, 92, p(f, B(113.6), B(115.6), easeInOut));
  const Z = 3.4;
  // Sin la letra, la fila del volumen queda a y=600 (medida en la app real).
  const VY = 600;
  const cam = { cx: 1290, cy: VY };
  // Pulgar del deslizador: el riel empieza a 10 px del icono y mide 140 px.
  const thumbX = 1225 + (vol / 100) * 140;
  const c = cursorAt([{ f: B(112), x: 1240, y: 680 }, { f: B(112.6), x: 1205, y: VY }, { f: B(113.4), x: 1225 + 0.38 * 140, y: VY, click: true }], f);
  const dragging = f >= B(113.4) && f < B(115.8);
  const x = dragging ? thumbX : c.x;
  const y = dragging ? VY : c.y;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Halo x={960} y={640} w={1200} h={420} color={PINK} />
      <Cam {...cam} zoom={Z} y={640}>
        <App
          {...base(f)} volume={vol} hover={open > 0 ? ['volume'] : []} only={['volume']}
          fx={{
            'vol-slide': { width: 140 * open, marginLeft: 10 * open, opacity: open },
            'vol-value': { width: `${2.6 * open}em`, opacity: open, transform: `translateX(${(1 - open) * -6}px)` },
            volume: fly(p(f, B(112), B(112.8)), { s: 0.6, blur: 8 }),
          }}
        />
      </Cam>
      <LouderWord r={f - B(112)} y={330} size={120} />
      <Cursor x={960 + (x - cam.cx) * Z + 6} y={640 + (y - cam.cy) * Z + 6} size={44} press={dragging ? 0.35 : c.press} />
    </AbsoluteFill>
  );
}

// ---------- 7. Modo protección (cae justo cuando se va el bajo) ----------

function Protect({ f }: { f: number }) {
  const t = p(f, B(117.5), B(119.2), easeInOut);
  const c = cursorAt([{ f: B(116.6), x: 1500, y: 300 }, { f: B(117.4), x: L.protect.x, y: L.protect.y, click: true }], f);
  const common = { ...base(f), lyrics: { on: true, ...lyricsAt(songT(f)) } };
  const drift = Math.sin((f - B(117)) / 40) * 6;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <App {...common} awake hover={['protect']} style={{ opacity: 1 - t }} />
      <App {...common} protect dim={t} style={{ opacity: t, transform: `translate(${drift}px, ${drift * 0.6}px)` }} />
      <Cursor x={c.x + 6} y={c.y + 6} size={26} press={c.press} opacity={1 - p(f, B(118), B(118.6))} />
      <AbsoluteFill style={{ opacity: p(f, B(118.4), B(119.4)) * (1 - p(f, B(122.4), B(123))) }}>
        <DimWord r={Math.max(0, f - B(118.4))} y={985} size={64} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------- 8. Mini vinilo, siempre encima ----------

function Mini({ f }: { f: number }) {
  const shrink = p(f, B(123), B(124.6), easeInOut);
  const MS = 1.55;
  const drag = p(f, B(131), B(133), easeInOut);
  const mx = mix(1300, 1180, drag);
  const my = mix(250, 300, drag);
  const awake = f >= B(128.6) && f < B(134.2);
  const c = cursorAt([
    { f: B(127.6), x: 1700, y: 900 }, { f: B(128.6), x: mx + 230, y: my + 260 },
    { f: B(131), x: 1300 + 230, y: 250 + 120, click: true }, { f: B(133), x: 1180 + 230, y: 300 + 120 },
  ], f);
  const cx = f >= B(131) && f < B(133) ? mx + 230 : c.x;
  const cy = f >= B(131) && f < B(133) ? my + 120 : c.y;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ opacity: p(f, B(123), B(124.4)) }}>
        <Desktop frame={f} />
      </AbsoluteFill>
      <Cam zoom={mix(1, 0.22, shrink)} x={mix(960, mx + 217, shrink)} y={mix(540, my + 280, shrink)} opacity={1 - p(f, B(124), B(124.8))}>
        <App {...base(f)} protect dim={1} lyrics={{ on: true, ...lyricsAt(songT(f)) }} />
      </Cam>
      <div style={{ position: 'absolute', left: mx, top: my, transform: `scale(${MS * mix(0.9, 1, p(f, B(123.8), B(125)))})`, transformOrigin: '0 0', opacity: p(f, B(123.8), B(124.8)), filter: 'drop-shadow(0 30px 50px rgba(0,0,0,.55))' }}>
        <App mode="mini" {...base(f)} awake={awake} hover={awake ? ['play'] : []} />
      </div>
      <Cursor x={cx} y={cy} size={26} press={c.press} opacity={p(f, B(127.6), B(128.2))} />
      <GlowText text="Always on top." reveal={p(f, B(124.5), B(125.6))} out={p(f, B(130.4), B(131))} y={975} size={64} />
      <GlowText text="Drag it anywhere." reveal={p(f, B(131), B(132))} out={p(f, B(134.3), B(135))} y={975} size={64} />
    </AbsoluteFill>
  );
}

// ---------- 9. Buscador: canción, artista, cola ----------

function Search({ f }: { f: number }) {
  const q = 'billie eilish';
  const typed = q.slice(0, Math.max(0, Math.min(q.length, Math.floor((f - B(136)) / ((B(138.5) - B(136)) / q.length)))));
  let view: SearchView = { kind: 'hint', query: typed };
  if (f >= B(139)) view = searchResults(q);
  if (f >= B(142)) view = artistView;
  const fx: Record<string, CSSProperties> = { search: fly(p(f, B(135), B(136.4)), { x: 500, ry: -30, blur: 14 }) };
  const t0 = f >= B(142) ? B(142) : B(139);
  for (let i = 0; i < 8; i++) fx[`row-${i}`] = rise(p(f, t0 + 6 + i * 2.5, t0 + 18 + i * 2.5));
  fx['tile-0'] = rise(p(f, B(139) + 20, B(139) + 34));
  fx['artist-head'] = rise(p(f, B(142), B(142) + 14), 24);
  // Puntero: al artista y luego al "+" de la tercera canción.
  const stops: Stop[] = [
    { f: B(139.6), x: 1700, y: 760 }, { f: B(141.2), x: 1454, y: 571 }, { f: B(141.7), x: 1454, y: 571, click: true },
    { f: B(144.8), x: 1820, y: 471 }, { f: B(145.6), x: 1820, y: 471, click: true },
  ];
  const c = cursorAt(stops, f);
  const hover = [
    ...(f >= B(140.8) && f < B(142) ? ['tile-0'] : []),
    ...(f >= B(144.4) ? ['row-2', 'add-2'] : []),
    ...(f >= B(145.6) ? ['added-2'] : []),
  ];
  const cam = { cx: 1640, cy: 540, zoom: 0.94, x: 1270 };
  const ry = mix(-16, -6, p(f, B(135), B(149), easeInOut));
  // Proyección aproximada del puntero (el giro es suave, se ignora).
  const sx = cam.x + (c.x - cam.cx) * cam.zoom;
  const sy = 540 + (c.y - cam.cy) * cam.zoom;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Halo x={1270} y={540} w={900} h={1000} color={PINK} opacity={0.8} />
      <Cam {...cam} ry={ry}>
        <App {...base(f)} search={view} hover={hover} only={['search']} fx={fx} />
      </Cam>
      <Cursor x={sx + 6} y={sy + 6} size={30} press={c.press} opacity={p(f, B(139.6), B(140.2)) * (1 - p(f, B(147.6), B(148.4)))} />
      <GlowText text="Search anything." reveal={p(f, B(135.6), B(136.8))} out={p(f, B(141.4), B(142))} y={500} size={84} style={left(130)} />
      <GlowText text="Open any artist." reveal={p(f, B(142), B(143.2))} out={p(f, B(144.4), B(145))} y={500} size={84} style={left(130)} />
      <GlowText text="Queue it up." reveal={p(f, B(145.4), B(146.4))} out={p(f, B(148.4), B(149))} y={500} size={84} style={left(130)} />
    </AbsoluteFill>
  );
}

// La canción agregada entra a "A continuación"; luego se toca su portada y empieza a sonar.
function Queue({ f }: { f: number }) {
  const ins = p(f, B(149.6), B(151), easeOut);
  const fx: Record<string, CSSProperties> = { 'next-0': fly(ins, { y: -220, s: 0.6, blur: 10 }) };
  for (let i = 1; i < 7; i++) fx[`next-${i}`] = ins < 1 ? { transform: `translateX(${(1 - ins) * -145.7}px)` } : {};
  const up = [BAD_GUY, ...UP_NEXT];
  const Z = 1.55;
  const cam = { cx: 961, cy: 930 };
  // Centro de la primera portada (11vh = 118,8 px; grupo centrado de 7 portadas).
  const coverX = 961 - (7 * 118.8 + 6 * 26.9) / 2 + 59.4;
  const c = cursorAt([{ f: B(151.4), x: 1300, y: 1050 }, { f: B(152.6), x: coverX, y: 920 }, { f: B(153), x: coverX, y: 920, click: true }], f);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Halo x={960} y={700} w={1500} h={500} color={PINK} />
      <Cam {...cam} zoom={Z} y={700}>
        <App {...base(f)} recent={[]} upNext={up} only={['next']} fx={fx} hover={f >= B(152.4) ? ['next-0'] : []} />
      </Cam>
      <QueueWord r={f - B(149)} y={300} size={120} />
      <Cursor x={960 + (c.x - cam.cx) * Z + 8} y={700 + (c.y - cam.cy) * Z + 8} size={40} press={c.press} opacity={p(f, B(151.4), B(152))} />
    </AbsoluteFill>
  );
}

// Cambio de canción: el sobre y la etiqueta se van, entra la nueva portada y el fondo se tiñe.
function swapFx(t: number): Record<string, CSSProperties> {
  if (t >= 1) return {};
  const out = t < 0.4;
  const k = out ? t / 0.4 : (t - 0.4) / 0.6;
  const e = out ? easeIn(k) : easeOut(k);
  const sleeve = out ? { opacity: 1 - e, transform: `translateY(${-e * 40}px) scale(${1 - e * 0.04})` } : { opacity: e, transform: `translateY(${(1 - e) * 40}px) scale(${0.96 + e * 0.04})` };
  const info = out ? { opacity: 1 - e, transform: `translateX(${-e * 20}px)` } : { opacity: e, transform: `translateX(${(1 - e) * 20}px)` };
  return { sleeve, title: info, artist: info, album: info };
}

function PlayCover({ f }: { f: number }) {
  const swap = B(155);
  const t = p(f, swap, swap + 16, (x) => x);
  const show = t < 0.4 ? HERO : BAD_GUY;
  const prog = f < swap ? heroProgress(f) : Math.max(0, (f - swap - 6) / 30 / 194.088);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Cam zoom={mix(1.02, 1.08, p(f, swap, B(163), easeInOut))} ry={mix(4, -2, p(f, swap, B(163), easeInOut))}>
        <App
          {...base(f)} track={show} accent={accentOf(show)} progress={prog} arm={prog * 16} upNext={UP_NEXT} recent={[HERO, ...RECENT.slice(0, 3)]}
          backdropCovers={[HERO.cover, BAD_GUY.cover]} backdropOn={[1 - t, t]} fx={swapFx(t)}
        />
      </Cam>
    </AbsoluteFill>
  );
}

// ---------- 10. Configuración: idioma y cuenta ----------

function Settings({ f }: { f: number }) {
  const SC = 1.18;
  const W = 620;
  const H = 720;
  const ox = 1190 - (W / 2) * SC;
  const oy = 540 - (H / 2) * SC;
  const lang = p(f, B(166), B(166.7), easeInOut);
  const c = cursorAt([{ f: B(164), x: 1500, y: 800 }, { f: B(165.4), x: ox + 198 * SC, y: oy + 210 * SC }, { f: B(166), x: ox + 198 * SC, y: oy + 210 * SC, click: true }], f);
  const set = { clientId: FAKE_CLIENT_ID, connected: true, loginItem: true };
  const enter = p(f, B(163), B(164.4));
  const win = (lng: 'en' | 'es', o: number) => (
    <App mode="settings" width={W} height={H} {...base(f)} settings={{ ...set, lang: lng }} hover={f >= B(165.2) && f < B(166) ? ['es'] : []} style={{ opacity: o }} />
  );
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Halo x={1190} y={540} w={900} h={900} color={PINK} opacity={0.7} />
      <div style={{ position: 'absolute', inset: 0, perspective: 2200 }}>
        <div
          style={{
            position: 'absolute', left: ox, top: oy, width: W, height: H, transform: `scale(${SC}) rotateY(${mix(-24, -6, enter)}deg) translateX(${(1 - enter) * 240}px)`,
            transformOrigin: '0 0', borderRadius: 14, overflow: 'hidden', opacity: enter,
            boxShadow: '0 40px 120px rgba(0,0,0,.7), inset 0 0 0 1px rgba(255,255,255,.1)', background: '#0b0b0d',
          }}
        >
          {win('en', 1 - lang)}
          {lang > 0 ? win('es', lang) : null}
        </div>
      </div>
      <Cursor x={c.x + 4} y={c.y + 4} size={30} press={c.press} opacity={p(f, B(164), B(164.6))} />
      <GlowText text="English." reveal={p(f, B(163.6), B(164.6))} out={lang} y={500} size={96} style={left(150, 640)} />
      <GlowText text="Español." reveal={lang} out={p(f, B(170.4), B(171))} y={500} size={96} style={left(150, 640)} />
    </AbsoluteFill>
  );
}

function Connect({ f }: { f: number }) {
  const step = f < B(173) ? 1 : f < B(175) ? 2 : 3;
  const fx: Record<string, CSSProperties> = { sheet: fly(p(f, B(171), B(172.3)), { y: 160, rx: 20, blur: 12 }) };
  for (const k of [1, 2, 3]) fx[`step-${k}`] = { opacity: k === step ? 1 : 0.32 };
  const scroll = mix(0, -150, p(f, B(172.6), B(176), easeInOut));
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Halo x={1200} y={560} w={900} h={1000} color={PINK} opacity={0.7} />
      <Cam cx={960} cy={540 - scroll} zoom={1.02} x={1215} ry={-7}>
        <App {...base(f)} connect only={['sheet']} fx={fx} />
      </Cam>
      <GlowText text="Connect Spotify." reveal={p(f, B(171.4), B(172.4))} out={p(f, B(177), B(177.6))} y={470} size={80} style={left(120, 660)} />
      <GlowText
        text="Optional. Adds search, the queue and Like." reveal={p(f, B(172.2), B(173.2))} out={p(f, B(177), B(177.6))} y={560} size={30}
        weight={500} glow={false} style={{ ...left(124, 700), color: '#a1a1a6', letterSpacing: '-0.01em' }}
      />
    </AbsoluteFill>
  );
}

// Silencio antes del segundo drop: el brazo se levanta y el disco frena.
function Lift({ f }: { f: number }) {
  const t = p(f, B(177.6), B(178.8), easeInOut);
  const pr = heroProgress(f);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Cam cx={L.record.x + 120} cy={L.record.y - 40} zoom={1.25} ry={-8}>
        <App {...base(f)} arm={mix(pr * 16, -26, t)} angle={spin(B(177.6)) + 6.667 * 30 * (1 - Math.exp(-(f - B(177.6)) / 30))} only={['record']} />
      </Cam>
    </AbsoluteFill>
  );
}

// ---------- 11. Segundo drop: frases y montaje de portadas ----------

const STATEMENTS: Array<{ words: string[]; accent?: number }> = [
  { words: ['No', 'account', 'needed.'] },
  { words: ['No', 'Premium.'] },
  { words: ['No', 'ads.'] },
  { words: ['Free.'], accent: 0 },
];
function Statements({ f }: { f: number }) {
  const k = Math.max(0, Math.min(3, Math.floor((f - B(179)) / (2 * BEAT))));
  const r = f - B(179 + 2 * k);
  const s = STATEMENTS[k];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Statement r={r} y={540} size={k === 3 ? 240 : 150} words={s.words} accent={s.accent} />
    </AbsoluteFill>
  );
}

const MONTAGE: Track[] = [TRACKS.patient, TRACKS.housewife, TRACKS.petal, TRACKS.texas, TRACKS.nicole, TRACKS.babylon, TRACKS.bbywow, HERO];
function Montage({ f }: { f: number }) {
  const k = Math.max(0, Math.min(MONTAGE.length - 1, Math.floor((f - B(187)) / (2 * BEAT))));
  const at = B(187 + 2 * k);
  const t = k === 0 ? 1 : p(f, at, at + 12, (x) => x);
  const prev = MONTAGE[Math.max(0, k - 1)];
  const cur = MONTAGE[k];
  const show = t < 0.4 ? prev : cur;
  const orbit = p(f, B(187), B(203), (x) => x);
  const SC = 0.76;
  const pr = 0.35 + 0.02 * k;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
        <div
          style={{
            position: 'absolute', left: 960 - 960 * SC, top: 600 - 540 * SC, width: 1920, height: 1080, transformOrigin: '0 0',
            transform: `scale(${SC}) rotateY(${mix(14, -14, orbit)}deg) rotateX(${mix(6, 2, orbit)}deg)`, borderRadius: 26, overflow: 'hidden',
            boxShadow: `0 40px 140px rgba(0,0,0,.8), 0 0 160px -20px ${accentOf(show)}`,
          }}
        >
          <App
            {...base(f)} track={show} accent={accentOf(show)} progress={pr} arm={pr * 16} awake
            backdropCovers={[prev.cover, cur.cover]} backdropOn={[1 - t, t]} fx={swapFx(t)}
          />
        </div>
      </div>
      <GlowText text="Whatever you play." reveal={p(f, B(187), B(188.2))} out={p(f, B(202.4), B(203))} y={92} size={58} />
    </AbsoluteFill>
  );
}

// Vista explotada: cada parte en su capa, separadas en profundidad; luego vuelven a encajar.
const LAYERS: Array<{ only: string[]; z: number }> = [
  { only: ['backdrop'], z: -500 },
  { only: ['strip'], z: -120 },
  { only: ['sleeve'], z: 40 },
  { only: ['disc', 'sheen'], z: 160 },
  { only: ['info'], z: 220 },
  { only: ['arm'], z: 340 },
  { only: ['controls', 'corner'], z: 420 },
];
function Exploded({ f }: { f: number }) {
  const open = p(f, B(203), B(206.5), easeInOut) * (1 - p(f, B(207.5), B(210.6), easeInOut));
  const turn = p(f, B(203), B(207.5), easeInOut) * (1 - p(f, B(208), B(210.8), easeInOut));
  const flash = f >= B(210.8) ? Math.exp(-(f - B(210.8)) / 4) : 0;
  const pr = heroProgress(f);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <div style={{ position: 'absolute', inset: 0, perspective: 2600 }}>
        <div
          style={{
            position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
            transform: `scale(${mix(1, 0.7, turn)}) rotateX(${turn * 22}deg) rotateY(${turn * -34}deg) rotateZ(${turn * 4}deg)`,
          }}
        >
          {LAYERS.map((l, i) => (
            <div key={i} style={{ position: 'absolute', inset: 0, transform: `translateZ(${l.z * open * 1.6}px)` }}>
              <App {...base(f)} progress={pr} awake only={l.only} />
            </div>
          ))}
        </div>
      </div>
      <AbsoluteFill style={{ background: '#fff', opacity: flash * 0.5 }} />
    </AbsoluteFill>
  );
}

// ---------- 12. Cierre ----------

function Outro({ f }: { f: number }) {
  const a = B(S.outro);
  const hit = B(S.hit);
  const kick = f >= hit ? Math.exp(-(f - hit) / 8) : 0;
  const fadeOut = p(f, B(225), DURATION - 2, easeInOut);
  return (
    <AbsoluteFill style={{ background: '#000', opacity: 1 - fadeOut }}>
      <VinylMark size={260} y={430} rotate={mix(-720, 0, p(f, a, a + 70))} opacity={p(f, a, a + 20)} scale={mix(0.9, 1, p(f, a, a + 30)) + kick * 0.08} glow={1 + kick} />
      <GlowText text="Vinilify" reveal={p(f, a + 14, a + 40)} y={640} size={96} />
      <GlowText text="Free for Windows." reveal={p(f, hit - 4, hit + 14)} y={736} size={40} weight={500} glow={false} style={{ color: '#a1a1a6' }} />
      <GlowText text="github.com/MartinQuiri/vinilify" reveal={p(f, hit + 8, hit + 26)} y={790} size={26} weight={500} glow={false} style={{ color: '#6e6e73' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', fontFamily: SANS, fontSize: 13, color: '#56565b', opacity: p(f, hit + 12, hit + 30) }}>
        Music: STEELROSE – WE NEVER LEARN · Album art © respective artists and labels · Spotify is a trademark of Spotify AB
      </div>
      <LightSweep t={p(f, hit - 6, hit + 18, (x) => x)} />
    </AbsoluteFill>
  );
}

// ---------- Película completa ----------

export const Film = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: SANS, overflow: 'hidden' }}>
      {f < B(59) ? <Intro f={f} /> : null}
      <Seg f={f} from={B(59)} to={B(67)} fade={3}><Wall f={f} /></Seg>
      <Seg f={f} from={B(67)} to={B(91)} fade={3}><Assemble f={f} /></Seg>
      <Seg f={f} from={B(91)} to={B(99)} fade={3}><Lyrics f={f} /></Seg>
      <Seg f={f} from={B(99)} to={B(107)} fade={3}><Controls f={f} /></Seg>
      <Seg f={f} from={B(107)} to={B(112)} fade={3}><Scrub f={f} /></Seg>
      <Seg f={f} from={B(112)} to={B(117)} fade={3}><Volume f={f} /></Seg>
      <Seg f={f} from={B(117)} to={B(123)} fade={3}><Protect f={f} /></Seg>
      <Seg f={f} from={B(123)} to={B(135)} fade={2}><Mini f={f} /></Seg>
      <Seg f={f} from={B(135)} to={B(149)} fade={3}><Search f={f} /></Seg>
      <Seg f={f} from={B(149)} to={B(155)} fade={3}><Queue f={f} /></Seg>
      <Seg f={f} from={B(155)} to={B(163)} fade={3}><PlayCover f={f} /></Seg>
      <Seg f={f} from={B(163)} to={B(171)} fade={3}><Settings f={f} /></Seg>
      <Seg f={f} from={B(171)} to={B(177.6)} fade={3}><Connect f={f} /></Seg>
      <Seg f={f} from={B(177.6)} to={B(179)} fade={2}><Lift f={f} /></Seg>
      <Seg f={f} from={B(179)} to={B(187)} fade={1}><Statements f={f} /></Seg>
      <Seg f={f} from={B(187)} to={B(203)} fade={3}><Montage f={f} /></Seg>
      <Seg f={f} from={B(203)} to={B(211)} fade={2}><Exploded f={f} /></Seg>
      {f >= B(211) ? <Outro f={f} /> : null}
      <Audio
        src={staticFile('music/we-never-learn.wav')}
        startFrom={Math.round(SONG_START * 30)}
        volume={(fr) => Math.min(1, fr / 12) * (fr < DURATION - 60 ? 1 : Math.max(0, (DURATION - fr) / 60))}
      />
    </AbsoluteFill>
  );
};

export { DURATION, easeOut };
