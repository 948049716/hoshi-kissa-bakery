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

  const YARN_BALL_RADIUS = 21;
  const YARN_BALL_SRC = 'assets/processed/event_yarn_ball.webp';
  const SHOP_SIGN_SRC = 'assets/processed/icon_shop_sign.webp';

  const PATRONS = [
    {
      id: 'mikan',
      name: '店长 · 小蜜柑',
      shortName: '小蜜柑',
      badge: '🧁',
      cost: 0,
      type: 'img',
      src: 'assets/processed/chef_mikan.webp',
      skillName: '招牌经营',
      passiveDesc: '所有订单积分与星尘 +20%，每局开局额外赠送 +1 泡泡叉',
      shortPassive: '订单+20% · 叉+1',
      greet: '刚出炉的星光面糊好香呀～请帮我准备这几份甜点吧！',
      thanks: '太棒啦！香气飘满整条月光街道了呢～',
      idleLines: [
        '欢迎回到星夜吃茶！今晚也要烤出香喷喷的猫神舒芙蕾哦～',
        '喵呜～用小铺的暖炉预热天赋，一开局就能更快进入星光狂热！',
        '悄悄告诉你：把同阶甜点靠得近一点，甜蜜星磁会帮它们亲密合体哦！',
        '如果罐子里滚进了毛线球，在它附近合成两次就能砰地爆出大礼！'
      ]
    },
    {
      id: 'luna',
      name: '常客 · 眠眠星兔',
      shortName: '眠眠星兔',
      badge: '🌙',
      cost: 60,
      type: 'img',
      src: 'assets/processed/patron_luna.webp',
      skillName: '星月睡意',
      passiveDesc: '彩虹万能糖保底 -2 步，狂热持续 +2.0s，开局自带 Lv.1 甜蜜星磁',
      shortPassive: '彩虹-2步 · 磁吸Lv1',
      greet: '唔…今晚的月亮好圆，好想吃软绵绵的甜点呀…',
      thanks: '哇啊！吃到幸福的味道了，谢谢主厨！',
      idleLines: [
        '呼啊～带我一起营业的话，彩虹万能糖会更常来拜访你哦…',
        '在月光下摇晃玻璃罐，好像看着星星在罐子里打盹呢…',
        '90 秒狂欢模式里，我的狂热延长时间超好用哦，冲呀～',
        '软绵绵的棉花糖云朵…嗯？我没睡着，在帮你吸引同阶甜点啦！'
      ]
    },
    {
      id: 'mugi',
      name: '面包迷 · 蜂蜜柴柴',
      shortName: '蜂蜜柴柴',
      badge: '🍯',
      cost: 100,
      type: 'img',
      src: 'assets/processed/patron_mugi.webp',
      skillName: '元气暴冲',
      passiveDesc: '≥4阶合成星爆冲击波 +30%；每段 ≥3 连击额外回 +4⭐（90秒模式转为 +60 分）',
      shortPassive: '气浪+30% · 连击回尘',
      greet: '汪呜！我闻着焦糖与奶香找过来了，拜托做这份套餐！',
      thanks: '太满足啦！下次我还要带朋友们一起来！',
      idleLines: [
        '汪呜！！今晚火力全开，用大冲击波把甜点全滚成多米诺大连锁吧！',
        '3 连击以上就能不断赚星尘与冲榜加分，手速越快越爽快！',
        '看见调皮毛线球就瞄准旁边猛猛合成，一举引爆它！',
        '刚出炉的焦糖甜甜圈最香了！选 90 秒狂欢一起冲高分榜吧！'
      ]
    }
  ];

  const SHOP_UPGRADES = [
    {
      id: 'up_tools',
      icon: '🧰',
      name: '备货充沛',
      costs: [40, 90, 160],
      maxLv: 3,
      shortTag: (lv) => `备货Lv.${lv}`,
      desc: (lv) => {
        if (lv === 0) return '下级效果：每局开局「摇一摇」道具 +1';
        if (lv === 1) return '当前：开局 摇+1 · 下级：摇+1 且 泡泡叉+1';
        if (lv === 2) return '当前：开局 摇+1 叉+1 · 下级：全道具各 +1';
        return '已满级：每局开局 摇一摇+1 · 泡泡叉+1 · 升阶勺+1！';
      }
    },
    {
      id: 'up_fever',
      icon: '🔥',
      name: '暖炉预热',
      costs: [50, 100, 180],
      values: [0, 18, 32, 48],
      maxLv: 3,
      shortTag: (lv) => `暖炉Lv.${lv}`,
      desc: (lv) => {
        const vals = [0, 18, 32, 48];
        if (lv === 0) return '下级效果：开局星光能量槽自带 18% 初始能量';
        if (lv < 3) return `当前：开局自带 ${vals[lv]}% 能量 · 下级提升至 ${vals[lv + 1]}%`;
        return '已满级：每局开局自带 48% 星光能量，极速开启首次狂热！';
      }
    },
    {
      id: 'up_combo',
      icon: '⏱️',
      name: '节奏节拍器',
      costs: [60, 120, 200],
      values: [0, 0.18, 0.36, 0.55],
      maxLv: 3,
      shortTag: (lv) => `节拍Lv.${lv}`,
      desc: (lv) => {
        const vals = [0, 0.18, 0.36, 0.55];
        if (lv === 0) return '下级效果：全局基础连击判定窗口延长 +0.18 秒';
        if (lv < 3) return `当前：连击窗口 +${vals[lv].toFixed(2)}s · 下级提升至 +${vals[lv + 1].toFixed(2)}s`;
        return '已满级：全局基础连击判定窗口永久延长 +0.55 秒！';
      }
    },
    {
      id: 'up_dust',
      icon: '✨',
      name: '星尘糖霜壶',
      costs: [45, 95, 170],
      mults: [1, 1.15, 1.3, 1.5],
      maxLv: 3,
      shortTag: (lv) => `糖霜Lv.${lv}`,
      desc: (lv) => {
        const pcts = [0, 15, 30, 50];
        if (lv === 0) return '下级效果：局内星尘与打烊永久星尘收益 +15%';
        if (lv < 3) return `当前：星尘收益 +${pcts[lv]}% · 下级提升至 +${pcts[lv + 1]}%`;
        return '已满级：局内与打烊结算永久星尘收益全面 +50%！';
      }
    }
  ];

  const JAR_THEMES = {
    amber: {
      id: 'amber',
      icon: '🍯',
      name: '经典星夜琥珀罐',
      cost: 0,
      desc: '暖金黄铜领口 + 深茶蓝星夜玻璃质感 + 暖金星光引导线。',
      collar: ['#ffe495', '#d59c3b', '#8c5a18'],
      collarHighlight: 'rgba(255, 250, 220, 0.72)',
      glassTop: 'rgba(170, 225, 238, 0.14)',
      glassMid: 'rgba(22, 60, 74, 0.24)',
      glassBot: 'rgba(255, 228, 175, 0.14)',
      rimGlow: 'rgba(255, 244, 214, 0.35)',
      guideLine: 'rgba(255, 224, 132, 0.62)',
      guideTouch: 'rgba(255, 232, 152, 0.88)',
      lockColor: [255, 228, 102],
      moteKind: 'star',
      moteColor: 'rgba(255, 236, 178, 0.28)',
      ambientRgb: '255, 232, 148'
    },
    sakura: {
      id: 'sakura',
      icon: '🌸',
      name: '樱花琉璃罐',
      cost: 80,
      desc: '玫瑰金樱粉金属领口 + 暮樱透光渐变玻璃 + 飘落樱花瓣与樱粉锁定光环。',
      collar: ['#ffd1e1', '#df86a5', '#b05675'],
      collarHighlight: 'rgba(255, 238, 246, 0.82)',
      glassTop: 'rgba(255, 206, 224, 0.2)',
      glassMid: 'rgba(98, 42, 68, 0.24)',
      glassBot: 'rgba(255, 186, 212, 0.2)',
      rimGlow: 'rgba(255, 198, 220, 0.48)',
      guideLine: 'rgba(255, 182, 212, 0.72)',
      guideTouch: 'rgba(255, 198, 224, 0.92)',
      lockColor: [255, 162, 206],
      moteKind: 'petal',
      moteColor: 'rgba(255, 192, 218, 0.45)',
      ambientRgb: '255, 186, 214'
    },
    moonlight: {
      id: 'moonlight',
      icon: '🌊',
      name: '深海月光瓶',
      cost: 120,
      desc: '秘银月白金属领口 + 冰海青蓝折射玻璃 + 荧光海星光点与冷月蓝锁定框。',
      collar: ['#e6f7ff', '#87bddb', '#48779c'],
      collarHighlight: 'rgba(240, 252, 255, 0.85)',
      glassTop: 'rgba(164, 234, 255, 0.18)',
      glassMid: 'rgba(16, 54, 86, 0.28)',
      glassBot: 'rgba(128, 220, 255, 0.18)',
      rimGlow: 'rgba(166, 232, 255, 0.46)',
      guideLine: 'rgba(148, 226, 255, 0.72)',
      guideTouch: 'rgba(182, 240, 255, 0.92)',
      lockColor: [132, 226, 255],
      moteKind: 'starfish',
      moteColor: 'rgba(154, 236, 255, 0.42)',
      ambientRgb: '150, 228, 255'
    }
  };
  const JAR_THEME_LIST = [JAR_THEMES.amber, JAR_THEMES.sakura, JAR_THEMES.moonlight];

  const ACHIEVEMENTS = [
    {
      id: 'first_run',
      tierImg: 1,
      name: '初开夜灯',
      desc: '完成至少 1 局星夜营业',
      check: (s) => (s.lifetimeStats.runsPlayed || 0) >= 1
    },
    {
      id: 'combo_4',
      tierImg: 3,
      name: '多米诺乐手',
      desc: '单局达成 4 连合以上',
      check: (s) => (s.lifetimeStats.maxComboEver || 1) >= 4
    },
    {
      id: 'yarn_3',
      tierImg: 5,
      name: '线团克星',
      desc: '累计震碎 3 颗捣蛋毛线球',
      check: (s) => (s.lifetimeStats.yarnBroken || 0) >= 3
    },
    {
      id: 'rush_3000',
      tierImg: 6,
      name: '90秒狂欢王',
      desc: '90秒狂欢模式突破 3,000 分',
      check: (s) => (s.bestRush || 0) >= 3000
    },
    {
      id: 'souffle_1',
      tierImg: 9,
      name: '猫神降临',
      desc: '合出 9 阶【星冠猫神舒芙蕾】',
      check: (s) => (s.lifetimeStats.soufflesMade || 0) >= 1 || s.unlockedTiers.includes(9)
    },
    {
      id: 'comp_all',
      tierImg: 7,
      name: '全品收藏家',
      desc: '甜品图鉴全部解锁 (9/9)',
      check: (s) => s.unlockedTiers.length >= 9
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
  const lobbyScreenEl = document.getElementById('lobby-screen');
  const playScreenEl = document.getElementById('play-screen');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const ambientCanvas = document.getElementById('ambient-canvas');
  const ambientCtx = ambientCanvas.getContext('2d');

  // Lobby DOM
  const lobbyRankBadgeEl = document.getElementById('lobby-rank-badge');
  const lobbyBankValueEl = document.getElementById('lobby-bank-value');
  const btnLobbyBank = document.getElementById('btn-lobby-bank');
  const btnLobbyBgm = document.getElementById('btn-lobby-bgm');
  const btnLobbySfx = document.getElementById('btn-lobby-sfx');
  const btnLobbyCompendium = document.getElementById('btn-lobby-compendium');
  const btnLobbyCompM = document.getElementById('btn-lobby-comp-m');
  const btnLobbyHelp = document.getElementById('btn-lobby-help');
  const lobbyPatronPortraitBtn = document.getElementById('lobby-patron-portrait');
  const lobbyPatronImgEl = document.getElementById('lobby-patron-img');
  const lobbyPatronNameEl = document.getElementById('lobby-patron-name');
  const lobbyPatronSkillNameEl = document.getElementById('lobby-patron-skill-name');
  const lobbyPatronSpeechEl = document.getElementById('lobby-patron-speech');
  const lobbyPatronPassiveEl = document.getElementById('lobby-patron-passive');
  const lobbyPatronStripEl = document.getElementById('lobby-patron-strip');
  const modeSelectEl = document.getElementById('mode-select');
  const modeBestChefEl = document.getElementById('mode-best-chef');
  const modeBestRushEl = document.getElementById('mode-best-rush');
  const modeBestZenEl = document.getElementById('mode-best-zen');
  const lobbyShopPreviewBtn = document.getElementById('lobby-shop-preview');
  const lobbyThemeTagEl = document.getElementById('lobby-theme-tag');
  const lobbyTalentsSummaryEl = document.getElementById('lobby-talents-summary');
  const btnStartGame = document.getElementById('btn-start-game');
  const btnOpenShop = document.getElementById('btn-open-shop');
  const shopRedDotEl = document.getElementById('shop-red-dot');
  const btnOpenCareer = document.getElementById('btn-open-career');

  // Play Screen DOM
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

  const rushInfoBoxEl = document.getElementById('rush-info-box');
  const rushClockValEl = document.getElementById('rush-clock-val');
  const rushMilestoneLineEl = document.getElementById('rush-milestone-line');
  const zenInfoBoxEl = document.getElementById('zen-info-box');
  const zenMilestoneLineEl = document.getElementById('zen-milestone-line');

  const jarRushPillEl = document.getElementById('jar-rush-pill');
  const jarRushTimeEl = document.getElementById('jar-rush-time');
  const eventBannerEl = document.getElementById('event-banner');
  const eventBannerIconEl = document.getElementById('event-banner-icon');
  const eventBannerTitleEl = document.getElementById('event-banner-title');
  const eventBannerMetaEl = document.getElementById('event-banner-meta');

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
  const mRushBarEl = document.getElementById('m-rush-bar');
  const mRushTimerEl = document.getElementById('m-rush-timer');
  const mRushMilestoneEl = document.getElementById('m-rush-milestone');
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

  const btnBackLobby = document.getElementById('btn-back-lobby');
  const btnDebugPhys = document.getElementById('btn-debug-phys');
  const btnBgm = document.getElementById('btn-bgm');
  const btnSfx = document.getElementById('btn-sfx');
  const btnCompendium = document.getElementById('btn-compendium');
  const btnRestart = document.getElementById('btn-restart');

  // Modals DOM
  const shopModal = document.getElementById('shop-modal');
  const shopBankValueEl = document.getElementById('shop-bank-value');
  const shopTabsEl = document.getElementById('shop-tabs');
  const shopBodyEl = document.getElementById('shop-body');
  const btnCloseShop = document.getElementById('btn-close-shop');

  const careerModal = document.getElementById('career-modal');
  const careerRankTextEl = document.getElementById('career-rank-text');
  const careerModesRowEl = document.getElementById('career-modes-row');
  const careerStatsGridEl = document.getElementById('career-stats-grid');
  const careerAchGridEl = document.getElementById('career-ach-grid');
  const btnCloseCareer = document.getElementById('btn-close-career');

  const helpModal = document.getElementById('help-modal');
  const btnCloseHelp = document.getElementById('btn-close-help');

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
  const goHeadingEl = document.getElementById('go-heading');
  const goScoreEl = document.getElementById('go-score');
  const goBestEl = document.getElementById('go-best');
  const goNewBestEl = document.getElementById('go-new-best');
  const goMaxTierEl = document.getElementById('go-max-tier');
  const goFourthLabelEl = document.getElementById('go-fourth-label');
  const goFourthValEl = document.getElementById('go-fourth-val');
  const goOrdersEl = document.getElementById('go-orders');
  const goComboEl = document.getElementById('go-combo');
  const goRankEl = document.getElementById('go-rank');
  const goBankEarnedEl = document.getElementById('go-bank-earned');
  const goBankDetailEl = document.getElementById('go-bank-detail');
  const goBankShopHintEl = document.getElementById('go-bank-shop-hint');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const btnGoLobby = document.getElementById('btn-go-lobby');

  const toastBannerEl = document.getElementById('toast-banner');

  const audio = new window.StarlightAudio();

  // Persistent Player Save Data (3.0 backward-compatible migration)
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
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
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

        // Returning 2.x player migration gift (>= 60 ⭐ welcome bank fund)
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
    } catch (_) {}
    return defaults;
  }

  function persistSaveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    } catch (_) {}
  }

  function getSelectedPatron() {
    return PATRONS.find((p) => p.id === saveData.selectedPatron) || PATRONS[0];
  }

  function getEquippedTheme() {
    return JAR_THEMES[saveData.equippedTheme] || JAR_THEMES.amber;
  }

  function getUpgradeLevel(id) {
    return (saveData.shopUpgrades && saveData.shopUpgrades[id]) || 0;
  }

  function getDustMultiplier() {
    const lv = getUpgradeLevel('up_dust');
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
      const lv = getUpgradeLevel(up.id);
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

  // Apply persisted audio preferences (BGM starts enabled by default on first user gesture)
  audio.bgmTrack = saveData.bgmTrack;
  audio.bgmEnabled = saveData.bgmTrack !== 'off';
  audio.setSfxEnabled(saveData.sfxEnabled);

  function syncAudioButtons() {
    const info = audio.getTrackInfo();
    const bgmShort = info.id === 'off' ? '关' : info.id === 'bossa' ? '爵士' : '圆舞曲';
    const bgmIcon = info.id === 'bossa' ? '☕' : '🎵';
    const bgmHtml = `${bgmIcon} <span class="m-hide-text">${bgmShort}</span>`;
    const bgmTitle = `背景音乐：${info.title} · 点击切换曲目或关闭 (圆舞曲 → 吃茶爵士 → 关，快捷键 M)`;
    if (btnBgm) {
      btnBgm.innerHTML = `${bgmIcon} ${bgmShort}`;
      btnBgm.classList.toggle('is-active', audio.bgmEnabled);
      btnBgm.title = bgmTitle;
    }
    if (btnLobbyBgm) {
      btnLobbyBgm.innerHTML = bgmHtml;
      btnLobbyBgm.classList.toggle('is-active', audio.bgmEnabled);
      btnLobbyBgm.title = bgmTitle;
    }

    const sfxHtml = audio.sfxEnabled
      ? '🔊<span class="m-hide-text"> 音效: 开</span>'
      : '🔇<span class="m-hide-text"> 音效: 关</span>';
    if (btnSfx) btnSfx.innerHTML = sfxHtml;
    if (btnLobbySfx) btnLobbySfx.innerHTML = sfxHtml;
  }

  function isLobbyOpen() {
    return lobbyScreenEl && lobbyScreenEl.classList.contains('is-active');
  }

  function syncAudioMood() {
    const overlayOpen =
      isLobbyOpen() ||
      shopModal.classList.contains('is-open') ||
      careerModal.classList.contains('is-open') ||
      helpModal.classList.contains('is-open') ||
      blessingModal.classList.contains('is-open') ||
      compendiumModal.classList.contains('is-open') ||
      gameoverModal.classList.contains('is-open');
    audio.setMuffled(overlayOpen);
  }

  // Preload all base, solo-action, neighbor-interaction, and Plan B sprite images cleanly
  const spriteImages = {};
  const spriteActionImages = {};
  const spriteInteractImages = {};
  let yarnBallImage = null;
  let assetsReady = false;
  function loadSprites() {
    const loadOne = (url, onLoad) =>
      new Promise((resolve) => {
        if (!url) {
          resolve();
          return;
        }
        const img = new Image();
        img.onload = () => {
          onLoad(img);
          resolve();
        };
        img.onerror = resolve;
        img.src = url;
      });

    const promises = [];
    for (const t of TIERS) {
      promises.push(loadOne(t.src, (img) => (spriteImages[t.tier] = img)));
      promises.push(loadOne(t.actSrc, (img) => (spriteActionImages[t.tier] = img)));
      promises.push(loadOne(t.intSrc, (img) => (spriteInteractImages[t.tier] = img)));
    }
    promises.push(loadOne(YARN_BALL_SRC, (img) => (yarnBallImage = img)));
    return Promise.all(promises).then(() => {
      assetsReady = true;
    });
  }

  // Game State
  let gameState = {
    mode: 'chef', // 'chef' | 'rush' | 'zen'
    running: false,
    paused: false,
    over: false,
    score: 0,
    displayScore: 0,
    stardust: 30,
    dropsMadeThisRun: 0,
    soufflesMadeThisRun: 0,
    yarnBrokenThisRun: 0,
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
    // 90s Rush Mode State
    rushTimer: 90.0,
    rushFinished: false,
    rushGustCooldown: 0,
    rushNextMilestone: 1800,
    rushLastTickSec: 6,
    // Shop Events State
    activeEvent: null, // { kind: 'meteor'|'yarn'|'chime', timer, maxTimer }
    lastEventKind: null,
    nextEventDrops: 24,
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
    speechTimer: 0
  };

  let activeShopTab = 'upgrades';
  let lobbySpeechIndex = 0;

  // Ambient Fireflies / Sakura Petals / Moonlit Orbs
  const fireflies = Array.from({ length: 30 }, () => ({
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
    toastTimeout = setTimeout(() => toastBannerEl.classList.remove('visible'), 2300);
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

  // Perk, Patron & Special Drop Helpers
  function getPerkLevel(id) {
    return gameState.perks[id] || 0;
  }

  function getEffectiveMagnetLevel() {
    const base = getPerkLevel('magnet');
    const lunaBonus = saveData.selectedPatron === 'luna' ? 1 : 0;
    return Math.min(4, base + lunaBonus);
  }

  function getRainbowPityBase() {
    const modeBase = gameState.mode === 'rush' ? 8 : 12;
    const lunaBonus = saveData.selectedPatron === 'luna' ? 2 : 0;
    return Math.max(4, modeBase - lunaBonus - getPerkLevel('rainbow') * 2);
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
    let goldenChance = 0.09 + goldenLv * 0.1 + (gameState.feverTimer > 0 && goldenLv > 0 ? 0.12 : 0);
    if (gameState.meteorGoldenLeft > 0) {
      gameState.meteorGoldenLeft--;
      goldenChance = Math.max(goldenChance, 0.75);
    }
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
    if (isLobbyOpen() || gameoverModal.classList.contains('is-open')) return;
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

  function getBestScore(mode = gameState.mode) {
    if (mode === 'rush') return saveData.bestRush || 0;
    if (mode === 'zen') return saveData.bestZen || 0;
    return saveData.bestChef || 0;
  }

  function setBestScore(val, mode = gameState.mode) {
    if (mode === 'rush') {
      saveData.bestRush = Math.max(saveData.bestRush || 0, val);
    } else if (mode === 'zen') {
      saveData.bestZen = Math.max(saveData.bestZen || 0, val);
    } else {
      saveData.bestChef = Math.max(saveData.bestChef || 0, val);
    }
    persistSaveData();
  }

  function getCareerTopScore() {
    return Math.max(saveData.bestChef || 0, saveData.bestRush || 0, saveData.bestZen || 0);
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
    const activePatron = getSelectedPatron();
    // Keep selected support patron featured on first order, rotate cafe guests on later orders
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
    renderOrder();
  }

  function checkExistingBoardForOrder() {
    if (!gameState.order || gameState.order.completed || gameState.mode !== 'chef') return;
    // Match unfulfilled order slots against treats currently in the jar (without double-counting one treat)
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
      const dustBase = Math.round(ord.rewardDust * rushMult);
      const dust = addRunStardust(dustBase);

      addScore(pts);
      addFeverEnergy(isRush ? 36 : 28);
      audio.playOrderComplete();

      // Grant bonus random tool charge every 2 orders & trigger Shop Event if idle
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

      if (isRush) {
        grantNextRainbow();
      }

      const activePatron = getSelectedPatron();
      setPatronSpeech(
        activePatron,
        isRush ? `${activePatron.thanks} 极速出餐附赠彩虹万能糖哦！` : activePatron.thanks,
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
    const isChef = gameState.mode === 'chef';
    const isRush = gameState.mode === 'rush';
    const isZen = gameState.mode === 'zen';

    orderBoxEl.style.display = isChef ? 'block' : 'none';
    if (rushInfoBoxEl) rushInfoBoxEl.style.display = isRush ? 'flex' : 'none';
    if (zenInfoBoxEl) zenInfoBoxEl.style.display = isZen ? 'flex' : 'none';
    if (mOrderBarEl) mOrderBarEl.style.display = isChef ? 'flex' : 'none';
    if (mRushBarEl) mRushBarEl.style.display = isRush ? 'flex' : 'none';

    if (!isChef || !gameState.order) return;

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
    if (!gameState.running || gameState.over) return;

    // Zen mode awards Roguelike 3-Choice Blessings at escalating score milestones
    if (gameState.mode === 'zen') {
      while (gameState.score >= gameState.zenNextMilestone) {
        const hit = gameState.zenNextMilestone;
        gameState.zenNextMilestone =
          hit < 1400 ? 1400 : hit < 2800 ? 2800 : hit < 4800 ? 4800 : hit + 3000;
        queueBlessing(`🍵 达成 ${hit} 分里程碑`);
      }
    }

    // 90s Rush mode awards Blessings at 1,800 / 4,200 / 7,500 / +3,500 score milestones
    if (gameState.mode === 'rush') {
      while (gameState.score >= gameState.rushNextMilestone) {
        const hit = gameState.rushNextMilestone;
        gameState.rushNextMilestone =
          hit < 4200 ? 4200 : hit < 7500 ? 7500 : hit + 3500;
        queueBlessing(`⚡ 狂欢突破 ${hit} 分`);
      }
    }
  }

  function addFeverEnergy(amount) {
    if (gameState.feverTimer > 0) return;
    const feverLv = getPerkLevel('fever');
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
      if (cafeStageEl) cafeStageEl.classList.add('is-fever');
      showToast(`🔥 星光磁吸狂热启动！${dur.toFixed(0)}秒强力磁吸 · 连击最高 5× 积分！`);
      setPatronSpeech(
        getSelectedPatron(),
        '哇啊——星光磁吸狂热开启啦！同阶甜点自动吸合、连击最高5倍冲呀！！',
        4.8
      );
      spawnSparkleBurst(JAR.canvasW / 2, 240, '#ffdf6b', 36);
      spawnShockwave(JAR.canvasW / 2, 260, 190, '#ffd85d', 4.5);
      showComboBanner('🔥 星光磁吸狂热!', '极速投放 · 最高 5× 积分', '#ffe36e');

      // Rush mode grants +1 Blessing every time Fever starts!
      if (gameState.mode === 'rush') {
        queueBlessing('🔥 狂热充能达成');
      }
    }
  }

  // ==================== 3.0 Shop Events & Rush Emergency Gust ====================
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

    // Safety guard: never drop a yarn ball when jar is near danger line or one already exists
    if (kind === 'yarn' && !forcedKind && (isJarNearDanger() || hasYarnBallInJar())) {
      kind = Math.random() < 0.5 ? 'meteor' : 'chime';
    }

    gameState.lastEventKind = kind;
    audio.playEventStart(kind);
    const activePatron = getSelectedPatron();

    if (kind === 'meteor') {
      gameState.activeEvent = { kind: 'meteor', timer: 12.0, maxTimer: 12.0 };
      // 4 consecutive upcoming treats have 75% chance to be golden (starting with cur & next)
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

      // Spawn 2 shimmering diagonal shooting stars across jar backdrop
      gameState.shootingStars.push(
        { x: JAR.right - 20, y: JAR.neckY + 26, vx: -360, vy: 135, life: 0.95, maxLife: 0.95 },
        { x: JAR.right - 70, y: JAR.neckY + 58, vx: -320, vy: 125, life: 1.15, maxLife: 1.15 }
      );
      showComboBanner('🌠 流星许愿夜!', '接下来的甜点75%镀金 · 狂热充能 +30%', '#ffe888');
      showToast('🌠 突发事件：流星许愿夜！黄金甜点雨与 +30% 狂热充能！');
      setPatronSpeech(activePatron, '快许愿呀！流星把面糊都镀上亮晶晶的金糖霜啦～', 4.4);
    } else if (kind === 'yarn') {
      gameState.activeEvent = { kind: 'yarn', timer: 0, maxTimer: 0 };
      const sx = 120 + Math.random() * 200;
      createYarnBallEntity(sx, JAR.neckY + 24);
      spawnSparkleBurst(sx, JAR.neckY + 28, '#ff9cb8', 18);
      showComboBanner('🧶 猫咪捣蛋时间!', '附近合成2次或摇罐震碎爆 +180分 · +18⭐', '#ffa8c4');
      showToast('🧶 突发事件：调皮毛线球滚进罐里啦！附近合成 2 次即可震碎拿大奖！');
      setPatronSpeech(activePatron, '呀！毛线球滚进去了！在它旁边合两次就能砰地炸出星尘哦！', 4.6);
    } else {
      gameState.activeEvent = { kind: 'chime', timer: 14.0, maxTimer: 14.0 };
      gameState.jarFlash = Math.max(gameState.jarFlash, 0.5);
      spawnSparkleBurst(JAR.canvasW / 2, JAR.neckY + 30, '#ffe072', 24);
      showComboBanner('🔔 黄金烘焙钟!', '14秒内全合成 +45% 得分 · 连击窗口 +0.5s', '#ffe26a');
      showToast('🔔 突发事件：黄金烘焙钟敲响！14 秒暴击得分 +45%！');
      setPatronSpeech(activePatron, '叮当～壁炉黄金钟响了！趁这 14 秒疯狂连锁清罐吧！', 4.4);
    }

    updateHUD();
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

        const pts = Math.round(180 * getFeverMultiplier());
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

    // Clear the highest 3~4 treats closest to the top opening
    const sorted = [...gameState.entities].sort((a, b) => a.aabbMinY - b.aabbMinY);
    const clearCount = Math.min(sorted.length, sorted.length >= 10 ? 4 : 3);
    const toRemove = sorted.slice(0, clearCount);
    const removeIds = new Set(toRemove.map((e) => e.id));

    for (const e of toRemove) {
      spawnSparkleBurst(e.x, e.y, '#9be8ff', 14);
      spawnShockwave(e.x, e.y, 58, '#a6ecff', 3);
    }
    gameState.entities = gameState.entities.filter((e) => !removeIds.has(e.id));

    // Deduct 5.0s safely (preserve at least 1.0s buffer if timer > 1s to prevent instant 0s loop)
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
    showComboBanner('🌪️ 星风紧急吹散!', `清掉顶部 ${clearCount} 颗 · 扣除 5.0s`, '#ff9b82');
    showToast(`🌪️ 触发星风吹散！清除顶部 ${clearCount} 颗甜品并扣除 5.0 秒`);
    updateHUD();
  }

  function updateEventBannerUI() {
    if (!eventBannerEl) return;
    const ev = gameState.activeEvent;
    if (!ev || !gameState.running || gameState.over) {
      eventBannerEl.classList.remove('visible');
      return;
    }
    eventBannerEl.dataset.kind = ev.kind;
    if (ev.kind === 'meteor') {
      eventBannerIconEl.textContent = '🌠';
      eventBannerTitleEl.textContent = '流星许愿夜 · 镀金 & 充能+30%';
      eventBannerMetaEl.textContent = `${Math.max(0, ev.timer).toFixed(1)}s`;
    } else if (ev.kind === 'yarn') {
      const yb = gameState.entities.find((e) => e.isYarnBall && !e.merged);
      const hp = yb ? yb.yarnHp : 0;
      eventBannerIconEl.textContent = '🧶';
      eventBannerTitleEl.textContent = '猫咪捣蛋 · 附近合成震碎领大奖';
      eventBannerMetaEl.textContent = `脆度 ×${hp}`;
    } else {
      eventBannerIconEl.textContent = '🔔';
      eventBannerTitleEl.textContent = '黄金烘焙钟 · 得分+45% 连击延长';
      eventBannerMetaEl.textContent = `${Math.max(0, ev.timer).toFixed(1)}s`;
    }
    eventBannerEl.classList.add('visible');
  }

  function updateRushTimerUI() {
    const isRush = gameState.mode === 'rush' && gameState.running && !gameState.over;
    const tStr = `${Math.max(0, gameState.rushTimer).toFixed(1)}s`;
    const urgent = gameState.rushTimer <= 15.0;

    if (jarRushPillEl) {
      jarRushPillEl.style.display = isRush ? 'flex' : 'none';
      jarRushPillEl.classList.toggle('is-urgent', urgent);
    }
    if (jarRushTimeEl) jarRushTimeEl.textContent = tStr;
    if (rushClockValEl) {
      rushClockValEl.textContent = tStr;
      rushClockValEl.classList.toggle('is-urgent', urgent);
    }
    if (rushMilestoneLineEl) {
      rushMilestoneLineEl.textContent = `🎁 下次祝福：${gameState.rushNextMilestone.toLocaleString()} 分 / 进狂热送 1 次`;
    }
    if (mRushTimerEl) {
      mRushTimerEl.textContent = tStr;
      mRushTimerEl.classList.toggle('is-urgent', urgent);
    }
    if (mRushMilestoneEl) {
      mRushMilestoneEl.textContent = `🎁 ${gameState.rushNextMilestone}分`;
    }
    if (zenMilestoneLineEl && gameState.mode === 'zen') {
      zenMilestoneLineEl.textContent = `🎁 下次三选一祝福：${gameState.zenNextMilestone.toLocaleString()} 分`;
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
    updateRushTimerUI();
    updateEventBannerUI();

    // Tool Badges
    updateToolBadge(btnToolShake, badgeShake, 'shake');
    updateToolBadge(btnToolFork, badgeFork, 'fork');
    updateToolBadge(btnToolSpoon, badgeSpoon, 'spoon');

    modeTagEl.textContent =
      gameState.mode === 'rush'
        ? '⚡ 90秒狂欢模式'
        : gameState.mode === 'zen'
        ? '🍵 悠闲经典模式'
        : '🌟 星夜主厨模式';
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
      // Shaking the jar also cracks Mischief Yarn Balls!
      damageNearbyYarnBalls(JAR.canvasW / 2, JAR.canvasH / 2, 0, true);
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
    gameState.dropsMadeThisRun++;
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

    // Trigger Shop Event every 22~30 drops in Chef / Zen modes
    if (gameState.mode !== 'rush' && !gameState.activeEvent) {
      gameState.nextEventDrops--;
      if (gameState.nextEventDrops <= 0) {
        gameState.nextEventDrops = 22 + Math.floor(Math.random() * 9);
        triggerShopEvent();
      }
    }

    gameState.aimAngle = 0;
    gameState.dropSway = 0;
    gameState.canHoldThisTurn = true;
    const isFever = gameState.feverTimer > 0;
    if (gameState.mode === 'rush') {
      gameState.dropCooldown = isFever ? 0.06 : 0.09;
    } else {
      gameState.dropCooldown = isFever ? 0.12 : 0.19;
    }
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
    const mugiBoost = saveData.selectedPatron === 'mugi' && nextTier >= 4 ? 1.3 : 1.0;
    const blastRadius = bornR * (2.45 + shockLv * 0.55) + 46;
    const baseForce = (95 + nextTier * 17 + shockLv * 52 + (isFever ? 32 : 0)) * mugiBoost;

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
    const magnetLv = getEffectiveMagnetLevel();
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
        const sndTier = strongest.bodyA ? Math.max(tierA, tierB) : tierB;
        audio.playBounce(intensity, sndTier, hitGlass);
      }
    }

    // Process merges outside substep loop
    if (mergePairs.length > 0) {
      const comboLv = getPerkLevel('combo');
      const critLv = getPerkLevel('critJump');
      const goldenLv = getPerkLevel('golden');
      const rainbowLv = getPerkLevel('rainbow');
      const upComboBonus = SHOP_UPGRADES.find((u) => u.id === 'up_combo').values[getUpgradeLevel('up_combo')] || 0;
      const isChimeEvent = !!(gameState.activeEvent && gameState.activeEvent.kind === 'chime');
      const chimeScoreMult = isChimeEvent ? 1.45 : 1.0;
      const chimeComboBonus = isChimeEvent ? 0.5 : 0;

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

        // Combo tracking with Combo Master perk + Kitchen Metronome + Golden Chime
        if (gameState.comboTimer <= 0) {
          gameState.comboCount = 1;
          gameState.comboRainbowGranted = false;
        } else {
          gameState.comboCount++;
        }
        gameState.comboTimer = 1.72 + comboLv * 0.6 + upComboBonus + chimeComboBonus;
        if (gameState.comboCount > gameState.maxCombo) {
          gameState.maxCombo = gameState.comboCount;
        }

        // Honey Shiba (mugi) passive: >=3 combo grants +4 ⭐ stardust (or +60 pts in 90s Rush!)
        if (saveData.selectedPatron === 'mugi' && gameState.comboCount >= 3) {
          if (gameState.mode === 'rush') {
            addScore(60);
            spawnPopup(mx + 26, my - 26, '🍯 +60分!', '#ffd27a', 13);
          } else {
            const mugiDust = addRunStardust(4);
            spawnPopup(mx + 26, my - 26, `🍯 +${mugiDust}⭐`, '#ffd27a', 13);
          }
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

        // Nearby merges crack & shatter Mischief Yarn Balls within 95px!
        damageNearbyYarnBalls(mx, my, 95, false);

        if (isTwinWild) {
          // Two Rainbow Wildcards merge -> Twin Rainbow Miracle!
          const born = createEntity(5, mx, my, mvx, mvy - 30, true, 0, 0, { golden: true });
          const pts = Math.round(320 * feverMult * comboBonus * chimeScoreMult);
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
          const pts = Math.round(def.points * feverMult * comboBonus * goldMult * critMult * chimeScoreMult);
          addScore(pts);

          let dustBase = nextTier >= 4 ? Math.max(1, Math.floor(nextTier / 2)) : 0;
          if (isGoldenMerge) {
            dustBase += 12 + goldenLv * 10;
          }
          const dustGain = dustBase > 0 ? addRunStardust(dustBase) : 0;

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
            gameState.soufflesMadeThisRun++;
            saveData.lifetimeStats.soufflesMade = (saveData.lifetimeStats.soufflesMade || 0) + 1;
            persistSaveData();
            showToast('👑 奇迹诞生！合成传说级【星冠猫神舒芙蕾】！');
            setPatronSpeech(getSelectedPatron(), '哇！！星冠猫神舒芙蕾诞生了！整座甜品屋都在发光！', 5.0);
            showComboBanner('👑 星冠猫神诞生!', '传说级至高甜点!', '#ffe46b');
          }

          notifyTreatSynthesized(nextTier, born);
        } else {
          // Two Tier 9 Crown Cat Souffles (or Wildcard + Tier 9) -> Celestial Supernova!
          const pts = Math.round((isWildMerge ? 1200 : 1800) * feverMult * comboBonus * chimeScoreMult);
          addScore(pts);
          addRunStardust(55);
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
            if (!e.isWildcard && !e.isYarnBall && e.tier <= 2 && Math.hypot(e.x - mx, e.y - my) < 190) {
              spawnSparkleBurst(e.x, e.y, '#9be0ff', 8);
              return false;
            }
            return true;
          });
        }
      }
      updateHUD();
    }

    // Update age, drop trail, yarn flash, harmonic soft-body spring squish, and exact polygon-top overflow check
    let anyDanger = false;
    for (const e of gameState.entities) {
      e.age += dt;
      if (e.yarnHitFlash > 0) {
        e.yarnHitFlash = Math.max(0, e.yarnHitFlash - dt);
      }
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
        if (gameState.mode === 'rush') {
          triggerRushEmergencyGust();
        } else {
          triggerGameOver();
        }
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

    // Compute 3.0 Permanent Stardust Bank Deposit
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

    if (goHeadingEl) {
      goHeadingEl.textContent =
        gameState.mode === 'rush' && gameState.rushFinished ? '⏰ 90秒狂欢结算' : '🌙 今夜打烊总结';
    }
    goScoreEl.textContent = String(gameState.score);
    goBestEl.textContent = String(getBestScore());
    goNewBestEl.style.display = isNewBest ? 'inline-block' : 'none';
    goMaxTierEl.textContent = `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}`;

    if (goFourthLabelEl && goFourthValEl) {
      if (gameState.mode === 'rush') {
        goFourthLabelEl.textContent = '最高连击 / 击碎毛线球';
        goFourthValEl.innerHTML = `${gameState.maxCombo}x · 🧶${gameState.yarnBrokenThisRun}`;
      } else {
        goFourthLabelEl.textContent = '完成订单 / 最高连击';
        goFourthValEl.innerHTML = `<span id="go-orders">${gameState.ordersCompleted}</span> 单 · <span id="go-combo">${gameState.maxCombo}</span>x`;
      }
    } else {
      goOrdersEl.textContent = String(gameState.ordersCompleted);
      goComboEl.textContent = String(gameState.maxCombo);
    }
    goRankEl.textContent = getChefRank(gameState.score);

    if (goBankEarnedEl) {
      goBankEarnedEl.textContent = `+${finalEarned} ⭐`;
    }
    if (goBankDetailEl) {
      const parts = [];
      if (pityApplied) {
        parts.push('营业保底 15⭐');
      } else {
        parts.push(`得分+${scorePart}`);
        if (dustPart > 0) parts.push(`余尘+${dustPart}`);
        if (souffleBonus > 0) parts.push(`猫神+${souffleBonus}`);
        if (rushBonus > 0) parts.push(`狂欢完赛+${rushBonus}`);
      }
      if (dustMult > 1) {
        parts.push(`糖霜壶×${dustMult.toFixed(2).replace(/0$/, '')}`);
      }
      goBankDetailEl.textContent = `${parts.join(' · ')} → 已存入大厅星尘银行（当前余额：${saveData.bankStardust} ⭐）`;
    }
    if (goBankShopHintEl) {
      goBankShopHintEl.style.display = hasAffordableShopItem() ? 'block' : 'none';
    }

    updateHUD();
    updateLobbyUI();
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
    const lockPad = 14 + getEffectiveMagnetLevel() * 6 + (gameState.feverTimer > 0 ? 14 : 0);
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < gameState.entities.length; i++) {
      const e = gameState.entities[i];
      if (e.merged || e.isYarnBall) continue;
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

  function drawSakuraPetal(c, x, y, r, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    c.moveTo(0, -r * 1.15);
    c.bezierCurveTo(r * 0.95, -r * 0.65, r * 0.85, r * 0.75, 0, r * 1.1);
    c.bezierCurveTo(-r * 0.85, r * 0.75, -r * 0.95, -r * 0.65, 0, -r * 1.15);
    c.closePath();
    c.fill();
    c.restore();
  }

  function drawYarnBallEntity(c, e, nowSec) {
    const shapeDef = PHYSICS_SHAPES.event_yarn_ball;
    const hitFlash = e.yarnHitFlash > 0 ? Math.min(1, e.yarnHitFlash / 0.45) : 0;

    c.save();
    const jitterX = hitFlash > 0 ? Math.sin(nowSec * 90) * 3.2 * hitFlash : 0;
    const jitterY = hitFlash > 0 ? Math.cos(nowSec * 82) * 2.4 * hitFlash : 0;
    c.translate(e.x + jitterX, e.y + jitterY);

    // Outer wrapped-yarn pulsing alert ring
    const ringPulse = 0.55 + 0.45 * Math.sin(nowSec * 6.5);
    c.save();
    c.rotate(nowSec * 1.1);
    c.strokeStyle =
      hitFlash > 0.1
        ? `rgba(255, 255, 255, ${0.85})`
        : e.yarnHp === 1
        ? `rgba(255, 118, 132, ${0.65 + 0.35 * ringPulse})`
        : `rgba(255, 186, 210, ${0.45 + 0.35 * ringPulse})`;
    c.lineWidth = e.yarnHp === 1 ? 2.6 : 2.0;
    c.setLineDash([6, 4]);
    c.beginPath();
    c.arc(0, 0, e.r + 4.5, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.restore();

    // Sprite with CoM registration & squish
    c.save();
    if (Math.abs(e.squishAmt) > 0.002) {
      c.rotate(e.squishAngle);
      c.scale(1 - e.squishAmt, 1 + e.squishAmt * 0.82);
      c.rotate(e.angle - e.squishAngle);
    } else {
      c.rotate(e.angle);
    }
    if (yarnBallImage && shapeDef) {
      const scale = e.r / shapeDef.r_eq_px;
      c.drawImage(
        yarnBallImage,
        -shapeDef.com_x * scale,
        -shapeDef.com_y * scale,
        shapeDef.width * scale,
        shapeDef.height * scale
      );
    } else {
      c.fillStyle = '#f28b99';
      c.beginPath();
      c.arc(0, 0, e.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#4A2C2A';
      c.lineWidth = 2.5;
      c.stroke();
    }
    if (hitFlash > 0.05) {
      c.fillStyle = `rgba(255, 235, 240, ${hitFlash * 0.6})`;
      c.beginPath();
      c.arc(0, 0, e.r * 1.02, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // Upright HP corner badge (🧶×2 / 🧶×1)
    const bx = e.r * 0.52;
    const by = -e.r * 0.72;
    c.fillStyle = e.yarnHp === 1 ? 'rgba(214, 52, 68, 0.94)' : 'rgba(64, 32, 24, 0.92)';
    c.strokeStyle = e.yarnHp === 1 ? '#ffe388' : '#ffb8d0';
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(bx - 19, by - 9, 38, 18, 9);
    c.fill();
    c.stroke();
    c.fillStyle = '#fff8ec';
    c.font = '900 10.5px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`🧶×${e.yarnHp}`, bx, by + 0.5);
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
    const isChime = !!(gameState.activeEvent && gameState.activeEvent.kind === 'chime');
    const theme = getEquippedTheme();

    // 1. Soft floor shadow under glass jar on wooden counter
    const shadowGrad = ctx.createRadialGradient(220, JAR.floorY + 12, 20, 220, JAR.floorY + 12, 165);
    shadowGrad.addColorStop(0, 'rgba(38, 18, 6, 0.55)');
    shadowGrad.addColorStop(1, 'rgba(38, 18, 6, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(220, JAR.floorY + 11, 155, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Translucent glass chamber back-fill (themed + Fever aurora + Golden Chime glow + themed motes)
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
      bgGrad.addColorStop(0, theme.glassTop);
      bgGrad.addColorStop(0.6, theme.glassMid);
      bgGrad.addColorStop(1, theme.glassBot);
    }
    ctx.fillStyle = bgGrad;
    ctx.fill();

    ctx.clip();
    // Golden Chime warm fireplace hearth pulse
    if (isChime) {
      const hearth = 0.1 + 0.08 * Math.sin(nowSec * 5.2);
      const chGrad = ctx.createRadialGradient(220, 290, 40, 220, 290, 230);
      chGrad.addColorStop(0, `rgba(255, 214, 96, ${hearth * 0.5})`);
      chGrad.addColorStop(1, `rgba(255, 168, 52, ${hearth * 1.4})`);
      ctx.fillStyle = chGrad;
      ctx.fillRect(JAR.left, JAR.neckY, JAR.right - JAR.left, JAR.floorY - JAR.neckY);
    }

    // Meteor Wish streaking shooting stars inside the night-sky jar glass
    if (gameState.shootingStars.length > 0) {
      for (const st of gameState.shootingStars) {
        const a = Math.max(0, Math.min(1, st.life / st.maxLife));
        ctx.save();
        ctx.globalAlpha = a;
        const tailX = st.x - st.vx * 0.18;
        const tailY = st.y - st.vy * 0.18;
        const g = ctx.createLinearGradient(st.x, st.y, tailX, tailY);
        g.addColorStop(0, 'rgba(255, 248, 198, 0.95)');
        g.addColorStop(0.5, 'rgba(255, 214, 96, 0.55)');
        g.addColorStop(1, 'rgba(255, 214, 96, 0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(st.x, st.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.fillStyle = '#fff9d6';
        drawStar(ctx, st.x, st.y, 7, nowSec * 8);
        ctx.restore();
      }
    }

    // Themed ambient particles inside the jar glass
    const moteCount = isFever ? 12 : theme.id === 'amber' ? 6 : 9;
    const spanY = JAR.floorY - JAR.neckY;
    for (let m = 0; m < moteCount; m++) {
      const mx = JAR.left + 22 + ((m * 47 + Math.sin(nowSec * (isFever ? 1.4 : 0.8) + m) * 20) % (JAR.right - JAR.left - 44));
      if (theme.moteKind === 'petal' && !isFever) {
        // Sakura petals drift downward gently
        const my = JAR.neckY + (((nowSec * 28 + m * 61) % spanY));
        ctx.fillStyle = m % 2 === 0 ? 'rgba(255, 206, 226, 0.52)' : 'rgba(255, 174, 206, 0.42)';
        drawSakuraPetal(ctx, mx, my, 4.2 + (m % 2) * 1.4, nowSec * 1.4 + m);
      } else if (theme.moteKind === 'starfish' && !isFever) {
        // Bioluminescent moonlit motes & starfish rise smoothly
        const my = JAR.floorY - (((nowSec * 24 + m * 57) % spanY));
        ctx.fillStyle = m % 2 === 0 ? 'rgba(154, 236, 255, 0.45)' : 'rgba(210, 248, 255, 0.38)';
        drawStar(ctx, mx, my, 2.8 + (m % 3) * 0.9, nowSec * 1.1 + m);
      } else {
        const my = JAR.floorY - (((nowSec * (isFever ? 65 : 22) + m * 59) % spanY));
        ctx.fillStyle = isFever
          ? (m % 2 === 0 ? 'rgba(255, 234, 138, 0.48)' : 'rgba(255, 182, 220, 0.44)')
          : theme.moteColor;
        drawStar(ctx, mx, my, isFever ? 3.2 + (m % 3) : 2.1 + (m % 2) * 0.8, nowSec * (isFever ? 3 : 1.2) + m);
      }
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
      ctx.fillStyle = gameState.mode === 'rush' ? 'rgba(224, 114, 38, 0.94)' : 'rgba(224, 62, 52, 0.92)';
      ctx.beginPath();
      ctx.roundRect(148, JAR.dangerY - 22, 144, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        gameState.mode === 'rush' ? `🌪️ 星风预警 ${rem}s` : `⚠️ 即将溢出 ${rem}s`,
        220,
        JAR.dangerY - 12
      );
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
      const [lr, lg, lb] = theme.lockColor;

      // Dashed guide line (themed + turns bright pulsing when locked onto a merge!)
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
          : `rgba(${lr}, ${lg}, ${lb}, ${pulse})`;
        ctx.lineWidth = isTouchAiming ? 3.2 : 2.8;
      } else {
        ctx.strokeStyle = curIsWild
          ? 'rgba(255, 186, 232, 0.72)'
          : curIsGold
          ? 'rgba(255, 224, 102, 0.76)'
          : isTouchAiming
          ? theme.guideTouch
          : theme.guideLine;
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
          lockedTarget
            ? `rgba(${lr}, ${lg}, ${lb}, 0.95)`
            : isTouchAiming
            ? theme.guideTouch
            : theme.guideLine,
          lockedTarget ? 2.2 : 1.5,
          lockedTarget ? `rgba(${lr}, ${lg}, ${lb}, 0.16)` : `rgba(${lr}, ${lg}, ${lb}, 0.06)`,
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
          ctx.strokeStyle = curIsWild ? '#ffb8e6' : `rgb(${lr}, ${lg}, ${lb})`;
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
      const baseCol = e.isYarnBall
        ? '#ffa8c4'
        : e.isWildcard
        ? '#ff9fd6'
        : e.isGolden
        ? '#ffe26a'
        : TIERS[e.tier - 1].crumbColor;
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

    const [lr, lg, lb] = theme.lockColor;
    for (const e of gameState.entities) {
      const isHovered = gameState.activeToolMode && gameState.hoveredEntityId === e.id;
      const validTarget =
        isHovered &&
        !e.isYarnBall &&
        ((gameState.activeToolMode === 'fork' && !e.isWildcard && e.tier <= 4) ||
          (gameState.activeToolMode === 'spoon' && !e.isWildcard && e.tier < 9));

      if (e.isYarnBall) {
        drawYarnBallEntity(ctx, e, nowSec);
      } else if (e.isWildcard) {
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

      // Highlight locked-on aim merge target with pulsing themed halo
      if (lockedTarget && lockedTarget.id === e.id) {
        ctx.save();
        const pulse = 0.65 + 0.35 * Math.sin(nowSec * 10);
        ctx.strokeStyle = gameState.curMeta.wildcard
          ? `rgba(255, 168, 224, ${pulse})`
          : `rgba(${lr}, ${lg}, ${lb}, ${pulse})`;
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
      } else if (isHovered && (e.isYarnBall || (gameState.activeToolMode === 'fork' && (e.tier > 4 || e.isWildcard)))) {
        drawEntityWorldPolys(ctx, e, 'rgba(255, 100, 90, 0.82)', 2.4);
      }
    }

    // 5.2 Render Solo Action Emotes & Neighbor Squeeze Interaction FX above treats
    for (const e of gameState.entities) {
      if (e.anim && !e.isWildcard && !e.isYarnBall) {
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

    // 7. Glass Jar Specular Highlights, Rim Outline & Themed Metal Collar
    ctx.save();
    // Outer dark-sepia storybook glass outline + themed/fever/chime rim glow
    traceJarInnerPath(ctx);
    ctx.lineWidth = 9 + (gameState.jarFlash > 0 ? gameState.jarFlash * 6 : 0);
    ctx.strokeStyle =
      gameState.jarFlash > 0.05
        ? `rgba(255, 238, 146, ${0.45 + gameState.jarFlash * 0.5})`
        : isFever
        ? 'rgba(255, 215, 92, 0.62)'
        : isChime
        ? `rgba(255, 214, 96, ${0.46 + 0.24 * Math.sin(nowSec * 6)})`
        : theme.rimGlow;
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

    // Themed Metal Neck Collar Rim at top of jar (Brass / Rose Gold / Mithril Silver)
    const collarGrad = ctx.createLinearGradient(JAR.left - 8, JAR.neckY - 14, JAR.left - 8, JAR.neckY + 10);
    collarGrad.addColorStop(0, theme.collar[0]);
    collarGrad.addColorStop(0.5, theme.collar[1]);
    collarGrad.addColorStop(1, theme.collar[2]);
    ctx.fillStyle = collarGrad;
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(JAR.left - 10, JAR.neckY - 11, JAR.right - JAR.left + 20, 20, 10);
    ctx.fill();
    ctx.stroke();

    // Collar metallic highlight line
    ctx.beginPath();
    ctx.moveTo(JAR.left + 6, JAR.neckY - 6);
    ctx.lineTo(JAR.right - 6, JAR.neckY - 6);
    ctx.strokeStyle = theme.collarHighlight;
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
      if (e.isWildcard || e.isYarnBall) {
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
      if (!a || !b || a.id === b.id || a.merged || b.merged || a.isWildcard || b.isWildcard || a.isYarnBall || b.isYarnBall) return;
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
      if (a.isWildcard || a.isYarnBall) continue;
      for (let j = i + 1; j < entities.length; j++) {
        const b = entities[j];
        if (b.isWildcard || b.isYarnBall) continue;
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
      if (e.anim || e.merged || e.isWildcard || e.isYarnBall) continue;

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

    const theme = getEquippedTheme();
    const isSakura = theme.id === 'sakura';

    for (const f of fireflies) {
      f.x += (f.vx + (isSakura ? Math.sin(nowSec * 1.1 + f.phase) * 0.01 : 0)) * dt;
      f.y += (isSakura ? Math.abs(f.vy) * 1.35 : f.vy) * dt;
      if (f.y < -0.05) {
        f.y = 1.05;
        f.x = Math.random();
      } else if (f.y > 1.05) {
        f.y = -0.05;
        f.x = Math.random();
      }
      if (f.x < -0.05) f.x = 1.05;
      if (f.x > 1.05) f.x = -0.05;

      const glow = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(nowSec * 2.2 + f.phase));
      const px = f.x * w;
      const py = f.y * h;
      if (isSakura) {
        ambientCtx.fillStyle = `rgba(${theme.ambientRgb}, ${glow * 0.85})`;
        drawSakuraPetal(ambientCtx, px, py, f.r * 1.9, nowSec * 1.2 + f.phase);
      } else {
        const grad = ambientCtx.createRadialGradient(px, py, 0, px, py, f.r * 3.5);
        grad.addColorStop(0, `rgba(${theme.ambientRgb}, ${glow})`);
        grad.addColorStop(1, `rgba(${theme.ambientRgb}, 0)`);
        ambientCtx.fillStyle = grad;
        ambientCtx.beginPath();
        ambientCtx.arc(px, py, f.r * 3.5, 0, Math.PI * 2);
        ambientCtx.fill();
      }
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
      if (gameState.rushGustCooldown > 0) gameState.rushGustCooldown = Math.max(0, gameState.rushGustCooldown - dt);

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

      // Tick Shop Events (timed Meteor Wish / Golden Chime & Rush 18s cadence)
      if (gameState.activeEvent) {
        if (gameState.activeEvent.kind === 'yarn') {
          if (!hasYarnBallInJar()) {
            gameState.activeEvent = null;
          }
        } else {
          gameState.activeEvent.timer = Math.max(0, gameState.activeEvent.timer - dt);
          if (gameState.activeEvent.timer <= 0) {
            const endedKind = gameState.activeEvent.kind;
            gameState.activeEvent = null;
            if (endedKind === 'chime') {
              showToast('🔔 黄金烘焙钟余韵渐散，继续加油！');
            }
          }
        }
        updateEventBannerUI();
      } else if (gameState.mode === 'rush') {
        gameState.nextEventTimer -= dt;
        if (gameState.nextEventTimer <= 0) {
          gameState.nextEventTimer = 18.0;
          triggerShopEvent();
        }
      }

      // Tick 90-Second Rush Mode Countdown & Final 5s Woodblock Ticks
      if (gameState.mode === 'rush') {
        gameState.rushTimer = Math.max(0, gameState.rushTimer - dt);
        if (gameState.rushTimer <= 5.0 && gameState.rushTimer > 0) {
          const secInt = Math.ceil(gameState.rushTimer);
          if (secInt < gameState.rushLastTickSec) {
            gameState.rushLastTickSec = secInt;
            audio.playRushTick(secInt <= 3);
          }
        }
        updateRushTimerUI();
        if (gameState.rushTimer <= 0) {
          gameState.rushFinished = true;
          triggerGameOver();
        }
      }

      // Micro-hitstop freezes rigid bodies for 2~4 punchy frames on big merges/crits while FX keep blooming
      if (!gameState.over) {
        if (gameState.hitstopTimer > 0) {
          gameState.hitstopTimer = Math.max(0, gameState.hitstopTimer - dt);
        } else {
          stepPhysics(dt);
        }
        updateDessertAnimations(dt);
      }
    }

    // Update streaking shooting stars FX
    for (let i = gameState.shootingStars.length - 1; i >= 0; i--) {
      const st = gameState.shootingStars[i];
      st.life -= dt;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
      if (st.life <= 0) gameState.shootingStars.splice(i, 1);
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

    if (!isLobbyOpen()) {
      renderGameCanvas(nowSec);
    }
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
    if (target.isYarnBall) {
      showToast('🧶 毛线球请在附近合成 2 次或使用【摇一摇】震碎爆大奖！');
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
    if (ev.key === 'Escape') {
      if (shopModal.classList.contains('is-open')) {
        closeShop();
        return;
      }
      if (careerModal.classList.contains('is-open')) {
        closeCareer();
        return;
      }
      if (helpModal.classList.contains('is-open')) {
        closeHelp();
        return;
      }
      if (compendiumModal.classList.contains('is-open')) {
        closeCompendium();
        return;
      }
    }
    if (ev.key === 'p' || ev.key === 'P') {
      if (!isLobbyOpen()) {
        ev.preventDefault();
        toggleDebugPhysics();
      }
      return;
    }
    if (!gameState.running || gameState.over) return;
    if (
      shopModal.classList.contains('is-open') ||
      careerModal.classList.contains('is-open') ||
      helpModal.classList.contains('is-open') ||
      compendiumModal.classList.contains('is-open')
    ) {
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

  // ==================== 3.0 Bakery Lobby, Shop, Career & Help UI ====================
  function applyStageTheme() {
    if (cafeStageEl) {
      cafeStageEl.dataset.theme = saveData.equippedTheme || 'amber';
    }
  }

  function bounceLobbyPatronPortrait() {
    if (!lobbyPatronPortraitBtn) return;
    lobbyPatronPortraitBtn.classList.remove('is-boing');
    void lobbyPatronPortraitBtn.offsetWidth;
    lobbyPatronPortraitBtn.classList.add('is-boing');
  }

  function updateLobbyUI() {
    applyStageTheme();

    const bankVal = saveData.bankStardust || 0;
    if (lobbyBankValueEl) lobbyBankValueEl.textContent = String(bankVal);
    if (shopBankValueEl) shopBankValueEl.textContent = String(bankVal);
    if (lobbyRankBadgeEl) lobbyRankBadgeEl.textContent = getChefRank(getCareerTopScore());

    if (modeBestChefEl) modeBestChefEl.textContent = String(saveData.bestChef || 0);
    if (modeBestRushEl) modeBestRushEl.textContent = String(saveData.bestRush || 0);
    if (modeBestZenEl) modeBestZenEl.textContent = String(saveData.bestZen || 0);

    // Sync mode card highlight
    if (modeSelectEl) {
      modeSelectEl.querySelectorAll('.lobby-mode-card').forEach((btn) => {
        btn.classList.toggle('is-selected', btn.dataset.mode === gameState.mode);
      });
    }

    // Active Patron Display
    const patron = getSelectedPatron();
    if (lobbyPatronImgEl) {
      lobbyPatronImgEl.src = patron.src;
      lobbyPatronImgEl.alt = patron.name;
    }
    if (lobbyPatronNameEl) lobbyPatronNameEl.textContent = `${patron.badge} ${patron.name}`;
    if (lobbyPatronSkillNameEl) lobbyPatronSkillNameEl.textContent = patron.skillName;
    if (lobbyPatronPassiveEl) lobbyPatronPassiveEl.textContent = patron.passiveDesc;
    if (lobbyPatronSpeechEl) {
      const lines = patron.idleLines || [patron.greet];
      lobbyPatronSpeechEl.textContent = lines[lobbySpeechIndex % lines.length];
    }

    // 3-Patron Switcher Strip
    if (lobbyPatronStripEl) {
      lobbyPatronStripEl.innerHTML = '';
      PATRONS.forEach((p) => {
        const unlocked = saveData.unlockedPatrons.includes(p.id);
        const selected = saveData.selectedPatron === p.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `patron-chip-btn${selected ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}`;
        btn.dataset.patronId = p.id;
        btn.innerHTML = `
          <img src="${p.src}" alt="${p.shortName}" />
          <div class="patron-chip-meta">
            <strong>${p.shortName}</strong>
            <span>${unlocked ? (selected ? '✦ 已出战' : p.shortPassive) : `🔒 ${p.cost}⭐`}</span>
          </div>
        `;
        btn.addEventListener('click', () => {
          audio.ensureCtx();
          if (unlocked) {
            if (saveData.selectedPatron !== p.id) {
              saveData.selectedPatron = p.id;
              lobbySpeechIndex = 0;
              persistSaveData();
              audio.playPatronSelect();
              updateLobbyUI();
              bounceLobbyPatronPortrait();
              showToast(`${p.badge} 已切换助阵搭档：${p.name}（${p.skillName}）`);
            } else {
              pokeLobbyPatron();
            }
          } else {
            openShop('patrons');
          }
        });
        lobbyPatronStripEl.appendChild(btn);
      });
    }

    // Shop Preview Strip
    const theme = getEquippedTheme();
    if (lobbyThemeTagEl) {
      lobbyThemeTagEl.textContent = `${theme.icon} ${theme.name}`;
    }
    if (lobbyTalentsSummaryEl) {
      const activeTags = SHOP_UPGRADES.filter((u) => getUpgradeLevel(u.id) > 0).map((u) =>
        u.shortTag(getUpgradeLevel(u.id))
      );
      lobbyTalentsSummaryEl.textContent =
        activeTags.length > 0
          ? `已激活天赋：${activeTags.join(' · ')}`
          : '厨房天赋：尚未升级（点击进入吃茶小铺解锁！）';
    }

    if (shopRedDotEl) {
      shopRedDotEl.classList.toggle('visible', hasAffordableShopItem());
    }
  }

  function pokeLobbyPatron() {
    audio.ensureCtx();
    audio.playPatronSelect();
    lobbySpeechIndex++;
    const patron = getSelectedPatron();
    const lines = patron.idleLines || [patron.greet];
    if (lobbyPatronSpeechEl) {
      lobbyPatronSpeechEl.textContent = lines[lobbySpeechIndex % lines.length];
    }
    bounceLobbyPatronPortrait();
  }

  function showLobbyScreen() {
    if (playScreenEl) playScreenEl.classList.remove('is-active');
    if (lobbyScreenEl) lobbyScreenEl.classList.add('is-active');
    updateLobbyUI();
    syncAudioMood();
  }

  function showPlayScreen() {
    if (lobbyScreenEl) lobbyScreenEl.classList.remove('is-active');
    if (playScreenEl) playScreenEl.classList.add('is-active');
    syncAudioMood();
    setTimeout(() => buildEvolutionRing(), 60);
  }

  function returnToLobby() {
    gameState.running = false;
    gameState.paused = false;
    cancelToolMode();
    audio.setFeverMode(false);
    audio.setDangerLevel(0);
    if (cafeStageEl) cafeStageEl.classList.remove('is-fever');
    blessingModal.classList.remove('is-open');
    gameoverModal.classList.remove('is-open');
    compendiumModal.classList.remove('is-open');
    if (eventBannerEl) eventBannerEl.classList.remove('visible');
    if (jarRushPillEl) jarRushPillEl.style.display = 'none';
    showLobbyScreen();
  }

  // Patisserie Shop Modal
  function openShop(tab = activeShopTab) {
    activeShopTab = tab;
    renderShop();
    shopModal.classList.add('is-open');
    syncAudioMood();
  }

  function closeShop() {
    shopModal.classList.remove('is-open');
    updateLobbyUI();
    syncAudioMood();
  }

  function renderShop() {
    if (shopBankValueEl) shopBankValueEl.textContent = String(saveData.bankStardust || 0);
    if (shopTabsEl) {
      shopTabsEl.querySelectorAll('.shop-tab').forEach((t) => {
        t.classList.toggle('is-active', t.dataset.tab === activeShopTab);
      });
    }
    if (!shopBodyEl) return;

    shopBodyEl.innerHTML = '';
    const bank = saveData.bankStardust || 0;

    if (activeShopTab === 'upgrades') {
      shopBodyEl.className = 'shop-body';
      SHOP_UPGRADES.forEach((up) => {
        const lv = getUpgradeLevel(up.id);
        const isMax = lv >= up.maxLv;
        const cost = isMax ? 0 : up.costs[lv];
        const canBuy = !isMax && bank >= cost;
        const pipsHtml = Array.from({ length: up.maxLv }, (_, idx) => `<span class="lv-pip${idx < lv ? ' is-on' : ''}"></span>`).join('');

        const card = document.createElement('div');
        card.className = `shop-card${isMax ? ' is-equipped' : ''}`;
        card.innerHTML = `
          <div class="shop-card-top">
            <div class="shop-card-icon">${up.icon}</div>
            <div class="shop-card-head">
              <div class="shop-card-title">${up.name} (Lv.${lv}/${up.maxLv})</div>
              <div class="shop-lv-pips">${pipsHtml}</div>
            </div>
          </div>
          <div class="shop-card-desc">${up.desc(lv)}</div>
          <button class="wood-btn shop-buy-btn${isMax ? ' is-max' : ''}" data-shop-id="${up.id}" type="button" ${isMax || !canBuy ? 'disabled' : ''}>
            ${isMax ? '✓ 已升至满级' : `⭐ ${cost} 永久星尘升级`}
          </button>
        `;
        const btn = card.querySelector('.shop-buy-btn');
        if (!isMax) {
          btn.addEventListener('click', () => buyUpgrade(up.id));
        }
        shopBodyEl.appendChild(card);
      });
    } else if (activeShopTab === 'themes') {
      shopBodyEl.className = 'shop-body is-three-col';
      JAR_THEME_LIST.forEach((th) => {
        const owned = saveData.unlockedThemes.includes(th.id);
        const equipped = saveData.equippedTheme === th.id;
        const canBuy = !owned && bank >= th.cost;

        const card = document.createElement('div');
        card.className = `shop-card${equipped ? ' is-equipped' : ''}`;
        card.innerHTML = `
          <div class="shop-card-top">
            <div class="shop-card-icon"><div class="theme-swatch theme-${th.id}"></div></div>
            <div class="shop-card-head">
              <div class="shop-card-title">${th.icon} ${th.name}</div>
              <span class="patron-skill-pill">${equipped ? '✦ 使用中' : owned ? '已拥有' : `${th.cost} ⭐`}</span>
            </div>
          </div>
          <div class="shop-card-desc">${th.desc}</div>
          <button class="wood-btn shop-buy-btn${equipped ? ' is-equipped-btn' : ''}" data-shop-id="${th.id}" type="button" ${equipped || (!owned && !canBuy) ? 'disabled' : ''}>
            ${equipped ? '✓ 当前装备中' : owned ? '✨ 立即换装' : `⭐ ${th.cost} 解锁并换装`}
          </button>
        `;
        const btn = card.querySelector('.shop-buy-btn');
        if (!equipped) {
          btn.addEventListener('click', () => buyOrEquipTheme(th.id));
        }
        shopBodyEl.appendChild(card);
      });
    } else {
      shopBodyEl.className = 'shop-body is-three-col';
      PATRONS.forEach((p) => {
        const owned = saveData.unlockedPatrons.includes(p.id);
        const selected = saveData.selectedPatron === p.id;
        const canBuy = !owned && bank >= p.cost;

        const card = document.createElement('div');
        card.className = `shop-card${selected ? ' is-equipped' : ''}`;
        card.innerHTML = `
          <div class="shop-card-top">
            <div class="shop-card-icon"><img src="${p.src}" alt="${p.name}" /></div>
            <div class="shop-card-head">
              <div class="shop-card-title">${p.badge} ${p.shortName}</div>
              <span class="patron-skill-pill">${p.skillName}</span>
            </div>
          </div>
          <div class="shop-card-desc">${p.passiveDesc}</div>
          <button class="wood-btn shop-buy-btn${selected ? ' is-equipped-btn' : ''}" data-shop-id="${p.id}" type="button" ${selected || (!owned && !canBuy) ? 'disabled' : ''}>
            ${selected ? '✓ 当前出战中' : owned ? '🐾 切换出战' : `⭐ ${p.cost} 邀请入店`}
          </button>
        `;
        const btn = card.querySelector('.shop-buy-btn');
        if (!selected) {
          btn.addEventListener('click', () => buyOrSelectPatron(p.id));
        }
        shopBodyEl.appendChild(card);
      });
    }
  }

  function buyUpgrade(id) {
    const up = SHOP_UPGRADES.find((u) => u.id === id);
    if (!up) return;
    const lv = getUpgradeLevel(id);
    if (lv >= up.maxLv) return;
    const cost = up.costs[lv];
    if ((saveData.bankStardust || 0) < cost) {
      showToast(`⭐ 永久星尘不足（需要 ${cost} ⭐）`);
      return;
    }
    audio.ensureCtx();
    saveData.bankStardust -= cost;
    saveData.shopUpgrades[id] = lv + 1;
    persistSaveData();
    audio.playShopBuy();
    showToast(`🏪 升级成功！【${up.name}】升至 Lv.${lv + 1}！`);
    renderShop();
    updateLobbyUI();
  }

  function buyOrEquipTheme(id) {
    const th = JAR_THEMES[id];
    if (!th) return;
    audio.ensureCtx();
    const owned = saveData.unlockedThemes.includes(id);
    if (!owned) {
      if ((saveData.bankStardust || 0) < th.cost) {
        showToast(`⭐ 永久星尘不足（需要 ${th.cost} ⭐）`);
        return;
      }
      saveData.bankStardust -= th.cost;
      saveData.unlockedThemes.push(id);
      saveData.equippedTheme = id;
      persistSaveData();
      audio.playShopBuy();
      showToast(`✨ 已解锁并换上【${th.name}】！`);
    } else {
      saveData.equippedTheme = id;
      persistSaveData();
      audio.playPatronSelect();
      showToast(`${th.icon} 已切换玻璃罐主题：${th.name}`);
    }
    renderShop();
    updateLobbyUI();
  }

  function buyOrSelectPatron(id) {
    const p = PATRONS.find((item) => item.id === id);
    if (!p) return;
    audio.ensureCtx();
    const owned = saveData.unlockedPatrons.includes(id);
    if (!owned) {
      if ((saveData.bankStardust || 0) < p.cost) {
        showToast(`⭐ 永久星尘不足（需要 ${p.cost} ⭐）`);
        return;
      }
      saveData.bankStardust -= p.cost;
      saveData.unlockedPatrons.push(id);
      saveData.selectedPatron = id;
      lobbySpeechIndex = 0;
      persistSaveData();
      audio.playShopBuy();
      showToast(`${p.badge} 欢迎新搭档【${p.name}】加入星夜吃茶！`);
    } else {
      saveData.selectedPatron = id;
      lobbySpeechIndex = 0;
      persistSaveData();
      audio.playPatronSelect();
      showToast(`${p.badge} 已切换助阵搭档：${p.name}`);
    }
    renderShop();
    updateLobbyUI();
  }

  // Career Modal (营业履历)
  function openCareer() {
    if (careerRankTextEl) careerRankTextEl.textContent = getChefRank(getCareerTopScore());
    if (careerModesRowEl) {
      careerModesRowEl.innerHTML = `
        <div class="career-mode-tile"><span>🌟 星夜主厨最高</span><strong>${saveData.bestChef || 0}</strong></div>
        <div class="career-mode-tile"><span>⚡ 90秒狂欢最高</span><strong>${saveData.bestRush || 0}</strong></div>
        <div class="career-mode-tile"><span>🍵 悠闲经典最高</span><strong>${saveData.bestZen || 0}</strong></div>
      `;
    }
    const st = saveData.lifetimeStats || {};
    if (careerStatsGridEl) {
      careerStatsGridEl.innerHTML = `
        <div class="career-stat-mini"><span>累计营业</span><strong>${st.runsPlayed || 0} 局</strong></div>
        <div class="career-stat-mini"><span>完成心愿单</span><strong>${st.ordersCompleted || 0} 单</strong></div>
        <div class="career-stat-mini"><span>最高连击</span><strong>${st.maxComboEver || 1}x</strong></div>
        <div class="career-stat-mini"><span>猫神舒芙蕾</span><strong>${st.soufflesMade || 0} 个</strong></div>
        <div class="career-stat-mini"><span>击碎毛线球</span><strong>${st.yarnBroken || 0} 颗</strong></div>
      `;
    }
    if (careerAchGridEl) {
      careerAchGridEl.innerHTML = '';
      ACHIEVEMENTS.forEach((ach) => {
        const done = ach.check(saveData);
        const t = TIERS[ach.tierImg - 1];
        const card = document.createElement('div');
        card.className = `career-ach-card${done ? '' : ' is-locked'}`;
        card.innerHTML = `
          <img src="${t.src}" alt="${ach.name}" />
          <div class="career-ach-meta">
            <strong>${done ? '✓ ' : ''}${ach.name}</strong>
            <span>${ach.desc}</span>
          </div>
        `;
        careerAchGridEl.appendChild(card);
      });
    }
    careerModal.classList.add('is-open');
    syncAudioMood();
  }

  function closeCareer() {
    careerModal.classList.remove('is-open');
    syncAudioMood();
  }

  // Help Modal (玩法说明)
  function openHelp() {
    helpModal.classList.add('is-open');
    syncAudioMood();
  }

  function closeHelp() {
    helpModal.classList.remove('is-open');
    syncAudioMood();
  }

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
    gameState.dropsMadeThisRun = 0;
    gameState.soufflesMadeThisRun = 0;
    gameState.yarnBrokenThisRun = 0;

    // Apply Kitchen Upgrade: up_fever (Initial Starlight Fever Energy 18% / 32% / 48%)
    const upFeverLv = getUpgradeLevel('up_fever');
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

    // Apply Kitchen Upgrade: up_tools & Mikan Patron Passive (+1 Fork)
    const upToolsLv = getUpgradeLevel('up_tools');
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
    gameState.blessingLockUntil = 0;
    if (blessingReadyBtn) {
      blessingReadyBtn.classList.remove('is-fresh');
      delete blessingReadyBtn.dataset.count;
    }

    // Mode milestones & 90s Rush timer init
    gameState.zenNextMilestone = 500;
    gameState.rushTimer = 90.0;
    gameState.rushFinished = false;
    gameState.rushGustCooldown = 0;
    gameState.rushNextMilestone = 1800;
    gameState.rushLastTickSec = 6;

    // Shop Events state init
    gameState.activeEvent = null;
    gameState.lastEventKind = null;
    gameState.nextEventDrops = 22 + Math.floor(Math.random() * 9);
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
    shopModal.classList.remove('is-open');
    careerModal.classList.remove('is-open');
    helpModal.classList.remove('is-open');
    gameoverModal.classList.remove('is-open');

    showPlayScreen();
    audio.unlock();

    const activePatron = getSelectedPatron();
    if (mode === 'chef') {
      generateOrder();
    } else if (mode === 'rush') {
      gameState.order = null;
      setPatronSpeech(
        activePatron,
        `⚡ 90秒狂欢开跑！${activePatron.shortName}助阵全速冲分，溢罐自动吹散不秒死！`,
        5.0
      );
      renderOrder();
    } else {
      gameState.order = null;
      setPatronSpeech(
        activePatron,
        `悠闲经典模式开启！${activePatron.shortName}陪你慢慢叠搭，达标积分即可抽取三选一祝福～`,
        5.0
      );
      renderOrder();
    }

    updateEvolutionRing();
    updateHUD();
  }

  // Unlock Web Audio & smoothly start cozy café BGM on the player's first gesture
  function handleAudioGestureUnlock(ev) {
    if (ev && ev.target && ev.target.closest && ev.target.closest('#btn-bgm, #btn-lobby-bgm')) return;
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

  // Shared Audio Toggle Handlers (both Lobby and Play bars stay synced)
  function handleToggleSfx() {
    audio.ensureCtx();
    const nextEnabled = !audio.sfxEnabled;
    audio.setSfxEnabled(nextEnabled);
    saveData.sfxEnabled = nextEnabled;
    persistSaveData();
    syncAudioButtons();
    showToast(nextEnabled ? '🔊 游戏音效已开启' : '🔇 游戏音效已关闭');
  }

  function handleCycleBgm() {
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
  }

  // Lobby Event Bindings
  if (modeSelectEl) {
    modeSelectEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.lobby-mode-card');
      if (!btn) return;
      audio.ensureCtx();
      audio.playTilt();
      gameState.mode = btn.dataset.mode;
      updateLobbyUI();
    });
  }

  if (lobbyPatronPortraitBtn) {
    lobbyPatronPortraitBtn.addEventListener('click', pokeLobbyPatron);
  }
  if (btnLobbyBank) btnLobbyBank.addEventListener('click', () => openShop('upgrades'));
  if (lobbyShopPreviewBtn) lobbyShopPreviewBtn.addEventListener('click', () => openShop('themes'));
  if (btnOpenShop) btnOpenShop.addEventListener('click', () => openShop('upgrades'));
  if (btnOpenCareer) btnOpenCareer.addEventListener('click', openCareer);
  if (btnLobbyHelp) btnLobbyHelp.addEventListener('click', openHelp);
  if (btnLobbyCompendium) btnLobbyCompendium.addEventListener('click', openCompendium);
  if (btnLobbyCompM) btnLobbyCompM.addEventListener('click', openCompendium);
  if (btnLobbyBgm) btnLobbyBgm.addEventListener('click', handleCycleBgm);
  if (btnLobbySfx) btnLobbySfx.addEventListener('click', handleToggleSfx);

  if (shopTabsEl) {
    shopTabsEl.addEventListener('click', (ev) => {
      const tab = ev.target.closest('.shop-tab');
      if (!tab) return;
      activeShopTab = tab.dataset.tab;
      renderShop();
    });
  }
  if (btnCloseShop) btnCloseShop.addEventListener('click', closeShop);
  if (shopModal) {
    shopModal.addEventListener('click', (ev) => {
      if (ev.target === shopModal) closeShop();
    });
  }

  if (btnCloseCareer) btnCloseCareer.addEventListener('click', closeCareer);
  if (careerModal) {
    careerModal.addEventListener('click', (ev) => {
      if (ev.target === careerModal) closeCareer();
    });
  }

  if (btnCloseHelp) btnCloseHelp.addEventListener('click', closeHelp);
  if (helpModal) {
    helpModal.addEventListener('click', (ev) => {
      if (ev.target === helpModal) closeHelp();
    });
  }

  // Play Screen Event Bindings
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

  if (btnGoLobby) {
    btnGoLobby.addEventListener('click', () => {
      audio.ensureCtx();
      returnToLobby();
    });
  }

  if (btnBackLobby) {
    btnBackLobby.addEventListener('click', () => {
      audio.ensureCtx();
      returnToLobby();
      showToast('🏠 已回到星夜吃茶大厅');
    });
  }

  btnRestart.addEventListener('click', () => {
    if (isLobbyOpen()) return;
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

  btnSfx.addEventListener('click', handleToggleSfx);
  btnBgm.addEventListener('click', handleCycleBgm);

  btnCompendium.addEventListener('click', openCompendium);
  btnCloseComp.addEventListener('click', closeCompendium);
  compendiumModal.addEventListener('click', (ev) => {
    if (ev.target === compendiumModal) closeCompendium();
  });

  // Inspection hook for automated E2E physics & 3.0 Plan B verification
  window.__HOSHI_DEBUG__ = {
    getState: () => ({
      lobbyOpen: isLobbyOpen(),
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
        isYarnBall: !!e.isYarnBall,
        yarnHp: e.isYarnBall ? e.yarnHp : 0,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        angle: +e.angle.toFixed(3),
        vx: +e.vx.toFixed(2),
        vy: +e.vy.toFixed(2),
        vr: +e.vr.toFixed(3),
        polyCount: e.worldPolys ? e.worldPolys.length : 0
      }))
    }),
    getSaveData: () => JSON.parse(JSON.stringify(saveData)),
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
    },
    triggerEvent: (kind) => triggerShopEvent(kind),
    triggerRushGust: () => triggerRushEmergencyGust(),
    setRushTimer: (sec) => {
      gameState.rushTimer = Math.max(0, Number(sec) || 0);
      updateRushTimerUI();
    },
    addBankStardust: (amt) => {
      saveData.bankStardust = Math.max(0, (saveData.bankStardust || 0) + (Number(amt) || 0));
      persistSaveData();
      updateLobbyUI();
      if (shopModal.classList.contains('is-open')) renderShop();
    },
    startMode: (mode) => startNewRun(mode),
    returnToLobby: () => returnToLobby(),
    openShop: (tab = 'upgrades') => openShop(tab)
  };

  // Boot Sequence
  syncAudioButtons();
  updateLobbyUI();
  syncAudioMood();
  resizeCanvases();
  loadSprites().then(() => {
    buildEvolutionRing();
    updateLobbyUI();
    updateHUD();
    requestAnimationFrame(mainLoop);
  });
})();
