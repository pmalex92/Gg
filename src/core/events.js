/**
 * Minimal publish/subscribe bus. Gameplay logic emits events ("grab",
 * "deliver", "explode"...) and the audio, particle and UI layers react, which
 * keeps the simulation free of any rendering or DOM code.
 */
(function (GR) {
  'use strict';

  class EventBus {
    constructor() {
      this.handlers = new Map();
    }

    on(name, fn) {
      if (!this.handlers.has(name)) this.handlers.set(name, []);
      this.handlers.get(name).push(fn);
      return () => this.off(name, fn);
    }

    off(name, fn) {
      const list = this.handlers.get(name);
      if (!list) return;
      const i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    }

    emit(name, data) {
      const list = this.handlers.get(name);
      if (!list) return;
      for (let i = 0; i < list.length; i++) list[i](data);
    }
  }

  GR.EventBus = EventBus;
  GR.bus = new EventBus(); // app-wide bus (economy, achievements, UI toasts)
})((window.GR = window.GR || {}));
