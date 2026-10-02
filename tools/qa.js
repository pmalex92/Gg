#!/usr/bin/env node
/**
 * End-to-end QA pass in a real browser (Playwright + Chromium).
 *
 *   npx http-server -p 8080 -c-1 .   (in another terminal)
 *   node tools/qa.js [http://localhost:8080/] [screenshotDir]
 *
 * Walks the release checklist: first launch, gameplay, level complete,
 * game over + revive, pause, shop, upgrades, daily challenge + share,
 * settings, persistence, keyboard, viewports, offline and console errors.
 * Gameplay is fast-forwarded in-page with the Autopilot bot.
 */
'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8080/';
const OUT = process.argv[3] || path.join(__dirname, '..', 'qa-shots');
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const errors = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
}

function watch(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(label + ' console.error: ' + m.text());
  });
  page.on('pageerror', (e) => errors.push(label + ' pageerror: ' + e.message));
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const state = (page) => page.evaluate(() => GR.app.state);

/** Simulate `seconds` of play instantly. bot=false lets the timer run out. */
function fastForward(page, seconds, bot) {
  return page.evaluate(
    ({ seconds, bot }) => {
      const s = GR.app.session;
      const ap = bot ? new GR.Autopilot(s, { skill: 0.55, reaction: 0.1, aimNoise: 0.005 }) : null;
      for (let i = 0; i < seconds * 60 && !s.ended; i++) {
        if (ap) ap.update(1 / 60);
        s.update(1 / 60);
      }
      return { money: s.money, target: s.target, ended: s.ended };
    },
    { seconds, bot }
  );
}

async function waitState(page, want, timeout) {
  await page.waitForFunction((w) => GR.app.state === w, want, { timeout: timeout || 5000 }).catch(() => {});
  return state(page);
}

async function main() {
  const browser = await chromium.launch();

  // ------------------------------------------------------------ mobile flow
  console.log('\n[mobile 390x844]');
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  watch(page, 'mobile');
  const t0 = Date.now();
  await page.goto(BASE);
  await page.waitForFunction(() => window.GR && GR.app && GR.app.state === 'PLAYING', null, { timeout: 5000 });
  check('First launch drops straight into gameplay', (await state(page)) === 'PLAYING', (Date.now() - t0) + ' ms to playable');
  check('Tutorial hint is shown', await page.evaluate(() => document.querySelector('#hud-hint').classList.contains('on')));
  const timerBefore = await page.evaluate(() => GR.app.session.timeLeft);
  await page.waitForTimeout(600);
  check('Timer waits for the first launch in the tutorial', (await page.evaluate(() => GR.app.session.timeLeft)) === timerBefore);
  await shot(page, '01-first-launch');

  await page.touchscreen.tap(195, 500);
  check('Tap launches the claw', (await page.evaluate(() => GR.app.session.claw.state)) !== 'swing');
  await page.waitForTimeout(250);
  await shot(page, '02-claw-out');

  // Weight affects retrieval speed
  const speeds = await page.evaluate(() => {
    const s = GR.app.session;
    const claw = s.claw;
    const saved = claw.grabbed;
    claw.grabbed = { weight: 1 };
    const light = claw.retractTargetSpeed();
    claw.grabbed = { weight: 8 };
    const heavy = claw.retractTargetSpeed();
    claw.grabbed = saved;
    return { light, heavy };
  });
  check('Heavy objects retract slower', speeds.heavy < speeds.light * 0.5, Math.round(speeds.light) + ' vs ' + Math.round(speeds.heavy) + ' px/s');

  const ff = await fastForward(page, 70, true);
  check('Bot can complete level 1', ff.money >= ff.target, '$' + ff.money + ' / $' + ff.target);
  check('Level complete screen appears', (await waitState(page, 'LEVEL_COMPLETE')) === 'LEVEL_COMPLETE');
  await page.waitForTimeout(700);
  await shot(page, '03-level-complete');
  const coinsAfterL1 = await page.evaluate(() => GR.app.economy.coins);
  check('Coins awarded after level', coinsAfterL1 > 0, coinsAfterL1 + ' coins');

  // Double coins via simulated rewarded ad
  await page.click('#ov-complete [data-action="double"]');
  await page.waitForTimeout(400);
  await shot(page, '04-fake-ad');
  check('Simulated rewarded ad is shown', await page.evaluate(() => document.querySelector('#ov-ad').classList.contains('is-open')));
  await page.waitForFunction(() => !document.querySelector('#ov-ad').classList.contains('is-open'), null, { timeout: 6000 });
  const doubled = await page.evaluate(() => GR.app.economy.coins);
  check('Rewarded ad doubles the coins', doubled > coinsAfterL1, coinsAfterL1 + ' -> ' + doubled);

  await page.click('#ov-complete [data-action="next"]');
  check('Next level starts', (await waitState(page, 'PLAYING')) === 'PLAYING' && (await page.evaluate(() => GR.app.run.level)) === 2);

  // Pause
  await page.keyboard.press('Escape');
  check('ESC pauses', (await state(page)) === 'PAUSED');
  const tPaused = await page.evaluate(() => GR.app.session.timeLeft);
  await page.waitForTimeout(500);
  check('Timer is stopped while paused', (await page.evaluate(() => GR.app.session.timeLeft)) === tPaused);
  await shot(page, '05-paused');
  await page.click('#ov-pause [data-action="resume"]');
  check('Resume returns to play', (await state(page)) === 'PLAYING');

  // Fail -> game over -> revive
  await fastForward(page, 70, false);
  check('Game over appears when target missed', (await waitState(page, 'GAME_OVER')) === 'GAME_OVER');
  await page.waitForTimeout(500);
  await shot(page, '06-game-over');
  await page.click('#ov-gameover [data-action="revive"]');
  await page.waitForFunction(() => GR.app.state === 'PLAYING', null, { timeout: 7000 }).catch(() => {});
  const revived = await page.evaluate(() => ({ st: GR.app.state, t: GR.app.session.timeLeft }));
  check('Revive (simulated ad) continues the level with extra time', revived.st === 'PLAYING' && revived.t > 10, JSON.stringify(revived));
  await fastForward(page, 30, false);
  await waitState(page, 'GAME_OVER');
  check('Revive is only offered once per run', (await page.$('#ov-gameover [data-action="revive"]')) === null);
  await page.keyboard.press('r');
  check('R restarts after game over', (await waitState(page, 'PLAYING')) === 'PLAYING' && (await page.evaluate(() => GR.app.run.level)) === 1);

  // Keyboard launch
  await page.keyboard.press('Space');
  check('SPACE launches the claw', (await page.evaluate(() => GR.app.session.claw.state)) !== 'swing');

  // Boosters
  const boost = await page.evaluate(() => {
    const before = GR.app.economy.boosterCount('freeze');
    GR.app.useBooster('freeze');
    return { before, after: GR.app.economy.boosterCount('freeze'), active: GR.app.session.boosters.freeze > 0 };
  });
  check('Booster activates and is consumed', boost.active && boost.after === boost.before - 1, JSON.stringify(boost));
  const frozen = await page.evaluate(() => GR.app.session.timeLeft);
  await page.waitForTimeout(500);
  check('Time Freeze stops the timer', (await page.evaluate(() => GR.app.session.timeLeft)) === frozen);
  await page.waitForTimeout(300);
  await shot(page, '07-freeze');

  // Home
  await page.keyboard.press('Escape');
  await page.click('#ov-pause [data-action="home"]');
  check('Home from pause', (await waitState(page, 'MENU')) === 'MENU');
  await page.waitForTimeout(1500);
  await shot(page, '08-home');

  // Shop
  await page.evaluate(() => GR.app.economy.addCoins(5000, 'qa'));
  await page.click('#screen-home [data-action="shop"]');
  check('Shop opens', (await state(page)) === 'SHOP');
  await page.waitForTimeout(250);
  await shot(page, '09-shop-mines');
  await page.click('#screen-shop [data-action="cosmetic"][data-id="ruby"]');
  const skin = await page.evaluate(() => GR.app.save.data.cosmetics);
  check('Buying a mine skin owns + equips it', skin.ownedSkins.includes('ruby') && skin.equippedSkin === 'ruby');
  await page.click('#screen-shop [data-action="tab"][data-tab="claws"]');
  await page.click('#screen-shop [data-action="cosmetic"][data-id="golden"]');
  check('Buying a claw skin equips it', (await page.evaluate(() => GR.app.save.data.cosmetics.equippedClaw)) === 'golden');
  await page.waitForTimeout(200);
  await shot(page, '10-shop-claws');
  await page.click('#screen-shop [data-action="tab"][data-tab="boosters"]');
  await shot(page, '11-shop-boosters');
  await page.click('#screen-shop [data-action="tab"][data-tab="packs"]');
  await shot(page, '12-shop-packs');
  await page.click('#screen-shop [data-action="back"]');

  // Upgrades
  await page.click('#screen-home [data-action="upgrades"]');
  const statsBefore = await page.evaluate(() => GR.app.economy.clawStats().retractMult);
  await page.click('#screen-upgrades [data-action="buy"][data-id="clawSpeed"]');
  const statsAfter = await page.evaluate(() => GR.app.economy.clawStats().retractMult);
  check('Upgrades change gameplay stats', statsAfter > statsBefore, statsBefore + ' -> ' + statsAfter);
  await page.waitForTimeout(200);
  await shot(page, '13-upgrades');
  await page.click('#screen-upgrades [data-action="back"]');

  // Daily
  await page.click('#screen-home [data-action="daily"]');
  await page.waitForTimeout(300);
  await shot(page, '14-daily');
  const det = await page.evaluate(() => {
    const a = GR.LevelGen.daily('2026-10-02');
    const b = GR.LevelGen.daily('2026-10-02');
    const c = GR.LevelGen.daily('2026-10-03');
    const sig = (l) => JSON.stringify(l.objects.map((o) => [o.type, Math.round(o.x), Math.round(o.y)]));
    return { same: sig(a) === sig(b), differs: sig(a) !== sig(c), seed: a.seed };
  });
  check('Daily level is deterministic per date', det.same && det.differs, det.seed);
  await page.click('#screen-daily [data-action="play-daily"]');
  check('Daily uses base stats + no boosters', await page.evaluate(() => GR.app.session.stats.retractMult === 1 && !GR.app.session.boostersAllowed));
  await fastForward(page, 70, true);
  check('Daily result screen', (await waitState(page, 'DAILY_RESULT')) === 'DAILY_RESULT');
  await page.waitForTimeout(600);
  await shot(page, '15-daily-result');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => {
    navigator.share = undefined;
  });
  await page.click('#ov-daily [data-action="share"]');
  // Toasts are queued, so earlier achievement toasts may show first.
  const copied = await page
    .waitForFunction(() => [...document.querySelectorAll('.toast strong')].some((t) => /COPIED/.test(t.textContent)), null, { timeout: 9000 })
    .then(() => true)
    .catch(() => false);
  check('Share falls back to clipboard', copied);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('Share text mentions the score', /Gold Rush Daily Challenge/.test(clip), clip);
  await page.click('#ov-daily [data-action="home"]');

  // Other screens
  for (const [action, name] of [['achievements', '16-achievements'], ['leaderboard', '17-leaderboard'], ['settings', '18-settings']]) {
    await page.click('#screen-home [data-action="' + action + '"]');
    await page.waitForTimeout(250);
    await shot(page, name);
    if (action === 'settings') {
      await page.click('#screen-settings [data-key="sound"]');
      await page.click('#screen-settings [data-key="reducedMotion"]');
      const s = await page.evaluate(() => ({ sound: GR.app.audio.soundOn, rm: document.documentElement.classList.contains('reduced-motion'), p: GR.app.particles.reduced }));
      check('Sound toggle works', s.sound === false);
      check('Reduced motion toggle works', s.rm && s.p);
      await page.click('#screen-settings [data-key="sound"]');
      await page.click('#screen-settings [data-key="reducedMotion"]');
    }
    await page.click('[data-action="back"]:visible');
  }

  // Persistence
  await page.evaluate(() => GR.app.save.flush());
  const coinsSaved = await page.evaluate(() => GR.app.economy.coins);
  await page.reload();
  await page.waitForFunction(() => window.GR && GR.app && GR.app.state === 'MENU', null, { timeout: 5000 }).catch(() => {});
  const persisted = await page.evaluate(() => ({ st: GR.app.state, coins: GR.app.economy.coins, v: JSON.parse(localStorage.getItem('goldrush.save')).saveVersion }));
  check('Progress persists across reloads (versioned save)', persisted.st === 'MENU' && persisted.coins === coinsSaved && persisted.v === 1, JSON.stringify(persisted));

  // Offline (service worker)
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 5000 }).catch(() => {});
  await page.reload();
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload().catch(() => {});
  const offline = await page.waitForFunction(() => window.GR && GR.app && GR.app.state === 'MENU', null, { timeout: 5000 }).then(() => true).catch(() => false);
  check('Works offline after first load', offline);
  await ctx.setOffline(false);
  await ctx.close();

  // ------------------------------------------------------------ extra flows
  console.log('\n[extra flows]');
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await c.newPage();
    watch(pg, 'extra');
    await pg.goto(BASE + '?ads=demo');
    await pg.evaluate(() => {
      const d = GR.app.save.data;
      d.tutorial.done = true;
      d.stats.bestLevel = 12;
      GR.app.goHome();
    });
    await pg.waitForTimeout(300);
    const chips = await pg.$$eval('#screen-home .chip', (els) => els.map((e) => e.textContent));
    check('Checkpoint chips appear after reaching level 12', chips.join(',') === 'L1,L6,L11', chips.join(','));
    await pg.click('#screen-home [data-action="settings"]');
    await pg.keyboard.press('Escape');
    check('ESC goes back from a menu screen', (await state(pg)) === 'MENU');

    await pg.click('#screen-home .chip[data-level="1"]');
    await pg.click('#screen-home [data-action="play"]');
    const early = await pg.evaluate(() => {
      const s = GR.app.session;
      const ap = new GR.Autopilot(s, { skill: 0.55, reaction: 0.1, aimNoise: 0.005 });
      for (let i = 0; i < 60 * 60 && !s.reachedTarget && !s.ended; i++) {
        ap.update(1 / 60);
        s.update(1 / 60);
      }
      if (!s.reachedTarget || s.ended) return 'not reached';
      document.querySelector('#hud-done').click();
      for (let i = 0; i < 600 && !s.ended; i++) s.update(1 / 60);
      return s.endReason;
    });
    check('DONE finishes a level early once the target is reached', early === 'early', early);
    await waitState(pg, 'LEVEL_COMPLETE');
    await pg.evaluate(() => (GR.app.save.data.ads.roundsSinceInterstitial = 3));
    await pg.click('#ov-complete [data-action="next"]');
    await pg.waitForTimeout(300);
    const inter = await pg.evaluate(() => document.querySelector('#ov-ad').classList.contains('is-open') && /INTERSTITIAL/.test(document.querySelector('#ov-ad').textContent));
    check('Interstitial placeholder after several rounds (?ads=demo)', inter);
    await pg.screenshot({ path: path.join(OUT, '19-interstitial.png') });
    await pg.waitForFunction(() => GR.app.state === 'PLAYING', null, { timeout: 6000 }).catch(() => {});
    check('Game continues after the interstitial', (await state(pg)) === 'PLAYING');
    await c.close();
  }
  {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pg = await c.newPage();
    watch(pg, 'file://');
    await pg.goto('file://' + path.join(__dirname, '..', 'index.html'));
    const okFile = await pg.waitForFunction(() => window.GR && GR.app && GR.app.state === 'PLAYING', null, { timeout: 5000 }).then(() => true).catch(() => false);
    check('Runs when opened directly from disk (file://)', okFile);
    await c.close();
  }

  // ------------------------------------------------------------ viewports
  console.log('\n[viewports]');
  const sizes = [
    [320, 568, true], [375, 667, true], [430, 932, true], [768, 1024, true], [1024, 768, false], [1440, 900, false],
  ];
  for (const [w, h, mobile] of sizes) {
    const c = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const pg = await c.newPage();
    watch(pg, w + 'x' + h);
    await pg.goto(BASE);
    await pg.evaluate(() => {
      GR.app.save.data.tutorial.done = true;
      GR.app.goHome();
    });
    await pg.waitForTimeout(700);
    const overflow = await pg.evaluate(() => {
      const home = document.querySelector('.home');
      return { scrollW: document.documentElement.scrollWidth, w: window.innerWidth, homeH: home.scrollHeight, stageH: document.getElementById('stage').clientHeight };
    });
    check(w + 'x' + h + ' no horizontal overflow, home fits', overflow.scrollW <= overflow.w && overflow.homeH <= overflow.stageH, JSON.stringify(overflow));
    await shot(pg, 'vp-' + w + 'x' + h + '-home');
    await pg.click('#screen-home [data-action="play"]');
    await pg.waitForTimeout(1900);
    await shot(pg, 'vp-' + w + 'x' + h + '-play');
    await c.close();
  }

  await browser.close();
  console.log('\nConsole errors: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'none'));
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length || errors.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
