#!/usr/bin/env node
/**
 * Headless balance check: plays generated levels with the Autopilot bot and
 * reports how often each level's target is reachable.
 *
 *   node tools/simulate.js [levels=25] [runsPerLevel=12]
 *
 * Gameplay logic is DOM-free, so it runs here exactly as in the browser.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'src/core/util.js', 'src/core/rng.js', 'src/core/events.js', 'src/config.js',
  'src/data/objects.js', 'src/data/upgrades.js', 'src/data/boosters.js',
  'src/systems/economy.js', 'src/systems/daily.js',
  'src/game/levelgen.js', 'src/game/claw.js', 'src/game/session.js', 'src/game/autopilot.js',
];

function loadGame() {
  const sandbox = { console, Intl, Math, Date, JSON, Object, Array, Set, Map };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  FILES.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }));
  return sandbox.GR;
}

const PLAYERS = {
  casual: { skill: 0.5, reaction: 0.22, aimNoise: 0.055 },
  expert: { skill: 0.8, reaction: 0.12, aimNoise: 0.015 },
};

function play(GR, level, stats, player, seed) {
  const session = new GR.GameSession({ level, stats, boostersAllowed: false });
  const bot = new GR.Autopilot(session, Object.assign({ rng: new GR.RNG(seed || 7) }, player));
  const dt = 1 / 60;
  let guard = 0;
  while (!session.ended && guard++ < 60 * 200) {
    bot.update(dt);
    session.update(dt);
  }
  return session.result;
}

function main() {
  const GR = loadGame();
  const maxLevel = +process.argv[2] || 25;
  const runs = +process.argv[3] || 12;
  const profiles = {
    base: GR.Economy.baseClawStats(),
    mid: { retractMult: 1.15, weightReduction: 0.3, extraTime: 6, grabBonus: 8, coinMult: 1 },
    max: { retractMult: 1.3, weightReduction: 0.5, extraTime: 10, grabBonus: 22, coinMult: 1 },
  };

  console.log('casual player pass rate by upgrade tier; expert = near-perfect aim, base stats');
  console.log('level  target  objs  fieldV | casual base / mid / max | expert | avg$ casual base / expert');
  for (let n = 1; n <= maxLevel; n++) {
    const agg = {};
    let target = 0;
    let objs = 0;
    let fv = 0;
    ['base', 'mid', 'max', 'expert'].forEach((p) => (agg[p] = { pass: 0, money: 0 }));
    for (let r = 0; r < runs; r++) {
      const lvl = GR.LevelGen.campaign(n, 'sim' + r);
      target += lvl.target;
      objs += lvl.objects.length;
      fv += lvl.fieldValue;
      ['base', 'mid', 'max'].forEach((p) => {
        const res = play(GR, lvl, profiles[p], PLAYERS.casual, r + 1);
        if (res.success) agg[p].pass++;
        agg[p].money += res.money;
      });
      const res = play(GR, lvl, profiles.base, PLAYERS.expert, r + 1);
      if (res.success) agg.expert.pass++;
      agg.expert.money += res.money;
    }
    const pct = (p) => String(Math.round((agg[p].pass / runs) * 100)).padStart(4) + '%';
    const avg = (p) => String(Math.round(agg[p].money / runs)).padStart(5);
    console.log(
      String(n).padStart(5), String(Math.round(target / runs)).padStart(7), String(Math.round(objs / runs)).padStart(5),
      String(Math.round(fv / runs)).padStart(7), '|', pct('base'), pct('mid'), pct('max'), ' |', pct('expert'), ' |', avg('base'), avg('expert')
    );
  }

  // Daily challenge: base stats only.
  const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
  console.log('\ndaily        modifier       target  fieldV | casual best-of-5 money');
  days.forEach((d) => {
    const lvl = GR.LevelGen.daily(d);
    const again = GR.LevelGen.daily(d);
    const same = JSON.stringify(lvl.objects.map((o) => [o.type, o.x, o.y])) === JSON.stringify(again.objects.map((o) => [o.type, o.x, o.y]));
    let best = 0;
    for (let i = 0; i < 5; i++) best = Math.max(best, play(GR, lvl, profiles.base, PLAYERS.casual, i + 1).money);
    console.log(d, String(lvl.modifier).padEnd(14), String(lvl.target).padStart(7), String(lvl.fieldValue).padStart(7), '|', best, best >= lvl.target ? 'PASS' : 'fail', same ? '(deterministic)' : 'NOT DETERMINISTIC');
  });
}

main();
