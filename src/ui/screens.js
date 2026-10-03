/**
 * Menu screens. Each screen renders into its <section> when opened and wires
 * its buttons once through event delegation. Screens never run during
 * gameplay, so plain template strings keep them small and readable.
 */
(function (GR) {
  'use strict';

  const { $, $$, delegate, num, money, price } = GR.dom;
  const icon = GR.icon;
  const esc = GR.util.escapeHtml;

  function header(title, opts) {
    return (
      '<header class="screen-head">' +
      '<button class="icon-btn" data-action="back" aria-label="Back">' + icon('back') + '</button>' +
      '<h2>' + title + '</h2>' +
      (opts && opts.noWallet ? '<span></span>' : wallet()) +
      '</header>'
    );
  }

  function wallet() {
    const eco = GR.app.economy;
    return (
      '<div class="wallet">' +
      '<span class="pill" title="Coins">' + icon('coin', 'cur') + '<b data-bind="coins">' + num(eco.coins) + '</b></span>' +
      '<span class="pill" title="Premium tokens">' + icon('token', 'cur') + '<b data-bind="tokens">' + num(eco.tokens) + '</b></span>' +
      '</div>'
    );
  }

  /** Re-render the wallet pills anywhere on screen after a purchase. */
  function refreshWallet() {
    const eco = GR.app.economy;
    $$('[data-bind="coins"]').forEach((el) => (el.textContent = num(eco.coins)));
    $$('[data-bind="tokens"]').forEach((el) => (el.textContent = num(eco.tokens)));
  }

  /** Today's three missions with progress bars (used on the Daily screen). */
  function missionsCard(app) {
    const list = app.missions.list();
    const done = list.filter((m) => m.done).length;
    return (
      '<div class="card">' +
      '<h4>' + icon('check') + 'DAILY MISSIONS · ' + done + '/' + list.length + '</h4>' +
      '<ul class="missions">' +
      list
        .map((m) => {
          const pct = Math.round((m.progress / m.goal) * 100);
          return (
            '<li class="' + (m.done ? 'done' : '') + '">' +
            '<span class="m-ico">' + icon(m.done ? 'check' : 'star') + '</span>' +
            '<span class="m-body"><b>' + esc(app.missions.describe(m)) + '</b>' +
            (m.done ? '<small class="ok">COMPLETE</small>' : '<i class="m-bar"><em style="width:' + pct + '%"></em></i><small>' + num(m.progress) + ' / ' + num(m.goal) + '</small>') +
            '</span>' +
            '<span class="m-reward">' + GR.dom.rewardLabel({ coins: m.coins }) + '</span>' +
            '</li>'
          );
        })
        .join('') +
      '</ul>' +
      '<p class="note">Finish all three for a bonus ' + icon('token', 'cur') + '1. New missions every day.</p>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------------------
  // HOME
  // ---------------------------------------------------------------------------
  class HomeScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      this.startLevel = null;
      delegate(el, {
        play: () => app.startCampaign(this.chosenStart()),
        checkpoint: (b) => {
          this.startLevel = +b.dataset.level;
          app.audio.play('click');
          this.render();
        },
        daily: () => app.openScreen('DAILY_CHALLENGE'),
        shop: () => app.openScreen('SHOP'),
        upgrades: () => app.openScreen('UPGRADES'),
        achievements: () => app.openScreen('ACHIEVEMENTS'),
        leaderboard: () => app.openScreen('LEADERBOARD'),
        settings: () => app.openScreen('SETTINGS'),
      });
    }

    checkpoints() {
      const best = this.app.save.data.stats.bestLevel;
      const out = [];
      for (let l = 1; l <= best; l += GR.CONFIG.CHECKPOINT_EVERY) out.push(l);
      return out;
    }

    chosenStart() {
      const cps = this.checkpoints();
      if (this.startLevel && cps.indexOf(this.startLevel) >= 0) return this.startLevel;
      return cps[cps.length - 1];
    }

    render() {
      const app = this.app;
      const d = app.save.data;
      const xpNeed = GR.Economy.xpForLevel(d.player.level);
      const streak = app.daily.currentStreak();
      const dailyDone = app.daily.isCompleted(app.daily.today());
      const dailyPlayed = app.daily.bestFor(app.daily.today()) > 0;
      const todo = app.missions.list().filter((m) => !m.done).length + (dailyDone ? 0 : 1);
      const upg = app.economy.affordableUpgrades();
      const cps = this.checkpoints();
      const start = this.chosenStart();
      this.el.innerHTML =
        '<div class="home">' +
        '<header class="topbar">' +
        wallet() +
        '<div class="player" title="Player level">' +
        '<span class="lvl-badge">LV ' + d.player.level + '</span>' +
        '<span class="xp" role="progressbar" aria-label="Experience" aria-valuenow="' + d.player.xp + '" aria-valuemax="' + xpNeed + '"><i style="width:' + Math.round((d.player.xp / xpNeed) * 100) + '%"></i></span>' +
        '</div>' +
        '<span class="pill streak' + (streak ? ' hot' : '') + '" title="Daily streak">' + icon('flame') + '<b>' + streak + '</b><small>DAY' + (streak === 1 ? '' : 'S') + '</small></span>' +
        '</header>' +
        '<div class="logo" aria-label="Gold Rush"><span class="logo-a">GOLD</span><span class="logo-b">RUSH</span></div>' +
        '<div class="home-spacer"></div>' +
        '<div class="home-actions">' +
        (d.stats.bestRun > 0 ? '<div class="best">' + icon('trophy') + 'BEST RUN <b>' + money(d.stats.bestRun) + '</b></div>' : '') +
        '<button class="btn btn-play" data-action="play">' + icon('play') + '<span>PLAY<small>LEVEL ' + start + '</small></span></button>' +
        (cps.length > 1
          ? '<div class="checkpoints" role="group" aria-label="Start level"><span>START AT</span>' +
            cps.map((l) => '<button class="chip' + (l === start ? ' on' : '') + '" data-action="checkpoint" data-level="' + l + '" aria-pressed="' + (l === start) + '">L' + l + '</button>').join('') +
            '</div>'
          : '') +
        '<div class="tiles">' +
        '<button class="btn tile" data-action="daily">' + icon('calendar') + '<span>DAILY</span>' +
        (!dailyPlayed ? '<em class="badge">NEW</em>' : todo ? '<em class="badge">' + todo + '</em>' : '<em class="badge ok">' + icon('check') + '</em>') + '</button>' +
        '<button class="btn tile" data-action="shop">' + icon('shop') + '<span>SHOP</span></button>' +
        '<button class="btn tile" data-action="upgrades">' + icon('upgrade') + '<span>UPGRADES</span>' + (upg ? '<em class="badge">' + upg + '</em>' : '') + '</button>' +
        '</div>' +
        '<div class="row3">' +
        '<button class="btn ghost" data-action="achievements">' + icon('trophy') + '<span>' + app.achievements.count() + '/' + GR.ACHIEVEMENTS.length + '</span></button>' +
        '<button class="btn ghost" data-action="leaderboard">' + icon('podium') + '<span>RANKS</span></button>' +
        '<button class="btn ghost" data-action="settings" aria-label="Settings">' + icon('gear') + '<span>SETTINGS</span></button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }
  }

  // ---------------------------------------------------------------------------
  // DAILY CHALLENGE
  // ---------------------------------------------------------------------------
  class DailyScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      delegate(el, {
        back: () => app.back(),
        'play-daily': () => app.startDaily(),
        share: () => app.shareDaily(),
      });
    }

    render() {
      const app = this.app;
      const daily = app.daily;
      const today = daily.today();
      const mod = daily.modifierFor(today);
      const level = GR.LevelGen.daily(today);
      const best = daily.bestFor(today);
      const done = daily.isCompleted(today);
      const streak = daily.currentStreak();
      const nextDay = daily.nextStreakDay();
      const cycle = Math.floor(Math.max(0, (done ? streak - 1 : streak)) / 7);
      const track = GR.Daily.STREAK_REWARDS.map((r) => {
        const bundle = daily.rewardForDay(r.day, cycle);
        const stateCls = r.day < nextDay || (done && r.day === nextDay) ? 'done' : r.day === nextDay ? 'today' : '';
        return (
          '<li class="' + stateCls + (r.special ? ' special' : '') + '">' +
          '<small>DAY ' + r.day + '</small>' +
          (stateCls === 'done' ? icon('check') : r.special ? icon('gift') : icon('coin', 'cur')) +
          '<b>' + (r.special ? (bundle.claws ? 'CLAW' : '+' + bundle.tokens) : num(bundle.coins)) + '</b>' +
          '</li>'
        );
      }).join('');

      this.el.innerHTML =
        header('DAILY') +
        '<div class="scroll">' +
        '<div class="card daily-hero">' +
        '<small class="eyebrow">TODAY\'S CHALLENGE · ' + GR.util.prettyDate(today) + '</small>' +
        '<h3>' + esc(mod.name.toUpperCase()) + '</h3>' +
        '<p>' + esc(mod.desc) + '</p>' +
        '<div class="stats2">' +
        '<div><small>TARGET</small><b>' + money(level.target) + '</b></div>' +
        '<div><small>BEST</small><b>' + (best ? money(best) : '—') + '</b>' + (done ? '<em class="ok">' + icon('check') + 'BEATEN</em>' : '') + '</div>' +
        '</div>' +
        '<button class="btn btn-primary big" data-action="play-daily">' + icon('play') + (best ? 'PLAY AGAIN' : 'PLAY') + '</button>' +
        (best ? '<button class="btn btn-secondary" data-action="share">' + icon('share') + 'SHARE MY SCORE</button>' : '') +
        '<p class="note">Everyone gets this exact level today. Standard claw — upgrades and boosters are off, so it\'s pure skill.</p>' +
        '</div>' +
        missionsCard(app) +
        '<div class="card">' +
        '<h4>' + icon('flame') + 'STREAK · ' + streak + ' DAY' + (streak === 1 ? '' : 'S') + '</h4>' +
        '<p class="note">Beat the daily target on consecutive days. Missing a single day won\'t break your streak.</p>' +
        '<ol class="streak-track">' + track + '</ol>' +
        '</div>' +
        '<div class="card">' +
        '<h4>' + icon('podium') + 'TODAY\'S TOP MINERS</h4>' +
        '<ol class="lb mini" id="daily-lb"><li class="muted">Loading…</li></ol>' +
        '<p class="note">' + (app.leaderboard.isOnline ? 'Live rankings.' : 'Offline preview — online rankings are prepared and coming soon.') + '</p>' +
        '</div>' +
        '</div>';

      app.leaderboard.fetch('today', 5).then((rows) => {
        const list = $('#daily-lb', this.el);
        if (list) list.innerHTML = LeaderboardScreen.rows(rows);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // SHOP
  // ---------------------------------------------------------------------------
  class ShopScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      this.tab = 'skins';
      delegate(el, {
        back: () => app.back(),
        tab: (b) => {
          this.tab = b.dataset.tab;
          app.audio.play('click');
          this.render();
        },
        cosmetic: (b) => this.cosmetic(b.dataset.kind, b.dataset.id),
        booster: (b) => this.buyBooster(b.dataset.id, b.dataset.bundle === '1'),
        pack: (b) => this.buyPack(b.dataset.sku),
        'free-token': () => this.freeReward('token'),
        'free-booster': () => this.freeReward('booster'),
      });
    }

    cosmetic(kind, id) {
      const app = this.app;
      const eco = app.economy;
      const item = (kind === 'skin' ? GR.MINE_SKINS_BY_ID : GR.CLAW_SKINS_BY_ID)[id];
      const state = eco.cosmeticState(kind, item);
      if (state === 'owned') {
        eco.equip(kind, id);
        app.audio.play('click');
      } else if (state === 'purchase') {
        if (eco.buyCosmetic(kind, item)) {
          app.audio.play('upgrade');
          app.toasts.show('UNLOCKED: ' + item.name.toUpperCase(), 'Equipped and ready to dig.', 'check');
          app.achievements.evaluate();
        } else {
          app.audio.play('error');
          app.toasts.show('NOT ENOUGH ' + (item.cost.tokens ? 'TOKENS' : 'COINS'), 'Play a few rounds and come back!', 'coin');
        }
      } else {
        app.audio.play('error');
        return;
      }
      app.applyCosmetics();
      this.render();
    }

    buyBooster(id, bundle) {
      const app = this.app;
      if (app.economy.buyBooster(id, bundle)) {
        app.audio.play('upgrade');
        refreshWallet();
        this.render();
      } else {
        app.audio.play('error');
        app.toasts.show('NOT ENOUGH COINS', 'Boosters are cheaper in bundles of 3.', 'coin');
      }
    }

    buyPack(sku) {
      const app = this.app;
      app.purchases.buy(sku).then((res) => {
        if (res.ok) {
          app.audio.play('upgrade');
          app.toasts.show('PACK UNLOCKED', 'Simulated purchase (dev mode).', 'gift');
          app.applyCosmetics();
          app.achievements.evaluate();
          this.render();
        } else {
          app.toasts.show('COMING SOON', esc(res.reason), 'shop');
        }
      });
    }

    /** Opt-in rewarded ad for a free token or a random booster. */
    freeReward(kind) {
      const app = this.app;
      if (app.ads.freeRewardsLeft(kind) <= 0) return;
      app.ads.showRewardedAd(kind === 'token' ? 'free_token' : 'free_booster').then((r) => {
        if (r === 'success') {
          app.ads.consumeFreeReward(kind);
          app.audio.play('achievement');
          if (kind === 'token') {
            app.economy.addTokens(1, 'ad');
            app.toasts.show('+1 TOKEN', 'Thanks for supporting Gold Rush!', 'token');
          } else {
            const b = GR.BOOSTERS[Math.floor(Math.random() * GR.BOOSTERS.length)];
            app.economy.addBooster(b.id, 1);
            app.toasts.show('+1 ' + b.name.toUpperCase(), 'Use it from the booster bar in your next level.', b.icon);
          }
        }
        this.render();
      });
    }

    cosmeticCard(kind, item) {
      const eco = this.app.economy;
      const state = eco.cosmeticState(kind, item);
      let label;
      let tag;
      switch (state) {
        case 'equipped':
          tag = 'EQUIPPED';
          label = icon('check') + 'EQUIPPED';
          break;
        case 'owned':
          tag = 'OWNED';
          label = 'EQUIP';
          break;
        case 'locked':
          tag = 'LOCKED';
          label = icon('lock') + 'PLAYER LV ' + item.minLevel;
          break;
        case 'exclusive':
          tag = 'EXCLUSIVE';
          label = icon('lock') + (item.source === 'streak:7' ? '7-DAY STREAK' : 'STARTER PACK');
          break;
        default:
          tag = null;
          label = price(item.cost);
      }
      const afford = state !== 'purchase' || eco.canAfford(item.cost);
      return (
        '<div class="item is-' + state + '">' +
        (tag ? '<span class="tag">' + tag + '</span>' : '') +
        '<canvas class="preview" width="' + (kind === 'skin' ? 240 : 160) + '" height="' + (kind === 'skin' ? 150 : 160) + '" data-kind="' + kind + '" data-id="' + item.id + '"></canvas>' +
        '<div class="item-name">' + esc(item.name) + '</div>' +
        '<button class="btn item-btn' + (state === 'purchase' ? ' buy' : '') + (afford ? '' : ' poor') + '" data-action="cosmetic" data-kind="' + kind + '" data-id="' + item.id + '"' +
        (state === 'equipped' || state === 'locked' || state === 'exclusive' ? ' disabled' : '') + '>' + label + '</button>' +
        '</div>'
      );
    }

    render() {
      const app = this.app;
      const eco = app.economy;
      const tabs = [
        ['skins', 'SKINS'],
        ['claws', 'CLAWS'],
        ['boosters', 'BOOSTERS'],
        ['packs', 'PACKS'],
      ];
      let body = '';
      if (this.tab === 'skins') {
        body = '<div class="grid">' + GR.MINE_SKINS.map((s) => this.cosmeticCard('skin', s)).join('') + '</div>';
      } else if (this.tab === 'claws') {
        body = '<div class="grid claws">' + GR.CLAW_SKINS.map((s) => this.cosmeticCard('claw', s)).join('') + '</div>';
      } else if (this.tab === 'boosters') {
        const freeB = app.ads.freeRewardsLeft('booster');
        body =
          '<p class="note">Use boosters during campaign levels from the bar at the bottom (or keys 1-4).</p>' +
          '<div class="row-card free">' +
          '<div class="row-icon">' + icon('gift') + '</div>' +
          '<div class="row-body"><b>FREE BOOSTER</b><span>Watch a short ad for a random booster. ' + freeB + ' left today.</span></div>' +
          '<div class="row-btns"><button class="btn btn-buy" data-action="free-booster"' + (freeB ? '' : ' disabled') + '>' + icon('tv') + 'WATCH</button></div>' +
          '</div>' +
          GR.BOOSTERS.map(
            (b) =>
              '<div class="row-card">' +
              '<div class="row-icon" style="--c:' + b.color + '">' + icon(b.icon) + '</div>' +
              '<div class="row-body"><b>' + b.name.toUpperCase() + '</b><span>' + esc(b.desc) + '</span><small>OWNED: ' + eco.boosterCount(b.id) + '</small></div>' +
              '<div class="row-btns">' +
              '<button class="btn btn-buy' + (eco.coins < b.price ? ' poor' : '') + '" data-action="booster" data-id="' + b.id + '">×1 ' + price({ coins: b.price }) + '</button>' +
              '<button class="btn btn-buy' + (eco.coins < b.bundlePrice ? ' poor' : '') + '" data-action="booster" data-id="' + b.id + '" data-bundle="1">×3 ' + price({ coins: b.bundlePrice }) + '</button>' +
              '</div></div>'
          ).join('');
      } else {
        const left = app.ads.freeRewardsLeft('token');
        body =
          '<div class="row-card free">' +
          '<div class="row-icon">' + icon('token') + '</div>' +
          '<div class="row-body"><b>FREE TOKEN</b><span>Watch a short ad for +1 premium token. ' + left + ' left today.</span></div>' +
          '<div class="row-btns"><button class="btn btn-buy" data-action="free-token"' + (left ? '' : ' disabled') + '>' + icon('tv') + 'WATCH</button></div>' +
          '</div>' +
          GR.PRODUCTS.map((p) => {
            const owned = app.purchases.owns(p.sku);
            return (
              '<div class="pack' + (owned ? ' owned' : '') + '">' +
              (p.tag ? '<span class="tag">' + p.tag + '</span>' : '') +
              '<h4>' + esc(p.name.toUpperCase()) + '</h4>' +
              '<ul>' + p.lines.map((l) => '<li>' + icon('check') + esc(l) + '</li>').join('') + '</ul>' +
              '<button class="btn btn-secondary" data-action="pack" data-sku="' + p.sku + '"' + (owned ? ' disabled' : '') + '>' +
              (owned ? 'OWNED' : app.purchases.isAvailable() ? 'BUY ' + p.price + ' (DEV)' : p.price + ' · COMING SOON') +
              '</button></div>'
            );
          }).join('') +
          '<p class="note">Premium packs are not for sale yet — no payments are processed in this version.</p>';
      }

      this.el.innerHTML =
        header('SHOP') +
        '<nav class="tabs" role="tablist">' +
        tabs.map((t) => '<button role="tab" aria-selected="' + (this.tab === t[0]) + '" class="tab' + (this.tab === t[0] ? ' on' : '') + '" data-action="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') +
        '</nav>' +
        '<div class="scroll">' + body + '</div>';

      $$('canvas.preview', this.el).forEach((c) => {
        if (c.dataset.kind === 'skin') GR.Renderer.previewTheme(c, GR.MINE_SKINS_BY_ID[c.dataset.id]);
        else GR.Renderer.previewClaw(c, GR.CLAW_SKINS_BY_ID[c.dataset.id]);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // UPGRADES
  // ---------------------------------------------------------------------------
  class UpgradesScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      delegate(el, {
        back: () => app.back(),
        buy: (b) => {
          const id = b.dataset.id;
          if (app.economy.buyUpgrade(id)) {
            app.audio.play('upgrade');
            app.achievements.evaluate();
            this.render();
            const row = $('[data-row="' + id + '"]', this.el);
            if (row) row.classList.add('flash');
          } else {
            app.audio.play('error');
            app.toasts.show('NOT ENOUGH COINS', 'Every $10 you collect = 1 coin.', 'coin');
          }
        },
      });
    }

    render() {
      const eco = this.app.economy;
      const fromGame = this.app.stateStack.indexOf('LEVEL_COMPLETE') >= 0;
      this.el.innerHTML =
        header('UPGRADES') +
        '<div class="scroll">' +
        '<p class="note">Permanent boosts for the campaign. The Daily Challenge always uses the standard claw.</p>' +
        GR.UPGRADES.map((u) => {
          const lvl = eco.upgradeLevel(u.id);
          const max = u.effects.length;
          const next = eco.nextUpgradePrice(u.id);
          const cur = lvl ? u.format(u.effects[lvl - 1]) : 'Not upgraded';
          const nxt = lvl < max ? u.format(u.effects[lvl]) : null;
          return (
            '<div class="row-card upg" data-row="' + u.id + '">' +
            '<div class="row-icon">' + icon(u.icon) + '</div>' +
            '<div class="row-body">' +
            '<b>' + u.name.toUpperCase() + ' <small class="lv">LV ' + lvl + '/' + max + '</small></b>' +
            '<span>' + esc(u.desc) + '</span>' +
            '<div class="pips" aria-hidden="true">' + u.effects.map((_, i) => '<i class="' + (i < lvl ? 'on' : '') + '"></i>').join('') + '</div>' +
            '<small class="effect">' + esc(cur) + (nxt ? ' → <em>' + esc(nxt) + '</em>' : '') + '</small>' +
            '</div>' +
            '<div class="row-btns">' +
            (next === null
              ? '<button class="btn btn-buy maxed" disabled>MAX</button>'
              : '<button class="btn btn-buy' + (eco.coins < next ? ' poor' : '') + '" data-action="buy" data-id="' + u.id + '" aria-label="Upgrade ' + u.name + ' for ' + next + ' coins">' + price({ coins: next }) + '</button>') +
            '</div></div>'
          );
        }).join('') +
        (fromGame ? '<button class="btn btn-primary big" data-action="back">' + icon('play') + 'BACK TO THE MINE</button>' : '') +
        '</div>';
    }
  }

  // ---------------------------------------------------------------------------
  // ACHIEVEMENTS
  // ---------------------------------------------------------------------------
  class AchievementsScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      delegate(el, { back: () => app.back() });
    }

    render() {
      const ach = this.app.achievements;
      const list = GR.ACHIEVEMENTS.slice().sort((a, b) => (ach.isUnlocked(b.id) ? 1 : 0) - (ach.isUnlocked(a.id) ? 1 : 0));
      this.el.innerHTML =
        header('ACHIEVEMENTS') +
        '<div class="scroll">' +
        '<p class="note">' + ach.count() + ' of ' + GR.ACHIEVEMENTS.length + ' unlocked · rewards are paid automatically</p>' +
        list.map((a) => {
          const done = ach.isUnlocked(a.id);
          const p = ach.progressOf(a);
          const pct = Math.round((p / a.goal) * 100);
          const fmtP = a.money ? money : num;
          return (
            '<div class="row-card ach' + (done ? ' done' : '') + '">' +
            '<div class="row-icon">' + icon(done ? 'trophy' : 'lock') + '</div>' +
            '<div class="row-body"><b>' + esc(a.name.toUpperCase()) + (done ? ' <small class="ok">' + icon('check') + 'UNLOCKED</small>' : '') + '</b>' +
            '<span>' + esc(a.desc) + '</span>' +
            (done ? '' : '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div><small>' + fmtP(p) + ' / ' + fmtP(a.goal) + '</small>') +
            '</div>' +
            '<div class="reward">' + GR.dom.rewardLabel(a.reward) + '</div>' +
            '</div>'
          );
        }).join('') +
        '</div>';
    }
  }

  // ---------------------------------------------------------------------------
  // LEADERBOARD
  // ---------------------------------------------------------------------------
  class LeaderboardScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      this.tab = 'global';
      delegate(el, {
        back: () => app.back(),
        tab: (b) => {
          this.tab = b.dataset.tab;
          app.audio.play('click');
          this.render();
        },
      });
    }

    static rows(rows) {
      if (!rows.length) return '<li class="muted">No scores yet — be the first!</li>';
      return rows
        .map(
          (r) =>
            '<li class="' + (r.isPlayer ? 'me' : '') + (r.rank <= 3 ? ' top' + r.rank : '') + '">' +
            '<span class="rank">' + r.rank + '</span>' +
            '<span class="name">' + esc(r.name) + (r.isPlayer ? ' <em>YOU</em>' : '') + '</span>' +
            '<b>' + money(r.score) + '</b></li>'
        )
        .join('');
    }

    render() {
      const app = this.app;
      const tabs = [
        ['global', 'GLOBAL'],
        ['today', 'TODAY'],
        ['week', 'WEEK'],
      ];
      const sub = { global: 'Best single run, all time', today: 'Daily Challenge · ' + GR.util.prettyDate(GR.util.dateKey()), week: 'Best run this week' };
      this.el.innerHTML =
        header('LEADERBOARD') +
        '<nav class="tabs" role="tablist">' +
        tabs.map((t) => '<button role="tab" aria-selected="' + (this.tab === t[0]) + '" class="tab' + (this.tab === t[0] ? ' on' : '') + '" data-action="tab" data-tab="' + t[0] + '">' + t[1] + '</button>').join('') +
        '</nav>' +
        '<div class="scroll">' +
        (app.leaderboard.isOnline
          ? ''
          : '<div class="banner-note">' + icon('podium') + '<span><b>OFFLINE PREVIEW</b>Online leaderboards are built in and ready to connect. Rival scores below are sample data; yours are real.</span></div>') +
        '<p class="note">' + sub[this.tab] + '</p>' +
        '<ol class="lb" id="lb-list"><li class="muted">Loading…</li></ol>' +
        '</div>';
      const tab = this.tab;
      app.leaderboard.fetch(tab, 10).then((rows) => {
        const list = $('#lb-list', this.el);
        if (list && this.tab === tab) list.innerHTML = LeaderboardScreen.rows(rows);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // SETTINGS
  // ---------------------------------------------------------------------------
  class SettingsScreen {
    constructor(el, app) {
      this.el = el;
      this.app = app;
      delegate(el, {
        back: () => app.back(),
        toggle: (b) => {
          app.toggleSetting(b.dataset.key);
          this.render();
          const again = $('[data-key="' + b.dataset.key + '"]', this.el);
          if (again) again.focus();
        },
        tutorial: () => {
          app.save.data.tutorial.done = false;
          app.save.save();
          app.toasts.show('TIPS RESET', 'Controls hints will show next game.', 'check');
        },
        reset: () => {
          app.confirm('RESET ALL PROGRESS?', 'Coins, upgrades, skins, achievements and streaks will be erased. This cannot be undone.', 'ERASE').then((ok) => {
            if (ok) app.resetProgress();
          });
        },
      });
      el.addEventListener('change', (e) => {
        if (e.target.id === 'player-name') {
          const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 12) || 'PLAYER';
          e.target.value = clean;
          app.save.data.player.name = clean;
          app.save.save();
        }
      });
    }

    render() {
      const s = this.app.save.data.settings;
      const row = (key, label, desc, ico) =>
        '<button class="setting" data-action="toggle" data-key="' + key + '" role="switch" aria-checked="' + !!s[key] + '">' +
        icon(ico) + '<span><b>' + label + '</b><small>' + desc + '</small></span>' +
        '<em class="switch' + (s[key] ? ' on' : '') + '">' + (s[key] ? 'ON' : 'OFF') + '</em></button>';
      this.el.innerHTML =
        header('SETTINGS', { noWallet: true }) +
        '<div class="scroll">' +
        row('sound', 'SOUND', 'Effects for the claw, coins and gems', 'sound') +
        row('music', 'MUSIC', 'Background music loop', 'music') +
        row('reducedMotion', 'REDUCED MOTION', 'No screen shake or flashes, fewer particles', 'motion') +
        row('haptics', 'VIBRATION', 'Short buzz on big catches (supported phones)', 'vibrate') +
        '<label class="setting name"><span><b>PLAYER NAME</b><small>Shown on leaderboards (letters, numbers, _ )</small></span>' +
        '<input id="player-name" maxlength="12" autocomplete="off" spellcheck="false" value="' + esc(this.app.save.data.player.name) + '"></label>' +
        '<div class="card help"><h4>HOW TO PLAY</h4><p>The claw swings by itself. <b>Tap</b>, <b>click</b>, <b>SPACE</b> or <b>ENTER</b> to launch it. Grab gold and gems, avoid slow rocks, reach the target before time runs out.</p>' +
        '<p><b>ESC</b> pause · <b>R</b> play again · <b>1-4</b> boosters</p></div>' +
        '<button class="btn btn-secondary" data-action="tutorial">' + icon('restart') + 'SHOW CONTROL HINTS AGAIN</button>' +
        '<button class="btn btn-danger" data-action="reset">RESET PROGRESS</button>' +
        '<p class="note">Gold Rush v' + GR.CONFIG.VERSION + ' · Progress is saved on this device only. No accounts, no tracking.</p>' +
        '</div>';
    }
  }

  GR.Screens = { HomeScreen, DailyScreen, ShopScreen, UpgradesScreen, AchievementsScreen, LeaderboardScreen, SettingsScreen, refreshWallet };
})((window.GR = window.GR || {}));
