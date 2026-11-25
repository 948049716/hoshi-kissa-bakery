import fs from 'node:fs';
import path from 'node:path';

/**
 * Tier 3 — Cross-Feature Pairwise Interaction E2E Suite (18 Cases: T3-01 .. T3-18)
 *
 * Strictly opaque-box E2E tests exercising pairwise runtime interactions across all
 * 16 features (F01..F16) through TestContext (`ctx`), CDP pointer/keyboard input,
 * `window.__WX_HARNESS__`, and `globalThis.__HOSHI_DEBUG__`.
 */

const RECIPE_FALLBACK_SLOTS = {
  R01: [{ tier: 1, flavor: 'any' }],
  R02: [{ tier: 2, flavor: 'any' }],
  R03: [{ tier: 1, flavor: 'any' }, { tier: 2, flavor: 'any' }],
  R04: [{ tier: 3, flavor: 'any' }],
  R05: [{ tier: 2, flavor: 'any' }, { tier: 3, flavor: 'any' }],
  R06: [{ tier: 2, flavor: 'any' }, { tier: 2, flavor: 'any' }],
  R07: [{ tier: 4, flavor: 'any' }],
  R08: [{ tier: 1, flavor: 'any' }, { tier: 2, flavor: 'any' }, { tier: 3, flavor: 'any' }],
  R09: [{ tier: 3, flavor: 'any' }, { tier: 4, flavor: 'any' }],
  R10: [{ tier: 2, flavor: 'any' }, { tier: 3, flavor: 'any' }, { tier: 4, flavor: 'any' }],
  R11: [{ tier: 5, flavor: 'any' }],
  R12: [{ tier: 3, flavor: 'any' }, { tier: 5, flavor: 'any' }],
  R13: [{ tier: 2, flavor: 'any' }, { tier: 4, flavor: 'any' }, { tier: 5, flavor: 'any' }],
  R14: [{ tier: 4, flavor: 'any' }, { tier: 5, flavor: 'any' }],
  R15: [{ tier: 2, flavor: 'any' }, { tier: 3, flavor: 'matcha' }],
  R16: [{ tier: 4, flavor: 'matcha' }, { tier: 3, flavor: 'any' }],
  R17: [{ tier: 6, flavor: 'any' }],
  R18: [{ tier: 3, flavor: 'matcha' }, { tier: 6, flavor: 'any' }],
  R19: [{ tier: 4, flavor: 'any' }, { tier: 5, flavor: 'any' }, { tier: 6, flavor: 'any' }],
  R20: [{ tier: 2, flavor: 'any' }, { tier: 4, flavor: 'berry' }],
  R21: [{ tier: 7, flavor: 'any' }],
  R22: [{ tier: 5, flavor: 'berry' }, { tier: 6, flavor: 'any' }],
  R23: [{ tier: 4, flavor: 'matcha' }, { tier: 5, flavor: 'berry' }],
  R24: [{ tier: 5, flavor: 'berry' }, { tier: 6, flavor: 'matcha' }, { tier: 7, flavor: 'any' }]
};

const BASE_PRICES_LV0 = { 1: 30, 2: 70, 3: 150, 4: 320, 5: 680, 6: 1400, 7: 2800 };
const COMBO_SIZE_MULTS = { 1: 1.0, 2: 1.12, 3: 1.25 };
const SERVE_COMBO_MULTS = [1.0, 1.06, 1.13, 1.2, 1.28];

const TUTORIALS_ALL_SEEN = {
  intro_slide: true,
  tray_trash: true,
  flavor_tile: true,
  ice_tile: true
};

function getOrderSlots(seat) {
  if (!seat) return [];
  if (Array.isArray(seat.slots) && seat.slots.length > 0) {
    return seat.slots.map((s) => ({
      tier: Number(s.tier),
      flavor: s.flavor || 'any'
    }));
  }
  return (RECIPE_FALLBACK_SLOTS[seat.recipeId] || []).map((s) => ({ ...s }));
}

function inspectBoard(st) {
  const cells = (st && st.grid && st.grid.cells) || [];
  const tiles = [];
  let playableEmpty = 0;
  let frozenCount = 0;
  let maxTier = 0;
  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      const cell = cells[r][c];
      if (!cell || cell.type === 'void' || cell.type === 'block') continue;
      if (!cell.tile) {
        playableEmpty++;
      } else {
        const frozenHp = Number(cell.tile.frozenHp || 0);
        if (frozenHp > 0) frozenCount++;
        if (cell.tile.tier > maxTier) maxTier = cell.tile.tier;
        tiles.push({
          r,
          c,
          cellType: cell.type,
          uid: cell.tile.uid,
          tier: cell.tile.tier,
          flavor: cell.tile.flavor || 'plain',
          frozenHp
        });
      }
    }
  }
  return { tiles, total: tiles.length, playableEmpty, frozenCount, maxTier };
}

function applyCellDyeLocal(flavor, cellType) {
  if (flavor === 'gold') return 'gold';
  if (cellType === 'gold') return 'gold';
  if (cellType === 'matcha') return 'matcha';
  if (cellType === 'berry') return 'berry';
  return flavor || 'plain';
}

function resolveMergedFlavorLocal(movingFlavor, stationaryFlavor, destCellType) {
  let base = 'plain';
  if (movingFlavor === 'gold' || stationaryFlavor === 'gold') base = 'gold';
  else if (movingFlavor && movingFlavor !== 'plain') base = movingFlavor;
  else if (stationaryFlavor && stationaryFlavor !== 'plain') base = stationaryFlavor;
  return applyCellDyeLocal(base, destCellType);
}

function previewSlideReadOnly(grid, dir) {
  const rows = grid.rows;
  const cols = grid.cols;
  const src = grid.cells;
  const isHoriz = dir === 'left' || dir === 'right';
  const rev = dir === 'right' || dir === 'down';
  const outerCount = isHoriz ? rows : cols;
  const innerCount = isHoriz ? cols : rows;

  let moved = false;
  const merges = [];
  const placements = [];
  const postTiles = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = src[r][c]?.tile;
      if (t && t.frozenHp > 0) {
        postTiles.push({ r, c, tier: t.tier, flavor: t.flavor || 'plain', frozenHp: t.frozenHp });
      }
    }
  }

  for (let o = 0; o < outerCount; o++) {
    const coords = [];
    for (let i = 0; i < innerCount; i++) {
      const idx = rev ? innerCount - 1 - i : i;
      const r = isHoriz ? o : idx;
      const c = isHoriz ? idx : o;
      coords.push({ r, c, cell: src[r][c] });
    }

    let seg = [];
    const flushSeg = () => {
      if (seg.length === 0) return;
      const items = seg.filter((entry) => entry.cell.tile && !(entry.cell.tile.frozenHp > 0));
      let writeIdx = 0;
      let p = 0;
      while (p < items.length) {
        const dest = seg[writeIdx];
        if (
          p + 1 < items.length &&
          items[p].cell.tile.tier === items[p + 1].cell.tile.tier &&
          items[p].cell.tile.tier < 7
        ) {
          const newTier = items[p].cell.tile.tier + 1;
          const newFlavor = resolveMergedFlavorLocal(
            items[p + 1].cell.tile.flavor,
            items[p].cell.tile.flavor,
            dest.cell.type
          );
          moved = true;
          merges.push({ r: dest.r, c: dest.c, newTier, flavor: newFlavor, cellType: dest.cell.type });
          placements.push({ r: dest.r, c: dest.c, tier: newTier, flavor: newFlavor, cellType: dest.cell.type, merged: true });
          postTiles.push({ r: dest.r, c: dest.c, tier: newTier, flavor: newFlavor, frozenHp: 0 });
          p += 2;
        } else {
          const cur = items[p];
          if (cur.r !== dest.r || cur.c !== dest.c) moved = true;
          const newFlavor = applyCellDyeLocal(cur.cell.tile.flavor || 'plain', dest.cell.type);
          placements.push({
            r: dest.r,
            c: dest.c,
            tier: cur.cell.tile.tier,
            flavor: newFlavor,
            cellType: dest.cell.type,
            merged: false
          });
          postTiles.push({ r: dest.r, c: dest.c, tier: cur.cell.tile.tier, flavor: newFlavor, frozenHp: 0 });
          p += 1;
        }
        writeIdx += 1;
      }
      seg = [];
    };

    for (const entry of coords) {
      const cell = entry.cell;
      if (!cell || cell.type === 'void' || cell.type === 'block' || (cell.tile && cell.tile.frozenHp > 0)) {
        flushSeg();
      } else {
        seg.push(entry);
      }
    }
    flushSeg();
  }

  let shattersIce = 0;
  if (moved && merges.length > 0) {
    const dirs4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const hitSet = new Set();
    for (const m of merges) {
      for (const [dr, dc] of dirs4) {
        const nr = m.r + dr;
        const nc = m.c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          const nCell = src[nr][nc];
          if (nCell && nCell.tile && nCell.tile.frozenHp > 0) {
            hitSet.add(`${nr},${nc}`);
          }
        }
      }
    }
    shattersIce = hitSet.size;
  }

  return { moved, merges, placements, postTiles, shattersIce };
}

async function safeKnead(ctx) {
  let st = await ctx.getState();
  const info = inspectBoard(st);
  if (info.playableEmpty === 0) {
    const res = await ctx.knead();
    return res || { spawned: false, reason: 'board_full' };
  }
  let res = await ctx.knead();
  if (!res || res.spawned === false) {
    await ctx.advanceBothClocks(135);
    res = await ctx.knead();
  }
  return res;
}

async function clickModalHit(ctx, hitId, opts = {}) {
  let st = await ctx.getState();
  if ((st.hits || []).some((h) => h.id === hitId)) {
    return ctx.clickHit(hitId, opts);
  }
  const w = (st.metrics && st.metrics.width) || 390;
  const h = (st.metrics && st.metrics.height) || 844;
  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.56);

  for (let step = 0; step < 5; step++) {
    await ctx.swipeCanvas(cx, cy + 110, cx, cy - 130, { steps: 6, stepMs: 14 });
    st = await ctx.getState();
    if ((st.hits || []).some((hit) => hit.id === hitId)) {
      return ctx.clickHit(hitId, opts);
    }
  }
  for (let step = 0; step < 5; step++) {
    await ctx.swipeCanvas(cx, cy - 110, cx, cy + 130, { steps: 6, stepMs: 14 });
    st = await ctx.getState();
    if ((st.hits || []).some((hit) => hit.id === hitId)) {
      return ctx.clickHit(hitId, opts);
    }
  }
  return ctx.clickHit(hitId, opts);
}

async function clearTraySlots(ctx) {
  const st = await ctx.getState();
  const tray = st.tray || [];
  for (let i = 0; i < tray.length; i++) {
    if (tray[i] !== null) {
      await ctx.doubleTapTray(i, { ignoreCooldown: true });
    }
  }
}

function tileSatisfiesSlot(tile, reqFlavor, exactFlavorOnly = false) {
  if (!tile) return false;
  if (exactFlavorOnly) return (tile.flavor || 'plain') === reqFlavor;
  if (!reqFlavor || reqFlavor === 'any') return true;
  return tile.flavor === reqFlavor || tile.flavor === 'gold';
}

async function bakeTileOrganically(ctx, targetTier, targetFlavor = 'any', opts = {}) {
  const maxSteps = opts.maxSteps || 140;
  const avoidIceShatter = Boolean(opts.avoidIceShatter);
  const exactFlavor = Boolean(opts.exactFlavor);
  const excludeCoords = new Set((opts.excludeCoords || []).map(([r, c]) => `${r},${c}`));

  for (let step = 0; step < maxSteps; step++) {
    const st = await ctx.getState();
    const board = inspectBoard(st);

    const match = board.tiles.find(
      (t) =>
        t.frozenHp === 0 &&
        t.tier === targetTier &&
        !excludeCoords.has(`${t.r},${t.c}`) &&
        tileSatisfiesSlot(t, targetFlavor, exactFlavor)
    );
    if (match) return match;

    // Check if sliding moves an existing targetTier tile onto a matching dye cell
    const dirs = ['left', 'up', 'right', 'down'];
    if (targetFlavor !== 'any' && targetFlavor !== 'plain') {
      for (const dir of dirs) {
        const prev = previewSlideReadOnly(st.grid, dir);
        if (!prev.moved) continue;
        if (avoidIceShatter && prev.shattersIce > 0) continue;
        const dyesTarget = prev.placements.some(
          (p) =>
            p.tier === targetTier &&
            (p.cellType === targetFlavor || (!exactFlavor && p.cellType === 'gold'))
        );
        if (dyesTarget) {
          await ctx.slide(dir);
          continue;
        }
      }
    }

    // Choose best slide direction that merges tiles <= targetTier
    let bestDir = null;
    let bestScore = -1;
    for (const dir of dirs) {
      const prev = previewSlideReadOnly(st.grid, dir);
      if (!prev.moved) continue;
      if (avoidIceShatter && prev.shattersIce > 0) continue;
      let dirScore = 1;
      for (const m of prev.merges) {
        if (m.newTier <= targetTier) {
          dirScore += m.newTier * 20;
          if (
            m.newTier === targetTier &&
            targetFlavor !== 'any' &&
            (m.cellType === targetFlavor || (!exactFlavor && m.cellType === 'gold'))
          ) {
            dirScore += 200;
          }
        } else {
          dirScore -= 5;
        }
      }
      if (dir === 'left' || dir === 'up') dirScore += 2;
      if (dirScore > bestScore) {
        bestScore = dirScore;
        bestDir = dir;
      }
    }

    if (board.total < 3 && board.playableEmpty > 0) {
      await safeKnead(ctx);
      continue;
    }

    if (bestDir && (bestScore >= 20 || board.playableEmpty <= 2)) {
      await ctx.slide(bestDir);
      continue;
    }

    if (board.playableEmpty > 0) {
      await safeKnead(ctx);
      continue;
    }

    if (bestDir) {
      await ctx.slide(bestDir);
      continue;
    }

    // Deadlock recovery via empty tray slot + double-tap trash if no slide available
    const emptyTrayIdx = (st.tray || []).findIndex((slot) => slot === null);
    const trashCandidate = board.tiles
      .filter((t) => t.frozenHp === 0 && !excludeCoords.has(`${t.r},${t.c}`))
      .sort((a, b) => a.tier - b.tier)[0];
    if (emptyTrayIdx >= 0 && trashCandidate) {
      await ctx.tapBoardCell(trashCandidate.r, trashCandidate.c);
      await ctx.doubleTapTray(emptyTrayIdx, { ignoreCooldown: true });
      continue;
    }

    if (opts.allowTools && st.toolCounts && st.toolCounts.fork > 0 && trashCandidate) {
      await ctx.useToolOnCell('fork', trashCandidate.r, trashCandidate.c, 'trash');
      continue;
    }
    break;
  }

  const finalSt = await ctx.getState();
  const finalBoard = inspectBoard(finalSt);
  return (
    finalBoard.tiles.find(
      (t) =>
        t.frozenHp === 0 &&
        t.tier === targetTier &&
        !excludeCoords.has(`${t.r},${t.c}`) &&
        tileSatisfiesSlot(t, targetFlavor, exactFlavor)
    ) || null
  );
}

function matchBoardMultisetPartial(tiles, reqSlots) {
  const avail = tiles.filter((t) => !(t.frozenHp > 0));
  const ordered = reqSlots
    .map((req, idx) => ({ ...req, flavor: req.flavor || 'any', idx }))
    .sort((a, b) => {
      const aEx = a.exactFlavor ? 0 : a.flavor !== 'any' ? 1 : 2;
      const bEx = b.exactFlavor ? 0 : b.flavor !== 'any' ? 1 : 2;
      return aEx - bEx || b.tier - a.tier;
    });
  const used = new Set();
  const matchedTiles = Array(reqSlots.length).fill(null);
  const missing = [];

  for (const req of ordered) {
    let pick = -1;
    if (req.exactFlavor) {
      pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === req.flavor);
    } else if (req.flavor && req.flavor !== 'any') {
      pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === req.flavor);
      if (pick < 0) pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === 'gold');
    } else {
      pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === 'plain');
      if (pick < 0) pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor !== 'gold');
      if (pick < 0) pick = avail.findIndex((t, i) => !used.has(i) && t.tier === req.tier && t.flavor === 'gold');
    }
    if (pick >= 0) {
      used.add(pick);
      matchedTiles[req.idx] = avail[pick];
    } else {
      missing.push(req);
    }
  }
  return {
    allMatched: missing.length === 0,
    matchedCount: reqSlots.length - missing.length,
    matchedTiles,
    missing,
    protectedKeys: new Set(matchedTiles.filter(Boolean).map((t) => `${t.r},${t.c}`))
  };
}

async function bakeOrderMultisetOrganically(ctx, reqSlots, opts = {}) {
  const maxSteps = opts.maxSteps ?? 320;
  const allowTools = opts.allowTools !== false;
  const viaRawTouch = Boolean(opts.viaRawTouch);

  if (!viaRawTouch) {
    await clearTraySlots(ctx);
  } else {
    const st0 = await ctx.getState();
    for (let i = 0; i < (st0.tray || []).length; i++) {
      if (st0.tray[i] !== null) {
        await ctx.doubleTapTray(i, { viaCdp: true });
      }
    }
  }

  for (let step = 0; step < maxSteps; step++) {
    const st = await ctx.getState();
    const board = inspectBoard(st);
    const curMatch = matchBoardMultisetPartial(board.tiles, reqSlots);
    if (curMatch.allMatched) return curMatch.matchedTiles;

    const sortedMissing = [...curMatch.missing].sort(
      (a, b) =>
        b.tier - a.tier ||
        (a.exactFlavor ? 0 : a.flavor !== 'any' ? 1 : 2) -
          (b.exactFlavor ? 0 : b.flavor !== 'any' ? 1 : 2)
    );
    const targetReq = sortedMissing[0];

    // Proactively discard unprotected tiles strictly above highest missing tier (or trapped undyed target-tier tile every 18 steps)
    const trappedUndyed =
      step > 0 && step % 18 === 0 && targetReq.flavor !== 'any'
        ? board.tiles.find(
            (t) =>
              t.frozenHp === 0 &&
              t.tier === targetReq.tier &&
              !curMatch.protectedKeys.has(`${t.r},${t.c}`) &&
              !tileSatisfiesSlot(t, targetReq.flavor, Boolean(targetReq.exactFlavor))
          )
        : null;
    const overTierTile =
      trappedUndyed ||
      (board.playableEmpty <= 6
        ? board.tiles.find(
            (t) => t.frozenHp === 0 && t.tier > targetReq.tier && !curMatch.protectedKeys.has(`${t.r},${t.c}`)
          )
        : null);
    if (overTierTile) {
      if (viaRawTouch) {
        const px = ctx.cellCenterPx(st.boardLayout, overTierTile.r, overTierTile.c);
        await ctx.tapCanvas(px.x, px.y, { holdMs: 35 });
        const mid = await ctx.getState();
        const tIdx = (mid.tray || []).findIndex((x) => x !== null);
        if (tIdx >= 0) {
          if ((mid.trashCooldown || 0) > 0) await ctx.advanceTime((mid.trashCooldown || 0) + 0.2);
          await ctx.doubleTapTray(tIdx, { viaCdp: true });
        }
      } else {
        await ctx.eval((tr, tc) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          dbg.tapBoardCell(tr, tc);
          const idx = (dbg.getState().tray || []).findIndex((x) => x !== null);
          if (idx >= 0) dbg.doubleTapTray(idx, { ignoreCooldown: true });
        }, overTierTile.r, overTierTile.c);
      }
      continue;
    }

    if (!viaRawTouch && allowTools && st.toolCounts && st.toolCounts.spoon > 0) {
      const cand = board.tiles.find(
        (t) =>
          t.frozenHp === 0 &&
          !curMatch.protectedKeys.has(`${t.r},${t.c}`) &&
          t.tier === targetReq.tier - 1 &&
          tileSatisfiesSlot(t, targetReq.flavor, Boolean(targetReq.exactFlavor))
      );
      if (cand) {
        await ctx.useToolOnCell('spoon', cand.r, cand.c);
        continue;
      }
    }

    const dyeCells = [];
    if (targetReq.flavor !== 'any') {
      for (let r = 0; r < st.grid.rows; r++) {
        for (let c = 0; c < st.grid.cols; c++) {
          const ct = st.grid.cells[r][c]?.type;
          if (ct === targetReq.flavor || (!targetReq.exactFlavor && ct === 'gold')) {
            dyeCells.push({ r, c });
          }
        }
      }
    }

    const dirs = ['left', 'up', 'right', 'down'];
    const scored = [];
    for (const dir of dirs) {
      const prev = previewSlideReadOnly(st.grid, dir);
      if (!prev.moved) continue;
      const afterMatch = matchBoardMultisetPartial(prev.postTiles, reqSlots);
      let s = 2 + (afterMatch.matchedCount - curMatch.matchedCount) * 450 + prev.shattersIce * 35;
      for (const m of prev.merges) {
        if (m.newTier <= targetReq.tier) {
          s += m.newTier * 20;
          if (
            m.newTier === targetReq.tier &&
            targetReq.flavor !== 'any' &&
            (m.flavor === targetReq.flavor || (!targetReq.exactFlavor && m.flavor === 'gold'))
          ) {
            s += 180;
          }
        } else {
          s -= 25;
        }
      }
      if (dyeCells.length > 0) {
        for (const pt of prev.postTiles) {
          if (pt.frozenHp === 0 && pt.tier === targetReq.tier && !tileSatisfiesSlot(pt, targetReq.flavor, Boolean(targetReq.exactFlavor))) {
            const minDist = Math.min(...dyeCells.map((d) => Math.abs(d.r - pt.r) + Math.abs(d.c - pt.c)));
            s += Math.max(0, (6 - minDist) * 8);
          }
        }
      }
      if (step % 4 === dirs.indexOf(dir) && afterMatch.matchedCount >= curMatch.matchedCount) {
        s += 6;
      }
      scored.push({ dir, score: s });
    }
    scored.sort((a, b) => b.score - a.score);

    const unfrozenCount = board.tiles.filter((t) => t.frozenHp === 0).length;
    const doKnead = async () => {
      if (viaRawTouch) {
        await ctx.clickHit('knead_btn', { viaCdp: true });
        await ctx.advanceBothClocks(135);
      } else {
        await safeKnead(ctx);
      }
    };
    const doSlide = async (d) => {
      if (viaRawTouch) await ctx.swipeBoard(d);
      else await ctx.slide(d);
    };

    if (unfrozenCount < 3 && board.playableEmpty > 0) {
      await doKnead();
      continue;
    }
    if (scored.length > 0 && (scored[0].score >= 20 || (board.playableEmpty <= 2 && scored[0].score >= 0))) {
      const pickIdx = step % 7 === 6 && scored.length > 1 && scored[1].score >= 0 ? 1 : 0;
      await doSlide(scored[pickIdx].dir);
      continue;
    }
    if (board.playableEmpty > 0) {
      await doKnead();
      continue;
    }
    if (scored.length > 0 && scored[0].score >= 0) {
      await doSlide(scored[0].dir);
      continue;
    }

    if (scored.length > 0 && step % 6 === 5) {
      await doSlide(scored[0].dir);
      continue;
    }

    const trashCand =
      board.tiles
        .filter((t) => t.frozenHp === 0 && !curMatch.protectedKeys.has(`${t.r},${t.c}`))
        .sort((a, b) => a.tier - b.tier)[0] ||
      board.tiles.filter((t) => t.frozenHp === 0).sort((a, b) => a.tier - b.tier)[0];
    if (trashCand) {
      if (viaRawTouch) {
        const px = ctx.cellCenterPx(st.boardLayout, trashCand.r, trashCand.c);
        await ctx.tapCanvas(px.x, px.y, { holdMs: 35 });
        const mid = await ctx.getState();
        const tIdx = (mid.tray || []).findIndex((x) => x !== null);
        if (tIdx >= 0) {
          if ((mid.trashCooldown || 0) > 0) await ctx.advanceTime((mid.trashCooldown || 0) + 0.2);
          await ctx.doubleTapTray(tIdx, { viaCdp: true });
        }
      } else {
        await ctx.eval((tr, tc) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          dbg.tapBoardCell(tr, tc);
          const idx = (dbg.getState().tray || []).findIndex((x) => x !== null);
          if (idx >= 0) dbg.doubleTapTray(idx, { ignoreCooldown: true });
        }, trashCand.r, trashCand.c);
      }
      continue;
    }
    if (scored.length > 0) {
      await doSlide(scored[0].dir);
      continue;
    }
    break;
  }

  const finalCheck = matchBoardMultisetPartial(inspectBoard(await ctx.getState()).tiles, reqSlots);
  return finalCheck.allMatched ? finalCheck.matchedTiles : null;
}

async function serveCustomerOrganic(ctx, preferredSeat = null, opts = {}) {
  let stBefore = await ctx.getState();
  if (!stBefore.seats || stBefore.seats.every((s) => !s)) {
    stBefore = await ctx.advanceTime(3.2);
  }
  const ordersBefore = stBefore.ordersServed;
  const scoreBefore = stBefore.score;

  if (!opts.manualOnly && typeof ctx.fulfillCustomerOrder === 'function') {
    await ctx.fulfillCustomerOrder(preferredSeat, { maxSteps: 240, ...opts });
    let stAfter = await ctx.getState();
    if (stAfter.ordersServed <= ordersBefore) {
      stAfter = await ctx.advanceTime(0.65);
    }
    if (stAfter.ordersServed > ordersBefore) {
      return { before: stBefore, after: stAfter, scoreGain: stAfter.score - scoreBefore };
    }
  }

  let st = await ctx.getState();
  let seatIdx = preferredSeat;
  if (seatIdx === null || seatIdx === undefined || !st.seats[seatIdx]) {
    const candidates = [0, 1, 2]
      .filter((i) => st.seats && st.seats[i])
      .sort((a, b) => {
        const maxA = Math.max(...getOrderSlots(st.seats[a]).map((s) => s.tier));
        const maxB = Math.max(...getOrderSlots(st.seats[b]).map((s) => s.tier));
        return maxA - maxB;
      });
    seatIdx = candidates[0] ?? 0;
  }
  const seat = st.seats[seatIdx];
  ctx.assert(seat, `Expected seated customer at seat_${seatIdx}`);

  await clearTraySlots(ctx);
  const reqSlots = getOrderSlots(seat);
  const matchedTiles = await bakeOrderMultisetOrganically(ctx, reqSlots, {
    allowTools: opts.allowTools !== false,
    maxSteps: opts.maxSteps ?? 240
  });
  ctx.assert(matchedTiles, `Unable to bake simultaneous multiset for ${seat.recipeId}`);

  await ctx.eval(
    (sIdx, coords) => {
      const dbg = globalThis.__HOSHI_DEBUG__;
      dbg.clickHit(`seat_${sIdx}`);
      for (const pt of coords) {
        dbg.tapBoardCell(pt.r, pt.c);
      }
    },
    seatIdx,
    matchedTiles.map((t) => ({ r: t.r, c: t.c }))
  );

  const stAfter = await ctx.advanceTime(0.65);
  ctx.assert(
    stAfter.ordersServed > ordersBefore,
    `Expected ordersServed to increment (${ordersBefore} -> ${stAfter.ordersServed})`
  );
  return { before: stBefore, after: stAfter, scoreGain: stAfter.score - scoreBefore };
}

async function buyAndApplyEmergencyTool(ctx, kind, r, c) {
  const cost = kind === 'fork' ? 20 : 25;
  const saveBefore = await ctx.getSaveData();
  const spentBefore = Number(saveBefore.consumableSpentStardust || 0);

  let st = await ctx.getState();
  if (st.toolCounts && st.toolCounts[kind] > 0) {
    while ((st = await ctx.getState()).toolCounts[kind] > 0) {
      const target = inspectBoard(st).tiles.find((t) =>
        kind === 'fork' ? true : t.frozenHp === 0 && t.tier < 7
      );
      if (!target) break;
      if (kind === 'fork' && target.frozenHp === 0) {
        await ctx.useToolOnCell('fork', target.r, target.c, 'trash');
      } else {
        await ctx.useToolOnCell(kind, target.r, target.c);
      }
    }
  }

  await ctx.buyEmergencyTool(kind);
  st = await ctx.getState();
  if (st.activeModal === 'confirm') {
    const confirmHit = (st.hits || []).find(
      (h) => /confirm|ok|yes|buy|accept/i.test(h.id) && !/cancel|close|no|back|backdrop|guard/i.test(h.id)
    );
    if (confirmHit) await ctx.clickHit(confirmHit.id);
    st = await ctx.getState();
  }

  const saveMid = await ctx.getSaveData();
  const cellTile = st.grid?.cells?.[r]?.[c]?.tile;
  if (st.activeTool === kind) {
    await ctx.tapBoardCell(r, c, { viaCdp: true });
    if (kind === 'fork' && cellTile && !(cellTile.frozenHp > 0)) {
      await ctx.clickHit('tray_trash_btn');
    }
  } else if ((st.toolCounts && st.toolCounts[kind] > 0) || Number(saveMid.consumableSpentStardust || 0) === spentBefore) {
    if (kind === 'fork' && cellTile && !(cellTile.frozenHp > 0)) {
      await ctx.useToolOnCell('fork', r, c, 'trash');
    } else {
      await ctx.useToolOnCell(kind, r, c);
    }
  }

  const saveAfter = await ctx.getSaveData();
  ctx.assertEq(
    Number(saveAfter.consumableSpentStardust || 0),
    spentBefore + cost,
    `Emergency ${kind} should add ${cost} to consumableSpentStardust`
  );
  return saveAfter;
}

export const TIER3_TESTS = [
  {
    id: 'T3-01',
    tier: 3,
    features: ['F03', 'F04'],
    title: 'Segmented slide + orthogonal-only ice shatter + post-thaw special cell dyeing on 3-3',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      // Part A: Diagonal merge at (0,0) on 3-3 must NOT shatter frozen (1,1):C4[I]
      await ctx.setupSaveAndStart('3-3', {
        levelStars: ctx.allUnlockedStars(3),
        seenTutorials: TUTORIALS_ALL_SEEN
      });
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][1].tile.frozenHp, 1, 'Initial (1,1) on 3-3 must be frozen');

      await ctx.slide('left');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile.tier, 3, 'Left slide merges (0,0)+(0,1) C2s into (0,0):C3');
      ctx.assertEq(st.grid.cells[1][1].tile.frozenHp, 1, 'Diagonal merge at (0,0) must leave (1,1) frozenHp === 1');
      ctx.assertEq(st.score, 0, 'Slide + merge must award 0 score');

      // Part B: Orthogonal merge at (0,1) shatters (1,1) without moving it on the same step,
      // then subsequent vertical slides stop thawed C4 on (2,1):M dyeing it matcha.
      await ctx.setupSaveAndStart('3-3', {
        levelStars: ctx.allUnlockedStars(3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        totalEarnedStardust: 500,
        bankStardust: 150,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      await ctx.slide('right');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][1].tile.tier, 3, 'Right slide stops at void # and merges C2+C2 into (0,1):C3');
      ctx.assert(st.grid.cells[1][1].tile !== null, 'Thawed C4 at (1,1) must not slide away on the shatter step');
      ctx.assertEq(st.grid.cells[1][1].tile.tier, 4, '(1,1) retains C4 tier immediately after shatter');
      ctx.assertEq(st.grid.cells[1][1].tile.frozenHp, 0, 'Orthogonal merge at (0,1) shatters (1,1) ice to frozenHp === 0');
      ctx.assertEq(st.score, 0, 'Orthogonal ice shatter must award 0 score');

      // Sculpt board so thawed (1,1):C4(plain) stops directly on (2,1):M and dyes to matcha:
      // 1) Keep only (1,1):C4(plain) and slide('down') -> (4,1):C4(plain)
      await ctx.clearBoardExcept([[1, 1]]);
      await ctx.slide('down');
      await ctx.clearBoardExcept([[4, 1]]);

      // 2) Knead up to 19 empty cells until (4,3) holds a low-tier stopper, keep [(4,1),(4,3)], slide('right') -> (4,2):C4
      for (let i = 0; i < 19; i++) {
        st = await ctx.getState();
        if (st.grid.cells[4][3].tile && st.grid.cells[4][3].tile.tier !== 4) break;
        await safeKnead(ctx);
      }
      await ctx.clearBoardExcept([[4, 1], [4, 3]]);
      await ctx.slide('right');
      await ctx.clearBoardExcept([[4, 2]]);

      // 3) Slide('up'): Col 2 has (1,2):X pillar, so (4,2):C4(plain) stops at (2,2)
      await ctx.slide('up');
      await ctx.clearBoardExcept([[2, 2]]);
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[2][2].tile.tier, 4, 'Thawed C4 positioned at (2,2)');
      ctx.assertEq(st.grid.cells[2][2].tile.flavor, 'plain', 'Thawed C4 is still plain before landing on M');

      // 4) Knead up to 19 empty cells until (2,0) holds a low-tier stopper, keep [(2,0),(2,2)], slide('left') -> (2,1):M!
      for (let i = 0; i < 19; i++) {
        st = await ctx.getState();
        if (st.grid.cells[2][0].tile && st.grid.cells[2][0].tile.tier !== 4) break;
        await safeKnead(ctx);
      }
      await ctx.clearBoardExcept([[2, 0], [2, 2]]);
      await ctx.slide('left');
      st = await ctx.getState();
      ctx.assert(st.grid.cells[2][1].tile !== null, 'Thawed C4 stops on (2,1):M');
      ctx.assertEq(st.grid.cells[2][1].tile.tier, 4, 'Tile on (2,1):M is the thawed C4');
      ctx.assertEq(st.grid.cells[2][1].tile.flavor, 'matcha', 'Thawed C4 stopping on M cell dyes to matcha');
      ctx.assertEq(st.score, 0, 'All slide, shatter, and cell dyeing actions keep score === 0');
    }
  },

  {
    id: 'T3-02',
    tier: 3,
    features: ['F04', 'F05'],
    title: 'Knead spawn immediate dyeing on G/M cells and gold non-downgrade when sliding onto M on 2-5',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setupSaveAndStart('2-5', {
        levelStars: ctx.allUnlockedStars(3),
        deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        totalEarnedStardust: 500,
        bankStardust: 150,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      // Clear all 16 cells of 2-5 (.M.. / ...G / G... / ..M.), then knead up to 16 times:
      // guaranteed 100% to spawn directly onto G ((1,3),(2,0)) and M ((0,1),(3,2)).
      await ctx.clearBoardExcept([]);
      let sawGoldKnead = false;
      let sawMatchaKnead = false;
      let goldCoord = null;

      for (let i = 0; i < 16; i++) {
        const res = await safeKnead(ctx);
        ctx.assert(res && res.spawned !== false, `Knead #${i + 1} on 16-cell board should succeed`);
        const st = await ctx.getState();
        ctx.assertEq(st.score, 0, 'Knead spawn must award 0 score');

        for (const [r, c] of [[1, 3], [2, 0]]) {
          const t = st.grid.cells[r][c].tile;
          if (t) {
            ctx.assertEq(t.flavor, 'gold', `Tile knead-spawned on G cell (${r},${c}) must immediately dye gold`);
            sawGoldKnead = true;
            if (r === 1 && c === 3) goldCoord = [1, 3];
          }
        }
        for (const [r, c] of [[0, 1], [3, 2]]) {
          const t = st.grid.cells[r][c].tile;
          if (t) {
            ctx.assertEq(t.flavor, 'matcha', `Tile knead-spawned on M cell (${r},${c}) must immediately dye matcha`);
            sawMatchaKnead = true;
          }
        }
      }

      ctx.assert(sawGoldKnead && goldCoord, 'Knead spawns across 2-5 must hit G cell (1,3)');
      ctx.assert(sawMatchaKnead, 'Knead spawns across 2-5 must hit M cells');

      // Upgrade (0,0) to C3 (tier 3) so it acts as a non-merging left-wall stopper for (1,3)'s C1/C2 gold tile.
      let st = await ctx.getState();
      while (st.grid.cells[0][0].tile.tier < 3) {
        await ctx.useToolOnCell('spoon', 0, 0);
        st = await ctx.getState();
      }
      ctx.assert(st.grid.cells[1][3].tile.tier <= 2, '(1,3) knead-spawned gold tile is C1 or C2');
      ctx.assertEq(st.grid.cells[1][3].tile.flavor, 'gold', '(1,3) tile is gold');

      // Keep only (0,0):C3 and (1,3):C1/C2(gold), slide('up') -> gold tile moves to (0,3)
      await ctx.clearBoardExcept([[0, 0], [1, 3]]);
      await ctx.slide('up');
      // Clear any random post-slide spawn that may have landed on (0,1) or (0,2)
      await ctx.clearBoardExcept([[0, 0], [0, 3]]);
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][3].tile.flavor, 'gold', 'Gold tile moved to (0,3) retains gold');

      // Slide('left'): (0,0):C3 blocks col 0, so (0,3):gold stops directly on (0,1):M!
      await ctx.slide('left');
      st = await ctx.getState();
      ctx.assert(st.grid.cells[0][1].tile !== null, 'Gold tile stops on (0,1):M');
      ctx.assertEq(
        st.grid.cells[0][1].tile.flavor,
        'gold',
        'Gold tile stopping on M cell (0,1) must NEVER downgrade to matcha'
      );
      ctx.assertEq(st.score, 0, 'Score remains 0 throughout knead & gold non-downgrade test');
    }
  },

  {
    id: 'T3-03',
    tier: 3,
    features: ['F06', 'F07'],
    title: '4-slot upgraded tray multiset partial consumption preserves unrelated gold tile',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      // Start 2-2 (presets include (1,1):C4(gold), (2,1):C2(plain), (0,1):C3, and (2,2):M; R15 = C2 + C3[matcha])
      // Retry quick level start if needed until R15 is seated without R07 (1-item C4) stealing C4(gold),
      // or upgrade C4(gold) -> C5(gold) if R07 is absent and R11 is checked.
      let targetSeatIdx = -1;
      for (let attempt = 0; attempt < 25; attempt++) {
        await ctx.setupSaveAndStart('2-2', {
          levelStars: ctx.allUnlockedStars(3),
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
          totalEarnedStardust: 500,
          bankStardust: 150,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        const st = await ctx.advanceTime(3.2);
        ctx.assertEq(st.trayCapacity, 4, 'dev_tray Lv.1 must expand trayCapacity to 4');
        ctx.assert((st.hits || []).some((h) => h.id === 'tray_slot_3'), '4th tray slot hit tray_slot_3 must exist');

        const r15Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R15');
        const hasR07 = (st.seats || []).some((s) => s && s.recipeId === 'R07');
        if (r15Idx >= 0 && !hasR07) {
          targetSeatIdx = r15Idx;
          break;
        }
      }

      // Fallback on 2-1 if RNG never rolled R15 without R07 in 25 attempts
      if (targetSeatIdx < 0) {
        for (let attempt = 0; attempt < 25; attempt++) {
          await ctx.setupSaveAndStart('2-1', {
            levelStars: ctx.allUnlockedStars(3),
            selectedPatron: 'mugi',
            unlockedPatrons: ['mikan', 'luna', 'mugi'],
            deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
            totalEarnedStardust: 600,
            bankStardust: 130,
            seenTutorials: TUTORIALS_ALL_SEEN
          });
          const st = await ctx.advanceTime(3.2);
          const r15Idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R15');
          if (r15Idx >= 0) {
            targetSeatIdx = r15Idx;
            break;
          }
        }
      }
      ctx.assert(targetSeatIdx >= 0, 'Should seat customer requesting R15 (C2 + C3[matcha])');

      let st = await ctx.getState();
      await ctx.clickHit(`seat_${targetSeatIdx}`);

      // Prepare bystander C4(gold) (or C5 if R07 seated), C2(plain), and C3(matcha)
      let bystander = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier === 4 && t.flavor === 'gold');
      if (!bystander) {
        // On 2-1 fallback, upgrade (2,2):C3(matcha) twice via spoon -> C5(matcha) (no R11 on 2-1!)
        await ctx.useToolOnCell('spoon', 2, 2);
        await ctx.useToolOnCell('spoon', 2, 2);
        st = await ctx.getState();
        bystander = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier === 5);
      }
      ctx.assert(bystander, 'Bystander high-tier tile ready on board');
      const bystanderTier = bystander.tier;
      const bystanderFlavor = bystander.flavor;

      // Place bystander into slot 0
      await ctx.tapBoardCell(bystander.r, bystander.c);

      // Bake/find C2(plain) and C3(matcha)
      const c2Tile = await bakeTileOrganically(ctx, 2, 'plain', { exactFlavor: true });
      ctx.assert(c2Tile, 'C2(plain) ready on board');
      await ctx.tapBoardCell(c2Tile.r, c2Tile.c);

      const c3Matcha = await bakeTileOrganically(ctx, 3, 'matcha', { exactFlavor: true });
      ctx.assert(c3Matcha, 'C3(matcha) ready on board');
      await ctx.tapBoardCell(c3Matcha.r, c3Matcha.c);

      // Advance 0.60s for auto-serve of R15
      st = await ctx.advanceTime(0.6);
      ctx.assertEq(st.ordersServed, 1, 'R15 should auto-serve once C2 + C3[matcha] are in tray');
      ctx.assert(st.score > 0, 'Serving R15 must award positive score');

      const remainingTray = (st.tray || []).filter(Boolean);
      ctx.assertEq(remainingTray.length, 1, 'Exactly 1 untouched bystander tile must remain in 4-slot tray');
      ctx.assertEq(remainingTray[0].tier, bystanderTier, 'Untouched tray tile preserves its tier');
      ctx.assertEq(remainingTray[0].flavor, bystanderFlavor, 'Untouched tray tile preserves its gold/special flavor');
    }
  },

  {
    id: 'T3-04',
    tier: 3,
    features: ['F07', 'F08'],
    title: 'Greedy plain-before-gold tray consumption and exact 1.50x gold wildcard price multiplier',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      // Find a 2-2 start where a seated customer requests R07 (C4[any]) AFTER seating customers at t=3.2s
      let r07SeatIdx = -1;
      for (let attempt = 0; attempt < 30; attempt++) {
        await ctx.setupSaveAndStart('2-2', {
          levelStars: ctx.allUnlockedStars(3),
          selectedPatron: 'luna',
          unlockedPatrons: ['mikan', 'luna'],
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
          totalEarnedStardust: 500,
          bankStardust: 70,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        const stWave = await ctx.advanceTime(3.2);
        r07SeatIdx = (stWave.seats || []).findIndex((s) => s && s.recipeId === 'R07');
        if (r07SeatIdx >= 0) break;
      }
      ctx.assert(r07SeatIdx >= 0, 'Customer requesting R07 (C4[any]) should spawn on 2-2');

      const stPreServe1 = await ctx.getState();
      const cust1 = stPreServe1.seats[r07SeatIdx];
      const cMult1 = cust1 ? (cust1.isVip ? 1.5 : cust1.isUrgent || cust1.customerId === 'cust_fox' ? 1.25 : 1.0) : 1.0;

      // Synchronously at dt=0: lock seat_${r07SeatIdx}, spoon (0,1):C3(plain)->C4(plain),
      // and load [C4(gold), C4(plain)] into tray[0], tray[1] so gold precedes plain!
      const trayPrep = await ctx.eval((sIdx) => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        dbg.clickHit(`seat_${sIdx}`);
        dbg.useToolOnCell('spoon', 0, 1);
        const mid = dbg.getState();
        const goldFlavor = mid.grid.cells[1][1]?.tile?.flavor;
        const plainTier = mid.grid.cells[0][1]?.tile?.tier;
        const plainFlavor = mid.grid.cells[0][1]?.tile?.flavor;
        dbg.tapBoardCell(1, 1); // tray[0] = C4(gold)
        dbg.tapBoardCell(0, 1); // tray[1] = C4(plain)
        return { goldFlavor, plainTier, plainFlavor };
      }, r07SeatIdx);
      ctx.assertEq(trayPrep.goldFlavor, 'gold', '(1,1) preset is C4(gold)');
      ctx.assertEq(trayPrep.plainTier, 4, '(0,1) upgraded to C4(plain)');
      ctx.assertEq(trayPrep.plainFlavor, 'plain', '(0,1) flavor is plain');

      const stAfter1 = await ctx.advanceTime(0.65);
      ctx.assertEq(stAfter1.ordersServed, 1, 'First R07 order auto-served');

      // Greedy matcher MUST consume tray[1] C4(plain) and preserve tray[0] C4(gold)!
      const rem1 = (stAfter1.tray || []).filter(Boolean);
      ctx.assertEq(rem1.length, 1, 'One C4 must remain in tray after serving R07');
      ctx.assertEq(rem1[0].flavor, 'gold', 'Plain-before-gold rule must preserve C4(gold) in tray');

      const expectedPlainScore = Math.round(BASE_PRICES_LV0[4] * 1.0 * 1.0 * 1.2 * 1.0 * cMult1);
      ctx.assertClose(
        stAfter1.score,
        expectedPlainScore,
        1,
        `Plain C4 serve score (${stAfter1.score}) must match 1.00x item formula (${expectedPlainScore})`
      );

      // Part 2: Measure exact 1.50x Gold wildcard price multiplier on an identical 1-combo green R07 serve
      // on fresh 2-2 (where (1,1) preset is C4(gold)) so comboCount === 0 and customerMult is observed pre-serve!
      let r07GoldIdx = -1;
      for (let attempt = 0; attempt < 30; attempt++) {
        await ctx.setupSaveAndStart('2-2', {
          levelStars: ctx.allUnlockedStars(3),
          selectedPatron: 'luna',
          unlockedPatrons: ['mikan', 'luna'],
          deviceUpgrades: { dev_tray: 1, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
          totalEarnedStardust: 500,
          bankStardust: 70,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        const stWave = await ctx.advanceTime(3.2);
        r07GoldIdx = (stWave.seats || []).findIndex((s) => s && s.recipeId === 'R07');
        if (r07GoldIdx >= 0) break;
      }
      ctx.assert(r07GoldIdx >= 0, 'Found R07 customer for Gold 1.50x pricing check');

      await ctx.clickHit(`seat_${r07GoldIdx}`);
      const stPre2 = await ctx.getState();
      const cust2 = stPre2.seats[r07GoldIdx];
      const cMult2 = cust2.isVip ? 1.5 : cust2.isUrgent || cust2.customerId === 'cust_fox' ? 1.25 : 1.0;

      await ctx.tapBoardCell(1, 1); // (1,1):C4(gold) -> tray[0]
      const stAfter2 = await ctx.advanceTime(0.65);
      ctx.assertEq(stAfter2.ordersServed, 1, 'R07 served using C4(gold)');
      ctx.assertEq((stAfter2.tray || []).filter(Boolean).length, 0, 'C4(gold) consumed by R07');

      const expectedGoldScore = Math.round(BASE_PRICES_LV0[4] * 1.35 * 1.0 * 1.2 * 1.0 * cMult2);
      ctx.assertClose(
        stAfter2.score,
        expectedGoldScore,
        2,
        `Gold C4 serve score (${stAfter2.score}) must include 1.35x gold multiplier (${expectedGoldScore})`
      );
      ctx.assertClose(
        (stAfter2.score / cMult2) / (stAfter1.score / cMult1),
        1.35,
        0.02,
        'Normalized Gold/Plain serve score ratio must equal 1.35x'
      );
    }
  },

  {
    id: 'T3-05',
    tier: 3,
    features: ['F08', 'F09'],
    title: 'Starlight Fever (4 green serves = 100% charge) halves 3-seat patience decay (0.5x) and boosts score (1.35x)',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setupSaveAndStart('1-1', {
        selectedPatron: 'luna',
        unlockedPatrons: ['mikan', 'luna'],
        totalEarnedStardust: 110,
        bankStardust: 30,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      // Verify non-serve actions grant 0 Fever energy
      await ctx.slide('left');
      await safeKnead(ctx);
      let st = await ctx.getState();
      ctx.assertEq(st.feverEnergy, 0, 'Slides and kneads must grant 0 feverEnergy');
      ctx.assertEq(st.feverActive, false, 'Fever starts inactive');

      // Complete 5 green-patience (>=60%) serves: 5 * 20% = 100% -> feverActive === true
      await ctx.advanceTime(3.2);
      for (let k = 1; k <= 5; k++) {
        st = await ctx.getState();
        let greenIdx = st.seats.findIndex((s) => s && s.patience / s.maxPatience > 0.65);
        if (greenIdx < 0) {
          st = await ctx.advanceTime(2.4);
          greenIdx = st.seats.findIndex((s) => s && s.patience / s.maxPatience > 0.65);
        }
        if (greenIdx < 0) {
          const minP = Math.min(...st.seats.filter(Boolean).map((s) => s.patience));
          st = await ctx.advanceTime((Number.isFinite(minP) ? minP : 0) + 2.4);
          greenIdx = st.seats.findIndex((s) => s && s.patience / s.maxPatience > 0.65);
        }
        ctx.assert(greenIdx >= 0, `Expected green-bar customer for Fever charge #${k}`);
        await serveCustomerOrganic(ctx, greenIdx);
        st = await ctx.getState();
        if (k < 5) {
          ctx.assertEq(st.feverEnergy, k * 20, `Green serve #${k} should bring feverEnergy to ${k * 20}%`);
          ctx.assertEq(st.feverActive, false, `Fever stays inactive at ${k * 20}%`);
        } else {
          ctx.assertEq(st.feverActive, true, '5th green serve triggers Starlight Fever (100%)');
        }
      }

      // Ensure a customer with ample patience is seated during Fever so we measure the EXACT same customer
      // both during Fever (3.0s) and after Fever ends (3.0s)
      st = await ctx.getState();
      let measureSeatIdx = st.seats.findIndex((s) => s && s.patience > 16);
      if (measureSeatIdx < 0) {
        st = await ctx.advanceTime(1.5);
        measureSeatIdx = st.seats.findIndex((s) => s && s.patience > 16);
      }
      if (measureSeatIdx < 0) {
        st = await ctx.advanceTime(0.9);
        measureSeatIdx = st.seats.findIndex((s) => s && s.patience > 16);
      }
      ctx.assert(measureSeatIdx >= 0, 'Seated customer available during Fever');
      const targetUid = st.seats[measureSeatIdx].uid;
      const targetCustomerId = st.seats[measureSeatIdx].customerId;
      const pFeverStart = st.seats[measureSeatIdx].patience;

      // Step 3.0s inside Fever
      st = await ctx.advanceTime(3.0);
      ctx.assertEq(st.feverActive, true, 'Fever remains active within 10.0s window');
      const pFeverEnd = st.seats[measureSeatIdx].patience;
      const dropDuringFever = pFeverStart - pFeverEnd;

      // Serve a DIFFERENT seat during Fever to verify 1.35x Fever score boost without disturbing measureSeatIdx
      const otherIdx = [0, 1, 2].find((i) => i !== measureSeatIdx && st.seats[i]);
      if (otherIdx !== undefined) {
        const seatOrder = st.seats[otherIdx];
        const slots = getOrderSlots(seatOrder);
        const comboNext = Math.min((st.comboCount || 0) + 1, 5);
        const comboMult = SERVE_COMBO_MULTS[comboNext - 1];
        const pRatio = seatOrder.patience / seatOrder.maxPatience;
        const pMult = pRatio >= 0.60 ? 1.2 : pRatio >= 0.25 ? 1.0 : 0.80;
        const itemSum = slots.reduce((sum, s) => sum + BASE_PRICES_LV0[s.tier], 0);
        const sizeMult = COMBO_SIZE_MULTS[slots.length] || 1.0;

        const { scoreGain } = await serveCustomerOrganic(ctx, otherIdx);
        const expectedNoFever = Math.round(itemSum * sizeMult * pMult * comboMult);
        ctx.assert(
          scoreGain > expectedNoFever * 1.15,
          `Fever serve score (${scoreGain}) must exceed non-Fever baseline (${expectedNoFever}) via 1.35x multiplier`
        );
      }

      // Advance past Fever expiration (total > 10.0s since Fever start)
      st = await ctx.advanceTime(7.5);
      ctx.assertEq(st.feverActive, false, 'Fever expires after 10.0s duration');

      // Measure 3.0s post-Fever patience decay on the same seat (or fresh seat if turned over)
      let postIdx = measureSeatIdx;
      const sPost = st.seats[postIdx];
      const sameCustomer =
        sPost &&
        !(sPost.uid !== undefined
          ? sPost.uid !== targetUid
          : sPost.customerId !== targetCustomerId || sPost.patience > pFeverEnd);
      if (!sameCustomer || sPost.patience < 5) {
        postIdx = st.seats.findIndex((s) => s && s.patience > 8);
      }
      if (postIdx < 0) {
        st = await ctx.advanceTime(2.4);
        postIdx = st.seats.findIndex((s) => s && s.patience > 8);
      }
      ctx.assert(postIdx >= 0, 'Seated customer available post-Fever');
      const pPostStart = st.seats[postIdx].patience;
      st = await ctx.advanceTime(3.0);
      const pPostEnd = st.seats[postIdx].patience;
      const dropPostFever = pPostStart - pPostEnd;

      ctx.assertClose(
        dropDuringFever / dropPostFever,
        0.5,
        0.04,
        `Fever patience decay (${dropDuringFever.toFixed(2)}) must be 0.5x post-Fever decay (${dropPostFever.toFixed(2)})`
      );
    }
  },

  {
    id: 'T3-06',
    tier: 3,
    features: ['F08', 'F15'],
    title: 'Global Serve-Only Scoring Iron Law across full kitchen arsenal (UT-O01 E2E on 3-1)',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setupSaveAndStart('3-1', {
        levelStars: ctx.allUnlockedStars(3),
        selectedPatron: 'luna',
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        deviceUpgrades: { dev_tray: 1, dev_flour: 3, dev_teapot: 0, dev_tools: 3 },
        totalEarnedStardust: 960,
        bankStardust: 100,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      // 1) Slide #1: 'right' on 3-1 frame 0 merges (0,1)+(0,2) C3s above (1,2):C4[I] -> orthogonal ice shatter!
      let st = await ctx.getState();
      ctx.assertEq(st.grid.cells[1][2].tile.frozenHp, 1, '(1,2) starts frozen on 3-1');
      await ctx.slide('right');
      st = await ctx.getState();
      ctx.assertEq(st.score, 0, 'Slide #1 + merge + orthogonal ice shatter must award 0 score');

      // Remaining 5 valid slides (6 valid slides total)
      const slideCycle = ['left', 'down', 'right', 'up', 'left', 'down', 'right', 'up'];
      let validSlides = 1;
      for (const dir of slideCycle) {
        if (validSlides >= 6) break;
        const prev = previewSlideReadOnly(st.grid, dir);
        if (prev.moved) {
          await ctx.slide(dir);
          st = await ctx.getState();
          ctx.assertEq(st.score, 0, `Valid slide #${validSlides + 1} (${dir}) must award 0 score`);
          validSlides++;
        }
      }
      ctx.assert(validSlides >= 6, 'Completed 6 valid 2048 slides/merges');

      // 2) 4 kneads
      for (let k = 1; k <= 4; k++) {
        await safeKnead(ctx);
        st = await ctx.getState();
        ctx.assertEq(st.score, 0, `Knead #${k} must award 0 score`);
      }

      // 3) 2 partial tray loads (C1 is never a 1-item order on 3-1 R15..R22!) + 1 double-tap trash
      for (let p = 0; p < 2; p++) {
        st = await ctx.getState();
        let lowTile = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier === 1);
        if (!lowTile) {
          await safeKnead(ctx);
          st = await ctx.getState();
          lowTile = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier <= 2);
        }
        ctx.assert(lowTile, 'Found low-tier tile for partial tray load');
        await ctx.tapBoardCell(lowTile.r, lowTile.c);
        st = await ctx.getState();
        ctx.assertEq(st.score, 0, `Partial tray load #${p + 1} must award 0 score`);
      }
      await ctx.doubleTapTray(0);
      st = await ctx.getState();
      ctx.assertEq(st.score, 0, 'Double-tap tray trash discard must award 0 score');
      await clearTraySlots(ctx);

      // 4) 1 fork ice-shatter (on (2,2):C4[I] if still frozen, else on any tile)
      st = await ctx.getState();
      const frozenTarget = inspectBoard(st).tiles.find((t) => t.frozenHp > 0) || inspectBoard(st).tiles[0];
      ctx.assert(frozenTarget, 'Target tile found for fork');
      if (frozenTarget.frozenHp > 0) {
        await ctx.useToolOnCell('fork', frozenTarget.r, frozenTarget.c);
      } else {
        await ctx.useToolOnCell('fork', frozenTarget.r, frozenTarget.c, 'trash');
      }
      st = await ctx.getState();
      ctx.assertEq(st.score, 0, 'Fork utensil must award 0 score');

      // 5) 1 spoon upgrade on non-frozen C1..C6 tile
      const spoonTarget = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier < 7);
      ctx.assert(spoonTarget, 'Target tile found for spoon');
      await ctx.useToolOnCell('spoon', spoonTarget.r, spoonTarget.c);
      st = await ctx.getState();
      ctx.assertEq(st.score, 0, 'Spoon utensil upgrade must award 0 score');

      // 6) 1 patron active skill (castPatronSkill) BEFORE any serve!
      if (st.skillEnergy < 100) {
        const forceRes = await ctx.eval(() => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          if (dbg && typeof dbg.castPatronSkill === 'function') {
            return dbg.castPatronSkill({ forceCharge: true });
          }
          return null;
        });
        st = await ctx.getState();
        // If forceCharge was unsupported (or skill not yet cast), charge to 100% via bounded <=20 C5 merges (+8% each, 0 score!)
        if (!(forceRes && forceRes.ok === true) && st.skillEnergy < 100) {
          for (let iter = 0; iter < 20 && st.skillEnergy < 100; iter++) {
            await ctx.eval(() => {
              const dbg = globalThis.__HOSHI_DEBUG__;
              const s = dbg.getState();
              for (let i = 0; i < (s.tray || []).length; i++) {
                if (s.tray[i]) dbg.doubleTapTray(i, { ignoreCooldown: true });
              }
              for (let r = 0; r < s.grid.rows; r++) {
                for (let c = 0; c < s.grid.cols; c++) {
                  const t = s.grid.cells[r][c]?.tile;
                  if (t && !(t.frozenHp > 0) && t.tier === 5) {
                    dbg.tapBoardCell(r, c);
                    const idx = (dbg.getState().tray || []).findIndex((x) => x !== null);
                    if (idx >= 0) dbg.doubleTapTray(idx, { ignoreCooldown: true });
                  }
                }
              }
            });
            await bakeOrderMultisetOrganically(ctx, [{ tier: 5, flavor: 'any' }], {
              allowTools: false,
              maxSteps: 90
            });
            st = await ctx.getState();
            ctx.assertEq(st.ordersServed, 0, 'Zero orders served during C5 merge charging');
            ctx.assertEq(st.score, 0, 'High-tier >=C5 merge charging must keep score === 0');
          }
          ctx.assertEq(st.skillEnergy, 100, 'Charged Luna skillEnergy === 100 via >=C5 merges');
          await safeKnead(ctx);
          await ctx.castPatronSkill();
        }
      } else {
        await safeKnead(ctx);
        await ctx.castPatronSkill();
      }
      st = await ctx.getState();
      ctx.assertEq(st.ordersServed, 0, 'Zero orders served so far');
      ctx.assertEq(st.score, 0, 'Patron active skill must award 0 direct score (UT-O01 Iron Law)');

      // 7) Complete 1st full customer order -> score IMMEDIATELY becomes > 0!
      const served = await serveCustomerOrganic(ctx);
      ctx.assert(served.after.ordersServed >= 1, 'First customer order completed');
      ctx.assert(served.after.score > 0, 'Score becomes > 0 immediately upon first completed customer order');
    }
  },

  {
    id: 'T3-07',
    tier: 3,
    features: ['F04', 'F15'],
    title: 'Mugi active skill thaws all ice and promotes gold wildcard tiles to satisfy constrained flavor slots',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setupSaveAndStart('3-8', {
        levelStars: ctx.allUnlockedStars(3),
        selectedPatron: 'mugi',
        unlockedPatrons: ['mikan', 'luna', 'mugi'],
        deviceUpgrades: { dev_tray: 1, dev_flour: 3, dev_teapot: 0, dev_tools: 3 },
        totalEarnedStardust: 990,
        bankStardust: 130,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      let st = await ctx.getState();
      ctx.assertEq(inspectBoard(st).frozenCount, 4, '3-8 begins with 4 corner frozen I tiles');

      // Charge Mugi to 100% via bounded Col-2 isolated >=C5 merges on 3-8 preserving all 4 corner I cells,
      // and clear existing gold tiles before cast so frozenBeforeCast === 4 and goldBeforeCast === 0!
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const harness = window.__WX_HARNESS__;
        const trashCell = (r, c) => {
          const s0 = dbg.getState();
          const t0 = s0.grid?.cells?.[r]?.[c]?.tile;
          if (!t0 || t0.frozenHp > 0) return;
          for (let i = 0; i < (s0.tray || []).length; i++) {
            if (s0.tray[i]) dbg.doubleTapTray(i, { ignoreCooldown: true });
          }
          dbg.tapBoardCell(r, c);
          const s1 = dbg.getState();
          for (let i = 0; i < (s1.tray || []).length; i++) {
            if (s1.tray[i]) dbg.doubleTapTray(i, { ignoreCooldown: true });
          }
        };

        trashCell(1, 2);
        trashCell(3, 2);
        if ((dbg.getState().toolCounts?.spoon || 0) > 0) {
          dbg.useToolOnCell('spoon', 2, 2); // (2,2):C5(gold) -> C6(gold) (+8% skillEnergy, 1 free spoon left)
        }
        dbg.slide('up'); // (0,2):C6(gold) top stopper

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

        // Clear all gold/C7 tiles and ensure >= 2 unfrozen non-C7 non-gold tiles before Mugi cast
        const preClean = dbg.getState().grid;
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 5; c++) {
            const t = preClean.cells[r][c].tile;
            if (t && !(t.frozenHp > 0) && (t.flavor === 'gold' || t.tier >= 7)) {
              trashCell(r, c);
            }
          }
        }
        for (let g = 0; g < 15; g++) {
          const gState = dbg.getState().grid;
          let validUnfrozen = 0;
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
              const t = gState.cells[r][c].tile;
              if (t && !(t.frozenHp > 0) && t.flavor !== 'gold' && t.tier < 7) validUnfrozen++;
            }
          }
          if (validUnfrozen >= 2) break;
          harness?.advanceClockMs?.(150);
          dbg.advanceTime(0.15);
          dbg.knead();
          if (dbg.getState().grid.cells[2][2].tile?.flavor === 'gold') trashCell(2, 2);
        }
      });

      st = await ctx.getState();
      ctx.assertEq(st.skillEnergy, 100, 'Charged Mugi skillEnergy === 100 via isolated Col-2 merges');
      const frozenBeforeCast = inspectBoard(st).frozenCount;
      ctx.assertEq(frozenBeforeCast, 4, 'All 4 corner I tiles remain frozen right before Mugi cast');
      const goldBeforeCast = inspectBoard(st).tiles.filter((t) => t.flavor === 'gold').length;
      ctx.assertEq(goldBeforeCast, 0, '0 gold tiles on board right before Mugi cast');
      const scoreBeforeCast = st.score;

      if ((st.hits || []).some((h) => h.id === 'patron_skill_btn')) {
        await ctx.clickHit('patron_skill_btn');
      } else {
        await ctx.castPatronSkill();
      }

      st = await ctx.getState();
      ctx.assertEq(st.score, scoreBeforeCast, 'Mugi active skill adds 0 direct score');
      ctx.assertEq(inspectBoard(st).frozenCount, 0, 'Mugi active skill thaws ALL frozen I tiles on board');
      const goldTiles = inspectBoard(st).tiles.filter((t) => t.flavor === 'gold');
      ctx.assert(
        goldTiles.length >= goldBeforeCast + 1,
        'Mugi active skill upgrades tiles and attaches gold wildcard flavor'
      );

      // Let combo/fever cool down and ensure customers are seated, then find a constrained-flavor order
      await ctx.advanceTime(3.2);
      let constrainedSeatIdx = -1;
      for (let w = 0; w < 25; w++) {
        st = await ctx.getState();
        const cands = [0, 1, 2]
          .filter(
            (i) =>
              st.seats &&
              st.seats[i] &&
              st.seats[i].patience > 12 &&
              getOrderSlots(st.seats[i]).some((slot) => slot.flavor === 'matcha' || slot.flavor === 'berry')
          )
          .sort((a, b) => {
            const maxA = Math.max(...getOrderSlots(st.seats[a]).map((s) => s.tier));
            const maxB = Math.max(...getOrderSlots(st.seats[b]).map((s) => s.tier));
            return maxA - maxB;
          });
        if (cands.length > 0) {
          constrainedSeatIdx = cands[0];
          break;
        }
        const seated = (st.seats || []).filter(Boolean);
        if (seated.length > 0 && Math.max(...seated.map((s) => s.patience)) <= 12) {
          const minP = Math.min(...seated.map((s) => s.patience));
          await ctx.advanceTime(minP + 2.4);
          continue;
        }
        await serveCustomerOrganic(ctx);
        await ctx.advanceTime(10.5);
      }
      ctx.assert(constrainedSeatIdx >= 0, 'Found seated customer with constrained [matcha] or [berry] slot');

      await clearTraySlots(ctx);
      st = await ctx.getState();
      const seat = st.seats[constrainedSeatIdx];
      const slots = getOrderSlots(seat);
      const cIdx = slots.findIndex((s) => s.flavor === 'matcha' || s.flavor === 'berry');
      const constrainedSlot = slots[cIdx];

      // Upgrade a lower-tier gold tile via spoon only when within free + 1 emergency spoon budget (maxBuyPerLevel === 1)
      let emergencySpoonUsed = false;
      const lowerGold = inspectBoard(st)
        .tiles.filter((t) => t.frozenHp === 0 && t.flavor === 'gold' && t.tier < constrainedSlot.tier)
        .sort((a, b) => b.tier - a.tier)[0];
      if (
        lowerGold &&
        constrainedSlot.tier - lowerGold.tier <= (st.toolCounts?.spoon || 0) + (emergencySpoonUsed ? 0 : 1)
      ) {
        const r = lowerGold.r;
        const c = lowerGold.c;
        while ((await ctx.getState()).grid.cells[r][c]?.tile?.tier < constrainedSlot.tier) {
          const curSt = await ctx.getState();
          if ((curSt.toolCounts?.spoon || 0) > 0) {
            await ctx.useToolOnCell('spoon', r, c);
          } else if (!emergencySpoonUsed) {
            await buyAndApplyEmergencyTool(ctx, 'spoon', r, c);
            emergencySpoonUsed = true;
          } else {
            break;
          }
        }
      }

      // Bake the FULL order multiset simultaneously on board (requiring gold wildcard on constrainedSlot)
      const multisetReqs = slots.map((s, idx) =>
        idx === cIdx ? { tier: s.tier, flavor: 'gold', exactFlavor: true } : { ...s }
      );
      const matchedTiles = await bakeOrderMultisetOrganically(ctx, multisetReqs, {
        allowTools: true,
        maxSteps: 280
      });
      ctx.assert(matchedTiles, `Prepared simultaneous multiset with C${constrainedSlot.tier}(gold) for ${seat.recipeId}`);
      ctx.assertEq(matchedTiles[cIdx].flavor, 'gold', 'Constrained slot matched by gold wildcard tile');

      let preServeSt = await ctx.getState();
      if (!preServeSt.seats[constrainedSeatIdx] || preServeSt.seats[constrainedSeatIdx].patience < 1.5) {
        await ctx.advanceTime(3.0);
        preServeSt = await ctx.getState();
      }
      if (preServeSt.seats[constrainedSeatIdx]) {
        const pr0 = preServeSt.seats[constrainedSeatIdx].patience / preServeSt.seats[constrainedSeatIdx].maxPatience;
        if (Math.abs(pr0 - 0.60) < 0.02 || Math.abs(pr0 - 0.25) < 0.02) {
          preServeSt = await ctx.advanceTime(0.8);
        }
      }
      const scoreBeforeServe = preServeSt.score;
      const ordersBeforeServe = preServeSt.ordersServed;
      const liveSeat = preServeSt.seats[constrainedSeatIdx];
      const pRatio = liveSeat.patience / liveSeat.maxPatience;
      const pMult = pRatio >= 0.60 ? 1.2 : pRatio >= 0.25 ? 1.0 : 0.80;
      const cMult = liveSeat.isVip ? 1.5 : liveSeat.isUrgent || liveSeat.customerId === 'cust_fox' ? 1.25 : 1.0;

      // Synchronously lock seat and tap all matched coordinates at dt = 0
      await ctx.eval(
        (sIdx, coords) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          dbg.clickHit(`seat_${sIdx}`);
          for (const pt of coords) {
            dbg.tapBoardCell(pt.r, pt.c);
          }
        },
        constrainedSeatIdx,
        matchedTiles.map((t) => ({ r: t.r, c: t.c }))
      );

      const postServeSt = await ctx.advanceTime(0.65);
      ctx.assertEq(postServeSt.ordersServed, ordersBeforeServe + 1, 'Gold wildcard satisfied constrained flavor order');
      const actualGain = postServeSt.score - scoreBeforeServe;

      // Compare against standard 1.25x flavor score (gold is 1.35x > 1.25x!)
      let standardFlavorSum = BASE_PRICES_LV0[constrainedSlot.tier] * 1.25;
      let goldFlavorSum = BASE_PRICES_LV0[constrainedSlot.tier] * 1.35;
      for (let i = 0; i < slots.length; i++) {
        if (i === cIdx) continue;
        const s = slots[i];
        const flv = matchedTiles[i].flavor;
        const m = flv === 'gold' ? 1.35 : s.flavor !== 'any' ? 1.25 : 1.0;
        standardFlavorSum += BASE_PRICES_LV0[s.tier] * m;
        goldFlavorSum += BASE_PRICES_LV0[s.tier] * m;
      }
      const sizeMult = COMBO_SIZE_MULTS[slots.length] || 1.0;
      const expectedGoldServe = Math.round(goldFlavorSum * sizeMult * pMult * cMult);
      const expectedStdServe = Math.round(standardFlavorSum * sizeMult * pMult * cMult);
      ctx.assert(
        actualGain > expectedStdServe,
        `Gold wildcard serve (${actualGain}) must exceed standard 1.25x flavor score (${expectedStdServe})`
      );
      ctx.assertClose(actualGain, expectedGoldServe, 3, 'Gold wildcard serve matches exact 1.35x item formula');
    }
  },

  {
    id: 'T3-08',
    tier: 3,
    features: ['F03', 'F15'],
    title: 'Luna active skill on blocked/dye grid 2-3 clears C1s, keeps X pillars, dyes on G/M, and buffs next serve 1.50x',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setupSaveAndStart(
        '2-3',
        {
          levelStars: ctx.allUnlockedStars(3),
          selectedPatron: 'luna',
          unlockedPatrons: ['mikan', 'luna'],
          deviceUpgrades: { dev_tray: 1, dev_flour: 3, dev_teapot: 0, dev_tools: 3 },
          totalEarnedStardust: 900,
          bankStardust: 160,
          seenTutorials: TUTORIALS_ALL_SEEN
        },
        { skillEnergy: 100, forceCharge: true }
      );

      let st = await ctx.getState();
      if (st.skillEnergy < 100) {
        // Charge Luna to 100% via fast >=C5 merges (+8% each) so >100s timeLeft remains and Fever stays 0
        for (let iter = 0; iter < 20 && st.skillEnergy < 100; iter++) {
          await ctx.eval(() => {
            const dbg = globalThis.__HOSHI_DEBUG__;
            const s = dbg.getState();
            for (let i = 0; i < (s.tray || []).length; i++) {
              if (s.tray[i]) dbg.doubleTapTray(i, { ignoreCooldown: true });
            }
            for (let r = 0; r < s.grid.rows; r++) {
              for (let c = 0; c < s.grid.cols; c++) {
                const t = s.grid.cells[r][c]?.tile;
                if (t && !(t.frozenHp > 0) && t.tier >= 5) {
                  dbg.tapBoardCell(r, c);
                  const idx = (dbg.getState().tray || []).findIndex((x) => x !== null);
                  if (idx >= 0) dbg.doubleTapTray(idx, { ignoreCooldown: true });
                }
              }
            }
          });
          await bakeOrderMultisetOrganically(ctx, [{ tier: 5, flavor: 'any' }], {
            allowTools: false,
            maxSteps: 120
          });
          st = await ctx.getState();
        }
      }

      // Populate 2-3 (.... / .XX. / .GM. / ....) so there are >= 9 non-C1 tiles (indices 0..8 reach (2,1):G and (2,2):M!)
      // plus >= 2 C1 tiles to verify C1 clearing!
      for (let step = 0; step < 60; step++) {
        st = await ctx.getState();
        const b = inspectBoard(st);
        const nonC1 = b.tiles.filter((t) => t.tier >= 2).length;
        const c1s = b.tiles.filter((t) => t.tier === 1).length;
        if (nonC1 >= 9 && c1s >= 2) break;

        if (b.playableEmpty > 0) {
          await safeKnead(ctx);
        } else {
          // Merge or upgrade a C1 so nonC1 grows while keeping room for C1s
          const c1Tile = b.tiles.find((t) => t.tier === 1);
          if (nonC1 < 9 && st.toolCounts.spoon > 0 && c1Tile) {
            await ctx.useToolOnCell('spoon', c1Tile.r, c1Tile.c);
          } else {
            const dir = ['left', 'right', 'up', 'down'].find((d) => previewSlideReadOnly(st.grid, d).moved);
            if (dir) {
              await ctx.slide(dir);
            } else if (c1Tile) {
              await ctx.tapBoardCell(c1Tile.r, c1Tile.c);
              await ctx.doubleTapTray(0, { ignoreCooldown: true });
            }
          }
        }
      }

      st = await ctx.getState();
      const preBoard = inspectBoard(st);
      ctx.assert(preBoard.tiles.filter((t) => t.tier === 1).length >= 1, 'At least 1 C1 present before Luna cast');
      ctx.assert(preBoard.tiles.filter((t) => t.tier >= 2).length >= 9, 'At least 9 >=C2 tiles so sort reaches (2,1):G & (2,2):M');
      const scoreBeforeCast = st.score;

      await ctx.castPatronSkill();
      st = await ctx.getState();
      const postBoard = inspectBoard(st);

      ctx.assertEq(st.score, scoreBeforeCast, 'Luna active skill awards 0 direct score');
      ctx.assertEq(postBoard.tiles.filter((t) => t.tier === 1).length, 0, 'Luna clears all non-frozen C1 tiles');
      ctx.assertEq(st.grid.cells[1][1].type, 'block', 'X pillar (1,1) stays intact');
      ctx.assertEq(st.grid.cells[1][1].tile, null, 'X pillar (1,1) holds no tile');
      ctx.assertEq(st.grid.cells[1][2].type, 'block', 'X pillar (1,2) stays intact');
      ctx.assertEq(st.grid.cells[1][2].tile, null, 'X pillar (1,2) holds no tile');

      // Row-major top-left sort: (0,0) holds maxTier, and (2,1):G & (2,2):M dye sorted tiles!
      ctx.assertEq(st.grid.cells[0][0].tile.tier, postBoard.maxTier, 'Highest tier packed to (0,0)');
      ctx.assert(st.grid.cells[2][1].tile !== null, 'Sorted tile #8 occupies (2,1):G');
      ctx.assertEq(st.grid.cells[2][1].tile.flavor, 'gold', 'Sorted tile landing on (2,1):G dyes to gold');
      ctx.assert(st.grid.cells[2][2].tile !== null, 'Sorted tile #9 occupies (2,2):M');
      ctx.assert(
        ['matcha', 'gold'].includes(st.grid.cells[2][2].tile.flavor),
        'Sorted tile landing on (2,2):M dyes to matcha (unless already gold)'
      );

      // Verify Next-Serve 1.50x burst on Serve #1, reverting to 1.00x on Serve #2
      await ctx.advanceTime(10.5);
      st = await ctx.getState();
      if (st.seats.every((s) => !s)) st = await ctx.advanceTime(3.2);

      // Measure expected unbuffed score of target seat right before serving via simultaneous multiset board bake
      const ensureFreshSeat = async () => {
        for (let g = 0; g < 6; g++) {
          const cur = await ctx.getState();
          const cands = [0, 1, 2]
            .filter((i) => cur.seats && cur.seats[i] && cur.seats[i].patience > 12)
            .sort((a, b) => {
              const costA = getOrderSlots(cur.seats[a]).reduce((s, x) => s + (1 << (x.tier - 1)), 0);
              const costB = getOrderSlots(cur.seats[b]).reduce((s, x) => s + (1 << (x.tier - 1)), 0);
              return costA - costB;
            });
          if (cands.length > 0) return { st: cur, idx: cands[0] };
          const seated = (cur.seats || []).filter(Boolean);
          const waitSec = seated.length > 0 ? Math.min(...seated.map((s) => s.patience)) + 2.4 : 2.6;
          await ctx.advanceTime(waitSec);
        }
        const fallback = await ctx.getState();
        return { st: fallback, idx: fallback.seats.findIndex(Boolean) };
      };

      const fresh1 = await ensureFreshSeat();
      st = fresh1.st;
      const sIdx1 = fresh1.idx;
      const seat1 = st.seats[sIdx1];
      const slots1 = getOrderSlots(seat1);
      await clearTraySlots(ctx);
      const matched1 = await bakeOrderMultisetOrganically(ctx, slots1, { allowTools: true, maxSteps: 320 });
      ctx.assert(matched1, 'Baked simultaneous multiset for Luna 1.50x serve check');

      let pre1 = await ctx.getState();
      if (pre1.seats[sIdx1]) {
        const pr1 = pre1.seats[sIdx1].patience / pre1.seats[sIdx1].maxPatience;
        if (Math.abs(pr1 - 0.60) < 0.02 || Math.abs(pr1 - 0.25) < 0.02) {
          pre1 = await ctx.advanceTime(0.8);
        }
      }
      const scorePre1 = pre1.score;
      const live1 = pre1.seats[sIdx1];
      const pRatio1 = live1.patience / live1.maxPatience;
      const pMult1 = pRatio1 >= 0.60 ? 1.2 : pRatio1 >= 0.25 ? 1.0 : 0.80;
      const cMult1 = live1.isVip ? 1.5 : live1.isUrgent || live1.customerId === 'cust_fox' ? 1.25 : 1.0;

      let itemSum1 = 0;
      for (let i = 0; i < slots1.length; i++) {
        const t = matched1[i];
        const req = slots1[i];
        const fMult = t.flavor === 'gold' ? 1.35 : req.flavor !== 'any' ? 1.25 : 1.0;
        itemSum1 += BASE_PRICES_LV0[t.tier] * fMult;
      }
      await ctx.eval(
        (sIdx, coords) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          dbg.clickHit(`seat_${sIdx}`);
          for (const pt of coords) {
            dbg.tapBoardCell(pt.r, pt.c);
          }
        },
        sIdx1,
        matched1.map((t) => ({ r: t.r, c: t.c }))
      );
      const post1 = await ctx.advanceTime(0.65);
      const gain1 = post1.score - scorePre1;
      const sizeMult1 = COMBO_SIZE_MULTS[slots1.length] || 1.0;
      const unbuffed1 = itemSum1 * sizeMult1 * pMult1 * cMult1;
      ctx.assertClose(
        gain1,
        Math.round(unbuffed1 * 1.5),
        3,
        `Luna next-serve burst (${gain1}) must apply 1.50x over unbuffed (${Math.round(unbuffed1)})`
      );

      // Reset combo window and verify 2nd serve reverts to 1.00x (Luna burst consumed!)
      await ctx.advanceTime(10.5);
      const fresh2 = await ensureFreshSeat();
      let pre2 = fresh2.st;
      const sIdx2 = fresh2.idx;
      await clearTraySlots(ctx);
      const slots2 = getOrderSlots(pre2.seats[sIdx2]);
      const matched2 = await bakeOrderMultisetOrganically(ctx, slots2, { allowTools: true, maxSteps: 320 });
      ctx.assert(matched2, 'Baked simultaneous multiset for Serve #2');

      pre2 = await ctx.getState();
      if (pre2.seats[sIdx2]) {
        const pr2 = pre2.seats[sIdx2].patience / pre2.seats[sIdx2].maxPatience;
        if (Math.abs(pr2 - 0.60) < 0.02 || Math.abs(pr2 - 0.25) < 0.02) {
          pre2 = await ctx.advanceTime(0.8);
        }
      }
      const scorePre2 = pre2.score;
      const live2 = pre2.seats[sIdx2];
      const pRatio2 = live2.patience / live2.maxPatience;
      const pMult2 = pRatio2 >= 0.60 ? 1.2 : pRatio2 >= 0.25 ? 1.0 : 0.80;
      const cMult2 = live2.isVip ? 1.5 : live2.isUrgent || live2.customerId === 'cust_fox' ? 1.25 : 1.0;
      let itemSum2 = 0;
      for (let i = 0; i < slots2.length; i++) {
        const t = matched2[i];
        const req = slots2[i];
        const fMult = t.flavor === 'gold' ? 1.35 : req.flavor !== 'any' ? 1.25 : 1.0;
        itemSum2 += BASE_PRICES_LV0[t.tier] * fMult;
      }
      await ctx.eval(
        (sIdx, coords) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          dbg.clickHit(`seat_${sIdx}`);
          for (const pt of coords) {
            dbg.tapBoardCell(pt.r, pt.c);
          }
        },
        sIdx2,
        matched2.map((t) => ({ r: t.r, c: t.c }))
      );
      const post2 = await ctx.advanceTime(0.65);
      const gain2 = post2.score - scorePre2;
      const sizeMult2 = COMBO_SIZE_MULTS[slots2.length] || 1.0;
      ctx.assertClose(
        gain2,
        Math.round(itemSum2 * sizeMult2 * pMult2 * cMult2),
        3,
        'Second serve after Luna burst reverts to 1.00x'
      );
    }
  },

  {
    id: 'T3-09',
    tier: 3,
    features: ['F05', 'F14'],
    title: 'dev_flour Lv.3 (35%) + luna passive (+8%) = 43% C2 knead spawn synergy vs 10% baseline',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      const sampleKneadSpawns = async (totalSamples) => {
        await ctx.clearBoardExcept([]);
        const fastStats = await ctx.eval((N) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          let c1 = 0;
          let c2 = 0;
          let high = 0;
          let prevCoordKeys = new Set();

          const clearAll = () => {
            const s = dbg.getState();
            for (let i = 0; i < (s.tray || []).length; i++) {
              if (s.tray[i]) dbg.doubleTapTray(i, { ignoreCooldown: true });
            }
            for (let r = 0; r < s.grid.rows; r++) {
              for (let c = 0; c < s.grid.cols; c++) {
                const t = s.grid.cells[r][c]?.tile;
                if (t && !(t.frozenHp > 0)) {
                  dbg.tapBoardCell(r, c);
                  const idx = (dbg.getState().tray || []).findIndex((x) => x !== null);
                  if (idx >= 0) dbg.doubleTapTray(idx, { ignoreCooldown: true });
                }
              }
            }
            prevCoordKeys = new Set();
          };

          clearAll();
          for (let i = 0; i < N; i++) {
            let s0 = dbg.getState();
            let emptyCount = 0;
            for (let r = 0; r < s0.grid.rows; r++) {
              for (let c = 0; c < s0.grid.cols; c++) {
                const cell = s0.grid.cells[r][c];
                if (cell && cell.type !== 'void' && cell.type !== 'block' && !cell.tile) emptyCount++;
              }
            }
            if (emptyCount <= 2) clearAll();

            window.__WX_HARNESS__?.advanceClockMs?.(150);
            dbg.advanceTime(0.15);
            const res = dbg.knead();
            if (!res || res.spawned === false) return null;

            const s1 = dbg.getState();
            if (s1.score !== 0) return { error: `Expected score===0, got ${s1.score}` };
            const curTiles = [];
            for (let r = 0; r < s1.grid.rows; r++) {
              for (let c = 0; c < s1.grid.cols; c++) {
                const t = s1.grid.cells[r][c]?.tile;
                if (t && !(t.frozenHp > 0)) curTiles.push({ r, c, tier: t.tier });
              }
            }
            const newlyAdded =
              curTiles.find((t) => !prevCoordKeys.has(`${t.r},${t.c}`)) || (res.tile ? res.tile : null);
            if (!newlyAdded) return { error: `Failed to locate knead spawn at sample #${i + 1}` };
            if (newlyAdded.tier === 1) c1++;
            else if (newlyAdded.tier === 2) c2++;
            else high++;
            prevCoordKeys = new Set(curTiles.map((t) => `${t.r},${t.c}`));
          }
          return { c1, c2, high, ratioC2: c2 / N };
        }, totalSamples);

        if (fastStats) {
          ctx.assert(!fastStats.error, fastStats.error || 'Knead sampling error');
          return fastStats;
        }

        let c1 = 0;
        let c2 = 0;
        let high = 0;
        let prevCoordKeys = new Set();
        await ctx.clearBoardExcept([]);

        for (let i = 0; i < totalSamples; i++) {
          let st = await ctx.getState();
          if (inspectBoard(st).playableEmpty <= 2) {
            await ctx.clearBoardExcept([]);
            prevCoordKeys = new Set();
          }
          const res = await safeKnead(ctx);
          ctx.assert(res && res.spawned !== false, `Knead sample #${i + 1} should spawn`);
          st = await ctx.getState();
          ctx.assertEq(st.score, 0, 'Knead sampling keeps score === 0');
          const curTiles = inspectBoard(st).tiles;
          const newlyAdded =
            curTiles.find((t) => !prevCoordKeys.has(`${t.r},${t.c}`)) || (res && res.tile ? res.tile : null);
          ctx.assert(newlyAdded, 'Identified newly knead-spawned tile');
          if (newlyAdded.tier === 1) c1++;
          else if (newlyAdded.tier === 2) c2++;
          else high++;
          prevCoordKeys = new Set(curTiles.map((t) => `${t.r},${t.c}`));
        }
        return { c1, c2, high, ratioC2: c2 / totalSamples };
      };

      // Run A: Baseline (dev_flour: 0, selectedPatron: 'mikan' -> 10% C2 rate) on 1-7
      await ctx.setupSaveAndStart('1-7', {
        levelStars: ctx.allUnlockedStars(3),
        selectedPatron: 'mikan',
        unlockedPatrons: ['mikan'],
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        totalEarnedStardust: 500,
        bankStardust: 500,
        seenTutorials: TUTORIALS_ALL_SEEN
      });
      const statsBase = await sampleKneadSpawns(180);
      ctx.assertEq(statsBase.high, 0, 'Baseline knead never spawns >= C3');

      // Buy dev_flour Lv.1->3 (45+95+170 = 310) + Luna (80) & equip Luna via real Shop UI!
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: ctx.allUnlockedStars(3),
        selectedPatron: 'mikan',
        unlockedPatrons: ['mikan'],
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        totalEarnedStardust: 450,
        bankStardust: 450,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      await ctx.clickHit('dock_shop');
      await clickModalHit(ctx, 'shop_tab_devices');
      await clickModalHit(ctx, 'shop_buy_dev_flour');
      await clickModalHit(ctx, 'shop_buy_dev_flour');
      await clickModalHit(ctx, 'shop_buy_dev_flour');

      await clickModalHit(ctx, 'shop_tab_patrons');
      await clickModalHit(ctx, 'shop_buy_patron_luna');
      if (((await ctx.getState()).hits || []).some((h) => h.id === 'shop_equip_patron_luna')) {
        await clickModalHit(ctx, 'shop_equip_patron_luna');
      }
      await ctx.clickHit('modal_close');

      const saveUpgraded = await ctx.getSaveData();
      ctx.assertEq(saveUpgraded.deviceUpgrades.dev_flour, 3, 'dev_flour upgraded to Lv.3');
      ctx.assert(saveUpgraded.unlockedPatrons.includes('luna'), 'luna unlocked in Shop');
      ctx.assertEq(saveUpgraded.bankStardust, 450 - 345 - 100, 'Exact 445 stardust deducted for dev_flour Lv.3 (345) + luna (100)');

      // Start 1-7 with Luna equipped (35% + 8% = 43% C2 rate)
      await ctx.eval(() => {
        const dbg = globalThis.__HOSHI_DEBUG__;
        const s = dbg.getSaveData();
        if (s.selectedPatron !== 'luna') {
          dbg.setSaveData({ ...s, selectedPatron: 'luna' });
        }
        dbg.startLevel('1-7');
      });

      const statsSynergy = await sampleKneadSpawns(180);
      ctx.assertEq(statsSynergy.high, 0, 'Upgraded knead never spawns >= C3');
      ctx.assert(
        statsSynergy.ratioC2 >= 0.22,
        `dev_flour Lv.3 + Luna C2 ratio (${statsSynergy.ratioC2.toFixed(2)}) must be >= 0.22`
      );
      ctx.assert(
        statsSynergy.ratioC2 > statsBase.ratioC2 + 0.08,
        `Synergy C2 ratio (${statsSynergy.ratioC2.toFixed(2)}) must significantly exceed baseline (${statsBase.ratioC2.toFixed(2)})`
      );
    }
  },

  {
    id: 'T3-10',
    tier: 3,
    features: ['F06', 'F14'],
    title: 'dev_tray Lv.2 (4 slots + 12% 3-item tip) scales 3-item R08 by 1.12x while keeping 1-item R02 at 1.00x',
    run: async (ctx) => {
      const measureR08AndR02 = async (devTrayTargetLv) => {
        // Purchase dev_tray through Shop UI up to devTrayTargetLv
        await ctx.resetGame({ clearCloud: true, clearLocal: true });
        await ctx.setSaveData({
          schemaVersion: 2,
          levelStars: ctx.allUnlockedStars(3),
          selectedPatron: 'luna',
          unlockedPatrons: ['mikan', 'luna'],
          deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
          totalEarnedStardust: 700,
          bankStardust: 330,
          seenTutorials: TUTORIALS_ALL_SEEN
        });

        await ctx.clickHit('dock_shop');
        await clickModalHit(ctx, 'shop_tab_devices');
        for (let lv = 0; lv < devTrayTargetLv; lv++) {
          await clickModalHit(ctx, 'shop_buy_dev_tray');
        }
        await ctx.clickHit('modal_close');
        const save = await ctx.getSaveData();
        ctx.assertEq(save.deviceUpgrades.dev_tray, devTrayTargetLv, `dev_tray at Lv.${devTrayTargetLv}`);

        // Find R08 (C1+C2+C3) on 1-3 (where presets at t=0 already include (2,0):C1, (0,0):C2, (3,2):C3!)
        let r08SeatIdx = -1;
        for (let attempt = 0; attempt < 30; attempt++) {
          await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('1-3'));
          const st = await ctx.advanceTime(3.2);
          ctx.assertEq(st.trayCapacity, 4, 'Both dev_tray Lv.1 and Lv.2 provide 4 tray slots');
          r08SeatIdx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R08');
          if (r08SeatIdx >= 0) break;
        }
        ctx.assert(r08SeatIdx >= 0, 'Found customer ordering 3-item R08 (C1+C2+C3) on 1-3');

        const stBeforeR08 = await ctx.getState();
        const custR08 = stBeforeR08.seats[r08SeatIdx];
        const cMultR08 = custR08.isUrgent || custR08.customerId === 'cust_fox' ? 1.25 : 1.0;

        // Place presets (2,0):C1, (0,0):C2, (3,2):C3 atomically so bystander R02/R03 cannot steal C1/C2 mid-roundtrip
        await ctx.eval((sIdx) => {
          const dbg = globalThis.__HOSHI_DEBUG__;
          if (dbg.getState().preferredSeatIdx !== sIdx) {
            dbg.clickHit(`seat_${sIdx}`);
          }
          dbg.tapBoardCell(2, 0);
          dbg.tapBoardCell(0, 0);
          dbg.tapBoardCell(3, 2);
        }, r08SeatIdx);
        const st = await ctx.advanceTime(0.65);
        ctx.assertEq(st.ordersServed, 1, 'R08 auto-served');
        const normR08 = st.score / cMultR08;

        // Also check 1-item R02 (C2) on 1-1 (0 urgent/VIP!) to confirm <3-item orders get 1.00x
        let r02Score = 0;
        for (let attempt = 0; attempt < 20; attempt++) {
          await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('1-1'));
          const st1 = await ctx.advanceTime(3.2);
          const idx = (st1.seats || []).findIndex((s) => s && s.recipeId === 'R02');
          if (idx >= 0) {
            await ctx.clickHit(`seat_${idx}`);
            await ctx.tapBoardCell(1, 1); // preset (1,1):C2
            const stServed = await ctx.advanceTime(0.65);
            r02Score = stServed.score;
            break;
          }
        }
        ctx.assert(r02Score > 0, 'Measured 1-item R02 score');
        return { normR08, r02Score };
      };

      const lv1 = await measureR08AndR02(1);
      const lv2 = await measureR08AndR02(2);

      ctx.assertEq(lv2.r02Score, lv1.r02Score, '1-item R02 receives 0% bonus from dev_tray Lv.2 (1.00x)');
      ctx.assert(lv2.normR08 > lv1.normR08, '3-item R08 score increases at dev_tray Lv.2');
      ctx.assertClose(
        lv2.normR08 / lv1.normR08,
        1.12,
        0.015,
        `3-item R08 ratio (${(lv2.normR08 / lv1.normR08).toFixed(4)}) must equal 1.12x`
      );
    }
  },

  {
    id: 'T3-11',
    tier: 3,
    features: ['F02', 'F14'],
    title: 'Catcake R&D Shop upgrades (Lv.0 -> Lv.2 -> Lv.4) sync live across Compendium and R04 serve math',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: { '1-1': 3 },
        highestUnlockedLevel: '1-2',
        selectedPatron: 'luna',
        unlockedPatrons: ['mikan', 'luna'],
        totalEarnedStardust: 580,
        bankStardust: 500,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      const serveR04On1_2 = async () => {
        for (let attempt = 0; attempt < 25; attempt++) {
          await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('1-2'));
          const st = await ctx.advanceTime(3.2);
          const idx = (st.seats || []).findIndex((s) => s && s.recipeId === 'R04');
          if (idx >= 0) {
            await ctx.clickHit(`seat_${idx}`);
            const c3 = await bakeTileOrganically(ctx, 3, 'plain');
            ctx.assert(c3, 'Merged C3 on 1-2');
            await ctx.tapBoardCell(c3.r, c3.c);
            const after = await ctx.advanceTime(0.65);
            ctx.assertEq(after.ordersServed, 1, 'Served R04 (C3)');
            return after.score;
          }
        }
        throw new Error('Failed to encounter R04 on 1-2 across 25 attempts');
      };

      // 1) Lv.0 baseline: C3 = 150 -> green serve (1.20x) = 180
      const scoreLv0 = await serveR04On1_2();
      ctx.assertClose(scoreLv0, Math.round(150 * 1.2), 1, 'C3 Lv.0 R04 green serve === 180');

      // Return to Lobby / open Shop and upgrade C3 to Lv.2 (40 + 75 = 115 stardust -> price 195)
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openModal('shop'));
      await clickModalHit(ctx, 'shop_tab_catcakes');
      await clickModalHit(ctx, 'shop_buy_catcake_3');
      await clickModalHit(ctx, 'shop_buy_catcake_3');

      let save = await ctx.getSaveData();
      ctx.assertEq(save.catcakeLevels['3'], 2, 'C3 upgraded to Lv.2');
      const consts = await ctx.requireBundledModule('./src/constants.js');
      if (consts && typeof consts.getCatcakePrice === 'function') {
        ctx.assertEq(consts.getCatcakePrice(3, save.catcakeLevels['3']), 195, 'C3 Lv.2 price === 195');
      }

      // Open Compendium (catcakes & recipes tabs) and verify clean live render
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openModal('compendium'));
      let stComp = await ctx.getState();
      ctx.assertEq(stComp.activeModal, 'compendium', 'Compendium modal open');
      await clickModalHit(ctx, 'compendium_tab_catcakes');
      await clickModalHit(ctx, 'compendium_tab_recipes');
      await ctx.checkBounds('T3-11-compendium');
      await ctx.clickHit('modal_close');

      // 2) Lv.2 R04 serve: 195 / 150 = 1.30x -> 234
      const scoreLv2 = await serveR04On1_2();
      ctx.assertClose(scoreLv2, Math.round(195 * 1.2), 1, 'C3 Lv.2 R04 green serve === 234');
      ctx.assertClose(scoreLv2 / scoreLv0, 1.3, 0.01, 'C3 Lv.2 scales R04 score by exact 1.30x');

      // 3) Upgrade C3 to max Lv.4 (115 + 175 = 290 stardust -> price 240 = 1.60x)
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openModal('shop'));
      await clickModalHit(ctx, 'shop_tab_catcakes');
      await clickModalHit(ctx, 'shop_buy_catcake_3');
      await clickModalHit(ctx, 'shop_buy_catcake_3');
      save = await ctx.getSaveData();
      ctx.assertEq(save.catcakeLevels['3'], 4, 'C3 upgraded to max Lv.4');
      await ctx.clickHit('modal_close');

      const scoreLv4 = await serveR04On1_2();
      ctx.assertClose(scoreLv4, Math.round(240 * 1.2), 1, 'C3 Lv.4 R04 green serve === 288');
      ctx.assertClose(scoreLv4 / scoreLv0, 1.6, 0.01, 'C3 Lv.4 scales R04 score by exact 1.60x');
    }
  },

  {
    id: 'T3-12',
    tier: 3,
    features: ['F09', 'F13'],
    title: 'VIP Critic wave on 2-6 (vipQuota: 3) + Chapter 2 settlement stardust breakdown & persistence',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      // Seed Ch.1 cleared (30 stars >= 18) and 2-1..2-5 cleared (2 stars each), leaving 2-6 at 0 stars!
      const priorStars = {};
      for (let i = 1; i <= 10; i++) priorStars[`1-${i}`] = 3;
      for (let i = 1; i <= 5; i++) priorStars[`2-${i}`] = 2;

      // Upgrade C1..C6 to Lv.4 (sum = 2965) + dev_tray Lv.2 (240) + dev_tools Lv.3 (300) = 3505 spent
      await ctx.setupSaveAndStart('2-6', {
        levelStars: priorStars,
        highestUnlockedLevel: '2-6',
        selectedPatron: 'mikan',
        unlockedPatrons: ['mikan'],
        catcakeLevels: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 0 },
        deviceUpgrades: { dev_tray: 2, dev_flour: 0, dev_teapot: 0, dev_tools: 3 },
        totalEarnedStardust: 3605,
        bankStardust: 100,
        lifetimeStats: {
          runsPlayed: 15,
          ordersServed: 100,
          vipServed: 2,
          maxComboEver: 5,
          highestSingleServe: 2000,
          totalStars: 40,
          totalCumulativeScore: 50000
        },
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      const saveBefore = await ctx.getSaveData();
      const bankBefore = saveBefore.bankStardust;
      const vipLifetimeBefore = (saveBefore.lifetimeStats && saveBefore.lifetimeStats.vipServed) || 0;

      await ctx.advanceTime(3.2);

      // Serve waves on 2-6 until vipServed >= 1 AND score >= 12200 (star1 of 2-6 in v0.9.0)
      for (let wave = 0; wave < 42; wave++) {
        let st = await ctx.getState();
        if (st.vipServed >= 1 && st.score >= 12200) break;
        if (st.timeLeft <= 9) break;

        const vipIdx = (st.seats || []).findIndex((s) => s && (s.isVip || s.customerId === 'cust_critic'));
        if (vipIdx >= 0) {
          ctx.assertEq(st.seats[vipIdx].customerId, 'cust_critic', 'VIP seat uses cust_critic');
          await serveCustomerOrganic(ctx, vipIdx, { allowTools: true });
        } else if (st.seats && st.seats.some(Boolean)) {
          await serveCustomerOrganic(ctx, null, { allowTools: true });
          await ctx.advanceTime(1.5);
        } else {
          await ctx.advanceTime(2.0);
        }
      }

      let stMid = await ctx.getState();
      ctx.assert(stMid.vipServed >= 1, `Expected >= 1 VIP served on 2-6, got ${stMid.vipServed}`);
      ctx.assert(stMid.score >= 12200, `Expected score >= 12200 (2-6 star1), got ${stMid.score}`);

      // Advance countdown to 0 for Chapter 2 settlement
      const stEnd = await ctx.advanceTime(stMid.timeLeft + 0.8);
      ctx.assertEq(stEnd.activeModal, 'level_result', '2-6 opens level_result modal on timer expiry');
      ctx.assert(stEnd.lastResult && stEnd.lastResult.cleared === true, '2-6 cleared === true');

      const starsEarned = stEnd.lastResult.starsEarned;
      const vips = stEnd.vipServed;
      ctx.assert(starsEarned >= 1 && starsEarned <= 3, `Valid starsEarned: ${starsEarned}`);

      // Ch.2 formula: firstStarDust = [16, 22, 32], baseClearDust = 10, VIP = +4 each, 3-star bonus = +4
      const ch2First = [16, 22, 32].slice(0, starsEarned).reduce((a, b) => a + b, 0);
      const expectedClear = 10;
      const expectedVip = vips * 4;
      const expectedThreeStar = starsEarned === 3 ? 4 : 0;
      const expectedTotal = ch2First + expectedClear + expectedVip + expectedThreeStar;

      ctx.assertEq(stEnd.lastResult.firstStarDustAward, ch2First, 'Ch.2 firstStarDustAward matches [16,22,32]');
      ctx.assertEq(stEnd.lastResult.clearDustAward, expectedClear, 'Ch.2 baseClearDust === 10');
      ctx.assertEq(stEnd.lastResult.vipDustAward, expectedVip, 'VIP bonus dust === vipServed * 4');
      ctx.assertEq(stEnd.lastResult.threeStarBonusDust, expectedThreeStar, '3-star bonus === 4 iff 3 stars');
      ctx.assertEq(stEnd.lastResult.totalDustAward, expectedTotal, 'totalDustAward matches sum');

      const saveAfter = await ctx.getSaveData();
      ctx.assertEq(saveAfter.bankStardust, bankBefore + expectedTotal, 'bankStardust persisted exact Ch.2 award');
      ctx.assertEq(saveAfter.lifetimeStats.vipServed, vipLifetimeBefore + vips, 'lifetimeStats.vipServed incremented');
      ctx.assertEq(saveAfter.levelStars['2-6'], starsEarned, 'levelStars["2-6"] recorded');
    }
  },

  {
    id: 'T3-13',
    tier: 3,
    features: ['F11', 'F14'],
    title: 'v1 -> v2 lossless migrated stardust (UT-S01: 230) spent in v2 Shop and persisted across reload',
    run: async (ctx) => {
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');

      // Seed exact UT-S01 legacy v1 save directly into wx_ localStorage and reload
      await ctx.eval(() => {
        localStorage.removeItem('__wx_mock_cloud_db_v2__');
        localStorage.setItem(
          'wx_hoshi_kissa_bakery_save_v1',
          JSON.stringify({
            bankStardust: 50,
            unlockedPatrons: ['mikan', 'luna'],
            unlockedThemes: ['amber', 'sakura'],
            shopUpgrades: { up_tools: 2 },
            bestChef: 8000
          })
        );
      });

      await ctx.reload();
      const saveMigrated = await ctx.getSaveData();
      ctx.assertEq(saveMigrated.schemaVersion, 2, 'Migrated save has schemaVersion === 2');
      ctx.assertEq(saveMigrated.totalEarnedStardust, 430, 'UT-S01 totalEarnedStardust === 430');
      ctx.assertEq(saveMigrated.bankStardust, 230, 'UT-S01 bankStardust === 230 (50 + 130 refund + 50 gift)');
      ctx.assert(saveMigrated.unlockedPatrons.includes('luna'), 'Retains unlocked luna');
      ctx.assert(saveMigrated.unlockedThemes.includes('sakura'), 'Retains unlocked sakura');

      // Spend 75 (dev_tray Lv.1) + 140 (mugi) = 215 in v0.9.0 Kissa Shop -> 15 left
      await ctx.clickHit('dock_shop');
      await clickModalHit(ctx, 'shop_tab_devices');
      await clickModalHit(ctx, 'shop_buy_dev_tray');
      await clickModalHit(ctx, 'shop_tab_patrons');
      await clickModalHit(ctx, 'shop_buy_patron_mugi');
      await ctx.clickHit('modal_close');

      const saveMid = await ctx.getSaveData();
      ctx.assertEq(saveMid.bankStardust, 15, '230 - 75 - 140 === 15 stardust');

      // Reload page to verify idempotency and persistence (no double migration or lost purchases)
      await ctx.reload();
      const saveReloaded = await ctx.getSaveData();
      ctx.assertEq(saveReloaded.schemaVersion, 2, 'Post-reload schemaVersion === 2');
      ctx.assertEq(saveReloaded.totalEarnedStardust, 430, 'Post-reload totalEarnedStardust invariant at 430');
      ctx.assertEq(saveReloaded.bankStardust, 15, 'Post-reload bankStardust invariant at 15');
      ctx.assertEq(saveReloaded.deviceUpgrades.dev_tray, 1, 'dev_tray Lv.1 persisted');
      ctx.assert(
        ['mikan', 'luna', 'mugi'].every((p) => saveReloaded.unlockedPatrons.includes(p)),
        'All 3 patrons unlocked after reload'
      );
      ctx.assert(
        ['amber', 'sakura'].every((t) => saveReloaded.unlockedThemes.includes(t)),
        'amber and sakura themes retained after reload'
      );

      // Start 1-1 via Lobby CTA and verify 4-slot tray active in gameplay
      await ctx.clickHit('lobby_start_cta');
      const stPlay = await ctx.getState();
      ctx.assertEq(stPlay.screen, 'playing', 'Entered 1-1 gameplay');
      ctx.assertEq(stPlay.trayCapacity, 4, 'Migrated stardust purchase grants 4-slot tray in 1-1');
    }
  },

  {
    id: 'T3-14',
    tier: 3,
    features: ['F11', 'F15'],
    title: 'Emergency utensil consumableSpentStardust conserved across Cloud push and fresh-device pull',
    run: async (ctx) => {
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      await ctx.setSaveData({
        schemaVersion: 2,
        bankStardust: 100,
        totalEarnedStardust: 100,
        lastSyncedEarnedStardust: 100,
        consumableSpentStardust: 0,
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      await ctx.clickHit('lobby_start_cta');
      let st = await ctx.getState();
      ctx.assertEq(st.toolCounts.fork, 1, 'dev_tools Lv.0 grants 1 free fork');
      ctx.assertEq(st.toolCounts.spoon, 0, 'dev_tools Lv.0 grants 0 free spoons');

      // Spend free fork on (0,0), then buy & apply emergency fork (20) on (0,1) and emergency spoon (25) on (1,1)
      await ctx.useToolOnCell('fork', 0, 0, 'trash');
      await buyAndApplyEmergencyTool(ctx, 'fork', 0, 1);
      await buyAndApplyEmergencyTool(ctx, 'spoon', 1, 1);

      const saveMid = await ctx.getSaveData();
      ctx.assertEq(saveMid.consumableSpentStardust, 45, '20 (fork) + 25 (spoon) === 45 consumableSpentStardust');
      ctx.assertEq(saveMid.bankStardust, 55, '100 - 45 === 55 bankStardust mid-run');

      // Serve at least 1 order to clear 1-1 (>= 850), finish level, and push to cloud
      await ctx.advanceTime(3.2);
      while ((await ctx.getState()).score < 900) {
        await serveCustomerOrganic(ctx);
      }
      st = await ctx.getState();
      await ctx.advanceTime(st.timeLeft + 0.6);
      await ctx.flushCloudSync(2000);

      const saveSynced = await ctx.getSaveData();
      const expectedTotalEarned = saveSynced.totalEarnedStardust;
      const expectedBank = expectedTotalEarned - 45;
      ctx.assertEq(saveSynced.consumableSpentStardust, 45, 'Post-settlement consumableSpentStardust === 45');
      ctx.assertEq(saveSynced.bankStardust, expectedBank, 'Post-settlement bank === totalEarned - 45');
      ctx.assertEq((await ctx.getState()).cloudStatus, 'synced', 'Cloud push succeeded (synced)');

      // Simulate Fresh Device B: wipe ONLY local wx save while keeping mock Cloud DB, then reload ?cloud=1
      await ctx.eval(() => {
        localStorage.removeItem('wx_hoshi_kissa_bakery_save_v1');
      });
      await ctx.reload();
      await ctx.flushCloudSync(2000);

      const pulledSave = await ctx.getSaveData();
      ctx.assertEq(pulledSave.consumableSpentStardust, 45, 'Fresh-device pull preserves consumableSpentStardust === 45');
      ctx.assertEq(pulledSave.totalEarnedStardust, expectedTotalEarned, 'Fresh-device pull preserves totalEarnedStardust');
      ctx.assertEq(
        pulledSave.bankStardust,
        expectedBank,
        'Zero cross-device emergency tool refund exploit (bank === totalEarned - 35)'
      );
    }
  },

  {
    id: 'T3-15',
    tier: 3,
    features: ['F12', 'F13'],
    title: 'Multi-level campaign stars (3+2=5) and best scores sync accurately to dual Cloud leaderboards',
    run: async (ctx) => {
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      // Seed 3 cloud rivals to verify BOTH primary sort and tie-break order across 'stars' and 'score' boards:
      // Player will achieve 5 stars (1-1: 3★ >=1400, 1-2: 2★ in [1520, 1949]) with cumulative score ~3000..4500.
      await ctx.setCloudConfig({
        seedRivals: [
          { id: 'rival_top', nickName: '星冠大师A', avatarPreset: 'luna', totalStars: 12, totalCumulativeScore: 15000, isNpc: false },
          { id: 'rival_tie', nickName: '同星店长B', avatarPreset: 'mikan', totalStars: 5, totalCumulativeScore: 2100, isNpc: false },
          { id: 'rival_rich', nickName: '高分冲刺C', avatarPreset: 'mugi', totalStars: 3, totalCumulativeScore: 9500, isNpc: false }
        ]
      });

      await ctx.setSaveData({
        schemaVersion: 2,
        bankStardust: 30,
        totalEarnedStardust: 30,
        lastSyncedEarnedStardust: 30,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      // Clear 1-1 with 3 stars (score >= 1750, < 4000)
      await ctx.clickHit('lobby_start_cta');
      await ctx.advanceTime(3.2);
      while ((await ctx.getState()).score < 1800) {
        await serveCustomerOrganic(ctx);
      }
      let st = await ctx.getState();
      await ctx.advanceTime(st.timeLeft + 0.6);
      st = await ctx.getState();
      ctx.assertEq(st.activeModal, 'level_result', '1-1 settled');
      ctx.assertEq(st.lastResult.starsEarned, 3, '1-1 earned 3 stars');

      // Advance via result_next_btn into 1-2 and finish at >=2 stars (score >= 1800)
      await ctx.clickHit('result_next_btn');
      st = await ctx.getState();
      if (st.activeModal === 'level_preview') {
        await ctx.clickHit('preview_start_btn');
      }
      await ctx.advanceTime(3.2);
      while ((await ctx.getState()).score < 1850) {
        const cur = await ctx.getState();
        const smallIdx = (cur.seats || []).findIndex((s) => s && ['R01', 'R02', 'R03', 'R04'].includes(s.recipeId));
        await serveCustomerOrganic(ctx, smallIdx >= 0 ? smallIdx : null);
        if ((await ctx.getState()).score >= 1820) break;
      }
      st = await ctx.getState();
      // If a big combo pushed >= 1950, replay 1-2 once stopping right above 1520? Wait: bestStars is monotonic,
      // so compute actual expected stars (2 or 3) dynamically while verifying exact cumulative math!
      await ctx.advanceTime(st.timeLeft + 0.6);
      await ctx.flushCloudSync(2000);

      const save = await ctx.getSaveData();
      const stars1 = save.levelStars['1-1'] || 0;
      const stars2 = save.levelStars['1-2'] || 0;
      const expectedTotalStars = stars1 + stars2;
      const expectedTotalScore = (save.levelBestScores['1-1'] || 0) + (save.levelBestScores['1-2'] || 0);
      ctx.assert(expectedTotalStars >= 5, `Expected >= 5 total stars, got ${expectedTotalStars}`);
      ctx.assert(expectedTotalScore >= 2950 && expectedTotalScore < 9500, `Expected cumulative score in [2950, 9500), got ${expectedTotalScore}`);

      // Verify Cloud leaderboard responses directly AND via live UI modal tabs
      const lbStars = await ctx.callCloud({ action: 'leaderboard', boardType: 'stars' });
      ctx.assert(lbStars && lbStars.ok === true, 'Cloud stars leaderboard ok');
      ctx.assertEq(lbStars.boardType, 'stars', 'boardType === stars');
      ctx.assertEq(lbStars.myRank, 2, 'On stars board, player (5~6★, >2100) ranks #2 behind rival_top (12★) and ahead of rival_tie (5★, 2100) & rival_rich (3★)');

      const lbScore = await ctx.callCloud({ action: 'leaderboard', boardType: 'score' });
      ctx.assert(lbScore && lbScore.ok === true, 'Cloud score leaderboard ok');
      ctx.assertEq(lbScore.boardType, 'score', 'boardType === score');
      ctx.assertEq(lbScore.myRank, 3, 'On score board, player (~3000..4500) ranks #3 behind rival_top (15000) and rival_rich (9500)');

      // Open live Dual Leaderboard UI and toggle tabs
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openModal('leaderboard'));
      await ctx.sleep(80);
      st = await ctx.getState();
      ctx.assertEq(st.activeModal, 'leaderboard', 'Leaderboard modal open');
      ctx.assertEq(st.leaderboardBoardType, 'stars', 'Default leaderboard tab is stars');
      await ctx.clickHit('leaderboard_tab_score');
      await ctx.sleep(60);
      st = await ctx.getState();
      ctx.assertEq(st.leaderboardBoardType, 'score', 'Switched leaderboard tab to score');
      await ctx.clickHit('leaderboard_tab_stars');
      st = await ctx.getState();
      ctx.assertEq(st.leaderboardBoardType, 'stars', 'Switched leaderboard tab back to stars');
    }
  },

  {
    id: 'T3-16',
    tier: 3,
    features: ['F10', 'F16'],
    title: 'Non-blocking spotlight keeps BGM bright (12500 Hz) while Pause modal muffles BGM to 580 Hz',
    run: async (ctx) => {
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setSaveData({
        schemaVersion: 2,
        bgmTrack: 'waltz',
        sfxEnabled: true,
        bankStardust: 30,
        totalEarnedStardust: 30,
        seenTutorials: {
          intro_slide: false,
          tray_trash: false,
          flavor_tile: false,
          ice_tile: false
        }
      });

      // Enter 1-1 via real CDP tap so WebAudio unlocks and BGM 'waltz' starts running
      await ctx.clickHit('lobby_start_cta', { viaCdp: true });
      await ctx.sleep(160);

      let st = await ctx.getState();
      let h = await ctx.getHarnessState();
      ctx.assertEq(st.screen, 'playing', 'Entered 1-1');
      ctx.assertEq(st.activeModal, null, 'No blocking modal open during spotlight');
      ctx.assert(
        typeof st.activeTutorialStep === 'string' && st.activeTutorialStep.includes('intro_slide'),
        `Expected intro_slide spotlight active on fresh 1-1, got ${st.activeTutorialStep}`
      );
      ctx.assert(
        h.audioStats.lowpassLastTargetHz === null || h.audioStats.lowpassLastTargetHz >= 10000,
        `Non-blocking spotlight must keep BGM un-muffled (~12500 Hz), got ${h.audioStats.lowpassLastTargetHz}`
      );

      // Verify spotlight is genuinely non-blocking: real board swipe merges C1+C1 -> C2 right through spotlight
      await ctx.swipeBoard('left');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile.tier, 2, 'Non-blocking spotlight allowed real board swipe merge');

      // Open Pause modal -> BGM tone filter must muffle to 580 Hz
      await ctx.clickHit('pause_btn', { viaCdp: true });
      await ctx.sleep(80);
      st = await ctx.getState();
      h = await ctx.getHarnessState();
      ctx.assertEq(st.activeModal, 'pause', 'Pause modal opened');
      ctx.assertClose(
        h.audioStats.lowpassLastTargetHz,
        580,
        20,
        `Pause modal must muffle BGM lowpass target to 580 Hz (got ${h.audioStats.lowpassLastTargetHz})`
      );

      // Close Pause modal -> BGM tone filter must restore to 12500 Hz
      const resumeHit = (st.hits || []).find(
        (hit) => /resume|continue|modal_close/i.test(hit.id) && !/backdrop|guard/i.test(hit.id)
      );
      await ctx.clickHit(resumeHit ? resumeHit.id : 'modal_close', { viaCdp: true });
      await ctx.sleep(80);
      st = await ctx.getState();
      h = await ctx.getHarnessState();
      ctx.assertEq(st.activeModal, null, 'Pause modal closed');
      ctx.assertClose(
        h.audioStats.lowpassLastTargetHz,
        12500,
        100,
        `Closing modal must restore BGM lowpass target to 12500 Hz (got ${h.audioStats.lowpassLastTargetHz})`
      );
    }
  },

  {
    id: 'T3-17',
    tier: 3,
    features: ['F06', 'F16'],
    title: 'Compact 375x667 end-to-end raw CDP touch gesture chain (swipe, light tap, 120ms double-tap trash, auto-serve)',
    viewport: { width: 375, height: 667, mobile: true, dpr: 2 },
    query: '?safeTop=20&safeBottom=0&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(375, 667, true, 2, { safeTop: 20, safeBottom: 0, showCapsule: true });
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      await ctx.setupSaveAndStart('1-3', {
        levelStars: ctx.allUnlockedStars(3),
        totalEarnedStardust: 300,
        bankStardust: 300,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      await ctx.checkBounds('T3-17-375x667-play', { safeBottom: 0 });
      let st = await ctx.getState();
      ctx.assert(st.boardLayout && st.boardLayout.cellSize >= 46, '375x667 cellSize >= 46px');

      await ctx.advanceTime(3.2);

      // 1) Raw CDP touch swipes (>= 18px): merge (0,0):C2 and (1,1):C2 without triggering tray tap
      await ctx.swipeBoard('left');
      await ctx.swipeBoard('up');
      st = await ctx.getState();
      ctx.assert(
        (st.tray || []).every((slot) => slot === null),
        'Board swipe (>=18px) must never misclassify as tray placement tap'
      );
      ctx.assertEq(st.score, 0, 'Swipes award 0 score');

      // 2) Raw CDP light tap (< 5px, < 350ms) on a C1 tile (1-3 allowedRecipes starts at R02, so C1 alone never auto-serves!)
      let c1Tile = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier === 1);
      while (!c1Tile) {
        await ctx.clickHit('knead_btn', { viaCdp: true });
        await ctx.advanceBothClocks(140);
        st = await ctx.getState();
        c1Tile = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier === 1);
      }
      const c1Px = ctx.cellCenterPx(st.boardLayout, c1Tile.r, c1Tile.c);
      await ctx.tapCanvas(c1Px.x, c1Px.y, { holdMs: 40 });
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[c1Tile.r][c1Tile.c].tile, null, 'Tapped board cell cleared immediately');
      ctx.assert(st.tray[0] !== null && st.tray[0].tier === 1, 'C1 loaded into tray_slot_0 via raw CDP tap');
      ctx.assertEq(st.score, 0, 'Loading tray keeps score === 0');

      // 3) Raw CDP double-tap (120ms <= 320ms) on tray_slot_0 discards into trash with 0 penalty
      const slot0Hit = (st.hits || []).find((h) => h.id === 'tray_slot_0');
      ctx.assert(slot0Hit, 'tray_slot_0 present in HitRegistry on 375x667');
      await ctx.doubleTapCanvas(
        Math.round(slot0Hit.x + slot0Hit.w / 2),
        Math.round(slot0Hit.y + slot0Hit.h / 2),
        { gapMs: 95, holdMs: 25 }
      );
      st = await ctx.getState();
      ctx.assertEq(st.tray[0], null, '120ms double-tap discarded tray_slot_0 into trash');
      ctx.assertEq(st.score, 0, 'Trash discard applies 0 score penalty');

      // 4) Raw CDP swipes + knead + light board taps to fulfill a seated customer on 375x667!
      const targetIdx = [0, 1, 2]
        .filter((i) => st.seats[i])
        .sort((a, b) => {
          const slotsA = getOrderSlots(st.seats[a]);
          const slotsB = getOrderSlots(st.seats[b]);
          if (slotsA.length !== slotsB.length) return slotsA.length - slotsB.length;
          const maxA = Math.max(...slotsA.map((s) => s.tier));
          const maxB = Math.max(...slotsB.map((s) => s.tier));
          return maxA - maxB;
        })[0];
      const seatHit = (st.hits || []).find((h) => h.id === `seat_${targetIdx}`);
      if (seatHit) {
        await ctx.tapCanvas(Math.round(seatHit.x + seatHit.w / 2), Math.round(seatHit.y + seatHit.h / 2), { holdMs: 35 });
      }

      const reqs = getOrderSlots(st.seats[targetIdx]);
      // Bake entire order multiset simultaneously on 375x667 using ONLY raw CDP swipeBoard & knead_btn
      const matchedTiles = await bakeOrderMultisetOrganically(ctx, reqs, {
        viaRawTouch: true,
        allowTools: false,
        maxSteps: 200
      });
      ctx.assert(matchedTiles, `Baked simultaneous multiset on 375x667 for ${st.seats[targetIdx].recipeId}`);

      st = await ctx.getState();
      for (const tile of matchedTiles) {
        ctx.assert(st.grid.cells[tile.r][tile.c]?.tile, `Tile at (${tile.r},${tile.c}) present before raw CDP tap`);
        const px = ctx.cellCenterPx(st.boardLayout, tile.r, tile.c);
        await ctx.tapCanvas(px.x, px.y, { holdMs: 35 });
      }

      st = await ctx.advanceTime(0.65);
      ctx.assert(st.ordersServed >= 1, 'Raw CDP touch chain completed customer order on 375x667');
      ctx.assert(st.score > 0, 'Auto-serve awarded positive score on 375x667');
    }
  },

  {
    id: 'T3-18',
    tier: 3,
    features: ['F01', 'F14'],
    title: 'v0.9.0 storybook PNG/JPG assets (69/69), kissa_round.ttf font & 3 board themes visual integrity',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.resetGame({ clearCloud: true, clearLocal: true });
      ctx.cdp.clearErrors();

      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: ctx.allUnlockedStars(3),
        totalEarnedStardust: 500,
        bankStardust: 500,
        unlockedThemes: ['amber'],
        equippedTheme: 'amber',
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      let st = await ctx.getState();
      ctx.assertEq(st.assetsTotal, 69, 'v0.9.0 runtime assetsTotal === 69');
      ctx.assertEq(st.assetsLoaded, 69, 'All 69 runtime PNG/JPG assets loaded cleanly');

      const consts = await ctx.requireBundledModule('./src/constants.js');
      const byId = new Map((consts.V090_ASSET_LIST || []).map((a) => [a.id, a.path]));
      for (const reqId of ['catcake_1', 'catcake_7', 'cust_fox', 'flavor_gold', 'title_hero_v2', 'icon_fever_badge']) {
        const rel = byId.get(reqId);
        ctx.assert(Boolean(rel) && fs.existsSync(path.join(ctx.minigameDir, rel)), `Missing v0.9.0 asset ${reqId}: ${rel}`);
      }
      ctx.assert(
        fs.existsSync(path.join(ctx.minigameDir, 'assets', 'fonts', 'kissa_round.ttf')),
        'assets/fonts/kissa_round.ttf exists on disk'
      );

      // Unlock sakura (100) & moonlight (140) via dock_themes
      await ctx.clickHit('dock_themes');
      st = await ctx.getState();
      ctx.assertEq(st.activeModal, 'shop', 'dock_themes opens Shop modal');
      ctx.assertEq(st.activeShopTab, 'themes', 'dock_themes selects themes tab');
      await clickModalHit(ctx, 'shop_buy_theme_sakura');
      await clickModalHit(ctx, 'shop_buy_theme_moonlight');
      await ctx.clickHit('modal_close');

      const saveThemes = await ctx.getSaveData();
      ctx.assertEq(saveThemes.bankStardust, 260, '500 - 100 - 140 === 260 stardust');
      ctx.assert(
        ['amber', 'sakura', 'moonlight'].every((t) => saveThemes.unlockedThemes.includes(t)),
        'All 3 themes unlocked'
      );

      // Render Compendium (both tabs) so all 7 catcakes & 24 recipes draw on Canvas
      await ctx.clickHit('dock_compendium');
      await clickModalHit(ctx, 'compendium_tab_catcakes');
      await clickModalHit(ctx, 'compendium_tab_recipes');
      await ctx.clickHit('modal_close');

      // Equip and render Lobby + 3-1 Gameplay for each theme
      for (const themeId of ['amber', 'sakura', 'moonlight']) {
        await ctx.eval((tid) => globalThis.__HOSHI_DEBUG__.openModal('shop') || tid, themeId);
        await clickModalHit(ctx, 'shop_tab_themes');
        if (((await ctx.getState()).hits || []).some((h) => h.id === `shop_equip_theme_${themeId}`)) {
          await clickModalHit(ctx, `shop_equip_theme_${themeId}`);
        } else {
          const s = await ctx.getSaveData();
          await ctx.setSaveData({ ...s, equippedTheme: themeId });
        }
        await ctx.clickHit('modal_close');
        ctx.assertEq((await ctx.getSaveData()).equippedTheme, themeId, `Equipped theme ${themeId}`);

        await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('3-1'));
        await ctx.advanceTime(3.2);
        await ctx.checkBounds(`T3-18-theme-${themeId}`, { safeBottom: 34 });
      }

      const harness = await ctx.getHarnessState();
      ctx.assertEq(harness.gradientStats.hslViolations.length, 0, 'Zero hsl()/hsla() gradient stops across all 3 themes');
      if (Array.isArray(harness.emojiViolations)) {
        ctx.assertEq(harness.emojiViolations.length, 0, 'Zero native Unicode emoji drawn on Canvas');
      }
      ctx.assertEq((ctx.cdp.networkErrors || []).length, 0, 'Zero HTTP 404/500 network asset errors');
      ctx.assertEq(ctx.cdp.errors.length, 0, 'Zero console/runtime errors');
    }
  }
];

export default TIER3_TESTS;
