/**
 * Roguelite Perks & Daily Modifiers Catalog (v0.12 M3, direction D).
 *
 * 18 data-driven perks (8 common / 6 rare / 4 legendary):
 *   - 12 unlocked by default; 6 unlockable in Kissa Research Lab (研究所) to add to the pool.
 *   - Scene bonuses are bounded by SCORE_ZONES.sceneCap (or endlessSceneCap = 1.60).
 */
'use strict';

const PERK_LIST = Object.freeze([
  // --- 8 Common (普通) ---
  Object.freeze({
    id: 'warm_hearth',
    name: '暖炉',
    rarity: 'common',
    researchCost: 0,
    desc: '面团暖温下限降低 8 度，更易保持温区',
    hooks: { doughWarmMinDelta: -8 }
  }),
  Object.freeze({
    id: 'extra_tray',
    name: '扩盘',
    rarity: 'common',
    researchCost: 0,
    desc: '本局托盘容量 +1 格（上限 5 格）',
    hooks: { trayCapDelta: 1 }
  }),
  Object.freeze({
    id: 'rush_specialist',
    name: '急单达人',
    rarity: 'common',
    researchCost: 0,
    desc: '小狐狸急单赏金额外 +0.15',
    hooks: { urgentBountyDelta: 0.15 }
  }),
  Object.freeze({
    id: 'quick_trash',
    name: '快手清理',
    rarity: 'common',
    researchCost: 0,
    desc: '厨余篮整理冷却减半',
    hooks: { trashCooldownMult: 0.5 }
  }),
  Object.freeze({
    id: 'tea_aroma',
    name: '茶香满屋',
    rarity: 'common',
    researchCost: 0,
    desc: '全员顾客初始耐心 +18%',
    hooks: { patienceMultDelta: 0.18 }
  }),
  Object.freeze({
    id: 'flour_sifter',
    name: '精选面粉',
    rarity: 'common',
    researchCost: 0,
    desc: '揉面与滑行刷出 C2 概率 +10%',
    hooks: { c2RateDelta: 0.10 }
  }),
  Object.freeze({
    id: 'steady_combo',
    name: '稳步连击',
    rarity: 'common',
    researchCost: 0,
    desc: '连击持续时间延长 +3 秒',
    hooks: { comboWindowDelta: 3.0 }
  }),
  Object.freeze({
    id: 'spare_utensil',
    name: '备用厨具',
    rarity: 'common',
    researchCost: 0,
    desc: '立刻获得移位叉 +1 与升阶勺 +1',
    hooks: { grantFork: 1, grantSpoon: 1 }
  }),

  // --- 6 Rare (稀有) ---
  Object.freeze({
    id: 'matcha_dyehouse',
    name: '抹茶茶坊',
    rarity: 'rare',
    researchCost: 0,
    desc: '合出 C4 猫饼时自动染成抹茶风味',
    hooks: { onMergeDye: { tier: 4, flavor: 'matcha' } }
  }),
  Object.freeze({
    id: 'full_tray_cheer',
    name: '满盘欢赞',
    rarity: 'rare',
    researchCost: 0,
    desc: '托盘满格时上菜，搭档技能 +30%',
    hooks: { fullTraySkillGain: 30 }
  }),
  Object.freeze({
    id: 'double_steam',
    name: '双倍热气',
    rarity: 'rare',
    researchCost: 0,
    desc: '出炉热乎时间延长 +4 秒',
    hooks: { freshWindowDelta: 4.0 }
  }),
  Object.freeze({
    id: 'berry_jam_pot',
    name: '果酱甜杯',
    rarity: 'rare',
    researchCost: 120,
    desc: '合出 C4 猫饼时自动染成草莓风味',
    hooks: { onMergeDye: { tier: 4, flavor: 'berry' } }
  }),
  Object.freeze({
    id: 'crit_spark',
    name: '暴击星火',
    rarity: 'rare',
    researchCost: 140,
    desc: '每次烘焙暴击额外 +8 热潮与 +8% 技能',
    hooks: { critExtraFever: 8, critExtraSkill: 8 }
  }),
  Object.freeze({
    id: 'fever_feast',
    name: '热潮盛宴',
    rarity: 'rare',
    researchCost: 160,
    desc: '星光热潮内场面区额外 +0.20（上限内）',
    hooks: { feverSceneDelta: 0.20 }
  }),

  // --- 4 Legendary (传说) ---
  Object.freeze({
    id: 'eternal_fever',
    name: '永续热潮',
    rarity: 'legendary',
    researchCost: 0,
    desc: '热潮上菜续时无上限（每次 +0.5 秒）',
    hooks: { eternalFeverExtend: 0.5 }
  }),
  Object.freeze({
    id: 'neko_blessing',
    name: '猫神护福',
    rarity: 'legendary',
    researchCost: 180,
    desc: '开局自动投放 1 块 C5 猫饼',
    hooks: { startSpawnTier: 5 }
  }),
  Object.freeze({
    id: 'golden_touch',
    name: '点石成金',
    rarity: 'legendary',
    researchCost: 220,
    desc: '合出 C5+ 猫饼自动镀金（1.35×）',
    hooks: { onMergeGoldMinTier: 5 }
  }),
  Object.freeze({
    id: 'starlight_crown',
    name: '星冠加持',
    rarity: 'legendary',
    researchCost: 260,
    desc: '上菜场面区永久 +0.25，并提高场面封顶至 1.60',
    hooks: { flatSceneBonus: 0.25, sceneCapOverride: 1.60 }
  })
]);

const PERK_BY_ID = Object.freeze(
  PERK_LIST.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, Object.create(null))
);

function getPerkById(id) {
  return (id && PERK_BY_ID[id]) || null;
}

function getUnlockedPerkPool(researchUnlocks) {
  const unlocked = researchUnlocks && typeof researchUnlocks === 'object' ? researchUnlocks : {};
  return PERK_LIST.filter((p) => p.researchCost <= 0 || unlocked[`perk_${p.id}`] === true);
}

module.exports = {
  PERK_LIST,
  PERK_BY_ID,
  getPerkById,
  getUnlockedPerkPool
};
