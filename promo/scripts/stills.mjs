// Saca fotogramas sueltos para revisar el video sin renderizarlo entero.
// Uso: node scripts/stills.mjs 40 100 330 ...
import path from 'node:path';
import fs from 'node:fs';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const frames = process.argv.slice(2).map(Number);
const out = path.resolve('out/stills');
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'Film' });
for (const frame of frames) {
  const file = path.join(out, `f${String(frame).padStart(4, '0')}.jpg`);
  await renderStill({ serveUrl, composition, frame, output: file, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5 });
  console.log('✓', file);
}

