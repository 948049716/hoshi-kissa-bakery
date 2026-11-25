/**
 * Canvas 2D Storybook Interactive Modals & 6-Step Non-Blocking Spotlight Tutorial Overlay
 * for Hoshi Kissa Bakery v0.9.0 (WeChat Mini Game Edition).
 *
 * Strictly enforces:
 * - Zero HSL color strings (strictly hex/rgb/rgba for iOS WeChat Canvas safety)
 * - Zero native Unicode emoji / star / dingbat characters (100% WebP sprites & crisp vector icons)
 * - Immediate hits.clear() when activeModal !== null (zero background/backdrop hitbox overlap)
 * - Faithful reproduction of v0.9.0 Design Sheets 04–11 (wood plaque, awning, segmented bars,
 *   medals, switches, illustrated help cards, smooth pop-in & tab fade/slide transitions)
 * - Deterministic resting HitRegistry geometry on 375x667, 390x844, 1280x760 & Node stub-canvas
 */
'use strict';

const {
  CATCAKES,
  getCatcakePrice,
  SHOP_DEVICES,
  PATRONS,
  BOARD_THEME_LIST,
  SERVE_COMBO_MULTS,
  TUTORIAL_STEPS,
  ACHIEVEMENTS,
  normalizePatronId,
  getChefRank
} = require('./constants');
const {
  CHAPTERS,
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
  drawLockIcon,
  drawCircularWoodButton
} = require('./screens_ui');

function clamp(v, lo, hi) {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function easeOutBack(t) {
  const x = clamp(t, 0, 1);
  const c1 = 1.35;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function formatNum(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatClockMMSS(sec) {
  const s = Math.max(0, Math.ceil(Number(sec) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm < 10 ? '0' + mm : String(mm)}:${ss < 10 ? '0' + ss : String(ss)}`;
}

function getChapterName(chapterNum) {
  const found = CHAPTERS.find((ch) => ch.chapter === chapterNum);
  return found ? found.name : '街角星夜店';
}

function getSprite(sprites, key) {
  if (!sprites || !key) return null;
  if (sprites.byId && sprites.byId[key]) return sprites.byId[key];
  if (sprites.ui && sprites.ui[key]) return sprites.ui[key];
  if (sprites.patrons && sprites.patrons[key]) return sprites.patrons[key];
  if (sprites.tools && sprites.tools[key]) return sprites.tools[key];
  if (sprites.devices && sprites.devices[key]) return sprites.devices[key];
  if (sprites.tiles && sprites.tiles[key]) return sprites.tiles[key];
  if (sprites.customers && sprites.customers[key]) return sprites.customers[key];
  return null;
}

function isPressed(app, hitId) {
  return Boolean(app && app.uiAnim && app.uiAnim.pressedHitId === hitId);
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

function getModalAnim(app) {
  const uiAnim = (app && app.uiAnim) || null;
  const openT = uiAnim && Number.isFinite(uiAnim.modalOpenTimer) ? clamp(uiAnim.modalOpenTimer, 0, 1) : 1;
  const tabT = uiAnim && Number.isFinite(uiAnim.tabSwitchTimer) ? clamp(uiAnim.tabSwitchTimer, 0, 1) : 1;
  return {
    openT,
    scale: openT >= 0.999 ? 1 : 0.93 + 0.07 * easeOutBack(openT),
    scrimAlpha: openT >= 0.999 ? 1 : 0.35 + 0.65 * easeOutCubic(openT),
    tabAlpha: tabT >= 0.999 ? 1 : 0.45 + 0.55 * easeOutCubic(tabT),
    tabOffsetY: tabT >= 0.999 ? 0 : Math.round((1 - easeOutCubic(tabT)) * 5)
  };
}

/**
 * Draws the shared v0.9.0 modal backdrop + spring-animated wood/parchment frame,
 * optional red-cream scalloped awning (Design 06 & 09), floating wooden title plaque,
 * optional dark espresso subtitle plate (Design 04 & 10), and overlapping circular close button.
 *
 * All layout coordinates and HitRegistry registrations remain at deterministic resting positions
 * while the visual canvas transform handles smooth spring scale pop-in!
 */
function beginModalFrame(ctx, metrics, app, opts = {}) {
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

  const topBound = mr ? Math.max(Math.round(mr.bottom) + 8, safeTop + 10) : Math.max(14, safeTop + 10);
  const botBound = height - Math.max(12, safeBottom + 10);
  const anim = getModalAnim(app);

  // Full-screen warm night scrim with smooth fade-in
  c.save();
  try {
    c.fillStyle = `rgba(18, 22, 42, ${(0.66 * anim.scrimAlpha).toFixed(3)})`;
    c.fillRect(0, 0, width, height);
  } finally {
    c.restore();
  }

  const maxW = Number(opts.maxW) || 440;
  const desiredH = Number(opts.desiredH) || 520;
  const extraTopHeadroom = Number(opts.extraTopHeadroom) || 14;
  const hasAwning = Boolean(opts.awning);
  const hasPlaque = opts.plaque !== false;
  const title = String(opts.title || '');
  const subtitle = String(opts.subtitle || '');

  const w = Math.min(maxW, width - 22);
  const availH = Math.max(220, botBound - topBound - extraTopHeadroom);
  const h = Math.min(desiredH, availH);
  const x = Math.round((width - w) * 0.5);
  const y = Math.round(topBound + extraTopHeadroom + (availH - h) * 0.5);

  app.activeModalFrame = {
    x,
    y,
    w,
    h,
    dismissOnOutside: Boolean(opts.dismissOnOutside)
  };

  // Start modal visual transform scope (closed via endModalFrame)
  c.save();
  if (anim.scale !== 1) {
    const cx = x + w * 0.5;
    const cy = y + h * 0.5;
    c.translate(cx, cy);
    c.scale(anim.scale, anim.scale);
    c.translate(-cx, -cy);
  }

  // Outer warm wood frame
  UI.drawWoodBoard(c, x, y, w, h, 18, Boolean(opts.withRivets));

  // Inner cream parchment sheet
  const padX = 9;
  const awningH = hasAwning ? Math.min(38, Math.max(28, Math.round(h * 0.068))) : 0;
  const awningDrop = hasAwning ? awningH - 4 : 0;
  const topInset = Number(opts.sheetTopInset);
  const sheetTop = Number.isFinite(topInset)
    ? y + topInset
    : y + (hasAwning ? awningH - 6 : subtitle ? 44 : 16);
  const sheetBotPad = Number.isFinite(opts.sheetBottomPad) ? opts.sheetBottomPad : 11;
  const sheetX = x + padX;
  const sheetW = w - padX * 2;
  const sheetH = Math.max(120, y + h - sheetBotPad - sheetTop);

  if (opts.drawParchment !== false) {
    UI.drawParchmentSheet(c, sheetX, sheetTop, sheetW, sheetH, 12);
    // Subtle storybook bottom-right parchment corner curl accent
    c.save();
    try {
      const curl = 14;
      const cx0 = sheetX + sheetW - curl;
      const cy0 = sheetTop + sheetH - curl;
      c.beginPath();
      c.moveTo(cx0, sheetTop + sheetH);
      c.quadraticCurveTo(cx0 + 3, cy0 + 3, sheetX + sheetW, cy0);
      c.lineTo(sheetX + sheetW, sheetTop + sheetH - 4);
      c.quadraticCurveTo(sheetX + sheetW, sheetTop + sheetH, sheetX + sheetW - 4, sheetTop + sheetH);
      c.closePath();
      c.fillStyle = 'rgba(138, 86, 52, 0.16)';
      c.fill();
    } finally {
      c.restore();
    }
  }

  // Red/cream scalloped awning draped cleanly OVER the parchment top edge (Designs 06 & 09)
  if (hasAwning) {
    UI.drawAwningHeader(c, x - 3, y + 1, w + 6, awningH, 11);
  }

  // Floating centered arched wooden title plaque (Designs 04, 06, 07, 08, 09, 10, 11)
  if (hasPlaque && title) {
    const plaqueW = Math.min(w - 66, Math.max(158, Math.round(w * 0.56)));
    const plaqueH = 40;
    const plaqueX = Math.round(x + (w - plaqueW) * 0.5);
    const plaqueY = Math.max(topBound + 1, y - 16);

    if (subtitle) {
      const subW = Math.min(w - 48, plaqueW + 10);
      const subH = 22;
      const subX = Math.round(x + (w - subW) * 0.5);
      const subY = plaqueY + plaqueH - 6;
      UI.drawKissaCard(c, subX, subY, subW, subH, {
        tone: 'wood',
        topCol: '#6B4229',
        botCol: '#52301C',
        borderColor: '#4A2B1A',
        radius: 9,
        lineWidth: 2.2
      });
      UI.drawOutlinedText(c, subtitle, subX + subW * 0.5, subY + subH * 0.5 + 1.5, {
        size: 11.2,
        minSize: 8.8,
        weight: 800,
        fill: '#FFF3DC',
        stroke: '#3D2214',
        strokeWidth: 2.2,
        shadowOffsetY: 0,
        maxWidth: subW - 14
      });
    }

    // Arched wooden signboard silhouette
    c.save();
    try {
      const pr = 12;
      const arch = 6.5;
      c.shadowColor = 'rgba(26, 14, 8, 0.34)';
      c.shadowBlur = 8;
      c.shadowOffsetY = 3;

      const traceArchPlaque = (px, py, pw, ph, rad, archLift) => {
        c.beginPath();
        c.moveTo(px + rad, py);
        c.quadraticCurveTo(px + pw * 0.5, py - archLift * 2, px + pw - rad, py);
        c.quadraticCurveTo(px + pw, py, px + pw, py + rad);
        c.lineTo(px + pw, py + ph - rad);
        c.quadraticCurveTo(px + pw, py + ph, px + pw - rad, py + ph);
        c.lineTo(px + rad, py + ph);
        c.quadraticCurveTo(px, py + ph, px, py + ph - rad);
        c.lineTo(px, py + rad);
        c.quadraticCurveTo(px, py, px + rad, py);
        c.closePath();
      };

      const pg = c.createLinearGradient(plaqueX, plaqueY - arch, plaqueX, plaqueY + plaqueH);
      pg.addColorStop(0, '#9A6340');
      pg.addColorStop(0.24, '#7E4D30');
      pg.addColorStop(1, '#5D3620');
      traceArchPlaque(plaqueX, plaqueY, plaqueW, plaqueH, pr, arch);
      c.fillStyle = pg;
      c.fill();

      c.shadowColor = 'rgba(0, 0, 0, 0)';
      c.shadowBlur = 0;
      c.shadowOffsetY = 0;

      // Woodgrain streaks inside plaque
      c.save();
      try {
        traceArchPlaque(plaqueX + 2, plaqueY + 2, plaqueW - 4, plaqueH - 4, pr - 2, Math.max(2, arch - 1.5));
        if (typeof c.clip === 'function') c.clip();
        c.strokeStyle = 'rgba(56, 28, 14, 0.22)';
        c.lineWidth = 1.2;
        for (let gy = plaqueY + 8; gy < plaqueY + plaqueH - 4; gy += 9) {
          c.beginPath();
          c.moveTo(plaqueX + 4, gy);
          c.lineTo(plaqueX + plaqueW - 4, gy);
          c.stroke();
        }
      } finally {
        c.restore();
      }

      // Inner warm highlight rim + crisp dark-brown outer stroke
      traceArchPlaque(plaqueX + 2.5, plaqueY + 2.5, plaqueW - 5, plaqueH - 5, pr - 2.5, Math.max(2, arch - 2));
      c.lineWidth = 1.3;
      c.strokeStyle = 'rgba(255, 232, 196, 0.32)';
      c.stroke();

      traceArchPlaque(plaqueX, plaqueY, plaqueW, plaqueH, pr, arch);
      c.lineWidth = 2.8;
      c.strokeStyle = '#4A2B1A';
      c.stroke();
    } finally {
      c.restore();
    }

    UI.drawOutlinedText(c, title, plaqueX + plaqueW * 0.5, plaqueY + plaqueH * 0.48, {
      size: 20,
      minSize: 14,
      weight: 900,
      fill: '#FFE77A',
      stroke: '#4A230D',
      strokeWidth: 4.0,
      shadowOffsetY: 1.4,
      maxWidth: plaqueW - 22
    });
  }

  // Safe inner content area
  const ix = sheetX + 10;
  const iw = sheetW - 20;
  const iy = sheetTop + (hasPlaque && !hasAwning && !subtitle ? 22 : subtitle ? 18 : 10);
  const ih = Math.max(100, sheetTop + sheetH - 10 - iy);

  return {
    width,
    height,
    cardX: x,
    cardY: y,
    cardW: w,
    cardH: h,
    sheetX,
    sheetY: sheetTop,
    sheetW,
    sheetH,
    ix,
    iy,
    iw,
    ih,
    topBound,
    botBound,
    awningDrop,
    anim
  };
}

function endModalFrame(ctx) {
  const c = getSafeCtx(ctx);
  c.restore();
}

function drawCloseButton(ctx, f, hits, app, onCloseOverride = null) {
  const c = getSafeCtx(ctx);
  const sz = 34;
  const r = sz * 0.5;
  const bx = Math.min(f.width - sz - 4, Math.round(f.cardX + f.cardW - sz * 0.72));
  const by = Math.max(f.topBound + 2, Math.round(f.cardY - 10));
  drawCircularWoodButton(c, bx + r, by + r, r, {
    icon: 'icon_close',
    sprites: app.sprites || {},
    iconSize: 16,
    pressed: isPressed(app, 'modal_close')
  });
  hits.add('modal_close', bx, by, sz, sz, () => {
    if (typeof onCloseOverride === 'function') onCloseOverride();
    else app.closeModal();
  });
}

function drawSectionRibbonTag(ctx, x, y, text) {
  const c = getSafeCtx(ctx);
  const w = Math.max(66, text.length * 14 + 18);
  const h = 21;
  UI.drawTagBadge(c, x, y, w, h, text, 'wood', 10.6);
  return { w, h };
}

function drawFolderTabs(ctx, x, y, w, h, tabs, activeId, hits, app, onSelect, opts = {}) {
  const c = getSafeCtx(ctx);
  const gap = Number(opts.gap) || 5;
  const count = tabs.length;
  const tabW = Math.floor((w - gap * (count - 1)) / Math.max(1, count));

  for (let i = 0; i < count; i++) {
    const t = tabs[i];
    const tx = x + i * (tabW + gap);
    const active = activeId === t.id;
    const hitId = t.hitId || `tab_${t.id}`;
    const pressed = isPressed(app, hitId);
    const dy = pressed ? 1.5 : 0;

    c.save();
    try {
      const r = 10;
      const th = active ? h + 3 : h;
      const ty = (active ? y - 2 : y + 1) + dy;
      c.beginPath();
      c.moveTo(tx + r, ty);
      c.lineTo(tx + tabW - r, ty);
      c.quadraticCurveTo(tx + tabW, ty, tx + tabW, ty + r);
      c.lineTo(tx + tabW, ty + th);
      c.lineTo(tx, ty + th);
      c.lineTo(tx, ty + r);
      c.quadraticCurveTo(tx, ty, tx + r, ty);
      c.closePath();

      const g = c.createLinearGradient(tx, ty, tx, ty + th);
      if (active) {
        g.addColorStop(0, '#FFE382');
        g.addColorStop(1, '#F5B332');
      } else {
        g.addColorStop(0, '#A86E44');
        g.addColorStop(1, '#7A4C2E');
      }
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 2.2;
      c.strokeStyle = '#5A3928';
      c.stroke();

      UI.drawOutlinedText(c, t.label, tx + tabW * 0.5, ty + th * 0.52, {
        size: Number(opts.fontSize) || (count >= 4 ? 11.4 : 12.6),
        minSize: 8.6,
        weight: 800,
        fill: active ? '#5A3928' : '#FFF4E0',
        stroke: active ? '' : '#4A2B1A',
        strokeWidth: active ? 0 : 2.2,
        shadowOffsetY: 0,
        maxWidth: tabW - 8
      });

      if (t.redDot) {
        drawRedDot(c, tx + tabW - 7, ty + 7, 4.3);
      }
    } finally {
      c.restore();
    }

    const idCopy = t.id;
    hits.add(hitId, tx, y, tabW, h, () => onSelect(idCopy));
  }
}

/* ======================== 04. 关卡备战弹窗 (LevelPreviewModal) ======================== */

function renderLevelPreviewModal(ctx, metrics, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const lvl =
    getLevelById(app.previewLevelId || saveData.highestUnlockedLevel || '1-1') ||
    getLevelById('1-1');
  const chapName = getChapterName(lvl.chapter);

  const f = beginModalFrame(c, metrics, app, {
    maxW: 430,
    desiredH: 540,
    dismissOnOutside: true,
    title: '关卡备战',
    subtitle: `第 ${lvl.id} 关 · ${chapName}`,
    sheetTopInset: 38,
    sheetBottomPad: 12
  });

  try {
    drawCloseButton(c, f, hits, app);

    const compact = f.ih < 410;
    const ctaH = compact ? 42 : 48;
    const ctaY = f.iy + f.ih - ctaH;
    const gap = compact ? 7 : 10;

    // --- Section 1: 1/2/3 Star Target Box + Top-Right Time Pill (Design 04) ---
    const starBoxY = f.iy + 8;
    const starBoxH = compact ? 76 : 90;
    UI.drawKissaCard(c, f.ix, starBoxY, f.iw, starBoxH, {
      tone: 'recess',
      borderColor: '#C5A982',
      radius: 12,
      lineWidth: 1.8
    });

    const colW = (f.iw - 14) / 3;
    const starLabels = ['1星', '2星', '3星'];
    for (let s = 0; s < 3; s++) {
      const colX = f.ix + 7 + s * colW;
      const cx = colX + colW * 0.5;
      if (s > 0) {
        c.save();
        try {
          c.strokeStyle = 'rgba(138, 86, 52, 0.24)';
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(colX, starBoxY + 14);
          c.lineTo(colX, starBoxY + starBoxH - 18);
          c.stroke();
        } finally {
          c.restore();
        }
      }

      UI.drawOutlinedText(c, starLabels[s], cx, starBoxY + 15, {
        size: 12.2,
        minSize: 9.5,
        weight: 800,
        fill: '#FFE27D',
        stroke: '#5A3928',
        strokeWidth: 2.8,
        shadowOffsetY: 0
      });

      const starSz = compact ? 13 : 15;
      const starGap = starSz * 0.92;
      const startStarX = cx - (s * starGap) * 0.5;
      for (let k = 0; k <= s; k++) {
        UI.drawStarIcon(c, startStarX + k * starGap, starBoxY + (compact ? 35 : 39), starSz * 0.48, true, sprites);
      }

      const scoreText = formatNum(lvl.stars[s]);
      UI.drawStarIcon(c, cx - 22, starBoxY + (compact ? 56 : 63), 5.6, true, sprites);
      UI.drawFitText(
        c,
        scoreText,
        cx - 12,
        starBoxY + (compact ? 56.5 : 63.5),
        colW - 22,
        compact ? 12.2 : 13.4,
        9.2,
        900,
        '#5A3928',
        'left',
        'middle'
      );
    }

    // Best score subtle footer inside bottom of star card
    const bestScore = (saveData.levelBestScores && saveData.levelBestScores[lvl.id]) || 0;
    const prevStars = (saveData.levelStars && saveData.levelStars[lvl.id]) || 0;
    if (!compact) {
      UI.drawFitText(
        c,
        bestScore > 0 ? `历史最佳：${formatNum(bestScore)} 分（${prevStars}星）` : `关卡名称：${lvl.name}`,
        f.ix + f.iw * 0.5,
        starBoxY + starBoxH - 9,
        f.iw - 20,
        9.4,
        7.8,
        700,
        '#8A5A32',
        'center',
        'middle'
      );
    }

    // Top-right overlapping wood time badge ("限时 01:30")
    const timeBadgeW = 54;
    const timeBadgeH = 32;
    const timeBadgeX = f.ix + f.iw - timeBadgeW + 6;
    const timeBadgeY = starBoxY - 17;
    UI.drawKissaCard(c, timeBadgeX, timeBadgeY, timeBadgeW, timeBadgeH, {
      tone: 'wood',
      topCol: '#9B653E',
      botCol: '#73482B',
      borderColor: '#5A3928',
      radius: 9,
      lineWidth: 2.2
    });
    UI.drawOutlinedText(c, '限时', timeBadgeX + timeBadgeW * 0.5, timeBadgeY + 10, {
      size: 9.4,
      weight: 800,
      fill: '#FFE27D',
      stroke: '#4A2B1A',
      strokeWidth: 2.0,
      shadowOffsetY: 0
    });
    UI.drawOutlinedText(c, formatClockMMSS(lvl.durationSec), timeBadgeX + timeBadgeW * 0.5, timeBadgeY + 23, {
      size: 11.0,
      minSize: 8.8,
      weight: 900,
      fill: '#FFF8EC',
      stroke: '#4A2B1A',
      strokeWidth: 2.2,
      shadowOffsetY: 0,
      maxWidth: timeBadgeW - 6
    });

    // --- Section 2: 本关特色 (Feature Tiles + Mini Board Preview) ---
    const featY = starBoxY + starBoxH + gap + 6;
    const featH = compact ? 92 : 112;
    UI.drawKissaCard(c, f.ix, featY, f.iw, featH, {
      tone: 'recess',
      topCol: '#FBF1DD',
      botCol: '#F3E3C4',
      borderColor: '#D6BE99',
      radius: 12,
      lineWidth: 1.6
    });
    drawSectionRibbonTag(c, f.ix + 8, featY - 10, '本关特色');

    const matJoined = Array.isArray(lvl.matrix) ? lvl.matrix.join('') : '';
    const featureItems = [];
    if (matJoined.includes('X')) featureItems.push({ icon: 'tile_obstacle', label: '障碍格' });
    if (matJoined.includes('I')) featureItems.push({ icon: 'tile_ice', label: '冰封格' });
    if (matJoined.includes('M')) featureItems.push({ icon: 'flavor_matcha', label: '抹茶格' });
    if (matJoined.includes('B')) featureItems.push({ icon: 'flavor_berry', label: '草莓格' });
    if (matJoined.includes('G')) featureItems.push({ icon: 'flavor_gold', label: '镀金格' });
    if ((lvl.vipQuota || 0) > 0) featureItems.push({ icon: 'cust_vip_cat', label: `VIP×${lvl.vipQuota}` });
    if ((lvl.urgentRate || 0) > 0 && featureItems.length < 3) {
      featureItems.push({ icon: 'icon_urgent_flame', label: '急单热潮' });
    }
    // Always fill up to 3 rich cards (including board miniature when fewer special features exist)
    const showMiniBoard = featureItems.length < 3;
    const displayCards = featureItems.slice(0, showMiniBoard ? 2 : 3);
    if (showMiniBoard) {
      displayCards.unshift({ kind: 'mini_board', label: '异形烤盘' });
    }
    if (displayCards.length < 3) {
      let maxTier = 2;
      for (let i = 0; i < lvl.allowedRecipes.length; i++) {
        const rec = RECIPES[lvl.allowedRecipes[i]];
        if (rec && Array.isArray(rec.slots)) {
          for (let k = 0; k < rec.slots.length; k++) {
            if (rec.slots[k].tier > maxTier) maxTier = rec.slots[k].tier;
          }
        }
      }
      displayCards.push({ icon: `C${maxTier}`, label: `最高C${maxTier}猫饼` });
    }

    const tileCount = displayCards.length;
    const tileGap = 10;
    const tileSize = Math.min(compact ? 52 : 64, Math.floor((f.iw - 28 - tileGap * (tileCount - 1)) / tileCount));
    const totalRowW = tileCount * tileSize + (tileCount - 1) * tileGap;
    const rowStartX = Math.round(f.ix + (f.iw - totalRowW) * 0.5);
    const tileTopY = featY + (compact ? 16 : 20);

    for (let i = 0; i < tileCount; i++) {
      const it = displayCards[i];
      const tx = rowStartX + i * (tileSize + tileGap);
      UI.drawKissaCard(c, tx, tileTopY, tileSize, tileSize, {
        tone: 'cream',
        borderColor: '#5A3928',
        radius: 12,
        lineWidth: 2.2
      });

      if (it.kind === 'mini_board') {
        BoardRenderer.renderBoardStage(
          c,
          { x: tx + 4, y: tileTopY + 4, w: tileSize - 8, h: tileSize - 8 },
          lvl,
          null,
          app.equippedTheme,
          sprites,
          null,
          nowSec,
          { thumbnail: true, minCellSize: 8, maxCellSize: 16 }
        );
      } else {
        UI.drawUiIcon(c, sprites, it.icon, tx + tileSize * 0.5, tileTopY + tileSize * 0.5, tileSize * 0.72);
      }

      UI.drawFitText(
        c,
        it.label,
        tx + tileSize * 0.5,
        tileTopY + tileSize + (compact ? 12 : 14),
        tileSize + 14,
        compact ? 10.2 : 11.4,
        8.2,
        800,
        '#5A3928',
        'center',
        'middle'
      );
    }

    // --- Section 3: 出战配置 (Selectable 3 Patrons + Starting Tools Preview) ---
    const cfgY = featY + featH + gap + 6;
    const cfgH = Math.max(96, ctaY - gap - cfgY);
    UI.drawKissaCard(c, f.ix, cfgY, f.iw, cfgH, {
      tone: 'recess',
      topCol: '#FBF1DD',
      botCol: '#F3E3C4',
      borderColor: '#D6BE99',
      radius: 12,
      lineWidth: 1.6
    });
    drawSectionRibbonTag(c, f.ix + 8, cfgY - 10, '出战配置');

    const selectedPatronId = normalizePatronId(saveData.selectedPatron);
    const unlockedPatrons = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];

    const toolsRowH = compact ? 24 : 28;
    const patCardY = cfgY + 14;
    const patCardH = Math.max(52, cfgH - 14 - toolsRowH - 10);
    const patGap = 6;
    const patW = Math.floor((f.iw - 16 - patGap * 2) / 3);

    for (let i = 0; i < PATRONS.length; i++) {
      const p = PATRONS[i];
      const px = f.ix + 8 + i * (patW + patGap);
      const owned = unlockedPatrons.includes(p.id);
      const active = selectedPatronId === p.id;

      UI.drawKissaCard(c, px, patCardY, patW, patCardH, {
        tone: active ? 'selected' : owned ? 'cream' : 'soft',
        selected: active,
        locked: !owned,
        radius: 10
      });

      const avSz = Math.min(54, Math.max(36, Math.round(patCardH * 0.56)));
      UI.drawUiIcon(c, sprites, p.id, px + patW * 0.5, patCardY + (patCardH - 28) * 0.5 + 3, avSz, owned ? 1 : 0.45);
      if (!owned) {
        drawLockIcon(c, px + patW - 12, patCardY + 12, 11, { sprites });
      }

      UI.drawFitText(
        c,
        p.name,
        px + patW * 0.5,
        patCardY + patCardH - (compact ? 19 : 21),
        patW - 8,
        10.8,
        8.2,
        900,
        owned ? '#5A3928' : '#7D6E62',
        'center',
        'middle'
      );
      UI.drawFitText(
        c,
        !owned ? `${p.cost}星解锁` : active ? p.skillName : '点击出战',
        px + patW * 0.5,
        patCardY + patCardH - 8,
        patW - 8,
        8.8,
        7.2,
        700,
        active ? '#B85A08' : '#754C36',
        'center',
        'middle'
      );

      const pidCopy = p.id;
      hits.add(`preview_patron_${pidCopy}`, px, patCardY, patW, patCardH, () =>
        app.selectPatronInPreview(pidCopy)
      );
    }

    // Starting tools strip inside 出战配置 (移位叉×N + 升阶勺×M)
    const devToolsLv = clamp(
      Math.floor(Number(saveData.deviceUpgrades && saveData.deviceUpgrades.dev_tools) || 0),
      0,
      3
    );
    const startTools = (SHOP_DEVICES[3] && SHOP_DEVICES[3].startTools && SHOP_DEVICES[3].startTools[devToolsLv]) || {
      fork: 1,
      spoon: 0
    };
    const tStripY = patCardY + patCardH + 5;
    const tHalfW = Math.floor((f.iw - 22) / 2);

    // Fork pill
    UI.drawKissaCard(c, f.ix + 8, tStripY, tHalfW, toolsRowH, {
      tone: 'cream',
      borderColor: '#9E7958',
      radius: 8,
      lineWidth: 1.5
    });
    UI.drawUiIcon(c, sprites, 'tool_fork', f.ix + 21, tStripY + toolsRowH * 0.5, toolsRowH - 6);
    UI.drawFitText(
      c,
      `移位叉 ×${startTools.fork}`,
      f.ix + 34,
      tStripY + toolsRowH * 0.5 + 0.5,
      tHalfW - 30,
      10.4,
      8.2,
      800,
      '#5A3928',
      'left',
      'middle'
    );

    // Spoon pill
    const spX = f.ix + 8 + tHalfW + 6;
    UI.drawKissaCard(c, spX, tStripY, tHalfW, toolsRowH, {
      tone: 'cream',
      borderColor: '#9E7958',
      radius: 8,
      lineWidth: 1.5
    });
    UI.drawUiIcon(c, sprites, 'tool_spoon', spX + 13, tStripY + toolsRowH * 0.5, toolsRowH - 6);
    UI.drawFitText(
      c,
      `升阶勺 ×${startTools.spoon}`,
      spX + 26,
      tStripY + toolsRowH * 0.5 + 0.5,
      tHalfW - 30,
      10.4,
      8.2,
      800,
      '#5A3928',
      'left',
      'middle'
    );

    // --- Footer Primary 3D CTA Button ("开始营业") ---
    const ctaW = Math.min(246, f.iw - 12);
    const ctaX = Math.round(f.ix + (f.iw - ctaW) * 0.5);
    UI.drawPillButton(c, ctaX, ctaY, ctaW, ctaH, {
      variant: 'primary',
      label: '开始营业',
      fontSize: 18,
      radius: ctaH * 0.5,
      pressed: isPressed(app, 'preview_start_btn')
    });
    const startId = lvl.id;
    hits.add('preview_start_btn', ctaX, ctaY, ctaW, ctaH, () => app.startLevel(startId));
  } finally {
    endModalFrame(c);
  }
}

/* ======================== 05. 关卡结算弹窗 (LevelResultModal) ======================== */

function drawSparkleStar(ctx, cx, cy, size, alpha = 1) {
  ctx.save();
  try {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#FFFDF5';
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.quadraticCurveTo(cx + size * 0.22, cy - size * 0.22, cx + size, cy);
    ctx.quadraticCurveTo(cx + size * 0.22, cy + size * 0.22, cx, cy + size);
    ctx.quadraticCurveTo(cx - size * 0.22, cy + size * 0.22, cx - size, cy);
    ctx.quadraticCurveTo(cx - size * 0.22, cy - size * 0.22, cx, cy - size);
    ctx.closePath();
    ctx.fill();
  } finally {
    ctx.restore();
  }
}

function renderLevelResultModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
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
  const lvl = getLevelById(res.levelId || '1-1') || getLevelById('1-1');
  const chapName = getChapterName(lvl.chapter);

  const f = beginModalFrame(c, metrics, app, {
    maxW: 420,
    desiredH: 520,
    extraTopHeadroom: 32,
    dismissOnOutside: false,
    plaque: false,
    withRivets: false,
    sheetTopInset: 36,
    sheetBottomPad: 86
  });

  try {
    // 1. Arching 3 Large Stars above top border with staggered pop animation (Design 05)
    const revealT = Number.isFinite(res.elapsedRevealSec) ? res.elapsedRevealSec : 1.0;
    const starConfigs = [
      { idx: 1, dx: -60, dy: -7, r: 26, rot: -0.18 },
      { idx: 2, dx: 0, dy: -20, r: 32, rot: 0 },
      { idx: 3, dx: 60, dy: -7, r: 26, rot: 0.18 }
    ];
    for (let i = 0; i < starConfigs.length; i++) {
      const sc = starConfigs[i];
      const earned = sc.idx <= (res.starsEarned || 0);
      const localT = clamp((revealT - (sc.idx - 1) * 0.16) / 0.24, 0, 1);
      const pop = earned ? (localT < 1 ? 0.35 + 0.65 * easeOutBack(localT) : 1) : 0.9;
      const sx = f.cardX + f.cardW * 0.5 + sc.dx;
      const sy = f.cardY + sc.dy;
      c.save();
      try {
        c.translate(sx, sy);
        c.rotate(sc.rot);
        UI.drawStarIcon(c, 0, 0, sc.r * pop, earned && localT > 0.05, sprites);
      } finally {
        c.restore();
      }
      if (earned && localT > 0.5) {
        drawSparkleStar(c, sx + sc.r * 0.72, sy - sc.r * 0.55, 5.5, 0.9);
      }
    }

    // Decorative wooden corner paw-print stamps (Design 05)
    UI.drawUiIcon(c, sprites, 'icon_paw_marker', f.cardX + 20, f.cardY + 18, 16, 0.38);
    UI.drawUiIcon(c, sprites, 'icon_paw_marker', f.cardX + f.cardW - 20, f.cardY + 18, 16, 0.38);

    // 2. Festive Ribbon Banner across top ("营业大成功！" / "顺利过关！" / "继续加油！")
    const ribW = Math.min(f.cardW + 18, f.width - 14);
    const ribH = 62;
    const ribX = Math.round(f.cardX + (f.cardW - ribW) * 0.5);
    const ribY = f.cardY + 1;
    const ribImg = getSprite(sprites, 'result_ribbon');
    if (ribImg) {
      UI.drawContainImage(c, ribImg, ribX + ribW * 0.5, ribY + ribH * 0.5, ribW, ribH);
    } else {
      UI.drawKissaCard(c, ribX + 16, ribY + 8, ribW - 32, 42, {
        tone: 'wood',
        topCol: '#E66844',
        botCol: '#C5462B',
        borderColor: '#5A3928',
        radius: 12
      });
    }

    const ribbonTitle =
      (res.starsEarned || 0) >= 3
        ? '营业大成功！'
        : res.cleared
        ? '顺利过关！'
        : '继续加油！';
    UI.drawOutlinedText(c, ribbonTitle, f.cardX + f.cardW * 0.5, ribY + ribH * 0.45, {
      size: 23,
      minSize: 16,
      weight: 900,
      fill: '#FFF4C8',
      stroke: '#5A3928',
      strokeWidth: 4.5,
      shadowOffsetY: 1.8,
      maxWidth: ribW - 76
    });

    // Subtle top-right close button (stays strictly below capsule & never overlaps ribbon center)
    drawCloseButton(c, f, hits, app, () => app.closeModal());

    // 3. Level Subtitle ("第 1-5 关 · 街角星夜店")
    const subY = f.sheetY + 34;
    UI.drawFitText(
      c,
      `第 ${lvl.id} 关 · ${chapName}`,
      f.ix + f.iw * 0.5,
      subY,
      f.iw - 12,
      14.5,
      11.0,
      900,
      '#5A3928',
      'center',
      'middle'
    );

    // 4. Score Hero Box + Cheering Patron Portrait (Design 05)
    const heroY = subY + 16;
    const heroH = Math.min(92, Math.max(74, Math.floor(f.sheetH * 0.28)));
    UI.drawKissaCard(c, f.ix, heroY, f.iw, heroH, {
      tone: 'recess',
      topCol: '#F7E7C8',
      botCol: '#EED6AE',
      borderColor: '#C5A982',
      radius: 12,
      lineWidth: 1.8
    });

    // Top-left overlapping badge ("新纪录" or status)
    if (res.isNewBest && (res.score || 0) > 0) {
      UI.drawTagBadge(c, f.ix + 8, heroY - 9, 64, 21, '新纪录', 'urgent', 10.5);
    } else if (res.cleared) {
      UI.drawTagBadge(c, f.ix + 8, heroY - 9, 68, 21, '营业达标', 'green', 10.0);
    } else {
      UI.drawTagBadge(c, f.ix + 8, heroY - 9, 76, 21, '未达1星线', 'wood', 9.8);
    }

    // Animated counting score
    const countT = easeOutCubic(clamp(revealT / 0.72, 0, 1));
    const shownScore = Math.round((res.score || 0) * countT);
    const patronSz = Math.min(heroH + 6, 86);
    const scoreAreaW = Math.max(100, f.iw - patronSz - 16);
    UI.drawOutlinedText(c, formatNum(shownScore), f.ix + 14 + scoreAreaW * 0.45, heroY + heroH * 0.56, {
      size: 36,
      minSize: 22,
      weight: 900,
      fill: '#C48120',
      stroke: '#5A3928',
      strokeWidth: 2.2,
      shadowOffsetY: 1.0,
      maxWidth: scoreAreaW - 8
    });

    const activePatronId = normalizePatronId(saveData.selectedPatron);
    UI.drawUiIcon(
      c,
      sprites,
      activePatronId,
      f.ix + f.iw - patronSz * 0.52 - 4,
      heroY + heroH * 0.52,
      patronSz
    );

    // 5. Inner Detailed Stats Sheet (Double warm-brown frame, 3 rows, Design 05)
    const statsY = heroY + heroH + 10;
    const statsH = Math.max(106, f.sheetY + f.sheetH - 12 - statsY);
    UI.drawKissaCard(c, f.ix, statsY, f.iw, statsH, {
      tone: 'cream',
      borderColor: '#5A3928',
      radius: 13,
      lineWidth: 2.6
    });

    const maxCombo = Math.max(0, Math.floor(Number(res.maxCombo) || 0));
    const comboIdx = Math.min(Math.max(0, maxCombo - 1), SERVE_COMBO_MULTS.length - 1);
    const comboMult = maxCombo >= 2 ? SERVE_COMBO_MULTS[comboIdx] : 1.0;

    // Breakdown sub-note for stardust / soft-pity
    const parts = [];
    if (res.cleared) {
      if (res.firstStarDustAward > 0) parts.push(`首星+${res.firstStarDustAward}`);
      if (res.clearDustAward > 0) parts.push(`过关+${res.clearDustAward}`);
      if (res.vipDustAward > 0) parts.push(`VIP+${res.vipDustAward}`);
      if (res.threeStarBonusDust > 0) parts.push(`三星+${res.threeStarBonusDust}`);
      if (parts.length === 0) parts.push(`服务 ${res.ordersServed || 0} 位顾客 · 当前持有 ${formatNum(saveData.bankStardust || 0)}`);
    } else {
      const streak =
        Number(res.failStreak) ||
        (saveData.levelFailStreaks && Number(saveData.levelFailStreaks[res.levelId])) ||
        0;
      if ((res.consolationDust || 0) > 0) parts.push(`营业安慰+${res.consolationDust}`);
      if (Boolean(res.softPityNextRun || streak >= 2)) {
        parts.push('下局开场预充 40% 技能能量');
      } else {
        parts.push('升级猫饼菜价可大幅提分');
      }
    }

    const hasSubNote = statsH >= 122;
    const rowBlockH = hasSubNote ? statsH - 22 : statsH - 8;
    const rowH = rowBlockH / 3;
    const statRows = [
      { label: '上菜总得分', val: formatNum(res.score || 0), type: 'score' },
      {
        label: '最高上菜连击',
        val: maxCombo > 0 ? `${maxCombo}连` : '0连',
        extra: maxCombo >= 2 ? ` ×${comboMult.toFixed(2)}` : '',
        type: 'combo'
      },
      { label: '星尘币奖励', val: `+${formatNum(res.totalDustAward || 0)}`, type: 'dust' }
    ];

    for (let i = 0; i < statRows.length; i++) {
      const row = statRows[i];
      const ry = statsY + 4 + i * rowH;
      const rCy = ry + rowH * 0.5;
      if (i > 0) {
        c.save();
        try {
          c.strokeStyle = 'rgba(138, 86, 52, 0.25)';
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(f.ix + 12, ry);
          c.lineTo(f.ix + f.iw - 12, ry);
          c.stroke();
        } finally {
          c.restore();
        }
      }

      UI.drawFitText(c, row.label, f.ix + 14, rCy, f.iw * 0.48, 13.0, 10.0, 800, '#5A3928', 'left', 'middle');

      if (row.type === 'combo' && row.extra) {
        UI.drawFitText(
          c,
          row.extra,
          f.ix + f.iw - 14,
          rCy,
          64,
          13.0,
          10.0,
          900,
          '#5A3928',
          'right',
          'middle'
        );
        UI.drawOutlinedText(c, row.val, f.ix + f.iw - 66, rCy, {
          size: 13.5,
          minSize: 10,
          weight: 900,
          fill: '#FFB838',
          stroke: '#5A3928',
          strokeWidth: 2.6,
          shadowOffsetY: 0,
          align: 'right'
        });
      } else if (row.type === 'dust') {
        UI.drawFitText(
          c,
          row.val,
          f.ix + f.iw - 14,
          rCy,
          76,
          14.0,
          10.5,
          900,
          '#5A3928',
          'right',
          'middle'
        );
        const valApproxW = Math.min(62, row.val.length * 9.2 + 8);
        UI.drawStarIcon(c, f.ix + f.iw - 14 - valApproxW - 8, rCy, 7.2, true, sprites);
      } else {
        UI.drawFitText(
          c,
          row.val,
          f.ix + f.iw - 14,
          rCy,
          110,
          14.0,
          10.5,
          900,
          '#5A3928',
          'right',
          'middle'
        );
      }
    }

    if (hasSubNote) {
      UI.drawFitText(
        c,
        parts.join(' · '),
        f.ix + f.iw * 0.5,
        statsY + statsH - 11,
        f.iw - 20,
        9.4,
        7.6,
        700,
        '#8A5A32',
        'center',
        'middle'
      );
    }

    // 6. Bottom Action Area inside the wood base (zero overlap, preserves all 3 required hit IDs!)
    const nextId = getNextLevelId(res.levelId);
    const nextUnlocked = Boolean(res.cleared && nextId && isLevelUnlocked(nextId, saveData.levelStars).unlocked);
    const barTop = f.sheetY + f.sheetH + 8;
    const primaryH = 38;
    const btnGap = 10;
    const halfW = Math.floor((f.sheetW - btnGap) / 2);

    // Left: 星夜小铺 (result_shop_btn)
    UI.drawPillButton(c, f.sheetX, barTop, halfW, primaryH, {
      variant: 'wood',
      icon: 'icon_shop',
      sprites,
      iconSize: 17,
      label: '星夜小铺',
      fontSize: 13.2,
      radius: primaryH * 0.5,
      pressed: isPressed(app, 'result_shop_btn')
    });
    if (typeof app.hasAffordableShopItem === 'function' && app.hasAffordableShopItem()) {
      drawRedDot(c, f.sheetX + halfW - 10, barTop + 8, 4.6);
    }
    hits.add('result_shop_btn', f.sheetX, barTop, halfW, primaryH, () => app.openShopFromResult());

    // Right: 下一关 X-Y / 返回大厅 (result_next_btn)
    const nextX = f.sheetX + halfW + btnGap;
    UI.drawPillButton(c, nextX, barTop, halfW, primaryH, {
      variant: nextUnlocked ? 'primary' : 'wood',
      textOutline: true,
      glossDot: nextUnlocked,
      label: res.cleared && nextId ? `下一关 ${nextId}` : '返回大厅',
      fontSize: 13.6,
      radius: primaryH * 0.5,
      pressed: isPressed(app, 'result_next_btn')
    });
    hits.add('result_next_btn', nextX, barTop, halfW, primaryH, () => app.onResultNext());

    // Bottom centered compact pill: 重玩本关 / 再试一次 (result_retry_btn) — stays safely inside modal wood frame!
    const retryW = Math.min(138, f.sheetW - 24);
    const retryH = 26;
    const retryX = Math.round(f.cardX + (f.cardW - retryW) * 0.5);
    const retryY = barTop + primaryH + 6;
    UI.drawPillButton(c, retryX, retryY, retryW, retryH, {
      variant: res.cleared ? 'dark' : 'primary',
      textOutline: true,
      icon: 'icon_restart',
      sprites,
      iconSize: 13,
      label: res.cleared ? '重玩本关' : '再试一次',
      fontSize: 11.4,
      radius: 13,
      pressed: isPressed(app, 'result_retry_btn')
    });
    hits.add('result_retry_btn', retryX, retryY, retryW, retryH, () => app.startLevel(res.levelId));
  } finally {
    endModalFrame(c);
  }
}

/* ======================== Scroll Helpers ======================== */

function setupListScroll(app, ix, iw, bodyY, bodyH, itemCount, itemH, gap) {
  const count = Math.max(0, itemCount);
  const contentH = count > 0 ? count * itemH + (count - 1) * gap : 0;
  const maxScroll = Math.max(0, contentH - bodyH);
  const scrollY = maxScroll > 0 ? clamp(Number(app.modalScrollY) || 0, 0, maxScroll) : 0;
  if (maxScroll > 0) {
    app.modalScrollRect = { x: ix, y: bodyY, w: iw, h: bodyH };
    app.modalMaxScroll = maxScroll;
  } else {
    app.modalScrollRect = null;
    app.modalMaxScroll = 0;
  }
  return { scrollY, maxScroll, contentH };
}

function addScrollClippedHit(hits, id, x, y, w, h, scrollY, bodyY, bodyH, onClick) {
  const screenY = y - scrollY;
  const visTop = Math.max(bodyY, screenY);
  const visBot = Math.min(bodyY + bodyH, screenY + h);
  if (visBot - visTop >= 14) {
    hits.add(id, x, visTop, w, visBot - visTop, onClick);
  }
}

/* ======================== 06 & 09. 星夜小铺 / 烤盘主题弹窗 (ShopModal) ======================== */

function renderShopModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const bank = Math.max(0, Math.floor(Number(saveData.bankStardust) || 0));
  const activeTab = app.activeShopTab || 'catcakes';

  const f = beginModalFrame(c, metrics, app, {
    maxW: 452,
    desiredH: 576,
    dismissOnOutside: true,
    awning: true,
    title: activeTab === 'themes' ? '烤盘主题' : '星夜小铺',
    sheetTopInset: 66,
    sheetBottomPad: 12
  });

  try {
    drawCloseButton(c, f, hits, app);

    // 4 Folder Tabs seamlessly docked to top edge of cream parchment (Design 06)
    const tabY = f.sheetY - 27;
    const tabH = 29;
    const tabs = [
      { id: 'catcakes', hitId: 'shop_tab_catcakes', label: '猫饼升级', redDot: app.hasAffordableShopTab && app.hasAffordableShopTab('catcakes') },
      { id: 'devices', hitId: 'shop_tab_devices', label: '店面设备', redDot: app.hasAffordableShopTab && app.hasAffordableShopTab('devices') },
      { id: 'patrons', hitId: 'shop_tab_patrons', label: '看板店员', redDot: app.hasAffordableShopTab && app.hasAffordableShopTab('patrons') },
      { id: 'themes', hitId: 'shop_tab_themes', label: '棋盘主题', redDot: app.hasAffordableShopTab && app.hasAffordableShopTab('themes') }
    ];
    drawFolderTabs(c, f.sheetX + 6, tabY, f.sheetW - 12, tabH, tabs, activeTab, hits, app, (tabId) =>
      app.setShopTab(tabId)
    );

    // Compact balance strip at top of parchment so player sees stardust live while buying
    const balBarY = f.sheetY + 8;
    const balBarH = 24;
    const chipW = 92;
    UI.drawFitText(
      c,
      activeTab === 'catcakes'
        ? '永久提升各阶猫饼上菜基础分'
        : activeTab === 'devices'
        ? '后厨设备升级全关卡永久生效'
        : activeTab === 'patrons'
        ? '解锁看板店员获得专属技能'
        : '随心切换局内烘焙烤盘外观',
      f.ix,
      balBarY + balBarH * 0.5,
      f.iw - chipW - 8,
      10.4,
      8.2,
      700,
      '#8A5A32',
      'left',
      'middle'
    );
    UI.drawCurrencyChip(c, f.ix + f.iw - chipW, balBarY, chipW, balBarH, sprites, 'icon_star_coin', formatNum(bank), {
      fontSize: 11.4
    });

    const footerH = 20;
    const footerY = f.sheetY + f.sheetH - footerH - 4;
    const bodyY = balBarY + balBarH + 6;
    const bodyH = Math.max(180, footerY - 6 - bodyY);
    app.modalScrollRect = null;
    app.modalMaxScroll = 0;

    // Tab switch fade + gentle upward glide
    const anim = f.anim;

    if (activeTab === 'catcakes') {
      const cardGap = 8;
      // Fit 4 full cards comfortably on 390x844 so C1..C4 are always visible at scroll=0
      const cardH = clamp(Math.floor((bodyH - cardGap * 3) / 4.25), 72, 86);
      const { scrollY, maxScroll, contentH } = setupListScroll(
        app,
        f.ix,
        f.iw,
        bodyY,
        bodyH,
        CATCAKES.length,
        cardH,
        cardGap
      );
      const listW = f.iw - (maxScroll > 0 ? 10 : 0);

      c.save();
      try {
        c.beginPath();
        c.rect(f.ix - 2, bodyY, f.iw + 4, bodyH);
        c.clip();
        c.globalAlpha *= anim.tabAlpha;
        c.translate(0, -scrollY + anim.tabOffsetY);

        for (let i = 0; i < CATCAKES.length; i++) {
          const cake = CATCAKES[i];
          const cy = bodyY + i * (cardH + cardGap);
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

          UI.drawKissaCard(c, f.ix, cy, listW, cardH, {
            tone: isMax ? 'equipped' : 'cream',
            locked: !isUnlocked,
            radius: 13
          });

          // Left thumbnail slot
          const slotS = Math.min(58, cardH - 16);
          const slotX = f.ix + 8;
          const slotY = Math.round(cy + (cardH - slotS) * 0.5);
          UI.drawKissaCard(c, slotX, slotY, slotS, slotS, {
            tone: 'recess',
            locked: !isUnlocked,
            borderColor: isUnlocked ? '#D5BD98' : '#9B9084',
            radius: 10,
            lineWidth: 1.5
          });
          UI.drawCatcakeSprite(c, sprites, cake.tier, slotX + slotS * 0.5, slotY + slotS * 0.5, slotS * 0.78, {
            happy: isUnlocked && isMax,
            silhouette: false,
            alpha: isUnlocked ? 1 : 0.62
          });
          if (!isUnlocked) {
            drawLockIcon(c, slotX + slotS - 9, slotY + slotS - 9, 13, { sprites });
          }

          // Right action button (Design 06)
          const btnW = Math.min(82, Math.max(70, Math.round(listW * 0.25)));
          const btnH = 34;
          const btnX = f.ix + listW - 8 - btnW;
          const btnY = Math.round(cy + (cardH - btnH) * 0.5);
          const hitId = `shop_buy_catcake_${cake.tier}`;

          UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
            variant: !isUnlocked ? 'disabled' : isMax ? 'equipped' : canBuy ? 'primary' : 'wood',
            disabled: !isUnlocked || (!isMax && !canBuy),
            icon: !isUnlocked ? 'icon_lock' : isMax ? '' : 'icon_star_coin',
            sprites,
            iconSize: 15,
            label: !isUnlocked ? '未解锁' : isMax ? '已满级' : String(cost),
            fontSize: !isUnlocked || isMax ? 11.4 : 13.6,
            radius: 12,
            pressed: isPressed(app, hitId)
          });

          const tierCopy = cake.tier;
          addScrollClippedHit(hits, hitId, btnX, btnY, btnW, btnH, scrollY, bodyY, bodyH, () =>
            app.buyCatcakeUpgrade(tierCopy)
          );

          // Middle info column: Name + Lv badge + 4-segment bar + boost text
          const tx = slotX + slotS + 9;
          const tw = Math.max(72, btnX - 8 - tx);

          UI.drawFitText(
            c,
            cake.name,
            tx,
            cy + Math.round(cardH * 0.25),
            tw,
            13.2,
            10.0,
            900,
            isUnlocked ? '#5A3928' : '#6A5E53',
            'left',
            'middle'
          );

          const lvY = cy + Math.round(cardH * 0.53);
          const lvPillW = 46;
          UI.drawTagBadge(
            c,
            tx,
            lvY - 8.5,
            lvPillW,
            17,
            isUnlocked ? `Lv.${lv}/4` : '未解锁',
            isUnlocked ? 'wood' : 'soft',
            8.8
          );
          const barX = tx + lvPillW + 6;
          const barW = Math.max(46, Math.min(82, tw - lvPillW - 6));
          UI.drawSegmentedBar(c, barX, lvY - 6.5, barW, 13, isUnlocked ? lv : 0, 4);

          const subCopy = !isUnlocked
            ? `到达第 ${cake.unlockLevel} 关解锁研发`
            : isMax
            ? `已满级 · 菜价 ${curP} 分 (+60%)`
            : `得分 +${lv * 15}% → +${(lv + 1) * 15}%（${curP}分）`;
          UI.drawFitText(
            c,
            subCopy,
            tx,
            cy + Math.round(cardH * 0.81),
            tw,
            9.8,
            7.8,
            700,
            isUnlocked ? '#754C36' : '#7A6F63',
            'left',
            'middle'
          );
        }
      } finally {
        c.restore();
      }

      if (maxScroll > 0) {
        UI.drawScrollBar(
          c,
          f.ix + f.iw - 6,
          bodyY + 2,
          5,
          bodyH - 4,
          scrollY / maxScroll,
          bodyH / Math.max(bodyH, contentH)
        );
      }

      UI.drawFitText(
        c,
        '升级猫饼可永久提升所有关卡的上菜基础分',
        f.ix + f.iw * 0.5,
        footerY + footerH * 0.5,
        f.iw - 8,
        10.2,
        8.2,
        700,
        '#754C36',
        'center',
        'middle'
      );
      return;
    }

    if (activeTab === 'devices') {
      const cardGap = 8;
      const cardH = clamp(Math.floor((bodyH - cardGap * (SHOP_DEVICES.length - 1)) / SHOP_DEVICES.length), 74, 92);
      const { scrollY, maxScroll, contentH } = setupListScroll(
        app,
        f.ix,
        f.iw,
        bodyY,
        bodyH,
        SHOP_DEVICES.length,
        cardH,
        cardGap
      );
      const listW = f.iw - (maxScroll > 0 ? 10 : 0);

      c.save();
      try {
        c.beginPath();
        c.rect(f.ix - 2, bodyY, f.iw + 4, bodyH);
        c.clip();
        c.globalAlpha *= anim.tabAlpha;
        c.translate(0, -scrollY + anim.tabOffsetY);

        for (let i = 0; i < SHOP_DEVICES.length; i++) {
          const dev = SHOP_DEVICES[i];
          const cy = bodyY + i * (cardH + cardGap);
          const rawLv = saveData.deviceUpgrades && saveData.deviceUpgrades[dev.id];
          const lv = clamp(Math.floor(Number(rawLv) || 0), 0, dev.maxLv);
          const isMax = lv >= dev.maxLv;
          const cost = isMax ? 0 : dev.costs[lv];
          const canBuy = !isMax && bank >= cost;

          UI.drawKissaCard(c, f.ix, cy, listW, cardH, {
            tone: isMax ? 'equipped' : 'cream',
            radius: 13
          });

          const slotS = Math.min(58, cardH - 16);
          const slotX = f.ix + 8;
          const slotY = Math.round(cy + (cardH - slotS) * 0.5);
          UI.drawKissaCard(c, slotX, slotY, slotS, slotS, {
            tone: 'recess',
            borderColor: '#D5BD98',
            radius: 10,
            lineWidth: 1.5
          });
          UI.drawUiIcon(c, sprites, dev.icon, slotX + slotS * 0.5, slotY + slotS * 0.5, slotS * 0.78);

          const btnW = Math.min(82, Math.max(70, Math.round(listW * 0.25)));
          const btnH = 34;
          const btnX = f.ix + listW - 8 - btnW;
          const btnY = Math.round(cy + (cardH - btnH) * 0.5);
          const hitId = `shop_buy_${dev.id}`;

          UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
            variant: isMax ? 'equipped' : canBuy ? 'primary' : 'wood',
            disabled: !isMax && !canBuy,
            icon: isMax ? '' : 'icon_star_coin',
            sprites,
            iconSize: 15,
            label: isMax ? '已满级' : String(cost),
            fontSize: isMax ? 11.4 : 13.6,
            radius: 12,
            pressed: isPressed(app, hitId)
          });

          const devIdCopy = dev.id;
          addScrollClippedHit(hits, hitId, btnX, btnY, btnW, btnH, scrollY, bodyY, bodyH, () =>
            app.buyDeviceUpgrade(devIdCopy)
          );

          const tx = slotX + slotS + 9;
          const tw = Math.max(72, btnX - 8 - tx);

          UI.drawFitText(c, dev.name, tx, cy + Math.round(cardH * 0.24), tw, 13.0, 9.8, 900, '#5A3928', 'left', 'middle');

          const lvY = cy + Math.round(cardH * 0.50);
          const lvPillW = 46;
          UI.drawTagBadge(c, tx, lvY - 8, lvPillW, 16, `Lv.${lv}/${dev.maxLv}`, 'wood', 8.6);
          const barX = tx + lvPillW + 6;
          const barW = Math.max(46, Math.min(80, tw - lvPillW - 6));
          UI.drawSegmentedBar(c, barX, lvY - 6, barW, 12, lv, dev.maxLv);

          UI.drawFitText(
            c,
            dev.getDesc(lv),
            tx,
            cy + Math.round(cardH * 0.80),
            tw,
            9.6,
            7.6,
            700,
            '#754C36',
            'left',
            'middle'
          );
        }
      } finally {
        c.restore();
      }

      if (maxScroll > 0) {
        UI.drawScrollBar(c, f.ix + f.iw - 6, bodyY + 2, 5, bodyH - 4, scrollY / maxScroll, bodyH / Math.max(bodyH, contentH));
      }
      UI.drawFitText(
        c,
        '店面设备永久强化托盘、揉面、耐性与初始厨具',
        f.ix + f.iw * 0.5,
        footerY + footerH * 0.5,
        f.iw - 8,
        10.0,
        8.0,
        700,
        '#754C36',
        'center',
        'middle'
      );
      return;
    }

    if (activeTab === 'patrons') {
      const cardGap = 10;
      const cardH = clamp(Math.floor((bodyH - cardGap * (PATRONS.length - 1)) / PATRONS.length), 88, 110);
      const { scrollY, maxScroll, contentH } = setupListScroll(
        app,
        f.ix,
        f.iw,
        bodyY,
        bodyH,
        PATRONS.length,
        cardH,
        cardGap
      );
      const listW = f.iw - (maxScroll > 0 ? 10 : 0);
      const unlocked = Array.isArray(saveData.unlockedPatrons) ? saveData.unlockedPatrons : ['mikan'];
      const selected = normalizePatronId(saveData.selectedPatron);

      c.save();
      try {
        c.beginPath();
        c.rect(f.ix - 2, bodyY, f.iw + 4, bodyH);
        c.clip();
        c.globalAlpha *= anim.tabAlpha;
        c.translate(0, -scrollY + anim.tabOffsetY);

        for (let i = 0; i < PATRONS.length; i++) {
          const p = PATRONS[i];
          const cy = bodyY + i * (cardH + cardGap);
          const owned = unlocked.includes(p.id);
          const isSelected = owned && selected === p.id;
          const canBuy = !owned && bank >= p.cost;

          UI.drawKissaCard(c, f.ix, cy, listW, cardH, {
            tone: isSelected ? 'selected' : 'cream',
            selected: isSelected,
            radius: 13
          });

          const avS = Math.min(64, cardH - 16);
          const avX = f.ix + 8;
          const avY = Math.round(cy + (cardH - avS) * 0.5);
          UI.drawKissaCard(c, avX, avY, avS, avS, {
            tone: 'recess',
            borderColor: isSelected ? '#F5B841' : '#D5BD98',
            radius: 12,
            lineWidth: 1.6
          });
          UI.drawUiIcon(c, sprites, p.id, avX + avS * 0.5, avY + avS * 0.5, avS * 0.86);

          const btnW = Math.min(86, Math.max(74, Math.round(listW * 0.25)));
          const btnH = 34;
          const btnX = f.ix + listW - 8 - btnW;
          const btnY = Math.round(cy + (cardH - btnH) * 0.5);

          const tx = avX + avS + 9;
          const tw = Math.max(72, btnX - 8 - tx);

          UI.drawFitText(c, `${p.name} · ${p.skillName}`, tx, cy + 22, tw, 12.6, 9.6, 900, '#5A3928', 'left', 'middle');
          UI.drawWrappedText(
            c,
            p.passiveDesc,
            tx,
            cy + 36,
            tw,
            14,
            UI.fontStr(9.6, 700),
            '#754C36',
            'left',
            3
          );

          const pidCopy = p.id;
          if (!owned) {
            const hitId = `shop_buy_patron_${pidCopy}`;
            UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
              variant: canBuy ? 'primary' : 'wood',
              disabled: !canBuy,
              icon: 'icon_star_coin',
              sprites,
              iconSize: 15,
              label: String(p.cost),
              fontSize: 13.4,
              radius: 12,
              pressed: isPressed(app, hitId)
            });
            addScrollClippedHit(hits, hitId, btnX, btnY, btnW, btnH, scrollY, bodyY, bodyH, () =>
              app.buyPatron(pidCopy)
            );
          } else {
            const hitId = `shop_equip_patron_${pidCopy}`;
            UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
              variant: isSelected ? 'equipped' : 'wood',
              label: isSelected ? '出战中' : '切换出战',
              fontSize: 11.4,
              radius: 12,
              pressed: isPressed(app, hitId)
            });
            addScrollClippedHit(hits, hitId, btnX, btnY, btnW, btnH, scrollY, bodyY, bodyH, () =>
              app.equipPatron(pidCopy)
            );
          }
        }
      } finally {
        c.restore();
      }

      if (maxScroll > 0) {
        UI.drawScrollBar(c, f.ix + f.iw - 6, bodyY + 2, 5, bodyH - 4, scrollY / maxScroll, bodyH / Math.max(bodyH, contentH));
      }
      UI.drawFitText(
        c,
        '看板店员可随时切换，出战生效专属被动与招牌技',
        f.ix + f.iw * 0.5,
        footerY + footerH * 0.5,
        f.iw - 8,
        10.0,
        8.0,
        700,
        '#754C36',
        'center',
        'middle'
      );
      return;
    }

    // --- Tab 4: 棋盘主题 (Design 09 BoardThemeModal) ---
    const cardGap = 10;
    const cardH = clamp(Math.floor((bodyH - cardGap * (BOARD_THEME_LIST.length - 1)) / BOARD_THEME_LIST.length), 88, 108);
    const { scrollY, maxScroll, contentH } = setupListScroll(
      app,
      f.ix,
      f.iw,
      bodyY,
      bodyH,
      BOARD_THEME_LIST.length,
      cardH,
      cardGap
    );
    const listW = f.iw - (maxScroll > 0 ? 10 : 0);
    const unlockedThemes = Array.isArray(saveData.unlockedThemes) ? saveData.unlockedThemes : ['amber'];
    const equippedId = saveData.equippedTheme || 'amber';

    c.save();
    try {
      c.beginPath();
      c.rect(f.ix - 2, bodyY, f.iw + 4, bodyH);
      c.clip();
      c.globalAlpha *= anim.tabAlpha;
      c.translate(0, -scrollY + anim.tabOffsetY);

      for (let i = 0; i < BOARD_THEME_LIST.length; i++) {
        const th = BOARD_THEME_LIST[i];
        const cy = bodyY + i * (cardH + cardGap);
        const owned = unlockedThemes.includes(th.id);
        const isEquipped = owned && equippedId === th.id;
        const canBuy = !owned && bank >= th.cost;

        UI.drawKissaCard(c, f.ix, cy, listW, cardH, {
          tone: isEquipped ? 'selected' : 'cream',
          selected: isEquipped,
          radius: 13
        });

        const swS = Math.min(68, cardH - 18);
        const swX = f.ix + 10;
        const swY = Math.round(cy + (cardH - swS) * 0.5);
        UI.drawThemeSwatch(c, swX, swY, swS, swS, th.id, sprites);

        const btnW = Math.min(84, Math.max(72, Math.round(listW * 0.25)));
        const btnH = 34;
        const btnX = f.ix + listW - 10 - btnW;
        const btnY = Math.round(cy + (cardH - btnH) * 0.5);

        const tx = swX + swS + 10;
        const tw = Math.max(72, btnX - 8 - tx);
        UI.drawFitText(c, th.name, tx, cy + Math.round(cardH * 0.34), tw, 13.8, 10.4, 900, '#5A3928', 'left', 'middle');
        UI.drawFitText(c, th.desc, tx, cy + Math.round(cardH * 0.68), tw, 10.2, 8.2, 700, '#754C36', 'left', 'middle');

        const tidCopy = th.id;
        if (!owned) {
          const hitId = `shop_buy_theme_${tidCopy}`;
          UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
            variant: canBuy ? 'primary' : 'wood',
            disabled: !canBuy,
            icon: 'icon_star_coin',
            sprites,
            iconSize: 15,
            label: String(th.cost),
            fontSize: 13.6,
            radius: 12,
            pressed: isPressed(app, hitId)
          });
          addScrollClippedHit(hits, hitId, btnX, btnY, btnW, btnH, scrollY, bodyY, bodyH, () =>
            app.buyTheme(tidCopy)
          );
        } else {
          const hitId = `shop_equip_theme_${tidCopy}`;
          UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
            variant: isEquipped ? 'equipped' : 'wood',
            label: isEquipped ? '使用中' : '切换主题',
            fontSize: 11.4,
            radius: 12,
            pressed: isPressed(app, hitId)
          });
          addScrollClippedHit(hits, hitId, btnX, btnY, btnW, btnH, scrollY, bodyY, bodyH, () =>
            app.equipTheme(tidCopy)
          );
        }
      }
    } finally {
      c.restore();
    }

    if (maxScroll > 0) {
      UI.drawScrollBar(c, f.ix + f.iw - 6, bodyY + 2, 5, bodyH - 4, scrollY / maxScroll, bodyH / Math.max(bodyH, contentH));
    }
    UI.drawFitText(
      c,
      '解锁主题后可随时切换局内烤盘外观',
      f.ix + f.iw * 0.5,
      footerY + footerH * 0.5,
      f.iw - 8,
      10.2,
      8.2,
      700,
      '#754C36',
      'center',
      'middle'
    );
  } finally {
    endModalFrame(c);
  }
}

/* ======================== 07. 星夜图鉴弹窗 (CompendiumModal) ======================== */

function renderCompendiumModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const activeTab = app.activeCompendiumTab || 'catcakes';

  const f = beginModalFrame(c, metrics, app, {
    maxW: 452,
    desiredH: 572,
    dismissOnOutside: true,
    title: '星夜图鉴',
    sheetTopInset: 66,
    sheetBottomPad: 12
  });

  try {
    drawCloseButton(c, f, hits, app);

    // Count collected items
    let unlockedCakes = 0;
    for (let i = 0; i < CATCAKES.length; i++) {
      if (isLevelUnlocked(CATCAKES[i].unlockLevel, saveData.levelStars).unlocked) unlockedCakes++;
    }
    let unlockedRecipes = 0;
    for (let i = 0; i < RECIPE_LIST.length; i++) {
      if (isLevelUnlocked(RECIPE_LIST[i].unlockLevel, saveData.levelStars).unlocked) unlockedRecipes++;
    }

    // 2 Folder Tabs + Right-side "已收集 X/7" counter pill (Design 07)
    const tabY = f.sheetY - 27;
    const tabH = 29;
    const countW = 68;
    const tabsW = f.sheetW - 18 - countW;
    drawFolderTabs(
      c,
      f.sheetX + 6,
      tabY,
      tabsW,
      tabH,
      [
        { id: 'catcakes', hitId: 'compendium_tab_catcakes', label: '猫饼图鉴' },
        { id: 'recipes', hitId: 'compendium_tab_recipes', label: '套餐配方' }
      ],
      activeTab,
      hits,
      app,
      (tabId) => app.setCompendiumTab(tabId)
    );

    const cntX = f.sheetX + f.sheetW - 6 - countW;
    UI.drawKissaCard(c, cntX, tabY - 1, countW, tabH - 1, {
      tone: 'wood',
      topCol: '#7B4E31',
      botCol: '#5B3822',
      borderColor: '#4A2B1A',
      radius: 9,
      lineWidth: 2.0
    });
    UI.drawOutlinedText(c, '已收集', cntX + countW * 0.5, tabY + 8, {
      size: 8.6,
      weight: 700,
      fill: '#FFE5AA',
      stroke: '#3D2214',
      strokeWidth: 1.6,
      shadowOffsetY: 0
    });
    UI.drawOutlinedText(
      c,
      activeTab === 'catcakes' ? `${unlockedCakes}/${CATCAKES.length}` : `${unlockedRecipes}/${RECIPE_LIST.length}`,
      cntX + countW * 0.5,
      tabY + 20,
      {
        size: 10.6,
        weight: 900,
        fill: '#FFF8EC',
        stroke: '#3D2214',
        strokeWidth: 1.8,
        shadowOffsetY: 0
      }
    );

    const bodyY = f.sheetY + 10;
    const bodyH = Math.max(200, f.sheetY + f.sheetH - 10 - bodyY);
    const anim = f.anim;
    app.modalScrollRect = null;
    app.modalMaxScroll = 0;

    if (activeTab === 'catcakes') {
      // Exact Design 07 layout: 3-column grid (C1–C7 + Honor slot) + bottom detail strip!
      const detailH = 58;
      const gridWrapH = Math.max(150, bodyH - detailH - 8);
      UI.drawKissaCard(c, f.ix, bodyY, f.iw, gridWrapH, {
        tone: 'recess',
        borderColor: '#DEC9A6',
        radius: 12,
        lineWidth: 1.5
      });

      const pad = 8;
      const cols = 3;
      const rows = 3;
      const gx = 7;
      const gy = 7;
      const cw = Math.floor((f.iw - pad * 2 - gx * (cols - 1)) / cols);
      const ch = Math.floor((gridWrapH - pad * 2 - gy * (rows - 1)) / rows);
      const selectedTier = clamp(Math.floor(Number(app.selectedCompendiumTier) || 1), 1, CATCAKES.length);

      c.save();
      try {
        c.globalAlpha *= anim.tabAlpha;
        c.translate(0, anim.tabOffsetY);

        for (let i = 0; i < CATCAKES.length; i++) {
          const cake = CATCAKES[i];
          const col = i % cols;
          const row = Math.floor(i / cols);
          const cx = f.ix + pad + col * (cw + gx);
          const cy = bodyY + pad + row * (ch + gy);
          const unlocked = isLevelUnlocked(cake.unlockLevel, saveData.levelStars).unlocked;
          const isSel = selectedTier === cake.tier;

          UI.drawKissaCard(c, cx, cy, cw, ch, {
            tone: isSel ? 'selected' : 'cream',
            selected: isSel,
            locked: !unlocked,
            radius: 11
          });

          // Top-left C1..C7 badge
          UI.drawTagBadge(c, cx + 4, cy + 4, 26, 15, cake.id, isSel ? 'amber' : 'wood', 8.5);

          const spS = Math.min(cw - 16, ch - 30);
          const spCy = cy + 16 + (ch - 32) * 0.5;
          if (unlocked) {
            const lv = clamp(Math.floor(Number(saveData.catcakeLevels && saveData.catcakeLevels[cake.tier]) || 0), 0, 4);
            UI.drawCatcakeSprite(c, sprites, cake.tier, cx + cw * 0.5, spCy, spS, {
              happy: lv >= 2
            });
          } else {
            // Silhouette + "?" + top-right lock icon (Design 07 C7)
            UI.drawCatcakeSprite(c, sprites, cake.tier, cx + cw * 0.5, spCy, spS, {
              silhouette: true
            });
            UI.drawOutlinedText(c, '?', cx + cw * 0.5, spCy + 1, {
              size: Math.max(15, Math.round(spS * 0.45)),
              weight: 900,
              fill: '#EFE4D0',
              stroke: '#4A3A2E',
              strokeWidth: 2.2,
              shadowOffsetY: 0
            });
            drawLockIcon(c, cx + cw - 12, cy + 12, 13, { sprites });
          }

          UI.drawFitText(
            c,
            unlocked ? cake.name : '未解锁',
            cx + cw * 0.5,
            cy + ch - 10,
            cw - 8,
            10.2,
            7.8,
            900,
            unlocked ? '#5A3928' : '#6A5E53',
            'center',
            'middle'
          );

          const tCopy = cake.tier;
          hits.add(`compendium_cake_${tCopy}`, cx, cy, cw, ch, () => {
            if (typeof app.selectCompendiumTier === 'function') app.selectCompendiumTier(tCopy);
          });
        }

        // Slot 8 & 9 span: Chef Honor Rank & Achievement mini-badge
        const achX = f.ix + pad + 1 * (cw + gx);
        const achY = bodyY + pad + 2 * (ch + gy);
        const achW = cw * 2 + gx;
        let achDone = 0;
        for (let i = 0; i < ACHIEVEMENTS.length; i++) {
          if (ACHIEVEMENTS[i].check(saveData)) achDone++;
        }
        UI.drawKissaCard(c, achX, achY, achW, ch, {
          tone: 'amber',
          borderColor: '#C59A5A',
          radius: 11,
          lineWidth: 1.8
        });
        UI.drawUiIcon(c, sprites, 'medal_gold', achX + 26, achY + ch * 0.5, Math.min(34, ch - 18));
        UI.drawFitText(c, getChefRank(saveData), achX + 48, achY + ch * 0.36, achW - 56, 12.2, 9.2, 900, '#5A3928', 'left', 'middle');
        UI.drawFitText(
          c,
          `荣誉勋章 ${achDone}/${ACHIEVEMENTS.length} · 总星 ${computeTotalStars(saveData.levelStars)}/90`,
          achX + 48,
          achY + ch * 0.68,
          achW - 56,
          9.6,
          7.6,
          700,
          '#754C36',
          'left',
          'middle'
        );
      } finally {
        c.restore();
      }

      // Bottom Selected Detail Strip (Exact Design 07 bottom bar)
      const selCake = CATCAKES[selectedTier - 1] || CATCAKES[0];
      const selUnlocked = isLevelUnlocked(selCake.unlockLevel, saveData.levelStars).unlocked;
      const selLv = clamp(Math.floor(Number(saveData.catcakeLevels && saveData.catcakeLevels[selCake.tier]) || 0), 0, 4);
      const selPrice = getCatcakePrice(selCake.tier, selLv);
      const detY = bodyY + gridWrapH + 8;

      UI.drawKissaCard(c, f.ix, detY, f.iw, detailH, {
        tone: 'recess',
        borderColor: '#C5A982',
        radius: 11,
        lineWidth: 1.8
      });
      UI.drawTagBadge(c, f.ix + 10, detY + 8, 30, 18, selCake.id, 'wood', 9.8);
      UI.drawFitText(
        c,
        selUnlocked
          ? `${selCake.name} · 基础分 ${selPrice}${selLv > 0 ? ' (Lv.' + selLv + ')' : ''}`
          : `${selCake.name} · 未解锁`,
        f.ix + 46,
        detY + 17,
        f.iw - 56,
        12.4,
        9.4,
        900,
        '#5A3928',
        'left',
        'middle'
      );
      UI.drawFitText(
        c,
        selUnlocked
          ? selCake.desc
          : `推进至第 ${selCake.unlockLevel} 关即可解锁烘焙该阶猫饼。`,
        f.ix + 12,
        detY + 41,
        f.iw - 24,
        10.0,
        8.0,
        700,
        '#754C36',
        'left',
        'middle'
      );
      return;
    }

    // --- Tab 2: 24 道套餐配方 (3-col Scrollable Grid + Warm Scrollbar) ---
    const cols = 3;
    const rows = Math.max(1, Math.ceil(RECIPE_LIST.length / cols));
    const gx = 6;
    const gy = 6;
    const rowH = 64;
    const { scrollY, maxScroll, contentH } = setupListScroll(app, f.ix, f.iw, bodyY, bodyH, rows, rowH, gy);
    const gridW = f.iw - (maxScroll > 0 ? 10 : 0);
    const cw = Math.floor((gridW - gx * (cols - 1)) / cols);

    c.save();
    try {
      c.beginPath();
      c.rect(f.ix - 2, bodyY, f.iw + 4, bodyH);
      c.clip();
      c.globalAlpha *= anim.tabAlpha;
      c.translate(0, -scrollY + anim.tabOffsetY);

      for (let i = 0; i < RECIPE_LIST.length; i++) {
        const r = RECIPE_LIST[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = f.ix + col * (cw + gx);
        const cy = bodyY + row * (rowH + gy);
        if (cy + rowH < bodyY + scrollY - 8 || cy > bodyY + scrollY + bodyH + 8) continue;

        const unlocked = isLevelUnlocked(r.unlockLevel, saveData.levelStars).unlocked;
        UI.drawKissaCard(c, cx, cy, cw, rowH, {
          tone: 'cream',
          locked: !unlocked,
          radius: 9,
          lineWidth: 1.8
        });

        UI.drawFitText(
          c,
          r.name,
          cx + cw * 0.5,
          cy + 11,
          cw - 8,
          9.4,
          7.4,
          900,
          unlocked ? '#5A3928' : '#70655B',
          'center',
          'middle'
        );

        const slotCnt = r.slots.length;
        const iconS = Math.min(20, Math.max(15, Math.floor((cw - 14) / Math.max(2, slotCnt))));
        const stepX = iconS + 3;
        const startX = cx + cw * 0.5 - ((slotCnt - 1) * stepX) * 0.5;
        const iconY = cy + 33;

        for (let s = 0; s < slotCnt; s++) {
          const sl = r.slots[s];
          UI.drawCatcakeSprite(c, sprites, sl.tier, startX + s * stepX, iconY, iconS, {
            flavor: sl.flavor !== 'any' ? sl.flavor : 'plain',
            showFlavorBadge: sl.flavor !== 'any',
            alpha: unlocked ? 1 : 0.6
          });
        }

        UI.drawFitText(
          c,
          `×${r.comboMult.toFixed(2)} · ${r.baseScoreLv0}分`,
          cx + cw * 0.5,
          cy + rowH - 10,
          cw - 6,
          8.6,
          7.0,
          800,
          '#8A5220',
          'center',
          'middle'
        );
      }
    } finally {
      c.restore();
    }

    if (maxScroll > 0) {
      UI.drawScrollBar(c, f.ix + f.iw - 6, bodyY + 2, 5, bodyH - 4, scrollY / maxScroll, bodyH / Math.max(bodyH, contentH));
    }
  } finally {
    endModalFrame(c);
  }
}

/* ======================== 08. 猫饼排行榜弹窗 (LeaderboardModal) ======================== */

function renderLeaderboardModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const profile = (saveData && saveData.playerProfile) || {};
  const boardType =
    app.leaderboardBoardType === 'score'
      ? 'score'
      : app.leaderboardBoardType === 'friends'
      ? 'friends'
      : 'stars';

  const f = beginModalFrame(c, metrics, app, {
    maxW: 452,
    desiredH: 576,
    dismissOnOutside: true,
    title: '猫饼排行榜',
    sheetTopInset: 66,
    sheetBottomPad: 12
  });

  try {
    drawCloseButton(c, f, hits, app);

    // 3 Folder Tabs: 全服总星榜 (default) | 累计营业榜 | 微信好友榜 (正在开发中)
    const tabY = f.sheetY - 27;
    const tabH = 29;
    drawFolderTabs(
      c,
      f.sheetX + 6,
      tabY,
      f.sheetW - 12,
      tabH,
      [
        { id: 'stars', hitId: 'leaderboard_tab_stars', label: '全服总星榜' },
        { id: 'score', hitId: 'leaderboard_tab_score', label: '累计营业榜' },
        { id: 'friends', hitId: 'leaderboard_tab_friends', label: '微信好友榜' }
      ],
      boardType,
      hits,
      app,
      (tabId) => app.setLeaderboardBoardType(tabId),
      { fontSize: 11.4 }
    );

    // Compact Chef Identity & WeChat Auth Strip (preserves leaderboard_avatar_btn & leaderboard_auth_btn!)
    const profY = f.sheetY + 8;
    const profH = 42;
    UI.drawKissaCard(c, f.ix, profY, f.iw, profH, {
      tone: 'recess',
      borderColor: '#C9AE86',
      radius: 11,
      lineWidth: 1.6
    });

    const avPreset = normalizePatronId(profile.avatarPreset || saveData.selectedPatron);
    const avS = 32;
    const avX = f.ix + 6;
    const avY = profY + 5;
    UI.drawPillButton(c, avX, avY, avS, avS, {
      variant: 'card',
      icon: avPreset,
      sprites,
      iconSize: 24,
      radius: 16,
      pressed: isPressed(app, 'leaderboard_avatar_btn')
    });
    hits.add('leaderboard_avatar_btn', avX, avY, avS, avS, () => app.cycleProfileAvatar());

    const authW = 88;
    const authH = 26;
    const authX = f.ix + f.iw - 6 - authW;
    const authY = Math.round(profY + (profH - authH) * 0.5);
    UI.drawPillButton(c, authX, authY, authW, authH, {
      variant: profile.authorized ? 'equipped' : 'wood',
      label: profile.authorized ? '已同步名片' : '授权头像昵称',
      fontSize: 9.8,
      radius: 10,
      pressed: isPressed(app, 'leaderboard_auth_btn')
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
    UI.drawFitText(c, dispName, infoX, profY + 15, infoW, 11.8, 9.2, 900, '#5A3928', 'left', 'middle');
    UI.drawUiIcon(
      c,
      sprites,
      app.cloudStatus === 'synced' ? 'icon_cloud_sync' : 'icon_star_coin',
      infoX + 6,
      profY + 31,
      12
    );
    UI.drawFitText(
      c,
      `${getChefRank(saveData)} · ${syncLabel}`,
      infoX + 15,
      profY + 31,
      infoW - 15,
      9.2,
      7.6,
      700,
      '#754C36',
      'left',
      'middle'
    );

    // Pinned Golden Self Row Footer (Exact Design 08 golden bottom bar!)
    const footerH = 48;
    const footerY = f.sheetY + f.sheetH - footerH - 8;
    const listY = profY + profH + 7;
    const listH = Math.max(120, footerY - 7 - listY);
    const anim = f.anim;

    const lb = app.leaderboardData || { list: [], myRank: null };

    if (boardType === 'friends') {
      // User Decision #2: 微信好友榜 shows clean "正在开发中" placeholder card
      c.save();
      try {
        c.globalAlpha *= anim.tabAlpha;
        c.translate(0, anim.tabOffsetY);

        UI.drawKissaCard(c, f.ix, listY, f.iw, listH, {
          tone: 'cream',
          borderColor: '#C9AE86',
          radius: 13,
          lineWidth: 2.0
        });
        const midX = f.ix + f.iw * 0.5;
        const midY = listY + listH * 0.5;
        UI.drawUiIcon(c, sprites, 'patron_mikan', midX - 24, midY - 34, 58);
        UI.drawUiIcon(c, sprites, 'icon_cloud_sync', midX + 26, midY - 30, 36);
        UI.drawTagBadge(c, midX - 44, midY + 4, 88, 22, '功能筹备中', 'amber', 10.6);
        UI.drawFitText(
          c,
          '微信好友榜正在开发中',
          midX,
          midY + 38,
          f.iw - 28,
          15.5,
          12.0,
          900,
          '#5A3928',
          'center',
          'middle'
        );
        UI.drawWrappedText(
          c,
          '开放数据域好友榜单即将上线！当前可先在「全服总星榜」与「累计营业榜」中冲榜角逐星夜烘焙大师。',
          midX,
          midY + 56,
          f.iw - 44,
          16,
          UI.fontStr(10.6, 700),
          '#754C36',
          'center',
          3
        );
      } finally {
        c.restore();
      }
    } else {
      // Full Design 08 Leaderboard Rows with Gold / Silver / Bronze Medals & Row Fills!
      const rows = Array.isArray(lb.list) ? lb.list : [];
      const rowH = 50;
      const rowGap = 6;
      const { scrollY, maxScroll, contentH } = setupListScroll(app, f.ix, f.iw, listY, listH, rows.length, rowH, rowGap);
      const listW = f.iw - (maxScroll > 0 ? 10 : 0);

      // Decorative fallback avatars for diverse leaderboard entries
      const avatarRing = ['patron_mikan', 'cust_lop_bunny', 'cust_shiba', 'cust_fox', 'cust_ragdoll', 'patron_luna', 'patron_mugi'];

      c.save();
      try {
        c.beginPath();
        c.rect(f.ix - 2, listY, f.iw + 4, listH);
        c.clip();
        c.globalAlpha *= anim.tabAlpha;
        c.translate(0, -scrollY + anim.tabOffsetY);

        if (rows.length === 0) {
          UI.drawFitText(
            c,
            app.leaderboardLoading ? '正在读取榜单数据...' : '暂无排行记录，通关后自动上榜',
            f.ix + f.iw * 0.5,
            listY + listH * 0.5,
            f.iw - 20,
            12.0,
            9.5,
            700,
            '#754C36',
            'center',
            'middle'
          );
        }

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const ry = listY + i * (rowH + rowGap);
          if (ry + rowH < listY + scrollY - 8 || ry > listY + scrollY + listH + 8) continue;

          const rank = r.rank || i + 1;
          const rowTone =
            rank === 1
              ? 'goldRow'
              : rank === 2
              ? 'silverRow'
              : rank === 3
              ? 'bronzeRow'
              : r.isMe
              ? 'selected'
              : 'cream';
          UI.drawKissaCard(c, f.ix, ry, listW, rowH, {
            tone: rowTone,
            radius: 12,
            lineWidth: 2.1
          });

          // Rank Medal (1/2/3 WebP) or Bold Rank Number
          const rankCx = f.ix + 22;
          if (rank === 1 || rank === 2 || rank === 3) {
            const medalKey = rank === 1 ? 'medal_gold' : rank === 2 ? 'medal_silver' : 'medal_bronze';
            UI.drawUiIcon(c, sprites, medalKey, rankCx, ry + rowH * 0.5, 32);
          } else {
            UI.drawFitText(c, String(rank), rankCx, ry + rowH * 0.5 + 0.5, 30, 15.5, 11.0, 900, '#5A3928', 'center', 'middle');
          }

          // Portrait Avatar in soft circular frame
          const avCx = f.ix + 58;
          const avCy = ry + rowH * 0.5;
          c.save();
          try {
            c.beginPath();
            c.arc(avCx, avCy, 17, 0, Math.PI * 2);
            c.fillStyle = '#FFF8EC';
            c.fill();
            c.lineWidth = 1.8;
            c.strokeStyle = '#5A3928';
            c.stroke();
          } finally {
            c.restore();
          }
          const avatarKey = r.avatarPreset
            ? normalizePatronId(r.avatarPreset)
            : avatarRing[i % avatarRing.length];
          UI.drawUiIcon(c, sprites, avatarKey, avCx, avCy, 28);

          const rStars = Math.max(0, Math.floor(Number(r.totalStars) || 0));
          const rScore = Math.max(0, Math.floor(Number(r.totalCumulativeScore) || 0));

          const valColW = 84;
          const nameX = f.ix + 82;
          const nameW = Math.max(60, f.ix + listW - valColW - 10 - nameX);
          const tagSuffix = r.isMe ? '（我）' : '';

          UI.drawFitText(
            c,
            `${r.nickName || '星夜店长'}${tagSuffix}`,
            nameX,
            ry + rowH * 0.34,
            nameW,
            12.8,
            9.6,
            900,
            '#5A3928',
            'left',
            'middle'
          );
          UI.drawStarIcon(c, nameX + 6, ry + rowH * 0.70, 5.8, true, sprites);
          UI.drawFitText(
            c,
            `${rStars}/90`,
            nameX + 16,
            ry + rowH * 0.71,
            nameW - 18,
            10.8,
            8.6,
            800,
            '#754C36',
            'left',
            'middle'
          );

          // Right bold numeric value (emphasizing primary metric while keeping both clean)
          const rightVal = boardType === 'score' ? formatNum(rScore) : formatNum(rScore);
          UI.drawFitText(
            c,
            rightVal,
            f.ix + listW - 10,
            ry + rowH * 0.5 + 0.5,
            valColW,
            15.0,
            10.5,
            900,
            '#5A3928',
            'right',
            'middle'
          );
        }
      } finally {
        c.restore();
      }

      if (maxScroll > 0) {
        UI.drawScrollBar(c, f.ix + f.iw - 6, listY + 2, 5, listH - 4, scrollY / maxScroll, listH / Math.max(listH, contentH));
      }
    }

    // Pinned Golden Self Row Footer (Design 08)
    const myStars = computeTotalStars(saveData.levelStars);
    const myScore = (saveData.lifetimeStats && saveData.lifetimeStats.totalCumulativeScore) || 0;
    UI.drawKissaCard(c, f.ix, footerY, f.iw, footerH, {
      tone: 'myRankRow',
      radius: 12,
      lineWidth: 2.3
    });

    const myRankText = lb.myRank ? String(lb.myRank) : '--';
    UI.drawFitText(c, myRankText, f.ix + 22, footerY + footerH * 0.5, 32, 15.5, 11.0, 900, '#5A3928', 'center', 'middle');

    const myAvCx = f.ix + 58;
    const myAvCy = footerY + footerH * 0.5;
    c.save();
    try {
      c.beginPath();
      c.arc(myAvCx, myAvCy, 16.5, 0, Math.PI * 2);
      c.fillStyle = '#FFF8EC';
      c.fill();
      c.lineWidth = 1.8;
      c.strokeStyle = '#5A3928';
      c.stroke();
    } finally {
      c.restore();
    }
    UI.drawUiIcon(c, sprites, avPreset, myAvCx, myAvCy, 27);

    const myNameX = f.ix + 82;
    const myNameW = Math.max(60, f.iw - 172);
    UI.drawFitText(c, `我 (${dispName})`, myNameX, footerY + footerH * 0.34, myNameW, 12.6, 9.4, 900, '#5A3928', 'left', 'middle');
    UI.drawStarIcon(c, myNameX + 6, footerY + footerH * 0.70, 5.8, true, sprites);
    UI.drawFitText(c, `${myStars}/90`, myNameX + 16, footerY + footerH * 0.71, myNameW - 18, 10.8, 8.6, 800, '#5A3928', 'left', 'middle');

    UI.drawFitText(
      c,
      formatNum(myScore),
      f.ix + f.iw - 10,
      footerY + footerH * 0.5 + 0.5,
      82,
      15.2,
      10.8,
      900,
      '#5A3928',
      'right',
      'middle'
    );
  } finally {
    endModalFrame(c);
  }
}

/* ======================== 10. 局内暂停弹窗 (PauseModal) ======================== */

function renderPauseModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const orderState = app.orderState || {};
  const lvl = getLevelById(app.currentLevelId || orderState.levelId || '1-1') || getLevelById('1-1');
  const chapName = getChapterName(lvl.chapter);

  const f = beginModalFrame(c, metrics, app, {
    maxW: 392,
    desiredH: 468,
    dismissOnOutside: false,
    title: '营业暂停',
    subtitle: `第 ${lvl.id} 关 · ${chapName}`,
    sheetTopInset: 38,
    sheetBottomPad: 12
  });

  try {
    drawCloseButton(c, f, hits, app);

    const compact = f.ih < 365;
    // Live shift progress micro-strip
    const statusY = f.iy + 6;
    const statusH = 22;
    UI.drawFitText(
      c,
      `剩余 ${formatClockMMSS(orderState.timeLeft || 0)} · 营业分 ${formatNum(orderState.score || 0)} / 1星 ${formatNum(lvl.stars[0])}`,
      f.ix + f.iw * 0.5,
      statusY + statusH * 0.5,
      f.iw - 8,
      10.4,
      8.4,
      800,
      '#754C36',
      'center',
      'middle'
    );

    // Inner Cream Audio Switch Card (Exact Design 10!)
    const cardY = statusY + statusH + 6;
    const cardH = compact ? 92 : 108;
    UI.drawKissaCard(c, f.ix, cardY, f.iw, cardH, {
      tone: 'recess',
      topCol: '#FBF1DD',
      botCol: '#F2E2C4',
      borderColor: '#C5A982',
      radius: 14,
      lineWidth: 1.8
    });

    const trackInfo =
      app.audio && typeof app.audio.getTrackInfo === 'function'
        ? app.audio.getTrackInfo()
        : { key: 'waltz', label: '圆舞曲' };
    const bgmOn = trackInfo.key !== 'off';
    const sfxOn = app.audio ? Boolean(app.audio.sfxEnabled) : true;
    const bgmPos = app.uiAnim && Number.isFinite(app.uiAnim.bgmSwitchPos) ? app.uiAnim.bgmSwitchPos : bgmOn ? 1 : 0;
    const sfxPos = app.uiAnim && Number.isFinite(app.uiAnim.sfxSwitchPos) ? app.uiAnim.sfxSwitchPos : sfxOn ? 1 : 0;

    const swW = 72;
    const swH = 30;
    const swX = f.ix + f.iw - 14 - swW;
    const row1Cy = cardY + cardH * 0.27;
    const row2Cy = cardY + cardH * 0.73;

    // Horizontal hairline divider between BGM & SFX rows
    c.save();
    try {
      c.strokeStyle = 'rgba(138, 86, 52, 0.24)';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(f.ix + 14, cardY + cardH * 0.5);
      c.lineTo(f.ix + f.iw - 14, cardY + cardH * 0.5);
      c.stroke();
    } finally {
      c.restore();
    }

    // Row 1: 背景音乐
    UI.drawUiIcon(c, sprites, 'icon_music', f.ix + 28, row1Cy, 24);
    UI.drawFitText(
      c,
      bgmOn ? `背景音乐 (${trackInfo.label || '开'})` : '背景音乐 (静音)',
      f.ix + 48,
      row1Cy + 0.5,
      swX - (f.ix + 54),
      13.6,
      10.0,
      900,
      '#5A3928',
      'left',
      'middle'
    );
    UI.drawSwitchToggle(c, swX, Math.round(row1Cy - swH * 0.5), swW, swH, bgmOn, bgmPos);
    hits.add('pause_bgm_btn', swX - 4, Math.round(row1Cy - swH * 0.5) - 2, swW + 8, swH + 4, () => app.cycleBgm());

    // Row 2: 游戏音效
    UI.drawUiIcon(c, sprites, 'icon_sfx', f.ix + 28, row2Cy, 24);
    UI.drawFitText(
      c,
      '游戏音效',
      f.ix + 48,
      row2Cy + 0.5,
      swX - (f.ix + 54),
      13.6,
      10.2,
      900,
      '#5A3928',
      'left',
      'middle'
    );
    UI.drawSwitchToggle(c, swX, Math.round(row2Cy - swH * 0.5), swW, swH, sfxOn, sfxPos);
    hits.add('pause_sfx_btn', swX - 4, Math.round(row2Cy - swH * 0.5) - 2, swW + 8, swH + 4, () => app.toggleSfx());

    // 3 Large Stacked 3D Buttons (Exact Design 10 Hierarchy!)
    const secH = compact ? 30 : 32;
    const secY = f.iy + f.ih - secH;
    const stackTop = cardY + cardH + (compact ? 10 : 14);
    const stackAvail = Math.max(120, secY - 10 - stackTop);
    const btnGap = compact ? 8 : 10;
    const btnH = clamp(Math.floor((stackAvail - btnGap * 2) / 3), 36, 46);
    const btnW = Math.min(234, f.iw - 14);
    const btnX = Math.round(f.ix + (f.iw - btnW) * 0.5);

    const b1Y = stackTop;
    UI.drawPillButton(c, btnX, b1Y, btnW, btnH, {
      variant: 'primary',
      label: '继续营业',
      fontSize: 16.5,
      radius: btnH * 0.5,
      pressed: isPressed(app, 'pause_resume_btn')
    });
    hits.add('pause_resume_btn', btnX, b1Y, btnW, btnH, () => app.closeModal());

    const b2Y = b1Y + btnH + btnGap;
    UI.drawPillButton(c, btnX, b2Y, btnW, btnH, {
      variant: 'wood',
      woodGrain: true,
      label: '重新开始',
      fontSize: 16.0,
      radius: btnH * 0.5,
      pressed: isPressed(app, 'pause_restart_btn')
    });
    hits.add('pause_restart_btn', btnX, b2Y, btnW, btnH, () => app.startLevel(lvl.id));

    const b3Y = b2Y + btnH + btnGap;
    UI.drawPillButton(c, btnX, b3Y, btnW, btnH, {
      variant: 'dark',
      label: '返回大厅',
      fontSize: 16.0,
      radius: btnH * 0.5,
      pressed: isPressed(app, 'pause_lobby_btn')
    });
    hits.add('pause_lobby_btn', btnX, b3Y, btnW, btnH, () => app.onPauseReturnLobby());

    // Compact secondary utility row preserving pause_help_btn & pause_compendium_btn
    const secGap = 10;
    const secW = Math.floor((btnW - secGap) / 2);
    UI.drawPillButton(c, btnX, secY, secW, secH, {
      variant: 'card',
      icon: 'icon_help',
      sprites,
      iconSize: 14,
      label: '玩法说明',
      fontSize: 11.0,
      radius: 12,
      pressed: isPressed(app, 'pause_help_btn')
    });
    hits.add('pause_help_btn', btnX, secY, secW, secH, () => app.openModal('help'));

    UI.drawPillButton(c, btnX + secW + secGap, secY, secW, secH, {
      variant: 'card',
      icon: 'icon_book',
      sprites,
      iconSize: 14,
      label: '星夜图鉴',
      fontSize: 11.0,
      radius: 12,
      pressed: isPressed(app, 'pause_compendium_btn')
    });
    hits.add('pause_compendium_btn', btnX + secW + secGap, secY, secW, secH, () => app.openCompendium('recipes'));
  } finally {
    endModalFrame(c);
  }
}

/* ======================== 11. 玩法说明弹窗 (HelpModal) ======================== */

function drawHelpIllustration(ctx, sprites, stepIdx, x, y, size) {
  const c = getSafeCtx(ctx);
  UI.drawKissaCard(c, x, y, size, size, {
    tone: 'recess',
    borderColor: '#D6BE99',
    radius: 10,
    lineWidth: 1.5
  });

  const cx = x + size * 0.5;
  const cy = y + size * 0.5;
  if (stepIdx === 0) {
    // 1. Merge C1 + C1 -> C2 diagram (exact Design 11 card 1!)
    const s = Math.round(size * 0.36);
    UI.drawCatcakeSprite(c, sprites, 1, x + size * 0.28, y + size * 0.30, s);
    UI.drawCatcakeSprite(c, sprites, 1, x + size * 0.28, y + size * 0.72, s);
    UI.drawCatcakeSprite(c, sprites, 2, x + size * 0.74, cy, Math.round(size * 0.40));
    c.save();
    try {
      c.strokeStyle = '#754C36';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x + size * 0.45, y + size * 0.35);
      c.lineTo(x + size * 0.54, cy - 3);
      c.moveTo(x + size * 0.45, y + size * 0.67);
      c.lineTo(x + size * 0.54, cy + 3);
      c.stroke();
    } finally {
      c.restore();
    }
    return;
  }

  if (stepIdx === 1) {
    // 2. Dough knead icon (Design 11 card 2)
    UI.drawUiIcon(c, sprites, 'knead_dough', cx, cy, size * 0.78);
    return;
  }

  if (stepIdx === 2) {
    // 3. Glowing servable catcake on serving plate (Design 11 card 3)
    UI.drawUiIcon(c, sprites, 'serving_plate', cx, cy + size * 0.14, size * 0.76);
    UI.drawCatcakeSprite(c, sprites, 1, cx, cy - size * 0.04, size * 0.52, { servable: true, happy: true });
    return;
  }

  // 4. Fever & Combo badge using our generated icon_fever_badge.webp (Design 11 card 4)
  UI.drawUiIcon(c, sprites, 'icon_fever_badge', cx, cy - size * 0.08, size * 0.62);
  UI.drawTagBadge(c, x + 5, y + size - 19, size - 10, 15, '星光热潮', 'purple', 8.0);
}

function renderHelpModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};

  const f = beginModalFrame(c, metrics, app, {
    maxW: 438,
    desiredH: 546,
    dismissOnOutside: true,
    title: '玩法说明',
    sheetTopInset: 34,
    sheetBottomPad: 32
  });

  try {
    drawCloseButton(c, f, hits, app);

    const cards = [
      {
        title: '1. 滑动搓猫饼',
        body: '上下左右滑动烤盘，合并相同猫饼升阶；停在抹茶/草莓/镀金格可染上专属风味！'
      },
      {
        title: '2. 揉面补料与厨具',
        body: '点击揉面补料随时往烤盘补充新猫饼；移位叉可跨障挪移破冰，升阶勺直升一阶。'
      },
      {
        title: '3. 装盘点客上菜',
        body: '单击发光猫饼装盘，凑齐后点发光顾客上菜！双击托盘可丢入8秒冷却厨余篮（0扣分）。'
      },
      {
        title: '4. 连击与星光热潮',
        body: '8秒内连续上菜叠最高1.28倍连击，攒满星光热潮享1.25倍全场加分！'
      }
    ];

    const bodyY = f.sheetY + 18;
    const bodyH = Math.max(220, f.sheetY + f.sheetH - 10 - bodyY);
    const gap = 8;
    const ch = Math.floor((bodyH - gap * (cards.length - 1)) / cards.length);

    for (let i = 0; i < cards.length; i++) {
      const it = cards[i];
      const cy = bodyY + i * (ch + gap);
      UI.drawKissaCard(c, f.ix, cy, f.iw, ch, {
        tone: 'cream',
        borderColor: '#5A3928',
        radius: 13,
        lineWidth: 2.2
      });

      const illuS = Math.min(62, ch - 14);
      const illuX = f.ix + 8;
      const illuY = Math.round(cy + (ch - illuS) * 0.5);
      drawHelpIllustration(c, sprites, i, illuX, illuY, illuS);

      const tx = illuX + illuS + 10;
      const tw = Math.max(80, f.ix + f.iw - 10 - tx);
      UI.drawFitText(c, it.title, tx, cy + Math.round(ch * 0.28), tw, 13.8, 10.2, 900, '#5A3928', 'left', 'middle');
      UI.drawWrappedText(
        c,
        it.body,
        tx,
        cy + Math.round(ch * 0.45),
        tw,
        14.2,
        UI.fontStr(10.0, 700),
        '#754C36',
        'left',
        3
      );
    }

    // Bottom Honey-Gold 3D "我知道了" Button overlapping bottom border (Design 11)
    const okW = Math.min(188, f.iw - 24);
    const okH = 44;
    const okX = Math.round(f.cardX + (f.cardW - okW) * 0.5);
    const okY = Math.min(f.botBound - okH - 2, f.cardY + f.cardH - Math.round(okH * 0.56));
    UI.drawPillButton(c, okX, okY, okW, okH, {
      variant: 'knead',
      textOutline: true,
      glossDot: true,
      label: '我知道了',
      fontSize: 17.0,
      radius: okH * 0.5,
      pressed: isPressed(app, 'help_ok_btn')
    });
    hits.add('help_ok_btn', okX, okY, okW, okH, () => app.closeModal());
  } finally {
    endModalFrame(c);
  }
}

/* ======================== 操作确认弹窗 (ConfirmModal) ======================== */

function renderConfirmModal(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const cfg = app.confirmDialog || {
    title: '操作确认',
    message: '确认执行该操作吗？',
    confirmText: '确认',
    cancelText: '取消'
  };

  const f = beginModalFrame(c, metrics, app, {
    maxW: 380,
    desiredH: 236,
    dismissOnOutside: false,
    title: cfg.title || '操作确认',
    sheetTopInset: 30,
    sheetBottomPad: 12
  });

  try {
    drawCloseButton(c, f, hits, app, () => app.confirmCancel());

    UI.drawWrappedText(
      c,
      cfg.message || '确认放弃当前营业进度并返回选关大厅吗？',
      f.ix + f.iw * 0.5,
      f.iy + 16,
      f.iw - 16,
      19,
      UI.fontStr(12.2, 800),
      '#5A3928',
      'center',
      4
    );

    const btnH = 40;
    const btnY = f.iy + f.ih - btnH;
    const gap = 10;
    const bw = Math.floor((f.iw - gap) / 2);

    UI.drawPillButton(c, f.ix, btnY, bw, btnH, {
      variant: 'wood',
      label: cfg.cancelText || '取消',
      fontSize: 13.5,
      radius: btnH * 0.5,
      pressed: isPressed(app, 'confirm_cancel')
    });
    hits.add('confirm_cancel', f.ix, btnY, bw, btnH, () => app.confirmCancel());

    UI.drawPillButton(c, f.ix + bw + gap, btnY, bw, btnH, {
      variant: 'primary',
      label: cfg.confirmText || '确认',
      fontSize: 13.5,
      radius: btnH * 0.5,
      pressed: isPressed(app, 'confirm_accept')
    });
    hits.add('confirm_accept', f.ix + bw + gap, btnY, bw, btnH, () => app.confirmAccept());
  } finally {
    endModalFrame(c);
  }
}

/* ======================== Modal Dispatcher ======================== */

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

/* ======================== 6-Step Non-Blocking Spotlight Tutorial ======================== */

function collectTutorialSpotlights(step, app, hits) {
  const rects = [];
  const gt = (app && app.guideTargets) || {};

  if (step.id === 'intro_slide_3' && app && app.orderState && Array.isArray(app.orderState.seats)) {
    const readySeatIds = [];
    for (let i = 0; i < app.orderState.seats.length; i++) {
      const s = app.orderState.seats[i];
      if (s && s.readyToServe) readySeatIds.push(`seat_${i}`);
    }
    if (readySeatIds.length > 0 && hits && Array.isArray(hits.items)) {
      for (let i = 0; i < readySeatIds.length; i++) {
        const targetId = readySeatIds[i];
        for (let k = 0; k < hits.items.length; k++) {
          const hItem = hits.items[k];
          if (hItem && hItem.id === targetId) {
            rects.push({ x: hItem.x, y: hItem.y, w: hItem.w, h: hItem.h });
          }
        }
      }
      if (rects.length > 0) return rects;
    }
  }

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

  const hasReadySeat =
    step.id === 'intro_slide_3' &&
    app.orderState &&
    Array.isArray(app.orderState.seats) &&
    app.orderState.seats.some((s) => s && s.readyToServe);
  const displayTitle = hasReadySeat ? '点击发光顾客上菜' : step.title || '';
  const displayText = hasReadySeat
    ? '订单已凑齐！点击上方发光顾客，即可端上猫饼得分！'
    : step.text || '';

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
    c.fillStyle = 'rgba(18, 22, 42, 0.46)';
    try {
      c.fill('evenodd');
    } catch (_) {
      // Fallback when evenodd rule unsupported
    }

    for (let i = 0; i < spotlights.length; i++) {
      const sp = spotlights[i];
      c.strokeStyle = `rgba(255, 222, 112, ${(0.76 + 0.24 * pulse).toFixed(3)})`;
      c.lineWidth = 3.0;
      UI.roundRectPath(c, sp.x - 4, sp.y - 4, sp.w + 8, sp.h + 8, 10);
      c.stroke();
    }
  } finally {
    c.restore();
  }

  // Animated v0.9.0 golden paw guide cue on primary spotlight
  if (spotlights.length > 0) {
    const p0 = spotlights[0];
    const isSlide = step.id === 'intro_slide_1';
    const dx = isSlide ? Math.sin(nowSec * 4.2) * 18 : 0;
    const dy = isSlide ? 0 : Math.sin(nowSec * 5.5) * 4;
    UI.drawUiIcon(
      c,
      app.sprites || {},
      'icon_paw_marker',
      p0.x + p0.w * 0.5 + dx,
      p0.y + p0.h * 0.5 + dy + 10,
      26
    );
  }

  // Floating non-blocking v0.9.0 storybook instruction card
  const cardW = Math.min(352, width - 24);
  const cardH = 84;
  const cardX = Math.round((width - cardW) * 0.5);
  const cardY = chooseGuideCardY(topBound, botBound, cardH, spotlights);

  UI.drawWoodBoard(c, cardX, cardY, cardW, cardH, 14, false);
  UI.drawParchmentSheet(c, cardX + 5, cardY + 5, cardW - 10, cardH - 10, 10);

  UI.drawTagBadge(c, cardX + 12, cardY + 11, 82, 19, step.tag || '新手引导', 'amber', 9.0);
  UI.drawFitText(
    c,
    displayTitle,
    cardX + 100,
    cardY + 20.5,
    cardW - 166,
    12.0,
    9.5,
    900,
    '#5A3928',
    'left',
    'middle'
  );

  const skipW = 50;
  const skipH = 22;
  const skipX = cardX + cardW - 12 - skipW;
  const skipY = cardY + 10;
  UI.drawPillButton(c, skipX, skipY, skipW, skipH, {
    variant: 'card',
    label: '跳过',
    fontSize: 9.4,
    radius: 8
  });
  app.tutorialSkipRect = { x: skipX, y: skipY, w: skipW, h: skipH };

  UI.drawWrappedText(
    c,
    displayText,
    cardX + 14,
    cardY + 37,
    cardW - 28,
    15,
    UI.fontStr(10.0, 700),
    '#5A3928',
    'left',
    2
  );
}

module.exports = {
  renderActiveModal,
  renderTutorialOverlay
};
