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
  CASCADE_MULTIPLIERS,
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

  // Load Persistent Save Data (4.0 backward-compatible migration)
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
        servesTotal: 0,
        bankShotsTotal: 0,
        maxAvalancheEver: 0,
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
        servesTotal: Math.max(0, Math.floor(Number(stRaw.servesTotal) || 0)),
        bankShotsTotal: Math.max(0, Math.floor(Number(stRaw.bankShotsTotal) || 0)),
        maxAvalancheEver: Math.max(0, Math.floor(Number(stRaw.maxAvalancheEver) || 0)),
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

  // Mutable Game State (4.0 Phase 1)
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
      mode: 'drop', // 'drop' | 'sling'
      anchorX: 220,
      anchorY: 160,
      curX: 220,
      curY: 160,
      power: 0,
      launchVx: 0,
      launchVy: 320,
      angle: 0,
      cancelled: false,
      stretchBand: 0
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
    rushNextMilestone: 2000,
    rushLastTickSec: 6,
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

    hasSouffleAura() {
      return gameState.entities.some((e) => !e.merged && !e.isWildcard && !e.isYarnBall && e.tier === 9);
    },
    getSouffleAuraMult() {
      return this.hasSouffleAura() ? 2.0 : 1.0;
    },
    isEntityServable(entity) {
      return findServableMatch(entity);
    },
    serveEntity(entityId) {
      return serveEntityById(entityId);
    },
    activateChefSkill() {
      activateChefSkillFn();
    },

    armOrUseTool(key) { armOrUseToolFn(key); },
    cancelToolMode() { cancelToolMode(); },
    swapHoldPocket() { swapHoldPocketFn(); },
    adjustAimAngle(deltaRad) { adjustAimAngle(deltaRad); },
    skipOrder() { skipOrderFn(); },
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
      app.showToast(`🌟 招牌技【${sk.icon} ${sk.name}】已充能完毕！点底部中央发动！`);
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
      gameState.tools.spoon++;
      addSkillEnergy(100, true);
      const gained = addRunStardust(25);
      spawnPopup(JAR.canvasW / 2, 220, `🎁 摇+1·勺+1·招牌技满能 · +${gained}⭐!`, '#ffe57e', 17);
    } else if (id === 'cleanse') {
      const smalls = gameState.entities
        .filter((e) => !e.isWildcard && !e.isYarnBall && e.tier <= 2)
        .sort((a, b) => a.y - b.y)
        .slice(0, 4);
      const removeIds = new Set(smalls.map((e) => e.id));
      let gainedPts = 0;
      let gainedDustBase = 0;
      for (const s of smalls) {
        gainedPts += 45;
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

  // =========================================================================
  // 4.0 Dual-Table Orders & True Tap-to-Serve + Cascade Avalanche System
  // =========================================================================
  let nextOrderUid = 1;

  function generateTableOrder(kind, isInitial = false) {
    const maxMade = Math.max(4, gameState.maxTierRun);
    const doneCount = gameState.ordersCompleted;
    const activePatron = app.activePatron;
    const patron = isInitial
      ? activePatron
      : PATRONS[(doneCount + (kind === 'vip' ? 1 : 0) + Math.floor(Math.random() * PATRONS.length)) % PATRONS.length];

    let reqTiers = [];
    if (kind === 'quick') {
      if (isInitial) {
        // Matches the pre-populated starter T3 so players discover Tap-to-Serve immediately!
        reqTiers = [3];
      } else {
        const cap = Math.min(5, Math.max(4, maxMade - 1));
        const t = 3 + Math.floor(Math.random() * (cap - 2));
        reqTiers = [t];
      }
    } else {
      // VIP Table: high-tier single OR delicious 2-piece combo platter
      if (isInitial) {
        reqTiers = [3, 4];
      } else if (Math.random() < 0.58) {
        const cap = Math.min(6, Math.max(4, maxMade));
        const tA = 3 + Math.floor(Math.random() * Math.max(1, Math.min(2, cap - 3)));
        const tB = Math.min(6, Math.max(4, tA + 1 + (Math.random() < 0.35 ? 1 : 0)));
        reqTiers = [tA, tB].sort((a, b) => a - b);
      } else {
        const tHigh = Math.min(7, Math.max(5, Math.min(maxMade + 1, 5 + Math.floor(doneCount / 3))));
        reqTiers = [tHigh];
      }
    }

    const mikanVipMult = saveData.selectedPatron === 'mikan' && kind === 'vip' ? 1.25 : 1.0;
    const baseBonusScore = Math.round(
      reqTiers.reduce((acc, t) => acc + TIERS[t - 1].servePoints * (kind === 'vip' ? 0.55 : 0.35), kind === 'vip' ? 140 : 60) *
        mikanVipMult
    );
    const rewardDust = Math.round(
      ((kind === 'vip' ? 22 : 10) + reqTiers.reduce((acc, t) => acc + t * 2, 0)) * mikanVipMult
    );
    const freshMax = kind === 'vip' ? 8 : 6;

    return {
      uid: nextOrderUid++,
      kind, // 'quick' | 'vip'
      label: kind === 'vip' ? 'VIP桌' : '快餐桌',
      patron,
      slots: reqTiers.map((tier) => ({ tier, done: false })),
      bonusScore: baseBonusScore,
      rewardDust,
      freshSteps: freshMax,
      freshMax,
      freshMult: kind === 'vip' ? 1.5 : 1.35,
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

  function findServableMatch(entity) {
    if (!entity || entity.merged || entity.isWildcard || entity.isYarnBall) return null;
    if (entity.tier === 9) {
      return { kind: 'souffle', order: null, slotIdx: -1 };
    }
    if (!gameState.orders || gameState.orders.length === 0) return null;

    // Prioritize VIP table (higher reward & multi-slot progression), then Quick table
    let best = null;
    for (let oi = 0; oi < gameState.orders.length; oi++) {
      const ord = gameState.orders[oi];
      if (!ord || ord.completed) continue;
      const slotIdx = ord.slots.findIndex((s) => !s.done && s.tier === entity.tier);
      if (slotIdx === -1) continue;
      if (!best) {
        best = { kind: ord.kind, order: ord, slotIdx };
      } else if (ord.kind === 'vip' && best.kind !== 'vip') {
        best = { kind: ord.kind, order: ord, slotIdx };
      } else if (ord.kind === best.kind && ord.freshSteps > best.order.freshSteps) {
        best = { kind: ord.kind, order: ord, slotIdx };
      }
    }
    return best;
  }

  function findServableEntityAt(x, y, pad = 12) {
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

  function wakeNeighborsAfterRemoval(rx, ry, removedR) {
    const wakeRadius = removedR * 3.4 + 45;
    for (const other of gameState.entities) {
      if (other.merged) continue;
      const dx = other.x - rx;
      const dy = other.y - ry;
      const dist = Math.hypot(dx, dy);
      if (dist < wakeRadius && other.y <= ry + removedR * 0.65) {
        // Gentle settle impulse so treats resting above immediately tumble into the vacuum
        other.vy = Math.max(other.vy, 34);
        other.vx += (dx === 0 ? (Math.random() - 0.5) : -Math.sign(dx)) * 18;
        other.vr += (dx >= 0 ? -1 : 1) * 0.9;
      }
    }
  }

  function startCascadeWindow(originX, originY) {
    const dur = 2.6 + getComboUpgradeBonus();
    gameState.serveCascadeTimer = Math.max(gameState.serveCascadeTimer, dur);
    gameState.serveCascadeMerges = 0;
    gameState.serveCascadeOrigin = { x: originX, y: originY };
  }

  function serveEntityById(entityId) {
    if (!gameState.running || gameState.over || gameState.paused) return false;
    const ent = gameState.entities.find((e) => e.id === entityId && !e.merged);
    if (!ent) return false;
    const match = findServableMatch(ent);
    if (!match) return false;

    audio.ensureCtx();
    audio.playServeBell();
    platform.vibrateShort('medium');

    // 1. Remove served dessert from jar & trigger vacuum collapse wake-up!
    gameState.entities = gameState.entities.filter((e) => e.id !== ent.id);
    wakeNeighborsAfterRemoval(ent.x, ent.y, ent.r);
    startCascadeWindow(ent.x, ent.y);

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

    spawnSparkleBurst(ent.x, ent.y, '#ffe47a', 22);
    spawnShockwave(ent.x, ent.y, ent.r * 2.1 + 36, '#ffe47a', 3.6);
    gameState.jarFlash = Math.max(gameState.jarFlash, 0.38);

    gameState.servesCompleted++;
    saveData.lifetimeStats.servesTotal = (saveData.lifetimeStats.servesTotal || 0) + 1;
    persistSaveData();

    const feverMult = app.getFeverMultiplier();
    const goldMult = ent.isGolden ? 1.8 : 1.0;

    // Special Case: T9 Crown Cat Soufflé Grand Slam!
    if (match.kind === 'souffle') {
      const pts = Math.round(TIERS[8].servePoints * feverMult * goldMult);
      addScore(pts);
      const dust = addRunStardust(48);
      addFeverEnergy(55);
      addSkillEnergy(100, true);
      audio.playSupernova();
      platform.vibrateShort('heavy');

      // Cleanse all T1~T2 treats in jar as celebration garnish!
      let cleansed = 0;
      gameState.entities = gameState.entities.filter((other) => {
        if (!other.isWildcard && !other.isYarnBall && other.tier <= 2) {
          cleansed++;
          spawnSparkleBurst(other.x, other.y, '#ffe899', 10);
          return false;
        }
        return true;
      });
      if (gameState.mode === 'rush') {
        gameState.rushTimer += 6.0;
      }
      spawnPopup(ent.x, ent.y - 20, `👑 主菜献礼! +${pts}`, '#ffe570', 22);
      showComboBanner('👑 星冠猫神主菜大满贯!', `+${pts}分 · +${dust}⭐ · 净化${cleansed}颗小糖`, '#ffe570');
      app.showToast(`👑 献上星冠猫神舒芙蕾！+${pts}分 · 招牌技满能！`);
      return true;
    }

    // Standard / VIP Table Serve
    const ord = match.order;
    const def = TIERS[ent.tier - 1];
    const isFresh = ord.freshSteps > 0;
    const freshMult = isFresh ? ord.freshMult : 1.0;
    const auraMult = app.getSouffleAuraMult();
    const mikanVipMult = saveData.selectedPatron === 'mikan' && ord.kind === 'vip' ? 1.25 : 1.0;

    const servePts = Math.round(def.servePoints * feverMult * goldMult * freshMult * auraMult * mikanVipMult);
    addScore(servePts);
    addFeverEnergy(22);
    addSkillEnergy(35);

    if (gameState.mode === 'rush') {
      gameState.rushTimer += 3.0;
      spawnPopup(ent.x, ent.y - 44, '⏱️ 出餐续命 +3.0s!', '#9cf4ff', 15);
    }

    ord.slots[match.slotIdx].done = true;
    const freshTag = isFresh ? '🔥热腾腾 ' : '';
    spawnPopup(ent.x, ent.y - 16, `🔔 ${freshTag}上菜 +${servePts}`, '#ffe67e', 18);

    // Check if the entire table order is complete
    if (ord.slots.every((s) => s.done)) {
      ord.completed = true;
      gameState.ordersCompleted++;
      const bonusPts = Math.round(ord.bonusScore * feverMult * freshMult * auraMult);
      const dust = addRunStardust(Math.round(ord.rewardDust * freshMult));
      addScore(bonusPts);
      addFeverEnergy(ord.kind === 'vip' ? 24 : 14);
      if (ord.kind === 'vip') addSkillEnergy(25);
      audio.playOrderComplete();

      const activePatron = app.activePatron;
      setPatronSpeech(
        activePatron,
        ord.kind === 'vip' ? `${activePatron.thanks} VIP 大单完成！` : activePatron.thanks,
        3.6
      );

      if (ord.kind === 'vip') {
        if (isFresh) grantNextRainbow('VIP极速上菜');
        queueBlessing(isFresh ? '👑 VIP 鲜度大单达成' : '🎉 VIP 心愿单达成');
        showComboBanner('👑 VIP 套餐上齐!', `额外赏金 +${bonusPts} · +${dust}⭐`, '#ffe378');
        app.showToast(`👑 VIP 订单完成！+${servePts + bonusPts}分 · +${dust}⭐ · 获得祝福!`);
      } else {
        if (gameState.ordersCompleted % 2 === 0) {
          queueBlessing('🔔 连续出餐达标');
          if (!gameState.activeEvent && gameState.mode === 'chef') {
            setTimeout(() => {
              if (gameState.running && !gameState.over && !gameState.activeEvent) {
                triggerShopEvent();
              }
            }, 900);
          }
        }
        app.showToast(`🔔 快餐出单！+${servePts + bonusPts}分 · +${dust}⭐（趁机触发抽底雪崩！）`);
      }

      const replaceKind = ord.kind;
      const replaceUid = ord.uid;
      setTimeout(() => {
        if (!gameState.running || gameState.over || gameState.mode === 'zen') return;
        const idx = gameState.orders.findIndex((o) => o && o.uid === replaceUid);
        if (idx !== -1) {
          gameState.orders[idx] = generateTableOrder(replaceKind, false);
          gameState.order = gameState.orders[1] || gameState.orders[0] || null;
        }
      }, 520);
    } else {
      app.showToast(`🔔 已端上【${def.name}】+${servePts}分！还差 1 份即完成 VIP 套餐～`);
    }

    return true;
  }

  function notifyTreatSynthesized(tier, entity) {
    if (!entity || gameState.mode === 'zen') return;
    const match = findServableMatch(entity);
    if (match && match.kind !== 'souffle') {
      audio.playOrderStamp();
      spawnPopup(entity.x, entity.y - entity.r - 12, '🔔 可点击上菜!', '#fff099', 13);
    }
  }

  function skipOrderFn() {
    if (gameState.skipCooldown > 0 || gameState.mode === 'zen') return;
    gameState.skipCooldown = 18;
    const quick = generateTableOrder('quick', false);
    const vip = generateTableOrder('vip', false);
    gameState.orders = [quick, vip];
    gameState.order = vip;
    app.showToast('📋 已为双桌更换全新星夜点单！');
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

  // Tool & Chef Signature Skill Actions
  function armOrUseToolFn(key) {
    if (!gameState.running || gameState.over) return;
    if (app.activeModal === 'blessing') app.closeModal();
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

  function activateChefSkillFn() {
    if (!gameState.running || gameState.over) return;
    if (app.activeModal === 'blessing') app.closeModal();
    audio.ensureCtx();

    if (gameState.activeSkillMode) {
      cancelToolMode();
      return;
    }

    const patron = app.activePatron;
    const sk = patron.activeSkill;
    if (gameState.skillEnergy < 100) {
      app.showToast(`${sk.icon} 【${sk.name}】充能中 (${Math.floor(gameState.skillEnergy)}%)，点击金铃出餐可极速充能！`);
      return;
    }

    gameState.activeToolMode = null;
    if (sk.id === 'scoop') {
      gameState.activeSkillMode = 'scoop';
      app.showToast('🥄 点击罐内任意 1~5 阶甜品，捞回罐口并引发抽底雪崩！');
    } else if (sk.id === 'swap') {
      const swappable = gameState.entities.filter((e) => !e.merged && !e.isYarnBall);
      if (swappable.length < 2) {
        app.showToast('🌙 罐内至少需要 2 颗甜品才能发动【星月移形】哦～');
        return;
      }
      gameState.activeSkillMode = 'swap_1';
      gameState.swapFirstEntityId = null;
      app.showToast('🌙 请依次点击罐内两颗甜品，瞬间互换它们的位置！');
    } else if (sk.id === 'meteor_shot') {
      if (gameState.nextShotMeteor) {
        app.showToast('🔥 【元气重锤】已经装填完毕，发射即可撞击升阶！');
        return;
      }
      gameState.skillEnergy = 0;
      gameState.nextShotMeteor = true;
      audio.playChefSkill('mugi');
      platform.vibrateShort('medium');
      spawnSparkleBurst(gameState.dropX, JAR.dropY + 12, '#ff8e52', 24);
      showComboBanner('🔥 元气重锤装填!', '下次发射撞击首颗甜品直接升阶 + 爆破气浪', '#ff9e66');
      app.showToast('🔥 元气重锤已就绪！拉弓发射撞向目标甜品吧！');
    }
  }

  function cancelToolMode() {
    gameState.activeToolMode = null;
    gameState.activeSkillMode = null;
    gameState.swapFirstEntityId = null;
    gameState.hoveredEntityId = null;
  }

  function swapHoldPocketFn() {
    if (!gameState.running || gameState.over || gameState.activeToolMode || gameState.activeSkillMode) return;
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

  function clampDropXVal(rawX) {
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
    return Math.max(minX, Math.min(maxX, rawX));
  }

  function clampDropX() {
    gameState.dropX = clampDropXVal(gameState.dropX);
  }

  function adjustAimAngle(deltaRad) {
    if (!gameState.running || gameState.over || gameState.activeToolMode || gameState.activeSkillMode) return;
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
    gameState.dropX = clampDropXVal(newX);
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
    const mat = isWildcard ? { friction: 0.14, restitution: 0.36, gravityScale: 1.0, massMult: 1.0 } : def.material;

    const entity = {
      id: gameState.nextEntityId++,
      tier,
      isWildcard,
      isGolden,
      isBankLaunched: !!meta.isBankLaunched,
      isMeteorShot: !!meta.isMeteorShot,
      wallBounces: 0,
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
      age: meta.preSettled ? 1.0 : 0,
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
      Physics.clampBodyInsideJarPositional(entity, JAR);
    }
    gameState.entities.push(entity);
    if (!isWildcard) unlockTier(tier);
    return entity;
  }

  function dropCurrentTreat(launchVx = 0, launchVy = 320, isBankLaunched = false) {
    if (!gameState.running || gameState.over || gameState.paused) return false;
    if (gameState.activeToolMode || gameState.activeSkillMode || gameState.dropCooldown > 0) return false;

    const curR = getCurrentDropRadius();
    if (!Physics.isSpawnClear(gameState.dropX, JAR.dropY, curR, gameState.entities)) {
      return false;
    }

    audio.ensureCtx();
    clampDropX();
    const totalAngle = getAimTotalAngle();
    const curMeta = gameState.curMeta || { wildcard: false, golden: false };
    const isMeteor = !!gameState.nextShotMeteor;
    if (isMeteor) gameState.nextShotMeteor = false;

    // Reset per-drop soft skill energy cap
    gameState.stepSkillGain = 0;

    let finalVx = launchVx;
    let finalVy = launchVy;
    if (isMeteor) {
      const spd = Math.hypot(finalVx, finalVy) || 320;
      const boost = Math.max(1.25, 760 / spd);
      finalVx *= boost;
      finalVy *= boost;
    }

    const dropped = createEntity(
      gameState.curTier,
      gameState.dropX,
      JAR.dropY + (isBankLaunched ? 4 : 0),
      finalVx,
      finalVy,
      false,
      totalAngle,
      isBankLaunched ? (finalVx >= 0 ? 3.5 : -3.5) : 0,
      { ...curMeta, isBankLaunched: isBankLaunched || Math.abs(finalVx) > 85, isMeteorShot: isMeteor }
    );
    gameState.lastDroppedId = dropped.id;
    gameState.dropsMadeThisRun++;
    audio.playDrop(curMeta.wildcard, curMeta.golden || isMeteor);

    // Decay freshSteps on active Dual-Table Orders
    if (gameState.orders && gameState.orders.length > 0) {
      for (const ord of gameState.orders) {
        if (ord && !ord.completed && ord.freshSteps > 0) {
          ord.freshSteps = Math.max(0, ord.freshSteps - 1);
        }
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
      gameState.dropCooldown = isFever ? 0.08 : 0.12;
    } else {
      gameState.dropCooldown = isFever ? 0.10 : 0.16;
    }
    gameState.heldActionAnim = null;
    gameState.heldActionCooldown = 1.5 + Math.random() * 1.5;
    clampDropX();
    return true;
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

  function triggerMontBlancCrush(mb) {
    if (!mb || mb.merged) return 0;
    const victims = gameState.entities
      .filter((other) => {
        if (other.id === mb.id || other.merged || other.isWildcard || other.isYarnBall) return false;
        if (other.tier > 2) return false;
        const dy = other.y - mb.y;
        const dist = Math.hypot(other.x - mb.x, dy);
        return dy > -10 && dist <= mb.r + other.r + 22;
      })
      .slice(0, 2);
    if (victims.length === 0) return 0;
    const victimIds = new Set(victims.map((v) => v.id));
    let pts = 0;
    for (const v of victims) {
      pts += Math.round(100 * app.getFeverMultiplier() * app.getSouffleAuraMult());
      spawnSparkleBurst(v.x, v.y, '#d9a97c', 14);
      spawnShockwave(v.x, v.y, 48, '#e3b27d', 2.8);
    }
    gameState.entities = gameState.entities.filter((e) => !victimIds.has(e.id));
    addScore(pts);
    addRunStardust(victims.length * 5);
    addSkillEnergy(victims.length * 10);
    audio.playTraitTrigger(8);
    spawnPopup(mb.x, mb.y + mb.r * 0.4, `🌰 重锤压碎×${victims.length}! +${pts}`, '#ffd699', 16);
    return victims.length;
  }

  function triggerDessertTrait(born, mx, my) {
    if (!born || born.merged || born.isWildcard) return;
    const tier = born.tier;

    if (tier === 3) {
      // T3 Matcha Kitty: 1.8s gentle same-tier resonance field
      born.resonanceTimer = 1.8;
      spawnShockwave(mx, my, 105, '#a8e67e', 2.4);
      spawnPopup(mx, my - born.r - 12, '🍵 猫耳共鸣!', '#c9f598', 12.5);
    } else if (tier === 4) {
      // T4 Lemon Honey Tart: vaporize up to 2 nearby T1 Blueberries
      const targets = gameState.entities
        .filter((e) => e.id !== born.id && !e.merged && !e.isWildcard && !e.isYarnBall && e.tier === 1)
        .map((e) => ({ e, d: Math.hypot(e.x - mx, e.y - my) }))
        .filter((it) => it.d <= 105 + eRadiusSafe(it.e))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      if (targets.length > 0) {
        const rmIds = new Set(targets.map((it) => it.e.id));
        let gainPts = 0;
        for (const it of targets) {
          gainPts += Math.round(55 * app.getFeverMultiplier() * app.getSouffleAuraMult());
          spawnSparkleBurst(it.e.x, it.e.y, '#fff08a', 14);
          spawnShockwave(it.e.x, it.e.y, 44, '#ffe86b', 2.6);
        }
        gameState.entities = gameState.entities.filter((e) => !rmIds.has(e.id));
        addScore(gainPts);
        addSkillEnergy(targets.length * 8);
        audio.playTraitTrigger(4);
        wakeNeighborsAfterRemoval(mx, my, born.r);
        spawnPopup(mx, my - born.r - 16, `🍋 气泡清杂×${targets.length}! +${gainPts}`, '#fff08a', 15);
      }
    } else if (tier === 5) {
      // T5 Strawberry Daifuku: soft inward mochi vortex pulls neighbors gently together
      let pulled = 0;
      for (const other of gameState.entities) {
        if (other.id === born.id || other.merged) continue;
        const dx = mx - other.x;
        const dy = my - other.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 8 && dist <= 145) {
          const factor = 1 - dist / 145;
          const pull = 120 + factor * 140;
          other.vx += (dx / dist) * pull;
          other.vy += (dy / dist) * pull * 0.65 - 28;
          pulled++;
        }
      }
      if (pulled > 0) {
        audio.playTraitTrigger(5);
        spawnShockwave(mx, my, 135, '#ff9ec2', 3.0);
        spawnPopup(mx, my - born.r - 16, '🍓 软糯聚拢!', '#ffb8d6', 14);
      }
    } else if (tier === 6) {
      // T6 Caramel Star Donut: 1.4s spinning mixer loosens wedged clusters
      born.spinBoostTimer = 1.4;
      born.spinBoostDir = Math.random() < 0.5 ? 1 : -1;
      for (const other of gameState.entities) {
        if (other.id === born.id || other.merged) continue;
        const dx = other.x - mx;
        const dy = other.y - my;
        const dist = Math.hypot(dx, dy);
        if (dist > 1 && dist <= born.r + other.r + 42) {
          // Tangential swirl impulse
          const tx = (-dy / dist) * born.spinBoostDir;
          const ty = (dx / dist) * born.spinBoostDir;
          other.vx += tx * 115;
          other.vy += ty * 75 - 45;
        }
      }
      audio.playTraitTrigger(6);
      spawnShockwave(mx, my, born.r * 1.9, '#eab074', 3.2);
      spawnPopup(mx, my - born.r - 16, '🍩 焦糖陀螺!', '#ffd499', 14.5);
    } else if (tier === 7) {
      // T7 Cosmic Macaron: low-gravity buoyant lift
      born.vy = Math.min(born.vy, -125);
      spawnSparkleBurst(mx, my, '#d8c2ff', 16);
      spawnPopup(mx, my - born.r - 16, '☁️ 云端微浮!', '#e5d4ff', 14.5);
    } else if (tier === 8) {
      // T8 Royal Mont Blanc: heavy hammer crush
      triggerMontBlancCrush(born);
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

    const result = Physics.stepWorld(gameState.entities, JAR, dt, 1880, { magnetRange, magnetForce });
    const { mergePairs, impacts, wallBounces, meteorHits, debugContacts, magnetLinks } = result;
    gameState.lastDebugContacts = debugContacts;
    gameState.magnetLinks = magnetLinks || [];

    // Glass wall bank-shot bounce feedback
    if (wallBounces && wallBounces.length > 0) {
      for (const wb of wallBounces) {
        audio.playBankBounce(wb.count);
        spawnSparkleBurst(wb.x, wb.y, '#9cf4ff', 10);
        spawnShockwave(wb.x, wb.y, 44, '#9cf4ff', 2.6);
        if (wb.count === 1) {
          spawnPopup(wb.x + wb.nx * 24, wb.y - 10, '🎱 弹壁!', '#b4f6ff', 13);
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
        gameState.screenShake = Math.max(gameState.screenShake, 5.0);
        if (tgt.tier < 9) {
          const nextTier = tgt.tier + 1;
          const def = TIERS[nextTier - 1];
          tgt.tier = nextTier;
          Physics.configureBodyShape(tgt, getShapeDef(nextTier), def.radius, def.material);
          Physics.clampBodyInsideJarPositional(tgt, JAR);
          tgt.squishAmt = 0.26;
          tgt.squishVel = 0;
          const pts = Math.round(def.points * 1.5 * app.getFeverMultiplier() * app.getSouffleAuraMult());
          addScore(pts);
          unlockTier(nextTier);
          triggerDessertTrait(tgt, tgt.x, tgt.y);
          notifyTreatSynthesized(nextTier, tgt);
          spawnPopup(tgt.x, tgt.y - tgt.r * 0.6, `🔥 重锤升阶! +${pts}`, '#ffba78', 18);
          showComboBanner('🔥 元气重锤命中!', `${def.name} 强行升阶 +${pts}`, '#ffaa66');
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
      const upComboBonus = getComboUpgradeBonus();
      const isChimeEvent = !!(gameState.activeEvent && gameState.activeEvent.kind === 'chime');
      const chimeScoreMult = isChimeEvent ? 1.45 : 1.0;
      const chimeComboBonus = isChimeEvent ? 0.5 : 0;
      const souffleAuraMult = app.getSouffleAuraMult();

      gameState.entities = gameState.entities.filter((e) => !e.merged);
      for (const [a, b] of mergePairs) {
        const isTwinWild = !!(a.isWildcard && b.isWildcard);
        const isWildMerge = !isTwinWild && !!(a.isWildcard || b.isWildcard);
        const isGoldenMerge = !!(a.isGolden || b.isGolden);
        const isBankShot = !!((a.wallBounces > 0 && a.age < 2.4) || (b.wallBounces > 0 && b.age < 2.4));
        const isMeteorMerge = !!(a.isMeteorShot || b.isMeteorShot);

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

        // Serve Cascade Avalanche detection!
        let cascadeMult = 1.0;
        let cascadeHitNum = 0;
        if (gameState.serveCascadeTimer > 0) {
          gameState.serveCascadeMerges++;
          cascadeHitNum = gameState.serveCascadeMerges;
          gameState.serveCascadeTimer = Math.max(gameState.serveCascadeTimer, 1.85);
          cascadeMult = CASCADE_MULTIPLIERS[Math.min(CASCADE_MULTIPLIERS.length - 1, cascadeHitNum)];
          if (cascadeHitNum > gameState.maxAvalancheRun) gameState.maxAvalancheRun = cascadeHitNum;
          if (cascadeHitNum > (saveData.lifetimeStats.maxAvalancheEver || 0)) {
            saveData.lifetimeStats.maxAvalancheEver = cascadeHitNum;
            persistSaveData();
          }
          audio.playCascadeHit(cascadeHitNum);
          if (cascadeHitNum === 2) {
            addSkillEnergy(20);
            const avDust = addRunStardust(12);
            spawnPopup(JAR.canvasW / 2, 148, `🏔️ 抽底雪崩连爆! +20%技 · +${avDust}⭐`, '#9cf4ff', 17);
          }
        }

        // Bank-Shot multiplier (extra bonus for Mugi patron & T2 Peach Puff)
        let bankMult = 1.0;
        if (isBankShot) {
          const isT2Bank = !isWildMerge && !isTwinWild && a.tier === 2;
          bankMult = 1.5 + (saveData.selectedPatron === 'mugi' ? 0.4 : 0) + (isT2Bank ? 0.3 : 0);
          gameState.bankShotsLanded++;
          saveData.lifetimeStats.bankShotsTotal = (saveData.lifetimeStats.bankShotsTotal || 0) + 1;
          persistSaveData();
          addSkillEnergy(10);
        }

        // Mugi ≥3 combo skill energy burst
        if (saveData.selectedPatron === 'mugi' && gameState.comboCount >= 3) {
          addSkillEnergy(20);
          if (gameState.mode === 'rush') {
            addScore(80);
            spawnPopup(mx + 26, my - 26, '🍯 +80分 · +20%技!', '#ffd27a', 13);
          } else {
            const mugiDust = addRunStardust(4);
            spawnPopup(mx + 26, my - 26, `🍯 +${mugiDust}⭐ · +20%技`, '#ffd27a', 13);
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

        damageNearbyYarnBalls(mx, my, isMeteorMerge ? 135 : 95, false);

        if (isTwinWild) {
          const born = createEntity(5, mx, my, mvx, mvy - 30, true, 0, 0, { golden: true });
          const pts = Math.round(480 * feverMult * comboBonus * chimeScoreMult * bankMult * cascadeMult * souffleAuraMult);
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
          showComboBanner('🌈 双彩虹奇迹!', `黄金草莓大福诞生 +${pts}`, '#ff9fd2');
          spawnPopup(mx, my - 30, `🌈 双虹奇迹! +${pts}`, '#ffe57e', 20);
          notifyTreatSynthesized(5, born);
          continue;
        }

        const baseTier = targetBody ? targetBody.tier : a.tier;
        if (baseTier < 9) {
          const critChance = critLv * 0.14 + (isMeteorMerge ? 0.5 : 0);
          const isCrit = baseTier <= 7 && critChance > 0 && Math.random() < critChance;
          const nextTier = Math.min(9, baseTier + (isCrit ? 2 : 1));
          const def = TIERS[nextTier - 1];
          const inheritGold = isGoldenMerge && Math.random() < 0.22 + goldenLv * 0.12;
          const born = createEntity(nextTier, mx, my, mvx, mvy, true, mAngle, mVr, { golden: inheritGold });

          const goldMult = isGoldenMerge ? 2.5 : 1;
          const critMult = isCrit ? 2.0 : 1;
          const pts = Math.round(
            def.points * feverMult * comboBonus * goldMult * critMult * chimeScoreMult * bankMult * cascadeMult * souffleAuraMult
          );
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
            def.radius * 1.9 + 26 + app.getPerkLevel('shockwave') * 12,
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

          let label = isChimeEvent ? `🔔 +${pts}` : `+${pts}`;
          let popColor = isChimeEvent ? '#ffe778' : '#ffffff';
          let popSize = 15;
          if (cascadeHitNum >= 1) {
            label = `🏔️ 雪崩×${cascadeMult.toFixed(1)}! +${pts}`;
            popColor = '#9cf4ff';
            popSize = 18 + Math.min(4, cascadeHitNum);
            showComboBanner(`🏔️ 抽底雪崩 ${cascadeHitNum} 连!!`, `雪崩倍率 ×${cascadeMult.toFixed(1)} · +${pts}分`, '#9cf4ff');
          } else if (isBankShot) {
            label = `🎱 弹壁神球 ×${bankMult.toFixed(1)}! +${pts}`;
            popColor = '#9cf4ff';
            popSize = 18;
            showComboBanner(`🎱 弹壁神球!`, `${def.name} ×${bankMult.toFixed(1)} · +10% 厨艺能`, '#9cf4ff');
          } else if (isCrit) {
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
            app.showToast('👑 传说诞生！留罐全场 ×2.0，点击它即可主菜献礼 +3200！');
            setPatronSpeech(app.activePatron, '哇！！星冠猫神舒芙蕾诞生了！留着翻倍还是直接献礼？', 5.0);
            showComboBanner('👑 星冠猫神诞生!', '留罐全局 ×2.0 · 点击随时献礼!', '#ffe46b');
          }
          notifyTreatSynthesized(nextTier, born);
        } else {
          const pts = Math.round((isWildMerge ? 1800 : 2800) * feverMult * comboBonus * chimeScoreMult * souffleAuraMult);
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
    gameState.servesCompleted = 0;
    gameState.bankShotsLanded = 0;
    gameState.serveCascadeTimer = 0;
    gameState.serveCascadeMerges = 0;
    gameState.maxAvalancheRun = 0;

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
    gameState.tools = {
      shake: 2 + (upToolsLv >= 1 ? 1 : 0) + (upToolsLv >= 3 ? 1 : 0),
      spoon: 1 + (upToolsLv >= 2 ? 1 : 0)
    };

    gameState.activeToolMode = null;
    gameState.dropX = 220;
    gameState.prevDropX = 220;
    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.aim = {
      active: false,
      mode: 'drop',
      anchorX: 220,
      anchorY: 160,
      curX: 220,
      curY: 160,
      power: 0,
      launchVx: 0,
      launchVy: 320,
      angle: 0,
      cancelled: false,
      stretchBand: 0
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
    gameState.rushNextMilestone = 2000;
    gameState.rushLastTickSec = 6;

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

    app.goSettlement = null;
    app.activeModal = null;
    app.isLobbyOpen = false;
    app.syncAudioMood();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    audio.unlock();

    spawnStarterBoard(mode);
    initOrders();

    const activePatron = app.activePatron;
    if (mode === 'chef') {
      setPatronSpeech(activePatron, activePatron.greet, 5.0);
    } else if (mode === 'rush') {
      setPatronSpeech(activePatron, `⚡ 90秒弹射狂欢！点击金铃出餐直接 +3.0s 续命，下拉拉弓打弹壁！`, 5.0);
    } else {
      setPatronSpeech(activePatron, `🍵 悠闲经典开启！下拉拉弓可撞墙弹射，享受 9 阶甜品异能吧～`, 5.0);
    }
  }

  // Tool & Active Chef Skill Canvas Targeting Click
  function findEntityAt(x, y, pad = 7) {
    for (let i = gameState.entities.length - 1; i >= 0; i--) {
      const e = gameState.entities[i];
      if (e.merged) continue;
      if (Physics.pointInBody(e, x, y, pad)) return e;
      if (Math.hypot(e.x - x, e.y - y) <= e.r + pad * 0.7) return e;
    }
    return null;
  }

  function handleSkillCanvasClick(lx, ly) {
    const target = findEntityAt(lx, ly, 10);
    if (!target) {
      app.showToast('请点击罐内的甜品目标哦～');
      return;
    }
    if (target.isYarnBall) {
      app.showToast('🧶 毛线球无法被厨艺技选中，请在附近合成 2 次或摇一摇震碎！');
      return;
    }

    if (gameState.activeSkillMode === 'scoop') {
      if (target.isWildcard || target.tier > 5) {
        app.showToast('🥄 【金勺捞底】只能捞出 1~5 阶甜品哦！');
        return;
      }
      gameState.skillEnergy = 0;
      gameState.entities = gameState.entities.filter((e) => e.id !== target.id);
      wakeNeighborsAfterRemoval(target.x, target.y, target.r);
      startCascadeWindow(target.x, target.y);

      // Preserve current held treat into HOLD if empty, then put scooped treat into hand
      if (gameState.holdTier === null) {
        gameState.holdTier = gameState.curTier;
        gameState.holdMeta = { ...gameState.curMeta };
      }
      gameState.curTier = target.tier;
      gameState.curMeta = { wildcard: false, golden: !!target.isGolden };
      clampDropX();

      audio.playChefSkill('mikan');
      platform.vibrateShort('medium');
      spawnSparkleBurst(target.x, target.y, '#ffe47a', 24);
      spawnShockwave(target.x, target.y, target.r * 2.2 + 30, '#ffe47a', 3.6);
      spawnPopup(target.x, target.y - 14, `🥄 金勺捞底!`, '#ffe680', 18);
      showComboBanner('🥄 金勺捞底发动!', '原位触发抽底雪崩 · 甜品已捞回罐口', '#ffe47a');
      cancelToolMode();
      return;
    }

    if (gameState.activeSkillMode === 'swap_1') {
      gameState.swapFirstEntityId = target.id;
      gameState.activeSkillMode = 'swap_2';
      audio.playTilt();
      spawnShockwave(target.x, target.y, target.r + 20, '#d8b4ff', 2.8);
      app.showToast(`🌙 已选中【${target.isWildcard ? '彩虹糖' : TIERS[target.tier - 1].name}】，请点击第 2 颗甜品互换位置！`);
      return;
    }

    if (gameState.activeSkillMode === 'swap_2') {
      const first = gameState.entities.find((e) => e.id === gameState.swapFirstEntityId && !e.merged);
      if (!first) {
        gameState.activeSkillMode = 'swap_1';
        gameState.swapFirstEntityId = null;
        return;
      }
      if (target.id === first.id) {
        app.showToast('请选择另一颗不同的甜品进行位置互换哦～');
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
      Physics.clampBodyInsideJarPositional(first, JAR);
      Physics.clampBodyInsideJarPositional(target, JAR);

      audio.playChefSkill('luna');
      platform.vibrateShort('medium');
      spawnSparkleBurst(first.x, first.y, '#d8b4ff', 20);
      spawnSparkleBurst(target.x, target.y, '#ffe47a', 20);
      spawnShockwave(first.x, first.y, first.r + 36, '#d8b4ff', 3.4);
      spawnShockwave(target.x, target.y, target.r + 36, '#ffe47a', 3.4);
      spawnPopup((first.x + target.x) * 0.5, Math.min(first.y, target.y) - 16, '🌙 星月移形互换!', '#e5caff', 18);
      showComboBanner('🌙 星月移形!', '两颗甜品瞬间空间对调!', '#d8b4ff');
      cancelToolMode();
    }
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

    if (gameState.activeToolMode === 'spoon') {
      if (target.isWildcard) {
        app.showToast('🌈 彩虹万能糖碰到任意甜品就会自动升阶，无需升阶勺！');
        return;
      }
      if (target.tier >= 9) {
        app.showToast('👑 已经是最高阶星冠猫神舒芙蕾啦！点击它即可直接献礼！');
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

      const pts = Math.round(def.points * app.getFeverMultiplier() * app.getSouffleAuraMult());
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
      triggerDessertTrait(target, target.x, target.y);
      notifyTreatSynthesized(nextTier, target);
      cancelToolMode();
    }
  }

  // Unified Pointer & Touch Event Handling (4.0 Dual-Mode Aim + Tap-to-Serve Arbitration)
  let pendingUiHit = null;
  let uiDragMoved = false;
  let dragStartPos = { x: 0, y: 0, lastY: 0, active: false };
  let pendingServe = { entityId: null, downLx: 0, downLy: 0 };
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
    aim.curX = lx;
    aim.curY = ly;
    const cancelled = pointerType === 'touch' && ly < JAR.neckY - 20;
    aim.cancelled = cancelled;
    gameState.touchAim.cancelled = cancelled;

    const dragDy = ly - aim.anchorY;
    if (dragDy >= 26 && !cancelled) {
      // Pull-down Direct-Aim Slingshot / Bank-Shot Mode!
      aim.mode = 'sling';
      const originX = gameState.dropX;
      const originY = JAR.dropY + 4;
      const vxDir = lx - originX;
      const vyDir = Math.max(24, ly - originY);
      const rawAng = Math.atan2(vxDir, vyDir);
      const clampedAng = Math.max(-1.08, Math.min(1.08, rawAng)); // ±62° cone downward
      const pullDist = Math.hypot(lx - aim.anchorX, ly - aim.anchorY);
      const power = Math.max(0.12, Math.min(1.0, (pullDist - 24) / 115));
      const speed = 420 + 660 * power;
      aim.angle = clampedAng;
      aim.power = power;
      aim.launchVx = Math.sin(clampedAng) * speed;
      aim.launchVy = Math.cos(clampedAng) * speed;

      const band = power >= 0.8 ? 3 : power >= 0.5 ? 2 : power >= 0.25 ? 1 : 0;
      if (band !== aim.stretchBand && band > 0) {
        aim.stretchBand = band;
        audio.playSlingStretch(power);
      }
    } else {
      // Quick Vertical Drop Mode (zero friction)
      aim.mode = 'drop';
      aim.power = 0;
      aim.angle = 0;
      aim.launchVx = 0;
      aim.launchVy = 320;
      aim.stretchBand = 0;
      updateDropPointerX(lx);
      aim.anchorX = gameState.dropX;
      aimingState.lastStableX = gameState.dropX;
      gameState.touchAim.lastStableX = gameState.dropX;
    }
  }

  function resetAimingState() {
    aimingState.active = false;
    pendingServe.entityId = null;
    gameState.aim.active = false;
    gameState.aim.mode = 'drop';
    gameState.aim.power = 0;
    gameState.aim.cancelled = false;
    gameState.aim.stretchBand = 0;
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
      pendingServe.entityId = null;

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
          // Check Tap-to-Serve arbitration first!
          const servable = findServableEntityAt(lx, ly, 12);
          if (servable) {
            pendingServe = { entityId: servable.id, downLx: lx, downLy: ly };
            return;
          }
          updateDropPointerX(lx);
          aimingState = { active: true, pointerType, lastStableX: gameState.dropX };
          gameState.aim.active = true;
          gameState.aim.mode = 'drop';
          gameState.aim.anchorX = gameState.dropX;
          gameState.aim.anchorY = ly;
          gameState.aim.curX = lx;
          gameState.aim.curY = ly;
          gameState.aim.power = 0;
          gameState.aim.launchVx = 0;
          gameState.aim.launchVy = 320;
          gameState.aim.stretchBand = 0;
          gameState.aim.cancelled = pointerType === 'touch' && ly < JAR.neckY - 20;
          if (pointerType === 'touch') {
            gameState.touchAim.active = true;
            gameState.touchAim.cancelled = gameState.aim.cancelled;
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
        if (gameState.activeToolMode || gameState.activeSkillMode) {
          const hitEntity = findEntityAt(lx, ly);
          gameState.hoveredEntityId = hitEntity ? hitEntity.id : null;
          return;
        }
        // If dragging >= 12px off a servable treat, seamlessly hand off to aiming!
        if (pendingServe.entityId !== null) {
          if (Math.hypot(lx - pendingServe.downLx, ly - pendingServe.downLy) >= 12) {
            const startX = clampDropXVal(pendingServe.downLx);
            const startY = pendingServe.downLy;
            pendingServe.entityId = null;
            updateDropPointerX(startX);
            aimingState = { active: true, pointerType, lastStableX: gameState.dropX };
            gameState.aim.active = true;
            gameState.aim.mode = 'drop';
            gameState.aim.anchorX = gameState.dropX;
            gameState.aim.anchorY = startY;
            gameState.aim.stretchBand = 0;
            if (pointerType === 'touch') gameState.touchAim.active = true;
            updateAimVector(lx, ly, pointerType);
          }
          return;
        }
        if (aimingState.active) {
          updateAimVector(lx, ly, pointerType);
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
        resetAimingState();
        return;
      }

      if (pendingServe.entityId !== null) {
        const serveId = pendingServe.entityId;
        pendingServe.entityId = null;
        serveEntityById(serveId);
        return;
      }

      if (aimingState.active) {
        const { lx, ly } = toJarLogical(x, y);
        const isSling = gameState.aim.mode === 'sling';
        const vx = isSling ? gameState.aim.launchVx : 0;
        const vy = isSling ? gameState.aim.launchVy : 320;
        const cancelled = pointerType === 'touch' && (gameState.aim.cancelled || ly < JAR.neckY - 20);
        const targetX =
          !isSling && pointerType === 'touch' && Math.abs(lx - aimingState.lastStableX) <= 10
            ? aimingState.lastStableX
            : lx;
        resetAimingState();
        if (cancelled) return;
        if (!isSling) {
          updateDropPointerX(targetX);
        }
        dropCurrentTreat(vx, vy, isSling);
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
      const ang = gameState.aimAngle;
      if (Math.abs(ang) > 0.08) {
        const spd = 760;
        dropCurrentTreat(Math.sin(ang) * spd, Math.cos(ang) * spd, true);
      } else {
        dropCurrentTreat(0, 320, false);
      }
    } else if (key === 'h' || key === 'H' || key === 'Shift') {
      if (ev && ev.preventDefault) ev.preventDefault();
      app.swapHoldPocket();
    } else if (key === 'b' || key === 'B') {
      if (gameState.pendingBlessings > 0) app.openBlessingModal();
    } else if (key === '1') app.armOrUseTool('shake');
    else if (key === '2' || key === 'f' || key === 'F') app.activateChefSkill();
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

      if (gameState.serveCascadeTimer > 0) {
        gameState.serveCascadeTimer = Math.max(0, gameState.serveCascadeTimer - dt);
        if (gameState.serveCascadeTimer === 0) {
          gameState.serveCascadeMerges = 0;
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
      ? `🌙 我在星夜吃茶拿下了 ${gameState.score} 分！来一起弹壁合成 + 抽底雪崩出餐吧～`
      : '🌙 星夜吃茶 · 喵呜甜品合合乐｜手绘弹射物理合成小游戏'
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
        freshSteps: o.freshSteps,
        completed: o.completed,
        slots: o.slots.map((s) => ({ tier: s.tier, done: s.done }))
      })),
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
        isServable: !!findServableMatch(e),
        wallBounces: e.wallBounces || 0,
        gravityScale: e.gravityScale || 1,
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
    chargeSkill: () => addSkillEnergy(100, true),
    spawnTestEntity: (tier, x, y, opts = {}) => {
      const ent = createEntity(tier, x, y, opts.vx || 0, opts.vy || 0, false, 0, 0, {
        preSettled: opts.preSettled !== false,
        golden: !!opts.golden
      });
      return ent.id;
    },
    serveById: (id) => serveEntityById(id),
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
