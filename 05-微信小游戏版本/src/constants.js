/**
 * Static Catalogs, Progression Tables, Chef Patrons, Board Themes & Atlas Maps
 * for Hoshi Kissa Bakery v2.0 (WeChat Mini Game Edition).
 */
'use strict';

const STORAGE_KEY = 'hoshi_kissa_bakery_save_v1';
const GAME_TITLE = '一起做猫饼';

const CATCAKE_UPGRADE_COSTS = {
  1: [20, 40, 70, 110],
  2: [25, 50, 85, 130],
  3: [35, 65, 105, 160],
  4: [45, 85, 135, 200],
  5: [60, 110, 170, 250],
  6: [80, 140, 220, 320],
  7: [100, 180, 280, 400]
};

const CATCAKES = [
  {
    tier: 1,
    id: 'C1',
    name: '奶团小猫饼',
    color: '#FFF3DC',
    crumbColor: '#FFF9EE',
    basePrice: 30,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[1],
    unlockLevel: '1-1',
    src: 'assets/catcake_1.png',
    happySrc: 'assets/catcake_1_happy.png',
    desc: '圆滚滚白面团小猫饼，豆豆眼配微翘小猫耳，带着温柔奶香。'
  },
  {
    tier: 2,
    id: 'C2',
    name: '焦糖猫爪曲奇',
    color: '#E8A656',
    crumbColor: '#FBE0B4',
    basePrice: 70,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[2],
    unlockLevel: '1-1',
    src: 'assets/catcake_2.png',
    happySrc: 'assets/catcake_2_happy.png',
    desc: '烘烤金黄酥脆的猫爪黄油曲奇，焦糖肉垫印着微笑小猫脸。'
  },
  {
    tier: 3,
    id: 'C3',
    name: '抹茶猫耳团子',
    color: '#7DA85C',
    crumbColor: '#CFE8B4',
    basePrice: 150,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[3],
    unlockLevel: '1-1',
    src: 'assets/catcake_3.png',
    happySrc: 'assets/catcake_3_happy.png',
    desc: '软糯回甘的宇治抹茶双耳圆团，点缀暖粉腮红与金星糖珠。'
  },
  {
    tier: 4,
    id: 'C4',
    name: '蜂蜜猫猫布丁',
    color: '#F2C849',
    crumbColor: '#FFE89E',
    basePrice: 320,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[4],
    unlockLevel: '1-3',
    src: 'assets/catcake_4.png',
    happySrc: 'assets/catcake_4_happy.png',
    desc: '焦糖顶盖玻璃碟布丁，琥珀蜂蜜小猫慵懒趴在布丁顶上。'
  },
  {
    tier: 5,
    id: 'C5',
    name: '草莓猫咪大福',
    color: '#F29EB6',
    crumbColor: '#FFD8E4',
    basePrice: 680,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[5],
    unlockLevel: '1-6',
    src: 'assets/catcake_5.png',
    happySrc: 'assets/catcake_5_happy.png',
    desc: '樱粉软糯麻薯裹着雪白奶油须，头顶鲜红欲滴的甜心草莓。'
  },
  {
    tier: 6,
    id: 'C6',
    name: '星空猫马卡龙',
    color: '#9B7FD6',
    crumbColor: '#E3D6FF',
    basePrice: 1400,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[6],
    unlockLevel: '2-1',
    src: 'assets/catcake_6.png',
    happySrc: 'assets/catcake_6_happy.png',
    desc: '薰衣草紫双层星空糖霜马卡龙，夹着银星箔纸猫耳与云朵奶霜。'
  },
  {
    tier: 7,
    id: 'C7',
    name: '星冠猫神蛋糕',
    color: '#F5BE58',
    crumbColor: '#FFEB9E',
    basePrice: 2800,
    maxUpgradeLv: 4,
    upgradeCosts: CATCAKE_UPGRADE_COSTS[7],
    unlockLevel: '3-1',
    src: 'assets/catcake_7.png',
    happySrc: 'assets/catcake_7_happy.png',
    desc: '头戴闪耀小皇冠的蓬松双层舒芙蕾猫神蛋糕，星夜吃茶至高献礼。'
  }
];

const CATCAKE_MAP = {};
for (const item of CATCAKES) {
  CATCAKE_MAP[item.tier] = item;
  Object.defineProperty(CATCAKE_MAP, item.id, {
    value: item,
    enumerable: false,
    configurable: false,
    writable: false
  });
}

function toSafeNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '') return Number(x);
  return NaN;
}

function getCatcakePrice(tier, upgradeLv = 0) {
  let key = null;
  if (typeof tier === 'number') {
    if (Number.isInteger(tier) && tier >= 1 && tier <= 7) {
      key = String(tier);
    }
  } else if (typeof tier === 'string') {
    const trimmed = tier.trim();
    if (/^(?:[1-7]|C[1-7])$/.test(trimmed)) {
      key = trimmed;
    }
  }
  if (key === null || !Object.prototype.hasOwnProperty.call(CATCAKE_MAP, key)) {
    return 0;
  }
  const def = CATCAKE_MAP[key];
  if (!def || typeof def.basePrice !== 'number' || !Number.isFinite(def.basePrice)) {
    return 0;
  }
  const rawLv = toSafeNum(upgradeLv);
  const lv = Number.isFinite(rawLv)
    ? Math.max(0, Math.min(4, Math.floor(rawLv)))
    : 0;
  return Math.round(def.basePrice * (1 + 0.2 * lv));
}

const FLAVORS = {
  plain: {
    id: 'plain',
    name: '原味',
    shortLabel: '原味',
    mult: 1.0,
    isWildcard: false,
    cellCode: '.',
    tileIcon: null,
    color: '#FFF6E5',
    badgeColor: '#C69F69'
  },
  matcha: {
    id: 'matcha',
    name: '宇治抹茶',
    shortLabel: '抹茶',
    mult: 1.35,
    isWildcard: false,
    cellCode: 'M',
    tileIcon: 'tile_matcha',
    color: '#7DA85C',
    badgeColor: '#4E7D34'
  },
  berry: {
    id: 'berry',
    name: '甜心草莓',
    shortLabel: '草莓',
    mult: 1.35,
    isWildcard: false,
    cellCode: 'B',
    tileIcon: 'tile_berry',
    color: '#E86A8C',
    badgeColor: '#C84067'
  },
  gold: {
    id: 'gold',
    name: '星光金箔',
    shortLabel: '镀金',
    mult: 1.50,
    isWildcard: true,
    cellCode: 'G',
    tileIcon: 'tile_gold',
    color: '#F5BE58',
    badgeColor: '#D48B1C'
  }
};

const COMBO_SIZE_MULTS = {
  1: 1.00,
  2: 1.18,
  3: 1.35
};

const SERVE_COMBO_MULTS = [1.00, 1.10, 1.22, 1.35, 1.50];
const SERVE_COMBO_WINDOW_SEC = 10.0;

const PATIENCE_TIP_BANDS = {
  greenThreshold: 0.55,
  greenMult: 1.30,
  yellowThreshold: 0.25,
  yellowMult: 1.00,
  redMult: 0.85
};

const FEVER_CONFIG = {
  durationSec: 10.0,
  scoreMult: 1.35,
  patienceDecayMult: 0.5,
  gainNormal: 20,
  gainGreen: 25,
  gainVip: 35
};

const DEVICE_UPGRADE_COSTS = {
  dev_tray: [60, 150],
  dev_flour: [45, 95, 170],
  dev_teapot: [50, 105, 185],
  dev_tools: [40, 90, 160]
};

function getSafeDeviceDesc(ctx, fallbackIdx, maxLv, lv) {
  const descs =
    ctx && Array.isArray(ctx.levelDescs)
      ? ctx.levelDescs
      : SHOP_DEVICES[fallbackIdx].levelDescs;
  const raw = toSafeNum(lv);
  const idx = Number.isFinite(raw)
    ? Math.max(0, Math.min(maxLv, Math.floor(raw)))
    : 0;
  return descs[idx];
}

const SHOP_DEVICES = [
  {
    id: 'dev_tray',
    name: '宽大木托盘',
    icon: 'serve_bell',
    maxLv: 2,
    costs: DEVICE_UPGRADE_COSTS.dev_tray,
    traySlots: [3, 4, 4],
    threeItemBonus: [0, 0, 0.12],
    desc: '扩充配餐托盘容量至 4 格，满级 3 品套餐额外享 +12% 装盘小费',
    levelDescs: [
      '当前 3 格托盘 · 下级：扩充至 4 格托盘',
      '当前 4 格托盘 · 下级：4 格且 3 品套餐 +12% 小费',
      '已满级：4 格宽大托盘 · 3 品套餐永久 +12% 小费'
    ],
    getDesc(lv = 0) {
      return getSafeDeviceDesc(this, 0, 2, lv);
    }
  },
  {
    id: 'dev_flour',
    name: '精选猫饼粉',
    icon: 'icon_sieve',
    maxLv: 3,
    costs: DEVICE_UPGRADE_COSTS.dev_flour,
    c2Rates: [0.10, 0.18, 0.26, 0.35],
    desc: '提升滑动与揉面补料直接刷出 2 阶焦糖猫爪曲奇的概率',
    levelDescs: [
      '当前 C2 概率 10% · 下级：提升至 18%',
      '当前 C2 概率 18% · 下级：提升至 26%',
      '当前 C2 概率 26% · 下级：提升至 35%',
      '已满级：滑动与补料刷出 C2 概率达 35%'
    ],
    getDesc(lv = 0) {
      return getSafeDeviceDesc(this, 1, 3, lv);
    }
  },
  {
    id: 'dev_teapot',
    name: '暖心红茶壶',
    icon: 'icon_hourglass',
    maxLv: 3,
    costs: DEVICE_UPGRADE_COSTS.dev_teapot,
    patienceBonus: [0, 0.12, 0.24, 0.38],
    desc: '好茶暖人心，延长全体在座顾客的初始耐心等待时长',
    levelDescs: [
      '当前耐心 +0% · 下级：初始耐心延长 +12%',
      '当前耐心 +12% · 下级：初始耐心延长 +24%',
      '当前耐心 +24% · 下级：初始耐心延长 +38%',
      '已满级：全体顾客初始耐心延长 +38%'
    ],
    getDesc(lv = 0) {
      return getSafeDeviceDesc(this, 2, 3, lv);
    }
  },
  {
    id: 'dev_tools',
    name: '备货厨具架',
    icon: 'icon_toolbox',
    maxLv: 3,
    costs: DEVICE_UPGRADE_COSTS.dev_tools,
    startTools: [
      { fork: 1, spoon: 0 },
      { fork: 1, spoon: 1 },
      { fork: 2, spoon: 1 },
      { fork: 2, spoon: 2 }
    ],
    desc: '增加每关开局免费携带的泡泡清格叉与升阶魔法勺数量',
    levelDescs: [
      '当前开局 叉1 勺0 · 下级：开局 叉1 勺1',
      '当前开局 叉1 勺1 · 下级：开局 叉2 勺1',
      '当前开局 叉2 勺1 · 下级：开局 叉2 勺2',
      '已满级：每关开局免费自带 清格叉×2 · 升阶勺×2'
    ],
    getDesc(lv = 0) {
      return getSafeDeviceDesc(this, 3, 3, lv);
    }
  }
];

const CUSTOMERS = [
  {
    id: 'cust_ragdoll',
    name: '奶糖布偶猫',
    patienceMult: 1.15,
    bountyMult: 1.00,
    isUrgent: false,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 0,
    atlasRow: 0,
    preferredFlavor: 'any',
    preferredSlotCounts: [1, 2],
    preferredMaxTier: 3,
    desc: '温柔随和的蓝眼布偶猫，偏爱 1~2 品基础小甜点。'
  },
  {
    id: 'cust_orange',
    name: '焦糖橘猫大叔',
    patienceMult: 1.00,
    bountyMult: 1.00,
    isUrgent: false,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 1,
    atlasRow: 0,
    preferredFlavor: 'any',
    preferredSlotCounts: [2, 3],
    desc: '食量豪爽的胖橘猫大叔，喜欢 2~3 品双拼大份量组合。'
  },
  {
    id: 'cust_silver',
    name: '银渐层书生猫',
    patienceMult: 1.05,
    bountyMult: 1.00,
    isUrgent: false,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 2,
    atlasRow: 0,
    preferredFlavor: 'matcha',
    preferredSlotCounts: [1, 2, 3],
    desc: '品味挑剔的书生猫，第 2 章起高频点名宇治抹茶风味猫饼。'
  },
  {
    id: 'cust_rabbit',
    name: '奶油垂耳兔',
    patienceMult: 1.00,
    bountyMult: 1.00,
    isUrgent: false,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 3,
    atlasRow: 0,
    preferredFlavor: 'berry',
    preferredSlotCounts: [1, 2, 3],
    desc: '元气甜美的垂耳兔常客，第 3 章起高频点名草莓果酱猫饼。'
  },
  {
    id: 'cust_fox',
    name: '焦糖小狐狸',
    patienceMult: 0.78,
    bountyMult: 1.25,
    isUrgent: true,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 0,
    atlasRow: 1,
    badgeText: '急单 ×1.25',
    badgeIcon: 'icon_flame',
    preferredFlavor: 'any',
    preferredSlotCounts: [1, 2],
    desc: '赶时间的急性子上班族，耐心掉得快但小费高达 1.25 倍。'
  },
  {
    id: 'cust_raccoon',
    name: '栗子小浣熊',
    patienceMult: 1.10,
    bountyMult: 1.00,
    isUrgent: false,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 1,
    atlasRow: 1,
    preferredFlavor: 'any',
    preferredSlotCounts: [3],
    preferredMaxTier: 4,
    desc: '喜欢多种小饼混搭的小浣熊，偏爱 3 品组合塔套餐。'
  },
  {
    id: 'cust_shiba',
    name: '蓝莓小柴犬',
    patienceMult: 0.95,
    bountyMult: 1.00,
    isUrgent: false,
    isVip: false,
    rewardDustBonus: 0,
    atlasCol: 2,
    atlasRow: 1,
    preferredFlavor: 'any',
    preferredSlotCounts: [1, 2, 3],
    desc: '活力十足的全品类常客，各阶猫饼随机组合都爱点。'
  },
  {
    id: 'cust_critic',
    name: '星冠美食家白猫',
    patienceMult: 0.85,
    bountyMult: 1.50,
    isUrgent: false,
    isVip: true,
    rewardDustBonus: 5,
    atlasCol: 3,
    atlasRow: 1,
    badgeText: 'VIP ×1.5',
    badgeIcon: 'icon_crown',
    preferredFlavor: 'any',
    preferredMinTier: 5,
    preferredSlotCounts: [1, 2, 3],
    desc: '星冠 VIP 美食评委，必点高阶或风味名点，完单额外赠 5 星尘红包。'
  }
];

const CUSTOMER_MAP = {};
const CUSTOMERS_ATLAS_RECTS = {};
for (const c of CUSTOMERS) {
  CUSTOMER_MAP[c.id] = c;
  CUSTOMERS_ATLAS_RECTS[c.id] = {
    x: c.atlasCol * 256,
    y: c.atlasRow * 256,
    w: 256,
    h: 256
  };
}

const BOARD_TILES_ATLAS_RECTS = {
  tile_gold: { x: 0, y: 0, w: 128, h: 128 },
  tile_matcha: { x: 128, y: 0, w: 128, h: 128 },
  tile_berry: { x: 256, y: 0, w: 128, h: 128 },
  tile_block: { x: 384, y: 0, w: 128, h: 128 },
  tile_ice: { x: 0, y: 128, w: 128, h: 128 },
  btn_knead: { x: 128, y: 128, w: 128, h: 128 },
  btn_trash: { x: 256, y: 128, w: 128, h: 128 },
  badge_flavor_set: { x: 384, y: 128, w: 128, h: 128 }
};

const PATRON_COSTS = {
  mikan: 0,
  luna: 80,
  mugi: 120
};

function normalizePatronId(rawId) {
  if (typeof rawId !== 'string') return 'mikan';
  if (rawId === 'luna' || rawId === 'patron_luna') return 'luna';
  if (rawId === 'mugi' || rawId === 'patron_mugi') return 'mugi';
  if (rawId === 'mikan' || rawId === 'chef_mikan') return 'mikan';
  return 'mikan';
}

const PATRONS = [
  {
    id: 'mikan',
    name: '小蜜柑',
    shortName: '小蜜柑',
    badge: 'mode_chef',
    cost: PATRON_COSTS.mikan,
    src: 'assets/chef_mikan.png',
    skillName: '安抚猫薄荷茶',
    activeSkill: {
      id: 'comfort_tea',
      icon: 'icon_stardust',
      name: '安抚猫薄荷茶',
      shortLabel: '安抚茶',
      patienceRestoreRatio: 0.45,
      freezeSec: 5.0,
      chargeNormalServe: 28,
      chargeVipServe: 40,
      chargeHighMerge: 8,
      highMergeMinTier: 5,
      desc: '全体在座顾客耐心立刻恢复 +45%，且接下来 5.0 秒内顾客耐心冻结不流逝'
    },
    passive: {
      serveScoreMult: 1.08,
      c2RateBonus: 0,
      combo3Bonus: 0
    },
    passiveDesc: '全套餐上菜得分永久 +8% · 主动技恢复全座 45% 耐心并冻结 5 秒',
    shortPassive: '全单得分 +8%',
    greet: '今天也一起来烤香喷喷的猫饼吧！',
    thanks: '热乎乎的猫饼端上桌啦，香气满满～',
    idleLines: [
      '轻点亮金圈的猫饼装进托盘，凑齐套餐就自动上菜啦！',
      '急缺小面团时，随时点击下方揉面补料哦～',
      '放错托盘别慌，双击托盘槽位就能倒进厨余篮！',
      '我的安抚猫薄荷茶能帮焦急的客人稳住耐心哦～'
    ]
  },
  {
    id: 'luna',
    name: '眠眠星兔',
    shortName: '眠眠星兔',
    badge: 'icon_moon',
    cost: PATRON_COSTS.luna,
    src: 'assets/patron_luna.png',
    skillName: '星月整盘术',
    activeSkill: {
      id: 'lunar_tidy',
      icon: 'icon_moon',
      name: '星月整盘术',
      shortLabel: '整盘术',
      clearTier: 1,
      sortDescending: true,
      nextServeMult: 1.50,
      chargeNormalServe: 28,
      chargeVipServe: 40,
      chargeHighMerge: 8,
      highMergeMinTier: 5,
      desc: '瞬间清除盘内所有非冰封 1 阶猫饼，剩余猫饼按高到低归拢左上角，且下一份上菜得分 ×1.50'
    },
    passive: {
      serveScoreMult: 1.00,
      c2RateBonus: 0.08,
      combo3Bonus: 0
    },
    passiveDesc: '滑动与补料刷出 C2 概率额外 +8% · 主动技清 1 阶整盘且下一单 ×1.50',
    shortPassive: 'C2 概率 +8%',
    greet: '今晚月色真温柔，烤盘乱了就交给我整理吧～',
    thanks: '星光落进甜点里啦，谢谢店长！',
    idleLines: [
      '带我出战，揉面和滑动更容易直接刷出焦糖猫爪曲奇哦～',
      '星月整盘术能一键清空 1 阶面团并把大猫饼排整齐！',
      '释放星月整盘术后，紧接着端出的大单享 1.5 倍高分呢',
      '镀金猫饼可是万能风味王牌，留给挑剔的客人最划算～'
    ]
  },
  {
    id: 'mugi',
    name: '蜂蜜柴柴',
    shortName: '蜂蜜柴柴',
    badge: 'icon_flame',
    cost: PATRON_COSTS.mugi,
    src: 'assets/patron_mugi.png',
    skillName: '元气烤炉暴击',
    activeSkill: {
      id: 'oven_crit',
      icon: 'icon_flame',
      name: '元气烤炉暴击',
      shortLabel: '烤炉暴击',
      shatterAllIce: true,
      upgradeCount: 2,
      grantFlavor: 'gold',
      chargeNormalServe: 28,
      chargeVipServe: 40,
      chargeHighMerge: 8,
      highMergeMinTier: 5,
      desc: '震碎全盘所有冰封格，并随机选取最多 2 颗非满阶猫饼直接 +1 阶且附加镀金状态'
    },
    passive: {
      serveScoreMult: 1.00,
      c2RateBonus: 0,
      combo3Bonus: 0.10
    },
    passiveDesc: '达成 3 连及以上上菜时额外 +10% 加成 · 主动技全屏破冰并镀金升阶 2 颗猫饼',
    shortPassive: '3 连上菜 +10%',
    greet: '汪呜！火力全开，连着上菜冲三星吧！',
    thanks: '太满足啦！金灿灿的猫饼最棒了！',
    idleLines: [
      '遇到冰封格别怕，在它上下左右相邻格合成就能震碎冰壳！',
      '我的元气烤炉暴击能全屏破冰，还送两颗镀金升阶猫饼！',
      '保持 10 秒内连续出餐，3 连以上有我的额外 10% 加成哦！',
      '合出 5 阶以上大猫饼还能加快充能招牌技呢！'
    ]
  }
];

const TOOLS = {
  fork: {
    id: 'fork',
    name: '泡泡清格叉',
    shortName: '清格叉',
    icon: 'tool_fork',
    cost: 15,
    maxBuyPerLevel: 1,
    src: 'assets/tool_fork.png',
    shortcutKey: '1',
    desc: '点选烤盘内任意一颗猫饼将其消除腾空位，或直接震碎冰封格冰壳'
  },
  spoon: {
    id: 'spoon',
    name: '升阶魔法勺',
    shortName: '升阶勺',
    icon: 'tool_spoon',
    cost: 20,
    maxBuyPerLevel: 1,
    src: 'assets/tool_spoon.png',
    shortcutKey: '2',
    desc: '点选烤盘内任意一颗 1~6 阶非冰封猫饼，立即升为下一阶并保留原有风味'
  }
};

const THEME_COSTS = {
  amber: 0,
  sakura: 80,
  moonlight: 120
};

const BOARD_THEMES = {
  amber: {
    id: 'amber',
    icon: 'icon_stardust',
    name: '经典星夜琥珀盘',
    cost: THEME_COSTS.amber,
    desc: '暖胡桃木外框配暖米茶色格底，暗金星光边框与暖金萤火虫',
    frameStops: ['#d59c3b', '#ad7424', '#8c5a18'],
    frameBorder: '#4A2C2A',
    frameHighlight: 'rgba(255, 250, 220, 0.72)',
    boardBgTop: '#243B4A',
    boardBgBot: '#182834',
    boardInnerBorder: 'rgba(255, 224, 132, 0.45)',
    cellFill: 'rgba(255, 244, 218, 0.88)',
    cellFillAlt: 'rgba(250, 236, 202, 0.88)',
    cellBorder: '#C69552',
    cellInnerSheen: 'rgba(255, 252, 240, 0.65)',
    trayBg: '#6E4221',
    trayBorder: '#432418',
    traySlotFill: 'rgba(255, 246, 224, 0.90)',
    traySlotBorder: '#B98848',
    collar: ['#ffe495', '#d59c3b', '#8c5a18'],
    collarHighlight: 'rgba(255, 250, 220, 0.72)',
    rimGlow: 'rgba(255, 244, 214, 0.35)',
    guideLine: 'rgba(255, 224, 132, 0.62)',
    lockColor: [255, 228, 102],
    moteKind: 'star',
    moteColor: 'rgba(255, 236, 178, 0.28)',
    ambientRgb: '255, 232, 148',
    stageTint: 'rgba(8, 13, 19, 0.42)'
  },
  sakura: {
    id: 'sakura',
    icon: 'icon_ribbon',
    name: '樱花琉璃木盘',
    cost: THEME_COSTS.sakura,
    desc: '玫瑰金樱粉包边配浅暮樱粉格底，飘落水彩樱花瓣粒子',
    frameStops: ['#ffd1e1', '#df86a5', '#b05675'],
    frameBorder: '#4A2C2A',
    frameHighlight: 'rgba(255, 238, 246, 0.82)',
    boardBgTop: '#5E2B44',
    boardBgBot: '#3E1A2C',
    boardInnerBorder: 'rgba(255, 198, 220, 0.50)',
    cellFill: 'rgba(255, 235, 243, 0.90)',
    cellFillAlt: 'rgba(252, 224, 236, 0.90)',
    cellBorder: '#D484A0',
    cellInnerSheen: 'rgba(255, 248, 252, 0.72)',
    trayBg: '#7D3B56',
    trayBorder: '#4A2233',
    traySlotFill: 'rgba(255, 240, 246, 0.92)',
    traySlotBorder: '#CC7E99',
    collar: ['#ffd1e1', '#df86a5', '#b05675'],
    collarHighlight: 'rgba(255, 238, 246, 0.82)',
    rimGlow: 'rgba(255, 198, 220, 0.48)',
    guideLine: 'rgba(255, 182, 212, 0.72)',
    lockColor: [255, 162, 206],
    moteKind: 'petal',
    moteColor: 'rgba(255, 192, 218, 0.45)',
    ambientRgb: '255, 186, 214',
    stageTint: 'rgba(54, 18, 38, 0.38)'
  },
  moonlight: {
    id: 'moonlight',
    icon: 'icon_moon',
    name: '深海月光石盘',
    cost: THEME_COSTS.moonlight,
    desc: '秘银月白包边配冰月浅蓝格底，悬浮冷月星海微光粒子',
    frameStops: ['#e6f7ff', '#87bddb', '#48779c'],
    frameBorder: '#2C465E',
    frameHighlight: 'rgba(240, 252, 255, 0.85)',
    boardBgTop: '#1A4063',
    boardBgBot: '#102840',
    boardInnerBorder: 'rgba(166, 232, 255, 0.48)',
    cellFill: 'rgba(225, 244, 255, 0.88)',
    cellFillAlt: 'rgba(210, 236, 252, 0.88)',
    cellBorder: '#6EA6C9',
    cellInnerSheen: 'rgba(245, 252, 255, 0.75)',
    trayBg: '#2B5374',
    trayBorder: '#1A344B',
    traySlotFill: 'rgba(234, 248, 255, 0.90)',
    traySlotBorder: '#6BA2C4',
    collar: ['#e6f7ff', '#87bddb', '#48779c'],
    collarHighlight: 'rgba(240, 252, 255, 0.85)',
    rimGlow: 'rgba(166, 232, 255, 0.46)',
    guideLine: 'rgba(148, 226, 255, 0.72)',
    lockColor: [132, 226, 255],
    moteKind: 'starfish',
    moteColor: 'rgba(154, 236, 255, 0.42)',
    ambientRgb: '150, 228, 255',
    stageTint: 'rgba(8, 26, 48, 0.44)'
  }
};

const BOARD_THEME_LIST = [BOARD_THEMES.amber, BOARD_THEMES.sakura, BOARD_THEMES.moonlight];

const ASSET_PATHS = {
  bg: 'assets/bakery_bg.jpg',
  shopSign: 'assets/icon_shop_sign.png',
  uiAtlas: 'assets/ui_atlas.png',
  uiAtlas2: 'assets/ui_atlas_2.png',
  uiAtlas3: 'assets/ui_atlas_3.png',
  titlePlaque: 'assets/ui_title_plaque.png',
  patronStage: 'assets/ui_patron_stage.png',
  serveBell: 'assets/ui_serve_bell.png',

  hero: 'assets/title_hero_v2.jpg',
  customersAtlas: 'assets/customers_atlas.png',
  boardTilesAtlas: 'assets/board_tiles_atlas.png',

  patrons: {
    mikan: 'assets/chef_mikan.png',
    luna: 'assets/patron_luna.png',
    mugi: 'assets/patron_mugi.png'
  },

  tools: {
    fork: 'assets/tool_fork.png',
    spoon: 'assets/tool_spoon.png'
  },

  catcakes: {
    1: 'assets/catcake_1.png',
    2: 'assets/catcake_2.png',
    3: 'assets/catcake_3.png',
    4: 'assets/catcake_4.png',
    5: 'assets/catcake_5.png',
    6: 'assets/catcake_6.png',
    7: 'assets/catcake_7.png'
  },
  catcakesHappy: {
    1: 'assets/catcake_1_happy.png',
    2: 'assets/catcake_2_happy.png',
    3: 'assets/catcake_3_happy.png',
    4: 'assets/catcake_4_happy.png',
    5: 'assets/catcake_5_happy.png',
    6: 'assets/catcake_6_happy.png',
    7: 'assets/catcake_7_happy.png'
  }
};

const UI_ATLAS_RECTS = {
  mode_chef: { x: 0, y: 0, w: 128, h: 128 },
  mode_rush: { x: 128, y: 0, w: 128, h: 128 },
  mode_zen: { x: 256, y: 0, w: 128, h: 128 },
  icon_shop: { x: 384, y: 0, w: 128, h: 128 },
  icon_book: { x: 0, y: 128, w: 128, h: 128 },
  icon_trophy: { x: 128, y: 128, w: 128, h: 128 },
  icon_stardust: { x: 256, y: 128, w: 128, h: 128 },
  icon_coin: { x: 384, y: 128, w: 128, h: 128 },
  icon_bgm: { x: 0, y: 256, w: 128, h: 128 },
  icon_sfx: { x: 128, y: 256, w: 128, h: 128 },
  icon_help: { x: 256, y: 256, w: 128, h: 128 },
  icon_home: { x: 384, y: 256, w: 128, h: 128 },
  icon_restart: { x: 0, y: 384, w: 128, h: 128 },
  icon_gift: { x: 128, y: 384, w: 128, h: 128 },
  icon_launcher: { x: 256, y: 384, w: 128, h: 128 },
  icon_paw_guide: { x: 384, y: 384, w: 128, h: 128 }
};

const UI_ATLAS_2_RECTS = {
  icon_cloud: { x: 0, y: 0, w: 128, h: 128 },
  icon_local_save: { x: 128, y: 0, w: 128, h: 128 },
  icon_id_card: { x: 256, y: 0, w: 128, h: 128 },
  icon_warn: { x: 384, y: 0, w: 128, h: 128 },
  icon_medal_1: { x: 0, y: 128, w: 128, h: 128 },
  icon_medal_2: { x: 128, y: 128, w: 128, h: 128 },
  icon_medal_3: { x: 256, y: 128, w: 128, h: 128 },
  icon_judge: { x: 384, y: 128, w: 128, h: 128 },
  icon_frost: { x: 0, y: 256, w: 128, h: 128 },
  icon_flame: { x: 128, y: 256, w: 128, h: 128 },
  icon_wind: { x: 256, y: 256, w: 128, h: 128 },
  icon_divider: { x: 384, y: 256, w: 128, h: 128 },
  icon_bumper: { x: 0, y: 384, w: 128, h: 128 },
  icon_magnet: { x: 128, y: 384, w: 128, h: 128 },
  icon_rainbow: { x: 256, y: 384, w: 128, h: 128 },
  icon_bolt: { x: 384, y: 384, w: 128, h: 128 }
};

const UI_ATLAS_3_RECTS = {
  icon_wave: { x: 0, y: 0, w: 128, h: 128 },
  icon_billiard: { x: 128, y: 0, w: 128, h: 128 },
  icon_alchemy: { x: 256, y: 0, w: 128, h: 128 },
  icon_crown: { x: 384, y: 0, w: 128, h: 128 },
  icon_infinity: { x: 0, y: 128, w: 128, h: 128 },
  icon_prism: { x: 128, y: 128, w: 128, h: 128 },
  icon_arrow: { x: 256, y: 128, w: 128, h: 128 },
  icon_ufo: { x: 384, y: 128, w: 128, h: 128 },
  icon_ledger: { x: 0, y: 256, w: 128, h: 128 },
  icon_ribbon: { x: 128, y: 256, w: 128, h: 128 },
  icon_scale: { x: 256, y: 256, w: 128, h: 128 },
  icon_moon: { x: 384, y: 256, w: 128, h: 128 },
  icon_sieve: { x: 0, y: 384, w: 128, h: 128 },
  icon_hourglass: { x: 128, y: 384, w: 128, h: 128 },
  icon_toolbox: { x: 256, y: 384, w: 128, h: 128 },
  icon_close: { x: 384, y: 384, w: 128, h: 128 }
};

const TUTORIAL_STEPS = [
  {
    id: 'intro_slide_1',
    saveKey: 'intro_slide',
    levelId: '1-1',
    stepIndex: 1,
    groupTotal: 3,
    nextStepId: 'intro_slide_2',
    trigger: 'level_start',
    focus: 'board_merge',
    spotlightCells: [{ r: 0, c: 0 }, { r: 0, c: 1 }],
    spotlightHitIds: [],
    completeOn: 'valid_merge_slide',
    icon: 'icon_paw_guide',
    tag: '新手引导 1/3',
    title: '滑动合成猫饼',
    text: '向左或向右滑动，把两颗小面团合成为焦糖猫爪曲奇！',
    lines: ['向左或向右滑动烤盘，将两颗奶团小猫饼合成为焦糖猫爪曲奇']
  },
  {
    id: 'intro_slide_2',
    saveKey: 'intro_slide',
    levelId: '1-1',
    stepIndex: 2,
    groupTotal: 3,
    nextStepId: 'intro_slide_3',
    trigger: 'after_intro_slide_1',
    focus: 'knead_btn',
    spotlightCells: [],
    spotlightHitIds: ['knead_btn'],
    completeOn: 'knead_click',
    icon: 'btn_knead',
    tag: '新手引导 2/3',
    title: '揉面补充原料',
    text: '急缺原料时，点击【揉面补料】随时往盘里加 1 颗小猫饼！',
    lines: ['点击下方揉面补料按钮，随时往烤盘空格投放 1 颗新猫饼']
  },
  {
    id: 'intro_slide_3',
    saveKey: 'intro_slide',
    levelId: '1-1',
    stepIndex: 3,
    groupTotal: 3,
    nextStepId: null,
    trigger: 'after_intro_slide_2',
    focus: 'serve_tray',
    spotlightCells: 'servable',
    spotlightHitIds: ['tray_slot_0', 'tray_slot_1', 'tray_slot_2'],
    completeOn: 'first_order_served',
    icon: 'serve_bell',
    tag: '新手引导 3/3',
    title: '装盘自动上菜得分',
    text: '单击亮金圈的猫饼装进配餐托盘，凑齐订单就自动上菜得分啦！',
    lines: ['轻点亮暖金圈的猫饼装入配餐托盘，凑齐顾客菜单即可自动上菜得分']
  },
  {
    id: 'tray_trash',
    saveKey: 'tray_trash',
    levelId: '1-3',
    stepIndex: 1,
    groupTotal: 1,
    nextStepId: null,
    trigger: 'tray_multi_or_full',
    focus: 'tray_trash',
    spotlightCells: [],
    spotlightHitIds: ['tray_slot_0', 'tray_slot_1', 'tray_slot_2', 'tray_trash_btn'],
    completeOn: 'tray_trash_or_auto_fade',
    autoFadeSec: 6.0,
    icon: 'btn_trash',
    tag: '托盘技巧',
    title: '双击丢弃腾出托盘',
    text: '放错或想换组合？双击托盘里的猫饼即可丢进厨余桶腾位（不扣分）！',
    lines: ['快速双击托盘槽位即可将猫饼丢进厨余篮腾位，绝不扣减已有分数']
  },
  {
    id: 'flavor_tile',
    saveKey: 'flavor_tile',
    levelId: '2-1',
    stepIndex: 1,
    groupTotal: 1,
    nextStepId: null,
    trigger: 'level_start',
    focus: 'flavor_tile',
    spotlightCellTypes: ['matcha'],
    spotlightHitIds: [],
    completeOn: 'matcha_dye_or_merge',
    icon: 'tile_matcha',
    tag: '风味烘焙格',
    title: '宇治抹茶洒粉染色',
    text: '带绿叶的格子会为猫饼洒上抹茶粉！搭配抹茶订单可享 ×1.35 赏金！',
    lines: ['猫饼停留在抹茶格或于此合成即染为抹茶风味，同阶跨风味依然可正常合并']
  },
  {
    id: 'ice_tile',
    saveKey: 'ice_tile',
    levelId: '3-1',
    stepIndex: 1,
    groupTotal: 1,
    nextStepId: null,
    trigger: 'level_start',
    focus: 'ice_tile',
    spotlightCells: 'frozen_and_orthogonal',
    spotlightHitIds: [],
    completeOn: 'ice_shatter',
    icon: 'tile_ice',
    tag: '邻接破冰',
    title: '正交合成震碎冰壳',
    text: '冰封猫饼被冻住啦！在它上下左右相邻格完成一次合成就能震碎冰壳！',
    lines: ['在冰封格正上下左右 4 个相邻格完成合成（或用清格叉）即可破冰释放猫饼']
  }
];

for (const step of TUTORIAL_STEPS) {
  Object.defineProperty(TUTORIAL_STEPS, step.id, {
    value: step,
    enumerable: false,
    configurable: false,
    writable: false
  });
}
Object.defineProperty(TUTORIAL_STEPS, 'intro_slide', {
  value: TUTORIAL_STEPS[0],
  enumerable: false,
  configurable: false,
  writable: false
});

const VALID_SAVE_LEVEL_ID_RE = /^(?:[123]-(?:[1-9]|10))$/;

function getSafeSaveLevelStar(s, id) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 0;
  if (typeof id !== 'string' || !VALID_SAVE_LEVEL_ID_RE.test(id)) return 0;
  const levelStars = Object.prototype.hasOwnProperty.call(s, 'levelStars') ? s.levelStars : null;
  if (!levelStars || typeof levelStars !== 'object' || Array.isArray(levelStars)) return 0;
  if (!Object.prototype.hasOwnProperty.call(levelStars, id)) return 0;
  const v = toSafeNum(levelStars[id]);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(3, Math.max(0, Math.floor(v)));
}

function getSafeLifetimeStat(s, key) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 0;
  if (typeof key !== 'string') return 0;
  const stats = Object.prototype.hasOwnProperty.call(s, 'lifetimeStats') ? s.lifetimeStats : null;
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return 0;
  if (!Object.prototype.hasOwnProperty.call(stats, key)) return 0;
  const v = toSafeNum(stats[key]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function sumSaveStars(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 0;
  const ts = getSafeLifetimeStat(s, 'totalStars');
  if (ts > 0) {
    return Math.min(90, Math.max(0, ts));
  }
  const levelStars = Object.prototype.hasOwnProperty.call(s, 'levelStars') ? s.levelStars : null;
  if (levelStars && typeof levelStars === 'object' && !Array.isArray(levelStars)) {
    let sum = 0;
    const keys = Object.keys(levelStars);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!VALID_SAVE_LEVEL_ID_RE.test(k)) continue;
      sum += getSafeSaveLevelStar(s, k);
    }
    return Math.min(90, sum);
  }
  return 0;
}

const ACHIEVEMENTS = [
  {
    id: 'first_serve',
    tierImg: 1,
    catcakeTier: 1,
    icon: 'serve_bell',
    name: '初开夜灯',
    desc: '成功完成第 1 单猫饼上菜',
    check: (s) => getSafeLifetimeStat(s, 'ordersServed') >= 1
  },
  {
    id: 'combo_4',
    tierImg: 2,
    catcakeTier: 2,
    icon: 'icon_flame',
    name: '行云流水',
    desc: '达成 4 连及以上连续上菜',
    check: (s) => getSafeLifetimeStat(s, 'maxComboEver') >= 4
  },
  {
    id: 'ch1_clear',
    tierImg: 3,
    catcakeTier: 3,
    icon: 'mode_chef',
    name: '街角名店',
    desc: '通关第 1 章 1-10 星夜店考核',
    check: (s) => getSafeSaveLevelStar(s, '1-10') >= 1
  },
  {
    id: 'vip_5',
    tierImg: 4,
    catcakeTier: 4,
    icon: 'icon_crown',
    name: '美食家赞许',
    desc: '累计服务 5 位星冠美食家白猫',
    check: (s) => getSafeLifetimeStat(s, 'vipServed') >= 5
  },
  {
    id: 'stars_30',
    tierImg: 5,
    catcakeTier: 5,
    icon: 'icon_stardust',
    name: '繁星满盘',
    desc: '累计获得 30 颗关卡评星',
    check: (s) => sumSaveStars(s) >= 30
  },
  {
    id: 'ch2_clear',
    tierImg: 6,
    catcakeTier: 6,
    icon: 'icon_ribbon',
    name: '樱花主厨',
    desc: '通关第 2 章 2-10 樱花露台大赏',
    check: (s) => getSafeSaveLevelStar(s, '2-10') >= 1
  },
  {
    id: 'campaign_clear',
    tierImg: 7,
    catcakeTier: 7,
    icon: 'icon_moon',
    name: '月光猫神祭',
    desc: '通关终章 3-10 星冠夜宴终章',
    check: (s) => getSafeSaveLevelStar(s, '3-10') >= 1
  },
  {
    id: 'stars_90',
    tierImg: 7,
    catcakeTier: 7,
    icon: 'icon_trophy',
    name: '全三星猫神宗师',
    desc: '全部 30 关达成 90 星满星毕业',
    check: (s) => sumSaveStars(s) >= 90
  }
];

const DEFAULT_NPC_RIVALS = [
  { nickName: '月光甜点师·小葵', avatarPreset: 'luna', totalStars: 87, totalCumulativeScore: 618400, isNpc: true },
  { nickName: '甜点大师喵', avatarPreset: 'mikan', totalStars: 76, totalCumulativeScore: 462800, isNpc: true },
  { nickName: '柴柴烘焙坊', avatarPreset: 'mugi', totalStars: 58, totalCumulativeScore: 284500, isNpc: true },
  { nickName: '焦糖布丁喵', avatarPreset: 'mikan', totalStars: 39, totalCumulativeScore: 146200, isNpc: true },
  { nickName: '星露茶会·奈奈', avatarPreset: 'luna', totalStars: 22, totalCumulativeScore: 54800, isNpc: true },
  { nickName: '晚风猫饼屋', avatarPreset: 'mugi', totalStars: 9, totalCumulativeScore: 12600, isNpc: true }
];

const CHEF_RANK_TIERS = [
  { minStars: 85, minScore: 500000, title: '传奇猫神宗师' },
  { minStars: 65, minScore: 280000, title: '月光星冠主厨' },
  { minStars: 40, minScore: 130000, title: '樱花首席甜点师' },
  { minStars: 18, minScore: 40000, title: '星夜主厨店长' },
  { minStars: 6, minScore: 4000, title: '温柔猫饼烘焙师' },
  { minStars: 0, minScore: 0, title: '见习猫饼学徒' }
];

function getChefRank(starsOrInput = 0, cumulativeScoreArg = null) {
  let stars = 0;
  let score = 0;

  if (starsOrInput && typeof starsOrInput === 'object') {
    if (!Array.isArray(starsOrInput)) {
      let resolvedStars = null;
      if (
        Object.prototype.hasOwnProperty.call(starsOrInput, 'totalStars') &&
        starsOrInput.totalStars !== undefined &&
        starsOrInput.totalStars !== null
      ) {
        const ts = toSafeNum(starsOrInput.totalStars);
        resolvedStars = Number.isFinite(ts) && ts > 0 ? Math.min(90, Math.floor(ts)) : 0;
      }
      stars = resolvedStars !== null ? resolvedStars : sumSaveStars(starsOrInput);

      let resolvedScore = 0;
      if (Object.prototype.hasOwnProperty.call(starsOrInput, 'totalCumulativeScore')) {
        const tcs = toSafeNum(starsOrInput.totalCumulativeScore);
        if (Number.isFinite(tcs) && tcs > 0) {
          resolvedScore = Math.floor(tcs);
        }
      }
      if (resolvedScore === 0) {
        const lifeScore = getSafeLifetimeStat(starsOrInput, 'totalCumulativeScore');
        if (lifeScore > 0) {
          resolvedScore = lifeScore;
        } else if (Object.prototype.hasOwnProperty.call(starsOrInput, 'score')) {
          const sc = toSafeNum(starsOrInput.score);
          if (Number.isFinite(sc) && sc > 0) {
            resolvedScore = Math.floor(sc);
          }
        }
      }
      score = resolvedScore;
    }
  } else {
    const rawNum = toSafeNum(starsOrInput);
    const num = Number.isFinite(rawNum) && rawNum > 0 ? rawNum : 0;
    if (cumulativeScoreArg !== null && cumulativeScoreArg !== undefined) {
      stars = Math.min(90, Math.floor(num));
      const rawScoreArg = toSafeNum(cumulativeScoreArg);
      score = Number.isFinite(rawScoreArg) && rawScoreArg > 0 ? Math.floor(rawScoreArg) : 0;
    } else if (num <= 90) {
      stars = Math.floor(num);
    } else {
      score = Math.floor(num);
    }
  }

  for (const tier of CHEF_RANK_TIERS) {
    if (stars >= tier.minStars && tier.minStars > 0) return tier.title;
    if (score >= tier.minScore && tier.minScore > 0) return tier.title;
  }
  return CHEF_RANK_TIERS[CHEF_RANK_TIERS.length - 1].title;
}

module.exports = {
  STORAGE_KEY,
  GAME_TITLE,
  CATCAKES,
  CATCAKE_MAP,
  CATCAKE_UPGRADE_COSTS,
  getCatcakePrice,
  FLAVORS,
  COMBO_SIZE_MULTS,
  SERVE_COMBO_MULTS,
  SERVE_COMBO_WINDOW_SEC,
  PATIENCE_TIP_BANDS,
  FEVER_CONFIG,
  SHOP_DEVICES,
  DEVICE_UPGRADE_COSTS,
  CUSTOMERS,
  CUSTOMER_MAP,
  CUSTOMERS_ATLAS_RECTS,
  BOARD_TILES_ATLAS_RECTS,
  PATRONS,
  PATRON_COSTS,
  normalizePatronId,
  TOOLS,
  BOARD_THEMES,
  BOARD_THEME_LIST,
  THEME_COSTS,
  ASSET_PATHS,
  UI_ATLAS_RECTS,
  UI_ATLAS_2_RECTS,
  UI_ATLAS_3_RECTS,
  TUTORIAL_STEPS,
  ACHIEVEMENTS,
  DEFAULT_NPC_RIVALS,
  getChefRank
};
