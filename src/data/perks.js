/**
 * Run perks: after each completed campaign level the player picks 1 of 3.
 * A perk lasts until the run ends, so every run plays out a bit differently.
 * Not available in the Daily Challenge (everyone plays on equal terms).
 *
 * Perks.modifiers(ids) folds the chosen perks into one plain object that
 * GameSession and the app read; Perks.applyToStats() merges the claw ones
 * into the upgrade stats.
 */
(function (GR) {
  'use strict';

  GR.PERKS = [
    { id: 'gem_polish', name: 'Gem Polish', icon: 'gem', color: '#7fd8ff', desc: 'Gems and relics are worth +30%.' },
    { id: 'gold_fever', name: 'Gold Fever', icon: 'coins', color: '#ffc531', desc: 'Gold nuggets and bars are worth +20%.' },
    { id: 'demolition', name: 'Demolition Pro', icon: 'bolt', color: '#ff7a2a', desc: 'TNT blasts pay full value instead of half.' },
    { id: 'rock_collector', name: 'Rock Collector', icon: 'trophy', color: '#b9bec6', desc: 'Rocks are worth 8x and no longer break your combo.' },
    { id: 'greased_reel', name: 'Greased Reel', icon: 'upgrade', color: '#6fdc74', desc: 'The claw reels in 15% faster.' },
    { id: 'strong_arm', name: 'Strong Arm', icon: 'muscle', color: '#ff9f43', desc: 'Everything feels 25% lighter.' },
    { id: 'overtime', name: 'Overtime', icon: 'clock', color: '#9fe8ff', desc: '+6 seconds on every level.' },
    { id: 'combo_master', name: 'Combo Master', icon: 'flame', color: '#ff8a2a', desc: 'Combos give +15% per step and go up to x8.' },
    { id: 'lucky_bags', name: 'Lucky Bags', icon: 'gift', color: '#d9b07a', desc: 'Mystery bags pay double.' },
    { id: 'good_boy', name: 'Good Boy', icon: 'star', color: '#ffe08a', desc: 'Nugget digs up a bonus find early in every level.' },
    { id: 'piggy_bank', name: 'Piggy Bank', icon: 'coin', color: '#ffd23f', desc: '+40% coins for the rest of the run.' },
    { id: 'steady_hands', name: 'Steady Hands', icon: 'claw', color: '#c4b398', desc: 'The claw swings 20% slower, easier to aim.' },
  ];
  GR.PERKS_BY_ID = {};
  GR.PERKS.forEach((p) => (GR.PERKS_BY_ID[p.id] = p));

  GR.Perks = {
    /** Fold a list of perk ids into modifiers (neutral values when empty). */
    modifiers(ids) {
      const has = (id) => (ids || []).indexOf(id) >= 0;
      return {
        valueMult: {
          gem: has('gem_polish') ? 1.3 : 1,
          relic: has('gem_polish') ? 1.3 : 1,
          gold: has('gold_fever') ? 1.2 : 1,
          rock: has('rock_collector') ? 8 : 1,
        },
        tntPayout: has('demolition') ? 1 : GR.CONFIG.TNT.payout,
        rockKeepsCombo: has('rock_collector'),
        comboStep: has('combo_master') ? 0.15 : GR.CONFIG.COMBO.bonusPerStep,
        comboMax: has('combo_master') ? 8 : GR.CONFIG.COMBO.maxStep,
        bagMult: has('lucky_bags') ? 2 : 1,
        fetch: has('good_boy'),
        swingMult: has('steady_hands') ? 0.8 : 1,
        coinMult: has('piggy_bank') ? 1.4 : 1,
        retractMult: has('greased_reel') ? 1.15 : 1,
        weightReduction: has('strong_arm') ? 0.25 : 0,
        extraTime: has('overtime') ? 6 : 0,
      };
    },

    /** Upgrade stats + claw perks. */
    applyToStats(stats, mods) {
      return Object.assign({}, stats, {
        retractMult: stats.retractMult * mods.retractMult,
        weightReduction: 1 - (1 - stats.weightReduction) * (1 - mods.weightReduction),
        extraTime: stats.extraTime + mods.extraTime,
      });
    },

    /** Three different perks the run doesn't have yet (random each time). */
    offer(owned, rng) {
      const pool = GR.PERKS.filter((p) => (owned || []).indexOf(p.id) < 0);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor((rng ? rng() : Math.random()) * (i + 1));
        const t = pool[i];
        pool[i] = pool[j];
        pool[j] = t;
      }
      return pool.slice(0, 3);
    },
  };
})((window.GR = window.GR || {}));
