/**
 * Future premium products. Nothing here is purchasable in the MVP — the shop
 * shows them as "coming soon" and PurchaseManager refuses to process real
 * payments. The `grants` blocks are what a store integration would hand to
 * Economy.grant() after a verified purchase.
 */
(function (GR) {
  'use strict';

  GR.PRODUCTS = [
    {
      sku: 'starter_pack', name: 'Starter Pack', price: '€0.99', tag: 'BEST VALUE',
      lines: ['1,000 coins', 'Exclusive Sunset Ridge skin', '1 of every booster'],
      grants: { coins: 1000, skins: ['sunset'], boosters: { magnet: 1, frenzy: 1, freeze: 1, double: 1 } },
    },
    {
      sku: 'miner_pack', name: 'Miner Pack', price: '€2.99',
      lines: ['5,000 coins', '3 mine skins', '5 boosters'],
      grants: { coins: 5000, skins: ['gold', 'lava', 'cyber'], boosters: { magnet: 2, frenzy: 1, freeze: 1, double: 1 } },
    },
    {
      sku: 'no_ads', name: 'No Ads', price: '€4.99',
      lines: ['Removes interstitial ads forever', 'Rewarded bonuses stay optional'],
      grants: { noAds: true },
    },
  ];
})((window.GR = window.GR || {}));
