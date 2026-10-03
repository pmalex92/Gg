/**
 * Autopilot: a simple "decent player" used for the animated home-screen demo
 * and by tools/simulate.js to balance level targets.
 *
 * Each frame it casts the current claw ray, finds what it would hit first and
 * launches when that catch is worth enough money per second of reel time. Its
 * standards drop the longer it waits, like an impatient human.
 */
(function (GR) {
  'use strict';

  const CC = GR.CONFIG.CLAW;
  const P = GR.CONFIG.PIVOT;

  class Autopilot {
    constructor(session, opts) {
      this.session = session;
      this.skill = (opts && opts.skill) || 0.75; // 0..1, how picky it is
      this.reaction = (opts && opts.reaction) || 0; // seconds of launch delay
      this.aimNoise = (opts && opts.aimNoise) || 0; // timing error (s), human-like misses
      this.rng = (opts && opts.rng) || new GR.RNG(1234);
      this.wait = 0;
      this.pending = -1;
    }

    /** First object hit along a ray at `angle`, with the distance to it. */
    castRay(angle) {
      const dx = Math.sin(angle);
      const dy = Math.cos(angle);
      const tip = this.session.claw.tipRadius;
      let best = null;
      let bestT = Infinity;
      const objs = this.session.objects;
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (!o.alive) continue;
        const cx = o.x - P.x;
        const cy = o.y - P.y;
        const t = cx * dx + cy * dy;
        if (t <= 0) continue;
        const perp2 = cx * cx + cy * cy - t * t;
        const reach = o.r * 0.92 + tip;
        if (perp2 > reach * reach) continue;
        const hitT = t - Math.sqrt(reach * reach - perp2);
        if (hitT < bestT) {
          bestT = hitT;
          best = o;
        }
      }
      return best ? { obj: best, dist: bestT } : null;
    }

    estimateValue(o) {
      if (o.kind === 'tnt') {
        let v = 0;
        this.session.objects.forEach((p) => {
          if (!p.alive || p === o || p.kind === 'rock' || p.kind === 'tnt') return;
          const d = Math.hypot(p.x - o.x, p.y - o.y) - p.r;
          if (d < GR.CONFIG.TNT.radius) v += p.value * GR.CONFIG.TNT.payout;
        });
        return v;
      }
      return o.kind === 'mystery' ? 220 : o.value;
    }

    /** Money per second for catching `o` at distance `dist`. */
    score(o, dist) {
      const s = this.session;
      const stats = s.stats;
      const len = Math.max(0, dist - CC.restLength);
      const out = len / CC.extendSpeed + 0.1;
      let back;
      if (o.kind === 'tnt') back = len / (CC.emptyRetract * stats.retractMult);
      else {
        const w = o.weight * (1 - stats.weightReduction) * (1 - s.strengthBonus);
        back = len / ((CC.retractBase * stats.retractMult) / (1 + w * CC.weightFactor)) + CC.grabPause;
      }
      return this.estimateValue(o) / (out + back);
    }

    bestPossible() {
      let best = 0;
      this.session.objects.forEach((o) => {
        if (!o.alive) return;
        const d = Math.hypot(o.x - P.x, o.y - P.y);
        best = Math.max(best, this.score(o, d));
      });
      return best;
    }

    update(dt) {
      const s = this.session;
      if (s.ended || s.claw.busy) {
        this.wait = 0;
        return;
      }
      if (this.pending >= 0) {
        this.pending -= dt;
        if (this.pending <= 0) {
          this.pending = -1;
          s.launch();
        }
        return;
      }
      this.wait += dt;
      // Aim where the claw will be once our reaction delay has passed.
      const lead = s.claw.phase + s.level.swingSpeed * s.mods.swingMult * this.reaction;
      const hit = this.castRay(CC.maxAngle * Math.sin(lead));
      if (!hit) return;
      const sc = this.score(hit.obj, hit.dist);
      const bar = this.bestPossible() * this.skill * Math.exp(-this.wait / 2.2);
      // Never knowingly grab a rock unless desperate.
      const rockPenalty = hit.obj.kind === 'rock' && this.wait < 4 ? 0 : 1;
      if (sc * rockPenalty >= bar && sc > 0) {
        // Box-Muller gaussian timing error.
        const g = Math.sqrt(-2 * Math.log(1 - this.rng.next())) * Math.cos(2 * Math.PI * this.rng.next());
        const delay = Math.max(0, this.reaction + g * this.aimNoise);
        if (delay > 0) this.pending = delay;
        else s.launch();
      }
    }
  }

  GR.Autopilot = Autopilot;
})((window.GR = window.GR || {}));
