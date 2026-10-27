# Vinilify — promo film

An 80-second film in the style of Apple's product videos, made with [Remotion](https://www.remotion.dev/) and cut to the beat of "WE NEVER LEARN" by STEELROSE.

## How it's made

1. **The app, rebuilt piece by piece** (`src/ui/`). `scripts/scope-css.js` turns the app's real stylesheet (`../src/renderer/style.css`) into `src/ui/app.css`, and `src/ui/App.tsx` reproduces the DOM of `../src/renderer/index.html`. On screen it looks exactly like Vinilify, but each frame sets its state: disc angle, tonearm, progress, hover, lyrics, search and settings.
   - Every part can move on its own (`fx`) or appear alone (`only`). That way the app is assembled piece by piece, and close-ups show only the part being shown, sharp at any zoom.
2. **Music** (`src/film/time.ts`). `scripts/analyze_audio.py` finds the tempo (130 BPM) and the beat grid. Every cut lands on a beat:
   - The needle drops on the first chorus.
   - Protection mode dims when the bass drops out.
   - The tonearm lifts in the silence before the second drop.
3. **The film** (`src/Film.tsx`) is built in this order:
   1. Logo and cover wall.
   2. The app assembles itself.
   3. Feature scenes: synced lyrics, controls, scrub, volume, protection mode, mini vinyl, search, artist and queue, language, connecting Spotify.
   4. Statements, a cover montage and an exploded view.
   5. The closing card.

```bash
npm install
# 1) Song into public/music/we-never-learn.wav, then:
python scripts/analyze_audio.py out/wnl.wav public/music/we-never-learn.beats.json
python scripts/make_assets.py      # vinyl mark from the icon + Billboard covers
python scripts/accents.py          # accent color of each cover (same formula as the app)
node scripts/scope-css.js          # app CSS → src/ui/app.css
# 2) Preview / render
npm run studio
npm run render                      # → out/vinilify-film.mp4
```

## Credits and rights

- **Music:** STEELROSE – WE NEVER LEARN. Free to use according to the project owner. The audio is not included in this repo.
- **Album art:** © their respective artists and labels. Shown only as examples of what the app displays. Not included in this repo.
