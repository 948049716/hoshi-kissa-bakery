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
  BLESSINGS,
  PATRONS,
  SHOP_UPGRADES,
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

  // Load Persistent Save Data (3.0 backward-compatible migration)
  let saveData = loadSaveData();
  function loadSaveData() {
    const defaults = {
      bestChef: 0,
      bestZen: 0,
      bestRush: 0,
      unlockedTiers: [1, 2, 3, 4],
      bgmTrack: 'waltz',
      sfxEnabled: true,
      bankStardust: 30,
      selectedPatron: 'mikan',
      unlockedPatrons: ['mikan'],
      equippedTheme: 'amber',
      unlockedThemes: ['amber'],
      shopUpgrades: { up_tools: 0, up_fever: 0, up_combo: 0, up_dust: 0 },
      lifetimeStats: {
        runsPlayed: 0,
        ordersCompleted: 0,
        soufflesMade: 0,
        yarnBroken: 0,
        maxComboEver: 1
      }
    };
    const parsed = platform.getStorageJSON(STORAGE_KEY);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const bestChef = Number(parsed.bestChef) || 0;
    const bestZen = Number(parsed.bestZen) || 0;
    const bestRush = Number(parsed.bestRush) || 0;
    const unlockedPatrons = Array.isArray(parsed.unlockedPatrons)
      ? Array.from(new Set(['mikan', ...parsed.unlockedPatrons.filter((id) => PATRONS.some((p) => p.id === id))]))
      : ['mikan'];
    const selectedPatron = unlockedPatrons.includes(parsed.selectedPatron) ? parsed.selectedPatron : 'mikan';
    const unlockedThemes = Array.isArray(parsed.unlockedThemes)
      ? Array.from(new Set(['amber', ...parsed.unlockedThemes.filter((id) => !!JAR_THEMES[id])]))
      : ['amber'];
    const equippedTheme = unlockedThemes.includes(parsed.equippedTheme) ? parsed.equippedTheme : 'amber';
    const upRaw = parsed.shopUpgrades && typeof parsed.shopUpgrades === 'object' ? parsed.shopUpgrades : {};
    const clampLv = (v) => Math.max(0, Math.min(3, Math.floor(Number(v) || 0)));
    const stRaw = parsed.lifetimeStats && typeof parsed.lifetimeStats === 'object' ? parsed.lifetimeStats : {};

    let bankStardust;
    if (typeof parsed.bankStardust === 'number' && Number.isFinite(parsed.bankStardust)) {
      bankStardust = Math.max(0, Math.floor(parsed.bankStardust));
    } else if (bestChef > 0 || bestZen > 0) {
      bankStardust = Math.max(60, Math.min(260, 60 + Math.floor(Math.max(bestChef, bestZen) / 300)));
    } else {
      bankStardust = defaults.bankStardust;
    }

    return {
      bestChef,
      bestZen,
      bestRush,
      unlockedTiers: Array.isArray(parsed.unlockedTiers) ? parsed.unlockedTiers : [1, 2, 3, 4],
      bgmTrack:
        parsed.bgmTrack === 'waltz' || parsed.bgmTrack === 'bossa' || parsed.bgmTrack === 'off'
          ? parsed.bgmTrack
          : 'waltz',
      sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : true,
      bankStardust,
      selectedPatron,
      unlockedPatrons,
      equippedTheme,
      unlockedThemes,
      shopUpgrades: {
        up_tools: clampLv(upRaw.up_tools),
        up_fever: clampLv(upRaw.up_fever),
        up_combo: clampLv(upRaw.up_combo),
        up_dust: clampLv(upRaw.up_dust)
      },
      lifetimeStats: {
        runsPlayed: Math.max(0, Math.floor(Number(stRaw.runsPlayed) || 0)),
        ordersCompleted: Math.max(0, Math.floor(Number(stRaw.ordersCompleted) || 0)),
        soufflesMade: Math.max(0, Math.floor(Number(stRaw.soufflesMade) || 0)),
        yarnBroken: Math.max(0, Math.floor(Number(stRaw.yarnBroken) || 0)),
        maxComboEver: Math.max(1, Math.floor(Number(stRaw.maxComboEver) || 1))
      }
    };
  }

  function persistSaveData() {
    platform.setStorageJSON(STORAGE_KEY, saveData);
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

  // Mutable Game State
  const gameState = {
    mode: 'chef',
    running: false,
    paused: false,
    over: false,
    score: 0,
    displayScore: 0,
    stardust: 30,
    dropsMadeThisRun: 0,
    soufflesMadeThisRun: 0,
    yarnBrokenThisRun: 0,
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
    tools: { shake: 2, fork: 2, spoon: 1 },
    toolCosts: { shake: 22, fork: 25, spoon: 35 },
    activeToolMode: null,
    dropX: 220,
    prevDropX: 220,
    aimAngle: 0,
    dropSway: 0,
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
    waitingForLanding: false,
    lastDropX: null,
    sameSpotStreak: 0,
    bakeZone: { colIdx: 1, x: 178, w: 78, turnsLeft: 3 },
    heldActionCooldown: 1.6,
    heldActionAnim: null,
    perks: {},
    pendingBlessings: 0,
    blessingChoices: [],
    blessingLastReason: '',
    blessingSubText: '',
    blessingLockUntil: 0,
    zenNextMilestone: 500,
    rushTimer: 90.0,
    rushFinished: false,
    rushGustCooldown: 0,
    rushNextMilestone: 1800,
    rushLastTickSec: 6,
    activeEvent: null,
    lastEventKind: null,
    nextEventDrops: 12,
    nextEventTimer: 18.0,
    meteorGoldenLeft: 0,
    shootingStars: [],
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
    order: null,
    skipCooldown: 0,
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

  // Application View & Modal Coordinator
  const app = {
    canvas,
    metrics: () => metrics,
    audio,
    sprites,
    saveData,
    gameState,
    isLobbyOpen: true,
    activeModal: null, // 'shop' | 'career' | 'help' | 'compendium' | 'blessing' | 'gameover' | null
    activeShopTab: 'upgrades',
    lobbySpeechIndex: 0,
    lobbyBounceT: 0,
    modalScrollY: 0,
    modalMaxScroll: 0,
    modalScrollRect: null,
    lastJarBox: { x: 0, y: 0, w: 440, h: 520, scale: 1 },
    toastText: '',
    toastTimer: 0,
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
      return Math.min(5, 2 + Math.max(0, gameState.comboCount - 1) * 0.75);
    },

    showToast(msg) {
      this.toastText = msg;
      this.toastTimer = 2.4;
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
      this.showToast(next ? '🔊 游戏音效已开启' : '🔇 游戏音效已关闭');
    },

    cycleBgm() {
      audio.ensureCtx();
      audio.cycleBGMTrack();
      saveData.bgmTrack = audio.bgmTrack;
      persistSaveData();
      const info = audio.getTrackInfo();
      this.showToast(info.id === 'off' ? '🔇 背景音乐已关闭' : `🎵 当前背景音乐：${info.title}`);
    },

    toggleDebugPhysics(forceVal) {
      if (this.activeModal === 'blessing') this.closeModal();
      gameState.debugPhysics = typeof forceVal === 'boolean' ? forceVal : !gameState.debugPhysics;
      if (typeof forceVal !== 'boolean') {
        this.showToast(gameState.debugPhysics ? '📐 已开启物理多边形轮廓视图' : '📐 已关闭物理轮廓视图');
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
          this.showToast(`${p.badge} 已切换助阵搭档：${p.name}`);
        } else {
          this.pokeLobbyPatron();
        }
      } else {
        this.openShop('patrons');
      }
    },

    openModal(name) {
      if (this.activeModal === 'blessing' && name !== 'blessing') {
        gameState.paused = false;
      }
      this.activeModal = name;
      this.modalScrollY = 0;
      this.modalMaxScroll = 0;
      this.syncAudioMood();
    },

    closeModal() {
      if (!this.activeModal) return;
      if (this.activeModal === 'gameover') return;
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
        this.showToast(`⭐ 永久星尘不足（需要 ${cost} ⭐）`);
        return;
      }
      audio.ensureCtx();
      saveData.bankStardust -= cost;
      saveData.shopUpgrades[id] = lv + 1;
      persistSaveData();
      audio.playShopBuy();
      platform.vibrateShort('light');
      this.showToast(`🏪 升级成功！【${up.name}】升至 Lv.${lv + 1}！`);
    },

    buyOrEquipTheme(id) {
      const th = JAR_THEMES[id];
      if (!th) return;
      audio.ensureCtx();
      const owned = saveData.unlockedThemes.includes(id);
      if (!owned) {
        if ((saveData.bankStardust || 0) < th.cost) {
          this.showToast(`⭐ 永久星尘不足（需要 ${th.cost} ⭐）`);
          return;
        }
        saveData.bankStardust -= th.cost;
        saveData.unlockedThemes.push(id);
        saveData.equippedTheme = id;
        persistSaveData();
        audio.playShopBuy();
        platform.vibrateShort('light');
        this.showToast(`✨ 已解锁并换上【${th.name}】！`);
      } else {
        saveData.equippedTheme = id;
        persistSaveData();
        audio.playPatronSelect();
        this.showToast(`${th.icon} 已切换玻璃罐主题：${th.name}`);
      }
    },

    buyOrSelectPatron(id) {
      const p = PATRONS.find((item) => item.id === id);
      if (!p) return;
      audio.ensureCtx();
      const owned = saveData.unlockedPatrons.includes(id);
      if (!owned) {
        if ((saveData.bankStardust || 0) < p.cost) {
          this.showToast(`⭐ 永久星尘不足（需要 ${p.cost} ⭐）`);
          return;
        }
        saveData.bankStardust -= p.cost;
        saveData.unlockedPatrons.push(id);
        saveData.selectedPatron = id;
        this.lobbySpeechIndex = 0;
        persistSaveData();
        audio.playShopBuy();
        platform.vibrateShort('light');
        this.showToast(`${p.badge} 欢迎新搭档【${p.name}】加入！`);
      } else {
        saveData.selectedPatron = id;
        this.lobbySpeechIndex = 0;
        persistSaveData();
        audio.playPatronSelect();
        this.showToast(`${p.badge} 已切换助阵搭档：${p.name}`);
      }
    },

    returnToLobby() {
      gameState.running = false;
      gameState.paused = false;
      cancelToolMode();
      audio.setFeverMode(false);
      audio.setDangerLevel(0);
      this.activeModal = null;
      this.isLobbyOpen = true;
      this.syncAudioMood();
      this.showToast('🏠 已回到星夜吃茶大厅');
    },

    startNewRun(mode = gameState.mode) {
      startNewRunFn(mode);
      audio.playStartCafe();
    },

    restartRun() {
      startNewRunFn(gameState.mode);
      audio.playStartCafe();
      this.showToast('🔄 已重新开启新一轮营业！');
    },

    shareResult() {
      const ok = platform.triggerShare({
        title: `🌙 我在星夜吃茶拿下了 ${gameState.score} 分（${getChefRank(gameState.score)}），快来挑战猫神舒芙蕾！`
      });
      if (!ok) {
        this.showToast('📤 请在微信小游戏右上角或真机中点击分享给好友～');
      }
    },

    armOrUseTool(key) { armOrUseToolFn(key); },
    cancelToolMode() { cancelToolMode(); },
    swapHoldPocket() { swapHoldPocketFn(); },
    adjustAimAngle(deltaRad) { adjustAimAngle(deltaRad); },
    skipOrder() { skipOrderFn(); },
    openBlessingModal() { openBlessingModalFn(); },
    applyBlessing(id) { applyBlessingFn(id); }
  };

  const BAKE_ZONE_COLS = [96, 178, 262, 344];

  function rotateBakeZone(excludeIdx = -1, avoidX = null) {
    let candidates = [0, 1, 2, 3].filter((i) => i !== excludeIdx);
    if (avoidX !== null) {
      const far = candidates.filter((i) => Math.abs(BAKE_ZONE_COLS[i] - avoidX) > 48);
      if (far.length > 0) candidates = far;
    }
    const nextIdx = candidates[Math.floor(Math.random() * candidates.length)];
    gameState.bakeZone = {
      colIdx: nextIdx,
      x: BAKE_ZONE_COLS[nextIdx],
      w: 78,
      turnsLeft: 3
    };
  }

  function isWaitingForLanding() {
    if (!gameState.lastDroppedId) return false;
    const ent = gameState.entities.find((e) => e.id === gameState.lastDroppedId);
    if (!ent || ent.merged || ent.hasCollided) return false;
    if (ent.age >= 0.85 || ent.y >= JAR.floorY - ent.r - 4) {
      ent.hasCollided = true;
      return false;
    }
    return true;
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
    return Math.max(4, modeBase - lunaBonus - app.getPerkLevel('rainbow') * 2);
  }

  function pickDropTier() {
    const r = Math.random();
    if (r < 0.36) return 1;
    if (r < 0.68) return 2;
    if (r < 0.9) return 3;
    return 4;
  }

  function pickDropBundle(forceRainbow = false) {
    if (forceRainbow) {
      return { tier: 2, meta: { wildcard: true, golden: false } };
    }
    const tier = pickDropTier();
    const goldenLv = app.getPerkLevel('golden');
    let goldenChance = 0.09 + goldenLv * 0.1 + (gameState.feverTimer > 0 && goldenLv > 0 ? 0.12 : 0);
    if (gameState.meteorGoldenLeft > 0) {
      gameState.meteorGoldenLeft--;
      goldenChance = Math.max(goldenChance, 0.75);
    }
    return { tier, meta: { wildcard: false, golden: Math.random() < goldenChance } };
  }

  function grantNextRainbow(reason = '') {
    if (!gameState.nextMeta || !gameState.nextMeta.wildcard) {
      gameState.nextTier = 2;
      gameState.nextMeta = { wildcard: true, golden: false };
      gameState.dropsUntilRainbow = getRainbowPityBase();
      if (reason) app.showToast(`🌈 ${reason}！下一颗变身【彩虹万能糖】！`);
    }
  }

  function rollBlessingChoices() {
    const eligible = BLESSINGS.filter((b) => b.repeatable || app.getPerkLevel(b.id) < b.maxLv);
    const pool = [...eligible];
    const picked = [];
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function queueBlessing(reason = '订单完成') {
    gameState.pendingBlessings++;
    gameState.blessingLastReason = reason;
    audio.playBlessingReady();
    spawnSparkleBurst(JAR.canvasW / 2, JAR.floorY + 12, '#ffe27a', 16);
  }

  function openBlessingModalFn() {
    if (!gameState.running || gameState.over || gameState.pendingBlessings <= 0) return;
    if (app.isLobbyOpen || app.activeModal === 'gameover') return;
    if (gameState.activeToolMode) cancelToolMode();

    if (!gameState.blessingChoices || gameState.blessingChoices.length === 0) {
      gameState.blessingChoices = rollBlessingChoices();
    }
    const reason = gameState.blessingLastReason || '心愿达成';
    gameState.blessingSubText =
      gameState.pendingBlessings > 1
        ? `${reason}！当前已积攒 ${gameState.pendingBlessings} 次祝福，可连续挑选！`
        : `${reason}！任选 1 张星夜秘方，永久强化本局烘焙！`;
    gameState.paused = true;
    gameState.blessingLockUntil = Date.now() + 140;
    app.openModal('blessing');
    audio.playBlessingOpen();
  }

  function applyBlessingFn(id) {
    if (Date.now() < gameState.blessingLockUntil) return;
    const def = BLESSINGS.find((b) => b.id === id);
    if (!def) return;

    audio.playBlessingPick();
    if (!def.repeatable) {
      gameState.perks[id] = Math.min(def.maxLv, app.getPerkLevel(id) + 1);
    }

    if (id === 'rainbow') {
      gameState.dropsUntilRainbow = Math.min(gameState.dropsUntilRainbow, getRainbowPityBase());
      grantNextRainbow('彩虹眷顾');
    } else if (id === 'fever') {
      if (gameState.feverTimer > 0) {
        gameState.feverTimer += 3.5;
        gameState.feverMaxDuration = Math.max(gameState.feverMaxDuration, gameState.feverTimer);
      } else {
        addFeverEnergy(45);
      }
    } else if (id === 'toolbox') {
      gameState.tools.shake++;
      gameState.tools.fork++;
      gameState.tools.spoon++;
      const gained = addRunStardust(25);
      spawnPopup(JAR.canvasW / 2, 220, `🎁 全道具+1 · +${gained}⭐!`, '#ffe57e', 19);
    } else if (id === 'cleanse') {
      const smalls = gameState.entities
        .filter((e) => !e.isWildcard && !e.isYarnBall && e.tier <= 2)
        .sort((a, b) => a.y - b.y)
        .slice(0, 4);
      const removeIds = new Set(smalls.map((e) => e.id));
      let gainedPts = 0;
      let gainedDustBase = 0;
      for (const s of smalls) {
        gainedPts += 40;
        gainedDustBase += 6;
        spawnSparkleBurst(s.x, s.y, '#9be8ff', 14);
        spawnShockwave(s.x, s.y, 44, '#9be8ff', 2.8);
      }
      if (removeIds.size > 0) {
        gameState.entities = gameState.entities.filter((e) => !removeIds.has(e.id));
        addScore(gainedPts);
        addRunStardust(gainedDustBase);
        spawnPopup(JAR.canvasW / 2, 210, `🫧 吹散${removeIds.size}颗! +${gainedPts}分`, '#b6f4ff', 18);
      } else {
        const gained = addRunStardust(20);
        spawnPopup(JAR.canvasW / 2, 210, `🫧 罐内很清爽！赠送 +${gained}⭐`, '#b6f4ff', 17);
      }
    }

    const lvTag = def.repeatable ? '' : ` Lv.${app.getPerkLevel(id)}`;
    const pickedSummary = `${def.icon} ${def.name}${lvTag}`;
    gameState.pendingBlessings = Math.max(0, gameState.pendingBlessings - 1);
    gameState.blessingChoices = [];

    if (gameState.pendingBlessings > 0 && app.activeModal === 'blessing') {
      gameState.blessingLockUntil = Date.now() + 180;
      gameState.blessingChoices = rollBlessingChoices();
      gameState.blessingSubText = `✅ 已获得【${pickedSummary}】！继续任选 1 张星夜秘方（还剩 ${gameState.pendingBlessings} 次）`;
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffe27a', 18);
      return;
    }

    app.activeModal = null;
    gameState.paused = false;
    app.syncAudioMood();
    app.showToast(`🎁 获得祝福【${pickedSummary}】！`);
    spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffe27a', 26);
    spawnShockwave(JAR.canvasW / 2, 250, 150, '#ffe47a', 3.5);
    gameState.jarFlash = 0.55;
  }

  function unlockTier(tier) {
    gameState.seenThisRun.add(tier);
    if (tier > gameState.maxTierRun) gameState.maxTierRun = tier;
    if (!saveData.unlockedTiers.includes(tier)) {
      saveData.unlockedTiers.push(tier);
      saveData.unlockedTiers.sort((a, b) => a - b);
      persistSaveData();
      app.showToast(`✨ 新甜品解锁：${TIERS[tier - 1].name}！`);
    }
  }

  // Orders (Chef Mode)
  function generateOrder() {
    const maxMade = gameState.maxTierRun;
    const orderNum = gameState.ordersCompleted;
    const activePatron = app.activePatron;
    const patron =
      orderNum === 0
        ? activePatron
        : PATRONS[(orderNum + Math.floor(Math.random() * PATRONS.length)) % PATRONS.length];

    let reqTiers = [];
    if (orderNum === 0) {
      reqTiers = [3, 4];
    } else if (orderNum < 3) {
      reqTiers = [3 + Math.floor(Math.random() * 2), 4 + Math.floor(Math.random() * 2)];
    } else {
      const cap = Math.min(8, Math.max(5, maxMade));
      const tA = 3 + Math.floor(Math.random() * Math.min(3, cap - 2));
      const tB = Math.min(8, Math.max(4, Math.min(cap, tA + 1 + Math.floor(Math.random() * 2))));
      reqTiers = [tA, tB];
    }
    reqTiers.sort((a, b) => a - b);

    const mikanOrderMult = saveData.selectedPatron === 'mikan' ? 1.2 : 1.0;
    const rewardScore = Math.round(reqTiers.reduce((acc, t) => acc + TIERS[t - 1].points * 6, 80) * mikanOrderMult);
    const rewardDust = Math.round((16 + reqTiers.reduce((acc, t) => acc + t * 2, 0)) * mikanOrderMult);
    const rushMax = 10 + Math.max(...reqTiers);

    gameState.order = {
      patron,
      slots: reqTiers.map((tier) => ({ tier, done: false })),
      rewardScore,
      rewardDust,
      rushDropsLeft: rushMax,
      rushDropsMax: rushMax,
      completed: false
    };

    setPatronSpeech(activePatron, orderNum === 0 ? activePatron.greet : `${patron.shortName}点单啦：${patron.greet}`, 4.5);
    checkExistingBoardForOrder();
  }

  function checkExistingBoardForOrder() {
    if (!gameState.order || gameState.order.completed || gameState.mode !== 'chef') return;
    const usedIds = new Set();
    for (const slot of gameState.order.slots) {
      if (slot.done) continue;
      const match = gameState.entities.find(
        (e) => !e.isWildcard && !e.isYarnBall && e.tier === slot.tier && !usedIds.has(e.id) && !e.creditedToOrder
      );
      if (match) {
        usedIds.add(match.id);
        match.creditedToOrder = true;
        slot.done = true;
      }
    }
    checkOrderComplete();
  }

  function notifyTreatSynthesized(tier, entity) {
    if (!gameState.order || gameState.order.completed || gameState.mode !== 'chef') return;
    const slot = gameState.order.slots.find((s) => !s.done && s.tier === tier);
    if (slot) {
      slot.done = true;
      if (entity) entity.creditedToOrder = true;
      audio.playOrderStamp();
      spawnSparkleBurst(entity ? entity.x : JAR.canvasW / 2, entity ? entity.y : 250, '#ffd85d', 14);
      checkOrderComplete();
    }
  }

  function checkOrderComplete() {
    if (!gameState.order || gameState.order.completed || gameState.mode !== 'chef') return;
    if (gameState.order.slots.every((s) => s.done)) {
      const ord = gameState.order;
      ord.completed = true;
      gameState.ordersCompleted++;

      const isRush = ord.rushDropsLeft > 0;
      const feverMult = app.getFeverMultiplier();
      const rushMult = isRush ? 1.6 : 1;
      const pts = Math.round(ord.rewardScore * feverMult * rushMult);
      const dustBase = Math.round(ord.rewardDust * rushMult);
      const dust = addRunStardust(dustBase);

      addScore(pts);
      addFeverEnergy(isRush ? 36 : 28);
      audio.playOrderComplete();
      platform.vibrateShort('medium');

      let toolMsg = '';
      if (gameState.ordersCompleted % 2 === 0) {
        const pool = ['shake', 'fork', 'spoon'];
        const gift = pool[Math.floor(Math.random() * pool.length)];
        gameState.tools[gift]++;
        const label = gift === 'shake' ? '摇一摇' : gift === 'fork' ? '泡泡叉' : '升阶勺';
        toolMsg = ` · +1 ${label}`;
        if (!gameState.activeEvent) {
          setTimeout(() => {
            if (gameState.running && !gameState.over && !gameState.activeEvent) {
              triggerShopEvent();
            }
          }, 1150);
        }
      }

      if (isRush) grantNextRainbow();
      const activePatron = app.activePatron;
      setPatronSpeech(activePatron, isRush ? `${activePatron.thanks} 极速附赠彩虹万能糖！` : activePatron.thanks, 3.8);
      app.showToast(
        isRush
          ? `⚡ 极速订单达成！+${pts}分 · +${dust}⭐ · 送🌈${toolMsg}`
          : `🎉 订单完成！+${pts}分 · +${dust}⭐${toolMsg}`
      );
      spawnPopup(JAR.canvasW / 2, 168, isRush ? `⚡ 极速订单! +${pts}` : `订单完成! +${pts}`, '#ffe57e', 20);
      spawnSparkleBurst(JAR.canvasW / 2, 180, '#ffd45e', 28);
      spawnShockwave(JAR.canvasW / 2, 190, 140, '#ffe378', 3.4);

      queueBlessing(isRush ? '⚡ 极速订单达成' : '🎉 心愿订单达成');
      setTimeout(() => {
        if (gameState.running && !gameState.over && gameState.mode === 'chef') {
          generateOrder();
        }
      }, 950);
    }
  }

  function skipOrderFn() {
    if (gameState.skipCooldown > 0 || gameState.mode !== 'chef') return;
    gameState.skipCooldown = 25;
    app.showToast('📋 已为顾客更换新的星夜心愿单！');
    generateOrder();
  }

  // Score, Fever, Shop Events, Rush Gust
  function addScore(pts) {
    gameState.score += pts;
    if (gameState.score > app.getBestScore()) {
      setBestScore(gameState.score);
    }
    if (!gameState.running || gameState.over) return;

    if (gameState.mode === 'zen') {
      while (gameState.score >= gameState.zenNextMilestone) {
        const hit = gameState.zenNextMilestone;
        gameState.zenNextMilestone = hit < 1400 ? 1400 : hit < 2800 ? 2800 : hit < 4800 ? 4800 : hit + 3000;
        queueBlessing(`🍵 达成 ${hit} 分里程碑`);
      }
    }

    if (gameState.mode === 'rush') {
      while (gameState.score >= gameState.rushNextMilestone) {
        const hit = gameState.rushNextMilestone;
        gameState.rushNextMilestone = hit < 4200 ? 4200 : hit < 7500 ? 7500 : hit + 3500;
        queueBlessing(`⚡ 狂欢突破 ${hit} 分`);
      }
    }
  }

  function addFeverEnergy(amount) {
    if (gameState.feverTimer > 0) return;
    const feverLv = app.getPerkLevel('fever');
    const rushMult = gameState.mode === 'rush' ? 1.85 : 1.0;
    const meteorMult = gameState.activeEvent && gameState.activeEvent.kind === 'meteor' ? 1.3 : 1.0;
    const boosted = amount * (1 + feverLv * 0.28) * rushMult * meteorMult;
    gameState.feverEnergy = Math.min(100, gameState.feverEnergy + boosted);
    if (gameState.feverEnergy >= 100) {
      const lunaFeverBonus = saveData.selectedPatron === 'luna' ? 2.0 : 0;
      const dur = 10.0 + feverLv * 3.5 + lunaFeverBonus;
      gameState.feverMaxDuration = dur;
      gameState.feverTimer = dur;
      gameState.feverBonusUsed = 0;
      gameState.feverEnergy = 100;
      gameState.jarFlash = 0.75;
      gameState.screenShake = Math.max(gameState.screenShake, 5);
      audio.playFeverStart();
      audio.setFeverMode(true);
      platform.vibrateShort('medium');
      app.showToast(`🔥 星光磁吸狂热启动！${dur.toFixed(0)}秒连击最高 5× 积分！`);
      setPatronSpeech(app.activePatron, '哇啊——星光磁吸狂热开启啦！连击最高5倍冲呀！！', 4.8);
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffdf6b', 36);
      spawnShockwave(JAR.canvasW / 2, 260, 190, '#ffd85d', 4.5);
      showComboBanner('🔥 星光磁吸狂热!', '极速投放 · 最高 5× 积分', '#ffe36e');

      if (gameState.mode === 'rush') {
        queueBlessing('🔥 狂热充能达成');
      }
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
    Physics.clampBodyInsideJarPositional(entity, JAR);
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
    let kind = forcedKind;
    if (!kind) {
      const candidates = ['meteor', 'yarn', 'chime'].filter((k) => k !== gameState.lastEventKind);
      kind = candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (kind === 'yarn' && !forcedKind && (isJarNearDanger() || hasYarnBallInJar())) {
      kind = Math.random() < 0.5 ? 'meteor' : 'chime';
    }
    gameState.lastEventKind = kind;
    audio.playEventStart(kind);
    const activePatron = app.activePatron;

    if (kind === 'meteor') {
      gameState.activeEvent = { kind: 'meteor', timer: 12.0, maxTimer: 12.0 };
      let remaining = 4;
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
      showComboBanner('🌠 流星许愿夜!', '接下来的甜点75%镀金 · 狂热充能 +30%', '#ffe888');
      app.showToast('🌠 突发事件：流星许愿夜！黄金甜点雨与 +30% 狂热充能！');
      setPatronSpeech(activePatron, '快许愿呀！流星把面糊都镀上亮晶晶的金糖霜啦～', 4.4);
    } else if (kind === 'yarn') {
      gameState.activeEvent = { kind: 'yarn', timer: 0, maxTimer: 0 };
      const sx = 120 + Math.random() * 200;
      createYarnBallEntity(sx, JAR.neckY + 24);
      spawnSparkleBurst(sx, JAR.neckY + 28, '#ff9cb8', 18);
      showComboBanner('🧶 猫咪捣蛋时间!', '附近合成2次或摇罐震碎爆 +180分 · +18⭐', '#ffa8c4');
      app.showToast('🧶 突发事件：毛线球滚进罐里啦！附近合成2次即可震碎！');
      setPatronSpeech(activePatron, '呀！毛线球滚进去了！在它旁边合两次就能砰地炸出星尘！', 4.6);
    } else {
      gameState.activeEvent = { kind: 'chime', timer: 14.0, maxTimer: 14.0 };
      gameState.jarFlash = Math.max(gameState.jarFlash, 0.5);
      spawnSparkleBurst(JAR.canvasW / 2, JAR.neckY + 30, '#ffe072', 24);
      showComboBanner('🔔 黄金烘焙钟!', '14秒内全合成 +45% 得分 · 连击窗口 +0.5s', '#ffe26a');
      app.showToast('🔔 突发事件：黄金烘焙钟敲响！14 秒暴击得分 +45%！');
      setPatronSpeech(activePatron, '叮当～壁炉黄金钟响了！趁这 14 秒疯狂连锁清罐吧！', 4.4);
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
        spawnPopup(yb.x, yb.y - 24, `🧶 脆度 ${yb.yarnHp}/2`, '#ffb6d0', 14);
      } else {
        removedIds.add(yb.id);
        brokenCount++;
        audio.playYarnBreak();
        platform.vibrateShort('medium');

        const pts = Math.round(180 * app.getFeverMultiplier());
        const dust = addRunStardust(18);
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
        spawnPopup(yb.x, yb.y - 18, `🧶 爆裂! +${pts}分 +${dust}⭐`, '#ffe57e', 18);
        showComboBanner('🧶 毛线球大爆裂!', `+${pts} 分 · +${dust} ⭐ · +25% 狂热`, '#ffb3d6');
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
    showComboBanner('🌪️ 星风紧急吹散!', `清掉顶部 ${clearCount} 颗 · 扣除 5.0s`, '#ff9b82');
    app.showToast(`🌪️ 星风吹散！清除顶部 ${clearCount} 颗甜品并扣除 5.0 秒`);
  }

  // Tool Actions
  function armOrUseToolFn(key) {
    if (!gameState.running || gameState.over) return;
    if (app.activeModal === 'blessing') app.closeModal();
    audio.ensureCtx();

    if (gameState.activeToolMode === key) {
      cancelToolMode();
      return;
    }

    if (gameState.tools[key] <= 0) {
      const cost = gameState.toolCosts[key];
      if (gameState.stardust < cost) {
        app.showToast(`⭐ 星尘币不足（需要 ${cost} ⭐）`);
        return;
      }
      gameState.stardust -= cost;
      gameState.tools[key] = 1;
      app.showToast(`⭐ 消耗 ${cost} 星尘补充了 1 次道具！`);
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
      app.showToast('🔔 叮铃！玻璃罐轻轻摇晃起来了！');
      return;
    }

    gameState.activeToolMode = key;
  }

  function cancelToolMode() {
    gameState.activeToolMode = null;
    gameState.hoveredEntityId = null;
  }

  function swapHoldPocketFn() {
    if (!gameState.running || gameState.over || gameState.activeToolMode) return;
    if (app.activeModal === 'blessing') app.closeModal();
    if (!gameState.canHoldThisTurn) {
      app.showToast('放下一颗甜品后才能再次交换暂存哦～');
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

  function getAimTotalAngle() {
    return Math.max(-0.78, Math.min(0.78, gameState.aimAngle));
  }

  function getCurrentDropRadius() {
    return gameState.curMeta && gameState.curMeta.wildcard ? WILDCARD_RADIUS : TIERS[gameState.curTier - 1].radius;
  }

  function getCurrentDropShapeDef() {
    return gameState.curMeta && gameState.curMeta.wildcard ? getShapeDef(1) : getShapeDef(gameState.curTier);
  }

  function clampDropX() {
    const r = getCurrentDropRadius();
    const shapeDef = getCurrentDropShapeDef();
    let leftExt = r;
    let rightExt = r;
    if (shapeDef && Physics) {
      const ex = Physics.getRotatedHalfExtentsX(shapeDef, r, getAimTotalAngle());
      leftExt = ex.leftExtent;
      rightExt = ex.rightExtent;
    }
    const minX = JAR.left + leftExt + 4;
    const maxX = JAR.right - rightExt - 4;
    gameState.dropX = Math.max(minX, Math.min(maxX, gameState.dropX));
  }

  function adjustAimAngle(deltaRad) {
    if (!gameState.running || gameState.over || gameState.activeToolMode) return;
    const next = Math.max(-0.78, Math.min(0.78, gameState.aimAngle + deltaRad));
    if (Math.abs(next - gameState.aimAngle) > 1e-4) {
      gameState.aimAngle = next;
      clampDropX();
      audio.ensureCtx();
      audio.playTilt();
    }
  }

  function updateDropPointerX(newX) {
    gameState.prevDropX = gameState.dropX;
    gameState.dropX = newX;
    clampDropX();
    const dx = gameState.dropX - gameState.prevDropX;
    if (Math.abs(dx) > 0.5) {
      gameState.dropSway = Math.max(-0.14, Math.min(0.14, gameState.dropSway - dx * 0.0045));
    }
  }

  function createEntity(tier, x, y, vx = 0, vy = 0, bornFromMerge = false, initialAngle = 0, initialVr = 0, meta = {}) {
    const isWildcard = !!meta.wildcard;
    const isGolden = !isWildcard && !!meta.golden;
    const def = TIERS[tier - 1];
    const eqR = isWildcard ? WILDCARD_RADIUS : def.radius;
    const shapeDef = isWildcard ? getShapeDef(1) : getShapeDef(tier);
    const mat = isWildcard ? { friction: 0.14, restitution: 0.36 } : def.material;

    const entity = {
      id: gameState.nextEntityId++,
      tier,
      isWildcard,
      isGolden,
      hasCollided: !!bornFromMerge,
      bornFromMerge: !!bornFromMerge,
      inBakeZoneBonus: !!meta.inBakeZone,
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
      age: 0,
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
    if (bornFromMerge) {
      Physics.clampBodyInsideJarPositional(entity, JAR);
    }
    gameState.entities.push(entity);
    if (!isWildcard) unlockTier(tier);
    return entity;
  }

  function dropCurrentTreat() {
    if (!gameState.running || gameState.over || gameState.paused) return;
    if (gameState.activeToolMode || gameState.dropCooldown > 0 || isWaitingForLanding()) {
      gameState.waitingForLanding = isWaitingForLanding();
      return;
    }

    audio.ensureCtx();
    clampDropX();
    const totalAngle = getAimTotalAngle();
    const curMeta = gameState.curMeta || { wildcard: false, golden: false };

    const isSameSpot = gameState.lastDropX !== null && Math.abs(gameState.dropX - gameState.lastDropX) <= 24;
    gameState.sameSpotStreak = isSameSpot ? gameState.sameSpotStreak + 1 : 0;
    gameState.lastDropX = gameState.dropX;

    let dropVx = 0;
    let dropVr = 0;
    if (gameState.sameSpotStreak === 3) {
      app.showToast('⚠️ 一直点同一个地方很难连锁！试试左右换位或 ↺/↻ 倾角～');
    } else if (gameState.sameSpotStreak >= 4) {
      dropVx = (Math.random() < 0.5 ? -1 : 1) * (65 + Math.random() * 55);
      dropVr = (Math.random() - 0.5) * 4.2;
      spawnPopup(gameState.dropX, JAR.neckY + 14, '🔥 连点过热偏移!', '#ff9678', 13);
    }

    let inBakeZone = false;
    const bz = gameState.bakeZone;
    if (bz && gameState.sameSpotStreak < 4 && Math.abs(gameState.dropX - bz.x) <= bz.w * 0.5) {
      inBakeZone = true;
      const zoneDust = addRunStardust(2);
      addScore(18 + gameState.curTier * 6);
      addFeverEnergy(7);
      spawnSparkleBurst(gameState.dropX, JAR.neckY + 28, '#ffe588', 12);
      spawnPopup(gameState.dropX, JAR.neckY + 30, `🎯 星光位 +${zoneDust}⭐`, '#ffe98a', 14);
      rotateBakeZone(bz.colIdx, gameState.dropX);
    } else if (bz) {
      bz.turnsLeft--;
      if (bz.turnsLeft <= 0) {
        rotateBakeZone(bz.colIdx, gameState.dropX);
      }
    }

    const dropped = createEntity(
      gameState.curTier,
      gameState.dropX,
      JAR.dropY,
      dropVx,
      310,
      false,
      totalAngle,
      dropVr,
      { ...curMeta, inBakeZone }
    );
    gameState.lastDroppedId = dropped.id;
    gameState.waitingForLanding = true;
    gameState.dropsMadeThisRun++;
    audio.playDrop(curMeta.wildcard, curMeta.golden);

    if (gameState.order && !gameState.order.completed && gameState.order.rushDropsLeft > 0) {
      gameState.order.rushDropsLeft = Math.max(0, gameState.order.rushDropsLeft - 1);
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
      app.showToast('🌈 星露蓄满！下一颗必出【彩虹万能糖】！');
    }

    if (gameState.mode !== 'rush' && !gameState.activeEvent) {
      gameState.nextEventDrops--;
      if (gameState.nextEventDrops <= 0) {
        gameState.nextEventDrops = 14 + Math.floor(Math.random() * 6);
        triggerShopEvent();
      }
    }

    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.canHoldThisTurn = true;
    const isFever = gameState.feverTimer > 0;
    if (gameState.mode === 'rush') {
      gameState.dropCooldown = isFever ? 0.14 : 0.18;
    } else {
      gameState.dropCooldown = isFever ? 0.18 : 0.24;
    }
    gameState.heldActionAnim = null;
    gameState.heldActionCooldown = 1.5 + Math.random() * 1.5;
    clampDropX();
  }

  // Particles & FX
  function spawnSparkleBurst(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
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

  function showComboBanner(text, sub = '', color = '#ffe56b') {
    gameState.comboBanner = { text, sub, color, life: 1.35, maxLife: 1.35 };
  }

  function applyMergeShockwaveImpulse(mx, my, bornR, nextTier, excludeId) {
    const shockLv = app.getPerkLevel('shockwave');
    const isFever = gameState.feverTimer > 0;
    const mugiBoost = saveData.selectedPatron === 'mugi' && nextTier >= 4 ? 1.3 : 1.0;
    const blastRadius = bornR * (2.35 + shockLv * 0.55) + 40;
    const baseForce = (55 + nextTier * 18 + shockLv * 52 + (isFever ? 32 : 0)) * mugiBoost;

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

  // Step Physics World
  function stepPhysics(dt) {
    const magnetLv = app.getEffectiveMagnetLevel();
    const isFever = gameState.feverTimer > 0;
    const magnetRange = magnetLv > 0 || isFever ? magnetLv * 14 + (isFever ? 28 : 0) : 0;
    const magnetForce = magnetLv > 0 || isFever ? 420 + magnetLv * 280 + (isFever ? 640 : 0) : 0;

    const result = Physics.stepWorld(gameState.entities, JAR, dt, 1880, { magnetRange, magnetForce });
    const { mergePairs, impacts, debugContacts, magnetLinks } = result;
    gameState.lastDebugContacts = debugContacts;
    gameState.magnetLinks = magnetLinks || [];

    if (impacts.length > 0) {
      let strongest = impacts[0];
      for (let i = 0; i < impacts.length; i++) {
        const imp = impacts[i];
        if (imp.speed > strongest.speed) strongest = imp;
        applyDirectionalSquish(imp.bodyB, imp.nx, imp.ny, imp.speed);
        if (imp.bodyA) applyDirectionalSquish(imp.bodyA, -imp.nx, -imp.ny, imp.speed);
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
      const upComboBonus = SHOP_UPGRADES.find((u) => u.id === 'up_combo').values[app.getUpgradeLevel('up_combo')] || 0;
      const isChimeEvent = !!(gameState.activeEvent && gameState.activeEvent.kind === 'chime');
      const chimeScoreMult = isChimeEvent ? 1.45 : 1.0;
      const chimeComboBonus = isChimeEvent ? 0.5 : 0;

      gameState.entities = gameState.entities.filter((e) => !e.merged);
      for (const [a, b] of mergePairs) {
        const isTwinWild = !!(a.isWildcard && b.isWildcard);
        const isWildMerge = !isTwinWild && !!(a.isWildcard || b.isWildcard);
        const isGoldenMerge = !!(a.isGolden || b.isGolden);

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

        if (saveData.selectedPatron === 'mugi' && gameState.comboCount >= 3) {
          if (gameState.mode === 'rush') {
            addScore(60);
            spawnPopup(mx + 26, my - 26, '🍯 +60分!', '#ffd27a', 13);
          } else {
            const mugiDust = addRunStardust(4);
            spawnPopup(mx + 26, my - 26, `🍯 +${mugiDust}⭐`, '#ffd27a', 13);
          }
        }

        const feverMult = app.getFeverMultiplier();
        const comboStep = 0.28 + comboLv * 0.22;
        const comboBonus = 1 + Math.min(2.2, (gameState.comboCount - 1) * comboStep);

        if (gameState.feverTimer > 0 && gameState.comboCount >= 3 && gameState.feverBonusUsed < 4.5) {
          const ext = 0.8;
          gameState.feverTimer += ext;
          gameState.feverMaxDuration = Math.max(gameState.feverMaxDuration, gameState.feverTimer);
          gameState.feverBonusUsed += ext;
          audio.playFeverExtend();
          spawnPopup(JAR.canvasW / 2, 118, '🔥 狂热延时 +0.8s!', '#ffdf6b', 15);
        }

        const rainbowComboReq = rainbowLv > 0 ? 3 : 4;
        if (gameState.comboCount >= rainbowComboReq && !gameState.comboRainbowGranted) {
          gameState.comboRainbowGranted = true;
          grantNextRainbow(`${gameState.comboCount}连合奖励`);
        }

        damageNearbyYarnBalls(mx, my, 95, false);

        if (isTwinWild) {
          const born = createEntity(5, mx, my, mvx, mvy - 30, true, 0, 0, { golden: true });
          const zoneMult = a.inBakeZoneBonus || b.inBakeZoneBonus ? 1.35 : 1.0;
          const pts = Math.round(320 * feverMult * comboBonus * chimeScoreMult * zoneMult);
          addScore(pts);
          addRunStardust(24);
          addFeverEnergy(45);
          audio.playWildcard();
          spawnSparkleBurst(mx, my, '#ff99cc', 22);
          spawnSparkleBurst(mx, my, '#ffe378', 22);
          spawnShockwave(mx, my, 130, '#ff99cc', 4.5);
          spawnShockwave(mx, my, 92, '#ffe378', 3.2);
          applyMergeShockwaveImpulse(mx, my, born.r, 5, born.id);
          gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.048);
          gameState.screenShake = Math.max(gameState.screenShake, 5.5);
          gameState.jarFlash = Math.max(gameState.jarFlash, 0.65);
          showComboBanner('🌈 双彩虹奇迹!', `黄金草莓大福诞生 +${pts}`, '#ff9fd2');
          spawnPopup(mx, my - 30, `🌈 双虹奇迹! +${pts}`, '#ffe57e', 20);
          notifyTreatSynthesized(5, born);
          continue;
        }

        const baseTier = targetBody ? targetBody.tier : a.tier;
        if (baseTier < 9) {
          const critChance = critLv * 0.14;
          const isCrit = baseTier <= 7 && critChance > 0 && Math.random() < critChance;
          const nextTier = Math.min(9, baseTier + (isCrit ? 2 : 1));
          const def = TIERS[nextTier - 1];
          const inheritGold = isGoldenMerge && Math.random() < 0.22 + goldenLv * 0.12;
          const born = createEntity(nextTier, mx, my, mvx, mvy, true, mAngle, mVr, { golden: inheritGold });

          const goldMult = isGoldenMerge ? 2.5 : 1;
          const critMult = isCrit ? 2.0 : 1;
          const zoneMult = a.inBakeZoneBonus || b.inBakeZoneBonus ? 1.35 : 1.0;
          const pts = Math.round(def.points * feverMult * comboBonus * goldMult * critMult * chimeScoreMult * zoneMult);
          addScore(pts);

          let dustBase = nextTier >= 4 ? Math.max(1, Math.floor(nextTier / 2)) : 0;
          if (isGoldenMerge) dustBase += 12 + goldenLv * 10;
          const dustGain = dustBase > 0 ? addRunStardust(dustBase) : 0;
          addFeverEnergy(5.5 + nextTier * 2.3 + (isGoldenMerge ? 26 : 0) + (isWildMerge ? 14 : 0));

          if (isCrit) audio.playCritJump();
          else if (isWildMerge) audio.playWildcard();
          else if (isGoldenMerge) audio.playGoldenMerge();
          else audio.playMerge(nextTier, gameState.comboCount, false);

          if (gameState.comboCount >= 3 || nextTier >= 6 || isCrit) {
            platform.vibrateShort('light');
          }

          spawnSparkleBurst(mx, my, isGoldenMerge ? '#ffe066' : def.color, 14 + nextTier * 2);
          if (isWildMerge || isCrit) spawnSparkleBurst(mx, my, '#ff99cc', 16);
          spawnShockwave(
            mx,
            my,
            def.radius * 1.9 + 26 + app.getPerkLevel('shockwave') * 12,
            isWildMerge ? '#ff99cc' : isGoldenMerge ? '#ffe169' : def.color,
            isCrit || isGoldenMerge ? 4.4 : 3.2
          );
          if (nextTier >= 5 || gameState.comboCount >= 2 || isCrit || isGoldenMerge) {
            spawnShockwave(mx, my, def.radius * 1.3 + 16, '#fff4bf', 2.2);
          }
          applyMergeShockwaveImpulse(mx, my, def.radius, nextTier, born.id);

          if (isCrit || nextTier >= 7 || gameState.comboCount >= 4) {
            gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.045);
            gameState.screenShake = Math.max(gameState.screenShake, 5.2);
            gameState.jarFlash = Math.max(gameState.jarFlash, 0.45);
          } else if (isWildMerge || isGoldenMerge || nextTier >= 5 || gameState.comboCount >= 2) {
            gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.025);
            gameState.screenShake = Math.max(gameState.screenShake, 3.0);
          } else {
            gameState.screenShake = Math.max(gameState.screenShake, 1.3);
          }

          let label = isChimeEvent ? `🔔 +${pts}` : `+${pts}`;
          let popColor = isChimeEvent ? '#ffe778' : '#ffffff';
          let popSize = 15;
          if (isCrit) {
            label = `⚡ 奇迹跳阶+2! +${pts}`;
            popColor = '#ffe46b';
            popSize = 19;
            showComboBanner(`⚡ 奇迹跳阶 · ${def.name}!`, `双倍暴击 +${pts}`, '#ffe46b');
          } else if (isGoldenMerge) {
            label = `✨ 黄金×2.5! +${pts}`;
            popColor = '#ffe678';
            popSize = 18;
            showComboBanner(`✨ 黄金暴击 ×2.5!`, `+${pts}分 · +${dustGain}⭐`, '#ffe272');
          } else if (isWildMerge) {
            label = `🌈 彩虹升阶! +${pts}`;
            popColor = '#ffb7e2';
            popSize = 18;
            showComboBanner(`🌈 彩虹万能升阶!`, `${def.name} +${pts}`, '#ffb7e2');
          } else if (gameState.comboCount >= 2) {
            label = `${gameState.comboCount}连合! +${pts}`;
            popColor = '#ffe46b';
            popSize = 17 + Math.min(4, gameState.comboCount - 2);
            const subTxt = gameState.feverTimer > 0
              ? `狂热 ${feverMult.toFixed(1).replace('.0', '')}× 倍率爆发中!`
              : gameState.comboCount >= 3
              ? '多米诺大连锁!'
              : '丝滑连击!';
            showComboBanner(`${gameState.comboCount} 连合!!`, subTxt, gameState.comboCount >= 4 ? '#ff9fd2' : '#ffe46b');
          }
          spawnPopup(mx, my - def.radius * 0.6, label, popColor, popSize);

          if (nextTier === 9) {
            gameState.soufflesMadeThisRun++;
            saveData.lifetimeStats.soufflesMade = (saveData.lifetimeStats.soufflesMade || 0) + 1;
            persistSaveData();
            app.showToast('👑 奇迹诞生！合成传说级【星冠猫神舒芙蕾】！');
            setPatronSpeech(app.activePatron, '哇！！星冠猫神舒芙蕾诞生了！整座甜品屋都在发光！', 5.0);
            showComboBanner('👑 星冠猫神诞生!', '传说级至高甜点!', '#ffe46b');
          }
          notifyTreatSynthesized(nextTier, born);
        } else {
          const pts = Math.round((isWildMerge ? 1200 : 1800) * feverMult * comboBonus * chimeScoreMult);
          addScore(pts);
          addRunStardust(55);
          addFeverEnergy(65);
          audio.playSupernova();
          platform.vibrateShort('heavy');
          spawnSparkleBurst(mx, my, '#ffe378', 48);
          spawnShockwave(mx, my, 210, '#ffe378', 5.5);
          spawnShockwave(mx, my, 150, '#ff9fd2', 3.5);
          gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.06);
          gameState.screenShake = Math.max(gameState.screenShake, 7.5);
          gameState.jarFlash = Math.max(gameState.jarFlash, 0.85);
          spawnPopup(mx, my, `👑 星冠超新星! +${pts}`, '#ffe570', 22);
          showComboBanner('👑 星冠超新星!!', `+${pts}分 · 净化罐内小甜点`, '#ffe570');
          app.showToast('🌟 传说奇景！星冠猫神引发了甜品超新星！');
          gameState.entities = gameState.entities.filter((e) => {
            if (!e.isWildcard && !e.isYarnBall && e.tier <= 2 && Math.hypot(e.x - mx, e.y - my) < 190) {
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
      if (e.age < 0.45 && e.vy > 140) {
        e.trail.push({ x: e.x, y: e.y });
        if (e.trail.length > 6) e.trail.shift();
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
      if (gameState.dangerDuration > 2.65) {
        if (gameState.mode === 'rush') triggerRushEmergencyGust();
        else triggerGameOver();
      }
    } else {
      gameState.dangerDuration = Math.max(0, gameState.dangerDuration - dt * 2.2);
    }

    const overflowDanger = Math.max(0, Math.min(1, (gameState.dangerDuration - 0.45) / 2.1));
    const rushDanger =
      gameState.mode === 'rush' && gameState.rushTimer <= 15.0
        ? Math.min(1, 0.35 + ((15.0 - gameState.rushTimer) / 15.0) * 0.65)
        : 0;
    audio.setDangerLevel(Math.max(overflowDanger, rushDanger));
    gameState.waitingForLanding = isWaitingForLanding();
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
      if (e.isWildcard || e.isYarnBall) {
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
      if (!a || !b || a.id === b.id || a.merged || b.merged || a.isWildcard || b.isWildcard || a.isYarnBall || b.isYarnBall) return;
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
      if (a.isWildcard || a.isYarnBall) continue;
      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (b.isWildcard || b.isYarnBall) continue;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist <= (a.r + b.r) * 1.09 && dist > 1e-3) {
          addPair(a, b, (a.x * b.r + b.x * a.r) / (a.r + b.r), (a.y * b.r + b.y * a.r) / (a.r + b.r));
        }
      }
    }

    const styles = ['nuzzle', 'boop', 'chat'];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.anim || e.merged || e.isWildcard || e.isYarnBall) continue;
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

  function triggerGameOver() {
    if (gameState.over) return;
    gameState.over = true;
    gameState.running = false;
    gameState.paused = false;
    cancelToolMode();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    audio.playGameOver();

    const bestBefore = app.getBestScore();
    const isNewBest = gameState.score > 0 && gameState.score >= bestBefore;
    setBestScore(gameState.score);

    const scorePart = Math.floor(gameState.score / 260);
    const dustPart = Math.floor(gameState.stardust * 0.35);
    const souffleBonus = gameState.soufflesMadeThisRun > 0 ? 25 : 0;
    const rushBonus = gameState.mode === 'rush' && gameState.rushFinished ? 10 : 0;
    let rawEarned = scorePart + dustPart + souffleBonus + rushBonus;
    let pityApplied = false;
    if (gameState.dropsMadeThisRun >= 5 && rawEarned < 15) {
      rawEarned = 15;
      pityApplied = true;
    }
    const dustMult = getDustMultiplier();
    const finalEarned = Math.round(rawEarned * dustMult);

    saveData.bankStardust = (saveData.bankStardust || 0) + finalEarned;
    saveData.lifetimeStats.runsPlayed = (saveData.lifetimeStats.runsPlayed || 0) + 1;
    saveData.lifetimeStats.ordersCompleted = (saveData.lifetimeStats.ordersCompleted || 0) + gameState.ordersCompleted;
    saveData.lifetimeStats.maxComboEver = Math.max(saveData.lifetimeStats.maxComboEver || 1, gameState.maxCombo);
    persistSaveData();

    const parts = [];
    if (pityApplied) {
      parts.push('营业保底 15⭐');
    } else {
      parts.push(`得分+${scorePart}`);
      if (dustPart > 0) parts.push(`余尘+${dustPart}`);
      if (souffleBonus > 0) parts.push(`猫神+${souffleBonus}`);
      if (rushBonus > 0) parts.push(`狂欢完赛+${rushBonus}`);
    }
    if (dustMult > 1) parts.push(`糖霜壶×${dustMult.toFixed(2).replace(/0$/, '')}`);

    app.goSettlement = {
      isNewBest,
      finalEarned,
      detailText: `${parts.join(' · ')} → 已存入银行（余额：${saveData.bankStardust} ⭐）`,
      hasAffordable: hasAffordableShopItem()
    };
    app.openModal('gameover');
  }

  function startNewRunFn(mode = gameState.mode) {
    gameState.mode = mode;
    gameState.running = true;
    gameState.paused = false;
    gameState.over = false;
    gameState.score = 0;
    gameState.displayScore = 0;
    gameState.stardust = 30;
    gameState.dropsMadeThisRun = 0;
    gameState.soufflesMadeThisRun = 0;
    gameState.yarnBrokenThisRun = 0;

    const upFeverLv = app.getUpgradeLevel('up_fever');
    const startFeverEnergy = SHOP_UPGRADES.find((u) => u.id === 'up_fever').values[upFeverLv] || 0;
    gameState.feverEnergy = startFeverEnergy;
    gameState.feverTimer = 0;
    gameState.feverMaxDuration = 10.0;
    gameState.feverBonusUsed = 0;

    gameState.comboCount = 0;
    gameState.comboTimer = 0;
    gameState.comboRainbowGranted = false;
    gameState.maxCombo = 1;
    gameState.ordersCompleted = 0;
    gameState.maxTierRun = 4;
    gameState.seenThisRun = new Set([1, 2, 3, 4]);

    const upToolsLv = app.getUpgradeLevel('up_tools');
    gameState.tools = {
      shake: 2 + (upToolsLv >= 1 ? 1 : 0),
      fork: 2 + (upToolsLv >= 2 ? 1 : 0) + (saveData.selectedPatron === 'mikan' ? 1 : 0),
      spoon: 1 + (upToolsLv >= 3 ? 1 : 0)
    };

    gameState.activeToolMode = null;
    gameState.dropX = 220;
    gameState.prevDropX = 220;
    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.lastDebugContacts = [];
    gameState.magnetLinks = [];
    gameState.perks = {};
    gameState.pendingBlessings = 0;
    gameState.blessingChoices = [];
    gameState.blessingLastReason = '';
    gameState.blessingSubText = '';
    gameState.blessingLockUntil = 0;

    gameState.zenNextMilestone = 500;
    gameState.rushTimer = 90.0;
    gameState.rushFinished = false;
    gameState.rushGustCooldown = 0;
    gameState.rushNextMilestone = 1800;
    gameState.rushLastTickSec = 6;

    gameState.activeEvent = null;
    gameState.lastEventKind = null;
    gameState.nextEventDrops = 10 + Math.floor(Math.random() * 5);
    gameState.nextEventTimer = 18.0;
    gameState.meteorGoldenLeft = 0;
    gameState.shootingStars = [];

    gameState.hitstopTimer = 0;
    gameState.screenShake = 0;
    gameState.jarFlash = 0;
    gameState.shockwaves = [];
    gameState.comboBanner = null;
    gameState.dropsUntilRainbow = getRainbowPityBase();
    const firstNext = pickDropBundle(false);
    gameState.curTier = 1 + Math.floor(Math.random() * 2);
    gameState.curMeta = { wildcard: false, golden: false };
    gameState.nextTier = firstNext.tier;
    gameState.nextMeta = firstNext.meta;
    gameState.holdTier = null;
    gameState.holdMeta = null;
    gameState.canHoldThisTurn = true;
    gameState.dropCooldown = 0;
    gameState.lastDroppedId = null;
    gameState.waitingForLanding = false;
    gameState.lastDropX = null;
    gameState.sameSpotStreak = 0;
    rotateBakeZone(-1);
    gameState.dangerDuration = 0;
    gameState.jarShakeAmp = 0;
    gameState.entities = [];
    gameState.particles = [];
    gameState.popups = [];
    gameState.skipCooldown = 0;

    app.goSettlement = null;
    app.activeModal = null;
    app.isLobbyOpen = false;
    app.syncAudioMood();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    audio.unlock();

    const activePatron = app.activePatron;
    if (mode === 'chef') {
      generateOrder();
    } else if (mode === 'rush') {
      gameState.order = null;
      setPatronSpeech(activePatron, `⚡ 90秒狂欢开跑！${activePatron.shortName}助阵冲分，溢罐吹散不秒死！`, 5.0);
    } else {
      gameState.order = null;
      setPatronSpeech(activePatron, `悠闲经典开启！${activePatron.shortName}陪你慢慢叠搭拿三选一祝福～`, 5.0);
    }
  }

  // Tool Canvas Targeting Click
  function findEntityAt(x, y) {
    for (let i = gameState.entities.length - 1; i >= 0; i--) {
      const e = gameState.entities[i];
      if (Physics.pointInBody(e, x, y, 5)) return e;
    }
    return null;
  }

  function handleToolCanvasClick(lx, ly) {
    const target = findEntityAt(lx, ly);
    if (!target) {
      app.showToast('请点击罐内的甜品哦～');
      return;
    }
    if (target.isYarnBall) {
      app.showToast('🧶 毛线球请在附近合成 2 次或使用【摇一摇】震碎！');
      return;
    }

    if (gameState.activeToolMode === 'fork') {
      if (target.isWildcard || target.tier > 4) {
        app.showToast('🫧 泡泡叉只能消除 1~4 阶普通甜品哦！');
        return;
      }
      if (gameState.tools.fork <= 0) return;
      gameState.tools.fork--;
      audio.playTool('fork');
      spawnSparkleBurst(target.x, target.y, '#9be8ff', 18);
      spawnShockwave(target.x, target.y, target.r * 1.9, '#9be8ff', 3);
      spawnPopup(target.x, target.y, '🫧 消除!', '#b4f4ff', 15);
      gameState.entities = gameState.entities.filter((e) => e.id !== target.id);
      cancelToolMode();
      return;
    }

    if (gameState.activeToolMode === 'spoon') {
      if (target.isWildcard) {
        app.showToast('🌈 彩虹万能糖碰到任意甜品就会自动升阶，无需升阶勺！');
        return;
      }
      if (target.tier >= 9) {
        app.showToast('👑 已经是最高阶星冠猫神舒芙蕾啦！');
        return;
      }
      if (gameState.tools.spoon <= 0) return;
      gameState.tools.spoon--;
      const nextTier = target.tier + 1;
      const def = TIERS[nextTier - 1];
      target.tier = nextTier;
      target.creditedToOrder = false;
      Physics.configureBodyShape(target, getShapeDef(nextTier), def.radius, def.material);
      Physics.clampBodyInsideJarPositional(target, JAR);
      target.squishAmt = 0.24;
      target.squishVel = 0;
      target.squishAngle = Math.PI * 0.5;

      const pts = Math.round(def.points * app.getFeverMultiplier());
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
      spawnPopup(target.x, target.y - target.r * 0.5, `✨ 升阶! +${pts}`, '#ffe470', 17);
      notifyTreatSynthesized(nextTier, target);
      cancelToolMode();
    }
  }

  // Unified Pointer & Touch Event Handling
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

  platform.bindPointerEvents(canvas, {
    onDown: ({ x, y, pointerType }) => {
      audio.unlock();
      const hit = hits.findAt(x, y);
      dragStartPos = { x, y, lastY: y, active: true };
      uiDragMoved = false;
      pendingUiHit = hit;

      if (app.activeModal) {
        return;
      }

      if (hit) {
        return;
      }

      if (!app.isLobbyOpen && gameState.running && !gameState.over && !gameState.paused) {
        const { lx, ly } = toJarLogical(x, y);
        if (gameState.activeToolMode) {
          handleToolCanvasClick(lx, ly);
          return;
        }
        if (ly >= -30 && ly <= JAR.floorY + 24 && lx >= -30 && lx <= JAR.canvasW + 30) {
          updateDropPointerX(lx);
          aimingState = { active: true, pointerType, lastStableX: gameState.dropX };
          if (pointerType === 'touch') {
            gameState.touchAim.active = true;
            gameState.touchAim.cancelled = ly < JAR.neckY - 22;
            gameState.touchAim.lastStableX = gameState.dropX;
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
        if (gameState.activeToolMode) {
          const hitEntity = findEntityAt(lx, ly);
          gameState.hoveredEntityId = hitEntity ? hitEntity.id : null;
          return;
        }
        if (aimingState.active) {
          if (pointerType === 'touch') {
            gameState.touchAim.cancelled = ly < JAR.neckY - 22;
          }
          updateDropPointerX(lx);
          aimingState.lastStableX = gameState.dropX;
          gameState.touchAim.lastStableX = gameState.dropX;
        } else if (pointerType === 'mouse' && lx >= 0 && lx <= JAR.canvasW && ly >= -30 && ly <= JAR.floorY + 20) {
          updateDropPointerX(lx);
        }
      }
    },

    onUp: ({ x, y, pointerType }) => {
      dragStartPos.active = false;
      if (app.activeModal) {
        if (!uiDragMoved && pendingUiHit) {
          if (pendingUiHit.id === 'modal_backdrop') {
            if (app.activeModal !== 'gameover') app.closeModal();
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
        aimingState.active = false;
        gameState.touchAim.active = false;
        gameState.touchAim.cancelled = false;
        return;
      }

      if (aimingState.active) {
        const { lx, ly } = toJarLogical(x, y);
        const cancelled = pointerType === 'touch' && (gameState.touchAim.cancelled || ly < JAR.neckY - 22);
        const targetX =
          pointerType === 'touch' && Math.abs(lx - aimingState.lastStableX) <= 10 ? aimingState.lastStableX : lx;
        aimingState.active = false;
        gameState.touchAim.active = false;
        gameState.touchAim.cancelled = false;
        if (cancelled) return;
        updateDropPointerX(targetX);
        dropCurrentTreat();
      }
    },

    onCancel: () => {
      dragStartPos.active = false;
      pendingUiHit = null;
      aimingState.active = false;
      gameState.touchAim.active = false;
      gameState.touchAim.cancelled = false;
    },

    onWheel: (_x, _y, deltaY) => {
      if (app.activeModal && app.modalMaxScroll > 0) {
        app.modalScrollY = Math.max(0, Math.min(app.modalMaxScroll, app.modalScrollY + deltaY * 0.6));
        return;
      }
      if (!app.isLobbyOpen && gameState.running && !gameState.over && !gameState.paused && !gameState.activeToolMode) {
        adjustAimAngle(deltaY > 0 ? 0.14 : -0.14);
      }
    }
  });

  // Keyboard support for DevTools / PC Mini Game
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
      cancelToolMode();
      return;
    }
    if (key === 'p' || key === 'P') {
      if (!app.isLobbyOpen) {
        if (ev && ev.preventDefault) ev.preventDefault();
        app.toggleDebugPhysics();
      }
      return;
    }
    if (!gameState.running || gameState.over || app.isLobbyOpen) return;
    if (app.activeModal === 'blessing') {
      if (key === '1' || key === '2' || key === '3') {
        const ch = gameState.blessingChoices[Number(key) - 1];
        if (ch) app.applyBlessing(ch.id);
      }
      return;
    }
    if (app.activeModal) return;

    if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
      if (ev && ev.preventDefault) ev.preventDefault();
      updateDropPointerX(gameState.dropX - 22);
    } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
      if (ev && ev.preventDefault) ev.preventDefault();
      updateDropPointerX(gameState.dropX + 22);
    } else if (key === 'q' || key === 'Q') {
      if (ev && ev.preventDefault) ev.preventDefault();
      adjustAimAngle(-0.14);
    } else if (key === 'e' || key === 'E') {
      if (ev && ev.preventDefault) ev.preventDefault();
      adjustAimAngle(0.14);
    } else if (key === ' ' || key === 'ArrowDown' || key === 'Enter') {
      if (ev && ev.preventDefault) ev.preventDefault();
      dropCurrentTreat();
    } else if (key === 'h' || key === 'H' || key === 'Shift') {
      if (ev && ev.preventDefault) ev.preventDefault();
      app.swapHoldPocket();
    } else if (key === 'b' || key === 'B') {
      if (gameState.pendingBlessings > 0) app.openBlessingModal();
    } else if (key === '1') app.armOrUseTool('shake');
    else if (key === '2') app.armOrUseTool('fork');
    else if (key === '3') app.armOrUseTool('spoon');
  });

  // Main Animation Loop
  let lastFrameMs = Date.now();
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(() => fn(Date.now()), 16);

  let mainLoopErrorLogged = false;
  function runFrame() {
    const nowMs = Date.now();
    const dt = Math.max(0.001, Math.min(0.033, (nowMs - lastFrameMs) / 1000));
    lastFrameMs = nowMs;
    const nowSec = nowMs / 1000;

    if (app.toastTimer > 0) app.toastTimer = Math.max(0, app.toastTimer - dt);
    if (app.lobbyBounceT > 0) {
      app.lobbyBounceT += dt * 1.8;
      if (app.lobbyBounceT >= 1) app.lobbyBounceT = 0;
    }

    if (gameState.running && !gameState.over && !gameState.paused) {
      if (gameState.dropCooldown > 0) gameState.dropCooldown = Math.max(0, gameState.dropCooldown - dt);
      if (gameState.rushGustCooldown > 0) gameState.rushGustCooldown = Math.max(0, gameState.rushGustCooldown - dt);
      gameState.dropSway *= Math.exp(-dt * 11);
      if (Math.abs(gameState.dropSway) < 0.001) gameState.dropSway = 0;

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
          app.showToast('🌙 星光磁吸狂热结束，继续连合积攒能量吧！');
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
            if (endedKind === 'chime') app.showToast('🔔 黄金烘焙钟余韵渐散，继续加油！');
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
          triggerGameOver();
        }
      }

      if (!gameState.over) {
        if (gameState.hitstopTimer > 0) gameState.hitstopTimer = Math.max(0, gameState.hitstopTimer - dt);
        else stepPhysics(dt);
        updateDessertAnimations(dt);
      }
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
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.crumb ? 380 : 260) * dt;
      if (p.crumb) p.vx *= 0.94;
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

    ModalsUI.renderActiveModal(ctx, metrics, app, hits);

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

  // Lifecycle & WeChat Share setup
  platform.bindLifecycle(
    () => audio.setTabHidden(false),
    () => audio.setTabHidden(true)
  );
  platform.setupShare(() => ({
    title: gameState.score > 0
      ? `🌙 我在星夜吃茶拿下了 ${gameState.score} 分！来一起烤制星冠猫神舒芙蕾～`
      : '🌙 星夜吃茶 · 喵呜甜品合合乐｜手绘治愈系物理合成小游戏'
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
      activeShopTab: app.activeShopTab,
      mode: gameState.mode,
      running: gameState.running,
      paused: gameState.paused,
      over: gameState.over,
      score: gameState.score,
      stardust: gameState.stardust,
      dropsMadeThisRun: gameState.dropsMadeThisRun,
      feverEnergy: +gameState.feverEnergy.toFixed(1),
      feverTimer: +gameState.feverTimer.toFixed(2),
      rushTimer: +gameState.rushTimer.toFixed(2),
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
      aimAngle: +gameState.aimAngle.toFixed(3),
      lastDropX: gameState.lastDropX,
      sameSpotStreak: gameState.sameSpotStreak,
      bakeZone: gameState.bakeZone ? { ...gameState.bakeZone } : null,
      waitingForLanding: isWaitingForLanding(),
      curTier: gameState.curTier,
      curMeta: { ...gameState.curMeta },
      nextTier: gameState.nextTier,
      nextMeta: { ...gameState.nextMeta },
      holdTier: gameState.holdTier,
      holdMeta: gameState.holdMeta ? { ...gameState.holdMeta } : null,
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
        yarnHp: e.isYarnBall ? e.yarnHp : 0,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
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
      saveData.bankStardust = Math.max(0, (saveData.bankStardust || 0) + (Number(amt) || 0));
      persistSaveData();
    },
    triggerEvent: (kind) => triggerShopEvent(kind),
    triggerRushGust: () => triggerRushEmergencyGust(),
    setRushTimer: (sec) => {
      gameState.rushTimer = Math.max(0, Number(sec) || 0);
    },
    triggerFever: () => addFeverEnergy(100),
    grantRainbow: () => grantNextRainbow('测试彩虹糖'),
    queueBlessing: (r = '测试祝福') => queueBlessing(r),
    openBlessing: () => app.openBlessingModal(),
    togglePhysicsDebug: (val) => app.toggleDebugPhysics(val),
    startMode: (mode) => app.startNewRun(mode),
    returnToLobby: () => app.returnToLobby(),
    refreshMetrics: () => {
      metrics = platform.getSystemMetrics();
      canvas.width = Math.round(metrics.width * metrics.dpr);
      canvas.height = Math.round(metrics.height * metrics.dpr);
    }
  };

  preloadAssets().then(() => {
    app.syncAudioMood();
    raf(mainLoop);
  });

  return app;
}

module.exports = {
  createApp
};
