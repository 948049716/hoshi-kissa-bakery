/**
 * Starlight Glass Jar & Physics World Canvas 2D Renderer
 * Renders the 440x520 logical chamber with exact Center-of-Mass sprite registration,
 * themed glass materials, lock-on aim guide, magnet tethers, Yarn Ball, and juicy FX.
 */
'use strict';

const { TIERS, WILDCARD_RADIUS, JAR, SOLO_EMOTES } = require('./constants');
const PHYSICS_SHAPES = require('./physics_shapes');
const Physics = require('./physics');
const UI = require('./ui_draw');

function getShapeDef(tier) {
  return PHYSICS_SHAPES[`tier_${tier}`];
}

function traceJarInnerPath(ctx) {
  const { left, right, neckY, floorY, cornerR } = JAR;
  ctx.beginPath();
  ctx.moveTo(left, neckY);
  ctx.lineTo(left, floorY - cornerR);
  ctx.arc(left + cornerR, floorY - cornerR, cornerR, Math.PI, Math.PI / 2, true);
  ctx.lineTo(right - cornerR, floorY);
  ctx.arc(right - cornerR, floorY - cornerR, cornerR, Math.PI / 2, 0, true);
  ctx.lineTo(right, neckY);
}

function computeDessertAnimPose(tier, anim) {
  if (!anim) {
    return { dx: 0, dy: 0, dAngle: 0, sx: 1, sy: 1, spriteKind: 'base' };
  }
  const p = Math.max(0, Math.min(1, anim.t / anim.dur));
  const env = Math.sin(p * Math.PI);

  if (anim.kind === 'interact') {
    const s = anim.isLeader ? 1 : -1;
    const ux = anim.ux || 0;
    const uy = anim.uy || 0;
    const tx = -uy;
    const ty = ux;

    if (anim.style === 'nuzzle') {
      const push = Math.sin(p * Math.PI) * 3.8;
      const rub = Math.sin(p * Math.PI * 4) * 2.1 * env * s;
      return {
        dx: ux * push + tx * rub,
        dy: uy * push + ty * rub,
        dAngle: Math.sin(p * Math.PI * 4) * 0.14 * env * s,
        sx: 1 + 0.08 * Math.sin(p * Math.PI * 2) * env,
        sy: 1 - 0.06 * Math.sin(p * Math.PI * 2) * env,
        spriteKind: 'int'
      };
    } else if (anim.style === 'boop') {
      const wave = Math.abs(Math.sin(p * Math.PI * 2)) * env;
      return {
        dx: ux * wave * 4.2,
        dy: uy * wave * 4.2,
        dAngle: Math.sin(p * Math.PI * 2) * 0.09 * env * s,
        sx: 1 + 0.11 * wave,
        sy: 1 - 0.09 * wave,
        spriteKind: 'int'
      };
    } else {
      const hop = Math.abs(Math.sin(p * Math.PI * 3)) * env;
      return {
        dx: ux * 2.4 * env,
        dy: uy * 2.0 * env - hop * 3.0,
        dAngle: Math.sin(p * Math.PI * 3) * 0.15 * env * s,
        sx: 1 + 0.07 * Math.sin(p * Math.PI * 3) * env,
        sy: 1 - 0.05 * Math.sin(p * Math.PI * 3) * env,
        spriteKind: p > 0.35 && p < 0.72 ? 'act' : 'int'
      };
    }
  }

  switch (tier) {
    case 1:
      return {
        dx: 0,
        dy: -Math.abs(Math.sin(p * Math.PI * 2)) * 5.2 * env,
        dAngle: Math.sin(p * Math.PI * 4) * 0.16 * env,
        sx: 1 + 0.08 * Math.cos(p * Math.PI * 4) * env,
        sy: 1 - 0.07 * Math.cos(p * Math.PI * 4) * env,
        spriteKind: 'act'
      };
    case 2:
      return {
        dx: 0,
        dy: -2.6 * env,
        dAngle: Math.sin(p * Math.PI * 2) * 0.09 * env,
        sx: 1 + 0.13 * Math.sin(p * Math.PI * 3) * env,
        sy: 1 - 0.09 * Math.sin(p * Math.PI * 3) * env,
        spriteKind: 'act'
      };
    case 3:
      return {
        dx: 0,
        dy: -3.6 * Math.abs(Math.sin(p * Math.PI * 2)) * env,
        dAngle: Math.sin(p * Math.PI * 8) * 0.15 * env,
        sx: 1 - 0.06 * Math.sin(p * Math.PI * 2) * env,
        sy: 1 + 0.09 * Math.sin(p * Math.PI * 2) * env,
        spriteKind: 'act'
      };
    case 4:
      return {
        dx: Math.sin(p * Math.PI * 4) * 3.0 * env,
        dy: -1.8 * env,
        dAngle: Math.sin(p * Math.PI * 4) * 0.09 * env,
        sx: 1 + 0.12 * Math.sin(p * Math.PI * 5) * env,
        sy: 1 - 0.10 * Math.sin(p * Math.PI * 5) * env,
        spriteKind: 'act'
      };
    case 5:
      return {
        dx: 0,
        dy: -Math.max(0, Math.sin(p * Math.PI * 2)) * 5.8 * env,
        dAngle: Math.sin(p * Math.PI * 2) * 0.08 * env,
        sx: 1 - 0.11 * Math.sin(p * Math.PI * 2) * env,
        sy: 1 + 0.14 * Math.sin(p * Math.PI * 2) * env,
        spriteKind: 'act'
      };
    case 6:
      return {
        dx: 0,
        dy: -3.0 * env,
        dAngle: Math.sin(p * Math.PI * 3) * 0.24 * env,
        sx: 1 + 0.08 * env,
        sy: 1 + 0.08 * env,
        spriteKind: 'act'
      };
    case 7:
      return {
        dx: 0,
        dy: -4.2 * env,
        dAngle: Math.sin(p * Math.PI * 6) * 0.07 * env,
        sx: 1 - 0.08 * env,
        sy: 1 + 0.14 * env,
        spriteKind: 'act'
      };
    case 8:
      return {
        dx: 0,
        dy: -4.0 * env,
        dAngle: Math.sin(p * Math.PI * 2) * 0.07 * env,
        sx: 1 + 0.09 * env,
        sy: 1 + 0.12 * env,
        spriteKind: 'act'
      };
    case 9:
    default:
      return {
        dx: 0,
        dy: -Math.abs(Math.sin(p * Math.PI * 3)) * 7.2 * env,
        dAngle: Math.sin(p * Math.PI * 3) * 0.09 * env,
        sx: 1 + 0.10 * Math.cos(p * Math.PI * 6) * env,
        sy: 1 - 0.07 * Math.cos(p * Math.PI * 6) * env,
        spriteKind: 'act'
      };
  }
}

function drawDessertActionFX(ctx, x, y, r, tier, anim) {
  if (!anim) return;
  const p = Math.max(0, Math.min(1, anim.t / anim.dur));
  const env = Math.sin(p * Math.PI);
  if (env <= 0.04) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, env * 1.25);

  if (anim.kind === 'interact') {
    if (!anim.isLeader) {
      ctx.restore();
      return;
    }
    const cx = anim.cx;
    const cy = anim.cy;
    const floatY = cy - 6 - p * 14;

    if (anim.style === 'nuzzle') {
      UI.drawHeartIcon(ctx, cx, floatY, 13 + 3 * env, '#ff6f9c');
      UI.drawHeartIcon(ctx, cx + 10, floatY - 7, 8 + 2 * env, '#ffa3c2');
    } else if (anim.style === 'boop') {
      UI.drawStar(ctx, cx - 7, floatY, 5.5 * env, p * 5);
      ctx.fillStyle = '#ffe169';
      UI.drawStar(ctx, cx + 8, floatY - 4, 4.5 * env, -p * 5);
    } else {
      ctx.font = UI.fontStr(13, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3c2118';
      const note = p < 0.5 ? '♪' : '♫';
      ctx.strokeText(note, cx + Math.sin(p * 10) * 5, floatY);
      ctx.fillStyle = '#ffe47a';
      ctx.fillText(note, cx + Math.sin(p * 10) * 5, floatY);
    }
    ctx.restore();
    return;
  }

  const label = tier === 7 && p < 0.35 ? 'Zzz' : SOLO_EMOTES[(tier - 1) % SOLO_EMOTES.length];
  const ex = x + r * 0.55;
  const ey = y - r * 0.72 - p * 10;
  ctx.font = UI.fontStr(11.5, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = '#3c2118';
  ctx.strokeText(label, ex, ey);
  ctx.fillStyle = '#fff3b8';
  ctx.fillText(label, ex, ey);
  ctx.restore();
}

function drawTierSprite(ctx, sprites, tier, x, y, r, angle, squishAmt = 0, squishAngle = 0, alpha = 1, anim = null) {
  const def = TIERS[tier - 1];
  const shapeDef = getShapeDef(tier);
  const pose = computeDessertAnimPose(tier, anim);
  let img = sprites.base[tier];
  if (pose.spriteKind === 'act' && sprites.act[tier]) {
    img = sprites.act[tier];
  } else if (pose.spriteKind === 'int' && sprites.int[tier]) {
    img = sprites.int[tier];
  }

  if (!img) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x + pose.dx, y + pose.dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.translate(x + pose.dx, y + pose.dy);

  const totalAngle = angle + pose.dAngle;
  if (Math.abs(squishAmt) > 0.002) {
    ctx.rotate(squishAngle);
    ctx.scale(1 - squishAmt, 1 + squishAmt * 0.82);
    ctx.rotate(totalAngle - squishAngle);
  } else {
    ctx.rotate(totalAngle);
  }

  if (pose.sx !== 1 || pose.sy !== 1) {
    ctx.scale(pose.sx, pose.sy);
  }

  if (shapeDef) {
    const scale = r / shapeDef.r_eq_px;
    const dw = shapeDef.width * scale;
    const dh = shapeDef.height * scale;
    const ox = -shapeDef.com_x * scale;
    const oy = -shapeDef.com_y * scale;
    ctx.drawImage(img, ox, oy, dw, dh);
  } else {
    const scale = r / (def.meta.radius_norm_w * img.width);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, -def.meta.anchor_x_norm * dw, -def.meta.anchor_y_norm * dh, dw, dh);
  }
  ctx.restore();
}

function drawYarnBallEntity(ctx, yarnBallImg, e, nowSec) {
  const shapeDef = PHYSICS_SHAPES.event_yarn_ball;
  const hitFlash = e.yarnHitFlash > 0 ? Math.min(1, e.yarnHitFlash / 0.45) : 0;

  ctx.save();
  const jitterX = hitFlash > 0 ? Math.sin(nowSec * 90) * 3.2 * hitFlash : 0;
  const jitterY = hitFlash > 0 ? Math.cos(nowSec * 82) * 2.4 * hitFlash : 0;
  ctx.translate(e.x + jitterX, e.y + jitterY);

  const ringPulse = 0.55 + 0.45 * Math.sin(nowSec * 6.5);
  ctx.save();
  ctx.rotate(nowSec * 1.1);
  ctx.strokeStyle =
    hitFlash > 0.1
      ? 'rgba(255, 255, 255, 0.85)'
      : e.yarnHp === 1
      ? `rgba(255, 118, 132, ${0.65 + 0.35 * ringPulse})`
      : `rgba(255, 186, 210, ${0.45 + 0.35 * ringPulse})`;
  ctx.lineWidth = e.yarnHp === 1 ? 2.6 : 2.0;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, e.r + 4.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  if (Math.abs(e.squishAmt) > 0.002) {
    ctx.rotate(e.squishAngle);
    ctx.scale(1 - e.squishAmt, 1 + e.squishAmt * 0.82);
    ctx.rotate(e.angle - e.squishAngle);
  } else {
    ctx.rotate(e.angle);
  }
  if (yarnBallImg && shapeDef) {
    const scale = e.r / shapeDef.r_eq_px;
    ctx.drawImage(
      yarnBallImg,
      -shapeDef.com_x * scale,
      -shapeDef.com_y * scale,
      shapeDef.width * scale,
      shapeDef.height * scale
    );
  } else {
    ctx.fillStyle = '#f28b99';
    ctx.beginPath();
    ctx.arc(0, 0, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  if (hitFlash > 0.05) {
    ctx.fillStyle = `rgba(255, 235, 240, ${hitFlash * 0.6})`;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.02, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // HP corner badge
  const bx = e.r * 0.52;
  const by = -e.r * 0.72;
  ctx.fillStyle = e.yarnHp === 1 ? 'rgba(214, 52, 68, 0.94)' : 'rgba(64, 32, 24, 0.92)';
  ctx.strokeStyle = e.yarnHp === 1 ? '#ffe388' : '#ffb8d0';
  ctx.lineWidth = 1.5;
  UI.roundRectPath(ctx, bx - 19, by - 9, 38, 18, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff8ec';
  ctx.font = UI.fontStr(10.5, 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`🧶×${e.yarnHp}`, bx, by + 0.5);
  ctx.restore();
}

function drawMagnetLinks(ctx, magnetLinks, nowSec) {
  if (!magnetLinks || magnetLinks.length === 0) return;
  ctx.save();
  for (let i = 0; i < magnetLinks.length; i++) {
    const lk = magnetLinks[i];
    const { a, b, strength, isWild } = lk;
    if (!a || !b || a.merged || b.merged) continue;
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = -dy / dist;
    const ny = dx / dist;
    const bend = Math.sin(nowSec * 14 + i) * 7 * strength;

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx + nx * bend, my + ny * bend, b.x, b.y);
    ctx.strokeStyle = isWild
      ? `rgba(255, 160, 215, ${0.42 + strength * 0.5})`
      : `rgba(255, 225, 102, ${0.35 + strength * 0.52})`;
    ctx.lineWidth = 1.8 + strength * 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();

    const t = (nowSec * 2.6 + i * 0.37) % 1;
    const bx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * (mx + nx * bend) + t * t * b.x;
    const by = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * (my + ny * bend) + t * t * b.y;
    ctx.fillStyle = isWild ? '#ffd6f0' : '#fff4a8';
    UI.drawStar(ctx, bx, by, 3.6 + strength * 2.2, nowSec * 7);
  }
  ctx.restore();
}

function drawShapePolygons(ctx, shapeDef, x, y, r, angle, strokeStyle, lineWidth, fillStyle = null, dash = null) {
  if (!shapeDef) return;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.save();
  if (dash) ctx.setLineDash(dash);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  if (fillStyle) ctx.fillStyle = fillStyle;
  for (const poly of shapeDef.polygons) {
    ctx.beginPath();
    for (let i = 0; i < poly.length; i++) {
      const lx = poly[i][0] * r;
      const ly = poly[i][1] * r;
      const wx = x + lx * cos - ly * sin;
      const wy = y + lx * sin + ly * cos;
      if (i === 0) ctx.moveTo(wx, wy);
      else ctx.lineTo(wx, wy);
    }
    ctx.closePath();
    if (fillStyle) ctx.fill();
    ctx.stroke();
  }
  if (dash) ctx.setLineDash([]);
  ctx.restore();
}

function drawEntityWorldPolys(ctx, entity, strokeStyle, lineWidth) {
  if (!entity.worldPolys) return;
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  for (const wp of entity.worldPolys) {
    const verts = wp.verts;
    ctx.beginPath();
    for (let i = 0; i < verts.length; i++) {
      if (i === 0) ctx.moveTo(verts[i].x, verts[i].y);
      else ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function drawPhysicsDebugOverlay(ctx, gameState) {
  const polyPalette = [
    { stroke: 'rgba(72, 238, 255, 0.95)', fill: 'rgba(72, 238, 255, 0.14)' },
    { stroke: 'rgba(255, 212, 74, 0.95)', fill: 'rgba(255, 212, 74, 0.16)' },
    { stroke: 'rgba(255, 130, 175, 0.95)', fill: 'rgba(255, 130, 175, 0.16)' },
    { stroke: 'rgba(135, 255, 148, 0.95)', fill: 'rgba(135, 255, 148, 0.16)' },
    { stroke: 'rgba(196, 152, 255, 0.95)', fill: 'rgba(196, 152, 255, 0.16)' }
  ];

  ctx.save();
  traceJarInnerPath(ctx);
  ctx.strokeStyle = 'rgba(100, 240, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const e of gameState.entities) {
    if (!e.worldPolys) continue;
    for (let p = 0; p < e.worldPolys.length; p++) {
      const verts = e.worldPolys[p].verts;
      const pal = polyPalette[p % polyPalette.length];
      ctx.beginPath();
      for (let i = 0; i < verts.length; i++) {
        if (i === 0) ctx.moveTo(verts[i].x, verts[i].y);
        else ctx.lineTo(verts[i].x, verts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = pal.fill;
      ctx.fill();
      ctx.strokeStyle = pal.stroke;
      ctx.lineWidth = 1.7;
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.fillStyle = pal.stroke;
      for (let i = 0; i < verts.length; i++) {
        ctx.beginPath();
        ctx.arc(verts[i].x, verts[i].y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const ox = e.x + Math.cos(e.angle) * Math.min(16, e.r * 0.45);
    const oy = e.y + Math.sin(e.angle) * Math.min(16, e.r * 0.45);
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(ox, oy);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(e.x, e.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff4b4b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  const contacts = gameState.lastDebugContacts || [];
  for (let i = 0; i < contacts.length; i++) {
    const ct = contacts[i];
    const ex = ct.px + ct.nx * 16;
    const ey = ct.py + ct.ny * 16;

    ctx.beginPath();
    ctx.moveTo(ct.px, ct.py);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = '#ffe259';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(ct.px, ct.py);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff6b2b';
    ctx.strokeStyle = '#fff5b8';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-3.2, -3.2, 6.4, 6.4);
    ctx.strokeRect(-3.2, -3.2, 6.4, 6.4);
    ctx.restore();
  }

  const polyCount = gameState.entities.reduce((s, e) => s + (e.worldPolys ? e.worldPolys.length : 0), 0);
  const label = `SAT 复合多边形 · ${gameState.entities.length}体 / ${polyCount}凸块 / ${contacts.length}接触点`;
  ctx.fillStyle = 'rgba(10, 22, 32, 0.78)';
  ctx.strokeStyle = 'rgba(72, 238, 255, 0.55)';
  ctx.lineWidth = 1.2;
  UI.roundRectPath(ctx, JAR.left + 10, JAR.neckY + 14, 246, 21, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#a8f6ff';
  ctx.font = UI.fontStr(11, 700);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, JAR.left + 18, JAR.neckY + 25);
  ctx.restore();
}

function predictLandingY(tier, dropX, angle, entities, isWildcard = false) {
  const r = isWildcard ? WILDCARD_RADIUS : TIERS[tier - 1].radius;
  const shapeDef = isWildcard ? getShapeDef(1) : getShapeDef(tier);
  if (!shapeDef || !Physics) return JAR.floorY - r;
  const hitY = Physics.predictDropLandingY(
    shapeDef,
    r,
    dropX,
    JAR.dropY,
    angle,
    JAR,
    entities
  );
  return Math.max(JAR.dropY + 20, hitY);
}

function findAimMergeTarget(gameState, tier, dropX, landY, isWildcard, magnetLv) {
  const curR = isWildcard ? WILDCARD_RADIUS : TIERS[tier - 1].radius;
  const lockPad = 14 + magnetLv * 6 + (gameState.feverTimer > 0 ? 14 : 0);
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < gameState.entities.length; i++) {
    const e = gameState.entities[i];
    if (e.merged || e.isYarnBall) continue;
    const canMerge = isWildcard ? true : e.isWildcard || e.tier === tier;
    if (!canMerge) continue;
    const d = Math.hypot(e.x - dropX, e.y - landY);
    if (d <= e.r + curR + lockPad && d < bestDist) {
      bestDist = d;
      best = e;
    }
  }
  return best;
}

function renderJarStage(ctx, box, gameState, theme, sprites, nowSec, effectiveMagnetLv) {
  const scale = box.scale;
  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.scale(scale, scale);

  // Shake amplitude
  let shakeX = 0;
  let shakeY = 0;
  if (gameState.jarShakeAmp > 0.01) {
    shakeX += Math.sin(nowSec * 52) * 7 * gameState.jarShakeAmp;
    shakeY += Math.cos(nowSec * 44) * 4 * gameState.jarShakeAmp;
  }
  if (gameState.screenShake > 0.05) {
    shakeX += (Math.sin(nowSec * 97) * 0.7 + Math.cos(nowSec * 73) * 0.3) * gameState.screenShake;
    shakeY += (Math.cos(nowSec * 89) * 0.7 + Math.sin(nowSec * 61) * 0.3) * gameState.screenShake;
  }
  if (shakeX !== 0 || shakeY !== 0) {
    ctx.translate(shakeX, shakeY);
  }

  const isFever = gameState.feverTimer > 0;
  const isChime = !!(gameState.activeEvent && gameState.activeEvent.kind === 'chime');

  // 1. Soft floor shadow under glass jar on wooden counter
  const shadowGrad = ctx.createRadialGradient(220, JAR.floorY + 12, 20, 220, JAR.floorY + 12, 165);
  shadowGrad.addColorStop(0, 'rgba(38, 18, 6, 0.55)');
  shadowGrad.addColorStop(1, 'rgba(38, 18, 6, 0)');
  ctx.fillStyle = shadowGrad;
  UI.fillEllipse(ctx, 220, JAR.floorY + 11, 155, 18);
  ctx.fill();

  // 2. Translucent glass chamber fill + clip internal motes / shooting stars / chime pulse
  ctx.save();
  traceJarInnerPath(ctx);
  ctx.closePath();
  const bgGrad = ctx.createLinearGradient(0, JAR.neckY, 0, JAR.floorY);
  if (isFever) {
    const shimmer = 0.5 + 0.5 * Math.sin(nowSec * 3.8);
    bgGrad.addColorStop(0, `rgba(255, 226, 130, ${0.24 + shimmer * 0.1})`);
    bgGrad.addColorStop(0.5, `rgba(255, 168, 210, ${0.14 + (1 - shimmer) * 0.08})`);
    bgGrad.addColorStop(1, `rgba(146, 232, 218, ${0.18 + shimmer * 0.08})`);
  } else {
    bgGrad.addColorStop(0, theme.glassTop);
    bgGrad.addColorStop(0.6, theme.glassMid);
    bgGrad.addColorStop(1, theme.glassBot);
  }
  ctx.fillStyle = bgGrad;
  ctx.fill();

  ctx.clip();
  if (isChime) {
    const hearth = 0.1 + 0.08 * Math.sin(nowSec * 5.2);
    const chGrad = ctx.createRadialGradient(220, 290, 40, 220, 290, 230);
    chGrad.addColorStop(0, `rgba(255, 214, 96, ${hearth * 0.5})`);
    chGrad.addColorStop(1, `rgba(255, 168, 52, ${hearth * 1.4})`);
    ctx.fillStyle = chGrad;
    ctx.fillRect(JAR.left, JAR.neckY, JAR.right - JAR.left, JAR.floorY - JAR.neckY);
  }

  // Shooting Stars
  if (gameState.shootingStars.length > 0) {
    for (const st of gameState.shootingStars) {
      const a = Math.max(0, Math.min(1, st.life / st.maxLife));
      ctx.save();
      ctx.globalAlpha = a;
      const tailX = st.x - st.vx * 0.18;
      const tailY = st.y - st.vy * 0.18;
      const g = ctx.createLinearGradient(st.x, st.y, tailX, tailY);
      g.addColorStop(0, 'rgba(255, 248, 198, 0.95)');
      g.addColorStop(0.5, 'rgba(255, 214, 96, 0.55)');
      g.addColorStop(1, 'rgba(255, 214, 96, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(st.x, st.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.fillStyle = '#fff9d6';
      UI.drawStar(ctx, st.x, st.y, 7, nowSec * 8);
      ctx.restore();
    }
  }

  // Internal glass motes
  const moteCount = isFever ? 12 : theme.id === 'amber' ? 6 : 9;
  const spanY = JAR.floorY - JAR.neckY;
  for (let m = 0; m < moteCount; m++) {
    const mx = JAR.left + 22 + ((m * 47 + Math.sin(nowSec * (isFever ? 1.4 : 0.8) + m) * 20) % (JAR.right - JAR.left - 44));
    if (theme.moteKind === 'petal' && !isFever) {
      const my = JAR.neckY + (((nowSec * 28 + m * 61) % spanY));
      ctx.fillStyle = m % 2 === 0 ? 'rgba(255, 206, 226, 0.52)' : 'rgba(255, 174, 206, 0.42)';
      UI.drawSakuraPetal(ctx, mx, my, 4.2 + (m % 2) * 1.4, nowSec * 1.4 + m);
    } else if (theme.moteKind === 'starfish' && !isFever) {
      const my = JAR.floorY - (((nowSec * 24 + m * 57) % spanY));
      ctx.fillStyle = m % 2 === 0 ? 'rgba(154, 236, 255, 0.45)' : 'rgba(210, 248, 255, 0.38)';
      UI.drawStar(ctx, mx, my, 2.8 + (m % 3) * 0.9, nowSec * 1.1 + m);
    } else {
      const my = JAR.floorY - (((nowSec * (isFever ? 65 : 22) + m * 59) % spanY));
      ctx.fillStyle = isFever
        ? (m % 2 === 0 ? 'rgba(255, 234, 138, 0.48)' : 'rgba(255, 182, 220, 0.44)')
        : theme.moteColor;
      UI.drawStar(ctx, mx, my, isFever ? 3.2 + (m % 3) : 2.1 + (m % 2) * 0.8, nowSec * (isFever ? 3 : 1.2) + m);
    }
  }
  ctx.restore();

  // 3. Danger Overflow Line
  const dangerRatio = Math.min(1, gameState.dangerDuration / 2.65);
  ctx.save();
  ctx.beginPath();
  ctx.setLineDash([7, 6]);
  ctx.moveTo(JAR.left + 8, JAR.dangerY);
  ctx.lineTo(JAR.right - 8, JAR.dangerY);
  if (dangerRatio > 0.05) {
    const pulse = 0.55 + 0.45 * Math.sin(nowSec * 12);
    ctx.strokeStyle = `rgba(255, 92, 82, ${0.5 + 0.5 * pulse})`;
    ctx.lineWidth = 2.6;
  } else {
    ctx.strokeStyle = 'rgba(255, 214, 138, 0.36)';
    ctx.lineWidth = 1.8;
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (dangerRatio > 0.08) {
    const rem = Math.max(0, 2.65 - gameState.dangerDuration).toFixed(1);
    ctx.fillStyle = gameState.mode === 'rush' ? 'rgba(224, 114, 38, 0.94)' : 'rgba(224, 62, 52, 0.92)';
    UI.roundRectPath(ctx, 148, JAR.dangerY - 22, 144, 20, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = UI.fontStr(12, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      gameState.mode === 'rush' ? `🌪️ 星风预警 ${rem}s` : `⚠️ 即将溢出 ${rem}s`,
      220,
      JAR.dangerY - 12
    );
  }
  ctx.restore();

  // 4. Aim Drop Trajectory + Lock-on Target + Ghost + Held Treat
  let lockedTarget = null;
  if (gameState.running && !gameState.over && !gameState.activeToolMode) {
    const curMeta = gameState.curMeta || { wildcard: false, golden: false };
    const curIsWild = !!curMeta.wildcard;
    const curIsGold = !curIsWild && !!curMeta.golden;
    const curR = curIsWild ? WILDCARD_RADIUS : TIERS[gameState.curTier - 1].radius;
    const curShape = curIsWild ? getShapeDef(1) : getShapeDef(gameState.curTier);
    const aimAngle = Math.max(-0.78, Math.min(0.78, gameState.aimAngle));
    const landY = predictLandingY(gameState.curTier, gameState.dropX, aimAngle, gameState.entities, curIsWild);
    lockedTarget = findAimMergeTarget(gameState, gameState.curTier, gameState.dropX, landY, curIsWild, effectiveMagnetLv);
    const isAimCancelled = gameState.touchAim.active && gameState.touchAim.cancelled;
    const isTouchAiming = gameState.touchAim.active && !gameState.touchAim.cancelled;
    const [lr, lg, lb] = theme.lockColor;

    // Guide line
    ctx.save();
    if (isAimCancelled) ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.setLineDash(lockedTarget ? [7, 4] : [6, 6]);
    ctx.moveTo(gameState.dropX, JAR.dropY + curR * 0.9 + 2);
    ctx.lineTo(gameState.dropX, Math.max(JAR.dropY + curR, landY - curR * 0.65));
    if (lockedTarget) {
      const pulse = 0.72 + 0.28 * Math.sin(nowSec * 10);
      ctx.strokeStyle = curIsWild ? `rgba(255, 168, 224, ${pulse})` : `rgba(${lr}, ${lg}, ${lb}, ${pulse})`;
      ctx.lineWidth = isTouchAiming ? 3.2 : 2.8;
    } else {
      ctx.strokeStyle = curIsWild
        ? 'rgba(255, 186, 232, 0.72)'
        : curIsGold
        ? 'rgba(255, 224, 102, 0.76)'
        : isTouchAiming
        ? theme.guideTouch
        : theme.guideLine;
      ctx.lineWidth = isTouchAiming ? 2.4 : 1.8;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Ghost landing contour
    if (landY > JAR.dropY + 26 && !isAimCancelled) {
      if (curIsWild) {
        UI.drawRainbowWildcard(ctx, gameState.dropX, landY, curR, aimAngle, nowSec, 0.34);
      } else {
        drawTierSprite(ctx, sprites, gameState.curTier, gameState.dropX, landY, curR, aimAngle, 0, 0, isTouchAiming ? 0.34 : 0.25);
      }
      drawShapePolygons(
        ctx,
        curShape,
        gameState.dropX,
        landY,
        curR,
        aimAngle,
        lockedTarget ? `rgba(${lr}, ${lg}, ${lb}, 0.95)` : isTouchAiming ? theme.guideTouch : theme.guideLine,
        lockedTarget ? 2.2 : 1.5,
        lockedTarget ? `rgba(${lr}, ${lg}, ${lb}, 0.16)` : `rgba(${lr}, ${lg}, ${lb}, 0.06)`,
        [4, 4]
      );

      if (lockedTarget) {
        const tagText = curIsWild ? '🌈 升阶+1!' : curIsGold || lockedTarget.isGolden ? '✨ 黄金暴击!' : '✦ 可合成!';
        const tagY = Math.max(JAR.neckY + 20, landY - curR - 14);
        const tagX = Math.max(JAR.left + 44, Math.min(JAR.right - 44, gameState.dropX));
        ctx.save();
        ctx.fillStyle = curIsWild ? 'rgba(130, 32, 92, 0.9)' : 'rgba(66, 36, 12, 0.9)';
        ctx.strokeStyle = curIsWild ? '#ffb8e6' : `rgb(${lr}, ${lg}, ${lb})`;
        ctx.lineWidth = 1.5;
        UI.roundRectPath(ctx, tagX - 38, tagY - 10, 76, 20, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff5be';
        ctx.font = UI.fontStr(11, 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, tagX, tagY);
        ctx.restore();
      }
    }

    // Current hovering treat
    if (gameState.dropCooldown <= 0.09) {
      const visualAngle = aimAngle + gameState.dropSway * 0.45;
      ctx.save();
      if (isAimCancelled) ctx.globalAlpha = 0.45;
      if (curIsWild) {
        UI.drawRainbowWildcard(ctx, gameState.dropX, JAR.dropY, curR, visualAngle, nowSec, 1);
      } else {
        if (curIsGold) UI.drawGoldenAura(ctx, gameState.dropX, JAR.dropY, curR, nowSec, 1);
        drawTierSprite(ctx, sprites, gameState.curTier, gameState.dropX, JAR.dropY, curR, visualAngle, 0, 0, 1, gameState.heldActionAnim);
        if (gameState.heldActionAnim) {
          drawDessertActionFX(ctx, gameState.dropX, JAR.dropY, curR, gameState.curTier, gameState.heldActionAnim);
        }
      }
      ctx.restore();

      if (isAimCancelled) {
        ctx.save();
        ctx.fillStyle = 'rgba(42, 22, 12, 0.88)';
        ctx.strokeStyle = 'rgba(255, 210, 140, 0.8)';
        ctx.lineWidth = 1.4;
        UI.roundRectPath(ctx, JAR.canvasW / 2 - 58, JAR.neckY + 12, 116, 22, 11);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffe8bc';
        ctx.font = UI.fontStr(11, 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↑ 松手取消投放', JAR.canvasW / 2, JAR.neckY + 23);
        ctx.restore();
      }

      if (Math.abs(gameState.aimAngle) > 0.03) {
        const deg = Math.round((gameState.aimAngle * 180) / Math.PI);
        const sign = deg > 0 ? '+' : '';
        ctx.save();
        ctx.fillStyle = 'rgba(38, 22, 12, 0.84)';
        ctx.strokeStyle = 'rgba(255, 218, 128, 0.75)';
        ctx.lineWidth = 1.2;
        const pillX = Math.min(JAR.right - 56, Math.max(JAR.left + 4, gameState.dropX + curR + 8));
        UI.roundRectPath(ctx, pillX, JAR.dropY - 10, 48, 18, 9);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffe599';
        ctx.font = UI.fontStr(11, 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`↻ ${sign}${deg}°`, pillX + 24, JAR.dropY - 1);
        ctx.restore();
      }
    }
  }

  // 4.5 Trails
  for (const e of gameState.entities) {
    if (!e.trail || e.trail.length < 2) continue;
    ctx.save();
    const baseCol = e.isYarnBall
      ? '#ffa8c4'
      : e.isWildcard
      ? '#ff9fd6'
      : e.isGolden
      ? '#ffe26a'
      : TIERS[e.tier - 1].crumbColor;
    for (let i = 0; i < e.trail.length; i++) {
      const pt = e.trail[i];
      const frac = (i + 1) / e.trail.length;
      ctx.globalAlpha = frac * 0.24;
      ctx.fillStyle = baseCol;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, e.r * (0.42 + frac * 0.44), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4.8 Magnet Links
  drawMagnetLinks(ctx, gameState.magnetLinks, nowSec);

  // 5. Contact shadows + Physics Entities
  ctx.save();
  ctx.fillStyle = 'rgba(24, 12, 6, 0.22)';
  for (const e of gameState.entities) {
    UI.fillEllipse(ctx, e.x + 2, e.y + e.r * 0.14, e.r * 0.94, e.r * 0.88);
    ctx.fill();
  }
  ctx.restore();

  const [lr, lg, lb] = theme.lockColor;
  for (const e of gameState.entities) {
    const isHovered = gameState.activeToolMode && gameState.hoveredEntityId === e.id;
    const validTarget =
      isHovered &&
      !e.isYarnBall &&
      ((gameState.activeToolMode === 'fork' && !e.isWildcard && e.tier <= 4) ||
        (gameState.activeToolMode === 'spoon' && !e.isWildcard && e.tier < 9));

    if (e.isYarnBall) {
      drawYarnBallEntity(ctx, sprites.yarnBall, e, nowSec);
    } else if (e.isWildcard) {
      UI.drawRainbowWildcard(ctx, e.x, e.y, e.r, e.angle, nowSec, 1);
    } else {
      if (e.isGolden) UI.drawGoldenAura(ctx, e.x, e.y, e.r, nowSec, 1);
      drawTierSprite(ctx, sprites, e.tier, e.x, e.y, e.r, e.angle, e.squishAmt, e.squishAngle, 1, e.anim);
      if (e.isGolden) {
        ctx.save();
        const ga = nowSec * 2.5 + e.id;
        ctx.fillStyle = '#fff5b0';
        UI.drawStar(ctx, e.x + Math.cos(ga) * e.r * 0.88, e.y + Math.sin(ga) * e.r * 0.88, 4.2, nowSec * 5);
        ctx.restore();
      }
    }

    if (lockedTarget && lockedTarget.id === e.id) {
      ctx.save();
      const pulse = 0.65 + 0.35 * Math.sin(nowSec * 10);
      ctx.strokeStyle = gameState.curMeta.wildcard ? `rgba(255, 168, 224, ${pulse})` : `rgba(${lr}, ${lg}, ${lb}, ${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 5 + Math.sin(nowSec * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (validTarget) {
      drawEntityWorldPolys(ctx, e, gameState.activeToolMode === 'fork' ? '#91f2ff' : '#ffe169', 3.2);
    } else if (isHovered && (e.isYarnBall || (gameState.activeToolMode === 'fork' && (e.tier > 4 || e.isWildcard)))) {
      drawEntityWorldPolys(ctx, e, 'rgba(255, 100, 90, 0.82)', 2.4);
    }
  }

  for (const e of gameState.entities) {
    if (e.anim && !e.isWildcard && !e.isYarnBall) {
      drawDessertActionFX(ctx, e.x, e.y, e.r, e.tier, e.anim);
    }
  }

  // Shockwaves
  for (const sw of gameState.shockwaves) {
    const p = 1 - sw.life / sw.maxLife;
    const alpha = Math.max(0, (1 - p) * 0.85);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = sw.color;
    ctx.lineWidth = Math.max(1, sw.lineWidth * (1 - p * 0.65));
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (gameState.debugPhysics) {
    drawPhysicsDebugOverlay(ctx, gameState);
  }

  // Particles
  for (const p of gameState.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.save();
    ctx.globalAlpha = p.crumb ? alpha * 0.92 : alpha;
    ctx.fillStyle = p.color;
    if (p.star) {
      UI.drawStar(ctx, p.x, p.y, p.size * 1.4, p.life * 6);
    } else if (p.crumb) {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 10);
      UI.roundRectPath(ctx, -p.size, -p.size * 0.72, p.size * 2, p.size * 1.44, p.size * 0.5);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 7. Glass Jar Specular Highlights & Themed Collar
  ctx.save();
  traceJarInnerPath(ctx);
  ctx.lineWidth = 9 + (gameState.jarFlash > 0 ? gameState.jarFlash * 6 : 0);
  ctx.strokeStyle =
    gameState.jarFlash > 0.05
      ? `rgba(255, 238, 146, ${0.45 + gameState.jarFlash * 0.5})`
      : isFever
      ? 'rgba(255, 215, 92, 0.62)'
      : isChime
      ? `rgba(255, 214, 96, ${0.46 + 0.24 * Math.sin(nowSec * 6)})`
      : theme.rimGlow;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  traceJarInnerPath(ctx);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(JAR.left + 12, JAR.neckY + 28);
  ctx.quadraticCurveTo(JAR.left + 10, 310, JAR.left + 32, JAR.floorY - 46);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(JAR.right - 12, JAR.neckY + 34);
  ctx.quadraticCurveTo(JAR.right - 10, 310, JAR.right - 34, JAR.floorY - 50);
  ctx.strokeStyle = 'rgba(255, 244, 214, 0.26)';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(JAR.left + 92, JAR.floorY - 12);
  ctx.quadraticCurveTo(JAR.canvasW / 2, JAR.floorY + 1, JAR.right - 92, JAR.floorY - 12);
  ctx.strokeStyle = 'rgba(255, 248, 224, 0.34)';
  ctx.lineWidth = 4.5;
  ctx.stroke();

  const collarGrad = ctx.createLinearGradient(JAR.left - 8, JAR.neckY - 14, JAR.left - 8, JAR.neckY + 10);
  collarGrad.addColorStop(0, theme.collar[0]);
  collarGrad.addColorStop(0.5, theme.collar[1]);
  collarGrad.addColorStop(1, theme.collar[2]);
  ctx.fillStyle = collarGrad;
  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = 3;
  UI.roundRectPath(ctx, JAR.left - 10, JAR.neckY - 11, JAR.right - JAR.left + 20, 20, 10);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(JAR.left + 6, JAR.neckY - 6);
  ctx.lineTo(JAR.right - 6, JAR.neckY - 6);
  ctx.strokeStyle = theme.collarHighlight;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 8. Floating Popups
  for (const pop of gameState.popups) {
    const alpha = Math.min(1, (pop.life / pop.maxLife) * 1.4);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = UI.fontStr(pop.fontSize, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3c2118';
    ctx.strokeText(pop.text, pop.x, pop.y);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x, pop.y);
    ctx.restore();
  }

  // 9. Animated Combo / Event Celebration Banner
  if (gameState.comboBanner && gameState.comboBanner.life > 0) {
    const cb = gameState.comboBanner;
    const elapsed = cb.maxLife - cb.life;
    const popIn = elapsed < 0.16 ? 0.65 + 0.48 * Math.sin((elapsed / 0.16) * (Math.PI * 0.65)) : 1.0;
    const fadeOut = cb.life < 0.28 ? cb.life / 0.28 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, fadeOut));
    ctx.translate(JAR.canvasW * 0.5, 140 - elapsed * 10);
    ctx.scale(popIn, popIn);
    ctx.font = UI.fontStr(22, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3c2118';
    ctx.strokeText(cb.text, 0, 0);
    ctx.fillStyle = cb.color;
    ctx.fillText(cb.text, 0, 0);
    if (cb.sub) {
      ctx.font = UI.fontStr(12.5, 800);
      ctx.lineWidth = 3.5;
      ctx.strokeText(cb.sub, 0, 20);
      ctx.fillStyle = '#fff5cf';
      ctx.fillText(cb.sub, 0, 20);
    }
    ctx.restore();
  }

  ctx.restore();
}

module.exports = {
  renderJarStage,
  predictLandingY
};
