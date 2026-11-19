/**
 * 星夜吃茶：喵呜甜品合合乐 (Hoshi Kissa: Starlight Patisserie)
 * Hand-crafted 2D compound-polygon rigid-body physics merge game with
 * customer orders, fever mode, hold pocket, and magic bakery tools.
 */
(() => {
  'use strict';

  const Physics = window.StarlightPhysics;
  const PHYSICS_SHAPES = window.HOSHI_PHYSICS_SHAPES || {};

  const TIERS = [
    {
      tier: 1,
      name: '蓝莓星露糖',
      en: 'Blueberry Dewdrop',
      radius: 16,
      points: 2,
      color: '#4674d6',
      crumbColor: '#b7dcff',
      material: { friction: 0.34, restitution: 0.26 },
      lore: '凝结了午夜星露的晶莹蓝莓糖，酸甜清冽，是所有甜点的起点。',
      src: 'assets/processed/tier_1.webp',
      meta: { anchor_x_norm: 0.4979, anchor_y_norm: 0.5478, radius_norm_w: 0.4972 }
    },
    {
      tier: 2,
      name: '蜜桃泡芙球',
      en: 'Peach Cream Puff',
      radius: 22,
      points: 6,
      color: '#eb8861',
      crumbColor: '#ffe3c4',
      material: { friction: 0.44, restitution: 0.21 },
      lore: '蓬松金黄的泡芙球里挤满白桃鲜奶油，脸颊总是红扑扑的。',
      src: 'assets/processed/tier_2.webp',
      meta: { anchor_x_norm: 0.5000, anchor_y_norm: 0.5582, radius_norm_w: 0.4711 }
    },
    {
      tier: 3,
      name: '抹茶猫耳团子',
      en: 'Matcha Kitty Dango',
      radius: 28,
      points: 14,
      color: '#7da85c',
      crumbColor: '#cde6a8',
      material: { friction: 0.54, restitution: 0.16 },
      lore: '揉进宇治抹茶粉的软糯猫猫团子，在月光下会轻轻抖动小耳朵。',
      src: 'assets/processed/tier_3.webp',
      meta: { anchor_x_norm: 0.4980, anchor_y_norm: 0.4838, radius_norm_w: 0.4771 }
    },
    {
      tier: 4,
      name: '柠檬蜂蜜布丁塔',
      en: 'Lemon Honey Tart',
      radius: 35,
      points: 28,
      color: '#f2c849',
      crumbColor: '#ffe38c',
      material: { friction: 0.56, restitution: 0.14 },
      lore: '香脆黄油塔皮盛满蜂蜜柠檬凝乳，咬一口就像咬住一束星光。',
      src: 'assets/processed/tier_4.webp',
      meta: { anchor_x_norm: 0.4981, anchor_y_norm: 0.5126, radius_norm_w: 0.4459 }
    },
    {
      tier: 5,
      name: '草莓奶油大福',
      en: 'Strawberry Daifuku',
      radius: 43,
      points: 52,
      color: '#f29eb6',
      crumbColor: '#ffd4e3',
      material: { friction: 0.58, restitution: 0.15 },
      lore: '冰凉Q弹的樱粉麻薯裹着雪白淡奶油，头顶一颗娇嫩甜草莓。',
      src: 'assets/processed/tier_5.webp',
      meta: { anchor_x_norm: 0.4980, anchor_y_norm: 0.5767, radius_norm_w: 0.4601 }
    },
    {
      tier: 6,
      name: '焦糖星云甜甜圈',
      en: 'Caramel Star Donut',
      radius: 52,
      points: 96,
      color: '#b86228',
      crumbColor: '#eab074',
      material: { friction: 0.52, restitution: 0.16 },
      lore: '淋满海盐琥珀焦糖与可可流心的松软甜甜圈，点缀星星糖片。',
      src: 'assets/processed/tier_6.webp',
      meta: { anchor_x_norm: 0.5000, anchor_y_norm: 0.4905, radius_norm_w: 0.4832 }
    },
    {
      tier: 7,
      name: '星夜猫猫马卡龙',
      en: 'Cosmic Kitty Macaron',
      radius: 62,
      points: 168,
      color: '#9b7fd6',
      crumbColor: '#e2d5ff',
      material: { friction: 0.48, restitution: 0.17 },
      lore: '薰衣草紫杏仁饼壳夹着梦幻奶霜夹心，安静地做着甜美的梦。',
      src: 'assets/processed/tier_7.webp',
      meta: { anchor_x_norm: 0.4960, anchor_y_norm: 0.4947, radius_norm_w: 0.4851 }
    },
    {
      tier: 8,
      name: '皇家栗子蒙布朗',
      en: 'Royal Mont Blanc',
      radius: 73,
      points: 290,
      color: '#8f5936',
      crumbColor: '#d9a97c',
      material: { friction: 0.62, restitution: 0.11 },
      lore: '层层交织的糖炒栗蓉与香草奶霜，点缀金箔，醇厚而温柔。',
      src: 'assets/processed/tier_8.webp',
      meta: { anchor_x_norm: 0.4980, anchor_y_norm: 0.5080, radius_norm_w: 0.4860 }
    },
    {
      tier: 9,
      name: '星冠猫神舒芙蕾',
      en: 'Crown Cat Soufflé',
      radius: 86,
      points: 540,
      color: '#f5be58',
      crumbColor: '#ffea99',
      material: { friction: 0.60, restitution: 0.12 },
      lore: '星夜吃茶的传说级至高甜点！戴着宝石皇冠与天使奶油翼的猫神舒芙蕾。',
      src: 'assets/processed/tier_9.webp',
      meta: { anchor_x_norm: 0.4903, anchor_y_norm: 0.6025, radius_norm_w: 0.3841 }
    }
  ];

  function getShapeDef(tier) {
    return PHYSICS_SHAPES[`tier_${tier}`];
  }

  const PATRONS = [
    {
      id: 'mikan',
      name: '店长 · 小蜜柑',
      type: 'img',
      src: 'assets/processed/chef_mikan.webp',
      greet: '刚出炉的星光面糊好香呀～请帮我准备这几份甜点吧！',
      thanks: '太棒啦！香气飘满整条月光街道了呢～'
    },
    {
      id: 'luna',
      name: '常客 · 眠眠星兔',
      type: 'svg',
      svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#4A2C2A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="34" cy="24" rx="10" ry="20" transform="rotate(-12 34 24)" fill="#F9F2E7"/>
          <ellipse cx="34" cy="25" rx="5" ry="12" transform="rotate(-12 34 25)" fill="#F7B2BD" stroke="none"/>
          <ellipse cx="66" cy="24" rx="10" ry="20" transform="rotate(12 66 24)" fill="#F9F2E7"/>
          <ellipse cx="66" cy="25" rx="5" ry="12" transform="rotate(12 66 25)" fill="#F7B2BD" stroke="none"/>
          <circle cx="50" cy="58" r="28" fill="#FFF9F0"/>
          <ellipse cx="33" cy="63" rx="6" ry="3.5" fill="#F6A3AF" stroke="none"/>
          <ellipse cx="67" cy="63" rx="6" ry="3.5" fill="#F6A3AF" stroke="none"/>
          <path d="M35 55 Q40 50 45 55" fill="none"/>
          <path d="M55 55 Q60 50 65 55" fill="none"/>
          <path d="M47 62 Q50 66 53 62" fill="none"/>
          <polygon points="50,33 52.5,38 58,38.5 54,42 55,47.5 50,44.8 45,47.5 46,42 42,38.5 47.5,38" fill="#FFD35B"/>
          <path d="M32 82 Q50 92 68 82 Q64 94 50 94 Q36 94 32 82 Z" fill="#8C7AE6"/>
        </g>
      </svg>`,
      greet: '唔…今晚的月亮好圆，好想吃软绵绵的甜点呀…',
      thanks: '哇啊！吃到幸福的味道了，谢谢主厨！'
    },
    {
      id: 'mugi',
      name: '面包迷 · 蜂蜜柴柴',
      type: 'svg',
      svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <g stroke="#4A2C2A" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="24,42 20,16 42,30" fill="#E39D49"/>
          <polygon points="76,42 80,16 58,30" fill="#E39D49"/>
          <circle cx="50" cy="56" r="29" fill="#E8A44F"/>
          <path d="M23 62 Q35 52 50 60 Q65 52 77 62 Q76 84 50 85 Q24 84 23 62 Z" fill="#FFF4DF" stroke="none"/>
          <circle cx="50" cy="56" r="29" fill="none"/>
          <circle cx="38" cy="48" r="3" fill="#FFF4DF" stroke="none"/>
          <circle cx="62" cy="48" r="3" fill="#FFF4DF" stroke="none"/>
          <circle cx="38" cy="57" r="3.2" fill="#4A2C2A" stroke="none"/>
          <circle cx="62" cy="57" r="3.2" fill="#4A2C2A" stroke="none"/>
          <ellipse cx="30" cy="64" rx="5.5" ry="3.2" fill="#F2948A" stroke="none"/>
          <ellipse cx="70" cy="64" rx="5.5" ry="3.2" fill="#F2948A" stroke="none"/>
          <ellipse cx="50" cy="61" rx="4.2" ry="3" fill="#4A2C2A" stroke="none"/>
          <path d="M44 67 Q50 72 56 67" fill="none"/>
          <path d="M32 82 Q50 93 68 82 L60 95 L50 88 L40 95 Z" fill="#E05D50"/>
        </g>
      </svg>`,
      greet: '汪呜！我闻着焦糖与奶香找过来了，拜托做这份套餐！',
      thanks: '太满足啦！下次我还要带朋友们一起来！'
    }
  ];

  // Glass Jar Physical Chamber (Logical 440 x 520 space)
  const JAR = {
    canvasW: 440,
    canvasH: 520,
    left: 30,
    right: 410,
    neckY: 74,
    dangerY: 112,
    floorY: 492,
    cornerR: 96,
    dropY: 38
  };

  const STORAGE_KEY = 'hoshi_kissa_bakery_save_v1';

  // DOM References
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const ambientCanvas = document.getElementById('ambient-canvas');
  const ambientCtx = ambientCanvas.getContext('2d');

  const scoreEl = document.getElementById('score-value');
  const bestEl = document.getElementById('best-value');
  const stardustEl = document.getElementById('stardust-value');
  const feverBox = document.getElementById('fever-box');
  const feverLabel = document.getElementById('fever-label');
  const feverPctEl = document.getElementById('fever-pct');
  const feverFillEl = document.getElementById('fever-fill');
  const modeTagEl = document.getElementById('mode-tag');

  const patronAvatarEl = document.getElementById('patron-avatar');
  const patronNameEl = document.getElementById('patron-name');
  const patronSpeechEl = document.getElementById('patron-speech');
  const orderBoxEl = document.getElementById('order-box');
  const orderSlotsEl = document.getElementById('order-slots');
  const orderRewardLineEl = document.getElementById('order-reward-line');
  const btnSkipOrder = document.getElementById('btn-skip-order');

  const nextImgEl = document.getElementById('next-img');
  const nextNameEl = document.getElementById('next-name');
  const holdBubbleEl = document.getElementById('hold-bubble');
  const holdImgEl = document.getElementById('hold-img');
  const holdEmptyEl = document.getElementById('hold-empty');
  const holdNameEl = document.getElementById('hold-name');
  const discoveredCountEl = document.getElementById('discovered-count');
  const evoRingEl = document.getElementById('evo-ring');

  const targetBannerEl = document.getElementById('target-banner');
  const targetBannerTextEl = document.getElementById('target-banner-text');
  const btnCancelTarget = document.getElementById('btn-cancel-target');

  const btnToolShake = document.getElementById('btn-tool-shake');
  const btnToolFork = document.getElementById('btn-tool-fork');
  const btnToolSpoon = document.getElementById('btn-tool-spoon');
  const badgeShake = document.getElementById('badge-shake');
  const badgeFork = document.getElementById('badge-fork');
  const badgeSpoon = document.getElementById('badge-spoon');

  const btnDebugPhys = document.getElementById('btn-debug-phys');
  const btnBgm = document.getElementById('btn-bgm');
  const btnSfx = document.getElementById('btn-sfx');
  const btnCompendium = document.getElementById('btn-compendium');
  const btnRestart = document.getElementById('btn-restart');

  const titleModal = document.getElementById('title-modal');
  const modeSelectEl = document.getElementById('mode-select');
  const btnStartGame = document.getElementById('btn-start-game');

  const compendiumModal = document.getElementById('compendium-modal');
  const compendiumGrid = document.getElementById('compendium-grid');
  const compUnlockedEl = document.getElementById('comp-unlocked');
  const btnCloseComp = document.getElementById('btn-close-comp');

  const gameoverModal = document.getElementById('gameover-modal');
  const goScoreEl = document.getElementById('go-score');
  const goBestEl = document.getElementById('go-best');
  const goNewBestEl = document.getElementById('go-new-best');
  const goMaxTierEl = document.getElementById('go-max-tier');
  const goOrdersEl = document.getElementById('go-orders');
  const goComboEl = document.getElementById('go-combo');
  const goRankEl = document.getElementById('go-rank');
  const btnPlayAgain = document.getElementById('btn-play-again');

  const toastBannerEl = document.getElementById('toast-banner');

  const audio = new window.StarlightAudio();

  // Persistent Player Save Data
  let saveData = loadSaveData();
  function loadSaveData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          bestChef: parsed.bestChef || 0,
          bestZen: parsed.bestZen || 0,
          unlockedTiers: Array.isArray(parsed.unlockedTiers) ? parsed.unlockedTiers : [1, 2, 3, 4]
        };
      }
    } catch (_) {}
    return { bestChef: 0, bestZen: 0, unlockedTiers: [1, 2, 3, 4] };
  }

  function persistSaveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (_) {}
  }

  // Preload all sprite images cleanly
  const spriteImages = {};
  let assetsReady = false;
  function loadSprites() {
    const promises = TIERS.map(
      (t) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            spriteImages[t.tier] = img;
            resolve();
          };
          img.onerror = resolve;
          img.src = t.src;
        })
    );
    return Promise.all(promises).then(() => {
      assetsReady = true;
    });
  }

  // Game State
  let gameState = {
    mode: 'chef', // 'chef' or 'zen'
    running: false,
    paused: false,
    over: false,
    score: 0,
    displayScore: 0,
    stardust: 30,
    feverEnergy: 0, // 0..100
    feverTimer: 0, // seconds remaining when active
    comboCount: 0,
    comboTimer: 0,
    maxCombo: 1,
    ordersCompleted: 0,
    maxTierRun: 1,
    seenThisRun: new Set([1, 2, 3, 4]),
    tools: {
      shake: 2,
      fork: 2,
      spoon: 1
    },
    toolCosts: {
      shake: 22,
      fork: 25,
      spoon: 35
    },
    activeToolMode: null, // null | 'fork' | 'spoon'
    dropX: 220,
    prevDropX: 220,
    aimAngle: 0, // manual tilt via Q/E or wheel (-0.78..+0.78 rad)
    dropSway: 0, // natural pendulum sway while aiming horizontally
    debugPhysics: false, // toggleable wireframe/contact inspector
    lastDebugContacts: [],
    curTier: 1,
    nextTier: 2,
    holdTier: null,
    canHoldThisTurn: true,
    dropCooldown: 0,
    dangerDuration: 0,
    jarShakeAmp: 0,
    nextEntityId: 1,
    entities: [],
    particles: [],
    popups: [],
    order: null,
    skipCooldown: 0,
    hoveredEntityId: null,
    speechTimer: 0
  };

  // Ambient Fireflies
  const fireflies = Array.from({ length: 28 }, () => ({
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.015,
    vy: -0.005 - Math.random() * 0.012,
    r: 1.5 + Math.random() * 2.5,
    phase: Math.random() * Math.PI * 2
  }));

  function resizeCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = JAR.canvasW * dpr;
    canvas.height = JAR.canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ambientCanvas.width = window.innerWidth * dpr;
    ambientCanvas.height = window.innerHeight * dpr;
    ambientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resizeCanvases);

  // Toast helper
  let toastTimeout = null;
  function showToast(msg) {
    toastBannerEl.textContent = msg;
    toastBannerEl.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toastBannerEl.classList.remove('visible'), 2200);
  }

  function setPatronSpeech(patron, text, duration = 4.2) {
    if (patron.type === 'img') {
      patronAvatarEl.innerHTML = `<img src="${patron.src}" alt="${patron.name}" />`;
    } else {
      patronAvatarEl.innerHTML = patron.svg;
    }
    patronNameEl.textContent = patron.name;
    patronSpeechEl.textContent = text;
    gameState.speechTimer = duration;
  }

  // Weighted drop tier selection (Tiers 1..4)
  function pickDropTier() {
    const r = Math.random();
    if (r < 0.36) return 1;
    if (r < 0.68) return 2;
    if (r < 0.90) return 3;
    return 4;
  }

  function unlockTier(tier) {
    gameState.seenThisRun.add(tier);
    if (tier > gameState.maxTierRun) gameState.maxTierRun = tier;
    if (!saveData.unlockedTiers.includes(tier)) {
      saveData.unlockedTiers.push(tier);
      saveData.unlockedTiers.sort((a, b) => a - b);
      persistSaveData();
      showToast(`✨ 新甜品解锁：${TIERS[tier - 1].name}！`);
    }
    updateEvolutionRing();
  }

  function getBestScore() {
    return gameState.mode === 'chef' ? saveData.bestChef : saveData.bestZen;
  }

  function setBestScore(val) {
    if (gameState.mode === 'chef') {
      saveData.bestChef = Math.max(saveData.bestChef, val);
    } else {
      saveData.bestZen = Math.max(saveData.bestZen, val);
    }
    persistSaveData();
  }

  function getChefRank(score) {
    if (score >= 7000) return '👑 传奇猫神糕点宗师';
    if (score >= 4000) return '🌙 星夜首席主厨';
    if (score >= 2000) return '⭐ 银星甜点师';
    if (score >= 800) return '🧁 温柔烘焙师';
    return '🐾 见习甜点师';
  }

  // Build Evolution Ring Nodes around oval path
  function buildEvolutionRing() {
    const existing = evoRingEl.querySelectorAll('.evo-node');
    existing.forEach((el) => el.remove());

    const w = evoRingEl.clientWidth || 226;
    const h = evoRingEl.clientHeight || 176;
    const cx = w / 2;
    const cy = h / 2;
    const rx = Math.min(82, w * 0.36);
    const ry = Math.min(62, h * 0.35);

    TIERS.forEach((t, i) => {
      const angle = -Math.PI / 2 + (i / TIERS.length) * Math.PI * 2;
      const x = cx + Math.cos(angle) * rx;
      const y = cy + Math.sin(angle) * ry;
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'evo-node';
      node.dataset.tier = String(t.tier);
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.title = `${t.tier}阶 · ${t.name} (+${t.points}分)`;
      node.innerHTML = `<img src="${t.src}" alt="${t.name}" />`;
      node.addEventListener('click', () => openCompendium());
      evoRingEl.appendChild(node);
    });
    updateEvolutionRing();
  }

  function updateEvolutionRing() {
    const nodes = evoRingEl.querySelectorAll('.evo-node');
    nodes.forEach((n) => {
      const tier = Number(n.dataset.tier);
      const seen = gameState.seenThisRun.has(tier);
      n.classList.toggle('is-seen', seen);
      n.classList.toggle('is-unseen', !seen);
    });
    discoveredCountEl.textContent = `${gameState.seenThisRun.size} / ${TIERS.length}`;
  }

  // Order Generation (Chef Mode)
  function generateOrder() {
    const maxMade = gameState.maxTierRun;
    const orderNum = gameState.ordersCompleted;
    const patron = PATRONS[(orderNum + Math.floor(Math.random() * PATRONS.length)) % PATRONS.length];

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

    const rewardScore = reqTiers.reduce((acc, t) => acc + TIERS[t - 1].points * 6, 80);
    const rewardDust = 16 + reqTiers.reduce((acc, t) => acc + t * 2, 0);

    gameState.order = {
      patron,
      slots: reqTiers.map((tier) => ({ tier, done: false })),
      rewardScore,
      rewardDust
    };

    setPatronSpeech(patron, patron.greet, 4.5);
    checkExistingBoardForOrder();
    renderOrder();
  }

  function checkExistingBoardForOrder() {
    if (!gameState.order || gameState.mode !== 'chef') return;
    // Match unfulfilled order slots against treats currently in the jar (without double-counting one treat)
    const usedIds = new Set();
    for (const slot of gameState.order.slots) {
      if (slot.done) continue;
      const match = gameState.entities.find(
        (e) => e.tier === slot.tier && !usedIds.has(e.id) && !e.creditedToOrder
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
    if (!gameState.order || gameState.mode !== 'chef') return;
    const slot = gameState.order.slots.find((s) => !s.done && s.tier === tier);
    if (slot) {
      slot.done = true;
      if (entity) entity.creditedToOrder = true;
      audio.playOrderStamp();
      spawnSparkleBurst(
        entity ? entity.x : JAR.canvasW / 2,
        entity ? entity.y : 250,
        '#ffd85d',
        12
      );
      renderOrder();
      checkOrderComplete();
    }
  }

  function checkOrderComplete() {
    if (!gameState.order || gameState.mode !== 'chef') return;
    if (gameState.order.slots.every((s) => s.done)) {
      const ord = gameState.order;
      gameState.ordersCompleted++;
      const mult = gameState.feverTimer > 0 ? 2 : 1;
      const pts = ord.rewardScore * mult;
      addScore(pts);
      gameState.stardust += ord.rewardDust;
      addFeverEnergy(28);
      audio.playOrderComplete();

      // Grant bonus random tool charge every 2 orders
      let toolMsg = '';
      if (gameState.ordersCompleted % 2 === 0) {
        const pool = ['shake', 'fork', 'spoon'];
        const gift = pool[Math.floor(Math.random() * pool.length)];
        gameState.tools[gift]++;
        const label = gift === 'shake' ? '摇一摇' : gift === 'fork' ? '泡泡叉' : '升阶勺';
        toolMsg = ` · +1 ${label}`;
      }

      setPatronSpeech(ord.patron, ord.patron.thanks, 3.6);
      showToast(`🎉 订单完成！+${pts} 分 · +${ord.rewardDust} ⭐${toolMsg}`);
      spawnPopup(JAR.canvasW / 2, 170, `订单完成! +${pts}`, '#ffe57e', 20);
      spawnSparkleBurst(JAR.canvasW / 2, 180, '#ffd45e', 24);

      updateHUD();
      setTimeout(() => {
        if (gameState.running && !gameState.over && gameState.mode === 'chef') {
          generateOrder();
        }
      }, 950);
    } else {
      renderOrder();
    }
  }

  function renderOrder() {
    if (gameState.mode !== 'chef') {
      orderBoxEl.style.display = 'none';
      return;
    }
    orderBoxEl.style.display = 'block';
    if (!gameState.order) return;

    orderSlotsEl.innerHTML = '';
    gameState.order.slots.forEach((slot) => {
      const t = TIERS[slot.tier - 1];
      const div = document.createElement('div');
      div.className = `order-slot${slot.done ? ' is-done' : ''}`;
      div.innerHTML = `
        <img src="${t.src}" alt="${t.name}" />
        <div class="order-slot-name">${t.name}</div>
      `;
      orderSlotsEl.appendChild(div);
    });
    orderRewardLineEl.textContent = `完成奖励: +${gameState.order.rewardScore} 分 · +${gameState.order.rewardDust} ⭐`;
  }

  // Score, Fever & HUD Sync
  function addScore(pts) {
    gameState.score += pts;
    if (gameState.score > getBestScore()) {
      setBestScore(gameState.score);
    }
  }

  function addFeverEnergy(amount) {
    if (gameState.feverTimer > 0) return;
    gameState.feverEnergy = Math.min(100, gameState.feverEnergy + amount);
    if (gameState.feverEnergy >= 100) {
      gameState.feverTimer = 10.0;
      gameState.feverEnergy = 100;
      audio.playFeverStart();
      showToast('🌈 星光狂热时刻启动！10秒内所有合成双倍积分！');
      setPatronSpeech(PATRONS[0], '哇啊——星光狂热开启啦！双倍烘焙积分冲呀！！', 4.5);
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffdf6b', 30);
    }
  }

  function updateHUD() {
    bestEl.textContent = String(getBestScore());
    stardustEl.textContent = String(gameState.stardust);

    const isFever = gameState.feverTimer > 0;
    feverBox.classList.toggle('is-fever', isFever);
    if (isFever) {
      const pct = Math.max(0, (gameState.feverTimer / 10.0) * 100);
      feverFillEl.style.width = `${pct.toFixed(1)}%`;
      feverLabel.textContent = '🌈 星光狂热 2×';
      feverPctEl.textContent = `${gameState.feverTimer.toFixed(1)}s`;
    } else {
      feverFillEl.style.width = `${Math.round(gameState.feverEnergy)}%`;
      feverLabel.textContent = '✨ 星光能量槽';
      feverPctEl.textContent = `${Math.round(gameState.feverEnergy)}%`;
    }

    // Next & Hold Previews
    const nextDef = TIERS[gameState.nextTier - 1];
    nextImgEl.src = nextDef.src;
    nextNameEl.textContent = nextDef.name;

    if (gameState.holdTier) {
      const holdDef = TIERS[gameState.holdTier - 1];
      holdImgEl.src = holdDef.src;
      holdImgEl.style.display = 'block';
      holdEmptyEl.style.display = 'none';
      holdNameEl.textContent = holdDef.name;
    } else {
      holdImgEl.style.display = 'none';
      holdEmptyEl.style.display = 'block';
      holdNameEl.textContent = '快捷键 [H]';
    }

    // Tool Badges
    updateToolBadge(btnToolShake, badgeShake, 'shake');
    updateToolBadge(btnToolFork, badgeFork, 'fork');
    updateToolBadge(btnToolSpoon, badgeSpoon, 'spoon');

    modeTagEl.textContent = gameState.mode === 'chef' ? '星夜主厨模式' : '悠闲经典模式';
  }

  function updateToolBadge(btn, badgeEl, key) {
    const cnt = gameState.tools[key];
    const cost = gameState.toolCosts[key];
    const armed = gameState.activeToolMode === key;
    btn.classList.toggle('is-armed', armed);
    btn.classList.toggle('is-empty', cnt <= 0);
    if (cnt > 0) {
      badgeEl.textContent = String(cnt);
      badgeEl.classList.remove('buy-mode');
    } else {
      badgeEl.textContent = `${cost}⭐`;
      badgeEl.classList.add('buy-mode');
    }
  }

  // Tool Activation
  function armOrUseTool(key) {
    if (!gameState.running || gameState.over) return;
    audio.ensureCtx();

    if (gameState.activeToolMode === key) {
      cancelToolMode();
      return;
    }

    // Check charge or purchase with Star Dust
    if (gameState.tools[key] <= 0) {
      const cost = gameState.toolCosts[key];
      if (gameState.stardust < cost) {
        showToast(`⭐ 星尘币不足（需要 ${cost} ⭐）`);
        return;
      }
      gameState.stardust -= cost;
      gameState.tools[key] = 1;
      showToast(`⭐ 消耗 ${cost} 星尘补充了 1 次道具！`);
      updateHUD();
    }

    if (key === 'shake') {
      gameState.tools.shake--;
      gameState.jarShakeAmp = 1.0;
      audio.playTool('shake');
      // Apply playful physical tumble impulse to all settled pieces
      for (const e of gameState.entities) {
        e.vy -= 170 + Math.random() * 140;
        e.vx += (Math.random() - 0.5) * 260;
        e.vr += (Math.random() - 0.5) * 7;
      }
      spawnSparkleBurst(JAR.canvasW / 2, 320, '#ffd85d', 20);
      showToast('🔔 叮铃！玻璃罐轻轻摇晃起来了！');
      updateHUD();
      return;
    }

    // Targeting mode for fork or spoon
    gameState.activeToolMode = key;
    canvas.classList.add('tool-targeting');
    targetBannerEl.classList.add('visible');
    targetBannerTextEl.textContent =
      key === 'fork'
        ? '🫧 点击罐内 1~4 阶小甜品即可消除'
        : '✨ 点击罐内任意甜品 (1~8 阶) 立刻升阶';
    updateHUD();
  }

  function cancelToolMode() {
    gameState.activeToolMode = null;
    canvas.classList.remove('tool-targeting');
    targetBannerEl.classList.remove('visible');
    updateHUD();
  }

  // Hold / Pocket Swap
  function swapHoldPocket() {
    if (!gameState.running || gameState.over || gameState.activeToolMode) return;
    if (!gameState.canHoldThisTurn) {
      showToast('放下一颗甜品后才能再次交换暂存哦～');
      return;
    }
    audio.ensureCtx();
    audio.playTool('swap');

    if (gameState.holdTier === null) {
      gameState.holdTier = gameState.curTier;
      gameState.curTier = gameState.nextTier;
      gameState.nextTier = pickDropTier();
    } else {
      const tmp = gameState.holdTier;
      gameState.holdTier = gameState.curTier;
      gameState.curTier = tmp;
    }
    gameState.canHoldThisTurn = false;
    clampDropX();
    updateHUD();
  }

  function getAimTotalAngle() {
    return Math.max(-0.85, Math.min(0.85, gameState.aimAngle + gameState.dropSway));
  }

  function clampDropX() {
    const def = TIERS[gameState.curTier - 1];
    const shapeDef = getShapeDef(gameState.curTier);
    let leftExt = def.radius;
    let rightExt = def.radius;
    if (shapeDef && Physics) {
      const ex = Physics.getRotatedHalfExtentsX(shapeDef, def.radius, getAimTotalAngle());
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

  // Spawn & Drop Treat
  function createEntity(tier, x, y, vx = 0, vy = 0, bornFromMerge = false, initialAngle = 0, initialVr = 0) {
    const def = TIERS[tier - 1];
    const shapeDef = getShapeDef(tier);
    const entity = {
      id: gameState.nextEntityId++,
      tier,
      r: def.radius,
      mass: def.radius * def.radius,
      x,
      y,
      vx,
      vy,
      angle: bornFromMerge ? initialAngle : initialAngle,
      vr: initialVr,
      // Directional soft-body spring squish along actual impact normal
      squishAmt: bornFromMerge ? 0.24 : 0,
      squishVel: 0,
      squishAngle: bornFromMerge ? Math.PI * 0.5 : 0,
      age: 0,
      dangerTime: 0,
      inContact: false,
      merged: false,
      creditedToOrder: false
    };
    Physics.configureBodyShape(entity, shapeDef, def.radius, def.material);
    if (bornFromMerge) {
      Physics.clampBodyInsideJarPositional(entity, JAR);
    }
    gameState.entities.push(entity);
    unlockTier(tier);
    return entity;
  }

  function dropCurrentTreat() {
    if (!gameState.running || gameState.over || gameState.paused) return;
    if (gameState.activeToolMode || gameState.dropCooldown > 0) return;

    audio.ensureCtx();
    clampDropX();
    const totalAngle = getAimTotalAngle();
    const dropVx = gameState.dropSway * 55;
    const dropVr = gameState.dropSway * 1.4;
    createEntity(gameState.curTier, gameState.dropX, JAR.dropY, dropVx, 42, false, totalAngle, dropVr);
    audio.playDrop();

    gameState.curTier = gameState.nextTier;
    gameState.nextTier = pickDropTier();
    gameState.aimAngle = 0;
    gameState.dropSway *= 0.35;
    gameState.canHoldThisTurn = true;
    gameState.dropCooldown = 0.40;
    clampDropX();
    updateHUD();
  }

  // Particle & Floating Score FX
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

  // Tiny pastry crumb / sugar-dust particles emitted right at exact contact points
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
    gameState.popups.push({
      x,
      y,
      vy: -52,
      text,
      color,
      fontSize,
      life: 0.95,
      maxLife: 0.95
    });
  }

  // Fixed-Timestep 2D Compound-Convex-Polygon Rigid-Body Physics + Merge Pipeline
  function stepPhysics(dt) {
    const result = Physics.stepWorld(gameState.entities, JAR, dt, 1180);
    const { mergePairs, impacts, debugContacts } = result;
    gameState.lastDebugContacts = debugContacts;

    // Trigger directional soft-body squish, contact-point crumbs, and tier-weighted impact sound
    if (impacts.length > 0) {
      let strongest = impacts[0];
      for (let i = 0; i < impacts.length; i++) {
        const imp = impacts[i];
        if (imp.speed > strongest.speed) strongest = imp;
        applyDirectionalSquish(imp.bodyB, imp.nx, imp.ny, imp.speed);
        if (imp.bodyA) {
          applyDirectionalSquish(imp.bodyA, -imp.nx, -imp.ny, imp.speed);
        }
        if (imp.speed > 135) {
          const defB = TIERS[imp.bodyB.tier - 1];
          const intensity = Math.min(1, (imp.speed - 110) / 520);
          spawnImpactCrumbs(imp.x, imp.y, imp.nx, imp.ny, defB.crumbColor, intensity);
        }
      }

      if (strongest.speed > 100) {
        const intensity = Math.min(1, (strongest.speed - 85) / 480);
        const hitGlass = strongest.bodyA === null;
        const sndTier = strongest.bodyA
          ? Math.max(strongest.bodyA.tier, strongest.bodyB.tier)
          : strongest.bodyB.tier;
        audio.playBounce(intensity, sndTier, hitGlass);
      }
    }

    // Process merges outside substep loop
    if (mergePairs.length > 0) {
      gameState.entities = gameState.entities.filter((e) => !e.merged);
      for (const [a, b] of mergePairs) {
        const mx = (a.x + b.x) * 0.5;
        const my = (a.y + b.y) * 0.5;
        const mvx = (a.vx + b.vx) * 0.35;
        const mvy = Math.min(0, (a.vy + b.vy) * 0.35) - 55;
        const mAngle = Math.atan2(
          Math.sin(a.angle) + Math.sin(b.angle),
          Math.cos(a.angle) + Math.cos(b.angle)
        ) * 0.35;
        const mVr = (a.vr + b.vr) * 0.25;

        gameState.comboCount = gameState.comboTimer > 0 ? gameState.comboCount + 1 : 1;
        gameState.comboTimer = 1.65;
        if (gameState.comboCount > gameState.maxCombo) {
          gameState.maxCombo = gameState.comboCount;
        }

        const feverMult = gameState.feverTimer > 0 ? 2 : 1;
        const comboBonus = 1 + Math.min(1.5, (gameState.comboCount - 1) * 0.25);

        if (a.tier < 9) {
          const nextTier = a.tier + 1;
          const def = TIERS[nextTier - 1];
          const born = createEntity(nextTier, mx, my, mvx, mvy, true, mAngle, mVr);
          const pts = Math.round(def.points * feverMult * comboBonus);
          addScore(pts);
          if (nextTier >= 4) {
            gameState.stardust += Math.max(1, Math.floor(nextTier / 2));
          }
          addFeverEnergy(5 + nextTier * 2.2);
          audio.playMerge(nextTier, gameState.comboCount);
          spawnSparkleBurst(mx, my, def.color, 12 + nextTier * 2);

          const label =
            gameState.comboCount >= 2
              ? `${gameState.comboCount}连合! +${pts}`
              : `+${pts}`;
          spawnPopup(mx, my - def.radius * 0.6, label, gameState.comboCount >= 2 ? '#ffe46b' : '#ffffff', gameState.comboCount >= 2 ? 17 : 14);

          if (nextTier === 9) {
            showToast('👑 奇迹诞生！合成传说级【星冠猫神舒芙蕾】！');
            setPatronSpeech(PATRONS[0], '哇！！星冠猫神舒芙蕾诞生了！整座甜品屋都在发光！', 5.0);
          }

          notifyTreatSynthesized(nextTier, born);
        } else {
          // Two Tier 9 Crown Cat Souffles merge -> Celestial Supernova!
          const pts = 1500 * feverMult;
          addScore(pts);
          gameState.stardust += 50;
          addFeverEnergy(60);
          audio.playSupernova();
          spawnSparkleBurst(mx, my, '#ffe378', 42);
          spawnPopup(mx, my, `👑 星冠超新星! +${pts}`, '#ffe570', 22);
          showToast('🌟 传说奇景！双倍星冠猫神引发了甜品超新星！');
          // Gently clear tiny Tier 1 clutter around supernova
          gameState.entities = gameState.entities.filter((e) => {
            if (e.tier === 1 && Math.hypot(e.x - mx, e.y - my) < 170) {
              spawnSparkleBurst(e.x, e.y, '#9be0ff', 8);
              return false;
            }
            return true;
          });
        }
      }
      updateHUD();
    }

    // Update age, harmonic soft-body spring squish, and exact polygon-top overflow check
    let anyDanger = false;
    for (const e of gameState.entities) {
      e.age += dt;
      // Underdamped spring oscillator for juicy pastry rebound along impact normal
      e.squishVel += (-210 * e.squishAmt - 18 * e.squishVel) * dt;
      e.squishAmt += e.squishVel * dt;
      if (Math.abs(e.squishAmt) < 0.001 && Math.abs(e.squishVel) < 0.01) {
        e.squishAmt = 0;
        e.squishVel = 0;
      } else {
        e.squishAmt = Math.max(-0.14, Math.min(0.28, e.squishAmt));
      }

      if (e.age > 0.95 && e.aabbMinY < JAR.dangerY) {
        anyDanger = true;
      }
    }

    if (anyDanger) {
      gameState.dangerDuration += dt;
      if (gameState.dangerDuration > 2.65) {
        triggerGameOver();
      }
    } else {
      gameState.dangerDuration = Math.max(0, gameState.dangerDuration - dt * 2.2);
    }
  }

  function triggerGameOver() {
    if (gameState.over) return;
    gameState.over = true;
    gameState.running = false;
    cancelToolMode();
    audio.playGameOver();

    const bestBefore = getBestScore();
    const isNewBest = gameState.score > 0 && gameState.score >= bestBefore;
    setBestScore(gameState.score);

    goScoreEl.textContent = String(gameState.score);
    goBestEl.textContent = String(getBestScore());
    goNewBestEl.style.display = isNewBest ? 'inline-block' : 'none';
    goMaxTierEl.textContent = `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}`;
    goOrdersEl.textContent = String(gameState.ordersCompleted);
    goComboEl.textContent = String(gameState.maxCombo);
    goRankEl.textContent = getChefRank(gameState.score);

    updateHUD();
    gameoverModal.classList.add('is-open');
  }

  // Rendering: Starlight Glass Jar + Ghost Drop Line + Sprites + Particles
  function drawStar(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      const rad = i % 2 === 0 ? r : r * 0.42;
      if (i === 0) c.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else c.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  function traceJarInnerPath(c) {
    const { left, right, neckY, floorY, cornerR } = JAR;
    c.beginPath();
    c.moveTo(left, neckY);
    c.lineTo(left, floorY - cornerR);
    c.arc(left + cornerR, floorY - cornerR, cornerR, Math.PI, Math.PI / 2, true);
    c.lineTo(right - cornerR, floorY);
    c.arc(right - cornerR, floorY - cornerR, cornerR, Math.PI / 2, 0, true);
    c.lineTo(right, neckY);
  }

  function predictLandingY(tier, dropX, angle) {
    const def = TIERS[tier - 1];
    const shapeDef = getShapeDef(tier);
    if (!shapeDef || !Physics) return JAR.floorY - def.radius;
    const hitY = Physics.predictDropLandingY(
      shapeDef,
      def.radius,
      dropX,
      JAR.dropY,
      angle,
      JAR,
      gameState.entities
    );
    return Math.max(JAR.dropY + 20, hitY);
  }

  function drawShapePolygons(c, shapeDef, x, y, r, angle, strokeStyle, lineWidth, fillStyle = null, dash = null) {
    if (!shapeDef) return;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    c.save();
    if (dash) c.setLineDash(dash);
    c.strokeStyle = strokeStyle;
    c.lineWidth = lineWidth;
    c.lineJoin = 'round';
    if (fillStyle) c.fillStyle = fillStyle;
    for (const poly of shapeDef.polygons) {
      c.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const lx = poly[i][0] * r;
        const ly = poly[i][1] * r;
        const wx = x + lx * cos - ly * sin;
        const wy = y + lx * sin + ly * cos;
        if (i === 0) c.moveTo(wx, wy);
        else c.lineTo(wx, wy);
      }
      c.closePath();
      if (fillStyle) c.fill();
      c.stroke();
    }
    if (dash) c.setLineDash([]);
    c.restore();
  }

  function drawEntityWorldPolys(c, entity, strokeStyle, lineWidth) {
    if (!entity.worldPolys) return;
    c.save();
    c.strokeStyle = strokeStyle;
    c.lineWidth = lineWidth;
    c.lineJoin = 'round';
    for (const wp of entity.worldPolys) {
      const verts = wp.verts;
      c.beginPath();
      for (let i = 0; i < verts.length; i++) {
        if (i === 0) c.moveTo(verts[i].x, verts[i].y);
        else c.lineTo(verts[i].x, verts[i].y);
      }
      c.closePath();
      c.stroke();
    }
    c.restore();
  }

  function drawPhysicsDebugOverlay(c) {
    const polyPalette = [
      { stroke: 'rgba(72, 238, 255, 0.95)', fill: 'rgba(72, 238, 255, 0.14)' },
      { stroke: 'rgba(255, 212, 74, 0.95)', fill: 'rgba(255, 212, 74, 0.16)' },
      { stroke: 'rgba(255, 130, 175, 0.95)', fill: 'rgba(255, 130, 175, 0.16)' },
      { stroke: 'rgba(135, 255, 148, 0.95)', fill: 'rgba(135, 255, 148, 0.16)' },
      { stroke: 'rgba(196, 152, 255, 0.95)', fill: 'rgba(196, 152, 255, 0.16)' }
    ];

    c.save();
    // 1. Draw exact curved-bottom jar physical boundary in crisp dashed cyan
    traceJarInnerPath(c);
    c.strokeStyle = 'rgba(100, 240, 255, 0.65)';
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]);
    c.stroke();
    c.setLineDash([]);

    // 2. Draw every rigid body's compound convex polygons, vertices & true Center of Mass
    for (const e of gameState.entities) {
      if (!e.worldPolys) continue;
      for (let p = 0; p < e.worldPolys.length; p++) {
        const wp = e.worldPolys[p];
        const verts = wp.verts;
        const pal = polyPalette[p % polyPalette.length];
        c.beginPath();
        for (let i = 0; i < verts.length; i++) {
          if (i === 0) c.moveTo(verts[i].x, verts[i].y);
          else c.lineTo(verts[i].x, verts[i].y);
        }
        c.closePath();
        c.fillStyle = pal.fill;
        c.fill();
        c.strokeStyle = pal.stroke;
        c.lineWidth = 1.7;
        c.lineJoin = 'round';
        c.stroke();

        // Vertex nodes
        c.fillStyle = pal.stroke;
        for (let i = 0; i < verts.length; i++) {
          c.beginPath();
          c.arc(verts[i].x, verts[i].y, 1.9, 0, Math.PI * 2);
          c.fill();
        }
      }

      // Orientation radius tick from Center of Mass
      const ox = e.x + Math.cos(e.angle) * Math.min(16, e.r * 0.45);
      const oy = e.y + Math.sin(e.angle) * Math.min(16, e.r * 0.45);
      c.beginPath();
      c.moveTo(e.x, e.y);
      c.lineTo(ox, oy);
      c.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      c.lineWidth = 1.4;
      c.stroke();

      // True Center of Mass dot
      c.beginPath();
      c.arc(e.x, e.y, 3.2, 0, Math.PI * 2);
      c.fillStyle = '#ff4b4b';
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.2;
      c.stroke();
    }

    // 3. Draw live SAT / Jar contact points & contact normal arrows
    const contacts = gameState.lastDebugContacts || [];
    for (let i = 0; i < contacts.length; i++) {
      const ct = contacts[i];
      const nx = ct.nx;
      const ny = ct.ny;
      const arrowLen = 16;
      const ex = ct.px + nx * arrowLen;
      const ey = ct.py + ny * arrowLen;

      // Contact normal shaft
      c.beginPath();
      c.moveTo(ct.px, ct.py);
      c.lineTo(ex, ey);
      c.strokeStyle = '#ffe259';
      c.lineWidth = 2;
      c.stroke();

      // Contact point diamond
      c.save();
      c.translate(ct.px, ct.py);
      c.rotate(Math.PI / 4);
      c.fillStyle = '#ff6b2b';
      c.strokeStyle = '#fff5b8';
      c.lineWidth = 1.2;
      c.fillRect(-3.2, -3.2, 6.4, 6.4);
      c.strokeRect(-3.2, -3.2, 6.4, 6.4);
      c.restore();
    }

    // 4. Compact telemetry badge inside top-left of jar
    const polyCount = gameState.entities.reduce((s, e) => s + (e.worldPolys ? e.worldPolys.length : 0), 0);
    const label = `SAT 复合多边形 · ${gameState.entities.length}体 / ${polyCount}凸块 / ${contacts.length}接触点`;
    c.fillStyle = 'rgba(10, 22, 32, 0.78)';
    c.strokeStyle = 'rgba(72, 238, 255, 0.55)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.roundRect(JAR.left + 10, JAR.neckY + 14, 246, 21, 8);
    c.fill();
    c.stroke();
    c.fillStyle = '#a8f6ff';
    c.font = 'bold 11px sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(label, JAR.left + 18, JAR.neckY + 25);
    c.restore();
  }

  function renderGameCanvas(nowSec) {
    ctx.clearRect(0, 0, JAR.canvasW, JAR.canvasH);

    ctx.save();
    // Apply playful jar shake offset when bell tool is active
    if (gameState.jarShakeAmp > 0.01) {
      const ox = Math.sin(nowSec * 52) * 7 * gameState.jarShakeAmp;
      const oy = Math.cos(nowSec * 44) * 4 * gameState.jarShakeAmp;
      ctx.translate(ox, oy);
    }

    const isFever = gameState.feverTimer > 0;

    // 1. Soft floor shadow under glass jar on wooden counter
    const shadowGrad = ctx.createRadialGradient(220, JAR.floorY + 12, 20, 220, JAR.floorY + 12, 165);
    shadowGrad.addColorStop(0, 'rgba(38, 18, 6, 0.55)');
    shadowGrad.addColorStop(1, 'rgba(38, 18, 6, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(220, JAR.floorY + 11, 155, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Translucent glass chamber back-fill
    ctx.save();
    traceJarInnerPath(ctx);
    ctx.closePath();
    const bgGrad = ctx.createLinearGradient(0, JAR.neckY, 0, JAR.floorY);
    if (isFever) {
      bgGrad.addColorStop(0, 'rgba(255, 226, 130, 0.22)');
      bgGrad.addColorStop(0.6, 'rgba(255, 200, 110, 0.12)');
      bgGrad.addColorStop(1, 'rgba(255, 224, 150, 0.24)');
    } else {
      bgGrad.addColorStop(0, 'rgba(170, 225, 238, 0.14)');
      bgGrad.addColorStop(0.6, 'rgba(22, 60, 74, 0.24)');
      bgGrad.addColorStop(1, 'rgba(255, 228, 175, 0.14)');
    }
    ctx.fillStyle = bgGrad;
    ctx.fill();
    ctx.restore();

    // 3. Danger Overflow Line
    const dangerRatio = Math.min(1, gameState.dangerDuration / 2.65);
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([7, 6]);
    ctx.moveTo(JAR.left + 8, JAR.dangerY);
    ctx.lineTo(JAR.right - 8, JAR.dangerY);
    if (dangerRatio > 0.05) {
      const pulse = 0.55 + 0.45 * Math.sin(nowSec * 12);
      ctx.strokeStyle = `rgba(255, 92, 82, ${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = 2.6;
    } else {
      ctx.strokeStyle = 'rgba(255, 214, 138, 0.36)';
      ctx.lineWidth = 1.8;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    if (dangerRatio > 0.08) {
      const rem = Math.max(0, 2.65 - gameState.dangerDuration).toFixed(1);
      ctx.fillStyle = 'rgba(224, 62, 52, 0.92)';
      ctx.beginPath();
      ctx.roundRect(156, JAR.dangerY - 22, 128, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`⚠️ 即将溢出 ${rem}s`, 220, JAR.dangerY - 12);
    }
    ctx.restore();

    // 4. Exact Polygon Drop Trajectory Guide + Ghost Silhouette + Held Treat
    if (gameState.running && !gameState.over && !gameState.activeToolMode) {
      const curDef = TIERS[gameState.curTier - 1];
      const curShape = getShapeDef(gameState.curTier);
      const aimAngle = getAimTotalAngle();
      const landY = predictLandingY(gameState.curTier, gameState.dropX, aimAngle);

      // Dashed golden guide line from held treat down to exact landing height
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 6]);
      ctx.moveTo(gameState.dropX, JAR.dropY + curDef.radius * 0.9 + 2);
      ctx.lineTo(gameState.dropX, Math.max(JAR.dropY + curDef.radius, landY - curDef.radius * 0.65));
      ctx.strokeStyle = 'rgba(255, 224, 132, 0.58)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Exact landing ghost silhouette (faint sprite + dashed compound polygon contour)
      if (landY > JAR.dropY + 26) {
        drawTierSprite(gameState.curTier, gameState.dropX, landY, curDef.radius, aimAngle, 0, 0, 0.22);
        drawShapePolygons(
          ctx,
          curShape,
          gameState.dropX,
          landY,
          curDef.radius,
          aimAngle,
          'rgba(255, 232, 148, 0.52)',
          1.4,
          'rgba(255, 224, 132, 0.06)',
          [4, 4]
        );
      }

      // Current treat hovering above rim
      if (gameState.dropCooldown <= 0.14) {
        drawTierSprite(gameState.curTier, gameState.dropX, JAR.dropY, curDef.radius, aimAngle, 0, 0, 1);

        // Show subtle manual tilt readout pill when player tilts with Q/E or wheel
        if (Math.abs(gameState.aimAngle) > 0.03) {
          const deg = Math.round((gameState.aimAngle * 180) / Math.PI);
          const sign = deg > 0 ? '+' : '';
          ctx.save();
          ctx.fillStyle = 'rgba(38, 22, 12, 0.84)';
          ctx.strokeStyle = 'rgba(255, 218, 128, 0.75)';
          ctx.lineWidth = 1.2;
          const pillX = Math.min(JAR.right - 56, Math.max(JAR.left + 4, gameState.dropX + curDef.radius + 8));
          ctx.beginPath();
          ctx.roundRect(pillX, JAR.dropY - 10, 48, 18, 9);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffe599';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`↻ ${sign}${deg}°`, pillX + 24, JAR.dropY - 1);
          ctx.restore();
        }
      }
    }

    // 5. All Physics Entities inside Jar
    for (const e of gameState.entities) {
      const isHovered = gameState.activeToolMode && gameState.hoveredEntityId === e.id;
      const validTarget =
        isHovered &&
        ((gameState.activeToolMode === 'fork' && e.tier <= 4) ||
          (gameState.activeToolMode === 'spoon' && e.tier < 9));

      drawTierSprite(e.tier, e.x, e.y, e.r, e.angle, e.squishAmt, e.squishAngle, 1);

      // Highlight exact polygon contour when targeting with Fork or Spoon
      if (validTarget) {
        drawEntityWorldPolys(
          ctx,
          e,
          gameState.activeToolMode === 'fork' ? '#91f2ff' : '#ffe169',
          3.2
        );
      } else if (isHovered && gameState.activeToolMode === 'fork' && e.tier > 4) {
        drawEntityWorldPolys(ctx, e, 'rgba(255, 100, 90, 0.82)', 2.4);
      }
    }

    // 5.5 Optional Real-Time Physics Wireframe & Contact Inspector
    if (gameState.debugPhysics) {
      drawPhysicsDebugOverlay(ctx);
    }

    // 6. Sparkle & Impact Crumb Particles
    for (const p of gameState.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = p.crumb ? alpha * 0.92 : alpha;
      ctx.fillStyle = p.color;
      if (p.star) {
        drawStar(ctx, p.x, p.y, p.size * 1.4, p.life * 6);
      } else if (p.crumb) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 10);
        ctx.beginPath();
        ctx.roundRect(-p.size, -p.size * 0.72, p.size * 2, p.size * 1.44, p.size * 0.5);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 7. Glass Jar Specular Highlights, Rim Outline & Brass Collar
    ctx.save();
    // Outer dark-sepia storybook glass outline + warm rim glow
    traceJarInnerPath(ctx);
    ctx.lineWidth = 9;
    ctx.strokeStyle = isFever ? 'rgba(255, 215, 92, 0.55)' : 'rgba(255, 244, 214, 0.35)';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    traceJarInnerPath(ctx);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();

    // Curved specular glass sheen on left & right walls
    ctx.beginPath();
    ctx.moveTo(JAR.left + 12, JAR.neckY + 28);
    ctx.quadraticCurveTo(JAR.left + 10, 310, JAR.left + 32, JAR.floorY - 46);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(JAR.right - 12, JAR.neckY + 34);
    ctx.quadraticCurveTo(JAR.right - 10, 310, JAR.right - 34, JAR.floorY - 50);
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.24)';
    ctx.lineWidth = 5;
    ctx.stroke();

    // Brass Neck Collar Rim at top of jar
    const collarGrad = ctx.createLinearGradient(JAR.left - 8, JAR.neckY - 14, JAR.left - 8, JAR.neckY + 10);
    collarGrad.addColorStop(0, '#ffe495');
    collarGrad.addColorStop(0.5, '#d59c3b');
    collarGrad.addColorStop(1, '#8c5a18');
    ctx.fillStyle = collarGrad;
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(JAR.left - 10, JAR.neckY - 11, JAR.right - JAR.left + 20, 20, 10);
    ctx.fill();
    ctx.stroke();

    // Brass highlight line
    ctx.beginPath();
    ctx.moveTo(JAR.left + 6, JAR.neckY - 6);
    ctx.lineTo(JAR.right - 6, JAR.neckY - 6);
    ctx.strokeStyle = 'rgba(255, 250, 220, 0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 8. Floating Score Popups
    for (const pop of gameState.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${pop.fontSize}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#3c2118';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    ctx.restore();
  }

  function drawTierSprite(tier, x, y, r, angle, squishAmt = 0, squishAngle = 0, alpha = 1) {
    const def = TIERS[tier - 1];
    const shapeDef = getShapeDef(tier);
    const img = spriteImages[tier];
    if (!img) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // Directional soft-body squish strictly along real world impact normal
    if (Math.abs(squishAmt) > 0.002) {
      ctx.rotate(squishAngle);
      ctx.scale(1 - squishAmt, 1 + squishAmt * 0.82);
      ctx.rotate(angle - squishAngle);
    } else {
      ctx.rotate(angle);
    }

    if (shapeDef) {
      // Exact Center-of-Mass anchored registration matching extracted physics polygons 1:1
      const scale = r / shapeDef.r_eq_px;
      const dw = shapeDef.width * scale;
      const dh = shapeDef.height * scale;
      const ox = -shapeDef.com_x * scale;
      const oy = -shapeDef.com_y * scale;
      ctx.drawImage(img, ox, oy, dw, dh);
    } else {
      const scale = r / (def.meta.radius_norm_w * img.width);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, -def.meta.anchor_x_norm * dw, -def.meta.anchor_y_norm * dh, dw, dh);
    }
    ctx.restore();
  }

  function renderAmbientFireflies(dt, nowSec) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    ambientCtx.clearRect(0, 0, w, h);

    for (const f of fireflies) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.y < -0.05) {
        f.y = 1.05;
        f.x = Math.random();
      }
      if (f.x < -0.05) f.x = 1.05;
      if (f.x > 1.05) f.x = -0.05;

      const glow = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(nowSec * 2.2 + f.phase));
      const px = f.x * w;
      const py = f.y * h;
      const grad = ambientCtx.createRadialGradient(px, py, 0, px, py, f.r * 3.5);
      grad.addColorStop(0, `rgba(255, 232, 148, ${glow})`);
      grad.addColorStop(1, 'rgba(255, 232, 148, 0)');
      ambientCtx.fillStyle = grad;
      ambientCtx.beginPath();
      ambientCtx.arc(px, py, f.r * 3.5, 0, Math.PI * 2);
      ambientCtx.fill();
    }
  }

  // Main Animation Loop
  let lastFrameMs = performance.now();
  function mainLoop(nowMs) {
    const dt = Math.min(0.033, (nowMs - lastFrameMs) / 1000);
    lastFrameMs = nowMs;
    const nowSec = nowMs / 1000;

    renderAmbientFireflies(dt, nowSec);

    if (gameState.running && !gameState.over && !gameState.paused) {
      if (gameState.dropCooldown > 0) gameState.dropCooldown = Math.max(0, gameState.dropCooldown - dt);
      // Smooth pendulum sway decay on held dessert
      gameState.dropSway *= Math.exp(-dt * 9.5);
      if (Math.abs(gameState.dropSway) < 0.001) gameState.dropSway = 0;

      if (gameState.comboTimer > 0) {
        gameState.comboTimer = Math.max(0, gameState.comboTimer - dt);
        if (gameState.comboTimer === 0) gameState.comboCount = 0;
      }
      if (gameState.jarShakeAmp > 0) {
        gameState.jarShakeAmp = Math.max(0, gameState.jarShakeAmp - dt * 1.9);
      }
      if (gameState.skipCooldown > 0) {
        gameState.skipCooldown = Math.max(0, gameState.skipCooldown - dt);
        btnSkipOrder.disabled = gameState.skipCooldown > 0;
        btnSkipOrder.textContent =
          gameState.skipCooldown > 0 ? `冷却 ${Math.ceil(gameState.skipCooldown)}s` : '换一单';
      }

      if (gameState.feverTimer > 0) {
        gameState.feverTimer = Math.max(0, gameState.feverTimer - dt);
        if (gameState.feverTimer === 0) {
          gameState.feverEnergy = 0;
          showToast('🌙 星光狂热结束，继续积攒能量吧！');
        }
        updateHUD();
      }

      stepPhysics(dt);
    }

    // Smooth score counter animation
    if (gameState.displayScore < gameState.score) {
      const diff = gameState.score - gameState.displayScore;
      gameState.displayScore += Math.max(1, Math.ceil(diff * Math.min(1, dt * 14)));
      scoreEl.textContent = String(gameState.displayScore);
    } else {
      scoreEl.textContent = String(gameState.score);
    }

    // Update particles & popups even after game over for polish
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
      const p = gameState.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.crumb) {
        p.vx *= 0.94;
        p.vy += 380 * dt;
      } else {
        p.vy += 260 * dt;
      }
      if (p.life <= 0) gameState.particles.splice(i, 1);
    }
    for (let i = gameState.popups.length - 1; i >= 0; i--) {
      const pop = gameState.popups[i];
      pop.life -= dt;
      pop.y += pop.vy * dt;
      if (pop.life <= 0) gameState.popups.splice(i, 1);
    }

    renderGameCanvas(nowSec);
    requestAnimationFrame(mainLoop);
  }

  // Pointer / Touch / Wheel / Keyboard Controls
  function canvasCoordsFromEvent(ev) {
    const rect = canvas.getBoundingClientRect();
    const clientX = ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches && ev.touches[0] ? ev.touches[0].clientY : ev.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * JAR.canvasW,
      y: ((clientY - rect.top) / rect.height) * JAR.canvasH
    };
  }

  function findEntityAt(x, y) {
    for (let i = gameState.entities.length - 1; i >= 0; i--) {
      const e = gameState.entities[i];
      if (Physics.pointInBody(e, x, y, 5)) return e;
    }
    return null;
  }

  function handleToolCanvasClick(x, y) {
    const target = findEntityAt(x, y);
    if (!target) {
      showToast('请点击罐内的甜品哦～');
      return;
    }

    if (gameState.activeToolMode === 'fork') {
      if (target.tier > 4) {
        showToast('🫧 泡泡叉只能消除 1~4 阶小甜品哦！');
        return;
      }
      if (gameState.tools.fork <= 0) return;
      gameState.tools.fork--;
      audio.playTool('fork');
      spawnSparkleBurst(target.x, target.y, '#9be8ff', 18);
      spawnPopup(target.x, target.y, '🫧 消除!', '#b4f4ff', 15);
      gameState.entities = gameState.entities.filter((e) => e.id !== target.id);
      cancelToolMode();
      updateHUD();
      return;
    }

    if (gameState.activeToolMode === 'spoon') {
      if (target.tier >= 9) {
        showToast('👑 已经是最高阶星冠猫神舒芙蕾啦！');
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

      const pts = def.points * (gameState.feverTimer > 0 ? 2 : 1);
      addScore(pts);
      unlockTier(nextTier);
      audio.playTool('spoon');
      spawnSparkleBurst(target.x, target.y, '#ffe16e', 22);
      spawnPopup(target.x, target.y - target.r * 0.5, `✨ 升阶! +${pts}`, '#ffe470', 17);
      notifyTreatSynthesized(nextTier, target);

      cancelToolMode();
      updateHUD();
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

  let toolConsumedPointer = false;
  canvas.addEventListener('pointermove', (ev) => {
    if (!gameState.running || gameState.over) return;
    const pt = canvasCoordsFromEvent(ev);
    if (gameState.activeToolMode) {
      const hit = findEntityAt(pt.x, pt.y);
      gameState.hoveredEntityId = hit ? hit.id : null;
      return;
    }
    updateDropPointerX(pt.x);
  });

  canvas.addEventListener('pointerdown', (ev) => {
    if (!gameState.running || gameState.over) return;
    audio.ensureCtx();
    const pt = canvasCoordsFromEvent(ev);
    if (gameState.activeToolMode) {
      toolConsumedPointer = true;
      handleToolCanvasClick(pt.x, pt.y);
      return;
    }
    toolConsumedPointer = false;
    updateDropPointerX(pt.x);
  });

  canvas.addEventListener('pointerup', (ev) => {
    if (toolConsumedPointer) {
      toolConsumedPointer = false;
      return;
    }
    if (!gameState.running || gameState.over) return;
    if (gameState.activeToolMode) return;
    const pt = canvasCoordsFromEvent(ev);
    updateDropPointerX(pt.x);
    dropCurrentTreat();
  });

  canvas.addEventListener(
    'wheel',
    (ev) => {
      if (!gameState.running || gameState.over || gameState.activeToolMode) return;
      ev.preventDefault();
      adjustAimAngle(ev.deltaY > 0 ? 0.14 : -0.14);
    },
    { passive: false }
  );

  function toggleDebugPhysics(forceVal) {
    gameState.debugPhysics = typeof forceVal === 'boolean' ? forceVal : !gameState.debugPhysics;
    if (btnDebugPhys) {
      btnDebugPhys.classList.toggle('is-active', gameState.debugPhysics);
      btnDebugPhys.textContent = gameState.debugPhysics ? '📐 物理轮廓: 开' : '📐 物理轮廓';
    }
    if (typeof forceVal !== 'boolean') {
      showToast(
        gameState.debugPhysics
          ? '📐 已开启复合多边形碰撞轮廓、质心与接触法线视图'
          : '📐 已关闭物理轮廓视图'
      );
    }
  }

  // Keyboard support
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'p' || ev.key === 'P') {
      if (!titleModal.classList.contains('is-open')) {
        ev.preventDefault();
        toggleDebugPhysics();
      }
      return;
    }
    if (!gameState.running || gameState.over) return;
    if (compendiumModal.classList.contains('is-open')) {
      if (ev.key === 'Escape') closeCompendium();
      return;
    }

    if (ev.key === 'ArrowLeft' || ev.key === 'a' || ev.key === 'A') {
      ev.preventDefault();
      updateDropPointerX(gameState.dropX - 22);
    } else if (ev.key === 'ArrowRight' || ev.key === 'd' || ev.key === 'D') {
      ev.preventDefault();
      updateDropPointerX(gameState.dropX + 22);
    } else if (ev.key === 'q' || ev.key === 'Q') {
      ev.preventDefault();
      adjustAimAngle(-0.14);
    } else if (ev.key === 'e' || ev.key === 'E') {
      ev.preventDefault();
      adjustAimAngle(0.14);
    } else if (ev.key === ' ' || ev.key === 'ArrowDown' || ev.key === 'Enter') {
      ev.preventDefault();
      dropCurrentTreat();
    } else if (ev.key === 'h' || ev.key === 'H' || ev.key === 'Shift') {
      ev.preventDefault();
      swapHoldPocket();
    } else if (ev.key === '1') {
      armOrUseTool('shake');
    } else if (ev.key === '2') {
      armOrUseTool('fork');
    } else if (ev.key === '3') {
      armOrUseTool('spoon');
    } else if (ev.key === 'Escape') {
      cancelToolMode();
    }
  });

  // Compendium Modal
  function openCompendium() {
    compendiumGrid.innerHTML = '';
    compUnlockedEl.textContent = String(saveData.unlockedTiers.length);
    TIERS.forEach((t) => {
      const unlocked = saveData.unlockedTiers.includes(t.tier);
      const card = document.createElement('div');
      card.className = `comp-card${unlocked ? '' : ' is-locked'}`;
      card.innerHTML = `
        <div class="comp-tier">${t.tier} 阶 · ${t.points} 分</div>
        <img src="${t.src}" alt="${t.name}" />
        <div class="comp-name">${unlocked ? t.name : '??? 未解锁'}</div>
        <div class="comp-desc">${unlocked ? t.lore : '继续向上合成即可解锁图鉴故事！'}</div>
      `;
      compendiumGrid.appendChild(card);
    });
    compendiumModal.classList.add('is-open');
  }

  function closeCompendium() {
    compendiumModal.classList.remove('is-open');
  }

  // Start / Reset Run
  function startNewRun(mode = gameState.mode) {
    gameState.mode = mode;
    gameState.running = true;
    gameState.paused = false;
    gameState.over = false;
    gameState.score = 0;
    gameState.displayScore = 0;
    gameState.stardust = 30;
    gameState.feverEnergy = 0;
    gameState.feverTimer = 0;
    gameState.comboCount = 0;
    gameState.comboTimer = 0;
    gameState.maxCombo = 1;
    gameState.ordersCompleted = 0;
    gameState.maxTierRun = 4;
    gameState.seenThisRun = new Set([1, 2, 3, 4]);
    gameState.tools = { shake: 2, fork: 2, spoon: 1 };
    gameState.activeToolMode = null;
    gameState.dropX = 220;
    gameState.prevDropX = 220;
    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.lastDebugContacts = [];
    gameState.curTier = 1 + Math.floor(Math.random() * 2);
    gameState.nextTier = 1 + Math.floor(Math.random() * 3);
    gameState.holdTier = null;
    gameState.canHoldThisTurn = true;
    gameState.dropCooldown = 0;
    gameState.dangerDuration = 0;
    gameState.jarShakeAmp = 0;
    gameState.entities = [];
    gameState.particles = [];
    gameState.popups = [];
    gameState.skipCooldown = 0;
    btnSkipOrder.disabled = false;
    btnSkipOrder.textContent = '换一单';

    cancelToolMode();
    titleModal.classList.remove('is-open');
    gameoverModal.classList.remove('is-open');

    if (mode === 'chef') {
      generateOrder();
    } else {
      gameState.order = null;
      setPatronSpeech(PATRONS[0], '悠闲经典模式开启！放慢脚步享受真实轮廓物理合成的治愈时光吧～', 5.0);
      renderOrder();
    }

    updateEvolutionRing();
    updateHUD();
  }

  // UI Event Bindings
  modeSelectEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.mode-option');
    if (!btn) return;
    modeSelectEl.querySelectorAll('.mode-option').forEach((b) => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    gameState.mode = btn.dataset.mode;
  });

  btnStartGame.addEventListener('click', () => {
    audio.ensureCtx();
    startNewRun(gameState.mode);
  });

  btnPlayAgain.addEventListener('click', () => {
    audio.ensureCtx();
    startNewRun(gameState.mode);
  });

  btnRestart.addEventListener('click', () => {
    if (!gameState.running && titleModal.classList.contains('is-open')) return;
    audio.ensureCtx();
    startNewRun(gameState.mode);
    showToast('🔄 已重新开启新一轮营业！');
  });

  holdBubbleEl.addEventListener('click', swapHoldPocket);
  btnToolShake.addEventListener('click', () => armOrUseTool('shake'));
  btnToolFork.addEventListener('click', () => armOrUseTool('fork'));
  btnToolSpoon.addEventListener('click', () => armOrUseTool('spoon'));
  btnCancelTarget.addEventListener('click', cancelToolMode);

  btnSkipOrder.addEventListener('click', () => {
    if (gameState.skipCooldown > 0 || gameState.mode !== 'chef') return;
    gameState.skipCooldown = 25;
    showToast('📋 已为顾客更换新的星夜心愿单！');
    generateOrder();
  });

  if (btnDebugPhys) {
    btnDebugPhys.addEventListener('click', () => toggleDebugPhysics());
  }

  btnSfx.addEventListener('click', () => {
    audio.ensureCtx();
    const nextMuted = !audio.muted;
    audio.setMuted(nextMuted);
    btnSfx.textContent = nextMuted ? '🔇 音效: 关' : '🔊 音效: 开';
  });

  btnBgm.addEventListener('click', () => {
    audio.ensureCtx();
    const on = audio.toggleBGM();
    btnBgm.textContent = on ? '🎵 音乐: 开' : '🎵 音乐: 关';
    btnBgm.classList.toggle('is-active', on);
  });

  btnCompendium.addEventListener('click', openCompendium);
  btnCloseComp.addEventListener('click', closeCompendium);
  compendiumModal.addEventListener('click', (ev) => {
    if (ev.target === compendiumModal) closeCompendium();
  });

  // Inspection hook for automated E2E physics verification
  window.__HOSHI_DEBUG__ = {
    getState: () => ({
      running: gameState.running,
      over: gameState.over,
      score: gameState.score,
      debugPhysics: gameState.debugPhysics,
      aimAngle: gameState.aimAngle,
      contactCount: gameState.lastDebugContacts.length,
      entities: gameState.entities.map((e) => ({
        id: e.id,
        tier: e.tier,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        angle: +e.angle.toFixed(3),
        vx: +e.vx.toFixed(2),
        vy: +e.vy.toFixed(2),
        vr: +e.vr.toFixed(3),
        polyCount: e.worldPolys ? e.worldPolys.length : 0
      }))
    }),
    togglePhysicsDebug: (val) => toggleDebugPhysics(val),
    setCurTier: (tier) => {
      gameState.curTier = Math.max(1, Math.min(9, tier));
      clampDropX();
      updateHUD();
    },
    setAimAngle: (rad) => {
      gameState.aimAngle = Math.max(-0.78, Math.min(0.78, rad));
      clampDropX();
    },
    spawnTestBody: (tier, x, y, angle = 0) => createEntity(tier, x, y, 0, 20, false, angle, 0)
  };

  // Boot Sequence
  resizeCanvases();
  loadSprites().then(() => {
    buildEvolutionRing();
    updateHUD();
    requestAnimationFrame(mainLoop);
  });
})();
