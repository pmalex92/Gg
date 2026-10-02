/**
 * Score sharing: Web Share API where supported, clipboard otherwise, and a
 * last-resort hidden textarea copy for old browsers / file:// pages.
 */
(function (GR) {
  'use strict';

  function gameUrl() {
    const loc = window.location;
    return /^https?:$/.test(loc.protocol) ? loc.origin + loc.pathname : '';
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  const Share = {
    bestText(score) {
      return 'I scored ' + GR.util.formatMoney(score) + ' in Gold Rush. Can you beat me? ⛏️';
    },

    dailyText(score, dateKey, streak) {
      let t = 'Gold Rush Daily Challenge ' + GR.util.prettyDate(dateKey) + ': ' + GR.util.formatMoney(score) + ' ⛏️';
      if (streak > 1) t += ' 🔥' + streak + '-day streak';
      return t + '. Can you beat me?';
    },

    /** Resolves to 'shared' | 'copied' | 'failed' | 'cancelled'. */
    share(text) {
      const url = gameUrl();
      if (navigator.share) {
        return navigator
          .share({ title: 'Gold Rush', text, url: url || undefined })
          .then(() => 'shared')
          .catch((e) => (e && e.name === 'AbortError' ? 'cancelled' : Share.copy(text, url)));
      }
      return Share.copy(text, url);
    },

    copy(text, url) {
      const full = url ? text + ' ' + url : text;
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard
          .writeText(full)
          .then(() => 'copied')
          .catch(() => (legacyCopy(full) ? 'copied' : 'failed'));
      }
      return Promise.resolve(legacyCopy(full) ? 'copied' : 'failed');
    },
  };

  GR.Share = Share;
})((window.GR = window.GR || {}));
