/**
 * Main Application Controller, Gesture Arbitration FSM, Deterministic Simulation Loop,
 * Cloud Sync Coordinator & __HOSHI_DEBUG__ Harness API
 * for Hoshi Kissa Bakery v2.0 (WeChat Mini Game Edition).
 *
 * Core Iron Laws Enforced:
 * 1. Pure Serve-Only Scoring: score ONLY increments inside OrderService.matchTrayToCustomer.
 * 2. Zero HSL color strings & Zero Unicode Emoji strings anywhere.
 * 3. Synchronous renderFrame(0) on boot and after every state mutator for instant HitRegistry parity.
 */
'use strict';

const {
  GAME_TITLE,
  GAME_VERSION,
  DEFAULT_INITIAL_STARDUST,
  CATCAKES,
  FEVER_CONFIG,
  TRASH_CONFIG,
  SHOP_DEVICES,
  PATRONS,
  PATRON_COSTS,
  TOOLS,
  BOARD_THEMES,
  THEME_COSTS,
  ASSET_PATHS,
  TUTORIAL_STEPS,
  normalizePatronId
} = require('./constants');
const {
  CHAPTERS,
  LEVEL_MAP,
  getLevelById,
  getNextLevelId,
  isChapterUnlocked,
  isLevelUnlocked
} = require('./levels_data');
const CloudConfig = require('./cloud_config');
const platform = require('./platform');
const StarlightAudio = require('./audio');
const UI = require('./ui_draw');
const GridEngine = require('./grid_engine');
const OrderService = require('./order_service');
const BoardRenderer = require('./board_renderer');
const SaveSync = require('./save_sync');
const ScreensUI = require('./screens_ui');
const ModalsUI = require('./modals_ui');

let previousAppCleanup = null;

const OWN_PROP = Object.prototype.hasOwnProperty;

function hasOwn(obj, key) {
  return obj !== null && obj !== undefined && typeof obj === 'object' && OWN_PROP.call(obj, key);
}

const SLIDE_KEY_MAP = Object.freeze(
  Object.assign(Object.create(null), {
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
    ArrowUp: 'up',
    w: 'up',
    W: 'up',
    ArrowDown: 'down',
    s: 'down',
    S: 'down'
  })
);

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function rawNowMs() {
  if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function pointInRect(x, y, rect) {
  if (!rect || typeof rect !== 'object') return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

function cloneJsonSafe(val) {
  if (val === null || val === undefined) return val;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch (_) {
    return null;
  }
}

function createFireflies(count = 26) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: ((i * 0.37 + 0.13) % 1),
      y: ((i * 0.61 + 0.07) % 1),
      vx: ((i % 5) - 2) * 0.008,
      vy: -0.015 - (i % 4) * 0.006,
      r: 1.8 + (i % 3) * 0.85,
      phase: i * 1.17
    });
  }
  return arr;
}

function createEmptyAnimState() {
  return {
    slide: null,
    slideTimer: 0,
    slideDuration: 0.11,
    moveEvents: [],
    blockedShake: null,
    mergeTimer: 0,
    mergeDuration: 0.22,
    mergeEvents: [],
    iceTimer: 0,
    iceDuration: 0.22,
    brokenIceCells: [],
    cellFX: [],
    flyingSprites: [],
    popups: [],
    leavingCustomers: [],
    trayHintSlot: -1,
    trayHintTimer: 0,
    trashWobbleTimer: 0,
    trashPuffTimer: 0,
    comboBreakTimer: 0
  };
}

function createApp() {
  if (typeof previousAppCleanup === 'function') {
    try {
      previousAppCleanup();
    } catch (_) {}
    previousAppCleanup = null;
  }

  let destroyed = false;
  let rafId = null;
  let cloudPushTimer = null;
  let saveEpoch = 0;
  let inSyntheticClickHit = false;

  if (typeof document !== 'undefined' && document) {
    try {
      document.title = GAME_TITLE;
    } catch (_) {}
  }

  let metrics = platform.getSystemMetrics();
  const canvas = platform.createMainCanvas(metrics);
  const rawCtx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  const ctx = ScreensUI.getSafeCtx(rawCtx);
  const hits = new UI.HitRegistry();
  const fireflies = createFireflies(26);

  // Load & normalize v2 save (auto-migrates v1 saves and purges legacy active_run keys)
  const saveData = SaveSync.loadLocalSave(platform);

  // Audio initialization & persisted user preference sync
  const audio = new StarlightAudio({
    createAudioContext: () => platform.createAudioContext()
  });

  function syncAudioPrefsFromSave() {
    const nextTrack =
      saveData.bgmTrack === 'bossa' || saveData.bgmTrack === 'off'
        ? saveData.bgmTrack
        : 'waltz';
    audio.setSfxEnabled(Boolean(saveData.sfxEnabled));
    if (audio.ctx !== null) {
      audio.setBGMTrack(nextTrack);
    } else {
      audio.bgmTrack = nextTrack;
      audio.bgmEnabled = nextTrack !== 'off';
    }
  }

  syncAudioPrefsFromSave();

  // Runtime 30-asset registry matching constants.ASSET_PATHS 1:1
  const sprites = {
    bg: null,
    shopSign: null,
    uiAtlas: null,
    uiAtlas2: null,
    uiAtlas3: null,
    titlePlaque: null,
    patronStage: null,
    serveBell: null,
    hero: null,
    customersAtlas: null,
    boardTilesAtlas: null,
    patrons: { mikan: null, luna: null, mugi: null },
    tools: { fork: null, spoon: null },
    catcakes: {},
    catcakesHappy: {},
    loadedCount: 0,
    totalCount: 30
  };

  function preloadAssets() {
    const tasks = [
      { src: ASSET_PATHS.bg, assign: (img) => { sprites.bg = img; } },
      { src: ASSET_PATHS.shopSign, assign: (img) => { sprites.shopSign = img; } },
      { src: ASSET_PATHS.uiAtlas, assign: (img) => { sprites.uiAtlas = img; } },
      { src: ASSET_PATHS.uiAtlas2, assign: (img) => { sprites.uiAtlas2 = img; } },
      { src: ASSET_PATHS.uiAtlas3, assign: (img) => { sprites.uiAtlas3 = img; } },
      { src: ASSET_PATHS.titlePlaque, assign: (img) => { sprites.titlePlaque = img; } },
      { src: ASSET_PATHS.patronStage, assign: (img) => { sprites.patronStage = img; } },
      { src: ASSET_PATHS.serveBell, assign: (img) => { sprites.serveBell = img; } },
      { src: ASSET_PATHS.hero, assign: (img) => { sprites.hero = img; } },
      { src: ASSET_PATHS.customersAtlas, assign: (img) => { sprites.customersAtlas = img; } },
      { src: ASSET_PATHS.boardTilesAtlas, assign: (img) => { sprites.boardTilesAtlas = img; } },
      { src: ASSET_PATHS.patrons.mikan, assign: (img) => { sprites.patrons.mikan = img; } },
      { src: ASSET_PATHS.patrons.luna, assign: (img) => { sprites.patrons.luna = img; } },
      { src: ASSET_PATHS.patrons.mugi, assign: (img) => { sprites.patrons.mugi = img; } },
      { src: ASSET_PATHS.tools.fork, assign: (img) => { sprites.tools.fork = img; } },
      { src: ASSET_PATHS.tools.spoon, assign: (img) => { sprites.tools.spoon = img; } }
    ];

    for (let t = 1; t <= 7; t++) {
      const tier = t;
      tasks.push({
        src: ASSET_PATHS.catcakes[tier],
        assign: (img) => {
          sprites.catcakes[tier] = img;
          sprites[`catcake_${tier}`] = img;
        }
      });
      tasks.push({
        src: ASSET_PATHS.catcakesHappy[tier],
        assign: (img) => {
          sprites.catcakesHappy[tier] = img;
          sprites[`catcake_${tier}_happy`] = img;
        }
      });
    }

    sprites.totalCount = tasks.length;

    const gObj = platform.getGlobal ? platform.getGlobal() : globalThis;
    const wxObj = gObj && gObj.wx;
    const hasAsyncLoader = Boolean(
      (platform.hasWx && wxObj && typeof wxObj.createImage === 'function') ||
      (!platform.hasWx && gObj && typeof gObj.Image === 'function')
    );

    if (!hasAsyncLoader) {
      sprites.loadedCount = tasks.length;
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let counted = false;
      platform.loadImage(task.src).then((img) => {
        if (destroyed || counted) return;
        if (img) {
          counted = true;
          task.assign(img);
          sprites.loadedCount += 1;
        }
      });
    }
  }

  // Cloud state
  const cloudState = {
    status: saveData.higherSchemaDetected
      ? 'higher_schema_blocked'
      : CloudConfig.ENABLE_CLOUD_SYNC
      ? 'idle'
      : 'local_only',
    revision: 0,
    openidSuffix: 'LOCAL',
    dirty: false,
    retryCount: 0
  };

  let simElapsedMs = 0;
  function getEffectiveNowMs() {
    return rawNowMs() + simElapsedMs;
  }

  const initialFrontier = saveData.highestUnlockedLevel || '1-1';
  const initialLvl = getLevelById(initialFrontier) || getLevelById('1-1');

  let levelRng = Math.random;
  let kneadCooldown = 0;
  let autoServeTimer = 0;
  let tutorialAutoFadeTimer = 0;
  let levelSkipTutorial = false;
  let lastCountdownTickInt = 6;
  let unlockedStarsMask = 0;
  let lastTrayTapSlot = -1;
  let lastTrayTapTimeMs = -99999;
  let runForkUses = 0;
  let runSpoonUses = 0;

  // Game & UI state container passed to ScreensUI and ModalsUI
  const app = {
    screen: 'lobby',
    selectedChapter: initialLvl ? initialLvl.chapter : 1,
    previewLevelId: initialFrontier,
    currentLevelId: null,
    activeModal: null,
    activeShopTab: 'catcakes',
    activeCompendiumTab: 'catcakes',
    leaderboardBoardType: 'stars',
    leaderboardData: platform.buildOfflineLeaderboard('stars', saveData, 'LOCAL'),
    leaderboardLoading: false,
    activeTutorialStep: null,
    tutorialSkipRect: null,
    activeModalFrame: null,
    modalScrollRect: null,
    modalScrollY: 0,
    modalMaxScroll: 0,
    userInfoBtnRect: null,
    lobbyPatronPokeRect: null,
    patronPokeTimer: 0,
    currentPatronLine: '',
    playPatronSpeech: '',
    confirmDialog: null,

    saveData,
    sprites,
    audio,
    gridState: null,
    orderState: null,
    currentBoardLayout: null,
    guideTargets: null,
    neededTiers: { allNeeded: [], preferredNeeded: [] },
    animState: createEmptyAnimState(),

    skillEnergy: 0,
    activeTool: null,
    forkSourceCell: null,
    toolCounts: { fork: 1, spoon: 0 },
    toolBoughtThisLevel: { fork: 0, spoon: 0 },
    kneadPressTimer: 0,
    boardFullHintTimer: 0,
    starPopTimers: [0, 0, 0],
    lastResult: null,

    toastCurrent: null,
    minorToast: null,

    get cloudStatus() {
      return cloudState.status;
    },
    get equippedTheme() {
      const tid = saveData.equippedTheme;
      return (
        (typeof tid === 'string' && hasOwn(BOARD_THEMES, tid) ? BOARD_THEMES[tid] : null) ||
        BOARD_THEMES.amber
      );
    },
    get isLobbyOpen() {
      return app.screen === 'lobby';
    },
    getMetrics() {
      return metrics;
    }
  };

  // Pure Serve-Only gameState mirror for backdrop & audio hooks (NO addScore helper!)
  const gameState = {
    score: 0,
    feverActive: false
  };

  function syncGameStateMirror() {
    if (app.orderState) {
      gameState.score = Math.max(0, Math.floor(Number(app.orderState.score) || 0));
      gameState.feverActive = Boolean(app.orderState.feverActive);
    } else if (app.screen === 'result' && app.lastResult) {
      gameState.score = Math.max(0, Math.floor(Number(app.lastResult.score) || 0));
      gameState.feverActive = false;
    } else {
      gameState.score = 0;
      gameState.feverActive = false;
    }
  }

  function syncAudioMood() {
    const shouldMuffle = app.activeModal !== null || app.screen === 'result';
    audio.setMuffled(shouldMuffle);
    const inFever = Boolean(app.screen === 'playing' && app.activeModal === null && app.orderState && app.orderState.feverActive);
    audio.setFeverMode(inFever);
    if (app.screen === 'playing' && app.activeModal === null && app.orderState) {
      const tl = Number(app.orderState.timeLeft) || 0;
      audio.setDangerLevel(tl > 0 && tl <= 15 ? clamp(1 - tl / 15, 0.15, 1) : 0);
    } else {
      audio.setDangerLevel(0);
    }
  }

  function showToast(text, opts = {}) {
    if (!text) return;
    const isMajor = opts.level === 'major' || opts.tone === 'event';
    const dur = Number(opts.duration) || (isMajor ? 2.4 : 1.7);
    const entry = {
      text: String(text),
      icon: opts.icon || '',
      tone: opts.tone || (isMajor ? 'event' : 'info'),
      level: isMajor ? 'major' : 'minor',
      timer: dur,
      maxTimer: dur
    };
    if (isMajor) {
      app.toastCurrent = entry;
    } else {
      app.minorToast = entry;
    }
  }
  app.showToast = showToast;

  function persistSave(syncCloud = true) {
    SaveSync.saveLocalSave(platform, saveData);
    platform.setWxFriendCloudScore(saveData);
    if (syncCloud) {
      scheduleCloudPush(null);
    }
  }

  function checkVeteranGiftToast() {
    if (saveData && saveData.migratedFromV1GiftPending === true) {
      saveData.migratedFromV1GiftPending = false;
      SaveSync.saveLocalSave(platform, saveData);
      showToast('已退还旧版天赋星尘并赠 50 星尘老店长答谢礼', {
        icon: 'icon_gift',
        tone: 'event',
        level: 'major',
        duration: 3.0
      });
    }
  }

  // ==================== Affordability Red-Dot Helpers ====================

  function isCatcakeUnlockedInternal(cakeOrTier) {
    const cake =
      cakeOrTier && typeof cakeOrTier === 'object'
        ? cakeOrTier
        : CATCAKES.find((c) => c.tier === Number(cakeOrTier));
    if (!cake || !cake.unlockLevel || cake.unlockLevel === '1-1') return true;
    return isLevelUnlocked(cake.unlockLevel, saveData.levelStars).unlocked;
  }

  app.isCatcakeUnlocked = isCatcakeUnlockedInternal;

  app.hasAffordableShopTab = function hasAffordableShopTab(tabId) {
    const bank = Math.max(0, Math.floor(Number(saveData.bankStardust) || 0));
    if (bank <= 0) return false;

    if (tabId === 'catcakes') {
      for (let i = 0; i < CATCAKES.length; i++) {
        const c = CATCAKES[i];
        if (!isCatcakeUnlockedInternal(c)) continue;
        const rawLv =
          saveData.catcakeLevels && hasOwn(saveData.catcakeLevels, String(c.tier))
            ? saveData.catcakeLevels[c.tier]
            : 0;
        const lv = clamp(Math.floor(Number(rawLv) || 0), 0, 4);
        if (lv < 4 && bank >= c.upgradeCosts[lv]) {
          return true;
        }
      }
      return false;
    }
    if (tabId === 'devices') {
      for (let i = 0; i < SHOP_DEVICES.length; i++) {
        const d = SHOP_DEVICES[i];
        const rawLv =
          saveData.deviceUpgrades && hasOwn(saveData.deviceUpgrades, d.id)
            ? saveData.deviceUpgrades[d.id]
            : 0;
        const lv = clamp(Math.floor(Number(rawLv) || 0), 0, d.maxLv);
        if (lv < d.maxLv && bank >= d.costs[lv]) return true;
      }
      return false;
    }
    if (tabId === 'patrons') {
      const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
      for (let i = 0; i < PATRONS.length; i++) {
        const p = PATRONS[i];
        if (!unlocked.includes(p.id) && bank >= p.cost) return true;
      }
      return false;
    }
    if (tabId === 'themes') {
      const unlocked = Array.isArray(saveData.unlockedThemes) ? saveData.unlockedThemes : ['amber'];
      for (let i = 0; i < BOARD_THEMES_KEYS.length; i++) {
        const tid = BOARD_THEMES_KEYS[i];
        if (!unlocked.includes(tid) && hasOwn(THEME_COSTS, tid) && bank >= THEME_COSTS[tid]) {
          return true;
        }
      }
      return false;
    }
    return false;
  };

  const BOARD_THEMES_KEYS = ['amber', 'sakura', 'moonlight'];

  app.hasAffordableShopItem = function hasAffordableShopItem() {
    return (
      app.hasAffordableShopTab('catcakes') ||
      app.hasAffordableShopTab('devices') ||
      app.hasAffordableShopTab('patrons') ||
      app.hasAffordableShopTab('themes')
    );
  };

  // ==================== Cloud Sync & Dual Leaderboard ====================

  function markHigherSchemaBlocked(showNotice = true) {
    saveData.higherSchemaDetected = true;
    cloudState.status = 'higher_schema_blocked';
    cloudState.dirty = false;
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (showNotice) {
      showToast('检测到更高版本云存档，请重启更新小游戏版本', {
        icon: 'icon_warn',
        tone: 'warn',
        level: 'major',
        duration: 3.2
      });
    }
  }

  function refreshOfflineLeaderboardFallback() {
    app.leaderboardData = platform.buildOfflineLeaderboard(
      app.leaderboardBoardType,
      saveData,
      cloudState.openidSuffix || 'LOCAL'
    );
  }

  function fetchLeaderboard(boardType) {
    const cleanType = boardType === 'score' ? 'score' : 'stars';
    app.leaderboardBoardType = cleanType;
    refreshOfflineLeaderboardFallback();

    if (!CloudConfig.ENABLE_CLOUD_SYNC) {
      cloudState.status = 'local_only';
      return;
    }

    const reqEpoch = saveEpoch;
    app.leaderboardLoading = true;
    platform
      .callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, {
        action: 'leaderboard',
        boardType: cleanType
      })
      .then((res) => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        app.leaderboardLoading = false;
        if (res && res.ok && Array.isArray(res.list) && res.list.length > 0) {
          app.leaderboardData = {
            ok: true,
            boardType: cleanType,
            list: res.list,
            myRank: res.myRank || null,
            totalPlayers: res.totalPlayers || res.list.length
          };
          if (cloudState.status === 'idle') cloudState.status = 'synced';
        } else {
          refreshOfflineLeaderboardFallback();
        }
        if (app.activeModal === 'leaderboard') {
          renderFrame(0);
        }
      })
      .catch(() => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        app.leaderboardLoading = false;
        refreshOfflineLeaderboardFallback();
        if (app.activeModal === 'leaderboard') {
          renderFrame(0);
        }
      });
  }

  function scheduleCloudRetry(expectedEpoch) {
    if (destroyed || !CloudConfig.ENABLE_CLOUD_SYNC || saveData.higherSchemaDetected) return;
    cloudState.retryCount = (cloudState.retryCount || 0) + 1;
    if (cloudState.retryCount > 4) return;
    if (cloudPushTimer) clearTimeout(cloudPushTimer);
    const delayMs = Math.min(10000, 1200 * Math.pow(2, cloudState.retryCount - 1));
    cloudPushTimer = setTimeout(() => {
      cloudPushTimer = null;
      if (destroyed || expectedEpoch !== saveEpoch) return;
      if (cloudState.status === 'retry_pending' || cloudState.dirty) {
        flushCloudPush(null);
      }
    }, delayMs);
  }

  function flushCloudPush(runReport = null) {
    if (destroyed || !CloudConfig.ENABLE_CLOUD_SYNC) return;
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (saveData.higherSchemaDetected) {
      cloudState.status = 'higher_schema_blocked';
      cloudState.dirty = false;
      return;
    }

    const reqEpoch = saveEpoch;
    const pushedEarned = saveData.totalEarnedStardust || DEFAULT_INITIAL_STARDUST;
    cloudState.status = 'syncing';
    cloudState.dirty = false;

    const payload = {
      action: 'push',
      baseRevision: cloudState.revision || 0,
      metaSave: saveData,
      profile: saveData.playerProfile
    };
    if (runReport && typeof runReport === 'object') {
      payload.runReport = runReport;
    }

    platform
      .callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, payload)
      .then((res) => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        if (res && res.higherSchemaDetected) {
          markHigherSchemaBlocked(true);
          return;
        }
        if (res && res.ok) {
          cloudState.status = 'synced';
          cloudState.retryCount = 0;
          if (typeof res.revision === 'number') {
            cloudState.revision = res.revision;
          }
          if (res.openidSuffix) {
            cloudState.openidSuffix = res.openidSuffix;
          }
          if (res.metaSave && typeof res.metaSave === 'object') {
            const localPostPush = {
              ...saveData,
              lastSyncedEarnedStardust: Math.max(
                saveData.lastSyncedEarnedStardust || 0,
                Math.min(saveData.totalEarnedStardust || DEFAULT_INITIAL_STARDUST, pushedEarned)
              )
            };
            const merged = SaveSync.mergeSaveData(localPostPush, res.metaSave, res.profile);
            merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
            SaveSync.saveLocalSave(platform, merged);
            Object.assign(saveData, merged);
            syncAudioPrefsFromSave();
          } else {
            saveData.lastSyncedEarnedStardust = saveData.totalEarnedStardust;
            SaveSync.saveLocalSave(platform, saveData);
          }
          if (app.activeModal === 'leaderboard') {
            fetchLeaderboard(app.leaderboardBoardType);
          }
        } else {
          cloudState.status = res && res.reason === 'cloud_unavailable' ? 'local_only' : 'retry_pending';
          cloudState.dirty = true;
          if (cloudState.status === 'retry_pending') {
            scheduleCloudRetry(reqEpoch);
          }
        }
      })
      .catch(() => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        cloudState.status = 'retry_pending';
        cloudState.dirty = true;
        scheduleCloudRetry(reqEpoch);
      });
  }

  function scheduleCloudPush(runReport = null) {
    if (destroyed || !CloudConfig.ENABLE_CLOUD_SYNC) return;
    if (saveData.higherSchemaDetected) {
      cloudState.status = 'higher_schema_blocked';
      cloudState.dirty = false;
      return;
    }
    cloudState.dirty = true;
    if (runReport) {
      flushCloudPush(runReport);
      return;
    }
    if (cloudPushTimer) clearTimeout(cloudPushTimer);
    const scheduledEpoch = saveEpoch;
    cloudPushTimer = setTimeout(() => {
      cloudPushTimer = null;
      if (destroyed || scheduledEpoch !== saveEpoch) return;
      flushCloudPush(null);
    }, CloudConfig.SYNC_DEBOUNCE_MS || 1800);
  }

  function initCloudSyncOnBoot() {
    if (!CloudConfig.ENABLE_CLOUD_SYNC) {
      cloudState.status = 'local_only';
      return;
    }
    try {
      platform.initCloud(CloudConfig.CLOUD_ENV_ID || '');
    } catch (_) {}

    if (saveData.higherSchemaDetected) {
      markHigherSchemaBlocked(false);
      refreshOfflineLeaderboardFallback();
      return;
    }

    const reqEpoch = saveEpoch;
    cloudState.status = 'syncing';
    platform
      .callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, { action: 'pull' })
      .then((res) => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        if (!res || !res.ok) {
          cloudState.status = 'local_only';
          refreshOfflineLeaderboardFallback();
          return;
        }
        cloudState.revision = typeof res.revision === 'number' ? res.revision : 1;
        if (res.openidSuffix) cloudState.openidSuffix = res.openidSuffix;

        const cloudHasHigherSchema = Boolean(
          res.higherSchemaDetected ||
            (res.metaSave &&
              typeof res.metaSave === 'object' &&
              Number(res.metaSave.schemaVersion) > SaveSync.SCHEMA_VERSION)
        );
        if (cloudHasHigherSchema) {
          if (res.metaSave && typeof res.metaSave === 'object') {
            const mergedReadOnly = SaveSync.mergeSaveData(saveData, res.metaSave, res.profile);
            mergedReadOnly.higherSchemaDetected = true;
            Object.assign(saveData, mergedReadOnly);
            syncAudioPrefsFromSave();
          }
          markHigherSchemaBlocked(true);
          refreshOfflineLeaderboardFallback();
          return;
        }

        cloudState.status = 'synced';
        if (res.metaSave && typeof res.metaSave === 'object') {
          const localStarsBefore =
            (saveData.lifetimeStats && saveData.lifetimeStats.totalStars) || 0;
          const localEarnedBefore = saveData.totalEarnedStardust || DEFAULT_INITIAL_STARDUST;
          const merged = SaveSync.mergeSaveData(saveData, res.metaSave, res.profile);
          merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
          SaveSync.saveLocalSave(platform, merged);
          Object.assign(saveData, merged);

          syncAudioPrefsFromSave();
          checkVeteranGiftToast();

          if (
            res.isNewUser ||
            localStarsBefore > (res.totalStars || 0) ||
            localEarnedBefore >
              ((res.metaSave && res.metaSave.totalEarnedStardust) || DEFAULT_INITIAL_STARDUST)
          ) {
            flushCloudPush(null);
          }
        }
        refreshOfflineLeaderboardFallback();
      })
      .catch(() => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        cloudState.status = 'local_only';
        refreshOfflineLeaderboardFallback();
      });
  }

  // ==================== Audio & Settings Actions ====================

  app.cycleBgm = function cycleBgm() {
    audio.unlock();
    const nextTrack = audio.cycleBGMTrack();
    saveData.bgmTrack = nextTrack;
    persistSave(true);
    const info = audio.getTrackInfo();
    showToast(`背景音乐：${info.title || info.label}`, { icon: 'icon_bgm' });
    return nextTrack;
  };

  app.toggleSfx = function toggleSfx() {
    audio.unlock();
    const next = !audio.sfxEnabled;
    audio.setSfxEnabled(next);
    saveData.sfxEnabled = next;
    if (next) audio.playPatronSelect();
    persistSave(true);
    showToast(next ? '游戏音效已开启' : '游戏音效已关闭', { icon: 'icon_sfx' });
    return next;
  };

  // ==================== Lobby, Chapter & Shop Actions ====================

  app.switchChapter = function switchChapter(delta) {
    const maxChapter = Math.max(1, CHAPTERS.length);
    const next = clamp(app.selectedChapter + (delta > 0 ? 1 : -1), 1, maxChapter);
    if (next === app.selectedChapter) return false;
    app.selectedChapter = next;
    audio.playPatronSelect();
    const chapStatus = isChapterUnlocked(next, saveData.levelStars);
    if (!chapStatus.unlocked) {
      showToast(chapStatus.reason, { icon: 'icon_warn', tone: 'warn' });
    }
    return true;
  };

  app.onTapLevelNode = function onTapLevelNode(levelId) {
    const lvl = getLevelById(levelId);
    if (!lvl) return false;
    const status = isLevelUnlocked(lvl.id, saveData.levelStars);
    if (!status.unlocked) {
      audio.playGridBlocked();
      showToast(status.reason || '需先通关前置关卡', { icon: 'icon_warn', tone: 'warn' });
      return false;
    }
    return openLevelPreviewInternal(lvl.id);
  };

  app.pokeLobbyPatron = function pokeLobbyPatron() {
    const patronId = normalizePatronId(saveData.selectedPatron);
    const patron = PATRONS.find((p) => p.id === patronId) || PATRONS[0];
    app.patronPokeTimer = 0.35;
    const lines = patron.idleLines || [patron.greet];
    const nextIdx = Math.floor(Math.random() * lines.length);
    app.currentPatronLine = lines[nextIdx] || patron.greet;
    audio.playPatronSelect();
  };

  app.cycleOrOpenPatrons = function cycleOrOpenPatrons() {
    const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
    if (unlocked.length < 2) {
      app.openShop('patrons');
      showToast('去吃茶小铺邀请新主厨搭档吧', { icon: 'icon_shop' });
      return true;
    }
    const cur = normalizePatronId(saveData.selectedPatron);
    const idx = unlocked.indexOf(cur);
    const nextId = unlocked[(idx + 1) % unlocked.length];
    saveData.selectedPatron = nextId;
    const patron = PATRONS.find((p) => p.id === nextId) || PATRONS[0];
    app.currentPatronLine = patron.greet;
    app.patronPokeTimer = 0.3;
    audio.playPatronSelect();
    persistSave(true);
    showToast(`已切换搭档：${patron.name}`, { icon: patron.id });
    return true;
  };

  app.selectPatronInPreview = function selectPatronInPreview(patronId) {
    const pid = normalizePatronId(patronId);
    const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
    if (!unlocked.includes(pid)) {
      audio.playGridBlocked();
      showToast('请先前往吃茶小铺邀请解锁该搭档', { icon: 'icon_shop', tone: 'warn' });
      return false;
    }
    saveData.selectedPatron = pid;
    audio.playPatronSelect();
    persistSave(true);
    return true;
  };

  app.openShop = function openShop(tab = 'catcakes') {
    const validTab =
      tab === 'devices' || tab === 'patrons' || tab === 'themes' ? tab : 'catcakes';
    app.activeShopTab = validTab;
    app.activeModal = 'shop';
    app.modalScrollY = 0;
    audio.playPatronSelect();
    syncAudioMood();
  };

  app.openShopFromResult = function openShopFromResult() {
    app.screen = 'lobby';
    app.currentLevelId = null;
    app.gridState = null;
    app.orderState = null;
    app.activeTool = null;
    app.forkSourceCell = null;
    app.activeShopTab = 'catcakes';
    app.activeModal = 'shop';
    app.modalScrollY = 0;
    audio.playPatronSelect();
    syncGameStateMirror();
    syncAudioMood();
  };

  app.setShopTab = function setShopTab(tabId) {
    if (tabId === 'catcakes' || tabId === 'devices' || tabId === 'patrons' || tabId === 'themes') {
      app.activeShopTab = tabId;
      app.modalScrollY = 0;
      audio.playPatronSelect();
    }
  };

  app.buyCatcakeUpgrade = function buyCatcakeUpgrade(tier) {
    const cake = CATCAKES.find((c) => c.tier === Number(tier));
    if (!cake) return false;
    if (!isCatcakeUnlockedInternal(cake)) {
      audio.playGridBlocked();
      showToast(`开启第 ${cake.unlockLevel} 关后即可研发 ${cake.name}`, {
        icon: 'icon_warn',
        tone: 'warn'
      });
      return false;
    }
    const curLv = clamp(Math.floor(Number(saveData.catcakeLevels && saveData.catcakeLevels[cake.tier]) || 0), 0, 4);
    if (curLv >= 4) {
      showToast(`${cake.name} 已达满级 Lv.4`, { icon: cake.id });
      return false;
    }
    const cost = cake.upgradeCosts[curLv];
    if ((saveData.bankStardust || 0) < cost) {
      audio.playGridBlocked();
      showToast('星尘不足，通关或刷新星级可获更多星尘', { icon: 'icon_stardust', tone: 'warn' });
      return false;
    }
    saveData.catcakeLevels[cake.tier] = curLv + 1;
    if (app.orderState && app.orderState.catcakeLevels) {
      app.orderState.catcakeLevels[cake.tier] = curLv + 1;
    }
    persistSave(true);
    audio.playShopBuy();
    showToast(`${cake.name} 升至 Lv.${curLv + 1}！`, { icon: cake.id, tone: 'success' });
    return true;
  };

  app.buyDeviceUpgrade = function buyDeviceUpgrade(devId) {
    const dev = SHOP_DEVICES.find((d) => d.id === devId);
    if (!dev) return false;
    const curLv = clamp(Math.floor(Number(saveData.deviceUpgrades && saveData.deviceUpgrades[dev.id]) || 0), 0, dev.maxLv);
    if (curLv >= dev.maxLv) {
      showToast(`${dev.name} 已达满级`, { icon: dev.icon });
      return false;
    }
    const cost = dev.costs[curLv];
    if ((saveData.bankStardust || 0) < cost) {
      audio.playGridBlocked();
      showToast('星尘不足，暂时无法升级该设备', { icon: 'icon_stardust', tone: 'warn' });
      return false;
    }
    saveData.deviceUpgrades[dev.id] = curLv + 1;
    if (app.orderState && dev.id === 'dev_tray') {
      app.orderState.devTrayLv = curLv + 1;
      if (curLv + 1 >= 1 && app.orderState.trayCapacity < 4) {
        app.orderState.trayCapacity = 4;
        while (app.orderState.tray.length < 4) app.orderState.tray.push(null);
      }
    }
    persistSave(true);
    audio.playShopBuy();
    showToast(`${dev.name} 升至 Lv.${curLv + 1}！`, { icon: dev.icon, tone: 'success' });
    return true;
  };

  app.buyPatron = function buyPatron(patronId) {
    const pid = normalizePatronId(patronId);
    const patron = PATRONS.find((p) => p.id === pid);
    if (!patron) return false;
    if (!Array.isArray(saveData.unlockedPatrons)) saveData.unlockedPatrons = ['mikan'];
    if (saveData.unlockedPatrons.includes(pid)) {
      return app.equipPatron(pid);
    }
    const cost = hasOwn(PATRON_COSTS, pid) ? PATRON_COSTS[pid] : patron.cost || 0;
    if ((saveData.bankStardust || 0) < cost) {
      audio.playGridBlocked();
      showToast('星尘不足，暂时无法邀请该搭档', { icon: 'icon_stardust', tone: 'warn' });
      return false;
    }
    saveData.unlockedPatrons.push(pid);
    saveData.selectedPatron = pid;
    app.currentPatronLine = patron.greet;
    persistSave(true);
    audio.playShopBuy();
    showToast(`成功邀请主厨搭档：${patron.name}！`, { icon: pid, tone: 'event', level: 'major' });
    return true;
  };

  app.equipPatron = function equipPatron(patronId) {
    const pid = normalizePatronId(patronId);
    const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
    if (!unlocked.includes(pid)) return false;
    saveData.selectedPatron = pid;
    const patron = PATRONS.find((p) => p.id === pid) || PATRONS[0];
    app.currentPatronLine = patron.greet;
    if (app.orderState) app.orderState.patronId = pid;
    persistSave(true);
    audio.playPatronSelect();
    showToast(`${patron.name} 已上阵待命`, { icon: pid });
    return true;
  };

  app.buyTheme = function buyTheme(themeId) {
    const th = typeof themeId === 'string' && hasOwn(BOARD_THEMES, themeId) ? BOARD_THEMES[themeId] : null;
    if (!th) return false;
    if (!Array.isArray(saveData.unlockedThemes)) saveData.unlockedThemes = ['amber'];
    if (saveData.unlockedThemes.includes(th.id)) {
      return app.equipTheme(th.id);
    }
    const cost = hasOwn(THEME_COSTS, th.id) ? THEME_COSTS[th.id] : th.cost || 0;
    if ((saveData.bankStardust || 0) < cost) {
      audio.playGridBlocked();
      showToast('星尘不足，暂时无法解锁该烤盘皮肤', { icon: 'icon_stardust', tone: 'warn' });
      return false;
    }
    saveData.unlockedThemes.push(th.id);
    saveData.equippedTheme = th.id;
    persistSave(true);
    audio.playShopBuy();
    showToast(`已解锁并装备：${th.name}！`, { icon: 'icon_ribbon', tone: 'event', level: 'major' });
    return true;
  };

  app.equipTheme = function equipTheme(themeId) {
    const th = typeof themeId === 'string' && hasOwn(BOARD_THEMES, themeId) ? BOARD_THEMES[themeId] : null;
    if (!th) return false;
    const unlocked = Array.isArray(saveData.unlockedThemes) ? saveData.unlockedThemes : ['amber'];
    if (!unlocked.includes(th.id)) return false;
    saveData.equippedTheme = th.id;
    persistSave(true);
    audio.playPatronSelect();
    showToast(`已换上烤盘皮肤：${th.name}`, { icon: 'icon_ribbon' });
    return true;
  };

  app.openCompendium = function openCompendium(tab = 'catcakes') {
    app.activeCompendiumTab = tab === 'recipes' ? 'recipes' : 'catcakes';
    app.activeModal = 'compendium';
    app.modalScrollY = 0;
    audio.playPatronSelect();
    syncAudioMood();
  };

  app.setCompendiumTab = function setCompendiumTab(tab) {
    app.activeCompendiumTab = tab === 'recipes' ? 'recipes' : 'catcakes';
    app.modalScrollY = 0;
    audio.playPatronSelect();
  };

  app.openLeaderboard = function openLeaderboard(boardType = 'stars') {
    const bt = boardType === 'score' ? 'score' : 'stars';
    app.leaderboardBoardType = bt;
    app.activeModal = 'leaderboard';
    app.modalScrollY = 0;
    audio.playPatronSelect();
    syncAudioMood();
    fetchLeaderboard(bt);
  };

  app.setLeaderboardBoardType = function setLeaderboardBoardType(boardType) {
    const bt = boardType === 'score' ? 'score' : 'stars';
    if (app.leaderboardBoardType !== bt) {
      app.modalScrollY = 0;
      audio.playPatronSelect();
    }
    fetchLeaderboard(bt);
  };

  app.cycleProfileAvatar = function cycleProfileAvatar() {
    const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
    const cur = normalizePatronId(saveData.playerProfile && saveData.playerProfile.avatarPreset);
    const next = unlocked[(unlocked.indexOf(cur) + 1) % unlocked.length] || 'mikan';
    if (!saveData.playerProfile) saveData.playerProfile = {};
    saveData.playerProfile.avatarPreset = next;
    persistSave(true);
    refreshOfflineLeaderboardFallback();
    audio.playPatronSelect();
    showToast('已切换名片头像', { icon: next });
  };

  app.applyPlayerProfileAuth = function applyPlayerProfileAuth(profilePatch) {
    if (!profilePatch || typeof profilePatch !== 'object') return;
    saveData.playerProfile = {
      ...(saveData.playerProfile || {}),
      nickName: profilePatch.nickName || saveData.playerProfile.nickName || '星夜店长',
      avatarUrl: profilePatch.avatarUrl || '',
      authorized: true
    };
    persistSave(true);
    if (CloudConfig.ENABLE_CLOUD_SYNC) {
      const reqEpoch = saveEpoch;
      platform
        .callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, {
          action: 'updateProfile',
          profile: saveData.playerProfile
        })
        .then(() => {
          if (!destroyed && reqEpoch === saveEpoch && app.activeModal === 'leaderboard') {
            fetchLeaderboard(app.leaderboardBoardType);
          }
        })
        .catch(() => {});
    } else {
      refreshOfflineLeaderboardFallback();
    }
    showToast('微信头像昵称同步成功！', { icon: 'icon_id_card', tone: 'success' });
  };

  app.onTapLeaderboardAuth = function onTapLeaderboardAuth() {
    const gObj = platform.getGlobal ? platform.getGlobal() : globalThis;
    const wxObj = gObj && hasOwn(gObj, 'wx') ? gObj.wx : null;
    const hasNativeUserInfoBtn = Boolean(
      platform.hasWx &&
        wxObj &&
        typeof wxObj === 'object' &&
        typeof wxObj.createUserInfoButton === 'function'
    );
    if (!hasNativeUserInfoBtn || inSyntheticClickHit) {
      saveData.playerProfile = {
        ...(saveData.playerProfile || {}),
        authorized: true
      };
      persistSave(true);
      refreshOfflineLeaderboardFallback();
      audio.playPatronSelect();
      showToast('已同步本地店长名片', { icon: 'icon_id_card' });
    }
  };

  // ==================== Modal & Level Lifecycle ====================

  function openLevelPreviewInternal(levelId) {
    const lvl = getLevelById(levelId);
    if (!lvl) return false;
    app.selectedChapter = lvl.chapter;
    app.previewLevelId = lvl.id;
    app.activeModal = 'level_preview';
    app.modalScrollY = 0;
    audio.playPatronSelect();
    syncAudioMood();
    return true;
  }

  app.openModal = function openModal(modalName) {
    const allowed = [
      'level_preview',
      'level_result',
      'shop',
      'compendium',
      'leaderboard',
      'pause',
      'help',
      'confirm'
    ];
    if (!allowed.includes(modalName)) return false;

    if (modalName === 'level_preview' && !getLevelById(app.previewLevelId)) {
      app.previewLevelId = saveData.highestUnlockedLevel || '1-1';
    }
    if (modalName === 'confirm' && !app.confirmDialog) {
      app.confirmDialog = {
        title: '返回选关确认',
        message: '确认结束本局营业并返回选关大厅吗？',
        confirmText: '确认返回',
        cancelText: '继续营业',
        onAccept: () => returnToLobbyInternal()
      };
    }

    app.activeModal = modalName;
    app.modalScrollY = 0;
    if (modalName === 'leaderboard') {
      fetchLeaderboard(app.leaderboardBoardType);
    }
    syncAudioMood();
    return true;
  };

  function returnToLobbyInternal() {
    app.activeModal = null;
    app.confirmDialog = null;
    app.screen = 'lobby';
    app.currentLevelId = null;
    app.gridState = null;
    app.orderState = null;
    app.activeTool = null;
    app.forkSourceCell = null;
    app.activeTutorialStep = null;
    app.tutorialSkipRect = null;
    levelSkipTutorial = false;
    autoServeTimer = 0;
    syncGameStateMirror();
    syncAudioMood();
  }

  app.closeModal = function closeModal() {
    if (!app.activeModal) return;
    const prevModal = app.activeModal;
    app.activeModal = null;
    app.confirmDialog = null;
    if (prevModal === 'level_result') {
      returnToLobbyInternal();
      return;
    }
    syncAudioMood();
  };

  app.togglePause = function togglePause() {
    if (app.screen !== 'playing') return;
    if (app.activeModal === 'pause') {
      app.closeModal();
    } else if (!app.activeModal) {
      app.activeTool = null;
      app.forkSourceCell = null;
      app.openModal('pause');
    }
  };

  app.onPauseReturnLobby = function onPauseReturnLobby() {
    if (app.orderState && (app.orderState.score || 0) > 0) {
      app.confirmDialog = {
        title: '返回选关确认',
        message: '当前营业尚未打烊结算，确认放弃本局分数返回选关大厅吗？',
        confirmText: '返回大厅',
        cancelText: '继续营业',
        onAccept: () => returnToLobbyInternal()
      };
      app.activeModal = 'confirm';
      syncAudioMood();
      return;
    }
    returnToLobbyInternal();
  };

  app.confirmCancel = function confirmCancel() {
    app.confirmDialog = null;
    if (app.screen === 'playing') {
      app.activeModal = 'pause';
    } else {
      app.activeModal = null;
    }
    syncAudioMood();
  };

  app.confirmAccept = function confirmAccept() {
    const fn = app.confirmDialog && app.confirmDialog.onAccept;
    app.confirmDialog = null;
    app.activeModal = null;
    if (typeof fn === 'function') {
      fn();
    } else {
      returnToLobbyInternal();
    }
    syncAudioMood();
  };

  app.onResultNext = function onResultNext() {
    const res = app.lastResult;
    if (!res || !res.cleared) {
      returnToLobbyInternal();
      return;
    }
    const nextId = getNextLevelId(res.levelId);
    if (!nextId) {
      returnToLobbyInternal();
      showToast('恭喜通关全部 30 关星夜吃茶战役！', { icon: 'icon_trophy', tone: 'event', level: 'major' });
      return;
    }
    const nextLvl = getLevelById(nextId);
    const unlockInfo = isLevelUnlocked(nextId, saveData.levelStars);
    if (unlockInfo.unlocked) {
      startLevelInternal(nextId, {});
    } else {
      returnToLobbyInternal();
      if (nextLvl) app.selectedChapter = nextLvl.chapter;
      showToast(unlockInfo.reason || '累计更多星数即可开启下一章', { icon: 'icon_stardust', tone: 'event', level: 'major' });
    }
  };

  // ==================== Onboarding Tutorial Helpers ====================

  function initTutorialForLevel(levelId, skipTutorial) {
    app.activeTutorialStep = null;
    app.tutorialSkipRect = null;
    tutorialAutoFadeTimer = 0;
    if (skipTutorial) return;
    const seen =
      saveData && typeof saveData.seenTutorials === 'object' && saveData.seenTutorials
        ? saveData.seenTutorials
        : {};
    if (levelId === '1-1' && !(hasOwn(seen, 'intro_slide') && seen.intro_slide)) {
      app.activeTutorialStep = 'intro_slide_1';
    } else if (levelId === '2-1' && !(hasOwn(seen, 'flavor_tile') && seen.flavor_tile)) {
      app.activeTutorialStep = 'flavor_tile';
    } else if (levelId === '3-1' && !(hasOwn(seen, 'ice_tile') && seen.ice_tile)) {
      app.activeTutorialStep = 'ice_tile';
    }
  }

  function completeTutorialSaveKey(saveKey) {
    if (!saveData.seenTutorials || typeof saveData.seenTutorials !== 'object') {
      saveData.seenTutorials = {
        intro_slide: false,
        tray_trash: false,
        flavor_tile: false,
        ice_tile: false
      };
    }
    if (!(hasOwn(saveData.seenTutorials, saveKey) && saveData.seenTutorials[saveKey])) {
      saveData.seenTutorials[saveKey] = true;
      persistSave(true);
    }
    app.activeTutorialStep = null;
    app.tutorialSkipRect = null;
    tutorialAutoFadeTimer = 0;
  }

  function skipCurrentTutorial() {
    const step =
      typeof app.activeTutorialStep === 'string' && hasOwn(TUTORIAL_STEPS, app.activeTutorialStep)
        ? TUTORIAL_STEPS[app.activeTutorialStep]
        : null;
    if (!step) {
      app.activeTutorialStep = null;
      app.tutorialSkipRect = null;
      return;
    }
    completeTutorialSaveKey(step.saveKey);
  }

  function maybeArmTrayTrashTutorial(forcedByFullTray = false) {
    if (levelSkipTutorial) return;
    if (app.currentLevelId !== '1-3' || app.activeTutorialStep) return;
    if (
      saveData.seenTutorials &&
      hasOwn(saveData.seenTutorials, 'tray_trash') &&
      saveData.seenTutorials.tray_trash
    ) {
      return;
    }
    if (!app.orderState) return;

    let filled = 0;
    const occupiedIndices = [];
    for (let i = 0; i < app.orderState.trayCapacity; i++) {
      if (app.orderState.tray[i]) {
        filled++;
        occupiedIndices.push(i);
      }
    }
    const anyReady = app.orderState.seats.some((s) => s && s.readyToServe);

    let seatedCount = 0;
    const matchedTraySet = new Set();
    for (let i = 0; i < app.orderState.seats.length; i++) {
      const seat = app.orderState.seats[i];
      if (!seat) continue;
      seatedCount++;
      const m = OrderService.matchCustomerWithTray(seat, app.orderState.tray);
      if (m && Array.isArray(m.usedTrayIndices)) {
        for (let k = 0; k < m.usedTrayIndices.length; k++) {
          matchedTraySet.add(m.usedTrayIndices[k]);
        }
      }
    }
    const hasUnmatchedPlacedTile =
      seatedCount > 0 && occupiedIndices.some((idx) => !matchedTraySet.has(idx));

    if (
      forcedByFullTray ||
      (filled >= 2 && !anyReady) ||
      (filled >= 1 && !anyReady && hasUnmatchedPlacedTile)
    ) {
      app.activeTutorialStep = 'tray_trash';
      tutorialAutoFadeTimer = 6.0;
    }
  }

  // ==================== Core Gameplay Mechanics ====================

  function getSpawnC2Rate() {
    const devFlourLv = clamp(
      Math.floor(Number(saveData.deviceUpgrades && saveData.deviceUpgrades.dev_flour) || 0),
      0,
      3
    );
    const baseRate = SHOP_DEVICES[1].c2Rates[devFlourLv] || 0.10;
    const lunaBonus = normalizePatronId(saveData.selectedPatron) === 'luna' ? 0.08 : 0;
    return clamp(baseRate + lunaBonus, 0.10, 0.50);
  }

  function buildServeScoreCtx() {
    // CRITICAL: Omit comboCount, isFever, and lunaNextServeBoost so OrderService.matchTrayToCustomer
    // computes nextCombo, reads feverActive, and atomically consumes lunaNextServeBoost!
    return {
      catcakeLevels: saveData.catcakeLevels,
      devTrayLv: (saveData.deviceUpgrades && saveData.deviceUpgrades.dev_tray) || 0,
      patronId: saveData.selectedPatron,
      rng: levelRng
    };
  }

  function refreshNeededAndOrderMarks() {
    if (!app.orderState) return;
    OrderService.refreshAllOrderMarks(app.orderState);
    app.neededTiers = OrderService.getNeededBoardTiers(app.orderState);
  }

  function checkAndArmAutoServe() {
    if (!app.orderState) return;
    refreshNeededAndOrderMarks();
    const hasReady = app.orderState.seats.some((s) => s && s.readyToServe);
    if (hasReady && autoServeTimer <= 0) {
      autoServeTimer = 0.10;
    } else if (!hasReady) {
      autoServeTimer = 0;
    }
  }

  function startLevelInternal(levelId, opts = {}) {
    const lvl = getLevelById(levelId);
    if (!lvl) return false;

    lastFrameMs = rawNowMs();
    levelRng = opts && typeof opts.rng === 'function' ? opts.rng : Math.random;
    app.selectedChapter = lvl.chapter;
    app.previewLevelId = lvl.id;
    app.currentLevelId = lvl.id;
    app.screen = 'playing';
    app.activeModal = null;
    app.confirmDialog = null;
    app.lastResult = null;
    app.activeTool = null;
    app.forkSourceCell = null;
    app.animState = createEmptyAnimState();

    const devToolsLv = clamp(
      Math.floor(Number(saveData.deviceUpgrades && saveData.deviceUpgrades.dev_tools) || 0),
      0,
      3
    );
    const startTools = SHOP_DEVICES[3].startTools[devToolsLv] || { fork: 1, spoon: 0 };
    app.toolCounts = { fork: startTools.fork, spoon: startTools.spoon };
    app.toolBoughtThisLevel = { fork: 0, spoon: 0 };

    const failStreak =
      saveData &&
      saveData.levelFailStreaks &&
      hasOwn(saveData.levelFailStreaks, lvl.id)
        ? Math.max(0, Math.floor(Number(saveData.levelFailStreaks[lvl.id]) || 0))
        : 0;
    const baseCharge = opts && opts.forceCharge ? 100 : 0;
    const softPityActive = failStreak >= 2 && baseCharge < 40;
    app.skillEnergy = softPityActive ? 40 : baseCharge;
    app.starPopTimers = [0, 0, 0];
    app.kneadPressTimer = 0;
    app.boardFullHintTimer = 0;

    kneadCooldown = 0;
    autoServeTimer = 0;
    lastCountdownTickInt = 6;
    unlockedStarsMask = 0;
    lastTrayTapSlot = -1;
    lastTrayTapTimeMs = -99999;
    runForkUses = 0;
    runSpoonUses = 0;

    const patron = PATRONS.find((p) => p.id === normalizePatronId(saveData.selectedPatron)) || PATRONS[0];
    app.playPatronSpeech = softPityActive
      ? '别灰心喵！已为你预充 40% 招牌技星能，加油营业吧！'
      : patron.greet;

    const modeOverrides =
      opts && opts.modeOverrides && typeof opts.modeOverrides === 'object'
        ? opts.modeOverrides
        : null;
    app.gridState = GridEngine.createGridState(lvl, lvl.presets);
    app.orderState = OrderService.createOrderState(lvl, saveData, levelRng, modeOverrides);
    refreshNeededAndOrderMarks();
    levelSkipTutorial = Boolean(opts && opts.skipTutorial);
    initTutorialForLevel(lvl.id, levelSkipTutorial);

    if (softPityActive) {
      showToast('暖心应援：本局初始招牌技充能 +40%', {
        icon: patron.id,
        tone: 'success'
      });
    }

    syncGameStateMirror();
    syncAudioMood();
    audio.playStartCafe();
    return true;
  }

  app.startLevel = function startLevel(levelId, opts = {}) {
    return startLevelInternal(levelId, opts);
  };

  function executeSlide(dir) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.gridState || !app.orderState) {
      return {
        moved: false,
        mergeEvents: [],
        moveEvents: [],
        brokenIceCells: [],
        spawned: null,
        skillChargeGain: 0,
        reason: 'not_playing'
      };
    }
    if (app.activeTool !== null) {
      audio.playGridBlocked();
      showToast('请先完成厨具点选，或再次点击厨具按钮取消', { icon: app.activeTool === 'fork' ? 'tool_fork' : 'tool_spoon' });
      return {
        moved: false,
        mergeEvents: [],
        moveEvents: [],
        brokenIceCells: [],
        spawned: null,
        skillChargeGain: 0,
        reason: 'tool_armed'
      };
    }

    const res = GridEngine.slideGrid(app.gridState, dir, {
      c2Rate: getSpawnC2Rate(),
      rng: levelRng
    });

    if (!res.moved) {
      app.animState.blockedShake = { dir, timer: 0.09, duration: 0.09 };
      audio.playGridBlocked();
      if (!GridEngine.canAnyMove(app.gridState)) {
        app.boardFullHintTimer = 2.0;
        showToast('烤盘已满！单击猫饼装入托盘或使用移位叉调整盘格', { icon: 'icon_warn', tone: 'warn' });
      }
      return res;
    }

    audio.playGridSlide();
    app.animState.slide = {
      dir,
      timer: 0.11,
      duration: 0.11,
      moves: res.moveEvents || []
    };

    if (res.mergeEvents && res.mergeEvents.length > 0) {
      app.animState.mergeEvents = res.mergeEvents;
      app.animState.mergeTimer = 0.22;
      app.animState.mergeDuration = 0.22;

      let maxMergedTier = 2;
      let hasGoldMerge = false;
      for (let i = 0; i < res.mergeEvents.length; i++) {
        const me = res.mergeEvents[i];
        const nt = me.newTier || me.tier || 2;
        if (nt > maxMergedTier) maxMergedTier = nt;
        if (me.flavor === 'gold') hasGoldMerge = true;
      }
      audio.playMerge(maxMergedTier, res.mergeEvents.length, maxMergedTier >= 6);
      if (hasGoldMerge) audio.playGoldenMerge();

      if (app.activeTutorialStep === 'intro_slide_1') {
        app.activeTutorialStep = 'intro_slide_2';
      }
    }

    if (res.spawned && Number.isInteger(res.spawned.r) && Number.isInteger(res.spawned.c)) {
      app.animState.cellFX.push({
        r: res.spawned.r,
        c: res.spawned.c,
        kind: 'spawn',
        timer: 0.13,
        duration: 0.13
      });
    }

    if (res.brokenIceCells && res.brokenIceCells.length > 0) {
      app.animState.brokenIceCells = res.brokenIceCells;
      app.animState.iceTimer = 0.22;
      app.animState.iceDuration = 0.22;
      audio.playIceShatter();
      if (app.activeTutorialStep === 'ice_tile') {
        completeTutorialSaveKey('ice_tile');
      }
    }

    if (app.activeTutorialStep === 'flavor_tile') {
      let dyedMatcha = false;
      for (let r = 0; r < app.gridState.rows; r++) {
        for (let c = 0; c < app.gridState.cols; c++) {
          const cell = app.gridState.cells[r][c];
          if (cell && cell.type === 'matcha' && cell.tile && cell.tile.flavor === 'matcha') {
            dyedMatcha = true;
          }
        }
      }
      if (!dyedMatcha && res.mergeEvents) {
        dyedMatcha = res.mergeEvents.some((m) => m && m.flavor === 'matcha');
      }
      if (dyedMatcha) {
        completeTutorialSaveKey('flavor_tile');
      }
    }

    if (res.skillChargeGain > 0) {
      app.skillEnergy = clamp(app.skillEnergy + res.skillChargeGain, 0, 100);
    }

    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    return res;
  }

  function executeKnead(bypassCooldown = false) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.gridState || !app.orderState) {
      return { spawned: false, reason: 'not_playing' };
    }
    if (!bypassCooldown && kneadCooldown > 0) {
      return { spawned: false, reason: 'cooldown' };
    }

    const res = GridEngine.kneadSpawn(app.gridState, {
      c2Rate: getSpawnC2Rate(),
      rng: levelRng
    });

    app.kneadPressTimer = 0.11;
    if (!res.spawned) {
      audio.playGridBlocked();
      app.boardFullHintTimer = 1.8;
      showToast('烤盘已无空格，先装盘或合成腾出位置吧', { icon: 'icon_warn', tone: 'warn' });
      return res;
    }

    if (!bypassCooldown) {
      kneadCooldown = 0.12;
    }
    audio.playKneadSpawn();
    app.animState.cellFX.push({
      r: res.r,
      c: res.c,
      kind: 'knead',
      timer: 0.13,
      duration: 0.13
    });

    if (app.activeTutorialStep === 'intro_slide_2') {
      app.activeTutorialStep = 'intro_slide_3';
    } else if (app.activeTutorialStep === 'flavor_tile' && res.tile && res.tile.flavor === 'matcha') {
      completeTutorialSaveKey('flavor_tile');
    }

    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    return res;
  }

  app.onTapKneadButton = function onTapKneadButton() {
    executeKnead(false);
  };

  function cellCenterScreenPos(r, c) {
    const lay = app.currentBoardLayout;
    if (!lay) return { x: metrics.width * 0.5, y: metrics.height * 0.5 };
    return {
      x: lay.gridX + (c + 0.5) * lay.cellSize,
      y: lay.gridY + (r + 0.5) * lay.cellSize
    };
  }

  function traySlotCenterPos(slotIdx) {
    const gt = app.guideTargets;
    if (gt && Array.isArray(gt.traySlots) && gt.traySlots[slotIdx]) {
      const s = gt.traySlots[slotIdx];
      return { x: s.x + s.w * 0.5, y: s.y + s.h * 0.5 };
    }
    return { x: metrics.width * 0.4, y: 180 };
  }

  function seatCenterPos(seatIdx) {
    const gt = app.guideTargets;
    if (gt && Array.isArray(gt.seats) && gt.seats[seatIdx]) {
      const s = gt.seats[seatIdx];
      return { x: s.x + s.w * 0.5, y: s.y + s.h * 0.45 };
    }
    return { x: metrics.width * 0.5, y: 100 };
  }

  function executeTapBoardCell(r, c) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.gridState || !app.orderState) {
      return { placed: false, slotIdx: -1, tile: null, reason: 'not_playing' };
    }
    if (app.activeTool !== null) {
      const toolRes = applyToolInternal(app.activeTool, r, c, false);
      return { placed: false, slotIdx: -1, tile: null, toolResult: toolRes, reason: 'tool_used' };
    }

    if (
      !Number.isInteger(r) ||
      !Number.isInteger(c) ||
      r < 0 ||
      r >= app.gridState.rows ||
      c < 0 ||
      c >= app.gridState.cols
    ) {
      audio.playGridBlocked();
      return { placed: false, slotIdx: -1, tile: null, reason: 'out_of_bounds' };
    }

    const cell = app.gridState.cells[r][c];
    if (!cell || cell.type === 'void' || cell.type === 'block') {
      audio.playGridBlocked();
      return { placed: false, slotIdx: -1, tile: null, reason: 'invalid_cell' };
    }
    if (!cell.tile) {
      audio.playGridBlocked();
      return { placed: false, slotIdx: -1, tile: null, reason: 'empty_cell' };
    }
    if ((cell.tile.frozenHp || 0) > 0) {
      audio.playGridBlocked();
      app.animState.blockedShake = { dir: 'left', timer: 0.09, duration: 0.09 };
      showToast('冰封猫饼无法直接装盘，请在相邻格合成破冰！', { icon: 'tile_ice', tone: 'warn' });
      return { placed: false, slotIdx: -1, tile: null, reason: 'frozen_tile' };
    }

    const tileSnap = {
      uid: cell.tile.uid,
      tier: cell.tile.tier,
      flavor: cell.tile.flavor
    };
    const trayRes = OrderService.tryPlaceToTray(app.orderState, tileSnap);
    if (!trayRes.placed) {
      audio.playGridBlocked();
      app.animState.trashWobbleTimer = 0.65;
      if ((app.orderState.trashCooldown || 0) > 1e-6) {
        showToast('配餐托盘已满且厨余篮冷却中，可用移位叉腾挪盘格！', {
          icon: 'tool_fork',
          tone: 'warn'
        });
      } else {
        showToast('配餐托盘已满！快速双击托盘槽位可丢进厨余篮（冷却 8s）', {
          icon: 'btn_trash',
          tone: 'warn'
        });
      }
      maybeArmTrayTrashTutorial(true);
      return { placed: false, slotIdx: -1, tile: null, reason: trayRes.reason || 'tray_full' };
    }

    GridEngine.removeTileAt(app.gridState, r, c, { allowShatterIce: false });

    const fromPt = cellCenterScreenPos(r, c);
    const toPt = traySlotCenterPos(trayRes.slotIdx);
    app.animState.flyingSprites.push({
      kind: 'board_to_tray',
      tier: tileSnap.tier,
      flavor: tileSnap.flavor,
      fromX: fromPt.x,
      fromY: fromPt.y,
      toX: toPt.x,
      toY: toPt.y,
      timer: 0.16,
      duration: 0.16
    });

    audio.playTrayPlace();
    platform.vibrateShort('light');
    checkAndArmAutoServe();
    maybeArmTrayTrashTutorial(false);
    syncGameStateMirror();

    return {
      placed: true,
      slotIdx: trayRes.slotIdx,
      tile: tileSnap
    };
  }

  function executeDiscardTraySlot(slotIdx, opts = undefined) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.orderState) {
      return { discarded: false, tile: null, reason: 'not_playing' };
    }
    const fromPt = traySlotCenterPos(slotIdx);
    const gt = app.guideTargets;
    const trashPt =
      gt && gt.trashBtn
        ? { x: gt.trashBtn.x + gt.trashBtn.w * 0.5, y: gt.trashBtn.y + gt.trashBtn.h * 0.5 }
        : { x: metrics.width - 42, y: fromPt.y };

    const res = OrderService.discardTraySlot(app.orderState, slotIdx, opts);
    if (!res.discarded) {
      if (res.reason === 'cooldown') {
        audio.playGridBlocked();
        app.animState.trashWobbleTimer = 0.45;
        const secTxt = Math.max(0.1, Number(res.cooldownLeft) || 0).toFixed(1);
        showToast(`厨余篮整理中（剩余 ${secTxt}s）`, { icon: 'btn_trash', tone: 'warn' });
      }
      return res;
    }

    if (res.tile) {
      app.animState.flyingSprites.push({
        kind: 'tray_to_trash',
        tier: res.tile.tier,
        flavor: res.tile.flavor,
        fromX: fromPt.x,
        fromY: fromPt.y,
        toX: trashPt.x,
        toY: trashPt.y,
        timer: 0.18,
        duration: 0.18
      });
    }
    app.animState.trashPuffTimer = 0.18;
    app.animState.trayHintSlot = -1;
    app.animState.trayHintTimer = 0;
    if ((res.prevCombo || 0) >= 2 && TRASH_CONFIG.resetCombo) {
      app.animState.comboBreakTimer = 0.45;
    }

    audio.playTrayTrash();
    if (app.activeTutorialStep === 'tray_trash') {
      completeTutorialSaveKey('tray_trash');
    }
    checkAndArmAutoServe();
    syncGameStateMirror();
    return res;
  }

  app.handleTraySlotTap = function handleTraySlotTap(slotIdx) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.orderState) return;
    const tile = app.orderState.tray[slotIdx];
    if (!tile) return;

    const nowMs = getEffectiveNowMs();
    if (lastTrayTapSlot === slotIdx && nowMs - lastTrayTapTimeMs <= 320) {
      lastTrayTapSlot = -1;
      lastTrayTapTimeMs = -99999;
      executeDiscardTraySlot(slotIdx);
      return;
    }

    lastTrayTapSlot = slotIdx;
    lastTrayTapTimeMs = nowMs;
    app.animState.trayHintSlot = slotIdx;
    app.animState.trayHintTimer = 0.28;
    if ((app.orderState.trashCooldown || 0) > 1e-6) {
      const leftTxt = Math.max(0.1, Number(app.orderState.trashCooldown) || 0).toFixed(1);
      showToast(`厨余篮整理中（剩余 ${leftTxt}s），冷却完毕后可双击丢弃`, {
        icon: 'btn_trash',
        tone: 'warn'
      });
    } else {
      showToast('再次快速点击该槽位即可丢进厨余篮（冷却 8s，断连击）', { icon: 'btn_trash' });
    }
  };

  app.handleTrashBtnTap = function handleTrashBtnTap() {
    if (app.screen !== 'playing' || app.activeModal !== null) return;
    if (app.activeTool === 'fork' && app.forkSourceCell) {
      const src = app.forkSourceCell;
      return applyToolInternal('fork', src.r, src.c, false, undefined, undefined, {
        discardToTrash: true
      });
    }
    app.animState.trashWobbleTimer = 0.45;
    if (app.orderState && (app.orderState.trashCooldown || 0) > 1e-6) {
      const secTxt = Math.max(0.1, Number(app.orderState.trashCooldown) || 0).toFixed(1);
      showToast(`厨余篮整理中（剩余 ${secTxt}s），可用移位叉挑起盘格直接销毁`, {
        icon: 'btn_trash',
        tone: 'warn'
      });
      return;
    }
    showToast('快速双击托盘猫饼可丢进厨余篮（冷却 8s，断连击但 0 扣分）', { icon: 'btn_trash' });
  };

  app.selectCustomerSeat = function selectCustomerSeat(seatIdx) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.orderState) return false;
    const seat = app.orderState.seats[seatIdx];
    if (!seat) return false;
    app.orderState.preferredSeatIdx =
      app.orderState.preferredSeatIdx === seatIdx ? null : seatIdx;
    audio.playPatronSelect();
    checkAndArmAutoServe();
    return true;
  };

  // ==================== Utensils & Patron Active Skills ====================

  function tryEmergencyPurchaseTool(kind) {
    const def = typeof kind === 'string' && hasOwn(TOOLS, kind) ? TOOLS[kind] : null;
    if (!def) return { ok: false, reason: 'invalid_tool' };
    if ((app.toolBoughtThisLevel[kind] || 0) >= def.maxBuyPerLevel) {
      return { ok: false, reason: 'limit_reached' };
    }
    if ((saveData.bankStardust || 0) < def.cost) {
      return { ok: false, reason: 'insufficient_stardust' };
    }
    saveData.consumableSpentStardust = (saveData.consumableSpentStardust || 0) + def.cost;
    persistSave(true);
    app.toolBoughtThisLevel[kind] = (app.toolBoughtThisLevel[kind] || 0) + 1;
    app.toolCounts[kind] = (app.toolCounts[kind] || 0) + 1;
    audio.playShopBuy();
    return { ok: true };
  }

  function validateToolTargetCell(kind, r, c) {
    if (
      !Number.isInteger(r) ||
      !Number.isInteger(c) ||
      r < 0 ||
      r >= app.gridState.rows ||
      c < 0 ||
      c >= app.gridState.cols
    ) {
      return { valid: false, reason: 'out_of_bounds' };
    }
    const row = app.gridState.cells && app.gridState.cells[r];
    const cell = row && row[c];
    if (!cell || cell.type === 'void' || cell.type === 'block') {
      return { valid: false, reason: 'unplayable_cell' };
    }
    if (!cell.tile || typeof cell.tile !== 'object') {
      return { valid: false, reason: 'empty_cell' };
    }
    if (kind === 'spoon') {
      if ((cell.tile.frozenHp || 0) > 0) {
        return { valid: false, reason: 'tile_frozen' };
      }
      const tier = Number(cell.tile.tier);
      if (!Number.isInteger(tier) || tier < 1 || tier >= 7) {
        return { valid: false, reason: 'max_tier' };
      }
    }
    return { valid: true };
  }

  function validateForkCommitTarget(fromR, fromC, toR, toC, discardToTrash) {
    const srcCheck = validateToolTargetCell('fork', fromR, fromC);
    if (!srcCheck.valid) return srcCheck;

    const srcCell = app.gridState.cells[fromR][fromC];
    const srcFrozen = (srcCell.tile.frozenHp || 0) > 0;

    if (discardToTrash) {
      if (srcFrozen) return { valid: false, reason: 'source_frozen' };
      return { valid: true };
    }

    if (toR === undefined || toR === null) {
      if (!srcFrozen) return { valid: false, reason: 'missing_destination' };
      return { valid: true };
    }

    if (srcFrozen) {
      return { valid: false, reason: 'source_frozen' };
    }
    if (
      !Number.isInteger(toR) ||
      !Number.isInteger(toC) ||
      toR < 0 ||
      toR >= app.gridState.rows ||
      toC < 0 ||
      toC >= app.gridState.cols
    ) {
      return { valid: false, reason: 'out_of_bounds' };
    }
    if (toR === fromR && toC === fromC) {
      return { valid: false, reason: 'same_cell' };
    }
    const destRow = app.gridState.cells && app.gridState.cells[toR];
    const destCell = destRow && destRow[toC];
    if (!destCell || destCell.type === 'void' || destCell.type === 'block') {
      return { valid: false, reason: 'unplayable_dest' };
    }
    if (destCell.tile && (destCell.tile.frozenHp || 0) > 0) {
      return { valid: false, reason: 'dest_frozen' };
    }
    return { valid: true };
  }

  app.onTapToolButton = function onTapToolButton(kind) {
    if (app.screen !== 'playing' || app.activeModal !== null) return false;
    if (kind !== 'fork' && kind !== 'spoon') return false;

    if (app.activeTool === kind) {
      app.activeTool = null;
      app.forkSourceCell = null;
      audio.playPatronSelect();
      return true;
    }

    if ((app.toolCounts[kind] || 0) <= 0) {
      const buyRes = tryEmergencyPurchaseTool(kind);
      if (!buyRes.ok) {
        audio.playGridBlocked();
        showToast(
          buyRes.reason === 'limit_reached'
            ? '本关该厨具应急购买次数已用完（限1次）'
            : `星尘不足（需 ${TOOLS[kind].cost} 星尘）`,
          { icon: TOOLS[kind].icon, tone: 'warn' }
        );
        return false;
      }
      showToast(`已应急补充 1 把${TOOLS[kind].shortName}，请点选目标猫饼`, {
        icon: TOOLS[kind].icon,
        tone: 'success'
      });
    }

    app.activeTool = kind;
    app.forkSourceCell = null;
    audio.playPatronSelect();
    return true;
  };

  function commitForkExecution(fromR, fromC, toR, toC, discardToTrash, allowAutoPurchase) {
    const check = validateForkCommitTarget(fromR, fromC, toR, toC, discardToTrash);
    if (!check.valid) {
      if (
        !allowAutoPurchase &&
        app.forkSourceCell !== null &&
        toR !== undefined &&
        toR !== null &&
        !discardToTrash
      ) {
        audio.playGridBlocked();
        app.animState.blockedShake = { dir: 'left', timer: 0.09, duration: 0.09 };
        showToast('该位置不可落子，请点选空白格、非冰封猫饼或上方厨余篮', {
          icon: 'tool_fork',
          tone: 'warn'
        });
        return { ok: false, applied: false, kind: 'fork', reason: check.reason };
      }
      app.activeTool = null;
      app.forkSourceCell = null;
      audio.playGridBlocked();
      showToast('移位叉操作无效，请点选有效猫饼与目标落点', {
        icon: 'tool_fork',
        tone: 'warn'
      });
      return {
        ok: false,
        applied: false,
        kind: 'fork',
        removed: false,
        shatteredIce: false,
        tile: null,
        reason: check.reason
      };
    }

    if ((app.toolCounts.fork || 0) <= 0) {
      if (allowAutoPurchase) {
        const buyRes = tryEmergencyPurchaseTool('fork');
        if (!buyRes.ok) {
          app.activeTool = null;
          app.forkSourceCell = null;
          return { ok: false, applied: false, kind: 'fork', reason: buyRes.reason };
        }
      } else {
        app.activeTool = null;
        app.forkSourceCell = null;
        return { ok: false, applied: false, kind: 'fork', reason: 'no_charges' };
      }
    }

    const srcTileBefore =
      app.gridState.cells[fromR] &&
      app.gridState.cells[fromR][fromC] &&
      app.gridState.cells[fromR][fromC].tile
        ? {
            tier: app.gridState.cells[fromR][fromC].tile.tier,
            flavor: app.gridState.cells[fromR][fromC].tile.flavor
          }
        : null;

    const res = GridEngine.applyForkAction(
      app.gridState,
      fromR,
      fromC,
      toR,
      toC,
      discardToTrash ? { discardToTrash: true } : {}
    );
    app.activeTool = null;
    app.forkSourceCell = null;

    if (!res || !res.applied) {
      audio.playGridBlocked();
      showToast('移位叉操作未生效，请重试', { icon: 'tool_fork', tone: 'warn' });
      return { ok: false, applied: false, kind: 'fork', ...(res || {}) };
    }

    app.toolCounts.fork = Math.max(0, app.toolCounts.fork - 1);
    runForkUses += 1;

    const fromPt = cellCenterScreenPos(fromR, fromC);
    if (res.mode === 'shatter_ice') {
      app.animState.brokenIceCells = [{ r: fromR, c: fromC }];
      app.animState.iceTimer = 0.22;
      audio.playIceShatter();
      if (app.activeTutorialStep === 'ice_tile') {
        completeTutorialSaveKey('ice_tile');
      }
      if (
        app.activeTutorialStep === 'flavor_tile' &&
        res.tile &&
        res.tile.flavor === 'matcha'
      ) {
        completeTutorialSaveKey('flavor_tile');
      }
    } else if (res.mode === 'trash') {
      const gt = app.guideTargets;
      const trashPt =
        gt && gt.trashBtn
          ? { x: gt.trashBtn.x + gt.trashBtn.w * 0.5, y: gt.trashBtn.y + gt.trashBtn.h * 0.5 }
          : { x: metrics.width - 42, y: fromPt.y };
      const rt = res.removedTile || srcTileBefore;
      if (rt) {
        app.animState.flyingSprites.push({
          kind: 'board_to_trash',
          tier: rt.tier,
          flavor: rt.flavor,
          fromX: fromPt.x,
          fromY: fromPt.y,
          toX: trashPt.x,
          toY: trashPt.y,
          timer: 0.20,
          duration: 0.20
        });
      }
      app.animState.trashPuffTimer = 0.20;
      audio.playTrayTrash();
      showToast('已用移位叉将猫饼叉入厨余篮销毁', { icon: 'tool_fork' });
    } else if (res.mode === 'move') {
      const toPt = cellCenterScreenPos(toR, toC);
      if (res.tile) {
        app.animState.flyingSprites.push({
          kind: 'board_to_board',
          tier: res.tile.tier,
          flavor: res.tile.flavor,
          destR: toR,
          destC: toC,
          fromX: fromPt.x,
          fromY: fromPt.y,
          toX: toPt.x,
          toY: toPt.y,
          timer: 0.18,
          duration: 0.18
        });
      }
      audio.playTool('fork');
      if (
        app.activeTutorialStep === 'flavor_tile' &&
        res.tile &&
        res.tile.flavor === 'matcha'
      ) {
        completeTutorialSaveKey('flavor_tile');
      }
    } else if (res.mode === 'swap') {
      const toPt = cellCenterScreenPos(toR, toC);
      if (res.tile) {
        app.animState.flyingSprites.push({
          kind: 'board_to_board',
          tier: res.tile.tier,
          flavor: res.tile.flavor,
          destR: toR,
          destC: toC,
          fromX: fromPt.x,
          fromY: fromPt.y,
          toX: toPt.x,
          toY: toPt.y,
          timer: 0.18,
          duration: 0.18
        });
      }
      if (res.swappedTile) {
        app.animState.flyingSprites.push({
          kind: 'board_to_board',
          tier: res.swappedTile.tier,
          flavor: res.swappedTile.flavor,
          destR: fromR,
          destC: fromC,
          fromX: toPt.x,
          fromY: toPt.y,
          toX: fromPt.x,
          toY: fromPt.y,
          timer: 0.18,
          duration: 0.18
        });
      }
      audio.playTool('fork');
      if (
        app.activeTutorialStep === 'flavor_tile' &&
        ((res.tile && res.tile.flavor === 'matcha') ||
          (res.swappedTile && res.swappedTile.flavor === 'matcha'))
      ) {
        completeTutorialSaveKey('flavor_tile');
      }
    } else if (res.mode === 'merge') {
      const toPt = cellCenterScreenPos(toR, toC);
      if (srcTileBefore) {
        app.animState.flyingSprites.push({
          kind: 'board_to_board',
          tier: srcTileBefore.tier,
          flavor: srcTileBefore.flavor,
          fromX: fromPt.x,
          fromY: fromPt.y,
          toX: toPt.x,
          toY: toPt.y,
          timer: 0.12,
          duration: 0.12
        });
      }
      const newTier = res.tile ? res.tile.tier : 2;
      const newFlavor = res.tile ? res.tile.flavor : 'plain';
      app.animState.mergeEvents = [{ r: toR, c: toC, newTier, flavor: newFlavor }];
      app.animState.mergeTimer = 0.22;
      app.animState.mergeDuration = 0.22;
      audio.playMerge(newTier, 1, newTier >= 6);
      if (newFlavor === 'gold') audio.playGoldenMerge();

      if (res.brokenIceCells && res.brokenIceCells.length > 0) {
        app.animState.brokenIceCells = res.brokenIceCells;
        app.animState.iceTimer = 0.22;
        app.animState.iceDuration = 0.22;
        audio.playIceShatter();
        if (app.activeTutorialStep === 'ice_tile') {
          completeTutorialSaveKey('ice_tile');
        }
      }
      if (res.skillChargeGain > 0) {
        app.skillEnergy = clamp(app.skillEnergy + res.skillChargeGain, 0, 100);
      }
      if (app.activeTutorialStep === 'flavor_tile' && newFlavor === 'matcha') {
        completeTutorialSaveKey('flavor_tile');
      }
    }

    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    return { ok: true, applied: true, kind: 'fork', ...res };
  }

  function applyToolInternal(
    kind,
    r,
    c,
    allowAutoPurchase = false,
    r2 = undefined,
    c2 = undefined,
    extraOpts = null
  ) {
    if (
      app.screen !== 'playing' ||
      app.activeModal !== null ||
      !app.gridState ||
      !app.orderState
    ) {
      return { ok: false, applied: false, reason: 'not_playing' };
    }
    if (kind !== 'fork' && kind !== 'spoon') {
      return { ok: false, applied: false, reason: 'invalid_tool' };
    }

    if (kind === 'fork') {
      const optDiscard = Boolean(
        r2 === 'trash' ||
          (r2 && typeof r2 === 'object' && r2.discardToTrash) ||
          (c2 && typeof c2 === 'object' && c2.discardToTrash) ||
          (extraOpts && typeof extraOpts === 'object' && extraOpts.discardToTrash)
      );
      if (optDiscard) {
        return commitForkExecution(r, c, undefined, undefined, true, allowAutoPurchase);
      }

      if (typeof r2 === 'number' && typeof c2 === 'number') {
        return commitForkExecution(r, c, r2, c2, false, allowAutoPurchase);
      }

      if (app.forkSourceCell !== null) {
        const src = app.forkSourceCell;
        const srcCheck = validateToolTargetCell('fork', src.r, src.c);
        if (
          !srcCheck.valid ||
          (app.gridState.cells[src.r][src.c].tile.frozenHp || 0) > 0
        ) {
          app.forkSourceCell = null;
        } else if (r === src.r && c === src.c) {
          app.forkSourceCell = null;
          audio.playPatronSelect();
          showToast('已放下猫饼，请重新点选起点猫饼或冰封格', { icon: 'tool_fork' });
          return {
            ok: true,
            applied: false,
            cancelledSource: true,
            step: 1,
            kind: 'fork'
          };
        } else {
          return commitForkExecution(src.r, src.c, r, c, false, allowAutoPurchase);
        }
      }

      const targetCheck = validateToolTargetCell('fork', r, c);
      if (!targetCheck.valid) {
        app.activeTool = null;
        app.forkSourceCell = null;
        audio.playGridBlocked();
        showToast('移位叉需先点选有猫饼或冰封的盘格', { icon: 'tool_fork', tone: 'warn' });
        return {
          ok: false,
          applied: false,
          kind: 'fork',
          removed: false,
          shatteredIce: false,
          tile: null,
          reason: targetCheck.reason
        };
      }

      const clickedTile = app.gridState.cells[r][c].tile;
      if ((clickedTile.frozenHp || 0) > 0) {
        return commitForkExecution(r, c, undefined, undefined, false, allowAutoPurchase);
      }

      if ((app.toolCounts.fork || 0) <= 0) {
        if (allowAutoPurchase) {
          const buyRes = tryEmergencyPurchaseTool('fork');
          if (!buyRes.ok) {
            app.activeTool = null;
            app.forkSourceCell = null;
            return { ok: false, applied: false, kind: 'fork', reason: buyRes.reason };
          }
        } else {
          app.activeTool = null;
          app.forkSourceCell = null;
          return { ok: false, applied: false, kind: 'fork', reason: 'no_charges' };
        }
      }

      app.activeTool = 'fork';
      app.forkSourceCell = { r, c };
      audio.playPatronSelect();
      showToast('已挑起猫饼：点选落点移位/互换/合并，或点厨余篮销毁', { icon: 'tool_fork' });
      return {
        ok: true,
        applied: false,
        armed: true,
        step: 2,
        kind: 'fork',
        forkSourceCell: { r, c }
      };
    }

    // kind === 'spoon'
    app.forkSourceCell = null;
    const targetCheck = validateToolTargetCell('spoon', r, c);
    if (!targetCheck.valid) {
      app.activeTool = null;
      audio.playGridBlocked();
      showToast('升阶勺仅可对 1~6 阶非冰封猫饼使用', { icon: 'tool_spoon', tone: 'warn' });
      return {
        ok: false,
        applied: false,
        kind: 'spoon',
        upgraded: false,
        tile: null,
        skillChargeGain: 0,
        reason: targetCheck.reason
      };
    }

    if ((app.toolCounts.spoon || 0) <= 0) {
      if (allowAutoPurchase) {
        const buyRes = tryEmergencyPurchaseTool('spoon');
        if (!buyRes.ok) {
          app.activeTool = null;
          return { ok: false, applied: false, reason: buyRes.reason };
        }
      } else {
        app.activeTool = null;
        return { ok: false, applied: false, reason: 'no_charges' };
      }
    }

    const res = GridEngine.upgradeTileAt(app.gridState, r, c);
    app.activeTool = null;
    if (!res.upgraded) {
      audio.playGridBlocked();
      showToast('升阶勺仅可对 1~6 阶非冰封猫饼使用', { icon: 'tool_spoon', tone: 'warn' });
      return { ok: false, applied: false, kind: 'spoon', ...res };
    }
    app.toolCounts.spoon = Math.max(0, app.toolCounts.spoon - 1);
    runSpoonUses += 1;
    if (res.skillChargeGain > 0) {
      app.skillEnergy = clamp(app.skillEnergy + res.skillChargeGain, 0, 100);
    }
    app.animState.mergeEvents = [{ r, c, newTier: res.tile ? res.tile.tier : 2 }];
    app.animState.mergeTimer = 0.22;
    audio.playTool('spoon');
    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    return { ok: true, applied: true, kind: 'spoon', ...res };
  }

  function executeCastPatronSkill(opts = {}) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.gridState || !app.orderState) {
      return { casted: false, ok: false, reason: 'not_playing' };
    }
    const force = Boolean(opts && opts.forceCharge);
    if (app.skillEnergy < 100 && !force) {
      audio.playGridBlocked();
      showToast(`招牌技充能 ${Math.floor(app.skillEnergy)}%，满 100% 即可释放`, { icon: 'icon_stardust' });
      return { casted: false, ok: false, reason: 'not_charged', skillEnergy: app.skillEnergy };
    }

    const patronId = normalizePatronId(saveData.selectedPatron);
    const patron = PATRONS.find((p) => p.id === patronId) || PATRONS[0];
    app.skillEnergy = 0;
    app.activeTool = null;
    app.forkSourceCell = null;
    audio.playChefSkill(patronId);
    app.playPatronSpeech = patron.thanks;

    let res = {};
    if (patronId === 'mikan') {
      res = OrderService.applyMikanComfortTea(app.orderState);
      showToast('小蜜柑：安抚猫薄荷茶！全座耐心 +45% 并冻结 5 秒', {
        icon: 'mikan',
        tone: 'event',
        level: 'major'
      });
    } else if (patronId === 'luna') {
      res = GridEngine.applyLunaBoardTidy(app.gridState);
      app.orderState.lunaNextServeBoost = true;
      showToast('眠眠星兔：星月整盘术！清空 1 阶且下一单 ×1.50', {
        icon: 'luna',
        tone: 'event',
        level: 'major'
      });
    } else {
      res = GridEngine.applyMugiBoardBlast(app.gridState, levelRng);
      if (res.shatteredCells && res.shatteredCells.length > 0) {
        app.animState.brokenIceCells = res.shatteredCells;
        app.animState.iceTimer = 0.22;
        audio.playIceShatter();
        if (app.activeTutorialStep === 'ice_tile') {
          completeTutorialSaveKey('ice_tile');
        }
      }
      if (res.upgradedCells && res.upgradedCells.length > 0) {
        app.animState.mergeEvents = res.upgradedCells;
        app.animState.mergeTimer = 0.22;
      }
      showToast('蜂蜜柴柴：元气烤炉暴击！全盘破冰并镀金升阶', {
        icon: 'mugi',
        tone: 'event',
        level: 'major'
      });
    }

    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    return { casted: true, ok: true, patronId, ...res };
  }

  app.onTapPatronSkill = function onTapPatronSkill() {
    executeCastPatronSkill({});
  };

  // ==================== Auto-Serve, Simulation & Settlement ====================

  function performAutoServe() {
    if (!app.orderState || !app.gridState) return false;
    const traySnap = app.orderState.tray.slice();
    const serveRes = OrderService.matchTrayToCustomer(app.orderState, buildServeScoreCtx());
    if (!serveRes || !serveRes.served) {
      autoServeTimer = 0;
      return false;
    }

    const seatIdx = serveRes.seatIdx || 0;
    const toPt = seatCenterPos(seatIdx);
    const usedIndices = Array.isArray(serveRes.usedTrayIndices) ? serveRes.usedTrayIndices : [];
    for (let i = 0; i < usedIndices.length; i++) {
      const idx = usedIndices[i];
      const t = traySnap[idx];
      if (!t) continue;
      const fromPt = traySlotCenterPos(idx);
      app.animState.flyingSprites.push({
        kind: 'tray_to_seat',
        tier: t.tier,
        flavor: t.flavor,
        fromX: fromPt.x,
        fromY: fromPt.y,
        toX: toPt.x,
        toY: toPt.y,
        timer: 0.28,
        duration: 0.28
      });
    }

    app.animState.popups.push({
      text: `+${serveRes.scoreGain || 0}`,
      subText:
        app.orderState.comboCount >= 2 ? `${app.orderState.comboCount}连上菜` : '',
      x: toPt.x,
      y: toPt.y + 8,
      color: '#FFE97D',
      timer: 0.65,
      duration: 0.65
    });

    if (serveRes.skillChargeGain > 0) {
      app.skillEnergy = clamp(app.skillEnergy + serveRes.skillChargeGain, 0, 100);
    }

    audio.playServeBell();
    audio.playOrderComplete();

    if (serveRes.triggeredFever) {
      audio.setFeverMode(true);
      audio.playFeverStart();
      showToast(
        `星光热潮开启！10 秒内得分 ×${(FEVER_CONFIG.scoreMult || 1.25).toFixed(2)} 且耐心减半流逝`,
        {
          icon: 'icon_stardust',
          tone: 'event',
          level: 'major'
        }
      );
    }

    // Check 1~3 Star crossings
    const lvl = getLevelById(app.currentLevelId || app.orderState.levelId);
    if (lvl && Array.isArray(lvl.stars)) {
      for (let s = 0; s < 3; s++) {
        const bit = 1 << s;
        if (!(unlockedStarsMask & bit) && app.orderState.score >= lvl.stars[s]) {
          unlockedStarsMask |= bit;
          app.starPopTimers[s] = 0.30;
          audio.playStarUnlock(s + 1);
        }
      }
    }

    if (app.activeTutorialStep === 'intro_slide_3') {
      completeTutorialSaveKey('intro_slide');
    }

    syncGameStateMirror();
    checkAndArmAutoServe();
    return true;
  }

  function settleCurrentLevel() {
    if (!app.orderState || !app.currentLevelId) return;
    const lvl = getLevelById(app.currentLevelId) || getLevelById('1-1');
    const prevBest = (saveData.levelBestScores && saveData.levelBestScores[lvl.id]) || 0;
    const settlement = OrderService.computeLevelSettlement(lvl, app.orderState, saveData);

    const updatedSave = SaveSync.recordLevelSettlementToSave(
      saveData,
      lvl.id,
      app.orderState.score,
      settlement.starsEarned,
      settlement.totalDustAward,
      {
        ordersServed: app.orderState.ordersServed,
        vipServed: app.orderState.vipServed,
        maxCombo: app.orderState.maxCombo,
        highestSingleServe: app.orderState.highestSingleServe
      }
    );
    SaveSync.saveLocalSave(platform, updatedSave);
    Object.assign(saveData, updatedSave);
    platform.setWxFriendCloudScore(saveData);

    const trashDiscards = Math.max(0, Math.floor(Number(app.orderState.trashDiscards) || 0));
    const failStreakAfter =
      !settlement.cleared &&
      saveData.levelFailStreaks &&
      hasOwn(saveData.levelFailStreaks, lvl.id)
        ? Math.max(0, Math.floor(Number(saveData.levelFailStreaks[lvl.id]) || 0))
        : 0;

    const runReport = {
      levelId: lvl.id,
      score: settlement.ordersServed === 0 && app.orderState.ordersServed === 0 ? 0 : app.orderState.score,
      serves: app.orderState.ordersServed,
      ordersServed: app.orderState.ordersServed,
      stars: settlement.starsEarned,
      durationSec: Math.max(3, Math.round(app.orderState.elapsedSec || lvl.durationSec)),
      trashDiscards,
      forkUses: runForkUses,
      spoonUses: runSpoonUses
    };
    scheduleCloudPush(runReport);

    app.lastResult = {
      levelId: lvl.id,
      score: app.orderState.ordersServed >= 1 ? app.orderState.score : 0,
      ordersServed: app.orderState.ordersServed,
      vipServed: app.orderState.vipServed,
      maxCombo: app.orderState.maxCombo,
      trashDiscards,
      forkUses: runForkUses,
      spoonUses: runSpoonUses,
      failStreak: failStreakAfter,
      softPityNextRun: failStreakAfter >= 2,
      isNewBest: app.orderState.ordersServed >= 1 && app.orderState.score > prevBest,
      elapsedRevealSec: 0,
      ...settlement
    };

    app.screen = 'result';
    app.activeTool = null;
    app.forkSourceCell = null;
    app.activeTutorialStep = null;
    app.tutorialSkipRect = null;
    app.activeModal = 'level_result';
    autoServeTimer = 0;

    if (settlement.cleared) {
      audio.playShiftClear();
      for (let s = 1; s <= settlement.starsEarned; s++) {
        audio.playStarUnlock(s);
      }
    } else {
      audio.playGameOver();
    }

    syncGameStateMirror();
    syncAudioMood();
  }

  function tickVisualTimers(dt) {
    if (app.toastCurrent) {
      app.toastCurrent.timer = Math.max(0, app.toastCurrent.timer - dt);
      if (app.toastCurrent.timer <= 0) app.toastCurrent = null;
    }
    if (app.minorToast) {
      app.minorToast.timer = Math.max(0, app.minorToast.timer - dt);
      if (app.minorToast.timer <= 0) app.minorToast = null;
    }
    if (app.patronPokeTimer > 0) {
      app.patronPokeTimer = Math.max(0, app.patronPokeTimer - dt);
    }
    if (app.kneadPressTimer > 0) {
      app.kneadPressTimer = Math.max(0, app.kneadPressTimer - dt);
    }
    if (app.boardFullHintTimer > 0) {
      app.boardFullHintTimer = Math.max(0, app.boardFullHintTimer - dt);
    }
    for (let i = 0; i < 3; i++) {
      if (app.starPopTimers[i] > 0) {
        app.starPopTimers[i] = Math.max(0, app.starPopTimers[i] - dt);
      }
    }
    if (app.screen === 'result' && app.lastResult) {
      app.lastResult.elapsedRevealSec = Math.min(3.0, (app.lastResult.elapsedRevealSec || 0) + dt);
    }

    const anim = app.animState;
    if (!anim) return;
    if (anim.slide && anim.slide.timer > 0) {
      anim.slide.timer = Math.max(0, anim.slide.timer - dt);
      if (anim.slide.timer <= 0) anim.slide = null;
    }
    if (anim.blockedShake && anim.blockedShake.timer > 0) {
      anim.blockedShake.timer = Math.max(0, anim.blockedShake.timer - dt);
      if (anim.blockedShake.timer <= 0) anim.blockedShake = null;
    }
    if (anim.mergeTimer > 0) anim.mergeTimer = Math.max(0, anim.mergeTimer - dt);
    if (anim.iceTimer > 0) anim.iceTimer = Math.max(0, anim.iceTimer - dt);
    if (anim.trayHintTimer > 0) anim.trayHintTimer = Math.max(0, anim.trayHintTimer - dt);
    if (anim.trashWobbleTimer > 0) anim.trashWobbleTimer = Math.max(0, anim.trashWobbleTimer - dt);
    if (anim.trashPuffTimer > 0) anim.trashPuffTimer = Math.max(0, anim.trashPuffTimer - dt);
    if (anim.comboBreakTimer > 0) anim.comboBreakTimer = Math.max(0, anim.comboBreakTimer - dt);

    for (let i = anim.cellFX.length - 1; i >= 0; i--) {
      anim.cellFX[i].timer -= dt;
      if (anim.cellFX[i].timer <= 0) anim.cellFX.splice(i, 1);
    }
    for (let i = anim.flyingSprites.length - 1; i >= 0; i--) {
      anim.flyingSprites[i].timer -= dt;
      if (anim.flyingSprites[i].timer <= 0) anim.flyingSprites.splice(i, 1);
    }
    for (let i = anim.popups.length - 1; i >= 0; i--) {
      anim.popups[i].timer -= dt;
      if (anim.popups[i].timer <= 0) anim.popups.splice(i, 1);
    }
    for (let i = anim.leavingCustomers.length - 1; i >= 0; i--) {
      anim.leavingCustomers[i].timer -= dt;
      if (anim.leavingCustomers[i].timer <= 0) anim.leavingCustomers.splice(i, 1);
    }
  }

  function stepGameplaySubstep(dt) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.orderState || !app.gridState) {
      return;
    }

    if (kneadCooldown > 0) {
      kneadCooldown = Math.max(0, kneadCooldown - dt);
    }

    if (app.activeTutorialStep === 'tray_trash' && tutorialAutoFadeTimer > 0) {
      tutorialAutoFadeTimer = Math.max(0, tutorialAutoFadeTimer - dt);
      if (tutorialAutoFadeTimer <= 0) {
        completeTutorialSaveKey('tray_trash');
      }
    }

    if (autoServeTimer > 0) {
      autoServeTimer = Math.max(0, autoServeTimer - dt);
      if (autoServeTimer <= 0) {
        performAutoServe();
      }
    }

    // Pre-snapshot seated customer IDs for walkout micro-animation
    const prevSeatIds = [
      app.orderState.seats[0] ? app.orderState.seats[0].customerId : null,
      app.orderState.seats[1] ? app.orderState.seats[1].customerId : null,
      app.orderState.seats[2] ? app.orderState.seats[2].customerId : null
    ];

    // CRITICAL: Omit freezeActive from opts so OrderService.stepCustomers performs exact piecewise freeze decay!
    const tickRes = OrderService.stepCustomers(app.orderState, dt, {
      boardMaxTier: GridEngine.getMaxBoardTier(app.gridState),
      boardFlavors: GridEngine.getBoardFlavors(app.gridState),
      rng: levelRng
    });

    if (tickRes.angryLeftSeats && tickRes.angryLeftSeats.length > 0) {
      audio.playCustomerAngry();
      app.animState.comboBreakTimer = 0.5;
      for (let i = 0; i < tickRes.angryLeftSeats.length; i++) {
        const sIdx = tickRes.angryLeftSeats[i];
        app.animState.leavingCustomers.push({
          seatIdx: sIdx,
          customerId: prevSeatIds[sIdx] || 'cust_orange',
          timer: 0.26,
          duration: 0.26
        });
      }
    } else if (tickRes.comboExpired) {
      app.animState.comboBreakTimer = 0.5;
    }

    if (tickRes.feverEnded) {
      audio.setFeverMode(false);
    }

    if (tickRes.spawnedSeats && tickRes.spawnedSeats.length > 0) {
      checkAndArmAutoServe();
    } else {
      app.neededTiers = OrderService.getNeededBoardTiers(app.orderState);
    }

    const tl = Number(app.orderState.timeLeft) || 0;
    if (tl > 0 && tl <= 5.0) {
      const secInt = Math.ceil(tl);
      if (secInt < lastCountdownTickInt) {
        lastCountdownTickInt = secInt;
        audio.playRushTick(secInt <= 3);
      }
    }

    syncGameStateMirror();
    syncAudioMood();

    if (tl <= 0) {
      // Flush any ready auto-serve right at buzzer
      let guard = 0;
      while (
        app.orderState &&
        app.orderState.seats.some((s) => s && s.readyToServe) &&
        guard < 4
      ) {
        guard++;
        if (!performAutoServe()) break;
      }
      settleCurrentLevel();
    }
  }

  function advanceSimulation(totalSeconds) {
    const n = Number(totalSeconds);
    if (!Number.isFinite(n) || n <= 0) return;
    const safeSec = Math.min(n, 3600);

    simElapsedMs += safeSec * 1000;
    let remaining = safeSec;
    while (remaining > 1e-9) {
      const stepDt = Math.min(0.05, remaining);
      remaining -= stepDt;
      tickVisualTimers(stepDt);
      if (app.screen === 'playing' && app.activeModal === null) {
        stepGameplaySubstep(stepDt);
      }
    }
  }

  // ==================== Unified Canvas Render Pipeline ====================

  function syncCanvasMetrics() {
    const fresh = platform.getSystemMetrics();
    const resized =
      fresh.width !== metrics.width ||
      fresh.height !== metrics.height ||
      fresh.dpr !== metrics.dpr;
    metrics = fresh;
    if (resized && canvas) {
      try {
        canvas.width = Math.round(metrics.width * metrics.dpr);
        canvas.height = Math.round(metrics.height * metrics.dpr);
        if (canvas.style) {
          canvas.style.width = `${metrics.width}px`;
          canvas.style.height = `${metrics.height}px`;
        }
      } catch (_) {}
    }
  }

  function renderFrame(dt = 0) {
    if (destroyed) return;
    syncCanvasMetrics();
    const nowSec = getEffectiveNowMs() * 0.001;

    ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    hits.clear();

    ScreensUI.renderBackdrop(
      ctx,
      metrics.width,
      metrics.height,
      dt,
      nowSec,
      gameState,
      app.equippedTheme,
      sprites,
      fireflies
    );

    if (app.screen === 'lobby') {
      ScreensUI.renderLobbyScreen(ctx, metrics, app, hits, nowSec);
    } else if (app.screen === 'playing') {
      ScreensUI.renderPlayScreen(ctx, metrics, app, hits, nowSec);
    } else {
      // screen === 'result'
      app.currentBoardLayout = null;
      app.guideTargets = null;
    }

    if (app.activeModal) {
      ModalsUI.renderActiveModal(ctx, metrics, app, hits, nowSec);
    } else {
      app.activeModalFrame = null;
      app.userInfoBtnRect = null;
      ModalsUI.renderTutorialOverlay(ctx, metrics, app, hits, nowSec);
    }

    platform.syncUserInfoButton(
      app.activeModal === 'leaderboard' ? app.userInfoBtnRect : null,
      (res) => {
        if (res && res.ok) {
          app.applyPlayerProfileAuth({
            nickName: res.nickName,
            avatarUrl: res.avatarUrl || '',
            authorized: true
          });
          renderFrame(0);
        } else if (res && res.cancelled) {
          showToast('可继续使用猫咪店长名片游玩', { icon: 'icon_paw_guide' });
        }
      }
    );

    const geom = ScreensUI.computeTopHeaderGeometry(metrics);
    ScreensUI.renderToast(ctx, metrics.width, geom.headerBottom, app);
  }

  // ==================== Gesture Arbitration FSM & Keyboard ====================

  const pointerState = {
    active: false,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
    startTimeMs: 0,
    downOnBoard: false,
    downBoardCell: null,
    downTraySlot: -1,
    downOnTutorialSkip: false,
    diagonalDelayed: false,
    gestureConsumed: false,
    isModalScroll: false,
    startScrollY: 0
  };

  function isPointInsideBoardStage(x, y) {
    const gt = app.guideTargets;
    if (gt && gt.boardStage && pointInRect(x, y, gt.boardStage)) return true;
    const lay = app.currentBoardLayout;
    if (!lay) return false;
    return pointInRect(x, y, { x: lay.x, y: lay.y, w: lay.w, h: lay.h });
  }

  function handlePointerDown(pt) {
    if (!pt || typeof pt !== 'object' || destroyed) return;
    const x = Number(pt.x);
    const y = Number(pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    audio.unlock();

    pointerState.active = true;
    pointerState.startX = x;
    pointerState.startY = y;
    pointerState.curX = x;
    pointerState.curY = y;
    pointerState.startTimeMs = getEffectiveNowMs();
    pointerState.downOnBoard = false;
    pointerState.downBoardCell = null;
    pointerState.downTraySlot = -1;
    pointerState.downOnTutorialSkip = false;
    pointerState.diagonalDelayed = false;
    pointerState.gestureConsumed = false;
    pointerState.isModalScroll = false;
    pointerState.startScrollY = app.modalScrollY || 0;

    if (app.activeModal !== null) {
      if (app.modalScrollRect && app.modalMaxScroll > 0 && pointInRect(x, y, app.modalScrollRect)) {
        pointerState.isModalScroll = true;
      }
      return;
    }

    if (app.screen === 'playing') {
      if (
        app.activeTutorialStep &&
        app.tutorialSkipRect &&
        pointInRect(x, y, app.tutorialSkipRect)
      ) {
        pointerState.downOnTutorialSkip = true;
        return;
      }
      const hit = hits.findAt(x, y);
      if (hit && hit.meta && typeof hit.meta.slotIdx === 'number') {
        pointerState.downTraySlot = hit.meta.slotIdx;
        return;
      }
      if (!hit && isPointInsideBoardStage(x, y)) {
        pointerState.downOnBoard = true;
        pointerState.downBoardCell = app.currentBoardLayout
          ? BoardRenderer.hitTestBoardCell(app.currentBoardLayout, app.gridState, x, y)
          : null;
      }
    }
  }

  function handlePointerMove(pt) {
    if (!pt || typeof pt !== 'object' || !pointerState.active || destroyed) return;
    const x = Number(pt.x);
    const y = Number(pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    pointerState.curX = x;
    pointerState.curY = y;

    const dx = x - pointerState.startX;
    const dy = y - pointerState.startY;
    const dist = Math.hypot(dx, dy);

    if (app.activeModal !== null) {
      if (pointerState.isModalScroll && dist >= 8) {
        pointerState.gestureConsumed = true;
        app.modalScrollY = clamp(pointerState.startScrollY - dy, 0, app.modalMaxScroll || 0);
      }
      return;
    }

    if (app.screen === 'playing' && pointerState.downOnBoard && !pointerState.gestureConsumed) {
      if (app.activeTool !== null) {
        // Lock out 2048 sliding while utensil aiming is armed (03 §4.1)
        return;
      }
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);
      const axisDiff = Math.abs(adx - ady);
      if (dist >= 18) {
        if (axisDiff < 4) {
          pointerState.diagonalDelayed = true;
        } else if (dist >= (pointerState.diagonalDelayed ? 20 : 18)) {
          const dir = adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          pointerState.gestureConsumed = true;
          executeSlide(dir);
          renderFrame(0);
        }
      }
    }
  }

  function handlePointerUp(pt) {
    if (!pt || typeof pt !== 'object' || !pointerState.active || destroyed) return;
    const x = Number(pt.x);
    const y = Number(pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pointerState.active = false;
      pointerState.downOnTutorialSkip = false;
      pointerState.diagonalDelayed = false;
      return;
    }
    const dx = x - pointerState.startX;
    const dy = y - pointerState.startY;
    const dist = Math.hypot(dx, dy);
    const elapsedMs = Math.max(0, getEffectiveNowMs() - pointerState.startTimeMs);

    const wasConsumed = pointerState.gestureConsumed;
    const wasDownOnBoard = pointerState.downOnBoard;
    const downCell = pointerState.downBoardCell;
    const downTraySlot = pointerState.downTraySlot;
    const wasDownOnTutorialSkip = pointerState.downOnTutorialSkip;
    const wasDiagonalDelayed = pointerState.diagonalDelayed;
    pointerState.active = false;
    pointerState.downOnTutorialSkip = false;
    pointerState.diagonalDelayed = false;

    if (wasConsumed) return;

    // 1. Active Blocking Modal
    if (app.activeModal !== null) {
      if (dist < 14) {
        const hit = hits.findAt(x, y);
        if (hit && typeof hit.onClick === 'function') {
          hit.onClick();
          renderFrame(0);
          return;
        }
        if (
          app.activeModalFrame &&
          app.activeModalFrame.dismissOnOutside &&
          !pointInRect(x, y, app.activeModalFrame)
        ) {
          app.closeModal();
          renderFrame(0);
        }
      }
      return;
    }

    // 2. Gameplay Screen
    if (app.screen === 'playing') {
      // Dragging tray slot rightward into trash basket
      if (downTraySlot >= 0 && dx >= 40 && Math.abs(dx) > Math.abs(dy)) {
        executeDiscardTraySlot(downTraySlot);
        renderFrame(0);
        return;
      }

      // Synthetic 2-point swipe (pointerdown -> pointerup without intermediate move lock)
      if (
        wasDownOnBoard &&
        app.activeTool === null &&
        dist >= (wasDiagonalDelayed ? 20 : 18)
      ) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        const axisDiff = Math.abs(adx - ady);
        if (axisDiff >= 4) {
          const dir = adx > ady ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
          executeSlide(dir);
          renderFrame(0);
          return;
        }
      }

      // Crisp Tap (< 14px)
      if (dist < 14) {
        if (
          (elapsedMs < 350 || wasDownOnTutorialSkip) &&
          app.activeTutorialStep &&
          app.tutorialSkipRect &&
          pointInRect(x, y, app.tutorialSkipRect)
        ) {
          audio.playPatronSelect();
          skipCurrentTutorial();
          renderFrame(0);
          return;
        }

        const hit = hits.findAt(x, y);
        if (hit && typeof hit.onClick === 'function') {
          hit.onClick();
          renderFrame(0);
          return;
        }

        if (elapsedMs < 350) {
          const upCell = app.currentBoardLayout
            ? BoardRenderer.hitTestBoardCell(app.currentBoardLayout, app.gridState, x, y)
            : null;
          const targetCell = upCell || downCell;
          if (targetCell) {
            if (app.activeTool !== null) {
              applyToolInternal(app.activeTool, targetCell.r, targetCell.c, false);
            } else {
              executeTapBoardCell(targetCell.r, targetCell.c);
            }
            renderFrame(0);
            return;
          }
        }
      }
      return;
    }

    // 3. Lobby Screen
    if (app.screen === 'lobby') {
      if (Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        app.switchChapter(dx < 0 ? 1 : -1);
        renderFrame(0);
        return;
      }
      if (dist < 14) {
        const hit = hits.findAt(x, y);
        if (hit && typeof hit.onClick === 'function') {
          hit.onClick();
          renderFrame(0);
          return;
        }
        if (app.lobbyPatronPokeRect && pointInRect(x, y, app.lobbyPatronPokeRect)) {
          app.pokeLobbyPatron();
          renderFrame(0);
        }
      }
    }
  }

  function handlePointerCancel() {
    pointerState.active = false;
    pointerState.downOnTutorialSkip = false;
    pointerState.diagonalDelayed = false;
  }

  function handleWheel(x, y, dy) {
    const nx = Number(x);
    const ny = Number(y);
    const ndy = Number(dy);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(ndy)) return;
    if (app.activeModal && app.modalScrollRect && app.modalMaxScroll > 0) {
      if (pointInRect(nx, ny, app.modalScrollRect)) {
        app.modalScrollY = clamp((app.modalScrollY || 0) + ndy * 0.65, 0, app.modalMaxScroll);
        renderFrame(0);
      }
    }
  }

  function handleKeyDown(key, ev) {
    if (destroyed || typeof key !== 'string' || !key) return;
    audio.unlock();

    if (key === 'Escape') {
      if (app.activeModal) {
        if (app.activeModal === 'confirm') app.confirmCancel();
        else app.closeModal();
      } else if (app.activeTool) {
        app.activeTool = null;
        app.forkSourceCell = null;
      } else if (app.screen === 'playing') {
        app.togglePause();
      }
      renderFrame(0);
      return;
    }

    if (key === 'm' || key === 'M') {
      app.cycleBgm();
      renderFrame(0);
      return;
    }

    if (app.screen !== 'playing' || app.activeModal !== null) return;

    const slideDir = SLIDE_KEY_MAP[key];
    if (slideDir) {
      if (ev && typeof ev.preventDefault === 'function') {
        try { ev.preventDefault(); } catch (_) {}
      }
      executeSlide(slideDir);
      renderFrame(0);
      return;
    }

    if (key === ' ' || key === 'Spacebar') {
      if (ev && typeof ev.preventDefault === 'function') {
        try { ev.preventDefault(); } catch (_) {}
      }
      executeKnead(false);
      renderFrame(0);
      return;
    }

    if (key === '1') {
      app.onTapToolButton('fork');
      renderFrame(0);
    } else if (key === '2') {
      app.onTapToolButton('spoon');
      renderFrame(0);
    } else if (key === 'f' || key === 'F') {
      executeCastPatronSkill({});
      renderFrame(0);
    }
  }

  platform.bindPointerEvents(canvas, {
    onDown: handlePointerDown,
    onMove: handlePointerMove,
    onUp: handlePointerUp,
    onCancel: handlePointerCancel,
    onWheel: handleWheel
  });
  platform.bindKeyboard(handleKeyDown);
  platform.onResize(() => {
    if (!destroyed) renderFrame(0);
  });

  // App Lifecycle & Share Menu
  platform.bindLifecycle(
    () => {
      if (destroyed) return;
      audio.setTabHidden(false);
      syncAudioMood();
      if (cloudState.dirty || cloudState.status === 'retry_pending') {
        flushCloudPush(null);
      }
    },
    () => {
      if (destroyed) return;
      audio.setTabHidden(true);
      app.activeTool = null;
      app.forkSourceCell = null;
      if (app.screen === 'playing' && !app.activeModal) {
        app.openModal('pause');
      }
      if (cloudState.dirty) {
        flushCloudPush(null);
      }
      renderFrame(0);
    }
  );

  platform.setupShare(() => ({
    title:
      app.orderState && app.orderState.score > 0
        ? `我在《一起做猫饼》第 ${app.currentLevelId} 关烤出了 ${app.orderState.score} 营业分！`
        : '一起做猫饼｜手绘异形 2048 烘焙 × 甜点上菜小游戏'
  }));

  // ==================== Animation Frame Loop ====================

  let lastFrameMs = rawNowMs();
  let mainLoopErrorLogged = false;
  const gGlobal = platform.getGlobal ? platform.getGlobal() : globalThis;
  const reqAnim =
    (gGlobal && typeof gGlobal.requestAnimationFrame === 'function' && gGlobal.requestAnimationFrame.bind(gGlobal)) ||
    null;
  const cancelAnim =
    (gGlobal && typeof gGlobal.cancelAnimationFrame === 'function' && gGlobal.cancelAnimationFrame.bind(gGlobal)) ||
    null;

  function mainLoop() {
    if (destroyed) return;
    try {
      const now = rawNowMs();
      const dt = clamp((now - lastFrameMs) * 0.001, 0, 0.05);
      lastFrameMs = now;
      tickVisualTimers(dt);
      if (app.screen === 'playing' && app.activeModal === null) {
        stepGameplaySubstep(dt);
      }
      renderFrame(dt);
    } catch (err) {
      if (!mainLoopErrorLogged) {
        mainLoopErrorLogged = true;
        console.error('[HoshiKissa v2] mainLoop error:', err);
      }
    } finally {
      if (!destroyed && reqAnim) {
        rafId = reqAnim(mainLoop);
      }
    }
  }

  previousAppCleanup = () => {
    destroyed = true;
    if (rafId !== null && cancelAnim) {
      try { cancelAnim(rafId); } catch (_) {}
    }
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    audio.setTabHidden(true);
    platform.destroyUserInfoButton();
  };

  // ==================== __HOSHI_DEBUG__ & __game Contract ====================

  function buildNormalizedGridSnapshot() {
    if (!app.gridState) return null;
    const rows = app.gridState.rows;
    const cols = app.gridState.cols;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const rowArr = [];
      for (let c = 0; c < cols; c++) {
        const src = app.gridState.cells[r][c];
        const t = src && src.tile;
        rowArr.push({
          r,
          c,
          type: src ? src.type : 'void',
          tile: t
            ? {
                uid: t.uid,
                tier: t.tier,
                flavor: t.flavor,
                frozenHp: t.frozenHp || 0
              }
            : null
        });
      }
      cells.push(rowArr);
    }
    return { rows, cols, cells };
  }

  function buildNormalizedSeatsSnapshot() {
    if (!app.orderState || !Array.isArray(app.orderState.seats)) {
      return [null, null, null];
    }
    return app.orderState.seats.map((s) => {
      if (!s) return null;
      return {
        uid: s.uid,
        customerId: s.customerId,
        customerName: s.customerName,
        recipeId: s.recipeId,
        recipeName: s.recipeName,
        patience: s.patience,
        maxPatience: s.maxPatience,
        isVip: Boolean(s.isVip),
        isUrgent: Boolean(s.isUrgent),
        bountyMult: s.bountyMult,
        readyToServe: Boolean(s.readyToServe),
        slotMatches: Array.isArray(s.slotMatches) ? s.slotMatches.slice() : [],
        slots: Array.isArray(s.slots)
          ? s.slots.map((sl) => ({
              tier: sl.tier,
              flavor: sl.flavor,
              matchedTrayIdx: sl.matchedTrayIdx
            }))
          : []
      };
    });
  }

  const debugApi = {
    version: GAME_VERSION,

    getState() {
      const os = app.orderState;
      const trayCap = os
        ? os.trayCapacity
        : saveData.deviceUpgrades && saveData.deviceUpgrades.dev_tray >= 1
        ? 4
        : 3;
      const trayArr = os && Array.isArray(os.tray)
        ? os.tray.slice(0, trayCap).map((t) => (t ? { uid: t.uid, tier: t.tier, flavor: t.flavor } : null))
        : new Array(trayCap).fill(null);

      const lay = app.currentBoardLayout;
      const boardLayout = lay
        ? {
            x: lay.x,
            y: lay.y,
            w: lay.w,
            h: lay.h,
            rows: lay.rows,
            cols: lay.cols,
            cellSize: lay.cellSize,
            gridX: lay.gridX,
            gridY: lay.gridY,
            gridW: lay.gridW,
            gridH: lay.gridH
          }
        : null;

      return {
        screen: app.screen,
        selectedChapter: app.selectedChapter,
        previewLevelId: app.previewLevelId,
        currentLevelId: app.currentLevelId,
        activeModal: app.activeModal,
        activeShopTab: app.activeShopTab,
        leaderboardBoardType: app.leaderboardBoardType,
        activeTutorialStep: app.activeTutorialStep,
        score: os
          ? os.score
          : app.screen === 'result' && app.lastResult
          ? app.lastResult.score
          : 0,
        timeLeft: os ? os.timeLeft : 0,
        ordersServed: os
          ? os.ordersServed
          : app.screen === 'result' && app.lastResult
          ? app.lastResult.ordersServed
          : 0,
        vipServed: os
          ? os.vipServed
          : app.screen === 'result' && app.lastResult
          ? app.lastResult.vipServed
          : 0,
        comboCount: os ? os.comboCount : 0,
        feverActive: Boolean(os && os.feverActive),
        feverEnergy: os ? os.feverEnergy : 0,
        skillEnergy: app.skillEnergy,
        activeTool: app.activeTool,
        forkSourceCell: app.forkSourceCell
          ? { r: app.forkSourceCell.r, c: app.forkSourceCell.c }
          : null,
        toolCounts: { fork: app.toolCounts.fork, spoon: app.toolCounts.spoon },
        trashCooldown: os ? os.trashCooldown || 0 : 0,
        trayCapacity: trayCap,
        tray: trayArr,
        seats: buildNormalizedSeatsSnapshot(),
        preferredSeatIdx: os ? os.preferredSeatIdx : null,
        grid: buildNormalizedGridSnapshot(),
        boardLayout,
        lastResult: cloneJsonSafe(app.lastResult),
        cloudStatus: cloudState.status,
        higherSchemaDetected: Boolean(saveData.higherSchemaDetected),
        assetsLoaded: sprites.loadedCount,
        assetsTotal: sprites.totalCount,
        metrics: {
          width: metrics.width,
          height: metrics.height,
          dpr: metrics.dpr,
          safeTop: metrics.safeTop,
          safeBottom: metrics.safeBottom,
          menuRect: metrics.menuRect ? { ...metrics.menuRect } : null
        },
        hits: hits.items.map((it) => ({
          id: it.id,
          x: it.x,
          y: it.y,
          w: it.w,
          h: it.h
        }))
      };
    },

    getSaveData() {
      return cloneJsonSafe(saveData);
    },

    setSaveData(rawObj) {
      saveEpoch += 1;
      if (cloudPushTimer) {
        clearTimeout(cloudPushTimer);
        cloudPushTimer = null;
      }
      cloudState.dirty = false;
      cloudState.retryCount = 0;

      let inputObj = rawObj;
      let rawRequestedSv = 2;
      if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
        inputObj = { ...rawObj };
        if (Number.isFinite(Number(rawObj.schemaVersion)) && Number(rawObj.schemaVersion) > 2) {
          rawRequestedSv = Math.floor(Number(rawObj.schemaVersion));
        }
        const isSpreadFromCurrent =
          Number(rawObj.totalEarnedStardust) === saveData.totalEarnedStardust &&
          Number(rawObj.bankStardust) !== saveData.bankStardust;
        const isSpreadFromDefault =
          (Number(rawObj.totalEarnedStardust) === DEFAULT_INITIAL_STARDUST ||
            Number(rawObj.totalEarnedStardust) === 30) &&
          Number(rawObj.lastSyncedEarnedStardust || 0) === 0 &&
          Number(rawObj.bankStardust) !== Number(rawObj.totalEarnedStardust);
        if (
          Number(rawObj.schemaVersion) >= 2 &&
          hasOwn(rawObj, 'bankStardust') &&
          rawObj.bankStardust !== undefined &&
          Number.isFinite(Number(rawObj.bankStardust)) &&
          hasOwn(rawObj, 'totalEarnedStardust') &&
          (isSpreadFromCurrent || isSpreadFromDefault)
        ) {
          delete inputObj.totalEarnedStardust;
        }
      }

      const normalized = SaveSync.saveLocalSave(platform, inputObj);
      normalized.lastSyncedEarnedStardust = normalized.totalEarnedStardust;
      SaveSync.saveLocalSave(platform, normalized);

      const oldKeys = Object.keys(saveData);
      for (let i = 0; i < oldKeys.length; i++) {
        if (!hasOwn(normalized, oldKeys[i])) {
          delete saveData[oldKeys[i]];
        }
      }
      Object.assign(saveData, normalized);

      if (saveData.higherSchemaDetected) {
        cloudState.status = 'higher_schema_blocked';
      } else if (cloudState.status === 'higher_schema_blocked') {
        cloudState.status = CloudConfig.ENABLE_CLOUD_SYNC ? 'idle' : 'local_only';
      }

      checkVeteranGiftToast();
      syncAudioPrefsFromSave();

      const gObj = platform.getGlobal ? platform.getGlobal() : globalThis;
      const wxObj = gObj && hasOwn(gObj, 'wx') ? gObj.wx : null;
      const hasRealWxCloud = Boolean(
        platform.hasWx &&
          wxObj &&
          typeof wxObj === 'object' &&
          wxObj.cloud &&
          typeof wxObj.cloud === 'object' &&
          typeof wxObj.cloud.callFunction === 'function'
      );
      if (!hasRealWxCloud) {
        platform.removeStorage('__hoshi_browser_cloud_doc_v1__');
        platform.removeStorage('__hoshi_browser_cloud_doc_v2__');
        const seededSuffix =
          cloudState.openidSuffix && cloudState.openidSuffix !== 'LOCAL'
            ? cloudState.openidSuffix
            : 'CAFE';
        const seededMeta = cloneJsonSafe(saveData) || {};
        if (rawRequestedSv > 2) {
          seededMeta.schemaVersion = rawRequestedSv;
        }
        platform.setStorageJSON('__hoshi_browser_cloud_doc_v1__', {
          schemaVersion: rawRequestedSv,
          openidSuffix: seededSuffix,
          profile: cloneJsonSafe(saveData.playerProfile),
          totalStars: saveData.lifetimeStats.totalStars,
          totalCumulativeScore: saveData.lifetimeStats.totalCumulativeScore,
          metaSave: seededMeta,
          revision: 1
        });
        cloudState.revision = 1;
      }

      if (app.screen === 'lobby') {
        app.previewLevelId = saveData.highestUnlockedLevel || '1-1';
        if (!saveData.levelStars || Object.keys(saveData.levelStars).length === 0) {
          app.selectedChapter = 1;
        } else {
          app.selectedChapter = clamp(app.selectedChapter || 1, 1, Math.max(1, CHAPTERS.length));
        }
      }

      if (app.orderState) {
        app.orderState.catcakeLevels = { ...saveData.catcakeLevels };
        app.orderState.devTrayLv =
          (saveData.deviceUpgrades && saveData.deviceUpgrades.dev_tray) || 0;
        app.orderState.patronId = saveData.selectedPatron;
        const nextCap = app.orderState.devTrayLv >= 1 ? 4 : 3;
        app.orderState.trayCapacity = nextCap;
        while (app.orderState.tray.length < nextCap) app.orderState.tray.push(null);
        if (app.orderState.tray.length > nextCap) {
          app.orderState.tray.length = nextCap;
        }
        refreshNeededAndOrderMarks();
      }

      refreshOfflineLeaderboardFallback();
      platform.setWxFriendCloudScore(saveData);
      syncAudioMood();
      renderFrame(0);
      return cloneJsonSafe(saveData);
    },

    clickHit(hitId) {
      if (typeof hitId !== 'string' || !hitId) return false;
      for (let i = hits.items.length - 1; i >= 0; i--) {
        const it = hits.items[i];
        if (it && it.id === hitId && typeof it.onClick === 'function') {
          audio.unlock();
          inSyntheticClickHit = true;
          try {
            it.onClick();
          } finally {
            inSyntheticClickHit = false;
          }
          renderFrame(0);
          return true;
        }
      }
      return false;
    },

    openLevelPreview(levelId) {
      const ok = openLevelPreviewInternal(levelId);
      renderFrame(0);
      return ok;
    },

    startLevel(levelId, opts = {}) {
      const ok = startLevelInternal(levelId, opts);
      renderFrame(0);
      return ok;
    },

    slide(dir) {
      const res = executeSlide(dir);
      renderFrame(0);
      return res;
    },

    knead() {
      const res = executeKnead(true);
      renderFrame(0);
      return res;
    },

    tapBoardCell(r, c) {
      const res = executeTapBoardCell(r, c);
      renderFrame(0);
      return res;
    },

    doubleTapTray(slotIdx, opts = undefined) {
      const res = executeDiscardTraySlot(slotIdx, opts);
      renderFrame(0);
      return res;
    },

    useToolOnCell(kind, r, c, r2 = undefined, c2 = undefined, opts = null) {
      const res = applyToolInternal(kind, r, c, true, r2, c2, opts);
      renderFrame(0);
      return res;
    },

    castPatronSkill(opts = {}) {
      const res = executeCastPatronSkill(opts);
      renderFrame(0);
      return res;
    },

    advanceTime(seconds) {
      advanceSimulation(seconds);
      renderFrame(0);
    },

    openModal(modalName) {
      app.openModal(modalName);
      renderFrame(0);
    },

    closeModal() {
      app.closeModal();
      renderFrame(0);
    }
  };

  if (gGlobal && typeof gGlobal === 'object') {
    gGlobal.__HOSHI_DEBUG__ = debugApi;
    gGlobal.__game = debugApi;
  }
  if (typeof globalThis !== 'undefined' && globalThis) {
    globalThis.__HOSHI_DEBUG__ = debugApi;
    globalThis.__game = debugApi;
  }

  // Boot Sequence
  preloadAssets();
  checkVeteranGiftToast();
  platform.setWxFriendCloudScore(saveData);
  syncAudioMood();
  initCloudSyncOnBoot();

  // Synchronous initial render so getState().hits is immediately populated on boot
  renderFrame(0);
  if (reqAnim) {
    rafId = reqAnim(mainLoop);
  }

  return debugApi;
}

module.exports = {
  createApp
};
