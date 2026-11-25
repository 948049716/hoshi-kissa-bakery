/**
 * 微信小游戏开放数据域（Open Data Context）好友排行榜渲染器（v0.13 M4）
 *
 * 轻量纯 Canvas 2D 绘制（零外部素材、纯十六进制与 rgba 色值、零原生彩色 Emoji），
 * 接收主域 postMessage({ type: 'render_friends', width, height, dpr, metric }) 后
 * 拉取 wx.getFriendCloudStorage(['totalStars', 'totalScore']) 并渲染至 sharedCanvas。
 */
'use strict';

const STORAGE_KEYS = ['totalStars', 'totalScore'];

let cachedRows = null;
let lastFetchTs = 0;
const FETCH_TTL_MS = 30 * 1000;

function roundRect(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
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

function drawFriendsBoard(canvas, rows, opts) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.max(1, Math.min(3, Number(opts.dpr) || 2));
  const w = Math.max(200, Math.floor(Number(opts.width) || 300));
  const h = Math.max(160, Math.floor(Number(opts.height) || 320));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.save();
  try {
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (!Array.isArray(rows) || rows.length === 0) {
      ctx.fillStyle = '#7A4E2D';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无微信好友上榜记录', w * 0.5, h * 0.44);
      ctx.fillStyle = '#9C724D';
      ctx.font = '600 11px sans-serif';
      ctx.fillText('通关后成绩将自动同步至好友榜', w * 0.5, h * 0.56);
      return;
    }

    const rowH = 44;
    const gap = 6;
    const maxVisible = Math.min(rows.length, Math.max(1, Math.floor((h - 8) / (rowH + gap))));

    for (let i = 0; i < maxVisible; i++) {
      const r = rows[i];
      const ry = 4 + i * (rowH + gap);
      const isTop3 = i < 3;
      roundRect(ctx, 2, ry, w - 4, rowH, 10);
      ctx.fillStyle = i === 0 ? '#FFF3CC' : i === 1 ? '#F6F4EF' : i === 2 ? '#FAEADE' : '#FFFBF0';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = isTop3 ? '#D69A3B' : '#DEC8A4';
      ctx.stroke();

      // Rank badge
      const rx = 20;
      const rcy = ry + rowH * 0.5;
      ctx.beginPath();
      ctx.arc(rx, rcy, 12, 0, Math.PI * 2);
      ctx.fillStyle = i === 0 ? '#F2B233' : i === 1 ? '#A6B0BD' : i === 2 ? '#CD844B' : '#8A5D3B';
      ctx.fill();
      ctx.fillStyle = '#FFFDF5';
      ctx.font = '800 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), rx, rcy + 0.5);

      // Nickname
      const nick = String(r.nickName || '星夜好友').slice(0, 10);
      ctx.fillStyle = '#4A2B18';
      ctx.font = '700 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(nick, 40, rcy - 1);

      // Score right
      const valText =
        opts.metric === 'score'
          ? `${r.totalScore} 分`
          : `${r.totalStars} 星`;
      ctx.fillStyle = '#B8621B';
      ctx.font = '800 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(valText, w - 12, rcy);
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
  const sortAndDraw = (list) => {
    const sorted = list.slice().sort((a, b) => {
      if (metric === 'score') {
        return (b.totalScore - a.totalScore) || (b.totalStars - a.totalStars);
      }
      return (b.totalStars - a.totalStars) || (b.totalScore - a.totalScore);
    });
    drawFriendsBoard(sharedCanvas, sorted, { ...opts, metric });
  };

  if (cachedRows && now - lastFetchTs < FETCH_TTL_MS && !(opts && opts.forceRefresh)) {
    sortAndDraw(cachedRows);
    return;
  }

  if (typeof wx.getFriendCloudStorage !== 'function') {
    drawFriendsBoard(sharedCanvas, [], { ...opts, metric });
    return;
  }

  wx.getFriendCloudStorage({
    keyList: STORAGE_KEYS,
    success(res) {
      const data = Array.isArray(res && res.data) ? res.data : [];
      cachedRows = data
        .map((u) => ({
          nickName: (u && u.nickname) || '星夜好友',
          avatarUrl: (u && u.avatarUrl) || '',
          totalStars: parseKvScore(u && u.KVDataList, 'totalStars'),
          totalScore: parseKvScore(u && u.KVDataList, 'totalScore')
        }))
        .filter((r) => r.totalStars > 0 || r.totalScore > 0);
      lastFetchTs = Date.now();
      sortAndDraw(cachedRows);
    },
    fail() {
      drawFriendsBoard(sharedCanvas, cachedRows || [], { ...opts, metric });
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
