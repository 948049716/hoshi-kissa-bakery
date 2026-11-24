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
    unlockLevel: '2-1'
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
    stars: [850, 1250, 1750],
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
    stars: [1250, 1820, 2500],
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
    stars: [1850, 2700, 3700],
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
    stars: [2250, 3280, 4450],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['#..#', '....', '....', '#..#'],
    presets: [
      { r: 0, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'plain', frozen: false },
      { r: 3, c: 1, tier: 1, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09'],
    urgentRate: 0.15,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: 'C2~C4 十字四翼盘 · 善用装盘清理边角位'
  },
  {
    id: '1-5',
    chapter: 1,
    indexInChapter: 5,
    name: '双凹烘焙槽',
    durationSec: 105,
    stars: [2700, 3920, 5350],
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
    desc: 'C1~C4 组合 · 四角耳位暂存高阶成品'
  },
  {
    id: '1-6',
    chapter: 1,
    indexInChapter: 6,
    name: '草莓大福首秀',
    durationSec: 105,
    stars: [3250, 4750, 6450],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['...#', '....', '....', '#...'],
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
    desc: '解锁 C5 草莓猫咪大福 · 斜梯宽盘冲高分'
  },
  {
    id: '1-7',
    chapter: 1,
    indexInChapter: 7,
    name: '满格标准炉',
    durationSec: 110,
    stars: [3950, 5750, 7800],
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
    desc: '4x4 满格爽快连合 · C2~C5 双拼与三拼套餐'
  },
  {
    id: '1-8',
    chapter: 1,
    indexInChapter: 8,
    name: '独柱分流炉',
    durationSec: 110,
    stars: [4300, 6250, 8450],
    baseClearDust: 6,
    firstStarDust: [10, 15, 22],
    matrix: ['....', '.X..', '....', '....'],
    presets: [
      { r: 0, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 1, c: 2, tier: 2, flavor: 'plain', frozen: false },
      { r: 2, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 3, c: 0, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12', 'R13'],
    urgentRate: 0.25,
    vipQuota: 0,
    vipQuotaRange: [0, 0],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '木质障碍柱登场 · 利用分段挡板卡位合大饼'
  },
  {
    id: '1-9',
    chapter: 1,
    indexInChapter: 9,
    name: '双柱回廊',
    durationSec: 115,
    stars: [4750, 6900, 9350],
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
    stars: [5400, 7850, 10600],
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
    desc: '第 1 章关底考核 · 美食家 VIP 惊喜试访点双层塔'
  },

  // =========================================================================
  // Chapter 2: 樱花露台店 (2-1 .. 2-10)
  // =========================================================================
  {
    id: '2-1',
    chapter: 2,
    indexInChapter: 1,
    name: '抹茶初绽',
    durationSec: 110,
    stars: [6500, 9450, 12900],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['...#', '.M..', '..M.', '#...'],
    presets: [
      { r: 0, c: 1, tier: 2, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 2, c: 2, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 2, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R05', 'R07', 'R09', 'R15', 'R16', 'R17'],
    urgentRate: 0.20,
    vipQuota: 1,
    vipQuotaRange: [1, 1],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '抹茶洒粉格教学 · 解锁 C6 星空马卡龙与抹茶单'
  },
  {
    id: '2-2',
    chapter: 2,
    indexInChapter: 2,
    name: '金光微露',
    durationSec: 115,
    stars: [7400, 10750, 14700],
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
    desc: '镀金烘焙格教学 · 万能风味顶替且享 1.35 倍加价'
  },
  {
    id: '2-3',
    chapter: 2,
    indexInChapter: 3,
    name: '樱花回字廊',
    durationSec: 115,
    stars: [8400, 12200, 16700],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['....', '.XX.', '.GM.', '....'],
    presets: [
      { r: 0, c: 0, tier: 3, flavor: 'plain', frozen: false },
      { r: 0, c: 3, tier: 3, flavor: 'plain', frozen: false },
      { r: 2, c: 1, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 2, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R09', 'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18'],
    urgentRate: 0.25,
    vipQuota: 2,
    vipQuotaRange: [1, 2],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '中心双木柱回廊 · 穿过底部金箔与抹茶区染味'
  },
  {
    id: '2-4',
    chapter: 2,
    indexInChapter: 4,
    name: '露台双岛桥',
    durationSec: 120,
    stars: [9400, 13650, 18700],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['..#..', '.M.G.', '..#..', '..#..'],
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
    desc: '哑铃双岛独木桥 · 中行互通左右分区烘烤'
  },
  {
    id: '2-5',
    chapter: 2,
    indexInChapter: 5,
    name: '抹茶星塔',
    durationSec: 120,
    stars: [10650, 15450, 21100],
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
    desc: '双金双抹全通炉 · 冲击美食家星夜三层塔'
  },
  {
    id: '2-6',
    chapter: 2,
    indexInChapter: 6,
    name: '美食家之夜',
    durationSec: 125,
    stars: [11900, 17300, 23600],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['#...#', '.M.G.', '..X..', '.....'],
    presets: [
      { r: 0, c: 2, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 1, c: 3, tier: 4, flavor: 'gold', frozen: false },
      { r: 3, c: 1, tier: 3, flavor: 'plain', frozen: false },
      { r: 3, c: 3, tier: 2, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19'],
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
    name: '十字交错廊',
    durationSec: 125,
    stars: [13000, 18900, 25800],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['..X..', '.G.M.', '..#..', '.....'],
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
    desc: '中轴错位障碍 U 型连通 · 含急单与 2~3 位 VIP'
  },
  {
    id: '2-8',
    chapter: 2,
    indexInChapter: 8,
    name: '五行大烤盘',
    durationSec: 130,
    stars: [14400, 20900, 28600],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['#...#', '..M..', '.XGX.', '..M..', '#...#'],
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
    desc: '5x5 八角星盘首秀 · 中央双柱护航黄金底座'
  },
  {
    id: '2-9',
    chapter: 2,
    indexInChapter: 9,
    name: '双桥花坊',
    durationSec: 130,
    stars: [15500, 22500, 30800],
    baseClearDust: 10,
    firstStarDust: [16, 22, 32],
    matrix: ['..#..', '.MXG.', '..#..', '.GXM.', '.....'],
    presets: [
      { r: 0, c: 1, tier: 4, flavor: 'plain', frozen: false },
      { r: 1, c: 1, tier: 3, flavor: 'matcha', frozen: false },
      { r: 3, c: 3, tier: 4, flavor: 'matcha', frozen: false },
      { r: 4, c: 2, tier: 5, flavor: 'plain', frozen: false }
    ],
    allowedRecipes: ['R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19'],
    urgentRate: 0.30,
    vipQuota: 3,
    vipQuotaRange: [3, 3],
    vipFixedRecipeId: null,
    rushEndSec: null,
    desc: '中井切分双通道 · 底部长廊汇聚 C5~C6 大饼'
  },
  {
    id: '2-10',
    chapter: 2,
    indexInChapter: 10,
    name: '樱花露台大赏',
    durationSec: 135,
    stars: [16800, 24400, 33500],
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
    desc: '第 2 章关底王冠盘 · 双金双抹迎战 3 位 VIP'
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
    stars: [18500, 26800, 36600],
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
    name: '双果风味台',
    durationSec: 125,
    stars: [20400, 29600, 40400],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['#...#', '.M.B.', '..I..', '.I..#', '#..##'],
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
    desc: '月牙盘抹茶草莓同台 · 破冰释放高阶 C4~C5'
  },
  {
    id: '3-3',
    chapter: 3,
    indexInChapter: 3,
    name: '冰封双塔',
    durationSec: 125,
    stars: [22400, 32500, 44400],
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
    desc: '双塔腰部冰封 · 塔顶合成解放两翼并串联金箔格'
  },
  {
    id: '3-4',
    chapter: 3,
    indexInChapter: 4,
    name: '风味调色板',
    durationSec: 130,
    stars: [24400, 35400, 48400],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['.M.B.', '..I..', '.XGX.', '..I..', '.B.M.'],
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
    desc: '对称四风味池 · 专攻双韵抹茶草莓拼与中央镀金'
  },
  {
    id: '3-5',
    chapter: 3,
    indexInChapter: 5,
    name: '星冠天台',
    durationSec: 135,
    stars: [26700, 38700, 52800],
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
    stars: [28900, 41900, 57200],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['#...#', '.GIM.', '..X..', '.BIG.', '#...#'],
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
    desc: '传说星冠满汉席开放 · 解冻双 C5 速合猫神蛋糕'
  },
  {
    id: '3-7',
    chapter: 3,
    indexInChapter: 7,
    name: '满汉极速流',
    durationSec: 140,
    stars: [31400, 45500, 62000],
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
    desc: '风车四柱三风味迷宫 · 善用搭档主动技破局洗牌'
  },
  {
    id: '3-8',
    chapter: 3,
    indexInChapter: 8,
    name: '碎冰三重奏',
    durationSec: 140,
    stars: [33800, 49000, 66800],
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
    desc: '四角四重冰封对称盘 · 中轴合成连锁破冰冲满汉席'
  },
  {
    id: '3-9',
    chapter: 3,
    indexInChapter: 9,
    name: '星海终曲前夜',
    durationSec: 145,
    stars: [36400, 52800, 72000],
    baseClearDust: 14,
    firstStarDust: [22, 30, 42],
    matrix: ['..#..', '.GXM.', '.I.I.', '.BXG.', '..#..'],
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
    desc: '双脊窄廊高难博弈 · 巧借宽托盘暂存半成品腾道'
  },
  {
    id: '3-10',
    chapter: 3,
    indexInChapter: 10,
    name: '星冠夜宴终章',
    durationSec: 150,
    stars: [39200, 56800, 77500],
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
    desc: '全章总决赛 · 镀金 C6 破三冰冲猫神 · 5 位 VIP 盛宴'
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
