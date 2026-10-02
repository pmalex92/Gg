/**
 * Permanent upgrades bought with coins. Each has 5 levels; `effects[i]` is the
 * value at upgrade level i+1 and `prices[i]` is the cost to reach it.
 * The coin economy is tuned so a full set is reachable in a few hours of play.
 */
(function (GR) {
  'use strict';

  GR.UPGRADES = [
    {
      id: 'clawSpeed', name: 'Claw Speed', icon: 'bolt',
      desc: 'The reel pulls everything up faster.',
      effects: [0.05, 0.1, 0.15, 0.2, 0.3],
      format: (v) => '+' + Math.round(v * 100) + '% reel speed',
      prices: [100, 260, 560, 1100, 2000],
    },
    {
      id: 'clawPower', name: 'Claw Power', icon: 'muscle',
      desc: 'Heavy rocks and bars feel lighter.',
      effects: [0.1, 0.2, 0.3, 0.4, 0.5],
      format: (v) => '-' + Math.round(v * 100) + '% weight',
      prices: [120, 300, 650, 1250, 2200],
    },
    {
      id: 'coinMultiplier', name: 'Coin Multiplier', icon: 'coins',
      desc: 'Earn more coins from every round.',
      effects: [0.1, 0.2, 0.3, 0.45, 0.6],
      format: (v) => '+' + Math.round(v * 100) + '% coins',
      prices: [150, 380, 800, 1600, 3000],
    },
    {
      id: 'timer', name: 'Extra Time', icon: 'clock',
      desc: 'Start every level with more time.',
      effects: [2, 4, 6, 8, 10],
      format: (v) => '+' + v + ' seconds',
      prices: [120, 300, 650, 1250, 2200],
    },
    {
      id: 'magnet', name: 'Magnet Claw', icon: 'magnet',
      desc: 'A wider grab radius catches near misses.',
      effects: [4, 8, 12, 16, 22],
      format: (v) => '+' + Math.round((v / 16) * 100) + '% grab radius',
      prices: [100, 260, 560, 1100, 2000],
    },
  ];

  GR.UPGRADES_BY_ID = {};
  GR.UPGRADES.forEach((u) => (GR.UPGRADES_BY_ID[u.id] = u));
})((window.GR = window.GR || {}));
