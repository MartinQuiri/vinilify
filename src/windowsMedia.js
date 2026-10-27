// Lee lo que suena en Spotify a través de los controles multimedia de Windows, sin cuenta ni API.
// El trabajo lo hace media/media-helper.ps1 en un proceso de PowerShell aparte.
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const path = require('path');
const readline = require('readline');

// Empaquetada, la app vive dentro de app.asar y PowerShell no puede leer el script desde ahí.
const SCRIPT = path.join(__dirname, 'media', 'media-helper.ps1').replace('app.asar', 'app.asar.unpacked');

class WindowsMedia extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.running = false;
  }

  start() {
    this.running = true;
    if (this.proc) return;
    const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT], {
      windowsHide: true,
    });
    this.proc = proc;
    proc.stdin.on('error', () => {});
    readline.createInterface({ input: proc.stdout }).on('line', (line) => {
      try {
        this.emit('media', JSON.parse(line));
      } catch {
        // Línea incompleta o ajena al protocolo: se ignora.
      }
    });
    proc.stderr.on('data', (data) => console.warn('[media]', String(data).trim()));
    proc.on('exit', () => {
      if (this.proc === proc) this.proc = null;
      // Si se cayó solo (no porque lo paramos), se vuelve a lanzar.
      if (this.running) setTimeout(() => this.running && this.start(), 3000);
    });
  }

  send(order) {
    if (this.proc) this.proc.stdin.write(`${order}\n`);
  }

  stop() {
    this.running = false;
    if (!this.proc) return;
    this.proc.stdin.end();
    this.proc.kill();
    this.proc = null;
  }
}

module.exports = { WindowsMedia };
