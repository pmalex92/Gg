/**
 * Daily missions: three small goals a day ("Catch 3 diamonds"), picked from a
 * pool with the date as seed. Progress comes from gameplay events via
 * Missions.track(); finished missions pay out automatically and finishing
 * all three pays a bonus token. Missions reset at local midnight.
 */
(function (GR) {
  'use strict';

  // goal: [min, max] picked per day; reward scales with the goal.
  const POOL = [
    { id: 'diamonds', event: 'diamond', text: 'Catch {n} diamonds', goal: [3, 6], coins: 40 },
    { id: 'gold', event: 'gold', text: 'Collect {n} gold nuggets or bars', goal: [10, 20], coins: 12 },
    { id: 'money', event: 'money', text: 'Collect ${n} in total', goal: [3000, 8000], coins: 0.035, round: 500 },
    { id: 'levels', event: 'level', text: 'Complete {n} levels', goal: [3, 6], coins: 45 },
    { id: 'combo', event: 'combo', text: 'Reach a COMBO x{n}', goal: [3, 5], coins: 60, max: true },
    { id: 'tnt', event: 'tnt', text: 'Blow up {n} TNT', goal: [2, 4], coins: 55 },
    { id: 'clean', event: 'cleanLevel', text: 'Complete a level without a rock', goal: [1, 1], coins: 150 },
    { id: 'bags', event: 'bag', text: 'Open {n} mystery bags', goal: [2, 4], coins: 50 },
    { id: 'stars', event: 'stars3', text: 'Earn 3 stars on a level', goal: [1, 1], coins: 150 },
    { id: 'daily', event: 'daily', text: 'Play the Daily Challenge', goal: [1, 1], coins: 100 },
    { id: 'perks', event: 'perk', text: 'Pick {n} perks', goal: [2, 4], coins: 45 },
  ];

  class Missions {
    constructor(saveManager, economy, bus) {
      this.saveManager = saveManager;
      this.economy = economy;
      this.bus = bus;
    }

    /** Today's three missions (generated on first access each day). */
    list() {
      const today = GR.util.dateKey();
      const data = this.saveManager.data.missions;
      if (data.date !== today) {
        const rng = GR.RNG.fromString('missions-' + today);
        const picks = rng.shuffle(POOL.slice()).slice(0, 3);
        data.date = today;
        data.bonusPaid = false;
        data.list = picks.map((m) => {
          let goal = rng.int(m.goal[0], m.goal[1]);
          if (m.round) goal = Math.round(goal / m.round) * m.round;
          const coins = m.coins < 1 ? Math.round((goal * m.coins) / 10) * 10 : Math.round(m.coins * (m.goal[1] > 1 ? goal : 1));
          return { id: m.id, goal, progress: 0, coins: Math.max(50, coins), done: false };
        });
        this.saveManager.save();
      }
      return data.list;
    }

    describe(m) {
      const def = POOL.find((d) => d.id === m.id);
      return def.text.replace('{n}', GR.util.formatNumber(m.goal));
    }

    /** Feed a gameplay event; returns missions completed by it. */
    track(event, amount) {
      const done = [];
      this.list().forEach((m) => {
        const def = POOL.find((d) => d.id === m.id);
        if (m.done || def.event !== event) return;
        const prev = m.progress;
        m.progress = def.max ? Math.max(m.progress, amount) : m.progress + (amount === undefined ? 1 : amount);
        m.progress = Math.min(m.goal, m.progress);
        if (m.progress >= m.goal) {
          m.done = true;
          this.economy.addCoins(m.coins, 'mission');
          done.push(m);
          this.bus.emit('mission', { mission: m, text: this.describe(m) });
        } else if (m.progress !== prev) {
          this.saveManager.save();
        }
      });
      const data = this.saveManager.data.missions;
      if (done.length && !data.bonusPaid && data.list.every((m) => m.done)) {
        data.bonusPaid = true;
        this.economy.addTokens(1, 'missions');
        this.bus.emit('missionsAll', {});
      }
      if (done.length) this.saveManager.save();
      return done;
    }

    /** The unfinished mission closest to completion (for result screens). */
    closest() {
      return this.list()
        .filter((m) => !m.done)
        .sort((a, b) => b.progress / b.goal - a.progress / a.goal)[0] || null;
    }

    doneCount() {
      return this.list().filter((m) => m.done).length;
    }
  }

  Missions.POOL = POOL;
  GR.Missions = Missions;
})((window.GR = window.GR || {}));
