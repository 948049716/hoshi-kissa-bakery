/**
 * Save Data Migration, Monotonic Cloud Merge & Mid-Run Breakpoint Snapshot Engine
 * Shared by client `game_app.js` for offline-first WeChat CloudBase sync.
 */
'use strict';

const { PATRONS, JAR_THEMES, SHOP_UPGRADES, RELICS, DECK_MODS } = require('./constants');

const ACTIVE_RUN_STORAGE_KEY = 'hoshi_kissa_active_run_v1';

function clampInt(val, min, max) {
  const n = Math.floor(Number(val) || 0);
  return Math.max(min, Math.min(max, n));
}

function computeSpentStardust(save) {
  if (!save || typeof save !== 'object') return 0;
  let spent = 0;
  if (Array.isArray(save.unlockedPatrons)) {
    for (const id of save.unlockedPatrons) {
      const p = PATRONS.find((item) => item.id === id);
      if (p && p.cost > 0) spent += p.cost;
    }
  }
  if (Array.isArray(save.unlockedThemes)) {
    for (const id of save.unlockedThemes) {
      const th = JAR_THEMES[id];
      if (th && th.cost > 0) spent += th.cost;
    }
  }
  const ups = save.shopUpgrades && typeof save.shopUpgrades === 'object' ? save.shopUpgrades : {};
  for (const up of SHOP_UPGRADES) {
    const lv = clampInt(ups[up.id], 0, up.maxLv);
    for (let i = 0; i < lv; i++) {
      spent += up.costs[i] || 0;
    }
  }
  return spent;
}

function normalizeProfile(raw, fallbackPatron = 'mikan') {
  const src = raw && typeof raw === 'object' ? raw : {};
  const preset = ['mikan', 'luna', 'mugi'].includes(src.avatarPreset)
    ? src.avatarPreset
    : ['mikan', 'luna', 'mugi'].includes(fallbackPatron)
    ? fallbackPatron
    : 'mikan';
  return {
    nickName: typeof src.nickName === 'string' && src.nickName.trim() ? src.nickName.trim().slice(0, 16) : '',
    avatarUrl: typeof src.avatarUrl === 'string' ? src.avatarUrl.slice(0, 512) : '',
    avatarPreset: preset,
    authorized: !!src.authorized,
    updatedAt: clampInt(src.updatedAt || 0, 0, 9999999999999)
  };
}

function normalizeSaveData(parsed) {
  const defaults = {
    bestChef: 0,
    bestZen: 0,
    bestRush: 0,
    unlockedTiers: [1, 2, 3, 4],
    bgmTrack: 'waltz',
    sfxEnabled: true,
    bankStardust: 30,
    totalEarnedStardust: 30,
    selectedPatron: 'mikan',
    unlockedPatrons: ['mikan'],
    equippedTheme: 'amber',
    unlockedThemes: ['amber'],
    shopUpgrades: { up_tools: 0, up_fever: 0, up_combo: 0, up_dust: 0 },
    seenModeGuides: { chef: false, rush: false, zen: false },
    seenTips: { prep_shop: false, glaze_ring: false, frozen: false },
    playerProfile: normalizeProfile(null, 'mikan'),
    lifetimeStats: {
      runsPlayed: 0,
      ordersCompleted: 0,
      servesTotal: 0,
      bankShotsTotal: 0,
      maxAvalancheEver: 0,
      bestShiftReached: 0,
      shiftsClearedTotal: 0,
      fiveShiftClears: 0,
      soufflesMade: 0,
      yarnBroken: 0,
      maxComboEver: 1
    },
    updatedAt: 0
  };

  if (!parsed || typeof parsed !== 'object') return defaults;

  const bestChef = clampInt(parsed.bestChef, 0, 9999999);
  const bestZen = clampInt(parsed.bestZen, 0, 9999999);
  const bestRush = clampInt(parsed.bestRush, 0, 9999999);

  const unlockedPatrons = Array.isArray(parsed.unlockedPatrons)
    ? Array.from(new Set(['mikan', ...parsed.unlockedPatrons.filter((id) => PATRONS.some((p) => p.id === id))]))
    : ['mikan'];
  const selectedPatron = unlockedPatrons.includes(parsed.selectedPatron) ? parsed.selectedPatron : 'mikan';

  const unlockedThemes = Array.isArray(parsed.unlockedThemes)
    ? Array.from(new Set(['amber', ...parsed.unlockedThemes.filter((id) => !!JAR_THEMES[id])]))
    : ['amber'];
  const equippedTheme = unlockedThemes.includes(parsed.equippedTheme) ? parsed.equippedTheme : 'amber';

  const tierSet = new Set([1, 2, 3, 4]);
  if (Array.isArray(parsed.unlockedTiers)) {
    for (const v of parsed.unlockedTiers) {
      const t = clampInt(v, 0, 99);
      if (t >= 1 && t <= 9) tierSet.add(t);
    }
  }

  const upRaw = parsed.shopUpgrades && typeof parsed.shopUpgrades === 'object' ? parsed.shopUpgrades : {};
  const stRaw = parsed.lifetimeStats && typeof parsed.lifetimeStats === 'object' ? parsed.lifetimeStats : {};
  const sgRaw = parsed.seenModeGuides && typeof parsed.seenModeGuides === 'object' ? parsed.seenModeGuides : {};
  const tpRaw = parsed.seenTips && typeof parsed.seenTips === 'object' ? parsed.seenTips : {};

  let bankStardust;
  if (typeof parsed.bankStardust === 'number' && Number.isFinite(parsed.bankStardust)) {
    bankStardust = Math.max(0, Math.floor(parsed.bankStardust));
  } else if (bestChef > 0 || bestZen > 0) {
    bankStardust = Math.max(60, Math.min(260, 60 + Math.floor(Math.max(bestChef, bestZen) / 300)));
  } else {
    bankStardust = defaults.bankStardust;
  }

  const out = {
    bestChef,
    bestZen,
    bestRush,
    unlockedTiers: Array.from(tierSet).sort((a, b) => a - b),
    bgmTrack:
      parsed.bgmTrack === 'waltz' || parsed.bgmTrack === 'bossa' || parsed.bgmTrack === 'off'
        ? parsed.bgmTrack
        : 'waltz',
    sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : true,
    bankStardust,
    totalEarnedStardust: 30,
    selectedPatron,
    unlockedPatrons,
    equippedTheme,
    unlockedThemes,
    shopUpgrades: {
      up_tools: clampInt(upRaw.up_tools, 0, 3),
      up_fever: clampInt(upRaw.up_fever, 0, 3),
      up_combo: clampInt(upRaw.up_combo, 0, 3),
      up_dust: clampInt(upRaw.up_dust, 0, 3)
    },
    seenModeGuides: {
      chef: !!sgRaw.chef,
      rush: !!sgRaw.rush,
      zen: !!sgRaw.zen
    },
    seenTips: {
      prep_shop: !!tpRaw.prep_shop,
      glaze_ring: !!tpRaw.glaze_ring,
      frozen: !!tpRaw.frozen
    },
    playerProfile: normalizeProfile(parsed.playerProfile, selectedPatron),
    lifetimeStats: {
      runsPlayed: clampInt(stRaw.runsPlayed, 0, 999999),
      ordersCompleted: clampInt(stRaw.ordersCompleted, 0, 9999999),
      servesTotal: clampInt(stRaw.servesTotal, 0, 9999999),
      bankShotsTotal: clampInt(stRaw.bankShotsTotal, 0, 9999999),
      maxAvalancheEver: clampInt(stRaw.maxAvalancheEver, 0, 999),
      bestShiftReached: clampInt(stRaw.bestShiftReached, 0, 999),
      shiftsClearedTotal: clampInt(stRaw.shiftsClearedTotal, 0, 999999),
      fiveShiftClears: clampInt(stRaw.fiveShiftClears, 0, 999999),
      soufflesMade: clampInt(stRaw.soufflesMade, 0, 999999),
      yarnBroken: clampInt(stRaw.yarnBroken, 0, 999999),
      maxComboEver: clampInt(stRaw.maxComboEver || 1, 1, 999)
    },
    updatedAt: clampInt(parsed.updatedAt || 0, 0, 9999999999999)
  };

  const spent = computeSpentStardust(out);
  const rawEarned = clampInt(parsed.totalEarnedStardust, 0, 9999999);
  out.totalEarnedStardust = Math.max(30, rawEarned, out.bankStardust + spent);
  out.bankStardust = Math.max(0, out.totalEarnedStardust - spent);
  return out;
}

function mergeSaveData(localRaw, cloudRaw, cloudProfile = null) {
  const local = normalizeSaveData(localRaw);
  if (!cloudRaw && !cloudProfile) return local;
  const cloud = normalizeSaveData(cloudRaw || {});
  const preferLocal = (local.updatedAt || 0) >= (cloud.updatedAt || 0);
  const latest = preferLocal ? local : cloud;

  const unlockedPatrons = Array.from(new Set(['mikan', ...local.unlockedPatrons, ...cloud.unlockedPatrons]));
  const unlockedThemes = Array.from(new Set(['amber', ...local.unlockedThemes, ...cloud.unlockedThemes]));
  const unlockedTiers = Array.from(new Set([...local.unlockedTiers, ...cloud.unlockedTiers])).sort((a, b) => a - b);

  // Merge player profile: prefer authorized profile or newer updatedAt
  const cProf = cloudProfile ? normalizeProfile(cloudProfile, latest.selectedPatron) : cloud.playerProfile;
  const lProf = local.playerProfile;
  let mergedProf = lProf;
  if (cProf.authorized && !lProf.authorized) {
    mergedProf = cProf;
  } else if (!cProf.authorized && lProf.authorized) {
    mergedProf = lProf;
  } else if ((cProf.updatedAt || 0) > (lProf.updatedAt || 0) && cProf.nickName) {
    mergedProf = cProf;
  } else if (!lProf.nickName && cProf.nickName) {
    mergedProf = cProf;
  }

  const merged = {
    bestChef: Math.max(local.bestChef, cloud.bestChef),
    bestZen: Math.max(local.bestZen, cloud.bestZen),
    bestRush: Math.max(local.bestRush, cloud.bestRush),
    unlockedTiers,
    bgmTrack: latest.bgmTrack,
    sfxEnabled: latest.sfxEnabled,
    selectedPatron: unlockedPatrons.includes(latest.selectedPatron) ? latest.selectedPatron : 'mikan',
    unlockedPatrons,
    equippedTheme: unlockedThemes.includes(latest.equippedTheme) ? latest.equippedTheme : 'amber',
    unlockedThemes,
    shopUpgrades: {
      up_tools: Math.max(local.shopUpgrades.up_tools, cloud.shopUpgrades.up_tools),
      up_fever: Math.max(local.shopUpgrades.up_fever, cloud.shopUpgrades.up_fever),
      up_combo: Math.max(local.shopUpgrades.up_combo, cloud.shopUpgrades.up_combo),
      up_dust: Math.max(local.shopUpgrades.up_dust, cloud.shopUpgrades.up_dust)
    },
    seenModeGuides: {
      chef: !!(local.seenModeGuides.chef || cloud.seenModeGuides.chef),
      rush: !!(local.seenModeGuides.rush || cloud.seenModeGuides.rush),
      zen: !!(local.seenModeGuides.zen || cloud.seenModeGuides.zen)
    },
    seenTips: {
      prep_shop: !!(local.seenTips.prep_shop || cloud.seenTips.prep_shop),
      glaze_ring: !!(local.seenTips.glaze_ring || cloud.seenTips.glaze_ring),
      frozen: !!(local.seenTips.frozen || cloud.seenTips.frozen)
    },
    playerProfile: mergedProf,
    lifetimeStats: {
      runsPlayed: Math.max(local.lifetimeStats.runsPlayed, cloud.lifetimeStats.runsPlayed),
      ordersCompleted: Math.max(local.lifetimeStats.ordersCompleted, cloud.lifetimeStats.ordersCompleted),
      servesTotal: Math.max(local.lifetimeStats.servesTotal, cloud.lifetimeStats.servesTotal),
      bankShotsTotal: Math.max(local.lifetimeStats.bankShotsTotal, cloud.lifetimeStats.bankShotsTotal),
      maxAvalancheEver: Math.max(local.lifetimeStats.maxAvalancheEver, cloud.lifetimeStats.maxAvalancheEver),
      bestShiftReached: Math.max(local.lifetimeStats.bestShiftReached, cloud.lifetimeStats.bestShiftReached),
      shiftsClearedTotal: Math.max(local.lifetimeStats.shiftsClearedTotal, cloud.lifetimeStats.shiftsClearedTotal),
      fiveShiftClears: Math.max(local.lifetimeStats.fiveShiftClears, cloud.lifetimeStats.fiveShiftClears),
      soufflesMade: Math.max(local.lifetimeStats.soufflesMade, cloud.lifetimeStats.soufflesMade),
      yarnBroken: Math.max(local.lifetimeStats.yarnBroken, cloud.lifetimeStats.yarnBroken),
      maxComboEver: Math.max(local.lifetimeStats.maxComboEver, cloud.lifetimeStats.maxComboEver)
    },
    updatedAt: Math.max(local.updatedAt || 0, cloud.updatedAt || 0, Date.now())
  };

  const spent = computeSpentStardust(merged);
  merged.totalEarnedStardust = Math.max(local.totalEarnedStardust, cloud.totalEarnedStardust, spent);
  merged.bankStardust = Math.max(0, merged.totalEarnedStardust - spent);
  return merged;
}

function serializeActiveRun(gameState, activeModal) {
  if (!gameState || gameState.over) return null;
  const isPrepModal = activeModal === 'prep_shop' || activeModal === 'shift_victory';
  // Only snapshot runs where the player has actually progressed (>= 1 drop, or shift >= 2, or in prep_shop/victory)
  if (!isPrepModal && (gameState.dropsMadeThisRun || 0) < 1 && (gameState.shift || 1) <= 1) {
    return null;
  }
  if (gameState.mode === 'rush' && (gameState.rushTimer || 0) <= 3.0) {
    return null;
  }

  return {
    v: 1,
    savedAt: Date.now(),
    mode: gameState.mode,
    score: gameState.score || 0,
    stardust: gameState.stardust || 0,
    shift: gameState.shift || 1,
    shiftName: gameState.shiftName || '暮色试营业',
    shiftBadge: gameState.shiftBadge || '第1幕·试营',
    shiftModifier: gameState.shiftModifier || null,
    shiftHazards: [...(gameState.shiftHazards || [])],
    shiftsClearedThisRun: gameState.shiftsClearedThisRun || 0,
    shiftRevenue: gameState.shiftRevenue || 0,
    shiftTarget: gameState.shiftTarget || 1200,
    stepsLeft: gameState.stepsLeft || 0,
    stepsMax: gameState.stepsMax || 16,
    shiftStepsUsed: gameState.shiftStepsUsed || 0,
    shiftStepRefunds: gameState.shiftStepRefunds || 0,
    freeSkipsLeft: gameState.freeSkipsLeft !== undefined ? gameState.freeSkipsLeft : 1,
    mugiBankCoinHits: gameState.mugiBankCoinHits || 0,
    shiftClearedFlag: !!gameState.shiftClearedFlag,
    coins: gameState.coins || 0,
    relics: [...(gameState.relics || [])].filter((id) => RELICS.some((r) => r.id === id)),
    deckMods: { ...(gameState.deckMods || {}) },
    nextShiftBonusSteps: gameState.nextShiftBonusSteps || 0,
    antigravDropCounter: gameState.antigravDropCounter || 0,
    dropsMadeThisRun: gameState.dropsMadeThisRun || 0,
    soufflesMadeThisRun: gameState.soufflesMadeThisRun || 0,
    yarnBrokenThisRun: gameState.yarnBrokenThisRun || 0,
    iceShatteredThisRun: gameState.iceShatteredThisRun || 0,
    glazeHitsThisRun: gameState.glazeHitsThisRun || 0,
    servesCompleted: gameState.servesCompleted || 0,
    ordersCompleted: gameState.ordersCompleted || 0,
    bankShotsLanded: gameState.bankShotsLanded || 0,
    maxAvalancheRun: gameState.maxAvalancheRun || 0,
    maxCombo: gameState.maxCombo || 1,
    maxTierRun: gameState.maxTierRun || 4,
    seenThisRun: Array.from(gameState.seenThisRun || [1, 2, 3, 4]),
    skillEnergy: +(gameState.skillEnergy || 0).toFixed(2),
    nextShotMeteor: !!gameState.nextShotMeteor,
    feverEnergy: +(gameState.feverEnergy || 0).toFixed(2),
    tools: { ...(gameState.tools || { shake: 2, spoon: 1 }) },
    perks: { ...(gameState.perks || {}) },
    pendingBlessings: gameState.pendingBlessings || 0,
    dropsUntilRainbow: gameState.dropsUntilRainbow || 12,
    canHoldThisTurn: gameState.canHoldThisTurn !== false,
    curTier: gameState.curTier || 2,
    curMeta: { ...(gameState.curMeta || { wildcard: false, golden: false }) },
    nextTier: gameState.nextTier || 1,
    nextMeta: { ...(gameState.nextMeta || { wildcard: false, golden: false }) },
    holdTier: gameState.holdTier || null,
    holdMeta: gameState.holdMeta ? { ...gameState.holdMeta } : null,
    zenNextMilestone: gameState.zenNextMilestone || 600,
    rushTimer: +(gameState.rushTimer || 90).toFixed(2),
    rushNextMilestone: gameState.rushNextMilestone || 1200,
    activeEvent: gameState.activeEvent ? { ...gameState.activeEvent } : null,
    resumeModal: isPrepModal ? activeModal : null,
    prepShop: activeModal === 'prep_shop' && gameState.prepShop ? JSON.parse(JSON.stringify(gameState.prepShop)) : null,
    victoryOffer: activeModal === 'shift_victory' && gameState.victoryOffer ? JSON.parse(JSON.stringify(gameState.victoryOffer)) : null,
    orders: (gameState.orders || []).map((o) => ({
      uid: o.uid,
      kind: o.kind,
      slotOrigin: o.slotOrigin || o.kind,
      isJudgeRush: !!o.isJudgeRush,
      isStarterBlitz: !!o.isStarterBlitz,
      bonusSteps: o.bonusSteps || 0,
      label: o.label,
      patronId: o.patron ? o.patron.id : 'mikan',
      slots: (o.slots || []).map((s) => ({ tier: s.tier, done: !!s.done })),
      bonusScore: o.bonusScore || 100,
      rewardDust: o.rewardDust || 12,
      freshSteps: o.freshSteps || 0,
      freshMax: o.freshMax || 6,
      freshMult: o.freshMult || 1.35,
      staleMult: o.staleMult || 1.0,
      completed: !!o.completed
    })),
    entities: (gameState.entities || [])
      .filter((e) => e && !e.merged)
      .slice(0, 48)
      .map((e) => ({
        tier: e.tier || 1,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        angle: +(e.angle || 0).toFixed(3),
        isWildcard: !!e.isWildcard,
        isGolden: !!e.isGolden,
        isYarnBall: !!e.isYarnBall,
        yarnHp: e.isYarnBall ? e.yarnHp || 2 : 0,
        frozenHp: e.frozenHp || 0,
        agedStacks: e.agedStacks || 0
      }))
  };
}

function validateActiveRunSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return null;
  if (!['chef', 'rush', 'zen'].includes(snap.mode)) return null;
  if (!Array.isArray(snap.entities) || !Array.isArray(snap.orders)) return null;
  if (snap.deckMods && typeof snap.deckMods === 'object') {
    for (const k of Object.keys(snap.deckMods)) {
      if (!DECK_MODS.some((m) => m.id === k)) delete snap.deckMods[k];
    }
  }
  return snap;
}

module.exports = {
  ACTIVE_RUN_STORAGE_KEY,
  computeSpentStardust,
  normalizeProfile,
  normalizeSaveData,
  mergeSaveData,
  serializeActiveRun,
  validateActiveRunSnapshot
};
