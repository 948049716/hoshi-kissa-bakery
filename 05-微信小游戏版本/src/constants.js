/**
 * Game Constants, Progression Catalogs, Themes, Patrons & Chamber Metrics
 * for Hoshi Kissa: Starlight Patisserie 3.0 Plan B (WeChat Mini Game Edition).
 */
'use strict';

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
    src: 'assets/tier_1.png',
    actSrc: 'assets/tier_1_act.png',
    intSrc: 'assets/tier_1_int.png',
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
    src: 'assets/tier_2.png',
    actSrc: 'assets/tier_2_act.png',
    intSrc: 'assets/tier_2_int.png',
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
    src: 'assets/tier_3.png',
    actSrc: 'assets/tier_3_act.png',
    intSrc: 'assets/tier_3_int.png',
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
    src: 'assets/tier_4.png',
    actSrc: 'assets/tier_4_act.png',
    intSrc: 'assets/tier_4_int.png',
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
    src: 'assets/tier_5.png',
    actSrc: 'assets/tier_5_act.png',
    intSrc: 'assets/tier_5_int.png',
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
    src: 'assets/tier_6.png',
    actSrc: 'assets/tier_6_act.png',
    intSrc: 'assets/tier_6_int.png',
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
    src: 'assets/tier_7.png',
    actSrc: 'assets/tier_7_act.png',
    intSrc: 'assets/tier_7_int.png',
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
    src: 'assets/tier_8.png',
    actSrc: 'assets/tier_8_act.png',
    intSrc: 'assets/tier_8_int.png',
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
    src: 'assets/tier_9.png',
    actSrc: 'assets/tier_9_act.png',
    intSrc: 'assets/tier_9_int.png',
    meta: { anchor_x_norm: 0.4903, anchor_y_norm: 0.6025, radius_norm_w: 0.3841 }
  }
];

const WILDCARD_RADIUS = 20;
const YARN_BALL_RADIUS = 21;

const ASSET_PATHS = {
  bg: 'assets/bakery_bg.jpg',
  hero: 'assets/title_hero.jpg',
  shopSign: 'assets/icon_shop_sign.png',
  yarnBall: 'assets/event_yarn_ball.png',
  tools: {
    shake: 'assets/tool_shake.png',
    fork: 'assets/tool_fork.png',
    spoon: 'assets/tool_spoon.png'
  }
};

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

const PATRONS = [
  {
    id: 'mikan',
    name: '店长 · 小蜜柑',
    shortName: '小蜜柑',
    badge: '🧁',
    cost: 0,
    src: 'assets/chef_mikan.png',
    skillName: '招牌经营',
    passiveDesc: '所有订单积分与星尘 +20%，每局开局额外赠送 +1 泡泡叉',
    shortPassive: '订单+20%·叉+1',
    greet: '刚出炉的星光面糊好香呀～请帮我准备这几份甜点吧！',
    thanks: '太棒啦！香气飘满整条月光街道了呢～',
    idleLines: [
      '欢迎回到星夜吃茶！今晚也要烤出香喷喷的猫神舒芙蕾哦～',
      '喵呜～用小铺的暖炉预热天赋，一开局就能更快进入星光狂热！',
      '把同阶甜点靠得近一点，甜蜜星磁会帮它们亲密合体哦！',
      '如果罐子里滚进了毛线球，在它附近合成两次就能砰地爆出大礼！'
    ]
  },
  {
    id: 'luna',
    name: '常客 · 眠眠星兔',
    shortName: '眠眠星兔',
    badge: '🌙',
    cost: 60,
    src: 'assets/patron_luna.png',
    skillName: '星月睡意',
    passiveDesc: '彩虹万能糖保底 -2 步，狂热持续 +2.0s，开局自带 Lv.1 甜蜜星磁',
    shortPassive: '彩虹-2步·磁吸',
    greet: '唔…今晚的月亮好圆，好想吃软绵绵的甜点呀…',
    thanks: '哇啊！吃到幸福的味道了，谢谢主厨！',
    idleLines: [
      '呼啊～带我一起营业的话，彩虹万能糖会更常来拜访你哦…',
      '在月光下摇晃玻璃罐，好像看着星星在罐子里打盹呢…',
      '90 秒狂欢模式里，我的狂热延长时间超好用哦，冲呀～',
      '软绵绵的棉花糖云朵…嗯？我在帮你吸引同阶甜点啦！'
    ]
  },
  {
    id: 'mugi',
    name: '面包迷 · 蜂蜜柴柴',
    shortName: '蜂蜜柴柴',
    badge: '🍯',
    cost: 100,
    src: 'assets/patron_mugi.png',
    skillName: '元气暴冲',
    passiveDesc: '≥4阶合成星爆冲击波 +30%；每段 ≥3 连击额外回 +4⭐（90秒模式 +60 分）',
    shortPassive: '气浪+30%·连击赏',
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
    ambientRgb: '255, 232, 148',
    stageTint: 'rgba(8, 13, 19, 0.42)'
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
    ambientRgb: '255, 186, 214',
    stageTint: 'rgba(54, 18, 38, 0.38)'
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
    ambientRgb: '150, 228, 255',
    stageTint: 'rgba(8, 26, 48, 0.44)'
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

const SOLO_EMOTES = ['✦', '♪', '喵~', '✨', '♡', '★', '!', '♛', '👑'];

function getChefRank(score) {
  if (score >= 25000) return '👑 传奇猫神糕点宗师';
  if (score >= 12000) return '🌙 星夜首席主厨';
  if (score >= 5500) return '⭐ 银星甜点师';
  if (score >= 2000) return '🧁 温柔烘焙师';
  return '🐾 见习甜点师';
}

module.exports = {
  TIERS,
  WILDCARD_RADIUS,
  YARN_BALL_RADIUS,
  ASSET_PATHS,
  BLESSINGS,
  PATRONS,
  SHOP_UPGRADES,
  JAR_THEMES,
  JAR_THEME_LIST,
  ACHIEVEMENTS,
  JAR,
  STORAGE_KEY,
  SOLO_EMOTES,
  getChefRank
};
