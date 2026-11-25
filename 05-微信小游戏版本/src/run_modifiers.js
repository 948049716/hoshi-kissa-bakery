/**
 * Run Modifiers, Perk Aggregator, Daily Special & Endless Mode Helpers (v0.12 M3, direction D).
 *
 * Pure logic with zero DOM/Canvas/WeChat dependencies.
 */
'use strict';

const PerksData = require('./perks_data');
const Rng = require('./rng');

const RARITY_WEIGHTS = Object.freeze({
  common: 60,
  rare: 30,
  legendary: 10
});

// 12 varied Daily Special board layouts (4x4 / 5x4 / 5x5, all verified >= 10 playable & 1 connected component)
const DAILY_LAYOUTS = Object.freeze([
  Object.freeze({
    id: 'daily_01',
    name: '星夜双抹炉',
    matrix: ['.M..', '..G.', '.G..', '..M.'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 2, tier: 3, flavor: 'gold', frozen: false },
      { r: 3, c: 2, tier: 2, flavor: 'matcha', frozen: false }
    ],
    allowedRecipes: ['R04', 'R05', 'R07', 'R09', 'R11', 'R15', 'R16', 'R17']
  }),
  Object.freeze({
    id: 'daily_02',
    name: '星炉双翼台',
    matrix: ['#..#', '.O.O', '....', '#..#'],
    presets: [
      { r: 1, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 3, tier: 2, flavor: 'plain', frozen: false },
      { r: 2, c: 1, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R04', 'R05', 'R07', 'R09', 'R10', 'R11', 'R12', 'R14']
  }),
  Object.freeze({
    id: 'daily_03',
    name: '蜜糖回廊盘',
    matrix: ['....', '.S.S', '..G.', '....'],
    presets: [
      { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 2, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 3, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R07', 'R09', 'R11', 'R12', 'R14', 'R17']
  }),
  Object.freeze({
    id: 'daily_04',
    name: '草莓甜心炉',
    matrix: ['...#', '.B.O', '..B.', '#...'],
    presets: [
      { r: 1, c: 1, tier: 3, flavor: 'berry', frozen: false },
      { r: 2, c: 2, tier: 2, flavor: 'berry', frozen: false },
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R04', 'R05', 'R07', 'R11', 'R25', 'R20', 'R17']
  }),
  Object.freeze({
    id: 'daily_05',
    name: '双味金箔盘',
    matrix: ['.....', '.MGB.', '..O..', '.....'],
    presets: [
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 2, tier: 4, flavor: 'gold', frozen: false },
      { r: 1, c: 3, tier: 3, flavor: 'berry', frozen: false }
    ],
    allowedRecipes: ['R07', 'R09', 'R15', 'R16', 'R25', 'R20', 'R17', 'R18']
  }),
  Object.freeze({
    id: 'daily_06',
    name: '破冰星夜席',
    matrix: ['....', '.IX.', '.MI.', '.G..'],
    presets: [
      { r: 1, c: 1, tier: 4, flavor: 'plain', frozen: true },
      { r: 2, c: 2, tier: 4, flavor: 'plain', frozen: true },
      { r: 2, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 1, tier: 3, flavor: 'gold', frozen: false }
    ],
    allowedRecipes: ['R05', 'R07', 'R11', 'R15', 'R16', 'R17']
  }),
  Object.freeze({
    id: 'daily_07',
    name: '樱花双岛桥',
    matrix: ['..#..', '.MOG.', '..#..', '.....'],
    presets: [
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 3, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R07', 'R09', 'R11', 'R15', 'R16', 'R17', 'R18']
  }),
  Object.freeze({
    id: 'daily_08',
    name: '独柱蜜糖台',
    matrix: ['....', '.XS.', '.BM.', '....'],
    presets: [
      { r: 2, c: 1, tier: 3, flavor: 'berry', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'matcha', frozen: false },
      { r: 0, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R07', 'R11', 'R15', 'R25', 'R20', 'R17']
  }),
  Object.freeze({
    id: 'daily_09',
    name: '八角星光炉',
    matrix: ['#...#', '.O.O.', '..G..', '.M.B.', '#...#'],
    presets: [
      { r: 2, c: 2, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 3, tier: 3, flavor: 'berry', frozen: false }
    ],
    allowedRecipes: ['R09', 'R11', 'R15', 'R16', 'R25', 'R20', 'R17', 'R19']
  }),
  Object.freeze({
    id: 'daily_10',
    name: '四方快闪盘',
    matrix: ['....', '.G..', '..O.', '....'],
    presets: [
      { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R04', 'R05', 'R07', 'R09', 'R11', 'R12', 'R14', 'R17']
  }),
  Object.freeze({
    id: 'daily_11',
    name: '月光破冰坊',
    matrix: ['.....', '.B.I.', '.S.M.', '.I.G.', '.....'],
    presets: [
      { r: 1, c: 1, tier: 3, flavor: 'berry', frozen: false },
      { r: 1, c: 3, tier: 4, flavor: 'plain', frozen: true },
      { r: 2, c: 3, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 1, tier: 4, flavor: 'plain', frozen: true },
      { r: 3, c: 3, tier: 4, flavor: 'gold', frozen: false }
    ],
    allowedRecipes: ['R09', 'R11', 'R15', 'R16', 'R25', 'R20', 'R17', 'R23']
  }),
  Object.freeze({
    id: 'daily_12',
    name: '星夜大师席',
    matrix: ['#...#', '.G.M.', '.OXS.', '.B.G.', '#...#'],
    presets: [
      { r: 1, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 1, c: 3, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 1, tier: 3, flavor: 'berry', frozen: false },
      { r: 3, c: 3, tier: 4, flavor: 'gold', frozen: false }
    ],
    allowedRecipes: ['R11', 'R15', 'R16', 'R25', 'R17', 'R18', 'R19', 'R20', 'R23']
  })
]);

const ENDLESS_LAYOUTS = Object.freeze([
  DAILY_LAYOUTS[9],  // shift 1: clean 4x4 with G + O
  DAILY_LAYOUTS[0],  // shift 2: matcha + gold
  DAILY_LAYOUTS[4],  // shift 3: VIP dual flavor + O
  DAILY_LAYOUTS[2],  // shift 4: syrup + gold
  DAILY_LAYOUTS[8],  // shift 5: 5x5 octagon
  DAILY_LAYOUTS[10]  // shift 6+: 5x5 ice + dual flavor + syrup
]);

function compileRunModifiers(perkIds) {
  const ids = Array.isArray(perkIds) ? perkIds : [];
  const mods = {
    perkIds: [],
    perks: [],
    doughWarmMinDelta: 0,
    trayCapDelta: 0,
    urgentBountyDelta: 0,
    trashCooldownMult: 1.0,
    patienceMult: 1.0,
    c2RateDelta: 0,
    comboWindowDelta: 0,
    grantFork: 0,
    grantSpoon: 0,
    onMergeDyes: [],
    fullTraySkillGain: 0,
    freshWindowDelta: 0,
    critExtraFever: 0,
    critExtraSkill: 0,
    feverSceneDelta: 0,
    eternalFeverExtend: 0,
    startSpawnTiers: [],
    onMergeGoldMinTier: 0,
    flatSceneBonus: 0,
    sceneCapOverride: 0
  };

  for (let i = 0; i < ids.length; i++) {
    const perk = PerksData.getPerkById(ids[i]);
    if (!perk) continue;
    mods.perkIds.push(perk.id);
    mods.perks.push(perk);
    const h = perk.hooks || {};
    if (Number.isFinite(h.doughWarmMinDelta)) mods.doughWarmMinDelta += h.doughWarmMinDelta;
    if (Number.isFinite(h.trayCapDelta)) mods.trayCapDelta += h.trayCapDelta;
    if (Number.isFinite(h.urgentBountyDelta)) mods.urgentBountyDelta += h.urgentBountyDelta;
    if (Number.isFinite(h.trashCooldownMult) && h.trashCooldownMult > 0) {
      mods.trashCooldownMult *= h.trashCooldownMult;
    }
    if (Number.isFinite(h.patienceMultDelta)) mods.patienceMult += h.patienceMultDelta;
    if (Number.isFinite(h.c2RateDelta)) mods.c2RateDelta += h.c2RateDelta;
    if (Number.isFinite(h.comboWindowDelta)) mods.comboWindowDelta += h.comboWindowDelta;
    if (Number.isFinite(h.grantFork)) mods.grantFork += h.grantFork;
    if (Number.isFinite(h.grantSpoon)) mods.grantSpoon += h.grantSpoon;
    if (h.onMergeDye && Number.isFinite(h.onMergeDye.tier) && h.onMergeDye.flavor) {
      mods.onMergeDyes.push(h.onMergeDye);
    }
    if (Number.isFinite(h.fullTraySkillGain)) mods.fullTraySkillGain += h.fullTraySkillGain;
    if (Number.isFinite(h.freshWindowDelta)) mods.freshWindowDelta += h.freshWindowDelta;
    if (Number.isFinite(h.critExtraFever)) mods.critExtraFever += h.critExtraFever;
    if (Number.isFinite(h.critExtraSkill)) mods.critExtraSkill += h.critExtraSkill;
    if (Number.isFinite(h.feverSceneDelta)) mods.feverSceneDelta += h.feverSceneDelta;
    if (Number.isFinite(h.eternalFeverExtend) && h.eternalFeverExtend > 0) {
      mods.eternalFeverExtend = Math.max(mods.eternalFeverExtend, h.eternalFeverExtend);
    }
    if (Number.isFinite(h.startSpawnTier) && h.startSpawnTier >= 1) {
      mods.startSpawnTiers.push(Math.floor(h.startSpawnTier));
    }
    if (Number.isFinite(h.onMergeGoldMinTier) && h.onMergeGoldMinTier >= 2) {
      mods.onMergeGoldMinTier =
        mods.onMergeGoldMinTier > 0
          ? Math.min(mods.onMergeGoldMinTier, Math.floor(h.onMergeGoldMinTier))
          : Math.floor(h.onMergeGoldMinTier);
    }
    if (Number.isFinite(h.flatSceneBonus)) mods.flatSceneBonus += h.flatSceneBonus;
    if (Number.isFinite(h.sceneCapOverride)) {
      mods.sceneCapOverride = Math.max(mods.sceneCapOverride, h.sceneCapOverride);
    }
  }

  return mods;
}

/**
 * Applies perk-triggered merge mutations (matcha_dyehouse / berry_jam_pot / golden_touch)
 * in-place on freshly merged tiles referenced by mergeEvents.
 */
function applyMergePerkEffects(gridState, mergeEvents, mods) {
  if (!gridState || !Array.isArray(gridState.cells) || !Array.isArray(mergeEvents) || !mods) {
    return 0;
  }
  const hasDyes = Array.isArray(mods.onMergeDyes) && mods.onMergeDyes.length > 0;
  const goldMin = Number(mods.onMergeGoldMinTier) || 0;
  if (!hasDyes && goldMin <= 0) return 0;

  let mutated = 0;
  for (let i = 0; i < mergeEvents.length; i++) {
    const ev = mergeEvents[i];
    if (!ev) continue;
    const r = Number.isInteger(ev.r) ? ev.r : ev.toR;
    const c = Number.isInteger(ev.c) ? ev.c : ev.toC;
    const row = gridState.cells[r];
    const cell = row && row[c];
    const tile = cell && cell.tile;
    if (!tile || (tile.frozenHp || 0) > 0) continue;

    if (goldMin > 0 && tile.tier >= goldMin) {
      if (tile.flavor !== 'gold') {
        tile.flavor = 'gold';
        mutated += 1;
      }
      continue;
    }
    if (hasDyes && tile.flavor !== 'gold') {
      for (let j = 0; j < mods.onMergeDyes.length; j++) {
        const rule = mods.onMergeDyes[j];
        if (tile.tier === rule.tier) {
          tile.flavor = rule.flavor;
          mutated += 1;
          break;
        }
      }
    }
  }
  return mutated;
}

function pickPerkChoices(ownedPerkIds, researchUnlocks, rngFn, count) {
  const rng = typeof rngFn === 'function' ? rngFn : Math.random;
  const want = Math.max(1, Math.min(3, Math.floor(Number(count) || 3)));
  const owned = new Set(Array.isArray(ownedPerkIds) ? ownedPerkIds : []);
  const pool = PerksData.getUnlockedPerkPool(researchUnlocks).filter((p) => !owned.has(p.id));
  const candidates = pool.slice();
  const picked = [];

  while (picked.length < want && candidates.length > 0) {
    let totalW = 0;
    for (let i = 0; i < candidates.length; i++) {
      totalW += RARITY_WEIGHTS[candidates[i].rarity] || 20;
    }
    let roll = rng() * totalW;
    let chosenIdx = candidates.length - 1;
    for (let i = 0; i < candidates.length; i++) {
      roll -= RARITY_WEIGHTS[candidates[i].rarity] || 20;
      if (roll <= 0) {
        chosenIdx = i;
        break;
      }
    }
    picked.push(candidates[chosenIdx]);
    candidates.splice(chosenIdx, 1);
  }
  return picked;
}

/**
 * Computes deterministic YYYYMMDD string in UTC+8 (Asia/Shanghai) so all devices share
 * the exact same Daily Special board and seed regardless of local timezone.
 */
function getDailyDateKeyUTC8(nowMs) {
  const ms = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const shifted = new Date(ms + 8 * 3600 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildDailyChallengeConfig(dateKey) {
  const rawKey = typeof dateKey === 'string' && dateKey.trim()
    ? dateKey.replace(/-/g, '')
    : getDailyDateKeyUTC8();
  const key = /^\d{8}$/.test(rawKey) ? rawKey : getDailyDateKeyUTC8();
  const isoKey = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
  const seed = Rng.dailySeed(isoKey);
  const rng = Rng.createRng(seed);
  const layoutIdx = Math.floor(rng() * DAILY_LAYOUTS.length) % DAILY_LAYOUTS.length;
  const layout = DAILY_LAYOUTS[layoutIdx];
  // Draw 2 daily rules from default-unlocked perks (deterministic across all players)
  const dailyPerks = pickPerkChoices([], {}, rng, 2);
  const perkIds = dailyPerks.map((p) => p.id);

  return {
    mode: 'daily',
    dateKey: key,
    seed,
    id: `daily_${key}`,
    chapter: 2,
    indexInChapter: 5,
    name: `每天特调 · ${layout.name}`,
    durationSec: 110,
    stars: [5500, 9200, 13000],
    matrix: layout.matrix.slice(),
    presets: layout.presets.map((p) => Object.assign({}, p)),
    allowedRecipes: layout.allowedRecipes.slice(),
    urgentRate: 0.25,
    vipQuota: 2,
    vipQuotaRange: [2, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'score', target: 0, earlyClose: false },
    perkIds,
    perks: dailyPerks,
    desc: `特调加持：${dailyPerks.map((p) => p.name).join(' + ')}`
  };
}

function computeEndlessShiftTarget(shiftNum) {
  const n = Math.max(1, Math.floor(Number(shiftNum) || 1));
  return Math.round(1800 * Math.pow(1.32, n - 1));
}

function buildEndlessShiftConfig(shiftNum, seedBase) {
  const n = Math.max(1, Math.floor(Number(shiftNum) || 1));
  const target = computeEndlessShiftTarget(n);
  const isVipShift = n % 3 === 0;
  const layoutIdx = Math.min(ENDLESS_LAYOUTS.length - 1, Math.floor((n - 1) % ENDLESS_LAYOUTS.length));
  const layout = ENDLESS_LAYOUTS[layoutIdx];
  const seed = Rng.hash32(`endless:${seedBase || 1}:shift:${n}`);

  return {
    mode: 'endless',
    shiftNum: n,
    seed,
    id: `endless_${n}`,
    chapter: n <= 2 ? 1 : n <= 5 ? 2 : 3,
    indexInChapter: Math.min(10, n),
    name: isVipShift ? `无限第 ${n} 班 · VIP专场` : `无限第 ${n} 班 · ${layout.name}`,
    durationSec: 60,
    stars: [target, Math.round(target * 1.45), Math.round(target * 1.95)],
    targetScore: target,
    isVipShift,
    matrix: layout.matrix.slice(),
    presets: layout.presets.map((p) => Object.assign({}, p)),
    allowedRecipes: layout.allowedRecipes.slice(),
    urgentRate: Math.min(0.35, 0.16 + n * 0.03),
    vipQuota: isVipShift ? 2 : n >= 4 ? 1 : 0,
    vipQuotaRange: isVipShift ? [2, 2] : [0, 1],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'score', target: 0, earlyClose: false },
    desc: `第 ${n} 班营业目标 ${target} 分`
  };
}

module.exports = {
  RARITY_WEIGHTS,
  DAILY_LAYOUTS,
  ENDLESS_LAYOUTS,
  compileRunModifiers,
  applyMergePerkEffects,
  pickPerkChoices,
  getDailyDateKeyUTC8,
  buildDailyChallengeConfig,
  computeEndlessShiftTarget,
  buildEndlessShiftConfig
};
