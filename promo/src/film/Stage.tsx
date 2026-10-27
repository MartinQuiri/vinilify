// Cámara y escenario para la app recreada.
import type { CSSProperties, ReactNode } from 'react';

// Pone el punto (cx, cy) de la app (px CSS) en (x, y) de la pantalla, con zoom y giro 3D alrededor de ese punto.
export function Cam({
  cx = 960, cy = 540, zoom = 1, x = 960, y = 540, rx = 0, ry = 0, rz = 0, opacity = 1, blur = 0, children, style,
}: {
  cx?: number; cy?: number; zoom?: number; x?: number; y?: number; rx?: number; ry?: number; rz?: number;
  opacity?: number; blur?: number; children: ReactNode; style?: CSSProperties;
}) {
  if (opacity <= 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2200, opacity, filter: blur > 0.3 ? `blur(${blur}px)` : undefined, ...style }}>
      <div
        style={{
          position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: `${cx}px ${cy}px`,
          transform: `translate(${x - cx}px, ${y - cy}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${zoom})`,
          transformStyle: 'preserve-3d',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Una pieza suelta flotando: resplandor de color detrás (como los primeros planos de Apple).
export function Halo({ x, y, w, h, color, opacity = 1 }: { x: number; y: number; w: number; h: number; color: string; opacity?: number }) {
  return (
    <div
      style={{
        position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: '50%',
        background: color, filter: 'blur(120px)', opacity: 0.35 * opacity,
      }}
    />
  );
}

// Posiciones de las partes de la app a pantalla completa (1920×1080 px CSS), medidas en la app real.
export const L = {
  sleeve: { x: 406.8, y: 442.8, w: 583.2 },
  record: { x: 733.4, y: 442.8, w: 583.2 },
  pivot: { x: 1025, y: 186 },
  info: { x: 1500, y: 443 },
  title: { x: 1500, y: 348 },
  progress: { x: 1500, y: 540 },
  volume: { x: 1206, y: 600 },
  controls: { x: 961, y: 67 },
  shuffle: { x: 810, y: 67 },
  play: { x: 923, y: 67 },
  next: { x: 984, y: 67 },
  repeat: { x: 1038, y: 67 },
  like: { x: 1111, y: 67 },
  corner: { x: 1738, y: 49 },
  protect: { x: 1729, y: 49 },
  strip: { x: 961, y: 951 },
  search: { x: 1640, y: 540 },
};
