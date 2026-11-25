/**
 * Customer Traits System (v0.12 M3, direction D).
 *
 * Pure data + pure hook evaluation for all 8 starlight cafe customers.
 * Score multipliers belong to the Customer Zone (capped by SCORE_ZONES.traitCap = 1.60).
 */
'use strict';

const TRAIT_CATALOG = Object.freeze({
  cust_ragdoll: Object.freeze({
    id: 'gentle',
    customerId: 'cust_ragdoll',
    name: '温柔',
    shortTag: '温',
    badgeColor: '#F3A8B8',
    desc: '绿段上菜时，同桌顾客耐心 +10%',
    patienceBoostOthers: 0.10
  }),
  cust_orange: Object.freeze({
    id: 'big_appetite',
    customerId: 'cust_orange',
    name: '大食',
    shortTag: '食',
    badgeColor: '#F39C4A',
    desc: '端上 3 品套餐时，热潮能量 +10',
    feverBonus3Item: 10
  }),
  cust_silver: Object.freeze({
    id: 'matcha_fan',
    customerId: 'cust_silver',
    name: '抹茶迷',
    shortTag: '茶',
    badgeColor: '#6EB862',
    desc: '端上含抹茶订单时，搭档技能 +12%',
    skillBonusMatcha: 12
  }),
  cust_rabbit: Object.freeze({
    id: 'berry_sweet',
    customerId: 'cust_rabbit',
    name: '莓好',
    shortTag: '莓',
    badgeColor: '#EC6E9B',
    desc: '端上含草莓订单，下次揉面必出 C3 草莓',
    nextKneadTier: 3,
    nextKneadFlavor: 'berry'
  }),
  cust_raccoon: Object.freeze({
    id: 'gift_back',
    customerId: 'cust_raccoon',
    name: '回礼',
    shortTag: '礼',
    badgeColor: '#B8885C',
    desc: '上菜 30% 概率赠 1 把厨具（每局限 1 次）',
    toolGiftChance: 0.30
  }),
  cust_shiba: Object.freeze({
    id: 'impatient_tip',
    customerId: 'cust_shiba',
    name: '急性子',
    shortTag: '快',
    badgeColor: '#F0B642',
    desc: '剩余耐心 >=60% 上菜，顾客区 ×1.15',
    quickServeMult: 1.15,
    quickMinRatio: 0.60
  }),
  cust_fox: Object.freeze({
    id: 'good_word',
    customerId: 'cust_fox',
    name: '好评',
    shortTag: '赞',
    badgeColor: '#E8734A',
    desc: '上菜后全员在座顾客耐心 +15%',
    patienceBoostAll: 0.15
  }),
  cust_critic: Object.freeze({
    id: 'connoisseur',
    customerId: 'cust_critic',
    name: '品鉴',
    shortTag: '鉴',
    badgeColor: '#D49A2A',
    desc: '整单热乎端上时，顾客区额外 ×1.30',
    allHotMult: 1.30
  })
});

function getCustomerTrait(customerId) {
  return (customerId && TRAIT_CATALOG[customerId]) || null;
}

function createTraitRunState() {
  return {
    raccoonGifted: false,
    pendingKneadOverride: null,
    triggers: {}
  };
}

/**
 * Computes the customer-zone trait multiplier BEFORE serve score is finalized.
 * @param {object} seat { customerId, patience, maxPatience }
 * @param {object} ctx  { allHot }
 */
function computeTraitScoreMult(seat, ctx) {
  if (!seat) return 1.0;
  const cid = seat.customerId;
  const t = TRAIT_CATALOG[cid];
  if (!t) return 1.0;
  if (cid === 'cust_shiba') {
    const maxP = Math.max(1, Number(seat.maxPatience) || 1);
    const ratio = (Number(seat.patience) || 0) / maxP;
    if (ratio >= t.quickMinRatio) return t.quickServeMult;
  }
  if (cid === 'cust_critic' && ctx && ctx.allHot) {
    return t.allHotMult;
  }
  return 1.0;
}

/**
 * Evaluates post-serve trait side effects (never directly adds score).
 * Returns { triggered, name, text, patienceOthers, patienceAll, feverGain, skillGain,
 *           nextKnead, giftTool }
 */
function evaluateServeTrait(traitState, serveCtx, rngFn) {
  const none = {
    triggered: false,
    name: '',
    text: '',
    patienceOthers: 0,
    patienceAll: 0,
    feverGain: 0,
    skillGain: 0,
    nextKnead: null,
    giftTool: null
  };
  if (!serveCtx) return none;
  const cid = serveCtx.customerId;
  const t = TRAIT_CATALOG[cid];
  if (!t) return none;
  const rng = typeof rngFn === 'function' ? rngFn : Math.random;
  const mark = () => {
    if (traitState && traitState.triggers) {
      traitState.triggers[t.id] = (traitState.triggers[t.id] || 0) + 1;
    }
  };

  if (cid === 'cust_ragdoll') {
    if ((Number(serveCtx.pRatio) || 0) > 0.60) {
      mark();
      return { ...none, triggered: true, name: t.name, text: '温柔：同桌耐心+10%', patienceOthers: t.patienceBoostOthers };
    }
    return none;
  }
  if (cid === 'cust_orange') {
    if ((Number(serveCtx.itemCount) || 0) >= 3) {
      mark();
      return { ...none, triggered: true, name: t.name, text: '大食：热潮+10', feverGain: t.feverBonus3Item };
    }
    return none;
  }
  if (cid === 'cust_silver') {
    const hasMatcha = Boolean(
      serveCtx.hasMatcha ||
        (Array.isArray(serveCtx.usedTiles) && serveCtx.usedTiles.some((x) => x && (x.flavor === 'matcha' || x.flavor === 'gold')))
    );
    const reqMatcha = Boolean(
      serveCtx.reqMatcha ||
        (Array.isArray(serveCtx.slots) && serveCtx.slots.some((s) => s && s.flavor === 'matcha'))
    );
    if (reqMatcha || hasMatcha) {
      mark();
      return { ...none, triggered: true, name: t.name, text: '抹茶迷：技能+12%', skillGain: t.skillBonusMatcha };
    }
    return none;
  }
  if (cid === 'cust_rabbit') {
    const hasBerry = Boolean(
      serveCtx.hasBerry ||
        (Array.isArray(serveCtx.usedTiles) && serveCtx.usedTiles.some((x) => x && (x.flavor === 'berry' || x.flavor === 'gold')))
    );
    const reqBerry = Boolean(
      serveCtx.reqBerry ||
        (Array.isArray(serveCtx.slots) && serveCtx.slots.some((s) => s && s.flavor === 'berry'))
    );
    if (reqBerry || hasBerry) {
      mark();
      const nextKnead = { tier: t.nextKneadTier, flavor: t.nextKneadFlavor };
      if (traitState) traitState.pendingKneadOverride = nextKnead;
      return { ...none, triggered: true, name: t.name, text: '莓好：下次揉面C3草莓', nextKnead };
    }
    return none;
  }
  if (cid === 'cust_raccoon') {
    if (traitState && traitState.raccoonGifted) return none;
    if (rng() < t.toolGiftChance) {
      if (traitState) traitState.raccoonGifted = true;
      mark();
      const giftTool = rng() < 0.5 ? 'fork' : 'spoon';
      return {
        ...none,
        triggered: true,
        name: t.name,
        text: giftTool === 'fork' ? '回礼：赠移位叉+1' : '回礼：赠升阶勺+1',
        giftTool
      };
    }
    return none;
  }
  if (cid === 'cust_shiba') {
    if ((Number(serveCtx.pRatio) || 0) >= t.quickMinRatio) {
      mark();
      return { ...none, triggered: true, name: t.name, text: '急性子 ×1.15' };
    }
    return none;
  }
  if (cid === 'cust_fox') {
    mark();
    return { ...none, triggered: true, name: t.name, text: '好评：全员耐心+15%', patienceAll: t.patienceBoostAll };
  }
  if (cid === 'cust_critic') {
    if (serveCtx.allHot) {
      mark();
      return { ...none, triggered: true, name: t.name, text: '品鉴热乎 ×1.30' };
    }
    return none;
  }
  return none;
}

module.exports = {
  TRAIT_CATALOG,
  getCustomerTrait,
  createTraitRunState,
  computeTraitScoreMult,
  evaluateServeTrait
};
