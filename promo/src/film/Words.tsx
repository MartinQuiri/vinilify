import type { CSSProperties, ReactNode } from 'react';
import { SANS } from '../fonts';
import { BEAT, easeOut, easeInOut, mix, p } from './time';
import { BLUE } from './Pieces';

// Palabras del drop. Cada una se anima a su manera, imitando la función que presenta.
// `r` = cuadros desde el inicio del golpe; `y` = altura del centro del texto; `size` = tamaño.

type WordProps = { r: number; y: number; size: number };

const base = (size: number): CSSProperties => ({
  fontFamily: SANS, fontSize: size, fontWeight: 650 as unknown as number, letterSpacing: '-0.035em', lineHeight: 1, color: '#f5f5f7',
  whiteSpace: 'nowrap',
});

function Line({ y, children, style }: { y: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: y, transform: 'translateY(-50%)', display: 'flex', justifyContent: 'center', alignItems: 'center', ...style }}>
      {children}
    </div>
  );
}

// Letras sueltas con un estilo calculado para cada una.
function Letters({ text, size, each }: { text: string; size: number; each: (i: number, n: number) => CSSProperties }) {
  return (
    <span style={{ ...base(size), display: 'inline-flex' }}>
      {[...text].map((ch, i) => (
        <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', ...each(i, text.length) }}>{ch}</span>
      ))}
    </span>
  );
}

// Entrada estándar: sube un poco y se enfoca (la base de casi todas).
const rise = (t: number): CSSProperties => ({ opacity: t, transform: `translateY(${(1 - t) * 26}px)`, filter: `blur(${(1 - t) * 10}px)` });

export function PlayWord({ r, y, size }: WordProps) {
  const t = p(r, 0, 9);
  const ring = p(r, 2, 26);
  return (
    <Line y={y}>
      <div style={{ position: 'absolute', width: size * 1.9, height: size * 1.9, borderRadius: '50%', border: `2px solid ${BLUE}`, opacity: (1 - ring) * 0.8, transform: `scale(${0.4 + ring * 1.6})` }} />
      <span style={{ ...base(size), opacity: t, transform: `scale(${mix(0.72, 1, t)})`, filter: `blur(${(1 - t) * 8}px)` }}>Play.</span>
    </Line>
  );
}

export function LikeWord({ r, y, size }: WordProps) {
  const t = p(r, 0, 8);
  const pop = p(r, 6, 16);
  const heart = 1 + Math.sin(pop * Math.PI) * 0.35;
  return (
    <Line y={y} style={{ gap: size * 0.28 }}>
      <svg viewBox="0 0 24 24" width={size * 0.82} height={size * 0.82} style={{ transform: `scale(${t * heart})`, filter: `drop-shadow(0 0 ${18 * pop}px rgba(255,60,120,.8))` }}>
        <path d="m12 21.3-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z" fill="url(#lg)" />
        <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ff7aa8" /><stop offset="1" stopColor="#ff2d55" /></linearGradient></defs>
      </svg>
      <span style={{ ...base(size), ...rise(t), background: 'linear-gradient(90deg, #fff, #ffb3c9)', WebkitBackgroundClip: 'text', color: 'transparent' }}>Like.</span>
    </Line>
  );
}

export function ShuffleWord({ r, y, size }: WordProps) {
  // Las letras empiezan desordenadas y se ordenan con un movimiento cruzado.
  const text = 'Shuffle.';
  const order = [5, 2, 7, 0, 6, 3, 1, 4];
  const w = size * 0.56;
  return (
    <Line y={y}>
      <Letters
        text={text}
        size={size}
        each={(i) => {
          const t = p(r, 2 + i * 0.6, 16 + i * 0.6, easeInOut);
          const dx = (order[i] - i) * w * (1 - t);
          const dy = Math.sin(t * Math.PI) * (i % 2 ? -1 : 1) * size * 0.35;
          return { transform: `translate(${dx}px, ${dy}px)`, opacity: p(r, 0, 5) };
        }}
      />
    </Line>
  );
}

export function RepeatWord({ r, y, size }: WordProps) {
  const t = p(r, 0, 8);
  const echoes = [1, 2, 3];
  return (
    <Line y={y}>
      {echoes.map((k) => {
        const e = p(r, 4 + k * 4, 14 + k * 4);
        return (
          <span key={k} style={{ ...base(size), position: 'absolute', opacity: (1 - e) * 0.35 * (e > 0 ? 1 : 0), transform: `translateX(${e * size * 1.2 * k}px)` }}>Repeat.</span>
        );
      })}
      <span style={{ ...base(size), ...rise(t) }}>Repeat.</span>
      <svg viewBox="0 0 24 24" width={size * 0.55} height={size * 0.55} style={{ marginLeft: size * 0.22, opacity: p(r, 8, 14), transform: `rotate(${p(r, 8, 30) * 360}deg)` }}>
        <path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2zm-4-2V9h-1l-2 1v1h1.5v4z" fill={BLUE} />
      </svg>
    </Line>
  );
}

export function ScrubWord({ r, y, size }: WordProps) {
  // Entra "arrastrado": se desliza con desenfoque de movimiento, se pasa y vuelve.
  const a = p(r, 0, 10, easeOut);
  const back = p(r, 10, 18, easeInOut);
  const x = mix(-size * 3, size * 0.5, a) - back * size * 0.5;
  const speed = Math.abs(x - (mix(-size * 3, size * 0.5, p(r - 1, 0, 10)) - p(r - 1, 10, 18, easeInOut) * size * 0.5));
  const knob = 0.15 + a * 0.65 - back * 0.2;
  return (
    <Line y={y}>
      <div style={{ position: 'relative' }}>
        <span style={{ ...base(size), display: 'inline-block', transform: `translateX(${x}px) skewX(${-Math.min(18, speed * 0.25)}deg)`, filter: `blur(${Math.min(14, speed * 0.18)}px)`, opacity: p(r, 0, 4) }}>Scrub.</span>
        <div style={{ position: 'absolute', left: '-10%', right: '-10%', bottom: -size * 0.32, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.18)', opacity: p(r, 4, 10) }}>
          <div style={{ width: `${knob * 100}%`, height: '100%', borderRadius: 2, background: BLUE }} />
          <div style={{ position: 'absolute', left: `${knob * 100}%`, top: -7, width: 18, height: 18, marginLeft: -9, borderRadius: 9, background: '#fff' }} />
        </div>
      </div>
    </Line>
  );
}

export function LouderWord({ r, y, size }: WordProps) {
  // Cada letra crece como las barras de un volumen que sube.
  return (
    <Line y={y}>
      <Letters
        text="Louder."
        size={size}
        each={(i, n) => {
          const t = p(r, i * 1.4, 10 + i * 1.4, easeOut);
          const grow = mix(0.45, 1 + (i / (n - 1)) * 0.22 * (1 - p(r, 18, 30)), t);
          return { transform: `scale(${grow})`, transformOrigin: '50% 80%', opacity: t, color: i >= n - 3 ? '#cfe0ff' : '#f5f5f7' };
        }}
      />
    </Line>
  );
}

export function SkipWord({ r, y, size }: WordProps) {
  const t = p(r, 0, 9, easeOut);
  const x = (1 - t) * size * 5;
  const ghost = p(r, 0, 9, easeOut);
  return (
    <Line y={y}>
      <span style={{ ...base(size), position: 'absolute', opacity: 0.35 * (1 - ghost), transform: `translateX(${-ghost * size * 5}px)`, filter: `blur(${ghost * 16}px)` }}>Skip.</span>
      <span style={{ ...base(size), display: 'inline-block', transform: `translateX(${x}px)`, filter: `blur(${(1 - t) * 18}px)` }}>Skip.</span>
    </Line>
  );
}

export function QueueWord({ r, y, size }: WordProps) {
  // Las letras llegan una detrás de otra, como canciones que se suman a la cola.
  return (
    <Line y={y}>
      <Letters
        text="Queue."
        size={size}
        each={(i) => {
          const t = p(r, i * 2.2, 8 + i * 2.2, easeOut);
          return { transform: `translateX(${(1 - t) * size * 2.4}px)`, opacity: t, filter: `blur(${(1 - t) * 8}px)` };
        }}
      />
    </Line>
  );
}

export function DimWord({ r, y, size }: WordProps) {
  const t = p(r, 0, 8);
  const dim = p(r, 10, 26, easeInOut);
  const moon = p(r, 8, 22);
  return (
    <Line y={y} style={{ gap: size * 0.3 }}>
      <svg viewBox="0 0 24 24" width={size * 0.7} height={size * 0.7} style={{ opacity: moon, transform: `rotate(${(1 - moon) * -60}deg) translateY(${(1 - moon) * 20}px)` }}>
        <path d="M12 3a9 9 0 1 0 9 9c0-.5 0-.9-.1-1.4a5.4 5.4 0 0 1-4.4 2.3 5.4 5.4 0 0 1-3.1-9.8L12 3z" fill="#cfd8ff" />
      </svg>
      <span style={{ ...base(size), ...rise(t), opacity: t * mix(1, 0.42, dim) }}>Dim.</span>
    </Line>
  );
}

export function FloatWord({ r, y, size }: WordProps) {
  return (
    <Line y={y}>
      <Letters
        text="Float."
        size={size}
        each={(i) => {
          const t = p(r, i * 1.2, 9 + i * 1.2);
          const bob = Math.sin((r / BEAT) * Math.PI + i * 0.9) * size * 0.08;
          return { transform: `translateY(${(1 - t) * 40 + bob}px)`, opacity: t };
        }}
      />
    </Line>
  );
}

export function LanguageWord({ r, y, size }: WordProps) {
  // Se escribe "English.", se borra y se reescribe "Español." en el tercer golpe.
  const a = 'English.';
  const b = 'Español.';
  const typedA = Math.min(a.length, Math.floor(r / 1.6));
  const erase = Math.max(0, Math.floor((r - 14) / 0.6));
  const typedB = Math.max(0, Math.floor((r - 19) / 1.3));
  let text = a.slice(0, typedA);
  if (r >= 14) text = a.slice(0, Math.max(0, a.length - erase));
  if (r >= 19) text = b.slice(0, Math.min(b.length, typedB));
  const caret = Math.floor(r / 6) % 2 === 0 || (r > 13 && r < 32);
  return (
    <Line y={y}>
      <span style={base(size)}>{text}</span>
      <span style={{ width: 4, height: size * 0.9, marginLeft: 6, background: BLUE, opacity: caret ? 1 : 0, borderRadius: 2 }} />
    </Line>
  );
}

export function ConnectWord({ r, y, size }: WordProps) {
  const t = p(r, 0, 12, easeInOut);
  const spark = p(r, 10, 20);
  return (
    <Line y={y}>
      <span style={{ ...base(size), display: 'inline-block', transform: `translateX(${(1 - t) * -size * 1.6}px)`, opacity: p(r, 0, 5) }}>Con</span>
      <span style={{ ...base(size), display: 'inline-block', transform: `translateX(${(1 - t) * size * 1.6}px)`, opacity: p(r, 0, 5) }}>nect.</span>
      <div style={{ position: 'absolute', width: size * 0.08, height: size * 1.2, background: `radial-gradient(circle, #fff, ${BLUE} 40%, transparent 70%)`, opacity: Math.sin(spark * Math.PI), filter: 'blur(4px)' }} />
    </Line>
  );
}

// Final del drop: frases grandes que entran palabra por palabra.
export function Statement({ r, y, size, words, accent }: WordProps & { words: string[]; accent?: number }) {
  return (
    <Line y={y} style={{ gap: size * 0.26 }}>
      {words.map((w, i) => {
        const t = p(r, i * 3, 10 + i * 3);
        const isAccent = i === accent;
        return (
          <span
            key={i}
            style={{
              ...base(size), ...rise(t),
              ...(isAccent ? { background: 'linear-gradient(90deg, #8fb2ff, #5b8cff 45%, #b18cff)', WebkitBackgroundClip: 'text', color: 'transparent', textShadow: 'none' } : {}),
            }}
          >
            {w}
          </span>
        );
      })}
    </Line>
  );
}

export const WORDS = { PlayWord, LikeWord, ShuffleWord, RepeatWord, ScrubWord, LouderWord, SkipWord, QueueWord, DimWord, FloatWord, LanguageWord, ConnectWord };
export { easeOut };
