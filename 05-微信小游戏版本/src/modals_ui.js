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

function drawCloseButton(ctx, f, hits, app, label = '✕ 关闭', w = 58) {
  const bx = f.ix + f.iw - w;
  const by = f.iy + 1;
  UI.drawPillButton(ctx, bx, by, w, 28, {
    style: 'wood',
    text: label,
    fontSize: 11.2
  });
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

  // 2. Position Storybook Guide Card cleanly clear of spotlights & capsule
  const cardW = Math.min(436, width - 20);
  const lineCount = (step.lines || []).length;
  const desiredH = lineCount >= 3 ? 228 : 208;
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

  // Header Row: Mode Icon + Mode Guide Title + [跳过指引]
  const skipW = 64;
  UI.drawUiIcon(ctx, sprites, def.icon, ix + 13, iy + 13, 26);
  UI.drawFitText(ctx, def.title, ix + 30, iy + 9, iw - skipW - 36, 13.5, 10.5, 900, '#4A2C2A');
  UI.drawTagBadge(ctx, ix + 30, iy + 19, Math.min(126, iw - skipW - 38), 15, step.tag, 'amber', 8.8);

  UI.drawPillButton(ctx, ix + iw - skipW, iy + 2, skipW, 26, {
    style: 'wood',
    text: def.isMechanicTip ? '关闭提示' : '跳过指引',
    fontSize: 10.2,
    radius: 13
  });
  hits.add('guide_skip', ix + iw - skipW, iy + 2, skipW, 26, () => app.finishModeGuide());

  // Step Content Card
  const footerH = 34;
  const footerY = iy + ih - footerH;
  const contentY = iy + 39;
  const contentH = Math.max(76, footerY - contentY - 7);

  UI.drawKissaCard(ctx, ix, contentY, iw, contentH, { tone: 'amber', radius: 10 });

  const medS = 30;
  ctx.save();
  ctx.fillStyle = '#fffdf4';
  UI.roundRectPath(ctx, ix + 8, contentY + 7, medS, medS, 8);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#b9822c';
  ctx.stroke();
  UI.drawUiIcon(ctx, sprites, step.icon || def.icon, ix + 8 + medS * 0.5, contentY + 7 + medS * 0.5, medS - 4);
  ctx.restore();

  UI.drawFitText(ctx, step.title, ix + 45, contentY + 22, iw - 53, 13.2, 10.2, 900, '#4A2C2A');

  let ly = contentY + 41;
  const bulletAvailH = contentY + contentH - 6 - ly;
  const perLineH = bulletAvailH < 64 ? 13 : 14.2;
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
      UI.fontStr(bulletAvailH < 64 ? 9.8 : 10.4, 700),
      '#5c3626',
      'left',
      2
    );
    ly += usedH + 2.5;
  }

  // Footer Row: Step Progress Dots + [上一步] + [下一步 / 开始营业！]
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

  const nextW = isLast ? (def.isMechanicTip ? 138 : 118) : 102;
  const nextX = ix + iw - nextW;
  const nextLabel = isLast
    ? def.isMechanicTip
      ? '明白了！继续营业'
      : app.isLobbyOpen
      ? '明白了！'
      : '开始营业！'
    : '下一步 ›';
  UI.drawPillButton(ctx, nextX, footerY, nextW, footerH, {
    style: 'cta',
    icon: isLast ? def.icon : '',
    sprites,
    iconSize: 18,
    text: nextLabel,
    fontSize: 12.2,
    fontWeight: 900,
    radius: 11
  });
  hits.add('guide_next', nextX, footerY, nextW, footerH, () => app.nextModeGuideStep());

  if (stepIdx > 0) {
    const prevW = 66;
    const prevX = nextX - 7 - prevW;
    UI.drawPillButton(ctx, prevX, footerY, prevW, footerH, {
      style: 'wood',
      text: '‹ 上一步',
      fontSize: 11,
      radius: 11
    });
    hits.add('guide_prev', prevX, footerY, prevW, footerH, () => app.prevModeGuideStep());
  }
}

function renderShopModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 680, metrics.height * 0.84, hits);
  const { saveData, sprites, activeShopTab } = app;
  const isWide = f.iw >= 520;

  const closeW = 58;
  const bankVal = String(saveData.bankStardust || 0);
  const bankW = Math.max(66, 36 + bankVal.length * 8.5);
  drawModalHeader(
    ctx,
    f,
    sprites,
    'icon_shop',
    '吃茶小铺 · Starlight Shop',
    '永久星尘升级厨房天赋、玻璃罐与助阵搭档',
    closeW + bankW + 14
  );

  drawCloseButton(ctx, f, hits, app, '✕ 关闭', closeW);
  UI.drawCurrencyChip(ctx, f.ix + f.iw - closeW - 6 - bankW, f.iy + 1, bankW, 28, sprites, 'icon_stardust', bankVal, {
    style: 'active',
    fontSize: 12
  });

  // 3 Unified Shop Tabs
  const tabY = f.iy + 42;
  const tabH = 30;
  const tabs = [
    { id: 'upgrades', icon: 'icon_stardust', label: '厨房天赋' },
    { id: 'themes', icon: 'icon_shop', label: '玻璃罐换装' },
    { id: 'patrons', icon: 'icon_paw_guide', label: '助阵伙伴' }
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
      fontSize: isWide ? 12.5 : 11,
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
    const cardH = 110;
    const rows = Math.ceil(SHOP_UPGRADES.length / cols);
    totalContentH = rows * cardH + Math.max(0, rows - 1) * gap;
    app.modalMaxScroll = Math.max(0, totalContentH - bodyH);
    app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

    const upIcons = {
      up_tools: 'icon_gift',
      up_fever: 'mode_rush',
      up_combo: 'serve_bell',
      up_dust: 'icon_stardust'
    };

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

      UI.drawKissaCard(ctx, cx + 10, cy + 10, 40, 40, { tone: 'amber', radius: 10 });
      if (!UI.drawUiIcon(ctx, sprites, upIcons[up.id] || 'icon_stardust', cx + 30, cy + 30, 28)) {
        ctx.font = UI.fontStr(18, 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#4A2C2A';
        ctx.fillText(up.icon, cx + 30, cy + 31);
      }

      UI.drawFitText(ctx, `${up.name} (Lv.${lv}/${up.maxLv})`, cx + 58, cy + 20, cardW - 68, 13, 10.5, 900, '#4A2C2A');
      for (let p = 0; p < up.maxLv; p++) {
        UI.roundRectPath(ctx, cx + 58 + p * 18, cy + 34, 14, 7, 3.5);
        ctx.fillStyle = p < lv ? '#f5b63b' : '#dfd0b2';
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = p < lv ? '#4A2C2A' : '#8a643b';
        ctx.stroke();
      }

      UI.drawWrappedText(ctx, up.desc(lv), cx + 10, cy + 54, cardW - 20, 13, UI.fontStr(10.5, 600), '#724640', 'left', 2);

      const btnY = cy + cardH - 31;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 24, {
        style: isMax ? 'equipped' : canBuy ? 'cta' : 'wood',
        icon: isMax ? '' : 'icon_stardust',
        sprites,
        iconSize: 15,
        text: isMax ? '✓ 已升至满级' : `${cost} 永久星尘升级`,
        fontSize: 11,
        disabled: !isMax && !canBuy
      });
      if (!isMax) {
        hits.add(`shop_up_${up.id}`, cx + 10, btnY - app.modalScrollY, cardW - 20, 24, () => app.buyUpgrade(up.id), { clipRect });
      }
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
  } else if (activeShopTab === 'themes') {
    const cols = isWide ? 3 : 1;
    const gap = 9;
    const cardW = (f.iw - 8 - gap * (cols - 1)) / cols;
    const cardH = isWide ? 156 : 114;
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
      UI.drawThemeSwatch(ctx, cx + 10, cy + 10, 42, 42, th.id);
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = 1.8;
      UI.roundRectPath(ctx, cx + 10, cy + 10, 42, 42, 9);
      ctx.stroke();

      UI.drawFitText(ctx, th.name, cx + 60, cy + 20, cardW - 70, 13, 10.5, 900, '#4A2C2A');
      const statusTxt = equipped ? '✦ 使用中' : owned ? '已拥有' : `需 ${th.cost}`;
      UI.drawTagBadge(ctx, cx + 60, cy + 31, 64, 17, statusTxt, equipped ? 'sage' : owned ? 'soft' : 'amber', 9.2);

      UI.drawWrappedText(ctx, th.desc, cx + 10, cy + 58, cardW - 20, 13.5, UI.fontStr(10.5, 600), '#724640', 'left', isWide ? 4 : 2);

      const btnY = cy + cardH - 31;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 24, {
        style: equipped ? 'equipped' : owned ? 'active' : canBuy ? 'cta' : 'wood',
        icon: !equipped && !owned ? 'icon_stardust' : '',
        sprites,
        iconSize: 15,
        text: equipped ? '✓ 当前装备中' : owned ? '✦ 立即换装' : `${th.cost} 解锁并换装`,
        fontSize: 11,
        disabled: !equipped && !owned && !canBuy
      });
      if (!equipped) {
        hits.add(`shop_theme_${th.id}`, cx + 10, btnY - app.modalScrollY, cardW - 20, 24, () => app.buyOrEquipTheme(th.id), { clipRect });
      }
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
  } else {
    const cols = isWide ? 3 : 1;
    const gap = 9;
    const cardW = (f.iw - 8 - gap * (cols - 1)) / cols;
    const cardH = isWide ? 156 : 114;
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
      UI.drawKissaCard(ctx, cx + 10, cy + 10, 42, 42, { tone: 'amber', radius: 10 });
      if (sprites.patrons[p.id]) {
        UI.drawContainImage(ctx, sprites.patrons[p.id], cx + 31, cy + 31, 36, 36);
      }

      UI.drawFitText(ctx, p.shortName, cx + 60, cy + 20, cardW - 70, 13, 10.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, cx + 60, cy + 31, 64, 17, p.skillName, 'amber', 9.2);

      UI.drawWrappedText(ctx, p.passiveDesc, cx + 10, cy + 58, cardW - 20, 13.5, UI.fontStr(10.5, 600), '#724640', 'left', isWide ? 4 : 2);

      const btnY = cy + cardH - 31;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 24, {
        style: selected ? 'equipped' : owned ? 'active' : canBuy ? 'cta' : 'wood',
        icon: !selected && !owned ? 'icon_stardust' : '',
        sprites,
        iconSize: 15,
        text: selected ? '✓ 当前出战中' : owned ? '切换出战搭档' : `${p.cost} 邀请入店`,
        fontSize: 11,
        disabled: !selected && !owned && !canBuy
      });
      if (!selected) {
        hits.add(`shop_patron_${p.id}`, cx + 10, btnY - app.modalScrollY, cardW - 20, 24, () => app.buyOrSelectPatron(p.id), { clipRect });
      }
    }
    endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
  }
}

function renderCareerModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 660, metrics.height * 0.84, hits);
  const { saveData, sprites } = app;
  const st = saveData.lifetimeStats || {};

  drawModalHeader(
    ctx,
    f,
    sprites,
    'icon_trophy',
    '星夜吃茶 · 营业履历',
    `当前烘焙头衔：${getChefRank(app.getCareerTopScore())}`,
    64
  );
  drawCloseButton(ctx, f, hits, app);

  const bodyY = f.iy + 44;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const achCols = f.iw >= 480 ? 3 : 2;
  const achRows = Math.ceil(ACHIEVEMENTS.length / achCols);
  const totalH = 66 + 8 + 56 + 24 + achRows * 60;
  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);

  // 3 Mode Best Tiles with Illustrated Mode Icons
  const mTiles = [
    { icon: 'mode_chef', label: '主厨最高', val: saveData.bestChef || 0 },
    { icon: 'mode_rush', label: '90秒最高', val: saveData.bestRush || 0 },
    { icon: 'mode_zen', label: '悠闲最高', val: saveData.bestZen || 0 }
  ];
  const mW = (f.iw - 16) / 3;
  for (let i = 0; i < 3; i++) {
    const mx = f.ix + i * (mW + 6);
    UI.drawKissaCard(ctx, mx, bodyY, mW, 58, { tone: 'cream', radius: 10 });
    UI.drawUiIcon(ctx, sprites, mTiles[i].icon, mx + 18, bodyY + 18, 20);
    UI.drawFitText(ctx, mTiles[i].label, mx + 32, bodyY + 18, mW - 38, 10.5, 8.5, 800, '#724640');
    UI.drawFitText(ctx, String(mTiles[i].val), mx + mW * 0.5, bodyY + 41, mW - 10, 17, 12, 900, '#4A2C2A', 'center');
  }

  // 5 Lifetime Stats Row
  const sy = bodyY + 66;
  const lStats = [
    { label: '最高幕次', val: `第${st.bestShiftReached || 0}幕` },
    { label: '累计营业', val: `${st.runsPlayed || 0}局` },
    { label: '完成订单', val: `${st.ordersCompleted || 0}单` },
    { label: '最高连击', val: `${st.maxComboEver || 1}x` },
    { label: '猫神舒芙蕾', val: `${st.soufflesMade || 0}个` }
  ];
  const sW = (f.iw - 28) / 5;
  for (let i = 0; i < 5; i++) {
    const sx = f.ix + i * (sW + 5);
    UI.drawKissaCard(ctx, sx, sy, sW, 46, { tone: 'soft', radius: 8 });
    UI.drawFitText(ctx, lStats[i].label, sx + sW * 0.5, sy + 14, sW - 6, 9.5, 7.5, 700, '#724640', 'center');
    UI.drawFitText(ctx, lStats[i].val, sx + sW * 0.5, sy + 33, sW - 6, 12.5, 9.5, 900, '#4A2C2A', 'center');
  }

  // Achievements Grid
  const ay = sy + 56;
  UI.drawFitText(ctx, '店铺纪念勋章', f.ix, ay + 8, f.iw, 12, 10, 900, '#4A2C2A');
  const aw = (f.iw - 8 - (achCols - 1) * 7) / achCols;
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const ach = ACHIEVEMENTS[i];
    const done = ach.check(saveData);
    const col = i % achCols;
    const row = Math.floor(i / achCols);
    const cx = f.ix + col * (aw + 7);
    const cy = ay + 20 + row * 58;
    ctx.save();
    if (!done) ctx.globalAlpha = 0.72;
    UI.drawKissaCard(ctx, cx, cy, aw, 52, { tone: done ? 'amber' : 'soft', radius: 10 });
    if (sprites.base[ach.tierImg]) {
      if (!done) ctx.globalAlpha = 0.35;
      UI.drawContainImage(ctx, sprites.base[ach.tierImg], cx + 22, cy + 26, 30, 30);
    }
    ctx.restore();
    UI.drawFitText(ctx, `${done ? '✓ ' : ''}${ach.name}`, cx + 42, cy + 16, aw - 48, 11.5, 9.5, 800, '#4A2C2A');
    UI.drawWrappedText(ctx, ach.desc, cx + 42, cy + 26, aw - 48, 11, UI.fontStr(9.5, 600), '#724640', 'left', 2);
  }

  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderHelpModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 660, metrics.height * 0.84, hits);
  const { sprites } = app;

  drawModalHeader(
    ctx,
    f,
    sprites,
    'icon_help',
    '星夜吃茶 · 玩法与秘籍',
    '点击下方模式按钮可随时打开分步交互新手指引',
    64
  );
  drawCloseButton(ctx, f, hits, app);

  // Quick-Launch Mode Guides Bar
  const gBarY = f.iy + 40;
  const gBarH = 30;
  const gModes = [
    { id: 'chef', icon: 'mode_chef', text: '主厨闯关指引' },
    { id: 'rush', icon: 'mode_rush', text: '90秒狂欢指引' },
    { id: 'zen', icon: 'mode_zen', text: '悠闲经典指引' }
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
      fontSize: 10.8,
      radius: 9
    });
    hits.add(`help_guide_${gm.id}`, gx, gBarY, gBtnW, gBarH, () => app.openModeGuide(gm.id, 0));
  }

  const cards = [
    {
      icon: 'icon_launcher',
      title: '定角恒速发射 × 撞壁弹射',
      lines: [
        '• 发射口固定中央且初速度恒定！左右拖动只调角度，不必担心力度偏差',
        '• 撞玻璃侧壁反弹合成触发【弹壁神球 ×1.5】，瞄准时实时预览甜品异能范围',
        '• 上滑移出罐口取消发射；点击右上角「暂存」可随时调换手牌'
      ]
    },
    {
      icon: 'serve_bell',
      title: '亮铃上菜 × 单桌换单 × 抽底雪崩',
      lines: [
        '• 符合订单亮【上菜】餐铃点击端走；差一步合出的甜品会亮【差1合】绿标！',
        '• 点单桌可单独换该桌订单（每幕首换免费）；上菜后塌落享【雪崩 ×1.4~×3.2】',
        '• 90秒狂欢 12 秒内连出叠至 ×2.5 并延时 +4.5 秒；9阶猫神留罐 ×2'
      ]
    },
    {
      icon: 'icon_gift',
      title: '9 阶甜品异能 × 搭档招牌技',
      lines: [
        '• 泡芙高弹、抹茶柔磁、柠檬清小果、大福聚拢、甜甜圈旋搅、马卡龙微浮、蒙布朗压碎',
        '• 上菜蓄满底部头像释放招牌技：蜜柑捞底、露娜移形+共鸣、麦吉破冰重锤',
        '• 打开「甜品图鉴」可随时查阅每一阶甜品的物理特性与异能'
      ]
    },
    {
      icon: 'icon_shop',
      title: '5 幕闯关 × #流派 2/3 件套装共鸣',
      lines: [
        '• 达标营业额即过关，提前达标点【立即打烊】把剩步折算为利息币',
        '• 整备间集齐同标签（#雪崩/#弹壁/#异能/#贪婪）2 件与 3 件秘方激活强力套装共鸣！',
        '• 热炉传承保留最高 2 颗甜品进下幕，5 幕通关可挑战无尽午夜加时！'
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
  const cardH = isWide ? 156 : 120;
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
    let ly = cy + 31;
    for (let j = 0; j < cards[i].lines.length; j++) {
      ly += UI.drawWrappedText(ctx, cards[i].lines[j], cx + 10, ly, cardW - 20, 13.5, UI.fontStr(10.1, 600), '#724640') + 2;
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
    `甜品异能图鉴 (已解锁 ${saveData.unlockedTiers.length}/9)`,
    '同阶甜品相撞即可进化，每阶皆有独特物理手感与异能',
    64
  );
  drawCloseButton(ctx, f, hits, app);

  const bodyY = f.iy + 42;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const cols = f.iw >= 500 ? 3 : 2;
  const gap = 8;
  const cardW = (f.iw - 8 - (cols - 1) * gap) / cols;
  const cardH = 138;
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
    UI.drawFitText(ctx, `${t.tier}阶 · 合+${t.points} · 出+${t.servePoints}`, cx + cardW * 0.5, cy + 13, cardW - 12, 9.5, 8, 800, '#8f4e1b', 'center');
    if (sprites.base[t.tier]) {
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.25;
      UI.drawContainImage(ctx, sprites.base[t.tier], cx + cardW * 0.5, cy + 42, 40, 40);
      ctx.restore();
    }
    UI.drawFitText(ctx, unlocked ? t.name : '??? 未解锁', cx + cardW * 0.5, cy + 69, cardW - 12, 11.5, 9.5, 900, '#4A2C2A', 'center');
    if (unlocked && t.traitName) {
      const tagW = Math.min(cardW - 16, 94);
      UI.drawTagBadge(ctx, cx + (cardW - tagW) * 0.5, cy + 77, tagW, 15, `异能·${t.traitName}`, 'amber', 8.5);
    }
    UI.drawWrappedText(
      ctx,
      unlocked ? (t.traitDesc || t.lore) : '继续向上合成即可解锁甜品异能！',
      cx + 8,
      cy + 95,
      cardW - 16,
      12,
      UI.fontStr(9.3, 600),
      '#724640',
      'left',
      3
    );
    ctx.restore();
  }
  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderBlessingModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 680, metrics.height * 0.84, hits);
  const { gameState, sprites } = app;

  const rem = gameState.pendingBlessings;
  const title = rem > 1 ? `星夜主厨祝福 (剩余 ${rem} 次)` : '星夜主厨祝福 · 三选一';
  drawModalHeader(
    ctx,
    f,
    sprites,
    'icon_gift',
    title,
    gameState.blessingSubText || '任选 1 张魔法祝福，立刻强化本局甜品连锁！',
    76
  );
  drawCloseButton(ctx, f, hits, app, '稍后再领', 70);

  const choices = gameState.blessingChoices || [];
  const bodyY = f.iy + 44;
  const bodyH = f.iy + f.ih - bodyY;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  const isWide = f.iw >= 520;
  const gap = 9;
  if (isWide) {
    const cw = (f.iw - gap * 2) / 3;
    const ch = Math.min(260, bodyH);
    for (let i = 0; i < choices.length; i++) {
      const b = choices[i];
      const cx = f.ix + i * (cw + gap);
      const curLv = app.getPerkLevel(b.id);
      const nextLv = b.repeatable ? 1 : curLv + 1;
      const lvLabel = b.repeatable ? '即时生效' : curLv === 0 ? '✦ 新祝福 Lv.1' : `Lv.${curLv} → ${nextLv}`;

      UI.drawPillButton(ctx, cx, bodyY, cw, ch, { style: 'card', radius: 13 });
      ctx.fillStyle = '#fff5cf';
      ctx.beginPath();
      ctx.arc(cx + cw * 0.5, bodyY + 38, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#9c6e3b';
      ctx.stroke();
      ctx.font = UI.fontStr(24, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4A2C2A';
      ctx.fillText(b.icon, cx + cw * 0.5, bodyY + 40);

      UI.drawTagBadge(ctx, cx + cw * 0.5 - 30, bodyY + 70, 60, 17, b.tag, 'amber', 9.2);
      UI.drawFitText(ctx, b.name, cx + cw * 0.5, bodyY + 100, cw - 16, 14, 11, 900, '#4A2C2A', 'center');
      UI.drawFitText(ctx, lvLabel, cx + cw * 0.5, bodyY + 118, cw - 16, 10.5, 9, 800, '#8f4716', 'center');
      UI.drawWrappedText(ctx, b.desc(nextLv), cx + 12, bodyY + 134, cw - 24, 14.5, UI.fontStr(11, 600), '#724640', 'left', 4);
      UI.drawPillButton(ctx, cx + 16, bodyY + ch - 34, cw - 32, 24, { style: 'cta', text: `点击选择 [${i + 1}]`, fontSize: 11 });

      hits.add(`blessing_pick_${b.id}`, cx, bodyY, cw, ch, () => app.applyBlessing(b.id));
    }
  } else {
    const ch = Math.min(118, Math.floor((bodyH - gap * 2) / 3));
    for (let i = 0; i < choices.length; i++) {
      const b = choices[i];
      const cy = bodyY + i * (ch + gap);
      const curLv = app.getPerkLevel(b.id);
      const nextLv = b.repeatable ? 1 : curLv + 1;
      const lvLabel = b.repeatable ? '即时生效' : curLv === 0 ? '✦ 新祝福 Lv.1' : `Lv.${curLv}→${nextLv}`;

      UI.drawPillButton(ctx, f.ix, cy, f.iw, ch, { style: 'card', radius: 12 });
      ctx.fillStyle = '#fff5cf';
      ctx.beginPath();
      ctx.arc(f.ix + 30, cy + ch * 0.5, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#9c6e3b';
      ctx.stroke();
      ctx.font = UI.fontStr(22, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4A2C2A';
      ctx.fillText(b.icon, f.ix + 30, cy + ch * 0.5 + 1);

      const tx = f.ix + 60;
      const tw = f.iw - 70;
      UI.drawFitText(ctx, b.name, tx, cy + 19, tw - 116, 14, 11, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + f.iw - 64, cy + 10, 54, 17, b.tag, 'amber', 9);
      UI.drawFitText(ctx, lvLabel, f.ix + f.iw - 70, cy + 19, 76, 10, 8.5, 800, '#8f4716', 'right');
      UI.drawWrappedText(ctx, b.desc(nextLv), tx, cy + 34, tw, 14, UI.fontStr(10.8, 600), '#724640', 'left', 3);

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
  const rerollW = isWide ? 98 : 84;
  const coinVal = String(coins);
  const coinW = Math.max(60, 34 + coinVal.length * 8);
  drawModalHeader(ctx, f, sprites, 'icon_shop', '后厨整备间 · 流派构筑', null, rerollW + coinW + 14);

  const isFreeReroll = shop.rerollCost === 0;
  const canReroll = coins >= shop.rerollCost;
  const rerollX = f.ix + f.iw - rerollW;
  UI.drawPillButton(ctx, rerollX, f.iy + 1, rerollW, 28, {
    style: isFreeReroll ? 'active' : 'wood',
    icon: 'icon_restart',
    sprites,
    iconSize: 15,
    text: isFreeReroll ? '免单首刷' : `刷 ${shop.rerollCost}`,
    fontSize: isFreeReroll ? 10.2 : 11,
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
    iconSize: 24,
    text: `开启第 ${nextCfg.shift} 幕 · ${nextCfg.name}（目标 ¥${nextCfg.target}）`,
    fontSize: isWide ? 14 : 12.2,
    fontWeight: 900
  });
  hits.add('prep_next_shift', f.ix, footerY, f.iw, footerH, () => app.proceedNextShift());

  // 3. Scrollable Body between Header & Footer
  const bodyY = f.iy + 36;
  const bodyH = footerY - bodyY - 8;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const tipH = shop.showBeginnerTip ? 42 : 0;
  const sum = shop.shiftSummary;
  const receiptH = sum ? 42 : 0;
  const nextPreviewH = 44;
  const equippedH = 84;
  const relicCols = isWide ? 3 : 1;
  const relicGap = 8;
  const relicCardH = isWide ? 162 : 96;
  const relicRows = Math.ceil((shop.relicOffers || []).length / relicCols);
  const relicsSectionH = 20 + relicRows * relicCardH + Math.max(0, relicRows - 1) * relicGap;

  const modCols = isWide ? 2 : 1;
  const modGap = 8;
  const modCardH = isWide ? 88 : 78;
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
    UI.drawUiIcon(ctx, sprites, 'icon_paw_guide', f.ix + 18, curY + tipH * 0.5, 22);
    UI.drawWrappedText(
      ctx,
      '构筑提示：凑齐 2 件或 3 件同 #标签 秘方即激活套装共鸣！点上方槽位可半价卖出换流派，下滑可改手牌池。',
      f.ix + 34,
      curY + 8,
      tipW - 44,
      13.5,
      UI.fontStr(9.6, 800),
      '#5c3310',
      'left',
      2
    );
    curY += tipH + 8;
  }

  // 3a. Shift Clear Receipt Banner
  if (sum) {
    UI.drawKissaCard(ctx, f.ix, curY, f.iw - 6, receiptH, { tone: 'amber', radius: 10 });
    const carriedNames =
      sum.carried && sum.carried.length > 0
        ? sum.carried.map((c) => `${c.tier}阶${TIERS[c.tier - 1].name}`).join(' + ')
        : '全新起炉';
    const synSalaryTxt = sum.synergyBonusCoins > 0 ? ` · #贪婪+${sum.synergyBonusCoins}` : '';
    UI.drawFitText(
      ctx,
      `第 ${sum.shift} 幕过关！基薪+${sum.baseCoins} · 剩${sum.stepsSaved}步息+${sum.stepInterest}${sum.cleanTip > 0 ? ` · 清理+${sum.cleanTip}` : ''}${synSalaryTxt}`,
      f.ix + 9,
      curY + 14,
      f.iw - 24,
      10.8,
      8.5,
      900,
      '#6b380a'
    );
    UI.drawFitText(
      ctx,
      `热炉传承带入下幕：${carriedNames}`,
      f.ix + 9,
      curY + 30,
      f.iw - 24,
      10,
      8.2,
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
    if (nextCfg.shift === 3 || nextCfg.shift >= 5) previewBadges.push('冰封×2');
    if (nextCfg.modifier === 'grand_prix') previewBadges.push('评委急单');
    if (nextCfg.modifier === 'party_events') previewBadges.push('毛线球');
    const badgeStr = previewBadges.length > 0 ? previewBadges.join(' · ') : '无特殊机关';

    UI.drawKissaCard(ctx, f.ix, curY, prevW, nextPreviewH, {
      topCol: '#fcf5f9',
      botCol: '#f2e2ec',
      borderColor: '#9c5278',
      radius: 10
    });
    const leftTitleW = isWide ? prevW * 0.48 : prevW * 0.50;
    UI.drawFitText(
      ctx,
      `下幕预告 · 第${nextCfg.shift}幕【${nextCfg.name}】`,
      f.ix + 9,
      curY + 14,
      leftTitleW,
      10.8,
      8.4,
      900,
      '#592442'
    );
    const pillMaxW = prevW - leftTitleW - 22;
    const pillX = f.ix + prevW - pillMaxW - 8;
    UI.drawTagBadge(ctx, pillX, curY + 6, pillMaxW, 17, badgeStr, 'plum', 9);

    UI.drawFitText(ctx, nextCfg.desc, f.ix + 9, curY + 32, prevW - 18, 9.6, 7.8, 600, '#6b3b56');
    curY += nextPreviewH + 8;
  }

  // 3b. Equipped Relics Bar + 4-Archetype Synergy Progress Strip
  const eqW = f.iw - 6;
  const archCounts = app.getArchetypeCounts ? app.getArchetypeCounts() : { cascade: 0, bank: 0, trait: 0, greed: 0 };
  UI.drawKissaCard(ctx, f.ix, curY, eqW, equippedH, { tone: 'soft', radius: 10 });
  UI.drawFitText(
    ctx,
    `已装备秘方 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`,
    f.ix + 9,
    curY + 12,
    eqW * 0.55,
    11,
    9,
    900,
    '#4A2C2A'
  );
  UI.drawFitText(ctx, '点槽位半价卖 · 同#标签2/3件共鸣', f.ix + eqW - 9, curY + 12, eqW * 0.55, 9.2, 7.8, 700, '#8f4e1b', 'right');

  const slotGap = 6;
  const slotW = (eqW - 18 - slotGap * (MAX_RELIC_SLOTS - 1)) / MAX_RELIC_SLOTS;
  const slotY = curY + 22;
  const slotH = 35;
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
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, sx + slotW * 0.5, slotY + 12, slotW - 6, 10, 7.8, 900, '#4A2C2A', 'center');
      UI.drawFitText(ctx, `${arch ? arch.tag : ''} · 卖+${sellVal}`, sx + slotW * 0.5, slotY + 26, slotW - 6, 8.4, 7.2, 800, '#a34814', 'center');
      addClippedHit(hits, `prep_sell_${def.id}`, sx, slotY - app.modalScrollY, slotW, slotH, () => app.sellRelic(def.id), clipRect);
    } else {
      UI.drawFitText(ctx, '空秘方槽', sx + slotW * 0.5, slotY + slotH * 0.5, slotW - 6, 9.5, 8, 700, '#9c805e', 'center');
    }
  }

  // 4-Archetype Set Synergy Progress Strip (#雪崩 / #弹壁 / #异能 / #贪婪)
  const archKeys = ['cascade', 'bank', 'trait', 'greed'];
  const synPillY = curY + 61;
  const synPillH = 17;
  for (let ai = 0; ai < archKeys.length; ai++) {
    const ak = archKeys[ai];
    const aDef = RELIC_ARCHETYPES[ak];
    const cnt = archCounts[ak] || 0;
    const px = f.ix + 9 + ai * (slotW + slotGap);
    const activeTier = cnt >= 3 ? 3 : cnt >= 2 ? 2 : 0;
    const lbl = activeTier >= 3 ? `${aDef.tag} 3件★` : activeTier === 2 ? `${aDef.tag} 2件✦` : `${aDef.tag} ${cnt}/2`;
    UI.drawTagBadge(ctx, px, synPillY, slotW, synPillH, lbl, activeTier > 0 ? 'amber' : 'soft', 8.4);
  }
  curY += equippedH + 10;

  // 3c. 3 Relic Offers Shelf (with live #Tag Synergy Callouts!)
  UI.drawFitText(ctx, '流派规则秘方（集齐 2 / 3 件同 #标签 激活套装共鸣）', f.ix, curY + 8, eqW, 11.5, 9.2, 900, '#4A2C2A');
  curY += 20;

  const rCardW = (eqW - relicGap * (relicCols - 1)) / relicCols;
  const fullSlots = (gameState.relics || []).length >= MAX_RELIC_SLOTS;
  for (let i = 0; i < (shop.relicOffers || []).length; i++) {
    const offer = shop.relicOffers[i];
    const def = RELICS.find((r) => r.id === offer.id);
    if (!def) continue;
    const arch = RELIC_ARCHETYPES[def.archetype] || { icon: '✦', name: '秘方', tag: '#秘方', color: '#8f4716', bg: '#fff4d8' };
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

    const tagTxt = `${arch.tag || arch.name}(${curArchCnt}/2) · ${def.rarityLabel}`;
    const tagTone = def.rarity === 'legendary' ? 'amber' : def.rarity === 'rare' ? 'plum' : 'soft';
    UI.drawTagBadge(ctx, cx + 8, cy + 6, Math.min(rCardW - 16, 114), 16, tagTxt, tagTone, 8.4);

    if (willHitSyn && synDef) {
      const synBadgeTxt = curArchCnt === 2 ? '★凑3件质变!' : '✦凑2件共鸣!';
      const sbW = 74;
      UI.drawTagBadge(ctx, cx + rCardW - sbW - 8, cy + 6, sbW, 16, synBadgeTxt, 'amber', 8.2);
    }

    if (isWide) {
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, cx + 10, cy + 35, rCardW - 20, 13.2, 10.2, 900, '#4A2C2A');
      UI.drawWrappedText(ctx, def.desc, cx + 10, cy + 49, rCardW - 20, 13.5, UI.fontStr(10, 600), '#6d443a', 'left', willHitSyn ? 3 : 4);
      if (willHitSyn && synDef) {
        UI.drawFitText(
          ctx,
          `套装：${curArchCnt === 2 ? synDef.short3 : synDef.short2}`,
          cx + 10,
          cy + relicCardH - 41,
          rCardW - 20,
          9.2,
          7.8,
          800,
          '#9c4708'
        );
      }
      const bY = cy + relicCardH - 29;
      UI.drawPillButton(ctx, cx + 10, bY, rCardW - 20, 23, {
        style: bought ? 'equipped' : canBuy ? 'cta' : 'wood',
        icon: !bought && !fullSlots ? 'icon_coin' : '',
        sprites,
        iconSize: 14,
        text: bought ? '✓ 已装备' : fullSlots ? '秘方栏已满' : `${def.price} 购买装备`,
        fontSize: 10.5,
        disabled: !canBuy && !bought
      });
      if (!bought) {
        addClippedHit(hits, `prep_buy_relic_${def.id}`, cx + 10, bY - app.modalScrollY, rCardW - 20, 23, () => app.buyRelic(def.id), clipRect);
      }
    } else {
      const btnW = 86;
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, cx + 10, cy + 33, rCardW - btnW - 22, 12.8, 10.2, 900, '#4A2C2A');
      UI.drawWrappedText(
        ctx,
        def.desc,
        cx + 10,
        cy + 45,
        rCardW - btnW - 22,
        12.5,
        UI.fontStr(9.6, 600),
        '#6d443a',
        'left',
        willHitSyn ? 2 : 3
      );
      if (willHitSyn && synDef) {
        UI.drawFitText(
          ctx,
          `共鸣：${curArchCnt === 2 ? synDef.short3 : synDef.short2}`,
          cx + 10,
          cy + relicCardH - 13,
          rCardW - btnW - 22,
          9,
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
        text: bought ? '✓ 已装备' : fullSlots ? '栏位已满' : `${def.price}`,
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
  UI.drawFitText(ctx, '手牌池改造 & 即时补给', f.ix, curY + 8, eqW, 11.5, 9.5, 900, '#4A2C2A');
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
    const btnW = 80;
    const limitTag = def.maxBuy < 10 ? ` (${ownedCnt}/${def.maxBuy})` : '';
    UI.drawFitText(ctx, `${def.icon} ${def.name}${limitTag}`, cx + 10, cy + 17, mCardW - btnW - 22, 12.2, 10, 900, '#4A2C2A');
    UI.drawWrappedText(ctx, def.desc, cx + 10, cy + 30, mCardW - btnW - 22, 13, UI.fontStr(9.8, 600), '#6d443a', 'left', 3);

    const bX = cx + mCardW - btnW - 8;
    const bY = cy + modCardH * 0.5 - 14;
    UI.drawPillButton(ctx, bX, bY, btnW, 28, {
      style: bought ? 'equipped' : canBuy ? 'active' : 'wood',
      icon: !bought && !maxed ? 'icon_coin' : '',
      sprites,
      iconSize: 15,
      text: bought ? '✓ 已购买' : maxed ? '已上限' : `${def.price}`,
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
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 460, Math.min(470, metrics.height * 0.86), hits);
  const { gameState, sprites } = app;
  const offer = gameState.victoryOffer || {};
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  UI.drawUiIcon(ctx, sprites, 'icon_trophy', f.ix + 20, f.iy + 18, 28);
  UI.drawFitText(ctx, '星冠大赏 · 5幕全通关！', f.ix + f.iw * 0.5 + 8, f.iy + 18, f.iw - 36, 18, 13.5, 900, '#7c3c08', 'center');
  UI.drawFitText(
    ctx,
    '恭喜主厨征服深夜五幕！要挑战无尽加时还是荣耀打烊？',
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
    { x: f.ix, y: tY1, label: '累计总营业额', val: `¥${gameState.score}` },
    { x: x2, y: tY1, label: '最高阶甜品', val: `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}` },
    { x: f.ix, y: tY2, label: '最高抽底雪崩 / 连击', val: `雪崩${gameState.maxAvalancheRun}连 · ${gameState.maxCombo}x` },
    {
      x: x2,
      y: tY2,
      label: '当前流派构筑',
      val: (gameState.relics || []).map((id) => (RELICS.find((r) => r.id === id) || {}).icon || '✦').join(' ') || '纯净无秘方'
    }
  ];
  for (const t of tiles) {
    UI.drawKissaCard(ctx, t.x, t.y, tileW, tileH, { tone: 'cream', radius: 10 });
    UI.drawFitText(ctx, t.label, t.x + tileW * 0.5, t.y + 15, tileW - 10, 10.5, 8.5, 700, '#724640', 'center');
    UI.drawFitText(ctx, t.val, t.x + tileW * 0.5, t.y + 37, tileW - 10, 14.5, 10, 900, '#4A2C2A', 'center');
  }

  // Trophy Stardust Preview Box
  const py = tY2 + tileH + 10;
  UI.drawKissaCard(ctx, f.ix, py, f.iw, 56, { tone: 'amber', radius: 11 });
  UI.drawUiIcon(ctx, sprites, 'icon_stardust', f.ix + 18, py + 18, 18);
  UI.drawFitText(ctx, '已锁定通关星尘奖励（含 +35 完赛奖）', f.ix + 31, py + 18, f.iw - 41, 11.2, 9, 800, '#6b3b0c');
  UI.drawFitText(
    ctx,
    `当前结算可得 +${offer.stardustPreview || 135} 星尘（进无尽加时还可继续叠高！）`,
    f.ix + 10,
    py + 38,
    f.iw - 20,
    11,
    8.8,
    900,
    '#a64d00'
  );

  // Two Big Choice Buttons
  const actY = f.iy + f.ih - 92;
  UI.drawPillButton(ctx, f.ix, actY, f.iw, 42, {
    style: 'cta',
    icon: 'mode_rush',
    sprites,
    iconSize: 22,
    text: '进入无尽午夜加时（逛整备间 → 第6幕）',
    fontSize: 13.2,
    fontWeight: 900
  });
  hits.add('victory_endless', f.ix, actY, f.iw, 42, () => app.enterEndlessOvertime());

  UI.drawPillButton(ctx, f.ix, actY + 50, f.iw, 38, {
    style: 'wood',
    icon: 'icon_home',
    sprites,
    iconSize: 20,
    text: '荣耀打烊 · 立即领取永久星尘',
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
    `本局流派与机关 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`,
    null,
    64
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
      status: '激活中',
      tone: 'amber',
      desc: hDef.desc,
      color: hDef.color,
      bg: hDef.bg
    });
  }
  const frozenAlive = (gameState.entities || []).filter((e) => e && !e.merged && e.frozenHp > 0).length;
  if (gameState.mode === 'chef' && (gameState.shift === 3 || gameState.shift >= 5 || frozenAlive > 0)) {
    shiftAffixes.push({
      icon: '❄️',
      title: '冰封残局甜品',
      status: frozenAlive > 0 ? `剩 ${frozenAlive} 颗` : '已全部破冰',
      tone: 'frost',
      desc: '冰封期间不可合成/出餐/捞底/互换/用勺；周边 110px 合成、元气重锤(120px)或摇一摇破冰爆 +¥120！',
      color: '#2c6d8a',
      bg: '#ebf7fc'
    });
  }
  if (gameState.mode === 'chef' && gameState.shiftModifier === 'grand_prix') {
    const hasActiveRush = (gameState.orders || []).some((o) => o && !o.completed && o.isJudgeRush);
    const stepsToJudge = 6 - ((gameState.shiftStepsUsed || 0) % 6);
    shiftAffixes.push({
      icon: '🏅',
      title: '评委突击加单',
      status: hasActiveRush ? '急单进行中' : `${stepsToJudge}步后抵达`,
      tone: 'berry',
      desc: '每 6 步向 VIP 桌空降高阶评委急单，4 步鲜度内完成即享 ×2.5 营业额并返还 +2 步！',
      color: '#a35610',
      bg: '#fff3d6'
    });
  } else if (gameState.mode === 'chef' && gameState.shiftModifier === 'party_events') {
    shiftAffixes.push({
      icon: '🧶',
      title: '午夜猫猫派对',
      status: '第6/12步事件',
      tone: 'plum',
      desc: '开局伴随捣蛋毛线球（震碎 +¥750 & +10币），第 6 / 12 步定时触发星夜事件！',
      color: '#9c426d',
      bg: '#fcedf4'
    });
  }

  const activeSynergies = app.getActiveSynergies ? app.getActiveSynergies() : [];
  const equipped = (gameState.relics || []).map((id) => RELICS.find((r) => r.id === id)).filter(Boolean);
  const activeMods = DECK_MODS.filter((m) => app.getDeckModCount(m.id) > 0);

  const affixSectionH = shiftAffixes.length > 0 ? 22 + shiftAffixes.length * 64 + 6 : 0;
  const synergySectionH = activeSynergies.length > 0 ? 22 + activeSynergies.length * 60 + 6 : 0;
  const equippedSectionH = 22 + (equipped.length === 0 ? 64 : equipped.length * 68);
  const modsSectionH = 22 + (activeMods.length === 0 ? 28 : activeMods.length * 44);
  const totalH = 62 + affixSectionH + synergySectionH + equippedSectionH + modsSectionH + 12;

  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  let curY = bodyY;
  const cardW = f.iw - 6;

  // Current Shift Info Card
  UI.drawKissaCard(ctx, f.ix, curY, cardW, 52, { tone: 'amber', radius: 10 });
  UI.drawFitText(ctx, `第 ${shiftCfg.shift} 幕 · ${shiftCfg.name}（目标 ¥${gameState.shiftTarget}）`, f.ix + 10, curY + 15, cardW - 20, 12, 9.5, 900, '#4A2C2A');
  UI.drawWrappedText(ctx, shiftCfg.desc, f.ix + 10, curY + 26, cardW - 20, 12.5, UI.fontStr(9.8, 600), '#7a491c', 'left', 2);
  curY += 62;

  // Active Shift Hazards & Boss Affixes Section
  if (shiftAffixes.length > 0) {
    UI.drawFitText(ctx, '本幕激活机关 & Boss 词条', f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
    curY += 22;
    for (const af of shiftAffixes) {
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 58, {
        topCol: af.bg || '#fffaf0',
        botCol: '#fffdf8',
        borderColor: af.color || '#c48823',
        radius: 10
      });
      const pillW = 74;
      UI.drawFitText(ctx, `${af.icon} ${af.title}`, f.ix + 10, curY + 15, cardW - pillW - 24, 11.8, 9.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + cardW - pillW - 8, curY + 7, pillW, 16, af.status, af.tone || 'amber', 8.8);
      UI.drawWrappedText(ctx, af.desc, f.ix + 10, curY + 27, cardW - 20, 12.5, UI.fontStr(9.6, 600), '#5f3b28', 'left', 2);
      curY += 64;
    }
    curY += 6;
  }

  // Active Archetype Set Synergies Section
  if (activeSynergies.length > 0) {
    UI.drawFitText(ctx, '已激活流派套装共鸣', f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
    curY += 22;
    for (const syn of activeSynergies) {
      const aDef = RELIC_ARCHETYPES[syn.id] || { name: '流派共鸣', color: '#c48823' };
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 54, {
        tone: 'selected',
        borderColor: aDef.color,
        radius: 10
      });
      UI.drawFitText(ctx, `${syn.def.tag} · ${aDef.name}`, f.ix + 10, curY + 15, cardW - 96, 11.8, 9.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + cardW - 82, curY + 7, 74, 16, `${syn.tier}件共鸣中`, 'amber', 8.8);
      const synDesc = syn.tier >= 3 ? `${syn.def.short2} · ${syn.def.short3}` : syn.def.tier2Desc;
      UI.drawWrappedText(ctx, synDesc, f.ix + 10, curY + 26, cardW - 20, 12, UI.fontStr(9.4, 700), '#6b380a', 'left', 2);
      curY += 60;
    }
    curY += 6;
  }

  // Equipped Relics List
  UI.drawFitText(ctx, `已装备流派秘方 (${equipped.length}/${MAX_RELIC_SLOTS})`, f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 22;
  if (equipped.length === 0) {
    UI.drawKissaCard(ctx, f.ix, curY, cardW, 56, { tone: 'soft', radius: 10 });
    UI.drawFitText(ctx, '尚未装备流派秘方', f.ix + cardW * 0.5, curY + 20, cardW - 20, 12.5, 10, 800, '#724640', 'center');
    UI.drawFitText(ctx, '通关当前幕次后即可进入【后厨整备间】选购 16 张规则秘方（同#标签2/3件激活套装共鸣）！', f.ix + cardW * 0.5, curY + 38, cardW - 20, 10, 8.2, 600, '#8f5b34', 'center');
    curY += 64;
  } else {
    for (const def of equipped) {
      const arch = RELIC_ARCHETYPES[def.archetype] || { icon: '✦', name: '秘方', tag: '#秘方', color: '#8f4716', bg: '#fff4d8' };
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 62, { borderColor: arch.color, radius: 10 });
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, f.ix + 10, curY + 16, cardW - 96, 12, 9.5, 900, '#4A2C2A');
      UI.drawTagBadge(ctx, f.ix + cardW - 80, curY + 8, 72, 16, `${arch.tag || arch.name}`, 'amber', 8.8);
      UI.drawWrappedText(ctx, def.desc, f.ix + 10, curY + 28, cardW - 20, 13, UI.fontStr(10, 600), '#6d443a', 'left', 2);
      curY += 68;
    }
  }

  // Active Deck Mods
  UI.drawFitText(ctx, '已生效手牌池改造', f.ix, curY + 8, cardW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 22;
  if (activeMods.length === 0) {
    UI.drawFitText(ctx, '暂无手牌池改造（可在后厨整备间购买）', f.ix + 6, curY + 10, cardW - 12, 10.5, 9, 600, '#8a684a');
  } else {
    for (const m of activeMods) {
      const cnt = app.getDeckModCount(m.id);
      UI.drawKissaCard(ctx, f.ix, curY, cardW, 38, { tone: 'soft', radius: 8 });
      UI.drawFitText(ctx, `${m.icon} ${m.name} ×${cnt}`, f.ix + 10, curY + 13, cardW - 20, 11, 9, 800, '#4A2C2A');
      UI.drawFitText(ctx, m.desc, f.ix + 10, curY + 27, cardW - 20, 9.5, 8, 600, '#724640');
      curY += 44;
    }
  }

  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderGameOverModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 450, Math.min(476, metrics.height * 0.85), hits);
  const { gameState, goSettlement, sprites } = app;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  // Head
  const reason = (goSettlement && goSettlement.reason) || gameState.runEndReason;
  const headerIcon =
    reason === 'victory' ? 'icon_trophy' : gameState.mode === 'rush' ? 'mode_rush' : 'mode_chef';
  const title =
    reason === 'victory'
      ? '星冠大赏 · 荣耀打烊'
      : reason === 'shift_failed'
      ? `第 ${gameState.shift} 幕营业未达标`
      : gameState.mode === 'rush' && gameState.rushFinished
      ? '90秒狂欢结算'
      : '今夜打烊总结';

  const rankTxt = getChefRank(gameState.score);
  const rankW = Math.min(118, Math.max(80, rankTxt.length * 9.5 + 16));
  drawModalHeader(ctx, f, sprites, headerIcon, title, null, rankW + 8);
  UI.drawTagBadge(ctx, f.ix + f.iw - rankW, f.iy + 4, rankW, 22, rankTxt, 'amber', 9.8);

  // 4 Stat Tiles (2x2)
  const tileW = (f.iw - 8) / 2;
  const tileH = 56;
  const tY1 = f.iy + 38;
  const tY2 = tY1 + tileH + 8;

  // Tile 1: Score / Cumulative Revenue + inline New Best
  UI.drawKissaCard(ctx, f.ix, tY1, tileW, tileH, { tone: 'cream', radius: 10 });
  UI.drawFitText(ctx, gameState.mode === 'chef' ? '本局总营业额' : '本局得分', f.ix + tileW * 0.5, tY1 + 15, tileW - 12, 11, 9, 700, '#724640', 'center');
  const sStr = gameState.mode === 'chef' ? `¥${gameState.score}` : String(gameState.score);
  if (goSettlement && goSettlement.isNewBest) {
    ctx.font = UI.fontStr(18, 900);
    const sw = ctx.measureText(sStr).width;
    const totalW = sw + 50;
    const sx = f.ix + tileW * 0.5 - totalW * 0.5;
    ctx.fillStyle = '#4A2C2A';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(sStr, sx, tY1 + 38);
    UI.drawTagBadge(ctx, sx + sw + 5, tY1 + 29, 45, 17, '新纪录!', 'berry', 8.8);
  } else {
    UI.drawFitText(ctx, sStr, f.ix + tileW * 0.5, tY1 + 38, tileW - 12, 19, 13, 900, '#4A2C2A', 'center');
  }

  // Tile 2: Best Score or Shift Cleared Progress
  const x2 = f.ix + tileW + 8;
  UI.drawKissaCard(ctx, x2, tY1, tileW, tileH, { tone: 'cream', radius: 10 });
  if (gameState.mode === 'chef') {
    UI.drawFitText(ctx, '闯关幕次 / 过关', x2 + tileW * 0.5, tY1 + 15, tileW - 12, 10.5, 8.5, 700, '#724640', 'center');
    UI.drawFitText(
      ctx,
      `第 ${gameState.shift} 幕 · 通关 ${gameState.shiftsClearedThisRun} 幕`,
      x2 + tileW * 0.5,
      tY1 + 38,
      tileW - 12,
      13.5,
      10,
      900,
      '#4A2C2A',
      'center'
    );
  } else {
    UI.drawFitText(ctx, '最高纪录', x2 + tileW * 0.5, tY1 + 15, tileW - 12, 11, 9, 700, '#724640', 'center');
    UI.drawFitText(ctx, String(app.getBestScore()), x2 + tileW * 0.5, tY1 + 38, tileW - 12, 19, 13, 900, '#4A2C2A', 'center');
  }

  // Tile 3: Max Tier
  UI.drawKissaCard(ctx, f.ix, tY2, tileW, tileH, { tone: 'cream', radius: 10 });
  UI.drawFitText(ctx, '最高阶甜品', f.ix + tileW * 0.5, tY2 + 15, tileW - 12, 11, 9, 700, '#724640', 'center');
  UI.drawFitText(ctx, `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}`, f.ix + tileW * 0.5, tY2 + 38, tileW - 12, 12.5, 9.5, 900, '#4A2C2A', 'center');

  // Tile 4: Relics/Orders or Rush Combo/Yarn
  UI.drawKissaCard(ctx, x2, tY2, tileW, tileH, { tone: 'cream', radius: 10 });
  const fourthLabel =
    gameState.mode === 'rush'
      ? '最高连击 / 毛线球'
      : gameState.mode === 'chef'
      ? '上菜次数 / 最高雪崩'
      : '完成订单 / 最高连击';
  const fourthVal =
    gameState.mode === 'rush'
      ? `${gameState.maxCombo}x · 线团${gameState.yarnBrokenThisRun}`
      : gameState.mode === 'chef'
      ? `上菜${gameState.servesCompleted}次 · 雪崩${gameState.maxAvalancheRun}连`
      : `${gameState.ordersCompleted} 单 · ${gameState.maxCombo}x`;
  UI.drawFitText(ctx, fourthLabel, x2 + tileW * 0.5, tY2 + 15, tileW - 12, 10.5, 8.5, 700, '#724640', 'center');
  UI.drawFitText(ctx, fourthVal, x2 + tileW * 0.5, tY2 + 38, tileW - 12, 14, 10, 900, '#4A2C2A', 'center');

  // Permanent Stardust Bank Deposit Card
  const by = tY2 + tileH + 10;
  const bh = goSettlement && goSettlement.hasAffordable ? 78 : 62;
  UI.drawKissaCard(ctx, f.ix, by, f.iw, bh, { tone: 'amber', radius: 11 });
  UI.drawUiIcon(ctx, sprites, 'icon_stardust', f.ix + 18, by + 16, 18);
  UI.drawFitText(ctx, '永久星尘入账', f.ix + 30, by + 16, f.iw * 0.52, 12.5, 10, 800, '#6b3b0c');
  UI.drawFitText(ctx, `+${goSettlement ? goSettlement.finalEarned : 0}`, f.ix + f.iw - 10, by + 16, f.iw * 0.36, 17, 13, 900, '#a64d00', 'right');
  UI.drawWrappedText(
    ctx,
    (goSettlement && goSettlement.detailText) || '',
    f.ix + 10,
    by + 28,
    f.iw - 20,
    13.5,
    UI.fontStr(10.5, 700),
    '#7c4d1b',
    'left',
    2
  );
  if (goSettlement && goSettlement.hasAffordable) {
    UI.drawUiIcon(ctx, sprites, 'icon_shop', f.ix + 17, by + bh - 12, 15);
    UI.drawFitText(ctx, '吃茶小铺已有可兑换的新品或天赋！', f.ix + 28, by + bh - 12, f.iw - 38, 10.5, 9, 900, '#b53a1e');
  }

  // Action Buttons
  const actY = f.iy + f.ih - 84;
  UI.drawPillButton(ctx, f.ix, actY, f.iw, 42, {
    style: 'cta',
    icon: 'icon_restart',
    sprites,
    iconSize: 22,
    text: '再来一局 · Play Again',
    fontSize: 15,
    fontWeight: 900
  });
  hits.add('go_play_again', f.ix, actY, f.iw, 42, () => app.restartRun());

  const secY = actY + 48;
  const secW = (f.iw - 8) / 2;
  UI.drawPillButton(ctx, f.ix, secY, secW, 34, {
    style: 'wood',
    icon: 'icon_home',
    sprites,
    iconSize: 18,
    text: '回到吃茶大厅',
    fontSize: 12.2
  });
  hits.add('go_back_lobby', f.ix, secY, secW, 34, () => app.returnToLobby());

  UI.drawPillButton(ctx, f.ix + secW + 8, secY, secW, 34, {
    style: 'wood',
    icon: 'icon_gift',
    sprites,
    iconSize: 18,
    text: '分享战绩给好友',
    fontSize: 12.2
  });
  hits.add('go_share', f.ix + secW + 8, secY, secW, 34, () => app.shareResult());
}

module.exports = {
  renderActiveModal
};
