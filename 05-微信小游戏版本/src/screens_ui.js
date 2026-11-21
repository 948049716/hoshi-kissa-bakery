/**
 * Canvas 2D Layout Computer & Screen Renderers (Backdrop, Streamlined Storybook Lobby & Gameplay HUD)
 * Designed for portrait WeChat Mini Game phones (with Capsule Button safe clearance)
 * AND wide desktop simulator / browser preview screens, using unified UI atlas sprites.
 */
'use strict';

const {
  TIERS,
  PATRONS,
  SHOP_UPGRADES,
  RELICS,
  MAX_RELIC_SLOTS,
  RELIC_ARCHETYPES,
  SHIFT_HAZARDS,
  JAR,
  getChefRank
} = require('./constants');
const UI = require('./ui_draw');
const JarRenderer = require('./jar_renderer');

function computeJarBox(x, y, w, h) {
  const scale = Math.max(0.4, Math.min(w / JAR.canvasW, h / JAR.canvasH));
  const dw = JAR.canvasW * scale;
  const dh = JAR.canvasH * scale;
  return {
    x: x + (w - dw) * 0.5,
    y: y + (h - dh) * 0.5,
    w: dw,
    h: dh,
    scale
  };
}

function renderBackdrop(ctx, w, h, dt, nowSec, gameState, theme, sprites, fireflies) {
  if (sprites.bg) {
    UI.drawCoverImage(ctx, sprites.bg, 0, 0, w, h, 0.5);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#162736');
    g.addColorStop(1, '#2d1c12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.fillStyle = theme.stageTint || 'rgba(8, 13, 19, 0.42)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const isSakura = theme.id === 'sakura';
  for (let i = 0; i < fireflies.length; i++) {
    const f = fireflies[i];
    f.x += (f.vx + (isSakura ? Math.sin(nowSec * 1.1 + f.phase) * 0.01 : 0)) * dt;
    f.y += (isSakura ? Math.abs(f.vy) * 1.35 : f.vy) * dt;
    if (f.y < -0.05) {
      f.y = 1.05;
      f.x = Math.random();
    } else if (f.y > 1.05) {
      f.y = -0.05;
      f.x = Math.random();
    }
    if (f.x < -0.05) f.x = 1.05;
    if (f.x > 1.05) f.x = -0.05;

    const glow = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(nowSec * 2.2 + f.phase));
    const px = f.x * w;
    const py = f.y * h;
    if (isSakura) {
      ctx.fillStyle = `rgba(${theme.ambientRgb}, ${glow * 0.85})`;
      UI.drawSakuraPetal(ctx, px, py, f.r * 1.9, nowSec * 1.2 + f.phase);
    } else {
      const grad = ctx.createRadialGradient(px, py, 0, px, py, f.r * 3.5);
      grad.addColorStop(0, `rgba(${theme.ambientRgb}, ${glow})`);
      grad.addColorStop(1, `rgba(${theme.ambientRgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, f.r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (gameState.running && gameState.feverTimer > 0) {
    const pulse = 0.55 + 0.45 * Math.sin(nowSec * 5);
    ctx.save();
    ctx.strokeStyle = `rgba(255, 212, 92, ${0.28 + pulse * 0.16})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.restore();
  }
}

function computeTopHeaderGeometry(metrics) {
  const { width, safeTop, menuRect } = metrics;
  const topY = menuRect ? menuRect.top : Math.max(8, safeTop + 4);
  const headerH = menuRect ? Math.max(30, menuRect.height) : 34;
  const maxRight = menuRect ? Math.max(210, menuRect.left - 8) : width - 10;
  return { topY, headerH, maxRight };
}

function drawRedDot(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#e6483b';
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#fff9ec';
  ctx.stroke();
  ctx.restore();
}

function drawSpeechBalloon(ctx, x, y, w, h, tailX, tailY) {
  const r = 12;
  ctx.save();
  ctx.shadowColor = 'rgba(28, 14, 6, 0.22)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;

  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#fffefb');
  g.addColorStop(1, '#f8ebd2');
  ctx.fillStyle = g;
  UI.roundRectPath(ctx, x, y, w, h, r);
  ctx.fill();

  // Speech pointer tail pointing left toward mascot
  const baseTop = Math.max(y + 14, Math.min(y + h - 22, tailY - 6));
  ctx.beginPath();
  ctx.moveTo(x + 2, baseTop);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(x + 2, baseTop + 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  UI.roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = 1.9;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();

  // Cover border seam at tail base
  ctx.beginPath();
  ctx.moveTo(x + 1, baseTop + 1);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(x + 1, baseTop + 11);
  ctx.fillStyle = '#fdf4e3';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, baseTop);
  ctx.lineTo(tailX, tailY);
  ctx.lineTo(x, baseTop + 12);
  ctx.strokeStyle = '#4A2C2A';
  ctx.lineWidth = 1.9;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawTitlePlaqueBanner(ctx, cx, topY, maxW, maxH, sprites, subtitle) {
  const img = sprites.titlePlaque;
  if (img && img.width > 0 && img.height > 0) {
    const scale = Math.min(maxW / img.width, maxH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = cx - dw * 0.5;
    ctx.save();
    ctx.shadowColor = 'rgba(18, 8, 3, 0.36)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(img, dx, topY, dw, dh);
    ctx.restore();

    // Inner cream parchment area of ui_title_plaque sits around y: [0.31..0.76] of dh
    const titleY = topY + dh * 0.48;
    const subY = topY + dh * 0.675;
    UI.drawFitText(ctx, '星 夜 吃 茶', cx + 4, titleY, dw * 0.64, Math.min(25, dh * 0.22), 15, 900, '#4A2C2A', 'center');
    if (subtitle) {
      UI.drawFitText(ctx, subtitle, cx + 4, subY, dw * 0.68, Math.min(11, dh * 0.098), 8.5, 800, '#8a5222', 'center');
    }
    return dh;
  }

  // Fallback wooden plaque if image still loading
  const fw = Math.min(maxW, 280);
  const fh = Math.min(maxH, 68);
  UI.drawWoodBoard(ctx, cx - fw * 0.5, topY, fw, fh, 14);
  UI.drawParchmentSheet(ctx, cx - fw * 0.5 + 7, topY + 7, fw - 14, fh - 14, 9);
  UI.drawFitText(ctx, '星夜吃茶', cx, topY + fh * 0.42, fw - 28, 20, 14, 900, '#4A2C2A', 'center');
  if (subtitle) {
    UI.drawFitText(ctx, subtitle, cx, topY + fh * 0.74, fw - 28, 10, 8.5, 700, '#8a5222', 'center');
  }
  return fh;
}

const LOBBY_MODES = [
  {
    id: 'chef',
    icon: 'mode_chef',
    shortTitle: '主厨闯关',
    fullTitle: '星夜主厨 · 5幕闯关',
    tag: '5幕肉鸽',
    tagTone: 'berry',
    summary: '限定步数达标营业额，点选亮铃甜品上菜，过关逛整备间构筑秘方流派',
    bestKey: 'bestChef'
  },
  {
    id: 'rush',
    icon: 'mode_rush',
    shortTitle: '90秒狂欢',
    fullTitle: '90秒弹射狂欢',
    tag: '上菜+3s',
    tagTone: 'amber',
    summary: '无步数限制极速定角连发，点击上菜直接 +3.0 秒续命，溢罐吹散不秒死',
    bestKey: 'bestRush'
  },
  {
    id: 'zen',
    icon: 'mode_zen',
    shortTitle: '悠闲经典',
    fullTitle: '悠闲经典合合乐',
    tag: '无压畅玩',
    tagTone: 'sage',
    summary: '零步数与时间压力，随心定角弹射体验 9 阶甜品异能与星夜祝福',
    bestKey: 'bestZen'
  }
];

function renderLobbyScreen(ctx, metrics, app, hits, nowSec) {
  const { width, height, safeBottom } = metrics;
  const { gameState, saveData, sprites, hasAffordable } = app;
  const { topY, headerH, maxRight } = computeTopHeaderGeometry(metrics);
  const isWide = width >= 760;

  const padX = isWide ? Math.max(20, (width - 980) * 0.5) : 12;
  const effectiveRight = isWide ? Math.min(width - padX, maxRight) : maxRight;
  const btnS = Math.min(32, headerH);

  // 1. Clean Top Utility Bar (Capsule-Safe, Unified Atlas Icons!)
  let rx = effectiveRight;
  rx -= btnS;
  UI.drawPillButton(ctx, rx, topY, btnS, btnS, {
    style: 'wood',
    icon: 'icon_help',
    sprites,
    fallbackText: '?'
  });
  hits.add('lobby_help', rx, topY, btnS, btnS, () => app.openModal('help'));

  rx -= 6 + btnS;
  UI.drawPillButton(ctx, rx, topY, btnS, btnS, {
    style: 'wood',
    icon: 'icon_sfx',
    sprites,
    mutedSlash: !app.audio.sfxEnabled,
    fallbackText: '音'
  });
  hits.add('lobby_sfx', rx, topY, btnS, btnS, () => app.toggleSfx());

  rx -= 6 + btnS;
  UI.drawPillButton(ctx, rx, topY, btnS, btnS, {
    style: app.audio.bgmEnabled ? 'active' : 'wood',
    icon: 'icon_bgm',
    sprites,
    mutedSlash: !app.audio.bgmEnabled,
    fallbackText: '乐'
  });
  hits.add('lobby_bgm', rx, topY, btnS, btnS, () => app.cycleBgm());

  // Left: Unified Stardust Bank Chip (tappable to open Shop!)
  const bankVal = String(saveData.bankStardust || 0);
  const bankW = Math.min(Math.max(76, 44 + bankVal.length * 8.5), Math.max(68, rx - 8 - padX));
  UI.drawCurrencyChip(ctx, padX, topY, bankW, btnS, sprites, 'icon_stardust', bankVal, {
    style: 'wood',
    fontSize: 12.5
  });
  hits.add('lobby_bank', padX, topY, bankW, btnS, () => app.openShop('upgrades'));

  if (isWide) {
    const rankLabel = `星夜吃茶 · ${getChefRank(app.getCareerTopScore())}`;
    const rankX = padX + bankW + 8;
    const rankMaxW = rx - 10 - rankX;
    if (rankMaxW >= 150) {
      UI.drawPillButton(ctx, rankX, topY, Math.min(220, rankMaxW), btnS, {
        style: 'dark',
        text: rankLabel,
        fontSize: 12
      });
    }
  }

  const contentTop = topY + headerH + 6;
  const footerPadB = Math.max(10, safeBottom + 8);

  if (isWide) {
    renderWideLobbyLayout(ctx, width, height, padX, contentTop, footerPadB, app, hits, nowSec);
  } else {
    renderMobileLobbyLayout(ctx, width, height, padX, contentTop, footerPadB, app, hits, nowSec);
  }
}

function renderMobileLobbyLayout(ctx, width, height, padX, contentTop, footerPadB, app, hits, nowSec) {
  const { gameState, saveData, sprites, activePatron, hasAffordable, lobbyBounceT, lobbySpeechIndex } = app;
  const innerW = width - padX * 2;

  // Bottom 3-Button Meta Dock (Shop / Compendium / Career)
  const dockH = 40;
  const dockY = height - footerPadB - dockH;
  const dockGap = 8;
  const dockColW = (innerW - dockGap * 2) / 3;
  const dockItems = [
    { id: 'btn_shop', icon: 'icon_shop', text: '吃茶小铺', dot: hasAffordable, fn: () => app.openShop('upgrades') },
    { id: 'btn_comp', icon: 'icon_book', text: '甜品图鉴', dot: false, fn: () => app.openModal('compendium') },
    { id: 'btn_career', icon: 'icon_trophy', text: '营业履历', dot: false, fn: () => app.openModal('career') }
  ];
  for (let i = 0; i < dockItems.length; i++) {
    const d = dockItems[i];
    const bx = padX + i * (dockColW + dockGap);
    UI.drawPillButton(ctx, bx, dockY, dockColW, dockH, {
      style: 'wood',
      icon: d.icon,
      sprites,
      text: d.text,
      fontSize: 12.5,
      radius: 12
    });
    if (d.dot) drawRedDot(ctx, bx + dockColW - 6, dockY + 4);
    hits.add(d.id, bx, dockY, dockColW, dockH, d.fn);
  }

  const availH = dockY - contentTop - 10;
  const compact = availH < 520;

  // 1. Top Hanging Signboard Plaque
  const plaqueMaxH = compact ? 92 : Math.min(132, Math.round(availH * 0.22));
  const plaqueMaxW = Math.min(innerW - 12, compact ? 248 : 308);
  const rankTitle = `喵呜甜品合合乐 · ${getChefRank(app.getCareerTopScore())}`;
  const plaqueH = drawTitlePlaqueBanner(ctx, width * 0.5, contentTop - 4, plaqueMaxW, plaqueMaxH, sprites, rankTitle);

  // 2. Open Mascot Stage + Speech Balloon + Compact Partner Chips
  const stageTop = contentTop + plaqueH + (compact ? 2 : 6);
  const menuCardH = compact ? 228 : 254;
  const menuCardY = dockY - 10 - menuCardH;
  const stageAvailH = Math.max(118, menuCardY - stageTop - 8);

  const chipH = compact ? 32 : 36;
  const chipY = stageTop + stageAvailH - chipH;
  const actorAreaH = Math.max(76, chipY - stageTop - 6);

  // Mascot standing on velvet stage cushion on the left
  const stageW = compact ? 96 : 112;
  const stageCx = padX + stageW * 0.5 + 2;
  const stageBotY = stageTop + actorAreaH;

  if (sprites.patronStage) {
    UI.drawContainImage(ctx, sprites.patronStage, stageCx, stageBotY - 17, stageW * 0.92, 42);
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(42, 20, 10, 0.36)';
    UI.fillEllipse(ctx, stageCx, stageBotY - 8, stageW * 0.4, 9);
    ctx.fill();
    ctx.restore();
  }

  const bounceScale = lobbyBounceT > 0 ? 1 + Math.sin(lobbyBounceT * Math.PI * 2) * 0.13 : 1;
  const bobY = Math.sin(nowSec * 2.3) * 2.5;
  const mascotSize = Math.min(stageW * 0.84, actorAreaH - 12);
  const mascotCy = stageBotY - 22 - mascotSize * 0.36 + bobY;
  const pImg = sprites.patrons[activePatron.id];
  if (pImg) {
    ctx.save();
    ctx.translate(stageCx, mascotCy);
    ctx.scale(bounceScale, 2 - bounceScale);
    UI.drawContainImage(ctx, pImg, 0, 0, mascotSize, mascotSize);
    ctx.restore();
  }
  UI.drawTagBadge(ctx, stageCx - 25, stageBotY - 15, 50, 15, '点我互动', 'cocoa', 8.5);
  hits.add('lobby_patron_poke', padX, stageTop, stageW + 6, actorAreaH, () => app.pokeLobbyPatron());

  // Clean Floating Speech Balloon on the right
  const balX = padX + stageW + 10;
  const balW = padX + innerW - balX;
  const balH = Math.min(actorAreaH - 4, compact ? 76 : 88);
  const balY = stageTop + (actorAreaH - balH) * 0.5;
  drawSpeechBalloon(ctx, balX, balY, balW, balH, balX - 8, Math.min(balY + balH - 18, mascotCy + 4));

  const skillTagW = 58;
  UI.drawFitText(
    ctx,
    activePatron.name,
    balX + 10,
    balY + 15,
    balW - skillTagW - 22,
    12,
    9.5,
    900,
    '#4A2C2A'
  );
  UI.drawTagBadge(ctx, balX + balW - skillTagW - 8, balY + 7, skillTagW, 16, activePatron.skillName, 'amber', 9);

  const lines = activePatron.idleLines || [activePatron.greet];
  const speechText = lines[lobbySpeechIndex % lines.length];
  UI.drawWrappedText(
    ctx,
    speechText,
    balX + 10,
    balY + 27,
    balW - 18,
    compact ? 13.5 : 14.5,
    UI.fontStr(compact ? 10.2 : 10.8, 600),
    '#5e3a31',
    'left',
    2
  );
  UI.drawFitText(
    ctx,
    `天赋：${activePatron.shortPassive}`,
    balX + 10,
    balY + balH - 10,
    balW - 18,
    9.5,
    8.2,
    800,
    '#94521c'
  );

  // 3-Partner Compact Switcher Pills
  renderPatronSwitcherRow(ctx, padX, chipY, innerW, chipH, app, hits, false);

  // 3. Single Unified Cafe Mode & Start Card
  renderUnifiedModeCard(ctx, padX, menuCardY, innerW, menuCardH, app, hits, false, compact);
}

function renderWideLobbyLayout(ctx, width, height, padX, contentTop, footerPadB, app, hits, nowSec) {
  const { sprites, activePatron, hasAffordable, lobbyBounceT, lobbySpeechIndex } = app;
  const maxW = Math.min(960, width - padX * 2);
  const leftX = (width - maxW) * 0.5;
  const availH = height - footerPadB - contentTop;
  const colGap = 18;
  const leftW = Math.floor(maxW * 0.46);
  const rightW = maxW - leftW - colGap;
  const rightX = leftX + leftW + colGap;

  // Left Showcase Card: Cafe Window Illustration + Interactive Mascot & Partner Switcher
  UI.drawWoodBoard(ctx, leftX, contentTop, leftW, availH, 16);
  const pad = 11;
  const ix = leftX + pad;
  const iw = leftW - pad * 2;
  UI.drawParchmentSheet(ctx, ix, contentTop + pad, iw, availH - pad * 2, 11);

  const inPad = 11;
  const chipH = 42;
  const chipY = contentTop + availH - pad - inPad - chipH;
  const stageH = 104;
  const stageY = chipY - 8 - stageH;
  const heroY = contentTop + pad + inPad;
  const heroH = Math.max(120, stageY - heroY - 10);

  if (sprites.hero) {
    ctx.save();
    UI.roundRectPath(ctx, ix + inPad, heroY, iw - inPad * 2, heroH, 11);
    ctx.clip();
    UI.drawCoverImage(ctx, sprites.hero, ix + inPad, heroY, iw - inPad * 2, heroH, 0.42);
    ctx.restore();
    ctx.save();
    UI.roundRectPath(ctx, ix + inPad, heroY, iw - inPad * 2, heroH, 11);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();
    ctx.restore();
  }

  // Mascot + Speech Balloon inside Left Showcase
  const stageW = 104;
  const stageCx = ix + inPad + stageW * 0.5;
  const stageBotY = stageY + stageH;
  if (sprites.patronStage) {
    UI.drawContainImage(ctx, sprites.patronStage, stageCx, stageBotY - 16, 94, 38);
  }
  const bounceScale = lobbyBounceT > 0 ? 1 + Math.sin(lobbyBounceT * Math.PI * 2) * 0.13 : 1;
  const bobY = Math.sin(nowSec * 2.3) * 2.5;
  const pImg = sprites.patrons[activePatron.id];
  if (pImg) {
    ctx.save();
    ctx.translate(stageCx, stageBotY - 52 + bobY);
    ctx.scale(bounceScale, 2 - bounceScale);
    UI.drawContainImage(ctx, pImg, 0, 0, 74, 74);
    ctx.restore();
  }
  UI.drawTagBadge(ctx, stageCx - 25, stageBotY - 15, 50, 15, '点我互动', 'cocoa', 8.5);
  hits.add('lobby_patron_poke', ix + inPad, stageY, stageW, stageH, () => app.pokeLobbyPatron());

  const balX = ix + inPad + stageW + 8;
  const balW = ix + iw - inPad - balX;
  drawSpeechBalloon(ctx, balX, stageY + 4, balW, stageH - 8, balX - 7, stageY + 48);
  UI.drawFitText(ctx, activePatron.name, balX + 10, stageY + 20, balW - 78, 12.5, 10, 900, '#4A2C2A');
  UI.drawTagBadge(ctx, balX + balW - 66, stageY + 12, 58, 16, activePatron.skillName, 'amber', 9);
  const lines = activePatron.idleLines || [activePatron.greet];
  UI.drawWrappedText(
    ctx,
    lines[lobbySpeechIndex % lines.length],
    balX + 10,
    stageY + 34,
    balW - 20,
    15,
    UI.fontStr(11, 600),
    '#5e3a31',
    'left',
    2
  );
  UI.drawFitText(ctx, activePatron.passiveDesc, balX + 10, stageY + stageH - 16, balW - 20, 9.8, 8.2, 800, '#94521c');

  renderPatronSwitcherRow(ctx, ix + inPad, chipY, iw - inPad * 2, chipH, app, hits, true);

  // Right Column: Signboard Plaque + Unified Mode & Start Card + 3 Meta Buttons
  const plaqueH = drawTitlePlaqueBanner(
    ctx,
    rightX + rightW * 0.5,
    contentTop - 4,
    Math.min(rightW - 20, 340),
    126,
    sprites,
    '喵呜甜品合合乐 · 定角弹射肉鸽'
  );

  const dockH = 44;
  const dockY = contentTop + availH - dockH;
  const dockGap = 10;
  const dockColW = (rightW - dockGap * 2) / 3;
  const dockItems = [
    { id: 'btn_shop', icon: 'icon_shop', text: '吃茶小铺', dot: hasAffordable, fn: () => app.openShop('upgrades') },
    { id: 'btn_comp', icon: 'icon_book', text: '甜品图鉴', dot: false, fn: () => app.openModal('compendium') },
    { id: 'btn_career', icon: 'icon_trophy', text: '营业履历', dot: false, fn: () => app.openModal('career') }
  ];
  for (let i = 0; i < dockItems.length; i++) {
    const d = dockItems[i];
    const bx = rightX + i * (dockColW + dockGap);
    UI.drawPillButton(ctx, bx, dockY, dockColW, dockH, {
      style: 'wood',
      icon: d.icon,
      sprites,
      text: d.text,
      fontSize: 13.5,
      radius: 12
    });
    if (d.dot) drawRedDot(ctx, bx + dockColW - 6, dockY + 4);
    hits.add(d.id, bx, dockY, dockColW, dockH, d.fn);
  }

  const modeCardY = contentTop + plaqueH + 6;
  const modeCardH = dockY - modeCardY - 12;
  renderUnifiedModeCard(ctx, rightX, modeCardY, rightW, modeCardH, app, hits, true, false);
}

function renderPatronSwitcherRow(ctx, x, y, w, h, app, hits, isWide) {
  const { saveData, sprites } = app;
  const gap = 6;
  const chipW = (w - gap * (PATRONS.length - 1)) / PATRONS.length;
  for (let i = 0; i < PATRONS.length; i++) {
    const p = PATRONS[i];
    const cx = x + i * (chipW + gap);
    const unlocked = saveData.unlockedPatrons.includes(p.id);
    const selected = saveData.selectedPatron === p.id;
    UI.drawPillButton(ctx, cx, y, chipW, h, {
      style: selected ? 'cardSelected' : 'card',
      radius: 10,
      disabled: !unlocked
    });

    const avS = h - 8;
    const avCx = cx + 5 + avS * 0.5;
    const avCy = y + h * 0.5;
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff5dc';
    ctx.beginPath();
    ctx.arc(avCx, avCy, avS * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#9c6e3b';
    ctx.stroke();
    if (sprites.patrons[p.id]) {
      UI.drawContainImage(ctx, sprites.patrons[p.id], avCx, avCy, avS * 0.86, avS * 0.86);
    }
    ctx.restore();

    const tx = avCx + avS * 0.5 + 4;
    const tw = cx + chipW - tx - 4;
    UI.drawFitText(ctx, p.shortName, tx, y + h * 0.34, tw, isWide ? 11.2 : 10, 8.2, 900, '#4A2C2A');
    const subTxt = unlocked ? (selected ? '✦ 出战中' : '点此切换') : `解锁 ${p.cost}`;
    UI.drawFitText(ctx, subTxt, tx, y + h * 0.72, tw, isWide ? 9.8 : 8.8, 7.5, 800, selected ? '#8f4714' : '#856046');

    hits.add(`lobby_patron_chip_${p.id}`, cx, y, chipW, h, () => app.selectOrUnlockPatron(p.id));
  }
}

function renderUnifiedModeCard(ctx, x, y, w, h, app, hits, isWide, compact) {
  const { gameState, saveData, sprites } = app;
  UI.drawWoodBoard(ctx, x, y, w, h, 15);
  const pad = isWide ? 10 : 7;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  UI.drawParchmentSheet(ctx, ix, iy, iw, ih, 11);

  const inPad = isWide ? 12 : 8;
  const innerX = ix + inPad;
  const innerW = iw - inPad * 2;

  // Primary Start CTA anchored at bottom of card
  const ctaH = compact ? 42 : isWide ? 48 : 45;
  const ctaY = iy + ih - inPad - ctaH;
  const selModeDef = LOBBY_MODES.find((m) => m.id === gameState.mode) || LOBBY_MODES[0];

  UI.drawPillButton(ctx, innerX, ctaY, innerW, ctaH, {
    style: 'cta',
    icon: selModeDef.icon,
    sprites,
    iconSize: ctaH - 14,
    text: `开门营业 · ${selModeDef.shortTitle}`,
    fontSize: isWide ? 16.5 : 15.5,
    fontWeight: 900,
    radius: 13
  });
  hits.add('btn_start', innerX, ctaY, innerW, ctaH, () => app.startNewRun());

  // Selected Mode Summary & Guide Strip right above CTA
  const infoH = compact ? 44 : 50;
  const infoY = ctaY - 7 - infoH;
  UI.drawKissaCard(ctx, innerX, infoY, innerW, infoH, { tone: 'soft', radius: 10 });

  const bestVal = saveData[selModeDef.bestKey] || 0;
  const guideBtnW = 68;
  UI.drawFitText(
    ctx,
    `${selModeDef.fullTitle}  ·  最高纪录 ${bestVal}`,
    innerX + 9,
    infoY + 14,
    innerW - guideBtnW - 22,
    isWide ? 11.5 : 10.5,
    8.8,
    900,
    '#4A2C2A'
  );
  UI.drawPillButton(ctx, innerX + innerW - guideBtnW - 6, infoY + 5, guideBtnW, 20, {
    style: 'wood',
    icon: 'icon_help',
    sprites,
    iconSize: 13,
    text: '指引',
    fontSize: 9.8,
    radius: 10
  });
  hits.add('lobby_mode_guide', innerX + innerW - guideBtnW - 6, infoY + 5, guideBtnW, 20, () =>
    app.openModeGuide(selModeDef.id, 0)
  );

  UI.drawFitText(
    ctx,
    selModeDef.summary,
    innerX + 9,
    infoY + infoH - 13,
    innerW - 18,
    isWide ? 10.8 : 9.8,
    8.2,
    600,
    '#6d453b'
  );

  // 3 Side-by-Side Illustrated Mode Cards at top
  const cardsY = iy + inPad;
  const cardsH = Math.max(76, infoY - cardsY - 7);
  const gap = isWide ? 10 : 7;
  const cardW = (innerW - gap * 2) / 3;

  for (let i = 0; i < LOBBY_MODES.length; i++) {
    const m = LOBBY_MODES[i];
    const cx = innerX + i * (cardW + gap);
    const selected = gameState.mode === m.id;

    UI.drawPillButton(ctx, cx, cardsY, cardW, cardsH, {
      style: selected ? 'cardSelected' : 'card',
      radius: 12
    });

    if (cardsH >= 165) {
      const icSize = Math.min(cardW * 0.68, 92, cardsH - 96);
      const blockH = icSize + 64;
      const blockTop = cardsY + (cardsH - blockH) * 0.5;
      UI.drawUiIcon(ctx, sprites, m.icon, cx + cardW * 0.5, blockTop + icSize * 0.5, icSize);

      const titleY = blockTop + icSize + 15;
      UI.drawFitText(ctx, m.shortTitle, cx + cardW * 0.5, titleY, cardW - 12, 15, 11, 900, '#4A2C2A', 'center');

      const tagW = Math.min(cardW - 18, 68);
      UI.drawTagBadge(
        ctx,
        cx + (cardW - tagW) * 0.5,
        titleY + 12,
        tagW,
        16,
        selected ? '✦ 当前模式' : m.tag,
        selected ? 'cocoa' : m.tagTone,
        9
      );

      const mBest = saveData[m.bestKey] || 0;
      UI.drawFitText(
        ctx,
        `最高纪录 ${mBest}`,
        cx + cardW * 0.5,
        titleY + 39,
        cardW - 14,
        10.5,
        8.5,
        700,
        selected ? '#7a3e10' : '#856046',
        'center'
      );
    } else {
      const icSize = Math.min(cardW * 0.56, Math.max(30, cardsH - 44));
      const icCy = cardsY + 8 + icSize * 0.5;
      UI.drawUiIcon(ctx, sprites, m.icon, cx + cardW * 0.5, icCy, icSize);

      const titleY = cardsY + cardsH - 27;
      UI.drawFitText(
        ctx,
        m.shortTitle,
        cx + cardW * 0.5,
        titleY,
        cardW - 10,
        isWide ? 13.5 : 12,
        9.8,
        900,
        '#4A2C2A',
        'center'
      );

      const tagW = Math.min(cardW - 14, 58);
      UI.drawTagBadge(
        ctx,
        cx + (cardW - tagW) * 0.5,
        cardsY + cardsH - 18,
        tagW,
        14,
        selected ? '✦ 当前模式' : m.tag,
        selected ? 'cocoa' : m.tagTone,
        8.5
      );
    }

    hits.add(`mode_${m.id}`, cx, cardsY, cardW, cardsH, () => app.selectMode(m.id));
  }
}

function renderPlayScreen(ctx, metrics, app, hits, nowSec) {
  const { width, height, safeBottom } = metrics;
  const { gameState, sprites, equippedTheme, audio } = app;
  const { topY, headerH, maxRight } = computeTopHeaderGeometry(metrics);
  const isWide = width >= 820;

  const padX = isWide ? Math.max(18, (width - 1060) * 0.5) : 8;
  const effectiveRight = isWide ? Math.min(width - padX, maxRight) : maxRight;
  const btnS = isWide ? Math.min(32, headerH) : Math.min(width < 385 ? 28 : 30, headerH);
  const btnY = topY + (headerH - btnS) * 0.5;
  const gap = isWide ? 6 : 4;

  // 1. Top Navigation Bar (Capsule-Safe, Unified Atlas Icons!)
  let rx = effectiveRight;

  const restartW = isWide ? 72 : btnS;
  rx -= restartW;
  UI.drawPillButton(ctx, rx, btnY, restartW, btnS, {
    style: 'wood',
    icon: 'icon_restart',
    sprites,
    text: isWide ? '重开' : '',
    fontSize: 12,
    fallbackText: '重'
  });
  hits.add('play_restart', rx, btnY, restartW, btnS, () => app.restartRun());

  rx -= gap + (isWide ? 72 : btnS);
  const helpW = isWide ? 72 : btnS;
  UI.drawPillButton(ctx, rx, btnY, helpW, btnS, {
    style: 'wood',
    icon: 'icon_help',
    sprites,
    text: isWide ? '指引' : '',
    fontSize: 12,
    fallbackText: '?'
  });
  hits.add('play_help', rx, btnY, helpW, btnS, () => app.openModeGuide(gameState.mode, 0));

  rx -= gap + (isWide ? 72 : btnS);
  const compW = isWide ? 72 : btnS;
  UI.drawPillButton(ctx, rx, btnY, compW, btnS, {
    style: 'wood',
    icon: 'icon_book',
    sprites,
    text: isWide ? '图鉴' : '',
    fontSize: 12,
    fallbackText: '鉴'
  });
  hits.add('play_comp', rx, btnY, compW, btnS, () => app.openModal('compendium'));

  rx -= gap + btnS;
  UI.drawPillButton(ctx, rx, btnY, btnS, btnS, {
    style: 'wood',
    icon: 'icon_sfx',
    sprites,
    mutedSlash: !audio.sfxEnabled,
    fallbackText: '音'
  });
  hits.add('play_sfx', rx, btnY, btnS, btnS, () => app.toggleSfx());

  rx -= gap + btnS;
  UI.drawPillButton(ctx, rx, btnY, btnS, btnS, {
    style: audio.bgmEnabled ? 'active' : 'wood',
    icon: 'icon_bgm',
    sprites,
    mutedSlash: !audio.bgmEnabled,
    fallbackText: '乐'
  });
  hits.add('play_bgm', rx, btnY, btnS, btnS, () => app.cycleBgm());

  if (isWide) {
    rx -= gap + 82;
    UI.drawPillButton(ctx, rx, btnY, 82, btnS, {
      style: gameState.debugPhysics ? 'active' : 'wood',
      text: gameState.debugPhysics ? '轮廓开' : '轮廓',
      fontSize: 11.5
    });
    hits.add('play_debug_phys', rx, btnY, 82, btnS, () => app.toggleDebugPhysics());
  }

  // Left: Back to Lobby + Mode/Shift Pill
  const backW = isWide ? 70 : btnS;
  UI.drawPillButton(ctx, padX, btnY, backW, btnS, {
    style: 'wood',
    icon: 'icon_home',
    sprites,
    text: isWide ? '大厅' : '',
    fontSize: 12,
    fallbackText: '回'
  });
  hits.add('play_back_lobby', padX, btnY, backW, btnS, () => app.returnToLobby());

  const modeX = padX + backW + gap;
  const modeMaxW = Math.max(54, rx - gap - modeX);
  const shiftTxtShort = gameState.shift <= 5 ? `第${gameState.shift}/5幕` : `加时#${gameState.shift - 5}`;
  const shiftTxtWide =
    gameState.shift <= 5
      ? `第${gameState.shift}/5幕 · ${gameState.shiftName || '暮色试营业'}`
      : `无尽加时 · 第${gameState.shift}幕`;
  const hasShiftAffix =
    gameState.mode === 'chef' &&
    ((Array.isArray(gameState.shiftHazards) && gameState.shiftHazards.length > 0) ||
      gameState.shift === 3 ||
      gameState.shift >= 5);
  const modeLabel =
    gameState.mode === 'rush'
      ? (modeMaxW < 82 ? '90秒狂欢' : '90秒弹射狂欢')
      : gameState.mode === 'zen'
      ? (modeMaxW < 82 ? '悠闲经典' : '悠闲经典模式')
      : isWide
      ? (hasShiftAffix ? `${shiftTxtWide} ✦` : shiftTxtWide)
      : hasShiftAffix
      ? `${shiftTxtShort}✦`
      : shiftTxtShort;
  const modeW = Math.min(isWide ? 210 : 88, modeMaxW);
  UI.drawPillButton(ctx, modeX, btnY, modeW, btnS, {
    style: 'dark',
    icon: isWide ? (gameState.mode === 'rush' ? 'mode_rush' : gameState.mode === 'zen' ? 'mode_zen' : 'mode_chef') : '',
    sprites,
    text: modeLabel,
    fontSize: 11
  });
  if (hasShiftAffix) {
    ctx.save();
    UI.roundRectPath(ctx, modeX, btnY, modeW, btnS, Math.min(btnS * 0.5, 16));
    ctx.strokeStyle = '#ffe07a';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }
  if (gameState.mode === 'chef') {
    hits.add('play_shift_badge', modeX, btnY, modeW, btnS, () => app.openRelicsModal());
  }

  // 2. Layout Stage & HUDs
  let jarContainer = null;
  let toolsDockY = height - Math.max(8, safeBottom + 6) - 62;
  const headerBottom = topY + headerH;
  const guideTargets = {};

  if (isWide) {
    const contentTop = headerBottom + 10;
    const totalW = Math.min(1060, width - padX * 2);
    const startX = (width - totalW) * 0.5;
    const sideW = 248;
    const colGap = 16;
    const centerW = totalW - sideW * 2 - colGap * 2;
    const boardH = Math.min(540, height - contentTop - 18);

    renderWideLeftBoard(ctx, startX, contentTop, sideW, boardH, app, hits, nowSec, guideTargets);
    renderWideRightBoard(ctx, startX + totalW - sideW, contentTop, sideW, boardH, app, hits, nowSec, guideTargets);

    toolsDockY = height - Math.max(10, safeBottom + 8) - 66;
    const jarTop = headerBottom + 4;
    const jarH = toolsDockY - jarTop - 4;
    jarContainer = { x: startX + sideW + colGap, y: jarTop, w: centerW, h: jarH };
  } else {
    const hudTop = headerBottom + 5;
    const innerW = width - padX * 2;
    const hudH = gameState.mode === 'chef' ? 74 : 62;
    renderMobileTopHud(ctx, padX, hudTop, innerW, hudH, app, hits, nowSec, guideTargets);

    const subY = hudTop + hudH + 4;
    const subH = 34;
    renderMobileSubBar(ctx, padX, subY, innerW, subH, app, hits, guideTargets);

    const jarTop = subY + subH + 3;
    const jarH = toolsDockY - jarTop - 3;
    jarContainer = { x: 4, y: jarTop, w: width - 8, h: jarH };
  }

  // 3. Render Glass Mixing Jar Chamber + Entities
  const jarBox = computeJarBox(jarContainer.x, jarContainer.y, jarContainer.w, jarContainer.h);
  app.lastJarBox = jarBox;
  JarRenderer.renderJarStage(ctx, jarBox, gameState, equippedTheme, sprites, nowSec, app.getEffectiveMagnetLevel());

  // Record exact screen spotlight rectangles for Interactive Mode Guide
  guideTargets.launcher = {
    x: jarBox.x + JAR.canvasW * 0.5 * jarBox.scale - 62 * jarBox.scale,
    y: jarBox.y + 4 * jarBox.scale,
    w: 124 * jarBox.scale,
    h: 132 * jarBox.scale
  };
  guideTargets.danger = {
    x: jarBox.x + JAR.left * jarBox.scale,
    y: jarBox.y + (JAR.dangerY - 22) * jarBox.scale,
    w: (JAR.right - JAR.left) * jarBox.scale,
    h: 48 * jarBox.scale
  };
  const servableEnt = (gameState.entities || []).find((e) => e && !e.merged && app.isEntityServable(e));
  if (servableEnt) {
    guideTargets.servableTreat = {
      x: jarBox.x + (servableEnt.x - servableEnt.r - 12) * jarBox.scale,
      y: jarBox.y + (servableEnt.y - servableEnt.r - 22) * jarBox.scale,
      w: (servableEnt.r * 2 + 24) * jarBox.scale,
      h: (servableEnt.r * 2 + 30) * jarBox.scale
    };
  }

  // 4. Unified Floating In-Jar Overlays
  if (isWide && gameState.mode === 'rush' && gameState.running && !gameState.over) {
    const urgent = gameState.rushTimer <= 15.0;
    UI.drawNoticeBanner(ctx, jarBox.x + 8, jarBox.y + 6, 102, 26, {
      icon: 'mode_rush',
      sprites,
      text: `${Math.max(0, gameState.rushTimer).toFixed(1)}s`,
      fontSize: 12.5,
      borderColor: urgent ? '#ff8b78' : '#ffd56b',
      topCol: urgent ? 'rgba(164, 34, 24, 0.94)' : undefined,
      botCol: urgent ? 'rgba(116, 20, 14, 0.96)' : undefined
    });
  }

  // Unified Shop Event Banner
  if (gameState.activeEvent && gameState.running && !gameState.over) {
    const ev = gameState.activeEvent;
    let iconKey = 'serve_bell';
    let label = '黄金烘焙钟 · 得分+45% 连击延长';
    let meta = `${Math.max(0, ev.timer).toFixed(1)}s`;
    let bBorder = '#ffe169';
    if (ev.kind === 'meteor') {
      iconKey = 'icon_stardust';
      label = '流星许愿夜 · 镀金 & 充能+30%';
      bBorder = '#ffd66b';
    } else if (ev.kind === 'yarn') {
      const yb = gameState.entities.find((e) => e.isYarnBall && !e.merged);
      iconKey = 'yarn_ball';
      label = '猫咪捣蛋 · 附近合成震碎领大奖';
      meta = `脆度×${yb ? yb.yarnHp : 0}`;
      bBorder = '#ffb0c8';
    }
    const bw = Math.min(width - 24, isWide ? 316 : 278);
    const bx = jarBox.x + jarBox.w * 0.5 - bw * 0.5;
    const by = jarBox.y + 82 * jarBox.scale;
    UI.drawNoticeBanner(ctx, bx, by, bw, 25, {
      icon: iconKey,
      sprites,
      text: label,
      fontSize: 10.8,
      borderColor: bBorder,
      rightReserve: 56
    });
    UI.drawTagBadge(ctx, bx + bw - 50, by + 4.5, 44, 16, meta, 'amber', 9.5);
  }

  // Unified Tool & Active Chef Skill Targeting Banner
  if ((gameState.activeToolMode || gameState.activeSkillMode) && gameState.running && !gameState.over) {
    let msg = '点击罐内任意甜品(1~8阶)升阶';
    if (gameState.activeSkillMode === 'scoop') {
      msg = '金勺捞底：点击罐内 1~5 阶甜品捞回罐口！';
    } else if (gameState.activeSkillMode === 'swap_1') {
      msg = '星月移形：请点击第 1 颗甜品 (1/2)';
    } else if (gameState.activeSkillMode === 'swap_2') {
      msg = '星月移形：再点击第 2 颗互换位置 (2/2)';
    }
    const bw = Math.min(width - 20, 316);
    const bx = jarBox.x + jarBox.w * 0.5 - bw * 0.5;
    const by = jarBox.y + 8;
    UI.drawNoticeBanner(ctx, bx, by, bw, 28, {
      text: msg,
      fontSize: 10.8,
      borderColor: '#ffd56b',
      rightReserve: 54,
      align: 'left'
    });
    const cbx = bx + bw - 48;
    UI.drawPillButton(ctx, cbx, by + 4, 42, 20, { style: 'danger', text: '取消', fontSize: 10.2 });
    hits.add('cancel_tool', cbx, by + 4, 42, 20, () => app.cancelToolMode());
  }

  // Pending Roguelike Blessing Floating Button (with `icon_gift` sprite!)
  if (
    gameState.pendingBlessings > 0 &&
    !gameState.activeToolMode &&
    !gameState.activeSkillMode &&
    gameState.running &&
    !gameState.over &&
    !app.activeModal
  ) {
    const bw = 172;
    const bx = jarBox.x + jarBox.w * 0.5 - bw * 0.5;
    const by = toolsDockY - 36;
    const pulse = 1 + Math.sin(nowSec * 6) * 0.03;
    ctx.save();
    ctx.translate(bx + bw * 0.5, by + 15);
    ctx.scale(pulse, pulse);
    UI.drawPillButton(ctx, -bw * 0.5, -15, bw, 30, {
      style: 'cta',
      icon: 'icon_gift',
      sprites,
      text: `领取星夜祝福 ×${gameState.pendingBlessings}`,
      fontSize: 12,
      fontWeight: 900
    });
    ctx.restore();
    hits.add('open_blessing_btn', bx, by, bw, 30, () => app.openBlessingModal());
  }

  // 5. Bottom Chef Action Dock: [1·摇一摇] — [★ 角色招牌主动技] — [3·升阶勺]
  const activePatron = app.activePatron;
  const activeSk = activePatron.activeSkill;
  const toolSize = isWide ? 50 : 46;
  const heroSize = isWide ? 56 : 52;
  const dockGap = isWide ? 34 : 26;
  const centerX = width * 0.5;
  const heroY = toolsDockY - 3;
  const sideY = toolsDockY;

  const drawSideTool = (tl, cx, ty) => {
    const tx = cx - toolSize * 0.5;
    const cy = ty + toolSize * 0.5;
    const cnt = gameState.tools[tl.key];
    const cost = gameState.toolCosts[tl.key];
    const armed = gameState.activeToolMode === tl.key;

    ctx.save();
    if (armed) {
      ctx.strokeStyle = '#ffea80';
      ctx.lineWidth = 3.8;
      ctx.beginPath();
      ctx.arc(cx, cy, toolSize * 0.5 + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bg = ctx.createRadialGradient(cx - 5, cy - 6, 4, cx, cy, toolSize * 0.5);
    bg.addColorStop(0, '#fff4cf');
    bg.addColorStop(0.65, '#dfac68');
    bg.addColorStop(1, '#9d622d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, toolSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = armed ? '#ffe066' : '#4A2C2A';
    ctx.stroke();

    if (tl.img) {
      UI.drawContainImage(ctx, tl.img, cx, cy, toolSize * 0.72, toolSize * 0.72);
    }

    const badgeStr = cnt > 0 ? String(cnt) : `${cost}`;
    const bw = cnt > 0 ? 20 : 32;
    const bbx = tx + toolSize - bw * 0.65;
    const bby = ty - 3;
    UI.drawTagBadge(ctx, bbx, bby, bw, 17, badgeStr, cnt > 0 ? 'cocoa' : 'amber', 9.5);

    const capW = toolSize + 18;
    UI.drawTagBadge(ctx, cx - capW * 0.5, ty + toolSize + 1, capW, 15, tl.label, 'cocoa', 9);
    ctx.restore();

    hits.add(`tool_${tl.key}`, tx - 4, ty - 4, toolSize + 8, toolSize + 18, () => app.armOrUseTool(tl.key));
  };

  drawSideTool({ key: 'shake', label: '摇一摇', img: sprites.tools.shake }, centerX - heroSize * 0.5 - dockGap - toolSize * 0.5, sideY);
  drawSideTool({ key: 'spoon', label: '升阶勺', img: sprites.tools.spoon }, centerX + heroSize * 0.5 + dockGap + toolSize * 0.5, sideY);

  // Center Hero Signature Chef Skill Medallion
  {
    const hcx = centerX;
    const hcy = heroY + heroSize * 0.5;
    const hr = heroSize * 0.5;
    const pct = Math.max(0, Math.min(1, gameState.skillEnergy / 100));
    const isReady = pct >= 1 || gameState.nextShotMeteor;
    const isArmed = !!gameState.activeSkillMode || gameState.nextShotMeteor;
    const pulse = isReady ? 1 + Math.sin(nowSec * 7) * 0.045 : 1;

    ctx.save();
    ctx.translate(hcx, hcy);
    ctx.scale(pulse, pulse);

    if (isReady) {
      ctx.strokeStyle = isArmed ? 'rgba(255, 214, 128, 0.9)' : 'rgba(255, 226, 110, 0.84)';
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.arc(0, 0, hr + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    const hbg = ctx.createRadialGradient(-4, -6, 4, 0, 0, hr);
    if (isReady) {
      hbg.addColorStop(0, '#fff9d6');
      hbg.addColorStop(0.65, '#f6be42');
      hbg.addColorStop(1, '#b56014');
    } else {
      hbg.addColorStop(0, '#f3e2c4');
      hbg.addColorStop(0.7, '#ba8c56');
      hbg.addColorStop(1, '#7a4d24');
    }
    ctx.fillStyle = hbg;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = isArmed ? '#ffe57e' : '#4A2C2A';
    ctx.stroke();

    const pImg = sprites.patrons[activePatron.id];
    if (pImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, hr - 4, 0, Math.PI * 2);
      ctx.clip();
      if (!isReady) ctx.globalAlpha = 0.72;
      UI.drawContainImage(ctx, pImg, 0, 1, heroSize * 0.84, heroSize * 0.84);
      ctx.restore();
    }

    ctx.lineWidth = 3.6;
    ctx.strokeStyle = 'rgba(42, 22, 10, 0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, hr - 1.5, 0, Math.PI * 2);
    ctx.stroke();

    if (pct > 0.01) {
      ctx.strokeStyle = isReady ? '#fff28c' : '#ffd875';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, hr - 1.5, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 2 * pct);
      ctx.stroke();
    }
    ctx.restore();

    const pillTxt = gameState.nextShotMeteor ? '已装填' : isReady ? '就绪' : `${Math.floor(gameState.skillEnergy)}%`;
    const pbw = isReady ? 42 : 34;
    const pbx = hcx + hr - pbw * 0.55;
    const pby = heroY - 4;
    UI.drawTagBadge(ctx, pbx, pby, pbw, 17, pillTxt, isReady ? 'amber' : 'cocoa', 9);

    const capW = heroSize + 28;
    UI.drawTagBadge(ctx, hcx - capW * 0.5, heroY + heroSize - 1, capW, 16, activeSk.name, isReady ? 'amber' : 'cocoa', 9.2);

    const skillRect = { x: hcx - hr - 8, y: heroY - 5, w: heroSize + 16, h: heroSize + 22 };
    guideTargets.skill = skillRect;
    guideTargets.dock = {
      x: centerX - heroSize * 0.5 - dockGap - toolSize - 8,
      y: heroY - 5,
      w: heroSize + (dockGap + toolSize) * 2 + 16,
      h: heroSize + 24
    };
    hits.add('chef_skill_btn', skillRect.x, skillRect.y, skillRect.w, skillRect.h, () => app.activateChefSkill());
  }

  app.lastGuideTargets = guideTargets;
}

function drawMiniRelicStrip(ctx, x, y, w, h, relics, hits, hitId, onClick, isLightBg = false) {
  const gap = 4;
  const slotW = (w - gap * (MAX_RELIC_SLOTS - 1)) / MAX_RELIC_SLOTS;
  for (let i = 0; i < MAX_RELIC_SLOTS; i++) {
    const sx = x + i * (slotW + gap);
    const rid = relics && relics[i];
    const def = rid ? RELICS.find((r) => r.id === rid) : null;
    const arch = def ? RELIC_ARCHETYPES[def.archetype] : null;
    UI.roundRectPath(ctx, sx, y, slotW, h, 5);
    ctx.fillStyle = def
      ? (arch ? arch.bg : '#fff4cf')
      : isLightBg
        ? '#f0e2c6'
        : 'rgba(255, 240, 206, 0.22)';
    ctx.fill();
    ctx.lineWidth = def ? 1.4 : isLightBg ? 1.2 : 1.0;
    ctx.strokeStyle = def
      ? (arch ? arch.color : '#c48a28')
      : isLightBg
        ? '#bfa278'
        : 'rgba(232, 198, 138, 0.45)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (def) {
      ctx.font = UI.fontStr(Math.min(14, h - 4), 700);
      ctx.fillStyle = '#4A2C2A';
      ctx.fillText(def.icon, sx + slotW * 0.5, y + h * 0.5 + 0.5);
    } else {
      ctx.font = UI.fontStr(isLightBg ? 11 : 9, 700);
      ctx.fillStyle = isLightBg ? '#a0825a' : 'rgba(255, 232, 186, 0.52)';
      ctx.fillText('✦', sx + slotW * 0.5, y + h * 0.5 + 0.5);
    }
  }
  hits.add(hitId, x, y, w, h, onClick);
}

function renderMobileTopHud(ctx, x, y, w, h, app, hits, nowSec, guideTargets) {
  const { gameState, sprites } = app;
  const previewCardW = 114;
  const gap = 6;
  const statsW = w - previewCardW - gap;

  UI.drawParchmentSheet(ctx, x, y, statsW, h, 11);
  guideTargets.hud = { x, y, w: statsW, h };

  if (gameState.mode === 'chef') {
    const revStr = `¥${gameState.displayShiftRevenue}`;
    const tgtStr = `/¥${gameState.shiftTarget}`;
    const lowSteps = gameState.stepsLeft <= 3;

    // Recipe Coins Chip with `icon_coin`
    const coinVal = String(gameState.coins || 0);
    const coinW = Math.max(44, 24 + coinVal.length * 7.5);
    const coinX = x + statsW - coinW - 6;
    UI.drawCurrencyChip(ctx, coinX, y + 6, coinW, 19, sprites, 'icon_coin', coinVal, {
      style: 'wood',
      fontSize: 10
    });

    const stepStr = `步 ${gameState.stepsLeft}/${gameState.stepsMax}`;
    const stepW = 56;
    const stepX = coinX - stepW - 4;
    UI.drawTagBadge(ctx, stepX, y + 6, stepW, 19, stepStr, lowSteps ? 'berry' : 'soft', 9.6);

    const revMaxW = Math.max(58, stepX - (x + 8) - 4);
    UI.drawFitText(ctx, `${revStr}${tgtStr}`, x + 8, y + 15.5, revMaxW, 14.5, 10, 900, '#4A2C2A');

    // Middle Row: Revenue Progress Bar OR Golden Early-Close CTA Button
    const barX = x + 8;
    const barW = statsW - 16;
    const barY = y + 29;
    const barH = 20;
    if (gameState.shiftClearedFlag && gameState.running && !gameState.over) {
      const interestCoins = gameState.stepsLeft * 4;
      UI.drawPillButton(ctx, barX, barY, barW, barH, {
        style: 'cta',
        icon: 'serve_bell',
        sprites,
        iconSize: 14,
        text: interestCoins > 0 ? `立即打烊 (+${interestCoins}币息)` : '达标！点击立即打烊',
        fontSize: 10.5,
        fontWeight: 900,
        radius: 10
      });
      hits.add('btn_close_shift_early', barX, barY, barW, barH, () => app.closeShiftEarly());
    } else {
      const revFrac = Math.max(0, Math.min(1, gameState.shiftRevenue / Math.max(1, gameState.shiftTarget)));
      UI.roundRectPath(ctx, barX, barY + 3, barW, 13, 6.5);
      ctx.fillStyle = '#dfd0b2';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = '#4A2C2A';
      ctx.stroke();
      if (revFrac > 0.01) {
        UI.roundRectPath(ctx, barX + 1, barY + 4, Math.max(8, (barW - 2) * revFrac), 11, 5.5);
        const rg = ctx.createLinearGradient(barX, barY, barX + barW, barY);
        rg.addColorStop(0, '#f0a63a');
        rg.addColorStop(0.55, '#ffd75e');
        rg.addColorStop(1, '#ff9f5a');
        ctx.fillStyle = rg;
        ctx.fill();
      }
      ctx.fillStyle = '#4A2C2A';
      ctx.font = UI.fontStr(9, 900);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`营业进度 ${Math.min(100, Math.floor(revFrac * 100))}%`, barX + barW * 0.5, barY + 9.8);
    }

    // Bottom Micro Row: Fever + Rainbow Pity + Run Stardust
    const isFever = gameState.feverTimer > 0;
    const multVal = app.getFeverMultiplier();
    const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
    const fTxt = isFever ? `狂热 ${multStr} (${gameState.feverTimer.toFixed(1)}s)` : `星光 ${Math.round(gameState.feverEnergy)}%`;
    const rReady = !!(gameState.curMeta.wildcard || gameState.nextMeta.wildcard);
    const rTxt = rReady ? '彩虹就绪!' : `彩虹 ${gameState.dropsUntilRainbow}步`;
    const botY = y + 61;
    UI.drawFitText(ctx, fTxt, x + 8, botY, statsW * 0.44, 9.5, 8, 800, isFever ? '#c43c12' : '#6c4424');
    UI.drawFitText(ctx, rTxt, x + statsW * 0.57, botY, 58, 9.2, 8, 800, rReady ? '#b42b62' : '#5e3c24', 'center');

    const dustStr = String(gameState.stardust);
    UI.drawUiIcon(ctx, sprites, 'icon_stardust', x + statsW - 28, botY, 13);
    UI.drawFitText(ctx, dustStr, x + statsW - 7, botY, 24, 9.8, 8.2, 800, '#7e4b10', 'right');

    // Right Wooden Preview Card: NEXT + HOLD + 4 Mini Relic Slots
    const px = x + statsW + gap;
    UI.drawWoodBoard(ctx, px, y, previewCardW, h, 11, false);
    const boxS = 35;
    const nx = px + 11;
    const hx = px + previewCardW - 11 - boxS;
    const by = y + 14;

    ctx.fillStyle = '#ffe8b8';
    ctx.font = UI.fontStr(8.5, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('下一颗', nx + boxS * 0.5, y + 8);
    ctx.fillText('暂存', hx + boxS * 0.5, y + 8);

    drawMiniPreviewBox(ctx, nx, by, boxS, gameState.nextTier, gameState.nextMeta, sprites, nowSec, false);
    drawMiniPreviewBox(ctx, hx, by, boxS, gameState.holdTier, gameState.holdMeta, sprites, nowSec, true);
    guideTargets.hold = { x: px, y, w: previewCardW, h: 52 };
    hits.add('mobile_hold_swap', hx - 3, y, boxS + 6, 51, () => app.swapHoldPocket());

    drawMiniRelicStrip(ctx, px + 7, y + 52, previewCardW - 14, 17, gameState.relics, hits, 'mobile_relics_bar', () =>
      app.openRelicsModal()
    );
    return;
  }

  // Rush & Zen Mode Top HUD
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(10.5, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('得分', x + 8, y + 16);

  const scoreStr = String(gameState.displayScore);
  UI.drawFitText(ctx, scoreStr, x + 34, y + 16, Math.max(46, statsW - 144), 19, 13, 900, '#4A2C2A');

  const dustVal = String(gameState.stardust);
  const dustW = Math.max(48, 26 + dustVal.length * 7.5);
  UI.drawCurrencyChip(ctx, x + statsW - dustW - 7, y + 6, dustW, 19, sprites, 'icon_stardust', dustVal, {
    style: 'wood',
    fontSize: 10
  });

  UI.drawFitText(
    ctx,
    `最高 ${app.getBestScore()}`,
    x + statsW - dustW - 12,
    y + 16.5,
    62,
    10,
    8.5,
    700,
    '#724640',
    'right'
  );

  const isFever = gameState.feverTimer > 0;
  const multVal = app.getFeverMultiplier();
  const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
  const fLabel = isFever ? `狂热 ${multStr}` : '星光能量';
  const fPct = isFever ? `${gameState.feverTimer.toFixed(1)}s` : `${Math.round(gameState.feverEnergy)}%`;

  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(10, 800);
  ctx.textAlign = 'left';
  ctx.fillText(fLabel, x + 8, y + 36);

  const rReady = !!(gameState.curMeta.wildcard || gameState.nextMeta.wildcard);
  const rTxt = rReady ? '彩虹就绪!' : `彩虹 ${gameState.dropsUntilRainbow}步`;
  UI.drawTagBadge(ctx, x + statsW * 0.5 - 28, y + 29, 56, 14, rTxt, rReady ? 'amber' : 'plum', 8.8);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(10, 800);
  ctx.fillText(fPct, x + statsW - 8, y + 36);

  const tx = x + 8;
  const tw = statsW - 16;
  const ty = y + 46;
  UI.roundRectPath(ctx, tx, ty, tw, 9, 4.5);
  ctx.fillStyle = '#dfd0b2';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();

  const frac = isFever
    ? Math.max(0, Math.min(1, gameState.feverTimer / Math.max(1, gameState.feverMaxDuration)))
    : Math.max(0, Math.min(1, gameState.feverEnergy / 100));
  if (frac > 0.01) {
    ctx.save();
    UI.roundRectPath(ctx, tx + 1, ty + 1, Math.max(6, (tw - 2) * frac), 7, 3.5);
    const fg = ctx.createLinearGradient(tx, ty, tx + tw, ty);
    if (isFever) {
      fg.addColorStop(0, '#ff82a9');
      fg.addColorStop(0.5, '#ffd659');
      fg.addColorStop(1, '#7cc6fe');
    } else {
      fg.addColorStop(0, '#f3a642');
      fg.addColorStop(0.5, '#ffd659');
      fg.addColorStop(1, '#ff8f8f');
    }
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.restore();
  }

  // Right NEXT & HOLD Wooden Preview Card
  const px = x + statsW + gap;
  UI.drawWoodBoard(ctx, px, y, previewCardW, h, 11, false);
  const boxS = 40;
  const nx = px + 10;
  const hx = px + previewCardW - 10 - boxS;
  const by = y + 16;

  ctx.fillStyle = '#ffe8b8';
  ctx.font = UI.fontStr(9, 900);
  ctx.textAlign = 'center';
  ctx.fillText('下一颗', nx + boxS * 0.5, y + 9);
  ctx.fillText('暂存', hx + boxS * 0.5, y + 9);

  drawMiniPreviewBox(ctx, nx, by, boxS, gameState.nextTier, gameState.nextMeta, sprites, nowSec, false);
  drawMiniPreviewBox(ctx, hx, by, boxS, gameState.holdTier, gameState.holdMeta, sprites, nowSec, true);
  guideTargets.hold = { x: px, y, w: previewCardW, h };
  hits.add('mobile_hold_swap', hx - 3, y, boxS + 6, h, () => app.swapHoldPocket());
}

function drawMiniPreviewBox(ctx, x, y, size, tier, meta, sprites, nowSec, isHold) {
  const isWild = !!(meta && meta.wildcard);
  const isGold = !isWild && !!(meta && meta.golden);
  UI.roundRectPath(ctx, x, y, size, size, 9);
  ctx.fillStyle = isWild ? '#ffe6f3' : isGold ? '#fff4be' : '#f5e6c4';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = isWild ? '#d64d84' : isGold ? '#d99b1e' : '#4A2C2A';
  ctx.stroke();

  if (!tier) {
    if (isHold) {
      ctx.fillStyle = '#8a6544';
      ctx.font = UI.fontStr(10.5, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('点换', x + size * 0.5, y + size * 0.5 + 0.5);
    }
    return;
  }
  if (isWild) {
    UI.drawRainbowWildcard(ctx, x + size * 0.5, y + size * 0.5, size * 0.34, 0, nowSec, 1);
  } else if (sprites.base[tier]) {
    UI.drawContainImage(ctx, sprites.base[tier], x + size * 0.5, y + size * 0.5, size * 0.78, size * 0.78);
  }
}

function hasTierReadyInJar(gameState, tier) {
  return gameState.entities.some((e) => !e.merged && !e.isWildcard && !e.isYarnBall && !(e.frozenHp > 0) && e.tier === tier);
}

function renderMobileSubBar(ctx, x, y, w, h, app, hits, guideTargets) {
  const { gameState, sprites } = app;
  UI.drawParchmentSheet(ctx, x, y, w, h, 9);
  guideTargets.orderBar = { x, y, w, h };

  if (gameState.mode === 'rush') {
    const urgent = gameState.rushTimer <= 15.0;
    UI.drawUiIcon(ctx, sprites, 'mode_rush', x + 16, y + h * 0.5, 20);
    ctx.fillStyle = urgent ? '#d93025' : '#a8360c';
    ctx.font = UI.fontStr(14.5, 900);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.max(0, gameState.rushTimer).toFixed(1)}s`, x + 28, y + h * 0.5 + 0.5);

    const orders = gameState.orders || [];
    let sx = x + 84;
    ctx.fillStyle = '#7e4b10';
    ctx.font = UI.fontStr(9.5, 800);
    ctx.fillText('上菜+3s:', sx, y + h * 0.5 + 0.5);
    sx += 44;
    const shownTiers = [];
    for (let oi = 0; oi < orders.length; oi++) {
      const o = orders[oi];
      if (!o || o.completed) continue;
      for (let si = 0; si < o.slots.length; si++) {
        if (!o.slots[si].done && shownTiers.length < 3) shownTiers.push(o.slots[si].tier);
      }
    }
    for (let i = 0; i < shownTiers.length; i++) {
      const t = shownTiers[i];
      const ready = hasTierReadyInJar(gameState, t);
      UI.roundRectPath(ctx, sx, y + 5, 24, 24, 6);
      ctx.fillStyle = ready ? '#fff0a8' : '#fff9eb';
      ctx.fill();
      ctx.lineWidth = ready ? 1.8 : 1.2;
      ctx.strokeStyle = ready ? '#d47c12' : '#bfa06f';
      ctx.stroke();
      if (sprites.base[t]) {
        UI.drawContainImage(ctx, sprites.base[t], sx + 12, y + 17, 19, 19);
      }
      sx += 27;
    }

    UI.drawUiIcon(ctx, sprites, 'icon_gift', x + w - 58, y + h * 0.5, 15);
    UI.drawFitText(ctx, `${gameState.rushNextMilestone}分`, x + w - 8, y + h * 0.5, 44, 9.8, 8, 800, '#724640', 'right');
    return;
  }

  if (gameState.mode === 'zen') {
    UI.drawUiIcon(ctx, sprites, 'mode_zen', x + 17, y + h * 0.5, 19);
    UI.drawFitText(ctx, '中央定角弹射 · 探索 9 阶甜品异能', x + 30, y + h * 0.5, w - 118, 10.5, 8.8, 800, '#4A2C2A');

    UI.drawUiIcon(ctx, sprites, 'icon_gift', x + w - 62, y + h * 0.5, 15);
    UI.drawFitText(ctx, `${gameState.zenNextMilestone}分`, x + w - 8, y + h * 0.5, 46, 10, 8.5, 800, '#8f4e1b', 'right');
    return;
  }

  // Chef Mode: Compact Dual-Table Order Strip
  const orders = gameState.orders || [];
  const skipCooling = gameState.skipCooldown > 0;
  const skipTxt = skipCooling ? `${Math.ceil(gameState.skipCooldown)}s` : '换单';
  const skW = 40;
  const skX = x + w - skW - 5;
  UI.drawPillButton(ctx, skX, y + 6, skW, 22, {
    style: 'wood',
    text: skipTxt,
    fontSize: 9.5,
    disabled: skipCooling
  });
  hits.add('m_skip_order', skX, y + 4, skW, 26, () => app.skipOrder());

  let cx = x + 6;
  const maxRightX = skX - 6;
  for (let oi = 0; oi < orders.length; oi++) {
    const ord = orders[oi];
    if (!ord) continue;
    const isJudge = !!ord.isJudgeRush;
    const isVip = ord.kind === 'vip';
    const anyReady = !ord.completed && ord.slots.some((s) => !s.done && hasTierReadyInJar(gameState, s.tier));
    const slotCnt = ord.slots.length;
    const chipW = Math.min(maxRightX - cx, 42 + slotCnt * 26 + 26);
    if (chipW < 54) break;

    UI.roundRectPath(ctx, cx, y + 3, chipW, h - 6, 7);
    ctx.fillStyle = isJudge
      ? '#ffe6bf'
      : anyReady
      ? '#fff2c2'
      : isVip
      ? '#fbf0e6'
      : '#fff9ec';
    ctx.fill();
    ctx.lineWidth = anyReady || isJudge ? 1.8 : 1.2;
    ctx.strokeStyle = isJudge
      ? '#c95614'
      : anyReady
      ? '#cf8214'
      : isVip
      ? '#be8c68'
      : '#c7a46e';
    ctx.stroke();

    ctx.fillStyle = isJudge ? '#b4320c' : isVip ? '#8c3818' : '#7a4512';
    ctx.font = UI.fontStr(9.5, 900);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(isJudge ? '急单' : isVip ? 'VIP' : '快餐', cx + 5, y + h * 0.5 + 0.5);

    let sx = cx + (isVip ? 28 : 30);
    for (let si = 0; si < slotCnt; si++) {
      const sl = ord.slots[si];
      const slotReady = !sl.done && hasTierReadyInJar(gameState, sl.tier);
      UI.roundRectPath(ctx, sx, y + 5, 23, 23, 6);
      ctx.fillStyle = sl.done ? '#e3f7e8' : slotReady ? '#ffe88c' : '#fffdf6';
      ctx.fill();
      ctx.lineWidth = slotReady ? 1.6 : 1.1;
      ctx.strokeStyle = sl.done ? '#3f9663' : slotReady ? '#d47c12' : '#bfa06f';
      ctx.stroke();
      if (sprites.base[sl.tier]) {
        UI.drawContainImage(ctx, sprites.base[sl.tier], sx + 11.5, y + 16.5, 18, 18);
      }
      if (sl.done) {
        ctx.fillStyle = '#3f9663';
        ctx.beginPath();
        ctx.arc(sx + 20, y + 7, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = UI.fontStr(7.5, 900);
        ctx.textAlign = 'center';
        ctx.fillText('✓', sx + 20, y + 7.5);
      }
      sx += 25;
    }

    if (cx + chipW - sx >= 20) {
      ctx.fillStyle = ord.freshSteps > 0 ? '#b44810' : '#9c836a';
      ctx.font = UI.fontStr(8.5, 800);
      ctx.textAlign = 'right';
      ctx.fillText(ord.freshSteps > 0 ? `${ord.freshSteps}步` : '常', cx + chipW - 4, y + h * 0.5 + 0.5);
    }

    cx += chipW + 5;
  }
}

function renderWideLeftBoard(ctx, x, y, w, h, app, hits, nowSec, guideTargets) {
  const { gameState, sprites, activePatron } = app;
  UI.drawWoodBoard(ctx, x, y, w, h, 16);
  const ix = x + 10;
  const iw = w - 20;

  if (gameState.mode === 'chef') {
    const headH = gameState.shiftClearedFlag ? 104 : 88;
    UI.drawParchmentSheet(ctx, ix, y + 10, iw, headH, 10);
    guideTargets.hud = { x: ix, y: y + 10, w: iw, h: headH };

    const lowSteps = gameState.stepsLeft <= 3;
    UI.drawFitText(ctx, `第 ${gameState.shift} 幕 · ${gameState.shiftName}`, ix + 9, y + 23, iw - 78, 11.2, 9, 900, '#4A2C2A');
    UI.drawCurrencyChip(ctx, ix + iw - 64, y + 13, 56, 20, sprites, 'icon_coin', String(gameState.coins || 0), {
      style: 'wood',
      fontSize: 10
    });

    UI.drawFitText(
      ctx,
      `¥${gameState.displayShiftRevenue} / ¥${gameState.shiftTarget}`,
      ix + 9,
      y + 44,
      iw - 78,
      17.5,
      12,
      900,
      '#4A2C2A'
    );
    UI.drawTagBadge(ctx, ix + iw - 68, y + 35, 60, 18, `步 ${gameState.stepsLeft}/${gameState.stepsMax}`, lowSteps ? 'berry' : 'soft', 9.5);

    const revFrac = Math.max(0, Math.min(1, gameState.shiftRevenue / Math.max(1, gameState.shiftTarget)));
    UI.roundRectPath(ctx, ix + 9, y + 59, iw - 18, 11, 5.5);
    ctx.fillStyle = '#dfd0b2';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();
    if (revFrac > 0.01) {
      UI.roundRectPath(ctx, ix + 10, y + 60, Math.max(8, (iw - 20) * revFrac), 9, 4.5);
      const rg = ctx.createLinearGradient(ix + 10, y + 60, ix + iw - 10, y + 60);
      rg.addColorStop(0, '#f0a63a');
      rg.addColorStop(0.55, '#ffd75e');
      rg.addColorStop(1, '#ff9f5a');
      ctx.fillStyle = rg;
      ctx.fill();
    }

    if (gameState.shiftClearedFlag && gameState.running && !gameState.over) {
      const remCoins = gameState.stepsLeft * 4;
      const btnY = y + 76;
      UI.drawPillButton(ctx, ix + 9, btnY, iw - 18, 26, {
        style: 'cta',
        icon: 'serve_bell',
        sprites,
        text: remCoins > 0 ? `立即打烊 (+${remCoins}币息)` : '达标 · 立即打烊',
        fontSize: 11,
        fontWeight: 900,
        radius: 10
      });
      hits.add('btn_close_shift_early', ix + 9, btnY, iw - 18, 26, () => app.closeShiftEarly());
    } else {
      UI.drawFitText(
        ctx,
        `累计 ¥${gameState.displayScore} · 最高 ${app.getBestScore()}`,
        ix + 9,
        y + 84,
        iw - 68,
        10,
        8.5,
        700,
        '#724640'
      );
      UI.drawUiIcon(ctx, sprites, 'icon_stardust', ix + iw - 42, y + 84, 14);
      UI.drawFitText(ctx, String(gameState.stardust), ix + iw - 9, y + 84, 28, 10.5, 8.5, 800, '#7e4b10', 'right');
    }

    const sy = y + 10 + headH + 8;
    const sh = h - (headH + 28);
    UI.drawParchmentSheet(ctx, ix, sy, iw, sh, 10);

    const isFever = gameState.feverTimer > 0;
    const multVal = app.getFeverMultiplier();
    const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
    ctx.fillStyle = '#4A2C2A';
    ctx.font = UI.fontStr(11, 800);
    ctx.textAlign = 'left';
    ctx.fillText(isFever ? `磁吸狂热 ${multStr}` : '星光能量槽', ix + 10, sy + 14);
    ctx.textAlign = 'right';
    ctx.fillText(isFever ? `${gameState.feverTimer.toFixed(1)}s` : `${Math.round(gameState.feverEnergy)}%`, ix + iw - 10, sy + 14);

    UI.roundRectPath(ctx, ix + 10, sy + 23, iw - 20, 10, 5);
    ctx.fillStyle = '#dfd0b2';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();
    const frac = isFever ? Math.min(1, gameState.feverTimer / Math.max(1, gameState.feverMaxDuration)) : Math.min(1, gameState.feverEnergy / 100);
    if (frac > 0.01) {
      UI.roundRectPath(ctx, ix + 11, sy + 24, Math.max(6, (iw - 22) * frac), 8, 4);
      ctx.fillStyle = isFever ? '#ff99c8' : '#ffd659';
      ctx.fill();
    }

    const rReady = !!(gameState.curMeta.wildcard || gameState.nextMeta.wildcard);
    const multInfo = app.getGlobalRevenueMult();
    const multBadge = multInfo > 1.05 ? ` · 全局×${multInfo.toFixed(2)}` : '';
    UI.drawFitText(
      ctx,
      `${rReady ? '彩虹万能糖就绪!' : `彩虹保底: ${gameState.dropsUntilRainbow}步`}${multBadge}`,
      ix + 10,
      sy + 44,
      iw - 20,
      10.5,
      8.5,
      800,
      rReady ? '#b42b62' : '#4A2C2A'
    );

    const py = sy + 56;
    ctx.fillStyle = '#ecd5a8';
    ctx.beginPath();
    ctx.arc(ix + 31, py + 24, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();
    const speechPatron = gameState.speechPatron || activePatron;
    if (sprites.patrons[speechPatron.id]) {
      UI.drawContainImage(ctx, sprites.patrons[speechPatron.id], ix + 31, py + 24, 38, 38);
    }
    UI.drawKissaCard(ctx, ix + 58, py, iw - 68, 62, { radius: 9 });
    UI.drawFitText(ctx, speechPatron.name, ix + 65, py + 11, iw - 82, 10.5, 8.5, 800, '#8f4e1b');
    UI.drawWrappedText(
      ctx,
      gameState.speechText || speechPatron.greet,
      ix + 65,
      py + 20,
      iw - 82,
      13,
      UI.fontStr(10, 600),
      '#4A2C2A',
      'left',
      3
    );

    // Dual-Table Order Panel
    const oy = py + 70;
    const oh = sy + sh - 8 - oy;
    UI.drawKissaCard(ctx, ix + 8, oy, iw - 16, oh, { tone: 'soft', radius: 9 });
    guideTargets.orderBar = { x: ix + 8, y: oy, w: iw - 16, h: oh };
    UI.drawUiIcon(ctx, sprites, 'serve_bell', ix + 21, oy + 14, 15);
    UI.drawFitText(ctx, '双桌点单 · 点罐内上菜', ix + 31, oy + 14, iw - 102, 11, 9, 900, '#4A2C2A');
    const cooling = gameState.skipCooldown > 0;
    UI.drawPillButton(ctx, ix + iw - 64, oy + 4, 48, 20, {
      style: 'wood',
      text: cooling ? `${Math.ceil(gameState.skipCooldown)}s` : '换单',
      fontSize: 9.5,
      disabled: cooling
    });
    hits.add('wide_skip_order', ix + iw - 64, oy + 4, 48, 20, () => app.skipOrder());

    const orders = gameState.orders || [];
    const rowH = Math.max(54, Math.floor((oh - 34) / 2));
    for (let oi = 0; oi < orders.length; oi++) {
      const ord = orders[oi];
      if (!ord) continue;
      const isJudge = !!ord.isJudgeRush;
      const isVip = ord.kind === 'vip';
      const ry = oy + 28 + oi * (rowH + 5);
      const anyReady = !ord.completed && ord.slots.some((s) => !s.done && hasTierReadyInJar(gameState, s.tier));
      UI.drawKissaCard(ctx, ix + 14, ry, iw - 28, rowH, {
        tone: anyReady || isJudge ? 'selected' : 'cream',
        radius: 8
      });

      UI.drawFitText(
        ctx,
        isJudge ? '评委急单 · +2步!' : isVip ? 'VIP套餐 · +8币' : '快餐桌 · 抽底',
        ix + 21,
        ry + 12,
        iw - 96,
        10.2,
        8.5,
        900,
        isJudge ? '#b4320c' : isVip ? '#8c3818' : '#7a4512'
      );
      UI.drawFitText(
        ctx,
        ord.freshSteps > 0 ? `鲜度 ${ord.freshSteps}步` : ord.staleMult < 1 ? '冷盘×0.75' : '常规价',
        ix + iw - 20,
        ry + 12,
        58,
        9,
        7.8,
        800,
        ord.freshSteps > 0 ? '#b44810' : '#8a725a',
        'right'
      );

      let sx = ix + 21;
      for (let si = 0; si < ord.slots.length; si++) {
        const sl = ord.slots[si];
        const slotReady = !sl.done && hasTierReadyInJar(gameState, sl.tier);
        UI.roundRectPath(ctx, sx, ry + 21, 26, 26, 7);
        ctx.fillStyle = sl.done ? '#e3f7e8' : slotReady ? '#ffe88c' : '#fffdf6';
        ctx.fill();
        ctx.lineWidth = slotReady ? 1.8 : 1.2;
        ctx.strokeStyle = sl.done ? '#3f9663' : slotReady ? '#d47c12' : '#bfa06f';
        ctx.stroke();
        if (sprites.base[sl.tier]) {
          UI.drawContainImage(ctx, sprites.base[sl.tier], sx + 13, ry + 34, 21, 21);
        }
        if (sl.done) {
          ctx.fillStyle = '#3f9663';
          ctx.beginPath();
          ctx.arc(sx + 23, ry + 24, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = UI.fontStr(7.5, 900);
          ctx.textAlign = 'center';
          ctx.fillText('✓', sx + 23, ry + 24.5);
        }
        sx += 30;
      }

      const infoX = ix + iw - 20;
      UI.drawFitText(
        ctx,
        anyReady ? '点罐内上菜!' : `完单 +¥${ord.bonusScore}`,
        infoX,
        ry + 34,
        iw - 28 - (sx - ix),
        9.6,
        8,
        800,
        anyReady ? '#b4320c' : '#724640',
        'right'
      );

      if (rowH >= 66) {
        const namesStr = ord.slots.map((sl) => TIERS[sl.tier - 1].name).join(' + ');
        UI.drawFitText(ctx, namesStr, ix + 21, ry + rowH - 21, iw - 42, 9.2, 8, 700, '#5c3824');
        UI.drawFitText(
          ctx,
          `赏金 +¥${ord.bonusScore} · +${ord.rewardDust}星尘${isVip ? ' · 送祝福' : ''}`,
          ix + 21,
          ry + rowH - 9,
          iw - 42,
          9,
          7.8,
          800,
          isVip ? '#8c3818' : '#8a5018'
        );
      }
    }
    return;
  }

  // Rush & Zen Wide Left Board
  UI.drawParchmentSheet(ctx, ix, y + 10, iw, 74, 10);
  guideTargets.hud = { x: ix, y: y + 10, w: iw, h: 74 };
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(11, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(app.hasSouffleAura() ? '猫神光环 ×2 · 烘焙积分' : '烘焙积分', ix + iw * 0.5, y + 22);
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(24, 900);
  ctx.fillText(String(gameState.displayScore), ix + iw * 0.5, y + 44);
  UI.drawFitText(ctx, `最高: ${app.getBestScore()}`, ix + 10, y + 70, iw * 0.52, 11.5, 9, 700, '#724640');
  UI.drawUiIcon(ctx, sprites, 'icon_stardust', ix + iw - 46, y + 70, 15);
  UI.drawFitText(ctx, String(gameState.stardust), ix + iw - 10, y + 70, 32, 11.5, 9, 800, '#7e4b10', 'right');

  const sy = y + 92;
  const sh = h - 102;
  UI.drawParchmentSheet(ctx, ix, sy, iw, sh, 10);

  const isFever = gameState.feverTimer > 0;
  const multVal = app.getFeverMultiplier();
  const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(11.5, 800);
  ctx.textAlign = 'left';
  ctx.fillText(isFever ? `磁吸狂热 ${multStr}` : '星光能量槽', ix + 10, sy + 16);
  ctx.textAlign = 'right';
  ctx.fillText(isFever ? `${gameState.feverTimer.toFixed(1)}s` : `${Math.round(gameState.feverEnergy)}%`, ix + iw - 10, sy + 16);

  UI.roundRectPath(ctx, ix + 10, sy + 26, iw - 20, 12, 6);
  ctx.fillStyle = '#dfd0b2';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();
  const frac = isFever ? Math.min(1, gameState.feverTimer / Math.max(1, gameState.feverMaxDuration)) : Math.min(1, gameState.feverEnergy / 100);
  if (frac > 0.01) {
    UI.roundRectPath(ctx, ix + 11, sy + 27, Math.max(6, (iw - 22) * frac), 10, 5);
    ctx.fillStyle = isFever ? '#ff99c8' : '#ffd659';
    ctx.fill();
  }

  const rReady = !!(gameState.curMeta.wildcard || gameState.nextMeta.wildcard);
  UI.drawFitText(
    ctx,
    rReady ? '彩虹万能糖准备就绪!' : `彩虹保底: ${gameState.dropsUntilRainbow} 步`,
    ix + 10,
    sy + 50,
    iw - 20,
    11,
    9,
    800,
    rReady ? '#b42b62' : '#4A2C2A'
  );

  const py = sy + 64;
  ctx.fillStyle = '#ecd5a8';
  ctx.beginPath();
  ctx.arc(ix + 34, py + 28, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();
  const speechPatron = gameState.speechPatron || activePatron;
  if (sprites.patrons[speechPatron.id]) {
    UI.drawContainImage(ctx, sprites.patrons[speechPatron.id], ix + 34, py + 28, 42, 42);
  }
  UI.drawKissaCard(ctx, ix + 64, py, iw - 74, 72, { radius: 9 });
  UI.drawFitText(ctx, speechPatron.name, ix + 71, py + 11, iw - 88, 11, 9, 800, '#8f4e1b');
  UI.drawWrappedText(
    ctx,
    gameState.speechText || speechPatron.greet,
    ix + 71,
    py + 21,
    iw - 88,
    14,
    UI.fontStr(10.5, 600),
    '#4A2C2A',
    'left',
    3
  );

  const oy = py + 82;
  const oh = sy + sh - 10 - oy;
  UI.drawKissaCard(ctx, ix + 8, oy, iw - 16, oh, { tone: 'soft', radius: 9 });
  guideTargets.orderBar = { x: ix + 8, y: oy, w: iw - 16, h: oh };
  if (gameState.mode === 'rush') {
    UI.drawFitText(ctx, '弹射狂欢 · 点击上菜 +3.0s', ix + 16, oy + 16, iw - 32, 11.5, 9.5, 800, '#4A2C2A');
    ctx.fillStyle = gameState.rushTimer <= 15 ? '#d93025' : '#a63d0c';
    ctx.font = UI.fontStr(24, 900);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, gameState.rushTimer).toFixed(1)}s`, ix + iw * 0.5, oy + 46);
    const rushOrders = gameState.orders || [];
    let rx = ix + 20;
    for (let oi = 0; oi < rushOrders.length; oi++) {
      const ord = rushOrders[oi];
      if (!ord || ord.completed) continue;
      for (let si = 0; si < ord.slots.length; si++) {
        const sl = ord.slots[si];
        if (sl.done) continue;
        const ready = hasTierReadyInJar(gameState, sl.tier);
        UI.roundRectPath(ctx, rx, oy + 64, 34, 34, 8);
        ctx.fillStyle = ready ? '#ffe88c' : '#fff9eb';
        ctx.fill();
        ctx.lineWidth = ready ? 2 : 1.3;
        ctx.strokeStyle = ready ? '#d47c12' : '#bfa06f';
        ctx.stroke();
        if (sprites.base[sl.tier]) {
          UI.drawContainImage(ctx, sprites.base[sl.tier], rx + 17, oy + 81, 26, 26);
        }
        rx += 40;
      }
    }
    UI.drawWrappedText(
      ctx,
      `下次祝福：${gameState.rushNextMilestone} 分\n溢罐吹散减 5s · 上菜 +3.0s`,
      ix + 16,
      oy + 106,
      iw - 32,
      15,
      UI.fontStr(10.5, 700),
      '#724640'
    );
  } else {
    UI.drawFitText(ctx, '悠闲经典模式', ix + 18, oy + 18, iw - 36, 12.5, 10, 900, '#4A2C2A');
    UI.drawWrappedText(
      ctx,
      `下次祝福：${gameState.zenNextMilestone} 分\n\n罐口中央定角瞄准，撞玻璃壁弹射享 ×1.5 加成！`,
      ix + 18,
      oy + 38,
      iw - 36,
      16.5,
      UI.fontStr(11, 700),
      '#724640'
    );
  }
}

function renderWideRightBoard(ctx, x, y, w, h, app, hits, nowSec, guideTargets) {
  const { gameState, sprites } = app;
  UI.drawWoodBoard(ctx, x, y, w, h, 16);
  const ix = x + 10;
  const iy = y + 10;
  const iw = w - 20;
  const ih = h - 20;
  UI.drawParchmentSheet(ctx, ix, iy, iw, ih, 10);

  const boxW = (iw - 28) / 2;
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(10.5, 800);
  ctx.textAlign = 'center';
  ctx.fillText('下一颗', ix + 10 + boxW * 0.5, iy + 18);
  ctx.fillText('暂存换牌', ix + iw - 10 - boxW * 0.5, iy + 18);

  const boxS = Math.min(78, boxW - 12);
  drawMiniPreviewBox(ctx, ix + 16, iy + 28, boxS, gameState.nextTier, gameState.nextMeta, sprites, nowSec, false);
  drawMiniPreviewBox(ctx, ix + iw - boxS - 16, iy + 28, boxS, gameState.holdTier, gameState.holdMeta, sprites, nowSec, true);
  guideTargets.hold = { x: ix + iw - boxS - 20, y: iy + 10, w: boxS + 8, h: boxS + 22 };
  hits.add('wide_hold_swap', ix + iw - boxS - 16, iy + 28, boxS, boxS, () => app.swapHoldPocket());

  let nextSectionY = iy + 28 + boxS + 14;

  if (gameState.mode === 'chef') {
    const relBoxH = 68;
    UI.drawKissaCard(ctx, ix + 10, nextSectionY, iw - 20, relBoxH, { tone: 'soft', radius: 9 });
    UI.drawFitText(
      ctx,
      `流派秘方 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`,
      ix + 17,
      nextSectionY + 13,
      iw - 82,
      10.5,
      8.8,
      900,
      '#4A2C2A'
    );
    UI.drawFitText(ctx, '点看详情 ›', ix + iw - 17, nextSectionY + 13, 56, 9.5, 8, 800, '#8f4716', 'right');
    drawMiniRelicStrip(
      ctx,
      ix + 16,
      nextSectionY + 24,
      iw - 32,
      36,
      gameState.relics,
      hits,
      'wide_relics_bar',
      () => app.openRelicsModal(),
      true
    );
    nextSectionY += relBoxH + 8;

    const hazBarH = 32;
    const hazIds = Array.isArray(gameState.shiftHazards) ? gameState.shiftHazards : [];
    const hazTags = hazIds.map((id) => (SHIFT_HAZARDS[id] ? SHIFT_HAZARDS[id].badge : id));
    const frozenCnt = (gameState.entities || []).filter((e) => e && !e.merged && e.frozenHp > 0).length;
    if (frozenCnt > 0) hazTags.push(`冰封×${frozenCnt}`);
    if (gameState.shiftModifier === 'grand_prix') hazTags.push('评委急单');
    const hasAffix = hazTags.length > 0;
    UI.drawKissaCard(ctx, ix + 10, nextSectionY, iw - 20, hazBarH, {
      tone: hasAffix ? 'amber' : 'soft',
      radius: 8
    });
    const hazLine = hasAffix ? hazTags.join(' · ') : '本幕无特殊机关';
    UI.drawFitText(ctx, hazLine, ix + 18, nextSectionY + hazBarH * 0.5 + 0.5, iw - 72, 10, 8.2, 800, hasAffix ? '#6b380a' : '#7b5a3c');
    UI.drawFitText(ctx, '详情 ›', ix + iw - 16, nextSectionY + hazBarH * 0.5 + 0.5, 38, 9.2, 7.8, 800, '#8f4716', 'right');
    hits.add('wide_hazards_bar', ix + 10, nextSectionY, iw - 20, hazBarH, () => app.openRelicsModal());
    nextSectionY += hazBarH + 10;
  }

  // Evolution Ring 1..9
  const ry = nextSectionY;
  UI.drawFitText(ctx, `甜品进化链 ${gameState.seenThisRun.size}/9`, ix + iw * 0.5, ry, iw - 20, 11.5, 9.5, 800, '#4A2C2A', 'center');

  const rcx = ix + iw * 0.5;
  const ringAvailH = iy + ih - (ry + 10);
  const rcy = ry + 10 + ringAvailH * 0.5;
  const rx = iw * 0.34;
  const rRadiusY = Math.min(70, Math.max(48, ringAvailH * 0.37));

  ctx.save();
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(10, 800);
  ctx.textAlign = 'center';
  ctx.fillText('同阶相碰', rcx, rcy - 6);
  ctx.fillText('星光合成', rcx, rcy + 8);
  ctx.restore();

  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i];
    const ang = -Math.PI / 2 + (i / TIERS.length) * Math.PI * 2;
    const nx = rcx + Math.cos(ang) * rx;
    const ny = rcy + Math.sin(ang) * rRadiusY;
    const seen = gameState.seenThisRun.has(t.tier);
    ctx.save();
    ctx.fillStyle = seen ? '#fff6df' : '#dccab0';
    ctx.beginPath();
    ctx.arc(nx, ny, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = seen ? '#9b6f40' : '#a88f6c';
    ctx.stroke();
    if (!seen) ctx.globalAlpha = 0.32;
    if (sprites.base[t.tier]) {
      UI.drawContainImage(ctx, sprites.base[t.tier], nx, ny, 22, 22);
    }
    ctx.restore();
    hits.add(`evo_${t.tier}`, nx - 15, ny - 15, 30, 30, () => app.openModal('compendium'));
  }
}

function renderToast(ctx, width, headerBottom, app) {
  if (!app.toastText || app.toastTimer <= 0) return;
  const alpha = Math.min(1, app.toastTimer * 3);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = UI.fontStr(12, 800);
  const maxW = Math.min(460, width - 24);
  const tw = Math.min(maxW, Math.max(150, ctx.measureText(app.toastText).width + 32));
  const tx = (width - tw) * 0.5;
  const ty = headerBottom + 6;
  UI.drawNoticeBanner(ctx, tx, ty, tw, 28, {
    text: app.toastText,
    fontSize: 11.5,
    align: 'center',
    rightReserve: 12
  });
  ctx.restore();
}

module.exports = {
  renderBackdrop,
  renderLobbyScreen,
  renderPlayScreen,
  renderToast,
  computeTopHeaderGeometry
};
