/**
 * Input: tap / click anywhere on the playfield, plus keyboard shortcuts.
 *
 *   SPACE / ENTER  launch (or confirm on result screens)
 *   ESC / P        pause / resume
 *   R              play again after game over
 *   1-4            boosters
 *
 * Also blocks the browser behaviours that ruin touch games: scrolling,
 * pinch/double-tap zoom, long-press menus and text selection.
 */
(function (GR) {
  'use strict';

  class Input {
    constructor(stage, handlers) {
      this.stage = stage;
      this.h = handlers;

      stage.addEventListener('pointerdown', (e) => {
        this.h.onGesture();
        if (e.button !== undefined && e.button > 0) return;
        if (e.target.closest('button, a, input, label, select, textarea, .screen, .overlay, [data-noinput]')) return;
        e.preventDefault();
        this.h.onTap();
      });

      window.addEventListener('keydown', (e) => {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        this.h.onGesture();
        const k = e.key;
        if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
          if (this.h.onPrimary(e)) e.preventDefault();
        } else if (k === 'Escape' || k === 'p' || k === 'P') {
          if (this.h.onPause(e)) e.preventDefault();
        } else if (k === 'r' || k === 'R') {
          if (!e.metaKey && !e.ctrlKey && this.h.onRestart()) e.preventDefault();
        } else if (k >= '1' && k <= '4') {
          this.h.onBooster(+k - 1);
        }
      });

      // Older iOS only unlocks Web Audio from touchend/click, not pointerdown.
      document.addEventListener('touchend', () => this.h.onGesture(), { passive: true });
      document.addEventListener('click', () => this.h.onGesture());

      // No pinch zoom / double-tap zoom / overscroll on the game surface.
      ['gesturestart', 'gesturechange', 'dblclick'].forEach((n) =>
        document.addEventListener(n, (e) => e.preventDefault(), { passive: false })
      );
      stage.addEventListener(
        'touchmove',
        (e) => {
          if (!e.target.closest('.scroll, .panel')) e.preventDefault();
        },
        { passive: false }
      );
      stage.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  GR.Input = Input;
})((window.GR = window.GR || {}));
