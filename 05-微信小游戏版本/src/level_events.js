/**
 * Mid-Shift Level Events Engine (v0.11 M2, direction C).
 *
 * Data-driven event catalog + pure deterministic scheduler (uses the dedicated eventRng stream).
 * At most 1 event is active at a time; 1..3 events are scheduled across [25%, 75%] of shift time.
 *
 * Events:
 *   1. critic_visit  (Ch.1-5+) : 15s, next serve gets +0.50 scene bonus
 *   2. flour_sale    (Ch.1-3+) : next 5 kneads guaranteed C2
 *   3. hot_oven      (Ch.2+)   : 8s, fresh window doubled (2.0x)
 *   4. frost_snap    (Ch.3+)   : 3s warning, then freezes up to 2 non-frozen tiles
 *   5. delivery_rush (Ch.2+)   : next spawned customer gets patience x0.7, bounty x1.4
 */
'use strict';

const EVENT_CATALOG = Object.freeze({
  critic_visit: Object.freeze({
    id: 'critic_visit',
    name: '美食家到访',
    desc: '15秒内下一单得分+50%',
    minChapter: 1,
    minIndex: 5,
    durationSec: 15.0,
    sceneBonus: 0.50,
    tone: 'gold'
  }),
  flour_sale: Object.freeze({
    id: 'flour_sale',
    name: '原料特价',
    desc: '接下来5次揉面必出C2',
    minChapter: 1,
    minIndex: 3,
    durationSec: 18.0,
    charges: 5,
    forceTier: 2,
    tone: 'warm'
  }),
  hot_oven: Object.freeze({
    id: 'hot_oven',
    name: '热风烤盘',
    desc: '8秒内热乎时间双倍',
    minChapter: 2,
    minIndex: 1,
    durationSec: 8.0,
    freshMult: 2.0,
    tone: 'warm'
  }),
  frost_snap: Object.freeze({
    id: 'frost_snap',
    name: '冰霜将至',
    desc: '3秒后冻住2块猫饼',
    minChapter: 3,
    minIndex: 1,
    durationSec: 3.0,
    freezeCount: 2,
    tone: 'ice'
  }),
  delivery_rush: Object.freeze({
    id: 'delivery_rush',
    name: '快送急单',
    desc: '下一单限时快送：赏金×1.4',
    minChapter: 2,
    minIndex: 1,
    durationSec: 16.0,
    patienceMult: 0.7,
    bountyMult: 1.4,
    tone: 'gold'
  })
});

function getEligibleEvents(levelCfg) {
  const ch = Number(levelCfg && levelCfg.chapter) || 1;
  const idx = Number(levelCfg && levelCfg.indexInChapter) || 1;
  const keys = Object.keys(EVENT_CATALOG);
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    const def = EVENT_CATALOG[keys[i]];
    if (ch > def.minChapter || (ch === def.minChapter && idx >= def.minIndex)) {
      out.push(def);
    }
  }
  return out;
}

function createEventState(levelCfg, rngFn, opts) {
  const rng = typeof rngFn === 'function' ? rngFn : Math.random;
  const o = opts || {};
  const enabled = o.enabled !== false;
  const durationSec = Math.max(30, Number(levelCfg && levelCfg.durationSec) || 90);
  const eligible = enabled ? getEligibleEvents(levelCfg) : [];
  const schedule = [];

  if (eligible.length > 0 && o.disableSchedule !== true) {
    const ch = Number(levelCfg && levelCfg.chapter) || 1;
    const count = Array.isArray(o.forcedEvents)
      ? o.forcedEvents.length
      : ch === 1
      ? (Number(levelCfg && levelCfg.indexInChapter) >= 5 ? 2 : 1)
      : ch === 2
      ? 2
      : 3;
    const spanStart = durationSec * 0.25;
    const spanEnd = durationSec * 0.75;
    const slotLen = (spanEnd - spanStart) / Math.max(1, count);
    let lastId = null;
    for (let i = 0; i < count; i++) {
      let def = null;
      if (Array.isArray(o.forcedEvents)) {
        const fid = o.forcedEvents[i];
        def = typeof fid === 'string' ? EVENT_CATALOG[fid] : EVENT_CATALOG[fid && fid.id];
      } else {
        const pool = eligible.length > 1 ? eligible.filter((e) => e.id !== lastId) : eligible;
        def = pool[Math.floor(rng() * pool.length) % pool.length];
      }
      if (!def) continue;
      lastId = def.id;
      const explicitAt =
        Array.isArray(o.forcedEvents) && o.forcedEvents[i] && Number.isFinite(o.forcedEvents[i].atSec)
          ? o.forcedEvents[i].atSec
          : null;
      const triggerAtSec =
        explicitAt !== null
          ? explicitAt
          : +(spanStart + slotLen * i + rng() * Math.min(8, slotLen * 0.45)).toFixed(2);
      schedule.push({ id: def.id, triggerAtSec, fired: false });
    }
    schedule.sort((a, b) => a.triggerAtSec - b.triggerAtSec);
  }

  return {
    schedule,
    active: null,
    seen: [],
    pendingDeliveryRider: false
  };
}

function startEventById(st, id, nowSec) {
  const def = EVENT_CATALOG[id];
  if (!st || !def) return null;
  st.active = {
    id: def.id,
    name: def.name,
    desc: def.desc,
    tone: def.tone,
    startedAtSec: Number.isFinite(nowSec) ? nowSec : 0,
    timer: def.durationSec,
    duration: def.durationSec,
    chargesLeft: Number.isFinite(def.charges) ? def.charges : 0,
    consumed: false
  };
  if (def.id === 'delivery_rush') {
    st.pendingDeliveryRider = true;
  }
  st.seen.push(def.id);
  return st.active;
}

/**
 * Steps active event timer and fires scheduled events.
 * Returns { started, ended, frostTrigger } for game_app / simulator to react to.
 */
function tickEvents(st, dt, elapsedSec) {
  const out = { started: null, ended: null, frostTrigger: 0 };
  if (!st) return out;
  const d = Number(dt);
  if (!Number.isFinite(d) || d <= 0) return out;

  if (st.active) {
    st.active.timer = Math.max(0, st.active.timer - d);
    if (st.active.timer <= 1e-9 || st.active.consumed) {
      const finished = st.active;
      st.active = null;
      out.ended = finished;
      if (finished.id === 'frost_snap' && !finished.consumed) {
        out.frostTrigger = EVENT_CATALOG.frost_snap.freezeCount;
      }
      if (finished.id === 'delivery_rush') {
        st.pendingDeliveryRider = false;
      }
    }
  }

  if (!st.active && Array.isArray(st.schedule)) {
    const now = Number(elapsedSec) || 0;
    for (let i = 0; i < st.schedule.length; i++) {
      const entry = st.schedule[i];
      if (!entry.fired && now >= entry.triggerAtSec) {
        entry.fired = true;
        out.started = startEventById(st, entry.id, now);
        break;
      }
    }
  }
  return out;
}

function getEventSceneBonus(st) {
  if (!st || !st.active || st.active.id !== 'critic_visit' || st.active.consumed) return 0;
  return EVENT_CATALOG.critic_visit.sceneBonus;
}

function consumeServeEvent(st) {
  if (!st || !st.active || st.active.id !== 'critic_visit' || st.active.consumed) return false;
  st.active.consumed = true;
  st.active.timer = 0;
  return true;
}

function consumeKneadEvent(st) {
  if (!st || !st.active || st.active.id !== 'flour_sale' || st.active.chargesLeft <= 0) return null;
  st.active.chargesLeft -= 1;
  if (st.active.chargesLeft <= 0) {
    st.active.consumed = true;
    st.active.timer = 0;
  }
  return { forceTier: EVENT_CATALOG.flour_sale.forceTier, chargesLeft: st.active.chargesLeft };
}

function getFreshWindowMultiplier(st) {
  if (!st || !st.active || st.active.id !== 'hot_oven' || st.active.consumed) return 1.0;
  return EVENT_CATALOG.hot_oven.freshMult;
}

function consumeDeliveryRider(st) {
  if (!st || !st.pendingDeliveryRider) return null;
  st.pendingDeliveryRider = false;
  if (st.active && st.active.id === 'delivery_rush') {
    st.active.consumed = true;
    st.active.timer = 0;
  }
  return {
    patienceMult: EVENT_CATALOG.delivery_rush.patienceMult,
    bountyMult: EVENT_CATALOG.delivery_rush.bountyMult
  };
}

module.exports = {
  EVENT_CATALOG,
  getEligibleEvents,
  createEventState,
  startEventById,
  tickEvents,
  getEventSceneBonus,
  consumeServeEvent,
  consumeKneadEvent,
  getFreshWindowMultiplier,
  consumeDeliveryRider
};
