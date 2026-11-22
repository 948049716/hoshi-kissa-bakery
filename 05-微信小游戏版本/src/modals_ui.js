/**
 * Canvas 2D Storybook Interactive Modals & Spotlight Mode Guides for WeChat Mini Game
 * Unified Starlight Kissa visual language across Mode Guide, Shop (3 tabs), Career,
 * Help, Compendium, 3-Choice Chef Blessings, Prep Shop, Build Inspector & Settlement.
 */
'use strict';

const {
  TIERS,
  PATRONS,
  SHOP_UPGRADES,
  JAR_THEME_LIST,
  ACHIEVEMENTS,
  SHIFT_HAZARDS,
  MODE_GUIDES,
  getShiftConfig,
  MAX_RELIC_SLOTS,
  RELIC_ARCHETYPES,
  ARCHETYPE_SYNERGIES,
  RELICS,
  DECK_MODS,
  getChefRank
} = require('./constants');
const UI = require('./ui_draw');

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

function renderModalBackdropAndFrame(ctx, metrics, app, maxW, desiredH, hits = null) {
  const { width, height, safeTop, safeBottom, menuRect } = metrics;
  const topBound = menuRect ? menuRect.bottom + 8 : Math.max(14, safeTop + 10);
  const botBound = height - Math.max(12, safeBottom + 10);

  if (hits) {
    hits.add('modal_backdrop', 0, 0, width, height, () => {});
  }

  ctx.save();
  ctx.fillStyle = 'rgba(18, 10, 6, 0.72)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const w = Math.min(maxW, width - 20);
  const h = Math.min(desiredH, botBound - topBound);
  const x = (width - w) * 0.5;
  const y = topBound + (botBound - topBound - h) * 0.5;

  UI.drawWoodBoard(ctx, x, y, w, h, 16);
  const pad = 9;
  UI.drawParchmentSheet(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, 11);

  if (hits) {
    hits.add('modal_body_guard', x, y, w, h, () => {});
  }

  return {
    cardX: x,
    cardY: y,
    cardW: w,
    cardH: h,
    ix: x + pad + 10,
    iy: y + pad + 10,
    iw: w - (pad + 10) * 2,
    ih: h - (pad + 10) * 2
  };
}

function drawModalHeader(ctx, f, sprites, iconKey, title, subtitle, rightReserve = 66) {
  let tx = f.ix;
  if (iconKey && sprites) {
    const icS = subtitle ? 32 : 28;
    const icY = subtitle ? f.iy + 17 : f.iy + 14;
    if (UI.drawUiIcon(ctx, sprites, iconKey, f.ix + icS * 0.5, icY, icS)) {
      tx = f.ix + icS + 7;
    }
  }
  const availW = Math.max(60, f.ix + f.iw - rightReserve - tx);
  if (subtitle) {
    UI.drawFitText(ctx, title, tx, f.iy + 11, availW, 16, 11.5, 900, '#4A2C2A');
    UI.drawFitText(ctx, subtitle, tx, f.iy + 28, availW, 10.5, 8.5, 700, '#884a18');
  } else {
    UI.drawFitText(ctx, title, tx, f.iy + 15, availW, 16, 11.5, 900, '#4A2C2A');
  }
}

function drawCloseButton(ctx, f, hits, app, label = '', w = 30) {
  const bx = f.ix + f.iw - w;
  const by = f.iy;
  if (label) {
    UI.drawPillButton(ctx, bx, by, w, 28, {
      style: 'wood',
      text: label,
      fontSize: 10.8
    });
  } else {
    UI.drawPillButton(ctx, bx, by, w, 28, {
      style: 'wood',
      icon: 'icon_close',
      sprites: app.sprites,
      iconSize: 20,
      radius: 10,
      fallbackText: '关'
    });
  }
  hits.add('modal_close', bx, by, w, 28, () => app.closeModal());
}

function beginModalScrollBody(ctx, x, y, w, h, scrollY) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(0, -scrollY);
}

function endModalScrollBody(ctx, x, y, w, h, scrollY, maxScroll) {
  ctx.restore();
  if (maxScroll > 2) {
    const thumbH = Math.max(24, (h / (h + maxScroll)) * h);
    const thumbY = y + (scrollY / maxScroll) * (h - thumbH);
    ctx.save();
    UI.roundRectPath(ctx, x + w - 5, y + 2, 4, h - 4, 2);
    ctx.fillStyle = 'rgba(140, 96, 52, 0.2)';
    ctx.fill();
    UI.roundRectPath(ctx, x + w - 5, thumbY, 4, thumbH, 2);
    ctx.fillStyle = 'rgba(140, 82, 34, 0.65)';
    ctx.fill();
    ctx.restore();
  }
}

function renderActiveModal(ctx, metrics, app, hits, nowSec = Date.now() / 1000) {
  const modal = app.activeModal;
  if (!modal) {
    app.modalScrollRect = null;
    return;
  }

  if (modal === 'mode_guide') renderModeGuideModal(ctx, metrics, app, hits, nowSec);
  else if (modal === 'pause') renderPauseModal(ctx, metrics, app, hits);
  else if (modal === 'confirm') renderConfirmModal(ctx, metrics, app, hits);
  else if (modal === 'shop') renderShopModal(ctx, metrics, app, hits);
  else if (modal === 'career') renderCareerModal(ctx, metrics, app, hits);
  else if (modal === 'help') renderHelpModal(ctx, metrics, app, hits);
  else if (modal === 'compendium') renderCompendiumModal(ctx, metrics, app, hits);
  else if (modal === 'blessing') renderBlessingModal(ctx, metrics, app, hits);
  else if (modal === 'prep_shop') renderPrepShopModal(ctx, metrics, app, hits);
  else if (modal === 'shift_victory') renderShiftVictoryModal(ctx, metrics, app, hits);
  else if (modal === 'relics') renderRelicsModal(ctx, metrics, app, hits);
  else if (modal === 'gameover') renderGameOverModal(ctx, metrics, app, hits);
}

function renderPauseModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 400, Math.min(368, metrics.height * 0.78), hits);
  const { gameState, sprites, audio } = app;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  drawModalHeader(ctx, f, sprites, 'icon_pause', '营业小憩 · 已暂停', null, 38);
  drawCloseButton(ctx, f, hits, app);

  const infoY = f.iy + 36;
  UI.drawKissaCard(ctx, f.ix, infoY, f.iw, 42, { tone: 'amber', radius: 10 });
  const statusLine =
    gameState.mode === 'chef'
      ? `第 ${gameState.shift} 幕 · 营业额 ¥${gameState.shiftRevenue}/¥${gameState.shiftTarget} · 剩 ${gameState.stepsLeft} 步`
      : gameState.mode === 'rush'
      ? `90秒狂欢 · 剩余 ${Math.max(0, gameState.rushTimer).toFixed(1)}s · 得分 ${gameState.score}`
      : `悠闲经典 · 当前得分 ${gameState.score}`;
  UI.drawFitText(ctx, statusLine, f.ix + f.iw * 0.5, infoY + 21, f.iw - 16, 11.2, 8.8, 800, '#5c3310', 'center');

  const resumeY = infoY + 52;
  UI.drawPillButton(ctx, f.ix, resumeY, f.iw, 42, {
    style: 'cta',
    icon: gameState.mode === 'rush' ? 'mode_rush' : gameState.mode === 'zen' ? 'mode_zen' : 'mode_chef',
    sprites,
    iconSize: 20,
    text: '继续营业',
    fontSize: 14.5,
    fontWeight: 900,
    radius: 12
  });
  hits.add('pause_resume', f.ix, resumeY, f.iw, 42, () => app.closeModal());

  const gap = 8;
  const colW = (f.iw - gap) * 0.5;
  const r1Y = resumeY + 52;
  const rowH = 36;

  UI.drawPillButton(ctx, f.ix, r1Y, colW, rowH, {
    style: audio.bgmEnabled ? 'active' : 'wood',
    icon: 'icon_bgm',
    sprites,
    iconSize: 17,
    mutedSlash: !audio.bgmEnabled,
    text: audio.bgmEnabled ? '音乐：开' : '音乐：关',
    fontSize: 11.5,
    radius: 10
  });
  hits.add('pause_bgm', f.ix, r1Y, colW, rowH, () => app.cycleBgm());

  UI.drawPillButton(ctx, f.ix + colW + gap, r1Y, colW, rowH, {
    style: audio.sfxEnabled ? 'active' : 'wood',
    icon: 'icon_sfx',
    sprites,
    iconSize: 17,
    mutedSlash: !audio.sfxEnabled,
    text: audio.sfxEnabled ? '音效：开' : '音效：关',
    fontSize: 11.5,
    radius: 10
  });
  hits.add('pause_sfx', f.ix + colW + gap, r1Y, colW, rowH, () => app.toggleSfx());

  const r2Y = r1Y + rowH + 8;
  UI.drawPillButton(ctx, f.ix, r2Y, colW, rowH, {
    style: 'wood',
    icon: 'icon_help',
    sprites,
    iconSize: 17,
    text: '模式指引',
    fontSize: 11.5,
    radius: 10
  });
  hits.add('pause_guide', f.ix, r2Y, colW, rowH, () => app.openModeGuide(gameState.mode, 0));

  UI.drawPillButton(ctx, f.ix + colW + gap, r2Y, colW, rowH, {
    style: 'wood',
    icon: 'icon_book',
    sprites,
    iconSize: 17,
    text: '甜品图鉴',
    fontSize: 11.5,
    radius: 10
  });
  hits.add('pause_comp', f.ix + colW + gap, r2Y, colW, rowH, () => app.openModal('compendium'));

  const r3Y = r2Y + rowH + 10;
  UI.drawPillButton(ctx, f.ix, r3Y, colW, rowH, {
    style: 'wood',
    icon: 'icon_restart',
    sprites,
    iconSize: 17,
    text: '重新开局',
    fontSize: 11.5,
    radius: 10
  });
  hits.add('pause_restart', f.ix, r3Y, colW, rowH, () => app.requestRestartRun('pause'));

  UI.drawPillButton(ctx, f.ix + colW + gap, r3Y, colW, rowH, {
    style: 'wood',
    icon: 'icon_home',
    sprites,
    iconSize: 17,
    text: '存盘回厅',
    fontSize: 11.5,
    radius: 10
  });
  hits.add('pause_lobby', f.ix + colW + gap, r3Y, colW, rowH, () => app.returnToLobby());
}

function renderConfirmModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 376, 214, hits);
  const { sprites } = app;
  const dlg = app.confirmDialog || {
    title: '确认操作',
    message: '确定继续吗？',
    confirmText: '确认',
    cancelText: '取消'
  };
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  drawModalHeader(ctx, f, sprites, 'icon_warn', dlg.title || '确认操作', null, 12);

  const msgY = f.iy + 38;
  const msgH = f.ih - 86;
  UI.drawKissaCard(ctx, f.ix, msgY, f.iw, msgH, { tone: 'soft', radius: 10 });
  UI.drawWrappedText(
    ctx,
    dlg.message || '',
    f.ix + 12,
    msgY + 14,
    f.iw - 24,
    16,
    UI.fontStr(11.5, 700),
    '#4A2C2A',
    'left',
    3
  );

  const btnY = f.iy + f.ih - 38;
  const gap = 10;
  const btnW = (f.iw - gap) * 0.5;
  UI.drawPillButton(ctx, f.ix, btnY, btnW, 38, {
    style: 'wood',
    text: dlg.cancelText || '取消',
    fontSize: 12.5,
    fontWeight: 800,
    radius: 11
  });
  hits.add('confirm_cancel', f.ix, btnY, btnW, 38, () => app.confirmCancel());

  UI.drawPillButton(ctx, f.ix + btnW + gap, btnY, btnW, 38, {
    style: 'danger',
    text: dlg.confirmText || '确认',
    fontSize: 12.5,
    fontWeight: 900,
    radius: 11
  });
  hits.add('confirm_accept', f.ix + btnW + gap, btnY, btnW, 38, () => app.confirmAccept());
}

function collectGuideSpotlights(focus, gt, width, height) {
  if (!gt) return [];
  let raw = [];
  if (focus === 'launcher') {
    raw = [gt.launcher];
  } else if (focus === 'serve') {
    raw = [gt.orderBar, gt.servableTreat];
  } else if (focus === 'hud_skill') {
    raw = [gt.hud, gt.skill];
  } else if (focus === 'danger_dock') {
    raw = [gt.danger, gt.dock];
  } else if (focus === 'hold_milestone') {
    raw = [gt.hold, gt.orderBar];
  } else if (focus === 'glaze_ring') {
    raw = [gt.glazeRing || gt.launcher];
  } else if (focus === 'frozen') {
    raw = Array.isArray(gt.frozenTreats) && gt.frozenTreats.length > 0 ? gt.frozenTreats : [gt.launcher];
  }
  const pad = 5;
  const out = [];
  for (const r of raw) {
    if (!r || !(r.w > 4) || !(r.h > 4)) continue;
    const sx = Math.max(4, r.x - pad);
    const sy = Math.max(4, r.y - pad);
    const sw = Math.min(width - 4, r.x + r.w + pad) - sx;
    const sh = Math.min(height - 4, r.y + r.h + pad) - sy;
    if (sw > 8 && sh > 8) {
      out.push({ x: sx, y: sy, w: sw, h: sh });
    }
  }
  return out;
}

function chooseGuideCardY(topBound, botBound, cardH, cardX, cardW, spotlights) {
  const minY = topBound + 4;
  const maxY = Math.max(minY, botBound - cardH - 4);
  if (spotlights.length === 0) {
    return minY + (maxY - minY) * 0.5;
  }

  const candidates = [
    maxY,
    minY,
    minY + (maxY - minY) * 0.5,
    minY + (maxY - minY) * 0.34,
    minY + (maxY - minY) * 0.68
  ];

  // Add midpoints between vertical spotlight intervals for exact gap fitting
  const sorted = [...spotlights].sort((a, b) => a.y - b.y);
  if (sorted[0].y - minY >= cardH + 8) {
    candidates.push(sorted[0].y - cardH - 8);
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapTop = sorted[i].y + sorted[i].h + 8;
    const gapBot = sorted[i + 1].y - 8;
    if (gapBot - gapTop >= cardH) {
      candidates.push(gapTop + (gapBot - gapTop - cardH) * 0.5);
    }
  }
  const lastBot = sorted[sorted.length - 1].y + sorted[sorted.length - 1].h + 8;
  if (maxY - lastBot >= 0) {
    candidates.push(Math.min(maxY, lastBot + 4));
  }

  let bestY = maxY;
  let bestScore = -1e9;
  for (const rawY of candidates) {
    const cy = Math.max(minY, Math.min(maxY, rawY));
    let overlapArea = 0;
    let minClearance = 9999;
    for (const s of spotlights) {
      const ox = Math.max(0, Math.min(cardX + cardW, s.x + s.w) - Math.max(cardX, s.x));
      const oy = Math.max(0, Math.min(cy + cardH, s.y + s.h) - Math.max(cy, s.y));
      overlapArea += ox * oy;
      if (ox > 0) {
        const vertDist = cy >= s.y + s.h ? cy - (s.y + s.h) : s.y >= cy + cardH ? s.y - (cy + cardH) : 0;
        minClearance = Math.min(minClearance, vertDist);
      }
    }
    const score = -overlapArea * 100 + Math.min(48, minClearance);
    if (score > bestScore) {
      bestScore = score;
      bestY = cy;
    }
  }
  return Math.round(bestY);
}

function drawGuideSpotlightGestures(ctx, focus, gt, sprites, nowSec) {
  if (!gt) return;
  const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5.2);

  if (focus === 'launcher' && gt.launcher) {
    const cx = gt.launcher.x + gt.launcher.w * 0.5;
    const topY = gt.launcher.y + 24;
    const sweepAng = Math.sin(nowSec * 2.6) * 0.62;
    const arcR = Math.min(82, gt.launcher.h * 0.72);

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 232, 132, 0.92)';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + Math.sin(sweepAng) * arcR, topY + Math.cos(sweepAng) * arcR);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255, 214, 102, 0.68)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, topY, arcR * 0.72, Math.PI * 0.5 - 0.68, Math.PI * 0.5 + 0.68);
    ctx.stroke();

    const pawX = cx + Math.sin(sweepAng) * (arcR * 0.78);
    const pawY = topY + Math.cos(sweepAng) * (arcR * 0.78) + 8;
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', pawX, pawY, 32, 0.96, -sweepAng * 0.45);
    ctx.restore();
  } else if (focus === 'serve' && gt.servableTreat) {
    const s = gt.servableTreat;
    const bob = Math.sin(nowSec * 6.5) * 4;
    const px = s.x + s.w * 0.78;
    const py = s.y + s.h * 0.72 + bob;
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', px, py, 32 + pulse * 3, 0.96, -0.25);
  } else if (focus === 'hud_skill' && gt.skill) {
    const s = gt.skill;
    const bob = Math.sin(nowSec * 6.0) * 3.5;
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', s.x + s.w + 10, s.y + s.h * 0.5 + bob, 30, 0.95, -0.35);
  } else if (focus === 'hold_milestone' && gt.hold) {
    const s = gt.hold;
    const bob = Math.sin(nowSec * 6.0) * 3.5;
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', s.x + s.w * 0.75, s.y + s.h + 12 + bob, 30, 0.95, -0.15);
  } else if (focus === 'glaze_ring' && gt.glazeRing) {
    const s = gt.glazeRing;
    const bob = Math.sin(nowSec * 6.0) * 4;
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', s.x + s.w + 8, s.y + s.h * 0.5 + bob, 31 + pulse * 2, 0.96, -0.3);
  } else if (focus === 'frozen' && Array.isArray(gt.frozenTreats) && gt.frozenTreats[0]) {
    const s = gt.frozenTreats[0];
    const bob = Math.sin(nowSec * 6.2) * 4;
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', s.x + s.w * 0.85, s.y - 6 + bob, 31 + pulse * 2, 0.96, -0.2);
  }
}

function renderModeGuideModal(ctx, metrics, app, hits, nowSec) {
  const { width, height, safeTop, safeBottom, menuRect } = metrics;
  const { sprites } = app;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  const def = MODE_GUIDES[app.guideMode] || MODE_GUIDES.chef;
  const steps = def.steps || [];
  const stepIdx = Math.max(0, Math.min(steps.length - 1, app.guideStep || 0));
  const step = steps[stepIdx];
  const isLast = stepIdx >= steps.length - 1;

  const topBound = menuRect ? menuRect.bottom + 8 : Math.max(14, safeTop + 10);
  const botBound = height - Math.max(12, safeBottom + 10);

  const inGameSpotlight = !app.isLobbyOpen && !!app.lastGuideTargets;
  const spotlights = inGameSpotlight ? collectGuideSpotlights(step.focus, app.lastGuideTargets, width, height) : [];

  hits.add('modal_backdrop', 0, 0, width, height, () => app.nextModeGuideStep());

  // 1. Dark Backdrop with Even-Odd Rounded-Rect Spotlight Cutouts
  ctx.save();
  ctx.fillStyle = inGameSpotlight ? 'rgba(16, 9, 5, 0.74)' : 'rgba(18, 10, 6, 0.74)';
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  for (const s of spotlights) {
    appendRoundRectSubpath(ctx, s.x, s.y, s.w, s.h, 13);
  }
  ctx.fill('evenodd');

  // Golden pulsing frame around each spotlighted target
  const pulse = 0.55 + 0.45 * Math.sin(nowSec * 5.2);
  for (const s of spotlights) {
    ctx.strokeStyle = `rgba(255, 224, 118, ${0.72 + pulse * 0.25})`;
    ctx.lineWidth = 2.6;
    UI.roundRectPath(ctx, s.x, s.y, s.w, s.h, 13);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 248, 214, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    UI.roundRectPath(ctx, s.x - 3.5, s.y - 3.5, s.w + 7, s.h + 7, 16);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  if (inGameSpotlight) {
    drawGuideSpotlightGestures(ctx, step.focus, app.lastGuideTargets, sprites, nowSec);
  }

  // 2. Position Compact Storybook Guide Card cleanly clear of spotlights & capsule
  const cardW = Math.min(416, width - 22);
  const lineCount = (step.lines || []).length;
  const desiredH = lineCount >= 2 ? 190 : 168;
  const cardH = Math.min(desiredH, botBound - topBound - 8);
  const cardX = Math.round((width - cardW) * 0.5);
  const cardY = inGameSpotlight
    ? chooseGuideCardY(topBound, botBound, cardH, cardX, cardW, spotlights)
    : Math.round(topBound + (botBound - topBound - cardH) * 0.5);

  UI.drawWoodBoard(ctx, cardX, cardY, cardW, cardH, 16);
  const pad = 8;
  UI.drawParchmentSheet(ctx, cardX + pad, cardY + pad, cardW - pad * 2, cardH - pad * 2, 11);
  hits.add('modal_body_guard', cardX, cardY, cardW, cardH, () => {});

  const ix = cardX + pad + 10;
  const iy = cardY + pad + 8;
  const iw = cardW - (pad + 10) * 2;
  const ih = cardH - (pad + 8) * 2;

  // Header Row: Mode Icon + Title + Compact Skip Button
  const skipW = 48;
  UI.drawUiIcon(ctx, sprites, def.icon, ix + 13, iy + 13, 24);
  UI.drawFitText(ctx, def.title, ix + 29, iy + 9, iw - skipW - 34, 13.5, 10.5, 900, '#4A2C2A');
  UI.drawTagBadge(ctx, ix + 29, iy + 19, Math.min(110, iw - skipW - 36), 15, step.tag, 'amber', 8.6);

  UI.drawPillButton(ctx, ix + iw - skipW, iy + 2, skipW, 25, {
    style: 'wood',
    text: def.isMechanicTip ? '关闭' : '跳过',
    fontSize: 10.2,
    radius: 12
  });
  hits.add('guide_skip', ix + iw - skipW, iy + 2, skipW, 25, () => app.finishModeGuide());

  // Step Content Card
  const footerH = 32;
  const footerY = iy + ih - footerH;
  const contentY = iy + 38;
  const contentH = Math.max(66, footerY - contentY - 7);

  UI.drawKissaCard(ctx, ix, contentY, iw, contentH, { tone: 'amber', radius: 10 });

  const medS = 28;
  ctx.save();
  ctx.fillStyle = '#fffdf4';
  UI.roundRectPath(ctx, ix + 8, contentY + 7, medS, medS, 8);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#b9822c';
  ctx.stroke();
  UI.drawUiIcon(ctx, sprites, step.icon || def.icon, ix + 8 + medS * 0.5, contentY + 7 + medS * 0.5, medS - 4);
  ctx.restore();

  UI.drawFitText(ctx, step.title, ix + 43, contentY + 21, iw - 50, 12.8, 10, 900, '#4A2C2A');

  let ly = contentY + 39;
  const bulletAvailH = contentY + contentH - 5 - ly;
  const perLineH = bulletAvailH < 48 ? 13 : 14.5;
  for (let i = 0; i < (step.lines || []).length; i++) {
    if (ly + perLineH > contentY + contentH - 2) break;
    const txt = `• ${step.lines[i]}`;
    const usedH = UI.drawWrappedText(
      ctx,
      txt,
      ix + 10,
      ly,
      iw - 20,
      perLineH,
      UI.fontStr(10.2, 700),
      '#5c3626',
      'left',
      2
    );
    ly += usedH + 2;
  }

  // Footer Row: Step Progress Dots + [上一步] + [下一步 / 开始]
  const dotStartX = ix + 6;
  const dotCy = footerY + footerH * 0.5;
  for (let i = 0; i < steps.length; i++) {
    const active = i === stepIdx;
    const dw = active ? 18 : 8;
    const dx = dotStartX + i * 13 + (i > stepIdx ? 10 : 0);
    UI.roundRectPath(ctx, dx, dotCy - 4, dw, 8, 4);
    ctx.fillStyle = active ? '#d98218' : '#d8c39e';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = active ? '#4A2C2A' : '#9c7c54';
    ctx.stroke();
  }

  const nextW = isLast ? 92 : 84;
  const nextX = ix + iw - nextW;
  const nextLabel = isLast
    ? def.isMechanicTip || app.isLobbyOpen
      ? '知道了'
      : '开始'
    : '下一步';
  UI.drawPillButton(ctx, nextX, footerY, nextW, footerH, {
    style: 'cta',
    icon: isLast ? def.icon : '',
    sprites,
    iconSize: 17,
    text: nextLabel,
    fontSize: 12,
    fontWeight: 900,
    radius: 11
  });
  hits.add('guide_next', nextX, footerY, nextW, footerH, () => app.nextModeGuideStep());

  if (stepIdx > 0) {
    const prevW = 60;
    const prevX = nextX - 7 - prevW;
    UI.drawPillButton(ctx, prevX, footerY, prevW, footerH, {
      style: 'wood',
      text: '上一步',
      fontSize: 10.8,
      radius: 11
    });
    hits.add('guide_prev', prevX, footerY, prevW, footerH, () => app.prevModeGuideStep());
  }
}

function renderShopModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 680, metrics.height * 0.84, hits);
  const { saveData, sprites, activeShopTab } = app;
  const isWide = f.iw >= 520;

  const closeW = 30;
  const bankVal = String(saveData.bankStardust || 0);
  const bankW = Math.max(66, 36 + bankVal.length * 8.5);
  drawModalHeader(ctx, f, sprites, 'icon_shop', '吃茶小铺', null, closeW + bankW + 14);

  drawCloseButton(ctx, f, hits, app, '', closeW);
  UI.drawCurrencyChip(ctx, f.ix + f.iw - closeW - 6 - bankW, f.iy, bankW, 28, sprites, 'icon_stardust', bankVal, {
    style: 'active',
    fontSize: 12
  });

  // 3 Unified Shop Tabs
  const tabY = f.iy + 36;
  const tabH = 30;
  const tabs = [
    { id: 'upgrades', icon: 'icon_toolbox', label: '厨房天赋' },
    { id: 'themes', icon: 'icon_shop', label: '玻璃罐' },
    { id: 'patrons', icon: 'icon_paw_guide', label: '伙伴' }
  ];
  const tabW = (f.iw - 12) / 3;
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    const tx = f.ix + i * (tabW + 6);
    const active = activeShopTab === t.id;
    UI.drawPillButton(ctx, tx, tabY, tabW, tabH, {
      style: active ? 'active' : 'wood',
      icon: t.icon,
      sprites,
      iconSize: 17,
      text: t.label,
      fontSize: isWide ? 12.5 : 11.2,
      radius: 9
    });
    hits.add(`shop_tab_${t.id}`, tx, tabY, tabW, tabH, () => app.setShopTab(t.id));
  }

  // Scrollable body
  const bodyY = tabY + tabH + 10;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const bank = saveData.bankStardust || 0;
  let totalContentH = 0;

  if (activeShopTab === 'upgrades') {
    const cols = isWide ? 2 : 1;
    const gap = 9;
    const cardW = (f.iw - 8 - gap * (cols - 1)) / cols;
    const cardH = 102;
    const rows = Math.ceil(SHOP_UPGRADES.length / cols);
    totalContentH = rows * cardH + Math.max(0, rows - 1) * gap;
    app.modalMaxScroll = Math.max(0, totalContentH - bodyH);
    app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

    beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
    for (let i = 0; i < SHOP_UPGRADES.length; i++) {
      const up = SHOP_UPGRADES[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = f.ix + col * (cardW + gap);
      const cy = bodyY + row * (cardH + gap);
      const lv = app.getUpgradeLevel(up.id);
      const isMax = lv >= up.maxLv;
      const cost = isMax ? 0 : up.costs[lv];
      const canBuy = !isMax && bank >= cost;

      UI.drawKissaCard(ctx, cx, cy, cardW, cardH, { tone: isMax ? 'equipped' : 'cream', radius: 12 });

      UI.drawKissaCard(ctx, cx + 10, cy + 10, 38, 38, { tone: 'amber', radius: 10 });
      UI.drawUiIcon(ctx, sprites, up.icon || 'icon_stardust', cx + 29, cy + 29, 28);

      UI.drawFitText(ctx, `${up.name} Lv.${lv}/${up.maxLv}`, cx + 56, cy + 19, cardW - 66, 13, 10.5, 900, '#4A2C2A');
      for (let p = 0; p < up.maxLv; p++) {
        UI.roundRectPath(ctx, cx + 56 + p * 18, cy + 33, 14, 7, 3.5);
        ctx.fillStyle = p < lv ? '#f5b63b' : '#dfd0b2';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = p < lv ? '#4A2C2A' : '#8a643b';
        ctx.stroke();
      }

      UI.drawFitText(ctx, up.desc(lv), cx + 10, cy + 59, cardW - 20, 10.5, 8.8, 700, '#724640');

      const btnY = cy + cardH - 30;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 23, {
        style: isMax ? 'equipped' : canBuy ? 'cta' : 'wood',
        icon: isMax ? '' : 'icon_stardust',
        sprites,
        iconSize: 15,
        text: isMax ? '已满级' : `${cost} 升级`,
        fontSize: 11,
        disabled: !isMax && !canBuy
      });
      if (!isMax) {
        hits.add(`shop_up_${up.id}`, cx + 10, btnY - app.modalScrollY, cardW - 20, 23, () => app.buyUpgrade(up.id), { clipRect });
      }
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
  } else if (activeShopTab === 'themes') {
    const cols = isWide ? 3 : 1;
    const gap = 9;
    const cardW = (f.iw - 8 - gap * (cols - 1)) / cols;
    const cardH = isWide ? 142 : 104;
    const rows = Math.ceil(JAR_THEME_LIST.length / cols);
    totalContentH = rows * cardH + Math.max(0, rows - 1) * gap;
    app.modalMaxScroll = Math.max(0, totalContentH - bodyH);
    app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

    beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
    for (let i = 0; i < JAR_THEME_LIST.length; i++) {
      const th = JAR_THEME_LIST[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = f.ix + col * (cardW + gap);
      const cy = bodyY + row * (cardH + gap);
      const owned = saveData.unlockedThemes.includes(th.id);
      const equipped = saveData.equippedTheme === th.id;
      const canBuy = !owned && bank >= th.cost;

      UI.drawKissaCard(ctx, cx, cy, cardW, cardH, { tone: equipped ? 'equipped' : 'cream', radius: 12 });
      UI.drawThemeSwatch(ctx, cx + 10, cy + 10, 40, 40, th.id);
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = 1.8;
      UI.roundRectPath(ctx, cx + 10, cy + 10, 40, 40, 9);
      ctx.stroke();

      UI.drawFitText(ctx, th.name, cx + 58, cy + 20, cardW - 68, 13, 10.5, 900, '#4A2C2A');
      const statusTxt = equipped ? '使用中' : owned ? '已拥有' : `${th.cost}`;
      UI.drawTagBadge(
        ctx,
        cx + 58,
        cy + 31,
        56,
        17,
        statusTxt,
        equipped ? 'sage' : owned ? 'soft' : 'amber',
        9,
        !equipped && !owned ? 'icon_stardust' : '',
        sprites
      );

      UI.drawWrappedText(ctx, th.desc, cx + 10, cy + 56, cardW - 20, 13, UI.fontStr(10.2, 600), '#724640', 'left', 2);

      const btnY = cy + cardH - 30;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 23, {
        style: equipped ? 'equipped' : owned ? 'active' : canBuy ? 'cta' : 'wood',
        icon: !equipped && !owned ? 'icon_stardust' : '',
        sprites,
        iconSize: 15,
        text: equipped ? '使用中' : owned ? '换装' : `${th.cost} 解锁`,
        fontSize: 11,
        disabled: !equipped && !owned && !canBuy
      });
      if (!equipped) {
        hits.add(`shop_theme_${th.id}`, cx + 10, btnY - app.modalScrollY, cardW - 20, 23, () => app.buyOrEquipTheme(th.id), { clipRect });
      }
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
  } else {
    const cols = isWide ? 3 : 1;
    const gap = 9;
    const cardW = (f.iw - 8 - gap * (cols - 1)) / cols;
    const cardH = isWide ? 144 : 106;
    const rows = Math.ceil(PATRONS.length / cols);
    totalContentH = rows * cardH + Math.max(0, rows - 1) * gap;
    app.modalMaxScroll = Math.max(0, totalContentH - bodyH);
    app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

    beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
    for (let i = 0; i < PATRONS.length; i++) {
      const p = PATRONS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = f.ix + col * (cardW + gap);
      const cy = bodyY + row * (cardH + gap);
      const owned = saveData.unlockedPatrons.includes(p.id);
      const selected = saveData.selectedPatron === p.id;
      const canBuy = !owned && bank >= p.cost;

      UI.drawKissaCard(ctx, cx, cy, cardW, cardH, { tone: selected ? 'equipped' : 'cream', radius: 12 });
      UI.drawKissaCard(ctx, cx + 10, cy + 10, 40, 40, { tone: 'amber', radius: 10 });
      if (sprites.patrons[p.id]) {
        UI.drawContainImage(ctx, sprites.patrons[p.id], cx + 30, cy + 30, 34, 34);
      }

      UI.drawFitText(ctx, p.shortName, cx + 58, cy + 20, cardW - 68, 13, 10.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, cx + 58, cy + 31, 66, 17, p.skillName, 'amber', 9, p.activeSkill.icon, sprites);

      UI.drawWrappedText(ctx, p.passiveDesc, cx + 10, cy + 56, cardW - 20, 13, UI.fontStr(10.2, 600), '#724640', 'left', 2);

      const btnY = cy + cardH - 30;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 23, {
        style: selected ? 'equipped' : owned ? 'active' : canBuy ? 'cta' : 'wood',
        icon: !selected && !owned ? 'icon_stardust' : '',
        sprites,
        iconSize: 15,
        text: selected ? '出战中' : owned ? '切换出战' : `${p.cost} 邀请`,
        fontSize: 11,
        disabled: !selected && !owned && !canBuy
      });
      if (!selected) {
        hits.add(`shop_patron_${p.id}`, cx + 10, btnY - app.modalScrollY, cardW - 20, 23, () => app.buyOrSelectPatron(p.id), { clipRect });
      }
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
  }
}

function drawCircularAvatar(ctx, img, cx, cy, r, bgStyle = '#fff6df', strokeStyle = '#9c6e3b') {
  ctx.save();
  ctx.fillStyle = bgStyle;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
    ctx.clip();
    UI.drawCoverImage(ctx, img, cx - r, cy - r, r * 2, r * 2, 0.5);
    ctx.restore();
  }
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = strokeStyle;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function renderCareerModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 660, metrics.height * 0.86, hits);
  const { saveData, sprites } = app;
  const st = saveData.lifetimeStats || {};

  drawModalHeader(
    ctx,
    f,
    sprites,
    'icon_trophy',
    '履历与排行',
    getChefRank(app.getCareerTopScore()),
    38
  );
  drawCloseButton(ctx, f, hits, app);

  // 1. Chef ID Card (店长名片 + 微信昵称头像授权 + 云存档状态)
  const cardY = f.iy + 40;
  const cardH = 52;
  UI.drawKissaCard(ctx, f.ix, cardY, f.iw, cardH, { tone: 'amber', radius: 11 });

  const avCx = f.ix + 28;
  const avCy = cardY + cardH * 0.5;
  const avImg = app.getPlayerAvatarImg ? app.getPlayerAvatarImg() : sprites.patrons.mikan;
  drawCircularAvatar(ctx, avImg, avCx, avCy, 18, '#fff9eb', '#8a5222');
  hits.add('career_avatar_cycle', f.ix + 6, cardY + 4, 44, 44, () => app.cycleProfileAvatarPreset());

  const isAuth = !!(saveData.playerProfile && saveData.playerProfile.authorized);
  const authBtnW = 84;
  const authBtnH = 28;
  const authBtnX = f.ix + f.iw - authBtnW - 8;
  const authBtnY = cardY + (cardH - authBtnH) * 0.5;

  UI.drawPillButton(ctx, authBtnX, authBtnY, authBtnW, authBtnH, {
    style: isAuth ? 'equipped' : 'cta',
    icon: isAuth ? 'icon_id_card' : '',
    sprites,
    iconSize: 14,
    text: isAuth ? '已绑名片' : '绑定名片',
    fontSize: 10.5,
    radius: 10
  });
  app.userInfoBtnRect = { x: authBtnX, y: authBtnY, w: authBtnW, h: authBtnH };
  hits.add('career_auth_btn', authBtnX, authBtnY, authBtnW, authBtnH, () => app.onTapCareerAuthFallback());

  const infoX = f.ix + 54;
  const infoW = Math.max(80, authBtnX - infoX - 8);
  const dispName = app.getPlayerDisplayName ? app.getPlayerDisplayName() : '星夜店长';
  UI.drawFitText(ctx, dispName, infoX, cardY + 17, infoW, 12.8, 10, 900, '#4A2C2A');

  const cs = app.cloudState || { status: 'idle', syncing: false };
  let syncIcon = 'icon_local_save';
  let syncLine = '本地存档';
  let syncColor = '#724640';
  if (cs.syncing) {
    syncIcon = 'icon_cloud';
    syncLine = '云端同步中…';
    syncColor = '#8a5222';
  } else if (cs.status === 'retry_pending') {
    syncIcon = 'icon_cloud';
    syncLine = '网络波动 · 待自动重连同步…';
    syncColor = '#a35610';
  } else if (cs.status === 'synced') {
    syncIcon = 'icon_cloud';
    syncLine = isAuth ? '云端已同步 · 已展示全服榜' : '云端已备份';
    syncColor = '#2d6a43';
  }
  UI.drawUiIcon(ctx, sprites, syncIcon, infoX + 6, cardY + 35.5, 13);
  UI.drawFitText(ctx, syncLine, infoX + 16, cardY + 36, infoW - 16, 9.6, 8.0, 700, syncColor);

  // 2. Career Sub-Tabs ('stats' | 'rank')
  const tabY = cardY + cardH + 6;
  const tabH = 29;
  const tabGap = 8;
  const tabW = (f.iw - tabGap) * 0.5;
  const isRankTab = app.activeCareerTab === 'rank';

  UI.drawPillButton(ctx, f.ix, tabY, tabW, tabH, {
    style: !isRankTab ? 'active' : 'wood',
    icon: 'icon_book',
    sprites,
    iconSize: 16,
    text: '履历勋章',
    fontSize: 11.2,
    radius: 9
  });
  hits.add('career_tab_stats', f.ix, tabY, tabW, tabH, () => app.setCareerTab('stats'));

  UI.drawPillButton(ctx, f.ix + tabW + tabGap, tabY, tabW, tabH, {
    style: isRankTab ? 'active' : 'wood',
    icon: 'icon_trophy',
    sprites,
    iconSize: 16,
    text: '排行榜',
    fontSize: 11.2,
    radius: 9
  });
  hits.add('career_tab_rank', f.ix + tabW + tabGap, tabY, tabW, tabH, () => app.setCareerTab('rank'));

  const contentTopY = tabY + tabH + 7;

  // 3A. Tab: Global Chef Leaderboard
  if (isRankTab) {
    const subH = 26;
    const refreshW = 54;
    const modeGap = 6;
    const modeBtnW = (f.iw - refreshW - modeGap * 2) * 0.5;
    const lbMode = app.leaderboardMode === 'rush' ? 'rush' : 'chef';
    const lb = app.leaderboardState || { loading: false, list: [], myRank: null, myScore: 0, isLocalFallback: true };

    UI.drawPillButton(ctx, f.ix, contentTopY, modeBtnW, subH, {
      style: lbMode === 'chef' ? 'cta' : 'wood',
      icon: 'mode_chef',
      sprites,
      iconSize: 15,
      text: '主厨榜',
      fontSize: 10.8,
      radius: 8
    });
    hits.add('rank_mode_chef', f.ix, contentTopY, modeBtnW, subH, () => app.setLeaderboardMode('chef'));

    UI.drawPillButton(ctx, f.ix + modeBtnW + modeGap, contentTopY, modeBtnW, subH, {
      style: lbMode === 'rush' ? 'cta' : 'wood',
      icon: 'mode_rush',
      sprites,
      iconSize: 15,
      text: '狂欢榜',
      fontSize: 10.8,
      radius: 8
    });
    hits.add('rank_mode_rush', f.ix + modeBtnW + modeGap, contentTopY, modeBtnW, subH, () => app.setLeaderboardMode('rush'));

    const refX = f.ix + f.iw - refreshW;
    UI.drawPillButton(ctx, refX, contentTopY, refreshW, subH, {
      style: 'wood',
      icon: 'icon_restart',
      sprites,
      iconSize: 14,
      text: lb.loading ? '…' : '刷新',
      fontSize: 10,
      radius: 8
    });
    hits.add('rank_refresh', refX, contentTopY, refreshW, subH, () => app.fetchLeaderboard(true));

    // Pinned My Rank Footer
    const myBarH = 34;
    const myBarY = f.iy + f.ih - myBarH;
    UI.drawKissaCard(ctx, f.ix, myBarY, f.iw, myBarH, { tone: 'equipped', radius: 9 });
    const myRankTxt = lb.myRank ? `我的排名：第 ${lb.myRank} 名` : '我的排名：未上榜';
    const myScoreTxt = lbMode === 'chef' ? `¥${lb.myScore || 0}` : `${lb.myScore || 0} 分`;
    UI.drawFitText(ctx, myRankTxt, f.ix + 10, myBarY + myBarH * 0.5, f.iw * 0.56, 11, 9, 900, '#2b5839');
    UI.drawFitText(ctx, myScoreTxt, f.ix + f.iw - 10, myBarY + myBarH * 0.5, f.iw * 0.4, 11.5, 9, 900, '#8a4314', 'right');

    // Scrollable Leaderboard Rows
    const noteY = contentTopY + subH + 4;
    const noteIcon = lb.loading || !lb.isLocalFallback ? 'icon_cloud' : 'icon_trophy';
    const noteTxt = lb.loading
      ? '同步全服成绩中…'
      : lb.isLocalFallback
      ? '店内标杆陪练榜'
      : '全服实时榜 · 前 50 名（含店内陪练标杆）';
    UI.drawUiIcon(ctx, sprites, noteIcon, f.ix + 8, noteY + 6, 13);
    UI.drawFitText(ctx, noteTxt, f.ix + 18, noteY + 6.5, f.iw - 20, 9.5, 8.0, 700, '#7c5540');

    const listY = noteY + 15;
    const listH = Math.max(70, myBarY - 6 - listY);
    const clipRect = { x: f.ix - 2, y: listY, w: f.iw + 4, h: listH };
    app.modalScrollRect = clipRect;

    const rows = lb.list || [];
    const rowH = 40;
    const rowGap = 5;
    const totalH = Math.max(listH, rows.length * (rowH + rowGap));
    app.modalMaxScroll = Math.max(0, totalH - listH);
    app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

    beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ry = listY + i * (rowH + rowGap);
      if (ry + rowH < listY + app.modalScrollY - 10 || ry > listY + app.modalScrollY + listH + 10) {
        continue;
      }
      const tone = r.isMe ? 'equipped' : r.rank <= 3 ? 'amber' : 'cream';
      UI.drawKissaCard(ctx, f.ix, ry, f.iw - 6, rowH, { tone, radius: 9 });

      if (r.rank >= 1 && r.rank <= 3) {
        UI.drawUiIcon(ctx, sprites, `icon_medal_${r.rank}`, f.ix + 19, ry + rowH * 0.5, 24);
      } else {
        UI.drawFitText(ctx, String(r.rank), f.ix + 19, ry + rowH * 0.5, 28, 11.5, 9.5, 900, '#6c493a', 'center');
      }

      const rAvImg = app.getPlayerAvatarImg ? app.getPlayerAvatarImg(r.avatarUrl, r.avatarPreset) : sprites.patrons.mikan;
      drawCircularAvatar(ctx, rAvImg, f.ix + 48, ry + rowH * 0.5, 14, '#fff7e2', '#9c6e3b');

      const scoreStr = lbMode === 'chef' ? `¥${r.score || 0}` : `${r.score || 0}`;
      const scoreW = 74;
      const nameX = f.ix + 68;
      const npcBadgeW = r.isNpc ? 34 : 0;
      const nameMaxW = Math.max(54, f.iw - 6 - scoreW - 76 - (npcBadgeW ? npcBadgeW + 6 : 0));
      const titleTag = r.isMe ? `${r.nickName} (我)` : r.nickName;
      UI.drawFitText(ctx, titleTag, nameX, ry + 14, nameMaxW, 11.5, 9.2, 900, '#4A2C2A');
      if (r.isNpc) {
        ctx.font = UI.fontStr(11.5, 900);
        const drawnW = Math.min(nameMaxW, ctx.measureText(titleTag).width);
        UI.drawTagBadge(ctx, nameX + drawnW + 5, ry + 6, npcBadgeW, 15, '陪练', 'soft', 8.0);
      }

      const subDesc =
        lbMode === 'chef'
          ? `第${r.bestShiftReached || 1}幕 · ${getChefRank(r.score || 0)}`
          : getChefRank(r.score || 0);
      UI.drawFitText(ctx, subDesc, nameX, ry + 29, nameMaxW + npcBadgeW, 9.2, 7.8, 700, '#7a5240');

      UI.drawFitText(ctx, scoreStr, f.ix + f.iw - 16, ry + rowH * 0.5, scoreW, 13, 10, 900, '#9a4316', 'right');
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
    return;
  }

  // 3B. Tab: Career Stats & Achievements
  const bodyY = contentTopY;
  const bodyH = Math.max(90, f.iy + f.ih - bodyY);
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const achCols = f.iw >= 480 ? 3 : 2;
  const achRows = Math.ceil(ACHIEVEMENTS.length / achCols);
  const totalH = 66 + 8 + 56 + 24 + achRows * 58;
  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);

  // 3 Mode Best Tiles with Illustrated Mode Icons
  const mTiles = [
    { icon: 'mode_chef', label: '主厨', val: saveData.bestChef || 0 },
    { icon: 'mode_rush', label: '90秒', val: saveData.bestRush || 0 },
    { icon: 'mode_zen', label: '悠闲', val: saveData.bestZen || 0 }
  ];
  const mW = (f.iw - 16) / 3;
  for (let i = 0; i < 3; i++) {
    const mx = f.ix + i * (mW + 6);
    UI.drawKissaCard(ctx, mx, bodyY, mW, 56, { tone: 'cream', radius: 10 });
    UI.drawUiIcon(ctx, sprites, mTiles[i].icon, mx + 18, bodyY + 17, 20);
    UI.drawFitText(ctx, mTiles[i].label, mx + 32, bodyY + 17, mW - 38, 10.5, 8.5, 800, '#724640');
    UI.drawFitText(ctx, String(mTiles[i].val), mx + mW * 0.5, bodyY + 39, mW - 10, 17, 12, 900, '#4A2C2A', 'center');
  }

  // 5 Lifetime Stats Row
  const sy = bodyY + 64;
  const lStats = [
    { label: '最高幕', val: `第${st.bestShiftReached || 0}幕` },
    { label: '局数', val: String(st.runsPlayed || 0) },
    { label: '订单', val: String(st.ordersCompleted || 0) },
    { label: '连击', val: `${st.maxComboEver || 1}x` },
    { label: '猫神', val: String(st.soufflesMade || 0) }
  ];
  const sW = (f.iw - 28) / 5;
  for (let i = 0; i < 5; i++) {
    const sx = f.ix + i * (sW + 5);
    UI.drawKissaCard(ctx, sx, sy, sW, 44, { tone: 'soft', radius: 8 });
    UI.drawFitText(ctx, lStats[i].label, sx + sW * 0.5, sy + 13, sW - 6, 9.5, 7.5, 700, '#724640', 'center');
    UI.drawFitText(ctx, lStats[i].val, sx + sW * 0.5, sy + 31, sW - 6, 12.5, 9.5, 900, '#4A2C2A', 'center');
  }

  // Achievements Grid
  const ay = sy + 54;
  UI.drawFitText(ctx, '店铺勋章', f.ix, ay + 8, f.iw, 12, 10, 900, '#4A2C2A');
  const aw = (f.iw - 8 - (achCols - 1) * 7) / achCols;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const ach = ACHIEVEMENTS[i];
    const done = ach.check(saveData);
    const col = i % achCols;
    const row = Math.floor(i / achCols);
    const cx = f.ix + col * (aw + 7);
    const cy = ay + 20 + row * 56;
    ctx.save();
    if (!done) ctx.globalAlpha = 0.72;
    UI.drawKissaCard(ctx, cx, cy, aw, 50, { tone: done ? 'amber' : 'soft', radius: 10 });
    if (sprites.base[ach.tierImg]) {
      if (!done) ctx.globalAlpha = 0.35;
      UI.drawContainImage(ctx, sprites.base[ach.tierImg], cx + 22, cy + 25, 28, 28);
    }
    ctx.restore();
    UI.drawFitText(ctx, ach.name, cx + 40, cy + 16, aw - 46, 11.5, 9.5, 900, done ? '#6b3508' : '#4A2C2A');
    UI.drawFitText(ctx, ach.desc, cx + 40, cy + 34, aw - 46, 9.6, 8, 600, '#724640');
  }

  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderHelpModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 640, metrics.height * 0.80, hits);
  const { sprites } = app;

  drawModalHeader(ctx, f, sprites, 'icon_help', '玩法速查', null, 38);
  drawCloseButton(ctx, f, hits, app);

  // Quick-Launch Mode Guides Bar
  const gBarY = f.iy + 36;
  const gBarH = 30;
  const gModes = [
    { id: 'chef', icon: 'mode_chef', text: '主厨指引' },
    { id: 'rush', icon: 'mode_rush', text: '狂欢指引' },
    { id: 'zen', icon: 'mode_zen', text: '悠闲指引' }
  ];
  const gBtnW = (f.iw - 12) / 3;
  for (let i = 0; i < gModes.length; i++) {
    const gm = gModes[i];
    const gx = f.ix + i * (gBtnW + 6);
    UI.drawPillButton(ctx, gx, gBarY, gBtnW, gBarH, {
      style: 'active',
      icon: gm.icon,
      sprites,
      iconSize: 17,
      text: gm.text,
      fontSize: 11,
      radius: 9
    });
    hits.add(`help_guide_${gm.id}`, gx, gBarY, gBtnW, gBarH, () => app.openModeGuide(gm.id, 0));
  }

  const cards = [
    {
      icon: 'icon_launcher',
      title: '定角真弹壁',
      lines: [
        '• 中央恒速发射，拖动调角预览落点，上滑取消',
        '• 首碰侧壁反弹合成享 ×1.5 弹壁奖（轻点发射零误触）'
      ]
    },
    {
      icon: 'serve_bell',
      title: '独立上菜与热冷博弈',
      lines: [
        '• 点订单【上菜】按钮或长按罐内亮铃甜品出餐',
        '• 趁热免步，冷单耗1步（引发抽底雪崩立返1步！）'
      ]
    },
    {
      icon: 'icon_alchemy',
      title: '异能、星露与招牌技',
      lines: [
        '• 局内赚星露补摇罐/升阶勺，打烊结算永久星尘',
        '• 上菜蓄满底部头像释放伙伴专属主动技'
      ]
    },
    {
      icon: 'icon_shop',
      title: '热炉跨幕与18秘方共鸣',
      lines: [
        '• 罐内甜品跨幕保留传承，整备间购秘方与改造',
        '• 同标签 2/3 件秘方激活 #雪崩/#弹壁/#异能/#贪婪 共鸣'
      ]
    }
  ];

  const bodyY = gBarY + gBarH + 8;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const isWide = f.iw >= 500;
  const cols = isWide ? 2 : 1;
  const cardW = (f.iw - 10 - (cols - 1) * 9) / cols;
  const cardH = isWide ? 104 : 84;
  const rows = Math.ceil(cards.length / cols);
  const totalH = rows * cardH + (rows - 1) * 8;
  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  for (let i = 0; i < cards.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = f.ix + col * (cardW + 9);
    const cy = bodyY + row * (cardH + 8);
    UI.drawKissaCard(ctx, cx, cy, cardW, cardH, { tone: 'cream', radius: 10 });
    UI.drawUiIcon(ctx, sprites, cards[i].icon, cx + 19, cy + 17, 20);
    UI.drawFitText(ctx, cards[i].title, cx + 33, cy + 17, cardW - 43, 12.5, 10, 900, '#4A2C2A');
    let ly = cy + 32;
    for (let j = 0; j < cards[i].lines.length; j++) {
      ly += UI.drawWrappedText(ctx, cards[i].lines[j], cx + 10, ly, cardW - 20, 14, UI.fontStr(10.2, 600), '#724640', 'left', 2) + 3;
    }
  }
  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderCompendiumModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 660, metrics.height * 0.84, hits);
  const { saveData, sprites } = app;

  drawModalHeader(
    ctx,
    f,
    sprites,
    'icon_book',
    `甜品图鉴 ${saveData.unlockedTiers.length}/9`,
    null,
    38
  );
  drawCloseButton(ctx, f, hits, app);

  const bodyY = f.iy + 36;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const cols = f.iw >= 500 ? 3 : 2;
  const gap = 8;
  const cardW = (f.iw - 8 - (cols - 1) * gap) / cols;
  const cardH = 128;
  const rows = Math.ceil(TIERS.length / cols);
  const totalH = rows * cardH + (rows - 1) * gap;
  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i];
    const unlocked = saveData.unlockedTiers.includes(t.tier);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = f.ix + col * (cardW + gap);
    const cy = bodyY + row * (cardH + gap);

    ctx.save();
    UI.drawKissaCard(ctx, cx, cy, cardW, cardH, {
      tone: unlocked ? 'cream' : 'soft',
      radius: 10
    });
    UI.drawFitText(ctx, `T${t.tier} · +${t.points} / 出+${t.servePoints}`, cx + cardW * 0.5, cy + 12, cardW - 12, 9.2, 7.8, 800, '#8f4e1b', 'center');
    if (sprites.base[t.tier]) {
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.25;
      UI.drawContainImage(ctx, sprites.base[t.tier], cx + cardW * 0.5, cy + 40, 38, 38);
      ctx.restore();
    }
    UI.drawFitText(ctx, unlocked ? t.name : '未解锁', cx + cardW * 0.5, cy + 66, cardW - 12, 11.5, 9.5, 900, '#4A2C2A', 'center');
    if (unlocked && t.traitName) {
      const tagW = Math.min(cardW - 16, 76);
      UI.drawTagBadge(ctx, cx + (cardW - tagW) * 0.5, cy + 75, tagW, 15, t.traitName, 'amber', 8.5);
    }
    UI.drawWrappedText(
      ctx,
      unlocked ? (t.traitDesc || t.lore) : '继续合成解锁',
      cx + 8,
      cy + 94,
      cardW - 16,
      12,
      UI.fontStr(9.3, 600),
      '#724640',
      'left',
      2
    );
    ctx.restore();
  }
  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderBlessingModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 660, metrics.height * 0.78, hits);
  const { gameState, sprites } = app;

  const rem = gameState.pendingBlessings;
  const title = rem > 1 ? `星夜祝福 (${rem})` : '星夜祝福 · 三选一';
  drawModalHeader(ctx, f, sprites, 'icon_gift', title, null, 72);
  drawCloseButton(ctx, f, hits, app, '稍后', 52);

  const choices = gameState.blessingChoices || [];
  const bodyY = f.iy + 38;
  const bodyH = f.iy + f.ih - bodyY;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  const isWide = f.iw >= 520;
  const gap = 9;
  if (isWide) {
    const cw = (f.iw - gap * 2) / 3;
    const ch = Math.min(242, bodyH);
    for (let i = 0; i < choices.length; i++) {
      const b = choices[i];
      const cx = f.ix + i * (cw + gap);
      const curLv = app.getPerkLevel(b.id);
      const nextLv = b.repeatable ? 1 : curLv + 1;
      const lvLabel = b.repeatable ? '即时' : curLv === 0 ? 'Lv.1' : `Lv.${curLv}→${nextLv}`;

      UI.drawPillButton(ctx, cx, bodyY, cw, ch, { style: 'card', radius: 13 });
      ctx.fillStyle = '#fff5cf';
      ctx.beginPath();
      ctx.arc(cx + cw * 0.5, bodyY + 38, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#9c6e3b';
      ctx.stroke();
      UI.drawUiIcon(ctx, sprites, b.icon, cx + cw * 0.5, bodyY + 38, 34);

      UI.drawTagBadge(ctx, cx + cw * 0.5 - 26, bodyY + 70, 52, 17, b.tag, 'amber', 9);
      UI.drawFitText(ctx, b.name, cx + cw * 0.5, bodyY + 98, cw - 16, 14, 11, 900, '#4A2C2A', 'center');
      UI.drawFitText(ctx, lvLabel, cx + cw * 0.5, bodyY + 115, cw - 16, 10.2, 9, 800, '#8f4716', 'center');
      UI.drawWrappedText(ctx, b.desc(nextLv), cx + 12, bodyY + 130, cw - 24, 14.5, UI.fontStr(10.8, 600), '#724640', 'left', 3);
      UI.drawPillButton(ctx, cx + 18, bodyY + ch - 34, cw - 36, 24, { style: 'cta', text: '选择', fontSize: 11.5 });

      hits.add(`blessing_pick_${b.id}`, cx, bodyY, cw, ch, () => app.applyBlessing(b.id));
    }
  } else {
    const ch = Math.min(106, Math.floor((bodyH - gap * 2) / 3));
    for (let i = 0; i < choices.length; i++) {
      const b = choices[i];
      const cy = bodyY + i * (ch + gap);
      const curLv = app.getPerkLevel(b.id);
      const nextLv = b.repeatable ? 1 : curLv + 1;
      const lvLabel = b.repeatable ? '即时' : curLv === 0 ? 'Lv.1' : `Lv.${curLv}→${nextLv}`;

      UI.drawPillButton(ctx, f.ix, cy, f.iw, ch, { style: 'card', radius: 12 });
      ctx.fillStyle = '#fff5cf';
      ctx.beginPath();
      ctx.arc(f.ix + 30, cy + ch * 0.5, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#9c6e3b';
      ctx.stroke();
      UI.drawUiIcon(ctx, sprites, b.icon, f.ix + 30, cy + ch * 0.5, 32);

      const tx = f.ix + 60;
      const tw = f.iw - 70;
      UI.drawFitText(ctx, b.name, tx, cy + 20, tw - 98, 14, 11, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + f.iw - 52, cy + 11, 42, 17, b.tag, 'amber', 8.8);
      UI.drawFitText(ctx, lvLabel, f.ix + f.iw - 58, cy + 20, 56, 10, 8.5, 800, '#8f4716', 'right');
      UI.drawWrappedText(ctx, b.desc(nextLv), tx, cy + 36, tw, 14, UI.fontStr(10.6, 600), '#724640', 'left', 2);

      hits.add(`blessing_pick_${b.id}`, f.ix, cy, f.iw, ch, () => app.applyBlessing(b.id));
    }
  }
}

function addClippedHit(hits, id, x, screenY, w, h, onClick, clipRect) {
  const visTop = Math.max(clipRect.y, screenY);
  const visBot = Math.min(clipRect.y + clipRect.h, screenY + h);
  if (visBot - visTop < 4) return;
  hits.add(id, x, visTop, w, visBot - visTop, onClick, { clipRect });
}

function renderPrepShopModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 680, metrics.height * 0.88, hits);
  const { gameState, sprites } = app;
  const shop = gameState.prepShop;
  if (!shop) return;

  const isWide = f.iw >= 500;
  const nextCfg = getShiftConfig(shop.nextShiftNum);
  const coins = gameState.coins || 0;

  // 1. Sticky Header: Illustrated Icon + Title + Coin Chip + Reroll Button
  const rerollW = isWide ? 88 : 74;
  const coinVal = String(coins);
  const coinW = Math.max(58, 34 + coinVal.length * 8);
  drawModalHeader(ctx, f, sprites, 'icon_shop', '后厨整备间', null, rerollW + coinW + 14);

  const isFreeReroll = shop.rerollCost === 0;
  const canReroll = coins >= shop.rerollCost;
  const rerollX = f.ix + f.iw - rerollW;
  UI.drawPillButton(ctx, rerollX, f.iy + 1, rerollW, 28, {
    style: isFreeReroll ? 'active' : 'wood',
    icon: 'icon_restart',
    sprites,
    iconSize: 15,
    text: isFreeReroll ? '免单' : `刷 ${shop.rerollCost}`,
    fontSize: 11,
    disabled: !canReroll
  });
  hits.add('prep_reroll', rerollX, f.iy + 1, rerollW, 28, () => app.rerollPrepShop());

  const coinX = rerollX - coinW - 6;
  UI.drawCurrencyChip(ctx, coinX, f.iy + 1, coinW, 28, sprites, 'icon_coin', coinVal, {
    style: 'active',
    fontSize: 12
  });

  // 2. Sticky Footer CTA: Launch Next Shift
  const footerH = 42;
  const footerY = f.iy + f.ih - footerH;
  UI.drawPillButton(ctx, f.ix, footerY, f.iw, footerH, {
    style: 'cta',
    icon: 'mode_chef',
    sprites,
    iconSize: 22,
    text: `进入第 ${nextCfg.shift} 幕 · ¥${nextCfg.target}`,
    fontSize: isWide ? 14.5 : 13,
    fontWeight: 900
  });
  hits.add('prep_next_shift', f.ix, footerY, f.iw, footerH, () => app.proceedNextShift());

  // 3. Scrollable Body between Header & Footer
  const bodyY = f.iy + 36;
  const bodyH = footerY - bodyY - 8;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const tipH = shop.showBeginnerTip ? 32 : 0;
  const sum = shop.shiftSummary;
  const receiptH = sum ? 38 : 0;
  const nextPreviewH = 40;
  const equippedH = 82;
  const relicCols = isWide ? 3 : 1;
  const relicGap = 8;
  const relicCardH = isWide ? 156 : 94;
  const relicRows = Math.ceil((shop.relicOffers || []).length / relicCols);
  const relicsSectionH = 20 + relicRows * relicCardH + Math.max(0, relicRows - 1) * relicGap;

  const modCols = isWide ? 2 : 1;
  const modGap = 8;
  const modCardH = isWide ? 82 : 72;
  const modRows = Math.ceil((shop.modOffers || []).length / modCols);
  const modsSectionH = 22 + modRows * modCardH + Math.max(0, modRows - 1) * modGap;

  const totalContentH =
    (tipH > 0 ? tipH + 8 : 0) +
    (receiptH > 0 ? receiptH + 8 : 0) +
    nextPreviewH +
    8 +
    equippedH +
    10 +
    relicsSectionH +
    10 +
    modsSectionH +
    6;
  app.modalMaxScroll = Math.max(0, totalContentH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  let curY = bodyY;

  // 3a-0. First-Time Beginner Tip Strip
  if (tipH > 0) {
    const tipW = f.iw - 6;
    UI.drawKissaCard(ctx, f.ix, curY, tipW, tipH, { tone: 'amber', radius: 9 });
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', f.ix + 16, curY + tipH * 0.5, 19);
    UI.drawFitText(
      ctx,
      '同 #标签 2/3 件激活套装共鸣 · 点槽位半价卖出换秘方',
      f.ix + 31,
      curY + tipH * 0.5,
      tipW - 40,
      10,
      8.2,
      800,
      '#5c3310'
    );
    curY += tipH + 8;
  }

  // 3a. Shift Clear Receipt Banner
  if (sum) {
    UI.drawKissaCard(ctx, f.ix, curY, f.iw - 6, receiptH, { tone: 'amber', radius: 10 });
    let carriedNames = '全新起炉';
    if (sum.carried && sum.carried.length > 0) {
      const sortedCarried = [...sum.carried].sort((a, b) => (b.tier || 0) - (a.tier || 0));
      const topLabels = sortedCarried
        .slice(0, 3)
        .map((c) => `${c.tier}阶${TIERS[c.tier - 1].name}`)
        .join(' + ');
      carriedNames =
        sortedCarried.length > 3 ? `${topLabels} 等共${sortedCarried.length}颗热炉留罐` : topLabels;
    }
    const greedBonusVal = sum.greedBonus || sum.synergyBonusCoins || 0;
    const synSalaryTxt = greedBonusVal > 0 ? ` · #贪婪+${greedBonusVal}` : '';
    UI.drawUiIcon(ctx, sprites, 'icon_coin', f.ix + 17, curY + receiptH * 0.5, 20);
    UI.drawFitText(
      ctx,
      `第${sum.shift}幕过关 · 薪+${sum.baseCoins} 息+${sum.stepInterest}${sum.cleanTip > 0 ? ` 清+${sum.cleanTip}` : ''}${synSalaryTxt}`,
      f.ix + 32,
      curY + 13,
      f.iw - 46,
      10.6,
      8.4,
      900,
      '#6b380a'
    );
    UI.drawFitText(
      ctx,
      `传承：${carriedNames}`,
      f.ix + 32,
      curY + 27,
      f.iw - 46,
      9.8,
      8,
      700,
      '#8b4c14'
    );
    curY += receiptH + 8;
  }

  // 3a-2. Next-Shift Hazard Preview Banner
  {
    const prevW = f.iw - 6;
    const nextHazIds = Array.isArray(shop.nextHazards) ? shop.nextHazards : [];
    const previewBadges = nextHazIds.map((id) => (SHIFT_HAZARDS[id] ? SHIFT_HAZARDS[id].badge : id));
    const leadIcon =
      nextHazIds.length > 0 && SHIFT_HAZARDS[nextHazIds[0]]
        ? SHIFT_HAZARDS[nextHazIds[0]].icon
        : nextCfg.modifier === 'grand_prix'
        ? 'icon_judge'
        : nextCfg.modifier === 'party_events'
        ? 'yarn_ball'
        : nextCfg.shift === 3 || nextCfg.shift >= 5
        ? 'icon_frost'
        : 'mode_chef';
    if (nextCfg.shift === 3 || nextCfg.shift >= 5) previewBadges.push('冰封×2');
    if (nextCfg.modifier === 'grand_prix') previewBadges.push('评委急单');
    if (nextCfg.modifier === 'party_events') previewBadges.push('毛线球');
    const badgeStr = previewBadges.length > 0 ? previewBadges.join(' · ') : '常规幕次';

    UI.drawKissaCard(ctx, f.ix, curY, prevW, nextPreviewH, {
      topCol: '#fcf5f9',
      botCol: '#f2e2ec',
      borderColor: '#9c5278',
      radius: 10
    });
    UI.drawUiIcon(ctx, sprites, leadIcon, f.ix + 17, curY + nextPreviewH * 0.5, 20);
    const leftTitleW = isWide ? prevW * 0.44 : prevW * 0.46;
    UI.drawFitText(
      ctx,
      `下幕 第${nextCfg.shift}幕 · ${nextCfg.name}`,
      f.ix + 31,
      curY + 13,
      leftTitleW,
      10.6,
      8.4,
      900,
      '#592442'
    );
    const pillMaxW = prevW - leftTitleW - 44;
    const pillX = f.ix + prevW - pillMaxW - 8;
    UI.drawTagBadge(ctx, pillX, curY + 5, pillMaxW, 16, badgeStr, 'plum', 8.8);

    UI.drawFitText(ctx, nextCfg.desc, f.ix + 31, curY + 28, prevW - 40, 9.4, 7.8, 600, '#6b3b56');
    curY += nextPreviewH + 8;
  }

  // 3b. Equipped Relics Bar + 4-Archetype Synergy Progress Strip
  const eqW = f.iw - 6;
  const archCounts = app.getArchetypeCounts ? app.getArchetypeCounts() : { cascade: 0, bank: 0, trait: 0, greed: 0 };
  UI.drawKissaCard(ctx, f.ix, curY, eqW, equippedH, { tone: 'soft', radius: 10 });
  UI.drawFitText(
    ctx,
    `已装备 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`,
    f.ix + 9,
    curY + 12,
    eqW * 0.55,
    11,
    9,
    900,
    '#4A2C2A'
  );
  UI.drawFitText(ctx, '点槽半价卖出', f.ix + eqW - 9, curY + 12, eqW * 0.45, 9.2, 7.8, 700, '#8f4e1b', 'right');

  const slotGap = 6;
  const slotW = (eqW - 18 - slotGap * (MAX_RELIC_SLOTS - 1)) / MAX_RELIC_SLOTS;
  const slotY = curY + 22;
  const slotH = 34;
  for (let i = 0; i < MAX_RELIC_SLOTS; i++) {
    const sx = f.ix + 9 + i * (slotW + slotGap);
    const rid = gameState.relics && gameState.relics[i];
    const def = rid ? RELICS.find((r) => r.id === rid) : null;
    const arch = def ? RELIC_ARCHETYPES[def.archetype] : null;
    UI.roundRectPath(ctx, sx, slotY, slotW, slotH, 8);
    ctx.fillStyle = def ? (arch ? arch.bg : '#fff8e2') : '#efe1c6';
    ctx.fill();
    ctx.lineWidth = def ? 1.6 : 1.2;
    ctx.strokeStyle = def ? (arch ? arch.color : '#c48823') : '#bfa278';
    ctx.stroke();

    if (def) {
      const sellVal = Math.floor(def.price * 0.5);
      const icS = isWide ? 20 : 17;
      UI.drawUiIcon(ctx, sprites, def.icon, sx + 5 + icS * 0.5, slotY + slotH * 0.5, icS);
      const tx = sx + 8 + icS;
      const tw = Math.max(24, slotW - icS - 11);
      UI.drawFitText(ctx, def.name, tx, slotY + 12, tw, 10, 7.8, 900, '#4A2C2A');
      const sellTxt = isWide && arch ? `${arch.tag} · 卖+${sellVal}` : `卖+${sellVal}`;
      UI.drawFitText(ctx, sellTxt, tx, slotY + 25, tw, 8.6, 7.2, 800, '#a34814');
      addClippedHit(hits, `prep_sell_${def.id}`, sx, slotY - app.modalScrollY, slotW, slotH, () => app.sellRelic(def.id), clipRect);
    } else {
      UI.drawFitText(ctx, '空槽', sx + slotW * 0.5, slotY + slotH * 0.5, slotW - 6, 9.5, 8, 700, '#9c805e', 'center');
    }
  }

  // 4-Archetype Set Synergy Progress Strip (#雪崩 / #弹壁 / #异能 / #贪婪)
  const archKeys = ['cascade', 'bank', 'trait', 'greed'];
  const synPillY = curY + 60;
  const synPillH = 17;
  for (let ai = 0; ai < archKeys.length; ai++) {
    const ak = archKeys[ai];
    const aDef = RELIC_ARCHETYPES[ak];
    const cnt = archCounts[ak] || 0;
    const px = f.ix + 9 + ai * (slotW + slotGap);
    const activeTier = cnt >= 3 ? 3 : cnt >= 2 ? 2 : 0;
    const lbl = activeTier >= 3 ? `${aDef.tag} 3件` : activeTier === 2 ? `${aDef.tag} 2件` : `${aDef.tag} ${cnt}/2`;
    UI.drawTagBadge(
      ctx,
      px,
      synPillY,
      slotW,
      synPillH,
      lbl,
      activeTier > 0 ? 'amber' : 'soft',
      8.4,
      isWide ? aDef.icon : '',
      sprites
    );
  }
  curY += equippedH + 10;

  // 3c. 3 Relic Offers Shelf (with live #Tag Synergy Callouts)
  UI.drawFitText(ctx, '流派秘方', f.ix, curY + 8, eqW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 20;

  const rCardW = (eqW - relicGap * (relicCols - 1)) / relicCols;
  const fullSlots = (gameState.relics || []).length >= MAX_RELIC_SLOTS;
  for (let i = 0; i < (shop.relicOffers || []).length; i++) {
    const offer = shop.relicOffers[i];
    const def = RELICS.find((r) => r.id === offer.id);
    if (!def) continue;
    const arch = RELIC_ARCHETYPES[def.archetype] || { icon: 'icon_stardust', name: '秘方', tag: '#秘方', color: '#8f4716', bg: '#fff4d8' };
    const synDef = ARCHETYPE_SYNERGIES[def.archetype];
    const curArchCnt = archCounts[def.archetype] || 0;
    const col = i % relicCols;
    const row = Math.floor(i / relicCols);
    const cx = f.ix + col * (rCardW + relicGap);
    const cy = curY + row * (relicCardH + relicGap);
    const bought = !!offer.bought;
    const canBuy = !bought && !fullSlots && coins >= def.price;
    const willHitSyn = !bought && (curArchCnt === 1 || curArchCnt === 2);

    UI.drawKissaCard(ctx, cx, cy, rCardW, relicCardH, {
      tone: bought ? 'equipped' : willHitSyn ? 'selected' : 'cream',
      borderColor: bought ? undefined : arch.color,
      radius: 11
    });

    const tagTxt = `${arch.tag || arch.name} · ${def.rarityLabel}`;
    const tagTone = def.rarity === 'legendary' ? 'amber' : def.rarity === 'rare' ? 'plum' : 'soft';
    UI.drawTagBadge(ctx, cx + 8, cy + 6, Math.min(rCardW - 16, 98), 16, tagTxt, tagTone, 8.4);

    if (willHitSyn && synDef) {
      const synBadgeTxt = curArchCnt === 2 ? '3件质变' : '2件共鸣';
      const sbW = 58;
      UI.drawTagBadge(ctx, cx + rCardW - sbW - 8, cy + 6, sbW, 16, synBadgeTxt, 'amber', 8.2);
    }

    if (isWide) {
      UI.roundRectPath(ctx, cx + 10, cy + 26, 26, 26, 7);
      ctx.fillStyle = arch.bg || '#fff5dc';
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = arch.color || '#c48823';
      ctx.stroke();
      UI.drawUiIcon(ctx, sprites, def.icon, cx + 23, cy + 39, 20);

      UI.drawFitText(ctx, def.name, cx + 42, cy + 39, rCardW - 52, 13, 10, 900, '#4A2C2A');
      UI.drawWrappedText(ctx, def.desc, cx + 10, cy + 56, rCardW - 20, 13, UI.fontStr(9.8, 600), '#6d443a', 'left', willHitSyn ? 3 : 4);
      if (willHitSyn && synDef) {
        UI.drawFitText(
          ctx,
          `共鸣：${curArchCnt === 2 ? synDef.short3 : synDef.short2}`,
          cx + 10,
          cy + relicCardH - 39,
          rCardW - 20,
          9,
          7.6,
          800,
          '#9c4708'
        );
      }
      const bY = cy + relicCardH - 28;
      UI.drawPillButton(ctx, cx + 10, bY, rCardW - 20, 22, {
        style: bought ? 'equipped' : canBuy ? 'cta' : 'wood',
        icon: !bought && !fullSlots ? 'icon_coin' : '',
        sprites,
        iconSize: 14,
        text: bought ? '已装备' : fullSlots ? '已满' : `${def.price} 购买`,
        fontSize: 10.5,
        disabled: !canBuy && !bought
      });
      if (!bought) {
        addClippedHit(hits, `prep_buy_relic_${def.id}`, cx + 10, bY - app.modalScrollY, rCardW - 20, 22, () => app.buyRelic(def.id), clipRect);
      }
    } else {
      const btnW = 76;
      UI.roundRectPath(ctx, cx + 9, cy + 28, 32, 32, 8);
      ctx.fillStyle = arch.bg || '#fff5dc';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = arch.color || '#c48823';
      ctx.stroke();
      UI.drawUiIcon(ctx, sprites, def.icon, cx + 25, cy + 44, 24);

      const tx = cx + 48;
      const tw = rCardW - btnW - 60;
      UI.drawFitText(ctx, def.name, tx, cy + 34, tw, 12.6, 10, 900, '#4A2C2A');
      UI.drawWrappedText(
        ctx,
        def.desc,
        tx,
        cy + 46,
        tw,
        12,
        UI.fontStr(9.5, 600),
        '#6d443a',
        'left',
        willHitSyn ? 2 : 3
      );
      if (willHitSyn && synDef) {
        UI.drawFitText(
          ctx,
          `共鸣：${curArchCnt === 2 ? synDef.short3 : synDef.short2}`,
          cx + 10,
          cy + relicCardH - 12,
          rCardW - btnW - 22,
          8.8,
          7.6,
          800,
          '#9c4708'
        );
      }
      const bX = cx + rCardW - btnW - 8;
      const bY = cy + relicCardH * 0.5 - 12;
      UI.drawPillButton(ctx, bX, bY, btnW, 28, {
        style: bought ? 'equipped' : canBuy ? 'cta' : 'wood',
        icon: !bought && !fullSlots ? 'icon_coin' : '',
        sprites,
        iconSize: 15,
        text: bought ? '已装备' : fullSlots ? '已满' : `${def.price}`,
        fontSize: 11,
        disabled: !canBuy && !bought
      });
      if (!bought) {
        addClippedHit(hits, `prep_buy_relic_${def.id}`, bX, bY - app.modalScrollY, btnW, 28, () => app.buyRelic(def.id), clipRect);
      }
    }
  }
  curY += relicRows * relicCardH + Math.max(0, relicRows - 1) * relicGap + 10;

  // 3d. 2 Deck Sculpting Mod Offers
  UI.drawFitText(ctx, '手牌改造', f.ix, curY + 8, eqW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 22;

  const mCardW = (eqW - modGap * (modCols - 1)) / modCols;
  for (let i = 0; i < (shop.modOffers || []).length; i++) {
    const offer = shop.modOffers[i];
    const def = DECK_MODS.find((m) => m.id === offer.id);
    if (!def) continue;
    const col = i % modCols;
    const row = Math.floor(i / modCols);
    const cx = f.ix + col * (mCardW + modGap);
    const cy = curY + row * (modCardH + modGap);
    const ownedCnt = app.getDeckModCount(def.id);
    const bought = !!offer.bought;
    const maxed = ownedCnt >= def.maxBuy;
    const canBuy = !bought && !maxed && coins >= def.price;

    UI.drawKissaCard(ctx, cx, cy, mCardW, modCardH, { tone: bought ? 'equipped' : 'cream', radius: 10 });
    const btnW = 74;
    UI.roundRectPath(ctx, cx + 9, cy + modCardH * 0.5 - 16, 32, 32, 8);
    ctx.fillStyle = '#fff5dc';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#c49756';
    ctx.stroke();
    UI.drawUiIcon(ctx, sprites, def.icon, cx + 25, cy + modCardH * 0.5, 24);

    const tx = cx + 48;
    const tw = mCardW - btnW - 60;
    const limitTag = def.maxBuy < 10 ? ` (${ownedCnt}/${def.maxBuy})` : '';
    UI.drawFitText(ctx, `${def.name}${limitTag}`, tx, cy + 18, tw, 12, 9.8, 900, '#4A2C2A');
    UI.drawWrappedText(ctx, def.desc, tx, cy + 30, tw, 12.5, UI.fontStr(9.6, 600), '#6d443a', 'left', 3);

    const bX = cx + mCardW - btnW - 8;
    const bY = cy + modCardH * 0.5 - 14;
    UI.drawPillButton(ctx, bX, bY, btnW, 28, {
      style: bought ? 'equipped' : canBuy ? 'active' : 'wood',
      icon: !bought && !maxed ? 'icon_coin' : '',
      sprites,
      iconSize: 15,
      text: bought ? '已购' : maxed ? '上限' : `${def.price}`,
      fontSize: 11,
      disabled: !canBuy && !bought
    });
    if (!bought && !maxed) {
      addClippedHit(hits, `prep_buy_mod_${def.id}`, bX, bY - app.modalScrollY, btnW, 28, () => app.buyDeckMod(def.id), clipRect);
    }
  }

  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderShiftVictoryModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 460, Math.min(460, metrics.height * 0.86), hits);
  const { gameState, sprites } = app;
  const offer = gameState.victoryOffer || {};
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  UI.drawUiIcon(ctx, sprites, 'icon_trophy', f.ix + 20, f.iy + 18, 28);
  UI.drawFitText(ctx, '星冠大赏 · 全通关', f.ix + f.iw * 0.5 + 8, f.iy + 18, f.iw - 36, 18, 13.5, 900, '#7c3c08', 'center');
  UI.drawFitText(
    ctx,
    '深夜五幕已征服，挑战无尽加时或荣耀打烊',
    f.ix + f.iw * 0.5,
    f.iy + 38,
    f.iw - 12,
    11,
    9,
    700,
    '#724640',
    'center'
  );

  // 2x2 Victory Summary Tiles
  const tileW = (f.iw - 8) / 2;
  const tileH = 54;
  const tY1 = f.iy + 54;
  const tY2 = tY1 + tileH + 8;
  const x2 = f.ix + tileW + 8;

  const tiles = [
    { x: f.ix, y: tY1, label: '总营业额', val: `¥${gameState.score}` },
    { x: x2, y: tY1, label: '最高甜品', val: `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}` },
    { x: f.ix, y: tY2, label: '雪崩 / 连击', val: `${gameState.maxAvalancheRun}连 · ${gameState.maxCombo}x` },
    { x: x2, y: tY2, label: '流派构筑', isRelicIcons: true }
  ];
  for (const t of tiles) {
    UI.drawKissaCard(ctx, t.x, t.y, tileW, tileH, { tone: 'cream', radius: 10 });
    UI.drawFitText(ctx, t.label, t.x + tileW * 0.5, t.y + 14, tileW - 10, 10.5, 8.5, 700, '#724640', 'center');
    if (t.isRelicIcons) {
      const rDefs = (gameState.relics || []).map((id) => RELICS.find((r) => r.id === id)).filter(Boolean);
      if (rDefs.length === 0) {
        UI.drawFitText(ctx, '纯净无秘方', t.x + tileW * 0.5, t.y + 37, tileW - 10, 12, 9.5, 800, '#8a684a', 'center');
      } else {
        const icS = 22;
        const gap = 6;
        const rowW = rDefs.length * icS + (rDefs.length - 1) * gap;
        const startX = t.x + (tileW - rowW) * 0.5 + icS * 0.5;
        for (let i = 0; i < rDefs.length; i++) {
          UI.drawUiIcon(ctx, sprites, rDefs[i].icon, startX + i * (icS + gap), t.y + 37, icS);
        }
      }
    } else {
      UI.drawFitText(ctx, t.val, t.x + tileW * 0.5, t.y + 37, tileW - 10, 14.5, 10, 900, '#4A2C2A', 'center');
    }
  }

  // Trophy Stardust Preview Box
  const py = tY2 + tileH + 10;
  UI.drawKissaCard(ctx, f.ix, py, f.iw, 52, { tone: 'amber', radius: 11 });
  UI.drawUiIcon(ctx, sprites, 'icon_stardust', f.ix + 18, py + 17, 18);
  UI.drawFitText(ctx, '已锁定通关星尘（含 +40 完赛奖）', f.ix + 31, py + 17, f.iw - 41, 11.2, 9, 800, '#6b3b0c');
  UI.drawFitText(
    ctx,
    `当前可得 +${offer.stardustPreview || 140} 星尘（进无尽可继续叠加）`,
    f.ix + 10,
    py + 36,
    f.iw - 20,
    10.8,
    8.8,
    900,
    '#a64d00'
  );

  // Two Big Choice Buttons
  const actY = f.iy + f.ih - 90;
  UI.drawPillButton(ctx, f.ix, actY, f.iw, 42, {
    style: 'cta',
    icon: 'mode_rush',
    sprites,
    iconSize: 22,
    text: '无尽加时 · 第6幕',
    fontSize: 13.8,
    fontWeight: 900
  });
  hits.add('victory_endless', f.ix, actY, f.iw, 42, () => app.enterEndlessOvertime());

  UI.drawPillButton(ctx, f.ix, actY + 50, f.iw, 38, {
    style: 'wood',
    icon: 'icon_home',
    sprites,
    iconSize: 20,
    text: '荣耀打烊 · 领星尘',
    fontSize: 12.8
  });
  hits.add('victory_finish', f.ix, actY + 50, f.iw, 38, () => app.finishVictoryRun());
}

function renderRelicsModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 560, metrics.height * 0.8, hits);
  const { gameState, sprites } = app;
  const shiftCfg = getShiftConfig(gameState.shift);

  drawModalHeader(
    ctx,
    f,
    sprites,
    'mode_chef',
    `流派与机关 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`,
    null,
    46
  );
  drawCloseButton(ctx, f, hits, app);

  const bodyY = f.iy + 38;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  // Build dynamic active shift hazards & Boss affixes list
  const shiftAffixes = [];
  const activeHazIds = Array.isArray(gameState.shiftHazards) ? gameState.shiftHazards : [];
  for (const hid of activeHazIds) {
    const hDef = SHIFT_HAZARDS[hid];
    if (!hDef) continue;
    shiftAffixes.push({
      icon: hDef.icon,
      title: hDef.name,
      status: '生效中',
      tone: 'amber',
      desc: hDef.desc,
      color: hDef.color,
      bg: hDef.bg
    });
  }
  const frozenAlive = (gameState.entities || []).filter((e) => e && !e.merged && e.frozenHp > 0).length;
  if (gameState.mode === 'chef' && (gameState.shift === 3 || gameState.shift >= 5 || frozenAlive > 0)) {
    shiftAffixes.push({
      icon: 'icon_frost',
      title: '冰封甜品',
      status: frozenAlive > 0 ? `剩 ${frozenAlive} 颗` : '已破冰',
      tone: 'frost',
      desc: '周边合成、重锤或摇罐破冰，爆 +¥120',
      color: '#2c6d8a',
      bg: '#ebf7fc'
    });
  }
  if (gameState.mode === 'chef' && gameState.shiftModifier === 'grand_prix') {
    const hasActiveRush = (gameState.orders || []).some((o) => o && !o.completed && o.isJudgeRush);
    const stepsToJudge = 6 - ((gameState.shiftStepsUsed || 0) % 6);
    shiftAffixes.push({
      icon: 'icon_judge',
      title: '评委急单',
      status: hasActiveRush ? '进行中' : `${stepsToJudge}步后`,
      tone: 'berry',
      desc: '每6步空降VIP急单，4步内出餐 ×2.5 且返+2步',
      color: '#a35610',
      bg: '#fff3d6'
    });
  } else if (gameState.mode === 'chef' && gameState.shiftModifier === 'party_events') {
    shiftAffixes.push({
      icon: 'yarn_ball',
      title: '猫猫派对',
      status: '6/12步流星',
      tone: 'plum',
      desc: '含捣蛋毛线球（震碎+¥750 & +10币），6/12步触发流星镀金夜',
      color: '#9c426d',
      bg: '#fcedf4'
    });
  }

  const activeSynergies = app.getActiveSynergies ? app.getActiveSynergies() : [];
  const equipped = (gameState.relics || []).map((id) => RELICS.find((r) => r.id === id)).filter(Boolean);
  const activeMods = DECK_MODS.filter((m) => app.getDeckModCount(m.id) > 0);

  const affixSectionH = shiftAffixes.length > 0 ? 22 + shiftAffixes.length * 60 + 6 : 0;
  const synergySectionH = activeSynergies.length > 0 ? 22 + activeSynergies.length * 58 + 6 : 0;
  const equippedSectionH = 22 + (equipped.length === 0 ? 58 : equipped.length * 64);
  const modsSectionH = 22 + (activeMods.length === 0 ? 26 : activeMods.length * 44);
  const totalH = 58 + affixSectionH + synergySectionH + equippedSectionH + modsSectionH + 12;

  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  let curY = bodyY;
  const cardW = f.iw - 6;

  // Current Shift Info Card
  UI.drawKissaCard(ctx, f.ix, curY, cardW, 48, { tone: 'amber', radius: 10 });
  UI.drawFitText(ctx, `第 ${shiftCfg.shift} 幕 · ${shiftCfg.name}（目标 ¥${gameState.shiftTarget}）`, f.ix + 10, curY + 14, cardW - 20, 12, 9.5, 900, '#4A2C2A');
  UI.drawFitText(ctx, shiftCfg.desc, f.ix + 10, curY + 32, cardW - 20, 9.8, 8, 600, '#7a491c');
  curY += 58;

  // Active Shift Hazards & Boss Affixes Section
  if (shiftAffixes.length > 0) {
    UI.drawFitText(ctx, '本幕机关', f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
    curY += 22;
    for (const af of shiftAffixes) {
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 54, {
        topCol: af.bg || '#fffaf0',
        botCol: '#fffdf8',
        borderColor: af.color || '#c48823',
        radius: 10
      });
      UI.drawUiIcon(ctx, sprites, af.icon, f.ix + 21, curY + 27, 26);
      const pillW = 64;
      UI.drawFitText(ctx, af.title, f.ix + 40, curY + 15, cardW - pillW - 54, 11.8, 9.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + cardW - pillW - 8, curY + 7, pillW, 16, af.status, af.tone || 'amber', 8.6);
      UI.drawWrappedText(ctx, af.desc, f.ix + 40, curY + 27, cardW - 50, 12, UI.fontStr(9.5, 600), '#5f3b28', 'left', 2);
      curY += 60;
    }
    curY += 6;
  }

  // Active Archetype Set Synergies Section
  if (activeSynergies.length > 0) {
    UI.drawFitText(ctx, '已激活共鸣', f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
    curY += 22;
    for (const syn of activeSynergies) {
      const aDef = RELIC_ARCHETYPES[syn.id] || { icon: 'icon_stardust', name: '共鸣', color: '#c48823' };
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 52, {
        tone: 'selected',
        borderColor: aDef.color,
        radius: 10
      });
      UI.drawUiIcon(ctx, sprites, aDef.icon, f.ix + 21, curY + 26, 24);
      UI.drawFitText(ctx, `${syn.def.tag} · ${aDef.name}`, f.ix + 40, curY + 15, cardW - 118, 11.8, 9.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + cardW - 72, curY + 7, 64, 16, `${syn.tier}件生效`, 'amber', 8.6);
      const synDesc = syn.tier >= 3 ? `${syn.def.short2} · ${syn.def.short3}` : syn.def.tier2Desc;
      UI.drawWrappedText(ctx, synDesc, f.ix + 40, curY + 26, cardW - 50, 12, UI.fontStr(9.4, 700), '#6b380a', 'left', 2);
      curY += 58;
    }
    curY += 6;
  }

  // Equipped Relics List
  UI.drawFitText(ctx, `已装备秘方 (${equipped.length}/${MAX_RELIC_SLOTS})`, f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 22;
  if (equipped.length === 0) {
    UI.drawKissaCard(ctx, f.ix, curY, cardW, 50, { tone: 'soft', radius: 10 });
    UI.drawFitText(ctx, '尚未装备秘方', f.ix + cardW * 0.5, curY + 18, cardW - 20, 12, 10, 800, '#724640', 'center');
    UI.drawFitText(ctx, '通关当前幕次后在整备间选购，同#标签激活共鸣', f.ix + cardW * 0.5, curY + 35, cardW - 20, 9.8, 8.2, 600, '#8f5b34', 'center');
    curY += 58;
  } else {
    for (const def of equipped) {
      const arch = RELIC_ARCHETYPES[def.archetype] || { icon: 'icon_stardust', name: '秘方', tag: '#秘方', color: '#8f4716', bg: '#fff4d8' };
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 58, { borderColor: arch.color, radius: 10 });
      UI.roundRectPath(ctx, f.ix + 9, curY + 13, 32, 32, 8);
      ctx.fillStyle = arch.bg || '#fff5dc';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = arch.color || '#c48823';
      ctx.stroke();
      UI.drawUiIcon(ctx, sprites, def.icon, f.ix + 25, curY + 29, 24);
      UI.drawFitText(ctx, def.name, f.ix + 48, curY + 16, cardW - 122, 12, 9.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + cardW - 68, curY + 8, 60, 16, `${arch.tag || arch.name}`, 'amber', 8.6);
      UI.drawWrappedText(ctx, def.desc, f.ix + 48, curY + 28, cardW - 58, 12.5, UI.fontStr(9.8, 600), '#6d443a', 'left', 2);
      curY += 64;
    }
  }

  // Active Deck Mods
  UI.drawFitText(ctx, '手牌改造', f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 22;
  if (activeMods.length === 0) {
    UI.drawFitText(ctx, '暂无改造（整备间可购买）', f.ix + 6, curY + 10, cardW - 12, 10.2, 8.8, 600, '#8a684a');
  } else {
    for (const m of activeMods) {
      const cnt = app.getDeckModCount(m.id);
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 38, { tone: 'soft', radius: 8 });
      UI.drawUiIcon(ctx, sprites, m.icon, f.ix + 20, curY + 19, 22);
      UI.drawFitText(ctx, `${m.name} ×${cnt}`, f.ix + 38, curY + 13, cardW - 48, 11, 9, 800, '#4A2C2A');
      UI.drawFitText(ctx, m.desc, f.ix + 38, curY + 27, cardW - 48, 9.4, 8, 600, '#724640');
      curY += 44;
    }
  }

  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderGameOverModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 450, Math.min(468, metrics.height * 0.85), hits);
  const { gameState, goSettlement, sprites } = app;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  // Head
  const reason = (goSettlement && goSettlement.reason) || gameState.runEndReason;
  const headerIcon =
    reason === 'victory' ? 'icon_trophy' : gameState.mode === 'rush' ? 'mode_rush' : 'mode_chef';
  const title =
    reason === 'victory'
      ? '星冠大赏 · 打烊'
      : reason === 'shift_failed'
      ? `第 ${gameState.shift} 幕未达标`
      : gameState.mode === 'rush' && gameState.rushFinished
      ? '90秒结算'
      : '打烊总结';

  const rankTxt = getChefRank(gameState.score);
  const rankW = Math.min(114, Math.max(76, rankTxt.length * 9.5 + 16));
  drawModalHeader(ctx, f, sprites, headerIcon, title, null, rankW + 8);
  UI.drawTagBadge(ctx, f.ix + f.iw - rankW, f.iy + 4, rankW, 22, rankTxt, 'amber', 9.6);

  // 4 Stat Tiles (2x2)
  const tileW = (f.iw - 8) / 2;
  const tileH = 54;
  const tY1 = f.iy + 38;
  const tY2 = tY1 + tileH + 8;

  // Tile 1: Score / Cumulative Revenue + inline New Best
  UI.drawKissaCard(ctx, f.ix, tY1, tileW, tileH, { tone: 'cream', radius: 10 });
  UI.drawFitText(ctx, gameState.mode === 'chef' ? '总营业额' : '本局得分', f.ix + tileW * 0.5, tY1 + 14, tileW - 12, 10.8, 9, 700, '#724640', 'center');
  const sStr = gameState.mode === 'chef' ? `¥${gameState.score}` : String(gameState.score);
  if (goSettlement && goSettlement.isNewBest) {
    ctx.font = UI.fontStr(18, 900);
    const sw = ctx.measureText(sStr).width;
    const totalW = sw + 48;
    const sx = f.ix + tileW * 0.5 - totalW * 0.5;
    ctx.fillStyle = '#4A2C2A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sStr, sx, tY1 + 37);
    UI.drawTagBadge(ctx, sx + sw + 5, tY1 + 28, 43, 17, '新纪录', 'berry', 8.6);
  } else {
    UI.drawFitText(ctx, sStr, f.ix + tileW * 0.5, tY1 + 37, tileW - 12, 19, 13, 900, '#4A2C2A', 'center');
  }

  // Tile 2: Best Score or Shift Cleared Progress
  const x2 = f.ix + tileW + 8;
  UI.drawKissaCard(ctx, x2, tY1, tileW, tileH, { tone: 'cream', radius: 10 });
  if (gameState.mode === 'chef') {
    UI.drawFitText(ctx, '闯关进度', x2 + tileW * 0.5, tY1 + 14, tileW - 12, 10.5, 8.5, 700, '#724640', 'center');
    UI.drawFitText(
      ctx,
      `第${gameState.shift}幕 · 通关${gameState.shiftsClearedThisRun}幕`,
      x2 + tileW * 0.5,
      tY1 + 37,
      tileW - 12,
      13.5,
      10,
      900,
      '#4A2C2A',
      'center'
    );
  } else {
    UI.drawFitText(ctx, '最高纪录', x2 + tileW * 0.5, tY1 + 14, tileW - 12, 10.8, 9, 700, '#724640', 'center');
    UI.drawFitText(ctx, String(app.getBestScore()), x2 + tileW * 0.5, tY1 + 37, tileW - 12, 19, 13, 900, '#4A2C2A', 'center');
  }

  // Tile 3: Max Tier
  UI.drawKissaCard(ctx, f.ix, tY2, tileW, tileH, { tone: 'cream', radius: 10 });
  UI.drawFitText(ctx, '最高甜品', f.ix + tileW * 0.5, tY2 + 14, tileW - 12, 10.8, 9, 700, '#724640', 'center');
  UI.drawFitText(ctx, `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}`, f.ix + tileW * 0.5, tY2 + 37, tileW - 12, 12.5, 9.5, 900, '#4A2C2A', 'center');

  // Tile 4: Relics/Orders or Rush Combo/Yarn
  UI.drawKissaCard(ctx, x2, tY2, tileW, tileH, { tone: 'cream', radius: 10 });
  const fourthLabel =
    gameState.mode === 'rush'
      ? '连击 / 线团'
      : gameState.mode === 'chef'
      ? '上菜 / 雪崩'
      : '订单 / 连击';
  const fourthVal =
    gameState.mode === 'rush'
      ? `${gameState.maxCombo}x · ${gameState.yarnBrokenThisRun}颗`
      : gameState.mode === 'chef'
      ? `${gameState.servesCompleted}次 · ${gameState.maxAvalancheRun}连`
      : `${gameState.ordersCompleted}单 · ${gameState.maxCombo}x`;
  UI.drawFitText(ctx, fourthLabel, x2 + tileW * 0.5, tY2 + 14, tileW - 12, 10.5, 8.5, 700, '#724640', 'center');
  UI.drawFitText(ctx, fourthVal, x2 + tileW * 0.5, tY2 + 37, tileW - 12, 14, 10, 900, '#4A2C2A', 'center');

  // Permanent Stardust Bank Deposit Card
  const by = tY2 + tileH + 10;
  const bh = goSettlement && goSettlement.hasAffordable ? 74 : 58;
  UI.drawKissaCard(ctx, f.ix, by, f.iw, bh, { tone: 'amber', radius: 11 });
  UI.drawUiIcon(ctx, sprites, 'icon_stardust', f.ix + 18, by + 16, 18);
  UI.drawFitText(ctx, '星尘入账', f.ix + 30, by + 16, f.iw * 0.52, 12.5, 10, 800, '#6b3b0c');
  UI.drawFitText(ctx, `+${goSettlement ? goSettlement.finalEarned : 0}`, f.ix + f.iw - 10, by + 16, f.iw * 0.36, 17, 13, 900, '#a64d00', 'right');
  UI.drawWrappedText(
    ctx,
    (goSettlement && goSettlement.detailText) || '',
    f.ix + 10,
    by + 28,
    f.iw - 20,
    13,
    UI.fontStr(10.2, 700),
    '#7c4d1b',
    'left',
    2
  );
  if (goSettlement && goSettlement.hasAffordable) {
    UI.drawUiIcon(ctx, sprites, 'icon_shop', f.ix + 17, by + bh - 12, 15);
    UI.drawFitText(ctx, '小铺可兑换新品或天赋', f.ix + 28, by + bh - 12, f.iw - 38, 10.2, 8.8, 900, '#b53a1e');
  }

  // Action Buttons
  const actY = f.iy + f.ih - 84;
  UI.drawPillButton(ctx, f.ix, actY, f.iw, 42, {
    style: 'cta',
    icon: 'icon_restart',
    sprites,
    iconSize: 22,
    text: '再来一局',
    fontSize: 15,
    fontWeight: 900
  });
  hits.add('go_play_again', f.ix, actY, f.iw, 42, () => app.restartRun());

  const secY = actY + 48;
  const secGap = 6;
  const secW = (f.iw - secGap * 2) / 3;
  UI.drawPillButton(ctx, f.ix, secY, secW, 34, {
    style: 'wood',
    icon: 'icon_home',
    sprites,
    iconSize: 16,
    text: '大厅',
    fontSize: 11.8
  });
  hits.add('go_back_lobby', f.ix, secY, secW, 34, () => app.returnToLobby());

  const shopBtnX = f.ix + secW + secGap;
  const canBuyShop = Boolean(goSettlement && goSettlement.hasAffordable);
  UI.drawPillButton(ctx, shopBtnX, secY, secW, 34, {
    style: canBuyShop ? 'active' : 'wood',
    icon: 'icon_shop',
    sprites,
    iconSize: 16,
    text: '去小铺',
    fontSize: 11.8
  });
  if (canBuyShop) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(shopBtnX + secW - 7, secY + 6, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = '#e53935';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#fff8ee';
    ctx.stroke();
    ctx.restore();
  }
  hits.add('go_open_shop', shopBtnX, secY, secW, 34, () => app.openShopFromGameOver());

  const shareBtnX = shopBtnX + secW + secGap;
  UI.drawPillButton(ctx, shareBtnX, secY, secW, 34, {
    style: 'wood',
    icon: 'icon_gift',
    sprites,
    iconSize: 16,
    text: '分享',
    fontSize: 11.8
  });
  hits.add('go_share', shareBtnX, secY, secW, 34, () => app.shareResult());
}

module.exports = {
  renderActiveModal
};
