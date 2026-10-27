import { Composition } from 'remotion';
import { Film } from './Film';
import { DURATION, FPS } from './film/time';
import { Social } from './Social';
import { UITest } from './ui/Test';

export const Root = () => (
  <>
    <Composition id="Film" component={Film} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    <Composition id="Social" component={Social} durationInFrames={1} fps={FPS} width={1280} height={640} />
    <Composition id="UITest" component={UITest} durationInFrames={1} fps={FPS} width={1920} height={1080} defaultProps={{ which: 'hero' }} />
  </>
);
