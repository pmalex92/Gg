/**
 * Deterministic random numbers.
 *
 * The level generator only ever uses these seeded generators (never
 * Math.random) so a seed string such as "daily-2026-10-02" always produces the
 * exact same level for every player.
 */
(function (GR) {
  'use strict';

  /** cyrb53 string hash -> 32-bit unsigned integer. */
  function hashString(str) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h1 ^ h2) >>> 0;
  }

  class RNG {
    constructor(seed) {
      this.state = (typeof seed === 'string' ? hashString(seed) : seed >>> 0) || 1;
    }

    static fromString(str) {
      return new RNG(hashString(str));
    }

    /** mulberry32: float in [0, 1). */
    next() {
      let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    range(min, max) {
      return min + (max - min) * this.next();
    }

    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    }

    chance(p) {
      return this.next() < p;
    }

    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }

    /** Pick a key from a { key: weight } table. */
    weighted(table) {
      let total = 0;
      for (const k in table) total += Math.max(0, table[k]);
      if (total <= 0) return null;
      let r = this.next() * total;
      for (const k in table) {
        r -= Math.max(0, table[k]);
        if (r < 0) return k;
      }
      return Object.keys(table)[0];
    }

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    }
  }

  RNG.hashString = hashString;
  GR.RNG = RNG;
})((window.GR = window.GR || {}));
