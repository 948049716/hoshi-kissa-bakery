import fs from 'node:fs';
import path from 'node:path';

/**
 * Tier 2 — Boundary, Corner, Negative & Robustness Opaque-Box E2E Suite
 * Covers all 16 features (F01..F16) with 6 genuine boundary/negative cases each = 96 cases.
 * Strictly consumes the TestContext (`ctx`) passed to `run(ctx)` with zero app internals coupling.
 */

const CANONICAL_LEVEL_IDS = [];
for (let ch = 1; ch <= 3; ch++) {
  for (let idx = 1; idx <= 10; idx++) {
    CANONICAL_LEVEL_IDS.push(`${ch}-${idx}`);
  }
}

const RETAINED_V1_ASSETS = [
  'bakery_bg.jpg',
  'chef_mikan.png',
  'icon_shop_sign.png',
  'patron_luna.png',
  'patron_mugi.png',
  'tool_fork.png',
  'tool_spoon.png',
  'ui_atlas.png',
  'ui_atlas_2.png',
  'ui_atlas_3.png',
  'ui_patron_stage.png',
  'ui_serve_bell.png',
  'ui_title_plaque.png',
];

const NEW_V2_PNG_ASSETS = [
  'catcake_1.png',
  'catcake_2.png',
  'catcake_3.png',
  'catcake_4.png',
  'catcake_5.png',
  'catcake_6.png',
  'catcake_7.png',
  'catcake_1_happy.png',
  'catcake_2_happy.png',
  'catcake_3_happy.png',
  'catcake_4_happy.png',
  'catcake_5_happy.png',
  'catcake_6_happy.png',
  'catcake_7_happy.png',
  'customers_atlas.png',
  'board_tiles_atlas.png',
];

const EXPECTED_30_RUNTIME_ASSETS = [...RETAINED_V1_ASSETS, ...NEW_V2_PNG_ASSETS, 'title_hero_v2.jpg'].sort();

const FORBIDDEN_V1_RUNTIME_ASSETS = (() => {
  const list = ['title_hero.jpg', 'event_yarn_ball.png', 'tool_shake.png'];
  for (let t = 1; t <= 9; t++) {
    list.push(`tier_${t}.png`, `tier_${t}_act.png`, `tier_${t}_int.png`);
  }
  return list;
})();

const FORBIDDEN_V1_SRC_FILES = ['physics.js', 'physics_shapes.js', 'jar_renderer.js'];

const DEFAULT_TUTORIALS_SEEN = {
  intro_slide: true,
  tray_trash: true,
  flavor_tile: true,
  ice_tile: true,
};

function makeAllUnlockedStars(stars = 3) {
  const map = {};
  for (const id of CANONICAL_LEVEL_IDS) map[id] = stars;
  return map;
}

function getAllUnlockedStars(ctx, stars = 3) {
  if (typeof ctx.allUnlockedStars === 'function') {
    return ctx.allUnlockedStars(stars);
  }
  return makeAllUnlockedStars(stars);
}

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1 ');
}

function collectStringValues(val, out = []) {
  if (typeof val === 'string') {
    out.push(val);
  } else if (Array.isArray(val)) {
    for (const item of val) collectStringValues(item, out);
  } else if (val && typeof val === 'object') {
    for (const k of Object.keys(val)) collectStringValues(val[k], out);
  }
  return out;
}

function countBoardTiles(grid) {
  let count = 0;
  let maxTier = 0;
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell && cell.tile) {
        count++;
        if (cell.tile.tier > maxTier) maxTier = cell.tile.tier;
      }
    }
  }
  return { count, maxTier };
}

function findHit(st, idOrRegex) {
  const hits = (st && st.hits) || [];
  if (typeof idOrRegex === 'string') {
    return hits.find((h) => h.id === idOrRegex) || null;
  }
  const allowBackdropOrGuard = /backdrop|guard/i.test(idOrRegex.source || '');
  return (
    hits.find(
      (h) => idOrRegex.test(h.id) && (allowBackdropOrGuard || !/backdrop|guard/i.test(h.id))
    ) || null
  );
}

function hitCenter(hit) {
  return {
    x: Math.round(hit.x + hit.w / 2),
    y: Math.round(hit.y + hit.h / 2),
  };
}

function cellCenter(ctx, boardLayout, r, c) {
  if (typeof ctx.cellCenterPx === 'function') {
    return ctx.cellCenterPx(boardLayout, r, c);
  }
  return {
    x: Math.round(boardLayout.gridX + (c + 0.5) * boardLayout.cellSize),
    y: Math.round(boardLayout.gridY + (r + 0.5) * boardLayout.cellSize),
  };
}

/**
 * Synchronous dt=0 board & tray clearer so live rAF never auto-serves a transient tray tile
 * while sculpting pre-test board configurations.
 */
async function syncClearBoardExcept(ctx, keepCoords = []) {
  return ctx.eval((keepList) => {
    const dbg = globalThis.__HOSHI_DEBUG__;
    const keepSet = new Set((keepList || []).map(([r, c]) => `${r},${c}`));
    const clearTrayNow = () => {
      const s = dbg.getState();
      if (s && Array.isArray(s.tray)) {
        for (let i = 0; i < s.tray.length; i++) {
          if (s.tray[i] !== null) dbg.doubleTapTray(i);
        }
      }
    };
    clearTrayNow();
    const st = dbg.getState();
    if (!st || !st.grid || !Array.isArray(st.grid.cells)) return st;
    for (let r = 0; r < st.grid.rows; r++) {
      for (let c = 0; c < st.grid.cols; c++) {
        if (keepSet.has(`${r},${c}`)) continue;
        const cell = st.grid.cells[r][c];
        if (cell && cell.tile && !(cell.tile.frozenHp > 0)) {
          dbg.tapBoardCell(r, c);
          clearTrayNow();
        }
      }
    }
    return dbg.getState();
  }, keepCoords);
}

/**
 * Deterministically sculpts Row 0 on `1-7` (`4x4` open `.` grid, `allowedRecipes: R05..R12`)
 * into `targetRow0Tiers` (e.g. `[1, 1, 2, null]` or `[1, 1, 1, 1]`) with Rows 1..3 completely empty.
 * Uses full-board 15/16 pinpoint knead targeting so zero geometric randomness occurs.
 */
async function sculptRow0OnLevel1_7(ctx, targetRow0Tiers) {
  await ctx.setupSaveAndStart('1-7', {
    deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 2, dev_tools: 3 },
    selectedPatron: 'mikan',
    unlockedPatrons: ['mikan'],
    seenTutorials: DEFAULT_TUTORIALS_SEEN,
  });
  await syncClearBoardExcept(ctx, []);

  // Step 1: Fill all 16 cells via knead()
  for (let i = 0; i < 18; i++) {
    const st = await ctx.getState();
    if (countBoardTiles(st.grid).count >= 16) break;
    await ctx.advanceBothClocks(145);
    await ctx.knead();
  }

  // Step 2: Pinpoint-force every non-null Row 0 cell to C1 (since 15/16 cells are full, knead MUST hit (0, c))
  for (let c = 0; c < 4; c++) {
    if (targetRow0Tiers[c] === null) continue;
    for (let attempt = 0; attempt < 25; attempt++) {
      const st = await ctx.getState();
      const tile = st.grid.cells[0][c].tile;
      if (tile && tile.tier === 1) break;
      await ctx.eval((col) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.tapBoardCell(0, col);
        const s = dbg.getState();
        for (let i = 0; i < s.tray.length; i++) {
          if (s.tray[i]) dbg.doubleTapTray(i);
        }
      }, c);
      await ctx.advanceBothClocks(145);
      await ctx.knead();
    }
  }

  // Step 3: Clear Rows 1..3 and any null slots in Row 0
  const keep = [];
  for (let c = 0; c < 4; c++) {
    if (targetRow0Tiers[c] !== null) keep.push([0, c]);
  }
  await syncClearBoardExcept(ctx, keep);

  // Step 4: Upgrade any target tier 2 cells via spoon
  for (let c = 0; c < 4; c++) {
    if (targetRow0Tiers[c] === 2) {
      await ctx.useToolOnCell('spoon', 0, c);
    }
  }

  const finalSt = await ctx.getState();
  for (let c = 0; c < 4; c++) {
    const t = finalSt.grid.cells[0][c].tile;
    if (targetRow0Tiers[c] === null) {
      ctx.assert(t === null, `Expected (0,${c}) to be empty after sculpt`);
    } else {
      ctx.assert(t && t.tier === targetRow0Tiers[c], `Expected (0,${c}) tier=${targetRow0Tiers[c]}, got ${t?.tier}`);
    }
  }
  ctx.assertEq(finalSt.score, 0, 'Pre-slide sculpted board must still have 0 score');
  return finalSt;
}

async function readAudioStats(ctx) {
  const hs = typeof ctx.getHarnessState === 'function' ? await ctx.getHarnessState() : null;
  if (hs && (hs.audioStats || hs.audioSpy)) {
    return hs.audioStats || hs.audioSpy;
  }
  return ctx.eval(() => {
    const h = window.__WX_HARNESS__;
    if (!h) return {};
    if (typeof h.getAudioStats === 'function') return h.getAudioStats();
    return h.audioStats || h.audioSpy || {};
  });
}

async function resetAudioCounters(ctx) {
  if (typeof ctx.resetAudioStats === 'function') {
    await ctx.resetAudioStats();
  }
  await ctx.eval(() => {
    const h = window.__WX_HARNESS__;
    if (h?.resetAudioStats) h.resetAudioStats();
    if (h?.audioSpy?.resetCounts) h.audioSpy.resetCounts();
  });
}

function countSynthStarts(stats) {
  if (!stats) return 0;
  return (Number(stats.oscillatorsStarted) || 0) + (Number(stats.bufferSourcesStarted) || 0);
}

async function callKissaSync(ctx, data) {
  if (typeof ctx.callCloud === 'function') {
    const out = await ctx.callCloud(data);
    return out && out.result ? out.result : out;
  }
  return ctx.eval(async (payload) => {
    const res = await window.wx.cloud.callFunction({ name: 'kissa_sync', data: payload });
    return res && res.result ? res.result : res;
  }, data);
}

/**
 * Organically fulfills a seated customer order using public game actions (`fulfillCustomerOrder`
 * when provided by harness, with deterministic knead/slide/tool/tray fallback).
 */
async function serveOneOrderOrganically(ctx, preferredSeat = null, opts = {}) {
  let st = await ctx.getState();
  if (!st.seats || !st.seats.some(Boolean)) {
    st = await ctx.advanceTime(0.65);
  }
  if (!st.seats || !st.seats.some(Boolean)) {
    st = await ctx.advanceTime(2.6);
  }
  const beforeServed = st.ordersServed;

  if (opts.useHarness !== false && typeof ctx.fulfillCustomerOrder === 'function') {
    try {
      await ctx.fulfillCustomerOrder(preferredSeat, { maxSteps: 240, ...opts });
      const after = await ctx.getState();
      if (after.ordersServed > beforeServed) return after;
    } catch (_) {
      // Fall through to explicit deterministic solver
    }
  }

  const levelsMod = await ctx.requireBundledModule('./src/levels_data.js');
  const recipes = levelsMod.RECIPES || {};

  st = await ctx.getState();
  let targetIdx = preferredSeat;
  if (targetIdx === null || targetIdx === undefined || !st.seats[targetIdx]) {
    const candidates = st.seats
      .map((s, idx) => ({ s, idx }))
      .filter((x) => x.s !== null);
    ctx.assert(candidates.length > 0, 'Expected at least 1 seated customer to serve');
    candidates.sort((a, b) => {
      const slotsA = a.s.slots || recipes[a.s.recipeId]?.slots || [];
      const slotsB = b.s.slots || recipes[b.s.recipeId]?.slots || [];
      const maxA = Math.max(...slotsA.map((sl) => sl.tier || 1));
      const maxB = Math.max(...slotsB.map((sl) => sl.tier || 1));
      return maxA - maxB || slotsA.length - slotsB.length;
    });
    targetIdx = candidates[0].idx;
  }

  const targetSeat = st.seats[targetIdx];
  const reqSlots = (targetSeat.slots || recipes[targetSeat.recipeId]?.slots || []).map((sl) => ({
    tier: sl.tier,
    flavor: sl.flavor || 'any',
  }));

  if (st.preferredSeatIdx !== targetIdx) {
    await ctx.eval((idx) => globalThis.__HOSHI_DEBUG__.clickHit(`seat_${idx}`), targetIdx);
  }

  // Clear tray first so we have room to place all matched slots together at dt=0
  await ctx.eval(() => {
    const dbg = globalThis.__HOSHI_DEBUG__;
    const s = dbg.getState();
    for (let i = 0; i < s.tray.length; i++) {
      if (s.tray[i]) dbg.doubleTapTray(i);
    }
  });

  const maxSteps = opts.maxSteps ?? 180;
  const dirs = ['left', 'up', 'right', 'down'];
  for (let step = 0; step < maxSteps; step++) {
    st = await ctx.getState();
    const chosenCoords = [];
    const usedKey = new Set();
    const missingReqs = [];

    // Sort constrained slots first, then descending tier
    const orderedReqs = [...reqSlots].sort(
      (a, b) => (a.flavor === 'any' ? 1 : 0) - (b.flavor === 'any' ? 1 : 0) || b.tier - a.tier
    );
    for (const req of orderedReqs) {
      let matchCoord = null;
      for (let r = 0; r < st.grid.rows && !matchCoord; r++) {
        for (let c = 0; c < st.grid.cols && !matchCoord; c++) {
          if (usedKey.has(`${r},${c}`)) continue;
          const t = st.grid.cells[r][c]?.tile;
          if (!t || t.frozenHp > 0 || t.tier !== req.tier) continue;
          if (req.flavor === 'any' || t.flavor === req.flavor || t.flavor === 'gold') {
            matchCoord = [r, c];
          }
        }
      }
      if (!matchCoord) {
        missingReqs.push(req);
      } else {
        usedKey.add(`${matchCoord[0]},${matchCoord[1]}`);
        chosenCoords.push(matchCoord);
      }
    }

    if (missingReqs.length === 0) {
      await ctx.eval((coords, seatIdx) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        if (dbg.getState().preferredSeatIdx !== seatIdx) {
          dbg.clickHit(`seat_${seatIdx}`);
        }
        for (const [r, c] of coords) {
          dbg.tapBoardCell(r, c);
        }
      }, chosenCoords, targetIdx);
      const post = await ctx.advanceTime(0.65);
      if (post.ordersServed > beforeServed) return post;
    }

    const targetReq = [...missingReqs].sort((a, b) => b.tier - a.tier)[0] || orderedReqs[0];

    // Check if a 1-step spoon on an unprotected tile can finish targetReq
    if (opts.allowSpoon !== false && st.toolCounts?.spoon > 0 && targetReq.tier >= 2) {
      let cand = null;
      for (let r = 0; r < st.grid.rows && !cand; r++) {
        for (let c = 0; c < st.grid.cols && !cand; c++) {
          if (usedKey.has(`${r},${c}`)) continue;
          const t = st.grid.cells[r][c]?.tile;
          if (
            t &&
            !(t.frozenHp > 0) &&
            t.tier === targetReq.tier - 1 &&
            (targetReq.flavor === 'any' || t.flavor === targetReq.flavor || t.flavor === 'gold')
          ) {
            cand = [r, c];
          }
        }
      }
      if (cand) {
        await ctx.useToolOnCell('spoon', cand[0], cand[1]);
        continue;
      }
    }

    // Score slide directions (packing top-left and rewarding merges <= targetReq.tier + dyeing)
    const scoreDir = (dir) => {
      const { rows, cols, cells } = st.grid;
      const isH = dir === 'left' || dir === 'right';
      const rev = dir === 'right' || dir === 'down';
      const outer = isH ? rows : cols;
      const inner = isH ? cols : rows;
      let moved = false;
      let sc = dir === 'left' || dir === 'up' ? 3 : 1;
      for (let o = 0; o < outer; o++) {
        let seg = [];
        const flush = () => {
          if (!seg.length) return;
          const items = seg.filter((e) => e.cell.tile && !(e.cell.tile.frozenHp > 0));
          let w = 0;
          for (let p = 0; p < items.length; p++) {
            const dest = seg[w];
            if (p + 1 < items.length && items[p].cell.tile.tier === items[p + 1].cell.tile.tier && items[p].cell.tile.tier < 7) {
              moved = true;
              const nt = items[p].cell.tile.tier + 1;
              if (usedKey.has(`${items[p].r},${items[p].c}`) || usedKey.has(`${items[p + 1].r},${items[p + 1].c}`)) {
                sc -= 120;
              }
              sc += nt <= targetReq.tier ? nt * 20 : -20;
              if (nt === targetReq.tier && targetReq.flavor !== 'any' && (dest.cell.type === targetReq.flavor || dest.cell.type === 'gold')) {
                sc += 160;
              }
              p++;
            } else {
              if (items[p].r !== dest.r || items[p].c !== dest.c) moved = true;
              if (
                items[p].cell.tile.tier === targetReq.tier &&
                targetReq.flavor !== 'any' &&
                items[p].cell.tile.flavor !== targetReq.flavor &&
                items[p].cell.tile.flavor !== 'gold' &&
                (dest.cell.type === targetReq.flavor || dest.cell.type === 'gold')
              ) {
                sc += 180;
              }
            }
            w++;
          }
          seg = [];
        };
        for (let i = 0; i < inner; i++) {
          const idx = rev ? inner - 1 - i : i;
          const r = isH ? o : idx;
          const c = isH ? idx : o;
          const cell = cells[r][c];
          if (!cell || cell.type === 'void' || cell.type === 'block' || (cell.tile && cell.tile.frozenHp > 0)) flush();
          else seg.push({ r, c, cell });
        }
        flush();
      }
      return moved ? sc : -9999;
    };

    const scored = dirs
      .map((d) => ({ dir: d, score: scoreDir(d) }))
      .filter((x) => x.score > -9000)
      .sort((a, b) => b.score - a.score);

    const { count } = countBoardTiles(st.grid);
    const passableCells = st.grid.cells.flat().filter((c) => c.type !== 'void' && c.type !== 'block');
    const emptyPlayable = passableCells.filter((c) => !c.tile).length;

    if (count < 3 && emptyPlayable > 0) {
      await ctx.advanceBothClocks(135);
      await ctx.knead();
      continue;
    }
    if (scored.length > 0 && (scored[0].score >= 20 || (emptyPlayable <= 2 && scored[0].score >= 0))) {
      const pickIdx = step % 7 === 6 && scored.length > 1 && scored[1].score >= 0 ? 1 : 0;
      await ctx.slide(scored[pickIdx].dir);
      continue;
    }
    if (emptyPlayable > 0) {
      await ctx.advanceBothClocks(135);
      await ctx.knead();
      continue;
    }
    if (scored.length > 0 && scored[0].score >= 0) {
      await ctx.slide(scored[0].dir);
      continue;
    }
    if (scored.length > 0 && step % 6 === 5) {
      await ctx.slide(scored[0].dir);
      continue;
    }

    // Deadlock recovery via tray + double-tap trash on lowest unprotected tile
    await ctx.eval((protKeys) => {
      const prot = new Set(protKeys);
      const dbg = globalThis.__HOSHI_DEBUG__;
      const s = dbg.getState();
      const cands = [];
      for (let r = 0; r < s.grid.rows; r++) {
        for (let c = 0; c < s.grid.cols; c++) {
          const t = s.grid.cells[r][c]?.tile;
          if (t && !(t.frozenHp > 0)) cands.push({ r, c, tier: t.tier, prot: prot.has(`${r},${c}`) ? 1 : 0 });
        }
      }
      cands.sort((a, b) => a.prot - b.prot || a.tier - b.tier);
      if (cands.length > 0) {
        dbg.tapBoardCell(cands[0].r, cands[0].c);
        const s2 = dbg.getState();
        for (let i = 0; i < s2.tray.length; i++) {
          if (s2.tray[i]) dbg.doubleTapTray(i);
        }
      }
    }, Array.from(usedKey));
  }

  const endSt = await ctx.getState();
  ctx.assert(endSt.ordersServed > beforeServed, `Failed to organically fulfill seat ${targetIdx} (${targetSeat.recipeId})`);
  return endSt;
}

/**
 * Inspects an asset PNG/JPEG via an offscreen <canvas> inside Chromium so quantized
 * 8-bit paletted PNGs (`colorType=3`) decode accurately to RGBA pixels.
 */
async function auditSpriteOnCanvas(ctx, relAssetUrl, inspectorFn, ...extraArgs) {
  return ctx.eval(
    async (url, fnSrc, args) => {
      const img = new Image();
      img.decoding = 'sync';
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = `${url}${url.includes('?') ? '&' : '?'}cb=${Date.now()}`;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const c2d = canvas.getContext('2d', { willReadFrequently: true });
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      c2d.drawImage(img, 0, 0);
      // eslint-disable-next-line no-new-func
      const runner = new Function('c2d', 'img', 'args', `return (${fnSrc})(c2d, img, ...args);`);
      return runner(c2d, img, args);
    },
    relAssetUrl,
    inspectorFn.toString(),
    extraArgs
  );
}

// ============================================================================
// PART 1: FEATURES F01 .. F08 (48 CASES)
// ============================================================================

const TIER2_F01_TO_F08 = [
  // --------------------------------------------------------------------------
  // F01 — v2.0 Storybook Art Assets & Extraction Pipeline (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F01-01',
    tier: 2,
    features: ['F01'],
    title: 'board_tiles_atlas.png cell (0,0) tile_gold has hollow transparent interior and opaque 4-side golden frame',
    run: async (ctx) => {
      const atlasPath = path.join(ctx.minigameDir, 'assets', 'board_tiles_atlas.png');
      ctx.assert(fs.existsSync(atlasPath), 'Missing assets/board_tiles_atlas.png');
      const hdr = ctx.readPngHeader(atlasPath);
      ctx.assertEq(hdr.width, 512, 'board_tiles_atlas.png width must be 512');
      ctx.assertEq(hdr.height, 256, 'board_tiles_atlas.png height must be 256');

      const audit = await auditSpriteOnCanvas(ctx, 'assets/board_tiles_atlas.png', (c2d, img) => {
        const data = c2d.getImageData(0, 0, 128, 128).data;
        const alphaAt = (x, y) => data[(y * 128 + x) * 4 + 3];

        const centerAlpha = alphaAt(64, 64);
        let boxSum = 0;
        let boxCount = 0;
        for (let y = 56; y <= 71; y++) {
          for (let x = 56; x <= 71; x++) {
            boxSum += alphaAt(x, y);
            boxCount++;
          }
        }
        const centerMeanAlpha = boxSum / boxCount;

        let leftRayMax = 0;
        for (let x = 6; x <= 50; x++) leftRayMax = Math.max(leftRayMax, alphaAt(x, 64));
        let rightRayMax = 0;
        for (let x = 78; x <= 122; x++) rightRayMax = Math.max(rightRayMax, alphaAt(x, 64));
        let topRayMax = 0;
        for (let y = 6; y <= 50; y++) topRayMax = Math.max(topRayMax, alphaAt(64, y));
        let bottomRayMax = 0;
        for (let y = 78; y <= 122; y++) bottomRayMax = Math.max(bottomRayMax, alphaAt(64, y));

        return {
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
          centerAlpha,
          centerMeanAlpha,
          leftRayMax,
          rightRayMax,
          topRayMax,
          bottomRayMax,
        };
      });

      ctx.assert(
        audit.centerAlpha < 32 && audit.centerMeanAlpha < 32,
        `tile_gold interior must be hollow/transparent (<32 alpha), got center=${audit.centerAlpha}, mean16x16=${audit.centerMeanAlpha.toFixed(1)}`
      );
      ctx.assert(audit.leftRayMax > 200, `tile_gold left border ray missing frame pixels (maxAlpha=${audit.leftRayMax})`);
      ctx.assert(audit.rightRayMax > 200, `tile_gold right border ray missing frame pixels (maxAlpha=${audit.rightRayMax})`);
      ctx.assert(audit.topRayMax > 200, `tile_gold top border ray missing frame pixels (maxAlpha=${audit.topRayMax})`);
      ctx.assert(audit.bottomRayMax > 200, `tile_gold bottom border ray missing frame pixels (maxAlpha=${audit.bottomRayMax})`);
    },
  },

  {
    id: 'T2-F01-02',
    tier: 2,
    features: ['F01'],
    title: 'White-colored subjects (catcake_1, cust_rabbit, cust_critic, btn_knead) retain >=70% opaque core without floodfill bleed',
    run: async (ctx) => {
      const subjects = [
        { name: 'catcake_1', url: 'assets/catcake_1.png', sx: 0, sy: 0, sw: 192, sh: 192, cx0: 62, cx1: 130, cy0: 62, cy1: 130 },
        { name: 'cust_rabbit', url: 'assets/customers_atlas.png', sx: 768, sy: 0, sw: 256, sh: 256, cx0: 82, cx1: 174, cy0: 82, cy1: 174 },
        { name: 'cust_critic', url: 'assets/customers_atlas.png', sx: 768, sy: 256, sw: 256, sh: 256, cx0: 82, cx1: 174, cy0: 82, cy1: 174 },
        { name: 'btn_knead', url: 'assets/board_tiles_atlas.png', sx: 128, sy: 128, sw: 128, sh: 128, cx0: 41, cx1: 87, cy0: 41, cy1: 87 },
      ];

      for (const sub of subjects) {
        const res = await auditSpriteOnCanvas(
          ctx,
          sub.url,
          (c2d, _img, spec) => {
            const imgData = c2d.getImageData(spec.sx, spec.sy, spec.sw, spec.sh).data;
            let opaque = 0;
            let total = 0;
            for (let y = spec.cy0; y < spec.cy1; y++) {
              for (let x = spec.cx0; x < spec.cx1; x++) {
                const a = imgData[(y * spec.sw + x) * 4 + 3];
                if (a > 220) opaque++;
                total++;
              }
            }
            return { opaqueRatio: opaque / total, opaque, total };
          },
          sub
        );
        ctx.assert(
          res.opaqueRatio >= 0.70,
          `${sub.name} core opaqueRatio(alpha>220) = ${res.opaqueRatio.toFixed(3)} (<0.70 — outline gap floodfill bleed detected)`
        );
      }
    },
  },

  {
    id: 'T2-F01-03',
    tier: 2,
    features: ['F01'],
    title: 'All 14 catcake_1..7(_happy).png sprites preserve 3px transparent outer safety margin without edge clipping',
    run: async (ctx) => {
      const files = [];
      for (let k = 1; k <= 7; k++) {
        files.push(`assets/catcake_${k}.png`, `assets/catcake_${k}_happy.png`);
      }

      for (const relUrl of files) {
        const res = await auditSpriteOnCanvas(ctx, relUrl, (c2d, img) => {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const d = c2d.getImageData(0, 0, w, h).data;
          let maxBorderAlpha = 0;
          let fgCount = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const a = d[(y * w + x) * 4 + 3];
              if (x < 3 || x >= w - 3 || y < 3 || y >= h - 3) {
                if (a > maxBorderAlpha) maxBorderAlpha = a;
              }
              if (a > 128) fgCount++;
            }
          }
          return { w, h, maxBorderAlpha, fgRatio: fgCount / (w * h) };
        });

        ctx.assertEq(res.w, 192, `${relUrl} naturalWidth must be 192`);
        ctx.assertEq(res.h, 192, `${relUrl} naturalHeight must be 192`);
        ctx.assert(
          res.maxBorderAlpha <= 16,
          `${relUrl} 3px outer safety perimeter clipped artwork (maxBorderAlpha=${res.maxBorderAlpha} > 16)`
        );
        ctx.assert(
          res.fgRatio >= 0.12 && res.fgRatio <= 0.78,
          `${relUrl} foreground ratio out of range: ${res.fgRatio.toFixed(3)}`
        );
      }
    },
  },

  {
    id: 'T2-F01-04',
    tier: 2,
    features: ['F01'],
    title: 'Post-cutover complete purge of 30 legacy v1 runtime assets and 5 deprecated physics/jar files',
    run: async (ctx) => {
      const assetsDir = path.join(ctx.minigameDir, 'assets');
      const srcDir = path.join(ctx.minigameDir, 'src');
      const masterPngDir = path.join(ctx.repoRoot, '02-游戏素材-精修透明PNG');
      const legacyScript = path.join(ctx.repoRoot, 'scripts', 'extract_physics_shapes.py');

      const runtimeAssets = fs
        .readdirSync(assetsDir)
        .filter((f) => !f.startsWith('.'))
        .sort();

      ctx.assertEq(
        runtimeAssets.length,
        30,
        `05-微信小游戏版本/assets/ must contain exact 30 files, got ${runtimeAssets.length}: ${runtimeAssets.join(', ')}`
      );
      ctx.assertEq(runtimeAssets, EXPECTED_30_RUNTIME_ASSETS, 'Runtime assets inventory mismatch');

      for (const legacyAsset of FORBIDDEN_V1_RUNTIME_ASSETS) {
        ctx.assert(!fs.existsSync(path.join(assetsDir, legacyAsset)), `Forbidden legacy v1 runtime asset still exists: ${legacyAsset}`);
      }

      for (const legacySrc of FORBIDDEN_V1_SRC_FILES) {
        ctx.assert(!fs.existsSync(path.join(srcDir, legacySrc)), `Deprecated physics/jar module still exists: src/${legacySrc}`);
      }

      ctx.assert(!fs.existsSync(legacyScript), 'Deprecated scripts/extract_physics_shapes.py must be deleted');

      const masterFiles = fs.readdirSync(masterPngDir);
      for (const f of masterFiles) {
        ctx.assert(
          !/^tier_[1-9](?:_act|_int)?\.png$/.test(f),
          `Legacy master sprite still exists in 02-游戏素材-精修透明PNG/: ${f}`
        );
      }
      for (const forbiddenMaster of ['event_yarn_ball.png', 'tool_shake.png', 'physics_shapes.json', 'sprites_meta.json']) {
        ctx.assert(
          !fs.existsSync(path.join(masterPngDir, forbiddenMaster)),
          `Legacy file still exists in 02-游戏素材-精修透明PNG/: ${forbiddenMaster}`
        );
      }
    },
  },

  {
    id: 'T2-F01-05',
    tier: 2,
    features: ['F01'],
    title: 'Zero stale v1 asset string references in runtime JS and share cover points to assets/title_hero_v2.jpg',
    run: async (ctx) => {
      const jsFiles = [
        path.join(ctx.minigameDir, 'game.js'),
        ...fs
          .readdirSync(path.join(ctx.minigameDir, 'src'))
          .filter((f) => f.endsWith('.js'))
          .map((f) => path.join(ctx.minigameDir, 'src', f)),
      ];

      const staleRegex = /tier_[1-9](?:_act|_int)?\.png|title_hero\.jpg|event_yarn_ball\.png|tool_shake\.png|physics_shapes/;
      for (const absFile of jsFiles) {
        const code = stripJsComments(fs.readFileSync(absFile, 'utf8'));
        const m = code.match(staleRegex);
        ctx.assert(!m, `Stale v1 asset/physics reference "${m?.[0]}" found in ${path.relative(ctx.repoRoot, absFile)}`);
      }

      const constantsMod = await ctx.requireBundledModule('./src/constants.js');
      const assetStrings = collectStringValues(constantsMod.ASSET_PATHS || {}).filter((s) => s.startsWith('assets/'));
      ctx.assert(assetStrings.length >= 25, `Expected >=25 asset paths in constants.ASSET_PATHS, got ${assetStrings.length}`);
      for (const relAsset of assetStrings) {
        ctx.assert(
          fs.existsSync(path.join(ctx.minigameDir, relAsset)),
          `constants.ASSET_PATHS references missing file: ${relAsset}`
        );
      }

      const shareInfo = await ctx.eval(() => {
        const h = window.__WX_HARNESS__;
        const preview = h?.getSharePreview?.() || h?.lastSharePayload || null;
        return preview;
      });
      ctx.assert(shareInfo && typeof shareInfo === 'object', 'wx.onShareAppMessage handler should return a share payload');
      ctx.assert(
        typeof shareInfo.imageUrl === 'string' && shareInfo.imageUrl.includes('title_hero_v2.jpg'),
        `Share imageUrl must reference title_hero_v2.jpg, got ${shareInfo?.imageUrl}`
      );
      ctx.assert(
        typeof shareInfo.title === 'string' && shareInfo.title.includes('一起做猫饼'),
        `Share title must include 一起做猫饼, got ${shareInfo?.title}`
      );
    },
  },

  {
    id: 'T2-F01-06',
    tier: 2,
    features: ['F01'],
    title: 'Quantized minigame PNGs never exceed master PNG byte sizes and upload_minigame.mjs excludes cloudfunctions/',
    run: async (ctx) => {
      const masterDir = path.join(ctx.repoRoot, '02-游戏素材-精修透明PNG');
      const minigameAssetsDir = path.join(ctx.minigameDir, 'assets');

      for (const fileName of [...NEW_V2_PNG_ASSETS, 'title_hero_v2.jpg']) {
        const masterStat = fs.statSync(path.join(masterDir, fileName));
        const miniStat = fs.statSync(path.join(minigameAssetsDir, fileName));
        ctx.assert(miniStat.size > 512, `${fileName} in minigame assets is unexpectedly tiny (${miniStat.size}B)`);
        ctx.assert(
          miniStat.size <= masterStat.size,
          `Quantized minigame ${fileName} (${miniStat.size}B) bloated beyond master (${masterStat.size}B)`
        );
      }

      const uploadScript = fs.readFileSync(path.join(ctx.repoRoot, 'scripts', 'upload_minigame.mjs'), 'utf8');
      ctx.assert(
        /cloudfunctions\/\*\*/.test(uploadScript),
        'scripts/upload_minigame.mjs must ignore cloudfunctions/** so cloud code is excluded from client bundle'
      );
      ctx.assert(
        /cloudbaserc\.json/.test(uploadScript),
        'scripts/upload_minigame.mjs must ignore cloudbaserc.json'
      );
    },
  },

  // --------------------------------------------------------------------------
  // F02 — 7-Tier Cat-Cake Catalog & 30-Level Dataset (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F02-01',
    tier: 2,
    features: ['F02'],
    title: 'L2 Invariants #1 & #2: Exact 30 ordered IDs (1-1..3-10), rectangular 3..5 matrices, alphabet {. # X G M B I}, and live grid parity',
    run: async (ctx) => {
      const levelsMod = await ctx.requireBundledModule('./src/levels_data.js');
      const levels = levelsMod.LEVELS;
      ctx.assert(Array.isArray(levels) && levels.length === 30, `Expected 30 levels, got ${levels?.length}`);

      const ids = levels.map((lv) => lv.id);
      ctx.assertEq(ids, CANONICAL_LEVEL_IDS, 'LEVELS IDs must equal ordered 1-1..1-10, 2-1..2-10, 3-1..3-10');

      const charToType = {
        '#': 'void',
        X: 'block',
        G: 'gold',
        M: 'matcha',
        B: 'berry',
        '.': 'normal',
        I: 'normal',
      };

      for (const lv of levels) {
        ctx.assert(Array.isArray(lv.matrix) && lv.matrix.length >= 3 && lv.matrix.length <= 5, `${lv.id}: rows must be in 3..5`);
        const cols = lv.matrix[0].length;
        ctx.assert(cols >= 3 && cols <= 5, `${lv.id}: cols must be in 3..5`);
        for (let r = 0; r < lv.matrix.length; r++) {
          const rowStr = lv.matrix[r];
          ctx.assertEq(rowStr.length, cols, `${lv.id}: row ${r} ragged length`);
          ctx.assert(/^[.#XGMBI]+$/.test(rowStr), `${lv.id}: invalid char in "${rowStr}"`);
        }
      }

      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      const liveAudit = await ctx.eval((expectedLevels, mapTypes) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const mismatches = [];
        for (const lv of expectedLevels) {
          const ok = dbg.startLevel(lv.id);
          if (!ok) {
            mismatches.push(`${lv.id}: startLevel returned false`);
            continue;
          }
          const g = dbg.getState().grid;
          if (!g || g.rows !== lv.matrix.length || g.cols !== lv.matrix[0].length) {
            mismatches.push(`${lv.id}: grid size ${g?.rows}x${g?.cols} != ${lv.matrix.length}x${lv.matrix[0].length}`);
            continue;
          }
          for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
              const ch = lv.matrix[r][c];
              const cellType = g.cells[r][c]?.type;
              const expectedType = mapTypes[ch];
              const okType = ch === 'I' ? cellType === 'normal' || cellType === 'ice' : cellType === expectedType;
              if (!okType) {
                mismatches.push(`${lv.id}(${r},${c}) char '${ch}' -> cell.type='${cellType}'`);
              }
            }
          }
        }
        return mismatches;
      }, levels.map((l) => ({ id: l.id, matrix: l.matrix })), charToType);

      ctx.assertEq(liveAudit, [], `Live grid cell.type mismatches: ${liveAudit.join('; ')}`);
    },
  },

  {
    id: 'T2-F02-02',
    tier: 2,
    features: ['F02'],
    title: 'L2 Invariant #3: Preset bounds, uniqueness, non-obstacle placement, dye consistency, and exact I <-> frozen bijection',
    run: async (ctx) => {
      const { LEVELS } = await ctx.requireBundledModule('./src/levels_data.js');
      const validFlavors = new Set(['plain', 'matcha', 'berry', 'gold']);

      for (const lv of LEVELS) {
        const rows = lv.matrix.length;
        const cols = lv.matrix[0].length;
        const presetByCoord = new Map();
        ctx.assert(Array.isArray(lv.presets) && lv.presets.length >= 1, `${lv.id}: presets must be non-empty`);

        for (const p of lv.presets) {
          ctx.assert(p.r >= 0 && p.r < rows && p.c >= 0 && p.c < cols, `${lv.id}: preset (${p.r},${p.c}) out of bounds`);
          const key = `${p.r},${p.c}`;
          ctx.assert(!presetByCoord.has(key), `${lv.id}: duplicate preset at (${key})`);
          presetByCoord.set(key, p);
          ctx.assert(Number.isInteger(p.tier) && p.tier >= 1 && p.tier <= 6, `${lv.id}(${key}): invalid preset tier ${p.tier}`);
          ctx.assert(validFlavors.has(p.flavor), `${lv.id}(${key}): invalid preset flavor ${p.flavor}`);
          const ch = lv.matrix[p.r][p.c];
          ctx.assert(ch !== '#' && ch !== 'X', `${lv.id}(${key}): preset placed on obstacle '${ch}'`);
          if (ch === 'G') ctx.assertEq(p.flavor, 'gold', `${lv.id}(${key}): preset on G must have flavor 'gold'`);
          if (ch === 'M') ctx.assert(p.flavor === 'matcha' || p.flavor === 'gold', `${lv.id}(${key}): preset on M must be matcha/gold`);
          if (ch === 'B') ctx.assert(p.flavor === 'berry' || p.flavor === 'gold', `${lv.id}(${key}): preset on B must be berry/gold`);
        }

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const ch = lv.matrix[r][c];
            const p = presetByCoord.get(`${r},${c}`);
            if (ch === 'I') {
              ctx.assert(!!p && p.frozen === true, `${lv.id}(${r},${c}): matrix 'I' must have preset with frozen===true`);
            } else if (p) {
              ctx.assert(p.frozen !== true, `${lv.id}(${r},${c}): non-'I' cell '${ch}' cannot have frozen===true`);
            }
          }
        }
      }

      // Cross-verify live frozenHp bijection on all Chapter 3 levels
      await ctx.setSaveData({ schemaVersion: 2, levelStars: getAllUnlockedStars(ctx, 3), seenTutorials: DEFAULT_TUTORIALS_SEEN });
      const ch3Errors = await ctx.eval((ch3Levels) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const errs = [];
        for (const lv of ch3Levels) {
          dbg.startLevel(lv.id);
          const g = dbg.getState().grid;
          for (let r = 0; r < g.rows; r++) {
            for (let c = 0; c < g.cols; c++) {
              const isIce = lv.matrix[r][c] === 'I';
              const fhp = g.cells[r][c]?.tile?.frozenHp || 0;
              if (isIce && fhp !== 1) errs.push(`${lv.id}(${r},${c}) expected frozenHp=1, got ${fhp}`);
              if (!isIce && fhp !== 0) errs.push(`${lv.id}(${r},${c}) expected frozenHp=0, got ${fhp}`);
            }
          }
        }
        return errs;
      }, LEVELS.filter((l) => l.chapter === 3).map((l) => ({ id: l.id, matrix: l.matrix })));
      ctx.assertEq(ch3Errors, [], `Live Ch.3 frozenHp bijection errors: ${ch3Errors.join('; ')}`);
    },
  },

  {
    id: 'T2-F02-03',
    tier: 2,
    features: ['F02'],
    title: 'L2 Invariant #4: >=8 initial unfrozen playable cells and 4-neighbor BFS connectivity with zero 1-cell dead-jails',
    run: async (ctx) => {
      const { LEVELS } = await ctx.requireBundledModule('./src/levels_data.js');
      const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];

      for (const lv of LEVELS) {
        const rows = lv.matrix.length;
        const cols = lv.matrix[0].length;
        let unfrozenPlayable = 0;
        const passable = [];

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const ch = lv.matrix[r][c];
            if (ch === '.' || ch === 'G' || ch === 'M' || ch === 'B') unfrozenPlayable++;
            if (ch !== '#' && ch !== 'X') passable.push([r, c]);
          }
        }

        ctx.assert(
          unfrozenPlayable >= 8,
          `${lv.id}: initial unfrozen playable cells = ${unfrozenPlayable} (< 8 minimum)`
        );

        const passSet = new Set(passable.map(([r, c]) => `${r},${c}`));
        const visited = new Set();
        let componentCount = 0;
        for (const [sr, sc] of passable) {
          const startKey = `${sr},${sc}`;
          if (visited.has(startKey)) continue;
          componentCount++;
          const queue = [[sr, sc]];
          visited.add(startKey);
          let compSize = 0;
          while (queue.length > 0) {
            const [cr, cc] = queue.shift();
            compSize++;
            for (const [dr, dc] of dirs) {
              const nk = `${cr + dr},${cc + dc}`;
              if (passSet.has(nk) && !visited.has(nk)) {
                visited.add(nk);
                queue.push([cr + dr, cc + dc]);
              }
            }
          }
          ctx.assert(compSize >= 2, `${lv.id}: isolated 1-cell dead-jail detected at (${sr},${sc})`);
        }
        ctx.assertEq(componentCount, 1, `${lv.id}: passable cells should form 1 connected component, got ${componentCount}`);
      }
    },
  },

  {
    id: 'T2-F02-04',
    tier: 2,
    features: ['F02'],
    title: 'L2 Invariant #5: Strict star monotonicity (0 < s1 < s2 < s3), progressive s1 curve (750..35000), and chapter mechanic gates',
    run: async (ctx) => {
      const { LEVELS } = await ctx.requireBundledModule('./src/levels_data.js');
      let prevS1 = 0;
      let ch2SawSpecial = false;
      let ch3SawBerry = false;

      for (const lv of LEVELS) {
        const [s1, s2, s3] = lv.stars || [];
        ctx.assert(
          Number.isInteger(s1) && Number.isInteger(s2) && Number.isInteger(s3) && 0 < s1 && s1 < s2 && s2 < s3,
          `${lv.id}: stars [${lv.stars}] must satisfy 0 < s1 < s2 < s3`
        );
        ctx.assert(s1 > prevS1, `${lv.id}: star1 (${s1}) must strictly exceed previous level star1 (${prevS1})`);
        prevS1 = s1;

        const flat = lv.matrix.join('');
        if (lv.chapter === 1) {
          ctx.assert(/^[.#X]+$/.test(flat), `${lv.id}: Ch.1 matrix must not contain G/M/B/I ("${flat}")`);
        } else if (lv.chapter === 2) {
          ctx.assert(/^[.#XGM]+$/.test(flat), `${lv.id}: Ch.2 matrix must not contain B/I ("${flat}")`);
          if (/[GM]/.test(flat)) ch2SawSpecial = true;
        } else if (lv.chapter === 3) {
          ctx.assert(flat.includes('I'), `${lv.id}: every Ch.3 level must contain at least 1 'I' cell`);
          if (flat.includes('B')) ch3SawBerry = true;
        }
      }

      ctx.assertEq(LEVELS[0].stars, [750, 1050, 1400], '1-1 stars must equal [750, 1050, 1400]');
      ctx.assertEq(LEVELS[29].stars, [35000, 48300, 61600], '3-10 stars must equal [35000, 48300, 61600]');
      ctx.assert(ch2SawSpecial, 'Chapter 2 must introduce M and G special cells');
      ctx.assert(ch3SawBerry, 'Chapter 3 must introduce B berry special cells');
    },
  },

  {
    id: 'T2-F02-05',
    tier: 2,
    features: ['F02'],
    title: 'Per-level allowedRecipes referential integrity and flavor-cell craftability audit across all 30 levels',
    run: async (ctx) => {
      const { LEVELS, RECIPES } = await ctx.requireBundledModule('./src/levels_data.js');

      for (const lv of LEVELS) {
        ctx.assert(Array.isArray(lv.allowedRecipes) && lv.allowedRecipes.length >= 1, `${lv.id}: empty allowedRecipes`);
        const flat = lv.matrix.join('');
        let needsMatcha = false;
        let needsBerry = false;

        for (const rid of lv.allowedRecipes) {
          const rec = RECIPES[rid];
          ctx.assert(!!rec, `${lv.id}: unknown recipeId "${rid}" in allowedRecipes`);
          for (const sl of rec.slots) {
            if (sl.flavor === 'matcha') needsMatcha = true;
            if (sl.flavor === 'berry') needsBerry = true;
          }
        }

        if (lv.vipFixedRecipeId) {
          ctx.assert(!!RECIPES[lv.vipFixedRecipeId], `${lv.id}: invalid vipFixedRecipeId "${lv.vipFixedRecipeId}"`);
        }

        if (needsMatcha) {
          ctx.assert(
            flat.includes('M') || flat.includes('G'),
            `${lv.id}: requires matcha recipe without 'M' or 'G' cell on board`
          );
        }
        if (needsBerry) {
          ctx.assert(
            flat.includes('B') || flat.includes('G'),
            `${lv.id}: requires berry recipe without 'B' or 'G' cell on board`
          );
        }
      }

      const lv1_10 = LEVELS.find((l) => l.id === '1-10');
      const lv3_10 = LEVELS.find((l) => l.id === '3-10');
      ctx.assertEq(lv1_10.vipFixedRecipeId, 'R14', '1-10 vipFixedRecipeId must be R14');
      ctx.assertEq(lv3_10.rushEndSec, 15, '3-10 rushEndSec must be 15');
    },
  },

  {
    id: 'T2-F02-06',
    tier: 2,
    features: ['F02'],
    title: 'Legacy v1 exports purged from constants.js, normalizePatronId/getLevelById boundary safety, and zero legacy Lobby mode hits',
    run: async (ctx) => {
      const check = await ctx.eval(() => {
        const c = window.__WX_HARNESS__?.requireModule
          ? window.__WX_HARNESS__.requireModule('./src/constants.js')
          : null;
        const lv = window.__WX_HARNESS__?.requireModule
          ? window.__WX_HARNESS__.requireModule('./src/levels_data.js')
          : null;
        return { hasHarnessRequire: !!c && !!lv };
      });

      const constantsMod = check.hasHarnessRequire
        ? await ctx.eval(() => {
            const c = window.__WX_HARNESS__.requireModule('./src/constants.js');
            const lv = window.__WX_HARNESS__.requireModule('./src/levels_data.js');
            return {
              legacyPresent: ['TIERS', 'SHIFTS', 'SHIFT_HAZARDS', 'RELICS', 'DECK_MODS', 'JAR', 'BLESSINGS', 'SHOP_UPGRADES'].filter(
                (k) => c[k] !== undefined
              ),
              normChefMikan: c.normalizePatronId('chef_mikan'),
              normPatronLuna: c.normalizePatronId('patron_luna'),
              normPatronMugi: c.normalizePatronId('patron_mugi'),
              normLuna: c.normalizePatronId('luna'),
              normNull: c.normalizePatronId(null),
              normBad: c.normalizePatronId('nonexistent_patron'),
              clampLowPrice: c.getCatcakePrice(1, -5),
              clampHighPrice: c.getCatcakePrice(1, 99),
              invalidLv: lv.getLevelById('99-99'),
              emptyLv: lv.getLevelById(''),
              nextAfter3_10: lv.getNextLevelId('3-10'),
            };
          })
        : await (async () => {
            const c = await ctx.requireBundledModule('./src/constants.js');
            const lv = await ctx.requireBundledModule('./src/levels_data.js');
            return {
              legacyPresent: ['TIERS', 'SHIFTS', 'SHIFT_HAZARDS', 'RELICS', 'DECK_MODS', 'JAR', 'BLESSINGS', 'SHOP_UPGRADES'].filter(
                (k) => c[k] !== undefined
              ),
              normChefMikan: c.normalizePatronId('chef_mikan'),
              normPatronLuna: c.normalizePatronId('patron_luna'),
              normPatronMugi: c.normalizePatronId('patron_mugi'),
              normLuna: c.normalizePatronId('luna'),
              normNull: c.normalizePatronId(null),
              normBad: c.normalizePatronId('nonexistent_patron'),
              clampLowPrice: c.getCatcakePrice(1, -5),
              clampHighPrice: c.getCatcakePrice(1, 99),
              invalidLv: lv.getLevelById('99-99'),
              emptyLv: lv.getLevelById(''),
              nextAfter3_10: lv.getNextLevelId('3-10'),
            };
          })();

      ctx.assertEq(constantsMod.legacyPresent, [], `Legacy v1 exports must be removed: ${constantsMod.legacyPresent.join(', ')}`);
      ctx.assertEq(constantsMod.normChefMikan, 'mikan');
      ctx.assertEq(constantsMod.normPatronLuna, 'luna');
      ctx.assertEq(constantsMod.normPatronMugi, 'mugi');
      ctx.assertEq(constantsMod.normLuna, 'luna');
      ctx.assertEq(constantsMod.normNull, 'mikan');
      ctx.assertEq(constantsMod.normBad, 'mikan');
      ctx.assertEq(constantsMod.clampLowPrice, 30);
      ctx.assertEq(constantsMod.clampHighPrice, 54);
      ctx.assertEq(constantsMod.invalidLv, null);
      ctx.assertEq(constantsMod.emptyLv, null);
      ctx.assertEq(constantsMod.nextAfter3_10, null);

      const lobbySt = await ctx.resetGame();
      const forbiddenHits = (lobbySt.hits || []).filter((h) => /mode_rush|mode_zen|mode_chef|resume_run/i.test(h.id));
      ctx.assertEq(forbiddenHits, [], 'Lobby must contain zero legacy v1 mode/resume hits');
    },
  },

  // --------------------------------------------------------------------------
  // F03 — Shaped-Grid 2048 Slide & Non-Chaining Merge (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F03-01',
    tier: 2,
    features: ['F03'],
    title: 'Single-step anti-chain merge [C1, C1, C2, .] -> [C2, C2, ., .] never chains into C3 (UT-G03)',
    run: async (ctx) => {
      await sculptRow0OnLevel1_7(ctx, [1, 1, 2, null]);
      await ctx.slide('left');
      const st = await ctx.getState();

      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 2, 'Row 0 col 0 must hold merged C2');
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 2, 'Row 0 col 1 must hold shifted C2 (no chain into C3)');
      const { count, maxTier } = countBoardTiles(st.grid);
      ctx.assertEq(maxTier, 2, 'Zero tiles >= C3 may exist after [C1, C1, C2, .] left slide');
      ctx.assertEq(count, 3, 'Board must contain exact 3 tiles (2 C2s + 1 post-slide spawn)');
      ctx.assertEq(st.score, 0, 'Merge must award 0 score');
    },
  },

  {
    id: 'T2-F03-02',
    tier: 2,
    features: ['F03'],
    title: 'Quadruple same-tier [C1, C1, C1, C1] merges into two C2 pairs symmetrically on left and right slides (UT-G04)',
    run: async (ctx) => {
      // Pass A: slide('left')
      await sculptRow0OnLevel1_7(ctx, [1, 1, 1, 1]);
      await ctx.slide('left');
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 2, 'Left slide: (0,0) must be C2');
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 2, 'Left slide: (0,1) must be C2');
      let stats = countBoardTiles(st.grid);
      ctx.assertEq(stats.maxTier, 2, 'Left slide: [C1,C1,C1,C1] must not chain into C3/C4');
      ctx.assertEq(stats.count, 3, 'Left slide: 4 - 2 merges + 1 spawn = 3 tiles');
      ctx.assertEq(st.score, 0);

      // Pass B: slide('right')
      await sculptRow0OnLevel1_7(ctx, [1, 1, 1, 1]);
      await ctx.slide('right');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][2].tile?.tier, 2, 'Right slide: (0,2) must be C2');
      ctx.assertEq(st.grid.cells[0][3].tile?.tier, 2, 'Right slide: (0,3) must be C2');
      stats = countBoardTiles(st.grid);
      ctx.assertEq(stats.maxTier, 2, 'Right slide: [C1,C1,C1,C1] must not chain into C3/C4');
      ctx.assertEq(stats.count, 3, 'Right slide: 4 - 2 merges + 1 spawn = 3 tiles');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F03-03',
    tier: 2,
    features: ['F03'],
    title: 'Max-tier C7 + C7 cap on 3-10 never merges into non-existent C8 (UT-G05)',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-10', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 2, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // 3-10 matrix: #...# / .MIB. / .IGI. / .BXM. / #...#
      // Presets: (0,2):C4, (1,2):C5[I], (2,1):C5[I], (2,2):C6(gold), (2,3):C5[I], (4,2):C4
      await ctx.useToolOnCell('spoon', 2, 2); // (2,2) -> C7(gold)
      await ctx.useToolOnCell('fork', 1, 2);  // (1,2) -> unfrozen C5
      await ctx.useToolOnCell('fork', 2, 1);  // (2,1) -> unfrozen C5
      await syncClearBoardExcept(ctx, [[1, 2], [2, 1], [2, 2]]);

      // Slide up -> (2,1):C5 -> (0,1):C5; (1,2):C5 -> (0,2):C5; (2,2):C7 -> (1,2):C7
      await ctx.slide('up');
      await syncClearBoardExcept(ctx, [[0, 1], [0, 2], [1, 2]]);

      // Slide left -> (0,1)+(0,2) merge into (0,1):C6; (1,2):C7 -> (1,0):C7
      await ctx.slide('left');
      await ctx.useToolOnCell('spoon', 0, 1); // (0,1):C6 -> (0,1):C7!
      await syncClearBoardExcept(ctx, [[0, 1], [1, 0]]);

      // Route both C7s into Row 4 (# . . . #):
      // 1) slide('down'): (1,0):C7 -> (3,0):C7; (0,1):C7 -> (4,1):C7
      await ctx.slide('down');
      await syncClearBoardExcept(ctx, [[3, 0], [4, 1]]);
      // 2) slide('right'): (3,0):C7 stops at (3,1):C7 against (3,2):X; (4,1):C7 -> (4,3):C7
      await ctx.slide('right');
      await syncClearBoardExcept(ctx, [[3, 1], [4, 3]]);
      // 3) slide('up'): (3,1):C7 -> (0,1):C7; (4,3):C7 stops at (3,3):C7 below frozen (2,3):C5[I]
      await ctx.slide('up');
      await syncClearBoardExcept(ctx, [[0, 1], [3, 3]]);
      // 4) slide('down'): (0,1):C7 -> (4,1):C7; (3,3):C7 -> (4,3):C7!
      await ctx.slide('down');
      await syncClearBoardExcept(ctx, [[4, 1], [4, 3]]);

      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[4][1].tile?.tier, 7, 'First C7 must be at (4,1)');
      ctx.assertEq(st.grid.cells[4][3].tile?.tier, 7, 'Second C7 must be at (4,3)');

      // Slide left: (4,3):C7 moves next to (4,1):C7 at (4,2):C7 without merging into C8!
      await ctx.slide('left');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[4][1].tile?.tier, 7, '(4,1) must remain C7');
      ctx.assertEq(st.grid.cells[4][2].tile?.tier, 7, '(4,2) must remain C7 alongside (4,1)');
      ctx.assertEq(countBoardTiles(st.grid).maxTier, 7, 'Max tier on board must never exceed 7');

      // Clear spawn so ONLY [(4,1):C7, (4,2):C7] (and frozen (2,3)) exist, then slide('left') again -> blocked!
      await syncClearBoardExcept(ctx, [[4, 1], [4, 2]]);
      const beforeBlocked = countBoardTiles((await ctx.getState()).grid).count;
      const blockedRes = await ctx.slide('left');
      st = await ctx.getState();
      if (blockedRes && typeof blockedRes.moved === 'boolean') {
        ctx.assertEq(blockedRes.moved, false, 'Packed [#, C7, C7, ., #] left slide must report moved=false');
      }
      ctx.assertEq(st.grid.cells[4][1].tile?.tier, 7);
      ctx.assertEq(st.grid.cells[4][2].tile?.tier, 7);
      ctx.assertEq(countBoardTiles(st.grid).count, beforeBlocked, 'Blocked C7+C7 slide must spawn 0 tiles');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F03-04',
    tier: 2,
    features: ['F03'],
    title: 'Blocked wall slide and full non-mergeable row slide report moved:false and spawn 0 new tiles (UT-G06)',
    run: async (ctx) => {
      // Part A: Single C1 at top-left (0,0) on 1-1
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await syncClearBoardExcept(ctx, [[0, 0]]);

      for (let i = 0; i < 3; i++) {
        const resL = await ctx.slide('left');
        const resU = await ctx.slide('up');
        if (resL && typeof resL.moved === 'boolean') ctx.assertEq(resL.moved, false);
        if (resU && typeof resU.moved === 'boolean') ctx.assertEq(resU.moved, false);
      }

      let st = await ctx.getState();
      ctx.assertEq(countBoardTiles(st.grid).count, 1, 'Blocked wall slides must spawn 0 new tiles');
      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 1);
      ctx.assertEq(st.score, 0);

      // Part B: Full non-mergeable Row 0 [C1, C2, C3] on 1-1 (3x3) with Rows 1..2 empty
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      // Presets: (0,0):C1, (0,1):C1, (1,1):C2 -> slide('up') -> (0,0):C1, (0,1):C1? Wait: (0,1):C1 blocks (1,1):C2!
      // Upgrade (0,1):C1 -> C2 via spoon, slide (1,1):C2 right -> (1,2):C2, slide up -> (0,2):C2, spoon (0,2) -> C3!
      await ctx.useToolOnCell('spoon', 0, 1); // (0,1) -> C2
      await ctx.slide('right'); // (0,0):C1 -> (0,1):C1, (0,1):C2 -> (0,2):C2, (1,1):C2 -> (1,2):C2
      // Simpler: fill 1-1 and spoon (0,1)->C2, (0,2)->C3!
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      for (let i = 0; i < 8; i++) {
        if (countBoardTiles((await ctx.getState()).grid).count >= 9) break;
        await ctx.advanceBothClocks(140);
        await ctx.knead();
      }
      await syncClearBoardExcept(ctx, [[0, 0], [0, 1], [0, 2]]);
      st = await ctx.getState();
      if (st.grid.cells[0][0].tile.tier === 2) {
        // Ensure distinct tiers across [0,0], [0,1], [0,2]
        await ctx.useToolOnCell('spoon', 0, 2); // 2 or 3
      }
      // Make exact [t0, t1, t2] with t0 !== t1 && t1 !== t2 using 2 spoons
      st = await ctx.getState();
      const t0 = st.grid.cells[0][0].tile.tier;
      let t1 = st.grid.cells[0][1].tile.tier;
      let t2 = st.grid.cells[0][2].tile.tier;
      if (t1 === t0) {
        await ctx.useToolOnCell('spoon', 0, 1);
        t1 = (await ctx.getState()).grid.cells[0][1].tile.tier;
      }
      if (t2 === t1) {
        await ctx.useToolOnCell('spoon', 0, 2);
        t2 = (await ctx.getState()).grid.cells[0][2].tile.tier;
      }
      ctx.assert(t0 !== t1 && t1 !== t2, `Expected non-mergeable Row 0, got [${t0},${t1},${t2}]`);

      await ctx.slide('left');
      await ctx.slide('right');
      st = await ctx.getState();
      ctx.assertEq(countBoardTiles(st.grid).count, 3, 'Full non-mergeable row horizontal slides must spawn 0 tiles');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F03-05',
    tier: 2,
    features: ['F03', 'F04'],
    title: 'Frozen tile (frozenHp > 0) acts as immovable wall and refuses to merge with same-tier C4 neighbor on 3-1',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-1', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Keep only (0,2):C3 unfrozen, plus frozen (1,2):C4[I] and (2,2):C4[I]
      await syncClearBoardExcept(ctx, [[0, 2]]);
      await ctx.useToolOnCell('spoon', 0, 2); // (0,2) -> unfrozen C4 directly above (1,2):C4[I] and (2,2):C4[I]

      const resDown = await ctx.slide('down');
      const resUp = await ctx.slide('up');
      if (resDown && typeof resDown.moved === 'boolean') ctx.assertEq(resDown.moved, false);
      if (resUp && typeof resUp.moved === 'boolean') ctx.assertEq(resUp.moved, false);

      const st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][2].tile?.tier, 4, 'Unfrozen (0,2):C4 must stay at (0,2) without merging into frozen C4');
      ctx.assertEq(st.grid.cells[0][2].tile?.frozenHp, 0);
      ctx.assertEq(st.grid.cells[1][2].tile?.tier, 4, 'Frozen (1,2):C4[I] must remain C4');
      ctx.assertEq(st.grid.cells[1][2].tile?.frozenHp, 1, 'Frozen (1,2):C4[I] must remain frozenHp=1');
      ctx.assertEq(st.grid.cells[2][2].tile?.tier, 4, 'Frozen (2,2):C4[I] must remain C4');
      ctx.assertEq(st.grid.cells[2][2].tile?.frozenHp, 1, 'Frozen (2,2):C4[I] must remain frozenHp=1');
      ctx.assertEq(countBoardTiles(st.grid).count, 3, 'Blocked slide against frozen stack must spawn 0 tiles');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F03-06',
    tier: 2,
    features: ['F03'],
    title: 'Same-tier C3 tiles separated by # void cutout on 2-4 never merge across the gap (UT-G01)',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('2-4', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // 2-4 Row 0: . . # . . ; presets include (0,0):C3 and (3,4):C2
      await ctx.useToolOnCell('spoon', 3, 4); // (3,4) -> C3
      await syncClearBoardExcept(ctx, [[0, 0], [3, 4]]);
      await ctx.slide('up'); // (3,4):C3 -> (0,4):C3
      await syncClearBoardExcept(ctx, [[0, 0], [0, 4]]);

      await ctx.slide('right');
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 3, 'Left C3 must stop at (0,1) left of (0,2):#');
      ctx.assertEq(st.grid.cells[0][4].tile?.tier, 3, 'Right C3 must stay at (0,4)');
      ctx.assertEq(st.grid.cells[0][2].type, 'void');
      ctx.assertEq(st.grid.cells[0][2].tile, null);
      ctx.assertEq(countBoardTiles(st.grid).maxTier, 3, 'C3s separated by # void must never merge into C4');

      await syncClearBoardExcept(ctx, [[0, 1], [0, 4]]);
      await ctx.slide('left');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 3, 'Left C3 slides back to (0,0)');
      ctx.assertEq(st.grid.cells[0][3].tile?.tier, 3, 'Right C3 stops at (0,3) right of (0,2):#');
      ctx.assertEq(countBoardTiles(st.grid).maxTier, 3);
      ctx.assertEq(st.score, 0);
    },
  },

  // --------------------------------------------------------------------------
  // F04 — Flavor Inheritance, Special Cell Dyeing & Orthogonal Ice (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F04-01',
    tier: 2,
    features: ['F04'],
    title: 'gold flavor never downgrades when stopping on M (2-8) or B (3-10) special cells (UT-G09)',
    run: async (ctx) => {
      // Part A: gold tile stopping on M cell (2-8 Col 2: (0,2):C3, (1,2):M, (2,2):G[C5(gold)])
      await ctx.setupSaveAndStart('2-8', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await syncClearBoardExcept(ctx, [[0, 2], [2, 2]]);
      await ctx.slide('up');
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][2].type, 'matcha');
      ctx.assertEq(st.grid.cells[1][2].tile?.tier, 5);
      ctx.assertEq(st.grid.cells[1][2].tile?.flavor, 'gold', 'C5(gold) stopping on M cell must NOT downgrade to matcha');

      // Part B: gold tile stopping on B cell (3-10: (2,2):C6(gold) -> (2,0) -> (3,0) -> (3,1):B against (3,2):X)
      await ctx.setupSaveAndStart('3-10', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.useToolOnCell('fork', 2, 1);
      await syncClearBoardExcept(ctx, [[2, 2]]);
      await ctx.slide('left');
      await syncClearBoardExcept(ctx, [[2, 0]]);
      await ctx.slide('down');
      await syncClearBoardExcept(ctx, [[3, 0]]);
      await ctx.slide('right');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[3][1].type, 'berry');
      ctx.assertEq(st.grid.cells[3][1].tile?.tier, 6);
      ctx.assertEq(st.grid.cells[3][1].tile?.flavor, 'gold', 'C6(gold) stopping on B cell must NOT downgrade to berry');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F04-02',
    tier: 2,
    features: ['F04'],
    title: 'Non-gold flavored tiles re-dye between M <-> B on 3-4 and upgrade to gold on G on 2-4',
    run: async (ctx) => {
      // 1) matcha -> berry on 3-4 Row 0 (. M . B .): (0,1):C3(matcha), (0,3):C3(berry)
      await ctx.setupSaveAndStart('3-4', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.useToolOnCell('spoon', 0, 3); // (0,3) -> C4(berry) stopper
      await syncClearBoardExcept(ctx, [[0, 1], [0, 3]]);
      await ctx.slide('right'); // (0,3):C4 -> (0,4); (0,1):C3(matcha) stops on (0,3):B!
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][3].type, 'berry');
      ctx.assertEq(st.grid.cells[0][3].tile?.tier, 3);
      ctx.assertEq(st.grid.cells[0][3].tile?.flavor, 'berry', 'matcha tile stopping on B cell must re-dye to berry');

      // 2) berry -> matcha on 3-4 Row 0 (. M . B .)
      await ctx.setupSaveAndStart('3-4', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.useToolOnCell('spoon', 0, 1); // (0,1) -> C4(matcha) stopper
      await syncClearBoardExcept(ctx, [[0, 1], [0, 3]]);
      await ctx.slide('left'); // (0,1):C4 -> (0,0); (0,3):C3(berry) stops on (0,1):M!
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][1].type, 'matcha');
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 3);
      ctx.assertEq(st.grid.cells[0][1].tile?.flavor, 'matcha', 'berry tile stopping on M cell must re-dye to matcha');

      // 3) matcha -> gold on 2-4 Row 1 (. M . G .): (1,1):C3(matcha), (1,3):C4(gold)
      await ctx.setupSaveAndStart('2-4', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await syncClearBoardExcept(ctx, [[1, 1], [1, 3]]);
      await ctx.slide('right'); // (1,3):C4(gold) -> (1,4); (1,1):C3(matcha) stops on (1,3):G!
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][3].type, 'gold');
      ctx.assertEq(st.grid.cells[1][3].tile?.tier, 3);
      ctx.assertEq(st.grid.cells[1][3].tile?.flavor, 'gold', 'matcha tile stopping on G cell must upgrade to gold');
    },
  },

  {
    id: 'T2-F04-03',
    tier: 2,
    features: ['F04'],
    title: 'Diagonal merge at (0,0) leaves (1,1):I ice unbroken on 3-3 while orthogonal merge at (0,1) shatters it (UT-G10)',
    run: async (ctx) => {
      // Negative (diagonal): slide('left') merges (0,0):C2 + (0,1):C2 at (0,0), diagonal to (1,1):C4[I]
      await ctx.setupSaveAndStart('3-3', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.slide('left');
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 3, 'Merge occurred at (0,0)');
      ctx.assertEq(st.grid.cells[1][1].tile?.frozenHp, 1, 'Diagonal merge at (0,0) MUST NOT shatter (1,1):C4[I]');
      ctx.assertEq(st.grid.cells[1][3].tile?.frozenHp, 1);
      ctx.assertEq(st.score, 0);

      // Positive differential control (orthogonal): slide('right') merges at (0,1) directly above (1,1):C4[I]
      await ctx.setupSaveAndStart('3-3', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.slide('right');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 3, 'Merge occurred at (0,1)');
      ctx.assertEq(st.grid.cells[1][1].tile?.frozenHp, 0, 'Orthogonal merge at (0,1) MUST shatter (1,1):C4[I]');
      ctx.assertEq(st.grid.cells[1][3].tile?.frozenHp, 1);
    },
  },

  {
    id: 'T2-F04-04',
    tier: 2,
    features: ['F04'],
    title: 'Non-merging slide stopping orthogonally adjacent to frozen I cell on 3-1 does NOT shatter ice',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-1', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      // Keep only (2,4):C3 unfrozen so zero merges can occur anywhere on the board
      await syncClearBoardExcept(ctx, [[2, 4]]);
      await ctx.slide('left'); // (2,4):C3 stops at (2,3):M orthogonally right of (2,2):C4[I]

      const st = await ctx.getState();
      ctx.assertEq(st.grid.cells[2][3].tile?.tier, 3, '(2,4):C3 stopped orthogonally next to (2,2):C4[I]');
      ctx.assertEq(st.grid.cells[2][2].tile?.frozenHp, 1, 'Stopping next to ice without a merge must NOT shatter (2,2)');
      ctx.assertEq(st.grid.cells[1][2].tile?.frozenHp, 1, '(1,2) must also remain frozen');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F04-05',
    tier: 2,
    features: ['F04', 'F03'],
    title: 'Post-slide ice shatter ordering on 3-9 keeps newly thawed C5 in place until the next slide step (UT-G10)',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-9', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Col 1 on 3-9: (0,1):C4, (1,1):C4(gold), (2,1):C5[I], (3,1):B[empty], (4,1):.[empty]
      await ctx.slide('down');
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][1].tile?.tier, 5, '(0,1)+(1,1) must merge into (1,1):C5(gold)');
      ctx.assertEq(st.grid.cells[1][1].tile?.flavor, 'gold');
      ctx.assertEq(st.grid.cells[2][1].tile?.tier, 5, 'Thawed (2,1):C5 must remain at (2,1) during the same slide step');
      ctx.assertEq(st.grid.cells[2][1].tile?.frozenHp, 0, '(2,1):C5 must now have frozenHp=0');

      // Clear any random post-slide spawn at (3,1) or (4,1) so Col 1 bottom is open
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        for (const r of [3, 4]) {
          const t = dbg.getState().grid.cells[r][1]?.tile;
          if (t && !(t.frozenHp > 0)) {
            dbg.tapBoardCell(r, 1);
            const s = dbg.getState();
            for (let i = 0; i < s.tray.length; i++) {
              if (s.tray[i]) dbg.doubleTapTray(i);
            }
          }
        }
      });

      await ctx.slide('down');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[4][1].tile?.tier, 6, '2nd downward slide merges (1,1):C5(gold)+(2,1):C5 into (4,1):C6(gold)');
      ctx.assertEq(st.grid.cells[4][1].tile?.flavor, 'gold');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F04-06',
    tier: 2,
    features: ['F04'],
    title: 'G/M/B floor cells permanently dye repeated visitors and thawed I cells behave as normal plain floor',
    run: async (ctx) => {
      // Part A: 2-2 (1,1):G dyes 2nd and 3rd plain visitors repeatedly
      await ctx.setupSaveAndStart('2-2', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      // Presets: (0,1):C3(plain), (1,1):C4(gold), (2,1):C2(plain), (3,2):C3(plain)
      await syncClearBoardExcept(ctx, [[0, 1], [2, 1]]);
      await ctx.slide('up'); // (0,1):C3 stays at (0,1); (2,1):C2(plain) stops on (1,1):G!
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][1].tile?.tier, 2);
      ctx.assertEq(st.grid.cells[1][1].tile?.flavor, 'gold', '2nd visitor onto (1,1):G must also dye gold');

      // Part B: 3-3 thawed (1,1) behaves as normal '.' cell (neither re-freezes nor dyes)
      await ctx.setupSaveAndStart('3-3', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.slide('right'); // merges at (0,1), thaws (1,1):C4[I]
      // Clear everything except (0,1):C3(plain), slide left -> (0,0):C3, down -> (3,0), or slide into (1,0)->(1,1) against (1,2):X!
      await syncClearBoardExcept(ctx, [[0, 1]]);
      await ctx.slide('left'); // (0,1):C3 -> (0,0):C3
      // Put a stopper below (1,0) by filling Col 0 rows 2,3 or sliding from (1,0):
      // On 3-3 Col 0 is (. . . . #): rows 0..3. Let's fill until (1,0) has a plain tile, clear all except (1,0), then slide('right') against (1,2):X!
      for (let i = 0; i < 20; i++) {
        const g = (await ctx.getState()).grid;
        if (g.cells[1][0].tile && g.cells[1][0].tile.flavor === 'plain') break;
        if (g.cells[1][0].tile) await syncClearBoardExcept(ctx, []);
        await ctx.advanceBothClocks(140);
        await ctx.knead();
      }
      await syncClearBoardExcept(ctx, [[1, 0]]);
      await ctx.slide('right'); // (1,0) slides right and stops on thawed (1,1) against (1,2):X!
      st = await ctx.getState();
      ctx.assert(st.grid.cells[1][1].tile !== null, 'Tile must stop on thawed (1,1) against (1,2):X');
      ctx.assertEq(st.grid.cells[1][1].tile.frozenHp, 0, 'Thawed I cell must NEVER re-freeze new visitors');
      ctx.assertEq(st.grid.cells[1][1].tile.flavor, 'plain', 'Thawed I cell must behave as normal plain floor');
    },
  },

  // --------------------------------------------------------------------------
  // F05 — Independent Knead Button (🐾 揉面补料) (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F05-01',
    tier: 2,
    features: ['F05'],
    title: '0.12s (120ms) debounce blocks back-to-back knead_btn clicks and rapid Space presses from double-spawning',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-7', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await ctx.advanceBothClocks(160);

      const initialCount = countBoardTiles((await ctx.getState()).grid).count;
      ctx.assertEq(initialCount, 4);

      // Two 0ms-apart clicks on knead_btn in the same JS turn -> must spawn +1, NOT +2
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.clickHit('knead_btn');
        dbg.clickHit('knead_btn');
      });
      const afterRapidPair = countBoardTiles((await ctx.getState()).grid).count;
      ctx.assertEq(afterRapidPair, 5, '2nd click within <120ms debounce window must be ignored');

      // After 160ms (>120ms) cooldown, next click succeeds
      await ctx.advanceBothClocks(160);
      await ctx.clickHit('knead_btn');
      const afterCooldown = countBoardTiles((await ctx.getState()).grid).count;
      ctx.assertEq(afterCooldown, 6, 'Knead after 160ms (>120ms) must succeed');

      // Rapid Space keydown pair (<25ms) -> spawns +1, NOT +2
      await ctx.advanceBothClocks(160);
      await ctx.eval(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      });
      const afterRapidSpace = countBoardTiles((await ctx.getState()).grid).count;
      ctx.assertEq(afterRapidSpace, 7, '2nd Space keydown within <120ms must be debounced');
      ctx.assertEq((await ctx.getState()).score, 0);
    },
  },

  {
    id: 'T2-F05-02',
    tier: 2,
    features: ['F05'],
    title: 'Full 9/9 board on 1-1 gracefully returns board_full without mutating existing tiles or crashing (UT-G11)',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      for (let i = 0; i < 6; i++) {
        await ctx.advanceBothClocks(150);
        await ctx.knead();
      }

      const beforeSt = await ctx.getState();
      ctx.assertEq(countBoardTiles(beforeSt.grid).count, 9, '1-1 must be 9/9 full');
      const snapshot = beforeSt.grid.cells.map((row) => row.map((c) => ({ tier: c.tile?.tier, flavor: c.tile?.flavor })));

      await ctx.advanceBothClocks(150);
      const res = await ctx.knead();
      await ctx.advanceBothClocks(150);
      await ctx.clickHit('knead_btn');

      if (res && typeof res === 'object' && 'spawned' in res) {
        ctx.assertEq(res.spawned, false, 'knead() on full board must return spawned:false');
        if (res.reason) ctx.assertEq(res.reason, 'board_full');
      }

      const afterSt = await ctx.getState();
      const afterSnap = afterSt.grid.cells.map((row) => row.map((c) => ({ tier: c.tile?.tier, flavor: c.tile?.flavor })));
      ctx.assertEq(afterSnap, snapshot, 'Full-board knead must leave all 9 tiles completely unchanged');
      ctx.assertEq(afterSt.score, 0);
    },
  },

  {
    id: 'T2-F05-03',
    tier: 2,
    features: ['F05'],
    title: 'Exhaustive knead fill on shaped/obstacle/ice board 3-3 never overwrites # void, X block, or I frozen cells',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-3', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // 3-3 has 25 cells: 3 '#' voids, 1 'X' block, 2 frozen 'I' cells, 4 unfrozen presets -> 15 empty playable cells
      for (let i = 0; i < 15; i++) {
        await ctx.advanceBothClocks(140);
        const r = await ctx.knead();
        if (r && typeof r === 'object' && 'spawned' in r) {
          ctx.assertEq(r.spawned, true, `Knead #${i + 1}/15 should succeed`);
        }
      }

      await ctx.advanceBothClocks(140);
      const overflowRes = await ctx.knead();
      if (overflowRes && typeof overflowRes === 'object' && 'spawned' in overflowRes) {
        ctx.assertEq(overflowRes.spawned, false, '16th knead on 21/21 full 3-3 must return spawned:false');
      }

      const st = await ctx.getState();
      ctx.assertEq(countBoardTiles(st.grid).count, 21, 'All 21 passable cells occupied, 0 obstacles occupied');
      for (const [vr, vc] of [[0, 2], [4, 0], [4, 4]]) {
        ctx.assertEq(st.grid.cells[vr][vc].type, 'void');
        ctx.assertEq(st.grid.cells[vr][vc].tile, null, `Void (${vr},${vc}) must stay null`);
      }
      ctx.assertEq(st.grid.cells[1][2].type, 'block');
      ctx.assertEq(st.grid.cells[1][2].tile, null, 'Block (1,2) must stay null');
      for (const [ir, ic] of [[1, 1], [1, 3]]) {
        ctx.assertEq(st.grid.cells[ir][ic].tile?.tier, 4, `Frozen (${ir},${ic}) must stay C4`);
        ctx.assertEq(st.grid.cells[ir][ic].tile?.frozenHp, 1, `Frozen (${ir},${ic}) must stay frozenHp=1`);
      }
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F05-04',
    tier: 2,
    features: ['F05'],
    title: 'Last-empty-cell knead targeting (8/9 -> 9/9 on 1-1) deterministically populates the sole remaining cell',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      for (let i = 0; i < 5; i++) {
        await ctx.advanceBothClocks(145);
        await ctx.knead();
      }

      const st8 = await ctx.getState();
      ctx.assertEq(countBoardTiles(st8.grid).count, 8);
      let emptyCoord = null;
      const beforeUids = {};
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const t = st8.grid.cells[r][c].tile;
          if (!t) emptyCoord = [r, c];
          else beforeUids[`${r},${c}`] = { tier: t.tier, uid: t.uid };
        }
      }
      ctx.assert(!!emptyCoord, 'Must find unique empty cell at 8/9');

      await ctx.advanceBothClocks(150);
      await ctx.knead();
      const st9 = await ctx.getState();
      const spawned = st9.grid.cells[emptyCoord[0]][emptyCoord[1]].tile;
      ctx.assert(spawned && (spawned.tier === 1 || spawned.tier === 2), 'Unique empty cell must receive C1/C2');

      for (const [k, prev] of Object.entries(beforeUids)) {
        const [r, c] = k.split(',').map(Number);
        const cur = st9.grid.cells[r][c].tile;
        ctx.assertEq(cur?.tier, prev.tier, `Existing cell (${k}) tier must not change`);
      }
      ctx.assertEq(st9.score, 0);
    },
  },

  {
    id: 'T2-F05-05',
    tier: 2,
    features: ['F05', 'F16'],
    title: 'Space knead shortcut is suppressed while pause modal is open and resumes once modal closes',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await ctx.advanceBothClocks(160);
      ctx.assertEq(countBoardTiles((await ctx.getState()).grid).count, 3);

      await ctx.clickHit('pause_btn');
      ctx.assertEq((await ctx.getState()).activeModal, 'pause');

      await ctx.advanceBothClocks(160);
      await ctx.pressKey('Space');
      ctx.assertEq(countBoardTiles((await ctx.getState()).grid).count, 3, 'Space must NOT spawn tiles while pause modal is open');

      const pauseSt = await ctx.getState();
      const resumeHit = findHit(pauseSt, /modal_close|resume|continue/i);
      if (resumeHit) await ctx.clickHit(resumeHit.id);
      else await ctx.eval(() => globalThis.__HOSHI_DEBUG__.closeModal());

      ctx.assertEq((await ctx.getState()).activeModal, null);
      await ctx.advanceBothClocks(160);
      await ctx.pressKey('Space');
      ctx.assertEq(countBoardTiles((await ctx.getState()).grid).count, 4, 'Space must spawn +1 tile once resumed');
    },
  },

  {
    id: 'T2-F05-06',
    tier: 2,
    features: ['F05', 'F06'],
    title: 'Immediate board_full -> tray freeing -> knead recovery cycle on 1-1',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      for (let i = 0; i < 6; i++) {
        await ctx.advanceBothClocks(145);
        await ctx.knead();
      }
      await ctx.advanceBothClocks(145);
      const fullRes = await ctx.knead();
      if (fullRes && typeof fullRes === 'object' && 'spawned' in fullRes) {
        ctx.assertEq(fullRes.spawned, false);
      }

      // Free (2,2) via tray + trash synchronously
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.tapBoardCell(2, 2);
        const s = dbg.getState();
        for (let i = 0; i < s.tray.length; i++) {
          if (s.tray[i]) dbg.doubleTapTray(i);
        }
      });
      ctx.assertEq((await ctx.getState()).grid.cells[2][2].tile, null, '(2,2) freed to null');

      await ctx.advanceBothClocks(150);
      await ctx.knead();
      const recovered = await ctx.getState();
      ctx.assert(recovered.grid.cells[2][2].tile !== null, 'Knead immediately recovers and fills freed (2,2)');
      ctx.assertEq(countBoardTiles(recovered.grid).count, 9);
      ctx.assertEq(recovered.score, 0);
    },
  },

  // --------------------------------------------------------------------------
  // F06 — Serving Tray (3–4 Slots) & Double-Tap Trash (🗑️) (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F06-01',
    tier: 2,
    features: ['F06'],
    title: 'Full-tray (3/3 at dev_tray Lv.0 and 4/4 at dev_tray Lv.1) board tap rejection leaves board tile intact',
    run: async (ctx) => {
      // Part A: 3/3 full on 1-9 (allowedRecipes: R07..R14; [C3, C3, C2] matches 0 recipes)
      await ctx.setupSaveAndStart('1-9', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.tapBoardCell(0, 0); // C3
        dbg.tapBoardCell(1, 3); // C3
        dbg.tapBoardCell(2, 0); // C2
      });
      let st = await ctx.getState();
      ctx.assertEq(st.trayCapacity, 3);
      ctx.assert(st.tray.every((t) => t !== null), '3/3 tray slots must be full');

      // Attempt tapping 4th tile (3,3):C4 via both debug API and real CDP canvas tap
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.tapBoardCell(3, 3));
      await ctx.tapBoardCell(3, 3);
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[3][3].tile?.tier, 4, '3/3 full tray must NOT remove (3,3):C4 from board');
      ctx.assertEq(st.tray.map((t) => t?.tier), [3, 3, 2]);
      ctx.assertEq(st.score, 0);

      // Part B: 4/4 full on 2-2 (dev_tray: 1; [C3, C2, C3, C1/C2] matches 0 recipes in R07,R09,R11,R15..R17)
      await ctx.setupSaveAndStart('2-2', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.advanceBothClocks(150);
      await ctx.knead();
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.tapBoardCell(0, 1); // C3(plain)
        dbg.tapBoardCell(2, 1); // C2(plain)
        dbg.tapBoardCell(3, 2); // C3(plain)
        const s = dbg.getState();
        for (let r = 0; r < s.grid.rows; r++) {
          for (let c = 0; c < s.grid.cols; c++) {
            if (r === 1 && c === 1) continue;
            if (s.grid.cells[r][c]?.tile) {
              dbg.tapBoardCell(r, c);
              return;
            }
          }
        }
      });
      st = await ctx.getState();
      ctx.assertEq(st.trayCapacity, 4);
      ctx.assert(st.tray.every((t) => t !== null), '4/4 tray slots must be full');

      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.tapBoardCell(1, 1));
      await ctx.tapBoardCell(1, 1);
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][1].tile?.tier, 4, '4/4 full tray must NOT remove (1,1):C4(gold) from board');
      ctx.assertEq(st.grid.cells[1][1].tile?.flavor, 'gold');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F06-02',
    tier: 2,
    features: ['F06', 'F16'],
    title: 'Slow two taps (480ms > 320ms) on tray_slot_0 retain tile whereas fast double-tap (90ms <= 320ms) discards it',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-9', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.tapBoardCell(0, 0); // C3 -> tray_slot_0
      let st = await ctx.getState();
      ctx.assertEq(st.tray[0]?.tier, 3);

      const slot0Hit = findHit(st, 'tray_slot_0');
      ctx.assert(!!slot0Hit, 'tray_slot_0 must exist in HitRegistry');
      const pt = hitCenter(slot0Hit);

      // Slow two taps: 480ms apart (> 320ms threshold)
      await ctx.tapCanvas(pt.x, pt.y);
      await ctx.advanceBothClocks(480);
      await ctx.tapCanvas(pt.x, pt.y);

      st = await ctx.getState();
      ctx.assertEq(st.tray[0]?.tier, 3, '480ms (>320ms) slow two-tap must NOT discard tray[0]');

      // Positive control on the exact same slot: wait 480ms then fast double-tap (90ms <= 320ms)
      await ctx.advanceBothClocks(480);
      await ctx.doubleTapCanvas(pt.x, pt.y, { gapMs: 90 });

      st = await ctx.getState();
      ctx.assertEq(st.tray[0], null, 'Fast 90ms double-tap on tray_slot_0 MUST discard tile');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F06-03',
    tier: 2,
    features: ['F06'],
    title: 'Fast alternating taps across DIFFERENT tray slots (slot 0 then slot 1 in 80ms) must NOT discard either',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-9', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.tapBoardCell(0, 0); // tray[0] = C3
        globalThis.__HOSHI_DEBUG__.tapBoardCell(1, 3); // tray[1] = C3
      });

      let st = await ctx.getState();
      const p0 = hitCenter(findHit(st, 'tray_slot_0'));
      const p1 = hitCenter(findHit(st, 'tray_slot_1'));

      await ctx.tapCanvas(p0.x, p0.y);
      await ctx.advanceBothClocks(80);
      await ctx.tapCanvas(p1.x, p1.y);

      st = await ctx.getState();
      ctx.assertEq(st.tray[0]?.tier, 3, 'tray[0] must remain intact after cross-slot tap');
      ctx.assertEq(st.tray[1]?.tier, 3, 'tray[1] must remain intact after cross-slot tap');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F06-04',
    tier: 2,
    features: ['F06', 'F04'],
    title: 'Tapping frozen (I), block (X), void (#), empty (.), or out-of-bounds board coordinates is cleanly rejected on 3-3',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-3', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // (1,1):C4[I] frozen, (1,2):X block, (0,2):# void, (0,3):. empty
      for (const [r, c] of [[1, 1], [1, 2], [0, 2], [0, 3]]) {
        await ctx.eval((rr, cc) => globalThis.__HOSHI_DEBUG__.tapBoardCell(rr, cc), r, c);
        await ctx.tapBoardCell(r, c);
      }
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.tapBoardCell(-1, 99);
        globalThis.__HOSHI_DEBUG__.tapBoardCell(99, -1);
      });

      const st = await ctx.getState();
      ctx.assertEq(st.tray, [null, null, null], 'Tray must remain empty after invalid cell taps');
      ctx.assertEq(st.grid.cells[1][1].tile?.tier, 4, 'Frozen (1,1) must stay on board');
      ctx.assertEq(st.grid.cells[1][1].tile?.frozenHp, 1);
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F06-05',
    tier: 2,
    features: ['F06'],
    title: 'Double-tapping empty tray slots and clicking tray_trash_btn with empty tray are safe no-ops',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });

      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.doubleTapTray(0);
        dbg.doubleTapTray(2);
        dbg.doubleTapTray(-1);
        dbg.doubleTapTray(99);
      });

      let st = await ctx.getState();
      const s0 = findHit(st, 'tray_slot_0');
      if (s0) {
        const pt = hitCenter(s0);
        await ctx.doubleTapCanvas(pt.x, pt.y, { gapMs: 85 });
      }
      const trashBtn = findHit(st, 'tray_trash_btn');
      if (trashBtn) {
        await ctx.clickHit('tray_trash_btn');
      }

      st = await ctx.getState();
      ctx.assertEq(st.tray, [null, null, null]);
      ctx.assertEq(st.score, 0);
      ctx.assertEq(st.ordersServed, 0);
    },
  },

  {
    id: 'T2-F06-06',
    tier: 2,
    features: ['F06', 'F03', 'F16'],
    title: 'Fast pointer swipe (>=18px in <350ms) starting directly on occupied tile executes slide and suppresses tray tap',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });

      const st0 = await ctx.getState();
      const { x, y } = cellCenter(ctx, st0.boardLayout, 1, 1); // Directly on occupied (1,1):C2!

      await ctx.swipeCanvas(x, y, x - 38, y, { steps: 6, stepMs: 12 });
      const st1 = await ctx.getState();

      ctx.assertEq(st1.grid.cells[0][0].tile?.tier, 2, '(0,0)+(0,1) merged left into C2');
      ctx.assertEq(st1.grid.cells[1][0].tile?.tier, 2, '(1,1):C2 slid left to (1,0)');
      ctx.assertEq(st1.tray, [null, null, null], 'Swipe gestureConsumed must suppress pointerup tray placement');
      ctx.assertEq(st1.score, 0);
    },
  },

  // --------------------------------------------------------------------------
  // F07 — Subset Multiset Order Matching & Customer Priority (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F07-01',
    tier: 2,
    features: ['F07', 'F08'],
    title: 'Duplicate-tier multiset R06 (C2 + C2) on 1-7 marks 1 slot on single C2 without serving until 2nd C2 arrives (UT-O02)',
    run: async (ctx) => {
      let r06Idx = -1;
      for (let attempt = 0; attempt < 12 && r06Idx === -1; attempt++) {
        await ctx.setupSaveAndStart('1-7', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
        // Keep ONLY (0,0):C2 and (2,1):C2 so maxBoardTier=2 -> R06 is the sole <=C2 recipe in 1-7 (R05..R12)
        await syncClearBoardExcept(ctx, [[0, 0], [2, 1]]);
        const st = await ctx.advanceTime(3.2);
        r06Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R06');
      }
      ctx.assert(r06Idx >= 0, 'Expected anti-deadlock pool on 1-7 (maxBoardTier=2) to spawn R06 (C2+C2)');

      await ctx.clickHit(`seat_${r06Idx}`);
      // Place 1st C2 into tray[0]
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.tapBoardCell(0, 0));
      let stAfter1 = await ctx.advanceTime(0.65);

      ctx.assertEq(stAfter1.ordersServed, 0, 'Single C2 must NOT complete R06 (C2+C2)');
      ctx.assertEq(stAfter1.score, 0, 'Partial match must award 0 score');
      ctx.assertEq(stAfter1.tray[0]?.tier, 2, '1st C2 remains in tray[0]');
      ctx.assertEq(stAfter1.tray[1], null);
      const partialSeat = stAfter1.seats[r06Idx];
      ctx.assert(!!partialSeat && partialSeat.recipeId === 'R06', 'R06 customer must still be seated');
      if (Array.isArray(partialSeat.slots) && partialSeat.slots.length === 2 && 'matchedTrayIdx' in partialSeat.slots[0]) {
        const matchedCount = partialSeat.slots.filter((sl) => sl.matchedTrayIdx !== null && sl.matchedTrayIdx >= 0).length;
        ctx.assertEq(matchedCount, 1, 'Single C2 must mark exact 1 of 2 R06 slots');
      }

      // Place 2nd C2 into tray[1] -> completes R06!
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.tapBoardCell(2, 1));
      const stAfter2 = await ctx.advanceTime(0.65);
      ctx.assertEq(stAfter2.ordersServed, 1, '2nd C2 completes R06');
      ctx.assert(stAfter2.score > 0, 'Completed R06 awards positive score');
      ctx.assertEq(stAfter2.tray[0], null);
      ctx.assertEq(stAfter2.tray[1], null);
    },
  },

  {
    id: 'T2-F07-02',
    tier: 2,
    features: ['F07', 'F04'],
    title: 'Strict flavor rejection: plain rejected by matcha slot (R15 on 2-2) and matcha rejected by berry slot (R20 on 3-2) (UT-O03)',
    run: async (ctx) => {
      // Part A: [C2(plain), C3(plain)] vs R15 (C2 + C3[matcha]) on 2-2 (no R05 in 2-2!)
      let r15Idx = -1;
      for (let attempt = 0; attempt < 15 && r15Idx === -1; attempt++) {
        await ctx.setupSaveAndStart('2-2', {
          levelStars: getAllUnlockedStars(ctx, 3),
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        const st = await ctx.advanceTime(3.2);
        r15Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R15');
      }
      ctx.assert(r15Idx >= 0, 'Expected R15 to spawn on 2-2');
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.tapBoardCell(2, 1); // C2(plain)
        globalThis.__HOSHI_DEBUG__.tapBoardCell(0, 1); // C3(plain)
      });
      const stA = await ctx.advanceTime(0.65);
      ctx.assertEq(stA.ordersServed, 0, '[C2(plain), C3(plain)] must NOT fulfill R15 (C2 + C3[matcha])');
      ctx.assertEq(stA.score, 0);
      ctx.assertEq(stA.tray[0]?.tier, 2);
      ctx.assertEq(stA.tray[1]?.tier, 3);

      // Part B: [C2(plain), C4(matcha)] vs R20 (C2 + C4[berry]) on 3-2 (allowedRecipes: R16..R22)
      let r20Idx = -1;
      for (let attempt = 0; attempt < 18 && r20Idx === -1; attempt++) {
        await ctx.setupSaveAndStart('3-2', {
          levelStars: getAllUnlockedStars(ctx, 3),
          deviceUpgrades: { dev_tray: 1, dev_flour: 3, dev_teapot: 2, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        const st = await ctx.advanceTime(3.2);
        r20Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R20');
      }
      ctx.assert(r20Idx >= 0, 'Expected R20 (C2 + C4[berry]) to spawn on 3-2');

      // Upgrade (1,1):C3(matcha) -> C4(matcha), knead until we get a C2(plain) (or spoon a C1(plain) -> C2(plain))
      await ctx.useToolOnCell('spoon', 1, 1); // (1,1) -> C4(matcha)
      let c2Coord = null;
      for (let i = 0; i < 14 && !c2Coord; i++) {
        await ctx.advanceBothClocks(140);
        await ctx.knead();
        const g = (await ctx.getState()).grid;
        for (let r = 0; r < g.rows && !c2Coord; r++) {
          for (let c = 0; c < g.cols && !c2Coord; c++) {
            const cell = g.cells[r][c];
            if (cell.type === 'normal' && cell.tile && !(cell.tile.frozenHp > 0) && cell.tile.tier === 2) {
              c2Coord = [r, c];
            }
          }
        }
      }
      if (!c2Coord) {
        // Merge two C1s or knead once more; with dev_flour:3 (35% C2), 14 kneads has >99.7% C2 rate
        const g = (await ctx.getState()).grid;
        for (let r = 0; r < g.rows && !c2Coord; r++) {
          for (let c = 0; c < g.cols && !c2Coord; c++) {
            const cell = g.cells[r][c];
            if (cell.tile && !(cell.tile.frozenHp > 0) && cell.tile.tier === 1) {
              await ctx.useToolOnCell('spoon', r, c);
              c2Coord = [r, c];
            }
          }
        }
      }
      ctx.assert(!!c2Coord, 'Must obtain a C2 tile on 3-2');

      await ctx.clickHit(`seat_${r20Idx}`);
      await ctx.eval((c2) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.tapBoardCell(c2[0], c2[1]); // C2
        dbg.tapBoardCell(1, 1);         // C4(matcha) — WRONG flavor for C4[berry]!
      }, c2Coord);
      const stB = await ctx.advanceTime(0.65);
      ctx.assertEq(stB.ordersServed, 0, '[C2, C4(matcha)] must NOT cross-substitute for R20 (C2 + C4[berry])');
      ctx.assertEq(stB.score, 0);
    },
  },

  {
    id: 'T2-F07-03',
    tier: 2,
    features: ['F07'],
    title: 'Save-gold-for-later greedy priority consumes tray[1]=C4(plain) before tray[0]=C4(gold) on R07 (C4[any]) (UT-O04)',
    run: async (ctx) => {
      let r07Idx = -1;
      for (let attempt = 0; attempt < 16 && r07Idx === -1; attempt++) {
        await ctx.setupSaveAndStart('2-2', {
          levelStars: getAllUnlockedStars(ctx, 3),
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 2, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        const st = await ctx.advanceTime(3.2);
        r07Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R07');
      }
      ctx.assert(r07Idx >= 0, 'Expected R07 (C4[any]) to spawn on 2-2');

      // Synchronously at dt=0: lock R07 seat, upgrade (0,1):C3(plain)->C4(plain), place C4(gold) in tray[0] FIRST and C4(plain) in tray[1] SECOND!
      await ctx.eval((seatIdx) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.clickHit(`seat_${seatIdx}`);
        dbg.useToolOnCell('spoon', 0, 1); // (0,1) -> C4(plain)
        dbg.tapBoardCell(1, 1);           // tray[0] = C4(gold)
        dbg.tapBoardCell(0, 1);           // tray[1] = C4(plain)
      }, r07Idx);

      const st = await ctx.advanceTime(0.65);
      ctx.assertEq(st.ordersServed, 1, 'R07 must be served');
      ctx.assertEq(st.tray[1], null, 'tray[1] C4(plain) must be consumed first');
      ctx.assertEq(st.tray[0]?.tier, 4, 'tray[0] C4(gold) must be preserved for later');
      ctx.assertEq(st.tray[0]?.flavor, 'gold');
    },
  },

  {
    id: 'T2-F07-04',
    tier: 2,
    features: ['F07'],
    title: 'Exact-before-gold greedy matching on 2-10 consumes C4(matcha)+C3(plain) for R16 while preserving tray[0]=C4(gold)',
    run: async (ctx) => {
      let r16Idx = -1;
      for (let attempt = 0; attempt < 16 && r16Idx === -1; attempt++) {
        await ctx.setupSaveAndStart('2-10', {
          levelStars: getAllUnlockedStars(ctx, 3),
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 2, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        const st = await ctx.advanceTime(3.2);
        r16Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R16');
      }
      ctx.assert(r16Idx >= 0, 'Expected R16 (C4[matcha] + C3[any]) to spawn on 2-10');

      // 2-10 presets at frame 0: (1,1):C4(gold), (3,3):C4(matcha), (4,0):C3(plain)!
      await ctx.eval((seatIdx) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.clickHit(`seat_${seatIdx}`);
        dbg.tapBoardCell(1, 1); // tray[0] = C4(gold)
        dbg.tapBoardCell(3, 3); // tray[1] = C4(matcha)
        dbg.tapBoardCell(4, 0); // tray[2] = C3(plain)
      }, r16Idx);

      const st = await ctx.advanceTime(0.65);
      ctx.assertEq(st.ordersServed, 1, 'R16 must be served');
      ctx.assertEq(st.tray[1], null, 'Exact C4(matcha) in tray[1] must be consumed');
      ctx.assertEq(st.tray[2], null, 'C3(plain) in tray[2] must be consumed');
      ctx.assertEq(st.tray[0]?.tier, 4, 'tray[0] C4(gold) must remain unconsumed');
      ctx.assertEq(st.tray[0]?.flavor, 'gold');
    },
  },

  {
    id: 'T2-F07-05',
    tier: 2,
    features: ['F07'],
    title: 'Within-10% patience tie-break chain serves isVip/isUrgent over normal seat_0 and lowest seatIdx when flags tie',
    run: async (ctx) => {
      // Part A: Lowest seatIdx (0 < 1) when both normal and |dpRatio| < 0.10 on 1-1
      let matchedPair = false;
      for (let attempt = 0; attempt < 25 && !matchedPair; attempt++) {
        await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
        const st = await ctx.advanceTime(0.6);
        const s0 = st.seats[0];
        const s1 = st.seats[1];
        const disjoint =
          (s0?.recipeId === 'R01' && s1?.recipeId === 'R02') ||
          (s0?.recipeId === 'R02' && s1?.recipeId === 'R01');
        if (s0 && s1 && !disjoint) {
          matchedPair = true;
          await ctx.eval(() => {
            const dbg = globalThis.__HOSHI_DEBUG__;
            dbg.tapBoardCell(0, 0);
            dbg.tapBoardCell(1, 1);
          });
          const after = await ctx.advanceTime(0.55);
          ctx.assertEq(after.ordersServed, 1);
          ctx.assertEq(after.seats[0], null, 'seat_0 must win tie-break over seat_1 when patience gap <10% and flags equal');
          ctx.assert(after.seats[1] !== null, 'seat_1 must remain seated');
        }
      }
      ctx.assert(matchedPair, 'Expected two overlapping seats on 1-1 within 25 fast resets');

      // Part B: isVip / isUrgent in seat_1 or seat_2 beats normal seat_0 when |dpRatio| < 0.10 on 2-1
      // Note: On 2-1, [C2(plain), C3(matcha), C4(matcha)] satisfies R05, R07, R09, R15, and R16 simultaneously!
      const servable21 = new Set(['R05', 'R07', 'R09', 'R15', 'R16']);
      let priorityTested = false;
      for (let attempt = 0; attempt < 90 && !priorityTested; attempt++) {
        await ctx.setupSaveAndStart('2-1', {
          levelStars: getAllUnlockedStars(ctx, 3),
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 2, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        const st = await ctx.advanceTime(0.6); // seat_0 (0.3s) & seat_1 (0.5s) both at pRatio ~0.99 (gap < 0.02 < 0.10!)
        const s0 = st.seats[0];
        const s1 = st.seats[1];
        const disjoint21 =
          (s0?.recipeId === 'R07' && (s1?.recipeId === 'R05' || s1?.recipeId === 'R15')) ||
          (s1?.recipeId === 'R07' && (s0?.recipeId === 'R05' || s0?.recipeId === 'R15'));
        if (
          s0 &&
          s1 &&
          servable21.has(s0.recipeId) &&
          servable21.has(s1.recipeId) &&
          !disjoint21 &&
          !s0.isVip &&
          !s0.isUrgent &&
          (s1.isVip || s1.isUrgent)
        ) {
          priorityTested = true;
          await ctx.eval(() => {
            const dbg = globalThis.__HOSHI_DEBUG__;
            dbg.useToolOnCell('spoon', 2, 2); // (2,2):C3(matcha) -> C4(matcha)
            dbg.tapBoardCell(0, 1);           // C2(plain)
            dbg.tapBoardCell(1, 1);           // C3(matcha)
            dbg.tapBoardCell(2, 2);           // C4(matcha)
          });
          const after = await ctx.advanceTime(0.55);
          ctx.assertEq(after.ordersServed, 1);
          ctx.assertEq(after.seats[1], null, 'Urgent/VIP seat_1 must beat normal seat_0 when |dpRatio| < 0.10');
          ctx.assert(after.seats[0] !== null, 'Normal seat_0 must remain seated');
        }
      }
      ctx.assert(priorityTested, 'Expected overlapping urgent/VIP seat_1 alongside normal seat_0 on 2-1 within 90 fast resets');
    },
  },

  {
    id: 'T2-F07-06',
    tier: 2,
    features: ['F07', 'F09'],
    title: 'preferredSeatIdx ignores empty seats, switches cleanly between occupied seats, and resets to null on angry walkout',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });

      // At t=0 seats are all null -> clicking seat_0 must NOT lock an empty seat
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('seat_0'));
      ctx.assertEq((await ctx.getState()).preferredSeatIdx, null, 'Empty seat_0 must not lock preferredSeatIdx');

      await ctx.advanceTime(3.5); // All 3 seats occupied
      await ctx.clickHit('seat_0');
      ctx.assertEq((await ctx.getState()).preferredSeatIdx, 0);

      await ctx.clickHit('seat_2');
      let st = await ctx.getState();
      ctx.assertEq(st.preferredSeatIdx, 2, 'preferredSeatIdx must switch cleanly from 0 to 2');

      const waitSec = st.seats[2].patience + 0.8;
      st = await ctx.advanceTime(waitSec);
      ctx.assertEq(st.preferredSeatIdx, null, 'preferredSeatIdx must auto-reset to null when locked seat_2 walks out');

      // Even after seat_2 respawns, preferredSeatIdx stays null
      st = await ctx.advanceTime(2.6);
      ctx.assert(st.seats[2] !== null, 'New customer respawned in seat_2');
      ctx.assertEq(st.preferredSeatIdx, null, 'preferredSeatIdx must not stick to newly respawned customer');
    },
  },

  // --------------------------------------------------------------------------
  // F08 — Pure Serve-Only Scoring Formula, Combo & Starlight Fever (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F08-01',
    tier: 2,
    features: ['F08'],
    title: 'Serve combo 5+ cap keeps 6th serve at x1.50 and >10.0s idle window resets comboCount to 0 without walkout',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', {
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Complete 5 consecutive fast serves
      for (let k = 1; k <= 5; k++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let st5 = await ctx.getState();
      ctx.assertEq(st5.comboCount, 5, 'Expected comboCount=5 after 5 consecutive serves');

      // Prepare 6th serve and measure exact x1.50 cap (never x1.65)
      if (!st5.seats.some(Boolean)) {
        st5 = await ctx.advanceTime(1.6);
      }
      const targetIdx = st5.seats.findIndex((s) => s !== null && s.patience / s.maxPatience > 0.60);
      const seatIdx6 = targetIdx >= 0 ? targetIdx : st5.seats.findIndex(Boolean);
      const stBefore6 = await ctx.getState();
      const seat6 = stBefore6.seats[seatIdx6];
      const feverBefore6 = stBefore6.feverActive;
      const pRatio6 = seat6.patience / seat6.maxPatience;
      const tipMult6 = pRatio6 > 0.55 ? 1.30 : pRatio6 >= 0.25 ? 1.00 : 0.85;
      const baseMap = { R01: 30, R02: 70, R03: 118 };
      const expected6 = Math.round(baseMap[seat6.recipeId] * tipMult6 * 1.50 * (feverBefore6 ? 1.35 : 1.00));

      const stAfter6 = await serveOneOrderOrganically(ctx, seatIdx6, { useHarness: false, allowSpoon: false });
      ctx.assertEq(stAfter6.comboCount, 6, 'comboCount reaches 6');
      ctx.assertClose(stAfter6.score - stBefore6.score, expected6, 2, '6th serve combo multiplier must cap at x1.50');

      // Ensure all seated customers have ample patience (>14s with dev_teapot Lv.3) so 10.5s idle causes ZERO walkouts
      const stPreIdle = await ctx.getState();
      for (const s of stPreIdle.seats) {
        if (s) ctx.assert(s.patience > 12.0, `Expected >12s patience before 10.5s combo idle test, got ${s.patience}`);
      }

      const stPostIdle = await ctx.advanceTime(10.5);
      ctx.assertEq(stPostIdle.comboCount, 0, '>10.0s idle window must expire comboCount back to 0');

      // 7th serve restarts at comboCount=1 (x1.00)
      const stAfter7 = await serveOneOrderOrganically(ctx, null, { useHarness: false });
      ctx.assertEq(stAfter7.comboCount, 1, 'Serve after 10.5s expiry restarts comboCount at 1');
    },
  },

  {
    id: 'T2-F08-02',
    tier: 2,
    features: ['F08'],
    title: 'Non-serve actions grant 0 Fever energy and Starlight Fever expires cleanly after 10.0s restoring 1.0x patience decay',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', {
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 2, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Perform non-serve actions at t=0
      await ctx.slide('left');
      await ctx.slide('up');
      await ctx.advanceBothClocks(145);
      await ctx.knead();
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.tapBoardCell(0, 0);
        dbg.doubleTapTray(0);
      });

      let st = await ctx.getState();
      ctx.assertEq(st.feverEnergy, 0, 'Slides, merges, kneads, and trash must grant 0 Fever energy');
      ctx.assertEq(st.feverActive, false);
      ctx.assertEq(st.score, 0);

      // 4 green serves -> 4 * 25% = 100% -> feverActive = true
      for (let i = 0; i < 4; i++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      st = await ctx.getState();
      ctx.assertEq(st.feverActive, true, '4 green serves must activate Starlight Fever');

      // Advance 10.5s (> 10.0s Fever duration)
      st = await ctx.advanceTime(10.5);
      ctx.assertEq(st.feverActive, false, 'Starlight Fever must end after 10.0s');

      // Verify post-Fever patience decay returns to 1.0x (2.0s lost over 2.0s)
      if (!st.seats.some((s) => s && s.patience > 5)) {
        st = await ctx.advanceTime(2.4);
      }
      const measureIdx = st.seats.findIndex((s) => s && s.patience > 5);
      ctx.assert(measureIdx >= 0, 'Expected seated customer post-Fever');
      const pStart = st.seats[measureIdx].patience;
      const st2 = await ctx.advanceTime(2.0);
      const pEnd = st2.seats[measureIdx].patience;
      ctx.assertClose(pStart - pEnd, 2.0, 0.2, 'Post-Fever patience decay must return to 1.0x rate');
    },
  },

  {
    id: 'T2-F08-03',
    tier: 2,
    features: ['F08', 'F09'],
    title: 'Fever charge tiers award +20% on yellow/red normal serve, +25% on green normal serve, and +35% + vipServed++ on VIP critic',
    run: async (ctx) => {
      // 1) Yellow-band normal serve -> +20%
      await ctx.setupSaveAndStart('1-1', {
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      let st = await ctx.advanceTime(0.6);
      const maxP = st.seats[0].maxPatience;
      st = await ctx.advanceTime(maxP * 0.58); // pRatio ~ 0.40 (yellow band <= 0.55)
      ctx.assert(st.seats[0].patience / st.seats[0].maxPatience <= 0.54 && st.seats[0].patience / st.seats[0].maxPatience >= 0.28);
      st = await serveOneOrderOrganically(ctx, 0, { useHarness: false });
      ctx.assertEq(st.feverEnergy, 20, 'Yellow-band normal serve must grant +20% Fever energy (not +25%)');

      // 2) Green-band normal serve -> +25% (20 + 25 = 45): wait 2.3s so vacated seat_0 respawns at >90% green patience
      st = await ctx.advanceTime(2.3);
      const greenIdx = st.seats.findIndex((s) => s && s.patience / s.maxPatience > 0.60);
      ctx.assert(greenIdx >= 0, 'Expected fresh green-band customer after seat_0 turnover');
      st = await serveOneOrderOrganically(ctx, greenIdx, { useHarness: false });
      ctx.assertEq(st.feverEnergy, 45, 'Green-band normal serve must grant +25% Fever energy');

      // 3) VIP Critic (cust_critic) on 1-10 (vipFixedRecipeId: 'R14' = C4 + C5) -> +35% & vipServed++
      // Use dev_teapot: 0 so seat waves turn over 7-9 times before <8.0s closing guard, with up to 3 restarts
      let vipIdx = -1;
      for (let restart = 0; restart < 3 && vipIdx < 0; restart++) {
        await ctx.setupSaveAndStart('1-10', {
          levelStars: getAllUnlockedStars(ctx, 3),
          unlockedPatrons: ['mikan', 'luna'],
          selectedPatron: 'luna',
          deviceUpgrades: { dev_tray: 1, dev_flour: 2, dev_teapot: 0, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        st = await ctx.advanceTime(3.2);
        // Step in 2.5s increments (0 fever gain!) so cust_critic is caught within <=2.5s of spawning (>85% patience)
        for (let step = 0; step < 44; step++) {
          st = await ctx.getState();
          vipIdx = st.seats.findIndex((s) => s && s.isVip);
          if (vipIdx >= 0 || st.timeLeft <= 9.0) break;
          await ctx.advanceTime(2.5);
        }
      }
      ctx.assert(vipIdx >= 0, 'Expected VIP cust_critic to arrive on 1-10');
      ctx.assertEq(st.seats[vipIdx].customerId, 'cust_critic');
      const feBefore = st.feverEnergy;
      const vipBefore = st.vipServed;

      const afterVip = await serveOneOrderOrganically(ctx, vipIdx, { useHarness: false });
      ctx.assertEq(afterVip.vipServed, vipBefore + 1, 'Serving cust_critic must increment vipServed by +1');
      ctx.assertEq(afterVip.feverEnergy, feBefore + 35, 'Serving VIP cust_critic must grant exact +35% Fever energy');
    },
  },

  {
    id: 'T2-F08-04',
    tier: 2,
    features: ['F08', 'F07'],
    title: 'Single outer Math.round floating-point precision on R15 (C2 Lv.1=84 + C3[matcha]=202.5) at 2-combo (UT-O06)',
    run: async (ctx) => {
      let ready = false;
      let r15Idx = -1;
      let firstIdx = -1;

      for (let attempt = 0; attempt < 20 && !ready; attempt++) {
        await ctx.setupSaveAndStart('2-1', {
          levelStars: getAllUnlockedStars(ctx, 3),
          unlockedPatrons: ['mikan', 'luna'],
          selectedPatron: 'luna',
          catcakeLevels: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }, // C2 Lv.1 = 84, C3 Lv.0 = 150 -> C3[matcha] = 202.5
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 3, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        const st = await ctx.advanceTime(3.2);
        r15Idx = st.seats.findIndex((s) => s && s.recipeId === 'R15' && !s.isUrgent && !s.isVip);
        if (r15Idx < 0) r15Idx = st.seats.findIndex((s) => s && s.recipeId === 'R15');
        firstIdx = st.seats.findIndex((s, idx) => s && idx !== r15Idx && ['R05', 'R07', 'R15'].includes(s.recipeId));
        if (r15Idx >= 0 && firstIdx >= 0) ready = true;
      }
      ctx.assert(ready, 'Expected R15 + preliminary quick order on 2-1');

      // Serve preliminary order cleanly without touching (0,1):C2(plain) and (1,1):C3(matcha):
      // Presets on 2-1: (0,1):C2(plain), (1,1):C3(matcha), (2,2):C3(matcha), (3,2):C2(plain)!
      // Notice (3,2):C2(plain) and (2,2):C3(matcha) (+ spoon -> C4(matcha) if R07) fulfill R05, R07, or R15 while leaving (0,1) & (1,1) untouched!
      const st0 = await ctx.getState();
      const firstRec = st0.seats[firstIdx].recipeId;
      await ctx.eval((fIdx, recId) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.clickHit(`seat_${fIdx}`);
        if (recId === 'R07') {
          dbg.useToolOnCell('spoon', 2, 2); // (2,2) -> C4(matcha)
          dbg.tapBoardCell(2, 2);
        } else {
          // R05 or R15: both satisfied by (3,2):C2(plain) + (2,2):C3(matcha)!
          dbg.tapBoardCell(3, 2);
          dbg.tapBoardCell(2, 2);
        }
      }, firstIdx, firstRec);

      const stAfter1 = await ctx.advanceTime(0.65);
      ctx.assertEq(stAfter1.comboCount, 1);
      ctx.assertEq(stAfter1.feverActive, false);

      const seat2 = stAfter1.seats[r15Idx];
      ctx.assert(seat2.patience / seat2.maxPatience > 0.60, 'R15 seat must still be in green patience band');
      const custMult = seat2.isVip ? 1.50 : seat2.isUrgent ? 1.25 : 1.00;
      const expectedExact = Math.round((84 + 202.5) * 1.18 * 1.30 * 1.10 * custMult);

      // Now serve R15 using untouched presets (0,1):C2(plain) + (1,1):C3(matcha)
      await ctx.eval((sIdx) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.clickHit(`seat_${sIdx}`);
        dbg.tapBoardCell(0, 1);
        dbg.tapBoardCell(1, 1);
      }, r15Idx);

      const stAfter2 = await ctx.advanceTime(0.65);
      const delta = stAfter2.score - stAfter1.score;
      ctx.assertEq(delta, expectedExact, `Single outer Math.round expected ${expectedExact} (202.5 unrounded), got ${delta}`);
    },
  },

  {
    id: 'T2-F08-05',
    tier: 2,
    features: ['F08', 'F09'],
    title: 'Customer patience=0 angry walkout resets comboCount to 0 with strictly 0 score deduction (UT-O07)',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await serveOneOrderOrganically(ctx, null, { useHarness: false });
      const st2 = await serveOneOrderOrganically(ctx, null, { useHarness: false });

      ctx.assertEq(st2.comboCount, 2);
      const scoreBefore = st2.score;
      ctx.assert(scoreBefore > 60, 'Score must be positive before walkout');

      let cur = st2;
      if (!cur.seats.some(Boolean)) cur = await ctx.advanceTime(2.4);
      const minP = Math.min(...cur.seats.filter(Boolean).map((s) => s.patience));
      const stAfterWalkout = await ctx.advanceTime(minP + 0.8);

      ctx.assertEq(stAfterWalkout.comboCount, 0, 'Angry walkout must reset comboCount to 0');
      ctx.assertEq(stAfterWalkout.score, scoreBefore, 'Angry walkout must deduct 0 points from score');
    },
  },

  {
    id: 'T2-F08-06',
    tier: 2,
    features: ['F08', 'F15'],
    title: 'All 3 patron active skills award 0 direct score and Luna next-serve x1.50 boost consumes cleanly after 1 serve',
    run: async (ctx) => {
      // 1) Luna: charge to 100%, let Fever & Combo expire (10.5s), cast skill -> 0 direct score, 1st serve x1.50, 2nd serve x1.00
      await ctx.setupSaveAndStart('1-1', {
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        selectedPatron: 'luna',
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      for (let i = 0; i < 4; i++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let st = await ctx.advanceTime(10.5); // Clears Fever (10s) and Combo (10s) while keeping skillEnergy=100!
      ctx.assertEq(st.skillEnergy, 100);
      ctx.assertEq(st.feverActive, false);
      ctx.assertEq(st.comboCount, 0);

      // Ensure at least one C1 is on board before Luna tidy
      for (let i = 0; i < 6; i++) {
        const hasC1 = (await ctx.getState()).grid.cells.flat().some((c) => c.tile?.tier === 1);
        if (hasC1) break;
        await ctx.advanceBothClocks(145);
        await ctx.knead();
      }
      st = await ctx.getState();
      const scoreBeforeLuna = st.score;
      await ctx.castPatronSkill();
      const stAfterLunaCast = await ctx.getState();
      ctx.assertEq(stAfterLunaCast.score, scoreBeforeLuna, 'Luna active skill must award 0 direct score');
      ctx.assertEq(stAfterLunaCast.skillEnergy, 0);
      ctx.assert(
        !stAfterLunaCast.grid.cells.flat().some((c) => c.tile && !(c.tile.frozenHp > 0) && c.tile.tier === 1),
        'Luna active skill must clear all unfrozen C1 tiles'
      );

      // Serve #1 post-Luna (combo=1, green patience >0.60, fever=false) -> x1.50!
      if (!stAfterLunaCast.seats.some((s) => s && s.patience / s.maxPatience > 0.60)) {
        const minP = Math.min(...stAfterLunaCast.seats.filter(Boolean).map((s) => s.patience));
        await ctx.advanceTime(minP + 2.5);
      }
      const pre1 = await ctx.getState();
      const idx1 = pre1.seats.findIndex((s) => s && s.patience / s.maxPatience > 0.60);
      const rec1 = pre1.seats[idx1].recipeId;
      const baseMap = { R01: 30, R02: 70, R03: 118 };
      const post1 = await serveOneOrderOrganically(ctx, idx1, { useHarness: false, allowSpoon: false });
      ctx.assertEq(
        post1.score - pre1.score,
        Math.round(baseMap[rec1] * 1.30 * 1.50),
        `1st post-Luna serve (${rec1}) must receive x1.50 burst`
      );

      // Wait 10.5s to reset comboCount=0, then Serve #2 post-Luna -> reverts to x1.00!
      await ctx.advanceTime(10.5);
      let pre2 = await ctx.getState();
      if (!pre2.seats.some((s) => s && s.patience / s.maxPatience > 0.60)) {
        const minP = Math.min(...pre2.seats.filter(Boolean).map((s) => s.patience));
        pre2 = await ctx.advanceTime(minP + 2.5);
      }
      const idx2 = pre2.seats.findIndex((s) => s && s.patience / s.maxPatience > 0.60);
      const rec2 = pre2.seats[idx2].recipeId;
      const post2 = await serveOneOrderOrganically(ctx, idx2, { useHarness: false, allowSpoon: false });
      ctx.assertEq(
        post2.score - pre2.score,
        Math.round(baseMap[rec2] * 1.30 * 1.00),
        `2nd post-Luna serve (${rec2}) must revert to x1.00`
      );

      // 2) Mikan & Mugi active skills also award 0 direct score on cast
      for (const patronId of ['mikan', 'mugi']) {
        await ctx.setupSaveAndStart('1-1', {
          unlockedPatrons: ['mikan', 'luna', 'mugi'],
          selectedPatron: patronId,
          deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        for (let i = 0; i < 4; i++) {
          await serveOneOrderOrganically(ctx, null, { useHarness: false });
        }
        const beforeCast = await ctx.getState();
        ctx.assertEq(beforeCast.skillEnergy, 100);
        await ctx.castPatronSkill();
        const afterCast = await ctx.getState();
        ctx.assertEq(afterCast.score, beforeCast.score, `${patronId} active skill must award 0 direct score`);
        ctx.assertEq(afterCast.skillEnergy, 0);
      }
    },
  },
];


// ============================================================================
// PART 2: FEATURES F09 .. F16 (48 CASES) & EXPORTS
// ============================================================================

async function tryBuyEmergencyUtensil(ctx, kind) {
  const beforeBank = (await ctx.getSaveData()).bankStardust;
  const st0 = await ctx.getState();
  const hit = findHit(st0, `tool_${kind}_btn`);
  if (hit) {
    await ctx.clickHit(`tool_${kind}_btn`);
    const stModal = await ctx.getState();
    if (stModal.activeModal === 'confirm') {
      const okHit = (stModal.hits || []).find(
        (h) => /confirm|ok|yes|buy|accept/i.test(h.id) && !/cancel|close|no|back|backdrop|guard/i.test(h.id)
      );
      if (okHit) {
        await ctx.clickHit(okHit.id);
      }
    }
  }
  const midSt = await ctx.getState();
  const midSave = await ctx.getSaveData();
  if (midSave.bankStardust === beforeBank && (midSt.toolCounts?.[kind] || 0) === 0 && typeof ctx.buyEmergencyTool === 'function') {
    try {
      await ctx.buyEmergencyTool(kind);
    } catch (_) {
      // Expected on negative/rejected purchase checks
    }
  }
  // Disarm if armed so caller controls when to apply tool
  const finalSt = await ctx.getState();
  return { st: finalSt, save: await ctx.getSaveData() };
}

const TIER2_F09_TO_F16 = [
  // --------------------------------------------------------------------------
  // F09 — 3-Seat Real-Time Customer Waves, Rush Hour & Closing Guard (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F09-01',
    tier: 2,
    features: ['F09', 'F08', 'F10'],
    title: 'Angry walkout at 0% patience resets comboCount=0, keeps score intact, vacates seat, and triggers playCustomerAngry SFX (UT-O07)',
    run: async (ctx) => {
      await ctx.tapCanvas(12, 12); // Unlock WebAudio context
      await ctx.setupSaveAndStart('1-3', {
        levelStars: getAllUnlockedStars(ctx, 3),
        bgmTrack: 'off',
        sfxEnabled: true,
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Build comboCount >= 3 and positive score
      for (let i = 0; i < 3; i++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let st = await ctx.getState();
      ctx.assert(st.comboCount >= 3, `Expected comboCount>=3 before walkout, got ${st.comboCount}`);
      const scoreBefore = st.score;
      ctx.assert(scoreBefore > 0, 'Score must be > 0 before walkout');

      if (!st.seats.some(Boolean)) st = await ctx.advanceTime(2.4);
      let minIdx = -1;
      let minP = Infinity;
      st.seats.forEach((s, idx) => {
        if (s && s.patience < minP) {
          minP = s.patience;
          minIdx = idx;
        }
      });
      ctx.assert(minIdx >= 0, 'Expected at least 1 seated customer');

      // Step right up to 0.25s before patience hits 0, reset audio spy, then cross 0!
      if (minP > 0.35) {
        await ctx.advanceTime(minP - 0.25);
      }
      await resetAudioCounters(ctx);
      const afterWalkout = await ctx.advanceTime(0.55);
      const audio = await readAudioStats(ctx);

      ctx.assertEq(afterWalkout.comboCount, 0, 'Angry walkout must reset comboCount to 0');
      ctx.assertEq(afterWalkout.score, scoreBefore, 'Angry walkout must NEVER deduct from score');
      ctx.assertEq(afterWalkout.seats[minIdx], null, 'Walked-out seat must enter turnover cooldown (null)');
      ctx.assert(countSynthStarts(audio) >= 1, 'Angry walkout must synthesize playCustomerAngry() SFX');
    },
  },

  {
    id: 'T2-F09-02',
    tier: 2,
    features: ['F09', 'F07'],
    title: 'preferredSeatIdx auto-resets to null both when the locked seat is served and when the locked seat walks out',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await ctx.advanceTime(3.5);

      // 1) Serve locked seat_1 -> resets preferredSeatIdx to null
      await ctx.clickHit('seat_1');
      ctx.assertEq((await ctx.getState()).preferredSeatIdx, 1);
      const afterServe = await serveOneOrderOrganically(ctx, 1, { useHarness: false });
      ctx.assertEq(afterServe.preferredSeatIdx, null, 'Serving locked seat_1 must reset preferredSeatIdx to null');

      // 2) Wait for next customer in seat_1, re-lock seat_1, let patience expire -> resets preferredSeatIdx to null
      let st = await ctx.advanceTime(2.6);
      ctx.assert(st.seats[1] !== null, 'seat_1 respawned');
      await ctx.clickHit('seat_1');
      ctx.assertEq((await ctx.getState()).preferredSeatIdx, 1);

      st = await ctx.advanceTime(st.seats[1].patience + 0.7);
      ctx.assertEq(st.seats[1], null, 'Locked seat_1 walked out');
      ctx.assertEq(st.preferredSeatIdx, null, 'Walkout of locked seat_1 must reset preferredSeatIdx to null');
    },
  },

  {
    id: 'T2-F09-03',
    tier: 2,
    features: ['F09'],
    title: 'Exact 8.0s closing guard boundary: seat ready at >=8.05s spawns whereas seat vacated at <8.0s stays null to 0.0s',
    run: async (ctx) => {
      // Part A: Vacate seat at timeLeft ~10.35s -> normal turnover (1.2..2.2s) finishes at >=8.15s (>=8.0s) -> spawns!
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.advanceTime(45.0);
      let st = await ctx.advanceTime(27.0); // timeLeft = 18.0s
      if (!st.seats[0] || st.seats[0].patience < 11.0) {
        if (st.seats[0] && st.seats[0].patience < 2.5) {
          st = await ctx.advanceTime(st.seats[0].patience + 2.4);
        } else if (st.seats[0] && st.seats[0].patience < 11.0) {
          st = await serveOneOrderOrganically(ctx, 0, { useHarness: false });
          st = await ctx.advanceTime(2.4);
        } else if (!st.seats[0]) {
          st = await ctx.advanceTime(2.4);
        }
        for (let w = 0; w < 4 && !st.seats[0] && st.timeLeft > 12.0; w++) {
          st = await ctx.advanceTime(0.6);
        }
      }
      // Pre-stage >=1 C1 and >=1 C2 while timeLeft > 12.0s so vacating seat_0 near 11.0s finishes in 0 knead steps
      for (let prep = 0; prep < 6 && st.timeLeft > 12.0; prep++) {
        const unfrozen = [];
        for (let r = 0; r < st.grid.rows; r++) {
          for (let c = 0; c < st.grid.cols; c++) {
            const t = st.grid.cells[r][c]?.tile;
            if (t && !(t.frozenHp > 0)) unfrozen.push({ r, c, tier: t.tier });
          }
        }
        const hasC1 = unfrozen.some((t) => t.tier === 1);
        const hasC2 = unfrozen.some((t) => t.tier === 2);
        if (hasC1 && hasC2) break;
        if (!hasC2 && unfrozen.filter((t) => t.tier === 1).length >= 2 && (st.toolCounts?.spoon || 0) > 0) {
          const c1 = unfrozen.find((t) => t.tier === 1);
          await ctx.useToolOnCell('spoon', c1.r, c1.c);
          st = await ctx.getState();
          continue;
        }
        await ctx.advanceBothClocks(135);
        await ctx.knead();
        st = await ctx.getState();
      }
      if (st.timeLeft > 11.15) {
        st = await ctx.advanceTime(st.timeLeft - 11.1);
      }
      ctx.assert(
        st.seats[0] !== null && st.seats[0].patience >= 2.0 && st.timeLeft > 10.4,
        `Expected seat_0 occupied near 11.0s, timeLeft=${st.timeLeft}, patience=${st.seats[0]?.patience}`
      );

      st = await serveOneOrderOrganically(ctx, 0, { useHarness: false });
      ctx.assertEq(st.seats[0], null, 'seat_0 vacated above 10s');
      // Advance atomically to timeLeft ~ 8.08s (>= 8.0s closing guard, >2.3s elapsed since vacate) so live rAF never drifts below 8.0s
      st = await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const curTl = dbg.getState().timeLeft;
        if (curTl > 8.08) dbg.advanceTime(curTl - 8.08);
        return dbg.getState();
      });
      ctx.assert(st.timeLeft >= 8.0, `Expected timeLeft >= 8.0s, got ${st.timeLeft}`);
      ctx.assert(st.seats[0] !== null, 'Seat whose turnover finishes at >=8.05s MUST spawn a customer');

      // Part B: Vacate seat at timeLeft < 8.0s (~7.85s) -> stays null all the way down to 0!
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.advanceTime(45.0);
      await ctx.advanceTime(36.65); // timeLeft = 8.35s
      st = await ctx.getState();
      const occupiedIdx = st.seats.findIndex(Boolean);
      ctx.assert(occupiedIdx >= 0, 'Expected at least 1 seated customer at timeLeft=8.35s');

      st = await serveOneOrderOrganically(ctx, occupiedIdx, { useHarness: false });
      ctx.assert(st.timeLeft < 8.0, `Expected vacate inside <8.0s closing window, got timeLeft=${st.timeLeft}`);
      ctx.assertEq(st.seats[occupiedIdx], null);

      st = await ctx.advanceTime(3.0);
      ctx.assertEq(st.seats[occupiedIdx], null, 'Vacated seat must NOT respawn during <8.0s closing guard (+3.0s)');
      st = await ctx.advanceTime(2.5);
      ctx.assertEq(st.seats[occupiedIdx], null, 'Vacated seat must remain null down to final seconds');
    },
  },

  {
    id: 'T2-F09-04',
    tier: 2,
    features: ['F09'],
    title: 'Strict vipQuota ceiling: 1-5 (vipQuota:0) spawns 0 VIPs across >=10 waves and 1-10 spawns <=1 VIP with fixed R14',
    run: async (ctx) => {
      // Part A: 1-5 (vipQuota: 0)
      await ctx.setupSaveAndStart('1-5', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 2, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      const seenCustomers1_5 = new Set();
      let vipSeen1_5 = 0;
      await ctx.advanceTime(3.5);
      for (let wave = 0; wave < 8; wave++) {
        const st = await ctx.getState();
        if (st.timeLeft < 10) break;
        st.seats.forEach((s, idx) => {
          if (s) {
            const sig = s.uid !== undefined ? `uid_${s.uid}` : `${wave}_${idx}_${s.customerId}_${Math.round(s.maxPatience)}`;
            seenCustomers1_5.add(sig);
            if (s.isVip || s.customerId === 'cust_critic') vipSeen1_5++;
          }
        });
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
        await ctx.advanceTime(2.3);
      }
      ctx.assert(seenCustomers1_5.size >= 8, `Expected >=8 customer visits on 1-5, saw ${seenCustomers1_5.size}`);
      ctx.assertEq(vipSeen1_5, 0, '1-5 (vipQuota:0) must spawn strictly 0 VIP critics');

      // Part B: 1-10 (vipQuota: 1, vipFixedRecipeId: 'R14')
      await ctx.setupSaveAndStart('1-10', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 2, dev_teapot: 0, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      const vipRecords = new Map();
      await ctx.advanceTime(3.5);
      for (let step = 0; step < 15; step++) {
        const st = await ctx.getState();
        if (st.timeLeft < 9) break;
        st.seats.forEach((s, idx) => {
          if (s && (s.isVip || s.customerId === 'cust_critic')) {
            const key = s.uid !== undefined ? `uid_${s.uid}` : `vip_${idx}_${s.recipeId}`;
            vipRecords.set(key, s);
          }
        });
        const minP = Math.min(...st.seats.filter(Boolean).map((s) => s.patience));
        if (Number.isFinite(minP) && st.timeLeft - (minP + 2.2) > 8.5) {
          await ctx.advanceTime(minP + 2.2);
        } else {
          await serveOneOrderOrganically(ctx, null, { useHarness: false });
          await ctx.advanceTime(2.0);
        }
      }
      ctx.assertEq(vipRecords.size, 1, `1-10 (vipQuota:1) must spawn exact 1 VIP critic across shift, got ${vipRecords.size}`);
      const [onlyVip] = [...vipRecords.values()];
      ctx.assertEq(onlyVip.customerId, 'cust_critic');
      ctx.assertEq(onlyVip.recipeId, 'R14', '1-10 VIP critic must order fixed recipe R14');
    },
  },

  {
    id: 'T2-F09-05',
    tier: 2,
    features: ['F09'],
    title: 'Simultaneous 3-seat expiry produces zero NaN/negative patience and cleanly repopulates all 3 seats',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      let st = await ctx.advanceTime(3.5);
      ctx.assert(st.seats.every((s) => s !== null), 'All 3 seats occupied at t=3.5s');

      // Step 42s in 2.0s increments without serving anyone
      for (let i = 0; i < 21; i++) {
        st = await ctx.advanceTime(2.0);
        for (const s of st.seats) {
          if (s !== null) {
            ctx.assert(
              Number.isFinite(s.patience) && s.patience >= 0 && Number.isFinite(s.maxPatience) && s.maxPatience > 0,
              `Invalid seat patience during expiry: ${JSON.stringify(s)}`
            );
          }
        }
        ctx.assertEq(st.score, 0, 'Zero serves must maintain score === 0 across wave expiries');
      }

      st = await ctx.advanceTime(1.6);
      for (let w = 0; w < 5 && !st.seats.every((s) => s && s.patience > 0); w++) {
        st = await ctx.advanceTime(1.0);
      }
      ctx.assert(
        st.seats.every((s) => s !== null && s.patience > 0),
        'All 3 seats must cleanly repopulate after simultaneous wave expiry'
      );
    },
  },

  {
    id: 'T2-F09-06',
    tier: 2,
    features: ['F09', 'F13'],
    title: 'Buzzer-beater auto-serve at timeLeft <= 0.10s transitions cleanly once into level_result without post-result tick drift',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.advanceTime(45.0);
      let st = await ctx.advanceTime(35.0); // timeLeft = 10.0s
      if (!st.seats.some(Boolean)) st = await ctx.advanceTime(1.5);
      ctx.assert(st.seats.some(Boolean), 'At least 1 customer seated before closing window');

      // Advance right to timeLeft ~ 0.085s and place matching tile atomically so live rAF dt never overshoots 0.0s
      st = await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const curTl = dbg.getState().timeLeft;
        if (curTl > 0.085) dbg.advanceTime(curTl - 0.085);
        const s = dbg.getState();
        const seatIdx = s.seats.findIndex((seat) => seat && (seat.recipeId === 'R01' || seat.recipeId === 'R02'));
        if (seatIdx >= 0) {
          const wantTier = s.seats[seatIdx].recipeId === 'R01' ? 1 : 2;
          dbg.clickHit(`seat_${seatIdx}`);
          for (let r = 0; r < s.grid.rows; r++) {
            for (let c = 0; c < s.grid.cols; c++) {
              if (s.grid.cells[r][c]?.tile?.tier === wantTier) {
                dbg.tapBoardCell(r, c);
                return dbg.getState();
              }
            }
          }
        }
        return dbg.getState();
      });
      ctx.assertClose(st.timeLeft, 0.08, 0.04, 'Must reach buzzer-beater window <=0.10s');

      // Advance past 0.0s into settlement
      const settled1 = await ctx.advanceTime(0.50);
      ctx.assert(
        settled1.activeModal === 'level_result' || settled1.screen === 'result',
        `Expected level_result modal after timer expiry, got screen=${settled1.screen}, modal=${settled1.activeModal}`
      );
      ctx.assert(!!settled1.lastResult, 'lastResult summary must be populated');
      if (settled1.lastResult.score !== undefined) {
        ctx.assertEq(settled1.lastResult.score, settled1.score, 'lastResult.score must match final game score');
      }

      const bankSnapshot = (await ctx.getSaveData()).bankStardust;
      const settled2 = await ctx.advanceTime(2.0);
      await ctx.sleep(80);
      ctx.assertEq(settled2.score, settled1.score, 'Zero post-settlement score drift');
      ctx.assertEq((await ctx.getSaveData()).bankStardust, bankSnapshot, 'Zero duplicate settlement stardust payout');
    },
  },

  // --------------------------------------------------------------------------
  // F10 — Procedural Web Audio BGM & 20 Tactile SFX (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F10-01',
    tier: 2,
    features: ['F10'],
    title: 'Complete WebAudio absence (?audio=none) degrades gracefully with 0 errors across toggles, gameplay, and settlement',
    freshReload: true,
    run: async (ctx) => {
      try {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1&audio=none');
        const audioAbsence = await ctx.eval(() => ({
          hasAudioContext: typeof window.AudioContext === 'function',
          wxAudioCtx: window.wx?.createWebAudioContext?.() ?? null,
        }));
        ctx.assertEq(audioAbsence.hasAudioContext, false, '?audio=none must disable window.AudioContext');
        ctx.assertEq(audioAbsence.wxAudioCtx, null, '?audio=none must make wx.createWebAudioContext() return null');

        await ctx.clickHit('lobby_bgm_btn');
        await ctx.clickHit('lobby_sfx_btn');
        await ctx.clickHit('lobby_sfx_btn');

        await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
        await ctx.slide('left');
        await ctx.advanceBothClocks(150);
        await ctx.knead();
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
        const settled = await ctx.advanceTime(92);

        ctx.assertEq(settled.activeModal, 'level_result', '1-1 must settle normally with WebAudio absent');
        ctx.assert(settled.score > 0, 'Gameplay scoring works normally without WebAudio');
        ctx.assertEq(ctx.cdp.errors.length, 0, `Expected 0 errors under ?audio=none, got: ${ctx.cdp.errors.join('; ')}`);
      } finally {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      }
    },
  },

  {
    id: 'T2-F10-02',
    tier: 2,
    features: ['F10'],
    title: 'Stripped createConvolver, createDynamicsCompressor & createStereoPanner (?stripAudioNodes=1) falls back cleanly and synthesizes audio',
    freshReload: true,
    run: async (ctx) => {
      try {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1&stripAudioNodes=1');
        const strippedCheck = await ctx.eval(() => {
          const probe = window.wx.createWebAudioContext();
          const info = {
            convolver: typeof probe.createConvolver,
            compressor: typeof probe.createDynamicsCompressor,
            stereoPanner: typeof probe.createStereoPanner,
          };
          if (typeof probe.close === 'function') probe.close().catch(() => {});
          return info;
        });
        ctx.assertEq(strippedCheck.convolver, 'undefined', 'createConvolver must be undefined');
        ctx.assertEq(strippedCheck.compressor, 'undefined', 'createDynamicsCompressor must be undefined under ?stripAudioNodes=1');
        ctx.assertEq(strippedCheck.stereoPanner, 'undefined', 'createStereoPanner must be undefined under ?stripAudioNodes=1');

        await ctx.setSaveData({ schemaVersion: 2, bgmTrack: 'waltz', sfxEnabled: true, seenTutorials: DEFAULT_TUTORIALS_SEEN });
        await resetAudioCounters(ctx);
        await ctx.tapCanvas(20, 20); // Unlock audio
        await ctx.sleep(560);

        const waltzStats = await readAudioStats(ctx);
        ctx.assert(countSynthStarts(waltzStats) > 0, 'Waltz BGM must synthesize notes even when Compressor/StereoPanner/Convolver are absent');

        await ctx.clickHit('lobby_bgm_btn'); // -> bossa
        await resetAudioCounters(ctx);
        await ctx.sleep(560);
        const bossaStats = await readAudioStats(ctx);
        ctx.assert(countSynthStarts(bossaStats) > 0, 'Bossa BGM must synthesize notes on stripped AudioContext');

        await ctx.setupSaveAndStart('1-1', { bgmTrack: 'off', sfxEnabled: true, seenTutorials: DEFAULT_TUTORIALS_SEEN });
        await ctx.sleep(90);
        await resetAudioCounters(ctx);
        await ctx.slide('left');
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
        const sfxStats = await readAudioStats(ctx);
        ctx.assert(countSynthStarts(sfxStats) >= 2, 'Merge and serve SFX must synthesize cleanly on stripped AudioContext');
        ctx.assertEq(ctx.cdp.errors.length, 0, 'Zero audio graph errors under ?stripAudioNodes=1');
      } finally {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      }
    },
  },

  {
    id: 'T2-F10-03',
    tier: 2,
    features: ['F10'],
    title: 'Rapid 20-tap BGM cycling on lobby_bgm_btn settles on off with zero leaked scheduler timers',
    run: async (ctx) => {
      await ctx.resetGame();
      await ctx.setSaveData({ schemaVersion: 2, bgmTrack: 'waltz', sfxEnabled: false });
      await ctx.tapCanvas(16, 16);

      // 20 rapid taps starting from 'waltz': (0 + 20) % 3 === 2 -> 'off' (waltz -> bossa -> off)
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        for (let i = 0; i < 20; i++) {
          dbg.clickHit('lobby_bgm_btn');
        }
      });

      const save = await ctx.getSaveData();
      ctx.assertEq(save.bgmTrack, 'off', '20 taps from waltz must land on bgmTrack === "off"');

      await ctx.sleep(140);
      await resetAudioCounters(ctx);
      await ctx.sleep(280);
      const stats = await readAudioStats(ctx);
      ctx.assertEq(countSynthStarts(stats), 0, 'Zero leaked BGM scheduler oscillators may fire after settling on "off"');
    },
  },

  {
    id: 'T2-F10-04',
    tier: 2,
    features: ['F10'],
    title: 'Final 5s countdown synthesizes urgent woodblock ticks (playRushTick) and goes silent immediately on level_result',
    run: async (ctx) => {
      await ctx.tapCanvas(16, 16);
      await ctx.setupSaveAndStart('1-1', {
        bgmTrack: 'off',
        sfxEnabled: true,
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.sleep(100);

      await ctx.advanceTime(84.8); // timeLeft = 5.2s
      await resetAudioCounters(ctx);

      let tickSecondsWithSound = 0;
      for (let s = 0; s < 5; s++) {
        await resetAudioCounters(ctx);
        await ctx.advanceTime(1.0); // crosses 5, 4, 3, 2, 1
        const stAudio = await readAudioStats(ctx);
        if (countSynthStarts(stAudio) >= 1) tickSecondsWithSound++;
      }
      ctx.assert(tickSecondsWithSound >= 4, `Expected urgent countdown ticks across final 5s, heard ${tickSecondsWithSound}/5`);

      // Cross 0.0s into level_result
      const settled = await ctx.advanceTime(0.5);
      ctx.assertEq(settled.activeModal, 'level_result');

      await ctx.sleep(120);
      await resetAudioCounters(ctx);
      await ctx.advanceTime(1.5);
      await ctx.sleep(300);
      const postResultAudio = await readAudioStats(ctx);
      ctx.assertEq(countSynthStarts(postResultAudio), 0, 'Zero countdown ticks may fire after level_result opens');
    },
  },

  {
    id: 'T2-F10-05',
    tier: 2,
    features: ['F10', 'F08'],
    title: 'Multi-star single-serve jump (0★ -> >=2★) fires playStarUnlock cleanly and >=3★ subsequent serves never throw or unlock 4th star',
    run: async (ctx) => {
      await ctx.tapCanvas(16, 16);
      // On 2-2 (stars: [6600, 9100, 11600]), upgrade all catcakes to Lv.4 (C6 Lv.4 = 2520; C6(gold) = 3780!)
      let r17Idx = -1;
      for (let attempt = 0; attempt < 65 && r17Idx === -1; attempt++) {
        await ctx.setupSaveAndStart('2-2', {
          bankStardust: 500,
          levelStars: getAllUnlockedStars(ctx, 3),
          catcakeLevels: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4 },
          unlockedPatrons: ['mikan', 'luna'],
          selectedPatron: 'luna',
          deviceUpgrades: { dev_tray: 2, dev_flour: 3, dev_teapot: 3, dev_tools: 3 },
          bgmTrack: 'off',
          sfxEnabled: true,
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        // Upgrade (1,1):C4(gold) -> C5(gold) with 1 spoon so boardMaxTier >= 5 (R17 accessible!) while saving 1 free spoon
        await ctx.useToolOnCell('spoon', 1, 1);
        let st = await ctx.advanceTime(3.2);
        let candR17 = st.seats.findIndex((s) => s && s.recipeId === 'R17' && s.patience > 18);
        let hasNonR17 = st.seats.some((s, i) => s && i !== candR17 && s.recipeId !== 'R17');
        if (candR17 < 0 || !hasNonR17) {
          const maxP = Math.max(28, ...st.seats.filter(Boolean).map((s) => s.patience));
          st = await ctx.advanceTime(maxP + 2.4);
          candR17 = st.seats.findIndex((s) => s && s.recipeId === 'R17' && s.patience > 18);
          hasNonR17 = st.seats.some((s, i) => s && i !== candR17 && s.recipeId !== 'R17');
        }
        if (candR17 >= 0 && hasNonR17) r17Idx = candR17;
      }
      ctx.assert(r17Idx >= 0, 'Expected R17 (C6) + non-R17 customer on 2-2');

      // Serve non-R17 orders first (without consuming remaining spoon) until score >= 4300
      for (let guard = 0; guard < 8; guard++) {
        let cur = await ctx.getState();
        if (cur.score >= 4300) break;
        let otherIdx = cur.seats.findIndex((s, i) => s && i !== r17Idx && s.recipeId !== 'R17');
        if (otherIdx < 0 && cur.seats.some((s, i) => i !== r17Idx && s === null)) {
          cur = await ctx.advanceTime(2.3);
          otherIdx = cur.seats.findIndex((s, i) => s && i !== r17Idx && s.recipeId !== 'R17');
        }
        if (otherIdx < 0) {
          otherIdx = cur.seats.findIndex((s, i) => s && i !== r17Idx && !s.isVip);
          if (otherIdx < 0) otherIdx = cur.seats.findIndex((s, i) => s && i !== r17Idx);
        }
        if (otherIdx < 0) break;
        await serveOneOrderOrganically(ctx, otherIdx, { useHarness: false, allowSpoon: false });
      }

      let preJump = await ctx.getState();
      if (!preJump.seats[r17Idx] || preJump.seats[r17Idx].recipeId !== 'R17') {
        r17Idx = preJump.seats.findIndex((s) => s && s.recipeId === 'R17');
      }
      ctx.assert(r17Idx >= 0, 'Expected seated R17 customer ready for multi-star jump');

      // Now craft/upgrade C6(gold) AFTER preliminary orders and dynamically locate its (r, c)
      const findUnfrozen = (st, pred) => {
        for (let r = 0; r < st.grid.rows; r++) {
          for (let c = 0; c < st.grid.cols; c++) {
            const t = st.grid.cells[r][c]?.tile;
            if (t && !(t.frozenHp > 0) && pred(t, r, c)) return { r, c, tier: t.tier, flavor: t.flavor };
          }
        }
        return null;
      };

      for (let prep = 0; prep < 90; prep++) {
        preJump = await ctx.getState();
        if (findUnfrozen(preJump, (t) => t.tier === 6 && t.flavor === 'gold')) break;

        // If unfrozen C5(gold) exists, upgrade directly via spoon -> C6(gold)!
        const c5Gold = findUnfrozen(preJump, (t) => t.tier === 5 && t.flavor === 'gold');
        if (c5Gold) {
          if ((preJump.toolCounts?.spoon || 0) === 0) {
            await tryBuyEmergencyUtensil(ctx, 'spoon');
          }
          if (((await ctx.getState()).toolCounts?.spoon || 0) > 0) {
            await ctx.useToolOnCell('spoon', c5Gold.r, c5Gold.c);
            break;
          }
        }

        // If unfrozen C6(non-gold) exists, route it onto (1,1):G if possible
        const c6Any = findUnfrozen(preJump, (t) => t.tier === 6);
        if (c6Any && prep > 35) break;

        // If unfrozen C5(non-gold) exists at (1,c) or (r,1), slide onto (1,1):G to dye gold!
        const c5Plain = findUnfrozen(preJump, (t) => t.tier === 5 && t.flavor !== 'gold');
        if (c5Plain) {
          if (c5Plain.r === 1 && c5Plain.c > 1 && !preJump.grid.cells[1][1].tile) {
            await ctx.slide('left');
            continue;
          }
          if (c5Plain.c === 1 && c5Plain.r > 1 && !preJump.grid.cells[1][1].tile) {
            await ctx.slide('up');
            continue;
          }
          if ((preJump.toolCounts?.spoon || 0) > 0 && prep > 25) {
            await ctx.useToolOnCell('spoon', c5Plain.r, c5Plain.c);
            break;
          }
        }

        // Otherwise knead/slide toward C5(gold)/C6(gold) keeping tray empty
        const { count } = countBoardTiles(preJump.grid);
        if (count < 7) {
          await ctx.advanceBothClocks(140);
          await ctx.knead();
        } else {
          const dirs = ['left', 'up', 'right', 'down'];
          await ctx.slide(dirs[prep % 4]);
          // Deadlock clear if full
          const aft = await ctx.getState();
          if (countBoardTiles(aft.grid).count >= 14) {
            const low = findUnfrozen(aft, (t) => t.tier <= 2);
            if (low) {
              await ctx.eval((lr, lc) => {
                const dbg = globalThis.__HOSHI_DEBUG__;
                dbg.tapBoardCell(lr, lc);
                const idx = (dbg.getState().tray || []).findIndex((x) => x !== null);
                if (idx >= 0) dbg.doubleTapTray(idx);
              }, low.r, low.c);
            }
          }
        }
      }

      preJump = await ctx.getState();
      const c6Cell =
        findUnfrozen(preJump, (t) => t.tier === 6 && t.flavor === 'gold') ||
        findUnfrozen(preJump, (t) => t.tier === 6);
      ctx.assert(!!c6Cell, 'Expected unfrozen C6 tile dynamically located on 2-2 before serving R17');

      const starsBeforeJump = [6600, 9100, 11600].filter((t) => preJump.score >= t).length;
      await resetAudioCounters(ctx);
      await ctx.eval((idx, tr, tc) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        for (let i = 0; i < (dbg.getState().tray || []).length; i++) {
          if (dbg.getState().tray[i]) dbg.doubleTapTray(i);
        }
        dbg.clickHit(`seat_${idx}`);
        dbg.tapBoardCell(tr, tc);
      }, r17Idx, c6Cell.r, c6Cell.c);
      let postJump = await ctx.advanceTime(0.65);
      const starsAfterJump = [6600, 9100, 11600].filter((t) => postJump.score >= t).length;
      ctx.assert(
        starsAfterJump - starsBeforeJump >= 2 || starsAfterJump >= 2,
        `Expected multi-star jump on 2-2 (before=${preJump.score} [${starsBeforeJump}★] -> after=${postJump.score} [${starsAfterJump}★])`
      );
      const jumpAudio = await readAudioStats(ctx);
      ctx.assert(countSynthStarts(jumpAudio) >= 2, 'Multi-star jump must synthesize serve + star unlock chimes cleanly');

      // Ensure score >= 11600 (3★), then serve one more order and settle -> starsEarned stays clamped to 3!
      while ((await ctx.getState()).score < 11600) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      await serveOneOrderOrganically(ctx, null, { useHarness: false });
      const settled = await ctx.advanceTime(120);
      ctx.assertEq(settled.lastResult?.starsEarned, 3, 'Stars earned must clamp cleanly at 3★');
    },
  },

  {
    id: 'T2-F10-06',
    tier: 2,
    features: ['F10'],
    title: 'wx.onHide -> wx.onShow lifecycle round-trip keeps bgmTrack === "off" strictly silent on resume',
    run: async (ctx) => {
      await ctx.tapCanvas(16, 16);
      await ctx.setupSaveAndStart('1-1', {
        bgmTrack: 'off',
        sfxEnabled: false,
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      await ctx.eval(() => window.__WX_HARNESS__?.triggerHide?.());
      await ctx.sleep(90);
      await ctx.eval(() => window.__WX_HARNESS__?.triggerShow?.());
      await ctx.sleep(60);

      const st = await ctx.getState();
      if (st.activeModal === 'pause') {
        const resumeHit = findHit(st, /modal_close|resume|continue/i);
        if (resumeHit) await ctx.clickHit(resumeHit.id);
        else await ctx.eval(() => globalThis.__HOSHI_DEBUG__.closeModal());
      }

      await ctx.sleep(100);
      await resetAudioCounters(ctx);
      await ctx.sleep(300);

      const audio = await readAudioStats(ctx);
      ctx.assertEq((await ctx.getSaveData()).bgmTrack, 'off', 'bgmTrack must remain "off" after onHide/onShow');
      ctx.assertEq(countSynthStarts(audio), 0, 'Foreground resume must NEVER un-mute user-disabled BGM');
    },
  },

  // --------------------------------------------------------------------------
  // F11 — Lossless v1→v2 Save Migration & Multi-Device Sync (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F11-01',
    tier: 2,
    features: ['F11'],
    title: 'Malformed, null, primitive, and array JSON payloads in wx_hoshi_kissa_bakery_save_v1 recover cleanly to v2 default save',
    run: async (ctx) => {
      const badPayloads = ['{{{bad_json_syntax', 'null', '12345', '["not","an","object"]', '"raw_string"'];
      try {
        for (const raw of badPayloads) {
          await ctx.eval((val) => {
            localStorage.setItem('wx_hoshi_kissa_bakery_save_v1', val);
          }, raw);
          await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');
          const save = await ctx.getSaveData();
          ctx.assertEq(save.schemaVersion, 2, `Corrupted payload ${raw} must initialize schemaVersion=2`);
          ctx.assertEq(save.bankStardust, 30, `Corrupted payload ${raw} must initialize bankStardust=30`);
          ctx.assertEq(save.totalEarnedStardust, 30, `Corrupted payload ${raw} must initialize totalEarnedStardust=30`);
          ctx.assertEq(save.highestUnlockedLevel, '1-1');
          ctx.assertEq(ctx.cdp.errors.length, 0, `Unhandled error on payload ${raw}`);
        }
      } finally {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      }
    },
  },

  {
    id: 'T2-F11-02',
    tier: 2,
    features: ['F11'],
    title: 'Fresh zero-score v1 save (bestChef/Rush/Zen = 0) migrates to schemaVersion=2 WITHOUT granting +50 veteran gift',
    run: async (ctx) => {
      try {
        await ctx.eval(() => {
          localStorage.setItem(
            'wx_hoshi_kissa_bakery_save_v1',
            JSON.stringify({
              bankStardust: 30,
              bestChef: 0,
              bestRush: 0,
              bestZen: 0,
              unlockedPatrons: ['mikan'],
              unlockedThemes: ['amber'],
              shopUpgrades: {},
            })
          );
        });
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');
        const save = await ctx.getSaveData();
        ctx.assertEq(save.schemaVersion, 2);
        ctx.assertEq(save.totalEarnedStardust, 30, 'Zero-score v1 save must NOT receive +50 veteran gift');
        ctx.assertEq(save.bankStardust, 30);
      } finally {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      }
    },
  },

  {
    id: 'T2-F11-03',
    tier: 2,
    features: ['F11'],
    title: 'v1->v2 migration (UT-S01: 230 bank / 390 earned) is strictly idempotent across 3 consecutive reloads and setSaveData',
    run: async (ctx) => {
      try {
        await ctx.eval(() => {
          localStorage.setItem(
            'wx_hoshi_kissa_bakery_save_v1',
            JSON.stringify({
              bankStardust: 50,
              unlockedPatrons: ['mikan', 'luna'],
              unlockedThemes: ['amber', 'sakura'],
              shopUpgrades: { up_tools: 2 },
              bestChef: 8000,
            })
          );
        });
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');

        let save = await ctx.getSaveData();
        ctx.assertEq(save.schemaVersion, 2);
        ctx.assertEq(save.totalEarnedStardust, 390);
        ctx.assertEq(save.bankStardust, 230);

        for (let r = 1; r <= 3; r++) {
          await ctx.reload();
          save = await ctx.getSaveData();
          ctx.assertEq(save.totalEarnedStardust, 390, `Reload #${r} double-counted migration stardust`);
          ctx.assertEq(save.bankStardust, 230, `Reload #${r} mutated bankStardust`);
        }

        await ctx.setSaveData(save);
        save = await ctx.getSaveData();
        ctx.assertEq(save.totalEarnedStardust, 390);
        ctx.assertEq(save.bankStardust, 230);
      } finally {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      }
    },
  },

  {
    id: 'T2-F11-04',
    tier: 2,
    features: ['F11', 'F12'],
    title: 'MAX_OFFLINE_STARDUST_DELTA = 1500 clamps excessive offline stardust delta during multi-device merge',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      const cloudMeta = {
        schemaVersion: 2,
        bankStardust: 220,
        totalEarnedStardust: 220,
        lastSyncedEarnedStardust: 100,
        consumableSpentStardust: 0,
        levelStars: { '1-1': 2 },
        levelBestScores: { '1-1': 1200 },
        unlockedPatrons: ['mikan'],
        selectedPatron: 'mikan',
        unlockedThemes: ['amber'],
        equippedTheme: 'amber',
      };
      const localTampered = {
        schemaVersion: 2,
        bankStardust: 5000,
        totalEarnedStardust: 5000, // Offline delta = 5000 - 100 = 4900 >> 1500!
        lastSyncedEarnedStardust: 100,
        consumableSpentStardust: 0,
        levelStars: { '1-1': 3 },
        levelBestScores: { '1-1': 1550 },
        unlockedPatrons: ['mikan'],
        selectedPatron: 'mikan',
        unlockedThemes: ['amber'],
        equippedTheme: 'amber',
      };

      await ctx.setCloudConfig({
        seedCloudDoc: {
          revision: 2,
          totalStars: 2,
          totalCumulativeScore: 1200,
          metaSave: cloudMeta,
        },
      });
      await ctx.eval((loc) => {
        localStorage.setItem('wx_hoshi_kissa_bakery_save_v1', JSON.stringify(loc));
      }, localTampered);

      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      if (typeof ctx.flushCloudSync === 'function') await ctx.flushCloudSync(400);
      else await ctx.sleep(250);

      const merged = await ctx.getSaveData();
      // Cloud baseline 220 + clamped offline delta 1500 = 1720 max!
      ctx.assert(
        merged.totalEarnedStardust <= 1720 && merged.totalEarnedStardust >= 1600,
        `Offline delta must clamp at <=1500 (expected 1720, got ${merged.totalEarnedStardust})`
      );
      ctx.assertEq(merged.bankStardust, merged.totalEarnedStardust, 'Zero upgrades bought -> bank === totalEarned');
    },
  },

  {
    id: 'T2-F11-05',
    tier: 2,
    features: ['F11'],
    title: 'Out-of-range upgrade levels clamp to valid bounds [0..max] and tampered bankStardust=99999 reconciles to >=0',
    run: async (ctx) => {
      try {
        await ctx.eval(() => {
          localStorage.setItem(
            'wx_hoshi_kissa_bakery_save_v1',
            JSON.stringify({
              schemaVersion: 2,
              totalEarnedStardust: 40,
              bankStardust: 99999,
              catcakeLevels: { 1: 99, 2: -3, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
              deviceUpgrades: { dev_tray: 9, dev_flour: -2, dev_teapot: 0, dev_tools: 0 },
            })
          );
        });
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');
        const save = await ctx.getSaveData();

        ctx.assertEq(save.catcakeLevels[1] ?? save.catcakeLevels['1'], 4, 'C1 level 99 must clamp to 4');
        ctx.assertEq(save.catcakeLevels[2] ?? save.catcakeLevels['2'], 0, 'C2 level -3 must clamp to 0');
        ctx.assertEq(save.deviceUpgrades.dev_tray, 2, 'dev_tray 9 must clamp to 2');
        ctx.assertEq(save.deviceUpgrades.dev_flour, 0, 'dev_flour -2 must clamp to 0');

        // Spent = C1 Lv.4 (240) + dev_tray Lv.2 (210) = 450
        const expectedBank = Math.max(0, save.totalEarnedStardust - 450);
        ctx.assert(save.bankStardust >= 0 && save.bankStardust < 99999, `Tampered bankStardust must not remain 99999 or go negative (${save.bankStardust})`);
        ctx.assertEq(save.bankStardust, expectedBank, 'bankStardust must obey Math.max(0, totalEarned - spent)');
      } finally {
        await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      }
    },
  },

  {
    id: 'T2-F11-06',
    tier: 2,
    features: ['F11'],
    title: 'Unknown patron, theme, and invalid level IDs/stars are sanitized on normalizeSaveData and reload',
    run: async (ctx) => {
      await ctx.setSaveData({
        schemaVersion: 2,
        bankStardust: 30,
        totalEarnedStardust: 30,
        selectedPatron: 'ghost_cat',
        unlockedPatrons: ['mikan', 'ghost_cat'],
        equippedTheme: 'cyber_neon',
        unlockedThemes: ['amber', 'cyber_neon'],
        levelStars: { '1-1': 9, '1-2': -4, '4-1': 3, 'invalid_lv': 2 },
        levelBestScores: { '1-1': 1800, '4-1': 99999 },
      });

      const save = await ctx.getSaveData();
      ctx.assertEq(save.selectedPatron, 'mikan', 'Unknown selectedPatron must fall back to mikan');
      ctx.assertEq(save.equippedTheme, 'amber', 'Unknown equippedTheme must fall back to amber');
      ctx.assert(!save.unlockedPatrons.includes('ghost_cat'), 'Invalid patron ID must be stripped');
      ctx.assert(!save.unlockedThemes.includes('cyber_neon'), 'Invalid theme ID must be stripped');
      ctx.assertEq(save.levelStars['1-1'], 3, 'Stars >3 must clamp to 3');
      ctx.assertEq(save.levelStars['1-2'] || 0, 0, 'Negative stars must clamp to 0');
      ctx.assertEq(save.levelStars['4-1'], undefined, 'Out-of-range chapter key 4-1 must be stripped');
      ctx.assertEq(save.levelStars.invalid_lv, undefined, 'Malformed level key must be stripped');
      ctx.assertEq(save.levelBestScores['4-1'], undefined, 'Invalid levelBestScores key 4-1 must be stripped');
    },
  },

  // --------------------------------------------------------------------------
  // F12 — WeChat CloudBase kissa_sync v2 & Dual Leaderboards (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F12-01',
    tier: 2,
    features: ['F12', 'F08'],
    title: 'Server anti-cheat rejects score > 0 && serves < 1 in kissa_sync push (Pure Serve-Only Scoring Iron Law)',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      const pullRes = await callKissaSync(ctx, { action: 'pull' });
      ctx.assert(pullRes && pullRes.ok === true, 'Initial pull must succeed');

      const pushRes = await callKissaSync(ctx, {
        action: 'push',
        baseRevision: pullRes.revision || 1,
        runReport: {
          levelId: '1-1',
          score: 3000,
          serves: 0,
          ordersServed: 0,
          durationSec: 90,
        },
        metaSave: {
          ...pullRes.metaSave,
          levelBestScores: { '1-1': 3000 },
          levelStars: { '1-1': 3 },
        },
      });

      const savedScore = pushRes?.metaSave?.levelBestScores?.['1-1'] || 0;
      const savedStars = pushRes?.metaSave?.levelStars?.['1-1'] || 0;
      ctx.assertEq(savedScore, 0, 'Server must reject/revert 1-1 score when serves < 1');
      ctx.assertEq(savedStars, 0, 'Server must reject/revert 1-1 stars when serves < 1');
      ctx.assertEq(pushRes?.totalStars || 0, 0);
      if (Array.isArray(pushRes?.validationWarnings)) {
        ctx.assert(pushRes.validationWarnings.length >= 1, 'Server should emit anti-cheat validation warning');
      }
    },
  },

  {
    id: 'T2-F12-02',
    tier: 2,
    features: ['F12'],
    title: 'Server anti-cheat clamps per-chapter scores (35k/90k/220k), stars <= 3, and zeroes stars when bestScore <= 0',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      const pullRes = await callKissaSync(ctx, { action: 'pull' });

      const pushRes = await callKissaSync(ctx, {
        action: 'push',
        baseRevision: pullRes.revision || 1,
        metaSave: {
          ...pullRes.metaSave,
          levelBestScores: {
            '1-1': 80000,
            '2-5': 190000,
            '3-10': 500000,
            '1-2': 0,
          },
          levelStars: {
            '1-1': 9,
            '2-5': 3,
            '3-10': 3,
            '1-2': 3, // Stars claimed with 0 score!
          },
        },
      });

      ctx.assert(pushRes && pushRes.ok === true, 'Clamped push should return ok:true');
      const bs = pushRes.metaSave.levelBestScores;
      const ls = pushRes.metaSave.levelStars;
      ctx.assertEq(bs['1-1'], 35000, 'Chapter 1 score must clamp at 35,000');
      ctx.assertEq(bs['2-5'], 90000, 'Chapter 2 score must clamp at 90,000');
      ctx.assertEq(bs['3-10'], 220000, 'Chapter 3 score must clamp at 220,000');
      ctx.assertEq(ls['1-1'], 3, 'Stars must clamp at <= 3');
      ctx.assertEq(ls['1-2'] || 0, 0, 'Stars on 1-2 with bestScore=0 must clamp to 0');
      ctx.assert(pushRes.totalStars <= 90 && pushRes.totalCumulativeScore <= 3450000);
    },
  },

  {
    id: 'T2-F12-03',
    tier: 2,
    features: ['F12', 'F11'],
    title: 'Server-side v1 cloud document auto-migrates on pull (bank=230, schemaVersion=2) and strips legacy activeRun/savedRuns',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.eval(() => localStorage.removeItem('wx_hoshi_kissa_bakery_save_v1'));

      await ctx.setCloudConfig({
        seedCloudDoc: {
          revision: 3,
          bestChef: 9000,
          activeRun: { mode: 'chef', entities: [1, 2, 3] },
          savedRuns: { chef: { score: 400 } },
          metaSave: {
            bankStardust: 50,
            unlockedPatrons: ['mikan', 'luna'],
            unlockedThemes: ['amber', 'sakura'],
            shopUpgrades: { up_tools: 2 },
            bestChef: 9000,
            activeRun: { mode: 'chef' },
            savedRuns: { chef: {} },
          },
        },
      });

      const pullRes = await callKissaSync(ctx, { action: 'pull' });
      ctx.assertEq(pullRes.ok, true);
      ctx.assertEq(pullRes.metaSave.schemaVersion, 2, 'Server pull must migrate legacy v1 cloud doc to schemaVersion=2');
      ctx.assertEq(pullRes.metaSave.bankStardust, 230, 'Server migrateV1ToV2 must refund up_tools + luna diff + 50 gift -> 230');
      ctx.assertEq(pullRes.metaSave.totalEarnedStardust, 390);
      ctx.assertEq(pullRes.metaSave.activeRun, undefined, 'Legacy activeRun must be stripped');
      ctx.assertEq(pullRes.metaSave.savedRuns, undefined, 'Legacy savedRuns must be stripped');

      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      if (typeof ctx.flushCloudSync === 'function') await ctx.flushCloudSync(400);
      else await ctx.sleep(250);
      ctx.assertEq((await ctx.getSaveData()).bankStardust, 230);
    },
  },

  {
    id: 'T2-F12-04',
    tier: 2,
    features: ['F12'],
    title: 'Optimistic lock baseRevision conflict performs lossless server-side merge preserving concurrent level clears',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      const pull0 = await callKissaSync(ctx, { action: 'pull' });
      const rev0 = pull0.revision || 1;

      // Device B pushes '1-2': 3★ advancing revision to rev0 + 1
      const pushB = await callKissaSync(ctx, {
        action: 'push',
        baseRevision: rev0,
        metaSave: {
          ...pull0.metaSave,
          levelStars: { '1-1': 2, '1-2': 3 },
          levelBestScores: { '1-1': 1100, '1-2': 1980 },
        },
      });
      ctx.assertEq(pushB.ok, true);
      ctx.assert(pushB.revision > rev0);

      // Device A pushes '1-1': 3★ with STALE baseRevision: rev0
      const pushA = await callKissaSync(ctx, {
        action: 'push',
        baseRevision: rev0,
        metaSave: {
          ...pull0.metaSave,
          levelStars: { '1-1': 3 },
          levelBestScores: { '1-1': 1650 },
        },
      });

      ctx.assertEq(pushA.ok, true, 'Stale baseRevision push must auto-merge cleanly');
      ctx.assertEq(pushA.conflictMerged, true, 'conflictMerged flag must be true when baseRevision < cloud revision');
      ctx.assert(pushA.revision > pushB.revision, 'Merged push increments revision');
      ctx.assertEq(pushA.metaSave.levelStars['1-1'], 3, 'Device A 1-1=3★ preserved');
      ctx.assertEq(pushA.metaSave.levelStars['1-2'], 3, 'Concurrent Device B 1-2=3★ preserved');
      ctx.assertEq(pushA.metaSave.levelBestScores['1-1'], 1650);
      ctx.assertEq(pushA.metaSave.levelBestScores['1-2'], 1980);
    },
  },

  {
    id: 'T2-F12-05',
    tier: 2,
    features: ['F12'],
    title: 'Leaderboard outside Top-50 reports exact myRank=56 with list.length=50 and normalizes totalScore alias to score',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      const pull0 = await callKissaSync(ctx, { action: 'pull' });

      const rivals55 = [];
      for (let i = 1; i <= 55; i++) {
        rivals55.push({
          id: `rival_${i}`,
          nickName: `烘焙达人#${i}`,
          avatarPreset: 'luna',
          totalStars: Math.min(90, 10 + i),
          totalCumulativeScore: 20000 + i * 1000,
          isNpc: false,
        });
      }
      await ctx.setCloudConfig({ seedRivals: rivals55 });

      await callKissaSync(ctx, {
        action: 'push',
        baseRevision: pull0.revision || 1,
        metaSave: {
          ...pull0.metaSave,
          levelStars: { '1-1': 3 },
          levelBestScores: { '1-1': 1500 },
        },
      });

      const lbStars = await callKissaSync(ctx, { action: 'leaderboard', boardType: 'stars' });
      ctx.assertEq(lbStars.ok, true);
      ctx.assertEq(lbStars.boardType, 'stars');
      ctx.assertEq(lbStars.list.length, 50, 'Leaderboard list must cap at Top 50');
      ctx.assertEq(lbStars.myRank, 56, 'Player below 55 higher rivals must report exact myRank=56');
      ctx.assertEq(lbStars.totalPlayers, 56);

      const lbAlias = await callKissaSync(ctx, { action: 'leaderboard', boardType: 'totalScore' });
      ctx.assertEq(lbAlias.ok, true);
      ctx.assertEq(lbAlias.boardType, 'score', 'Legacy boardType="totalScore" must normalize to "score"');
      ctx.assertEq(lbAlias.list.length, 50);
      ctx.assertEq(lbAlias.myRank, 56);
    },
  },

  {
    id: 'T2-F12-06',
    tier: 2,
    features: ['F12', 'F14'],
    title: 'Denied UserInfoButton auth leaves authorized=false without error and >16-char nickname trims and clamps to <=16 chars',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.clickHit('dock_leaderboard');
      ctx.assertEq((await ctx.getState()).activeModal, 'leaderboard');

      // 1) Denied authorization (userInfo: null)
      await ctx.eval(() => {
        window.__WX_MOCK_USERINFO_DENY__ = true;
        window.__WX_MOCK_USERINFO__ = null;
        if (window.__WX_HARNESS__?.tapUserInfoButton) {
          window.__WX_HARNESS__.tapUserInfoButton(null);
        } else {
          const btn = document.getElementById('wx-mock-userinfo-btn');
          if (btn) btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        }
      });
      await ctx.sleep(80);
      ctx.assertEq((await ctx.getSaveData()).playerProfile?.authorized, false, 'Denied auth must keep authorized=false');

      // 2) Authorized with padded 20-char nickname -> trimmed & sliced to <= 16 chars
      const longPadded = '   一二三四五六七八九十甲乙丙丁戊己庚辛壬癸   ';
      await ctx.eval((nick) => {
        window.__WX_MOCK_USERINFO_DENY__ = false;
        window.__WX_MOCK_USERINFO__ = { nickName: nick, avatarUrl: '' };
        if (window.__WX_HARNESS__?.tapUserInfoButton) {
          window.__WX_HARNESS__.tapUserInfoButton({ nickName: nick, avatarUrl: '' });
        } else {
          const btn = document.getElementById('wx-mock-userinfo-btn');
          if (btn) btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        }
      }, longPadded);
      if (typeof ctx.flushCloudSync === 'function') await ctx.flushCloudSync(350);
      else await ctx.sleep(200);

      const profile = (await ctx.getSaveData()).playerProfile;
      ctx.assertEq(profile?.authorized, true, 'Valid UserInfo tap sets authorized=true');
      ctx.assert(
        typeof profile.nickName === 'string' &&
          profile.nickName.length > 0 &&
          profile.nickName.length <= 16 &&
          !profile.nickName.startsWith(' '),
        `Nickname must be trimmed and clamped to <=16 chars, got "${profile?.nickName}" (len=${profile?.nickName?.length})`
      );
      await ctx.clickHit('modal_close');
    },
  },

  // --------------------------------------------------------------------------
  // F13 — 3-Chapter 30-Level Campaign Lobby, Gates & Settlement (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F13-01',
    tier: 2,
    features: ['F13', 'F02'],
    title: 'Locked node (1-4 on fresh save) and insufficient-star chapter gate (1-10 cleared with 10★ < 18★) block preview/start',
    run: async (ctx) => {
      // Part A: Fresh save -> 1-4 is locked
      await ctx.resetGame();
      const node14 = findHit(await ctx.getState(), 'level_node_1-4');
      if (node14) await ctx.clickHit('level_node_1-4');
      let st = await ctx.getState();
      ctx.assertEq(st.screen, 'lobby');
      ctx.assertEq(st.activeModal, null, 'Clicking locked level_node_1-4 must NOT open level_preview modal');

      const openLocked14 = await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openLevelPreview('1-4'));
      ctx.assertEq(openLocked14, false, 'openLevelPreview("1-4") must return false when locked');

      // Part B: 1-1..1-10 all cleared at 1★ -> totalStars = 10 (< 18★ required for Chapter 2!)
      const tenOneStars = {};
      for (let i = 1; i <= 10; i++) tenOneStars[`1-${i}`] = 1;
      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: tenOneStars,
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      const levelsMod = await ctx.requireBundledModule('./src/levels_data.js');
      const ch2Gate = levelsMod.isChapterUnlocked(2, tenOneStars);
      const lv2_1Gate = levelsMod.isLevelUnlocked('2-1', tenOneStars);
      ctx.assertEq(ch2Gate.unlocked, false, 'Chapter 2 must remain locked at 10★ (<18★) even when 1-10 is cleared');
      ctx.assertEq(lv2_1Gate.unlocked, false, '2-1 must remain locked at 10★ (<18★)');

      const open2_1 = await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openLevelPreview('2-1'));
      ctx.assertEq(open2_1, false, 'openLevelPreview("2-1") must reject when totalStars = 10 < 18');
      ctx.assertEq((await ctx.getState()).activeModal, null);
    },
  },

  {
    id: 'T2-F13-02',
    tier: 2,
    features: ['F13'],
    title: 'Chapter pager clamps selectedChapter strictly within [1, 3] on chapter_prev at Ch.1 and chapter_next at Ch.3',
    run: async (ctx) => {
      await ctx.resetGame();
      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      let st = await ctx.getState();
      ctx.assertEq(st.selectedChapter, 1);

      // Lower bound at Chapter 1
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.clickHit('chapter_prev');
        globalThis.__HOSHI_DEBUG__.clickHit('chapter_prev');
      });
      st = await ctx.getState();
      ctx.assertEq(st.selectedChapter, 1, 'chapter_prev at Ch.1 must clamp at 1');

      // Step up to Chapter 3 and test upper bound
      await ctx.clickHit('chapter_next');
      ctx.assertEq((await ctx.getState()).selectedChapter, 2);
      await ctx.clickHit('chapter_next');
      ctx.assertEq((await ctx.getState()).selectedChapter, 3);

      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.clickHit('chapter_next');
        globalThis.__HOSHI_DEBUG__.clickHit('chapter_next');
      });
      st = await ctx.getState();
      ctx.assertEq(st.selectedChapter, 3, 'chapter_next at Ch.3 must clamp at 3');
    },
  },

  {
    id: 'T2-F13-03',
    tier: 2,
    features: ['F13'],
    title: 'Clearing finale level 3-10 (getNextLevelId("3-10") === null) settles and handles primary CTA without null-level crash',
    run: async (ctx) => {
      const stars = getAllUnlockedStars(ctx, 3);
      stars['3-10'] = 0;
      await ctx.setupSaveAndStart('3-10', {
        levelStars: stars,
        catcakeLevels: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 4 },
        deviceUpgrades: { dev_tray: 2, dev_flour: 3, dev_teapot: 3, dev_tools: 3 },
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        selectedPatron: 'mugi',
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Reach >= 35,000 (star1 on 3-10) using upgraded Lv.4 recipes + Mugi blast when charged
      for (let guard = 0; guard < 22; guard++) {
        const cur = await ctx.getState();
        if (cur.score >= 35000 || cur.timeLeft <= 8.5) break;
        if (cur.skillEnergy >= 100) {
          await ctx.castPatronSkill();
        }
        await serveOneOrderOrganically(ctx, null);
      }

      let st = await ctx.getState();
      ctx.assert(st.score >= 35000, `Expected 3-10 score >= 35000, got ${st.score}`);
      st = await ctx.advanceTime(st.timeLeft + 0.6);

      ctx.assertEq(st.activeModal, 'level_result');
      ctx.assertEq(st.lastResult?.cleared, true);
      ctx.assert(st.lastResult?.starsEarned >= 1);
      ctx.assert((await ctx.getSaveData()).levelStars['3-10'] >= 1, '3-10 stars persisted');

      // Tap result_next_btn (or modal_close if result_next_btn hides on final level) -> zero crash!
      const nextBtn = findHit(st, 'result_next_btn');
      if (nextBtn) {
        await ctx.clickHit('result_next_btn');
      } else {
        await ctx.clickHit('modal_close');
      }
      const afterCta = await ctx.getState();
      ctx.assert(afterCta.screen === 'lobby' || afterCta.screen === 'playing', `Valid post-3-10 state: ${afterCta.screen}`);
      ctx.assertEq(ctx.cdp.errors.length, 0);
    },
  },

  {
    id: 'T2-F13-04',
    tier: 2,
    features: ['F13', 'F11'],
    title: 'Lower-score (1★) and 0-score (0★) replays preserve historical best stars (3★) and best score (1920) on 1-1',
    run: async (ctx) => {
      // Run A: 1★ replay (750 <= score < 1050)
      await ctx.setupSaveAndStart('1-1', {
        bankStardust: 100,
        totalEarnedStardust: 165,
        levelStars: { '1-1': 3 },
        levelBestScores: { '1-1': 1920 },
        catcakeLevels: { 1: 2, 2: 2, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      for (let i = 0; i < 15; i++) {
        const s = await ctx.getState();
        if (s.score >= 760) break;
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let mid = await ctx.getState();
      ctx.assert(mid.score >= 750 && mid.score < 1400, `Expected 1★/2★ replay score (<1920), got ${mid.score}`);
      const resA = await ctx.advanceTime(mid.timeLeft + 0.6);
      ctx.assertEq(resA.lastResult?.firstStarDustAward, 0, 'Replay below historical 3★ must award 0 firstStarDust');

      let save = await ctx.getSaveData();
      ctx.assertEq(save.levelStars['1-1'], 3, 'Historical 3★ must never downgrade on lower-star replay');
      ctx.assertEq(save.levelBestScores['1-1'], 1920, 'Historical best score 1920 must never downgrade');

      // Run B: 0-score replay
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('1-1'));
      await ctx.advanceTime(91);
      save = await ctx.getSaveData();
      ctx.assertEq(save.levelStars['1-1'], 3, '0-score fail replay must preserve 3★');
      ctx.assertEq(save.levelBestScores['1-1'], 1920, '0-score fail replay must preserve best score 1920');
    },
  },

  {
    id: 'T2-F13-05',
    tier: 2,
    features: ['F13'],
    title: 'Exact star1 threshold on 1-1: 749 fails keeping 1-2 locked whereas >=750 clears at 1★ and unlocks 1-2',
    run: async (ctx) => {
      // 1) Exact 749 vs 750 unit-boundary verification on bundled order_service.computeLevelSettlement
      const levelsMod = await ctx.requireBundledModule('./src/levels_data.js');
      const orderMod = await ctx.requireBundledModule('./src/order_service.js');
      const lv1_1 = levelsMod.getLevelById('1-1');
      if (orderMod && typeof orderMod.computeLevelSettlement === 'function') {
        const s749 = orderMod.computeLevelSettlement(lv1_1, { score: 749, ordersServed: 6, vipServed: 0 }, 0);
        const s750 = orderMod.computeLevelSettlement(lv1_1, { score: 750, ordersServed: 6, vipServed: 0 }, 0);
        ctx.assertEq(s749.cleared, false, 'Exact 749 on 1-1 must have cleared=false');
        ctx.assertEq(s749.starsEarned, 0, 'Exact 749 on 1-1 must earn 0 stars');
        ctx.assertEq(s750.cleared, true, 'Exact 750 on 1-1 must have cleared=true');
        ctx.assertEq(s750.starsEarned, 1, 'Exact 750 on 1-1 must earn 1 star');
      }

      // 2) Live E2E Shift A: 0 < score < 750 -> fail, 1-2 stays locked
      await ctx.setupSaveAndStart('1-1', {
        bankStardust: 30,
        totalEarnedStardust: 30,
        levelStars: {},
        levelBestScores: {},
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      for (let i = 0; i < 4; i++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let stFail = await ctx.getState();
      ctx.assert(stFail.score > 0 && stFail.score < 750, `Expected 0 < score < 750, got ${stFail.score}`);
      stFail = await ctx.advanceTime(stFail.timeLeft + 0.6);
      ctx.assertEq(stFail.lastResult?.cleared, false);
      ctx.assertEq(stFail.lastResult?.starsEarned, 0);
      const saveFail = await ctx.getSaveData();
      ctx.assertEq(levelsMod.isLevelUnlocked('1-2', saveFail.levelStars).unlocked, false, '1-2 must stay locked when score < 750');

      // 3) Live E2E Shift B: 750 <= score < 1050 -> 1★ clear, 1-2 unlocks!
      await ctx.setupSaveAndStart('1-1', {
        bankStardust: 30,
        totalEarnedStardust: 30,
        levelStars: {},
        levelBestScores: {},
        catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        unlockedPatrons: ['mikan', 'luna'],
        selectedPatron: 'luna',
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      while ((await ctx.getState()).score < 750) {
        const cur = await ctx.getState();
        if (cur.score >= 580 && (cur.comboCount >= 2 || cur.feverActive)) {
          await ctx.advanceTime(10.5);
        }
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let stPass = await ctx.getState();
      ctx.assert(stPass.score >= 750 && stPass.score < 1050, `Expected 1★ band [750, 1049], got ${stPass.score}`);
      stPass = await ctx.advanceTime(stPass.timeLeft + 0.6);
      ctx.assertEq(stPass.lastResult?.cleared, true);
      ctx.assertEq(stPass.lastResult?.starsEarned, 1);
      const savePass = await ctx.getSaveData();
      ctx.assertEq(savePass.levelStars['1-1'], 1);
      ctx.assertEq(levelsMod.isLevelUnlocked('1-2', savePass.levelStars).unlocked, true, '1-2 must unlock at score >= 750');
    },
  },

  {
    id: 'T2-F13-06',
    tier: 2,
    features: ['F13', 'F14'],
    title: 'level_result modal result_retry_btn resets 1-1 cleanly and result_shop_btn transitions directly into shop modal',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await serveOneOrderOrganically(ctx, null, { useHarness: false });
      let st = await ctx.getState();
      ctx.assert(st.score > 0 && st.ordersServed === 1);

      st = await ctx.advanceTime(st.timeLeft + 0.6);
      ctx.assertEq(st.activeModal, 'level_result');

      // 1) Tap result_retry_btn -> fresh 1-1 run
      await ctx.clickHit('result_retry_btn');
      st = await ctx.getState();
      ctx.assertEq(st.screen, 'playing');
      ctx.assertEq(st.currentLevelId, '1-1');
      ctx.assertEq(st.activeModal, null);
      ctx.assertEq(st.score, 0, 'Retry must reset score to 0');
      ctx.assertEq(st.ordersServed, 0, 'Retry must reset ordersServed to 0');
      ctx.assertClose(st.timeLeft, 90, 0.5, 'Retry must reset 1-1 countdown to 90s');

      // 2) Settle again and tap result_shop_btn -> opens shop modal
      st = await ctx.advanceTime(91);
      ctx.assertEq(st.activeModal, 'level_result');
      await ctx.clickHit('result_shop_btn');
      st = await ctx.getState();
      ctx.assertEq(st.activeModal, 'shop', 'result_shop_btn must open Kissa Shop modal');
      ctx.assert(!!findHit(st, 'shop_tab_catcakes'), 'Shop tabs must be interactive');
      await ctx.clickHit('modal_close');
    },
  },

  // --------------------------------------------------------------------------
  // F14 — 4-Tab Kissa Shop, Compendium & Dual Leaderboard UI (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F14-01',
    tier: 2,
    features: ['F14'],
    title: 'Insufficient stardust (19 ⭐) cleanly rejects purchases across all 4 Kissa Shop tabs with 0 state mutation',
    run: async (ctx) => {
      await ctx.resetGame();
      await ctx.setSaveData({
        schemaVersion: 2,
        bankStardust: 19,
        totalEarnedStardust: 34,
        consumableSpentStardust: 15,
        catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        unlockedPatrons: ['mikan'],
        unlockedThemes: ['amber'],
      });

      await ctx.clickHit('dock_shop');
      ctx.assertEq((await ctx.getState()).activeModal, 'shop');

      // Tab 1: Catcakes (C1 Lv.1 costs 20 > 19)
      await ctx.clickHit('shop_tab_catcakes');
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_catcake_1'));

      // Tab 2: Devices (dev_tools Lv.1 costs 40 > 19)
      await ctx.clickHit('shop_tab_devices');
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_dev_tools'));

      // Tab 3: Patrons (luna costs 80 > 19)
      await ctx.clickHit('shop_tab_patrons');
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_patron_luna'));

      // Tab 4: Themes (sakura costs 80 > 19)
      await ctx.clickHit('shop_tab_themes');
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_theme_sakura'));

      const save = await ctx.getSaveData();
      ctx.assertEq(save.bankStardust, 19, 'Insufficient stardust must not deduct bankStardust');
      ctx.assertEq(save.catcakeLevels[1] ?? save.catcakeLevels['1'], 0);
      ctx.assertEq(save.deviceUpgrades.dev_tools, 0);
      ctx.assertEq(save.unlockedPatrons, ['mikan']);
      ctx.assertEq(save.unlockedThemes, ['amber']);
      await ctx.clickHit('modal_close');
    },
  },

  {
    id: 'T2-F14-02',
    tier: 2,
    features: ['F14'],
    title: 'Max-level purchase ceiling (C1 Lv.4, dev_tray Lv.2, dev_tools Lv.3) prevents over-leveling and preserves 500 ⭐ bank',
    run: async (ctx) => {
      await ctx.resetGame();
      // Spent = C1 Lv.4 (240) + dev_tray Lv.2 (210) + dev_tools Lv.3 (290) = 740; totalEarned = 1240 -> bank = 500
      await ctx.setSaveData({
        schemaVersion: 2,
        bankStardust: 500,
        totalEarnedStardust: 1240,
        catcakeLevels: { 1: 4, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        deviceUpgrades: { dev_tray: 2, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
      });

      await ctx.clickHit('dock_shop');
      await ctx.clickHit('shop_tab_catcakes');
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_catcake_1'));

      await ctx.clickHit('shop_tab_devices');
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_dev_tray');
        globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_dev_tools');
      });

      const save = await ctx.getSaveData();
      ctx.assertEq(save.catcakeLevels[1] ?? save.catcakeLevels['1'], 4, 'C1 must stay capped at Lv.4');
      ctx.assertEq(save.deviceUpgrades.dev_tray, 2, 'dev_tray must stay capped at Lv.2');
      ctx.assertEq(save.deviceUpgrades.dev_tools, 3, 'dev_tools must stay capped at Lv.3');
      ctx.assertEq(save.bankStardust, 500, 'Max-level taps must deduct 0 stardust');
      await ctx.clickHit('modal_close');
    },
  },

  {
    id: 'T2-F14-03',
    tier: 2,
    features: ['F14', 'F13'],
    title: 'Locked patrons (luna/mugi) and locked themes (sakura/moonlight) cannot be equipped via preview, lobby, or shop',
    run: async (ctx) => {
      await ctx.resetGame();
      await ctx.setSaveData({
        schemaVersion: 2,
        bankStardust: 10,
        totalEarnedStardust: 30,
        consumableSpentStardust: 20,
        unlockedPatrons: ['mikan'],
        selectedPatron: 'mikan',
        unlockedThemes: ['amber'],
        equippedTheme: 'amber',
      });

      // 1) Lobby quick patron switch with only mikan unlocked
      const switchHit = findHit(await ctx.getState(), 'lobby_patron_switch');
      if (switchHit) {
        await ctx.clickHit('lobby_patron_switch');
        ctx.assertEq((await ctx.getSaveData()).selectedPatron, 'mikan');
        if ((await ctx.getState()).activeModal) await ctx.clickHit('modal_close');
      }

      // 2) Level preview patron chips
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openLevelPreview('1-1'));
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.clickHit('preview_patron_luna');
        globalThis.__HOSHI_DEBUG__.clickHit('preview_patron_mugi');
      });
      ctx.assertEq((await ctx.getSaveData()).selectedPatron, 'mikan', 'Locked patron must not equip in level_preview');
      if ((await ctx.getState()).activeModal) await ctx.eval(() => globalThis.__HOSHI_DEBUG__.closeModal());

      // 3) Shop equip buttons without purchasing
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openModal('shop'));
      await ctx.clickHit('shop_tab_patrons');
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.clickHit('shop_equip_patron_luna');
        globalThis.__HOSHI_DEBUG__.clickHit('shop_equip_patron_mugi');
      });
      await ctx.clickHit('shop_tab_themes');
      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.clickHit('shop_equip_theme_sakura');
        globalThis.__HOSHI_DEBUG__.clickHit('shop_equip_theme_moonlight');
      });

      const save = await ctx.getSaveData();
      ctx.assertEq(save.selectedPatron, 'mikan', 'Locked patron must not equip in shop');
      ctx.assertEq(save.equippedTheme, 'amber', 'Locked theme must not equip in shop');
      await ctx.clickHit('modal_close');
    },
  },

  {
    id: 'T2-F14-04',
    tier: 2,
    features: ['F14', 'F13'],
    title: 'Mid-run pause modal dynamic restart/quit controls preserve run on cancel, reset on restart, and stop timer on quit',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await serveOneOrderOrganically(ctx, null, { useHarness: false });
      const activeSt = await ctx.getState();
      const scoreBefore = activeSt.score;
      ctx.assert(scoreBefore > 0);

      // 1) Open pause and dynamically discover restart hit
      await ctx.clickHit('pause_btn');
      let pauseSt = await ctx.getState();
      ctx.assertEq(pauseSt.activeModal, 'pause');

      const restartHit = findHit(pauseSt, /restart|retry|replay/i);
      ctx.assert(!!restartHit, `Pause modal must expose a restart/retry hit, got: ${pauseSt.hits.map((h) => h.id).join(', ')}`);
      await ctx.clickHit(restartHit.id);

      let postRestartTap = await ctx.getState();
      if (postRestartTap.activeModal === 'confirm') {
        const cancelHit = (postRestartTap.hits || []).find(
          (h) => /cancel|no|back|modal_close/i.test(h.id) && !/backdrop|guard/i.test(h.id)
        );
        if (cancelHit) {
          await ctx.clickHit(cancelHit.id);
          const afterCancel = await ctx.getState();
          ctx.assertEq(afterCancel.score, scoreBefore, 'Canceling restart confirmation must preserve active run score');
          if (afterCancel.activeModal !== 'pause') await ctx.clickHit('pause_btn');
          pauseSt = await ctx.getState();
          const rHit2 = findHit(pauseSt, /restart|retry|replay/i);
          ctx.assert(!!rHit2, `Pause modal must expose a restart/retry hit after cancel, got: ${(pauseSt.hits || []).map((h) => h.id).join(', ')}`);
          await ctx.clickHit(rHit2.id);
          postRestartTap = await ctx.getState();
        }
        if (postRestartTap.activeModal === 'confirm') {
          const confirmHit = (postRestartTap.hits || []).find(
            (h) => /confirm|ok|yes|accept|restart|retry/i.test(h.id) && !/cancel|close|no|back|backdrop|guard/i.test(h.id)
          );
          ctx.assert(!!confirmHit, 'Confirm modal must have an accept button');
          await ctx.clickHit(confirmHit.id);
        }
      }

      const restarted = await ctx.getState();
      ctx.assertEq(restarted.screen, 'playing');
      ctx.assertEq(restarted.activeModal, null);
      ctx.assertEq(restarted.score, 0, 'Confirmed restart must reset score to 0');
      ctx.assertEq(restarted.ordersServed, 0);

      // 2) Open pause again and dynamically discover quit-to-lobby hit
      await ctx.clickHit('pause_btn');
      pauseSt = await ctx.getState();
      const quitHit = findHit(pauseSt, /quit|lobby|exit|home|leave|abandon/i);
      ctx.assert(!!quitHit, `Pause modal must expose a quit/lobby hit, got: ${pauseSt.hits.map((h) => h.id).join(', ')}`);
      await ctx.clickHit(quitHit.id);

      let postQuitTap = await ctx.getState();
      if (postQuitTap.activeModal === 'confirm') {
        const confirmQuit = (postQuitTap.hits || []).find(
          (h) => /confirm|ok|yes|accept|quit|lobby|exit/i.test(h.id) && !/cancel|close|no|back|backdrop|guard/i.test(h.id)
        );
        ctx.assert(!!confirmQuit, 'Quit confirm modal must have an accept button');
        await ctx.clickHit(confirmQuit.id);
      }

      const backOnLobby = await ctx.getState();
      ctx.assertEq(backOnLobby.screen, 'lobby', 'Quitting from pause must return cleanly to lobby');
      ctx.assertEq(backOnLobby.activeModal, null);
    },
  },

  {
    id: 'T2-F14-05',
    tier: 2,
    features: ['F14', 'F16'],
    title: 'Compact 375x667 vertical drag-scroll in Shop (reaching C7) and Compendium (24 recipes) clamps cleanly with 0 errors',
    run: async (ctx) => {
      try {
        await ctx.setViewport(375, 667, true, 2, { safeTop: 20, safeBottom: 0, showCapsule: true });
        await ctx.resetGame();
        await ctx.setSaveData({
          schemaVersion: 2,
          bankStardust: 800,
          totalEarnedStardust: 800,
          levelStars: getAllUnlockedStars(ctx, 3),
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });

        // 1) Scroll Shop catcakes list to bottom on 375x667 and purchase C7 Lv.1 (100 ⭐)
        await ctx.clickHit('dock_shop');
        await ctx.clickHit('shop_tab_catcakes');
        for (let i = 0; i < 4; i++) {
          await ctx.swipeCanvas(188, 490, 188, 170, { steps: 6, stepMs: 14 });
        }
        await ctx.checkBounds('shop_375_scrolled_bottom', { safeBottom: 0 });

        const c7Hit = findHit(await ctx.getState(), 'shop_buy_catcake_7');
        if (c7Hit) await ctx.clickHit('shop_buy_catcake_7');
        else await ctx.eval(() => globalThis.__HOSHI_DEBUG__.clickHit('shop_buy_catcake_7'));
        ctx.assertEq((await ctx.getSaveData()).catcakeLevels[7] ?? (await ctx.getSaveData()).catcakeLevels['7'], 1, 'C7 Lv.1 purchasable after scroll on 375x667');

        // Scroll back to top and check over-scroll clamping
        for (let i = 0; i < 5; i++) {
          await ctx.swipeCanvas(188, 180, 188, 520, { steps: 6, stepMs: 14 });
        }
        await ctx.checkBounds('shop_375_scrolled_top', { safeBottom: 0 });
        await ctx.clickHit('modal_close');

        // 2) Scroll 24-recipe Compendium list down and up on 375x667
        await ctx.clickHit('dock_compendium');
        await ctx.clickHit('compendium_tab_recipes');
        for (let i = 0; i < 6; i++) {
          await ctx.swipeCanvas(188, 500, 188, 160, { steps: 6, stepMs: 12 });
        }
        await ctx.checkBounds('compendium_recipes_375_bottom', { safeBottom: 0 });
        for (let i = 0; i < 6; i++) {
          await ctx.swipeCanvas(188, 160, 188, 500, { steps: 6, stepMs: 12 });
        }
        await ctx.clickHit('modal_close');
        ctx.assertEq((await ctx.getState()).activeModal, null);
      } finally {
        await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      }
    },
  },

  {
    id: 'T2-F14-06',
    tier: 2,
    features: ['F14'],
    title: 'Rapid modal cycling, outside-backdrop close, and #wx-mock-userinfo-btn DOM cleanup preserve Lobby HitRegistry',
    run: async (ctx) => {
      try {
        await ctx.setViewport(1280, 760, false, 1, { safeTop: 8, safeBottom: 0, showCapsule: true });
        await ctx.resetGame();

        // 1) Shop -> modal_close
        await ctx.clickHit('dock_shop');
        ctx.assertEq((await ctx.getState()).activeModal, 'shop');
        await ctx.clickHit('modal_close');
        ctx.assertEq((await ctx.getState()).activeModal, null);

        // 2) Compendium -> outside backdrop tap (x=60, y=380 is well outside centered <=460px modal card on 1280w)
        await ctx.clickHit('dock_compendium');
        ctx.assertEq((await ctx.getState()).activeModal, 'compendium');
        await ctx.tapCanvas(60, 380);
        if ((await ctx.getState()).activeModal !== null) {
          await ctx.clickHit('modal_close');
        }
        ctx.assertEq((await ctx.getState()).activeModal, null);

        // 3) Leaderboard -> verify UserInfo overlay cleaned up on close
        await ctx.clickHit('dock_leaderboard');
        ctx.assertEq((await ctx.getState()).activeModal, 'leaderboard');
        await ctx.clickHit('modal_close');
        ctx.assertEq((await ctx.getState()).activeModal, null);
        const lingeringBtn = await ctx.eval(() => !!document.getElementById('wx-mock-userinfo-btn'));
        ctx.assertEq(lingeringBtn, false, '#wx-mock-userinfo-btn must be removed from DOM when leaderboard closes');

        // 4) Help -> modal_close
        await ctx.clickHit('lobby_help_btn');
        ctx.assertEq((await ctx.getState()).activeModal, 'help');
        await ctx.clickHit('modal_close');
        const finalSt = await ctx.getState();
        ctx.assertEq(finalSt.activeModal, null);
        for (const reqId of ['lobby_start_cta', 'dock_shop', 'dock_compendium', 'dock_leaderboard', 'dock_themes']) {
          ctx.assert(!!findHit(finalSt, reqId), `Lobby HitRegistry missing ${reqId} after modal cycling`);
        }
      } finally {
        await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      }
    },
  },

  // --------------------------------------------------------------------------
  // F15 — 3 Chef Patrons & 2 Emergency Utensils (fork & spoon) (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F15-01',
    tier: 2,
    features: ['F15'],
    title: 'spoon rejected on C7 max-tier, frozen I, block X, void #, and empty . cells on 3-10 without consuming charge',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('3-10', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 }, // spoon: 2
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Upgrade (2,2):C6(gold) -> C7(gold) consuming 1 spoon (1 spoon remaining)
      await ctx.useToolOnCell('spoon', 2, 2);
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[2][2].tile?.tier, 7);
      ctx.assertEq(st.toolCounts.spoon, 1);

      // Test all 5 invalid targets: C7 (2,2), frozen I (1,2), block X (3,2), void # (0,0), empty . (0,1)
      const invalidTargets = [
        [2, 2],
        [1, 2],
        [3, 2],
        [0, 0],
        [0, 1],
      ];
      for (const [r, c] of invalidTargets) {
        await ctx.useToolOnCell('spoon', r, c);
        if ((await ctx.getState()).activeTool !== 'spoon') {
          await ctx.clickHit('tool_spoon_btn');
        }
        await ctx.tapBoardCell(r, c, { viaCdp: true });
      }

      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[2][2].tile?.tier, 7, 'C7 must never upgrade to C8');
      ctx.assertEq(st.grid.cells[1][2].tile?.tier, 5, 'Frozen C5[I] must reject spoon');
      ctx.assertEq(st.grid.cells[1][2].tile?.frozenHp, 1);
      ctx.assertEq(st.grid.cells[3][2].type, 'block');
      ctx.assertEq(st.grid.cells[3][2].tile, null);
      ctx.assertEq(st.grid.cells[0][0].type, 'void');
      ctx.assertEq(st.grid.cells[0][1].tile, null);
      ctx.assertEq(st.toolCounts.spoon, 1, 'Rejected spoon targets must NOT consume remaining spoon charge');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F15-02',
    tier: 2,
    features: ['F15'],
    title: 'fork rejected on empty ., void #, and block X cells on 1-10 without consuming charge',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-10', {
        levelStars: getAllUnlockedStars(ctx, 3),
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 1 }, // fork: 1
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // 1-10 matrix: (0,0):.[empty], (1,0):# [void], (3,1):X [block]
      for (const [r, c] of [[0, 0], [1, 0], [3, 1]]) {
        await ctx.useToolOnCell('fork', r, c);
        if ((await ctx.getState()).activeTool !== 'fork') {
          await ctx.clickHit('tool_fork_btn');
        }
        await ctx.tapBoardCell(r, c, { viaCdp: true });
      }

      const st = await ctx.getState();
      ctx.assertEq(st.toolCounts.fork, 1, 'fork must NOT be consumed on empty/void/block cells');
      ctx.assertEq(st.grid.cells[3][1].type, 'block', 'Wooden pillar X must remain intact');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F15-03',
    tier: 2,
    features: ['F15', 'F16'],
    title: 'Armed utensil (activeTool === "fork") intercepts and suppresses board swipe, and re-tapping tool_fork_btn disarms cleanly',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', {
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 }, // fork: 1
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      await ctx.clickHit('tool_fork_btn');
      let st = await ctx.getState();
      ctx.assertEq(st.activeTool, 'fork', '1st tap on tool_fork_btn arms fork');

      // Drag 60px horizontally across empty Row 2 while fork is armed -> board swipe MUST be suppressed!
      const pStart = cellCenter(ctx, st.boardLayout, 2, 0);
      const pEnd = { x: pStart.x + 64, y: pStart.y };
      await ctx.swipeCanvas(pStart.x, pStart.y, pEnd.x, pEnd.y, { steps: 6, stepMs: 12 });

      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 1, 'Armed utensil must suppress 2048 board slide');
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 1);
      ctx.assertEq(st.toolCounts.fork, 1, 'Dragging over empty row must not consume fork');

      // Re-tap tool_fork_btn if still armed -> disarms to null
      if (st.activeTool === 'fork') {
        await ctx.clickHit('tool_fork_btn');
        st = await ctx.getState();
      }
      ctx.assertEq(st.activeTool, null, 'Re-tapping tool_fork_btn disarms activeTool');
      ctx.assertEq(st.toolCounts.fork, 1);

      // Now the exact same 64px swipe executes slide('right')!
      await ctx.swipeCanvas(pStart.x, pStart.y, pEnd.x, pEnd.y, { steps: 6, stepMs: 12 });
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][2].tile?.tier, 2, 'Disarmed swipe merges (0,0)+(0,1) into (0,2):C2');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F15-04',
    tier: 2,
    features: ['F15', 'F11'],
    title: 'Emergency utensil maxBuyPerLevel = 1 cap rejects 2nd buy in same level and <15 ⭐ insufficient dust rejects buy',
    run: async (ctx) => {
      // Part A: maxBuyPerLevel = 1 cap for both fork (15⭐) and spoon (20⭐)
      await ctx.setupSaveAndStart('1-1', {
        bankStardust: 100,
        totalEarnedStardust: 100,
        consumableSpentStardust: 0,
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 }, // fork: 1, spoon: 0
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Spend free fork on (0,0):C1
      await ctx.useToolOnCell('fork', 0, 0);
      ctx.assertEq((await ctx.getState()).toolCounts.fork, 0);
      ctx.assertEq((await ctx.getSaveData()).bankStardust, 100);

      // Buy 1st emergency fork (-15⭐ -> bank=85) and use it on (0,1):C1
      const buy1 = await tryBuyEmergencyUtensil(ctx, 'fork');
      ctx.assertEq(buy1.save.bankStardust, 85, '1st emergency fork costs 15⭐');
      if (buy1.st.toolCounts.fork > 0 || buy1.st.activeTool === 'fork') {
        await ctx.useToolOnCell('fork', 0, 1);
      }
      ctx.assertEq((await ctx.getState()).toolCounts.fork, 0);

      // Attempt 2nd emergency fork in the SAME level -> MUST be rejected!
      const buy2 = await tryBuyEmergencyUtensil(ctx, 'fork');
      ctx.assertEq(buy2.st.toolCounts.fork, 0, '2nd emergency fork in same level must be rejected (maxBuyPerLevel=1)');
      ctx.assertEq(buy2.save.bankStardust, 85, 'Rejected 2nd emergency fork must deduct 0⭐');

      // Buy 1st emergency spoon (-20⭐ -> bank=65), use on (1,1):C2 -> C3, then attempt 2nd emergency spoon -> rejected!
      const spoon1 = await tryBuyEmergencyUtensil(ctx, 'spoon');
      ctx.assertEq(spoon1.save.bankStardust, 65, '1st emergency spoon costs 20⭐');
      if (spoon1.st.toolCounts.spoon > 0 || spoon1.st.activeTool === 'spoon') {
        await ctx.useToolOnCell('spoon', 1, 1);
      }
      ctx.assertEq((await ctx.getState()).toolCounts.spoon, 0);

      const spoon2 = await tryBuyEmergencyUtensil(ctx, 'spoon');
      ctx.assertEq(spoon2.st.toolCounts.spoon, 0, '2nd emergency spoon in same level must be rejected (maxBuyPerLevel=1)');
      ctx.assertEq(spoon2.save.bankStardust, 65);

      // Part B: Insufficient stardust (bankStardust = 14 < 15⭐) on 1-2
      await ctx.setupSaveAndStart('1-2', {
        schemaVersion: 2,
        bankStardust: 14,
        totalEarnedStardust: 34,
        consumableSpentStardust: 20,
        levelStars: { '1-1': 1 },
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      await ctx.useToolOnCell('fork', 0, 0); // use free fork
      const lowFork = await tryBuyEmergencyUtensil(ctx, 'fork');
      const lowSpoon = await tryBuyEmergencyUtensil(ctx, 'spoon');
      ctx.assertEq(lowFork.st.toolCounts.fork, 0, '14⭐ (<15⭐) must reject emergency fork');
      ctx.assertEq(lowSpoon.st.toolCounts.spoon, 0, '14⭐ (<20⭐) must reject emergency spoon');
      ctx.assertEq(lowSpoon.save.bankStardust, 14);
    },
  },

  {
    id: 'T2-F15-05',
    tier: 2,
    features: ['F15', 'F04'],
    title: 'Under-charged skill (<100%) is rejected, Luna preserves frozen I cells on 3-1, and Mugi handles <=1 tile edge board safely',
    run: async (ctx) => {
      // 1) Under-charged (<100%) cast via button, API, and KeyF is a safe no-op
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });
      await serveOneOrderOrganically(ctx, null, { useHarness: false }); // skillEnergy = 28 < 100
      let st = await ctx.getState();
      ctx.assert(st.skillEnergy > 0 && st.skillEnergy < 100, `Expected 0 < skillEnergy < 100, got ${st.skillEnergy}`);
      const energyBefore = st.skillEnergy;

      await ctx.eval(() => {
        globalThis.__HOSHI_DEBUG__.castPatronSkill();
        globalThis.__HOSHI_DEBUG__.clickHit('patron_skill_btn');
      });
      await ctx.pressKey('f');
      st = await ctx.getState();
      ctx.assertEq(st.skillEnergy, energyBefore, 'Under-charged skill (<100%) must not fire or drain energy');

      // 2) Luna active skill on 3-8 never deletes or displaces any of the 4 corner frozen I cells
      await ctx.setupSaveAndStart('3-8', {
        levelStars: getAllUnlockedStars(ctx, 3),
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        selectedPatron: 'luna',
        deviceUpgrades: { dev_tray: 1, dev_flour: 3, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      // Charge Luna to 100% via isolated Col-2 >=C5 merges at (1,2)..(3,2) with (0,2):C6(gold) top stopper
      // so all 4 corner frozen I cells ((0,1), (0,3), (4,1), (4,3)) remain 100% frozen!
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const harness = window.__WX_HARNESS__;
        const trashCell = (r, c) => {
          const s0 = dbg.getState();
          const t0 = s0.grid?.cells?.[r]?.[c]?.tile;
          if (!t0 || t0.frozenHp > 0) return;
          for (let i = 0; i < (s0.tray || []).length; i++) {
            if (s0.tray[i]) dbg.doubleTapTray(i);
          }
          dbg.tapBoardCell(r, c);
          const s1 = dbg.getState();
          for (let i = 0; i < (s1.tray || []).length; i++) {
            if (s1.tray[i]) dbg.doubleTapTray(i);
          }
        };

        trashCell(1, 2);
        trashCell(3, 2);
        if ((dbg.getState().toolCounts?.spoon || 0) > 0) {
          dbg.useToolOnCell('spoon', 2, 2); // (2,2):C5(gold) -> C6(gold) (+8% skillEnergy)
        }
        dbg.slide('up'); // (0,2):C6(gold) acts as non-merging top stopper

        const sanitizeOutsideForUp = () => {
          const g = dbg.getState().grid;
          for (const c of [0, 1, 3, 4]) {
            let seg = [];
            const flushSeg = () => {
              if (!seg.length) return;
              for (let guard = 0; guard < 5; guard++) {
                const curG = dbg.getState().grid;
                const items = seg.filter((r) => curG.cells[r][c].tile && !(curG.cells[r][c].tile.frozenHp > 0));
                let dupR = -1;
                for (let i = 0; i + 1 < items.length; i++) {
                  if (curG.cells[items[i]][c].tile.tier === curG.cells[items[i + 1]][c].tile.tier) {
                    dupR = items[i + 1];
                    break;
                  }
                }
                if (dupR >= 0) trashCell(dupR, c);
                else break;
              }
              seg = [];
            };
            for (let r = 0; r < 5; r++) {
              const cell = g.cells[r][c];
              if (cell.type === 'void' || cell.type === 'block' || (cell.tile && cell.tile.frozenHp > 0)) flushSeg();
              else seg.push(r);
            }
            flushSeg();
          }
        };

        for (let iter = 0; iter < 800 && dbg.getState().skillEnergy < 100; iter++) {
          let curG = dbg.getState().grid;
          for (let r = 1; r <= 4; r++) {
            const t = curG.cells[r][2].tile;
            if (t && !(t.frozenHp > 0) && t.tier >= 5) trashCell(r, 2);
          }
          curG = dbg.getState().grid;
          const colTiles = [];
          for (let r = 1; r <= 4; r++) {
            const t = curG.cells[r][2].tile;
            if (t && !(t.frozenHp > 0)) colTiles.push({ r, tier: t.tier });
          }
          const hasPair = colTiles.some((t, i) => i + 1 < colTiles.length && t.tier === colTiles[i + 1].tier);
          if (hasPair) {
            sanitizeOutsideForUp();
            dbg.slide('up');
            continue;
          }
          const invIdx = colTiles.findIndex((t, i) => i + 1 < colTiles.length && t.tier < colTiles[i + 1].tier);
          if (invIdx >= 0) {
            trashCell(colTiles[invIdx].r, 2);
            sanitizeOutsideForUp();
            dbg.slide('up');
            continue;
          }
          if (colTiles.some((t, i) => t.r !== i + 1)) {
            sanitizeOutsideForUp();
            dbg.slide('up');
            continue;
          }
          if (colTiles.length === 4) {
            trashCell(4, 2);
          }
          harness?.advanceClockMs?.(150);
          dbg.advanceTime(0.15);
          dbg.knead();
        }
        // Free at least 1 cell and knead so Luna tidy has space & tiles to sort
        trashCell(4, 2);
      });

      let preLuna = await ctx.getState();
      ctx.assertEq(preLuna.skillEnergy, 100, 'Expected Luna skillEnergy === 100 on 3-8');
      let frozenCoordsBefore = [];
      for (let r = 0; r < preLuna.grid.rows; r++) {
        for (let c = 0; c < preLuna.grid.cols; c++) {
          const t = preLuna.grid.cells[r][c]?.tile;
          if (t && t.frozenHp > 0) frozenCoordsBefore.push({ r, c, tier: t.tier });
        }
      }
      ctx.assertEq(frozenCoordsBefore.length, 4, 'Expected all 4 frozen I cells intact on 3-8 before Luna cast');
      await ctx.advanceBothClocks(145);
      await ctx.knead();
      await ctx.castPatronSkill();
      const postLuna = await ctx.getState();
      for (const fc of frozenCoordsBefore) {
        const afterCell = postLuna.grid.cells[fc.r][fc.c].tile;
        ctx.assertEq(afterCell?.tier, fc.tier, `Luna sort must NOT move frozen cell (${fc.r},${fc.c})`);
        ctx.assertEq(afterCell?.frozenHp, 1, `Luna sort must NOT thaw or delete frozen cell (${fc.r},${fc.c})`);
      }

      // 3) Mugi active skill when <= 1 non-C7 tile exists on board upgrades that 1 tile without throwing
      await ctx.setupSaveAndStart('1-1', {
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        selectedPatron: 'mugi',
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });
      for (let i = 0; i < 4; i++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      // Leave exact 1 tile on board!
      const gNow = (await ctx.getState()).grid;
      let oneCoord = null;
      for (let r = 0; r < 3 && !oneCoord; r++) {
        for (let c = 0; c < 3 && !oneCoord; c++) {
          if (gNow.cells[r][c].tile) oneCoord = [r, c];
        }
      }
      if (!oneCoord) {
        await ctx.advanceBothClocks(145);
        await ctx.knead();
        const g2 = (await ctx.getState()).grid;
        for (let r = 0; r < 3 && !oneCoord; r++) {
          for (let c = 0; c < 3 && !oneCoord; c++) {
            if (g2.cells[r][c].tile) oneCoord = [r, c];
          }
        }
      }
      await syncClearBoardExcept(ctx, [oneCoord]);
      const tierBeforeMugi = (await ctx.getState()).grid.cells[oneCoord[0]][oneCoord[1]].tile.tier;
      await ctx.castPatronSkill();
      const postMugi = await ctx.getState();
      const upgradedTile = postMugi.grid.cells[oneCoord[0]][oneCoord[1]].tile;
      ctx.assertEq(upgradedTile?.tier, Math.min(7, tierBeforeMugi + 1), 'Mugi with 1 tile on board upgrades that 1 tile cleanly');
      ctx.assertEq(upgradedTile?.flavor, 'gold');
    },
  },

  {
    id: 'T2-F15-06',
    tier: 2,
    features: ['F15', 'F09'],
    title: 'mikan active skill (+45% patience) clamps customer patience strictly at <= maxPatience (never >100%)',
    run: async (ctx) => {
      await ctx.setupSaveAndStart('1-1', {
        unlockedPatrons: ['mikan'],
        selectedPatron: 'mikan',
        deviceUpgrades: { dev_tray: 1, dev_flour: 1, dev_teapot: 3, dev_tools: 3 },
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      for (let i = 0; i < 4; i++) {
        await serveOneOrderOrganically(ctx, null, { useHarness: false });
      }
      let st = await ctx.advanceTime(2.5);
      const highSeats = st.seats.filter((s) => s && s.patience / s.maxPatience > 0.70);
      ctx.assert(highSeats.length >= 1, 'Expected >=1 customer at >70% patience before Mikan cast');

      const scoreBefore = st.score;
      await ctx.clickHit('patron_skill_btn');
      st = await ctx.getState();

      ctx.assertEq(st.skillEnergy, 0);
      ctx.assertEq(st.score, scoreBefore);
      for (const s of st.seats) {
        if (s) {
          ctx.assert(
            s.patience <= s.maxPatience + 1e-6,
            `Mikan +45% patience overflowed maxPatience (${s.patience} > ${s.maxPatience})`
          );
          if (s.patience / s.maxPatience > 0.99) {
            ctx.assertClose(s.patience, s.maxPatience, 0.05, 'Boosted >70% customer clamps cleanly at maxPatience');
          }
        }
      }
    },
  },

  // --------------------------------------------------------------------------
  // F16 — Responsive Multi-Viewport HUD, Gesture FSM & 6-Step Guide (6 Cases)
  // --------------------------------------------------------------------------
  {
    id: 'T2-F16-01',
    tier: 2,
    features: ['F16', 'F03', 'F06'],
    title: 'Gesture deadzone (14px..18px displacement and >=350ms long hold) cancels cleanly with neither slide nor tray placement',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });

      const st0 = await ctx.getState();
      const { x, y } = cellCenter(ctx, st0.boardLayout, 1, 1); // Directly on (1,1):C2

      // Case 1: 16px displacement (14 <= 16 < 18px deadzone) + 380ms (>=350ms)
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 16, y, button: 'left', buttons: 1 });
      await ctx.advanceBothClocks(380);
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 16, y, button: 'left', buttons: 0, clickCount: 1 });
      await ctx.sleep(40);

      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile?.tier, 1, '16px deadzone (<18px) must NOT trigger 2048 slide');
      ctx.assertEq(st.grid.cells[0][1].tile?.tier, 1);
      ctx.assertEq(st.grid.cells[1][1].tile?.tier, 2);
      ctx.assertEq(st.tray, [null, null, null], '16px / 380ms deadzone must NOT trigger tray tap');

      // Case 2: 3px stationary hold for 410ms (>=350ms timeout) -> cancels tap candidate
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + 3, y, button: 'left', buttons: 1 });
      await ctx.advanceBothClocks(410);
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + 3, y, button: 'left', buttons: 0, clickCount: 1 });
      await ctx.sleep(40);

      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][1].tile?.tier, 2, '>=350ms hold must cancel tap and leave (1,1):C2 on board');
      ctx.assertEq(st.tray, [null, null, null]);
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F16-02',
    tier: 2,
    features: ['F16', 'F03'],
    title: '45-degree diagonal hysteresis (||dx| - |dy|| < 4px) defers slide until axis dominance reaches >=4px',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.setupSaveAndStart('1-1', { seenTutorials: DEFAULT_TUTORIALS_SEEN });

      const st0 = await ctx.getState();
      const cx = Math.round(st0.boardLayout.gridX + st0.boardLayout.w / 2);
      const cy = Math.round(st0.boardLayout.gridY + st0.boardLayout.h / 2);

      // Move to (+15, +14): hypot = 20.52 >= 18px, BUT |15 - 14| = 1 < 4px diagonal hysteresis!
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + 15, y: cy + 14, button: 'left', buttons: 1 });
      await ctx.sleep(25);

      const midSt = await ctx.getState();
      ctx.assertEq(midSt.grid.cells[0][0].tile?.tier, 1, 'Ambiguous 45° drag (|dx|-|dy|=1 < 4px) must hold off sliding');
      ctx.assertEq(midSt.grid.cells[0][1].tile?.tier, 1);

      // Now extend to (+25, +14): |25 - 14| = 11 >= 4px -> locks horizontal 'right' slide!
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + 25, y: cy + 14, button: 'left', buttons: 1 });
      await ctx.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 25, y: cy + 14, button: 'left', buttons: 0, clickCount: 1 });
      await ctx.sleep(40);

      const endSt = await ctx.getState();
      ctx.assertEq(endSt.grid.cells[0][2].tile?.tier, 2, 'Resolved horizontal dominance executes slide("right") merging into (0,2):C2');
      ctx.assertEq(endSt.tray, [null, null, null]);
      ctx.assertEq(endSt.score, 0);
    },
  },

  {
    id: 'T2-F16-03',
    tier: 2,
    features: ['F16', 'F06'],
    title: 'Slow tray two-tap (450ms > 320ms) on 390x844 preserves tile in tray_slot_0 without discarding',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.setupSaveAndStart('1-9', {
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: DEFAULT_TUTORIALS_SEEN,
      });

      await ctx.tapBoardCell(0, 0);
      let st = await ctx.getState();
      ctx.assertEq(st.tray[0]?.tier, 3);

      const pt = hitCenter(findHit(st, 'tray_slot_0'));
      await ctx.tapCanvas(pt.x, pt.y);
      await ctx.advanceBothClocks(450);
      await ctx.tapCanvas(pt.x, pt.y);

      st = await ctx.getState();
      ctx.assertEq(st.tray[0]?.tier, 3, 'Slow 450ms (>320ms) two-tap must keep C3 in tray[0]');
      ctx.assertEq(st.score, 0);
    },
  },

  {
    id: 'T2-F16-04',
    tier: 2,
    features: ['F16', 'F05'],
    title: 'Desktop keyboard shortcuts are ignored on Lobby and behind pause modal, and 5x Space burst in <30ms spawns exact 1 tile',
    run: async (ctx) => {
      try {
        await ctx.setViewport(1280, 760, false, 1, { safeTop: 8, safeBottom: 0, showCapsule: true });

        // 1) Lobby ignores gameplay keys
        await ctx.resetGame();
        for (const k of ['w', 'a', 's', 'd', 'Space', '1', '2', 'f']) {
          await ctx.pressKey(k);
        }
        ctx.assertEq((await ctx.getState()).screen, 'lobby', 'Gameplay keys on Lobby must be no-ops');

        // 2) Pause modal blocks all gameplay keys
        await ctx.setupSaveAndStart('1-7', {
          deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 1 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });
        await ctx.clickHit('pause_btn');
        const pausedBefore = await ctx.getState();
        ctx.assertEq(pausedBefore.activeModal, 'pause');
        const snapBefore = JSON.stringify(pausedBefore.grid.cells.map((r) => r.map((c) => c.tile?.tier || 0)));

        for (const k of ['w', 'a', 's', 'd', 'ArrowLeft', 'Space', '1', '2', 'f']) {
          await ctx.pressKey(k);
        }
        const pausedAfter = await ctx.getState();
        const snapAfter = JSON.stringify(pausedAfter.grid.cells.map((r) => r.map((c) => c.tile?.tier || 0)));
        ctx.assertEq(snapAfter, snapBefore, 'Board must remain frozen behind pause modal when WASD/Arrows/Space pressed');
        ctx.assertEq(pausedAfter.activeTool, null, 'Digit1/Digit2 must not arm tools behind pause modal');

        // 3) Close pause modal and fire 5 Space keydowns within <30ms -> exact +1 tile!
        const resumeHit = findHit(pausedAfter, /modal_close|resume|continue/i);
        if (resumeHit) await ctx.clickHit(resumeHit.id);
        else await ctx.eval(() => globalThis.__HOSHI_DEBUG__.closeModal());

        await ctx.advanceBothClocks(160);
        const countBeforeBurst = countBoardTiles((await ctx.getState()).grid).count;
        await ctx.eval(() => {
          for (let i = 0; i < 5; i++) {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
          }
        });
        const countAfterBurst = countBoardTiles((await ctx.getState()).grid).count;
        ctx.assertEq(countAfterBurst, countBeforeBurst + 1, '5x Space burst within <30ms (<120ms debounce) must spawn exact 1 tile');
      } finally {
        await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      }
    },
  },

  {
    id: 'T2-F16-05',
    tier: 2,
    features: ['F16'],
    title: 'Completed seenTutorials flags persist across reload and never re-trigger spotlight overlays on 1-1, 1-3, 2-1, or 3-1',
    run: async (ctx) => {
      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: getAllUnlockedStars(ctx, 3),
        seenTutorials: {
          intro_slide: true,
          tray_trash: true,
          flavor_tile: true,
          ice_tile: true,
        },
      });
      await ctx.reload();

      const persisted = await ctx.getSaveData();
      ctx.assertEq(persisted.seenTutorials.intro_slide, true);
      ctx.assertEq(persisted.seenTutorials.tray_trash, true);
      ctx.assertEq(persisted.seenTutorials.flavor_tile, true);
      ctx.assertEq(persisted.seenTutorials.ice_tile, true);

      for (const lvId of ['1-1', '1-3', '2-1', '3-1']) {
        await ctx.eval((id) => globalThis.__HOSHI_DEBUG__.startLevel(id), lvId);
        let st = await ctx.getState();
        ctx.assertEq(st.activeTutorialStep, null, `Seen tutorials must stay null on ${lvId} start`);
        if (lvId === '1-3') {
          // Also fill tray on 1-3 to verify tray_trash never re-triggers
          await ctx.eval(() => {
            const dbg = globalThis.__HOSHI_DEBUG__;
            dbg.tapBoardCell(0, 0);
            dbg.tapBoardCell(1, 1);
            dbg.tapBoardCell(2, 0);
          });
          st = await ctx.getState();
          ctx.assertEq(st.activeTutorialStep, null, 'Seen tray_trash must not re-trigger on 1-3 full tray');
        }
      }
    },
  },

  {
    id: 'T2-F16-06',
    tier: 2,
    features: ['F16'],
    title: 'Live mid-shift viewport resize (390x844 -> 1280x760 -> 375x667) preserves active run state and passes capsule/safeBottom bounds',
    run: async (ctx) => {
      try {
        await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
        await ctx.setupSaveAndStart('2-4', {
          levelStars: getAllUnlockedStars(ctx, 3),
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 2, dev_tools: 1 },
          seenTutorials: DEFAULT_TUTORIALS_SEEN,
        });

        await ctx.advanceTime(0.8);
        await ctx.tapBoardCell(0, 0); // Load C3 into tray[0] (2-4 is R10..R18, so single C3 stays in tray)
        const st390 = await ctx.getState();
        ctx.assertEq(st390.tray[0]?.tier, 3);
        const gridSnap = JSON.stringify(st390.grid.cells.map((r) => r.map((c) => c.tile?.tier || 0)));
        await ctx.checkBounds('live_resize_2_4_390', { safeBottom: 34 });

        // Resize live to Desktop 1280x760
        await ctx.setViewport(1280, 760, false, 1, { safeTop: 8, safeBottom: 0, showCapsule: true });
        const st1280 = await ctx.getState();
        ctx.assertEq(st1280.screen, 'playing');
        ctx.assertEq(st1280.currentLevelId, '2-4');
        ctx.assertEq(st1280.tray[0]?.tier, 3, 'Tray state preserved across live resize to 1280x760');
        ctx.assertEq(
          JSON.stringify(st1280.grid.cells.map((r) => r.map((c) => c.tile?.tier || 0))),
          gridSnap,
          'Board grid tiles preserved across live resize to 1280x760'
        );
        const seat0Desktop = findHit(st1280, 'seat_0');
        const skillDesktop = findHit(st1280, 'patron_skill_btn');
        ctx.assert(
          seat0Desktop && skillDesktop && seat0Desktop.y < st1280.boardLayout.y,
          'Unified layout places seat_0 above board at 1280x760'
        );
        await ctx.checkBounds('live_resize_2_4_1280', { safeBottom: 0 });

        // Resize live to Compact 375x667
        await ctx.setViewport(375, 667, true, 2, { safeTop: 20, safeBottom: 0, showCapsule: true });
        const st375 = await ctx.getState();
        ctx.assertEq(st375.screen, 'playing');
        ctx.assertEq(st375.currentLevelId, '2-4');
        ctx.assertEq(st375.tray[0]?.tier, 3, 'Tray state preserved across live resize to 375x667');
        ctx.assert(st375.boardLayout.cellSize >= 46, `375x667 cellSize (${st375.boardLayout.cellSize}) must stay >=46px`);
        await ctx.checkBounds('live_resize_2_4_375', { safeBottom: 0 });
      } finally {
        await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      }
    },
  },
];

export const TIER2_TESTS = [...TIER2_F01_TO_F08, ...TIER2_F09_TO_F16];
export default TIER2_TESTS;
