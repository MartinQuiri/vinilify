// Composiciones de control: la app recreada en estados fijos, para compararla con capturas reales.
import { AbsoluteFill } from 'remotion';
import { App } from './App';
import { artistView, accentOf, FAKE_CLIENT_ID, RECENT, TRACKS, UP_NEXT } from './data';

export const UITest = ({ which }: { which: string }) => {
  const tr = which === 'artist' ? TRACKS.patient : TRACKS.wnl;
  const base = { track: tr, accent: accentOf(tr), angle: 40, progress: 0.32, recent: RECENT, upNext: UP_NEXT };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {which === 'hero' ? <App {...base} awake hover={['volume']} liked lyrics={{ on: true, prev: 'Same old story, different night', cur: 'We never learn, we never learn', next: 'Round and round again' }} /> : null}
      {which === 'artist' ? <App {...base} awake search={artistView} /> : null}
      {which === 'settings' ? (
        <App mode="settings" width={620} height={720} {...base} settings={{ lang: 'en', clientId: FAKE_CLIENT_ID, connected: true, loginItem: true }} />
      ) : null}
      {which === 'mini' ? <App mode="mini" {...base} awake style={{ transform: 'scale(2.5)', transformOrigin: '0 0' }} /> : null}
      {which === 'connect' ? <App {...base} connect /> : null}
    </AbsoluteFill>
  );
};
