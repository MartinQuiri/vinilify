import { staticFile } from 'remotion';
import covers from '../public/covers/covers.json';

export type Cover = { slug: string; artist: string; album: string; track: string; file: string; accent: string };

const bySlug = Object.fromEntries((covers as Cover[]).map((c) => [c.slug, c]));
export const cover = (slug: string): Cover => bySlug[slug];
export const art = (slug: string) => staticFile(bySlug[slug]?.file ?? '');

// Orden en que pasan por la etiqueta del disco; frena en LUX.
export const CRATE = ['gnx', 'ram', 'hmhas', 'blonde', 'dtmf', 'currents', 'grasa', 'monlaferte', 'elmalquerer', 'motomami', 'lux'];

export const STRIP_RECENT = ['blonde', 'ram', 'currents', 'gnx'];
export const STRIP_NEXT = ['motomami', 'grasa', 'dtmf', 'hmhas', 'monlaferte', 'elmalquerer'];

// "Cielito Lindo" (Quirino Mendoza y Cortés, 1882): letra de dominio público.
export const LYRICS = [
  'De la Sierra Morena,',
  'cielito lindo, vienen bajando',
  'un par de ojitos negros,',
  'cielito lindo, de contrabando.',
  'Ay, ay, ay, ay, canta y no llores,',
];
