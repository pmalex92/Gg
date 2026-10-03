/**
 * Feedback director: turns gameplay events into particles, floating text,
 * screen shake, sound and haptics. This is where most of the "game feel"
 * lives — the session itself never knows any of this exists.
 */
(function (GR) {
  'use strict';

  const fmt = GR.util.formatMoney;
  const BOOSTER_LABEL = { magnet: 'MAGNET!', frenzy: 'FRENZY!', freeze: 'TIME FREEZE!', double: 'DOUBLE VALUE!' };
  const BAG_LABEL = { time: '+8 SECONDS', strength: 'STRENGTH UP!' };

  class FX {
    /**
     * @param {Particles} particles
     * @param {AudioManager} audio
     * @param {object} hooks { onCombo(n), onCoin(), vibrate(ms), isMuted() }
     */
    constructor(particles, audio, hooks) {
      this.p = particles;
      this.audio = audio;
      this.hooks = hooks || {};
      this.offs = [];
      this.quiet = false; // demo mode: visuals only
      this.dustTimer = 0;
      this.theme = GR.MINE_SKINS_BY_ID.classic;
      this.mascot = null; // Nugget, set by the app
    }

    pup(type) {
      if (this.mascot) this.mascot.react(type);
    }

    sound(name, opts) {
      if (!this.quiet) this.audio.play(name, opts);
    }

    vibrate(ms) {
      if (!this.quiet && this.hooks.vibrate) this.hooks.vibrate(ms);
    }

    attach(session, opts) {
      this.detach();
      this.session = session;
      this.quiet = !!(opts && opts.quiet);
      const ev = session.events;
      const on = (name, fn) => this.offs.push(ev.on(name, fn.bind(this)));
      on('launch', this.onLaunch);
      on('grab', this.onGrab);
      on('reel', () => this.sound('reel'));
      on('deliver', this.onDeliver);
      on('miss', () => this.sound('miss'));
      on('comboBreak', this.onComboBreak);
      on('explode', this.onExplode);
      on('blastPayout', this.onBlastPayout);
      on('bag', this.onBag);
      on('boosterStart', this.onBoosterStart);
      on('tick', (n) => this.sound('tick', { last: n <= 3 }));
      on('overtime', () => this.p.text('LAST CATCH!', 360, 330, { size: 44, color: '#ffffff', vy: -20, life: 1.4 }));
    }

    detach() {
      this.offs.forEach((off) => off());
      this.offs = [];
    }

    update(dt) {
      // Ambient dust motes drifting through the lantern light.
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = this.p.reduced ? 1.2 : 0.35;
        this.p.spawn('dust', Math.random() * 720, 300 + Math.random() * 850, {
          vx: (Math.random() - 0.5) * 12, vy: -6 - Math.random() * 8, life: 4, size: 1.6 + Math.random() * 1.6,
          color: this.theme.dust,
        });
      }
    }

    onLaunch(claw) {
      this.sound('launch');
      this.p.burst('dust', claw.x, claw.y, 4, { speed: 60, life: 0.4, size: 3, color: this.theme.dust });
    }

    onGrab(e) {
      const o = e.obj;
      this.sound(e.heavy ? 'grabHeavy' : 'grab');
      this.p.burst('dust', o.x, o.y, e.heavy ? 14 : 8, { speed: e.heavy ? 160 : 110, life: 0.6, size: 3.5, color: this.theme.dust, g: 200 });
      if (o.kind === 'rock') this.p.burst('debris', o.x, o.y, 5, { speed: 120, life: 0.6, size: 6, color: '#6b6f77', g: 600 });
      if (e.heavy) {
        this.p.addShake(5);
        this.vibrate(25);
      } else this.vibrate(10);
    }

    onDeliver(e) {
      const o = e.obj;
      const claw = this.session.claw;
      const x = claw.x;
      const y = claw.y - 20;
      const valuable = e.value > 0 && o.kind !== 'rock';
      if (o.kind === 'rock') this.pup('meh');
      else if (valuable) this.pup(e.value >= 450 || o.kind === 'gem' || o.kind === 'relic' ? 'excited' : 'happy');

      if (o.kind === 'rock') {
        this.sound('rock');
        this.p.text('+' + fmt(e.value), x, y, { size: 30, color: '#b9bec6' });
        this.p.burst('debris', x, y + 30, 6, { speed: 140, life: 0.6, size: 6, color: '#7b7f86', g: 700 });
      } else if (valuable) {
        const big = e.value >= 450;
        const size = Math.min(60, 34 + e.value / 40);
        let label = '+' + fmt(e.value);
        if (e.doubled) label += ' ×2';
        this.p.text(label, x, y, { size, color: big ? '#ffffff' : '#ffd23f', life: 1.2 });
        this.p.coins(x, y + 20, Math.round(GR.util.clamp(e.value / 40, 3, 14)));
        if (o.kind === 'gem' || (o.kind === 'critter' && o.gem) || o.kind === 'relic') {
          this.sound('diamond', { pitch: o.type === 'red_gem' ? 0.89 : 1 });
          this.p.burst('spark', x, y + 20, 16, { speed: 260, life: 0.7, size: 9, color: ['#ffffff', '#bff4ff', '#ffe08a'], drag: 2 });
        } else {
          this.sound('coin', { pitch: 1 + Math.min(0.5, (e.combo - 1) * 0.06) });
          this.p.burst('spark', x, y + 20, 6, { speed: 160, life: 0.5, size: 7, color: '#ffe08a', drag: 2 });
        }
        if (big) {
          this.p.addShake(3);
          this.vibrate(20);
        }
      } else if (o.kind === 'mystery') {
        this.sound('bag');
      }

      if (e.combo >= 2 && valuable) {
        const pct = Math.round((e.comboMult - 1) * 100);
        this.p.text('COMBO ×' + e.combo + (pct ? '  +' + pct + '%' : ''), x, y + 44, {
          size: 26, color: '#ff9f43', vy: -40, life: 1.1,
        });
        this.sound('combo', { combo: e.combo });
      }
      if (this.hooks.onDeliver) this.hooks.onDeliver(e);
    }

    onComboBreak(e) {
      this.pup('meh');
      const claw = this.session.claw;
      this.p.text('COMBO LOST', claw.x, claw.y + 10, { size: 24, color: '#ff6b5f', vy: -30, life: 0.9 });
      this.sound('comboBreak');
      if (this.hooks.onComboBreak) this.hooks.onComboBreak(e);
    }

    onExplode(e) {
      this.pup('scared');
      this.sound('explosion');
      this.p.spawn('ring', e.x, e.y, { size: e.radius, life: 0.45, color: '#ffd23f' });
      this.p.burst('smoke', e.x, e.y, 12, { speed: 90, life: 1.1, size: 22, color: '#3a3330', drag: 2, lift: 30 });
      this.p.burst('spark', e.x, e.y, 22, { speed: 380, life: 0.6, size: 10, color: ['#ffd23f', '#ff7a2a', '#ffffff'], drag: 3 });
      this.p.burst('debris', e.x, e.y, 16, { speed: 320, life: 0.9, size: 7, color: ['#5a3d24', '#6b6f77', '#3a2918'], g: 800 });
      this.p.addShake(16);
      this.p.addFlash(0.55);
      this.p.text('BOOM!', e.x, e.y - 80, { size: 48, color: '#ff7a2a', vy: -50, life: 0.9 });
      this.vibrate(60);
    }

    onBlastPayout(e) {
      const o = e.obj;
      if (e.value > 0) {
        this.p.text('+' + fmt(e.value), o.x, o.y, { size: 28, color: '#ffb347', life: 1 });
        this.p.coins(o.x, o.y, Math.round(GR.util.clamp(e.value / 50, 2, 8)));
      } else {
        this.p.burst('debris', o.x, o.y, 8, { speed: 200, life: 0.8, size: 7, color: '#6b6f77', g: 700 });
      }
    }

    onBag(e) {
      const claw = this.session.claw;
      const out = e.outcome;
      let label = null;
      if (out.id === 'jackpot') {
        label = 'JACKPOT!';
        this.p.burst('spark', claw.x, claw.y, 24, { speed: 320, life: 0.9, size: 10, color: ['#ffd23f', '#ffffff'], drag: 2 });
        this.p.addShake(6);
      } else if (out.booster) label = BOOSTER_LABEL[out.booster];
      else label = BAG_LABEL[out.id] || null;
      if (label) this.p.text(label, claw.x, claw.y - 70, { size: 34, color: '#ffffff', vy: -40, life: 1.4 });
    }

    onBoosterStart(e) {
      this.pup('excited');
      this.sound(e.id === 'freeze' ? 'freeze' : 'booster');
      this.p.text(BOOSTER_LABEL[e.id], 360, 700, { size: 48, color: e.def.color, vy: -30, life: 1.2 });
      if (e.id === 'freeze') {
        this.p.burst('dust', 360, 700, 30, { speed: 300, life: 1.2, size: 4, color: '#dff6ff', drag: 1.5 });
      }
    }

    /** Big centred message (tutorial "GOOD CATCH!", etc.). */
    banner(text, color) {
      if (text === 'GOOD CATCH!') this.pup('excited');
      this.p.text(text, 360, 480, { size: 64, color: color || '#ffd23f', vy: -25, life: 1.6 });
    }
  }

  GR.FX = FX;
})((window.GR = window.GR || {}));
