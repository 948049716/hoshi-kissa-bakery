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
      material: { friction: 0.18, restitution: 0.24 },
      lore: '凝结了午夜星露的晶莹蓝莓糖，酸甜清冽，是所有甜点的起点。',
      src: 'assets/processed/tier_1.webp',
      actSrc: 'assets/processed/tier_1_act.webp',
      intSrc: 'assets/processed/tier_1_int.webp',
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
      material: { friction: 0.20, restitution: 0.22 },
      lore: '蓬松金黄的泡芙球里挤满白桃鲜奶油，脸颊总是红扑扑的。',
      src: 'assets/processed/tier_2.webp',
      actSrc: 'assets/processed/tier_2_act.webp',
      intSrc: 'assets/processed/tier_2_int.webp',
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
      material: { friction: 0.22, restitution: 0.20 },
      lore: '揉进宇治抹茶粉的软糯猫猫团子，在月光下会轻轻抖动小耳朵。',
      src: 'assets/processed/tier_3.webp',
      actSrc: 'assets/processed/tier_3_act.webp',
      intSrc: 'assets/processed/tier_3_int.webp',
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
      material: { friction: 0.25, restitution: 0.18 },
      lore: '香脆黄油塔皮盛满蜂蜜柠檬凝乳，咬一口就像咬住一束星光。',
      src: 'assets/processed/tier_4.webp',
      actSrc: 'assets/processed/tier_4_act.webp',
      intSrc: 'assets/processed/tier_4_int.webp',
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
      material: { friction: 0.24, restitution: 0.19 },
      lore: '冰凉Q弹的樱粉麻薯裹着雪白淡奶油，头顶一颗娇嫩甜草莓。',
      src: 'assets/processed/tier_5.webp',
      actSrc: 'assets/processed/tier_5_act.webp',
      intSrc: 'assets/processed/tier_5_int.webp',
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
      material: { friction: 0.22, restitution: 0.19 },
      lore: '淋满海盐琥珀焦糖与可可流心的松软甜甜圈，点缀星星糖片。',
      src: 'assets/processed/tier_6.webp',
      actSrc: 'assets/processed/tier_6_act.webp',
      intSrc: 'assets/processed/tier_6_int.webp',
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
      material: { friction: 0.21, restitution: 0.18 },
      lore: '薰衣草紫杏仁饼壳夹着梦幻奶霜夹心，安静地做着甜美的梦。',
      src: 'assets/processed/tier_7.webp',
      actSrc: 'assets/processed/tier_7_act.webp',
      intSrc: 'assets/processed/tier_7_int.webp',
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
      material: { friction: 0.27, restitution: 0.16 },
      lore: '层层交织的糖炒栗蓉与香草奶霜，点缀金箔，醇厚而温柔。',
      src: 'assets/processed/tier_8.webp',
      actSrc: 'assets/processed/tier_8_act.webp',
      intSrc: 'assets/processed/tier_8_int.webp',
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
      material: { friction: 0.26, restitution: 0.16 },
      lore: '星夜吃茶的传说级至高甜点！戴着宝石皇冠与天使奶油翼的猫神舒芙蕾。',
      src: 'assets/processed/tier_9.webp',
      actSrc: 'assets/processed/tier_9_act.webp',
      intSrc: 'assets/processed/tier_9_int.webp',
      meta: { anchor_x_norm: 0.4903, anchor_y_norm: 0.6025, radius_norm_w: 0.3841 }
    }
  ];

  const WILDCARD_RADIUS = 20;
  const RAINBOW_SVG_URI =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="rb" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#fffdf4"/>
            <stop offset="28%" stop-color="#ffd6e8"/>
            <stop offset="56%" stop-color="#ffe787"/>
            <stop offset="80%" stop-color="#9be8d8"/>
            <stop offset="100%" stop-color="#b5a6ff"/>
          </radialGradient>
        </defs>
        <polygon points="50,7 60,30 85,22 73,45 94,58 69,66 72,91 50,77 28,91 31,66 6,58 27,45 15,22 40,30" fill="url(#rb)" stroke="#4A2C2A" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="50" cy="52" r="24" fill="rgba(255,255,255,0.42)"/>
        <ellipse cx="36" cy="57" rx="5.5" ry="3.2" fill="#ff7aa8"/>
        <ellipse cx="64" cy="57" rx="5.5" ry="3.2" fill="#ff7aa8"/>
        <polygon points="40,44 42,48 46,48.5 43,51 44,55 40,53 36,55 37,51 34,48.5 38,48" fill="#4A2C2A"/>
        <polygon points="60,44 62,48 66,48.5 63,51 64,55 60,53 56,55 57,51 54,48.5 58,48" fill="#4A2C2A"/>
        <path d="M44 58 Q50 64 56 58" fill="none" stroke="#4A2C2A" stroke-width="3.2" stroke-linecap="round"/>
      </svg>`
    );

  // Roguelike 3-Choice Chef Blessings Catalog
  const BLESSINGS = [
    {
      id: 'magnet',
      icon: '🧲',
      name: '甜蜜星磁',
      tag: '连锁流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `同阶甜品磁吸范围 +${lv * 12}px，引力大幅增强，隔缝也能相吸自动连合！`
    },
    {
      id: 'critJump',
      icon: '⚡',
      name: '奇迹跳阶',
      tag: '暴击流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `每次合成有 ${lv * 14}% 概率触发奇迹暴击，直接跳升 +2 阶并爆出双倍得分！`
    },
    {
      id: 'rainbow',
      icon: '🌈',
      name: '彩虹眷顾',
      tag: '万能流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `彩虹万能糖保底步数降至 ${Math.max(5, 12 - lv * 2)} 步，并立刻送 1 颗彩虹糖入队列！`
    },
    {
      id: 'shockwave',
      icon: '💥',
      name: '星爆冲击波',
      tag: '物理流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `合成释放更强星光气浪（强度 +${lv * 40}%），弹动周边甜点滚出多米诺大连锁！`
    },
    {
      id: 'fever',
      icon: '🔥',
      name: '狂热超载',
      tag: '狂热流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `星光狂热延长 +${(lv * 3.5).toFixed(1)} 秒、充能提速 +${lv * 28}%，并立刻充能 +45%！`
    },
    {
      id: 'golden',
      icon: '✨',
      name: '镀金秘方',
      tag: '财富流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `黄金甜点概率提升至 ${9 + lv * 10}%，黄金合成额外爆出 +${lv * 10}⭐ 并易延续金光！`
    },
    {
      id: 'combo',
      icon: '🎶',
      name: '连击大师',
      tag: '高分流',
      maxLv: 3,
      repeatable: false,
      desc: (lv) => `连击窗口延长 +${(lv * 0.6).toFixed(1)} 秒，每段连击额外叠加 +${lv * 22}% 积分倍率！`
    },
    {
      id: 'toolbox',
      icon: '🎁',
      name: '魔法补给箱',
      tag: '即时补给',
      maxLv: 99,
      repeatable: true,
      desc: () => '立刻补充 摇一摇+1 · 泡泡叉+1 · 升阶勺+1，并赠送 +25 ⭐ 星尘币！'
    },
    {
      id: 'cleanse',
      icon: '🫧',
      name: '轻盈星风',
      tag: '即时救场',
      maxLv: 99,
      repeatable: true,
      desc: () => '立刻吹散罐内最多 4 颗 1~2 阶小甜点并转化为双倍星尘与积分，瞬间腾出空间！'
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
  const cafeStageEl = document.getElementById('cafe-stage');
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
  const rainbowPillEl = document.getElementById('rainbow-pill');
  const activePerksBarEl = document.getElementById('active-perks-bar');
  const modeTagEl = document.getElementById('mode-tag');

  const patronAvatarEl = document.getElementById('patron-avatar');
  const patronNameEl = document.getElementById('patron-name');
  const patronSpeechEl = document.getElementById('patron-speech');
  const orderBoxEl = document.getElementById('order-box');
  const orderSlotsEl = document.getElementById('order-slots');
  const orderRushLineEl = document.getElementById('order-rush-line');
  const orderRewardLineEl = document.getElementById('order-reward-line');
  const btnSkipOrder = document.getElementById('btn-skip-order');

  const nextBubbleEl = document.getElementById('next-bubble');
  const nextImgEl = document.getElementById('next-img');
  const nextNameEl = document.getElementById('next-name');
  const holdBubbleEl = document.getElementById('hold-bubble');
  const holdImgEl = document.getElementById('hold-img');
  const holdEmptyEl = document.getElementById('hold-empty');
  const holdNameEl = document.getElementById('hold-name');
  const discoveredCountEl = document.getElementById('discovered-count');
  const evoRingEl = document.getElementById('evo-ring');

  // Mobile Compact HUD Elements
  const mScoreEl = document.getElementById('m-score-value');
  const mBestEl = document.getElementById('m-best-value');
  const mStardustEl = document.getElementById('m-stardust-value');
  const mFeverBox = document.getElementById('m-fever-box');
  const mFeverLabel = document.getElementById('m-fever-label');
  const mFeverPctEl = document.getElementById('m-fever-pct');
  const mFeverFillEl = document.getElementById('m-fever-fill');
  const mRainbowPillEl = document.getElementById('m-rainbow-pill');
  const mNextImgEl = document.getElementById('m-next-img');
  const mHoldBubbleEl = document.getElementById('m-hold-bubble');
  const mHoldImgEl = document.getElementById('m-hold-img');
  const mHoldEmptyEl = document.getElementById('m-hold-empty');
  const mOrderBarEl = document.getElementById('m-order-bar');
  const mOrderSlotsEl = document.getElementById('m-order-slots');
  const mOrderRushEl = document.getElementById('m-order-rush');
  const mOrderRewardEl = document.getElementById('m-order-reward');
  const mBtnSkipOrder = document.getElementById('m-btn-skip-order');
  const mPerksFloatEl = document.getElementById('m-perks-float');

  const targetBannerEl = document.getElementById('target-banner');
  const targetBannerTextEl = document.getElementById('target-banner-text');
  const btnCancelTarget = document.getElementById('btn-cancel-target');
  const blessingReadyBtn = document.getElementById('blessing-ready-btn');

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

  const blessingModal = document.getElementById('blessing-modal');
  const blessingHeadingEl = document.getElementById('blessing-heading');
  const blessingGrid = document.getElementById('blessing-grid');
  const blessingSubEl = document.getElementById('blessing-sub');
  const btnDeferBlessing = document.getElementById('btn-defer-blessing');

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
          unlockedTiers: Array.isArray(parsed.unlockedTiers) ? parsed.unlockedTiers : [1, 2, 3, 4],
          bgmTrack: parsed.bgmTrack === 'waltz' || parsed.bgmTrack === 'bossa' || parsed.bgmTrack === 'off'
            ? parsed.bgmTrack
            : 'waltz',
          sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : true
        };
      }
    } catch (_) {}
    return { bestChef: 0, bestZen: 0, unlockedTiers: [1, 2, 3, 4], bgmTrack: 'waltz', sfxEnabled: true };
  }

  function persistSaveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (_) {}
  }

  // Apply persisted audio preferences (BGM starts enabled by default on first user gesture)
  audio.bgmTrack = saveData.bgmTrack;
  audio.bgmEnabled = saveData.bgmTrack !== 'off';
  audio.setSfxEnabled(saveData.sfxEnabled);

  function syncAudioButtons() {
    const info = audio.getTrackInfo();
    btnBgm.textContent = info.label;
    btnBgm.classList.toggle('is-active', audio.bgmEnabled);
    btnBgm.title = `背景音乐：${info.title} · 点击切换曲目或关闭 (圆舞曲 → 吃茶爵士 → 关，快捷键 M)`;
    btnSfx.textContent = audio.sfxEnabled ? '🔊 音效: 开' : '🔇 音效: 关';
  }

  function syncAudioMood() {
    const overlayOpen =
      titleModal.classList.contains('is-open') ||
      blessingModal.classList.contains('is-open') ||
      compendiumModal.classList.contains('is-open') ||
      gameoverModal.classList.contains('is-open');
    audio.setMuffled(overlayOpen);
  }

  // Preload all base, solo-action, and neighbor-interaction sprite images cleanly
  const spriteImages = {};
  const spriteActionImages = {};
  const spriteInteractImages = {};
  let assetsReady = false;
  function loadSprites() {
    const loadOne = (url, targetMap, tier) =>
      new Promise((resolve) => {
        if (!url) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          targetMap[tier] = img;
          resolve();
        };
        img.onerror = resolve;
        img.src = url;
      });

    const promises = [];
    for (const t of TIERS) {
      promises.push(loadOne(t.src, spriteImages, t.tier));
      promises.push(loadOne(t.actSrc, spriteActionImages, t.tier));
      promises.push(loadOne(t.intSrc, spriteInteractImages, t.tier));
    }
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
    feverMaxDuration: 10.0,
    feverBonusUsed: 0,
    comboCount: 0,
    comboTimer: 0,
    comboRainbowGranted: false,
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
    dropSway: 0, // visual-only pendulum liveliness while moving horizontally
    touchAim: { active: false, cancelled: false, lastStableX: 220 },
    debugPhysics: false, // toggleable wireframe/contact inspector
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
    heldActionCooldown: 1.6,
    heldActionAnim: null,
    previewActionCooldown: 2.6,
    previewActionTimer: 0,
    previewActionTarget: null,
    perks: {},
    pendingBlessings: 0,
    blessingChoices: [],
    blessingLastReason: '',
    blessingLockUntil: 0,
    zenNextMilestone: 500,
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

  // Perk & Special Drop Helpers
  function getPerkLevel(id) {
    return gameState.perks[id] || 0;
  }

  function getRainbowPityBase() {
    return Math.max(5, 12 - getPerkLevel('rainbow') * 2);
  }

  function getFeverMultiplier() {
    if (gameState.feverTimer <= 0) return 1;
    return Math.min(5, 2 + Math.max(0, gameState.comboCount - 1) * 0.75);
  }

  // Weighted drop tier selection (Tiers 1..4)
  function pickDropTier() {
    const r = Math.random();
    if (r < 0.36) return 1;
    if (r < 0.68) return 2;
    if (r < 0.90) return 3;
    return 4;
  }

  function pickDropBundle(forceRainbow = false) {
    if (forceRainbow) {
      return { tier: 2, meta: { wildcard: true, golden: false } };
    }
    const tier = pickDropTier();
    const goldenLv = getPerkLevel('golden');
    const goldenChance = 0.09 + goldenLv * 0.1 + (gameState.feverTimer > 0 && goldenLv > 0 ? 0.12 : 0);
    return {
      tier,
      meta: { wildcard: false, golden: Math.random() < goldenChance }
    };
  }

  function grantNextRainbow(reason = '') {
    if (!gameState.nextMeta || !gameState.nextMeta.wildcard) {
      gameState.nextTier = 2;
      gameState.nextMeta = { wildcard: true, golden: false };
      gameState.dropsUntilRainbow = getRainbowPityBase();
      if (reason) {
        showToast(`🌈 ${reason}！下一颗变身【彩虹万能糖】！`);
      }
      updateHUD();
    }
  }

  // Roguelike 3-Choice Chef Blessing System
  function renderActivePerks() {
    const entries = BLESSINGS.filter((b) => !b.repeatable && getPerkLevel(b.id) > 0);
    const html = entries
      .map(
        (b) =>
          `<span class="perk-chip" title="${b.name} Lv.${getPerkLevel(b.id)}：${b.desc(getPerkLevel(b.id))}">${b.icon}Lv${getPerkLevel(b.id)}</span>`
      )
      .join('');
    if (activePerksBarEl) activePerksBarEl.innerHTML = html;
    if (mPerksFloatEl) mPerksFloatEl.innerHTML = html;
  }

  function rollBlessingChoices() {
    const eligible = BLESSINGS.filter((b) => b.repeatable || getPerkLevel(b.id) < b.maxLv);
    const pool = [...eligible];
    const picked = [];
    while (picked.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function pulseBlessingReadyBtn() {
    if (!blessingReadyBtn) return;
    blessingReadyBtn.classList.remove('is-fresh');
    void blessingReadyBtn.offsetWidth;
    blessingReadyBtn.classList.add('is-fresh');
  }

  function updateBlessingHeader(pickedSummary = '') {
    const rem = gameState.pendingBlessings;
    if (blessingHeadingEl) {
      blessingHeadingEl.innerHTML =
        rem > 1
          ? `🎁 星夜主厨祝福 <span class="blessing-rem-pill">剩余 ${rem} 次</span>`
          : '🎁 星夜主厨祝福 · 三选一';
    }
    if (blessingSubEl) {
      if (pickedSummary) {
        blessingSubEl.textContent = `✅ 已获得【${pickedSummary}】！继续任选 1 张星夜秘方（还剩 ${rem} 次）`;
      } else {
        const reason = gameState.blessingLastReason || '心愿达成';
        blessingSubEl.textContent =
          rem > 1
            ? `${reason}！当前已积攒 ${rem} 次祝福，可一口气连续挑选！`
            : `${reason}！任选 1 张星夜秘方，永久强化本局烘焙！`;
      }
    }
  }

  function renderBlessingCards(animateDeal = false) {
    blessingGrid.innerHTML = '';
    gameState.blessingChoices.forEach((b, idx) => {
      const curLv = getPerkLevel(b.id);
      const nextLv = b.repeatable ? 1 : curLv + 1;
      const lvLabel = b.repeatable
        ? '即时生效'
        : curLv === 0
        ? '✨ 新秘方 · Lv.1'
        : `⬆️ Lv.${curLv} → Lv.${nextLv}`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = animateDeal ? 'blessing-card is-dealing' : 'blessing-card';
      if (animateDeal) {
        btn.style.animationDelay = `${idx * 45}ms`;
      }
      btn.dataset.blessingId = b.id;
      btn.innerHTML = `
        <div class="blessing-icon-circle">${b.icon}</div>
        <div class="blessing-card-top">
          <span class="blessing-tag">${b.tag}</span>
          <div class="blessing-title">${b.name}</div>
          <span class="blessing-lv">${lvLabel}</span>
        </div>
        <div class="blessing-desc">${b.desc(nextLv)}</div>
        <div class="blessing-cta-hint">点击选择 [${idx + 1}]</div>
      `;
      btn.addEventListener('click', () => applyBlessing(b.id));
      blessingGrid.appendChild(btn);
    });
  }

  function queueBlessing(reason = '订单完成') {
    gameState.pendingBlessings++;
    gameState.blessingLastReason = reason;
    updateHUD();

    if (blessingModal.classList.contains('is-open')) {
      updateBlessingHeader('');
      return;
    }

    audio.playBlessingReady();
    spawnSparkleBurst(JAR.canvasW / 2, JAR.floorY + 12, '#ffe27a', 16);
    pulseBlessingReadyBtn();
  }

  function openBlessingModal() {
    if (!gameState.running || gameState.over || gameState.pendingBlessings <= 0) return;
    if (titleModal.classList.contains('is-open') || gameoverModal.classList.contains('is-open')) return;
    if (compendiumModal.classList.contains('is-open')) closeCompendium();
    if (gameState.activeToolMode) cancelToolMode();

    if (!gameState.blessingChoices || gameState.blessingChoices.length === 0) {
      gameState.blessingChoices = rollBlessingChoices();
    }

    updateBlessingHeader('');
    renderBlessingCards(true);

    gameState.paused = true;
    gameState.blessingLockUntil = performance.now() + 140;
    blessingModal.classList.add('is-open');
    syncAudioMood();
    audio.playBlessingOpen();
    updateHUD();
  }

  function closeBlessingModal() {
    if (!blessingModal.classList.contains('is-open')) return;
    blessingModal.classList.remove('is-open');
    gameState.paused = false;
    syncAudioMood();
    updateHUD();
  }

  function applyBlessing(id) {
    if (performance.now() < gameState.blessingLockUntil) return;
    const def = BLESSINGS.find((b) => b.id === id);
    if (!def) return;

    audio.playBlessingPick();
    if (!def.repeatable) {
      gameState.perks[id] = Math.min(def.maxLv, getPerkLevel(id) + 1);
    }

    // Trigger immediate delight effects for specific perks
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
      gameState.stardust += 25;
      spawnPopup(JAR.canvasW / 2, 220, '🎁 全道具+1 · +25⭐!', '#ffe57e', 19);
    } else if (id === 'cleanse') {
      const smalls = gameState.entities
        .filter((e) => !e.isWildcard && e.tier <= 2)
        .sort((a, b) => a.y - b.y)
        .slice(0, 4);
      const removeIds = new Set(smalls.map((e) => e.id));
      let gainedPts = 0;
      let gainedDust = 0;
      for (const s of smalls) {
        gainedPts += 40;
        gainedDust += 6;
        spawnSparkleBurst(s.x, s.y, '#9be8ff', 14);
        spawnShockwave(s.x, s.y, 44, '#9be8ff', 2.8);
      }
      if (removeIds.size > 0) {
        gameState.entities = gameState.entities.filter((e) => !removeIds.has(e.id));
        addScore(gainedPts);
        gameState.stardust += gainedDust;
        spawnPopup(JAR.canvasW / 2, 210, `🫧 吹散${removeIds.size}颗! +${gainedPts}分`, '#b6f4ff', 18);
      } else {
        gameState.stardust += 20;
        spawnPopup(JAR.canvasW / 2, 210, '🫧 罐内很清爽！赠送 +20⭐', '#b6f4ff', 17);
      }
    }

    const lvTag = def.repeatable ? '' : ` Lv.${getPerkLevel(id)}`;
    const pickedSummary = `${def.icon} ${def.name}${lvTag}`;
    gameState.pendingBlessings = Math.max(0, gameState.pendingBlessings - 1);
    gameState.blessingChoices = [];

    // Seamless continuous draw inside the same open modal when multiple blessings are queued!
    if (gameState.pendingBlessings > 0 && blessingModal.classList.contains('is-open')) {
      gameState.blessingLockUntil = performance.now() + 180;
      gameState.blessingChoices = rollBlessingChoices();
      updateBlessingHeader(pickedSummary);
      renderBlessingCards(true);
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffe27a', 18);
      updateHUD();
      return;
    }

    blessingModal.classList.remove('is-open');
    gameState.paused = false;
    syncAudioMood();
    showToast(`🎁 获得祝福【${pickedSummary}】！`);
    spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffe27a', 26);
    spawnShockwave(JAR.canvasW / 2, 250, 150, '#ffe47a', 3.5);
    gameState.jarFlash = 0.55;
    updateHUD();
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
    if (score >= 25000) return '👑 传奇猫神糕点宗师';
    if (score >= 12000) return '🌙 星夜首席主厨';
    if (score >= 5500) return '⭐ 银星甜点师';
    if (score >= 2000) return '🧁 温柔烘焙师';
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

  // Order Generation (Chef Mode) with Rush Drop Bonus
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

    setPatronSpeech(patron, patron.greet, 4.5);
    checkExistingBoardForOrder();
    renderOrder();
  }

  function checkExistingBoardForOrder() {
    if (!gameState.order || gameState.order.completed || gameState.mode !== 'chef') return;
    // Match unfulfilled order slots against treats currently in the jar (without double-counting one treat)
    const usedIds = new Set();
    for (const slot of gameState.order.slots) {
      if (slot.done) continue;
      const match = gameState.entities.find(
        (e) => !e.isWildcard && e.tier === slot.tier && !usedIds.has(e.id) && !e.creditedToOrder
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
      spawnSparkleBurst(
        entity ? entity.x : JAR.canvasW / 2,
        entity ? entity.y : 250,
        '#ffd85d',
        14
      );
      renderOrder();
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
      const feverMult = getFeverMultiplier();
      const rushMult = isRush ? 1.6 : 1;
      const pts = Math.round(ord.rewardScore * feverMult * rushMult);
      const dust = Math.round(ord.rewardDust * rushMult);

      addScore(pts);
      gameState.stardust += dust;
      addFeverEnergy(isRush ? 36 : 28);
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

      if (isRush) {
        grantNextRainbow();
      }

      setPatronSpeech(
        ord.patron,
        isRush ? `${ord.patron.thanks} 极速出餐附赠彩虹万能糖哦！` : ord.patron.thanks,
        3.8
      );
      showToast(
        isRush
          ? `⚡ 极速订单达成！+${pts} 分 · +${dust} ⭐ · 送🌈彩虹糖${toolMsg}`
          : `🎉 订单完成！+${pts} 分 · +${dust} ⭐${toolMsg}`
      );
      spawnPopup(
        JAR.canvasW / 2,
        168,
        isRush ? `⚡ 极速订单! +${pts}` : `订单完成! +${pts}`,
        '#ffe57e',
        20
      );
      spawnSparkleBurst(JAR.canvasW / 2, 180, '#ffd45e', 28);
      spawnShockwave(JAR.canvasW / 2, 190, 140, '#ffe378', 3.4);

      // Queue Roguelike 3-Choice Chef Blessing!
      queueBlessing(isRush ? '⚡ 极速订单达成' : '🎉 心愿订单达成');

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
      if (mOrderBarEl) mOrderBarEl.style.display = 'none';
      return;
    }
    orderBoxEl.style.display = 'block';
    if (mOrderBarEl) mOrderBarEl.style.display = 'flex';
    if (!gameState.order) return;

    orderSlotsEl.innerHTML = '';
    if (mOrderSlotsEl) mOrderSlotsEl.innerHTML = '';
    gameState.order.slots.forEach((slot) => {
      const t = TIERS[slot.tier - 1];
      const div = document.createElement('div');
      div.className = `order-slot${slot.done ? ' is-done' : ''}`;
      div.innerHTML = `
        <img src="${t.src}" alt="${t.name}" />
        <div class="order-slot-name">${t.name}</div>
      `;
      orderSlotsEl.appendChild(div);

      if (mOrderSlotsEl) {
        const mDiv = document.createElement('div');
        mDiv.className = `m-order-slot${slot.done ? ' is-done' : ''}`;
        mDiv.innerHTML = `<img src="${t.src}" alt="${t.name}" />`;
        mOrderSlotsEl.appendChild(mDiv);
      }
    });

    const rushLeft = gameState.order.rushDropsLeft;
    if (orderRushLineEl) {
      if (rushLeft > 0) {
        orderRushLineEl.classList.remove('is-expired');
        orderRushLineEl.textContent = `⚡ 极速: 剩 ${rushLeft} 步 (×1.6 + 🌈)`;
      } else {
        orderRushLineEl.classList.add('is-expired');
        orderRushLineEl.textContent = '🌙 悠闲出餐（完成领三选一祝福）';
      }
    }
    if (mOrderRushEl) {
      mOrderRushEl.classList.toggle('is-expired', rushLeft <= 0);
      mOrderRushEl.textContent = `⚡${rushLeft}步`;
    }

    orderRewardLineEl.textContent = `奖励 +${gameState.order.rewardScore}分 · +${gameState.order.rewardDust}⭐ · 🎁祝福`;
    if (mOrderRewardEl) {
      mOrderRewardEl.textContent = `+${gameState.order.rewardScore}·+${gameState.order.rewardDust}⭐`;
    }
  }

  // Score, Fever & HUD Sync
  function addScore(pts) {
    gameState.score += pts;
    if (gameState.score > getBestScore()) {
      setBestScore(gameState.score);
    }
    // Zen mode awards Roguelike 3-Choice Blessings at escalating score milestones
    if (gameState.mode === 'zen' && gameState.running && !gameState.over) {
      while (gameState.score >= gameState.zenNextMilestone) {
        const hit = gameState.zenNextMilestone;
        gameState.zenNextMilestone =
          hit < 1400 ? 1400 : hit < 2800 ? 2800 : hit < 4800 ? 4800 : hit + 3000;
        queueBlessing(`🍵 达成 ${hit} 分里程碑`);
      }
    }
  }

  function addFeverEnergy(amount) {
    if (gameState.feverTimer > 0) return;
    const feverLv = getPerkLevel('fever');
    const boosted = amount * (1 + feverLv * 0.28);
    gameState.feverEnergy = Math.min(100, gameState.feverEnergy + boosted);
    if (gameState.feverEnergy >= 100) {
      const dur = 10.0 + feverLv * 3.5;
      gameState.feverMaxDuration = dur;
      gameState.feverTimer = dur;
      gameState.feverBonusUsed = 0;
      gameState.feverEnergy = 100;
      gameState.jarFlash = 0.75;
      gameState.screenShake = Math.max(gameState.screenShake, 5);
      audio.playFeverStart();
      audio.setFeverMode(true);
      if (cafeStageEl) cafeStageEl.classList.add('is-fever');
      showToast(`🔥 星光磁吸狂热启动！${dur.toFixed(0)}秒强力磁吸 · 连击最高 5× 积分！`);
      setPatronSpeech(PATRONS[0], '哇啊——星光磁吸狂热开启啦！同阶甜点自动吸合、连击最高5倍冲呀！！', 4.8);
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffdf6b', 36);
      spawnShockwave(JAR.canvasW / 2, 260, 190, '#ffd85d', 4.5);
      showComboBanner('🔥 星光磁吸狂热!', '极速投放 · 最高 5× 积分', '#ffe36e');
    }
  }

  function updateHUD() {
    const bestStr = String(getBestScore());
    const dustStr = String(gameState.stardust);
    bestEl.textContent = bestStr;
    stardustEl.textContent = dustStr;
    if (mBestEl) mBestEl.textContent = bestStr;
    if (mStardustEl) mStardustEl.textContent = dustStr;

    const isFever = gameState.feverTimer > 0;
    feverBox.classList.toggle('is-fever', isFever);
    if (mFeverBox) mFeverBox.classList.toggle('is-fever', isFever);
    if (cafeStageEl) cafeStageEl.classList.toggle('is-fever', isFever);
    if (isFever) {
      const pct = Math.max(0, Math.min(100, (gameState.feverTimer / Math.max(1, gameState.feverMaxDuration)) * 100));
      const pctWidth = `${pct.toFixed(1)}%`;
      const pctText = `${gameState.feverTimer.toFixed(1)}s`;
      const multVal = getFeverMultiplier();
      const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
      feverFillEl.style.width = pctWidth;
      feverLabel.textContent = `🔥 磁吸狂热 ${multStr}`;
      feverPctEl.textContent = pctText;
      if (mFeverFillEl) mFeverFillEl.style.width = pctWidth;
      if (mFeverLabel) mFeverLabel.textContent = `🔥 狂热 ${multStr}`;
      if (mFeverPctEl) mFeverPctEl.textContent = pctText;
    } else {
      const pctWidth = `${Math.round(gameState.feverEnergy)}%`;
      feverFillEl.style.width = pctWidth;
      feverLabel.textContent = '✨ 星光能量槽';
      feverPctEl.textContent = pctWidth;
      if (mFeverFillEl) mFeverFillEl.style.width = pctWidth;
      if (mFeverLabel) mFeverLabel.textContent = '✨ 星光能量';
      if (mFeverPctEl) mFeverPctEl.textContent = pctWidth;
    }

    // Rainbow Pity Pill
    const rainbowReady = !!(gameState.curMeta.wildcard || gameState.nextMeta.wildcard);
    if (rainbowPillEl) {
      rainbowPillEl.classList.toggle('is-ready', rainbowReady);
      rainbowPillEl.textContent = gameState.curMeta.wildcard
        ? '🌈 彩虹糖在手!'
        : gameState.nextMeta.wildcard
        ? '🌈 下颗必出彩虹!'
        : `🌈 彩虹糖: ${gameState.dropsUntilRainbow}步`;
    }
    if (mRainbowPillEl) {
      mRainbowPillEl.classList.toggle('is-ready', rainbowReady);
      mRainbowPillEl.textContent = rainbowReady ? '🌈就绪!' : `🌈${gameState.dropsUntilRainbow}步`;
    }

    // Next & Hold Previews (supporting Rainbow Wildcard & Golden Glaze)
    const nextIsWild = !!(gameState.nextMeta && gameState.nextMeta.wildcard);
    const nextIsGold = !!(gameState.nextMeta && gameState.nextMeta.golden);
    const nextDef = TIERS[gameState.nextTier - 1];
    nextImgEl.src = nextIsWild ? RAINBOW_SVG_URI : nextDef.src;
    nextNameEl.textContent = nextIsWild
      ? '🌈 彩虹万能糖'
      : nextIsGold
      ? `✨ 黄金·${nextDef.name}`
      : nextDef.name;
    if (mNextImgEl) mNextImgEl.src = nextIsWild ? RAINBOW_SVG_URI : nextDef.src;
    if (nextBubbleEl) {
      nextBubbleEl.classList.toggle('is-rainbow', nextIsWild);
      nextBubbleEl.classList.toggle('is-golden', !nextIsWild && nextIsGold);
    }
    const mNextBox = mNextImgEl ? mNextImgEl.parentElement : null;
    if (mNextBox) {
      mNextBox.classList.toggle('is-rainbow', nextIsWild);
      mNextBox.classList.toggle('is-golden', !nextIsWild && nextIsGold);
    }

    if (gameState.holdTier) {
      const holdIsWild = !!(gameState.holdMeta && gameState.holdMeta.wildcard);
      const holdIsGold = !!(gameState.holdMeta && gameState.holdMeta.golden);
      const holdDef = TIERS[gameState.holdTier - 1];
      const holdSrc = holdIsWild ? RAINBOW_SVG_URI : holdDef.src;
      holdImgEl.src = holdSrc;
      holdImgEl.style.display = 'block';
      holdEmptyEl.style.display = 'none';
      holdNameEl.textContent = holdIsWild
        ? '🌈 彩虹万能糖'
        : holdIsGold
        ? `✨ 黄金·${holdDef.name}`
        : holdDef.name;
      if (mHoldImgEl) {
        mHoldImgEl.src = holdSrc;
        mHoldImgEl.style.display = 'block';
      }
      if (mHoldEmptyEl) mHoldEmptyEl.style.display = 'none';
      if (holdBubbleEl) {
        holdBubbleEl.classList.toggle('is-rainbow', holdIsWild);
        holdBubbleEl.classList.toggle('is-golden', !holdIsWild && holdIsGold);
      }
      if (mHoldBubbleEl) {
        mHoldBubbleEl.classList.toggle('is-rainbow', holdIsWild);
        mHoldBubbleEl.classList.toggle('is-golden', !holdIsWild && holdIsGold);
      }
    } else {
      holdImgEl.style.display = 'none';
      holdEmptyEl.style.display = 'block';
      holdNameEl.textContent = '快捷键 [H]';
      if (mHoldImgEl) mHoldImgEl.style.display = 'none';
      if (mHoldEmptyEl) mHoldEmptyEl.style.display = 'block';
      if (holdBubbleEl) holdBubbleEl.classList.remove('is-rainbow', 'is-golden');
      if (mHoldBubbleEl) mHoldBubbleEl.classList.remove('is-rainbow', 'is-golden');
    }

    // Pending Blessing Floating Button (manual claim anytime, zero interruption)
    if (blessingReadyBtn) {
      const count = gameState.pendingBlessings;
      const showBtn =
        count > 0 &&
        !blessingModal.classList.contains('is-open') &&
        !gameState.activeToolMode &&
        gameState.running &&
        !gameState.over;
      blessingReadyBtn.classList.toggle('visible', showBtn);
      const countStr = String(count);
      if (blessingReadyBtn.dataset.count !== countStr) {
        blessingReadyBtn.dataset.count = countStr;
        blessingReadyBtn.innerHTML = `🎁 领取星夜祝福 <span class="blessing-count-badge">×${count}</span>`;
      }
    }

    renderActivePerks();

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
    if (blessingModal.classList.contains('is-open')) {
      closeBlessingModal(true);
    }
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
        e.vy -= 175 + Math.random() * 145;
        e.vx += (Math.random() - 0.5) * 280;
        e.vr += (Math.random() - 0.5) * 8;
      }
      spawnSparkleBurst(JAR.canvasW / 2, 320, '#ffd85d', 24);
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

  // Hold / Pocket Swap (swaps both tier & wildcard/golden meta!)
  function swapHoldPocket() {
    if (!gameState.running || gameState.over || gameState.activeToolMode) return;
    if (blessingModal.classList.contains('is-open')) {
      closeBlessingModal(true);
    }
    if (!gameState.canHoldThisTurn) {
      showToast('放下一颗甜品后才能再次交换暂存哦～');
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
    updateHUD();
  }

  function getAimTotalAngle() {
    // Strictly manual tilt angle for 100% deterministic drop-line accuracy
    return Math.max(-0.78, Math.min(0.78, gameState.aimAngle));
  }

  function getCurrentDropRadius() {
    return gameState.curMeta && gameState.curMeta.wildcard
      ? WILDCARD_RADIUS
      : TIERS[gameState.curTier - 1].radius;
  }

  function getCurrentDropShapeDef() {
    return gameState.curMeta && gameState.curMeta.wildcard
      ? getShapeDef(1)
      : getShapeDef(gameState.curTier);
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

  // Spawn & Drop Treat
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
      r: eqR,
      mass: eqR * eqR,
      x,
      y,
      vx,
      vy,
      angle: initialAngle,
      vr: initialVr,
      // Directional soft-body spring squish along actual impact normal
      squishAmt: bornFromMerge ? 0.25 : 0,
      squishVel: 0,
      squishAngle: bornFromMerge ? Math.PI * 0.5 : 0,
      age: 0,
      dangerTime: 0,
      inContact: false,
      merged: false,
      creditedToOrder: false,
      trail: [],
      // Per-dessert periodic solo action & neighbor-squeeze interaction timers
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
    if (gameState.activeToolMode || gameState.dropCooldown > 0) return;

    audio.ensureCtx();
    clampDropX();
    const totalAngle = getAimTotalAngle();
    const curMeta = gameState.curMeta || { wildcard: false, golden: false };
    // Crisp zero-sway vertical launch: drops 100% along the aim guide line!
    createEntity(gameState.curTier, gameState.dropX, JAR.dropY, 0, 165, false, totalAngle, 0, curMeta);
    audio.playDrop(curMeta.wildcard, curMeta.golden);

    // Decrement Rush Order steps
    if (gameState.order && !gameState.order.completed && gameState.order.rushDropsLeft > 0) {
      gameState.order.rushDropsLeft = Math.max(0, gameState.order.rushDropsLeft - 1);
      renderOrder();
    }

    // Advance queue & Rainbow Wildcard pity counter
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
      showToast('🌈 星露蓄满！下一颗必出【彩虹万能糖】！');
    }

    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.canHoldThisTurn = true;
    gameState.dropCooldown = gameState.feverTimer > 0 ? 0.13 : 0.22;
    gameState.heldActionAnim = null;
    gameState.heldActionCooldown = 1.5 + Math.random() * 1.5;
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
      vy: -56,
      text,
      color,
      fontSize,
      life: 0.98,
      maxLife: 0.98
    });
  }

  function spawnShockwave(x, y, maxR = 72, color = '#ffe37a', lineWidth = 3.5) {
    gameState.shockwaves.push({
      x,
      y,
      r: 8,
      maxR,
      color,
      lineWidth,
      life: 0.38,
      maxLife: 0.38
    });
  }

  function showComboBanner(text, sub = '', color = '#ffe56b') {
    gameState.comboBanner = {
      text,
      sub,
      color,
      life: 1.35,
      maxLife: 1.35
    };
  }

  // Gentle outward + upward pop shockwave around a merge to spark satisfying domino chain rolls!
  function applyMergeShockwaveImpulse(mx, my, bornR, nextTier, excludeId) {
    const shockLv = getPerkLevel('shockwave');
    const isFever = gameState.feverTimer > 0;
    const blastRadius = bornR * (2.45 + shockLv * 0.55) + 46;
    const baseForce = 95 + nextTier * 17 + shockLv * 52 + (isFever ? 32 : 0);

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
      const imp = Math.min(265, baseForce * falloff * massFactor);

      // Protect treats close to the danger line from popping upward into overflow
      const nearTop = other.y < JAR.dangerY + 58;
      other.vx += ux * imp * 0.95;
      if (nearTop) {
        other.vy += Math.max(0, uy * imp * 0.35);
      } else {
        other.vy += uy * imp * 0.72 - imp * 0.34;
      }
      other.vr += (dx >= 0 ? 1 : -1) * falloff * (2.4 + shockLv * 0.9);
      applyDirectionalSquish(other, -ux, -uy, 130 + imp * 1.1);
    }
  }

  // Fixed-Timestep 2D Compound-Convex-Polygon Rigid-Body Physics + Silky Magnet + Merge Pipeline
  function stepPhysics(dt) {
    const magnetLv = getPerkLevel('magnet');
    const isFever = gameState.feverTimer > 0;
    const magnetRange = 10 + magnetLv * 12 + (isFever ? 26 : 0);
    const magnetForce = 480 + magnetLv * 280 + (isFever ? 640 : 0);

    const result = Physics.stepWorld(gameState.entities, JAR, dt, 1680, {
      magnetRange,
      magnetForce
    });
    const { mergePairs, impacts, debugContacts, magnetLinks } = result;
    gameState.lastDebugContacts = debugContacts;
    gameState.magnetLinks = magnetLinks || [];

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
          const crumbCol = imp.bodyB.isWildcard
            ? '#ffb5d8'
            : imp.bodyB.isGolden
            ? '#ffe27a'
            : defB.crumbColor;
          spawnImpactCrumbs(imp.x, imp.y, imp.nx, imp.ny, crumbCol, intensity);
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
      const comboLv = getPerkLevel('combo');
      const critLv = getPerkLevel('critJump');
      const goldenLv = getPerkLevel('golden');
      const rainbowLv = getPerkLevel('rainbow');

      gameState.entities = gameState.entities.filter((e) => !e.merged);
      for (const [a, b] of mergePairs) {
        const isTwinWild = !!(a.isWildcard && b.isWildcard);
        const isWildMerge = !isTwinWild && !!(a.isWildcard || b.isWildcard);
        const isGoldenMerge = !!(a.isGolden || b.isGolden);

        // Anchor wildcard merge slightly toward the target treat so it feels natural
        const targetBody = isWildMerge ? (a.isWildcard ? b : a) : null;
        const mx = targetBody ? targetBody.x : (a.x + b.x) * 0.5;
        const my = targetBody ? targetBody.y : (a.y + b.y) * 0.5;
        const mvx = (a.vx + b.vx) * 0.32;
        const mvy = Math.min(0, (a.vy + b.vy) * 0.32) - 62;
        const mAngle =
          Math.atan2(Math.sin(a.angle) + Math.sin(b.angle), Math.cos(a.angle) + Math.cos(b.angle)) *
          0.3;
        const mVr = (a.vr + b.vr) * 0.22;

        // Combo tracking with Combo Master perk
        if (gameState.comboTimer <= 0) {
          gameState.comboCount = 1;
          gameState.comboRainbowGranted = false;
        } else {
          gameState.comboCount++;
        }
        gameState.comboTimer = 1.72 + comboLv * 0.6;
        if (gameState.comboCount > gameState.maxCombo) {
          gameState.maxCombo = gameState.comboCount;
        }

        const feverMult = getFeverMultiplier();
        const comboStep = 0.28 + comboLv * 0.22;
        const comboBonus = 1 + Math.min(2.2, (gameState.comboCount - 1) * comboStep);

        // Fever time extension on 3+ combo chains!
        if (gameState.feverTimer > 0 && gameState.comboCount >= 3 && gameState.feverBonusUsed < 4.5) {
          const ext = 0.8;
          gameState.feverTimer += ext;
          gameState.feverMaxDuration = Math.max(gameState.feverMaxDuration, gameState.feverTimer);
          gameState.feverBonusUsed += ext;
          audio.playFeverExtend();
          spawnPopup(JAR.canvasW / 2, 118, '🔥 狂热延时 +0.8s!', '#ffdf6b', 15);
        }

        // High-combo Rainbow Wildcard reward (once per chain)
        const rainbowComboReq = rainbowLv > 0 ? 3 : 4;
        if (gameState.comboCount >= rainbowComboReq && !gameState.comboRainbowGranted) {
          gameState.comboRainbowGranted = true;
          grantNextRainbow(`${gameState.comboCount}连合奖励`);
        }

        if (isTwinWild) {
          // Two Rainbow Wildcards merge -> Twin Rainbow Miracle!
          const born = createEntity(5, mx, my, mvx, mvy - 30, true, 0, 0, { golden: true });
          const pts = Math.round(320 * feverMult * comboBonus);
          addScore(pts);
          gameState.stardust += 24;
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
          // Check Crit Jump (+2 tiers!)
          const critChance = critLv * 0.14;
          const isCrit = baseTier <= 7 && critChance > 0 && Math.random() < critChance;
          const nextTier = Math.min(9, baseTier + (isCrit ? 2 : 1));
          const def = TIERS[nextTier - 1];

          // Golden glaze inheritance chance on golden merges
          const inheritGold =
            isGoldenMerge && Math.random() < 0.22 + goldenLv * 0.12;
          const born = createEntity(nextTier, mx, my, mvx, mvy, true, mAngle, mVr, {
            golden: inheritGold
          });

          const goldMult = isGoldenMerge ? 2.5 : 1;
          const critMult = isCrit ? 2.0 : 1;
          const pts = Math.round(def.points * feverMult * comboBonus * goldMult * critMult);
          addScore(pts);

          let dustGain = nextTier >= 4 ? Math.max(1, Math.floor(nextTier / 2)) : 0;
          if (isGoldenMerge) {
            dustGain += 12 + goldenLv * 10;
          }
          if (dustGain > 0) gameState.stardust += dustGain;

          addFeverEnergy(5.5 + nextTier * 2.3 + (isGoldenMerge ? 26 : 0) + (isWildMerge ? 14 : 0));

          // Layered audio feedback
          if (isCrit) {
            audio.playCritJump();
          } else if (isWildMerge) {
            audio.playWildcard();
          } else if (isGoldenMerge) {
            audio.playGoldenMerge();
          } else {
            audio.playMerge(nextTier, gameState.comboCount, false);
          }

          // Juicy particles + shockwave rings + neighbor domino impulse!
          spawnSparkleBurst(mx, my, isGoldenMerge ? '#ffe066' : def.color, 14 + nextTier * 2);
          if (isWildMerge || isCrit) {
            spawnSparkleBurst(mx, my, '#ff99cc', 16);
          }
          spawnShockwave(
            mx,
            my,
            def.radius * 1.9 + 26 + getPerkLevel('shockwave') * 12,
            isWildMerge ? '#ff99cc' : isGoldenMerge ? '#ffe169' : def.color,
            isCrit || isGoldenMerge ? 4.4 : 3.2
          );
          if (nextTier >= 5 || gameState.comboCount >= 2 || isCrit || isGoldenMerge) {
            spawnShockwave(mx, my, def.radius * 1.3 + 16, '#fff4bf', 2.2);
          }
          applyMergeShockwaveImpulse(mx, my, def.radius, nextTier, born.id);

          // Tactile Hitstop & Screen Shake proportional to excitement
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

          // Floating popup & center-top combo banner
          let label = `+${pts}`;
          let popColor = '#ffffff';
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
            const subTxt =
              gameState.feverTimer > 0
                ? `狂热 ${getFeverMultiplier().toFixed(1).replace('.0', '')}× 倍率爆发中!`
                : gameState.comboCount >= 3
                ? '多米诺大连锁!'
                : '丝滑连击!';
            showComboBanner(`${gameState.comboCount} 连合!!`, subTxt, gameState.comboCount >= 4 ? '#ff9fd2' : '#ffe46b');
          }
          spawnPopup(mx, my - def.radius * 0.6, label, popColor, popSize);

          if (nextTier === 9) {
            showToast('👑 奇迹诞生！合成传说级【星冠猫神舒芙蕾】！');
            setPatronSpeech(PATRONS[0], '哇！！星冠猫神舒芙蕾诞生了！整座甜品屋都在发光！', 5.0);
            showComboBanner('👑 星冠猫神诞生!', '传说级至高甜点!', '#ffe46b');
          }

          notifyTreatSynthesized(nextTier, born);
        } else {
          // Two Tier 9 Crown Cat Souffles (or Wildcard + Tier 9) -> Celestial Supernova!
          const pts = Math.round((isWildMerge ? 1200 : 1800) * feverMult * comboBonus);
          addScore(pts);
          gameState.stardust += 55;
          addFeverEnergy(65);
          audio.playSupernova();
          spawnSparkleBurst(mx, my, '#ffe378', 48);
          spawnShockwave(mx, my, 210, '#ffe378', 5.5);
          spawnShockwave(mx, my, 150, '#ff9fd2', 3.5);
          gameState.hitstopTimer = Math.max(gameState.hitstopTimer, 0.06);
          gameState.screenShake = Math.max(gameState.screenShake, 7.5);
          gameState.jarFlash = 0.85;
          spawnPopup(mx, my, `👑 星冠超新星! +${pts}`, '#ffe570', 22);
          showComboBanner('👑 星冠超新星!!', `+${pts}分 · 净化罐内小甜点`, '#ffe570');
          showToast('🌟 传说奇景！星冠猫神引发了甜品超新星！');
          // Gently clear tiny Tier 1~2 clutter around supernova
          gameState.entities = gameState.entities.filter((e) => {
            if (!e.isWildcard && e.tier <= 2 && Math.hypot(e.x - mx, e.y - my) < 190) {
              spawnSparkleBurst(e.x, e.y, '#9be0ff', 8);
              return false;
            }
            return true;
          });
        }
      }
      updateHUD();
    }

    // Update age, drop trail, harmonic soft-body spring squish, and exact polygon-top overflow check
    let anyDanger = false;
    for (const e of gameState.entities) {
      e.age += dt;
      // Record brief crisp watercolor ribbon trail for freshly falling treats
      if (e.age < 0.45 && e.vy > 140) {
        e.trail.push({ x: e.x, y: e.y });
        if (e.trail.length > 6) e.trail.shift();
      } else if (e.trail.length > 0) {
        e.trail.shift();
      }

      // Underdamped spring oscillator for juicy pastry rebound along impact normal
      e.squishVel += (-220 * e.squishAmt - 17 * e.squishVel) * dt;
      e.squishAmt += e.squishVel * dt;
      if (Math.abs(e.squishAmt) < 0.001 && Math.abs(e.squishVel) < 0.01) {
        e.squishAmt = 0;
        e.squishVel = 0;
      } else {
        e.squishAmt = Math.max(-0.15, Math.min(0.28, e.squishAmt));
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
    audio.setDangerLevel(Math.max(0, Math.min(1, (gameState.dangerDuration - 0.45) / 2.1)));
  }

  function triggerGameOver() {
    if (gameState.over) return;
    gameState.over = true;
    gameState.running = false;
    gameState.paused = false;
    blessingModal.classList.remove('is-open');
    cancelToolMode();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
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
    syncAudioMood();
  }

  // Rendering: Starlight Glass Jar + Aim Lock-On + Magnet Tethers + Special Drops + FX
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

  function predictLandingY(tier, dropX, angle, isWildcard = false) {
    const r = isWildcard ? WILDCARD_RADIUS : TIERS[tier - 1].radius;
    const shapeDef = isWildcard ? getShapeDef(1) : getShapeDef(tier);
    if (!shapeDef || !Physics) return JAR.floorY - r;
    const hitY = Physics.predictDropLandingY(
      shapeDef,
      r,
      dropX,
      JAR.dropY,
      angle,
      JAR,
      gameState.entities
    );
    return Math.max(JAR.dropY + 20, hitY);
  }

  // Detects whether dropping right now will immediately land on / magnetically snap into a mergeable treat
  function findAimMergeTarget(tier, dropX, landY, isWildcard) {
    const curR = isWildcard ? WILDCARD_RADIUS : TIERS[tier - 1].radius;
    const lockPad = 14 + getPerkLevel('magnet') * 6 + (gameState.feverTimer > 0 ? 14 : 0);
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < gameState.entities.length; i++) {
      const e = gameState.entities[i];
      if (e.merged) continue;
      const canMerge = isWildcard ? true : e.isWildcard || e.tier === tier;
      if (!canMerge) continue;
      const d = Math.hypot(e.x - dropX, e.y - landY);
      if (d <= e.r + curR + lockPad && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  // Procedural Watercolor-Style Rainbow Wildcard Star Candy
  function drawRainbowWildcard(c, x, y, r, angle, nowSec, alpha = 1) {
    c.save();
    if (alpha < 1) c.globalAlpha = alpha;
    c.translate(x, y);

    // Outer luminous pastel rainbow aura
    const aura = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.55);
    aura.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
    aura.addColorStop(0.55, 'rgba(255, 168, 214, 0.34)');
    aura.addColorStop(1, 'rgba(130, 224, 255, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(0, 0, r * 1.55, 0, Math.PI * 2);
    c.fill();

    // 7-point konpeito / star-candy silhouette rotating gently
    c.save();
    c.rotate(angle + nowSec * 0.85);
    const pts = 7;
    const grad = c.createLinearGradient(-r, -r, r, r);
    const hueShift = (nowSec * 90) % 360;
    grad.addColorStop(0, `hsl(${hueShift}, 92%, 82%)`);
    grad.addColorStop(0.35, `hsl(${(hueShift + 65) % 360}, 95%, 80%)`);
    grad.addColorStop(0.7, `hsl(${(hueShift + 150) % 360}, 85%, 78%)`);
    grad.addColorStop(1, `hsl(${(hueShift + 240) % 360}, 88%, 82%)`);

    c.beginPath();
    for (let i = 0; i < pts * 2; i++) {
      const a = (i * Math.PI) / pts - Math.PI / 2;
      const rad = i % 2 === 0 ? r * 1.14 : r * 0.74;
      if (i === 0) c.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    c.closePath();
    c.fillStyle = grad;
    c.fill();
    c.strokeStyle = '#4A2C2A';
    c.lineWidth = 2.4;
    c.lineJoin = 'round';
    c.stroke();

    // Soft glossy inner pearl sheen
    c.fillStyle = 'rgba(255, 255, 255, 0.45)';
    c.beginPath();
    c.arc(-r * 0.18, -r * 0.22, r * 0.42, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Adorable permanent sparkling face (upright-ish for instant charm)
    c.rotate(angle * 0.25);
    // Rosy cheeks
    c.fillStyle = 'rgba(255, 118, 168, 0.75)';
    c.beginPath();
    c.ellipse(-r * 0.34, r * 0.14, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
    c.ellipse(r * 0.34, r * 0.14, r * 0.14, r * 0.08, 0, 0, Math.PI * 2);
    c.fill();
    // Sparkling star eyes
    c.fillStyle = '#4A2C2A';
    drawStar(c, -r * 0.24, -r * 0.04, r * 0.18, nowSec * 1.5);
    drawStar(c, r * 0.24, -r * 0.04, r * 0.18, -nowSec * 1.5);
    // Cute smile
    c.strokeStyle = '#4A2C2A';
    c.lineWidth = 1.9;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, r * 0.08, r * 0.14, 0.2, Math.PI - 0.2);
    c.stroke();

    // Orbiting mini rainbow stars
    if (alpha > 0.5) {
      for (let k = 0; k < 2; k++) {
        const oa = nowSec * 2.8 + k * Math.PI;
        c.fillStyle = k === 0 ? '#fff6a6' : '#ff99cc';
        drawStar(c, Math.cos(oa) * r * 1.18, Math.sin(oa) * r * 1.18, 3.8, nowSec * 4);
      }
    }
    c.restore();
  }

  // Luminous Golden Glaze Aura drawn around Golden Treats
  function drawGoldenAura(c, x, y, r, nowSec, alpha = 1) {
    c.save();
    if (alpha < 1) c.globalAlpha = alpha;
    c.translate(x, y);
    const pulse = 0.88 + 0.12 * Math.sin(nowSec * 6);
    const grad = c.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.48 * pulse);
    grad.addColorStop(0, 'rgba(255, 224, 96, 0.48)');
    grad.addColorStop(0.68, 'rgba(255, 198, 56, 0.22)');
    grad.addColorStop(1, 'rgba(255, 198, 56, 0)');
    c.fillStyle = grad;
    c.beginPath();
    c.arc(0, 0, r * 1.48 * pulse, 0, Math.PI * 2);
    c.fill();

    // Shimmering dashed golden halo ring
    c.rotate(nowSec * 0.9);
    c.strokeStyle = 'rgba(255, 226, 102, 0.85)';
    c.lineWidth = 2.1;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.arc(0, 0, r * 1.07, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.restore();
  }

  // Glowing Magnetic Starlight Tether Arcs between attracting same-tier / wildcard treats
  function drawMagnetLinks(c, nowSec) {
    const links = gameState.magnetLinks;
    if (!links || links.length === 0) return;

    c.save();
    for (let i = 0; i < links.length; i++) {
      const lk = links[i];
      const { a, b, strength, isWild } = lk;
      if (!a || !b || a.merged || b.merged) continue;

      const mx = (a.x + b.x) * 0.5;
      const my = (a.y + b.y) * 0.5;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;
      const bend = Math.sin(nowSec * 14 + i) * 7 * strength;

      c.beginPath();
      c.moveTo(a.x, a.y);
      c.quadraticCurveTo(mx + nx * bend, my + ny * bend, b.x, b.y);
      c.strokeStyle = isWild
        ? `rgba(255, 160, 215, ${0.42 + strength * 0.5})`
        : `rgba(255, 225, 102, ${0.35 + strength * 0.52})`;
      c.lineWidth = 1.8 + strength * 2.4;
      c.lineCap = 'round';
      c.stroke();

      // Traveling sparkle bead sliding along tether
      const t = (nowSec * 2.6 + i * 0.37) % 1;
      const bx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * (mx + nx * bend) + t * t * b.x;
      const by = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * (my + ny * bend) + t * t * b.y;
      c.fillStyle = isWild ? '#ffd6f0' : '#fff4a8';
      drawStar(c, bx, by, 3.6 + strength * 2.2, nowSec * 7);
    }
    c.restore();
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
    // Apply playful jar shake (bell tool) + crisp impact micro-screen-shake
    let shakeX = 0;
    let shakeY = 0;
    if (gameState.jarShakeAmp > 0.01) {
      shakeX += Math.sin(nowSec * 52) * 7 * gameState.jarShakeAmp;
      shakeY += Math.cos(nowSec * 44) * 4 * gameState.jarShakeAmp;
    }
    if (gameState.screenShake > 0.05) {
      shakeX += (Math.sin(nowSec * 97) * 0.7 + Math.cos(nowSec * 73) * 0.3) * gameState.screenShake;
      shakeY += (Math.cos(nowSec * 89) * 0.7 + Math.sin(nowSec * 61) * 0.3) * gameState.screenShake;
    }
    if (shakeX !== 0 || shakeY !== 0) {
      ctx.translate(shakeX, shakeY);
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

    // 2. Translucent glass chamber back-fill (+ vibrant Fever aurora & rising starlight motes)
    ctx.save();
    traceJarInnerPath(ctx);
    ctx.closePath();
    const bgGrad = ctx.createLinearGradient(0, JAR.neckY, 0, JAR.floorY);
    if (isFever) {
      const shimmer = 0.5 + 0.5 * Math.sin(nowSec * 3.8);
      bgGrad.addColorStop(0, `rgba(255, 226, 130, ${0.24 + shimmer * 0.1})`);
      bgGrad.addColorStop(0.5, `rgba(255, 168, 210, ${0.14 + (1 - shimmer) * 0.08})`);
      bgGrad.addColorStop(1, `rgba(146, 232, 218, ${0.18 + shimmer * 0.08})`);
    } else {
      bgGrad.addColorStop(0, 'rgba(170, 225, 238, 0.14)');
      bgGrad.addColorStop(0.6, 'rgba(22, 60, 74, 0.24)');
      bgGrad.addColorStop(1, 'rgba(255, 228, 175, 0.14)');
    }
    ctx.fillStyle = bgGrad;
    ctx.fill();

    ctx.clip();
    const moteCount = isFever ? 12 : 5;
    for (let m = 0; m < moteCount; m++) {
      const mx = JAR.left + 22 + ((m * 47 + Math.sin(nowSec * (isFever ? 1.4 : 0.7) + m) * 18) % (JAR.right - JAR.left - 44));
      const my = JAR.floorY - (((nowSec * (isFever ? 65 : 22) + m * 59) % (JAR.floorY - JAR.neckY)));
      ctx.fillStyle = isFever
        ? (m % 2 === 0 ? 'rgba(255, 234, 138, 0.48)' : 'rgba(255, 182, 220, 0.44)')
        : 'rgba(255, 236, 178, 0.22)';
      drawStar(ctx, mx, my, isFever ? 3.2 + (m % 3) : 2.1 + (m % 2) * 0.8, nowSec * (isFever ? 3 : 1.2) + m);
    }
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

    // 4. Exact Polygon Drop Trajectory Guide + Aim Merge Lock-On + Ghost + Held Treat
    let lockedTarget = null;
    if (gameState.running && !gameState.over && !gameState.activeToolMode) {
      const curMeta = gameState.curMeta || { wildcard: false, golden: false };
      const curIsWild = !!curMeta.wildcard;
      const curIsGold = !curIsWild && !!curMeta.golden;
      const curR = getCurrentDropRadius();
      const curShape = getCurrentDropShapeDef();
      const aimAngle = getAimTotalAngle();
      const landY = predictLandingY(gameState.curTier, gameState.dropX, aimAngle, curIsWild);
      lockedTarget = findAimMergeTarget(gameState.curTier, gameState.dropX, landY, curIsWild);
      const isAimCancelled = gameState.touchAim.active && gameState.touchAim.cancelled;
      const isTouchAiming = gameState.touchAim.active && !gameState.touchAim.cancelled;

      // Dashed guide line (turns bright pulsing gold/rainbow when locked onto a merge!)
      ctx.save();
      if (isAimCancelled) ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.setLineDash(lockedTarget ? [7, 4] : [6, 6]);
      ctx.moveTo(gameState.dropX, JAR.dropY + curR * 0.9 + 2);
      ctx.lineTo(gameState.dropX, Math.max(JAR.dropY + curR, landY - curR * 0.65));
      if (lockedTarget) {
        const pulse = 0.72 + 0.28 * Math.sin(nowSec * 10);
        ctx.strokeStyle = curIsWild
          ? `rgba(255, 168, 224, ${pulse})`
          : `rgba(255, 228, 102, ${pulse})`;
        ctx.lineWidth = isTouchAiming ? 3.2 : 2.8;
      } else {
        ctx.strokeStyle = curIsWild
          ? 'rgba(255, 186, 232, 0.72)'
          : curIsGold
          ? 'rgba(255, 224, 102, 0.76)'
          : isTouchAiming
          ? 'rgba(255, 232, 152, 0.85)'
          : 'rgba(255, 224, 132, 0.58)';
        ctx.lineWidth = isTouchAiming ? 2.4 : 1.8;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Exact landing ghost silhouette (faint sprite + dashed compound polygon contour)
      if (landY > JAR.dropY + 26 && !isAimCancelled) {
        if (curIsWild) {
          drawRainbowWildcard(ctx, gameState.dropX, landY, curR, aimAngle, nowSec, 0.34);
        } else {
          drawTierSprite(gameState.curTier, gameState.dropX, landY, curR, aimAngle, 0, 0, isTouchAiming ? 0.34 : 0.25);
        }
        drawShapePolygons(
          ctx,
          curShape,
          gameState.dropX,
          landY,
          curR,
          aimAngle,
          lockedTarget ? 'rgba(255, 238, 118, 0.95)' : isTouchAiming ? 'rgba(255, 238, 170, 0.78)' : 'rgba(255, 232, 148, 0.52)',
          lockedTarget ? 2.2 : 1.5,
          lockedTarget ? 'rgba(255, 232, 118, 0.16)' : 'rgba(255, 224, 132, 0.07)',
          [4, 4]
        );

        // Lock-on floating pill near ghost
        if (lockedTarget) {
          const tagText = curIsWild
            ? '🌈 升阶+1!'
            : curIsGold || lockedTarget.isGolden
            ? '✨ 黄金暴击!'
            : '✦ 可合成!';
          const tagY = Math.max(JAR.neckY + 20, landY - curR - 14);
          const tagX = Math.max(JAR.left + 44, Math.min(JAR.right - 44, gameState.dropX));
          ctx.save();
          ctx.fillStyle = curIsWild ? 'rgba(130, 32, 92, 0.9)' : 'rgba(66, 36, 12, 0.9)';
          ctx.strokeStyle = curIsWild ? '#ffb8e6' : '#ffe370';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(tagX - 38, tagY - 10, 76, 20, 10);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fff5be';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tagText, tagX, tagY);
          ctx.restore();
        }
      }

      // Current treat hovering above rim (unplaced treat with periodic solo action)
      if (gameState.dropCooldown <= 0.09) {
        const visualAngle = aimAngle + gameState.dropSway * 0.45;
        ctx.save();
        if (isAimCancelled) ctx.globalAlpha = 0.45;
        if (curIsWild) {
          drawRainbowWildcard(ctx, gameState.dropX, JAR.dropY, curR, visualAngle, nowSec, 1);
        } else {
          if (curIsGold) drawGoldenAura(ctx, gameState.dropX, JAR.dropY, curR, nowSec, 1);
          drawTierSprite(
            gameState.curTier,
            gameState.dropX,
            JAR.dropY,
            curR,
            visualAngle,
            0,
            0,
            1,
            gameState.heldActionAnim
          );
          if (gameState.heldActionAnim) {
            drawDessertActionFX(ctx, gameState.dropX, JAR.dropY, curR, gameState.curTier, gameState.heldActionAnim);
          }
        }
        ctx.restore();

        if (isAimCancelled) {
          ctx.save();
          ctx.fillStyle = 'rgba(42, 22, 12, 0.88)';
          ctx.strokeStyle = 'rgba(255, 210, 140, 0.8)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.roundRect(JAR.canvasW / 2 - 58, JAR.neckY + 12, 116, 22, 11);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#ffe8bc';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↑ 松手取消投放', JAR.canvasW / 2, JAR.neckY + 23);
          ctx.restore();
        }

        // Show subtle manual tilt readout pill when player tilts with Q/E or wheel
        if (Math.abs(gameState.aimAngle) > 0.03) {
          const deg = Math.round((gameState.aimAngle * 180) / Math.PI);
          const sign = deg > 0 ? '+' : '';
          ctx.save();
          ctx.fillStyle = 'rgba(38, 22, 12, 0.84)';
          ctx.strokeStyle = 'rgba(255, 218, 128, 0.75)';
          ctx.lineWidth = 1.2;
          const pillX = Math.min(JAR.right - 56, Math.max(JAR.left + 4, gameState.dropX + curR + 8));
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

    // 4.5 Soft Drop Trails behind freshly falling treats
    for (const e of gameState.entities) {
      if (!e.trail || e.trail.length < 2) continue;
      ctx.save();
      const baseCol = e.isWildcard ? '#ff9fd6' : e.isGolden ? '#ffe26a' : TIERS[e.tier - 1].crumbColor;
      for (let i = 0; i < e.trail.length; i++) {
        const pt = e.trail[i];
        const frac = (i + 1) / e.trail.length;
        ctx.globalAlpha = frac * 0.24;
        ctx.fillStyle = baseCol;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, e.r * (0.42 + frac * 0.44), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4.8 Magnetic Starlight Tether Arcs
    drawMagnetLinks(ctx, nowSec);

    // 5. All Physics Entities inside Jar (with soft grounded contact shadows)
    ctx.save();
    ctx.fillStyle = 'rgba(24, 12, 6, 0.22)';
    for (const e of gameState.entities) {
      ctx.beginPath();
      ctx.ellipse(e.x + 2, e.y + e.r * 0.14, e.r * 0.94, e.r * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    for (const e of gameState.entities) {
      const isHovered = gameState.activeToolMode && gameState.hoveredEntityId === e.id;
      const validTarget =
        isHovered &&
        ((gameState.activeToolMode === 'fork' && !e.isWildcard && e.tier <= 4) ||
          (gameState.activeToolMode === 'spoon' && !e.isWildcard && e.tier < 9));

      if (e.isWildcard) {
        drawRainbowWildcard(ctx, e.x, e.y, e.r, e.angle, nowSec, 1);
      } else {
        if (e.isGolden) {
          drawGoldenAura(ctx, e.x, e.y, e.r, nowSec, 1);
        }
        drawTierSprite(e.tier, e.x, e.y, e.r, e.angle, e.squishAmt, e.squishAngle, 1, e.anim);
        if (e.isGolden) {
          // Orbiting golden sparkle stars in foreground
          ctx.save();
          const ga = nowSec * 2.5 + e.id;
          ctx.fillStyle = '#fff5b0';
          drawStar(ctx, e.x + Math.cos(ga) * e.r * 0.88, e.y + Math.sin(ga) * e.r * 0.88, 4.2, nowSec * 5);
          ctx.restore();
        }
      }

      // Highlight locked-on aim merge target with pulsing golden halo
      if (lockedTarget && lockedTarget.id === e.id) {
        ctx.save();
        const pulse = 0.65 + 0.35 * Math.sin(nowSec * 10);
        ctx.strokeStyle = gameState.curMeta.wildcard
          ? `rgba(255, 168, 224, ${pulse})`
          : `rgba(255, 234, 108, ${pulse})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 5 + Math.sin(nowSec * 10) * 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Highlight exact polygon contour when targeting with Fork or Spoon
      if (validTarget) {
        drawEntityWorldPolys(
          ctx,
          e,
          gameState.activeToolMode === 'fork' ? '#91f2ff' : '#ffe169',
          3.2
        );
      } else if (isHovered && gameState.activeToolMode === 'fork' && (e.tier > 4 || e.isWildcard)) {
        drawEntityWorldPolys(ctx, e, 'rgba(255, 100, 90, 0.82)', 2.4);
      }
    }

    // 5.2 Render Solo Action Emotes & Neighbor Squeeze Interaction FX above treats
    for (const e of gameState.entities) {
      if (e.anim && !e.isWildcard) {
        drawDessertActionFX(ctx, e.x, e.y, e.r, e.tier, e.anim);
      }
    }

    // 5.4 Expanding Merge Shockwave Rings
    for (const sw of gameState.shockwaves) {
      const p = 1 - sw.life / sw.maxLife;
      const alpha = Math.max(0, (1 - p) * 0.85);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(1, sw.lineWidth * (1 - p * 0.65));
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
    ctx.lineWidth = 9 + (gameState.jarFlash > 0 ? gameState.jarFlash * 6 : 0);
    ctx.strokeStyle =
      gameState.jarFlash > 0.05
        ? `rgba(255, 238, 146, ${0.45 + gameState.jarFlash * 0.5})`
        : isFever
        ? 'rgba(255, 215, 92, 0.62)'
        : 'rgba(255, 244, 214, 0.35)';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    traceJarInnerPath(ctx);
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();

    // Curved specular glass sheen on left, right, and curved bottom caustic rim
    ctx.beginPath();
    ctx.moveTo(JAR.left + 12, JAR.neckY + 28);
    ctx.quadraticCurveTo(JAR.left + 10, 310, JAR.left + 32, JAR.floorY - 46);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(JAR.right - 12, JAR.neckY + 34);
    ctx.quadraticCurveTo(JAR.right - 10, 310, JAR.right - 34, JAR.floorY - 50);
    ctx.strokeStyle = 'rgba(255, 244, 214, 0.26)';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(JAR.left + 92, JAR.floorY - 12);
    ctx.quadraticCurveTo(JAR.canvasW / 2, JAR.floorY + 1, JAR.right - 92, JAR.floorY - 12);
    ctx.strokeStyle = 'rgba(255, 248, 224, 0.34)';
    ctx.lineWidth = 4.5;
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
    ctx.strokeStyle = 'rgba(255, 250, 220, 0.72)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // 8. Floating Score Popups
    const fontFamily = getComputedStyle(document.body).fontFamily;
    for (const pop of gameState.popups) {
      const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `900 ${pop.fontSize}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#3c2118';
      ctx.strokeText(pop.text, pop.x, pop.y);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
      ctx.restore();
    }

    // 9. Center-Top Animated Combo / Event Celebration Banner
    if (gameState.comboBanner && gameState.comboBanner.life > 0) {
      const cb = gameState.comboBanner;
      const elapsed = cb.maxLife - cb.life;
      const popIn = elapsed < 0.16 ? 0.65 + 0.48 * Math.sin((elapsed / 0.16) * (Math.PI * 0.65)) : 1.0;
      const fadeOut = cb.life < 0.28 ? cb.life / 0.28 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, fadeOut));
      ctx.translate(JAR.canvasW * 0.5, 140 - elapsed * 10);
      ctx.scale(popIn, popIn);
      ctx.font = `900 22px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#3c2118';
      ctx.strokeText(cb.text, 0, 0);
      ctx.fillStyle = cb.color;
      ctx.fillText(cb.text, 0, 0);
      if (cb.sub) {
        ctx.font = `800 12.5px ${fontFamily}`;
        ctx.lineWidth = 3.5;
        ctx.strokeText(cb.sub, 0, 20);
        ctx.fillStyle = '#fff5cf';
        ctx.fillText(cb.sub, 0, 20);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Computes procedural offset, rotation, squash-and-stretch, and active sprite frame
   * for each tier's signature solo action or paired neighbor-squeeze interaction.
   */
  function computeDessertAnimPose(tier, anim) {
    if (!anim) {
      return { dx: 0, dy: 0, dAngle: 0, sx: 1, sy: 1, spriteKind: 'base' };
    }
    const p = Math.max(0, Math.min(1, anim.t / anim.dur));
    const env = Math.sin(p * Math.PI);

    if (anim.kind === 'interact') {
      const s = anim.isLeader ? 1 : -1;
      const ux = anim.ux || 0;
      const uy = anim.uy || 0;
      const tx = -uy;
      const ty = ux;

      if (anim.style === 'nuzzle') {
        // Cheek-to-cheek affectionate lean + perpendicular nuzzle rub
        const push = Math.sin(p * Math.PI) * 3.8;
        const rub = Math.sin(p * Math.PI * 4) * 2.1 * env * s;
        return {
          dx: ux * push + tx * rub,
          dy: uy * push + ty * rub,
          dAngle: Math.sin(p * Math.PI * 4) * 0.14 * env * s,
          sx: 1 + 0.08 * Math.sin(p * Math.PI * 2) * env,
          sy: 1 - 0.06 * Math.sin(p * Math.PI * 2) * env,
          spriteKind: 'int'
        };
      } else if (anim.style === 'boop') {
        // Double elastic squeeze-boop toward shared contact point
        const wave = Math.abs(Math.sin(p * Math.PI * 2)) * env;
        return {
          dx: ux * wave * 4.2,
          dy: uy * wave * 4.2,
          dAngle: Math.sin(p * Math.PI * 2) * 0.09 * env * s,
          sx: 1 + 0.11 * wave,
          sy: 1 - 0.09 * wave,
          spriteKind: 'int'
        };
      } else {
        // 'chat': Cozy duet sway & whisper between neighbors
        const hop = Math.abs(Math.sin(p * Math.PI * 3)) * env;
        return {
          dx: ux * 2.4 * env,
          dy: uy * 2.0 * env - hop * 3.0,
          dAngle: Math.sin(p * Math.PI * 3) * 0.15 * env * s,
          sx: 1 + 0.07 * Math.sin(p * Math.PI * 3) * env,
          sy: 1 - 0.05 * Math.sin(p * Math.PI * 3) * env,
          spriteKind: p > 0.35 && p < 0.72 ? 'act' : 'int'
        };
      }
    }

    // Signature per-tier solo idle action (1..9)
    switch (tier) {
      case 1: // 蓝莓星露糖: 星露眨眼双跳 + 绿叶轻摇
        return {
          dx: 0,
          dy: -Math.abs(Math.sin(p * Math.PI * 2)) * 5.2 * env,
          dAngle: Math.sin(p * Math.PI * 4) * 0.16 * env,
          sx: 1 + 0.08 * Math.cos(p * Math.PI * 4) * env,
          sy: 1 - 0.07 * Math.cos(p * Math.PI * 4) * env,
          spriteKind: 'act'
        };
      case 2: // 蜜桃泡芙球: 奶油鼓腮呼吸律动
        return {
          dx: 0,
          dy: -2.6 * env,
          dAngle: Math.sin(p * Math.PI * 2) * 0.09 * env,
          sx: 1 + 0.13 * Math.sin(p * Math.PI * 3) * env,
          sy: 1 - 0.09 * Math.sin(p * Math.PI * 3) * env,
          spriteKind: 'act'
        };
      case 3: // 抹茶猫耳团子: 高频猫耳抖抖 + 开心微跳
        return {
          dx: 0,
          dy: -3.6 * Math.abs(Math.sin(p * Math.PI * 2)) * env,
          dAngle: Math.sin(p * Math.PI * 8) * 0.15 * env,
          sx: 1 - 0.06 * Math.sin(p * Math.PI * 2) * env,
          sy: 1 + 0.09 * Math.sin(p * Math.PI * 2) * env,
          spriteKind: 'act'
        };
      case 4: // 柠檬蜂蜜布丁塔: 凝乳果冻Q晃
        return {
          dx: Math.sin(p * Math.PI * 4) * 3.0 * env,
          dy: -1.8 * env,
          dAngle: Math.sin(p * Math.PI * 4) * 0.09 * env,
          sx: 1 + 0.12 * Math.sin(p * Math.PI * 5) * env,
          sy: 1 - 0.10 * Math.sin(p * Math.PI * 5) * env,
          spriteKind: 'act'
        };
      case 5: // 草莓奶油大福: 麻薯软糯拉伸弹跳
        return {
          dx: 0,
          dy: -Math.max(0, Math.sin(p * Math.PI * 2)) * 5.8 * env,
          dAngle: Math.sin(p * Math.PI * 2) * 0.08 * env,
          sx: 1 - 0.11 * Math.sin(p * Math.PI * 2) * env,
          sy: 1 + 0.14 * Math.sin(p * Math.PI * 2) * env,
          spriteKind: 'act'
        };
      case 6: // 焦糖星云甜甜圈: 星云旋舞摇摆
        return {
          dx: 0,
          dy: -3.0 * env,
          dAngle: Math.sin(p * Math.PI * 3) * 0.24 * env,
          sx: 1 + 0.08 * env,
          sy: 1 + 0.08 * env,
          spriteKind: 'act'
        };
      case 7: // 星夜猫猫马卡龙: 睡醒睁眼伸懒腰
        return {
          dx: 0,
          dy: -4.2 * env,
          dAngle: Math.sin(p * Math.PI * 6) * 0.07 * env,
          sx: 1 - 0.08 * env,
          sy: 1 + 0.14 * env,
          spriteKind: 'act'
        };
      case 8: // 皇家栗子蒙布朗: 金栗闪耀挺胸
        return {
          dx: 0,
          dy: -4.0 * env,
          dAngle: Math.sin(p * Math.PI * 2) * 0.07 * env,
          sx: 1 + 0.09 * env,
          sy: 1 + 0.12 * env,
          spriteKind: 'act'
        };
      case 9: // 星冠猫神舒芙蕾: 天使奶油翼振翅悬浮
      default:
        return {
          dx: 0,
          dy: -Math.abs(Math.sin(p * Math.PI * 3)) * 7.2 * env,
          dAngle: Math.sin(p * Math.PI * 3) * 0.09 * env,
          sx: 1 + 0.10 * Math.cos(p * Math.PI * 6) * env,
          sy: 1 - 0.07 * Math.cos(p * Math.PI * 6) * env,
          spriteKind: 'act'
        };
    }
  }

  function drawHeartIcon(c, x, y, size, color) {
    c.save();
    c.translate(x, y);
    c.fillStyle = color;
    c.strokeStyle = '#4A2C2A';
    c.lineWidth = 1.6;
    c.beginPath();
    const s = size * 0.5;
    c.moveTo(0, s * 0.85);
    c.bezierCurveTo(-s * 1.35, -s * 0.1, -s * 0.75, -s * 1.2, 0, -s * 0.45);
    c.bezierCurveTo(s * 0.75, -s * 1.2, s * 1.35, -s * 0.1, 0, s * 0.85);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  function drawDessertActionFX(c, x, y, r, tier, anim) {
    if (!anim) return;
    const p = Math.max(0, Math.min(1, anim.t / anim.dur));
    const env = Math.sin(p * Math.PI);
    if (env <= 0.04) return;

    c.save();
    c.globalAlpha = Math.min(1, env * 1.25);

    if (anim.kind === 'interact') {
      // Only the leader of the squeezed pair draws the shared contact-point interaction FX
      if (!anim.isLeader) {
        c.restore();
        return;
      }
      const cx = anim.cx;
      const cy = anim.cy;
      const floatY = cy - 6 - p * 14;

      if (anim.style === 'nuzzle') {
        drawHeartIcon(c, cx, floatY, 13 + 3 * env, '#ff6f9c');
        drawHeartIcon(c, cx + 10, floatY - 7, 8 + 2 * env, '#ffa3c2');
      } else if (anim.style === 'boop') {
        // Playful squeeze/sparkle marks at contact point
        drawStar(c, cx - 7, floatY, 5.5 * env, p * 5);
        c.fillStyle = '#ffe169';
        drawStar(c, cx + 8, floatY - 4, 4.5 * env, -p * 5);
      } else {
        // 'chat': Floating duet musical notes
        c.font = '900 13px sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.lineWidth = 3;
        c.strokeStyle = '#3c2118';
        const note = p < 0.5 ? '♪' : '♫';
        c.strokeText(note, cx + Math.sin(p * 10) * 5, floatY);
        c.fillStyle = '#ffe47a';
        c.fillText(note, cx + Math.sin(p * 10) * 5, floatY);
      }
      c.restore();
      return;
    }

    // Solo Action micro-emote above upper-right rim of the dessert
    const soloEmotes = ['✦', '♪', '喵~', '✨', '♡', '★', '!', '♛', '👑'];
    const label = tier === 7 && p < 0.35 ? 'Zzz' : soloEmotes[(tier - 1) % soloEmotes.length];
    const ex = x + r * 0.55;
    const ey = y - r * 0.72 - p * 10;
    c.font = '800 11.5px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineWidth = 2.8;
    c.strokeStyle = '#3c2118';
    c.strokeText(label, ex, ey);
    c.fillStyle = '#fff3b8';
    c.fillText(label, ex, ey);
    c.restore();
  }

  function drawTierSprite(tier, x, y, r, angle, squishAmt = 0, squishAngle = 0, alpha = 1, anim = null) {
    const def = TIERS[tier - 1];
    const shapeDef = getShapeDef(tier);
    const pose = computeDessertAnimPose(tier, anim);
    let img = spriteImages[tier];
    if (pose.spriteKind === 'act' && spriteActionImages[tier]) {
      img = spriteActionImages[tier];
    } else if (pose.spriteKind === 'int' && spriteInteractImages[tier]) {
      img = spriteInteractImages[tier];
    }

    if (!img) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(x + pose.dx, y + pose.dy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(x + pose.dx, y + pose.dy);

    const totalAngle = angle + pose.dAngle;
    // Directional soft-body squish strictly along real world impact normal
    if (Math.abs(squishAmt) > 0.002) {
      ctx.rotate(squishAngle);
      ctx.scale(1 - squishAmt, 1 + squishAmt * 0.82);
      ctx.rotate(totalAngle - squishAngle);
    } else {
      ctx.rotate(totalAngle);
    }

    if (pose.sx !== 1 || pose.sy !== 1) {
      ctx.scale(pose.sx, pose.sy);
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

  function updateDessertAnimations(dt) {
    // 1. Unplaced Held Dessert periodic solo action above the jar rim (skip Rainbow Wildcard)
    if (gameState.curMeta && gameState.curMeta.wildcard) {
      gameState.heldActionAnim = null;
    } else if (gameState.heldActionAnim) {
      gameState.heldActionAnim.t += dt;
      if (gameState.heldActionAnim.t >= gameState.heldActionAnim.dur) {
        gameState.heldActionAnim = null;
      }
    } else if (gameState.dropCooldown <= 0 && !gameState.activeToolMode) {
      gameState.heldActionCooldown -= dt;
      if (gameState.heldActionCooldown <= 0) {
        gameState.heldActionAnim = { kind: 'solo', t: 0, dur: 1.1 };
        gameState.heldActionCooldown = 2.6 + Math.random() * 2.2;
      }
    }

    // 2. Unplaced NEXT / HOLD Preview Bubbles periodic action (preserve Rainbow Wildcard SVG!)
    const mNextBoxEl = mNextImgEl ? mNextImgEl.parentElement : null;
    const nextIsWild = !!(gameState.nextMeta && gameState.nextMeta.wildcard);
    const holdIsWild = !!(gameState.holdMeta && gameState.holdMeta.wildcard);
    if (gameState.previewActionTimer > 0) {
      gameState.previewActionTimer -= dt;
      if (gameState.previewActionTimer <= 0) {
        gameState.previewActionTimer = 0;
        gameState.previewActionTarget = null;
        if (nextBubbleEl) nextBubbleEl.classList.remove('is-acting');
        if (mNextBoxEl) mNextBoxEl.classList.remove('is-acting');
        if (holdBubbleEl) holdBubbleEl.classList.remove('is-acting');
        if (mHoldBubbleEl) mHoldBubbleEl.classList.remove('is-acting');
        const nextDef = TIERS[gameState.nextTier - 1];
        const nextSrc = nextIsWild ? RAINBOW_SVG_URI : nextDef.src;
        nextImgEl.src = nextSrc;
        if (mNextImgEl) mNextImgEl.src = nextSrc;
        if (gameState.holdTier) {
          const holdDef = TIERS[gameState.holdTier - 1];
          const holdSrc = holdIsWild ? RAINBOW_SVG_URI : holdDef.src;
          holdImgEl.src = holdSrc;
          if (mHoldImgEl) mHoldImgEl.src = holdSrc;
        }
      }
    } else {
      gameState.previewActionCooldown -= dt;
      if (gameState.previewActionCooldown <= 0) {
        const useHold = gameState.holdTier !== null && Math.random() < 0.45;
        gameState.previewActionTarget = useHold ? 'hold' : 'next';
        gameState.previewActionTimer = 0.95;
        gameState.previewActionCooldown = 3.0 + Math.random() * 2.5;
        if (useHold && gameState.holdTier) {
          if (!holdIsWild) {
            const holdDef = TIERS[gameState.holdTier - 1];
            if (holdDef.actSrc) {
              holdImgEl.src = holdDef.actSrc;
              if (mHoldImgEl) mHoldImgEl.src = holdDef.actSrc;
            }
          }
          if (holdBubbleEl) holdBubbleEl.classList.add('is-acting');
          if (mHoldBubbleEl) mHoldBubbleEl.classList.add('is-acting');
        } else {
          if (!nextIsWild) {
            const nextDef = TIERS[gameState.nextTier - 1];
            if (nextDef.actSrc) {
              nextImgEl.src = nextDef.actSrc;
              if (mNextImgEl) mNextImgEl.src = nextDef.actSrc;
            }
          }
          if (nextBubbleEl) nextBubbleEl.classList.add('is-acting');
          if (mNextBoxEl) mNextBoxEl.classList.add('is-acting');
        }
      }
    }

    // 3. Advance active animations on entities inside the jar
    const entities = gameState.entities;
    let activeAnimCount = 0;
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.isWildcard) {
        e.anim = null;
        continue;
      }
      if (e.anim) {
        e.anim.t += dt;
        if (e.anim.t >= e.anim.dur) {
          e.anim = null;
        } else {
          activeAnimCount++;
        }
      }
    }

    // 4. Build map of touching/squeezed neighbors inside the jar
    const neighborMap = new Map();
    const addNeighborPair = (a, b, cx, cy) => {
      if (!a || !b || a.id === b.id || a.merged || b.merged || a.isWildcard || b.isWildcard) return;
      if (!neighborMap.has(a.id)) neighborMap.set(a.id, []);
      if (!neighborMap.has(b.id)) neighborMap.set(b.id, []);
      const listA = neighborMap.get(a.id);
      if (!listA.some((item) => item.neighbor.id === b.id)) {
        listA.push({ neighbor: b, cx, cy });
      }
      const listB = neighborMap.get(b.id);
      if (!listB.some((item) => item.neighbor.id === a.id)) {
        listB.push({ neighbor: a, cx, cy });
      }
    };

    const contacts = gameState.lastDebugContacts || [];
    for (let i = 0; i < contacts.length; i++) {
      const ct = contacts[i];
      if (ct.a && ct.a.id > 0 && ct.b && ct.b.id > 0) {
        addNeighborPair(ct.a, ct.b, ct.px, ct.py);
      }
    }

    for (let i = 0; i < entities.length; i++) {
      const a = entities[i];
      if (a.isWildcard) continue;
      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (b.isWildcard) continue;
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        if (dist <= (a.r + b.r) * 1.09 && dist > 1e-3) {
          const cx = (a.x * b.r + b.x * a.r) / (a.r + b.r);
          const cy = (a.y * b.r + b.y * a.r) / (a.r + b.r);
          addNeighborPair(a, b, cx, cy);
        }
      }
    }

    // 5. Trigger periodic Neighbor Squeeze Interactions & Solo Signature Actions
    const styles = ['nuzzle', 'boop', 'chat'];
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.anim || e.merged || e.isWildcard) continue;

      e.interactCooldown -= dt;
      e.soloCooldown -= dt;

      const settled = Math.hypot(e.vx, e.vy) < 75 && Math.abs(e.vr) < 2.4 && e.age > 0.35;
      if (!settled) continue;

      // Priority A: Squeezed neighbor interaction
      if (e.interactCooldown <= 0) {
        const nbs = neighborMap.get(e.id) || [];
        const available = nbs.filter(
          (item) =>
            !item.neighbor.anim &&
            !item.neighbor.merged &&
            !item.neighbor.isWildcard &&
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
          const dur = 1.25;

          e.anim = {
            kind: 'interact',
            style,
            t: 0,
            dur,
            partnerId: nb.id,
            ux,
            uy,
            cx: pick.cx,
            cy: pick.cy,
            isLeader: true
          };
          nb.anim = {
            kind: 'interact',
            style,
            t: 0,
            dur,
            partnerId: e.id,
            ux: -ux,
            uy: -uy,
            cx: pick.cx,
            cy: pick.cy,
            isLeader: false
          };

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

      // Priority B: Solo signature action
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
      gameState.dropSway *= Math.exp(-dt * 11);
      if (Math.abs(gameState.dropSway) < 0.001) gameState.dropSway = 0;

      if (gameState.comboTimer > 0) {
        gameState.comboTimer = Math.max(0, gameState.comboTimer - dt);
        if (gameState.comboTimer === 0) {
          gameState.comboCount = 0;
          gameState.comboRainbowGranted = false;
        }
      }
      if (gameState.jarShakeAmp > 0) {
        gameState.jarShakeAmp = Math.max(0, gameState.jarShakeAmp - dt * 1.9);
      }
      if (gameState.skipCooldown > 0) {
        gameState.skipCooldown = Math.max(0, gameState.skipCooldown - dt);
        const isCooling = gameState.skipCooldown > 0;
        const skipTxt = isCooling ? `冷却 ${Math.ceil(gameState.skipCooldown)}s` : '换一单';
        btnSkipOrder.disabled = isCooling;
        btnSkipOrder.textContent = skipTxt;
        if (mBtnSkipOrder) {
          mBtnSkipOrder.disabled = isCooling;
          mBtnSkipOrder.textContent = skipTxt;
        }
      }

      if (gameState.feverTimer > 0) {
        gameState.feverTimer = Math.max(0, gameState.feverTimer - dt);
        if (gameState.feverTimer === 0) {
          gameState.feverEnergy = 0;
          gameState.feverBonusUsed = 0;
          audio.setFeverMode(false);
          if (cafeStageEl) cafeStageEl.classList.remove('is-fever');
          showToast('🌙 星光磁吸狂热结束，继续连合积攒能量吧！');
        }
        updateHUD();
      }

      // Micro-hitstop freezes rigid bodies for 2~4 punchy frames on big merges/crits while FX keep blooming
      if (gameState.hitstopTimer > 0) {
        gameState.hitstopTimer = Math.max(0, gameState.hitstopTimer - dt);
      } else {
        stepPhysics(dt);
      }
      updateDessertAnimations(dt);
    }

    // Decay screen shake & impact flash smoothly
    if (gameState.screenShake > 0) {
      gameState.screenShake *= Math.exp(-dt * 16);
      if (gameState.screenShake < 0.08) gameState.screenShake = 0;
    }
    if (gameState.jarFlash > 0) {
      gameState.jarFlash = Math.max(0, gameState.jarFlash - dt * 2.4);
    }

    // Update expanding shockwave rings & combo banner
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

    // Smooth score counter animation
    if (gameState.displayScore < gameState.score) {
      const diff = gameState.score - gameState.displayScore;
      gameState.displayScore += Math.max(1, Math.ceil(diff * Math.min(1, dt * 14)));
      scoreEl.textContent = String(gameState.displayScore);
    } else {
      scoreEl.textContent = String(gameState.score);
    }
    if (mScoreEl) mScoreEl.textContent = scoreEl.textContent;

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
      if (target.isWildcard || target.tier > 4) {
        showToast('🫧 泡泡叉只能消除 1~4 阶普通甜品哦！');
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
      updateHUD();
      return;
    }

    if (gameState.activeToolMode === 'spoon') {
      if (target.isWildcard) {
        showToast('🌈 彩虹万能糖碰到任意甜品就会自动升阶，无需升阶勺哦！');
        return;
      }
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

      const pts = Math.round(def.points * getFeverMultiplier());
      addScore(pts);
      unlockTier(nextTier);
      audio.playTool('spoon');
      spawnSparkleBurst(target.x, target.y, '#ffe16e', 22);
      spawnShockwave(target.x, target.y, target.r * 2.0, '#ffe16e', 3.4);
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
    if (!gameState.running || gameState.over || gameState.paused) return;
    const pt = canvasCoordsFromEvent(ev);
    if (gameState.activeToolMode) {
      const hit = findEntityAt(pt.x, pt.y);
      gameState.hoveredEntityId = hit ? hit.id : null;
      return;
    }
    if (ev.pointerType === 'touch' && gameState.touchAim.active) {
      gameState.touchAim.cancelled = pt.y < JAR.neckY - 22;
      updateDropPointerX(pt.x);
      gameState.touchAim.lastStableX = gameState.dropX;
      return;
    }
    updateDropPointerX(pt.x);
  });

  canvas.addEventListener('pointerdown', (ev) => {
    if (!gameState.running || gameState.over || gameState.paused) return;
    audio.ensureCtx();
    const pt = canvasCoordsFromEvent(ev);
    if (gameState.activeToolMode) {
      toolConsumedPointer = true;
      handleToolCanvasClick(pt.x, pt.y);
      return;
    }
    toolConsumedPointer = false;
    updateDropPointerX(pt.x);
    if (ev.pointerType === 'touch') {
      gameState.touchAim.active = true;
      gameState.touchAim.cancelled = pt.y < JAR.neckY - 22;
      gameState.touchAim.lastStableX = gameState.dropX;
    }
  });

  function clearTouchAim() {
    gameState.touchAim.active = false;
    gameState.touchAim.cancelled = false;
  }

  canvas.addEventListener('pointerup', (ev) => {
    if (toolConsumedPointer) {
      toolConsumedPointer = false;
      clearTouchAim();
      return;
    }
    if (!gameState.running || gameState.over || gameState.paused) {
      clearTouchAim();
      return;
    }
    if (gameState.activeToolMode) {
      clearTouchAim();
      return;
    }
    const pt = canvasCoordsFromEvent(ev);
    if (ev.pointerType === 'touch' && gameState.touchAim.active) {
      const cancelled = gameState.touchAim.cancelled || pt.y < JAR.neckY - 22;
      // Ignore tiny lift-off skin-roll jitter (< 10px) so touch drops stay laser-accurate
      const targetX =
        Math.abs(pt.x - gameState.touchAim.lastStableX) <= 10 ? gameState.touchAim.lastStableX : pt.x;
      clearTouchAim();
      if (cancelled) return;
      updateDropPointerX(targetX);
      dropCurrentTreat();
      return;
    }
    clearTouchAim();
    updateDropPointerX(pt.x);
    dropCurrentTreat();
  });

  canvas.addEventListener('pointercancel', clearTouchAim);

  canvas.addEventListener(
    'wheel',
    (ev) => {
      if (!gameState.running || gameState.over || gameState.paused || gameState.activeToolMode) return;
      ev.preventDefault();
      adjustAimAngle(ev.deltaY > 0 ? 0.14 : -0.14);
    },
    { passive: false }
  );

  function toggleDebugPhysics(forceVal) {
    if (blessingModal.classList.contains('is-open')) closeBlessingModal(true);
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
    if (ev.key === 'm' || ev.key === 'M') {
      ev.preventDefault();
      audio.ensureCtx();
      const on = audio.toggleBGM();
      saveData.bgmTrack = audio.bgmTrack;
      persistSaveData();
      syncAudioButtons();
      const info = audio.getTrackInfo();
      showToast(on ? `🎵 背景音乐已开启：${info.title}` : '🔇 背景音乐已关闭');
      return;
    }
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
    if (blessingModal.classList.contains('is-open')) {
      if (ev.key === '1' || ev.key === '2' || ev.key === '3') {
        const choice = gameState.blessingChoices[Number(ev.key) - 1];
        if (choice) {
          ev.preventDefault();
          applyBlessing(choice.id);
        }
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        closeBlessingModal(true);
      }
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
    } else if (ev.key === 'b' || ev.key === 'B') {
      if (gameState.pendingBlessings > 0) {
        ev.preventDefault();
        openBlessingModal();
      }
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
    if (blessingModal.classList.contains('is-open')) closeBlessingModal(true);
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
    syncAudioMood();
  }

  function closeCompendium() {
    compendiumModal.classList.remove('is-open');
    syncAudioMood();
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
    gameState.feverMaxDuration = 10.0;
    gameState.feverBonusUsed = 0;
    gameState.comboCount = 0;
    gameState.comboTimer = 0;
    gameState.comboRainbowGranted = false;
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
    gameState.magnetLinks = [];
    gameState.perks = {};
    gameState.pendingBlessings = 0;
    gameState.blessingChoices = [];
    gameState.blessingLastReason = '';
    gameState.blessingLockUntil = 0;
    if (blessingReadyBtn) {
      blessingReadyBtn.classList.remove('is-fresh');
      delete blessingReadyBtn.dataset.count;
    }
    gameState.zenNextMilestone = 500;
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
    gameState.dangerDuration = 0;
    gameState.jarShakeAmp = 0;
    gameState.entities = [];
    gameState.particles = [];
    gameState.popups = [];
    gameState.skipCooldown = 0;
    btnSkipOrder.disabled = false;
    btnSkipOrder.textContent = '换一单';
    if (mBtnSkipOrder) {
      mBtnSkipOrder.disabled = false;
      mBtnSkipOrder.textContent = '换一单';
    }

    cancelToolMode();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    if (cafeStageEl) cafeStageEl.classList.remove('is-fever');
    blessingModal.classList.remove('is-open');
    titleModal.classList.remove('is-open');
    gameoverModal.classList.remove('is-open');
    syncAudioMood();
    audio.unlock();

    if (mode === 'chef') {
      generateOrder();
    } else {
      gameState.order = null;
      setPatronSpeech(PATRONS[0], '悠闲经典模式开启！每达成积分里程碑可抽取三选一星夜秘方祝福哦～', 5.0);
      renderOrder();
    }

    updateEvolutionRing();
    updateHUD();
  }

  // Unlock Web Audio & smoothly start cozy café BGM on the player's first gesture
  // (iOS Safari / mobile WebViews require touchend or click; pointerdown alone is ignored)
  function handleAudioGestureUnlock(ev) {
    if (ev && ev.target && ev.target.closest && ev.target.closest('#btn-bgm')) return;
    audio.unlock();
  }
  window.addEventListener('pointerdown', handleAudioGestureUnlock, { passive: true });
  window.addEventListener('touchend', handleAudioGestureUnlock, { passive: true });
  window.addEventListener('click', handleAudioGestureUnlock, { passive: true });
  window.addEventListener('keydown', handleAudioGestureUnlock, { passive: true });
  window.addEventListener('pageshow', () => {
    if (!document.hidden) audio.setTabHidden(false);
  });
  document.addEventListener('visibilitychange', () => {
    audio.setTabHidden(document.hidden);
  });

  // Prevent iOS Safari pinch-to-zoom and accidental double-tap browser zoom on rapid tool clicks
  document.addEventListener('gesturestart', (ev) => ev.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (ev) => ev.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (ev) => ev.preventDefault(), { passive: false });

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
    audio.playStartCafe();
  });

  btnPlayAgain.addEventListener('click', () => {
    audio.ensureCtx();
    startNewRun(gameState.mode);
    audio.playStartCafe();
  });

  btnRestart.addEventListener('click', () => {
    if (!gameState.running && titleModal.classList.contains('is-open')) return;
    audio.ensureCtx();
    startNewRun(gameState.mode);
    audio.playStartCafe();
    showToast('🔄 已重新开启新一轮营业！');
  });

  holdBubbleEl.addEventListener('click', swapHoldPocket);
  if (mHoldBubbleEl) mHoldBubbleEl.addEventListener('click', swapHoldPocket);
  btnToolShake.addEventListener('click', () => armOrUseTool('shake'));
  btnToolFork.addEventListener('click', () => armOrUseTool('fork'));
  btnToolSpoon.addEventListener('click', () => armOrUseTool('spoon'));
  btnCancelTarget.addEventListener('click', cancelToolMode);

  if (blessingReadyBtn) {
    blessingReadyBtn.addEventListener('click', openBlessingModal);
  }
  if (btnDeferBlessing) {
    btnDeferBlessing.addEventListener('click', () => closeBlessingModal(true));
  }
  if (blessingModal) {
    blessingModal.addEventListener('click', (ev) => {
      if (ev.target === blessingModal) closeBlessingModal(true);
    });
  }

  btnSkipOrder.addEventListener('click', () => {
    if (gameState.skipCooldown > 0 || gameState.mode !== 'chef') return;
    gameState.skipCooldown = 25;
    showToast('📋 已为顾客更换新的星夜心愿单！');
    generateOrder();
  });
  if (mBtnSkipOrder) mBtnSkipOrder.addEventListener('click', () => btnSkipOrder.click());

  if (btnDebugPhys) {
    btnDebugPhys.addEventListener('click', () => toggleDebugPhysics());
  }

  btnSfx.addEventListener('click', () => {
    audio.ensureCtx();
    const nextEnabled = !audio.sfxEnabled;
    audio.setSfxEnabled(nextEnabled);
    saveData.sfxEnabled = nextEnabled;
    persistSaveData();
    syncAudioButtons();
    showToast(nextEnabled ? '🔊 游戏音效已开启' : '🔇 游戏音效已关闭');
  });

  btnBgm.addEventListener('click', () => {
    audio.ensureCtx();
    audio.cycleBGMTrack();
    saveData.bgmTrack = audio.bgmTrack;
    persistSaveData();
    syncAudioButtons();
    const info = audio.getTrackInfo();
    if (info.id === 'off') {
      showToast('🔇 背景音乐已关闭（可随时点击或按 M 重新开启）');
    } else {
      showToast(`🎵 当前背景音乐：${info.title}`);
    }
  });

  btnCompendium.addEventListener('click', openCompendium);
  btnCloseComp.addEventListener('click', closeCompendium);
  compendiumModal.addEventListener('click', (ev) => {
    if (ev.target === compendiumModal) closeCompendium();
  });

  // Inspection hook for automated E2E physics & 2.0 feature verification
  window.__HOSHI_DEBUG__ = {
    getState: () => ({
      running: gameState.running,
      paused: gameState.paused,
      over: gameState.over,
      score: gameState.score,
      stardust: gameState.stardust,
      feverEnergy: +gameState.feverEnergy.toFixed(1),
      feverTimer: +gameState.feverTimer.toFixed(2),
      comboCount: gameState.comboCount,
      maxCombo: gameState.maxCombo,
      perks: { ...gameState.perks },
      pendingBlessings: gameState.pendingBlessings,
      blessingModalOpen: blessingModal.classList.contains('is-open'),
      dropsUntilRainbow: gameState.dropsUntilRainbow,
      curTier: gameState.curTier,
      curMeta: { ...gameState.curMeta },
      nextMeta: { ...gameState.nextMeta },
      debugPhysics: gameState.debugPhysics,
      aimAngle: gameState.aimAngle,
      contactCount: gameState.lastDebugContacts.length,
      magnetLinkCount: gameState.magnetLinks.length,
      entities: gameState.entities.map((e) => ({
        id: e.id,
        tier: e.tier,
        isWildcard: !!e.isWildcard,
        isGolden: !!e.isGolden,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        angle: +e.angle.toFixed(3),
        vx: +e.vx.toFixed(2),
        vy: +e.vy.toFixed(2),
        vr: +e.vr.toFixed(3),
        polyCount: e.worldPolys ? e.worldPolys.length : 0
      }))
    }),
    getAudioState: () => audio.getDebugState(),
    togglePhysicsDebug: (val) => toggleDebugPhysics(val),
    setCurTier: (tier) => {
      gameState.curTier = Math.max(1, Math.min(9, tier));
      gameState.curMeta = { wildcard: false, golden: false };
      clampDropX();
      updateHUD();
    },
    setAimAngle: (rad) => {
      gameState.aimAngle = Math.max(-0.78, Math.min(0.78, rad));
      clampDropX();
    },
    spawnTestBody: (tier, x, y, angle = 0) => createEntity(tier, x, y, 0, 20, false, angle, 0),
    spawnSpecialBody: (tier, x, y, opts = {}) => createEntity(tier, x, y, 0, 20, false, 0, 0, opts),
    grantRainbow: () => {
      gameState.curTier = 2;
      gameState.curMeta = { wildcard: true, golden: false };
      clampDropX();
      updateHUD();
    },
    setCurGolden: (tier = 2) => {
      gameState.curTier = Math.max(1, Math.min(9, tier));
      gameState.curMeta = { wildcard: false, golden: true };
      clampDropX();
      updateHUD();
    },
    triggerFever: () => {
      addFeverEnergy(100);
      updateHUD();
    },
    queueBlessing: (reason = '测试秘方') => {
      queueBlessing(reason);
    },
    openBlessing: () => {
      if (gameState.pendingBlessings <= 0) gameState.pendingBlessings = 1;
      openBlessingModal();
    }
  };

  // Boot Sequence
  syncAudioButtons();
  syncAudioMood();
  resizeCanvases();
  loadSprites().then(() => {
    buildEvolutionRing();
    updateHUD();
    requestAnimationFrame(mainLoop);
  });
})();
