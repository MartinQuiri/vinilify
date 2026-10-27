import { AbsoluteFill, Img, staticFile } from 'remotion';
import type { CSSProperties, ReactNode } from 'react';
import { SANS } from '../fonts';

export const BLUE = '#5b8cff';
const GLOW = '0 0 22px rgba(91,140,255,.55), 0 0 64px rgba(91,140,255,.28)';

// Texto con brillo (estilo MacBook Pro): entra con un barrido de izquierda a derecha y desenfoque.
export function GlowText({
  text, reveal, out = 0, size = 76, y = 540, weight = 600, glow = true, style,
}: { text: ReactNode; reveal: number; out?: number; size?: number; y?: number; weight?: number; glow?: boolean; style?: CSSProperties }) {
  if (reveal <= 0 || out >= 1) return null;
  const edge = reveal * 150 - 25;
  const mask = `linear-gradient(90deg, #000 ${edge - 30}%, transparent ${edge}%)`;
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, top: y, transform: `translateY(-50%) translateY(${-out * 14}px)`,
        textAlign: 'center', fontFamily: SANS, fontSize: size, fontWeight: weight, letterSpacing: '-0.025em', lineHeight: 1.08,
        color: glow ? '#eaf1ff' : '#f5f5f7', textShadow: glow ? GLOW : undefined,
        WebkitMaskImage: reveal < 1 ? mask : undefined, maskImage: reveal < 1 ? mask : undefined,
        filter: `blur(${(1 - reveal) * 6 + out * 10}px)`, opacity: 1 - out, ...style,
      }}
    >
      {text}
    </div>
  );
}

// Muro de portadas en perspectiva que se desplaza lentamente.
const WALL = ['wnl', 'patient', 'housewife', 'expectations', 'solar', 'bbywow', 'petal', 'lies', 'babydoll', 'nicole', 'texas', 'beenby', 'babylon', 'onandon'];
export function CoverWall({ frame, opacity = 1 }: { frame: number; opacity?: number }) {
  const cols = 10;
  const rows = 5;
  const tile = 300;
  const gap = 26;
  const drift = frame * 1.6;
  return (
    <AbsoluteFill style={{ opacity, perspective: 1500, overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute', left: '50%', top: '50%', width: cols * (tile + gap), height: rows * (tile + gap),
          transform: `translate(-50%, -50%) rotateX(16deg) rotateY(-20deg) rotateZ(-5deg) translateX(${-drift}px) scale(1.05)`,
          transformStyle: 'preserve-3d', display: 'grid', gridTemplateColumns: `repeat(${cols}, ${tile}px)`, gap,
        }}
      >
        {Array.from({ length: cols * rows }, (_, i) => {
          const key = WALL[(i * 7 + Math.floor(i / cols) * 3) % WALL.length];
          return (
            <Img
              key={i}
              src={staticFile(`covers/bb/${key}.jpg`)}
              style={{ width: tile, height: tile, borderRadius: 14, objectFit: 'cover', boxShadow: '0 20px 40px rgba(0,0,0,.6)', filter: `brightness(${0.62 + ((i * 37) % 9) / 30})` }}
            />
          );
        })}
      </div>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 65% 60% at 50% 50%, rgba(0,0,0,.15) 0%, rgba(0,0,0,.72) 62%, #000 100%)' }} />
    </AbsoluteFill>
  );
}

// Fondo de escritorio para el mini vinilo: luces difusas azul y violeta, y una ventana de vidrio.
export function Desktop({ frame }: { frame: number }) {
  const t = frame / 30;
  return (
    <AbsoluteFill style={{ background: '#05060d', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -300 + Math.sin(t / 3) * 40, top: -200, width: 1400, height: 1100, borderRadius: '50%', background: '#2b48ff', filter: 'blur(170px)', opacity: 0.55 }} />
      <div style={{ position: 'absolute', right: -250, bottom: -300 + Math.cos(t / 3) * 40, width: 1300, height: 1000, borderRadius: '50%', background: '#7a3dff', filter: 'blur(180px)', opacity: 0.45 }} />
      <div style={{ position: 'absolute', left: 700, top: 300, width: 700, height: 500, borderRadius: '50%', background: '#00c2ff', filter: 'blur(200px)', opacity: 0.18 }} />
      <div
        style={{
          position: 'absolute', left: 150, top: 150, width: 1080, height: 720, borderRadius: 20,
          background: 'rgba(255,255,255,.06)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.1), 0 40px 100px rgba(0,0,0,.45)', backdropFilter: 'blur(30px)',
        }}
      >
        <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 22px' }}>
          {[0, 1, 2].map((i) => <i key={i} style={{ width: 13, height: 13, borderRadius: 7, background: 'rgba(255,255,255,.22)' }} />)}
        </div>
        {[0.7, 0.92, 0.55, 0.84, 0.4, 0.75, 0.6].map((w, i) => (
          <div key={i} style={{ margin: i === 0 ? '46px 60px 0' : '22px 60px 0', height: i === 0 ? 28 : 14, width: `${w * (i === 0 ? 50 : 80)}%`, borderRadius: 8, background: `rgba(255,255,255,${i === 0 ? 0.22 : 0.1})` }} />
        ))}
      </div>
    </AbsoluteFill>
  );
}

// Vinilo del logo con resplandor azul.
export function VinylMark({ size, x = 960, y = 540, rotate = 0, opacity = 1, glow = 1, scale = 1 }: {
  size: number; x?: number; y?: number; rotate?: number; opacity?: number; glow?: number; scale?: number;
}) {
  return (
    <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity, transform: `scale(${scale})` }}>
      <div style={{ position: 'absolute', inset: '-25%', borderRadius: '50%', background: `radial-gradient(circle, rgba(70,110,255,${0.45 * glow}) 0%, rgba(70,110,255,0) 62%)`, filter: 'blur(20px)' }} />
      <Img src={staticFile('brand/vinyl.png')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: `rotate(${rotate}deg)` }} />
    </div>
  );
}

// Línea de luz que cruza el cuadro en diagonal (transición del video del MacBook Pro).
export function LightSweep({ t }: { t: number }) {
  if (t <= 0 || t >= 1) return null;
  const x = -400 + t * 2800;
  return (
    <div
      style={{
        position: 'absolute', left: x, top: -200, width: 6, height: 1500, transform: 'rotate(24deg)',
        background: 'linear-gradient(180deg, transparent, #9fd0ff 30%, #fff 50%, #9fd0ff 70%, transparent)',
        boxShadow: '0 0 30px 8px rgba(120,170,255,.55)', opacity: Math.sin(t * Math.PI),
      }}
    />
  );
}
