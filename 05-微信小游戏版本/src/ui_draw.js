/**
 * Canvas 2D Storybook UI Drawing Primitives, Safe Geometry Helpers,
 * CJK Text Wrapping, Procedural Special Candy Drawing & Hit/Scroll Registry.
 */
'use strict';

const FONT_FAMILY = 'PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif';

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
  if (!img || !img.width || !img.height) return;
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
  if (!img || !img.width || !img.height) return;
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, cx - dw * 0.5, cy - dh * 0.5, dw, dh);
}

function drawWoodBoard(ctx, x, y, w, h, radius = 14, withRivets = true) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#c0854b');
  g.addColorStop(0.55, '#8c5529');
  g.addColorStop(1, '#693b1a');
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();

  // Inner top sheen
  ctx.strokeStyle = 'rgba(255, 224, 166, 0.36)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(4, radius - 2));
  ctx.stroke();

  if (withRivets && w > 60) {
    const rivetR = w < 220 ? 3.5 : 4.5;
    const rxOffsets = [x + 11, x + w - 11];
    const ry = y + 8;
    for (let i = 0; i < rxOffsets.length; i++) {
      const rx = rxOffsets[i];
      const rg = ctx.createRadialGradient(rx - 1, ry - 1, 0.5, rx, ry, rivetR);
      rg.addColorStop(0, '#ffe69b');
      rg.addColorStop(1, '#a97023');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(rx, ry, rivetR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#4A2C2A';
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParchmentSheet(ctx, x, y, w, h, radius = 10, topCol = '#fbf4df', botCol = '#f0dfba', borderCol = '#4A2C2A', lineWidth = 2) {
  ctx.save();
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, topCol);
  g.addColorStop(1, botCol);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();
  if (lineWidth > 0) {
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = borderCol;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPillButton(ctx, x, y, w, h, opts = {}) {
  const style = opts.style || 'wood';
  const radius = opts.radius !== undefined ? opts.radius : Math.min(h * 0.5, 18);
  const disabled = !!opts.disabled;

  let topCol = '#f8e9c7';
  let botCol = '#e7c98f';
  let borderCol = '#4A2C2A';
  let lipCol = '#5b3317';
  let textCol = '#4A2C2A';
  let borderW = 2;

  if (style === 'cta') {
    topCol = '#ffe484';
    botCol = '#df8c22';
    lipCol = '#8f4e11';
    textCol = '#421e08';
    borderW = 2.5;
  } else if (style === 'active') {
    topCol = '#ffe395';
    botCol = '#efb44c';
    lipCol = '#7a4614';
  } else if (style === 'equipped') {
    topCol = '#daf3e2';
    botCol = '#b4e2c2';
    borderCol = '#2f724c';
    lipCol = '#2f724c';
    textCol = '#1f5c3a';
  } else if (style === 'card') {
    topCol = '#fffcf3';
    botCol = '#f7e9c7';
    borderCol = '#bc9358';
    lipCol = null;
  } else if (style === 'cardSelected') {
    topCol = '#fff5cb';
    botCol = '#ffd97c';
    borderCol = '#4A2C2A';
    lipCol = '#8a5418';
  } else if (style === 'dark') {
    topCol = 'rgba(64, 36, 18, 0.92)';
    botCol = 'rgba(42, 23, 12, 0.94)';
    borderCol = '#c69148';
    lipCol = null;
    textCol = '#fce9c4';
  } else if (style === 'danger') {
    topCol = '#e94f43';
    botCol = '#c53226';
    borderCol = '#4A2C2A';
    lipCol = '#6b1812';
    textCol = '#ffffff';
  }

  ctx.save();
  if (disabled) ctx.globalAlpha = 0.52;

  // 3D bevel bottom lip
  if (lipCol && !disabled) {
    ctx.fillStyle = lipCol;
    roundRectPath(ctx, x, y + 2.5, w, h, radius);
    ctx.fill();
  }

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, topCol);
  g.addColorStop(1, botCol);
  ctx.fillStyle = g;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  ctx.lineWidth = borderW;
  ctx.strokeStyle = borderCol;
  ctx.stroke();

  if (opts.text) {
    const fs = opts.fontSize || Math.max(11, Math.min(15, h * 0.44));
    let curFs = fs;
    ctx.font = fontStr(curFs, opts.fontWeight || 800);
    const maxTw = w - 12;
    while (curFs > 9 && ctx.measureText(opts.text).width > maxTw) {
      curFs -= 0.5;
      ctx.font = fontStr(curFs, opts.fontWeight || 800);
    }
    ctx.fillStyle = opts.textColor || textCol;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(opts.text, x + w * 0.5, y + h * 0.5 + 0.5);
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
  grad.addColorStop(0, `hsl(${hueShift}, 92%, 82%)`);
  grad.addColorStop(0.35, `hsl(${(hueShift + 65) % 360}, 95%, 80%)`);
  grad.addColorStop(0.7, `hsl(${(hueShift + 150) % 360}, 85%, 78%)`);
  grad.addColorStop(1, `hsl(${(hueShift + 240) % 360}, 88%, 82%)`);

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
  fontStr,
  roundRectPath,
  fillEllipse,
  drawStar,
  drawSakuraPetal,
  drawHeartIcon,
  drawCoverImage,
  drawContainImage,
  drawWoodBoard,
  drawParchmentSheet,
  drawPillButton,
  wrapText,
  drawWrappedText,
  drawFitText,
  drawRainbowWildcard,
  drawGoldenAura,
  drawThemeSwatch,
  HitRegistry
};
