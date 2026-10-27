import { Img } from 'remotion';
import type { CSSProperties, ReactNode } from 'react';
import { MONO, SERIF_ITALIC, UI } from '../fonts';
import { art, cover } from '../data';

const INK = '#f5f3ef';
const MUTED = 'rgba(245,243,239,.64)';
const FAINT = 'rgba(245,243,239,.4)';

export const abs = (s: CSSProperties): CSSProperties => ({ position: 'absolute', ...s });

// Fondo: la portada muy difuminada, con viñeta. Dos capas para fundir entre portadas.
export function Backdrop({ slug, prev, mixT, opacity }: { slug: string; prev?: string; mixT: number; opacity: number }) {
  const layer = (s: string, o: number) => (
    <Img
      src={art(s)}
      style={abs({ inset: '-12%', width: '124%', height: '124%', objectFit: 'cover', filter: 'blur(90px) saturate(1.5) brightness(.42)', opacity: o })}
    />
  );
  return (
    <div style={abs({ inset: 0, overflow: 'hidden', opacity })}>
      {prev ? layer(prev, 1 - mixT) : null}
      {layer(slug, prev ? mixT : 1)}
      <div style={abs({ inset: 0, background: 'radial-gradient(ellipse 70% 60% at 42% 42%, transparent 0, rgba(0,0,0,.35) 60%, rgba(0,0,0,.8) 100%)' })} />
    </div>
  );
}

export function Sleeve({ slug, x, y, size, opacity }: { slug: string; x: number; y: number; size: number; opacity: number }) {
  return (
    <div
      style={abs({
        left: x,
        top: y,
        width: size,
        height: size,
        opacity,
        borderRadius: 4,
        overflow: 'hidden',
        boxShadow: '0 32px 64px -16px rgba(0,0,0,.8), 0 0 0 1px rgba(255,255,255,.06)',
      })}
    >
      <Img src={art(slug)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={abs({ inset: 0, background: 'linear-gradient(115deg, rgba(255,255,255,.14), transparent 38%), linear-gradient(90deg, rgba(0,0,0,.25), transparent 4%)' })} />
    </div>
  );
}

// Columna de texto: "Sonando ahora", título, artista, álbum, línea de tiempo.
export function Info({
  slug, x, y, reveal, progress, accent, eyebrow = 'Sonando ahora', showEyebrow = 1, showAlbum = 1, children,
}: {
  slug: string; x: number; y: number; reveal: number; progress: number; accent: string;
  eyebrow?: string; showEyebrow?: number; showAlbum?: number; children?: ReactNode;
}) {
  const c = cover(slug);
  // Cada línea entra un poco después que la anterior.
  const line = (i: number): CSSProperties => {
    const t = Math.max(0, Math.min(1, reveal * 1.6 - i * 0.15));
    return { opacity: t, transform: `translateY(${(1 - t) * 18}px)` };
  };
  const dur = 214;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div style={abs({ left: x, top: y, width: 640, fontFamily: UI, color: INK })}>
      <div style={{ ...line(0), opacity: line(0).opacity as number * showEyebrow, display: 'flex', alignItems: 'center', gap: 14, fontSize: 15, fontWeight: 600, letterSpacing: '0.28em', textTransform: 'uppercase', color: accent }}>
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'flex-end', height: 15 }}>
          {[0.5, 1, 0.7].map((h, i) => <i key={i} style={{ width: 3, height: `${h * 100}%`, background: accent, borderRadius: 1 }} />)}
        </span>
        {eyebrow}
      </div>
      <div style={{ ...line(1), marginTop: 18, fontSize: c.track.length > 13 ? 68 : 82, fontWeight: 700, lineHeight: 1.06, letterSpacing: '-0.025em', textWrap: 'balance' } as CSSProperties}>{c.track}</div>
      <div style={{ ...line(2), marginTop: 18, fontSize: 32, fontWeight: 500, opacity: (line(2).opacity as number) * 0.92 }}>{c.artist}</div>
      <div style={{ ...line(3), marginTop: 6, fontSize: 22, color: MUTED, opacity: (line(3).opacity as number) * showAlbum }}>{c.album}</div>
      <div style={{ ...line(4), marginTop: 46 }}>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: accent }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 15, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmt(progress * dur)}</span>
          <span>{fmt(dur)}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

export function Strip({ y, opacity, rise, recent, next }: { y: number; opacity: number; rise: number; recent: string[]; next: string[] }) {
  const group = (title: string, items: string[], dim: boolean, offset: number) => (
    <div>
      <div style={{ fontFamily: UI, fontSize: 13, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: FAINT, marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', gap: 26 }}>
        {items.map((s, i) => {
          const t = Math.max(0, Math.min(1, rise * 2.2 - (i + offset) * 0.09));
          return (
            <div key={s} style={{ width: 118, opacity: t * (dim ? 0.5 : 1), transform: `translateY(${(1 - t) * 24}px)`, filter: dim ? 'saturate(.55)' : undefined }}>
              <Img src={art(s)} style={{ width: 118, height: 118, borderRadius: 6, objectFit: 'cover', display: 'block', boxShadow: '0 12px 22px -8px rgba(0,0,0,.7)' }} />
              <div style={{ marginTop: 10, fontFamily: UI, fontSize: 14, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cover(s).track}</div>
              <div style={{ fontFamily: UI, fontSize: 12.5, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cover(s).artist}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
  return (
    <div style={abs({ left: 0, right: 0, top: y, display: 'flex', justifyContent: 'center', gap: 90, opacity })}>
      {group('Recientes', recent, true, 0)}
      {group('A continuación', next, false, recent.length)}
    </div>
  );
}

// Controles de arriba: aleatorio, anterior, reproducir, siguiente, repetir | Me gusta.
export function Controls({ opacity, playing, accent, pressed }: { opacity: number; playing: boolean; accent: string; pressed?: string }) {
  const btn = (name: string, path: string, big = false, on = false) => (
    <div
      key={name}
      style={{
        width: big ? 50 : 34,
        height: big ? 50 : 34,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: big ? INK : 'transparent',
        color: big ? '#111' : on ? accent : INK,
        opacity: big || on ? 1 : 0.8,
        transform: pressed === name ? 'scale(.86)' : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" width={big ? 22 : 20} height={big ? 22 : 20} fill="currentColor"><path d={path} /></svg>
    </div>
  );
  return (
    <div style={abs({ left: '50%', top: 40, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 22, opacity })}>
      {btn('shuffle', 'M10.6 9.2 5.4 4 4 5.4l5.2 5.2zM14.5 4l2 2L4 18.6 5.4 20 18 7.5l2 2V4zm.3 9.4-1.4 1.4 3.1 3.1-2 2.1H20v-5.5l-2 2z')}
      {btn('previous', 'M6 5h2v14H6zM20 5v14L9 12z')}
      {btn('toggle', playing ? 'M6 4h4.5v16H6zM13.5 4H18v16h-4.5z' : 'M7 4.5v15L20 12z', true)}
      {btn('next', 'M16 5h2v14h-2zM4 5v14l11-7z')}
      {btn('repeat', 'M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z')}
      <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,.15)' }} />
      {btn('like', 'm12 21.3-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z', false, true)}
    </div>
  );
}

export function Corner({ opacity, moonOn, accent, pressed }: { opacity: number; moonOn: boolean; accent: string; pressed?: string }) {
  const round = (name: string, path: string, on = false) => (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        background: on ? accent : 'rgba(20,20,22,.7)',
        color: on ? '#111' : INK,
        transform: pressed === name ? 'scale(.86)' : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor"><path d={path} /></svg>
    </div>
  );
  return (
    <div style={abs({ right: 56, top: 38, display: 'flex', gap: 8, alignItems: 'center', opacity })}>
      <div style={{ height: 40, padding: '0 18px 0 14px', borderRadius: 999, background: 'rgba(20,20,22,.7)', display: 'flex', alignItems: 'center', gap: 9, fontFamily: UI, fontSize: 15, color: INK, transform: pressed === 'search' ? 'scale(.92)' : undefined }}>
        <svg viewBox="0 0 24 24" width={17} height={17} fill="currentColor"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" /></svg>
        Buscar
      </div>
      {round('moon', 'M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4a5.4 5.4 0 0 1-4.4 2.3 5.4 5.4 0 0 1-3.1-9.8L12 3z', moonOn)}
      {round('mini', 'M3 5h18v8h-2V7H5v10h6v2H3zM13 15h8v6h-8z')}
      {round('close', 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6 10.6 12 5 6.4z')}
    </div>
  );
}

// Rótulo de pista tipo "notas de la funda": A1, A2, B1… y una frase corta en serif.
export function Caption({ side, n, text, t, x = 72, y = 34, accent }: { side: string; n: number; text: string; t: number; x?: number; y?: number; accent: string }) {
  const show = Math.max(0, Math.min(1, t));
  const words = text.split(' ');
  return (
    <div style={abs({ left: x, top: y, color: INK, opacity: show > 0 ? 1 : 0 })}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, fontFamily: MONO, fontSize: 18, letterSpacing: '0.24em', color: accent, clipPath: `inset(0 ${100 - show * 100}% 0 0)` }}>
        <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: '0.06em' }}>{side}{n}</span>
        <span style={{ color: MUTED }}>LADO {side} · PISTA {n}</span>
      </div>
      <div style={{ marginTop: 8, fontFamily: SERIF_ITALIC, fontSize: 56, lineHeight: 1.04, maxWidth: 900 }}>
        {words.map((w, i) => {
          const wt = Math.max(0, Math.min(1, show * 2.2 - i * 0.12));
          return (
            <span key={i} style={{ display: 'inline-block', marginRight: '0.24em', opacity: wt, transform: `translateY(${(1 - wt) * 22}px)`, filter: `blur(${(1 - wt) * 6}px)` }}>{w}</span>
          );
        })}
      </div>
    </div>
  );
}

export function Cursor({ x, y, down, opacity }: { x: number; y: number; down: number; opacity: number }) {
  return (
    <div style={abs({ left: x, top: y, opacity, zIndex: 50 })}>
      {down > 0 ? (
        <div style={abs({ left: -22, top: -22, width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(255,255,255,.7)', transform: `scale(${0.4 + down * 1.1})`, opacity: 1 - down })} />
      ) : null}
      <svg width={30} height={34} viewBox="0 0 30 34" style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.6))', transform: `scale(${1 - Math.sin(down * Math.PI) * 0.12})`, transformOrigin: '2px 2px' }}>
        <path d="M2 2 L2 26 L8.5 20 L13 30 L17.5 28 L13 18.5 L22 18.5 Z" fill="#fff" stroke="#111" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function SearchPanel({ x, opacity, children }: { x: number; opacity: number; children: ReactNode }) {
  return (
    <div style={abs({ top: 0, bottom: 0, right: 0, width: 600, transform: `translateX(${x}px)`, opacity, padding: '34px 38px', background: 'rgba(12,12,14,.84)', backdropFilter: 'blur(28px)', boxShadow: '-24px 0 70px rgba(0,0,0,.5)', fontFamily: UI, color: INK })}>
      {children}
    </div>
  );
}

export function SearchBox({ text, caret, accent }: { text: string; caret: boolean; accent: string }) {
  return (
    <div style={{ height: 50, borderRadius: 999, background: 'rgba(255,255,255,.08)', boxShadow: `inset 0 0 0 1.5px ${accent}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', fontSize: 17 }}>
      <svg viewBox="0 0 24 24" width={19} height={19} fill={MUTED}><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.8 4.8-1.4 1.4-4.8-4.8A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" /></svg>
      <span>{text}</span>
      <span style={{ width: 2, height: 22, background: INK, opacity: caret ? 1 : 0, marginLeft: -10 }} />
    </div>
  );
}

export function Row({ slug, t, highlight, accent, title }: { slug: string; t: number; highlight?: number; accent: string; title?: string }) {
  const c = cover(slug);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 10px', borderRadius: 10, background: `rgba(255,255,255,${0.09 * (highlight ?? 0)})`, opacity: t, transform: `translateY(${(1 - t) * 14}px)` }}>
      <Img src={art(slug)} style={{ width: 48, height: 48, borderRadius: 5, objectFit: 'cover' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, color: (highlight ?? 0) > 0.5 ? accent : INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title ?? c.track}</div>
        <div style={{ fontSize: 13.5, color: MUTED, marginTop: 2 }}>{c.artist}</div>
      </div>
    </div>
  );
}

export const Label = ({ children }: { children: ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: FAINT, margin: '26px 0 12px' }}>{children}</div>
);

// Escritorio de fondo para el mini vinilo: fondo de pantalla, un editor abierto y la barra de tareas.
export function Desktop({ opacity, typed }: { opacity: number; typed: number }) {
  const code = [
    ['const', ' vinilo = ', '{ rpm: 33.3 }'],
    ['function', ' girar', '(disco) {'],
    ['  return', ' disco.angulo + ', 'vinilo.rpm * 6'],
    ['}', '', ''],
    ['', '', ''],
    ['// lo que suena, gira', '', ''],
  ];
  const visible = Math.floor(typed * 140);
  let used = 0;
  return (
    <div style={abs({ inset: 0, opacity, background: 'radial-gradient(120% 90% at 20% 10%, #24304d 0%, #121624 55%, #0a0c14 100%)' })}>
      <div style={abs({ left: 140, top: 110, width: 1180, height: 700, borderRadius: 14, background: '#14161d', boxShadow: '0 40px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.06)', overflow: 'hidden' })}>
        <div style={{ height: 40, background: '#1b1e27', display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <i key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c, opacity: 0.8 }} />)}
          <span style={{ marginLeft: 16, fontFamily: MONO, fontSize: 13, color: FAINT }}>proyecto.js</span>
        </div>
        <div style={{ padding: '30px 34px', fontFamily: MONO, fontSize: 21, lineHeight: 1.9 }}>
          {code.map((parts, i) => {
            const text = parts.join('');
            const start = used;
            used += text.length;
            const shown = Math.max(0, Math.min(text.length, visible - start));
            let rest = shown;
            return (
              <div key={i} style={{ minHeight: '1.9em' }}>
                <span style={{ color: 'rgba(245,243,239,.25)', marginRight: 26 }}>{i + 1}</span>
                {parts.map((p, j) => {
                  const piece = p.slice(0, Math.max(0, rest));
                  rest -= p.length;
                  const color = text.startsWith('//') ? '#6b7489' : ['#c792ea', '#e8e6e3', '#ffcb6b'][j];
                  return <span key={j} style={{ color }}>{piece}</span>;
                })}
              </div>
            );
          })}
        </div>
      </div>
      <div style={abs({ left: 0, right: 0, bottom: 0, height: 56, background: 'rgba(16,18,26,.85)', backdropFilter: 'blur(20px)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 })}>
        {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ width: 34, height: 34, borderRadius: 8, background: i === 3 ? 'rgba(120,150,255,.5)' : 'rgba(255,255,255,.1)' }} />)}
      </div>
    </div>
  );
}
