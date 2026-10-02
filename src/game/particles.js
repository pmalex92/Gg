/**
 * Pooled particles + floating text. All particles live in a fixed-size array
 * allocated once, so long sessions never churn the garbage collector.
 * Reduced-motion mode cuts spawn counts and disables screen shake/flashes.
 */
(function (GR) {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_PARTICLES = 360;
  const MAX_TEXTS = 24;

  class Particles {
    constructor() {
      this.pool = [];
      for (let i = 0; i < MAX_PARTICLES; i++) this.pool.push({ active: false });
      this.texts = [];
      for (let i = 0; i < MAX_TEXTS; i++) this.texts.push({ active: false });
      this.reduced = false;
      this.coinTarget = { x: 640, y: 40 };
      this.onCoinArrive = null;
      this.shake = 0;
      this.flash = 0;
    }

    clear() {
      this.pool.forEach((p) => (p.active = false));
      this.texts.forEach((t) => (t.active = false));
      this.shake = 0;
      this.flash = 0;
    }

    count(n) {
      return this.reduced ? Math.max(1, Math.round(n * 0.3)) : n;
    }

    spawn(type, x, y, opts) {
      let p = null;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (!this.pool[i].active) {
          p = this.pool[i];
          break;
        }
      }
      if (!p) return null;
      p.active = true;
      p.type = type;
      p.x = x;
      p.y = y;
      p.vx = opts.vx || 0;
      p.vy = opts.vy || 0;
      p.g = opts.g || 0;
      p.life = p.max = opts.life || 1;
      p.size = opts.size || 4;
      p.color = opts.color || '#fff';
      p.rot = opts.rot || 0;
      p.vr = opts.vr || 0;
      p.drag = opts.drag || 0;
      p.delay = opts.delay || 0;
      p.home = !!opts.home;
      return p;
    }

    burst(type, x, y, n, opts) {
      n = this.count(n);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const sp = (opts.speed || 200) * (0.4 + Math.random() * 0.8);
        this.spawn(type, x, y, {
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (opts.lift || 0),
          g: opts.g,
          life: (opts.life || 0.8) * (0.7 + Math.random() * 0.6),
          size: (opts.size || 4) * (0.6 + Math.random() * 0.8),
          color: Array.isArray(opts.color) ? opts.color[i % opts.color.length] : opts.color,
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 12,
          drag: opts.drag || 0,
        });
      }
    }

    /** Coins fly out, then home in on the money counter. */
    coins(x, y, n) {
      n = this.count(Math.min(14, n));
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 180 + Math.random() * 220;
        this.spawn('coin', x, y, {
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1.6,
          size: 7 + Math.random() * 3,
          rot: Math.random() * TAU,
          vr: 8 + Math.random() * 6,
          delay: 0.22 + i * 0.03,
          home: true,
        });
      }
    }

    text(str, x, y, opts) {
      let t = null;
      for (let i = 0; i < MAX_TEXTS; i++) {
        if (!this.texts[i].active) {
          t = this.texts[i];
          break;
        }
      }
      if (!t) t = this.texts[0];
      t.active = true;
      t.str = str;
      t.x = x;
      t.y = y;
      t.vy = opts && opts.vy !== undefined ? opts.vy : -70;
      t.life = t.max = (opts && opts.life) || 1.1;
      t.size = (opts && opts.size) || 34;
      t.color = (opts && opts.color) || '#ffd23f';
      t.pop = !this.reduced;
    }

    addShake(amount) {
      if (!this.reduced) this.shake = Math.min(18, this.shake + amount);
    }

    addFlash(amount) {
      if (!this.reduced) this.flash = Math.min(0.7, this.flash + amount);
    }

    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 40);
      this.flash = Math.max(0, this.flash - dt * 2.2);
      const tx = this.coinTarget.x;
      const ty = this.coinTarget.y;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = this.pool[i];
        if (!p.active) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.active = false;
          continue;
        }
        if (p.home) {
          if (p.delay > 0) {
            p.delay -= dt;
            p.vx *= 1 - Math.min(1, dt * 3);
            p.vy *= 1 - Math.min(1, dt * 3);
          } else {
            const dx = tx - p.x;
            const dy = ty - p.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 26) {
              p.active = false;
              if (this.onCoinArrive) this.onCoinArrive();
              continue;
            }
            const sp = 900 + (1.6 - p.life) * 900;
            p.vx += ((dx / d) * sp - p.vx) * Math.min(1, dt * 7);
            p.vy += ((dy / d) * sp - p.vy) * Math.min(1, dt * 7);
            p.life = Math.max(p.life, 0.2);
          }
        }
        if (p.drag) {
          p.vx *= 1 - Math.min(1, p.drag * dt);
          p.vy *= 1 - Math.min(1, p.drag * dt);
        }
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      for (let i = 0; i < MAX_TEXTS; i++) {
        const t = this.texts[i];
        if (!t.active) continue;
        t.life -= dt;
        if (t.life <= 0) t.active = false;
        t.y += t.vy * dt;
        t.vy *= 1 - Math.min(1, dt * 1.5);
      }
    }

    draw(ctx) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = this.pool[i];
        if (!p.active) continue;
        const k = p.life / p.max;
        switch (p.type) {
          case 'coin': {
            const w = Math.abs(Math.cos(p.rot)) * p.size + 1.5;
            ctx.fillStyle = '#b97a0c';
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, w, p.size, 0, 0, TAU);
            ctx.fill();
            ctx.fillStyle = '#ffd23f';
            ctx.beginPath();
            ctx.ellipse(p.x - 0.8, p.y - 0.8, Math.max(0.5, w - 2), p.size - 2, 0, 0, TAU);
            ctx.fill();
            break;
          }
          case 'spark': {
            ctx.globalAlpha = k;
            GR.Sprites.star(ctx, p.x, p.y, p.size * (0.5 + k * 0.6), p.color);
            ctx.globalAlpha = 1;
            break;
          }
          case 'debris': {
            ctx.globalAlpha = Math.min(1, k * 2);
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
            ctx.restore();
            ctx.globalAlpha = 1;
            break;
          }
          case 'smoke': {
            ctx.globalAlpha = k * 0.5;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1.8 - k), 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            break;
          }
          case 'ring': {
            ctx.globalAlpha = k * 0.8;
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 6 * k + 1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (1 - k) + 10, 0, TAU);
            ctx.stroke();
            ctx.globalAlpha = 1;
            break;
          }
          default: {
            // dust / snow / ember: soft dots
            ctx.globalAlpha = k;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    drawTexts(ctx, font) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (let i = 0; i < MAX_TEXTS; i++) {
        const t = this.texts[i];
        if (!t.active) continue;
        const age = t.max - t.life;
        const pop = t.pop ? GR.util.easeOutBack(Math.min(1, age / 0.25)) : 1;
        const size = Math.max(1, t.size * pop);
        ctx.globalAlpha = Math.min(1, t.life / 0.3);
        ctx.font = size.toFixed(1) + 'px ' + font;
        ctx.lineWidth = size * 0.2;
        ctx.strokeStyle = 'rgba(20,10,0,0.85)';
        ctx.strokeText(t.str, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    }
  }

  GR.Particles = Particles;
})((window.GR = window.GR || {}));
