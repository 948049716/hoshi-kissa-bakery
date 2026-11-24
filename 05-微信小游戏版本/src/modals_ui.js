/**
 * Canvas 2D Storybook Interactive Modals & 6-Step Non-Blocking Spotlight Tutorial Overlay
 * for Hoshi Kissa Bakery v2.0 (WeChat Mini Game Edition).
 *
 * Strictly enforces:
 * - Zero HSL color strings (strictly hex/rgb/rgba for iOS WeChat Canvas safety)
 * - Zero native Unicode emoji / star / dingbat characters (100% atlas & vector icons)
 * - Immediate hits.clear() when activeModal !== null (zero background/backdrop hitbox overlap)
 * - Zero-scroll responsive grids on Shop (all 4 tabs) & Compendium (both tabs) across 375x667, 390x844, 1280x760
 * - Pure Node.js stub-canvas (ctx === null) geometry & HitRegistry parity
 */
'use strict';

const {
  CATCAKES,
  getCatcakePrice,
  SHOP_DEVICES,
  PATRONS,
  BOARD_THEME_LIST,
  TUTORIAL_STEPS,
  ACHIEVEMENTS,
  normalizePatronId,
  getChefRank
} = require('./constants');
const {
  RECIPES,
  RECIPE_LIST,
  getLevelById,
  getNextLevelId,
  computeTotalStars,
  isLevelUnlocked
} = require('./levels_data');
const UI = require('./ui_draw');
const BoardRenderer = require('./board_renderer');
const {
  getSafeCtx,
  drawRedDot,
  drawLockIcon
} = require('./screens_ui');

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function formatClockMMSS(sec) {
  const s = Math.max(0, Math.ceil(Number(sec) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm < 10 ? '0' + mm : String(mm)}:${ss < 10 ? '0' + ss : String(ss)}`;
}

function appendRoundRectSubpath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function renderModalFrame(ctx, metrics, app, maxW, desiredH, dismissOnOutside) {
  const c = getSafeCtx(ctx);
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const width = Math.max(320, Number(m.width) || 390);
  const height = Math.max(480, Number(m.height) || 844);
  const safeTop = Math.max(0, Number(m.safeTop) || 0);
  const safeBottom = Math.max(0, Number(m.safeBottom) || 0);
  const mr =
    m.menuRect && typeof m.menuRect === 'object' && Number.isFinite(m.menuRect.bottom)
      ? m.menuRect
      : null;

  const topBound = mr ? Math.max(Math.round(mr.bottom) + 6, safeTop + 8) : Math.max(12, safeTop + 8);
  const botBound = height - Math.max(10, safeBottom + 8);

  c.save();
  try {
    c.fillStyle = 'rgba(18, 10, 6, 0.72)';
    c.fillRect(0, 0, width, height);
  } finally {
    c.restore();
  }

  const w = Math.min(maxW, width - 20);
  const availH = Math.max(200, botBound - topBound);
  const h = Math.min(desiredH, availH);
  const x = Math.round((width - w) * 0.5);
  const y = Math.round(topBound + (availH - h) * 0.5);

  UI.drawWoodBoard(c, x, y, w, h, 16, true);
  const pad = 8;
  UI.drawParchmentSheet(c, x + pad, y + pad, w - pad * 2, h - pad * 2, 11);

  app.activeModalFrame = {
    x,
    y,
    w,
    h,
    dismissOnOutside: Boolean(dismissOnOutside)
  };

  return {
    width,
    height,
    cardX: x,
    cardY: y,
    cardW: w,
    cardH: h,
    ix: x + pad + 9,
    iy: y + pad + 9,
    iw: w - (pad + 9) * 2,
    ih: h - (pad + 9) * 2,
    topBound,
    botBound
  };
}

function drawModalHeader(ctx, f, sprites, iconKey, title, subtitle = '', rightReserve = 38) {
  const c = getSafeCtx(ctx);
  let tx = f.ix;
  if (iconKey) {
    const icS = subtitle ? 28 : 24;
    const icY = subtitle ? f.iy + 15 : f.iy + 14;
    if (UI.drawUiIcon(c, sprites || {}, iconKey, f.ix + icS * 0.5, icY, icS)) {
      tx = f.ix + icS + 6;
    }
  }
  const availW = Math.max(60, f.ix + f.iw - rightReserve - tx);
  if (subtitle) {
    UI.drawFitText(c, title, tx, f.iy + 9, availW, 15, 11, 900, '#4A2C2A', 'left', 'middle');
    UI.drawFitText(c, subtitle, tx, f.iy + 24, availW, 10, 8.2, 700, '#884A18', 'left', 'middle');
  } else {
    UI.drawFitText(c, title, tx, f.iy + 14, availW, 15.5, 11.5, 900, '#4A2C2A', 'left', 'middle');
  }
}

function drawCloseButton(ctx, f, hits, app, onCloseOverride = null) {
  const c = getSafeCtx(ctx);
  const bw = 30;
  const bh = 28;
  const bx = f.ix + f.iw - bw;
  const by = f.iy;
  UI.drawPillButton(c, bx, by, bw, bh, {
    style: 'wood',
    icon: 'icon_close',
    sprites: app.sprites || {},
    iconSize: 18,
    radius: 9,
    fallbackText: '关'
  });
  hits.add('modal_close', bx, by, bw, bh, () => {
    if (typeof onCloseOverride === 'function') onCloseOverride();
    else app.closeModal();
  });
}

function renderLevelPreviewModal(ctx, metrics, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 444, 424, true);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const lvl = getLevelById(app.previewLevelId || saveData.highestUnlockedLevel || '1-1') || getLevelById('1-1');

  drawModalHeader(c, f, sprites, 'serve_bell', `第 ${lvl.id} 关 · ${lvl.name}`, lvl.desc || '', 38);
  drawCloseButton(c, f, hits, app);

  // Row 1: Shaped Board Miniature + Target & Recipe Info Card
  const row1Y = f.iy + 36;
  const row1H = Math.min(142, Math.max(116, Math.floor(f.ih * 0.37)));
  const thumbW = Math.min(136, Math.floor(f.iw * 0.40));
  const thumbRect = { x: f.ix, y: row1Y, w: thumbW, h: row1H };

  UI.drawKissaCard(c, thumbRect.x, thumbRect.y, thumbRect.w, thumbRect.h, {
    tone: 'soft',
    radius: 11
  });
  BoardRenderer.renderBoardStage(
    c,
    { x: thumbRect.x + 4, y: thumbRect.y + 4, w: thumbRect.w - 8, h: thumbRect.h - 8 },
    lvl,
    null,
    app.equippedTheme,
    sprites,
    null,
    nowSec,
    { thumbnail: true, minCellSize: 15, maxCellSize: 26 }
  );

  const metaX = thumbRect.x + thumbRect.w + 8;
  const metaW = Math.max(120, f.ix + f.iw - metaX);
  UI.drawKissaCard(c, metaX, row1Y, metaW, row1H, { tone: 'cream', radius: 11 });

  UI.drawUiIcon(c, sprites, 'icon_hourglass', metaX + 14, row1Y + 18, 14);
  UI.drawFitText(
    c,
    `营业时长：${lvl.durationSec} 秒`,
    metaX + 24,
    row1Y + 18,
    metaW - 30,
    11.0,
    9.0,
    800,
    '#4A2C2A',
    'left',
    'middle'
  );

  // 1~3 Star target line
  const starY = row1Y + 42;
  for (let s = 0; s < 3; s++) {
    const segW = (metaW - 14) / 3;
    const sx = metaX + 7 + s * segW;
    UI.drawStarIcon(c, sx + 6, starY, 5.2, true);
    UI.drawFitText(
      c,
      String(lvl.stars[s]),
      sx + 14,
      starY + 0.5,
      segW - 16,
      10.0,
      7.8,
      800,
      '#6E463B',
      'left',
      'middle'
    );
  }

  // Compute max recipe tier & special cells
  let maxTier = 2;
  for (let i = 0; i < lvl.allowedRecipes.length; i++) {
    const rec = RECIPES[lvl.allowedRecipes[i]];
    if (rec && Array.isArray(rec.slots)) {
      for (let k = 0; k < rec.slots.length; k++) {
        if (rec.slots[k].tier > maxTier) maxTier = rec.slots[k].tier;
      }
    }
  }
  const matJoined = lvl.matrix.join('');
  const tags = [`C1~C${maxTier}`];
  if (matJoined.includes('M')) tags.push('抹茶格');
  if (matJoined.includes('G')) tags.push('镀金格');
  if (matJoined.includes('B')) tags.push('草莓格');
  if (matJoined.includes('I')) tags.push('破冰');
  if ((lvl.vipQuota || 0) > 0) tags.push(`VIP×${lvl.vipQuota}`);

  UI.drawFitText(
    c,
    `本关特色：${tags.join(' · ')}`,
    metaX + 10,
    row1Y + 67,
    metaW - 18,
    10.0,
    8.0,
    700,
    '#7A5438',
    'left',
    'middle'
  );

  // Sample customer portraits
  const custPreview = ['cust_ragdoll', lvl.chapter >= 2 ? 'cust_silver' : 'cust_orange'];
  if ((lvl.urgentRate || 0) > 0) custPreview.push('cust_fox');
  if ((lvl.vipQuota || 0) > 0) custPreview.push('cust_critic');
  for (let i = 0; i < Math.min(4, custPreview.length); i++) {
    UI.drawCustomerPortrait(
      c,
      sprites,
      custPreview[i],
      metaX + 18 + i * 26,
      row1Y + 94,
      22,
      { circular: true, isVip: custPreview[i] === 'cust_critic', isUrgent: custPreview[i] === 'cust_fox' }
    );
  }

  const bestScore = (saveData.levelBestScores && saveData.levelBestScores[lvl.id]) || 0;
  const prevStars = (saveData.levelStars && saveData.levelStars[lvl.id]) || 0;
  UI.drawFitText(
    c,
    bestScore > 0 ? `历史最佳：${bestScore} 分（${prevStars}星）` : '历史最佳：尚未挑战',
    metaX + 10,
    row1Y + row1H - 14,
    metaW - 18,
    9.8,
    8.0,
    800,
    '#884A18',
    'left',
    'middle'
  );

  // Row 2: 3 Chef Patron Selector Cards
  const patLabelY = row1Y + row1H + 12;
  UI.drawFitText(c, '选择出战搭档：', f.ix, patLabelY, f.iw, 11.0, 9.0, 900, '#4A2C2A', 'left', 'middle');

  const ctaH = 44;
  const ctaY = f.iy + f.ih - ctaH;

  const patCardY = patLabelY + 11;
  const patSummaryH = 26;
  const patCardH = Math.max(54, Math.min(72, ctaY - 8 - patSummaryH - 6 - patCardY));
  const patGap = 6;
  const patW = Math.floor((f.iw - patGap * 2) / 3);
  const selectedPatronId = normalizePatronId(saveData.selectedPatron);
  const unlockedPatrons = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];

  for (let i = 0; i < PATRONS.length; i++) {
    const p = PATRONS[i];
    const px = f.ix + i * (patW + patGap);
    const owned = unlockedPatrons.includes(p.id);
    const active = selectedPatronId === p.id;

    UI.drawKissaCard(c, px, patCardY, patW, patCardH, {
      tone: active ? 'selected' : owned ? 'cream' : 'soft',
      borderColor: active ? '#DF921A' : owned ? '#B98E58' : '#A8937C',
      radius: 10
    });

    UI.drawUiIcon(c, sprites, p.id, px + 20, patCardY + patCardH * 0.5, Math.min(34, patCardH - 12), owned ? 1 : 0.45);
    if (!owned) {
      drawLockIcon(c, px + 20, patCardY + patCardH * 0.68, 11);
    }

    const ptx = px + 38;
    const ptw = Math.max(36, px + patW - 5 - ptx);
    UI.drawFitText(
      c,
      p.name,
      ptx,
      patCardY + patCardH * 0.35,
      ptw,
      10.5,
      8.2,
      900,
      owned ? '#4A2C2A' : '#7D6A58',
      'left',
      'middle'
    );
    UI.drawFitText(
      c,
      !owned ? `小铺 ${p.cost}星` : active ? '出战中' : p.shortPassive,
      ptx,
      patCardY + patCardH * 0.68,
      ptw,
      9.2,
      7.5,
      800,
      active ? '#B85A08' : '#7A5438',
      'left',
      'middle'
    );

    const pidCopy = p.id;
    hits.add(`preview_patron_${pidCopy}`, px, patCardY, patW, patCardH, () =>
      app.selectPatronInPreview(pidCopy)
    );
  }

  // Row 3: Active Patron Passive & Skill Summary Strip
  const activePatron = PATRONS.find((p) => p.id === selectedPatronId) || PATRONS[0];
  const sumY = patCardY + patCardH + 6;
  UI.drawKissaCard(c, f.ix, sumY, f.iw, patSummaryH, { tone: 'amber', radius: 8 });
  UI.drawFitText(
    c,
    `${activePatron.name}：${activePatron.shortPassive} · 招牌技【${activePatron.skillName}】`,
    f.ix + f.iw * 0.5,
    sumY + patSummaryH * 0.5 + 0.5,
    f.iw - 14,
    9.8,
    8.0,
    800,
    '#5A341E',
    'center',
    'middle'
  );

  // Footer Start CTA
  UI.drawPillButton(c, f.ix, ctaY, f.iw, ctaH, {
    style: 'cta',
    icon: 'serve_bell',
    sprites,
    iconSize: 20,
    text: `开始营业（${lvl.durationSec} 秒）`,
    fontSize: 13.8,
    radius: 12
  });
  const startId = lvl.id;
  hits.add('preview_start_btn', f.ix, ctaY, f.iw, ctaH, () => app.startLevel(startId));
}

function renderLevelResultModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 444, 428, false);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const res = app.lastResult || {
    levelId: app.currentLevelId || '1-1',
    cleared: false,
    starsEarned: 0,
    score: 0,
    ordersServed: 0,
    maxCombo: 0,
    vipServed: 0,
    firstStarDustAward: 0,
    clearDustAward: 0,
    vipDustAward: 0,
    threeStarBonusDust: 0,
    consolationDust: 0,
    totalDustAward: 0,
    isNewBest: false,
    elapsedRevealSec: 1.0
  };

  drawModalHeader(
    c,
    f,
    sprites,
    res.cleared ? 'icon_trophy' : 'serve_bell',
    `打烊结算 · 第 ${res.levelId} 关`,
    '',
    38
  );
  drawCloseButton(c, f, hits, app, () => app.closeModal());

  // 1. Star Medallion Stage
  const stageY = f.iy + 34;
  const stageH = 74;
  UI.drawKissaCard(c, f.ix, stageY, f.iw, stageH, {
    tone: res.cleared ? 'selected' : 'soft',
    radius: 12
  });

  const revealT = Number.isFinite(res.elapsedRevealSec) ? res.elapsedRevealSec : 1.0;
  for (let s = 1; s <= 3; s++) {
    const earned = s <= (res.starsEarned || 0);
    const localT = clamp((revealT - (s - 1) * 0.16) / 0.22, 0, 1);
    const popScale = earned ? (localT < 1 ? 0.35 + 0.95 * Math.sin(localT * Math.PI * 0.65) : 1.0) : 0.92;
    UI.drawStarIcon(
      c,
      f.ix + f.iw * 0.5 + (s - 2) * 52,
      stageY + 26,
      18 * popScale,
      earned && localT > 0.05
    );
  }

  const headline =
    res.starsEarned >= 3
      ? '三星完美出餐 · 满堂喝彩！'
      : res.cleared
      ? '营业达标 · 顺利过关！'
      : '未达 1 星目标 · 再接再厉';
  UI.drawFitText(
    c,
    headline,
    f.ix + f.iw * 0.5,
    stageY + 58,
    f.iw - 20,
    12.2,
    9.5,
    900,
    res.cleared ? '#7A3E10' : '#6E4E3A',
    'center',
    'middle'
  );

  // 2. Pure Serve Score & Run Stats Card
  const scoreY = stageY + stageH + 8;
  const scoreH = 78;
  UI.drawKissaCard(c, f.ix, scoreY, f.iw, scoreH, { tone: 'cream', radius: 11 });

  UI.drawFitText(
    c,
    `纯上菜总分：${res.score || 0}`,
    f.ix + 14,
    scoreY + 25,
    f.iw - (res.isNewBest ? 88 : 28),
    15.0,
    11.5,
    900,
    '#4A2C2A',
    'left',
    'middle'
  );
  if (res.isNewBest && (res.score || 0) > 0) {
    UI.drawTagBadge(c, f.ix + f.iw - 68, scoreY + 15, 56, 20, '新纪录', 'berry', 9.2);
  }

  UI.drawFitText(
    c,
    `服务顾客 ${res.ordersServed || 0} 位 · 最高连击 ${res.maxCombo || 0} 连 · VIP ${res.vipServed || 0} 位`,
    f.ix + 14,
    scoreY + 55,
    f.iw - 28,
    10.6,
    8.5,
    700,
    '#6E463B',
    'left',
    'middle'
  );

  // 3. Stardust Settlement Breakdown Card
  const dustY = scoreY + scoreH + 8;
  const btnH = 42;
  const btnY = f.iy + f.ih - btnH;
  const dustH = Math.max(72, btnY - 10 - dustY);

  UI.drawKissaCard(c, f.ix, dustY, f.iw, dustH, { tone: 'amber', radius: 11 });
  UI.drawUiIcon(c, sprites, 'icon_stardust', f.ix + 20, dustY + 22, 20);
  UI.drawFitText(
    c,
    `星尘入账：+${res.totalDustAward || 0}`,
    f.ix + 34,
    dustY + 22,
    f.iw - 130,
    13.2,
    10.5,
    900,
    '#5A341E',
    'left',
    'middle'
  );
  UI.drawFitText(
    c,
    `当前持有 ${saveData.bankStardust || 0}`,
    f.ix + f.iw - 12,
    dustY + 22,
    108,
    10.0,
    8.2,
    800,
    '#7A4818',
    'right',
    'middle'
  );

  const parts = [];
  if (res.cleared) {
    if (res.isReplayDecay || (res.newStarsDelta || 0) === 0) {
      parts.push('重温营业奖励（首星突破奖已领）');
    }
    if (res.firstStarDustAward > 0) parts.push(`首星突破 +${res.firstStarDustAward}`);
    if (res.clearDustAward > 0) parts.push(`过关基础 +${res.clearDustAward}`);
    if (res.vipDustAward > 0) parts.push(`VIP红包 +${res.vipDustAward}`);
    if (res.threeStarBonusDust > 0) parts.push(`三星奖 +${res.threeStarBonusDust}`);
  } else {
    const streak =
      Number(res.failStreak) ||
      (saveData.levelFailStreaks && Number(saveData.levelFailStreaks[res.levelId])) ||
      0;
    const hasSoftPity = Boolean(res.softPityNextRun || streak >= 2);
    if ((res.consolationDust || 0) > 0) {
      parts.push(`营业安慰奖 +${res.consolationDust}`);
    }
    if ((res.vipDustAward || 0) > 0) {
      parts.push(`VIP慰问 +${res.vipDustAward}`);
    }
    if (hasSoftPity) {
      parts.push('下局小蜜柑将为你预充 40% 技能能量！');
    } else if ((res.consolationDust || 0) > 0) {
      parts.push('前往小铺升级猫饼菜价可大幅提分');
    } else {
      parts.push('完成至少 1 单顾客上菜即可获得营业星尘');
    }
  }

  UI.drawWrappedText(
    c,
    parts.join(' · '),
    f.ix + 14,
    dustY + 44,
    f.iw - 28,
    15,
    UI.fontStr(9.8, 700),
    '#6E463B',
    'left',
    2
  );

  // 4. Bottom 3-Button Row
  const gap = 8;
  const bw = Math.floor((f.iw - gap * 2) / 3);
  const nextId = getNextLevelId(res.levelId);
  const nextUnlocked = Boolean(res.cleared && nextId && isLevelUnlocked(nextId, saveData.levelStars).unlocked);

  UI.drawPillButton(c, f.ix, btnY, bw, btnH, {
    style: res.cleared ? 'wood' : 'cta',
    icon: 'icon_restart',
    sprites,
    iconSize: 17,
    text: res.cleared ? '重玩' : '再试一次',
    fontSize: 11.8,
    radius: 11
  });
  hits.add('result_retry_btn', f.ix, btnY, bw, btnH, () => app.startLevel(res.levelId));

  const shopBtnX = f.ix + bw + gap;
  UI.drawPillButton(c, shopBtnX, btnY, bw, btnH, {
    style: 'walnut',
    icon: 'icon_shop',
    sprites,
    iconSize: 17,
    text: '小铺',
    fontSize: 11.8,
    radius: 11
  });
  if (typeof app.hasAffordableShopItem === 'function' && app.hasAffordableShopItem()) {
    drawRedDot(c, shopBtnX + bw - 8, btnY + 8, 4.8);
  }
  hits.add('result_shop_btn', shopBtnX, btnY, bw, btnH, () => app.openShopFromResult());

  const nextBtnX = shopBtnX + bw + gap;
  UI.drawPillButton(c, nextBtnX, btnY, bw, btnH, {
    style: nextUnlocked ? 'cta' : 'wood',
    icon: nextUnlocked ? 'icon_arrow' : 'icon_home',
    sprites,
    iconSize: 17,
    text: res.cleared && nextId ? '下一关' : '返回大厅',
    fontSize: 11.8,
    radius: 11
  });
  hits.add('result_next_btn', nextBtnX, btnY, bw, btnH, () => app.onResultNext());
}

function setupAdaptiveGridScroll(app, ix, iw, bodyY, bodyH, rows, gy, minRowH) {
  const safeRows = Math.max(1, rows);
  const rawCh = Math.floor((bodyH - gy * (safeRows - 1)) / safeRows);
  const ch = Math.max(minRowH, rawCh);
  const contentH = safeRows * ch + Math.max(0, safeRows - 1) * gy;
  const maxScroll = Math.max(0, contentH - bodyH);
  const scrollY = maxScroll > 0 ? clamp(Number(app.modalScrollY) || 0, 0, maxScroll) : 0;
  if (maxScroll > 0) {
    app.modalScrollRect = { x: ix, y: bodyY, w: iw, h: bodyH };
    app.modalMaxScroll = maxScroll;
  } else {
    app.modalScrollRect = null;
    app.modalMaxScroll = 0;
  }
  return { ch, scrollY, maxScroll };
}

function addScrollClippedHit(hits, id, x, y, w, h, scrollY, bodyY, bodyH, onClick) {
  if (scrollY === 0 && y >= bodyY - 1 && y + h <= bodyY + bodyH + 1) {
    hits.add(id, x, y, w, h, onClick);
    return;
  }
  const screenY = y - scrollY;
  const visTop = Math.max(bodyY, screenY);
  const visBot = Math.min(bodyY + bodyH, screenY + h);
  if (visBot - visTop >= 12) {
    hits.add(id, x, visTop, w, visBot - visTop, onClick);
  }
}

function renderShopModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 660, 568, true);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const bank = Math.max(0, Math.floor(Number(saveData.bankStardust) || 0));

  drawModalHeader(c, f, sprites, 'icon_shop', '吃茶小铺', '', 120);
  UI.drawCurrencyChip(
    c,
    f.ix + f.iw - 114,
    f.iy + 1,
    78,
    26,
    sprites,
    'icon_stardust',
    String(bank),
    { style: 'wood', fontSize: 11.2 }
  );
  drawCloseButton(c, f, hits, app);

  // 4 Shop Category Tabs
  const tabs = [
    { id: 'catcakes', label: '猫饼研发' },
    { id: 'devices', label: '后厨设备' },
    { id: 'patrons', label: '搭档' },
    { id: 'themes', label: '皮肤' }
  ];
  const activeTab = app.activeShopTab || 'catcakes';
  const tabY = f.iy + 34;
  const tabH = 28;
  const tabGap = 5;
  const tabW = Math.floor((f.iw - tabGap * 3) / 4);

  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    const tx = f.ix + i * (tabW + tabGap);
    const isAct = activeTab === t.id;
    UI.drawPillButton(c, tx, tabY, tabW, tabH, {
      style: isAct ? 'active' : 'wood',
      text: t.label,
      fontSize: 10.8,
      radius: 9
    });
    if (typeof app.hasAffordableShopTab === 'function' && app.hasAffordableShopTab(t.id)) {
      drawRedDot(c, tx + tabW - 7, tabY + 7, 4.4);
    }
    const tabIdCopy = t.id;
    hits.add(`shop_tab_${tabIdCopy}`, tx, tabY, tabW, tabH, () => app.setShopTab(tabIdCopy));
  }

  const bodyY = tabY + tabH + 6;
  const bodyH = Math.max(240, f.iy + f.ih - bodyY);
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  if (activeTab === 'catcakes') {
    const cols = 2;
    const rows = Math.ceil((CATCAKES.length + 1) / cols);
    const gx = 6;
    const gy = 6;
    const { ch, scrollY, maxScroll } = setupAdaptiveGridScroll(
      app,
      f.ix,
      f.iw,
      bodyY,
      bodyH,
      rows,
      gy,
      68
    );
    const gridW = f.iw - (maxScroll > 0 ? 6 : 0);
    const cw = Math.floor((gridW - gx * (cols - 1)) / cols);

    c.save();
    try {
      if (maxScroll > 0) {
        c.beginPath();
        c.rect(f.ix, bodyY, f.iw, bodyH);
        c.clip();
        c.translate(0, -scrollY);
      }

      for (let i = 0; i < CATCAKES.length; i++) {
        const cake = CATCAKES[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = f.ix + col * (cw + gx);
        const cy = bodyY + row * (ch + gy);

        const isUnlocked =
          typeof app.isCatcakeUnlocked === 'function'
            ? app.isCatcakeUnlocked(cake)
            : isLevelUnlocked(cake.unlockLevel, saveData.levelStars).unlocked;
        const rawLv = saveData.catcakeLevels && saveData.catcakeLevels[cake.tier];
        const lv = clamp(Math.floor(Number(rawLv) || 0), 0, 4);
        const isMax = lv >= 4;
        const cost = isMax ? 0 : cake.upgradeCosts[lv];
        const canBuy = isUnlocked && !isMax && bank >= cost;
        const curP = getCatcakePrice(cake.tier, lv);
        const nextP = isMax ? curP : getCatcakePrice(cake.tier, lv + 1);

        UI.drawKissaCard(c, cx, cy, cw, ch, {
          tone: !isUnlocked ? 'soft' : isMax ? 'equipped' : canBuy ? 'cream' : 'soft',
          radius: 10
        });

        const iconS = Math.min(38, ch - 36);
        UI.drawCatcakeSprite(c, sprites, cake.tier, cx + 22, cy + (ch - 26) * 0.5 + 2, iconS, {
          happy: isUnlocked && isMax,
          silhouette: !isUnlocked
        });
        if (!isUnlocked) {
          drawLockIcon(c, cx + 22, cy + (ch - 26) * 0.5 + 10, 11.5);
        }

        const tx = cx + 42;
        const tw = Math.max(48, cx + cw - 6 - tx);
        UI.drawFitText(
          c,
          `${cake.name}`,
          tx,
          cy + 15,
          tw,
          10.6,
          8.2,
          900,
          isUnlocked ? '#4A2C2A' : '#7D6A58',
          'left',
          'middle'
        );
        UI.drawFitText(
          c,
          `Lv.${lv}/4 · 菜价 ${curP}${isMax ? '' : ' -> ' + nextP}`,
          tx,
          cy + 33,
          tw,
          9.4,
          7.4,
          700,
          '#7A5438',
          'left',
          'middle'
        );

        const btnH = Math.min(24, Math.max(20, Math.floor(ch * 0.25)));
        const btnY = cy + ch - btnH - 5;
        const btnX = cx + 6;
        const btnW = cw - 12;
        UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
          style: !isUnlocked ? 'card' : isMax ? 'equipped' : canBuy ? 'cta' : 'wood',
          disabled: !isUnlocked || (!isMax && !canBuy),
          icon: !isUnlocked || isMax ? '' : 'icon_stardust',
          sprites,
          iconSize: 13,
          text: !isUnlocked ? `${cake.unlockLevel} 解锁` : isMax ? '已满级' : `${cost} 升级`,
          fontSize: 9.8,
          radius: 8
        });
        const tierCopy = cake.tier;
        addScrollClippedHit(
          hits,
          `shop_buy_catcake_${tierCopy}`,
          btnX,
          btnY,
          btnW,
          btnH,
          scrollY,
          bodyY,
          bodyH,
          () => app.buyCatcakeUpgrade(tierCopy)
        );
      }

      // Summary slot showing total R&D progress
      const sIdx = CATCAKES.length;
      const sCol = sIdx % cols;
      const sRow = Math.floor(sIdx / cols);
      const sx = f.ix + sCol * (cw + gx);
      const sy = bodyY + sRow * (ch + gy);
      let totalCakeLv = 0;
      const maxCakeLv = CATCAKES.length * 4;
      for (let t = 1; t <= CATCAKES.length; t++) {
        totalCakeLv += clamp(Math.floor(Number(saveData.catcakeLevels && saveData.catcakeLevels[t]) || 0), 0, 4);
      }
      UI.drawKissaCard(c, sx, sy, cw, ch, { tone: 'amber', radius: 10 });
      UI.drawFitText(c, '研发加成总览', sx + cw * 0.5, sy + ch * 0.34, cw - 14, 11.0, 8.8, 900, '#5A341E', 'center', 'middle');
      UI.drawFitText(c, `已升 ${totalCakeLv} / ${maxCakeLv} 级`, sx + cw * 0.5, sy + ch * 0.62, cw - 14, 10.2, 8.2, 800, '#7A4818', 'center', 'middle');
      UI.drawFitText(c, '每级单品菜价 +15%', sx + cw * 0.5, sy + ch * 0.82, cw - 14, 9.0, 7.5, 700, '#8A5A28', 'center', 'middle');
    } finally {
      c.restore();
    }
    return;
  }

  if (activeTab === 'devices') {
    const cols = 1;
    const rows = Math.max(1, SHOP_DEVICES.length);
    const gx = 8;
    const gy = 6;
    const { ch, scrollY, maxScroll } = setupAdaptiveGridScroll(
      app,
      f.ix,
      f.iw,
      bodyY,
      bodyH,
      rows,
      gy,
      68
    );
    const cw = Math.floor((f.iw - (maxScroll > 0 ? 6 : 0) - gx * (cols - 1)) / cols);

    c.save();
    try {
      if (maxScroll > 0) {
        c.beginPath();
        c.rect(f.ix, bodyY, f.iw, bodyH);
        c.clip();
        c.translate(0, -scrollY);
      }

      for (let i = 0; i < SHOP_DEVICES.length; i++) {
        const dev = SHOP_DEVICES[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = f.ix + col * (cw + gx);
        const cy = bodyY + row * (ch + gy);

        const rawLv = saveData.deviceUpgrades && saveData.deviceUpgrades[dev.id];
        const lv = clamp(Math.floor(Number(rawLv) || 0), 0, dev.maxLv);
        const isMax = lv >= dev.maxLv;
        const cost = isMax ? 0 : dev.costs[lv];
        const canBuy = !isMax && bank >= cost;

        UI.drawKissaCard(c, cx, cy, cw, ch, {
          tone: isMax ? 'equipped' : 'cream',
          radius: 11
        });

        UI.drawUiIcon(c, sprites, dev.icon, cx + 26, cy + ch * 0.5, 30);

        const btnW = 86;
        const btnH = Math.min(30, ch - 18);
        const btnX = cx + cw - 8 - btnW;
        const btnY = Math.round(cy + (ch - btnH) * 0.5);

        const tx = cx + 48;
        const tw = Math.max(60, btnX - 8 - tx);
        UI.drawFitText(
          c,
          `${dev.name}  Lv.${lv}/${dev.maxLv}`,
          tx,
          cy + ch * 0.33,
          tw,
          11.8,
          9.2,
          900,
          '#4A2C2A',
          'left',
          'middle'
        );
        UI.drawWrappedText(
          c,
          dev.getDesc(lv),
          tx,
          cy + ch * 0.52,
          tw,
          13.5,
          UI.fontStr(9.4, 700),
          '#6E463B',
          'left',
          2
        );

        UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
          style: isMax ? 'equipped' : canBuy ? 'cta' : 'wood',
          disabled: !isMax && !canBuy,
          icon: isMax ? '' : 'icon_stardust',
          sprites,
          iconSize: 14,
          text: isMax ? '已满级' : `${cost} 升级`,
          fontSize: 10.2,
          radius: 9
        });
        const devIdCopy = dev.id;
        addScrollClippedHit(
          hits,
          `shop_buy_${devIdCopy}`,
          btnX,
          btnY,
          btnW,
          btnH,
          scrollY,
          bodyY,
          bodyH,
          () => app.buyDeviceUpgrade(devIdCopy)
        );
      }
    } finally {
      c.restore();
    }
    return;
  }

  if (activeTab === 'patrons') {
    const cols = 1;
    const rows = Math.max(1, PATRONS.length);
    const gx = 8;
    const gy = 7;
    const { ch, scrollY, maxScroll } = setupAdaptiveGridScroll(
      app,
      f.ix,
      f.iw,
      bodyY,
      bodyH,
      rows,
      gy,
      74
    );
    const cw = Math.floor((f.iw - (maxScroll > 0 ? 6 : 0) - gx * (cols - 1)) / cols);
    const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
    const selected = normalizePatronId(saveData.selectedPatron);

    c.save();
    try {
      if (maxScroll > 0) {
        c.beginPath();
        c.rect(f.ix, bodyY, f.iw, bodyH);
        c.clip();
        c.translate(0, -scrollY);
      }

      for (let i = 0; i < PATRONS.length; i++) {
        const p = PATRONS[i];
        const cx = f.ix;
        const cy = bodyY + i * (ch + gy);
        const owned = unlocked.includes(p.id);
        const isSelected = owned && selected === p.id;
        const canBuy = !owned && bank >= p.cost;

        UI.drawKissaCard(c, cx, cy, cw, ch, {
          tone: isSelected ? 'selected' : owned ? 'cream' : 'soft',
          radius: 12
        });

        const avatarS = Math.min(54, ch - 20);
        UI.drawUiIcon(
          c,
          sprites,
          p.id,
          cx + 34,
          cy + ch * 0.5,
          avatarS
        );

        const btnW = 92;
        const btnH = 30;
        const btnX = cx + cw - 10 - btnW;
        const btnY = Math.round(cy + (ch - btnH) * 0.5);

        const tx = cx + 66;
        const tw = Math.max(60, btnX - 8 - tx);
        UI.drawFitText(
          c,
          `${p.name} · 【${p.skillName}】`,
          tx,
          cy + 24,
          tw,
          11.8,
          9.2,
          900,
          '#4A2C2A',
          'left',
          'middle'
        );
        UI.drawWrappedText(
          c,
          p.passiveDesc,
          tx,
          cy + 40,
          tw,
          14,
          UI.fontStr(9.4, 700),
          '#6E463B',
          'left',
          3
        );

        const pidCopy = p.id;
        if (!owned) {
          UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
            style: canBuy ? 'cta' : 'wood',
            disabled: !canBuy,
            icon: 'icon_stardust',
            sprites,
            iconSize: 14,
            text: `${p.cost} 邀请`,
            fontSize: 10.4,
            radius: 9
          });
          addScrollClippedHit(
            hits,
            `shop_buy_patron_${pidCopy}`,
            btnX,
            btnY,
            btnW,
            btnH,
            scrollY,
            bodyY,
            bodyH,
            () => app.buyPatron(pidCopy)
          );
        } else {
          UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
            style: isSelected ? 'equipped' : 'walnut',
            text: isSelected ? '出战中' : '切换出战',
            fontSize: 10.4,
            radius: 9
          });
          addScrollClippedHit(
            hits,
            `shop_equip_patron_${pidCopy}`,
            btnX,
            btnY,
            btnW,
            btnH,
            scrollY,
            bodyY,
            bodyH,
            () => app.equipPatron(pidCopy)
          );
        }
      }
    } finally {
      c.restore();
    }
    return;
  }

  // activeTab === 'themes'
  const cols = 1;
  const rows = Math.max(1, BOARD_THEME_LIST.length);
  const gx = 8;
  const gy = 7;
  const { ch, scrollY, maxScroll } = setupAdaptiveGridScroll(
    app,
    f.ix,
    f.iw,
    bodyY,
    bodyH,
    rows,
    gy,
    74
  );
  const cw = Math.floor((f.iw - (maxScroll > 0 ? 6 : 0) - gx * (cols - 1)) / cols);
  const unlockedThemes = Array.isArray(saveData.unlockedThemes) ? saveData.unlockedThemes : ['amber'];
  const equippedId = saveData.equippedTheme || 'amber';

  c.save();
  try {
    if (maxScroll > 0) {
      c.beginPath();
      c.rect(f.ix, bodyY, f.iw, bodyH);
      c.clip();
      c.translate(0, -scrollY);
    }

    for (let i = 0; i < BOARD_THEME_LIST.length; i++) {
      const th = BOARD_THEME_LIST[i];
      const cx = f.ix;
      const cy = bodyY + i * (ch + gy);
      const owned = unlockedThemes.includes(th.id);
      const isEquipped = owned && equippedId === th.id;
      const canBuy = !owned && bank >= th.cost;

      UI.drawKissaCard(c, cx, cy, cw, ch, {
        tone: isEquipped ? 'selected' : owned ? 'cream' : 'soft',
        radius: 12
      });

      const btnW = 92;
      const btnH = 30;
      const btnX = cx + cw - 10 - btnW;
      const btnY = Math.round(cy + (ch - btnH) * 0.5);

      UI.drawThemeSwatch(c, cx + 10, cy + 14, 58, ch - 28, th.id);
      const tx = cx + 76;
      const tw = Math.max(60, btnX - 8 - tx);
      UI.drawFitText(c, th.name, tx, cy + 26, tw, 12.0, 9.5, 900, '#4A2C2A', 'left', 'middle');
      UI.drawWrappedText(c, th.desc, tx, cy + 44, tw, 14, UI.fontStr(9.4, 700), '#6E463B', 'left', 3);

      const tidCopy = th.id;
      if (!owned) {
        UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
          style: canBuy ? 'cta' : 'wood',
          disabled: !canBuy,
          icon: 'icon_stardust',
          sprites,
          iconSize: 14,
          text: `${th.cost} 解锁`,
          fontSize: 10.4,
          radius: 9
        });
        addScrollClippedHit(
          hits,
          `shop_buy_theme_${tidCopy}`,
          btnX,
          btnY,
          btnW,
          btnH,
          scrollY,
          bodyY,
          bodyH,
          () => app.buyTheme(tidCopy)
        );
      } else {
        UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
          style: isEquipped ? 'equipped' : 'walnut',
          text: isEquipped ? '使用中' : '装备皮肤',
          fontSize: 10.4,
          radius: 9
        });
        addScrollClippedHit(
          hits,
          `shop_equip_theme_${tidCopy}`,
          btnX,
          btnY,
          btnW,
          btnH,
          scrollY,
          bodyY,
          bodyH,
          () => app.equipTheme(tidCopy)
        );
      }
    }
  } finally {
    c.restore();
  }
}

function renderCompendiumModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 660, 568, true);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};

  drawModalHeader(
    c,
    f,
    sprites,
    'icon_book',
    '吃茶图鉴',
    `${CATCAKES.length} 阶手绘猫饼与 ${RECIPE_LIST.length} 道甜品套餐配方`,
    38
  );
  drawCloseButton(c, f, hits, app);

  const tabY = f.iy + 34;
  const tabH = 28;
  const tabGap = 6;
  const tabW = Math.floor((f.iw - tabGap) / 2);
  const activeTab = app.activeCompendiumTab || 'catcakes';

  UI.drawPillButton(c, f.ix, tabY, tabW, tabH, {
    style: activeTab === 'catcakes' ? 'active' : 'wood',
    icon: 'C1',
    sprites,
    iconSize: 17,
    text: `${CATCAKES.length} 阶猫饼`,
    fontSize: 11.2,
    radius: 9
  });
  hits.add('compendium_tab_catcakes', f.ix, tabY, tabW, tabH, () => app.setCompendiumTab('catcakes'));

  UI.drawPillButton(c, f.ix + tabW + tabGap, tabY, tabW, tabH, {
    style: activeTab === 'recipes' ? 'active' : 'wood',
    icon: 'serve_bell',
    sprites,
    iconSize: 17,
    text: `${RECIPE_LIST.length} 道菜谱`,
    fontSize: 11.2,
    radius: 9
  });
  hits.add('compendium_tab_recipes', f.ix + tabW + tabGap, tabY, tabW, tabH, () =>
    app.setCompendiumTab('recipes')
  );

  const bodyY = tabY + tabH + 6;
  const bodyH = Math.max(240, f.iy + f.ih - bodyY);
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  if (activeTab === 'catcakes') {
    const cols = 2;
    const rows = Math.ceil((CATCAKES.length + 1) / cols);
    const gx = 6;
    const gy = 6;
    const { ch, scrollY, maxScroll } = setupAdaptiveGridScroll(
      app,
      f.ix,
      f.iw,
      bodyY,
      bodyH,
      rows,
      gy,
      68
    );
    const cw = Math.floor((f.iw - (maxScroll > 0 ? 6 : 0) - gx * (cols - 1)) / cols);

    c.save();
    try {
      if (maxScroll > 0) {
        c.beginPath();
        c.rect(f.ix, bodyY, f.iw, bodyH);
        c.clip();
        c.translate(0, -scrollY);
      }

      for (let i = 0; i < CATCAKES.length; i++) {
        const cake = CATCAKES[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = f.ix + col * (cw + gx);
        const cy = bodyY + row * (ch + gy);
        const unlocked = isLevelUnlocked(cake.unlockLevel, saveData.levelStars).unlocked;
        const lv = clamp(Math.floor(Number(saveData.catcakeLevels && saveData.catcakeLevels[cake.tier]) || 0), 0, 4);
        const price = getCatcakePrice(cake.tier, lv);

        UI.drawKissaCard(c, cx, cy, cw, ch, {
          tone: unlocked ? 'cream' : 'soft',
          radius: 10
        });

        UI.drawCatcakeSprite(c, sprites, cake.tier, cx + 25, cy + ch * 0.46, Math.min(42, ch - 20), {
          silhouette: !unlocked,
          happy: unlocked && lv >= 2
        });

        const tx = cx + 48;
        const tw = Math.max(48, cx + cw - 6 - tx);
        UI.drawFitText(
          c,
          unlocked ? `${cake.id} ${cake.name}` : `${cake.id} 未解锁猫饼`,
          tx,
          cy + 18,
          tw,
          10.8,
          8.2,
          900,
          unlocked ? '#4A2C2A' : '#7D6A58',
          'left',
          'middle'
        );
        UI.drawFitText(
          c,
          `菜价 ${price} · 解锁 ${cake.unlockLevel}`,
          tx,
          cy + 36,
          tw,
          9.2,
          7.5,
          800,
          '#884A18',
          'left',
          'middle'
        );
        if (ch >= 74) {
          UI.drawWrappedText(
            c,
            unlocked ? cake.desc : `推进至第 ${cake.unlockLevel} 关即可烘焙该猫饼`,
            tx,
            cy + 50,
            tw,
            12.5,
            UI.fontStr(8.6, 700),
            '#6E463B',
            'left',
            3
          );
        }
      }

      // Summary card: Achievements & Chef Honor Summary
      const sIdx = CATCAKES.length;
      const sCol = sIdx % cols;
      const sRow = Math.floor(sIdx / cols);
      const sx = f.ix + sCol * (cw + gx);
      const sy = bodyY + sRow * (ch + gy);
      let achDone = 0;
      for (let i = 0; i < ACHIEVEMENTS.length; i++) {
        if (ACHIEVEMENTS[i].check(saveData)) achDone++;
      }
      UI.drawKissaCard(c, sx, sy, cw, ch, { tone: 'amber', radius: 10 });
      UI.drawUiIcon(c, sprites, 'icon_trophy', sx + cw * 0.5, sy + 24, 22);
      UI.drawFitText(
        c,
        getChefRank(saveData),
        sx + cw * 0.5,
        sy + ch * 0.54,
        cw - 12,
        11.0,
        8.5,
        900,
        '#4A2C2A',
        'center',
        'middle'
      );
      UI.drawFitText(
        c,
        `荣誉勋章 ${achDone}/${ACHIEVEMENTS.length}`,
        sx + cw * 0.5,
        sy + ch * 0.78,
        cw - 12,
        9.4,
        7.8,
        800,
        '#7A4818',
        'center',
        'middle'
      );
    } finally {
      c.restore();
    }
    return;
  }

  // Adaptive 24+ Recipes Matrix (3 cols, zero-scroll on standard viewports, scrollable when expanded)
  const cols = 3;
  const rows = Math.max(1, Math.ceil(RECIPE_LIST.length / cols));
  const gx = 5;
  const gy = 4;
  const { ch, scrollY, maxScroll } = setupAdaptiveGridScroll(
    app,
    f.ix,
    f.iw,
    bodyY,
    bodyH,
    rows,
    gy,
    50
  );
  const cw = Math.floor((f.iw - (maxScroll > 0 ? 6 : 0) - gx * (cols - 1)) / cols);

  c.save();
  try {
    if (maxScroll > 0) {
      c.beginPath();
      c.rect(f.ix, bodyY, f.iw, bodyH);
      c.clip();
      c.translate(0, -scrollY);
    }

    for (let i = 0; i < RECIPE_LIST.length; i++) {
      const r = RECIPE_LIST[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = f.ix + col * (cw + gx);
      const cy = bodyY + row * (ch + gy);
      if (maxScroll > 0 && (cy + ch < bodyY + scrollY || cy > bodyY + scrollY + bodyH)) continue;

      const unlocked = isLevelUnlocked(r.unlockLevel, saveData.levelStars).unlocked;

      UI.drawKissaCard(c, cx, cy, cw, ch, {
        tone: unlocked ? 'cream' : 'soft',
        radius: 8
      });

      UI.drawFitText(
        c,
        r.name,
        cx + cw * 0.5,
        cy + 10,
        cw - 8,
        9.4,
        7.4,
        900,
        unlocked ? '#4A2C2A' : '#7D6A58',
        'center',
        'middle'
      );

      const slotCnt = r.slots.length;
      const iconS = Math.min(19, Math.max(14, ch - 30));
      const stepX = iconS + 4;
      const startX = cx + cw * 0.5 - ((slotCnt - 1) * stepX) * 0.5;
      const iconY = cy + ch * 0.52;

      for (let s = 0; s < slotCnt; s++) {
        const sl = r.slots[s];
        UI.drawCatcakeSprite(c, sprites, sl.tier, startX + s * stepX, iconY, iconS, {
          flavor: sl.flavor !== 'any' ? sl.flavor : 'plain',
          showFlavorBadge: sl.flavor !== 'any',
          alpha: unlocked ? 1 : 0.65
        });
      }

      UI.drawFitText(
        c,
        `×${r.comboMult.toFixed(2)} · ${r.baseScoreLv0}分`,
        cx + cw * 0.5,
        cy + ch - 8,
        cw - 6,
        8.4,
        6.8,
        800,
        '#884A18',
        'center',
        'middle'
      );
    }
  } finally {
    c.restore();
  }
}

function renderLeaderboardModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 640, 568, true);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const profile = (saveData && saveData.playerProfile) || {};

  drawModalHeader(c, f, sprites, 'icon_trophy', '星夜营业榜', '', 38);
  drawCloseButton(c, f, hits, app);

  // 1. Chef ID & Authorization Card
  const cardY = f.iy + 32;
  const cardH = 48;
  UI.drawKissaCard(c, f.ix, cardY, f.iw, cardH, { tone: 'cream', radius: 11 });

  const avPreset = normalizePatronId(profile.avatarPreset || saveData.selectedPatron);
  const avX = f.ix + 6;
  const avY = cardY + 5;
  const avS = 38;
  UI.drawPillButton(c, avX, avY, avS, avS, {
    style: 'card',
    icon: avPreset,
    sprites,
    iconSize: 28,
    radius: 10
  });
  hits.add('leaderboard_avatar_btn', avX, avY, avS, avS, () => app.cycleProfileAvatar());

  const authW = 92;
  const authH = 28;
  const authX = f.ix + f.iw - 8 - authW;
  const authY = Math.round(cardY + (cardH - authH) * 0.5);
  UI.drawPillButton(c, authX, authY, authW, authH, {
    style: profile.authorized ? 'equipped' : 'walnut',
    text: profile.authorized ? '已同步名片' : '授权头像昵称',
    fontSize: 9.6,
    radius: 9
  });
  app.userInfoBtnRect = { x: authX, y: authY, w: authW, h: authH };
  hits.add('leaderboard_auth_btn', authX, authY, authW, authH, () => app.onTapLeaderboardAuth());

  const infoX = avX + avS + 8;
  const infoW = Math.max(60, authX - 8 - infoX);
  const dispName = profile.nickName || '星夜店长';
  const syncLabel =
    app.cloudStatus === 'synced'
      ? '云端实时榜'
      : app.cloudStatus === 'syncing'
      ? '云端同步中'
      : '本地挑战榜';
  UI.drawFitText(c, dispName, infoX, cardY + 17, infoW, 11.8, 9.2, 900, '#4A2C2A', 'left', 'middle');
  UI.drawFitText(
    c,
    `${getChefRank(saveData)} · ${syncLabel}`,
    infoX,
    cardY + 34,
    infoW,
    9.5,
    7.8,
    700,
    '#7A5438',
    'left',
    'middle'
  );

  // 2. Dual Leaderboard Tabs
  const boardType = app.leaderboardBoardType === 'score' ? 'score' : 'stars';
  const tabY = cardY + cardH + 6;
  const tabH = 28;
  const tabGap = 6;
  const tabW = Math.floor((f.iw - tabGap) / 2);

  UI.drawPillButton(c, f.ix, tabY, tabW, tabH, {
    style: boardType === 'stars' ? 'active' : 'wood',
    icon: 'icon_stardust',
    sprites,
    iconSize: 16,
    text: '总星数进度榜',
    fontSize: 11.0,
    radius: 9
  });
  hits.add('leaderboard_tab_stars', f.ix, tabY, tabW, tabH, () =>
    app.setLeaderboardBoardType('stars')
  );

  UI.drawPillButton(c, f.ix + tabW + tabGap, tabY, tabW, tabH, {
    style: boardType === 'score' ? 'active' : 'wood',
    icon: 'icon_trophy',
    sprites,
    iconSize: 16,
    text: '累计营业榜',
    fontSize: 11.0,
    radius: 9
  });
  hits.add('leaderboard_tab_score', f.ix + tabW + tabGap, tabY, tabW, tabH, () =>
    app.setLeaderboardBoardType('score')
  );

  // 3. Top List + Pinned myRank Footer
  const footerH = 34;
  const footerY = f.iy + f.ih - footerH;
  const listY = tabY + tabH + 6;
  const listH = Math.max(120, footerY - 6 - listY);

  const lb = app.leaderboardData || { list: [], myRank: null };
  const rows = Array.isArray(lb.list) ? lb.list : [];
  const rowH = 38;
  const rowGap = 4;
  const contentH = Math.max(0, rows.length * (rowH + rowGap) - rowGap);
  const maxScroll = Math.max(0, contentH - listH);
  const scrollY = clamp(Number(app.modalScrollY) || 0, 0, maxScroll);
  app.modalMaxScroll = maxScroll;
  app.modalScrollRect = { x: f.ix, y: listY, w: f.iw, h: listH };

  c.save();
  try {
    c.beginPath();
    c.rect(f.ix, listY, f.iw, listH);
    c.clip();
    c.translate(0, -scrollY);

    if (rows.length === 0) {
      UI.drawFitText(
        c,
        app.leaderboardLoading ? '正在读取榜单数据...' : '暂无排行记录，通关后自动上榜',
        f.ix + f.iw * 0.5,
        listY + listH * 0.5,
        f.iw - 20,
        11.0,
        9.0,
        700,
        '#7A5438',
        'center',
        'middle'
      );
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ry = listY + i * (rowH + rowGap);
      if (ry + rowH < listY + scrollY || ry > listY + scrollY + listH) continue;

      const rank = r.rank || i + 1;
      UI.drawKissaCard(c, f.ix, ry, f.iw - (maxScroll > 0 ? 8 : 0), rowH, {
        tone: r.isMe ? 'selected' : rank <= 3 ? 'amber' : 'cream',
        radius: 9
      });

      if (rank <= 3) {
        UI.drawUiIcon(c, sprites, `icon_medal_${rank}`, f.ix + 18, ry + rowH * 0.5, 22);
      } else {
        UI.drawFitText(
          c,
          `#${rank}`,
          f.ix + 18,
          ry + rowH * 0.5,
          28,
          10.8,
          8.5,
          900,
          '#6E463B',
          'center',
          'middle'
        );
      }

      const rowAvatar = normalizePatronId(r.avatarPreset || 'mikan');
      UI.drawUiIcon(c, sprites, rowAvatar, f.ix + 46, ry + rowH * 0.5, 24);

      const rightColW = 122;
      const nameX = f.ix + 64;
      const nameW = Math.max(54, f.iw - rightColW - 72);
      const tagSuffix = r.isMe ? '（我）' : r.isNpc ? ' [陪练]' : '';
      UI.drawFitText(
        c,
        `${r.nickName || '星夜店长'}${tagSuffix}`,
        nameX,
        ry + rowH * 0.5,
        nameW,
        10.6,
        8.2,
        800,
        '#4A2C2A',
        'left',
        'middle'
      );

      const rStars = Math.max(0, Math.floor(Number(r.totalStars) || 0));
      const rScore = Math.max(0, Math.floor(Number(r.totalCumulativeScore) || 0));
      const rightEdge = f.ix + f.iw - (maxScroll > 0 ? 16 : 10);

      if (boardType === 'stars') {
        UI.drawStarIcon(c, rightEdge - 98, ry + rowH * 0.5, 5.4, true);
        UI.drawFitText(
          c,
          `${rStars} 星 (${rScore})`,
          rightEdge,
          ry + rowH * 0.5 + 0.5,
          90,
          10.2,
          8.0,
          900,
          '#5A341E',
          'right',
          'middle'
        );
      } else {
        UI.drawFitText(
          c,
          `${rScore} 分 (${rStars}星)`,
          rightEdge,
          ry + rowH * 0.5 + 0.5,
          114,
          10.2,
          8.0,
          900,
          '#5A341E',
          'right',
          'middle'
        );
      }
    }
  } finally {
    c.restore();
  }

  // Pinned myRank Footer
  const myStars = computeTotalStars(saveData.levelStars);
  const myScore =
    (saveData.lifetimeStats && saveData.lifetimeStats.totalCumulativeScore) || 0;
  UI.drawKissaCard(c, f.ix, footerY, f.iw, footerH, { tone: 'amber', radius: 9 });
  UI.drawFitText(
    c,
    `我的排名：${lb.myRank ? '第 ' + lb.myRank + ' 名' : '未上榜'}`,
    f.ix + 12,
    footerY + footerH * 0.5,
    f.iw * 0.52,
    10.8,
    8.5,
    900,
    '#4A2C2A',
    'left',
    'middle'
  );
  UI.drawStarIcon(c, f.ix + f.iw - 114, footerY + footerH * 0.5, 5.4, true);
  UI.drawFitText(
    c,
    `${myStars} 星 · ${myScore} 分`,
    f.ix + f.iw - 10,
    footerY + footerH * 0.5 + 0.5,
    98,
    10.2,
    8.0,
    800,
    '#5A341E',
    'right',
    'middle'
  );
}

function renderPauseModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 404, 348, false);
  const sprites = app.sprites || {};
  const orderState = app.orderState || {};
  const lvl = getLevelById(app.currentLevelId || orderState.levelId || '1-1') || getLevelById('1-1');

  drawModalHeader(c, f, sprites, 'icon_pause', '营业暂停', '', 38);
  drawCloseButton(c, f, hits, app);

  const infoY = f.iy + 34;
  const infoH = 44;
  UI.drawKissaCard(c, f.ix, infoY, f.iw, infoH, { tone: 'amber', radius: 10 });
  UI.drawFitText(
    c,
    `第 ${lvl.id} 关 · 剩余 ${formatClockMMSS(orderState.timeLeft || 0)} · 营业分 ${orderState.score || 0} / 1星 ${lvl.stars[0]}`,
    f.ix + f.iw * 0.5,
    infoY + infoH * 0.5,
    f.iw - 18,
    10.6,
    8.2,
    800,
    '#4A2C2A',
    'center',
    'middle'
  );

  const resumeY = infoY + infoH + 10;
  const resumeH = 42;
  UI.drawPillButton(c, f.ix, resumeY, f.iw, resumeH, {
    style: 'cta',
    icon: 'serve_bell',
    sprites,
    iconSize: 19,
    text: '继续营业',
    fontSize: 13.2,
    radius: 11
  });
  hits.add('pause_resume_btn', f.ix, resumeY, f.iw, resumeH, () => app.closeModal());

  const gapX = 8;
  const halfW = Math.floor((f.iw - gapX) / 2);
  const rowH = 38;

  const row1Y = resumeY + resumeH + 8;
  const trackInfo = app.audio && typeof app.audio.getTrackInfo === 'function'
    ? app.audio.getTrackInfo()
    : { label: '圆舞曲' };
  const sfxOn = app.audio ? Boolean(app.audio.sfxEnabled) : true;

  UI.drawPillButton(c, f.ix, row1Y, halfW, rowH, {
    style: 'wood',
    icon: 'icon_bgm',
    sprites,
    iconSize: 16,
    text: trackInfo.label || '音乐',
    fontSize: 10.8,
    radius: 10
  });
  hits.add('pause_bgm_btn', f.ix, row1Y, halfW, rowH, () => app.cycleBgm());

  UI.drawPillButton(c, f.ix + halfW + gapX, row1Y, halfW, rowH, {
    style: 'wood',
    icon: 'icon_sfx',
    sprites,
    iconSize: 16,
    text: sfxOn ? '音效: 开' : '音效: 关',
    fontSize: 10.8,
    radius: 10
  });
  hits.add('pause_sfx_btn', f.ix + halfW + gapX, row1Y, halfW, rowH, () => app.toggleSfx());

  const row2Y = row1Y + rowH + 8;
  UI.drawPillButton(c, f.ix, row2Y, halfW, rowH, {
    style: 'walnut',
    icon: 'icon_help',
    sprites,
    iconSize: 16,
    text: '玩法说明',
    fontSize: 10.8,
    radius: 10
  });
  hits.add('pause_help_btn', f.ix, row2Y, halfW, rowH, () => app.openModal('help'));

  UI.drawPillButton(c, f.ix + halfW + gapX, row2Y, halfW, rowH, {
    style: 'walnut',
    icon: 'icon_book',
    sprites,
    iconSize: 16,
    text: '猫饼图鉴',
    fontSize: 10.8,
    radius: 10
  });
  hits.add('pause_compendium_btn', f.ix + halfW + gapX, row2Y, halfW, rowH, () =>
    app.openCompendium('recipes')
  );

  const row3Y = row2Y + rowH + 8;
  UI.drawPillButton(c, f.ix, row3Y, halfW, rowH, {
    style: 'wood',
    icon: 'icon_restart',
    sprites,
    iconSize: 16,
    text: '重开本关',
    fontSize: 10.8,
    radius: 10
  });
  hits.add('pause_restart_btn', f.ix, row3Y, halfW, rowH, () =>
    app.startLevel(lvl.id)
  );

  UI.drawPillButton(c, f.ix + halfW + gapX, row3Y, halfW, rowH, {
    style: 'danger',
    icon: 'icon_home',
    sprites,
    iconSize: 16,
    text: '返回选关',
    fontSize: 10.8,
    radius: 10
  });
  hits.add('pause_lobby_btn', f.ix + halfW + gapX, row3Y, halfW, rowH, () =>
    app.onPauseReturnLobby()
  );
}

function renderHelpModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 540, 476, true);
  const sprites = app.sprites || {};

  drawModalHeader(c, f, sprites, 'icon_help', '营业指南 · 一起做猫饼', '异形烘焙合成与实时甜点上菜法则', 38);
  drawCloseButton(c, f, hits, app);

  const cards = [
    {
      icon: 'btn_knead',
      title: '1. 异形烤盘滑动与揉面补料',
      body: '上下左右滑动使全盘猫饼同步滑移，同阶相邻合成为高一阶猫饼（单步不连合）；点击底部【揉面补料】可随时在空格烘出新面团。'
    },
    {
      icon: 'serve_bell',
      title: '2. 单击装盘、厨余冷却与移位叉',
      body: '轻点亮暖金圈猫饼装进配餐托盘，凑齐需求即自动上菜！双击托盘槽位可丢入厨余篮（冷却 8 秒、断连击但 0 扣分）；移位叉可跨障挪移、互换或合并。'
    },
    {
      icon: 'icon_stardust',
      title: '3. 纯上菜唯一得分与连击热潮',
      body: '盘内滑动、合成、补料、厨具与技能均得 0 分，唯独完成顾客整单上菜结算营业分！8 秒内连续上菜享最高 1.28 倍连击与 1.25 倍星光热潮。'
    },
    {
      icon: 'tile_matcha',
      title: '4. 风味染色、镀金王牌与正交破冰',
      body: '停留在抹茶/草莓/镀金格自动染上风味（镀金永不降级且可万能顶替任意风味享 1.35 倍）；在冰封格正交相邻格合成或用移位叉点冰即可破冰！'
    }
  ];

  const bodyY = f.iy + 36;
  const bodyH = Math.max(220, f.iy + f.ih - bodyY);
  const gap = 7;
  const ch = Math.floor((bodyH - gap * (cards.length - 1)) / cards.length);

  for (let i = 0; i < cards.length; i++) {
    const it = cards[i];
    const cy = bodyY + i * (ch + gap);
    UI.drawKissaCard(c, f.ix, cy, f.iw, ch, { tone: i === 2 ? 'amber' : 'cream', radius: 10 });
    UI.drawUiIcon(c, sprites, it.icon, f.ix + 22, cy + ch * 0.5, 26);
    const tx = f.ix + 42;
    const tw = Math.max(80, f.iw - 52);
    UI.drawFitText(c, it.title, tx, cy + 16, tw, 11.2, 9.0, 900, '#4A2C2A', 'left', 'middle');
    UI.drawWrappedText(
      c,
      it.body,
      tx,
      cy + 30,
      tw,
      13.5,
      UI.fontStr(9.3, 700),
      '#6E463B',
      'left',
      4
    );
  }
}

function renderConfirmModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const f = renderModalFrame(c, metrics, app, 384, 224, false);
  const sprites = app.sprites || {};
  const cfg = app.confirmDialog || {
    title: '操作确认',
    message: '确认执行该操作吗？',
    confirmText: '确认',
    cancelText: '取消'
  };

  drawModalHeader(c, f, sprites, 'icon_warn', cfg.title || '操作确认', '', 38);
  drawCloseButton(c, f, hits, app, () => app.confirmCancel());

  UI.drawWrappedText(
    c,
    cfg.message || '确认放弃当前营业进度并返回选关大厅吗？',
    f.ix + 6,
    f.iy + 46,
    f.iw - 12,
    18,
    UI.fontStr(11.2, 700),
    '#5A3A28',
    'left',
    4
  );

  const btnH = 40;
  const btnY = f.iy + f.ih - btnH;
  const gap = 10;
  const bw = Math.floor((f.iw - gap) / 2);

  UI.drawPillButton(c, f.ix, btnY, bw, btnH, {
    style: 'wood',
    text: cfg.cancelText || '取消',
    fontSize: 12.0,
    radius: 10
  });
  hits.add('confirm_cancel', f.ix, btnY, bw, btnH, () => app.confirmCancel());

  UI.drawPillButton(c, f.ix + bw + gap, btnY, bw, btnH, {
    style: 'cta',
    text: cfg.confirmText || '确认',
    fontSize: 12.0,
    radius: 10
  });
  hits.add('confirm_accept', f.ix + bw + gap, btnY, bw, btnH, () => app.confirmAccept());
}

function renderActiveModal(ctx, metrics, app, hits, nowSec) {
  if (!app || !app.activeModal) {
    if (app) {
      app.activeModalFrame = null;
      app.modalScrollRect = null;
      app.modalMaxScroll = 0;
      app.userInfoBtnRect = null;
    }
    return;
  }

  // Crucial Iron Law: clear background screen hits so active modal has 0 pairwise overlaps
  if (hits && typeof hits.clear === 'function') {
    hits.clear();
  }
  app.userInfoBtnRect = null;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  switch (app.activeModal) {
    case 'level_preview':
      renderLevelPreviewModal(ctx, metrics, app, hits, nowSec);
      break;
    case 'level_result':
      renderLevelResultModal(ctx, metrics, app, hits);
      break;
    case 'shop':
      renderShopModal(ctx, metrics, app, hits);
      break;
    case 'compendium':
      renderCompendiumModal(ctx, metrics, app, hits);
      break;
    case 'leaderboard':
      renderLeaderboardModal(ctx, metrics, app, hits);
      break;
    case 'pause':
      renderPauseModal(ctx, metrics, app, hits);
      break;
    case 'help':
      renderHelpModal(ctx, metrics, app, hits);
      break;
    case 'confirm':
      renderConfirmModal(ctx, metrics, app, hits);
      break;
    default:
      app.activeModalFrame = null;
      break;
  }
}

function collectTutorialSpotlights(step, app, hits) {
  const rects = [];
  const gt = (app && app.guideTargets) || {};

  if (Array.isArray(step.spotlightCells) && gt.cells) {
    for (let i = 0; i < step.spotlightCells.length; i++) {
      const pos = step.spotlightCells[i];
      const cellRect = gt.cells[`${pos.r},${pos.c}`];
      if (cellRect) rects.push(cellRect);
    }
  } else if (step.spotlightCells === 'servable') {
    if (Array.isArray(gt.servableCells) && gt.servableCells.length > 0) {
      for (let i = 0; i < gt.servableCells.length; i++) rects.push(gt.servableCells[i]);
    } else if (gt.boardStage) {
      rects.push(gt.boardStage);
    }
  } else if (step.spotlightCells === 'frozen_and_orthogonal') {
    if (Array.isArray(gt.frozenAndOrthogonalCells) && gt.frozenAndOrthogonalCells.length > 0) {
      for (let i = 0; i < gt.frozenAndOrthogonalCells.length; i++) {
        rects.push(gt.frozenAndOrthogonalCells[i]);
      }
    } else if (gt.boardStage) {
      rects.push(gt.boardStage);
    }
  }

  if (Array.isArray(step.spotlightCellTypes) && gt.cellTypes) {
    for (let i = 0; i < step.spotlightCellTypes.length; i++) {
      const list = gt.cellTypes[step.spotlightCellTypes[i]];
      if (Array.isArray(list)) {
        for (let k = 0; k < list.length; k++) rects.push(list[k]);
      }
    }
  }

  if (Array.isArray(step.spotlightHitIds) && hits && Array.isArray(hits.items)) {
    for (let i = 0; i < step.spotlightHitIds.length; i++) {
      const targetId = step.spotlightHitIds[i];
      for (let k = 0; k < hits.items.length; k++) {
        const hItem = hits.items[k];
        if (hItem && hItem.id === targetId) {
          rects.push({ x: hItem.x, y: hItem.y, w: hItem.w, h: hItem.h });
        }
      }
    }
  }

  return rects;
}

function chooseGuideCardY(topBound, botBound, cardH, spotlights) {
  const candidates = [
    topBound + 8,
    botBound - cardH - 68,
    Math.round((topBound + botBound - cardH) * 0.5)
  ];
  let bestY = candidates[0];
  let bestOverlap = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const cy = clamp(candidates[i], topBound + 4, Math.max(topBound + 4, botBound - cardH - 4));
    let overlap = 0;
    for (let k = 0; k < spotlights.length; k++) {
      const sp = spotlights[k];
      const oy = Math.max(0, Math.min(cy + cardH + 6, sp.y + sp.h + 6) - Math.max(cy - 6, sp.y - 6));
      overlap += oy;
    }
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestY = cy;
    }
  }
  return bestY;
}

function renderTutorialOverlay(ctx, metrics, app, hits, nowSec) {
  if (!app || app.screen !== 'playing' || app.activeModal || !app.activeTutorialStep) {
    if (app) app.tutorialSkipRect = null;
    return;
  }

  const step = TUTORIAL_STEPS[app.activeTutorialStep];
  if (!step) {
    app.tutorialSkipRect = null;
    return;
  }

  const c = getSafeCtx(ctx);
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const width = Math.max(320, Number(m.width) || 390);
  const height = Math.max(480, Number(m.height) || 844);
  const safeTop = Math.max(0, Number(m.safeTop) || 0);
  const safeBottom = Math.max(0, Number(m.safeBottom) || 0);
  const mr =
    m.menuRect && typeof m.menuRect === 'object' && Number.isFinite(m.menuRect.bottom)
      ? m.menuRect
      : null;
  const topBound = mr ? Math.max(Math.round(mr.bottom) + 6, safeTop + 8) : Math.max(12, safeTop + 8);
  const botBound = height - Math.max(10, safeBottom + 8);

  const spotlights = collectTutorialSpotlights(step, app, hits);
  const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5.2);

  // Non-blocking even-odd spotlight cutout scrim
  c.save();
  try {
    c.beginPath();
    c.rect(0, 0, width, height);
    for (let i = 0; i < spotlights.length; i++) {
      const sp = spotlights[i];
      appendRoundRectSubpath(c, sp.x - 4, sp.y - 4, sp.w + 8, sp.h + 8, 10);
    }
    c.fillStyle = 'rgba(16, 9, 5, 0.44)';
    try {
      c.fill('evenodd');
    } catch (_) {
      // Fallback when evenodd rule unsupported: soft corner vignette only
    }

    for (let i = 0; i < spotlights.length; i++) {
      const sp = spotlights[i];
      c.strokeStyle = `rgba(255, 220, 102, ${(0.72 + 0.26 * pulse).toFixed(3)})`;
      c.lineWidth = 2.8;
      UI.roundRectPath(c, sp.x - 4, sp.y - 4, sp.w + 8, sp.h + 8, 10);
      c.stroke();
    }
  } finally {
    c.restore();
  }

  // Animated paw guide cue on primary spotlight
  if (spotlights.length > 0) {
    const p0 = spotlights[0];
    const isSlide = step.id === 'intro_slide_1';
    const dx = isSlide ? Math.sin(nowSec * 4.2) * 18 : 0;
    const dy = isSlide ? 0 : Math.sin(nowSec * 5.5) * 4;
    UI.drawUiIcon(
      c,
      app.sprites || {},
      'icon_paw_guide',
      p0.x + p0.w * 0.5 + dx,
      p0.y + p0.h * 0.5 + dy + 10,
      24
    );
  }

  // Floating non-blocking instruction card
  const cardW = Math.min(352, width - 24);
  const cardH = 82;
  const cardX = Math.round((width - cardW) * 0.5);
  const cardY = chooseGuideCardY(topBound, botBound, cardH, spotlights);

  UI.drawWoodBoard(c, cardX, cardY, cardW, cardH, 13, false);
  UI.drawParchmentSheet(c, cardX + 5, cardY + 5, cardW - 10, cardH - 10, 9);

  UI.drawTagBadge(c, cardX + 12, cardY + 11, 82, 18, step.tag || '新手引导', 'amber', 8.8);
  UI.drawFitText(
    c,
    step.title || '',
    cardX + 100,
    cardY + 20,
    cardW - 166,
    11.8,
    9.5,
    900,
    '#4A2C2A',
    'left',
    'middle'
  );

  const skipW = 50;
  const skipH = 22;
  const skipX = cardX + cardW - 12 - skipW;
  const skipY = cardY + 10;
  UI.drawPillButton(c, skipX, skipY, skipW, skipH, {
    style: 'card',
    text: '跳过',
    fontSize: 9.2,
    radius: 7
  });
  app.tutorialSkipRect = { x: skipX, y: skipY, w: skipW, h: skipH };

  UI.drawWrappedText(
    c,
    step.text || '',
    cardX + 14,
    cardY + 36,
    cardW - 28,
    15,
    UI.fontStr(10.0, 700),
    '#5A3A28',
    'left',
    2
  );
}

module.exports = {
  renderActiveModal,
  renderTutorialOverlay
};
