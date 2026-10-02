/**
 * AdManager — the only place gameplay code talks to "ads".
 *
 * Gameplay calls:
 *   AdManager.isRewardedAdAvailable()
 *   AdManager.showRewardedAd(placement[, callback])  -> Promise<'success' | 'failure'>
 *   AdManager.shouldShowInterstitial()
 *   AdManager.showInterstitial(placement)            -> Promise<void>
 *
 * A provider implements { rewardedAvailable(), showRewarded(placement),
 * showInterstitial(placement) }. The MVP uses DevAdProvider: rewarded ads are
 * a short simulated countdown the player starts themselves; interstitials are
 * a silent no-op (add ?ads=demo to the URL to see placeholder screens).
 * A real network (AdSense H5, AppLixir, CrazyGames/Poki SDK...) only needs a
 * new provider object — no gameplay changes.
 */
(function (GR) {
  'use strict';

  class DevAdProvider {
    constructor(presenter, showInterstitialPlaceholder) {
      this.presenter = presenter; // UI hook that renders the simulated ad
      this.showPlaceholder = showInterstitialPlaceholder;
    }

    rewardedAvailable() {
      return true;
    }

    showRewarded(placement) {
      return this.presenter({ kind: 'rewarded', placement, seconds: 3 });
    }

    showInterstitial(placement) {
      if (!this.showPlaceholder) {
        console.info('[ads] interstitial placeholder (no real ads in this build):', placement);
        return Promise.resolve(true);
      }
      return this.presenter({ kind: 'interstitial', placement, seconds: 2 });
    }
  }

  class AdManager {
    constructor(saveManager, config) {
      this.saveManager = saveManager;
      this.config = config;
      this.provider = null;
      this.busy = false;
    }

    setProvider(provider) {
      this.provider = provider;
    }

    isRewardedAdAvailable() {
      return !!this.provider && !this.busy && this.provider.rewardedAvailable();
    }

    /** Always player-initiated. Resolves 'success' only if the reward was earned. */
    showRewardedAd(placement, callback) {
      if (!this.isRewardedAdAvailable()) {
        const r = Promise.resolve('failure');
        if (callback) r.then(callback);
        return r;
      }
      this.busy = true;
      GR.bus.emit('ad', { phase: 'start', placement });
      const result = this.provider
        .showRewarded(placement)
        .then((ok) => (ok ? 'success' : 'failure'))
        .catch(() => 'failure')
        .then((res) => {
          this.busy = false;
          GR.bus.emit('ad', { phase: 'end', placement, result: res });
          return res;
        });
      if (callback) result.then(callback);
      return result;
    }

    /** Call when a round finishes (level complete or game over). */
    onRoundCompleted() {
      this.saveManager.data.ads.roundsSinceInterstitial += 1;
      this.saveManager.save();
    }

    /** Interstitials only after several rounds and a minimum gap — never every round. */
    shouldShowInterstitial() {
      const ads = this.saveManager.data.ads;
      if (ads.noAds || !this.provider) return false;
      if (ads.roundsSinceInterstitial < this.config.interstitialEveryRounds) return false;
      return Date.now() - ads.lastInterstitialAt > this.config.interstitialMinSeconds * 1000;
    }

    showInterstitial(placement) {
      if (!this.shouldShowInterstitial()) return Promise.resolve(false);
      const ads = this.saveManager.data.ads;
      ads.roundsSinceInterstitial = 0;
      ads.lastInterstitialAt = Date.now();
      this.saveManager.save();
      GR.bus.emit('ad', { phase: 'start', placement });
      return this.provider
        .showInterstitial(placement)
        .catch(() => false)
        .then(() => {
          GR.bus.emit('ad', { phase: 'end', placement });
          return true;
        });
    }

    /** Free rewards via opt-in rewarded ads ('token' | 'booster'), capped per day. */
    freeRewardsLeft(kind) {
      const ads = this.saveManager.data.ads;
      const used = ads.freeDate === GR.util.dateKey() ? ads.freeUsed[kind] || 0 : 0;
      return Math.max(0, this.config.freeRewardsPerDay - used);
    }

    consumeFreeReward(kind) {
      const ads = this.saveManager.data.ads;
      const today = GR.util.dateKey();
      if (ads.freeDate !== today) {
        ads.freeDate = today;
        ads.freeUsed = {};
      }
      ads.freeUsed[kind] = (ads.freeUsed[kind] || 0) + 1;
      this.saveManager.save();
    }
  }

  GR.AdManager = AdManager;
  GR.DevAdProvider = DevAdProvider;
})((window.GR = window.GR || {}));
