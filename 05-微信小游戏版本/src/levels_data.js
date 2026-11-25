/**
 * 3-Chapter 30-Level Shaped-Grid Campaign Dataset, 24 Dessert Recipes & Unlock Helpers
 * for Hoshi Kissa Bakery v2.0 (WeChat Mini Game Edition).
 */
'use strict';

const CHAPTERS = [
  {
    chapter: 1,
    name: '街角星夜店',
    subtitle: '基础异形盘格与原味猫饼套餐',
    unlockStars: 0,
    prevLevelReq: null,
    firstStarDust: [10, 15, 22],
    baseClearDust: 6,
    themeHint: 'amber',
    maxScoreAntiCheatCap: 35000,
    levelIds: ['1-1', '1-2', '1-3', '1-4', '1-5', '1-6', '1-7', '1-8', '1-9', '1-10']
  },
  {
    chapter: 2,
    name: '樱花露台店',
    subtitle: '宇治抹茶、星光镀金与美食家评委',
    unlockStars: 18,
    prevLevelReq: '1-10',
    firstStarDust: [16, 22, 32],
    baseClearDust: 10,
    themeHint: 'sakura',
    maxScoreAntiCheatCap: 90000,
    levelIds: ['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9', '2-10']
  },
  {
    chapter: 3,
    name: '月光天台店',
    subtitle: '甜心草莓、破冰机制与猫神满汉席',
    unlockStars: 40,
    prevLevelReq: '2-10',
    firstStarDust: [22, 30, 42],
    baseClearDust: 14,
    themeHint: 'moonlight',
    maxScoreAntiCheatCap: 220000,
    levelIds: ['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9', '3-10']
  }
];

const RECIPE_LIST = [
  {
    id: 'R01',
    name: '软萌单球猫',
    slots: [{ tier: 1, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 30,
    unlockLevel: '1-1'
  },
  {
    id: 'R02',
    name: '酥脆猫爪杯',
    slots: [{ tier: 2, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 70,
    unlockLevel: '1-1'
  },
  {
    id: 'R03',
    name: '奶香双爪拼',
    slots: [
      { tier: 1, flavor: 'any' },
      { tier: 2, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 112,
    unlockLevel: '1-1'
  },
  {
    id: 'R04',
    name: '抹茶团子单碟',
    slots: [{ tier: 3, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 150,
    unlockLevel: '1-2'
  },
  {
    id: 'R05',
    name: '吃茶经典双拼',
    slots: [
      { tier: 2, flavor: 'any' },
      { tier: 3, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 246,
    unlockLevel: '1-2'
  },
  {
    id: 'R06',
    name: '双爪曲奇盒',
    slots: [
      { tier: 2, flavor: 'any' },
      { tier: 2, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 157,
    unlockLevel: '1-2'
  },
  {
    id: 'R07',
    name: '蜂蜜布丁杯',
    slots: [{ tier: 4, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 320,
    unlockLevel: '1-3'
  },
  {
    id: 'R08',
    name: '奶团三味早茶',
    slots: [
      { tier: 1, flavor: 'any' },
      { tier: 2, flavor: 'any' },
      { tier: 3, flavor: 'any' }
    ],
    comboMult: 1.25,
    baseScoreLv0: 313,
    unlockLevel: '1-3'
  },
  {
    id: 'R09',
    name: '抹茶布丁拼盘',
    slots: [
      { tier: 3, flavor: 'any' },
      { tier: 4, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 526,
    unlockLevel: '1-4'
  },
  {
    id: 'R10',
    name: '酥脆三重奏',
    slots: [
      { tier: 2, flavor: 'any' },
      { tier: 3, flavor: 'any' },
      { tier: 4, flavor: 'any' }
    ],
    comboMult: 1.25,
    baseScoreLv0: 675,
    unlockLevel: '1-5'
  },
  {
    id: 'R11',
    name: '草莓大福礼盒',
    slots: [{ tier: 5, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 680,
    unlockLevel: '1-6'
  },
  {
    id: 'R12',
    name: '甜心双福组合',
    slots: [
      { tier: 3, flavor: 'any' },
      { tier: 5, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 930,
    unlockLevel: '1-7'
  },
  {
    id: 'R13',
    name: '蜜桃布丁三重塔',
    slots: [
      { tier: 2, flavor: 'any' },
      { tier: 4, flavor: 'any' },
      { tier: 5, flavor: 'any' }
    ],
    comboMult: 1.25,
    baseScoreLv0: 1338,
    unlockLevel: '1-8'
  },
  {
    id: 'R14',
    name: '双层甜蜜塔',
    slots: [
      { tier: 4, flavor: 'any' },
      { tier: 5, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 1120,
    unlockLevel: '1-9'
  },
  {
    id: 'R15',
    name: '宇治抹茶双爪',
    slots: [
      { tier: 2, flavor: 'any' },
      { tier: 3, flavor: 'matcha' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 288,
    unlockLevel: '1-4'
  },
  {
    id: 'R16',
    name: '抹茶猫神布丁',
    slots: [
      { tier: 4, flavor: 'matcha' },
      { tier: 3, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 616,
    unlockLevel: '2-2'
  },
  {
    id: 'R17',
    name: '星空马卡龙礼盒',
    slots: [{ tier: 6, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 1400,
    unlockLevel: '2-1'
  },
  {
    id: 'R18',
    name: '抹茶星空双拼',
    slots: [
      { tier: 3, flavor: 'matcha' },
      { tier: 6, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 1778,
    unlockLevel: '2-4'
  },
  {
    id: 'R19',
    name: '美食家星夜三层塔',
    slots: [
      { tier: 4, flavor: 'any' },
      { tier: 5, flavor: 'any' },
      { tier: 6, flavor: 'any' }
    ],
    comboMult: 1.25,
    baseScoreLv0: 3000,
    unlockLevel: '2-6'
  },
  {
    id: 'R20',
    name: '草莓猫爪果酱盘',
    slots: [
      { tier: 2, flavor: 'any' },
      { tier: 4, flavor: 'berry' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 526,
    unlockLevel: '3-1'
  },
  {
    id: 'R21',
    name: '星冠猫神单献礼',
    slots: [{ tier: 7, flavor: 'any' }],
    comboMult: 1.00,
    baseScoreLv0: 2800,
    unlockLevel: '3-1'
  },
  {
    id: 'R22',
    name: '粉樱草莓双层塔',
    slots: [
      { tier: 5, flavor: 'berry' },
      { tier: 6, flavor: 'any' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 2520,
    unlockLevel: '3-2'
  },
  {
    id: 'R23',
    name: '双韵抹茶草莓拼',
    slots: [
      { tier: 4, flavor: 'matcha' },
      { tier: 5, flavor: 'berry' }
    ],
    comboMult: 1.12,
    baseScoreLv0: 1400,
    unlockLevel: '3-4'
  },
  {
    id: 'R24',
    name: '传说星冠满汉席',
    slots: [
      { tier: 5, flavor: 'berry' },
      { tier: 6, flavor: 'matcha' },
      { tier: 7, flavor: 'any' }
    ],
    comboMult: 1.25,
    baseScoreLv0: 6750,
    unlockLevel: '3-7'
  },
  {
    id: 'R25',
    name: '草莓小爪碟',
    slots: [{ tier: 3, flavor: 'berry' }],
    comboMult: 1.00,
    baseScoreLv0: 188,
    unlockLevel: '2-1'
  }
];

const RECIPES = {};
for (let i = 0; i < RECIPE_LIST.length; i++) {
  const recipe = RECIPE_LIST[i];
  RECIPES[recipe.id] = recipe;
}

const LEVELS = [
  // =========================================================================
  // Chapter 1: 街角星夜店 (1-1 .. 1-10)
  // =========================================================================
  {
    id: '1-1',
    chapter: 1,
    indexInChapter: 1,
    name: '初开夜灯',
    durationSec: 90,
    stars: [1050, 1700, 2000],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['...', '...', '...'],
    presets: [
      { r: 0, c: 0, tier: 1, flavor: 'plain', frozen: false },
      { r: 0, c: 1, tier: 1, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R01', 'R02', 'R03'],
    urgentRate: 0.00,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: 'C1~C2 基础单 · 滑动合成与装盘上菜教学'
  },
  {
    id: '1-2',
    chapter: 1,
    indexInChapter: 2,
    name: '单缺角吧台',
    durationSec: 95,
    stars: [2000, 3300, 4350],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['...#', '....', '...#'],
    presets: [
      { r: 0, c: 0, tier: 1, flavor: 'plain', frozen: false },
      { r: 1, c: 0, tier: 1, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 2, flavor: 'plain', frozen: false },
      { r: 2, c: 1, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R01', 'R02', 'R03', 'R04', 'R05', 'R06'],
    urgentRate: 0.00,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '解锁 C3 抹茶团子 · 异形缺角台阶初体验'
  },
  {
    id: '1-3',
    chapter: 1,
    indexInChapter: 3,
    name: '蜂蜜午茶角',
    durationSec: 100,
    stars: [2850, 4700, 6100],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['..##', '...#', '....', '....'],
    presets: [
      { r: 0, c: 0, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 2, c: 0, tier: 1, flavor: 'plain', frozen: false },
      { r: 3, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08'],
    urgentRate: 0.12,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '解锁 C4 布丁与三品早茶 · 急单首次登场'
  },
  {
    id: '1-4',
    chapter: 1,
    indexInChapter: 4,
    name: '星夜十字盘',
    durationSec: 100,
    stars: [3300, 5450, 7600],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['#..#', '.M..', '..M.', '#..#'],
    presets: [
      { r: 0, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 2, flavor: 'matcha', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 1, tier: 1, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R15'],
    urgentRate: 0.15,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '抹茶洒粉格首秀 · 十字盘染味解锁宇治双爪'
  },
  {
    id: '1-5',
    chapter: 1,
    indexInChapter: 5,
    name: '双凹烘焙槽',
    durationSec: 105,
    stars: [3850, 6350, 7650],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['.##.', '....', '....', '.##.'],
    presets: [
      { r: 0, c: 0, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 3, c: 3, tier: 1, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10'],
    urgentRate: 0.18,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'serve_count', target: 5, earlyClose: false },
    desc: '目标关：累计上菜 5 单 · 四角耳位暂存成品'
  },
  {
    id: '1-6',
    chapter: 1,
    indexInChapter: 6,
    name: '金光大福首秀',
    durationSec: 105,
    stars: [4250, 6700, 8050],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['...#', '.G..', '....', '#...'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 0, tier: 2, flavor: 'plain', frozen: false },
      { r: 2, c: 3, tier: 1, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11'],
    urgentRate: 0.20,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '镀金格首秀 + 解锁 C5 大福 · 镀金 1.35 倍加价'
  },
  {
    id: '1-7',
    chapter: 1,
    indexInChapter: 7,
    name: '满格标准炉',
    durationSec: 110,
    stars: [4350, 7000, 8800],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['....', '....', '....', '....'],
    presets: [
      { r: 0, c: 0, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 3, c: 3, tier: 4, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12'],
    urgentRate: 0.22,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'combo', target: 2, earlyClose: false },
    desc: '目标关：达成 2 连击 · 4x4 满格爽快连合'
  },
  {
    id: '1-8',
    chapter: 1,
    indexInChapter: 8,
    name: '独柱破冰炉',
    durationSec: 110,
    stars: [4450, 6900, 8150],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['....', '.XI.', '....', '....'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 2, flavor: 'plain', frozen: true },
      { r: 2, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 3, c: 0, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13'],
    urgentRate: 0.25,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'ice_clear', target: 1, earlyClose: true },
    desc: '冰封格首秀 · 邻格合成碎冰可提前打烊加分'
  },
  {
    id: '1-9',
    chapter: 1,
    indexInChapter: 9,
    name: '双柱回廊',
    durationSec: 115,
    stars: [4850, 7900, 9300],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['....', '.X..', '..X.', '....'],
    presets: [
      { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 3, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 0, tier: 2, flavor: 'plain', frozen: false },
      { r: 3, c: 3, tier: 4, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14'],
    urgentRate: 0.25,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '对角双木柱外圈回廊 · 高频 C4~C5 甜蜜大单'
  },
  {
    id: '1-10',
    chapter: 1,
    indexInChapter: 10,
    name: '星夜店考核',
    durationSec: 115,
    stars: [5150, 7250, 8850],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['....', '#..#', '....', '.X..', '....'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 0, tier: 4, flavor: 'plain', frozen: false },
      { r: 4, c: 3, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R08', 'R09', 'R10', 'R11', 'R12', 'R13', 'R14'],
    urgentRate: 0.30,
    vipQuota: 1,
    vipQuotaRange: [1, 1],
    vipFixedRecipeId: 'R14',
    rushEndSec: null,
    goal: { type: 'centerpiece', target: 5, earlyClose: true },
    desc: '目标关：献上含 C5 大福大单达标 · 满星提前打烊'
  },

  // =========================================================================
  // Chapter 2: 樱花露台店 (2-1 .. 2-10)
  // =========================================================================
  {
    id: '2-1',
    chapter: 2,
    indexInChapter: 1,
    name: '樱莓双香',
    durationSec: 110,
    stars: [6100, 10000, 12500],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['...#', '.M..', '..B.', '#...'],
    presets: [
      { r: 0, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'berry', frozen: false },
      { r: 3, c: 2, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R07', 'R09', 'R15', 'R16', 'R17', 'R25'],
    urgentRate: 0.20,
    vipQuota: 1,
    vipQuotaRange: [1, 1],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '草莓格首秀 · 解锁草莓小爪碟与 C6 星空马卡龙'
  },
  {
    id: '2-2',
    chapter: 2,
    indexInChapter: 2,
    name: '金光微露',
    durationSec: 115,
    stars: [8400, 13900, 17000],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['#..#', '.G..', '..M.', '....'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 2, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 3, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R07', 'R09', 'R11', 'R15', 'R16', 'R17'],
    urgentRate: 0.22,
    vipQuota: 2,
    vipQuotaRange: [1, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '镀金烘焙格进阶 · 万能风味顶替且享 1.35 倍加价'
  },
  {
    id: '2-3',
    chapter: 2,
    indexInChapter: 3,
    name: '樱花回字廊',
    durationSec: 115,
    stars: [8500, 12800, 15600],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['....', '.XX.', '.GM.', '....'],
    presets: [
      { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 0, c: 3, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 2, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R07', 'R09', 'R11', 'R12', 'R14', 'R15', 'R16', 'R17'],
    urgentRate: 0.25,
    vipQuota: 2,
    vipQuotaRange: [1, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'hot_serve', target: 2, earlyClose: false },
    desc: '目标关：上 2 份整单热乎 · 穿过金箔与抹茶区染味'
  },
  {
    id: '2-4',
    chapter: 2,
    indexInChapter: 4,
    name: '星炉双岛桥',
    durationSec: 120,
    stars: [8600, 12600, 15200],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['..#..', '.MOG.', '..#..', '..#..'],
    presets: [
      { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 3, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 4, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18'],
    urgentRate: 0.25,
    vipQuota: 2,
    vipQuotaRange: [2, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '星炉格 O 首秀 · 桥心停满 6 秒自动升 1 阶（最高 C5）'
  },
  {
    id: '2-5',
    chapter: 2,
    indexInChapter: 5,
    name: '抹茶星塔',
    durationSec: 120,
    stars: [8700, 12300, 16600],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['.M..', '...G', 'G...', '..M.'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 3, tier: 4, flavor: 'gold', frozen: false },
      { r: 2, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 3, c: 0, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19'],
    urgentRate: 0.25,
    vipQuota: 2,
    vipQuotaRange: [2, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'serve_count', target: 7, earlyClose: false },
    desc: '目标关：本局上菜 7 单 · 双金双抹全通炉冲星夜塔'
  },
  {
    id: '2-6',
    chapter: 2,
    indexInChapter: 6,
    name: '美食家之夜',
    durationSec: 125,
    stars: [8800, 14200, 18600],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['#...#', '.M.G.', '..X..', '..B..'],
    presets: [
      { r: 0, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 3, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 3, c: 3, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R25'],
    urgentRate: 0.25,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '3 位美食家 VIP 固定来访 · 留好高阶镀金饼迎宾'
  },
  {
    id: '2-7',
    chapter: 2,
    indexInChapter: 7,
    name: '十字星炉廊',
    durationSec: 125,
    stars: [9250, 15100, 18400],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['..X..', '.G.M.', '..#..', '..O..'],
    presets: [
      { r: 0, c: 0, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 1, c: 3, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19'],
    urgentRate: 0.28,
    vipQuota: 3,
    vipQuotaRange: [2, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'combo', target: 3, earlyClose: false },
    desc: '目标关：达成 3 连击 · 底部星炉持续升阶助攻'
  },
  {
    id: '2-8',
    chapter: 2,
    indexInChapter: 8,
    name: '五行双炉盘',
    durationSec: 130,
    stars: [10300, 16400, 19400],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['#...#', '.OM..', '.XGX.', '..MO.', '#...#'],
    presets: [
      { r: 0, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 4, flavor: 'matcha', frozen: false },
      { r: 2, c: 2, tier: 5, flavor: 'gold', frozen: false },
      { r: 3, c: 1, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19'],
    urgentRate: 0.28,
    vipQuota: 3,
    vipQuotaRange: [2, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '5x5 八角星盘 · 双星炉与中央黄金底座齐开'
  },
  {
    id: '2-9',
    chapter: 2,
    indexInChapter: 9,
    name: '双桥花坊',
    durationSec: 130,
    stars: [10500, 16700, 19700],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['..#..', '.MXG.', '..#..', '.GXM.', '..B..'],
    presets: [
      { r: 0, c: 1, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 3, tier: 4, flavor: 'matcha', frozen: false },
      { r: 4, c: 2, tier: 5, flavor: 'berry', frozen: false }
    ],
    allowedRecipes: ['R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R25'],
    urgentRate: 0.30,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'hot_serve', target: 3, earlyClose: false },
    desc: '目标关：上 3 份整单热乎 · 底部草莓长廊汇聚大饼'
  },
  {
    id: '2-10',
    chapter: 2,
    indexInChapter: 10,
    name: '樱花露台大赏',
    durationSec: 135,
    stars: [10600, 15400, 19100],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['#...#', '.G.G.', '..X..', '.M.M.', '.....'],
    presets: [
      { r: 0, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 3, tier: 4, flavor: 'matcha', frozen: false },
      { r: 4, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 4, c: 4, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R14', 'R15', 'R16', 'R17', 'R18', 'R19'],
    urgentRate: 0.32,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'centerpiece', target: 6, earlyClose: true },
    desc: '目标关：献上含 C6 星空马卡龙达标 · 满星提前打烊'
  },

  // =========================================================================
  // Chapter 3: 月光天台店 (3-1 .. 3-10)
  // =========================================================================
  {
    id: '3-1',
    chapter: 3,
    indexInChapter: 1,
    name: '草莓雪夜',
    durationSec: 120,
    stars: [10700, 14100, 18400],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['.....', '.BI..', '..IM.', '#...#'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 0, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 2, flavor: 'berry', frozen: false },
      { r: 1, c: 2, tier: 4, flavor: 'plain', frozen: true },
      { r: 2, c: 2, tier: 4, flavor: 'plain', frozen: true },
      { r: 2, c: 4, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R15', 'R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22'],
    urgentRate: 0.25,
    vipQuota: 2,
    vipQuotaRange: [2, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '草莓格与冰封格首秀 · 邻格合成破冰解锁 C7 猫神'
  },
  {
    id: '3-2',
    chapter: 3,
    indexInChapter: 2,
    name: '蜜糖风味台',
    durationSec: 125,
    stars: [10800, 14300, 18600],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['#...#', '.M.B.', '.SI..', '.I..#', '#..##'],
    presets: [
      { r: 0, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 3, tier: 3, flavor: 'berry', frozen: false },
      { r: 2, c: 2, tier: 5, flavor: 'plain', frozen: true },
      { r: 3, c: 1, tier: 4, flavor: 'plain', frozen: true }
    ],
    allowedRecipes: ['R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22'],
    urgentRate: 0.28,
    vipQuota: 3,
    vipQuotaRange: [2, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '蜜糖格 S 首秀 · 滑入猫饼停留卡位助力破冰'
  },
  {
    id: '3-3',
    chapter: 3,
    indexInChapter: 3,
    name: '冰封双塔',
    durationSec: 125,
    stars: [11900, 19600, 23600],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['..#..', '.IXI.', '.M.B.', '..G..', '#...#'],
    presets: [
      { r: 0, c: 0, tier: 2, flavor: 'plain', frozen: false },
      { r: 0, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 4, flavor: 'plain', frozen: true },
      { r: 1, c: 3, tier: 4, flavor: 'plain', frozen: true },
      { r: 2, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 2, tier: 4, flavor: 'gold', frozen: false }
    ],
    allowedRecipes: ['R16', 'R17', 'R18', 'R19', 'R20', 'R21', 'R22', 'R23'],
    urgentRate: 0.30,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'ice_clear', target: 2, earlyClose: true },
    desc: '目标关：击碎全部 2 块冰封 · 清冰即提前打烊加分'
  },
  {
    id: '3-4',
    chapter: 3,
    indexInChapter: 4,
    name: '风味蜜糖盘',
    durationSec: 130,
    stars: [12100, 18000, 21700],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['.M.B.', '..I..', 'SXGXS', '..I..', '.B.M.'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 0, c: 3, tier: 3, flavor: 'berry', frozen: false },
      { r: 1, c: 2, tier: 5, flavor: 'plain', frozen: true },
      { r: 3, c: 2, tier: 4, flavor: 'plain', frozen: true },
      { r: 4, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R18', 'R19', 'R20', 'R21', 'R22', 'R23'],
    urgentRate: 0.30,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'limited_knead', target: 14, earlyClose: false },
    desc: '目标关：限揉面 14 次 · 善用左右蜜糖格精算合成'
  },
  {
    id: '3-5',
    chapter: 3,
    indexInChapter: 5,
    name: '星冠天台',
    durationSec: 135,
    stars: [14500, 19600, 24900],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['##.##', '#.I.#', '.MGB.', '.I.I.', '.....'],
    presets: [
      { r: 0, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 5, flavor: 'plain', frozen: true },
      { r: 2, c: 2, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 1, tier: 4, flavor: 'plain', frozen: true },
      { r: 3, c: 3, tier: 4, flavor: 'plain', frozen: true },
      { r: 4, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 4, c: 2, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R18', 'R19', 'R20', 'R21', 'R22', 'R23'],
    urgentRate: 0.30,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '金字塔三冰封尖塔 · 底层破冰贯通冲击 C7 猫神'
  },
  {
    id: '3-6',
    chapter: 3,
    indexInChapter: 6,
    name: '猫神降临礼',
    durationSec: 135,
    stars: [16900, 27500, 32400],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['#.O.#', '.GIM.', '.SXS.', '.BIG.', '#...#'],
    presets: [
      { r: 0, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 5, flavor: 'plain', frozen: true },
      { r: 1, c: 3, tier: 4, flavor: 'matcha', frozen: false },
      { r: 3, c: 1, tier: 4, flavor: 'berry', frozen: false },
      { r: 3, c: 2, tier: 5, flavor: 'plain', frozen: true },
      { r: 4, c: 2, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R19', 'R20', 'R21', 'R22', 'R23', 'R24'],
    urgentRate: 0.32,
    vipQuota: 4,
    vipQuotaRange: [3, 4],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '传说满汉席开放 · 顶部星炉与双蜜糖速合猫神蛋糕'
  },
  {
    id: '3-7',
    chapter: 3,
    indexInChapter: 7,
    name: '满汉极速流',
    durationSec: 140,
    stars: [17500, 25300, 30100],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['..XM.', '.I...', 'X.G.X', '...I.', '.BX..'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 0, c: 3, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 1, tier: 5, flavor: 'plain', frozen: true },
      { r: 2, c: 2, tier: 5, flavor: 'gold', frozen: false },
      { r: 3, c: 3, tier: 5, flavor: 'plain', frozen: true },
      { r: 4, c: 1, tier: 3, flavor: 'berry', frozen: false }
    ],
    allowedRecipes: ['R19', 'R20', 'R21', 'R22', 'R23', 'R24'],
    urgentRate: 0.32,
    vipQuota: 4,
    vipQuotaRange: [3, 4],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'limited_knead', target: 16, earlyClose: false },
    desc: '目标关：限揉面 16 次 · 善用搭档主动技破局洗牌'
  },
  {
    id: '3-8',
    chapter: 3,
    indexInChapter: 8,
    name: '碎冰三重奏',
    durationSec: 140,
    stars: [17700, 25300, 30400],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['.I.I.', '.M.B.', '#.G.#', '.B.M.', '.I.I.'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: true },
      { r: 0, c: 3, tier: 3, flavor: 'plain', frozen: true },
      { r: 1, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 2, c: 2, tier: 5, flavor: 'gold', frozen: false },
      { r: 3, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 4, c: 1, tier: 4, flavor: 'plain', frozen: true },
      { r: 4, c: 3, tier: 4, flavor: 'plain', frozen: true }
    ],
    allowedRecipes: ['R19', 'R20', 'R21', 'R22', 'R23', 'R24'],
    urgentRate: 0.35,
    vipQuota: 4,
    vipQuotaRange: [4, 4],
    vipFixedRecipeId: null,
    rushEndSec: null,
    goal: { type: 'ice_clear', target: 4, earlyClose: true },
    desc: '目标关：击碎四角全部 4 块冰封 · 清冰即提前打烊'
  },
  {
    id: '3-9',
    chapter: 3,
    indexInChapter: 9,
    name: '星海终曲前夜',
    durationSec: 145,
    stars: [17900, 24100, 32700],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['..#..', '.GXM.', '.ISI.', '.BXG.', '..#..'],
    presets: [
      { r: 0, c: 1, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 2, c: 1, tier: 5, flavor: 'plain', frozen: true },
      { r: 2, c: 3, tier: 5, flavor: 'plain', frozen: true },
      { r: 3, c: 3, tier: 4, flavor: 'gold', frozen: false },
      { r: 4, c: 3, tier: 3, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R19', 'R20', 'R21', 'R22', 'R23', 'R24'],
    urgentRate: 0.35,
    vipQuota: 4,
    vipQuotaRange: [4, 4],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '中轴蜜糖双脊窄廊 · 巧借宽托盘暂存半成品腾道'
  },
  {
    id: '3-10',
    chapter: 3,
    indexInChapter: 10,
    name: '星冠夜宴终章',
    durationSec: 150,
    stars: [18700, 28000, 33000],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['#...#', '.MIB.', '.IGI.', '.BXM.', '#...#'],
    presets: [
      { r: 0, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 5, flavor: 'plain', frozen: true },
      { r: 2, c: 1, tier: 5, flavor: 'plain', frozen: true },
      { r: 2, c: 2, tier: 6, flavor: 'gold', frozen: false },
      { r: 2, c: 3, tier: 5, flavor: 'plain', frozen: true },
      { r: 4, c: 2, tier: 4, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R18', 'R19', 'R20', 'R21', 'R22', 'R23', 'R24'],
    urgentRate: 0.35,
    vipQuota: 5,
    vipQuotaRange: [5, 5],
    vipFixedRecipeId: null,
    rushEndSec: 15,
    goal: { type: 'centerpiece', target: 6, earlyClose: false },
    desc: '全章总决赛 · 献上含 C6+ 盛宴冲击猫神满汉席'
  }
];

const LEVEL_MAP = {};
const VALID_LEVEL_IDS = [];
for (let i = 0; i < LEVELS.length; i++) {
  const lvl = LEVELS[i];
  LEVEL_MAP[lvl.id] = lvl;
  VALID_LEVEL_IDS.push(lvl.id);
}

const MAX_CAMPAIGN_STARS = LEVELS.length * 3;

function toSafeNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '') return Number(x);
  return NaN;
}

function getClampedLevelStar(levelStars, id) {
  if (!levelStars || typeof levelStars !== 'object' || Array.isArray(levelStars)) return 0;
  if (typeof id !== 'string') return 0;
  if (!Object.prototype.hasOwnProperty.call(LEVEL_MAP, id)) return 0;
  if (!Object.prototype.hasOwnProperty.call(levelStars, id)) return 0;
  const raw = toSafeNum(levelStars[id]);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(3, Math.max(0, Math.floor(raw)));
}

function getLevelById(id) {
  if (typeof id !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(LEVEL_MAP, id)) return null;
  return LEVEL_MAP[id];
}

function getNextLevelId(id) {
  if (typeof id !== 'string') return null;
  const idx = VALID_LEVEL_IDS.indexOf(id);
  if (idx < 0 || idx + 1 >= VALID_LEVEL_IDS.length) return null;
  return VALID_LEVEL_IDS[idx + 1];
}

function computeTotalStars(levelStars) {
  if (!levelStars || typeof levelStars !== 'object' || Array.isArray(levelStars)) return 0;
  let total = 0;
  for (let i = 0; i < VALID_LEVEL_IDS.length; i++) {
    total += getClampedLevelStar(levelStars, VALID_LEVEL_IDS[i]);
  }
  return total;
}

function isChapterUnlocked(chapterNum, levelStars) {
  const num = toSafeNum(chapterNum);
  if (!Number.isFinite(num) || !Number.isInteger(num)) {
    return { unlocked: false, reason: '未知章节', requiredStars: 0, prevLevelReq: null };
  }
  const chap = CHAPTERS.find((c) => c.chapter === num);
  if (!chap) {
    return { unlocked: false, reason: '未知章节', requiredStars: 0, prevLevelReq: null };
  }
  if (chap.chapter === 1) {
    return { unlocked: true, reason: '', requiredStars: 0, prevLevelReq: null };
  }
  const totalStars = computeTotalStars(levelStars);
  const prevCleared = chap.prevLevelReq ? getClampedLevelStar(levelStars, chap.prevLevelReq) >= 1 : true;
  const enoughStars = totalStars >= chap.unlockStars;
  if (prevCleared && enoughStars) {
    return {
      unlocked: true,
      reason: '',
      requiredStars: chap.unlockStars,
      prevLevelReq: chap.prevLevelReq
    };
  }
  let reason = '';
  if (!prevCleared && !enoughStars) {
    reason = `需通关 ${chap.prevLevelReq} 且累计满 ${chap.unlockStars} 星（当前 ${totalStars}/${chap.unlockStars} 星）`;
  } else if (!prevCleared) {
    reason = `需先通关第 ${chap.prevLevelReq} 关`;
  } else {
    reason = `需累计满 ${chap.unlockStars} 星解锁第 ${chap.chapter} 章（当前 ${totalStars}/${chap.unlockStars} 星）`;
  }
  return {
    unlocked: false,
    reason,
    requiredStars: chap.unlockStars,
    prevLevelReq: chap.prevLevelReq
  };
}

function isLevelUnlocked(levelId, levelStars) {
  const lvl = getLevelById(levelId);
  if (!lvl) {
    return { unlocked: false, reason: '未知关卡' };
  }
  if (lvl.id === '1-1') {
    return { unlocked: true, reason: '' };
  }
  const chapStatus = isChapterUnlocked(lvl.chapter, levelStars);
  if (!chapStatus.unlocked) {
    return { unlocked: false, reason: chapStatus.reason };
  }
  if (lvl.indexInChapter === 1) {
    return { unlocked: true, reason: '' };
  }
  const prevId = `${lvl.chapter}-${lvl.indexInChapter - 1}`;
  if (getClampedLevelStar(levelStars, prevId) >= 1) {
    return { unlocked: true, reason: '' };
  }
  return {
    unlocked: false,
    reason: `需先通关第 ${prevId} 关`
  };
}

module.exports = {
  CHAPTERS,
  RECIPES,
  RECIPE_LIST,
  LEVELS,
  LEVEL_MAP,
  VALID_LEVEL_IDS,
  MAX_CAMPAIGN_STARS,
  getLevelById,
  getNextLevelId,
  computeTotalStars,
  isChapterUnlocked,
  isLevelUnlocked
};
