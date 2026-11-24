/**
 * 3-Seat Customer Wave, Serving Tray Multiset Matcher, Combo/Fever & Sole Scoring Engine
 * for Hoshi Kissa Bakery v2.0 (WeChat Mini Game Edition).
 * Zero DOM/Canvas/WeChat dependencies; deterministic with injectable RNG.
 */
'use strict';

const {
  getCatcakePrice,
  FLAVORS,
  COMBO_SIZE_MULTS,
  SERVE_COMBO_MULTS,
  SERVE_COMBO_WINDOW_SEC,
  PATIENCE_TIP_BANDS,
  FEVER_CONFIG,
  CUSTOMER_MAP,
  normalizePatronId
} = require('./constants');

const {
  RECIPES,
  getLevelById
} = require('./levels_data');

const EPS = 1e-9;
const CLOSING_GUARD_SEC = 8.0;
const SEAT_COUNT = 3;
const MAX_ORDER_SLOTS = 8;
const MAX_TRAY_SLOTS = 8;
const MAX_LIST_CAP = 64;

const OWN = Object.prototype.hasOwnProperty;

const VALID_FLAVORS = Object.assign(Object.create(null), {
  plain: true,
  matcha: true,
  berry: true,
  gold: true
});

const VALID_REQ_FLAVORS = Object.assign(Object.create(null), {
  any: true,
  matcha: true,
  berry: true
});

const TEAPOT_PATIENCE_BONUSES = [0, 0.12, 0.24, 0.38];

const REGULAR_CUSTOMER_IDS = [
  'cust_ragdoll',
  'cust_orange',
  'cust_silver',
  'cust_rabbit',
  'cust_raccoon',
  'cust_shiba'
];

function safeIsArray(x) {
  try {
    return Array.isArray(x);
  } catch (_) {
    return false;
  }
}

function safeIsFrozen(x) {
  if (!x || (typeof x !== 'object' && typeof x !== 'function')) return true;
  try {
    return Object.isFrozen(x);
  } catch (_) {
    return true;
  }
}

function safeIsExtensible(x) {
  if (!x || (typeof x !== 'object' && typeof x !== 'function')) return false;
  try {
    return Object.isExtensible(x);
  } catch (_) {
    return false;
  }
}

function hasOwn(obj, key) {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object' && typeof obj !== 'function') return false;
  try {
    return OWN.call(obj, key);
  } catch (_) {
    return false;
  }
}

function getOwn(obj, key, fallback) {
  if (!hasOwn(obj, key)) return fallback;
  try {
    return obj[key];
  } catch (_) {
    return fallback;
  }
}

function readOwnPropOnce(obj, key) {
  if (!hasOwn(obj, key)) {
    return { exists: false, value: undefined, threw: false };
  }
  try {
    return { exists: true, value: obj[key], threw: false };
  } catch (_) {
    return { exists: true, value: undefined, threw: true };
  }
}

function isPlainObj(x) {
  if (x === null || typeof x !== 'object' || safeIsArray(x)) return false;
  try {
    OWN.call(x, '__probe__');
    return true;
  } catch (_) {
    return false;
  }
}

function safeArrayLen(arr, maxCap) {
  if (!safeIsArray(arr)) return 0;
  try {
    const raw = arr.length;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return 0;
    return typeof maxCap === 'number' && maxCap >= 0 ? Math.min(raw, maxCap) : raw;
  } catch (_) {
    return 0;
  }
}

function safePush(arr) {
  if (!safeIsArray(arr) || safeIsFrozen(arr)) return 0;
  for (let i = 1; i < arguments.length; i++) {
    const idx = safeArrayLen(arr);
    try {
      Object.defineProperty(arr, idx, {
        __proto__: null,
        value: arguments[i],
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (_) {
      return safeArrayLen(arr);
    }
  }
  return safeArrayLen(arr);
}

function safeSetIdx(arr, idx, val) {
  if (!safeIsArray(arr) || safeIsFrozen(arr)) return false;
  try {
    if (hasOwn(arr, idx)) {
      arr[idx] = val;
      return true;
    }
    if (!safeIsExtensible(arr)) return false;
    Object.defineProperty(arr, idx, {
      __proto__: null,
      value: val,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (_) {
    return false;
  }
}

function canMutateProp(obj, key) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj)) return false;
  try {
    if (hasOwn(obj, key)) {
      const desc = Object.getOwnPropertyDescriptor(obj, key);
      if (!desc) return false;
      if (hasOwn(desc, 'writable')) return desc.writable === true;
      return typeof desc.set === 'function';
    }
    return safeIsExtensible(obj);
  } catch (_) {
    return false;
  }
}

function setOwnProp(obj, key, val) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj)) return false;
  const normVal = typeof val === 'number' && val === 0 ? 0 : val;
  try {
    if (hasOwn(obj, key)) {
      obj[key] = normVal;
      return true;
    }
    if (!safeIsExtensible(obj)) return false;
    Object.defineProperty(obj, key, {
      __proto__: null,
      value: normVal,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (_) {
    return false;
  }
}

function verifiedWriteProp(obj, key, val) {
  const normVal = typeof val === 'number' && val === 0 ? 0 : val;
  if (!setOwnProp(obj, key, normVal)) return false;
  const rb = readOwnPropOnce(obj, key);
  if (!rb.exists || rb.threw) return false;
  const actual = rb.value;
  if (typeof actual === 'number' && actual === 0 && normVal === 0) return true;
  return Object.is(actual, normVal);
}

function restorePropSnapshot(obj, key, prevRead) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj) || !prevRead) return false;
  if (!prevRead.exists) {
    if (hasOwn(obj, key)) {
      try {
        delete obj[key];
        return !hasOwn(obj, key);
      } catch (_) {
        return false;
      }
    }
    return true;
  }
  if (prevRead.threw) return false;
  const origVal = prevRead.value;
  setOwnProp(obj, key, origVal);
  const rb = readOwnPropOnce(obj, key);
  if (
    rb.exists &&
    !rb.threw &&
    (Object.is(rb.value, origVal) ||
      (typeof rb.value === 'number' && rb.value === 0 && origVal === 0))
  ) {
    return true;
  }
  try {
    Object.defineProperty(obj, key, {
      __proto__: null,
      value: origVal,
      writable: true,
      enumerable: true,
      configurable: true
    });
    const rb2 = readOwnPropOnce(obj, key);
    return (
      rb2.exists &&
      !rb2.threw &&
      (Object.is(rb2.value, origVal) ||
        (typeof rb2.value === 'number' && rb2.value === 0 && origVal === 0))
    );
  } catch (_) {
    return false;
  }
}

function readOrderStateArrays(state) {
  if (!isPlainObj(state)) return null;
  const seatsRead = readOwnPropOnce(state, 'seats');
  const trayRead = readOwnPropOnce(state, 'tray');
  if (!seatsRead.exists || !trayRead.exists || seatsRead.threw || trayRead.threw) {
    return null;
  }
  const seats = seatsRead.value;
  const tray = trayRead.value;
  if (!safeIsArray(seats) || !safeIsArray(tray) || seats === tray) return null;
  return { seats, tray };
}

function createNullArray(len) {
  const out = [];
  for (let i = 0; i < len; i++) {
    Object.defineProperty(out, i, {
      __proto__: null,
      value: null,
      writable: true,
      enumerable: true,
      configurable: true
    });
  }
  return out;
}

function toSafeNum(x, fallback) {
  const fb = fallback !== undefined ? fallback : NaN;
  if (typeof x === 'number') return Number.isNaN(x) ? fb : x;
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    return Number.isNaN(n) ? fb : n;
  }
  return fb;
}

function toSafeInt(x) {
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) return null;
    return x === 0 ? 0 : x;
  }
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    if (!Number.isInteger(n)) return null;
    return n === 0 ? 0 : n;
  }
  return null;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function safeInt(x, fallback, lo, hi) {
  const n = toSafeNum(x);
  if (!Number.isFinite(n)) return fallback;
  const v = clamp(Math.floor(n), lo, hi);
  return v === 0 ? 0 : v;
}

function wrapRng(rng) {
  const fn = typeof rng === 'function' ? rng : Math.random;
  return function nextRand() {
    let v = 0.5;
    try {
      v = fn();
    } catch (_) {
      v = 0.5;
    }
    if (typeof v !== 'number' || !Number.isFinite(v)) return 0.5;
    if (v <= 0) return 0;
    if (v >= 1) return 0.999999999999;
    return v;
  };
}

function normalizeExplicitPatronId(rawId) {
  if (rawId === null || rawId === undefined) return null;
  if (typeof rawId !== 'string') return null;
  const s = rawId.trim();
  if (s === '' || s === 'none') return null;
  if (s === 'mikan' || s === 'chef_mikan') return 'mikan';
  if (s === 'luna' || s === 'patron_luna') return 'luna';
  if (s === 'mugi' || s === 'patron_mugi') return 'mugi';
  return null;
}

function extractCatcakeLevels(rawMap) {
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  if (!isPlainObj(rawMap)) return out;
  for (let t = 1; t <= 7; t++) {
    const kNum = String(t);
    const kCode = 'C' + t;
    const numRead = readOwnPropOnce(rawMap, kNum);
    if (numRead.exists) {
      out[t] = safeInt(!numRead.threw ? numRead.value : 0, 0, 0, 4);
    } else {
      const codeRead = readOwnPropOnce(rawMap, kCode);
      if (codeRead.exists) {
        out[t] = safeInt(!codeRead.threw ? codeRead.value : 0, 0, 0, 4);
      }
    }
  }
  return out;
}

function resolveLevelConfig(levelCfgOrId) {
  const fallback = getLevelById('1-1');
  if (typeof levelCfgOrId === 'string') {
    return getLevelById(levelCfgOrId.trim()) || fallback;
  }
  if (!isPlainObj(levelCfgOrId)) {
    return fallback;
  }

  const rawId = getOwn(levelCfgOrId, 'id', null);
  const trimmedId = typeof rawId === 'string' && rawId.trim() !== '' ? rawId.trim() : null;
  const baseById = trimmedId !== null ? getLevelById(trimmedId) || fallback : fallback;

  const baseId = getOwn(baseById, 'id', '1-1');
  const baseChapter = getOwn(baseById, 'chapter', 1);
  const baseDuration = getOwn(baseById, 'durationSec', 90);
  const baseStars = getOwn(baseById, 'stars', [750, 1050, 1400]);
  const baseClearDust = getOwn(baseById, 'baseClearDust', 10);
  const baseFirstStarDust = getOwn(baseById, 'firstStarDust', [15, 20, 30]);
  const baseAllowedRecipes = getOwn(baseById, 'allowedRecipes', ['R01', 'R02', 'R03']);
  const baseUrgentRate = toSafeNum(getOwn(baseById, 'urgentRate', 0), 0);
  const baseVipQuota = getOwn(baseById, 'vipQuota', 0);
  const baseVipQuotaRange = getOwn(baseById, 'vipQuotaRange', null);
  const baseVipFixedRecipeId = getOwn(baseById, 'vipFixedRecipeId', null);
  const baseRushEndSec = getOwn(baseById, 'rushEndSec', null);

  const chapterRead = readOwnPropOnce(levelCfgOrId, 'chapter');
  const durRead = readOwnPropOnce(levelCfgOrId, 'durationSec');
  const rawStars = getOwn(levelCfgOrId, 'stars', null);
  const clearDustRead = readOwnPropOnce(levelCfgOrId, 'baseClearDust');
  const rawFirstStarDust = getOwn(levelCfgOrId, 'firstStarDust', null);
  const rawAllowedRecipes = getOwn(levelCfgOrId, 'allowedRecipes', null);
  const urgentRead = readOwnPropOnce(levelCfgOrId, 'urgentRate');
  const parsedUrgent = urgentRead.exists && !urgentRead.threw ? toSafeNum(urgentRead.value) : NaN;
  const vipQuotaRead = readOwnPropOnce(levelCfgOrId, 'vipQuota');
  const vipRangeRead = readOwnPropOnce(levelCfgOrId, 'vipQuotaRange');
  const rawVipRange = vipRangeRead.exists && !vipRangeRead.threw ? vipRangeRead.value : null;
  const vipFixedRead = readOwnPropOnce(levelCfgOrId, 'vipFixedRecipeId');
  const rushEndRead = readOwnPropOnce(levelCfgOrId, 'rushEndSec');

  return {
    id: trimmedId !== null ? trimmedId : baseId,
    chapter: chapterRead.exists
      ? safeInt(!chapterRead.threw ? chapterRead.value : baseChapter, baseChapter, 1, 3)
      : baseChapter,
    durationSec: durRead.exists
      ? safeInt(!durRead.threw ? durRead.value : baseDuration, baseDuration, 10, 3600)
      : baseDuration,
    stars: safeArrayLen(rawStars, 8) >= 3 ? rawStars : baseStars,
    baseClearDust: clearDustRead.exists
      ? safeInt(!clearDustRead.threw ? clearDustRead.value : baseClearDust, baseClearDust, 0, 200)
      : baseClearDust,
    firstStarDust: safeArrayLen(rawFirstStarDust, 8) >= 3 ? rawFirstStarDust : baseFirstStarDust,
    allowedRecipes: safeIsArray(rawAllowedRecipes) ? rawAllowedRecipes : baseAllowedRecipes,
    urgentRate: urgentRead.exists
      ? (Number.isFinite(parsedUrgent) ? clamp(parsedUrgent, 0, 1) : baseUrgentRate)
      : baseUrgentRate,
    vipQuota: vipQuotaRead.exists
      ? safeInt(!vipQuotaRead.threw ? vipQuotaRead.value : 0, 0, 0, 20)
      : vipRangeRead.exists
        ? 0
        : baseVipQuota,
    vipQuotaRange:
      safeArrayLen(rawVipRange, 8) >= 2
        ? rawVipRange
        : vipQuotaRead.exists
          ? null
          : baseVipQuotaRange,
    vipFixedRecipeId: vipFixedRead.exists
      ? (!vipFixedRead.threw && typeof vipFixedRead.value === 'string' ? vipFixedRead.value.trim() : null)
      : (trimmedId !== null && trimmedId !== baseId ? null : baseVipFixedRecipeId),
    rushEndSec: rushEndRead.exists
      ? (!rushEndRead.threw ? rushEndRead.value : null)
      : baseRushEndSec
  };
}

function buildVipScheduleTimes(vipQuotaTarget, durationSec, closingGuardSec) {
  if (vipQuotaTarget <= 0) return [];
  if (vipQuotaTarget === 1) {
    const single = [];
    safePush(
      single,
      Math.round(
        Math.min(durationSec * 0.88, Math.max(closingGuardSec + 42.0, durationSec * 0.65)) * 100
      ) / 100
    );
    return single;
  }
  const vipStart = durationSec * 0.88;
  const vipEnd = Math.min(vipStart * 0.88, Math.max(54.0, durationSec * 0.48));
  const times = [];
  for (let i = 0; i < vipQuotaTarget; i++) {
    const t = vipStart - (i / (vipQuotaTarget - 1)) * (vipStart - vipEnd);
    safePush(times, Math.round(t * 100) / 100);
  }
  return times;
}

function computeInRushFromNums(tl, rStart, rEnd) {
  if (!Number.isFinite(tl) || !Number.isFinite(rStart) || !Number.isFinite(rEnd)) return false;
  return tl <= rStart + EPS && tl >= rEnd - EPS;
}

function isRushHour(state) {
  if (!isPlainObj(state)) return false;
  const tl = toSafeNum(getOwn(state, 'timeLeft', NaN));
  const rStart = toSafeNum(getOwn(state, 'rushStartSec', NaN));
  const rEnd = toSafeNum(getOwn(state, 'rushEndSec', NaN));
  return computeInRushFromNums(tl, rStart, rEnd);
}

function computeTurnoverCooldownFromInRush(inRush, rng) {
  if (inRush) {
    return 0.8;
  }
  return Math.round((1.2 + rng() * 1.0) * 1000) / 1000;
}

function computeTurnoverCooldown(state, rng) {
  return computeTurnoverCooldownFromInRush(isRushHour(state), rng);
}

function syncFreezeSyncMarker(state, clean) {
  if (hasOwn(state, '_lastFreezeSync')) {
    try {
      state._lastFreezeSync = clean;
    } catch (_) {
      // Ignore read-only descriptor
    }
  } else if (safeIsExtensible(state)) {
    try {
      Object.defineProperty(state, '_lastFreezeSync', {
        __proto__: null,
        value: clean,
        enumerable: false,
        configurable: true,
        writable: true
      });
    } catch (_) {
      // Ignore if non-extensible
    }
  }
}

function syncFreezeMirrors(state, nextVal) {
  if (!isPlainObj(state) || safeIsFrozen(state)) return;
  const clean = Number.isFinite(nextVal) && nextVal > EPS ? nextVal : 0;
  setOwnProp(state, 'patienceFreezeTimer', clean);
  setOwnProp(state, 'freezeTimer', clean);
  syncFreezeSyncMarker(state, clean);
}

function readFreezeTimerSnapshotsOnce(state) {
  if (!isPlainObj(state)) {
    return {
      effective: 0,
      pRead: { exists: false, value: undefined, threw: false },
      fRead: { exists: false, value: undefined, threw: false },
      mRead: { exists: false, value: undefined, threw: false }
    };
  }
  const pRead = readOwnPropOnce(state, 'patienceFreezeTimer');
  const fRead = readOwnPropOnce(state, 'freezeTimer');
  const mRead = readOwnPropOnce(state, 'mikanFreezeTimer');
  const rawP = pRead.exists && !pRead.threw ? toSafeNum(pRead.value) : NaN;
  const rawF = fRead.exists && !fRead.threw ? toSafeNum(fRead.value) : NaN;
  const pVal = Number.isFinite(rawP) && rawP > 0 ? rawP : 0;
  const fVal = Number.isFinite(rawF) && rawF > 0 ? rawF : 0;

  let effective = Math.max(pVal, fVal);
  const lastSyncRead = readOwnPropOnce(state, '_lastFreezeSync');
  const lastSync = lastSyncRead.exists && !lastSyncRead.threw ? lastSyncRead.value : undefined;
  if (typeof lastSync === 'number' && Number.isFinite(lastSync)) {
    if (Math.abs(pVal - lastSync) > EPS && Math.abs(fVal - lastSync) <= EPS) {
      effective = pVal;
    } else if (Math.abs(fVal - lastSync) > EPS && Math.abs(pVal - lastSync) <= EPS) {
      effective = fVal;
    }
  }
  return { effective, pRead, fRead, mRead };
}

function writeVerifiedFreezeMirrors(state, nextVal, freezeSnap) {
  if (!isPlainObj(state) || safeIsFrozen(state)) return false;
  const clean = Number.isFinite(nextVal) && nextVal > EPS ? nextVal : 0;
  const okP = verifiedWriteProp(state, 'patienceFreezeTimer', clean);
  const okF = okP && verifiedWriteProp(state, 'freezeTimer', clean);
  const hasMikanOwn = Boolean(freezeSnap && freezeSnap.mRead && freezeSnap.mRead.exists);
  const okM = !hasMikanOwn || (okF && verifiedWriteProp(state, 'mikanFreezeTimer', clean));
  if (!okP || !okF || !okM) {
    if (freezeSnap) {
      restorePropSnapshot(state, 'patienceFreezeTimer', freezeSnap.pRead);
      restorePropSnapshot(state, 'freezeTimer', freezeSnap.fRead);
      if (hasMikanOwn) {
        restorePropSnapshot(state, 'mikanFreezeTimer', freezeSnap.mRead);
      }
    }
    return false;
  }
  syncFreezeSyncMarker(state, clean);
  return true;
}

/**
 * Creates a fresh 3-seat OrderState for a level run.
 * Initializes state.score strictly to 0.
 */
function createOrderState(levelCfgOrId, saveData, rng) {
  let resolvedSave = saveData;
  let resolvedRng = rng;
  if (typeof saveData === 'function') {
    resolvedRng = saveData;
    resolvedSave = null;
  }
  const safeRng = wrapRng(resolvedRng);
  const lvl = resolveLevelConfig(levelCfgOrId);

  const durationSec = safeInt(lvl.durationSec, 90, 10, 3600);
  const rushStartSec = Math.round(durationSec * 0.55 * 100) / 100;
  const rawRushEnd = lvl.rushEndSec !== null && lvl.rushEndSec !== undefined ? toSafeNum(lvl.rushEndSec) : NaN;
  const rushEndSec =
    Number.isFinite(rawRushEnd) && rawRushEnd >= 0
      ? Math.min(rushStartSec, rawRushEnd)
      : Math.round(durationSec * 0.15 * 100) / 100;

  const validRecipes = [];
  const allowedLen = safeArrayLen(lvl.allowedRecipes, MAX_LIST_CAP);
  for (let i = 0; i < allowedLen; i++) {
    const rId = getOwn(lvl.allowedRecipes, i, null);
    if (typeof rId === 'string' && hasOwn(RECIPES, rId.trim())) {
      safePush(validRecipes, rId.trim());
    }
  }
  if (validRecipes.length === 0) {
    safePush(validRecipes, 'R01', 'R02', 'R03');
  }

  let vipQuotaTarget = 0;
  if (safeArrayLen(lvl.vipQuotaRange, 8) >= 2) {
    const minQ = safeInt(getOwn(lvl.vipQuotaRange, 0, 0), 0, 0, 20);
    const maxQ = safeInt(getOwn(lvl.vipQuotaRange, 1, minQ), minQ, minQ, 20);
    vipQuotaTarget =
      maxQ > minQ ? minQ + Math.floor(safeRng() * (maxQ - minQ + 1)) : minQ;
  } else {
    vipQuotaTarget = safeInt(lvl.vipQuota, 0, 0, 20);
  }

  const vipFixedRecipeId =
    typeof lvl.vipFixedRecipeId === 'string' && hasOwn(RECIPES, lvl.vipFixedRecipeId)
      ? lvl.vipFixedRecipeId
      : null;

  const vipScheduleTimes = buildVipScheduleTimes(vipQuotaTarget, durationSec, CLOSING_GUARD_SEC);

  const saveObj = isPlainObj(resolvedSave) ? resolvedSave : null;
  const catcakeLevels = extractCatcakeLevels(
    saveObj ? getOwn(saveObj, 'catcakeLevels', null) : null
  );

  const rawDevUpgrades = saveObj ? getOwn(saveObj, 'deviceUpgrades', null) : null;
  const devUpgrades = isPlainObj(rawDevUpgrades) ? rawDevUpgrades : null;

  const devTrayRead = devUpgrades ? readOwnPropOnce(devUpgrades, 'dev_tray') : { exists: false };
  const saveDevTrayRead = !devTrayRead.exists && saveObj ? readOwnPropOnce(saveObj, 'devTrayLv') : { exists: false };
  const devTrayLv = devTrayRead.exists
    ? safeInt(!devTrayRead.threw ? devTrayRead.value : 0, 0, 0, 2)
    : saveDevTrayRead.exists
      ? safeInt(!saveDevTrayRead.threw ? saveDevTrayRead.value : 0, 0, 0, 2)
      : 0;

  const devTeapotRead = devUpgrades ? readOwnPropOnce(devUpgrades, 'dev_teapot') : { exists: false };
  const saveDevTeapotRead = !devTeapotRead.exists && saveObj ? readOwnPropOnce(saveObj, 'devTeapotLv') : { exists: false };
  const devTeapotLv = devTeapotRead.exists
    ? safeInt(!devTeapotRead.threw ? devTeapotRead.value : 0, 0, 0, 3)
    : saveDevTeapotRead.exists
      ? safeInt(!saveDevTeapotRead.threw ? saveDevTeapotRead.value : 0, 0, 0, 3)
      : 0;

  let patronId = 'mikan';
  const selPatRead = saveObj ? readOwnPropOnce(saveObj, 'selectedPatron') : { exists: false };
  if (selPatRead.exists) {
    const selPat = !selPatRead.threw ? selPatRead.value : undefined;
    if (selPat === null || selPat === 'none') {
      patronId = null;
    } else {
      patronId = normalizePatronId(typeof selPat === 'string' ? selPat : '');
    }
  } else {
    const patRead = saveObj ? readOwnPropOnce(saveObj, 'patronId') : { exists: false };
    if (patRead.exists) {
      const rawPat = !patRead.threw ? patRead.value : undefined;
      if (rawPat === null || rawPat === 'none') {
        patronId = null;
      } else {
        patronId = normalizePatronId(typeof rawPat === 'string' ? rawPat : '');
      }
    }
  }

  const trayCapacity = devTrayLv >= 1 ? 4 : 3;
  const tray = createNullArray(trayCapacity);
  const seats = createNullArray(SEAT_COUNT);
  const seatCooldowns = [];
  safePush(seatCooldowns, 0.25, 0.45, 3.0);

  const state = {
    levelId: lvl.id,
    chapter: lvl.chapter,
    durationSec,
    timeLeft: durationSec,
    elapsedSec: 0,
    rushStartSec,
    rushEndSec,
    rushHourActive: false,
    closingGuardSec: CLOSING_GUARD_SEC,
    allowedRecipes: validRecipes,
    urgentRate: Number.isFinite(toSafeNum(lvl.urgentRate)) ? clamp(toSafeNum(lvl.urgentRate), 0, 1) : 0,
    vipQuotaTarget,
    vipFixedRecipeId,
    vipScheduleTimes,
    vipSpawned: 0,
    vipServed: 0,
    seats,
    seatCooldowns,
    preferredSeatIdx: null,
    trayCapacity,
    tray,
    nextOrderUid: 1,
    nextTrayUid: 10001,
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 0,
    feverEnergy: 0,
    feverTimer: 0,
    feverActive: false,
    patienceFreezeTimer: 0,
    freezeTimer: 0,
    lunaNextServeBoost: false,
    score: 0,
    ordersServed: 0,
    angryWalkouts: 0,
    highestSingleServe: 0,
    bonusDustEarned: 0,
    catcakeLevels,
    devTrayLv,
    devTeapotLv,
    patronId
  };

  syncFreezeMirrors(state, 0);
  state.rushHourActive = isRushHour(state);
  return state;
}

function resolveOrderSlotsOnce(order) {
  if (typeof order === 'string') {
    const trimmed = order.trim();
    if (!hasOwn(RECIPES, trimmed)) {
      return { rawSlots: null, fromOwnSlots: false, recipeIdRead: null };
    }
    const rec = getOwn(RECIPES, trimmed, null);
    const recSlots = isPlainObj(rec) ? getOwn(rec, 'slots', null) : null;
    return {
      rawSlots: safeIsArray(recSlots) ? recSlots : null,
      fromOwnSlots: false,
      recipeIdRead: null
    };
  }
  if (!isPlainObj(order)) {
    return { rawSlots: null, fromOwnSlots: false, recipeIdRead: null };
  }
  const slotsRead = readOwnPropOnce(order, 'slots');
  if (slotsRead.exists && !slotsRead.threw && safeIsArray(slotsRead.value)) {
    return { rawSlots: slotsRead.value, fromOwnSlots: true, recipeIdRead: null };
  }
  const recIdRead = readOwnPropOnce(order, 'recipeId');
  if (recIdRead.exists && !recIdRead.threw && typeof recIdRead.value === 'string') {
    const rId = recIdRead.value.trim();
    if (hasOwn(RECIPES, rId)) {
      const rec = getOwn(RECIPES, rId, null);
      const recSlots = isPlainObj(rec) ? getOwn(rec, 'slots', null) : null;
      return {
        rawSlots: safeIsArray(recSlots) ? recSlots : null,
        fromOwnSlots: false,
        recipeIdRead: recIdRead
      };
    }
  }
  return { rawSlots: null, fromOwnSlots: false, recipeIdRead: recIdRead };
}

function snapshotOrderSlotsWithRaw(order, seenSlotReqs) {
  const { rawSlots, fromOwnSlots, recipeIdRead } = resolveOrderSlotsOnce(order);
  const slotLen = safeArrayLen(rawSlots, MAX_ORDER_SLOTS);
  if (slotLen === 0) {
    return { snap: [], ownSlotObjs: [], recipeIdRead };
  }
  const reqMap = seenSlotReqs || new Map();
  const snap = [];
  const ownSlotObjs = [];
  for (let i = 0; i < slotLen; i++) {
    const reqRead = readOwnPropOnce(rawSlots, i);
    const req = reqRead.exists && !reqRead.threw ? reqRead.value : null;
    safePush(ownSlotObjs, fromOwnSlots && isPlainObj(req) ? req : null);

    if (!isPlainObj(req)) {
      safePush(snap, { valid: false, tier: 0, flavor: 'any' });
      continue;
    }
    if (reqMap.has(req)) {
      safePush(snap, reqMap.get(req));
      continue;
    }
    const tierRead = readOwnPropOnce(req, 'tier');
    if (!tierRead.exists || tierRead.threw) {
      const invalidEntry = { valid: false, tier: 0, flavor: 'any' };
      reqMap.set(req, invalidEntry);
      safePush(snap, invalidEntry);
      continue;
    }
    const rawTier = toSafeNum(tierRead.value, NaN);
    const tier = Number.isFinite(rawTier) ? clamp(Math.floor(rawTier), 0, 7) : 0;
    const flvRead = readOwnPropOnce(req, 'flavor');
    const rawFlv = flvRead.exists && !flvRead.threw ? flvRead.value : 'any';
    const flvStr = typeof rawFlv === 'string' ? rawFlv.trim() : 'any';
    const flavor = VALID_REQ_FLAVORS[flvStr] === true ? flvStr : 'any';
    const validEntry = {
      valid: tier >= 1 && tier <= 7,
      tier,
      flavor
    };
    reqMap.set(req, validEntry);
    safePush(snap, validEntry);
  }
  return { snap, ownSlotObjs, recipeIdRead };
}

function snapshotOrderSlots(order, seenSlotReqs) {
  return snapshotOrderSlotsWithRaw(order, seenSlotReqs).snap;
}

function snapshotSingleTileEntry(t, seenTiles) {
  if (!isPlainObj(t)) {
    return {
      rawTile: t,
      isObj: false,
      hasTier: false,
      rawTierVal: undefined,
      matchEntry: null,
      scoreTier: null,
      flavor: 'plain'
    };
  }
  if (seenTiles && seenTiles.has(t)) {
    return seenTiles.get(t);
  }

  const tierRead = readOwnPropOnce(t, 'tier');
  const frozenHpRead = readOwnPropOnce(t, 'frozenHp');
  const frozenRead = readOwnPropOnce(t, 'frozen');
  const flavorRead = readOwnPropOnce(t, 'flavor');

  const isFrozen =
    (frozenHpRead.exists && !frozenHpRead.threw && toSafeNum(frozenHpRead.value, 0) > 0) ||
    (frozenRead.exists && !frozenRead.threw && frozenRead.value === true);

  const rawFlv = flavorRead.exists && !flavorRead.threw ? flavorRead.value : 'plain';
  const flvStr = typeof rawFlv === 'string' ? rawFlv.trim() : 'plain';
  const flavor = VALID_FLAVORS[flvStr] === true ? flvStr : 'plain';

  const intTier = tierRead.exists && !tierRead.threw ? toSafeInt(tierRead.value) : null;
  const scoreTier = tierRead.exists && !tierRead.threw ? safeInt(tierRead.value, 0, 0, 7) : 0;

  const matchEntry =
    !isFrozen && intTier !== null && intTier >= 1 && intTier <= 7
      ? { rawTile: t, tier: intTier, flavor }
      : null;

  const info = {
    rawTile: t,
    isObj: true,
    hasTier: tierRead.exists,
    rawTierVal: tierRead.value,
    matchEntry,
    scoreTier: tierRead.exists ? scoreTier : null,
    flavor
  };
  if (seenTiles) {
    seenTiles.set(t, info);
  }
  return info;
}

function snapshotTrayTilesWithReads(tray, seenTiles) {
  const tileMap = seenTiles || new Map();
  const trayLen = safeArrayLen(tray, MAX_TRAY_SLOTS);
  const snap = [];
  const slotReads = [];
  for (let tIdx = 0; tIdx < trayLen; tIdx++) {
    const tRead = readOwnPropOnce(tray, tIdx);
    const t = tRead.exists && !tRead.threw ? tRead.value : null;
    const info = snapshotSingleTileEntry(t, tileMap);
    safePush(slotReads, tRead);
    safePush(snap, info.matchEntry);
  }
  return { snap, slotReads };
}

function snapshotTrayTiles(tray, seenTiles) {
  return snapshotTrayTilesWithReads(tray, seenTiles).snap;
}

function matchOrderSnapshotWithTray(slotSnap, traySnap) {
  const slotCount = slotSnap.length;
  if (slotCount === 0) {
    return {
      fullMatch: false,
      slotMatches: [],
      usedTrayIndices: [],
      usedTiles: [],
      matchedTrayEntries: []
    };
  }

  const sortedSlotIndices = [];
  for (let idx = 0; idx < slotCount; idx++) {
    safePush(sortedSlotIndices, idx);
  }
  sortedSlotIndices.sort((a, b) => {
    const fA = slotSnap[a].flavor;
    const fB = slotSnap[b].flavor;
    const priA = fA === 'matcha' || fA === 'berry' ? 0 : 1;
    const priB = fB === 'matcha' || fB === 'berry' ? 0 : 1;
    return priA !== priB ? priA - priB : a - b;
  });

  const slotMatches = createNullArray(slotCount);
  const usedTraySet = new Set();

  function findUnusedTrayIdx(predicate) {
    for (let tIdx = 0; tIdx < traySnap.length; tIdx++) {
      if (usedTraySet.has(tIdx)) continue;
      const entry = traySnap[tIdx];
      if (!entry) continue;
      if (predicate(entry.tier, entry.flavor)) {
        return tIdx;
      }
    }
    return -1;
  }

  for (let i = 0; i < sortedSlotIndices.length; i++) {
    const sIdx = sortedSlotIndices[i];
    const req = slotSnap[sIdx];
    if (!req.valid) continue;
    const reqTier = req.tier;
    const reqFlavor = req.flavor;

    let matchedIdx = -1;
    if (reqFlavor !== 'any') {
      matchedIdx = findUnusedTrayIdx((tier, flv) => tier === reqTier && flv === reqFlavor);
      if (matchedIdx < 0) {
        matchedIdx = findUnusedTrayIdx((tier, flv) => tier === reqTier && flv === 'gold');
      }
    } else {
      matchedIdx = findUnusedTrayIdx((tier, flv) => tier === reqTier && flv === 'plain');
      if (matchedIdx < 0) {
        matchedIdx = findUnusedTrayIdx(
          (tier, flv) => tier === reqTier && (flv === 'matcha' || flv === 'berry')
        );
      }
      if (matchedIdx < 0) {
        matchedIdx = findUnusedTrayIdx((tier, flv) => tier === reqTier && flv === 'gold');
      }
    }

    if (matchedIdx >= 0) {
      safeSetIdx(slotMatches, sIdx, matchedIdx);
      usedTraySet.add(matchedIdx);
    }
  }

  const usedTrayIndices = [];
  const usedTiles = [];
  const matchedTrayEntries = [];
  let matchedCount = 0;
  for (let sIdx = 0; sIdx < slotCount; sIdx++) {
    const tIdx = slotMatches[sIdx];
    if (typeof tIdx === 'number' && Number.isInteger(tIdx) && tIdx >= 0 && tIdx < traySnap.length) {
      const entry = traySnap[tIdx];
      if (entry !== null) {
        matchedCount += 1;
        safePush(usedTrayIndices, tIdx);
        safePush(usedTiles, entry.rawTile);
        safePush(matchedTrayEntries, entry);
      }
    }
  }

  return {
    fullMatch: slotCount > 0 && matchedCount === slotCount,
    slotMatches,
    usedTrayIndices,
    usedTiles,
    matchedTrayEntries
  };
}

/**
 * Pure non-mutating multiset subset matcher between a customer order and the serving tray.
 * Constrained flavor ('matcha'|'berry') matches exact first then 'gold';
 * Unconstrained ('any') matches 'plain' -> 'matcha'|'berry' -> 'gold' last to conserve gold wildcards.
 */
function matchCustomerWithTray(order, tray) {
  if (!safeIsArray(tray)) {
    return {
      fullMatch: false,
      slotMatches: [],
      usedTrayIndices: [],
      usedTiles: []
    };
  }
  const slotSnap = snapshotOrderSlots(order, new Map());
  if (slotSnap.length === 0) {
    return {
      fullMatch: false,
      slotMatches: [],
      usedTrayIndices: [],
      usedTiles: []
    };
  }
  const traySnap = snapshotTrayTiles(tray, new Map());
  const res = matchOrderSnapshotWithTray(slotSnap, traySnap);
  return {
    fullMatch: res.fullMatch,
    slotMatches: res.slotMatches,
    usedTrayIndices: res.usedTrayIndices,
    usedTiles: res.usedTiles
  };
}

/**
 * Snapshots order priority and scoring fields ONCE per candidate/order so TOCTOU getters
 * on patience, maxPatience, bountyMult, customerId, isVip, isUrgent, or rewardDustBonus
 * can never diverge between tie-break selection, Fever gain, and score computation.
 */
function snapshotOrderMetaOnce(order) {
  if (!isPlainObj(order)) {
    return {
      isObj: false,
      patRead: { exists: false, value: undefined, threw: false },
      maxPatRead: { exists: false, value: undefined, threw: false },
      candPRatio: 0,
      scorePRatio: null,
      custId: '',
      explicitIsVip: false,
      explicitIsUrgent: false,
      isVip: false,
      isUrgent: false,
      hasBountyMult: false,
      bountyMult: NaN,
      hasRewardDustBonus: false,
      rewardDustBonus: 5
    };
  }

  const patRead = readOwnPropOnce(order, 'patience');
  const maxPatRead = readOwnPropOnce(order, 'maxPatience');
  let candPRatio = 0;
  let scorePRatio = null;

  if (patRead.exists && maxPatRead.exists) {
    const p = !patRead.threw ? toSafeNum(patRead.value) : NaN;
    const mp = !maxPatRead.threw ? toSafeNum(maxPatRead.value) : NaN;
    if (Number.isFinite(p) && Number.isFinite(mp) && mp > 0) {
      const r = clamp(p / mp, 0, 1);
      candPRatio = r;
      scorePRatio = r;
    }
  } else {
    const prRead = readOwnPropOnce(order, 'patienceRatio');
    if (prRead.exists && !prRead.threw) {
      const pr = toSafeNum(prRead.value);
      if (Number.isFinite(pr)) {
        scorePRatio = clamp(pr, 0, 1);
        candPRatio = scorePRatio;
      }
    }
  }

  const custRead = readOwnPropOnce(order, 'customerId');
  const custId = custRead.exists && !custRead.threw && typeof custRead.value === 'string'
    ? custRead.value
    : '';

  const vipRead = readOwnPropOnce(order, 'isVip');
  const explicitIsVip = vipRead.exists && !vipRead.threw && vipRead.value === true;

  const urgRead = readOwnPropOnce(order, 'isUrgent');
  const explicitIsUrgent = urgRead.exists && !urgRead.threw && urgRead.value === true;

  const isVip = Boolean(explicitIsVip || custId === 'cust_critic');
  const isUrgent = Boolean(explicitIsUrgent || custId === 'cust_fox');

  const bountyRead = readOwnPropOnce(order, 'bountyMult');
  const bountyMult = bountyRead.exists && !bountyRead.threw ? toSafeNum(bountyRead.value) : NaN;

  const dustRead = readOwnPropOnce(order, 'rewardDustBonus');
  const rewardDustBonus = dustRead.exists && !dustRead.threw
    ? safeInt(dustRead.value, 5, 0, 50)
    : 5;

  return {
    isObj: true,
    patRead,
    maxPatRead,
    candPRatio,
    scorePRatio,
    custId,
    explicitIsVip,
    explicitIsUrgent,
    isVip,
    isUrgent,
    hasBountyMult: bountyRead.exists,
    bountyMult,
    hasRewardDustBonus: dustRead.exists,
    rewardDustBonus
  };
}

function snapshotSingleSeatOnce(seat, seatIdx, opts, seenSeats, seenSlotReqs) {
  if (!isPlainObj(seat)) return null;
  const withMeta = Boolean(opts && opts.withMeta);
  const withRecipeId = Boolean(opts && opts.withRecipeId);

  let shared = seenSeats ? seenSeats.get(seat) : null;
  if (!shared) {
    const slotData = snapshotOrderSlotsWithRaw(seat, seenSlotReqs);
    const orderMeta = withMeta ? snapshotOrderMetaOnce(seat) : null;
    let recipeId = null;
    if (withRecipeId) {
      const recRead = slotData.recipeIdRead || readOwnPropOnce(seat, 'recipeId');
      if (recRead.exists && !recRead.threw && typeof recRead.value === 'string') {
        recipeId = recRead.value;
      }
    }
    shared = {
      seat,
      slotSnap: slotData.snap,
      ownSlotObjs: slotData.ownSlotObjs,
      orderMeta,
      recipeId
    };
    if (seenSeats) {
      seenSeats.set(seat, shared);
    }
  } else {
    if (withMeta && !shared.orderMeta) {
      shared.orderMeta = snapshotOrderMetaOnce(seat);
    }
    if (withRecipeId && shared.recipeId === null) {
      const recRead = readOwnPropOnce(seat, 'recipeId');
      if (recRead.exists && !recRead.threw && typeof recRead.value === 'string') {
        shared.recipeId = recRead.value;
      }
    }
  }

  return {
    seatIdx,
    seat,
    slotSnap: shared.slotSnap,
    ownSlotObjs: shared.ownSlotObjs,
    orderMeta: shared.orderMeta,
    recipeId: shared.recipeId
  };
}

function snapshotSeatsArrayOnce(seats, opts, seenSeats, seenSlotReqs) {
  const seatMap = seenSeats || new Map();
  const reqMap = seenSlotReqs || new Map();
  const seatLimit = safeArrayLen(seats, SEAT_COUNT);
  const seatRecords = [];
  const seatReads = [];
  const wasEmpty = [];
  for (let s = 0; s < seatLimit; s++) {
    const seatRead = readOwnPropOnce(seats, s);
    const rawSeat = seatRead.exists && !seatRead.threw ? seatRead.value : undefined;
    safePush(seatReads, seatRead);
    safePush(wasEmpty, (rawSeat === null || rawSeat === undefined) && !seatRead.threw);
    safePush(
      seatRecords,
      isPlainObj(rawSeat) ? snapshotSingleSeatOnce(rawSeat, s, opts, seatMap, reqMap) : null
    );
  }
  return { seatRecords, seatReads, wasEmpty, seatLimit };
}

function applyOrderMarksFromSnapshots(state, seatRecords, traySnap) {
  if (!isPlainObj(state) || safeIsFrozen(state)) return;
  const seenMarkedSeats = new Set();
  for (let s = 0; s < seatRecords.length; s++) {
    const rec = seatRecords[s];
    if (!rec || !isPlainObj(rec.seat)) continue;
    if (seenMarkedSeats.has(rec.seat)) continue;
    seenMarkedSeats.add(rec.seat);

    const res = matchOrderSnapshotWithTray(rec.slotSnap, traySnap);
    if (!safeIsFrozen(rec.seat)) {
      setOwnProp(rec.seat, 'slotMatches', res.slotMatches);
      setOwnProp(rec.seat, 'readyToServe', res.fullMatch);
    }
    const ownSlotObjs = rec.ownSlotObjs;
    const seenSlots = new Set();
    for (let i = 0; i < ownSlotObjs.length; i++) {
      const sl = ownSlotObjs[i];
      if (sl && !safeIsFrozen(sl) && !seenSlots.has(sl)) {
        seenSlots.add(sl);
        const mIdx =
          i < res.slotMatches.length &&
          typeof res.slotMatches[i] === 'number' &&
          res.slotMatches[i] >= 0
            ? res.slotMatches[i]
            : -1;
        setOwnProp(sl, 'matchedTrayIdx', mIdx);
      }
    }
  }
}

/**
 * Updates slotMatches, readyToServe, and matchedTrayIdx on all seated customers for UI rendering.
 */
function refreshAllOrderMarks(state) {
  if (safeIsFrozen(state)) return;
  const arrs = readOrderStateArrays(state);
  if (!arrs) return;
  const traySnap = snapshotTrayTiles(arrs.tray, new Map());
  const { seatRecords } = snapshotSeatsArrayOnce(
    arrs.seats,
    { withMeta: false, withRecipeId: false },
    new Map(),
    new Map()
  );
  applyOrderMarksFromSnapshots(state, seatRecords, traySnap);
}

/**
 * Computes deduplicated unmatched requirements across all seated customers and the preferred customer.
 */
function getNeededBoardTiers(state) {
  const allNeeded = [];
  const preferredNeeded = [];
  const arrs = readOrderStateArrays(state);
  if (!arrs) {
    return { allNeeded, preferredNeeded };
  }

  const { seats, tray } = arrs;
  const rawPrefRead = readOwnPropOnce(state, 'preferredSeatIdx');
  const rawPref = rawPrefRead.exists && !rawPrefRead.threw ? rawPrefRead.value : null;
  const prefIdx = rawPref === 0 || rawPref === 1 || rawPref === 2 ? rawPref : null;

  const traySnap = snapshotTrayTiles(tray, new Map());
  const { seatRecords } = snapshotSeatsArrayOnce(
    seats,
    { withMeta: false, withRecipeId: false },
    new Map(),
    new Map()
  );

  const seenAll = Object.create(null);
  const seenPref = Object.create(null);

  for (let s = 0; s < seatRecords.length; s++) {
    const rec = seatRecords[s];
    if (!rec || rec.slotSnap.length === 0) continue;
    const slotSnap = rec.slotSnap;
    const matchRes = matchOrderSnapshotWithTray(slotSnap, traySnap);
    for (let i = 0; i < slotSnap.length; i++) {
      if (matchRes.slotMatches[i] !== null) continue;
      const req = slotSnap[i];
      if (!req.valid) continue;
      const key = req.tier + ':' + req.flavor;

      if (!seenAll[key]) {
        seenAll[key] = true;
        safePush(allNeeded, { tier: req.tier, flavor: req.flavor });
      }
      if (prefIdx === s && !seenPref[key]) {
        seenPref[key] = true;
        safePush(preferredNeeded, { tier: req.tier, flavor: req.flavor });
      }
    }
  }

  return { allNeeded, preferredNeeded };
}

/**
 * Places a board Cat-Cake tile into the leftmost empty serving tray slot (0 score change).
 */
function tryPlaceToTray(state, tile) {
  if (safeIsFrozen(state)) {
    return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
  }
  const arrs = readOrderStateArrays(state);
  if (!arrs) {
    return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
  }
  const { seats, tray } = arrs;
  if (safeIsFrozen(tray)) {
    return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
  }
  if (!isPlainObj(tile)) {
    return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
  }

  const seenTiles = new Map();
  const tileSnap = snapshotSingleTileEntry(tile, seenTiles);
  if (!tileSnap.matchEntry) {
    return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
  }
  const tier = tileSnap.matchEntry.tier;
  const flavor = tileSnap.matchEntry.flavor;

  const curTrayLen = safeArrayLen(tray, MAX_TRAY_SLOTS);
  const defaultCap = curTrayLen > 0 ? curTrayLen : 3;
  const capRead = readOwnPropOnce(state, 'trayCapacity');
  const rawCap = capRead.exists && !capRead.threw ? capRead.value : defaultCap;
  const cap = safeInt(rawCap, defaultCap, 1, MAX_TRAY_SLOTS);
  while (safeArrayLen(tray, MAX_TRAY_SLOTS) < cap && safeIsExtensible(tray)) {
    const growIdx = safeArrayLen(tray, MAX_TRAY_SLOTS);
    if (!verifiedWriteProp(tray, growIdx, null)) break;
    if (safeArrayLen(tray, MAX_TRAY_SLOTS) <= growIdx) break;
  }

  const finalTrayLen = safeArrayLen(tray, MAX_TRAY_SLOTS);
  const searchLen = Math.min(cap, finalTrayLen);
  const traySnap = [];
  let emptyIdx = -1;
  let chosenSlotPrevRead = null;

  for (let i = 0; i < finalTrayLen; i++) {
    const slotRead = readOwnPropOnce(tray, i);
    const curSlot = slotRead.exists && !slotRead.threw ? slotRead.value : undefined;
    if (
      emptyIdx < 0 &&
      i < searchLen &&
      (curSlot === null || curSlot === undefined) &&
      !slotRead.threw &&
      canMutateProp(tray, i)
    ) {
      emptyIdx = i;
      chosenSlotPrevRead = slotRead;
    }
    const info = snapshotSingleTileEntry(
      slotRead.exists && !slotRead.threw ? curSlot : null,
      seenTiles
    );
    safePush(traySnap, info.matchEntry);
  }

  if (emptyIdx < 0) {
    return { placed: false, slotIdx: -1, reason: 'tray_full' };
  }

  const uidRead = readOwnPropOnce(tile, 'uid');
  let uid = uidRead.exists && !uidRead.threw ? toSafeInt(uidRead.value) : null;
  let mutatedNextUid = false;
  let prevNextUidRead = null;
  if (uid === null || uid < 1) {
    prevNextUidRead = readOwnPropOnce(state, 'nextTrayUid');
    const curNext = prevNextUidRead.exists && !prevNextUidRead.threw
      ? safeInt(prevNextUidRead.value, 10001, 1, 1000000000)
      : 10001;
    uid = curNext;
    if (!verifiedWriteProp(state, 'nextTrayUid', curNext + 1)) {
      restorePropSnapshot(state, 'nextTrayUid', prevNextUidRead);
      return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
    }
    mutatedNextUid = true;
  }

  const trayTile = { uid, tier, flavor };
  if (!verifiedWriteProp(tray, emptyIdx, trayTile)) {
    restorePropSnapshot(tray, emptyIdx, chosenSlotPrevRead);
    if (mutatedNextUid) {
      restorePropSnapshot(state, 'nextTrayUid', prevNextUidRead);
    }
    return { placed: false, slotIdx: -1, reason: 'invalid_tile' };
  }

  safeSetIdx(traySnap, emptyIdx, { rawTile: trayTile, tier, flavor });
  const { seatRecords } = snapshotSeatsArrayOnce(
    seats,
    { withMeta: false, withRecipeId: false },
    new Map(),
    new Map()
  );
  applyOrderMarksFromSnapshots(state, seatRecords, traySnap);

  return {
    placed: true,
    slotIdx: emptyIdx,
    tile: trayTile
  };
}

/**
 * Discards a Cat-Cake from a tray slot into the trash basket (0 score penalty, 0 combo change).
 */
function discardTraySlot(state, slotIdx) {
  if (safeIsFrozen(state)) {
    return { discarded: false, tile: null };
  }
  const arrs = readOrderStateArrays(state);
  if (!arrs) {
    return { discarded: false, tile: null };
  }
  const { seats, tray } = arrs;
  if (safeIsFrozen(tray)) {
    return { discarded: false, tile: null };
  }
  const trayLen = safeArrayLen(tray, MAX_TRAY_SLOTS);
  const idx = toSafeInt(slotIdx);
  if (idx === null || idx < 0 || idx >= trayLen || !canMutateProp(tray, idx)) {
    return { discarded: false, tile: null };
  }
  const existingRead = readOwnPropOnce(tray, idx);
  const existing = existingRead.exists && !existingRead.threw ? existingRead.value : null;
  if (!isPlainObj(existing)) {
    return { discarded: false, tile: null };
  }

  if (!verifiedWriteProp(tray, idx, null)) {
    restorePropSnapshot(tray, idx, existingRead);
    return { discarded: false, tile: null };
  }

  const seenTiles = new Map();
  const traySnap = [];
  for (let tIdx = 0; tIdx < trayLen; tIdx++) {
    if (tIdx === idx) {
      safePush(traySnap, null);
    } else {
      const tRead = readOwnPropOnce(tray, tIdx);
      const t = tRead.exists && !tRead.threw ? tRead.value : null;
      safePush(traySnap, snapshotSingleTileEntry(t, seenTiles).matchEntry);
    }
  }
  const { seatRecords } = snapshotSeatsArrayOnce(
    seats,
    { withMeta: false, withRecipeId: false },
    new Map(),
    new Map()
  );
  applyOrderMarksFromSnapshots(state, seatRecords, traySnap);

  return {
    discarded: true,
    tile: existing
  };
}

/**
 * Computes exact single-serve score from already-snapshotted orderMeta, slotSnap, and pairedTileSnaps
 * using unrounded itemSum floats and a single outer Math.round (zero live re-reads on order/tiles).
 */
function computeServeScoreFromSnapshots(orderMeta, slotSnap, pairedTileSnaps, scoreCtx, orderRef) {
  const slotLen = slotSnap.length;
  if (slotLen === 0 || pairedTileSnaps.length < slotLen) {
    return 0;
  }

  const ctx = isPlainObj(scoreCtx) ? scoreCtx : null;
  const catcakeLevelsMap = extractCatcakeLevels(ctx ? getOwn(ctx, 'catcakeLevels', null) : null);

  let itemSum = 0;
  for (let i = 0; i < slotLen; i++) {
    const req = slotSnap[i];
    const pSnap = pairedTileSnaps[i];
    const tier =
      pSnap && pSnap.scoreTier !== null && pSnap.scoreTier !== undefined
        ? pSnap.scoreTier
        : req.valid
          ? req.tier
          : 0;
    if (tier < 1 || tier > 7) continue;

    const upgradeLv = catcakeLevelsMap[tier] || 0;
    const basePrice = getCatcakePrice(tier, upgradeLv);
    const tileFlavor = pSnap ? pSnap.flavor : 'plain';
    const reqFlavor = req.flavor;

    let itemFlavorMult = FLAVORS.plain.mult;
    if (tileFlavor === 'gold') {
      itemFlavorMult = FLAVORS.gold.mult;
    } else if (reqFlavor === 'matcha' || reqFlavor === 'berry') {
      itemFlavorMult = FLAVORS[reqFlavor].mult;
    }

    itemSum += basePrice * itemFlavorMult;
  }

  if (!(itemSum > 0)) return 0;

  const slotCount = clamp(slotLen, 1, 3);
  const comboSizeMult = COMBO_SIZE_MULTS[slotCount] || 1.00;

  // Patience tip band (> 0.55 green 1.30; >= 0.25 yellow 1.00; < 0.25 red 0.85)
  let pRatio = 0.40;
  if (orderMeta && orderMeta.scorePRatio !== null) {
    pRatio = orderMeta.scorePRatio;
  } else if (ctx && ctx !== orderRef) {
    const ctxPrRead = readOwnPropOnce(ctx, 'patienceRatio');
    if (ctxPrRead.exists && !ctxPrRead.threw) {
      const pr = toSafeNum(ctxPrRead.value);
      if (Number.isFinite(pr)) pRatio = clamp(pr, 0, 1);
    }
  }

  const patienceTipMult =
    pRatio > PATIENCE_TIP_BANDS.greenThreshold
      ? PATIENCE_TIP_BANDS.greenMult
      : pRatio >= PATIENCE_TIP_BANDS.yellowThreshold
        ? PATIENCE_TIP_BANDS.yellowMult
        : PATIENCE_TIP_BANDS.redMult;

  // Serve combo multiplier + Mugi >= 3 combo passive (+0.10)
  const comboRead = ctx ? readOwnPropOnce(ctx, 'comboCount') : { exists: false };
  const comboCount = comboRead.exists
    ? safeInt(!comboRead.threw ? comboRead.value : 1, 1, 1, 999)
    : 1;
  const baseComboMult =
    SERVE_COMBO_MULTS[Math.min(SERVE_COMBO_MULTS.length - 1, Math.max(0, comboCount - 1))] || 1.00;
  const patronRead = ctx ? readOwnPropOnce(ctx, 'patronId') : { exists: false };
  const patronId = patronRead.exists && !patronRead.threw
    ? normalizeExplicitPatronId(patronRead.value)
    : null;
  const mugiComboBonus = patronId === 'mugi' && comboCount >= 3 ? 0.10 : 0;
  const serveComboMult = baseComboMult + mugiComboBonus;

  // Customer bounty multiplier
  let customerMult = 1.00;
  if (orderMeta && orderMeta.hasBountyMult) {
    if (Number.isFinite(orderMeta.bountyMult) && orderMeta.bountyMult > 0) {
      customerMult = orderMeta.bountyMult;
    }
  } else if (orderMeta && orderMeta.custId !== '' && hasOwn(CUSTOMER_MAP, orderMeta.custId)) {
    const mapCust = getOwn(CUSTOMER_MAP, orderMeta.custId, null);
    const bm = isPlainObj(mapCust) ? toSafeNum(getOwn(mapCust, 'bountyMult', NaN)) : NaN;
    if (Number.isFinite(bm) && bm > 0) customerMult = bm;
  } else if (orderMeta && orderMeta.explicitIsVip) {
    customerMult = 1.50;
  } else if (orderMeta && orderMeta.explicitIsUrgent) {
    customerMult = 1.25;
  } else if (ctx) {
    const cmRead = readOwnPropOnce(ctx, 'customerMult');
    if (cmRead.exists && !cmRead.threw) {
      const cm = toSafeNum(cmRead.value);
      if (Number.isFinite(cm) && cm > 0) customerMult = cm;
    }
  }

  // Patron multiplier: Mikan passive x1.08 & Luna active one-shot x1.50
  const mikanMult = patronId === 'mikan' ? 1.08 : 1.00;
  const lunaActive = Boolean(
    ctx &&
      (getOwn(ctx, 'lunaNextServeBoost', false) || getOwn(ctx, 'lunaBoost', false))
  );
  const patronMult = mikanMult * (lunaActive ? 1.50 : 1.00);

  // Device multiplier: dev_tray >= 2 grants x1.12 on 3-item combos
  let devTrayLv = 0;
  const ctxTrayRead = ctx ? readOwnPropOnce(ctx, 'devTrayLv') : { exists: false };
  if (ctxTrayRead.exists && !ctxTrayRead.threw && ctxTrayRead.value !== undefined) {
    devTrayLv = safeInt(ctxTrayRead.value, 0, 0, 2);
  } else if (ctx) {
    const rawCtxDevUp = getOwn(ctx, 'deviceUpgrades', null);
    if (isPlainObj(rawCtxDevUp)) {
      const dtRead = readOwnPropOnce(rawCtxDevUp, 'dev_tray');
      if (dtRead.exists && !dtRead.threw) {
        devTrayLv = safeInt(dtRead.value, 0, 0, 2);
      }
    }
  }
  const deviceMult = devTrayLv >= 2 && slotCount === 3 ? 1.12 : 1.00;

  // Starlight Fever multiplier (x1.35)
  const isFever = Boolean(
    ctx &&
      (getOwn(ctx, 'isFever', false) ||
        getOwn(ctx, 'feverActive', false) ||
        toSafeNum(getOwn(ctx, 'feverTimer', 0)) > 0)
  );
  const feverMult = isFever ? FEVER_CONFIG.scoreMult : 1.00;

  const rawTotal =
    itemSum *
    comboSizeMult *
    patienceTipMult *
    serveComboMult *
    customerMult *
    patronMult *
    deviceMult *
    feverMult;

  return Number.isFinite(rawTotal) && rawTotal > 0 ? Math.round(rawTotal) : 0;
}

/**
 * Computes exact single-serve score using unrounded itemSum floats and a single outer Math.round.
 * Reads order and usedTiles properties AT MOST ONCE up front (with seenTiles alias memoization).
 */
function computeServeScore(order, usedTiles, scoreCtx) {
  if (!safeIsArray(usedTiles)) return 0;
  const slotSnap = snapshotOrderSlots(order, new Map());
  const slotLen = slotSnap.length;
  const tileLen = safeArrayLen(usedTiles, MAX_TRAY_SLOTS);
  if (slotLen === 0 || tileLen < slotLen) {
    return 0;
  }

  const seenTiles = new Map();
  const tileInfos = [];
  const usedMatchSnap = [];
  for (let i = 0; i < tileLen; i++) {
    const tRead = readOwnPropOnce(usedTiles, i);
    const t = tRead.exists && !tRead.threw ? tRead.value : null;
    const info = snapshotSingleTileEntry(t, seenTiles);
    safePush(tileInfos, info);
    safePush(usedMatchSnap, info.matchEntry);
  }

  const matchRes = matchOrderSnapshotWithTray(slotSnap, usedMatchSnap);
  const pairedTileSnaps = createNullArray(slotLen);
  const consumedPool = new Set();

  for (let i = 0; i < slotLen; i++) {
    const mIdx = matchRes.slotMatches[i];
    if (typeof mIdx === 'number' && mIdx >= 0 && mIdx < tileLen) {
      safeSetIdx(pairedTileSnaps, i, tileInfos[mIdx]);
      consumedPool.add(mIdx);
    }
  }
  let fallbackCursor = 0;
  for (let i = 0; i < slotLen; i++) {
    if (pairedTileSnaps[i] !== null) continue;
    while (fallbackCursor < tileLen && consumedPool.has(fallbackCursor)) {
      fallbackCursor += 1;
    }
    if (fallbackCursor < tileLen) {
      safeSetIdx(pairedTileSnaps, i, tileInfos[fallbackCursor]);
      consumedPool.add(fallbackCursor);
      fallbackCursor += 1;
    }
  }

  const orderMeta = snapshotOrderMetaOnce(order);
  return computeServeScoreFromSnapshots(orderMeta, slotSnap, pairedTileSnaps, scoreCtx, order);
}

/**
 * Matches the current tray against all seated customers, resolves the 5-tier tie-breaker,
 * consumes matched tray tiles, and executes the SOLE score increment in the entire game.
 */
function matchTrayToCustomer(state, arg2, arg3) {
  if (
    safeIsFrozen(state) ||
    !canMutateProp(state, 'score') ||
    (hasOwn(state, 'ordersServed') && !canMutateProp(state, 'ordersServed'))
  ) {
    return { served: false };
  }
  const arrs = readOrderStateArrays(state);
  if (!arrs) {
    return { served: false };
  }
  const { seats, tray } = arrs;
  if (safeIsFrozen(seats) || safeIsFrozen(tray)) {
    return { served: false };
  }

  let rawScoreCtx = null;
  let preferredSeatIdx = null;
  const stPrefRead = readOwnPropOnce(state, 'preferredSeatIdx');
  const stPrefParsed = stPrefRead.exists && !stPrefRead.threw ? toSafeInt(stPrefRead.value) : null;
  const stPrefNormalized =
    stPrefParsed === 0 || stPrefParsed === 1 || stPrefParsed === 2 ? stPrefParsed : null;

  if (typeof arg2 === 'number') {
    const pInt = toSafeInt(arg2);
    preferredSeatIdx = pInt === 0 || pInt === 1 || pInt === 2 ? pInt : null;
    rawScoreCtx = isPlainObj(arg3) ? arg3 : null;
  } else if (arg2 === null && arg3 !== undefined) {
    preferredSeatIdx = null;
    rawScoreCtx = isPlainObj(arg3) ? arg3 : null;
  } else {
    rawScoreCtx = isPlainObj(arg2) ? arg2 : null;
    const distinctPrefCtx = rawScoreCtx && rawScoreCtx !== state ? rawScoreCtx : null;
    const ctxPrefRead = distinctPrefCtx
      ? readOwnPropOnce(distinctPrefCtx, 'preferredSeatIdx')
      : { exists: false };
    if (ctxPrefRead.exists) {
      const pInt = !ctxPrefRead.threw ? toSafeInt(ctxPrefRead.value) : null;
      preferredSeatIdx = pInt === 0 || pInt === 1 || pInt === 2 ? pInt : null;
    } else {
      preferredSeatIdx = stPrefNormalized;
    }
  }

  const distinctCtx = rawScoreCtx && rawScoreCtx !== state ? rawScoreCtx : null;

  const { snap: traySnap, slotReads: traySlotReads } = snapshotTrayTilesWithReads(
    tray,
    new Map()
  );
  const {
    seatRecords,
    seatReads: seatSlotReads,
    seatLimit
  } = snapshotSeatsArrayOnce(
    seats,
    { withMeta: false, withRecipeId: false },
    new Map(),
    new Map()
  );

  const seenSeatMeta = new Map();
  const candidates = [];

  for (let s = 0; s < seatLimit; s++) {
    const rec = seatRecords[s];
    if (!rec || !canMutateProp(seats, s)) continue;
    if (rec.slotSnap.length === 0) continue;

    const matchRes = matchOrderSnapshotWithTray(rec.slotSnap, traySnap);
    if (!matchRes.fullMatch) continue;

    let trayMutable = true;
    for (let u = 0; u < matchRes.usedTrayIndices.length; u++) {
      if (!canMutateProp(tray, matchRes.usedTrayIndices[u])) {
        trayMutable = false;
        break;
      }
    }
    if (!trayMutable) continue;

    let orderMeta = seenSeatMeta.get(rec.seat);
    if (!orderMeta) {
      orderMeta = snapshotOrderMetaOnce(rec.seat);
      seenSeatMeta.set(rec.seat, orderMeta);
    }

    const pairedScoreEntries = [];
    for (let m = 0; m < matchRes.matchedTrayEntries.length; m++) {
      const entry = matchRes.matchedTrayEntries[m];
      safePush(pairedScoreEntries, {
        scoreTier: entry.tier,
        flavor: entry.flavor
      });
    }

    safePush(candidates, {
      seatIdx: s,
      order: rec.seat,
      orderMeta,
      slotSnap: rec.slotSnap,
      usedTrayIndices: matchRes.usedTrayIndices,
      usedTiles: matchRes.usedTiles,
      matchedTrayEntries: matchRes.matchedTrayEntries,
      pairedScoreEntries,
      pRatio: orderMeta.candPRatio,
      isVip: orderMeta.isVip,
      isUrgent: orderMeta.isUrgent
    });
  }

  if (candidates.length === 0) {
    applyOrderMarksFromSnapshots(state, seatRecords, traySnap);
    return { served: false };
  }

  // 5-tier cycle-free tie-breaker:
  // 1) Manual preferredSeatIdx lock
  // 2) Lowest patience ratio band (< 0.10 gap from minimum)
  // 3) VIP critic
  // 4) Urgent fox
  // 5) Lowest seatIdx
  let winner = null;
  if (preferredSeatIdx !== null) {
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].seatIdx === preferredSeatIdx) {
        winner = candidates[i];
        break;
      }
    }
  }

  if (!winner) {
    let minP = candidates[0].pRatio;
    for (let i = 1; i < candidates.length; i++) {
      if (candidates[i].pRatio < minP) minP = candidates[i].pRatio;
    }
    const closePool = [];
    for (let i = 0; i < candidates.length; i++) {
      if (candidates[i].pRatio - minP < 0.10 - EPS) {
        safePush(closePool, candidates[i]);
      }
    }
    closePool.sort((a, b) => {
      if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
      if (a.isUrgent !== b.isUrgent) return a.isUrgent ? -1 : 1;
      return a.seatIdx - b.seatIdx;
    });
    winner = closePool[0];
  }

  // Snapshot state fields ONCE before mutating combo / Fever / Luna flags
  const prevComboRead = readOwnPropOnce(state, 'comboCount');
  const prevCombo = prevComboRead.exists && !prevComboRead.threw
    ? safeInt(prevComboRead.value, 0, 0, 9999)
    : 0;
  const nextCombo = prevCombo + 1;

  const prevComboTimerRead = readOwnPropOnce(state, 'comboTimer');
  const prevFeverTimerRead = readOwnPropOnce(state, 'feverTimer');
  const prevFeverActiveRead = readOwnPropOnce(state, 'feverActive');
  const stateFeverTimer = prevFeverTimerRead.exists && !prevFeverTimerRead.threw
    ? toSafeNum(prevFeverTimerRead.value)
    : 0;
  const stateInFever =
    (Number.isFinite(stateFeverTimer) && stateFeverTimer > EPS) ||
    Boolean(prevFeverActiveRead.exists && !prevFeverActiveRead.threw && prevFeverActiveRead.value);

  const stateCatLevelsRead = readOwnPropOnce(state, 'catcakeLevels');
  const stateCatLevels = stateCatLevelsRead.exists && !stateCatLevelsRead.threw
    ? stateCatLevelsRead.value
    : null;
  const stateDevTrayRead = readOwnPropOnce(state, 'devTrayLv');
  const stateDevTrayLv = stateDevTrayRead.exists && !stateDevTrayRead.threw
    ? safeInt(stateDevTrayRead.value, 0, 0, 2)
    : 0;
  const statePatronRead = readOwnPropOnce(state, 'patronId');
  const statePatronVal = statePatronRead.exists && !statePatronRead.threw
    ? statePatronRead.value
    : null;
  const stateLunaRead = readOwnPropOnce(state, 'lunaNextServeBoost');
  const stateLunaActive = Boolean(
    stateLunaRead.exists && !stateLunaRead.threw && stateLunaRead.value
  );

  const ctxCatLevels = distinctCtx ? getOwn(distinctCtx, 'catcakeLevels', null) : null;
  const ctxDevTrayRead = distinctCtx ? readOwnPropOnce(distinctCtx, 'devTrayLv') : { exists: false };
  const ctxDevUpgrades = distinctCtx ? getOwn(distinctCtx, 'deviceUpgrades', null) : null;
  const ctxComboRead = distinctCtx ? readOwnPropOnce(distinctCtx, 'comboCount') : { exists: false };
  const ctxLunaNextRead = distinctCtx
    ? readOwnPropOnce(distinctCtx, 'lunaNextServeBoost')
    : { exists: false };
  const ctxLunaBoostRead = distinctCtx
    ? readOwnPropOnce(distinctCtx, 'lunaBoost')
    : { exists: false };
  const ctxPatronRead = distinctCtx ? readOwnPropOnce(distinctCtx, 'patronId') : { exists: false };

  const ctxFeverIsRead = distinctCtx ? readOwnPropOnce(distinctCtx, 'isFever') : { exists: false };
  const ctxFeverActRead = distinctCtx
    ? readOwnPropOnce(distinctCtx, 'feverActive')
    : { exists: false };
  const ctxFeverTimRead = distinctCtx
    ? readOwnPropOnce(distinctCtx, 'feverTimer')
    : { exists: false };

  const hasExplicitCtxLuna =
    (ctxLunaNextRead.exists && !ctxLunaNextRead.threw && ctxLunaNextRead.value !== undefined) ||
    (ctxLunaBoostRead.exists && !ctxLunaBoostRead.threw && ctxLunaBoostRead.value !== undefined);
  const consumesStateLunaBoost = !hasExplicitCtxLuna && stateLunaActive;

  if (consumesStateLunaBoost && !canMutateProp(state, 'lunaNextServeBoost')) {
    return { served: false };
  }

  let resolvedDevTrayLv = stateDevTrayLv;
  if (ctxDevTrayRead.exists && !ctxDevTrayRead.threw && ctxDevTrayRead.value !== undefined) {
    resolvedDevTrayLv = safeInt(ctxDevTrayRead.value, 0, 0, 2);
  } else if (isPlainObj(ctxDevUpgrades)) {
    const dtUpRead = readOwnPropOnce(ctxDevUpgrades, 'dev_tray');
    if (dtUpRead.exists && !dtUpRead.threw) {
      resolvedDevTrayLv = safeInt(dtUpRead.value, 0, 0, 2);
    }
  }

  const effectiveScoreCtx = {
    catcakeLevels: isPlainObj(ctxCatLevels)
      ? ctxCatLevels
      : isPlainObj(stateCatLevels)
        ? stateCatLevels
        : null,
    devTrayLv: resolvedDevTrayLv,
    patronId:
      ctxPatronRead.exists && !ctxPatronRead.threw
        ? ctxPatronRead.value
        : statePatronVal,
    comboCount:
      ctxComboRead.exists && !ctxComboRead.threw && ctxComboRead.value !== undefined
        ? ctxComboRead.value
        : nextCombo,
    lunaNextServeBoost: hasExplicitCtxLuna
      ? Boolean(
          ctxLunaNextRead.exists && !ctxLunaNextRead.threw && ctxLunaNextRead.value !== undefined
            ? ctxLunaNextRead.value
            : ctxLunaBoostRead.value
        )
      : stateLunaActive,
    isFever:
      ctxFeverIsRead.exists || ctxFeverActRead.exists || ctxFeverTimRead.exists
        ? Boolean(
            ctxFeverIsRead.exists
              ? !ctxFeverIsRead.threw && ctxFeverIsRead.value
              : ctxFeverActRead.exists
                ? !ctxFeverActRead.threw && ctxFeverActRead.value
                : !ctxFeverTimRead.threw && toSafeNum(ctxFeverTimRead.value) > 0
          )
        : stateInFever
  };

  const scoreGain = computeServeScoreFromSnapshots(
    winner.orderMeta,
    winner.slotSnap,
    winner.pairedScoreEntries,
    effectiveScoreCtx,
    null
  );

  // Atomic Commit: build savedTraySlots strictly from traySnap & traySlotReads (zero re-reads)
  const curTrayBound = traySnap.length;
  const savedTraySlots = [];
  for (let i = 0; i < winner.usedTrayIndices.length; i++) {
    const tIdx = winner.usedTrayIndices[i];
    if (
      typeof tIdx !== 'number' ||
      !Number.isInteger(tIdx) ||
      tIdx < 0 ||
      tIdx >= curTrayBound ||
      !traySnap[tIdx]
    ) {
      return { served: false };
    }
    safePush(savedTraySlots, {
      idx: tIdx,
      prevRead: traySlotReads[tIdx]
    });
  }
  const savedSeatRead = seatSlotReads[winner.seatIdx];

  function rollbackTraySlots(limitIdx) {
    for (let r = 0; r <= limitIdx && r < savedTraySlots.length; r++) {
      restorePropSnapshot(tray, savedTraySlots[r].idx, savedTraySlots[r].prevRead);
    }
  }

  // 1. Clear matched tray slots & verify
  for (let i = 0; i < savedTraySlots.length; i++) {
    const idx = savedTraySlots[i].idx;
    if (!verifiedWriteProp(tray, idx, null)) {
      rollbackTraySlots(i);
      return { served: false };
    }
  }

  // 2. Clear customer seat & verify
  if (!verifiedWriteProp(seats, winner.seatIdx, null)) {
    restorePropSnapshot(seats, winner.seatIdx, savedSeatRead);
    rollbackTraySlots(savedTraySlots.length - 1);
    return { served: false };
  }

  // 3. Commit ordersServed (when own or extensible) so score & ordersServed never desynchronize
  const ordersServedRead = readOwnPropOnce(state, 'ordersServed');
  const prevServed = ordersServedRead.exists && !ordersServedRead.threw
    ? safeInt(ordersServedRead.value, 0, 0, 1000000)
    : 0;
  const nextServed = prevServed + 1;
  const shouldCommitServed = ordersServedRead.exists || safeIsExtensible(state);
  if (shouldCommitServed) {
    if (!verifiedWriteProp(state, 'ordersServed', nextServed)) {
      restorePropSnapshot(state, 'ordersServed', ordersServedRead);
      restorePropSnapshot(seats, winner.seatIdx, savedSeatRead);
      rollbackTraySlots(savedTraySlots.length - 1);
      return { served: false };
    }
  }

  // 4. Consume one-shot Luna next-serve boost atomically when claimed from state
  if (consumesStateLunaBoost) {
    if (!verifiedWriteProp(state, 'lunaNextServeBoost', false)) {
      restorePropSnapshot(state, 'lunaNextServeBoost', stateLunaRead);
      if (shouldCommitServed) {
        restorePropSnapshot(state, 'ordersServed', ordersServedRead);
      }
      restorePropSnapshot(seats, winner.seatIdx, savedSeatRead);
      rollbackTraySlots(savedTraySlots.length - 1);
      return { served: false };
    }
  }

  // 5. SOLE SCORE MUTATION IN THE ENTIRE CODEBASE (own-property / defineProperty isolated)
  const prevScoreRead = readOwnPropOnce(state, 'score');
  const prevScore = prevScoreRead.exists && !prevScoreRead.threw
    ? safeInt(prevScoreRead.value, 0, 0, 100000000)
    : 0;
  const nextScore = prevScore + scoreGain;
  let scoreWriteOk = false;
  if (prevScoreRead.exists) {
    try {
      state.score = nextScore;
      scoreWriteOk = true;
    } catch (_) {
      scoreWriteOk = false;
    }
  } else if (safeIsExtensible(state)) {
    try {
      Object.defineProperty(state, 'score', {
        __proto__: null,
        value: nextScore,
        writable: true,
        enumerable: true,
        configurable: true
      });
      scoreWriteOk = true;
    } catch (_) {
      scoreWriteOk = false;
    }
  }
  const postScoreRead = scoreWriteOk
    ? readOwnPropOnce(state, 'score')
    : { exists: false, value: undefined, threw: true };
  const actualScore = postScoreRead.exists && !postScoreRead.threw ? postScoreRead.value : undefined;
  const scoreVerified =
    scoreWriteOk &&
    postScoreRead.exists &&
    !postScoreRead.threw &&
    (Object.is(actualScore, nextScore) || (actualScore === 0 && nextScore === 0));

  if (!scoreVerified) {
    restorePropSnapshot(state, 'score', prevScoreRead);
    if (consumesStateLunaBoost) {
      restorePropSnapshot(state, 'lunaNextServeBoost', stateLunaRead);
    }
    if (shouldCommitServed) {
      restorePropSnapshot(state, 'ordersServed', ordersServedRead);
    }
    restorePropSnapshot(seats, winner.seatIdx, savedSeatRead);
    rollbackTraySlots(savedTraySlots.length - 1);
    return { served: false };
  }

  // 6. Advance Serve Combo & Run Statistics
  if (!verifiedWriteProp(state, 'comboCount', nextCombo)) {
    restorePropSnapshot(state, 'comboCount', prevComboRead);
  }
  if (!verifiedWriteProp(state, 'comboTimer', SERVE_COMBO_WINDOW_SEC)) {
    restorePropSnapshot(state, 'comboTimer', prevComboTimerRead);
  }
  const maxComboRead = readOwnPropOnce(state, 'maxCombo');
  const prevMaxCombo = maxComboRead.exists && !maxComboRead.threw
    ? safeInt(maxComboRead.value, 0, 0, 9999)
    : 0;
  if (nextCombo > prevMaxCombo) {
    if (!verifiedWriteProp(state, 'maxCombo', nextCombo)) {
      restorePropSnapshot(state, 'maxCombo', maxComboRead);
    }
  }

  const bestServeRead = readOwnPropOnce(state, 'highestSingleServe');
  const prevBestServe = bestServeRead.exists && !bestServeRead.threw
    ? safeInt(bestServeRead.value, 0, 0, 100000000)
    : 0;
  if (scoreGain > prevBestServe) {
    if (!verifiedWriteProp(state, 'highestSingleServe', scoreGain)) {
      restorePropSnapshot(state, 'highestSingleServe', bestServeRead);
    }
  }

  if (!consumesStateLunaBoost) {
    if (!verifiedWriteProp(state, 'lunaNextServeBoost', false)) {
      restorePropSnapshot(state, 'lunaNextServeBoost', stateLunaRead);
    }
  }

  // 7. VIP bonus stardust envelope (+5 per VIP critic, using snapshotted orderMeta)
  let dustBonus = 0;
  if (winner.isVip) {
    const vipServedRead = readOwnPropOnce(state, 'vipServed');
    const prevVipServed = vipServedRead.exists && !vipServedRead.threw
      ? safeInt(vipServedRead.value, 0, 0, 10000)
      : 0;
    if (!verifiedWriteProp(state, 'vipServed', prevVipServed + 1)) {
      restorePropSnapshot(state, 'vipServed', vipServedRead);
    }
    dustBonus = winner.orderMeta.hasRewardDustBonus ? winner.orderMeta.rewardDustBonus : 5;
    const bonusDustRead = readOwnPropOnce(state, 'bonusDustEarned');
    const prevBonusDust = bonusDustRead.exists && !bonusDustRead.threw
      ? safeInt(bonusDustRead.value, 0, 0, 100000)
      : 0;
    if (!verifiedWriteProp(state, 'bonusDustEarned', prevBonusDust + dustBonus)) {
      restorePropSnapshot(state, 'bonusDustEarned', bonusDustRead);
    }
  }

  // 8. Charge Starlight Fever energy (when not currently in Fever)
  let triggeredFever = false;
  if (!stateInFever) {
    const feverGain = winner.isVip
      ? FEVER_CONFIG.gainVip
      : winner.pRatio > PATIENCE_TIP_BANDS.greenThreshold
        ? FEVER_CONFIG.gainGreen
        : FEVER_CONFIG.gainNormal;
    const prevFeverEnergyRead = readOwnPropOnce(state, 'feverEnergy');
    const prevEnergy = prevFeverEnergyRead.exists && !prevFeverEnergyRead.threw
      ? safeInt(prevFeverEnergyRead.value, 0, 0, 100)
      : 0;
    const nextEnergy = Math.min(100, prevEnergy + feverGain);
    if (nextEnergy >= 100) {
      if (
        verifiedWriteProp(state, 'feverEnergy', 0) &&
        verifiedWriteProp(state, 'feverActive', true) &&
        verifiedWriteProp(state, 'feverTimer', FEVER_CONFIG.durationSec)
      ) {
        triggeredFever = true;
      } else {
        restorePropSnapshot(state, 'feverEnergy', prevFeverEnergyRead);
        restorePropSnapshot(state, 'feverActive', prevFeverActiveRead);
        restorePropSnapshot(state, 'feverTimer', prevFeverTimerRead);
        triggeredFever = false;
      }
    } else {
      if (!verifiedWriteProp(state, 'feverEnergy', nextEnergy)) {
        restorePropSnapshot(state, 'feverEnergy', prevFeverEnergyRead);
      }
    }
  }

  // 9. Patron active skill energy gain (+40% VIP, +28% normal)
  const skillChargeGain = winner.isVip ? 40 : 28;

  // 10. Clear preferredSeatIdx if matched (reusing stPrefRead) & start turnover cooldown
  const rng = wrapRng(rawScoreCtx ? getOwn(rawScoreCtx, 'rng', null) : null);
  if (stPrefRead.exists && !stPrefRead.threw && stPrefRead.value === winner.seatIdx) {
    if (!verifiedWriteProp(state, 'preferredSeatIdx', null)) {
      restorePropSnapshot(state, 'preferredSeatIdx', stPrefRead);
    }
  }
  const seatCooldownsRead = readOwnPropOnce(state, 'seatCooldowns');
  const seatCooldowns = seatCooldownsRead.exists && !seatCooldownsRead.threw
    ? seatCooldownsRead.value
    : null;
  if (safeIsArray(seatCooldowns) && !safeIsFrozen(seatCooldowns)) {
    const cdPrevRead = readOwnPropOnce(seatCooldowns, winner.seatIdx);
    if (!verifiedWriteProp(seatCooldowns, winner.seatIdx, computeTurnoverCooldown(state, rng))) {
      restorePropSnapshot(seatCooldowns, winner.seatIdx, cdPrevRead);
    }
  }

  // 11. Update snapshots in memory and refresh order marks with zero live re-reads
  for (let i = 0; i < savedTraySlots.length; i++) {
    safeSetIdx(traySnap, savedTraySlots[i].idx, null);
  }
  safeSetIdx(seatRecords, winner.seatIdx, null);
  applyOrderMarksFromSnapshots(state, seatRecords, traySnap);

  return {
    served: true,
    seatIdx: winner.seatIdx,
    order: winner.order,
    usedTrayIndices: winner.usedTrayIndices,
    usedTiles: winner.usedTiles,
    scoreGain,
    dustBonus,
    triggeredFever,
    skillChargeGain
  };
}

function getRecipeMaxTier(recipe) {
  if (!isPlainObj(recipe)) return 1;
  const slots = getOwn(recipe, 'slots', null);
  const len = safeArrayLen(slots, MAX_ORDER_SLOTS);
  let m = 1;
  for (let i = 0; i < len; i++) {
    const sl = getOwn(slots, i, null);
    const t = isPlainObj(sl) ? safeInt(getOwn(sl, 'tier', 1), 1, 1, 7) : 1;
    if (t > m) m = t;
  }
  return m;
}

function recipeHasFlavor(recipe, flv) {
  if (!isPlainObj(recipe)) return false;
  const slots = getOwn(recipe, 'slots', null);
  const len = safeArrayLen(slots, MAX_ORDER_SLOTS);
  for (let i = 0; i < len; i++) {
    const sl = getOwn(slots, i, null);
    if (isPlainObj(sl) && getOwn(sl, 'flavor', 'any') === flv) return true;
  }
  return false;
}

function pickWeightedItem(items, weights, rng) {
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] > 0) total += weights[i];
  }
  if (!(total > 0)) {
    return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
  }
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    if (weights[i] <= 0) continue;
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}

function computeOrderPatienceSec(recipe, customerDef, devTeapotLv) {
  const recSlots = isPlainObj(recipe) ? getOwn(recipe, 'slots', null) : null;
  const slotCount = clamp(safeArrayLen(recSlots, MAX_ORDER_SLOTS), 1, 3);
  const maxRecipeTier = getRecipeMaxTier(recipe);
  const baseBySlots = slotCount === 1 ? 23.0 : slotCount === 2 ? 28.5 : 33.5;
  const tierAllowance = Math.max(0, maxRecipeTier - 3) * 0.8;
  const basePatienceSec = clamp(baseBySlots + tierAllowance, 22.0, 36.0);
  const teapotBonus = TEAPOT_PATIENCE_BONUSES[clamp(devTeapotLv, 0, 3)] || 0;
  const rawPatMult = isPlainObj(customerDef)
    ? toSafeNum(getOwn(customerDef, 'patienceMult', 1.0), 1.0)
    : 1.0;
  const patMult = Number.isFinite(rawPatMult) && rawPatMult > 0 ? rawPatMult : 1.0;
  const mult = patMult * (1 + teapotBonus);
  return Math.round(basePatienceSec * mult * 100) / 100;
}

function arrayHasInt(arr, target, maxCap) {
  const len = safeArrayLen(arr, maxCap);
  for (let i = 0; i < len; i++) {
    if (getOwn(arr, i, null) === target) return true;
  }
  return false;
}

function buildSpawnContextOnce(state, boardFlavors) {
  const ownAllowedRead = readOwnPropOnce(state, 'allowedRecipes');
  const ownAllowed = ownAllowedRead.exists && !ownAllowedRead.threw ? ownAllowedRead.value : null;
  const allowedLen = safeArrayLen(ownAllowed, MAX_LIST_CAP);
  const pool = [];
  for (let i = 0; i < allowedLen; i++) {
    const idRead = readOwnPropOnce(ownAllowed, i);
    const id = idRead.exists && !idRead.threw ? idRead.value : null;
    if (typeof id === 'string' && hasOwn(RECIPES, id)) {
      const recObj = getOwn(RECIPES, id, null);
      if (isPlainObj(recObj)) safePush(pool, recObj);
    }
  }
  if (pool.length === 0) {
    safePush(pool, RECIPES.R01, RECIPES.R02, RECIPES.R03);
  }

  let minPoolMaxTier = getRecipeMaxTier(pool[0]);
  for (let i = 1; i < pool.length; i++) {
    const rMax = getRecipeMaxTier(pool[i]);
    if (rMax < minPoolMaxTier) minPoolMaxTier = rMax;
  }

  const boardFlavorMap = Object.assign(Object.create(null), { plain: true });
  const bfLen = safeArrayLen(boardFlavors, MAX_LIST_CAP);
  for (let i = 0; i < bfLen; i++) {
    const fRead = readOwnPropOnce(boardFlavors, i);
    const f = fRead.exists && !fRead.threw ? fRead.value : null;
    if (typeof f === 'string' && VALID_FLAVORS[f] === true) {
      boardFlavorMap[f] = true;
    }
  }

  const ordersServedRead = readOwnPropOnce(state, 'ordersServed');
  const ordersServed = ordersServedRead.exists && !ordersServedRead.threw
    ? safeInt(ordersServedRead.value, 0, 0, 1000000)
    : 0;

  const vipSpawnedRead = readOwnPropOnce(state, 'vipSpawned');
  const vipSpawned = vipSpawnedRead.exists && !vipSpawnedRead.threw
    ? safeInt(vipSpawnedRead.value, 0, 0, 100)
    : 0;

  const vipQuotaRead = readOwnPropOnce(state, 'vipQuotaTarget');
  const vipQuotaTarget = vipQuotaRead.exists && !vipQuotaRead.threw
    ? safeInt(vipQuotaRead.value, 0, 0, 100)
    : 0;

  const vipSchedRead = readOwnPropOnce(state, 'vipScheduleTimes');
  const rawVipSched = vipSchedRead.exists && !vipSchedRead.threw ? vipSchedRead.value : null;
  const vipSchedLen = safeArrayLen(rawVipSched, MAX_LIST_CAP);
  const vipScheduleSnap = [];
  for (let i = 0; i < vipSchedLen; i++) {
    const msRead = readOwnPropOnce(rawVipSched, i);
    safePush(vipScheduleSnap, msRead.exists && !msRead.threw ? toSafeNum(msRead.value, -1) : -1);
  }

  const vipFixedRead = readOwnPropOnce(state, 'vipFixedRecipeId');
  const vipFixedId = vipFixedRead.exists && !vipFixedRead.threw ? vipFixedRead.value : null;

  const urgRateRead = readOwnPropOnce(state, 'urgentRate');
  const rawUrgentRate = urgRateRead.exists && !urgRateRead.threw ? toSafeNum(urgRateRead.value, 0) : 0;
  const baseUrgRate = Number.isFinite(rawUrgentRate) ? clamp(rawUrgentRate, 0, 1) : 0;

  const chapterRead = readOwnPropOnce(state, 'chapter');
  const chapter = chapterRead.exists && !chapterRead.threw
    ? safeInt(chapterRead.value, 1, 1, 3)
    : 1;

  const teapotRead = readOwnPropOnce(state, 'devTeapotLv');
  const devTeapotLv = teapotRead.exists && !teapotRead.threw
    ? safeInt(teapotRead.value, 0, 0, 3)
    : 0;

  const nextUidRead = readOwnPropOnce(state, 'nextOrderUid');
  const nextOrderUid = nextUidRead.exists && !nextUidRead.threw
    ? safeInt(nextUidRead.value, 1, 1, 1000000000)
    : 1;

  return {
    pool,
    minPoolMaxTier,
    boardFlavorMap,
    ordersServed,
    vipSpawned,
    vipSpawnedRead,
    vipQuotaTarget,
    vipScheduleSnap,
    vipFixedId,
    baseUrgRate,
    chapter,
    devTeapotLv,
    nextOrderUid,
    nextUidRead
  };
}

function planCustomerForSeatFromSnap(
  spawnCtx,
  seatRecords,
  seatLimit,
  seatIdx,
  boardMaxTier,
  curTimeLeft,
  inRush,
  rng
) {
  const { pool, minPoolMaxTier, boardFlavorMap } = spawnCtx;
  const effMax = Math.max(2, safeInt(boardMaxTier, 2, 1, 7));
  const accessibleCap = Math.max(minPoolMaxTier, effMax);
  const relaxedAccessibleCap = Math.max(minPoolMaxTier, effMax + 1);

  let otherCount = 0;
  let hasAccessibleOther = false;
  let seatedVipCount = 0;
  let seatedUrgentCount = 0;
  const seatedRecipeIds = Object.create(null);
  const seatedCustomerIds = Object.create(null);

  for (let s = 0; s < seatLimit; s++) {
    if (s === seatIdx) continue;
    const osRec = seatRecords[s];
    if (!osRec) continue;
    otherCount += 1;

    const osSlots = osRec.slotSnap;
    let osMax = 1;
    for (let j = 0; j < osSlots.length; j++) {
      if (osSlots[j].valid && osSlots[j].tier > osMax) {
        osMax = osSlots[j].tier;
      }
    }
    const osMeta = osRec.orderMeta;
    if (osMeta && osMeta.isVip) seatedVipCount += 1;
    if (osMeta && osMeta.isUrgent) seatedUrgentCount += 1;
    if ((!osMeta || !osMeta.isVip) && osMax <= relaxedAccessibleCap) {
      hasAccessibleOther = true;
    }
    if (typeof osRec.recipeId === 'string') {
      seatedRecipeIds[osRec.recipeId] = true;
    }
    if (osMeta && osMeta.custId !== '') {
      seatedCustomerIds[osMeta.custId] = true;
    }
  }

  const mustBeAccessible =
    (otherCount === 2 && !hasAccessibleOther) ||
    (otherCount === 0 && spawnCtx.ordersServed === 0);

  const vipSpawned = spawnCtx.vipSpawned;
  const vipRemaining = Math.max(0, spawnCtx.vipQuotaTarget - vipSpawned);
  const nextVipMilestone =
    vipSpawned >= 0 && vipSpawned < spawnCtx.vipScheduleSnap.length
      ? spawnCtx.vipScheduleSnap[vipSpawned]
      : -1;
  const milestoneOverdue =
    Number.isFinite(nextVipMilestone) &&
    (curTimeLeft <= nextVipMilestone - 5.0 || curTimeLeft <= 60.0);
  const maxConcurrentVips = milestoneOverdue ? 2 : 1;

  const canSpawnVip =
    vipRemaining > 0 &&
    Number.isFinite(nextVipMilestone) &&
    curTimeLeft <= nextVipMilestone + EPS &&
    seatedVipCount < maxConcurrentVips &&
    (!mustBeAccessible ||
      (seatedVipCount === 0 && curTimeLeft <= nextVipMilestone - 4.0) ||
      (milestoneOverdue && hasAccessibleOther) ||
      curTimeLeft <= 45.0);

  let customerDef = getOwn(CUSTOMER_MAP, 'cust_ragdoll', null);
  let chosenRecipe = pool[0];
  let didSpawnVip = false;

  if (canSpawnVip) {
    customerDef = getOwn(CUSTOMER_MAP, 'cust_critic', customerDef);
    didSpawnVip = true;

    const vipFixedId = spawnCtx.vipFixedId;
    if (typeof vipFixedId === 'string' && hasOwn(RECIPES, vipFixedId)) {
      chosenRecipe = getOwn(RECIPES, vipFixedId, chosenRecipe);
    } else {
      let vipPool = [];
      for (let i = 0; i < pool.length; i++) {
        const r = pool[i];
        if (
          getRecipeMaxTier(r) >= 5 ||
          recipeHasFlavor(r, 'matcha') ||
          recipeHasFlavor(r, 'berry')
        ) {
          safePush(vipPool, r);
        }
      }
      if (vipPool.length === 0) vipPool = pool;

      const distinctVip = [];
      for (let i = 0; i < vipPool.length; i++) {
        if (!seatedRecipeIds[getOwn(vipPool[i], 'id', '')]) {
          safePush(distinctVip, vipPool[i]);
        }
      }
      if (distinctVip.length > 0) vipPool = distinctVip;

      const weights = [];
      for (let i = 0; i < vipPool.length; i++) {
        const r = vipPool[i];
        const rMax = getRecipeMaxTier(r);
        const rSlotLen = safeArrayLen(getOwn(r, 'slots', null), MAX_ORDER_SLOTS);
        let w = 1.0;
        if (rMax <= effMax + 1) w *= 1.8;
        else if (rMax === effMax + 2) w *= 1.0;
        else w *= 0.45;
        if (rSlotLen >= 2) w *= 1.25;
        safePush(weights, w);
      }
      chosenRecipe = pickWeightedItem(vipPool, weights, rng);
    }
  } else {
    let candidates = pool;
    if (mustBeAccessible) {
      const acc = [];
      for (let i = 0; i < pool.length; i++) {
        if (getRecipeMaxTier(pool[i]) <= accessibleCap) {
          safePush(acc, pool[i]);
        }
      }
      if (acc.length === 0) {
        for (let i = 0; i < pool.length; i++) {
          if (getRecipeMaxTier(pool[i]) <= relaxedAccessibleCap) {
            safePush(acc, pool[i]);
          }
        }
      }
      if (acc.length > 0) candidates = acc;
    }

    const distinctCandidates = [];
    for (let i = 0; i < candidates.length; i++) {
      if (!seatedRecipeIds[getOwn(candidates[i], 'id', '')]) {
        safePush(distinctCandidates, candidates[i]);
      }
    }
    if (distinctCandidates.length > 0) {
      candidates = distinctCandidates;
    }

    const effUrgentProb =
      seatedUrgentCount >= 1
        ? 0
        : mustBeAccessible
          ? spawnCtx.baseUrgRate * 0.4
          : Math.min(0.65, spawnCtx.baseUrgRate * (inRush ? 1.25 : 1.0));

    if (effUrgentProb > 0 && rng() < effUrgentProb) {
      customerDef = getOwn(CUSTOMER_MAP, 'cust_fox', customerDef);
    } else {
      let hasMatchaCand = false;
      let hasBerryCand = false;
      let hasThreeCand = false;
      for (let i = 0; i < candidates.length; i++) {
        const cr = candidates[i];
        if (!hasMatchaCand && recipeHasFlavor(cr, 'matcha')) hasMatchaCand = true;
        if (!hasBerryCand && recipeHasFlavor(cr, 'berry')) hasBerryCand = true;
        if (!hasThreeCand && safeArrayLen(getOwn(cr, 'slots', null), MAX_ORDER_SLOTS) === 3) {
          hasThreeCand = true;
        }
      }
      const chapter = spawnCtx.chapter;

      const custDefs = [];
      const custWeights = [];
      for (let i = 0; i < REGULAR_CUSTOMER_IDS.length; i++) {
        const cDef = getOwn(CUSTOMER_MAP, REGULAR_CUSTOMER_IDS[i], customerDef);
        safePush(custDefs, cDef);
        const cId = isPlainObj(cDef) ? getOwn(cDef, 'id', '') : '';
        let w = 1.0;
        if (cId === 'cust_silver') w = hasMatchaCand ? 1.6 : 0.6;
        else if (cId === 'cust_rabbit') w = hasBerryCand ? 1.6 : 0.7;
        else if (cId === 'cust_ragdoll') w = chapter === 1 ? 1.4 : 0.9;
        else if (cId === 'cust_orange') w = inRush ? 1.5 : 1.2;
        else if (cId === 'cust_raccoon') w = hasThreeCand ? (inRush ? 1.5 : 1.2) : 0.5;
        else if (cId === 'cust_shiba') w = 1.1;

        if (seatedCustomerIds[cId]) w *= 0.35;
        safePush(custWeights, w);
      }
      customerDef = pickWeightedItem(custDefs, custWeights, rng);
    }

    const prefFlavor = isPlainObj(customerDef)
      ? getOwn(customerDef, 'preferredFlavor', 'any')
      : 'any';
    const prefSlotCounts = isPlainObj(customerDef)
      ? getOwn(customerDef, 'preferredSlotCounts', null)
      : null;
    const prefMaxTier = isPlainObj(customerDef)
      ? toSafeNum(getOwn(customerDef, 'preferredMaxTier', NaN), NaN)
      : NaN;

    const recipeWeights = [];
    for (let i = 0; i < candidates.length; i++) {
      const r = candidates[i];
      let w = 1.0;
      const rMax = getRecipeMaxTier(r);
      const rSlots = getOwn(r, 'slots', null);
      const rSlotLen = safeArrayLen(rSlots, MAX_ORDER_SLOTS);
      if (typeof prefFlavor === 'string' && prefFlavor !== '' && prefFlavor !== 'any') {
        if (recipeHasFlavor(r, prefFlavor)) w *= 2.6;
      }
      if (arrayHasInt(prefSlotCounts, rSlotLen, 8)) {
        w *= 1.6;
      }
      if (Number.isFinite(prefMaxTier) && prefMaxTier > 0 && rMax <= prefMaxTier) {
        w *= 1.4;
      }
      if (inRush && rSlotLen >= 2) {
        w *= rSlotLen === 3 ? 1.65 : 1.35;
      }

      let flavorsReady = true;
      for (let s = 0; s < rSlotLen; s++) {
        const slObj = getOwn(rSlots, s, null);
        const rf = isPlainObj(slObj) ? getOwn(slObj, 'flavor', 'any') : 'any';
        if (rf !== 'any' && !boardFlavorMap[rf] && !boardFlavorMap.gold) {
          flavorsReady = false;
          break;
        }
      }
      if (flavorsReady) w *= 1.35;

      if (rMax <= effMax) w *= 1.5;
      else if (rMax === effMax + 1) w *= 1.15;
      else if (rMax === effMax + 2) w *= 0.55;
      else w *= 0.20;

      safePush(recipeWeights, w);
    }

    chosenRecipe = pickWeightedItem(candidates, recipeWeights, rng);
  }

  const maxPatience = computeOrderPatienceSec(chosenRecipe, customerDef, spawnCtx.devTeapotLv);
  const uid = spawnCtx.nextOrderUid;

  const chosenSlots = isPlainObj(chosenRecipe) ? getOwn(chosenRecipe, 'slots', null) : null;
  const chosenSlotLen = safeArrayLen(chosenSlots, MAX_ORDER_SLOTS);
  const freshSlots = [];
  const freshSlotSnap = [];
  for (let i = 0; i < chosenSlotLen; i++) {
    const sl = getOwn(chosenSlots, i, null);
    const tier = isPlainObj(sl) ? safeInt(getOwn(sl, 'tier', 1), 1, 1, 7) : 1;
    const rawFlv = isPlainObj(sl) ? getOwn(sl, 'flavor', 'any') : 'any';
    const normFlv =
      typeof rawFlv === 'string' && VALID_REQ_FLAVORS[rawFlv.trim()] === true
        ? rawFlv.trim()
        : 'any';
    const slotObj = {
      tier,
      flavor: rawFlv,
      matchedTrayIdx: -1
    };
    safePush(freshSlots, slotObj);
    safePush(freshSlotSnap, {
      valid: tier >= 1 && tier <= 7,
      tier,
      flavor: normFlv
    });
  }

  const customerId = isPlainObj(customerDef)
    ? getOwn(customerDef, 'id', 'cust_ragdoll')
    : 'cust_ragdoll';
  const customerName = isPlainObj(customerDef) ? getOwn(customerDef, 'name', '') : '';
  const bountyMult = isPlainObj(customerDef)
    ? toSafeNum(getOwn(customerDef, 'bountyMult', 1.0), 1.0)
    : 1.0;
  const isVip = Boolean(isPlainObj(customerDef) && getOwn(customerDef, 'isVip', false));
  const isUrgent = Boolean(isPlainObj(customerDef) && getOwn(customerDef, 'isUrgent', false));
  const rewardDustBonus = isPlainObj(customerDef)
    ? safeInt(getOwn(customerDef, 'rewardDustBonus', 0), 0, 0, 50)
    : 0;
  const recipeId = isPlainObj(chosenRecipe) ? getOwn(chosenRecipe, 'id', 'R01') : 'R01';
  const recipeName = isPlainObj(chosenRecipe) ? getOwn(chosenRecipe, 'name', '') : '';

  const customer = {
    uid,
    seatIdx,
    customerId,
    customerName,
    bountyMult,
    isVip,
    isUrgent,
    rewardDustBonus,
    recipeId,
    recipeName,
    slots: freshSlots,
    slotMatches: createNullArray(freshSlots.length),
    readyToServe: false,
    patience: maxPatience,
    maxPatience
  };

  const seatRecord = {
    seatIdx,
    seat: customer,
    slotSnap: freshSlotSnap,
    ownSlotObjs: freshSlots,
    orderMeta: {
      isObj: true,
      patRead: { exists: true, value: maxPatience, threw: false },
      maxPatRead: { exists: true, value: maxPatience, threw: false },
      candPRatio: 1,
      scorePRatio: 1,
      custId: typeof customerId === 'string' ? customerId : '',
      explicitIsVip: isVip,
      explicitIsUrgent: isUrgent,
      isVip: Boolean(isVip || customerId === 'cust_critic'),
      isUrgent: Boolean(isUrgent || customerId === 'cust_fox'),
      hasBountyMult: true,
      bountyMult,
      hasRewardDustBonus: true,
      rewardDustBonus
    },
    recipeId: typeof recipeId === 'string' ? recipeId : null
  };

  return {
    customer,
    seatRecord,
    didSpawnVip
  };
}

/**
 * Advances level countdown, combo/fever/freeze timers, customer patience, angry walkouts,
 * turnover cooldowns, and new customer waves (0 score mutations).
 */
function stepCustomers(state, dt, arg3, arg4) {
  const emptyTick = {
    spawnedSeats: [],
    angryLeftSeats: [],
    comboExpired: false,
    feverEnded: false
  };

  if (safeIsFrozen(state) || !canMutateProp(state, 'timeLeft')) {
    return emptyTick;
  }
  const arrs = readOrderStateArrays(state);
  if (!arrs) {
    return emptyTick;
  }
  const { seats, tray } = arrs;
  if (safeIsFrozen(seats)) {
    return emptyTick;
  }

  const safeDt = toSafeNum(dt);
  if (!Number.isFinite(safeDt) || safeDt <= 0) {
    return emptyTick;
  }

  // Normalize polymorphic 3rd & 4th arguments
  let externalFreezeActive = false;
  let opts = null;

  if (typeof arg3 === 'number') {
    externalFreezeActive = Number.isFinite(arg3) && arg3 > 0;
    opts = isPlainObj(arg4) ? arg4 : null;
  } else if (typeof arg3 === 'boolean') {
    externalFreezeActive = arg3;
    opts = isPlainObj(arg4) ? arg4 : null;
  } else if (typeof arg3 === 'function') {
    opts = { rng: arg3 };
  } else if (isPlainObj(arg3)) {
    opts = arg3;
    const faRead = readOwnPropOnce(opts, 'freezeActive');
    if (faRead.exists && !faRead.threw && faRead.value === true) {
      externalFreezeActive = true;
    } else if (opts !== state) {
      const ftRead = readOwnPropOnce(opts, 'freezeTimer');
      if (ftRead.exists && !ftRead.threw && toSafeNum(ftRead.value, 0) > 0) {
        externalFreezeActive = true;
      }
    }
  }

  const bmRead = opts ? readOwnPropOnce(opts, 'boardMaxTier') : { exists: false };
  const mtRead = !bmRead.exists && opts ? readOwnPropOnce(opts, 'maxTier') : { exists: false };
  const boardMaxTier = bmRead.exists
    ? safeInt(!bmRead.threw ? bmRead.value : 2, 2, 1, 7)
    : mtRead.exists
      ? safeInt(!mtRead.threw ? mtRead.value : 2, 2, 1, 7)
      : 2;

  const optBfRead = opts ? readOwnPropOnce(opts, 'boardFlavors') : { exists: false };
  const optFlvRead =
    (!optBfRead.exists || optBfRead.threw || !safeIsArray(optBfRead.value)) && opts
      ? readOwnPropOnce(opts, 'flavors')
      : { exists: false };
  const defaultFlavors = [];
  safePush(defaultFlavors, 'plain');
  const boardFlavors =
    optBfRead.exists && !optBfRead.threw && safeIsArray(optBfRead.value)
      ? optBfRead.value
      : optFlvRead.exists && !optFlvRead.threw && safeIsArray(optFlvRead.value)
        ? optFlvRead.value
        : defaultFlavors;

  const rngRead = opts ? readOwnPropOnce(opts, 'rng') : { exists: false };
  const rng = wrapRng(rngRead.exists && !rngRead.threw ? rngRead.value : null);

  // 1. Piecewise analytical patience decay over [0, safeDt]
  const freezeSnap = readFreezeTimerSnapshotsOnce(state);
  const prevFreeze = freezeSnap.effective;

  const prevFeverTimerRead = readOwnPropOnce(state, 'feverTimer');
  const prevFeverActiveRead = readOwnPropOnce(state, 'feverActive');
  const rawPrevFever = prevFeverTimerRead.exists && !prevFeverTimerRead.threw
    ? toSafeNum(prevFeverTimerRead.value)
    : 0;
  const flagFever = Boolean(
    prevFeverActiveRead.exists && !prevFeverActiveRead.threw && prevFeverActiveRead.value === true
  );
  const prevFever =
    Number.isFinite(rawPrevFever) && rawPrevFever > 0
      ? rawPrevFever
      : flagFever
        ? FEVER_CONFIG.durationSec
        : 0;

  let patienceDecay = 0;
  if (!externalFreezeActive) {
    const freezeSpan = Math.min(safeDt, prevFreeze);
    const unfrozenSpan = safeDt - freezeSpan;
    const feverUnfrozenSpan = Math.max(0, Math.min(safeDt, prevFever) - freezeSpan);
    const normalUnfrozenSpan = unfrozenSpan - feverUnfrozenSpan;
    patienceDecay = feverUnfrozenSpan * FEVER_CONFIG.patienceDecayMult + normalUnfrozenSpan;
  }

  // 2. Advance global level, combo, fever & freeze timers
  const prevTimeLeftRead = readOwnPropOnce(state, 'timeLeft');
  const prevTimeLeft = prevTimeLeftRead.exists && !prevTimeLeftRead.threw
    ? toSafeNum(prevTimeLeftRead.value, 0)
    : 0;
  const nextTimeLeft =
    Number.isFinite(prevTimeLeft) && prevTimeLeft > safeDt + EPS ? prevTimeLeft - safeDt : 0;
  if (!verifiedWriteProp(state, 'timeLeft', nextTimeLeft)) {
    restorePropSnapshot(state, 'timeLeft', prevTimeLeftRead);
    return emptyTick;
  }

  const prevElapsedRead = readOwnPropOnce(state, 'elapsedSec');
  const prevElapsed = prevElapsedRead.exists && !prevElapsedRead.threw
    ? toSafeNum(prevElapsedRead.value, 0)
    : 0;
  const nextElapsed = (Number.isFinite(prevElapsed) && prevElapsed >= 0 ? prevElapsed : 0) + safeDt;
  if (!verifiedWriteProp(state, 'elapsedSec', nextElapsed)) {
    restorePropSnapshot(state, 'elapsedSec', prevElapsedRead);
  }

  const rushStartRead = readOwnPropOnce(state, 'rushStartSec');
  const rushEndRead = readOwnPropOnce(state, 'rushEndSec');
  const rushStartVal = rushStartRead.exists && !rushStartRead.threw
    ? toSafeNum(rushStartRead.value, NaN)
    : NaN;
  const rushEndVal = rushEndRead.exists && !rushEndRead.threw
    ? toSafeNum(rushEndRead.value, NaN)
    : NaN;
  const inRush = computeInRushFromNums(nextTimeLeft, rushStartVal, rushEndVal);
  const prevRushActRead = readOwnPropOnce(state, 'rushHourActive');
  if (!verifiedWriteProp(state, 'rushHourActive', inRush)) {
    restorePropSnapshot(state, 'rushHourActive', prevRushActRead);
  }

  const prevComboCountRead = readOwnPropOnce(state, 'comboCount');
  let curComboCount = prevComboCountRead.exists && !prevComboCountRead.threw
    ? safeInt(prevComboCountRead.value, 0, 0, 9999)
    : 0;
  const hadCombo = curComboCount > 0;
  const prevComboTimerRead = readOwnPropOnce(state, 'comboTimer');
  const rawComboTimer = prevComboTimerRead.exists && !prevComboTimerRead.threw
    ? toSafeNum(prevComboTimerRead.value, 0)
    : 0;
  const effComboTimer =
    Number.isFinite(rawComboTimer) && rawComboTimer > 0
      ? rawComboTimer
      : hadCombo
        ? SERVE_COMBO_WINDOW_SEC
        : 0;
  if (effComboTimer > 0) {
    const nextComboTimer = effComboTimer > safeDt + EPS ? effComboTimer - safeDt : 0;
    if (!verifiedWriteProp(state, 'comboTimer', nextComboTimer)) {
      restorePropSnapshot(state, 'comboTimer', prevComboTimerRead);
    }
    if (nextComboTimer === 0) {
      if (verifiedWriteProp(state, 'comboCount', 0)) {
        curComboCount = 0;
      } else {
        restorePropSnapshot(state, 'comboCount', prevComboCountRead);
      }
    }
  } else {
    if (!verifiedWriteProp(state, 'comboTimer', 0)) {
      restorePropSnapshot(state, 'comboTimer', prevComboTimerRead);
    }
  }

  const hadFever = prevFever > EPS || flagFever;
  const nextFever = prevFever > safeDt + EPS ? prevFever - safeDt : 0;
  const okFeverTimer = verifiedWriteProp(state, 'feverTimer', nextFever);
  if (!okFeverTimer) {
    restorePropSnapshot(state, 'feverTimer', prevFeverTimerRead);
  }
  const okFeverAct = verifiedWriteProp(state, 'feverActive', nextFever > 0);
  if (!okFeverAct) {
    restorePropSnapshot(state, 'feverActive', prevFeverActiveRead);
  }
  const feverEnded = hadFever && !(nextFever > 0) && okFeverTimer && okFeverAct;

  const nextFreeze = prevFreeze > safeDt + EPS ? prevFreeze - safeDt : 0;
  writeVerifiedFreezeMirrors(state, nextFreeze, freezeSnap);

  // 3. Snapshot seats ONCE at entry, decay patience & handle 0-patience angry walkouts
  const {
    seatRecords,
    seatReads: seatSlotReads,
    wasEmpty: wasEmptyAtEntry,
    seatLimit
  } = snapshotSeatsArrayOnce(
    seats,
    { withMeta: true, withRecipeId: true },
    new Map(),
    new Map()
  );

  const justVacated = [];
  safePush(justVacated, false, false, false);
  const angryLeftSeats = [];

  const seatCdPropRead = readOwnPropOnce(state, 'seatCooldowns');
  let seatCooldowns = seatCdPropRead.exists && !seatCdPropRead.threw ? seatCdPropRead.value : null;
  if (!safeIsArray(seatCooldowns) || safeIsFrozen(seatCooldowns)) {
    const freshCds = [];
    safePush(freshCds, 0, 0, 0);
    if (verifiedWriteProp(state, 'seatCooldowns', freshCds)) {
      seatCooldowns = freshCds;
    } else {
      restorePropSnapshot(state, 'seatCooldowns', seatCdPropRead);
      seatCooldowns = freshCds;
    }
  }

  const stPrefRead = readOwnPropOnce(state, 'preferredSeatIdx');
  let prefCleared = false;
  let angryWalkoutsRead = null;
  let curAngryWalkouts = 0;
  const processedSeats = new Set();

  for (let s = 0; s < seatLimit; s++) {
    const rec = seatRecords[s];
    if (!rec) continue;
    const seat = rec.seat;
    if (safeIsFrozen(seat) || !canMutateProp(seat, 'patience')) continue;
    if (processedSeats.has(seat)) continue;
    processedSeats.add(seat);

    const patRead = rec.orderMeta ? rec.orderMeta.patRead : { exists: false };
    const curPat = patRead.exists && !patRead.threw ? toSafeNum(patRead.value, 0) : 0;
    const nextPat = Number.isFinite(curPat) ? Math.max(0, curPat - patienceDecay) : 0;

    if (nextPat <= EPS) {
      if (!canMutateProp(seats, s)) {
        continue;
      }
      if (!verifiedWriteProp(seat, 'patience', 0)) {
        restorePropSnapshot(seat, 'patience', patRead);
        continue;
      }
      if (!verifiedWriteProp(seats, s, null)) {
        restorePropSnapshot(seats, s, seatSlotReads[s]);
        restorePropSnapshot(seat, 'patience', patRead);
        continue;
      }

      safeSetIdx(seatRecords, s, null);
      safeSetIdx(justVacated, s, true);
      safePush(angryLeftSeats, s);

      if (!angryWalkoutsRead) {
        angryWalkoutsRead = readOwnPropOnce(state, 'angryWalkouts');
        curAngryWalkouts = angryWalkoutsRead.exists && !angryWalkoutsRead.threw
          ? safeInt(angryWalkoutsRead.value, 0, 0, 100000)
          : 0;
      }
      const prevWalkSnap = {
        exists: angryWalkoutsRead.exists,
        value: curAngryWalkouts,
        threw: angryWalkoutsRead.threw
      };
      if (verifiedWriteProp(state, 'angryWalkouts', curAngryWalkouts + 1)) {
        curAngryWalkouts += 1;
        angryWalkoutsRead = { exists: true, value: curAngryWalkouts, threw: false };
      } else {
        restorePropSnapshot(state, 'angryWalkouts', prevWalkSnap);
      }

      if (verifiedWriteProp(state, 'comboCount', 0)) {
        curComboCount = 0;
      } else {
        restorePropSnapshot(state, 'comboCount', prevComboCountRead);
      }
      if (!verifiedWriteProp(state, 'comboTimer', 0)) {
        restorePropSnapshot(state, 'comboTimer', prevComboTimerRead);
      }
      if (!prefCleared && stPrefRead.exists && !stPrefRead.threw && stPrefRead.value === s) {
        if (verifiedWriteProp(state, 'preferredSeatIdx', null)) {
          prefCleared = true;
        } else {
          restorePropSnapshot(state, 'preferredSeatIdx', stPrefRead);
        }
      }
      const cdPrevRead = readOwnPropOnce(seatCooldowns, s);
      if (!verifiedWriteProp(seatCooldowns, s, computeTurnoverCooldownFromInRush(inRush, rng))) {
        restorePropSnapshot(seatCooldowns, s, cdPrevRead);
      }
    } else {
      if (!verifiedWriteProp(seat, 'patience', nextPat)) {
        restorePropSnapshot(seat, 'patience', patRead);
      }
    }
  }

  // 4. Advance empty-seat cooldowns & spawn new customers when timeLeft >= closingGuardSec
  const cgRead = readOwnPropOnce(state, 'closingGuardSec');
  const parsedClosingGuard = cgRead.exists && !cgRead.threw ? toSafeNum(cgRead.value) : NaN;
  const closingGuard =
    cgRead.exists && Number.isFinite(parsedClosingGuard)
      ? Math.max(0, parsedClosingGuard)
      : CLOSING_GUARD_SEC;

  const spawnedSeats = [];
  let spawnCtx = null;

  for (let s = 0; s < seatLimit; s++) {
    if (wasEmptyAtEntry[s] && !justVacated[s] && canMutateProp(seats, s)) {
      const cdRead = readOwnPropOnce(seatCooldowns, s);
      const curCd = cdRead.exists && !cdRead.threw ? toSafeNum(cdRead.value, 0) : 0;
      const nextCd = Number.isFinite(curCd) && curCd > safeDt + EPS ? curCd - safeDt : 0;
      if (!verifiedWriteProp(seatCooldowns, s, nextCd)) {
        restorePropSnapshot(seatCooldowns, s, cdRead);
        continue;
      }

      if (nextCd === 0 && nextTimeLeft >= closingGuard - EPS) {
        if (!spawnCtx) {
          spawnCtx = buildSpawnContextOnce(state, boardFlavors);
        }
        const plan = planCustomerForSeatFromSnap(
          spawnCtx,
          seatRecords,
          seatLimit,
          s,
          boardMaxTier,
          nextTimeLeft,
          inRush,
          rng
        );

        if (!verifiedWriteProp(seats, s, plan.customer)) {
          restorePropSnapshot(seats, s, seatSlotReads[s]);
          continue;
        }

        const prevUidSnap = {
          exists: spawnCtx.nextUidRead.exists,
          value: spawnCtx.nextOrderUid,
          threw: spawnCtx.nextUidRead.threw
        };
        if (verifiedWriteProp(state, 'nextOrderUid', spawnCtx.nextOrderUid + 1)) {
          spawnCtx.nextOrderUid += 1;
          spawnCtx.nextUidRead = { exists: true, value: spawnCtx.nextOrderUid, threw: false };
        } else {
          restorePropSnapshot(state, 'nextOrderUid', prevUidSnap);
        }

        if (plan.didSpawnVip) {
          const prevVipSnap = {
            exists: spawnCtx.vipSpawnedRead.exists,
            value: spawnCtx.vipSpawned,
            threw: spawnCtx.vipSpawnedRead.threw
          };
          if (verifiedWriteProp(state, 'vipSpawned', spawnCtx.vipSpawned + 1)) {
            spawnCtx.vipSpawned += 1;
            spawnCtx.vipSpawnedRead = { exists: true, value: spawnCtx.vipSpawned, threw: false };
          } else {
            restorePropSnapshot(state, 'vipSpawned', prevVipSnap);
          }
        }

        safeSetIdx(seatRecords, s, plan.seatRecord);
        safePush(spawnedSeats, s);
      }
    }
  }

  if (spawnedSeats.length > 0 || angryLeftSeats.length > 0) {
    const traySnap = snapshotTrayTiles(tray, new Map());
    applyOrderMarksFromSnapshots(state, seatRecords, traySnap);
  }

  const comboExpired = hadCombo && curComboCount === 0;
  return {
    spawnedSeats,
    angryLeftSeats,
    comboExpired,
    feverEnded
  };
}

/**
 * Mikan Patron Active Skill: restores +45% patience to all seated customers and freezes
 * patience decay for 5.0 seconds (keeps state.freezeTimer mirrored with state.patienceFreezeTimer).
 */
function applyMikanComfortTea(state) {
  if (
    safeIsFrozen(state) ||
    !canMutateProp(state, 'patienceFreezeTimer') ||
    !canMutateProp(state, 'freezeTimer') ||
    (hasOwn(state, 'mikanFreezeTimer') && !canMutateProp(state, 'mikanFreezeTimer'))
  ) {
    return { boostedSeats: 0, freezeSec: 5.0 };
  }
  const arrs = readOrderStateArrays(state);
  if (!arrs) {
    return { boostedSeats: 0, freezeSec: 5.0 };
  }
  const { seats } = arrs;

  const freezeSnap = readFreezeTimerSnapshotsOnce(state);
  const targetFreeze = Math.max(freezeSnap.effective, 5.0);
  if (!writeVerifiedFreezeMirrors(state, targetFreeze, freezeSnap)) {
    return { boostedSeats: 0, freezeSec: 5.0 };
  }

  let boostedSeats = 0;
  const seatLimit = safeArrayLen(seats, SEAT_COUNT);
  const seenSeats = new Set();
  for (let i = 0; i < seatLimit; i++) {
    const seatRead = readOwnPropOnce(seats, i);
    const seat = seatRead.exists && !seatRead.threw ? seatRead.value : null;
    if (!isPlainObj(seat) || seenSeats.has(seat)) continue;
    seenSeats.add(seat);
    if (safeIsFrozen(seat) || !canMutateProp(seat, 'patience')) continue;

    const mpRead = readOwnPropOnce(seat, 'maxPatience');
    const pRead = readOwnPropOnce(seat, 'patience');
    const mp = mpRead.exists && !mpRead.threw ? toSafeNum(mpRead.value, 0) : 0;
    const p = pRead.exists && !pRead.threw ? toSafeNum(pRead.value, 0) : 0;
    if (Number.isFinite(mp) && mp > 0 && Number.isFinite(p)) {
      const nextPat = Math.min(mp, Math.max(0, p) + 0.45 * mp);
      if (verifiedWriteProp(seat, 'patience', nextPat)) {
        boostedSeats += 1;
      } else {
        restorePropSnapshot(seat, 'patience', pRead);
      }
    }
  }

  return { boostedSeats, freezeSec: 5.0 };
}

/**
 * Computes end-of-level 0..3 star rating and stardust breakdown.
 * Enforces Pure Serve-Only Scoring Iron Law: 0 serves => 0 valid score and 0 consolation dust.
 */
function computeLevelSettlement(levelCfgOrId, orderState, prevStarsOrSave) {
  const lvl = resolveLevelConfig(levelCfgOrId);
  const stars = safeArrayLen(lvl.stars, 8) >= 3 ? lvl.stars : [750, 1050, 1400];
  const firstStarDust =
    safeArrayLen(lvl.firstStarDust, 8) >= 3
      ? lvl.firstStarDust
      : [15, 20, 30];
  const baseClearDust = safeInt(lvl.baseClearDust, 10, 0, 200);

  const os = isPlainObj(orderState) ? orderState : null;
  const ordersServed = os ? safeInt(getOwn(os, 'ordersServed', 0), 0, 0, 100000) : 0;
  const rawScore = os ? safeInt(getOwn(os, 'score', 0), 0, 0, 100000000) : 0;
  const score = ordersServed >= 1 ? rawScore : 0;
  const vipServed =
    ordersServed >= 1 && os ? safeInt(getOwn(os, 'vipServed', 0), 0, 0, 1000) : 0;

  let prevStars = 0;
  if (typeof prevStarsOrSave === 'number' || typeof prevStarsOrSave === 'string') {
    prevStars = safeInt(prevStarsOrSave, 0, 0, 3);
  } else if (isPlainObj(prevStarsOrSave)) {
    const rawLevelStars = getOwn(prevStarsOrSave, 'levelStars', null);
    const map = isPlainObj(rawLevelStars) ? rawLevelStars : prevStarsOrSave;
    if (lvl && typeof lvl.id === 'string' && hasOwn(map, lvl.id)) {
      prevStars = safeInt(getOwn(map, lvl.id, 0), 0, 0, 3);
    }
  }

  const star1 = Math.max(1, safeInt(getOwn(stars, 0, 750), 750, 1, 100000000));
  const star2 = Math.max(star1 + 1, safeInt(getOwn(stars, 1, 1050), 1050, 1, 100000000));
  const star3 = Math.max(star2 + 1, safeInt(getOwn(stars, 2, 1400), 1400, 1, 100000000));

  const starsEarned = score >= star3 ? 3 : score >= star2 ? 2 : score >= star1 ? 1 : 0;
  const cleared = starsEarned >= 1;
  const newStarsDelta = Math.max(0, starsEarned - prevStars);

  let firstStarDustAward = 0;
  for (let s = prevStars; s < starsEarned; s++) {
    firstStarDustAward += safeInt(getOwn(firstStarDust, s, 0), 0, 0, 500);
  }

  let clearDustAward = 0;
  let vipDustAward = 0;
  let threeStarBonusDust = 0;
  let consolationDust = 0;

  if (cleared) {
    clearDustAward = baseClearDust;
    vipDustAward = vipServed * 5;
    threeStarBonusDust = starsEarned === 3 ? 8 : 0;
  } else if (ordersServed >= 1) {
    consolationDust = Math.max(5, Math.floor((score / star1) * 8));
    vipDustAward = vipServed * 5;
  }

  const totalDustAward =
    firstStarDustAward +
    clearDustAward +
    vipDustAward +
    threeStarBonusDust +
    consolationDust;

  return {
    cleared,
    starsEarned,
    newStarsDelta,
    firstStarDustAward,
    clearDustAward,
    vipDustAward,
    threeStarBonusDust,
    consolationDust,
    totalDustAward
  };
}

module.exports = {
  createOrderState,
  stepCustomers,
  tryPlaceToTray,
  discardTraySlot,
  matchCustomerWithTray,
  refreshAllOrderMarks,
  getNeededBoardTiers,
  matchTrayToCustomer,
  computeServeScore,
  applyMikanComfortTea,
  computeLevelSettlement
};
