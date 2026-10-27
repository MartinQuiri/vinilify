// Canciones y resultados que muestra el video (las mismas que se grabaron con la app real).
import accents from './accents.json';
import type { Row, SearchView, Tile, Track } from './App';

const t = (key: string, name: string, artists: string, album: string, durationMs: number): Track =>
  ({ name, artists, album, cover: `covers/bb/${key}.jpg`, durationMs });

export const TRACKS = {
  wnl: t('wnl', 'WE NEVER LEARN', 'STEELROSE 스틸로즈', 'We Never Learn', 149132),
  patient: t('patient', 'Patient Zero', 'Taylor Swift', 'Patient Zero', 225868),
  housewife: t('housewife', 'Housewife', 'Tate McRae', 'Housewife', 208810),
  expectations: t('expectations', 'expectations', 'Olivia Rodrigo', 'you seem pretty sad for a girl so in love', 221958),
  solar: t('solar', 'Solar Eclipse (feat. Don Toliver)', 'Drake, Don Toliver', 'HABIBTI (FOMO)', 218388),
  bbywow: t('bbywow', 'BbY WOW', 'KAROL G, Judeline, rusowsky', 'NO ME ARREPIENTO DE SENTIR TANTO', 225834),
  petal: t('petal', 'petal', 'Ariana Grande', 'petal', 184248),
  lies: t('lies', 'Lies (feat. Lana Del Rey)', 'Zach Bryan, Lana Del Rey', 'Lies (feat. Lana Del Rey)', 220588),
  babydoll: t('babydoll', 'Babydoll', 'Dominic Fike', 'Don’t Forget About Me, Demos', 97960),
  nicole: t('nicole', 'Nicole Kidman', 'ADÉLA', 'PRIMA', 181270),
  texas: t('texas', 'Choosin’ Texas', 'Ella Langley', 'Choosin’ Texas', 232226),
  beenby: t('beenby', 'Been By Now', 'Morgan Wallen', 'Been By Now', 213805),
  babylon: t('babylon', 'Babylon', 'Taylor Swift', 'The Life of a Showgirl: The Encore', 219365),
};
export type TrackKey = keyof typeof TRACKS;

export const accentOf = (tr: Track) => (accents as Record<string, string>)[tr.cover] ?? '#1db954';

export const RECENT: Track[] = [TRACKS.babylon, TRACKS.beenby, TRACKS.texas, TRACKS.patient];
export const UP_NEXT: Track[] = [TRACKS.solar, TRACKS.bbywow, TRACKS.petal, TRACKS.lies, TRACKS.babydoll, TRACKS.nicole];

const be = (k: string) => `covers/be/${k}.jpg`;
const row = (name: string, album: string, durationMs: number): Row => ({ name, artists: 'Billie Eilish', thumb: be(album), durationMs });

export const BILLIE_TRACKS: Row[] = [
  row('BIRDS OF A FEATHER', 'hmhas', 210373),
  row('WILDFLOWER', 'hmhas', 261467),
  row('lovely (with Khalid)', 'lovely', 200187),
  row('bad guy', 'wwafa', 194088),
  row('ocean eyes', 'dsam', 200379),
  row('What Was I Made For?', 'barbie', 222370),
  row('CHIHIRO', 'hmhas', 303440),
  row('Happier Than Ever', 'hte', 298899),
];
const ARTISTS: Tile[] = [
  { name: 'Billie Eilish', sub: 'Artist', image: be('artist') },
];
const ALBUMS: Tile[] = [
  { name: 'HIT ME HARD AND SOFT', sub: 'Billie Eilish', image: be('hmhas') },
  { name: 'Happier Than Ever', sub: 'Billie Eilish', image: be('hte') },
  { name: 'WHEN WE ALL FALL ASLEEP…', sub: 'Billie Eilish', image: be('wwafa') },
  { name: 'dont smile at me', sub: 'Billie Eilish', image: be('dsam') },
];

export const searchResults = (query: string): SearchView => ({ kind: 'results', query, tracks: BILLIE_TRACKS.slice(0, 5), artists: ARTISTS, albums: ALBUMS });
export const artistView: SearchView = { kind: 'artist', query: 'billie eilish', name: 'Billie Eilish', image: be('artist'), tracks: BILLIE_TRACKS };

export const BAD_GUY: Track = { name: 'bad guy', artists: 'Billie Eilish', album: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', cover: be('wwafa'), durationMs: 194088 };

export const FAKE_CLIENT_ID = '7c2e9f41b0d84a6e93f5c1d2a8b04e67';
