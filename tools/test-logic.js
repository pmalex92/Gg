#!/usr/bin/env node
/**
 * Fast logic tests (no browser): node tools/test-logic.js
 * Covers save robustness, economy rules, streak grace days, achievements,
 * level-generator determinism/robustness and core session rules.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'src/core/util.js', 'src/core/rng.js', 'src/core/events.js', 'src/config.js',
  'src/data/objects.js', 'src/data/upgrades.js', 'src/data/boosters.js', 'src/data/cosmetics.js',
  'src/data/achievements.js', 'src/data/products.js', 'src/data/perks.js',
  'src/systems/save.js', 'src/systems/economy.js', 'src/systems/achievements.js', 'src/systems/daily.js',
  'src/systems/leaderboard.js', 'src/systems/missions.js',
  'src/game/levelgen.js', 'src/game/claw.js', 'src/game/session.js', 'src/game/autopilot.js',
];

function load(storage) {
  const store = storage || {};
  const sb = {
    console, Intl, Math, Date, JSON, Object, Array, Set, Map, Promise,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => (store[k] = String(v)),
    },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
  };
  sb.window = sb;
  vm.createContext(sb);
  FILES.forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sb, { filename: f }));
  return { GR: sb.GR, store };
}

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || 'expected equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b));
}
function ok(v, msg) {
  if (!v) throw new Error(msg || 'expected truthy');
}

function systems(storage) {
  const { GR, store } = load(storage);
  const save = new GR.SaveManager(GR.CONFIG.SAVE_KEY);
  save.load();
  const bus = new GR.EventBus();
  const eco = new GR.Economy(save, bus);
  const ach = new GR.Achievements(save, eco, bus);
  const daily = new GR.Daily(save, eco, bus);
  return { GR, store, save, eco, ach, daily, bus };
}

console.log('\n[save]');
test('fresh save has version + defaults', () => {
  const { save } = systems();
  eq(save.data.saveVersion, 1);
  eq(save.data.wallet.coins, 0);
  ok(save.isNew);
});
test('corrupted save falls back to defaults', () => {
  const { save } = systems({ 'goldrush.save': '{not json' });
  eq(save.data.wallet.coins, 0);
});
test('partial/old save is merged with new defaults', () => {
  const { save } = systems({ 'goldrush.save': JSON.stringify({ saveVersion: 1, wallet: { coins: 77 } }) });
  eq(save.data.wallet.coins, 77);
  eq(save.data.upgrades.clawSpeed, 0);
  ok(Array.isArray(save.data.cosmetics.ownedSkins));
  ok(!save.isNew);
});
test('save round-trips through storage', () => {
  const a = systems();
  a.eco.addCoins(123);
  a.save.flush();
  const b = systems(a.store);
  eq(b.eco.coins, 123);
});

console.log('\n[economy]');
test('cannot buy what you cannot afford', () => {
  const { eco } = systems();
  ok(!eco.buyUpgrade('clawSpeed'));
  eq(eco.upgradeLevel('clawSpeed'), 0);
});
test('upgrade purchase spends coins and raises the effect', () => {
  const { eco } = systems();
  eco.addCoins(100);
  ok(eco.buyUpgrade('clawSpeed'));
  eq(eco.coins, 0);
  eq(eco.clawStats().retractMult, 1.05);
});
test('upgrades cap at level 5', () => {
  const { eco } = systems();
  eco.addCoins(1e6);
  for (let i = 0; i < 8; i++) eco.buyUpgrade('magnet');
  eq(eco.upgradeLevel('magnet'), 5);
  eq(eco.nextUpgradePrice('magnet'), null);
});
test('upgrade prices increase', () => {
  const { GR } = systems();
  GR.UPGRADES.forEach((u) => u.prices.forEach((p, i) => i && ok(p > u.prices[i - 1], u.id)));
});
test('cosmetic states: equipped / owned / locked / purchase / exclusive', () => {
  const { GR, eco } = systems();
  eq(eco.cosmeticState('skin', GR.MINE_SKINS_BY_ID.classic), 'equipped');
  eq(eco.cosmeticState('skin', GR.MINE_SKINS_BY_ID.ruby), 'purchase');
  eq(eco.cosmeticState('skin', GR.MINE_SKINS_BY_ID.lava), 'locked');
  eq(eco.cosmeticState('skin', GR.MINE_SKINS_BY_ID.sunset), 'exclusive');
  eco.addCoins(400);
  ok(eco.buyCosmetic('skin', GR.MINE_SKINS_BY_ID.ruby));
  eq(eco.cosmeticState('skin', GR.MINE_SKINS_BY_ID.ruby), 'equipped');
  eq(eco.cosmeticState('skin', GR.MINE_SKINS_BY_ID.classic), 'owned');
});
test('XP levels up and pays a reward', () => {
  const { eco } = systems();
  const ups = eco.addXp(1000);
  ok(ups.length >= 3);
  ok(eco.coins > 0);
});

console.log('\n[daily + streak]');
test('streak grows on consecutive days', () => {
  const { daily } = systems();
  daily.recordResult('2026-10-01', 5000, true);
  daily.recordResult('2026-10-02', 5000, true);
  const r = daily.recordResult('2026-10-03', 5000, true);
  eq(r.streakReward.streak, 3);
  eq(r.streakReward.bundle.coins, 250);
});
test('one missed day keeps the streak (grace day)', () => {
  const { daily } = systems();
  daily.recordResult('2026-10-01', 5000, true);
  const r = daily.recordResult('2026-10-03', 5000, true);
  eq(r.streakReward.streak, 2);
  ok(r.streakReward.graceUsed);
});
test('a long gap restarts the streak at day 1 (best is kept)', () => {
  const { daily, save } = systems();
  daily.recordResult('2026-10-01', 5000, true);
  daily.recordResult('2026-10-02', 5000, true);
  const r = daily.recordResult('2026-10-09', 5000, true);
  eq(r.streakReward.streak, 1);
  eq(save.data.daily.bestStreak, 2);
});
test('only the first completion per day pays out; best score is kept', () => {
  const { daily } = systems();
  daily.recordResult('2026-10-01', 4000, true);
  const r = daily.recordResult('2026-10-01', 6000, true);
  eq(r.streakReward, null);
  eq(r.best, 6000);
  eq(daily.recordResult('2026-10-01', 100, false).best, 6000);
});
test('day 7 grants the Royal Claw once', () => {
  const { daily, eco } = systems();
  for (let d = 1; d <= 7; d++) daily.recordResult('2026-10-0' + d, 5000, true);
  ok(eco.owns('claw', 'royal'));
});
test('failed attempts do not advance the streak', () => {
  const { daily, save } = systems();
  daily.recordResult('2026-10-01', 100, false);
  eq(save.data.daily.streak, 0);
});

console.log('\n[achievements]');
test('achievements unlock once and pay rewards', () => {
  const { save, ach, eco } = systems();
  save.data.stats.goldCollected = 1;
  const first = ach.evaluate();
  ok(first.some((a) => a.id === 'first_dig'));
  const coins = eco.coins;
  eq(ach.evaluate().length, 0);
  eq(eco.coins, coins);
});

console.log('\n[level generator]');
test('daily level is identical for the same date and differs across dates', () => {
  const { GR } = systems();
  const sig = (l) => JSON.stringify(l.objects.map((o) => [o.type, +o.x.toFixed(3), +o.y.toFixed(3), o.value]));
  eq(sig(GR.LevelGen.daily('2026-10-02')), sig(GR.LevelGen.daily('2026-10-02')));
  ok(sig(GR.LevelGen.daily('2026-10-02')) !== sig(GR.LevelGen.daily('2026-10-03')));
});
test('levels 1-60 generate valid, non-overlapping, in-bounds fields', () => {
  const { GR } = systems();
  const F = GR.CONFIG.FIELD;
  for (let n = 1; n <= 60; n++) {
    for (const seed of ['a', 'b', 'c']) {
      const l = GR.LevelGen.campaign(n, seed);
      ok(l.objects.length >= 8, 'L' + n + ' too few objects');
      ok(l.target > 0 && l.target <= l.fieldValue, 'L' + n + ' target ' + l.target + ' vs field ' + l.fieldValue);
      l.objects.forEach((o, i) => {
        ok(o.x - o.r >= F.x0 - 0.01 && o.x + o.r <= F.x1 + 0.01 && o.y + o.r <= F.y1 + 0.01, 'L' + n + ' out of bounds ' + o.type);
        for (let j = i + 1; j < l.objects.length; j++) {
          const p = l.objects[j];
          if (o.vx || p.vx) continue; // movers share lanes by design
          ok(Math.hypot(o.x - p.x, o.y - p.y) >= o.r + p.r, 'L' + n + ' overlap ' + o.type + '/' + p.type);
        }
      });
    }
  }
});
test('difficulty ramps: targets rise, early levels have no TNT/crabs', () => {
  const { GR } = systems();
  for (let n = 2; n <= 40; n++) ok(GR.LevelGen.targetFor(n) > GR.LevelGen.targetFor(n - 1));
  const l1 = GR.LevelGen.campaign(1, 'x');
  ok(!l1.objects.some((o) => o.kind === 'tnt' || o.kind === 'critter'));
  ok(GR.LevelGen.campaign(12, 'x').objects.some((o) => o.kind === 'tnt'));
  ok(GR.LevelGen.campaign(12, 'x').objects.some((o) => o.rolling), 'rolling boulder from L10');
  ok(!GR.LevelGen.campaign(9, 'x').objects.some((o) => o.rolling));
});

console.log('\n[session]');
function session(GR, level, opts) {
  return new GR.GameSession(Object.assign({ level }, opts || {}));
}
test('timer ends the level and grades success', () => {
  const { GR } = systems();
  const s = session(GR, GR.LevelGen.campaign(1, 's'));
  for (let i = 0; i < 61 * 60; i++) s.update(1 / 60);
  ok(s.ended);
  eq(s.result.success, false);
});
test('tutorial timer waits for first launch', () => {
  const { GR } = systems();
  const s = session(GR, GR.LevelGen.campaign(1, 's'), { tutorial: true });
  for (let i = 0; i < 120; i++) s.update(1 / 60);
  eq(s.timeLeft, s.timeTotal);
  s.launch();
  s.update(1 / 60);
  ok(s.timeLeft < s.timeTotal);
});
test('rocks break the combo, valuables build it', () => {
  const { GR } = systems();
  const s = session(GR, GR.LevelGen.campaign(1, 's'));
  const mk = (type, kind, value) => ({ type, kind, value, weight: 1, r: 20 });
  s.deliver(mk('small_gold', 'gold', 50));
  s.deliver(mk('small_gold', 'gold', 50));
  eq(s.combo, 2);
  eq(s.money, 50 + 55);
  s.deliver(mk('small_rock', 'rock', 10));
  eq(s.combo, 0);
});
test('TNT destroys neighbours, pays half value and chains', () => {
  const { GR } = systems();
  const lvl = { mode: 'campaign', level: 3, seed: 't', target: 100, time: 60, swingSpeed: 1.7, objects: [
    { uid: 1, type: 'tnt', kind: 'tnt', x: 300, y: 600, r: 25, value: 0, weight: 0, alive: true },
    { uid: 2, type: 'diamond', kind: 'gem', x: 380, y: 600, r: 17, value: 500, weight: 1, alive: true },
    { uid: 3, type: 'tnt', kind: 'tnt', x: 200, y: 640, r: 25, value: 0, weight: 0, alive: true },
    { uid: 4, type: 'large_rock', kind: 'rock', x: 90, y: 660, r: 46, value: 5, weight: 8, alive: true },
    { uid: 5, type: 'small_gold', kind: 'gold', x: 600, y: 1000, r: 22, value: 50, weight: 1, alive: true },
  ] };
  const s = session(GR, lvl);
  let blasts = 0;
  s.events.on('explode', () => blasts++);
  s.grab(s.objects[0]);
  eq(s.money, 250);
  for (let i = 0; i < 30; i++) s.update(1 / 60);
  eq(blasts, 2, 'chain reaction');
  ok(!s.objects[3].alive, 'rock cleared by chained TNT');
  ok(s.objects[4].alive, 'far gold untouched');
});
test('mystery bags are deterministic per level seed', () => {
  const { GR } = systems();
  const lvl = GR.LevelGen.daily('2026-10-02');
  const open = () => {
    const s = session(GR, lvl);
    return [0, 1, 2, 3].map(() => JSON.stringify(s.openBag({ x: 0, y: 0 })));
  };
  eq(JSON.stringify(open()), JSON.stringify(open()));
});
test('boosters are refused when not allowed (Daily)', () => {
  const { GR } = systems();
  const s = session(GR, GR.LevelGen.daily('2026-10-02'), { boostersAllowed: false });
  ok(!s.activateBooster('frenzy'));
});
test('revive continues with extra time', () => {
  const { GR } = systems();
  const s = session(GR, GR.LevelGen.campaign(2, 's'));
  for (let i = 0; i < 61 * 60 && !s.ended; i++) s.update(1 / 60);
  ok(s.ended);
  s.revive(15);
  ok(!s.ended);
  eq(s.timeLeft, 15);
});

console.log('\n[perks]');
test('perk offers are 3 distinct perks the run does not own', () => {
  const { GR } = systems();
  const owned = ['gem_polish', 'overtime'];
  const offer = GR.Perks.offer(owned);
  eq(offer.length, 3);
  eq(new Set(offer.map((p) => p.id)).size, 3);
  ok(offer.every((p) => owned.indexOf(p.id) < 0));
});
test('value perks raise payouts; Rock Collector keeps the combo', () => {
  const { GR } = systems();
  const mods = GR.Perks.modifiers(['gem_polish', 'rock_collector']);
  const s = session(GR, GR.LevelGen.campaign(1, 's'), { mods });
  s.deliver({ type: 'diamond', kind: 'gem', value: 500, weight: 1, r: 17 });
  eq(s.money, 650);
  s.deliver({ type: 'small_gold', kind: 'gold', value: 50, weight: 1, r: 20 });
  s.deliver({ type: 'small_rock', kind: 'rock', value: 10, weight: 3, r: 20 });
  eq(s.combo, 2, 'rock no longer breaks the combo');
  eq(s.money, 650 + 55 + 80);
});
test('Demolition Pro pays full TNT value', () => {
  const { GR } = systems();
  const lvl = { mode: 'campaign', level: 3, seed: 't', target: 100, time: 60, swingSpeed: 1.7, objects: [
    { uid: 1, type: 'tnt', kind: 'tnt', x: 300, y: 600, r: 25, value: 0, weight: 0, alive: true },
    { uid: 2, type: 'diamond', kind: 'gem', x: 380, y: 600, r: 17, value: 500, weight: 1, alive: true },
  ] };
  const s = session(GR, lvl, { mods: GR.Perks.modifiers(['demolition']) });
  s.grab(s.objects[0]);
  eq(s.money, 500);
});
test('Good Boy perk: Nugget fetches a bonus once per level', () => {
  const { GR } = systems();
  const s = session(GR, GR.LevelGen.campaign(3, 's'), { mods: GR.Perks.modifiers(['good_boy']) });
  let fetched = 0;
  s.events.on('fetch', () => fetched++);
  for (let i = 0; i < 20 * 60; i++) s.update(1 / 60);
  eq(fetched, 1);
  ok(s.money >= 50);
});
test('claw perks merge with upgrade stats', () => {
  const { GR } = systems();
  const st = GR.Perks.applyToStats({ retractMult: 1.1, weightReduction: 0.2, extraTime: 4, grabBonus: 0, coinMult: 1 }, GR.Perks.modifiers(['greased_reel', 'strong_arm', 'overtime']));
  ok(Math.abs(st.retractMult - 1.265) < 1e-9);
  ok(Math.abs(st.weightReduction - 0.4) < 1e-9);
  eq(st.extraTime, 10);
});

console.log('\n[missions]');
test('three missions per day, same list for the same date', () => {
  const a = systems();
  const b = systems();
  const la = a.GR && new a.GR.Missions(a.save, a.eco, a.bus).list();
  const lb = new b.GR.Missions(b.save, b.eco, b.bus).list();
  eq(la.length, 3);
  eq(JSON.stringify(la.map((m) => [m.id, m.goal])), JSON.stringify(lb.map((m) => [m.id, m.goal])));
});
test('missions complete, pay coins once, and all three pay a bonus token', () => {
  const { GR, save, eco, bus } = systems();
  const ms = new GR.Missions(save, eco, bus);
  const events = { diamond: 'diamond', gold: 'gold', money: 'money', levels: 'level', combo: 'combo', tnt: 'tnt', clean: 'cleanLevel', bags: 'bag', stars: 'stars3', daily: 'daily', perks: 'perk' };
  const list = ms.list();
  list.forEach((m) => {
    const ev = events[m.id];
    if (m.id === 'combo') ms.track(ev, m.goal);
    else if (m.id === 'money') ms.track(ev, m.goal);
    else for (let i = 0; i < m.goal; i++) ms.track(ev);
  });
  ok(list.every((m) => m.done));
  const total = list.reduce((s, m) => s + m.coins, 0);
  eq(eco.coins, total);
  eq(eco.tokens, 1);
  ms.track('diamond');
  eq(eco.coins, total, 'no double pay');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
