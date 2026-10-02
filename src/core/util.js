/**
 * GOLD RUSH — shared helpers.
 *
 * Every module attaches itself to the global `GR` namespace. Plain (non-module)
 * scripts are used on purpose so the game also runs when index.html is opened
 * straight from disk (file://), where ES modules are blocked by browsers.
 */
(function (GR) {
  'use strict';

  const numberFormat = new Intl.NumberFormat('en-US');

  const util = {
    clamp(v, min, max) {
      return v < min ? min : v > max ? max : v;
    },

    lerp(a, b, t) {
      return a + (b - a) * t;
    },

    /** Frame-rate independent exponential smoothing factor. */
    damp(rate, dt) {
      return 1 - Math.exp(-rate * dt);
    },

    easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    },

    easeOutBack(t) {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },

    formatNumber(n) {
      return numberFormat.format(Math.round(n));
    },

    formatMoney(n) {
      return '$' + numberFormat.format(Math.round(n));
    },

    formatTime(seconds) {
      const s = Math.max(0, Math.ceil(seconds));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    },

    /** Local calendar date as YYYY-MM-DD (the Daily Challenge key). */
    dateKey(date) {
      const d = date || new Date();
      const m = d.getMonth() + 1;
      const day = d.getDate();
      return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
    },

    /** Whole days from keyA to keyB (both YYYY-MM-DD). */
    daysBetween(keyA, keyB) {
      const a = util.parseDateKey(keyA);
      const b = util.parseDateKey(keyB);
      return Math.round((b - a) / 86400000);
    },

    parseDateKey(key) {
      const p = key.split('-');
      // Noon avoids DST edge cases when diffing days.
      return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0).getTime();
    },

    /** ISO week key, e.g. 2026-W40 (used for the weekly leaderboard). */
    weekKey(date) {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
      return d.getUTCFullYear() + '-W' + (week < 10 ? '0' : '') + week;
    },

    prettyDate(key) {
      const d = new Date(util.parseDateKey(key));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    },

    /** Deep merge `src` into a copy of `defaults` (save migration helper). */
    mergeDefaults(defaults, src) {
      if (Array.isArray(defaults)) return Array.isArray(src) ? src.slice() : defaults.slice();
      if (defaults === null || typeof defaults !== 'object') return src === undefined ? defaults : src;
      const out = {};
      const keys = new Set(Object.keys(defaults).concat(src && typeof src === 'object' ? Object.keys(src) : []));
      keys.forEach((k) => {
        const dv = defaults[k];
        const sv = src ? src[k] : undefined;
        if (dv !== undefined && dv !== null && typeof dv === 'object' && !Array.isArray(dv)) {
          out[k] = util.mergeDefaults(dv, sv && typeof sv === 'object' ? sv : {});
        } else if (sv === undefined) {
          out[k] = Array.isArray(dv) ? dv.slice() : dv;
        } else {
          out[k] = sv;
        }
      });
      return out;
    },

    escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
    },

    isCoarsePointer() {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    },
  };

  GR.util = util;
})((window.GR = window.GR || {}));
