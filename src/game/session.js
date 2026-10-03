/**
 * GameSession — the rules of one level (timer, scoring, combo, boosters,
 * TNT, mystery bags). It has no DOM, canvas or audio code: it only emits
 * events, so it can be simulated headlessly (see tools/simulate.js) and the
 * presentation layers stay decoupled.
 *
 * Events: launch, grab, deliver, miss, comboBreak, explode, blastPayout, bag,
 *         boosterStart, boosterEnd, tick, overtime, end, reel, clawBounds
 */
(function (GR) {
  'use strict';

  const C = GR.CONFIG;
  const VALUABLE = { gold: 1, gem: 1, relic: 1, critter: 1, mystery: 1 };

  /** Neutral run modifiers (perks fold their effects into this shape). */
  function defaultMods() {
    return {
      valueMult: {}, tntPayout: C.TNT.payout, rockKeepsCombo: false,
      comboStep: C.COMBO.bonusPerStep, comboMax: C.COMBO.maxStep,
      bagMult: 1, fetch: false, swingMult: 1,
    };
  }

  class GameSession {
    /**
     * @param {object} opts
     *   level      — level data from LevelGen
     *   stats      — claw stats (Economy.clawStats() or base stats)
     *   events     — EventBus for this session
     *   tutorial   — timer waits for the first launch
     *   boostersAllowed — false in the Daily Challenge
     *   infinite   — demo/attract mode: no timer
     *   mods       — run perk modifiers (see data/perks.js)
     */
    constructor(opts) {
      this.level = opts.level;
      this.mode = opts.level.mode;
      this.stats = opts.stats || GR.Economy.baseClawStats();
      this.events = opts.events || new GR.EventBus();
      this.tutorial = !!opts.tutorial;
      this.boostersAllowed = opts.boostersAllowed !== false;
      this.infinite = !!opts.infinite;
      this.mods = Object.assign(defaultMods(), opts.mods || {});
      this.fetched = false;

      // Deep-copy objects so restarting a level re-uses pristine data.
      this.objects = opts.level.objects.map((o) => Object.assign({}, o));
      this.timeTotal = opts.level.time + this.stats.extraTime;
      this.timeLeft = this.timeTotal;
      this.timerStarted = !this.tutorial;
      this.money = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.catches = 0;
      this.rocksCollected = 0;
      this.counts = {};
      this.frenzyCoins = 0;
      this.strengthBonus = 0;
      this.boosters = { magnet: 0, frenzy: 0, freeze: 0, double: 0 };
      this.pendingBlasts = [];
      this.overtime = false;
      this.finishPending = false;
      this.ended = false;
      this.endReason = null;
      this.elapsed = 0;
      this.lastTick = Math.ceil(this.timeLeft);
      this.bagRng = GR.RNG.fromString(opts.level.seed + '|' + opts.level.level + '|bags');
      this.claw = new GR.Claw(this);
    }

    get target() {
      return this.level.target;
    }

    get reachedTarget() {
      return this.money >= this.level.target;
    }

    // ---- Player actions --------------------------------------------------

    launch() {
      if (this.ended || this.overtime || this.finishPending || this.claw.busy) return false;
      if (!this.timerStarted) this.timerStarted = true;
      this.claw.launch();
      this.events.emit('launch', this.claw);
      return true;
    }

    activateBooster(id) {
      if (!this.boostersAllowed || this.ended || !GR.BOOSTERS_BY_ID[id]) return false;
      this.startBooster(id);
      return true;
    }

    startBooster(id) {
      const def = GR.BOOSTERS_BY_ID[id];
      this.boosters[id] = Math.min(def.duration * 2, this.boosters[id] + def.duration);
      this.events.emit('boosterStart', { id, def });
    }

    /** DONE button: end now, or as soon as the current catch lands. */
    finishEarly() {
      if (this.ended || !this.reachedTarget) return false;
      if (this.claw.busy) this.finishPending = true;
      else this.end('early');
      return true;
    }

    /** Rewarded-ad revive: continue the same level with extra time. */
    revive(seconds) {
      this.ended = false;
      this.endReason = null;
      this.overtime = false;
      this.finishPending = false;
      this.timeLeft = seconds;
      this.lastTick = Math.ceil(seconds);
      this.claw.reset();
    }

    // ---- Simulation -------------------------------------------------------

    update(dt) {
      if (this.ended) return;
      this.elapsed += dt;

      for (const id in this.boosters) {
        if (this.boosters[id] > 0) {
          this.boosters[id] -= dt;
          if (this.boosters[id] <= 0) {
            this.boosters[id] = 0;
            this.events.emit('boosterEnd', { id });
          }
        }
      }

      if (!this.infinite && this.timerStarted && !this.overtime && this.boosters.freeze <= 0) {
        this.timeLeft -= dt;
        const whole = Math.ceil(this.timeLeft);
        if (whole < this.lastTick) {
          this.lastTick = whole;
          if (whole <= 10 && whole > 0) this.events.emit('tick', whole);
        }
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          // Be generous: let a catch that is already on its way up finish.
          if (this.claw.grabbed) {
            this.overtime = true;
            this.events.emit('overtime');
          } else {
            this.end('time');
            return;
          }
        }
      }

      // "Good Boy" perk: Nugget digs up a bonus find early in the level.
      if (this.mods.fetch && !this.fetched && this.timerStarted && this.elapsed > 6) {
        this.fetched = true;
        const value = Math.max(50, Math.round((this.level.target * 0.08) / 10) * 10);
        this.money += value;
        this.events.emit('fetch', { value });
      }

      this.updateMovers(dt);
      if (this.boosters.magnet > 0 && this.claw.state === 'extend') this.applyMagnet(dt);
      this.claw.update(dt);
      this.updateBlasts(dt);

      if (!this.ended && !this.claw.busy && !this.infinite) {
        if (this.finishPending) this.end('early');
        else if (this.overtime) this.end('time');
        else if (!this.objects.some((o) => o.alive && o.kind !== 'tnt')) this.end('cleared');
      }
    }

    /** Crabs and rolling boulders patrol their lanes. */
    updateMovers(dt) {
      for (let i = 0; i < this.objects.length; i++) {
        const o = this.objects[i];
        if (!o.alive || !o.vx) continue;
        o.x += o.vx * dt;
        if (o.x < o.minX) {
          o.x = o.minX;
          o.vx = Math.abs(o.vx);
        } else if (o.x > o.maxX) {
          o.x = o.maxX;
          o.vx = -Math.abs(o.vx);
        }
      }
    }

    /** Magnet booster: light treasure near the claw drifts towards it. */
    applyMagnet(dt) {
      const cx = this.claw.x;
      const cy = this.claw.y;
      for (let i = 0; i < this.objects.length; i++) {
        const o = this.objects[i];
        if (!o.alive || o.weight > 1.6 || !(o.kind === 'gold' || o.kind === 'gem' || o.kind === 'critter')) continue;
        const dx = cx - o.x;
        const dy = cy - o.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 135 && d > 1) {
          const pull = Math.min(d, 520 * dt);
          o.x += (dx / d) * pull;
          o.y += (dy / d) * pull;
          o.magnetized = 0.25;
        }
      }
    }

    findHit(x, y, radius) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < this.objects.length; i++) {
        const o = this.objects[i];
        if (!o.alive) continue;
        const dx = o.x - x;
        const dy = o.y - y;
        const reach = o.r * 0.92 + radius;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach * reach && d2 < bestD) {
          best = o;
          bestD = d2;
        }
      }
      return best;
    }

    grab(obj) {
      if (obj.kind === 'tnt') {
        this.explode(obj);
        this.claw.bounceBack();
        return;
      }
      obj.alive = false;
      obj.held = true;
      obj.doubled = this.boosters.double > 0;
      obj.frenzied = this.boosters.frenzy > 0;
      const heavy = obj.weight * (1 - this.stats.weightReduction) >= 4.5;
      this.claw.clamp(obj, heavy);
      this.events.emit('grab', { obj, heavy });
    }

    explode(tnt) {
      tnt.alive = false;
      const R = C.TNT.radius;
      this.events.emit('explode', { x: tnt.x, y: tnt.y, radius: R, obj: tnt });
      for (let i = 0; i < this.objects.length; i++) {
        const o = this.objects[i];
        if (!o.alive) continue;
        const dx = o.x - tnt.x;
        const dy = o.y - tnt.y;
        if (Math.sqrt(dx * dx + dy * dy) - o.r > R) continue;
        if (o.kind === 'tnt') {
          o.alive = false;
          this.pendingBlasts.push({ obj: o, t: C.TNT.chainDelay });
          continue;
        }
        o.alive = false;
        let payout = 0;
        if (VALUABLE[o.kind] && o.kind !== 'mystery') {
          const kindMult = this.mods.valueMult[o.kind] || 1;
          payout = Math.round((o.value * kindMult * this.mods.tntPayout * (this.boosters.double > 0 ? 2 : 1)) / 5) * 5;
          this.money += payout;
        }
        this.events.emit('blastPayout', { obj: o, value: payout });
      }
    }

    updateBlasts(dt) {
      for (let i = this.pendingBlasts.length - 1; i >= 0; i--) {
        const b = this.pendingBlasts[i];
        b.t -= dt;
        if (b.t <= 0) {
          this.pendingBlasts.splice(i, 1);
          b.obj.alive = true; // re-enable so explode() can process it
          this.explode(b.obj);
        }
      }
    }

    onClawReturned(obj, debris) {
      if (obj) this.deliver(obj);
      else if (!debris) this.miss();
    }

    miss() {
      if (this.combo >= 2) this.events.emit('comboBreak', { combo: this.combo });
      this.combo = 0;
      this.events.emit('miss');
    }

    deliver(obj) {
      obj.held = false;
      this.catches += 1;
      this.counts[obj.type] = (this.counts[obj.type] || 0) + 1;

      let base = obj.value;
      let bag = null;
      if (obj.kind === 'mystery') {
        bag = this.openBag(obj);
        base = (bag.money || 0) * this.mods.bagMult;
      } else {
        base *= this.mods.valueMult[obj.kind] || 1;
      }

      if (obj.kind === 'rock') {
        this.rocksCollected += 1;
        if (!this.mods.rockKeepsCombo) {
          if (this.combo >= 2) this.events.emit('comboBreak', { combo: this.combo });
          this.combo = 0;
        }
      } else if (VALUABLE[obj.kind] && base > 0) {
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
      }

      const step = Math.min(this.mods.comboMax, this.combo);
      const comboMult = obj.kind !== 'rock' && step >= 2 ? 1 + this.mods.comboStep * (step - 1) : 1;
      const doubled = obj.doubled ? 2 : 1;
      const value = Math.round(base * doubled * comboMult);
      this.money += value;
      if (obj.frenzied) this.frenzyCoins += value * C.ECONOMY.moneyToCoins * 2;

      this.events.emit('deliver', {
        obj, value, base, combo: this.combo, comboMult, doubled: doubled > 1, frenzied: obj.frenzied, bag,
      });
    }

    openBag(obj) {
      const table = {};
      GR.MYSTERY_OUTCOMES.forEach((o) => (table[o.id] = o.weight));
      const id = this.bagRng.weighted(table);
      const def = GR.MYSTERY_OUTCOMES.find((o) => o.id === id);
      const out = { id, money: 0 };
      if (def.money) {
        out.money = Math.round(this.bagRng.range(def.money[0], def.money[1]) / 10) * 10;
      } else if (id === 'booster') {
        out.booster = this.bagRng.pick(GR.BOOSTERS).id;
        this.startBooster(out.booster);
      } else if (id === 'time') {
        out.seconds = def.seconds;
        if (!this.overtime) this.timeLeft += def.seconds;
      } else if (id === 'strength') {
        this.strengthBonus = 0.4;
      }
      this.events.emit('bag', { obj, outcome: out });
      return out;
    }

    end(reason) {
      if (this.ended) return;
      this.ended = true;
      this.endReason = reason;
      const L = this.level;
      const stars = C.STARS.reduce((n, m) => (this.money >= L.target * m ? n + 1 : n), 0);
      this.result = {
        mode: this.mode,
        level: L.level,
        money: this.money,
        target: L.target,
        success: this.money >= L.target,
        stars,
        timeLeft: Math.max(0, this.timeLeft),
        reason,
        bestCombo: this.bestCombo,
        rocksCollected: this.rocksCollected,
        catches: this.catches,
        counts: Object.assign({}, this.counts),
        frenzyCoins: Math.round(this.frenzyCoins),
      };
      this.events.emit('end', this.result);
    }
  }

  GR.GameSession = GameSession;
})((window.GR = window.GR || {}));
