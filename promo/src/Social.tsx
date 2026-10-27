// Imagen para compartir el repo en GitHub (1280×640): el tocadiscos de la app, recreado y suelto en 3D,
// con el logo y una frase al lado. Mismo lenguaje que el video.
import { AbsoluteFill } from 'remotion';
import { SANS } from './fonts';
import { App } from './ui/App';
import { accentOf, TRACKS } from './ui/data';
import { VinylMark } from './film/Pieces';

const HERO = TRACKS.wnl;
const PINK = accentOf(HERO);

export const Social = () => {
  // El tocadiscos ocupa x 115–1040, y 140–735 en la app; se escala y se apoya contra el borde derecho.
  const S = 0.78;
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: SANS, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 640, top: 40, width: 760, height: 560, borderRadius: '50%', background: PINK, filter: 'blur(150px)', opacity: 0.32 }} />
      <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
        <div
          style={{
            position: 'absolute', left: 560 - 115 * S, top: 320 - 443 * S, width: 1920, height: 1080, transformOrigin: '0 0',
            transform: `scale(${S}) rotateY(-16deg) rotateX(6deg)`,
          }}
        >
          <App track={HERO} accent={PINK} playing progress={0.31} angle={38} only={['sleeve', 'disc', 'sheen', 'arm']} />
        </div>
      </div>
      {/* Velo para que el texto se lea si el disco pasa por detrás */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, #000 0%, rgba(0,0,0,.92) 34%, rgba(0,0,0,0) 52%)' }} />
      <div style={{ position: 'absolute', left: 84, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', width: 520 }}>
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <VinylMark size={88} x={44} y={44} glow={0.8} />
        </div>
        <div style={{ marginTop: 26, fontSize: 92, fontWeight: 600, letterSpacing: '-0.035em', lineHeight: 1, color: '#f5f5f7' }}>Vinilify</div>
        <div style={{ marginTop: 20, fontSize: 30, fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1.25, color: '#a1a1a6' }}>
          Whatever you’re playing,<br />now it spins.
        </div>
        <div style={{ marginTop: 34, fontSize: 17, fontWeight: 500, letterSpacing: '0.02em', color: '#6e6e73' }}>
          Free for Windows · Works with Spotify
        </div>
      </div>
    </AbsoluteFill>
  );
};
