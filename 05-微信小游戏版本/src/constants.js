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
    points: 15,
    servePoints: 30,
    color: '#4674d6',
    crumbColor: '#b7dcff',
    material: { friction: 0.12, restitution: 0.22, gravityScale: 1.0, massMult: 1.0 },
    traitName: '轻滑滚珠',
    traitDesc: '极低摩擦易钻缝，是铺垫底层的起点小糖。',
    lore: '凝结了午夜星露的晶莹蓝莓糖，酸甜清冽，顺着缝隙咕噜滚动。',
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
    traitDesc: '高弹性耐反弹，经玻璃壁弹射合成额外 +30% 积分！',
    lore: '蓬松金黄的泡芙球里挤满白桃鲜奶油，撞到玻璃壁会 Q 弹回旋。',
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
    traitDesc: '合出后释放 1.8 秒柔磁共鸣波，拉近周边同阶甜品！',
    lore: '揉进宇治抹茶粉的软糯猫猫团子，在月光下抖动耳朵呼唤同伴。',
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
    traitDesc: '合成瞬间蒸发周边最多 2 颗 1 阶蓝莓，转化为积分与厨艺能！',
    lore: '香脆黄油塔皮盛满蜂蜜柠檬凝乳，酸甜气泡能一扫底层小糖。',
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
    traitDesc: '合成时释放内吸涡流，将周围甜品向中心拢聚引发连合！',
    lore: '冰凉 Q 弹的樱粉麻薯裹着雪白奶油，把身旁伙伴温柔抱在一起。',
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
    traitDesc: '合出后高速旋搅 1.4 秒，拨动卡位甜品打破死锁！',
    lore: '淋满海盐琥珀焦糖与可可流心的松软甜甜圈，出炉时会欢快打转。',
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
    traitDesc: '仅受 52% 重力轻盈悬浮，不压死底层，抽走易造大塌方！',
    lore: '薰衣草紫杏仁饼壳夹着云朵奶霜，像小气球一样轻飘飘地浮着。',
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
    traitDesc: '高密度重体！下坠时直接压碎正下方最多 2 颗 1~2 阶杂碎！',
    lore: '层层交织的糖炒栗蓉分量十足，稳稳压碎脚下的小糖碎屑。',
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
    traitDesc: '留罐提供全局 ×2.0 积分光环；随时点击献礼爆出 +3200 分并清杂！',
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
  uiAtlas: 'assets/ui_atlas.png',
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
    desc: () => '立刻补充 摇一摇+1 · 升阶勺+1 · 招牌厨艺技满能，并赠送 +25 ⭐！'
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
    skillName: '金勺捞底',
    activeSkill: {
      id: 'scoop',
      icon: '🥄',
      name: '金勺捞底',
      shortLabel: '捞底',
      desc: '点选罐内 1~5 阶甜品捞回待投区，原位触发抽底雪崩！'
    },
    passiveDesc: '主动技【金勺捞底】捞出底层甜品；VIP赏金+15% + 开局+8🪙',
    shortPassive: '捞底·+8🪙',
    greet: '刚出炉的星光面糊好香呀～亮餐铃的甜品直接点它就能上菜哦！',
    thanks: '太棒啦！抽底上菜一气呵成，香气飘满月光街道啦～',
    idleLines: [
      '欢迎回到星夜吃茶！在罐内左右拖动调角，恒定初速撞墙弹射超稳哦～',
      '看到罐里亮起餐铃的甜品了吗？点击它上菜，还能引发抽底雪崩！',
      '我的招牌技【金勺捞底】能把压在底下的甜品捞回来重发哦～',
      '4 阶柠檬塔合出时会用气泡蒸发周围蓝莓，瞄准时能看到清杂范围圈！'
    ]
  },
  {
    id: 'luna',
    name: '常客 · 眠眠星兔',
    shortName: '眠眠星兔',
    badge: '🌙',
    cost: 60,
    src: 'assets/patron_luna.png',
    skillName: '星月移形',
    activeSkill: {
      id: 'swap',
      icon: '🌙',
      name: '星月移形',
      shortLabel: '移形',
      desc: '依次点选罐内任意两颗甜品瞬间互换位置，并释放柔磁共鸣撮合大连锁！'
    },
    passiveDesc: '主动技【星月移形】对调甜品；自带星磁·彩虹-2步·整备首刷免费+虹合+5🪙',
    shortPassive: '移形·磁吸·首刷0🪙',
    greet: '唔…今晚的月亮好圆，整备间每次第一次刷新我都帮你免单哦…',
    thanks: '哇啊！吃到幸福的味道了，谢谢主厨！',
    idleLines: [
      '呼啊～攒满厨艺能就能用【星月移形】把两颗甜品直接对调位置哦…',
      '带我进后厨整备间，每幕第一次刷新货架免费，彩虹合成还掉 +5🪙 呢…',
      '90 秒狂欢里连续出餐能叠高连击倍率并最高 +4.5 秒续命，冲呀～',
      '带我营业会自带甜蜜星磁，让同阶甜品悄悄靠在一起！'
    ]
  },
  {
    id: 'mugi',
    name: '面包迷 · 蜂蜜柴柴',
    shortName: '蜂蜜柴柴',
    badge: '🍯',
    cost: 100,
    src: 'assets/patron_mugi.png',
    skillName: '元气重锤',
    activeSkill: {
      id: 'meteor_shot',
      icon: '🔥',
      name: '元气重锤',
      shortLabel: '重锤',
      desc: '下次抛射化为穿甲烈焰球：撞击首颗甜品直接升阶并震碎周边冰霜与毛线球！'
    },
    passiveDesc: '主动技【元气重锤】穿甲升阶；弹壁+40%分且赏+3🪙·开局摇+1·3连回20%技',
    shortPassive: '重锤·弹壁+3🪙·摇+1',
    greet: '汪呜！带我多送1次摇一摇，每次弹壁合成还能额外赚 +3🪙 秘方币！',
    thanks: '太满足啦！下次我还要带朋友们一起来！',
    idleLines: [
      '汪呜！！瞄准角度撞玻璃壁弹射合成，不仅加分还能赚 +3🪙 秘方币！',
      '激活我的【元气重锤】，下一次发射撞到谁就帮谁强行升阶并破冰！',
      '3 连击以上能狂回厨艺能，源源不断放技能轰炸全场！',
      '8 阶栗子蒙布朗超重，砸下来能把底下的小蓝莓直接压碎变分！'
    ]
  }
];

const CASCADE_MULTIPLIERS = [1.0, 1.4, 1.9, 2.5, 3.2];

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
      if (lv === 1) return '当前：开局 摇+1 · 下级：摇+1 且 升阶勺+1';
      if (lv === 2) return '当前：开局 摇+1 勺+1 · 下级：摇+2 且 升阶勺+1';
      return '已满级：每局开局 摇一摇+2 · 升阶勺+1！';
    }
  },
  {
    id: 'up_fever',
    icon: '🔥',
    name: '暖炉预热',
    costs: [50, 100, 180],
    values: [0, 20, 38, 55],
    maxLv: 3,
    shortTag: (lv) => `暖炉Lv.${lv}`,
    desc: (lv) => {
      const vals = [0, 20, 38, 55];
      if (lv === 0) return '下级效果：开局自带 20% 厨艺技与星光初始能量';
      if (lv < 3) return `当前：开局自带 ${vals[lv]}% 能量 · 下级提升至 ${vals[lv + 1]}%`;
      return '已满级：每局开局自带 55% 厨艺与狂热初始能量，极速放招牌技！';
    }
  },
  {
    id: 'up_combo',
    icon: '⏱️',
    name: '节奏节拍器',
    costs: [60, 120, 200],
    values: [0, 0.25, 0.50, 0.80],
    maxLv: 3,
    shortTag: (lv) => `节拍Lv.${lv}`,
    desc: (lv) => {
      const vals = [0, 0.25, 0.50, 0.80];
      if (lv === 0) return '下级效果：连击与抽底雪崩判定窗延长 +0.25 秒';
      if (lv < 3) return `当前：连击与雪崩窗 +${vals[lv].toFixed(2)}s · 下级提升至 +${vals[lv + 1].toFixed(2)}s`;
      return '已满级：全局连击与抽底雪崩窗口永久延长 +0.80 秒！';
    }
  },
  {
    id: 'up_dust',
    icon: '✨',
    name: '星尘糖霜壶',
    costs: [45, 95, 170],
    mults: [1, 1.15, 1.3, 1.5],
    startCoins: [0, 5, 10, 15],
    maxLv: 3,
    shortTag: (lv) => `糖霜Lv.${lv}`,
    desc: (lv) => {
      const pcts = [0, 15, 30, 50];
      const coins = [0, 5, 10, 15];
      if (lv === 0) return '下级效果：星尘收益 +15% 且主厨闯关开局自带 +5🪙';
      if (lv < 3) return `当前：星尘+${pcts[lv]}%·开局+${coins[lv]}🪙 · 下级+${pcts[lv + 1]}%/+${coins[lv + 1]}🪙`;
      return '已满级：星尘收益全面 +50%，且主厨闯关开局自带 +15🪙 启动资金！';
    }
  }
];

// =========================================================================
// 4.0 Phase 2: 5-Shift Night Bakery Roguelike, 16 Relics & 6 Deck Mods
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
    desc: '纯净开场幕：底部预置 4 颗甜品，点击餐铃出餐体验抽底雪崩！'
  },
  {
    shift: 2,
    name: '晚风星灯夜',
    steps: 16,
    target: 2600,
    baseCoins: 45,
    badge: '第2幕·星环',
    modifier: 'golden_breeze',
    desc: '热炉传承保留最高 2 颗甜品 + ✨焦糖星环巡游，甜品穿过环心即刻镀金！'
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
    desc: '破冰试炼幕：开局含 2 颗 ❄️ 冰封残局甜品（周边合成/重锤/摇罐破冰爆 +¥120），无额外地形干扰！'
  },
  {
    shift: 4,
    name: '午夜猫猫派对',
    steps: 17,
    target: 8200,
    baseCoins: 75,
    badge: '第4幕·机关',
    modifier: 'party_events',
    desc: '机关派对幕：引入随机场地机关（木隔板/黄油弹柱/极速冷盘）+ 捣蛋毛线球（震碎+¥750 & +10🪙）！'
  },
  {
    shift: 5,
    name: '星冠大赏',
    steps: 18,
    target: 15000,
    baseCoins: 100,
    isFinalBoss: true,
    badge: '终极Boss',
    modifier: 'grand_prix',
    desc: '2 颗 ❄️ 冰封高阶残局 + 随机地形机关 + 每 6 步评委突击加单（4步完单 ×2.5 且 +2步）！'
  }
];

const SHIFT_HAZARDS = {
  glaze_ring: {
    id: 'glaze_ring',
    icon: '✨',
    name: '焦糖星环',
    badge: '✨焦糖环',
    color: '#b87618',
    bg: '#fff5d9',
    desc: '罐中上部巡游的星光圆环，甜品穿过环心即刻镀金（合成 ×2.5 / 出餐 ×1.8）！'
  },
  divider: {
    id: 'divider',
    icon: '🪵',
    name: '木质分槽隔板',
    badge: '🪵木隔板',
    color: '#8f4f22',
    bg: '#f9e9d6',
    desc: '罐底中央立起半高木隔板分为左右双烘焙槽，瞄准侧壁反弹跨越最爽！'
  },
  bumpers: {
    id: 'bumpers',
    icon: '🧈',
    name: '双重黄油弹柱',
    badge: '🧈黄油弹柱',
    color: '#b56e10',
    bg: '#fff3d4',
    desc: '罐壁左右中段安装 2 枚高弹星柱，甜品撞柱高回弹并爆出 +¥40 弹射小费！'
  },
  fast_fresh: {
    id: 'fast_fresh',
    icon: '⏱️',
    name: '极速冷盘',
    badge: '⏱️极速冷盘',
    color: '#b5452e',
    bg: '#ffece4',
    desc: '订单鲜度窗缩至 5 步，鲜度内出餐暴涨 ×2.0 赏金，超时则降至 ×0.75！'
  }
};

function getShiftConfig(shiftNum) {
  const n = Math.max(1, Math.floor(Number(shiftNum) || 1));
  if (n <= SHIFTS.length) return SHIFTS[n - 1];
  const extra = n - 5;
  const target = Math.round((15000 * Math.pow(1.65, extra)) / 100) * 100;
  return {
    shift: n,
    name: `无尽午夜加时 #${extra}`,
    steps: 18,
    target,
    baseCoins: 85 + extra * 10,
    isEndless: true,
    badge: `加时·第${n}幕`,
    modifier: 'grand_prix',
    desc: '无尽午夜加时：双机关轮换 + 冰封残局 + 评委突击加单，目标指数攀升！'
  };
}

const MAX_RELIC_SLOTS = 4;

const RELIC_ARCHETYPES = {
  cascade: { id: 'cascade', icon: '🏔️', tag: '#雪崩', name: '抽底雪崩流', color: '#467a63', bg: '#ebf6ee' },
  bank: { id: 'bank', icon: '🎱', tag: '#弹壁', name: '弹壁台球流', color: '#8a5d2b', bg: '#f9eedb' },
  trait: { id: 'trait', icon: '🧪', tag: '#异能', name: '异能催化流', color: '#8c4966', bg: '#fbeef4' },
  greed: { id: 'greed', icon: '👑', tag: '#贪婪', name: '贪婪豪赌流', color: '#a85c14', bg: '#fff3d6' }
};

const ARCHETYPE_SYNERGIES = {
  cascade: {
    id: 'cascade',
    tag: '#雪崩',
    short2: '雪崩窗+0.8s·出餐+10%技',
    short3: '雪崩连合再×1.35',
    tier2Desc: '2件套装：抽底雪崩窗延长 +0.8s，点击出餐额外充能 +10% 招牌技！',
    tier3Desc: '3件套装：雪崩期间所有连合营业额再叠乘 ×1.35！'
  },
  bank: {
    id: 'bank',
    tag: '#弹壁',
    short2: '弹壁+0.35×·撞壁+8%狂热',
    short3: '弹壁合成必定镀金',
    tier2Desc: '2件套装：弹壁合成倍率额外 +0.35×，每次弹壁合成回 +8% 狂热能！',
    tier3Desc: '3件套装：经弹壁触发合成诞生的甜品 100% 自动镀金！'
  },
  trait: {
    id: 'trait',
    tag: '#异能',
    short2: '异能范围+22%·触发+¥60',
    short3: '异能回+15%技且+4⭐',
    tier2Desc: '2件套装：3~8 阶甜品异能范围扩大 +22%，每次发动异能额外获 +¥60！',
    tier3Desc: '3件套装：每次发动甜品异能回复 +15% 招牌技并额外爆 +4⭐！'
  },
  greed: {
    id: 'greed',
    tag: '#贪婪',
    short2: '基薪+12🪙·VIP赏+20%',
    short3: '全局营业额再×1.30',
    tier2Desc: '2件套装：每幕过关基薪额外 +12🪙，全场 VIP 订单赏金 +20%！',
    tier3Desc: '3件套装：全局合成与出餐营业额额外叠乘 ×1.30！'
  }
};

const RELICS = [
  // Archetype 1: Cascade / Serve Build
  {
    id: 'rel_aftershock',
    archetype: 'cascade',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '🌊',
    name: '热盘余震',
    price: 30,
    desc: '每次点击出餐抽走甜品，在原位产生半径 135px 的内吸脉冲，把周围甜品拉拢相撞。'
  },
  {
    id: 'rel_domino',
    archetype: 'cascade',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: '🔔',
    name: '多米诺餐铃',
    price: 45,
    desc: '抽底雪崩判定窗由 2.6s 延长至 4.2s，且雪崩期间每次连合倍率额外 +0.5×！'
  },
  {
    id: 'rel_tradeup',
    archetype: 'cascade',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: '🔥',
    name: '以小换大炉',
    price: 50,
    desc: '每次点击出餐 ≥4 阶甜品，自动将罐内随机 1 颗最低阶甜品免费升 1 阶。'
  },
  {
    id: 'rel_perpetual',
    archetype: 'cascade',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: '♾️',
    name: '翻台永动机',
    price: 70,
    desc: '雪崩 2 连返还 +1 步取消每幕上限，且触发时立刻追加 1 份鲜度加倍订单！'
  },
  // Archetype 2: Bank-Shot / Pinball Build
  {
    id: 'rel_prism',
    archetype: 'bank',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '💎',
    name: '玻璃折光糖',
    price: 30,
    desc: '弹壁反弹后的首次合成营业额由 ×1.5 升至 ×2.0，且下颗待投甜品必定镀金！'
  },
  {
    id: 'rel_bouncy',
    archetype: 'bank',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '🍮',
    name: '高弹舒芙蕾壁',
    price: 35,
    desc: '全甜品撞墙弹性 +0.25、最大抛射初速 +25%，允许二段弹壁（×2.8 营业额）！'
  },
  {
    id: 'rel_bumpers',
    archetype: 'bank',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: '🧈',
    name: '私藏黄油弹柱',
    price: 50,
    desc: '罐内永久安装 2 枚高弹黄油星柱；甜品每碰柱 +¥45 且该球合成 +35% 暴击！'
  },
  {
    id: 'rel_ricochet',
    archetype: 'bank',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: '🏹',
    name: '神枪跳阶箭',
    price: 75,
    desc: '经弹壁直接触发合成时，45% 概率奇迹跳升 +2 阶，并额外回复 35% 招牌技！'
  },
  // Archetype 3: Trait / Alchemy Build
  {
    id: 'rel_echo',
    archetype: 'trait',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: '⚗️',
    name: '双重异能炉',
    price: 50,
    desc: '4~8 阶甜品不仅在合成时发动异能，在被点击出餐抽走瞬间也会再发动一次！'
  },
  {
    id: 'rel_lemonade',
    archetype: 'trait',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '🍋',
    name: '柠檬汽水机',
    price: 35,
    desc: '4 阶柠檬塔清杂范围扩至 165px、蒸发最多 4 颗 1~2 阶，每颗爆 +¥90 与 +3🪙！'
  },
  {
    id: 'rel_antigrav',
    archetype: 'trait',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: '🛸',
    name: '月光反重力箱',
    price: 70,
    desc: '每投放 4 步触发 1.3s 全罐重力倒置洗牌，反重力期间所有合成享 ×2.2 营业额！'
  },
  {
    id: 'rel_resonance',
    archetype: 'trait',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '🧲',
    name: '共鸣磁铃',
    price: 30,
    desc: '任意甜品发动异能时，为全罐同阶甜品施加 2.5s 柔和星磁引力牵引。'
  },
  // Archetype 4: High-Roller / Greed Build
  {
    id: 'rel_aged',
    archetype: 'greed',
    rarity: 'rare',
    rarityLabel: '稀有',
    icon: '📜',
    name: '陈酿焦糖账本',
    price: 45,
    desc: '每过 1 步，罐内可出餐却暂不出手的甜品出餐价 +30%（最高 5 层 ×2.5）！'
  },
  {
    id: 'rel_crown_aura',
    archetype: 'greed',
    rarity: 'legendary',
    rarityLabel: '传说',
    icon: '👑',
    name: '星冠威压',
    price: 75,
    desc: '罐内每存在 1 颗 ≥6 阶甜品，全局合成与出餐营业额叠乘 ×1.35！'
  },
  {
    id: 'rel_double_vip',
    archetype: 'greed',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '🎀',
    name: '双席 VIP 厅',
    price: 35,
    desc: '将快餐桌永久升级为第二张 VIP 桌，且全场 VIP 订单赏金与出餐额外 +40%！'
  },
  {
    id: 'rel_interest',
    archetype: 'greed',
    rarity: 'common',
    rarityLabel: '普通',
    icon: '⚖️',
    name: '金库复利秤',
    price: 30,
    desc: '背包内每持有 10🪙 秘方币，全局合成与出餐营业额 +7%（最高 +105%）！'
  }
];

const DECK_MODS = [
  {
    id: 'mod_trim_t1',
    icon: '🚫',
    name: '筛除1阶蓝莓',
    price: 40,
    maxBuy: 1,
    desc: '永久移除本局 1 阶蓝莓出率，比例并入 2~3 阶甜品，大幅提纯队列！'
  },
  {
    id: 'mod_boost_t3',
    icon: '🍵',
    name: '抹茶原料浓缩',
    price: 35,
    maxBuy: 2,
    desc: '本局投放池 3~4 阶出现权重翻倍，更快合成高阶大单！'
  },
  {
    id: 'mod_gold_tray',
    icon: '✨',
    name: '镀金烤盘',
    price: 30,
    maxBuy: 2,
    desc: '待投甜品镀金概率永久 +18%（镀金合成 ×2.5、出餐 ×1.8）！'
  },
  {
    id: 'mod_rainbow',
    icon: '🌈',
    name: '星露浓缩瓶',
    price: 35,
    maxBuy: 2,
    desc: '彩虹万能糖保底步数永久 -3 步，且立刻赠送 1 颗进队列！'
  },
  {
    id: 'mod_steps',
    icon: '⏳',
    name: '延长夜班',
    price: 25,
    maxBuy: 99,
    desc: '下一幕初始步数 +3 步，从容布阵冲击超高营业额！'
  },
  {
    id: 'mod_tool',
    icon: '🧰',
    name: '紧急厨具补给',
    price: 20,
    maxBuy: 99,
    desc: '立刻补充「🔔 摇一摇 +1」与「✨ 升阶勺 +1」！'
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
  },
  {
    id: 'shift_clear_1',
    tierImg: 4,
    name: '夜班达人',
    desc: '在主厨模式通关至少 1 幕夜宵营业',
    check: (s) => (s.lifetimeStats.shiftsClearedTotal || 0) >= 1
  },
  {
    id: 'shift_clear_5',
    tierImg: 8,
    name: '星冠大赏王',
    desc: '完整通关 5 幕【星冠大赏】深夜闯关',
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

const SOLO_EMOTES = ['✦', '♪', '喵~', '✨', '♡', '★', '!', '♛', '👑'];

const MODE_GUIDES = {
  chef: {
    mode: 'chef',
    icon: 'mode_chef',
    title: '星夜主厨 · 新手三步指引',
    subtitle: '5 幕闯关 × 订单上菜 × 秘方流派构筑',
    steps: [
      {
        focus: 'launcher',
        icon: 'icon_launcher',
        tag: '第 1 / 3 步 · 恒速定角',
        title: '固定中央恒速发射 · 拖动调角弹壁',
        lines: [
          '发射器固定在罐口正中，采用恒定黄金初速，只需专注瞄准角度！',
          '在罐内拖动即可旋转角度并预览落点与异能范围，弹壁合成享 ×1.5 加成！',
          '上滑移出罐口外松手即可取消本次发射。'
        ]
      },
      {
        focus: 'serve',
        icon: 'serve_bell',
        tag: '第 2 / 3 步 · 点击上菜',
        title: '亮铃甜品直接点选上菜 · 抽底雪崩',
        lines: [
          '上方展示顾客点单；亮铃甜品可直接点击上菜，「差1合」绿框代表再合一次即达订单！',
          '点单条支持单桌独立换单（每幕首次免费，后续仅需 3🪙 或折损鲜度）。',
          '抽走甜品瞬间上方塌落相撞会触发【抽底雪崩】高倍连合与步数返还！'
        ]
      },
      {
        focus: 'hud_skill',
        icon: 'icon_coin',
        tag: '第 3 / 3 步 · 过关与构筑',
        title: '限定步数达标 · 凑流派套装共鸣',
        lines: [
          '在左上角步数耗尽前达成营业额即过关（提前达标可点「立即打烊」赚利息币）！',
          '每幕过关进【后厨整备间】，凑齐 2/3 件同标签秘方可激活强力流派套装共鸣！',
          '上菜蓄满底部中央头像，即可释放搭档专属招牌主动技！'
        ]
      }
    ]
  },
  rush: {
    mode: 'rush',
    icon: 'mode_rush',
    title: '90秒狂欢 · 极速续命指引',
    subtitle: '无步数限制 × 连出叠倍 × 溢罐不秒死',
    steps: [
      {
        focus: 'launcher',
        icon: 'icon_launcher',
        tag: '第 1 / 3 步 · 极速连发',
        title: '中央恒速连发 · 冲刺星光狂热',
        lines: [
          '本模式无步数限制！发射口固定正中央恒速发射，拖动调角松手即射。',
          '连续合成积攒星光槽，进入狂热状态享受最高 5× 积分爆发！'
        ]
      },
      {
        focus: 'serve',
        icon: 'mode_rush',
        tag: '第 2 / 3 步 · 连出叠倍',
        title: '开局闪电单 · 连续上菜最高 +4.5 秒 & ×2.5',
        lines: [
          '开局即送低阶闪电迎宾单！点击罐内亮铃甜品立刻端走续命！',
          '12 秒内连续出餐可叠高【连出倍率 ×1.35~×2.5】并每次延长 +3.0~4.5 秒！'
        ]
      },
      {
        focus: 'danger_dock',
        icon: 'icon_gift',
        tag: '第 3 / 3 步 · 星风救急',
        title: '溢罐自动吹散不秒死 · 善用技能',
        lines: [
          '甜品堆过顶部警戒线不会直接判负，星风会自动吹散顶部甜品救急（仅扣 5 秒）！',
          '下方摇一摇、招牌技与升阶勺可随时解围冲分！'
        ]
      }
    ]
  },
  zen: {
    mode: 'zen',
    icon: 'mode_zen',
    title: '悠闲经典 · 惬意烘焙指引',
    subtitle: '零时间与步数压力 × 探索 9 阶传说甜点',
    steps: [
      {
        focus: 'launcher',
        icon: 'icon_launcher',
        tag: '第 1 / 2 步 · 随心弹射',
        title: '无压恒速发射 · 可视化甜品异能',
        lines: [
          '没有步数、倒计时与订单催促！在罐口中央自由调整角度发射。',
          '瞄准可合成目标时，会直观显示柠檬塔清杂、大福聚拢等异能作用范围！'
        ]
      },
      {
        focus: 'hold_milestone',
        icon: 'icon_gift',
        tag: '第 2 / 2 步 · 暂存与祝福',
        title: '右上角暂存换牌 · 积分领祝福',
        lines: [
          '点击右上角「暂存」可随时调换手牌；每达积分里程碑可三选一星夜祝福！',
          '向最高 9 阶传说甜点【星冠猫神舒芙蕾】发起挑战吧～'
        ]
      }
    ]
  },
  tip_glaze_ring: {
    mode: 'tip_glaze_ring',
    isMechanicTip: true,
    icon: 'icon_stardust',
    title: '新机关登场 · 焦糖星环',
    subtitle: '穿环即刻镀金 · 高倍合成与出餐',
    steps: [
      {
        focus: 'glaze_ring',
        icon: 'icon_stardust',
        tag: '机关指南 · 1 / 1',
        title: '瞄准穿过巡游星环 · 甜品免费镀金！',
        lines: [
          '焦糖星环会在罐中上部左右巡游，不会阻挡甜品下落。',
          '让抛出的甜品穿过圆环中心，即可立刻镀上黄金糖霜（合成 ×2.5 · 出餐 ×1.8）！',
          '瞄准虚线穿过圆环时会自动亮起金色星芒提示，看准时机松手吧！'
        ]
      }
    ]
  },
  tip_frozen: {
    mode: 'tip_frozen',
    isMechanicTip: true,
    icon: 'icon_help',
    title: '新机制登场 · 冰封残局甜品',
    subtitle: '三种方式破冰 · 每颗爆 +¥120 破冰赏',
    steps: [
      {
        focus: 'frozen',
        icon: 'icon_paw_guide',
        tag: '破冰指南 · 1 / 1',
        title: '周边合成 / 重锤 / 摇一摇即可破冰！',
        lines: [
          '裹着冰晶的甜品暂时无法合成、点击上菜，也无法被捞底/移形/升阶勺选中。',
          '破冰三招：① 在周边(110px)完成任意合成  ② 柴柴【元气重锤】轰击  ③ 左下角【摇一摇】全罐震碎！',
          '瞄准冰封旁可合成甜品时会亮起破冰提示，每次破冰立得 +¥120 赏金！'
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
