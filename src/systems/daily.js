/**
 * Daily Challenge + streak.
 *
 * The seed is derived from the local calendar date ("daily-2026-10-02"), so
 * everyone playing on the same date gets the exact same level. A modifier
 * (Gem Rush, TNT Party...) is also picked from the same seed for variety.
 *
 * Streaks are deliberately forgiving: missing a single day keeps the streak
 * alive ("grace day"); only a longer gap restarts it at day 1.
 */
(function (GR) {
  'use strict';

  const STREAK_REWARDS = [
    { day: 1, coins: 100 },
    { day: 2, coins: 150 },
    { day: 3, coins: 250 },
    { day: 4, coins: 300 },
    { day: 5, coins: 400 },
    { day: 6, coins: 500 },
    { day: 7, coins: 500, special: true },
  ];

  const MODIFIERS = [
    { id: 'classic', name: 'Classic Dig', desc: 'A balanced mix of everything.' },
    { id: 'gem_rush', name: 'Gem Rush', desc: 'Fewer nuggets, way more gems.' },
    { id: 'tnt_party', name: 'TNT Party', desc: 'Explosives everywhere. Use them!' },
    { id: 'rock_garden', name: 'Rock Garden', desc: 'Treasure hides behind boulders.' },
    { id: 'gold_fever', name: 'Gold Fever', desc: 'Bars and big nuggets galore.' },
    { id: 'crab_parade', name: 'Crab Parade', desc: 'Catch the gem-carrying crabs.' },
  ];

  class Daily {
    constructor(saveManager, economy, bus) {
      this.saveManager = saveManager;
      this.economy = economy;
      this.bus = bus;
    }

    get data() {
      return this.saveManager.data.daily;
    }

    today() {
      return GR.util.dateKey();
    }

    seedFor(dateKey) {
      return 'daily-' + dateKey;
    }

    modifierFor(dateKey) {
      return Daily.modifierFor(dateKey);
    }

    static modifierFor(dateKey) {
      return GR.RNG.fromString('mod-' + dateKey).pick(MODIFIERS);
    }

    bestFor(dateKey) {
      return this.data.best[dateKey] || 0;
    }

    isCompleted(dateKey) {
      return !!this.data.completed[dateKey];
    }

    /** Streak as displayed today (0 if it has lapsed beyond the grace day). */
    currentStreak() {
      const last = this.data.lastCompleted;
      if (!last) return 0;
      const gap = GR.util.daysBetween(last, this.today());
      return gap <= 2 ? this.data.streak : 0;
    }

    /** Which day of the 7-day reward track the next completion lands on. */
    nextStreakDay() {
      if (this.isCompleted(this.today())) return ((this.data.streak - 1) % 7) + 1;
      return (this.currentStreak() % 7) + 1;
    }

    rewardForDay(day, cycle) {
      const r = STREAK_REWARDS[day - 1];
      const bundle = { coins: r.coins };
      if (r.special) {
        if (cycle === 0 && !this.economy.owns('claw', 'royal')) bundle.claws = ['royal'];
        bundle.tokens = cycle === 0 ? 5 : 3;
      }
      return bundle;
    }

    /** Record a finished daily run. Returns details for the result screen. */
    recordResult(dateKey, score, reachedTarget) {
      const prevBest = this.bestFor(dateKey);
      const isBest = score > prevBest;
      if (isBest) this.data.best[dateKey] = score;
      const out = { score, prevBest, best: Math.max(prevBest, score), isBest, streakReward: null };

      if (reachedTarget && !this.isCompleted(dateKey)) {
        const last = this.data.lastCompleted;
        const gap = last ? GR.util.daysBetween(last, dateKey) : Infinity;
        const saved = gap === 2;
        this.data.streak = gap === 1 || gap === 2 ? this.data.streak + 1 : 1;
        this.data.bestStreak = Math.max(this.data.bestStreak, this.data.streak);
        this.data.lastCompleted = dateKey;
        this.data.completed[dateKey] = true;
        this.saveManager.data.stats.dailyCompleted += 1;

        const day = ((this.data.streak - 1) % 7) + 1;
        const cycle = Math.floor((this.data.streak - 1) / 7);
        const bundle = this.rewardForDay(day, cycle);
        this.economy.grant(bundle, 'streak');
        out.streakReward = { streak: this.data.streak, day, bundle, graceUsed: saved };
      }
      this.saveManager.save();
      return out;
    }
  }

  Daily.STREAK_REWARDS = STREAK_REWARDS;
  Daily.MODIFIERS = MODIFIERS;
  GR.Daily = Daily;
})((window.GR = window.GR || {}));
