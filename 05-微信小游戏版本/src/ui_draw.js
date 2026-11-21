/**
 * Canvas 2D Storybook UI Design System, Drawing Primitives, Safe Geometry Helpers,
 * CJK Text Wrapping, Atlas Icon Renderer, Unified Cards/Banners & Hit Registry.
 */
'use strict';

const { UI_ATLAS_RECTS } = require('./constants');

const FONT_FAMILY = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';

// Unified Starlight Kissa Palette Tokens
const KISSA_THEME = {
  ink: '#4A2C2A',
  inkSoft: '#6E463B',
  inkMuted: '#8C6853',
  creamLight: '#FFFDF7',
  creamMid: '#F8ECD4',
  creamDeep: '#EDD7B0',
  borderWarm: '#C69F69',
  brassLight: '#FFE799',
  brassMid: '#E4A83C',
  brassDark: '#9A5B17'
};

function fontStr(px, weight = 700) {
  return `${weight} ${Math.round(px)}px ${FONT_FAMILY}`;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, Math.min(w, h) * 0.5));
  ctx.beginPath();
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

function fillEllipse(ctx, cx, cy, rx, ry) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(Math.max(0.01, rx), Math.max(0.01, ry));
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

function drawStar(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const rad = i % 2 === 0 ? r : r * 0.42;
    if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSakuraPetal(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.bezierCurveTo(r * 0.95, -r * 0.65, r * 0.85, r * 0.75, 0, r * 1.1);
  ctx.bezierCurveTo(-r * 0.85, r * 0.75, -r * 0.95, -r * 0.65, 0, -r * 1.15);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeartIcon(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const s = size * 0.5;
  ctx.moveTo(0, s * 0.85);
  ctx.bezierCurveTo(-s * 1.35, -s * 0.1, -s * 0.75, -s * 1.2, 0, -s * 0.45);
  ctx.bezierCurveTo(s * 0.75, -s * 1.2, s * 1.35, -s * 0.1, 0, s * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCoverImage(ctx, img, x, y, w, h, focusY = 0.5) {
  if (!img || !img.width || !img.height || w <= 0 || h <= 0) return;
  const iw = img.width;
  const ih = img.height;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = Math.max(0, (iw - sw) * 0.5);
  const sy = Math.max(0, Math.min(ih - sh, (ih - sh) * focusY));
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawContainImage(ctx, img, cx, cy, maxW, maxH) {
  if (!img || !img.width || !img.height || maxW <= 0 || maxH <= 0) return;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw * 0.5, cy - dh * 0.5, dw, dh);
}

/**
 * Draw a storybook illustrated icon from `sprites.uiAtlas` or standalone UI sprites.
 */
function drawUiIcon(ctx, sprites, iconKey, cx, cy, size, alpha = 1, rot = 0) {
  if (!sprites || !iconKey || size <= 0) return false;

  // Standalone decorative sprites check
  let standalone = null;
  if (iconKey === 'serve_bell') standalone = sprites.serveBell;
  else if (iconKey === 'shop_sign') standalone = sprites.shopSign;
  else if (iconKey === 'yarn_ball') standalone = sprites.yarnBall;

  if (standalone && standalone.width > 0 && standalone.height > 0) {
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy);
    if (rot) ctx.rotate(rot);
    drawContainImage(ctx, standalone, 0, 0, size, size);
    ctx.restore();
    return true;
  }

  const rect = UI_ATLAS_RECTS && UI_ATLAS_RECTS[iconKey];
  const atlas = sprites.uiAtlas;
  if (!rect || !atlas || !atlas.width || !atlas.height) return false;

  ctx.save();
  if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(atlas, rect.x, rect.y, rect.w, rect.h, -size * 0.5, -size * 0.5, size, size);
  ctx.restore();
  return true;
}

function drawWoodBoard(ctx, x, y, w, h, radius = 15, withRivets = true) {
  ctx.save();
  ctx.shadowColor = 'rgba(26, 12, 5, 0.38)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#be844c');
  g.addColorStop(0.52, '#8b5429');
  g.addColorStop(1, '#683a19');
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = '#432418';
  ctx.stroke();

  // Inner warm brass-wood bevel sheen
  ctx.strokeStyle = 'rgba(255, 228, 174, 0.38)';
  ctx.lineWidth = 1.4;
  roundRectPath(ctx, x + 2.2, y + 2.2, w - 4.4, h - 4.4, Math.max(4, radius - 2));
  ctx.stroke();

  if (withRivets && w > 64) {
    const rivetR = w < 220 ? 3.4 : 4.2;
    const rxOffsets = [x + 12, x + w - 12];
    const ry = y + 9;
    for (let i = 0; i < rxOffsets.length; i++) {
      const rx = rxOffsets[i];
      const rg = ctx.createRadialGradient(rx - 1, ry - 1, 0.5, rx, ry, rivetR);
      rg.addColorStop(0, '#fff0b3');
      rg.addColorStop(1, '#a97023');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(rx, ry, rivetR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#432418';
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParchmentSheet(
  ctx,
  x,
  y,
  w,
  h,
  radius = 11,
  topCol = '#fcf6e6',
  botCol = '#f2e2c1',
  borderCol = '#4A2C2A',
  lineWidth = 2
) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, topCol);
  g.addColorStop(1, botCol);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  // Subtle top inner parchment highlight for cohesive depth
  if (h > 22 && w > 24) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 1.1;
    roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(3, radius - 1.5));
    ctx.stroke();
  }

  if (lineWidth > 0) {
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = borderCol;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Unified Storybook Card surface used across Lobby, Shop, Prep Shop, Guide & Modals.
 */
function drawKissaCard(ctx, x, y, w, h, opts = {}) {
  const radius = opts.radius !== undefined ? opts.radius : 12;
  const tone = opts.tone || 'cream'; // 'cream' | 'selected' | 'equipped' | 'amber' | 'soft'
  let topCol = '#fffdf8';
  let botCol = '#f7ead0';
  let borderCol = opts.borderColor || '#c59e68';
  let lipCol = 'rgba(138, 92, 42, 0.22)';
  let borderW = opts.lineWidth || 1.8;

  if (tone === 'selected') {
    topCol = '#fff9e0';
    botCol = '#ffe394';
    borderCol = '#4A2C2A';
    lipCol = '#965d1c';
    borderW = 2.2;
  } else if (tone === 'equipped') {
    topCol = '#f2fbf0';
    botCol = '#d8efd2';
    borderCol = '#437a42';
    lipCol = 'rgba(56, 108, 54, 0.35)';
    borderW = 2.0;
  } else if (tone === 'amber') {
    topCol = '#fff8dc';
    botCol = '#fbe4a4';
    borderCol = '#c08424';
    lipCol = 'rgba(154, 96, 22, 0.26)';
  } else if (tone === 'soft') {
    topCol = 'rgba(255, 250, 238, 0.72)';
    botCol = 'rgba(244, 228, 198, 0.78)';
    borderCol = '#cca874';
    lipCol = null;
    borderW = 1.4;
  }

  ctx.save();
  if (lipCol) {
    ctx.fillStyle = lipCol;
    roundRectPath(ctx, x, y + 2, w, h, radius);
    ctx.fill();
  }

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, opts.topCol || topCol);
  g.addColorStop(1, opts.botCol || botCol);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  if (h >= 26) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.1;
    roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(3, radius - 1.5));
    ctx.stroke();
  }

  roundRectPath(ctx, x, y, w, h, radius);
  ctx.lineWidth = borderW;
  ctx.strokeStyle = borderCol;
  ctx.stroke();
  ctx.restore();
}

/**
 * Unified Micro-Badge / Tag Pill so all status & category chips look cohesive.
 */
function drawTagBadge(ctx, x, y, w, h, text, tone = 'amber', fontSize = 9.5) {
  const palettes = {
    amber: { top: '#ffebb0', bot: '#f5c762', border: '#a8681c', text: '#5e2e08' },
    berry: { top: '#ff9685', bot: '#eb6b58', border: '#4A2C2A', text: '#fffdf8' },
    sage: { top: '#e4f5de', bot: '#bfe0b5', border: '#3c703a', text: '#214d20' },
    cocoa: { top: '#59331d', bot: '#3d2112', border: '#dfa855', text: '#ffefc8' },
    soft: { top: '#f6e8cc', bot: '#ead4ad', border: '#b89058', text: '#694127' },
    plum: { top: '#f8e6f0', bot: '#edd0e1', border: '#944a6d', text: '#632644' },
    frost: { top: '#e6f6fc', bot: '#cbe8f6', border: '#3f7896', text: '#1d4c66' }
  };
  const pal = palettes[tone] || palettes.amber;
  const r = Math.min(h * 0.5, 10);

  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, pal.top);
  g.addColorStop(1, pal.bot);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = pal.border;
  ctx.stroke();

  drawFitText(ctx, text, x + w * 0.5, y + h * 0.5 + 0.4, w - 8, fontSize, 7.5, 800, pal.text, 'center', 'middle');
  ctx.restore();
}

/**
 * Unified Floating Notice / Toast / Skill Prompt Banner.
 */
function drawNoticeBanner(ctx, x, y, w, h, opts = {}) {
  const r = opts.radius !== undefined ? opts.radius : Math.min(h * 0.5, 15);
  const borderCol = opts.borderColor || '#e8b65c';
  ctx.save();
  ctx.shadowColor = 'rgba(18, 8, 3, 0.34)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, opts.topCol || 'rgba(62, 34, 19, 0.95)');
  g.addColorStop(1, opts.botCol || 'rgba(40, 21, 11, 0.96)');
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = borderCol;
  ctx.stroke();

  let textLeft = x + 12;
  if (opts.icon && opts.sprites) {
    const icS = opts.iconSize || Math.min(20, h - 6);
    if (drawUiIcon(ctx, opts.sprites, opts.icon, x + 10 + icS * 0.5, y + h * 0.5, icS)) {
      textLeft = x + 14 + icS;
    }
  }
  const rightPad = opts.rightReserve || 12;
  if (opts.text) {
    const availW = Math.max(24, x + w - rightPad - textLeft);
    const align = opts.align || (opts.icon ? 'left' : 'center');
    const tx = align === 'center' ? textLeft + availW * 0.5 : textLeft;
    drawFitText(
      ctx,
      opts.text,
      tx,
      y + h * 0.5 + 0.5,
      availW,
      opts.fontSize || 11.5,
      9,
      800,
      opts.textColor || '#fff3cf',
      align,
      'middle'
    );
  }
  ctx.restore();
}

/**
 * Unified Currency Capsule (Stardust `icon_stardust` or Recipe Coins `icon_coin`).
 */
function drawCurrencyChip(ctx, x, y, w, h, sprites, iconKey, valText, opts = {}) {
  const isDark = opts.style === 'dark';
  drawPillButton(ctx, x, y, w, h, {
    style: isDark ? 'dark' : opts.style || 'wood',
    radius: h * 0.5
  });
  const icS = Math.min(h - 4, 22);
  const icCx = x + 6 + icS * 0.5;
  const drew = drawUiIcon(ctx, sprites, iconKey, icCx, y + h * 0.5, icS);
  const tx = drew ? icCx + icS * 0.5 + 3 : x + 8;
  const tw = Math.max(16, x + w - tx - 7);
  drawFitText(
    ctx,
    String(valText),
    tx + tw * 0.5,
    y + h * 0.5 + 0.5,
    tw,
    opts.fontSize || 12,
    9,
    900,
    isDark ? '#fff2cf' : '#592e0d',
    'center',
    'middle'
  );
}

function drawPillButton(ctx, x, y, w, h, opts = {}) {
  const style = opts.style || 'wood';
  const radius = opts.radius !== undefined ? opts.radius : Math.min(h * 0.5, 16);
  const disabled = !!opts.disabled;

  let topCol = '#fdf2da';
  let botCol = '#e9cd99';
  let borderCol = '#4A2C2A';
  let lipCol = '#6e401d';
  let textCol = '#4A2C2A';
  let sheenCol = 'rgba(255, 255, 255, 0.62)';
  let borderW = 2;

  if (style === 'cta') {
    topCol = '#ffe994';
    botCol = '#e39224';
    lipCol = '#8a4a10';
    textCol = '#421e08';
    sheenCol = 'rgba(255, 252, 224, 0.78)';
    borderW = 2.4;
  } else if (style === 'walnut') {
    topCol = '#9e6435';
    botCol = '#6d3e1c';
    borderCol = '#3d2010';
    lipCol = '#42210e';
    textCol = '#fff4dc';
    sheenCol = 'rgba(255, 226, 174, 0.34)';
    borderW = 2.1;
  } else if (style === 'active') {
    topCol = '#ffea9f';
    botCol = '#eeb44a';
    lipCol = '#7e4814';
    sheenCol = 'rgba(255, 252, 226, 0.72)';
  } else if (style === 'equipped') {
    topCol = '#e6f5df';
    botCol = '#bfe0b4';
    borderCol = '#386b35';
    lipCol = '#386b35';
    textCol = '#214d20';
    sheenCol = 'rgba(255, 255, 255, 0.65)';
  } else if (style === 'card') {
    topCol = '#fffdf8';
    botCol = '#f7ebd2';
    borderCol = '#c49d67';
    lipCol = 'rgba(138, 92, 42, 0.22)';
    borderW = 1.8;
  } else if (style === 'cardSelected') {
    topCol = '#fff8dc';
    botCol = '#ffdf88';
    borderCol = '#4A2C2A';
    lipCol = '#8d5518';
    borderW = 2.2;
  } else if (style === 'dark') {
    topCol = 'rgba(68, 38, 20, 0.94)';
    botCol = 'rgba(44, 24, 12, 0.96)';
    borderCol = '#d59f50';
    lipCol = 'rgba(22, 10, 4, 0.55)';
    textCol = '#fcecc9';
    sheenCol = 'rgba(255, 228, 172, 0.22)';
    borderW = 1.8;
  } else if (style === 'danger') {
    topCol = '#e85b4d';
    botCol = '#c2392c';
    borderCol = '#4A2C2A';
    lipCol = '#6b1812';
    textCol = '#ffffff';
    sheenCol = 'rgba(255, 226, 220, 0.38)';
  }

  ctx.save();
  if (disabled) ctx.globalAlpha = 0.52;

  // 3D bevel bottom lip
  if (lipCol && !disabled) {
    ctx.fillStyle = lipCol;
    roundRectPath(ctx, x, y + 2.3, w, h, radius);
    ctx.fill();
  }

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, topCol);
  g.addColorStop(1, botCol);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  // Inner top highlight sheen
  if (sheenCol && h >= 18 && w >= 18) {
    ctx.strokeStyle = sheenCol;
    ctx.lineWidth = 1.1;
    roundRectPath(ctx, x + 1.5, y + 1.4, w - 3, h - 2.8, Math.max(2, radius - 1.4));
    ctx.stroke();
  }

  roundRectPath(ctx, x, y, w, h, radius);
  ctx.lineWidth = borderW;
  ctx.strokeStyle = borderCol;
  ctx.stroke();

  const hasIcon = !!(opts.icon && opts.sprites);
  const hasText = !!opts.text;

  if (hasIcon && !hasText) {
    const icS = opts.iconSize || Math.min(w, h) * 0.68;
    const drew = drawUiIcon(ctx, opts.sprites, opts.icon, x + w * 0.5, y + h * 0.5, icS, opts.mutedSlash ? 0.65 : 1);
    if (!drew && opts.fallbackText) {
      ctx.font = fontStr(opts.fontSize || 13, 800);
      ctx.fillStyle = opts.textColor || textCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opts.fallbackText, x + w * 0.5, y + h * 0.5 + 0.5);
    }
    if (opts.mutedSlash) {
      ctx.save();
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      const sl = icS * 0.34;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5 - sl, y + h * 0.5 - sl);
      ctx.lineTo(x + w * 0.5 + sl, y + h * 0.5 + sl);
      ctx.stroke();
      ctx.strokeStyle = '#ef6456';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.restore();
    }
  } else if (hasText) {
    const fs = opts.fontSize || Math.max(11, Math.min(15, h * 0.44));
    let curFs = fs;
    const weight = opts.fontWeight || 800;
    const icS = hasIcon ? (opts.iconSize || Math.min(h - 7, curFs * 1.42)) : 0;
    const icGap = hasIcon ? 4.5 : 0;
    const maxTw = Math.max(12, w - 12 - (hasIcon ? icS + icGap : 0));

    ctx.font = fontStr(curFs, weight);
    while (curFs > 8.5 && ctx.measureText(opts.text).width > maxTw) {
      curFs -= 0.5;
      ctx.font = fontStr(curFs, weight);
    }
    const tw = ctx.measureText(opts.text).width;
    const totalW = (hasIcon ? icS + icGap : 0) + tw;
    const startX = x + (w - totalW) * 0.5;

    let drewIcon = false;
    if (hasIcon) {
      drewIcon = drawUiIcon(ctx, opts.sprites, opts.icon, startX + icS * 0.5, y + h * 0.5, icS);
      if (drewIcon && opts.mutedSlash) {
        const icx = startX + icS * 0.5;
        const icy = y + h * 0.5;
        const sl = icS * 0.34;
        ctx.save();
        ctx.strokeStyle = '#ef6456';
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(icx - sl, icy - sl);
        ctx.lineTo(icx + sl, icy + sl);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.fillStyle = opts.textColor || textCol;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textCx = drewIcon ? startX + icS + icGap + tw * 0.5 : x + w * 0.5;
    ctx.fillText(opts.text, textCx, y + h * 0.5 + 0.5);
  }

  ctx.restore();
}

function wrapText(ctx, text, maxWidth, font) {
  if (!text) return [''];
  ctx.save();
  if (font) ctx.font = font;
  const tokens = String(text).match(/[0-9A-Za-z.,%+\-~/:]+|\n|[\s\S]/gu) || [''];
  const lines = [];
  let line = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const test = line + tok;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      if (tok.length > 1 && ctx.measureText(tok).width > maxWidth) {
        for (const ch of Array.from(tok)) {
          if (ctx.measureText(line + ch).width > maxWidth && line.length > 0) {
            lines.push(line);
            line = ch;
          } else {
            line += ch;
          }
        }
      } else {
        lines.push(line);
        line = tok === ' ' ? '' : tok;
      }
    } else {
      line = test;
    }
  }
  if (line.length > 0 || lines.length === 0) {
    lines.push(line);
  }
  ctx.restore();
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, font, color, align = 'left', maxLines = 99) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  let lines = wrapText(ctx, text, maxWidth, font);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = `${last}…`;
  }
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  ctx.restore();
  return lines.length * lineHeight;
}

function drawFitText(ctx, text, x, y, maxWidth, baseSize, minSize, weight, color, align = 'left', baseline = 'middle') {
  ctx.save();
  let fs = baseSize;
  ctx.font = fontStr(fs, weight);
  while (fs > minSize && ctx.measureText(text).width > maxWidth) {
    fs -= 0.5;
    ctx.font = fontStr(fs, weight);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Convert HSL (h: deg, s: 0..100, l: 0..100) to rgb(r, g, b) because iOS WeChat native Canvas 2D rejects hsl(...) in addColorStop
function hslToRgbColor(h, s, l) {
  const hue = ((Number(h) || 0) % 360 + 360) % 360;
  const sat = Math.max(0, Math.min(100, Number(s) || 0)) / 100;
  const lit = Math.max(0, Math.min(100, Number(l) || 0)) / 100;
  const c = (1 - Math.abs(2 * lit - 1)) * sat;
  const hp = hue / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hp < 1) {
    r1 = c; g1 = x;
  } else if (hp < 2) {
    r1 = x; g1 = c;
  } else if (hp < 3) {
    g1 = c; b1 = x;
  } else if (hp < 4) {
    g1 = x; b1 = c;
  } else if (hp < 5) {
    r1 = x; b1 = c;
  } else {
    r1 = c; b1 = x;
  }
  const m = lit - c * 0.5;
  const r = Math.max(0, Math.min(255, Math.round((r1 + m) * 255)));
  const g = Math.max(0, Math.min(255, Math.round((g1 + m) * 255)));
  const b = Math.max(0, Math.min(255, Math.round((b1 + m) * 255)));
  return `rgb(${r}, ${g}, ${b})`;
}

// Procedural Rainbow Wildcard Konpeito Star Candy (used both inside Jar AND UI Previews!)
function drawRainbowWildcard(ctx, x, y, r, angle, nowSec, alpha = 1) {
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // Outer pastel glow
  const aura = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.55);
  aura.addColorStop(0, 'rgba(255, 255, 255, 0.72)');
  aura.addColorStop(0.55, 'rgba(255, 168, 214, 0.34)');
  aura.addColorStop(1, 'rgba(130, 224, 255, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(angle + nowSec * 0.85);
  const pts = 7;
  const grad = ctx.createLinearGradient(-r, -r, r, r);
  const hueShift = (nowSec * 90) % 360;
  grad.addColorStop(0, hslToRgbColor(hueShift, 92, 82));
  grad.addColorStop(0.35, hslToRgbColor(hueShift + 65, 95, 80));
  grad.addColorStop(0.7, hslToRgbColor(hueShift + 150, 85, 78));
  grad.addColorStop(1, hslToRgbColor(hueShift + 240, 88, 82));

  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts - Math.PI / 2;
    const rad = i % 2 === 0 ? r * 1.14 : r * 0.74;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.arc(-r * 0.18, -r * 0.22, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sparkling face
  ctx.rotate(angle * 0.25);
  ctx.fillStyle = 'rgba(255, 118, 168, 0.75)';
  fillEllipse(ctx, -r * 0.34, r * 0.14, r * 0.14, r * 0.08);
  ctx.fill();
  fillEllipse(ctx, r * 0.34, r * 0.14, r * 0.14, r * 0.08);
  ctx.fill();

  ctx.fillStyle = '#4A2C2A';
  drawStar(ctx, -r * 0.24, -r * 0.04, r * 0.18, nowSec * 1.5);
  drawStar(ctx, r * 0.24, -r * 0.04, r * 0.18, -nowSec * 1.5);

  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = Math.max(1.3, r * 0.095);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r * 0.08, r * 0.14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  if (alpha > 0.5) {
    for (let k = 0; k < 2; k++) {
      const oa = nowSec * 2.8 + k * Math.PI;
      ctx.fillStyle = k === 0 ? '#fff6a6' : '#ff99cc';
      drawStar(ctx, Math.cos(oa) * r * 1.18, Math.sin(oa) * r * 1.18, Math.max(2.4, r * 0.19), nowSec * 4);
    }
  }
  ctx.restore();
}

function drawGoldenAura(ctx, x, y, r, nowSec, alpha = 1) {
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const pulse = 0.88 + 0.12 * Math.sin(nowSec * 6);
  const grad = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.48 * pulse);
  grad.addColorStop(0, 'rgba(255, 224, 96, 0.48)');
  grad.addColorStop(0.68, 'rgba(255, 198, 56, 0.22)');
  grad.addColorStop(1, 'rgba(255, 198, 56, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.48 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(nowSec * 0.9);
  ctx.strokeStyle = 'rgba(255, 226, 102, 0.85)';
  ctx.lineWidth = 2.1;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.07, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawThemeSwatch(ctx, x, y, w, h, themeId) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, 9);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  if (themeId === 'sakura') {
    g.addColorStop(0, '#f8b7ce');
    g.addColorStop(0.65, '#8c4866');
    g.addColorStop(1, '#f5c3d6');
  } else if (themeId === 'moonlight') {
    g.addColorStop(0, '#62c2ee');
    g.addColorStop(0.65, '#14395c');
    g.addColorStop(1, '#7de2ff');
  } else {
    g.addColorStop(0, '#326478');
    g.addColorStop(0.65, '#163b4a');
    g.addColorStop(1, '#c59b52');
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);

  // Mini collar
  const cg = ctx.createLinearGradient(x + 5, y + 4, x + 5, y + 11);
  if (themeId === 'sakura') {
    cg.addColorStop(0, '#ffd8e6');
    cg.addColorStop(1, '#b05675');
  } else if (themeId === 'moonlight') {
    cg.addColorStop(0, '#e6f7ff');
    cg.addColorStop(1, '#48779c');
  } else {
    cg.addColorStop(0, '#ffe495');
    cg.addColorStop(1, '#a96d1e');
  }
  ctx.fillStyle = cg;
  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 5, y + 4, w - 10, 7, 3.5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Interactive hit-target registry rebuilt cleanly each frame in paint order.
 * Hit testing runs reverse-order so topmost modal/floating controls capture first.
 */
class HitRegistry {
  constructor() {
    this.items = [];
  }

  clear() {
    this.items.length = 0;
  }

  add(id, x, y, w, h, onClick, meta = null) {
    this.items.push({ id, x, y, w, h, onClick, meta });
  }

  findAt(px, py) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.meta && it.meta.clipRect) {
        const cr = it.meta.clipRect;
        if (px < cr.x || px > cr.x + cr.w || py < cr.y || py > cr.y + cr.h) continue;
      }
      if (px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h) {
        return it;
      }
    }
    return null;
  }
}

module.exports = {
  FONT_FAMILY,
  KISSA_THEME,
  fontStr,
  hslToRgbColor,
  roundRectPath,
  fillEllipse,
  drawStar,
  drawSakuraPetal,
  drawHeartIcon,
  drawCoverImage,
  drawContainImage,
  drawUiIcon,
  drawWoodBoard,
  drawParchmentSheet,
  drawKissaCard,
  drawTagBadge,
  drawNoticeBanner,
  drawCurrencyChip,
  drawPillButton,
  wrapText,
  drawWrappedText,
  drawFitText,
  drawRainbowWildcard,
  drawGoldenAura,
  drawThemeSwatch,
  HitRegistry
};
