/**
 * Achievements are pure data: `progress(save)` reads lifetime stats from the
 * save file and the achievement unlocks once it reaches `goal`. That keeps
 * them trivially serialisable and lets the UI show progress bars for free.
 */
(function (GR) {
  'use strict';

  const s = (save) => save.stats;

  GR.ACHIEVEMENTS = [
    { id: 'first_dig', name: 'First Dig', desc: 'Collect your first gold.', goal: 1,
      progress: (v) => s(v).goldCollected, reward: { coins: 25 } },
    { id: 'big_haul', name: 'Big Haul', desc: 'Earn $5,000 in one round.', goal: 5000,
      progress: (v) => s(v).bestRoundMoney, reward: { coins: 300 }, money: true },
    { id: 'diamond_hands', name: 'Diamond Hands', desc: 'Collect 10 diamonds.', goal: 10,
      progress: (v) => s(v).diamonds, reward: { coins: 200 } },
    { id: 'no_rocks', name: 'No Rocks', desc: 'Complete a level without collecting a rock.', goal: 1,
      progress: (v) => s(v).cleanLevels, reward: { coins: 100 } },
    { id: 'gold_fever', name: 'Gold Fever', desc: 'Earn 100,000 total coins.', goal: 100000,
      progress: (v) => s(v).totalCoinsEarned, reward: { coins: 1000, tokens: 5 } },
    { id: 'combo_king', name: 'Combo King', desc: 'Reach a COMBO ×5.', goal: 5,
      progress: (v) => s(v).bestCombo, reward: { coins: 150 } },
    { id: 'demolition', name: 'Demolition Expert', desc: 'Blow up 10 TNT.', goal: 10,
      progress: (v) => s(v).tntExploded, reward: { coins: 150 } },
    { id: 'crab_wrangler', name: 'Crab Wrangler', desc: 'Catch 5 cave crabs.', goal: 5,
      progress: (v) => s(v).crabs, reward: { coins: 150 } },
    { id: 'deep_digger', name: 'Deep Digger', desc: 'Reach level 10.', goal: 10,
      progress: (v) => s(v).bestLevel, reward: { coins: 300 } },
    { id: 'veteran', name: 'Veteran Miner', desc: 'Reach level 20.', goal: 20,
      progress: (v) => s(v).bestLevel, reward: { tokens: 3 } },
    { id: 'relic_hunter', name: 'Relic Hunter', desc: 'Find an ancient relic.', goal: 1,
      progress: (v) => s(v).relics, reward: { coins: 250 } },
    { id: 'lucky_bag', name: 'Lucky Dipper', desc: 'Open 10 mystery bags.', goal: 10,
      progress: (v) => s(v).bags, reward: { coins: 150 } },
    { id: 'perfectionist', name: 'Perfectionist', desc: 'Earn 3 stars on a level.', goal: 1,
      progress: (v) => s(v).threeStarLevels, reward: { coins: 100 } },
    { id: 'daily_digger', name: 'Daily Digger', desc: 'Complete 3 Daily Challenges.', goal: 3,
      progress: (v) => s(v).dailyCompleted, reward: { tokens: 2 } },
    { id: 'on_fire', name: 'On Fire', desc: 'Reach a 7-day streak.', goal: 7,
      progress: (v) => v.daily.bestStreak, reward: { tokens: 5 } },
    { id: 'tinkerer', name: 'Tinkerer', desc: 'Buy your first upgrade.', goal: 1,
      progress: (v) => s(v).upgradesBought, reward: { coins: 50 } },
    { id: 'maxed_out', name: 'Maxed Out', desc: 'Fully upgrade anything.', goal: 5,
      progress: (v) => Math.max.apply(null, Object.values(v.upgrades)), reward: { coins: 500 } },
    { id: 'collector', name: 'Style Miner', desc: 'Own 3 mine skins.', goal: 3,
      progress: (v) => v.cosmetics.ownedSkins.length, reward: { coins: 200 } },
  ];
})((window.GR = window.GR || {}));
