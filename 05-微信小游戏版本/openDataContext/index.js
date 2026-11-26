/**
 * 微信小游戏开放数据域（Open Data Context）好友排行榜渲染器（v0.13 M4）
 *
 * 严格遵循微信小游戏开放域规范：
 * - 不在子域内修改 sharedCanvas.width / sharedCanvas.height（由主域统一设置尺寸，子域通过 setTransform 适配）
 * - 零外部素材依赖、纯十六进制与 rgba 色值、零原生彩色 Emoji、零数字字重（兼容 iOS Canvas 2D）
 * - 接收主域 postMessage({ type: 'render_friends', width, height, dpr, metric, forceRefresh }) 后
 *   拉取 wx.getFriendCloudStorage(['totalStars', 'totalScore']) 并渲染至 sharedCanvas。
 */
'use strict';

const STORAGE_KEYS = ['totalStars', 'totalScore'];

let cachedRows = null;
let lastFetchTs = 0;
let lastRenderOpts = null;
let lastRenderState = 'idle';
const FETCH_TTL_MS = 30 * 1000;
const avatarCache = {};

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawMiniStar(ctx, cx, cy, r) {
  ctx.save();
  try {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI * 0.5 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.48;
      const px = cx + Math.cos(ang) * rad;
      const py = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#F5B532';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#7A4718';
    ctx.stroke();
  } finally {
    ctx.restore();
  }
}

function formatNum(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function parseKvScore(kvList, key) {
  if (!Array.isArray(kvList)) return 0;
  for (let i = 0; i < kvList.length; i++) {
    const it = kvList[i];
    if (it && it.key === key) {
      const v = Number(it.value);
      return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
    }
  }
  return 0;
}

function getFriendAvatar(url, onLoaded) {
  if (typeof url !== 'string' || !url || typeof wx === 'undefined' || !wx || typeof wx.createImage !== 'function') {
    return null;
  }
  const existing = avatarCache[url];
  if (existing) {
    return existing.loaded ? existing.img : null;
  }
  try {
    const img = wx.createImage();
    const rec = { img, loaded: false, failed: false };
    avatarCache[url] = rec;
    img.onload = () => {
      rec.loaded = true;
      if (typeof onLoaded === 'function') onLoaded();
    };
    img.onerror = () => {
      rec.failed = true;
    };
    img.src = url;
  } catch (_) {}
  return null;
}

function drawStatusMessage(ctx, w, h, title, line1, line2, tone) {
  const midX = w * 0.5;
  const midY = h * 0.48;

  // Soft decorative medallion emblem (pure vector, zero emoji)
  ctx.save();
  try {
    ctx.beginPath();
    ctx.arc(midX, midY - 40, 24, 0, Math.PI * 2);
    ctx.fillStyle = tone === 'error' ? '#FCE6DC' : '#FFF1C9';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = tone === 'error' ? '#D27D52' : '#D69A3B';
    ctx.stroke();
    drawMiniStar(ctx, midX, midY - 40, 11);
  } finally {
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4E2B18';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(title, midX, midY + 4, Math.max(120, w - 24));

  ctx.fillStyle = '#7A4E2D';
  ctx.font = '12px sans-serif';
  ctx.fillText(line1, midX, midY + 28, Math.max(120, w - 24));

  if (line2) {
    ctx.fillStyle = '#9C724D';
    ctx.font = '11px sans-serif';
    ctx.fillText(line2, midX, midY + 48, Math.max(120, w - 24));
  }
}

function drawFriendsBoard(canvas, rows, opts, state) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const safeOpts = opts && typeof opts === 'object' ? opts : {};
  const dpr = Math.max(1, Math.min(3, Number(safeOpts.dpr) || 2));
  const w = Math.max(200, Math.floor(Number(safeOpts.width) || 300));
  const h = Math.max(160, Math.floor(Number(safeOpts.height) || 260));
  const bufW = Number(canvas.width) > 0 ? Number(canvas.width) : Math.round(w * dpr);
  const bufH = Number(canvas.height) > 0 ? Number(canvas.height) : Math.round(h * dpr);
  const scaleX = bufW / w;
  const scaleY = bufH / h;

  ctx.save();
  try {
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.clearRect(0, 0, bufW, bufH);
    if (typeof ctx.setTransform === 'function') {
      ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    } else {
      ctx.scale(scaleX, scaleY);
    }

    if (state === 'loading') {
      drawStatusMessage(
        ctx,
        w,
        h,
        '正在读取微信好友排行...',
        '马上为你展示同玩好友的星级记录',
        '',
        'loading'
      );
      return;
    }

    if (state === 'error') {
      drawStatusMessage(
        ctx,
        w,
        h,
        '暂未获取到好友排行',
        '请确认已开启微信好友关系链授权',
        '也可点击下方按钮邀请好友一起烤猫饼',
        'error'
      );
      return;
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      drawStatusMessage(
        ctx,
        w,
        h,
        '还没有微信好友上榜',
        '通关后星级与营业分会自动同步到好友榜',
        '点击下方按钮邀请好友加入星夜猫饼店吧',
        'empty'
      );
      return;
    }

    const rowH = 50;
    const gap = 6;
    const maxVisible = Math.min(rows.length, Math.max(1, Math.floor((h - 4) / (rowH + gap))));

    for (let i = 0; i < maxVisible; i++) {
      const r = rows[i];
      const ry = 2 + i * (rowH + gap);
      const isTop3 = i < 3;
      roundRect(ctx, 2, ry, w - 4, rowH, 11);
      ctx.fillStyle = i === 0 ? '#FFF3CC' : i === 1 ? '#F6F4EF' : i === 2 ? '#FAEADE' : '#FFFBF0';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = isTop3 ? '#D69A3B' : '#DEC8A4';
      ctx.stroke();

      // Rank badge
      const rx = 21;
      const rcy = ry + rowH * 0.5;
      ctx.beginPath();
      ctx.arc(rx, rcy, 12, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#F2B233' : i === 1 ? '#A6B0BD' : i === 2 ? '#CD844B' : '#8A5D3B';
      ctx.fill();
      ctx.fillStyle = '#FFFDF5';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), rx, rcy + 0.5);

      // Circular friend avatar
      const avCx = 54;
      const avCy = rcy;
      const avR = 16;
      const avatarImg = getFriendAvatar(r.avatarUrl, () => {
        if (lastRenderState === 'ready' && cachedRows && lastRenderOpts) {
          drawFriendsBoard(canvas, cachedRows, lastRenderOpts, 'ready');
        }
      });
      ctx.save();
      try {
        ctx.beginPath();
        ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
        ctx.fillStyle = '#FFF3DC';
        ctx.fill();
        if (avatarImg) {
          ctx.clip();
          ctx.drawImage(avatarImg, avCx - avR, avCy - avR, avR * 2, avR * 2);
        } else {
          const initial = String(r.nickName || '猫').slice(0, 1);
          ctx.fillStyle = '#8A5D3B';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(initial, avCx, avCy + 0.5);
        }
      } finally {
        ctx.restore();
      }
      ctx.beginPath();
      ctx.arc(avCx, avCy, avR, 0, Math.PI * 2);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#7A4E2D';
      ctx.stroke();

      // Nickname + stars subtitle
      const nameX = 78;
      const valColW = 78;
      const nameMaxW = Math.max(60, w - valColW - nameX - 10);
      const nick = String(r.nickName || '星夜好友').slice(0, 10);
      ctx.fillStyle = '#4E2B18';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(nick, nameX, ry + rowH * 0.34, nameMaxW);

      drawMiniStar(ctx, nameX + 6, ry + rowH * 0.70, 5.5);
      ctx.fillStyle = '#7A4E2D';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${r.totalStars}/90`, nameX + 16, ry + rowH * 0.71, nameMaxW - 16);

      // Right primary value
      const valText =
        safeOpts.metric === 'score'
          ? `${formatNum(r.totalScore)} 分`
          : `${formatNum(r.totalScore)}`;
      ctx.fillStyle = '#4E2B18';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(valText, w - 10, rcy + 0.5, valColW);
    }
  } finally {
    ctx.restore();
  }
}

function fetchAndRender(opts) {
  if (typeof wx === 'undefined' || !wx) return;
  const sharedCanvas = typeof wx.getSharedCanvas === 'function' ? wx.getSharedCanvas() : null;
  if (!sharedCanvas) return;

  const now = Date.now();
  const metric = opts && opts.metric === 'score' ? 'score' : 'stars';
  const mergedOpts = { ...(opts || {}), metric };
  lastRenderOpts = mergedOpts;

  const sortRows = (list) =>
    list.slice().sort((a, b) => {
      if (metric === 'score') {
        return b.totalScore - a.totalScore || b.totalStars - a.totalStars;
      }
      return b.totalStars - a.totalStars || b.totalScore - a.totalScore;
    });

  const renderRows = (list) => {
    const sorted = sortRows(list);
    lastRenderState = sorted.length > 0 ? 'ready' : 'empty';
    drawFriendsBoard(sharedCanvas, sorted, mergedOpts, lastRenderState);
  };

  if (cachedRows && now - lastFetchTs < FETCH_TTL_MS && !(opts && opts.forceRefresh)) {
    renderRows(cachedRows);
    return;
  }

  if (typeof wx.getFriendCloudStorage !== 'function') {
    lastRenderState = 'error';
    drawFriendsBoard(sharedCanvas, [], mergedOpts, 'error');
    return;
  }

  if (!cachedRows) {
    lastRenderState = 'loading';
    drawFriendsBoard(sharedCanvas, [], mergedOpts, 'loading');
  } else {
    renderRows(cachedRows);
  }

  wx.getFriendCloudStorage({
    keyList: STORAGE_KEYS,
    success(res) {
      const data = Array.isArray(res && res.data) ? res.data : [];
      cachedRows = data
        .map((u) => ({
          nickName: (u && (u.nickname || u.nickName)) || '星夜好友',
          avatarUrl: (u && u.avatarUrl) || '',
          totalStars: parseKvScore(u && u.KVDataList, 'totalStars'),
          totalScore: parseKvScore(u && u.KVDataList, 'totalScore')
        }))
        .filter((r) => r.totalStars > 0 || r.totalScore > 0);
      lastFetchTs = Date.now();
      renderRows(cachedRows);
    },
    fail() {
      if (cachedRows && cachedRows.length > 0) {
        renderRows(cachedRows);
      } else {
        lastRenderState = 'error';
        drawFriendsBoard(sharedCanvas, [], mergedOpts, 'error');
      }
    }
  });
}

if (typeof wx !== 'undefined' && wx && typeof wx.onMessage === 'function') {
  wx.onMessage((msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'render_friends') {
      fetchAndRender(msg);
    }
  });
}
