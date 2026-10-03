/**
 * Overlays shown on top of the (frozen) playfield: pause, level complete,
 * game over, daily result, the simulated rewarded ad and confirm dialogs.
 */
(function (GR) {
  'use strict';

  const { $, delegate, num, money } = GR.dom;
  const icon = GR.icon;

  function coinsLine(n) {
    return '<span class="coins-earned">' + icon('coin', 'cur') + '+' + num(n) + '</span>';
  }

  /** "What's next" lines: closest daily mission + cheapest upgrade. */
  function goalsBlock(g) {
    if (!g || (!g.mission && !g.upgrade)) return '';
    let out = '<div class="goals">';
    if (g.mission) {
      const pct = Math.round((g.mission.progress / g.mission.goal) * 100);
      out +=
        '<div class="goal"><span class="goal-lbl">' + icon('check') + 'MISSION</span>' +
        '<span class="goal-txt">' + GR.util.escapeHtml(g.mission.text) + '</span>' +
        '<span class="goal-num">' + num(g.mission.progress) + '/' + num(g.mission.goal) + '</span>' +
        '<i class="goal-bar"><b style="width:' + pct + '%"></b></i></div>';
    }
    if (g.upgrade) {
      const u = g.upgrade;
      const ready = u.have >= u.price;
      const pct = Math.min(100, Math.round((u.have / u.price) * 100));
      out +=
        '<div class="goal' + (ready ? ' ready' : '') + '"><span class="goal-lbl">' + icon('upgrade') + 'NEXT UPGRADE</span>' +
        '<span class="goal-txt">' + GR.util.escapeHtml(u.name) + ' Lv ' + u.level + '</span>' +
        '<span class="goal-num">' + (ready ? 'READY!' : icon('coin', 'cur') + num(u.price - u.have) + ' to go') + '</span>' +
        '<i class="goal-bar"><b style="width:' + pct + '%"></b></i></div>';
    }
    return out + '</div>';
  }

  function shareCard(title, amount, sub) {
    return (
      '<div class="share-card">' +
      '<small>GOLD RUSH</small><span class="sc-title">' + title + '</span>' +
      '<b>' + money(amount) + '</b>' + (sub ? '<em>' + sub + '</em>' : '') +
      '</div>'
    );
  }

  function perkList(run) {
    if (!run || !run.perks || !run.perks.length) return '';
    return (
      '<div class="perk-chips">' +
      run.perks.map((id) => {
        const p = GR.PERKS_BY_ID[id];
        return '<span class="perk-chip" style="--c:' + p.color + '" title="' + GR.util.escapeHtml(p.desc) + '">' + icon(p.icon) + p.name + '</span>';
      }).join('') +
      '</div>'
    );
  }

  class Overlays {
    constructor(app) {
      this.app = app;
      this.pause = $('#ov-pause');
      this.complete = $('#ov-complete');
      this.gameover = $('#ov-gameover');
      this.dailyResult = $('#ov-daily');
      this.ad = $('#ov-ad');
      this.confirmEl = $('#ov-confirm');
      this.perk = $('#ov-perk');
      delegate(this.perk, {
        perk: (b) => app.pickPerk(b.dataset.id),
      });

      delegate(this.pause, {
        resume: () => app.resume(),
        restart: () => app.restartLevel(),
        settings: () => app.openScreen('SETTINGS'),
        home: () => app.goHome(),
      });
      delegate(this.complete, {
        next: () => app.nextLevel(),
        upgrades: () => app.openScreen('UPGRADES'),
        double: (b) => app.doubleCoins(b),
        home: () => app.goHome(),
      });
      delegate(this.gameover, {
        again: () => app.playAgain(),
        revive: () => app.revive(),
        home: () => app.goHome(),
        share: () => app.shareBest(),
        upgrades: () => app.openScreen('UPGRADES'),
      });
      delegate(this.dailyResult, {
        again: () => app.startDaily(),
        home: () => app.goHome(),
        share: () => app.shareDaily(),
      });
    }

    /** Pick 1 of 3 run perks between levels. */
    renderPerks(offer, run) {
      this.perk.innerHTML =
        '<div class="panel perk-panel" role="dialog" aria-modal="true" aria-labelledby="perk-title">' +
        '<small class="eyebrow">LEVEL ' + (run.level + 1) + ' NEXT</small>' +
        '<h2 id="perk-title">PICK A PERK</h2>' +
        '<p class="sub">It lasts for the rest of this run.</p>' +
        '<div class="perk-cards">' +
        offer
          .map(
            (p, i) =>
              '<button class="perk-card" data-action="perk" data-id="' + p.id + '" style="--c:' + p.color + '"' + (i === 0 ? ' data-autofocus' : '') + '>' +
              '<span class="perk-ico">' + icon(p.icon) + '</span>' +
              '<span class="perk-txt"><b>' + p.name.toUpperCase() + '</b><span>' + GR.util.escapeHtml(p.desc) + '</span></span>' +
              '<kbd>' + (i + 1) + '</kbd></button>'
          )
          .join('') +
        '</div>' +
        (run.perks.length ? '<p class="sub">Your perks: ' + run.perks.map((id) => GR.PERKS_BY_ID[id].name).join(' · ') + '</p>' : '') +
        '</div>';
    }

    renderPause() {
      const run = this.app.run;
      this.pause.innerHTML =
        '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">' +
        '<h2 id="pause-title">PAUSED</h2>' +
        '<p class="sub">' + (run && run.mode === 'daily' ? 'Daily Challenge' : 'Level ' + (run ? run.level : 1)) + '</p>' +
        perkList(run) +
        '<button class="btn btn-primary big" data-action="resume">' + icon('play') + 'RESUME</button>' +
        '<button class="btn btn-secondary" data-action="restart">' + icon('restart') + 'RESTART LEVEL</button>' +
        '<button class="btn btn-secondary" data-action="settings">' + icon('gear') + 'SETTINGS</button>' +
        '<button class="btn btn-ghost" data-action="home">' + icon('home') + 'HOME</button>' +
        '</div>';
    }

    /** r: result details computed by the app. */
    renderComplete(r) {
      const stars = [0, 1, 2]
        .map((i) => '<span class="star' + (i < r.stars ? ' on' : '') + '" style="--i:' + i + '">' + icon('star') + '</span>')
        .join('');
      const lines = r.breakdown.map((b) => '<li><span>' + b[0] + '</span><b>+' + num(b[1]) + '</b></li>').join('');
      this.complete.innerHTML =
        '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="lc-title">' +
        '<small class="eyebrow">LEVEL ' + r.level + '</small>' +
        '<h2 id="lc-title">' + (r.stars >= 3 ? 'PERFECT HAUL!' : 'LEVEL COMPLETE!') + '</h2>' +
        '<div class="stars" aria-label="' + r.stars + ' of 3 stars">' + stars + '</div>' +
        '<div class="big-money">' + money(r.money) + '<small>of ' + money(r.target) + ' target</small></div>' +
        '<div class="stats2">' +
        '<div><small>RUN TOTAL</small><b>' + money(r.runScore) + '</b>' + (r.newBest ? '<em class="ok">NEW BEST</em>' : '') + '</div>' +
        '<div><small>COINS</small><b>' + coinsLine(r.coins) + '</b></div>' +
        '</div>' +
        '<ul class="breakdown">' + lines + (r.coinMult > 1 ? '<li><span>Coin Multiplier</span><b>×' + r.coinMult.toFixed(2).replace(/0$/, '') + '</b></li>' : '') + '</ul>' +
        goalsBlock(r.goals) +
        '<button class="btn btn-reward" data-action="double"' + (r.canDouble ? '' : ' disabled') + '>' + icon('tv') + 'DOUBLE YOUR COINS <small>+' + num(r.coins) + '</small></button>' +
        '<button class="btn btn-primary big" data-action="next" data-autofocus>NEXT LEVEL ' + icon('play') + '</button>' +
        '<div class="row2">' +
        '<button class="btn btn-secondary" data-action="upgrades">' + icon('upgrade') + 'UPGRADES' + (r.affordable ? '<em class="badge">' + r.affordable + '</em>' : '') + '</button>' +
        '<button class="btn btn-ghost" data-action="home">' + icon('home') + 'HOME</button>' +
        '</div>' +
        '</div>';
    }

    renderGameOver(r) {
      this.gameover.innerHTML =
        '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="go-title">' +
        '<h2 id="go-title" class="lose">GAME OVER</h2>' +
        '<p class="sub">Level ' + r.level + ' · ' + money(r.money) + ' of ' + money(r.target) + ' — ' + money(r.target - r.money) + ' short</p>' +
        (r.newBest
          ? '<div class="new-best">' + icon('trophy') + 'NEW PERSONAL BEST!</div>' + shareCard('PERSONAL BEST', r.runScore, 'Reached level ' + r.level)
          : '<div class="big-money"><small>YOU COLLECTED</small>' + money(r.runScore) + '</div>') +
        '<div class="stats2">' +
        '<div><small>COINS EARNED</small><b>' + coinsLine(r.runCoins) + '</b></div>' +
        '<div><small>BEST SCORE</small><b>' + money(r.best) + '</b></div>' +
        '</div>' +
        goalsBlock(r.goals) +
        (r.newBest ? '<button class="btn btn-secondary" data-action="share">' + icon('share') + 'SHARE SCORE</button>' : '') +
        (r.canRevive
          ? '<button class="btn btn-reward" data-action="revive">' + icon('tv') + 'REVIVE <small>+' + GR.CONFIG.REVIVE_TIME + 's, keep your $</small></button>'
          : '') +
        '<button class="btn btn-primary big" data-action="again" data-autofocus>' + icon('restart') + 'PLAY AGAIN <kbd>R</kbd></button>' +
        '<div class="row2">' +
        '<button class="btn btn-secondary" data-action="upgrades">' + icon('upgrade') + 'UPGRADES' + (r.affordable ? '<em class="badge">' + r.affordable + '</em>' : '') + '</button>' +
        '<button class="btn btn-ghost" data-action="home">' + icon('home') + 'HOME</button>' +
        '</div>' +
        '</div>';
    }

    renderDaily(r) {
      const streak = r.streakReward;
      this.dailyResult.innerHTML =
        '<div class="panel" role="dialog" aria-modal="true" aria-labelledby="dr-title">' +
        '<small class="eyebrow">DAILY CHALLENGE · ' + GR.util.prettyDate(r.date) + '</small>' +
        '<h2 id="dr-title" class="' + (r.success ? '' : 'lose') + '">' + (r.success ? 'TARGET BEATEN!' : 'SO CLOSE!') + '</h2>' +
        shareCard('TODAY\'S SCORE', r.score, r.isBest && r.prevBest ? 'New best today!' : '') +
        '<div class="stats2">' +
        '<div><small>BEST TODAY</small><b>' + money(r.best) + '</b></div>' +
        '<div><small>TARGET</small><b>' + money(r.target) + (r.success ? ' ' + icon('check', 'ok') : '') + '</b></div>' +
        '</div>' +
        (streak
          ? '<div class="streak-reward">' + icon('flame') + '<div><b>STREAK DAY ' + streak.streak + '!</b><span>' + GR.dom.rewardLabel(streak.bundle) + (streak.graceUsed ? ' · grace day used' : '') + '</span></div></div>'
          : !r.success
            ? '<p class="sub">Beat ' + money(r.target) + ' to keep your streak going. Unlimited tries!</p>'
            : '') +
        '<p class="sub">' + coinsLine(r.coins) + ' coins earned</p>' +
        '<button class="btn btn-secondary" data-action="share">' + icon('share') + 'SHARE MY SCORE</button>' +
        '<button class="btn btn-primary big" data-action="again" data-autofocus>' + icon('restart') + 'TRY AGAIN</button>' +
        '<button class="btn btn-ghost" data-action="home">' + icon('home') + 'HOME</button>' +
        '</div>';
    }

    /** Simulated ad UI used by DevAdProvider. Resolves true when "watched". */
    presentAd(opts) {
      const el = this.ad;
      const rewarded = opts.kind === 'rewarded';
      return new Promise((resolve) => {
        let left = opts.seconds;
        el.innerHTML =
          '<div class="panel ad-panel" role="dialog" aria-modal="true" aria-label="Simulated ad">' +
          '<small class="eyebrow">' + (rewarded ? 'REWARDED AD' : 'INTERSTITIAL') + ' · DEV PLACEHOLDER</small>' +
          '<div class="ad-ring"><b>' + left + '</b></div>' +
          '<p class="sub">No real ad is shown in this version. A real ad network can be plugged into AdManager later.</p>' +
          '<button class="btn btn-ghost" data-ad="close">' + (rewarded ? 'CLOSE (NO REWARD)' : 'CLOSE') + '</button>' +
          '</div>';
        GR.dom.show(el, true);
        const ring = el.querySelector('.ad-ring');
        const label = ring.querySelector('b');
        ring.style.setProperty('--p', 0);
        const start = performance.now();
        const done = (ok) => {
          clearInterval(timer);
          GR.dom.show(el, false);
          el.innerHTML = '';
          resolve(ok);
        };
        const timer = setInterval(() => {
          const t = (performance.now() - start) / 1000;
          left = Math.max(0, Math.ceil(opts.seconds - t));
          label.textContent = left > 0 ? left : '✓';
          ring.style.setProperty('--p', Math.min(1, t / opts.seconds));
          if (t >= opts.seconds + 0.35) done(true);
        }, 100);
        el.querySelector('[data-ad="close"]').addEventListener('click', () => done(!rewarded));
      });
    }

    confirm(title, text, okLabel) {
      const el = this.confirmEl;
      return new Promise((resolve) => {
        el.innerHTML =
          '<div class="panel" role="alertdialog" aria-modal="true" aria-labelledby="cf-title">' +
          '<h2 id="cf-title">' + title + '</h2><p class="sub">' + text + '</p>' +
          '<button class="btn btn-danger" data-c="ok">' + okLabel + '</button>' +
          '<button class="btn btn-secondary" data-c="cancel" data-autofocus>CANCEL</button>' +
          '</div>';
        GR.dom.show(el, true);
        const btn = el.querySelector('[data-c="cancel"]');
        btn.focus();
        el.onclick = (e) => {
          const b = e.target.closest('[data-c]');
          if (!b) return;
          GR.dom.show(el, false);
          el.onclick = null;
          resolve(b.dataset.c === 'ok');
        };
      });
    }
  }

  GR.Overlays = Overlays;
})((window.GR = window.GR || {}));
