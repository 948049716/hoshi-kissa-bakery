/**
 * Starlight Glass Jar & Physics World Canvas 2D Renderer
 * Renders the 440x520 logical chamber with exact Center-of-Mass sprite registration,
 * themed glass materials, lock-on aim guide, magnet tethers, Yarn Ball, and juicy FX.
 */
'use strict';

const { TIERS, WILDCARD_RADIUS, JAR, SOLO_EMOTES, SHIFT_HAZARDS } = require('./constants');
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

  if (!img || !img.width || !img.height) {
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
  if (yarnBallImg && yarnBallImg.width > 0 && yarnBallImg.height > 0 && shapeDef) {
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

function drawDividerObstacle(ctx, ob) {
  const hw = typeof ob.halfW === 'number' ? ob.halfW : (ob.w || 14) * 0.5;
  const topY = typeof ob.topY === 'number' ? ob.topY : 337;
  const capY = typeof ob.capY === 'number' ? ob.capY : topY + hw;
  const bottomY = typeof ob.bottomY === 'number' ? ob.bottomY : JAR.floorY;
  const flash = ob.hitFlash > 0 ? Math.min(1, ob.hitFlash / 0.32) : 0;

  ctx.save();
  // 1. Floor contact shadow
  ctx.fillStyle = 'rgba(38, 18, 6, 0.38)';
  UI.fillEllipse(ctx, ob.x, bottomY - 1, hw + 11, 5);
  ctx.fill();

  const tracePillar = () => {
    ctx.beginPath();
    ctx.moveTo(ob.x - hw, bottomY);
    ctx.lineTo(ob.x - hw, capY);
    ctx.arc(ob.x, capY, hw, Math.PI, Math.PI * 2, false);
    ctx.lineTo(ob.x + hw, bottomY);
    ctx.closePath();
  };

  // 2. Cylindrical beveled kissa wood fill
  tracePillar();
  const woodGrad = ctx.createLinearGradient(ob.x - hw, 0, ob.x + hw, 0);
  woodGrad.addColorStop(0, '#73421e');
  woodGrad.addColorStop(0.26, '#c98c50');
  woodGrad.addColorStop(0.56, '#9e6231');
  woodGrad.addColorStop(0.85, '#76441e');
  woodGrad.addColorStop(1, '#593014');
  ctx.fillStyle = woodGrad;
  ctx.fill();

  // 3. Clipped subtle vertical wood grain & warm bevel specular
  ctx.save();
  tracePillar();
  ctx.clip();
  ctx.strokeStyle = 'rgba(64, 32, 14, 0.24)';
  ctx.lineWidth = 1.0;
  for (let gx = -3; gx <= 4; gx += 3.5) {
    ctx.beginPath();
    ctx.moveTo(ob.x + gx, topY + 2);
    ctx.bezierCurveTo(
      ob.x + gx - 1.2,
      topY + 48,
      ob.x + gx + 1.2,
      bottomY - 52,
      ob.x + gx - 0.5,
      bottomY
    );
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 224, 170, 0.20)';
  ctx.beginPath();
  ctx.moveTo(ob.x - hw + 3.2, capY + 2);
  ctx.lineTo(ob.x - hw + 3.2, bottomY - 6);
  ctx.stroke();

  // Left specular highlight stripe
  ctx.fillStyle = 'rgba(255, 232, 184, 0.36)';
  ctx.fillRect(ob.x - hw + 1.5, capY - 2, 2.2, bottomY - capY);

  if (flash > 0.02) {
    ctx.fillStyle = `rgba(255, 236, 172, ${flash * 0.45})`;
    ctx.fillRect(ob.x - hw, topY, hw * 2, bottomY - topY);
  }
  ctx.restore();

  // 4. Outer kissa espresso contour
  tracePillar();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = flash > 0.12 ? '#78461c' : '#4A2C2A';
  ctx.stroke();

  // 5. Brass footplate collar at jar floor
  const plateGrad = ctx.createLinearGradient(ob.x - hw - 2, bottomY - 8, ob.x + hw + 2, bottomY);
  plateGrad.addColorStop(0, '#ffe495');
  plateGrad.addColorStop(0.5, '#d99e36');
  plateGrad.addColorStop(1, '#a96d1e');
  ctx.fillStyle = plateGrad;
  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = 1.8;
  UI.roundRectPath(ctx, ob.x - hw - 2, bottomY - 8, hw * 2 + 4, 8, 3);
  ctx.fill();
  ctx.stroke();

  // 6. Top brass decorative rivet
  const rivetGrad = ctx.createRadialGradient(ob.x - 0.8, capY + 6.2, 0.4, ob.x, capY + 7, 2.6);
  rivetGrad.addColorStop(0, '#fff2ba');
  rivetGrad.addColorStop(0.65, '#dfa438');
  rivetGrad.addColorStop(1, '#945d14');
  ctx.fillStyle = rivetGrad;
  ctx.beginPath();
  ctx.arc(ob.x, capY + 7, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();
  ctx.restore();
}

function drawBumperObstacle(ctx, ob, oi, nowSec) {
  const source = ob.source || 'relic';
  const isSynergy = source === 'synergy';
  const isRelic = source === 'relic';
  const flash = ob.hitFlash > 0 ? Math.min(1, ob.hitFlash / 0.36) : 0;
  const sc = 1 + flash * 0.24;

  ctx.save();
  ctx.translate(ob.x, ob.y);
  ctx.scale(sc, sc);

  // Outer glow ring(s)
  if (isSynergy) {
    const pulse = 0.5 + 0.5 * Math.sin(nowSec * 6.5 + oi);
    ctx.fillStyle = `rgba(255, 212, 86, ${0.24 + pulse * 0.14 + flash * 0.32})`;
    ctx.beginPath();
    ctx.arc(0, 0, ob.r + 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 240, 152, ${0.34 + flash * 0.36})`;
    ctx.beginPath();
    ctx.arc(0, 0, ob.r + 5.0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = flash > 0.05 ? `rgba(255, 232, 120, ${0.45 + flash * 0.4})` : 'rgba(255, 216, 112, 0.24)';
    ctx.beginPath();
    ctx.arc(0, 0, ob.r + 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dashed crit ring for relic & synergy bumpers
  if (isRelic || isSynergy) {
    ctx.save();
    ctx.rotate(nowSec * (isSynergy ? 2.4 : 1.5) * (oi % 2 === 0 ? 1 : -1));
    ctx.strokeStyle = isSynergy ? '#fff099' : 'rgba(255, 232, 110, 0.72)';
    ctx.lineWidth = isSynergy ? 2.0 : 1.5;
    ctx.setLineDash(isSynergy ? [5, 3.5] : [4, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, ob.r + (isSynergy ? 5.8 : 4.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Main glossy butter-caramel dome
  const bg = ctx.createRadialGradient(-4, -5, 2, 0, 0, ob.r);
  if (isSynergy) {
    bg.addColorStop(0, '#fffee8');
    bg.addColorStop(0.55, '#ffcf4d');
    bg.addColorStop(1, '#c45c10');
  } else {
    bg.addColorStop(0, '#fffce0');
    bg.addColorStop(0.6, '#ffd262');
    bg.addColorStop(1, '#c9781b');
  }
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(0, 0, ob.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = isSynergy ? 2.6 : 2.4;
  ctx.strokeStyle = flash > 0.1 ? '#fff7c4' : '#4A2C2A';
  ctx.stroke();

  // Inner spinning star emblem
  ctx.fillStyle = isSynergy ? '#ffffff' : '#fff7d4';
  UI.drawStar(ctx, 0, 0, ob.r * (isSynergy ? 0.52 : 0.48), nowSec * (isSynergy ? 2.4 : 1.6) + oi);

  // Orbiting micro-stars for supercharged synergy bumpers
  if (isSynergy) {
    for (let k = 0; k < 2; k++) {
      const a = nowSec * 2.8 + oi * 1.4 + k * Math.PI;
      ctx.fillStyle = '#fff5b8';
      UI.drawStar(ctx, Math.cos(a) * (ob.r + 6.5), Math.sin(a) * (ob.r + 6.5), 3.4, nowSec * 5 + k);
    }
  }
  ctx.restore();
}

function drawGlazeRingLayer(ctx, ob, layer, nowSec, isAimHit) {
  const rx = ob.rx || 38;
  const ry = ob.ry || 13;
  const flash = ob.hitFlash > 0 ? Math.min(1, ob.hitFlash / 0.45) : 0;
  const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5.2);

  ctx.save();
  ctx.translate(ob.x, ob.y);

  const strokeHalfEllipse = (startA, endA) => {
    ctx.save();
    ctx.scale(1, ry / rx);
    // 1. Dark kissa contour
    ctx.beginPath();
    ctx.arc(0, 0, rx, startA, endA, false);
    ctx.strokeStyle = '#4A2C2A';
    ctx.lineWidth = 7.4;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Metallic caramel gold rim
    const rimGrad = ctx.createLinearGradient(-rx, -rx, rx, rx);
    rimGrad.addColorStop(0, '#fff5bf');
    rimGrad.addColorStop(0.48, '#f5b436');
    rimGrad.addColorStop(1, '#b06212');
    ctx.beginPath();
    ctx.arc(0, 0, rx, startA, endA, false);
    ctx.strokeStyle = rimGrad;
    ctx.lineWidth = 4.6;
    ctx.stroke();

    // 3. Inner bright highlight sheen
    ctx.beginPath();
    ctx.arc(0, 0, rx, startA, endA, false);
    ctx.strokeStyle = flash > 0.08 ? 'rgba(255, 255, 240, 0.96)' : 'rgba(255, 252, 232, 0.82)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  };

  if (layer === 'back') {
    // Soft caramel outer halo glow
    ctx.save();
    ctx.scale(1, 0.56);
    const glowR = rx + 18 + flash * 10 + (isAimHit ? 5 : 0);
    const glowGrad = ctx.createRadialGradient(0, 0, rx * 0.25, 0, 0, glowR);
    glowGrad.addColorStop(0, `rgba(255, 224, 108, ${0.32 + flash * 0.34 + (isAimHit ? 0.16 : 0)})`);
    glowGrad.addColorStop(0.65, `rgba(255, 182, 52, ${0.12 + flash * 0.18})`);
    glowGrad.addColorStop(1, 'rgba(255, 182, 52, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Translucent golden portal membrane
    UI.fillEllipse(ctx, 0, 0, rx - 3, ry - 2);
    ctx.fillStyle = `rgba(255, 240, 160, ${0.14 + 0.08 * pulse + flash * 0.3 + (isAimHit ? 0.12 : 0)})`;
    ctx.fill();

    // Back rim arc (top half behind falling desserts)
    strokeHalfEllipse(Math.PI, Math.PI * 2);
  } else {
    // Front rim arc (bottom half in front of desserts passing through!)
    strokeHalfEllipse(0, Math.PI);

    // Pulsing outer aim focus halo when player aims through the ring
    if (isAimHit) {
      ctx.save();
      ctx.scale(1, (ry + 3) / (rx + 5));
      ctx.strokeStyle = `rgba(255, 240, 130, ${0.65 + 0.35 * pulse})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, rx + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 3 orbiting 4-point caramel sparkle stars
    for (let k = 0; k < 3; k++) {
      const a = nowSec * 1.9 + (k * Math.PI * 2) / 3;
      const sx = Math.cos(a) * rx;
      const sy = Math.sin(a) * ry;
      ctx.fillStyle = k === 0 ? '#fff8cc' : '#ffe066';
      UI.drawStar(ctx, sx, sy, 3.8 + (isAimHit ? 1.1 : 0), nowSec * 4.5 + k);
    }
  }

  ctx.restore();
}

function drawFrozenShell(ctx, e, nowSec) {
  const r = e.r;
  const shimmer = 0.5 + 0.5 * Math.sin(nowSec * 3.2 + e.id);

  ctx.save();
  ctx.translate(e.x, e.y);

  // 1. Outer frost mist radial glow
  const mistGrad = ctx.createRadialGradient(0, 0, r * 0.55, 0, 0, r * 1.24);
  mistGrad.addColorStop(0, 'rgba(195, 244, 255, 0.34)');
  mistGrad.addColorStop(0.65, 'rgba(116, 206, 248, 0.14)');
  mistGrad.addColorStop(1, 'rgba(116, 206, 248, 0)');
  ctx.fillStyle = mistGrad;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.24, 0, Math.PI * 2);
  ctx.fill();

  // 2. Faceted octagonal crystal shell (translucent so pastry inside remains 100% readable!)
  ctx.save();
  ctx.rotate(e.angle);
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const rad = k % 2 === 0 ? r * 1.09 : r * 1.02;
    pts.push({ x: Math.cos(a) * rad, y: Math.sin(a) * rad });
  }
  const traceCrystal = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.closePath();
  };

  traceCrystal();
  const iceGrad = ctx.createLinearGradient(-r, -r, r, r);
  iceGrad.addColorStop(0, 'rgba(232, 252, 255, 0.44)');
  iceGrad.addColorStop(0.5, 'rgba(148, 222, 252, 0.24)');
  iceGrad.addColorStop(1, 'rgba(74, 158, 224, 0.36)');
  ctx.fillStyle = iceGrad;
  ctx.fill();

  // 3. Internal specular & shadow facet triangles
  ctx.fillStyle = `rgba(255, 255, 255, ${0.32 + shimmer * 0.12})`;
  ctx.beginPath();
  ctx.moveTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[6].x, pts[6].y);
  ctx.lineTo(-r * 0.12, -r * 0.18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
  ctx.beginPath();
  ctx.moveTo(pts[6].x, pts[6].y);
  ctx.lineTo(pts[7].x, pts[7].y);
  ctx.lineTo(r * 0.22, -r * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(42, 112, 184, 0.18)';
  ctx.beginPath();
  ctx.moveTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(r * 0.18, r * 0.26);
  ctx.closePath();
  ctx.fill();

  // Frost-edge seams
  ctx.strokeStyle = 'rgba(224, 248, 255, 0.68)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(pts[5].x * 0.92, pts[5].y * 0.92);
  ctx.lineTo(-r * 0.12, -r * 0.18);
  ctx.lineTo(pts[7].x * 0.92, pts[7].y * 0.92);
  ctx.stroke();

  // Double crystal rim stroke
  traceCrystal();
  ctx.strokeStyle = '#2b557a';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  traceCrystal();
  ctx.strokeStyle = '#d8f8ff';
  ctx.lineWidth = 1.35;
  ctx.stroke();
  ctx.restore();

  // 4. Top-right glacier lock medallion with procedural 6-spoke vector snowflake
  const bx = r * 0.54;
  const by = -r * 0.62;
  ctx.fillStyle = 'rgba(24, 76, 124, 0.92)';
  ctx.beginPath();
  ctx.arc(bx, by, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#b8f0ff';
  ctx.stroke();

  ctx.save();
  ctx.translate(bx, by);
  ctx.strokeStyle = '#eefcff';
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  const arm = 5.4;
  for (let s = 0; s < 3; s++) {
    const a = (s * Math.PI) / 3;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(-ca * arm, -sa * arm);
    ctx.lineTo(ca * arm, sa * arm);
    ctx.stroke();
    // Small V-barbs near both tips
    for (const dir of [-1, 1]) {
      const tipX = dir * ca * (arm * 0.62);
      const tipY = dir * sa * (arm * 0.62);
      const b1 = a + (dir > 0 ? 2.45 : -0.69);
      const b2 = a + (dir > 0 ? -2.45 : 0.69);
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + Math.cos(b1) * 2.1, tipY + Math.sin(b1) * 2.1);
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + Math.cos(b2) * 2.1, tipY + Math.sin(b2) * 2.1);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.restore();
}

function drawInJarHazardBadges(ctx, gameState, nowSec) {
  if (gameState.mode !== 'chef') return;
  const hazards = Array.isArray(gameState.shiftHazards) ? gameState.shiftHazards : [];
  let frozenAlive = 0;
  for (let i = 0; i < gameState.entities.length; i++) {
    const e = gameState.entities[i];
    if (e && !e.merged && e.frozenHp > 0) frozenAlive++;
  }
  const isGrandPrix = gameState.shiftModifier === 'grand_prix';
  if (hazards.length === 0 && frozenAlive === 0 && !isGrandPrix) return;

  const baseY = JAR.dangerY + 5; // y = 117..135 (strictly below dangerY=112, 36px above glaze_ring)
  const pillH = 18;
  const drawPill = (x, y, w, bg, border, text, textCol) => {
    ctx.save();
    UI.roundRectPath(ctx, x, y, w, pillH, 9);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = border;
    ctx.stroke();
    UI.drawFitText(ctx, text, x + w * 0.5, y + pillH * 0.5 + 0.5, w - 10, 9.5, 7.8, 800, textCol, 'center');
    ctx.restore();
  };

  // Left wall pills: active shift hazards (width 72px, leaving center 108..332 = 224px 100% open)
  let ly = baseY;
  for (let i = 0; i < hazards.length; i++) {
    const def = SHIFT_HAZARDS[hazards[i]];
    if (!def) continue;
    const borderCol =
      def.id === 'fast_fresh'
        ? '#ff9d7a'
        : def.id === 'divider'
        ? '#e5b078'
        : '#ffe07a';
    drawPill(JAR.left + 6, ly, 72, 'rgba(42, 22, 12, 0.84)', borderCol, def.badge, '#fff4d4');
    ly += pillH + 3;
  }

  // Right wall pills: live frozen count & Boss Critic Rush indicator
  let ry = baseY;
  if (frozenAlive > 0) {
    drawPill(JAR.right - 6 - 72, ry, 72, 'rgba(18, 56, 92, 0.88)', '#9ce6ff', `❄️冰封×${frozenAlive}`, '#e6f9ff');
    ry += pillH + 3;
  }
  if (isGrandPrix) {
    const activeJudge = (gameState.orders || []).some((o) => o && !o.completed && o.isJudgeRush);
    const stepsUsed = gameState.shiftStepsUsed || 0;
    const stepsToNext = 6 - (stepsUsed % 6);
    const pulse = activeJudge ? 0.5 + 0.5 * Math.sin(nowSec * 7) : 0;
    const bg = activeJudge
      ? `rgba(${Math.round(148 + pulse * 36)}, 48, 16, 0.90)`
      : 'rgba(54, 28, 14, 0.84)';
    const label = activeJudge ? '🏅评委急单!' : `🏅${stepsToNext}步急单`;
    drawPill(JAR.right - 6 - 72, ry, 72, bg, '#ffe078', label, '#fff6d0');
  }
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

  // Render obstacle collision bounds (divider SAT polygon, bumpers, glaze ring)
  if (gameState.obstacles && gameState.obstacles.length > 0) {
    for (let oi = 0; oi < gameState.obstacles.length; oi++) {
      const ob = gameState.obstacles[oi];
      if (!ob) continue;
      if (ob.type === 'divider' && Physics.ensureDividerStaticBody) {
        const divBody = Physics.ensureDividerStaticBody(ob);
        const verts = divBody.worldPolys[0].verts;
        ctx.beginPath();
        for (let k = 0; k < verts.length; k++) {
          if (k === 0) ctx.moveTo(verts[k].x, verts[k].y);
          else ctx.lineTo(verts[k].x, verts[k].y);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 196, 92, 0.18)';
        ctx.fill();
        ctx.strokeStyle = '#ffcf66';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      } else if (ob.type === 'bumper') {
        ctx.beginPath();
        ctx.arc(ob.x, ob.y, ob.r, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd86b';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (ob.type === 'glaze_ring') {
        ctx.save();
        ctx.translate(ob.x, ob.y);
        ctx.scale(1, (ob.ry || 13) / (ob.rx || 38));
        ctx.beginPath();
        ctx.arc(0, 0, ob.rx || 38, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffe570';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

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

function predictLandingY(tier, dropX, angle, entities, isWildcard = false, obstacles = []) {
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
    entities,
    obstacles
  );
  return Math.max(JAR.dropY + 20, hitY);
}

function findAimMergeTarget(gameState, tier, dropX, landY, isWildcard, magnetLv) {
  const curR = isWildcard ? WILDCARD_RADIUS : TIERS[tier - 1].radius;
  const lockPad = 5 + magnetLv * 8 + (gameState.feverTimer > 0 ? 14 : 0);
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < gameState.entities.length; i++) {
    const e = gameState.entities[i];
    if (e.merged || e.isYarnBall || e.frozenHp > 0) continue;
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
  const isAntiGrav = gameState.antigravTimer > 0;
  traceJarInnerPath(ctx);
  ctx.closePath();
  const bgGrad = ctx.createLinearGradient(0, JAR.neckY, 0, JAR.floorY);
  if (isAntiGrav) {
    const shimmer = 0.5 + 0.5 * Math.sin(nowSec * 6.5);
    bgGrad.addColorStop(0, `rgba(182, 134, 255, ${0.28 + shimmer * 0.1})`);
    bgGrad.addColorStop(0.5, `rgba(104, 72, 188, ${0.22 + (1 - shimmer) * 0.08})`);
    bgGrad.addColorStop(1, `rgba(148, 212, 255, ${0.18 + shimmer * 0.08})`);
  } else if (isFever) {
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

  // Internal glass motes (drift rapidly upward in Anti-Gravity mode!)
  const moteCount = isAntiGrav ? 14 : isFever ? 12 : theme.id === 'amber' ? 6 : 9;
  const spanY = JAR.floorY - JAR.neckY;
  for (let m = 0; m < moteCount; m++) {
    const mx = JAR.left + 22 + ((m * 47 + Math.sin(nowSec * (isFever || isAntiGrav ? 1.6 : 0.8) + m) * 20) % (JAR.right - JAR.left - 44));
    if (isAntiGrav) {
      const my = JAR.floorY - (((nowSec * 120 + m * 53) % spanY));
      ctx.fillStyle = m % 2 === 0 ? 'rgba(222, 184, 255, 0.65)' : 'rgba(164, 232, 255, 0.52)';
      UI.drawStar(ctx, mx, my, 3.2 + (m % 3) * 0.9, nowSec * 4.5 + m);
    } else if (theme.moteKind === 'petal' && !isFever) {
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

  const isActivelyAiming = !!(
    (gameState.aim && gameState.aim.active && !gameState.aim.cancelled) ||
    (gameState.touchAim && gameState.touchAim.active && !gameState.touchAim.cancelled)
  );

  // Active Anti-Gravity Pill (fades while aiming)
  if (gameState.running && !gameState.over && isAntiGrav) {
    const pillY = JAR.neckY + (gameState.serveCascadeTimer > 0 ? 40 : 18);
    ctx.save();
    if (isActivelyAiming) ctx.globalAlpha = 0.34;
    UI.roundRectPath(ctx, JAR.canvasW * 0.5 - 86, pillY - 10, 172, 20, 10);
    ctx.fillStyle = 'rgba(62, 26, 108, 0.9)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#dfb8ff';
    ctx.stroke();
    ctx.fillStyle = '#f2e0ff';
    ctx.font = UI.fontStr(10.5, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🛸 月光反重力 ×2.2 (${gameState.antigravTimer.toFixed(1)}s)`, JAR.canvasW * 0.5, pillY + 0.5);
    ctx.restore();
  }

  // Active Serve Cascade Avalanche Timer Pill (auto-fades while aiming so protractor stays clear)
  if (gameState.running && !gameState.over && gameState.serveCascadeTimer > 0) {
    const pillY = JAR.neckY + 18;
    const cascadeTxt =
      gameState.serveCascadeMerges > 0
        ? `抽底雪崩 ×${gameState.serveCascadeMerges} (${gameState.serveCascadeTimer.toFixed(1)}s)`
        : `抽底雪崩窗 ${gameState.serveCascadeTimer.toFixed(1)}s`;
    ctx.save();
    if (isActivelyAiming) ctx.globalAlpha = 0.34;
    UI.drawNoticeBanner(ctx, JAR.canvasW * 0.5 - 82, pillY - 10, 164, 21, {
      icon: 'serve_bell',
      sprites,
      iconSize: 15,
      text: cascadeTxt,
      fontSize: 10,
      borderColor: '#ffd872',
      rightReserve: 10
    });
    ctx.restore();
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

  // 3.4 Pre-compute aim trajectory once so glaze_ring back/front layers & aim line stay in sync
  let lockedTarget = null;
  const isTargetingMode = !!(gameState.activeToolMode || gameState.activeSkillMode);
  const canDropStep = gameState.mode !== 'chef' || gameState.stepsLeft > 0;
  const canAim = !!(gameState.running && !gameState.over && !isTargetingMode && canDropStep);
  let aimCtxData = null;
  let aimGlazeInfo = null;

  const launchX = JAR.canvasW * 0.5;
  const launchY = JAR.dropY + 4;

  if (canAim) {
    const curMeta = gameState.curMeta || { wildcard: false, golden: false };
    const curIsWild = !!curMeta.wildcard;
    const curIsGold = !curIsWild && !!curMeta.golden;
    const curTierDef = TIERS[gameState.curTier - 1];
    const curR = curIsWild ? WILDCARD_RADIUS : curTierDef.radius;
    const curShape = curIsWild ? getShapeDef(1) : getShapeDef(gameState.curTier);
    const aimAngle = Math.max(-1.14, Math.min(1.14, gameState.aimAngle || 0));
    const hasBouncy = Array.isArray(gameState.relics) && gameState.relics.includes('rel_bouncy');
    const hasPrism = Array.isArray(gameState.relics) && gameState.relics.includes('rel_prism');
    const constSpeed = 920 * (hasBouncy ? 1.25 : 1.0);
    const aim = gameState.aim || {
      active: false,
      mode: 'sling',
      cancelled: false,
      power: 0.72,
      launchVx: Math.sin(aimAngle) * constSpeed,
      launchVy: Math.cos(aimAngle) * constSpeed
    };
    const isAimCancelled = !!(aim.cancelled || (gameState.touchAim.active && gameState.touchAim.cancelled));
    const isTouchAiming = !!((aim.active || gameState.touchAim.active) && !isAimCancelled);

    const vx0 = typeof aim.launchVx === 'number' && (aim.launchVx !== 0 || aim.launchVy !== 0)
      ? aim.launchVx
      : Math.sin(aimAngle) * constSpeed;
    const vy0 = typeof aim.launchVy === 'number' && (aim.launchVx !== 0 || aim.launchVy !== 0)
      ? aim.launchVy
      : Math.cos(aimAngle) * constSpeed;

    const gScale = curIsWild ? 1.0 : (curTierDef.material && curTierDef.material.gravityScale) || 1.0;
    const traj = Physics.predictBankShotTrajectory(
      curR,
      launchX,
      launchY,
      vx0,
      vy0,
      JAR,
      gameState.entities,
      1880,
      gScale,
      gameState.curTier,
      {
        wallRestBonus: hasBouncy ? 0.25 : 0,
        maxBounces: hasBouncy ? 2 : 1,
        obstacles: gameState.obstacles
      }
    );
    if (!curIsWild && !curIsGold && !isAimCancelled && traj.glazeHit && traj.glazeHit.ring) {
      aimGlazeInfo = {
        hit: true,
        x: traj.glazeHit.x,
        y: traj.glazeHit.y,
        ringId: traj.glazeHit.ring.id
      };
    }

    aimCtxData = {
      curMeta,
      curIsWild,
      curIsGold,
      curTierDef,
      curR,
      curShape,
      aimAngle,
      aim,
      isAimCancelled,
      isTouchAiming,
      hasBouncy,
      hasPrism,
      traj
    };
  }

  // 3.5 Static & Back-Layer Jar Obstacles (Glaze Ring back half, Wood Divider, Butter Bumpers)
  if (gameState.obstacles && gameState.obstacles.length > 0) {
    for (let oi = 0; oi < gameState.obstacles.length; oi++) {
      const ob = gameState.obstacles[oi];
      if (!ob) continue;
      if (ob.type === 'glaze_ring') {
        drawGlazeRingLayer(ctx, ob, 'back', nowSec, !!(aimGlazeInfo && aimGlazeInfo.ringId === ob.id));
      } else if (ob.type === 'divider') {
        drawDividerObstacle(ctx, ob);
      } else if (ob.type === 'bumper') {
        drawBumperObstacle(ctx, ob, oi, nowSec);
      }
    }
  }

  // 4. Fixed-Center Angle Turret & Trajectory Guide
  if (aimCtxData) {
    const {
      curIsWild,
      curIsGold,
      curR,
      curShape,
      aimAngle,
      isAimCancelled,
      isTouchAiming,
      hasBouncy,
      hasPrism,
      traj
    } = aimCtxData;
    const [lr, lg, lb] = theme.lockColor;
    const willGlaze = !!(aimGlazeInfo && aimGlazeInfo.hit);

    if (traj && !isAimCancelled) {
      if (traj.hitBody && !traj.hitBody.isYarnBall && !(traj.hitBody.frozenHp > 0)) {
        if (curIsWild || traj.hitBody.isWildcard || traj.hitBody.tier === gameState.curTier) {
          lockedTarget = traj.hitBody;
        }
      }
      if (!lockedTarget) {
        lockedTarget = findAimMergeTarget(gameState, gameState.curTier, traj.endX, traj.endY, curIsWild, effectiveMagnetLv);
      }

      const bPoints = traj.bouncePoints || (traj.bouncePoint ? [traj.bouncePoint] : []);
      const hasBounce = bPoints.length > 0;

      ctx.save();
      // Starry brass protractor dial arc + crisp constant-speed degree ticks around fixed center launcher
      const dialR = Math.max(36, curR + 14);
      ctx.strokeStyle = isTouchAiming ? 'rgba(255, 236, 178, 0.56)' : 'rgba(255, 236, 178, 0.25)';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(launchX, launchY, dialR, Math.PI * 0.5 - 1.14, Math.PI * 0.5 + 1.14);
      ctx.stroke();
      ctx.setLineDash([]);

      const tickSteps = [-4, -3, -2, -1, 0, 1, 2, 3, 4]; // every ~14.3° (0.25 rad)
      for (let ti = 0; ti < tickSteps.length; ti++) {
        const aVal = tickSteps[ti] * 0.25;
        const dir = Math.PI * 0.5 - aVal;
        const isMajorTick = tickSteps[ti] % 2 === 0;
        const rIn = dialR - (isMajorTick ? 4.5 : 2.5);
        const rOut = dialR + (isMajorTick ? 3.5 : 1.8);
        ctx.strokeStyle = isTouchAiming
          ? isMajorTick
            ? 'rgba(255, 240, 172, 0.82)'
            : 'rgba(255, 236, 178, 0.45)'
          : 'rgba(255, 236, 178, 0.28)';
        ctx.lineWidth = isMajorTick ? 1.7 : 1.1;
        ctx.beginPath();
        ctx.moveTo(launchX + Math.cos(dir) * rIn, launchY + Math.sin(dir) * rIn);
        ctx.lineTo(launchX + Math.cos(dir) * rOut, launchY + Math.sin(dir) * rOut);
        ctx.stroke();
      }

      // Active angle indicator tick + live degree readout when aiming
      const pointerDir = Math.PI * 0.5 - aimAngle;
      ctx.fillStyle = hasBounce ? '#9cf4ff' : '#ffe382';
      ctx.beginPath();
      ctx.arc(launchX + Math.cos(pointerDir) * dialR, launchY + Math.sin(pointerDir) * dialR, isTouchAiming ? 4.0 : 2.8, 0, Math.PI * 2);
      ctx.fill();
      if (isTouchAiming) {
        const degVal = Math.round((aimAngle * 180) / Math.PI);
        const degStr = `${degVal > 0 ? '+' : ''}${degVal}°`;
        ctx.font = UI.fontStr(9.5, 900);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(42, 22, 12, 0.85)';
        UI.roundRectPath(ctx, launchX + (aimAngle >= 0 ? -54 : 20), launchY - 8, 34, 16, 8);
        ctx.fill();
        ctx.fillStyle = hasBounce ? '#b8f7ff' : '#ffe89c';
        ctx.fillText(degStr, launchX + (aimAngle >= 0 ? -37 : 37), launchY);
      }

      // Dotted ballistic trajectory path from fixed center turret
      if (traj.points.length >= 2) {
        ctx.beginPath();
        ctx.setLineDash(lockedTarget || hasBounce || willGlaze ? [7, 4] : [6, 6]);
        ctx.moveTo(traj.points[0].x, traj.points[0].y);
        for (let pi = 1; pi < traj.points.length; pi++) {
          ctx.lineTo(traj.points[pi].x, traj.points[pi].y);
        }
        ctx.strokeStyle = lockedTarget
          ? hasBounce
            ? 'rgba(148, 244, 255, 0.96)'
            : willGlaze
            ? 'rgba(255, 226, 96, 0.96)'
            : `rgba(${lr}, ${lg}, ${lb}, 0.94)`
          : hasBounce
          ? 'rgba(148, 238, 255, 0.86)'
          : willGlaze
          ? 'rgba(255, 226, 96, 0.90)'
          : isTouchAiming
          ? theme.guideTouch
          : theme.guideLine;
        ctx.lineWidth = isTouchAiming || hasBounce || willGlaze ? 3.0 : 2.1;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (willGlaze) {
        ctx.fillStyle = '#fff5b8';
        UI.drawStar(ctx, aimGlazeInfo.x, aimGlazeInfo.y, 7.4 + Math.sin(nowSec * 12) * 1.4, nowSec * 5);
      }

      // Highlight reflection stars at glass side-wall bounce points
      for (let bi = 0; bi < bPoints.length; bi++) {
        const bp = bPoints[bi];
        ctx.fillStyle = bi >= 1 ? '#ffe47a' : '#9cf4ff';
        UI.drawStar(ctx, bp.x, bp.y, 7.2 + Math.sin(nowSec * 12 + bi) * 1.4, nowSec * 4);
        ctx.strokeStyle = bi >= 1 ? 'rgba(255, 228, 122, 0.78)' : 'rgba(156, 244, 255, 0.72)';
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, 11.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Landing ghost contour at trajectory end
      const ghostAngle = -aimAngle * 0.35;
      if (traj.endY > launchY + 24) {
        if (curIsWild) {
          UI.drawRainbowWildcard(ctx, traj.endX, traj.endY, curR, ghostAngle, nowSec, isTouchAiming ? 0.38 : 0.28);
        } else {
          drawTierSprite(ctx, sprites, gameState.curTier, traj.endX, traj.endY, curR, ghostAngle, 0, 0, isTouchAiming ? 0.36 : 0.25);
        }
        drawShapePolygons(
          ctx,
          curShape,
          traj.endX,
          traj.endY,
          curR,
          ghostAngle,
          hasBounce
            ? 'rgba(148, 244, 255, 0.94)'
            : willGlaze
            ? 'rgba(255, 224, 88, 0.94)'
            : lockedTarget
            ? `rgba(${lr}, ${lg}, ${lb}, 0.94)`
            : isTouchAiming
            ? theme.guideTouch
            : theme.guideLine,
          lockedTarget || hasBounce || willGlaze ? 2.2 : 1.5,
          hasBounce
            ? 'rgba(148, 244, 255, 0.14)'
            : willGlaze
            ? 'rgba(255, 224, 88, 0.15)'
            : `rgba(${lr}, ${lg}, ${lb}, ${lockedTarget ? 0.15 : 0.06})`,
          [4, 4]
        );
      }

      // Item 5: Visual Trait & Ice-Shatter / Meteor Blast Preview
      if (gameState.nextShotMeteor && traj.endY > launchY + 20) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 134, 62, 0.78)';
        ctx.fillStyle = 'rgba(255, 128, 52, 0.11)';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(traj.endX, traj.endY, 120, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        for (let ei = 0; ei < gameState.entities.length; ei++) {
          const me = gameState.entities[ei];
          if (!me || me.merged) continue;
          if ((me.frozenHp > 0 || me.isYarnBall || me.tier <= 2) && Math.hypot(me.x - traj.endX, me.y - traj.endY) <= 120 + me.r * 0.4) {
            ctx.strokeStyle = 'rgba(255, 178, 92, 0.9)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(me.x, me.y, me.r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      if (lockedTarget) {
        const mx = lockedTarget.x;
        const my = lockedTarget.y;
        const rMult = gameState.traitRadiusMult || 1.0;
        const baseMergeTier = curIsWild
          ? lockedTarget.isWildcard
            ? 2
            : lockedTarget.tier
          : lockedTarget.isWildcard
          ? gameState.curTier
          : gameState.curTier;
        const bornTier = Math.min(9, baseMergeTier + 1);

        ctx.save();
        // Nearby 110px Frozen Shatter Preview
        for (let fi = 0; fi < gameState.entities.length; fi++) {
          const fe = gameState.entities[fi];
          if (!fe || fe.merged || !(fe.frozenHp > 0)) continue;
          if (Math.hypot(fe.x - mx, fe.y - my) <= 110 + fe.r * 0.5) {
            ctx.strokeStyle = 'rgba(154, 242, 255, 0.92)';
            ctx.lineWidth = 2.4;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(mx, my);
            ctx.lineTo(fe.x, fe.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(fe.x, fe.y, fe.r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Born Tier Special Ability Radius & Target Preview
        if (bornTier === 3) {
          const rad = 105 * rMult;
          ctx.strokeStyle = 'rgba(154, 232, 114, 0.72)';
          ctx.fillStyle = 'rgba(154, 232, 114, 0.09)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(mx, my, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (bornTier === 4) {
          const hasLem = Array.isArray(gameState.relics) && gameState.relics.includes('rel_lemonade');
          const rad = (hasLem ? 165 : 105) * rMult;
          const cap = hasLem ? 4 : 2;
          ctx.strokeStyle = 'rgba(255, 232, 92, 0.82)';
          ctx.fillStyle = 'rgba(255, 236, 112, 0.10)';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(mx, my, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          const cands = gameState.entities
            .filter((ce) => ce && !ce.merged && ce.id !== lockedTarget.id && !ce.isWildcard && !ce.isYarnBall && !(ce.frozenHp > 0) && ce.tier <= 2 && Math.hypot(ce.x - mx, ce.y - my) <= rad)
            .sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))
            .slice(0, cap);
          for (let ci = 0; ci < cands.length; ci++) {
            const ce = cands[ci];
            ctx.strokeStyle = '#fff078';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(ce.x, ce.y, ce.r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (bornTier === 5) {
          const rad = 145 * rMult;
          ctx.strokeStyle = 'rgba(255, 156, 202, 0.78)';
          ctx.fillStyle = 'rgba(255, 162, 208, 0.09)';
          ctx.lineWidth = 1.9;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(mx, my, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
          const pullR = rad * (0.72 - ((nowSec * 0.8) % 0.35));
          ctx.strokeStyle = 'rgba(255, 198, 226, 0.68)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(mx, my, pullR, 0, Math.PI * 2);
          ctx.stroke();
        } else if (bornTier === 6) {
          const rad = (TIERS[5].radius + 48) * rMult;
          ctx.strokeStyle = 'rgba(255, 204, 116, 0.82)';
          ctx.lineWidth = 2.2;
          for (let k = 0; k < 3; k++) {
            const sa = nowSec * 4 + (k * Math.PI * 2) / 3;
            ctx.beginPath();
            ctx.arc(mx, my, rad, sa, sa + 0.85);
            ctx.stroke();
          }
        } else if (bornTier === 8) {
          const halfSpan = 95 * rMult;
          const leftX = Math.max(JAR.left + 8, mx - halfSpan);
          const rightX = Math.min(JAR.right - 8, mx + halfSpan);
          ctx.fillStyle = 'rgba(232, 176, 98, 0.12)';
          ctx.strokeStyle = 'rgba(255, 208, 122, 0.78)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 4]);
          UI.roundRectPath(ctx, leftX, my, rightX - leftX, Math.max(24, JAR.floorY - my - 4), 10);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);

          const crushTargets = gameState.entities
            .filter((ce) => ce && !ce.merged && ce.id !== lockedTarget.id && !ce.isWildcard && !ce.isYarnBall && !(ce.frozenHp > 0) && ce.tier <= 2 && ce.y > my - 10 && Math.abs(ce.x - mx) < halfSpan)
            .slice(0, 2);
          for (let ci = 0; ci < crushTargets.length; ci++) {
            const ce = crushTargets[ci];
            ctx.strokeStyle = '#ffd278';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(ce.x, ce.y, ce.r + 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // Unified Storybook Callout Badge for Bank-Shot, Glaze Ring, or Lock-on
      if (lockedTarget || hasBounce || willGlaze) {
        const multLabel = bPoints.length >= 2 && hasBouncy ? '×2.8' : hasPrism ? '×2.0' : '×1.5';
        let tagText;
        if (lockedTarget) {
          const baseT = curIsWild ? (lockedTarget.isWildcard ? 2 : lockedTarget.tier) : gameState.curTier;
          const bornT = Math.min(9, baseT + 1);
          const traitShort =
            bornT === 4
              ? '·消小果'
              : bornT === 5
              ? '·引力聚拢'
              : bornT === 6
              ? '·旋风搅罐'
              : bornT === 8
              ? '·重锤压碎'
              : bornT === 9
              ? '·猫神×2'
              : '';
          if (hasBounce && willGlaze) tagText = '穿环弹壁合成!';
          else if (hasBounce) tagText = `${bPoints.length >= 2 ? '二段弹壁' : '弹壁合成'} ${multLabel}!`;
          else if (willGlaze) tagText = '穿环镀金合成!';
          else if (curIsWild) tagText = '彩虹升阶+1!';
          else if (curIsGold || lockedTarget.isGolden) tagText = '黄金暴击!';
          else tagText = `合T${bornT}${traitShort}!`;
        } else if (hasBounce && willGlaze) {
          tagText = '弹壁 + 镀金!';
        } else if (willGlaze) {
          tagText = '穿环镀金!';
        } else {
          tagText = bPoints.length >= 2 ? '二段折射' : '弹壁折射';
        }
        const tagW = Math.max(76, tagText.length * 8.6 + 20);
        const anchorY = lockedTarget || hasBounce ? traj.endY - curR - 14 : Math.max(JAR.dangerY + 24, aimGlazeInfo.y - 22);
        const tagY = Math.max(JAR.neckY + 20, anchorY);
        const tagX = Math.max(JAR.left + tagW * 0.5 + 4, Math.min(JAR.right - tagW * 0.5 - 4, lockedTarget || hasBounce ? traj.endX : aimGlazeInfo.x));
        UI.drawNoticeBanner(ctx, tagX - tagW * 0.5, tagY - 10, tagW, 20, {
          text: tagText,
          fontSize: 10.2,
          borderColor: hasBounce ? '#9cf4ff' : '#ffd872',
          textColor: hasBounce ? '#e4fcff' : '#fff5cf',
          rightReserve: 8
        });
      }
    }

    // Fixed Center Turret Mount (`icon_launcher`) + Held Dessert at (220, launchY)
    const coolingDrop = gameState.dropCooldown > 0.04;
    if (gameState.curTier) {
      const visualAngle = -aimAngle * 0.35;
      const turretSize = Math.max(56, Math.min(76, curR * 2.35));

      ctx.save();
      if (isAimCancelled) ctx.globalAlpha = 0.38;
      else if (coolingDrop) ctx.globalAlpha = 0.62;

      // Rotating wooden-and-brass pastry launcher ring (star nozzle points along launch angle!)
      UI.drawUiIcon(ctx, sprites, 'icon_launcher', launchX, launchY, turretSize, 0.96, -aimAngle);

      // Mugi Meteor Shot blazing halo on held treat!
      if (gameState.nextShotMeteor) {
        const mp = 0.72 + 0.28 * Math.sin(nowSec * 14);
        ctx.save();
        ctx.strokeStyle = `rgba(255, 138, 64, ${mp})`;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(launchX, launchY, curR + 6 + mp * 2.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (curIsWild) {
        UI.drawRainbowWildcard(ctx, launchX, launchY, curR, visualAngle, nowSec, coolingDrop ? 0.65 : 1);
      } else {
        if (curIsGold) UI.drawGoldenAura(ctx, launchX, launchY, curR, nowSec, coolingDrop ? 0.6 : 1);
        drawTierSprite(ctx, sprites, gameState.curTier, launchX, launchY, curR, visualAngle, 0, 0, 1, gameState.heldActionAnim);
        if (gameState.heldActionAnim && !coolingDrop) {
          drawDessertActionFX(ctx, launchX, launchY, curR, gameState.curTier, gameState.heldActionAnim);
        }
      }
      ctx.restore();

      if (isAimCancelled) {
        UI.drawNoticeBanner(ctx, launchX - 62, JAR.neckY + 12, 124, 22, {
          text: '↑ 松手取消发射',
          fontSize: 10.5
        });
      }
    }
  }

  // 4.5 Trails
  for (const e of gameState.entities) {
    if (!e.trail || e.trail.length < 2) continue;
    ctx.save();
    const baseCol = e.isMeteorShot
      ? '#ff8c42'
      : e.isYarnBall
      ? '#ffa8c4'
      : e.isWildcard
      ? '#ff9fd6'
      : e.isGolden
      ? '#ffe26a'
      : TIERS[e.tier - 1].crumbColor;
    for (let i = 0; i < e.trail.length; i++) {
      const pt = e.trail[i];
      const frac = (i + 1) / e.trail.length;
      ctx.globalAlpha = frac * (e.isMeteorShot ? 0.42 : 0.24);
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

  // Compute servable tiers map for fast per-entity bell halo rendering
  const vipWantedTiers = new Set();
  const quickWantedTiers = new Set();
  if (gameState.orders && gameState.mode !== 'zen') {
    for (let oi = 0; oi < gameState.orders.length; oi++) {
      const ord = gameState.orders[oi];
      if (!ord || ord.completed) continue;
      for (let si = 0; si < ord.slots.length; si++) {
        if (!ord.slots[si].done) {
          if (ord.kind === 'vip') vipWantedTiers.add(ord.slots[si].tier);
          else quickWantedTiers.add(ord.slots[si].tier);
        }
      }
    }
  }

  const [lr, lg, lb] = theme.lockColor;
  for (const e of gameState.entities) {
    const isFrozen = e.frozenHp > 0;
    const isHovered = (gameState.activeToolMode || gameState.activeSkillMode) && gameState.hoveredEntityId === e.id;
    const validTarget =
      isHovered &&
      !e.isYarnBall &&
      !isFrozen &&
      ((gameState.activeToolMode === 'spoon' && !e.isWildcard && e.tier < 9) ||
        (gameState.activeSkillMode === 'scoop' && !e.isWildcard && e.tier <= 5) ||
        gameState.activeSkillMode === 'swap_1' ||
        (gameState.activeSkillMode === 'swap_2' && e.id !== gameState.swapFirstEntityId));

    const isSouffle = !e.isWildcard && !e.isYarnBall && !isFrozen && e.tier === 9;
    const isVipServable = !e.isWildcard && !e.isYarnBall && !isFrozen && vipWantedTiers.has(e.tier);
    const isQuickServable = !e.isWildcard && !e.isYarnBall && !isFrozen && quickWantedTiers.has(e.tier);
    const isServable = isSouffle || isVipServable || isQuickServable;

    // T3 Matcha Resonance Wave Aura
    if (e.resonanceTimer > 0 && !isFrozen) {
      const rp = 0.5 + 0.5 * Math.sin(nowSec * 9);
      ctx.save();
      ctx.strokeStyle = `rgba(166, 232, 120, ${0.35 + rp * 0.35})`;
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 12 + rp * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // T6 Caramel Spin Mixer Swirl Arcs
    if (e.spinBoostTimer > 0 && !isFrozen) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(nowSec * 11 * (e.spinBoostDir || 1));
      ctx.strokeStyle = 'rgba(255, 206, 128, 0.78)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 5, (k * Math.PI * 2) / 3, (k * Math.PI * 2) / 3 + 0.9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // T7 Cloud Macaron Light-Buoyancy Floating Motes
    if (!e.isWildcard && !e.isYarnBall && !isFrozen && e.tier === 7) {
      ctx.save();
      for (let mk = 0; mk < 3; mk++) {
        const phase = (nowSec * 0.9 + mk * 0.33 + e.id * 0.17) % 1;
        const mxOff = Math.sin(nowSec * 2.2 + mk * 2.1 + e.id) * (e.r * 0.62);
        const myOff = e.r * 0.55 - phase * (e.r * 1.15);
        ctx.globalAlpha = (1 - phase) * 0.65;
        ctx.fillStyle = mk % 2 === 0 ? '#e6d4ff' : '#b8f5e8';
        ctx.beginPath();
        ctx.arc(e.x + mxOff, e.y + myOff, 3.2 - phase * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // T9 Crown Cat Soufflé ×2 Global Aura Halo
    if (isSouffle) {
      const ap = 0.6 + 0.4 * Math.sin(nowSec * 5);
      ctx.save();
      ctx.strokeStyle = `rgba(255, 224, 102, ${0.55 + ap * 0.35})`;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 7 + ap * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (e.isYarnBall) {
      drawYarnBallEntity(ctx, sprites.yarnBall, e, nowSec);
    } else if (e.isWildcard) {
      UI.drawRainbowWildcard(ctx, e.x, e.y, e.r, e.angle, nowSec, 1);
    } else {
      if (e.isGolden && !isFrozen) UI.drawGoldenAura(ctx, e.x, e.y, e.r, nowSec, 1);
      if (e.bumperCrit && !e.isMeteorShot && !isFrozen) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 224, 96, 0.85)';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 3.5, nowSec * 3, nowSec * 3 + Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      if (e.isMeteorShot) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 138, 64, 0.92)';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      drawTierSprite(
        ctx,
        sprites,
        e.tier,
        e.x,
        e.y,
        e.r,
        e.angle,
        isFrozen ? e.squishAmt * 0.25 : e.squishAmt,
        e.squishAngle,
        1,
        isFrozen ? null : e.anim
      );
      if (e.isGolden && !isFrozen) {
        ctx.save();
        const ga = nowSec * 2.5 + e.id;
        ctx.fillStyle = '#fff5b0';
        UI.drawStar(ctx, e.x + Math.cos(ga) * e.r * 0.88, e.y + Math.sin(ga) * e.r * 0.88, 4.2, nowSec * 5);
        ctx.restore();
      }
      if (isFrozen) {
        drawFrozenShell(ctx, e, nowSec);
      } else if (e.frozenFlash > 0) {
        // Brief frost-break shimmer halo right after thawing
        const fa = Math.min(1, e.frozenFlash / 0.45);
        ctx.save();
        ctx.strokeStyle = `rgba(174, 242, 255, ${fa * 0.9})`;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 4 + (1 - fa) * 8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Servable Gold Bell Ring + Bouncing Tap-to-Serve Pill (with storybook serve_bell icon!)
    const isNearOrderSub =
      !isServable &&
      !isFrozen &&
      !e.isWildcard &&
      !e.isYarnBall &&
      Array.isArray(gameState.nearOrderSubTiers) &&
      gameState.nearOrderSubTiers.includes(e.tier);

    if (isServable && !isTargetingMode) {
      const sp = 0.65 + 0.35 * Math.sin(nowSec * 7 + e.id);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(nowSec * 1.4);
      ctx.strokeStyle = isSouffle
        ? `rgba(255, 224, 96, ${0.75 + 0.25 * sp})`
        : isVipServable
        ? `rgba(255, 196, 128, ${0.75 + 0.25 * sp})`
        : `rgba(255, 226, 112, ${0.72 + 0.28 * sp})`;
      ctx.lineWidth = 2.6;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, e.r + 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const bob = Math.sin(nowSec * 7.5 + e.id) * 2.5;
      const pillY = Math.max(JAR.neckY + 12, e.y - e.r - 10 + bob);
      const hasAged = !isSouffle && e.agedStacks > 0 && Array.isArray(gameState.relics) && gameState.relics.includes('rel_aged');
      const pillTxt = isSouffle
        ? '献礼·×2'
        : hasAged
        ? `+${e.agedStacks * 30}%`
        : isVipServable
        ? 'VIP上菜'
        : '上菜';
      const pillW = isSouffle || isVipServable || hasAged ? 66 : 50;
      const px0 = e.x - pillW * 0.5;
      const py0 = pillY - 9.5;
      ctx.save();
      UI.roundRectPath(ctx, px0, py0, pillW, 19, 9.5);
      ctx.fillStyle = hasAged
        ? 'rgba(138, 56, 18, 0.95)'
        : isVipServable
        ? 'rgba(98, 42, 24, 0.95)'
        : 'rgba(64, 35, 16, 0.94)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isVipServable ? '#ffd584' : '#ffe27a';
      ctx.stroke();
      const drewBell = UI.drawUiIcon(ctx, sprites, 'serve_bell', px0 + 10.5, pillY, 13.5);
      const tx = drewBell ? px0 + 18 + (pillW - 22) * 0.5 : e.x;
      UI.drawFitText(ctx, pillTxt, tx, pillY + 0.5, pillW - (drewBell ? 22 : 8), 9.5, 8, 900, '#fff6db', 'center');
      ctx.restore();
    } else if (isNearOrderSub && !isTargetingMode && e.age > 0.35) {
      // 1-Merge-Away (`差1合`) tactical hint ring + micro-pill
      const np = 0.55 + 0.45 * Math.sin(nowSec * 5.2 + e.id);
      ctx.save();
      ctx.strokeStyle = `rgba(92, 224, 146, ${0.55 + 0.32 * np})`;
      ctx.lineWidth = 2.0;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 3.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const tagW = 36;
      const tagH = 14;
      const ty0 = Math.min(JAR.floorY - tagH - 1, e.y + e.r - 6);
      UI.roundRectPath(ctx, e.x - tagW * 0.5, ty0, tagW, tagH, 7);
      ctx.fillStyle = 'rgba(26, 78, 48, 0.90)';
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = '#92f2b8';
      ctx.stroke();
      ctx.fillStyle = '#e8fff0';
      ctx.font = UI.fontStr(8.2, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('差1合', e.x, ty0 + tagH * 0.5 + 0.3);
      ctx.restore();
    }

    // Luna Swap 1st-Selected Moonlight Lock Ring
    if (gameState.activeSkillMode === 'swap_2' && gameState.swapFirstEntityId === e.id) {
      ctx.save();
      ctx.strokeStyle = '#e0b8ff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 6 + Math.sin(nowSec * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
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
      const targetCol = gameState.activeSkillMode === 'swap_1' || gameState.activeSkillMode === 'swap_2' ? '#d8b4ff' : '#ffe169';
      drawEntityWorldPolys(ctx, e, targetCol, 3.2);
    } else if (
      isHovered &&
      (e.isYarnBall || isFrozen || (gameState.activeSkillMode === 'scoop' && (e.tier > 5 || e.isWildcard)))
    ) {
      drawEntityWorldPolys(ctx, e, 'rgba(255, 100, 90, 0.82)', 2.4);
    }
  }

  // 5.2 Front-Layer Glaze Ring Rim (drawn AFTER entities so pastries visually pass THROUGH the portal!)
  if (gameState.obstacles && gameState.obstacles.length > 0) {
    for (let oi = 0; oi < gameState.obstacles.length; oi++) {
      const ob = gameState.obstacles[oi];
      if (ob && ob.type === 'glaze_ring') {
        drawGlazeRingLayer(ctx, ob, 'front', nowSec, !!(aimGlazeInfo && aimGlazeInfo.ringId === ob.id));
      }
    }
  }

  // 5.5 Flying Served Treats (bezier arc zooming out of the jar to customer table!)
  if (gameState.flyingServes && gameState.flyingServes.length > 0) {
    for (let i = 0; i < gameState.flyingServes.length; i++) {
      const fs = gameState.flyingServes[i];
      const u = Math.max(0, Math.min(1, fs.t / fs.dur));
      const inv = 1 - u;
      const fx = inv * inv * fs.x0 + 2 * inv * u * fs.cx + u * u * fs.x1;
      const fy = inv * inv * fs.y0 + 2 * inv * u * fs.cy + u * u * fs.y1;
      const sc = 1 + 0.25 * Math.sin(u * Math.PI) - u * 0.45;
      const r = TIERS[fs.tier - 1].radius * sc;
      ctx.save();
      ctx.globalAlpha = Math.max(0.2, 1 - u * 0.55);
      UI.drawGoldenAura(ctx, fx, fy, r, nowSec, 0.9);
      drawTierSprite(ctx, sprites, fs.tier, fx, fy, r, u * 4.5, 0, 0, 1, null);
      ctx.restore();
    }
  }

  for (const e of gameState.entities) {
    if (e.anim && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0)) {
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
    } else if (p.shard) {
      ctx.translate(p.x, p.y);
      ctx.rotate(typeof p.rot === 'number' ? p.rot : p.life * 9);
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(-s * 1.15, 0);
      ctx.lineTo(0, -s * 0.52);
      ctx.lineTo(s * 1.2, 0);
      ctx.lineTo(0, s * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();
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

  // 6.5 Non-Blocking In-Jar Active Hazard & Boss Affix Badges (visual-only, zero pointer capture)
  drawInJarHazardBadges(ctx, gameState, nowSec);

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
    ctx.translate(JAR.canvasW * 0.5, 156 - elapsed * 8);
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
