const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => ipcRenderer.on(channel, (_e, payload) => cb(payload));

contextBridge.exposeInMainWorld('vinilify', {
  onState: on('state'),
  onToast: on('toast'),
  getState: () => ipcRenderer.invoke('state:get'),
  ready: () => ipcRenderer.send('renderer:ready'),
  control: (action) => ipcRenderer.send('control', action),
  seek: (ms) => ipcRenderer.send('seek', ms),
  setVolume: (percent) => ipcRenderer.send('volume', percent),
  play: (uri, contextUri) => ipcRenderer.send('play', { uri, contextUri }),
  search: (query) => ipcRenderer.invoke('search', query),
  searchTracks: (query, offset) => ipcRenderer.invoke('search:tracks', query, offset),
  artistTracks: (id, name, offset) => ipcRenderer.invoke('artist:tracks', id, name, offset),
  openInSpotify: (query) => ipcRenderer.send('open-in-spotify', query),
  addToQueue: (uri) => ipcRenderer.send('queue:add', uri),
  copy: (text) => ipcRenderer.send('clipboard', text),
  openFull: () => ipcRenderer.send('full:open'),
  closeFull: () => ipcRenderer.send('full:close'),
  toMini: () => ipcRenderer.send('full:to-mini'),
  closeMini: () => ipcRenderer.send('mini:close'),
  showMenu: () => ipcRenderer.send('menu:show'),
  openTrack: () => ipcRenderer.send('open-track'),
  moveMini: (x, y) => ipcRenderer.send('mini:move', { x, y }),
  miniMoved: () => ipcRenderer.send('mini:moved'),

  setup: {
    get: () => ipcRenderer.invoke('setup:get'),
    connect: (clientId) => ipcRenderer.invoke('setup:connect', clientId),
    openDashboard: () => ipcRenderer.send('setup:dashboard'),
    close: () => ipcRenderer.send('setup:close'),
    onDone: on('setup:done'),
    onError: on('setup:error'),
  },
});
