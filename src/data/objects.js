/**
 * Collectible definitions. Everything the level generator can place lives
 * here, so adding a new object is a data change plus a sprite painter in
 * sprites.js (keyed by `sprite`).
 *
 *  value    – base $ value (instances scale it with their size)
 *  weight   – slows the reel while retrieving (see CONFIG.CLAW.weightFactor)
 *  radius   – base collision radius in world units
 *  kind     – gold | gem | rock | mystery | tnt | critter | relic
 *  minLevel – first campaign level it can appear on
 */
(function (GR) {
  'use strict';

  GR.OBJECTS = {
    small_gold: {
      id: 'small_gold', name: 'Small Gold', value: 50, weight: 1, radius: 22,
      rarity: 'common', kind: 'gold', sprite: 'nugget', minLevel: 1, scalable: true,
    },
    large_gold: {
      id: 'large_gold', name: 'Large Gold', value: 150, weight: 3, radius: 40,
      rarity: 'common', kind: 'gold', sprite: 'nugget', minLevel: 1, scalable: true,
    },
    gold_bar: {
      id: 'gold_bar', name: 'Gold Bar', value: 300, weight: 5, radius: 31,
      rarity: 'uncommon', kind: 'gold', sprite: 'bar', minLevel: 1,
    },
    diamond: {
      id: 'diamond', name: 'Diamond', value: 500, weight: 1, radius: 17,
      rarity: 'rare', kind: 'gem', sprite: 'diamond', minLevel: 1,
    },
    red_gem: {
      id: 'red_gem', name: 'Red Gem', value: 750, weight: 1, radius: 17,
      rarity: 'rare', kind: 'gem', sprite: 'ruby', minLevel: 4,
    },
    small_rock: {
      id: 'small_rock', name: 'Small Rock', value: 10, weight: 3, radius: 27,
      rarity: 'common', kind: 'rock', sprite: 'rock', minLevel: 1, scalable: true,
    },
    large_rock: {
      id: 'large_rock', name: 'Large Rock', value: 5, weight: 8, radius: 46,
      rarity: 'common', kind: 'rock', sprite: 'boulder', minLevel: 1, scalable: true,
    },
    mystery_bag: {
      id: 'mystery_bag', name: 'Mystery Bag', value: 0, weight: 3, radius: 26,
      rarity: 'uncommon', kind: 'mystery', sprite: 'bag', minLevel: 1,
    },
    tnt: {
      id: 'tnt', name: 'TNT', value: 0, weight: 0, radius: 25,
      rarity: 'uncommon', kind: 'tnt', sprite: 'tnt', minLevel: 3,
      behaviour: 'explode',
    },
    crab: {
      id: 'crab', name: 'Cave Crab', value: 60, weight: 1.5, radius: 22,
      rarity: 'uncommon', kind: 'critter', sprite: 'crab', minLevel: 7,
      behaviour: 'walk', gemCarrierChance: 0.4, gemBonus: 500,
    },
    relic: {
      id: 'relic', name: 'Ancient Relic', value: 1000, weight: 4, radius: 28,
      rarity: 'epic', kind: 'relic', sprite: 'relic', minLevel: 12,
    },
  };

  /**
   * Mystery bag outcomes (picked with a seeded RNG so the Daily Challenge
   * stays identical for everyone).
   */
  GR.MYSTERY_OUTCOMES = [
    { id: 'small_cash', weight: 34, money: [40, 160] },
    { id: 'big_cash', weight: 22, money: [250, 600] },
    { id: 'jackpot', weight: 5, money: [1000, 1000] },
    { id: 'booster', weight: 22 },
    { id: 'time', weight: 9, seconds: 8 },
    { id: 'strength', weight: 8 },
  ];
})((window.GR = window.GR || {}));
