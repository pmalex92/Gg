/**
 * In-game HUD (DOM overlay on the canvas). Elements are created once; each
 * frame only touches text/styles that actually changed, so the HUD costs
 * almost nothing during play.
 *
 * Layout: level (top-left), timer (top-centre), money + target (top-right),
 * combo pill, booster bar along the bottom.
 */
(function (GR) {
  'use strict';

  const fmt = GR.util.formatMoney;

  class HUD {
    constructor(root, app) {
      this.root = root;
      this.app = app;
      root.innerHTML =
        '<div class="hud-tint" id="hud-tint"></div>' +
        '<div class="hud-top">' +
        '  <div class="hud-left">' +
        '    <button class="hud-btn" data-action="pause" aria-label="Pause (Esc)">' + GR.icon('pause') + '</button>' +
        '    <div class="hud-level"><small id="hud-mode">LEVEL</small><b id="hud-level">1</b></div>' +
        '  </div>' +
        '  <div class="hud-timer" id="hud-timer" role="timer">' + GR.icon('clock') + '<b id="hud-time">1:00</b></div>' +
        '  <div class="hud-money">' +
        '    <b id="hud-money">$0</b>' +
        '    <span class="hud-goal" id="hud-goal">of $500</span>' +
        '    <div class="hud-bar"><i id="hud-progress"></i></div>' +
        '  </div>' +
        '</div>' +
        '<div class="hud-perks" id="hud-perks"></div>' +
        '<div class="hud-combo" id="hud-combo" aria-live="polite"></div>' +
        '<div class="hud-banner" id="hud-banner"><b></b><span></span></div>' +
        '<div class="hud-hint" id="hud-hint" aria-live="polite"></div>' +
        '<button class="hud-done" id="hud-done" data-action="done">' + GR.icon('check') + 'DONE</button>' +
        '<div class="hud-boosters" id="hud-boosters">' +
        GR.BOOSTERS.map(
          (b) =>
            '<button class="booster" data-action="booster" data-id="' + b.id + '" style="--c:' + b.color + '" aria-label="' + b.name + ' booster (key ' + b.key + ')">' +
            GR.icon(b.icon) + '<span class="count"></span><span class="key">' + b.key + '</span></button>'
        ).join('') +
        '</div>' +
        '<div class="hud-note" id="hud-note">STANDARD CLAW · NO BOOSTERS</div>';

      const $ = (id) => root.querySelector('#' + id);
      this.el = {
        mode: $('hud-mode'), level: $('hud-level'), timer: $('hud-timer'), time: $('hud-time'),
        money: $('hud-money'), goal: $('hud-goal'), progress: $('hud-progress'), combo: $('hud-combo'),
        banner: $('hud-banner'), hint: $('hud-hint'), done: $('hud-done'), boosters: $('hud-boosters'), note: $('hud-note'),
        tint: $('hud-tint'),
        perks: $('hud-perks'),
      };
      this.boosterEls = {};
      GR.dom.$$('.booster', root).forEach((b) => (this.boosterEls[b.dataset.id] = { btn: b, count: b.querySelector('.count') }));
      this.cache = {};
      this.displayMoney = 0;
    }

    bind(session, label, perks) {
      this.session = session;
      this.displayMoney = session.money;
      this.cache = {};
      const daily = session.mode === 'daily';
      const training = session.mode === 'training';
      this.el.mode.textContent = daily ? 'DAILY' : training ? 'TRAINING' : 'LEVEL';
      this.el.level.textContent = daily ? GR.util.prettyDate(GR.util.dateKey()) : training ? 'GO!' : String(session.level.level);
      this.el.goal.textContent = 'of ' + fmt(session.target);
      this.el.boosters.hidden = !session.boostersAllowed;
      this.el.note.hidden = !daily;
      this.el.combo.classList.remove('on');
      this.el.perks.innerHTML = (perks || [])
        .map((id) => {
          const p = GR.PERKS_BY_ID[id];
          return '<span style="--c:' + p.color + '" title="' + GR.util.escapeHtml(p.name + ': ' + p.desc) + '">' + GR.icon(p.icon) + '</span>';
        })
        .join('');
      if (label) this.banner(label.title, label.sub, label.long);
    }

    set(key, value, fn) {
      if (this.cache[key] === value) return;
      this.cache[key] = value;
      fn(value);
    }

    update(dt) {
      const s = this.session;
      if (!s) return;
      const el = this.el;

      // Money counts up towards the real value.
      this.displayMoney += (s.money - this.displayMoney) * GR.util.damp(9, dt);
      if (Math.abs(s.money - this.displayMoney) < 1) this.displayMoney = s.money;
      this.set('money', Math.round(this.displayMoney), (v) => (el.money.textContent = fmt(v)));
      const pct = Math.min(1, s.money / s.target);
      this.set('pct', Math.round(pct * 100), (v) => (el.progress.style.transform = 'scaleX(' + v / 100 + ')'));
      this.set('reached', s.reachedTarget, (v) => {
        this.root.classList.toggle('reached', v);
        el.goal.innerHTML = v ? GR.icon('check') + ' TARGET ' + fmt(s.target) : 'of ' + fmt(s.target);
      });

      // Timer
      this.set('time', Math.ceil(s.timeLeft), (v) => (el.time.textContent = GR.util.formatTime(v)));
      this.set('warn', s.timeLeft <= 10 && !s.ended, (v) => el.timer.classList.toggle('warn', v));
      this.set('frozen', s.boosters.freeze > 0, (v) => el.timer.classList.toggle('frozen', v));

      // Combo pill
      this.set('combo', s.combo, (v) => {
        if (v >= 2) {
          el.combo.textContent = 'COMBO ×' + v;
          el.combo.classList.remove('on');
          void el.combo.offsetWidth; // restart the pop animation
          el.combo.classList.add('on');
        } else el.combo.classList.remove('on');
      });

      // Finish early once the target is reached.
      this.set('done', s.reachedTarget && !s.ended && !s.overtime && !s.finishPending && s.mode !== 'demo', (v) => el.done.classList.toggle('on', v));

      // Screen-edge tint for the most important active booster (GPU-composited CSS).
      const b = s.boosters;
      const tint = s.ended ? '' : b.freeze > 0 ? 'freeze' : b.frenzy > 0 ? 'frenzy' : b.double > 0 ? 'double' : b.magnet > 0 ? 'magnet' : '';
      this.set('tint', tint, (v) => (el.tint.dataset.tint = v));

      if (s.boostersAllowed) {
        const eco = this.app.economy;
        GR.BOOSTERS.forEach((b) => {
          const ref = this.boosterEls[b.id];
          const n = eco.boosterCount(b.id);
          const active = s.boosters[b.id] > 0;
          this.set('bc_' + b.id, n, (v) => {
            ref.count.textContent = v;
            ref.btn.classList.toggle('empty', v === 0 && !active);
          });
          this.set('ba_' + b.id, active, (v) => ref.btn.classList.toggle('active', v));
          if (active) {
            const p = Math.round((s.boosters[b.id] / b.duration) * 100) / 100;
            this.set('bp_' + b.id, p, (v) => ref.btn.style.setProperty('--p', Math.min(1, v)));
          }
        });
      }
    }

    bumpMoney() {
      const m = this.el.money;
      m.classList.remove('bump');
      void m.offsetWidth;
      m.classList.add('bump');
    }

    banner(title, sub, long) {
      const b = this.el.banner;
      b.classList.toggle('long', !!long);
      b.querySelector('b').textContent = title;
      b.querySelector('span').innerHTML = sub || '';
      b.classList.remove('on');
      void b.offsetWidth;
      b.classList.add('on');
    }

    hint(text) {
      this.el.hint.textContent = text || '';
      this.el.hint.classList.toggle('on', !!text);
    }

    /** World position of the money counter (where flying coins go). */
    moneyAnchor(renderer) {
      const r = this.el.money.getBoundingClientRect();
      const s = this.root.getBoundingClientRect();
      if (!r.width) return { x: 640, y: 40 - renderer.offsetY };
      return renderer.toWorld(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2);
    }
  }

  GR.HUD = HUD;
})((window.GR = window.GR || {}));
