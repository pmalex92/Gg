/**
 * GOLD RUSH — application entry point.
 *
 * Owns the state machine, the requestAnimationFrame loop and the "run"
 * (a sequence of campaign levels, or one Daily Challenge attempt), and wires
 * gameplay events to economy, achievements, UI, audio and ads.
 *
 * States: BOOT, MENU, PLAYING, PAUSED, LEVEL_COMPLETE, GAME_OVER,
 *         PERK_PICK, DAILY_RESULT, SHOP, UPGRADES, DAILY_CHALLENGE, SETTINGS,
 *         ACHIEVEMENTS, LEADERBOARD
 */
(function (GR) {
  'use strict';

  const C = GR.CONFIG;
  const { $ } = GR.dom;

  const VIEWS = {
    MENU: '#screen-home',
    DAILY_CHALLENGE: '#screen-daily',
    SHOP: '#screen-shop',
    UPGRADES: '#screen-upgrades',
    ACHIEVEMENTS: '#screen-achievements',
    LEADERBOARD: '#screen-leaderboard',
    SETTINGS: '#screen-settings',
    PAUSED: '#ov-pause',
    PERK_PICK: '#ov-perk',
    LEVEL_COMPLETE: '#ov-complete',
    GAME_OVER: '#ov-gameover',
    DAILY_RESULT: '#ov-daily',
  };
  const GAME_LAYER = { PLAYING: 1, PAUSED: 1, LEVEL_COMPLETE: 1, PERK_PICK: 1, GAME_OVER: 1, DAILY_RESULT: 1 };
  const RESULT_STATES = { LEVEL_COMPLETE: 1, PERK_PICK: 1, GAME_OVER: 1, DAILY_RESULT: 1 };

  class App {
    constructor() {
      GR.app = this;
      const params = new URLSearchParams(window.location.search);
      this.devMode = params.has('dev');

      // --- systems ---
      this.bus = GR.bus;
      this.save = new GR.SaveManager(C.SAVE_KEY);
      this.save.load();
      this.economy = new GR.Economy(this.save, this.bus);
      this.achievements = new GR.Achievements(this.save, this.economy, this.bus);
      this.daily = new GR.Daily(this.save, this.economy, this.bus);
      this.missions = new GR.Missions(this.save, this.economy, this.bus);
      this.leaderboard = new GR.LeaderboardService(this.save, C.LEADERBOARD);
      this.ads = new GR.AdManager(this.save, C.ADS);
      this.purchases = new GR.PurchaseManager(this.save, this.economy, this.devMode);
      this.audio = new GR.AudioManager();

      // --- presentation ---
      this.stage = $('#stage');
      this.renderer = new GR.Renderer($('#game'));
      this.particles = new GR.Particles();
      this.fx = new GR.FX(this.particles, this.audio, { vibrate: (ms) => this.vibrate(ms) });
      this.mascot = this.renderer.mascot;
      this.fx.mascot = this.mascot;
      this.hud = new GR.HUD($('#hud'), this);
      this.toasts = new GR.Toasts($('#toasts'));
      this.overlays = new GR.Overlays(this);
      const S = GR.Screens;
      this.screens = {
        MENU: new S.HomeScreen($('#screen-home'), this),
        DAILY_CHALLENGE: new S.DailyScreen($('#screen-daily'), this),
        SHOP: new S.ShopScreen($('#screen-shop'), this),
        UPGRADES: new S.UpgradesScreen($('#screen-upgrades'), this),
        ACHIEVEMENTS: new S.AchievementsScreen($('#screen-achievements'), this),
        LEADERBOARD: new S.LeaderboardScreen($('#screen-leaderboard'), this),
        SETTINGS: new S.SettingsScreen($('#screen-settings'), this),
      };
      this.ads.setProvider(new GR.DevAdProvider((o) => this.overlays.presentAd(o), params.get('ads') === 'demo'));

      this.state = 'BOOT';
      this.stateStack = ['BOOT'];
      this.inputLockUntil = 0;
      this.session = null;
      this.run = null;
      this.demo = null;
      this.last = performance.now();

      this.bindInput();
      this.bindEvents();
      this.applySettings();
      this.applyCosmetics();
      this.resize();
      this.achievements.evaluate();
      // Sprites bake the display font into "TNT" / "?" glyphs: repaint once it is ready.
      if (document.fonts && document.fonts.load) document.fonts.load('20px "Lilita One"').then(() => GR.Sprites.clear());

      // FAST START: brand-new players drop straight into level 1.
      if (this.save.isNew) this.startCampaign(1);
      else this.goHome();

      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
      document.documentElement.classList.add('ready');
    }

    // =====================================================================
    // Wiring
    // =====================================================================

    bindInput() {
      this.input = new GR.Input(this.stage, {
        onGesture: () => this.audio.unlock(),
        onTap: () => {
          if (this.state === 'PLAYING' && this.session) this.session.launch();
        },
        onPrimary: (e) => {
          if (this.state === 'PLAYING') {
            if (this.session) this.session.launch();
            return true;
          }
          if (performance.now() < this.inputLockUntil) return true; // swallow mashed launch keys
          const active = document.activeElement;
          if (active && active.tagName === 'BUTTON' && !active.disabled) return false; // let the button fire
          if (this.state === 'LEVEL_COMPLETE') this.nextLevel();
          else if (this.state === 'GAME_OVER' || this.state === 'DAILY_RESULT') this.playAgain();
          else if (this.state === 'MENU' && e.key === 'Enter') this.screens.MENU.el.querySelector('[data-action="play"]').click();
          else return false;
          return true;
        },
        onPause: () => {
          if (this.state === 'PLAYING') return this.pause();
          if (this.state === 'PAUSED') return this.resume();
          if (VIEWS[this.state] && !GAME_LAYER[this.state] && this.state !== 'MENU') {
            this.back();
            return true;
          }
          return false;
        },
        onRestart: () => {
          if (this.state === 'GAME_OVER' || this.state === 'DAILY_RESULT') {
            this.playAgain();
            return true;
          }
          return false;
        },
        onBooster: (i) => {
          if (this.state === 'PLAYING') this.useBooster(GR.BOOSTERS[i].id);
          else if (this.state === 'PERK_PICK' && this.perkOffer && this.perkOffer[i] && performance.now() >= this.inputLockUntil) {
            this.pickPerk(this.perkOffer[i].id);
          }
        },
      });

      const blurred = (fn) => (el) => {
        el.blur();
        fn(el);
      };
      GR.dom.delegate($('#hud'), {
        pause: blurred(() => this.pause()),
        done: blurred(() => this.session && this.session.finishEarly()),
        booster: blurred((b) => this.useBooster(b.dataset.id)),
      });

      // Button click sound for every menu button.
      this.stage.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b && !b.disabled && !b.closest('#hud')) this.audio.play('click');
      });
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resize());
      if (window.visualViewport) window.visualViewport.addEventListener('resize', () => this.resize());
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.state === 'PLAYING') this.pause();
          this.save.flush();
          this.audio.suspend();
        } else {
          this.audio.resume();
          this.last = performance.now();
        }
      });
      window.addEventListener('blur', () => {
        if (this.state === 'PLAYING') this.pause();
      });
      window.addEventListener('pagehide', () => this.save.flush());

      this.bus.on('mission', (e) => {
        this.audio.play('achievement');
        this.toasts.show('MISSION COMPLETE', GR.util.escapeHtml(e.text) + ' · ' + GR.dom.rewardLabel({ coins: e.mission.coins }), 'check');
      });
      this.bus.on('missionsAll', () => {
        this.toasts.show('ALL MISSIONS DONE!', 'Bonus: ' + GR.dom.rewardLabel({ tokens: 1 }), 'token');
      });
      this.bus.on('achievement', (def) => {
        this.audio.play('achievement');
        this.toasts.show('ACHIEVEMENT: ' + def.name.toUpperCase(), GR.dom.rewardLabel(def.reward), 'trophy');
      });
      this.bus.on('economy', () => GR.Screens.refreshWallet());

      this.particles.onCoinArrive = () => {
        if (this.state === 'MENU') return;
        this.audio.play('coinTick');
        this.hud.bumpMoney();
      };
    }

    // =====================================================================
    // State machine
    // =====================================================================

    setState(s) {
      this.stateStack = [s];
      this.enter(s);
    }

    pushState(s) {
      this.stateStack.push(s);
      this.enter(s);
    }

    back() {
      if (this.stateStack.length > 1) this.stateStack.pop();
      else this.stateStack = ['MENU'];
      const top = this.stateStack[this.stateStack.length - 1];
      if (top === 'MENU' && !this.demo) this.startDemo();
      this.enter(top);
    }

    enter(s) {
      const prev = this.state;
      this.state = s;
      const screen = this.screens[s];
      if (screen) screen.render();

      Object.keys(VIEWS).forEach((k) => GR.dom.show($(VIEWS[k]), k === s));
      const gameVisible = !!GAME_LAYER[s];
      $('#hud').classList.toggle('is-open', gameVisible);
      this.stage.dataset.state = s;

      // Music + pause handling
      this.audio.setIntensity(s === 'PLAYING' ? 1 : 0);
      if (s === 'PAUSED') this.audio.setMusicEnabled(false);
      else if (prev === 'PAUSED' || prev === 'SETTINGS') this.audio.setMusicEnabled(this.save.data.settings.music);

      // Result panels "arm" briefly so a player still mashing tap/SPACE from
      // gameplay can't skip their reward screen by accident.
      const arming = RESULT_STATES[s] ? 650 : 0;
      this.inputLockUntil = performance.now() + arming;
      if (arming) {
        const ov = $(VIEWS[s]);
        ov.classList.add('arming');
        setTimeout(() => ov.classList.remove('arming'), arming);
      }

      // Focus: keyboard users land on the primary action; gameplay gets no focus.
      if (s === 'PLAYING') {
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      } else if (VIEWS[s]) {
        const root = $(VIEWS[s]);
        const target = root.querySelector('[data-autofocus]') || root.querySelector('button:not([disabled])');
        if (target && !GR.util.isCoarsePointer()) {
          setTimeout(() => {
            if (this.state === s) target.focus({ preventScroll: true });
          }, arming);
        }
      }
      this.last = performance.now();
    }

    openScreen(name) {
      this.pushState(name);
    }

    // =====================================================================
    // Runs & levels
    // =====================================================================

    newSeed() {
      return Math.floor(Math.random() * 1e9).toString(36);
    }

    startCampaign(startLevel) {
      this.demo = null;
      this.run = {
        mode: 'campaign',
        startLevel: startLevel || 1,
        level: startLevel || 1,
        seed: this.newSeed(),
        score: 0,
        coins: 0,
        revived: false,
        bestAtStart: this.save.data.stats.bestRun,
        perks: [],
      };
      this.startLevel();
    }

    startDaily() {
      this.demo = null;
      const date = this.daily.today();
      this.run = { mode: 'daily', date, level: 1, score: 0, coins: 0, revived: true, bestAtStart: this.daily.bestFor(date) };
      this.startLevel();
    }

    startLevel() {
      const run = this.run;
      const daily = run.mode === 'daily';
      const level = daily ? GR.LevelGen.daily(run.date) : GR.LevelGen.campaign(run.level, run.seed);
      const tutorial = !daily && !this.save.data.tutorial.done;
      const events = new GR.EventBus();
      // Perks only exist in campaign runs; the Daily stays equal for everyone.
      run.mods = GR.Perks.modifiers(daily ? [] : run.perks);
      this.session = new GR.GameSession({
        level,
        events,
        tutorial,
        stats: daily ? GR.Economy.baseClawStats() : GR.Perks.applyToStats(this.economy.clawStats(), run.mods),
        boostersAllowed: !daily,
        mods: run.mods,
      });
      run.convertedMoney = 0;
      run.convertedFrenzy = 0;
      run.scoredMoney = 0;
      run.doubled = false;
      run.lastCoins = 0;

      this.particles.clear();
      this.fx.attach(this.session);
      this.bindSessionEvents(events);

      // Guided start: the aim line helps on levels 1-2 until the player
      // reaches level 3 once, which "graduates" them with a short message.
      const tut = this.save.data.tutorial;
      const goal = '<b>' + GR.util.formatMoney(level.target) + '</b>';
      let graduating = false;
      if (!daily && !tut.graduated && run.level >= 3) {
        tut.graduated = true;
        graduating = true;
        this.save.save();
      }
      this.aimGuide = !daily && !tut.graduated && run.level <= 2;

      let label;
      if (daily) {
        const mod = this.daily.modifierFor(run.date);
        label = { title: 'DAILY CHALLENGE', sub: mod.name + ' · reach ' + goal };
      } else if (graduating) {
        label = { title: 'YOU GOT THE GIST!', sub: 'Now test your skills · reach ' + goal, long: true };
      } else {
        label = { title: 'LEVEL ' + run.level, sub: 'Reach ' + goal };
      }
      this.hud.bind(this.session, label, daily ? [] : run.perks);
      this.tutorialActive = tutorial;
      this.hud.hint(tutorial ? this.launchHint() : null);
      this.mascot.setMood('idle');
      if (graduating) {
        this.mascot.react('excited');
        this.mascot.say('NO MORE HELP!', true);
      }
      this.setState('PLAYING');
      requestAnimationFrame(() => (this.particles.coinTarget = this.hud.moneyAnchor(this.renderer)));
    }

    launchHint() {
      return GR.util.isCoarsePointer() ? 'TAP TO LAUNCH THE CLAW' : 'CLICK OR PRESS SPACE TO LAUNCH';
    }

    bindSessionEvents(ev) {
      const stats = this.save.data.stats;
      ev.on('launch', () => this.hud.hint(null));
      ev.on('miss', () => {
        if (this.tutorialActive) this.hud.hint('ALMOST! AIM FOR THE GOLD');
      });
      ev.on('deliver', (e) => {
        const t = e.obj.type;
        if (e.obj.kind === 'gold') stats.goldCollected += 1;
        if (t === 'diamond') stats.diamonds += 1;
        if (t === 'red_gem') stats.gems += 1;
        if (t === 'crab') stats.crabs += 1;
        if (t === 'relic') stats.relics += 1;
        if (t === 'mystery_bag') stats.bags += 1;
        if (t === 'diamond') this.missions.track('diamond');
        if (e.obj.kind === 'gold') this.missions.track('gold');
        if (t === 'mystery_bag') this.missions.track('bag');
        if (e.value > 0) this.missions.track('money', e.value);
        if (e.combo >= 2) this.missions.track('combo', e.combo);
        if (e.obj.kind === 'rock') stats.rocks += 1;
        stats.bestCombo = Math.max(stats.bestCombo, e.combo);
        if (this.tutorialActive && e.obj.kind !== 'rock') {
          this.tutorialActive = false;
          this.save.data.tutorial.done = true;
          this.fx.banner('GOOD CATCH!');
          this.hud.hint(null);
        }
        this.achievements.evaluate();
        this.save.save();
      });
      ev.on('explode', () => {
        stats.tntExploded += 1;
        this.missions.track('tnt');
      });
      ev.on('blastPayout', (e) => {
        if (e.value > 0) this.missions.track('money', e.value);
      });
      ev.on('fetch', (e) => this.missions.track('money', e.value));
      ev.on('end', (r) => this.onSessionEnd(r));
    }

    onSessionEnd(result) {
      const run = this.run;
      const d = this.save.data;
      const st = d.stats;
      const campaign = run.mode === 'campaign';
      this.hud.hint(null);
      this.tutorialActive = false;

      // --- lifetime stats ---
      st.roundsPlayed += 1;
      st.totalMoney += result.money - run.scoredMoney;
      st.bestRoundMoney = Math.max(st.bestRoundMoney, result.money);
      if (campaign && result.success) {
        st.levelsCompleted += 1;
        if (result.rocksCollected === 0 && result.catches > 0) st.cleanLevels += 1;
        if (result.stars >= 3) st.threeStarLevels += 1;
        this.missions.track('level');
        if (result.rocksCollected === 0 && result.catches > 0) this.missions.track('cleanLevel');
        if (result.stars >= 3) this.missions.track('stars3');
      }
      if (!campaign) this.missions.track('daily');
      const prevBestLevel = st.bestLevel;
      if (campaign && result.success) st.bestLevel = Math.max(st.bestLevel, run.level + 1);

      // --- run score ---
      run.score += result.money - run.scoredMoney;
      run.scoredMoney = result.money;

      // --- coins ---
      const E = C.ECONOMY;
      const breakdown = [];
      const fromMoney = Math.floor((result.money - run.convertedMoney) * E.moneyToCoins);
      run.convertedMoney = result.money;
      breakdown.push(['Gold collected', fromMoney]);
      let coins = fromMoney;
      if (campaign && result.success) {
        const lvlBonus = E.levelBonusBase + E.levelBonusPerLevel * run.level;
        breakdown.push(['Level bonus', lvlBonus]);
        coins += lvlBonus;
        if (result.stars > 1) {
          breakdown.push(['Star bonus', (result.stars - 1) * E.starBonus]);
          coins += (result.stars - 1) * E.starBonus;
        }
        if (result.reason === 'early' && result.timeLeft >= 1) {
          const early = Math.floor(result.timeLeft) * E.earlyFinishCoinsPerSecond;
          breakdown.push(['Early finish', early]);
          coins += early;
        }
      }
      const frenzy = result.frenzyCoins - run.convertedFrenzy;
      run.convertedFrenzy = result.frenzyCoins;
      if (frenzy > 0) {
        breakdown.push(['Frenzy coins', frenzy]);
        coins += frenzy;
      }
      const coinMult = this.economy.clawStats().coinMult * (run.mods ? run.mods.coinMult : 1);
      coins = Math.round(coins * coinMult);
      this.economy.addCoins(coins, 'round');
      run.coins += coins;
      run.lastCoins = coins;

      // --- XP ---
      const ups = this.economy.addXp(Math.floor(result.money / 25) + (result.success ? 20 : 5));
      ups.forEach((u) => this.toasts.show('LEVEL UP! YOU ARE LV ' + u.level, GR.dom.rewardLabel(u.reward), 'star'));

      this.ads.onRoundCompleted();

      // --- results per mode ---
      let view;
      let data;
      if (campaign) {
        const newBest = run.score > run.bestAtStart && run.score > 0;
        st.bestRun = Math.max(st.bestRun, run.score);
        const week = GR.util.weekKey(new Date());
        if (st.weekKey !== week) {
          st.weekKey = week;
          st.weekBest = 0;
        }
        st.weekBest = Math.max(st.weekBest, run.score);
        data = {
          level: run.level,
          money: result.money,
          target: result.target,
          stars: result.stars,
          runScore: run.score,
          runCoins: run.coins,
          best: st.bestRun,
          newBest,
          coins,
          coinMult,
          breakdown,
          canDouble: this.ads.isRewardedAdAvailable(),
          canRevive: !run.revived && this.ads.isRewardedAdAvailable(),
          affordable: 0,
          checkpoint: result.success && GR.LevelGen.isCheckpoint(run.level + 1) && run.level + 1 > prevBestLevel ? run.level + 1 : 0,
        };
        if (result.success) {
          view = 'LEVEL_COMPLETE';
        } else {
          view = 'GAME_OVER';
          this.leaderboard.submit('global', st.bestRun);
          this.leaderboard.submit('week', st.weekBest);
        }
      } else {
        const rec = this.daily.recordResult(run.date, result.money, result.success);
        data = Object.assign({ date: run.date, target: result.target, success: result.success, coins }, rec);
        view = 'DAILY_RESULT';
        this.leaderboard.submit('today', rec.best);
        if (rec.streakReward && rec.streakReward.bundle.claws) {
          this.toasts.show('ROYAL CLAW UNLOCKED!', '7-day streak reward — equip it in the shop.', 'claw');
        }
      }
      this.achievements.evaluate();
      this.save.flush();

      // Ending beat: a banner while the last coins land, then the results panel.
      const banners = { time: "TIME'S UP!", early: 'WELL DONE!', cleared: 'MINE CLEARED!' };
      this.fx.banner(banners[result.reason] || "TIME'S UP!", result.success ? '#ffd23f' : '#ff6b5f');
      this.audio.play(result.success ? 'levelComplete' : 'levelFail');
      this.mascot.setMood(result.success ? 'cheer' : 'sad');
      const delay = this.particles.reduced ? 500 : 1100;
      clearTimeout(this.resultTimer);
      this.resultTimer = setTimeout(() => {
        if (this.state !== 'PLAYING' || !this.session || !this.session.ended) return;
        data.affordable = this.economy.affordableUpgrades();
        data.goals = this.nextGoals();
        if (view === 'LEVEL_COMPLETE') this.overlays.renderComplete(data);
        else if (view === 'GAME_OVER') this.overlays.renderGameOver(data);
        else this.overlays.renderDaily(data);
        this.lastResult = data;
        this.setState(view);
        if (view === 'LEVEL_COMPLETE') {
          for (let i = 0; i < data.stars; i++) setTimeout(() => this.audio.play('star', { i }), 250 + i * 180);
          if (data.checkpoint) this.toasts.show('CHECKPOINT UNLOCKED', 'You can now start runs at level ' + data.checkpoint + '.', 'flame');
        }
      }, delay);
    }

    /** After a won level: offer 3 run perks, then continue. */
    nextLevel() {
      if (this.state !== 'LEVEL_COMPLETE') return;
      const offer = GR.Perks.offer(this.run.perks);
      if (!offer.length) return this.continueRun();
      this.perkOffer = offer;
      this.overlays.renderPerks(offer, this.run);
      this.setState('PERK_PICK');
    }

    pickPerk(id) {
      if (this.state !== 'PERK_PICK' || !GR.PERKS_BY_ID[id]) return;
      this.run.perks.push(id);
      this.perkOffer = null;
      this.audio.play('upgrade');
      this.missions.track('perk');
      this.continueRun();
    }

    continueRun() {
      this.run.level += 1;
      this.ads.showInterstitial('level_transition').then(() => this.startLevel());
    }

    /** "What's next" hints for result screens: closest mission + cheapest upgrade. */
    nextGoals() {
      const goals = {};
      const m = this.missions.closest();
      if (m) goals.mission = { text: this.missions.describe(m), progress: m.progress, goal: m.goal, coins: m.coins };
      let best = null;
      GR.UPGRADES.forEach((u) => {
        const price = this.economy.nextUpgradePrice(u.id);
        if (price !== null && (!best || price < best.price)) best = { name: u.name, level: this.economy.upgradeLevel(u.id) + 1, price };
      });
      if (best) goals.upgrade = Object.assign(best, { have: this.economy.coins });
      return goals;
    }

    playAgain() {
      if (!this.run) return this.goHome();
      if (this.run.mode === 'daily') return this.startDaily();
      const start = this.run.startLevel;
      this.ads.showInterstitial('play_again').then(() => this.startCampaign(start));
    }

    restartLevel() {
      if (!this.run) return;
      if (this.run.mode === 'daily') this.startDaily();
      else this.startLevel();
    }

    revive() {
      const run = this.run;
      if (!run || run.revived || this.state !== 'GAME_OVER') return;
      this.ads.showRewardedAd('revive').then((res) => {
        if (res !== 'success' || this.state !== 'GAME_OVER') return;
        run.revived = true;
        this.mascot.setMood('idle');
        this.session.revive(C.REVIVE_TIME);
        this.hud.banner('REVIVED!', '+' + C.REVIVE_TIME + ' seconds · keep digging');
        this.setState('PLAYING');
      });
    }

    doubleCoins(btn) {
      const run = this.run;
      if (!run || run.doubled) return;
      this.ads.showRewardedAd('double_coins').then((res) => {
        if (res !== 'success' || run.doubled) return;
        run.doubled = true;
        this.economy.addCoins(run.lastCoins, 'double');
        run.coins += run.lastCoins;
        this.audio.play('upgrade');
        btn.disabled = true;
        btn.innerHTML = GR.icon('check') + 'COINS DOUBLED <small>+' + GR.util.formatNumber(run.lastCoins) + '</small>';
      });
    }

    useBooster(id) {
      const s = this.session;
      if (!s || this.state !== 'PLAYING' || !s.boostersAllowed || s.ended) return;
      if (this.economy.boosterCount(id) <= 0) {
        this.audio.play('error');
        this.toasts.show('NO ' + GR.BOOSTERS_BY_ID[id].name.toUpperCase() + ' LEFT', 'Get more boosters in the shop.', GR.BOOSTERS_BY_ID[id].icon);
        return;
      }
      if (s.activateBooster(id)) this.economy.useBooster(id);
    }

    pause() {
      if (this.state !== 'PLAYING' || !this.session || this.session.ended) return false;
      this.overlays.renderPause();
      this.pushState('PAUSED');
      return true;
    }

    resume() {
      if (this.state !== 'PAUSED') return false;
      this.stateStack = ['PLAYING'];
      this.enter('PLAYING');
      return true;
    }

    goHome() {
      clearTimeout(this.resultTimer);
      this.session = null;
      this.run = null;
      this.fx.detach();
      this.particles.clear();
      this.startDemo();
      this.setState('MENU');
    }

    /** Attract mode: the autopilot plays quietly behind the home menu. */
    startDemo() {
      const level = GR.LevelGen.demo(this.newSeed());
      const events = new GR.EventBus();
      this.demo = new GR.GameSession({ level, events, infinite: true });
      this.demoBot = new GR.Autopilot(this.demo, { skill: 0.45, reaction: 0.15, aimNoise: 0.03, rng: new GR.RNG(Date.now()) });
      this.particles.clear();
      this.fx.attach(this.demo, { quiet: true });
      this.mascot.setMood('idle');
      this.particles.coinTarget = { x: 508, y: C.GROUND_Y - 40 };
    }

    // =====================================================================
    // Settings, cosmetics, sharing
    // =====================================================================

    toggleSetting(key) {
      const s = this.save.data.settings;
      s[key] = !s[key];
      this.save.save();
      this.applySettings();
      if (key === 'haptics' && s.haptics) this.vibrate(30);
    }

    applySettings() {
      const s = this.save.data.settings;
      this.audio.setSoundEnabled(s.sound);
      this.audio.setMusicEnabled(s.music && this.state !== 'PAUSED');
      this.particles.reduced = s.reducedMotion;
      document.documentElement.classList.toggle('reduced-motion', s.reducedMotion);
    }

    applyCosmetics() {
      const c = this.save.data.cosmetics;
      this.renderer.setTheme(c.equippedSkin);
      this.renderer.setClawSkin(c.equippedClaw);
      this.fx.theme = GR.MINE_SKINS_BY_ID[c.equippedSkin] || GR.MINE_SKINS_BY_ID.classic;
      document.documentElement.style.setProperty('--theme-accent', this.fx.theme.accent);
    }

    vibrate(ms) {
      if (this.save.data.settings.haptics && navigator.vibrate) {
        try {
          navigator.vibrate(ms);
        } catch (e) {
          /* unsupported */
        }
      }
    }

    shareBest() {
      this.shareText(GR.Share.bestText(this.save.data.stats.bestRun));
    }

    shareDaily() {
      const date = this.daily.today();
      this.shareText(GR.Share.dailyText(this.daily.bestFor(date), date, this.daily.currentStreak()));
    }

    shareText(text) {
      GR.Share.share(text).then((res) => {
        if (res === 'copied') this.toasts.show('COPIED TO CLIPBOARD', 'Paste it anywhere to challenge your friends.', 'share');
        else if (res === 'failed') this.toasts.show('COULD NOT SHARE', GR.util.escapeHtml(text), 'share');
      });
    }

    confirm(title, text, okLabel) {
      return this.overlays.confirm(title, text, okLabel);
    }

    resetProgress() {
      this.save.reset();
      window.location.reload();
    }

    // =====================================================================
    // Layout & loop
    // =====================================================================

    resize() {
      const vv = window.visualViewport;
      const vw = Math.floor(vv ? vv.width : window.innerWidth);
      const vh = Math.floor(vv ? vv.height : window.innerHeight);
      let w = vw;
      let h = vh;
      const aspect = vw / vh;
      if (aspect > C.ASPECT_MAX) w = Math.floor(vh * C.ASPECT_MAX);
      else if (aspect < C.ASPECT_MIN) h = Math.floor(vw / C.ASPECT_MIN);
      const st = this.stage.style;
      st.width = w + 'px';
      st.height = h + 'px';
      // UI scales with the stage; only tiny letterboxed stages (phone in landscape) go below 13px.
      st.fontSize = (w >= 320 ? GR.util.clamp(w / 25, 13, 22) : w / 25).toFixed(2) + 'px';
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.renderer.resize(w, h, dpr);
      if (this.session) requestAnimationFrame(() => (this.particles.coinTarget = this.hud.moneyAnchor(this.renderer)));
      // Paused frames are not redrawn by the loop, so draw one now.
      if (this.state === 'PAUSED' && this.session) this.renderer.render(this.session, this.particles, { dt: 0 });
    }

    loop(now) {
      requestAnimationFrame(this.loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (!(dt > 0)) dt = 0;
      dt = Math.min(dt, 0.05);

      const st = this.state;
      if (st === 'PLAYING' && this.session) {
        this.session.update(dt);
        this.fx.update(dt);
        this.particles.update(dt);
        this.hud.update(dt);
        this.renderer.render(this.session, this.particles, { dt, aimGuide: this.tutorialActive || this.aimGuide });
        if (!this.session.ended) this.audio.setIntensity(this.session.timeLeft <= 10 ? 2 : 1);
      } else if (st === 'MENU' && this.demo) {
        this.demoBot.update(dt);
        this.demo.update(dt);
        if (this.demo.objects.filter((o) => o.alive && o.kind !== 'rock' && o.kind !== 'tnt').length < 3) this.startDemo();
        this.fx.update(dt);
        this.particles.update(dt);
        this.renderer.render(this.demo, this.particles, { dt });
      } else if (RESULT_STATES[st] && this.session) {
        this.particles.update(dt);
        this.hud.update(dt);
        this.renderer.render(this.session, this.particles, { dt });
      }
    }
  }

  function boot() {
    try {
      new App();
    } catch (e) {
      console.error(e);
      const el = document.getElementById('boot-error');
      if (el) el.hidden = false;
    }
    // Offline cache. Sandboxed frames (embeds, game portals) may refuse service
    // workers or even throw on access, so this is strictly best-effort.
    try {
      if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      }
    } catch (e) {
      /* no offline cache here; the game still works */
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})((window.GR = window.GR || {}));
