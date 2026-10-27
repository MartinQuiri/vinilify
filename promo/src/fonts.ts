import { loadFont } from '@remotion/google-fonts/Inter';

// Inter: la más cercana a la SF Pro de Apple entre las tipografías de uso libre.
export const SANS = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin', 'latin-ext'] }).fontFamily;
