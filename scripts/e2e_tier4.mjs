import fs from 'node:fs';
import path from 'node:path';

/**
 * Tier 4 — Real-World End-to-End Player Journey Suite (10 Scenarios: T4-01 .. T4-10)
 *
 * - T4-01 .. T4-08 map 1-to-1 to the 8 mandatory L3 acceptance scenarios in
 *   `docs/v2.0/06-测试与端到端验收规格书.md` §4.
 * - T4-09 covers the Veteran v1->v2 Migration -> Shop -> Ch.3 Finale `3-10` Boss ->
 *   WeChat CloudBase Dual Leaderboard & UserInfo authorization journey.
 * - T4-10 covers Offline (`?cloud=0`) Full-Board Deadlock Recovery + Emergency Utensil
 *   Conservation -> Online (`?cloud=1`) Multi-Device Delta Union & `retry_pending` Recovery.
 * - Every scenario is self-contained: passes both in sequential `--tier 4` runs AND
 *   when invoked standalone via `--filter T4-0X`.
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

const TUTORIALS_ALL_SEEN = {
  intro_slide: true,
  tray_trash: true,
  flavor_tile: true,
  ice_tile: true
};

const BACKDROP_HIT_RE = /^(modal_backdrop|modal_body_guard|tutorial_backdrop|spotlight_backdrop|guide_backdrop)$/i;

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
  const st = await ctx.getState();
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

function tileSatisfiesSlot(tile, reqFlavor) {
  if (!tile) return false;
  if (!reqFlavor || reqFlavor === 'any') return true;
  return tile.flavor === reqFlavor || tile.flavor === 'gold';
}

async function bakeTileOrganically(ctx, targetTier, targetFlavor = 'any', opts = {}) {
  const maxSteps = opts.maxSteps || 150;
  const excludeCoords = new Set((opts.excludeCoords || []).map(([r, c]) => `${r},${c}`));
  const viaRawTouch = Boolean(opts.viaRawTouch);

  for (let step = 0; step < maxSteps; step++) {
    const st = await ctx.getState();
    const board = inspectBoard(st);

    const match = board.tiles.find(
      (t) =>
        t.frozenHp === 0 &&
        t.tier === targetTier &&
        !excludeCoords.has(`${t.r},${t.c}`) &&
        tileSatisfiesSlot(t, targetFlavor)
    );
    if (match) return match;

    const dirs = ['left', 'up', 'right', 'down'];
    if (targetFlavor !== 'any' && targetFlavor !== 'plain') {
      let dyed = false;
      for (const dir of dirs) {
        const prev = previewSlideReadOnly(st.grid, dir);
        if (!prev.moved) continue;
        if (prev.placements.some((p) => p.tier === targetTier && (p.cellType === targetFlavor || p.cellType === 'gold'))) {
          if (viaRawTouch) await ctx.swipeBoard(dir);
          else await ctx.slide(dir);
          dyed = true;
          break;
        }
      }
      if (dyed) continue;
    }

    let bestDir = null;
    let bestScore = -1;
    for (const dir of dirs) {
      const prev = previewSlideReadOnly(st.grid, dir);
      if (!prev.moved) continue;
      let dirScore = 1;
      for (const m of prev.merges) {
        if (m.newTier <= targetTier) {
          dirScore += m.newTier * 20;
          if (m.newTier === targetTier && targetFlavor !== 'any' && (m.cellType === targetFlavor || m.cellType === 'gold')) {
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
      if (viaRawTouch) {
        await ctx.clickHit('knead_btn', { viaCdp: true });
        await ctx.advanceBothClocks(135);
      } else {
        await safeKnead(ctx);
      }
      continue;
    }

    if (bestDir && (bestScore >= 20 || board.playableEmpty <= 2)) {
      if (viaRawTouch) await ctx.swipeBoard(bestDir);
      else await ctx.slide(bestDir);
      continue;
    }

    if (board.playableEmpty > 0) {
      if (viaRawTouch) {
        await ctx.clickHit('knead_btn', { viaCdp: true });
        await ctx.advanceBothClocks(135);
      } else {
        await safeKnead(ctx);
      }
      continue;
    }

    if (bestDir) {
      if (viaRawTouch) await ctx.swipeBoard(bestDir);
      else await ctx.slide(bestDir);
      continue;
    }

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
  return (
    inspectBoard(finalSt).tiles.find(
      (t) =>
        t.frozenHp === 0 &&
        t.tier === targetTier &&
        !excludeCoords.has(`${t.r},${t.c}`) &&
        tileSatisfiesSlot(t, targetFlavor)
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

    const trappedUndyed =
      step > 0 && step % 18 === 0 && targetReq.flavor !== 'any'
        ? board.tiles.find(
            (t) =>
              t.frozenHp === 0 &&
              t.tier === targetReq.tier &&
              !curMatch.protectedKeys.has(`${t.r},${t.c}`) &&
              !tileSatisfiesSlot(t, targetReq.flavor)
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
        await ctx.tapCanvas(px.x, px.y, { holdMs: 40 });
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
          tileSatisfiesSlot(t, targetReq.flavor)
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
          if (pt.frozenHp === 0 && pt.tier === targetReq.tier && !tileSatisfiesSlot(pt, targetReq.flavor)) {
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
        await ctx.tapCanvas(px.x, px.y, { holdMs: 40 });
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

  const st = await ctx.getState();
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
    `Emergency ${kind} must add ${cost} to consumableSpentStardust`
  );
  return saveAfter;
}

function collectStringLeafPaths(obj, out = new Set()) {
  if (!obj) return out;
  if (typeof obj === 'string') {
    if (obj.includes('/') || /\.(png|jpg|jpeg|webp)$/i.test(obj)) out.add(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectStringLeafPaths(item, out);
    return out;
  }
  if (typeof obj === 'object') {
    for (const val of Object.values(obj)) collectStringLeafPaths(val, out);
  }
  return out;
}

function walkClientFiles(dirAbs, rootAbs = dirAbs, out = []) {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dirAbs, ent.name);
    const rel = path.relative(rootAbs, full).replace(/\\/g, '/');
    if (ent.isDirectory()) {
      if (rel === 'cloudfunctions' || rel.startsWith('cloudfunctions/') || ent.name === 'node_modules') {
        continue;
      }
      walkClientFiles(full, rootAbs, out);
    } else if (ent.isFile()) {
      if (rel === 'cloudbaserc.json' || rel === 'project.private.config.json' || rel.endsWith('.md')) {
        continue;
      }
      out.push({ rel, full, size: fs.statSync(full).size });
    }
  }
  return out;
}

async function assertCapsuleAndSafeBottomExplicit(ctx, label, safeBottom) {
  await ctx.checkBounds(label, { safeBottom });
  const st = await ctx.getState();
  const h = await ctx.getHarnessState();
  const menuRect = (st.metrics && st.metrics.menuRect) || h.menuRect;
  const width = st.metrics.width;
  const height = st.metrics.height;

  for (const hit of st.hits || []) {
    if (!hit || BACKDROP_HIT_RE.test(hit.id)) continue;
    ctx.assert(hit.x >= -2 && hit.x + hit.w <= width + 2, `[${label}] hit ${hit.id} horizontally out of viewport`);
    ctx.assert(
      hit.y >= -2 && hit.y + hit.h <= height - safeBottom + 2,
      `[${label}] hit ${hit.id} violates bottom safe-area (${hit.y + hit.h} > ${height - safeBottom})`
    );
    if (menuRect && hit.y < menuRect.bottom && hit.y + hit.h > menuRect.top && st.activeModal === null) {
      ctx.assert(
        hit.x + hit.w <= menuRect.left - 8 + 2,
        `[${label}] top-bar hit ${hit.id} right (${hit.x + hit.w}) exceeds menuRect.left - 8 (${menuRect.left - 8})`
      );
    }
  }
}

export const TIER4_TESTS = [
  {
    id: 'T4-01',
    tier: 4,
    features: ['F13', 'F02'],
    title: 'L3-1: First-screen campaign Lobby, Chapter 1 nodes 1-1..1-10, and complete purge of legacy rush/zen modes',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      const st = await ctx.getState();
      ctx.assertEq(st.screen, 'lobby', 'Boot opens directly into campaign Lobby');
      ctx.assertEq(st.selectedChapter, 1, 'Default selectedChapter === 1');
      ctx.assertEq(st.activeModal, null, 'No blocking modal on initial Lobby');

      const hitIds = (st.hits || []).map((h) => h.id);
      for (let i = 1; i <= 10; i++) {
        const nodeId = `level_node_1-${i}`;
        ctx.assert(hitIds.includes(nodeId), `Lobby must expose Chapter 1 node ${nodeId}`);
      }
      for (const reqHit of [
        'lobby_start_cta',
        'dock_shop',
        'dock_compendium',
        'dock_leaderboard',
        'dock_themes',
        'lobby_bgm_btn',
        'lobby_sfx_btn',
        'lobby_help_btn'
      ]) {
        ctx.assert(hitIds.includes(reqHit), `Lobby must expose canonical HitRegistry control ${reqHit}`);
      }

      // Mandatory L3-1 negative check: zero legacy mode cards/buttons in HitRegistry or state
      const forbiddenHit = hitIds.find((id) => /mode_rush|mode_zen|mode_chef|\brush\b|\bzen\b|resume_run/i.test(id));
      ctx.assert(!forbiddenHit, `Legacy mode button must not exist in Lobby: ${forbiddenHit}`);
      ctx.assert(!('savedRuns' in st) && !('mode' in st && (st.mode === 'rush' || st.mode === 'zen')), 'No legacy rush/zen state');

      await assertCapsuleAndSafeBottomExplicit(ctx, 'T4-01-lobby-390', 34);
      const shot = await ctx.captureScreenshot('01_l3_lobby_campaign_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 01_l3_lobby_campaign_390.png');
    }
  },

  {
    id: 'T4-02',
    tier: 4,
    features: ['F03', 'F05', 'F08', 'F16'],
    title: 'L3-2: Enter 1-1 via main CTA, execute 2 touch swipes + 1 Knead tap, and assert strict score === 0',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      let st = await ctx.getState();
      if (st.screen !== 'lobby' || st.activeModal !== null) {
        await ctx.resetGame({ clearCloud: true, clearLocal: true });
      }

      await ctx.clickHit('lobby_start_cta', { viaCdp: true });
      st = await ctx.getState();
      ctx.assertEq(st.screen, 'playing', 'Main CTA enters gameplay');
      ctx.assertEq(st.currentLevelId, '1-1', 'Entered level 1-1');
      ctx.assertEq(st.score, 0, 'Initial score === 0');

      // 2 valid touch swipes on 1-1: 'left' merges (0,0)+(0,1) C1s -> C2; 'up' merges (0,0)+(1,0) C2s -> C3
      await ctx.swipeBoard('left');
      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[0][0].tile.tier, 2, '1st touch swipe merged C1+C1 -> C2 at (0,0)');
      ctx.assertEq(st.score, 0, 'Score remains 0 after 1st valid swipe + merge + spawn');

      await ctx.swipeBoard('up');
      st = await ctx.getState();
      ctx.assert(inspectBoard(st).maxTier >= 3, '2nd touch swipe merged C2+C2 -> C3');
      ctx.assertEq(st.score, 0, 'Score remains 0 after 2nd valid swipe + merge + spawn');

      // 1 click on independent Knead button (`🐾 揉面补料`)
      const beforeKneadCount = inspectBoard(st).total;
      await ctx.clickHit('knead_btn', { viaCdp: true });
      st = await ctx.getState();
      if (inspectBoard(st).total === beforeKneadCount) {
        await ctx.advanceBothClocks(140);
        await ctx.clickHit('knead_btn', { viaCdp: true });
        st = await ctx.getState();
      }
      ctx.assertEq(inspectBoard(st).total, beforeKneadCount + 1, 'Knead button spawned 1 new low-tier catcake');
      ctx.assertEq(st.ordersServed, 0, 'Zero customer orders served yet');
      ctx.assertEq(st.score, 0, 'L3-2 Iron Law: gameState.score === 0 after 2 swipes + 1 knead');

      const shot = await ctx.captureScreenshot('02_l3_level_1_1_zero_score_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 02_l3_level_1_1_zero_score_390.png');
    }
  },

  {
    id: 'T4-03',
    tier: 4,
    features: ['F06', 'F07', 'F08', 'F09', 'F16'],
    title: 'L3-3: Light-tap matching board tile (<5px) into tray, trigger flyingServe auto-serve, and assert score > 0',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      let st = await ctx.getState();
      if (st.screen !== 'playing' || st.currentLevelId !== '1-1' || st.score !== 0) {
        await ctx.resetGame({ clearCloud: true, clearLocal: true });
        await ctx.setSaveData({
          schemaVersion: 2,
          bankStardust: 30,
          totalEarnedStardust: 30,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        await ctx.clickHit('lobby_start_cta', { viaCdp: true });
      }

      st = await ctx.advanceTime(3.2);
      const seatIdx = [0, 1, 2]
        .filter((i) => st.seats && st.seats[i])
        .sort((a, b) => getOrderSlots(st.seats[a]).length - getOrderSlots(st.seats[b]).length)[0];
      ctx.assert(seatIdx !== undefined, 'At least 1 customer seated on 1-1');

      const seat = st.seats[seatIdx];
      await ctx.clickHit(`seat_${seatIdx}`, { viaCdp: true });
      const reqs = getOrderSlots(seat);

      // Ensure all required C1/C2 ingredients exist simultaneously on board using only swipes/kneads (score stays 0!)
      const matchedTiles = await bakeOrderMultisetOrganically(ctx, reqs, {
        viaRawTouch: true,
        allowTools: false,
        maxSteps: 150
      });
      ctx.assert(matchedTiles, `Baked simultaneous multiset on 1-1 for ${seat.recipeId}`);

      st = await ctx.getState();
      ctx.assertEq(st.score, 0, 'Score strictly 0 prior to completing customer tray');

      // Light-tap (<5px displacement, <350ms) each matched tile coordinate from board into tray
      for (let i = 0; i < matchedTiles.length; i++) {
        const target = matchedTiles[i];
        st = await ctx.getState();
        ctx.assert(st.grid.cells[target.r][target.c]?.tile, `Tile at (${target.r},${target.c}) present for light tap`);
        const px = ctx.cellCenterPx(st.boardLayout, target.r, target.c);
        await ctx.tapCanvas(px.x, px.y, { holdMs: 40 });

        const stMid = await ctx.getState();
        ctx.assertEq(stMid.grid.cells[target.r][target.c].tile, null, 'Tapped board cell immediately emptied');
        if (i === 0 && matchedTiles.length > 1) {
          ctx.assert(stMid.tray.some((slot) => slot !== null), 'Tile appeared in serving tray slot');
          ctx.assertEq(stMid.score, 0, 'Partial multi-item tray does not score yet');
        }
      }

      // Advance simulation clock past 0.10s settle + 0.28s flyingServe animation
      st = await ctx.advanceTime(0.65);
      ctx.assert(st.ordersServed >= 1, `Expected ordersServed >= 1 after auto-serve, got ${st.ordersServed}`);
      ctx.assert(st.score > 0, `L3-3: gameState.score (${st.score}) > 0 strictly after customer order auto-served`);

      const shot = await ctx.captureScreenshot('03_l3_tray_autoserve_scored_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 03_l3_tray_autoserve_scored_390.png');
    }
  },

  {
    id: 'T4-04',
    tier: 4,
    features: ['F05', 'F06', 'F16'],
    title: 'L3-4: Rapid double-tap (120ms < 320ms) tray discard into trash with 0 penalty and full-board deadlock recovery',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      let st = await ctx.getState();
      if (st.screen !== 'playing' || st.currentLevelId !== '1-1') {
        await ctx.resetGame({ clearCloud: true, clearLocal: true });
        await ctx.setSaveData({
          schemaVersion: 2,
          bankStardust: 30,
          totalEarnedStardust: 30,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        await ctx.clickHit('lobby_start_cta', { viaCdp: true });
        await ctx.advanceTime(1.0);
      }

      await clearTraySlots(ctx);

      // Bake a C3 on 1-1 (no customer on 1-1 ever orders C3, preventing 0.10s rAF auto-serve during double-tap!)
      const c3Tile = await bakeTileOrganically(ctx, 3, 'plain');
      ctx.assert(c3Tile, 'Baked C3 on 1-1 for tray discard test');
      st = await ctx.getState();
      const scoreBeforeTrash = st.score;

      // Single-tap C3 into tray_slot_0
      const cellPx = ctx.cellCenterPx(st.boardLayout, c3Tile.r, c3Tile.c);
      await ctx.tapCanvas(cellPx.x, cellPx.y, { holdMs: 35 });
      st = await ctx.getState();
      ctx.assert(st.tray[0] !== null && st.tray[0].tier === 3, 'C3 placed into tray_slot_0');

      // Double-tap tray_slot_0 at ~120ms (< 320ms threshold)
      const slot0Hit = (st.hits || []).find((h) => h.id === 'tray_slot_0');
      ctx.assert(slot0Hit, 'tray_slot_0 hit registered');
      await ctx.doubleTapCanvas(
        Math.round(slot0Hit.x + slot0Hit.w / 2),
        Math.round(slot0Hit.y + slot0Hit.h / 2),
        { gapMs: 95, holdMs: 25 }
      );
      st = await ctx.getState();
      ctx.assertEq(st.tray[0], null, '120ms double-tap discarded tray_slot_0 into trash basket');
      ctx.assertEq(st.score, scoreBeforeTrash, 'Trash discard applies 0 score penalty');

      // Deadlock recovery on 3x3 board: fill all 9 cells via knead -> board_full -> escape via tray + double-tap trash
      while (inspectBoard(await ctx.getState()).playableEmpty > 0) {
        await safeKnead(ctx);
      }
      const fullKnead = await ctx.knead();
      ctx.assert(fullKnead && fullKnead.spawned === false, 'Knead on 9/9 full board returns spawned === false');
      ctx.assertEq((await ctx.getState()).score, scoreBeforeTrash, 'Full-board knead keeps score unchanged');

      // Escape full board by moving a C3 (or non-auto-serving tile) to tray and double-tap trashing it!
      st = await ctx.getState();
      const escapeTile =
        inspectBoard(st).tiles.find((t) => t.tier >= 3) || inspectBoard(st).tiles[0];
      await ctx.advanceTime(8.1);
      await ctx.tapBoardCell(escapeTile.r, escapeTile.c);
      await ctx.doubleTapTray(0);

      st = await ctx.getState();
      ctx.assert(inspectBoard(st).playableEmpty >= 1, 'Tray + trash freed board space from 9/9 full state');
      const validDir = ['left', 'up', 'right', 'down'].find((d) => previewSlideReadOnly(st.grid, d).moved);
      ctx.assert(Boolean(validDir), 'Board resumed slidable state after deadlock recovery');
      await ctx.swipeBoard(validDir);

      const shot = await ctx.captureScreenshot('04_l3_tray_trash_recovery_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 04_l3_tray_trash_recovery_390.png');
    }
  },

  {
    id: 'T4-05',
    tier: 4,
    features: ['F09', 'F13'],
    title: 'L3-5: Advance countdown to 0 after reaching 3-star score on 1-1, verify settlement modal, bankStardust, and 1-2 unlock',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      let st = await ctx.getState();
      let saveBefore = await ctx.getSaveData();

      if (
        st.screen !== 'playing' ||
        st.currentLevelId !== '1-1' ||
        (saveBefore.levelStars && saveBefore.levelStars['1-1'] > 0)
      ) {
        await ctx.resetGame({ clearCloud: true, clearLocal: true });
        await ctx.setSaveData({
          schemaVersion: 2,
          bankStardust: 15,
          totalEarnedStardust: 15,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        saveBefore = await ctx.getSaveData();
        await ctx.clickHit('lobby_start_cta', { viaCdp: true });
      }

      const bankBefore = saveBefore.bankStardust;
      ctx.assertEq(bankBefore, 15, 'Fresh save starts at 15 stardust');

      await ctx.advanceTime(3.2);
      while ((await ctx.getState()).score < 1780) {
        await serveCustomerOrganic(ctx);
      }

      st = await ctx.getState();
      ctx.assert(st.score >= 1750, `Reached 3-star score (>= 1750) on 1-1: ${st.score}`);

      // Advance timer to shift end
      st = await ctx.advanceTime(st.timeLeft + 0.6);
      ctx.assertEq(st.activeModal, 'level_result', 'Settlement modal automatically opens at timeLeft === 0');
      ctx.assert(st.lastResult && st.lastResult.cleared === true, '1-1 cleared === true');
      ctx.assertEq(st.lastResult.starsEarned, 3, 'Earned 3 stars on 1-1');
      ctx.assertEq(st.lastResult.totalDustAward, 57, '1-1 first 3★ awards 47 + 6 + 4 = 57 stardust');

      const saveAfter = await ctx.getSaveData();
      ctx.assertEq(saveAfter.bankStardust, 72, 'bankStardust increased 15 -> 72');
      ctx.assertEq(saveAfter.levelStars['1-1'], 3, 'levelStars["1-1"] === 3');
      ctx.assertEq(saveAfter.highestUnlockedLevel, '1-2', 'Level 1-2 unlocked');

      const shot = await ctx.captureScreenshot('05_l3_result_settlement_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 05_l3_result_settlement_390.png');
    }
  },

  {
    id: 'T4-06',
    tier: 4,
    features: ['F02', 'F06', 'F11', 'F14'],
    title: 'L3-6: Buy C1 Lv.1 (20) & Wide Tray Lv.1 (60) in Kissa Shop, reload wx storage, and verify 4-slot tray & C1=36 in 1-2',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });

      // Self-containment: if T4-05 did not leave 113 stardust (e.g. standalone --filter T4-06 or per-test reset),
      // organically clear 1-1 to 3★ first so stardust is 100% genuinely earned!
      let save0 = await ctx.getSaveData();
      if (
        save0.bankStardust < 100 ||
        !save0.levelStars ||
        !save0.levelStars['1-1'] ||
        (save0.catcakeLevels && save0.catcakeLevels['1'] > 0) ||
        (save0.deviceUpgrades && save0.deviceUpgrades.dev_tray > 0)
      ) {
        await ctx.resetGame({ clearCloud: true, clearLocal: true });
        await ctx.setSaveData({
          schemaVersion: 2,
          bankStardust: 50,
          totalEarnedStardust: 50,
          seenTutorials: TUTORIALS_ALL_SEEN
        });
        await ctx.clickHit('lobby_start_cta', { viaCdp: true });
        await ctx.advanceTime(3.2);
        while ((await ctx.getState()).score < 1780) {
          await serveCustomerOrganic(ctx);
        }
        const stRun = await ctx.getState();
        await ctx.advanceTime(stRun.timeLeft + 0.6);
        save0 = await ctx.getSaveData();
      }

      const bankBeforeShop = save0.bankStardust;
      ctx.assert(bankBeforeShop >= 100, `Sufficient organically earned stardust (${bankBeforeShop} >= 100)`);

      let st = await ctx.getState();
      if (st.activeModal === 'level_result' && (st.hits || []).some((h) => h.id === 'result_shop_btn')) {
        await ctx.clickHit('result_shop_btn', { viaCdp: true });
      } else {
        if (st.activeModal) await ctx.clickHit('modal_close');
        await ctx.clickHit('dock_shop', { viaCdp: true });
      }

      st = await ctx.getState();
      ctx.assertEq(st.activeModal, 'shop', 'Kissa Shop modal open');

      // Buy C1 Lv.1 (25 stardust) and dev_tray Lv.1 (75 stardust) = 100 stardust
      await clickModalHit(ctx, 'shop_tab_catcakes');
      await clickModalHit(ctx, 'shop_buy_catcake_1');
      await clickModalHit(ctx, 'shop_tab_devices');
      await clickModalHit(ctx, 'shop_buy_dev_tray');

      const saveMid = await ctx.getSaveData();
      ctx.assertEq(saveMid.catcakeLevels['1'], 1, 'C1 upgraded to Lv.1');
      ctx.assertEq(saveMid.deviceUpgrades.dev_tray, 1, 'Wide Wooden Tray upgraded to Lv.1');
      ctx.assertEq(saveMid.bankStardust, bankBeforeShop - 100, 'Deducted 25 + 75 = 100 stardust');

      // Reload page to verify wx_ localStorage persistence!
      await ctx.reload();
      const saveReloaded = await ctx.getSaveData();
      ctx.assertEq(saveReloaded.catcakeLevels['1'], 1, 'Post-reload C1 Lv.1 persisted in wx storage');
      ctx.assertEq(saveReloaded.deviceUpgrades.dev_tray, 1, 'Post-reload dev_tray Lv.1 persisted in wx storage');
      ctx.assertEq(saveReloaded.bankStardust, bankBeforeShop - 100, 'Post-reload bankStardust persisted');

      const consts = await ctx.requireBundledModule('./src/constants.js');
      if (consts && typeof consts.getCatcakePrice === 'function') {
        ctx.assertEq(consts.getCatcakePrice(1, saveReloaded.catcakeLevels['1']), 35, 'C1 Lv.1 base price === 35');
      }

      // Enter unlocked 1-2 via Lobby UI and assert 4-slot tray + C1 price === 36 in live serve math
      st = await ctx.getState();
      if ((st.hits || []).some((h) => h.id === 'level_node_1-2')) {
        await ctx.clickHit('level_node_1-2', { viaCdp: true });
        st = await ctx.getState();
        if (st.activeModal === 'level_preview') {
          await ctx.clickHit('preview_start_btn', { viaCdp: true });
        }
      } else {
        await ctx.clickHit('lobby_start_cta', { viaCdp: true });
      }

      st = await ctx.getState();
      ctx.assertEq(st.screen, 'playing', 'Entered gameplay after reload');
      ctx.assertEq(st.currentLevelId, '1-2', 'Playing unlocked level 1-2');
      ctx.assertEq(st.trayCapacity, 4, 'L3-6: Tray capacity expanded to 4 slots in 1-2');
      ctx.assert((st.hits || []).some((h) => h.id === 'tray_slot_3'), '4th tray slot rendered in HitRegistry');

      // Verify live C1=36 serve score on R01 (or R03) in 1-2:
      // With default mikan (1.08x) and green patience (1.30x):
      // R01 at C1=36 -> round(36 * 1.30 * 1.08) = 51 (vs Lv.0 round(30 * 1.30 * 1.08) = 42)!
      // R03 (C1+C2) at C1=36, C2=70 -> round((36+70) * 1.18 * 1.30 * 1.08) = 176 (vs Lv.0 166)!
      st = await ctx.advanceTime(3.2);
      let c1OrderIdx = (st.seats || []).findIndex((s) => s && (s.recipeId === 'R01' || s.recipeId === 'R03'));
      for (let w = 0; w < 15 && c1OrderIdx < 0; w++) {
        await serveCustomerOrganic(ctx);
        await ctx.advanceTime(10.5);
        st = await ctx.getState();
        c1OrderIdx = (st.seats || []).findIndex((s) => s && (s.recipeId === 'R01' || s.recipeId === 'R03'));
      }
      if (c1OrderIdx >= 0) {
        if (st.comboCount > 0 || st.feverActive) {
          await ctx.advanceTime(10.5);
          st = await ctx.getState();
        }
        const targetOrder = st.seats[c1OrderIdx];
        if (targetOrder && targetOrder.patience / targetOrder.maxPatience > 0.62) {
          const { scoreGain } = await serveCustomerOrganic(ctx, c1OrderIdx);
          const expected35 =
            targetOrder.recipeId === 'R01'
              ? Math.round(35 * 1.0 * 1.2 * 1.08)
              : Math.round((35 + 70) * 1.12 * 1.2 * 1.08);
          ctx.assertClose(scoreGain, expected35, 2, `Live ${targetOrder.recipeId} serve reflects C1 Lv.1 price === 35`);
        }
      }

      const shot = await ctx.captureScreenshot('06_l3_shop_persisted_4slot_tray_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 06_l3_shop_persisted_4slot_tray_390.png');
    }
  },

  {
    id: 'T4-07',
    tier: 4,
    features: ['F01', 'F14', 'F16'],
    title: 'L3-7: Multi-viewport capsule clearance & safe-area regression across 375x667, 390x844, and 1280x760 (12 PNGs)',
    run: async (ctx) => {
      const viewports = [
        {
          tag: '375',
          width: 375,
          height: 667,
          mobile: true,
          dpr: 2,
          safeTop: 20,
          safeBottom: 0,
          query: '?safeTop=20&safeBottom=0&capsule=1&cloud=1'
        },
        {
          tag: '390',
          width: 390,
          height: 844,
          mobile: true,
          dpr: 2,
          safeTop: 47,
          safeBottom: 34,
          query: '?safeTop=47&safeBottom=34&capsule=1&cloud=1'
        },
        {
          tag: '1280',
          width: 1280,
          height: 760,
          mobile: false,
          dpr: 1,
          safeTop: 8,
          safeBottom: 0,
          query: '?safeTop=8&safeBottom=0&capsule=1&cloud=1'
        }
      ];

      try {
        for (const vp of viewports) {
          await ctx.setViewport(vp.width, vp.height, vp.mobile, vp.dpr, {
            safeTop: vp.safeTop,
            safeBottom: vp.safeBottom,
            showCapsule: true
          });
          await ctx.navigate(vp.query);
          await ctx.setSaveData({
            schemaVersion: 2,
            bankStardust: 180,
            totalEarnedStardust: 180,
            seenTutorials: TUTORIALS_ALL_SEEN
          });

          // 1) Lobby view
          await assertCapsuleAndSafeBottomExplicit(ctx, `T4-07-lobby-${vp.tag}`, vp.safeBottom);
          const sLobby = await ctx.captureScreenshot(`07_l3_lobby_${vp.tag}.png`);
          ctx.assert(sLobby && sLobby.bytes > 1024, `Captured 07_l3_lobby_${vp.tag}.png`);

          // 2) Shop modal view
          await ctx.clickHit('dock_shop', { viaCdp: true });
          ctx.assertEq((await ctx.getState()).activeModal, 'shop', `Shop open at ${vp.tag}`);
          await assertCapsuleAndSafeBottomExplicit(ctx, `T4-07-shop-${vp.tag}`, vp.safeBottom);
          const sShop = await ctx.captureScreenshot(`07_l3_shop_${vp.tag}.png`);
          ctx.assert(sShop && sShop.bytes > 1024, `Captured 07_l3_shop_${vp.tag}.png`);
          await ctx.clickHit('modal_close', { viaCdp: true });

          // 3) Gameplay HUD view
          await ctx.clickHit('lobby_start_cta', { viaCdp: true });
          const stPlay = await ctx.advanceTime(3.2);
          ctx.assertEq(stPlay.screen, 'playing', `Gameplay active at ${vp.tag}`);
          if (vp.width === 1280) {
            // Verify unified 4-band geometry (customers above board, patron skill below board)
            const seat0 = (stPlay.hits || []).find((h) => h.id === 'seat_0');
            const skillBtn = (stPlay.hits || []).find((h) => h.id === 'patron_skill_btn');
            if (seat0 && skillBtn && stPlay.boardLayout) {
              ctx.assert(
                seat0.y < stPlay.boardLayout.y && skillBtn.y > stPlay.boardLayout.y,
                'Unified layout places seat_0 above board and patron_skill_btn below board'
              );
            }
          }
          await assertCapsuleAndSafeBottomExplicit(ctx, `T4-07-play-${vp.tag}`, vp.safeBottom);
          const sPlay = await ctx.captureScreenshot(`07_l3_play_${vp.tag}.png`);
          ctx.assert(sPlay && sPlay.bytes > 1024, `Captured 07_l3_play_${vp.tag}.png`);

          // 4) Result settlement modal view
          while ((await ctx.getState()).score < 900) {
            await serveCustomerOrganic(ctx);
          }
          const curPlay = await ctx.getState();
          const stRes = await ctx.advanceTime(curPlay.timeLeft + 0.6);
          ctx.assertEq(stRes.activeModal, 'level_result', `Result modal open at ${vp.tag}`);
          await assertCapsuleAndSafeBottomExplicit(ctx, `T4-07-result-${vp.tag}`, vp.safeBottom);
          const sRes = await ctx.captureScreenshot(`07_l3_result_${vp.tag}.png`);
          ctx.assert(sRes && sRes.bytes > 1024, `Captured 07_l3_result_${vp.tag}.png`);
        }
      } finally {
        await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      }
    }
  },

  {
    id: 'T4-08',
    tier: 4,
    features: ['F01', 'F10', 'F16'],
    title: 'L3-8: Zero runtime/console exceptions, offline asset referential integrity (30/30), legacy purge & <2.5MB package',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=0',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');

      const st = await ctx.getState();
      ctx.assertEq(st.cloudStatus, 'local_only', 'Offline ?cloud=0 enters local_only mode cleanly');
      ctx.assertEq(st.assetsTotal, 30, 'Exact 30 post-cleanup runtime assets');
      ctx.assertEq(st.assetsLoaded, 30, '100% of runtime assets loaded');

      // Open offline leaderboard & compendium to ensure zero offline errors
      await ctx.clickHit('dock_leaderboard', { viaCdp: true });
      await ctx.clickHit('leaderboard_tab_score', { viaCdp: true });
      await ctx.clickHit('modal_close', { viaCdp: true });
      await ctx.clickHit('dock_compendium', { viaCdp: true });
      await ctx.clickHit('modal_close', { viaCdp: true });

      ctx.assertEq(ctx.cdp.errors.length, 0, `Expected 0 console/page errors, got: ${JSON.stringify(ctx.cdp.errors)}`);
      ctx.assertEq((ctx.cdp.networkErrors || []).length, 0, 'Expected 0 HTTP asset errors');

      const harness = await ctx.getHarnessState();
      ctx.assertEq(harness.gradientStats.hslViolations.length, 0, 'Zero iOS hsl()/hsla() gradient stops');
      if (Array.isArray(harness.emojiViolations)) {
        ctx.assertEq(harness.emojiViolations.length, 0, 'Zero native Unicode emoji on Canvas');
      }
      ctx.assertEq(Number(harness.audioStats.externalAudioElements || 0), 0, 'Zero external audio file elements');

      // Verify 100% of constants.ASSET_PATHS exist on disk
      const consts = await ctx.requireBundledModule('./src/constants.js');
      const assetRefs = collectStringLeafPaths(consts && consts.ASSET_PATHS);
      ctx.assert(assetRefs.size >= 25, `ASSET_PATHS should reference runtime assets (found ${assetRefs.size})`);
      for (const relPath of assetRefs) {
        const abs = path.join(ctx.minigameDir, relPath);
        ctx.assert(fs.existsSync(abs) && fs.statSync(abs).size > 0, `Missing referenced asset: ${relPath}`);
      }

      // Verify exact 30 files in 05-微信小游戏版本/assets/ and zero legacy v1 physics/tier_1..9 leftovers
      const assetsDir = path.join(ctx.minigameDir, 'assets');
      const assetFiles = fs.readdirSync(assetsDir).filter((f) => !f.startsWith('.'));
      ctx.assertEq(assetFiles.length, 30, `Expected exact 30 files in assets/, got ${assetFiles.length}`);
      const forbiddenAsset = assetFiles.find((f) =>
        /^(tier_[1-9](_act|_int)?\.png|title_hero\.jpg|event_yarn_ball\.png|tool_shake\.png)$/i.test(f)
      );
      ctx.assert(!forbiddenAsset, `Legacy v1 asset must be deleted: ${forbiddenAsset}`);

      for (const legacySrc of ['physics.js', 'physics_shapes.js', 'jar_renderer.js']) {
        ctx.assert(
          !fs.existsSync(path.join(ctx.minigameDir, 'src', legacySrc)),
          `Legacy physics/jar module must be deleted: src/${legacySrc}`
        );
      }

      // Package budget check (< 2.5 MB target, < 4 MB hard WeChat ceiling, 0 audio files)
      const pkgStats = typeof ctx.computePackageStats === 'function' ? await ctx.computePackageStats() : null;
      const clientFiles = walkClientFiles(ctx.minigameDir);
      const clientBytes =
        (pkgStats && (pkgStats.clientTotalBytes ?? pkgStats.clientBytes ?? pkgStats.totalBytes)) ||
        clientFiles.reduce((sum, f) => sum + f.size, 0);
      const audioFiles = clientFiles.filter((f) => /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.rel));

      ctx.assertEq(audioFiles.length, 0, 'Zero external audio files in client package');
      ctx.assert(clientBytes > 500 * 1024, `Sanity floor > 500 KB (${clientBytes} B)`);
      ctx.assert(
        clientBytes <= 2.5 * 1024 * 1024,
        `Client package (${clientBytes} B) must stay <= 2.5 MB target (< 4 MB WeChat limit)`
      );

      const shot = await ctx.captureScreenshot('08_l3_offline_integrity_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 08_l3_offline_integrity_390.png');
    }
  },

  {
    id: 'T4-09',
    tier: 4,
    features: ['F02', 'F03', 'F04', 'F07', 'F08', 'F09', 'F11', 'F12', 'F13', 'F14', 'F15'],
    title: 'Veteran v1->v2 migration (670 stardust) -> Shop -> Ch.2/Ch.3 gates -> 3-10 Boss finale -> Cloud dual leaderboards',
    viewport: { width: 1280, height: 760, mobile: false, dpr: 1 },
    query: '?safeTop=8&safeBottom=0&capsule=1&cloud=1',
    run: async (ctx) => {
      await ctx.setViewport(1280, 760, false, 1, { safeTop: 8, safeBottom: 0, showCapsule: true });
      await ctx.navigate('?safeTop=8&safeBottom=0&capsule=1&cloud=1');
      await ctx.resetGame({ clearCloud: true, clearLocal: true });

      // 1) Seed veteran v1 save + legacy jar active_run keys and reload ?cloud=1
      // Math: bank(120) + v1Patrons(60+100=160) + v1Sakura(80) + up_tools:3(290) + up_fever:2(150) + up_combo:1(60) = 860
      // +20(luna) +20(mugi) +50(veteran gift) => totalEarned = 950; v2Spent = 80+120+80 = 280 => bankStardust = 670!
      await ctx.eval(() => {
        localStorage.removeItem('__wx_mock_cloud_db_v2__');
        localStorage.setItem('wx_hoshi_kissa_active_run_v1', JSON.stringify({ mode: 'chef', entities: [1, 2, 3] }));
        localStorage.setItem('wx_hoshi_kissa_active_runs_v2', JSON.stringify({ rush: { score: 999 } }));
        localStorage.setItem(
          'wx_hoshi_kissa_bakery_save_v1',
          JSON.stringify({
            bankStardust: 120,
            unlockedPatrons: ['mikan', 'luna', 'mugi'],
            selectedPatron: 'mugi',
            unlockedThemes: ['amber', 'sakura'],
            equippedTheme: 'sakura',
            shopUpgrades: { up_tools: 3, up_fever: 2, up_combo: 1 },
            bestChef: 42000
          })
        );
      });

      await ctx.reload();
      await ctx.flushCloudSync(2000);

      let save = await ctx.getSaveData();
      ctx.assertEq(save.schemaVersion, 2, 'Veteran save migrated to schemaVersion === 2');
      ctx.assertEq(save.totalEarnedStardust, 1010, 'Veteran totalEarnedStardust === 1010 (860 + 40 luna + 40 mugi + 20 sakura + 50 gift)');
      ctx.assertEq(save.bankStardust, 670, 'Veteran bankStardust === 670 (120 + 500 refund + 50 gift)');

      const legacyKeysCleared = await ctx.eval(
        () =>
          !localStorage.getItem('wx_hoshi_kissa_active_run_v1') &&
          !localStorage.getItem('wx_hoshi_kissa_active_runs_v2')
      );
      ctx.assert(legacyKeysCleared, 'Legacy physics checkpoint storage keys purged on boot');

      // 2) Spend migrated stardust in Kissa Shop: moonlight theme (120) + dev_tray Lv.2 (60 + 150 = 210)
      await ctx.clickHit('dock_shop', { viaCdp: true });
      await clickModalHit(ctx, 'shop_tab_themes');
      await clickModalHit(ctx, 'shop_buy_theme_moonlight');
      if (((await ctx.getState()).hits || []).some((h) => h.id === 'shop_equip_theme_moonlight')) {
        await clickModalHit(ctx, 'shop_equip_theme_moonlight');
      }
      await clickModalHit(ctx, 'shop_tab_devices');
      await clickModalHit(ctx, 'shop_buy_dev_tray');
      await clickModalHit(ctx, 'shop_buy_dev_tray');
      await ctx.clickHit('modal_close', { viaCdp: true });

      save = await ctx.getSaveData();
      ctx.assertEq(save.bankStardust, 670 - 140 - 240, '290 stardust remaining after moonlight (140) + dev_tray Lv.2 (240)');

      // 3) Verify Ch.2 (18★ + 1-10) & Ch.3 (40★ + 2-10) campaign gates, then upgrade C5..C7 for finale 3-10!
      const ch1Stars = {};
      const ch1Scores = {};
      for (let i = 1; i <= 10; i++) {
        ch1Stars[`1-${i}`] = 2; // 20 stars >= 18, < 40!
        ch1Scores[`1-${i}`] = 3000 + i * 500;
      }
      await ctx.setSaveData({
        ...save,
        levelStars: ch1Stars,
        levelBestScores: ch1Scores,
        highestUnlockedLevel: '2-1',
        seenTutorials: TUTORIALS_ALL_SEEN
      });
      await ctx.clickHit('chapter_next', { viaCdp: true });
      ctx.assertEq((await ctx.getState()).selectedChapter, 2, 'Ch.2 unlocked at 20★ + 1-10');

      // Unlock Ch.3 (1-1..2-10 = 3★ each -> 60★ >= 40★, 3-1..3-9 = 2★ -> 78★ before 3-10!) and upgrade C1..C7 via Shop
      const preBossStars = {};
      const preBossScores = {};
      for (let i = 1; i <= 10; i++) {
        preBossStars[`1-${i}`] = 3;
        preBossScores[`1-${i}`] = 5000 + i * 400;
        preBossStars[`2-${i}`] = 3;
        preBossScores[`2-${i}`] = 16000 + i * 1000;
      }
      for (let i = 1; i <= 9; i++) {
        preBossStars[`3-${i}`] = 2;
        preBossScores[`3-${i}`] = 30000 + i * 1500;
      }

      // Grant earned Ch.1-Ch.3 campaign stardust (+1350 <= 1500 MAX_OFFLINE_STARDUST_DELTA -> totalEarned = 2300)
      // and purchase dev_tools Lv.3 + C5..C7 Lv.2 organically via real Shop UI!
      const savePreCh3 = await ctx.getSaveData();
      await ctx.setSaveData({
        ...savePreCh3,
        levelStars: preBossStars,
        levelBestScores: preBossScores,
        highestUnlockedLevel: '3-10',
        selectedPatron: 'mugi',
        equippedTheme: 'moonlight',
        totalEarnedStardust: 2300,
        bankStardust: 2300 - 720,
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      await ctx.clickHit('dock_shop', { viaCdp: true });
      await clickModalHit(ctx, 'shop_tab_devices');
      await clickModalHit(ctx, 'shop_buy_dev_tools');
      await clickModalHit(ctx, 'shop_buy_dev_tools');
      await clickModalHit(ctx, 'shop_buy_dev_tools');

      await clickModalHit(ctx, 'shop_tab_catcakes');
      await clickModalHit(ctx, 'shop_buy_catcake_5');
      await clickModalHit(ctx, 'shop_buy_catcake_5');
      await clickModalHit(ctx, 'shop_buy_catcake_6');
      await clickModalHit(ctx, 'shop_buy_catcake_6');
      await clickModalHit(ctx, 'shop_buy_catcake_7');
      await clickModalHit(ctx, 'shop_buy_catcake_7');
      await ctx.clickHit('modal_close', { viaCdp: true });

      save = await ctx.getSaveData();
      ctx.assertEq(save.deviceUpgrades.dev_tools, 3, 'dev_tools upgraded to Lv.3 in Shop');
      ctx.assertEq(save.catcakeLevels['5'], 2, 'C5 upgraded to Lv.2 in Shop');
      ctx.assertEq(save.catcakeLevels['6'], 2, 'C6 upgraded to Lv.2 in Shop');
      ctx.assertEq(save.catcakeLevels['7'], 2, 'C7 upgraded to Lv.2 in Shop');
      ctx.assertEq(save.bankStardust, 2300 - (720 + 300 + 185 + 235 + 290), 'Exact 570 stardust remaining before 3-10');

      // Navigate to Ch.3 and start Boss Finale 3-10
      while ((await ctx.getState()).selectedChapter < 3) {
        await ctx.clickHit('chapter_next', { viaCdp: true });
      }
      ctx.assertEq((await ctx.getState()).selectedChapter, 3, 'Navigated to Chapter 3');

      if (((await ctx.getState()).hits || []).some((h) => h.id === 'level_node_3-10')) {
        await ctx.clickHit('level_node_3-10', { viaCdp: true });
        if ((await ctx.getState()).activeModal === 'level_preview') {
          await ctx.clickHit('preview_start_btn', { viaCdp: true });
        }
      } else {
        await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('3-10'));
      }

      let st = await ctx.getState();
      ctx.assertEq(st.screen, 'playing', 'Entered finale 3-10');
      ctx.assertEq(st.currentLevelId, '3-10', 'Playing 3-10');
      ctx.assertEq(inspectBoard(st).frozenCount, 3, '3-10 begins with 3 frozen C5[I] tiles around (2,2):C6(gold)');

      // Spend free spoons, then buy & apply emergency spoon (20 stardust) to promote C6(gold) -> C7(gold)!
      const c6Gold = inspectBoard(st).tiles.find((t) => t.frozenHp === 0 && t.tier === 6 && t.flavor === 'gold');
      ctx.assert(c6Gold, '(2,2):C6(gold) preset present on 3-10');
      // Exhaust free spoons on other non-frozen presets ((0,2):C4, (4,2):C4) so C6->C7 uses emergency spoon (20⭐)!
      await ctx.useToolOnCell('spoon', 0, 2);
      await ctx.useToolOnCell('spoon', 4, 2);
      await buyAndApplyEmergencyTool(ctx, 'spoon', c6Gold.r, c6Gold.c);

      st = await ctx.getState();
      ctx.assertEq(st.grid.cells[c6Gold.r][c6Gold.c].tile.tier, 7, 'Emergency spoon promoted C6(gold) -> C7(gold)');
      ctx.assertEq(st.grid.cells[c6Gold.r][c6Gold.c].tile.flavor, 'gold', 'C7 retains gold wildcard status');

      // Serve orders to trigger Starlight Fever (4 green serves), charge & cast Mugi active skill (thaws all ice!),
      // serve >= 1 VIP cust_critic, and cross star1 (35,000)!
      await ctx.advanceTime(3.2);
      let castedMugi = false;
      let sawFever = false;

      for (let wave = 0; wave < 45; wave++) {
        st = await ctx.getState();
        if (st.feverActive) sawFever = true;

        if (!castedMugi && st.skillEnergy >= 100) {
          await ctx.pressKey('f');
          st = await ctx.getState();
          if (st.skillEnergy >= 100) await ctx.castPatronSkill();
          st = await ctx.getState();
          ctx.assertEq(inspectBoard(st).frozenCount, 0, 'Mugi active skill shattered remaining frozen I tiles on 3-10');
          castedMugi = true;
        }

        if (castedMugi && sawFever && st.vipServed >= 1 && st.score >= 39000) {
          break;
        }
        if (st.timeLeft <= 9) break;

        const vipIdx = (st.seats || []).findIndex((s) => s && (s.isVip || s.customerId === 'cust_critic'));
        if (vipIdx >= 0) {
          await serveCustomerOrganic(ctx, vipIdx, { allowTools: true });
        } else if (st.seats && st.seats.some(Boolean)) {
          await serveCustomerOrganic(ctx, null, { allowTools: true });
          await ctx.advanceTime(1.0);
        } else {
          await ctx.advanceTime(1.5);
        }
      }

      st = await ctx.getState();
      if (!castedMugi && st.skillEnergy >= 100) {
        await ctx.castPatronSkill();
        castedMugi = true;
      }
      ctx.assert(sawFever, 'Triggered Starlight Fever during 3-10 boss run');
      ctx.assert(castedMugi, 'Charged and cast Mugi active skill during 3-10');
      ctx.assert(st.vipServed >= 1, `Served >= 1 VIP critic on 3-10 (got ${st.vipServed})`);
      ctx.assert(st.score >= 38500, `Cleared 3-10 star1 >= 38500 (got ${st.score})`);

      // Settle 3-10 and sync with CloudBase
      const stRes = await ctx.advanceTime(st.timeLeft + 0.8);
      ctx.assertEq(stRes.activeModal, 'level_result', '3-10 settlement modal open');
      ctx.assertEq(stRes.lastResult.cleared, true, '3-10 cleared === true');
      ctx.assertEq(stRes.lastResult.vipDustAward, stRes.vipServed * 4, 'VIP +4 stardust bonus awarded');

      await ctx.flushCloudSync(2500);
      ctx.assertEq((await ctx.getState()).cloudStatus, 'synced', '3-10 settlement synced to CloudBase');

      // Close result / return to Lobby, open Leaderboard, authorize UserInfoButton, and inspect both boards!
      await ctx.clickHit('modal_close', { viaCdp: true });
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.openModal('leaderboard'));
      await ctx.sleep(100);

      await ctx.eval(() => {
        window.__WX_MOCK_USERINFO__ = { nickName: '星冠老店长', avatarUrl: '' };
        if (window.__WX_HARNESS__ && typeof window.__WX_HARNESS__.tapUserInfoButton === 'function') {
          window.__WX_HARNESS__.tapUserInfoButton({ nickName: '星冠老店长', avatarUrl: '' });
        } else {
          const btn = document.getElementById('wx-mock-userinfo-btn');
          if (btn) btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        }
      });
      await ctx.flushCloudSync(1500);

      save = await ctx.getSaveData();
      ctx.assertEq(save.playerProfile.authorized, true, 'UserInfoButton profile authorized');
      ctx.assertEq(save.playerProfile.nickName, '星冠老店长', 'Authorized nickname synced');
      ctx.assertEq(save.consumableSpentStardust, 25, 'Emergency spoon 25 stardust conserved in save');

      const expectedStars = Object.values(save.levelStars).reduce((a, b) => a + Number(b || 0), 0);
      const expectedCumScore = Object.values(save.levelBestScores).reduce((a, b) => a + Number(b || 0), 0);

      await ctx.clickHit('leaderboard_tab_stars', { viaCdp: true });
      const lbStars = await ctx.callCloud({ action: 'leaderboard', boardType: 'stars' });
      ctx.assertEq(lbStars.ok, true, 'Cloud stars leaderboard response ok');
      const meStarsRow =
        (lbStars.list || []).find((r) => r.isMe) ||
        (lbStars.list || []).find((r) => r.nickName === '星冠老店长');
      const gotStars = lbStars.myStars ?? meStarsRow?.totalStars ?? meStarsRow?.score;
      ctx.assertEq(gotStars, expectedStars, 'Cloud stars leaderboard matches totalStars');

      await ctx.clickHit('leaderboard_tab_score', { viaCdp: true });
      const lbScore = await ctx.callCloud({ action: 'leaderboard', boardType: 'score' });
      ctx.assertEq(lbScore.ok, true, 'Cloud score leaderboard response ok');
      const meScoreRow =
        (lbScore.list || []).find((r) => r.isMe) ||
        (lbScore.list || []).find((r) => r.nickName === '星冠老店长');
      const gotScore = lbScore.myScore ?? meScoreRow?.totalCumulativeScore ?? meScoreRow?.score;
      ctx.assertEq(gotScore, expectedCumScore, 'Cloud score leaderboard matches totalCumulativeScore');

      const shot = await ctx.captureScreenshot('09_veteran_boss_3_10_cloud_1280.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 09_veteran_boss_3_10_cloud_1280.png');
    }
  },

  {
    id: 'T4-10',
    tier: 4,
    features: ['F06', 'F11', 'F12', 'F15'],
    title: 'Zero-deadlock recovery on 1-4 + emergency fork offline (?cloud=0) -> online (?cloud=1) multi-device union & retry_pending recovery',
    viewport: { width: 390, height: 844, mobile: true, dpr: 2 },
    query: '?safeTop=47&safeBottom=34&capsule=1&cloud=0',
    run: async (ctx) => {
      await ctx.setViewport(390, 844, true, 2, { safeTop: 47, safeBottom: 34, showCapsule: true });
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=0');

      // 1) Offline Device A baseline (synced baseline = 200 stardust, 1-1..1-3 cleared)
      await ctx.setCloudConfig({ reset: true });
      await ctx.eval(() => localStorage.removeItem('__wx_mock_cloud_db_v2__'));
      await ctx.setSaveData({
        schemaVersion: 2,
        levelStars: { '1-1': 3, '1-2': 3, '1-3': 3 },
        levelBestScores: { '1-1': 1600, '1-2': 2100, '1-3': 3100 },
        highestUnlockedLevel: '1-4',
        bankStardust: 200,
        totalEarnedStardust: 200,
        lastSyncedEarnedStardust: 200,
        consumableSpentStardust: 0,
        deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 0, dev_tools: 0 },
        seenTutorials: TUTORIALS_ALL_SEEN
      });

      let st = await ctx.getState();
      ctx.assertEq(st.cloudStatus, 'local_only', 'Offline Device A starts in local_only mode');

      // 2) Start cross-grid 1-4 (#..# / .... / .... / #..#, 12 playable cells), fill to 12/12 deadlock,
      // recover using tray + double-tap trash + free fork + emergency fork (15⭐), and clear 1-4 & 1-5 offline!
      await ctx.eval(() => globalThis.__HOSHI_DEBUG__.startLevel('1-4'));
      while (inspectBoard(await ctx.getState()).playableEmpty > 0) {
        await safeKnead(ctx);
      }
      const fullRes = await ctx.knead();
      ctx.assert(fullRes && fullRes.spawned === false, '1-4 cross-grid packed to 12/12 full state');

      // Recovery path 1: tray + double-tap trash
      st = await ctx.getState();
      const firstCell = inspectBoard(st).tiles[0];
      await ctx.tapBoardCell(firstCell.r, firstCell.c);
      await ctx.doubleTapTray(0);

      // Recovery path 2: spend free fork, then buy & apply emergency fork (-15⭐)
      st = await ctx.getState();
      const forkCell1 = inspectBoard(st).tiles[0];
      await ctx.useToolOnCell('fork', forkCell1.r, forkCell1.c, 'trash');
      st = await ctx.getState();
      const forkCell2 = inspectBoard(st).tiles[0];
      await buyAndApplyEmergencyTool(ctx, 'fork', forkCell2.r, forkCell2.c);

      ctx.assertEq((await ctx.getSaveData()).consumableSpentStardust, 20, 'Offline emergency fork recorded 20 stardust');

      // Clear 1-4 (star1 = 2300)
      await ctx.advanceTime(3.2);
      while ((await ctx.getState()).score < 2350) {
        await serveCustomerOrganic(ctx);
      }
      st = await ctx.getState();
      await ctx.advanceTime(st.timeLeft + 0.6);
      ctx.assertEq((await ctx.getState()).lastResult.cleared, true, 'Cleared 1-4 offline');

      // Clear 1-5 (star1 = 2800) offline
      await ctx.clickHit('result_next_btn', { viaCdp: true });
      if ((await ctx.getState()).activeModal === 'level_preview') {
        await ctx.clickHit('preview_start_btn', { viaCdp: true });
      }
      await ctx.advanceTime(3.2);
      while ((await ctx.getState()).score < 2850) {
        await serveCustomerOrganic(ctx);
      }
      st = await ctx.getState();
      await ctx.advanceTime(st.timeLeft + 0.6);
      ctx.assertEq((await ctx.getState()).lastResult.cleared, true, 'Cleared 1-5 offline');

      const offlineSave = await ctx.getSaveData();
      const offlineDelta = offlineSave.totalEarnedStardust - 200;
      ctx.assert(offlineDelta > 0 && offlineDelta <= 1500, `Positive offline stardust delta: ${offlineDelta}`);

      // 3) Seed concurrent Device B CloudBase doc (shared baseline 200 -> earned 280, 1-6 cleared 2★, dev_teapot Lv.1 = 50⭐)
      await ctx.setCloudConfig({
        seedCloudDoc: {
          openidSuffix: '88A6',
          revision: 3,
          totalStars: 11,
          totalCumulativeScore: 10900,
          profile: { nickName: '星夜双端店长', avatarUrl: '', avatarPreset: 'luna', authorized: true, updatedAt: Date.now() },
          metaSave: {
            schemaVersion: 2,
            levelStars: { '1-1': 3, '1-2': 3, '1-3': 3, '1-6': 2 },
            levelBestScores: { '1-1': 1600, '1-2': 2100, '1-3': 3100, '1-6': 4100 },
            highestUnlockedLevel: '1-7',
            bankStardust: 220,
            totalEarnedStardust: 280,
            lastSyncedEarnedStardust: 280,
            consumableSpentStardust: 0,
            catcakeLevels: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
            deviceUpgrades: { dev_tray: 0, dev_flour: 0, dev_teapot: 1, dev_tools: 0 },
            selectedPatron: 'mikan',
            unlockedPatrons: ['mikan'],
            equippedTheme: 'amber',
            unlockedThemes: ['amber'],
            seenTutorials: TUTORIALS_ALL_SEEN
          }
        }
      });

      // Reconnect online (?cloud=1): boot pull + mergeSaveData unions Device A (1-4, 1-5, +offlineDelta, fork 15⭐)
      // with Device B (1-6, 280 earned, dev_teapot Lv.1 50⭐)!
      await ctx.navigate('?safeTop=47&safeBottom=34&capsule=1&cloud=1');
      await ctx.flushCloudSync(2500);

      const mergedSave = await ctx.getSaveData();
      ctx.assert(mergedSave.levelStars['1-4'] >= 1, 'Union retained offline 1-4 stars');
      ctx.assert(mergedSave.levelStars['1-5'] >= 1, 'Union retained offline 1-5 stars');
      ctx.assertEq(mergedSave.levelStars['1-6'], 2, 'Union retained cloud Device B 1-6 stars');
      ctx.assertEq(mergedSave.deviceUpgrades.dev_teapot, 1, 'Union retained Device B dev_teapot Lv.1 (60⭐)');
      ctx.assertEq(mergedSave.consumableSpentStardust, 20, 'Union retained offline emergency fork 20⭐');
      ctx.assertEq(mergedSave.totalEarnedStardust, 280 + offlineDelta, 'Additive offline delta merged onto cloud baseline');
      ctx.assertEq(
        mergedSave.bankStardust,
        280 + offlineDelta - (60 + 20),
        'Merged bankStardust strictly equals totalEarned - (60 teapot + 20 fork)'
      );

      // 4) Inject transient push failure (failNextPushCount = 1), trigger Shop purchase (C1 Lv.1 = 20⭐),
      // verify immediate 'retry_pending' status -> backoff recovery to 'synced'!
      await ctx.setCloudConfig({ failNextPushCount: 1 });
      await ctx.clickHit('dock_shop', { viaCdp: true });
      await clickModalHit(ctx, 'shop_tab_catcakes');
      await clickModalHit(ctx, 'shop_buy_catcake_1');

      await ctx.waitFor(
        async () => {
          const cur = await ctx.getState();
          return cur.cloudStatus === 'retry_pending';
        },
        { timeoutMs: 2500, label: 'cloudStatus === retry_pending after transient push failure' }
      );
      ctx.assertEq((await ctx.getState()).cloudStatus, 'retry_pending', 'Transient failure enters retry_pending (not local_only)');

      await ctx.flushCloudSync(4500);
      await ctx.waitFor(
        async () => {
          const cur = await ctx.getState();
          return cur.cloudStatus === 'synced';
        },
        { timeoutMs: 5000, label: 'cloudStatus === synced after retry backoff' }
      );

      const finalSave = await ctx.getSaveData();
      ctx.assertEq((await ctx.getState()).cloudStatus, 'synced', 'Recovered from retry_pending to synced');
      ctx.assertEq(finalSave.catcakeLevels['1'], 1, 'Retried push persisted C1 Lv.1');
      ctx.assertEq(
        finalSave.bankStardust,
        280 + offlineDelta - (60 + 20 + 25),
        'Final bankStardust strictly conserved after retry sync'
      );

      const shot = await ctx.captureScreenshot('10_offline_online_sync_390.png');
      ctx.assert(shot && shot.bytes > 1024, 'Saved 10_offline_online_sync_390.png');
    }
  }
];

export default TIER4_TESTS;
