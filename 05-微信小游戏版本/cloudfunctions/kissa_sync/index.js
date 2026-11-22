/**
 * 星夜吃茶 (Hoshi Kissa) 微信云开发聚合云函数 `kissa_sync` (v4.1 安全校验与乐观锁版)
 *
 * 支持路由 (`event.action`):
 * - `pull`          : 静默获取 OPENID 并拉取玩家云存档（首次访问自动建表与建档）
 * - `push`          : 服务端合理性校验、乐观锁 `revision` 冲突检测、双端星尘增量合并与分模式断点同步
 * - `updateProfile` : 保存用户授权或自定义的店长昵称与头像（防旧端覆盖）
 * - `leaderboard`   : 查询全服主厨闯关榜 / 90秒狂欢榜 / 悠闲榜 Top 50 及当前玩家排名
 */
'use strict';

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;
const PLAYERS_COL = 'players';

const PATRON_COSTS = { mikan: 0, luna: 60, mugi: 100 };
const THEME_COSTS = { amber: 0, sakura: 80, moonlight: 120 };
const UPGRADE_COSTS = {
  up_tools: [40, 90, 160],
  up_fever: [50, 100, 180],
  up_combo: [60, 120, 200],
  up_dust: [45, 95, 170]
};

const MAX_CHEF_SCORE = 350000;
const MAX_RUSH_SCORE = 85000;
const MAX_ZEN_SCORE = 180000;
const MAX_PUSH_CHEF_DELTA = 120000;
const MAX_PUSH_RUSH_DELTA = 65000;
const MAX_PUSH_ZEN_DELTA = 100000;
const MAX_OFFLINE_STARDUST_DELTA = 1500;

let collectionChecked = false;
async function ensurePlayersCollection() {
  if (collectionChecked) return;
  try {
    await db.createCollection(PLAYERS_COL);
  } catch (_err) {
    // Collection already exists or auto-managed
  }
  collectionChecked = true;
}

function clampInt(val, min, max) {
  const n = Math.floor(Number(val) || 0);
  return Math.max(min, Math.min(max, n));
}

function uniqStrings(arr, fallback) {
  if (!Array.isArray(arr)) return [...fallback];
  const out = [...fallback];
  for (const item of arr) {
    if (typeof item === 'string' && item.length > 0 && item.length <= 32 && !out.includes(item)) {
      out.push(item);
    }
  }
  return out;
}

function uniqTierNums(arr) {
  const set = new Set([1, 2, 3, 4]);
  if (Array.isArray(arr)) {
    for (const v of arr) {
      const t = Math.floor(Number(v) || 0);
      if (t >= 1 && t <= 9) set.add(t);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

function computeSpentStardust(meta) {
  if (!meta || typeof meta !== 'object') return 0;
  let spent = 0;
  for (const pid of meta.unlockedPatrons || []) {
    if (PATRON_COSTS[pid]) spent += PATRON_COSTS[pid];
  }
  for (const tid of meta.unlockedThemes || []) {
    if (typeof THEME_COSTS[tid] === 'number') spent += THEME_COSTS[tid];
  }
  const ups = meta.shopUpgrades || {};
  for (const key of Object.keys(UPGRADE_COSTS)) {
    const lv = clampInt(ups[key], 0, 3);
    const costs = UPGRADE_COSTS[key];
    for (let i = 0; i < lv; i++) spent += costs[i];
  }
  return spent;
}

function sanitizeMetaSave(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const unlockedPatrons = uniqStrings(src.unlockedPatrons, ['mikan']).filter((id) => PATRON_COSTS[id] !== undefined);
  const unlockedThemes = uniqStrings(src.unlockedThemes, ['amber']).filter((id) => THEME_COSTS[id] !== undefined);
  const ups = src.shopUpgrades && typeof src.shopUpgrades === 'object' ? src.shopUpgrades : {};
  const st = src.lifetimeStats && typeof src.lifetimeStats === 'object' ? src.lifetimeStats : {};
  const sg = src.seenModeGuides && typeof src.seenModeGuides === 'object' ? src.seenModeGuides : {};
  const tp = src.seenTips && typeof src.seenTips === 'object' ? src.seenTips : {};

  const bestShift = clampInt(st.bestShiftReached, 0, 99);
  // Cross-check Chef best score against highest shift ever reached
  const shiftChefCap =
    bestShift <= 1 ? 14000 : bestShift <= 3 ? 45000 : bestShift <= 5 ? 95000 : MAX_CHEF_SCORE;

  const out = {
    bestChef: clampInt(src.bestChef, 0, shiftChefCap),
    bestRush: clampInt(src.bestRush, 0, MAX_RUSH_SCORE),
    bestZen: clampInt(src.bestZen, 0, MAX_ZEN_SCORE),
    unlockedTiers: uniqTierNums(src.unlockedTiers),
    bgmTrack: src.bgmTrack === 'bossa' || src.bgmTrack === 'off' ? src.bgmTrack : 'waltz',
    sfxEnabled: typeof src.sfxEnabled === 'boolean' ? src.sfxEnabled : true,
    selectedPatron: unlockedPatrons.includes(src.selectedPatron) ? src.selectedPatron : 'mikan',
    unlockedPatrons,
    equippedTheme: unlockedThemes.includes(src.equippedTheme) ? src.equippedTheme : 'amber',
    unlockedThemes,
    shopUpgrades: {
      up_tools: clampInt(ups.up_tools, 0, 3),
      up_fever: clampInt(ups.up_fever, 0, 3),
      up_combo: clampInt(ups.up_combo, 0, 3),
      up_dust: clampInt(ups.up_dust, 0, 3)
    },
    seenModeGuides: {
      chef: !!sg.chef,
      rush: !!sg.rush,
      zen: !!sg.zen
    },
    seenTips: {
      prep_shop: !!tp.prep_shop,
      glaze_ring: !!tp.glaze_ring,
      frozen: !!tp.frozen
    },
    lifetimeStats: {
      runsPlayed: clampInt(st.runsPlayed, 0, 999999),
      ordersCompleted: clampInt(st.ordersCompleted, 0, 9999999),
      servesTotal: clampInt(st.servesTotal, 0, 9999999),
      bankShotsTotal: clampInt(st.bankShotsTotal, 0, 9999999),
      maxAvalancheEver: clampInt(st.maxAvalancheEver, 0, 99),
      bestShiftReached: bestShift,
      shiftsClearedTotal: clampInt(st.shiftsClearedTotal, 0, 999999),
      fiveShiftClears: clampInt(st.fiveShiftClears, 0, 999999),
      soufflesMade: clampInt(st.soufflesMade, 0, 999999),
      yarnBroken: clampInt(st.yarnBroken, 0, 999999),
      maxComboEver: clampInt(st.maxComboEver || 1, 1, 99)
    },
    lastSyncedEarnedStardust: clampInt(src.lastSyncedEarnedStardust || 0, 0, 999999),
    updatedAt: clampInt(src.updatedAt || Date.now(), 0, 9999999999999)
  };

  const spent = computeSpentStardust(out);
  const rawBank = clampInt(src.bankStardust !== undefined ? src.bankStardust : 30, 0, 999999);
  const rawEarned = clampInt(src.totalEarnedStardust, 0, 999999);
  out.totalEarnedStardust = Math.max(30, rawEarned, rawBank + spent);
  out.bankStardust = Math.max(0, out.totalEarnedStardust - spent);
  return out;
}

/**
 * Server-side anti-cheat plausibility & per-push increment validation.
 */
function validateAndClampClientMeta(serverRaw, clientRaw, runReport = null) {
  const warnings = [];
  const client = sanitizeMetaSave(clientRaw);
  const server = serverRaw ? sanitizeMetaSave(serverRaw) : null;

  // 1. Optional per-run telemetry sanity check (duration & drops vs score)
  if (runReport && typeof runReport === 'object') {
    const dur = Number(runReport.durationSec) || 0;
    const drops = Number(runReport.drops) || 0;
    const score = Number(runReport.score) || 0;
    const rMode = runReport.mode || 'chef';
    if (score > 3000 && (dur < 3 || drops < 2)) {
      warnings.push('implausible_run_duration_or_drops');
      if (rMode === 'rush') client.bestRush = server ? server.bestRush : 0;
      else if (rMode === 'zen') client.bestZen = server ? server.bestZen : 0;
      else client.bestChef = server ? server.bestChef : 0;
    } else if (dur > 0 && score / Math.max(5, dur) > 2200) {
      warnings.push('implausible_score_velocity');
      if (rMode === 'rush') client.bestRush = Math.min(client.bestRush, (server && server.bestRush) || 12000);
      else if (rMode === 'zen') client.bestZen = Math.min(client.bestZen, (server && server.bestZen) || 18000);
      else client.bestChef = Math.min(client.bestChef, (server && server.bestChef) || 25000);
    }
  }

  // 2. Per-push delta guard relative to existing server save
  if (server) {
    if (client.bestChef - server.bestChef > MAX_PUSH_CHEF_DELTA) {
      warnings.push('chef_delta_clamped');
      client.bestChef = server.bestChef + MAX_PUSH_CHEF_DELTA;
    }
    if (client.bestRush - server.bestRush > MAX_PUSH_RUSH_DELTA) {
      warnings.push('rush_delta_clamped');
      client.bestRush = server.bestRush + MAX_PUSH_RUSH_DELTA;
    }
    if (client.bestZen - server.bestZen > MAX_PUSH_ZEN_DELTA) {
      warnings.push('zen_delta_clamped');
      client.bestZen = server.bestZen + MAX_PUSH_ZEN_DELTA;
    }

    const deltaRuns = Math.max(1, client.lifetimeStats.runsPlayed - server.lifetimeStats.runsPlayed);
    const maxAllowedDustJump = Math.min(MAX_OFFLINE_STARDUST_DELTA, Math.max(360, deltaRuns * 260 + 120));
    if (client.totalEarnedStardust - server.totalEarnedStardust > maxAllowedDustJump) {
      warnings.push('stardust_delta_clamped');
      client.totalEarnedStardust = server.totalEarnedStardust + maxAllowedDustJump;
      const spent = computeSpentStardust(client);
      client.bankStardust = Math.max(0, client.totalEarnedStardust - spent);
    }
  } else {
    // First-time cloud upload cap for unlinked local storage
    const initRuns = Math.max(1, client.lifetimeStats.runsPlayed);
    const maxInitEarned = Math.min(3500, 120 + initRuns * 260);
    if (client.totalEarnedStardust > maxInitEarned) {
      warnings.push('initial_stardust_clamped');
      client.totalEarnedStardust = maxInitEarned;
      const spent = computeSpentStardust(client);
      client.bankStardust = Math.max(0, client.totalEarnedStardust - spent);
    }
  }

  return { sanitizedClient: client, warnings };
}

function mergeMetaSaves(serverRaw, validatedClient) {
  if (!serverRaw) {
    const only = sanitizeMetaSave(validatedClient);
    only.lastSyncedEarnedStardust = only.totalEarnedStardust;
    return only;
  }
  if (!validatedClient) return sanitizeMetaSave(serverRaw);
  const a = sanitizeMetaSave(serverRaw);
  const b = validatedClient;
  const preferB = (b.updatedAt || 0) >= (a.updatedAt || 0);
  const latest = preferB ? b : a;

  const unlockedPatrons = uniqStrings([...a.unlockedPatrons, ...b.unlockedPatrons], ['mikan']).filter(
    (id) => PATRON_COSTS[id] !== undefined
  );
  const unlockedThemes = uniqStrings([...a.unlockedThemes, ...b.unlockedThemes], ['amber']).filter(
    (id) => THEME_COSTS[id] !== undefined
  );

  const merged = {
    bestChef: Math.max(a.bestChef, b.bestChef),
    bestRush: Math.max(a.bestRush, b.bestRush),
    bestZen: Math.max(a.bestZen, b.bestZen),
    unlockedTiers: uniqTierNums([...a.unlockedTiers, ...b.unlockedTiers]),
    bgmTrack: latest.bgmTrack,
    sfxEnabled: latest.sfxEnabled,
    selectedPatron: unlockedPatrons.includes(latest.selectedPatron) ? latest.selectedPatron : 'mikan',
    unlockedPatrons,
    equippedTheme: unlockedThemes.includes(latest.equippedTheme) ? latest.equippedTheme : 'amber',
    unlockedThemes,
    shopUpgrades: {
      up_tools: Math.max(a.shopUpgrades.up_tools, b.shopUpgrades.up_tools),
      up_fever: Math.max(a.shopUpgrades.up_fever, b.shopUpgrades.up_fever),
      up_combo: Math.max(a.shopUpgrades.up_combo, b.shopUpgrades.up_combo),
      up_dust: Math.max(a.shopUpgrades.up_dust, b.shopUpgrades.up_dust)
    },
    seenModeGuides: {
      chef: !!(a.seenModeGuides.chef || b.seenModeGuides.chef),
      rush: !!(a.seenModeGuides.rush || b.seenModeGuides.rush),
      zen: !!(a.seenModeGuides.zen || b.seenModeGuides.zen)
    },
    seenTips: {
      prep_shop: !!(a.seenTips.prep_shop || b.seenTips.prep_shop),
      glaze_ring: !!(a.seenTips.glaze_ring || b.seenTips.glaze_ring),
      frozen: !!(a.seenTips.frozen || b.seenTips.frozen)
    },
    lifetimeStats: {
      runsPlayed: Math.max(a.lifetimeStats.runsPlayed, b.lifetimeStats.runsPlayed),
      ordersCompleted: Math.max(a.lifetimeStats.ordersCompleted, b.lifetimeStats.ordersCompleted),
      servesTotal: Math.max(a.lifetimeStats.servesTotal, b.lifetimeStats.servesTotal),
      bankShotsTotal: Math.max(a.lifetimeStats.bankShotsTotal, b.lifetimeStats.bankShotsTotal),
      maxAvalancheEver: Math.max(a.lifetimeStats.maxAvalancheEver, b.lifetimeStats.maxAvalancheEver),
      bestShiftReached: Math.max(a.lifetimeStats.bestShiftReached, b.lifetimeStats.bestShiftReached),
      shiftsClearedTotal: Math.max(a.lifetimeStats.shiftsClearedTotal, b.lifetimeStats.shiftsClearedTotal),
      fiveShiftClears: Math.max(a.lifetimeStats.fiveShiftClears, b.lifetimeStats.fiveShiftClears),
      soufflesMade: Math.max(a.lifetimeStats.soufflesMade, b.lifetimeStats.soufflesMade),
      yarnBroken: Math.max(a.lifetimeStats.yarnBroken, b.lifetimeStats.yarnBroken),
      maxComboEver: Math.max(a.lifetimeStats.maxComboEver, b.lifetimeStats.maxComboEver)
    },
    updatedAt: Date.now()
  };

  const spent = computeSpentStardust(merged);
  let totalEarned = Math.max(a.totalEarnedStardust, b.totalEarnedStardust, spent);
  const base = b.lastSyncedEarnedStardust || 0;
  if (base >= 30 && b.totalEarnedStardust > base && a.totalEarnedStardust > base) {
    const clientDelta = Math.min(MAX_OFFLINE_STARDUST_DELTA, b.totalEarnedStardust - base);
    totalEarned = Math.max(totalEarned, a.totalEarnedStardust + clientDelta);
  }
  merged.totalEarnedStardust = totalEarned;
  merged.lastSyncedEarnedStardust = totalEarned;
  merged.bankStardust = Math.max(0, totalEarned - spent);
  return merged;
}

function sanitizeProfile(raw, openidSuffix) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const defaultName = `星夜店长#${openidSuffix}`;
  const nick = typeof src.nickName === 'string' && src.nickName.trim() ? src.nickName.trim().slice(0, 16) : defaultName;
  const avatarUrl = typeof src.avatarUrl === 'string' ? src.avatarUrl.slice(0, 512) : '';
  const avatarPreset = ['mikan', 'luna', 'mugi'].includes(src.avatarPreset) ? src.avatarPreset : 'mikan';
  return {
    nickName: nick,
    avatarUrl,
    avatarPreset,
    authorized: !!src.authorized,
    updatedAt: clampInt(src.updatedAt || 0, 0, 9999999999999)
  };
}

function mergeProfiles(serverRaw, clientRaw, openidSuffix) {
  if (!serverRaw && !clientRaw) return sanitizeProfile(null, openidSuffix);
  if (!serverRaw) return sanitizeProfile(clientRaw, openidSuffix);
  if (!clientRaw) return sanitizeProfile(serverRaw, openidSuffix);
  const s = sanitizeProfile(serverRaw, openidSuffix);
  const c = sanitizeProfile(clientRaw, openidSuffix);
  if (s.authorized && !c.authorized) return s;
  if (c.authorized && !s.authorized) return c;
  return (c.updatedAt || 0) >= (s.updatedAt || 0) ? c : s;
}

function sanitizeActiveRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!['chef', 'rush', 'zen'].includes(raw.mode)) return null;
  if (raw.mode === 'chef') {
    raw.score = clampInt(raw.score, 0, MAX_CHEF_SCORE);
    raw.shiftRevenue = clampInt(raw.shiftRevenue, 0, MAX_CHEF_SCORE);
    raw.coins = clampInt(raw.coins, 0, 5000);
  } else if (raw.mode === 'rush') {
    raw.score = clampInt(raw.score, 0, MAX_RUSH_SCORE);
  } else {
    raw.score = clampInt(raw.score, 0, MAX_ZEN_SCORE);
  }
  const str = JSON.stringify(raw);
  if (str.length > 65000) return null;
  return raw;
}

function mergeSavedRuns(existingDoc, event) {
  const out = { chef: null, rush: null, zen: null };
  const prevMap = existingDoc && existingDoc.savedRuns && typeof existingDoc.savedRuns === 'object' ? existingDoc.savedRuns : {};
  for (const m of ['chef', 'rush', 'zen']) {
    if (prevMap[m]) out[m] = sanitizeActiveRun(prevMap[m]);
  }
  if (existingDoc && existingDoc.activeRun) {
    const leg = sanitizeActiveRun(existingDoc.activeRun);
    if (leg && (!out[leg.mode] || (leg.savedAt || 0) > (out[leg.mode].savedAt || 0))) {
      out[leg.mode] = leg;
    }
  }

  if (event.clearActiveRun && !event.clearSavedRunMode) {
    return { chef: null, rush: null, zen: null };
  }
  if (event.clearSavedRunMode && ['chef', 'rush', 'zen'].includes(event.clearSavedRunMode)) {
    out[event.clearSavedRunMode] = null;
  }

  if (event.savedRuns && typeof event.savedRuns === 'object') {
    for (const m of ['chef', 'rush', 'zen']) {
      if (event.savedRuns[m] === null) {
        if (event.clearSavedRunMode === m) out[m] = null;
      } else if (event.savedRuns[m]) {
        const inc = sanitizeActiveRun(event.savedRuns[m]);
        if (inc && (!out[m] || (inc.savedAt || 0) >= (out[m].savedAt || 0))) {
          out[m] = inc;
        }
      }
    }
  } else if (event.activeRun !== undefined) {
    if (event.activeRun === null) {
      out.chef = null;
    } else {
      const inc = sanitizeActiveRun(event.activeRun);
      if (inc) out[inc.mode] = inc;
    }
  }

  return out;
}

exports.main = async (event = {}) => {
  await ensurePlayersCollection();
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { ok: false, reason: 'missing_openid' };
  }

  const openidSuffix = openid.slice(-4).toUpperCase();
  const action = event.action || 'pull';
  const docRef = db.collection(PLAYERS_COL).doc(openid);

  async function readExisting() {
    try {
      const got = await docRef.get();
      return got && got.data ? got.data : null;
    } catch (_e) {
      return null;
    }
  }

  let existing = await readExisting();

  if (action === 'pull') {
    if (!existing) {
      const initMeta = sanitizeMetaSave(null);
      initMeta.lastSyncedEarnedStardust = initMeta.totalEarnedStardust;
      const initProfile = sanitizeProfile(null, openidSuffix);
      const now = Date.now();
      const newDoc = {
        openidSuffix,
        profile: initProfile,
        bestChef: 0,
        bestRush: 0,
        bestZen: 0,
        bestShiftReached: 0,
        metaSave: initMeta,
        activeRun: null,
        savedRuns: { chef: null, rush: null, zen: null },
        revision: 1,
        createdAt: now,
        updatedAt: now
      };
      await docRef.set({ data: newDoc });
      return {
        ok: true,
        isNewUser: true,
        openidSuffix,
        profile: initProfile,
        metaSave: initMeta,
        activeRun: null,
        savedRuns: newDoc.savedRuns,
        revision: 1
      };
    }

    const savedRuns = mergeSavedRuns(existing, {});
    const primaryRun = savedRuns.chef || savedRuns.rush || savedRuns.zen || null;
    return {
      ok: true,
      isNewUser: false,
      openidSuffix: existing.openidSuffix || openidSuffix,
      profile: existing.profile || sanitizeProfile(null, openidSuffix),
      metaSave: existing.metaSave || null,
      activeRun: primaryRun,
      savedRuns,
      revision: existing.revision || 1
    };
  }

  if (action === 'push') {
    const baseRev = Number(event.baseRevision) || 0;
    let conflictMerged = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) existing = await readExisting();
      if (existing && baseRev > 0 && baseRev < (existing.revision || 1)) {
        conflictMerged = true;
      }

      const { sanitizedClient, warnings } = validateAndClampClientMeta(
        existing && existing.metaSave,
        event.metaSave,
        event.runReport || null
      );
      const mergedMeta = mergeMetaSaves(existing && existing.metaSave, sanitizedClient);
      const mergedProfile = mergeProfiles(existing && existing.profile, event.profile, openidSuffix);
      const nextSavedRuns = mergeSavedRuns(existing, event);
      const nextPrimaryRun = nextSavedRuns.chef || nextSavedRuns.rush || nextSavedRuns.zen || null;
      const prevRev = (existing && existing.revision) || 0;
      const nextRev = prevRev + 1;
      const now = Date.now();

      const payload = {
        openidSuffix,
        profile: mergedProfile,
        bestChef: mergedMeta.bestChef,
        bestRush: mergedMeta.bestRush,
        bestZen: mergedMeta.bestZen,
        bestShiftReached: mergedMeta.lifetimeStats.bestShiftReached,
        metaSave: mergedMeta,
        activeRun: nextPrimaryRun,
        savedRuns: nextSavedRuns,
        revision: nextRev,
        updatedAt: now
      };

      if (!existing) {
        payload.createdAt = now;
        await docRef.set({ data: payload });
        return {
          ok: true,
          openidSuffix,
          profile: mergedProfile,
          metaSave: mergedMeta,
          activeRun: nextPrimaryRun,
          savedRuns: nextSavedRuns,
          revision: nextRev,
          conflictMerged,
          validationWarnings: warnings
        };
      }

      // Optimistic concurrency check on `revision` to prevent lost updates
      const updRes = await db
        .collection(PLAYERS_COL)
        .where({ _id: openid, revision: prevRev })
        .update({ data: payload });

      if (updRes && updRes.stats && updRes.stats.updated > 0) {
        return {
          ok: true,
          openidSuffix,
          profile: mergedProfile,
          metaSave: mergedMeta,
          activeRun: nextPrimaryRun,
          savedRuns: nextSavedRuns,
          revision: nextRev,
          conflictMerged,
          validationWarnings: warnings
        };
      }
      conflictMerged = true;
    }

    return { ok: false, reason: 'revision_conflict_retry_exhausted' };
  }

  if (action === 'updateProfile') {
    const now = Date.now();
    if (!existing) {
      const profile = sanitizeProfile(event.profile, openidSuffix);
      const initMeta = sanitizeMetaSave(null);
      await docRef.set({
        data: {
          openidSuffix,
          profile,
          bestChef: 0,
          bestRush: 0,
          bestZen: 0,
          bestShiftReached: 0,
          metaSave: initMeta,
          activeRun: null,
          savedRuns: { chef: null, rush: null, zen: null },
          revision: 1,
          createdAt: now,
          updatedAt: now
        }
      });
      return { ok: true, openidSuffix, profile };
    }
    const mergedProf = mergeProfiles(existing.profile, event.profile, openidSuffix);
    await docRef.update({
      data: {
        profile: mergedProf,
        revision: (existing.revision || 1) + 1,
        updatedAt: now
      }
    });
    return { ok: true, openidSuffix, profile: mergedProf };
  }

  if (action === 'leaderboard') {
    const mode = event.mode === 'rush' ? 'rush' : event.mode === 'zen' ? 'zen' : 'chef';
    const scoreField = mode === 'rush' ? 'bestRush' : mode === 'zen' ? 'bestZen' : 'bestChef';
    const maxCap = mode === 'rush' ? MAX_RUSH_SCORE : mode === 'zen' ? MAX_ZEN_SCORE : MAX_CHEF_SCORE;

    const topRes = await db
      .collection(PLAYERS_COL)
      .where({ [scoreField]: _.gt(0).and(_.lte(maxCap)) })
      .orderBy(scoreField, 'desc')
      .limit(50)
      .get();

    const list = (topRes.data || []).map((row, idx) => ({
      rank: idx + 1,
      isMe: row._id === openid,
      isNpc: false,
      nickName: (row.profile && row.profile.nickName) || `星夜店长#${row.openidSuffix || '0000'}`,
      avatarUrl: (row.profile && row.profile.avatarUrl) || '',
      avatarPreset: (row.profile && row.profile.avatarPreset) || 'mikan',
      score: Math.min(maxCap, row[scoreField] || 0),
      bestShiftReached: row.bestShiftReached || 0
    }));

    let myRank = null;
    const inTop = list.find((item) => item.isMe);
    const myScore = existing ? Math.min(maxCap, existing[scoreField] || 0) : 0;
    if (inTop) {
      myRank = inTop.rank;
    } else if (myScore > 0) {
      const higherCnt = await db
        .collection(PLAYERS_COL)
        .where({ [scoreField]: _.gt(myScore).and(_.lte(maxCap)) })
        .count();
      myRank = (higherCnt.total || 0) + 1;
    }

    return {
      ok: true,
      mode,
      list,
      myRank,
      myScore
    };
  }

  return { ok: false, reason: `unknown_action:${action}` };
};
