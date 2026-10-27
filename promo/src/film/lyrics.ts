// Letra sincronizada de "WE NEVER LEARN" (segundos de la canción → línea), como la mostraría la app.
// Tiempos sacados de la voz (faster-whisper, scripts/transcribe.py) y revisados a mano; cada línea entra
// un instante antes de que se cante, como en un .lrc.
export const LYRICS: Array<{ t: number; text: string }> = [
  { t: 34.0, text: 'Call us crazy, but we do it anyway' },
  { t: 36.8, text: '’Cause we never learn, never learn' },
  { t: 40.5, text: 'We go chasing every fire even when we burn' },
  { t: 44.2, text: 'We break our hearts then wait for our turn' },
  { t: 47.9, text: 'Foolish, but we’d rather feel it' },
  { t: 50.3, text: 'We never learn, we never learn' },
  { t: 53.4, text: 'We never learn' },
];

export function lyricsAt(songTime: number) {
  let i = -1;
  for (let k = 0; k < LYRICS.length; k++) if (LYRICS[k].t <= songTime) i = k;
  const line = (k: number) => (k >= 0 && k < LYRICS.length ? LYRICS[k].text : '');
  return { index: i, since: i >= 0 ? songTime - LYRICS[i].t : 99, prev: line(i - 1), cur: line(i), next: line(i + 1) };
}
