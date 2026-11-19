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
(() => {
  'use strict';

  const STATIC_JAR = {
    id: 0,
    isStatic: true,
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
    body.r = eqRadius;
    body.shapeDef = shapeDef;
    body.boundR = shapeDef.bound_r_norm * eqRadius;
    body.mass = eqRadius * eqRadius;
    body.invMass = 1 / body.mass;
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

  function collideBodyWithJar(body, jar, contactsOut) {
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
    const e = Math.max(body.restitution, STATIC_JAR.restitution);
    for (let i = 0; i < kept.length; i++) {
      const c = kept[i];
      contactsOut.push({
        a: STATIC_JAR,
        b: body,
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

  function clampBodyInsideJarPositional(body, jar) {
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
    }
    updateBodyWorld(body);
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

  function solvePositions(contacts, jar, bodies) {
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
        clampBodyInsideJarPositional(bodies[i], jar);
      }
    }
  }

  /**
   * Step the rigid-body world forward by `dt` seconds.
   * Order: Semi-implicit Euler (integrate forces -> tentative step -> detect contacts ->
   * PGS sequential impulse velocity solver -> positional stabilization).
   * Returns { mergePairs, impacts, debugContacts }.
   */
  function stepWorld(bodies, jar, dt, gravity = 1180) {
    const SUBSTEPS = 3;
    const VELOCITY_ITERS = 10;
    const subDt = dt / SUBSTEPS;

    const mergePairs = [];
    const impacts = [];
    let lastContacts = [];

    for (let s = 0; s < SUBSTEPS; s++) {
      // 1. Integrate gravity into velocities & advance tentative positions/angles
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.merged) continue;
        b.vy += gravity * subDt;
        b.vx *= 0.9975;
        b.vy *= 0.9975;
        b.vr *= 0.992;

        if (b.vr > 10) b.vr = 10;
        else if (b.vr < -10) b.vr = -10;

        b.x += b.vx * subDt;
        b.y += b.vy * subDt;
        b.angle += b.vr * subDt;
        b.inContact = false;
      }

      // 2. Update world polygons & generate all contact manifolds
      for (let i = 0; i < bodies.length; i++) {
        if (!bodies[i].merged) updateBodyWorld(bodies[i]);
      }

      const contacts = [];
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.merged) continue;

        if (collideBodyWithJar(a, jar, contacts)) {
          a.inContact = true;
        }

        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j];
          if (b.merged) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const rs = a.boundR + b.boundR + 1;
          if (dx * dx + dy * dy > rs * rs) continue;

          if (a.tier === b.tier) {
            if (testBodiesOverlap(a, b)) {
              a.merged = true;
              b.merged = true;
              mergePairs.push([a, b]);
            }
            continue;
          }

          if (collideBodyPair(a, b, contacts)) {
            a.inContact = true;
            b.inContact = true;
          }
        }
      }

      // 3. Sequential Impulse Velocity Solver (normal + Coulomb friction + angular torque)
      preStepContacts(contacts);
      solveVelocityContacts(contacts, VELOCITY_ITERS);

      // 4. Collect strong impact telemetry
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
        }
      }

      // 5. Calm resting micro-damping for settled pastries
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b.merged || !b.inContact) continue;
        const linSpdSq = b.vx * b.vx + b.vy * b.vy;
        const angSpd = Math.abs(b.vr);
        if (linSpdSq < 180 && angSpd < 0.45) {
          b.vx *= 0.88;
          b.vy *= 0.88;
          b.vr *= 0.82;
          if (linSpdSq < 14 && angSpd < 0.08) {
            b.vx *= 0.5;
            b.vy *= 0.5;
            b.vr *= 0.4;
          }
        }
      }

      // 6. Positional stabilization (split from velocity)
      solvePositions(contacts, jar, bodies);

      if (s === SUBSTEPS - 1) {
        lastContacts = contacts;
      }
    }

    return {
      mergePairs,
      impacts,
      debugContacts: lastContacts
    };
  }

  /**
   * Exact polygon drop-sweep predictor: returns the highest resting Y where a
   * candidate shape dropped vertically at `(dropX, dropY, angle)` first contacts
   * either the curved glass jar or any existing pastry's exact polygon silhouette.
   */
  function predictDropLandingY(shapeDef, eqRadius, dropX, startY, angle, jar, existingBodies) {
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

    const hitsAt = (testY) => {
      probe.y = testY;
      updateBodyWorld(probe);
      if (bodyTouchesJar(probe, jar)) return true;
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

  window.StarlightPhysics = {
    configureBodyShape,
    updateBodyWorld,
    clampBodyInsideJarPositional,
    stepWorld,
    predictDropLandingY,
    pointInBody,
    getRotatedHalfExtentsX
  };
})();
