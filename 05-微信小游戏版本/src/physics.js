/**
 * StarlightPhysics — True 2D Compound-Convex-Polygon Rigid-Body Physics Engine
 * Features:
 *  - Multi-polygon compound silhouettes extracted directly from sprite alpha masks
 *  - SAT (Separating Axis Theorem) + 2-point Sutherland-Hodgman contact manifolds
 *  - Exact analytical curved-bottom glass jar collision (convex interior vertex theorem)
 *  - Box2D-style Sequential Impulse Solver (PGS) with accumulated normal & Coulomb friction impulses
 *  - Exact Center of Mass, Moment of Inertia, contact lever arms (r x J), and angular momentum
 *  - Split positional stabilization (zero artificial bounce energy) + resting micro-damping
 *  - Exact polygon drop-sweep landing predictor + impact telemetry for directional squish & crumbs
 */
'use strict';

  const STATIC_JAR = {
    id: 0,
    isStatic: true,
    isJarWall: true,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    vr: 0,
    invMass: 0,
    invI: 0,
    friction: 0.46,
    restitution: 0.18
  };

  function buildLocalPolys(shapeDef, eqRadius) {
    const localPolys = [];
    for (const rawPoly of shapeDef.polygons) {
      const verts = rawPoly.map(([nx, ny]) => ({
        x: nx * eqRadius,
        y: ny * eqRadius
      }));
      const n = verts.length;
      const normals = [];
      let cx = 0;
      let cy = 0;
      for (let i = 0; i < n; i++) {
        cx += verts[i].x;
        cy += verts[i].y;
        const a = verts[i];
        const b = verts[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        // Outward normal for positive-signed-area polygons in screen coords (+x right, +y down)
        normals.push({ x: dy / len, y: -dx / len });
      }
      cx /= n;
      cy /= n;
      let boundR = 0;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(verts[i].x - cx, verts[i].y - cy);
        if (d > boundR) boundR = d;
      }
      localPolys.push({ verts, normals, cx, cy, boundR });
    }
    return localPolys;
  }

  function allocateWorldPolys(localPolys) {
    return localPolys.map((lp) => ({
      verts: lp.verts.map(() => ({ x: 0, y: 0 })),
      normals: lp.normals.map(() => ({ x: 0, y: 0 })),
      cx: 0,
      cy: 0,
      boundR: lp.boundR
    }));
  }

  function configureBodyShape(body, shapeDef, eqRadius, material) {
    const massMult = material && typeof material.massMult === 'number' ? material.massMult : 1.0;
    const gravityScale = material && typeof material.gravityScale === 'number' ? material.gravityScale : 1.0;
    body.r = eqRadius;
    body.shapeDef = shapeDef;
    body.boundR = shapeDef.bound_r_norm * eqRadius;
    body.mass = eqRadius * eqRadius * massMult;
    body.invMass = 1 / body.mass;
    body.massMult = massMult;
    body.gravityScale = gravityScale;
    // Polar moment of inertia I = m * k * r_eq^2 (boosted slightly by 1.15 for smooth playful tumbling)
    body.inertia = body.mass * shapeDef.inertia_k * eqRadius * eqRadius * 1.15;
    body.invI = 1 / body.inertia;
    body.friction = material.friction;
    body.restitution = material.restitution;
    body.localPolys = buildLocalPolys(shapeDef, eqRadius);
    body.worldPolys = allocateWorldPolys(body.localPolys);
    updateBodyWorld(body);
  }

  function updateBodyWorld(body) {
    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);
    const bx = body.x;
    const by = body.y;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const lps = body.localPolys;
    const wps = body.worldPolys;
    for (let p = 0; p < lps.length; p++) {
      const lp = lps[p];
      const wp = wps[p];
      wp.cx = bx + lp.cx * cos - lp.cy * sin;
      wp.cy = by + lp.cx * sin + lp.cy * cos;

      const lv = lp.verts;
      const wv = wp.verts;
      const ln = lp.normals;
      const wn = wp.normals;
      for (let i = 0; i < lv.length; i++) {
        const vx = bx + lv[i].x * cos - lv[i].y * sin;
        const vy = by + lv[i].x * sin + lv[i].y * cos;
        wv[i].x = vx;
        wv[i].y = vy;
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
        if (vy < minY) minY = vy;
        if (vy > maxY) maxY = vy;

        wn[i].x = ln[i].x * cos - ln[i].y * sin;
        wn[i].y = ln[i].x * sin + ln[i].y * cos;
      }
    }

    body.aabbMinX = minX;
    body.aabbMaxX = maxX;
    body.aabbMinY = minY;
    body.aabbMaxY = maxY;
  }

  function findAxisLeastPenetration(polyA, polyB) {
    let bestSep = -Infinity;
    let bestIdx = 0;
    const vertsA = polyA.verts;
    const normsA = polyA.normals;
    const vertsB = polyB.verts;
    const nA = vertsA.length;
    const nB = vertsB.length;

    for (let i = 0; i < nA; i++) {
      const nx = normsA[i].x;
      const ny = normsA[i].y;
      const ax = vertsA[i].x;
      const ay = vertsA[i].y;

      // Support point of B in direction -n
      let minDot = Infinity;
      for (let j = 0; j < nB; j++) {
        const d = vertsB[j].x * nx + vertsB[j].y * ny;
        if (d < minDot) minDot = d;
      }

      const sep = minDot - (ax * nx + ay * ny);
      if (sep > 0) return null; // Strictly separated
      if (sep > bestSep) {
        bestSep = sep;
        bestIdx = i;
      }
    }
    return { sep: bestSep, idx: bestIdx };
  }

  function clipSegmentToLine(vIn, nx, ny, offset) {
    const out = [];
    if (vIn.length < 2) return out;
    const d0 = vIn[0].x * nx + vIn[0].y * ny - offset;
    const d1 = vIn[1].x * nx + vIn[1].y * ny - offset;

    if (d0 >= 0) out.push({ x: vIn[0].x, y: vIn[0].y });
    if (d1 >= 0) out.push({ x: vIn[1].x, y: vIn[1].y });

    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      out.push({
        x: vIn[0].x + t * (vIn[1].x - vIn[0].x),
        y: vIn[0].y + t * (vIn[1].y - vIn[0].y)
      });
    }
    return out;
  }

  function collideConvexPolys(polyA, polyB, outContacts) {
    // Sub-polygon circle broadphase
    const dcx = polyB.cx - polyA.cx;
    const dcy = polyB.cy - polyA.cy;
    const rSum = polyA.boundR + polyB.boundR;
    if (dcx * dcx + dcy * dcy > rSum * rSum) return false;

    const qA = findAxisLeastPenetration(polyA, polyB);
    if (!qA) return false;
    const qB = findAxisLeastPenetration(polyB, polyA);
    if (!qB) return false;

    const flip = qB.sep > qA.sep * 0.98 + 0.01;
    const refPoly = flip ? polyB : polyA;
    const incPoly = flip ? polyA : polyB;
    const refIdx = flip ? qB.idx : qA.idx;

    const refN = refPoly.verts.length;
    const r0 = refPoly.verts[refIdx];
    const r1 = refPoly.verts[(refIdx + 1) % refN];
    const refNx = refPoly.normals[refIdx].x;
    const refNy = refPoly.normals[refIdx].y;

    // Find incident edge on incPoly most anti-parallel to refNormal
    const incNorms = incPoly.normals;
    const incVerts = incPoly.verts;
    const incLen = incVerts.length;
    let incIdx = 0;
    let minDot = Infinity;
    for (let i = 0; i < incLen; i++) {
      const dot = incNorms[i].x * refNx + incNorms[i].y * refNy;
      if (dot < minDot) {
        minDot = dot;
        incIdx = i;
      }
    }

    let seg = [incVerts[incIdx], incVerts[(incIdx + 1) % incLen]];

    // Reference tangent along r0 -> r1
    const rdx = r1.x - r0.x;
    const rdy = r1.y - r0.y;
    const rLen = Math.hypot(rdx, rdy) || 1;
    const tx = rdx / rLen;
    const ty = rdy / rLen;

    // Clip incident segment to reference edge side planes
    seg = clipSegmentToLine(seg, tx, ty, r0.x * tx + r0.y * ty);
    if (seg.length < 2) return false;
    seg = clipSegmentToLine(seg, -tx, -ty, -(r1.x * tx + r1.y * ty));
    if (seg.length < 2) return false;

    const refOffset = r0.x * refNx + r0.y * refNy;
    // Contact normal always points from A toward B
    const cNx = flip ? -refNx : refNx;
    const cNy = flip ? -refNy : refNy;

    let added = false;
    for (let i = 0; i < seg.length; i++) {
      const p = seg[i];
      const sep = p.x * refNx + p.y * refNy - refOffset;
      if (sep <= 0.2) {
        const pen = Math.max(0, -sep);
        outContacts.push({
          px: p.x + refNx * (pen * 0.5),
          py: p.y + refNy * (pen * 0.5),
          nx: cNx,
          ny: cNy,
          pen
        });
        added = true;
      }
    }
    return added;
  }

  function testBodiesOverlap(bodyA, bodyB) {
    if (
      bodyA.aabbMaxX < bodyB.aabbMinX ||
      bodyA.aabbMinX > bodyB.aabbMaxX ||
      bodyA.aabbMaxY < bodyB.aabbMinY ||
      bodyA.aabbMinY > bodyB.aabbMaxY
    ) {
      return false;
    }
    const wpsA = bodyA.worldPolys;
    const wpsB = bodyB.worldPolys;
    for (let i = 0; i < wpsA.length; i++) {
      for (let j = 0; j < wpsB.length; j++) {
        const pa = wpsA[i];
        const pb = wpsB[j];
        const dx = pb.cx - pa.cx;
        const dy = pb.cy - pa.cy;
        const rs = pa.boundR + pb.boundR;
        if (dx * dx + dy * dy > rs * rs) continue;
        if (findAxisLeastPenetration(pa, pb) && findAxisLeastPenetration(pb, pa)) {
          return true;
        }
      }
    }
    return false;
  }

  function collideBodyPair(bodyA, bodyB, contactsOut) {
    if (
      bodyA.aabbMaxX + 0.5 < bodyB.aabbMinX ||
      bodyA.aabbMinX - 0.5 > bodyB.aabbMaxX ||
      bodyA.aabbMaxY + 0.5 < bodyB.aabbMinY ||
      bodyA.aabbMinY - 0.5 > bodyB.aabbMaxY
    ) {
      return false;
    }

    const raw = [];
    const wpsA = bodyA.worldPolys;
    const wpsB = bodyB.worldPolys;
    for (let i = 0; i < wpsA.length; i++) {
      for (let j = 0; j < wpsB.length; j++) {
        collideConvexPolys(wpsA[i], wpsB[j], raw);
      }
    }
    if (raw.length === 0) return false;

    raw.sort((a, b) => b.pen - a.pen);
    const kept = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      let dup = false;
      for (let k = 0; k < kept.length; k++) {
        if (Math.hypot(kept[k].px - c.px, kept[k].py - c.py) < 4.0) {
          dup = true;
          break;
        }
      }
      if (!dup) {
        kept.push(c);
        if (kept.length >= 3) break;
      }
    }

    const mu = Math.sqrt(bodyA.friction * bodyB.friction);
    const e = Math.max(bodyA.restitution, bodyB.restitution);
    for (let i = 0; i < kept.length; i++) {
      const c = kept[i];
      contactsOut.push({
        a: bodyA,
        b: bodyB,
        px: c.px,
        py: c.py,
        nx: c.nx,
        ny: c.ny,
        pen: c.pen,
        mu,
        restitution: e,
        jnAcc: 0,
        jtAcc: 0,
        bias: 0,
        massN: 0,
        massT: 0,
        rAx: 0,
        rAy: 0,
        rBx: 0,
        rBy: 0
      });
    }
    return true;
  }

  // Exact analytical query of a single point against the convex curved-bottom glass jar interior
  function queryPointAgainstJar(vx, vy, jar, skin = 0) {
    const leftArcCx = jar.left + jar.cornerR;
    const rightArcCx = jar.right - jar.cornerR;
    const arcCy = jar.floorY - jar.cornerR;

    // Curved bottom-left or bottom-right quarter-circle corners
    if (vy > arcCy && (vx < leftArcCx || vx > rightArcCx)) {
      const cx = vx < leftArcCx ? leftArcCx : rightArcCx;
      const dx = vx - cx;
      const dy = vy - arcCy;
      const dist = Math.hypot(dx, dy);
      if (dist > jar.cornerR - skin && dist > 1e-4) {
        return {
          pen: Math.max(0, dist - jar.cornerR),
          nx: -dx / dist,
          ny: -dy / dist
        };
      }
      return null;
    }

    let best = null;
    if (vx < jar.left + skin) {
      best = { pen: Math.max(0, jar.left - vx), nx: 1, ny: 0 };
    }
    if (vx > jar.right - skin) {
      const p = Math.max(0, vx - jar.right);
      if (!best || p > best.pen) best = { pen: p, nx: -1, ny: 0 };
    }
    if (vy > jar.floorY - skin) {
      const p = Math.max(0, vy - jar.floorY);
      if (!best || p > best.pen) best = { pen: p, nx: 0, ny: -1 };
    }
    return best;
  }

  function collideBodyWithJar(body, jar, contactsOut, wallRestBonus = 0) {
    const SKIN = 0.45;
    const innerLeft = jar.left + jar.cornerR;
    const innerRight = jar.right - jar.cornerR;
    const innerBottom = jar.floorY - jar.cornerR;
    if (
      body.aabbMinX >= jar.left + SKIN &&
      body.aabbMaxX <= jar.right - SKIN &&
      body.aabbMaxY <= jar.floorY - SKIN &&
      !(body.aabbMaxY > innerBottom - SKIN && (body.aabbMinX < innerLeft + SKIN || body.aabbMaxX > innerRight - SKIN))
    ) {
      return false;
    }

    const raw = [];
    const wps = body.worldPolys;
    for (let p = 0; p < wps.length; p++) {
      const verts = wps[p].verts;
      for (let i = 0; i < verts.length; i++) {
        const vx = verts[i].x;
        const vy = verts[i].y;
        const hit = queryPointAgainstJar(vx, vy, jar, SKIN);
        if (hit) {
          raw.push({ px: vx, py: vy, nx: hit.nx, ny: hit.ny, pen: hit.pen });
        }
      }
    }
    if (raw.length === 0) return false;

    raw.sort((a, b) => b.pen - a.pen);
    const kept = [];
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      let dup = false;
      for (let k = 0; k < kept.length; k++) {
        if (Math.hypot(kept[k].px - c.px, kept[k].py - c.py) < 4.5) {
          dup = true;
          break;
        }
      }
      if (!dup) {
        kept.push(c);
        if (kept.length >= 4) break;
      }
    }

    const mu = Math.sqrt(body.friction * STATIC_JAR.friction);
    const baseE = Math.max(body.restitution, STATIC_JAR.restitution);
    for (let i = 0; i < kept.length; i++) {
      const c = kept[i];
      const isSideWall = Math.abs(c.nx) > 0.85 && Math.abs(c.ny) < 0.25;
      const bankE =
        isSideWall && body.isBankLaunched && body.age < 1.8
          ? Math.min(0.96, Math.max(baseE, body.tier === 2 ? 0.78 : 0.64) + wallRestBonus)
          : Math.min(0.94, baseE + (isSideWall ? wallRestBonus * 0.65 : 0));
      contactsOut.push({
        a: STATIC_JAR,
        b: body,
        px: c.px,
        py: c.py,
        nx: c.nx,
        ny: c.ny,
        pen: c.pen,
        mu: isSideWall && body.isBankLaunched && body.age < 1.8 ? mu * 0.35 : mu,
        restitution: bankE,
        jnAcc: 0,
        jtAcc: 0,
        bias: 0,
        massN: 0,
        massT: 0,
        rAx: 0,
        rAy: 0,
        rBx: 0,
        rBy: 0
      });
    }
    return true;
  }

  function ensureDividerStaticBody(ob) {
    const cx = ob.x;
    const halfW = typeof ob.halfW === 'number' ? ob.halfW : (ob.w || 14) * 0.5;
    const topY = ob.topY;
    const capY = typeof ob.capY === 'number' ? ob.capY : topY + halfW;
    const bottomY = ob.bottomY;
    const key = `${cx}|${halfW}|${topY}|${capY}|${bottomY}`;
    if (ob._staticBody && ob._staticBody._key === key) {
      return ob._staticBody;
    }

    // 9-vertex CW strictly convex polygon (7-point semicircular top cap + 2 bottom corners)
    const verts = [];
    for (let k = 0; k <= 6; k++) {
      const theta = Math.PI + (k * Math.PI) / 6;
      verts.push({
        x: cx + Math.cos(theta) * halfW,
        y: capY + Math.sin(theta) * halfW
      });
    }
    verts.push({ x: cx + halfW, y: bottomY });
    verts.push({ x: cx - halfW, y: bottomY });

    const n = verts.length;
    const normals = [];
    for (let i = 0; i < n; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      normals.push({ x: dy / len, y: -dx / len });
    }

    const polyCy = (topY + bottomY) * 0.5;
    let boundR = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(verts[i].x - cx, verts[i].y - polyCy);
      if (d > boundR) boundR = d;
    }

    const body = {
      _key: key,
      id: -101,
      isStatic: true,
      isDivider: true,
      x: cx,
      y: polyCy,
      vx: 0,
      vy: 0,
      angle: 0,
      vr: 0,
      invMass: 0,
      invI: 0,
      friction: typeof ob.friction === 'number' ? ob.friction : 0.32,
      restitution: typeof ob.restitution === 'number' ? ob.restitution : 0.28,
      worldPolys: [{ verts, normals, cx, cy: polyCy, boundR }],
      aabbMinX: cx - halfW,
      aabbMaxX: cx + halfW,
      aabbMinY: topY,
      aabbMaxY: bottomY
    };
    ob._staticBody = body;
    return body;
  }

  function clampBodyOutsideDividers(body, obstacles) {
    if (!Array.isArray(obstacles) || obstacles.length === 0) return false;
    let moved = false;
    for (let iter = 0; iter < 3; iter++) {
      let iterMoved = false;
      for (let oi = 0; oi < obstacles.length; oi++) {
        const ob = obstacles[oi];
        if (!ob || ob.type !== 'divider') continue;
        const divBody = ensureDividerStaticBody(ob);
        if (
          body.aabbMaxX <= divBody.aabbMinX ||
          body.aabbMinX >= divBody.aabbMaxX ||
          body.aabbMaxY <= divBody.aabbMinY ||
          body.aabbMinY >= divBody.aabbMaxY
        ) {
          continue;
        }
        const raw = [];
        const wps = body.worldPolys;
        const divPoly = divBody.worldPolys[0];
        for (let p = 0; p < wps.length; p++) {
          collideConvexPolys(divPoly, wps[p], raw);
        }
        if (raw.length === 0) continue;
        let best = raw[0];
        for (let k = 1; k < raw.length; k++) {
          if (raw[k].pen > best.pen) best = raw[k];
        }
        if (best.pen > 0.05) {
          let nx = best.nx;
          let ny = best.ny;
          let pen = best.pen;
          // Never push downward into jar floor; eject horizontally into nearest bay instead
          if (ny > 0.5) {
            const halfW = typeof ob.halfW === 'number' ? ob.halfW : (ob.w || 14) * 0.5;
            nx = body.x >= ob.x ? 1 : -1;
            ny = 0;
            pen = Math.max(pen, halfW + (body.r || 16) - Math.abs(body.x - ob.x));
          }
          body.x += nx * (pen + 0.25);
          body.y += ny * (pen + 0.25);
          updateBodyWorld(body);
          iterMoved = true;
          moved = true;
        }
      }
      if (!iterMoved) break;
    }
    return moved;
  }

  function clampBodyToJarOnly(body, jar) {
    let moved = false;
    for (let iter = 0; iter < 3; iter++) {
      updateBodyWorld(body);
      let maxPen = 0;
      let pushX = 0;
      let pushY = 0;
      const wps = body.worldPolys;
      for (let p = 0; p < wps.length; p++) {
        const verts = wps[p].verts;
        for (let i = 0; i < verts.length; i++) {
          const hit = queryPointAgainstJar(verts[i].x, verts[i].y, jar, 0);
          if (hit && hit.pen > maxPen) {
            maxPen = hit.pen;
            pushX = hit.nx * hit.pen;
            pushY = hit.ny * hit.pen;
          }
        }
      }
      if (maxPen <= 0.05) break;
      body.x += pushX;
      body.y += pushY;
      moved = true;
    }
    updateBodyWorld(body);
    return moved;
  }

  function clampBodyInsideJarPositional(body, jar, obstacles = null) {
    const hasDivider = Array.isArray(obstacles) && obstacles.some((o) => o && o.type === 'divider');
    if (hasDivider) {
      updateBodyWorld(body);
      for (let pass = 0; pass < 2; pass++) {
        const mDiv = clampBodyOutsideDividers(body, obstacles);
        const mJar = clampBodyToJarOnly(body, jar);
        if (!mDiv && !mJar) break;
      }
      updateBodyWorld(body);
      return;
    }
    clampBodyToJarOnly(body, jar);
  }

  function bodyTouchesJar(body, jar) {
    const wps = body.worldPolys;
    for (let p = 0; p < wps.length; p++) {
      const verts = wps[p].verts;
      for (let i = 0; i < verts.length; i++) {
        if (queryPointAgainstJar(verts[i].x, verts[i].y, jar, 0)) return true;
      }
    }
    return false;
  }

  function preStepContacts(contacts) {
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      const A = c.a;
      const B = c.b;
      const rAx = A.isStatic ? 0 : c.px - A.x;
      const rAy = A.isStatic ? 0 : c.py - A.y;
      const rBx = c.px - B.x;
      const rBy = c.py - B.y;
      c.rAx = rAx;
      c.rAy = rAy;
      c.rBx = rBx;
      c.rBy = rBy;

      const nx = c.nx;
      const ny = c.ny;
      const tx = -ny;
      const ty = nx;

      const rnA = rAx * ny - rAy * nx;
      const rnB = rBx * ny - rBy * nx;
      const kN = A.invMass + B.invMass + A.invI * rnA * rnA + B.invI * rnB * rnB;
      c.massN = kN > 1e-12 ? 1 / kN : 0;

      const rtA = rAx * ty - rAy * tx;
      const rtB = rBx * ty - rBy * tx;
      const kT = A.invMass + B.invMass + A.invI * rtA * rtA + B.invI * rtB * rtB;
      c.massT = kT > 1e-12 ? 1 / kT : 0;

      const vAx = A.vx - A.vr * rAy;
      const vAy = A.vy + A.vr * rAx;
      const vBx = B.vx - B.vr * rBy;
      const vBy = B.vy + B.vr * rBx;
      const vn = (vBx - vAx) * nx + (vBy - vAy) * ny;
      c.initialVn = vn;
      c.bias = vn < -75 ? -c.restitution * vn : 0;
    }
  }

  function solveVelocityContacts(contacts, iters) {
    for (let iter = 0; iter < iters; iter++) {
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        const A = c.a;
        const B = c.b;
        const nx = c.nx;
        const ny = c.ny;
        const rAx = c.rAx;
        const rAy = c.rAy;
        const rBx = c.rBx;
        const rBy = c.rBy;

        // 1. Normal impulse (with accumulated clamping)
        let vAx = A.vx - A.vr * rAy;
        let vAy = A.vy + A.vr * rAx;
        let vBx = B.vx - B.vr * rBy;
        let vBy = B.vy + B.vr * rBx;
        const vn = (vBx - vAx) * nx + (vBy - vAy) * ny;

        const dJn = (c.bias - vn) * c.massN;
        const oldJn = c.jnAcc;
        c.jnAcc = Math.max(0, oldJn + dJn);
        const applyJn = c.jnAcc - oldJn;

        const jnx = nx * applyJn;
        const jny = ny * applyJn;
        if (!A.isStatic) {
          A.vx -= jnx * A.invMass;
          A.vy -= jny * A.invMass;
          A.vr -= (rAx * jny - rAy * jnx) * A.invI;
        }
        B.vx += jnx * B.invMass;
        B.vy += jny * B.invMass;
        B.vr += (rBx * jny - rBy * jnx) * B.invI;

        // 2. Tangential Coulomb friction impulse (with accumulated cone clamping)
        const tx = -ny;
        const ty = nx;
        vAx = A.vx - A.vr * rAy;
        vAy = A.vy + A.vr * rAx;
        vBx = B.vx - B.vr * rBy;
        vBy = B.vy + B.vr * rBx;
        const vt = (vBx - vAx) * tx + (vBy - vAy) * ty;

        const dJt = -vt * c.massT;
        const maxFriction = c.mu * c.jnAcc;
        const oldJt = c.jtAcc;
        c.jtAcc = Math.max(-maxFriction, Math.min(maxFriction, oldJt + dJt));
        const applyJt = c.jtAcc - oldJt;

        const jtx = tx * applyJt;
        const jty = ty * applyJt;
        if (!A.isStatic) {
          A.vx -= jtx * A.invMass;
          A.vy -= jty * A.invMass;
          A.vr -= (rAx * jty - rAy * jtx) * A.invI;
        }
        B.vx += jtx * B.invMass;
        B.vy += jty * B.invMass;
        B.vr += (rBx * jty - rBy * jtx) * B.invI;
      }
    }
  }

  function solvePositions(contacts, jar, bodies, obstacles = null) {
    const slop = 0.2;
    const beta = 0.45;
    const maxCorr = 6.0;

    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      if (c.pen <= slop) continue;
      const A = c.a;
      const B = c.b;
      const invSum = A.invMass + B.invMass;
      if (invSum <= 0) continue;

      const corrMag = Math.min(maxCorr, (c.pen - slop) * beta);
      const cx = (c.nx * corrMag) / invSum;
      const cy = (c.ny * corrMag) / invSum;

      if (!A.isStatic) {
        A.x -= cx * A.invMass;
        A.y -= cy * A.invMass;
      }
      B.x += cx * B.invMass;
      B.y += cy * B.invMass;
    }

    for (let i = 0; i < bodies.length; i++) {
      if (!bodies[i].merged) {
        clampBodyInsideJarPositional(bodies[i], jar, obstacles);
      }
    }
  }

  /**
   * Step the rigid-body world forward by `dt` seconds.
   * Order: Semi-implicit Euler (integrate forces -> tentative step -> detect contacts ->
   * PGS sequential impulse velocity solver -> positional stabilization).
   * Returns { mergePairs, impacts, wallBounces, meteorHits, bumperHits, glazeHits, debugContacts, magnetLinks }.
   */
  function stepWorld(bodies, jar, dt, gravity = 1420, opts = {}) {
    const SUBSTEPS = 3;
    const VELOCITY_ITERS = 10;
    const subDt = dt / SUBSTEPS;

    const magnetRange = typeof opts.magnetRange === 'number' ? opts.magnetRange : 10;
    const magnetForce = typeof opts.magnetForce === 'number' ? opts.magnetForce : 460;
    const gravityDir = typeof opts.gravityDir === 'number' ? opts.gravityDir : 1;
    const wallRestBonus = typeof opts.wallRestBonus === 'number' ? opts.wallRestBonus : 0;
    const globalResonance = !!opts.globalResonance;
    const obstacles = Array.isArray(opts.obstacles) ? opts.obstacles : [];

    const mergePairs = [];
    const impacts = [];
    const wallBounces = [];
    const meteorHits = [];
    const bumperHits = [];
    const glazeHits = [];
    let lastContacts = [];
    let lastMagnetLinks = [];

    for (let s = 0; s < SUBSTEPS; s++) {
      // Advance patrolling Glaze Ring obstacles smoothly per substep
      for (let oi = 0; oi < obstacles.length; oi++) {
        const ob = obstacles[oi];
        if (ob && ob.type === 'glaze_ring') {
          ob.phase = (ob.phase || 0) + (typeof ob.speed === 'number' ? ob.speed : 0.95) * subDt;
          const centerX = typeof ob.centerX === 'number' ? ob.centerX : 220;
          const amp = typeof ob.patrolAmp === 'number' ? ob.patrolAmp : 125;
          ob.x = centerX + Math.sin(ob.phase) * amp;
        }
      }

      // Collect active T3 resonance emitters for this substep
      const resonators = [];
      // 1. Integrate gravity into velocities & advance tentative positions/angles
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.merged) continue;
        const gScale = typeof b.gravityScale === 'number' ? b.gravityScale : 1.0;
        b.vy += gravity * gScale * gravityDir * subDt;
        b.vx *= 0.9985;
        b.vy *= 0.9985;
        b.vr *= 0.994;

        if (b.spinBoostTimer > 0) {
          b.spinBoostTimer = Math.max(0, b.spinBoostTimer - subDt);
          const targetVr = (b.spinBoostDir || 1) * 11.0;
          b.vr += (targetVr - b.vr) * Math.min(1, subDt * 14);
        }
        if (b.resonanceTimer > 0) {
          b.resonanceTimer = Math.max(0, b.resonanceTimer - subDt);
          resonators.push(b);
        }

        if (b.vr > 13) b.vr = 13;
        else if (b.vr < -13) b.vr = -13;

        b._prevX = b.x;
        b._prevY = b.y;
        b.x += b.vx * subDt;
        b.y += b.vy * subDt;
        b.angle += b.vr * subDt;

        // Gentle glass-lid cap during Anti-Gravity inversion so treats stay safely inside jar
        if (gravityDir < 0) {
          const ceilY = jar.neckY + Math.max(18, b.r * 0.72);
          if (b.y < ceilY) {
            b.y = ceilY;
            if (b.vy < 0) b.vy = Math.abs(b.vy) * 0.35 + 22;
          }
        }
        b.inContact = false;
      }

      // 2. Update world polygons & generate all contact manifolds + same-tier/wildcard magnet
      for (let i = 0; i < bodies.length; i++) {
        if (!bodies[i].merged) updateBodyWorld(bodies[i]);
      }

      const contacts = [];
      const magnetLinks = s === SUBSTEPS - 1 ? [] : null;
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.merged) continue;

        if (collideBodyWithJar(a, jar, contacts, wallRestBonus)) {
          a.inContact = true;
          a.hasCollided = true;
        }

        // Static & trigger jar obstacles (Butter Bumpers, Wooden Divider, Caramel Glaze Ring)
        for (let oi = 0; oi < obstacles.length; oi++) {
          const ob = obstacles[oi];
          if (!ob) continue;

          if (ob.type === 'bumper') {
            const bdx = a.x - ob.x;
            const bdy = a.y - ob.y;
            const minD = a.r + ob.r;
            const dSq = bdx * bdx + bdy * bdy;
            if (dSq < minD * minD) {
              const dist = Math.sqrt(dSq) || 0.001;
              const nx = bdx / dist;
              const ny = bdy / dist;
              const pen = minD - dist;
              a.x += nx * (pen + 0.4);
              a.y += ny * (pen + 0.4);
              updateBodyWorld(a);
              a.inContact = true;
              a.hasCollided = true;

              const vn = a.vx * nx + a.vy * ny;
              if (vn < 60) {
                const e = ob.restitution || 1.15;
                const bounceSpd = Math.max(210, -vn * e);
                const tx = -ny;
                const ty = nx;
                const vt = a.vx * tx + a.vy * ty;
                a.vx = nx * bounceSpd + tx * vt * 0.92;
                a.vy = ny * bounceSpd + ty * vt * 0.92;
                const maxSpd = 920;
                const spd = Math.hypot(a.vx, a.vy);
                if (spd > maxSpd) {
                  a.vx = (a.vx / spd) * maxSpd;
                  a.vy = (a.vy / spd) * maxSpd;
                }
                a.vr += (nx >= 0 ? 1 : -1) * 3.5;

                if (a.lastBumperHitAge === undefined || a.age - a.lastBumperHitAge > 0.1) {
                  a.lastBumperHitAge = a.age;
                  bumperHits.push({
                    body: a,
                    bumper: ob,
                    x: ob.x + nx * ob.r,
                    y: ob.y + ny * ob.r,
                    nx,
                    ny
                  });
                }
              }
            }
          } else if (ob.type === 'divider') {
            const halfW = typeof ob.halfW === 'number' ? ob.halfW : (ob.w || 14) * 0.5;
            const capY = typeof ob.capY === 'number' ? ob.capY : ob.topY + halfW;

            // High-speed anti-tunneling centerline check strictly below the top dome center
            if (
              typeof a._prevX === 'number' &&
              typeof a._prevY === 'number' &&
              (a._prevX - ob.x) * (a.x - ob.x) <= 0 &&
              Math.abs(a._prevX - ob.x) >= 1.5
            ) {
              const denom = a.x - a._prevX;
              const t = Math.abs(denom) > 1e-4 ? Math.max(0, Math.min(1, (ob.x - a._prevX) / denom)) : 0.5;
              const crossY = a._prevY + (a.y - a._prevY) * t;
              if (crossY > capY) {
                const side = a._prevX < ob.x ? -1 : 1;
                a.x = ob.x + side * (halfW + a.r * 0.92);
                a.vx = side * Math.max(85, Math.abs(a.vx) * 0.42);
                a.inContact = true;
                a.hasCollided = true;
                ob.hitFlash = Math.max(ob.hitFlash || 0, 0.25);
                updateBodyWorld(a);
              }
            }

            // Full 9-vertex convex polygon SAT contact + PGS integration
            const divBody = ensureDividerStaticBody(ob);
            if (collideBodyPair(divBody, a, contacts)) {
              a.inContact = true;
              a.hasCollided = true;
              const spd = Math.hypot(a.vx, a.vy);
              if (spd > 135) {
                ob.hitFlash = Math.max(ob.hitFlash || 0, Math.min(0.32, spd / 1400));
              }
              // Gentle dome roll-off nudge so treats never balance dead-center on the top cap
              if (a.y < capY + 4 && Math.abs(a.x - ob.x) < 4.5 && Math.abs(a.vx) < 28) {
                a.vx += (a.x >= ob.x ? 1 : -1) * 32;
              }
            }
          } else if (ob.type === 'glaze_ring') {
            if (a.isGolden || a.isWildcard || a.isYarnBall || a.frozenHp > 0 || a.merged) continue;
            const rx = ob.rx || 38;
            const ry = ob.ry || 13;
            const px = typeof a._prevX === 'number' ? a._prevX : a.x;
            const py = typeof a._prevY === 'number' ? a._prevY : a.y;
            let hitRing = false;
            if ((py <= ob.y && a.y >= ob.y) || (py >= ob.y && a.y <= ob.y)) {
              const dySeg = a.y - py;
              const t = Math.abs(dySeg) > 1e-4 ? (ob.y - py) / dySeg : 0.5;
              const crossX = px + (a.x - px) * t;
              if (Math.abs(crossX - ob.x) <= rx + a.r * 0.2) {
                hitRing = true;
              }
            } else if (Math.abs(a.x - ob.x) <= rx && Math.abs(a.y - ob.y) <= ry + 4) {
              hitRing = true;
            }
            if (hitRing) {
              a.isGolden = true;
              glazeHits.push({ body: a, ring: ob, x: a.x, y: ob.y });
            }
          }
        }

        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.merged) continue;

          const isYarnPair = !!(a.isYarnBall || b.isYarnBall);
          const isFrozenPair = !!(a.frozenHp > 0 || b.frozenHp > 0);
          const isWildPair = !isYarnPair && !isFrozenPair && !!(a.isWildcard || b.isWildcard);
          const aLanded = !!(a.hasCollided || a.bornFromMerge);
          const bLanded = !!(b.hasCollided || b.bornFromMerge);
          const midY = (a.y + b.y) * 0.5;
          const canMerge =
            !isYarnPair &&
            !isFrozenPair &&
            (isWildPair || a.tier === b.tier) &&
            (aLanded || bLanded) &&
            midY >= jar.neckY - 6;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy;

          // T3 Matcha Kitty / rel_resonance magnet boost for matching pairs
          let nearResonance = !!(globalResonance || a.resonanceTimer > 0 || b.resonanceTimer > 0);
          if (!nearResonance && canMerge && resonators.length > 0) {
            const mx = (a.x + b.x) * 0.5;
            const my = (a.y + b.y) * 0.5;
            for (let rIdx = 0; rIdx < resonators.length; rIdx++) {
              const resB = resonators[rIdx];
              const rdx = mx - resB.x;
              const rdy = my - resB.y;
              if (rdx * rdx + rdy * rdy <= 105 * 105) {
                nearResonance = true;
                break;
              }
            }
          }

          let effMagnet = isWildPair ? (magnetRange > 0 ? Math.max(10, magnetRange * 1.05) : 5) : magnetRange;
          let pairMagnetForce = magnetForce;
          if (nearResonance && canMerge) {
            effMagnet = Math.max(effMagnet, 42);
            pairMagnetForce = Math.max(pairMagnetForce, 580);
          }
          const rs = a.boundR + b.boundR + (canMerge ? effMagnet + 4 : 1);
          if (distSq > rs * rs) continue;

          if (canMerge) {
            const dist = Math.sqrt(distSq) || 0.001;
            const wildCloseTouch = isWildPair && dist <= (a.r + b.r) * 1.01;
            const sameCloseSnap = !isWildPair && dist <= (a.r + b.r) * 0.94 && a.age > 0.05 && b.age > 0.05;
            if (wildCloseTouch || sameCloseSnap || testBodiesOverlap(a, b)) {
              a.merged = true;
              b.merged = true;
              mergePairs.push([a, b]);
              break;
            }

            // Silky same-tier / wildcard magnetic pull when magnet is active
            const surfaceGap = dist - (a.r + b.r);
            if (effMagnet > 0 && surfaceGap < effMagnet && a.age > 0.05 && b.age > 0.05) {
              const strength = Math.max(0.12, Math.min(1, 1 - Math.max(0, surfaceGap) / effMagnet));
              const pull = pairMagnetForce * (0.35 + 0.65 * strength * strength) * subDt;
              const ux = dx / dist;
              const uy = dy / dist;
              const invTotal = a.invMass + b.invMass || 1;
              const shareA = Math.min(1.6, (a.invMass / invTotal) * 2);
              const shareB = Math.min(1.6, (b.invMass / invTotal) * 2);
              a.vx += ux * pull * shareA;
              a.vy += uy * pull * shareA;
              b.vx -= ux * pull * shareB;
              b.vy -= uy * pull * shareB;

              if (magnetLinks) {
                magnetLinks.push({ a, b, strength, isWild: isWildPair, isResonance: nearResonance && magnetRange === 0 });
              }
            }
            continue;
          }

          if (collideBodyPair(a, b, contacts)) {
            a.inContact = true;
            b.inContact = true;
            if (aLanded || bLanded) {
              a.hasCollided = true;
              b.hasCollided = true;
            }
            // Mugi's Meteor Shot first-contact detection
            if (a.isMeteorShot && !b.isYarnBall && !b.isWildcard) {
              a.isMeteorShot = false;
              meteorHits.push({ shooter: a, target: b, x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 });
            } else if (b.isMeteorShot && !a.isYarnBall && !a.isWildcard) {
              b.isMeteorShot = false;
              meteorHits.push({ shooter: b, target: a, x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 });
            }
          }
        }
      }

      // 3. Sequential Impulse Velocity Solver (normal + Coulomb friction + angular torque)
      preStepContacts(contacts);
      solveVelocityContacts(contacts, VELOCITY_ITERS);

      // 4. Collect strong impact telemetry & side-wall bank-shot bounces (glass jar wall ONLY)
      for (let i = 0; i < contacts.length; i++) {
        const c = contacts[i];
        if (c.initialVn < -85 && c.jnAcc > 0) {
          impacts.push({
            x: c.px,
            y: c.py,
            nx: c.nx,
            ny: c.ny,
            speed: -c.initialVn,
            bodyA: c.a.isStatic ? null : c.a,
            bodyB: c.b
          });
          if (
            c.a.isJarWall &&
            Math.abs(c.nx) > 0.85 &&
            Math.abs(c.ny) < 0.25 &&
            c.b.isBankLaunched &&
            c.b.age < 1.9
          ) {
            if (c.b.lastWallBounceAge === undefined || c.b.age - c.b.lastWallBounceAge > 0.08) {
              c.b.wallBounces = (c.b.wallBounces || 0) + 1;
              c.b.lastWallBounceAge = c.b.age;
              wallBounces.push({
                body: c.b,
                x: c.px,
                y: c.py,
                nx: c.nx,
                ny: c.ny,
                count: c.b.wallBounces
              });
            }
          }
        }
      }

      // 5. Gentle micro-damping only for nearly stationary pastries (keeps slopes & rolling lively!)
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.merged || !b.inContact || b.spinBoostTimer > 0) continue;
        const linSpdSq = b.vx * b.vx + b.vy * b.vy;
        const angSpd = Math.abs(b.vr);
        if (linSpdSq < 55 && angSpd < 0.24) {
          b.vx *= 0.93;
          b.vy *= 0.93;
          b.vr *= 0.88;
          if (linSpdSq < 7 && angSpd < 0.05) {
            b.vx *= 0.65;
            b.vy *= 0.65;
            b.vr *= 0.55;
          }
        }
      }

      // 6. Positional stabilization (split from velocity, including divider safety clamp)
      solvePositions(contacts, jar, bodies, obstacles);

      if (s === SUBSTEPS - 1) {
        lastContacts = contacts;
        lastMagnetLinks = magnetLinks || [];
      }
    }

    return {
      mergePairs,
      impacts,
      wallBounces,
      meteorHits,
      bumperHits,
      glazeHits,
      debugContacts: lastContacts,
      magnetLinks: lastMagnetLinks
    };
  }

  /**
   * Exact polygon drop-sweep predictor: returns the highest resting Y where a
   * candidate shape dropped vertically at `(dropX, dropY, angle)` first contacts
   * either the curved glass jar or any existing pastry's exact polygon silhouette.
   */
  function predictDropLandingY(shapeDef, eqRadius, dropX, startY, angle, jar, existingBodies, obstacles = []) {
    const probe = {
      x: dropX,
      y: startY,
      angle,
      r: eqRadius,
      boundR: shapeDef.bound_r_norm * eqRadius,
      localPolys: buildLocalPolys(shapeDef, eqRadius),
      worldPolys: null,
      aabbMinX: 0,
      aabbMaxX: 0,
      aabbMinY: 0,
      aabbMaxY: 0
    };
    probe.worldPolys = allocateWorldPolys(probe.localPolys);
    const obsList = Array.isArray(obstacles) ? obstacles : [];

    const hitsAt = (testY) => {
      probe.y = testY;
      updateBodyWorld(probe);
      if (bodyTouchesJar(probe, jar)) return true;
      for (let oi = 0; oi < obsList.length; oi++) {
        const ob = obsList[oi];
        if (!ob) continue;
        if (ob.type === 'divider') {
          if (testBodiesOverlap(probe, ensureDividerStaticBody(ob))) return true;
        } else if (ob.type === 'bumper') {
          const hitD = eqRadius * 0.94 + ob.r;
          const bdx = probe.x - ob.x;
          const bdy = probe.y - ob.y;
          if (bdx * bdx + bdy * bdy < hitD * hitD) return true;
        }
      }
      for (let i = 0; i < existingBodies.length; i++) {
        const b = existingBodies[i];
        if (b.merged) continue;
        const dx = b.x - probe.x;
        const dy = b.y - probe.y;
        const rs = b.boundR + probe.boundR;
        if (dx * dx + dy * dy > rs * rs) continue;
        if (testBodiesOverlap(probe, b)) return true;
      }
      return false;
    };

    if (hitsAt(startY)) return startY;

    // Coarse step downward to find first contact bracket (14px steps)
    let freeY = startY;
    let hitY = jar.floorY;
    let foundHit = false;
    for (let y = startY + 14; y <= jar.floorY; y += 14) {
      if (hitsAt(y)) {
        hitY = y;
        foundHit = true;
        break;
      }
      freeY = y;
    }

    if (!foundHit) {
      hitY = jar.floorY;
    }

    // Refine with 9 binary-search iterations (~0.03px accuracy!)
    let lo = freeY;
    let hi = hitY;
    for (let k = 0; k < 9; k++) {
      const mid = (lo + hi) * 0.5;
      if (hitsAt(mid)) hi = mid;
      else lo = mid;
    }
    return lo;
  }

  /**
   * Exact point-in-compound-polygon hit test for clicking treats with Fork / Spoon tools.
   */
  function pointInBody(body, px, py, pad = 4) {
    const dx = px - body.x;
    const dy = py - body.y;
    if (dx * dx + dy * dy > (body.boundR + pad) * (body.boundR + pad)) return false;

    const wps = body.worldPolys;
    for (let p = 0; p < wps.length; p++) {
      const verts = wps[p].verts;
      const norms = wps[p].normals;
      let inside = true;
      for (let i = 0; i < verts.length; i++) {
        const dist = (px - verts[i].x) * norms[i].x + (py - verts[i].y) * norms[i].y;
        if (dist > pad) {
          inside = false;
          break;
        }
      }
      if (inside) return true;
    }
    return false;
  }

  /**
   * Compute exact horizontal extents of a rotated shape so the drop guide stays neatly inside the jar rim.
   */
  function getRotatedHalfExtentsX(shapeDef, eqRadius, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let minX = Infinity;
    let maxX = -Infinity;
    for (const poly of shapeDef.polygons) {
      for (const [nx, ny] of poly) {
        const x = (nx * cos - ny * sin) * eqRadius;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    return { leftExtent: -minX, rightExtent: maxX };
  }

  /**
   * Forward-trace an angled slingshot/bank-shot launch inside the jar (with up to 1 glass wall reflection)
   * so players get a crisp dotted aiming arc and exact merge lock-on preview around corners.
   */
  function predictBankShotTrajectory(
    eqRadius,
    originX,
    originY,
    vx0,
    vy0,
    jar,
    existingBodies,
    gravity = 1880,
    gravityScale = 1.0,
    tier = 1,
    opts = {}
  ) {
    const r = eqRadius * 0.94;
    const minX = jar.left + r;
    const maxX = jar.right - r;
    const leftArcCx = jar.left + jar.cornerR;
    const rightArcCx = jar.right - jar.cornerR;
    const arcCy = jar.floorY - jar.cornerR;
    const wallRestBonus = typeof opts.wallRestBonus === 'number' ? opts.wallRestBonus : 0;
    const maxBounces = typeof opts.maxBounces === 'number' ? opts.maxBounces : 1;
    const obstacles = Array.isArray(opts.obstacles) ? opts.obstacles : [];
    const wallRest = Math.min(0.96, (tier === 2 ? 0.78 : 0.64) + wallRestBonus);

    const points = [{ x: originX, y: originY }];
    let x = originX;
    let y = originY;
    let vx = vx0;
    let vy = vy0;
    const bouncePoints = [];
    let hitBody = null;
    let glazeHit = null;
    let dividerBounced = false;
    const stepDt = 0.015;
    const maxSteps = maxBounces > 1 ? 62 : 50;

    const checkGlazeSegment = (x0, y0, x1, y1) => {
      if (glazeHit) return;
      for (let oi = 0; oi < obstacles.length; oi++) {
        const ob = obstacles[oi];
        if (!ob || ob.type !== 'glaze_ring') continue;
        const rx = ob.rx || 38;
        const ry = ob.ry || 13;
        const crossedY = (y0 <= ob.y && y1 >= ob.y) || (y0 >= ob.y && y1 <= ob.y);
        if (crossedY && Math.abs(y1 - y0) > 1e-4) {
          const gt = (ob.y - y0) / (y1 - y0);
          const crossX = x0 + (x1 - x0) * gt;
          if (Math.abs(crossX - ob.x) <= rx + r * 0.15) {
            glazeHit = { x: crossX, y: ob.y, ring: ob };
            return;
          }
        } else if (Math.abs(x1 - ob.x) <= rx && Math.abs(y1 - ob.y) <= ry) {
          glazeHit = { x: x1, y: ob.y, ring: ob };
          return;
        }
      }
    };

    for (let step = 0; step < maxSteps; step++) {
      const prevX = x;
      const prevY = y;
      vy += gravity * gravityScale * stepDt;
      vx *= 0.996;
      vy *= 0.996;
      const nx = x + vx * stepDt;
      const ny = y + vy * stepDt;

      // Side-wall reflection (up to maxBounces bank-shot bounces)
      if (nx < minX) {
        const t = vx !== 0 ? Math.max(0, Math.min(1, (minX - x) / (nx - x))) : 0;
        const by = y + (ny - y) * t;
        checkGlazeSegment(prevX, prevY, minX, by);
        x = minX + 0.5;
        y = by;
        if (bouncePoints.length < maxBounces && by < arcCy) {
          bouncePoints.push({ x: minX, y: by });
          points.push({ x: minX, y: by });
          vx = Math.abs(vx) * wallRest;
          vy *= 0.92;
          continue;
        } else {
          points.push({ x: minX, y: by });
          break;
        }
      } else if (nx > maxX) {
        const t = vx !== 0 ? Math.max(0, Math.min(1, (maxX - x) / (nx - x))) : 0;
        const by = y + (ny - y) * t;
        checkGlazeSegment(prevX, prevY, maxX, by);
        x = maxX - 0.5;
        y = by;
        if (bouncePoints.length < maxBounces && by < arcCy) {
          bouncePoints.push({ x: maxX, y: by });
          points.push({ x: maxX, y: by });
          vx = -Math.abs(vx) * wallRest;
          vy *= 0.92;
          continue;
        } else {
          points.push({ x: maxX, y: by });
          break;
        }
      }

      x = nx;
      y = ny;
      checkGlazeSegment(prevX, prevY, x, y);

      // Obstacles in preview (Butter Bumper + Wooden Divider)
      let stopOnDivider = false;
      for (let oi = 0; oi < obstacles.length; oi++) {
        const ob = obstacles[oi];
        if (!ob) continue;
        if (ob.type === 'bumper') {
          const bdx = x - ob.x;
          const bdy = y - ob.y;
          const hitD = r + ob.r;
          if (bdx * bdx + bdy * bdy <= hitD * hitD) {
            const d = Math.hypot(bdx, bdy) || 1;
            const bnx = bdx / d;
            const bny = bdy / d;
            x = ob.x + bnx * (hitD + 1);
            y = ob.y + bny * (hitD + 1);
            const vn = vx * bnx + vy * bny;
            if (vn < 0) {
              const e = ob.restitution || 1.15;
              vx -= (1 + e) * vn * bnx;
              vy -= (1 + e) * vn * bny;
              const spd = Math.hypot(vx, vy);
              if (spd > 920) {
                vx = (vx / spd) * 920;
                vy = (vy / spd) * 920;
              }
            }
            points.push({ x, y });
          }
        } else if (ob.type === 'divider') {
          const halfW = typeof ob.halfW === 'number' ? ob.halfW : (ob.w || 14) * 0.5;
          const capY = typeof ob.capY === 'number' ? ob.capY : ob.topY + halfW;
          const hitD = r + halfW;

          // Catch segment crossing of divider centerline below capY
          if ((prevX - ob.x) * (x - ob.x) <= 0 && Math.abs(x - prevX) > 1e-4) {
            const t = (ob.x - prevX) / (x - prevX);
            const cyCross = prevY + (y - prevY) * t;
            if (cyCross >= capY - r * 0.5) {
              const side = prevX < ob.x ? -1 : 1;
              x = ob.x + side * (hitD + 0.5);
              y = cyCross;
              points.push({ x, y });
              if (!dividerBounced) {
                dividerBounced = true;
                vx = side * Math.abs(vx) * 0.35;
                vy *= 0.86;
              } else {
                stopOnDivider = true;
                break;
              }
              continue;
            }
          }

          // Closest point on vertical capsule centerline (ob.x, capY..bottomY)
          const cy = Math.max(capY, Math.min(ob.bottomY, y));
          const ddx = x - ob.x;
          const ddy = y - cy;
          if (ddx * ddx + ddy * ddy <= hitD * hitD) {
            const dist = Math.hypot(ddx, ddy);
            const dnx = dist > 1e-4 ? ddx / dist : prevX < ob.x ? -1 : 1;
            const dny = dist > 1e-4 ? ddy / dist : 0;
            x = ob.x + dnx * (hitD + 0.6);
            y = cy + dny * (hitD + 0.6);
            points.push({ x, y });
            const vn = vx * dnx + vy * dny;
            if (!dividerBounced && vn < 0) {
              dividerBounced = true;
              vx -= 1.35 * vn * dnx;
              vy -= 1.35 * vn * dny;
            } else {
              stopOnDivider = true;
              break;
            }
          }
        }
      }
      if (stopOnDivider) break;

      // Curved bottom corners & floor check
      if (y > arcCy && (x < leftArcCx || x > rightArcCx)) {
        const cx = x < leftArcCx ? leftArcCx : rightArcCx;
        const dx = x - cx;
        const dy = y - arcCy;
        const dist = Math.hypot(dx, dy);
        if (dist >= jar.cornerR - r) {
          const clampDist = Math.max(1, jar.cornerR - r);
          x = cx + (dx / (dist || 1)) * clampDist;
          y = arcCy + (dy / (dist || 1)) * clampDist;
          points.push({ x, y });
          break;
        }
      }
      if (y >= jar.floorY - r) {
        y = jar.floorY - r;
        points.push({ x, y });
        break;
      }

      // Existing bodies hit test
      let collided = false;
      for (let i = 0; i < existingBodies.length; i++) {
        const b = existingBodies[i];
        if (b.merged) continue;
        const dx = x - b.x;
        const dy = y - b.y;
        const hitDist = b.r + eqRadius * 0.94;
        if (dx * dx + dy * dy <= hitDist * hitDist) {
          const d = Math.hypot(dx, dy) || 1;
          x = b.x + (dx / d) * hitDist;
          y = b.y + (dy / d) * hitDist;
          hitBody = b;
          collided = true;
          break;
        }
      }

      points.push({ x, y });
      if (collided) break;
    }

    const last = points[points.length - 1];
    return {
      points,
      bouncePoint: bouncePoints[0] || null,
      bouncePoints,
      endX: last.x,
      endY: last.y,
      hitBody,
      glazeHit
    };
  }

  /**
   * Check whether the jar neck spawn spot is clear enough for an immediate follow-up launch
   * (replaces the sluggish full-fall waitingForLanding lock).
   */
  function isSpawnClear(dropX, dropY, r, existingBodies) {
    for (let i = 0; i < existingBodies.length; i++) {
      const b = existingBodies[i];
      if (b.merged) continue;
      if (b.y > dropY + r + b.r + 6) continue;
      const dx = b.x - dropX;
      const dy = b.y - dropY;
      const minDist = (b.r + r) * 0.88;
      if (dx * dx + dy * dy < minDist * minDist) return false;
    }
    return true;
  }

module.exports = {
  configureBodyShape,
  updateBodyWorld,
  ensureDividerStaticBody,
  clampBodyInsideJarPositional,
  stepWorld,
  predictDropLandingY,
  predictBankShotTrajectory,
  isSpawnClear,
  pointInBody,
  getRotatedHalfExtentsX
};
