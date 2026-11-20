/**
 * Canvas 2D Layout Computer & Screen Renderers (Backdrop, Lobby & Gameplay HUD/Controls)
 * Designed for portrait WeChat Mini Game phones (with Capsule Button safe clearance)
 * AND wide desktop simulator / browser preview screens.
 */
'use strict';

const {
  TIERS,
  PATRONS,
  SHOP_UPGRADES,
  JAR_THEME_LIST,
  BLESSINGS,
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
  // 1. Base background watercolor café photo
  if (sprites.bg) {
    UI.drawCoverImage(ctx, sprites.bg, 0, 0, w, h, 0.5);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#162736');
    g.addColorStop(1, '#2d1c12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // 2. Theme atmospheric tint wash
  ctx.save();
  ctx.fillStyle = theme.stageTint || 'rgba(8, 13, 19, 0.42)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 3. Ambient glowing fireflies / falling sakura petals
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

  // Fever outer perimeter vignette glow
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
  const maxRight = menuRect ? Math.max(220, menuRect.left - 8) : width - 10;
  return { topY, headerH, maxRight };
}

function renderLobbyScreen(ctx, metrics, app, hits, nowSec) {
  const { width, height, safeBottom } = metrics;
  const { gameState, saveData, sprites, activePatron, equippedTheme, hasAffordable, lobbyBounceT, lobbySpeechIndex } = app;
  const { topY, headerH, maxRight } = computeTopHeaderGeometry(metrics);
  const isWide = width >= 760;

  // 1. Top Header Bar (Capsule-Safe)
  const padX = isWide ? Math.max(16, (width - 1020) * 0.5) : 8;
  const effectiveRight = isWide ? width - padX : maxRight;
  const btnS = Math.min(32, headerH);
  const bgmInfo = app.audio.getTrackInfo();
  const bgmIcon = bgmInfo.id === 'bossa' ? '☕' : bgmInfo.id === 'off' ? '🔕' : '🎵';
  const sfxIcon = app.audio.sfxEnabled ? '🔊' : '🔇';

  // Right utility icons (placed right -> left from effectiveRight)
  let rx = effectiveRight;
  const helpW = isWide ? 82 : btnS;
  rx -= helpW;
  UI.drawPillButton(ctx, rx, topY, helpW, btnS, {
    style: 'wood',
    text: isWide ? '❓ 玩法' : '❓',
    fontSize: 12.5
  });
  hits.add('lobby_help', rx, topY, helpW, btnS, () => app.openModal('help'));

  if (isWide) {
    rx -= 6 + 72;
    UI.drawPillButton(ctx, rx, topY, 72, btnS, {
      style: 'wood',
      text: '📖 图鉴',
      fontSize: 12.5
    });
    hits.add('lobby_comp', rx, topY, 72, btnS, () => app.openModal('compendium'));
  }

  rx -= 5 + btnS;
  UI.drawPillButton(ctx, rx, topY, btnS, btnS, {
    style: 'wood',
    text: sfxIcon,
    fontSize: 13
  });
  hits.add('lobby_sfx', rx, topY, btnS, btnS, () => app.toggleSfx());

  rx -= 5 + btnS;
  UI.drawPillButton(ctx, rx, topY, btnS, btnS, {
    style: app.audio.bgmEnabled ? 'active' : 'wood',
    text: bgmIcon,
    fontSize: 13
  });
  hits.add('lobby_bgm', rx, topY, btnS, btnS, () => app.cycleBgm());

  const bankVal = String(saveData.bankStardust || 0);
  const bankW = isWide ? 88 : Math.max(54, 34 + bankVal.length * 8);
  rx -= 5 + bankW;
  UI.drawPillButton(ctx, rx, topY, bankW, btnS, {
    style: 'wood',
    text: isWide ? `⭐ ${bankVal} 银行` : `⭐ ${bankVal}`,
    fontSize: 12
  });
  hits.add('lobby_bank', rx, topY, bankW, btnS, () => app.openShop('upgrades'));

  // Brand Pill on Left
  const brandW = Math.max(78, rx - 6 - padX);
  UI.drawPillButton(ctx, padX, topY, Math.min(isWide ? 290 : 124, brandW), btnS, {
    style: 'dark',
    text: isWide ? `🌙 星夜吃茶 · ${getChefRank(app.getCareerTopScore())}` : '🌙 星夜吃茶',
    fontSize: isWide ? 13 : 12
  });

  // 2. Bottom Footer Actions
  const contentTop = topY + headerH + 8;
  const footerPadB = Math.max(8, safeBottom + 6);
  const footerH = isWide ? 48 : 84;
  const footerY = height - footerPadB - footerH;
  const availH = footerY - contentTop - 8;

  if (isWide) {
    const startW = 300;
    const secW = 128;
    const totalW = startW + secW * 2 + 20;
    let fx = (width - totalW) * 0.5;

    UI.drawPillButton(ctx, fx, footerY, startW, 44, {
      style: 'cta',
      text: '✨ 开门营业 · Start',
      fontSize: 16,
      fontWeight: 900
    });
    hits.add('btn_start', fx, footerY, startW, 44, () => app.startNewRun());
    fx += startW + 10;

    UI.drawPillButton(ctx, fx, footerY + 2, secW, 40, {
      style: 'wood',
      text: '🏪 吃茶小铺',
      fontSize: 13.5
    });
    if (hasAffordable) {
      drawRedDot(ctx, fx + secW - 6, footerY + 4);
    }
    hits.add('btn_shop', fx, footerY + 2, secW, 40, () => app.openShop('upgrades'));
    fx += secW + 10;

    UI.drawPillButton(ctx, fx, footerY + 2, secW, 40, {
      style: 'wood',
      text: '🏆 营业履历',
      fontSize: 13.5
    });
    hits.add('btn_career', fx, footerY + 2, secW, 40, () => app.openModal('career'));
  } else {
    const innerW = width - padX * 2;
    const ctaH = availH < 490 ? 38 : 42;
    const secH = 34;
    const ctaY = footerY;
    const secY = ctaY + ctaH + 6;

    UI.drawPillButton(ctx, padX, ctaY, innerW, ctaH, {
      style: 'cta',
      text: '✨ 开门营业 · Start Baking',
      fontSize: 15.5,
      fontWeight: 900
    });
    hits.add('btn_start', padX, ctaY, innerW, ctaH, () => app.startNewRun());

    const colW = (innerW - 12) / 3;
    const secButtons = [
      { id: 'btn_shop', text: '🏪 吃茶小铺', dot: hasAffordable, fn: () => app.openShop('upgrades') },
      { id: 'btn_comp', text: '📖 图鉴', dot: false, fn: () => app.openModal('compendium') },
      { id: 'btn_career', text: '🏆 履历', dot: false, fn: () => app.openModal('career') }
    ];
    for (let i = 0; i < secButtons.length; i++) {
      const b = secButtons[i];
      const bx = padX + i * (colW + 6);
      UI.drawPillButton(ctx, bx, secY, colW, secH, {
        style: 'wood',
        text: b.text,
        fontSize: 12.5
      });
      if (b.dot) drawRedDot(ctx, bx + colW - 5, secY + 3);
      hits.add(b.id, bx, secY, colW, secH, b.fn);
    }
  }

  // 3. Center Dual-Zone Content (Patron Board + Mode Menu Board)
  if (isWide) {
    const maxW = Math.min(1020, width - padX * 2);
    const leftX = (width - maxW) * 0.5;
    const colGap = 16;
    const colW = (maxW - colGap) * 0.5;
    renderLobbyPatronBoard(ctx, leftX, contentTop, colW, availH, app, hits, nowSec, true);
    renderLobbyMenuBoard(ctx, leftX + colW + colGap, contentTop, colW, availH, app, hits, true);
  } else {
    const innerW = width - padX * 2;
    const showHero = availH >= 600 && !!sprites.hero;
    const heroH = showHero ? Math.min(108, Math.max(76, Math.round(availH * 0.165))) : 0;
    const patronBoardH = (availH < 495 ? 124 : 136) + (heroH > 0 ? heroH + 6 : 0);
    const gap = 8;
    const menuH = Math.max(250, availH - patronBoardH - gap);

    renderLobbyPatronBoard(ctx, padX, contentTop, innerW, patronBoardH, app, hits, nowSec, false, heroH);
    renderLobbyMenuBoard(ctx, padX, contentTop + patronBoardH + gap, innerW, menuH, app, hits, false);
  }
}

function renderLobbyPatronBoard(ctx, x, y, w, h, app, hits, nowSec, isWide, forceHeroH = 0) {
  const { saveData, sprites, activePatron, lobbyBounceT, lobbySpeechIndex } = app;
  UI.drawWoodBoard(ctx, x, y, w, h, isWide ? 16 : 13);

  const pad = isWide ? 11 : 7;
  const ix = x + pad;
  const iw = w - pad * 2;
  let curY = y + pad;

  const heroH = isWide ? Math.max(130, h - 224) : forceHeroH;
  if (heroH > 0 && sprites.hero) {
    ctx.save();
    UI.roundRectPath(ctx, ix, curY, iw, heroH, 10);
    ctx.clip();
    UI.drawCoverImage(ctx, sprites.hero, ix, curY, iw, heroH, 0.42);
    ctx.restore();
    ctx.save();
    UI.roundRectPath(ctx, ix, curY, iw, heroH, 10);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4A2C2A';
    ctx.stroke();

    // Ribbon tag
    const ribW = 148;
    UI.roundRectPath(ctx, ix + iw - ribW - 6, curY + heroH - 22, ribW, 17, 8.5);
    ctx.fillStyle = 'rgba(44, 23, 11, 0.88)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#ffd87a';
    ctx.stroke();
    ctx.fillStyle = '#ffeaad';
    ctx.font = UI.fontStr(10, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ Starlight Patisserie 3.0', ix + iw - ribW * 0.5 - 6, curY + heroH - 13.5);
    ctx.restore();

    curY += heroH + 6;
  }

  const sheetH = y + h - pad - curY;
  UI.drawParchmentSheet(ctx, ix, curY, iw, sheetH, 10);

  const inPad = isWide ? 10 : 7;
  const chipH = isWide ? 44 : 33;
  const chipY = curY + sheetH - inPad - chipH;
  const topH = chipY - (curY + inPad) - 5;

  // Patron Circular Portrait
  const portR = Math.min(isWide ? 40 : 28, Math.floor(topH * 0.45));
  const portCx = ix + inPad + portR;
  const portCy = curY + inPad + topH * 0.5 - 2;

  ctx.save();
  const bounceScale = lobbyBounceT > 0 ? 1 + Math.sin(lobbyBounceT * Math.PI * 2) * 0.14 : 1;
  const bobY = Math.sin(nowSec * 2.2) * 2;
  const pg = ctx.createRadialGradient(portCx - portR * 0.3, portCy - portR * 0.3, 4, portCx, portCy, portR);
  pg.addColorStop(0, '#fffdf5');
  pg.addColorStop(0.8, '#f5dfa8');
  pg.addColorStop(1, '#dfba74');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(portCx, portCy, portR, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4A2C2A';
  ctx.stroke();

  const pImg = sprites.patrons[activePatron.id];
  if (pImg) {
    ctx.save();
    ctx.translate(portCx, portCy + bobY);
    ctx.scale(bounceScale, 2 - bounceScale);
    UI.drawContainImage(ctx, pImg, 0, 0, portR * 1.66, portR * 1.66);
    ctx.restore();
  }

  // "点我互动" hint badge
  UI.roundRectPath(ctx, portCx - 23, portCy + portR - 8, 46, 14, 7);
  ctx.fillStyle = '#532c14';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#ffd97a';
  ctx.stroke();
  ctx.fillStyle = '#ffefc4';
  ctx.font = UI.fontStr(8.5, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('点我互动', portCx, portCy + portR - 1);
  ctx.restore();
  hits.add('lobby_patron_poke', portCx - portR, portCy - portR, portR * 2, portR * 2, () => app.pokeLobbyPatron());

  // Dialogue & Passive Card
  const dlgX = portCx + portR + 8;
  const dlgW = ix + iw - inPad - dlgX;
  const dlgY = curY + inPad;
  UI.drawParchmentSheet(ctx, dlgX, dlgY, dlgW, topH, 9, '#fffaf0', '#fffaf0', '#c39a62', 1.8);

  const lines = activePatron.idleLines || [activePatron.greet];
  const speechText = lines[lobbySpeechIndex % lines.length];

  // Head row
  const skillW = 54;
  UI.drawFitText(
    ctx,
    `${activePatron.badge} ${activePatron.name}`,
    dlgX + 7,
    dlgY + 12,
    dlgW - skillW - 18,
    isWide ? 13 : 11.5,
    9.5,
    800,
    '#4A2C2A'
  );
  UI.roundRectPath(ctx, dlgX + dlgW - skillW - 6, dlgY + 5, skillW, 15, 7.5);
  ctx.fillStyle = '#ffe399';
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = '#a6651d';
  ctx.stroke();
  ctx.fillStyle = '#6b340a';
  ctx.font = UI.fontStr(9.5, 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(activePatron.skillName, dlgX + dlgW - skillW * 0.5 - 6, dlgY + 12.5);

  const speechFs = isWide ? 11.5 : 10.5;
  const speechEndY = UI.drawWrappedText(
    ctx,
    speechText,
    dlgX + 7,
    dlgY + 23,
    dlgW - 14,
    isWide ? 15 : 13,
    UI.fontStr(speechFs, 600),
    '#4A2C2A',
    'left',
    2
  );

  // Passive line at bottom of dialogue card
  const divY = Math.min(dlgY + topH - 18, dlgY + 24 + speechEndY);
  ctx.save();
  ctx.strokeStyle = '#d6b685';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(dlgX + 7, divY);
  ctx.lineTo(dlgX + dlgW - 7, divY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  UI.drawFitText(
    ctx,
    isWide ? activePatron.passiveDesc : `★ ${activePatron.passiveDesc}`,
    dlgX + 7,
    divY + (dlgY + topH - divY) * 0.5 + 1,
    dlgW - 14,
    isWide ? 10.5 : 9.8,
    8.5,
    800,
    '#8f4716'
  );

  // 3-Patron Switcher Chips
  const chipGap = 6;
  const chipW = (iw - inPad * 2 - chipGap * 2) / 3;
  for (let i = 0; i < PATRONS.length; i++) {
    const p = PATRONS[i];
    const cx = ix + inPad + i * (chipW + chipGap);
    const unlocked = saveData.unlockedPatrons.includes(p.id);
    const selected = saveData.selectedPatron === p.id;
    UI.drawPillButton(ctx, cx, chipY, chipW, chipH, {
      style: selected ? 'cardSelected' : 'card',
      radius: 9,
      disabled: !unlocked
    });

    const iconSize = chipH - 8;
    const iconCx = cx + 4 + iconSize * 0.5;
    const iconCy = chipY + chipH * 0.5;
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.65;
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.arc(iconCx, iconCy, iconSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#9c6e3b';
    ctx.stroke();
    if (sprites.patrons[p.id]) {
      UI.drawContainImage(ctx, sprites.patrons[p.id], iconCx, iconCy, iconSize * 0.85, iconSize * 0.85);
    }
    ctx.restore();

    const tx = iconCx + iconSize * 0.5 + 4;
    const tw = cx + chipW - tx - 4;
    UI.drawFitText(ctx, p.shortName, tx, chipY + chipH * 0.34, tw, isWide ? 11.5 : 10.2, 8.5, 800, '#4A2C2A');
    const subTxt = unlocked ? (selected ? '✦出战中' : p.shortPassive) : `🔒 ${p.cost}⭐`;
    UI.drawFitText(ctx, subTxt, tx, chipY + chipH * 0.72, tw, isWide ? 10 : 9, 7.5, 800, '#8f4e1b');

    hits.add(`lobby_patron_chip_${p.id}`, cx, chipY, chipW, chipH, () => app.selectOrUnlockPatron(p.id));
  }
}

function renderLobbyMenuBoard(ctx, x, y, w, h, app, hits, isWide) {
  const { gameState, saveData, sprites, equippedTheme } = app;
  UI.drawWoodBoard(ctx, x, y, w, h, isWide ? 16 : 13);

  const pad = isWide ? 11 : 7;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  UI.drawParchmentSheet(ctx, ix, iy, iw, ih, 10);

  const inPad = isWide ? 11 : 8;
  let curY = iy + inPad;

  // Section Header
  UI.drawFitText(ctx, '📋 选择营业模式', ix + inPad, curY + 10, iw * 0.55, isWide ? 13.5 : 12, 10, 900, '#4A2C2A');
  const tagTxt = '打烊折算永久星尘';
  const tagW = isWide ? 116 : 102;
  UI.roundRectPath(ctx, ix + iw - inPad - tagW, curY + 1, tagW, 18, 9);
  ctx.fillStyle = 'rgba(255, 224, 134, 0.5)';
  ctx.fill();
  ctx.fillStyle = '#93501c';
  ctx.font = UI.fontStr(isWide ? 10.5 : 9.5, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tagTxt, ix + iw - inPad - tagW * 0.5, curY + 10);
  curY += 24;

  // Shop Preview Bar anchored at bottom
  const shopBarH = isWide ? 54 : 44;
  const shopBarY = iy + ih - inPad - shopBarH;

  // 3 Mode Cards
  const modesAreaH = shopBarY - curY - 7;
  const modeGap = isWide ? 9 : 6;
  const cardH = Math.floor((modesAreaH - modeGap * 2) / 3);
  const modes = [
    {
      id: 'chef',
      title: '🌟 星夜主厨',
      badge: '订单策略',
      isNew: false,
      desc: '极速心愿单 × 三选一祝福构筑，稳步挑战猫神',
      best: saveData.bestChef || 0
    },
    {
      id: 'rush',
      title: '⚡ 90秒狂欢',
      badge: 'NEW · 极速',
      isNew: true,
      desc: '极速连投 × 1.85倍狂热充能，溢罐吹散减时不秒死',
      best: saveData.bestRush || 0
    },
    {
      id: 'zen',
      title: '🍵 悠闲经典',
      badge: '无压畅玩',
      isNew: false,
      desc: '无订单催促 × 积分里程碑抽祝福，惬意享受合成',
      best: saveData.bestZen || 0
    }
  ];

  for (let i = 0; i < modes.length; i++) {
    const m = modes[i];
    const cy = curY + i * (cardH + modeGap);
    const sel = gameState.mode === m.id;
    UI.drawPillButton(ctx, ix + inPad, cy, iw - inPad * 2, cardH, {
      style: sel ? 'cardSelected' : 'card',
      radius: 11
    });

    const cw = iw - inPad * 2;
    const cx = ix + inPad;
    // Title
    UI.drawFitText(ctx, m.title, cx + 10, cy + cardH * 0.27, cw - 92, isWide ? 15 : 13, 10.5, 900, '#4A2C2A');
    // Badge
    const bw = m.isNew ? 68 : 60;
    UI.roundRectPath(ctx, cx + cw - bw - 9, cy + cardH * 0.27 - 8.5, bw, 17, 8.5);
    if (m.isNew) {
      const bg = ctx.createLinearGradient(cx + cw - bw - 9, cy, cx + cw - 9, cy);
      bg.addColorStop(0, '#ff7a6b');
      bg.addColorStop(1, '#ffa54f');
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#4A2C2A';
      ctx.stroke();
      ctx.fillStyle = '#fffdf5';
    } else {
      ctx.fillStyle = 'rgba(140, 85, 41, 0.14)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#b5854b';
      ctx.stroke();
      ctx.fillStyle = '#6b3b14';
    }
    ctx.font = UI.fontStr(9.5, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.badge, cx + cw - bw * 0.5 - 9, cy + cardH * 0.27);

    // Description
    UI.drawFitText(ctx, m.desc, cx + 10, cy + cardH * 0.56, cw - 20, isWide ? 11.5 : 10.2, 8.5, 600, '#724640');
    // Best
    UI.drawFitText(ctx, `最高纪录: ${m.best}`, cx + 10, cy + cardH * 0.81, cw - 20, isWide ? 11.5 : 10, 8.5, 800, '#8c4814');

    hits.add(`mode_${m.id}`, cx, cy, cw, cardH, () => app.selectMode(m.id));
  }

  // Shop Loadout Preview Bar
  const sx = ix + inPad;
  const sw = iw - inPad * 2;
  UI.drawPillButton(ctx, sx, shopBarY, sw, shopBarH, {
    style: 'wood',
    radius: 10
  });
  const signSize = shopBarH - 12;
  if (sprites.shopSign) {
    UI.drawContainImage(ctx, sprites.shopSign, sx + 8 + signSize * 0.5, shopBarY + shopBarH * 0.5, signSize, signSize);
  }
  const tx = sx + 14 + signSize;
  const tw = sw - signSize - 22;
  UI.drawFitText(ctx, `${equippedTheme.icon} ${equippedTheme.name}`, tx, shopBarY + shopBarH * 0.34, tw - 66, isWide ? 12.5 : 11, 9.5, 900, '#4A2C2A');
  UI.drawFitText(ctx, '前往小铺 ›', sx + sw - 10, shopBarY + shopBarH * 0.34, 70, 10.5, 9, 800, '#9b4b13', 'right');

  const activeTags = SHOP_UPGRADES.filter((u) => app.getUpgradeLevel(u.id) > 0).map((u) => u.shortTag(app.getUpgradeLevel(u.id)));
  const talentStr = activeTags.length > 0 ? `已激活天赋：${activeTags.join(' · ')}` : '厨房天赋：尚未升级（去小铺强化！）';
  UI.drawFitText(ctx, talentStr, tx, shopBarY + shopBarH * 0.72, tw, isWide ? 11 : 10, 8.5, 700, '#724640');
  hits.add('lobby_shop_preview', sx, shopBarY, sw, shopBarH, () => app.openShop('themes'));
}

function drawRedDot(ctx, cx, cy) {
  ctx.save();
  ctx.fillStyle = '#e94335';
  ctx.beginPath();
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#fff8e6';
  ctx.stroke();
  ctx.restore();
}

function renderPlayScreen(ctx, metrics, app, hits, nowSec) {
  const { width, height, safeBottom } = metrics;
  const { gameState, sprites, equippedTheme, audio } = app;
  const { topY, headerH, maxRight } = computeTopHeaderGeometry(metrics);
  const isWide = width >= 820;

  // 1. Top Navigation Bar (Capsule-Safe)
  const padX = isWide ? Math.max(18, (width - 1060) * 0.5) : 8;
  const effectiveRight = isWide ? width - padX : maxRight;
  const btnS = Math.min(32, headerH);
  const bgmInfo = audio.getTrackInfo();
  const bgmIcon = bgmInfo.id === 'bossa' ? '☕' : bgmInfo.id === 'off' ? '🔕' : '🎵';
  const sfxIcon = audio.sfxEnabled ? '🔊' : '🔇';

  let rx = effectiveRight;
  const actionW = isWide ? 74 : btnS;
  rx -= actionW;
  UI.drawPillButton(ctx, rx, topY, actionW, btnS, {
    style: 'wood',
    text: isWide ? '🔄 重开' : '🔄',
    fontSize: 12.5
  });
  hits.add('play_restart', rx, topY, actionW, btnS, () => app.restartRun());

  rx -= 5 + actionW;
  UI.drawPillButton(ctx, rx, topY, actionW, btnS, {
    style: 'wood',
    text: isWide ? '📖 图鉴' : '📖',
    fontSize: 12.5
  });
  hits.add('play_comp', rx, topY, actionW, btnS, () => app.openModal('compendium'));

  rx -= 5 + actionW;
  UI.drawPillButton(ctx, rx, topY, actionW, btnS, {
    style: 'wood',
    text: isWide ? (audio.sfxEnabled ? '🔊 音效' : '🔇 静音') : sfxIcon,
    fontSize: 12.5
  });
  hits.add('play_sfx', rx, topY, actionW, btnS, () => app.toggleSfx());

  rx -= 5 + actionW;
  UI.drawPillButton(ctx, rx, topY, actionW, btnS, {
    style: audio.bgmEnabled ? 'active' : 'wood',
    text: isWide ? `${bgmIcon} ${bgmInfo.id === 'bossa' ? '爵士' : bgmInfo.id === 'off' ? '关' : '圆舞'}` : bgmIcon,
    fontSize: 12.5
  });
  hits.add('play_bgm', rx, topY, actionW, btnS, () => app.cycleBgm());

  if (isWide) {
    rx -= 5 + 88;
    UI.drawPillButton(ctx, rx, topY, 88, btnS, {
      style: gameState.debugPhysics ? 'active' : 'wood',
      text: gameState.debugPhysics ? '📐 轮廓开' : '📐 轮廓',
      fontSize: 12
    });
    hits.add('play_debug_phys', rx, topY, 88, btnS, () => app.toggleDebugPhysics());
  }

  // Left: Back to Lobby + Mode Badge
  const backW = isWide ? 68 : btnS;
  UI.drawPillButton(ctx, padX, topY, backW, btnS, {
    style: 'wood',
    text: isWide ? '🏠 大厅' : '🏠',
    fontSize: 12.5
  });
  hits.add('play_back_lobby', padX, topY, backW, btnS, () => app.returnToLobby());

  const modeX = padX + backW + 5;
  const modeMaxW = Math.max(58, rx - 5 - modeX);
  const modeLabel =
    gameState.mode === 'rush'
      ? (modeMaxW < 85 ? '⚡狂欢' : '⚡ 90秒狂欢')
      : gameState.mode === 'zen'
      ? (modeMaxW < 85 ? '🍵经典' : '🍵 悠闲经典')
      : (modeMaxW < 85 ? '🌟主厨' : '🌟 星夜主厨');
  UI.drawPillButton(ctx, modeX, topY, Math.min(isWide ? 140 : 88, modeMaxW), btnS, {
    style: 'dark',
    text: modeLabel,
    fontSize: 11.5
  });

  // 2. Layout Stage & HUDs
  let jarContainer = null;
  let toolsDockY = height - Math.max(8, safeBottom + 6) - 62;
  const headerBottom = topY + headerH;

  if (isWide) {
    const contentTop = headerBottom + 10;
    const totalW = Math.min(1060, width - padX * 2);
    const startX = (width - totalW) * 0.5;
    const sideW = 248;
    const gap = 16;
    const centerW = totalW - sideW * 2 - gap * 2;
    const boardH = Math.min(540, height - contentTop - 18);

    renderWideLeftBoard(ctx, startX, contentTop, sideW, boardH, app, hits, nowSec);
    renderWideRightBoard(ctx, startX + totalW - sideW, contentTop, sideW, boardH, app, hits, nowSec);

    toolsDockY = height - Math.max(10, safeBottom + 8) - 66;
    const jarTop = headerBottom + 4;
    const jarH = toolsDockY - jarTop - 4;
    jarContainer = { x: startX + sideW + gap, y: jarTop, w: centerW, h: jarH };
  } else {
    // Mobile Portrait HUD (fits cleanly between Capsule Bar & Jar)
    const hudTop = headerBottom + 5;
    const innerW = width - padX * 2;
    const hudH = 62;
    renderMobileTopHud(ctx, padX, hudTop, innerW, hudH, app, hits, nowSec);

    const subY = hudTop + hudH + 5;
    const subH = 34;
    renderMobileSubBar(ctx, padX, subY, innerW, subH, app, hits);

    const jarTop = subY + subH + 3;
    const jarH = toolsDockY - jarTop - 3;
    jarContainer = { x: 4, y: jarTop, w: width - 8, h: jarH };
  }

  // 3. Render Glass Mixing Jar Chamber + Entities
  const jarBox = computeJarBox(jarContainer.x, jarContainer.y, jarContainer.w, jarContainer.h);
  app.lastJarBox = jarBox;
  JarRenderer.renderJarStage(ctx, jarBox, gameState, equippedTheme, sprites, nowSec, app.getEffectiveMagnetLevel());

  // 4. Floating In-Jar Overlays (Rush Floating Timer on Wide, Shop Event Banner, Target Banner, Blessing Ready Pill)
  if (isWide && gameState.mode === 'rush' && gameState.running && !gameState.over) {
    const urgent = gameState.rushTimer <= 15.0;
    const pulse = urgent ? 1 + Math.sin(nowSec * 14) * 0.04 : 1;
    ctx.save();
    ctx.translate(jarBox.x + 56, jarBox.y + 18);
    ctx.scale(pulse, pulse);
    UI.roundRectPath(ctx, -46, -13, 92, 26, 13);
    ctx.fillStyle = urgent ? 'rgba(176, 28, 22, 0.94)' : 'rgba(54, 28, 12, 0.92)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = urgent ? '#ffe388' : '#ffd56b';
    ctx.stroke();
    ctx.fillStyle = '#fff2c2';
    ctx.font = UI.fontStr(13, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⏱️ ${Math.max(0, gameState.rushTimer).toFixed(1)}s`, 0, 0.5);
    ctx.restore();
  }

  // Non-blocking Shop Event Banner
  if (gameState.activeEvent && gameState.running && !gameState.over) {
    const ev = gameState.activeEvent;
    let icon = '🔔';
    let label = '黄金烘焙钟 · 得分+45% 连击延长';
    let meta = `${Math.max(0, ev.timer).toFixed(1)}s`;
    let bBorder = '#ffe169';
    if (ev.kind === 'meteor') {
      icon = '🌠';
      label = '流星许愿夜 · 镀金 & 充能+30%';
      bBorder = '#ffd66b';
    } else if (ev.kind === 'yarn') {
      const yb = gameState.entities.find((e) => e.isYarnBall && !e.merged);
      icon = '🧶';
      label = '猫咪捣蛋 · 附近合成震碎领大奖';
      meta = `脆度×${yb ? yb.yarnHp : 0}`;
      bBorder = '#ff9cb8';
    }
    const bw = Math.min(width - 24, isWide ? 310 : 272);
    const bx = jarBox.x + jarBox.w * 0.5 - bw * 0.5;
    const by = jarBox.y + 82 * jarBox.scale;
    ctx.save();
    UI.roundRectPath(ctx, bx, by, bw, 24, 12);
    ctx.fillStyle = 'rgba(54, 28, 13, 0.93)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = bBorder;
    ctx.stroke();
    UI.drawFitText(ctx, `${icon} ${label}`, bx + 10, by + 12.5, bw - 68, 11.5, 9, 800, '#fff2c6');
    UI.roundRectPath(ctx, bx + bw - 54, by + 4, 46, 16, 8);
    ctx.fillStyle = 'rgba(255, 224, 128, 0.24)';
    ctx.fill();
    ctx.fillStyle = '#ffe48a';
    ctx.font = UI.fontStr(10.5, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(meta, bx + bw - 31, by + 12.5);
    ctx.restore();
  }

  // Tool Targeting Banner
  if (gameState.activeToolMode && gameState.running && !gameState.over) {
    const msg =
      gameState.activeToolMode === 'fork'
        ? '🫧 点击罐内 1~4 阶小甜品消除'
        : '✨ 点击任意甜品(1~8阶)升阶';
    const bw = Math.min(width - 20, 290);
    const bx = jarBox.x + jarBox.w * 0.5 - bw * 0.5;
    const by = jarBox.y + 8;
    ctx.save();
    UI.roundRectPath(ctx, bx, by, bw, 28, 14);
    ctx.fillStyle = 'rgba(54, 28, 14, 0.94)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd56b';
    ctx.stroke();
    UI.drawFitText(ctx, msg, bx + 12, by + 14.5, bw - 66, 11.5, 9, 800, '#fff2cb');
    const cbx = bx + bw - 48;
    UI.drawPillButton(ctx, cbx, by + 4, 42, 20, { style: 'danger', text: '取消', fontSize: 10.5 });
    hits.add('cancel_tool', cbx, by + 4, 42, 20, () => app.cancelToolMode());
    ctx.restore();
  }

  // Pending Roguelike Blessing Floating Button
  if (gameState.pendingBlessings > 0 && !gameState.activeToolMode && gameState.running && !gameState.over && !app.activeModal) {
    const bw = 166;
    const bx = jarBox.x + jarBox.w * 0.5 - bw * 0.5;
    const by = toolsDockY - 34;
    const pulse = 1 + Math.sin(nowSec * 6) * 0.03;
    ctx.save();
    ctx.translate(bx + bw * 0.5, by + 15);
    ctx.scale(pulse, pulse);
    UI.drawPillButton(ctx, -bw * 0.5, -15, bw, 30, {
      style: 'cta',
      text: `🎁 领取星夜祝福 ×${gameState.pendingBlessings}`,
      fontSize: 12.5,
      fontWeight: 900
    });
    ctx.restore();
    hits.add('open_blessing_btn', bx, by, bw, 30, () => app.openBlessingModal());
  }

  // 5. Bottom 3 Counter Tool Buttons Dock
  const tools = [
    { key: 'shake', label: '1 · 摇一摇', img: sprites.tools.shake },
    { key: 'fork', label: '2 · 泡泡叉', img: sprites.tools.fork },
    { key: 'spoon', label: '3 · 升阶勺', img: sprites.tools.spoon }
  ];
  const toolGap = isWide ? 24 : 20;
  const toolSize = isWide ? 52 : 48;
  const dockTotalW = toolSize * 3 + toolGap * 2;
  const dockStartX = width * 0.5 - dockTotalW * 0.5;

  for (let i = 0; i < tools.length; i++) {
    const tl = tools[i];
    const tx = dockStartX + i * (toolSize + toolGap);
    const ty = toolsDockY;
    const cx = tx + toolSize * 0.5;
    const cy = ty + toolSize * 0.5;
    const cnt = gameState.tools[tl.key];
    const cost = gameState.toolCosts[tl.key];
    const armed = gameState.activeToolMode === tl.key;

    ctx.save();
    if (armed) {
      ctx.strokeStyle = '#ffea80';
      ctx.lineWidth = 4;
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
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = armed ? '#ffe066' : '#4A2C2A';
    ctx.stroke();

    if (tl.img) {
      UI.drawContainImage(ctx, tl.img, cx, cy, toolSize * 0.72, toolSize * 0.72);
    }

    // Count / Star Buy Badge
    const badgeStr = cnt > 0 ? String(cnt) : `${cost}⭐`;
    const bw = cnt > 0 ? 20 : 34;
    const bbx = tx + toolSize - bw * 0.65;
    const bby = ty - 3;
    UI.roundRectPath(ctx, bbx, bby, bw, 17, 8.5);
    ctx.fillStyle = cnt > 0 ? '#5c3114' : '#f2c144';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = cnt > 0 ? '#ffd778' : '#4A2C2A';
    ctx.stroke();
    ctx.fillStyle = cnt > 0 ? '#fff6dc' : '#4A2C2A';
    ctx.font = UI.fontStr(10, 900);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeStr, bbx + bw * 0.5, bby + 9);

    // Caption pill underneath
    const capW = toolSize + 14;
    UI.roundRectPath(ctx, cx - capW * 0.5, ty + toolSize + 1, capW, 15, 7.5);
    ctx.fillStyle = 'rgba(42, 22, 10, 0.88)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(232, 187, 114, 0.55)';
    ctx.stroke();
    ctx.fillStyle = '#fde6bc';
    ctx.font = UI.fontStr(9.5, 800);
    ctx.fillText(tl.label, cx, ty + toolSize + 9);
    ctx.restore();

    hits.add(`tool_${tl.key}`, tx - 4, ty - 4, toolSize + 8, toolSize + 20, () => app.armOrUseTool(tl.key));
  }

  // Flanking Aim Tilt Pill Buttons (gives mobile players full angle control for slopes & tight wedges)
  const tiltW = isWide ? 60 : 54;
  const tiltH = 30;
  const tiltY = toolsDockY + (toolSize - tiltH) * 0.5;
  const leftTiltX = Math.max(8, dockStartX - tiltW - (isWide ? 24 : 18));
  const rightTiltX = Math.min(width - tiltW - 8, dockStartX + dockTotalW + (isWide ? 24 : 18));
  const tiltDisabled = !!gameState.activeToolMode;

  UI.drawPillButton(ctx, leftTiltX, tiltY, tiltW, tiltH, {
    style: gameState.aimAngle < -0.05 ? 'active' : 'wood',
    text: '↺ 左倾',
    fontSize: 10.5,
    disabled: tiltDisabled
  });
  hits.add('aim_tilt_left', leftTiltX, tiltY, tiltW, tiltH, () => app.adjustAimAngle(-0.26));

  UI.drawPillButton(ctx, rightTiltX, tiltY, tiltW, tiltH, {
    style: gameState.aimAngle > 0.05 ? 'active' : 'wood',
    text: '↻ 右倾',
    fontSize: 10.5,
    disabled: tiltDisabled
  });
  hits.add('aim_tilt_right', rightTiltX, tiltY, tiltW, tiltH, () => app.adjustAimAngle(0.26));
}

function renderMobileTopHud(ctx, x, y, w, h, app, hits, nowSec) {
  const { gameState, sprites } = app;
  const previewCardW = 114;
  const gap = 6;
  const statsW = w - previewCardW - gap;

  // Left Compact Stats + Fever Parchment Card
  UI.drawParchmentSheet(ctx, x, y, statsW, h, 11);
  // Score row
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(10.5, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('得分', x + 8, y + 16);

  const scoreStr = String(gameState.displayScore);
  UI.drawFitText(ctx, scoreStr, x + 34, y + 16, Math.max(46, statsW - 144), 19, 13, 900, '#4A2C2A');

  const dustStr = `⭐${gameState.stardust}`;
  const dustW = Math.max(44, 22 + String(gameState.stardust).length * 7);
  UI.roundRectPath(ctx, x + statsW - dustW - 7, y + 7, dustW, 18, 9);
  ctx.fillStyle = '#fff2cb';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#c99233';
  ctx.stroke();
  ctx.fillStyle = '#7e4b10';
  ctx.font = UI.fontStr(10.5, 800);
  ctx.textAlign = 'center';
  ctx.fillText(dustStr, x + statsW - dustW * 0.5 - 7, y + 16.5);

  UI.drawFitText(
    ctx,
    `最高 ${app.getBestScore()}`,
    x + statsW - dustW - 12,
    y + 16.5,
    62,
    10.5,
    8.5,
    700,
    '#724640',
    'right'
  );

  // Fever + Rainbow Pity row
  const isFever = gameState.feverTimer > 0;
  const multVal = app.getFeverMultiplier();
  const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
  const fLabel = isFever ? `🔥狂热${multStr}` : '✨星光';
  const fPct = isFever ? `${gameState.feverTimer.toFixed(1)}s` : `${Math.round(gameState.feverEnergy)}%`;

  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(10, 800);
  ctx.textAlign = 'left';
  ctx.fillText(fLabel, x + 8, y + 36);

  const rReady = !!(gameState.curMeta.wildcard || gameState.nextMeta.wildcard);
  const rTxt = rReady ? '🌈就绪!' : `🌈${gameState.dropsUntilRainbow}步`;
  UI.roundRectPath(ctx, x + statsW * 0.5 - 24, y + 29, 48, 14, 7);
  ctx.fillStyle = rReady ? '#ffe082' : '#f4e6f2';
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rReady ? '#d6457b' : '#9d6d3b';
  ctx.stroke();
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(9.5, 800);
  ctx.textAlign = 'center';
  ctx.fillText(rTxt, x + statsW * 0.5, y + 36.5);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(10, 800);
  ctx.fillText(fPct, x + statsW - 8, y + 36);

  // Fever progress track
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
  ctx.fillText('NEXT', nx + boxS * 0.5, y + 9);
  ctx.fillText('HOLD', hx + boxS * 0.5, y + 9);

  drawMiniPreviewBox(ctx, nx, by, boxS, gameState.nextTier, gameState.nextMeta, sprites, nowSec, false);
  drawMiniPreviewBox(ctx, hx, by, boxS, gameState.holdTier, gameState.holdMeta, sprites, nowSec, true);
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
      ctx.fillText('暂存', x + size * 0.5, y + size * 0.5 + 0.5);
    }
    return;
  }
  if (isWild) {
    UI.drawRainbowWildcard(ctx, x + size * 0.5, y + size * 0.5, size * 0.34, 0, nowSec, 1);
  } else if (sprites.base[tier]) {
    UI.drawContainImage(ctx, sprites.base[tier], x + size * 0.5, y + size * 0.5, size * 0.78, size * 0.78);
  }
}

function renderMobileSubBar(ctx, x, y, w, h, app, hits) {
  const { gameState, sprites } = app;
  UI.drawParchmentSheet(ctx, x, y, w, h, 9);

  if (gameState.mode === 'rush') {
    const urgent = gameState.rushTimer <= 15.0;
    ctx.fillStyle = '#8f3a0e';
    ctx.font = UI.fontStr(11, 900);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ 90秒狂欢', x + 10, y + h * 0.5);

    ctx.fillStyle = urgent ? '#d93025' : '#b4360a';
    ctx.font = UI.fontStr(16, 900);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, gameState.rushTimer).toFixed(1)}s`, x + w * 0.5, y + h * 0.5 + 0.5);

    ctx.fillStyle = '#724640';
    ctx.font = UI.fontStr(10.5, 800);
    ctx.textAlign = 'right';
    ctx.fillText(`🎁 ${gameState.rushNextMilestone}分`, x + w - 10, y + h * 0.5);
    return;
  }

  if (gameState.mode === 'zen') {
    ctx.fillStyle = '#4A2C2A';
    ctx.font = UI.fontStr(11, 900);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍵 悠闲经典 · 无催促', x + 10, y + h * 0.5);

    ctx.fillStyle = '#8f4e1b';
    ctx.font = UI.fontStr(11, 800);
    ctx.textAlign = 'right';
    ctx.fillText(`🎁 下次祝福: ${gameState.zenNextMilestone} 分`, x + w - 10, y + h * 0.5);
    return;
  }

  // Chef Order Strip
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(11, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌟心愿', x + 8, y + h * 0.5);

  const ord = gameState.order;
  if (!ord) return;
  let sx = x + 48;
  for (let i = 0; i < ord.slots.length; i++) {
    const sl = ord.slots[i];
    UI.roundRectPath(ctx, sx, y + 4, 26, 26, 7);
    ctx.fillStyle = sl.done ? '#e3f7e8' : '#fff9eb';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = sl.done ? '#3f9663' : '#bfa06f';
    ctx.stroke();
    if (sprites.base[sl.tier]) {
      UI.drawContainImage(ctx, sprites.base[sl.tier], sx + 13, y + 17, 20, 20);
    }
    if (sl.done) {
      ctx.fillStyle = '#3f9663';
      ctx.beginPath();
      ctx.arc(sx + 23, y + 6, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = UI.fontStr(8, 900);
      ctx.textAlign = 'center';
      ctx.fillText('✓', sx + 23, y + 6.5);
    }
    sx += 30;
  }

  // Skip button at right
  const skipCooling = gameState.skipCooldown > 0;
  const skipTxt = skipCooling ? `${Math.ceil(gameState.skipCooldown)}s` : '换单';
  const skW = 42;
  const skX = x + w - skW - 6;
  UI.drawPillButton(ctx, skX, y + 6, skW, 22, {
    style: 'wood',
    text: skipTxt,
    fontSize: 10,
    disabled: skipCooling
  });
  hits.add('m_skip_order', skX, y + 4, skW, 26, () => app.skipOrder());

  // Rush drops pill + reward text
  const rushLeft = ord.rushDropsLeft;
  const rwX = skX - 6;
  UI.drawFitText(
    ctx,
    `+${ord.rewardScore}·+${ord.rewardDust}⭐`,
    rwX,
    y + h * 0.5,
    80,
    10,
    8,
    700,
    '#8f4e1b',
    'right'
  );
  const pillX = sx + 4;
  if (rwX - 72 > pillX + 36) {
    UI.roundRectPath(ctx, pillX, y + 8, 42, 18, 9);
    ctx.fillStyle = rushLeft > 0 ? '#ffe08a' : '#ead9bd';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#b5651d';
    ctx.stroke();
    ctx.fillStyle = '#5b2806';
    ctx.font = UI.fontStr(9.5, 800);
    ctx.textAlign = 'center';
    ctx.fillText(`⚡${rushLeft}步`, pillX + 21, y + 17.5);
  }
}

function renderWideLeftBoard(ctx, x, y, w, h, app, hits, nowSec) {
  const { gameState, sprites, activePatron } = app;
  UI.drawWoodBoard(ctx, x, y, w, h, 16);
  const ix = x + 10;
  const iw = w - 20;

  // Score Header
  UI.drawParchmentSheet(ctx, ix, y + 10, iw, 74, 10);
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(11, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCORE · 烘焙积分', ix + iw * 0.5, y + 22);
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(24, 900);
  ctx.fillText(String(gameState.displayScore), ix + iw * 0.5, y + 44);
  UI.drawFitText(ctx, `最高: ${app.getBestScore()}`, ix + 10, y + 70, iw * 0.52, 11.5, 9, 700, '#724640');
  UI.drawFitText(ctx, `⭐ ${gameState.stardust}`, ix + iw - 10, y + 70, iw * 0.4, 11.5, 9, 800, '#7e4b10', 'right');

  // Lower Parchment
  const sy = y + 92;
  const sh = h - 102;
  UI.drawParchmentSheet(ctx, ix, sy, iw, sh, 10);

  // Fever
  const isFever = gameState.feverTimer > 0;
  const multVal = app.getFeverMultiplier();
  const multStr = Number.isInteger(multVal) ? `${multVal}×` : `${multVal.toFixed(1)}×`;
  ctx.fillStyle = '#4A2C2A';
  ctx.font = UI.fontStr(11.5, 800);
  ctx.textAlign = 'left';
  ctx.fillText(isFever ? `🔥 磁吸狂热 ${multStr}` : '✨ 星光能量槽', ix + 10, sy + 16);
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
    rReady ? '🌈 彩虹糖准备就绪!' : `🌈 彩虹糖: ${gameState.dropsUntilRainbow} 步`,
    ix + 10,
    sy + 50,
    iw - 20,
    11,
    9,
    800,
    rReady ? '#b42b62' : '#4A2C2A'
  );

  // Patron speech
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
  UI.drawParchmentSheet(ctx, ix + 64, py, iw - 74, 72, 9, '#fff9ec', '#fff9ec', '#b6905b', 1.6);
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

  // Order / Rush / Zen Mode Box
  const oy = py + 82;
  const oh = sy + sh - 10 - oy;
  UI.drawParchmentSheet(ctx, ix + 8, oy, iw - 16, oh, 9, 'rgba(217,184,130,0.28)', 'rgba(217,184,130,0.28)', '#c8a26a', 1.4);
  if (gameState.mode === 'rush') {
    UI.drawFitText(ctx, '⚡ 狂欢倒计时', ix + 18, oy + 18, iw - 36, 12, 10, 800, '#4A2C2A');
    ctx.fillStyle = gameState.rushTimer <= 15 ? '#d93025' : '#a63d0c';
    ctx.font = UI.fontStr(24, 900);
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.max(0, gameState.rushTimer).toFixed(1)}s`, ix + iw * 0.5, oy + 52);
    UI.drawWrappedText(
      ctx,
      `🎁 下次祝福：${gameState.rushNextMilestone} 分\n🌪️ 溢罐自动星风吹散并扣 5.0s`,
      ix + 18,
      oy + 76,
      iw - 36,
      16,
      UI.fontStr(11, 700),
      '#724640'
    );
  } else if (gameState.mode === 'zen') {
    UI.drawFitText(ctx, '🍵 悠闲里程碑', ix + 18, oy + 18, iw - 36, 12.5, 10, 900, '#4A2C2A');
    UI.drawWrappedText(
      ctx,
      `🎁 下次三选一祝福：${gameState.zenNextMilestone} 分\n\n无订单催促 · 安心叠搭大连锁与突发店铺事件！`,
      ix + 18,
      oy + 38,
      iw - 36,
      17,
      UI.fontStr(11.5, 700),
      '#724640'
    );
  } else if (gameState.order) {
    const ord = gameState.order;
    UI.drawFitText(ctx, '🌟 今日心愿单', ix + 18, oy + 16, iw - 90, 11.5, 9.5, 800, '#724640');
    const cooling = gameState.skipCooldown > 0;
    UI.drawPillButton(ctx, ix + iw - 66, oy + 6, 50, 20, {
      style: 'wood',
      text: cooling ? `${Math.ceil(gameState.skipCooldown)}s` : '换一单',
      fontSize: 9.5,
      disabled: cooling
    });
    hits.add('wide_skip_order', ix + iw - 66, oy + 6, 50, 20, () => app.skipOrder());

    const slotW = (iw - 44) / 2;
    for (let i = 0; i < ord.slots.length; i++) {
      const sl = ord.slots[i];
      const sx = ix + 16 + i * (slotW + 8);
      UI.drawParchmentSheet(ctx, sx, oy + 32, slotW, 66, 8, sl.done ? '#e3f7e8' : '#fff9eb', sl.done ? '#e3f7e8' : '#fff9eb', sl.done ? '#3f9663' : '#bfa06f', 1.6);
      if (sprites.base[sl.tier]) {
        UI.drawContainImage(ctx, sprites.base[sl.tier], sx + slotW * 0.5, oy + 56, 36, 36);
      }
      UI.drawFitText(ctx, TIERS[sl.tier - 1].name, sx + slotW * 0.5, oy + 85, slotW - 8, 9.5, 8, 700, '#4A2C2A', 'center');
    }
    UI.drawFitText(ctx, `⚡ 极速: 剩 ${ord.rushDropsLeft} 步 (×1.6+🌈)`, ix + iw * 0.5, oy + 114, iw - 28, 10.5, 8.5, 800, '#7e4b10', 'center');
    UI.drawFitText(ctx, `奖励 +${ord.rewardScore}分 · +${ord.rewardDust}⭐ · 🎁`, ix + iw * 0.5, oy + 134, iw - 28, 10.5, 8.5, 700, '#724640', 'center');
  }
}

function renderWideRightBoard(ctx, x, y, w, h, app, hits, nowSec) {
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
  ctx.fillText('NEXT · 下一颗', ix + 10 + boxW * 0.5, iy + 18);
  ctx.fillText('HOLD · 暂存', ix + iw - 10 - boxW * 0.5, iy + 18);

  drawMiniPreviewBox(ctx, ix + 16, iy + 28, boxW - 12, gameState.nextTier, gameState.nextMeta, sprites, nowSec, false);
  drawMiniPreviewBox(ctx, ix + iw - boxW - 4, iy + 28, boxW - 12, gameState.holdTier, gameState.holdMeta, sprites, nowSec, true);
  hits.add('wide_hold_swap', ix + iw - boxW - 4, iy + 28, boxW - 12, boxW - 12, () => app.swapHoldPocket());

  // Evolution Ring 1..9
  const ry = iy + 28 + boxW + 18;
  UI.drawFitText(ctx, `🍰 进化链 ${gameState.seenThisRun.size}/9`, ix + iw * 0.5, ry, iw - 20, 12, 10, 800, '#4A2C2A', 'center');

  const rcx = ix + iw * 0.5;
  const rcy = ry + (iy + ih - ry) * 0.5 + 4;
  const rx = iw * 0.34;
  const rRadiusY = Math.min(72, (iy + ih - ry) * 0.36);

  ctx.save();
  ctx.fillStyle = '#724640';
  ctx.font = UI.fontStr(10.5, 800);
  ctx.textAlign = 'center';
  ctx.fillText('两两相碰', rcx, rcy - 7);
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
    ctx.arc(nx, ny, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = seen ? '#9b6f40' : '#a88f6c';
    ctx.stroke();
    if (!seen) ctx.globalAlpha = 0.32;
    if (sprites.base[t.tier]) {
      UI.drawContainImage(ctx, sprites.base[t.tier], nx, ny, 24, 24);
    }
    ctx.restore();
    hits.add(`evo_${t.tier}`, nx - 16, ny - 16, 32, 32, () => app.openModal('compendium'));
  }
}

function renderToast(ctx, width, headerBottom, app) {
  if (!app.toastText || app.toastTimer <= 0) return;
  const alpha = Math.min(1, app.toastTimer * 3);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = UI.fontStr(12, 700);
  const maxW = width - 28;
  const tw = Math.min(maxW, ctx.measureText(app.toastText).width + 26);
  const tx = (width - tw) * 0.5;
  const ty = headerBottom + 6;
  UI.roundRectPath(ctx, tx, ty, tw, 28, 14);
  ctx.fillStyle = 'rgba(54, 30, 14, 0.94)';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#ffd56b';
  ctx.stroke();
  UI.drawFitText(ctx, app.toastText, width * 0.5, ty + 14.5, tw - 18, 12, 9.5, 700, '#fff2cb', 'center');
  ctx.restore();
}

module.exports = {
  renderBackdrop,
  renderLobbyScreen,
  renderPlayScreen,
  renderToast,
  computeTopHeaderGeometry
};
