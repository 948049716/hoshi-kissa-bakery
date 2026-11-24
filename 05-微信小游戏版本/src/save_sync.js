/**
 * Save Data Schema v2, Lossless v1->v2 Migration & Multi-Device Cloud Merge Engine
 * Shared by client `game_app.js` and `platform.js` for Hoshi Kissa Bakery v2.0.
 */
'use strict';

const {
  STORAGE_KEY,
  DEFAULT_INITIAL_STARDUST,
  CATCAKE_UPGRADE_COSTS,
  DEVICE_UPGRADE_COSTS,
  PATRON_COSTS,
  normalizePatronId,
  THEME_COSTS,
  SHOP_TOTAL_CAP
} = require('./constants');

const {
  CHAPTERS,
  VALID_LEVEL_IDS,
  getLevelById,
  computeTotalStars,
  isLevelUnlocked
} = require('./levels_data');

const SCHEMA_VERSION = 2;
const MAX_OFFLINE_STARDUST_DELTA = 1500;
const MAX_SAFE_STARDUST = 9999999;
const MAX_CONSUMABLE_SPENT_STARDUST = MAX_SAFE_STARDUST - SHOP_TOTAL_CAP;
const MAX_TOTAL_CUMULATIVE_SCORE = 3450000;
const MAX_TIMESTAMP_MS = 9999999999999;

const LEGACY_RUN_STORAGE_KEYS = [
  'hoshi_kissa_active_run_v1',
  'hoshi_kissa_active_runs_v2',
  'hoshi_kissa_saved_runs_v2'
];

// Frozen legacy v1 shop & progression caps strictly for v1 -> v2 reconstruction
const V1_MAX_PLAUSIBLE_CHEF = 350000;
const V1_MAX_PLAUSIBLE_RUSH = 85000;
const V1_MAX_PLAUSIBLE_ZEN = 180000;
const V1_PATRON_COSTS = { mikan: 0, luna: 60, mugi: 100 };
const V1_THEME_COSTS = { amber: 0, sakura: 80, moonlight: 120 };
const V1_UPGRADE_COSTS = {
  up_tools: [40, 90, 160],
  up_fever: [50, 100, 180],
  up_combo: [60, 120, 200],
  up_dust: [45, 95, 170]
};
const V1_UPGRADE_KEYS = ['up_tools', 'up_fever', 'up_combo', 'up_dust'];

const TUTORIAL_KEYS = ['intro_slide', 'tray_trash', 'flavor_tile', 'ice_tile'];
const DEVICE_KEYS = ['dev_tray', 'dev_flour', 'dev_teapot', 'dev_tools'];

const KNOWN_PATRON_INPUTS = new Set([
  'mikan',
  'chef_mikan',
  'luna',
  'patron_luna',
  'mugi',
  'patron_mugi'
]);

const CHAPTER_SCORE_CAPS = {};
for (let i = 0; i < CHAPTERS.length; i++) {
  const ch = CHAPTERS[i];
  CHAPTER_SCORE_CAPS[ch.chapter] = ch.maxScoreAntiCheatCap;
}

function hasOwn(obj, key) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  try {
    return Object.prototype.hasOwnProperty.call(obj, key);
  } catch (_) {
    return false;
  }
}

function getOwn(obj, key) {
  if (!hasOwn(obj, key)) return undefined;
  try {
    return obj[key];
  } catch (_) {
    return undefined;
  }
}

function safeIsArray(v) {
  try {
    return Array.isArray(v);
  } catch (_) {
    return false;
  }
}

function safeArrayLength(arr) {
  if (!safeIsArray(arr)) return 0;
  try {
    const len = arr.length;
    return typeof len === 'number' && len > 0 ? len : 0;
  } catch (_) {
    return 0;
  }
}

function safeArrayAt(arr, idx) {
  if (!safeIsArray(arr) || !hasOwn(arr, idx)) return undefined;
  try {
    return arr[idx];
  } catch (_) {
    return undefined;
  }
}

function isPlainRecord(v) {
  if (v === null || v === undefined || typeof v !== 'object') return false;
  try {
    return !Array.isArray(v);
  } catch (_) {
    return false;
  }
}

function toSafeNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '') return Number(x);
  return NaN;
}

function clampSafeInt(val, min, max, fallback = min) {
  const n = toSafeNum(val);
  if (!Number.isFinite(n)) {
    return fallback === 0 ? 0 : fallback;
  }
  const floored = Math.floor(n);
  if (floored < min) return min === 0 ? 0 : min;
  if (floored > max) return max === 0 ? 0 : max;
  return floored === 0 ? 0 : floored;
}

function canonicalizeKnownPatronId(rawId) {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!KNOWN_PATRON_INPUTS.has(trimmed)) return null;
  return normalizePatronId(trimmed);
}

function sanitizeUnlockedPatrons(rawArr) {
  const seen = new Set(['mikan']);
  const out = ['mikan'];
  if (safeIsArray(rawArr)) {
    const len = safeArrayLength(rawArr);
    for (let i = 0; i < len; i++) {
      if (!hasOwn(rawArr, i)) continue;
      const pid = canonicalizeKnownPatronId(safeArrayAt(rawArr, i));
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        out.push(pid);
      }
    }
  }
  return out;
}

function sanitizeUnlockedThemes(rawArr) {
  const seen = new Set(['amber']);
  const out = ['amber'];
  if (safeIsArray(rawArr)) {
    const len = safeArrayLength(rawArr);
    for (let i = 0; i < len; i++) {
      if (!hasOwn(rawArr, i)) continue;
      const rawItem = safeArrayAt(rawArr, i);
      if (typeof rawItem !== 'string') continue;
      const tid = rawItem.trim();
      if (hasOwn(THEME_COSTS, tid) && !seen.has(tid)) {
        seen.add(tid);
        out.push(tid);
      }
    }
  }
  return out;
}

function getLevelScoreCap(levelId) {
  const lvl = getLevelById(levelId);
  if (!lvl) return 35000;
  return hasOwn(CHAPTER_SCORE_CAPS, lvl.chapter) ? CHAPTER_SCORE_CAPS[lvl.chapter] : 220000;
}

function computeCumulativeScore(levelBestScores) {
  if (!isPlainRecord(levelBestScores)) return 0;
  let total = 0;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (!hasOwn(levelBestScores, id)) continue;
    total += clampSafeInt(getOwn(levelBestScores, id), 0, getLevelScoreCap(id), 0);
  }
  return Math.min(MAX_TOTAL_CUMULATIVE_SCORE, total);
}

function computeHighestUnlockedLevel(levelStars) {
  const safeStars = {};
  if (isPlainRecord(levelStars)) {
    for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
      const id = VALID_LEVEL_IDS[i];
      if (!hasOwn(levelStars, id)) continue;
      const s = clampSafeInt(getOwn(levelStars, id), 0, 3, 0);
      if (s > 0) {
        safeStars[id] = s;
      }
    }
  }
  let highest = '1-1';
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (isLevelUnlocked(id, safeStars).unlocked) {
      highest = id;
    } else {
      break;
    }
  }
  return highest;
}

function isHigherSchemaRecord(raw) {
  if (!isPlainRecord(raw)) return false;
  if (hasOwn(raw, 'higherSchemaDetected') && Boolean(getOwn(raw, 'higherSchemaDetected'))) {
    return true;
  }
  if (hasOwn(raw, 'schemaVersion')) {
    const sv = toSafeNum(getOwn(raw, 'schemaVersion'));
    if (Number.isFinite(sv) && sv > SCHEMA_VERSION) {
      return true;
    }
  }
  return false;
}

function createDefaultSave() {
  return {
    schemaVersion: SCHEMA_VERSION,
    bgmTrack: 'waltz',
    sfxEnabled: true,
    bankStardust: DEFAULT_INITIAL_STARDUST,
    totalEarnedStardust: DEFAULT_INITIAL_STARDUST,
    lastSyncedEarnedStardust: 0,
    consumableSpentStardust: 0,
    migratedFromV1GiftPending: false,
    levelStars: {},
    levelBestScores: {},
    levelFailStreaks: {},
    highestUnlockedLevel: '1-1',
    catcakeLevels: {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0,
      '7': 0
    },
    deviceUpgrades: {
      dev_tray: 0,
      dev_flour: 0,
      dev_teapot: 0,
      dev_tools: 0
    },
    selectedPatron: 'mikan',
    unlockedPatrons: ['mikan'],
    equippedTheme: 'amber',
    unlockedThemes: ['amber'],
    seenTutorials: {
      intro_slide: false,
      tray_trash: false,
      flavor_tile: false,
      ice_tile: false
    },
    playerProfile: {
      nickName: '',
      avatarUrl: '',
      avatarPreset: 'mikan',
      authorized: false,
      updatedAt: 0
    },
    lifetimeStats: {
      runsPlayed: 0,
      ordersServed: 0,
      vipServed: 0,
      maxComboEver: 0,
      highestSingleServe: 0,
      totalStars: 0,
      totalCumulativeScore: 0
    },
    updatedAt: 0
  };
}

function normalizeProfile(raw, fallbackPatron = 'mikan') {
  const src = isPlainRecord(raw) ? raw : {};
  const rawPresetVal = getOwn(src, 'avatarPreset');
  const rawPreset = rawPresetVal !== undefined ? canonicalizeKnownPatronId(rawPresetVal) : null;
  const fbPreset = canonicalizeKnownPatronId(fallbackPatron) || 'mikan';
  const preset = rawPreset || fbPreset;
  const rawNickVal = getOwn(src, 'nickName');
  const rawNick = typeof rawNickVal === 'string' ? rawNickVal.trim() : '';
  const rawAvatarVal = getOwn(src, 'avatarUrl');
  const rawAvatar = typeof rawAvatarVal === 'string' ? rawAvatarVal.trim() : '';
  const rawAuthVal = getOwn(src, 'authorized');
  const authorized = rawAuthVal !== undefined ? Boolean(rawAuthVal) : false;
  const rawUpdatedVal = getOwn(src, 'updatedAt');
  const updatedAt = rawUpdatedVal !== undefined ? clampSafeInt(rawUpdatedVal, 0, MAX_TIMESTAMP_MS, 0) : 0;
  return {
    nickName: rawNick ? rawNick.slice(0, 16) : '',
    avatarUrl: rawAvatar ? rawAvatar.slice(0, 512) : '',
    avatarPreset: preset,
    authorized,
    updatedAt
  };
}

function readCatcakeLevel(ccObj, tier) {
  if (!isPlainRecord(ccObj)) return 0;
  const strKey = String(tier);
  if (hasOwn(ccObj, strKey)) {
    return clampSafeInt(getOwn(ccObj, strKey), 0, 4, 0);
  }
  const cKey = `C${tier}`;
  if (hasOwn(ccObj, cKey)) {
    return clampSafeInt(getOwn(ccObj, cKey), 0, 4, 0);
  }
  return 0;
}

function computeSpentStardust(save) {
  if (!isPlainRecord(save)) return 0;
  let spent = 0;

  const cc = getOwn(save, 'catcakeLevels');
  if (isPlainRecord(cc)) {
    for (let tier = 1; tier <= 7; tier++) {
      const lv = readCatcakeLevel(cc, tier);
      const costs = CATCAKE_UPGRADE_COSTS[tier];
      for (let i = 0; i < lv; i++) {
        spent += costs[i] || 0;
      }
    }
  }

  const dev = getOwn(save, 'deviceUpgrades');
  if (isPlainRecord(dev)) {
    for (let k = 0; k < DEVICE_KEYS.length; k++) {
      const key = DEVICE_KEYS[k];
      const costs = DEVICE_UPGRADE_COSTS[key];
      const maxLv = costs.length;
      const lv = hasOwn(dev, key) ? clampSafeInt(getOwn(dev, key), 0, maxLv, 0) : 0;
      for (let i = 0; i < lv; i++) {
        spent += costs[i] || 0;
      }
    }
  }

  const rawPatrons = getOwn(save, 'unlockedPatrons');
  if (safeIsArray(rawPatrons)) {
    const patrons = sanitizeUnlockedPatrons(rawPatrons);
    for (let i = 0; i < patrons.length; i++) {
      const pid = patrons[i];
      if (hasOwn(PATRON_COSTS, pid)) {
        spent += PATRON_COSTS[pid] || 0;
      }
    }
  }

  const rawThemes = getOwn(save, 'unlockedThemes');
  if (safeIsArray(rawThemes)) {
    const themes = sanitizeUnlockedThemes(rawThemes);
    for (let i = 0; i < themes.length; i++) {
      const tid = themes[i];
      if (hasOwn(THEME_COSTS, tid)) {
        spent += THEME_COSTS[tid] || 0;
      }
    }
  }

  if (hasOwn(save, 'consumableSpentStardust')) {
    spent += clampSafeInt(
      getOwn(save, 'consumableSpentStardust'),
      0,
      MAX_CONSUMABLE_SPENT_STARDUST,
      0
    );
  }

  return spent;
}

function sanitizeLevelFailStreaks(rawStreaks) {
  const out = {};
  if (!isPlainRecord(rawStreaks)) return out;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (!hasOwn(rawStreaks, id)) continue;
    const cnt = clampSafeInt(getOwn(rawStreaks, id), 0, 999, 0);
    if (cnt > 0) {
      out[id] = cnt;
    }
  }
  return out;
}

function normalizeV2Save(raw) {
  if (!isPlainRecord(raw)) return createDefaultSave();

  const higherSchema = isHigherSchemaRecord(raw);

  const rawUnlockedPatrons = getOwn(raw, 'unlockedPatrons');
  const unlockedPatrons =
    rawUnlockedPatrons !== undefined ? sanitizeUnlockedPatrons(rawUnlockedPatrons) : ['mikan'];
  const rawSelPatron = getOwn(raw, 'selectedPatron');
  const candPatron = rawSelPatron !== undefined ? canonicalizeKnownPatronId(rawSelPatron) : null;
  const selectedPatron = candPatron && unlockedPatrons.includes(candPatron) ? candPatron : 'mikan';

  const rawUnlockedThemes = getOwn(raw, 'unlockedThemes');
  const unlockedThemes =
    rawUnlockedThemes !== undefined ? sanitizeUnlockedThemes(rawUnlockedThemes) : ['amber'];
  const rawEqTheme = getOwn(raw, 'equippedTheme');
  const candTheme = typeof rawEqTheme === 'string' ? rawEqTheme.trim() : null;
  const equippedTheme = candTheme && unlockedThemes.includes(candTheme) ? candTheme : 'amber';

  const levelStars = {};
  const rawLevelStars = getOwn(raw, 'levelStars');
  const inStars = isPlainRecord(rawLevelStars) ? rawLevelStars : null;
  if (inStars) {
    for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
      const id = VALID_LEVEL_IDS[i];
      if (!hasOwn(inStars, id)) continue;
      const s = clampSafeInt(getOwn(inStars, id), 0, 3, 0);
      if (s > 0) {
        levelStars[id] = s;
      }
    }
  }

  const levelBestScores = {};
  const rawLevelScores = getOwn(raw, 'levelBestScores');
  const inScores = isPlainRecord(rawLevelScores) ? rawLevelScores : null;
  if (inScores) {
    for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
      const id = VALID_LEVEL_IDS[i];
      if (!hasOwn(inScores, id)) continue;
      const sc = clampSafeInt(getOwn(inScores, id), 0, getLevelScoreCap(id), 0);
      if (sc > 0) {
        levelBestScores[id] = sc;
      }
    }
  }

  const levelFailStreaks = sanitizeLevelFailStreaks(getOwn(raw, 'levelFailStreaks'));
  const highestUnlockedLevel = computeHighestUnlockedLevel(levelStars);

  const rawCc = getOwn(raw, 'catcakeLevels');
  const inCc = isPlainRecord(rawCc) ? rawCc : null;
  const catcakeLevels = {
    '1': readCatcakeLevel(inCc, 1),
    '2': readCatcakeLevel(inCc, 2),
    '3': readCatcakeLevel(inCc, 3),
    '4': readCatcakeLevel(inCc, 4),
    '5': readCatcakeLevel(inCc, 5),
    '6': readCatcakeLevel(inCc, 6),
    '7': readCatcakeLevel(inCc, 7)
  };

  const rawDev = getOwn(raw, 'deviceUpgrades');
  const inDev = isPlainRecord(rawDev) ? rawDev : null;
  const deviceUpgrades = {
    dev_tray: inDev && hasOwn(inDev, 'dev_tray') ? clampSafeInt(getOwn(inDev, 'dev_tray'), 0, 2, 0) : 0,
    dev_flour: inDev && hasOwn(inDev, 'dev_flour') ? clampSafeInt(getOwn(inDev, 'dev_flour'), 0, 3, 0) : 0,
    dev_teapot: inDev && hasOwn(inDev, 'dev_teapot') ? clampSafeInt(getOwn(inDev, 'dev_teapot'), 0, 3, 0) : 0,
    dev_tools: inDev && hasOwn(inDev, 'dev_tools') ? clampSafeInt(getOwn(inDev, 'dev_tools'), 0, 3, 0) : 0
  };

  const rawTut = getOwn(raw, 'seenTutorials');
  const inTut = isPlainRecord(rawTut) ? rawTut : null;
  const seenTutorials = {
    intro_slide: Boolean(inTut && getOwn(inTut, 'intro_slide')),
    tray_trash: Boolean(inTut && getOwn(inTut, 'tray_trash')),
    flavor_tile: Boolean(inTut && getOwn(inTut, 'flavor_tile')),
    ice_tile: Boolean(inTut && getOwn(inTut, 'ice_tile'))
  };

  const rawStats = getOwn(raw, 'lifetimeStats');
  const stRaw = isPlainRecord(rawStats) ? rawStats : {};
  const ordersServed = Math.max(
    hasOwn(stRaw, 'ordersServed') ? clampSafeInt(getOwn(stRaw, 'ordersServed'), 0, 9999999, 0) : 0,
    hasOwn(stRaw, 'ordersCompleted')
      ? clampSafeInt(getOwn(stRaw, 'ordersCompleted'), 0, 9999999, 0)
      : 0,
    hasOwn(stRaw, 'servesTotal') ? clampSafeInt(getOwn(stRaw, 'servesTotal'), 0, 9999999, 0) : 0
  );

  const bgmRaw = hasOwn(raw, 'bgmTrack') ? getOwn(raw, 'bgmTrack') : 'waltz';
  const bgmTrack = bgmRaw === 'waltz' || bgmRaw === 'bossa' || bgmRaw === 'off' ? bgmRaw : 'waltz';
  const rawSfx = getOwn(raw, 'sfxEnabled');
  const sfxEnabled = typeof rawSfx === 'boolean' ? rawSfx : true;
  const consumableSpentStardust = hasOwn(raw, 'consumableSpentStardust')
    ? clampSafeInt(getOwn(raw, 'consumableSpentStardust'), 0, MAX_CONSUMABLE_SPENT_STARDUST, 0)
    : 0;
  const migratedFromV1GiftPending = hasOwn(raw, 'migratedFromV1GiftPending')
    ? Boolean(getOwn(raw, 'migratedFromV1GiftPending'))
    : false;

  const out = {
    schemaVersion: SCHEMA_VERSION,
    bgmTrack,
    sfxEnabled,
    bankStardust: DEFAULT_INITIAL_STARDUST,
    totalEarnedStardust: DEFAULT_INITIAL_STARDUST,
    lastSyncedEarnedStardust: 0,
    consumableSpentStardust,
    migratedFromV1GiftPending,
    levelStars,
    levelBestScores,
    levelFailStreaks,
    highestUnlockedLevel,
    catcakeLevels,
    deviceUpgrades,
    selectedPatron,
    unlockedPatrons,
    equippedTheme,
    unlockedThemes,
    seenTutorials,
    playerProfile: normalizeProfile(getOwn(raw, 'playerProfile'), selectedPatron),
    lifetimeStats: {
      runsPlayed: hasOwn(stRaw, 'runsPlayed') ? clampSafeInt(getOwn(stRaw, 'runsPlayed'), 0, 999999, 0) : 0,
      ordersServed,
      vipServed: hasOwn(stRaw, 'vipServed') ? clampSafeInt(getOwn(stRaw, 'vipServed'), 0, 9999999, 0) : 0,
      maxComboEver: hasOwn(stRaw, 'maxComboEver') ? clampSafeInt(getOwn(stRaw, 'maxComboEver'), 0, 999, 0) : 0,
      highestSingleServe: hasOwn(stRaw, 'highestSingleServe')
        ? clampSafeInt(getOwn(stRaw, 'highestSingleServe'), 0, 220000, 0)
        : 0,
      totalStars: computeTotalStars(levelStars),
      totalCumulativeScore: computeCumulativeScore(levelBestScores)
    },
    updatedAt: hasOwn(raw, 'updatedAt') ? clampSafeInt(getOwn(raw, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0) : 0
  };

  if (higherSchema) {
    out.higherSchemaDetected = true;
  }

  const spent = computeSpentStardust(out);
  const rawEarnedVal = getOwn(raw, 'totalEarnedStardust');
  const rawBankVal = getOwn(raw, 'bankStardust');
  const hasExplicitEarned = hasOwn(raw, 'totalEarnedStardust') && Number.isFinite(toSafeNum(rawEarnedVal));
  const hasExplicitBank = hasOwn(raw, 'bankStardust') && Number.isFinite(toSafeNum(rawBankVal));

  let totalEarnedStardust;
  if (hasExplicitEarned) {
    const rawEarned = clampSafeInt(rawEarnedVal, 0, MAX_SAFE_STARDUST, DEFAULT_INITIAL_STARDUST);
    totalEarnedStardust = Math.max(DEFAULT_INITIAL_STARDUST, rawEarned, spent);
  } else if (hasExplicitBank) {
    const rawBank = clampSafeInt(rawBankVal, 0, MAX_SAFE_STARDUST, 0);
    totalEarnedStardust = Math.max(DEFAULT_INITIAL_STARDUST, rawBank + spent);
  } else {
    totalEarnedStardust = Math.max(DEFAULT_INITIAL_STARDUST, DEFAULT_INITIAL_STARDUST + spent);
  }

  out.totalEarnedStardust = Math.min(MAX_SAFE_STARDUST, totalEarnedStardust);
  out.bankStardust = Math.max(0, out.totalEarnedStardust - spent);
  out.lastSyncedEarnedStardust = hasOwn(raw, 'lastSyncedEarnedStardust')
    ? clampSafeInt(getOwn(raw, 'lastSyncedEarnedStardust'), 0, out.totalEarnedStardust, 0)
    : 0;

  return out;
}

function migrateV1ToV2(parsed) {
  if (!isPlainRecord(parsed)) {
    return createDefaultSave();
  }

  const sv = hasOwn(parsed, 'schemaVersion') ? toSafeNum(getOwn(parsed, 'schemaVersion')) : 0;
  if (Number.isFinite(sv) && sv >= SCHEMA_VERSION) {
    return normalizeV2Save(parsed);
  }

  const rawUnlockedPatrons = getOwn(parsed, 'unlockedPatrons');
  const unlockedPatrons =
    rawUnlockedPatrons !== undefined ? sanitizeUnlockedPatrons(rawUnlockedPatrons) : ['mikan'];
  const rawSelPatron = getOwn(parsed, 'selectedPatron');
  const candPatron = rawSelPatron !== undefined ? canonicalizeKnownPatronId(rawSelPatron) : null;
  const selectedPatron = candPatron && unlockedPatrons.includes(candPatron) ? candPatron : 'mikan';

  const rawUnlockedThemes = getOwn(parsed, 'unlockedThemes');
  const unlockedThemes =
    rawUnlockedThemes !== undefined ? sanitizeUnlockedThemes(rawUnlockedThemes) : ['amber'];
  const rawEqTheme = getOwn(parsed, 'equippedTheme');
  const candTheme = typeof rawEqTheme === 'string' ? rawEqTheme.trim() : null;
  const equippedTheme = candTheme && unlockedThemes.includes(candTheme) ? candTheme : 'amber';

  // Reconstruct v1 spent stardust BEFORE dropping legacy shopUpgrades
  let v1Spent = 0;
  for (let i = 0; i < unlockedPatrons.length; i++) {
    const pid = unlockedPatrons[i];
    if (hasOwn(V1_PATRON_COSTS, pid)) {
      v1Spent += V1_PATRON_COSTS[pid] || 0;
    }
  }
  for (let i = 0; i < unlockedThemes.length; i++) {
    const tid = unlockedThemes[i];
    if (hasOwn(V1_THEME_COSTS, tid)) {
      v1Spent += V1_THEME_COSTS[tid] || 0;
    }
  }
  const rawShopUp = getOwn(parsed, 'shopUpgrades');
  const upRaw = isPlainRecord(rawShopUp) ? rawShopUp : {};
  for (let k = 0; k < V1_UPGRADE_KEYS.length; k++) {
    const key = V1_UPGRADE_KEYS[k];
    const lv = hasOwn(upRaw, key) ? clampSafeInt(getOwn(upRaw, key), 0, 3, 0) : 0;
    const costs = V1_UPGRADE_COSTS[key];
    for (let i = 0; i < lv; i++) {
      v1Spent += costs[i] || 0;
    }
  }

  const bestChef = hasOwn(parsed, 'bestChef')
    ? clampSafeInt(getOwn(parsed, 'bestChef'), 0, V1_MAX_PLAUSIBLE_CHEF, 0)
    : 0;
  const bestRush = hasOwn(parsed, 'bestRush')
    ? clampSafeInt(getOwn(parsed, 'bestRush'), 0, V1_MAX_PLAUSIBLE_RUSH, 0)
    : 0;
  const bestZen = hasOwn(parsed, 'bestZen')
    ? clampSafeInt(getOwn(parsed, 'bestZen'), 0, V1_MAX_PLAUSIBLE_ZEN, 0)
    : 0;

  let rawBank = 30;
  if (hasOwn(parsed, 'bankStardust')) {
    const bNum = toSafeNum(getOwn(parsed, 'bankStardust'));
    if (Number.isFinite(bNum)) {
      rawBank = clampSafeInt(bNum, 0, MAX_SAFE_STARDUST, 0);
    }
  }

  const rawEarned = hasOwn(parsed, 'totalEarnedStardust')
    ? clampSafeInt(getOwn(parsed, 'totalEarnedStardust'), 0, MAX_SAFE_STARDUST, 0)
    : 0;
  const v1TotalEarned = Math.max(30, rawEarned, rawBank + v1Spent);

  // Compensate exact v1 -> v0.9.0 price hikes on unlocked patrons/themes so bankStardust has zero deduction
  let migrationBonus = 0;
  for (let i = 0; i < unlockedPatrons.length; i++) {
    const pid = unlockedPatrons[i];
    if (hasOwn(PATRON_COSTS, pid) && hasOwn(V1_PATRON_COSTS, pid)) {
      migrationBonus += Math.max(0, (PATRON_COSTS[pid] || 0) - (V1_PATRON_COSTS[pid] || 0));
    }
  }
  for (let i = 0; i < unlockedThemes.length; i++) {
    const tid = unlockedThemes[i];
    if (hasOwn(THEME_COSTS, tid) && hasOwn(V1_THEME_COSTS, tid)) {
      migrationBonus += Math.max(0, (THEME_COSTS[tid] || 0) - (V1_THEME_COSTS[tid] || 0));
    }
  }
  const isVeteran = bestChef > 0 || bestRush > 0 || bestZen > 0;
  if (isVeteran) {
    migrationBonus += 50;
  }

  const rawGiftFlag = getOwn(parsed, 'migratedFromV1GiftPending');
  const migratedFromV1GiftPending =
    typeof rawGiftFlag === 'boolean' ? rawGiftFlag : isVeteran;

  const totalEarnedStardust = Math.min(MAX_SAFE_STARDUST, v1TotalEarned + migrationBonus);
  const rawSynced = hasOwn(parsed, 'lastSyncedEarnedStardust')
    ? clampSafeInt(getOwn(parsed, 'lastSyncedEarnedStardust'), 0, v1TotalEarned, 0)
    : 0;
  const lastSyncedEarnedStardust =
    rawSynced > 0 ? Math.min(totalEarnedStardust, rawSynced + migrationBonus) : 0;

  const bgmRaw = hasOwn(parsed, 'bgmTrack') ? getOwn(parsed, 'bgmTrack') : 'waltz';
  const bgmTrack = bgmRaw === 'waltz' || bgmRaw === 'bossa' || bgmRaw === 'off' ? bgmRaw : 'waltz';
  const rawSfx = getOwn(parsed, 'sfxEnabled');
  const sfxEnabled = typeof rawSfx === 'boolean' ? rawSfx : true;

  const rawStats = getOwn(parsed, 'lifetimeStats');
  const stRaw = isPlainRecord(rawStats) ? rawStats : {};
  const runsPlayed = hasOwn(stRaw, 'runsPlayed') ? clampSafeInt(getOwn(stRaw, 'runsPlayed'), 0, 999999, 0) : 0;
  const ordersServed = Math.max(
    hasOwn(stRaw, 'ordersServed') ? clampSafeInt(getOwn(stRaw, 'ordersServed'), 0, 9999999, 0) : 0,
    hasOwn(stRaw, 'ordersCompleted')
      ? clampSafeInt(getOwn(stRaw, 'ordersCompleted'), 0, 9999999, 0)
      : 0,
    hasOwn(stRaw, 'servesTotal') ? clampSafeInt(getOwn(stRaw, 'servesTotal'), 0, 9999999, 0) : 0
  );
  const vipServed = hasOwn(stRaw, 'vipServed') ? clampSafeInt(getOwn(stRaw, 'vipServed'), 0, 9999999, 0) : 0;
  const rawCombo = hasOwn(stRaw, 'maxComboEver') ? clampSafeInt(getOwn(stRaw, 'maxComboEver'), 0, 999, 0) : 0;
  const maxComboEver =
    rawCombo === 1 && runsPlayed === 0 && ordersServed === 0 && !isVeteran ? 0 : rawCombo;
  const highestSingleServe = hasOwn(stRaw, 'highestSingleServe')
    ? clampSafeInt(getOwn(stRaw, 'highestSingleServe'), 0, 220000, 0)
    : 0;

  const out = createDefaultSave();
  out.bgmTrack = bgmTrack;
  out.sfxEnabled = sfxEnabled;
  out.migratedFromV1GiftPending = migratedFromV1GiftPending;
  out.selectedPatron = selectedPatron;
  out.unlockedPatrons = unlockedPatrons;
  out.equippedTheme = equippedTheme;
  out.unlockedThemes = unlockedThemes;
  out.playerProfile = normalizeProfile(getOwn(parsed, 'playerProfile'), selectedPatron);
  out.lifetimeStats = {
    runsPlayed,
    ordersServed,
    vipServed,
    maxComboEver,
    highestSingleServe,
    totalStars: 0,
    totalCumulativeScore: 0
  };
  out.updatedAt = hasOwn(parsed, 'updatedAt')
    ? clampSafeInt(getOwn(parsed, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
    : 0;

  const v2Spent = computeSpentStardust(out);
  out.totalEarnedStardust = Math.min(MAX_SAFE_STARDUST, Math.max(30, totalEarnedStardust, v2Spent));
  out.bankStardust = Math.max(0, out.totalEarnedStardust - v2Spent);
  out.lastSyncedEarnedStardust = Math.min(out.totalEarnedStardust, lastSyncedEarnedStardust);

  return out;
}

function normalizeSaveData(raw) {
  if (!isPlainRecord(raw) || Object.keys(raw).length === 0) {
    return createDefaultSave();
  }
  const sv = hasOwn(raw, 'schemaVersion') ? toSafeNum(getOwn(raw, 'schemaVersion')) : 0;
  if (!Number.isFinite(sv) || sv < SCHEMA_VERSION) {
    return migrateV1ToV2(raw);
  }
  return normalizeV2Save(raw);
}

function isPlaceholderNickName(nick) {
  if (typeof nick !== 'string') return true;
  const trimmed = nick.trim();
  if (!trimmed) return true;
  return /^星夜店长#[0-9A-Za-z_-]{1,8}$/.test(trimmed);
}

function mergeProfileRecords(lProf, cProf, preferLocal = true, fallbackPatron = 'mikan') {
  if (cProf.authorized && !lProf.authorized) return { ...cProf };
  if (!cProf.authorized && lProf.authorized) return { ...lProf };

  const lPlaceholder = isDefaultPlaceholderProfile(lProf);
  const cPlaceholder = isDefaultPlaceholderProfile(cProf);
  const lHasCustomNick = !isPlaceholderNickName(lProf.nickName);
  const cHasCustomNick = !isPlaceholderNickName(cProf.nickName);
  const lTs = lProf.updatedAt || 0;
  const cTs = cProf.updatedAt || 0;

  if (cTs > lTs && !cPlaceholder) {
    return {
      ...cProf,
      nickName: cHasCustomNick ? cProf.nickName : lHasCustomNick ? lProf.nickName : cProf.nickName,
      avatarUrl: cProf.avatarUrl || lProf.avatarUrl
    };
  }
  if (lTs > cTs && !lPlaceholder) {
    return {
      ...lProf,
      nickName: lHasCustomNick ? lProf.nickName : cHasCustomNick ? cProf.nickName : lProf.nickName,
      avatarUrl: lProf.avatarUrl || cProf.avatarUrl
    };
  }

  if (cHasCustomNick && !lHasCustomNick && lTs <= cTs) {
    return {
      ...cProf,
      avatarUrl: cProf.avatarUrl || lProf.avatarUrl
    };
  }
  if (lHasCustomNick && !cHasCustomNick && cTs <= lTs) {
    return {
      ...lProf,
      avatarUrl: lProf.avatarUrl || cProf.avatarUrl
    };
  }

  if (lPlaceholder !== cPlaceholder) {
    const chosen = lPlaceholder ? cProf : lProf;
    const other = lPlaceholder ? lProf : cProf;
    const chosenCustom = lPlaceholder ? cHasCustomNick : lHasCustomNick;
    const otherCustom = lPlaceholder ? lHasCustomNick : cHasCustomNick;
    const fallbackNick = preferLocal
      ? lProf.nickName || cProf.nickName
      : cProf.nickName || lProf.nickName;
    return {
      ...chosen,
      nickName: chosenCustom ? chosen.nickName : otherCustom ? other.nickName : fallbackNick,
      avatarUrl: chosen.avatarUrl || other.avatarUrl
    };
  }

  const primary = preferLocal ? lProf : cProf;
  const secondary = preferLocal ? cProf : lProf;
  const fbPreset = canonicalizeKnownPatronId(fallbackPatron) || 'mikan';
  let avatarPreset = primary.avatarPreset;
  if (lPlaceholder && cPlaceholder && avatarPreset === 'mikan') {
    if (fbPreset !== 'mikan') {
      avatarPreset = fbPreset;
    } else if (secondary.avatarPreset && secondary.avatarPreset !== 'mikan') {
      avatarPreset = secondary.avatarPreset;
    }
  }

  return {
    ...primary,
    nickName: primary.nickName || secondary.nickName,
    avatarUrl: primary.avatarUrl || secondary.avatarUrl,
    avatarPreset
  };
}

function isDefaultPlaceholderProfile(prof) {
  if (!isPlainRecord(prof)) return true;
  if (getOwn(prof, 'authorized')) return false;
  if (getOwn(prof, 'avatarUrl')) return false;
  const preset = getOwn(prof, 'avatarPreset');
  if (preset && preset !== 'mikan') return false;
  const ts = getOwn(prof, 'updatedAt');
  if ((typeof ts === 'number' ? ts : 0) > 0) return false;
  return isPlaceholderNickName(getOwn(prof, 'nickName'));
}

function isUntouchedDefaultSave(s) {
  return Boolean(
    s &&
      s.totalEarnedStardust === DEFAULT_INITIAL_STARDUST &&
      computeSpentStardust(s) === 0 &&
      s.lifetimeStats.runsPlayed === 0 &&
      s.lifetimeStats.ordersServed === 0 &&
      s.lifetimeStats.vipServed === 0 &&
      s.lifetimeStats.totalStars === 0 &&
      s.lifetimeStats.totalCumulativeScore === 0 &&
      (!isPlainRecord(s.levelFailStreaks) || Object.keys(s.levelFailStreaks).length === 0) &&
      !s.migratedFromV1GiftPending &&
      s.selectedPatron === 'mikan' &&
      s.equippedTheme === 'amber' &&
      s.bgmTrack === 'waltz' &&
      s.sfxEnabled === true &&
      !s.seenTutorials.intro_slide &&
      !s.seenTutorials.tray_trash &&
      !s.seenTutorials.flavor_tile &&
      !s.seenTutorials.ice_tile &&
      isDefaultPlaceholderProfile(s.playerProfile)
  );
}

function mergeSaveData(localRaw, cloudRaw, cloudProfile = null) {
  const local = normalizeSaveData(localRaw);

  if (!isPlainRecord(cloudRaw)) {
    if (isPlainRecord(cloudProfile)) {
      const cProfCheck = normalizeProfile(cloudProfile, 'mikan');
      const cProf = isDefaultPlaceholderProfile(cProfCheck)
        ? cProfCheck
        : normalizeProfile(cloudProfile, local.selectedPatron);
      local.playerProfile = mergeProfileRecords(
        local.playerProfile,
        cProf,
        !isUntouchedDefaultSave(local),
        local.selectedPatron
      );
    }
    return local;
  }

  const cloud = normalizeSaveData(cloudRaw);
  const higherSchema =
    isHigherSchemaRecord(localRaw) ||
    isHigherSchemaRecord(cloudRaw) ||
    Boolean(local.higherSchemaDetected) ||
    Boolean(cloud.higherSchemaDetected);
  const localUntouched = isUntouchedDefaultSave(local);
  const cloudUntouched = isUntouchedDefaultSave(cloud);
  const preferLocal =
    localUntouched !== cloudUntouched
      ? cloudUntouched
      : (local.updatedAt || 0) >= (cloud.updatedAt || 0);
  const latest = preferLocal ? local : cloud;

  const levelStars = {};
  const levelBestScores = {};
  const levelFailStreaks = {};
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    const s = Math.max(
      hasOwn(local.levelStars, id) ? local.levelStars[id] : 0,
      hasOwn(cloud.levelStars, id) ? cloud.levelStars[id] : 0
    );
    if (s > 0) levelStars[id] = s;

    const sc = Math.max(
      hasOwn(local.levelBestScores, id) ? local.levelBestScores[id] : 0,
      hasOwn(cloud.levelBestScores, id) ? cloud.levelBestScores[id] : 0
    );
    if (sc > 0) levelBestScores[id] = sc;

    if (s === 0) {
      const fs = hasOwn(latest.levelFailStreaks, id)
        ? latest.levelFailStreaks[id]
        : Math.max(
            hasOwn(local.levelFailStreaks, id) ? local.levelFailStreaks[id] : 0,
            hasOwn(cloud.levelFailStreaks, id) ? cloud.levelFailStreaks[id] : 0
          );
      if (fs > 0) {
        levelFailStreaks[id] = fs;
      }
    }
  }

  const highestUnlockedLevel = computeHighestUnlockedLevel(levelStars);

  const catcakeLevels = {};
  for (let tier = 1; tier <= 7; tier++) {
    const k = String(tier);
    catcakeLevels[k] = Math.max(local.catcakeLevels[k] || 0, cloud.catcakeLevels[k] || 0);
  }

  const deviceUpgrades = {
    dev_tray: Math.max(local.deviceUpgrades.dev_tray || 0, cloud.deviceUpgrades.dev_tray || 0),
    dev_flour: Math.max(local.deviceUpgrades.dev_flour || 0, cloud.deviceUpgrades.dev_flour || 0),
    dev_teapot: Math.max(local.deviceUpgrades.dev_teapot || 0, cloud.deviceUpgrades.dev_teapot || 0),
    dev_tools: Math.max(local.deviceUpgrades.dev_tools || 0, cloud.deviceUpgrades.dev_tools || 0)
  };

  const unlockedPatrons = sanitizeUnlockedPatrons([
    ...local.unlockedPatrons,
    ...cloud.unlockedPatrons
  ]);
  const selectedPatron = unlockedPatrons.includes(latest.selectedPatron)
    ? latest.selectedPatron
    : 'mikan';

  const unlockedThemes = sanitizeUnlockedThemes([
    ...local.unlockedThemes,
    ...cloud.unlockedThemes
  ]);
  const equippedTheme = unlockedThemes.includes(latest.equippedTheme)
    ? latest.equippedTheme
    : 'amber';

  const seenTutorials = {};
  for (let i = 0; i < TUTORIAL_KEYS.length; i++) {
    const k = TUTORIAL_KEYS[i];
    seenTutorials[k] = Boolean(local.seenTutorials[k] || cloud.seenTutorials[k]);
  }

  let migratedFromV1GiftPending;
  if (cloudUntouched && !localUntouched) {
    migratedFromV1GiftPending = local.migratedFromV1GiftPending;
  } else if (localUntouched && !cloudUntouched) {
    migratedFromV1GiftPending = cloud.migratedFromV1GiftPending;
  } else {
    migratedFromV1GiftPending = latest.migratedFromV1GiftPending;
  }

  let cProf = cloud.playerProfile;
  if (isPlainRecord(cloudProfile)) {
    const cProfCheck = normalizeProfile(cloudProfile, 'mikan');
    cProf = isDefaultPlaceholderProfile(cProfCheck)
      ? cProfCheck
      : normalizeProfile(cloudProfile, selectedPatron);
  }
  const mergedProfile = mergeProfileRecords(
    local.playerProfile,
    cProf,
    preferLocal,
    selectedPatron
  );

  const merged = {
    schemaVersion: SCHEMA_VERSION,
    bgmTrack: latest.bgmTrack,
    sfxEnabled: latest.sfxEnabled,
    bankStardust: 0,
    totalEarnedStardust: DEFAULT_INITIAL_STARDUST,
    lastSyncedEarnedStardust: 0,
    consumableSpentStardust: clampSafeInt(
      Math.max(local.consumableSpentStardust || 0, cloud.consumableSpentStardust || 0),
      0,
      MAX_CONSUMABLE_SPENT_STARDUST,
      0
    ),
    migratedFromV1GiftPending,
    levelStars,
    levelBestScores,
    levelFailStreaks,
    highestUnlockedLevel,
    catcakeLevels,
    deviceUpgrades,
    selectedPatron,
    unlockedPatrons,
    equippedTheme,
    unlockedThemes,
    seenTutorials,
    playerProfile: mergedProfile,
    lifetimeStats: {
      runsPlayed: Math.max(local.lifetimeStats.runsPlayed, cloud.lifetimeStats.runsPlayed),
      ordersServed: Math.max(local.lifetimeStats.ordersServed, cloud.lifetimeStats.ordersServed),
      vipServed: Math.max(local.lifetimeStats.vipServed, cloud.lifetimeStats.vipServed),
      maxComboEver: Math.max(local.lifetimeStats.maxComboEver, cloud.lifetimeStats.maxComboEver),
      highestSingleServe: Math.max(
        local.lifetimeStats.highestSingleServe,
        cloud.lifetimeStats.highestSingleServe
      ),
      totalStars: computeTotalStars(levelStars),
      totalCumulativeScore: computeCumulativeScore(levelBestScores)
    },
    updatedAt: Math.max(local.updatedAt || 0, cloud.updatedAt || 0, Date.now())
  };

  if (higherSchema) {
    merged.higherSchemaDetected = true;
  }

  const spent = computeSpentStardust(merged);
  const lSync = local.lastSyncedEarnedStardust || 0;
  const cSync = cloud.lastSyncedEarnedStardust || 0;

  const effLocal =
    lSync >= DEFAULT_INITIAL_STARDUST && local.totalEarnedStardust > lSync
      ? lSync + Math.min(MAX_OFFLINE_STARDUST_DELTA, local.totalEarnedStardust - lSync)
      : local.totalEarnedStardust;
  const effCloud =
    cSync >= DEFAULT_INITIAL_STARDUST && cloud.totalEarnedStardust > cSync
      ? cSync + Math.min(MAX_OFFLINE_STARDUST_DELTA, cloud.totalEarnedStardust - cSync)
      : cloud.totalEarnedStardust;

  let additiveEarned = Math.max(DEFAULT_INITIAL_STARDUST, effLocal, effCloud, spent);

  if (lSync >= DEFAULT_INITIAL_STARDUST && local.totalEarnedStardust > lSync && effCloud > lSync) {
    const localDelta = Math.min(MAX_OFFLINE_STARDUST_DELTA, local.totalEarnedStardust - lSync);
    additiveEarned = Math.max(additiveEarned, effCloud + localDelta);
  }

  if (cSync >= DEFAULT_INITIAL_STARDUST && cloud.totalEarnedStardust > cSync && effLocal > cSync) {
    const cloudDelta = Math.min(MAX_OFFLINE_STARDUST_DELTA, cloud.totalEarnedStardust - cSync);
    additiveEarned = Math.max(additiveEarned, effLocal + cloudDelta);
  }

  merged.totalEarnedStardust = Math.min(MAX_SAFE_STARDUST, additiveEarned);
  merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
  merged.bankStardust = Math.max(0, merged.totalEarnedStardust - spent);

  return merged;
}

function readPlatformJSON(platform, key) {
  if (!platform || typeof platform !== 'object') return null;
  try {
    if (typeof platform.getStorageJSON === 'function') {
      return platform.getStorageJSON(key);
    }
    if (typeof platform.getStorageSync === 'function') {
      const raw = platform.getStorageSync(key);
      if (raw === '' || raw === null || raw === undefined) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    if (typeof platform.getItem === 'function') {
      const raw = platform.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
  } catch (_) {}
  return null;
}

function writePlatformJSON(platform, key, value) {
  if (!platform || typeof platform !== 'object') return;
  try {
    if (typeof platform.setStorageJSON === 'function') {
      platform.setStorageJSON(key, value);
      return;
    }
    const serialized = JSON.stringify(value);
    if (typeof platform.setStorageSync === 'function') {
      platform.setStorageSync(key, serialized);
      return;
    }
    if (typeof platform.setItem === 'function') {
      platform.setItem(key, serialized);
    }
  } catch (_) {}
}

function deletePlatformKey(platform, key) {
  if (!platform || typeof platform !== 'object') return;
  try {
    if (typeof platform.removeStorage === 'function') {
      platform.removeStorage(key);
      return;
    }
    if (typeof platform.removeStorageSync === 'function') {
      platform.removeStorageSync(key);
      return;
    }
    if (typeof platform.setStorageSync === 'function') {
      platform.setStorageSync(key, '');
      return;
    }
    if (typeof platform.removeItem === 'function') {
      platform.removeItem(key);
    }
  } catch (_) {}
}

function loadLocalSave(platform) {
  for (let i = 0; i < LEGACY_RUN_STORAGE_KEYS.length; i++) {
    deletePlatformKey(platform, LEGACY_RUN_STORAGE_KEYS[i]);
  }

  const raw = readPlatformJSON(platform, STORAGE_KEY);
  const rawSv = isPlainRecord(raw) ? getOwn(raw, 'schemaVersion') : undefined;
  const wasLegacyV1 =
    isPlainRecord(raw) &&
    (!hasOwn(raw, 'schemaVersion') || !(toSafeNum(rawSv) >= SCHEMA_VERSION));

  const save = normalizeSaveData(raw);
  if (wasLegacyV1) {
    writePlatformJSON(platform, STORAGE_KEY, save);
  }
  return save;
}

function saveLocalSave(platform, save) {
  const now = Date.now();
  const normalized = normalizeSaveData(isPlainRecord(save) ? save : null);
  normalized.updatedAt = now;

  if (isPlainRecord(save)) {
    try {
      if (!Object.isFrozen(save) && Object.isExtensible(save)) {
        const existingKeys = Object.keys(save);
        for (let i = 0; i < existingKeys.length; i++) {
          const k = existingKeys[i];
          if (!hasOwn(normalized, k)) {
            try {
              delete save[k];
            } catch (_) {}
          }
        }
        const normKeys = Object.keys(normalized);
        for (let i = 0; i < normKeys.length; i++) {
          const nk = normKeys[i];
          try {
            save[nk] = normalized[nk];
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  writePlatformJSON(platform, STORAGE_KEY, normalized);
  return normalized;
}

function readFirstStatField(obj, keys, min, max, fallback) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (!hasOwn(obj, k)) continue;
    const val = getOwn(obj, k);
    if (val === undefined) continue;
    return clampSafeInt(val, min, max, fallback);
  }
  return fallback === 0 ? 0 : fallback;
}

function recordLevelSettlementToSave(
  save,
  levelId,
  score,
  starsEarned,
  totalDustAward,
  runStats
) {
  const base = normalizeSaveData(save);
  const lvl = getLevelById(levelId);

  const nextLevelStars = { ...base.levelStars };
  const nextLevelBestScores = { ...base.levelBestScores };
  const nextLevelFailStreaks = { ...(base.levelFailStreaks || {}) };

  if (lvl) {
    const cap = getLevelScoreCap(lvl.id);
    const cleanScore = clampSafeInt(score, 0, cap, 0);

    let cleanStars;
    if (starsEarned === undefined || starsEarned === null) {
      cleanStars =
        cleanScore >= lvl.stars[2]
          ? 3
          : cleanScore >= lvl.stars[1]
          ? 2
          : cleanScore >= lvl.stars[0]
          ? 1
          : 0;
    } else {
      cleanStars = clampSafeInt(starsEarned, 0, 3, 0);
    }

    const prevStars = hasOwn(nextLevelStars, lvl.id) ? nextLevelStars[lvl.id] : 0;
    const mergedStars = Math.max(prevStars, cleanStars);
    if (mergedStars > 0) {
      nextLevelStars[lvl.id] = mergedStars;
    }

    const prevBest = hasOwn(nextLevelBestScores, lvl.id) ? nextLevelBestScores[lvl.id] : 0;
    const mergedBest = Math.max(prevBest, cleanScore);
    if (mergedBest > 0) {
      nextLevelBestScores[lvl.id] = mergedBest;
    }

    if (cleanStars >= 1) {
      delete nextLevelFailStreaks[lvl.id];
    } else {
      const prevStreak = hasOwn(nextLevelFailStreaks, lvl.id) ? nextLevelFailStreaks[lvl.id] : 0;
      nextLevelFailStreaks[lvl.id] = Math.min(999, prevStreak + 1);
    }
  }

  const dustGain = clampSafeInt(totalDustAward, 0, MAX_OFFLINE_STARDUST_DELTA, 0);
  const nextTotalEarned = Math.min(MAX_SAFE_STARDUST, base.totalEarnedStardust + dustGain);

  const rs = isPlainRecord(runStats) ? runStats : {};
  const runsDelta = hasOwn(rs, 'runsPlayedDelta')
    ? clampSafeInt(getOwn(rs, 'runsPlayedDelta'), 0, 10, 1)
    : 1;
  const ordersDelta = readFirstStatField(
    rs,
    ['ordersServed', 'serves', 'ordersCompleted', 'servesTotal'],
    0,
    9999,
    0
  );
  const vipDelta = hasOwn(rs, 'vipServed') ? clampSafeInt(getOwn(rs, 'vipServed'), 0, 999, 0) : 0;
  const runMaxCombo = readFirstStatField(
    rs,
    ['maxCombo', 'maxComboEver', 'comboMax'],
    0,
    999,
    0
  );
  const runBestServe = readFirstStatField(
    rs,
    ['highestSingleServe', 'bestSingleServe', 'maxSingleServe'],
    0,
    220000,
    0
  );

  const candidate = {
    ...base,
    totalEarnedStardust: nextTotalEarned,
    lastSyncedEarnedStardust: base.lastSyncedEarnedStardust,
    levelStars: nextLevelStars,
    levelBestScores: nextLevelBestScores,
    levelFailStreaks: nextLevelFailStreaks,
    lifetimeStats: {
      runsPlayed: Math.min(999999, base.lifetimeStats.runsPlayed + runsDelta),
      ordersServed: Math.min(9999999, base.lifetimeStats.ordersServed + ordersDelta),
      vipServed: Math.min(9999999, base.lifetimeStats.vipServed + vipDelta),
      maxComboEver: Math.max(base.lifetimeStats.maxComboEver, runMaxCombo),
      highestSingleServe: Math.max(base.lifetimeStats.highestSingleServe, runBestServe),
      totalStars: computeTotalStars(nextLevelStars),
      totalCumulativeScore: computeCumulativeScore(nextLevelBestScores)
    },
    updatedAt: Date.now()
  };

  return normalizeV2Save(candidate);
}

module.exports = {
  SCHEMA_VERSION,
  SHOP_TOTAL_CAP,
  DEFAULT_INITIAL_STARDUST,
  MAX_OFFLINE_STARDUST_DELTA,
  LEGACY_RUN_STORAGE_KEYS,
  isHigherSchemaRecord,
  createDefaultSave,
  migrateV1ToV2,
  computeSpentStardust,
  normalizeProfile,
  computeHighestUnlockedLevel,
  computeCumulativeScore,
  normalizeSaveData,
  mergeSaveData,
  mergeMetaSaves: mergeSaveData,
  loadLocalSave,
  saveLocalSave,
  recordLevelSettlementToSave
};
