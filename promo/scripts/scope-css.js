// Copia el CSS real de la app (src/renderer/style.css) para usarlo dentro del video:
// - todo queda bajo `.vf` (cada instancia de la app es un div, no la página entera);
// - vw/vh/vmin pasan a variables, así cada instancia simula su propia ventana (pantalla completa, mini…);
// - :hover y :focus pasan a clases (.hover, .focus) que el video pone cuando quiere;
// - sin transiciones ni animaciones: el video calcula cada cuadro.
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../../src/renderer/style.css'), 'utf8');
const ROOT_CLASSES = ['mode-full', 'mode-mini', 'mode-setup', 'mode-settings', 'is-playing', 'awake', 'protect', 'searching',
  'scrubbing', 'swapping', 'sleepy', 'no-seek', 'dragging', 'vol-low', 'vol-mute', 'modal-open'];

const units = (css) => css.replace(/(-?\d*\.?\d+)(vw|vh|vmin)\b/g, (_, n, u) => `calc(${n} * var(--${u}))`);

function scopeSelector(sel) {
  let s = sel.trim()
    .replace(/:hover/g, '.hover')
    .replace(/:focus-within/g, '.focus')
    .replace(/:focus-visible/g, '.focusv')
    .replace(/:focus/g, '.focus');
  if (s === ':root' || s === 'html' || s === 'body') return '.vf';
  if (s === '*') return '.vf, .vf *';
  s = s.replace(/^body/, '.vf');
  if (s.startsWith('.vf')) return s;
  const first = s.match(/^\.([\w-]+)/);
  if (first && ROOT_CLASSES.includes(first[1])) return `.vf${s}`;
  return `.vf ${s}`;
}

let out = '';
let i = 0;
const text = src.replace(/\/\*[\s\S]*?\*\//g, '');
while (i < text.length) {
  const open = text.indexOf('{', i);
  if (open < 0) break;
  const head = text.slice(i, open).trim();
  if (head.startsWith('@keyframes')) {
    // Bloque con llaves anidadas: se copia tal cual (no se usa, las animaciones van apagadas).
    let depth = 1;
    let j = open + 1;
    while (depth && j < text.length) { if (text[j] === '{') depth++; if (text[j] === '}') depth--; j++; }
    i = j;
    continue;
  }
  const close = text.indexOf('}', open);
  const body = units(text.slice(open + 1, close)).replace(/position:\s*fixed/g, 'position: absolute');
  const sels = head.split(',').map(scopeSelector).join(',\n');
  out += `${sels} {${body}}\n`;
  i = close + 1;
}

out = `/* Generado por scripts/scope-css.js a partir de src/renderer/style.css. No editar a mano. */
.vf { position: absolute; left: 0; top: 0; overflow: hidden; --vw: 19.2px; --vh: 10.8px; --vmin: 10.8px; }
${out}
.vf, .vf *, .vf *::before, .vf *::after { transition: none !important; animation: none !important; }
`;
fs.writeFileSync(path.join(__dirname, '../src/ui/app.css'), out);
console.log('src/ui/app.css', out.length, 'bytes');
