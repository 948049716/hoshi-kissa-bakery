/**
 * Level Goal State Machine (v0.11 M2, direction C).
 *
 * Pure data + pure functions shared by game_app, sim_balance and unit tests.
 * Supports 7 goal types:
 *   - 'score'         : classic score-only shift (goal always satisfied; 1★ score clears)
 *   - 'ice_clear'     : shatter all frozen tiles on the board
 *   - 'centerpiece'   : serve a VIP customer an order containing tier >= target
 *   - 'serve_count'   : serve >= target orders
 *   - 'combo'         : reach maxCombo >= target
 *   - 'hot_serve'     : serve >= target all-hot orders
 *   - 'limited_knead' : knead budget cap (kneadsUsed <= target); exceeding is blocked
 *
 * Rules (agreed plan):
 *   - Goal gates clearing: goal unmet -> 0 stars, cleared = false.
 *   - Stars remain score-based (preserving 18/40★ chapter gates & stardust economy).
 *   - earlyClose: when true and goal completes (with ordersServed >= 1 and projected score >= star1),
 *     shift closes immediately and awards earlyCloseBonus = round(timeLeft * 40 * chapterFactor),
 *     recorded at settlement (separate from serve score).
 */
'use strict';

const BalanceConfig = require('./balance_config');

const CHAPTER_EARLY_CLOSE_FACTORS = Object.freeze({ 1: 1.0, 2: 1.8, 3: 3.0 });

function normalizeGoalSpec(rawGoal, initialIceCount) {
  const g = rawGoal && typeof rawGoal === 'object' ? rawGoal : null;
  const type = g && typeof g.type === 'string' ? g.type : 'score';
  let target = g && Number.isFinite(Number(g.target)) ? Math.max(0, Math.floor(Number(g.target))) : 0;
  if (type === 'ice_clear' && target <= 0) {
    target = Math.max(1, Math.floor(Number(initialIceCount) || 0));
  }
  const earlyClose =
    type !== 'score' && type !== 'limited_knead' && Boolean(g && g.earlyClose);
  const requireVip = Boolean(g && g.requireVip);
  return { type, target, earlyClose, requireVip };
}

function createGoalState(rawGoal, ctx) {
  const initialIce = Math.max(0, Math.floor(Number(ctx && ctx.initialIce) || 0));
  const spec = normalizeGoalSpec(rawGoal, initialIce);
  const done = spec.type === 'score' || spec.type === 'limited_knead';
  return {
    type: spec.type,
    target: spec.target,
    earlyClose: spec.earlyClose,
    requireVip: spec.requireVip,
    progress: 0,
    initialIce,
    remainingIce: initialIce,
    kneadsUsed: 0,
    done,
    completedAtSec: null
  };
}

function isGoalActive(st) {
  return Boolean(st && st.type && st.type !== 'score');
}

function canKneadUnderGoal(st) {
  if (!st || st.type !== 'limited_knead') return true;
  return st.kneadsUsed < st.target;
}

function getKneadsRemaining(st) {
  if (!st || st.type !== 'limited_knead') return Infinity;
  return Math.max(0, st.target - st.kneadsUsed);
}

function markDoneIfReady(st, nowSec) {
  if (!st || st.done) return false;
  if (st.type === 'ice_clear') {
    if (st.remainingIce <= 0 && (st.initialIce > 0 || st.progress >= st.target)) {
      st.done = true;
      st.completedAtSec = Number.isFinite(nowSec) ? nowSec : 0;
      return true;
    }
    return false;
  }
  if (st.progress >= st.target && st.target > 0) {
    st.done = true;
    st.completedAtSec = Number.isFinite(nowSec) ? nowSec : 0;
    return true;
  }
  return false;
}

function onIceCountChanged(st, remainingIce, nowSec) {
  if (!st || st.type !== 'ice_clear') return false;
  const rem = Math.max(0, Math.floor(Number(remainingIce) || 0));
  st.remainingIce = rem;
  st.progress = Math.max(st.progress, Math.max(0, st.initialIce - rem));
  return markDoneIfReady(st, nowSec);
}

function onServeForGoal(st, ev, nowSec) {
  if (!st || !ev) return false;
  if (st.type === 'serve_count') {
    st.progress += 1;
    return markDoneIfReady(st, nowSec);
  }
  if (st.type === 'combo') {
    const combo = Math.max(0, Math.floor(Number(ev.comboCount) || 0));
    if (combo > st.progress) st.progress = combo;
    return markDoneIfReady(st, nowSec);
  }
  if (st.type === 'hot_serve') {
    if (ev.allHot) {
      st.progress += 1;
      return markDoneIfReady(st, nowSec);
    }
    return false;
  }
  if (st.type === 'centerpiece') {
    const isVip = Boolean(ev.isVip || ev.customerId === 'cust_critic');
    if (st.requireVip && !isVip) return false;
    let maxTier = Math.max(0, Math.floor(Number(ev.maxTier) || 0));
    if (maxTier === 0 && Array.isArray(ev.usedTiles)) {
      for (let i = 0; i < ev.usedTiles.length; i++) {
        const t = ev.usedTiles[i];
        if (t && Number(t.tier) > maxTier) maxTier = Number(t.tier);
      }
    }
    if (maxTier >= st.target) {
      st.progress = st.target;
      return markDoneIfReady(st, nowSec);
    }
    return false;
  }
  return false;
}

function onKneadForGoal(st) {
  if (!st) return false;
  st.kneadsUsed += 1;
  if (st.type === 'limited_knead') {
    st.progress = st.kneadsUsed;
    st.done = st.kneadsUsed <= st.target;
  }
  return false;
}

function computeEarlyCloseBonus(timeLeftSec, chapter) {
  const tl = Math.max(0, Number(timeLeftSec) || 0);
  if (tl <= 0) return 0;
  const cfg = (BalanceConfig && BalanceConfig.GOALS) || {};
  const perSec = Number.isFinite(cfg.earlyClosePerSec) ? cfg.earlyClosePerSec : 40;
  const factors = cfg.earlyCloseChapterFactors || CHAPTER_EARLY_CLOSE_FACTORS;
  const ch = Number(chapter) || 1;
  const fac = Number.isFinite(factors[ch]) ? factors[ch] : 1.0;
  const raw = Math.round(tl * perSec * fac);
  const cap = Number.isFinite(cfg.earlyCloseCap) ? cfg.earlyCloseCap : 20000;
  return Math.max(0, Math.min(cap, raw));
}

function shouldTriggerEarlyClose(st, opts) {
  if (!st || !st.earlyClose || !st.done) return false;
  const o = opts || {};
  const ordersServed = Math.max(0, Math.floor(Number(o.ordersServed) || 0));
  if (ordersServed < 1) return false;
  const elapsedSec = o.elapsedSec === undefined ? 3 : Number(o.elapsedSec) || 0;
  if (elapsedSec < 3) return false;
  const score = Math.max(0, Number(o.score) || 0);
  const star1 = Math.max(0, Number(o.star1) || 0);
  const star3 = Math.max(0, Number(o.star3) || 0);
  const threshold = star3 > 0 ? star3 : star1;
  const bonus = computeEarlyCloseBonus(o.timeLeft, o.chapter);
  return score + bonus >= threshold;
}

function formatGoalBadge(st) {
  if (!st || !isGoalActive(st)) return null;
  if (st.type === 'ice_clear') {
    return {
      title: '破冰目标',
      text: st.done ? '冰块已清' : `破冰 ${Math.min(st.progress, st.target)}/${st.target}`,
      done: st.done,
      ratio: st.target > 0 ? Math.min(1, st.progress / st.target) : 1
    };
  }
  if (st.type === 'centerpiece') {
    return {
      title: '星冠大单',
      text: st.done ? '大单已献' : `献上C${st.target}+`,
      done: st.done,
      ratio: st.done ? 1 : 0
    };
  }
  if (st.type === 'serve_count') {
    return {
      title: '出餐目标',
      text: `上菜 ${Math.min(st.progress, st.target)}/${st.target}`,
      done: st.done,
      ratio: st.target > 0 ? Math.min(1, st.progress / st.target) : 1
    };
  }
  if (st.type === 'combo') {
    return {
      title: '连击目标',
      text: `连击 ${Math.min(st.progress, st.target)}/${st.target}`,
      done: st.done,
      ratio: st.target > 0 ? Math.min(1, st.progress / st.target) : 1
    };
  }
  if (st.type === 'hot_serve') {
    return {
      title: '热乎目标',
      text: `热乎 ${Math.min(st.progress, st.target)}/${st.target}`,
      done: st.done,
      ratio: st.target > 0 ? Math.min(1, st.progress / st.target) : 1
    };
  }
  if (st.type === 'limited_knead') {
    const rem = getKneadsRemaining(st);
    return {
      title: '限次揉面',
      text: `揉面余 ${rem}/${st.target}`,
      done: st.done,
      ratio: st.target > 0 ? Math.min(1, rem / st.target) : 1
    };
  }
  return null;
}

module.exports = {
  CHAPTER_EARLY_CLOSE_FACTORS,
  normalizeGoalSpec,
  createGoalState,
  isGoalActive,
  canKneadUnderGoal,
  getKneadsRemaining,
  onIceCountChanged,
  onServeForGoal,
  onKneadForGoal,
  computeEarlyCloseBonus,
  shouldTriggerEarlyClose,
  formatGoalBadge
};
