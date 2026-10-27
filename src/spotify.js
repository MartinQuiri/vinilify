// Cliente mínimo de la Web API de Spotify con OAuth PKCE (sin client secret).
const crypto = require('crypto');
const http = require('http');
const fs = require('fs');
const { shell, safeStorage } = require('electron');

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = [
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-read-recently-played',
  'user-modify-playback-state',
  'user-library-read',
  'user-library-modify',
].join(' ');
const API = 'https://api.spotify.com/v1';

const b64url = (buf) => buf.toString('base64url');

function callbackPage(ok, message, closeText) {
  return `<!doctype html><meta charset="utf-8"><title>Vinilify</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0d;color:#f5f3ef;font:16px 'Segoe UI',system-ui,sans-serif">
<div style="text-align:center"><div style="font-size:48px">${ok ? '💿' : '⚠️'}</div>
<p>${message}</p><p style="opacity:.5">${closeText}</p></div></body>`;
}

class SpotifyError extends Error {
  constructor(message, { status, code, retryAfter } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

// En el archivo, los tokens van cifrados con la cuenta de Windows del usuario (DPAPI, vía safeStorage):
// otra persona o programa que copie el archivo no puede usarlos. El Client ID no es secreto y va tal cual.
const SECRET_KEYS = ['accessToken', 'refreshToken', 'expiresAt', 'scope'];

class Spotify {
  constructor(file) {
    this.file = file;
    this.pendingLogin = null;
    this.data = {};
    // Traductor: main.js lo reemplaza por el del idioma elegido.
    this.t = (key) => key;
    this.writing = Promise.resolve();
  }

  // Se llama una vez al arrancar (después de que Electron esté listo, que es cuando hay cifrado).
  async load() {
    let stored = {};
    try {
      stored = JSON.parse(await fs.promises.readFile(this.file, 'utf8'));
    } catch {
      // Primera vez o archivo dañado: se empieza sin cuenta.
    }
    const { secrets, ...rest } = stored;
    this.data = rest;
    let rewrite = !secrets && Boolean(this.data.refreshToken); // versión anterior: tokens en texto plano
    if (secrets) {
      try {
        const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(secrets, 'base64'));
        Object.assign(this.data, JSON.parse(result));
        rewrite = shouldReEncrypt;
      } catch {
        // No se pudo descifrar (otro usuario de Windows, por ejemplo): hay que volver a conectar.
      }
    }
    if (rewrite) await this.save();
  }

  // Las escrituras se encadenan para que dos guardados seguidos no se pisen.
  save() {
    this.writing = this.writing.then(() => this.write()).catch(() => {});
    return this.writing;
  }

  async write() {
    const plain = {};
    const secrets = {};
    for (const [key, value] of Object.entries(this.data)) {
      (SECRET_KEYS.includes(key) ? secrets : plain)[key] = value;
    }
    if (Object.keys(secrets).length) {
      if (await safeStorage.isAsyncEncryptionAvailable()) {
        plain.secrets = (await safeStorage.encryptStringAsync(JSON.stringify(secrets))).toString('base64');
      } else {
        Object.assign(plain, secrets); // Sin cifrado disponible en el sistema: mejor eso que perder la sesión.
      }
    }
    await fs.promises.writeFile(this.file, JSON.stringify(plain, null, 2));
  }

  get clientId() {
    return this.data.clientId || '';
  }

  setClientId(id) {
    if (id === this.data.clientId) return;
    // Los tokens pertenecen a un Client ID concreto: al cambiarlo hay que volver a autorizar.
    this.data = { clientId: id };
    this.save();
  }

  get loggedIn() {
    return Boolean(this.data.refreshToken);
  }

  logout() {
    this.data = { clientId: this.data.clientId };
    this.save();
  }

  login() {
    if (!this.clientId) return Promise.reject(new SpotifyError(this.t('missingClientId')));
    if (this.pendingLogin) {
      shell.openExternal(this.pendingLogin.url);
      return this.pendingLogin.promise;
    }

    const verifier = b64url(crypto.randomBytes(48));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = b64url(crypto.randomBytes(12));
    const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });

    const promise = new Promise((resolve, reject) => {
      let timer;
      const server = http.createServer(async (req, res) => {
        const params = new URL(req.url, REDIRECT_URI).searchParams;
        if (!req.url.startsWith('/callback')) {
          res.writeHead(404).end();
          return;
        }
        const reply = (ok, message) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(callbackPage(ok, message, this.t('authClose')));
          finish();
        };

        if (params.get('state') !== state) {
          reply(false, this.t('authMismatch'));
          return reject(new SpotifyError(this.t('authMismatch')));
        }
        if (params.get('error')) {
          reply(false, this.t('authCancelled'));
          return reject(new SpotifyError(this.t('spotifySaid', { error: params.get('error') })));
        }
        try {
          await this.tokenRequest({
            grant_type: 'authorization_code',
            code: params.get('code'),
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
          });
          reply(true, this.t('authDone'));
          resolve();
        } catch (err) {
          reply(false, this.t('authFailed', { error: err.message }));
          reject(err);
        }
      });

      const finish = () => {
        clearTimeout(timer);
        this.pendingLogin = null;
        server.close();
        server.closeIdleConnections();
      };

      server.on('error', (err) => {
        finish();
        reject(err.code === 'EADDRINUSE'
          ? new SpotifyError(this.t('portBusy', { port: PORT }))
          : err);
      });
      timer = setTimeout(() => {
        finish();
        reject(new SpotifyError(this.t('authTimeout')));
      }, 5 * 60 * 1000);
      server.listen(PORT, '127.0.0.1', () => shell.openExternal(url));
    });

    this.pendingLogin = { url, promise };
    return promise;
  }

  async tokenRequest(params) {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.clientId, ...params }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new SpotifyError(json.error_description || json.error || `HTTP ${res.status}`, {
        status: res.status,
        code: json.error,
      });
    }
    this.data.accessToken = json.access_token;
    this.data.expiresAt = Date.now() + (json.expires_in - 60) * 1000;
    if (json.refresh_token) this.data.refreshToken = json.refresh_token;
    if (json.scope) this.data.scope = json.scope;
    this.save();
  }

  // Permisos que el usuario aceptó. Si conectó con una versión anterior de Vinilify
  // pueden faltar algunos nuevos (como los de "Me gusta") y hay que volver a autorizar.
  hasScope(scope) {
    return (this.data.scope || '').split(' ').includes(scope);
  }

  async accessToken() {
    if (!this.data.accessToken || Date.now() >= (this.data.expiresAt || 0)) {
      try {
        await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.data.refreshToken });
      } catch (err) {
        if (err.code === 'invalid_grant' || err.code === 'invalid_client') this.logout();
        throw err;
      }
    }
    return this.data.accessToken;
  }

  async request(method, path, body, retried = false) {
    const headers = { Authorization: `Bearer ${await this.accessToken()}` };
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && !retried) {
      this.data.expiresAt = 0;
      return this.request(method, path, body, true);
    }
    if (res.status === 429) {
      throw new SpotifyError('Too many requests', {
        status: 429,
        retryAfter: Number(res.headers.get('retry-after')) || 5,
      });
    }
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new SpotifyError(json.error?.message || `Spotify HTTP ${res.status}`, { status: res.status });
    }
    // Los comandos (next, pause…) a veces responden con texto que no es JSON; no hay nada que leer ahí.
    if (!res.headers.get('content-type')?.includes('json')) return null;
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  get(path) {
    return this.request('GET', path);
  }
}

module.exports = { Spotify, SpotifyError, REDIRECT_URI };
