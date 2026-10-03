/**
 * Worlds: the campaign changes scenery automatically every 10 levels. Each
 * world has its own palette, skyline, ambient particles and critter (the
 * moving treasure-carrier that replaces the cave crab), then the cycle
 * repeats. Mine skins from the shop still dress the home screen and the
 * Daily Challenge.
 *
 *   Worlds.forLevel(n)   -> world definition for campaign level n
 *   Worlds.index(n)      -> 0-based world number (keeps counting past the cycle)
 */
(function (GR) {
  'use strict';

  const LEVELS_PER_WORLD = 10;
  const skin = (id, extra) => Object.assign({}, GR.MINE_SKINS_BY_ID[id], extra);

  GR.WORLDS = [
    {
      id: 'gold_hills', name: 'Gold Hills', critter: 'crab', critterName: 'cave crabs',
      intro: 'Where every miner starts.',
      theme: skin('classic', { id: 'w-gold-hills', skyline: 'hills', ambient: 'dust' }),
    },
    {
      id: 'frozen_caves', name: 'Frozen Caves', critter: 'penguin', critterName: 'penguins',
      intro: 'Penguins slide by with gems. Grab them!',
      theme: skin('ice', {
        id: 'w-frozen', skyline: 'peaks', ambient: 'snow', decor: 'icicles',
        sky: ['#0b1a2e', '#2a4a6a'], grass: '#f2fbff',
      }),
    },
    {
      id: 'lava_depths', name: 'Lava Depths', critter: 'salamander', critterName: 'fire salamanders',
      intro: 'Hot rocks, hotter gems. Mind the salamanders.',
      theme: skin('lava', { id: 'w-lava', skyline: 'volcano', ambient: 'embers', sky: ['#1a0705', '#4a140a'] }),
    },
    {
      id: 'jungle_ruins', name: 'Jungle Ruins', critter: 'frog', critterName: 'treasure frogs',
      intro: 'Ancient ruins and hopping frogs.',
      theme: skin('emerald', {
        id: 'w-jungle', skyline: 'jungle', ambient: 'fireflies', decor: 'vines',
        sky: ['#0a1f19', '#1e4a37'],
      }),
    },
    {
      id: 'desert_tomb', name: 'Desert Tomb', critter: 'scorpion', critterName: 'scorpions',
      intro: 'Pharaoh gold lies under the dunes.',
      theme: skin('sunset', {
        id: 'w-desert', skyline: 'pyramids', ambient: 'sand',
        sky: ['#3a1d3e', '#f29a4a'], surface: '#b07a3e', lip: '#d8a456', grass: '#c9a24a',
        strata: ['#9a6a36', '#86592c', '#704a24', '#5a3a1c', '#432a14'], speck: '#b8854a',
      }),
    },
    {
      id: 'cosmic_rift', name: 'Cosmic Rift', critter: 'alien', critterName: 'space blobs',
      intro: 'The mine broke through to space.',
      theme: skin('galaxy', { id: 'w-cosmic', skyline: 'planets', ambient: 'stars', moon: false }),
    },
  ];
  GR.WORLDS_BY_ID = {};
  GR.WORLDS.forEach((w) => (GR.WORLDS_BY_ID[w.id] = w));

  GR.Worlds = {
    LEVELS_PER_WORLD,

    index(level) {
      return Math.floor((Math.max(1, level) - 1) / LEVELS_PER_WORLD);
    },

    forLevel(level) {
      return GR.WORLDS[GR.Worlds.index(level) % GR.WORLDS.length];
    },

    /** True on the first level of a world (where the intro banner shows). */
    isWorldStart(level) {
      return (level - 1) % LEVELS_PER_WORLD === 0;
    },
  };
})((window.GR = window.GR || {}));
