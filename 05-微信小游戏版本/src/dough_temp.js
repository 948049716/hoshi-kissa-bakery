/**
 * Dough temperature state machine (v0.10 M1, direction A).
 *
 * Pure data + pure functions so the simulator, unit tests and game_app share one implementation.
 *
 *   cold     temp < warmMin            knead = base C1/C2 roll (flour mill C2 rate)
 *   warm     warmMin <= temp < max     C2 rate + warmC2Bonus; every pityEvery-th consecutive warm
 *                                      knead is guaranteed a C(pityTier) (flavored on flavor levels)
 *   overheat temp >= overheat          this knead only yields C1, button locks lockSec, temp resets
 *
 * Cooling is exponential (decayRate × temp) plus a small flat term, which makes a steady tapping
 * rhythm of ~0.3–0.6 s settle inside the warm band while 0.12 s mashing overheats in ~0.6 s.
 */
'use strict';

const BalanceConfig = require('./balance_config');

function cfg() {
  return BalanceConfig.DOUGH_TEMP;
}

function createDoughTemp() {
  return {
    temp: 0,
    locked: false,
    lockTimer: 0,
    lockDuration: 0,
    warmStreak: 0,
    overheats: 0,
    warmKneads: 0,
    pityHits: 0
  };
}

function getZone(st) {
  if (!st) return 'cold';
  if (st.locked) return 'locked';
  const c = cfg();
  if (st.temp >= c.warmMin) return 'warm';
  return 'cold';
}

/** 0..1 ratio for HUD arcs (locked shows full red). */
function getTempRatio(st) {
  if (!st) return 0;
  if (st.locked) return 1;
  const c = cfg();
  return Math.max(0, Math.min(1, st.temp / Math.max(1, c.overheat)));
}

function tickDoughTemp(st, dt) {
  if (!st) return;
  const d = Number(dt);
  if (!Number.isFinite(d) || d <= 0) return;
  const c = cfg();
  if (st.locked) {
    st.lockTimer = Math.max(0, st.lockTimer - d);
    if (st.lockTimer <= 1e-9) {
      st.locked = false;
      st.lockTimer = 0;
      st.temp = Math.min(c.overheat - 1, c.resetTo);
    }
    return;
  }
  const rate = Math.max(0, Number(c.decayRate) || 0);
  const flat = Math.max(0, Number(c.decayFlat) || 0);
  st.temp = Math.max(0, st.temp * Math.exp(-rate * d) - flat * d);
}

/**
 * Registers one knead press.
 * @param {object} st state from createDoughTemp()
 * @param {object} [opts] { failStreak, inFever }
 * @returns {{allowed:boolean, zone:string, c2Bonus:number, forceTier:number|null,
 *            pity:boolean, overheated:boolean, reason?:string}}
 */
function onKnead(st, opts) {
  const c = cfg();
  const o = opts || {};
  if (!st) {
    return { allowed: true, zone: 'cold', c2Bonus: 0, forceTier: null, pity: false, overheated: false };
  }
  if (st.locked) {
    return {
      allowed: false,
      zone: 'locked',
      c2Bonus: 0,
      forceTier: null,
      pity: false,
      overheated: false,
      reason: 'overheat_locked'
    };
  }
  if (o.inFever) {
    // 热潮揉面：温度冻结，不升温也不计保底
    return { allowed: true, zone: 'fever', c2Bonus: 0, forceTier: null, pity: false, overheated: false };
  }

  st.temp += c.perKnead;
  if (st.temp >= c.overheat) {
    const pityLock = Math.max(0, Math.floor(Number(o.failStreak) || 0)) >= 2;
    st.locked = true;
    st.lockDuration = pityLock ? c.lockSecPity : c.lockSec;
    st.lockTimer = st.lockDuration;
    st.temp = c.overheat;
    st.warmStreak = 0;
    st.overheats += 1;
    return { allowed: true, zone: 'overheat', c2Bonus: 0, forceTier: 1, pity: false, overheated: true };
  }

  if (st.temp >= c.warmMin) {
    st.warmStreak += 1;
    st.warmKneads += 1;
    const every = Math.max(1, Math.floor(c.pityEvery));
    if (st.warmStreak >= every) {
      st.warmStreak = 0;
      st.pityHits += 1;
      return { allowed: true, zone: 'warm', c2Bonus: c.warmC2Bonus, forceTier: c.pityTier, pity: true, overheated: false };
    }
    return { allowed: true, zone: 'warm', c2Bonus: c.warmC2Bonus, forceTier: null, pity: false, overheated: false };
  }

  st.warmStreak = 0;
  return { allowed: true, zone: 'cold', c2Bonus: 0, forceTier: null, pity: false, overheated: false };
}

module.exports = {
  createDoughTemp,
  getZone,
  getTempRatio,
  tickDoughTemp,
  onKnead
};
