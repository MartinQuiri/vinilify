import { Img } from 'remotion';
import { SERIF_ITALIC, MONO } from '../fonts';

// El disco del video. Según `icon` se ve como el logo de Vinilify (brillo azul, etiqueta blanca, corte)
// o como el vinilo de la app (surcos negros y la portada en la etiqueta). Todo se interpola.
export type RecordProps = {
  cx: number;
  cy: number;
  size: number;
  angle: number;
  icon?: number; // 1 = logo, 0 = vinilo
  notch?: number; // apertura del corte del logo (0–1)
  draw?: number; // intro: surcos que se dibujan (0–1)
  fill?: number; // opacidad del disco sólido
  labelSrc?: string | null;
  labelCover?: number; // 0 = etiqueta blanca del logo, 1 = portada
  flip?: number; // 0–1: se da vuelta (Lado B)
  arm?: { angle: number; draw: number; spark: number; opacity: number };
  accent?: string;
  shadow?: number;
  bLabel?: number; // en la cara B: 1 = rótulo "Lado B", 0 = portada
  eclipse?: number; // 0–1: un círculo tapa el disco y lo vuelve luna creciente
};

// Corte del logo: una ranura curva que sale de la etiqueta hacia el borde derecho.
function slitPath(open: number) {
  const pts: Array<[number, number]> = [];
  const top: Array<[number, number]> = [];
  const bottom: Array<[number, number]> = [];
  for (let i = 0; i <= 24; i++) {
    const x = 64 + (35.6 * i) / 24;
    const t = (x - 64) / 36;
    const yc = 52.5 - 7 * t ** 1.5;
    const hw = open * (0.4 + 5.2 * t ** 1.25);
    top.push([x, yc - hw]);
    bottom.push([x, yc + hw]);
  }
  pts.push(...top, ...bottom.reverse());
  return 'M' + pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(' L') + ' Z';
}

function notchMask(open: number) {
  const circle = 'M0,50 a50,50 0 1,0 100,0 a50,50 0 1,0 -100,0 Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" fill="#000" d="${circle} ${slitPath(open)}"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

const GROOVES = 22;

function Face({ props, back }: { props: RecordProps; back?: boolean }) {
  const { angle, icon = 0, notch = 0, draw = 1, fill = 1, labelSrc, labelCover = 0, accent = '#c0a87c' } = props;
  const mask = notch > 0.001 ? notchMask(notch) : undefined;
  return (
    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: back ? 'rotateY(180deg)' : undefined }}>
      {/* Disco sólido (surcos + brillos), con el corte del logo como máscara */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          opacity: fill,
          transform: `rotate(${angle}deg)`,
          WebkitMaskImage: mask,
          maskImage: mask,
          WebkitMaskSize: '100% 100%',
          background: `
            radial-gradient(circle closest-side, transparent 0 33%, #0f0f12 33% 40%, transparent 40% 95.5%, #0b0b0d 95.5% 100%),
            radial-gradient(circle closest-side, transparent 0 55%, rgba(0,0,0,.55) 55.4% 56%, transparent 56.4% 71%, rgba(0,0,0,.55) 71.4% 72%, transparent 72.4% 85%, rgba(0,0,0,.55) 85.4% 86%, transparent 86.4%),
            repeating-radial-gradient(circle closest-side, #121215 0 0.4%, #1f1f24 0.6% 0.75%, #121215 0.95% 1.25%)`,
        }}
      >
        {/* Brillo azul del logo: gira con el disco, como en el icono */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            opacity: icon,
            mixBlendMode: 'screen',
            background:
              'conic-gradient(from 160deg, transparent 0 6%, rgba(30,80,255,.95) 14%, rgba(90,150,255,.9) 18%, transparent 30% 52%, rgba(30,80,255,.9) 62%, rgba(110,170,255,.8) 66%, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(circle closest-side, transparent 0 40%, #000 42% 97%, transparent 99%)',
          }}
        />
      </div>
      {/* Reflejo fijo de la luz (no gira) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          opacity: fill * (1 - icon * 0.6),
          background:
            'conic-gradient(from 25deg, transparent 0 4%, rgba(255,255,255,.05) 7%, rgba(255,255,255,.1) 9%, rgba(255,255,255,.05) 11%, transparent 14% 54%, rgba(255,255,255,.04) 57%, rgba(255,255,255,.07) 59%, rgba(255,255,255,.04) 61%, transparent 64%)',
          WebkitMaskImage: 'radial-gradient(circle closest-side, transparent 0 41%, #000 42% 98%, transparent 100%)',
        }}
      />
      {/* Intro: surcos que se dibujan uno a uno, de adentro hacia afuera */}
      {draw < 1 || fill < 1 ? (
        <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity: 1 - fill * 0.9 }}>
          {Array.from({ length: GROOVES }, (_, i) => {
            const r = 17 + (i / (GROOVES - 1)) * 32.5;
            const p = Math.max(0, Math.min(1, draw * 1.7 - (i / GROOVES) * 0.7));
            return (
              <circle
                key={i}
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke="rgba(245,243,239,.85)"
                strokeWidth={i === GROOVES - 1 ? 0.35 : 0.14}
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - p}
                transform={`rotate(${-90 + i * 23 + angle * 0.3} 50 50)`}
              />
            );
          })}
        </svg>
      ) : null}
      {/* Etiqueta: blanca (logo) o la portada (vinilo). En la cara B lleva el rótulo "Lado B". */}
      <div
        style={{
          position: 'absolute',
          inset: '33.5%',
          borderRadius: '50%',
          overflow: 'hidden',
          opacity: fill,
          transform: `rotate(${angle}deg)`,
          background: 'radial-gradient(circle at 40% 35%, #ffffff, #eef0f6 60%, #dfe3ee)',
          boxShadow: 'inset 0 0 0 2px rgba(0,0,0,.25)',
        }}
      >
        {back && labelSrc ? (
          <Img src={labelSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: labelCover }} />
        ) : null}
        {back ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: props.bLabel ?? 1,
              background: accent,
              display: 'grid',
              placeItems: 'center',
              color: '#0b0b0d',
            }}
          >
            <div style={{ textAlign: 'center', transform: 'translateY(-4%)' }}>
              <div style={{ fontFamily: SERIF_ITALIC, fontSize: props.size * 0.13, lineHeight: 1 }}>B</div>
              <div style={{ fontFamily: MONO, fontSize: props.size * 0.017, letterSpacing: '0.3em', marginTop: props.size * 0.008 }}>
                LADO B · 33⅓
              </div>
            </div>
          </div>
        ) : labelSrc ? (
          <Img src={labelSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: labelCover }} />
        ) : null}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: '9%',
            height: '9%',
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            background: '#08080a',
            boxShadow: '0 0 0 2px rgba(255,255,255,.3)',
          }}
        />
      </div>
    </div>
  );
}

export function Tonearm({ angle, draw, spark, opacity, accent }: { angle: number; draw: number; spark: number; opacity: number; accent: string }) {
  const tube = 'M100 6 L86.2 64.5 Q85 70.5 81.6 75.4';
  const parts = Math.max(0, Math.min(1, (draw - 0.55) / 0.45)); // cápsula y contrapeso al final
  return (
    <svg viewBox="0 0 100 100" style={{ position: 'absolute', inset: 0, overflow: 'visible', opacity, filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.55))' }}>
      <defs>
        <linearGradient id="cyl" x1="0" x2="1">
          <stop offset="0" stopColor="#4a4a50" />
          <stop offset=".38" stopColor="#d8d8dc" />
          <stop offset=".5" stopColor="#ffffff" />
          <stop offset=".62" stopColor="#c4c4c9" />
          <stop offset="1" stopColor="#55555b" />
        </linearGradient>
        <radialGradient id="hub" cx=".35" cy=".3" r=".85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".45" stopColor="#c2c2c7" />
          <stop offset="1" stopColor="#5e5e64" />
        </radialGradient>
        <radialGradient id="plinth" cx=".4" cy=".3" r=".9">
          <stop offset="0" stopColor="#303036" />
          <stop offset="1" stopColor="#121215" />
        </radialGradient>
        <linearGradient id="shell" x1="0" x2="1">
          <stop offset="0" stopColor="#f0f0f2" />
          <stop offset=".55" stopColor="#b4b4ba" />
          <stop offset="1" stopColor="#76767c" />
        </linearGradient>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Chispa: la línea del corte del logo que sube hasta donde nace el brazo */}
      {spark > 0 && spark < 1 ? (
        <path
          d="M66 51.5 C 80 50 95 47 99.4 44 C 104 36 103 18 100 6"
          fill="none"
          stroke={accent}
          strokeWidth={0.9}
          strokeLinecap="round"
          filter="url(#glow)"
          pathLength={1}
          strokeDasharray="0.35 1"
          strokeDashoffset={-spark * 1.35 + 0.35}
        />
      ) : null}

      <g style={{ transformOrigin: '100px 6px', transformBox: 'view-box', transform: `scale(${0.6 + 0.4 * Math.min(1, draw * 2)})`, opacity: Math.min(1, draw * 3) }}>
        <circle cx={100} cy={6} r={10} fill="url(#plinth)" stroke="#3a3a40" strokeWidth={0.45} />
        <circle cx={100} cy={6} r={7.6} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={0.35} />
        <circle cx={100} cy={6} r={6.2} fill="#0d0d10" stroke="#26262b" strokeWidth={0.4} />
      </g>

      <g style={{ transformOrigin: '100px 6px', transformBox: 'view-box', transform: `rotate(${angle}deg)` }}>
        <g opacity={parts} transform="rotate(14 100 6)">
          <rect x={98.7} y={-2} width={2.6} height={5} fill="#6a6a70" />
          <rect x={95.6} y={-12} width={8.8} height={10.4} rx={1.4} fill="url(#cyl)" />
          <rect x={95.6} y={-12} width={8.8} height={1.6} rx={0.8} fill="#2a2a2f" />
          <path d="M95.6 -7.6h8.8M95.6 -5.6h8.8" stroke="rgba(0,0,0,.3)" strokeWidth={0.3} />
        </g>
        {[['#5f5f66', 2.3, 1], ['#c9c9ce', 1.5, 1], ['#ffffff', 0.45, 0.85]].map(([color, width, op]) => (
          <path
            key={String(color)}
            d={tube}
            fill="none"
            stroke={String(color)}
            strokeWidth={Number(width)}
            strokeLinecap="round"
            opacity={Number(op)}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - Math.min(1, draw * 1.25)}
          />
        ))}
        <g opacity={parts} transform="rotate(36 80.6 78)">
          <path d="M83.7 76.6 q3.4 .3 4.1 3" fill="none" stroke="#a8a8ae" strokeWidth={0.8} strokeLinecap="round" />
          <path d="M77.2 74.4 h6.8 l-.5 5.4 h-5.8 z" fill="url(#shell)" stroke="#4e4e54" strokeWidth={0.3} />
          <rect x={77.9} y={79.6} width={5.4} height={4.4} rx={0.5} fill="#151518" stroke="#2c2c31" strokeWidth={0.3} />
          <rect x={77.9} y={81} width={5.4} height={0.8} fill={accent} />
          <path d="M80.6 84 v1.4" stroke="#e8e8ea" strokeWidth={0.35} strokeLinecap="round" />
        </g>
        <g opacity={Math.min(1, draw * 3)}>
          <circle cx={100} cy={6} r={4.8} fill="#1b1b1f" stroke="#45454b" strokeWidth={0.4} />
          <circle cx={100} cy={6} r={3.4} fill="url(#hub)" />
          <circle cx={100} cy={6} r={0.9} fill="#38383e" />
        </g>
      </g>
    </svg>
  );
}

export function Record(props: RecordProps) {
  const { cx, cy, size, flip = 0, arm, accent = '#c0a87c', shadow = 1, eclipse = 0 } = props;
  // Eclipse: un círculo del mismo tamaño entra desde arriba a la derecha y "muerde" el disco.
  const ex = 150 - eclipse * 112;
  const ey = -50 + eclipse * 76;
  const eclipseMask = eclipse > 0.001
    ? `radial-gradient(circle ${size * 0.5}px at ${ex}% ${ey}%, transparent ${size * 0.5 - 1.5}px, #000 ${size * 0.5}px)`
    : undefined;
  return (
    <div style={{ position: 'absolute', left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      {eclipse > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            inset: '-8%',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${accent}55 0, transparent 62%)`,
            opacity: Math.sin(eclipse * Math.PI) * 0.9,
            filter: 'blur(30px)',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: '2%',
          borderRadius: '50%',
          boxShadow: `0 ${size * 0.05}px ${size * 0.1}px -${size * 0.02}px rgba(0,0,0,${0.75 * shadow * (1 - eclipse)})`,
          opacity: props.fill ?? 1,
        }}
      />
      <div style={{ position: 'absolute', inset: 0, perspective: size * 3, WebkitMaskImage: eclipseMask, maskImage: eclipseMask }}>
        <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${flip * 180}deg)` }}>
          <Face props={props} />
          <Face props={props} back />
        </div>
      </div>
      {arm ? <Tonearm {...arm} accent={accent} /> : null}
    </div>
  );
}
