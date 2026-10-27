// Efectos de sonido sintetizados (sin muestras de terceros): crujido de vinilo, caída de la aguja,
// clics, teclas, barrido y arranque del plato. WAV mono 44,1 kHz / 16 bits.
import fs from 'node:fs';
import path from 'node:path';

const RATE = 44100;
const OUT = path.resolve('public/sfx');
fs.mkdirSync(OUT, { recursive: true });

// Ruido reproducible (para que cada render suene igual).
let seed = 7;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rand() * 2 - 1;

function writeWav(name, samples) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0.98 ? 0.98 / peak : 1;
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(OUT, name), Buffer.concat([header, data]));
}

// Filtros de un polo (suficientes para dar color al ruido).
const lowpass = (cut) => {
  const a = Math.exp(-2 * Math.PI * cut / RATE);
  let y = 0;
  return (x) => (y = (1 - a) * x + a * y);
};
const highpass = (cut) => {
  const lp = lowpass(cut);
  return (x) => x - lp(x);
};

function render(seconds, fn) {
  const n = Math.round(seconds * RATE);
  return Array.from({ length: n }, (_, i) => fn(i / RATE, i));
}

// Crujido: siseo suave, pops aleatorios y un leve zumbido grave del plato (12 s, se puede repetir).
{
  const hiss = highpass(2500);
  const hissLp = lowpass(9000);
  const rumble = lowpass(40);
  let pop = 0;
  writeWav('crackle.wav', render(12, (t) => {
    if (rand() < 0.0009) pop = (rand() * 0.6 + 0.4) * (rand() < 0.5 ? -1 : 1);
    pop *= 0.82;
    const h = hissLp(hiss(noise())) * 0.05;
    const r = rumble(noise()) * 0.5;
    return h + pop * 0.5 + r * 0.6 + Math.sin(2 * Math.PI * 50 * t) * 0.004;
  }));
}

// Aguja que cae: golpe grave + roce corto + clic.
{
  const scratch = highpass(1800);
  writeWav('needle.wav', render(0.9, (t) => {
    const thump = Math.sin(2 * Math.PI * (70 - 30 * t) * t) * Math.exp(-t * 14) * 0.9;
    const click = t < 0.004 ? noise() * (1 - t / 0.004) * 0.8 : 0;
    const rub = scratch(noise()) * Math.exp(-((t - 0.05) ** 2) / 0.002) * 0.25;
    return thump + click + rub;
  }));
}

// Clic de interfaz: tic corto y limpio.
{
  const hp = highpass(1500);
  writeWav('click.wav', render(0.08, (t) => (Math.sin(2 * Math.PI * 2400 * t) * 0.35 + hp(noise()) * 0.4) * Math.exp(-t * 90)));
}

// Tecla: golpecito con algo de cuerpo.
{
  const body = lowpass(1800);
  writeWav('key.wav', render(0.07, (t) => (body(noise()) * 1.4 + Math.sin(2 * Math.PI * 340 * t) * 0.25) * Math.exp(-t * 70)));
}

// Barrido: ruido que sube y baja de brillo (para transiciones).
{
  let cut = 300;
  let y = 0;
  writeWav('whoosh.wav', render(0.9, (t) => {
    const p = t / 0.9;
    cut = 300 + 5200 * Math.sin(Math.PI * p);
    const a = Math.exp(-2 * Math.PI * cut / RATE);
    y = (1 - a) * noise() + a * y;
    return y * Math.sin(Math.PI * p) ** 2 * 0.9;
  }));
}

// Pasar portadas: tic seco tipo cartón.
{
  const lp = lowpass(3000);
  writeWav('flip.wav', render(0.05, (t) => lp(noise()) * Math.exp(-t * 120) * 1.2));
}

// Arranque del plato: zumbido de motor que sube de tono.
{
  let phase = 0;
  writeWav('spinup.wav', render(1.2, (t) => {
    const f = 40 + 70 * Math.min(1, t / 0.9);
    phase += 2 * Math.PI * f / RATE;
    const env = Math.min(1, t / 0.1) * Math.exp(-Math.max(0, t - 0.9) * 8);
    return (Math.sin(phase) * 0.35 + Math.sin(phase * 2) * 0.12) * env;
  }));
}

// Golpe sordo grave para el cierre (sub).
writeWav('boom.wav', render(1.6, (t) => Math.sin(2 * Math.PI * (55 - 15 * t) * t) * Math.exp(-t * 3.2) * 0.9));

console.log('Efectos generados en', OUT);
