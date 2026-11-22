/**
 * Game Constants, Progression Catalogs, Themes, Patrons & Chamber Metrics
 * for Hoshi Kissa: Starlight Patisserie 4.1 (WeChat Mini Game Edition).
 */
'use strict';

const TIERS = [
  {
    tier: 1,
    name: '蓝莓星露糖',
    en: 'Blueberry Dewdrop',
    radius: 16,
    points: 15,
    servePoints: 30,
    color: '#4674d6',
    crumbColor: '#b7dcff',
    material: { friction: 0.12, restitution: 0.22, gravityScale: 1.0, massMult: 1.0 },
    traitName: '轻滑滚珠',
    traitDesc: '低摩擦易钻缝，铺底起点。',
    lore: '凝结星露的晶莹蓝莓糖。',
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
    points: 35,
    servePoints: 65,
    color: '#eb8861',
    crumbColor: '#ffe3c4',
    material: { friction: 0.18, restitution: 0.52, gravityScale: 1.0, massMult: 1.0 },
    traitName: '弹壁精灵',
    traitDesc: '高弹性，弹壁合成 +30% 分。',
    lore: '蓬松金黄的白桃鲜奶油泡芙。',
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
    points: 70,
    servePoints: 130,
    color: '#7da85c',
    crumbColor: '#cde6a8',
    material: { friction: 0.22, restitution: 0.24, gravityScale: 1.0, massMult: 1.0 },
    traitName: '猫耳共鸣',
    traitDesc: '合出释出 1.8s 柔磁拉近同阶。',
    lore: '软糯宇治抹茶猫猫团子。',
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
    points: 130,
    servePoints: 250,
    color: '#f2c849',
    crumbColor: '#ffe38c',
    material: { friction: 0.26, restitution: 0.18, gravityScale: 1.0, massMult: 1.0 },
    traitName: '酸甜清杂',
    traitDesc: '合出蒸发周边最多 2 颗 1 阶糖。',
    lore: '香脆黄油塔皮盛满柠檬凝乳。',
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
    points: 240,
    servePoints: 440,
    color: '#f29eb6',
    crumbColor: '#ffd4e3',
    material: { friction: 0.24, restitution: 0.20, gravityScale: 1.0, massMult: 1.0 },
    traitName: '软糯聚拢',
    traitDesc: '合出释放内吸涡流聚拢连合。',
    lore: '冰凉樱粉麻薯裹着雪白奶油。',
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
    points: 420,
    servePoints: 760,
    color: '#b86228',
    crumbColor: '#eab074',
    material: { friction: 0.22, restitution: 0.22, gravityScale: 1.0, massMult: 1.0 },
    traitName: '焦糖陀螺',
    traitDesc: '合出旋搅 1.4s，拨动卡位破死锁。',
    lore: '海盐琥珀焦糖与可可流心甜甜圈。',
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
    points: 720,
    servePoints: 1200,
    color: '#9b7fd6',
    crumbColor: '#e2d5ff',
    material: { friction: 0.21, restitution: 0.22, gravityScale: 0.52, massMult: 0.72 },
    traitName: '云端微浮',
    traitDesc: '52% 重力微浮不压底，抽走易雪崩。',
    lore: '薰衣草杏仁饼壳夹着云朵奶霜。',
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
    points: 1200,
    servePoints: 1950,
    color: '#8f5936',
    crumbColor: '#d9a97c',
    material: { friction: 0.27, restitution: 0.16, gravityScale: 1.08, massMult: 1.75 },
    traitName: '重锤碾压',
    traitDesc: '下坠压碎下方最多 2 颗 1~2 阶。',
    lore: '分量十足的糖炒栗蓉蒙布朗。',
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
    points: 2400,
    servePoints: 3200,
    color: '#f5be58',
    crumbColor: '#ffea99',
    material: { friction: 0.26, restitution: 0.16, gravityScale: 1.0, massMult: 1.35 },
    traitName: '猫神双择',
    traitDesc: '留罐全局 ×2.0；点击献礼 +3200 清杂。',
    lore: '星夜吃茶传说级至高甜点。',
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
  uiAtlas: 'assets/ui_atlas.png',
  uiAtlas2: 'assets/ui_atlas_2.png',
  uiAtlas3: 'assets/ui_atlas_3.png',
  titlePlaque: 'assets/ui_title_plaque.png',
  patronStage: 'assets/ui_patron_stage.png',
  serveBell: 'assets/ui_serve_bell.png',
  tools: {
    shake: 'assets/tool_shake.png',
    fork: 'assets/tool_fork.png',
    spoon: 'assets/tool_spoon.png'
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

// Legacy 3.0 Blessings merged into unified 4.1 Relics (`RELICS`) & Prep/Milestone system
const BLESSINGS = [];

const PATRONS = [
  {
    id: 'mikan',
    name: '小蜜柑',
    shortName: '小蜜柑',
    badge: 'mode_chef',
    cost: 0,
    src: 'assets/chef_mikan.png',
    skillName: '金勺捞底',
    activeSkill: {
      id: 'scoop',
      icon: 'tool_spoon',
      name: '金勺捞底',
      shortLabel: '捞底',
      desc: '捞出 1~5 阶甜品回罐口（不吞手牌），触发抽底雪崩'
    },
    passiveDesc: '捞底不吞牌 · 全单+20% · 开局+12币 · 每幕首出+25%技',
    shortPassive: '全单+20% · +12币',
    greet: '点订单【上菜】或长按亮铃甜品就能出餐腾空间哦！',
    thanks: '抽底上菜一气呵成，香气满满～',
    idleLines: [
      '点订单台【上菜】或长按罐内亮铃甜品出餐！',
      '每幕不清罐，趁鲜度热单免步上菜腾空间～',
      '金勺捞底可把底层甜品捞回重发',
      '先撞侧壁再合成才触发真弹壁加成哦'
    ]
  },
  {
    id: 'luna',
    name: '眠眠星兔',
    shortName: '眠眠星兔',
    badge: 'icon_moon',
    cost: 60,
    src: 'assets/patron_luna.png',
    skillName: '星月移形',
    activeSkill: {
      id: 'swap',
      icon: 'icon_moon',
      name: '星月移形',
      shortLabel: '移形',
      desc: '互换两颗甜品位置并释放柔磁共鸣'
    },
    passiveDesc: '移形 · 柔磁Lv.1 · 虹保底-2步 · 首刷免单 · 虹合+5币',
    shortPassive: '柔磁 · 虹-2 · 免刷',
    greet: '今晚月色真好，整备首刷我请客～',
    thanks: '吃到幸福的味道了，谢谢主厨！',
    idleLines: [
      '整备间每幕首次刷新我帮你免单～',
      '星月移形可对调任意两颗甜品',
      '带我营业自带柔磁且彩虹保底 -2 步',
      '彩虹合成还能额外掉 +5 秘方币'
    ]
  },
  {
    id: 'mugi',
    name: '蜂蜜柴柴',
    shortName: '蜂蜜柴柴',
    badge: 'icon_flame',
    cost: 100,
    src: 'assets/patron_mugi.png',
    skillName: '元气重锤',
    activeSkill: {
      id: 'meteor_shot',
      icon: 'icon_flame',
      name: '元气重锤',
      shortLabel: '重锤',
      desc: '下发撞击首颗直接升阶并震碎周边冰霜'
    },
    passiveDesc: '重锤破冰 · 真弹壁+35%分/+3币 · 开局摇+1',
    shortPassive: '真弹壁+3币 · 摇+1',
    greet: '汪呜！先撞玻璃侧壁反弹合成赚 +3 秘方币！',
    thanks: '太满足啦！下次还要再来！',
    idleLines: [
      '先撞侧壁反弹直合额外赚 +3 秘方币！',
      '元气重锤撞谁就帮谁升阶并破冰',
      '3 连击以上能大幅回复招牌技',
      '蒙布朗超重，落下直接压碎小糖'
    ]
  }
];

const CASCADE_MULTIPLIERS = [1.0, 1.4, 1.85, 2.35, 2.9];

const SHOP_UPGRADES = [
  {
    id: 'up_tools',
    icon: 'icon_toolbox',
    name: '备货充沛',
    costs: [40, 90, 160],
    maxLv: 3,
    shortTag: (lv) => `备货Lv.${lv}`,
    desc: (lv) => {
      if (lv === 0) return '下级：开局 摇罐+1';
      if (lv === 1) return '当前 摇+1 · 下级 摇+1 勺+1';
      if (lv === 2) return '当前 摇+1 勺+1 · 下级 摇+2 勺+1';
      return '满级：每局开局 摇罐+2 · 升阶勺+1';
    }
  },
  {
    id: 'up_fever',
    icon: 'icon_flame',
    name: '暖炉预热',
    costs: [50, 100, 180],
    values: [0, 20, 38, 55],
    maxLv: 3,
    shortTag: (lv) => `暖炉Lv.${lv}`,
    desc: (lv) => {
      const vals = [0, 20, 38, 55];
      if (lv === 0) return '下级：开局初始能量 +20%';
      if (lv < 3) return `当前 +${vals[lv]}% · 下级 +${vals[lv + 1]}% 初始能量`;
      return '满级：开局自带 55% 技能与星光能量';
    }
  },
  {
    id: 'up_combo',
    icon: 'icon_hourglass',
    name: '节奏节拍器',
    costs: [60, 120, 200],
    values: [0, 0.25, 0.50, 0.80],
    maxLv: 3,
    shortTag: (lv) => `节拍Lv.${lv}`,
    desc: (lv) => {
      const vals = [0, 0.25, 0.50, 0.80];
      if (lv === 0) return '下级：连击与雪崩窗 +0.25s';
      if (lv < 3) return `当前 +${vals[lv].toFixed(2)}s · 下级 +${vals[lv + 1].toFixed(2)}s`;
      return '满级：连击与雪崩窗口永久 +0.80s';
    }
  },
  {
    id: 'up_dust',
    icon: 'icon_stardust',
    name: '星尘糖霜壶',
    costs: [45, 95, 170],
    mults: [1, 1.15, 1.3, 1.5],
    startCoins: [0, 5, 10, 15],
    maxLv: 3,
    shortTag: (lv) => `糖霜Lv.${lv}`,
    desc: (lv) => {
      const pcts = [0, 15, 30, 50];
      const coins = [0, 5, 10, 15];
      if (lv === 0) return '下级：星尘+15% · 开局+5币';
      if (lv < 3) return `当前 +${pcts[lv]}%/+${coins[lv]}币 · 下级 +${pcts[lv + 1]}%/+${coins[lv + 1]}币`;
      return '满级：结算星尘 +50% · 闯关开局 +15币';
    }
  }
];

// =========================================================================
// 4.1 Overhaul: Persistent-Jar 5-Shift Roguelike, Unified 18 Relics & 6 Mods
// =========================================================================
const SHIFTS = [
  {
    shift: 1,
    name: '暮色试营业',
    steps: 16,
    target: 1200,
    baseCoins: 35,
    badge: '第1幕·试营',
    modifier: null,
    desc: '预置 4 颗甜品，点【上菜】或长按亮铃甜品体验抽底雪崩'
  },
  {
    shift: 2,
    name: '晚风星灯夜',
    steps: 16,
    target: 2600,
    baseCoins: 45,
    badge: '第2幕·星环',
    modifier: 'golden_breeze',
    desc: '全罐原位续战 + 焦糖星环穿环镀金'
  },
  {
    shift: 3,
    name: '挑剔美食家',
    steps: 17,
    target: 4400,
    baseCoins: 60,
    isMiniBoss: true,
    badge: '小Boss·破冰',
    modifier: 'mini_boss',
    desc: '黄油弹柱机关 + 2 颗冰封甜品，周边合成/重锤破冰 +¥120'
  },
  {
    shift: 4,
    name: '午夜猫猫派对',
    steps: 17,
    target: 7600,
    baseCoins: 80,
    badge: '第4幕·机关',
    modifier: 'party_events',
    desc: '随机场地机关 + 捣蛋毛线球（震碎 +¥750 / +10币）'
  },
  {
    shift: 5,
    name: '星冠大赏',
    steps: 18,
    target: 12800,
    baseCoins: 100,
    isFinalBoss: true,
    badge: '终极Boss',
    modifier: 'grand_prix',
    desc: '冰封残局 + 场地机关 + 每 6 步评委急单（×2.5 且 +2步）'
  }
];

const SHIFT_HAZARDS = {
  glaze_ring: {
    id: 'glaze_ring',
    icon: 'icon_stardust',
    name: '焦糖星环',
    badge: '焦糖环',
    color: '#b87618',
    bg: '#fff5d9',
    desc: '穿过巡游星环即刻镀金（合成 ×2.0 / 出餐 ×1.6）'
  },
  divider: {
    id: 'divider',
    icon: 'icon_divider',
    name: '木质隔板',
    badge: '木隔板',
    color: '#8f4f22',
    bg: '#f9e9d6',
    desc: '罐底中央立起半高隔板，善用侧壁弹射跨越左右槽'
  },
  bumpers: {
    id: 'bumpers',
    icon: 'icon_bumper',
    name: '黄油弹柱',
    badge: '弹柱',
    color: '#b56e10',
    bg: '#fff3d4',
    desc: '双侧高弹星柱，撞柱高回弹并爆 +¥40 弹射小费（每颗限3次）'
  },
  fast_fresh: {
    id: 'fast_fresh',
    icon: 'mode_rush',
    name: '极速冷盘',
    badge: '冷盘',
    color: '#b5452e',
    bg: '#ffece4',
    desc: '鲜度缩至 5 步，鲜度内 ×2.0，超时降至 ×0.75'
  }
};

function getShiftConfig(shiftNum) {
  const n = Math.max(1, Math.floor(Number(shiftNum) || 1));
  if (n <= SHIFTS.length) return SHIFTS[n - 1];
  const extra = n - 5;
  const target = Math.round((12800 * Math.pow(1.45, extra)) / 100) * 100;
  return {
    shift: n,
    name: `无尽加时 #${extra}`,
    steps: 18,
    target,
    baseCoins: 110 + (extra - 1) * 15,
    isEndless: true,
    badge: `加时·第${n}幕`,
    modifier: 'grand_prix',
    desc: '全罐续战 + 双机关轮换 + 冰封残局 + 评委急单'
  };
}

const MAX_RELIC_SLOTS = 4;

const RELIC_ARCHETYPES = {
  cascade: { id: 'cascade', icon: 'icon_wave', tag: '#雪崩', name: '抽底雪崩流', color: '#467a63', bg: '#ebf6ee' },
  bank: { id: 'bank', icon: 'icon_billiard', tag: '#弹壁', name: '弹壁台球流', color: '#8a5d2b', bg: '#f9eedb' },
  trait: { id: 'trait', icon: 'icon_alchemy', tag: '#异能', name: '异能催化流', color: '#8c4966', bg: '#fbeef4' },
  greed: { id: 'greed', icon: 'icon_crown', tag: '#贪婪', name: '贪婪豪赌流', color: '#a85c14', bg: '#fff3d6' }
};

const ARCHETYPE_SYNERGIES = {
  cascade: {
    id: 'cascade',
    tag: '#雪崩',
    short2: '雪崩窗+0.8s · 出餐+10%技',
    short3: '雪崩连合加成 +50%',
    tier2Desc: '2件：雪崩窗 +0.8s，出餐额外 +10% 招牌技',
    tier3Desc: '3件：雪崩连合倍率加成再 +50%'
  },
  bank: {
    id: 'bank',
    tag: '#弹壁',
    short2: '真弹壁+30% · 回+8%狂热',
    short3: '真弹壁合成必镀金',
    tier2Desc: '2件：真弹壁加成 +30%，回 +8% 狂热能',
    tier3Desc: '3件：真弹壁合成甜品 100% 自动镀金'
  },
  trait: {
    id: 'trait',
    tag: '#异能',
    short2: '异能范围+22% · +¥60',
    short3: '异能回+15%技 · +6星露',
    tier2Desc: '2件：异能范围 +22%，触发额外 +¥60',
    tier3Desc: '3件：异能触发回 +15% 招牌技并 +6 星露'
  },
  greed: {
    id: 'greed',
    tag: '#贪婪',
    short2: '基薪+12币 · VIP赏+20%',
    short3: '全局营业额 +25%',
    tier2Desc: '2件：过关基薪 +12币，VIP 赏金 +20%',
    tier3Desc: '3件：全局合成与出餐额外 +25%'
  }
};

const RELICS = [
  // Archetype 1: Cascade / Serve Build (includes merged Shockwave blessing!)
  {
    id: 'rel_aftershock',
    archetype: 'cascade',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'icon_wave',
    name: '热盘余震',
    price: 30,
    desc: '出餐原位产生 135px 内吸脉冲，拉拢周边相撞'
  },
  {
    id: 'rel_domino',
    archetype: 'cascade',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'serve_bell',
    name: '多米诺餐铃',
    price: 45,
    desc: '雪崩窗延至 4.2s，每段连合额外 +35% 分'
  },
  {
    id: 'rel_tradeup',
    archetype: 'cascade',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'icon_flame',
    name: '以小换大炉',
    price: 50,
    desc: '出餐 ≥4 阶时，罐内随机 1 颗最低阶免费升阶'
  },
  {
    id: 'rel_perpetual',
    archetype: 'cascade',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: 'icon_infinity',
    name: '翻台永动机',
    price: 70,
    desc: '雪崩 2 连返步上限升至 6 步，空闲桌刷双倍鲜度单'
  },
  {
    id: 'rel_shockwave',
    archetype: 'cascade',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'icon_wind',
    name: '星爆扩音鼓',
    price: 32,
    desc: '合成气浪范围与推力 +65%，滚落促成多米诺连合'
  },
  // Archetype 2: Bank-Shot / Pinball Build
  {
    id: 'rel_prism',
    archetype: 'bank',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'icon_prism',
    name: '玻璃折光糖',
    price: 30,
    desc: '真弹壁首合加成升至 +90%，且下颗手牌必镀金'
  },
  {
    id: 'rel_bouncy',
    archetype: 'bank',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'icon_billiard',
    name: '高弹舒芙蕾壁',
    price: 35,
    desc: '撞墙弹性/初速提升，解锁二段真弹壁 +130%'
  },
  {
    id: 'rel_bumpers',
    archetype: 'bank',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'icon_bumper',
    name: '私藏黄油弹柱',
    price: 50,
    desc: '永久安装 2 枚弹柱，碰柱 +¥45 且合成 +35%'
  },
  {
    id: 'rel_ricochet',
    archetype: 'bank',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: 'icon_arrow',
    name: '神枪跳阶箭',
    price: 75,
    desc: '真弹壁直合 45% 跳升 +2 阶并回 35% 招牌技'
  },
  // Archetype 3: Trait / Alchemy Build (includes merged CritJump blessing!)
  {
    id: 'rel_echo',
    archetype: 'trait',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'icon_alchemy',
    name: '双重异能炉',
    price: 50,
    desc: '4~8 阶甜品在出餐瞬间再发动一次异能'
  },
  {
    id: 'rel_lemonade',
    archetype: 'trait',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'tier_4',
    name: '柠檬汽水机',
    price: 35,
    desc: '柠檬塔 165px 清最多 4 颗 1~2 阶，每颗 +¥90/+3币'
  },
  {
    id: 'rel_antigrav',
    archetype: 'trait',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: 'icon_ufo',
    name: '月光反重力箱',
    price: 70,
    desc: '每 4 步倒置重力 1.3s，倒置期间合成 +80%'
  },
  {
    id: 'rel_resonance',
    archetype: 'trait',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'icon_magnet',
    name: '共鸣磁铃',
    price: 30,
    desc: '甜品发动异能时，全罐同阶柔磁牵引 2.5s'
  },
  {
    id: 'rel_crit_star',
    archetype: 'trait',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'icon_bolt',
    name: '奇迹跳阶石',
    price: 48,
    desc: '任意合成 18% 概率直跳 +2 阶并额外 +75% 得分'
  },
  // Archetype 4: High-Roller / Greed Build (rebalanced!)
  {
    id: 'rel_aged',
    archetype: 'greed',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'icon_ledger',
    name: '陈酿焦糖账本',
    price: 45,
    desc: '罐内可出餐甜品每多留 1 步 +30% 价（上限 +150%）'
  },
  {
    id: 'rel_crown_aura',
    archetype: 'greed',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: 'icon_crown',
    name: '星冠威压',
    price: 75,
    desc: '每有 1 颗 ≥6 阶甜品，全局营业额 +25%（上限 +75%）'
  },
  {
    id: 'rel_double_vip',
    archetype: 'greed',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: 'icon_ribbon',
    name: '双席 VIP 厅',
    price: 55,
    desc: '快餐桌升为第二 VIP 桌，VIP 赏金 +20%'
  },
  {
    id: 'rel_interest',
    archetype: 'greed',
    rarity: 'common',
    rarityLabel: '普通',
    icon: 'icon_scale',
    name: '聚宝盆账本',
    price: 35,
    desc: '每件秘方 +8% 营业额，每 10 币再 +5%（上限 +65%）'
  }
];

const DECK_MODS = [
  {
    id: 'mod_trim_t1',
    icon: 'icon_sieve',
    name: '筛除1阶蓝莓',
    price: 40,
    maxBuy: 1,
    desc: '移除本局 1 阶出率，提纯 2~3 阶手牌'
  },
  {
    id: 'mod_boost_t3',
    icon: 'mode_zen',
    name: '抹茶原料浓缩',
    price: 35,
    maxBuy: 2,
    desc: '本局 3~4 阶出现权重翻倍'
  },
  {
    id: 'mod_gold_tray',
    icon: 'icon_stardust',
    name: '镀金烤盘',
    price: 30,
    maxBuy: 2,
    desc: '手牌镀金概率 +18%（合成×2.0/出餐×1.6）'
  },
  {
    id: 'mod_rainbow',
    icon: 'icon_rainbow',
    name: '星露浓缩瓶',
    price: 35,
    maxBuy: 2,
    desc: '彩虹保底 -3 步，立送 1 颗进队列'
  },
  {
    id: 'mod_steps',
    icon: 'icon_hourglass',
    name: '延长夜班',
    price: 25,
    maxBuy: 99,
    desc: '下幕初始步数 +3 步'
  },
  {
    id: 'mod_tool',
    icon: 'icon_toolbox',
    name: '紧急厨具补给',
    price: 20,
    maxBuy: 99,
    desc: '立刻补充 摇罐+1 与 升阶勺+1'
  }
];

const JAR_THEMES = {
  amber: {
    id: 'amber',
    icon: 'icon_stardust',
    name: '星夜琥珀罐',
    cost: 0,
    desc: '暖金黄铜领口 · 深茶蓝星夜玻璃',
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
    icon: 'icon_ribbon',
    name: '樱花琉璃罐',
    cost: 80,
    desc: '玫瑰金领口 · 飘落樱花瓣与樱粉光环',
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
    icon: 'icon_moon',
    name: '深海月光瓶',
    cost: 120,
    desc: '秘银月白领口 · 冰海青蓝折射玻璃',
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
    desc: '完成 1 局星夜营业',
    check: (s) => (s.lifetimeStats.runsPlayed || 0) >= 1
  },
  {
    id: 'combo_4',
    tierImg: 3,
    name: '多米诺乐手',
    desc: '单局达成 4 连合',
    check: (s) => (s.lifetimeStats.maxComboEver || 1) >= 4
  },
  {
    id: 'yarn_3',
    tierImg: 5,
    name: '线团克星',
    desc: '震碎 3 颗捣蛋毛线球',
    check: (s) => (s.lifetimeStats.yarnBroken || 0) >= 3
  },
  {
    id: 'rush_3000',
    tierImg: 6,
    name: '狂欢之星',
    desc: '90秒狂欢突破 3,000 分',
    check: (s) => (s.bestRush || 0) >= 3000
  },
  {
    id: 'souffle_1',
    tierImg: 9,
    name: '猫神降临',
    desc: '合出 9 阶猫神舒芙蕾',
    check: (s) => (s.lifetimeStats.soufflesMade || 0) >= 1 || s.unlockedTiers.includes(9)
  },
  {
    id: 'comp_all',
    tierImg: 7,
    name: '全品收藏家',
    desc: '甜品图鉴全部解锁',
    check: (s) => s.unlockedTiers.length >= 9
  },
  {
    id: 'shift_clear_1',
    tierImg: 4,
    name: '夜班达人',
    desc: '主厨模式通关 1 幕',
    check: (s) => (s.lifetimeStats.shiftsClearedTotal || 0) >= 1
  },
  {
    id: 'shift_clear_5',
    tierImg: 8,
    name: '星冠大赏王',
    desc: '完整通关 5 幕闯关',
    check: (s) => (s.lifetimeStats.bestShiftReached || 0) >= 5 && (s.lifetimeStats.fiveShiftClears || 0) >= 1
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

// Pure visual FX emote kinds (rendered via vector/icons in jar_renderer, zero emoji!)
const SOLO_EMOTES = ['star', 'note', 'meow', 'star', 'heart', 'star', 'bang', 'crown', 'crown'];

const MODE_GUIDES = {
  chef: {
    mode: 'chef',
    icon: 'mode_chef',
    title: '主厨闯关指引',
    subtitle: '5 幕续炉 · 订单腾位 · 秘方构筑',
    steps: [
      {
        focus: 'launcher',
        icon: 'icon_launcher',
        tag: '1 / 3 · 定角弹射',
        title: '中央调角发射，先撞壁再合享真弹壁加成',
        lines: [
          '中央恒速发射，拖动调角预览落点与异能范围',
          '上滑移出罐口松手可取消发射'
        ]
      },
      {
        focus: 'serve',
        icon: 'serve_bell',
        tag: '2 / 3 · 上菜腾位',
        title: '点订单【上菜】或长按亮铃甜品出餐',
        lines: [
          '跨幕不清罐！趁热单免步上菜腾空间（冷单耗1步，雪崩返还）',
          '抽走底层甜品引发塌落连合，享雪崩加成与返步'
        ]
      },
      {
        focus: 'hud_skill',
        icon: 'icon_coin',
        tag: '3 / 3 · 秘方共鸣',
        title: '限步达标营业额，幕间整备凑共鸣',
        lines: [
          '达标可提前打烊赚利息币，进整备间选购秘方',
          '同标签 2/3 件激活共鸣，上菜蓄满释放伙伴招牌技'
        ]
      }
    ]
  },
  rush: {
    mode: 'rush',
    icon: 'mode_rush',
    title: '90秒狂欢指引',
    subtitle: '极速连发 · 连出延时 · 自动秘方',
    steps: [
      {
        focus: 'launcher',
        icon: 'icon_launcher',
        tag: '1 / 3 · 极速连发',
        title: '无步数限制，冲刺星光狂热',
        lines: [
          '拖动调角快速连发，合成充能触发星光狂热',
          '达成分数里程碑自动装备随机秘方不打断节奏'
        ]
      },
      {
        focus: 'serve',
        icon: 'serve_bell',
        tag: '2 / 3 · 连出续命',
        title: '点【上菜】或长按亮铃甜品连出延时',
        lines: [
          '开局即送闪电单，出餐立得 +3.0s~+4.5s 延时',
          '12 秒内连出叠加上菜倍率与延时'
        ]
      },
      {
        focus: 'danger_dock',
        icon: 'icon_wind',
        tag: '3 / 3 · 星风救急',
        title: '溢罐自动吹散不秒死',
        lines: [
          '溢罐触发星风清顶（扣 5s），善用摇罐与招牌技控场'
        ]
      }
    ]
  },
  zen: {
    mode: 'zen',
    icon: 'mode_zen',
    title: '悠闲经典指引',
    subtitle: '无压合成 · 自动秘方 · 探索 9 阶',
    steps: [
      {
        focus: 'launcher',
        icon: 'icon_launcher',
        tag: '1 / 2 · 随心弹射',
        title: '零步数与计时压力，尽享弹射',
        lines: [
          '瞄准可合成目标时自动预览各阶甜品异能范围',
          '先撞玻璃侧壁反弹合成享真弹壁加成'
        ]
      },
      {
        focus: 'hold_milestone',
        icon: 'icon_gift',
        tag: '2 / 2 · 暂存与秘方',
        title: '暂存调牌 · 达分自动获赠秘方',
        lines: [
          '点右上「存」槽换牌，向 9 阶猫神舒芙蕾冲刺'
        ]
      }
    ]
  },
  tip_glaze_ring: {
    mode: 'tip_glaze_ring',
    isMechanicTip: true,
    icon: 'icon_stardust',
    title: '机关 · 焦糖星环',
    subtitle: '穿环镀金 · 高倍收益',
    steps: [
      {
        focus: 'glaze_ring',
        icon: 'icon_stardust',
        tag: '机关指南',
        title: '甜品穿过巡游星环即刻镀金',
        lines: [
          '镀金甜品合成 ×2.0、出餐 ×1.6，瞄准穿环会亮星芒提示'
        ]
      }
    ]
  },
  tip_frozen: {
    mode: 'tip_frozen',
    isMechanicTip: true,
    icon: 'icon_frost',
    title: '机制 · 冰封残局',
    subtitle: '破冰立得 +¥120',
    steps: [
      {
        focus: 'frozen',
        icon: 'icon_frost',
        tag: '破冰指南',
        title: '周边合成 / 重锤 / 摇罐均可破冰',
        lines: [
          '冰封甜品暂不可合成或上菜，周边 110px 合成或摇罐即可震碎'
        ]
      }
    ]
  }
};

function getChefRank(score) {
  if (score >= 25000) return '传奇猫神宗师';
  if (score >= 12000) return '星夜首席主厨';
  if (score >= 5500) return '银星甜点师';
  if (score >= 2000) return '温柔烘焙师';
  return '见习甜点师';
}

module.exports = {
  TIERS,
  WILDCARD_RADIUS,
  YARN_BALL_RADIUS,
  ASSET_PATHS,
  UI_ATLAS_RECTS,
  UI_ATLAS_2_RECTS,
  UI_ATLAS_3_RECTS,
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
  ACHIEVEMENTS,
  JAR,
  STORAGE_KEY,
  SOLO_EMOTES,
  getChefRank
};
