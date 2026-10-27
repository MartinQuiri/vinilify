import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { Record } from './components/Record';
import {
  Backdrop, Caption, Controls, Corner, Cursor, Desktop, Info, Label, Row, SearchBox, SearchPanel, Sleeve, Strip, abs,
} from './components/Ui';
import { CRATE, LYRICS, STRIP_NEXT, STRIP_RECENT, art, cover } from './data';
import { MONO, SERIF_ITALIC, UI } from './fonts';
import { DEG_PER_FRAME, T, easeInOut, mix, prog } from './timeline';

const CENTER = { cx: 960, cy: 540, size: 560 };
const FULL = { cx: 743, cy: 430, size: 560 };
const MINI_A = { cx: 1640, cy: 800, size: 230 };
const MINI_B = { cx: 1500, cy: 430, size: 230 };
const PROTECT_DY = 110;

// Cuadros en que pasa cada portada por la etiqueta: rápido al principio, frenando al final.
const CRATE_TIMES = CRATE.map((_, i) => Math.round(T.crateStart + (T.crateEnd - T.crateStart) * (i / (CRATE.length - 1)) ** 1.9));

// Qué canción suena en cada momento.
const TRACKS: Array<[number, string]> = [[0, 'lux'], [T.trackClick, 'motomami'], [T.nextClick, 'cielito'], [T.finalClick, 'gymnopedie']];
const trackAt = (f: number) => {
  let i = 0;
  while (i + 1 < TRACKS.length && TRACKS[i + 1][0] <= f) i++;
  return { slug: TRACKS[i][1], since: TRACKS[i][0], prev: i > 0 ? TRACKS[i - 1][1] : undefined };
};

// Velocidad de giro del disco (grados por cuadro) y su acumulado.
function speedAt(f: number) {
  if (f < T.needleDrop) return 0.5;
  if (f >= T.outro) return mix(DEG_PER_FRAME, 0.4, prog(f, T.outro, T.logoLock));
  if (f >= T.finalClick && f < T.finalNeedle + 20) {
    return mix(DEG_PER_FRAME, 0, prog(f, T.finalClick, T.finalClick + 14)) + DEG_PER_FRAME * prog(f, T.finalNeedle, T.finalNeedle + 20);
  }
  return mix(0.5, DEG_PER_FRAME, prog(f, T.needleDrop, T.needleDrop + 26));
}
// Se arranca girado para que el corte quede a la derecha (como en el icono) justo cuando se abre.
const RAW: number[] = [];
for (let f = 0, a = -speedAt(0) * (T.notchOpen + 8); f <= T.end; f++) {
  RAW.push(a);
  a += speedAt(f);
}
// En el cierre se corrige el giro para que el logo quede exactamente en su posición original.
const LOCK_FIX = Math.ceil(RAW[T.logoLock] / 360) * 360 - RAW[T.logoLock];
const ANGLES = RAW.map((a, f) => (f < T.outro ? a : a + LOCK_FIX * prog(f, T.outro, T.logoLock, easeInOut)));

// Cursor: puntos de paso (cuadro, x, y) y clics.
const CURSOR: Array<[number, number, number]> = [
  [456, 1320, 1010], [474, 1640, 800], [T.dragStart, 1640, 800], [T.dragEnd, 1500, 430], [548, 1720, 600],
  [604, 1500, 700], [618, 1661, 58], [640, 1500, 420], [T.results + 14, 1413, 445], [T.artistClick, 1413, 445],
  [T.trackClick - 10, 1520, 330], [T.trackClick, 1520, 330], [T.nextClick - 8, 985, 66], [T.nextClick + 14, 1060, 260],
  [888, 1500, 300], [T.moonClick, 1748, 58], [930, 1820, 220],
  [1006, 1500, 300], [T.finalSearch, 1661, 58], [1046, 1560, 360], [T.finalClick - 6, 1520, 168], [T.finalClick + 20, 1560, 250],
];
const CLICKS = [474, 620, T.artistClick, T.trackClick, T.nextClick, T.moonClick, T.finalSearch, T.finalClick];
const CURSOR_VISIBLE: Array<[number, number]> = [[452, 552], [600, 800], [884, 938], [1002, 1104]];

function cursorAt(f: number) {
  let i = 0;
  while (i + 1 < CURSOR.length && CURSOR[i + 1][0] <= f) i++;
  const [f0, x0, y0] = CURSOR[i];
  const [f1, x1, y1] = CURSOR[Math.min(i + 1, CURSOR.length - 1)];
  const t = f1 > f0 ? prog(f, f0, f1, easeInOut) : 1;
  const down = CLICKS.map((c) => (f >= c && f < c + 12 ? (f - c) / 12 : 0)).find((d) => d > 0) ?? 0;
  const vis = Math.max(...CURSOR_VISIBLE.map(([a, b]) => Math.min(prog(f, a, a + 8), 1 - prog(f, b - 8, b))));
  // Mientras arrastra el mini, el botón queda apretado.
  const holding = f >= 474 && f <= T.dragEnd ? 0.25 : 0;
  return { x: mix(x0, x1, t), y: mix(y0, y1, t), down: down || holding, opacity: vis };
}

const typed = (text: string, f: number, start: number, perChar = 7) =>
  text.slice(0, Math.max(0, Math.min(text.length, Math.floor((f - start) / perChar) + 1)));

const lerpPos = (a: typeof CENTER, b: typeof CENTER, t: number) => ({ cx: mix(a.cx, b.cx, t), cy: mix(a.cy, b.cy, t), size: mix(a.size, b.size, t) });

export const Promo = () => {
  const f = useCurrentFrame();
  const track = trackAt(f);
  const c = cover(track.slug);
  const accent = f < T.toPlayer ? '#5b8cff' : c.accent;
  const angle = ANGLES[Math.min(f, ANGLES.length - 1)];

  // ---- Fases ----
  const toFull = prog(f, T.toPlayer, T.playerIn, easeInOut);
  const toMini = prog(f, T.toMini, T.miniIn, easeInOut);
  const drag = prog(f, T.dragStart, T.dragEnd, easeInOut);
  const backFull = prog(f, T.flipStart, T.flipEnd, easeInOut);
  const protect = prog(f, T.protectIn, T.protectIn + 40, easeInOut) * (1 - prog(f, T.protectOut, T.protectOut + 30, easeInOut));
  const outro = prog(f, T.outro, T.logoLock, easeInOut);

  // ---- Buscador: como en la app, al abrirlo el vinilo se corre a la izquierda y el texto se aparta ----
  const firstSearch = prog(f, T.searchOpen - 2, T.searchOpen + 14) * (1 - prog(f, T.searchClose, T.searchClose + 14));
  const finalSearch = prog(f, T.finalSearch + 2, T.finalSearch + 18) * (1 - prog(f, T.finalClose, T.finalClose + 14));
  const panel = Math.max(firstSearch, finalSearch);
  const searchShift = -150 * panel;

  // ---- Disco: posición ----
  let pos = lerpPos(CENTER, FULL, toFull);
  if (f >= T.toMini) pos = lerpPos(FULL, MINI_A, toMini);
  if (f >= T.dragStart) pos = lerpPos(MINI_A, MINI_B, drag);
  if (f >= T.flipStart) pos = lerpPos(MINI_B, FULL, backFull);
  const driftX = Math.sin(f / 70) * 10 * protect;
  const driftY = Math.cos(f / 90) * 7 * protect;
  pos = { ...pos, cx: pos.cx + driftX + searchShift, cy: pos.cy + PROTECT_DY * protect + driftY };
  if (f >= T.outro) pos = lerpPos({ ...FULL }, { cx: 960, cy: 430, size: 500 }, outro);

  // ---- Disco: aspecto (logo ↔ vinilo) ----
  const icon = f < T.outro ? 1 - toFull : outro;
  const notch = f < T.outro
    ? prog(f, T.notchOpen, T.notchOpen + 12) * (1 - prog(f, T.armSpark, T.armDone))
    : prog(f, T.outro + 24, T.logoLock);
  const draw = prog(f, T.drawStart, T.drawEnd, easeInOut);
  const fill = prog(f, 54, 86);
  let crateIndex = -1;
  CRATE_TIMES.forEach((t, i) => { if (f >= t) crateIndex = i; });
  const labelSlug = f < T.crateEnd + 4 ? (crateIndex >= 0 ? CRATE[crateIndex] : 'lux') : track.slug;
  const labelCover = f < T.outro ? prog(f, T.crateStart - 2, T.crateStart + 3) : 1 - prog(f, T.outro + 10, T.logoLock - 10);
  const flip = prog(f, T.flipStart, T.flipStart + 34, easeInOut);
  const bLabel = 1 - prog(f, 628, 652);
  const eclipse = prog(f, T.moonClick + 6, T.moonClick + 34, easeInOut) * (1 - prog(f, T.moonClick + 58, T.moonClick + 86, easeInOut));

  // ---- Brazo ----
  const playing = f >= T.needleDrop && !(f >= T.finalClick && f < T.finalNeedle);
  const songStart = track.since === 0 ? T.needleDrop : track.since === T.finalClick ? T.finalNeedle : track.since;
  const songOffset = { lux: 0.18, motomami: 0.06, cielito: 0.12, gymnopedie: 0 }[track.slug] ?? 0;
  const progress = Math.min(1, songOffset + Math.max(0, f - songStart) / (214 * 30));
  const lowered = prog(f, T.needleDrop - 8, T.needleDrop) * (1 - prog(f, T.finalClick, T.finalClick + 10)) + prog(f, T.finalNeedle - 8, T.finalNeedle);
  const armAngle = mix(-26, progress * 16, Math.min(1, lowered));
  const armDraw = f < T.outro ? prog(f, T.armDraw, T.armDone) : 1 - prog(f, T.outro, T.outro + 34);
  const arm = { angle: armAngle, draw: armDraw, spark: prog(f, T.armSpark, T.armDraw + 6, (x) => x), opacity: 1 };

  // ---- Interfaz ----
  const uiIn = prog(f, T.toPlayer + 12, T.playerIn + 12);
  const uiAway = prog(f, T.toMini, T.toMini + 24) * (1 - prog(f, T.flipStart + 26, T.flipEnd + 12));
  const ui = uiIn * (1 - uiAway) * (1 - prog(f, T.outro, T.outro + 36));
  const desktop = prog(f, T.toMini + 6, T.toMini + 34) * (1 - prog(f, T.flipStart + 6, T.flipStart + 40));
  const sleeveX = mix(-640, 150, prog(f, T.toPlayer + 8, T.playerIn + 16)) - 700 * prog(f, T.outro, T.outro + 40);
  const awake = Math.max(...[[600, 800], [884, 938], [1002, 1110]].map(([a, b]) => Math.min(prog(f, a, a + 10), 1 - prog(f, b - 10, b))));

  const inArtist = f >= T.artistClick + 4;

  // ---- Letra (B2) ----
  const lyricsOn = prog(f, T.lyricsStart - 6, T.lyricsStart + 6) * (1 - prog(f, T.moonClick, T.moonClick + 12));
  const LINE_EVERY = 22;
  const currentLine = Math.max(-1, Math.min(LYRICS.length - 1, Math.floor((f - T.lyricsStart) / LINE_EVERY)));

  const cur = cursorAt(f);

  return (
    <AbsoluteFill style={{ background: '#08080a', fontFamily: UI, overflow: 'hidden' }}>
      {/* Fondo de la app */}
      <Backdrop slug={track.slug} prev={track.prev} mixT={prog(f, track.since, track.since + 24)} opacity={ui} />
      <Desktop opacity={desktop} typed={prog(f, T.miniIn, T.dragEnd + 20, (x) => x)} />

      {/* Funda + textos de la app */}
      {f >= T.toPlayer && f < T.end ? (
        <div style={abs({ inset: 0, transform: `translate(${driftX + searchShift}px, ${PROTECT_DY * protect + driftY}px)` })}>
          <Sleeve slug={track.slug} x={sleeveX} y={150} size={560} opacity={ui} />
        </div>
      ) : null}

      <Record
        {...pos}
        angle={angle}
        icon={icon}
        notch={notch}
        draw={draw}
        fill={fill}
        labelSrc={art(labelSlug)}
        labelCover={labelCover}
        flip={flip}
        bLabel={bLabel}
        eclipse={eclipse}
        arm={f >= T.armSpark ? arm : undefined}
        accent={accent}
      />

      {f >= T.toPlayer ? (
        <div style={abs({ inset: 0, opacity: ui, transform: `translate(${driftX}px, ${PROTECT_DY * protect + driftY}px)` })}>
          <div style={abs({ inset: 0, opacity: 1 - panel })}>
          <Info slug={track.slug} x={1180} y={210} reveal={prog(f, T.playerIn - 14, T.playerIn + 30)} progress={progress} accent={accent} showEyebrow={1 - protect} showAlbum={1}>
            {/* Letra: cada línea "sale" de los surcos del disco */}
            {lyricsOn > 0 ? (
              <div style={{ marginTop: 44, opacity: lyricsOn * (1 - protect) }}>
                {LYRICS.map((line, i) => {
                  const born = prog(f, T.lyricsStart + i * LINE_EVERY - 4, T.lyricsStart + i * LINE_EVERY + 8);
                  const isCur = i === currentLine;
                  return (
                    <div
                      key={line}
                      style={{
                        fontSize: isCur ? 34 : 22,
                        fontWeight: isCur ? 650 : 450,
                        lineHeight: 1.35,
                        color: isCur ? '#f5f3ef' : i < currentLine ? 'rgba(245,243,239,.35)' : 'rgba(245,243,239,.6)',
                        opacity: born,
                        transform: `translateX(${(1 - born) * -40}px)`,
                        transition: 'none',
                      }}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </Info>
          </div>
          <Strip y={856} opacity={1 - protect} rise={prog(f, T.stripIn, T.stripIn + 50)} recent={STRIP_RECENT} next={STRIP_NEXT} />
        </div>
      ) : null}

      {/* Hilos de luz: de los surcos del disco a cada línea de la letra */}
      {lyricsOn > 0 ? (
        <svg width={1920} height={1080} style={abs({ inset: 0, opacity: 1 - protect })}>
          {LYRICS.map((_, i) => {
            const t0 = T.lyricsStart + i * LINE_EVERY - 10;
            const p = prog(f, t0, t0 + 12, (x) => x);
            const gone = prog(f, t0 + 10, t0 + 22);
            if (p <= 0 || gone >= 1) return null;
            const y1 = 430 + (i - 2) * 26;
            const y2 = 690 + i * 46;
            return (
              <path
                key={i}
                d={`M ${FULL.cx + 90} ${y1} C 1050 ${y1}, 1100 ${y2}, 1176 ${y2}`}
                fill="none"
                stroke={accent}
                strokeWidth={2}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="0.3 1"
                strokeDashoffset={-p * 1.3 + 0.3}
                opacity={1 - gone}
                style={{ filter: `drop-shadow(0 0 6px ${accent})` }}
              />
            );
          })}
        </svg>
      ) : null}

      {/* Modo protección: atenúa todo */}
      <div style={abs({ inset: 0, background: '#000', opacity: protect * 0.3, pointerEvents: 'none' })} />

      {/* Controles que aparecen al mover el mouse */}
      <Controls opacity={awake * ui} playing={playing} accent={accent} pressed={f >= T.nextClick && f < T.nextClick + 6 ? 'next' : undefined} />
      <Corner opacity={awake * ui} moonOn={protect > 0.2 || (f >= T.moonClick && f < T.protectOut)} accent={accent} pressed={[620, T.finalSearch].some((c) => f >= c && f < c + 6) ? 'search' : f >= T.moonClick && f < T.moonClick + 6 ? 'moon' : undefined} />

      {/* Mini vinilo: al pasar el mouse muestra su título */}
      {f >= T.miniIn - 4 && f < T.flipStart + 10 ? (
        <div
          style={abs({
            left: pos.cx - 120,
            top: pos.cy + pos.size / 2 + 14,
            width: 240,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'rgba(14,14,16,.88)',
            textAlign: 'center',
            opacity: prog(f, 476, 486) * (1 - prog(f, T.flipStart - 4, T.flipStart + 6)),
            color: '#f5f3ef',
          })}
        >
          <div style={{ fontSize: 17, fontWeight: 700 }}>{c.track}</div>
          <div style={{ fontSize: 14, color: 'rgba(245,243,239,.64)' }}>{c.artist}</div>
        </div>
      ) : null}

      {/* Buscador */}
      {panel > 0 ? (
        <SearchPanel x={(1 - panel) * 640} opacity={1}>
          {f < T.finalSearch ? (
            <>
              <SearchBox text={typed('rosalía', f, T.typeStart)} caret={Math.floor(f / 15) % 2 === 0} accent={accent} />
              {!inArtist ? (
                <div style={{ opacity: prog(f, T.results - 2, T.results + 6) }}>
                  <Label>Canciones</Label>
                  {['motomami', 'lux', 'elmalquerer'].map((s, i) => (
                    <Row key={s} slug={s} accent={accent} t={prog(f, T.results + i * 3, T.results + i * 3 + 10)} />
                  ))}
                  <Label>Artistas</Label>
                  <div style={{ display: 'flex', gap: 22, opacity: prog(f, T.results + 10, T.results + 20) }}>
                    {[['lux', 'ROSALÍA'], ['dtmf', 'Bad Bunny'], ['grasa', 'Nathy Peluso']].map(([s, name]) => (
                      <div key={name} style={{ width: 110, textAlign: 'left' }}>
                        <Img src={art(s)} style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', boxShadow: name === 'ROSALÍA' && f >= T.artistClick - 10 ? `0 0 0 3px ${accent}` : undefined }} />
                        <div style={{ marginTop: 10, fontSize: 15 }}>{name}</div>
                        <div style={{ fontSize: 13, color: 'rgba(245,243,239,.6)' }}>Artista</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ opacity: prog(f, T.artistClick + 4, T.artistClick + 12) }}>
                  <div style={{ marginTop: 18, fontSize: 14, color: 'rgba(245,243,239,.6)' }}>← Volver a los resultados</div>
                  <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 18, padding: 16, borderRadius: 16, background: `linear-gradient(120deg, ${accent}38, rgba(255,255,255,.03))` }}>
                    <Img src={art('lux')} style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, letterSpacing: '0.2em', color: 'rgba(245,243,239,.6)' }}>ARTISTA</div>
                      <div style={{ fontSize: 30, fontWeight: 700 }}>ROSALÍA</div>
                    </div>
                    <div style={{ padding: '10px 18px', borderRadius: 999, background: accent, color: '#0c0c0e', fontSize: 14, fontWeight: 600 }}>▶ Reproducir</div>
                  </div>
                  <Label>Canciones</Label>
                  {[['motomami', 'SAOKO'], ['lux', 'Berghain'], ['elmalquerer', 'MALAMENTE'], ['motomami', 'DESPECHÁ'], ['lux', 'La Perla']].map(([s, title], i) => (
                    <Row key={title} slug={s} title={title} accent={accent} highlight={i === 0 ? prog(f, T.trackClick - 8, T.trackClick) : 0} t={prog(f, T.artistClick + 8 + i * 2, T.artistClick + 16 + i * 2)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <SearchBox text={typed('gymnop', f, T.finalType)} caret={Math.floor(f / 15) % 2 === 0} accent={accent} />
              <div style={{ opacity: prog(f, T.finalResult - 2, T.finalResult + 6) }}><Label>Canciones</Label></div>
              <Row slug="gymnopedie" accent={accent} t={prog(f, T.finalResult, T.finalResult + 10)} highlight={prog(f, T.finalClick - 8, T.finalClick)} />
            </>
          )}
        </SearchPanel>
      ) : null}

      {/* Rótulos de pista */}
      <Caption side="A" n={1} text="Lo que suena, gira." accent={accent} t={prog(f, 128, 156) * (1 - prog(f, T.playerIn - 22, T.playerIn - 6))} />
      <Caption side="A" n={2} text="Siempre encima. Nunca en medio." accent={accent} y={860} t={prog(f, T.miniIn + 4, T.miniIn + 34) * (1 - prog(f, T.flipStart - 14, T.flipStart))} />
      <Caption side="B" n={1} text="Busca. Toca. Suena." accent={accent} t={prog(f, T.searchOpen + 18, T.searchOpen + 46) * (1 - prog(f, T.trackClick + 8, T.trackClick + 22))} />
      <Caption side="B" n={2} text="La letra, si la quieres." accent={accent} t={prog(f, T.lyricsStart - 12, T.lyricsStart + 16) * (1 - prog(f, T.moonClick - 16, T.moonClick))} />
      <Caption side="B" n={3} text="Para la segunda pantalla." accent={accent} t={prog(f, T.protectIn + 16, T.protectIn + 44) * (1 - prog(f, T.protectOut - 14, T.protectOut))} />
      <Caption side="B" n={4} text="Sin cuenta. Sin Premium. Solo música." accent={accent} t={prog(f, T.finalClose + 6, T.finalClose + 36) * (1 - prog(f, T.outro - 6, T.outro + 8))} />

      {/* Cierre: el disco vuelve a ser el logo y aparece el nombre */}
      {f >= T.logoLock - 20 ? (
        <div style={abs({ left: 0, right: 0, top: 712, textAlign: 'center', color: '#f5f3ef' })}>
          <div style={{ fontFamily: SERIF_ITALIC, fontSize: 132, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {'Vinilify'.split('').map((ch, i) => {
              const t = prog(f, T.logoLock + i * 3, T.logoLock + 14 + i * 3);
              return <span key={i} style={{ display: 'inline-block', opacity: t, transform: `translateY(${(1 - t) * 30}px)`, filter: `blur(${(1 - t) * 8}px)` }}>{ch}</span>;
            })}
          </div>
          <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 17, letterSpacing: '0.32em', color: 'rgba(245,243,239,.6)', opacity: prog(f, T.logoLock + 34, T.logoLock + 54) }}>
            PARA WINDOWS · GRATIS · CÓDIGO ABIERTO
          </div>
          <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 19, color: '#5b8cff', opacity: prog(f, T.logoLock + 46, T.logoLock + 66) }}>
            github.com/MartinQuiri/vinilify
          </div>
        </div>
      ) : null}
      <div
        style={abs({
          left: 0, right: 0, bottom: 34, textAlign: 'center', fontFamily: MONO, fontSize: 13, letterSpacing: '0.06em',
          color: 'rgba(245,243,239,.42)', opacity: prog(f, T.logoLock + 50, T.logoLock + 70),
        })}
      >
        Música: «Gymnopedie No 1» — Kevin MacLeod (incompetech.com) · Licencia CC BY 4.0 · Portadas: © sus respectivos artistas y sellos
      </div>

      <Cursor x={cur.x} y={cur.y} down={cur.down} opacity={cur.opacity} />

      {/* ---- Sonido ---- */}
      <Audio
        src={staticFile('sfx/crackle.wav')}
        loop
        volume={(fr) => interpolate(fr, [0, 30, T.finalNeedle, T.finalNeedle + 30, T.end - 50, T.end], [0, 0.55, 0.55, 0.16, 0.16, 0], { extrapolateRight: 'clamp' })}
      />
      <Sequence from={T.notchOpen - 2} durationInFrames={30}><Audio src={staticFile('sfx/needle.wav')} volume={0.5} /></Sequence>
      {CRATE_TIMES.map((t) => (
        <Sequence key={t} from={t} durationInFrames={6}><Audio src={staticFile('sfx/flip.wav')} volume={0.55} /></Sequence>
      ))}
      {[T.toPlayer, T.toMini, T.flipStart, T.protectIn, T.outro].map((t) => (
        <Sequence key={t} from={t - 4} durationInFrames={28}><Audio src={staticFile('sfx/whoosh.wav')} volume={0.45} /></Sequence>
      ))}
      <Sequence from={T.needleDrop - 14} durationInFrames={40}><Audio src={staticFile('sfx/spinup.wav')} volume={0.5} /></Sequence>
      <Sequence from={T.needleDrop - 1} durationInFrames={30}><Audio src={staticFile('sfx/needle.wav')} volume={0.9} /></Sequence>
      {CLICKS.map((t) => (
        <Sequence key={t} from={t} durationInFrames={6}><Audio src={staticFile('sfx/click.wav')} volume={0.6} /></Sequence>
      ))}
      {[...'rosalía'].map((_, i) => (
        <Sequence key={`k${i}`} from={T.typeStart + i * 7} durationInFrames={4}><Audio src={staticFile('sfx/key.wav')} volume={0.5} /></Sequence>
      ))}
      {[...'gymnop'].map((_, i) => (
        <Sequence key={`g${i}`} from={T.finalType + i * 7} durationInFrames={4}><Audio src={staticFile('sfx/key.wav')} volume={0.5} /></Sequence>
      ))}
      <Sequence from={T.finalNeedle - 1} durationInFrames={30}><Audio src={staticFile('sfx/needle.wav')} volume={0.9} /></Sequence>
      <Sequence from={T.logoLock - 2} durationInFrames={50}><Audio src={staticFile('sfx/boom.wav')} volume={0.7} /></Sequence>
      {/* La única música del video: la canción "elegida" en el buscador */}
      <Sequence from={T.finalNeedle + 2}>
        <Audio
          src={staticFile('music/gymnopedie-no-1.mp3')}
          volume={(fr) => interpolate(fr, [0, 20, T.end - T.finalNeedle - 62, T.end - T.finalNeedle - 2], [0, 0.95, 0.95, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
