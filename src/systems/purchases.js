/**
 * PurchaseManager — architecture for future premium packs.
 *
 * A store provider implements { isAvailable(), purchase(sku) -> Promise<{ ok, reason }> }.
 * After a *verified* purchase, PurchaseManager applies the product's `grants`
 * through Economy.grant(). The MVP ships with NoStoreProvider, which never
 * takes payment. With ?dev=1 in the URL a simulated store is used so the grant
 * flow can be tested end to end.
 */
(function (GR) {
  'use strict';

  class NoStoreProvider {
    isAvailable() {
      return false;
    }

    purchase() {
      return Promise.resolve({ ok: false, reason: 'Payments are not enabled in this version.' });
    }
  }

  class DevStoreProvider {
    isAvailable() {
      return true;
    }

    purchase(sku) {
      console.info('[purchases] simulated purchase of', sku);
      return Promise.resolve({ ok: true });
    }
  }

  class PurchaseManager {
    constructor(saveManager, economy, devMode) {
      this.saveManager = saveManager;
      this.economy = economy;
      this.provider = devMode ? new DevStoreProvider() : new NoStoreProvider();
    }

    isAvailable() {
      return this.provider.isAvailable();
    }

    owns(sku) {
      return this.saveManager.data.purchases.owned.indexOf(sku) >= 0;
    }

    buy(sku) {
      const product = GR.PRODUCTS.find((p) => p.sku === sku);
      if (!product) return Promise.resolve({ ok: false, reason: 'Unknown product.' });
      return this.provider.purchase(sku).then((res) => {
        if (res.ok) {
          this.economy.grant(product.grants, 'purchase:' + sku);
          this.saveManager.data.purchases.owned.push(sku);
          this.saveManager.save();
        }
        return res;
      });
    }
  }

  GR.PurchaseManager = PurchaseManager;
})((window.GR = window.GR || {}));
