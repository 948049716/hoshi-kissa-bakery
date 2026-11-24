/**
 * Pure Shaped-Grid 2048 Baking Engine for Hoshi Kissa Bakery v2.0.
 * Zero DOM/Canvas/WeChat dependencies; deterministic with injectable RNG.
 * Economy settlement is handled exclusively by order_service.js.
 */
'use strict';

const MIN_TIER = 1;
const MAX_TIER = 7;
const HIGH_MERGE_MIN_TIER = 5;
const HIGH_MERGE_SKILL_CHARGE = 8;
const DEFAULT_C2_RATE = 0.10;
const MAX_GRID_DIM = 32;
const MAX_PREPLACED_LEN = 1024;
const MAX_MATRIX_STR_SCAN = 4096;

const OWN = Object.prototype.hasOwnProperty;

let LEVELS_MOD = null;
if (typeof require === 'function') {
  try {
    LEVELS_MOD = require('./levels_data');
  } catch (_) {
    LEVELS_MOD = null;
  }
}

const VALID_FLAVORS = Object.assign(Object.create(null), {
  plain: true,
  matcha: true,
  berry: true,
  gold: true
});

const MATRIX_CHAR_TO_CELL_TYPE = Object.assign(Object.create(null), {
  '.': 'normal',
  '#': 'void',
  'X': 'block',
  'G': 'gold',
  'M': 'matcha',
  'B': 'berry',
  'I': 'normal'
});

const PLAYABLE_CELL_TYPES = Object.assign(Object.create(null), {
  normal: true,
  gold: true,
  matcha: true,
  berry: true
});

const ORTHOGONAL_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

const TILE_ROLLBACK_KEYS = [
  'uid',
  'tier',
  'flavor',
  'frozenHp',
  'frozen',
  'fromR',
  'fromC',
  'justMerged',
  'justSpawned'
];

function safeIsArray(x) {
  try {
    return Array.isArray(x);
  } catch (_) {
    return false;
  }
}

function safeIsFrozen(x) {
  if (!x || (typeof x !== 'object' && typeof x !== 'function')) return true;
  try {
    return Object.isFrozen(x);
  } catch (_) {
    return true;
  }
}

function safeIsExtensible(x) {
  if (!x || (typeof x !== 'object' && typeof x !== 'function')) return false;
  try {
    return Object.isExtensible(x);
  } catch (_) {
    return false;
  }
}

function hasOwn(obj, key) {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object' && typeof obj !== 'function') return false;
  try {
    return OWN.call(obj, key);
  } catch (_) {
    return false;
  }
}

function getOwn(obj, key, fallback) {
  if (!hasOwn(obj, key)) return fallback;
  try {
    return obj[key];
  } catch (_) {
    return fallback;
  }
}

function readOwnPropOnce(obj, key) {
  if (!hasOwn(obj, key)) {
    return { exists: false, value: undefined, threw: false };
  }
  try {
    return { exists: true, value: obj[key], threw: false };
  } catch (_) {
    return { exists: true, value: undefined, threw: true };
  }
}

function isPlainObj(x) {
  if (x === null || typeof x !== 'object' || safeIsArray(x)) return false;
  try {
    OWN.call(x, '__probe__');
    return true;
  } catch (_) {
    return false;
  }
}

function safeArrayLen(arr, maxCap) {
  if (!safeIsArray(arr)) return 0;
  try {
    const raw = arr.length;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return 0;
    return typeof maxCap === 'number' && maxCap >= 0 ? Math.min(raw, maxCap) : raw;
  } catch (_) {
    return 0;
  }
}

function readExactArrayLen(arr) {
  if (!safeIsArray(arr)) return -1;
  try {
    const raw = arr.length;
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return -1;
    return raw;
  } catch (_) {
    return -1;
  }
}

function safePush(arr) {
  if (!safeIsArray(arr) || safeIsFrozen(arr)) return 0;
  for (let i = 1; i < arguments.length; i++) {
    const idx = safeArrayLen(arr);
    try {
      Object.defineProperty(arr, idx, {
        __proto__: null,
        value: arguments[i],
        writable: true,
        enumerable: true,
        configurable: true
      });
    } catch (_) {
      return safeArrayLen(arr);
    }
  }
  return safeArrayLen(arr);
}

function safeSetIdx(arr, idx, val) {
  if (!safeIsArray(arr) || safeIsFrozen(arr)) return false;
  try {
    if (hasOwn(arr, idx)) {
      arr[idx] = val;
      return true;
    }
    if (!safeIsExtensible(arr)) return false;
    Object.defineProperty(arr, idx, {
      __proto__: null,
      value: val,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (_) {
    return false;
  }
}

function canMutateProp(obj, key) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj)) return false;
  try {
    if (hasOwn(obj, key)) {
      const desc = Object.getOwnPropertyDescriptor(obj, key);
      if (!desc) return false;
      if (hasOwn(desc, 'writable')) return desc.writable === true;
      return typeof desc.set === 'function';
    }
    return safeIsExtensible(obj);
  } catch (_) {
    return false;
  }
}

function safeSetProp(obj, key, val) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj)) return false;
  try {
    if (hasOwn(obj, key)) {
      obj[key] = val;
      return true;
    }
    if (!safeIsExtensible(obj)) return false;
    Object.defineProperty(obj, key, {
      __proto__: null,
      value: val,
      writable: true,
      enumerable: true,
      configurable: true
    });
    return true;
  } catch (_) {
    return false;
  }
}

function verifiedSetProp(obj, key, val) {
  const normVal = typeof val === 'number' && val === 0 ? 0 : val;
  if (!safeSetProp(obj, key, normVal)) return false;
  if (!hasOwn(obj, key)) return false;
  let actual;
  try {
    actual = obj[key];
  } catch (_) {
    return false;
  }
  if (typeof actual === 'number' && actual === 0 && normVal === 0) return true;
  return Object.is(actual, normVal);
}

function setOptionalTileProp(tile, key, val) {
  if (!tile || typeof tile !== 'object' || safeIsFrozen(tile)) return;
  if (hasOwn(tile, key) || safeIsExtensible(tile)) {
    safeSetProp(tile, key, val);
  }
}

function toSafeNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && x.trim() !== '') return Number(x);
  return NaN;
}

function toSafeInt(x) {
  if (typeof x === 'number') {
    if (!Number.isInteger(x)) return null;
    return x === 0 ? 0 : x;
  }
  if (typeof x === 'string' && x.trim() !== '') {
    const n = Number(x);
    if (!Number.isInteger(n)) return null;
    return n === 0 ? 0 : n;
  }
  return null;
}

function safeRand01(rngFn) {
  const fn = typeof rngFn === 'function' ? rngFn : Math.random;
  let raw;
  try {
    raw = fn();
  } catch (_) {
    raw = Math.random();
  }
  const n = typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 0.999999999999;
  return n;
}

function normalizeFlavor(raw) {
  if (typeof raw !== 'string') return 'plain';
  const trimmed = raw.trim();
  return VALID_FLAVORS[trimmed] === true ? trimmed : 'plain';
}

function normalizeDyeCellType(cellType) {
  if (typeof cellType !== 'string') return 'normal';
  const t = cellType.trim();
  if (t === 'gold' || t === 'G') return 'gold';
  if (t === 'matcha' || t === 'M') return 'matcha';
  if (t === 'berry' || t === 'B') return 'berry';
  return 'normal';
}

function computeCellDyeFlavor(curFlavor, cellType, frozenHp) {
  const normCur = normalizeFlavor(curFlavor);
  if (frozenHp > 0) {
    return normCur;
  }
  const dyeType = normalizeDyeCellType(cellType);
  if (dyeType === 'gold') return 'gold';
  if (dyeType === 'matcha') return normCur === 'gold' ? 'gold' : 'matcha';
  if (dyeType === 'berry') return normCur === 'gold' ? 'gold' : 'berry';
  return normCur;
}

function isInBounds(rows, cols, r, c) {
  return r !== null && c !== null && r >= 0 && r < rows && c >= 0 && c < cols;
}

function snapshotTileOnce(tileObj, requireMutable, seenMap) {
  if (!isPlainObj(tileObj)) return null;
  if (seenMap && seenMap.has(tileObj)) {
    return seenMap.get(tileObj);
  }

  const uidRead = readOwnPropOnce(tileObj, 'uid');
  const tierRead = readOwnPropOnce(tileObj, 'tier');
  const flavorRead = readOwnPropOnce(tileObj, 'flavor');
  const frozenHpRead = readOwnPropOnce(tileObj, 'frozenHp');
  const frozenRead = readOwnPropOnce(tileObj, 'frozen');

  const parsedUid = uidRead.exists && !uidRead.threw ? toSafeInt(uidRead.value) : null;
  const parsedTier = tierRead.exists && !tierRead.threw ? toSafeInt(tierRead.value) : null;
  const tier =
    parsedTier !== null ? Math.max(MIN_TIER, Math.min(MAX_TIER, parsedTier)) : MIN_TIER;
  const flavor =
    flavorRead.exists && !flavorRead.threw ? normalizeFlavor(flavorRead.value) : 'plain';

  let frozenHp = 0;
  if (frozenHpRead.exists) {
    const hp = !frozenHpRead.threw ? toSafeNum(frozenHpRead.value) : 0;
    if (Number.isFinite(hp) && hp > 0) {
      frozenHp = Math.max(1, Math.floor(hp));
    }
  } else if (frozenRead.exists && !frozenRead.threw && frozenRead.value === true) {
    frozenHp = 1;
  }

  let origProps = null;
  if (requireMutable) {
    const fromRRead = readOwnPropOnce(tileObj, 'fromR');
    const fromCRead = readOwnPropOnce(tileObj, 'fromC');
    const mergedRead = readOwnPropOnce(tileObj, 'justMerged');
    const spawnedRead = readOwnPropOnce(tileObj, 'justSpawned');
    origProps = {
      uid: uidRead,
      tier: tierRead,
      flavor: flavorRead,
      frozenHp: frozenHpRead,
      frozen: frozenRead,
      fromR: fromRRead,
      fromC: fromCRead,
      justMerged: mergedRead,
      justSpawned: spawnedRead
    };
  }

  const snap = {
    tile: tileObj,
    uid: parsedUid,
    tier,
    flavor,
    frozenHp,
    origProps
  };

  if (seenMap) {
    seenMap.set(tileObj, snap);
  }
  return snap;
}

/**
 * Single-read board snapshot helper.
 * Validates state and reads rows, cols, cells, each cell's type/tile, and each tile's own
 * properties AT MOST ONCE per call so stateful TOCTOU getters cannot desynchronize operations.
 */
function snapshotGrid(state, requireMutable) {
  if (!isPlainObj(state)) return null;
  if (requireMutable && (safeIsFrozen(state) || !canMutateProp(state, 'nextUid'))) {
    return null;
  }

  const rowsRead = readOwnPropOnce(state, 'rows');
  const colsRead = readOwnPropOnce(state, 'cols');
  const cellsRead = readOwnPropOnce(state, 'cells');
  if (
    !rowsRead.exists ||
    !colsRead.exists ||
    !cellsRead.exists ||
    rowsRead.threw ||
    colsRead.threw ||
    cellsRead.threw
  ) {
    return null;
  }

  const rawRows = rowsRead.value;
  const rawCols = colsRead.value;
  const cells = cellsRead.value;
  if (!Number.isInteger(rawRows) || !Number.isInteger(rawCols)) return null;
  if (rawRows < 0 || rawCols < 0 || rawRows > MAX_GRID_DIM || rawCols > MAX_GRID_DIM) {
    return null;
  }
  const rows = rawRows === 0 ? 0 : rawRows;
  const cols = rawCols === 0 ? 0 : rawCols;

  if (readExactArrayLen(cells) !== rows) return null;
  if (requireMutable && safeIsFrozen(cells)) return null;

  const nextUidRead = requireMutable
    ? readOwnPropOnce(state, 'nextUid')
    : { exists: false, value: undefined, threw: false };
  if (requireMutable && nextUidRead.threw) return null;

  const grid = [];
  const seenRows = new Set();
  seenRows.add(cells);
  const seenCells = new Set();
  const seenTiles = new Map();
  const tileSnaps = [];
  let maxUid = 0;

  for (let r = 0; r < rows; r++) {
    const rowRead = readOwnPropOnce(cells, r);
    const row = rowRead.exists && !rowRead.threw ? rowRead.value : null;
    if (readExactArrayLen(row) !== cols) return null;
    if (seenRows.has(row)) return null;
    seenRows.add(row);
    if (requireMutable && safeIsFrozen(row)) return null;

    const snapRow = [];
    for (let c = 0; c < cols; c++) {
      const cellRead = readOwnPropOnce(row, c);
      const cell = cellRead.exists && !cellRead.threw ? cellRead.value : null;
      if (!isPlainObj(cell)) return null;
      if (seenCells.has(cell)) return null;
      seenCells.add(cell);
      if (requireMutable && safeIsFrozen(cell)) return null;

      const typeRead = readOwnPropOnce(cell, 'type');
      if (!typeRead.exists || typeRead.threw || typeof typeRead.value !== 'string') {
        return null;
      }
      const cellType = typeRead.value;
      const playable = PLAYABLE_CELL_TYPES[cellType] === true;

      const cellHasTile = hasOwn(cell, 'tile');
      let rawCellTile = undefined;
      if (cellHasTile) {
        if (requireMutable && !canMutateProp(cell, 'tile')) {
          return null;
        }
        try {
          rawCellTile = cell.tile;
        } catch (_) {
          if (requireMutable) return null;
          rawCellTile = null;
        }
      } else if (requireMutable && !safeIsExtensible(cell)) {
        return null;
      }

      if (requireMutable && rawCellTile !== null && rawCellTile !== undefined) {
        if (
          !isPlainObj(rawCellTile) ||
          safeIsFrozen(rawCellTile) ||
          !canMutateProp(rawCellTile, 'tier') ||
          !canMutateProp(rawCellTile, 'flavor') ||
          !canMutateProp(rawCellTile, 'frozenHp')
        ) {
          return null;
        }
      }

      let curTileSnap = null;
      if (isPlainObj(rawCellTile)) {
        const alreadySeen = seenTiles.has(rawCellTile);
        curTileSnap = snapshotTileOnce(rawCellTile, requireMutable, seenTiles);
        if (!alreadySeen && curTileSnap) {
          safePush(tileSnaps, curTileSnap);
          if (curTileSnap.uid !== null && curTileSnap.uid > maxUid) {
            maxUid = curTileSnap.uid;
          }
        }
      }

      safePush(snapRow, {
        cell,
        r,
        c,
        cellType,
        playable,
        hadOwnTile: cellHasTile,
        origRawTile: rawCellTile,
        curTile: curTileSnap ? curTileSnap.tile : null,
        curTileSnap
      });
    }
    safePush(grid, snapRow);
  }

  let nextUidCursor = 1;
  if (requireMutable) {
    const parsedNext = nextUidRead.exists ? toSafeInt(nextUidRead.value) : null;
    nextUidCursor = parsedNext !== null && parsedNext >= 1 ? parsedNext : maxUid + 1;
  }

  return {
    state,
    rows,
    cols,
    grid,
    tileSnaps,
    hadNextUid: nextUidRead.exists,
    origNextUid: nextUidRead.value,
    nextUidCursor,
    nextUidChanged: false
  };
}

function allocSnapUid(snap) {
  const uid = snap.nextUidCursor;
  snap.nextUidCursor = uid + 1;
  snap.nextUidChanged = true;
  return uid;
}

function commitSnapNextUid(snap) {
  if (!snap.nextUidChanged) return true;
  return verifiedSetProp(snap.state, 'nextUid', snap.nextUidCursor);
}

function restoreGridProp(obj, key, exists, threw, origVal) {
  if (!obj || typeof obj !== 'object' || safeIsFrozen(obj)) return;
  if (!exists) {
    if (hasOwn(obj, key)) {
      try {
        delete obj[key];
      } catch (_) {
        // Ignore non-configurable own key
      }
    }
    return;
  }
  if (threw) return;
  safeSetProp(obj, key, origVal);
  const rb = readOwnPropOnce(obj, key);
  if (
    rb.exists &&
    !rb.threw &&
    (Object.is(rb.value, origVal) ||
      (typeof rb.value === 'number' && rb.value === 0 && origVal === 0))
  ) {
    return;
  }
  try {
    Object.defineProperty(obj, key, {
      __proto__: null,
      value: origVal,
      writable: true,
      enumerable: true,
      configurable: true
    });
  } catch (_) {
    // Ignore non-configurable accessor
  }
}

function rollbackGridSnapshot(snap) {
  if (!snap) return;

  for (let i = 0; i < snap.tileSnaps.length; i++) {
    const ts = snap.tileSnaps[i];
    const orig = ts.origProps;
    if (!orig) continue;
    for (let k = 0; k < TILE_ROLLBACK_KEYS.length; k++) {
      const key = TILE_ROLLBACK_KEYS[k];
      const rec = orig[key];
      if (rec) {
        restoreGridProp(ts.tile, key, rec.exists, rec.threw, rec.value);
      }
    }
  }

  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      restoreGridProp(entry.cell, 'tile', entry.hadOwnTile, false, entry.origRawTile);
    }
  }

  restoreGridProp(snap.state, 'nextUid', snap.hadNextUid, false, snap.origNextUid);
}

/**
 * Applies G / M / B cell dyeing rules.
 * Gold flavor never downgrades when entering M or B cells.
 * Frozen tiles encased in ice are not dyed.
 */
function applyCellDye(tile, cellType) {
  if (isPlainObj(tile)) {
    const ts = snapshotTileOnce(tile, false, null);
    if (ts.frozenHp > 0) {
      return ts.flavor;
    }
    const nextFlavor = computeCellDyeFlavor(ts.flavor, cellType, 0);
    safeSetProp(tile, 'flavor', nextFlavor);
    return nextFlavor;
  }

  const curFlavor = normalizeFlavor(tile);
  return computeCellDyeFlavor(curFlavor, cellType, 0);
}

function resolveMergedFlavorFromStrings(fMove, fTarget, destCellType) {
  let inherited = 'plain';
  if (fMove === 'gold' || fTarget === 'gold') {
    inherited = 'gold';
  } else if (fMove !== 'plain') {
    inherited = fMove;
  } else if (fTarget !== 'plain') {
    inherited = fTarget;
  }
  return computeCellDyeFlavor(inherited, destCellType, 0);
}

/**
 * Resolves merged flavor from movingTile and targetTile, then applies destination cell dye.
 * Priority: gold > moving non-plain > target non-plain > plain, followed by destCellType dye.
 */
function resolveMergedFlavor(movingTile, targetTile, destCellType) {
  const seen = new Map();
  const fMove = isPlainObj(movingTile)
    ? snapshotTileOnce(movingTile, false, seen).flavor
    : normalizeFlavor(movingTile);
  const fTarget = isPlainObj(targetTile)
    ? snapshotTileOnce(targetTile, false, seen).flavor
    : normalizeFlavor(targetTile);

  return resolveMergedFlavorFromStrings(fMove, fTarget, destCellType);
}

/**
 * Creates a fresh GridState from a LevelConfig object, raw matrix array, or levelId string.
 */
function createGridState(levelCfg, preplaced) {
  let resolvedCfg = levelCfg;
  if (typeof levelCfg === 'string') {
    try {
      const levelsMod = LEVELS_MOD;
      if (levelsMod && typeof levelsMod.getLevelById === 'function') {
        resolvedCfg = levelsMod.getLevelById(levelCfg.trim());
      } else {
        resolvedCfg = null;
      }
    } catch (_) {
      resolvedCfg = null;
    }
  }

  let rawMatrix = null;
  if (safeIsArray(resolvedCfg)) {
    rawMatrix = resolvedCfg;
  } else if (isPlainObj(resolvedCfg)) {
    const matRead = readOwnPropOnce(resolvedCfg, 'matrix');
    const ownMat = matRead.exists && !matRead.threw ? matRead.value : null;
    if (safeIsArray(ownMat)) {
      rawMatrix = ownMat;
    }
  }

  const rowLimit = safeArrayLen(rawMatrix, MAX_GRID_DIM);
  if (rowLimit === 0) {
    return { rows: 0, cols: 0, nextUid: 1, cells: [] };
  }

  const parsedRows = [];
  const seenMatrixRows = new Map();
  let cols = 0;

  for (let r = 0; r < rowLimit; r++) {
    const rowRead = readOwnPropOnce(rawMatrix, r);
    const rawRow = rowRead.exists && !rowRead.threw ? rowRead.value : null;
    let chars = [];
    if (typeof rawRow === 'string') {
      const scanStr =
        rawRow.length > MAX_MATRIX_STR_SCAN ? rawRow.slice(0, MAX_MATRIX_STR_SCAN) : rawRow;
      const strScanCap = scanStr.length;
      for (let k = 0; k < strScanCap && chars.length < MAX_GRID_DIM; k++) {
        const ch = scanStr[k];
        if (ch !== ' ' && ch !== '\t') {
          safePush(chars, ch);
        }
      }
    } else if (safeIsArray(rawRow) && rawRow !== rawMatrix) {
      if (seenMatrixRows.has(rawRow)) {
        chars = seenMatrixRows.get(rawRow);
      } else {
        const cLimit = safeArrayLen(rawRow, MAX_GRID_DIM);
        for (let c = 0; c < cLimit; c++) {
          const entryRead = readOwnPropOnce(rawRow, c);
          const entry = entryRead.exists && !entryRead.threw ? entryRead.value : '#';
          safePush(
            chars,
            typeof entry === 'string' && entry.trim() !== '' ? entry.trim()[0] : '#'
          );
        }
        seenMatrixRows.set(rawRow, chars);
      }
    }
    if (chars.length > cols) cols = chars.length;
    safePush(parsedRows, chars);
  }

  const rows = parsedRows.length;
  if (rows === 0 || cols === 0) {
    return { rows: 0, cols: 0, nextUid: 1, cells: [] };
  }

  const cells = [];
  const rawIceMask = [];

  for (let r = 0; r < rows; r++) {
    const cellRow = [];
    const iceRow = [];
    const rowChars = parsedRows[r];
    for (let c = 0; c < cols; c++) {
      const rawCh = c < rowChars.length && typeof rowChars[c] === 'string' ? rowChars[c] : '#';
      const normCh = rawCh === '.' || rawCh === '#' ? rawCh : rawCh.toUpperCase();
      const cellType = MATRIX_CHAR_TO_CELL_TYPE[normCh] || 'void';
      safePush(iceRow, normCh === 'I');
      safePush(cellRow, {
        r,
        c,
        type: cellType,
        tile: null
      });
    }
    safePush(cells, cellRow);
    safePush(rawIceMask, iceRow);
  }

  const state = {
    rows,
    cols,
    nextUid: 1,
    cells
  };

  let presetList = [];
  if (preplaced !== undefined) {
    presetList = safeIsArray(preplaced) ? preplaced : [];
  } else if (isPlainObj(resolvedCfg)) {
    const presetsRead = readOwnPropOnce(resolvedCfg, 'presets');
    const ownPresets = presetsRead.exists && !presetsRead.threw ? presetsRead.value : null;
    if (safeIsArray(ownPresets) && ownPresets !== rawMatrix) {
      presetList = ownPresets;
    }
  }

  const presetLimit = safeArrayLen(presetList, MAX_PREPLACED_LEN);
  const seenPreplaced = new Set();
  for (let i = 0; i < presetLimit; i++) {
    const pRead = readOwnPropOnce(presetList, i);
    const p = pRead.exists && !pRead.threw ? pRead.value : null;
    if (!isPlainObj(p) || seenPreplaced.has(p)) continue;
    seenPreplaced.add(p);

    const rRead = readOwnPropOnce(p, 'r');
    const cRead = readOwnPropOnce(p, 'c');
    const r = rRead.exists && !rRead.threw ? toSafeInt(rRead.value) : null;
    const c = cRead.exists && !cRead.threw ? toSafeInt(cRead.value) : null;
    if (!isInBounds(rows, cols, r, c)) continue;

    const cell = cells[r][c];
    if (PLAYABLE_CELL_TYPES[cell.type] !== true) continue;

    const tierRead = readOwnPropOnce(p, 'tier');
    const rawTier = tierRead.exists ? (!tierRead.threw ? toSafeInt(tierRead.value) : null) : 1;
    if (rawTier === null) continue;
    const tier = Math.max(MIN_TIER, Math.min(MAX_TIER, rawTier));

    const flavorRead = readOwnPropOnce(p, 'flavor');
    const initFlavor =
      flavorRead.exists && !flavorRead.threw ? normalizeFlavor(flavorRead.value) : 'plain';

    let frozenHp = 0;
    const frozenHpRead = readOwnPropOnce(p, 'frozenHp');
    if (frozenHpRead.exists) {
      const hp = !frozenHpRead.threw ? toSafeNum(frozenHpRead.value) : 0;
      frozenHp = Number.isFinite(hp) && hp > 0 ? 1 : 0;
    } else {
      const frozenRead = readOwnPropOnce(p, 'frozen');
      if (frozenRead.exists && !frozenRead.threw && typeof frozenRead.value === 'boolean') {
        frozenHp = frozenRead.value ? 1 : 0;
      } else {
        frozenHp = rawIceMask[r][c] ? 1 : 0;
      }
    }

    const finalFlavor =
      frozenHp === 0 ? computeCellDyeFlavor(initFlavor, cell.type, 0) : initFlavor;

    const tile = {
      uid: state.nextUid++,
      tier,
      flavor: finalFlavor,
      frozenHp,
      fromR: r,
      fromC: c,
      justMerged: false,
      justSpawned: false
    };

    cell.tile = tile;
  }

  return state;
}

function shatterAdjacentIceOnSnap(snap, rInt, cInt, outList) {
  for (let i = 0; i < ORTHOGONAL_DIRS.length; i++) {
    const nr = rInt + ORTHOGONAL_DIRS[i][0];
    const nc = cInt + ORTHOGONAL_DIRS[i][1];
    if (!isInBounds(snap.rows, snap.cols, nr, nc)) continue;

    const nEntry = snap.grid[nr][nc];
    const nTs = nEntry.curTileSnap;
    if (!nEntry.playable || !nTs) continue;

    const curHp = nTs.frozenHp;
    if (curHp > 0) {
      const nextHp = Math.max(0, curHp - 1);
      const nTile = nTs.tile;
      if (!verifiedSetProp(nTile, 'frozenHp', nextHp)) {
        return false;
      }
      if (nTs.origProps && nTs.origProps.frozen.exists) {
        if (!verifiedSetProp(nTile, 'frozen', nextHp > 0)) {
          return false;
        }
      }
      nTs.frozenHp = nextHp;

      if (nextHp === 0) {
        const dyedFlavor = computeCellDyeFlavor(nTs.flavor, nEntry.cellType, 0);
        if (!verifiedSetProp(nTile, 'flavor', dyedFlavor)) {
          return false;
        }
        nTs.flavor = dyedFlavor;
        setOptionalTileProp(nTile, 'fromR', nr);
        setOptionalTileProp(nTile, 'fromC', nc);
        setOptionalTileProp(nTile, 'justMerged', false);
        setOptionalTileProp(nTile, 'justSpawned', false);
        safePush(outList, { r: nr, c: nc, tile: nTile });
      }
    }
  }
  return true;
}

/**
 * Shatters 4-neighbor orthogonal frozen tiles around (r, c).
 * Diagonal neighbors are never affected.
 */
function shatterAdjacentIce(state, r, c) {
  const snap = snapshotGrid(state, true);
  if (!snap) return [];

  const rInt = toSafeInt(r);
  const cInt = toSafeInt(c);
  if (!isInBounds(snap.rows, snap.cols, rInt, cInt)) return [];

  const shattered = [];
  if (!shatterAdjacentIceOnSnap(snap, rInt, cInt, shattered)) {
    rollbackGridSnapshot(snap);
    return [];
  }
  return shattered;
}

function collectEmptyPlayableFromSnap(snap) {
  const empty = [];
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      if (entry.playable && entry.curTileSnap === null) {
        safePush(empty, entry);
      }
    }
  }
  return empty;
}

function spawnRandomLowTierOnSnap(snap, spawnOpts) {
  const emptyEntries = collectEmptyPlayableFromSnap(snap);
  if (emptyEntries.length === 0) {
    return { status: 'full', spawned: null };
  }

  const optsObj = isPlainObj(spawnOpts) ? spawnOpts : null;
  const optRng = optsObj ? getOwn(optsObj, 'rng', null) : null;
  const rngFn =
    typeof optRng === 'function'
      ? optRng
      : typeof spawnOpts === 'function'
        ? spawnOpts
        : Math.random;

  let c2Rate = DEFAULT_C2_RATE;
  if (optsObj) {
    const rateRead = readOwnPropOnce(optsObj, 'c2Rate');
    if (rateRead.exists && !rateRead.threw) {
      const parsedRate = toSafeNum(rateRead.value);
      if (Number.isFinite(parsedRate)) {
        c2Rate = Math.max(0, Math.min(1, parsedRate));
      }
    }
  }

  const r1 = safeRand01(rngFn);
  const cellIdx = Math.min(emptyEntries.length - 1, Math.floor(r1 * emptyEntries.length));
  const targetEntry = emptyEntries[cellIdx];

  const r2 = safeRand01(rngFn);
  const tier = r2 < c2Rate ? 2 : 1;
  const finalFlavor = computeCellDyeFlavor('plain', targetEntry.cellType, 0);
  const uid = allocSnapUid(snap);

  const tile = {
    uid,
    tier,
    flavor: finalFlavor,
    frozenHp: 0,
    fromR: targetEntry.r,
    fromC: targetEntry.c,
    justMerged: false,
    justSpawned: true
  };

  if (!verifiedSetProp(targetEntry.cell, 'tile', tile)) {
    return { status: 'write_failed', spawned: null };
  }

  targetEntry.curTile = tile;
  targetEntry.curTileSnap = {
    tile,
    uid,
    tier,
    flavor: finalFlavor,
    frozenHp: 0,
    origProps: null
  };

  return {
    status: 'ok',
    spawned: {
      r: targetEntry.r,
      c: targetEntry.c,
      tile
    }
  };
}

function buildOrderedLinesFromSnap(snap, dir) {
  const { rows, cols, grid } = snap;
  const lines = [];
  if (dir === 'left') {
    for (let r = 0; r < rows; r++) {
      const line = [];
      for (let c = 0; c < cols; c++) safePush(line, grid[r][c]);
      safePush(lines, line);
    }
  } else if (dir === 'right') {
    for (let r = 0; r < rows; r++) {
      const line = [];
      for (let c = cols - 1; c >= 0; c--) safePush(line, grid[r][c]);
      safePush(lines, line);
    }
  } else if (dir === 'up') {
    for (let c = 0; c < cols; c++) {
      const line = [];
      for (let r = 0; r < rows; r++) safePush(line, grid[r][c]);
      safePush(lines, line);
    }
  } else if (dir === 'down') {
    for (let c = 0; c < cols; c++) {
      const line = [];
      for (let r = rows - 1; r >= 0; r--) safePush(line, grid[r][c]);
      safePush(lines, line);
    }
  }
  return lines;
}

function splitIntoUnlockedSegmentsFromSnap(line) {
  const segments = [];
  let current = [];
  for (let i = 0; i < line.length; i++) {
    const entry = line[i];
    const ts = entry.curTileSnap;
    const isWall = !entry.playable || (ts !== null && ts.frozenHp > 0);
    if (isWall) {
      if (current.length > 0) {
        safePush(segments, current);
        current = [];
      }
    } else {
      safePush(current, entry);
    }
  }
  if (current.length > 0) {
    safePush(segments, current);
  }
  return segments;
}

/**
 * Performs a segmented shaped-grid 2048 slide in dir ('left'|'right'|'up'|'down').
 * Single-step non-chaining merges, C7 cap, orthogonal ice shatter, G/M/B dye, and 1 low-tier spawn.
 */
function slideGrid(state, dir, spawnOpts) {
  const emptyResult = {
    moved: false,
    mergeEvents: [],
    moveEvents: [],
    brokenIceCells: [],
    spawned: null,
    skillChargeGain: 0
  };

  if (dir !== 'left' && dir !== 'right' && dir !== 'up' && dir !== 'down') {
    return emptyResult;
  }

  const snap = snapshotGrid(state, true);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return emptyResult;
  }

  const lines = buildOrderedLinesFromSnap(snap, dir);
  const segmentPlans = [];
  let planMoved = false;

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const segments = splitIntoUnlockedSegmentsFromSnap(lines[lIdx]);
    for (let sIdx = 0; sIdx < segments.length; sIdx++) {
      const segEntries = segments[sIdx];
      const items = [];
      for (let k = 0; k < segEntries.length; k++) {
        const cEntry = segEntries[k];
        const ts = cEntry.curTileSnap;
        if (ts) {
          safePush(items, {
            tile: ts.tile,
            tileSnap: ts,
            tier: ts.tier,
            flavor: ts.flavor,
            uid: ts.uid !== null && ts.uid >= 1 ? ts.uid : 0,
            origR: cEntry.r,
            origC: cEntry.c
          });
        }
      }

      const actions = [];
      let writeIdx = 0;
      let i = 0;
      while (i < items.length) {
        const destEntry = segEntries[writeIdx];
        if (
          i + 1 < items.length &&
          items[i].tier === items[i + 1].tier &&
          items[i].tier < MAX_TIER
        ) {
          const targetItem = items[i];
          const movingItem = items[i + 1];
          planMoved = true;
          safePush(actions, {
            kind: 'merge',
            destEntry,
            targetItem,
            movingItem
          });
          writeIdx += 1;
          i += 2;
        } else {
          const item = items[i];
          if (item.origR !== destEntry.r || item.origC !== destEntry.c) {
            planMoved = true;
          }
          safePush(actions, {
            kind: 'place',
            destEntry,
            item
          });
          writeIdx += 1;
          i += 1;
        }
      }

      safePush(segmentPlans, { segEntries, actions });
    }
  }

  if (!planMoved) {
    return emptyResult;
  }

  // Read skipSpawn before mutating
  const skipSpawn = isPlainObj(spawnOpts) ? Boolean(getOwn(spawnOpts, 'skipSpawn', false)) : false;

  // Reset transient animation flags on frozen tiles that stayed in place
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const ts = snapRow[c].curTileSnap;
      if (ts && ts.frozenHp > 0) {
        if (!verifiedSetProp(ts.tile, 'frozenHp', ts.frozenHp)) {
          rollbackGridSnapshot(snap);
          return emptyResult;
        }
        setOptionalTileProp(ts.tile, 'fromR', r);
        setOptionalTileProp(ts.tile, 'fromC', c);
        setOptionalTileProp(ts.tile, 'justMerged', false);
        setOptionalTileProp(ts.tile, 'justSpawned', false);
      }
    }
  }

  const moveEvents = [];
  const mergeEvents = [];

  for (let pIdx = 0; pIdx < segmentPlans.length; pIdx++) {
    const { segEntries, actions } = segmentPlans[pIdx];
    for (let k = 0; k < segEntries.length; k++) {
      if (!verifiedSetProp(segEntries[k].cell, 'tile', null)) {
        rollbackGridSnapshot(snap);
        return emptyResult;
      }
      segEntries[k].curTile = null;
      segEntries[k].curTileSnap = null;
    }

    for (let aIdx = 0; aIdx < actions.length; aIdx++) {
      const act = actions[aIdx];
      const destEntry = act.destEntry;
      const destCell = destEntry.cell;
      const destType = destEntry.cellType;

      if (act.kind === 'merge') {
        const targetItem = act.targetItem;
        const movingItem = act.movingItem;
        const targetUid = targetItem.uid > 0 ? targetItem.uid : allocSnapUid(snap);
        const movingUid = movingItem.uid > 0 ? movingItem.uid : allocSnapUid(snap);
        const newTier = targetItem.tier + 1;
        const newFlavor = resolveMergedFlavorFromStrings(
          movingItem.flavor,
          targetItem.flavor,
          destType
        );
        const newUid = allocSnapUid(snap);
        const newTile = {
          uid: newUid,
          tier: newTier,
          flavor: newFlavor,
          frozenHp: 0,
          fromR: movingItem.origR,
          fromC: movingItem.origC,
          justMerged: true,
          justSpawned: false
        };
        if (!verifiedSetProp(destCell, 'tile', newTile)) {
          rollbackGridSnapshot(snap);
          return emptyResult;
        }
        destEntry.curTile = newTile;
        destEntry.curTileSnap = {
          tile: newTile,
          uid: newUid,
          tier: newTier,
          flavor: newFlavor,
          frozenHp: 0,
          origProps: null
        };

        if (targetItem.origR !== destEntry.r || targetItem.origC !== destEntry.c) {
          safePush(moveEvents, {
            uid: targetUid,
            tier: targetItem.tier,
            flavor: targetItem.flavor,
            fromR: targetItem.origR,
            fromC: targetItem.origC,
            toR: destEntry.r,
            toC: destEntry.c,
            merged: true
          });
        }
        safePush(moveEvents, {
          uid: movingUid,
          tier: movingItem.tier,
          flavor: movingItem.flavor,
          fromR: movingItem.origR,
          fromC: movingItem.origC,
          toR: destEntry.r,
          toC: destEntry.c,
          merged: true
        });

        safePush(mergeEvents, {
          r: destEntry.r,
          c: destEntry.c,
          toR: destEntry.r,
          toC: destEntry.c,
          uid: newTile.uid,
          tier: newTier,
          newTier,
          flavor: newFlavor,
          targetFrom: {
            r: targetItem.origR,
            c: targetItem.origC,
            uid: targetUid,
            tier: targetItem.tier,
            flavor: targetItem.flavor
          },
          movingFrom: {
            r: movingItem.origR,
            c: movingItem.origC,
            uid: movingUid,
            tier: movingItem.tier,
            flavor: movingItem.flavor
          },
          tile: newTile
        });
      } else {
        const item = act.item;
        const t = item.tile;
        const ts = item.tileSnap;
        const finalUid = item.uid >= 1 ? item.uid : allocSnapUid(snap);
        if ((ts.origProps && ts.origProps.uid.exists) || safeIsExtensible(t)) {
          if (!verifiedSetProp(t, 'uid', finalUid)) {
            rollbackGridSnapshot(snap);
            return emptyResult;
          }
        }
        if (
          !verifiedSetProp(t, 'tier', item.tier) ||
          !verifiedSetProp(t, 'flavor', item.flavor) ||
          !verifiedSetProp(t, 'frozenHp', 0)
        ) {
          rollbackGridSnapshot(snap);
          return emptyResult;
        }
        setOptionalTileProp(t, 'fromR', item.origR);
        setOptionalTileProp(t, 'fromC', item.origC);
        setOptionalTileProp(t, 'justMerged', false);
        setOptionalTileProp(t, 'justSpawned', false);
        if (!verifiedSetProp(destCell, 'tile', t)) {
          rollbackGridSnapshot(snap);
          return emptyResult;
        }

        ts.uid = finalUid;
        ts.tier = item.tier;
        ts.flavor = item.flavor;
        ts.frozenHp = 0;
        destEntry.curTile = t;
        destEntry.curTileSnap = ts;

        if (item.origR !== destEntry.r || item.origC !== destEntry.c) {
          safePush(moveEvents, {
            uid: finalUid,
            tier: item.tier,
            flavor: item.flavor,
            fromR: item.origR,
            fromC: item.origC,
            toR: destEntry.r,
            toC: destEntry.c,
            merged: false
          });
        }
      }
    }
  }

  // Post-slide orthogonal ice shattering (thawed tiles stay in place on this turn)
  const brokenIceCells = [];
  for (let m = 0; m < mergeEvents.length; m++) {
    if (!shatterAdjacentIceOnSnap(snap, mergeEvents[m].r, mergeEvents[m].c, brokenIceCells)) {
      rollbackGridSnapshot(snap);
      return emptyResult;
    }
  }

  // Board-wide special cell dye sweep (gold / matcha / berry)
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      const ts = entry.curTileSnap;
      const cellType = entry.cellType;
      if (
        ts &&
        ts.frozenHp === 0 &&
        (cellType === 'gold' || cellType === 'matcha' || cellType === 'berry')
      ) {
        const dyedFlavor = computeCellDyeFlavor(ts.flavor, cellType, 0);
        if (!verifiedSetProp(ts.tile, 'flavor', dyedFlavor)) {
          rollbackGridSnapshot(snap);
          return emptyResult;
        }
        ts.flavor = dyedFlavor;
      }
    }
  }

  // Skill charge gain for >= C5 merges
  let highMerges = 0;
  for (let m = 0; m < mergeEvents.length; m++) {
    if (mergeEvents[m].newTier >= HIGH_MERGE_MIN_TIER) {
      highMerges += 1;
    }
  }
  const skillChargeGain = highMerges * HIGH_MERGE_SKILL_CHARGE;

  // Spawn 1 random C1/C2 unless skipSpawn === true
  let spawned = null;
  if (!skipSpawn) {
    const spawnRes = spawnRandomLowTierOnSnap(snap, spawnOpts);
    if (spawnRes.status === 'write_failed') {
      rollbackGridSnapshot(snap);
      return emptyResult;
    }
    spawned = spawnRes.spawned;
  }

  if (!commitSnapNextUid(snap)) {
    rollbackGridSnapshot(snap);
    return emptyResult;
  }

  return {
    moved: true,
    mergeEvents,
    moveEvents,
    brokenIceCells,
    spawned,
    skillChargeGain
  };
}

/**
 * Independent Knead button action: spawns 1 C1/C2 on a random empty playable cell.
 */
function kneadSpawn(state, spawnOpts) {
  const snap = snapshotGrid(state, true);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return { spawned: false, reason: 'invalid_state' };
  }

  const emptyCells = collectEmptyPlayableFromSnap(snap);
  if (emptyCells.length === 0) {
    return { spawned: false, reason: 'board_full' };
  }

  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const ts = snapRow[c].curTileSnap;
      if (ts) {
        setOptionalTileProp(ts.tile, 'fromR', r);
        setOptionalTileProp(ts.tile, 'fromC', c);
        setOptionalTileProp(ts.tile, 'justMerged', false);
        setOptionalTileProp(ts.tile, 'justSpawned', false);
      }
    }
  }

  const spawnRes = spawnRandomLowTierOnSnap(snap, spawnOpts);
  if (spawnRes.status === 'full') {
    return { spawned: false, reason: 'board_full' };
  }
  if (spawnRes.status !== 'ok' || !spawnRes.spawned || !commitSnapNextUid(snap)) {
    rollbackGridSnapshot(snap);
    return { spawned: false, reason: 'invalid_state' };
  }

  return {
    spawned: true,
    r: spawnRes.spawned.r,
    c: spawnRes.spawned.c,
    tile: spawnRes.spawned.tile
  };
}

/**
 * Removes a non-frozen tile at (r, c) for tray placement or fork deletion.
 * When opts.allowShatterIce === true and the tile is frozen, shatters the ice shell in place.
 */
function removeTileAt(state, r, c, opts) {
  const snap = snapshotGrid(state, true);
  if (!snap) {
    return { removed: false, shatteredIce: false, tile: null, reason: 'invalid_state' };
  }

  const rInt = toSafeInt(r);
  const cInt = toSafeInt(c);
  if (!isInBounds(snap.rows, snap.cols, rInt, cInt)) {
    return { removed: false, shatteredIce: false, tile: null, reason: 'out_of_bounds' };
  }

  const entry = snap.grid[rInt][cInt];
  if (!entry.playable) {
    return { removed: false, shatteredIce: false, tile: null, reason: 'unplayable_cell' };
  }

  const ts = entry.curTileSnap;
  if (!ts) {
    return { removed: false, shatteredIce: false, tile: null, reason: 'empty_cell' };
  }

  const allowShatterIce = isPlainObj(opts) ? Boolean(getOwn(opts, 'allowShatterIce', false)) : false;
  const tile = ts.tile;

  if (ts.frozenHp > 0) {
    if (!allowShatterIce) {
      return { removed: false, shatteredIce: false, tile: null, reason: 'tile_frozen' };
    }
    const dyedFlavor = computeCellDyeFlavor(ts.flavor, entry.cellType, 0);
    if (!verifiedSetProp(tile, 'frozenHp', 0) || !verifiedSetProp(tile, 'flavor', dyedFlavor)) {
      rollbackGridSnapshot(snap);
      return { removed: false, shatteredIce: false, tile: null, reason: 'invalid_state' };
    }
    if (ts.origProps && ts.origProps.frozen.exists) {
      if (!verifiedSetProp(tile, 'frozen', false)) {
        rollbackGridSnapshot(snap);
        return { removed: false, shatteredIce: false, tile: null, reason: 'invalid_state' };
      }
    }
    setOptionalTileProp(tile, 'fromR', rInt);
    setOptionalTileProp(tile, 'fromC', cInt);
    setOptionalTileProp(tile, 'justMerged', false);
    setOptionalTileProp(tile, 'justSpawned', false);
    return { removed: false, shatteredIce: true, tile };
  }

  if (!verifiedSetProp(entry.cell, 'tile', null)) {
    rollbackGridSnapshot(snap);
    return { removed: false, shatteredIce: false, tile: null, reason: 'invalid_state' };
  }

  return { removed: true, shatteredIce: false, tile };
}

/**
 * Magic Upgrade Spoon action: upgrades a non-frozen C1..C6 tile by +1 tier, preserving flavor.
 */
function upgradeTileAt(state, r, c) {
  const snap = snapshotGrid(state, true);
  if (!snap) {
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'invalid_state' };
  }

  const rInt = toSafeInt(r);
  const cInt = toSafeInt(c);
  if (!isInBounds(snap.rows, snap.cols, rInt, cInt)) {
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'out_of_bounds' };
  }

  const entry = snap.grid[rInt][cInt];
  if (!entry.playable) {
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'unplayable_cell' };
  }

  const ts = entry.curTileSnap;
  if (!ts) {
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'empty_cell' };
  }
  if (ts.frozenHp > 0) {
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'tile_frozen' };
  }
  if (ts.tier >= MAX_TIER) {
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'max_tier' };
  }

  const tile = ts.tile;
  const nextTier = ts.tier + 1;
  const dyedFlavor = computeCellDyeFlavor(ts.flavor, entry.cellType, 0);

  if (!verifiedSetProp(tile, 'tier', nextTier) || !verifiedSetProp(tile, 'flavor', dyedFlavor)) {
    rollbackGridSnapshot(snap);
    return { upgraded: false, tile: null, skillChargeGain: 0, reason: 'invalid_state' };
  }

  setOptionalTileProp(tile, 'fromR', rInt);
  setOptionalTileProp(tile, 'fromC', cInt);
  setOptionalTileProp(tile, 'justMerged', true);
  setOptionalTileProp(tile, 'justSpawned', false);

  const skillChargeGain = nextTier >= HIGH_MERGE_MIN_TIER ? HIGH_MERGE_SKILL_CHARGE : 0;
  return {
    upgraded: true,
    tile,
    skillChargeGain
  };
}

function segmentAdmitsMoveFromSnap(segEntries) {
  const len = segEntries.length;
  if (len <= 1) return false;

  let tileCount = 0;
  let prevTier = -1;
  let hasAdjacentPair = false;

  for (let i = 0; i < len; i++) {
    const ts = segEntries[i].curTileSnap;
    if (ts) {
      tileCount += 1;
      const tier = ts.tier;
      if (tier === prevTier && tier < MAX_TIER) {
        hasAdjacentPair = true;
      }
      prevTier = tier;
    }
  }

  if (tileCount >= 1 && tileCount < len) return true;
  if (tileCount === len && hasAdjacentPair) return true;
  return false;
}

/**
 * Necessary and sufficient shaped-grid segment check for whether any of the 4 slide directions moves.
 */
function canAnyMove(state) {
  const snap = snapshotGrid(state, false);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return false;
  }

  for (let r = 0; r < snap.rows; r++) {
    const rowLine = [];
    for (let c = 0; c < snap.cols; c++) safePush(rowLine, snap.grid[r][c]);
    const rowSegs = splitIntoUnlockedSegmentsFromSnap(rowLine);
    for (let s = 0; s < rowSegs.length; s++) {
      if (segmentAdmitsMoveFromSnap(rowSegs[s])) return true;
    }
  }

  for (let c = 0; c < snap.cols; c++) {
    const colLine = [];
    for (let r = 0; r < snap.rows; r++) safePush(colLine, snap.grid[r][c]);
    const colSegs = splitIntoUnlockedSegmentsFromSnap(colLine);
    for (let s = 0; s < colSegs.length; s++) {
      if (segmentAdmitsMoveFromSnap(colSegs[s])) return true;
    }
  }

  return false;
}

/**
 * Returns highest non-frozen Cat-Cake tier currently on the board (0 if empty).
 */
function getMaxBoardTier(state, opts) {
  const snap = snapshotGrid(state, false);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return 0;
  }
  const includeFrozen = isPlainObj(opts) ? Boolean(getOwn(opts, 'includeFrozen', false)) : false;

  let maxTier = 0;
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      const ts = entry.curTileSnap;
      if (!entry.playable || !ts) continue;
      if (!includeFrozen && ts.frozenHp > 0) continue;
      if (ts.tier > maxTier) maxTier = ts.tier;
    }
  }
  return maxTier;
}

/**
 * Returns canonical list of available flavors on the board (from cell types and unlocked tiles).
 */
function getBoardFlavors(state) {
  const result = [];
  safePush(result, 'plain');

  const snap = snapshotGrid(state, false);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return result;
  }

  const found = Object.assign(Object.create(null), {
    plain: true,
    matcha: false,
    berry: false,
    gold: false
  });

  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      if (!entry.playable) continue;
      const cellType = entry.cellType;
      if (cellType === 'matcha' || cellType === 'berry' || cellType === 'gold') {
        found[cellType] = true;
      }
      const ts = entry.curTileSnap;
      if (ts && ts.frozenHp === 0) {
        found[ts.flavor] = true;
      }
    }
  }

  if (found.matcha) safePush(result, 'matcha');
  if (found.berry) safePush(result, 'berry');
  if (found.gold) safePush(result, 'gold');
  return result;
}

/**
 * Luna Patron Active Skill: clears all non-frozen C1 tiles and sorts remaining non-frozen tiles
 * descending by tier into top-left row-major unlocked playable slots.
 */
function applyLunaBoardTidy(state) {
  const snap = snapshotGrid(state, true);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return { clearedCount: 0, movedTiles: 0 };
  }

  const availableSlots = [];
  const survivors = [];
  let clearedCount = 0;

  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      if (!entry.playable) continue;

      const ts = entry.curTileSnap;
      if (ts && ts.frozenHp > 0) {
        if (!verifiedSetProp(ts.tile, 'frozenHp', ts.frozenHp)) {
          rollbackGridSnapshot(snap);
          return { clearedCount: 0, movedTiles: 0 };
        }
        setOptionalTileProp(ts.tile, 'fromR', r);
        setOptionalTileProp(ts.tile, 'fromC', c);
        setOptionalTileProp(ts.tile, 'justMerged', false);
        setOptionalTileProp(ts.tile, 'justSpawned', false);
        continue;
      }

      safePush(availableSlots, entry);
      if (ts) {
        if (ts.tier === MIN_TIER) {
          clearedCount += 1;
        } else {
          safePush(survivors, {
            tile: ts.tile,
            tileSnap: ts,
            tier: ts.tier,
            flavor: ts.flavor,
            origR: r,
            origC: c
          });
        }
        if (!verifiedSetProp(entry.cell, 'tile', null)) {
          rollbackGridSnapshot(snap);
          return { clearedCount: 0, movedTiles: 0 };
        }
        entry.curTile = null;
        entry.curTileSnap = null;
      }
    }
  }

  survivors.sort((a, b) => (b.tier - a.tier) || (a.origR - b.origR) || (a.origC - b.origC));

  let movedTiles = 0;
  for (let k = 0; k < survivors.length; k++) {
    const dest = availableSlots[k];
    const item = survivors[k];
    const t = item.tile;
    const dyedFlavor = computeCellDyeFlavor(item.flavor, dest.cellType, 0);

    if (
      !verifiedSetProp(t, 'tier', item.tier) ||
      !verifiedSetProp(t, 'frozenHp', 0) ||
      !verifiedSetProp(t, 'flavor', dyedFlavor)
    ) {
      rollbackGridSnapshot(snap);
      return { clearedCount: 0, movedTiles: 0 };
    }
    setOptionalTileProp(t, 'fromR', item.origR);
    setOptionalTileProp(t, 'fromC', item.origC);
    setOptionalTileProp(t, 'justMerged', false);
    setOptionalTileProp(t, 'justSpawned', false);

    if (!verifiedSetProp(dest.cell, 'tile', t)) {
      rollbackGridSnapshot(snap);
      return { clearedCount: 0, movedTiles: 0 };
    }
    dest.curTile = t;
    dest.curTileSnap = item.tileSnap;

    if (item.origR !== dest.r || item.origC !== dest.c) {
      movedTiles += 1;
    }
  }

  return { clearedCount, movedTiles };
}

/**
 * Mugi Patron Active Skill: shatters all frozen tiles across the board, then upgrades up to 2
 * random non-max tiles by +1 tier and grants gold flavor.
 */
function applyMugiBoardBlast(state, rng) {
  const snap = snapshotGrid(state, true);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return { shatteredCells: [], upgradedCells: [] };
  }

  const optRng = isPlainObj(rng) ? getOwn(rng, 'rng', null) : null;
  const rngFn =
    typeof rng === 'function'
      ? rng
      : typeof optRng === 'function'
        ? optRng
        : Math.random;

  const shatteredCells = [];
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      const ts = entry.curTileSnap;
      if (!entry.playable || !ts) continue;

      const tile = ts.tile;
      setOptionalTileProp(tile, 'fromR', r);
      setOptionalTileProp(tile, 'fromC', c);
      setOptionalTileProp(tile, 'justMerged', false);
      setOptionalTileProp(tile, 'justSpawned', false);

      if (ts.frozenHp > 0) {
        const dyedFlavor = computeCellDyeFlavor(ts.flavor, entry.cellType, 0);
        if (!verifiedSetProp(tile, 'frozenHp', 0) || !verifiedSetProp(tile, 'flavor', dyedFlavor)) {
          rollbackGridSnapshot(snap);
          return { shatteredCells: [], upgradedCells: [] };
        }
        if (ts.origProps && ts.origProps.frozen.exists) {
          if (!verifiedSetProp(tile, 'frozen', false)) {
            rollbackGridSnapshot(snap);
            return { shatteredCells: [], upgradedCells: [] };
          }
        }
        ts.frozenHp = 0;
        ts.flavor = dyedFlavor;
        safePush(shatteredCells, { r, c });
      }
    }
  }

  const candidates = [];
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      const entry = snapRow[c];
      const ts = entry.curTileSnap;
      if (!entry.playable || !ts || ts.frozenHp > 0) continue;
      if (ts.tier < MAX_TIER) {
        safePush(candidates, { r, c, tile: ts.tile, tileSnap: ts, tier: ts.tier });
      }
    }
  }

  const pickCount = Math.min(2, candidates.length);
  const upgradedCells = [];

  for (let i = 0; i < pickCount; i++) {
    const swapIdx = i + Math.floor(safeRand01(rngFn) * (candidates.length - i));
    const tmp = candidates[i];
    safeSetIdx(candidates, i, candidates[swapIdx]);
    safeSetIdx(candidates, swapIdx, tmp);

    const picked = candidates[i];
    const nextTier = Math.min(MAX_TIER, picked.tier + 1);
    if (
      !verifiedSetProp(picked.tile, 'tier', nextTier) ||
      !verifiedSetProp(picked.tile, 'flavor', 'gold')
    ) {
      rollbackGridSnapshot(snap);
      return { shatteredCells: [], upgradedCells: [] };
    }
    setOptionalTileProp(picked.tile, 'justMerged', true);
    picked.tileSnap.tier = nextTier;
    picked.tileSnap.flavor = 'gold';

    safePush(upgradedCells, {
      r: picked.r,
      c: picked.c,
      tier: nextTier
    });
  }

  return { shatteredCells, upgradedCells };
}

/**
 * Tactical Relocate Fork action (v0.9.0):
 * 1) shatter_ice: single-cell frozen tile -> shatters ice shell & dyes cell flavor
 * 2) trash: opts.discardToTrash === true -> destroys non-frozen tile directly (bypasses tray trash cooldown)
 * 3) move: non-frozen tile -> empty playable cell across walls/voids + cell dye
 * 4) merge: two non-frozen same-tier (< C7) tiles -> merges at (toR, toC) + orthogonal ice shatter + >=C5 charge
 * 5) swap: two non-frozen diff-tier (or dual C7) tiles -> swaps positions + bidirectional cell dye
 * Strictly 0 score change and 0 automatic random tile spawns.
 */
function applyForkAction(state, fromR, fromC, toR, toC, opts) {
  let hasDest = toR !== undefined && toR !== null;
  let optsObj = isPlainObj(opts) ? opts : null;
  if (isPlainObj(toR) && toC === undefined && opts === undefined) {
    optsObj = toR;
    hasDest = false;
  }

  const snap = snapshotGrid(state, true);
  if (!snap || snap.rows === 0 || snap.cols === 0) {
    return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
  }

  const r1 = toSafeInt(fromR);
  const c1 = toSafeInt(fromC);
  if (!isInBounds(snap.rows, snap.cols, r1, c1)) {
    return { applied: false, ok: false, mode: null, reason: 'out_of_bounds' };
  }

  const srcEntry = snap.grid[r1][c1];
  if (!srcEntry.playable) {
    return { applied: false, ok: false, mode: null, reason: 'unplayable_cell' };
  }

  const srcTs = srcEntry.curTileSnap;
  if (!srcTs) {
    return { applied: false, ok: false, mode: null, reason: 'empty_cell' };
  }

  const discardToTrash = Boolean(optsObj && getOwn(optsObj, 'discardToTrash', false));

  // Mode 2: Direct emergency discard to trash basket
  if (discardToTrash) {
    if (srcTs.frozenHp > 0) {
      return { applied: false, ok: false, mode: null, reason: 'tile_frozen' };
    }
    if (!verifiedSetProp(srcEntry.cell, 'tile', null)) {
      rollbackGridSnapshot(snap);
      return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
    }
    return {
      applied: true,
      ok: true,
      mode: 'trash',
      removed: true,
      shatteredIce: false,
      brokenIceCells: [],
      skillChargeGain: 0,
      tile: srcTs.tile,
      fromR: r1,
      fromC: c1
    };
  }

  // Mode 1: Single-tap ice shatter when no destination is provided
  if (!hasDest) {
    if (srcTs.frozenHp > 0) {
      const tile = srcTs.tile;
      const dyedFlavor = computeCellDyeFlavor(srcTs.flavor, srcEntry.cellType, 0);
      if (!verifiedSetProp(tile, 'frozenHp', 0) || !verifiedSetProp(tile, 'flavor', dyedFlavor)) {
        rollbackGridSnapshot(snap);
        return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
      }
      if (srcTs.origProps && srcTs.origProps.frozen.exists) {
        if (!verifiedSetProp(tile, 'frozen', false)) {
          rollbackGridSnapshot(snap);
          return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
        }
      }
      setOptionalTileProp(tile, 'fromR', r1);
      setOptionalTileProp(tile, 'fromC', c1);
      setOptionalTileProp(tile, 'justMerged', false);
      setOptionalTileProp(tile, 'justSpawned', false);
      const brokenIceCells = [];
      safePush(brokenIceCells, { r: r1, c: c1, tile });
      return {
        applied: true,
        ok: true,
        mode: 'shatter_ice',
        shatteredIce: true,
        removed: false,
        brokenIceCells,
        skillChargeGain: 0,
        tile,
        flavor: dyedFlavor,
        fromR: r1,
        fromC: c1
      };
    }
    return { applied: false, ok: false, mode: null, reason: 'missing_target' };
  }

  // Modes 3, 4, 5 require a non-frozen source tile and a valid playable non-frozen destination
  if (srcTs.frozenHp > 0) {
    return { applied: false, ok: false, mode: null, reason: 'tile_frozen' };
  }

  const r2 = toSafeInt(toR);
  const c2 = toSafeInt(toC);
  if (!isInBounds(snap.rows, snap.cols, r2, c2)) {
    return { applied: false, ok: false, mode: null, reason: 'out_of_bounds' };
  }
  if (r1 === r2 && c1 === c2) {
    return { applied: false, ok: false, mode: null, reason: 'same_cell' };
  }

  const dstEntry = snap.grid[r2][c2];
  if (!dstEntry.playable) {
    return { applied: false, ok: false, mode: null, reason: 'unplayable_cell' };
  }

  const dstTs = dstEntry.curTileSnap;
  if (dstTs && dstTs.frozenHp > 0) {
    return { applied: false, ok: false, mode: null, reason: 'target_frozen' };
  }

  // Reset transient animation markers on untouched tiles so only fork participants animate
  for (let r = 0; r < snap.rows; r++) {
    const snapRow = snap.grid[r];
    for (let c = 0; c < snap.cols; c++) {
      if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
      const otherTs = snapRow[c].curTileSnap;
      if (otherTs) {
        setOptionalTileProp(otherTs.tile, 'fromR', r);
        setOptionalTileProp(otherTs.tile, 'fromC', c);
        setOptionalTileProp(otherTs.tile, 'justMerged', false);
        setOptionalTileProp(otherTs.tile, 'justSpawned', false);
      }
    }
  }

  // Mode 3: Cross-obstacle move into empty playable cell + destination cell dye
  if (!dstTs) {
    const srcTile = srcTs.tile;
    const dyedFlavor = computeCellDyeFlavor(srcTs.flavor, dstEntry.cellType, 0);
    if (
      !verifiedSetProp(srcEntry.cell, 'tile', null) ||
      !verifiedSetProp(srcTile, 'tier', srcTs.tier) ||
      !verifiedSetProp(srcTile, 'frozenHp', 0) ||
      !verifiedSetProp(srcTile, 'flavor', dyedFlavor) ||
      !verifiedSetProp(dstEntry.cell, 'tile', srcTile)
    ) {
      rollbackGridSnapshot(snap);
      return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
    }
    setOptionalTileProp(srcTile, 'fromR', r1);
    setOptionalTileProp(srcTile, 'fromC', c1);
    setOptionalTileProp(srcTile, 'justMerged', false);
    setOptionalTileProp(srcTile, 'justSpawned', false);

    return {
      applied: true,
      ok: true,
      mode: 'move',
      removed: false,
      shatteredIce: false,
      brokenIceCells: [],
      skillChargeGain: 0,
      tile: srcTile,
      flavor: dyedFlavor,
      fromR: r1,
      fromC: c1,
      toR: r2,
      toC: c2
    };
  }

  if (srcTs.tile === dstTs.tile) {
    rollbackGridSnapshot(snap);
    return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
  }

  // Mode 4: Cross-cell merge for same-tier (< C7) tiles + orthogonal 4-neighbor ice shatter
  if (srcTs.tier === dstTs.tier && srcTs.tier < MAX_TIER) {
    const newTier = dstTs.tier + 1;
    const newFlavor = resolveMergedFlavorFromStrings(
      srcTs.flavor,
      dstTs.flavor,
      dstEntry.cellType
    );
    const newUid = allocSnapUid(snap);
    const newTile = {
      uid: newUid,
      tier: newTier,
      flavor: newFlavor,
      frozenHp: 0,
      fromR: r1,
      fromC: c1,
      justMerged: true,
      justSpawned: false
    };

    if (
      !verifiedSetProp(srcEntry.cell, 'tile', null) ||
      !verifiedSetProp(dstEntry.cell, 'tile', newTile)
    ) {
      rollbackGridSnapshot(snap);
      return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
    }

    srcEntry.curTile = null;
    srcEntry.curTileSnap = null;
    dstEntry.curTile = newTile;
    dstEntry.curTileSnap = {
      tile: newTile,
      uid: newUid,
      tier: newTier,
      flavor: newFlavor,
      frozenHp: 0,
      origProps: null
    };

    const brokenIceCells = [];
    if (!shatterAdjacentIceOnSnap(snap, r2, c2, brokenIceCells) || !commitSnapNextUid(snap)) {
      rollbackGridSnapshot(snap);
      return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
    }

    const skillChargeGain = newTier >= HIGH_MERGE_MIN_TIER ? HIGH_MERGE_SKILL_CHARGE : 0;
    return {
      applied: true,
      ok: true,
      mode: 'merge',
      newTier,
      flavor: newFlavor,
      tile: newTile,
      brokenIceCells,
      shatteredIce: brokenIceCells.length > 0,
      removed: false,
      skillChargeGain,
      fromR: r1,
      fromC: c1,
      toR: r2,
      toC: c2
    };
  }

  // Mode 5: Swap positions for different-tier (or dual max-tier C7) tiles + bidirectional cell dye
  const srcTile = srcTs.tile;
  const dstTile = dstTs.tile;
  const srcLandedFlavor = computeCellDyeFlavor(srcTs.flavor, dstEntry.cellType, 0);
  const dstLandedFlavor = computeCellDyeFlavor(dstTs.flavor, srcEntry.cellType, 0);

  if (
    !verifiedSetProp(srcTile, 'tier', srcTs.tier) ||
    !verifiedSetProp(srcTile, 'frozenHp', 0) ||
    !verifiedSetProp(srcTile, 'flavor', srcLandedFlavor) ||
    !verifiedSetProp(dstTile, 'tier', dstTs.tier) ||
    !verifiedSetProp(dstTile, 'frozenHp', 0) ||
    !verifiedSetProp(dstTile, 'flavor', dstLandedFlavor) ||
    !verifiedSetProp(srcEntry.cell, 'tile', dstTile) ||
    !verifiedSetProp(dstEntry.cell, 'tile', srcTile)
  ) {
    rollbackGridSnapshot(snap);
    return { applied: false, ok: false, mode: null, reason: 'invalid_state' };
  }

  setOptionalTileProp(srcTile, 'fromR', r1);
  setOptionalTileProp(srcTile, 'fromC', c1);
  setOptionalTileProp(srcTile, 'justMerged', false);
  setOptionalTileProp(srcTile, 'justSpawned', false);

  setOptionalTileProp(dstTile, 'fromR', r2);
  setOptionalTileProp(dstTile, 'fromC', c2);
  setOptionalTileProp(dstTile, 'justMerged', false);
  setOptionalTileProp(dstTile, 'justSpawned', false);

  return {
    applied: true,
    ok: true,
    mode: 'swap',
    tile: srcTile,
    swappedTile: dstTile,
    flavor: srcLandedFlavor,
    swappedFlavor: dstLandedFlavor,
    brokenIceCells: [],
    shatteredIce: false,
    removed: false,
    skillChargeGain: 0,
    fromR: r1,
    fromC: c1,
    toR: r2,
    toC: c2
  };
}

module.exports = {
  createGridState,
  slideGrid,
  kneadSpawn,
  removeTileAt,
  applyForkAction,
  upgradeTileAt,
  shatterAdjacentIce,
  resolveMergedFlavor,
  applyCellDye,
  canAnyMove,
  getMaxBoardTier,
  applyLunaBoardTidy,
  applyMugiBoardBlast
};

Object.defineProperty(module.exports, 'getBoardFlavors', {
  __proto__: null,
  value: getBoardFlavors,
  enumerable: false,
  configurable: false,
  writable: false
});
