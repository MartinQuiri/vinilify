// Guion en cuadros (30 fps). El video es un disco: Lado A (A1, A2) y Lado B (B1–B4).
import { Easing, interpolate } from 'remotion';

export const FPS = 30;
export const DURATION = 1380; // 46 s

export const T = {
  // Intro: surcos que se dibujan y el corte del logo
  drawStart: 0,
  drawEnd: 72,
  notchOpen: 76,
  labelPop: 92,
  // Portadas pasando en la etiqueta (como buscar discos en una tienda)
  crateStart: 118,
  crateEnd: 204,
  // El corte del logo se convierte en el brazo
  armSpark: 168,
  armDraw: 190,
  armDone: 218,
  // El disco se va a su lugar y se arma la app
  toPlayer: 222,
  playerIn: 262,
  needleDrop: 268,
  stripIn: 300,
  // A2: mini vinilo
  toMini: 398,
  miniIn: 446,
  dragStart: 476,
  dragEnd: 528,
  // Lado B: el disco se da vuelta y vuelve la pantalla completa
  flipStart: 560,
  flipEnd: 610,
  // B1: buscador
  searchOpen: 622,
  typeStart: 642,
  results: 694,
  artistClick: 724,
  trackClick: 750,
  searchClose: 768,
  // B2: letra
  nextClick: 782,
  lyricsStart: 800,
  // B3: modo protección
  moonClick: 906,
  protectIn: 918,
  protectOut: 1006,
  // B4: final, la canción libre
  finalSearch: 1018,
  finalType: 1034,
  finalResult: 1066,
  finalClick: 1082,
  finalNeedle: 1102,
  finalClose: 1112,
  // Cierre: el disco vuelve a ser el logo
  outro: 1196,
  logoLock: 1252,
  end: DURATION,
};

export const ease = Easing.bezier(0.2, 0.75, 0.2, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

// Interpolación con freno suave y sin salirse del rango.
export const prog = (f: number, a: number, b: number, easing = ease) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// 33⅓ rpm: 200 grados por segundo.
export const DEG_PER_FRAME = (100 / 3) * 360 / 60 / FPS;
