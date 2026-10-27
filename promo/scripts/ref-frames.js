// Extrae fotogramas de los videos de referencia con el reproductor de Chromium (sin ffmpeg).
// Uso: electron scripts/ref-frames.js <video.mp4> <carpeta-salida> <cada-segundos>
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const [video, outArg, everyArg] = process.argv.slice(-3);
const outDir = path.resolve(process.cwd(), outArg);
const every = Number(everyArg) || 0.5;
fs.mkdirSync(outDir, { recursive: true });

process.on('unhandledRejection', (err) => {
  console.log('Error:', err?.message || err);
  app.exit(1);
});

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1280, height: 720, webPreferences: { offscreen: true } });
  // Página local (una página data: no puede abrir archivos del disco).
  const page = path.join(outDir, 'player.html');
  fs.writeFileSync(page, '<body style="margin:0;background:black"><video id="v" muted style="width:1280px;height:720px"></video></body>');
  await win.loadFile(page);
  const js = (code) => win.webContents.executeJavaScript(code);
  const duration = await js(`new Promise((ok, fail) => { const v = document.getElementById('v');
    v.onloadedmetadata = () => ok(v.duration); v.onerror = () => fail(v.error && v.error.message); v.src = ${JSON.stringify(pathToFileURL(video).href)}; })`);
  console.log('duración', duration.toFixed(2), 's');
  let n = 0;
  for (let t = 0; t < duration; t += every) {
    await js(`new Promise((ok) => { const v = document.getElementById('v'); v.onseeked = () => requestAnimationFrame(() => requestAnimationFrame(ok)); v.currentTime = ${t}; })`);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, `t${t.toFixed(2).padStart(6, '0')}.jpg`), img.resize({ width: 640 }).toJPEG(80));
    n++;
  }
  console.log('fotogramas:', n);
  app.exit(0);
});
