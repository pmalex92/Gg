# ⛏️ Gold Rush

A fast, original arcade mining game for phone and desktop browsers. Swing the
claw, grab gold and gems, dodge slow rocks, beat the target before the clock
runs out — then spend your coins and go again.

- **Zero dependencies, no build step, no backend.** Plain HTML/CSS/JS + Canvas.
- **~300 KB total (~90 KB gzipped)**, no image or audio files: all art is drawn with canvas
  paths and all sound is synthesised with Web Audio.
- **Works offline** (service worker) and even straight from disk (`file://`).

## Play it

```bash
# any static server works; for example:
npx http-server -c-1 .        # then open http://localhost:8080
# or just double-click index.html
```

Controls: **tap / click / SPACE / ENTER** launch the claw · **ESC** pause ·
**R** play again after game over · **1–4** boosters.

## Deploy

**GitHub Pages (automatic):** `.github/workflows/pages.yml` publishes the game
on every push to `main`. One-time setup: repository **Settings → Pages →
Build and deployment → Source: GitHub Actions**. The game is then live at
`https://<user>.github.io/<repo>/`.

**Anywhere else:**
Upload the folder to any static host (Netlify, GitHub Pages, Cloudflare Pages,
S3, a shared web server...). Nothing to compile. When you ship an update, bump
`CACHE` in `sw.js` (and `VERSION` in `src/config.js`) so returning players get
the new files.

## What's in the game

| Feature | Where |
| --- | --- |
| Claw swing → launch → grab → weighted reel-in | `src/game/claw.js` |
| Rules: timer, scoring, combo, TNT, mystery bags, boosters | `src/game/session.js` |
| Procedural, seeded level generator + difficulty curve | `src/game/levelgen.js` |
| Daily Challenge (date seed + daily modifier) and forgiving streak | `src/systems/daily.js` |
| Coins, premium tokens, upgrades, boosters, cosmetics, XP | `src/systems/economy.js` |
| Run perks (pick 1 of 3 between levels) | `src/data/perks.js` |
| Daily missions | `src/systems/missions.js` |
| Nugget the mascot | `src/game/mascot.js` |
| Worlds (scenery + critter every 10 levels) | `src/data/worlds.js` |
| Achievements (data-driven) | `src/data/achievements.js`, `src/systems/achievements.js` |
| Versioned local save with migrations | `src/systems/save.js` |
| Leaderboard service (offline preview + REST adapter) | `src/systems/leaderboard.js` |
| AdManager (rewarded + interstitial, fake dev provider) | `src/systems/ads.js` |
| Purchases architecture (no payments in MVP) | `src/systems/purchases.js`, `src/data/products.js` |
| Share score (Web Share API → clipboard fallback) | `src/systems/share.js` |
| Synthesised SFX + generative music | `src/audio/audio.js` |
| Procedural sprites, renderer, particles, game feel | `src/game/sprites.js`, `renderer.js`, `particles.js`, `fx.js` |
| HUD, menus, overlays | `src/ui/*.js`, `styles/main.css` |
| State machine, loop, run flow | `src/main.js` |

Game states: `BOOT, MENU, PLAYING, PAUSED, LEVEL_COMPLETE, PERK_PICK, GAME_OVER,
DAILY_RESULT, SHOP, UPGRADES, DAILY_CHALLENGE, SETTINGS, ACHIEVEMENTS,
LEADERBOARD`.

### Project layout

```
index.html            entry point (plain <script defer> tags, works from file://)
styles/               main.css + font.css (embedded OFL font)
src/core/             helpers, seeded RNG, event bus
src/config.js         all tuning numbers in one place
src/data/             objects, upgrades, boosters, cosmetics, achievements, products
src/systems/          save, economy, achievements, daily, leaderboard, ads, purchases, share
src/audio/            Web Audio synth + music
src/game/             claw, session, level generator, autopilot bot, rendering, input
src/ui/               icons, HUD, screens, overlays
assets/               icons + font source/licence
audio/                drop optional real sound files here (see audio/README.md)
tools/                simulate.js (balance), test-logic.js (unit), qa.js (browser E2E)
sw.js                 offline cache
```

Scripts are classic (not ES modules) and attach to a single `GR` namespace —
that is what lets the game run from `file://`. Gameplay logic (`session.js`,
`claw.js`, `levelgen.js`) has no DOM/canvas code and only emits events, which
is why it can be simulated headlessly.

## Design notes

- **First 30 seconds:** new players skip the menu and land in a short
  **training level** with a single hint ("TAP TO LAUNCH THE CLAW"), a dotted aim
  line and an easy $300 target; the timer waits for the first launch. When it
  ends they go straight into Level 1 with "YOU GOT THE GIST! Now test your
  skills" — from then on there is no aim line.
- **Worlds:** the scenery changes automatically every 10 levels — Gold Hills,
  Frozen Caves, Lava Depths, Jungle Ruins, Desert Tomb, Cosmic Rift — each with
  its own skyline, ambient particles and critter (crabs, penguins, salamanders,
  frogs, scorpions, space blobs), then the cycle repeats. Shop mine skins dress
  the home screen and the Daily Challenge.
- **Runs + checkpoints:** a run is a chain of levels; missing a target ends it.
  Coins are banked every level (never lost). Every 5th level becomes a
  checkpoint you can start from, so progress never feels wasted.
- **Combo:** consecutive valuable catches give +10% per step (up to +50%);
  rocks or empty pulls reset it.
- **Run perks:** after each won level the player picks 1 of 3 perks that last
  for the rest of the run (Gem Polish, Demolition Pro, Rock Collector, Good
  Boy, Piggy Bank...), so every run plays differently. Not in the Daily.
- **Daily missions:** three small goals per day (same for everyone on a date),
  paid automatically; finishing all three pays a bonus token. Result screens
  show the closest mission and the next affordable upgrade.
- **Moving targets/obstacles:** cave crabs (some carry a gem) from level 7,
  rolling boulders that block lanes from level 10.
- **TNT:** blows up everything nearby — rocks are cleared (great for shield
  rocks), treasure in the blast pays out at half value instantly.
- **Daily Challenge:** same level for everyone (seed = local date), standard
  claw (upgrades and boosters disabled) so scores are comparable. Unlimited
  retries; best score counts. Streak rewards with one forgiven missed day;
  day 7 unlocks the exclusive Royal Claw.
- **No manipulative mechanics:** no energy, no waiting timers, ads are always
  opt-in, and nothing is pay-to-win.

## Plugging in real services later

**Rewarded / interstitial ads** — implement a provider and register it:

```js
GR.app.ads.setProvider({
  rewardedAvailable: () => sdk.isReady(),
  showRewarded: (placement) => sdk.showRewarded().then((r) => r.completed), // -> boolean
  showInterstitial: (placement) => sdk.showInterstitial(),
});
```

Placements already wired: `revive`, `double_coins`, `free_token`,
`free_booster`, `level_transition`, `play_again`. Interstitial pacing lives in
`CONFIG.ADS` (default: at most every 3 rounds and 2 minutes, never when the
player owns No Ads). Add `?ads=demo` to the URL to see placeholder screens.

**Leaderboards** — set `CONFIG.LEADERBOARD = { provider: 'rest', restBaseUrl: 'https://…' }`
(expects `POST /scores` and `GET /leaderboards/:board`), or write a
Firebase/Supabase adapter with the same two methods (`submit`, `fetchTop`).
Boards: `global`, `daily:YYYY-MM-DD`, `week:YYYY-Www`.

**Premium packs** — replace `NoStoreProvider` in `src/systems/purchases.js`
with your store SDK. After a *verified* purchase the product's `grants` block
is applied via `Economy.grant()`. Add `?dev=1` to simulate purchases locally.

**Real audio** — see `audio/README.md`.

## Tools

```bash
node tools/test-logic.js          # 38 headless unit tests (save, economy, streak, generator, rules)
node tools/simulate.js 25 12      # balance report: bot pass-rates per level/upgrade tier
npx http-server -c-1 . &          # then:
node tools/qa.js                  # 56-step browser QA (needs Playwright)
npx eslint .                      # lint
```

`tools/simulate.js` plays generated levels with the autopilot bot (a casual
profile with human-like timing errors and an expert profile) to tune targets:
levels 1–7 should be near-certain wins, difficulty ramps from level ~8, and
upgrades visibly raise pass rates later on.

## Credits

Game design, code, art and sound: original. Font: Lilita One by Juan Montoreano
(SIL Open Font License 1.1, `assets/fonts/OFL-LilitaOne.txt`).
