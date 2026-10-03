/**
 * Versioned local save (localStorage).
 *
 * - `saveVersion` lets future builds migrate old saves step by step
 *   (MIGRATIONS[n] upgrades a version-n save to version n+1).
 * - Loading always deep-merges onto DEFAULTS, so new fields appear
 *   automatically and a corrupted/partial save can never crash the game.
 * - Writes are debounced; flush() is called on pagehide/visibilitychange.
 * - Only game progress is stored — no personal data.
 */
(function (GR) {
  'use strict';

  const CURRENT_VERSION = 2;

  function defaults() {
    return {
      saveVersion: CURRENT_VERSION,
      createdAt: Date.now(),
      wallet: { coins: 0, tokens: 0 },
      player: { xp: 0, level: 1, name: 'PLAYER' },
      upgrades: { clawSpeed: 0, clawPower: 0, coinMultiplier: 0, timer: 0, magnet: 0 },
      // A small welcome gift so new players can try every booster once.
      boosters: { magnet: 1, frenzy: 1, freeze: 1, double: 1 },
      cosmetics: {
        ownedSkins: ['classic'], equippedSkin: 'classic',
        ownedClaws: ['classic'], equippedClaw: 'classic',
      },
      achievements: {},
      stats: {
        goldCollected: 0, diamonds: 0, gems: 0, rocks: 0, crabs: 0, relics: 0, bags: 0,
        tntExploded: 0, cleanLevels: 0, threeStarLevels: 0, bestCombo: 0,
        bestRoundMoney: 0, bestRun: 0, bestLevel: 1, totalCoinsEarned: 0, totalMoney: 0,
        roundsPlayed: 0, levelsCompleted: 0, dailyCompleted: 0, upgradesBought: 0,
        weekKey: '', weekBest: 0,
      },
      daily: { best: {}, completed: {}, lastCompleted: '', streak: 0, bestStreak: 0 },
      settings: { sound: true, music: true, reducedMotion: false, haptics: true },
      // done: first catch made · graduated: finished the guided levels 1-2
      tutorial: { done: false, graduated: false },
      ads: { noAds: false, roundsSinceInterstitial: 0, lastInterstitialAt: 0, freeDate: '', freeUsed: {} },
      purchases: { owned: [] },
      missions: { date: '', list: [], bonusPaid: false },
    };
  }

  /** MIGRATIONS[n](data) converts a version-n save into version n+1. */
  const MIGRATIONS = {
    // v2: guided first levels. Players who already got past level 3 skip them.
    1: (data) => {
      data.tutorial = data.tutorial || {};
      data.tutorial.graduated = !!(data.stats && data.stats.bestLevel > 3);
      return data;
    },
  };

  class SaveManager {
    constructor(key) {
      this.key = key;
      this.data = defaults();
      this.timer = null;
      this.available = true;
      this.isNew = true;
    }

    load() {
      let raw = null;
      try {
        raw = window.localStorage.getItem(this.key);
      } catch (e) {
        this.available = false; // private mode / storage disabled: play without saving
      }
      if (raw) {
        try {
          let parsed = JSON.parse(raw);
          parsed = this.migrate(parsed);
          this.data = GR.util.mergeDefaults(defaults(), parsed);
          this.isNew = false;
        } catch (e) {
          console.warn('[save] corrupted save ignored', e);
          this.data = defaults();
        }
      } else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.data.settings.reducedMotion = true;
      }
      this.prune();
      return this.data;
    }

    migrate(data) {
      let v = data.saveVersion || 1;
      while (v < CURRENT_VERSION) {
        const step = MIGRATIONS[v];
        if (!step) break;
        data = step(data);
        v = data.saveVersion = v + 1;
      }
      data.saveVersion = CURRENT_VERSION;
      return data;
    }

    /** Keep per-day maps bounded (only the last 30 days matter). */
    prune() {
      const today = GR.util.dateKey();
      ['best', 'completed'].forEach((field) => {
        const map = this.data.daily[field];
        Object.keys(map).forEach((k) => {
          if (GR.util.daysBetween(k, today) > 30) delete map[k];
        });
      });
    }

    /** Schedule a write (debounced). */
    save() {
      if (this.timer) return;
      this.timer = setTimeout(() => this.flush(), 400);
    }

    flush() {
      clearTimeout(this.timer);
      this.timer = null;
      if (!this.available) return;
      try {
        this.data.updatedAt = Date.now();
        window.localStorage.setItem(this.key, JSON.stringify(this.data));
      } catch (e) {
        console.warn('[save] write failed', e);
      }
    }

    reset() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings; // keep accessibility/audio preferences
      this.flush();
    }
  }

  SaveManager.CURRENT_VERSION = CURRENT_VERSION;
  SaveManager.defaults = defaults;
  GR.SaveManager = SaveManager;
})((window.GR = window.GR || {}));
