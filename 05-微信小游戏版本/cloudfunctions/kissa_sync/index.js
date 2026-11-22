/**
 * 星夜吃茶 (Hoshi Kissa) 微信云开发聚合云函数 `kissa_sync`
 *
 * 支持路由 (`event.action`):
 * - `pull`          : 静默获取 OPENID 并拉取玩家云存档（首次访问自动建表与建档）
 * - `push`          : 校验并无损单调合并永久进度 `metaSave` 与单局断点快照 `activeRun`
 * - `updateProfile` : 保存用户授权或自定义的店长昵称与头像
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
  const unlockedPatrons = uniqStrings(src.unlockedPatrons, ['mikan']);
  const unlockedThemes = uniqStrings(src.unlockedThemes, ['amber']);
  const ups = src.shopUpgrades && typeof src.shopUpgrades === 'object' ? src.shopUpgrades : {};
  const st = src.lifetimeStats && typeof src.lifetimeStats === 'object' ? src.lifetimeStats : {};
  const sg = src.seenModeGuides && typeof src.seenModeGuides === 'object' ? src.seenModeGuides : {};
  const tp = src.seenTips && typeof src.seenTips === 'object' ? src.seenTips : {};

  const out = {
    bestChef: clampInt(src.bestChef, 0, 9999999),
    bestRush: clampInt(src.bestRush, 0, 9999999),
    bestZen: clampInt(src.bestZen, 0, 9999999),
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
      maxAvalancheEver: clampInt(st.maxAvalancheEver, 0, 999),
      bestShiftReached: clampInt(st.bestShiftReached, 0, 999),
      shiftsClearedTotal: clampInt(st.shiftsClearedTotal, 0, 999999),
      fiveShiftClears: clampInt(st.fiveShiftClears, 0, 999999),
      soufflesMade: clampInt(st.soufflesMade, 0, 999999),
      yarnBroken: clampInt(st.yarnBroken, 0, 999999),
      maxComboEver: clampInt(st.maxComboEver || 1, 1, 999)
    },
    updatedAt: clampInt(src.updatedAt || Date.now(), 0, 9999999999999)
  };

  const spent = computeSpentStardust(out);
  const rawBank = clampInt(src.bankStardust !== undefined ? src.bankStardust : 30, 0, 9999999);
  const rawEarned = clampInt(src.totalEarnedStardust, 0, 9999999);
  out.totalEarnedStardust = Math.max(30, rawEarned, rawBank + spent);
  out.bankStardust = Math.max(0, out.totalEarnedStardust - spent);
  return out;
}

function mergeMetaSaves(serverRaw, clientRaw) {
  if (!serverRaw) return sanitizeMetaSave(clientRaw);
  if (!clientRaw) return sanitizeMetaSave(serverRaw);
  const a = sanitizeMetaSave(serverRaw);
  const b = sanitizeMetaSave(clientRaw);
  const preferB = (b.updatedAt || 0) >= (a.updatedAt || 0);
  const latest = preferB ? b : a;

  const unlockedPatrons = uniqStrings([...a.unlockedPatrons, ...b.unlockedPatrons], ['mikan']);
  const unlockedThemes = uniqStrings([...a.unlockedThemes, ...b.unlockedThemes], ['amber']);
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
  merged.totalEarnedStardust = Math.max(a.totalEarnedStardust, b.totalEarnedStardust, spent);
  merged.bankStardust = Math.max(0, merged.totalEarnedStardust - spent);
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
    updatedAt: clampInt(src.updatedAt || Date.now(), 0, 9999999999999)
  };
}

function sanitizeActiveRun(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!['chef', 'rush', 'zen'].includes(raw.mode)) return null;
  const str = JSON.stringify(raw);
  if (str.length > 65000) return null; // Guard document size
  return raw;
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

  let existing = null;
  try {
    const got = await docRef.get();
    existing = got && got.data ? got.data : null;
  } catch (_e) {
    existing = null;
  }

  if (action === 'pull') {
    if (!existing) {
      const initMeta = sanitizeMetaSave(null);
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
        revision: 1
      };
    }

    return {
      ok: true,
      isNewUser: false,
      openidSuffix: existing.openidSuffix || openidSuffix,
      profile: existing.profile || sanitizeProfile(null, openidSuffix),
      metaSave: existing.metaSave || null,
      activeRun: existing.activeRun || null,
      revision: existing.revision || 1
    };
  }

  if (action === 'push') {
    const mergedMeta = mergeMetaSaves(existing && existing.metaSave, event.metaSave);
    const mergedProfile = event.profile
      ? sanitizeProfile(event.profile, openidSuffix)
      : (existing && existing.profile) || sanitizeProfile(null, openidSuffix);

    let nextActiveRun = existing ? existing.activeRun : null;
    if (event.clearActiveRun) {
      nextActiveRun = null;
    } else if (event.activeRun !== undefined) {
      nextActiveRun = sanitizeActiveRun(event.activeRun);
    }

    const nextRev = ((existing && existing.revision) || 0) + 1;
    const now = Date.now();
    const payload = {
      openidSuffix,
      profile: mergedProfile,
      bestChef: mergedMeta.bestChef,
      bestRush: mergedMeta.bestRush,
      bestZen: mergedMeta.bestZen,
      bestShiftReached: mergedMeta.lifetimeStats.bestShiftReached,
      metaSave: mergedMeta,
      activeRun: nextActiveRun,
      revision: nextRev,
      updatedAt: now
    };
    if (!existing) payload.createdAt = now;

    await docRef.set({ data: payload });
    return {
      ok: true,
      openidSuffix,
      profile: mergedProfile,
      metaSave: mergedMeta,
      activeRun: nextActiveRun,
      revision: nextRev
    };
  }

  if (action === 'updateProfile') {
    const profile = sanitizeProfile(event.profile, openidSuffix);
    const now = Date.now();
    if (!existing) {
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
          revision: 1,
          createdAt: now,
          updatedAt: now
        }
      });
    } else {
      await docRef.update({
        data: {
          profile,
          updatedAt: now
        }
      });
    }
    return { ok: true, openidSuffix, profile };
  }

  if (action === 'leaderboard') {
    const mode = event.mode === 'rush' ? 'rush' : event.mode === 'zen' ? 'zen' : 'chef';
    const scoreField = mode === 'rush' ? 'bestRush' : mode === 'zen' ? 'bestZen' : 'bestChef';

    const topRes = await db
      .collection(PLAYERS_COL)
      .where({ [scoreField]: _.gt(0) })
      .orderBy(scoreField, 'desc')
      .limit(50)
      .get();

    const list = (topRes.data || []).map((row, idx) => ({
      rank: idx + 1,
      isMe: row._id === openid,
      nickName: (row.profile && row.profile.nickName) || `星夜店长#${row.openidSuffix || '0000'}`,
      avatarUrl: (row.profile && row.profile.avatarUrl) || '',
      avatarPreset: (row.profile && row.profile.avatarPreset) || 'mikan',
      score: row[scoreField] || 0,
      bestShiftReached: row.bestShiftReached || 0
    }));

    let myRank = null;
    const inTop = list.find((item) => item.isMe);
    const myScore = existing ? existing[scoreField] || 0 : 0;
    if (inTop) {
      myRank = inTop.rank;
    } else if (myScore > 0) {
      const higherCnt = await db
        .collection(PLAYERS_COL)
        .where({ [scoreField]: _.gt(myScore) })
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
