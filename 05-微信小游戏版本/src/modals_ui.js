/**
 * Canvas 2D Storybook Interactive Modals for WeChat Mini Game
 * Supports Shop (3 tabs), Career & Achievements, Help Guide, Compendium,
 * 3-Choice Chef Blessings, and End-of-Run Settlement with smooth vertical scrolling.
 */
'use strict';

const {
  TIERS,
  PATRONS,
  SHOP_UPGRADES,
  JAR_THEME_LIST,
  ACHIEVEMENTS,
  getShiftConfig,
  MAX_RELIC_SLOTS,
  RELIC_ARCHETYPES,
  RELICS,
  DECK_MODS,
  getChefRank
} = require('./constants');
const UI = require('./ui_draw');

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

function renderActiveModal(ctx, metrics, app, hits) {
  const modal = app.activeModal;
  if (!modal) {
    app.modalScrollRect = null;
    return;
  }

  if (modal === 'shop') renderShopModal(ctx, metrics, app, hits);
  else if (modal === 'career') renderCareerModal(ctx, metrics, app, hits);
  else if (modal === 'help') renderHelpModal(ctx, metrics, app, hits);
  else if (modal === 'compendium') renderCompendiumModal(ctx, metrics, app, hits);
  else if (modal === 'blessing') renderBlessingModal(ctx, metrics, app, hits);
  else if (modal === 'prep_shop') renderPrepShopModal(ctx, metrics, app, hits);
  else if (modal === 'shift_victory') renderShiftVictoryModal(ctx, metrics, app, hits);
  else if (modal === 'relics') renderRelicsModal(ctx, metrics, app, hits);
  else if (modal === 'gameover') renderGameOverModal(ctx, metrics, app, hits);
}

function renderShopModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 680, metrics.height * 0.84, hits);
  const { saveData, sprites, activeShopTab } = app;
  const isWide = f.iw >= 520;

  // Header
  let hy = f.iy;
  if (sprites.shopSign) {
    UI.drawContainImage(ctx, sprites.shopSign, f.ix + 18, hy + 18, 34, 34);
  }
  UI.drawFitText(ctx, '吃茶小铺 · Starlight Shop', f.ix + 40, hy + 12, f.iw - 175, 16, 12, 900, '#4A2C2A');
  UI.drawFitText(ctx, '永久星尘升级天赋、玻璃罐与搭档', f.ix + 40, hy + 29, f.iw - 175, 10.5, 8.5, 700, '#884a18');

  const closeW = 58;
  UI.drawPillButton(ctx, f.ix + f.iw - closeW, hy + 2, closeW, 28, { style: 'wood', text: '✕ 关闭', fontSize: 11.5 });
  hits.add('modal_close', f.ix + f.iw - closeW, hy + 2, closeW, 28, () => app.closeModal());

  const bankStr = `⭐ ${saveData.bankStardust || 0}`;
  const bankW = Math.max(58, 28 + String(saveData.bankStardust || 0).length * 8);
  UI.drawPillButton(ctx, f.ix + f.iw - closeW - 6 - bankW, hy + 2, bankW, 28, {
    style: 'active',
    text: bankStr,
    fontSize: 12
  });

  // 3 Shop Tabs
  const tabY = hy + 42;
  const tabH = 30;
  const tabs = [
    { id: 'upgrades', label: '🍳 厨房天赋' },
    { id: 'themes', label: '🫙 玻璃罐换装' },
    { id: 'patrons', label: '🐾 助阵伙伴' }
  ];
  const tabW = (f.iw - 12) / 3;
  for (let i = 0; i < tabs.length; i++) {
    const t = tabs[i];
    const tx = f.ix + i * (tabW + 6);
    const active = activeShopTab === t.id;
    UI.drawPillButton(ctx, tx, tabY, tabW, tabH, {
      style: active ? 'active' : 'wood',
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

      UI.drawParchmentSheet(ctx, cx, cy, cardW, cardH, 12, isMax ? '#f3fff7' : '#fffdf6', isMax ? '#ddf4e4' : '#f7e9c7', isMax ? '#3d8e61' : '#c39a60', 2);

      // Icon square
      UI.drawParchmentSheet(ctx, cx + 10, cy + 10, 40, 40, 10, '#fff6dc', '#fff6dc', '#4A2C2A', 1.8);
      ctx.font = UI.fontStr(20, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(up.icon, cx + 30, cy + 31);

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
        style: isMax ? 'equipped' : 'wood',
        text: isMax ? '✓ 已升至满级' : `⭐ ${cost} 永久星尘升级`,
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

      UI.drawParchmentSheet(ctx, cx, cy, cardW, cardH, 12, equipped ? '#f3fff7' : '#fffdf6', equipped ? '#ddf4e4' : '#f7e9c7', equipped ? '#3d8e61' : '#c39a60', 2);
      UI.drawThemeSwatch(ctx, cx + 10, cy + 10, 42, 42, th.id);
      ctx.strokeStyle = '#4A2C2A';
      ctx.lineWidth = 1.8;
      UI.roundRectPath(ctx, cx + 10, cy + 10, 42, 42, 9);
      ctx.stroke();

      UI.drawFitText(ctx, `${th.icon} ${th.name}`, cx + 60, cy + 20, cardW - 70, 13, 10.5, 900, '#4A2C2A');
      const statusTxt = equipped ? '✦ 使用中' : owned ? '已拥有' : `${th.cost} ⭐`;
      UI.drawPillButton(ctx, cx + 60, cy + 31, 62, 17, { style: 'active', text: statusTxt, fontSize: 9.5, radius: 8.5 });

      UI.drawWrappedText(ctx, th.desc, cx + 10, cy + 58, cardW - 20, 13.5, UI.fontStr(10.5, 600), '#724640', 'left', isWide ? 4 : 2);

      const btnY = cy + cardH - 31;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 24, {
        style: equipped ? 'equipped' : 'wood',
        text: equipped ? '✓ 当前装备中' : owned ? '✨ 立即换装' : `⭐ ${th.cost} 解锁并换装`,
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

      UI.drawParchmentSheet(ctx, cx, cy, cardW, cardH, 12, selected ? '#f3fff7' : '#fffdf6', selected ? '#ddf4e4' : '#f7e9c7', selected ? '#3d8e61' : '#c39a60', 2);
      UI.drawParchmentSheet(ctx, cx + 10, cy + 10, 42, 42, 10, '#fff6dc', '#fff6dc', '#4A2C2A', 1.8);
      if (sprites.patrons[p.id]) {
        UI.drawContainImage(ctx, sprites.patrons[p.id], cx + 31, cy + 31, 36, 36);
      }

      UI.drawFitText(ctx, `${p.badge} ${p.shortName}`, cx + 60, cy + 20, cardW - 70, 13, 10.5, 900, '#4A2C2A');
      UI.drawPillButton(ctx, cx + 60, cy + 31, 62, 17, { style: 'active', text: p.skillName, fontSize: 9.5, radius: 8.5 });

      UI.drawWrappedText(ctx, p.passiveDesc, cx + 10, cy + 58, cardW - 20, 13.5, UI.fontStr(10.5, 600), '#724640', 'left', isWide ? 4 : 2);

      const btnY = cy + cardH - 31;
      UI.drawPillButton(ctx, cx + 10, btnY, cardW - 20, 24, {
        style: selected ? 'equipped' : 'wood',
        text: selected ? '✓ 当前出战中' : owned ? '🐾 切换出战' : `⭐ ${p.cost} 邀请入店`,
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
  UI.drawFitText(ctx, '🏆 星夜吃茶 · 营业履历', f.ix, f.iy + 12, f.iw - 66, 16, 12, 900, '#4A2C2A');
  UI.drawFitText(ctx, `当前头衔：${getChefRank(app.getCareerTopScore())}`, f.ix, f.iy + 30, f.iw - 66, 11, 9, 800, '#884a18');

  const closeW = 58;
  UI.drawPillButton(ctx, f.ix + f.iw - closeW, f.iy + 2, closeW, 28, { style: 'wood', text: '✕ 关闭', fontSize: 11.5 });
  hits.add('modal_close', f.ix + f.iw - closeW, f.iy + 2, closeW, 28, () => app.closeModal());

  const bodyY = f.iy + 44;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const achCols = f.iw >= 480 ? 3 : 2;
  const achRows = Math.ceil(ACHIEVEMENTS.length / achCols);
  const totalH = 62 + 8 + 56 + 24 + achRows * 60;
  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);

  // 3 Mode Best Tiles
  const mTiles = [
    { label: '🌟 主厨最高', val: saveData.bestChef || 0 },
    { label: '⚡ 90秒最高', val: saveData.bestRush || 0 },
    { label: '🍵 悠闲最高', val: saveData.bestZen || 0 }
  ];
  const mW = (f.iw - 16) / 3;
  for (let i = 0; i < 3; i++) {
    const mx = f.ix + i * (mW + 6);
    UI.drawParchmentSheet(ctx, mx, bodyY, mW, 54, 10, '#fff9eb', '#fff9eb', '#c7a067', 1.8);
    UI.drawFitText(ctx, mTiles[i].label, mx + mW * 0.5, bodyY + 17, mW - 8, 10.5, 8.5, 800, '#724640', 'center');
    UI.drawFitText(ctx, String(mTiles[i].val), mx + mW * 0.5, bodyY + 38, mW - 8, 17, 12, 900, '#4A2C2A', 'center');
  }

  // 5 Lifetime Stats Row
  const sy = bodyY + 62;
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
    UI.drawParchmentSheet(ctx, sx, sy, sW, 46, 8, 'rgba(217,184,130,0.28)', 'rgba(217,184,130,0.28)', '#cba872', 1.4);
    UI.drawFitText(ctx, lStats[i].label, sx + sW * 0.5, sy + 14, sW - 6, 9.5, 7.5, 700, '#724640', 'center');
    UI.drawFitText(ctx, lStats[i].val, sx + sW * 0.5, sy + 33, sW - 6, 12.5, 9.5, 900, '#4A2C2A', 'center');
  }

  // Achievements Grid
  const ay = sy + 56;
  UI.drawFitText(ctx, '🌟 店铺纪念勋章', f.ix, ay + 8, f.iw, 12, 10, 900, '#4A2C2A');
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
    UI.drawParchmentSheet(
      ctx,
      cx,
      cy,
      aw,
      52,
      10,
      done ? '#fffaf0' : '#eadcc0',
      done ? '#fffaf0' : '#eadcc0',
      done ? '#d4a64a' : '#bfa57b',
      1.8
    );
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
  UI.drawFitText(ctx, '❓ 星夜吃茶 · 玩法与秘籍', f.ix, f.iy + 14, f.iw - 66, 16, 12, 900, '#4A2C2A');
  const closeW = 58;
  UI.drawPillButton(ctx, f.ix + f.iw - closeW, f.iy + 1, closeW, 28, { style: 'wood', text: '✕ 关闭', fontSize: 11.5 });
  hits.add('modal_close', f.ix + f.iw - closeW, f.iy + 1, closeW, 28, () => app.closeModal());

  const cards = [
    {
      title: '🎱 双模投料：快投 × 拉弓弹壁',
      lines: [
        '• 轻点/横滑 = 快速垂投；按住下拉 ≥26px 切【拉弓弹壁斜抛】',
        '• 碰壁反弹命中合成触发【弹壁神球 ×1.5】，上划罐口取消投放',
        '• 点击右上方「HOLD」随时交换暂存，灵活编排连合节奏'
      ]
    },
    {
      title: '🔔 真·点选出餐 & 🏔️ 抽底雪崩',
      lines: [
        '• 符合双桌订单的甜品在罐内亮起【🔔上菜】，直接点击端走！',
        '• 抽底后 2.6 秒内塌方合成享【雪崩 ×1.4~×3.2】，2 连返步数！',
        '• 90 秒狂欢出餐直接 +3.0 秒续命；9 阶猫神留罐 ×2 或点它献礼'
      ]
    },
    {
      title: '✨ 9 阶甜品异能 & 🌟 招牌主动技',
      lines: [
        '• 蜜桃高弹、抹茶柔磁、柠檬清蓝莓、大福聚拢、甜甜圈旋搅、马卡龙微浮、蒙布朗压碎',
        '• 出餐充满底部中央【招牌技】：蜜柑捞底、星兔互换、柴柴重锤',
        '• 点击「📖 图鉴」可随时查阅每一阶甜品的物理特性与异能'
      ]
    },
    {
      title: '🏪 5 幕闯关 & 后厨整备构筑',
      lines: [
        '• 在限定步数内达标营业额即过关，提前达标可点【🔔立即打烊】换币',
        '• 每幕结束进【🏪 后厨整备间】，用 🪙 装备 16 张流派秘方与改造队列',
        '• 热炉传承保留最高 2 颗甜品进下幕，5 幕通关可挑战无尽午夜加时！'
      ]
    }
  ];

  const bodyY = f.iy + 38;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const isWide = f.iw >= 500;
  const cols = isWide ? 2 : 1;
  const cardW = (f.iw - 10 - (cols - 1) * 9) / cols;
  const cardH = isWide ? 156 : 118;
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
    UI.drawParchmentSheet(ctx, cx, cy, cardW, cardH, 10, '#fffaf0', '#fffaf0', '#cba872', 1.8);
    UI.drawFitText(ctx, cards[i].title, cx + 10, cy + 16, cardW - 20, 12.5, 10, 900, '#4A2C2A');
    let ly = cy + 28;
    for (let j = 0; j < cards[i].lines.length; j++) {
      ly += UI.drawWrappedText(ctx, cards[i].lines[j], cx + 10, ly, cardW - 20, 13.5, UI.fontStr(10.2, 600), '#724640') + 2;
    }
  }
  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderCompendiumModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 660, metrics.height * 0.84, hits);
  const { saveData, sprites } = app;
  UI.drawFitText(ctx, `📖 甜品异能图鉴 (已解锁 ${saveData.unlockedTiers.length}/9)`, f.ix, f.iy + 14, f.iw - 66, 15.5, 11.5, 900, '#4A2C2A');
  const closeW = 58;
  UI.drawPillButton(ctx, f.ix + f.iw - closeW, f.iy + 1, closeW, 28, { style: 'wood', text: '✕ 关闭', fontSize: 11.5 });
  hits.add('modal_close', f.ix + f.iw - closeW, f.iy + 1, closeW, 28, () => app.closeModal());

  const bodyY = f.iy + 38;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const cols = f.iw >= 500 ? 3 : 2;
  const gap = 8;
  const cardW = (f.iw - 8 - (cols - 1) * gap) / cols;
  const cardH = 136;
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
    UI.drawParchmentSheet(
      ctx,
      cx,
      cy,
      cardW,
      cardH,
      10,
      unlocked ? '#fffaf0' : '#ead9bb',
      unlocked ? '#fffaf0' : '#ead9bb',
      unlocked ? '#c59c62' : '#b29770',
      1.8
    );
    UI.drawFitText(ctx, `${t.tier}阶 · 合+${t.points} · 出+${t.servePoints}`, cx + cardW * 0.5, cy + 13, cardW - 12, 9.5, 8, 800, '#8f4e1b', 'center');
    if (sprites.base[t.tier]) {
      ctx.save();
      if (!unlocked) ctx.globalAlpha = 0.25;
      UI.drawContainImage(ctx, sprites.base[t.tier], cx + cardW * 0.5, cy + 42, 40, 40);
      ctx.restore();
    }
    UI.drawFitText(ctx, unlocked ? `${t.name}` : '??? 未解锁', cx + cardW * 0.5, cy + 70, cardW - 12, 11.5, 9.5, 900, '#4A2C2A', 'center');
    if (unlocked && t.traitName) {
      UI.drawFitText(ctx, `✦ 异能：${t.traitName}`, cx + cardW * 0.5, cy + 84, cardW - 14, 9.5, 8, 800, '#b04914', 'center');
    }
    UI.drawWrappedText(
      ctx,
      unlocked ? (t.traitDesc || t.lore) : '继续向上合成即可解锁甜品异能！',
      cx + 8,
      cy + 94,
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
  const { gameState } = app;

  const rem = gameState.pendingBlessings;
  const title = rem > 1 ? `🎁 星夜主厨祝福 (剩余 ${rem} 次)` : '🎁 星夜主厨祝福 · 三选一';
  UI.drawFitText(ctx, title, f.ix, f.iy + 12, f.iw - 84, 16, 12, 900, '#4A2C2A');
  UI.drawFitText(ctx, gameState.blessingSubText || '任选 1 张魔法秘方，立刻强化本局甜品连锁！', f.ix, f.iy + 29, f.iw - 84, 10.5, 8.5, 700, '#884a18');

  const deferW = 70;
  UI.drawPillButton(ctx, f.ix + f.iw - deferW, f.iy + 2, deferW, 28, { style: 'wood', text: '稍后再领', fontSize: 11 });
  hits.add('modal_close', f.ix + f.iw - deferW, f.iy + 2, deferW, 28, () => app.closeModal());

  const choices = gameState.blessingChoices || [];
  const bodyY = f.iy + 44;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
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
      const lvLabel = b.repeatable ? '即时生效' : curLv === 0 ? '✨ 新秘方 Lv.1' : `⬆️ Lv.${curLv}→${nextLv}`;

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
      ctx.fillText(b.icon, cx + cw * 0.5, bodyY + 40);

      UI.drawPillButton(ctx, cx + cw * 0.5 - 30, bodyY + 70, 60, 17, { style: 'active', text: b.tag, fontSize: 9.5, radius: 8.5 });
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
      const lvLabel = b.repeatable ? '即时生效' : curLv === 0 ? '✨ 新秘方 Lv.1' : `⬆️ Lv.${curLv}→${nextLv}`;

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
      ctx.fillText(b.icon, f.ix + 30, cy + ch * 0.5 + 1);

      const tx = f.ix + 60;
      const tw = f.iw - 70;
      UI.drawFitText(ctx, b.name, tx, cy + 19, tw - 110, 14, 11, 900, '#4A2C2A');
      UI.drawPillButton(ctx, f.ix + f.iw - 64, cy + 9, 54, 18, { style: 'active', text: b.tag, fontSize: 9.5, radius: 9 });
      UI.drawFitText(ctx, lvLabel, f.ix + f.iw - 70, cy + 19, 80, 10, 8.5, 800, '#8f4716', 'right');
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
  const { gameState } = app;
  const shop = gameState.prepShop;
  if (!shop) return;

  const isWide = f.iw >= 500;
  const nextCfg = getShiftConfig(shop.nextShiftNum);
  const coins = gameState.coins || 0;

  // 1. Sticky Header: Title + Coins + Reroll
  UI.drawFitText(ctx, '🏪 后厨整备间 · 流派构筑', f.ix, f.iy + 14, f.iw - 160, 16, 12, 900, '#4A2C2A');

  const rerollW = isWide ? 94 : 78;
  const canReroll = coins >= shop.rerollCost;
  const rerollX = f.ix + f.iw - rerollW;
  UI.drawPillButton(ctx, rerollX, f.iy + 1, rerollW, 28, {
    style: 'wood',
    text: `🔄 刷 ${shop.rerollCost}🪙`,
    fontSize: 10.5,
    disabled: !canReroll
  });
  hits.add('prep_reroll', rerollX, f.iy + 1, rerollW, 28, () => app.rerollPrepShop());

  const coinStr = `🪙 ${coins}`;
  const coinW = Math.max(58, 28 + String(coins).length * 8);
  const coinX = rerollX - coinW - 6;
  UI.drawPillButton(ctx, coinX, f.iy + 1, coinW, 28, {
    style: 'active',
    text: coinStr,
    fontSize: 12
  });

  // 2. Sticky Footer CTA: Launch Next Shift
  const footerH = 42;
  const footerY = f.iy + f.ih - footerH;
  UI.drawPillButton(ctx, f.ix, footerY, f.iw, footerH, {
    style: 'cta',
    text: `🚀 开启第 ${nextCfg.shift} 幕 · ${nextCfg.name}（目标 ¥${nextCfg.target}）`,
    fontSize: isWide ? 14 : 12.2,
    fontWeight: 900
  });
  hits.add('prep_next_shift', f.ix, footerY, f.iw, footerH, () => app.proceedNextShift());

  // 3. Scrollable Body between Header & Footer
  const bodyY = f.iy + 36;
  const bodyH = footerY - bodyY - 8;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const sum = shop.shiftSummary;
  const receiptH = sum ? 42 : 0;
  const equippedH = 66;
  const relicCols = isWide ? 3 : 1;
  const relicGap = 8;
  const relicCardH = isWide ? 156 : 94;
  const relicRows = Math.ceil((shop.relicOffers || []).length / relicCols);
  const relicsSectionH = 20 + relicRows * relicCardH + Math.max(0, relicRows - 1) * relicGap;

  const modCols = isWide ? 2 : 1;
  const modGap = 8;
  const modCardH = isWide ? 88 : 78;
  const modRows = Math.ceil((shop.modOffers || []).length / modCols);
  const modsSectionH = 22 + modRows * modCardH + Math.max(0, modRows - 1) * modGap;

  const totalContentH =
    (receiptH > 0 ? receiptH + 8 : 0) + equippedH + 10 + relicsSectionH + 10 + modsSectionH + 6;
  app.modalMaxScroll = Math.max(0, totalContentH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  let curY = bodyY;

  // 3a. Shift Clear Receipt Banner
  if (sum) {
    UI.drawParchmentSheet(ctx, f.ix, curY, f.iw - 6, receiptH, 10, '#fff7d6', '#fce8a8', '#c48823', 1.6);
    const carriedNames =
      sum.carried && sum.carried.length > 0
        ? sum.carried.map((c) => `${c.tier}阶${TIERS[c.tier - 1].name}`).join(' + ')
        : '全新起炉';
    UI.drawFitText(
      ctx,
      `🎉 第 ${sum.shift} 幕过关！基薪+${sum.baseCoins}🪙 · 剩${sum.stepsSaved}步息+${sum.stepInterest}🪙${sum.cleanTip > 0 ? ` · 清理+${sum.cleanTip}🪙` : ''}`,
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
      `🔥 热炉传承带入下幕：${carriedNames}`,
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

  // 3b. Equipped Relics Bar (4 Slots — tap equipped to sell for 50% refund!)
  const eqW = f.iw - 6;
  UI.drawParchmentSheet(ctx, f.ix, curY, eqW, equippedH, 10, 'rgba(217,184,130,0.24)', 'rgba(217,184,130,0.24)', '#c8a26a', 1.4);
  UI.drawFitText(
    ctx,
    `✨ 已装备秘方 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`,
    f.ix + 9,
    curY + 13,
    eqW * 0.55,
    11,
    9,
    900,
    '#4A2C2A'
  );
  UI.drawFitText(
    ctx,
    '点击已装备可半价卖出换流派',
    f.ix + eqW - 9,
    curY + 13,
    eqW * 0.5,
    9.5,
    8,
    700,
    '#8f4e1b',
    'right'
  );

  const slotGap = 6;
  const slotW = (eqW - 18 - slotGap * (MAX_RELIC_SLOTS - 1)) / MAX_RELIC_SLOTS;
  const slotY = curY + 24;
  const slotH = 35;
  for (let i = 0; i < MAX_RELIC_SLOTS; i++) {
    const sx = f.ix + 9 + i * (slotW + slotGap);
    const rid = gameState.relics && gameState.relics[i];
    const def = rid ? RELICS.find((r) => r.id === rid) : null;
    const arch = def ? RELIC_ARCHETYPES[def.archetype] : null;
    UI.roundRectPath(ctx, sx, slotY, slotW, slotH, 8);
    ctx.fillStyle = def ? (arch ? arch.bg : '#fff8e2') : '#f0e2c6';
    ctx.fill();
    ctx.lineWidth = def ? 1.6 : 1.2;
    ctx.strokeStyle = def ? (arch ? arch.color : '#c48823') : '#bfa278';
    ctx.stroke();

    if (def) {
      const sellVal = Math.floor(def.price * 0.5);
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, sx + slotW * 0.5, slotY + 12, slotW - 6, 10, 7.8, 900, '#4A2C2A', 'center');
      UI.drawFitText(ctx, `点卖 +${sellVal}🪙`, sx + slotW * 0.5, slotY + 26, slotW - 6, 8.8, 7.5, 800, '#a34814', 'center');
      addClippedHit(hits, `prep_sell_${def.id}`, sx, slotY - app.modalScrollY, slotW, slotH, () => app.sellRelic(def.id), clipRect);
    } else {
      UI.drawFitText(ctx, '空秘方槽', sx + slotW * 0.5, slotY + slotH * 0.5, slotW - 6, 9.5, 8, 700, '#9c805e', 'center');
    }
  }
  curY += equippedH + 10;

  // 3c. 3 Relic Offers Shelf
  UI.drawFitText(ctx, '📜 流派规则秘方（限选装备，构筑核心流派）', f.ix, curY + 8, eqW, 11.5, 9.5, 900, '#4A2C2A');
  curY += 20;

  const rCardW = (eqW - relicGap * (relicCols - 1)) / relicCols;
  const fullSlots = (gameState.relics || []).length >= MAX_RELIC_SLOTS;
  for (let i = 0; i < (shop.relicOffers || []).length; i++) {
    const offer = shop.relicOffers[i];
    const def = RELICS.find((r) => r.id === offer.id);
    if (!def) continue;
    const arch = RELIC_ARCHETYPES[def.archetype] || { icon: '✨', name: '秘方', color: '#8f4716', bg: '#fff4d8' };
    const col = i % relicCols;
    const row = Math.floor(i / relicCols);
    const cx = f.ix + col * (rCardW + relicGap);
    const cy = curY + row * (relicCardH + relicGap);
    const bought = !!offer.bought;
    const canBuy = !bought && !fullSlots && coins >= def.price;

    UI.drawParchmentSheet(
      ctx,
      cx,
      cy,
      rCardW,
      relicCardH,
      11,
      bought ? '#edf8f0' : '#fffdf6',
      bought ? '#ddf1e2' : '#f7ead0',
      bought ? '#3f9663' : arch.color,
      bought ? 1.6 : 1.9
    );

    // Rarity & Archetype badge
    const rarColor = def.rarity === 'legendary' ? '#b8620a' : def.rarity === 'rare' ? '#6c2fa0' : '#5e5042';
    const tagTxt = `${arch.icon}${arch.name}·${def.rarityLabel}`;
    UI.roundRectPath(ctx, cx + 8, cy + 7, Math.min(rCardW - 16, 118), 16, 8);
    ctx.fillStyle = arch.bg;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = arch.color;
    ctx.stroke();
    UI.drawFitText(ctx, tagTxt, cx + 14, cy + 15.5, Math.min(rCardW - 26, 108), 8.8, 7.5, 900, rarColor);

    if (isWide) {
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, cx + 10, cy + 36, rCardW - 20, 13.5, 10.5, 900, '#4A2C2A');
      UI.drawWrappedText(ctx, def.desc, cx + 10, cy + 50, rCardW - 20, 14, UI.fontStr(10.2, 600), '#6d443a', 'left', 4);
      const bY = cy + relicCardH - 30;
      UI.drawPillButton(ctx, cx + 10, bY, rCardW - 20, 23, {
        style: bought ? 'equipped' : canBuy ? 'cta' : 'wood',
        text: bought ? '✓ 已装备' : fullSlots ? '秘方栏已满' : `🪙 ${def.price} 购买装备`,
        fontSize: 10.5,
        disabled: !canBuy && !bought
      });
      if (!bought) {
        addClippedHit(hits, `prep_buy_relic_${def.id}`, cx + 10, bY - app.modalScrollY, rCardW - 20, 23, () => app.buyRelic(def.id), clipRect);
      }
    } else {
      // Compact horizontal card on mobile portrait
      const btnW = 86;
      UI.drawFitText(ctx, `${def.icon} ${def.name}`, cx + 10, cy + 34, rCardW - btnW - 22, 13, 10.5, 900, '#4A2C2A');
      UI.drawWrappedText(ctx, def.desc, cx + 10, cy + 46, rCardW - btnW - 22, 13, UI.fontStr(9.8, 600), '#6d443a', 'left', 3);
      const bX = cx + rCardW - btnW - 8;
      const bY = cy + relicCardH * 0.5 - 14;
      UI.drawPillButton(ctx, bX, bY, btnW, 28, {
        style: bought ? 'equipped' : canBuy ? 'cta' : 'wood',
        text: bought ? '✓ 已装备' : fullSlots ? '栏位已满' : `🪙 ${def.price}`,
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
  UI.drawFitText(ctx, '🧪 原料池改造 & 补给', f.ix, curY + 8, eqW, 11.5, 9.5, 900, '#4A2C2A');
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

    UI.drawParchmentSheet(
      ctx,
      cx,
      cy,
      mCardW,
      modCardH,
      10,
      bought ? '#edf8f0' : '#fffaf0',
      bought ? '#ddf1e2' : '#f7ead0',
      bought ? '#3f9663' : '#b88b52',
      1.6
    );
    const btnW = 78;
    const limitTag = def.maxBuy < 10 ? ` (${ownedCnt}/${def.maxBuy})` : '';
    UI.drawFitText(ctx, `${def.icon} ${def.name}${limitTag}`, cx + 10, cy + 17, mCardW - btnW - 22, 12.2, 10, 900, '#4A2C2A');
    UI.drawWrappedText(ctx, def.desc, cx + 10, cy + 30, mCardW - btnW - 22, 13, UI.fontStr(9.8, 600), '#6d443a', 'left', 3);

    const bX = cx + mCardW - btnW - 8;
    const bY = cy + modCardH * 0.5 - 14;
    UI.drawPillButton(ctx, bX, bY, btnW, 28, {
      style: bought ? 'equipped' : canBuy ? 'active' : 'wood',
      text: bought ? '✓ 已购买' : maxed ? '已上限' : `🪙 ${def.price}`,
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
  const { gameState } = app;
  const offer = gameState.victoryOffer || {};
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  UI.drawFitText(ctx, '🏆 星冠大赏 · 5幕全通关！', f.ix + f.iw * 0.5, f.iy + 18, f.iw, 18.5, 13.5, 900, '#7c3c08', 'center');
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
    { x: f.ix, y: tY2, label: '最高抽底雪崩 / 连击', val: `🏔️${gameState.maxAvalancheRun}连 · ${gameState.maxCombo}x` },
    { x: x2, y: tY2, label: '当前流派构筑', val: (gameState.relics || []).map((id) => (RELICS.find((r) => r.id === id) || {}).icon || '✦').join(' ') || '纯净无遗物' }
  ];
  for (const t of tiles) {
    UI.drawParchmentSheet(ctx, t.x, t.y, tileW, tileH, 10, '#fff9eb', '#fff9eb', '#c8a26a', 1.8);
    UI.drawFitText(ctx, t.label, t.x + tileW * 0.5, t.y + 15, tileW - 10, 10.5, 8.5, 700, '#724640', 'center');
    UI.drawFitText(ctx, t.val, t.x + tileW * 0.5, t.y + 37, tileW - 10, 14.5, 10, 900, '#4A2C2A', 'center');
  }

  // Trophy Stardust Preview Box
  const py = tY2 + tileH + 10;
  UI.drawParchmentSheet(ctx, f.ix, py, f.iw, 56, 11, '#fff8d4', '#fce59d', '#c48823', 1.8);
  UI.drawFitText(ctx, '⭐ 已锁定通关星尘奖励（含 +35⭐ 完赛奖）', f.ix + 10, py + 18, f.iw - 20, 11.2, 9, 800, '#6b3b0c');
  UI.drawFitText(
    ctx,
    `当前结算可得 +${offer.stardustPreview || 135} ⭐（进入无尽加时还可继续叠高！）`,
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
    text: '🔥 进入无尽午夜加时（逛整备间 → 第6幕）',
    fontSize: 13.5,
    fontWeight: 900
  });
  hits.add('victory_endless', f.ix, actY, f.iw, 42, () => app.enterEndlessOvertime());

  UI.drawPillButton(ctx, f.ix, actY + 50, f.iw, 38, {
    style: 'wood',
    text: '🏠 荣耀打烊 · 立即领取永久星尘',
    fontSize: 13
  });
  hits.add('victory_finish', f.ix, actY + 50, f.iw, 38, () => app.finishVictoryRun());
}

function renderRelicsModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 560, metrics.height * 0.8, hits);
  const { gameState } = app;
  const shiftCfg = getShiftConfig(gameState.shift);

  UI.drawFitText(ctx, `✨ 本局流派构筑 (${(gameState.relics || []).length}/${MAX_RELIC_SLOTS})`, f.ix, f.iy + 14, f.iw - 66, 15.5, 11.5, 900, '#4A2C2A');
  const closeW = 58;
  UI.drawPillButton(ctx, f.ix + f.iw - closeW, f.iy + 1, closeW, 28, { style: 'wood', text: '✕ 关闭', fontSize: 11.5 });
  hits.add('modal_close', f.ix + f.iw - closeW, f.iy + 1, closeW, 28, () => app.closeModal());

  const bodyY = f.iy + 38;
  const bodyH = f.iy + f.ih - bodyY;
  const clipRect = { x: f.ix - 2, y: bodyY, w: f.iw + 4, h: bodyH };
  app.modalScrollRect = clipRect;

  const equipped = (gameState.relics || []).map((id) => RELICS.find((r) => r.id === id)).filter(Boolean);
  const activeMods = DECK_MODS.filter((m) => app.getDeckModCount(m.id) > 0);
  const totalH = 56 + 10 + Math.max(1, equipped.length) * 68 + 26 + Math.max(1, activeMods.length) * 44;
  app.modalMaxScroll = Math.max(0, totalH - bodyH);
  app.modalScrollY = Math.max(0, Math.min(app.modalScrollY, app.modalMaxScroll));

  beginModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY);
  let curY = bodyY;

  // Current Shift Info Card
  UI.drawParchmentSheet(ctx, f.ix, curY, f.iw - 6, 52, 10, '#fff7dc', '#f9e6b3', '#c48823', 1.6);
  UI.drawFitText(ctx, `🌙 第 ${shiftCfg.shift} 幕 · ${shiftCfg.name}（目标 ¥${gameState.shiftTarget}）`, f.ix + 10, curY + 15, f.iw - 26, 12, 9.5, 900, '#4A2C2A');
  UI.drawWrappedText(ctx, shiftCfg.desc, f.ix + 10, curY + 26, f.iw - 26, 12.5, UI.fontStr(9.8, 600), '#7a491c', 'left', 2);
  curY += 62;

  // Equipped Relics List
  if (equipped.length === 0) {
    UI.drawParchmentSheet(ctx, f.ix, curY, f.iw - 6, 56, 10, '#fffaf0', '#fffaf0', '#cba872', 1.4);
    UI.drawFitText(ctx, '尚未装备流派秘方', f.ix + (f.iw - 6) * 0.5, curY + 20, f.iw - 26, 12.5, 10, 800, '#724640', 'center');
    UI.drawFitText(ctx, '通关当前幕次后即可进入【🏪 后厨整备间】选购 16 张规则秘方！', f.ix + (f.iw - 6) * 0.5, curY + 38, f.iw - 26, 10, 8.5, 600, '#8f5b34', 'center');
    curY += 66;
  } else {
    for (const def of equipped) {
      const arch = RELIC_ARCHETYPES[def.archetype] || { icon: '✨', name: '秘方', color: '#8f4716', bg: '#fff4d8' };
      UI.drawParchmentSheet(ctx, f.ix, curY, f.iw - 6, 62, 10, '#fffdf6', '#f7ead0', arch.color, 1.6);
      UI.drawFitText(ctx, `${def.icon} ${def.name}  [${arch.icon}${arch.name}]`, f.ix + 10, curY + 16, f.iw - 26, 12, 9.5, 900, '#4A2C2A');
      UI.drawWrappedText(ctx, def.desc, f.ix + 10, curY + 28, f.iw - 26, 13, UI.fontStr(10, 600), '#6d443a', 'left', 2);
      curY += 68;
    }
  }

  // Active Deck Mods
  UI.drawFitText(ctx, '🧪 已生效原料池改造', f.ix, curY + 8, f.iw - 6, 11.5, 9.5, 900, '#4A2C2A');
  curY += 22;
  if (activeMods.length === 0) {
    UI.drawFitText(ctx, '暂无原料池改造（可在后厨整备间购买）', f.ix + 6, curY + 10, f.iw - 18, 10.5, 9, 600, '#8a684a');
  } else {
    for (const m of activeMods) {
      const cnt = app.getDeckModCount(m.id);
      UI.drawParchmentSheet(ctx, f.ix, curY, f.iw - 6, 38, 8, '#fffaf0', '#fffaf0', '#cba872', 1.3);
      UI.drawFitText(ctx, `${m.icon} ${m.name} ×${cnt}`, f.ix + 10, curY + 13, f.iw - 26, 11, 9, 800, '#4A2C2A');
      UI.drawFitText(ctx, m.desc, f.ix + 10, curY + 27, f.iw - 26, 9.5, 8, 600, '#724640');
      curY += 44;
    }
  }

  endModalScrollBody(ctx, clipRect.x, clipRect.y, clipRect.w, clipRect.h, app.modalScrollY, app.modalMaxScroll);
}

function renderGameOverModal(ctx, metrics, app, hits) {
  const f = renderModalBackdropAndFrame(ctx, metrics, app, 450, Math.min(476, metrics.height * 0.85), hits);
  const { gameState, goSettlement } = app;
  app.modalScrollRect = null;
  app.modalMaxScroll = 0;

  // Head
  const reason = (goSettlement && goSettlement.reason) || gameState.runEndReason;
  const title =
    reason === 'victory'
      ? '🏆 星冠大赏 · 荣耀打烊'
      : reason === 'shift_failed'
      ? `⏰ 第 ${gameState.shift} 幕营业未达标`
      : gameState.mode === 'rush' && gameState.rushFinished
      ? '⏰ 90秒狂欢结算'
      : '🌙 今夜打烊总结';
  UI.drawFitText(ctx, title, f.ix, f.iy + 15, f.iw - 116, 16.5, 12.5, 900, '#4A2C2A');
  const rankTxt = getChefRank(gameState.score);
  const rankW = Math.min(130, Math.max(82, rankTxt.length * 10 + 18));
  UI.drawPillButton(ctx, f.ix + f.iw - rankW, f.iy + 3, rankW, 24, { style: 'active', text: rankTxt, fontSize: 10, radius: 12 });

  // 4 Stat Tiles (2x2)
  const tileW = (f.iw - 8) / 2;
  const tileH = 56;
  const tY1 = f.iy + 38;
  const tY2 = tY1 + tileH + 8;

  // Tile 1: Score / Cumulative Revenue + inline New Best
  UI.drawParchmentSheet(ctx, f.ix, tY1, tileW, tileH, 10, '#fff9eb', '#fff9eb', '#c8a26a', 1.8);
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
    UI.drawPillButton(ctx, sx + sw + 5, tY1 + 29, 45, 17, { style: 'danger', text: '新纪录!', fontSize: 9, radius: 8.5 });
  } else {
    UI.drawFitText(ctx, sStr, f.ix + tileW * 0.5, tY1 + 38, tileW - 12, 19, 13, 900, '#4A2C2A', 'center');
  }

  // Tile 2: Best Score or Shift Cleared Progress
  const x2 = f.ix + tileW + 8;
  UI.drawParchmentSheet(ctx, x2, tY1, tileW, tileH, 10, '#fff9eb', '#fff9eb', '#c8a26a', 1.8);
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
  UI.drawParchmentSheet(ctx, f.ix, tY2, tileW, tileH, 10, '#fff9eb', '#fff9eb', '#c8a26a', 1.8);
  UI.drawFitText(ctx, '最高阶甜品', f.ix + tileW * 0.5, tY2 + 15, tileW - 12, 11, 9, 700, '#724640', 'center');
  UI.drawFitText(ctx, `${gameState.maxTierRun}阶 · ${TIERS[gameState.maxTierRun - 1].name}`, f.ix + tileW * 0.5, tY2 + 38, tileW - 12, 12.5, 9.5, 900, '#4A2C2A', 'center');

  // Tile 4: Relics/Orders or Rush Combo/Yarn
  UI.drawParchmentSheet(ctx, x2, tY2, tileW, tileH, 10, '#fff9eb', '#fff9eb', '#c8a26a', 1.8);
  const fourthLabel =
    gameState.mode === 'rush'
      ? '最高连击 / 毛线球'
      : gameState.mode === 'chef'
      ? '出餐 / 最高雪崩'
      : '完成订单 / 最高连击';
  const fourthVal =
    gameState.mode === 'rush'
      ? `${gameState.maxCombo}x · 🧶${gameState.yarnBrokenThisRun}`
      : gameState.mode === 'chef'
      ? `🔔${gameState.servesCompleted}次 · 🏔️${gameState.maxAvalancheRun}连`
      : `${gameState.ordersCompleted} 单 · ${gameState.maxCombo}x`;
  UI.drawFitText(ctx, fourthLabel, x2 + tileW * 0.5, tY2 + 15, tileW - 12, 10.5, 8.5, 700, '#724640', 'center');
  UI.drawFitText(ctx, fourthVal, x2 + tileW * 0.5, tY2 + 38, tileW - 12, 15, 10.5, 900, '#4A2C2A', 'center');

  // Permanent Stardust Bank Deposit Card
  const by = tY2 + tileH + 10;
  const bh = goSettlement && goSettlement.hasAffordable ? 78 : 62;
  UI.drawParchmentSheet(ctx, f.ix, by, f.iw, bh, 11, '#fff9db', '#fce8a8', '#c48823', 1.8);
  UI.drawFitText(ctx, '⭐ 永久星尘入账', f.ix + 10, by + 16, f.iw * 0.55, 12.5, 10, 800, '#6b3b0c');
  UI.drawFitText(ctx, `+${goSettlement ? goSettlement.finalEarned : 0} ⭐`, f.ix + f.iw - 10, by + 16, f.iw * 0.4, 17, 13, 900, '#a64d00', 'right');
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
    UI.drawFitText(ctx, '🏪 吃茶小铺已有可兑换的新品或天赋！', f.ix + 10, by + bh - 12, f.iw - 20, 10.5, 9, 900, '#b53a1e');
  }

  // Action Buttons
  const actY = f.iy + f.ih - 84;
  UI.drawPillButton(ctx, f.ix, actY, f.iw, 42, {
    style: 'cta',
    text: '🔄 再来一局 · Play Again',
    fontSize: 15,
    fontWeight: 900
  });
  hits.add('go_play_again', f.ix, actY, f.iw, 42, () => app.restartRun());

  const secY = actY + 48;
  const secW = (f.iw - 8) / 2;
  UI.drawPillButton(ctx, f.ix, secY, secW, 34, {
    style: 'wood',
    text: '🏠 回到吃茶大厅',
    fontSize: 12.5
  });
  hits.add('go_back_lobby', f.ix, secY, secW, 34, () => app.returnToLobby());

  UI.drawPillButton(ctx, f.ix + secW + 8, secY, secW, 34, {
    style: 'wood',
    text: '📤 分享战绩给好友',
    fontSize: 12.5
  });
  hits.add('go_share', f.ix + secW + 8, secY, secW, 34, () => app.shareResult());
}

module.exports = {
  renderActiveModal
};
