/**
 * Checks achievement progress against the save and pays out rewards once.
 * Call evaluate() after anything that changes lifetime stats.
 */
(function (GR) {
  'use strict';

  class Achievements {
    constructor(saveManager, economy, bus) {
      this.saveManager = saveManager;
      this.economy = economy;
      this.bus = bus;
    }

    isUnlocked(id) {
      return !!this.saveManager.data.achievements[id];
    }

    progressOf(def) {
      const v = Number(def.progress(this.saveManager.data)) || 0;
      return Math.min(def.goal, v);
    }

    evaluate() {
      const data = this.saveManager.data;
      const unlocked = [];
      GR.ACHIEVEMENTS.forEach((def) => {
        if (data.achievements[def.id]) return;
        if (this.progressOf(def) >= def.goal) {
          data.achievements[def.id] = Date.now();
          unlocked.push(def);
        }
      });
      // Rewards are granted after the loop: some rewards change stats that
      // other achievements read (e.g. total coins earned).
      unlocked.forEach((def) => {
        this.economy.grant(def.reward, 'achievement');
        this.bus.emit('achievement', def);
      });
      if (unlocked.length) {
        this.saveManager.save();
        return unlocked.concat(this.evaluate());
      }
      return unlocked;
    }

    count() {
      return GR.ACHIEVEMENTS.filter((d) => this.isUnlocked(d.id)).length;
    }
  }

  GR.Achievements = Achievements;
})((window.GR = window.GR || {}));
