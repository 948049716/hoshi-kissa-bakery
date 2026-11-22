/**
 * Hoshi Kissa: Starlight Patisserie 3.0 Plan B — WeChat Mini Game Controller
 * Coordinates game state, save persistence, physics world, shop/patron progression,
 * 90s Rush & Shop Events, audio cues, touch/keyboard input, and Canvas 2D rendering.
 */
'use strict';

const platform = require('./platform');
const {
  TIERS,
  WILDCARD_RADIUS,
  YARN_BALL_RADIUS,
  ASSET_PATHS,
  MODE_GUIDES,
  BLESSINGS,
  PATRONS,
  CASCADE_MULTIPLIERS,
  SHOP_UPGRADES,
  SHIFTS,
  SHIFT_HAZARDS,
  getShiftConfig,
  MAX_RELIC_SLOTS,
  RELIC_ARCHETYPES,
  ARCHETYPE_SYNERGIES,
  RELICS,
  DECK_MODS,
  JAR_THEMES,
  JAR_THEME_LIST,
  JAR,
  STORAGE_KEY,
  getChefRank
} = require('./constants');
const PHYSICS_SHAPES = require('./physics_shapes');
const Physics = require('./physics');
const StarlightAudio = require('./audio');
const UI = require('./ui_draw');
const ScreensUI = require('./screens_ui');
const ModalsUI = require('./modals_ui');
const CloudConfig = require('./cloud_config');
const SaveSync = require('./save_sync');

const LAUNCH_X = JAR.canvasW * 0.5;
const LAUNCH_Y = JAR.dropY + 4;
const FIXED_TURRET_POWER = 0.72;
const FIXED_TURRET_BASE_SPEED = 920;

function getShapeDef(tier) {
  return PHYSICS_SHAPES[`tier_${tier}`];
}

function createApp() {
  const canvas = platform.createMainCanvas();
  const ctx = canvas.getContext('2d');
  let metrics = platform.getSystemMetrics();

  platform.onResize((m) => {
    metrics = m;
  });

  const audio = new StarlightAudio({
    createAudioContext: platform.createAudioContext
  });

  // Load Persistent Save Data & Per-Mode Mid-Run Breakpoint Snapshots (Offline-First + WeChat CloudBase)
  let saveData = SaveSync.normalizeSaveData(platform.getStorageJSON(STORAGE_KEY));
  let savedRunsMap = SaveSync.normalizeSavedRunsMap(
    platform.getStorageJSON(SaveSync.ACTIVE_RUNS_STORAGE_KEY),
    platform.getStorageJSON(SaveSync.ACTIVE_RUN_STORAGE_KEY)
  );

  const cloudState = {
    status: 'idle', // 'idle' | 'syncing' | 'synced' | 'retry_pending' | 'local_only'
    cloudAvailable: false,
    openidSuffix: '',
    revision: 0,
    retryCount: 0,
    lastError: '',
    conflictMerged: false,
    validationWarnings: [],
    lastSyncAt: 0,
    syncing: false
  };
  let cloudPushTimer = null;
  let cloudRetryTimer = null;
  let checkpointTimer = null;
  let cloudDirty = false;
  let pendingClearMode = null;
  let pendingRunReport = null;

  function persistSaveData(opts = {}) {
    saveData.updatedAt = Date.now();
    const spent = SaveSync.computeSpentStardust(saveData);
    saveData.totalEarnedStardust = Math.max(
      30,
      saveData.totalEarnedStardust || 30,
      (saveData.bankStardust || 0) + spent
    );
    platform.setStorageJSON(STORAGE_KEY, saveData);
    platform.setWxFriendCloudScore(saveData.bestChef, saveData.bestRush, saveData.bestZen);
    if (!opts.skipCloud) {
      scheduleCloudPush(!!opts.immediate);
    }
  }

  function persistSavedRunsLocal() {
    platform.setStorageJSON(SaveSync.ACTIVE_RUNS_STORAGE_KEY, savedRunsMap);
    const primary = savedRunsMap[gameState.mode] || savedRunsMap.chef || savedRunsMap.rush || savedRunsMap.zen || null;
    if (primary) {
      platform.setStorageJSON(SaveSync.ACTIVE_RUN_STORAGE_KEY, primary);
    } else {
      platform.removeStorage(SaveSync.ACTIVE_RUN_STORAGE_KEY);
    }
  }

  function saveActiveRunCheckpoint(opts = {}) {
    if (!app) return;
    if (checkpointTimer) {
      clearTimeout(checkpointTimer);
      checkpointTimer = null;
    }
    const snap = SaveSync.serializeActiveRun(gameState, app.activeModal);
    if (!snap) return;
    savedRunsMap[snap.mode] = snap;
    if (pendingClearMode === snap.mode) pendingClearMode = null;
    persistSavedRunsLocal();
    if (opts.syncCloud) {
      scheduleCloudPush(true);
    }
  }

  function scheduleCheckpointSave(delayMs = 1200) {
    if (checkpointTimer) clearTimeout(checkpointTimer);
    checkpointTimer = setTimeout(() => {
      checkpointTimer = null;
      if (!app.isLobbyOpen && gameState.running && !gameState.over) {
        saveActiveRunCheckpoint({ syncCloud: false });
      }
    }, delayMs);
  }

  function clearActiveRunCheckpoint(modeOrSync = false, maybeSyncCloud = false) {
    if (checkpointTimer) {
      clearTimeout(checkpointTimer);
      checkpointTimer = null;
    }
    const targetMode =
      typeof modeOrSync === 'string' && ['chef', 'rush', 'zen'].includes(modeOrSync) ? modeOrSync : gameState.mode;
    const syncCloud = typeof modeOrSync === 'boolean' ? modeOrSync : !!maybeSyncCloud;
    if (savedRunsMap[targetMode]) {
      savedRunsMap[targetMode] = null;
    }
    pendingClearMode = targetMode;
    persistSavedRunsLocal();
    if (syncCloud) {
      scheduleCloudPush(true);
    }
  }

  function scheduleCloudBackoffRetry() {
    if (!cloudState.cloudAvailable || cloudState.status === 'local_only') return;
    if (cloudRetryTimer) {
      clearTimeout(cloudRetryTimer);
      cloudRetryTimer = null;
    }
    if (cloudState.retryCount >= 4) return;
    const delayMs = Math.min(24000, 1500 * Math.pow(2, cloudState.retryCount));
    cloudState.retryCount++;
    cloudState.status = 'retry_pending';
    cloudRetryTimer = setTimeout(() => {
      cloudRetryTimer = null;
      if (cloudDirty) flushCloudPush();
      else bootCloudSync();
    }, delayMs);
  }

  async function flushCloudPush() {
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (!CloudConfig.ENABLE_CLOUD_SYNC || !cloudState.cloudAvailable || cloudState.status === 'local_only') {
      return { ok: false, reason: 'local_only' };
    }
    if (cloudRetryTimer) {
      clearTimeout(cloudRetryTimer);
      cloudRetryTimer = null;
    }
    cloudDirty = false;
    cloudState.syncing = true;
    const clearMode = pendingClearMode;
    const runReport = pendingRunReport;
    pendingClearMode = null;
    pendingRunReport = null;

    const primaryRun = savedRunsMap.chef || savedRunsMap.rush || savedRunsMap.zen || null;
    const payload = {
      action: 'push',
      baseRevision: cloudState.revision || 0,
      metaSave: saveData,
      profile: saveData.playerProfile,
      savedRuns: { ...savedRunsMap },
      activeRun: primaryRun
    };
    if (clearMode) {
      payload.clearSavedRunMode = clearMode;
      if (!primaryRun) payload.clearActiveRun = true;
    }
    if (runReport) {
      payload.runReport = runReport;
    }

    const res = await platform.callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, payload);
    cloudState.syncing = false;
    if (res && res.ok) {
      cloudState.status = 'synced';
      cloudState.retryCount = 0;
      cloudState.lastError = '';
      cloudState.conflictMerged = !!res.conflictMerged;
      cloudState.validationWarnings = Array.isArray(res.validationWarnings) ? res.validationWarnings : [];
      cloudState.revision = res.revision || cloudState.revision + 1;
      cloudState.lastSyncAt = Date.now();
      if (res.openidSuffix) cloudState.openidSuffix = res.openidSuffix;
      if (res.metaSave) {
        const merged = SaveSync.mergeSaveData(saveData, res.metaSave, res.profile);
        merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
        Object.assign(saveData, merged);
        platform.setStorageJSON(STORAGE_KEY, saveData);
      }
      if (res.savedRuns) {
        savedRunsMap = SaveSync.mergeSavedRunsMaps(savedRunsMap, res.savedRuns, res.activeRun || null);
        if (clearMode) savedRunsMap[clearMode] = null;
        persistSavedRunsLocal();
      }
      return res;
    }

    if (res && res.reason === 'cloud_unavailable') {
      cloudState.cloudAvailable = false;
      cloudState.status = 'local_only';
      return res;
    }

    // Transient failure: retain dirty state & schedule exponential backoff retry!
    cloudDirty = true;
    if (clearMode && !pendingClearMode) pendingClearMode = clearMode;
    if (runReport && !pendingRunReport) pendingRunReport = runReport;
    cloudState.lastError = (res && (res.errMsg || res.reason)) || 'network_error';
    scheduleCloudBackoffRetry();
    return res || { ok: false };
  }

  function scheduleCloudPush(immediate = false) {
    if (!CloudConfig.ENABLE_CLOUD_SYNC || cloudState.status === 'local_only' || !cloudState.cloudAvailable) return;
    cloudDirty = true;
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    if (immediate) {
      cloudState.retryCount = 0;
      flushCloudPush();
    } else {
      cloudPushTimer = setTimeout(() => {
        flushCloudPush();
      }, CloudConfig.SYNC_DEBOUNCE_MS || 1800);
    }
  }

  async function bootCloudSync() {
    if (!CloudConfig.ENABLE_CLOUD_SYNC) {
      cloudState.cloudAvailable = false;
      cloudState.status = 'local_only';
      return;
    }
    const inited = platform.initCloud(CloudConfig.CLOUD_ENV_ID);
    if (!inited) {
      cloudState.cloudAvailable = false;
      cloudState.status = 'local_only';
      return;
    }
    cloudState.cloudAvailable = true;
    cloudState.status = 'syncing';
    cloudState.syncing = true;
    const res = await platform.callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, { action: 'pull' });
    cloudState.syncing = false;
    if (!res || !res.ok) {
      if (res && res.reason === 'cloud_unavailable') {
        cloudState.cloudAvailable = false;
        cloudState.status = 'local_only';
      } else {
        cloudState.lastError = (res && (res.errMsg || res.reason)) || 'pull_failed';
        scheduleCloudBackoffRetry();
      }
      return;
    }

    cloudState.status = 'synced';
    cloudState.retryCount = 0;
    cloudState.lastError = '';
    cloudState.openidSuffix = res.openidSuffix || '';
    cloudState.revision = res.revision || 1;
    cloudState.lastSyncAt = Date.now();

    const beforeCloudChef = (res.metaSave && res.metaSave.bestChef) || 0;
    const beforeCloudEarned = (res.metaSave && res.metaSave.totalEarnedStardust) || 30;
    const merged = SaveSync.mergeSaveData(saveData, res.metaSave, res.profile);
    merged.lastSyncedEarnedStardust = merged.totalEarnedStardust;
    Object.assign(saveData, merged);
    platform.setStorageJSON(STORAGE_KEY, saveData);

    audio.bgmTrack = saveData.bgmTrack;
    audio.bgmEnabled = saveData.bgmTrack !== 'off';
    audio.setSfxEnabled(saveData.sfxEnabled);
    if (saveData.playerProfile && saveData.playerProfile.avatarUrl && app) {
      app.ensureRemoteAvatar(saveData.playerProfile.avatarUrl);
    }

    if (res.savedRuns || res.activeRun) {
      savedRunsMap = SaveSync.mergeSavedRunsMaps(savedRunsMap, res.savedRuns || null, res.activeRun || null);
      persistSavedRunsLocal();
    }

    // Push back if new cloud user or local progress is ahead of cloud
    if (res.isNewUser || saveData.bestChef > beforeCloudChef || saveData.totalEarnedStardust > beforeCloudEarned) {
      scheduleCloudPush(true);
    }
  }

  audio.bgmTrack = saveData.bgmTrack;
  audio.bgmEnabled = saveData.bgmTrack !== 'off';
  audio.setSfxEnabled(saveData.sfxEnabled);

  // Asset Store
  const sprites = {
    bg: null,
    hero: null,
    shopSign: null,
    yarnBall: null,
    uiAtlas: null,
    uiAtlas2: null,
    uiAtlas3: null,
    titlePlaque: null,
    patronStage: null,
    serveBell: null,
    tools: { shake: null, fork: null, spoon: null },
    patrons: {},
    base: {},
    act: {},
    int: {},
    loadedCount: 0,
    totalCount: 0
  };

  function preloadAssets() {
    const jobs = [];
    const track = (promise) => {
      sprites.totalCount++;
      jobs.push(
        promise.then((img) => {
          if (img) sprites.loadedCount++;
          return img;
        })
      );
    };
    track(platform.loadImage(ASSET_PATHS.bg).then((img) => (sprites.bg = img)));
    track(platform.loadImage(ASSET_PATHS.hero).then((img) => (sprites.hero = img)));
    track(platform.loadImage(ASSET_PATHS.shopSign).then((img) => (sprites.shopSign = img)));
    track(platform.loadImage(ASSET_PATHS.yarnBall).then((img) => (sprites.yarnBall = img)));
    track(platform.loadImage(ASSET_PATHS.uiAtlas).then((img) => (sprites.uiAtlas = img)));
    track(platform.loadImage(ASSET_PATHS.uiAtlas2).then((img) => (sprites.uiAtlas2 = img)));
    track(platform.loadImage(ASSET_PATHS.uiAtlas3).then((img) => (sprites.uiAtlas3 = img)));
    track(platform.loadImage(ASSET_PATHS.titlePlaque).then((img) => (sprites.titlePlaque = img)));
    track(platform.loadImage(ASSET_PATHS.patronStage).then((img) => (sprites.patronStage = img)));
    track(platform.loadImage(ASSET_PATHS.serveBell).then((img) => (sprites.serveBell = img)));
    track(platform.loadImage(ASSET_PATHS.tools.shake).then((img) => (sprites.tools.shake = img)));
    track(platform.loadImage(ASSET_PATHS.tools.fork).then((img) => (sprites.tools.fork = img)));
    track(platform.loadImage(ASSET_PATHS.tools.spoon).then((img) => (sprites.tools.spoon = img)));
    for (const p of PATRONS) {
      track(platform.loadImage(p.src).then((img) => (sprites.patrons[p.id] = img)));
    }
    for (const t of TIERS) {
      track(platform.loadImage(t.src).then((img) => (sprites.base[t.tier] = img)));
      track(platform.loadImage(t.actSrc).then((img) => (sprites.act[t.tier] = img)));
      track(platform.loadImage(t.intSrc).then((img) => (sprites.int[t.tier] = img)));
    }
    return Promise.all(jobs);
  }

  // Mutable Game State (4.0 Phase 2: 5-Shift Roguelike + 16 Relics + 6 Deck Mods)
  const gameState = {
    mode: 'chef',
    running: false,
    paused: false,
    over: false,
    score: 0,
    displayScore: 0,
    stardust: 30,
    // 5-Shift Progression & Economy (chef mode)
    shift: 1,
    shiftName: '暮色试营业',
    shiftBadge: '第1幕·试营',
    shiftModifier: null,
    shiftHazards: [],
    shiftsClearedThisRun: 0,
    shiftRevenue: 0,
    displayShiftRevenue: 0,
    shiftTarget: 1200,
    stepsLeft: 16,
    stepsMax: 16,
    shiftStepsUsed: 0,
    shiftStepRefunds: 0,
    shiftClearedFlag: false,
    shiftResolveDelay: 0,
    coins: 0,
    relics: [],
    deckMods: {
      mod_trim_t1: 0,
      mod_boost_t3: 0,
      mod_gold_tray: 0,
      mod_rainbow: 0,
      mod_steps: 0,
      mod_tool: 0
    },
    nextShiftBonusSteps: 0,
    antigravDropCounter: 0,
    antigravTimer: 0,
    globalResonanceTimer: 0,
    obstacles: [],
    prepShop: null,
    victoryOffer: null,
    runEndReason: null,
    dropsMadeThisRun: 0,
    soufflesMadeThisRun: 0,
    yarnBrokenThisRun: 0,
    iceShatteredThisRun: 0,
    glazeHitsThisRun: 0,
    servesCompleted: 0,
    bankShotsLanded: 0,
    serveCascadeTimer: 0,
    serveCascadeMerges: 0,
    maxAvalancheRun: 0,
    skillEnergy: 0,
    stepSkillGain: 0,
    activeSkillMode: null, // 'scoop' | 'swap_1' | 'swap_2' | null
    swapFirstEntityId: null,
    nextShotMeteor: false,
    feverEnergy: 0,
    feverTimer: 0,
    feverMaxDuration: 10.0,
    feverBonusUsed: 0,
    comboCount: 0,
    comboTimer: 0,
    comboRainbowGranted: false,
    maxCombo: 1,
    ordersCompleted: 0,
    maxTierRun: 1,
    seenThisRun: new Set([1, 2, 3, 4]),
    tools: { shake: 2, spoon: 1 },
    toolCosts: { shake: 22, spoon: 35 },
    activeToolMode: null,
    dropX: 220,
    prevDropX: 220,
    aimAngle: 0,
    dropSway: 0,
    aim: {
      active: false,
      mode: 'sling',
      anchorX: 220,
      anchorY: 42,
      curX: 220,
      curY: 160,
      power: FIXED_TURRET_POWER,
      launchVx: 0,
      launchVy: FIXED_TURRET_BASE_SPEED,
      angle: 0,
      cancelled: false,
      stretchBand: 0,
      slingLocked: false
    },
    touchAim: { active: false, cancelled: false, lastStableX: 220 },
    debugPhysics: false,
    lastDebugContacts: [],
    magnetLinks: [],
    curTier: 1,
    curMeta: { wildcard: false, golden: false },
    nextTier: 2,
    nextMeta: { wildcard: false, golden: false },
    holdTier: null,
    holdMeta: null,
    dropsUntilRainbow: 12,
    canHoldThisTurn: true,
    dropCooldown: 0,
    lastDroppedId: null,
    heldActionCooldown: 1.6,
    heldActionAnim: null,
    perks: {},
    pendingBlessings: 0,
    blessingChoices: [],
    blessingLastReason: '',
    blessingSubText: '',
    blessingLockUntil: 0,
    zenNextMilestone: 600,
    rushTimer: 90.0,
    rushFinished: false,
    rushGustCooldown: 0,
    rushNextMilestone: 1200,
    rushLastTickSec: 6,
    rushServeStreak: 0,
    rushStreakTimer: 0,
    rushMaxStreak: 0,
    activeEvent: null,
    lastEventKind: null,
    nextEventDrops: 12,
    nextEventTimer: 18.0,
    meteorGoldenLeft: 0,
    shootingStars: [],
    flyingServes: [],
    hitstopTimer: 0,
    screenShake: 0,
    jarFlash: 0,
    shockwaves: [],
    comboBanner: null,
    dangerDuration: 0,
    jarShakeAmp: 0,
    nextEntityId: 1,
    entities: [],
    particles: [],
    popups: [],
    orders: [],
    order: null,
    skipCooldown: 0,
    freeSkipsLeft: 1,
    lastSkippedIdx: 1,
    mugiBankCoinHits: 0,
    hoveredEntityId: null,
    speechTimer: 0,
    speechPatron: PATRONS[0],
    speechText: ''
  };

  const fireflies = Array.from({ length: 28 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.015,
    vy: -0.005 - Math.random() * 0.012,
    r: 1.5 + Math.random() * 2.4,
    phase: Math.random() * Math.PI * 2
  }));

  const hits = new UI.HitRegistry();

  function classifyToastLevel(msg, explicitLevel) {
    if (explicitLevel === 'major' || explicitLevel === 'minor') return explicitLevel;
    const s = String(msg || '');
    if (
      s.includes('突发事件') ||
      s.includes('达标') ||
      s.includes('欢迎新搭档') ||
      s.includes('解锁') ||
      s.includes('狂热') ||
      s.includes('急单') ||
      s.includes('共鸣') ||
      s.includes('升级成功') ||
      s.includes('名片已同步') ||
      s.includes('猫神') ||
      s.includes('主菜') ||
      s.includes('充能完毕')
    ) {
      return 'major';
    }
    return 'minor';
  }

  function inferToastTone(msg, level, explicitTone) {
    if (explicitTone === 'info' || explicitTone === 'success' || explicitTone === 'warn' || explicitTone === 'event') {
      return explicitTone;
    }
    const s = String(msg || '');
    if (
      s.includes('不足') ||
      s.includes('已满') ||
      s.includes('上限') ||
      s.includes('无法') ||
      s.includes('不可') ||
      s.includes('至少') ||
      s.includes('无需') ||
      s.includes('请')
    ) {
      return 'warn';
    }
    if (
      s.includes('成功') ||
      s.includes('解锁') ||
      s.includes('达标') ||
      s.includes('过关') ||
      s.includes('完成') ||
      s.includes('获得') ||
      s.includes('同步') ||
      s.includes('恢复') ||
      s.includes('装备') ||
      s.includes('共鸣') ||
      s.includes('欢迎')
    ) {
      return 'success';
    }
    return level === 'major' ? 'event' : 'info';
  }

  // Application View & Modal Coordinator
  const app = {
    canvas,
    metrics: () => metrics,
    audio,
    sprites,
    saveData,
    gameState,
    cloudState,
    get savedRuns() {
      return savedRunsMap;
    },
    get savedRun() {
      return savedRunsMap[gameState.mode] || null;
    },
    isLobbyOpen: true,
    activeModal: null, // 'shop' | 'career' | 'help' | 'mode_guide' | 'compendium' | 'pause' | 'confirm' | 'prep_shop' | 'shift_victory' | 'relics' | 'gameover' | null
    confirmDialog: null,
    activeShopTab: 'upgrades',
    activeCareerTab: 'stats', // 'stats' | 'rank'
    leaderboardMode: 'chef', // 'chef' | 'rush'
    leaderboardState: {
      loading: false,
      mode: 'chef',
      list: [],
      myRank: null,
      myScore: 0,
      isLocalFallback: false,
      lastFetchedAt: 0
    },
    userInfoBtnRect: null,
    remoteAvatars: {},
    guideMode: 'chef',
    guideStep: 0,
    lobbySpeechIndex: 0,
    lobbyBounceT: 0,
    modalScrollY: 0,
    modalMaxScroll: 0,
    modalScrollRect: null,
    lastJarBox: { x: 0, y: 0, w: 440, h: 520, scale: 1 },
    toastText: '',
    toastTimer: 0,
    toastCurrent: null,
    toastQueue: [],
    minorToast: null,
    goSettlement: null,

    get activePatron() {
      return PATRONS.find((p) => p.id === saveData.selectedPatron) || PATRONS[0];
    },
    get equippedTheme() {
      return JAR_THEMES[saveData.equippedTheme] || JAR_THEMES.amber;
    },
    get hasAffordable() {
      return hasAffordableShopItem();
    },

    getUpgradeLevel(id) {
      return (saveData.shopUpgrades && saveData.shopUpgrades[id]) || 0;
    },
    getBestScore(mode = gameState.mode) {
      if (mode === 'rush') return saveData.bestRush || 0;
      if (mode === 'zen') return saveData.bestZen || 0;
      return saveData.bestChef || 0;
    },
    getCareerTopScore() {
      return Math.max(saveData.bestChef || 0, saveData.bestRush || 0, saveData.bestZen || 0);
    },
    getPerkLevel(id) {
      return gameState.perks[id] || 0;
    },
    getEffectiveMagnetLevel() {
      const base = this.getPerkLevel('magnet');
      const lunaBonus = saveData.selectedPatron === 'luna' ? 1 : 0;
      return Math.min(4, base + lunaBonus);
    },
    getFeverMultiplier() {
      if (gameState.feverTimer <= 0) return 1;
      return Math.min(3.0, 2.0 + Math.max(0, gameState.comboCount - 1) * 0.25);
    },

    syncToastLegacyFields() {
      if (this.toastCurrent && this.toastCurrent.timer > 0) {
        this.toastText = this.toastCurrent.text;
        this.toastTimer = this.toastCurrent.timer;
      } else if (this.minorToast && this.minorToast.timer > 0) {
        this.toastText = this.minorToast.text;
        this.toastTimer = this.minorToast.timer;
      } else {
        this.toastText = '';
        this.toastTimer = 0;
      }
    },

    showToast(msg, opts = null) {
      if (!msg) return;
      const optObj = opts && typeof opts === 'object' ? opts : {};
      const explicitLv = optObj.level || null;
      const level = classifyToastLevel(msg, explicitLv);
      const tone = inferToastTone(msg, level, optObj.tone);
      const icon = optObj.icon || '';
      const dur = level === 'major' ? 2.25 : 1.65;
      const entry = { text: msg, level, tone, icon, timer: dur, maxTimer: dur };

      if (this.toastCurrent && this.toastCurrent.text === msg) {
        this.toastCurrent.timer = Math.max(this.toastCurrent.timer, dur * 0.75);
        if (icon) this.toastCurrent.icon = icon;
        this.toastCurrent.tone = tone;
        this.syncToastLegacyFields();
        return;
      }
      if (this.toastQueue.some((q) => q.text === msg)) return;

      if (level === 'major') {
        if (!this.toastCurrent || this.toastCurrent.timer <= 0 || this.toastCurrent.level === 'minor') {
          if (this.toastCurrent && this.toastCurrent.level === 'minor' && this.toastCurrent.timer > 0.25) {
            this.minorToast = { ...this.toastCurrent, timer: Math.min(this.toastCurrent.timer, 1.35) };
          }
          this.toastCurrent = entry;
        } else if (this.toastQueue.length < 2) {
          this.toastQueue.push(entry);
          this.toastCurrent.timer = Math.min(this.toastCurrent.timer, 1.45);
        }
      } else {
        if (!this.toastCurrent || this.toastCurrent.timer <= 0) {
          this.toastCurrent = entry;
        } else if (this.toastCurrent.level === 'minor') {
          this.toastCurrent = entry;
        } else {
          // Major event banner is active: show minor hint on non-competing compact secondary pill
          this.minorToast = { ...entry, timer: 1.55, maxTimer: 1.55 };
        }
      }
      this.syncToastLegacyFields();
    },

    syncAudioMood() {
      const muffle = this.isLobbyOpen || this.activeModal !== null;
      audio.setMuffled(muffle);
    },

    toggleSfx() {
      audio.ensureCtx();
      const next = !audio.sfxEnabled;
      audio.setSfxEnabled(next);
      saveData.sfxEnabled = next;
      persistSaveData();
      this.showToast(next ? '音效已开启' : '音效已静音', { icon: next ? 'icon_sfx_on' : 'icon_sfx_off', tone: 'info' });
    },

    cycleBgm() {
      audio.ensureCtx();
      audio.cycleBGMTrack();
      saveData.bgmTrack = audio.bgmTrack;
      persistSaveData();
      const info = audio.getTrackInfo();
      this.showToast(info.id === 'off' ? '音乐已关闭' : `音乐：${info.title}`, { icon: 'icon_music', tone: 'info' });
    },

    toggleDebugPhysics(forceVal) {
      gameState.debugPhysics = typeof forceVal === 'boolean' ? forceVal : !gameState.debugPhysics;
      if (typeof forceVal !== 'boolean') {
        this.showToast(gameState.debugPhysics ? '已开启物理轮廓' : '已关闭物理轮廓', { icon: 'icon_toolbox', tone: 'info' });
      }
    },

    selectMode(modeId) {
      audio.ensureCtx();
      audio.playTilt();
      gameState.mode = modeId;
    },

    pokeLobbyPatron() {
      audio.ensureCtx();
      audio.playPatronSelect();
      this.lobbySpeechIndex++;
      this.lobbyBounceT = 0.001;
    },

    selectOrUnlockPatron(id) {
      const p = PATRONS.find((item) => item.id === id);
      if (!p) return;
      audio.ensureCtx();
      if (saveData.unlockedPatrons.includes(id)) {
        if (saveData.selectedPatron !== id) {
          saveData.selectedPatron = id;
          this.lobbySpeechIndex = 0;
          persistSaveData();
          audio.playPatronSelect();
          this.lobbyBounceT = 0.001;
          this.showToast(`搭档：${p.name}`, { icon: p.badge, tone: 'info' });
        } else {
          this.pokeLobbyPatron();
        }
      } else {
        this.openShop('patrons');
      }
    },

    openModal(name) {
      if (!this.isLobbyOpen && gameState.running && !gameState.over) {
        gameState.paused = true;
        resetAimingState();
      }
      this.activeModal = name;
      this.modalScrollY = 0;
      this.modalMaxScroll = 0;
      this.syncAudioMood();
    },

    closeModal() {
      if (!this.activeModal) return;
      if (this.activeModal === 'gameover' || this.activeModal === 'prep_shop' || this.activeModal === 'shift_victory') {
        return;
      }
      if (this.activeModal === 'mode_guide') {
        this.finishModeGuide();
        return;
      }
      if (this.activeModal === 'confirm') {
        const ret = this.confirmDialog && this.confirmDialog.returnModal;
        this.confirmDialog = null;
        if (ret) {
          this.activeModal = ret;
          this.syncAudioMood();
          return;
        }
      }
      this.activeModal = null;
      this.modalScrollY = 0;
      this.modalMaxScroll = 0;
      if (!this.isLobbyOpen && gameState.running && !gameState.over) {
        gameState.paused = false;
      }
      this.syncAudioMood();
    },

    togglePause() {
      if (this.isLobbyOpen || !gameState.running || gameState.over) return;
      audio.ensureCtx();
      audio.playTilt();
      if (this.activeModal === 'pause') {
        this.closeModal();
      } else if (!this.activeModal) {
        saveActiveRunCheckpoint({ syncCloud: false });
        this.openModal('pause');
      }
    },

    openConfirm(cfg) {
      audio.ensureCtx();
      audio.playTilt();
      this.confirmDialog = {
        title: (cfg && cfg.title) || '确认操作',
        message: (cfg && cfg.message) || '',
        confirmText: (cfg && cfg.confirmText) || '确认',
        cancelText: (cfg && cfg.cancelText) || '取消',
        returnModal: (cfg && cfg.returnModal) || null,
        onConfirm: (cfg && cfg.onConfirm) || null,
        onCancel: (cfg && cfg.onCancel) || null
      };
      this.openModal('confirm');
    },

    confirmAccept() {
      const dlg = this.confirmDialog;
      this.confirmDialog = null;
      this.activeModal = null;
      if (dlg && typeof dlg.onConfirm === 'function') {
        dlg.onConfirm();
      } else {
        if (!this.isLobbyOpen && gameState.running && !gameState.over) {
          gameState.paused = false;
        }
        this.syncAudioMood();
      }
    },

    confirmCancel() {
      const dlg = this.confirmDialog;
      this.confirmDialog = null;
      if (dlg && typeof dlg.onCancel === 'function') {
        this.activeModal = null;
        dlg.onCancel();
        return;
      }
      if (dlg && dlg.returnModal) {
        this.activeModal = dlg.returnModal;
        this.syncAudioMood();
        return;
      }
      this.activeModal = null;
      if (!this.isLobbyOpen && gameState.running && !gameState.over) {
        gameState.paused = false;
      }
      this.syncAudioMood();
    },

    openModeGuide(mode = gameState.mode, startStep = 0) {
      const targetMode = MODE_GUIDES[mode] ? mode : 'chef';
      audio.ensureCtx();
      audio.playTilt();
      if (!this.isLobbyOpen && gameState.running && !gameState.over) {
        gameState.paused = true;
      }
      this.guideMode = targetMode;
      this.guideStep = Math.max(0, startStep);
      this.openModal('mode_guide');
    },

    nextModeGuideStep() {
      audio.ensureCtx();
      const def = MODE_GUIDES[this.guideMode] || MODE_GUIDES.chef;
      if (this.guideStep + 1 < def.steps.length) {
        audio.playTilt();
        this.guideStep++;
      } else {
        audio.playPatronSelect();
        this.finishModeGuide();
      }
    },

    prevModeGuideStep() {
      if (this.guideStep > 0) {
        audio.ensureCtx();
        audio.playTilt();
        this.guideStep--;
      }
    },

    finishModeGuide() {
      if (this.guideMode === 'tip_glaze_ring') {
        if (!saveData.seenTips) saveData.seenTips = {};
        saveData.seenTips.glaze_ring = true;
      } else if (this.guideMode === 'tip_frozen') {
        if (!saveData.seenTips) saveData.seenTips = {};
        saveData.seenTips.frozen = true;
      } else {
        if (!saveData.seenModeGuides) saveData.seenModeGuides = {};
        saveData.seenModeGuides[this.guideMode] = true;
      }
      persistSaveData();
      this.activeModal = null;
      this.modalScrollY = 0;
      this.modalMaxScroll = 0;
      if (!this.isLobbyOpen && gameState.running && !gameState.over) {
        gameState.paused = false;
      }
      this.syncAudioMood();
    },

    openShop(tab = 'upgrades') {
      this.activeShopTab = tab;
      this.openModal('shop');
    },

    openShopFromGameOver() {
      this.returnToLobby();
      this.openShop('upgrades');
    },

    setShopTab(tab) {
      audio.ensureCtx();
      audio.playTilt();
      this.activeShopTab = tab;
      this.modalScrollY = 0;
    },

    buyUpgrade(id) {
      const up = SHOP_UPGRADES.find((u) => u.id === id);
      if (!up) return;
      const lv = this.getUpgradeLevel(id);
      if (lv >= up.maxLv) return;
      const cost = up.costs[lv];
      if ((saveData.bankStardust || 0) < cost) {
        this.showToast(`星尘不足（需 ${cost}）`, { icon: 'icon_stardust', tone: 'warn' });
        return;
      }
      audio.ensureCtx();
      saveData.bankStardust -= cost;
      saveData.shopUpgrades[id] = lv + 1;
      persistSaveData();
      audio.playShopBuy();
      platform.vibrateShort('light');
      this.showToast(`升级成功 · ${up.name} Lv.${lv + 1}`, { level: 'major', icon: up.icon || 'icon_shop', tone: 'success' });
    },

    buyOrEquipTheme(id) {
      const th = JAR_THEMES[id];
      if (!th) return;
      audio.ensureCtx();
      const owned = saveData.unlockedThemes.includes(id);
      if (!owned) {
        if ((saveData.bankStardust || 0) < th.cost) {
          this.showToast(`星尘不足（需 ${th.cost}）`, { icon: 'icon_stardust', tone: 'warn' });
          return;
        }
        saveData.bankStardust -= th.cost;
        saveData.unlockedThemes.push(id);
        saveData.equippedTheme = id;
        persistSaveData();
        audio.playShopBuy();
        platform.vibrateShort('light');
        this.showToast(`解锁主题：${th.name}`, { level: 'major', icon: th.icon || 'icon_stardust', tone: 'success' });
      } else {
        saveData.equippedTheme = id;
        persistSaveData();
        audio.playPatronSelect();
        this.showToast(`主题：${th.name}`, { icon: th.icon || 'icon_stardust', tone: 'info' });
      }
    },

    buyOrSelectPatron(id) {
      const p = PATRONS.find((item) => item.id === id);
      if (!p) return;
      audio.ensureCtx();
      const owned = saveData.unlockedPatrons.includes(id);
      if (!owned) {
        if ((saveData.bankStardust || 0) < p.cost) {
          this.showToast(`星尘不足（需 ${p.cost}）`, { icon: 'icon_stardust', tone: 'warn' });
          return;
        }
        saveData.bankStardust -= p.cost;
        saveData.unlockedPatrons.push(id);
        saveData.selectedPatron = id;
        this.lobbySpeechIndex = 0;
        persistSaveData();
        audio.playShopBuy();
        platform.vibrateShort('light');
        this.showToast(`欢迎新搭档 · ${p.name}`, { level: 'major', icon: p.badge, tone: 'success' });
      } else {
        saveData.selectedPatron = id;
        this.lobbySpeechIndex = 0;
        persistSaveData();
        audio.playPatronSelect();
        this.showToast(`搭档：${p.name}`, { icon: p.badge, tone: 'info' });
      }
    },

    ensureRemoteAvatar(url) {
      if (!url || typeof url !== 'string') return null;
      if (this.remoteAvatars[url]) return this.remoteAvatars[url];
      this.remoteAvatars[url] = { loading: true, img: null };
      platform.loadImage(url).then((img) => {
        this.remoteAvatars[url] = { loading: false, img: img || null };
      });
      return null;
    },

    getPlayerDisplayName() {
      const prof = saveData.playerProfile || {};
      if (prof.nickName && prof.nickName.trim()) return prof.nickName.trim();
      const suffix = cloudState.openidSuffix ? `#${cloudState.openidSuffix}` : '';
      return `星夜店长${suffix}`;
    },

    getPlayerAvatarPreset() {
      const prof = saveData.playerProfile || {};
      if (prof.avatarPreset && ['mikan', 'luna', 'mugi'].includes(prof.avatarPreset)) {
        return prof.avatarPreset;
      }
      return saveData.selectedPatron || 'mikan';
    },

    getPlayerAvatarImg(overrideUrl = '', overridePreset = '') {
      const url = overrideUrl || (saveData.playerProfile && saveData.playerProfile.avatarUrl) || '';
      if (url) {
        const entry = this.remoteAvatars[url];
        if (!entry) {
          this.ensureRemoteAvatar(url);
        } else if (entry.img) {
          return entry.img;
        }
      }
      const preset = overridePreset || this.getPlayerAvatarPreset();
      return sprites.patrons[preset] || sprites.patrons.mikan || null;
    },

    cycleProfileAvatarPreset() {
      audio.ensureCtx();
      audio.playPatronSelect();
      const order = ['mikan', 'luna', 'mugi'];
      const cur = this.getPlayerAvatarPreset();
      const next = order[(order.indexOf(cur) + 1) % order.length];
      if (!saveData.playerProfile) {
        saveData.playerProfile = SaveSync.normalizeProfile(null, next);
      }
      saveData.playerProfile.avatarPreset = next;
      saveData.playerProfile.updatedAt = Date.now();
      persistSaveData();
      const p = PATRONS.find((it) => it.id === next);
      this.showToast(`头像：${p ? p.name : next}`, { icon: 'icon_paw_guide', tone: 'info' });
    },

    async applyPlayerProfileAuth({ nickName, avatarUrl = '', avatarPreset = null, authorized = true } = {}) {
      if (!saveData.playerProfile) {
        saveData.playerProfile = SaveSync.normalizeProfile(null, saveData.selectedPatron);
      }
      if (nickName && nickName.trim()) {
        saveData.playerProfile.nickName = nickName.trim().slice(0, 16);
      }
      if (typeof avatarUrl === 'string') {
        saveData.playerProfile.avatarUrl = avatarUrl.slice(0, 512);
        if (avatarUrl) this.ensureRemoteAvatar(avatarUrl);
      }
      if (avatarPreset && ['mikan', 'luna', 'mugi'].includes(avatarPreset)) {
        saveData.playerProfile.avatarPreset = avatarPreset;
      }
      saveData.playerProfile.authorized = !!authorized;
      saveData.playerProfile.updatedAt = Date.now();
      persistSaveData({ immediate: true });
      if (CloudConfig.ENABLE_CLOUD_SYNC && cloudState.cloudAvailable && cloudState.status !== 'local_only') {
        await platform.callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, {
          action: 'updateProfile',
          profile: saveData.playerProfile
        });
      }
      this.fetchLeaderboard(true);
      this.showToast(`名片已同步：${this.getPlayerDisplayName()}`, { level: 'major', icon: 'icon_id_card', tone: 'success' });
    },

    onTapCareerAuthFallback() {
      audio.ensureCtx();
      audio.playPatronSelect();
      const personas = [
        { nickName: '星夜店长·小蜜柑', avatarPreset: 'mikan' },
        { nickName: '星月主厨·露娜', avatarPreset: 'luna' },
        { nickName: '元气主厨·麦吉', avatarPreset: 'mugi' }
      ];
      const curName = (saveData.playerProfile && saveData.playerProfile.nickName) || '';
      const curIdx = personas.findIndex((p) => p.nickName === curName);
      const pick = personas[(curIdx + 1) % personas.length];
      this.applyPlayerProfileAuth({
        nickName: pick.nickName,
        avatarUrl: (saveData.playerProfile && saveData.playerProfile.avatarUrl) || '',
        avatarPreset: pick.avatarPreset,
        authorized: true
      });
    },

    openCareer(tab = 'stats') {
      audio.ensureCtx();
      audio.playTilt();
      this.activeCareerTab = tab === 'rank' ? 'rank' : 'stats';
      this.openModal('career');
      if (this.activeCareerTab === 'rank') {
        this.fetchLeaderboard(false);
      }
    },

    setCareerTab(tab) {
      const next = tab === 'rank' ? 'rank' : 'stats';
      if (this.activeCareerTab === next) return;
      audio.ensureCtx();
      audio.playTilt();
      this.activeCareerTab = next;
      this.modalScrollY = 0;
      if (next === 'rank') {
        this.fetchLeaderboard(false);
      }
    },

    setLeaderboardMode(mode) {
      const next = mode === 'rush' ? 'rush' : 'chef';
      if (this.leaderboardMode === next) return;
      audio.ensureCtx();
      audio.playTilt();
      this.leaderboardMode = next;
      this.modalScrollY = 0;
      this.fetchLeaderboard(true);
    },

    async fetchLeaderboard(force = false) {
      const mode = this.leaderboardMode === 'rush' ? 'rush' : 'chef';
      const now = Date.now();
      if (
        !force &&
        !this.leaderboardState.loading &&
        this.leaderboardState.list.length > 0 &&
        this.leaderboardState.mode === mode &&
        now - (this.leaderboardState.lastFetchedAt || 0) < 8000
      ) {
        return;
      }
      this.leaderboardState.loading = true;
      this.leaderboardState.mode = mode;

      const field = mode === 'rush' ? 'bestRush' : 'bestChef';
      const localMyScore = saveData[field] || 0;
      let rows = [];
      let isLocalFallback = false;

      if (CloudConfig.ENABLE_CLOUD_SYNC && cloudState.cloudAvailable && cloudState.status !== 'local_only') {
        const res = await platform.callCloudFunction(CloudConfig.CLOUD_FUNCTION_NAME, {
          action: 'leaderboard',
          mode
        });
        if (res && res.ok && Array.isArray(res.list)) {
          rows = res.list.map((r) => ({ ...r, isNpc: !!r.isNpc }));
        } else {
          isLocalFallback = true;
        }
      } else {
        isLocalFallback = true;
      }

      if (rows.length < 5) {
        const existingNames = new Set(rows.map((r) => r.nickName));
        for (const npc of platform.getDefaultNpcRivals()) {
          if (existingNames.has(npc.nickName)) continue;
          rows.push({
            id: `npc_${npc.nickName}`,
            isMe: false,
            isNpc: true,
            nickName: npc.nickName,
            avatarUrl: '',
            avatarPreset: npc.avatarPreset,
            score: npc[field] || 0,
            bestShiftReached: npc.bestShiftReached || 3
          });
        }
      }

      const meIdx = rows.findIndex((r) => r.isMe);
      const meEntry = {
        id: 'me',
        isMe: true,
        isNpc: false,
        nickName: this.getPlayerDisplayName(),
        avatarUrl: (saveData.playerProfile && saveData.playerProfile.avatarUrl) || '',
        avatarPreset: this.getPlayerAvatarPreset(),
        score: Math.max(localMyScore, meIdx >= 0 ? rows[meIdx].score || 0 : 0),
        bestShiftReached: (saveData.lifetimeStats && saveData.lifetimeStats.bestShiftReached) || 1
      };
      if (meIdx >= 0) {
        rows[meIdx] = meEntry;
      } else if (meEntry.score > 0) {
        rows.push(meEntry);
      }

      rows.sort((a, b) => (b.score || 0) - (a.score || 0));
      const ranked = rows.slice(0, 50).map((r, idx) => {
        if (r.avatarUrl) this.ensureRemoteAvatar(r.avatarUrl);
        return { ...r, rank: idx + 1 };
      });
      const finalMe = ranked.find((r) => r.isMe);

      this.leaderboardState = {
        loading: false,
        mode,
        list: ranked,
        myRank: finalMe ? finalMe.rank : null,
        myScore: meEntry.score,
        isLocalFallback,
        lastFetchedAt: Date.now()
      };
    },

    hasResumableRun(mode = gameState.mode) {
      return !!savedRunsMap[mode];
    },

    resumeSavedRun(mode = gameState.mode) {
      const snap = savedRunsMap[mode];
      if (!snap) return false;
      const ok = resumeSavedRunFn(snap);
      if (ok) {
        audio.ensureCtx();
        audio.playStartCafe();
        this.isLobbyOpen = false;
        this.syncAudioMood();
        const label = snap.mode === 'chef' ? `已恢复第 ${gameState.shift} 幕` : '已恢复对局';
        this.showToast(label, { level: 'major', icon: 'mode_chef', tone: 'success' });
      }
      return ok;
    },

    returnToLobby() {
      if (!this.isLobbyOpen && gameState.running && !gameState.over) {
        saveActiveRunCheckpoint({ syncCloud: false });
      }
      gameState.running = false;
      gameState.paused = false;
      cancelToolMode();
      audio.setFeverMode(false);
      audio.setDangerLevel(0);
      this.toastCurrent = null;
      this.toastQueue = [];
      this.minorToast = null;
      this.syncToastLegacyFields();
      this.confirmDialog = null;
      this.activeModal = null;
      this.isLobbyOpen = true;
      this.syncAudioMood();
    },

    startNewRun(mode = gameState.mode, opts = {}) {
      startNewRunFn(mode);
      audio.playStartCafe();
      const skipGuide = !!(opts && opts.skipGuide);
      if (!skipGuide && (!saveData.seenModeGuides || !saveData.seenModeGuides[mode])) {
        this.openModeGuide(mode, 0);
      }
    },

    requestStartNewRun(mode = gameState.mode) {
      if (this.hasResumableRun(mode)) {
        const sr = savedRunsMap[mode];
        const desc =
          mode === 'chef'
            ? `当前主厨模式有第 ${sr.shift || 1} 幕（¥${sr.shiftRevenue || 0}）未完存档，新开将仅覆盖主厨模式旧档（不影响其他模式）。`
            : '当前模式有未完对局存档，新开将覆盖该模式进度。';
        this.openConfirm({
          title: '覆盖旧局新开？',
          message: desc,
          confirmText: '确认新开',
          cancelText: '继续旧局',
          onConfirm: () => this.startNewRun(mode),
          onCancel: () => this.resumeSavedRun(mode)
        });
        return;
      }
      this.startNewRun(mode);
    },

    restartRun() {
      startNewRunFn(gameState.mode);
      audio.playStartCafe();
      this.showToast('已重新开业', { icon: 'icon_restart', tone: 'info' });
    },

    requestRestartRun(fromModal = null) {
      if (
        !gameState.over &&
        (gameState.dropsMadeThisRun >= 1 || gameState.shift > 1 || gameState.servesCompleted >= 1 || gameState.score > 0)
      ) {
        this.openConfirm({
          title: '确定重新开始？',
          message: '重开将清空当前这一局的进度与秘方构筑。',
          confirmText: '确认重开',
          cancelText: '返回继续',
          returnModal: fromModal,
          onConfirm: () => this.restartRun()
        });
        return;
      }
      this.restartRun();
    },

    shareResult() {
      const ok = platform.triggerShare({
        title: `我在星夜吃茶闯到第 ${gameState.shift} 幕拿下 ¥${gameState.score}（${getChefRank(gameState.score)}），快来合甜品！`
      });
      if (!ok) {
        this.showToast('请点右上角分享给好友', { icon: 'icon_gift', tone: 'info' });
      }
    },

    hasRelic(id) {
      return Array.isArray(gameState.relics) && gameState.relics.includes(id);
    },
    getRelicDef(id) {
      return RELICS.find((r) => r.id === id) || null;
    },
    getArchetypeCount(archId) {
      if (!archId || !Array.isArray(gameState.relics)) return 0;
      let cnt = 0;
      for (let i = 0; i < gameState.relics.length; i++) {
        const def = RELICS.find((r) => r.id === gameState.relics[i]);
        if (def && def.archetype === archId) cnt++;
      }
      return cnt;
    },
    getArchetypeCounts() {
      const counts = { cascade: 0, bank: 0, trait: 0, greed: 0 };
      if (!Array.isArray(gameState.relics)) return counts;
      for (let i = 0; i < gameState.relics.length; i++) {
        const def = RELICS.find((r) => r.id === gameState.relics[i]);
        if (def && counts[def.archetype] !== undefined) counts[def.archetype]++;
      }
      return counts;
    },
    getActiveSynergies() {
      const counts = this.getArchetypeCounts();
      const out = [];
      for (const key of Object.keys(counts)) {
        if (counts[key] >= 2 && ARCHETYPE_SYNERGIES[key]) {
          out.push({
            id: key,
            count: counts[key],
            tier: counts[key] >= 3 ? 3 : 2,
            def: ARCHETYPE_SYNERGIES[key]
          });
        }
      }
      return out;
    },
    getTraitRadiusMult() {
      return this.getArchetypeCount('trait') >= 2 ? 1.22 : 1.0;
    },
    hasShiftHazard(id) {
      return Array.isArray(gameState.shiftHazards) && gameState.shiftHazards.includes(id);
    },
    getShiftHazardDefs() {
      return (gameState.shiftHazards || []).map((id) => SHIFT_HAZARDS[id]).filter(Boolean);
    },
    getDeckModCount(id) {
      return (gameState.deckMods && gameState.deckMods[id]) || 0;
    },
    hasSouffleAura() {
      return gameState.entities.some((e) => !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier === 9);
    },
    getSouffleAuraMult() {
      return this.hasSouffleAura() ? 2.0 : 1.0;
    },
    getCrownAuraMult() {
      if (!this.hasRelic('rel_crown_aura')) return 1.0;
      let highCount = 0;
      for (let i = 0; i < gameState.entities.length; i++) {
        const e = gameState.entities[i];
        if (!e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier >= 6) highCount++;
      }
      return 1 + Math.min(3, highCount) * 0.25;
    },
    getInterestMult() {
      if (!this.hasRelic('rel_interest')) return 1.0;
      const relicBonus = (Array.isArray(gameState.relics) ? gameState.relics.length : 0) * 0.08;
      const coinBonus = Math.floor((gameState.coins || 0) / 10) * 0.05;
      return 1 + Math.min(0.65, relicBonus + coinBonus);
    },
    getGreedSynergyMult() {
      return this.getArchetypeCount('greed') >= 3 ? 1.25 : 1.0;
    },
    getGlobalRevenueMult() {
      const raw =
        this.getSouffleAuraMult() *
        (1 +
          (this.getCrownAuraMult() - 1) +
          (this.getInterestMult() - 1) +
          (this.getGreedSynergyMult() - 1));
      return Math.min(2.6, raw);
    },
    isEntityServable(entity) {
      return findServableMatch(entity);
    },
    serveEntity(entityId) {
      return serveEntityById(entityId);
    },
    serveOrderTable(tableIdx) {
      return serveOrderByTableIndex(tableIdx);
    },
    serveReadyOrder() {
      return serveAnyReadyOrder();
    },
    serveSouffle() {
      const s = gameState.entities.find(
        (e) => !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier === 9
      );
      return s ? serveEntityById(s.id) : false;
    },
    activateChefSkill() {
      activateChefSkillFn();
    },

    closeShiftEarly() { closeShiftEarlyFn(); },
    buyRelic(id) { buyRelicFn(id); },
    sellRelic(id) { sellRelicFn(id); },
    buyDeckMod(id) { buyDeckModFn(id); },
    rerollPrepShop() { rerollPrepShopFn(); },
    proceedNextShift() { proceedNextShiftFn(); },
    enterEndlessOvertime() { enterEndlessOvertimeFn(); },
    finishVictoryRun() { finishVictoryRunFn(); },
    openRelicsModal() {
      if (!gameState.running || gameState.over || this.activeModal) return;
      this.openModal('relics');
    },

    armOrUseTool(key) { armOrUseToolFn(key); },
    cancelToolMode() { cancelToolMode(); },
    swapHoldPocket() { swapHoldPocketFn(); },
    adjustAimAngle(deltaRad) { adjustAimAngle(deltaRad); },
    skipOrder(tableIdx = null) { skipOrderFn(tableIdx); },
    openBlessingModal() { openBlessingModalFn(); },
    applyBlessing(id) { applyBlessingFn(id); }
  };

  function getComboUpgradeBonus() {
    const up = SHOP_UPGRADES.find((u) => u.id === 'up_combo');
    return (up && up.values[app.getUpgradeLevel('up_combo')]) || 0;
  }

  function addSkillEnergy(amount, ignoreStepCap = false) {
    if (!amount || amount <= 0 || gameState.skillEnergy >= 100) return 0;
    let delta = amount;
    if (!ignoreStepCap) {
      const remCap = Math.max(0, 70 - gameState.stepSkillGain);
      delta = Math.min(delta, remCap);
      gameState.stepSkillGain += delta;
    }
    if (delta <= 0) return 0;
    const prev = gameState.skillEnergy;
    gameState.skillEnergy = Math.min(100, gameState.skillEnergy + delta);
    if (prev < 100 && gameState.skillEnergy >= 100) {
      const sk = app.activePatron.activeSkill;
      audio.playBlessingReady();
      app.showToast(`${sk.name} 已就绪`, { level: 'major', icon: sk.icon, tone: 'event' });
      spawnSparkleBurst(JAR.canvasW / 2, JAR.floorY - 12, '#ffe47a', 18);
    }
    return delta;
  }

  function getDustMultiplier() {
    const lv = app.getUpgradeLevel('up_dust');
    return SHOP_UPGRADES.find((u) => u.id === 'up_dust').mults[lv] || 1;
  }

  function addRunStardust(baseAmt) {
    if (!baseAmt || baseAmt <= 0) return 0;
    const gained = Math.max(1, Math.round(baseAmt * getDustMultiplier()));
    gameState.stardust += gained;
    return gained;
  }

  function hasAffordableShopItem() {
    const bank = saveData.bankStardust || 0;
    for (const up of SHOP_UPGRADES) {
      const lv = app.getUpgradeLevel(up.id);
      if (lv < up.maxLv && bank >= up.costs[lv]) return true;
    }
    for (const th of JAR_THEME_LIST) {
      if (!saveData.unlockedThemes.includes(th.id) && bank >= th.cost) return true;
    }
    for (const p of PATRONS) {
      if (!saveData.unlockedPatrons.includes(p.id) && bank >= p.cost) return true;
    }
    return false;
  }

  function setBestScore(val, mode = gameState.mode) {
    if (mode === 'rush') saveData.bestRush = Math.max(saveData.bestRush || 0, val);
    else if (mode === 'zen') saveData.bestZen = Math.max(saveData.bestZen || 0, val);
    else saveData.bestChef = Math.max(saveData.bestChef || 0, val);
    persistSaveData();
  }

  function setPatronSpeech(patron, text, duration = 4.2) {
    gameState.speechPatron = patron;
    gameState.speechText = text;
    gameState.speechTimer = duration;
  }

  function getRainbowPityBase() {
    const modeBase = gameState.mode === 'rush' ? 8 : 12;
    const lunaBonus = saveData.selectedPatron === 'luna' ? 2 : 0;
    const modRainbowBonus = app.getDeckModCount('mod_rainbow') * 3;
    return Math.max(3, modeBase - lunaBonus - app.getPerkLevel('rainbow') * 2 - modRainbowBonus);
  }

  function pickDropTier() {
    const trimT1 = app.getDeckModCount('mod_trim_t1') > 0;
    const boostT3 = app.getDeckModCount('mod_boost_t3');
    const mult34 = Math.pow(2, boostT3);
    const w1 = trimT1 ? 0 : 36;
    const w2 = 32;
    const w3 = 22 * mult34;
    const w4 = 10 * mult34;
    const total = w1 + w2 + w3 + w4;
    let roll = Math.random() * total;
    if (roll < w1) return 1;
    roll -= w1;
    if (roll < w2) return 2;
    roll -= w2;
    if (roll < w3) return 3;
    return 4;
  }

  function pickDropBundle(forceRainbow = false) {
    if (forceRainbow) {
      return { tier: 2, meta: { wildcard: true, golden: false } };
    }
    const tier = pickDropTier();
    const goldenLv = app.getPerkLevel('golden');
    const goldModBonus = app.getDeckModCount('mod_gold_tray') * 0.18;
    let goldenChance = 0.09 + goldenLv * 0.1 + goldModBonus + (gameState.feverTimer > 0 && goldenLv > 0 ? 0.12 : 0);
    if (gameState.meteorGoldenLeft > 0) {
      gameState.meteorGoldenLeft--;
      goldenChance = Math.max(goldenChance, 0.75);
    }
    return { tier, meta: { wildcard: false, golden: Math.random() < Math.min(0.95, goldenChance) } };
  }

  function grantNextRainbow(reason = '') {
    if (!gameState.nextMeta || !gameState.nextMeta.wildcard) {
      gameState.nextTier = 2;
      gameState.nextMeta = { wildcard: true, golden: false };
      gameState.dropsUntilRainbow = getRainbowPityBase();
      if (reason) app.showToast(`${reason} · 下颗彩虹糖`, { icon: 'icon_rainbow', tone: 'event' });
    } else if (!gameState.curMeta || !gameState.curMeta.wildcard) {
      gameState.curTier = 2;
      gameState.curMeta = { wildcard: true, golden: false };
      gameState.dropsUntilRainbow = getRainbowPityBase();
      if (reason) app.showToast(`${reason} · 当前彩虹糖`, { icon: 'icon_rainbow', tone: 'event' });
    }
  }

  const ZEN_COMPAT_RELIC_IDS = new Set([
    'rel_shockwave',
    'rel_prism',
    'rel_bouncy',
    'rel_bumpers',
    'rel_ricochet',
    'rel_lemonade',
    'rel_antigrav',
    'rel_resonance',
    'rel_crit_star',
    'rel_crown_aura'
  ]);

  function grantMilestoneRelicOrSupply(reason = '里程碑达成') {
    gameState.pendingBlessings = 0;
    if (gameState.mode === 'chef') {
      const c = addCoins(6);
      const d = addRunStardust(12);
      audio.playBlessingReady();
      app.showToast(`${reason} · +${c}币 +${d}星露`, { level: 'minor', icon: 'icon_coin', tone: 'success' });
      return;
    }

    const ownedSet = new Set(gameState.relics || []);
    const pool = RELICS.filter((r) => {
      if (ownedSet.has(r.id)) return false;
      if (gameState.mode === 'zen') return ZEN_COMPAT_RELIC_IDS.has(r.id);
      return r.id !== 'rel_interest' && r.id !== 'rel_perpetual';
    });

    if (gameState.relics.length < MAX_RELIC_SLOTS && pool.length > 0) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      gameState.relics.push(pick.id);
      if (pick.id === 'rel_bumpers') syncObstaclesForShift();
      if (pick.id === 'rel_double_vip') initOrders();
      audio.playBlessingPick();
      spawnSparkleBurst(JAR.canvasW / 2, 230, '#ffe27a', 20);
      app.showToast(`${reason} · 获赠秘方【${pick.name}】`, {
        level: 'major',
        icon: pick.icon || 'icon_gift',
        tone: 'success'
      });
    } else {
      gameState.tools.shake++;
      addSkillEnergy(45, true);
      const dust = addRunStardust(18);
      audio.playBlessingReady();
      app.showToast(`${reason} · 摇罐+1 技+45% +${dust}星露`, {
        level: 'major',
        icon: 'icon_toolbox',
        tone: 'success'
      });
    }
  }

  function queueBlessing(reason = '里程碑达成') {
    grantMilestoneRelicOrSupply(reason);
  }

  function openBlessingModalFn() {
    // Legacy 3.0 Blessing modal merged into unified Relics system
  }

  function applyBlessingFn(_id) {
    // Legacy 3.0 Blessing modal merged into unified Relics system
  }

  function unlockTier(tier) {
    gameState.seenThisRun.add(tier);
    if (tier > gameState.maxTierRun) gameState.maxTierRun = tier;
    if (!saveData.unlockedTiers.includes(tier)) {
      saveData.unlockedTiers.push(tier);
      saveData.unlockedTiers.sort((a, b) => a - b);
      persistSaveData();
      app.showToast(`解锁新品：${TIERS[tier - 1].name}`, { level: 'major', icon: `tier_${tier}`, tone: 'success' });
    }
  }

  // =========================================================================
  // 4.1 Dual-Table Orders, Dedicated/Long-Press Serve & Persistent-Jar Roguelike
  // =========================================================================
  let nextOrderUid = 1;

  function generateTableOrder(rawKind, isInitial = false, opts = {}) {
    // rel_double_vip upgrades Quick Table into a second VIP Table!
    const kind = rawKind === 'quick' && app.hasRelic('rel_double_vip') ? 'vip' : rawKind;
    const isJudgeRush = !!opts.isJudgeRush;
    const doubleFresh = !!opts.doubleFresh;
    const isRushMode = gameState.mode === 'rush';
    const isStarterBlitz = isRushMode && isInitial && rawKind === 'quick';
    const isFastFresh = gameState.mode === 'chef' && app.hasShiftHazard('fast_fresh');
    const maxMade = Math.max(4, gameState.maxTierRun);
    const doneCount = gameState.ordersCompleted;
    const activePatron = app.activePatron;
    const patron = isInitial
      ? activePatron
      : PATRONS[(doneCount + (kind === 'vip' ? 1 : 0) + Math.floor(Math.random() * PATRONS.length)) % PATRONS.length];

    let reqTiers = [];
    if (isJudgeRush) {
      const tHigh = Math.min(6, Math.max(4, Math.min(maxMade, 4 + Math.floor(Math.random() * 2))));
      reqTiers = [tHigh];
    } else if (kind === 'quick') {
      if (isInitial) {
        reqTiers = [3];
      } else if (isRushMode && doneCount < 3) {
        reqTiers = [Math.random() < 0.55 ? 2 : 3];
      } else {
        const cap = Math.min(5, Math.max(4, maxMade - 1));
        const t = 3 + Math.floor(Math.random() * (cap - 2));
        reqTiers = [t];
      }
    } else {
      if (isInitial) {
        reqTiers = rawKind === 'quick' ? [3] : isRushMode ? [2, 3] : [3, 4];
      } else if (Math.random() < 0.58) {
        const cap = Math.min(6, Math.max(4, maxMade));
        const tA = 3 + Math.floor(Math.random() * Math.max(1, Math.min(2, cap - 3)));
        const tB = Math.min(6, Math.max(4, tA + 1 + (Math.random() < 0.35 ? 1 : 0)));
        reqTiers = [tA, tB].sort((a, b) => a - b);
      } else {
        const maxVipSingle = gameState.mode === 'chef' && gameState.shift < 5 ? 6 : 7;
        const tHigh = Math.min(maxVipSingle, Math.max(5, Math.min(maxMade, 5 + Math.floor(doneCount / 4))));
        reqTiers = [tHigh];
      }
    }

    const mikanAllMult = saveData.selectedPatron === 'mikan' ? 1.2 : 1.0;
    const greedVipMult = app.getArchetypeCount('greed') >= 2 && kind === 'vip' ? 1.2 : 1.0;
    const doubleVipMult = app.hasRelic('rel_double_vip') && kind === 'vip' ? 1.2 : 1.0;
    const shiftScale = gameState.mode === 'chef' ? 1 + Math.max(0, gameState.shift - 1) * 0.12 : 1.0;
    const starterBlitzFlat = isStarterBlitz ? 90 : 0;
    const baseBonusScore = Math.round(
      (reqTiers.reduce((acc, t) => acc + TIERS[t - 1].servePoints * (kind === 'vip' ? 0.55 : 0.35), kind === 'vip' ? 140 : 60) +
        starterBlitzFlat) *
        mikanAllMult *
        greedVipMult *
        doubleVipMult *
        shiftScale
    );
    const rewardDust = Math.round(
      ((kind === 'vip' ? 20 : 10) + reqTiers.reduce((acc, t) => acc + t * 2, 0)) * mikanAllMult
    );
    const freshMax = isJudgeRush ? 4 : isFastFresh ? 5 : kind === 'vip' ? 8 : 6;
    const baseFreshMult = isJudgeRush ? 2.5 : isFastFresh ? 2.0 : isStarterBlitz ? 1.65 : kind === 'vip' ? 1.5 : 1.35;
    const freshMult = doubleFresh ? +(baseFreshMult * 1.35).toFixed(2) : baseFreshMult;
    const freshPenalty = Math.max(0, Math.floor(opts.freshPenalty || 0));
    const initialFreshSteps = Math.max(isFastFresh ? 0 : 1, freshMax - freshPenalty);

    return {
      uid: nextOrderUid++,
      kind, // 'quick' | 'vip'
      slotOrigin: rawKind,
      isJudgeRush,
      isStarterBlitz,
      bonusSteps: isJudgeRush ? 2 : 0,
      label: isJudgeRush ? '评委急单' : isStarterBlitz ? '闪电迎宾' : kind === 'vip' ? 'VIP桌' : '快餐桌',
      patron,
      slots: reqTiers.map((tier) => ({ tier, done: false })),
      bonusScore: baseBonusScore,
      rewardDust,
      freshSteps: initialFreshSteps,
      freshMax,
      freshMult,
      staleMult: isFastFresh ? 0.75 : 1.0,
      completed: false
    };
  }

  function initOrders() {
    if (gameState.mode === 'zen') {
      gameState.orders = [];
      gameState.order = null;
      return;
    }
    const quick = generateTableOrder('quick', true);
    const vip = generateTableOrder('vip', true);
    gameState.orders = [quick, vip];
    gameState.order = vip;
  }

  function findServableMatch(entity, preferredOrderUid = null) {
    if (!entity || entity.merged || entity.isWildcard || entity.isYarnBall || entity.frozenHp > 0) return null;
    if (entity.tier === 9) {
      return { kind: 'souffle', order: null, slotIdx: -1 };
    }
    if (!gameState.orders || gameState.orders.length === 0) return null;

    if (preferredOrderUid !== null) {
      const pref = gameState.orders.find((o) => o && !o.completed && o.uid === preferredOrderUid);
      if (pref) {
        const sIdx = pref.slots.findIndex((s) => !s.done && s.tier === entity.tier);
        if (sIdx !== -1) return { kind: pref.kind, order: pref, slotIdx: sIdx };
      }
    }

    // Prioritize Judge Rush / VIP table, then Quick table
    let best = null;
    for (let oi = 0; oi < gameState.orders.length; oi++) {
      const ord = gameState.orders[oi];
      if (!ord || ord.completed) continue;
      const slotIdx = ord.slots.findIndex((s) => !s.done && s.tier === entity.tier);
      if (slotIdx === -1) continue;
      if (!best) {
        best = { kind: ord.kind, order: ord, slotIdx };
      } else if (ord.isJudgeRush && !best.order.isJudgeRush) {
        best = { kind: ord.kind, order: ord, slotIdx };
      } else if (ord.kind === 'vip' && best.kind !== 'vip') {
        best = { kind: ord.kind, order: ord, slotIdx };
      } else if (ord.kind === best.kind && ord.freshSteps > best.order.freshSteps) {
        best = { kind: ord.kind, order: ord, slotIdx };
      }
    }
    return best;
  }

  function findServableEntityAt(x, y, pad = 10) {
    for (let i = gameState.entities.length - 1; i >= 0; i--) {
      const e = gameState.entities[i];
      if (e.merged) continue;
      if (!findServableMatch(e)) continue;
      if (Physics.pointInBody(e, x, y, pad)) return e;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.r + pad) return e;
    }
    return null;
  }

  function serveOrderByTableIndex(tableIdx) {
    if (!gameState.running || gameState.over || gameState.paused) return false;
    const ord = gameState.orders && gameState.orders[tableIdx];
    if (!ord || ord.completed) return false;
    const neededTiers = new Set(ord.slots.filter((s) => !s.done).map((s) => s.tier));
    if (neededTiers.size === 0) return false;
    // Prefer bottom-most (largest Y) matching treat so serving naturally excavates the bottom for Serve Cascade!
    const candidates = gameState.entities
      .filter((e) => !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && neededTiers.has(e.tier))
      .sort((a, b) => b.y - a.y);
    if (candidates.length === 0) return false;
    return serveEntityById(candidates[0].id, ord.uid);
  }

  function serveAnyReadyOrder() {
    if (!gameState.orders || gameState.orders.length === 0) return false;
    const orderPriority = gameState.orders
      .map((o, idx) => ({ o, idx }))
      .filter((it) => it.o && !it.o.completed)
      .sort((a, b) => (b.o.isJudgeRush ? 1 : 0) - (a.o.isJudgeRush ? 1 : 0) || (b.o.kind === 'vip' ? 1 : 0) - (a.o.kind === 'vip' ? 1 : 0));
    for (const it of orderPriority) {
      if (serveOrderByTableIndex(it.idx)) return true;
    }
    return false;
  }

  function wakeNeighborsAfterRemoval(rx, ry, removedR) {
    const wakeRadius = removedR * 3.4 + 45;
    for (const other of gameState.entities) {
      if (other.merged) continue;
      const dx = other.x - rx;
      const dy = other.y - ry;
      const dist = Math.hypot(dx, dy);
      if (dist < wakeRadius && other.y <= ry + removedR * 0.65) {
        other.vy = Math.max(other.vy, 34);
        other.vx += (dx === 0 ? (Math.random() - 0.5) : -Math.sign(dx)) * 18;
        other.vr += (dx >= 0 ? -1 : 1) * 0.9;
      }
    }
  }

  function startCascadeWindow(originX, originY, refundStaleStep = false) {
    const baseDur = app.hasRelic('rel_domino') ? 4.2 : 2.6;
    const synBonus = app.getArchetypeCount('cascade') >= 2 ? 0.8 : 0;
    const dur = baseDur + synBonus + getComboUpgradeBonus();
    gameState.serveCascadeTimer = Math.max(gameState.serveCascadeTimer, dur);
    gameState.serveCascadeMerges = 0;
    gameState.cascadeStaleRefundPending = !!refundStaleStep;
    gameState.serveCascadeOrigin = { x: originX, y: originY };
  }

  function applyAftershockPulse(cx, cy) {
    if (!app.hasRelic('rel_aftershock')) return;
    let pulled = 0;
    for (const other of gameState.entities) {
      if (other.merged) continue;
      const dx = cx - other.x;
      const dy = cy - other.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6 && dist <= 135) {
        const factor = 1 - dist / 135;
        const force = 125 + factor * 145;
        other.vx += (dx / dist) * force;
        other.vy += (dy / dist) * force * 0.72 - 18;
        pulled++;
      }
    }
    if (pulled > 0) {
      spawnShockwave(cx, cy, 135, '#8ee8ff', 3.4);
      spawnPopup(cx, cy - 30, '余震聚拢', '#9cf4ff', 13.5);
    }
  }

  function triggerTradeUpRelic() {
    if (!app.hasRelic('rel_tradeup')) return;
    const candidates = gameState.entities.filter(
      (e) => !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier < 8
    );
    if (candidates.length === 0) return;
    const minTier = Math.min(...candidates.map((e) => e.tier));
    const pool = candidates.filter((e) => e.tier === minTier);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    const nextTier = pick.tier + 1;
    const def = TIERS[nextTier - 1];
    pick.tier = nextTier;
    Physics.configureBodyShape(pick, getShapeDef(nextTier), def.radius, def.material);
    Physics.clampBodyInsideJarPositional(pick, JAR, gameState.obstacles);
    pick.squishAmt = 0.24;
    pick.squishVel = 0;
    unlockTier(nextTier);
    spawnSparkleBurst(pick.x, pick.y, '#ffb366', 18);
    spawnShockwave(pick.x, pick.y, pick.r * 1.9, '#ffb366', 3.2);
    spawnPopup(pick.x, pick.y - pick.r - 12, `以小换大 ${nextTier}阶`, '#ffd480', 14);
    notifyTreatSynthesized(nextTier, pick);
  }

  function serveEntityById(entityId, preferredOrderUid = null) {
    if (!gameState.running || gameState.over || gameState.paused) return false;
    const ent = gameState.entities.find((e) => e.id === entityId && !e.merged);
    if (!ent) return false;
    const match = findServableMatch(ent, preferredOrderUid);
    if (!match) return false;

    // Chef Mode Spatial & Step Tradeoff: Fresh orders serve for 0 steps; Stale orders cost 1 step (refunded on Cascade!)
    let staleStepCharged = false;
    if (gameState.mode === 'chef' && match.kind !== 'souffle' && match.order) {
      const isOrderFresh = match.order.freshSteps > 0;
      if (!isOrderFresh) {
        if (gameState.stepsLeft <= 0) {
          app.showToast('冷单上菜需消耗 1 步（趁热单免步）', { level: 'minor', icon: 'icon_warn', tone: 'warn' });
          return false;
        }
        gameState.stepsLeft = Math.max(0, gameState.stepsLeft - 1);
        gameState.shiftStepsUsed++;
        staleStepCharged = true;
        if (gameState.stepsLeft === 0) {
          gameState.shiftResolveDelay = Math.max(gameState.shiftResolveDelay, 1.35);
        }
      }
    }

    audio.ensureCtx();
    audio.playServeBell();
    platform.vibrateShort('medium');

    // 1. Remove served dessert from jar & trigger vacuum collapse wake-up!
    gameState.entities = gameState.entities.filter((e) => e.id !== ent.id);
    wakeNeighborsAfterRemoval(ent.x, ent.y, ent.r);
    applyAftershockPulse(ent.x, ent.y);
    startCascadeWindow(ent.x, ent.y, staleStepCharged);

    // Relic: rel_echo — T4~T8 re-fire their dessert trait on serve!
    if (app.hasRelic('rel_echo') && ent.tier >= 4 && ent.tier <= 8) {
      triggerDessertTrait(ent, ent.x, ent.y, true);
    }

    // 2. Flying serve animation toward top order bar
    const targetX = match.kind === 'vip' ? JAR.canvasW * 0.68 : match.kind === 'souffle' ? JAR.canvasW * 0.5 : JAR.canvasW * 0.3;
    gameState.flyingServes.push({
      tier: ent.tier,
      isGolden: !!ent.isGolden,
      x0: ent.x,
      y0: ent.y,
      cx: (ent.x + targetX) * 0.5 + (ent.x < JAR.canvasW * 0.5 ? -38 : 38),
      cy: Math.min(ent.y, JAR.neckY) - 48,
      x1: targetX,
      y1: 12,
      t: 0,
      dur: 0.34
    });

    spawnSparkleBurst(ent.x, ent.y, '#ffe47a', 20);
    spawnShockwave(ent.x, ent.y, ent.r * 2.1 + 36, '#ffe47a', 3.6);
    gameState.jarFlash = Math.max(gameState.jarFlash, 0.38);

    gameState.servesCompleted++;
    saveData.lifetimeStats.servesTotal = (saveData.lifetimeStats.servesTotal || 0) + 1;
    persistSaveData();

    // Mikan Patron Buff: first serve each shift grants +25% bonus signature skill energy
    if (saveData.selectedPatron === 'mikan' && !gameState.mikanFirstServeUsed) {
      gameState.mikanFirstServeUsed = true;
      addSkillEnergy(25, true);
    }

    const feverMult = app.getFeverMultiplier();
    const goldMult = ent.isGolden ? 1.6 : 1.0;
    const globalMult = app.getGlobalRevenueMult();

    // Special Case: T9 Crown Cat Soufflé Grand Slam!
    if (match.kind === 'souffle') {
      const nonSouffleGlobal = Math.min(
        2.2,
        1 + (app.getCrownAuraMult() - 1) + (app.getInterestMult() - 1) + (app.getGreedSynergyMult() - 1)
      );
      const pts = Math.round(TIERS[8].servePoints * Math.min(5.0, feverMult * goldMult * nonSouffleGlobal));
      addScore(pts);
      const dust = addRunStardust(48);
      if (gameState.mode === 'chef') addCoins(15);
      addFeverEnergy(55);
      addSkillEnergy(100, true);
      audio.playSupernova();
      platform.vibrateShort('heavy');

      // Cleanse all T1~T2 treats in jar as celebration garnish (excluding frozen treats)!
      let cleansed = 0;
      gameState.entities = gameState.entities.filter((other) => {
        if (!other.isWildcard && !other.isYarnBall && !(other.frozenHp > 0) && other.tier <= 2) {
          cleansed++;
          spawnSparkleBurst(other.x, other.y, '#ffe899', 10);
          return false;
        }
        return true;
      });
      if (gameState.mode === 'rush') {
        gameState.rushTimer += 6.0;
      }
      spawnPopup(ent.x, ent.y - 20, `主菜献礼 +¥${pts}`, '#ffe570', 21);
      showComboBanner('星冠猫神献礼', `+¥${pts} · +${dust}星露 · 净化${cleansed}颗`, '#ffe570', 'icon_crown', 3);
      scheduleCheckpointSave();
      return true;
    }

    // Standard / VIP Table Serve (additive bonus cap to prevent runaway multiplication)
    const ord = match.order;
    const def = TIERS[ent.tier - 1];
    const isFresh = ord.freshSteps > 0;
    const freshMult = isFresh ? ord.freshMult : (ord.staleMult || 1.0);
    const mikanAllBonus = saveData.selectedPatron === 'mikan' ? 0.2 : 0;
    const greedVipBonus = app.getArchetypeCount('greed') >= 2 && ord.kind === 'vip' ? 0.2 : 0;
    const doubleVipBonus = app.hasRelic('rel_double_vip') && ord.kind === 'vip' ? 0.2 : 0;
    const agedBonus = app.hasRelic('rel_aged') && ent.agedStacks > 0 ? Math.min(1.5, ent.agedStacks * 0.3) : 0;

    // 90s Rush Mode: Consecutive Serve Streak Multiplier & Escalating Time Bonus!
    let rushStreakBonus = 0;
    let rushStreakMult = 1.0;
    let rushAddSec = 3.0;
    if (gameState.mode === 'rush') {
      gameState.rushServeStreak = (gameState.rushStreakTimer > 0 ? gameState.rushServeStreak : 0) + 1;
      gameState.rushStreakTimer = 12.0;
      gameState.rushMaxStreak = Math.max(gameState.rushMaxStreak || 0, gameState.rushServeStreak);
      rushStreakBonus = Math.min(1.5, (gameState.rushServeStreak - 1) * 0.35);
      rushStreakMult = +(1 + rushStreakBonus).toFixed(2);
      rushAddSec = +(Math.min(4.5, 3.0 + Math.min(3, gameState.rushServeStreak - 1) * 0.5) + (ord.isStarterBlitz ? 0.5 : 0)).toFixed(1);
    }

    const additiveServeBonus = Math.min(
      4.2,
      1 + (feverMult - 1) + mikanAllBonus + greedVipBonus + doubleVipBonus + agedBonus + rushStreakBonus
    );
    const totalServeMult = Math.min(8.0, freshMult * goldMult * globalMult * additiveServeBonus);
    const servePts = Math.round(def.servePoints * totalServeMult);

    addScore(servePts);
    const blitzFeverBonus = ord.isStarterBlitz ? 16 : 0;
    const streakFeverBonus = gameState.mode === 'rush' ? Math.min(18, (gameState.rushServeStreak - 1) * 6) : 0;
    addFeverEnergy(22 + blitzFeverBonus + streakFeverBonus);
    const cascadeSynSkill = app.getArchetypeCount('cascade') >= 2 ? 10 : 0;
    addSkillEnergy(35 + cascadeSynSkill);

    // Relic: rel_tradeup — serving ≥T4 upgrades 1 random lowest-tier treat
    if (ent.tier >= 4) {
      triggerTradeUpRelic();
    }

    if (gameState.mode === 'rush') {
      gameState.rushTimer += rushAddSec;
      const streakLabel =
        gameState.rushServeStreak >= 2
          ? `${gameState.rushServeStreak}连上菜 ×${rushStreakMult} +${rushAddSec}s`
          : ord.isStarterBlitz
          ? `闪电迎宾 +${rushAddSec}s`
          : `出餐 +${rushAddSec}s`;
      spawnPopup(ent.x, ent.y - 44, streakLabel, '#9cf4ff', 15);
    }

    ord.slots[match.slotIdx].done = true;
    const agedTag = agedBonus > 0 ? `陈酿+${Math.round(agedBonus * 100)}% ` : '';
    const freshTag = isFresh ? '热单 ' : staleStepCharged ? '冷单-1步 ' : '';
    const currSym = gameState.mode === 'chef' ? '¥' : '';
    spawnPopup(ent.x, ent.y - 16, `${agedTag}${freshTag}+${currSym}${servePts}`, '#ffe67e', 18);

    // Check if the entire table order is complete
    if (ord.slots.every((s) => s.done)) {
      ord.completed = true;
      gameState.ordersCompleted++;
      const orderMult = Math.min(6.5, freshMult * globalMult * Math.min(2.8, feverMult * rushStreakMult));
      const bonusPts = Math.round(ord.bonusScore * orderMult);
      const dust = addRunStardust(Math.round(ord.rewardDust * freshMult));
      addScore(bonusPts);
      addFeverEnergy(ord.kind === 'vip' ? 24 : 14);
      if (ord.kind === 'vip') addSkillEnergy(25);
      audio.playOrderComplete();

      // VIP Coin Bonus (+8 coins fresh / +4 coins stale in Chef 5-Shift mode)
      let coinNote = '';
      if (gameState.mode === 'chef' && ord.kind === 'vip') {
        const vipCoins = isFresh ? 8 : 4;
        addCoins(vipCoins);
        coinNote = ` · +${vipCoins}币`;
      }
      // Shift 5 Judge Rush Order step reward (+2 steps + cancel end-of-steps settle!)
      let stepNote = '';
      if (gameState.mode === 'chef' && ord.bonusSteps > 0 && isFresh) {
        gameState.stepsLeft += ord.bonusSteps;
        gameState.shiftResolveDelay = 0;
        stepNote = ` · +${ord.bonusSteps}步`;
        spawnPopup(JAR.canvasW * 0.5, 130, `评委赞赏 +${ord.bonusSteps}步`, '#ffe570', 18);
      }

      const activePatron = app.activePatron;
      setPatronSpeech(
        activePatron,
        ord.kind === 'vip' ? `${activePatron.thanks} VIP大单完成！` : activePatron.thanks,
        3.6
      );

      if (ord.kind === 'vip') {
        if (isFresh) grantNextRainbow('VIP极速上菜');
        showComboBanner(
          ord.isJudgeRush ? '评委急单大胜' : 'VIP 套餐上齐',
          `+${currSym}${servePts + bonusPts} · +${dust}星露${coinNote}${stepNote}`,
          '#ffe378',
          ord.isJudgeRush ? 'icon_judge' : 'icon_crown',
          2
        );
      } else {
        gameState.quickOrdersCompleted = (gameState.quickOrdersCompleted || 0) + 1;
        let quickTip = '';
        if (gameState.mode === 'chef' && gameState.quickOrdersCompleted % 2 === 0) {
          addCoins(4);
          quickTip = ' · 翻台+4币';
        }
        app.showToast(`快餐出单 +${currSym}${servePts + bonusPts} · +${dust}星露${quickTip}`, {
          level: 'minor',
          icon: 'serve_bell',
          tone: 'success'
        });
      }

      const replaceOrigin = ord.slotOrigin || ord.kind;
      const replaceUid = ord.uid;
      setTimeout(() => {
        if (!gameState.running || gameState.over || gameState.mode === 'zen') return;
        const idx = gameState.orders.findIndex((o) => o && o.uid === replaceUid);
        if (idx !== -1) {
          gameState.orders[idx] = generateTableOrder(replaceOrigin, false);
          gameState.order = gameState.orders[1] || gameState.orders[0] || null;
        }
      }, 520);
    } else {
      app.showToast(`上菜 ${def.name} +${currSym}${servePts} · 差1份`, {
        level: 'minor',
        icon: 'serve_bell',
        tone: 'info'
      });
    }

    scheduleCheckpointSave();
    return true;
  }

  function notifyTreatSynthesized(tier, entity) {
    if (!entity || gameState.mode === 'zen') return;
    const match = findServableMatch(entity);
    if (match && match.kind !== 'souffle') {
      audio.playOrderStamp();
      spawnPopup(entity.x, entity.y - entity.r - 12, '可上菜', '#fff099', 13);
    }
  }

  function hasReadyTreatForOrder(ord) {
    if (!ord || ord.completed) return false;
    return ord.slots.some(
      (s) =>
        !s.done &&
        gameState.entities.some((e) => !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier === s.tier)
    );
  }

  function skipOrderFn(targetIdx = null) {
    if (gameState.skipCooldown > 0 || gameState.mode === 'zen') return;
    if (!gameState.orders || gameState.orders.length === 0) return;

    let idx = typeof targetIdx === 'number' && targetIdx >= 0 && targetIdx < gameState.orders.length ? targetIdx : -1;
    if (idx !== -1 && gameState.orders[idx] && gameState.orders[idx].isJudgeRush) {
      app.showToast('评委急单不可更换', { level: 'minor', icon: 'icon_judge', tone: 'warn' });
      return;
    }

    if (idx === -1) {
      // Smart single-table selection: protect Judge Rush & partially-completed VIP orders, prefer unready table!
      const o0 = gameState.orders[0];
      const o1 = gameState.orders[1];
      if (!o1 || o1.isJudgeRush || o1.slots.some((s) => s.done)) {
        idx = 0;
      } else if (hasReadyTreatForOrder(o0) && !hasReadyTreatForOrder(o1)) {
        idx = 1;
      } else if (!hasReadyTreatForOrder(o0) && hasReadyTreatForOrder(o1)) {
        idx = 0;
      } else {
        idx = gameState.lastSkippedIdx === 0 ? 1 : 0;
      }
      if (gameState.orders[idx] && gameState.orders[idx].isJudgeRush) {
        idx = idx === 0 ? 1 : 0;
      }
    }

    const oldOrd = gameState.orders[idx];
    if (!oldOrd || oldOrd.isJudgeRush) return;

    let freshPenalty = 0;
    let costNote = '';
    if (gameState.mode === 'chef') {
      if (gameState.freeSkipsLeft > 0) {
        gameState.freeSkipsLeft--;
        costNote = '（首免）';
      } else if (gameState.coins >= 3) {
        gameState.coins -= 3;
        audio.ensureCtx();
        audio.playCoinSpend();
        costNote = '（-3币）';
      } else {
        freshPenalty = 3;
        costNote = '（折3步鲜度）';
      }
    }

    audio.ensureCtx();
    audio.playTilt();
    gameState.skipCooldown = 6;
    gameState.lastSkippedIdx = idx;
    const rawOrigin = oldOrd.slotOrigin || (idx === 0 ? 'quick' : 'vip');
    const replacement = generateTableOrder(rawOrigin, false, { freshPenalty });
    gameState.orders[idx] = replacement;
    gameState.order = gameState.orders[1] || gameState.orders[0] || null;
    const tableLabel = idx === 0 ? '快餐桌' : 'VIP桌';
    app.showToast(`已换${tableLabel}点单${costNote}`, { level: 'minor', icon: 'icon_restart', tone: 'info' });
  }

  function addCoins(amt) {
    if (!amt || amt <= 0) return 0;
    const n = Math.floor(amt);
    gameState.coins += n;
    return n;
  }

  // Score / Shift Revenue, Fever, Shop Events, Rush Gust
  function addScore(pts) {
    if (!pts || pts <= 0) return;
    gameState.score += pts;
    if (gameState.score > app.getBestScore()) {
      setBestScore(gameState.score);
    }
    if (!gameState.running || gameState.over) return;

    if (gameState.mode === 'chef') {
      gameState.shiftRevenue += pts;
      if (!gameState.shiftClearedFlag && gameState.shiftRevenue >= gameState.shiftTarget) {
        gameState.shiftClearedFlag = true;
        audio.playShiftClear();
        platform.vibrateShort('medium');
        const remInterest = gameState.stepsLeft * 4;
        showComboBanner(
          `第 ${gameState.shift} 幕达标`,
          remInterest > 0 ? `可点打烊换 +${remInterest}币，或继续留罐布局` : '本幕圆满达标',
          '#ffe570',
          'icon_trophy',
          3
        );
      }
    }

    if (gameState.mode === 'zen') {
      while (gameState.score >= gameState.zenNextMilestone) {
        const hit = gameState.zenNextMilestone;
        gameState.zenNextMilestone = hit < 1400 ? 1400 : hit < 2800 ? 2800 : hit < 4800 ? 4800 : hit + 3200;
        grantMilestoneRelicOrSupply(`达成 ${hit} 分`);
      }
    }

    if (gameState.mode === 'rush') {
      while (gameState.score >= gameState.rushNextMilestone) {
        const hit = gameState.rushNextMilestone;
        gameState.rushNextMilestone = hit < 2600 ? 2600 : hit < 4800 ? 4800 : hit + 3400;
        grantMilestoneRelicOrSupply(`突破 ${hit} 分`);
      }
    }
  }

  // =========================================================================
  // 4.1 Persistent-Jar 5-Shift Progression & Inter-Shift Prep Shop
  // =========================================================================
  const ENDLESS_HAZARD_PAIRS = [
    ['glaze_ring', 'divider'],
    ['bumpers', 'fast_fresh'],
    ['glaze_ring', 'bumpers'],
    ['divider', 'fast_fresh'],
    ['glaze_ring', 'fast_fresh'],
    ['divider', 'bumpers']
  ];

  function pickHazardsForShift(shiftNum, forcedHazards = null) {
    if (forcedHazards !== null && forcedHazards !== undefined) {
      let rawList = [];
      if (Array.isArray(forcedHazards)) {
        rawList = forcedHazards;
      } else if (typeof forcedHazards === 'string') {
        rawList = [forcedHazards];
      } else if (typeof forcedHazards === 'object') {
        if (Array.isArray(forcedHazards.forceHazards)) rawList = forcedHazards.forceHazards;
        else if (Array.isArray(forcedHazards.forceHazard)) rawList = forcedHazards.forceHazard;
        else if (typeof forcedHazards.forceHazard === 'string') rawList = [forcedHazards.forceHazard];
      }
      const unique = [];
      for (const id of rawList) {
        if (SHIFT_HAZARDS[id] && !unique.includes(id)) unique.push(id);
      }
      return unique;
    }

    const n = Math.max(1, Math.floor(Number(shiftNum) || 1));
    if (n === 1) return [];
    if (n === 2) return ['glaze_ring'];
    // Shift 3 Mini-Boss now features real stage Butter Bumpers + 2 Frozen Treats!
    if (n === 3) return ['bumpers'];
    // Shift 4 introduces random stage obstacles (divider / bumpers / fast_fresh) + Midnight Party!
    if (n === 4) {
      const pool = ['divider', 'bumpers', 'fast_fresh'];
      return [pool[Math.floor(Math.random() * pool.length)]];
    }
    if (n === 5) {
      const pool = ['glaze_ring', 'divider', 'bumpers'];
      return [pool[Math.floor(Math.random() * pool.length)]];
    }
    const pair = ENDLESS_HAZARD_PAIRS[(n - 6) % ENDLESS_HAZARD_PAIRS.length];
    return [...pair];
  }

  function syncObstaclesForShift() {
    const prevRing = (gameState.obstacles || []).find((o) => o && o.type === 'glaze_ring') || null;
    const obs = [];
    const hasStageGlaze = app.hasShiftHazard('glaze_ring');
    const hasStageDivider = app.hasShiftHazard('divider');
    const hasStageBumpers = app.hasShiftHazard('bumpers');
    const hasRelicBumpers = app.hasRelic('rel_bumpers');

    if (hasStageGlaze) {
      obs.push({
        id: 'glaze_ring',
        type: 'glaze_ring',
        x: prevRing ? prevRing.x : 220,
        y: 185,
        rx: 38,
        ry: 13,
        centerX: 220,
        patrolAmp: 125,
        speed: 0.95,
        phase: prevRing ? prevRing.phase : 0,
        hitFlash: prevRing ? prevRing.hitFlash : 0
      });
    }

    if (hasStageDivider) {
      obs.push({
        id: 'divider_center',
        type: 'divider',
        x: 220,
        w: 14,
        halfW: 7,
        h: 155,
        topY: 337,
        capY: 344,
        bottomY: 492,
        friction: 0.32,
        restitution: 0.28,
        hitFlash: 0
      });
    }

    if (hasStageBumpers && hasRelicBumpers) {
      const hasCenterClear = !hasStageGlaze || !hasStageDivider;
      const primaryTip = hasCenterClear ? 65 : 85;
      obs.push(
        { id: 'bumper_L', type: 'bumper', source: 'synergy', x: 102, y: 265, r: 16, restitution: 1.24, tipBase: primaryTip, grantsCrit: true, hitFlash: 0 },
        { id: 'bumper_R', type: 'bumper', source: 'synergy', x: 338, y: 265, r: 16, restitution: 1.24, tipBase: primaryTip, grantsCrit: true, hitFlash: 0 }
      );
      if (!hasStageGlaze) {
        obs.push({ id: 'bumper_C', type: 'bumper', source: 'synergy', x: 220, y: 224, r: 14, restitution: 1.22, tipBase: 65, grantsCrit: true, hitFlash: 0 });
      } else if (!hasStageDivider) {
        obs.push({ id: 'bumper_C', type: 'bumper', source: 'synergy', x: 220, y: 304, r: 14, restitution: 1.22, tipBase: 65, grantsCrit: true, hitFlash: 0 });
      }
    } else if (hasStageBumpers) {
      obs.push(
        { id: 'bumper_L', type: 'bumper', source: 'stage', x: 102, y: 265, r: 15, restitution: 1.15, tipBase: 40, grantsCrit: false, hitFlash: 0 },
        { id: 'bumper_R', type: 'bumper', source: 'stage', x: 338, y: 265, r: 15, restitution: 1.15, tipBase: 40, grantsCrit: false, hitFlash: 0 }
      );
    } else if (hasRelicBumpers) {
      obs.push(
        { id: 'bumper_L', type: 'bumper', source: 'relic', x: 102, y: 265, r: 15, restitution: 1.15, tipBase: 45, grantsCrit: true, hitFlash: 0 },
        { id: 'bumper_R', type: 'bumper', source: 'relic', x: 338, y: 265, r: 15, restitution: 1.15, tipBase: 45, grantsCrit: true, hitFlash: 0 }
      );
    }

    gameState.obstacles = obs;
  }

  /**
   * Persistent Hot-Oven Jar: carries ALL existing non-yarn desserts (up to 12) across shifts
   * so spatial layout and serving-to-excavate genuinely matter from Shift 1 through Shift 5!
   */
  function computeCarryOverPlan() {
    const desserts = gameState.entities
      .filter((e) => !e.merged && !e.isYarnBall && !(e.frozenHp > 0))
      .sort((a, b) => b.y - a.y || b.tier - a.tier);
    const carried = desserts.slice(0, 12).map((e) => ({
      tier: e.tier,
      isGolden: !!e.isGolden,
      isWildcard: !!e.isWildcard,
      agedStacks: e.agedStacks || 0,
      x: +e.x.toFixed(1),
      y: +e.y.toFixed(1)
    }));
    const leftoverLow = desserts.slice(12).filter((e) => e.tier <= 4).length;
    return { carried, cleanTip: leftoverLow };
  }

  function rollPrepShopOffers() {
    const ownedSet = new Set(gameState.relics || []);
    const availRelics = RELICS.filter((r) => !ownedSet.has(r.id));
    // Encourage archetype variety across the 3 offers
    const shuffled = [...availRelics].sort(() => Math.random() - 0.5);
    const relicOffers = [];
    const usedArch = new Set();
    for (const r of shuffled) {
      if (relicOffers.length >= 3) break;
      if (!usedArch.has(r.archetype) || relicOffers.length + (shuffled.length - shuffled.indexOf(r)) <= 3) {
        usedArch.add(r.archetype);
        relicOffers.push({ id: r.id, bought: false });
      }
    }
    for (const r of shuffled) {
      if (relicOffers.length >= 3) break;
      if (!relicOffers.some((o) => o.id === r.id)) {
        relicOffers.push({ id: r.id, bought: false });
      }
    }

    const availMods = DECK_MODS.filter((m) => app.getDeckModCount(m.id) < m.maxBuy);
    const modPool = [...availMods].sort(() => Math.random() - 0.5);
    const modOffers = modPool.slice(0, 2).map((m) => ({ id: m.id, bought: false }));
    return { relicOffers, modOffers };
  }

  function openPrepShop(shiftSummary) {
    const { relicOffers, modOffers } = rollPrepShopOffers();
    const nextShiftNum = gameState.shift + 1;
    const nextHazards = pickHazardsForShift(nextShiftNum);
    const isFirstPrep = !saveData.seenTips || !saveData.seenTips.prep_shop;
    if (isFirstPrep) {
      if (!saveData.seenTips) saveData.seenTips = {};
      saveData.seenTips.prep_shop = true;
      persistSaveData();
    }
    const lunaFreeReroll = saveData.selectedPatron === 'luna';
    gameState.prepShop = {
      shiftSummary,
      relicOffers,
      modOffers,
      rerollCost: lunaFreeReroll ? 0 : 10,
      nextShiftNum,
      nextHazards,
      showBeginnerTip: isFirstPrep
    };
    app.toastCurrent = null;
    app.toastQueue = [];
    app.minorToast = null;
    app.syncToastLegacyFields();
    app.openModal('prep_shop');
    saveActiveRunCheckpoint({ syncCloud: true });
  }

  function completeCurrentShift(wasEarly = false) {
    if (!gameState.running || gameState.over || gameState.mode !== 'chef') return;
    if (app.activeModal === 'prep_shop' || app.activeModal === 'shift_victory') return;

    cancelToolMode();
    gameState.paused = true;
    gameState.shiftResolveDelay = 0;
    audio.playShiftClear();
    platform.vibrateShort('medium');

    const cfg = getShiftConfig(gameState.shift);
    const carryPlan = computeCarryOverPlan();
    const greedBonus = app.getArchetypeCount('greed') >= 2 ? 12 : 0;
    const baseCoins = cfg.baseCoins + greedBonus;
    const stepInterest = gameState.stepsLeft * 4;
    const cleanTip = carryPlan.cleanTip;
    const totalCoins = baseCoins + stepInterest + cleanTip;
    addCoins(totalCoins);

    gameState.shiftsClearedThisRun++;
    saveData.lifetimeStats.shiftsClearedTotal = (saveData.lifetimeStats.shiftsClearedTotal || 0) + 1;
    saveData.lifetimeStats.bestShiftReached = Math.max(saveData.lifetimeStats.bestShiftReached || 0, gameState.shift);
    if (gameState.shift === 5) {
      saveData.lifetimeStats.fiveShiftClears = (saveData.lifetimeStats.fiveShiftClears || 0) + 1;
    }
    persistSaveData();

    const shiftSummary = {
      shift: gameState.shift,
      shiftName: cfg.name,
      wasEarly,
      revenue: gameState.shiftRevenue,
      target: gameState.shiftTarget,
      stepsSaved: gameState.stepsLeft,
      baseCoins,
      greedBonus,
      stepInterest,
      cleanTip,
      totalCoins,
      carried: carryPlan.carried
    };

    if (gameState.shift === 5) {
      const preview = computePermanentStardustSettlement(true);
      gameState.victoryOffer = {
        shiftSummary,
        stardustPreview: preview.finalEarned
      };
      app.openModal('shift_victory');
      saveActiveRunCheckpoint({ syncCloud: true });
      return;
    }

    openPrepShop(shiftSummary);
  }

  function closeShiftEarlyFn() {
    if (!gameState.running || gameState.over || gameState.mode !== 'chef') return;
    if (!gameState.shiftClearedFlag || app.activeModal) return;
    completeCurrentShift(true);
  }

  function buyRelicFn(relicId) {
    const shop = gameState.prepShop;
    if (!shop) return;
    const offer = shop.relicOffers.find((o) => o.id === relicId && !o.bought);
    const def = RELICS.find((r) => r.id === relicId);
    if (!offer || !def) return;
    if (gameState.relics.length >= MAX_RELIC_SLOTS) {
      app.showToast(`秘方栏已满 (${MAX_RELIC_SLOTS}/${MAX_RELIC_SLOTS})，点槽位可卖出`, { icon: 'icon_warn', tone: 'warn' });
      return;
    }
    if (gameState.coins < def.price) {
      app.showToast(`秘方币不足（需 ${def.price}）`, { icon: 'icon_coin', tone: 'warn' });
      return;
    }
    audio.ensureCtx();
    audio.playCoinSpend();
    platform.vibrateShort('light');
    gameState.coins -= def.price;
    gameState.relics.push(def.id);
    offer.bought = true;
    if (def.id === 'rel_bumpers') syncObstaclesForShift();

    const archCnt = app.getArchetypeCount(def.archetype);
    const synDef = ARCHETYPE_SYNERGIES[def.archetype];
    if (synDef && (archCnt === 2 || archCnt === 3)) {
      audio.playBlessingReady();
      app.showToast(
        `${synDef.tag} ${archCnt}件共鸣 · ${archCnt === 3 ? synDef.short3 : synDef.short2}`,
        { level: 'major', icon: def.icon, tone: 'success' }
      );
    } else {
      app.showToast(`已装备 · ${def.name}`, { icon: def.icon, tone: 'success' });
    }
    saveActiveRunCheckpoint();
  }

  function sellRelicFn(relicId) {
    const idx = gameState.relics.indexOf(relicId);
    if (idx === -1) return;
    const def = RELICS.find((r) => r.id === relicId);
    if (!def) return;
    const refund = Math.floor(def.price * 0.5);
    audio.ensureCtx();
    audio.playCoinSpend();
    gameState.relics.splice(idx, 1);
    gameState.coins += refund;
    if (relicId === 'rel_bumpers') syncObstaclesForShift();
    app.showToast(`卖出 ${def.name} · +${refund}币`, { icon: 'icon_coin', tone: 'info' });
    saveActiveRunCheckpoint();
  }

  function buyDeckModFn(modId) {
    const shop = gameState.prepShop;
    if (!shop) return;
    const offer = shop.modOffers.find((o) => o.id === modId && !o.bought);
    const def = DECK_MODS.find((m) => m.id === modId);
    if (!offer || !def) return;
    if (app.getDeckModCount(modId) >= def.maxBuy) {
      app.showToast('已达购买上限', { icon: 'icon_warn', tone: 'warn' });
      return;
    }
    if (gameState.coins < def.price) {
      app.showToast(`秘方币不足（需 ${def.price}）`, { icon: 'icon_coin', tone: 'warn' });
      return;
    }
    audio.ensureCtx();
    audio.playCoinSpend();
    platform.vibrateShort('light');
    gameState.coins -= def.price;
    gameState.deckMods[modId] = app.getDeckModCount(modId) + 1;
    offer.bought = true;

    if (modId === 'mod_rainbow') {
      gameState.dropsUntilRainbow = Math.min(gameState.dropsUntilRainbow, getRainbowPityBase());
      grantNextRainbow('星露浓缩瓶');
    } else if (modId === 'mod_steps') {
      gameState.nextShiftBonusSteps += 3;
    } else if (modId === 'mod_tool') {
      gameState.tools.shake += 1;
      gameState.tools.spoon += 1;
    }
    app.showToast(`改造成功 · ${def.name}`, { icon: def.icon, tone: 'success' });
    saveActiveRunCheckpoint();
  }

  function rerollPrepShopFn() {
    const shop = gameState.prepShop;
    if (!shop) return;
    const cost = shop.rerollCost;
    if (gameState.coins < cost) {
      app.showToast(`秘方币不足（刷新需 ${cost}）`, { icon: 'icon_coin', tone: 'warn' });
      return;
    }
    audio.ensureCtx();
    audio.playTilt();
    gameState.coins -= cost;
    shop.rerollCost += 5;
    const { relicOffers, modOffers } = rollPrepShopOffers();
    shop.relicOffers = relicOffers;
    shop.modOffers = modOffers;
    app.showToast(cost === 0 ? '眠眠星兔免单刷新' : '货架已刷新', {
      icon: cost === 0 ? 'icon_moon' : 'icon_restart',
      tone: 'info'
    });
    saveActiveRunCheckpoint();
  }

  function beginShift(shiftNum, isCarryOver = false, carriedOverride = null, forcedHazards = null, opts = {}) {
    const cfg = getShiftConfig(shiftNum);
    const carried = carriedOverride || (isCarryOver ? computeCarryOverPlan().carried : []);

    gameState.shift = cfg.shift;
    gameState.shiftName = cfg.name;
    gameState.shiftBadge = cfg.badge;
    gameState.shiftModifier = cfg.modifier || null;
    gameState.shiftHazards = pickHazardsForShift(cfg.shift, forcedHazards);
    gameState.shiftRevenue = 0;
    gameState.displayShiftRevenue = 0;
    gameState.shiftTarget = cfg.target;
    const bonusSteps = gameState.nextShiftBonusSteps || 0;
    gameState.nextShiftBonusSteps = 0;
    gameState.stepsMax = cfg.steps + bonusSteps;
    gameState.stepsLeft = gameState.stepsMax;
    gameState.shiftStepsUsed = 0;
    gameState.shiftStepRefunds = 0;
    gameState.freeSkipsLeft = 1;
    gameState.mugiBankCoinHits = 0;
    gameState.mikanFirstServeUsed = false;
    gameState.shiftClearedFlag = false;
    gameState.shiftResolveDelay = 0;
    gameState.dangerDuration = 0;
    gameState.activeEvent = null;
    gameState.serveCascadeTimer = 0;
    gameState.serveCascadeMerges = 0;
    gameState.cascadeStaleRefundPending = false;
    gameState.antigravTimer = 0;
    gameState.globalResonanceTimer = 0;

    // Rebuild jar board with Persistent Jar Carry-Over (up to 12 treats) + stage mechanics!
    gameState.entities = [];
    gameState.flyingServes = [];
    gameState.shockwaves = [];
    gameState.popups = [];
    syncObstaclesForShift();

    let frozenSeeded = 0;
    if (!isCarryOver || cfg.shift === 1) {
      spawnStarterBoard('chef');
    } else {
      const extraSpecs =
        cfg.shift === 2
          ? [{ tier: 2 }, { tier: 3 }]
          : cfg.shift === 3
          ? [{ tier: 3, frozenHp: 1 }, { tier: 4, frozenHp: 1 }, { tier: 2 }]
          : cfg.shift === 4
          ? [{ tier: 4 }, { tier: 2 }]
          : [{ tier: 4, frozenHp: 1 }, { tier: 5, frozenHp: 1 }, { tier: 3 }];
      frozenSeeded = extraSpecs.filter((s) => s.frozenHp > 0).length;

      const frozenExtras = extraSpecs.filter((s) => s.frozenHp > 0);
      const normalExtras =
        carried.length < 2
          ? extraSpecs.filter(
              (s) => !(s.frozenHp > 0) && !carried.some((c) => c.tier === s.tier && !c.isWildcard)
            )
          : [];

      const hasDivider = app.hasShiftHazard('divider');
      if (hasDivider) {
        // Divider-safe split-bay placement: strictly keep every treat inside Left [30,213] or Right [227,410]
        const leftLaneX = [76, 168, 122];
        const rightLaneX = [364, 272, 318];
        let leftIdx = 0;
        let rightIdx = 0;
        let leftTopY = JAR.floorY - 6;
        let rightTopY = JAR.floorY - 6;
        const placeInChamber = (tier, chamber, metaOpts) => {
          const r = metaOpts && metaOpts.wildcard ? WILDCARD_RADIUS : TIERS[tier - 1].radius;
          let cx;
          let cy;
          if (chamber === 'left') {
            const rawX = leftLaneX[leftIdx % leftLaneX.length];
            leftIdx++;
            cx = Math.max(JAR.left + r + 5, Math.min(213 - r - 5, rawX));
            cy = Math.max(JAR.dangerY + r + 18, leftTopY - r * 1.15 - 2);
            leftTopY = Math.min(leftTopY, cy - r * 0.65);
          } else {
            const rawX = rightLaneX[rightIdx % rightLaneX.length];
            rightIdx++;
            cx = Math.max(227 + r + 5, Math.min(JAR.right - r - 5, rawX));
            cy = Math.max(JAR.dangerY + r + 18, rightTopY - r * 1.15 - 2);
            rightTopY = Math.min(rightTopY, cy - r * 0.65);
          }
          const ent = createEntity(tier, cx, cy, 0, 0, false, 0, 0, {
            preSettled: true,
            preSettledAge: 0.35,
            ...metaOpts
          });
          if (metaOpts && metaOpts.agedStacks) ent.agedStacks = metaOpts.agedStacks;
        };

        for (let ci = 0; ci < carried.length; ci++) {
          const c = carried[ci];
          const prefChamber = typeof c.x === 'number' ? (c.x < 220 ? 'left' : 'right') : ci % 2 === 0 ? 'left' : 'right';
          placeInChamber(c.tier, prefChamber, {
            golden: !!c.isGolden,
            wildcard: !!c.isWildcard,
            agedStacks: c.agedStacks || 0
          });
        }
        for (let fi = 0; fi < frozenExtras.length; fi++) {
          const fs = frozenExtras[fi];
          placeInChamber(fs.tier, fi % 2 === 0 ? 'left' : 'right', { frozenHp: fs.frozenHp });
        }
        for (let ni = 0; ni < normalExtras.length; ni++) {
          const ns = normalExtras[ni];
          placeInChamber(ns.tier, leftTopY >= rightTopY ? 'left' : 'right', {});
        }
      } else {
        const slotsX = [108, 332, 178, 262, 220, 142, 298];
        let slotIdx = 0;
        for (const c of carried) {
          const r = c.isWildcard ? WILDCARD_RADIUS : TIERS[c.tier - 1].radius;
          const rawX = typeof c.x === 'number' ? c.x : slotsX[slotIdx % slotsX.length];
          const rawY = typeof c.y === 'number' ? c.y : JAR.floorY - r - 8;
          slotIdx++;
          const cx = Math.max(JAR.left + r + 6, Math.min(JAR.right - r - 6, rawX));
          const cy = Math.max(JAR.dangerY + r + 20, Math.min(JAR.floorY - r - 6, rawY));
          const ent = createEntity(c.tier, cx, cy, 0, 0, false, 0, 0, {
            preSettled: true,
            preSettledAge: 0.35,
            golden: !!c.isGolden,
            wildcard: !!c.isWildcard
          });
          if (c.agedStacks) ent.agedStacks = c.agedStacks;
        }
        const combinedExtras = [...frozenExtras, ...normalExtras];
        for (const spec of combinedExtras) {
          const cx = slotsX[slotIdx % slotsX.length];
          slotIdx++;
          const r = TIERS[spec.tier - 1].radius;
          const baseOffset = spec.frozenHp > 0 ? 78 : 96;
          const cy = Math.max(JAR.dangerY + r + 22, JAR.floorY - r - baseOffset - (slotIdx % 4) * 8);
          createEntity(spec.tier, cx, cy, 0, 0, false, 0, 0, {
            preSettled: true,
            preSettledAge: 0.35,
            frozenHp: spec.frozenHp || 0
          });
        }
      }

      // Shift 4 Midnight Cat Party: starts with a mischievous Yarn Ball (+¥750 & +10 coins)
      if (cfg.modifier === 'party_events') {
        const yarnX = hasDivider ? 156 : 220;
        createYarnBallEntity(yarnX, JAR.neckY + 56);
        gameState.activeEvent = { kind: 'yarn', timer: 0, maxTimer: 0 };
      }
    }

    initOrders();
    gameState.prepShop = null;
    gameState.victoryOffer = null;
    app.activeModal = null;
    gameState.paused = false;
    app.syncAudioMood();

    const activePatron = app.activePatron;
    if (cfg.shift > 1) {
      const hazDefs = app.getShiftHazardDefs();
      const hazBadges = hazDefs.map((h) => h.badge);
      if (frozenSeeded > 0) hazBadges.push(`冰封×${frozenSeeded}`);
      if (cfg.modifier === 'grand_prix') hazBadges.push('评委急单');
      const hazSummary = hazBadges.length > 0 ? ` · ${hazBadges.join(' · ')}` : '';
      const shiftIcon =
        hazDefs.length > 0
          ? hazDefs[0].icon
          : cfg.modifier === 'grand_prix'
          ? 'icon_judge'
          : cfg.modifier === 'party_events'
          ? 'yarn_ball'
          : frozenSeeded > 0
          ? 'icon_frost'
          : 'icon_moon';
      showComboBanner(
        `第 ${cfg.shift} 幕 · ${cfg.name}`,
        `目标 ¥${cfg.target} · ${gameState.stepsMax}步${hazSummary}`,
        '#ffe570',
        shiftIcon,
        3
      );
      const speechNote = hazDefs.length > 0
        ? `本幕机关：${hazDefs.map((h) => h.name).join(' + ')}！${cfg.desc}`
        : cfg.desc;
      setPatronSpeech(activePatron, speechNote, 5.2);
    }

    // Contextual first-time mechanic spotlight tips (Glaze Ring & Frozen Treats)!
    const skipTips = !!(opts && opts.skipTips);
    if (!skipTips && !app.isLobbyOpen && gameState.running && !gameState.over) {
      if (app.hasShiftHazard('glaze_ring') && (!saveData.seenTips || !saveData.seenTips.glaze_ring)) {
        app.openModeGuide('tip_glaze_ring', 0);
      } else if (frozenSeeded > 0 && (!saveData.seenTips || !saveData.seenTips.frozen)) {
        app.openModeGuide('tip_frozen', 0);
      }
    }
    if (cfg.shift > 1) {
      saveActiveRunCheckpoint();
    }
  }

  function proceedNextShiftFn() {
    const shop = gameState.prepShop;
    if (!shop) return;
    const carried = shop.shiftSummary ? shop.shiftSummary.carried : null;
    const nextHazards = Array.isArray(shop.nextHazards) ? shop.nextHazards : null;
    audio.ensureCtx();
    audio.playStartCafe();
    beginShift(shop.nextShiftNum, true, carried, nextHazards);
  }

  function enterEndlessOvertimeFn() {
    const offer = gameState.victoryOffer;
    if (!offer) return;
    gameState.victoryOffer = null;
    openPrepShop(offer.shiftSummary);
    app.showToast('无尽午夜加时开启', { level: 'major', icon: 'mode_rush', tone: 'event' });
  }

  function finishVictoryRunFn() {
    gameState.victoryOffer = null;
    triggerGameOver('victory');
  }

  function addFeverEnergy(amount) {
    if (gameState.feverTimer > 0) return;
    const rushMult = gameState.mode === 'rush' ? 1.85 : 1.0;
    const meteorMult = gameState.activeEvent && gameState.activeEvent.kind === 'meteor' ? 1.25 : 1.0;
    const boosted = amount * rushMult * meteorMult;
    gameState.feverEnergy = Math.min(100, gameState.feverEnergy + boosted);
    if (gameState.feverEnergy >= 100) {
      const dur = 10.0;
      gameState.feverMaxDuration = dur;
      gameState.feverTimer = dur;
      gameState.feverBonusUsed = 0;
      gameState.feverEnergy = 100;
      gameState.jarFlash = 0.75;
      gameState.screenShake = Math.max(gameState.screenShake, 5);
      audio.playFeverStart();
      audio.setFeverMode(true);
      platform.vibrateShort('medium');
      setPatronSpeech(app.activePatron, '星光狂热开启！全罐磁吸加速连合！', 4.8);
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffdf6b', 28);
      spawnShockwave(JAR.canvasW / 2, 260, 190, '#ffd85d', 4.5);
      showComboBanner('星光磁吸狂热', `${dur.toFixed(0)}秒磁吸连合 · 最高 3×`, '#ffe36e', 'icon_flame', 2);
    }
  }

  function createYarnBallEntity(x, y) {
    const shapeDef = PHYSICS_SHAPES.event_yarn_ball || getShapeDef(1);
    const eqR = YARN_BALL_RADIUS;
    const entity = {
      id: gameState.nextEntityId++,
      tier: 0,
      isWildcard: false,
      isGolden: false,
      isYarnBall: true,
      yarnHp: 2,
      yarnMaxHp: 2,
      yarnHitFlash: 0,
      r: eqR,
      mass: eqR * eqR * 1.1,
      x,
      y,
      vx: (Math.random() - 0.5) * 95,
      vy: 85,
      angle: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 5,
      squishAmt: 0.12,
      squishVel: 0,
      squishAngle: Math.PI * 0.5,
      age: 0,
      dangerTime: 0,
      inContact: false,
      merged: false,
      creditedToOrder: false,
      trail: [],
      soloCooldown: 99,
      interactCooldown: 99,
      anim: null
    };
    Physics.configureBodyShape(entity, shapeDef, eqR, { friction: 0.34, restitution: 0.42 });
    Physics.clampBodyInsideJarPositional(entity, JAR, gameState.obstacles);
    gameState.entities.push(entity);
    return entity;
  }

  function hasYarnBallInJar() {
    return gameState.entities.some((e) => e.isYarnBall && !e.merged);
  }

  function isJarNearDanger() {
    return gameState.entities.some((e) => e.age > 0.6 && e.aabbMinY < JAR.dangerY + 40);
  }

  function triggerShopEvent(forcedKind = null) {
    if (!gameState.running || gameState.over) return null;
    if (!forcedKind && gameState.mode === 'zen') return null;
    // Consolidated random event: ONLY Meteor Wish ('meteor') fires organically (forcedKind still supported for Act 4 / debug)
    const kind = forcedKind || 'meteor';
    gameState.lastEventKind = kind;
    audio.playEventStart(kind);
    const activePatron = app.activePatron;

    if (kind === 'meteor') {
      gameState.activeEvent = { kind: 'meteor', timer: 12.0, maxTimer: 12.0 };
      let remaining = 3;
      if (!gameState.curMeta.wildcard && !gameState.curMeta.golden && remaining > 0) {
        if (Math.random() < 0.75) gameState.curMeta.golden = true;
        remaining--;
      }
      if (!gameState.nextMeta.wildcard && !gameState.nextMeta.golden && remaining > 0) {
        if (Math.random() < 0.75) gameState.nextMeta.golden = true;
        remaining--;
      }
      gameState.meteorGoldenLeft = remaining;
      gameState.shootingStars.push(
        { x: JAR.right - 20, y: JAR.neckY + 26, vx: -360, vy: 135, life: 0.95, maxLife: 0.95 },
        { x: JAR.right - 70, y: JAR.neckY + 58, vx: -320, vy: 125, life: 1.15, maxLife: 1.15 }
      );
      showComboBanner('流星镀金夜', '后续手牌 75% 镀金 · 狂热充能 +25%', '#ffe888', 'icon_stardust', 2);
      setPatronSpeech(activePatron, '流星把面糊镀上金糖霜啦，快许愿！', 4.4);
    } else if (kind === 'yarn') {
      gameState.activeEvent = { kind: 'yarn', timer: 0, maxTimer: 0 };
      const sx = 120 + Math.random() * 200;
      createYarnBallEntity(sx, JAR.neckY + 24);
      spawnSparkleBurst(sx, JAR.neckY + 28, '#ff9cb8', 18);
      showComboBanner('猫咪捣蛋时间', '附近合成2次或摇罐震碎爆赏', '#ffa8c4', 'yarn_ball', 2);
      setPatronSpeech(activePatron, '毛线球滚进去啦！在旁边合两次震碎它！', 4.6);
    } else {
      gameState.activeEvent = { kind: 'chime', timer: 14.0, maxTimer: 14.0 };
      gameState.jarFlash = Math.max(gameState.jarFlash, 0.5);
      spawnSparkleBurst(JAR.canvasW / 2, JAR.neckY + 30, '#ffe072', 20);
      showComboBanner('黄金烘焙钟', '14秒连击窗延长 +0.5s', '#ffe26a', 'serve_bell', 2);
    }
    return kind;
  }

  function damageNearbyYarnBalls(mx, my, range = 95, allJar = false) {
    const yarnBalls = gameState.entities.filter((e) => e.isYarnBall && !e.merged);
    if (yarnBalls.length === 0) return 0;

    let brokenCount = 0;
    const removedIds = new Set();
    for (const yb of yarnBalls) {
      const dist = allJar ? 0 : Math.hypot(yb.x - mx, yb.y - my);
      if (!allJar && dist > range + yb.r * 0.5) continue;

      yb.yarnHp--;
      yb.yarnHitFlash = 0.45;
      yb.vy -= 110;
      yb.vx += (yb.x >= mx ? 1 : -1) * 75;
      yb.vr += (Math.random() - 0.5) * 9;
      applyDirectionalSquish(yb, 0, -1, 260);
      spawnSparkleBurst(yb.x, yb.y, '#ff9ec2', 12);

      if (yb.yarnHp > 0) {
        audio.playYarnHit();
        spawnPopup(yb.x, yb.y - 24, `脆度 ${yb.yarnHp}/2`, '#ffb6d0', 14);
      } else {
        removedIds.add(yb.id);
        brokenCount++;
        audio.playYarnBreak();
        platform.vibrateShort('medium');

        const isShift4Party = gameState.mode === 'chef' && gameState.shiftModifier === 'party_events';
        const baseYarnPts = isShift4Party ? 750 : 180;
        const pts = Math.round(baseYarnPts * app.getFeverMultiplier() * app.getGlobalRevenueMult());
        const dust = addRunStardust(18);
        const coinBonus = isShift4Party ? addCoins(10) : 0;
        addScore(pts);
        addFeverEnergy(25);
        gameState.yarnBrokenThisRun++;
        saveData.lifetimeStats.yarnBroken = (saveData.lifetimeStats.yarnBroken || 0) + 1;
        persistSaveData();

        spawnSparkleBurst(yb.x, yb.y, '#ffb3cf', 22);
        spawnSparkleBurst(yb.x, yb.y, '#ffe47a', 20);
        spawnShockwave(yb.x, yb.y, 118, '#ff9ec2', 4.2);
        spawnShockwave(yb.x, yb.y, 76, '#ffe47a', 2.8);
        gameState.screenShake = Math.max(gameState.screenShake, 5.2);
        gameState.jarFlash = Math.max(gameState.jarFlash, 0.5);
        const coinTxt = coinBonus > 0 ? ` +${coinBonus}币` : '';
        spawnPopup(yb.x, yb.y - 18, `爆裂 +${pts}${coinTxt}`, '#ffe57e', 18);
        showComboBanner('毛线球爆裂', `+${pts} · +${dust}星露${coinTxt} · +25%狂热`, '#ffb3d6', 'yarn_ball', 2);
      }
    }

    if (removedIds.size > 0) {
      gameState.entities = gameState.entities.filter((e) => !removedIds.has(e.id));
      if (gameState.activeEvent && gameState.activeEvent.kind === 'yarn' && !hasYarnBallInJar()) {
        gameState.activeEvent = null;
      }
    }
    return brokenCount;
  }

  function spawnIceShatterParticles(x, y, r = 30) {
    const colors = ['#e8fcff', '#a4e8ff', '#62c4f8', '#ffffff'];
    for (let i = 0; i < 18; i++) {
      if (gameState.particles.length >= 160) break;
      const ang = (Math.PI * 2 * i) / 18 + (Math.random() - 0.5) * 0.35;
      const spd = 90 + Math.random() * 170;
      gameState.particles.push({
        x: x + Math.cos(ang) * r * 0.45,
        y: y + Math.sin(ang) * r * 0.45,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 55,
        size: 3.6 + Math.random() * 3.8,
        color: colors[i % colors.length],
        life: 0.46 + Math.random() * 0.32,
        maxLife: 0.78,
        star: false,
        crumb: false,
        shard: true,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 14
      });
    }
    spawnSparkleBurst(x, y, '#b8f2ff', 6);
  }

  function thawNearbyFrozenEntities(mx, my, range = 110, allJar = false) {
    let thawedCount = 0;
    for (let i = 0; i < gameState.entities.length; i++) {
      const e = gameState.entities[i];
      if (!e || e.merged || !(e.frozenHp > 0)) continue;
      if (!allJar && Math.hypot(e.x - mx, e.y - my) > range) continue;
      e.frozenHp = Math.max(0, e.frozenHp - 1);
      if (e.frozenHp === 0) {
        thawedCount++;
        e.frozenFlash = 0.45;
        e.vy = Math.min(e.vy, -85);
        e.vx += (Math.random() - 0.5) * 90;
        e.vr += (Math.random() - 0.5) * 4;
        gameState.iceShatteredThisRun = (gameState.iceShatteredThisRun || 0) + 1;
        audio.playIceShatter();
        platform.vibrateShort('light');
        const pts = Math.round(120 * app.getFeverMultiplier() * app.getGlobalRevenueMult());
        addScore(pts);
        spawnIceShatterParticles(e.x, e.y, e.r);
        spawnShockwave(e.x, e.y, e.r * 2.2 + 24, '#a8ecff', 3.6);
        spawnPopup(e.x, e.y - e.r * 0.55, `破冰 +¥${pts}`, '#aef2ff', 16.5);
        notifyTreatSynthesized(e.tier, e);
      }
    }
    return thawedCount;
  }

  function triggerRushEmergencyGust() {
    if (gameState.rushGustCooldown > 0 || gameState.entities.length === 0) return;
    const sorted = [...gameState.entities].sort((a, b) => a.aabbMinY - b.aabbMinY);
    const clearCount = Math.min(sorted.length, sorted.length >= 10 ? 4 : 3);
    const toRemove = sorted.slice(0, clearCount);
    const removeIds = new Set(toRemove.map((e) => e.id));

    for (const e of toRemove) {
      spawnSparkleBurst(e.x, e.y, '#9be8ff', 14);
      spawnShockwave(e.x, e.y, 58, '#a6ecff', 3);
    }
    gameState.entities = gameState.entities.filter((e) => !removeIds.has(e.id));
    if (gameState.rushTimer > 1.0) {
      gameState.rushTimer = Math.max(1.0, gameState.rushTimer - 5.0);
    }
    gameState.rushGustCooldown = 2.5;
    gameState.dangerDuration = 0;
    gameState.screenShake = Math.max(gameState.screenShake, 6);
    gameState.jarFlash = Math.max(gameState.jarFlash, 0.65);

    if (gameState.activeEvent && gameState.activeEvent.kind === 'yarn' && !hasYarnBallInJar()) {
      gameState.activeEvent = null;
    }

    audio.playWindGust();
    platform.vibrateShort('medium');
    showComboBanner('星风吹散', `清顶 ${clearCount} 颗 · -5.0s`, '#ff9b82', 'icon_wind', 2);
  }

  // Tool & Chef Signature Skill Actions
  function armOrUseToolFn(key) {
    if (!gameState.running || gameState.over || gameState.paused) return;
    audio.ensureCtx();

    if (gameState.activeSkillMode) {
      gameState.activeSkillMode = null;
      gameState.swapFirstEntityId = null;
    }

    if (gameState.activeToolMode === key) {
      cancelToolMode();
      return;
    }

    if (gameState.tools[key] <= 0) {
      const cost = gameState.toolCosts[key];
      if (gameState.stardust < cost) {
        app.showToast(`星露不足（需 ${cost}）`, { icon: 'icon_stardust', tone: 'warn' });
        return;
      }
      gameState.stardust -= cost;
      gameState.tools[key] = 1;
      app.showToast(`-${cost} 星露补充道具`, { icon: 'icon_stardust', tone: 'info' });
    }

    if (key === 'shake') {
      gameState.tools.shake--;
      gameState.jarShakeAmp = 1.0;
      audio.playTool('shake');
      platform.vibrateShort('light');
      for (const e of gameState.entities) {
        e.vy -= 175 + Math.random() * 145;
        e.vx += (Math.random() - 0.5) * 280;
        e.vr += (Math.random() - 0.5) * 8;
      }
      spawnSparkleBurst(JAR.canvasW / 2, 320, '#ffd85d', 24);
      damageNearbyYarnBalls(JAR.canvasW / 2, JAR.canvasH / 2, 0, true);
      const thawed = thawNearbyFrozenEntities(JAR.canvasW / 2, JAR.canvasH / 2, 0, true);
      app.showToast(
        thawed > 0 ? `震碎 ${thawed} 颗冰霜` : '玻璃罐摇晃起来了',
        { icon: thawed > 0 ? 'icon_frost' : 'tool_shake', tone: thawed > 0 ? 'success' : 'info' }
      );
      return;
    }

    gameState.activeToolMode = key;
  }

  function activateChefSkillFn() {
    if (!gameState.running || gameState.over || gameState.paused) return;
    audio.ensureCtx();

    if (gameState.activeSkillMode) {
      cancelToolMode();
      return;
    }

    const patron = app.activePatron;
    const sk = patron.activeSkill;
    if (gameState.skillEnergy < 100) {
      app.showToast(`${sk.name} 充能 ${Math.floor(gameState.skillEnergy)}% · 出餐加速`, {
        icon: sk.icon,
        tone: 'info'
      });
      return;
    }

    gameState.activeToolMode = null;
    if (sk.id === 'scoop') {
      gameState.activeSkillMode = 'scoop';
      app.showToast('点 1~5 阶甜品捞回罐口', { icon: sk.icon, tone: 'info' });
    } else if (sk.id === 'swap') {
      const swappable = gameState.entities.filter((e) => !e.merged && !e.isYarnBall && !(e.frozenHp > 0));
      if (swappable.length < 2) {
        app.showToast('需至少 2 颗未冰封甜品', { icon: sk.icon, tone: 'warn' });
        return;
      }
      gameState.activeSkillMode = 'swap_1';
      gameState.swapFirstEntityId = null;
      app.showToast('依次点 2 颗甜品互换', { icon: sk.icon, tone: 'info' });
    } else if (sk.id === 'meteor_shot') {
      if (gameState.nextShotMeteor) {
        app.showToast('重锤已装填，发射撞击升阶', { icon: sk.icon, tone: 'info' });
        return;
      }
      gameState.skillEnergy = 0;
      gameState.nextShotMeteor = true;
      audio.playChefSkill('mugi');
      platform.vibrateShort('medium');
      spawnSparkleBurst(gameState.dropX, JAR.dropY + 12, '#ff8e52', 24);
      showComboBanner('元气重锤装填', '撞击首颗甜品直接升阶 + 震波', '#ff9e66', 'icon_flame', 2);
    }
  }

  function cancelToolMode() {
    gameState.activeToolMode = null;
    gameState.activeSkillMode = null;
    gameState.swapFirstEntityId = null;
    gameState.hoveredEntityId = null;
  }

  function swapHoldPocketFn() {
    if (!gameState.running || gameState.over || gameState.paused || gameState.activeToolMode || gameState.activeSkillMode) return;
    if (!gameState.canHoldThisTurn) {
      app.showToast('发射后再交换暂存', { icon: 'icon_restart', tone: 'warn' });
      return;
    }
    audio.ensureCtx();
    audio.playTool('swap');

    if (gameState.holdTier === null) {
      gameState.holdTier = gameState.curTier;
      gameState.holdMeta = { ...gameState.curMeta };
      gameState.curTier = gameState.nextTier;
      gameState.curMeta = { ...gameState.nextMeta };
      const nextBundle = pickDropBundle(false);
      gameState.nextTier = nextBundle.tier;
      gameState.nextMeta = nextBundle.meta;
    } else {
      const tmpTier = gameState.holdTier;
      const tmpMeta = gameState.holdMeta ? { ...gameState.holdMeta } : { wildcard: false, golden: false };
      gameState.holdTier = gameState.curTier;
      gameState.holdMeta = { ...gameState.curMeta };
      gameState.curTier = tmpTier;
      gameState.curMeta = tmpMeta;
    }
    gameState.canHoldThisTurn = false;
    gameState.heldActionAnim = null;
    gameState.heldActionCooldown = 1.4 + Math.random() * 1.4;
    clampDropX();
  }

  function computeTurretShotFromAngle(rawAngle) {
    const ang = Math.max(-1.14, Math.min(1.14, Number(rawAngle) || 0));
    const bouncyBoost = app.hasRelic('rel_bouncy') ? 1.25 : 1.0;
    const speed = FIXED_TURRET_BASE_SPEED * bouncyBoost;
    return {
      angle: ang,
      power: FIXED_TURRET_POWER,
      speed,
      launchVx: Math.sin(ang) * speed,
      launchVy: Math.cos(ang) * speed,
      isAngled: Math.abs(ang) >= 0.155
    };
  }

  function getAimTotalAngle() {
    return Math.max(-1.14, Math.min(1.14, gameState.aimAngle));
  }

  function getCurrentDropRadius() {
    return gameState.curMeta && gameState.curMeta.wildcard ? WILDCARD_RADIUS : TIERS[gameState.curTier - 1].radius;
  }

  function clampDropXVal() {
    return LAUNCH_X;
  }

  function clampDropX() {
    gameState.dropX = LAUNCH_X;
    gameState.prevDropX = LAUNCH_X;
  }

  function syncIdleAimFromAngle(ang) {
    const shot = computeTurretShotFromAngle(ang);
    gameState.aimAngle = shot.angle;
    gameState.aim.angle = shot.angle;
    gameState.aim.power = shot.power;
    gameState.aim.launchVx = shot.launchVx;
    gameState.aim.launchVy = shot.launchVy;
    return shot;
  }

  function adjustAimAngle(deltaRad) {
    if (!gameState.running || gameState.over || gameState.activeToolMode || gameState.activeSkillMode) return;
    const next = Math.max(-1.14, Math.min(1.14, gameState.aimAngle + deltaRad));
    if (Math.abs(next - gameState.aimAngle) > 1e-4) {
      clampDropX();
      syncIdleAimFromAngle(next);
      audio.ensureCtx();
      audio.playTilt();
    }
  }

  function updateDropPointerX() {
    clampDropX();
  }

  function createEntity(tier, x, y, vx = 0, vy = 0, bornFromMerge = false, initialAngle = 0, initialVr = 0, meta = {}) {
    const isWildcard = !!meta.wildcard;
    const isGolden = !isWildcard && !!meta.golden;
    const def = TIERS[tier - 1];
    const eqR = isWildcard ? WILDCARD_RADIUS : def.radius;
    const shapeDef = isWildcard ? getShapeDef(1) : getShapeDef(tier);
    const mat = isWildcard ? { friction: 0.14, restitution: 0.36, gravityScale: 1.0, massMult: 1.0 } : def.material;

    const entity = {
      id: gameState.nextEntityId++,
      tier,
      isWildcard,
      isGolden,
      frozenHp: !isWildcard ? Math.max(0, Math.floor(meta.frozenHp || 0)) : 0,
      frozenFlash: 0,
      isBankLaunched: !!meta.isBankLaunched,
      isMeteorShot: !!meta.isMeteorShot,
      hitBodyBeforeWall: false,
      lastWallBounceAge: undefined,
      wallBounces: 0,
      agedStacks: 0,
      bumperCrit: false,
      bumperHits: 0,
      bumperRewardCount: 0,
      lastBumperHitAge: -1,
      resonanceTimer: 0,
      spinBoostTimer: 0,
      spinBoostDir: 1,
      crushUsed: false,
      hasCollided: !!(bornFromMerge || meta.preSettled),
      bornFromMerge: !!bornFromMerge,
      r: eqR,
      mass: eqR * eqR,
      x,
      y,
      vx,
      vy,
      angle: initialAngle,
      vr: initialVr,
      squishAmt: bornFromMerge ? 0.25 : 0,
      squishVel: 0,
      squishAngle: bornFromMerge ? Math.PI * 0.5 : 0,
      age: typeof meta.preSettledAge === 'number' ? meta.preSettledAge : meta.preSettled ? 1.0 : 0,
      dangerTime: 0,
      inContact: false,
      merged: false,
      creditedToOrder: false,
      trail: [],
      soloCooldown: 1.5 + Math.random() * 2.6,
      interactCooldown: 1.2 + Math.random() * 2.3,
      anim: null
    };
    Physics.configureBodyShape(entity, shapeDef, eqR, mat);
    if (bornFromMerge || meta.preSettled) {
      Physics.clampBodyInsideJarPositional(entity, JAR, gameState.obstacles);
    }
    gameState.entities.push(entity);
    if (!isWildcard) unlockTier(tier);
    return entity;
  }

  function dropCurrentTreat(launchVx = 0, launchVy = FIXED_TURRET_BASE_SPEED, isBankLaunched = false) {
    if (!gameState.running || gameState.over || gameState.paused) return false;
    if (gameState.activeToolMode || gameState.activeSkillMode || gameState.dropCooldown > 0) return false;
    if (gameState.mode === 'chef' && gameState.stepsLeft <= 0) return false;

    clampDropX();
    const curR = getCurrentDropRadius();
    if (!Physics.isSpawnClear(LAUNCH_X, LAUNCH_Y, curR, gameState.entities)) {
      return false;
    }

    audio.ensureCtx();
    const launchAngle = getAimTotalAngle();
    const curMeta = gameState.curMeta || { wildcard: false, golden: false };
    const isMeteor = !!gameState.nextShotMeteor;
    if (isMeteor) gameState.nextShotMeteor = false;

    // Reset per-drop soft skill energy cap
    gameState.stepSkillGain = 0;

    let finalVx = launchVx;
    let finalVy = launchVy;
    if (isMeteor) {
      const spd = Math.hypot(finalVx, finalVy) || FIXED_TURRET_BASE_SPEED;
      const boost = Math.max(1.15, 980 / spd);
      finalVx *= boost;
      finalVy *= boost;
    }

    // Require genuine deliberate lateral bank angle (|vx| >= 140 px/s) to arm Bank-Shot
    const angledShot = Math.abs(finalVx) >= 140 || (isBankLaunched && Math.abs(finalVx) >= 125);
    const dropped = createEntity(
      gameState.curTier,
      LAUNCH_X,
      LAUNCH_Y,
      finalVx,
      finalVy,
      false,
      -launchAngle * 0.35,
      angledShot ? (finalVx >= 0 ? 3.2 : -3.2) : 0,
      { ...curMeta, isBankLaunched: angledShot, isMeteorShot: isMeteor }
    );
    gameState.lastDroppedId = dropped.id;
    gameState.dropsMadeThisRun++;
    audio.playDrop(curMeta.wildcard, curMeta.golden || isMeteor);

    // Decay freshSteps on existing Dual-Table Orders BEFORE spawning a step-6 Judge Rush Order
    // so newly spawned Judge Rush Orders begin with their full 4-step fresh window!
    if (gameState.orders && gameState.orders.length > 0) {
      for (const ord of gameState.orders) {
        if (ord && !ord.completed && ord.freshSteps > 0) {
          ord.freshSteps = Math.max(0, ord.freshSteps - 1);
        }
      }
    }

    // 4.0 Shift Step Budget (chef mode)
    if (gameState.mode === 'chef') {
      gameState.stepsLeft = Math.max(0, gameState.stepsLeft - 1);
      gameState.shiftStepsUsed++;
      if (gameState.stepsLeft === 0) {
        gameState.shiftResolveDelay = 1.35;
      }
      // Shift 4 Midnight Cat Party: scheduled Meteor Wish on step 6 & 12
      if (gameState.shiftModifier === 'party_events') {
        if (gameState.shiftStepsUsed === 6 || gameState.shiftStepsUsed === 12) triggerShopEvent('meteor');
      }
      // Shift 5 / Endless Grand Prix: every 6 steps triggers Judge Rush Order (+2 steps reward!)
      // Never overwrite a half-completed VIP order — route to table 0 if table 1 already has progress!
      if (gameState.shiftModifier === 'grand_prix' && gameState.shiftStepsUsed > 0 && gameState.shiftStepsUsed % 6 === 0) {
        const vipHasPartial =
          gameState.orders.length >= 2 &&
          gameState.orders[1] &&
          !gameState.orders[1].completed &&
          gameState.orders[1].slots.some((s) => s.done);
        const targetIdx = vipHasPartial ? 0 : 1;
        const rushOrd = generateTableOrder('vip', false, { isJudgeRush: true });
        rushOrd.slotOrigin = targetIdx === 0 ? 'quick' : 'vip';
        if (gameState.orders.length >= 2) gameState.orders[targetIdx] = rushOrd;
        else gameState.orders.push(rushOrd);
        gameState.order = rushOrd;
        audio.playOrderStamp();
        showComboBanner('评委突击急单', '4步内出餐 ×2.5 · 返 +2步', '#ffe570', 'icon_judge', 2);
      }
    }

    // Relic: rel_aged — servable treats held in jar age +1 stack (+30% per stack, max 5)
    if (app.hasRelic('rel_aged')) {
      for (const e of gameState.entities) {
        if (e.id === dropped.id || e.merged || e.isWildcard || e.isYarnBall || e.frozenHp > 0 || e.tier === 9) continue;
        if (findServableMatch(e)) {
          e.agedStacks = Math.min(5, (e.agedStacks || 0) + 1);
        }
      }
    }

    // Relic: rel_antigrav — every 4 drops flips gravity for 1.3s (+80% merge bonus!)
    if (app.hasRelic('rel_antigrav')) {
      gameState.antigravDropCounter = (gameState.antigravDropCounter || 0) + 1;
      if (gameState.antigravDropCounter >= 4) {
        gameState.antigravDropCounter = 0;
        gameState.antigravTimer = 1.3;
        audio.playAntiGrav();
        platform.vibrateShort('light');
        for (const e of gameState.entities) {
          if (!e.merged) e.vy -= 95 + Math.random() * 55;
        }
        spawnSparkleBurst(JAR.canvasW * 0.5, 290, '#d6b2ff', 24);
        showComboBanner('月光反重力洗牌', '1.3秒重力倒置 · 合成 +80%', '#dfc2ff', 'icon_ufo', 2);
      }
    }

    const wasWild = !!curMeta.wildcard;
    const nextIsAlreadyWild = !!(gameState.nextMeta && gameState.nextMeta.wildcard);
    let triggerPity = false;
    if (!wasWild && !nextIsAlreadyWild) {
      gameState.dropsUntilRainbow--;
      if (gameState.dropsUntilRainbow <= 0) {
        triggerPity = true;
        gameState.dropsUntilRainbow = getRainbowPityBase();
      }
    } else if (wasWild) {
      gameState.dropsUntilRainbow = getRainbowPityBase();
    }

    gameState.curTier = gameState.nextTier;
    gameState.curMeta = { ...gameState.nextMeta };
    const bundle = pickDropBundle(triggerPity);
    gameState.nextTier = bundle.tier;
    gameState.nextMeta = bundle.meta;

    if (triggerPity) {
      app.showToast('星露蓄满 · 下颗彩虹糖', { icon: 'icon_rainbow', tone: 'event' });
    }

    if (gameState.mode !== 'rush' && !gameState.activeEvent && gameState.shiftModifier !== 'party_events') {
      gameState.nextEventDrops--;
      if (gameState.nextEventDrops <= 0) {
        gameState.nextEventDrops = 14 + Math.floor(Math.random() * 6);
        triggerShopEvent();
      }
    }

    syncIdleAimFromAngle(0);
    gameState.dropSway = 0;
    gameState.canHoldThisTurn = true;
    const isFever = gameState.feverTimer > 0;
    if (gameState.mode === 'rush') {
      gameState.dropCooldown = isFever ? 0.08 : 0.12;
    } else {
      gameState.dropCooldown = isFever ? 0.10 : 0.16;
    }
    gameState.heldActionAnim = null;
    gameState.heldActionCooldown = 1.5 + Math.random() * 1.5;
    clampDropX();
    scheduleCheckpointSave(1200);
    return true;
  }

  // Particles & FX (capped at 160 to guarantee smooth 60fps on budget devices)
  function spawnSparkleBurst(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      if (gameState.particles.length >= 160) break;
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = 65 + Math.random() * 175;
      gameState.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        size: 3 + Math.random() * 4.5,
        color,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        star: i % 2 === 0,
        crumb: false
      });
    }
  }

  function spawnImpactCrumbs(x, y, nx, ny, color, intensity) {
    if (gameState.particles.length > 140) return;
    const count = Math.min(7, Math.max(2, Math.round(2 + intensity * 5)));
    const tx = -ny;
    const ty = nx;
    for (let i = 0; i < count; i++) {
      if (gameState.particles.length >= 160) break;
      const side = (Math.random() - 0.5) * 2;
      const tangSpd = side * (35 + Math.random() * 95 * (0.5 + intensity));
      const normSpd = (18 + Math.random() * 55) * (0.4 + intensity * 0.6);
      gameState.particles.push({
        x: x + tx * side * 3,
        y: y + ty * side * 3,
        vx: tx * tangSpd + nx * normSpd,
        vy: ty * tangSpd + ny * normSpd - 16,
        size: 1.6 + Math.random() * 2.1,
        color,
        life: 0.24 + Math.random() * 0.22,
        maxLife: 0.46,
        star: false,
        crumb: true
      });
    }
  }

  function applyDirectionalSquish(body, nx, ny, impactSpeed) {
    if (!body) return;
    const amp = Math.min(0.24, Math.max(0.035, (impactSpeed - 75) / 1450));
    if (amp >= body.squishAmt * 0.55) {
      body.squishAngle = Math.atan2(ny, nx);
      body.squishAmt = Math.min(0.26, Math.max(body.squishAmt, amp));
      body.squishVel = 0;
    }
  }

  function spawnPopup(x, y, text, color = '#fff2a6', fontSize = 16) {
    gameState.popups.push({ x, y, vy: -56, text, color, fontSize, life: 0.98, maxLife: 0.98 });
  }

  function spawnShockwave(x, y, maxR = 72, color = '#ffe37a', lineWidth = 3.5) {
    gameState.shockwaves.push({ x, y, r: 8, maxR, color, lineWidth, life: 0.38, maxLife: 0.38 });
  }

  function showComboBanner(text, sub = '', color = '#ffe56b', icon = '', priority = 1) {
    if (
      gameState.comboBanner &&
      gameState.comboBanner.life > 0.25 &&
      (gameState.comboBanner.priority || 1) > priority
    ) {
      return;
    }
    gameState.comboBanner = { text, sub, color, icon, priority, life: 1.35, maxLife: 1.35 };
  }

  function applyMergeShockwaveImpulse(mx, my, bornR, nextTier, excludeId) {
    const shockLv = app.getPerkLevel('shockwave');
    const hasShockRelic = app.hasRelic('rel_shockwave');
    const relicShockMult = hasShockRelic ? 1.65 : 1.0;
    const isFever = gameState.feverTimer > 0;
    const mugiBoost = saveData.selectedPatron === 'mugi' && nextTier >= 4 ? 1.3 : 1.0;
    const blastRadius = (bornR * (2.35 + shockLv * 0.55) + 40) * relicShockMult;
    const baseForce = (55 + nextTier * 18 + shockLv * 52 + (isFever ? 32 : 0)) * mugiBoost * relicShockMult;

    for (const other of gameState.entities) {
      if (other.id === excludeId || other.merged) continue;
      const dx = other.x - mx;
      const dy = other.y - my;
      const dist = Math.hypot(dx, dy);
      if (dist < 1 || dist > blastRadius) continue;

      const falloff = 1 - dist / blastRadius;
      const ux = dx / dist;
      const uy = dy / dist;
      const massFactor = Math.min(1.25, Math.max(0.42, 34 / Math.max(16, other.r)));
      const imp = Math.min(310, baseForce * falloff * massFactor);
      const nearTop = other.y < JAR.dangerY + 58;
      other.vx += ux * imp * 0.95;
      other.vy += nearTop ? Math.max(0, uy * imp * 0.35) : uy * imp * 0.72 - imp * 0.34;
      other.vr += (dx >= 0 ? 1 : -1) * falloff * (2.4 + shockLv * 0.9);
      applyDirectionalSquish(other, -ux, -uy, 130 + imp * 1.1);
    }
  }

  function triggerMontBlancCrush(mb, isEcho = false) {
    if (!mb || (!isEcho && mb.merged)) return 0;
    const victims = gameState.entities
      .filter((other) => {
        if (other.id === mb.id || other.merged || other.isWildcard || other.isYarnBall || other.frozenHp > 0) return false;
        if (other.tier > 2) return false;
        const dy = other.y - mb.y;
        const dist = Math.hypot(other.x - mb.x, dy);
        return (isEcho || dy > -10) && dist <= mb.r + other.r + (isEcho ? 48 : 22);
      })
      .slice(0, 2);
    if (victims.length === 0) return 0;
    const victimIds = new Set(victims.map((v) => v.id));
    let pts = 0;
    for (const v of victims) {
      pts += Math.round(100 * app.getFeverMultiplier() * app.getGlobalRevenueMult());
      spawnSparkleBurst(v.x, v.y, '#d9a97c', 14);
      spawnShockwave(v.x, v.y, 48, '#e3b27d', 2.8);
    }
    gameState.entities = gameState.entities.filter((e) => !victimIds.has(e.id));
    addScore(pts);
    addRunStardust(victims.length * 5);
    addSkillEnergy(victims.length * 10);
    audio.playTraitTrigger(8);
    spawnPopup(mb.x, mb.y + mb.r * 0.4, `${isEcho ? '回响' : ''}压碎×${victims.length} +${pts}`, '#ffd699', 16);
    return victims.length;
  }

  function triggerDessertTrait(born, mx, my, isEcho = false) {
    if (!born || (!isEcho && born.merged) || born.isWildcard) return;
    const tier = born.tier;
    const traitCnt = app.getArchetypeCount('trait');
    const rMult = traitCnt >= 2 ? 1.22 : 1.0;

    // Archetype Synergy: #异能 2-piece (+¥60) & 3-piece (+15% skill & +4星露)
    if (tier >= 3 && traitCnt >= 2) {
      const synPts = Math.round(60 * app.getFeverMultiplier() * app.getGlobalRevenueMult());
      addScore(synPts);
      if (traitCnt >= 3) {
        addSkillEnergy(15);
        addRunStardust(4);
      }
    }

    // Relic: rel_resonance — whenever any treat triggers a trait, apply 2.5s jar-wide gentle magnet!
    if (tier >= 3 && app.hasRelic('rel_resonance')) {
      gameState.globalResonanceTimer = Math.max(gameState.globalResonanceTimer, 2.5);
      spawnShockwave(mx, my, Math.round(120 * rMult), '#a8e67e', 2.0);
    }

    if (tier === 3) {
      // T3 Matcha Kitty: 1.8s gentle same-tier resonance field
      born.resonanceTimer = traitCnt >= 2 ? 2.2 : 1.8;
      spawnShockwave(mx, my, Math.round(105 * rMult), '#a8e67e', 2.4);
      spawnPopup(mx, my - born.r - 12, '猫耳共鸣', '#c9f598', 12.5);
    } else if (tier === 4) {
      // T4 Lemon Honey Tart (upgraded by rel_lemonade & #异能 synergy!)
      const hasLem = app.hasRelic('rel_lemonade');
      const range = Math.round((hasLem ? 165 : 105) * rMult);
      const maxTierTarget = hasLem ? 2 : 1;
      const maxCount = hasLem ? 4 : 2;
      const perPts = hasLem ? 90 : 55;
      const targets = gameState.entities
        .filter((e) => e.id !== born.id && !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier <= maxTierTarget)
        .map((e) => ({ e, d: Math.hypot(e.x - mx, e.y - my) }))
        .filter((it) => it.d <= range + eRadiusSafe(it.e))
        .sort((a, b) => a.d - b.d)
        .slice(0, maxCount);
      if (targets.length > 0) {
        const rmIds = new Set(targets.map((it) => it.e.id));
        let gainPts = 0;
        for (const it of targets) {
          gainPts += Math.round(perPts * app.getFeverMultiplier() * app.getGlobalRevenueMult());
          spawnSparkleBurst(it.e.x, it.e.y, '#fff08a', 14);
          spawnShockwave(it.e.x, it.e.y, 44, '#ffe86b', 2.6);
        }
        gameState.entities = gameState.entities.filter((e) => !rmIds.has(e.id));
        addScore(gainPts);
        addSkillEnergy(targets.length * 8);
        const coinGain = hasLem && gameState.mode === 'chef' ? addCoins(targets.length * 3) : 0;
        audio.playTraitTrigger(4);
        wakeNeighborsAfterRemoval(mx, my, born.r);
        const cTag = coinGain > 0 ? ` +${coinGain}币` : '';
        spawnPopup(mx, my - born.r - 16, `${isEcho ? '回响' : '气泡'}清杂×${targets.length} +${gainPts}${cTag}`, '#fff08a', 15);
      }
    } else if (tier === 5) {
      // T5 Strawberry Daifuku: soft inward mochi vortex pulls neighbors gently together
      const vortexRange = Math.round(145 * rMult);
      let pulled = 0;
      for (const other of gameState.entities) {
        if (other.id === born.id || other.merged) continue;
        const dx = mx - other.x;
        const dy = my - other.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8 && dist <= vortexRange) {
          const factor = 1 - dist / vortexRange;
          const pull = 120 + factor * 140;
          other.vx += (dx / dist) * pull;
          other.vy += (dy / dist) * pull * 0.65 - 28;
          pulled++;
        }
      }
      if (pulled > 0) {
        audio.playTraitTrigger(5);
        spawnShockwave(mx, my, Math.round(135 * rMult), '#ff9ec2', 3.0);
        spawnPopup(mx, my - born.r - 16, isEcho ? '回响聚拢' : '软糯聚拢', '#ffb8d6', 14);
      }
    } else if (tier === 6) {
      // T6 Caramel Star Donut: 1.4s spinning mixer loosens wedged clusters
      const spinDir = Math.random() < 0.5 ? 1 : -1;
      const spinPad = Math.round(48 * rMult);
      if (!isEcho) {
        born.spinBoostTimer = 1.4;
        born.spinBoostDir = spinDir;
      }
      for (const other of gameState.entities) {
        if (other.id === born.id || other.merged) continue;
        const dx = other.x - mx;
        const dy = other.y - my;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist <= born.r + other.r + spinPad) {
          const tx = (-dy / dist) * spinDir;
          const ty = (dx / dist) * spinDir;
          other.vx += tx * 125;
          other.vy += ty * 80 - 48;
        }
      }
      audio.playTraitTrigger(6);
      spawnShockwave(mx, my, born.r * 1.9, '#eab074', 3.2);
      spawnPopup(mx, my - born.r - 16, isEcho ? '回响旋搅' : '焦糖陀螺', '#ffd499', 14.5);
    } else if (tier === 7) {
      // T7 Cosmic Macaron: low-gravity buoyant lift
      if (!isEcho) {
        born.vy = Math.min(born.vy, -125);
      } else {
        const liftR = Math.round(150 * rMult);
        for (const other of gameState.entities) {
          if (other.merged) continue;
          if (Math.hypot(other.x - mx, other.y - my) <= liftR) {
            other.vy -= 120;
          }
        }
      }
      spawnSparkleBurst(mx, my, '#d8c2ff', 16);
      spawnPopup(mx, my - born.r - 16, isEcho ? '回响浮升' : '云端微浮', '#e5d4ff', 14.5);
    } else if (tier === 8) {
      // T8 Royal Mont Blanc: heavy hammer crush
      triggerMontBlancCrush(born, isEcho);
    }
  }

  function eRadiusSafe(e) {
    return e && typeof e.r === 'number' ? e.r : 16;
  }

  // Step Physics World
  function stepPhysics(dt) {
    const magnetLv = app.getEffectiveMagnetLevel();
    const isFever = gameState.feverTimer > 0;
    const magnetRange = magnetLv > 0 || isFever ? magnetLv * 14 + (isFever ? 28 : 0) : 0;
    const magnetForce = magnetLv > 0 || isFever ? 420 + magnetLv * 280 + (isFever ? 640 : 0) : 0;
    const gravityDir = gameState.antigravTimer > 0 ? -1 : 1;
    const wallRestBonus = app.hasRelic('rel_bouncy') ? 0.25 : 0;
    const globalResonance = gameState.globalResonanceTimer > 0;

    const result = Physics.stepWorld(gameState.entities, JAR, dt, 1880, {
      magnetRange,
      magnetForce,
      gravityDir,
      wallRestBonus,
      globalResonance,
      obstacles: gameState.obstacles
    });
    const { mergePairs, impacts, wallBounces, meteorHits, bumperHits, glazeHits, debugContacts, magnetLinks } = result;
    gameState.lastDebugContacts = debugContacts;
    gameState.magnetLinks = magnetLinks || [];

    // Caramel Glaze Ring pass-through gilding hits
    if (glazeHits && glazeHits.length > 0) {
      for (const gh of glazeHits) {
        if (gh.ring) gh.ring.hitFlash = 0.45;
        gameState.glazeHitsThisRun = (gameState.glazeHitsThisRun || 0) + 1;
        audio.playGlazeRing();
        platform.vibrateShort('light');
        spawnSparkleBurst(gh.x, gh.y, '#ffe47a', 18);
        spawnShockwave(gh.x, gh.y, 58, '#ffe066', 3.2);
        spawnPopup(gh.x, gh.y - 16, '星环镀金', '#ffe878', 15);
      }
    }

    // Butter Bumper Pinball hits (stage hazard / rel_bumpers / synergy)
    if (bumperHits && bumperHits.length > 0) {
      for (const bh of bumperHits) {
        if (bh.bumper) bh.bumper.hitFlash = 0.36;
        const grantsCrit = !!(bh.bumper && bh.bumper.grantsCrit);
        if (bh.body) {
          bh.body.bumperHits = (bh.body.bumperHits || 0) + 1;
          if (grantsCrit && !(bh.body.frozenHp > 0)) {
            bh.body.bumperCrit = true;
          }
        }
        audio.playBumperHit();
        platform.vibrateShort('light');
        const baseTip = (bh.bumper && bh.bumper.tipBase) || 40;
        const tip = Math.round(baseTip * app.getGlobalRevenueMult());
        addScore(tip);
        spawnSparkleBurst(bh.x, bh.y, '#ffe47a', 10);
        spawnShockwave(bh.x, bh.y, 40, '#ffd86b', 2.6);
        const popTxt = grantsCrit ? `+¥${tip} 暴击蓄能` : `+¥${tip} 弹柱`;
        spawnPopup(bh.x, bh.y - 16, popTxt, '#ffe588', 13);
      }
    }

    // Glass wall bank-shot bounce feedback
    if (wallBounces && wallBounces.length > 0) {
      for (const wb of wallBounces) {
        audio.playBankBounce(wb.count);
        spawnSparkleBurst(wb.x, wb.y, '#9cf4ff', 10);
        spawnShockwave(wb.x, wb.y, 44, '#9cf4ff', 2.6);
        if (wb.count === 1) {
          spawnPopup(wb.x + wb.nx * 24, wb.y - 10, '弹壁', '#b4f6ff', 13);
        } else if (wb.count === 2 && app.hasRelic('rel_bouncy')) {
          spawnPopup(wb.x + wb.nx * 24, wb.y - 10, '二段弹壁 +90%', '#9cf4ff', 14.5);
        }
      }
    }

    // Mugi's Meteor Shot impact upgrade & blast
    if (meteorHits && meteorHits.length > 0) {
      for (const mh of meteorHits) {
        const tgt = mh.target;
        if (!tgt || tgt.merged) continue;
        audio.playCritJump();
        platform.vibrateShort('medium');
        spawnSparkleBurst(mh.x, mh.y, '#ff9852', 24);
        spawnShockwave(mh.x, mh.y, 128, '#ff9852', 4.4);
        damageNearbyYarnBalls(mh.x, mh.y, 125, false);
        // Thaw frozen treats within 120px BEFORE upgrading direct hit target!
        thawNearbyFrozenEntities(mh.x, mh.y, 120, false);
        if (tgt.frozenHp > 0) {
          thawNearbyFrozenEntities(tgt.x, tgt.y, 120, false);
        }
        gameState.screenShake = Math.max(gameState.screenShake, 5.0);
        if (tgt.tier < 9) {
          const nextTier = tgt.tier + 1;
          const def = TIERS[nextTier - 1];
          tgt.tier = nextTier;
          Physics.configureBodyShape(tgt, getShapeDef(nextTier), def.radius, def.material);
          Physics.clampBodyInsideJarPositional(tgt, JAR, gameState.obstacles);
          tgt.squishAmt = 0.26;
          tgt.squishVel = 0;
          const pts = Math.round(def.points * 1.5 * app.getFeverMultiplier() * app.getGlobalRevenueMult());
          addScore(pts);
          unlockTier(nextTier);
          triggerDessertTrait(tgt, tgt.x, tgt.y);
          notifyTreatSynthesized(nextTier, tgt);
          spawnPopup(tgt.x, tgt.y - tgt.r * 0.6, `重锤升阶 +${pts}`, '#ffba78', 18);
          showComboBanner('元气重锤命中', `${def.name} 升阶 +${pts}`, '#ffaa66', 'icon_flame', 2);
        }
      }
    }

    if (impacts.length > 0) {
      let strongest = impacts[0];
      for (let i = 0; i < impacts.length; i++) {
        const imp = impacts[i];
        if (imp.speed > strongest.speed) strongest = imp;
        applyDirectionalSquish(imp.bodyB, imp.nx, imp.ny, imp.speed);
        if (imp.bodyA) applyDirectionalSquish(imp.bodyA, -imp.nx, -imp.ny, imp.speed);

        // T8 Mont Blanc heavy landing crush
        if (imp.bodyB && imp.bodyB.tier === 8 && !imp.bodyB.crushUsed && imp.speed > 240) {
          imp.bodyB.crushUsed = true;
          triggerMontBlancCrush(imp.bodyB);
        }

        if (imp.speed > 135) {
          const defB = imp.bodyB.isYarnBall ? null : TIERS[imp.bodyB.tier - 1];
          const intensity = Math.min(1, (imp.speed - 110) / 520);
          const crumbCol = imp.bodyB.isYarnBall
            ? '#ffb5cf'
            : imp.bodyB.isWildcard
            ? '#ffb5d8'
            : imp.bodyB.isGolden
            ? '#ffe27a'
            : defB
            ? defB.crumbColor
            : '#ffe3c4';
          spawnImpactCrumbs(imp.x, imp.y, imp.nx, imp.ny, crumbCol, intensity);
        }
      }

      if (strongest.speed > 100) {
        const intensity = Math.min(1, (strongest.speed - 85) / 480);
        const hitGlass = strongest.bodyA === null;
        const tierA = strongest.bodyA ? (strongest.bodyA.isYarnBall ? 3 : strongest.bodyA.tier) : 0;
        const tierB = strongest.bodyB.isYarnBall ? 3 : strongest.bodyB.tier;
        audio.playBounce(intensity, strongest.bodyA ? Math.max(tierA, tierB) : tierB, hitGlass);
      }
    }

    if (mergePairs.length > 0) {
      const comboLv = app.getPerkLevel('combo');
      const critLv = app.getPerkLevel('critJump');
      const goldenLv = app.getPerkLevel('golden');
      const rainbowLv = app.getPerkLevel('rainbow');
      const hasCritRelic = app.hasRelic('rel_crit_star');
      const upComboBonus = getComboUpgradeBonus();
      const isChimeEvent = !!(gameState.activeEvent && gameState.activeEvent.kind === 'chime');
      const chimeComboBonus = isChimeEvent ? 0.5 : 0;
      const globalMult = app.getGlobalRevenueMult();
      const antiGravActive = gameState.antigravTimer > 0;
      const cascadeArchCnt = app.getArchetypeCount('cascade');
      const bankArchCnt = app.getArchetypeCount('bank');

      gameState.entities = gameState.entities.filter((e) => !e.merged);
      for (const [a, b] of mergePairs) {
        const isTwinWild = !!(a.isWildcard && b.isWildcard);
        const isWildMerge = !isTwinWild && !!(a.isWildcard || b.isWildcard);
        const isGoldenMerge = !!(a.isGolden || b.isGolden);
        const aBounces =
          a.age < 2.2 && typeof a.lastWallBounceAge === 'number' && a.age - a.lastWallBounceAge <= 1.35
            ? a.wallBounces || 0
            : 0;
        const bBounces =
          b.age < 2.2 && typeof b.lastWallBounceAge === 'number' && b.age - b.lastWallBounceAge <= 1.35
            ? b.wallBounces || 0
            : 0;
        const maxBounces = Math.max(aBounces, bBounces);
        const isBankShot = maxBounces > 0;
        const isMeteorMerge = !!(a.isMeteorShot || b.isMeteorShot);
        const hasBumperCrit = !!(a.bumperCrit || b.bumperCrit);

        const targetBody = isWildMerge ? (a.isWildcard ? b : a) : null;
        const mx = targetBody ? targetBody.x : (a.x + b.x) * 0.5;
        const my = targetBody ? targetBody.y : (a.y + b.y) * 0.5;
        const mvx = (a.vx + b.vx) * 0.32;
        const mvy = Math.min(0, (a.vy + b.vy) * 0.32) - 62;
        const mAngle = Math.atan2(Math.sin(a.angle) + Math.sin(b.angle), Math.cos(a.angle) + Math.cos(b.angle)) * 0.3;
        const mVr = (a.vr + b.vr) * 0.22;

        if (gameState.comboTimer <= 0) {
          gameState.comboCount = 1;
          gameState.comboRainbowGranted = false;
        } else {
          gameState.comboCount++;
        }
        gameState.comboTimer = 1.72 + comboLv * 0.6 + upComboBonus + chimeComboBonus;
        if (gameState.comboCount > gameState.maxCombo) gameState.maxCombo = gameState.comboCount;

        // Base skill recharge from merging
        addSkillEnergy(5);

        // Luna Rainbow Wildcard Merge Bounty (+5 coins in Chef & +6星露)
        if ((isWildMerge || isTwinWild) && saveData.selectedPatron === 'luna') {
          const lunaDust = addRunStardust(6);
          const lunaCoin = gameState.mode === 'chef' ? addCoins(5) : 0;
          spawnPopup(mx, my - 46, `星兔虹赏${lunaCoin > 0 ? ` +${lunaCoin}币` : ''} +${lunaDust}星露`, '#e5caff', 13);
        }

        // Serve Cascade Avalanche detection!
        let cascadeAdd = 0;
        let cascadeHitNum = 0;
        if (gameState.serveCascadeTimer > 0) {
          gameState.serveCascadeMerges++;
          cascadeHitNum = gameState.serveCascadeMerges;
          const extendMin = app.hasRelic('rel_domino') ? 2.6 : 1.85;
          gameState.serveCascadeTimer = Math.max(gameState.serveCascadeTimer, extendMin);
          cascadeAdd =
            CASCADE_MULTIPLIERS[Math.min(CASCADE_MULTIPLIERS.length - 1, cascadeHitNum)] -
            1 +
            (app.hasRelic('rel_domino') ? cascadeHitNum * 0.35 : 0) +
            (cascadeArchCnt >= 3 ? 0.5 : 0);
          if (cascadeHitNum > gameState.maxAvalancheRun) gameState.maxAvalancheRun = cascadeHitNum;
          if (cascadeHitNum > (saveData.lifetimeStats.maxAvalancheEver || 0)) {
            saveData.lifetimeStats.maxAvalancheEver = cascadeHitNum;
            persistSaveData();
          }
          audio.playCascadeHit(cascadeHitNum);

          // Refund the 1-step stale order serve cost immediately on the FIRST cascade merge!
          if (cascadeHitNum >= 1 && gameState.cascadeStaleRefundPending && gameState.mode === 'chef') {
            gameState.cascadeStaleRefundPending = false;
            gameState.stepsLeft++;
            gameState.shiftResolveDelay = 0;
            spawnPopup(JAR.canvasW / 2, 122, '巧手抽底 · 返还1步', '#9cf4ff', 15.5);
          }

          if (cascadeHitNum === 2) {
            addSkillEnergy(20);
            const avDust = addRunStardust(12);
            const hasPerpetual = app.hasRelic('rel_perpetual');
            const refundCap = hasPerpetual ? 6 : 3;
            let stepStr = '';
            if (gameState.mode === 'chef' && gameState.shiftStepRefunds < refundCap) {
              gameState.stepsLeft++;
              gameState.shiftStepRefunds++;
              gameState.shiftResolveDelay = 0;
              stepStr = ' · +1步';
              if (
                hasPerpetual &&
                gameState.orders &&
                gameState.orders.length > 0 &&
                gameState.orders[0] &&
                !gameState.orders[0].slots.some((s) => s.done)
              ) {
                gameState.orders[0] = generateTableOrder(gameState.orders[0].slotOrigin || 'quick', false, {
                  doubleFresh: true
                });
                spawnPopup(JAR.canvasW / 2, 120, '翻台永动 · 鲜度翻倍', '#ffe588', 15);
              }
            }
            spawnPopup(JAR.canvasW / 2, 148, `抽底雪崩连爆${stepStr} +20%技 +${avDust}星露`, '#9cf4ff', 16.5);
          }
        }

        // Bank-Shot additive bonus (rel_prism, rel_bouncy, rel_ricochet, #弹壁 synergy, Mugi patron & T2 Peach Puff)
        let bankAdd = 0;
        let ricochetLeap = false;
        const forceBankGold = isBankShot && bankArchCnt >= 3;
        if (isBankShot) {
          const isT2Bank = !isWildMerge && !isTwinWild && a.tier === 2;
          bankAdd =
            (app.hasRelic('rel_prism') ? 0.9 : 0.5) +
            (maxBounces >= 2 && app.hasRelic('rel_bouncy') ? 0.4 : 0) +
            (bankArchCnt >= 2 ? 0.3 : 0) +
            (saveData.selectedPatron === 'mugi' ? 0.35 : 0) +
            (isT2Bank ? 0.25 : 0);
          gameState.bankShotsLanded++;
          saveData.lifetimeStats.bankShotsTotal = (saveData.lifetimeStats.bankShotsTotal || 0) + 1;
          persistSaveData();
          addSkillEnergy(10);
          if (bankArchCnt >= 2) addFeverEnergy(8);

          // Mugi Patron Bank-Shot Coin Bounty (+3 coins up to 5 times per shift)
          if (saveData.selectedPatron === 'mugi' && gameState.mode === 'chef' && gameState.mugiBankCoinHits < 5) {
            gameState.mugiBankCoinHits++;
            addCoins(3);
            spawnPopup(mx - 24, my - 38, '弹壁赏 +3币', '#ffd880', 13);
          }

          if (app.hasRelic('rel_prism') && gameState.nextMeta && !gameState.nextMeta.wildcard) {
            gameState.nextMeta.golden = true;
            spawnPopup(mx, my - 42, '折光镀金', '#ffe888', 13.5);
          }
          if (app.hasRelic('rel_ricochet')) {
            addSkillEnergy(35);
            if (Math.random() < 0.45) ricochetLeap = true;
          }
        }

        // Mugi ≥3 combo skill energy burst
        if (saveData.selectedPatron === 'mugi' && gameState.comboCount >= 3) {
          addSkillEnergy(20);
          if (gameState.mode === 'rush') {
            addScore(80);
            spawnPopup(mx + 26, my - 26, '+80 · +20%技', '#ffd27a', 13);
          } else {
            const mugiDust = addRunStardust(4);
            spawnPopup(mx + 26, my - 26, `+${mugiDust}星露 · +20%技`, '#ffd27a', 13);
          }
        }

        const feverMult = app.getFeverMultiplier();
        const feverAdd = gameState.feverTimer > 0 ? Math.max(0, feverMult - 1) : 0;
        const comboStep = 0.25 + comboLv * 0.15;
        const comboAdd = Math.min(1.5, (gameState.comboCount - 1) * comboStep);
        const antiGravAdd = antiGravActive ? 0.8 : 0;
        const bumperAdd = hasBumperCrit ? 0.35 : 0;
        const chimeAdd = isChimeEvent ? 0.35 : 0;

        if (gameState.feverTimer > 0 && gameState.comboCount >= 3 && gameState.feverBonusUsed < 4.5) {
          const ext = 0.8;
          gameState.feverTimer += ext;
          gameState.feverMaxDuration = Math.max(gameState.feverMaxDuration, gameState.feverTimer);
          gameState.feverBonusUsed += ext;
          audio.playFeverExtend();
          spawnPopup(JAR.canvasW / 2, 118, '狂热 +0.8s', '#ffdf6b', 15);
        }

        const rainbowComboReq = rainbowLv > 0 ? 3 : 4;
        if (gameState.comboCount >= rainbowComboReq && !gameState.comboRainbowGranted) {
          gameState.comboRainbowGranted = true;
          grantNextRainbow(`${gameState.comboCount}连合`);
        }

        damageNearbyYarnBalls(mx, my, isMeteorMerge ? 135 : 95, false);
        thawNearbyFrozenEntities(mx, my, isMeteorMerge ? 120 : 110, false);

        if (isTwinWild) {
          const born = createEntity(5, mx, my, mvx, mvy - 30, true, 0, 0, { golden: true });
          const twinSkillPool = Math.min(
            4.5,
            1 + comboAdd + feverAdd + bankAdd + cascadeAdd + antiGravAdd + bumperAdd + chimeAdd
          );
          const pts = Math.round(480 * Math.min(8.0, twinSkillPool * globalMult));
          addScore(pts);
          addRunStardust(24);
          addFeverEnergy(45);
          audio.playWildcard();
          spawnSparkleBurst(mx, my, '#ff99cc', 22);
          spawnSparkleBurst(mx, my, '#ffe378', 22);
          spawnShockwave(mx, my, 130, '#ff99cc', 4.5);
          spawnShockwave(mx, my, 92, '#ffe378', 3.2);
          triggerDessertTrait(born, mx, my);
          gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.048);
          gameState.screenShake = Math.max(gameState.screenShake, 5.5);
          gameState.jarFlash = Math.max(gameState.jarFlash, 0.65);
          showComboBanner('双彩虹奇迹', `黄金大福诞生 +${pts}`, '#ff9fd2', 'icon_rainbow', 2);
          spawnPopup(mx, my - 30, `双虹奇迹 +${pts}`, '#ffe57e', 20);
          notifyTreatSynthesized(5, born);
          continue;
        }

        const baseTier = targetBody ? targetBody.tier : a.tier;
        if (baseTier < 9) {
          const critChance = (hasCritRelic ? 0.18 : 0) + critLv * 0.14 + (isMeteorMerge ? 0.5 : 0);
          const isCrit = baseTier <= 7 && (ricochetLeap || (critChance > 0 && Math.random() < critChance));
          const nextTier = Math.min(9, baseTier + (isCrit ? 2 : 1));
          const def = TIERS[nextTier - 1];
          const inheritGold = forceBankGold || (isGoldenMerge && Math.random() < 0.22 + goldenLv * 0.12);
          const born = createEntity(nextTier, mx, my, mvx, mvy, true, mAngle, mVr, { golden: inheritGold });

          const critAdd = isCrit ? 0.75 : 0;
          const skillPool = Math.min(
            4.5,
            1 + comboAdd + feverAdd + bankAdd + cascadeAdd + antiGravAdd + bumperAdd + chimeAdd + critAdd
          );
          const goldMult = isGoldenMerge ? 2.0 : 1.0;
          const totalMergeMult = Math.min(8.0, skillPool * goldMult * globalMult);
          const pts = Math.round(def.points * totalMergeMult);
          addScore(pts);

          let dustBase = nextTier >= 4 ? Math.max(1, Math.floor(nextTier / 2)) : 0;
          if (isGoldenMerge) dustBase += 12 + goldenLv * 10;
          const dustGain = dustBase > 0 ? addRunStardust(dustBase) : 0;
          addFeverEnergy(5.5 + nextTier * 2.3 + (isGoldenMerge ? 26 : 0) + (isWildMerge ? 14 : 0) + (isBankShot ? 10 : 0));

          if (isCrit) audio.playCritJump();
          else if (isWildMerge) audio.playWildcard();
          else if (isGoldenMerge) audio.playGoldenMerge();
          else audio.playMerge(nextTier, gameState.comboCount, false);

          if (gameState.comboCount >= 3 || nextTier >= 6 || isCrit || cascadeHitNum >= 2) {
            platform.vibrateShort('light');
          }

          spawnSparkleBurst(mx, my, isGoldenMerge ? '#ffe066' : def.color, 14 + nextTier * 2);
          if (isWildMerge || isCrit || isBankShot) spawnSparkleBurst(mx, my, isBankShot ? '#9cf4ff' : '#ff99cc', 16);
          spawnShockwave(
            mx,
            my,
            def.radius * 1.9 + 26 + (app.hasRelic('rel_shockwave') ? 22 : 0),
            isWildMerge ? '#ff99cc' : isGoldenMerge ? '#ffe169' : isBankShot ? '#9cf4ff' : def.color,
            isCrit || isGoldenMerge || isBankShot ? 4.4 : 3.2
          );
          if (nextTier >= 5 || gameState.comboCount >= 2 || isCrit || isGoldenMerge || cascadeHitNum >= 1) {
            spawnShockwave(mx, my, def.radius * 1.3 + 16, '#fff4bf', 2.2);
          }

          // T5 Strawberry Daifuku pulls neighbors inward instead of pushing them outward
          if (nextTier !== 5) {
            applyMergeShockwaveImpulse(mx, my, def.radius, nextTier, born.id);
          }
          // Fire per-tier signature physics/gameplay trait!
          triggerDessertTrait(born, mx, my);

          if (isCrit || nextTier >= 7 || gameState.comboCount >= 4 || cascadeHitNum >= 3) {
            gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.045);
            gameState.screenShake = Math.max(gameState.screenShake, 5.2);
            gameState.jarFlash = Math.max(gameState.jarFlash, 0.45);
          } else if (isWildMerge || isGoldenMerge || isBankShot || nextTier >= 5 || gameState.comboCount >= 2 || cascadeHitNum >= 1) {
            gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.025);
            gameState.screenShake = Math.max(gameState.screenShake, 3.0);
          } else {
            gameState.screenShake = Math.max(gameState.screenShake, 1.3);
          }

          const sym = gameState.mode === 'chef' ? '¥' : '';
          const bankDisplay = +(1 + bankAdd).toFixed(1);
          const cascadeDisplay = +(1 + cascadeAdd).toFixed(1);
          let label = `+${sym}${pts}`;
          let popColor = isChimeEvent ? '#ffe778' : '#ffffff';
          let popSize = 15;
          if (cascadeHitNum >= 1) {
            label = `雪崩×${cascadeDisplay.toFixed(1)} +${sym}${pts}`;
            popColor = '#9cf4ff';
            popSize = 18 + Math.min(4, cascadeHitNum);
            showComboBanner(`抽底雪崩 ${cascadeHitNum} 连`, `倍率 ×${cascadeDisplay.toFixed(1)} · +${sym}${pts}`, '#9cf4ff', 'icon_wave', 2);
          } else if (antiGravActive) {
            label = `反重力+80% +${sym}${pts}`;
            popColor = '#dfc2ff';
            popSize = 18;
          } else if (isBankShot) {
            label = ricochetLeap
              ? `神枪跳阶+2 +${sym}${pts}`
              : `弹壁×${bankDisplay.toFixed(1)} +${sym}${pts}`;
            popColor = '#9cf4ff';
            popSize = 18;
            showComboBanner(
              ricochetLeap ? '神枪跳阶箭' : '弹壁神球',
              `${def.name} ×${bankDisplay.toFixed(1)} · +${sym}${pts}`,
              '#9cf4ff',
              ricochetLeap ? 'icon_arrow' : 'icon_billiard',
              1
            );
          } else if (isCrit) {
            label = `奇迹跳阶+2 +${sym}${pts}`;
            popColor = '#ffe46b';
            popSize = 19;
            showComboBanner(`奇迹跳阶 · ${def.name}`, `跳阶暴击 +${sym}${pts}`, '#ffe46b', 'icon_bolt', 2);
          } else if (isGoldenMerge) {
            label = `黄金×2.0 +${sym}${pts}`;
            popColor = '#ffe678';
            popSize = 18;
            showComboBanner('黄金暴击 ×2.0', `+${sym}${pts} · +${dustGain}星露`, '#ffe272', 'icon_stardust', 1);
          } else if (isWildMerge) {
            label = `彩虹升阶 +${sym}${pts}`;
            popColor = '#ffb7e2';
            popSize = 18;
            showComboBanner('彩虹升阶', `${def.name} +${sym}${pts}`, '#ffb7e2', 'icon_rainbow', 1);
          } else if (gameState.comboCount >= 2) {
            label = `${gameState.comboCount}连合 +${sym}${pts}`;
            popColor = '#ffe46b';
            popSize = 17 + Math.min(4, gameState.comboCount - 2);
            const subTxt = gameState.feverTimer > 0
              ? `狂热 ${feverMult.toFixed(1).replace('.0', '')}× 倍率`
              : gameState.comboCount >= 3
              ? '多米诺连锁'
              : '丝滑连击';
            showComboBanner(`${gameState.comboCount} 连合`, subTxt, gameState.comboCount >= 4 ? '#ff9fd2' : '#ffe46b', 'icon_bolt', 1);
          }
          spawnPopup(mx, my - def.radius * 0.6, label, popColor, popSize);

          if (nextTier === 9) {
            gameState.soufflesMadeThisRun++;
            saveData.lifetimeStats.soufflesMade = (saveData.lifetimeStats.soufflesMade || 0) + 1;
            persistSaveData();
            setPatronSpeech(app.activePatron, '星冠猫神诞生！留罐翻倍或点献礼按钮！', 5.0);
            showComboBanner('星冠猫神诞生', '留罐全场 ×2.0 · 顶部胶囊可献礼', '#ffe46b', 'icon_crown', 3);
          }
          notifyTreatSynthesized(nextTier, born);
        } else {
          const supPool = Math.min(4.5, 1 + comboAdd + feverAdd + antiGravAdd + chimeAdd);
          const pts = Math.round((isWildMerge ? 1800 : 2800) * Math.min(8.0, supPool * globalMult));
          addScore(pts);
          addRunStardust(55);
          addFeverEnergy(65);
          addSkillEnergy(100, true);
          audio.playSupernova();
          platform.vibrateShort('heavy');
          spawnSparkleBurst(mx, my, '#ffe378', 48);
          spawnShockwave(mx, my, 210, '#ffe378', 5.5);
          spawnShockwave(mx, my, 150, '#ff9fd2', 3.5);
          gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.06);
          gameState.screenShake = Math.max(gameState.screenShake, 7.5);
          gameState.jarFlash = Math.max(gameState.jarFlash, 0.85);
          spawnPopup(mx, my, `星冠超新星 +${pts}`, '#ffe570', 22);
          showComboBanner('星冠超新星', `+${pts} · 净化小甜品`, '#ffe570', 'icon_crown', 3);
          gameState.entities = gameState.entities.filter((e) => {
            if (!e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier <= 2 && Math.hypot(e.x - mx, e.y - my) < 190) {
              spawnSparkleBurst(e.x, e.y, '#9be0ff', 8);
              return false;
            }
            return true;
          });
        }
      }
    }

    let anyDanger = false;
    for (const e of gameState.entities) {
      e.age += dt;
      if (e.yarnHitFlash > 0) e.yarnHitFlash = Math.max(0, e.yarnHitFlash - dt);
      if (e.frozenFlash > 0) e.frozenFlash = Math.max(0, e.frozenFlash - dt);
      const speed = Math.hypot(e.vx, e.vy);
      if ((e.age < 0.75 && speed > 180) || e.isMeteorShot) {
        e.trail.push({ x: e.x, y: e.y });
        if (e.trail.length > 7) e.trail.shift();
      } else if (e.trail.length > 0) {
        e.trail.shift();
      }

      e.squishVel += (-220 * e.squishAmt - 17 * e.squishVel) * dt;
      e.squishAmt += e.squishVel * dt;
      if (Math.abs(e.squishAmt) < 0.001 && Math.abs(e.squishVel) < 0.01) {
        e.squishAmt = 0;
        e.squishVel = 0;
      } else {
        e.squishAmt = Math.max(-0.15, Math.min(0.28, e.squishAmt));
      }

      if (e.age > 0.95 && e.aabbMinY < JAR.dangerY) anyDanger = true;
    }

    if (anyDanger) {
      gameState.dangerDuration += dt;
      if (gameState.dangerDuration > 3.2) {
        if (gameState.mode === 'rush') triggerRushEmergencyGust();
        else triggerGameOver();
      }
    } else {
      gameState.dangerDuration = Math.max(0, gameState.dangerDuration - dt * 2.2);
    }

    const overflowDanger = Math.max(0, Math.min(1, (gameState.dangerDuration - 0.45) / 2.6));
    const rushDanger =
      gameState.mode === 'rush' && gameState.rushTimer <= 15.0
        ? Math.min(1, 0.35 + ((15.0 - gameState.rushTimer) / 15.0) * 0.65)
        : 0;
    audio.setDangerLevel(Math.max(overflowDanger, rushDanger));
  }

  function updateDessertAnimations(dt) {
    if (gameState.curMeta && gameState.curMeta.wildcard) {
      gameState.heldActionAnim = null;
    } else if (gameState.heldActionAnim) {
      gameState.heldActionAnim.t += dt;
      if (gameState.heldActionAnim.t >= gameState.heldActionAnim.dur) gameState.heldActionAnim = null;
    } else if (gameState.dropCooldown <= 0 && !gameState.activeToolMode) {
      gameState.heldActionCooldown -= dt;
      if (gameState.heldActionCooldown <= 0) {
        gameState.heldActionAnim = { kind: 'solo', t: 0, dur: 1.1 };
        gameState.heldActionCooldown = 2.6 + Math.random() * 2.2;
      }
    }

    const entities = gameState.entities;
    let activeAnimCount = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.isWildcard || e.isYarnBall || e.frozenHp > 0) {
        e.anim = null;
        continue;
      }
      if (e.anim) {
        e.anim.t += dt;
        if (e.anim.t >= e.anim.dur) e.anim = null;
        else activeAnimCount++;
      }
    }

    const neighborMap = new Map();
    const addPair = (a, b, cx, cy) => {
      if (
        !a ||
        !b ||
        a.id === b.id ||
        a.merged ||
        b.merged ||
        a.isWildcard ||
        b.isWildcard ||
        a.isYarnBall ||
        b.isYarnBall ||
        a.frozenHp > 0 ||
        b.frozenHp > 0
      ) {
        return;
      }
      if (!neighborMap.has(a.id)) neighborMap.set(a.id, []);
      if (!neighborMap.has(b.id)) neighborMap.set(b.id, []);
      const listA = neighborMap.get(a.id);
      if (!listA.some((item) => item.neighbor.id === b.id)) listA.push({ neighbor: b, cx, cy });
      const listB = neighborMap.get(b.id);
      if (!listB.some((item) => item.neighbor.id === a.id)) listB.push({ neighbor: a, cx, cy });
    };

    const contacts = gameState.lastDebugContacts || [];
    for (let i = 0; i < contacts.length; i++) {
      const ct = contacts[i];
      if (ct.a && ct.a.id > 0 && ct.b && ct.b.id > 0) addPair(ct.a, ct.b, ct.px, ct.py);
    }

    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (a.isWildcard || a.isYarnBall || a.frozenHp > 0) continue;
      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (b.isWildcard || b.isYarnBall || b.frozenHp > 0) continue;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist <= (a.r + b.r) * 1.09 && dist > 1e-3) {
          addPair(a, b, (a.x * b.r + b.x * a.r) / (a.r + b.r), (a.y * b.r + b.y * a.r) / (a.r + b.r));
        }
      }
    }

    const styles = ['nuzzle', 'boop', 'chat'];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.anim || e.merged || e.isWildcard || e.isYarnBall || e.frozenHp > 0) continue;
      e.interactCooldown -= dt;
      e.soloCooldown -= dt;
      const settled = Math.hypot(e.vx, e.vy) < 75 && Math.abs(e.vr) < 2.4 && e.age > 0.35;
      if (!settled) continue;

      if (e.interactCooldown <= 0) {
        const nbs = neighborMap.get(e.id) || [];
        const available = nbs.filter(
          (item) =>
            !item.neighbor.anim &&
            !item.neighbor.merged &&
            !item.neighbor.isWildcard &&
            !item.neighbor.isYarnBall &&
            !(item.neighbor.frozenHp > 0) &&
            Math.hypot(item.neighbor.vx, item.neighbor.vy) < 75 &&
            item.neighbor.age > 0.35
        );
        if (available.length > 0 && activeAnimCount < 6) {
          const pick = available[Math.floor(Math.random() * available.length)];
          const nb = pick.neighbor;
          const dx = nb.x - e.x;
          const dy = nb.y - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const style = styles[Math.floor(Math.random() * styles.length)];
          e.anim = { kind: 'interact', style, t: 0, dur: 1.25, ux, uy, cx: pick.cx, cy: pick.cy, isLeader: true };
          nb.anim = { kind: 'interact', style, t: 0, dur: 1.25, ux: -ux, uy: -uy, cx: pick.cx, cy: pick.cy, isLeader: false };
          applyDirectionalSquish(e, ux, uy, 210);
          applyDirectionalSquish(nb, -ux, -uy, 210);
          e.interactCooldown = 3.2 + Math.random() * 4.0;
          nb.interactCooldown = 3.2 + Math.random() * 4.0;
          e.soloCooldown = Math.max(e.soloCooldown, 1.8);
          nb.soloCooldown = Math.max(nb.soloCooldown, 1.8);
          activeAnimCount += 2;
          continue;
        } else {
          e.interactCooldown = 0.8 + Math.random() * 1.3;
        }
      }

      if (e.soloCooldown <= 0) {
        if (activeAnimCount < 6) {
          e.anim = { kind: 'solo', t: 0, dur: 1.15 };
          e.soloCooldown = 3.0 + Math.random() * 4.2;
          activeAnimCount += 1;
        } else {
          e.soloCooldown = 0.7 + Math.random() * 1.0;
        }
      }
    }
  }

  function computePermanentStardustSettlement(isPreview = false) {
    const dustMult = getDustMultiplier();
    const souffleBonus = gameState.soufflesMadeThisRun > 0 ? 25 : 0;
    const parts = [];
    let rawEarned = 0;

    if (gameState.mode === 'chef') {
      const shiftsCleared = gameState.shiftsClearedThisRun || 0;
      const shiftPart = shiftsCleared * 22;
      const revPart = Math.floor(gameState.score / 480);
      const clear5Bonus = shiftsCleared >= 5 ? 40 : 0;
      rawEarned = shiftPart + revPart + souffleBonus + clear5Bonus;
      if (gameState.score >= 600 && rawEarned < 6) {
        rawEarned = 6;
        parts.push('认真营业保底 6⭐');
      } else {
        if (shiftPart > 0) parts.push(`过关${shiftsCleared}幕+${shiftPart}`);
        parts.push(`营业额+${revPart}`);
        if (souffleBonus > 0) parts.push(`猫神+${souffleBonus}`);
        if (clear5Bonus > 0) parts.push(`5幕完赛+${clear5Bonus}`);
      }
    } else {
      const scorePart = Math.floor(gameState.score / 280);
      const dustPart = gameState.score >= 400 ? Math.min(12, Math.floor(gameState.stardust * 0.2)) : 0;
      const rushBonus = gameState.mode === 'rush' && gameState.rushFinished && gameState.score >= 1200 ? 10 : 0;
      rawEarned = scorePart + dustPart + souffleBonus + rushBonus;
      parts.push(`得分+${scorePart}`);
      if (dustPart > 0) parts.push(`余露折算+${dustPart}`);
      if (souffleBonus > 0) parts.push(`猫神+${souffleBonus}`);
      if (rushBonus > 0) parts.push(`狂欢完赛+${rushBonus}`);
    }
    if (dustMult > 1 && rawEarned > 0) parts.push(`糖霜壶×${dustMult.toFixed(2).replace(/0$/, '')}`);
    const finalEarned = Math.round(rawEarned * dustMult);
    const nextBank = isPreview ? (saveData.bankStardust || 0) + finalEarned : saveData.bankStardust || 0;
    return { finalEarned, parts, nextBank };
  }

  function triggerGameOver(reason = 'overflow') {
    if (gameState.over) return;
    gameState.over = true;
    gameState.running = false;
    gameState.paused = false;
    gameState.runEndReason = reason;
    gameState.longPressServe = null;
    resetAimingState();
    cancelToolMode();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    if (reason === 'victory') audio.playShiftClear();
    else audio.playGameOver();

    const bestBefore = app.getBestScore();
    const isNewBest = gameState.score > 0 && gameState.score >= bestBefore;
    setBestScore(gameState.score);

    const calc = computePermanentStardustSettlement(false);
    const finalEarned = calc.finalEarned;

    saveData.bankStardust = (saveData.bankStardust || 0) + finalEarned;
    saveData.totalEarnedStardust = (saveData.totalEarnedStardust || 0) + finalEarned;
    saveData.lifetimeStats.runsPlayed = (saveData.lifetimeStats.runsPlayed || 0) + 1;
    saveData.lifetimeStats.ordersCompleted = (saveData.lifetimeStats.ordersCompleted || 0) + gameState.ordersCompleted;
    saveData.lifetimeStats.maxComboEver = Math.max(saveData.lifetimeStats.maxComboEver || 1, gameState.maxCombo);
    if (gameState.mode === 'chef') {
      saveData.lifetimeStats.bestShiftReached = Math.max(saveData.lifetimeStats.bestShiftReached || 0, gameState.shift);
    }

    pendingRunReport = {
      mode: gameState.mode,
      score: gameState.score,
      shiftsCleared: gameState.shiftsClearedThisRun || 0,
      drops: gameState.dropsMadeThisRun || 0,
      durationSec: Math.max(1, Math.round((Date.now() - (gameState.runStartedAt || Date.now() - 8000)) / 1000))
    };
    clearActiveRunCheckpoint(gameState.mode, false);
    persistSaveData({ immediate: true });

    app.goSettlement = {
      reason,
      isNewBest,
      finalEarned,
      detailText: `${calc.parts.join(' · ')} → 余额 ${saveData.bankStardust} 星尘`,
      hasAffordable: hasAffordableShopItem()
    };
    app.openModal('gameover');
  }

  function spawnStarterBoard(mode) {
    if (mode === 'zen') return;
    // Pre-populate 4 settled starter treats so Turn 1 immediately has merge/bank-shot/serve decisions!
    const layout = [
      { tier: 2, x: 112, y: 446 },
      { tier: 1, x: 184, y: 468 },
      { tier: 3, x: 254, y: 454 },
      { tier: 2, x: 328, y: 446 }
    ];
    for (const item of layout) {
      createEntity(item.tier, item.x, item.y, 0, 0, false, 0, 0, { preSettled: true });
    }
  }

  function startNewRunFn(mode = gameState.mode, opts = {}) {
    const preserveCheckpoint = !!(opts && opts.preserveCheckpoint);
    if (!preserveCheckpoint) {
      if (!app.isLobbyOpen && gameState.running && !gameState.over && gameState.mode !== mode) {
        saveActiveRunCheckpoint({ syncCloud: false });
      }
      clearActiveRunCheckpoint(mode, false);
    }
    gameState.mode = mode;
    gameState.running = true;
    gameState.paused = false;
    gameState.over = false;
    gameState.runEndReason = null;
    gameState.runStartedAt = Date.now();
    gameState.score = 0;
    gameState.displayScore = 0;
    gameState.stardust = 30;
    gameState.dropsMadeThisRun = 0;
    gameState.soufflesMadeThisRun = 0;
    gameState.yarnBrokenThisRun = 0;
    gameState.iceShatteredThisRun = 0;
    gameState.glazeHitsThisRun = 0;
    gameState.servesCompleted = 0;
    gameState.bankShotsLanded = 0;
    gameState.serveCascadeTimer = 0;
    gameState.serveCascadeMerges = 0;
    gameState.cascadeStaleRefundPending = false;
    gameState.maxAvalancheRun = 0;
    gameState.mikanFirstServeUsed = false;
    gameState.quickOrdersCompleted = 0;
    gameState.longPressServe = null;

    // Reset 5-Shift Roguelike state
    gameState.shift = 1;
    gameState.shiftHazards = [];
    gameState.shiftsClearedThisRun = 0;
    gameState.shiftRevenue = 0;
    gameState.displayShiftRevenue = 0;
    gameState.shiftTarget = SHIFTS[0].target;
    gameState.stepsMax = SHIFTS[0].steps;
    gameState.stepsLeft = SHIFTS[0].steps;
    gameState.shiftStepsUsed = 0;
    gameState.shiftStepRefunds = 0;
    gameState.shiftClearedFlag = false;
    gameState.shiftResolveDelay = 0;
    gameState.relics = [];
    gameState.deckMods = {
      mod_trim_t1: 0,
      mod_boost_t3: 0,
      mod_gold_tray: 0,
      mod_rainbow: 0,
      mod_steps: 0,
      mod_tool: 0
    };
    gameState.nextShiftBonusSteps = 0;
    gameState.antigravDropCounter = 0;
    gameState.antigravTimer = 0;
    gameState.globalResonanceTimer = 0;
    gameState.obstacles = [];
    gameState.prepShop = null;
    gameState.victoryOffer = null;

    const upDustLv = app.getUpgradeLevel('up_dust');
    const upDustDef = SHOP_UPGRADES.find((u) => u.id === 'up_dust');
    const dustStartCoins = (upDustDef && upDustDef.startCoins && upDustDef.startCoins[upDustLv]) || 0;
    const mikanStartCoins = saveData.selectedPatron === 'mikan' ? 12 : 0;
    gameState.coins = mode === 'chef' ? mikanStartCoins + dustStartCoins : 0;

    const upFeverLv = app.getUpgradeLevel('up_fever');
    const startEnergy = SHOP_UPGRADES.find((u) => u.id === 'up_fever').values[upFeverLv] || 0;
    gameState.feverEnergy = startEnergy;
    gameState.feverTimer = 0;
    gameState.feverMaxDuration = 10.0;
    gameState.feverBonusUsed = 0;

    gameState.skillEnergy = startEnergy;
    gameState.stepSkillGain = 0;
    gameState.activeSkillMode = null;
    gameState.swapFirstEntityId = null;
    gameState.nextShotMeteor = false;

    gameState.comboCount = 0;
    gameState.comboTimer = 0;
    gameState.comboRainbowGranted = false;
    gameState.maxCombo = 1;
    gameState.ordersCompleted = 0;
    gameState.maxTierRun = 4;
    gameState.seenThisRun = new Set([1, 2, 3, 4]);

    const upToolsLv = app.getUpgradeLevel('up_tools');
    const mugiBonusShake = saveData.selectedPatron === 'mugi' ? 1 : 0;
    gameState.tools = {
      shake: 2 + (upToolsLv >= 1 ? 1 : 0) + (upToolsLv >= 3 ? 1 : 0) + mugiBonusShake,
      spoon: 1 + (upToolsLv >= 2 ? 1 : 0)
    };

    gameState.activeToolMode = null;
    gameState.dropX = LAUNCH_X;
    gameState.prevDropX = LAUNCH_X;
    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.aim = {
      active: false,
      mode: 'sling',
      anchorX: LAUNCH_X,
      anchorY: LAUNCH_Y,
      curX: LAUNCH_X,
      curY: 180,
      power: FIXED_TURRET_POWER,
      launchVx: 0,
      launchVy: FIXED_TURRET_BASE_SPEED,
      angle: 0,
      cancelled: false,
      stretchBand: 0,
      slingLocked: false
    };
    gameState.lastDebugContacts = [];
    gameState.magnetLinks = [];
    gameState.perks = {};
    gameState.pendingBlessings = 0;
    gameState.blessingChoices = [];
    gameState.blessingLastReason = '';
    gameState.blessingSubText = '';
    gameState.blessingLockUntil = 0;

    gameState.zenNextMilestone = 600;
    gameState.rushTimer = 90.0;
    gameState.rushFinished = false;
    gameState.rushGustCooldown = 0;
    gameState.rushNextMilestone = 1200;
    gameState.rushLastTickSec = 6;
    gameState.rushServeStreak = 0;
    gameState.rushStreakTimer = 0;
    gameState.rushMaxStreak = 0;

    gameState.activeEvent = null;
    gameState.lastEventKind = null;
    gameState.nextEventDrops = 10 + Math.floor(Math.random() * 5);
    gameState.nextEventTimer = 18.0;
    gameState.meteorGoldenLeft = 0;
    gameState.shootingStars = [];
    gameState.flyingServes = [];

    gameState.hitstopTimer = 0;
    gameState.screenShake = 0;
    gameState.jarFlash = 0;
    gameState.shockwaves = [];
    gameState.comboBanner = null;
    gameState.dropsUntilRainbow = getRainbowPityBase();
    const firstNext = pickDropBundle(false);
    gameState.curTier = 2; // Starts with bouncy Peach Puff ready to merge or bank-shot!
    gameState.curMeta = { wildcard: false, golden: false };
    gameState.nextTier = firstNext.tier;
    gameState.nextMeta = firstNext.meta;
    gameState.holdTier = null;
    gameState.holdMeta = null;
    gameState.canHoldThisTurn = true;
    gameState.dropCooldown = 0;
    gameState.lastDroppedId = null;
    gameState.dangerDuration = 0;
    gameState.jarShakeAmp = 0;
    gameState.entities = [];
    gameState.particles = [];
    gameState.popups = [];
    gameState.skipCooldown = 0;
    gameState.freeSkipsLeft = 1;
    gameState.lastSkippedIdx = 1;
    gameState.mugiBankCoinHits = 0;

    app.toastCurrent = null;
    app.toastQueue = [];
    app.minorToast = null;
    app.syncToastLegacyFields();
    app.goSettlement = null;
    app.confirmDialog = null;
    app.activeModal = null;
    app.isLobbyOpen = false;
    app.syncAudioMood();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    audio.unlock();

    if (preserveCheckpoint) {
      return;
    }

    if (mode === 'chef') {
      beginShift(1, false);
    } else {
      spawnStarterBoard(mode);
      initOrders();
    }

    const activePatron = app.activePatron;
    if (mode === 'chef') {
      setPatronSpeech(activePatron, activePatron.greet, 5.0);
    } else if (mode === 'rush') {
      setPatronSpeech(activePatron, '90秒弹射狂欢！点【上菜】或长按甜品出餐续时！', 5.0);
    } else {
      setPatronSpeech(activePatron, '悠闲经典开启！拖动瞄准预览折射与异能范围～', 5.0);
    }
  }

  function resumeSavedRunFn(rawSnap) {
    const snap = SaveSync.validateActiveRunSnapshot(rawSnap);
    if (!snap) return false;

    startNewRunFn(snap.mode, { preserveCheckpoint: true });
    const cfg = getShiftConfig(snap.shift || 1);

    gameState.runStartedAt = snap.startedAt || Date.now();
    gameState.score = snap.score || 0;
    gameState.displayScore = gameState.score;
    gameState.stardust = snap.stardust !== undefined ? snap.stardust : 30;
    gameState.shift = snap.shift || 1;
    gameState.shiftName = snap.shiftName || cfg.name;
    gameState.shiftBadge = snap.shiftBadge || cfg.badge;
    gameState.shiftModifier = snap.shiftModifier !== undefined ? snap.shiftModifier : cfg.modifier || null;
    gameState.shiftHazards = Array.isArray(snap.shiftHazards) ? [...snap.shiftHazards] : [];
    gameState.shiftsClearedThisRun = snap.shiftsClearedThisRun || 0;
    gameState.shiftRevenue = snap.shiftRevenue || 0;
    gameState.displayShiftRevenue = gameState.shiftRevenue;
    gameState.shiftTarget = snap.shiftTarget || cfg.target;
    gameState.stepsMax = snap.stepsMax || cfg.steps;
    gameState.stepsLeft = snap.stepsLeft !== undefined ? snap.stepsLeft : gameState.stepsMax;
    gameState.shiftStepsUsed = snap.shiftStepsUsed || 0;
    gameState.shiftStepRefunds = snap.shiftStepRefunds || 0;
    gameState.freeSkipsLeft = snap.freeSkipsLeft !== undefined ? snap.freeSkipsLeft : 1;
    gameState.mugiBankCoinHits = snap.mugiBankCoinHits || 0;
    gameState.mikanFirstServeUsed = !!snap.mikanFirstServeUsed;
    gameState.quickOrdersCompleted = snap.quickOrdersCompleted || 0;
    gameState.dangerDuration = Math.max(0, Math.min(3.1, Number(snap.dangerDuration) || 0));
    gameState.shiftClearedFlag = !!snap.shiftClearedFlag;
    gameState.coins = snap.coins || 0;
    gameState.relics = Array.isArray(snap.relics) ? [...snap.relics] : [];
    gameState.deckMods = { ...gameState.deckMods, ...(snap.deckMods || {}) };
    gameState.nextShiftBonusSteps = snap.nextShiftBonusSteps || 0;
    gameState.antigravDropCounter = snap.antigravDropCounter || 0;
    gameState.dropsMadeThisRun = snap.dropsMadeThisRun || 0;
    gameState.soufflesMadeThisRun = snap.soufflesMadeThisRun || 0;
    gameState.yarnBrokenThisRun = snap.yarnBrokenThisRun || 0;
    gameState.iceShatteredThisRun = snap.iceShatteredThisRun || 0;
    gameState.glazeHitsThisRun = snap.glazeHitsThisRun || 0;
    gameState.servesCompleted = snap.servesCompleted || 0;
    gameState.ordersCompleted = snap.ordersCompleted || 0;
    gameState.bankShotsLanded = snap.bankShotsLanded || 0;
    gameState.maxAvalancheRun = snap.maxAvalancheRun || 0;
    gameState.maxCombo = snap.maxCombo || 1;
    gameState.maxTierRun = snap.maxTierRun || 4;
    gameState.seenThisRun = new Set(Array.isArray(snap.seenThisRun) ? snap.seenThisRun : [1, 2, 3, 4]);
    gameState.skillEnergy = Number(snap.skillEnergy) || 0;
    gameState.nextShotMeteor = !!snap.nextShotMeteor;
    gameState.feverEnergy = Number(snap.feverEnergy) || 0;
    gameState.tools = { ...gameState.tools, ...(snap.tools || {}) };
    gameState.perks = { ...(snap.perks || {}) };
    gameState.pendingBlessings = 0;
    gameState.dropsUntilRainbow = snap.dropsUntilRainbow || getRainbowPityBase();
    gameState.canHoldThisTurn = snap.canHoldThisTurn !== false;
    gameState.curTier = snap.curTier || 2;
    gameState.curMeta = { wildcard: false, golden: false, ...(snap.curMeta || {}) };
    gameState.nextTier = snap.nextTier || 1;
    gameState.nextMeta = { wildcard: false, golden: false, ...(snap.nextMeta || {}) };
    gameState.holdTier = snap.holdTier || null;
    gameState.holdMeta = snap.holdMeta ? { ...snap.holdMeta } : null;
    gameState.zenNextMilestone = snap.zenNextMilestone || 600;
    gameState.rushTimer = Math.max(5.0, Number(snap.rushTimer) || 90.0);
    gameState.rushNextMilestone = snap.rushNextMilestone || 1200;
    gameState.activeEvent = snap.activeEvent ? { ...snap.activeEvent } : null;

    syncObstaclesForShift();

    gameState.entities = [];
    for (const e of snap.entities) {
      if (e.isYarnBall) {
        const yb = createYarnBallEntity(e.x, e.y);
        yb.vx = 0;
        yb.vy = 0;
        yb.vr = 0;
        yb.yarnHp = e.yarnHp || 2;
        yb.age = 1.0;
      } else {
        const ent = createEntity(e.tier || 1, e.x, e.y, 0, 0, false, e.angle || 0, 0, {
          wildcard: !!e.isWildcard,
          golden: !!e.isGolden,
          frozenHp: e.frozenHp || 0,
          preSettled: true
        });
        ent.agedStacks = e.agedStacks || 0;
      }
    }

    if (snap.mode !== 'zen' && Array.isArray(snap.orders) && snap.orders.length > 0) {
      gameState.orders = snap.orders.map((o) => ({
        uid: o.uid || `ord_res_${Math.random().toString(36).slice(2, 7)}`,
        kind: o.kind || 'quick',
        slotOrigin: o.slotOrigin || o.kind || 'quick',
        isJudgeRush: !!o.isJudgeRush,
        isStarterBlitz: !!o.isStarterBlitz,
        bonusSteps: o.bonusSteps || 0,
        label: o.label || (o.kind === 'vip' ? 'VIP桌' : '快餐桌'),
        patron: PATRONS.find((p) => p.id === o.patronId) || PATRONS[0],
        slots: (o.slots || []).map((s) => ({ tier: s.tier || 3, done: !!s.done })),
        bonusScore: o.bonusScore || 100,
        rewardDust: o.rewardDust || 12,
        freshSteps: o.freshSteps || 0,
        freshMax: o.freshMax || 6,
        freshMult: o.freshMult || 1.35,
        staleMult: o.staleMult || 1.0,
        completed: !!o.completed
      }));
      gameState.order = gameState.orders[1] || gameState.orders[0] || null;
    } else if (snap.mode !== 'zen') {
      initOrders();
    } else {
      gameState.orders = [];
      gameState.order = null;
    }

    if (snap.resumeModal === 'prep_shop' && snap.prepShop) {
      gameState.prepShop = JSON.parse(JSON.stringify(snap.prepShop));
      gameState.paused = true;
      app.openModal('prep_shop');
    } else if (snap.resumeModal === 'shift_victory' && snap.victoryOffer) {
      gameState.victoryOffer = JSON.parse(JSON.stringify(snap.victoryOffer));
      gameState.paused = true;
      app.openModal('shift_victory');
    } else {
      app.activeModal = null;
      gameState.paused = false;
      app.syncAudioMood();
    }

    setPatronSpeech(app.activePatron, `欢迎回来！第 ${gameState.shift} 幕热炉已就绪～`, 4.5);
    return true;
  }

  // Tool & Active Chef Skill Canvas Targeting Click (prefers exact hit & closest center in crowded jars)
  function findEntityAt(x, y, pad = 7) {
    let bestStrict = null;
    let bestStrictDist = Infinity;
    let bestPadded = null;
    let bestPaddedDist = Infinity;
    for (let i = gameState.entities.length - 1; i >= 0; i--) {
      const e = gameState.entities[i];
      if (e.merged) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= e.r || Physics.pointInBody(e, x, y, 0)) {
        if (d < bestStrictDist) {
          bestStrictDist = d;
          bestStrict = e;
        }
        continue;
      }
      if (pad > 0 && (d <= e.r + pad * 0.7 || Physics.pointInBody(e, x, y, pad))) {
        if (d < bestPaddedDist) {
          bestPaddedDist = d;
          bestPadded = e;
        }
      }
    }
    return bestStrict || bestPadded;
  }

  function handleSkillCanvasClick(lx, ly) {
    const target = findEntityAt(lx, ly, 10);
    if (!target) {
      app.showToast('请点罐内甜品目标', { icon: 'icon_warn', tone: 'warn' });
      return;
    }
    if (target.isYarnBall) {
      app.showToast('毛线球需周边合成2次或摇罐震碎', { icon: 'yarn_ball', tone: 'warn' });
      return;
    }
    if (target.frozenHp > 0) {
      app.showToast('冰封甜品需先破冰', { icon: 'icon_frost', tone: 'warn' });
      return;
    }

    if (gameState.activeSkillMode === 'scoop') {
      if (target.isWildcard || target.tier > 5) {
        app.showToast('金勺捞底限选 1~5 阶甜品', { icon: 'tool_spoon', tone: 'warn' });
        return;
      }
      gameState.skillEnergy = 0;
      gameState.entities = gameState.entities.filter((e) => e.id !== target.id);
      wakeNeighborsAfterRemoval(target.x, target.y, target.r);
      startCascadeWindow(target.x, target.y);

      // Preserve current held treat into HOLD if empty, or push into NEXT so zero treats are ever lost!
      if (gameState.holdTier === null) {
        gameState.holdTier = gameState.curTier;
        gameState.holdMeta = { ...gameState.curMeta };
      } else {
        gameState.nextTier = gameState.curTier;
        gameState.nextMeta = { ...gameState.curMeta };
      }
      gameState.curTier = target.tier;
      gameState.curMeta = { wildcard: false, golden: !!target.isGolden };
      clampDropX();

      audio.playChefSkill('mikan');
      platform.vibrateShort('medium');
      spawnSparkleBurst(target.x, target.y, '#ffe47a', 24);
      spawnShockwave(target.x, target.y, target.r * 2.2 + 30, '#ffe47a', 3.6);
      spawnPopup(target.x, target.y - 14, '金勺捞底', '#ffe680', 18);
      showComboBanner('金勺捞底发动', '触发抽底雪崩 · 甜品已捞回', '#ffe47a', 'tool_spoon', 2);
      cancelToolMode();
      return;
    }

    if (gameState.activeSkillMode === 'swap_1') {
      gameState.swapFirstEntityId = target.id;
      gameState.activeSkillMode = 'swap_2';
      audio.playTilt();
      spawnShockwave(target.x, target.y, target.r + 20, '#d8b4ff', 2.8);
      app.showToast(`已选${target.isWildcard ? '彩虹糖' : TIERS[target.tier - 1].name} · 再点第2颗`, {
        icon: 'icon_moon',
        tone: 'info'
      });
      return;
    }

    if (gameState.activeSkillMode === 'swap_2') {
      const first = gameState.entities.find((e) => e.id === gameState.swapFirstEntityId && !e.merged && !(e.frozenHp > 0));
      if (!first) {
        gameState.activeSkillMode = 'swap_1';
        gameState.swapFirstEntityId = null;
        return;
      }
      if (target.id === first.id) {
        app.showToast('请点另一颗甜品互换', { icon: 'icon_moon', tone: 'warn' });
        return;
      }

      gameState.skillEnergy = 0;
      const fx = first.x;
      const fy = first.y;
      first.x = target.x;
      first.y = target.y;
      target.x = fx;
      target.y = fy;
      first.vx *= 0.2;
      first.vy = -45;
      target.vx *= 0.2;
      target.vy = -45;
      Physics.clampBodyInsideJarPositional(first, JAR, gameState.obstacles);
      Physics.clampBodyInsideJarPositional(target, JAR, gameState.obstacles);
      gameState.globalResonanceTimer = Math.max(gameState.globalResonanceTimer, 2.0);

      audio.playChefSkill('luna');
      platform.vibrateShort('medium');
      spawnSparkleBurst(first.x, first.y, '#d8b4ff', 20);
      spawnSparkleBurst(target.x, target.y, '#ffe47a', 20);
      spawnShockwave(first.x, first.y, first.r + 36, '#d8b4ff', 3.4);
      spawnShockwave(target.x, target.y, target.r + 36, '#ffe47a', 3.4);
      spawnPopup((first.x + target.x) * 0.5, Math.min(first.y, target.y) - 16, '星月移形', '#e5caff', 18);
      showComboBanner('星月移形', '位置对调 · 2秒全罐柔磁', '#d8b4ff', 'icon_moon', 2);
      cancelToolMode();
    }
  }

  function handleToolCanvasClick(lx, ly) {
    const target = findEntityAt(lx, ly);
    if (!target) {
      app.showToast('请点罐内甜品', { icon: 'icon_warn', tone: 'warn' });
      return;
    }
    if (target.isYarnBall) {
      app.showToast('毛线球需周边合成2次或摇罐震碎', { icon: 'yarn_ball', tone: 'warn' });
      return;
    }
    if (target.frozenHp > 0) {
      app.showToast('冰封甜品需先破冰', { icon: 'icon_frost', tone: 'warn' });
      return;
    }

    if (gameState.activeToolMode === 'spoon') {
      if (target.isWildcard) {
        app.showToast('彩虹糖碰触即升阶，无需升阶勺', { icon: 'icon_rainbow', tone: 'warn' });
        return;
      }
      if (target.tier >= 9) {
        app.showToast('已达最高阶，可点献礼胶囊或长按献礼', { icon: 'icon_crown', tone: 'info' });
        return;
      }
      if (gameState.tools.spoon <= 0) return;
      gameState.tools.spoon--;
      const nextTier = target.tier + 1;
      const def = TIERS[nextTier - 1];
      target.tier = nextTier;
      target.creditedToOrder = false;
      Physics.configureBodyShape(target, getShapeDef(nextTier), def.radius, def.material);
      Physics.clampBodyInsideJarPositional(target, JAR, gameState.obstacles);
      target.squishAmt = 0.24;
      target.squishVel = 0;
      target.squishAngle = Math.PI * 0.5;

      const pts = Math.round(def.points * app.getFeverMultiplier() * app.getGlobalRevenueMult());
      addScore(pts);
      unlockTier(nextTier);
      if (nextTier === 9) {
        gameState.soufflesMadeThisRun++;
        saveData.lifetimeStats.soufflesMade = (saveData.lifetimeStats.soufflesMade || 0) + 1;
        persistSaveData();
      }
      audio.playTool('spoon');
      spawnSparkleBurst(target.x, target.y, '#ffe16e', 22);
      spawnShockwave(target.x, target.y, target.r * 2.0, '#ffe16e', 3.4);
      spawnPopup(target.x, target.y - target.r * 0.5, `升阶 +${pts}`, '#ffe470', 17);
      triggerDessertTrait(target, target.x, target.y);
      notifyTreatSynthesized(nextTier, target);
      cancelToolMode();
    }
  }

  // Unified Pointer & Touch Event Handling (Fixed-Center Turret Angle Aim + Long-Press-to-Serve Arbitration)
  let pendingUiHit = null;
  let uiDragMoved = false;
  let dragStartPos = { x: 0, y: 0, lastY: 0, active: false };
  let aimingState = { active: false, pointerType: 'touch', lastStableX: 220 };

  function toJarLogical(x, y) {
    const b = app.lastJarBox || { x: 0, y: 0, scale: 1 };
    return {
      lx: (x - b.x) / Math.max(0.1, b.scale),
      ly: (y - b.y) / Math.max(0.1, b.scale)
    };
  }

  function updateAimVector(lx, ly, pointerType) {
    const aim = gameState.aim;
    clampDropX();
    aim.anchorX = LAUNCH_X;
    aim.anchorY = LAUNCH_Y;
    aim.curX = lx;
    aim.curY = ly;
    const cancelled = pointerType === 'touch' && ly < JAR.neckY - 20;
    aim.cancelled = cancelled;
    gameState.touchAim.cancelled = cancelled;

    const dx = lx - LAUNCH_X;
    const dy = Math.max(16, ly - LAUNCH_Y);
    const rawAng = Math.abs(dx) < 5 ? 0 : Math.atan2(dx, dy);
    const shot = syncIdleAimFromAngle(rawAng);

    aim.mode = 'sling';
    aim.slingLocked = true;

    const angleBand = Math.min(4, Math.floor(Math.abs(shot.angle) / 0.26));
    if (angleBand !== aim.stretchBand && aimingState.active && !cancelled) {
      aim.stretchBand = angleBand;
      if (angleBand > 0) {
        audio.playSlingStretch(0.35 + angleBand * 0.14);
      }
    }
  }

  function resetAimingState() {
    aimingState.active = false;
    gameState.longPressServe = null;
    gameState.aim.active = false;
    gameState.aim.cancelled = false;
    gameState.aim.stretchBand = 0;
    gameState.aim.slingLocked = false;
    gameState.touchAim.active = false;
    gameState.touchAim.cancelled = false;
  }

  platform.bindPointerEvents(canvas, {
    onDown: ({ x, y, pointerType }) => {
      audio.unlock();
      const hit = hits.findAt(x, y);
      dragStartPos = { x, y, lastY: y, active: true };
      uiDragMoved = false;
      pendingUiHit = hit;
      gameState.longPressServe = null;

      if (app.activeModal || hit) {
        return;
      }

      if (!app.isLobbyOpen && gameState.running && !gameState.over && !gameState.paused) {
        const { lx, ly } = toJarLogical(x, y);
        if (gameState.activeSkillMode) {
          handleSkillCanvasClick(lx, ly);
          return;
        }
        if (gameState.activeToolMode) {
          handleToolCanvasClick(lx, ly);
          return;
        }
        if (ly >= -30 && ly <= JAR.floorY + 24 && lx >= -30 && lx <= JAR.canvasW + 30) {
          // Arm fixed-center turret aiming everywhere in the jar AND arm optional long-press serve if holding still on a servable treat!
          clampDropX();
          aimingState = { active: true, pointerType, lastStableX: LAUNCH_X };
          gameState.aim.active = true;
          gameState.aim.stretchBand = 0;
          if (pointerType === 'touch') {
            gameState.touchAim.active = true;
            gameState.touchAim.lastStableX = LAUNCH_X;
          }
          updateAimVector(lx, ly, pointerType);

          const servable = findServableEntityAt(lx, ly, 12);
          if (servable) {
            const holdDur = servable.tier === 9 ? 0.45 : 0.32;
            gameState.longPressServe = {
              entityId: servable.id,
              tier: servable.tier,
              downLx: lx,
              downLy: ly,
              pointerType,
              elapsed: 0,
              duration: holdDur,
              progress: 0
            };
          }
        }
      }
    },

    onMove: ({ x, y, pointerType }) => {
      if (dragStartPos.active && Math.hypot(x - dragStartPos.x, y - dragStartPos.y) > 7) {
        uiDragMoved = true;
      }
      if (app.activeModal) {
        if (dragStartPos.active && app.modalMaxScroll > 0) {
          const dy = y - dragStartPos.lastY;
          if (uiDragMoved) {
            app.modalScrollY = Math.max(0, Math.min(app.modalMaxScroll, app.modalScrollY - dy));
          }
        }
        dragStartPos.lastY = y;
        return;
      }

      if (!app.isLobbyOpen && gameState.running && !gameState.over && !gameState.paused) {
        const { lx, ly } = toJarLogical(x, y);
        if (gameState.activeToolMode || gameState.activeSkillMode) {
          const hitEntity = findEntityAt(lx, ly);
          gameState.hoveredEntityId = hitEntity ? hitEntity.id : null;
          return;
        }
        // Dragging >= 10px cancels long-press-to-serve and continues smooth turret angle aiming
        if (gameState.longPressServe) {
          if (Math.hypot(lx - gameState.longPressServe.downLx, ly - gameState.longPressServe.downLy) >= 10) {
            gameState.longPressServe = null;
          }
        }
        if (aimingState.active) {
          updateAimVector(lx, ly, pointerType);
        } else if (pointerType === 'mouse' && lx >= 0 && lx <= JAR.canvasW && ly >= JAR.neckY && ly <= JAR.floorY + 12) {
          // Smooth constant-speed turret preview when hovering inside the jar on desktop
          const dx = lx - LAUNCH_X;
          const dy = Math.max(18, ly - LAUNCH_Y);
          const rawAng = Math.abs(dx) < 5 ? 0 : Math.atan2(dx, dy);
          syncIdleAimFromAngle(rawAng);
        }
      }
    },

    onUp: ({ x, y, pointerType }) => {
      dragStartPos.active = false;
      if (app.activeModal) {
        if (!uiDragMoved && pendingUiHit) {
          if (pendingUiHit.id === 'modal_backdrop') {
            if (app.activeModal === 'mode_guide') {
              app.nextModeGuideStep();
            } else if (
              app.activeModal !== 'gameover' &&
              app.activeModal !== 'prep_shop' &&
              app.activeModal !== 'shift_victory' &&
              app.activeModal !== 'pause' &&
              app.activeModal !== 'confirm'
            ) {
              app.closeModal();
            }
          } else if (pendingUiHit.onClick) {
            pendingUiHit.onClick();
          }
        }
        pendingUiHit = null;
        return;
      }

      if (pendingUiHit) {
        if (!uiDragMoved && pendingUiHit.onClick) {
          pendingUiHit.onClick();
        }
        pendingUiHit = null;
        resetAimingState();
        return;
      }

      // Quick tap (< 0.32s) cancels unfinished long-press and fires turret shot normally (zero misfire!)
      gameState.longPressServe = null;

      if (aimingState.active) {
        const { lx, ly } = toJarLogical(x, y);
        const cancelled = pointerType === 'touch' && (gameState.aim.cancelled || ly < JAR.neckY - 20);
        if (!cancelled) {
          updateAimVector(lx, ly, pointerType);
        }
        const vx = gameState.aim.launchVx;
        const vy = gameState.aim.launchVy;
        const isAngled = Math.abs(gameState.aim.angle) >= 0.155;
        resetAimingState();
        if (cancelled) return;
        dropCurrentTreat(vx, vy, isAngled);
      }
    },

    onCancel: () => {
      dragStartPos.active = false;
      pendingUiHit = null;
      resetAimingState();
    },

    onWheel: (_x, _y, deltaY) => {
      if (app.activeModal && app.modalMaxScroll > 0) {
        app.modalScrollY = Math.max(0, Math.min(app.modalMaxScroll, app.modalScrollY + deltaY * 0.6));
        return;
      }
      if (!app.isLobbyOpen && gameState.running && !gameState.over && !gameState.paused && !gameState.activeToolMode && !gameState.activeSkillMode) {
        adjustAimAngle(deltaY > 0 ? 0.09 : -0.09);
      }
    }
  });

  // Keyboard support for DevTools / PC Mini Game (Left/Right/A/D/Q/E all adjust center launch angle!)
  platform.bindKeyboard((key, ev) => {
    audio.unlock();
    if (key === 'm' || key === 'M') {
      if (ev && ev.preventDefault) ev.preventDefault();
      app.cycleBgm();
      return;
    }
    if (key === 'Escape') {
      if (app.activeModal && app.activeModal !== 'gameover') {
        app.closeModal();
        return;
      }
      if (gameState.activeToolMode || gameState.activeSkillMode) {
        cancelToolMode();
        return;
      }
      if (!app.isLobbyOpen && gameState.running && !gameState.over) {
        app.togglePause();
      }
      return;
    }
    if (key === 'p' || key === 'P') {
      if (!app.isLobbyOpen) {
        if (ev && ev.preventDefault) ev.preventDefault();
        app.toggleDebugPhysics();
      }
      return;
    }
    if (app.activeModal === 'confirm') {
      if (key === 'Enter') {
        if (ev && ev.preventDefault) ev.preventDefault();
        app.confirmAccept();
      }
      return;
    }
    if (!gameState.running || gameState.over || app.isLobbyOpen) return;
    if (app.activeModal === 'mode_guide') {
      if (key === ' ' || key === 'Enter' || key === 'ArrowRight') {
        if (ev && ev.preventDefault) ev.preventDefault();
        app.nextModeGuideStep();
      }
      return;
    }
    if (app.activeModal) return;

    if (key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'q' || key === 'Q') {
      if (ev && ev.preventDefault) ev.preventDefault();
      adjustAimAngle(-0.1);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D' || key === 'e' || key === 'E') {
      if (ev && ev.preventDefault) ev.preventDefault();
      adjustAimAngle(0.1);
    } else if (key === 'r' || key === 'R') {
      if (ev && ev.preventDefault) ev.preventDefault();
      clampDropX();
      syncIdleAimFromAngle(0);
      audio.playTilt();
    } else if (key === 's' || key === 'S') {
      if (ev && ev.preventDefault) ev.preventDefault();
      app.serveReadyOrder();
    } else if (key === ' ' || key === 'ArrowDown' || key === 'Enter') {
      if (ev && ev.preventDefault) ev.preventDefault();
      const shot = computeTurretShotFromAngle(gameState.aimAngle);
      dropCurrentTreat(shot.launchVx, shot.launchVy, shot.isAngled);
    } else if (key === 'h' || key === 'H' || key === 'c' || key === 'C' || key === 'Shift') {
      if (ev && ev.preventDefault) ev.preventDefault();
      app.swapHoldPocket();
    } else if (key === '1') app.armOrUseTool('shake');
    else if (key === '2' || key === 'f' || key === 'F') app.activateChefSkill();
    else if (key === '3') app.armOrUseTool('spoon');
  });

  // Main Animation Loop
  let lastFrameMs = Date.now();
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(() => fn(Date.now()), 16);

  function computeNearOrderSubTiers() {
    if (gameState.mode === 'zen' || !gameState.orders || gameState.orders.length === 0) return [];
    const neededByTier = {};
    for (let oi = 0; oi < gameState.orders.length; oi++) {
      const ord = gameState.orders[oi];
      if (!ord || ord.completed) continue;
      for (let si = 0; si < ord.slots.length; si++) {
        const sl = ord.slots[si];
        if (!sl.done && sl.tier >= 2) {
          neededByTier[sl.tier] = (neededByTier[sl.tier] || 0) + 1;
        }
      }
    }
    const readyCounts = {};
    let hasWildcardInJar = false;
    for (let i = 0; i < gameState.entities.length; i++) {
      const e = gameState.entities[i];
      if (!e || e.merged || e.isYarnBall || e.frozenHp > 0) continue;
      if (e.isWildcard) {
        hasWildcardInJar = true;
      } else {
        readyCounts[e.tier] = (readyCounts[e.tier] || 0) + 1;
      }
    }
    const curWild = !!(gameState.curMeta && gameState.curMeta.wildcard);
    const holdWild = !!(gameState.holdMeta && gameState.holdMeta.wildcard);
    const out = [];
    for (const tierKey of Object.keys(neededByTier)) {
      const targetTier = Number(tierKey);
      const needed = neededByTier[targetTier] || 0;
      const ready = readyCounts[targetTier] || 0;
      if (needed <= ready) continue;
      const sub = targetTier - 1;
      const subInJar = readyCounts[sub] || 0;
      const handMatches =
        curWild ||
        holdWild ||
        gameState.curTier === sub ||
        gameState.holdTier === sub ||
        hasWildcardInJar;
      if (subInJar >= 2 || (subInJar >= 1 && handMatches)) {
        if (!out.includes(sub)) out.push(sub);
      }
    }
    return out;
  }

  let mainLoopErrorLogged = false;
  function runFrame() {
    const nowMs = Date.now();
    const dt = Math.max(0.001, Math.min(0.033, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;
    const nowSec = nowMs / 1000;

    if (app.toastCurrent) {
      app.toastCurrent.timer = Math.max(0, app.toastCurrent.timer - dt);
      if (app.toastCurrent.timer <= 0) {
        app.toastCurrent = app.toastQueue.length > 0 ? app.toastQueue.shift() : null;
      }
    } else if (app.toastQueue.length > 0) {
      app.toastCurrent = app.toastQueue.shift();
    }
    if (app.minorToast) {
      app.minorToast.timer = Math.max(0, app.minorToast.timer - dt);
      if (app.minorToast.timer <= 0) app.minorToast = null;
    }
    app.syncToastLegacyFields();

    if (app.lobbyBounceT > 0) {
      app.lobbyBounceT += dt * 1.8;
      if (app.lobbyBounceT >= 1) app.lobbyBounceT = 0;
    }

    if (gameState.running && !gameState.over && !gameState.paused) {
      // Advance Long-Press-to-Serve radial hold timer in jar!
      if (gameState.longPressServe) {
        const lp = gameState.longPressServe;
        const lpEnt = gameState.entities.find((e) => e.id === lp.entityId && !e.merged);
        if (!lpEnt || !findServableMatch(lpEnt)) {
          gameState.longPressServe = null;
        } else {
          lp.elapsed += dt;
          lp.progress = Math.min(1, lp.elapsed / Math.max(0.1, lp.duration));
          if (lp.elapsed >= lp.duration) {
            const serveId = lp.entityId;
            resetAimingState();
            serveEntityById(serveId);
          }
        }
      }

      if (gameState.dropCooldown > 0) gameState.dropCooldown = Math.max(0, gameState.dropCooldown - dt);
      if (gameState.rushGustCooldown > 0) gameState.rushGustCooldown = Math.max(0, gameState.rushGustCooldown - dt);
      if (gameState.rushStreakTimer > 0) {
        gameState.rushStreakTimer = Math.max(0, gameState.rushStreakTimer - dt);
        if (gameState.rushStreakTimer === 0) {
          gameState.rushServeStreak = 0;
        }
      }
      gameState.dropSway *= Math.exp(-dt * 11);
      if (Math.abs(gameState.dropSway) < 0.001) gameState.dropSway = 0;

      if (gameState.serveCascadeTimer > 0) {
        gameState.serveCascadeTimer = Math.max(0, gameState.serveCascadeTimer - dt);
        if (gameState.serveCascadeTimer === 0) {
          gameState.serveCascadeMerges = 0;
          gameState.cascadeStaleRefundPending = false;
        }
      }

      if (gameState.antigravTimer > 0) {
        gameState.antigravTimer = Math.max(0, gameState.antigravTimer - dt);
      }
      if (gameState.globalResonanceTimer > 0) {
        gameState.globalResonanceTimer = Math.max(0, gameState.globalResonanceTimer - dt);
      }
      if (gameState.obstacles && gameState.obstacles.length > 0) {
        for (let oi = 0; oi < gameState.obstacles.length; oi++) {
          if (gameState.obstacles[oi].hitFlash > 0) {
            gameState.obstacles[oi].hitFlash = Math.max(0, gameState.obstacles[oi].hitFlash - dt);
          }
        }
      }

      if (gameState.comboTimer > 0) {
        gameState.comboTimer = Math.max(0, gameState.comboTimer - dt);
        if (gameState.comboTimer === 0) {
          gameState.comboCount = 0;
          gameState.comboRainbowGranted = false;
        }
      }
      if (gameState.jarShakeAmp > 0) gameState.jarShakeAmp = Math.max(0, gameState.jarShakeAmp - dt * 1.9);
      if (gameState.skipCooldown > 0) gameState.skipCooldown = Math.max(0, gameState.skipCooldown - dt);

      if (gameState.feverTimer > 0) {
        gameState.feverTimer = Math.max(0, gameState.feverTimer - dt);
        if (gameState.feverTimer === 0) {
          gameState.feverEnergy = 0;
          gameState.feverBonusUsed = 0;
          audio.setFeverMode(false);
          app.showToast('星光狂热结束', { icon: 'icon_moon', tone: 'info' });
        }
      }

      if (gameState.activeEvent) {
        if (gameState.activeEvent.kind === 'yarn') {
          if (!hasYarnBallInJar()) gameState.activeEvent = null;
        } else {
          gameState.activeEvent.timer = Math.max(0, gameState.activeEvent.timer - dt);
          if (gameState.activeEvent.timer <= 0) {
            const endedKind = gameState.activeEvent.kind;
            gameState.activeEvent = null;
            if (endedKind === 'chime') app.showToast('黄金烘焙钟结束', { icon: 'serve_bell', tone: 'info' });
          }
        }
      } else if (gameState.mode === 'rush') {
        gameState.nextEventTimer -= dt;
        if (gameState.nextEventTimer <= 0) {
          gameState.nextEventTimer = 18.0;
          triggerShopEvent();
        }
      }

      if (gameState.mode === 'rush') {
        gameState.rushTimer = Math.max(0, gameState.rushTimer - dt);
        if (gameState.rushTimer <= 5.0 && gameState.rushTimer > 0) {
          const secInt = Math.ceil(gameState.rushTimer);
          if (secInt < gameState.rushLastTickSec) {
            gameState.rushLastTickSec = secInt;
            audio.playRushTick(secInt <= 3);
          }
        }
        if (gameState.rushTimer <= 0) {
          gameState.rushFinished = true;
          triggerGameOver('rush_done');
        }
      }

      if (!gameState.over) {
        if (gameState.hitstopTimer > 0) gameState.hitstopTimer = Math.max(0, gameState.hitstopTimer - dt);
        else stepPhysics(dt);
        updateDessertAnimations(dt);
      }

      // 4.0 Shift End-of-Steps Resolution (chef mode)
      if (gameState.mode === 'chef' && !gameState.over && !gameState.paused && gameState.stepsLeft <= 0) {
        const hasFreshDrop = gameState.entities.some((e) => !e.merged && e.age < 0.72);
        if (gameState.serveCascadeTimer > 0 || hasFreshDrop) {
          gameState.shiftResolveDelay = Math.max(gameState.shiftResolveDelay, 0.48);
        } else {
          gameState.shiftResolveDelay = Math.max(0, gameState.shiftResolveDelay - dt);
          if (gameState.shiftResolveDelay <= 0) {
            if (gameState.shiftRevenue >= gameState.shiftTarget) {
              completeCurrentShift(false);
            } else {
              triggerGameOver('shift_failed');
            }
          }
        }
      }
    }

    gameState.nearOrderSubTiers = computeNearOrderSubTiers();
    gameState.traitRadiusMult = app.getTraitRadiusMult();

    for (let i = gameState.flyingServes.length - 1; i >= 0; i--) {
      const fs = gameState.flyingServes[i];
      fs.t += dt;
      if (fs.t >= fs.dur) gameState.flyingServes.splice(i, 1);
    }
    for (let i = gameState.shootingStars.length - 1; i >= 0; i--) {
      const st = gameState.shootingStars[i];
      st.life -= dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      if (st.life <= 0) gameState.shootingStars.splice(i, 1);
    }
    if (gameState.screenShake > 0) {
      gameState.screenShake *= Math.exp(-dt * 16);
      if (gameState.screenShake < 0.08) gameState.screenShake = 0;
    }
    if (gameState.jarFlash > 0) gameState.jarFlash = Math.max(0, gameState.jarFlash - dt * 2.4);
    for (let i = gameState.shockwaves.length - 1; i >= 0; i--) {
      const sw = gameState.shockwaves[i];
      sw.life -= dt;
      const p = 1 - Math.max(0, sw.life / sw.maxLife);
      sw.r = sw.maxR * (1 - Math.pow(1 - p, 2.4));
      if (sw.life <= 0) gameState.shockwaves.splice(i, 1);
    }
    if (gameState.comboBanner) {
      gameState.comboBanner.life -= dt;
      if (gameState.comboBanner.life <= 0) gameState.comboBanner = null;
    }
    if (gameState.displayScore < gameState.score) {
      const diff = gameState.score - gameState.displayScore;
      gameState.displayScore += Math.max(1, Math.ceil(diff * Math.min(1, dt * 14)));
    } else {
      gameState.displayScore = gameState.score;
    }
    if (gameState.displayShiftRevenue < gameState.shiftRevenue) {
      const diff = gameState.shiftRevenue - gameState.displayShiftRevenue;
      gameState.displayShiftRevenue += Math.max(1, Math.ceil(diff * Math.min(1, dt * 14)));
    } else {
      gameState.displayShiftRevenue = gameState.shiftRevenue;
    }
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.crumb ? 380 : p.shard ? 320 : 260) * dt;
      if (p.crumb) p.vx *= 0.94;
      if (p.shard) {
        p.vx *= 0.98;
        if (typeof p.vrot === 'number') p.rot = (p.rot || 0) + p.vrot * dt;
      }
      if (p.life <= 0) gameState.particles.splice(i, 1);
    }
    for (let i = gameState.popups.length - 1; i >= 0; i--) {
      const pop = gameState.popups[i];
      pop.life -= dt;
      pop.y += pop.vy * dt;
      if (pop.life <= 0) gameState.popups.splice(i, 1);
    }

    // Render Single Unified Mini-Game Canvas Frame
    ctx.setTransform(metrics.dpr, 0, 0, metrics.dpr, 0, 0);
    hits.clear();

    ScreensUI.renderBackdrop(ctx, metrics.width, metrics.height, dt, nowSec, gameState, app.equippedTheme, sprites, fireflies);

    if (app.isLobbyOpen) {
      ScreensUI.renderLobbyScreen(ctx, metrics, app, hits, nowSec);
    } else {
      ScreensUI.renderPlayScreen(ctx, metrics, app, hits, nowSec);
    }

    app.userInfoBtnRect = null;
    ModalsUI.renderActiveModal(ctx, metrics, app, hits, nowSec);
    platform.syncUserInfoButton(
      app.activeModal === 'career' ? app.userInfoBtnRect : null,
      (res) => {
        if (res && res.ok) {
          app.applyPlayerProfileAuth({
            nickName: res.nickName,
            avatarUrl: res.avatarUrl || '',
            authorized: true
          });
        } else if (res && res.cancelled) {
          app.showToast('可继续使用猫咪名片游玩', { icon: 'icon_paw_guide', tone: 'info' });
        }
      }
    );

    const { topY, headerH } = ScreensUI.computeTopHeaderGeometry(metrics);
    ScreensUI.renderToast(ctx, metrics.width, topY + headerH, app);
  }

  function mainLoop() {
    try {
      runFrame();
    } catch (err) {
      if (!mainLoopErrorLogged) {
        mainLoopErrorLogged = true;
        console.error('[HoshiKissa] mainLoop error:', err);
      }
    } finally {
      raf(mainLoop);
    }
  }

  // Lifecycle & WeChat Share setup (auto-pause + checkpoint on background hide / incoming call)
  function handleAppShow() {
    audio.setTabHidden(false);
    app.syncAudioMood();
    if (cloudDirty || cloudState.status === 'retry_pending') {
      cloudState.retryCount = 0;
      flushCloudPush();
    }
  }

  function handleAppHide() {
    audio.setTabHidden(true);
    resetAimingState();
    if (!app.isLobbyOpen && gameState.running && !gameState.over) {
      gameState.paused = true;
      if (!app.activeModal) {
        app.openModal('pause');
      }
      saveActiveRunCheckpoint({ syncCloud: false });
    }
    if (cloudDirty) {
      flushCloudPush();
    }
  }

  platform.bindLifecycle(handleAppShow, handleAppHide);
  platform.setupShare(() => ({
    title: gameState.score > 0
      ? `我在星夜吃茶闯到第 ${gameState.shift} 幕拿下了 ¥${gameState.score}！快来体验 18 种秘方流派构筑`
      : '星夜吃茶 · 喵呜甜品合合乐｜手绘弹射物理肉鸽合成小游戏'
  }));

  // Expose Debug Inspection Hooks for Automated E2E Testing
  const g = platform.getGlobal();
  g.__HOSHI_DEBUG__ = {
    getState: () => ({
      isWeChat: metrics.isWeChat,
      width: metrics.width,
      height: metrics.height,
      lobbyOpen: app.isLobbyOpen,
      activeModal: app.activeModal,
      confirmDialog: app.confirmDialog
        ? {
            title: app.confirmDialog.title,
            message: app.confirmDialog.message,
            returnModal: app.confirmDialog.returnModal
          }
        : null,
      activeShopTab: app.activeShopTab,
      activeCareerTab: app.activeCareerTab,
      leaderboardMode: app.leaderboardMode,
      leaderboardState: {
        loading: !!app.leaderboardState.loading,
        mode: app.leaderboardState.mode || app.leaderboardMode,
        myRank: app.leaderboardState.myRank,
        myScore: app.leaderboardState.myScore || 0,
        isLocalFallback: !!app.leaderboardState.isLocalFallback,
        count: (app.leaderboardState.list || []).length,
        top3: (app.leaderboardState.list || []).slice(0, 3).map((r) => ({
          rank: r.rank,
          nickName: r.nickName,
          score: r.score,
          isMe: !!r.isMe,
          isNpc: !!r.isNpc
        }))
      },
      cloudState: { ...cloudState },
      playerProfile: { ...(saveData.playerProfile || {}) },
      hasSavedRun: app.hasResumableRun(gameState.mode),
      savedRuns: {
        chef: !!savedRunsMap.chef,
        rush: !!savedRunsMap.rush,
        zen: !!savedRunsMap.zen
      },
      savedRun: app.savedRun
        ? {
            mode: app.savedRun.mode,
            shift: app.savedRun.shift,
            score: app.savedRun.score,
            shiftRevenue: app.savedRun.shiftRevenue,
            resumeModal: app.savedRun.resumeModal
          }
        : null,
      userInfoBtnRect: app.userInfoBtnRect ? { ...app.userInfoBtnRect } : null,
      guideMode: app.guideMode,
      guideStep: app.guideStep,
      mode: gameState.mode,
      running: gameState.running,
      paused: gameState.paused,
      over: gameState.over,
      runEndReason: gameState.runEndReason,
      dangerDuration: +(gameState.dangerDuration || 0).toFixed(2),
      longPressServe: gameState.longPressServe ? { ...gameState.longPressServe } : null,
      score: gameState.score,
      stardust: gameState.stardust,
      // 4.1 5-Shift Roguelike + Hazards state
      shift: gameState.shift,
      shiftName: gameState.shiftName,
      shiftModifier: gameState.shiftModifier,
      shiftHazards: [...(gameState.shiftHazards || [])],
      activeHazards: [...(gameState.shiftHazards || [])],
      shiftsClearedThisRun: gameState.shiftsClearedThisRun,
      shiftRevenue: gameState.shiftRevenue,
      shiftTarget: gameState.shiftTarget,
      stepsLeft: gameState.stepsLeft,
      stepsMax: gameState.stepsMax,
      shiftStepsUsed: gameState.shiftStepsUsed,
      shiftStepRefunds: gameState.shiftStepRefunds || 0,
      shiftClearedFlag: gameState.shiftClearedFlag,
      iceShatteredThisRun: gameState.iceShatteredThisRun || 0,
      glazeHitsThisRun: gameState.glazeHitsThisRun || 0,
      coins: gameState.coins,
      freeSkipsLeft: gameState.freeSkipsLeft || 0,
      skipCooldown: +(gameState.skipCooldown || 0).toFixed(2),
      mugiBankCoinHits: gameState.mugiBankCoinHits || 0,
      relics: [...gameState.relics],
      archetypeCounts: app.getArchetypeCounts(),
      activeSynergies: app.getActiveSynergies().map((s) => `${s.id}:${s.tier}`),
      nearOrderSubTiers: [...(gameState.nearOrderSubTiers || [])],
      toastCurrent: app.toastCurrent ? { ...app.toastCurrent } : null,
      toastQueueLen: app.toastQueue.length,
      minorToast: app.minorToast ? { ...app.minorToast } : null,
      deckMods: { ...gameState.deckMods },
      obstacles: gameState.obstacles.map((o) => ({
        id: o.id,
        type: o.type,
        source: o.source || null,
        x: +o.x.toFixed(2),
        y: typeof o.y === 'number' ? +o.y.toFixed(2) : null,
        r: o.r || null,
        w: o.w || null,
        h: o.h || null,
        rx: o.rx || null,
        ry: o.ry || null,
        topY: typeof o.topY === 'number' ? o.topY : null,
        bottomY: typeof o.bottomY === 'number' ? o.bottomY : null,
        tipBase: o.tipBase || null,
        grantsCrit: !!o.grantsCrit,
        hitFlash: +(o.hitFlash || 0).toFixed(2)
      })),
      antigravTimer: +gameState.antigravTimer.toFixed(2),
      globalResonanceTimer: +gameState.globalResonanceTimer.toFixed(2),
      prepShop: gameState.prepShop
        ? {
            nextShiftNum: gameState.prepShop.nextShiftNum,
            nextHazards: [...(gameState.prepShop.nextHazards || [])],
            rerollCost: gameState.prepShop.rerollCost,
            relicOffers: gameState.prepShop.relicOffers.map((o) => ({ ...o })),
            modOffers: gameState.prepShop.modOffers.map((o) => ({ ...o }))
          }
        : null,
      dropsMadeThisRun: gameState.dropsMadeThisRun,
      servesCompleted: gameState.servesCompleted,
      ordersCompleted: gameState.ordersCompleted,
      bankShotsLanded: gameState.bankShotsLanded,
      serveCascadeTimer: +gameState.serveCascadeTimer.toFixed(2),
      serveCascadeMerges: gameState.serveCascadeMerges,
      maxAvalancheRun: gameState.maxAvalancheRun,
      skillEnergy: +gameState.skillEnergy.toFixed(1),
      activeSkillMode: gameState.activeSkillMode,
      nextShotMeteor: gameState.nextShotMeteor,
      feverEnergy: +gameState.feverEnergy.toFixed(1),
      feverTimer: +gameState.feverTimer.toFixed(2),
      rushTimer: +gameState.rushTimer.toFixed(2),
      rushServeStreak: gameState.rushServeStreak || 0,
      rushStreakTimer: +(gameState.rushStreakTimer || 0).toFixed(2),
      rushFinished: gameState.rushFinished,
      activeEvent: gameState.activeEvent ? { ...gameState.activeEvent } : null,
      yarnBrokenThisRun: gameState.yarnBrokenThisRun,
      comboCount: gameState.comboCount,
      maxCombo: gameState.maxCombo,
      tools: { ...gameState.tools },
      perks: { ...gameState.perks },
      pendingBlessings: gameState.pendingBlessings,
      dropsUntilRainbow: gameState.dropsUntilRainbow,
      canHoldThisTurn: gameState.canHoldThisTurn,
      aim: { ...gameState.aim },
      dropX: gameState.dropX,
      aimAngle: +gameState.aimAngle.toFixed(3),
      curTier: gameState.curTier,
      curMeta: { ...gameState.curMeta },
      nextTier: gameState.nextTier,
      nextMeta: { ...gameState.nextMeta },
      holdTier: gameState.holdTier,
      holdMeta: gameState.holdMeta ? { ...gameState.holdMeta } : null,
      orders: (gameState.orders || []).map((o) => ({
        uid: o.uid,
        kind: o.kind,
        isJudgeRush: !!o.isJudgeRush,
        isStarterBlitz: !!o.isStarterBlitz,
        freshSteps: o.freshSteps,
        freshMax: o.freshMax,
        freshMult: o.freshMult,
        staleMult: o.staleMult || 1.0,
        completed: o.completed,
        slots: o.slots.map((s) => ({ tier: s.tier, done: s.done }))
      })),
      popups: (gameState.popups || []).map((p) => ({ text: p.text, x: +p.x.toFixed(1), y: +p.y.toFixed(1) })),
      debugPhysics: gameState.debugPhysics,
      jarBox: app.lastJarBox,
      assetsLoaded: sprites.loadedCount,
      assetsTotal: sprites.totalCount,
      hits: hits.items.map((it) => ({
        id: it.id,
        x: Math.round(it.x),
        y: Math.round(it.y),
        w: Math.round(it.w),
        h: Math.round(it.h)
      })),
      entities: gameState.entities.map((e) => ({
        id: e.id,
        tier: e.tier,
        isWildcard: !!e.isWildcard,
        isGolden: !!e.isGolden,
        isYarnBall: !!e.isYarnBall,
        frozenHp: e.frozenHp || 0,
        isServable: !!findServableMatch(e),
        agedStacks: e.agedStacks || 0,
        bumperCrit: !!e.bumperCrit,
        bumperHits: e.bumperHits || 0,
        wallBounces: e.wallBounces || 0,
        gravityScale: e.gravityScale || 1,
        yarnHp: e.isYarnBall ? e.yarnHp : 0,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        vx: +e.vx.toFixed(2),
        vy: +e.vy.toFixed(2),
        polyCount: e.worldPolys ? e.worldPolys.length : 0
      }))
    }),
    getSaveData: () => JSON.parse(JSON.stringify(saveData)),
    clickHit: (id) => {
      const h = hits.items.find((it) => it.id === id);
      if (!h || !h.onClick) return false;
      h.onClick();
      return true;
    },
    addBankStardust: (amt) => {
      const delta = Number(amt) || 0;
      saveData.bankStardust = Math.max(0, (saveData.bankStardust || 0) + delta);
      if (delta > 0) {
        saveData.totalEarnedStardust = (saveData.totalEarnedStardust || 0) + delta;
      }
      persistSaveData();
    },
    addShiftRevenue: (amt) => addScore(Math.max(0, Number(amt) || 0)),
    addCoins: (amt) => addCoins(Math.max(0, Number(amt) || 0)),
    equipRelic: (id) => {
      if (!RELICS.some((r) => r.id === id)) return false;
      if (!gameState.relics.includes(id) && gameState.relics.length < MAX_RELIC_SLOTS) {
        gameState.relics.push(id);
        if (id === 'rel_bumpers') syncObstaclesForShift();
        if (id === 'rel_double_vip') initOrders();
      }
      return true;
    },
    unequipRelic: (id) => {
      const idx = gameState.relics.indexOf(id);
      if (idx === -1) return false;
      gameState.relics.splice(idx, 1);
      if (id === 'rel_bumpers') syncObstaclesForShift();
      if (id === 'rel_double_vip') initOrders();
      return true;
    },
    triggerShiftClear: () => completeCurrentShift(true),
    setShift: (n, forcedHazards = null, opts = {}) =>
      beginShift(Math.max(1, Number(n) || 1), true, null, forcedHazards, { skipTips: !(opts && opts.allowTips) }),
    skipOrder: (tableIdx = null) => app.skipOrder(tableIdx),
    showToast: (msg, opts = null) => app.showToast(msg, opts),
    computeTurretShot: (angle) => computeTurretShotFromAngle(angle),
    chargeSkill: () => addSkillEnergy(100, true),
    spawnTestEntity: (tier, x, y, opts = {}) => {
      const ent = createEntity(tier, x, y, opts.vx || 0, opts.vy || 0, false, 0, 0, {
        preSettled: opts.preSettled !== false,
        golden: !!opts.golden,
        frozenHp: opts.frozenHp || 0,
        isMeteorShot: !!opts.isMeteorShot,
        isBankLaunched: !!opts.isBankLaunched
      });
      return ent.id;
    },
    setGlazeRingX: (targetX) => {
      const ring = (gameState.obstacles || []).find((o) => o && o.type === 'glaze_ring');
      if (!ring) return false;
      const cx = typeof ring.centerX === 'number' ? ring.centerX : 220;
      const amp = typeof ring.patrolAmp === 'number' ? ring.patrolAmp : 125;
      const clamped = Math.max(cx - amp, Math.min(cx + amp, Number(targetX) || cx));
      ring.x = clamped;
      ring.phase = Math.asin(Math.max(-1, Math.min(1, (clamped - cx) / (amp || 1))));
      return true;
    },
    triggerJudgeRush: () => {
      const vipHasPartial =
        gameState.orders.length >= 2 &&
        gameState.orders[1] &&
        !gameState.orders[1].completed &&
        gameState.orders[1].slots.some((s) => s.done);
      const targetIdx = vipHasPartial ? 0 : 1;
      const rushOrd = generateTableOrder('vip', false, { isJudgeRush: true });
      rushOrd.slotOrigin = targetIdx === 0 ? 'quick' : 'vip';
      if (gameState.orders.length >= 2) gameState.orders[targetIdx] = rushOrd;
      else gameState.orders.push(rushOrd);
      gameState.order = rushOrd;
      audio.playOrderStamp();
      showComboBanner('评委突击急单', '4步内出餐 ×2.5 · 返 +2步', '#ffe570', 'icon_judge', 2);
      return rushOrd.uid;
    },
    clearEntities: () => {
      gameState.entities = [];
      gameState.dangerDuration = 0;
    },
    serveById: (id) => serveEntityById(id),
    serveTable: (idx) => app.serveOrderTable(idx),
    serveReady: () => app.serveReadyOrder(),
    serveSouffle: () => app.serveSouffle(),
    selectPatron: (id) => {
      if (!saveData.unlockedPatrons.includes(id)) saveData.unlockedPatrons.push(id);
      saveData.selectedPatron = id;
      persistSaveData();
    },
    triggerEvent: (kind) => triggerShopEvent(kind),
    triggerRushGust: () => triggerRushEmergencyGust(),
    setRushTimer: (sec) => {
      gameState.rushTimer = Math.max(0, Number(sec) || 0);
    },
    triggerFever: () => addFeverEnergy(100),
    grantRainbow: () => grantNextRainbow('测试彩虹糖'),
    queueBlessing: (r = '测试秘方') => grantMilestoneRelicOrSupply(r),
    openBlessing: () => grantMilestoneRelicOrSupply('里程碑秘方'),
    openModeGuide: (m, step = 0) => app.openModeGuide(m, step),
    openCareer: (tab = 'stats') => app.openCareer(tab),
    resumeRun: (m = gameState.mode) => app.resumeSavedRun(m),
    saveCheckpoint: (syncCloud = false) => saveActiveRunCheckpoint({ syncCloud }),
    triggerHide: () => handleAppHide(),
    triggerShow: () => handleAppShow(),
    mockAuthProfile: (prof) => app.applyPlayerProfileAuth(prof || { nickName: '测试星夜主厨', authorized: true }),
    forceCloudSync: () => bootCloudSync(),
    flushCloud: () => flushCloudPush(),
    togglePhysicsDebug: (val) => app.toggleDebugPhysics(val),
    startMode: (mode, opts = {}) => app.startNewRun(mode, { skipGuide: true, ...opts }),
    returnToLobby: () => app.returnToLobby(),
    refreshMetrics: () => {
      metrics = platform.getSystemMetrics();
      canvas.width = Math.round(metrics.width * metrics.dpr);
      canvas.height = Math.round(metrics.height * metrics.dpr);
    }
  };

  preloadAssets().then(() => {
    app.syncAudioMood();
    if (saveData.playerProfile && saveData.playerProfile.avatarUrl) {
      app.ensureRemoteAvatar(saveData.playerProfile.avatarUrl);
    }
    bootCloudSync();
    raf(mainLoop);
  });

  return app;
}

module.exports = {
  createApp
};
