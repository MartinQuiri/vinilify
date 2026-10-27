// Puntero al estilo macOS: flecha negra con borde blanco y sombra suave; se encoge al hacer clic.
export function Cursor({ x, y, size = 24, press = 0, opacity = 1 }: { x: number; y: number; size?: number; press?: number; opacity?: number }) {
  const k = size / 24;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none', opacity, zIndex: 50 }}>
      {press > 0 ? (
        <div
          style={{
            position: 'absolute', left: -20 * k, top: -20 * k, width: 40 * k, height: 40 * k, borderRadius: '50%',
            background: 'rgba(255,255,255,.18)', transform: `scale(${0.5 + press * 0.7})`, opacity: press,
          }}
        />
      ) : null}
      <svg
        width={24 * k} height={30 * k} viewBox="0 0 24 30"
        style={{ position: 'absolute', left: -2 * k, top: -1 * k, transform: `scale(${1 - press * 0.12})`, transformOrigin: '2px 1px', filter: `drop-shadow(0 ${2 * k}px ${3 * k}px rgba(0,0,0,.45))` }}
      >
        <path d="M2.5 1.5 L2.5 23 L8 17.8 L11.6 26.3 L15.2 24.8 L11.7 16.6 L19 16.6 Z" fill="#0a0a0a" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// Recorrido del puntero: lista de paradas { f, x, y, click? }. Entre paradas se mueve con una curva suave.
export type Stop = { f: number; x: number; y: number; click?: boolean };
export function cursorAt(stops: Stop[], f: number) {
  if (!stops.length) return { x: 0, y: 0, press: 0 };
  let i = 0;
  while (i + 1 < stops.length && stops[i + 1].f <= f) i++;
  const a = stops[i];
  const b = stops[i + 1];
  let x = a.x;
  let y = a.y;
  if (b && f > a.f) {
    // Sale de `a` 8 cuadros antes de llegar a `b` (o antes, si el tramo es más corto).
    const travel = Math.min(14, b.f - a.f);
    const t = Math.max(0, Math.min(1, (f - (b.f - travel)) / travel));
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    x = a.x + (b.x - a.x) * e;
    y = a.y + (b.y - a.y) * e;
  }
  let press = 0;
  for (const s of stops) {
    if (!s.click) continue;
    const d = f - s.f;
    if (d > -4 && d < 8) press = Math.max(press, d < 0 ? 1 + d / 4 : 1 - d / 8);
  }
  return { x, y, press };
}
