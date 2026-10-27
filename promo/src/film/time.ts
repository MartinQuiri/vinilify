// Tiempos del video, atados a la canción ("WE NEVER LEARN", STEELROSE, 130 BPM). Todo en cuadros a 30 fps.
import { Easing, interpolate } from 'remotion';
import beats from '../../public/music/we-never-learn.beats.json';

export const FPS = 30;
export const P = beats.beat_period; // ≈ 0,461 s
const F = beats.first_beat;
// Los compases empiezan en los golpes 4k+3 (el drop cae en el golpe 83, 38,3 s).
// El video arranca en el golpe 51 (23,6 s): 8 compases de subida hasta el primer drop.
export const START_BEAT = 51;
export const SONG_START = F + START_BEAT * P;

// Cuadro del video del golpe `n` de la canción (numeración de la canción).
export const beat = (n: number) => (F + n * P - SONG_START) * FPS;
export const songFrame = (s: number) => (s - SONG_START) * FPS;
export const BEAT = P * FPS; // ≈ 13,8 cuadros
export const BAR = BEAT * 4;

// Secciones (golpes de la canción).
export const S = {
  drop1: 83, // entra el coro tras un silencio (37,5–38,25 s)
  gap: 117, // se va el bajo dos golpes
  groove: 123,
  breakdown: 163,
  silence: 177.6, // silencio antes del segundo drop
  drop2: 179,
  outro: 211,
  hit: 219, // golpe final
  end: 227,
};
export const DURATION = Math.round(beat(S.end));

// Curvas al estilo Apple: arranque decidido y llegada muy suave.
export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const spring = Easing.bezier(0.34, 1.45, 0.5, 1); // se pasa un poco y vuelve

export const p = (f: number, a: number, b: number, easing = easeOut) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
// Pulso que decae en cada golpe (para "latidos" sutiles al ritmo).
export const pulse = (f: number, decay = 6) => {
  const r = ((f % BEAT) + BEAT) % BEAT;
  return Math.exp(-r / decay);
};
