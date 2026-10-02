/**
 * Tiny DOM helpers shared by the menu screens. Menus are rendered from
 * template strings when opened (never during gameplay) and use event
 * delegation via data-action attributes.
 */
(function (GR) {
  'use strict';

  const dom = {
    $(sel, root) {
      return (root || document).querySelector(sel);
    },

    $$(sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },

    /** Calls handlers[action](el, event) for clicks on [data-action] inside root. */
    delegate(root, handlers) {
      root.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || !root.contains(el) || el.disabled) return;
        const fn = handlers[el.dataset.action];
        if (fn) {
          e.preventDefault();
          fn(el, e);
        }
      });
    },

    show(el, on) {
      if (!el) return;
      el.classList.toggle('is-open', !!on);
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    },

    money: GR.util.formatMoney,
    num: GR.util.formatNumber,

    /** Coin / token price label. */
    price(cost) {
      if (!cost) return 'FREE';
      if (cost.tokens) return GR.icon('token', 'cur') + dom.num(cost.tokens);
      return GR.icon('coin', 'cur') + dom.num(cost.coins);
    },

    rewardLabel(bundle) {
      const parts = [];
      if (bundle.coins) parts.push(GR.icon('coin', 'cur') + dom.num(bundle.coins));
      if (bundle.tokens) parts.push(GR.icon('token', 'cur') + dom.num(bundle.tokens));
      if (bundle.claws && bundle.claws.length) parts.push(GR.icon('claw', 'cur') + 'Royal Claw');
      return parts.join(' ');
    },
  };

  /** Toast notifications (achievements, level ups, copies). Up to 3 stack at once. */
  class Toasts {
    constructor(root) {
      this.root = root;
      this.queue = [];
      this.active = 0;
    }

    show(title, sub, icon) {
      this.queue.push({ title, sub, icon });
      this.pump();
    }

    pump() {
      while (this.active < 3 && this.queue.length) this.display(this.queue.shift());
    }

    display(item) {
      this.active++;
      const el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.innerHTML =
        (item.icon ? GR.icon(item.icon) : '') +
        '<div><strong>' + GR.util.escapeHtml(item.title) + '</strong>' +
        (item.sub ? '<span>' + item.sub + '</span>' : '') + '</div>';
      this.root.appendChild(el);
      requestAnimationFrame(() => el.classList.add('in'));
      const life = this.queue.length ? 1500 : 2300; // move faster through a backlog
      setTimeout(() => {
        el.classList.remove('in');
        setTimeout(() => {
          el.remove();
          this.active--;
          this.pump();
        }, 250);
      }, life);
    }
  }

  GR.dom = dom;
  GR.Toasts = Toasts;
})((window.GR = window.GR || {}));
