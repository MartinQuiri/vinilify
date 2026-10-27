import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

// Serif para los textos tipo "notas de la funda"; mono para los rótulos de pista.
export const SERIF = loadSerif('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const SERIF_ITALIC = loadSerif('italic', { weights: ['400'], subsets: ['latin', 'latin-ext'] }).fontFamily;
export const MONO = loadMono('normal', { weights: ['400', '600'], subsets: ['latin', 'latin-ext'] }).fontFamily;
// La interfaz usa la misma tipografía que la app.
export const UI = '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';
