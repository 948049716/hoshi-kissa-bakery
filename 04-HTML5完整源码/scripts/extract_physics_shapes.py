#!/usr/bin/env python3
"""
Extract exact, faithful compound convex polygon collision meshes, true center of mass,
and normalized polar moment of inertia directly from the alpha masks of tier_1..tier_9.png.
Outputs assets/processed/physics_shapes.json and a visual verification sheet.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

SCRIPT_DIR = Path(__file__).resolve().parent
SRC_ROOT = SCRIPT_DIR.parent
REPO_ROOT = SRC_ROOT.parent
PROC_DIR = SRC_ROOT / "assets/processed"
PNG_DIR = REPO_ROOT / "02-游戏素材-精修透明PNG"


def cross2(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def convex_hull(points):
    """Monotone chain convex hull returning vertices in CCW order (screen coords: +y down -> area < 0 or > 0)."""
    pts = sorted(set((float(p[0]), float(p[1])) for p in points))
    if len(pts) <= 2:
        return pts
    lower = []
    for p in pts:
        while len(lower) >= 2 and cross2(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(pts):
        while len(upper) >= 2 and cross2(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def simplify_convex_polygon(hull, max_verts=10, protect_bottom_y=None):
    """
    Simplify a convex polygon to at most `max_verts` vertices by iteratively
    removing the vertex that adds the least area (smallest triangle with neighbors),
    preserving flat bottoms and prominent corners faithfully.
    """
    pts = list(hull)
    if len(pts) <= max_verts:
        return pts

    def tri_area(a, b, c):
        return abs(cross2(a, b, c)) * 0.5

    while len(pts) > max_verts:
        n = len(pts)
        best_i = 0
        best_loss = float("inf")
        for i in range(n):
            a = pts[(i - 1) % n]
            b = pts[i]
            c = pts[(i + 1) % n]
            loss = tri_area(a, b, c)
            # Protect the two endpoint corners of an intentional flat resting base
            if protect_bottom_y is not None and b[1] >= protect_bottom_y - 1.5:
                loss += 1e9
            if loss < best_loss:
                best_loss = loss
                best_i = i
        pts.pop(best_i)
    return pts


def ensure_ccw_math(poly):
    """
    Ensure polygon has positive signed area in standard screen coords (x right, y down):
    sum(x_i * y_{i+1} - x_{i+1} * y_i) > 0 means clockwise visually (right-hand normal outward = (dy, -dx)).
    We standardize ALL polygons to signed_area > 0 so outward edge normal of edge (p0 -> p1)
    is ALWAYS normalize(dy, -dx) in screen coords!
    """
    area2 = 0.0
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        area2 += x0 * y1 - x1 * y0
    if area2 < 0:
        poly = list(reversed(poly))
    return poly


def hull_from_mask(mask: np.ndarray, max_verts: int = 10, expand_px: float = 0.0, flat_bottom_ratio: float = 0.0):
    """Compute simplified convex hull of all True pixels in boolean 2D mask."""
    ys, xs = np.where(mask)
    if len(xs) < 12:
        return None

    protect_bottom_y = None
    work_mask = mask
    if flat_bottom_ratio > 0.0:
        h = mask.shape[0]
        y_max = int(ys.max())
        y_cut = int(round(y_max - h * flat_bottom_ratio))
        yy = np.arange(h)[:, None]
        clipped = mask & (yy <= y_cut)
        if np.count_nonzero(clipped) >= 12:
            work_mask = clipped
            protect_bottom_y = float(y_cut)

    # Subsample boundary pixels only for speed
    padded = np.pad(work_mask, 1, mode="constant", constant_values=False)
    interior = (
        padded[:-2, 1:-1]
        & padded[2:, 1:-1]
        & padded[1:-1, :-2]
        & padded[1:-1, 2:]
    )
    boundary = work_mask & (~interior)
    bys, bxs = np.where(boundary)
    pts = list(zip(bxs.tolist(), bys.tolist()))
    hull = convex_hull(pts)
    hull = simplify_convex_polygon(hull, max_verts=max_verts, protect_bottom_y=protect_bottom_y)
    hull = ensure_ccw_math(hull)

    if expand_px != 0.0 and len(hull) >= 3:
        cx = sum(p[0] for p in hull) / len(hull)
        cy = sum(p[1] for p in hull) / len(hull)
        out = []
        for x, y in hull:
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy) or 1.0
            out.append((x + dx / d * expand_px, y + dy / d * expand_px))
        hull = out
    return hull


def decompose_sprite_polygons(mask: np.ndarray, tier: int):
    """
    Decompose each dessert sprite's exact alpha mask into tight, anatomically faithful
    convex polygons so concave details (leaf, cream swirl, cat ears, lemon wedge,
    strawberry crown, angel wings, flat tart/macaron/soufflé bottoms) collide accurately
    with zero air-gap artifacts!
    """
    h, w = mask.shape
    yy, xx = np.mgrid[0:h, 0:w]
    polys = []

    if tier == 1:
        # Blueberry Dewdrop: round berry body (y >= 0.12h, or x <= 0.62w) + tight protruding leaf
        leaf_mask = mask & (yy <= h * 0.23) & (xx >= w * 0.59)
        berry_mask = mask & ~((yy < h * 0.18) & (xx > w * 0.63))
        p_berry = hull_from_mask(berry_mask, max_verts=14)
        p_leaf = hull_from_mask(leaf_mask, max_verts=6)
        if p_berry:
            polys.append(p_berry)
        if p_leaf:
            polys.append(p_leaf)

    elif tier == 2:
        # Peach Cream Puff: round choux body + narrow whipped cream swirl peak on top
        body_mask = mask & (yy >= h * 0.24)
        swirl_mask = mask & (yy <= h * 0.31) & (xx >= w * 0.26) & (xx <= w * 0.74)
        p_body = hull_from_mask(body_mask, max_verts=13, flat_bottom_ratio=0.018)
        p_swirl = hull_from_mask(swirl_mask, max_verts=7)
        if p_body:
            polys.append(p_body)
        if p_swirl:
            polys.append(p_swirl)

    elif tier == 3:
        # Matcha Kitty Dango: plump cat-head mochi + distinct left & right cat ears (preserves ear valley!)
        body_mask = mask & (yy >= h * 0.17)
        ear_l_mask = mask & (yy <= h * 0.34) & (xx <= w * 0.36)
        ear_r_mask = mask & (yy <= h * 0.34) & (xx >= w * 0.64)
        p_body = hull_from_mask(body_mask, max_verts=12, flat_bottom_ratio=0.026)
        p_el = hull_from_mask(ear_l_mask, max_verts=6)
        p_er = hull_from_mask(ear_r_mask, max_verts=6)
        for p in (p_body, p_el, p_er):
            if p:
                polys.append(p)

    elif tier == 4:
        # Lemon Honey Tart: flat-bottomed trapezoidal tart shell + sticking-out lemon wedge on top-right
        cup_mask = mask & (yy >= h * 0.12)
        wedge_mask = mask & (yy <= h * 0.24) & (xx >= w * 0.48) & (xx <= w * 0.78)
        p_cup = hull_from_mask(cup_mask, max_verts=12, flat_bottom_ratio=0.036)
        p_wedge = hull_from_mask(wedge_mask, max_verts=5)
        for p in (p_cup, p_wedge):
            if p:
                polys.append(p)

    elif tier == 5:
        # Strawberry Daifuku: wide flat-bottomed mochi body + narrower strawberry peak on top
        mochi_mask = mask & (yy >= h * 0.27)
        berry_mask = mask & (yy <= h * 0.33) & (xx >= w * 0.30) & (xx <= w * 0.70)
        p_mochi = hull_from_mask(mochi_mask, max_verts=13, flat_bottom_ratio=0.028)
        p_berry = hull_from_mask(berry_mask, max_verts=7)
        for p in (p_mochi, p_berry):
            if p:
                polys.append(p)

    elif tier == 6:
        # Caramel Star Donut: smooth slightly-oval cushion
        p_donut = hull_from_mask(mask, max_verts=14)
        if p_donut:
            polys.append(p_donut)

    elif tier == 7:
        # Cosmic Kitty Macaron: wide flat-bottomed & flat-topped macaron pill
        p_mac = hull_from_mask(mask, max_verts=14, flat_bottom_ratio=0.024)
        if p_mac:
            polys.append(p_mac)

    elif tier == 8:
        # Royal Mont Blanc: flat tart base + tapered swirled chestnut dome
        p_mb = hull_from_mask(mask, max_verts=14, flat_bottom_ratio=0.034)
        if p_mb:
            polys.append(p_mb)

    elif tier == 9:
        # Crown Cat Soufflé: full plump cake body + cat ears + jeweled crown + left & right angel wings
        cake_mask = mask & (
            ((yy >= h * 0.40) & (xx >= w * 0.11) & (xx <= w * 0.89))
            | ((yy >= h * 0.24) & (yy < h * 0.40) & (xx >= w * 0.17) & (xx <= w * 0.83))
        )
        ear_l_mask = mask & (xx >= w * 0.21) & (xx <= w * 0.40) & (yy >= h * 0.14) & (yy <= h * 0.34)
        ear_r_mask = mask & (xx >= w * 0.60) & (xx <= w * 0.79) & (yy >= h * 0.14) & (yy <= h * 0.34)
        crown_mask = mask & (xx >= w * 0.36) & (xx <= w * 0.64) & (yy <= h * 0.31)
        wing_l_mask = mask & (xx <= w * 0.22) & (yy <= h * 0.43)
        wing_r_mask = mask & (xx >= w * 0.78) & (yy <= h * 0.43)
        for m, mv, fbr in (
            (cake_mask, 12, 0.030),
            (crown_mask, 6, 0.0),
            (ear_l_mask, 5, 0.0),
            (ear_r_mask, 5, 0.0),
            (wing_l_mask, 6, 0.0),
            (wing_r_mask, 6, 0.0),
        ):
            p = hull_from_mask(m, max_verts=mv, flat_bottom_ratio=fbr)
            if p:
                polys.append(p)

    return polys


def compute_mask_inertial_props(mask: np.ndarray, tier: int):
    """
    Compute exact pixel-mask Center of Mass (cx, cy), equivalent radius (sqrt(area/pi)),
    and normalized polar moment of inertia factor k = I / (m * r_eq^2).
    """
    ys, xs = np.where(mask)
    area = float(len(xs))
    cx = float(xs.mean())
    cy = float(ys.mean())
    # Slightly lower COM for flat-bottomed pastries (like real heavier custard/cake bases!)
    if tier in (4, 5, 8, 9):
        cy += mask.shape[0] * 0.03
    r_eq = math.sqrt(area / math.pi)
    r2_mean = float(np.mean((xs - cx) ** 2 + (ys - cy) ** 2))
    # Dimensionless inertia factor relative to r_eq^2 (a uniform disk has k = 0.5)
    inertia_k = r2_mean / (r_eq * r_eq)
    return cx, cy, r_eq, inertia_k


def main():
    shapes_data = {}
    verify = Image.new("RGBA", (960, 960), (18, 24, 38, 255))
    draw = ImageDraw.Draw(verify)
    poly_colors = [
        (72, 238, 255, 235),  # cyan: main body
        (255, 212, 74, 235),  # gold: sub-piece 1
        (255, 130, 170, 235), # pink: sub-piece 2
        (135, 255, 145, 235), # mint: sub-piece 3
    ]

    for tier in range(1, 10):
        img = Image.open(PNG_DIR / f"tier_{tier}.png").convert("RGBA")
        w, h = img.size
        alpha = np.array(img)[:, :, 3]
        mask = alpha > 128

        cx, cy, r_eq, inertia_k = compute_mask_inertial_props(mask, tier)
        polys_px = decompose_sprite_polygons(mask, tier)

        # Normalize polygon vertices relative to Center of Mass (cx, cy) and divided by r_eq!
        # That way, at runtime for any desired physical equivalent radius `R`,
        # world vertex = entity.pos + rotate(v_norm * R, entity.angle)
        # and sprite draw scale is simply `R / r_eq` with sprite origin at `(-cx * scale, -cy * scale)`!
        polys_norm = []
        max_bound_norm = 0.0
        for p in polys_px:
            pn = []
            for vx, vy in p:
                nx = (vx - cx) / r_eq
                ny = (vy - cy) / r_eq
                max_bound_norm = max(max_bound_norm, math.hypot(nx, ny))
                pn.append([round(nx, 4), round(ny, 4)])
            polys_norm.append(pn)

        # Also compute local bounding box of normalized vertices for drop-X wall clamping
        all_nx = [v[0] for p in polys_norm for v in p]
        all_ny = [v[1] for p in polys_norm for v in p]

        shapes_data[f"tier_{tier}"] = {
            "width": w,
            "height": h,
            "com_x": round(cx, 2),
            "com_y": round(cy, 2),
            "r_eq_px": round(r_eq, 2),
            "inertia_k": round(inertia_k, 4),
            "bound_r_norm": round(max_bound_norm, 4),
            "min_x_norm": round(min(all_nx), 4),
            "max_x_norm": round(max(all_nx), 4),
            "min_y_norm": round(min(all_ny), 4),
            "max_y_norm": round(max(all_ny), 4),
            "polygons": polys_norm,
        }

        # Render onto verification canvas at scale such that r_eq -> 92px
        gx = ((tier - 1) % 3) * 320 + 160
        gy = ((tier - 1) // 3) * 320 + 160
        r_vis = 92.0
        scale = r_vis / r_eq
        sw = int(round(w * scale))
        sh = int(round(h * scale))
        spr_s = img.resize((sw, sh), Image.Resampling.LANCZOS)
        ox = int(round(gx - cx * scale))
        oy = int(round(gy - cy * scale))
        verify.alpha_composite(spr_s, (ox, oy))

        for pi, pn in enumerate(polys_norm):
            col = poly_colors[pi % len(poly_colors)]
            pts = [(gx + v[0] * r_vis, gy + v[1] * r_vis) for v in pn]
            pts_closed = pts + [pts[0]]
            draw.line(pts_closed, fill=col, width=2)
            for px, py in pts:
                draw.ellipse([px - 2.5, py - 2.5, px + 2.5, py + 2.5], fill=col)

        # Draw Center of Mass crosshair in bright red/white
        draw.ellipse([gx - 4, gy - 4, gx + 4, gy + 4], fill=(255, 70, 70, 255), outline=(255, 255, 255, 255))
        draw.text(
            (gx - 145, gy - 145),
            f"T{tier} ({len(polys_norm)} poly, {sum(len(p) for p in polys_norm)}v)",
            fill=(255, 228, 160, 255),
        )

    # Also extract Plan B Mischief Yarn Ball rigid-body collider (core yarn sphere, excluding thin loose yarn tail)
    yarn_png = PNG_DIR / "event_yarn_ball.png"
    if yarn_png.exists():
        y_img = Image.open(yarn_png).convert("RGBA")
        yw, yh = y_img.size
        y_mask = np.array(y_img)[:, :, 3] > 128
        yy, xx = np.mgrid[0:yh, 0:yw]
        # Exclude bottom-left decorative thin yarn tail so the collider tightly hugs the round yarn sphere
        core_mask = y_mask & ~((xx < yw * 0.33) & (yy > yh * 0.65)) & ~(xx < yw * 0.17)
        cx, cy, r_eq, inertia_k = compute_mask_inertial_props(core_mask, 0)
        p_yarn = hull_from_mask(core_mask, max_verts=14)
        polys_norm = []
        max_bound_norm = 0.0
        if p_yarn:
            pn = []
            for vx, vy in p_yarn:
                nx = (vx - cx) / r_eq
                ny = (vy - cy) / r_eq
                max_bound_norm = max(max_bound_norm, math.hypot(nx, ny))
                pn.append([round(nx, 4), round(ny, 4)])
            polys_norm.append(pn)
        all_nx = [v[0] for p in polys_norm for v in p]
        all_ny = [v[1] for p in polys_norm for v in p]
        shapes_data["event_yarn_ball"] = {
            "width": yw,
            "height": yh,
            "com_x": round(cx, 2),
            "com_y": round(cy, 2),
            "r_eq_px": round(r_eq, 2),
            "inertia_k": round(inertia_k, 4),
            "bound_r_norm": round(max_bound_norm, 4),
            "min_x_norm": round(min(all_nx), 4),
            "max_x_norm": round(max(all_nx), 4),
            "min_y_norm": round(min(all_ny), 4),
            "max_y_norm": round(max(all_ny), 4),
            "polygons": polys_norm,
        }

        # Visual check image for yarn ball collider
        yv = Image.new("RGBA", (320, 320), (18, 24, 38, 255))
        yd = ImageDraw.Draw(yv)
        r_vis = 96.0
        sc = r_vis / r_eq
        ys = y_img.resize((int(round(yw * sc)), int(round(yh * sc))), Image.Resampling.LANCZOS)
        yv.alpha_composite(ys, (int(round(160 - cx * sc)), int(round(160 - cy * sc))))
        for pn in polys_norm:
            pts = [(160 + v[0] * r_vis, 160 + v[1] * r_vis) for v in pn]
            yd.line(pts + [pts[0]], fill=(72, 238, 255, 240), width=2)
            for px, py in pts:
                yd.ellipse([px - 2.5, py - 2.5, px + 2.5, py + 2.5], fill=(255, 212, 74, 240))
        yd.ellipse([156, 156, 164, 164], fill=(255, 70, 70, 255), outline=(255, 255, 255, 255))
        yv.convert("RGB").save("/tmp/verify_yarn_mesh.jpg", quality=94)

    out_json = PROC_DIR / "physics_shapes.json"
    out_json.write_text(json.dumps(shapes_data, indent=2), encoding="utf-8")
    (PNG_DIR / "physics_shapes.json").write_text(json.dumps(shapes_data, indent=2), encoding="utf-8")
    out_js = SRC_ROOT / "physics_shapes.js"
    out_js.write_text(
        "// Auto-generated from sprite alpha contours by scripts/extract_physics_shapes.py\n"
        "window.HOSHI_PHYSICS_SHAPES = " + json.dumps(shapes_data, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    verify.convert("RGB").save("/tmp/verify_physics_meshes.jpg", quality=94)
    print(f"Generated {out_json}, {out_js}, and /tmp/verify_physics_meshes.jpg (shapes: {list(shapes_data.keys())})")


if __name__ == "__main__":
    main()
