/**
 * Economy: the two currencies (coins + premium tokens), upgrades, boosters,
 * cosmetics ownership and XP/player level. Everything that changes the wallet
 * goes through here so a future server-validated economy only has to replace
 * this one module.
 */
(function (GR) {
  'use strict';

  class Economy {
    constructor(saveManager, bus) {
      this.saveManager = saveManager;
      this.bus = bus;
    }

    get data() {
      return this.saveManager.data;
    }

    get coins() {
      return this.data.wallet.coins;
    }

    get tokens() {
      return this.data.wallet.tokens;
    }

    // ---- Currency -------------------------------------------------------

    addCoins(amount, source) {
      amount = Math.max(0, Math.round(amount));
      if (!amount) return 0;
      this.data.wallet.coins += amount;
      this.data.stats.totalCoinsEarned += amount;
      this.changed('coins', source);
      return amount;
    }

    addTokens(amount, source) {
      amount = Math.max(0, Math.round(amount));
      if (!amount) return 0;
      this.data.wallet.tokens += amount;
      this.changed('tokens', source);
      return amount;
    }

    canAfford(cost) {
      if (!cost) return true;
      if (cost.coins && this.coins < cost.coins) return false;
      if (cost.tokens && this.tokens < cost.tokens) return false;
      return true;
    }

    spend(cost) {
      if (!this.canAfford(cost)) return false;
      if (cost.coins) this.data.wallet.coins -= cost.coins;
      if (cost.tokens) this.data.wallet.tokens -= cost.tokens;
      this.changed('spend');
      return true;
    }

    /** Apply a reward bundle: { coins, tokens, skins, claws, boosters, noAds }. */
    grant(bundle, source) {
      if (!bundle) return;
      if (bundle.coins) this.addCoins(bundle.coins, source);
      if (bundle.tokens) this.addTokens(bundle.tokens, source);
      (bundle.skins || []).forEach((id) => this.unlockCosmetic('skin', id));
      (bundle.claws || []).forEach((id) => this.unlockCosmetic('claw', id));
      if (bundle.boosters) {
        Object.keys(bundle.boosters).forEach((id) => this.addBooster(id, bundle.boosters[id]));
      }
      if (bundle.noAds) this.data.ads.noAds = true;
      this.changed('grant', source);
    }

    // ---- Upgrades -------------------------------------------------------

    upgradeLevel(id) {
      return this.data.upgrades[id] || 0;
    }

    upgradeEffect(id) {
      const lvl = this.upgradeLevel(id);
      return lvl > 0 ? GR.UPGRADES_BY_ID[id].effects[lvl - 1] : 0;
    }

    nextUpgradePrice(id) {
      const lvl = this.upgradeLevel(id);
      const def = GR.UPGRADES_BY_ID[id];
      return lvl >= def.prices.length ? null : def.prices[lvl];
    }

    buyUpgrade(id) {
      const price = this.nextUpgradePrice(id);
      if (price === null || !this.spend({ coins: price })) return false;
      this.data.upgrades[id] += 1;
      this.data.stats.upgradesBought += 1;
      this.changed('upgrade', id);
      return true;
    }

    affordableUpgrades() {
      return GR.UPGRADES.filter((u) => {
        const p = this.nextUpgradePrice(u.id);
        return p !== null && p <= this.coins;
      }).length;
    }

    /** Gameplay modifiers derived from upgrades (Daily Challenge passes none). */
    clawStats() {
      return {
        retractMult: 1 + this.upgradeEffect('clawSpeed'),
        weightReduction: this.upgradeEffect('clawPower'),
        extraTime: this.upgradeEffect('timer'),
        grabBonus: this.upgradeEffect('magnet'),
        coinMult: 1 + this.upgradeEffect('coinMultiplier'),
      };
    }

    static baseClawStats() {
      return { retractMult: 1, weightReduction: 0, extraTime: 0, grabBonus: 0, coinMult: 1 };
    }

    // ---- Boosters -------------------------------------------------------

    boosterCount(id) {
      return this.data.boosters[id] || 0;
    }

    addBooster(id, n) {
      this.data.boosters[id] = (this.data.boosters[id] || 0) + n;
      this.changed('booster', id);
    }

    useBooster(id) {
      if (this.boosterCount(id) <= 0) return false;
      this.data.boosters[id] -= 1;
      this.changed('booster', id);
      return true;
    }

    buyBooster(id, bundle) {
      const def = GR.BOOSTERS_BY_ID[id];
      const price = bundle ? def.bundlePrice : def.price;
      if (!this.spend({ coins: price })) return false;
      this.addBooster(id, bundle ? 3 : 1);
      return true;
    }

    // ---- Cosmetics ------------------------------------------------------

    cosmeticList(kind) {
      return kind === 'skin' ? GR.MINE_SKINS : GR.CLAW_SKINS;
    }

    owns(kind, id) {
      const c = this.data.cosmetics;
      return (kind === 'skin' ? c.ownedSkins : c.ownedClaws).indexOf(id) >= 0;
    }

    unlockCosmetic(kind, id) {
      if (this.owns(kind, id)) return false;
      const c = this.data.cosmetics;
      (kind === 'skin' ? c.ownedSkins : c.ownedClaws).push(id);
      this.changed('cosmetic', id);
      return true;
    }

    /** OWNED / EQUIPPED / LOCKED / PURCHASE / EXCLUSIVE — drives the shop UI. */
    cosmeticState(kind, item) {
      const c = this.data.cosmetics;
      const equipped = kind === 'skin' ? c.equippedSkin : c.equippedClaw;
      if (equipped === item.id) return 'equipped';
      if (this.owns(kind, item.id)) return 'owned';
      if (item.source) return 'exclusive';
      if (item.minLevel && this.data.player.level < item.minLevel) return 'locked';
      return 'purchase';
    }

    buyCosmetic(kind, item) {
      if (this.cosmeticState(kind, item) !== 'purchase') return false;
      if (!this.spend(item.cost)) return false;
      this.unlockCosmetic(kind, item.id);
      this.equip(kind, item.id);
      return true;
    }

    equip(kind, id) {
      if (!this.owns(kind, id)) return false;
      if (kind === 'skin') this.data.cosmetics.equippedSkin = id;
      else this.data.cosmetics.equippedClaw = id;
      this.changed('equip', id);
      return true;
    }

    // ---- XP / player level ----------------------------------------------

    static xpForLevel(level) {
      return 100 + (level - 1) * 60;
    }

    /** Adds XP and returns an array of level-up rewards (possibly empty). */
    addXp(amount) {
      const p = this.data.player;
      p.xp += Math.max(0, Math.round(amount));
      const ups = [];
      while (p.xp >= Economy.xpForLevel(p.level)) {
        p.xp -= Economy.xpForLevel(p.level);
        p.level += 1;
        const reward = { coins: 50 + p.level * 25, tokens: p.level % 5 === 0 ? 2 : 0 };
        this.grant(reward, 'levelup');
        ups.push({ level: p.level, reward });
      }
      this.changed('xp');
      return ups;
    }

    changed(what, detail) {
      this.saveManager.save();
      this.bus.emit('economy', { what, detail });
    }
  }

  GR.Economy = Economy;
})((window.GR = window.GR || {}));
