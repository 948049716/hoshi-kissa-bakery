/**
 * Canvas 2D Layout Computer & Screen Renderers (Backdrop, 3-Chapter Winding Campaign Lobby & 4-Band / 3-Col Gameplay HUD)
 * for Hoshi Kissa Bakery v2.0 (WeChat Mini Game Edition).
 *
 * Strictly enforces:
 * - Zero HSL color strings (strictly hex/rgb/rgba for iOS WeChat Canvas safety)
 * - Zero native Unicode emoji / star / dingbat characters (100% atlas & vector icons)
 * - Strict WeChat capsule clearance (right <= menuRect.left - 8) & safeBottom clearance
 * - Zero pairwise HitRegistry overlaps across 375x667, 390x844, and 1280x760
 * - Pure Node.js stub-canvas (ctx === null) geometry & HitRegistry parity
 */
'use strict';

const {
  GAME_TITLE,
  PATRONS,
  TOOLS,
  BOARD_THEMES,
  normalizePatronId,
  getChefRank
} = require('./constants');
const {
  CHAPTERS,
  getLevelById,
  computeTotalStars,
  isChapterUnlocked,
  isLevelUnlocked
} = require('./levels_data');
const UI = require('./ui_draw');
const BoardRenderer = require('./board_renderer');

const NOOP_GRADIENT = Object.freeze({
  addColorStop() {}
});

function estimateFontPx(fontStr) {
  if (typeof fontStr !== 'string') return 12;
  const m = /(\d+(?:\.\d+)?)px/.exec(fontStr);
  return m ? Math.max(6, Number(m[1])) : 12;
}

function estimateTextWidth(text, fontStr) {
  const s = String(text === null || text === undefined ? '' : text);
  const px = estimateFontPx(fontStr);
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    total += code > 255 ? px : px * 0.56;
  }
  return total;
}

const NOOP_CTX = {
  font: '700 12px sans-serif',
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  globalAlpha: 1,
  textAlign: 'left',
  textBaseline: 'alphabetic',
  lineJoin: 'miter',
  lineCap: 'butt',
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  save() {},
  restore() {},
  beginPath() {},
  closePath() {},
  moveTo() {},
  lineTo() {},
  arc() {},
  arcTo() {},
  ellipse() {},
  quadraticCurveTo() {},
  bezierCurveTo() {},
  rect() {},
  roundRect() {},
  clip() {},
  fill() {},
  stroke() {},
  fillRect() {},
  strokeRect() {},
  clearRect() {},
  translate() {},
  rotate() {},
  scale() {},
  setTransform() {},
  setLineDash() {},
  drawImage() {},
  fillText() {},
  strokeText() {},
  measureText(txt) {
    return { width: estimateTextWidth(txt, this.font) };
  },
  createLinearGradient() {
    return NOOP_GRADIENT;
  },
  createRadialGradient() {
    return NOOP_GRADIENT;
  }
};

function isUsableCanvasCtx(ctx) {
  try {
    return Boolean(
      ctx &&
        typeof ctx === 'object' &&
        typeof ctx.save === 'function' &&
        typeof ctx.restore === 'function' &&
        typeof ctx.beginPath === 'function' &&
        typeof ctx.closePath === 'function' &&
        typeof ctx.moveTo === 'function' &&
        typeof ctx.lineTo === 'function' &&
        typeof ctx.arc === 'function' &&
        typeof ctx.fill === 'function' &&
        typeof ctx.stroke === 'function' &&
        typeof ctx.translate === 'function' &&
        typeof ctx.rotate === 'function' &&
        typeof ctx.scale === 'function'
    );
  } catch (_) {
    return false;
  }
}

function getSafeCtx(ctx) {
  return isUsableCanvasCtx(ctx) ? ctx : NOOP_CTX;
}

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

function computeTopHeaderGeometry(metrics) {
  const m = metrics && typeof metrics === 'object' ? metrics : {};
  const width = Math.max(320, Number(m.width) || 390);
  const height = Math.max(480, Number(m.height) || 844);
  const safeTop = Math.max(0, Number(m.safeTop) || 0);
  const safeBottom = Math.max(0, Number(m.safeBottom) || 0);
  const mr =
    m.menuRect &&
    typeof m.menuRect === 'object' &&
    Number.isFinite(m.menuRect.left) &&
    m.menuRect.left > 0
      ? m.menuRect
      : null;

  const topY = mr ? Math.max(4, Math.round(mr.top)) : Math.max(8, safeTop + 4);
  const headerH = mr ? Math.max(30, Math.round(mr.height || 32)) : 32;
  const headerBottom = mr
    ? Math.max(topY + headerH, Math.round(mr.bottom || topY + headerH))
    : topY + headerH;
  const maxRight = mr ? Math.min(width - 8, Math.floor(mr.left - 8)) : width - 10;
  const bottomLimit = height - Math.max(10, safeBottom + 8);

  return {
    width,
    height,
    safeTop,
    safeBottom,
    topY,
    headerH,
    headerBottom,
    maxRight,
    bottomLimit
  };
}

function drawRedDot(ctx, cx, cy, r = 5.2) {
  const c = getSafeCtx(ctx);
  c.save();
  try {
    c.fillStyle = '#E6483B';
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 1.5;
    c.strokeStyle = '#FFF9EC';
    c.stroke();
  } finally {
    c.restore();
  }
}

function drawLockIcon(ctx, cx, cy, size = 14, opts = {}) {
  const c = getSafeCtx(ctx);
  const s = Math.max(8, Number(size) || 14);
  const bodyW = s * 0.78;
  const bodyH = s * 0.58;
  const bx = cx - bodyW * 0.5;
  const by = cy - bodyH * 0.28;
  const shackleR = bodyW * 0.30;

  c.save();
  try {
    c.strokeStyle = (opts && opts.shackleColor) || '#5A3A28';
    c.lineWidth = Math.max(1.5, s * 0.13);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, by + 1, shackleR, Math.PI, 0, false);
    c.stroke();

    c.fillStyle = (opts && opts.bodyColor) || '#D59C3B';
    c.strokeStyle = (opts && opts.borderColor) || '#4A2C2A';
    c.lineWidth = Math.max(1.2, s * 0.10);
    UI.roundRectPath(c, bx, by, bodyW, bodyH, Math.max(2, s * 0.16));
    c.fill();
    c.stroke();

    c.fillStyle = '#4A2C2A';
    c.beginPath();
    c.arc(cx, by + bodyH * 0.45, Math.max(1.2, s * 0.09), 0, Math.PI * 2);
    c.fill();
  } finally {
    c.restore();
  }
}

function drawChevronIcon(ctx, cx, cy, size = 12, dir = 'left', color = '#4A2C2A') {
  const c = getSafeCtx(ctx);
  const half = Math.max(3, (Number(size) || 12) * 0.36);
  const sign = dir === 'left' ? -1 : 1;
  c.save();
  try {
    c.strokeStyle = color || '#4A2C2A';
    c.lineWidth = Math.max(2, (Number(size) || 12) * 0.19);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(cx - sign * half * 0.55, cy - half);
    c.lineTo(cx + sign * half * 0.65, cy);
    c.lineTo(cx - sign * half * 0.55, cy + half);
    c.stroke();
  } finally {
    c.restore();
  }
}

function drawSpeechBalloon(ctx, x, y, w, h, tailX, tailY) {
  const c = getSafeCtx(ctx);
  const r = 10;
  const baseTop = clamp(tailY - 5, y + 10, Math.max(y + 10, y + h - 18));

  c.save();
  try {
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#FFFEFB');
    g.addColorStop(1, '#F8EBD2');
    c.fillStyle = g;
    UI.roundRectPath(c, x, y, w, h, r);
    c.fill();

    c.beginPath();
    c.moveTo(x + 2, baseTop);
    c.lineTo(tailX, tailY);
    c.lineTo(x + 2, baseTop + 10);
    c.closePath();
    c.fill();

    c.lineWidth = 1.6;
    c.strokeStyle = '#8C5E32';
    UI.roundRectPath(c, x, y, w, h, r);
    c.stroke();
  } finally {
    c.restore();
  }
}

function renderBackdrop(ctx, w, h, dt, nowSec, gameState, theme, sprites, fireflies) {
  const c = getSafeCtx(ctx);
  const width = Math.max(320, Number(w) || 390);
  const height = Math.max(480, Number(h) || 844);
  const safeDt = clamp(Number(dt) || 0, 0, 0.1);
  const th = theme && typeof theme === 'object' ? theme : BOARD_THEMES.amber;
  const sp = sprites && typeof sprites === 'object' ? sprites : {};

  if (sp.bg) {
    UI.drawCoverImage(c, sp.bg, 0, 0, width, height, 0.5);
  } else {
    const g = c.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, '#162736');
    g.addColorStop(1, '#2D1C12');
    c.fillStyle = g;
    c.fillRect(0, 0, width, height);
  }

  c.save();
  try {
    c.fillStyle = th.stageTint || 'rgba(8, 13, 19, 0.42)';
    c.fillRect(0, 0, width, height);
  } finally {
    c.restore();
  }

  const isSakura = th.id === 'sakura';
  const ambientRgb = th.ambientRgb || '255, 232, 148';
  const list = Array.isArray(fireflies) ? fireflies : [];
  for (let i = 0; i < list.length; i++) {
    const f = list[i];
    if (!f || typeof f !== 'object') continue;
    f.x += (f.vx + (isSakura ? Math.sin(nowSec * 1.1 + f.phase) * 0.01 : 0)) * safeDt;
    f.y += (isSakura ? Math.abs(f.vy) * 1.35 : f.vy) * safeDt;
    if (f.y < -0.05) {
      f.y = 1.05;
      f.x = (f.x + 0.37) % 1;
    } else if (f.y > 1.05) {
      f.y = -0.05;
      f.x = (f.x + 0.61) % 1;
    }
    if (f.x < -0.05) f.x = 1.05;
    if (f.x > 1.05) f.x = -0.05;

    const glow = clamp(0.24 + 0.44 * (0.5 + 0.5 * Math.sin(nowSec * 2.2 + f.phase)), 0.05, 0.95);
    const px = f.x * width;
    const py = f.y * height;
    if (isSakura) {
      c.save();
      c.fillStyle = `rgba(${ambientRgb}, ${(glow * 0.85).toFixed(3)})`;
      UI.drawSakuraPetal(c, px, py, f.r * 1.9, nowSec * 1.2 + f.phase);
      c.restore();
    } else {
      c.save();
      const grad = c.createRadialGradient(px, py, 0, px, py, f.r * 3.4);
      grad.addColorStop(0, `rgba(${ambientRgb}, ${glow.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${ambientRgb}, 0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(px, py, f.r * 3.4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  const feverOn = Boolean(gameState && gameState.feverActive);
  if (feverOn) {
    const pulse = 0.55 + 0.45 * Math.sin(nowSec * 5.2);
    c.save();
    try {
      c.strokeStyle = `rgba(255, 212, 92, ${(0.26 + pulse * 0.18).toFixed(3)})`;
      c.lineWidth = 8;
      c.strokeRect(4, 4, width - 8, height - 8);
    } finally {
      c.restore();
    }
  }
}

function drawTitlePlaqueBanner(ctx, x, y, w, h, sprites, subtitle, totalStars) {
  const c = getSafeCtx(ctx);
  const sp = sprites || {};
  const cx = x + w * 0.5;

  let drewPlaque = false;
  const plaqueImg = sp.titlePlaque;
  if (plaqueImg && typeof plaqueImg === 'object') {
    const iw = Number(plaqueImg.naturalWidth || plaqueImg.width) || 0;
    const ih = Number(plaqueImg.naturalHeight || plaqueImg.height) || 0;
    if (iw > 0 && ih > 0 && typeof c.drawImage === 'function') {
      try {
        const sy = Math.round(ih * 0.12);
        const sh = Math.max(1, Math.round(ih * 0.76));
        c.drawImage(plaqueImg, 0, sy, iw, sh, x, y, w, h);
        drewPlaque = true;
      } catch (_) {
        drewPlaque = false;
      }
    }
  }
  if (!drewPlaque) {
    UI.drawWoodBoard(c, x, y, w, h, 13, true);
    UI.drawParchmentSheet(c, x + 5, y + 4, w - 10, h - 8, 9);
    if (w >= 260) {
      UI.drawUiIcon(c, sp, 'serve_bell', x + 24, y + h * 0.5, Math.min(24, h * 0.48));
      UI.drawStarIcon(c, x + w - 24, y + h * 0.5, Math.min(8, h * 0.16), true);
    }
  }

  UI.drawFitText(
    c,
    '一 起 做 猫 饼',
    cx,
    y + h * (subtitle ? 0.39 : 0.5),
    w - (drewPlaque ? 92 : 68),
    Math.min(20, h * 0.38),
    13.5,
    900,
    '#4A2C2A',
    'center',
    'middle'
  );
  if (subtitle) {
    UI.drawFitText(
      c,
      subtitle,
      cx,
      y + h * 0.69,
      w - (drewPlaque ? 92 : 68),
      10.8,
      8.5,
      800,
      '#8A5222',
      'center',
      'middle'
    );
  } else if (typeof totalStars === 'number') {
    UI.drawStarIcon(c, cx - 24, y + h * 0.70, 5.5, true);
    UI.drawFitText(c, `${totalStars}/90`, cx + 6, y + h * 0.70, 60, 10, 8, 800, '#8A5222', 'center', 'middle');
  }
}

function renderLobbyTopBar(ctx, geom, app, hits) {
  const c = getSafeCtx(ctx);
  const { topY, headerH, maxRight } = geom;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const totalStars = computeTotalStars(saveData.levelStars);

  const btnS = Math.min(30, headerH);
  const btnY = topY + Math.floor((headerH - btnS) * 0.5);
  const gap = 5;

  const helpX = maxRight - btnS;
  const sfxX = helpX - gap - btnS;
  const bgmX = sfxX - gap - btnS;

  const bgmOn = app.audio ? Boolean(app.audio.bgmEnabled && app.audio.bgmTrack !== 'off') : true;
  const sfxOn = app.audio ? Boolean(app.audio.sfxEnabled) : true;

  UI.drawPillButton(c, bgmX, btnY, btnS, btnS, {
    style: bgmOn ? 'wood' : 'dark',
    icon: 'icon_bgm',
    sprites,
    iconSize: 18,
    radius: 9,
    mutedSlash: !bgmOn,
    fallbackText: '乐'
  });
  hits.add('lobby_bgm_btn', bgmX, btnY, btnS, btnS, () => app.cycleBgm());

  UI.drawPillButton(c, sfxX, btnY, btnS, btnS, {
    style: sfxOn ? 'wood' : 'dark',
    icon: 'icon_sfx',
    sprites,
    iconSize: 18,
    radius: 9,
    mutedSlash: !sfxOn,
    fallbackText: '音'
  });
  hits.add('lobby_sfx_btn', sfxX, btnY, btnS, btnS, () => app.toggleSfx());

  UI.drawPillButton(c, helpX, btnY, btnS, btnS, {
    style: 'wood',
    icon: 'icon_help',
    sprites,
    iconSize: 18,
    radius: 9,
    fallbackText: '助'
  });
  hits.add('lobby_help_btn', helpX, btnY, btnS, btnS, () => app.openModal('help'));

  // Left non-interactive status chips (strictly ending <= bgmX - 6)
  const leftStart = 12;
  const leftAvail = Math.max(0, bgmX - 6 - leftStart);
  if (leftAvail >= 72) {
    const chipH = Math.min(28, headerH);
    const chipY = topY + Math.floor((headerH - chipH) * 0.5);
    const dustW = Math.min(84, leftAvail);
    UI.drawCurrencyChip(
      c,
      leftStart,
      chipY,
      dustW,
      chipH,
      sprites,
      'icon_stardust',
      String(saveData.bankStardust || 0),
      { style: 'wood', fontSize: 11.5 }
    );

    const starChipX = leftStart + dustW + 5;
    const starChipW = Math.min(108, bgmX - 6 - starChipX);
    if (starChipW >= 58) {
      UI.drawKissaCard(c, starChipX, chipY, starChipW, chipH, {
        tone: 'amber',
        radius: 9
      });
      UI.drawStarIcon(c, starChipX + 13, chipY + chipH * 0.5, 6.2, true);
      const cloudIcon = app.cloudStatus === 'synced' ? 'icon_cloud' : 'icon_local_save';
      if (starChipW >= 88) {
        UI.drawUiIcon(c, sprites, cloudIcon, starChipX + starChipW - 12, chipY + chipH * 0.5, 14);
      }
      const txtRight = starChipW >= 88 ? starChipW - 24 : starChipW - 6;
      UI.drawFitText(
        c,
        `${totalStars}/90`,
        starChipX + 23,
        chipY + chipH * 0.5 + 0.5,
        Math.max(24, txtRight - 23),
        10.8,
        8.5,
        800,
        '#4A2C2A',
        'left',
        'middle'
      );
    }
  }
}

function renderChapterBar(ctx, rect, app, hits) {
  const c = getSafeCtx(ctx);
  const { x, y, w, h } = rect;
  const saveData = app.saveData || {};
  const chapNum = clamp(Math.round(Number(app.selectedChapter) || 1), 1, 3);
  const chap = CHAPTERS[chapNum - 1] || CHAPTERS[0];
  const chapStatus = isChapterUnlocked(chapNum, saveData.levelStars);

  let chapStars = 0;
  for (let i = 0; i < chap.levelIds.length; i++) {
    const lid = chap.levelIds[i];
    const st = saveData.levelStars && saveData.levelStars[lid];
    if (Number.isFinite(st) && st > 0) chapStars += Math.min(3, Math.floor(st));
  }

  UI.drawKissaCard(c, x, y, w, h, {
    tone: chapStatus.unlocked ? 'selected' : 'soft',
    radius: 11
  });

  const btnW = 34;
  const btnH = Math.max(24, h - 6);
  const btnY = y + Math.floor((h - btnH) * 0.5);
  const prevX = x + 4;
  const nextX = x + w - 4 - btnW;

  UI.drawPillButton(c, prevX, btnY, btnW, btnH, {
    style: chapNum > 1 ? 'wood' : 'card',
    disabled: chapNum <= 1,
    radius: 8,
    text: ''
  });
  drawChevronIcon(c, prevX + btnW * 0.5, btnY + btnH * 0.5, 12, 'left', chapNum > 1 ? '#4A2C2A' : '#A48D76');
  hits.add('chapter_prev', prevX, btnY, btnW, btnH, () => app.switchChapter(-1));

  UI.drawPillButton(c, nextX, btnY, btnW, btnH, {
    style: chapNum < 3 ? 'wood' : 'card',
    disabled: chapNum >= 3,
    radius: 8,
    text: ''
  });
  drawChevronIcon(c, nextX + btnW * 0.5, btnY + btnH * 0.5, 12, 'right', chapNum < 3 ? '#4A2C2A' : '#A48D76');
  hits.add('chapter_next', nextX, btnY, btnW, btnH, () => app.switchChapter(1));

  const centerLeft = prevX + btnW + 6;
  const centerW = Math.max(80, nextX - 6 - centerLeft);
  const centerX = centerLeft + centerW * 0.5;

  if (chapStatus.unlocked) {
    const titleStr = `第${chap.chapter}章 · ${chap.name}`;
    UI.drawFitText(
      c,
      titleStr,
      centerLeft + 4,
      y + h * 0.5,
      centerW - 62,
      12.5,
      9.5,
      900,
      '#4A2C2A',
      'left',
      'middle'
    );
    const badgeW = 54;
    const badgeX = centerLeft + centerW - badgeW;
    UI.drawStarIcon(c, badgeX + 9, y + h * 0.5, 6.2, true);
    UI.drawFitText(
      c,
      `${chapStars}/30`,
      badgeX + 19,
      y + h * 0.5 + 0.5,
      badgeW - 21,
      10.8,
      8.5,
      800,
      '#7A4818',
      'left',
      'middle'
    );
  } else {
    drawLockIcon(c, centerLeft + 10, y + h * 0.5, 13);
    UI.drawFitText(
      c,
      `第${chap.chapter}章 · ${chap.name}（${chapStatus.reason}）`,
      centerLeft + 21,
      y + h * 0.5,
      centerW - 24,
      10.5,
      8.0,
      800,
      '#6E4E3A',
      'left',
      'middle'
    );
  }
}

function renderCampaignMap(ctx, rect, app, hits, nowSec, includeHeroWatermark) {
  const c = getSafeCtx(ctx);
  const { x, y, w, h } = rect;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const chapNum = clamp(Math.round(Number(app.selectedChapter) || 1), 1, 3);
  const chap = CHAPTERS[chapNum - 1] || CHAPTERS[0];
  const chapTheme = BOARD_THEMES[chap.themeHint] || BOARD_THEMES.amber;

  UI.drawWoodBoard(c, x, y, w, h, 15, true);
  const pad = 7;
  const px = x + pad;
  const py = y + pad;
  const pw = w - pad * 2;
  const ph = h - pad * 2;
  UI.drawParchmentSheet(c, px, py, pw, ph, 11);

  if (includeHeroWatermark && sprites.hero) {
    c.save();
    try {
      UI.roundRectPath(c, px + 2, py + 2, pw - 4, ph - 4, 9);
      c.clip();
      c.globalAlpha = 0.14;
      UI.drawCoverImage(c, sprites.hero, px, py, pw, ph, 0.45);
    } finally {
      c.restore();
    }
  }

  // Subtle chapter atmosphere header tint inside map
  c.save();
  try {
    c.fillStyle =
      chapNum === 2
        ? 'rgba(223, 134, 165, 0.10)'
        : chapNum === 3
        ? 'rgba(135, 189, 219, 0.13)'
        : 'rgba(213, 156, 59, 0.08)';
    UI.roundRectPath(c, px + 2, py + 2, pw - 4, ph - 4, 9);
    c.fill();
  } finally {
    c.restore();
  }

  const mx = px + 8;
  const my = py + 8;
  const mw = Math.max(200, pw - 16);
  const mh = Math.max(180, ph - 16);

  // 10-node winding S-curve layout: (3, 3, 3, 1) strictly non-overlapping on >=320px width
  const colFracs = [
    [0.17, 0.50, 0.83],
    [0.83, 0.50, 0.17],
    [0.17, 0.50, 0.83],
    [0.50]
  ];
  const rowFracs = [0.125, 0.375, 0.625, 0.875];

  const stdW = clamp(Math.floor(mw * 0.225), 68, 96);
  const stdH = clamp(Math.floor(mh * 0.145), 38, 52);
  const bossW = clamp(Math.floor(mw * 0.31), 92, 128);
  const bossH = clamp(Math.floor(mh * 0.155), 40, 56);

  const nodes = [];
  let idx = 0;
  for (let r = 0; r < colFracs.length; r++) {
    const row = colFracs[r];
    for (let k = 0; k < row.length; k++) {
      const levelId = `${chapNum}-${idx + 1}`;
      const isBoss = idx === 9;
      const nw = isBoss ? bossW : stdW;
      const nh = isBoss ? bossH : stdH;
      const cx = Math.round(mx + mw * row[k]);
      const cy = Math.round(my + mh * rowFracs[r]);
      nodes.push({
        index: idx + 1,
        levelId,
        isBoss,
        cx,
        cy,
        x: Math.round(cx - nw * 0.5),
        y: Math.round(cy - nh * 0.5),
        w: nw,
        h: nh
      });
      idx++;
    }
  }

  // Draw winding bakery trail connecting 1 -> 10
  c.save();
  try {
    c.strokeStyle = chapTheme.cellBorder || '#C69552';
    c.lineWidth = 4.5;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (typeof c.setLineDash === 'function') c.setLineDash([7, 6]);
    c.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      if (i === 0) c.moveTo(nodes[i].cx, nodes[i].cy);
      else c.lineTo(nodes[i].cx, nodes[i].cy);
    }
    c.stroke();
    if (typeof c.setLineDash === 'function') c.setLineDash([]);
  } finally {
    c.restore();
  }

  const frontierId = saveData.highestUnlockedLevel || '1-1';

  for (let i = 0; i < nodes.length; i++) {
    const nd = nodes[i];
    const lvl = getLevelById(nd.levelId);
    const unlockInfo = isLevelUnlocked(nd.levelId, saveData.levelStars);
    const rawStar = saveData.levelStars && saveData.levelStars[nd.levelId];
    const stars = Number.isFinite(rawStar) && rawStar > 0 ? Math.min(3, Math.floor(rawStar)) : 0;
    const isFrontier = unlockInfo.unlocked && nd.levelId === frontierId && stars === 0;

    if (isFrontier) {
      const pulse = 0.5 + 0.5 * Math.sin(nowSec * 4.6);
      c.save();
      try {
        c.strokeStyle = `rgba(245, 178, 36, ${(0.55 + 0.35 * pulse).toFixed(3)})`;
        c.lineWidth = 3.2;
        UI.roundRectPath(c, nd.x - 3, nd.y - 3, nd.w + 6, nd.h + 6, 13);
        c.stroke();
      } finally {
        c.restore();
      }
    }

    UI.drawKissaCard(c, nd.x, nd.y, nd.w, nd.h, {
      tone: !unlockInfo.unlocked
        ? 'soft'
        : isFrontier
        ? 'selected'
        : stars >= 3
        ? 'amber'
        : 'cream',
      borderColor: !unlockInfo.unlocked
        ? '#A8937C'
        : isFrontier
        ? '#DF921A'
        : nd.isBoss
        ? '#B86B1B'
        : '#B98E58',
      radius: 10
    });

    if (nd.isBoss) {
      UI.drawUiIcon(c, sprites, 'icon_crown', nd.x + 12, nd.y + 12, 13, unlockInfo.unlocked ? 1 : 0.45);
    }

    const labelText = nd.isBoss && lvl ? `${nd.levelId} ${lvl.name}` : nd.levelId;
    UI.drawFitText(
      c,
      labelText,
      nd.cx + (nd.isBoss ? 4 : 0),
      nd.y + nd.h * 0.36,
      nd.w - (nd.isBoss ? 22 : 10),
      nd.isBoss ? 11.2 : 11.8,
      nd.isBoss ? 7.4 : 8.5,
      900,
      unlockInfo.unlocked ? '#4A2C2A' : '#7D6A58',
      'center',
      'middle'
    );

    if (!unlockInfo.unlocked) {
      drawLockIcon(c, nd.cx, nd.y + nd.h * 0.73, 12.5, {
        bodyColor: '#B8A28A',
        borderColor: '#6D5846',
        shackleColor: '#6D5846'
      });
    } else {
      const starY = nd.y + nd.h * 0.74;
      const starSpacing = Math.min(14, nd.w * 0.21);
      for (let s = 1; s <= 3; s++) {
        UI.drawStarIcon(
          c,
          nd.cx + (s - 2) * starSpacing,
          starY,
          5.0,
          s <= stars
        );
      }
      if (isFrontier) {
        UI.drawTagBadge(
          c,
          nd.x + nd.w - 30,
          nd.y - 6,
          30,
          14,
          '当前',
          'amber',
          8.0
        );
      }
    }

    const levelIdCopy = nd.levelId;
    hits.add(`level_node_${levelIdCopy}`, nd.x, nd.y, nd.w, nd.h, () =>
      app.onTapLevelNode(levelIdCopy)
    );
  }
}

function renderPatronBar(ctx, rect, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const { x, y, w, h } = rect;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const patronId = normalizePatronId(saveData.selectedPatron);
  const patron = PATRONS.find((p) => p.id === patronId) || PATRONS[0];

  UI.drawKissaCard(c, x, y, w, h, {
    tone: 'cream',
    radius: 12
  });

  const avatarS = Math.min(h - 8, 50);
  const avatarCx = x + 8 + avatarS * 0.5;
  const bounce = app.patronPokeTimer > 0 ? Math.sin(app.patronPokeTimer * 26) * 3.5 : Math.sin(nowSec * 2.3) * 1.2;
  const avatarCy = y + h * 0.5 + bounce;

  c.save();
  try {
    c.fillStyle = '#F7E3BE';
    c.strokeStyle = '#B98848';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(avatarCx, y + h * 0.5, avatarS * 0.48, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  } finally {
    c.restore();
  }
  UI.drawUiIcon(c, sprites, patron.id, avatarCx, avatarCy, avatarS * 0.9);

  const btnW = 84;
  const btnH = Math.min(32, h - 10);
  const btnX = x + w - 8 - btnW;
  const btnY = Math.round(y + (h - btnH) * 0.5);

  UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
    style: 'walnut',
    text: '切换搭档',
    fontSize: 10.8,
    radius: 9
  });
  hits.add('lobby_patron_switch', btnX, btnY, btnW, btnH, () => app.cycleOrOpenPatrons());

  // Non-HitRegistry geometric poke area stored on app for tactile mascot tap
  const textX = x + 14 + avatarS;
  const textW = Math.max(60, btnX - 8 - textX);
  app.lobbyPatronPokeRect = { x, y, w: Math.max(40, btnX - 4 - x), h };

  UI.drawFitText(
    c,
    `${patron.name} · ${patron.shortPassive}`,
    textX,
    y + h * 0.34,
    textW,
    11.5,
    9.0,
    900,
    '#4A2C2A',
    'left',
    'middle'
  );

  const speechLine = app.currentPatronLine || patron.greet;
  UI.drawFitText(
    c,
    speechLine,
    textX,
    y + h * 0.69,
    textW,
    10.0,
    8.0,
    700,
    '#7A5438',
    'left',
    'middle'
  );
}

function renderLobbyBottomDock(ctx, rect, app, hits) {
  const c = getSafeCtx(ctx);
  const { x, y, w, h } = rect;
  const sprites = app.sprites || {};
  const gap = 6;
  const colW = Math.floor((w - gap * 3) / 4);

  const items = [
    {
      id: 'dock_shop',
      label: '小铺',
      icon: 'icon_shop',
      redDot: typeof app.hasAffordableShopItem === 'function' ? app.hasAffordableShopItem() : false,
      onClick: () => app.openShop('catcakes')
    },
    {
      id: 'dock_compendium',
      label: '图鉴',
      icon: 'icon_book',
      redDot: false,
      onClick: () => app.openCompendium('catcakes')
    },
    {
      id: 'dock_leaderboard',
      label: '排行',
      icon: 'icon_trophy',
      redDot: false,
      onClick: () => app.openLeaderboard('stars')
    },
    {
      id: 'dock_themes',
      label: '主题',
      icon: 'icon_ribbon',
      redDot: typeof app.hasAffordableShopTab === 'function' ? app.hasAffordableShopTab('themes') : false,
      onClick: () => app.openShop('themes')
    }
  ];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const bx = x + i * (colW + gap);
    UI.drawPillButton(c, bx, y, colW, h, {
      style: 'wood',
      icon: it.icon,
      sprites,
      iconSize: 17,
      text: it.label,
      fontSize: 11.2,
      radius: 10
    });
    if (it.redDot) {
      drawRedDot(c, bx + colW - 8, y + 8, 4.8);
    }
    hits.add(it.id, bx, y, colW, h, it.onClick);
  }
}

function renderLobbyScreen(ctx, metrics, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const geom = computeTopHeaderGeometry(metrics);
  const { width, headerBottom, bottomLimit } = geom;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const totalStars = computeTotalStars(saveData.levelStars);
  const rankTitle = getChefRank(saveData);
  const ctaLevelId = saveData.highestUnlockedLevel || '1-1';
  const ctaLevel = getLevelById(ctaLevelId) || getLevelById('1-1');
  const ctaStar1 = ctaLevel && ctaLevel.stars ? ctaLevel.stars[0] : 750;

  app.currentBoardLayout = null;
  app.guideTargets = null;

  renderLobbyTopBar(c, geom, app, hits);

  const bodyTop = headerBottom + 6;
  const availH = Math.max(360, bottomLimit - bodyTop);

  // Portrait Layout (375x667 & 390x844)
  const compact = availH < 640;
  const padX = 12;
  const innerW = width - padX * 2;

  const plaqueH = compact ? 46 : 56;
  drawTitlePlaqueBanner(
    c,
    padX,
    bodyTop,
    innerW,
    plaqueH,
    sprites,
    `${rankTitle} · 总星 ${totalStars}/90`,
    totalStars
  );

  const chapY = bodyTop + plaqueH + 4;
  const chapH = compact ? 34 : 36;
  renderChapterBar(c, { x: padX, y: chapY, w: innerW, h: chapH }, app, hits);

  const dockH = compact ? 40 : 44;
  const dockY = bottomLimit - dockH;
  renderLobbyBottomDock(c, { x: padX, y: dockY, w: innerW, h: dockH }, app, hits);

  const ctaH = compact ? 42 : 46;
  const ctaY = dockY - 6 - ctaH;
  UI.drawPillButton(c, padX, ctaY, innerW, ctaH, {
    style: 'cta',
    icon: 'serve_bell',
    sprites,
    iconSize: 20,
    text: `开始营业 · 第 ${ctaLevelId} 关（1星 ${ctaStar1}）`,
    fontSize: compact ? 12.6 : 13.4,
    radius: 12
  });
  hits.add('lobby_start_cta', padX, ctaY, innerW, ctaH, () => app.startLevel(ctaLevelId));

  const patronH = compact ? 52 : 60;
  const patronY = ctaY - 6 - patronH;
  renderPatronBar(c, { x: padX, y: patronY, w: innerW, h: patronH }, app, hits, nowSec);

  const mapY = chapY + chapH + 5;
  const mapH = Math.max(200, patronY - 6 - mapY);
  renderCampaignMap(c, { x: padX, y: mapY, w: innerW, h: mapH }, app, hits, nowSec, true);
}

function renderPlayTopBar(ctx, geom, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const { width, topY, headerH, maxRight } = geom;
  const sprites = app.sprites || {};
  const orderState = app.orderState || {};
  const lvl = getLevelById(app.currentLevelId || orderState.levelId || '1-1') || getLevelById('1-1');
  const stars = lvl && Array.isArray(lvl.stars) ? lvl.stars : [750, 1050, 1400];
  const score = Math.max(0, Math.floor(Number(orderState.score) || 0));
  const timeLeft = Math.max(0, Number(orderState.timeLeft) || 0);

  const padX = 8;
  const btnS = Math.min(30, headerH);
  const btnY = topY + Math.floor((headerH - btnS) * 0.5);

  UI.drawPillButton(c, padX, btnY, btnS, btnS, {
    style: 'wood',
    icon: 'icon_pause',
    sprites,
    iconSize: 16,
    radius: 8,
    fallbackText: '停'
  });
  hits.add('pause_btn', padX, btnY, btnS, btnS, () => app.togglePause());

  const pillH = Math.min(28, headerH);
  const pillY = topY + Math.floor((headerH - pillH) * 0.5);

  const lvlX = padX + btnS + 4;
  const lvlW = 38;
  UI.drawKissaCard(c, lvlX, pillY, lvlW, pillH, { tone: 'cream', radius: 8 });
  UI.drawFitText(
    c,
    lvl ? lvl.id : '1-1',
    lvlX + lvlW * 0.5,
    pillY + pillH * 0.5 + 0.5,
    lvlW - 8,
    10.8,
    8.5,
    900,
    '#4A2C2A',
    'center',
    'middle'
  );

  const timerX = lvlX + lvlW + 4;
  const timerW = 58;
  const isUrgentClock = timeLeft <= 15 && timeLeft > 0;
  const pulse = isUrgentClock ? 0.5 + 0.5 * Math.sin(nowSec * 9.0) : 0;
  UI.drawKissaCard(c, timerX, pillY, timerW, pillH, {
    tone: isUrgentClock ? 'selected' : 'cream',
    borderColor: isUrgentClock ? '#D94336' : '#B98E58',
    radius: 8
  });
  UI.drawUiIcon(
    c,
    sprites,
    'icon_hourglass',
    timerX + 11,
    pillY + pillH * 0.5,
    13 + pulse * 1.5
  );
  UI.drawFitText(
    c,
    formatClockMMSS(timeLeft),
    timerX + 19,
    pillY + pillH * 0.5 + 0.5,
    timerW - 22,
    11.0,
    8.5,
    900,
    isUrgentClock ? '#C2271D' : '#4A2C2A',
    'left',
    'middle'
  );

  // Dynamic Score & 1-3 Star Progress Bar (strictly ending <= maxRight)
  const progX = timerX + timerW + 4;
  const progW = Math.max(68, maxRight - progX);
  UI.drawKissaCard(c, progX, pillY, progW, pillH, { tone: 'amber', radius: 8 });

  const nextTarget =
    score < stars[0] ? stars[0] : score < stars[1] ? stars[1] : stars[2];
  UI.drawFitText(
    c,
    `${score} / ${nextTarget}`,
    progX + progW * 0.5,
    pillY + 8.5,
    progW - 12,
    10.2,
    8.0,
    900,
    '#4A2C2A',
    'center',
    'middle'
  );

  const barX = progX + 8;
  const barW = Math.max(36, progW - 16);
  const barY = pillY + pillH - 9;
  const barH = 5.5;
  const star3 = Math.max(1, stars[2]);
  const fillRatio = clamp(score / star3, 0, 1);

  c.save();
  try {
    c.fillStyle = 'rgba(74, 44, 42, 0.22)';
    UI.roundRectPath(c, barX, barY, barW, barH, 3);
    c.fill();

    if (fillRatio > 0) {
      const fg = c.createLinearGradient(barX, barY, barX + barW, barY);
      fg.addColorStop(0, '#F5B82E');
      fg.addColorStop(1, '#FFDF73');
      c.fillStyle = fg;
      UI.roundRectPath(c, barX, barY, Math.max(4, barW * fillRatio), barH, 3);
      c.fill();
    }
  } finally {
    c.restore();
  }

  for (let i = 0; i < 3; i++) {
    const ratio = clamp(stars[i] / star3, 0.12, 1.0);
    const sx = barX + barW * ratio;
    const unlocked = score >= stars[i];
    const popTimer = app.starPopTimers && app.starPopTimers[i] > 0 ? app.starPopTimers[i] : 0;
    const scaleBoost = popTimer > 0 ? 1 + 0.45 * Math.sin((popTimer / 0.3) * Math.PI) : 1;
    UI.drawStarIcon(c, sx, barY + barH * 0.5, 4.6 * scaleBoost, unlocked);
  }
}

function drawUtensilButton(ctx, x, y, w, h, kind, app, hits, shortcutHint = '') {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const def = TOOLS[kind];
  const count = Math.max(0, Math.floor((app.toolCounts && app.toolCounts[kind]) || 0));
  const bought = Math.max(0, Math.floor((app.toolBoughtThisLevel && app.toolBoughtThisLevel[kind]) || 0));
  const armed = app.activeTool === kind;
  const canEmergencyBuy = count === 0 && bought < def.maxBuyPerLevel;

  UI.drawPillButton(c, x, y, w, h, {
    style: armed ? 'active' : count > 0 ? 'wood' : canEmergencyBuy ? 'walnut' : 'card',
    disabled: count === 0 && !canEmergencyBuy,
    radius: 11,
    text: ''
  });

  const iconKey = kind === 'fork' ? 'tool_fork' : 'tool_spoon';
  UI.drawUiIcon(c, sprites, iconKey, x + w * 0.5, y + h * 0.37, Math.min(22, h * 0.44));

  let badgeLabel = `×${count}`;
  if (count === 0) {
    badgeLabel = canEmergencyBuy ? `${def.cost}星` : '已尽';
  } else if (shortcutHint) {
    badgeLabel = `[${shortcutHint}]×${count}`;
  }
  UI.drawFitText(
    c,
    armed ? '取消' : badgeLabel,
    x + w * 0.5,
    y + h * 0.78,
    w - 6,
    9.5,
    7.5,
    800,
    armed ? '#4A2C2A' : count > 0 ? '#4A2C2A' : canEmergencyBuy ? '#FFF6E0' : '#8C7560',
    'center',
    'middle'
  );

  if (count === 0 && canEmergencyBuy && (saveData.bankStardust || 0) >= def.cost) {
    UI.drawStarIcon(c, x + w - 8, y + 8, 4.2, true);
  }

  const hitId = kind === 'fork' ? 'tool_fork_btn' : 'tool_spoon_btn';
  hits.add(hitId, x, y, w, h, () => app.onTapToolButton(kind));
}

function drawPatronSkillMedallion(ctx, x, y, w, h, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const patronId = normalizePatronId(saveData.selectedPatron);
  const patron = PATRONS.find((p) => p.id === patronId) || PATRONS[0];
  const charge = clamp(Number(app.skillEnergy) || 0, 0, 100);
  const ready = charge >= 100;
  const pulse = ready ? 0.5 + 0.5 * Math.sin(nowSec * 6.5) : 0;

  UI.drawKissaCard(c, x, y, w, h, {
    tone: ready ? 'selected' : 'cream',
    borderColor: ready ? '#E59A18' : '#B98E58',
    radius: 12
  });

  const cx = x + w * 0.5;
  const cy = y + h * 0.42;
  const rad = Math.min(w, h) * 0.31 + pulse * 1.2;

  c.save();
  try {
    c.strokeStyle = 'rgba(120, 82, 42, 0.22)';
    c.lineWidth = 3.0;
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    c.stroke();

    if (charge > 0) {
      c.strokeStyle = ready ? '#F5A31A' : '#58A55C';
      c.lineWidth = 3.2;
      c.beginPath();
      c.arc(cx, cy, rad, -Math.PI * 0.5, -Math.PI * 0.5 + (charge / 100) * Math.PI * 2);
      c.stroke();
    }
  } finally {
    c.restore();
  }

  UI.drawUiIcon(c, sprites, patron.id, cx, cy, rad * 1.65);
  UI.drawFitText(
    c,
    ready ? '释放' : `${Math.floor(charge)}%`,
    cx,
    y + h * 0.83,
    w - 6,
    9.2,
    7.5,
    900,
    ready ? '#B85A08' : '#5A3A28',
    'center',
    'middle'
  );

  hits.add('patron_skill_btn', x, y, w, h, () => app.onTapPatronSkill());
}

function renderPlayScreen(ctx, metrics, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const geom = computeTopHeaderGeometry(metrics);
  const { width, headerBottom, bottomLimit } = geom;
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const gridState = app.gridState;
  const orderState = app.orderState || {};
  const animState = app.animState || {};
  const guideTargets = {};
  app.guideTargets = guideTargets;

  renderPlayTopBar(c, geom, app, hits, nowSec);

  // Portrait 4-Band Layout (375x667 & 390x844)
  const availH = bottomLimit - headerBottom;
  const compact = availH < 640;
  const padX = 8;
  const innerW = width - padX * 2;

  const custY = headerBottom + (compact ? 4 : 6);
  const custH = compact ? 100 : 112;
  BoardRenderer.renderCustomersBar(
    c,
    { x: padX, y: custY, w: innerW, h: custH },
    orderState,
    sprites,
    hits,
    nowSec,
    {
      vertical: false,
      animState,
      guideTargets,
      onSelectSeat: (idx) => app.selectCustomerSeat(idx)
    }
  );

  const trayY = custY + custH + (compact ? 4 : 5);
  const trayH = compact ? 54 : 60;
  BoardRenderer.renderTrayStrip(
    c,
    { x: padX, y: trayY, w: innerW, h: trayH },
    orderState,
    sprites,
    hits,
    nowSec,
    {
      theme: app.equippedTheme,
      animState,
      guideTargets,
      boardFullHint: app.boardFullHintTimer > 0,
      onTapTraySlot: (idx) => app.handleTraySlotTap(idx),
      onTapTrash: () => app.handleTrashBtnTap()
    }
  );

  const dockH = compact ? 56 : 62;
  const dockY = bottomLimit - dockH;
  guideTargets.dock = { x: padX, y: dockY, w: innerW, h: dockH };

  // 4 strictly disjoint bottom controls: fork | knead | spoon | patron_skill
  const forkX = padX + 2;
  const forkW = 54;
  const skillW = 60;
  const skillX = width - padX - skillW;
  const spoonW = 54;
  const spoonX = skillX - 6 - spoonW;
  const kneadX = forkX + forkW + 6;
  const kneadW = Math.max(108, spoonX - 6 - kneadX);

  drawUtensilButton(c, forkX, dockY + 4, forkW, dockH - 8, 'fork', app, hits, '');

  const kPadY = app.kneadPressTimer > 0 ? 4 : 2;
  UI.drawPillButton(c, kneadX, dockY + kPadY, kneadW, dockH - kPadY * 2, {
    style: 'cta',
    icon: 'btn_knead',
    sprites,
    iconSize: compact ? 20 : 22,
    text: '揉面补料',
    fontSize: compact ? 12.8 : 13.5,
    radius: 13
  });
  hits.add('knead_btn', kneadX, dockY + 2, kneadW, dockH - 4, () => app.onTapKneadButton());
  guideTargets.kneadBtn = { x: kneadX, y: dockY + 2, w: kneadW, h: dockH - 4 };

  drawUtensilButton(c, spoonX, dockY + 4, spoonW, dockH - 8, 'spoon', app, hits, '');
  drawPatronSkillMedallion(c, skillX, dockY + 2, skillW, dockH - 4, app, hits, nowSec);

  const stageY = trayY + trayH + 4;
  const stageH = Math.max(210, dockY - 4 - stageY);
  const layout = BoardRenderer.renderBoardStage(
    c,
    { x: padX, y: stageY, w: innerW, h: stageH },
    gridState,
    orderState,
    app.equippedTheme,
    sprites,
    animState,
    nowSec,
    {
      activeTool: app.activeTool,
      guideTargets,
      neededTiers: app.neededTiers
    }
  );

  if (orderState.rushHourActive && !app.activeTool) {
    UI.drawTagBadge(
      c,
      width - padX - 78,
      stageY + 2,
      74,
      18,
      '高峰客流',
      'berry',
      8.8,
      'icon_flame',
      sprites
    );
  }

  app.currentBoardLayout = layout;
  return layout;
}

function renderToast(ctx, width, headerBottom, app) {
  const c = getSafeCtx(ctx);
  if (!app) return;
  const cur = app.toastCurrent && app.toastCurrent.timer > 0 ? app.toastCurrent : null;
  const minor = app.minorToast && app.minorToast.timer > 0 ? app.minorToast : null;
  if (!cur && !minor) return;

  const sprites = app.sprites || {};
  const m = typeof app.getMetrics === 'function' ? app.getMetrics() : { width, height: 667, safeBottom: 0 };
  const botLimit = Math.max(200, (m.height || 667) - Math.max(10, (m.safeBottom || 0) + 8));

  let baseY = headerBottom + 8;
  if (app.activeModal) {
    baseY = Math.max(headerBottom + 10, botLimit - 44);
  } else if (app.screen === 'playing') {
    baseY = headerBottom + 114;
  }

  const primary = cur || minor;
  const isMajor = primary.level === 'major';
  const elapsed = Math.max(0, (primary.maxTimer || 2.0) - primary.timer);
  const slideOffset = elapsed < 0.14 ? (1 - elapsed / 0.14) * 5 : 0;

  c.save();
  try {
    c.globalAlpha = clamp(primary.timer * 3.4, 0, 1);
    const fontSz = isMajor ? 11.2 : 10.4;
    c.font = UI.fontStr(fontSz, 800);
    const hasIcon = Boolean(primary.icon);
    const maxW = Math.min(isMajor ? 356 : 310, width - 24);
    const tw = clamp(
      c.measureText(primary.text || '').width + 28 + (hasIcon ? 22 : 0),
      isMajor ? 132 : 104,
      maxW
    );
    const th = isMajor ? 28 : 24;
    const tx = Math.round((width - tw) * 0.5);
    const ty = Math.round(clamp(baseY + slideOffset, headerBottom + 6, botLimit - th - 4));

    UI.drawNoticeBanner(c, tx, ty, tw, th, {
      icon: primary.icon || '',
      sprites,
      iconSize: isMajor ? 17 : 15,
      text: primary.text || '',
      fontSize: fontSz,
      align: hasIcon ? 'left' : 'center',
      tone: primary.tone || (isMajor ? 'event' : 'info'),
      rightReserve: 10
    });
  } finally {
    c.restore();
  }
}

module.exports = {
  renderBackdrop,
  renderLobbyScreen,
  renderPlayScreen,
  renderToast,
  computeTopHeaderGeometry,
  drawRedDot,
  drawLockIcon,
  drawChevronIcon,
  getSafeCtx
};
