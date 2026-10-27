import { Composition } from 'remotion';
import { Promo } from './Promo';
import { DURATION, FPS } from './timeline';

export const Root = () => (
  <Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
);
