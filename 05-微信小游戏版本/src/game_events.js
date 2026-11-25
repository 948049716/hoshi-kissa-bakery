/**
 * Tiny synchronous event bus for per-run gameplay hooks.
 *
 * game_app emits gameplay facts (slide / knead / serve / fever / customer / tick ...);
 * goals, in-level events, customer traits, run perks and telemetry subscribe instead of
 * being hard-wired into game_app's executeX flows. Listener errors are isolated so a
 * buggy hook can never break the core loop.
 *
 * Event names (payload documented in docs/07):
 *   'run:start' 'run:end' 'slide' 'knead' 'tray:place' 'serve' 'fever:start' 'fever:end' 'crit'
 *   'customer:spawn' 'customer:leave' 'tick' 'event:start' 'event:end' 'goal:progress' 'goal:done'
 */
'use strict';

function createEventBus() {
  const map = new Map();
  let errorCount = 0;

  function on(name, fn) {
    if (typeof fn !== 'function') return () => {};
    let list = map.get(name);
    if (!list) {
      list = [];
      map.set(name, list);
    }
    list.push(fn);
    return () => off(name, fn);
  }

  function off(name, fn) {
    const list = map.get(name);
    if (!list) return;
    const idx = list.indexOf(fn);
    if (idx >= 0) list.splice(idx, 1);
  }

  function emit(name, payload) {
    const list = map.get(name);
    if (!list || list.length === 0) return 0;
    const snapshot = list.slice();
    for (let i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (err) {
        errorCount += 1;
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn(`[game_events] listener for "${name}" threw:`, err && err.message ? err.message : err);
        }
      }
    }
    return snapshot.length;
  }

  function clear() {
    map.clear();
  }

  function listenerCount(name) {
    const list = map.get(name);
    return list ? list.length : 0;
  }

  return {
    on,
    off,
    emit,
    clear,
    listenerCount,
    get errorCount() {
      return errorCount;
    }
  };
}

module.exports = { createEventBus };
