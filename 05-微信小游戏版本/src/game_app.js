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
  RESEARCH_ITEMS,
  RESEARCH_COSTS,
  ASSET_PATHS,
  V090_ASSET_LIST,
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
const Rng = require('./rng');
const GameEvents = require('./game_events');
const BalanceConfig = require('./balance_config');
const DoughTemp = require('./dough_temp');
const LevelGoals = require('./level_goals');
const LevelEvents = require('./level_events');
const RunDiagnostics = require('./run_diagnostics');
const CustomerTraits = require('./customer_traits');
const PerksData = require('./perks_data');
const RunModifiers = require('./run_modifiers');

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
    critShake: null,
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

  let appInitialized = false;

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
    const stg = saveData.settings && typeof saveData.settings === 'object' ? saveData.settings : {};
    const vibOn = stg.vibrateEnabled !== false;
    const lowPow = Boolean(stg.lowPowerMode);
    const cbOn = Boolean(stg.colorblindMarks);
    if (typeof platform.setVibrateEnabled === 'function') {
      platform.setVibrateEnabled(vibOn);
    }
    if (typeof UI.setColorblindMarks === 'function') {
      UI.setColorblindMarks(cbOn);
    }
    if (appInitialized) {
      app.lowPowerMode = lowPow;
      gameState.lowPowerMode = lowPow;
    }
  }

  // Apply cached remote balance config overrides synchronously on boot (v0.13 M4)
  if (typeof platform.getCachedRemoteConfig === 'function') {
    const cachedCfg = platform.getCachedRemoteConfig();
    if (cachedCfg && cachedCfg.overrides) {
      BalanceConfig.applyRemoteOverrides(cachedCfg.overrides);
    }
  }

  syncAudioPrefsFromSave();

  // Ensure v0.9.0 rounded font is initialized even when createApp() is invoked directly by tests
  if (typeof UI.initGameFont === 'function') {
    UI.initGameFont('assets/fonts/kissa_round.ttf');
  }

  // Runtime 69-asset WebP registry matching constants.V090_ASSET_LIST 1:1
  const sprites = {
    byId: {},
    hero: null,
    titlePlaque: null,
    lobbyPlaque: null,
    servingPlate: null,
    resultRibbon: null,
    kneadDough: null,
    lobbyBgs: { amber: null, sakura: null, moonlight: null },
    patrons: { mikan: null, luna: null, mugi: null },
    tools: { fork: null, spoon: null },
    customers: {},
    devices: {},
    themes: {},
    medals: {},
    catcakes: {},
    catcakesHappy: {},
    loadedCount: 0,
    totalCount: V090_ASSET_LIST.length
  };

  function bindSpriteById(id, img) {
    sprites.byId[id] = img;
    sprites[id] = img;
    if (id === 'title_hero_v2') sprites.hero = img;
    else if (id === 'title_plaque_banner') sprites.titlePlaque = img;
    else if (id === 'lobby_plaque_blank') sprites.lobbyPlaque = img;
    else if (id === 'serving_plate') sprites.servingPlate = img;
    else if (id === 'result_ribbon') sprites.resultRibbon = img;
    else if (id === 'knead_dough') sprites.kneadDough = img;
    else if (id === 'bg_lobby_ch1_amber') sprites.lobbyBgs.amber = img;
    else if (id === 'bg_lobby_ch2_sakura') sprites.lobbyBgs.sakura = img;
    else if (id === 'bg_lobby_ch3_moonlight') sprites.lobbyBgs.moonlight = img;
    else if (id === 'patron_mikan') sprites.patrons.mikan = img;
    else if (id === 'patron_luna') sprites.patrons.luna = img;
    else if (id === 'patron_mugi') sprites.patrons.mugi = img;
    else if (id === 'tool_swap_fork') sprites.tools.fork = img;
    else if (id === 'tool_upgrade_spoon') sprites.tools.spoon = img;
    else if (id === 'cust_ragdoll') sprites.customers.cust_ragdoll = img;
    else if (id === 'cust_orange_uncle') sprites.customers.cust_orange = img;
    else if (id === 'cust_scholar') sprites.customers.cust_silver = img;
    else if (id === 'cust_lop_bunny') sprites.customers.cust_rabbit = img;
    else if (id === 'cust_fox') sprites.customers.cust_fox = img;
    else if (id === 'cust_raccoon') sprites.customers.cust_raccoon = img;
    else if (id === 'cust_shiba') sprites.customers.cust_shiba = img;
    else if (id === 'cust_vip_cat') sprites.customers.cust_critic = img;
    else if (id === 'device_tray') sprites.devices.dev_tray = img;
    else if (id === 'device_flour') sprites.devices.dev_flour = img;
    else if (id === 'device_teapot') sprites.devices.dev_teapot = img;
    else if (id === 'device_rack') sprites.devices.dev_tools = img;
    else if (id === 'theme_amber') sprites.themes.amber = img;
    else if (id === 'theme_sakura') sprites.themes.sakura = img;
    else if (id === 'theme_moonlight') sprites.themes.moonlight = img;
    else if (id === 'medal_gold') sprites.medals.gold = img;
    else if (id === 'medal_silver') sprites.medals.silver = img;
    else if (id === 'medal_bronze') sprites.medals.bronze = img;
    else {
      const mHappy = /^catcake_([1-7])_happy$/.exec(id);
      if (mHappy) {
        sprites.catcakesHappy[Number(mHappy[1])] = img;
      } else {
        const mBase = /^catcake_([1-7])$/.exec(id);
        if (mBase) sprites.catcakes[Number(mBase[1])] = img;
      }
    }
  }

  function preloadAssets() {
    const tasks = V090_ASSET_LIST.map((entry) => ({
      id: entry.id,
      src: entry.path
    }));

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
          bindSpriteById(task.id, img);
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
  let customerRng = Math.random;
  let runCtx = null;
  let headlessSimMode = false;

  /** Per-run telemetry counters (fed into runReport / result diagnostics). */
  function createRunStats() {
    return {
      slides: 0,
      merges: 0,
      kneads: 0,
      crits: [0, 0, 0, 0, 0],
      hotServes: 0,
      hotItems: 0,
      totalItemsServed: 0,
      feverCount: 0,
      overheats: 0,
      warmKneads: 0,
      pityHits: 0,
      feverExtendSec: 0,
      afterglowTiles: 0,
      angryWalkouts: 0,
      eventsSeen: [],
      goalDone: false,
      earlyCloseBonus: 0
    };
  }
  /** Restore fn for per-run feature flag overrides (startLevel opts.features; tests / sim A-B only). */
  let restoreRunFeatures = null;
  let kneadCooldown = 0;
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
    selectedCompendiumTier: 1,
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

    // Smooth UI transition animation states (purely visual; HitRegistry always uses resting bounds)
    uiAnim: {
      modalOpenTimer: 1,
      tabSwitchTimer: 1,
      chapterFadeTimer: 1,
      prevChapter: initialLvl ? initialLvl.chapter : 1,
      chapterSlideDir: 0,
      pressedHitId: null,
      bgmSwitchPos: audio.bgmEnabled && audio.bgmTrack !== 'off' ? 1 : 0,
      sfxSwitchPos: audio.sfxEnabled ? 1 : 0
    },

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
    feverActive: false,
    lowPowerMode: Boolean(saveData && saveData.settings && saveData.settings.lowPowerMode)
  };
  app.lowPowerMode = gameState.lowPowerMode;
  appInitialized = true;

  function syncGameStateMirror() {
    const lowPow = Boolean(saveData && saveData.settings && saveData.settings.lowPowerMode);
    gameState.lowPowerMode = lowPow;
    app.lowPowerMode = lowPow;
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
  app.isFeatureOn = (name) => BalanceConfig.isFeatureOn(name);
  Object.defineProperty(app, 'freshWindowSec', {
    enumerable: false,
    get: () => BalanceConfig.FRESH.windowSec
  });

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
    if (tabId === 'research') {
      const unlocked =
        saveData.researchUnlocks && typeof saveData.researchUnlocks === 'object'
          ? saveData.researchUnlocks
          : {};
      for (let i = 0; i < RESEARCH_ITEMS.length; i++) {
        const item = RESEARCH_ITEMS[i];
        if (!unlocked[item.id] && bank >= item.cost) {
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
      app.hasAffordableShopTab('themes') ||
      app.hasAffordableShopTab('research')
    );
  };

  // ==================== Cloud Sync & Multi-Board Leaderboard ====================

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

  function normalizeUiBoardType(raw) {
    if (raw === 'score' || raw === 'totalScore') return 'score';
    if (raw === 'daily') return 'daily';
    if (raw === 'endless') return 'endless';
    if (raw === 'friends') return 'friends';
    return 'stars';
  }

  function fetchLeaderboard(boardType) {
    const cleanType = normalizeUiBoardType(boardType);
    if (cleanType === 'friends') {
      app.leaderboardBoardType = 'friends';
      app.leaderboardLoading = false;
      return;
    }
    app.leaderboardBoardType = cleanType;
    refreshOfflineLeaderboardFallback();

    if (!CloudConfig.ENABLE_CLOUD_SYNC) {
      cloudState.status = 'local_only';
      return;
    }

    const reqEpoch = saveEpoch;
    app.leaderboardLoading = true;
    const reqPayload = {
      action: 'leaderboard',
      boardType: cleanType
    };
    if (cleanType === 'daily') {
      reqPayload.dateKey = RunModifiers.getDailyDateKeyUTC8();
    }
    platform
      .callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, reqPayload)
      .then((res) => {
        if (destroyed || reqEpoch !== saveEpoch) return;
        app.leaderboardLoading = false;
        if (res && res.ok && Array.isArray(res.list) && res.list.length > 0) {
          app.leaderboardData = {
            ok: true,
            boardType: cleanType,
            dateKey: res.dateKey || reqPayload.dateKey || '',
            list: res.list,
            myRank: res.myRank || null,
            myShift: res.myShift || 0,
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
    const dir = delta > 0 ? 1 : -1;
    const next = clamp(app.selectedChapter + dir, 1, maxChapter);
    if (next === app.selectedChapter) return false;
    app.uiAnim.prevChapter = app.selectedChapter;
    app.uiAnim.chapterSlideDir = dir;
    app.uiAnim.chapterFadeTimer = 0;
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
      showToast('去星夜小铺邀请新主厨搭档吧', { icon: 'icon_shop' });
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
      showToast('请先前往星夜小铺邀请解锁该搭档', { icon: 'icon_shop', tone: 'warn' });
      return false;
    }
    saveData.selectedPatron = pid;
    audio.playPatronSelect();
    persistSave(true);
    return true;
  };

  app.openShop = function openShop(tab = 'catcakes') {
    const validTab =
      tab === 'devices' || tab === 'patrons' || tab === 'themes' || tab === 'research'
        ? tab
        : 'catcakes';
    app.activeShopTab = validTab;
    app.activeModal = 'shop';
    app.modalScrollY = 0;
    app.uiAnim.modalOpenTimer = 0;
    app.uiAnim.tabSwitchTimer = 1;
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
    app.uiAnim.modalOpenTimer = 0;
    app.uiAnim.tabSwitchTimer = 1;
    audio.playPatronSelect();
    syncGameStateMirror();
    syncAudioMood();
  };

  app.setShopTab = function setShopTab(tabId) {
    if (
      tabId === 'catcakes' ||
      tabId === 'devices' ||
      tabId === 'patrons' ||
      tabId === 'themes' ||
      tabId === 'research'
    ) {
      if (app.activeShopTab !== tabId) {
        app.uiAnim.tabSwitchTimer = 0;
      }
      app.activeShopTab = tabId;
      app.modalScrollY = 0;
      audio.playPatronSelect();
    }
  };

  function emitShopBuyEvent(category, itemId, cost, level) {
    if (BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
      platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.shopBuy, {
        category: String(category || 'shop'),
        item_id: String(itemId || ''),
        cost: Math.max(0, Math.floor(Number(cost) || 0)),
        level: Math.max(0, Math.floor(Number(level) || 0))
      });
    }
  }

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
    emitShopBuyEvent('catcake', cake.id, cost, curLv + 1);
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
    emitShopBuyEvent('device', dev.id, cost, curLv + 1);
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
    emitShopBuyEvent('patron', pid, cost, 1);
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
      showToast('星尘不足，暂时无法解锁该烤盘主题', { icon: 'icon_stardust', tone: 'warn' });
      return false;
    }
    saveData.unlockedThemes.push(th.id);
    saveData.equippedTheme = th.id;
    persistSave(true);
    audio.playShopBuy();
    emitShopBuyEvent('theme', th.id, cost, 1);
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
    showToast(`已换上烤盘主题：${th.name}`, { icon: 'icon_ribbon' });
    return true;
  };

  app.buyResearchItem = function buyResearchItem(itemId) {
    const item = RESEARCH_ITEMS.find((it) => it.id === itemId);
    if (!item) return false;
    if (!saveData.researchUnlocks || typeof saveData.researchUnlocks !== 'object') {
      saveData.researchUnlocks = {};
    }
    if (saveData.researchUnlocks[item.id]) {
      showToast(`${item.name} 已解锁`, { icon: 'icon_check' });
      return false;
    }
    const cost = hasOwn(RESEARCH_COSTS, item.id) ? RESEARCH_COSTS[item.id] : item.cost || 0;
    if ((saveData.bankStardust || 0) < cost) {
      audio.playGridBlocked();
      showToast('星尘不足，暂时无法解锁该茶研成果', { icon: 'icon_stardust', tone: 'warn' });
      return false;
    }
    saveData.researchUnlocks[item.id] = true;
    persistSave(true);
    audio.playShopBuy();
    emitShopBuyEvent('research', item.id, cost, 1);
    showToast(`茶研所解锁：${item.name}！`, { icon: 'icon_stardust', tone: 'event', level: 'major' });
    return true;
  };

  // ==================== v0.13 M4: Settings, OpenData Friends & Rewarded Video Ads ====================

  app.toggleSetting = function toggleSetting(key) {
    if (key !== 'vibrateEnabled' && key !== 'lowPowerMode' && key !== 'colorblindMarks') {
      return false;
    }
    if (!saveData.settings || typeof saveData.settings !== 'object') {
      saveData.settings = { vibrateEnabled: true, lowPowerMode: false, colorblindMarks: false };
    }
    const curVal = key === 'vibrateEnabled' ? saveData.settings.vibrateEnabled !== false : Boolean(saveData.settings[key]);
    const nextVal = !curVal;
    saveData.settings[key] = nextVal;
    syncAudioPrefsFromSave();
    persistSave(true);
    audio.playPatronSelect();
    const labelMap = {
      vibrateEnabled: nextVal ? '震动开关已开启' : '震动开关已关闭',
      lowPowerMode: nextVal ? '节能轻量已开启' : '节能轻量已关闭',
      colorblindMarks: nextVal ? '色觉角标已开启' : '色觉角标已关闭'
    };
    showToast(labelMap[key], { icon: 'icon_check' });
    return nextVal;
  };

  let lastOpenDataKey = '';
  app.renderFriendsOpenData = function renderFriendsOpenData(w, h, dpr) {
    if (typeof platform.getOpenDataCanvas !== 'function') return null;
    const sharedCanvas = platform.getOpenDataCanvas();
    if (!sharedCanvas) return null;
    const key = `${w}x${h}@${dpr}`;
    if (key !== lastOpenDataKey) {
      lastOpenDataKey = key;
      if (typeof platform.postOpenDataMessage === 'function') {
        platform.postOpenDataMessage({
          type: 'render_friends',
          width: w,
          height: h,
          dpr,
          metric: 'stars'
        });
      }
    }
    return sharedCanvas;
  };

  app.shareToFriends = function shareToFriends() {
    if (typeof platform.triggerShare === 'function') {
      platform.triggerShare();
    }
    showToast('已打开分享，邀请好友一起做猫饼！', { icon: 'icon_ribbon', tone: 'success' });
    return true;
  };

  const AD_DOUBLE_STORAGE_KEY = 'hoshi_ad_double_v1';

  function readAdDoubleState() {
    const today = RunModifiers.getDailyDateKeyUTC8();
    const raw = platform.getStorageJSON ? platform.getStorageJSON(AD_DOUBLE_STORAGE_KEY) : null;
    if (raw && typeof raw === 'object' && raw.dateKey === today) {
      return { dateKey: today, count: Math.max(0, Math.floor(Number(raw.count) || 0)) };
    }
    return { dateKey: today, count: 0 };
  }

  function getAdDoubleRemaining() {
    const cap = (BalanceConfig.ADS && BalanceConfig.ADS.dailyDoubleDustCap) || 3;
    const st = readAdDoubleState();
    return Math.max(0, cap - st.count);
  }

  function incrementAdDoubleCount() {
    const st = readAdDoubleState();
    st.count += 1;
    if (platform.setStorageJSON) {
      platform.setStorageJSON(AD_DOUBLE_STORAGE_KEY, st);
    }
    return st.count;
  }

  function emitAdRewardEvent(placement, extra) {
    if (BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
      platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.adReward || 'ad_reward', {
        placement: String(placement || 'default'),
        ...(extra || {})
      });
    }
  }

  app.canReviveWithAd = function canReviveWithAd() {
    if (!BalanceConfig.ADS || !BalanceConfig.ADS.enabled) return false;
    if (!app.lastResult || app.lastResult.cleared) return false;
    if (!runCtx || !app.orderState) return false;
    if (BalanceConfig.ADS.reviveOncePerRun && runCtx.reviveUsed) return false;
    return true;
  };

  app.onReviveWithAd = function onReviveWithAd() {
    if (!app.canReviveWithAd()) return Promise.resolve(false);
    const adUnitId = (BalanceConfig.ADS && BalanceConfig.ADS.adUnitId) || 'adunit-placeholder-hoshi-reward';
    return platform.showRewardedVideoAd('revive', { adUnitId }).then((res) => {
      if (!res || !res.rewarded || !app.canReviveWithAd()) {
        showToast('未看完视频，暂未获得加时', { icon: 'icon_warn', tone: 'warn' });
        return false;
      }
      const addSec = (BalanceConfig.ADS && BalanceConfig.ADS.reviveAddSec) || 15;
      if (runCtx.mode === 'endless' && app.endlessRun && app.lastResult) {
        app.endlessRun.active = true;
        app.endlessRun.totalScore = Math.max(0, (app.endlessRun.totalScore || 0) - (app.lastResult.score || 0));
        app.endlessRun.totalServes = Math.max(0, (app.endlessRun.totalServes || 0) - (app.lastResult.ordersServed || 0));
      }
      runCtx.reviveUsed = true;
      app.orderState.timeLeft = addSec;
      app.orderState.settled = false;
      app.screen = 'playing';
      app.activeModal = null;
      app.lastResult = null;
      lastCountdownTickInt = 6;
      syncGameStateMirror();
      syncAudioMood();
      audio.playStartCafe();
      emitAdRewardEvent('revive', { mode: runCtx.mode, add_sec: addSec });
      showToast(`加时 +${addSec} 秒，继续营业！`, { icon: 'icon_clock', tone: 'event', level: 'major' });
      return true;
    });
  };

  app.canDoubleDustWithAd = function canDoubleDustWithAd() {
    if (!BalanceConfig.ADS || !BalanceConfig.ADS.enabled) return false;
    if (!app.lastResult || !app.lastResult.cleared) return false;
    if ((Number(app.lastResult.totalDustAward) || 0) <= 0) return false;
    if (app.lastResult.doubleClaimed) return false;
    return getAdDoubleRemaining() > 0;
  };

  app.onDoubleDustWithAd = function onDoubleDustWithAd() {
    if (!app.canDoubleDustWithAd()) return Promise.resolve(false);
    const adUnitId = (BalanceConfig.ADS && BalanceConfig.ADS.adUnitId) || 'adunit-placeholder-hoshi-reward';
    return platform.showRewardedVideoAd('double_dust', { adUnitId }).then((res) => {
      if (!res || !res.rewarded || !app.canDoubleDustWithAd()) {
        showToast('未看完视频，暂未获得双倍星尘', { icon: 'icon_warn', tone: 'warn' });
        return false;
      }
      const extra = Math.max(0, Math.floor(Number(app.lastResult.totalDustAward) || 0));
      saveData.totalEarnedStardust = Math.max(0, (saveData.totalEarnedStardust || 0) + extra);
      saveData.bankStardust = Math.max(0, (saveData.bankStardust || 0) + extra);
      app.lastResult.doubleClaimed = true;
      app.lastResult.doubleDustBonus = extra;
      incrementAdDoubleCount();
      persistSave(true);
      audio.playShopBuy();
      emitAdRewardEvent('double_dust', { dust: extra, remaining: getAdDoubleRemaining() });
      showToast(`双倍星尘 +${extra}！`, { icon: 'icon_stardust', tone: 'event', level: 'major' });
      return true;
    });
  };

  app.onRerollEndlessPerksWithAd = function onRerollEndlessPerksWithAd() {
    const eRun = app.endlessRun;
    if (!BalanceConfig.ADS || !BalanceConfig.ADS.enabled) return Promise.resolve(false);
    if (!eRun || !eRun.active || app.activeModal !== 'perk_pick' || eRun.pendingRerollUsed) {
      return Promise.resolve(false);
    }
    const adUnitId = (BalanceConfig.ADS && BalanceConfig.ADS.adUnitId) || 'adunit-placeholder-hoshi-reward';
    return platform.showRewardedVideoAd('perk_reroll', { adUnitId }).then((res) => {
      if (!res || !res.rewarded || !app.endlessRun || app.endlessRun.pendingRerollUsed) {
        showToast('未看完视频，加成未刷新', { icon: 'icon_warn', tone: 'warn' });
        return false;
      }
      eRun.pendingRerollUsed = true;
      const prevIds = (eRun.pendingChoices || []).map((p) => p && p.id).filter(Boolean);
      const exclude = eRun.perkIds.concat(prevIds);
      const rerollRng = Rng.createRng(Rng.hash32(`reroll:${eRun.seedBase}:${eRun.shift}`));
      let nextChoices = RunModifiers.pickPerkChoices(exclude, saveData.researchUnlocks, rerollRng, 3);
      if (nextChoices.length < 3) {
        nextChoices = RunModifiers.pickPerkChoices(eRun.perkIds, saveData.researchUnlocks, rerollRng, 3);
      }
      eRun.pendingChoices = nextChoices;
      audio.playPatronSelect();
      emitAdRewardEvent('perk_reroll', { shift: eRun.shift });
      showToast('已刷新本班 3 选 1 加成！', { icon: 'icon_ribbon', tone: 'success' });
      return true;
    });
  };

  app.openCompendium = function openCompendium(tab = 'catcakes') {
    app.activeCompendiumTab =
      tab === 'recipes' || tab === 'customers' ? tab : 'catcakes';
    app.activeModal = 'compendium';
    app.modalScrollY = 0;
    app.uiAnim.modalOpenTimer = 0;
    app.uiAnim.tabSwitchTimer = 1;
    audio.playPatronSelect();
    syncAudioMood();
  };

  app.setCompendiumTab = function setCompendiumTab(tab) {
    const next = tab === 'recipes' || tab === 'customers' ? tab : 'catcakes';
    if (app.activeCompendiumTab !== next) {
      app.uiAnim.tabSwitchTimer = 0;
    }
    app.activeCompendiumTab = next;
    app.modalScrollY = 0;
    audio.playPatronSelect();
  };

  app.selectCompendiumTier = function selectCompendiumTier(tier) {
    const t = clamp(Math.floor(Number(tier) || 1), 1, CATCAKES.length);
    app.selectedCompendiumTier = t;
    audio.playPatronSelect();
    return t;
  };

  app.openLeaderboard = function openLeaderboard(boardType = 'stars') {
    const bt = normalizeUiBoardType(boardType);
    app.leaderboardBoardType = bt;
    app.activeModal = 'leaderboard';
    app.modalScrollY = 0;
    app.uiAnim.modalOpenTimer = 0;
    app.uiAnim.tabSwitchTimer = 1;
    audio.playPatronSelect();
    syncAudioMood();
    fetchLeaderboard(bt);
  };

  app.setLeaderboardBoardType = function setLeaderboardBoardType(boardType) {
    const bt = normalizeUiBoardType(boardType);
    if (app.leaderboardBoardType !== bt) {
      app.modalScrollY = 0;
      app.uiAnim.tabSwitchTimer = 0;
      audio.playPatronSelect();
    }
    fetchLeaderboard(bt);
  };

  app.isDailyUnlocked = function isDailyUnlocked() {
    const req = (BalanceConfig.DAILY && BalanceConfig.DAILY.unlockLevel) || '1-5';
    return Boolean(saveData.levelStars && Number(saveData.levelStars[req] || 0) >= 1);
  };

  app.isEndlessUnlocked = function isEndlessUnlocked() {
    const req = (BalanceConfig.ENDLESS && BalanceConfig.ENDLESS.unlockLevel) || '1-10';
    return Boolean(saveData.levelStars && Number(saveData.levelStars[req] || 0) >= 1);
  };

  app.openChallenge = function openChallenge() {
    app.activeModal = 'challenge';
    app.modalScrollY = 0;
    app.uiAnim.modalOpenTimer = 0;
    app.uiAnim.tabSwitchTimer = 1;
    audio.playPatronSelect();
    syncAudioMood();
    return true;
  };

  app.startDailySpecial = function startDailySpecial(opts = {}) {
    if (!BalanceConfig.isFeatureOn('daily')) {
      showToast('每天特调暂未开启', { icon: 'icon_warn', tone: 'warn' });
      return false;
    }
    if (!(opts && opts.forceUnlock) && !app.isDailyUnlocked()) {
      audio.playGridBlocked();
      showToast(`通关第 ${BalanceConfig.DAILY.unlockLevel || '1-5'} 关后解锁每天特调`, {
        icon: 'icon_warn',
        tone: 'warn'
      });
      return false;
    }
    app.endlessRun = null;
    const cfg = RunModifiers.buildDailyChallengeConfig(opts && opts.dateKey);
    const started = startLevelInternal(cfg.id, {
      ...(opts || {}),
      customLevelCfg: cfg,
      seed: cfg.seed,
      skipTutorial: true,
      modeOverrides: {
        ...((opts && opts.modeOverrides) || {}),
        mode: 'daily',
        perkIds: cfg.perkIds.slice()
      }
    });
    if (started && BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
      platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.modeStart, {
        mode: 'daily',
        date_key: cfg.dateKey,
        perks: cfg.perkIds.join(',')
      });
    }
    return started;
  };

  app.startEndlessMode = function startEndlessMode(opts = {}) {
    if (!BalanceConfig.isFeatureOn('endless')) {
      showToast('无限营业暂未开启', { icon: 'icon_warn', tone: 'warn' });
      return false;
    }
    if (!(opts && opts.forceUnlock) && !app.isEndlessUnlocked()) {
      audio.playGridBlocked();
      showToast(`通关第 ${BalanceConfig.ENDLESS.unlockLevel || '1-10'} 关后解锁无限营业`, {
        icon: 'icon_warn',
        tone: 'warn'
      });
      return false;
    }
    const seedBase =
      opts && (typeof opts.seed === 'number' || typeof opts.seed === 'string')
        ? opts.seed
        : Date.now();
    const initialPerks = opts && Array.isArray(opts.perkIds) ? opts.perkIds.slice() : [];
    app.endlessRun = {
      active: true,
      shift: 1,
      totalScore: 0,
      totalServes: 0,
      totalDustEarned: 0,
      perkIds: initialPerks,
      seedBase,
      pendingChoices: [],
      pendingRerollUsed: false
    };
    const cfg = RunModifiers.buildEndlessShiftConfig(1, seedBase);
    const started = startLevelInternal(cfg.id, {
      ...(opts || {}),
      customLevelCfg: cfg,
      seed: cfg.seed,
      skipTutorial: true,
      modeOverrides: {
        ...((opts && opts.modeOverrides) || {}),
        mode: 'endless',
        shiftNum: 1,
        perkIds: app.endlessRun.perkIds.slice()
      }
    });
    if (started && BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
      platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.modeStart, {
        mode: 'endless',
        shift: 1
      });
    }
    return started;
  };

  app.pickEndlessPerk = function pickEndlessPerk(choiceIdx) {
    if (!app.endlessRun || !app.endlessRun.active) return false;
    const choices = Array.isArray(app.endlessRun.pendingChoices) ? app.endlessRun.pendingChoices : [];
    if (choices.length === 0) return false;
    const idx = clamp(Math.floor(Number(choiceIdx) || 0), 0, choices.length - 1);
    const picked = choices[idx];
    if (picked && picked.id && !app.endlessRun.perkIds.includes(picked.id)) {
      app.endlessRun.perkIds.push(picked.id);
    }
    app.endlessRun.pendingChoices = [];
    app.endlessRun.pendingRerollUsed = false;
    app.endlessRun.shift += 1;
    const nextCfg = RunModifiers.buildEndlessShiftConfig(
      app.endlessRun.shift,
      app.endlessRun.seedBase
    );
    audio.playShopBuy();
    if (picked) {
      showToast(`获得加持：${picked.name}`, { icon: 'icon_stardust', tone: 'event' });
    }
    return startLevelInternal(nextCfg.id, {
      customLevelCfg: nextCfg,
      seed: nextCfg.seed,
      skipTutorial: true,
      modeOverrides: {
        mode: 'endless',
        shiftNum: app.endlessRun.shift,
        perkIds: app.endlessRun.perkIds.slice()
      }
    });
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
    const lockInfo = isLevelUnlocked(lvl.id, saveData.levelStars);
    if (!lockInfo.unlocked) return false;
    app.selectedChapter = lvl.chapter;
    app.previewLevelId = lvl.id;
    app.activeModal = 'level_preview';
    app.modalScrollY = 0;
    app.uiAnim.modalOpenTimer = 0;
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
      'challenge',
      'perk_pick',
      'settings',
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
    app.uiAnim.modalOpenTimer = 0;
    app.uiAnim.tabSwitchTimer = 1;
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
    app.endlessRun = null;
    levelSkipTutorial = false;
    syncGameStateMirror();
    syncAudioMood();
  }

  app.closeModal = function closeModal() {
    if (!app.activeModal) return;
    const prevModal = app.activeModal;
    if (prevModal === 'perk_pick') {
      // Picking a perk is required to advance endless shift; allow escape only via picking #0
      return;
    }
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
    if (!res || res.mode === 'daily' || res.mode === 'endless' || !res.cleared) {
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
    } else if ((levelId === '1-4' || levelId === '2-1') && !(hasOwn(seen, 'flavor_tile') && seen.flavor_tile)) {
      app.activeTutorialStep = 'flavor_tile';
    } else if ((levelId === '1-8' || levelId === '3-1') && !(hasOwn(seen, 'ice_tile') && seen.ice_tile)) {
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
      if (BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
        platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.tutorialStep, {
          step: String(saveKey || ''),
          level_id: String(app.currentLevelId || '')
        });
      }
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

  // ==================== Run Context (mode overrides / seeded RNG / event bus) ====================

  function getModeOverrides() {
    return runCtx && runCtx.modeOverrides ? runCtx.modeOverrides : null;
  }

  function getOverride(key) {
    const mo = getModeOverrides();
    return mo && hasOwn(mo, key) ? mo[key] : undefined;
  }

  function getEffectivePatronId() {
    const ov = getOverride('selectedPatron');
    const ov2 = ov === undefined ? getOverride('patronId') : ov;
    return normalizePatronId(ov2 !== undefined && ov2 !== null ? ov2 : saveData.selectedPatron);
  }

  function getEffectiveCatcakeLevels() {
    const ov = getOverride('catcakeLevels');
    return ov && typeof ov === 'object' ? ov : saveData.catcakeLevels;
  }

  function getEffectiveDeviceLv(devId, maxLv) {
    const directKey = devId === 'dev_tray' ? 'devTrayLv' : devId === 'dev_teapot' ? 'devTeapotLv' : null;
    let raw;
    if (directKey && getOverride(directKey) !== undefined) {
      raw = getOverride(directKey);
    } else {
      const ovDev = getOverride('deviceUpgrades');
      if (ovDev && typeof ovDev === 'object' && hasOwn(ovDev, devId)) {
        raw = ovDev[devId];
      } else {
        raw = saveData.deviceUpgrades && saveData.deviceUpgrades[devId];
      }
    }
    return clamp(Math.floor(Number(raw) || 0), 0, maxLv);
  }

  function getCurrentLevelCfg() {
    if (runCtx && runCtx.levelCfg) return runCtx.levelCfg;
    return getLevelById(app.currentLevelId || (app.orderState && app.orderState.levelId)) || getLevelById('1-1');
  }

  /** Applies whitelisted level-shape overrides (daily / endless / challenge modes) onto a cloned level config. */
  function buildEffectiveLevelCfg(lvl, modeOverrides) {
    if (!modeOverrides) return lvl;
    const patch = modeOverrides.levelPatch && typeof modeOverrides.levelPatch === 'object' ? modeOverrides.levelPatch : {};
    const out = { ...lvl };
    const keys = ['matrix', 'presets', 'stars', 'urgentRate', 'vipQuota', 'vipQuotaRange', 'vipFixedRecipeId',
      'rushEndSec', 'allowedRecipes', 'durationSec', 'goal', 'events', 'name', 'desc'];
    for (let i = 0; i < keys.length; i++) {
      if (hasOwn(patch, keys[i]) && patch[keys[i]] !== undefined) out[keys[i]] = cloneJsonSafe(patch[keys[i]]);
    }
    if (Array.isArray(modeOverrides.stars) && modeOverrides.stars.length === 3) out.stars = modeOverrides.stars.slice();
    if (typeof modeOverrides.durationSec === 'number') out.durationSec = modeOverrides.durationSec;
    return out;
  }

  function emitRunEvent(name, payload) {
    if (runCtx && runCtx.events) runCtx.events.emit(name, payload);
  }

  function getActiveMods() {
    return runCtx && runCtx.mods ? runCtx.mods : null;
  }

  function getSpawnC2Rate() {
    const ovRate = getOverride('c2Rate');
    if (typeof ovRate === 'number' && Number.isFinite(ovRate)) {
      return clamp(ovRate, 0, 0.9);
    }
    const devFlourLv = getEffectiveDeviceLv('dev_flour', 3);
    const baseRate = SHOP_DEVICES[1].c2Rates[devFlourLv] || 0.10;
    const lunaBonus = getEffectivePatronId() === 'luna' ? 0.08 : 0;
    const mods = getActiveMods();
    const perkBonus = mods && Number.isFinite(mods.c2RateDelta) ? mods.c2RateDelta : 0;
    return clamp(baseRate + lunaBonus + perkBonus, 0.10, 0.65);
  }

  function getEffectiveFreshWindowSec() {
    const base = BalanceConfig.FRESH.windowSec || 6.0;
    const mods = getActiveMods();
    const perkDelta = mods && Number.isFinite(mods.freshWindowDelta) ? mods.freshWindowDelta : 0;
    const mult =
      runCtx && runCtx.levelEvents && BalanceConfig.isFeatureOn('events')
        ? LevelEvents.getFreshWindowMultiplier(runCtx.levelEvents)
        : 1.0;
    return (base + perkDelta) * mult;
  }

  function buildServeScoreCtx(extraCtx) {
    // CRITICAL: Omit comboCount, isFever, and lunaNextServeBoost so OrderService.matchTrayToCustomer
    // computes nextCombo, reads feverActive, and atomically consumes lunaNextServeBoost!
    const ctx = {
      catcakeLevels: getEffectiveCatcakeLevels(),
      devTrayLv: getEffectiveDeviceLv('dev_tray', 2),
      patronId: getEffectivePatronId(),
      rng: levelRng
    };
    const mods = getActiveMods();
    let sceneExtra = 0;
    const ovExtra = getOverride('sceneBonusExtra');
    if (typeof ovExtra === 'number' && Number.isFinite(ovExtra)) sceneExtra += ovExtra;
    if (runCtx && runCtx.levelEvents && BalanceConfig.isFeatureOn('events')) {
      sceneExtra += LevelEvents.getEventSceneBonus(runCtx.levelEvents);
    }
    if (mods && Number.isFinite(mods.flatSceneBonus) && mods.flatSceneBonus !== 0) {
      sceneExtra += mods.flatSceneBonus;
    }
    if (sceneExtra !== 0) ctx.sceneBonusExtra = sceneExtra;
    let sceneCap = getOverride('sceneCap');
    if (!(typeof sceneCap === 'number' && Number.isFinite(sceneCap))) {
      sceneCap = mods && mods.sceneCapOverride > 0 ? mods.sceneCapOverride : undefined;
    }
    if (typeof sceneCap === 'number' && Number.isFinite(sceneCap)) ctx.sceneCap = sceneCap;
    // v0.10 M1 + v0.11 M2 + v0.12 M3: fresh bonus clock (品质区) + hot_oven window + Fever V2 scene bonus (场面区) + customer trait (顾客区)
    if (app.orderState) ctx.nowSec = Number(app.orderState.elapsedSec) || 0;
    ctx.freshWindowSec = getEffectiveFreshWindowSec();
    const baseFeverScene = BalanceConfig.isFeatureOn('feverV2')
      ? BalanceConfig.FEVER_V2.sceneBonus
      : BalanceConfig.SCORE_ZONES.feverSceneBonus;
    const perkFeverDelta = mods && Number.isFinite(mods.feverSceneDelta) ? mods.feverSceneDelta : 0;
    if (BalanceConfig.isFeatureOn('feverV2') || perkFeverDelta !== 0) {
      ctx.feverSceneBonus = baseFeverScene + perkFeverDelta;
    }
    if (extraCtx && typeof extraCtx.traitMult === 'number' && Number.isFinite(extraCtx.traitMult)) {
      ctx.traitMult = extraCtx.traitMult;
    }
    return ctx;
  }

  function getNowSec() {
    return app.orderState ? Number(app.orderState.elapsedSec) || 0 : 0;
  }

  function refreshNeededAndOrderMarks() {
    if (!app.orderState) return;
    OrderService.refreshAllOrderMarks(app.orderState);
    app.neededTiers = OrderService.getNeededBoardTiers(app.orderState);
  }

  function startLevelInternal(levelId, opts = {}) {
    const baseLvl =
      opts && opts.customLevelCfg && typeof opts.customLevelCfg === 'object'
        ? opts.customLevelCfg
        : getLevelById(levelId);
    if (!baseLvl) return false;

    const modeOverrides =
      opts && opts.modeOverrides && typeof opts.modeOverrides === 'object'
        ? opts.modeOverrides
        : null;
    const lvl = buildEffectiveLevelCfg(baseLvl, modeOverrides);
    const hasSeed = opts && (typeof opts.seed === 'number' || typeof opts.seed === 'string');
    const rngs = Rng.createLevelRngs(hasSeed ? opts.seed : null);
    if (runCtx && runCtx.events) runCtx.events.clear();
    // Feature overrides only live for one run: always restore the previous run's flags first.
    if (typeof restoreRunFeatures === 'function') {
      restoreRunFeatures();
      restoreRunFeatures = null;
    }
    if (opts && opts.features && typeof opts.features === 'object') {
      restoreRunFeatures = BalanceConfig.withFeatures(opts.features);
    }

    const perkIds =
      modeOverrides && Array.isArray(modeOverrides.perkIds)
        ? modeOverrides.perkIds.slice()
        : Array.isArray(lvl.perkIds)
        ? lvl.perkIds.slice()
        : [];
    const mods = RunModifiers.compileRunModifiers(perkIds);

    runCtx = {
      mode: (modeOverrides && typeof modeOverrides.mode === 'string' && modeOverrides.mode) || lvl.mode || 'campaign',
      levelCfg: lvl,
      modeOverrides,
      mods,
      traits: CustomerTraits.createTraitRunState(),
      seed: rngs.seed,
      rngs,
      events: GameEvents.createEventBus(),
      stats: createRunStats(),
      dough: DoughTemp.createDoughTemp(),
      goal: null,
      levelEvents: null,
      feverExtended: 0
    };

    lastFrameMs = rawNowMs();
    levelRng = opts && typeof opts.rng === 'function' ? opts.rng : rngs.grid;
    customerRng = opts && typeof opts.rng === 'function' ? opts.rng : rngs.customer;
    if (runCtx.mode === 'campaign') {
      app.selectedChapter = lvl.chapter;
      app.previewLevelId = lvl.id;
    }
    app.currentLevelId = lvl.id;
    app.screen = 'playing';
    app.activeModal = null;
    app.confirmDialog = null;
    app.lastResult = null;
    app.activeTool = null;
    app.forkSourceCell = null;
    app.animState = createEmptyAnimState();

    const ovTools = getOverride('tools');
    const devToolsLv = getEffectiveDeviceLv('dev_tools', 3);
    const startTools =
      ovTools && typeof ovTools === 'object'
        ? { fork: clamp(Math.floor(Number(ovTools.fork) || 0), 0, 9), spoon: clamp(Math.floor(Number(ovTools.spoon) || 0), 0, 9) }
        : SHOP_DEVICES[3].startTools[devToolsLv] || { fork: 1, spoon: 0 };
    app.toolCounts = {
      fork: clamp((startTools.fork || 0) + (mods.grantFork || 0), 0, 9),
      spoon: clamp((startTools.spoon || 0) + (mods.grantSpoon || 0), 0, 9)
    };
    app.toolBoughtThisLevel = { fork: 0, spoon: 0 };

    const failStreak =
      runCtx.mode === 'campaign' &&
      saveData &&
      saveData.levelFailStreaks &&
      hasOwn(saveData.levelFailStreaks, lvl.id)
        ? Math.max(0, Math.floor(Number(saveData.levelFailStreaks[lvl.id]) || 0))
        : 0;
    runCtx.failStreak = failStreak;
    const baseCharge = opts && opts.forceCharge ? 100 : 0;
    const softPityActive = failStreak >= 2 && baseCharge < 40;
    app.skillEnergy = softPityActive ? 40 : baseCharge;
    app.starPopTimers = [0, 0, 0];
    app.kneadPressTimer = 0;
    app.boardFullHintTimer = 0;

    kneadCooldown = 0;
    lastCountdownTickInt = 6;
    unlockedStarsMask = 0;
    lastTrayTapSlot = -1;
    lastTrayTapTimeMs = -99999;
    runForkUses = 0;
    runSpoonUses = 0;

    const patron = PATRONS.find((p) => p.id === getEffectivePatronId()) || PATRONS[0];
    app.playPatronSpeech = softPityActive
      ? '别灰心喵！已为你预充 40% 招牌技星能，加油营业吧！'
      : patron.greet;

    app.gridState = GridEngine.createGridState(lvl, lvl.presets);
    if (Array.isArray(mods.startSpawnTiers) && mods.startSpawnTiers.length > 0) {
      for (let i = 0; i < mods.startSpawnTiers.length; i++) {
        const spTier = mods.startSpawnTiers[i];
        GridEngine.kneadSpawn(app.gridState, { tierTable: [[spTier, 1]], rng: levelRng });
      }
    }

    const orderOverrides = {
      ...(modeOverrides || {}),
      trayCapDelta: (modeOverrides && Number(modeOverrides.trayCapDelta) ? Number(modeOverrides.trayCapDelta) : 0) + (mods.trayCapDelta || 0),
      trashCooldownMult: (modeOverrides && Number(modeOverrides.trashCooldownMult) > 0 ? Number(modeOverrides.trashCooldownMult) : 1) * (mods.trashCooldownMult || 1),
      comboWindowDelta: (modeOverrides && Number(modeOverrides.comboWindowDelta) ? Number(modeOverrides.comboWindowDelta) : 0) + (mods.comboWindowDelta || 0),
      patienceMultExtra: (modeOverrides && Number(modeOverrides.patienceMultExtra) > 0 ? Number(modeOverrides.patienceMultExtra) : 1) * (mods.patienceMult || 1),
      urgentBountyDelta: (modeOverrides && Number(modeOverrides.urgentBountyDelta) ? Number(modeOverrides.urgentBountyDelta) : 0) + (mods.urgentBountyDelta || 0)
    };
    app.orderState = OrderService.createOrderState(lvl, saveData, customerRng, orderOverrides);
    const initialIce = GridEngine.countFrozenTiles(app.gridState);
    runCtx.goal = BalanceConfig.isFeatureOn('goals')
      ? LevelGoals.createGoalState(lvl.goal, { initialIce })
      : LevelGoals.createGoalState(null, { initialIce: 0 });
    runCtx.stats.goalDone = Boolean(runCtx.goal && runCtx.goal.done);
    runCtx.levelEvents = LevelEvents.createEventState(lvl, rngs.event, {
      enabled: BalanceConfig.isFeatureOn('events'),
      disableSchedule: Boolean(opts && opts.disableEvents),
      forcedEvents: opts && opts.forcedEvents
    });
    refreshNeededAndOrderMarks();
    levelSkipTutorial = Boolean(opts && opts.skipTutorial) || runCtx.mode !== 'campaign';
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
    emitRunEvent('run:start', { levelCfg: lvl, mode: runCtx.mode });
    if (BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
      platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.levelStart, {
        level_id: lvl.id,
        mode: runCtx.mode,
        fail_streak: failStreak,
        patron: patron.id
      });
    }
    return true;
  }

  app.startLevel = function startLevel(levelId, opts = {}) {
    if (typeof levelId === 'string' && levelId.indexOf('daily_') === 0) {
      return app.startDailySpecial({ ...(opts || {}), dateKey: levelId.slice(6), forceUnlock: true });
    }
    if (typeof levelId === 'string' && levelId.indexOf('endless_') === 0) {
      return app.startEndlessMode({ ...(opts || {}), forceUnlock: true });
    }
    return startLevelInternal(levelId, opts);
  };

  // ==================== v0.10 M1: crit / fresh / dough / fever V2 helpers ====================

  const TIPS_STORAGE_KEY = 'hoshi_tips_v1';
  const M1_TIPS = {
    bake_crit: '烘焙暴击：一次滑动合出 2 个以上 C3+ 会引发双重/三重烘焙，奖励热潮与星能！',
    fresh: '新出炉的猫饼带着热气，6 秒内上菜品质 +15%，整单热乎还会加热潮！',
    dough_temp: '面团温度：稳定节奏揉面保持金色温区，C2 概率更高且有保底；连点过快会过热锁定！',
    fever_v2: '星光热潮中滑动可连锁合成，揉面必出 C2/C3，每次上菜还能延长热潮！'
  };

  /** One-time gameplay tips (major toast). Persisted into v3 saveData.seenTips (keeps seenTutorials at exact 4 keys). */
  function maybeShowTip(key) {
    if (headlessSimMode || levelSkipTutorial || !hasOwn(M1_TIPS, key)) return false;
    if (!saveData.seenTips || typeof saveData.seenTips !== 'object') {
      saveData.seenTips = {};
    }
    if (saveData.seenTips[key] === true) return false;
    let legacySeen = null;
    try {
      legacySeen = platform.getStorageJSON(TIPS_STORAGE_KEY);
    } catch (e) {
      legacySeen = null;
    }
    const legacyObj = legacySeen && typeof legacySeen === 'object' && !Array.isArray(legacySeen) ? legacySeen : {};
    if (legacyObj[key] === true) {
      saveData.seenTips[key] = true;
      return false;
    }
    saveData.seenTips[key] = true;
    legacyObj[key] = true;
    try {
      platform.setStorageJSON(TIPS_STORAGE_KEY, legacyObj);
    } catch (e) {
      // storage failure only means legacy key wasn't mirrored
    }
    SaveSync.saveLocalSave(platform, saveData);
    showToast(M1_TIPS[key], { icon: 'icon_stardust', tone: 'event', level: 'major', duration: 3.2 });
    return true;
  }

  function getFeverScenePercent() {
    const z = BalanceConfig.isFeatureOn('feverV2')
      ? BalanceConfig.FEVER_V2.sceneBonus
      : BalanceConfig.SCORE_ZONES.feverSceneBonus || 0.25;
    const mods = getActiveMods();
    const extra = mods && Number.isFinite(mods.feverSceneDelta) ? mods.feverSceneDelta : 0;
    return Math.round((z + extra) * 100);
  }

  /** Shared Fever start FX (serve-triggered or crit-triggered). */
  function onFeverTriggered(source) {
    audio.setFeverMode(true);
    audio.playFeverStart();
    if (runCtx) {
      runCtx.stats.feverCount += 1;
      runCtx.feverExtended = 0;
    }
    emitRunEvent('fever:start', { source: source || 'serve' });
    showToast(`星光热潮开启！10 秒内得分 +${getFeverScenePercent()}% 且耐心减半流逝`, {
      icon: 'icon_stardust',
      tone: 'event',
      level: 'major'
    });
    if (BalanceConfig.isFeatureOn('feverV2')) maybeShowTip('fever_v2');
  }

  const CRIT_LABELS = ['', '', '双重烘焙！', '三重烘焙！', '星光暴击！'];

  /**
   * Bake crit (方向A): ≥2 merges creating C(minNewTier)+ in ONE slide. Rewards are resources only
   * (fever energy, patron skill energy, gild / +1 tier on the best new tile) — never direct score.
   */
  function handleBakeCrit(res) {
    if (!BalanceConfig.isFeatureOn('bakeCrit') || !res || !res.moved) return null;
    const rawLevel = Math.floor(Number(res.critLevel) || 0);
    if (rawLevel < 2) return null;
    const level = Math.min(4, rawLevel);
    const tierCfg = BalanceConfig.BAKE_CRIT.tiers[level] || BalanceConfig.BAKE_CRIT.tiers[2];
    if (!tierCfg) return null;

    const mods = getActiveMods();
    const skillAdd = tierCfg.skill + (mods ? mods.critExtraSkill || 0 : 0);
    const feverAdd = tierCfg.fever + (mods ? mods.critExtraFever || 0 : 0);
    if (skillAdd > 0) app.skillEnergy = clamp(app.skillEnergy + skillAdd, 0, 100);
    const feverRes = feverAdd > 0
      ? OrderService.addFeverEnergy(app.orderState, feverAdd)
      : { gained: 0, triggered: false };
    const reward = GridEngine.applyBakeCritReward(app.gridState, res.mergeEvents || [], {
      gild: tierCfg.gild > 0,
      upgrade: tierCfg.upgrade > 0
    });

    if (runCtx) {
      const crits = runCtx.stats.crits;
      if (Array.isArray(crits)) crits[level] = (crits[level] || 0) + 1;
    }

    // FX: popup above the rewarded (or last merged) cell + gold ring + shake + SFX
    let fxR = reward.applied ? reward.r : -1;
    let fxC = reward.applied ? reward.c : -1;
    if (fxR < 0 && Array.isArray(res.mergeEvents) && res.mergeEvents.length > 0) {
      const last = res.mergeEvents[res.mergeEvents.length - 1];
      fxR = last.r;
      fxC = last.c;
    }
    if (fxR >= 0 && fxC >= 0) {
      const pt = cellCenterScreenPos(fxR, fxC);
      app.animState.popups.push({
        text: CRIT_LABELS[level] || '双重烘焙！',
        subText: reward.applied && reward.upgraded ? '升阶+镀金' : reward.applied && reward.gilded ? '镀金' : '',
        x: pt.x,
        y: pt.y - 6,
        color: level >= 4 ? '#FFF2A8' : level >= 3 ? '#FFD45E' : '#FFC27A',
        timer: 0.8,
        duration: 0.8
      });
      app.animState.cellFX.push({ r: fxR, c: fxC, kind: 'crit', level, timer: 0.42, duration: 0.42 });
    }
    app.animState.critShake = { level, timer: 0.16 + level * 0.03, duration: 0.16 + level * 0.03 };
    if (typeof audio.playCrit === 'function') audio.playCrit(level);
    platform.vibrateShort(level >= 3 ? 'heavy' : 'medium');

    const info = {
      level,
      feverGain: feverRes.gained,
      feverTriggered: Boolean(feverRes.triggered),
      skillGain: tierCfg.skill,
      reward
    };
    emitRunEvent('crit', info);
    if (feverRes.triggered) onFeverTriggered('crit');
    maybeShowTip('bake_crit');
    return info;
  }

  /** Picks a deterministic pity flavor from current order needs (no RNG draw). */
  function pickPityFlavor() {
    const needed = app.neededTiers && Array.isArray(app.neededTiers.allNeeded) ? app.neededTiers.allNeeded : [];
    for (let i = 0; i < needed.length; i++) {
      const f = needed[i] && needed[i].flavor;
      if (f === 'matcha' || f === 'berry') return f;
    }
    return 'plain';
  }

  // ==================== v0.11 M2: goals / earlyClose / events helpers ====================

  function handleGoalNewlyCompleted() {
    if (!runCtx || !runCtx.goal) return;
    runCtx.stats.goalDone = true;
    if (typeof audio.playGoalDone === 'function') audio.playGoalDone();
    showToast('关卡目标达成！', { icon: 'icon_check', tone: 'success', level: 'major' });
    emitRunEvent('goal:done', { goal: runCtx.goal });
  }

  function maybeTriggerEarlyClose() {
    if (
      app.screen !== 'playing' ||
      !runCtx ||
      !runCtx.goal ||
      !app.orderState ||
      !BalanceConfig.isFeatureOn('goals')
    ) {
      return false;
    }
    const lvl = getCurrentLevelCfg();
    const starsArr =
      Array.isArray(app.orderState.starsOverride) && app.orderState.starsOverride.length >= 3
        ? app.orderState.starsOverride
        : lvl && Array.isArray(lvl.stars)
          ? lvl.stars
          : [850, 1250, 1750];
    const star1 = starsArr[0];
    const star3 = starsArr[2];
    const chapter = lvl ? lvl.chapter : 1;
    const ok = LevelGoals.shouldTriggerEarlyClose(runCtx.goal, {
      ordersServed: app.orderState.ordersServed,
      elapsedSec: app.orderState.elapsedSec,
      score: app.orderState.score,
      star1,
      star3,
      timeLeft: app.orderState.timeLeft,
      chapter
    });
    if (!ok) return false;
    const bonus = LevelGoals.computeEarlyCloseBonus(app.orderState.timeLeft, chapter);
    if (bonus > 0) {
      showToast(`提前打烊！剩余时间奖励 +${bonus} 分`, {
        icon: 'icon_stardust',
        tone: 'success',
        level: 'major'
      });
    }
    settleCurrentLevel({ earlyCloseBonus: bonus });
    return true;
  }

  function syncGoalIceCount() {
    if (!runCtx || !runCtx.goal || !app.gridState || !BalanceConfig.isFeatureOn('goals')) return;
    if (runCtx.goal.type !== 'ice_clear') return;
    const rem = GridEngine.countFrozenTiles(app.gridState);
    if (LevelGoals.onIceCountChanged(runCtx.goal, rem, getNowSec())) {
      handleGoalNewlyCompleted();
    }
  }

  function countEmptyPlayableCells() {
    const g = app.gridState;
    if (!g || !Array.isArray(g.cells)) return 0;
    let n = 0;
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const cell = g.cells[r] && g.cells[r][c];
        if (cell && cell.type !== 'void' && cell.type !== 'block' && !cell.tile) n += 1;
      }
    }
    return n;
  }

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

    const slideOpts = {
      c2Rate: getSpawnC2Rate(),
      rng: levelRng
    };
    if (BalanceConfig.isFeatureOn('freshBonus')) slideOpts.nowSec = getNowSec();
    if (BalanceConfig.isFeatureOn('bakeCrit')) slideOpts.critMinTier = BalanceConfig.BAKE_CRIT.minNewTier;
    if (
      BalanceConfig.isFeatureOn('feverV2') &&
      BalanceConfig.FEVER_V2.chainMerge &&
      app.orderState.feverActive
    ) {
      slideOpts.chainMerge = true;
      slideOpts.chainMaxPasses = BalanceConfig.FEVER_V2.chainMaxPasses;
    }
    const res = GridEngine.slideGrid(app.gridState, dir, slideOpts);

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
      RunModifiers.applyMergePerkEffects(app.gridState, res.mergeEvents, getActiveMods());
      app.animState.mergeEvents = res.mergeEvents;
      app.animState.mergeTimer = 0.22;
      app.animState.mergeDuration = 0.22;

      let maxMergedTier = 2;
      let hasGoldMerge = false;
      for (let i = 0; i < res.mergeEvents.length; i++) {
        const me = res.mergeEvents[i];
        const nt = me.newTier || me.tier || 2;
        if (nt > maxMergedTier) maxMergedTier = nt;
        const cellTile =
          Number.isInteger(me.r) &&
          Number.isInteger(me.c) &&
          app.gridState.cells[me.r] &&
          app.gridState.cells[me.r][me.c] &&
          app.gridState.cells[me.r][me.c].tile;
        if (cellTile && cellTile.flavor) me.flavor = cellTile.flavor;
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
      syncGoalIceCount();
    }

    if (app.activeTutorialStep === 'flavor_tile') {
      let dyedFlavor = false;
      for (let r = 0; r < app.gridState.rows; r++) {
        for (let c = 0; c < app.gridState.cols; c++) {
          const cell = app.gridState.cells[r][c];
          if (
            cell &&
            (cell.type === 'matcha' || cell.type === 'berry' || cell.type === 'gold') &&
            cell.tile &&
            cell.tile.flavor &&
            cell.tile.flavor !== 'plain'
          ) {
            dyedFlavor = true;
          }
        }
      }
      if (!dyedFlavor && res.mergeEvents) {
        dyedFlavor = res.mergeEvents.some((m) => m && m.flavor && m.flavor !== 'plain');
      }
      if (dyedFlavor) {
        completeTutorialSaveKey('flavor_tile');
      }
    }

    if (res.skillChargeGain > 0) {
      app.skillEnergy = clamp(app.skillEnergy + res.skillChargeGain, 0, 100);
    }

    const critInfo = handleBakeCrit(res);
    if (critInfo) res.crit = critInfo;

    if (runCtx) {
      runCtx.stats.slides += 1;
      runCtx.stats.merges += res.mergeEvents ? res.mergeEvents.length : 0;
    }
    emitRunEvent('slide', { dir, result: res });

    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    maybeTriggerEarlyClose();
    return res;
  }

  /**
   * @param {boolean} bypassCooldown debug/test path: skips cooldown AND dough temperature / fever
   *   knead table (raw C1/C2 roll) unless opts.realistic is set (balance simulator).
   * @param {{realistic?: boolean}} [opts]
   */
  function executeKnead(bypassCooldown = false, opts = undefined) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.gridState || !app.orderState) {
      return { spawned: false, reason: 'not_playing' };
    }
    if (!bypassCooldown && kneadCooldown > 0) {
      return { spawned: false, reason: 'cooldown' };
    }
    const realistic = !bypassCooldown || Boolean(opts && opts.realistic);
    const dough = runCtx ? runCtx.dough : null;
    const inFever = Boolean(app.orderState.feverActive);

    if (
      realistic &&
      runCtx &&
      runCtx.goal &&
      BalanceConfig.isFeatureOn('goals') &&
      !LevelGoals.canKneadUnderGoal(runCtx.goal)
    ) {
      app.kneadPressTimer = 0.06;
      audio.playGridBlocked();
      showToast('本关揉面次数已用完，请滑动合成或装盘！', { icon: 'icon_warn', tone: 'warn' });
      return { spawned: false, reason: 'knead_limit_reached' };
    }

    if (realistic && dough && BalanceConfig.isFeatureOn('doughTemp') && dough.locked) {
      app.kneadPressTimer = 0.06;
      if (typeof audio.playOverheat === 'function') audio.playOverheat(false);
      else audio.playGridBlocked();
      return { spawned: false, reason: 'overheat_locked' };
    }

    const spawnOpts = {
      c2Rate: getSpawnC2Rate(),
      rng: levelRng
    };
    let kneadInfo = null;
    let flourSaleHit = null;
    // Only heat the dough when the knead can actually land (board-full presses are free).
    if (realistic && countEmptyPlayableCells() > 0) {
      const mods = getActiveMods();
      if (runCtx && runCtx.levelEvents && BalanceConfig.isFeatureOn('events')) {
        flourSaleHit = LevelEvents.consumeKneadEvent(runCtx.levelEvents);
      }
      if (inFever && BalanceConfig.isFeatureOn('feverV2')) {
        spawnOpts.tierTable = BalanceConfig.FEVER_V2.kneadTierTable;
        kneadInfo = { zone: 'fever', pity: false, overheated: false };
      } else if (dough && BalanceConfig.isFeatureOn('doughTemp')) {
        kneadInfo = DoughTemp.onKnead(dough, {
          failStreak: runCtx ? runCtx.failStreak : 0,
          inFever,
          warmMinDelta: mods ? mods.doughWarmMinDelta || 0 : 0
        });
        if (kneadInfo.forceTier) {
          spawnOpts.tierTable = [[kneadInfo.forceTier, 1]];
          if (kneadInfo.pity) spawnOpts.flavor = pickPityFlavor();
        } else if (kneadInfo.c2Bonus > 0) {
          spawnOpts.c2Rate = clamp(spawnOpts.c2Rate + kneadInfo.c2Bonus, 0, 0.9);
        }
      }
      if (flourSaleHit && flourSaleHit.forceTier && !(kneadInfo && kneadInfo.overheated) && !(kneadInfo && kneadInfo.pity)) {
        spawnOpts.tierTable = [[flourSaleHit.forceTier, 1]];
      }
      if (
        runCtx &&
        runCtx.traits &&
        runCtx.traits.pendingKneadOverride &&
        !(kneadInfo && kneadInfo.overheated)
      ) {
        const ov = runCtx.traits.pendingKneadOverride;
        runCtx.traits.pendingKneadOverride = null;
        spawnOpts.tierTable = [[ov.tier, 1]];
        if (ov.flavor) spawnOpts.flavor = ov.flavor;
      }
    }

    const res = GridEngine.kneadSpawn(app.gridState, spawnOpts);

    app.kneadPressTimer = 0.11;
    if (!res.spawned) {
      audio.playGridBlocked();
      app.boardFullHintTimer = 1.8;
      showToast('烤盘已无空格，先装盘或合成腾出位置吧', { icon: 'icon_warn', tone: 'warn' });
      return res;
    }
    if (kneadInfo) res.dough = kneadInfo;
    if (realistic && runCtx && runCtx.goal && BalanceConfig.isFeatureOn('goals')) {
      LevelGoals.onKneadForGoal(runCtx.goal);
    }

    if (!bypassCooldown) {
      kneadCooldown = 0.12;
    }
    if (kneadInfo && kneadInfo.overheated) {
      if (runCtx) runCtx.stats.overheats += 1;
      if (typeof audio.playOverheat === 'function') audio.playOverheat(true);
      const pt = cellCenterScreenPos(res.r, res.c);
      app.animState.popups.push({
        text: '过热！',
        subText: '面团冷却一下',
        x: pt.x,
        y: pt.y - 4,
        color: '#FF8A7A',
        timer: 0.7,
        duration: 0.7
      });
      maybeShowTip('dough_temp');
    } else {
      audio.playKneadSpawn();
      if (kneadInfo && kneadInfo.zone === 'warm') {
        if (runCtx) runCtx.stats.warmKneads += 1;
        maybeShowTip('dough_temp');
      }
      if (kneadInfo && kneadInfo.pity) {
        if (runCtx) runCtx.stats.pityHits += 1;
        const pt = cellCenterScreenPos(res.r, res.c);
        app.animState.popups.push({
          text: '面团正好！',
          subText: `C${res.tile ? res.tile.tier : 3}`,
          x: pt.x,
          y: pt.y - 4,
          color: '#FFD45E',
          timer: 0.7,
          duration: 0.7
        });
      }
    }
    app.animState.cellFX.push({
      r: res.r,
      c: res.c,
      kind: 'knead',
      timer: 0.13,
      duration: 0.13
    });

    if (app.activeTutorialStep === 'intro_slide_2') {
      app.activeTutorialStep = 'intro_slide_3';
    } else if (
      app.activeTutorialStep === 'flavor_tile' &&
      res.tile &&
      res.tile.flavor &&
      res.tile.flavor !== 'plain'
    ) {
      completeTutorialSaveKey('flavor_tile');
    }

    if (runCtx) runCtx.stats.kneads += 1;
    emitRunEvent('knead', { result: res });

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
    if (typeof cell.tile.bakedAt === 'number' && Number.isFinite(cell.tile.bakedAt)) {
      tileSnap.bakedAt = cell.tile.bakedAt;
    }
    const trayRes = OrderService.tryPlaceToTray(app.orderState, tileSnap);
    if (!trayRes.placed) {
      audio.playGridBlocked();
      app.animState.trashWobbleTimer = 0.65;
      refreshNeededAndOrderMarks();
      const anyReady = app.orderState.seats.some((s) => s && s.readyToServe);
      if (anyReady) {
        showToast('配餐托盘已满！请点击上方发光顾客上菜，或双击托盘丢弃', {
          icon: 'icon_check',
          tone: 'warn'
        });
      } else if ((app.orderState.trashCooldown || 0) > 1e-6) {
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
      if (!anyReady) {
        maybeArmTrayTrashTutorial(true);
      }
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
    refreshNeededAndOrderMarks();
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
    refreshNeededAndOrderMarks();
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
    refreshNeededAndOrderMarks();
    if (seat.readyToServe) {
      const serveRes = executeServeSeat(seatIdx);
      return Boolean(serveRes && serveRes.served);
    }
    app.orderState.preferredSeatIdx =
      app.orderState.preferredSeatIdx === seatIdx ? null : seatIdx;
    audio.playPatronSelect();
    refreshNeededAndOrderMarks();
    syncGameStateMirror();
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
        res.tile.flavor &&
        res.tile.flavor !== 'plain'
      ) {
        completeTutorialSaveKey('flavor_tile');
      }
      syncGoalIceCount();
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
        res.tile.flavor &&
        res.tile.flavor !== 'plain'
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
        ((res.tile && res.tile.flavor && res.tile.flavor !== 'plain') ||
          (res.swappedTile && res.swappedTile.flavor && res.swappedTile.flavor !== 'plain'))
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
      RunModifiers.applyMergePerkEffects(app.gridState, [{ r: toR, c: toC }], getActiveMods());
      const mergedCellTile =
        app.gridState.cells[toR] &&
        app.gridState.cells[toR][toC] &&
        app.gridState.cells[toR][toC].tile;
      const newTier = mergedCellTile ? mergedCellTile.tier : res.tile ? res.tile.tier : 2;
      const newFlavor = mergedCellTile ? mergedCellTile.flavor : res.tile ? res.tile.flavor : 'plain';
      if (res.tile && mergedCellTile) res.tile.flavor = mergedCellTile.flavor;
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
      if (app.activeTutorialStep === 'flavor_tile' && newFlavor && newFlavor !== 'plain') {
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

    const patronId = getEffectivePatronId();
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
        syncGoalIceCount();
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
    maybeTriggerEarlyClose();
    return { casted: true, ok: true, patronId, ...res };
  }

  app.onTapPatronSkill = function onTapPatronSkill() {
    executeCastPatronSkill({});
  };

  // ==================== Manual Customer Serving, Simulation & Settlement ====================

  function executeServeSeat(targetSeatIdx) {
    if (app.screen !== 'playing' || app.activeModal !== null || !app.orderState || !app.gridState) {
      return { served: false, reason: 'not_playing' };
    }
    const seatBefore =
      Array.isArray(app.orderState.seats) && Number.isInteger(targetSeatIdx)
        ? app.orderState.seats[targetSeatIdx]
        : null;
    const traySnap = app.orderState.tray.slice();
    const trayCap = Math.max(1, Number(app.orderState.trayCapacity) || 3);
    let trayFilledBefore = 0;
    for (let i = 0; i < trayCap; i++) {
      if (app.orderState.tray[i]) trayFilledBefore += 1;
    }
    const trayWasFull = trayFilledBefore >= trayCap;

    // Pre-evaluate allHot & customer trait score multiplier (顾客区) before serve consumes tray
    let previewAllHot = false;
    if (seatBefore && BalanceConfig.isFeatureOn('freshBonus')) {
      const preMatch = OrderService.matchCustomerWithTray(seatBefore, app.orderState.tray);
      if (preMatch && preMatch.matched && preMatch.usedTrayIndices.length > 0) {
        const nowPre = getNowSec();
        const freshWin = getEffectiveFreshWindowSec();
        const minFreshTier = BalanceConfig.FRESH.minTier || 2;
        previewAllHot = preMatch.usedTrayIndices.every((idx) => {
          const t = app.orderState.tray[idx];
          if (!t || (Number(t.tier) || 0) < minFreshTier) return false;
          if (typeof t.bakedAt !== 'number' || !Number.isFinite(t.bakedAt)) return false;
          const age = nowPre - t.bakedAt;
          return age >= -1e-6 && age <= freshWin;
        });
      }
    }
    const traitMult =
      BalanceConfig.isFeatureOn('traits') && seatBefore
        ? CustomerTraits.computeTraitScoreMult(seatBefore, { allHot: previewAllHot })
        : 1.0;

    const serveRes = OrderService.serveCustomerSeat(
      app.orderState,
      targetSeatIdx,
      buildServeScoreCtx({ traitMult })
    );
    if (!serveRes || !serveRes.served) {
      return { served: false, reason: 'not_ready' };
    }

    const seatIdx = serveRes.seatIdx || 0;
    const toPt = seatCenterPos(seatIdx);
    const usedIndices = Array.isArray(serveRes.usedTrayIndices) ? serveRes.usedTrayIndices : [];
    const usedTiles = usedIndices.map((idx) => traySnap[idx]).filter(Boolean);
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

    const mods = getActiveMods();
    if (trayWasFull && mods && mods.fullTraySkillGain > 0) {
      app.skillEnergy = clamp(app.skillEnergy + mods.fullTraySkillGain, 0, 100);
      app.animState.popups.push({
        text: `满盘欢赞 +${mods.fullTraySkillGain}%`,
        subText: '',
        x: toPt.x,
        y: toPt.y - 32,
        color: '#A7F3B5',
        timer: 0.65,
        duration: 0.65
      });
    }

    audio.playServeBell();
    audio.playOrderComplete();
    platform.vibrateShort('medium');

    if (runCtx && runCtx.levelEvents && BalanceConfig.isFeatureOn('events')) {
      LevelEvents.consumeServeEvent(runCtx.levelEvents);
    }

    if (runCtx) runCtx.stats.totalItemsServed += usedIndices.length;
    if (runCtx) {
      const hotCount = Math.max(0, Math.floor(Number(serveRes.hotCount) || 0));
      runCtx.stats.hotItems += hotCount;
      if (serveRes.allHot) runCtx.stats.hotServes += 1;
      if (hotCount > 0) maybeShowTip('fresh');
    }
    if (serveRes.allHot) {
      app.animState.popups.push({
        text: '热乎！',
        subText: '',
        x: toPt.x,
        y: toPt.y - 18,
        color: '#FFB36B',
        timer: 0.6,
        duration: 0.6
      });
    }

    // v0.12 M3: Customer trait post-serve side effects (never directly add score)
    if (BalanceConfig.isFeatureOn('traits') && seatBefore && runCtx && runCtx.traits) {
      const maxP = Math.max(1, Number(seatBefore.maxPatience) || 1);
      const pRatio = (Number(seatBefore.patience) || 0) / maxP;
      const tr = CustomerTraits.evaluateServeTrait(
        runCtx.traits,
        {
          customerId: seatBefore.customerId,
          pRatio,
          itemCount: usedTiles.length,
          usedTiles,
          slots: seatBefore.slots,
          allHot: Boolean(serveRes.allHot)
        },
        customerRng
      );
      if (tr && tr.triggered) {
        if (tr.patienceOthers > 0) {
          OrderService.boostSeatsPatience(app.orderState, tr.patienceOthers, seatIdx);
        }
        if (tr.patienceAll > 0) {
          OrderService.boostSeatsPatience(app.orderState, tr.patienceAll, -1);
        }
        if (tr.feverGain > 0) {
          const traitFev = OrderService.addFeverEnergy(app.orderState, tr.feverGain);
          if (traitFev && traitFev.triggered) onFeverTriggered('trait');
        }
        if (tr.skillGain > 0) {
          app.skillEnergy = clamp(app.skillEnergy + tr.skillGain, 0, 100);
        }
        if (tr.giftTool === 'fork' || tr.giftTool === 'spoon') {
          app.toolCounts[tr.giftTool] = clamp((app.toolCounts[tr.giftTool] || 0) + 1, 0, 9);
        }
        if (tr.text) {
          app.animState.popups.push({
            text: tr.text,
            subText: '',
            x: toPt.x,
            y: toPt.y + 42,
            color: '#FFD998',
            timer: 0.78,
            duration: 0.78
          });
        }
      }
    }

    if (runCtx && runCtx.goal && BalanceConfig.isFeatureOn('goals')) {
      const newlyDone = LevelGoals.onServeForGoal(
        runCtx.goal,
        {
          isVip: Boolean(seatBefore && seatBefore.isVip),
          customerId: seatBefore ? seatBefore.customerId : null,
          usedTiles,
          comboCount: app.orderState.comboCount,
          allHot: Boolean(serveRes.allHot)
        },
        getNowSec()
      );
      if (newlyDone) handleGoalNewlyCompleted();
    }
    emitRunEvent('serve', { seatIdx, result: serveRes, usedTiles });

    // Fever V2: every serve during Fever extends it (capped per Fever unless eternal_fever perk is active)
    if (
      serveRes.wasInFever &&
      !serveRes.triggeredFever &&
      runCtx &&
      BalanceConfig.isFeatureOn('feverV2')
    ) {
      let want = 0;
      if (mods && mods.eternalFeverExtend > 0) {
        want = mods.eternalFeverExtend;
      } else {
        const room = Math.max(0, BalanceConfig.FEVER_V2.extendCap - (runCtx.feverExtended || 0));
        want = Math.min(BalanceConfig.FEVER_V2.extendPerServe, room);
      }
      if (want > 1e-6) {
        const added = OrderService.extendFever(app.orderState, want);
        if (added > 0) {
          runCtx.feverExtended = (runCtx.feverExtended || 0) + added;
          runCtx.stats.feverExtendSec += added;
          app.animState.popups.push({
            text: `热潮 +${added.toFixed(added % 1 === 0 ? 0 : 1)}s`,
            subText: '',
            x: toPt.x,
            y: toPt.y + 26,
            color: '#C9A8FF',
            timer: 0.6,
            duration: 0.6
          });
        }
      }
    }

    if (serveRes.triggeredFever) {
      onFeverTriggered('serve');
    }

    // Check 1~3 Star crossings
    const lvl = getCurrentLevelCfg();
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

    refreshNeededAndOrderMarks();
    syncGameStateMirror();
    maybeTriggerEarlyClose();
    return {
      served: true,
      seatIdx,
      scoreGain: serveRes.scoreGain || 0,
      usedTrayIndices: usedIndices,
      triggeredFever: Boolean(serveRes.triggeredFever)
    };
  }

  function ensureSaveModeStats() {
    if (!saveData.modeStats || typeof saveData.modeStats !== 'object') {
      saveData.modeStats = {
        daily: { lastDate: '', bestScore: 0, claimedDate: '', claimed3Date: '' },
        endless: { bestShift: 0, bestScore: 0, runs: 0, dailyDustDate: '', dailyDust: 0 }
      };
    }
    if (!saveData.modeStats.daily || typeof saveData.modeStats.daily !== 'object') {
      saveData.modeStats.daily = { lastDate: '', bestScore: 0, claimedDate: '', claimed3Date: '' };
    }
    if (!saveData.modeStats.endless || typeof saveData.modeStats.endless !== 'object') {
      saveData.modeStats.endless = { bestShift: 0, bestScore: 0, runs: 0, dailyDustDate: '', dailyDust: 0 };
    }
    return saveData.modeStats;
  }

  function settleCurrentLevel(settleExtra) {
    if (!app.orderState || !app.currentLevelId) return;
    const lvl = getCurrentLevelCfg();
    const mode = runCtx ? runCtx.mode : 'campaign';
    const prevBest = (saveData.levelBestScores && saveData.levelBestScores[lvl.id]) || 0;
    const earlyCloseBonus =
      settleExtra && Number.isFinite(Number(settleExtra.earlyCloseBonus)) && Number(settleExtra.earlyCloseBonus) > 0
        ? Math.floor(Number(settleExtra.earlyCloseBonus))
        : 0;
    const goalDone = Boolean(!runCtx || !runCtx.goal || runCtx.goal.done);
    if (runCtx) runCtx.stats.goalDone = goalDone;
    const settlement = OrderService.computeLevelSettlement(lvl, app.orderState, saveData, {
      goalDone,
      earlyCloseBonus
    });
    const finalScore = settlement.finalScore;
    const trashDiscards = Math.max(0, Math.floor(Number(app.orderState.trashDiscards) || 0));
    const runStats = runCtx ? runCtx.stats : createRunStats();
    runStats.angryWalkouts = Math.max(0, Math.floor(Number(app.orderState.angryWalkouts) || 0));

    // ---- Mode: Endless Shift Settlement ----
    if (mode === 'endless') {
      const eRun = app.endlessRun || {
        active: true,
        shift: lvl.shiftNum || 1,
        totalScore: 0,
        totalServes: 0,
        totalDustEarned: 0,
        perkIds: [],
        seedBase: 1,
        pendingChoices: [],
        pendingRerollUsed: false
      };
      const targetScore = Number(lvl.targetScore) || (Array.isArray(lvl.stars) ? lvl.stars[0] : 1800);
      const shiftCleared = Boolean(app.orderState.ordersServed >= 1 && finalScore >= targetScore);
      eRun.totalScore += finalScore;
      eRun.totalServes += app.orderState.ordersServed;

      const ms = ensureSaveModeStats();
      const todayKey = RunModifiers.getDailyDateKeyUTC8();
      if (ms.endless.dailyDustDate !== todayKey) {
        ms.endless.dailyDustDate = todayKey;
        ms.endless.dailyDust = 0;
      }
      const dustCap = (BalanceConfig.ENDLESS && BalanceConfig.ENDLESS.dailyDustCap) || 60;
      const dustPerShift = (BalanceConfig.ENDLESS && BalanceConfig.ENDLESS.dustPerShift) || 2;
      const dustRoom = Math.max(0, dustCap - (ms.endless.dailyDust || 0));
      const shiftDust = shiftCleared ? Math.min(dustRoom, dustPerShift) : 0;
      if (shiftDust > 0) {
        ms.endless.dailyDust += shiftDust;
        eRun.totalDustEarned += shiftDust;
        saveData.totalEarnedStardust = (saveData.totalEarnedStardust || DEFAULT_INITIAL_STARDUST) + shiftDust;
      }
      const shiftsDone = shiftCleared ? eRun.shift : Math.max(0, eRun.shift - 1);
      const prevEndlessBest = ms.endless.bestScore || 0;
      ms.endless.bestShift = Math.max(ms.endless.bestShift || 0, shiftsDone);
      ms.endless.bestScore = Math.max(ms.endless.bestScore || 0, eRun.totalScore);
      if (!shiftCleared) {
        ms.endless.runs = (ms.endless.runs || 0) + 1;
        saveData.lifetimeStats.runsPlayed = Math.min(999999, (saveData.lifetimeStats.runsPlayed || 0) + 1);
      }
      saveData.lifetimeStats.ordersServed = Math.min(9999999, (saveData.lifetimeStats.ordersServed || 0) + app.orderState.ordersServed);
      saveData.lifetimeStats.vipServed = Math.min(9999999, (saveData.lifetimeStats.vipServed || 0) + app.orderState.vipServed);
      saveData.lifetimeStats.maxComboEver = Math.max(saveData.lifetimeStats.maxComboEver || 0, app.orderState.maxCombo || 0);
      saveData.lifetimeStats.highestSingleServe = Math.max(saveData.lifetimeStats.highestSingleServe || 0, app.orderState.highestSingleServe || 0);

      const savedNorm = SaveSync.saveLocalSave(platform, saveData);
      Object.assign(saveData, savedNorm);
      const eRunReport = {
        mode: 'endless',
        levelId: lvl.id,
        shift: eRun.shift,
        score: eRun.totalServes === 0 ? 0 : eRun.totalScore,
        serves: Math.max(app.orderState.ordersServed, eRun.totalServes),
        ordersServed: Math.max(app.orderState.ordersServed, eRun.totalServes),
        stars: shiftCleared ? 3 : 0,
        durationSec: Math.max(3, Math.round(app.orderState.elapsedSec || lvl.durationSec))
      };
      scheduleCloudPush(eRunReport);

      if (shiftCleared) {
        const choices = RunModifiers.pickPerkChoices(
          eRun.perkIds,
          saveData.researchUnlocks,
          runCtx && runCtx.rngs ? runCtx.rngs.event : customerRng,
          3
        );
        app.endlessRun = eRun;
        if (choices.length > 0) {
          eRun.pendingChoices = choices;
          eRun.pendingRerollUsed = false;
          app.activeTool = null;
          app.forkSourceCell = null;
          app.activeModal = 'perk_pick';
          app.modalScrollY = 0;
          app.uiAnim.modalOpenTimer = 0;
          audio.playShiftClear();
          if (shiftDust > 0) {
            showToast(`第 ${eRun.shift} 班达成！星尘 +${shiftDust}`, { icon: 'icon_stardust', tone: 'success' });
          }
          syncGameStateMirror();
          syncAudioMood();
          return;
        }
        // All perks collected: advance directly to next shift
        eRun.shift += 1;
        const nextCfg = RunModifiers.buildEndlessShiftConfig(eRun.shift, eRun.seedBase);
        startLevelInternal(nextCfg.id, {
          customLevelCfg: nextCfg,
          seed: nextCfg.seed,
          skipTutorial: true,
          modeOverrides: {
            mode: 'endless',
            shiftNum: eRun.shift,
            perkIds: eRun.perkIds.slice()
          }
        });
        return;
      }

      eRun.active = false;
      app.endlessRun = eRun;
      const diagnostics = RunDiagnostics.buildRunDiagnostics({ ...settlement, cleared: false }, runStats);
      app.lastResult = {
        mode: 'endless',
        levelId: lvl.id,
        score: finalScore,
        endlessTotalScore: eRun.totalScore,
        shiftReached: eRun.shift,
        shiftsCleared: Math.max(0, eRun.shift - 1),
        targetScore,
        perkIds: eRun.perkIds.slice(),
        serveScore: app.orderState.ordersServed >= 1 ? app.orderState.score : 0,
        ordersServed: app.orderState.ordersServed,
        vipServed: app.orderState.vipServed,
        maxCombo: app.orderState.maxCombo,
        trashDiscards,
        forkUses: runForkUses,
        spoonUses: runSpoonUses,
        failStreak: 0,
        softPityNextRun: false,
        isNewBest: eRun.totalScore > prevEndlessBest && eRun.totalServes > 0,
        elapsedRevealSec: 0,
        diagnostics,
        goalBadge: null,
        ...settlement,
        cleared: false,
        starsEarned: 0,
        totalDustAward: eRun.totalDustEarned
      };
      app.screen = 'result';
      app.activeTool = null;
      app.forkSourceCell = null;
      app.activeTutorialStep = null;
      app.tutorialSkipRect = null;
      app.activeModal = 'level_result';
      app.uiAnim.modalOpenTimer = 0;
      audio.playGameOver();
      syncGameStateMirror();
      syncAudioMood();
      return;
    }

    // ---- Mode: Daily Special Settlement ----
    if (mode === 'daily') {
      const dateKey = (lvl && lvl.dateKey) || RunModifiers.getDailyDateKeyUTC8();
      const ms = ensureSaveModeStats();
      const dStat = ms.daily;
      const prevDailyBest = dStat.lastDate === dateKey ? (dStat.bestScore || 0) : 0;
      let dailyDust = 0;
      const alreadyClaimedClear = dStat.claimedDate === dateKey;
      const alreadyClaimed3 = dStat.claimed3Date === dateKey;
      if (settlement.cleared && !alreadyClaimedClear) {
        dailyDust += (BalanceConfig.DAILY && BalanceConfig.DAILY.clearDust) || 15;
        dStat.claimedDate = dateKey;
      }
      if (settlement.starsEarned >= 3 && !alreadyClaimed3) {
        dailyDust += (BalanceConfig.DAILY && BalanceConfig.DAILY.threeStarDust) || 15;
        dStat.claimed3Date = dateKey;
      }
      if (app.orderState.ordersServed >= 1) {
        dStat.lastDate = dateKey;
        dStat.bestScore = Math.max(prevDailyBest, finalScore);
      }
      if (dailyDust > 0) {
        saveData.totalEarnedStardust = (saveData.totalEarnedStardust || DEFAULT_INITIAL_STARDUST) + dailyDust;
      }
      saveData.lifetimeStats.runsPlayed = Math.min(999999, (saveData.lifetimeStats.runsPlayed || 0) + 1);
      saveData.lifetimeStats.ordersServed = Math.min(9999999, (saveData.lifetimeStats.ordersServed || 0) + app.orderState.ordersServed);
      saveData.lifetimeStats.vipServed = Math.min(9999999, (saveData.lifetimeStats.vipServed || 0) + app.orderState.vipServed);
      saveData.lifetimeStats.maxComboEver = Math.max(saveData.lifetimeStats.maxComboEver || 0, app.orderState.maxCombo || 0);
      saveData.lifetimeStats.highestSingleServe = Math.max(saveData.lifetimeStats.highestSingleServe || 0, app.orderState.highestSingleServe || 0);

      const savedNorm = SaveSync.saveLocalSave(platform, saveData);
      Object.assign(saveData, savedNorm);
      const dRunReport = {
        mode: 'daily',
        levelId: lvl.id,
        dateKey,
        score: app.orderState.ordersServed === 0 ? 0 : finalScore,
        serves: app.orderState.ordersServed,
        ordersServed: app.orderState.ordersServed,
        stars: settlement.starsEarned,
        durationSec: Math.max(3, Math.round(app.orderState.elapsedSec || lvl.durationSec))
      };
      scheduleCloudPush(dRunReport);

      const diagnostics = RunDiagnostics.buildRunDiagnostics(settlement, runStats);
      app.lastResult = {
        mode: 'daily',
        dateKey,
        perks: Array.isArray(lvl.perks) ? lvl.perks.slice() : [],
        levelId: lvl.id,
        score: finalScore,
        serveScore: app.orderState.ordersServed >= 1 ? app.orderState.score : 0,
        ordersServed: app.orderState.ordersServed,
        vipServed: app.orderState.vipServed,
        maxCombo: app.orderState.maxCombo,
        trashDiscards,
        forkUses: runForkUses,
        spoonUses: runSpoonUses,
        failStreak: 0,
        softPityNextRun: false,
        isNewBest: app.orderState.ordersServed >= 1 && finalScore > prevDailyBest,
        elapsedRevealSec: 0,
        diagnostics,
        goalBadge: null,
        ...settlement,
        totalDustAward: dailyDust
      };
      app.screen = 'result';
      app.activeTool = null;
      app.forkSourceCell = null;
      app.activeTutorialStep = null;
      app.tutorialSkipRect = null;
      app.activeModal = 'level_result';
      app.uiAnim.modalOpenTimer = 0;
      if (settlement.cleared) {
        audio.playShiftClear();
        for (let s = 1; s <= settlement.starsEarned; s++) audio.playStarUnlock(s);
      } else {
        audio.playGameOver();
      }
      syncGameStateMirror();
      syncAudioMood();
      return;
    }

    // ---- Mode: Campaign Settlement ----
    const persistCampaign = mode === 'campaign';
    if (persistCampaign && !settlement.cleared && settlement.totalDustAward > 0 && runCtx) {
      if (runCtx.consolationAwarded) {
        settlement.consolationDust = 0;
        settlement.totalDustAward = 0;
      } else {
        runCtx.consolationAwarded = true;
      }
    }

    if (persistCampaign) {
      const updatedSave = SaveSync.recordLevelSettlementToSave(
        saveData,
        lvl.id,
        finalScore,
        settlement.starsEarned,
        settlement.totalDustAward,
        {
          ordersServed: app.orderState.ordersServed,
          vipServed: app.orderState.vipServed,
          maxCombo: app.orderState.maxCombo,
          highestSingleServe: app.orderState.highestSingleServe,
          goalDone
        }
      );
      SaveSync.saveLocalSave(platform, updatedSave);
      Object.assign(saveData, updatedSave);
      platform.setWxFriendCloudScore(saveData);
    }

    const failStreakAfter =
      !settlement.cleared &&
      saveData.levelFailStreaks &&
      hasOwn(saveData.levelFailStreaks, lvl.id)
        ? Math.max(0, Math.floor(Number(saveData.levelFailStreaks[lvl.id]) || 0))
        : 0;

    const runReport = {
      mode: 'campaign',
      levelId: lvl.id,
      score: app.orderState.ordersServed === 0 ? 0 : finalScore,
      earlyCloseBonus: settlement.earlyCloseBonus || 0,
      serves: app.orderState.ordersServed,
      ordersServed: app.orderState.ordersServed,
      stars: settlement.starsEarned,
      durationSec: Math.max(3, Math.round(app.orderState.elapsedSec || lvl.durationSec)),
      trashDiscards,
      forkUses: runForkUses,
      spoonUses: runSpoonUses
    };
    const diagnostics = RunDiagnostics.buildRunDiagnostics(settlement, runStats);
    const telemetry = {
      mode,
      seed: runCtx && runCtx.seed !== null ? runCtx.seed : 0,
      balanceVersion: BalanceConfig.BALANCE_VERSION,
      slides: runStats.slides,
      merges: runStats.merges,
      kneads: runStats.kneads,
      crit2: runStats.crits[2],
      crit3: runStats.crits[3],
      crit4: runStats.crits[4],
      hotServes: runStats.hotServes,
      feverCount: runStats.feverCount,
      overheats: runStats.overheats,
      angryWalkouts: runStats.angryWalkouts,
      goalDone: runStats.goalDone ? 1 : 0,
      eventsSeen: runStats.eventsSeen.length
    };
    runReport.telemetry = telemetry;
    if (persistCampaign) scheduleCloudPush(runReport);
    if (BalanceConfig.TELEMETRY.enabled && typeof platform.reportEvent === 'function') {
      platform.reportEvent(BalanceConfig.TELEMETRY.eventNames.levelEnd, {
        level_id: lvl.id,
        score: runReport.score,
        stars: runReport.stars,
        serves: runReport.serves,
        cleared: settlement.cleared ? 1 : 0,
        fail_streak: failStreakAfter,
        ...telemetry
      });
    }
    emitRunEvent('run:end', { settlement, runReport });

    app.lastResult = {
      mode: 'campaign',
      levelId: lvl.id,
      score: finalScore,
      serveScore: app.orderState.ordersServed >= 1 ? app.orderState.score : 0,
      ordersServed: app.orderState.ordersServed,
      vipServed: app.orderState.vipServed,
      maxCombo: app.orderState.maxCombo,
      trashDiscards,
      forkUses: runForkUses,
      spoonUses: runSpoonUses,
      failStreak: failStreakAfter,
      softPityNextRun: failStreakAfter >= 2,
      isNewBest: app.orderState.ordersServed >= 1 && finalScore > prevBest,
      elapsedRevealSec: 0,
      diagnostics,
      goalBadge: runCtx && runCtx.goal ? LevelGoals.formatGoalBadge(runCtx.goal) : null,
      ...settlement
    };

    app.screen = 'result';
    app.activeTool = null;
    app.forkSourceCell = null;
    app.activeTutorialStep = null;
    app.tutorialSkipRect = null;
    app.activeModal = 'level_result';
    app.uiAnim.modalOpenTimer = 0;

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
    if (app.uiAnim) {
      if (app.uiAnim.modalOpenTimer < 1) {
        app.uiAnim.modalOpenTimer = Math.min(1, app.uiAnim.modalOpenTimer + dt / 0.22);
      }
      if (app.uiAnim.tabSwitchTimer < 1) {
        app.uiAnim.tabSwitchTimer = Math.min(1, app.uiAnim.tabSwitchTimer + dt / 0.18);
      }
      if (app.uiAnim.chapterFadeTimer < 1) {
        app.uiAnim.chapterFadeTimer = Math.min(1, app.uiAnim.chapterFadeTimer + dt / 0.28);
      }
      const bgmTarget = audio && audio.bgmEnabled && audio.bgmTrack !== 'off' ? 1 : 0;
      const sfxTarget = audio && audio.sfxEnabled ? 1 : 0;
      const toggleStep = Math.min(1, dt * 14);
      app.uiAnim.bgmSwitchPos += (bgmTarget - app.uiAnim.bgmSwitchPos) * toggleStep;
      app.uiAnim.sfxSwitchPos += (sfxTarget - app.uiAnim.sfxSwitchPos) * toggleStep;
      if (Math.abs(bgmTarget - app.uiAnim.bgmSwitchPos) < 0.01) app.uiAnim.bgmSwitchPos = bgmTarget;
      if (Math.abs(sfxTarget - app.uiAnim.sfxSwitchPos) < 0.01) app.uiAnim.sfxSwitchPos = sfxTarget;
    }

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
    if (anim.critShake && anim.critShake.timer > 0) {
      anim.critShake.timer = Math.max(0, anim.critShake.timer - dt);
      if (anim.critShake.timer <= 0) anim.critShake = null;
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

    // v0.10 M1: dough temperature cools / overheat lock counts down on the same gameplay clock.
    if (runCtx && runCtx.dough && BalanceConfig.isFeatureOn('doughTemp')) {
      DoughTemp.tickDoughTemp(runCtx.dough, dt);
    }

    // v0.11 M2: Star Oven ('O') cells bake resting tiles < C5 up +1 tier every ovenSec.
    const ovenRes = GridEngine.tickOvenCells(app.gridState, dt, {
      ovenSec: BalanceConfig.CELLS.ovenSec,
      maxTier: BalanceConfig.CELLS.ovenMaxTier,
      nowSec: BalanceConfig.isFeatureOn('freshBonus') ? getNowSec() : null
    });
    if (ovenRes.upgradedCells && ovenRes.upgradedCells.length > 0) {
      if (typeof audio.playOvenDing === 'function') audio.playOvenDing();
      for (let i = 0; i < ovenRes.upgradedCells.length; i++) {
        const oc = ovenRes.upgradedCells[i];
        app.animState.cellFX.push({ r: oc.r, c: oc.c, kind: 'crit', level: 2, timer: 0.36, duration: 0.36 });
        const pt = cellCenterScreenPos(oc.r, oc.c);
        app.animState.popups.push({
          text: `星炉升阶 C${oc.newTier}`,
          subText: '',
          x: pt.x,
          y: pt.y - 6,
          color: '#FFD45E',
          timer: 0.7,
          duration: 0.7
        });
      }
      refreshNeededAndOrderMarks();
    }

    // v0.11 M2: Mid-shift level events (critic_visit / flour_sale / hot_oven / frost_snap / delivery_rush).
    if (runCtx && runCtx.levelEvents && BalanceConfig.isFeatureOn('events')) {
      const evTick = LevelEvents.tickEvents(runCtx.levelEvents, dt, getNowSec());
      if (evTick.started) {
        runCtx.stats.eventsSeen.push(evTick.started.id);
        if (typeof audio.playEvent === 'function') audio.playEvent(evTick.started.tone);
        showToast(`${evTick.started.name}：${evTick.started.desc}`, {
          icon: 'icon_stardust',
          tone: 'event',
          level: 'major',
          duration: 2.8
        });
        emitRunEvent('event:start', { event: evTick.started });
      }
      if (evTick.frostTrigger > 0) {
        const frozen = GridEngine.freezeRandomTiles(
          app.gridState,
          evTick.frostTrigger,
          runCtx.rngs ? runCtx.rngs.event : levelRng
        );
        if (frozen.length > 0) {
          audio.playIceShatter();
          showToast(`冰霜降临！冻住了 ${frozen.length} 块猫饼`, {
            icon: 'tile_ice',
            tone: 'warn',
            level: 'major'
          });
          syncGoalIceCount();
          refreshNeededAndOrderMarks();
        }
      }
    }

    if (app.activeTutorialStep === 'tray_trash' && tutorialAutoFadeTimer > 0) {
      tutorialAutoFadeTimer = Math.max(0, tutorialAutoFadeTimer - dt);
      if (tutorialAutoFadeTimer <= 0) {
        completeTutorialSaveKey('tray_trash');
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
      rng: customerRng
    });

    // v0.11 M2: apply delivery_rush rider modifier to the next newly spawned non-VIP customer
    if (
      tickRes.spawnedSeats &&
      tickRes.spawnedSeats.length > 0 &&
      runCtx &&
      runCtx.levelEvents &&
      runCtx.levelEvents.pendingDeliveryRider &&
      BalanceConfig.isFeatureOn('events')
    ) {
      for (let i = 0; i < tickRes.spawnedSeats.length; i++) {
        const seat = app.orderState.seats[tickRes.spawnedSeats[i]];
        if (seat && !seat.isVip) {
          const rider = LevelEvents.consumeDeliveryRider(runCtx.levelEvents);
          if (rider) {
            seat.maxPatience = Math.max(8, +(seat.maxPatience * rider.patienceMult).toFixed(2));
            seat.patience = seat.maxPatience;
            seat.bountyMult = +(Math.max(1, Number(seat.bountyMult) || 1) * rider.bountyMult).toFixed(2);
            seat.isDeliveryRush = true;
          }
          break;
        }
      }
    }

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
      if (runCtx) runCtx.feverExtended = 0;
      if (BalanceConfig.isFeatureOn('feverV2') && BalanceConfig.FEVER_V2.afterglowC1toC2) {
        const glow = GridEngine.applyFeverAfterglow(app.gridState);
        const cells = glow && Array.isArray(glow.upgradedCells) ? glow.upgradedCells : [];
        if (cells.length > 0) {
          for (let i = 0; i < cells.length; i++) {
            app.animState.cellFX.push({ r: cells[i].r, c: cells[i].c, kind: 'spawn', timer: 0.2, duration: 0.2 });
          }
          if (runCtx) runCtx.stats.afterglowTiles += cells.length;
          showToast(`热潮余温：${cells.length} 块 C1 升为 C2`, { icon: 'icon_stardust', tone: 'success' });
          refreshNeededAndOrderMarks();
        }
        emitRunEvent('fever:end', { afterglow: cells.length });
      } else {
        emitRunEvent('fever:end', { afterglow: 0 });
      }
    }

    if (tickRes.spawnedSeats && tickRes.spawnedSeats.length > 0) {
      refreshNeededAndOrderMarks();
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

    if (maybeTriggerEarlyClose()) return;

    if (tl <= 0) {
      settleCurrentLevel();
    }
  }

  function advanceSimulation(totalSeconds, maxStepSec = 0.05) {
    const n = Number(totalSeconds);
    if (!Number.isFinite(n) || n <= 0) return;
    const safeSec = Math.min(n, 3600);
    const stepCap = headlessSimMode && Number.isFinite(maxStepSec) ? clamp(maxStepSec, 0.01, 0.2) : 0.05;

    simElapsedMs += safeSec * 1000;
    let remaining = safeSec;
    while (remaining > 1e-9) {
      const stepDt = Math.min(stepCap, remaining);
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
    if (headlessSimMode) return;
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

    const downHit = hits.findAt(x, y);
    if (app.uiAnim) {
      app.uiAnim.pressedHitId = downHit ? downHit.id : null;
    }

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
      if (downHit && downHit.meta && typeof downHit.meta.slotIdx === 'number') {
        pointerState.downTraySlot = downHit.meta.slotIdx;
        return;
      }
      if (!downHit && isPointInsideBoardStage(x, y)) {
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
    if (dist >= 10 && app.uiAnim && app.uiAnim.pressedHitId) {
      app.uiAnim.pressedHitId = null;
    }

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
    if (app.uiAnim) app.uiAnim.pressedHitId = null;
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
          ...(src && src.type === 'oven' && Number.isFinite(src.ovenSec)
            ? { ovenSec: Math.round(src.ovenSec * 100) / 100 }
            : {}),
          tile: t
            ? {
                uid: t.uid,
                tier: t.tier,
                flavor: t.flavor,
                frozenHp: t.frozenHp || 0,
                ...(typeof t.bakedAt === 'number' ? { bakedAt: t.bakedAt } : {})
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

  function buildDoughSnapshot() {
    const d = runCtx ? runCtx.dough : null;
    if (!d) return null;
    const mods = getActiveMods();
    const warmMinDelta = mods ? mods.doughWarmMinDelta || 0 : 0;
    return {
      temp: Math.round(d.temp * 100) / 100,
      zone: DoughTemp.getZone(d, { warmMinDelta }),
      ratio: DoughTemp.getTempRatio(d),
      locked: Boolean(d.locked),
      lockTimer: d.lockTimer,
      lockDuration: d.lockDuration,
      warmStreak: d.warmStreak,
      overheats: d.overheats,
      pityHits: d.pityHits
    };
  }
  app.getDoughView = buildDoughSnapshot;

  function buildGoalSnapshot() {
    if (!runCtx || !runCtx.goal) return null;
    const g = runCtx.goal;
    const badge = LevelGoals.formatGoalBadge(g);
    return {
      type: g.type,
      target: g.target,
      progress: g.progress,
      remainingIce: g.remainingIce,
      kneadsUsed: g.kneadsUsed,
      earlyClose: Boolean(g.earlyClose),
      done: Boolean(g.done),
      badge
    };
  }
  app.getGoalView = buildGoalSnapshot;

  function buildActiveEventSnapshot() {
    const ev = runCtx && runCtx.levelEvents && runCtx.levelEvents.active;
    if (!ev) return null;
    return {
      id: ev.id,
      name: ev.name,
      desc: ev.desc,
      tone: ev.tone,
      timer: Math.round(ev.timer * 100) / 100,
      duration: ev.duration,
      chargesLeft: ev.chargesLeft
    };
  }
  app.getActiveEventView = buildActiveEventSnapshot;
  app.getEffectiveFreshWindowSec = getEffectiveFreshWindowSec;
  app.getActivePerks = () => (runCtx && runCtx.mods && Array.isArray(runCtx.mods.perks) ? runCtx.mods.perks : []);
  app.getRunMode = () => (runCtx ? runCtx.mode : 'campaign');

  const debugApi = {
    version: GAME_VERSION,

    getRunInfo() {
      if (!runCtx) return null;
      return {
        mode: runCtx.mode,
        seed: runCtx.seed,
        levelId: runCtx.levelCfg ? runCtx.levelCfg.id : null,
        stars: runCtx.levelCfg && Array.isArray(runCtx.levelCfg.stars) ? runCtx.levelCfg.stars.slice() : null,
        stats: cloneJsonSafe(runCtx.stats),
        goal: buildGoalSnapshot(),
        activeEvent: buildActiveEventSnapshot(),
        perkIds: runCtx.mods ? runCtx.mods.perkIds.slice() : [],
        traits: runCtx.traits ? cloneJsonSafe(runCtx.traits) : null,
        endlessRun: app.endlessRun ? cloneJsonSafe(app.endlessRun) : null,
        patronId: getEffectivePatronId(),
        c2Rate: getSpawnC2Rate(),
        balanceVersion: BalanceConfig.BALANCE_VERSION,
        features: { ...BalanceConfig.FEATURES }
      };
    },

    getRunContext() {
      return this.getRunInfo();
    },

    triggerEvent(eventId) {
      if (!runCtx || !runCtx.levelEvents) return null;
      const started = LevelEvents.startEventById(runCtx.levelEvents, eventId, getNowSec());
      if (started) {
        runCtx.stats.eventsSeen.push(started.id);
        if (typeof audio.playEvent === 'function') audio.playEvent(started.tone);
        renderFrame(0);
      }
      return buildActiveEventSnapshot();
    },

    getReportedEvents() {
      return typeof platform.getReportedEventLog === 'function' ? platform.getReportedEventLog() : [];
    },

    /** READ-ONLY live references for headless balance bots (scripts/sim_balance.mjs). Never mutate. */
    setHeadlessSim(on) {
      headlessSimMode = Boolean(on);
      if (headlessSimMode) audio.setEnabled && audio.setEnabled(false);
      return headlessSimMode;
    },

    getSimView() {
      return {
        screen: app.screen,
        gridState: app.gridState,
        orderState: app.orderState,
        skillEnergy: app.skillEnergy,
        toolCounts: app.toolCounts,
        lastResult: app.lastResult,
        runStats: runCtx ? runCtx.stats : null,
        levelCfg: runCtx ? runCtx.levelCfg : null,
        dough: runCtx ? runCtx.dough : null,
        goal: runCtx ? runCtx.goal : null,
        activeEvent: runCtx && runCtx.levelEvents ? runCtx.levelEvents.active : null,
        nowSec: getNowSec()
      };
    },

    getState() {
      const os = app.orderState;
      const trayCap = os
        ? os.trayCapacity
        : saveData.deviceUpgrades && saveData.deviceUpgrades.dev_tray >= 1
        ? 4
        : 3;
      const trayArr = os && Array.isArray(os.tray)
        ? os.tray.slice(0, trayCap).map((t) =>
            t ? { uid: t.uid, tier: t.tier, flavor: t.flavor, ...(typeof t.bakedAt === 'number' ? { bakedAt: t.bakedAt } : {}) } : null
          )
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
        runMode: runCtx ? runCtx.mode : 'campaign',
        selectedChapter: app.selectedChapter,
        previewLevelId: app.previewLevelId,
        currentLevelId: app.currentLevelId,
        activeModal: app.activeModal,
        activeShopTab: app.activeShopTab,
        activeCompendiumTab: app.activeCompendiumTab,
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
        dough: buildDoughSnapshot(),
        goal: buildGoalSnapshot(),
        activeEvent: buildActiveEventSnapshot(),
        endlessRun: app.endlessRun ? cloneJsonSafe(app.endlessRun) : null,
        feverTimer: os ? Number(os.feverTimer) || 0 : 0,
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
      let rawRequestedSv = SaveSync.SCHEMA_VERSION;
      if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj)) {
        inputObj = { ...rawObj };
        if (Number.isFinite(Number(rawObj.schemaVersion)) && Number(rawObj.schemaVersion) > SaveSync.SCHEMA_VERSION) {
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
        if (rawRequestedSv > SaveSync.SCHEMA_VERSION) {
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

    startDailySpecial(opts = {}) {
      const ok = app.startDailySpecial(opts);
      renderFrame(0);
      return ok;
    },

    startEndlessMode(opts = {}) {
      const ok = app.startEndlessMode(opts);
      renderFrame(0);
      return ok;
    },

    pickEndlessPerk(choiceIdx) {
      const ok = app.pickEndlessPerk(choiceIdx);
      renderFrame(0);
      return ok;
    },

    buyResearchItem(itemId) {
      const ok = app.buyResearchItem(itemId);
      renderFrame(0);
      return ok;
    },

    toggleSetting(key) {
      const val = app.toggleSetting(key);
      renderFrame(0);
      return val;
    },

    getSettings() {
      const stg = saveData && saveData.settings ? saveData.settings : {};
      return {
        bgmTrack: saveData.bgmTrack,
        sfxEnabled: Boolean(saveData.sfxEnabled),
        vibrateEnabled: stg.vibrateEnabled !== false,
        lowPowerMode: Boolean(stg.lowPowerMode),
        colorblindMarks: Boolean(stg.colorblindMarks)
      };
    },

    setMockAdResult(ok) {
      return typeof platform.setMockAdResult === 'function' ? platform.setMockAdResult(ok) : Boolean(ok);
    },

    getAdDoubleRemaining() {
      return getAdDoubleRemaining();
    },

    triggerReviveAd() {
      return app.onReviveWithAd().then((ok) => {
        renderFrame(0);
        return ok;
      });
    },

    triggerDoubleDustAd() {
      return app.onDoubleDustWithAd().then((ok) => {
        renderFrame(0);
        return ok;
      });
    },

    triggerPerkRerollAd() {
      return app.onRerollEndlessPerksWithAd().then((ok) => {
        renderFrame(0);
        return ok;
      });
    },

    fetchRemoteConfig() {
      if (typeof platform.fetchRemoteConfig !== 'function') {
        return Promise.resolve({ ok: false, reason: 'unsupported' });
      }
      return platform.fetchRemoteConfig(CloudConfig.CLOUD_FUNCTION_NAME || 'kissa_sync').then((res) => {
        if (res && res.ok && res.overrides) {
          const applied = BalanceConfig.applyRemoteOverrides(res.overrides);
          return { ...res, applied };
        }
        return res;
      });
    },

    slide(dir) {
      const res = executeSlide(dir);
      renderFrame(0);
      return res;
    },

    /** Raw debug knead (no cooldown / dough temperature / fever table). knead({realistic:true}) applies them. */
    knead(opts = undefined) {
      const realistic = Boolean(opts && opts.realistic);
      const res = executeKnead(true, realistic ? { realistic: true } : undefined);
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

    serveSeat(seatIdx) {
      const res = executeServeSeat(seatIdx);
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

    advanceTime(seconds, maxStepSec = 0.05) {
      advanceSimulation(seconds, maxStepSec);
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

  function initRemoteConfigOnBoot() {
    if (headlessSimMode || !CloudConfig.ENABLE_CLOUD_SYNC) return;
    if (typeof platform.fetchRemoteConfig !== 'function') return;
    platform
      .fetchRemoteConfig(CloudConfig.CLOUD_FUNCTION_NAME || 'kissa_sync')
      .then((res) => {
        if (destroyed) return;
        if (res && res.ok && res.overrides) {
          BalanceConfig.applyRemoteOverrides(res.overrides);
        }
      })
      .catch(() => {});
  }

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
  initRemoteConfigOnBoot();

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
