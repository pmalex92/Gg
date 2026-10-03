/**
 * Global tuning values. Gameplay works in a fixed logical "world" of
 * 720 x 1200 units; the renderer scales it to the screen. Taller phones simply
 * reveal more sky above the world, so level layouts (and the Daily Challenge)
 * play identically on every device.
 */
(function (GR) {
  'use strict';

  GR.CONFIG = {
    VERSION: '1.2.1',
    SAVE_KEY: 'goldrush.save',

    WORLD_W: 720,
    WORLD_H: 1200,
    /** Playable aspect range (width / height). Outside it the stage letterboxes. */
    ASPECT_MIN: 0.45,
    ASPECT_MAX: 0.6,

    GROUND_Y: 262,
    PIVOT: { x: 360, y: 214 },
    /** Area where collectibles can spawn (keeps clear of the rig and booster bar). */
    FIELD: { x0: 30, x1: 690, y0: 345, y1: 1090 },
    /** Claw is considered lost once it leaves these bounds. */
    BOUNDS: { x0: -10, x1: 730, y1: 1190 },

    CLAW: {
      restLength: 54,
      maxAngle: 1.27, // ~73 degrees each side
      swingSpeed: 1.75, // radians of phase per second at level 1
      tipRadius: 16,
      extendSpeed: 1020,
      extendStartSpeed: 620,
      extendAccel: 5200,
      retractBase: 880,
      emptyRetract: 1300,
      weightFactor: 0.34, // higher = heavy objects slow the reel more
      grabPause: 0.08, // tiny "clamp" hit-stop when an object is grabbed
    },

    LEVEL_TIME: 60,
    REVIVE_TIME: 15,

    COMBO: { bonusPerStep: 0.1, maxStep: 6 },

    ECONOMY: {
      moneyToCoins: 0.1, // $10 collected = 1 coin
      levelBonusBase: 20,
      levelBonusPerLevel: 5,
      starBonus: 15,
      earlyFinishCoinsPerSecond: 1,
    },

    TNT: { radius: 150, payout: 0.5, chainDelay: 0.14 },

    STARS: [1, 1.4, 1.8], // multiples of the target for 1/2/3 stars

    CHECKPOINT_EVERY: 5,

    /** Rewarded ads / interstitial pacing (placeholders until a provider is wired in). */
    ADS: {
      interstitialEveryRounds: 3,
      interstitialMinSeconds: 120,
      freeRewardsPerDay: 3, // per kind: free token, free booster
    },

    /**
     * Optional audio files that replace synthesised sounds, e.g.
     * { coin: 'audio/coin.mp3' } (see audio/README.md). Empty = all synthesised.
     */
    AUDIO_SAMPLES: {},

    /** Leaderboard backend. 'local' = offline preview with mock rivals. */
    LEADERBOARD: { provider: 'local', restBaseUrl: '' },
  };
})((window.GR = window.GR || {}));
