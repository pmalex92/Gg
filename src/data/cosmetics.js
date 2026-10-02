/**
 * Cosmetics: mine skins (the whole underground palette) and claw skins.
 *
 * `cost` is { coins } or { tokens }. `source` marks items that cannot be
 * bought directly (streak rewards, future premium packs). `minLevel` gates an
 * item behind player level (shown as LOCKED in the shop).
 */
(function (GR) {
  'use strict';

  GR.MINE_SKINS = [
    {
      id: 'classic', name: 'Classic', cost: null,
      sky: ['#101a2b', '#2a2b3d'], stars: true, hills: '#171824',
      surface: '#6b4a2b', lip: '#8d6a3c', grass: '#4f6b2f',
      strata: ['#5a3d24', '#4b321e', '#3d2918', '#302013', '#24180e'],
      speck: '#7a5634', decor: 'roots', accent: '#8a6a3f', dust: '#c9a26b',
    },
    {
      id: 'ruby', name: 'Ruby', cost: { coins: 400 },
      sky: ['#1a0f1c', '#3a1a25'], stars: true, hills: '#22101a',
      surface: '#6a2a2e', lip: '#93424a', grass: '#5b2e3a',
      strata: ['#5c1f28', '#4c1822', '#3d131c', '#2f0e16', '#220a10'],
      speck: '#7e3340', decor: 'crystals', accent: '#ff4d6d', dust: '#ff9aa8',
    },
    {
      id: 'emerald', name: 'Emerald', cost: { coins: 600 },
      sky: ['#0b1a17', '#173229'], stars: true, hills: '#0e221c',
      surface: '#2f5a3c', lip: '#46805a', grass: '#5fa865',
      strata: ['#244634', '#1d3a2b', '#173023', '#11251b', '#0c1b13'],
      speck: '#356b4c', decor: 'crystals', accent: '#42e08b', dust: '#a6f0c4',
    },
    {
      id: 'gold', name: 'Gold Vein', cost: { coins: 900 }, minLevel: 3,
      sky: ['#1c1408', '#3b2a10'], stars: true, hills: '#241a0a',
      surface: '#8a6326', lip: '#b98a36', grass: '#7a7a2a',
      strata: ['#6e4f1f', '#5d4119', '#4c3514', '#3b290f', '#2b1e0b'],
      speck: '#a07a33', decor: 'veins', accent: '#ffcf4a', dust: '#ffe39a',
    },
    {
      id: 'ice', name: 'Ice Cave', cost: { coins: 1200 }, minLevel: 5,
      sky: ['#0a1626', '#1c3550'], stars: true, hills: '#10243a',
      surface: '#6f93b3', lip: '#b8dcf5', grass: '#e8f6ff',
      strata: ['#2e4d6b', '#26425d', '#1f364d', '#182a3d', '#111f2e'],
      speck: '#4d7397', decor: 'crystals', accent: '#9fe8ff', dust: '#dff6ff',
    },
    {
      id: 'lava', name: 'Lava Core', cost: { coins: 2000 }, minLevel: 8,
      sky: ['#140606', '#2e0f08'], stars: false, hills: '#1c0805',
      surface: '#3a2420', lip: '#5a3028', grass: '#ff6a1f',
      strata: ['#2d1a17', '#251512', '#1e100e', '#170c0a', '#110807'],
      speck: '#4a2a22', decor: 'cracks', accent: '#ff6a1f', dust: '#ffb066',
    },
    {
      id: 'cyber', name: 'Cyber', cost: { coins: 3000 }, minLevel: 12,
      sky: ['#07061a', '#1a0f3a'], stars: true, hills: '#110a2a',
      surface: '#26214f', lip: '#3b2f7a', grass: '#ff3df2',
      strata: ['#1b173d', '#161334', '#120f2b', '#0e0c22', '#0a0819'],
      speck: '#2a2560', decor: 'grid', accent: '#35f2ff', dust: '#9ef9ff',
    },
    {
      id: 'galaxy', name: 'Galaxy', cost: { tokens: 30 },
      sky: ['#05030f', '#170b2e'], stars: true, hills: '#0e0820',
      surface: '#2b1c4f', lip: '#4a2f80', grass: '#b78cff',
      strata: ['#221640', '#1c1236', '#170f2d', '#120b24', '#0d081b'],
      speck: '#3a2766', decor: 'stars', accent: '#d7b8ff', dust: '#e9dcff',
    },
    {
      id: 'sunset', name: 'Sunset Ridge', cost: null, source: 'pack:starter',
      sky: ['#2b1636', '#ff8a4c'], stars: false, hills: '#4a1f3a',
      surface: '#7a4a2a', lip: '#b0703c', grass: '#e0a040',
      strata: ['#6a3c25', '#5a321f', '#4a2919', '#3a2014', '#2a170e'],
      speck: '#8a5634', decor: 'veins', accent: '#ffb347', dust: '#ffd2a0',
    },
  ];

  GR.CLAW_SKINS = [
    {
      id: 'classic', name: 'Classic Claw', cost: null,
      metal: '#b8c0c8', dark: '#5d6570', accent: '#ffc531', cable: '#d9cdb8', style: 'classic',
    },
    {
      id: 'golden', name: 'Golden Claw', cost: { coins: 800 },
      metal: '#ffcf4a', dark: '#9a6510', accent: '#fff2b0', cable: '#ffe08a', style: 'classic',
    },
    {
      id: 'mechanical', name: 'Mechanical Claw', cost: { coins: 1800 }, minLevel: 6,
      metal: '#4a4f57', dark: '#22252a', accent: '#ff8a2a', cable: '#9aa0a8', style: 'mech',
    },
    {
      id: 'diamond', name: 'Diamond Claw', cost: { tokens: 40 },
      metal: '#bff4ff', dark: '#3a9cc4', accent: '#ffffff', cable: '#d8f8ff', style: 'crystal',
    },
    {
      id: 'royal', name: 'Royal Claw', cost: null, source: 'streak:7',
      metal: '#9b6bff', dark: '#3f2380', accent: '#ffcf4a', cable: '#e7d6ff', style: 'royal',
    },
  ];

  GR.MINE_SKINS_BY_ID = {};
  GR.MINE_SKINS.forEach((s) => (GR.MINE_SKINS_BY_ID[s.id] = s));
  GR.CLAW_SKINS_BY_ID = {};
  GR.CLAW_SKINS.forEach((s) => (GR.CLAW_SKINS_BY_ID[s.id] = s));
})((window.GR = window.GR || {}));
