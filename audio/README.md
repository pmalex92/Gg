# Audio

Gold Rush ships with **no audio files**: every sound effect and the music loop
are synthesised at runtime with the Web Audio API (`src/audio/audio.js`).

To replace a synthesised sound with a real recording:

1. Drop the file here, e.g. `audio/coin.mp3` (use audio you own or that is
   licensed for commercial use — e.g. CC0).
2. Register it in `src/config.js`:

   ```js
   AUDIO_SAMPLES: { coin: 'audio/coin.mp3', explosion: 'audio/boom.ogg' },
   ```

3. Add the file to the `ASSETS` list in `sw.js` so it works offline.

Sound names: `click`, `launch`, `grab`, `grabHeavy`, `reel`, `coin`, `coinTick`,
`diamond`, `rock`, `miss`, `combo`, `comboBreak`, `explosion`, `bag`, `booster`,
`freeze`, `tick`, `levelComplete`, `levelFail`, `upgrade`, `achievement`,
`error`, `star`.
