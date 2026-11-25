/**
 * Canvas 2D Layout Computer & Screen Renderers (v0.9.0 Cozy Japanese Storybook UI)
 * - 3-Chapter Full-Bleed Hand-Painted Campaign Lobby (`02a/02b/02c`) with Normalized Winding Road Nodes
 * - 4-Band Gameplay HUD (`03_局内营业主界面`)
 * - Reserve Title Screen helper (`01_标题首屏_TitleScreen（备用）`)
 *
 * Strictly enforces:
 * - Zero HSL color strings (strictly hex/rgb/rgba for iOS WeChat Canvas safety)
 * - Zero native Unicode emoji / star / dingbat characters (100% WebP sprites & vector icons)
 * - Strict WeChat capsule clearance (right <= menuRect.left - 8 when y < menuRect.bottom) & safeBottom clearance
 * - Zero pairwise HitRegistry overlaps across 375x667, 390x844, and 1280x760
 * - Pure Node.js stub-canvas (ctx === null) geometry & HitRegistry parity
 */
'use strict';

const {
  GAME_TITLE,
  GAME_VERSION,
  PATRONS,
  TOOLS,
  BOARD_THEMES,
  LOBBY_LAYOUT_NORMALIZED,
  normalizePatronId,
  getChefRank
} = require('./constants');
const {
  CHAPTERS,
  MAX_CAMPAIGN_STARS,
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

function easeOutCubic(t) {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function formatClockMMSS(sec) {
  const s = Math.max(0, Math.ceil(Number(sec) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm < 10 ? '0' + mm : String(mm)}:${ss < 10 ? '0' + ss : String(ss)}`;
}

function getSprite(sprites, id) {
  if (!sprites || typeof sprites !== 'object' || !id) return null;
  const img = (sprites.byId && sprites.byId[id]) || sprites[id] || null;
  return UI.isReadyImage(img) ? img : null;
}

function isHitPressed(app, hitId) {
  return Boolean(app && app.uiAnim && app.uiAnim.pressedHitId === hitId);
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

  const safeLayout = typeof UI.getSafeLayout === 'function'
    ? UI.getSafeLayout(width, height, m)
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
    bottomLimit,
    capsuleBottom: safeLayout ? safeLayout.capsuleBottom : headerBottom + 8,
    capsuleLeft: safeLayout ? safeLayout.capsuleLeft : maxRight
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
    c.lineWidth = 1.6;
    c.strokeStyle = '#FFF8EC';
    c.stroke();
  } finally {
    c.restore();
  }
}

function drawLockIcon(ctx, cx, cy, size = 14, opts = {}) {
  const c = getSafeCtx(ctx);
  const s = Math.max(8, Number(size) || 14);
  const sp = opts && opts.sprites ? opts.sprites : null;
  if (sp && !(opts && opts.forceVector)) {
    const lockImg = getSprite(sp, 'icon_lock');
    if (lockImg) {
      UI.drawContainImage(c, lockImg, cx, cy, s * 1.15, s * 1.15);
      return;
    }
  }
  const bodyW = s * 0.74;
  const bodyH = s * 0.54;
  const bx = cx - bodyW * 0.5;
  const by = cy - bodyH * 0.14;
  const shackleR = bodyW * 0.28;
  const strokeInk = (opts && opts.borderColor) || '#3B4049';

  c.save();
  try {
    c.strokeStyle = (opts && opts.shackleColor) || strokeInk;
    c.lineWidth = Math.max(1.8, s * 0.14);
    c.lineCap = 'round';
    c.beginPath();
    c.arc(cx, by + 0.5, shackleR, Math.PI, 0, false);
    c.stroke();

    c.fillStyle = (opts && opts.bodyColor) || '#7D8490';
    c.strokeStyle = strokeInk;
    c.lineWidth = Math.max(1.5, s * 0.11);
    UI.roundRectPath(c, bx, by, bodyW, bodyH, Math.max(2.2, s * 0.16));
    c.fill();
    c.stroke();

    // Engraved keyhole
    const khR = Math.max(1.4, s * 0.10);
    c.fillStyle = strokeInk;
    c.beginPath();
    c.arc(cx, by + bodyH * 0.40, khR, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(cx - khR * 0.58, by + bodyH * 0.42);
    c.lineTo(cx + khR * 0.58, by + bodyH * 0.42);
    c.lineTo(cx + khR * 0.78, by + bodyH * 0.78);
    c.lineTo(cx - khR * 0.78, by + bodyH * 0.78);
    c.closePath();
    c.fill();
  } finally {
    c.restore();
  }
}

function drawChevronIcon(ctx, cx, cy, size = 12, dir = 'left', color = '#FFF8EC', alpha = 1) {
  const c = getSafeCtx(ctx);
  const sz = Math.max(10, Number(size) || 12);
  const half = sz * 0.42;
  const sign = dir === 'left' ? -1 : 1;
  c.save();
  try {
    c.globalAlpha = clamp(Number(alpha), 0.1, 1);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = '#5A3928';
    c.lineWidth = Math.max(5.6, sz * 0.36);
    c.beginPath();
    c.moveTo(cx - sign * half * 0.46, cy - half);
    c.lineTo(cx + sign * half * 0.54, cy);
    c.lineTo(cx - sign * half * 0.46, cy + half);
    c.stroke();

    c.strokeStyle = color || '#FFF8EC';
    c.lineWidth = Math.max(3.0, sz * 0.19);
    c.beginPath();
    c.moveTo(cx - sign * half * 0.46, cy - half);
    c.lineTo(cx + sign * half * 0.54, cy);
    c.lineTo(cx - sign * half * 0.46, cy + half);
    c.stroke();
  } finally {
    c.restore();
  }
}

function drawCircularWoodButton(ctx, cx, cy, radius, opts = {}) {
  const c = getSafeCtx(ctx);
  const r = Math.max(10, Number(radius) || 17);
  const disabled = Boolean(opts.disabled);
  const pressed = Boolean(opts.pressed);
  const muted = Boolean(opts.muted);
  const dy = pressed ? 1.5 : 0;

  c.save();
  try {
    // 3D base shadow lip
    c.beginPath();
    c.arc(cx, cy + dy + 2.2, r, 0, Math.PI * 2);
    c.fillStyle = disabled || muted ? '#3D271B' : '#58341E';
    c.fill();
    c.lineWidth = 2.2;
    c.strokeStyle = '#5A3928';
    c.stroke();

    const grad = c.createLinearGradient(cx, cy - r + dy, cx, cy + r + dy);
    if (disabled || muted) {
      grad.addColorStop(0, '#785B49');
      grad.addColorStop(1, '#584134');
    } else {
      grad.addColorStop(0, '#B57A4B');
      grad.addColorStop(0.55, '#8A5634');
      grad.addColorStop(1, '#683E25');
    }
    c.beginPath();
    c.arc(cx, cy + dy, r, 0, Math.PI * 2);
    c.fillStyle = grad;
    c.fill();
    c.lineWidth = 2.3;
    c.strokeStyle = '#5A3928';
    c.stroke();

    // Soft top specular rim
    c.beginPath();
    c.arc(cx, cy + dy, Math.max(4, r - 2.6), -Math.PI * 0.82, -Math.PI * 0.18);
    c.strokeStyle = 'rgba(255, 240, 212, 0.42)';
    c.lineWidth = 1.6;
    c.stroke();

    if (opts.label) {
      UI.drawOutlinedText(c, opts.label, cx, cy + dy + 0.5, {
        size: Math.round(r * 0.98),
        weight: 900,
        fill: muted ? '#DFD3C5' : '#FFF8EC',
        stroke: '#5A3928',
        strokeWidth: 2.6,
        shadowOffsetY: 0.8
      });
    } else if (opts.icon && opts.sprites) {
      UI.drawUiIcon(c, opts.sprites, opts.icon, cx, cy + dy, r * 1.15, muted ? 0.55 : 1);
    }

    if (muted) {
      c.strokeStyle = '#E85C5C';
      c.lineWidth = 2.6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx - r * 0.52, cy + dy - r * 0.52);
      c.lineTo(cx + r * 0.52, cy + dy + r * 0.52);
      c.stroke();
    }
  } finally {
    c.restore();
  }
}

function drawSpeechBalloon(ctx, x, y, w, h, tailX, tailY) {
  const c = getSafeCtx(ctx);
  const r = Math.min(11, h * 0.35, w * 0.25);
  const baseTop = clamp(tailY - 5.5, y + r + 2, Math.max(y + r + 2, y + h - r - 13));
  const baseBot = Math.min(y + h - r - 1, baseTop + 11);

  c.save();
  try {
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#FFFDF8');
    g.addColorStop(1, '#F8EDD9');
    c.fillStyle = g;
    c.strokeStyle = '#5A3928';
    c.lineWidth = 1.9;
    c.lineJoin = 'round';

    // Single seamless closed speech balloon path (rounded rect + left tail, zero inner seam)
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, baseBot);
    c.lineTo(tailX, tailY);
    c.lineTo(x, baseTop);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
    c.fill();
    c.stroke();
  } finally {
    c.restore();
  }
}

function renderAmbientParticles(ctx, width, height, dt, nowSec, theme, fireflies) {
  const c = getSafeCtx(ctx);
  const safeDt = clamp(Number(dt) || 0, 0, 0.1);
  const th = theme && typeof theme === 'object' ? theme : BOARD_THEMES.amber;
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
      const grad = c.createRadialGradient(px, py, 0, px, py, f.r * 3.2);
      grad.addColorStop(0, `rgba(${ambientRgb}, ${glow.toFixed(3)})`);
      grad.addColorStop(1, `rgba(${ambientRgb}, 0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(px, py, f.r * 3.2, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }
}

/**
 * Cozy storybook gameplay backdrop (Design 03: starry night header + warm wooden bakery wall & table)
 */
function renderBackdrop(ctx, w, h, dt, nowSec, gameState, theme, sprites, fireflies) {
  const c = getSafeCtx(ctx);
  const width = Math.max(320, Number(w) || 390);
  const height = Math.max(480, Number(h) || 844);
  const th = theme && typeof theme === 'object' ? theme : BOARD_THEMES.amber;

  // Starry upper night strip + warm wooden cafe wall + deep walnut tabletop (matches 03_PlayScreen)
  c.save();
  try {
    const skyH = Math.min(110, Math.round(height * 0.14));
    const wallH = Math.round(height * 0.34);

    // Night sky band at top
    const skyG = c.createLinearGradient(0, 0, 0, skyH);
    if (th.id === 'sakura') {
      skyG.addColorStop(0, '#3B2549');
      skyG.addColorStop(1, '#5E3B62');
    } else if (th.id === 'moonlight') {
      skyG.addColorStop(0, '#141D42');
      skyG.addColorStop(1, '#233468');
    } else {
      skyG.addColorStop(0, '#1A213D');
      skyG.addColorStop(1, '#28325A');
    }
    c.fillStyle = skyG;
    c.fillRect(0, 0, width, skyH);

    // Warm blurred bakery counter wall behind customers
    const wallG = c.createLinearGradient(0, skyH, 0, wallH);
    if (th.id === 'sakura') {
      wallG.addColorStop(0, '#9E6E7D');
      wallG.addColorStop(1, '#D2A19E');
    } else if (th.id === 'moonlight') {
      wallG.addColorStop(0, '#3D4E78');
      wallG.addColorStop(1, '#586A92');
    } else {
      wallG.addColorStop(0, '#8A6343');
      wallG.addColorStop(1, '#C59A6C');
    }
    c.fillStyle = wallG;
    c.fillRect(0, skyH, width, wallH - skyH);

    // Warm dark walnut table below tray
    const tableG = c.createLinearGradient(0, wallH, 0, height);
    if (th.id === 'sakura') {
      tableG.addColorStop(0, '#6A3E4C');
      tableG.addColorStop(1, '#472531');
    } else if (th.id === 'moonlight') {
      tableG.addColorStop(0, '#273658');
      tableG.addColorStop(1, '#19243E');
    } else {
      tableG.addColorStop(0, '#5B3A26');
      tableG.addColorStop(1, '#3E2517');
    }
    c.fillStyle = tableG;
    c.fillRect(0, wallH, width, height - wallH);

    // Subtle wooden plank lines on lower table
    c.strokeStyle = 'rgba(30, 14, 6, 0.22)';
    c.lineWidth = 1.5;
    for (let py = wallH + 46; py < height; py += 58) {
      c.beginPath();
      c.moveTo(0, py);
      c.lineTo(width, py);
      c.stroke();
    }
  } finally {
    c.restore();
  }

  renderAmbientParticles(c, width, height, dt, nowSec, th, fireflies);

  const feverOn = Boolean(gameState && gameState.feverActive);
  if (feverOn) {
    const pulse = 0.55 + 0.45 * Math.sin(nowSec * 5.2);
    c.save();
    try {
      c.strokeStyle = `rgba(245, 184, 65, ${(0.28 + pulse * 0.22).toFixed(3)})`;
      c.lineWidth = 8;
      c.strokeRect(4, 4, width - 8, height - 8);
    } finally {
      c.restore();
    }
  }
}

function getChapterBgKey(chapNum) {
  if (chapNum === 2) return 'bg_lobby_ch2_sakura';
  if (chapNum === 3) return 'bg_lobby_ch3_moonlight';
  return 'bg_lobby_ch1_amber';
}

function getChapterThemeKey(chapNum) {
  if (chapNum === 2) return 'sakura';
  if (chapNum === 3) return 'moonlight';
  return 'amber';
}

/**
 * Draw full-bleed chapter WebP background with smooth crossfade transition on chapter switch.
 * Returns exact cover projection rect of the 750x1334 canvas inside the portrait stage column.
 */
function renderLobbyChapterBg(ctx, width, height, chapNum, app, sprites) {
  const c = getSafeCtx(ctx);
  const isWide = width > height * 0.95;
  const stageW = isWide ? Math.min(440, Math.round(height * 0.57)) : width;
  const stageX = isWide ? Math.round((width - stageW) * 0.5) : 0;

  const curThemeKey = getChapterThemeKey(chapNum);
  const curBgImg = getSprite(sprites, getChapterBgKey(chapNum));

  // On desktop widescreen, paint cozy starry chapter backdrop across outer wings
  if (isWide) {
    UI.drawChapterBackdrop(c, width, height, curThemeKey);
    c.save();
    try {
      c.fillStyle = 'rgba(14, 18, 36, 0.36)';
      c.fillRect(0, 0, stageX, height);
      c.fillRect(stageX + stageW, 0, width - (stageX + stageW), height);
    } finally {
      c.restore();
    }
  }

  const fadeT = app && app.uiAnim ? easeOutCubic(app.uiAnim.chapterFadeTimer) : 1;
  const prevChap = app && app.uiAnim ? app.uiAnim.prevChapter : chapNum;

  c.save();
  try {
    if (isWide) {
      c.beginPath();
      c.rect(stageX, 0, stageW, height);
      c.clip();
    }

    if (fadeT < 0.999 && prevChap !== chapNum) {
      const prevBgImg = getSprite(sprites, getChapterBgKey(prevChap));
      if (prevBgImg) {
        UI.drawCoverImage(c, prevBgImg, stageX, 0, stageW, height, 0.5);
      } else {
        UI.drawChapterBackdrop(c, width, height, getChapterThemeKey(prevChap));
      }
      c.globalAlpha = fadeT;
    }

    if (curBgImg) {
      UI.drawCoverImage(c, curBgImg, stageX, 0, stageW, height, 0.5);
    } else {
      UI.drawChapterBackdrop(c, width, height, curThemeKey);
    }
  } finally {
    c.restore();
  }

  if (isWide) {
    c.save();
    try {
      c.strokeStyle = 'rgba(255, 232, 178, 0.32)';
      c.lineWidth = 2;
      c.strokeRect(stageX, 0, stageW, height);
    } finally {
      c.restore();
    }
  }

  // Exact cover projection geometry for LOBBY_LAYOUT_NORMALIZED (750 x 1334)
  const baseW = LOBBY_LAYOUT_NORMALIZED.baseWidth || 750;
  const baseH = LOBBY_LAYOUT_NORMALIZED.baseHeight || 1334;
  const coverScale = Math.max(stageW / baseW, height / baseH);
  const drawW = baseW * coverScale;
  const drawH = baseH * coverScale;
  const drawX = stageX + (stageW - drawW) * 0.5;
  const drawY = (height - drawH) * 0.5;

  return { stageX, stageW, drawX, drawY, drawW, drawH, isWide };
}

/**
 * Lobby top-left player avatar + stardust pill & top-right stacked circular wood buttons (Design 02a/02b/02c)
 * Strictly satisfies WeChat capsule clearance (`y >= menuRect.bottom + 8` for right-side buttons!)
 */
function renderLobbyChrome(ctx, geom, stageInfo, app, hits) {
  const c = getSafeCtx(ctx);
  const { width, topY, headerH, headerBottom, maxRight } = geom;
  const { stageX, stageW, isWide } = stageInfo;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};

  // 1. Top-left Player Avatar + Snug Stardust Currency Pill (clears plaque rope & WeChat capsule)
  const leftMargin = isWide ? stageX + 12 : 12;
  const chipH = Math.min(28, Math.max(24, headerH - 2));
  const chipY = topY + Math.floor((headerH - chipH) * 0.5);
  const avatarS = chipH + 8;
  const avatarCx = leftMargin + avatarS * 0.5;
  const avatarCy = chipY + chipH * 0.5;

  const dustText = String(saveData.bankStardust || 0);
  const dustX = leftMargin + Math.round(avatarS * 0.48);
  const dustLeftPad = Math.round(avatarS * 0.56);
  const dustIconSz = Math.min(chipH - 3, Math.round(chipH * 0.72));
  const dustFontSz = 13;
  c.font = UI.fontStr(dustFontSz, 800);
  const dustNumW = Math.ceil(c.measureText(dustText).width);
  const maxDustW = Math.max(66, Math.min(110, maxRight - dustX - 6));
  const dustW = clamp(dustLeftPad + dustIconSz + 5 + dustNumW + 13, 74, maxDustW);

  UI.drawCurrencyChip(
    c,
    dustX,
    chipY,
    dustW,
    chipH,
    sprites,
    'icon_star_coin',
    dustText,
    { fontSize: dustFontSz, leftPad: dustLeftPad, rightPad: 10, iconGap: 5, align: 'left' }
  );

  // Default manager avatar icon overlapping left end of stardust pill (Design 02a)
  const drewAv = UI.drawUiIcon(c, sprites, 'icon_avatar_default', avatarCx, avatarCy, avatarS);
  if (!drewAv) {
    c.save();
    try {
      c.beginPath();
      c.arc(avatarCx, avatarCy, avatarS * 0.48, 0, Math.PI * 2);
      c.fillStyle = '#FFF3DF';
      c.fill();
      c.lineWidth = 2.4;
      c.strokeStyle = '#5A3928';
      c.stroke();
    } finally {
      c.restore();
    }
  }

  // 2. Right-side vertically stacked circular wood buttons: 乐 / 音 / ? (strictly below WeChat capsule!)
  const btnS = width <= 380 ? 33 : 35;
  const btnR = btnS * 0.5;
  const btnGap = 7;
  const rightEdge = isWide ? Math.min(width - 14, stageX + stageW + 46) : width - 10;
  const btnX = Math.round(rightEdge - btnS);
  const startY = Math.max(headerBottom + 8, topY + headerH + 8);

  const bgmOn = app.audio ? Boolean(app.audio.bgmEnabled && app.audio.bgmTrack !== 'off') : true;
  const sfxOn = app.audio ? Boolean(app.audio.sfxEnabled) : true;

  const bgmY = startY;
  drawCircularWoodButton(c, btnX + btnR, bgmY + btnR, btnR, {
    label: '乐',
    muted: !bgmOn,
    pressed: isHitPressed(app, 'lobby_bgm_btn')
  });
  hits.add('lobby_bgm_btn', btnX, bgmY, btnS, btnS, () => app.cycleBgm());

  const sfxY = bgmY + btnS + btnGap;
  drawCircularWoodButton(c, btnX + btnR, sfxY + btnR, btnR, {
    label: '音',
    muted: !sfxOn,
    pressed: isHitPressed(app, 'lobby_sfx_btn')
  });
  hits.add('lobby_sfx_btn', btnX, sfxY, btnS, btnS, () => app.toggleSfx());

  const helpY = sfxY + btnS + btnGap;
  drawCircularWoodButton(c, btnX + btnR, helpY + btnR, btnR, {
    label: '?',
    pressed: isHitPressed(app, 'lobby_help_btn')
  });
  hits.add('lobby_help_btn', btnX, helpY, btnS, btnS, () => app.openModal('help'));

  return { utilLeftX: btnX, utilBottomY: helpY + btnS };
}

/**
 * Top hanging fairy-light wooden plaque (`lobby_plaque_blank`) + `<` `>` chapter switchers + `总星 X/90` pill
 */
function renderLobbyPlaqueHeader(ctx, geom, stageInfo, chromeInfo, app, hits) {
  const c = getSafeCtx(ctx);
  const { topY, headerBottom } = geom;
  const { stageX, stageW } = stageInfo;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const maxChapter = Math.max(1, CHAPTERS.length);
  const chapNum = clamp(Math.round(Number(app.selectedChapter) || 1), 1, maxChapter);
  const chap = CHAPTERS[chapNum - 1] || CHAPTERS[0];
  const chapStatus = isChapterUnlocked(chapNum, saveData.levelStars);
  const totalStars = computeTotalStars(saveData.levelStars);

  const plaqueSpec = LOBBY_LAYOUT_NORMALIZED.plaque;
  const wRatio = stageW <= 380 ? 0.56 : plaqueSpec.wRatio;
  const plaqueW = Math.round(stageW * wRatio);
  const plaqueH = Math.round(plaqueW * plaqueSpec.aspectHOverW);
  const plaqueX = Math.round(stageX + (stageW - plaqueW) * 0.5);
  // Align top hanging nail cleanly with the top chrome row (stays below iPhone notch/Dynamic Island)
  const plaqueY = Math.max(4, topY - 4);

  const plaqueImg = getSprite(sprites, 'lobby_plaque_blank');
  if (plaqueImg) {
    c.drawImage(plaqueImg, plaqueX, plaqueY, plaqueW, plaqueH);
  } else {
    UI.drawWoodBoard(c, plaqueX, plaqueY + Math.round(plaqueH * 0.25), plaqueW, Math.round(plaqueH * 0.72), 13, true);
  }

  // Outlined Title & Chapter Subtitle inside wooden plaque (Design 02a/02b/02c)
  const plaqueCx = plaqueX + plaqueW * 0.5;
  UI.drawOutlinedText(c, GAME_TITLE, plaqueCx, plaqueY + plaqueH * plaqueSpec.titleYInPlaque, {
    size: clamp(Math.round(plaqueW * 0.155), 24, 34),
    weight: 900,
    fill: '#FFE788',
    stroke: '#5A3928',
    strokeWidth: 4.8,
    shadowOffsetY: 2.0,
    maxWidth: plaqueW * 0.85
  });

  const subText = chapStatus.unlocked
    ? `第${chap.chapter}章 · ${chap.name}`
    : `第${chap.chapter}章 · ${chap.name} (未解锁)`;
  UI.drawOutlinedText(c, subText, plaqueCx, plaqueY + plaqueH * plaqueSpec.subtitleYInPlaque, {
    size: clamp(Math.round(plaqueW * 0.068), 11.5, 15.5),
    weight: 800,
    fill: chapStatus.unlocked ? '#FFF8EC' : '#FFD1B8',
    stroke: '#5A3928',
    strokeWidth: 2.6,
    shadowOffsetY: 1.0,
    maxWidth: plaqueW * 0.86
  });

  // Left '<' and Right '>' Chapter Switch Chevrons (vertically centered on wooden board, strictly below capsule!)
  const chevW = 26;
  const chevH = 34;
  const chevY = Math.max(headerBottom + 4, Math.round(plaqueY + plaqueH * 0.65 - chevH * 0.5));
  const maxNextX = chromeInfo.utilLeftX - chevW - 4;
  const idealSideGap = Math.max(4, Math.min(10, Math.floor((chromeInfo.utilLeftX - (plaqueX + plaqueW) - chevW) * 0.45)));
  const nextX = Math.min(maxNextX, plaqueX + plaqueW + idealSideGap);
  const prevX = Math.max(stageX + 8, plaqueX - idealSideGap - chevW);

  drawChevronIcon(
    c,
    prevX + chevW * 0.5,
    chevY + chevH * 0.5,
    19,
    'left',
    chapNum > 1 ? '#FFF6E3' : '#DCCAB4',
    chapNum > 1 ? 1 : 0.60
  );
  hits.add('chapter_prev', prevX, chevY, chevW, chevH, () => app.switchChapter(-1));

  drawChevronIcon(
    c,
    nextX + chevW * 0.5,
    chevY + chevH * 0.5,
    19,
    'right',
    chapNum < maxChapter ? '#FFF6E3' : '#DCCAB4',
    chapNum < maxChapter ? 1 : 0.60
  );
  hits.add('chapter_next', nextX, chevY, chevW, chevH, () => app.switchChapter(1));

  // Total Stars Wood Pill directly under plaque (`总星 24/90`) with snug centered grouping
  const starText = `总星 ${totalStars}/${MAX_CAMPAIGN_STARS}`;
  const starFontSz = 12;
  c.font = UI.fontStr(starFontSz, 800);
  const starTextW = Math.ceil(c.measureText(starText).width);
  const starPillH = 26;
  const starPillW = clamp(starTextW + 46, 108, Math.min(134, Math.round(plaqueW * 0.62)));
  const starPillX = Math.round(plaqueCx - starPillW * 0.5);
  const starPillY = plaqueY + plaqueH + 4;
  UI.drawCurrencyChip(
    c,
    starPillX,
    starPillY,
    starPillW,
    starPillH,
    sprites,
    'icon_star_coin',
    starText,
    { fontSize: starFontSz, groupCenter: true, iconGap: 5, leftPad: 10, rightPad: 10 }
  );

  return { headerBottomY: starPillY + starPillH };
}

function drawPerspectiveOvalPath(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  if (typeof ctx.ellipse === 'function') {
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  } else {
    ctx.arc(cx, cy, Math.round((rx + ry) * 0.5), 0, Math.PI * 2);
  }
}

/**
 * 10 3D Perspective Level Nodes placed on chapter-specific road coordinates along the hand-painted path
 */
function renderLobbyLevelNodes(ctx, stageInfo, bounds, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const { stageX, stageW, drawX, drawY, drawW, drawH } = stageInfo;
  const { minY, maxY } = bounds;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const chapNum = clamp(Math.round(Number(app.selectedChapter) || 1), 1, Math.max(1, CHAPTERS.length));
  const frontierId = saveData.highestUnlockedLevel || '1-1';
  const nodeR = clamp(Math.round(stageW * 0.052), 18, 22);
  const rx = Math.round(nodeR * 1.12);
  const ry = Math.round(nodeR * 0.94);
  const lipH = 3.5;

  // Subtle horizontal slide-in on chapter switch (visual-only offset; HitRegistry uses resting bounds!)
  const fadeT = app && app.uiAnim ? easeOutCubic(app.uiAnim.chapterFadeTimer) : 1;
  const slideDir = app && app.uiAnim ? app.uiAnim.chapterSlideDir || 0 : 0;
  const visualSlideX = fadeT < 0.999 ? slideDir * (1 - fadeT) * 28 : 0;

  const byChap = LOBBY_LAYOUT_NORMALIZED.levelNodesByChapter;
  const nodesSpec = (byChap && byChap[chapNum]) || LOBBY_LAYOUT_NORMALIZED.levelNodes10;
  for (let i = 0; i < nodesSpec.length; i++) {
    const spec = nodesSpec[i];
    const levelId = `${chapNum}-${spec.level}`;
    const unlockInfo = isLevelUnlocked(levelId, saveData.levelStars);
    const rawStar = saveData.levelStars && saveData.levelStars[levelId];
    const stars = Number.isFinite(rawStar) && rawStar > 0 ? Math.min(3, Math.floor(rawStar)) : 0;
    const isFrontier = unlockInfo.unlocked && levelId === frontierId;
    const isBoss = spec.level === 10;

    // Project chapter-specific normalized road coordinates onto cover background, clamped inside safe corridor
    const rawCx = drawX + spec.nx * drawW;
    const rawCy = drawY + spec.ny * drawH;
    const cx = Math.round(clamp(rawCx, stageX + rx + 4, stageX + stageW - rx - 4));
    const cy = Math.round(clamp(rawCy, minY + ry + 2, maxY - ry - 14));

    const hitId = `level_node_${levelId}`;
    const pressed = isHitPressed(app, hitId);
    const vCx = cx + visualSlideX;
    const vCy = cy + (pressed ? 1.5 : 0);

    c.save();
    try {
      if (fadeT < 0.999) c.globalAlpha = 0.25 + 0.75 * fadeT;

      // Soft perspective cast shadow on the road
      drawPerspectiveOvalPath(c, vCx, vCy + lipH + 2.4, rx * 1.03, ry * 0.92);
      c.fillStyle = 'rgba(26, 18, 18, 0.28)';
      c.fill();

      // Golden breathing halo around current frontier level node
      if (isFrontier) {
        const pulse = 0.68 + 0.32 * Math.sin(nowSec * 4.5);
        const aura = c.createRadialGradient(vCx, vCy, nodeR * 0.55, vCx, vCy, nodeR * 1.72);
        aura.addColorStop(0, `rgba(255, 226, 118, ${(0.72 * pulse).toFixed(3)})`);
        aura.addColorStop(0.6, `rgba(255, 206, 86, ${(0.34 * pulse).toFixed(3)})`);
        aura.addColorStop(1, 'rgba(255, 206, 86, 0)');
        c.fillStyle = aura;
        c.beginPath();
        c.arc(vCx, vCy, nodeR * 1.72, 0, Math.PI * 2);
        c.fill();
      }

      // 3D perspective pedestal lip (cool dark slate for locked, warm caramel/tan for unlocked)
      const strokeColor = !unlockInfo.unlocked
        ? '#3A3F48'
        : isBoss
          ? '#B86A16'
          : '#5A3928';
      drawPerspectiveOvalPath(c, vCx, vCy + lipH, rx, ry);
      c.fillStyle = !unlockInfo.unlocked ? '#4D535E' : isFrontier ? '#BD6E14' : '#C49B72';
      c.fill();
      c.lineWidth = 2.1;
      c.strokeStyle = strokeColor;
      c.stroke();

      // Main 3D perspective disc top surface
      const grad = c.createLinearGradient(vCx, vCy - ry, vCx, vCy + ry);
      if (!unlockInfo.unlocked) {
        grad.addColorStop(0, '#8F96A1');
        grad.addColorStop(1, '#6C737E');
      } else if (isFrontier) {
        grad.addColorStop(0, '#FFEB88');
        grad.addColorStop(1, '#F3A020');
      } else {
        grad.addColorStop(0, '#FFFDF8');
        grad.addColorStop(1, '#F4E2C4');
      }
      drawPerspectiveOvalPath(c, vCx, vCy, rx, ry);
      c.fillStyle = grad;
      c.fill();
      c.lineWidth = isFrontier ? 2.5 : 2.2;
      c.strokeStyle = strokeColor;
      c.stroke();

      // Bright cream inner ring on frontier disc (Design 02a/02b/02c signature highlight)
      if (isFrontier) {
        drawPerspectiveOvalPath(c, vCx, vCy, Math.max(4, rx - 3.2), Math.max(4, ry - 2.8));
        c.strokeStyle = 'rgba(255, 252, 232, 0.72)';
        c.lineWidth = 1.8;
        c.stroke();
      } else {
        // Subtle top sheen arc
        c.beginPath();
        if (typeof c.ellipse === 'function') {
          c.ellipse(vCx, vCy, Math.max(4, rx - 2.8), Math.max(4, ry - 2.4), 0, -Math.PI * 0.82, -Math.PI * 0.18);
        } else {
          c.arc(vCx, vCy, Math.max(4, nodeR - 2.6), -Math.PI * 0.82, -Math.PI * 0.18);
        }
        c.strokeStyle = !unlockInfo.unlocked ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.65)';
        c.lineWidth = 1.4;
        c.stroke();
      }

      if (!unlockInfo.unlocked) {
        // Engraved cool slate padlock matching 02a/02b/02c locked stone medallions
        drawLockIcon(c, vCx, vCy + 0.5, Math.round(nodeR * 0.82), {
          forceVector: true,
          bodyColor: '#7A818D',
          shackleColor: '#3A3F48',
          borderColor: '#3A3F48'
        });
      } else {
        // Level label e.g. '1-6'
        UI.drawOutlinedText(c, levelId, vCx, vCy + 0.5, {
          size: Math.max(11.5, Math.round(nodeR * 0.64)),
          weight: 900,
          fill: '#5A3928',
          stroke: '',
          strokeWidth: 0,
          shadowOffsetY: 0,
          maxWidth: rx * 1.68
        });

        // 3 mini stars tucked tightly beneath the disc in a subtle smile arc (matching 02a/02b/02c)
        const starBaseY = vCy + ry + 6.5;
        const starStep = Math.min(12.2, Math.round(rx * 0.56));
        for (let s = 1; s <= 3; s++) {
          const arcDip = s === 2 ? 1.8 : 0;
          UI.drawStarIcon(c, vCx + (s - 2) * starStep, starBaseY + arcDip, 5.2, s <= stars, { sprites });
        }

        // Bouncing cat-paw marker floating above current frontier node!
        if (isFrontier) {
          const pawBounce = Math.abs(Math.sin(nowSec * 3.8)) * 5.2;
          const pawS = Math.round(nodeR * 1.54);
          UI.drawUiIcon(c, sprites, 'icon_paw_marker', vCx + 4, vCy - ry - pawS * 0.45 - pawBounce, pawS);
        }
      }
    } finally {
      c.restore();
    }

    const levelIdCopy = levelId;
    hits.add(hitId, cx - nodeR, cy - nodeR, nodeR * 2, nodeR * 2, () =>
      app.onTapLevelNode(levelIdCopy)
    );
  }
}

/**
 * Cozy Patron Dialogue Bar matching Design 02a/02b/02c
 * - Sleek cream rounded card (no clunky outer wood slab)
 * - Larger pop-out patron portrait breaking above the card top border (no flat circle behind it)
 * - Seamless speech balloon with vertically centered wrapped dialogue
 * - Soft caramel '切换搭档' button with crisp vector downward triangle
 */
function renderPatronBar(ctx, rect, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const { x, y, w, h } = rect;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const patronId = normalizePatronId(saveData.selectedPatron);
  const patron = PATRONS.find((p) => p.id === patronId) || PATRONS[0];
  const cardR = 14;

  // Sleek cream parchment card with warm dark-brown outline & soft bottom shadow lip (Design 02a/02b/02c)
  c.save();
  try {
    UI.roundRectPath(c, x, y + 3, w, h, cardR);
    c.fillStyle = 'rgba(42, 24, 16, 0.34)';
    c.fill();

    const cardGrad = c.createLinearGradient(x, y, x, y + h);
    cardGrad.addColorStop(0, '#FFFDF7');
    cardGrad.addColorStop(0.65, '#FCF3E2');
    cardGrad.addColorStop(1, '#F4E4C8');
    UI.roundRectPath(c, x, y, w, h, cardR);
    c.fillStyle = cardGrad;
    c.fill();
    c.lineWidth = 2.6;
    c.strokeStyle = '#5A3928';
    c.stroke();

    // Subtle crisp top inner sheen
    UI.roundRectPath(c, x + 2.5, y + 2.2, w - 5, Math.max(8, h * 0.25), Math.max(4, cardR - 2));
    c.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    c.lineWidth = 1.2;
    c.stroke();
  } finally {
    c.restore();
  }

  // Larger patron portrait popping cleanly above the top card border (NO flat beige circle behind it)
  const avatarS = Math.min(h + 16, 76);
  const avatarCx = x + 6 + avatarS * 0.52;
  const bounce = app.patronPokeTimer > 0 ? Math.sin(app.patronPokeTimer * 26) * 3.8 : Math.sin(nowSec * 2.4) * 1.2;
  const avatarCy = y + h * 0.34 + bounce;
  UI.drawUiIcon(c, sprites, patron.id, avatarCx, avatarCy, avatarS);

  // Warm butter-gold name pill overlapping bottom border under patron portrait (`小蜜柑`)
  const namePillW = Math.min(72, Math.max(60, avatarS - 4));
  const namePillH = 19;
  const namePillX = Math.round(avatarCx - namePillW * 0.5);
  const namePillY = Math.round(y + h - namePillH * 0.72);
  UI.drawTagBadge(c, namePillX, namePillY, namePillW, namePillH, patron.name, 'butter', 10.5);

  // Right-side warm caramel '切换搭档' button with crisp vector caret
  const btnW = Math.min(92, Math.max(78, Math.round(w * 0.25)));
  const btnH = Math.min(34, h - 18);
  const btnX = x + w - 9 - btnW;
  const btnY = Math.round(y + (h - btnH) * 0.5);

  UI.drawPillButton(c, btnX, btnY, btnW, btnH, {
    style: 'caramel',
    text: '切换搭档',
    trailingCaret: true,
    fontSize: 11.2,
    borderWidth: 2.0,
    radius: 10,
    pressed: isHitPressed(app, 'lobby_patron_switch')
  });
  hits.add('lobby_patron_switch', btnX, btnY, btnW, btnH, () => app.cycleOrOpenPatrons());

  // Seamless speech balloon in center with vertically centered wrapped text
  const balloonX = x + 12 + avatarS;
  const balloonW = Math.max(70, btnX - 8 - balloonX);
  const balloonY = y + 8;
  const balloonH = h - 16;
  drawSpeechBalloon(c, balloonX, balloonY, balloonW, balloonH, balloonX - 7, balloonY + balloonH * 0.54);

  const speechLine = app.currentPatronLine || patron.greet;
  const speechFontSz = balloonH >= 48 ? 11.8 : 11.0;
  const speechFont = UI.fontStr(speechFontSz, 800);
  const maxTextW = Math.max(36, balloonW - 18);
  const rawLines = typeof UI.wrapText === 'function' ? UI.wrapText(c, speechLine, maxTextW, speechFont) : [speechLine];
  const lines = Array.isArray(rawLines) && rawLines.length > 0 ? rawLines.slice(0, 2) : [speechLine];
  const lineH = Math.round(speechFontSz * 1.32);
  const totalTextH = lines.length * lineH;
  const firstLineCy = balloonY + (balloonH - totalTextH) * 0.5 + lineH * 0.5 + 0.5;

  c.save();
  try {
    c.font = speechFont;
    c.fillStyle = '#5A3928';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    for (let li = 0; li < lines.length; li++) {
      c.fillText(lines[li], balloonX + 9, firstLineCy + li * lineH, maxTextW);
    }
  } finally {
    c.restore();
  }

  // Non-HitRegistry poke area for tactile mascot interaction
  app.lobbyPatronPokeRect = { x, y, w: Math.max(40, btnX - 4 - x), h };
}

/**
 * Full-width dark walnut bottom dock bar with 4 elevated illustrated PNG icons (`02a/02b/02c`)
 */
function renderLobbyBottomDock(ctx, rect, app, hits) {
  const c = getSafeCtx(ctx);
  const { x, y, w, h, fullW, fullBottom } = rect;
  const sprites = app.sprites || {};

  // Dark walnut full-width dock background bar with rounded top corners & subtle wood bevel highlight
  c.save();
  try {
    const barW = fullW || w;
    const barX = fullW ? 0 : x;
    const barH = Math.max(h + 8, (fullBottom || y + h) - y);
    const grad = c.createLinearGradient(barX, y, barX, y + barH);
    grad.addColorStop(0, '#7B5034');
    grad.addColorStop(0.14, '#603C26');
    grad.addColorStop(1, '#422617');
    c.fillStyle = grad;
    UI.roundRectPath(c, barX, y, barW, barH, [18, 18, 0, 0]);
    c.fill();
    c.lineWidth = 2.4;
    c.strokeStyle = '#341C0F';
    c.stroke();

    // Subtle warm wood inner bevel along top edge
    c.beginPath();
    c.moveTo(barX + 18, y + 2.4);
    c.lineTo(barX + barW - 18, y + 2.4);
    c.strokeStyle = 'rgba(255, 224, 184, 0.22)';
    c.lineWidth = 1.4;
    c.stroke();
  } finally {
    c.restore();
  }

  const gap = 3;
  const colW = Math.floor((w - gap * 4) / 5);
  const saveData = app.saveData || {};
  const dailyUnlocked = typeof app.isDailyUnlocked === 'function' ? app.isDailyUnlocked() : false;
  const dailyClaimed =
    saveData.modeStats &&
    saveData.modeStats.daily &&
    saveData.modeStats.daily.claimedDate &&
    saveData.modeStats.daily.claimedDate.length === 8;
  const items = [
    {
      id: 'dock_shop',
      label: '小铺',
      icon: 'dock_shop',
      redDot: typeof app.hasAffordableShopItem === 'function' ? app.hasAffordableShopItem() : false,
      onClick: () => app.openShop('catcakes')
    },
    {
      id: 'dock_compendium',
      label: '图鉴',
      icon: 'dock_compendium',
      redDot: false,
      onClick: () => app.openCompendium('catcakes')
    },
    {
      id: 'dock_challenge',
      label: '挑战',
      icon: 'icon_trophy',
      redDot: Boolean(dailyUnlocked && !dailyClaimed),
      onClick: () => app.openChallenge()
    },
    {
      id: 'dock_leaderboard',
      label: '排行',
      icon: 'dock_rank',
      redDot: false,
      onClick: () => app.openLeaderboard('stars')
    },
    {
      id: 'dock_themes',
      label: '主题',
      icon: 'dock_theme',
      redDot: typeof app.hasAffordableShopTab === 'function' ? app.hasAffordableShopTab('themes') : false,
      onClick: () => app.openShop('themes')
    }
  ];

  // Larger icons slightly elevated so their tops gently pop above the walnut rim (exact 02a/02b/02c look)
  const iconS = Math.min(40, Math.max(32, Math.round(h * 0.66)));
  const iconCyBase = y + Math.round(h * 0.28);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const bx = x + i * (colW + gap);
    const cx = bx + colW * 0.5;
    const pressed = isHitPressed(app, it.id);
    const dy = pressed ? 2 : 0;

    UI.drawUiIcon(c, sprites, it.icon, cx, iconCyBase + dy, iconS);
    UI.drawOutlinedText(c, it.label, cx, y + h * 0.80 + dy, {
      size: h >= 58 ? 11.8 : 10.8,
      weight: 800,
      fill: '#FFF8EC',
      stroke: '#351C0F',
      strokeWidth: 2.4,
      shadowOffsetY: 0.7,
      maxWidth: colW - 4
    });
    if (it.redDot) {
      drawRedDot(c, cx + iconS * 0.35, iconCyBase - iconS * 0.33 + dy, 4.2);
    }
    hits.add(it.id, bx, y, colW, h, it.onClick);
  }
}

function renderLobbyScreen(ctx, metrics, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const geom = computeTopHeaderGeometry(metrics);
  const { width, height, bottomLimit } = geom;
  const saveData = app.saveData || {};
  const sprites = app.sprites || {};
  const chapNum = clamp(Math.round(Number(app.selectedChapter) || 1), 1, Math.max(1, CHAPTERS.length));

  const ctaLevelId = saveData.highestUnlockedLevel || '1-1';
  const ctaLevel = getLevelById(ctaLevelId) || getLevelById('1-1');
  const ctaStar1 = ctaLevel && ctaLevel.stars ? ctaLevel.stars[0] : 850;
  const ctaStar1Str = Number(ctaStar1 || 0).toLocaleString('en-US');

  app.currentBoardLayout = null;
  app.guideTargets = null;

  // 1. Full-bleed chapter hand-painted background (`bg_lobby_ch1/2/3`) + crossfade
  const stageInfo = renderLobbyChapterBg(c, width, height, chapNum, app, sprites);
  const { stageX, stageW } = stageInfo;

  // 2. Top-left avatar+stardust & top-right stacked circular buttons (below WeChat capsule)
  const chromeInfo = renderLobbyChrome(c, geom, stageInfo, app, hits);

  // 3. Top hanging fairy-light plaque + '<' '>' chapter buttons + '总星 X/90' wood pill
  const plaqueInfo = renderLobbyPlaqueHeader(c, geom, stageInfo, chromeInfo, app, hits);
  app.lobbyHeaderBottomY = plaqueInfo.headerBottomY;

  // 4. Bottom Chrome Stack: Dark Wood Dock + Full-Pill Honey-Gold CTA + Patron Dialogue Bar
  const compact = height < 720;
  const padX = 12;
  const innerX = stageX + padX;
  const innerW = stageW - padX * 2;

  const dockH = compact ? 54 : 60;
  const dockY = bottomLimit - dockH;
  renderLobbyBottomDock(
    c,
    { x: innerX, y: dockY, w: innerW, h: dockH, fullW: width, fullBottom: height },
    app,
    hits
  );

  const ctaH = compact ? 48 : 54;
  const ctaW = Math.min(innerW - 20, Math.round(stageW * 0.66));
  const ctaX = Math.round(stageX + (stageW - ctaW) * 0.5);
  const ctaY = dockY - (compact ? 12 : 14) - ctaH;

  UI.drawPillButton(c, ctaX, ctaY, ctaW, ctaH, {
    style: 'cta',
    label: `开始营业 · 第 ${ctaLevelId} 关`,
    subPrefix: '1星目标',
    subIcon: 'icon_star_coin',
    subSuffix: ctaStar1Str,
    sprites,
    fontSize: compact ? 16 : 17.5,
    radius: Math.round(ctaH * 0.5),
    pressed: isHitPressed(app, 'lobby_start_cta')
  });
  hits.add('lobby_start_cta', ctaX, ctaY, ctaW, ctaH, () => app.startLevel(ctaLevelId));

  const patronH = compact ? 60 : 68;
  const patronY = ctaY - (compact ? 10 : 12) - patronH;
  renderPatronBar(c, { x: innerX, y: patronY, w: innerW, h: patronH }, app, hits, nowSec);

  // 5. 10 Winding-Road Level Nodes strictly within safe corridor between plaque & patron bar
  renderLobbyLevelNodes(
    c,
    stageInfo,
    { minY: plaqueInfo.headerBottomY + 6, maxY: patronY - 8 },
    app,
    hits,
    nowSec
  );
}

/**
 * Reserve Title Screen renderer matching `01_标题首屏_TitleScreen（备用）.jpg`
 * Available for future activation without re-architecting (currently boots directly to Lobby per user decision).
 */
function renderTitleScreen(ctx, metrics, app, hits) {
  const c = getSafeCtx(ctx);
  const geom = computeTopHeaderGeometry(metrics);
  const { width, height, topY, headerH, bottomLimit } = geom;
  const saveData = (app && app.saveData) || {};
  const sprites = (app && app.sprites) || {};
  const totalStars = computeTotalStars(saveData.levelStars);
  const rankTitle = getChefRank(saveData);

  const heroImg = getSprite(sprites, 'title_hero_v2');
  if (heroImg) {
    UI.drawCoverImage(c, heroImg, 0, 0, width, height, 0.5);
  } else {
    UI.drawChapterBackdrop(c, width, height, 'amber');
  }

  // Top-left circular wood sound & help buttons
  const btnS = 34;
  const btnR = btnS * 0.5;
  const btnY = topY + Math.floor((headerH - btnS) * 0.5);
  const sfxOn = app && app.audio ? Boolean(app.audio.sfxEnabled) : true;
  drawCircularWoodButton(c, 12 + btnR, btnY + btnR, btnR, { label: '音', muted: !sfxOn });
  drawCircularWoodButton(c, 12 + btnS + 8 + btnR, btnY + btnR, btnR, { label: '?' });
  if (hits && app) {
    hits.add('title_sfx_btn', 12, btnY, btnS, btnS, () => app.toggleSfx());
    hits.add('title_help_btn', 20 + btnS, btnY, btnS, btnS, () => app.openModal('help'));
  }

  // Cat-ear wooden plaque banner
  const plaqueW = Math.min(310, Math.round(width * 0.78));
  const plaqueH = Math.round(plaqueW * 0.62);
  const plaqueX = Math.round((width - plaqueW) * 0.5);
  const plaqueY = Math.max(topY + headerH + 6, Math.round(height * 0.06));
  const plaqueImg = getSprite(sprites, 'title_plaque_banner');
  if (plaqueImg) {
    UI.drawContainImage(c, plaqueImg, width * 0.5, plaqueY + plaqueH * 0.5, plaqueW, plaqueH);
  } else {
    UI.drawWoodBoard(c, plaqueX, plaqueY, plaqueW, plaqueH * 0.72, 16, true);
  }
  UI.drawOutlinedText(c, GAME_TITLE, width * 0.5, plaqueY + plaqueH * 0.44, {
    size: 30,
    weight: 900,
    fill: '#FFE58F',
    stroke: '#5A3928',
    strokeWidth: 4.8
  });
  UI.drawOutlinedText(c, '星夜吃茶 · 烘焙小铺', width * 0.5, plaqueY + plaqueH * 0.80, {
    size: 13.5,
    weight: 800,
    fill: '#FFF8EC',
    stroke: '#5A3928',
    strokeWidth: 2.6
  });

  // Bottom rank pill + Start CTA + Version footer
  const ctaW = Math.min(260, Math.round(width * 0.68));
  const ctaH = 54;
  const ctaX = Math.round((width - ctaW) * 0.5);
  const ctaY = bottomLimit - 34 - ctaH;

  const rankW = Math.min(250, Math.round(width * 0.66));
  const rankH = 30;
  UI.drawCurrencyChip(
    c,
    Math.round((width - rankW) * 0.5),
    ctaY - 12 - rankH,
    rankW,
    rankH,
    sprites,
    'icon_star_coin',
    `${rankTitle} · 总星 ${totalStars}/${MAX_CAMPAIGN_STARS}`,
    { fontSize: 11.5 }
  );

  UI.drawPillButton(c, ctaX, ctaY, ctaW, ctaH, {
    style: 'cta',
    label: '开始营业',
    fontSize: 22,
    radius: 26
  });
  if (hits && app) {
    hits.add('title_start_btn', ctaX, ctaY, ctaW, ctaH, () => {
      app.screen = 'lobby';
    });
  }

  UI.drawOutlinedText(c, `v${GAME_VERSION}`, width * 0.5, bottomLimit - 12, {
    size: 12,
    weight: 700,
    fill: '#D8DFEF',
    stroke: '#1A213D',
    strokeWidth: 2.0,
    shadowOffsetY: 0
  });
}

/* ======================== Play Screen HUD (`03_局内营业主界面`) ======================== */

/**
 * Draw pixel-aligned PlayScreen interior bands:
 * - Warm sunlit blurred cafe wall behind customers (`playBarBottom .. trayY`)
 * - Rich dark-walnut wooden tabletop below tray (`trayY .. height`)
 * - Starry night sky + rounded-bottom dark-navy top HUD shelf (`0 .. playBarBottom`)
 */
function renderPlayInteriorBands(ctx, geom, playBarBottom, trayY, theme, nowSec) {
  const c = getSafeCtx(ctx);
  const { width, height, topY, headerH } = geom;
  const th = theme && typeof theme === 'object' ? theme : BOARD_THEMES.amber;
  const isSakura = th.id === 'sakura';
  const isMoon = th.id === 'moonlight';

  c.save();
  try {
    // 1. Warm blurred sunlit bakery cafe interior wall behind customers (Design 03)
    const wallTop = Math.max(0, playBarBottom - 10);
    const wallBot = Math.max(wallTop + 20, trayY + 2);
    const wallG = c.createLinearGradient(0, wallTop, 0, wallBot);
    if (isSakura) {
      wallG.addColorStop(0, '#B88496');
      wallG.addColorStop(0.55, '#DFB3BC');
      wallG.addColorStop(1, '#CCA0AB');
    } else if (isMoon) {
      wallG.addColorStop(0, '#364774');
      wallG.addColorStop(0.55, '#546897');
      wallG.addColorStop(1, '#445886');
    } else {
      wallG.addColorStop(0, '#D4A879');
      wallG.addColorStop(0.45, '#ECD4AD');
      wallG.addColorStop(1, '#D6AA78');
    }
    c.fillStyle = wallG;
    c.fillRect(0, wallTop, width, wallBot - wallTop);

    // Soft-focus cafe window / wall frame panels behind customers for warm cozy depth
    const panelY = wallTop + 14;
    const panelH = Math.max(24, wallBot - panelY - 24);
    const panelCol = isSakura
      ? 'rgba(255, 240, 246, 0.34)'
      : isMoon
      ? 'rgba(186, 214, 255, 0.16)'
      : 'rgba(255, 249, 232, 0.42)';
    const trimCol = isSakura
      ? 'rgba(128, 72, 92, 0.22)'
      : isMoon
      ? 'rgba(28, 42, 78, 0.34)'
      : 'rgba(138, 86, 46, 0.22)';
    const panelGap = 14;
    const panelW = Math.max(56, Math.round((width - 40 - panelGap * 2) / 3));
    const panelStartX = Math.round((width - (panelW * 3 + panelGap * 2)) * 0.5);
    for (let i = 0; i < 3; i++) {
      const px = panelStartX + i * (panelW + panelGap);
      UI.roundRectPath(c, px, panelY, panelW, panelH, 8);
      c.fillStyle = panelCol;
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = trimCol;
      c.stroke();
    }

    // Soft warm counter ambient vignette along lower wall
    const wallShade = c.createLinearGradient(0, wallBot - 36, 0, wallBot);
    wallShade.addColorStop(0, 'rgba(90, 52, 26, 0)');
    wallShade.addColorStop(1, isMoon ? 'rgba(18, 28, 56, 0.28)' : 'rgba(116, 66, 30, 0.24)');
    c.fillStyle = wallShade;
    c.fillRect(0, wallBot - 36, width, 36);

    // 2. Deep espresso-walnut bakery tabletop below serving tray (`trayY .. height`)
    const tableG = c.createLinearGradient(0, trayY, 0, height);
    if (isSakura) {
      tableG.addColorStop(0, '#5E3645');
      tableG.addColorStop(1, '#40212D');
    } else if (isMoon) {
      tableG.addColorStop(0, '#223154');
      tableG.addColorStop(1, '#151F38');
    } else {
      tableG.addColorStop(0, '#4E3220');
      tableG.addColorStop(0.55, '#472D1C');
      tableG.addColorStop(1, '#3A2315');
    }
    c.fillStyle = tableG;
    c.fillRect(0, trayY, width, Math.max(0, height - trayY));

    // Subtle horizontal tabletop wood plank grooves
    c.strokeStyle = isMoon ? 'rgba(10, 16, 34, 0.34)' : 'rgba(26, 12, 5, 0.26)';
    c.lineWidth = 1.5;
    for (let py = trayY + 56; py < height; py += 62) {
      c.beginPath();
      c.moveTo(0, py);
      c.lineTo(width, py);
      c.stroke();
    }

    // 3. Starry Night Sky + Rounded-Bottom Dark-Navy Header Shelf (`0 .. playBarBottom`)
    c.shadowColor = 'rgba(12, 16, 32, 0.42)';
    c.shadowBlur = 10;
    c.shadowOffsetY = 4;

    const skyG = c.createLinearGradient(0, 0, 0, playBarBottom);
    if (isSakura) {
      skyG.addColorStop(0, '#362144');
      skyG.addColorStop(0.6, '#4C305B');
      skyG.addColorStop(1, '#583864');
    } else if (isMoon) {
      skyG.addColorStop(0, '#121A3D');
      skyG.addColorStop(0.6, '#1D2C5C');
      skyG.addColorStop(1, '#26386F');
    } else {
      skyG.addColorStop(0, '#172242');
      skyG.addColorStop(0.52, '#202D54');
      skyG.addColorStop(1, '#273660');
    }
    c.fillStyle = skyG;
    UI.roundRectPath(c, -2, -2, width + 4, playBarBottom + 2, [0, 0, 16, 16]);
    c.fill();

    c.shadowColor = 'rgba(0, 0, 0, 0)';
    c.shadowBlur = 0;
    c.shadowOffsetY = 0;

    // Subtle starry nebula sheen + tiny twinkling night stars in upper sky row
    const starColor = isSakura ? '#FFD8EB' : '#FFE8A0';
    for (let i = 0; i < 18; i++) {
      const sx = ((i * 89.3 + 17) % 100) * 0.01 * width;
      const sy = ((i * 37.7 + 7) % 100) * 0.01 * Math.max(24, topY + headerH);
      const twinkle = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(nowSec * 2.2 + i * 1.7));
      c.fillStyle = starColor;
      c.globalAlpha = twinkle;
      if (i % 5 === 0) {
        UI.drawStar(c, sx, sy, 3.0, i * 0.6);
      } else {
        c.beginPath();
        c.arc(sx, sy, i % 3 === 0 ? 1.5 : 1.0, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalAlpha = 1;

    // Subtle hairline separator between title row & Play HUD controls row + rounded bottom shelf outline
    c.strokeStyle = 'rgba(130, 160, 220, 0.16)';
    c.lineWidth = 1.0;
    c.beginPath();
    c.moveTo(10, topY + headerH + 2);
    c.lineTo(width - 10, topY + headerH + 2);
    c.stroke();

    c.strokeStyle = '#131B33';
    c.lineWidth = 2.0;
    UI.roundRectPath(c, -2, -2, width + 4, playBarBottom + 2, [0, 0, 16, 16]);
    c.stroke();

    // Centered game title in starry nav bar row (strictly clears WeChat top-right capsule, Design 03)
    const titleCx = Math.round(width * 0.5);
    const titleCy = Math.round(topY + headerH * 0.5 + 0.5);
    const maxTitleRight = geom.maxRight - 6;
    if (titleCx + 42 < maxTitleRight) {
      UI.drawOutlinedText(c, GAME_TITLE, titleCx, titleCy, {
        size: 16.5,
        weight: 800,
        fill: '#FFFDF8',
        stroke: '#162040',
        strokeWidth: 2.6,
        shadowOffsetY: 0.6
      });
    }
  } finally {
    c.restore();
  }
}

/**
 * Chunky warm-wood rounded-square Pause button with crisp outlined `||` bars (Design 03 top-left)
 */
function drawPlayPauseButton(ctx, x, y, size, pressed) {
  const c = getSafeCtx(ctx);
  const s = Math.max(26, Number(size) || 34);
  const rad = Math.min(11, Math.round(s * 0.30));
  const dy = pressed ? 1.5 : 0;
  const bevel = pressed ? 1.5 : 3.0;
  const bodyH = s - 3.0;

  c.save();
  try {
    // 3D wood underside lip
    UI.roundRectPath(c, x, y + dy + bevel, s, bodyH, rad);
    c.fillStyle = '#4E2B17';
    c.fill();
    c.lineWidth = 2.1;
    c.strokeStyle = '#331A0C';
    c.stroke();

    // Warm caramel wood top face
    const g = c.createLinearGradient(x, y + dy, x, y + dy + bodyH);
    g.addColorStop(0, '#BF8350');
    g.addColorStop(0.55, '#915A34');
    g.addColorStop(1, '#714225');
    UI.roundRectPath(c, x, y + dy, s, bodyH, rad);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 2.1;
    c.strokeStyle = '#3A1F0F';
    c.stroke();

    // Inner warm top bevel highlight
    UI.roundRectPath(c, x + 2.2, y + dy + 2.0, s - 4.4, Math.max(6, bodyH * 0.34), Math.max(4, rad - 2));
    c.strokeStyle = 'rgba(255, 236, 206, 0.36)';
    c.lineWidth = 1.3;
    c.stroke();

    // Two thick cream-white rounded vertical pause bars with crisp dark-brown outlines
    const barW = Math.max(4.4, Math.round(s * 0.145));
    const barH = Math.max(12, Math.round(bodyH * 0.48));
    const barGap = Math.max(3.6, Math.round(s * 0.11));
    const bx1 = x + s * 0.5 - barGap * 0.5 - barW;
    const bx2 = x + s * 0.5 + barGap * 0.5;
    const by = y + dy + (bodyH - barH) * 0.5;
    const barR = barW * 0.48;

    for (const bx of [bx1, bx2]) {
      UI.roundRectPath(c, bx, by, barW, barH, barR);
      c.fillStyle = '#FFFDF5';
      c.fill();
      c.lineWidth = 1.8;
      c.strokeStyle = '#4A2512';
      c.stroke();
    }
  } finally {
    c.restore();
  }
}

/**
 * Full-width Play Top HUD Row sitting cleanly BELOW the WeChat capsule (strictly matching Design 03):
 * `[Pause]  [关卡 1-5]  [🕒 01:28]  [    680   ★─★─☆ ]`
 */
function renderPlayTopBar(ctx, barRect, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const { x: bx, y: by, w: bw, h: bh } = barRect;
  const sprites = app.sprites || {};
  const orderState = app.orderState || {};
  const curId = String(app.currentLevelId || orderState.levelId || '1-1');
  const isDaily = curId.indexOf('daily_') === 0;
  const isEndless = curId.indexOf('endless_') === 0;
  const lvl = getLevelById(curId) || getLevelById('1-1');
  const stars =
    Array.isArray(orderState.starsOverride) && orderState.starsOverride.length >= 3
      ? orderState.starsOverride
      : lvl && Array.isArray(lvl.stars)
      ? lvl.stars
      : [850, 1250, 1750];
  const score = Math.max(0, Math.floor(Number(orderState.score) || 0));
  const timeLeft = Math.max(0, Number(orderState.timeLeft) || 0);

  const btnS = Math.min(29, Math.max(27, bh - 2));
  const btnY = Math.round(by + (bh - btnS) * 0.5);
  const gap = bw >= 360 ? 7 : 5;

  // 1. Warm-wood rounded-square Pause button (Design 03 top-left)
  drawPlayPauseButton(c, bx, btnY, btnS, isHitPressed(app, 'pause_btn'));
  hits.add('pause_btn', bx, btnY, btnS, btnS, () => app.togglePause());

  const pillH = Math.min(28, Math.max(24, bh - 5));
  const pillY = Math.round(by + (bh - pillH) * 0.5);

  // Helper: dark espresso-wood HUD pill with warm inner bevel rim (Design 03)
  const drawHudWoodPill = (px, py, pw, ph, borderOverride = '') => {
    c.save();
    try {
      const r = ph * 0.5;
      const g = c.createLinearGradient(px, py, px, py + ph);
      g.addColorStop(0, '#72492F');
      g.addColorStop(0.55, '#593621');
      g.addColorStop(1, '#472918');
      UI.roundRectPath(c, px, py, pw, ph, r);
      c.fillStyle = g;
      c.fill();
      c.lineWidth = 2.0;
      c.strokeStyle = borderOverride || '#2D180C';
      c.stroke();

      UI.roundRectPath(c, px + 2, py + 2, pw - 4, ph - 4, Math.max(4, r - 2));
      c.lineWidth = 1.2;
      c.strokeStyle = 'rgba(222, 168, 120, 0.34)';
      c.stroke();
    } finally {
      c.restore();
    }
  };

  // 2. Dark wood '关卡 X-Y' / '每天特调' / '无限 N班' pill (Design 03)
  const lvlX = bx + btnS + gap;
  const lvlW = clamp(Math.round(bw * 0.22), 70, 88);
  drawHudWoodPill(lvlX, pillY, lvlW, pillH);
  const pillLabel = isDaily
    ? '每天特调'
    : isEndless
    ? `无限 ${curId.slice(8) || '1'}班`
    : `关卡 ${lvl ? lvl.id : '1-1'}`;
  UI.drawOutlinedText(c, pillLabel, lvlX + lvlW * 0.5, pillY + pillH * 0.5 + 0.5, {
    size: 12.6,
    minSize: 9.8,
    weight: 900,
    fill: '#FFF6E2',
    stroke: '#361C0E',
    strokeWidth: 2.4,
    shadowOffsetY: 0.5,
    maxWidth: lvlW - 10
  });

  // 3. Dark wood Countdown Clock pill (`icon_clock + MM:SS`, Design 03)
  const timerX = lvlX + lvlW + gap;
  const timerW = clamp(Math.round(bw * 0.23), 74, 92);
  const isUrgentClock = timeLeft <= 15 && timeLeft > 0;
  const pulse = isUrgentClock ? 0.5 + 0.5 * Math.sin(nowSec * 9.0) : 0;
  drawHudWoodPill(timerX, pillY, timerW, pillH, isUrgentClock ? '#E85C5C' : '');
  const clkSz = Math.min(18, Math.round(pillH * 0.68)) + pulse * 1.4;
  UI.drawUiIcon(c, sprites, 'icon_clock', timerX + 14, pillY + pillH * 0.5, clkSz);
  UI.drawOutlinedText(c, formatClockMMSS(timeLeft), timerX + 25, pillY + pillH * 0.5 + 0.6, {
    size: 12.8,
    minSize: 10.0,
    weight: 900,
    fill: isUrgentClock ? '#FFB4A2' : '#FFF6E2',
    stroke: '#361C0E',
    strokeWidth: 2.4,
    shadowOffsetY: 0.5,
    align: 'left',
    maxWidth: timerW - 30
  });

  // 4. Right Score + 3-Star Progress Group (generous full-width layout matching Design 03!)
  const progX = timerX + timerW + gap + 2;
  const progW = Math.max(96, bx + bw - progX);

  // Subtle recessed dark-navy capsule behind score number
  const capH = Math.max(16, Math.round(bh * 0.54));
  const capY = by;
  c.save();
  try {
    UI.roundRectPath(c, progX + 2, capY, progW - 4, capH, capH * 0.5);
    c.fillStyle = 'rgba(18, 26, 52, 0.68)';
    c.fill();
    c.lineWidth = 1.2;
    c.strokeStyle = 'rgba(130, 162, 222, 0.26)';
    c.stroke();
  } finally {
    c.restore();
  }

  UI.drawOutlinedText(c, String(score), progX + progW * 0.5, capY + capH * 0.52, {
    size: 14.0,
    minSize: 10.5,
    weight: 900,
    fill: '#FFE584',
    stroke: '#2C170C',
    strokeWidth: 2.6,
    shadowOffsetY: 0.6,
    maxWidth: progW - 10
  });

  const barX = progX + 4;
  const barW = Math.max(76, progW - 14);
  const barH = 8.0;
  const barY = by + bh - barH - 1.5;
  const star3 = Math.max(1, stars[2]);
  const fillRatio = clamp(score / star3, 0, 1);

  c.save();
  try {
    // Dark recessed brown track with warm rim
    c.fillStyle = '#4B3022';
    UI.roundRectPath(c, barX, barY, barW, barH, barH * 0.5);
    c.fill();
    c.lineWidth = 1.8;
    c.strokeStyle = '#2A180D';
    c.stroke();

    if (fillRatio > 0) {
      const fillW = Math.max(6, (barW - 2) * fillRatio);
      const fg = c.createLinearGradient(barX, barY, barX, barY + barH);
      fg.addColorStop(0, '#FFE87A');
      fg.addColorStop(0.55, '#F8B82E');
      fg.addColorStop(1, '#E28A14');
      c.fillStyle = fg;
      UI.roundRectPath(c, barX + 1, barY + 1, fillW, barH - 2, (barH - 2) * 0.5);
      c.fill();

      // Glossy top shine strip inside score progress bar
      c.fillStyle = 'rgba(255, 255, 232, 0.42)';
      UI.roundRectPath(c, barX + 2.5, barY + 1.5, Math.max(3, fillW - 3), (barH - 2) * 0.36, 2);
      c.fill();
    }
  } finally {
    c.restore();
  }

  for (let i = 0; i < 3; i++) {
    const ratio = clamp(stars[i] / star3, 0.22, 1.0);
    const sx = barX + barW * ratio;
    const unlocked = score >= stars[i];
    const popTimer = app.starPopTimers && app.starPopTimers[i] > 0 ? app.starPopTimers[i] : 0;
    const scaleBoost = popTimer > 0 ? 1 + 0.45 * Math.sin((popTimer / 0.3) * Math.PI) : 1;
    UI.drawStarIcon(c, sx, barY + barH * 0.5, 7.2 * scaleBoost, unlocked, { sprites });
  }
}

/**
 * v0.10 dough temperature bar inside the knead pill: cold (blue) → warm band (gold) → overheat (red).
 * Locked state shows a draining grey bar. Purely visual; never registers hits.
 */
function drawDoughTempBar(ctx, x, y, w, h, dough, nowSec) {
  if (!dough || !(w > 8)) return;
  const c = getSafeCtx(ctx);
  c.save();
  UI.roundRectPath(c, x, y, w, h, h / 2);
  c.fillStyle = 'rgba(60, 34, 20, 0.35)';
  c.fill();
  // Warm band marker (warmMin..overheat ≈ 40%..100%)
  c.fillStyle = 'rgba(255, 214, 120, 0.22)';
  UI.roundRectPath(c, x + w * 0.4, y, w * 0.6, h, h / 2);
  c.fill();
  let ratio = Math.max(0, Math.min(1, Number(dough.ratio) || 0));
  let color = '#7EC8FF';
  if (dough.locked) {
    const total = Math.max(0.1, Number(dough.lockDuration) || 1.2);
    ratio = Math.max(0.05, Math.min(1, (Number(dough.lockTimer) || 0) / total));
    color = '#FF6B6B';
  } else if (dough.zone === 'warm') {
    color = ratio > 0.85 ? '#FF9A5C' : '#FFD45E';
  }
  if (ratio > 0.01) {
    UI.roundRectPath(c, x, y, Math.max(h, w * ratio), h, h / 2);
    c.fillStyle = color;
    c.fill();
  }
  if (!dough.locked && dough.zone === 'warm') {
    const pulse = 0.35 + 0.25 * Math.sin((Number(nowSec) || 0) * 9);
    c.globalAlpha = pulse;
    UI.roundRectPath(c, x - 1, y - 1, Math.max(h, w * ratio) + 2, h + 2, (h + 2) / 2);
    c.strokeStyle = '#FFF4C8';
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();
}

/**
 * Square warm-wood tool button (`移位叉` / `升阶勺`) with wood-grain texture & glossy red count badge (Design 03)
 */
function drawUtensilButton(ctx, x, y, w, h, kind, app, hits) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const def = TOOLS[kind];
  const count = Math.max(0, Math.floor((app.toolCounts && app.toolCounts[kind]) || 0));
  const bought = Math.max(0, Math.floor((app.toolBoughtThisLevel && app.toolBoughtThisLevel[kind]) || 0));
  const armed = app.activeTool === kind;
  const canEmergencyBuy = count === 0 && bought < def.maxBuyPerLevel;
  const hitId = kind === 'fork' ? 'tool_fork_btn' : 'tool_spoon_btn';

  UI.drawPillButton(c, x, y, w, h, {
    style: armed ? 'active' : count > 0 ? 'wood' : canEmergencyBuy ? 'walnut' : 'disabled',
    disabled: count === 0 && !canEmergencyBuy,
    woodGrain: true,
    radius: 13,
    text: '',
    pressed: isHitPressed(app, hitId)
  });

  const iconKey = kind === 'fork' ? 'tool_swap_fork' : 'tool_upgrade_spoon';
  UI.drawUiIcon(c, sprites, iconKey, x + w * 0.5, y + h * 0.37, Math.min(31, h * 0.54));

  // Bottom bold white outlined label: 移位叉 / 升阶勺 / 取消 (Design 03)
  const bottomLabel = armed ? '取消' : def.shortName;
  UI.drawOutlinedText(c, bottomLabel, x + w * 0.5, y + h * 0.77, {
    size: 11.8,
    minSize: 9.0,
    weight: 900,
    fill: armed ? '#5A3928' : '#FFFDF8',
    stroke: armed ? '' : '#3E1F0E',
    strokeWidth: armed ? 0 : 2.8,
    shadowOffsetY: armed ? 0 : 0.7,
    maxWidth: w - 6
  });

  // Top-right glossy crimson-red circular count badge (or emergency buy star tag, Design 03)
  const badgeText = count > 0 ? String(count) : canEmergencyBuy ? `${def.cost}` : '0';
  const badgeR = count > 0 ? 9.8 : 10.5;
  const bcx = x + w - 4;
  const bcy = y + 4;
  c.save();
  try {
    const bg = c.createLinearGradient(bcx, bcy - badgeR, bcx, bcy + badgeR);
    if (count > 0) {
      bg.addColorStop(0, '#F55A4E');
      bg.addColorStop(1, '#C62822');
    } else if (canEmergencyBuy) {
      bg.addColorStop(0, '#FFD45E');
      bg.addColorStop(1, '#E89218');
    } else {
      bg.addColorStop(0, '#9B9084');
      bg.addColorStop(1, '#756B60');
    }
    c.beginPath();
    c.arc(bcx, bcy, badgeR, 0, Math.PI * 2);
    c.fillStyle = bg;
    c.fill();
    c.lineWidth = 2.0;
    c.strokeStyle = '#4A2210';
    c.stroke();

    // Subtle specular highlight dot on red badge
    c.fillStyle = 'rgba(255, 255, 255, 0.36)';
    c.beginPath();
    c.arc(bcx - badgeR * 0.30, bcy - badgeR * 0.32, badgeR * 0.24, 0, Math.PI * 2);
    c.fill();
  } finally {
    c.restore();
  }
  UI.drawOutlinedText(c, badgeText, bcx, bcy + 0.5, {
    size: badgeText.length > 1 ? 8.8 : 11.2,
    minSize: 7.5,
    weight: 900,
    fill: '#FFFDF8',
    stroke: '#4A1F0E',
    strokeWidth: 2.0,
    shadowOffsetY: 0
  });

  hits.add(hitId, x, y, w, h, () => app.onTapToolButton(kind));
}

/**
 * Circular glowing double-gold-ring Patron Active Skill Medallion (`patron_skill_btn`, Design 03 bottom-right)
 */
function drawPatronSkillMedallion(ctx, x, y, w, h, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const sprites = app.sprites || {};
  const saveData = app.saveData || {};
  const patronId = normalizePatronId(saveData.selectedPatron);
  const patron = PATRONS.find((p) => p.id === patronId) || PATRONS[0];
  const charge = clamp(Number(app.skillEnergy) || 0, 0, 100);
  const ready = charge >= 100;
  const pulse = ready ? 0.5 + 0.5 * Math.sin(nowSec * 6.0) : 0;
  const pressed = isHitPressed(app, 'patron_skill_btn');

  const cx = x + w * 0.5;
  const cy = y + h * 0.5 + (pressed ? 1.5 : 0);
  const rad = Math.min(w, h) * 0.49;

  c.save();
  try {
    // Golden radiant outer aura when 100% charged (Design 03)
    if (ready) {
      const aura = c.createRadialGradient(cx, cy, rad * 0.70, cx, cy, rad * (1.42 + pulse * 0.14));
      aura.addColorStop(0, `rgba(255, 232, 128, ${(0.82 + pulse * 0.18).toFixed(3)})`);
      aura.addColorStop(0.65, `rgba(255, 198, 72, ${(0.34 + pulse * 0.12).toFixed(3)})`);
      aura.addColorStop(1, 'rgba(255, 198, 72, 0)');
      c.fillStyle = aura;
      c.beginPath();
      c.arc(cx, cy, rad * (1.42 + pulse * 0.14), 0, Math.PI * 2);
      c.fill();
    }

    // Outer cream-gold ring (double-ring medallion style matching Design 03)
    const outerG = c.createLinearGradient(cx, cy - rad, cx, cy + rad);
    if (ready) {
      outerG.addColorStop(0, '#FFF5B8');
      outerG.addColorStop(0.5, '#FFE072');
      outerG.addColorStop(1, '#EAA224');
    } else {
      outerG.addColorStop(0, '#B0794B');
      outerG.addColorStop(1, '#6D4329');
    }
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    c.fillStyle = outerG;
    c.fill();
    c.lineWidth = 2.4;
    c.strokeStyle = '#4A2410';
    c.stroke();

    // Inner glowing amber-gold face (warm cream when charging)
    const innerR = rad - 4.2;
    const faceG = c.createRadialGradient(cx, cy - innerR * 0.2, innerR * 0.15, cx, cy, innerR);
    if (ready) {
      faceG.addColorStop(0, '#FFF6C4');
      faceG.addColorStop(0.65, '#FFD35E');
      faceG.addColorStop(1, '#F29A1E');
    } else {
      faceG.addColorStop(0, '#FFF6E4');
      faceG.addColorStop(1, '#E8D5B8');
    }
    c.beginPath();
    c.arc(cx, cy, innerR, 0, Math.PI * 2);
    c.fillStyle = faceG;
    c.fill();
    c.lineWidth = 1.8;
    c.strokeStyle = ready ? '#5A2C12' : 'rgba(90, 57, 40, 0.35)';
    c.stroke();

    // Circular charge progress arc when charging (< 100%)
    if (!ready) {
      c.strokeStyle = 'rgba(90, 57, 40, 0.22)';
      c.lineWidth = 3.2;
      c.beginPath();
      c.arc(cx, cy, rad - 2.1, 0, Math.PI * 2);
      c.stroke();

      if (charge > 0) {
        c.strokeStyle = '#7ED656';
        c.lineWidth = 3.4;
        c.lineCap = 'round';
        c.beginPath();
        c.arc(cx, cy, rad - 2.1, -Math.PI * 0.5, -Math.PI * 0.5 + (charge / 100) * Math.PI * 2);
        c.stroke();
      }
    }
  } finally {
    c.restore();
  }

  // Patron portrait clipped inside the medallion ring (chef hat gently peeks near top!)
  c.save();
  try {
    c.beginPath();
    c.arc(cx, cy, rad - 2.5, 0, Math.PI * 2);
    if (typeof c.clip === 'function') c.clip();
    UI.drawUiIcon(c, sprites, patron.id, cx, cy - 2, rad * 1.62);
  } finally {
    c.restore();
  }

  // Bottom bold white outlined label ('释放' or 'XX%', Design 03)
  UI.drawOutlinedText(c, ready ? '释放' : `${Math.floor(charge)}%`, cx, cy + rad * 0.60, {
    size: ready ? 13.4 : 11.2,
    minSize: 8.8,
    weight: 900,
    fill: '#FFFDF8',
    stroke: '#46200E',
    strokeWidth: 3.0,
    shadowOffsetY: 0.8
  });

  hits.add('patron_skill_btn', x, y, w, h, () => app.onTapPatronSkill());
}

function renderPlayScreen(ctx, metrics, app, hits, nowSec) {
  const c = getSafeCtx(ctx);
  const geom = computeTopHeaderGeometry(metrics);
  const { width, headerBottom, bottomLimit } = geom;
  const sprites = app.sprites || {};
  const gridState = app.gridState;
  const orderState = app.orderState || {};
  const animState = app.animState || {};
  const guideTargets = {};
  app.guideTargets = guideTargets;

  const availH = bottomLimit - headerBottom;
  const compact = availH < 640;
  const isWide = width > 560;
  const stageW = isWide ? Math.min(460, width - 32) : width;
  const stageX = Math.round((width - stageW) * 0.5);
  const padX = 8;
  const innerX = stageX + padX;
  const innerW = stageW - padX * 2;
  const fullBarX = isWide ? stageX : 0;
  const fullBarW = isWide ? stageW : width;

  // Compute all 5 vertical HUD bands cleanly below WeChat capsule (`btnY >= headerBottom + 3`)
  const playBarY = headerBottom + 2;
  const playBarH = compact ? 30 : 31;
  const playBarBottom = playBarY + playBarH + 1;

  const custY = playBarBottom;
  const custH = compact ? 108 : 132;

  // Dark espresso tray rail sits FLUSH right underneath the oak customer counter ledge (Design 03!)
  const trayY = custY + custH;
  const trayRailH = compact ? 46 : 54;
  const statusGap = compact ? 5 : 9;
  const statusH = compact ? 27 : 33;
  const trayH = trayRailH + statusGap + statusH;

  const dockH = compact ? 58 : 66;
  const dockY = bottomLimit - dockH;
  const stageY = trayY + trayH + (compact ? 4 : 7);
  const stageH = Math.max(190, dockY - (compact ? 5 : 8) - stageY);

  // Pre-compute board layout so the Combo + Fever bar aligns horizontally with the baking tray width (Design 03!)
  const preBoardLayout = BoardRenderer.computeBoardLayout(
    { x: innerX, y: stageY, w: innerW, h: stageH },
    gridState
  );
  const boardOuterW = preBoardLayout
    ? preBoardLayout.gridW + preBoardLayout.bezelPad * 2
    : Math.round(innerW * 0.86);
  const statusW = clamp(boardOuterW, Math.min(innerW - 8, 292), innerW - 4);

  // 1. Pixel-aligned Cafe Interior Wall, Walnut Tabletop & Starry Night Header Shelf
  renderPlayInteriorBands(c, geom, playBarBottom, trayY, app.equippedTheme, nowSec);

  // 2. Full-width Play Top HUD Bar (Pause | 关卡 X-Y | 🕒 MM:SS | Score + 3-Star Bar)
  renderPlayTopBar(c, { x: innerX, y: playBarY, w: innerW, h: playBarH }, app, hits, nowSec);

  // 3. 3-Seat Animal Customer Bar + Seamless Speech Bubbles + Full-Width Oak Counter Ledge
  BoardRenderer.renderCustomersBar(
    c,
    { x: innerX, y: custY, w: innerW, h: custH },
    orderState,
    sprites,
    hits,
    nowSec,
    {
      vertical: false,
      fullBarX,
      fullBarW,
      animState,
      guideTargets,
      onSelectSeat: (idx) => app.selectCustomerSeat(idx)
    }
  );

  // 4. Full-Width Dark Espresso Serving Tray Rail + Plates + Warm-Wood Trash + Flame-Crest Combo & Fever Bar
  const effFreshSec =
    app.isFeatureOn && app.isFeatureOn('freshBonus')
      ? typeof app.getEffectiveFreshWindowSec === 'function'
        ? app.getEffectiveFreshWindowSec()
        : app.freshWindowSec || 6
      : 0;
  BoardRenderer.renderTrayStrip(
    c,
    { x: innerX, y: trayY, w: innerW, h: trayH },
    orderState,
    sprites,
    hits,
    nowSec,
    {
      theme: app.equippedTheme,
      fullBarX,
      fullBarW,
      statusH,
      rowGap: statusGap,
      statusW,
      animState,
      guideTargets,
      boardFullHint: app.boardFullHintTimer > 0,
      freshWindowSec: effFreshSec,
      feverScenePct: app.isFeatureOn && app.isFeatureOn('feverV2') ? 20 : 25,
      forkTrashReady: Boolean(app.activeTool === 'fork' && app.forkSourceCell),
      onTapTraySlot: (idx) => app.handleTraySlotTap(idx),
      onTapTrash: () => app.handleTrashBtnTap()
    }
  );

  // 5. Bottom 4-Control Dock: 移位叉 | 揉面补料 | 升阶勺 | 搭档技能
  guideTargets.dock = { x: innerX, y: dockY, w: innerW, h: dockH };
  const forkW = compact ? 56 : 62;
  const spoonW = compact ? 56 : 62;
  const skillW = compact ? 60 : 68;
  const dockGap = compact ? 6 : 8;
  const forkX = innerX + 2;
  const skillX = innerX + innerW - skillW - 2;
  const spoonX = skillX - dockGap - spoonW;
  const kneadX = forkX + forkW + dockGap;
  const kneadW = Math.max(104, spoonX - dockGap - kneadX);

  drawUtensilButton(c, forkX, dockY + 2, forkW, dockH - 4, 'fork', app, hits);

  const kneadPressed = app.kneadPressTimer > 0 || isHitPressed(app, 'knead_btn');
  const dough = typeof app.getDoughView === 'function' ? app.getDoughView() : null;
  const doughOn = Boolean(dough && app.isFeatureOn && app.isFeatureOn('doughTemp'));
  const kneadInFever = Boolean(orderState.feverActive && app.isFeatureOn && app.isFeatureOn('feverV2'));
  const kneadLocked = Boolean(doughOn && dough.locked && !kneadInFever);
  const goalView = typeof app.getGoalView === 'function' ? app.getGoalView() : null;
  const kneadLimited = Boolean(goalView && goalView.type === 'limited_knead' && goalView.target > 0);
  const kneadsLeft = kneadLimited ? Math.max(0, goalView.target - (goalView.kneadsUsed || 0)) : Infinity;
  const kneadOut = kneadLimited && kneadsLeft <= 0;
  UI.drawPillButton(c, kneadX, dockY + 4, kneadW, dockH - 8, {
    style: kneadInFever ? 'active' : 'knead',
    label: kneadOut
      ? '次数已用完'
      : kneadInFever
      ? '热潮揉面'
      : kneadLocked
      ? '过热中'
      : kneadLimited
      ? `揉面(${kneadsLeft})`
      : '揉面补料',
    fontSize: compact ? 17.5 : 19.5,
    radius: Math.round((dockH - 8) * 0.48),
    pressed: kneadPressed,
    disabled: kneadLocked || kneadOut
  });
  if (doughOn && !kneadInFever && !kneadOut) {
    drawDoughTempBar(c, kneadX + 14, dockY + dockH - 13, kneadW - 28, 4, dough, nowSec);
  }
  hits.add('knead_btn', kneadX, dockY + 2, kneadW, dockH - 4, () => app.onTapKneadButton());
  guideTargets.kneadBtn = { x: kneadX, y: dockY + 2, w: kneadW, h: dockH - 4 };

  drawUtensilButton(c, spoonX, dockY + 2, spoonW, dockH - 4, 'spoon', app, hits);
  drawPatronSkillMedallion(c, skillX, dockY, skillW, dockH, app, hits, nowSec);

  // 6. 3D Wooden Baking Tray Board Stage (Design 03)
  const layout = BoardRenderer.renderBoardStage(
    c,
    { x: innerX, y: stageY, w: innerW, h: stageH },
    gridState,
    orderState,
    app.equippedTheme,
    sprites,
    animState,
    nowSec,
    {
      layout: preBoardLayout,
      activeTool: app.activeTool,
      forkSourceCell: app.forkSourceCell,
      guideTargets,
      neededTiers: app.neededTiers,
      freshWindowSec: effFreshSec,
      feverV2: Boolean(app.isFeatureOn && app.isFeatureOn('feverV2'))
    }
  );

  // v0.11 M2: Compact Goal Progress Pill in open top-left starry header (left of '一起做猫饼', zero overlap!)
  if (goalView && goalView.badge && app.isFeatureOn && app.isFeatureOn('goals')) {
    const gb = goalView.badge;
    const pillH = 22;
    const pillW = Math.min(118, Math.max(88, Math.round(innerW * 0.30)));
    const pillX = innerX + 1;
    const pillY = Math.max(4, Math.round(geom.topY + geom.headerH * 0.5 - pillH * 0.5));
    c.save();
    try {
      UI.roundRectPath(c, pillX, pillY, pillW, pillH, pillH * 0.5);
      c.fillStyle = gb.done ? 'rgba(54, 134, 72, 0.88)' : 'rgba(28, 36, 68, 0.86)';
      c.fill();
      c.lineWidth = 1.6;
      c.strokeStyle = gb.done ? '#9AF0A6' : '#FFD45E';
      c.stroke();
      UI.drawStarIcon(c, pillX + 11, pillY + pillH * 0.5, 5.2, true, sprites);
      UI.drawOutlinedText(c, gb.text, pillX + 21, pillY + pillH * 0.5 + 0.4, {
        size: 10.6,
        minSize: 8.6,
        weight: 800,
        fill: gb.done ? '#E6FFE6' : '#FFE89B',
        stroke: '#24140A',
        strokeWidth: 2.0,
        shadowOffsetY: 0,
        align: 'left',
        maxWidth: pillW - 26
      });
    } finally {
      c.restore();
    }
  }

  // v0.11 M2: Sleek Mid-Shift Active Event Banner (zero board-bezel overlap on 375x667 & 390x844)
  const activeEv = typeof app.getActiveEventView === 'function' ? app.getActiveEventView() : null;
  if (activeEv && app.isFeatureOn && app.isFeatureOn('events')) {
    const bw = Math.min(innerW - 24, 248);
    const gapTop = trayY + trayH;
    const gapBot = layout && Number.isFinite(layout.gridY) ? layout.gridY - (layout.bezelPad || 10) : stageY;
    const availGap = gapBot - gapTop;
    const bh = availGap >= 26 ? 24 : 20;
    const bx = Math.round(innerX + (innerW - bw) * 0.5);
    const by =
      availGap >= bh + 2
        ? Math.round(gapTop + (availGap - bh) * 0.5)
        : Math.round(trayY + trayH - statusH + (statusH - bh) * 0.5);
    const frac = activeEv.duration > 0 ? clamp(activeEv.timer / activeEv.duration, 0, 1) : 0;
    const isIce = activeEv.tone === 'ice';
    c.save();
    try {
      UI.roundRectPath(c, bx, by, bw, bh, bh * 0.5);
      c.fillStyle = isIce ? 'rgba(28, 68, 114, 0.99)' : 'rgba(104, 52, 20, 0.99)';
      c.fill();
      c.lineWidth = 1.8;
      c.strokeStyle = isIce ? '#9EE6FF' : '#FFD45E';
      c.stroke();

      const rCx = bx + 13;
      const rCy = by + bh * 0.5;
      const rRad = 7.2;
      c.beginPath();
      c.arc(rCx, rCy, rRad, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      c.lineWidth = 2.2;
      c.stroke();
      if (frac > 0) {
        c.beginPath();
        c.arc(rCx, rCy, rRad, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * frac);
        c.strokeStyle = isIce ? '#A8EEFF' : '#FFE478';
        c.lineWidth = 2.4;
        c.stroke();
      }

      const suffix = activeEv.chargesLeft > 0 ? `余${activeEv.chargesLeft}次` : `${Math.ceil(activeEv.timer)}秒`;
      UI.drawOutlinedText(c, `${activeEv.name} · ${suffix}`, bx + 26, by + bh * 0.5 + 0.5, {
        size: 11.4,
        minSize: 9.0,
        weight: 800,
        fill: '#FFF6DC',
        stroke: '#2C160A',
        strokeWidth: 2.2,
        shadowOffsetY: 0,
        align: 'left',
        maxWidth: bw - 34
      });
    } finally {
      c.restore();
    }
  }

  if (orderState.rushHourActive && !app.activeTool) {
    UI.drawTagBadge(
      c,
      innerX + innerW - 78,
      stageY + 2,
      74,
      19,
      '高峰客流',
      'urgent',
      9.0,
      'icon_urgent_flame',
      sprites
    );
  }

  app.playBoardTopY = stageY;
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
    // Anchor toast cleanly at the top edge of the board stage so it NEVER covers customer orders or serving plates!
    baseY = Number.isFinite(app.playBoardTopY) ? app.playBoardTopY + 4 : headerBottom + 236;
  } else if (app.screen === 'lobby' && Number.isFinite(app.lobbyHeaderBottomY)) {
    baseY = Math.max(headerBottom + 8, app.lobbyHeaderBottomY + 6);
  }

  const primary = cur || minor;
  const isMajor = primary.level === 'major';
  const elapsed = Math.max(0, (primary.maxTimer || 2.0) - primary.timer);
  const slideOffset = elapsed < 0.16 ? (1 - easeOutCubic(elapsed / 0.16)) * 8 : 0;

  c.save();
  try {
    c.globalAlpha = clamp(primary.timer * 3.4, 0, 1);
    const fontSz = isMajor ? 11.4 : 10.6;
    c.font = UI.fontStr(fontSz, 800);
    const hasIcon = Boolean(primary.icon);
    const maxW = Math.min(isMajor ? 356 : 310, width - 24);
    const tw = clamp(
      c.measureText(primary.text || '').width + 28 + (hasIcon ? 22 : 0),
      isMajor ? 132 : 104,
      maxW
    );
    const th = isMajor ? 30 : 25;
    const tx = Math.round((width - tw) * 0.5);
    const ty = Math.round(clamp(baseY + slideOffset, headerBottom + 6, botLimit - th - 4));

    UI.drawNoticeBanner(c, tx, ty, tw, th, {
      icon: primary.icon || '',
      sprites,
      iconSize: isMajor ? 18 : 15,
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
  renderTitleScreen,
  renderPlayScreen,
  renderToast,
  computeTopHeaderGeometry,
  drawRedDot,
  drawLockIcon,
  drawChevronIcon,
  drawCircularWoodButton,
  getSafeCtx
};
