/**
 * Consumable boosters. Bought in the shop, used from the in-game booster bar
 * (or keys 1-4). Disabled in the Daily Challenge so everyone competes on the
 * same terms.
 */
(function (GR) {
  'use strict';

  GR.BOOSTERS = [
    {
      id: 'magnet', name: 'Magnet', icon: 'magnet', duration: 10, color: '#5ab4ff', key: '1',
      desc: '10s — the claw pulls in nearby gold and gems.',
      price: 120, bundlePrice: 300,
    },
    {
      id: 'frenzy', name: 'Frenzy', icon: 'bolt', duration: 8, color: '#ff8a2a', key: '2',
      desc: '8s — hyper-fast claw and triple coins per catch.',
      price: 150, bundlePrice: 380,
    },
    {
      id: 'freeze', name: 'Time Freeze', icon: 'snow', duration: 6, color: '#9fe8ff', key: '3',
      desc: '6s — the timer stops completely.',
      price: 130, bundlePrice: 330,
    },
    {
      id: 'double', name: 'Double Value', icon: 'x2', duration: 10, color: '#ffd23f', key: '4',
      desc: '10s — everything you grab is worth 2x.',
      price: 160, bundlePrice: 400,
    },
  ];

  GR.BOOSTERS_BY_ID = {};
  GR.BOOSTERS.forEach((b) => (GR.BOOSTERS_BY_ID[b.id] = b));
})((window.GR = window.GR || {}));
