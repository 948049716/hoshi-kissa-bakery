/**
 * 一起做猫饼 (Hoshi Kissa Bakery v2.0) 微信云开发聚合云函数 `kissa_sync`
 *
 * 运行环境：Tencent CloudBase Nodejs16.13（仅依赖 `wx-server-sdk`，零外部相对引用）
 * 支持路由 (`event.action`):
 * - `pull`          : 静默获取 OPENID 并拉取玩家 v2 云存档（自动无损迁移老版 v1 云文档并清理废弃字段）
 * - `push`          : v2 吃茶小铺守恒审计、分章得分上限与纯上菜反作弊校验、双端星尘增量合并及乐观锁 `revision` 同步
 * - `updateProfile` : 显式更新店长昵称、头像与搭档预设头像并同步至 `metaSave.playerProfile`
 * - `leaderboard`   : 查询 `stars`（总星数进度榜）与 `score`（星夜累计营业榜，兼容 `totalScore` 别名）Top 50 及个人精确排名
 */
'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

const SCHEMA_VERSION = 3;
const DEFAULT_INITIAL_STARDUST = 15;
const PLAYERS_COL = 'players';

// v0.9.0 吃茶小铺永久升级表：3920 + 1250 + 240 + 240 = 5,650 星尘（严禁改动原价）
const CATCAKE_UPGRADE_COSTS = Object.freeze({
  1: Object.freeze([25, 50, 80, 120]),
  2: Object.freeze([30, 60, 95, 145]),
  3: Object.freeze([40, 75, 115, 175]),
  4: Object.freeze([50, 95, 145, 215]),
  5: Object.freeze([65, 120, 185, 270]),
  6: Object.freeze([85, 150, 235, 340]),
  7: Object.freeze([105, 185, 280, 385])
});

const DEVICE_UPGRADE_COSTS = Object.freeze({
  dev_tray: Object.freeze([75, 165]),
  dev_flour: Object.freeze([55, 110, 180]),
  dev_teapot: Object.freeze([60, 115, 190]),
  dev_tools: Object.freeze([50, 95, 155])
});

const PATRON_COSTS = Object.freeze({
  mikan: 0,
  luna: 100,
  mugi: 140
});

const THEME_COSTS = Object.freeze({
  amber: 0,
  sakura: 100,
  moonlight: 140
});

// v0.12 M3 茶研所解锁表（11 项合计 2,000 星尘，独立于 5,650 基础小铺总价）
const RESEARCH_COSTS = Object.freeze({
  perk_berry_jam_pot: 120,
  perk_crit_spark: 140,
  perk_fever_feast: 160,
  perk_neko_blessing: 180,
  perk_golden_touch: 220,
  perk_starlight_crown: 260,
  secret_traits_regular: 140,
  secret_traits_vip: 180,
  badge_star_bell: 160,
  badge_matcha_whisk: 200,
  badge_cat_crown: 240
});

function computeCloudShopTotalCap() {
  let sum = 0;
  const cakeKeys = Object.keys(CATCAKE_UPGRADE_COSTS);
  for (let i = 0; i < cakeKeys.length; i++) {
    const arr = CATCAKE_UPGRADE_COSTS[cakeKeys[i]];
    for (let j = 0; j < arr.length; j++) sum += arr[j];
  }
  const devKeys = Object.keys(DEVICE_UPGRADE_COSTS);
  for (let i = 0; i < devKeys.length; i++) {
    const arr = DEVICE_UPGRADE_COSTS[devKeys[i]];
    for (let j = 0; j < arr.length; j++) sum += arr[j];
  }
  const patronKeys = Object.keys(PATRON_COSTS);
  for (let i = 0; i < patronKeys.length; i++) {
    sum += PATRON_COSTS[patronKeys[i]];
  }
  const themeKeys = Object.keys(THEME_COSTS);
  for (let i = 0; i < themeKeys.length; i++) {
    sum += THEME_COSTS[themeKeys[i]];
  }
  return sum;
}

function computeCloudResearchTotalCap() {
  let sum = 0;
  const keys = Object.keys(RESEARCH_COSTS);
  for (let i = 0; i < keys.length; i++) {
    sum += RESEARCH_COSTS[keys[i]] || 0;
  }
  return sum;
}

const SHOP_TOTAL_CAP = computeCloudShopTotalCap();
const RESEARCH_TOTAL_CAP = computeCloudResearchTotalCap();

// v1 历史成本表（仅用于老存档 v1 -> v2 总星尘无损还原）
const V1_PATRON_COSTS = Object.freeze({
  mikan: 0,
  luna: 60,
  mugi: 100
});

const V1_THEME_COSTS = Object.freeze({
  amber: 0,
  sakura: 80,
  moonlight: 120
});

const V1_UPGRADE_COSTS = Object.freeze({
  up_tools: Object.freeze([40, 90, 160]),
  up_fever: Object.freeze([50, 100, 180]),
  up_combo: Object.freeze([60, 120, 200]),
  up_dust: Object.freeze([45, 95, 170])
});

const KNOWN_PATRON_MAP = Object.freeze({
  mikan: 'mikan',
  chef_mikan: 'mikan',
  luna: 'luna',
  patron_luna: 'luna',
  mugi: 'mugi',
  patron_mugi: 'mugi'
});

// 3 章 × 10 关 = 30 关合法关卡 ID 与反作弊上限
const VALID_LEVEL_IDS = Object.freeze([
  '1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10',
  '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10',
  '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10'
]);
const VALID_LEVEL_SET = new Set(VALID_LEVEL_IDS);

const CHAPTER_SCORE_CAPS = Object.freeze({
  '1': 35000,
  '2': 90000,
  '3': 220000
});

const MAX_CAMPAIGN_STARS = VALID_LEVEL_IDS.length * 3;
const MAX_TOTAL_STARS = MAX_CAMPAIGN_STARS;
const MAX_TOTAL_CUMULATIVE_SCORE = 3450000;
const MAX_DAILY_SCORE = 150000;
const MAX_ENDLESS_SHIFT = 99;
const MAX_ENDLESS_SCORE = 6000000;
const MAX_ENDLESS_SCORE_PER_SHIFT = 60000;
const MAX_ENDLESS_DAILY_DUST = 60;
const MAX_OFFLINE_STARDUST_DELTA = 1500;
const MAX_INITIAL_UNSYNCED_STARDUST = 6000;
const MAX_SAFE_EARNED_STARDUST = 9999999;
const MAX_CONSUMABLE_SPENT_STARDUST = MAX_SAFE_EARNED_STARDUST - SHOP_TOTAL_CAP - RESEARCH_TOTAL_CAP;
const MAX_TIMESTAMP_MS = 9999999999999;

const LEGACY_ROOT_FIELDS = Object.freeze([
  'activeRun',
  'savedRuns',
  'bestChef',
  'bestRush',
  'bestZen',
  'bestShiftReached',
  'shopUpgrades',
  'bankStardust',
  'totalEarnedStardust',
  'lastSyncedEarnedStardust',
  'unlockedPatrons',
  'selectedPatron',
  'unlockedThemes',
  'equippedTheme',
  'bgmTrack',
  'sfxEnabled',
  'playerProfile',
  'lifetimeStats'
]);

const LEGACY_V1_SAVE_DETECTION_KEYS = Object.freeze([
  'shopUpgrades',
  'bankStardust',
  'totalEarnedStardust',
  'unlockedPatrons',
  'selectedPatron',
  'unlockedThemes',
  'equippedTheme',
  'bgmTrack',
  'sfxEnabled',
  'playerProfile',
  'lifetimeStats',
  'bestChef',
  'bestRush',
  'bestZen'
]);

let collectionChecked = false;
async function ensurePlayersCollection() {
  if (collectionChecked) return;
  try {
    await db.createCollection(PLAYERS_COL);
  } catch (_err) {
    // 集合已存在或环境自动托管
  }
  collectionChecked = true;
}

function hasOwn(obj, key) {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  try {
    return Object.prototype.hasOwnProperty.call(obj, key);
  } catch (_err) {
    return false;
  }
}

function getOwn(obj, key) {
  if (!hasOwn(obj, key)) return undefined;
  try {
    return obj[key];
  } catch (_err) {
    return undefined;
  }
}

function safeIsArray(v) {
  try {
    return Array.isArray(v);
  } catch (_err) {
    return false;
  }
}

function safeArrayLength(arr) {
  if (!safeIsArray(arr)) return 0;
  try {
    const len = arr.length;
    return typeof len === 'number' && len > 0 ? len : 0;
  } catch (_err) {
    return 0;
  }
}

function safeArrayAt(arr, idx) {
  if (!safeIsArray(arr) || !hasOwn(arr, idx)) return undefined;
  try {
    return arr[idx];
  } catch (_err) {
    return undefined;
  }
}

function isPlainRecord(v) {
  if (v === null || v === undefined || typeof v !== 'object') return false;
  try {
    return !Array.isArray(v);
  } catch (_err) {
    return false;
  }
}

function toSafeNum(val) {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed !== '') return Number(trimmed);
  }
  return NaN;
}

function toFiniteInt(val, fallback) {
  const fb = fallback !== undefined ? fallback : 0;
  const n = toSafeNum(val);
  if (!Number.isFinite(n)) return fb;
  const floored = Math.floor(n);
  return floored === 0 ? 0 : floored;
}

function clampInt(val, min, max, fallback) {
  const fb = fallback !== undefined ? fallback : min;
  const n = toSafeNum(val);
  if (!Number.isFinite(n)) return fb;
  const floored = Math.floor(n);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored === 0 ? 0 : floored;
}

function pushUniqueWarning(warnings, code) {
  if (safeIsArray(warnings) && warnings.indexOf(code) === -1) {
    warnings.push(code);
  }
}

function canonicalizeKnownPatronId(rawId) {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!hasOwn(KNOWN_PATRON_MAP, trimmed)) return null;
  return KNOWN_PATRON_MAP[trimmed];
}

function normalizePatronId(rawId) {
  return canonicalizeKnownPatronId(rawId) || 'mikan';
}

function sanitizeUnlockedPatrons(rawArr) {
  const out = ['mikan'];
  if (!safeIsArray(rawArr)) return out;
  const len = safeArrayLength(rawArr);
  for (let i = 0; i < len; i++) {
    if (!hasOwn(rawArr, i)) continue;
    const pid = canonicalizeKnownPatronId(safeArrayAt(rawArr, i));
    if (pid && out.indexOf(pid) === -1) {
      out.push(pid);
    }
  }
  return out;
}

function sanitizeUnlockedThemes(rawArr) {
  const out = ['amber'];
  if (!safeIsArray(rawArr)) return out;
  const len = safeArrayLength(rawArr);
  for (let i = 0; i < len; i++) {
    if (!hasOwn(rawArr, i)) continue;
    const item = safeArrayAt(rawArr, i);
    if (typeof item !== 'string') continue;
    const tid = item.trim();
    if (hasOwn(THEME_COSTS, tid) && out.indexOf(tid) === -1) {
      out.push(tid);
    }
  }
  return out;
}

function getChapterScoreCapForLevel(levelId) {
  if (typeof levelId !== 'string' || !VALID_LEVEL_SET.has(levelId)) return 35000;
  const chKey = levelId.charAt(0);
  return hasOwn(CHAPTER_SCORE_CAPS, chKey) ? CHAPTER_SCORE_CAPS[chKey] : 35000;
}

function computeTotalStars(levelStars) {
  if (!isPlainRecord(levelStars)) return 0;
  let total = 0;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (!hasOwn(levelStars, id)) continue;
    total += clampInt(getOwn(levelStars, id), 0, 3, 0);
  }
  return Math.min(MAX_TOTAL_STARS, total);
}

function computeTotalCumulativeScore(levelBestScores) {
  if (!isPlainRecord(levelBestScores)) return 0;
  let total = 0;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (!hasOwn(levelBestScores, id)) continue;
    const cap = getChapterScoreCapForLevel(id);
    total += clampInt(getOwn(levelBestScores, id), 0, cap, 0);
  }
  return Math.min(MAX_TOTAL_CUMULATIVE_SCORE, total);
}

function computeHighestUnlockedLevel(levelStars) {
  let highest = '1-1';
  if (!isPlainRecord(levelStars)) return highest;
  const totalStars = computeTotalStars(levelStars);
  for (let i = 1; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    const prevId = VALID_LEVEL_IDS[i - 1];
    const prevStars = hasOwn(levelStars, prevId) ? clampInt(getOwn(levelStars, prevId), 0, 3, 0) : 0;
    if (prevStars < 1) break;
    if (id === '2-1' && totalStars < 18) break;
    if (id === '3-1' && totalStars < 40) break;
    highest = id;
  }
  return highest;
}

function computeSpentStardust(meta) {
  if (!isPlainRecord(meta)) return 0;
  let spent = 0;

  const cl = getOwn(meta, 'catcakeLevels');
  if (isPlainRecord(cl)) {
    for (let t = 1; t <= 7; t++) {
      const kStr = String(t);
      const kC = 'C' + t;
      const rawLv = hasOwn(cl, kStr)
        ? getOwn(cl, kStr)
        : hasOwn(cl, kC)
        ? getOwn(cl, kC)
        : 0;
      const lv = clampInt(rawLv, 0, 4, 0);
      const costs = CATCAKE_UPGRADE_COSTS[t];
      for (let i = 0; i < lv; i++) {
        spent += costs[i];
      }
    }
  }

  const du = getOwn(meta, 'deviceUpgrades');
  if (isPlainRecord(du)) {
    const devKeys = Object.keys(DEVICE_UPGRADE_COSTS);
    for (let d = 0; d < devKeys.length; d++) {
      const key = devKeys[d];
      const costs = DEVICE_UPGRADE_COSTS[key];
      const lv = hasOwn(du, key) ? clampInt(getOwn(du, key), 0, costs.length, 0) : 0;
      for (let i = 0; i < lv; i++) {
        spent += costs[i];
      }
    }
  }

  const rawPatrons = getOwn(meta, 'unlockedPatrons');
  if (safeIsArray(rawPatrons)) {
    const patrons = sanitizeUnlockedPatrons(rawPatrons);
    for (let i = 0; i < patrons.length; i++) {
      const pid = patrons[i];
      spent += PATRON_COSTS[pid] || 0;
    }
  }

  const rawThemes = getOwn(meta, 'unlockedThemes');
  if (safeIsArray(rawThemes)) {
    const themes = sanitizeUnlockedThemes(rawThemes);
    for (let i = 0; i < themes.length; i++) {
      const tid = themes[i];
      spent += THEME_COSTS[tid] || 0;
    }
  }

  const rawResearch = getOwn(meta, 'researchUnlocks');
  if (isPlainRecord(rawResearch)) {
    const rKeys = Object.keys(RESEARCH_COSTS);
    for (let i = 0; i < rKeys.length; i++) {
      const rk = rKeys[i];
      if (hasOwn(rawResearch, rk) && Boolean(getOwn(rawResearch, rk))) {
        spent += RESEARCH_COSTS[rk] || 0;
      }
    }
  }

  if (hasOwn(meta, 'consumableSpentStardust')) {
    spent += clampInt(getOwn(meta, 'consumableSpentStardust'), 0, MAX_CONSUMABLE_SPENT_STARDUST, 0);
  }

  return spent;
}

function sanitizeDateKey(val) {
  if (typeof val !== 'string') return '';
  const cleaned = val.trim().replace(/-/g, '');
  return /^\d{8}$/.test(cleaned) ? cleaned : '';
}

function maxDateKey(a, b) {
  const ka = sanitizeDateKey(a);
  const kb = sanitizeDateKey(b);
  if (!ka) return kb;
  if (!kb) return ka;
  return ka >= kb ? ka : kb;
}

function createDefaultModeStats() {
  return {
    daily: {
      lastDate: '',
      bestScore: 0,
      claimedDate: '',
      claimed3Date: ''
    },
    endless: {
      bestShift: 0,
      bestScore: 0,
      runs: 0,
      dailyDustDate: '',
      dailyDust: 0
    }
  };
}

function sanitizeModeStats(raw) {
  const out = createDefaultModeStats();
  if (!isPlainRecord(raw)) return out;
  const rawDaily = getOwn(raw, 'daily');
  if (isPlainRecord(rawDaily)) {
    out.daily.lastDate = sanitizeDateKey(getOwn(rawDaily, 'lastDate'));
    out.daily.bestScore = clampInt(getOwn(rawDaily, 'bestScore'), 0, MAX_DAILY_SCORE, 0);
    out.daily.claimedDate = sanitizeDateKey(getOwn(rawDaily, 'claimedDate'));
    out.daily.claimed3Date = sanitizeDateKey(getOwn(rawDaily, 'claimed3Date'));
  }
  const rawEndless = getOwn(raw, 'endless');
  if (isPlainRecord(rawEndless)) {
    out.endless.bestShift = clampInt(getOwn(rawEndless, 'bestShift'), 0, MAX_ENDLESS_SHIFT, 0);
    out.endless.bestScore = clampInt(getOwn(rawEndless, 'bestScore'), 0, MAX_ENDLESS_SCORE, 0);
    out.endless.runs = clampInt(getOwn(rawEndless, 'runs'), 0, 999999, 0);
    out.endless.dailyDustDate = sanitizeDateKey(getOwn(rawEndless, 'dailyDustDate'));
    out.endless.dailyDust = clampInt(getOwn(rawEndless, 'dailyDust'), 0, MAX_ENDLESS_DAILY_DUST, 0);
  }
  return out;
}

function mergeModeStats(aRaw, bRaw) {
  const a = sanitizeModeStats(aRaw);
  const b = sanitizeModeStats(bRaw);
  const dLast = maxDateKey(a.daily.lastDate, b.daily.lastDate);
  let dBest = 0;
  if (a.daily.lastDate === b.daily.lastDate) {
    dBest = Math.max(a.daily.bestScore, b.daily.bestScore);
  } else if (a.daily.lastDate === dLast) {
    dBest = a.daily.bestScore;
  } else {
    dBest = b.daily.bestScore;
  }
  const eDustDate = maxDateKey(a.endless.dailyDustDate, b.endless.dailyDustDate);
  let eDust = 0;
  if (a.endless.dailyDustDate === b.endless.dailyDustDate) {
    eDust = Math.max(a.endless.dailyDust, b.endless.dailyDust);
  } else if (a.endless.dailyDustDate === eDustDate) {
    eDust = a.endless.dailyDust;
  } else {
    eDust = b.endless.dailyDust;
  }
  return {
    daily: {
      lastDate: dLast,
      bestScore: dBest,
      claimedDate: maxDateKey(a.daily.claimedDate, b.daily.claimedDate),
      claimed3Date: maxDateKey(a.daily.claimed3Date, b.daily.claimed3Date)
    },
    endless: {
      bestShift: Math.max(a.endless.bestShift, b.endless.bestShift),
      bestScore: Math.max(a.endless.bestScore, b.endless.bestScore),
      runs: Math.max(a.endless.runs, b.endless.runs),
      dailyDustDate: eDustDate,
      dailyDust: eDust
    }
  };
}

function sanitizeResearchUnlocks(raw) {
  const out = {};
  if (!isPlainRecord(raw)) return out;
  const keys = Object.keys(RESEARCH_COSTS);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (hasOwn(raw, k) && Boolean(getOwn(raw, k))) {
      out[k] = true;
    }
  }
  return out;
}

function sanitizeLevelGoalsDone(raw) {
  const out = {};
  if (!isPlainRecord(raw)) return out;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (hasOwn(raw, id) && Boolean(getOwn(raw, id))) {
      out[id] = true;
    }
  }
  return out;
}

function sanitizeSeenTips(raw) {
  const out = {};
  if (!isPlainRecord(raw)) return out;
  const keys = Object.keys(raw);
  let kept = 0;
  for (let i = 0; i < keys.length && kept < 32; i++) {
    const k = keys[i];
    if (/^[a-z0-9_]{1,32}$/.test(k) && Boolean(getOwn(raw, k))) {
      out[k] = true;
      kept += 1;
    }
  }
  return out;
}

function sanitizeSettings(raw) {
  const src = isPlainRecord(raw) ? raw : {};
  const rawVib = getOwn(src, 'vibrateEnabled');
  const rawLow = getOwn(src, 'lowPowerMode');
  const rawCb = getOwn(src, 'colorblindMarks');
  return {
    vibrateEnabled: typeof rawVib === 'boolean' ? rawVib : true,
    lowPowerMode: typeof rawLow === 'boolean' ? rawLow : false,
    colorblindMarks: typeof rawCb === 'boolean' ? rawCb : false
  };
}

function normalizeMetaProfile(raw, fallbackPatron) {
  const src = isPlainRecord(raw) ? raw : {};
  const rawPresetVal = getOwn(src, 'avatarPreset');
  const rawPreset = rawPresetVal !== undefined ? canonicalizeKnownPatronId(rawPresetVal) : null;
  const fbPreset = canonicalizeKnownPatronId(fallbackPatron) || 'mikan';
  const avatarPreset = rawPreset || fbPreset;
  const rawNickVal = getOwn(src, 'nickName');
  const rawNick = typeof rawNickVal === 'string' ? rawNickVal.trim() : '';
  const rawAvatarVal = getOwn(src, 'avatarUrl');
  const rawAvatar = typeof rawAvatarVal === 'string' ? rawAvatarVal.trim() : '';
  const authorized = hasOwn(src, 'authorized') ? Boolean(getOwn(src, 'authorized')) : false;
  const updatedAt = hasOwn(src, 'updatedAt')
    ? clampInt(getOwn(src, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
    : 0;
  return {
    nickName: rawNick ? rawNick.slice(0, 16) : '',
    avatarUrl: rawAvatar ? rawAvatar.slice(0, 512) : '',
    avatarPreset,
    authorized,
    updatedAt
  };
}

function sanitizeLevelFailStreaks(rawStreaks) {
  const out = {};
  if (!isPlainRecord(rawStreaks)) return out;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (!hasOwn(rawStreaks, id)) continue;
    const cnt = clampInt(getOwn(rawStreaks, id), 0, 999, 0);
    if (cnt > 0) {
      out[id] = cnt;
    }
  }
  return out;
}

function isHigherSchemaMeta(raw) {
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

function createDefaultMetaSave() {
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
    levelGoalsDone: {},
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
    researchUnlocks: {},
    modeStats: createDefaultModeStats(),
    seenTutorials: {
      intro_slide: false,
      tray_trash: false,
      flavor_tile: false,
      ice_tile: false
    },
    seenTips: {},
    settings: sanitizeSettings(null),
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

/**
 * 与客户端 `save_sync.migrateV1ToV2` 100% 同构的服务端老存档迁移函数。
 * 同时兼容老版云数据库文档顶层存有 `bestChef` / `bestRush` / `bestZen` 而 `metaSave` 省略该字段的情形。
 */
function migrateV1ToV2(raw, wrapperDoc) {
  const hasRawKeys = isPlainRecord(raw) && Object.keys(raw).length > 0;
  const hasWrapKeys = isPlainRecord(wrapperDoc) && Object.keys(wrapperDoc).length > 0;
  if (!hasRawKeys && !hasWrapKeys) {
    return createDefaultMetaSave();
  }
  const src = isPlainRecord(raw) ? raw : {};
  const wrap = isPlainRecord(wrapperDoc) ? wrapperDoc : null;

  const sv = hasOwn(src, 'schemaVersion') ? toSafeNum(getOwn(src, 'schemaVersion')) : 0;
  if (Number.isFinite(sv) && sv >= 2) {
    return sanitizeMetaSave(src);
  }

  const unlockedPatrons = sanitizeUnlockedPatrons(getOwn(src, 'unlockedPatrons'));
  const rawSelPatron = getOwn(src, 'selectedPatron');
  const candPatron = rawSelPatron !== undefined ? canonicalizeKnownPatronId(rawSelPatron) : null;
  const selectedPatron = candPatron && unlockedPatrons.indexOf(candPatron) !== -1 ? candPatron : 'mikan';

  const unlockedThemes = sanitizeUnlockedThemes(getOwn(src, 'unlockedThemes'));
  const rawEqTheme = getOwn(src, 'equippedTheme');
  const candTheme = typeof rawEqTheme === 'string' ? rawEqTheme.trim() : '';
  const equippedTheme = candTheme && unlockedThemes.indexOf(candTheme) !== -1 ? candTheme : 'amber';

  let v1Spent = 0;
  for (let i = 0; i < unlockedPatrons.length; i++) {
    v1Spent += V1_PATRON_COSTS[unlockedPatrons[i]] || 0;
  }
  for (let i = 0; i < unlockedThemes.length; i++) {
    v1Spent += V1_THEME_COSTS[unlockedThemes[i]] || 0;
  }
  const rawShopUp = getOwn(src, 'shopUpgrades');
  const upRaw = isPlainRecord(rawShopUp) ? rawShopUp : {};
  const v1UpKeys = Object.keys(V1_UPGRADE_COSTS);
  for (let k = 0; k < v1UpKeys.length; k++) {
    const key = v1UpKeys[k];
    const costs = V1_UPGRADE_COSTS[key];
    const lv = hasOwn(upRaw, key) ? clampInt(getOwn(upRaw, key), 0, costs.length, 0) : 0;
    for (let i = 0; i < lv; i++) {
      v1Spent += costs[i];
    }
  }

  const bestChef = Math.max(
    hasOwn(src, 'bestChef') ? clampInt(getOwn(src, 'bestChef'), 0, 350000, 0) : 0,
    wrap && hasOwn(wrap, 'bestChef') ? clampInt(getOwn(wrap, 'bestChef'), 0, 350000, 0) : 0
  );
  const bestRush = Math.max(
    hasOwn(src, 'bestRush') ? clampInt(getOwn(src, 'bestRush'), 0, 85000, 0) : 0,
    wrap && hasOwn(wrap, 'bestRush') ? clampInt(getOwn(wrap, 'bestRush'), 0, 85000, 0) : 0
  );
  const bestZen = Math.max(
    hasOwn(src, 'bestZen') ? clampInt(getOwn(src, 'bestZen'), 0, 180000, 0) : 0,
    wrap && hasOwn(wrap, 'bestZen') ? clampInt(getOwn(wrap, 'bestZen'), 0, 180000, 0) : 0
  );

  const rawBankVal = getOwn(src, 'bankStardust');
  const rawBank =
    hasOwn(src, 'bankStardust') && Number.isFinite(toSafeNum(rawBankVal))
      ? clampInt(rawBankVal, 0, MAX_SAFE_EARNED_STARDUST, 0)
      : 30;
  const rawEarned = hasOwn(src, 'totalEarnedStardust')
    ? clampInt(getOwn(src, 'totalEarnedStardust'), 0, MAX_SAFE_EARNED_STARDUST, 0)
    : 0;
  const v1TotalEarned = Math.max(30, rawEarned, rawBank + v1Spent);

  let bonusOffset = 0;
  for (let i = 0; i < unlockedPatrons.length; i++) {
    const pid = unlockedPatrons[i];
    if (hasOwn(PATRON_COSTS, pid) && hasOwn(V1_PATRON_COSTS, pid)) {
      bonusOffset += Math.max(0, (PATRON_COSTS[pid] || 0) - (V1_PATRON_COSTS[pid] || 0));
    }
  }
  for (let i = 0; i < unlockedThemes.length; i++) {
    const tid = unlockedThemes[i];
    if (hasOwn(THEME_COSTS, tid) && hasOwn(V1_THEME_COSTS, tid)) {
      bonusOffset += Math.max(0, (THEME_COSTS[tid] || 0) - (V1_THEME_COSTS[tid] || 0));
    }
  }
  const hasV1Scores = bestChef > 0 || bestRush > 0 || bestZen > 0;
  if (hasV1Scores) bonusOffset += 50;

  const rawGiftVal = getOwn(src, 'migratedFromV1GiftPending');
  const migratedFromV1GiftPending =
    typeof rawGiftVal === 'boolean' ? rawGiftVal : hasV1Scores;

  const totalEarnedWithBonus = Math.min(MAX_SAFE_EARNED_STARDUST, v1TotalEarned + bonusOffset);
  const rawLastSynced = hasOwn(src, 'lastSyncedEarnedStardust')
    ? clampInt(getOwn(src, 'lastSyncedEarnedStardust'), 0, v1TotalEarned, 0)
    : 0;
  const adjustedLastSynced =
    rawLastSynced > 0 ? Math.min(totalEarnedWithBonus, rawLastSynced + bonusOffset) : 0;

  const rawStatsVal = getOwn(src, 'lifetimeStats');
  const stRaw = isPlainRecord(rawStatsVal) ? rawStatsVal : {};
  const runsPlayed = hasOwn(stRaw, 'runsPlayed') ? clampInt(getOwn(stRaw, 'runsPlayed'), 0, 999999, 0) : 0;
  const ordersServed = Math.max(
    hasOwn(stRaw, 'ordersServed') ? clampInt(getOwn(stRaw, 'ordersServed'), 0, 9999999, 0) : 0,
    hasOwn(stRaw, 'ordersCompleted') ? clampInt(getOwn(stRaw, 'ordersCompleted'), 0, 9999999, 0) : 0,
    hasOwn(stRaw, 'servesTotal') ? clampInt(getOwn(stRaw, 'servesTotal'), 0, 9999999, 0) : 0
  );
  const vipServed = hasOwn(stRaw, 'vipServed') ? clampInt(getOwn(stRaw, 'vipServed'), 0, 9999999, 0) : 0;
  let maxComboEver = hasOwn(stRaw, 'maxComboEver') ? clampInt(getOwn(stRaw, 'maxComboEver'), 0, 999, 0) : 0;
  if (maxComboEver === 1 && runsPlayed === 0 && ordersServed === 0 && !hasV1Scores) {
    maxComboEver = 0;
  }
  const highestSingleServe = hasOwn(stRaw, 'highestSingleServe')
    ? clampInt(getOwn(stRaw, 'highestSingleServe'), 0, 220000, 0)
    : 0;

  const srcProfVal = getOwn(src, 'playerProfile');
  const srcTopProfVal = getOwn(src, 'profile');
  const wrapProfVal = wrap ? getOwn(wrap, 'profile') : null;
  const wrapPlayerProfVal = wrap ? getOwn(wrap, 'playerProfile') : null;
  const rawProf = isPlainRecord(srcProfVal)
    ? srcProfVal
    : isPlainRecord(srcTopProfVal)
    ? srcTopProfVal
    : isPlainRecord(wrapProfVal)
    ? wrapProfVal
    : isPlainRecord(wrapPlayerProfVal)
    ? wrapPlayerProfVal
    : null;

  const rawBgmVal = getOwn(src, 'bgmTrack');
  const bgmTrack =
    rawBgmVal === 'bossa' || rawBgmVal === 'off' || rawBgmVal === 'waltz'
      ? rawBgmVal
      : 'waltz';
  const rawSfxVal = getOwn(src, 'sfxEnabled');
  const sfxEnabled = typeof rawSfxVal === 'boolean' ? rawSfxVal : true;
  const updatedAt = hasOwn(src, 'updatedAt')
    ? clampInt(getOwn(src, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
    : 0;

  const out = {
    schemaVersion: SCHEMA_VERSION,
    bgmTrack,
    sfxEnabled,
    bankStardust: 0,
    totalEarnedStardust: 30,
    lastSyncedEarnedStardust: adjustedLastSynced,
    consumableSpentStardust: 0,
    migratedFromV1GiftPending,
    levelStars: {},
    levelBestScores: {},
    levelFailStreaks: {},
    levelGoalsDone: {},
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
    selectedPatron,
    unlockedPatrons,
    equippedTheme,
    unlockedThemes,
    researchUnlocks: {},
    modeStats: createDefaultModeStats(),
    seenTutorials: {
      intro_slide: false,
      tray_trash: false,
      flavor_tile: false,
      ice_tile: false
    },
    seenTips: {},
    settings: sanitizeSettings(null),
    playerProfile: normalizeMetaProfile(rawProf, selectedPatron),
    lifetimeStats: {
      runsPlayed,
      ordersServed,
      vipServed,
      maxComboEver,
      highestSingleServe,
      totalStars: 0,
      totalCumulativeScore: 0
    },
    updatedAt
  };

  const v2Spent = computeSpentStardust(out);
  out.totalEarnedStardust = Math.min(MAX_SAFE_EARNED_STARDUST, Math.max(30, totalEarnedWithBonus, v2Spent));
  out.bankStardust = Math.max(0, out.totalEarnedStardust - v2Spent);
  out.lastSyncedEarnedStardust = Math.min(out.totalEarnedStardust, adjustedLastSynced);
  return out;
}

function sanitizeMetaSave(raw, warnings, wrapperDoc) {
  if (!isPlainRecord(raw)) {
    if (isPlainRecord(wrapperDoc)) {
      return migrateV1ToV2(null, wrapperDoc);
    }
    return createDefaultMetaSave();
  }

  const sv = hasOwn(raw, 'schemaVersion') ? toSafeNum(getOwn(raw, 'schemaVersion')) : 0;
  if (!Number.isFinite(sv) || sv < 2) {
    return migrateV1ToV2(raw, wrapperDoc);
  }

  const higherSchema = isHigherSchemaMeta(raw);

  const rawBgmVal = getOwn(raw, 'bgmTrack');
  const bgmTrack =
    rawBgmVal === 'bossa' || rawBgmVal === 'off' || rawBgmVal === 'waltz'
      ? rawBgmVal
      : 'waltz';
  const rawSfxVal = getOwn(raw, 'sfxEnabled');
  const sfxEnabled = typeof rawSfxVal === 'boolean' ? rawSfxVal : true;
  const migratedFromV1GiftPending = hasOwn(raw, 'migratedFromV1GiftPending')
    ? Boolean(getOwn(raw, 'migratedFromV1GiftPending'))
    : false;
  const consumableSpentStardust = hasOwn(raw, 'consumableSpentStardust')
    ? clampInt(getOwn(raw, 'consumableSpentStardust'), 0, MAX_CONSUMABLE_SPENT_STARDUST, 0)
    : 0;

  const rawScoresObj = getOwn(raw, 'levelBestScores');
  const rawStarsObj = getOwn(raw, 'levelStars');
  const inScores = isPlainRecord(rawScoresObj) ? rawScoresObj : {};
  const inStars = isPlainRecord(rawStarsObj) ? rawStarsObj : {};
  const levelBestScores = {};
  const levelStars = {};

  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    const cap = getChapterScoreCapForLevel(id);

    let sc = 0;
    if (hasOwn(inScores, id)) {
      const rawScNum = toSafeNum(getOwn(inScores, id));
      if (Number.isFinite(rawScNum)) {
        const flooredSc = Math.floor(rawScNum);
        if (flooredSc > cap) {
          pushUniqueWarning(warnings, 'level_score_cap_clamped');
        }
        sc = Math.max(0, Math.min(cap, flooredSc));
      }
    }
    if (sc > 0) {
      levelBestScores[id] = sc;
    }

    let st = 0;
    if (hasOwn(inStars, id)) {
      const rawStNum = toSafeNum(getOwn(inStars, id));
      if (Number.isFinite(rawStNum)) {
        const flooredSt = Math.floor(rawStNum);
        if (flooredSt > 3 || flooredSt < 0) {
          pushUniqueWarning(warnings, 'level_stars_clamped');
        }
        st = Math.max(0, Math.min(3, flooredSt));
      }
    }
    if (st > 0 && sc <= 0) {
      pushUniqueWarning(warnings, 'stars_without_score_clamped');
      st = 0;
    }
    if (st > 0) {
      levelStars[id] = st;
    }
  }

  const levelFailStreaks = sanitizeLevelFailStreaks(getOwn(raw, 'levelFailStreaks'));
  const levelGoalsDone = sanitizeLevelGoalsDone(getOwn(raw, 'levelGoalsDone'));

  const rawClObj = getOwn(raw, 'catcakeLevels');
  const clRaw = isPlainRecord(rawClObj) ? rawClObj : {};
  const catcakeLevels = {};
  for (let t = 1; t <= 7; t++) {
    const kStr = String(t);
    const kC = 'C' + t;
    const rawLv = hasOwn(clRaw, kStr)
      ? getOwn(clRaw, kStr)
      : hasOwn(clRaw, kC)
      ? getOwn(clRaw, kC)
      : 0;
    catcakeLevels[kStr] = clampInt(rawLv, 0, 4, 0);
  }

  const rawDuObj = getOwn(raw, 'deviceUpgrades');
  const duRaw = isPlainRecord(rawDuObj) ? rawDuObj : {};
  const deviceUpgrades = {
    dev_tray: hasOwn(duRaw, 'dev_tray') ? clampInt(getOwn(duRaw, 'dev_tray'), 0, 2, 0) : 0,
    dev_flour: hasOwn(duRaw, 'dev_flour') ? clampInt(getOwn(duRaw, 'dev_flour'), 0, 3, 0) : 0,
    dev_teapot: hasOwn(duRaw, 'dev_teapot') ? clampInt(getOwn(duRaw, 'dev_teapot'), 0, 3, 0) : 0,
    dev_tools: hasOwn(duRaw, 'dev_tools') ? clampInt(getOwn(duRaw, 'dev_tools'), 0, 3, 0) : 0
  };

  const unlockedPatrons = sanitizeUnlockedPatrons(getOwn(raw, 'unlockedPatrons'));
  const rawSelPatron = getOwn(raw, 'selectedPatron');
  const candPatron = rawSelPatron !== undefined ? canonicalizeKnownPatronId(rawSelPatron) : null;
  const selectedPatron = candPatron && unlockedPatrons.indexOf(candPatron) !== -1 ? candPatron : 'mikan';

  const unlockedThemes = sanitizeUnlockedThemes(getOwn(raw, 'unlockedThemes'));
  const rawEqTheme = getOwn(raw, 'equippedTheme');
  const candTheme = typeof rawEqTheme === 'string' ? rawEqTheme.trim() : '';
  const equippedTheme = candTheme && unlockedThemes.indexOf(candTheme) !== -1 ? candTheme : 'amber';

  const researchUnlocks = sanitizeResearchUnlocks(getOwn(raw, 'researchUnlocks'));
  const modeStats = sanitizeModeStats(getOwn(raw, 'modeStats'));

  const rawTutObj = getOwn(raw, 'seenTutorials');
  const tutRaw = isPlainRecord(rawTutObj) ? rawTutObj : {};
  const seenTutorials = {
    intro_slide: hasOwn(tutRaw, 'intro_slide') ? Boolean(getOwn(tutRaw, 'intro_slide')) : false,
    tray_trash: hasOwn(tutRaw, 'tray_trash') ? Boolean(getOwn(tutRaw, 'tray_trash')) : false,
    flavor_tile: hasOwn(tutRaw, 'flavor_tile') ? Boolean(getOwn(tutRaw, 'flavor_tile')) : false,
    ice_tile: hasOwn(tutRaw, 'ice_tile') ? Boolean(getOwn(tutRaw, 'ice_tile')) : false
  };
  const seenTips = sanitizeSeenTips(getOwn(raw, 'seenTips'));
  const settings = sanitizeSettings(getOwn(raw, 'settings'));

  const rawProfObj = getOwn(raw, 'playerProfile');
  const profRaw = isPlainRecord(rawProfObj) ? rawProfObj : null;
  const playerProfile = normalizeMetaProfile(profRaw, selectedPatron);

  const totalStars = computeTotalStars(levelStars);
  const totalCumulativeScore = computeTotalCumulativeScore(levelBestScores);
  const highestUnlockedLevel = computeHighestUnlockedLevel(levelStars);

  const rawStatsObj = getOwn(raw, 'lifetimeStats');
  const stRaw = isPlainRecord(rawStatsObj) ? rawStatsObj : {};
  const lifetimeStats = {
    runsPlayed: hasOwn(stRaw, 'runsPlayed') ? clampInt(getOwn(stRaw, 'runsPlayed'), 0, 999999, 0) : 0,
    ordersServed: Math.max(
      hasOwn(stRaw, 'ordersServed') ? clampInt(getOwn(stRaw, 'ordersServed'), 0, 9999999, 0) : 0,
      hasOwn(stRaw, 'ordersCompleted') ? clampInt(getOwn(stRaw, 'ordersCompleted'), 0, 9999999, 0) : 0,
      hasOwn(stRaw, 'servesTotal') ? clampInt(getOwn(stRaw, 'servesTotal'), 0, 9999999, 0) : 0
    ),
    vipServed: hasOwn(stRaw, 'vipServed') ? clampInt(getOwn(stRaw, 'vipServed'), 0, 9999999, 0) : 0,
    maxComboEver: hasOwn(stRaw, 'maxComboEver') ? clampInt(getOwn(stRaw, 'maxComboEver'), 0, 999, 0) : 0,
    highestSingleServe: hasOwn(stRaw, 'highestSingleServe')
      ? clampInt(getOwn(stRaw, 'highestSingleServe'), 0, 220000, 0)
      : 0,
    totalStars,
    totalCumulativeScore
  };

  const updatedAt = hasOwn(raw, 'updatedAt')
    ? clampInt(getOwn(raw, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
    : 0;

  const out = {
    schemaVersion: SCHEMA_VERSION,
    bgmTrack,
    sfxEnabled,
    bankStardust: 0,
    totalEarnedStardust: DEFAULT_INITIAL_STARDUST,
    lastSyncedEarnedStardust: 0,
    consumableSpentStardust,
    migratedFromV1GiftPending,
    levelStars,
    levelBestScores,
    levelFailStreaks,
    levelGoalsDone,
    highestUnlockedLevel,
    catcakeLevels,
    deviceUpgrades,
    selectedPatron,
    unlockedPatrons,
    equippedTheme,
    unlockedThemes,
    researchUnlocks,
    modeStats,
    seenTutorials,
    seenTips,
    settings,
    playerProfile,
    lifetimeStats,
    updatedAt
  };

  if (higherSchema) {
    out.higherSchemaDetected = true;
  }

  const spent = computeSpentStardust(out);
  const rawEarnedNum = hasOwn(raw, 'totalEarnedStardust') ? toSafeNum(getOwn(raw, 'totalEarnedStardust')) : NaN;
  const hasExplicitEarned = hasOwn(raw, 'totalEarnedStardust') && Number.isFinite(rawEarnedNum);
  const rawBankNum = hasOwn(raw, 'bankStardust') ? toSafeNum(getOwn(raw, 'bankStardust')) : NaN;
  const hasExplicitBank = hasOwn(raw, 'bankStardust') && Number.isFinite(rawBankNum);

  let baseEarned;
  if (hasExplicitEarned) {
    const cleanEarned = clampInt(rawEarnedNum, 0, MAX_SAFE_EARNED_STARDUST, DEFAULT_INITIAL_STARDUST);
    baseEarned = Math.max(DEFAULT_INITIAL_STARDUST, cleanEarned, spent);
  } else if (hasExplicitBank) {
    const cleanBank = clampInt(rawBankNum, 0, MAX_SAFE_EARNED_STARDUST, 0);
    baseEarned = Math.max(DEFAULT_INITIAL_STARDUST, cleanBank + spent, spent);
  } else {
    baseEarned = Math.max(DEFAULT_INITIAL_STARDUST, DEFAULT_INITIAL_STARDUST + spent);
  }

  out.totalEarnedStardust = Math.min(MAX_SAFE_EARNED_STARDUST, baseEarned);
  out.bankStardust = Math.max(0, out.totalEarnedStardust - spent);
  out.lastSyncedEarnedStardust = hasOwn(raw, 'lastSyncedEarnedStardust')
    ? clampInt(getOwn(raw, 'lastSyncedEarnedStardust'), 0, out.totalEarnedStardust, 0)
    : 0;

  return out;
}

function cloneValidLevelMap(srcMap) {
  const out = {};
  if (!isPlainRecord(srcMap)) return out;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    if (hasOwn(srcMap, id)) {
      const val = getOwn(srcMap, id);
      if (val !== undefined) {
        out[id] = val;
      }
    }
  }
  return out;
}

function rollbackLevelProgress(clientMeta, serverMeta, levelId) {
  if (VALID_LEVEL_SET.has(levelId)) {
    const prevScore =
      serverMeta && hasOwn(serverMeta.levelBestScores, levelId)
        ? clampInt(getOwn(serverMeta.levelBestScores, levelId), 0, getChapterScoreCapForLevel(levelId), 0)
        : 0;
    const prevStar =
      serverMeta && hasOwn(serverMeta.levelStars, levelId)
        ? clampInt(getOwn(serverMeta.levelStars, levelId), 0, 3, 0)
        : 0;

    if (prevScore > 0) {
      clientMeta.levelBestScores[levelId] = prevScore;
    } else {
      delete clientMeta.levelBestScores[levelId];
    }

    if (prevStar > 0 && prevScore > 0) {
      clientMeta.levelStars[levelId] = prevStar;
    } else {
      delete clientMeta.levelStars[levelId];
    }
  } else {
    clientMeta.levelBestScores = serverMeta ? cloneValidLevelMap(serverMeta.levelBestScores) : {};
    clientMeta.levelStars = serverMeta ? cloneValidLevelMap(serverMeta.levelStars) : {};
  }

  clientMeta.highestUnlockedLevel = computeHighestUnlockedLevel(clientMeta.levelStars);
  clientMeta.lifetimeStats.totalStars = computeTotalStars(clientMeta.levelStars);
  clientMeta.lifetimeStats.totalCumulativeScore = computeTotalCumulativeScore(clientMeta.levelBestScores);
}

function rollbackModeStats(clientMeta, serverMeta, mode) {
  const fallback = serverMeta && isPlainRecord(serverMeta.modeStats)
    ? sanitizeModeStats(serverMeta.modeStats)
    : createDefaultModeStats();
  if (!isPlainRecord(clientMeta.modeStats)) {
    clientMeta.modeStats = createDefaultModeStats();
  }
  if (mode === 'daily') {
    clientMeta.modeStats.daily = fallback.daily;
  } else if (mode === 'endless') {
    clientMeta.modeStats.endless = fallback.endless;
  }
}

/**
 * 服务端反作弊校验（纯上菜唯一得分铁律、最短时长、分章得分上限，以及每天特调/无限营业模式校验）。
 */
function validateAndClampClientMeta(serverRaw, clientRaw, runReport, serverWrapperDoc) {
  const warnings = [];
  const hasServer = isPlainRecord(serverRaw) || isPlainRecord(serverWrapperDoc);
  const server = hasServer ? sanitizeMetaSave(serverRaw, null, serverWrapperDoc) : null;
  const client = sanitizeMetaSave(clientRaw, warnings);

  if (isPlainRecord(runReport)) {
    const rrScoreNum = hasOwn(runReport, 'score') ? toSafeNum(getOwn(runReport, 'score')) : 0;
    const rrScore = Number.isFinite(rrScoreNum)
      ? Math.floor(rrScoreNum)
      : rrScoreNum === Infinity
      ? MAX_TOTAL_CUMULATIVE_SCORE + 1
      : 0;

    const rawServesVal = hasOwn(runReport, 'serves')
      ? getOwn(runReport, 'serves')
      : hasOwn(runReport, 'ordersServed')
      ? getOwn(runReport, 'ordersServed')
      : 0;
    const rrServes = toFiniteInt(rawServesVal, 0);

    const rawDurVal = getOwn(runReport, 'durationSec');
    const hasDur =
      hasOwn(runReport, 'durationSec') &&
      rawDurVal !== undefined &&
      rawDurVal !== null;
    const rrDuration = hasDur ? toSafeNum(rawDurVal) : NaN;

    const rawLid = getOwn(runReport, 'levelId');
    const lid = typeof rawLid === 'string' ? rawLid.trim() : '';

    const rawModeVal = getOwn(runReport, 'mode');
    const explicitMode = typeof rawModeVal === 'string' ? rawModeVal.trim() : '';
    const rrMode =
      explicitMode === 'daily' || explicitMode === 'endless'
        ? explicitMode
        : lid.indexOf('daily_') === 0
        ? 'daily'
        : lid.indexOf('endless_') === 0
        ? 'endless'
        : 'campaign';

    if (rrMode === 'daily') {
      if (rrScore > 0) {
        let rolledBack = false;
        if (rrServes < 1) {
          pushUniqueWarning(warnings, 'zero_serve_score_rejected');
          rollbackModeStats(client, server, 'daily');
          rolledBack = true;
        }
        if (hasDur && (!Number.isFinite(rrDuration) || rrDuration < 3)) {
          pushUniqueWarning(warnings, 'implausible_run_duration');
          if (!rolledBack) {
            rollbackModeStats(client, server, 'daily');
            rolledBack = true;
          }
        }
        if (!rolledBack && rrScore > MAX_DAILY_SCORE) {
          pushUniqueWarning(warnings, 'run_score_cap_clamped');
          if (client.modeStats && client.modeStats.daily && client.modeStats.daily.bestScore > MAX_DAILY_SCORE) {
            client.modeStats.daily.bestScore = MAX_DAILY_SCORE;
          }
        }
      }
    } else if (rrMode === 'endless') {
      const rrShift = clampInt(
        hasOwn(runReport, 'shift') ? getOwn(runReport, 'shift') : 1,
        1,
        MAX_ENDLESS_SHIFT,
        1
      );
      if (rrScore > 0) {
        let rolledBack = false;
        if (rrServes < 1) {
          pushUniqueWarning(warnings, 'zero_serve_score_rejected');
          rollbackModeStats(client, server, 'endless');
          rolledBack = true;
        }
        if (hasDur && (!Number.isFinite(rrDuration) || rrDuration < 3)) {
          pushUniqueWarning(warnings, 'implausible_run_duration');
          if (!rolledBack) {
            rollbackModeStats(client, server, 'endless');
            rolledBack = true;
          }
        }
        const shiftCap = Math.min(MAX_ENDLESS_SCORE, Math.max(1, rrShift) * MAX_ENDLESS_SCORE_PER_SHIFT);
        if (!rolledBack && rrScore > shiftCap) {
          pushUniqueWarning(warnings, 'run_score_cap_clamped');
          if (client.modeStats && client.modeStats.endless && client.modeStats.endless.bestScore > shiftCap) {
            client.modeStats.endless.bestScore = shiftCap;
          }
        }
      }
    } else if (rrScore > 0) {
      let rolledBack = false;
      if (rrServes < 1) {
        pushUniqueWarning(warnings, 'zero_serve_score_rejected');
        rollbackLevelProgress(client, server, lid);
        rolledBack = true;
      }
      if (hasDur && (!Number.isFinite(rrDuration) || rrDuration < 3)) {
        pushUniqueWarning(warnings, 'implausible_run_duration');
        if (!rolledBack) {
          rollbackLevelProgress(client, server, lid);
          rolledBack = true;
        }
      }
      if (!rolledBack && !VALID_LEVEL_SET.has(lid)) {
        pushUniqueWarning(warnings, 'invalid_run_level');
        rollbackLevelProgress(client, server, lid);
        rolledBack = true;
      }
      if (!rolledBack && VALID_LEVEL_SET.has(lid)) {
        const cap = getChapterScoreCapForLevel(lid);
        const rawEarly = hasOwn(runReport, 'earlyCloseBonus') ? toSafeNum(getOwn(runReport, 'earlyCloseBonus')) : 0;
        if (Number.isFinite(rawEarly) && rawEarly > 20000) {
          pushUniqueWarning(warnings, 'early_close_bonus_clamped');
        }
        if (rrScore > cap) {
          pushUniqueWarning(warnings, 'run_score_cap_clamped');
          pushUniqueWarning(warnings, 'level_score_cap_clamped');
          if (hasOwn(client.levelBestScores, lid) && client.levelBestScores[lid] > cap) {
            client.levelBestScores[lid] = cap;
          }
          client.lifetimeStats.totalCumulativeScore = computeTotalCumulativeScore(client.levelBestScores);
        }
      }
    }
  }

  return {
    sanitizedClient: client,
    warnings
  };
}

function isPlaceholderNickName(nick, defaultName) {
  if (typeof nick !== 'string') return true;
  const trimmed = nick.trim();
  if (!trimmed) return true;
  if (defaultName && trimmed === defaultName) return true;
  return /^星夜店长#[0-9A-Za-z_-]{1,8}$/.test(trimmed);
}

function isPlaceholderCloudProfile(prof, defaultName) {
  if (!isPlainRecord(prof)) return true;
  if (getOwn(prof, 'authorized')) return false;
  if (getOwn(prof, 'avatarUrl')) return false;
  const preset = getOwn(prof, 'avatarPreset');
  if (preset && preset !== 'mikan') return false;
  const ts = getOwn(prof, 'updatedAt');
  if ((typeof ts === 'number' ? ts : 0) > 0) return false;
  return isPlaceholderNickName(getOwn(prof, 'nickName'), defaultName);
}

function isUntouchedModeStats(ms) {
  if (!isPlainRecord(ms)) return true;
  const d = isPlainRecord(ms.daily) ? ms.daily : {};
  const e = isPlainRecord(ms.endless) ? ms.endless : {};
  return Boolean(
    !d.lastDate &&
      !(d.bestScore > 0) &&
      !d.claimedDate &&
      !d.claimed3Date &&
      !(e.bestShift > 0) &&
      !(e.bestScore > 0) &&
      !(e.runs > 0) &&
      !e.dailyDustDate &&
      !(e.dailyDust > 0)
  );
}

function isUntouchedSettings(st) {
  if (!isPlainRecord(st)) return true;
  return Boolean(st.vibrateEnabled === true && !st.lowPowerMode && !st.colorblindMarks);
}

function isUntouchedDefaultMeta(s) {
  return Boolean(
    isPlainRecord(s) &&
      s.totalEarnedStardust === DEFAULT_INITIAL_STARDUST &&
      computeSpentStardust(s) === 0 &&
      s.lifetimeStats &&
      s.lifetimeStats.runsPlayed === 0 &&
      s.lifetimeStats.ordersServed === 0 &&
      s.lifetimeStats.vipServed === 0 &&
      s.lifetimeStats.totalStars === 0 &&
      s.lifetimeStats.totalCumulativeScore === 0 &&
      (!isPlainRecord(s.levelFailStreaks) || Object.keys(s.levelFailStreaks).length === 0) &&
      (!isPlainRecord(s.levelGoalsDone) || Object.keys(s.levelGoalsDone).length === 0) &&
      (!isPlainRecord(s.researchUnlocks) || Object.keys(s.researchUnlocks).length === 0) &&
      isUntouchedModeStats(s.modeStats) &&
      isUntouchedSettings(s.settings) &&
      !s.migratedFromV1GiftPending &&
      s.selectedPatron === 'mikan' &&
      s.equippedTheme === 'amber' &&
      s.bgmTrack === 'waltz' &&
      s.sfxEnabled === true &&
      s.seenTutorials &&
      !s.seenTutorials.intro_slide &&
      !s.seenTutorials.tray_trash &&
      !s.seenTutorials.flavor_tile &&
      !s.seenTutorials.ice_tile &&
      isPlaceholderCloudProfile(s.playerProfile, '')
  );
}

function isUntouchedInitialServerMeta(s, prevRevision) {
  return Boolean(
    prevRevision <= 1 &&
      isPlainRecord(s) &&
      s.totalEarnedStardust === DEFAULT_INITIAL_STARDUST &&
      computeSpentStardust(s) === 0 &&
      s.lifetimeStats &&
      s.lifetimeStats.runsPlayed === 0 &&
      s.lifetimeStats.ordersServed === 0 &&
      s.lifetimeStats.vipServed === 0 &&
      s.lifetimeStats.totalStars === 0 &&
      s.lifetimeStats.totalCumulativeScore === 0 &&
      (!isPlainRecord(s.levelFailStreaks) || Object.keys(s.levelFailStreaks).length === 0) &&
      (!isPlainRecord(s.levelGoalsDone) || Object.keys(s.levelGoalsDone).length === 0) &&
      (!isPlainRecord(s.researchUnlocks) || Object.keys(s.researchUnlocks).length === 0) &&
      isUntouchedModeStats(s.modeStats) &&
      !s.migratedFromV1GiftPending
  );
}

function mergeMetaSaves(serverRaw, clientRaw, warnings, serverWrapperDoc) {
  const hasServer = isPlainRecord(serverRaw) || isPlainRecord(serverWrapperDoc);
  const b = sanitizeMetaSave(clientRaw, warnings);

  if (!hasServer) {
    const spentOnly = computeSpentStardust(b);
    const maxFirstPush = Math.max(spentOnly, MAX_INITIAL_UNSYNCED_STARDUST);
    let firstEarned;
    if (b.totalEarnedStardust > maxFirstPush) {
      pushUniqueWarning(warnings, 'stardust_delta_clamped');
      firstEarned = maxFirstPush;
    } else {
      firstEarned = Math.max(DEFAULT_INITIAL_STARDUST, b.totalEarnedStardust, spentOnly);
    }
    b.totalEarnedStardust = Math.min(MAX_SAFE_EARNED_STARDUST, firstEarned);
    b.lastSyncedEarnedStardust = b.totalEarnedStardust;
    b.bankStardust = Math.max(0, b.totalEarnedStardust - spentOnly);
    b.updatedAt = Date.now();
    return b;
  }

  const a = sanitizeMetaSave(serverRaw, null, serverWrapperDoc);
  if (!isPlainRecord(clientRaw)) {
    a.lastSyncedEarnedStardust = a.totalEarnedStardust;
    return a;
  }

  const rawWrapRev = isPlainRecord(serverWrapperDoc) ? getOwn(serverWrapperDoc, 'revision') : undefined;
  const prevRev =
    isPlainRecord(serverWrapperDoc) && hasOwn(serverWrapperDoc, 'revision')
      ? Math.max(0, toFiniteInt(rawWrapRev, 1))
      : 1;
  const serverUntouchedInitial = isUntouchedInitialServerMeta(a, prevRev);
  const serverUntouched = isUntouchedDefaultMeta(a);
  const clientUntouched = isUntouchedDefaultMeta(b);

  const preferB =
    clientUntouched && !serverUntouched
      ? false
      : serverUntouchedInitial || (!clientUntouched && serverUntouched)
      ? true
      : (b.updatedAt || 0) >= (a.updatedAt || 0);
  const latest = preferB ? b : a;

  const levelBestScores = {};
  const levelStars = {};
  const levelFailStreaks = {};
  const levelGoalsDone = {};
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    const id = VALID_LEVEL_IDS[i];
    const scA = hasOwn(a.levelBestScores, id) ? a.levelBestScores[id] : 0;
    const scB = hasOwn(b.levelBestScores, id) ? b.levelBestScores[id] : 0;
    const best = Math.max(scA, scB);
    if (best > 0) {
      levelBestScores[id] = best;
    }

    const stA = hasOwn(a.levelStars, id) ? a.levelStars[id] : 0;
    const stB = hasOwn(b.levelStars, id) ? b.levelStars[id] : 0;
    const stars = Math.max(stA, stB);
    if (stars > 0 && best > 0) {
      levelStars[id] = stars;
    } else {
      const fs =
        isPlainRecord(latest.levelFailStreaks) && hasOwn(latest.levelFailStreaks, id)
          ? latest.levelFailStreaks[id]
          : Math.max(
              isPlainRecord(a.levelFailStreaks) && hasOwn(a.levelFailStreaks, id) ? a.levelFailStreaks[id] : 0,
              isPlainRecord(b.levelFailStreaks) && hasOwn(b.levelFailStreaks, id) ? b.levelFailStreaks[id] : 0
            );
      if (fs > 0) {
        levelFailStreaks[id] = fs;
      }
    }

    if (
      (isPlainRecord(a.levelGoalsDone) && Boolean(getOwn(a.levelGoalsDone, id))) ||
      (isPlainRecord(b.levelGoalsDone) && Boolean(getOwn(b.levelGoalsDone, id)))
    ) {
      levelGoalsDone[id] = true;
    }
  }

  const catcakeLevels = {};
  for (let t = 1; t <= 7; t++) {
    const k = String(t);
    catcakeLevels[k] = Math.max(a.catcakeLevels[k] || 0, b.catcakeLevels[k] || 0);
  }

  const deviceUpgrades = {
    dev_tray: Math.max(a.deviceUpgrades.dev_tray || 0, b.deviceUpgrades.dev_tray || 0),
    dev_flour: Math.max(a.deviceUpgrades.dev_flour || 0, b.deviceUpgrades.dev_flour || 0),
    dev_teapot: Math.max(a.deviceUpgrades.dev_teapot || 0, b.deviceUpgrades.dev_teapot || 0),
    dev_tools: Math.max(a.deviceUpgrades.dev_tools || 0, b.deviceUpgrades.dev_tools || 0)
  };

  const unlockedPatrons = sanitizeUnlockedPatrons(a.unlockedPatrons.concat(b.unlockedPatrons));
  const selectedPatron =
    unlockedPatrons.indexOf(latest.selectedPatron) !== -1 ? latest.selectedPatron : 'mikan';

  const unlockedThemes = sanitizeUnlockedThemes(a.unlockedThemes.concat(b.unlockedThemes));
  const equippedTheme =
    unlockedThemes.indexOf(latest.equippedTheme) !== -1 ? latest.equippedTheme : 'amber';

  const researchUnlocks = {};
  const resKeys = Object.keys(RESEARCH_COSTS);
  for (let i = 0; i < resKeys.length; i++) {
    const k = resKeys[i];
    if (
      (isPlainRecord(a.researchUnlocks) && Boolean(getOwn(a.researchUnlocks, k))) ||
      (isPlainRecord(b.researchUnlocks) && Boolean(getOwn(b.researchUnlocks, k)))
    ) {
      researchUnlocks[k] = true;
    }
  }

  const modeStats = mergeModeStats(a.modeStats, b.modeStats);
  const seenTipsRaw = Object.assign(
    {},
    isPlainRecord(a.seenTips) ? a.seenTips : {},
    isPlainRecord(b.seenTips) ? b.seenTips : {}
  );
  const seenTips = sanitizeSeenTips(seenTipsRaw);
  const settings = sanitizeSettings(latest.settings);

  const consumableSpentStardust = clampInt(
    Math.max(a.consumableSpentStardust || 0, b.consumableSpentStardust || 0),
    0,
    MAX_CONSUMABLE_SPENT_STARDUST,
    0
  );

  const totalStars = computeTotalStars(levelStars);
  const totalCumulativeScore = computeTotalCumulativeScore(levelBestScores);
  const highestUnlockedLevel = computeHighestUnlockedLevel(levelStars);

  const merged = {
    schemaVersion: SCHEMA_VERSION,
    bgmTrack: latest.bgmTrack,
    sfxEnabled: latest.sfxEnabled,
    bankStardust: 0,
    totalEarnedStardust: DEFAULT_INITIAL_STARDUST,
    lastSyncedEarnedStardust: 0,
    consumableSpentStardust,
    migratedFromV1GiftPending:
      clientUntouched && !serverUntouched
        ? Boolean(a.migratedFromV1GiftPending)
        : Boolean(b.migratedFromV1GiftPending),
    levelStars,
    levelBestScores,
    levelFailStreaks,
    levelGoalsDone,
    highestUnlockedLevel,
    catcakeLevels,
    deviceUpgrades,
    selectedPatron,
    unlockedPatrons,
    equippedTheme,
    unlockedThemes,
    researchUnlocks,
    modeStats,
    seenTutorials: {
      intro_slide: Boolean(a.seenTutorials.intro_slide || b.seenTutorials.intro_slide),
      tray_trash: Boolean(a.seenTutorials.tray_trash || b.seenTutorials.tray_trash),
      flavor_tile: Boolean(a.seenTutorials.flavor_tile || b.seenTutorials.flavor_tile),
      ice_tile: Boolean(a.seenTutorials.ice_tile || b.seenTutorials.ice_tile)
    },
    seenTips,
    settings,
    playerProfile: latest.playerProfile,
    lifetimeStats: {
      runsPlayed: Math.max(a.lifetimeStats.runsPlayed || 0, b.lifetimeStats.runsPlayed || 0),
      ordersServed: Math.max(a.lifetimeStats.ordersServed || 0, b.lifetimeStats.ordersServed || 0),
      vipServed: Math.max(a.lifetimeStats.vipServed || 0, b.lifetimeStats.vipServed || 0),
      maxComboEver: Math.max(a.lifetimeStats.maxComboEver || 0, b.lifetimeStats.maxComboEver || 0),
      highestSingleServe: Math.max(
        a.lifetimeStats.highestSingleServe || 0,
        b.lifetimeStats.highestSingleServe || 0
      ),
      totalStars,
      totalCumulativeScore
    },
    updatedAt: Date.now()
  };

  if (isHigherSchemaMeta(serverRaw) || isHigherSchemaMeta(clientRaw) || a.higherSchemaDetected || b.higherSchemaDetected) {
    merged.higherSchemaDetected = true;
  }

  const spent = computeSpentStardust(merged);
  const syncBase = b.lastSyncedEarnedStardust || 0;
  let totalEarned;

  if (
    serverUntouchedInitial &&
    (syncBase === 0 || syncBase === b.totalEarnedStardust || b.migratedFromV1GiftPending)
  ) {
    const maxFirstPush = Math.max(spent, MAX_INITIAL_UNSYNCED_STARDUST);
    if (b.totalEarnedStardust > maxFirstPush) {
      pushUniqueWarning(warnings, 'stardust_delta_clamped');
      totalEarned = maxFirstPush;
    } else {
      totalEarned = Math.max(DEFAULT_INITIAL_STARDUST, b.totalEarnedStardust, spent);
    }
  } else if (
    syncBase >= DEFAULT_INITIAL_STARDUST &&
    b.totalEarnedStardust > syncBase &&
    a.totalEarnedStardust > syncBase
  ) {
    const rawDelta = b.totalEarnedStardust - syncBase;
    if (rawDelta > MAX_OFFLINE_STARDUST_DELTA) {
      pushUniqueWarning(warnings, 'stardust_delta_clamped');
    }
    const clampedDelta = Math.min(MAX_OFFLINE_STARDUST_DELTA, rawDelta);
    totalEarned = Math.max(DEFAULT_INITIAL_STARDUST, spent, a.totalEarnedStardust + clampedDelta);
  } else if (b.totalEarnedStardust - a.totalEarnedStardust > MAX_OFFLINE_STARDUST_DELTA) {
    pushUniqueWarning(warnings, 'stardust_delta_clamped');
    totalEarned = Math.max(DEFAULT_INITIAL_STARDUST, spent, a.totalEarnedStardust + MAX_OFFLINE_STARDUST_DELTA);
  } else {
    totalEarned = Math.max(DEFAULT_INITIAL_STARDUST, a.totalEarnedStardust, b.totalEarnedStardust, spent);
  }

  merged.totalEarnedStardust = Math.min(MAX_SAFE_EARNED_STARDUST, totalEarned);
  merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
  merged.bankStardust = Math.max(0, merged.totalEarnedStardust - spent);
  return merged;
}

function sanitizeProfile(raw, openidSuffix, fallbackPatron) {
  const src = isPlainRecord(raw) ? raw : {};
  const suffix =
    typeof openidSuffix === 'string' && openidSuffix.trim() ? openidSuffix.trim() : '0000';
  const defaultName = '星夜店长#' + suffix;
  const rawNickVal = getOwn(src, 'nickName');
  const rawNick = typeof rawNickVal === 'string' ? rawNickVal.trim() : '';
  const nickName = rawNick ? rawNick.slice(0, 16) : defaultName;
  const rawAvatarVal = getOwn(src, 'avatarUrl');
  const rawAvatar = typeof rawAvatarVal === 'string' ? rawAvatarVal.trim() : '';
  const avatarUrl = rawAvatar ? rawAvatar.slice(0, 512) : '';
  const rawPresetVal = getOwn(src, 'avatarPreset');
  const candPreset = rawPresetVal !== undefined ? canonicalizeKnownPatronId(rawPresetVal) : null;
  const fbPreset = canonicalizeKnownPatronId(fallbackPatron) || 'mikan';
  const avatarPreset = candPreset || fbPreset;
  const authorized = hasOwn(src, 'authorized') ? Boolean(getOwn(src, 'authorized')) : false;
  const updatedAt = hasOwn(src, 'updatedAt')
    ? clampInt(getOwn(src, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
    : 0;

  return {
    nickName,
    avatarUrl,
    avatarPreset,
    authorized,
    updatedAt
  };
}

function mergeProfiles(serverRaw, clientRaw, openidSuffix, fallbackPatron) {
  const suffix =
    typeof openidSuffix === 'string' && openidSuffix.trim() ? openidSuffix.trim() : '0000';
  const defaultName = '星夜店长#' + suffix;
  const fbPreset = canonicalizeKnownPatronId(fallbackPatron) || 'mikan';

  const hasServer = isPlainRecord(serverRaw);
  const hasClient = isPlainRecord(clientRaw);
  if (!hasServer && !hasClient) {
    return sanitizeProfile(null, suffix, fbPreset);
  }
  if (!hasServer) {
    const cCheck = sanitizeProfile(clientRaw, suffix, 'mikan');
    const c = sanitizeProfile(clientRaw, suffix, fbPreset);
    if (isPlaceholderCloudProfile(cCheck, defaultName) && c.avatarPreset === 'mikan' && fbPreset !== 'mikan') {
      return {
        nickName: c.nickName,
        avatarUrl: c.avatarUrl,
        avatarPreset: fbPreset,
        authorized: c.authorized,
        updatedAt: c.updatedAt
      };
    }
    return c;
  }
  if (!hasClient) {
    const sCheck = sanitizeProfile(serverRaw, suffix, 'mikan');
    const s = sanitizeProfile(serverRaw, suffix, fbPreset);
    if (isPlaceholderCloudProfile(sCheck, defaultName) && s.avatarPreset === 'mikan' && fbPreset !== 'mikan') {
      return {
        nickName: s.nickName,
        avatarUrl: s.avatarUrl,
        avatarPreset: fbPreset,
        authorized: s.authorized,
        updatedAt: s.updatedAt
      };
    }
    return s;
  }

  const sCheck = sanitizeProfile(serverRaw, suffix, 'mikan');
  const cCheck = sanitizeProfile(clientRaw, suffix, 'mikan');
  const s = sanitizeProfile(serverRaw, suffix, fbPreset);
  const c = sanitizeProfile(clientRaw, suffix, fbPreset);

  if (s.authorized && !c.authorized) return s;
  if (c.authorized && !s.authorized) return c;

  const sPlaceholder = isPlaceholderCloudProfile(sCheck, defaultName);
  const cPlaceholder = isPlaceholderCloudProfile(cCheck, defaultName);
  const sHasCustomNick = !isPlaceholderNickName(sCheck.nickName, defaultName);
  const cHasCustomNick = !isPlaceholderNickName(cCheck.nickName, defaultName);
  const sTs = s.updatedAt || 0;
  const cTs = c.updatedAt || 0;

  if (cTs > sTs && !cPlaceholder) {
    return {
      nickName: cHasCustomNick ? c.nickName : sHasCustomNick ? s.nickName : c.nickName,
      avatarUrl: c.avatarUrl || s.avatarUrl,
      avatarPreset: c.avatarPreset,
      authorized: c.authorized,
      updatedAt: c.updatedAt
    };
  }
  if (sTs > cTs && !sPlaceholder) {
    return {
      nickName: sHasCustomNick ? s.nickName : cHasCustomNick ? c.nickName : s.nickName,
      avatarUrl: s.avatarUrl || c.avatarUrl,
      avatarPreset: s.avatarPreset,
      authorized: s.authorized,
      updatedAt: s.updatedAt
    };
  }

  if (sHasCustomNick && !cHasCustomNick && cTs <= sTs) {
    return {
      nickName: s.nickName,
      avatarUrl: s.avatarUrl || c.avatarUrl,
      avatarPreset: s.avatarPreset,
      authorized: s.authorized,
      updatedAt: s.updatedAt
    };
  }
  if (cHasCustomNick && !sHasCustomNick && sTs <= cTs) {
    return {
      nickName: c.nickName,
      avatarUrl: c.avatarUrl || s.avatarUrl,
      avatarPreset: c.avatarPreset,
      authorized: c.authorized,
      updatedAt: c.updatedAt
    };
  }

  if (cPlaceholder !== sPlaceholder) {
    const chosen = cPlaceholder ? s : c;
    const other = cPlaceholder ? c : s;
    const chosenCustom = cPlaceholder ? sHasCustomNick : cHasCustomNick;
    const otherCustom = cPlaceholder ? cHasCustomNick : sHasCustomNick;
    return {
      nickName: chosenCustom ? chosen.nickName : otherCustom ? other.nickName : s.nickName,
      avatarUrl: chosen.avatarUrl || other.avatarUrl,
      avatarPreset: chosen.avatarPreset,
      authorized: chosen.authorized,
      updatedAt: chosen.updatedAt
    };
  }

  if (cPlaceholder && sPlaceholder) {
    const primary = cTs > sTs ? c : s;
    const secondary = cTs > sTs ? s : c;
    let avatarPreset = primary.avatarPreset;
    if (avatarPreset === 'mikan') {
      if (fbPreset !== 'mikan') {
        avatarPreset = fbPreset;
      } else if (secondary.avatarPreset && secondary.avatarPreset !== 'mikan') {
        avatarPreset = secondary.avatarPreset;
      }
    }
    return {
      nickName: primary.nickName,
      avatarUrl: primary.avatarUrl || secondary.avatarUrl,
      avatarPreset,
      authorized: primary.authorized,
      updatedAt: primary.updatedAt
    };
  }

  const primary = cTs > sTs ? c : s;
  const secondary = cTs > sTs ? s : c;
  const primaryCustom = cTs > sTs ? cHasCustomNick : sHasCustomNick;
  const secondaryCustom = cTs > sTs ? sHasCustomNick : cHasCustomNick;
  return {
    nickName: primaryCustom ? primary.nickName : secondaryCustom ? secondary.nickName : primary.nickName,
    avatarUrl: primary.avatarUrl || secondary.avatarUrl,
    avatarPreset: primary.avatarPreset,
    authorized: primary.authorized,
    updatedAt: primary.updatedAt
  };
}

function applyExplicitProfileUpdate(existingProfileRaw, incomingRaw, openidSuffix, fallbackPatron, now) {
  const prev = isPlainRecord(existingProfileRaw)
    ? mergeProfiles(existingProfileRaw, null, openidSuffix, fallbackPatron)
    : sanitizeProfile(null, openidSuffix, fallbackPatron);
  const src = isPlainRecord(incomingRaw) ? incomingRaw : {};

  let nickName = prev.nickName;
  const rawNickVal = getOwn(src, 'nickName');
  if (typeof rawNickVal === 'string' && rawNickVal.trim() !== '') {
    nickName = rawNickVal.trim().slice(0, 16);
  }

  let avatarUrl = prev.avatarUrl;
  const rawAvatarVal = getOwn(src, 'avatarUrl');
  if (typeof rawAvatarVal === 'string') {
    const trimmedUrl = rawAvatarVal.trim();
    if (trimmedUrl !== '') {
      avatarUrl = trimmedUrl.slice(0, 512);
    } else if (getOwn(src, 'clearAvatarUrl') === true) {
      avatarUrl = '';
    }
  }

  let avatarPreset = prev.avatarPreset;
  if (hasOwn(src, 'avatarPreset')) {
    const candPreset = canonicalizeKnownPatronId(getOwn(src, 'avatarPreset'));
    if (candPreset) {
      avatarPreset = candPreset;
    }
  }

  const authorized = Boolean(
    prev.authorized || (hasOwn(src, 'authorized') && Boolean(getOwn(src, 'authorized')))
  );
  const reqUpdatedAt = hasOwn(src, 'updatedAt')
    ? clampInt(getOwn(src, 'updatedAt'), 0, MAX_TIMESTAMP_MS, 0)
    : 0;
  const updatedAt = Math.max(now, prev.updatedAt || 0, reqUpdatedAt);

  return {
    nickName,
    avatarUrl,
    avatarPreset,
    authorized,
    updatedAt
  };
}

function hasLegacyRootFields(doc) {
  if (!isPlainRecord(doc)) return false;
  for (let i = 0; i < LEGACY_ROOT_FIELDS.length; i++) {
    if (hasOwn(doc, LEGACY_ROOT_FIELDS[i])) return true;
  }
  return false;
}

function hasLegacyV1SaveFields(doc) {
  if (!isPlainRecord(doc)) return false;
  for (let i = 0; i < LEGACY_V1_SAVE_DETECTION_KEYS.length; i++) {
    if (hasOwn(doc, LEGACY_V1_SAVE_DETECTION_KEYS[i])) return true;
  }
  return false;
}

function resolveServerMetaRaw(existingDoc) {
  if (!isPlainRecord(existingDoc)) return null;
  const rawSrvMeta = getOwn(existingDoc, 'metaSave');
  if (isPlainRecord(rawSrvMeta)) return rawSrvMeta;
  if (!hasOwn(existingDoc, 'metaSave') || rawSrvMeta === undefined || hasLegacyV1SaveFields(existingDoc)) {
    return existingDoc;
  }
  return null;
}

function mergeRawProfilePair(a, b, docSuffix) {
  const hasA = isPlainRecord(a);
  const hasB = isPlainRecord(b);
  if (!hasA && !hasB) return null;
  if (!hasA) return b;
  if (!hasB) return a;
  const mergedMikan = mergeProfiles(a, b, docSuffix, 'mikan');
  const mergedProbe = mergeProfiles(a, b, docSuffix, 'luna');
  if (mergedMikan.avatarPreset !== mergedProbe.avatarPreset) {
    return {
      nickName: mergedMikan.nickName,
      avatarUrl: mergedMikan.avatarUrl,
      authorized: mergedMikan.authorized,
      updatedAt: mergedMikan.updatedAt
    };
  }
  return mergedMikan;
}

function resolveTopDocProfile(doc, docSuffix) {
  if (!isPlainRecord(doc)) return null;
  const rawTopProf = getOwn(doc, 'profile');
  const rawRootPlayerProf = getOwn(doc, 'playerProfile');
  return mergeRawProfilePair(rawTopProf, rawRootPlayerProf, docSuffix);
}

function resolveRawStoredDocProfile(doc, rawMetaObj, docSuffix) {
  const topProf = resolveTopDocProfile(doc, docSuffix);
  const rawMetaProf =
    isPlainRecord(rawMetaObj) &&
    rawMetaObj !== doc &&
    isPlainRecord(getOwn(rawMetaObj, 'playerProfile'))
      ? getOwn(rawMetaObj, 'playerProfile')
      : null;
  return mergeRawProfilePair(topProf, rawMetaProf, docSuffix);
}

function resolveStoredDocProfile(doc, rawMetaObj, docSuffix, fallbackPatron) {
  const topProf = resolveTopDocProfile(doc, docSuffix);
  const rawMetaProf =
    isPlainRecord(rawMetaObj) &&
    rawMetaObj !== doc &&
    isPlainRecord(getOwn(rawMetaObj, 'playerProfile'))
      ? getOwn(rawMetaObj, 'playerProfile')
      : null;
  if (isPlainRecord(topProf) || isPlainRecord(rawMetaProf)) {
    return mergeProfiles(topProf, rawMetaProf, docSuffix, fallbackPatron);
  }
  return sanitizeProfile(null, docSuffix, fallbackPatron);
}

function resolveDocSelectedPatron(doc, rawMetaObj) {
  const src = isPlainRecord(rawMetaObj)
    ? rawMetaObj
    : isPlainRecord(doc)
    ? doc
    : null;
  if (!isPlainRecord(src)) return 'mikan';
  const unlocked = sanitizeUnlockedPatrons(getOwn(src, 'unlockedPatrons'));
  const rawSel = getOwn(src, 'selectedPatron');
  const cand = rawSel !== undefined ? canonicalizeKnownPatronId(rawSel) : null;
  return cand && unlocked.indexOf(cand) !== -1 ? cand : 'mikan';
}

function buildLegacyRemovalPatch() {
  const patch = {};
  for (let i = 0; i < LEGACY_ROOT_FIELDS.length; i++) {
    patch[LEGACY_ROOT_FIELDS[i]] = _.remove();
  }
  return patch;
}

exports.main = async (rawEvent = {}, rawContext = {}) => {
  await ensurePlayersCollection();

  const event = isPlainRecord(rawEvent) ? rawEvent : {};
  const context = isPlainRecord(rawContext) ? rawContext : {};

  const wxContext = (typeof cloud.getWXContext === 'function' && cloud.getWXContext()) || {};
  const wxOpenIdVal = isPlainRecord(wxContext) ? getOwn(wxContext, 'OPENID') : undefined;
  const ctxOpenIdVal = getOwn(context, 'OPENID');
  const openid =
    typeof wxOpenIdVal === 'string' && wxOpenIdVal.trim()
      ? wxOpenIdVal.trim()
      : typeof ctxOpenIdVal === 'string' && ctxOpenIdVal.trim()
      ? ctxOpenIdVal.trim()
      : '';

  if (!openid) {
    return { ok: false, reason: 'missing_openid' };
  }

  const openidSuffix = openid.slice(-4).toUpperCase() || '0000';
  const rawActionVal = getOwn(event, 'action');
  const hasAction =
    hasOwn(event, 'action') &&
    rawActionVal !== undefined &&
    rawActionVal !== null &&
    rawActionVal !== '';
  const action = !hasAction
    ? 'pull'
    : typeof rawActionVal === 'string'
    ? rawActionVal.trim() || 'pull'
    : '__invalid__';

  const docRef = db.collection(PLAYERS_COL).doc(openid);

  function getUtc8DateKey(nowMs) {
    const ms = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const shifted = new Date(ms + 8 * 3600 * 1000);
    const y = shifted.getUTCFullYear();
    const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
    const d = String(shifted.getUTCDate()).padStart(2, '0');
    return String(y) + m + d;
  }

  function extractModeRankFields(meta) {
    const ms = isPlainRecord(meta) && isPlainRecord(meta.modeStats) ? meta.modeStats : createDefaultModeStats();
    const daily = isPlainRecord(ms.daily) ? ms.daily : {};
    const endless = isPlainRecord(ms.endless) ? ms.endless : {};
    return {
      dailyDateKey: sanitizeDateKey(getOwn(daily, 'lastDate')),
      dailyBestScore: clampInt(getOwn(daily, 'bestScore'), 0, MAX_DAILY_SCORE, 0),
      endlessBestShift: clampInt(getOwn(endless, 'bestShift'), 0, MAX_ENDLESS_SHIFT, 0),
      endlessBestScore: clampInt(getOwn(endless, 'bestScore'), 0, MAX_ENDLESS_SCORE, 0)
    };
  }

  async function readExisting() {
    try {
      const got = await docRef.get();
      const gotData = isPlainRecord(got) ? getOwn(got, 'data') : null;
      return isPlainRecord(gotData) ? gotData : null;
    } catch (_err) {
      return null;
    }
  }

  if (action === 'config') {
    let configVersion = 'default';
    const safeOverrides = {};
    try {
      const cfgGot = await db.collection('config').doc('balance').get();
      const cfgData = isPlainRecord(cfgGot) && isPlainRecord(getOwn(cfgGot, 'data'))
        ? getOwn(cfgGot, 'data')
        : null;
      if (cfgData) {
        const rawVer = getOwn(cfgData, 'configVersion');
        if (typeof rawVer === 'string' && rawVer.trim()) {
          configVersion = rawVer.trim().slice(0, 32);
        }
        const rawOv = getOwn(cfgData, 'overrides');
        if (isPlainRecord(rawOv)) {
          const ovKeys = Object.keys(rawOv);
          for (let i = 0; i < ovKeys.length; i++) {
            const k = ovKeys[i];
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            if (k === 'features') {
              const rf = getOwn(rawOv, 'features');
              if (isPlainRecord(rf)) {
                const sf = {};
                const fk = Object.keys(rf);
                for (let j = 0; j < fk.length; j++) {
                  const fName = fk[j];
                  if (fName === '__proto__' || fName === 'constructor' || fName === 'prototype') continue;
                  const fv = getOwn(rf, fName);
                  if (typeof fv === 'boolean') sf[fName] = fv;
                }
                safeOverrides.features = sf;
              }
            } else {
              const v = Number(getOwn(rawOv, k));
              if (Number.isFinite(v)) safeOverrides[k] = v;
            }
          }
        }
      }
    } catch (_err) {
      // Collection `config` may not exist yet in CloudBase; cleanly fall back to empty overrides.
    }
    return {
      ok: true,
      configVersion,
      overrides: safeOverrides
    };
  }

  let existing = await readExisting();

  if (action === 'pull') {
    if (!existing) {
      const now = Date.now();
      const initProfile = sanitizeProfile(null, openidSuffix, 'mikan');
      const initMeta = createDefaultMetaSave();
      initMeta.lastSyncedEarnedStardust = initMeta.totalEarnedStardust;
      initMeta.playerProfile = {
        nickName: initProfile.nickName,
        avatarUrl: initProfile.avatarUrl,
        avatarPreset: initProfile.avatarPreset,
        authorized: initProfile.authorized,
        updatedAt: initProfile.updatedAt
      };
      initMeta.updatedAt = now;

      const newDoc = Object.assign(
        {
          openidSuffix,
          profile: initProfile,
          totalStars: 0,
          totalCumulativeScore: 0,
          metaSave: initMeta,
          revision: 1,
          createdAt: now,
          updatedAt: now
        },
        extractModeRankFields(initMeta)
      );
      await docRef.set({ data: newDoc });

      return {
        ok: true,
        isNewUser: true,
        migratedFromV1: false,
        openidSuffix,
        profile: initProfile,
        totalStars: 0,
        totalCumulativeScore: 0,
        metaSave: initMeta,
        revision: 1
      };
    }

    const rawDocSuffix = getOwn(existing, 'openidSuffix');
    const docSuffix =
      typeof rawDocSuffix === 'string' && rawDocSuffix.trim()
        ? rawDocSuffix.trim()
        : openidSuffix;

    const rawExistingMeta = getOwn(existing, 'metaSave');
    const existingMetaObj = isPlainRecord(rawExistingMeta) ? rawExistingMeta : null;
    if (isHigherSchemaMeta(existingMetaObj) || isHigherSchemaMeta(existing)) {
      const cleanReadMeta = sanitizeMetaSave(existingMetaObj || existing);
      cleanReadMeta.higherSchemaDetected = true;
      const rev = Math.max(
        1,
        toFiniteInt(hasOwn(existing, 'revision') ? getOwn(existing, 'revision') : 1, 1)
      );
      const readProfile = resolveStoredDocProfile(
        existing,
        existingMetaObj,
        docSuffix,
        cleanReadMeta.selectedPatron
      );
      return {
        ok: true,
        isNewUser: false,
        migratedFromV1: false,
        higherSchemaDetected: true,
        openidSuffix: docSuffix,
        profile: readProfile,
        totalStars: cleanReadMeta.lifetimeStats.totalStars,
        totalCumulativeScore: cleanReadMeta.lifetimeStats.totalCumulativeScore,
        metaSave: existingMetaObj || cleanReadMeta,
        revision: rev
      };
    }

    const existingSv = existingMetaObj && hasOwn(existingMetaObj, 'schemaVersion')
      ? toSafeNum(getOwn(existingMetaObj, 'schemaVersion'))
      : 0;
    const isExistingV1 = !(Number.isFinite(existingSv) && existingSv >= 2);
    const needsV2ToV3Upgrade = Number.isFinite(existingSv) && existingSv >= 2 && existingSv < SCHEMA_VERSION;

    if (isExistingV1) {
      const now = Date.now();
      const migratedSource = existingMetaObj || existing;
      const migratedMeta = migrateV1ToV2(migratedSource, existing);
      migratedMeta.lastSyncedEarnedStardust = migratedMeta.totalEarnedStardust;
      const nextProfile = resolveStoredDocProfile(
        existing,
        existingMetaObj,
        docSuffix,
        migratedMeta.selectedPatron
      );
      migratedMeta.playerProfile = {
        nickName: nextProfile.nickName,
        avatarUrl: nextProfile.avatarUrl,
        avatarPreset: nextProfile.avatarPreset,
        authorized: nextProfile.authorized,
        updatedAt: nextProfile.updatedAt
      };
      migratedMeta.updatedAt = migratedMeta.updatedAt || now;
      const nextRev = Math.max(
        1,
        toFiniteInt(hasOwn(existing, 'revision') ? getOwn(existing, 'revision') : 1, 1)
      );
      const totalStars = migratedMeta.lifetimeStats.totalStars;
      const totalCumulativeScore = migratedMeta.lifetimeStats.totalCumulativeScore;

      await docRef.update({
        data: Object.assign(
          {
            openidSuffix: docSuffix,
            profile: _.set(nextProfile),
            totalStars,
            totalCumulativeScore,
            metaSave: _.set(migratedMeta),
            revision: nextRev,
            updatedAt: now
          },
          extractModeRankFields(migratedMeta),
          buildLegacyRemovalPatch()
        )
      });

      return {
        ok: true,
        isNewUser: false,
        migratedFromV1: true,
        openidSuffix: docSuffix,
        profile: nextProfile,
        totalStars,
        totalCumulativeScore,
        metaSave: migratedMeta,
        revision: nextRev
      };
    }

    const cleanMeta = sanitizeMetaSave(existingMetaObj);
    cleanMeta.lastSyncedEarnedStardust = cleanMeta.totalEarnedStardust;
    const cleanProfile = resolveStoredDocProfile(
      existing,
      existingMetaObj,
      docSuffix,
      cleanMeta.selectedPatron
    );
    cleanMeta.playerProfile = {
      nickName: cleanProfile.nickName,
      avatarUrl: cleanProfile.avatarUrl,
      avatarPreset: cleanProfile.avatarPreset,
      authorized: cleanProfile.authorized,
      updatedAt: cleanProfile.updatedAt
    };
    const rawExistingPullRev = hasOwn(existing, 'revision')
      ? getOwn(existing, 'revision')
      : undefined;
    const hasCorruptedPullRev =
      !hasOwn(existing, 'revision') ||
      typeof rawExistingPullRev !== 'number' ||
      !Number.isFinite(rawExistingPullRev) ||
      !Number.isInteger(rawExistingPullRev) ||
      rawExistingPullRev < 1;
    const rev = Math.max(
      1,
      toFiniteInt(hasOwn(existing, 'revision') ? rawExistingPullRev : 1, 1)
    );
    const totalStars = cleanMeta.lifetimeStats.totalStars;
    const totalCumulativeScore = cleanMeta.lifetimeStats.totalCumulativeScore;

    if (needsV2ToV3Upgrade || hasLegacyRootFields(existing) || hasCorruptedPullRev) {
      await docRef.update({
        data: Object.assign(
          {
            openidSuffix: docSuffix,
            profile: _.set(cleanProfile),
            totalStars,
            totalCumulativeScore,
            metaSave: _.set(cleanMeta),
            revision: rev,
            updatedAt: Date.now()
          },
          extractModeRankFields(cleanMeta),
          buildLegacyRemovalPatch()
        )
      });
    }

    return {
      ok: true,
      isNewUser: false,
      migratedFromV1: false,
      openidSuffix: docSuffix,
      profile: cleanProfile,
      totalStars,
      totalCumulativeScore,
      metaSave: cleanMeta,
      revision: rev
    };
  }

  if (action === 'push') {
    const baseRev = hasOwn(event, 'baseRevision') ? toFiniteInt(getOwn(event, 'baseRevision'), 0) : 0;
    let conflictMerged = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        existing = await readExisting();
      }

      if (existing) {
        const rawExistingPushMeta = getOwn(existing, 'metaSave');
        const existingPushMetaObj = isPlainRecord(rawExistingPushMeta) ? rawExistingPushMeta : null;
        if (isHigherSchemaMeta(existingPushMetaObj) || isHigherSchemaMeta(existing)) {
          return {
            ok: false,
            blocked: true,
            higherSchemaDetected: true,
            reason: 'higher_schema_version_on_cloud'
          };
        }
      }

      const rawExistingRev = existing ? getOwn(existing, 'revision') : undefined;
      const hasExistingRev =
        Boolean(existing) && hasOwn(existing, 'revision') && rawExistingRev !== undefined;
      const prevRev = existing ? Math.max(0, toFiniteInt(rawExistingRev, 0)) : 0;

      if (existing && baseRev > 0 && baseRev < (prevRev || 1)) {
        conflictMerged = true;
      }

      const serverMetaRaw = resolveServerMetaRaw(existing);
      const clientMetaRaw = getOwn(event, 'metaSave');
      const hasClientMeta = isPlainRecord(clientMetaRaw);
      const runReportRaw = getOwn(event, 'runReport');

      const validated = validateAndClampClientMeta(
        serverMetaRaw,
        clientMetaRaw,
        runReportRaw,
        existing
      );
      const warnings = validated.warnings;
      const mergedMeta = mergeMetaSaves(
        serverMetaRaw,
        hasClientMeta ? validated.sanitizedClient : null,
        warnings,
        existing
      );

      const rawDocSuffix = existing ? getOwn(existing, 'openidSuffix') : undefined;
      const docSuffix =
        typeof rawDocSuffix === 'string' && rawDocSuffix.trim()
          ? rawDocSuffix.trim()
          : openidSuffix;
      const defaultName = '星夜店长#' + docSuffix;

      const rawSrvProf = existing
        ? resolveRawStoredDocProfile(existing, serverMetaRaw, docSuffix)
        : null;
      const serverProfileInput = isPlainRecord(rawSrvProf)
        ? rawSrvProf
        : existing
        ? {}
        : null;

      const serverHasTouchedProfile =
        Boolean(existing) &&
        isPlainRecord(serverProfileInput) &&
        !isPlaceholderCloudProfile(
          sanitizeProfile(serverProfileInput, docSuffix, 'mikan'),
          defaultName
        );
      const evProfileRaw = getOwn(event, 'profile');
      const suppressUntouchedClientProf =
        Boolean(existing) &&
        hasClientMeta &&
        isUntouchedDefaultMeta(validated.sanitizedClient) &&
        (!isUntouchedDefaultMeta(sanitizeMetaSave(serverMetaRaw, null, existing)) ||
          serverHasTouchedProfile);

      const evProfIsPlaceholder =
        !isPlainRecord(evProfileRaw) ||
        isPlaceholderCloudProfile(sanitizeProfile(evProfileRaw, docSuffix, 'mikan'), defaultName);
      const effectiveEvProfile =
        isPlainRecord(evProfileRaw) && !(suppressUntouchedClientProf && evProfIsPlaceholder)
          ? evProfileRaw
          : null;
      const clientMetaProfRaw =
        hasClientMeta && !suppressUntouchedClientProf
          ? getOwn(clientMetaRaw, 'playerProfile')
          : null;
      const clientProfileInput = isPlainRecord(effectiveEvProfile)
        ? effectiveEvProfile
        : isPlainRecord(clientMetaProfRaw)
        ? clientMetaProfRaw
        : null;

      const mergedProfile = mergeProfiles(
        serverProfileInput,
        clientProfileInput,
        docSuffix,
        mergedMeta.selectedPatron
      );

      mergedMeta.playerProfile = {
        nickName: mergedProfile.nickName,
        avatarUrl: mergedProfile.avatarUrl,
        avatarPreset: mergedProfile.avatarPreset,
        authorized: mergedProfile.authorized,
        updatedAt: mergedProfile.updatedAt
      };

      const now = Date.now();
      mergedMeta.updatedAt = now;
      const totalStars = mergedMeta.lifetimeStats.totalStars;
      const totalCumulativeScore = mergedMeta.lifetimeStats.totalCumulativeScore;
      const nextRev = prevRev + 1;

      if (!existing) {
        const setPayload = Object.assign(
          {
            openidSuffix: docSuffix,
            profile: mergedProfile,
            totalStars,
            totalCumulativeScore,
            metaSave: mergedMeta,
            revision: nextRev,
            createdAt: now,
            updatedAt: now
          },
          extractModeRankFields(mergedMeta)
        );
        await docRef.set({ data: setPayload });
        return {
          ok: true,
          openidSuffix: docSuffix,
          profile: mergedProfile,
          totalStars,
          totalCumulativeScore,
          metaSave: mergedMeta,
          revision: nextRev,
          conflictMerged,
          validationWarnings: warnings
        };
      }

      const updatePayload = Object.assign(
        {
          openidSuffix: docSuffix,
          profile: _.set(mergedProfile),
          totalStars,
          totalCumulativeScore,
          metaSave: _.set(mergedMeta),
          revision: nextRev,
          updatedAt: now
        },
        extractModeRankFields(mergedMeta),
        buildLegacyRemovalPatch()
      );

      const isUnmatchableRev =
        hasExistingRev &&
        ((typeof rawExistingRev === 'number' && !Number.isFinite(rawExistingRev)) ||
          (typeof rawExistingRev === 'object' && rawExistingRev !== null) ||
          typeof rawExistingRev === 'function' ||
          typeof rawExistingRev === 'symbol' ||
          typeof rawExistingRev === 'bigint');

      let updRes;
      if (isUnmatchableRev) {
        updRes = await docRef.update({ data: updatePayload });
      } else {
        const revCond = hasExistingRev ? _.eq(rawExistingRev) : _.exists(false);
        updRes = await db
          .collection(PLAYERS_COL)
          .where({ _id: openid, revision: revCond })
          .update({ data: updatePayload });
      }

      if (updRes && updRes.stats && updRes.stats.updated > 0) {
        return {
          ok: true,
          openidSuffix: docSuffix,
          profile: mergedProfile,
          totalStars,
          totalCumulativeScore,
          metaSave: mergedMeta,
          revision: nextRev,
          conflictMerged,
          validationWarnings: warnings
        };
      }

      conflictMerged = true;
    }

    return {
      ok: false,
      conflict: true,
      reason: 'revision_conflict_retry_exhausted'
    };
  }

  if (action === 'updateProfile') {
    const now = Date.now();
    const evProf = getOwn(event, 'profile');
    const inProf = isPlainRecord(evProf) ? evProf : event;

    if (!existing) {
      const initMeta = createDefaultMetaSave();
      initMeta.lastSyncedEarnedStardust = initMeta.totalEarnedStardust;
      const nextProfile = applyExplicitProfileUpdate(
        null,
        inProf,
        openidSuffix,
        initMeta.selectedPatron,
        now
      );
      initMeta.playerProfile = {
        nickName: nextProfile.nickName,
        avatarUrl: nextProfile.avatarUrl,
        avatarPreset: nextProfile.avatarPreset,
        authorized: nextProfile.authorized,
        updatedAt: nextProfile.updatedAt
      };
      initMeta.updatedAt = now;

      await docRef.set({
        data: Object.assign(
          {
            openidSuffix,
            profile: nextProfile,
            totalStars: 0,
            totalCumulativeScore: 0,
            metaSave: initMeta,
            revision: 1,
            createdAt: now,
            updatedAt: now
          },
          extractModeRankFields(initMeta)
        )
      });

      return {
        ok: true,
        openidSuffix,
        profile: nextProfile,
        revision: 1
      };
    }

    const rawDocSuffix = getOwn(existing, 'openidSuffix');
    const docSuffix =
      typeof rawDocSuffix === 'string' && rawDocSuffix.trim()
        ? rawDocSuffix.trim()
        : openidSuffix;

    const serverMetaRaw = resolveServerMetaRaw(existing);
    const rawExistingMeta = getOwn(existing, 'metaSave');
    const existingMetaObj = isPlainRecord(rawExistingMeta) ? rawExistingMeta : null;
    const nextMeta = sanitizeMetaSave(existingMetaObj || existing, null, existing);
    nextMeta.lastSyncedEarnedStardust = nextMeta.totalEarnedStardust;

    const rawExistingProf = resolveRawStoredDocProfile(existing, serverMetaRaw, docSuffix);

    const nextProfile = applyExplicitProfileUpdate(
      rawExistingProf,
      inProf,
      docSuffix,
      nextMeta.selectedPatron,
      now
    );
    nextMeta.playerProfile = {
      nickName: nextProfile.nickName,
      avatarUrl: nextProfile.avatarUrl,
      avatarPreset: nextProfile.avatarPreset,
      authorized: nextProfile.authorized,
      updatedAt: nextProfile.updatedAt
    };
    nextMeta.updatedAt = now;

    const nextRev =
      Math.max(1, toFiniteInt(hasOwn(existing, 'revision') ? getOwn(existing, 'revision') : 1, 1)) +
      1;
    const totalStars = nextMeta.lifetimeStats.totalStars;
    const totalCumulativeScore = nextMeta.lifetimeStats.totalCumulativeScore;

    await docRef.update({
      data: Object.assign(
        {
          openidSuffix: docSuffix,
          profile: _.set(nextProfile),
          totalStars,
          totalCumulativeScore,
          metaSave: _.set(nextMeta),
          revision: nextRev,
          updatedAt: now
        },
        extractModeRankFields(nextMeta),
        buildLegacyRemovalPatch()
      )
    });

    return {
      ok: true,
      openidSuffix: docSuffix,
      profile: nextProfile,
      revision: nextRev
    };
  }

  if (action === 'leaderboard') {
    const evBoardType = getOwn(event, 'boardType');
    const evMode = getOwn(event, 'mode');
    const evDateKey = getOwn(event, 'dateKey');
    const rawBoard =
      typeof evBoardType === 'string' && evBoardType.trim()
        ? evBoardType.trim()
        : typeof evMode === 'string' && evMode.trim()
        ? evMode.trim()
        : 'stars';

    let boardType = 'stars';
    let dailyDateKey = '';
    if (rawBoard === 'score' || rawBoard === 'totalScore') {
      boardType = 'score';
    } else if (rawBoard === 'endless') {
      boardType = 'endless';
    } else if (rawBoard === 'daily' || /^daily_\d{8}$/.test(rawBoard)) {
      boardType = 'daily';
      const suffixDate = /^daily_(\d{8})$/.test(rawBoard) ? rawBoard.slice(6) : '';
      dailyDateKey = sanitizeDateKey(suffixDate) || sanitizeDateKey(evDateKey) || getUtc8DateKey(Date.now());
    }

    if (boardType === 'daily' || boardType === 'endless') {
      const modeFilter =
        boardType === 'daily'
          ? {
              dailyDateKey,
              dailyBestScore: _.gte(1).and(_.lte(MAX_DAILY_SCORE))
            }
          : {
              endlessBestShift: _.gte(1).and(_.lte(MAX_ENDLESS_SHIFT)),
              endlessBestScore: _.gte(1).and(_.lte(MAX_ENDLESS_SCORE))
            };
      let mQuery = db.collection(PLAYERS_COL).where(modeFilter);
      if (boardType === 'daily') {
        mQuery = mQuery.orderBy('dailyBestScore', 'desc').orderBy('_id', 'asc');
      } else {
        mQuery = mQuery
          .orderBy('endlessBestShift', 'desc')
          .orderBy('endlessBestScore', 'desc')
          .orderBy('_id', 'asc');
      }
      const mTopRes = await mQuery.limit(50).get();
      const mRawRows = mTopRes && safeIsArray(mTopRes.data) ? mTopRes.data : [];
      const mList = [];
      const mRowLen = safeArrayLength(mRawRows);
      for (let idx = 0; idx < mRowLen; idx++) {
        if (!hasOwn(mRawRows, idx)) continue;
        const row = safeArrayAt(mRawRows, idx);
        const safeRow = isPlainRecord(row) ? row : {};
        const rawRowId = getOwn(safeRow, '_id');
        const rowId =
          typeof rawRowId === 'string' || typeof rawRowId === 'number' ? String(rawRowId) : '';
        const isMe = rowId === openid;
        const rawRowSuffix = getOwn(safeRow, 'openidSuffix');
        const suffix =
          typeof rawRowSuffix === 'string' && rawRowSuffix.trim()
            ? rawRowSuffix.trim()
            : rowId.slice(-4).toUpperCase() || '0000';
        const rawRowMetaObj = getOwn(safeRow, 'metaSave');
        const rowMetaObj = isPlainRecord(rawRowMetaObj) ? rawRowMetaObj : null;
        const rowSelectedPatron = resolveDocSelectedPatron(safeRow, rowMetaObj);
        const resolvedProf = resolveStoredDocProfile(safeRow, rowMetaObj, suffix, rowSelectedPatron);
        const stars = hasOwn(safeRow, 'totalStars')
          ? clampInt(getOwn(safeRow, 'totalStars'), 0, MAX_TOTAL_STARS, 0)
          : 0;
        const cumScore = hasOwn(safeRow, 'totalCumulativeScore')
          ? clampInt(getOwn(safeRow, 'totalCumulativeScore'), 0, MAX_TOTAL_CUMULATIVE_SCORE, 0)
          : 0;
        const dScore = hasOwn(safeRow, 'dailyBestScore')
          ? clampInt(getOwn(safeRow, 'dailyBestScore'), 0, MAX_DAILY_SCORE, 0)
          : 0;
        const eShift = hasOwn(safeRow, 'endlessBestShift')
          ? clampInt(getOwn(safeRow, 'endlessBestShift'), 0, MAX_ENDLESS_SHIFT, 0)
          : 0;
        const eScore = hasOwn(safeRow, 'endlessBestScore')
          ? clampInt(getOwn(safeRow, 'endlessBestScore'), 0, MAX_ENDLESS_SCORE, 0)
          : 0;

        mList.push({
          rank: mList.length + 1,
          id: rowId,
          openidSuffix: suffix,
          isMe,
          isSelf: isMe,
          isNpc: Boolean(hasOwn(safeRow, 'isNpc') && getOwn(safeRow, 'isNpc')),
          nickName: resolvedProf.nickName,
          avatarUrl: resolvedProf.avatarUrl,
          avatarPreset: resolvedProf.avatarPreset,
          totalStars: stars,
          totalCumulativeScore: cumScore,
          totalScore: cumScore,
          dailyBestScore: dScore,
          endlessBestShift: eShift,
          endlessBestScore: eScore,
          score: boardType === 'daily' ? dScore : eScore
        });
      }

      let mTotalPlayers = mList.length;
      if (mList.length >= 50) {
        const mCntRes = await db.collection(PLAYERS_COL).where(modeFilter).count();
        if (mCntRes && typeof mCntRes.total === 'number' && mCntRes.total >= mList.length) {
          mTotalPlayers = mCntRes.total;
        }
      }

      const existingRankFields = existing
        ? {
            dailyDateKey: sanitizeDateKey(getOwn(existing, 'dailyDateKey')),
            dailyBestScore: clampInt(getOwn(existing, 'dailyBestScore'), 0, MAX_DAILY_SCORE, 0),
            endlessBestShift: clampInt(getOwn(existing, 'endlessBestShift'), 0, MAX_ENDLESS_SHIFT, 0),
            endlessBestScore: clampInt(getOwn(existing, 'endlessBestScore'), 0, MAX_ENDLESS_SCORE, 0)
          }
        : { dailyDateKey: '', dailyBestScore: 0, endlessBestShift: 0, endlessBestScore: 0 };

      let mMyRank = null;
      for (let i = 0; i < mList.length; i++) {
        if (mList[i].isMe) {
          mMyRank = mList[i].rank;
          break;
        }
      }

      const myDailyScore =
        existingRankFields.dailyDateKey === dailyDateKey ? existingRankFields.dailyBestScore : 0;
      const myEndlessShift = existingRankFields.endlessBestShift;
      const myEndlessScore = existingRankFields.endlessBestScore;

      if (mMyRank === null) {
        if (boardType === 'daily' && myDailyScore >= 1) {
          const higherCnt = await db
            .collection(PLAYERS_COL)
            .where({
              dailyDateKey,
              dailyBestScore: _.gt(myDailyScore).and(_.lte(MAX_DAILY_SCORE))
            })
            .count();
          mMyRank = ((higherCnt && typeof higherCnt.total === 'number' ? higherCnt.total : 0) || 0) + 1;
        } else if (boardType === 'endless' && myEndlessShift >= 1 && myEndlessScore >= 1) {
          const higherCnt = await db
            .collection(PLAYERS_COL)
            .where(
              _.or([
                {
                  endlessBestShift: _.gt(myEndlessShift).and(_.lte(MAX_ENDLESS_SHIFT)),
                  endlessBestScore: _.gte(1).and(_.lte(MAX_ENDLESS_SCORE))
                },
                {
                  endlessBestShift: myEndlessShift,
                  endlessBestScore: _.gt(myEndlessScore).and(_.lte(MAX_ENDLESS_SCORE))
                }
              ])
            )
            .count();
          mMyRank = ((higherCnt && typeof higherCnt.total === 'number' ? higherCnt.total : 0) || 0) + 1;
        }
      }

      return {
        ok: true,
        boardType,
        dateKey: boardType === 'daily' ? dailyDateKey : '',
        list: mList,
        myRank: mMyRank,
        totalPlayers: mTotalPlayers,
        myStars: existing ? clampInt(getOwn(existing, 'totalStars'), 0, MAX_TOTAL_STARS, 0) : 0,
        myScore: boardType === 'daily' ? myDailyScore : myEndlessScore,
        myShift: boardType === 'endless' ? myEndlessShift : 0
      };
    }

    const boardFilter =
      boardType === 'stars'
        ? {
            totalStars: _.gte(1).and(_.lte(MAX_TOTAL_STARS)),
            totalCumulativeScore: _.gte(0).and(_.lte(MAX_TOTAL_CUMULATIVE_SCORE))
          }
        : {
            totalCumulativeScore: _.gte(1).and(_.lte(MAX_TOTAL_CUMULATIVE_SCORE)),
            totalStars: _.gte(0).and(_.lte(MAX_TOTAL_STARS))
          };

    let query = db.collection(PLAYERS_COL).where(boardFilter);
    if (boardType === 'stars') {
      query = query
        .orderBy('totalStars', 'desc')
        .orderBy('totalCumulativeScore', 'desc')
        .orderBy('_id', 'asc');
    } else {
      query = query
        .orderBy('totalCumulativeScore', 'desc')
        .orderBy('totalStars', 'desc')
        .orderBy('_id', 'asc');
    }
    const topRes = await query.limit(50).get();
    const rawRows = topRes && safeIsArray(topRes.data) ? topRes.data : [];

    const list = [];
    const rowLen = safeArrayLength(rawRows);
    for (let idx = 0; idx < rowLen; idx++) {
      if (!hasOwn(rawRows, idx)) continue;
      const row = safeArrayAt(rawRows, idx);
      const safeRow = isPlainRecord(row) ? row : {};
      const rawRowId = getOwn(safeRow, '_id');
      const rowId =
        typeof rawRowId === 'string' || typeof rawRowId === 'number'
          ? String(rawRowId)
          : '';
      const isMe = rowId === openid;
      const stars = hasOwn(safeRow, 'totalStars')
        ? clampInt(getOwn(safeRow, 'totalStars'), 0, MAX_TOTAL_STARS, 0)
        : 0;
      const cumScore = hasOwn(safeRow, 'totalCumulativeScore')
        ? clampInt(getOwn(safeRow, 'totalCumulativeScore'), 0, MAX_TOTAL_CUMULATIVE_SCORE, 0)
        : 0;
      const rawRowSuffix = getOwn(safeRow, 'openidSuffix');
      const suffix =
        typeof rawRowSuffix === 'string' && rawRowSuffix.trim()
          ? rawRowSuffix.trim()
          : rowId.slice(-4).toUpperCase() || '0000';
      const rawRowMetaObj = getOwn(safeRow, 'metaSave');
      const rowMetaObj = isPlainRecord(rawRowMetaObj) ? rawRowMetaObj : null;
      const rowSelectedPatron = resolveDocSelectedPatron(safeRow, rowMetaObj);
      const resolvedProf = resolveStoredDocProfile(
        safeRow,
        rowMetaObj,
        suffix,
        rowSelectedPatron
      );
      const nickName = resolvedProf.nickName;
      const avatarUrl = resolvedProf.avatarUrl;
      const avatarPreset = resolvedProf.avatarPreset;

      list.push({
        rank: list.length + 1,
        id: rowId,
        openidSuffix: suffix,
        isMe,
        isSelf: isMe,
        isNpc: Boolean(hasOwn(safeRow, 'isNpc') && getOwn(safeRow, 'isNpc')),
        nickName,
        avatarUrl,
        avatarPreset,
        totalStars: stars,
        totalCumulativeScore: cumScore,
        totalScore: cumScore,
        score: boardType === 'stars' ? stars : cumScore
      });
    }

    let totalPlayers = list.length;
    if (list.length >= 50) {
      const totalCntRes = await db.collection(PLAYERS_COL).where(boardFilter).count();
      if (totalCntRes && typeof totalCntRes.total === 'number' && totalCntRes.total >= list.length) {
        totalPlayers = totalCntRes.total;
      }
    }

    let rawDocStars = 0;
    let rawDocScore = 0;
    let callerDisqualified = false;

    if (existing) {
      const candStars = hasOwn(existing, 'totalStars') ? getOwn(existing, 'totalStars') : undefined;
      const candScore = hasOwn(existing, 'totalCumulativeScore')
        ? getOwn(existing, 'totalCumulativeScore')
        : undefined;
      const validStars =
        typeof candStars === 'number' &&
        Number.isFinite(candStars) &&
        Number.isInteger(candStars) &&
        candStars >= 0 &&
        candStars <= MAX_TOTAL_STARS;
      const validScore =
        typeof candScore === 'number' &&
        Number.isFinite(candScore) &&
        Number.isInteger(candScore) &&
        candScore >= 0 &&
        candScore <= MAX_TOTAL_CUMULATIVE_SCORE;

      if (!validStars || !validScore) {
        callerDisqualified = true;
      } else {
        rawDocStars = candStars === 0 ? 0 : candStars;
        rawDocScore = candScore === 0 ? 0 : candScore;
      }
    }

    const myStars = existing && !callerDisqualified ? rawDocStars : 0;
    const myScore = existing && !callerDisqualified ? rawDocScore : 0;

    let myRank = null;
    let inTop = null;
    for (let i = 0; i < list.length; i++) {
      if (list[i].isMe) {
        inTop = list[i];
        break;
      }
    }

    if (callerDisqualified) {
      myRank = null;
    } else if (inTop) {
      myRank = inTop.rank;
    } else if (
      (boardType === 'stars' && myStars >= 1) ||
      (boardType === 'score' && myScore >= 1)
    ) {
      // Note: `myStars` and `myScore` are verified integers above, so `_.gt(myStars)`
      // never matches the caller's own doc and stays 100% consistent with `orderBy(..., 'desc')`
      // even if a corrupted fractional rival document exists in `players`.
      const higherOrBranches =
        boardType === 'stars'
          ? [
              {
                totalStars: _.gt(myStars).and(_.lte(MAX_TOTAL_STARS)),
                totalCumulativeScore: _.gte(0).and(_.lte(MAX_TOTAL_CUMULATIVE_SCORE))
              },
              {
                totalStars: myStars,
                totalCumulativeScore: _.gt(myScore).and(_.lte(MAX_TOTAL_CUMULATIVE_SCORE))
              },
              {
                totalStars: myStars,
                totalCumulativeScore: myScore,
                _id: _.lt(openid)
              }
            ]
          : [
              {
                totalCumulativeScore: _.gt(myScore).and(_.lte(MAX_TOTAL_CUMULATIVE_SCORE)),
                totalStars: _.gte(0).and(_.lte(MAX_TOTAL_STARS))
              },
              {
                totalCumulativeScore: myScore,
                totalStars: _.gt(myStars).and(_.lte(MAX_TOTAL_STARS))
              },
              {
                totalCumulativeScore: myScore,
                totalStars: myStars,
                _id: _.lt(openid)
              }
            ];

      const higherCnt = await db
        .collection(PLAYERS_COL)
        .where(_.or(higherOrBranches))
        .count();
      let higherTotal =
        higherCnt && typeof higherCnt.total === 'number' && higherCnt.total > 0
          ? higherCnt.total
          : 0;

      // Reconcile string `_id < openid` ties: check `dbTiedLt.count()` first so real
      // CloudBase skips `.get()` scanning when `countedTied > 0`; otherwise paginate
      // `.skip(offset).limit(100)` for numeric-only `_.lt` mocks (`createCloudSdkStore`).
      try {
        const dbTiedLt = await db
          .collection(PLAYERS_COL)
          .where({
            totalStars: myStars,
            totalCumulativeScore: myScore,
            _id: _.lt(openid)
          })
          .count();
        const countedTied =
          dbTiedLt && typeof dbTiedLt.total === 'number' && dbTiedLt.total > 0
            ? dbTiedLt.total
            : 0;

        if (countedTied === 0) {
          let jsTiedBefore = 0;
          let offset = 0;
          const maxScan = 5000;
          while (offset < maxScan) {
            const tiedSnap = await db
              .collection(PLAYERS_COL)
              .where({ totalStars: myStars, totalCumulativeScore: myScore })
              .orderBy('_id', 'asc')
              .skip(offset)
              .limit(100)
              .get();
            const batch = tiedSnap && safeIsArray(tiedSnap.data) ? tiedSnap.data : [];
            const batchLen = safeArrayLength(batch);
            if (batchLen === 0) break;

            let reachedSelfOrAfter = false;
            for (let ti = 0; ti < batchLen; ti++) {
              if (!hasOwn(batch, ti)) continue;
              const tr = safeArrayAt(batch, ti);
              const rawTid = isPlainRecord(tr) ? getOwn(tr, '_id') : undefined;
              const tid =
                typeof rawTid === 'string'
                  ? rawTid
                  : typeof rawTid === 'number'
                  ? String(rawTid)
                  : '';
              if (!tid) continue;
              if (tid < openid) {
                jsTiedBefore++;
              } else {
                reachedSelfOrAfter = true;
                break;
              }
            }

            if (reachedSelfOrAfter || batchLen < 100) {
              break;
            }
            offset += batchLen;
          }

          if (jsTiedBefore > 0) {
            higherTotal += jsTiedBefore;
          }
        }
      } catch (_tieErr) {}

      myRank = higherTotal + 1;
    }

    return {
      ok: true,
      boardType,
      list,
      myRank,
      totalPlayers,
      myStars,
      myScore
    };
  }

  const safeActionLabel =
    typeof rawActionVal === 'string' ? rawActionVal.slice(0, 32) : typeof rawActionVal;
  return {
    ok: false,
    reason: 'unknown_action:' + safeActionLabel
  };
};

exports._internal = Object.freeze({
  SCHEMA_VERSION,
  DEFAULT_INITIAL_STARDUST,
  VALID_LEVEL_IDS,
  CHAPTER_SCORE_CAPS,
  MAX_CAMPAIGN_STARS,
  MAX_TOTAL_STARS,
  MAX_TOTAL_CUMULATIVE_SCORE,
  MAX_DAILY_SCORE,
  MAX_ENDLESS_SHIFT,
  MAX_ENDLESS_SCORE,
  MAX_ENDLESS_SCORE_PER_SHIFT,
  MAX_OFFLINE_STARDUST_DELTA,
  MAX_INITIAL_UNSYNCED_STARDUST,
  MAX_CONSUMABLE_SPENT_STARDUST,
  MAX_SAFE_EARNED_STARDUST,
  CATCAKE_UPGRADE_COSTS,
  DEVICE_UPGRADE_COSTS,
  PATRON_COSTS,
  THEME_COSTS,
  SHOP_TOTAL_CAP,
  RESEARCH_COSTS,
  RESEARCH_TOTAL_CAP,
  V1_PATRON_COSTS,
  V1_THEME_COSTS,
  V1_UPGRADE_COSTS,
  hasOwn,
  getOwn,
  toFiniteInt,
  clampInt,
  normalizePatronId,
  computeSpentStardust,
  computeTotalStars,
  computeTotalCumulativeScore,
  computeHighestUnlockedLevel,
  createDefaultModeStats,
  sanitizeModeStats,
  mergeModeStats,
  sanitizeResearchUnlocks,
  sanitizeLevelGoalsDone,
  sanitizeSeenTips,
  sanitizeSettings,
  createDefaultMetaSave,
  migrateV1ToV2,
  sanitizeMetaSave,
  validateAndClampClientMeta,
  mergeMetaSaves,
  sanitizeProfile,
  mergeProfiles,
  applyExplicitProfileUpdate
});
