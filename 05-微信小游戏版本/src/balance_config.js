/**
 * Balance single source of truth for v0.10+ gameplay systems.
 *
 * Every new tunable number lives here (not scattered in game_app / order_service), each new
 * system is guarded by a FEATURES flag (quick rollback / A-B), and remote config (M4) may only
 * override whitelisted numeric keys within hard [min, max] bounds via applyRemoteOverrides().
 *
 * Score model ("乘区制", see docs/02 & docs/07):
 *   score = round( Σ_i price_i × flavor_i × fresh_i                // 品质区 per item
 *                × (1 + clamp(B_skill, skillFloor, skillCap))     // 技巧区 additive
 *                × customerMult × traitMult                       // 顾客区 multiplicative
 *                × (1 + clamp(B_scene, 0, sceneCap)) )            // 场面区 additive
 */
'use strict';

const BALANCE_VERSION = '0.10.0-m1';

const FEATURES = {
  scoreZones: true,
  bakeCrit: true,
  freshBonus: true,
  doughTemp: true,
  feverV2: true,
  goals: false,
  events: false,
  traits: false,
  daily: false,
  endless: false
};

const SCORE_ZONES = {
  skillCap: 0.90,
  skillFloor: -0.40,
  sceneCap: 1.00,
  sceneCapEndlessMax: 1.60,
  feverSceneBonus: 0.25,
  mikanSceneBonus: 0.08,
  lunaSceneBonus: 0.50,
  devTraySceneBonus: 0.12,
  mugiComboSkillBonus: 0.10,
  traitMultCap: 1.60
};

const BAKE_CRIT = {
  minNewTier: 3,
  tiers: {
    2: { fever: 8, skill: 6, gild: 0, upgrade: 0 },
    3: { fever: 15, skill: 10, gild: 1, upgrade: 0 },
    4: { fever: 25, skill: 15, gild: 1, upgrade: 1 }
  }
};

const FRESH = {
  windowSec: 6.0,
  itemMult: 1.15,
  allHotFever: 6,
  minTier: 2
};

// Cooling: temp ← temp·e^(−decayRate·dt) − decayFlat·dt. With perKnead 22 the steady-state
// peak for a tap period T is 22 / (1 − e^(−0.8T)): T=0.12s overheats after ~6 taps (~0.6s),
// T=0.35s peaks ≈ 90 (warm), T=0.5s oscillates 45..67 (warm), T≥1s mostly cold.
const DOUGH_TEMP = {
  perKnead: 22,
  decayRate: 0.8,
  decayFlat: 2,
  warmMin: 40,
  overheat: 100,
  lockSec: 1.2,
  lockSecPity: 0.6,
  resetTo: 50,
  warmC2Bonus: 0.15,
  pityEvery: 6,
  pityTier: 3
};

const FEVER_V2 = {
  durationSec: 10.0,
  sceneBonus: 0.20,
  patienceDecayMult: 0.5,
  kneadTierTable: [[2, 0.7], [3, 0.3]],
  chainMerge: true,
  chainMaxPasses: 3,
  extendPerServe: 1.0,
  extendCap: 4.0,
  afterglowC1toC2: true
};

const TELEMETRY = {
  enabled: true,
  // We分析 custom event names (must be registered in WeChat MP console before they show up)
  eventNames: {
    levelStart: 'level_start',
    levelEnd: 'level_end',
    tutorialStep: 'tutorial_step',
    shopBuy: 'shop_buy',
    modeStart: 'mode_start'
  }
};

/**
 * Whitelist for remote overrides: dotted path -> [min, max]. Anything not listed is ignored.
 */
const REMOTE_OVERRIDE_BOUNDS = {
  'SCORE_ZONES.skillCap': [0.3, 1.5],
  'SCORE_ZONES.sceneCap': [0.3, 2.0],
  'SCORE_ZONES.feverSceneBonus': [0, 0.6],
  'BAKE_CRIT.minNewTier': [2, 5],
  'FRESH.windowSec': [2, 12],
  'FRESH.itemMult': [1, 1.5],
  'FRESH.allHotFever': [0, 20],
  'DOUGH_TEMP.perKnead': [5, 50],
  'DOUGH_TEMP.decayRate': [0.2, 3],
  'DOUGH_TEMP.lockSec': [0, 3],
  'DOUGH_TEMP.warmC2Bonus': [0, 0.4],
  'DOUGH_TEMP.pityEvery': [3, 15],
  'FEVER_V2.durationSec': [5, 20],
  'FEVER_V2.sceneBonus': [0, 0.6],
  'FEVER_V2.extendPerServe': [0, 3],
  'FEVER_V2.extendCap': [0, 10]
};

const TABLES = { SCORE_ZONES, BAKE_CRIT, FRESH, DOUGH_TEMP, FEVER_V2 };

const appliedOverrides = {};

/**
 * Applies a flat { 'TABLE.key': number, features: { flag: bool } } object within bounds.
 * Returns the list of keys actually applied.
 */
function applyRemoteOverrides(raw) {
  const applied = [];
  if (!raw || typeof raw !== 'object') return applied;
  const keys = Object.keys(raw);
  for (let i = 0; i < keys.length; i++) {
    const path = keys[i];
    if (path === 'features') continue;
    const bounds = REMOTE_OVERRIDE_BOUNDS[path];
    if (!bounds) continue;
    const v = Number(raw[path]);
    if (!Number.isFinite(v)) continue;
    const [tableName, field] = path.split('.');
    const table = TABLES[tableName];
    if (!table || !Object.prototype.hasOwnProperty.call(table, field)) continue;
    table[field] = Math.min(bounds[1], Math.max(bounds[0], v));
    appliedOverrides[path] = table[field];
    applied.push(path);
  }
  const feats = raw.features;
  if (feats && typeof feats === 'object') {
    const fk = Object.keys(feats);
    for (let i = 0; i < fk.length; i++) {
      if (Object.prototype.hasOwnProperty.call(FEATURES, fk[i]) && typeof feats[fk[i]] === 'boolean') {
        FEATURES[fk[i]] = feats[fk[i]];
        applied.push(`features.${fk[i]}`);
      }
    }
  }
  return applied;
}

function isFeatureOn(name) {
  return FEATURES[name] === true;
}

/** Test/sim helper: temporarily set feature flags, returns a restore fn. */
function withFeatures(overrides) {
  const prev = {};
  const keys = Object.keys(overrides || {});
  for (let i = 0; i < keys.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(FEATURES, keys[i])) continue;
    prev[keys[i]] = FEATURES[keys[i]];
    FEATURES[keys[i]] = Boolean(overrides[keys[i]]);
  }
  return function restore() {
    const pk = Object.keys(prev);
    for (let i = 0; i < pk.length; i++) FEATURES[pk[i]] = prev[pk[i]];
  };
}

module.exports = {
  BALANCE_VERSION,
  FEATURES,
  SCORE_ZONES,
  BAKE_CRIT,
  FRESH,
  DOUGH_TEMP,
  FEVER_V2,
  TELEMETRY,
  REMOTE_OVERRIDE_BOUNDS,
  applyRemoteOverrides,
  appliedOverrides,
  isFeatureOn,
  withFeatures
};
