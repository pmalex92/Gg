/**
 * The claw: swing -> extend -> (grab) -> retract -> swing.
 *
 * Movement is along a straight cable from the pivot at a frozen angle. The
 * swing is a sine wave (natural ease at both ends), launches accelerate from
 * a standing start, and the reel speed depends on the grabbed object's
 * weight, the Claw Speed / Claw Power upgrades and the Frenzy booster.
 */
(function (GR) {
  'use strict';

  const CC = GR.CONFIG.CLAW;
  const P = GR.CONFIG.PIVOT;
  const B = GR.CONFIG.BOUNDS;

  class Claw {
    constructor(session) {
      this.session = session;
      this.phase = 0.3;
      this.angle = CC.maxAngle * Math.sin(this.phase);
      this.length = CC.restLength;
      this.state = 'swing'; // swing | extend | grab | retract
      this.speed = 0;
      this.grabbed = null;
      this.debris = false; // returning with TNT scraps
      this.grip = 0; // 0 = open, 1 = clamped (render only)
      this.pause = 0;
      this.reelAccum = 0;
      this.time = 0;
      this.x = P.x;
      this.y = P.y + CC.restLength;
      this.updateTip();
    }

    get tipRadius() {
      return CC.tipRadius + this.session.stats.grabBonus;
    }

    get busy() {
      return this.state !== 'swing';
    }

    launch() {
      if (this.state !== 'swing') return false;
      this.state = 'extend';
      this.speed = CC.extendStartSpeed;
      this.debris = false;
      return true;
    }

    reset() {
      this.state = 'swing';
      this.length = CC.restLength;
      this.grabbed = null;
      this.debris = false;
      this.speed = 0;
      this.updateTip();
    }

    updateTip() {
      this.dx = Math.sin(this.angle);
      this.dy = Math.cos(this.angle);
      this.x = P.x + this.dx * this.length;
      this.y = P.y + this.dy * this.length;
    }

    retractTargetSpeed() {
      const s = this.session;
      const frenzy = s.boosters.frenzy > 0 ? 1.7 : 1;
      if (!this.grabbed) return CC.emptyRetract * s.stats.retractMult * frenzy;
      const w = this.grabbed.weight * (1 - s.stats.weightReduction) * (1 - s.strengthBonus);
      return (CC.retractBase * s.stats.retractMult * frenzy) / (1 + w * CC.weightFactor);
    }

    update(dt) {
      const s = this.session;
      this.time += dt;
      const frenzy = s.boosters.frenzy > 0;

      if (this.state === 'swing') {
        this.phase += s.level.swingSpeed * s.mods.swingMult * (frenzy ? 1.35 : 1) * dt;
        this.angle = CC.maxAngle * Math.sin(this.phase);
        this.grip += (0.15 - this.grip) * GR.util.damp(10, dt);
      } else if (this.state === 'extend') {
        const max = CC.extendSpeed * (frenzy ? 1.6 : 1);
        this.speed = Math.min(max, this.speed + CC.extendAccel * dt);
        this.grip += (0 - this.grip) * GR.util.damp(18, dt);
        // Sub-step so fast claws never tunnel through small gems.
        let travel = this.speed * dt;
        while (travel > 0 && this.state === 'extend') {
          const step = Math.min(8, travel);
          travel -= step;
          this.length += step;
          this.updateTip();
          if (this.x < B.x0 || this.x > B.x1 || this.y > B.y1) {
            this.state = 'retract';
            this.speed *= 0.2;
            s.events.emit('clawBounds', this);
            break;
          }
          const hit = s.findHit(this.x, this.y, this.tipRadius);
          if (hit) {
            s.grab(hit);
            break;
          }
        }
      } else if (this.state === 'grab') {
        this.pause -= dt;
        this.grip += (1 - this.grip) * GR.util.damp(30, dt);
        if (this.pause <= 0) {
          this.state = 'retract';
          this.speed = 0;
        }
      } else if (this.state === 'retract') {
        const target = this.retractTargetSpeed();
        this.speed += (target - this.speed) * GR.util.damp(this.grabbed ? 7 : 14, dt);
        const move = this.speed * dt;
        this.length -= move;
        this.grip += ((this.grabbed || this.debris ? 1 : 0.35) - this.grip) * GR.util.damp(14, dt);
        this.reelAccum += move;
        if (this.reelAccum > 70) {
          this.reelAccum = 0;
          s.events.emit('reel', this);
        }
        if (this.length <= CC.restLength) {
          this.length = CC.restLength;
          this.state = 'swing';
          const obj = this.grabbed;
          const debris = this.debris;
          this.grabbed = null;
          this.debris = false;
          this.updateTip();
          s.onClawReturned(obj, debris);
          return;
        }
      }
      this.updateTip();
      if (this.grabbed) {
        // Carried objects hang just below the claw jaws.
        const off = this.grabbed.r * 0.78 + 8;
        this.grabbed.x = this.x + this.dx * off;
        this.grabbed.y = this.y + this.dy * off;
      }
    }

    /** Called by the session when something is caught. */
    clamp(obj, heavy) {
      this.grabbed = obj;
      this.state = 'grab';
      this.pause = heavy ? CC.grabPause * 1.8 : CC.grabPause;
    }

    /** TNT: retract empty-handed (with scraps) at full speed. */
    bounceBack() {
      this.grabbed = null;
      this.debris = true;
      this.state = 'retract';
      this.speed = 0;
    }
  }

  GR.Claw = Claw;
})((window.GR = window.GR || {}));
