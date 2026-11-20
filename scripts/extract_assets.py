#!/usr/bin/env python3
"""
Extract and post-process game sprites, tool medallions, mascot portrait,
and seamless bakery room backdrop from generated artwork.
"""
import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
PNG_DIR = REPO_ROOT / "02-游戏素材-精修透明PNG"
RAW_DIR = REPO_ROOT / "03-游戏素材-原始原图与WebP"
OUT_DIR = PNG_DIR
ART_DIR = RAW_DIR
OUT_DIR.mkdir(parents=True, exist_ok=True)
PNG_DIR.mkdir(parents=True, exist_ok=True)
RAW_DIR.mkdir(parents=True, exist_ok=True)


def keep_largest_component(rgba: np.ndarray, alpha_thresh: int = 24) -> np.ndarray:
    mask = rgba[:, :, 3] > alpha_thresh
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    cur_label = 0
    best_label = 0
    best_size = 0

    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and labels[sy, sx] == 0:
                cur_label += 1
                q = deque([(sy, sx)])
                labels[sy, sx] = cur_label
                cnt = 0
                while q:
                    cy, cx = q.popleft()
                    cnt += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            if dy == 0 and dx == 0:
                                continue
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and labels[ny, nx] == 0:
                                labels[ny, nx] = cur_label
                                q.append((ny, nx))
                if cnt > best_size:
                    best_size = cnt
                    best_label = cur_label

    out = rgba.copy()
    if best_label > 0:
        out[labels != best_label, 3] = 0
    return out


def floodfill_remove_bg(
    rgb: np.ndarray,
    bg_dist_thresh: float = 32.0,
    decontam_thresh: float = 115.0,
    keep_main_only: bool = False,
    adaptive_parchment: bool = False,
) -> Image.Image:
    h, w, _ = rgb.shape
    arr = rgb.astype(np.float32)

    if adaptive_parchment:
        # Sample pure top-left / top-right parchment color
        bg_color = np.median(
            np.vstack([arr[4:14, 4:14].reshape(-1, 3), arr[4:14, w - 14 : w - 4].reshape(-1, 3)]),
            axis=0,
        )
    else:
        corners = np.array(
            [
                arr[0:6, 0:6].mean(axis=(0, 1)),
                arr[0:6, w - 6 : w].mean(axis=(0, 1)),
                arr[h - 6 : h, 0:6].mean(axis=(0, 1)),
                arr[h - 6 : h, w - 6 : w].mean(axis=(0, 1)),
            ]
        )
        bg_color = np.median(corners, axis=0)

    dist = np.linalg.norm(arr - bg_color[None, None, :], axis=2)

    if adaptive_parchment:
        # Cream parchment has bright luminance (>165) and warm cream saturation;
        # dark outlines are <130 luma, and cat orange/black/teal is darker or rich saturated.
        luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        sat = arr.max(axis=2) - arr.min(axis=2)
        is_bg_candidate = (luma > 168.0) & (sat < 85.0) & (dist < 115.0)
    else:
        is_bg_candidate = dist < bg_dist_thresh

    visited = np.zeros((h, w), dtype=bool)
    q = deque()

    for x in range(w):
        for y in (0, h - 1):
            if is_bg_candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg_candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if is_bg_candidate[ny, nx]:
                    visited[ny, nx] = True
                    q.append((ny, nx))

    alpha = (~visited).astype(np.float32) * 255.0
    bg_mask = visited
    padded = np.pad(bg_mask, 1, mode="constant", constant_values=True)
    adj_bg = (
        padded[:-2, 1:-1]
        | padded[2:, 1:-1]
        | padded[1:-1, :-2]
        | padded[1:-1, 2:]
        | padded[:-2, :-2]
        | padded[:-2, 2:]
        | padded[2:, :-2]
        | padded[2:, 2:]
    )
    edge_fg = (~bg_mask) & adj_bg

    padded2 = np.pad(edge_fg | bg_mask, 1, mode="constant", constant_values=True)
    adj_edge = (
        padded2[:-2, 1:-1]
        | padded2[2:, 1:-1]
        | padded2[1:-1, :-2]
        | padded2[1:-1, 2:]
    )
    ring2 = (~bg_mask) & (~edge_fg) & adj_edge

    for y, x in zip(*np.where(edge_fg)):
        d = dist[y, x]
        if d < decontam_thresh:
            a = np.clip((d - bg_dist_thresh * 0.45) / (decontam_thresh - bg_dist_thresh * 0.45), 0.12, 1.0)
            alpha[y, x] = a * 255.0
            arr[y, x] = np.clip((arr[y, x] - (1.0 - a) * bg_color) / max(a, 0.25), 0, 255)

    for y, x in zip(*np.where(ring2)):
        d = dist[y, x]
        if d < decontam_thresh * 0.72:
            a = np.clip(d / (decontam_thresh * 0.72), 0.55, 1.0)
            alpha[y, x] = min(alpha[y, x], a * 255.0)
            arr[y, x] = np.clip((arr[y, x] - (1.0 - a) * bg_color) / max(a, 0.45), 0, 255)

    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode="L")
    alpha_blur = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.55))
    a_np = np.array(alpha_blur, dtype=np.float32)
    interior = (~bg_mask) & (~edge_fg) & (~ring2)
    a_np[interior] = 255.0
    a_np[bg_mask] = 0.0

    rgba = np.dstack([np.clip(arr, 0, 255).astype(np.uint8), a_np.astype(np.uint8)])
    if keep_main_only:
        rgba = keep_largest_component(rgba)
    return Image.fromarray(rgba, mode="RGBA")


def trim_and_measure_core(img: Image.Image, tier_idx: int) -> tuple[Image.Image, dict]:
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    w, h = img.size
    a = np.array(img)[:, :, 3] > 128

    row_widths = []
    for y in range(h):
        cols = np.where(a[y])[0]
        if len(cols) > 0:
            row_widths.append((y, cols[0], cols[-1], cols[-1] - cols[0] + 1))

    max_w = max(r[3] for r in row_widths) if row_widths else w

    if tier_idx == 9:
        core_spans = []
        for y in range(int(h * 0.34), int(h * 0.94)):
            row = a[y]
            runs = []
            in_r = False
            s = 0
            for x in range(w):
                if row[x] and not in_r:
                    in_r = True; s = x
                elif not row[x] and in_r:
                    runs.append((s, x - 1)); in_r = False
            if in_r:
                runs.append((s, w - 1))
            if runs:
                longest = max(runs, key=lambda t: t[1] - t[0])
                core_spans.append((y, longest[0], longest[1], longest[1] - longest[0] + 1))
        core_w = np.percentile([c[3] for c in core_spans], 90)
        core_cx = np.median([(c[1] + c[2]) / 2.0 for c in core_spans])
        core_top = h * 0.25
        core_bot = h * 0.985
        core_cy = (core_top + core_bot) / 2.0 - h * 0.015
        core_r = max(core_w * 0.495, (core_bot - core_top) * 0.47)
    elif tier_idx == 4:
        body_rows = [r for r in row_widths if r[3] >= 0.55 * max_w]
        core_cx = np.median([(r[1] + r[2]) / 2.0 for r in body_rows])
        core_bot = max(r[0] for r in row_widths)
        body_top = min(r[0] for r in body_rows)
        est_top = max(0, body_top - max_w * 0.04)
        body_h = core_bot - est_top
        core_r = (max_w * 0.48 + body_h * 0.52) * 0.49
        core_cy = core_bot - core_r * 0.97
    else:
        body_rows = [r for r in row_widths if r[3] >= 0.55 * max_w]
        core_cx = np.median([(r[1] + r[2]) / 2.0 for r in body_rows])
        core_bot = max(r[0] for r in row_widths)
        body_top = min(r[0] for r in body_rows)
        est_top = max(0, body_top - max_w * 0.08)
        body_h = core_bot - est_top
        core_r = (max_w * 0.5 + body_h * 0.5) * 0.495
        core_cy = core_bot - core_r

    meta = {
        "width": int(w),
        "height": int(h),
        "anchor_x_norm": float(core_cx / w),
        "anchor_y_norm": float(core_cy / h),
        "radius_norm_w": float(core_r / w),
        "radius_norm_h": float(core_r / h),
    }
    return img, meta


def extract_desserts():
    src = ART_DIR / "dessert_sprites_sheet_1795019360243.jpg"
    img = Image.open(src).convert("RGB")
    img.save(RAW_DIR / "dessert_sprites_sheet.jpg")

    y_splits = [0, 344, 677, 1024]
    x_splits = [0, 350, 662, 1024]

    metadata = {}
    extracted = []
    idx = 1
    for r in range(3):
        for c in range(3):
            cell = img.crop((x_splits[c], y_splits[r], x_splits[c + 1], y_splits[r + 1]))
            rgba = floodfill_remove_bg(np.array(cell), bg_dist_thresh=32.0, keep_main_only=True)
            trimmed, meta = trim_and_measure_core(rgba, idx)

            scale = min(1.0, 280.0 / max(trimmed.size))
            if scale < 1.0:
                new_sz = (
                    max(1, int(round(trimmed.width * scale))),
                    max(1, int(round(trimmed.height * scale))),
                )
                trimmed = trimmed.resize(new_sz, Image.Resampling.LANCZOS)
                meta["width"], meta["height"] = trimmed.size

            trimmed.save(OUT_DIR / f"tier_{idx}.png")
            metadata[f"tier_{idx}"] = meta
            extracted.append((idx, trimmed, meta))
            idx += 1

    verify = Image.new("RGBA", (960, 960), (20, 28, 44, 255))
    draw = ImageDraw.Draw(verify)
    for i, (t_idx, spr, meta) in enumerate(extracted):
        gx = (i % 3) * 320 + 160
        gy = (i // 3) * 320 + 160
        r_vis = 95.0
        scale = r_vis / (meta["radius_norm_w"] * spr.width)
        sw = int(round(spr.width * scale))
        sh = int(round(spr.height * scale))
        spr_s = spr.resize((sw, sh), Image.Resampling.LANCZOS)
        ax = int(round(gx - meta["anchor_x_norm"] * sw))
        ay = int(round(gy - meta["anchor_y_norm"] * sh))
        verify.alpha_composite(spr_s, (ax, ay))
        draw.ellipse(
            [gx - r_vis, gy - r_vis, gx + r_vis, gy + r_vis],
            outline=(80, 240, 255, 220),
            width=2,
        )
        draw.text((gx - 140, gy - 140), f"Tier {t_idx}", fill=(255, 228, 160, 255))
    verify.convert("RGB").save("/tmp/verify_desserts_dark.jpg", quality=92)
    return metadata


def extract_mascot_and_tools():
    src = ART_DIR / "gameplay_mockup_1795019430813.jpg"
    mock = Image.open(src).convert("RGB")
    mock.save(RAW_DIR / "gameplay_mockup.jpg")

    # 1. Calico Chef Cat Portrait with adaptive parchment removal
    cat_crop = mock.crop((132, 244, 294, 432))
    cat_rgba = floodfill_remove_bg(
        np.array(cat_crop),
        bg_dist_thresh=54.0,
        decontam_thresh=145.0,
        keep_main_only=True,
        adaptive_parchment=True,
    )
    bbox = cat_rgba.getbbox()
    if bbox:
        cat_rgba = cat_rgba.crop(bbox)
    cat_rgba.save(OUT_DIR / "chef_mikan.png")

    # 2. Three circular wooden medallions
    tools = [
        ("tool_shake", (480, 638, 600, 758)),
        ("tool_fork", (628, 638, 748, 758)),
        ("tool_spoon", (776, 638, 896, 758)),
    ]
    for name, box in tools:
        sub = mock.crop(box).convert("RGBA")
        arr = np.array(sub, dtype=np.float32)
        h, w, _ = arr.shape
        luma = 0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]
        best = (1e9, 60, 59, 51)
        for cy in range(54, 65):
            for cx in range(54, 65):
                for rad in range(48, 56):
                    angles = np.linspace(0, 2 * np.pi, 72, endpoint=False)
                    xs = np.clip(np.round(cx + rad * np.cos(angles)).astype(int), 0, w - 1)
                    ys = np.clip(np.round(cy + rad * np.sin(angles)).astype(int), 0, h - 1)
                    score = luma[ys, xs].mean()
                    if score < best[0]:
                        best = (score, cx, cy, rad)
        _, cx, cy, rad = best
        yy, xx = np.ogrid[:h, :w]
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        r_outer = rad + 2.5
        alpha = np.clip((r_outer - dist) / 1.5, 0.0, 1.0) * 255.0
        arr[:, :, 3] = alpha
        med = Image.fromarray(arr.astype(np.uint8), mode="RGBA")
        mb = med.getbbox()
        if mb:
            med = med.crop(mb)
        med = med.resize((128, 128), Image.Resampling.LANCZOS)
        med.save(OUT_DIR / f"{name}.png")

    v2 = Image.new("RGBA", (640, 240), (24, 30, 44, 255))
    m_img = Image.open(OUT_DIR / "chef_mikan.png")
    m_img.thumbnail((180, 180), Image.Resampling.LANCZOS)
    v2.alpha_composite(m_img, (20, 30))
    for i, name in enumerate(["tool_shake", "tool_fork", "tool_spoon"]):
        t_img = Image.open(OUT_DIR / f"{name}.png")
        v2.alpha_composite(t_img, (220 + i * 140, 56))
    v2.convert("RGB").save("/tmp/verify_ui_assets.jpg", quality=92)


def build_clean_bakery_backdrop():
    """
    Create a clean, seamless Hoshi Kissa bakery room backdrop (1280x714):
    - Keeps left cozy cafe seating & right pastry dome shelves from title_key_art
    - Reconstructs clean starry night window panes below the wooden transom bar (y>=200)
      using exact mullion boundaries [(304,578), (595,863), (880,1016)]
    - Replaces bottom counter smoothly with seamless wood planks from gameplay_mockup (y>=596)
    """
    title_src = Image.open(ART_DIR / "title_key_art_1795019358066.jpg").convert("RGB")
    title_src.save(RAW_DIR / "title_key_art.jpg")
    mock_src = Image.open(ART_DIR / "gameplay_mockup_1795019430813.jpg").convert("RGB")

    title_hero = title_src.resize((1120, 625), Image.Resampling.LANCZOS)
    title_hero.save(OUT_DIR / "title_hero.png")

    bg_arr = np.array(title_src, dtype=np.float32)
    m_arr = np.array(mock_src, dtype=np.float32)

    # 1. Clean full-width wooden serving counter (y=588..768) seamlessly tiled from gameplay_mockup
    tile_a = m_arr[588:768, 370:445]
    seg = np.concatenate([tile_a, tile_a[:, ::-1]], axis=1)
    clean_counter = np.zeros((768 - 588, 1376, 3), dtype=np.float32)
    for x in range(1376):
        clean_counter[:, x] = seg[:, x % seg.shape[1]]
    for dx in range(60):
        w = dx / 59.0
        clean_counter[:, dx] = m_arr[588:768, dx]
        clean_counter[:, 60 + dx] = (1 - w) * m_arr[588:768, 60 + dx] + w * clean_counter[:, 60 + dx]
        clean_counter[:, 1375 - dx] = m_arr[588:768, 1375 - dx]
        clean_counter[:, 1315 - dx] = (1 - w) * m_arr[588:768, 1315 - dx] + w * clean_counter[:, 1315 - dx]

    # Put clean full-width counter cleanly across entire bottom with crisp counter bevel
    for dy in range(8):
        w = dy / 7.0
        bg_arr[588 + dy] = (1 - w) * bg_arr[588 + dy] + w * clean_counter[dy]
    bg_arr[596:768] = clean_counter[8:]
    bg_arr[587:590, :] = bg_arr[587:590, :] * 0.35 + np.array([58.0, 32.0, 16.0]) * 0.65
    bg_arr[590:593, :] = bg_arr[590:593, :] * 0.45 + np.array([156.0, 102.0, 52.0]) * 0.55

    # 2. Clean out the "HOSHI KISSA" sign on the right counter (x=1138..1240, y=528..592)
    # Paint clean dark wood counter under the pastry pedestal
    sign_bg = np.array([112.0, 66.0, 36.0])
    for dy in range(64):
        for dx in range(102):
            rx = (dx - 51.0) / 51.0
            ry = (dy - 32.0) / 32.0
            d = np.sqrt(rx * rx + ry * ry)
            if d < 1.0:
                w = np.clip((1.0 - d) * 2.8, 0.0, 1.0)
                tone = sign_bg + (dy / 64.0) * np.array([-22.0, -14.0, -8.0])
                bg_arr[528 + dy, 1138 + dx] = (1 - w) * bg_arr[528 + dy, 1138 + dx] + w * tone

    # 3. Clean upper moon arch & top-right window pane:
    sky_patch = bg_arr[135:205, 598:678].copy()
    for dy in range(68):
        for dx in range(88):
            rx = (dx - 44) / 44.0
            ry = (dy - 34) / 34.0
            d = np.sqrt(rx * rx + ry * ry)
            if d < 1.0:
                w = np.clip((1.0 - d) * 2.5, 0.0, 1.0)
                bg_arr[166 + dy, 718 + dx] = (1 - w) * bg_arr[166 + dy, 718 + dx] + w * sky_patch[dy % 70, dx % 80]

    # Copy clean right window pane directly from gameplay_mockup (x=885..1014, y=120..480)
    bg_arr[120:480, 885:1014] = m_arr[120:480, 885:1014]

    # 4. Paint serene starry midnight sky + misty hills matching per-column top sky seamlessly!
    win_y0, win_y1 = 186, 586
    win_x0, win_x1 = 306, 1018
    win_h = win_y1 - win_y0
    win_w = win_x1 - win_x0
    win_sky = np.zeros((win_h, win_w, 3), dtype=np.float32)

    # Sample top sky strip row y=170..182 per column from bg_arr (above transom bar)
    top_row = bg_arr[168:180, win_x0:win_x1].mean(axis=0)
    from PIL import ImageFilter as _IF
    top_sm = np.array(
        Image.fromarray(np.clip(top_row[None, :, :], 0, 255).astype(np.uint8)).filter(_IF.GaussianBlur(14)),
        dtype=np.float32,
    )[0]
    mid_col = np.array([15.0, 62.0, 74.0])
    bot_col = np.array([10.0, 36.0, 44.0])

    rng = np.random.default_rng(77)
    for dy in range(win_h):
        t = dy / float(win_h - 1)
        if t < 0.50:
            u = t / 0.50
            win_sky[dy] = (1 - u) * top_sm + u * mid_col[None, :]
        else:
            u = (t - 0.50) / 0.50
            win_sky[dy] = (1 - u) * mid_col[None, :] + u * bot_col[None, :]
    grain = rng.normal(0, 1.5, (win_h, win_w, 3)).astype(np.float32)
    win_sky = np.clip(win_sky + grain, 0, 255)

    xs = np.arange(win_w, dtype=np.float32)
    lamp_glow = np.exp(-((xs / 85.0) ** 2)) * 0.24
    win_sky += lamp_glow[None, :, None] * np.array([140.0, 95.0, 35.0])

    mtn_far = 205 + 30 * np.sin(xs * 0.0085 + 0.3) + 14 * np.cos(xs * 0.021)
    mtn_near = 278 + 22 * np.sin(xs * 0.012 + 2.4) + 10 * np.sin(xs * 0.031)
    for x in range(win_w):
        yf = int(mtn_far[x])
        yn = int(mtn_near[x])
        if yf < win_h:
            win_sky[yf:, x] = win_sky[yf:, x] * 0.55 + np.array([11.0, 46.0, 52.0]) * 0.45
        if yn < win_h:
            win_sky[yn:, x] = win_sky[yn:, x] * 0.50 + np.array([10.0, 28.0, 34.0]) * 0.50

    cottages = [(48, 335), (85, 348), (645, 338), (675, 348)]
    for cx, cy in cottages:
        win_sky[cy - 3 : cy + 4, cx - 4 : cx + 4] = np.array([255.0, 206.0, 110.0])

    for _ in range(125):
        sx = int(rng.integers(10, win_w - 10))
        sy = int(rng.integers(6, 200))
        rad = float(rng.uniform(0.7, 2.0))
        bright = float(rng.uniform(0.35, 0.9))
        y_a, y_b = max(0, sy - 4), min(win_h, sy + 5)
        x_a, x_b = max(0, sx - 4), min(win_w, sx + 5)
        yy, xx = np.ogrid[y_a:y_b, x_a:x_b]
        d = np.sqrt((xx - sx) ** 2 + (yy - sy) ** 2)
        glow = np.exp(-(d ** 2) / (2 * (rad ** 2))) * bright
        star_col = np.array([255.0, 236.0, 175.0])
        win_sky[y_a:y_b, x_a:x_b] = (
            win_sky[y_a:y_b, x_a:x_b] * (1 - glow[:, :, None]) + star_col * glow[:, :, None]
        )

    panes = [(316, 578), (596, 862), (882, 1014)]
    for idx_p, (px0, px1) in enumerate(panes):
        y_start = 186
        for y in range(y_start, win_y1):
            wy = y - win_y0
            fy = np.clip((y - y_start) / 28.0, 0.0, 1.0)
            for x in range(px0, px1):
                wx = x - win_x0
                fx = min(1.0, (x - px0) / 4.0, (px1 - 1 - x) / 4.0)
                w = fy * fx
                bg_arr[y, x] = (1 - w) * bg_arr[y, x] + w * win_sky[wy, wx]

    # Clean wooden horizontal window bars on left/right wings (skip center arch) + mid muntins
    for idx_p, (px0, px1) in enumerate(panes):
        if idx_p != 1:
            bg_arr[184:193, px0:px1] = np.array([76.0, 44.0, 24.0])
            bg_arr[184:186, px0:px1] = np.array([134.0, 84.0, 48.0])
        bg_arr[376:385, px0:px1] = np.array([72.0, 42.0, 24.0])
        bg_arr[376:378, px0:px1] = np.array([124.0, 78.0, 44.0])

    for mx0, mx1 in [(578, 596), (862, 882)]:
        bg_arr[184:588, mx0:mx1] = np.array([74.0, 43.0, 24.0])
        bg_arr[184:588, mx0 + 2 : mx0 + 5] = np.array([122.0, 76.0, 44.0])
    bg_arr[578:588, 308:1018] = np.array([82.0, 48.0, 26.0])
    bg_arr[578:581, 308:1018] = np.array([142.0, 92.0, 52.0])

    bg_img = Image.fromarray(np.clip(bg_arr, 0, 255).astype(np.uint8), mode="RGB")
    bg_blur = bg_img.filter(ImageFilter.GaussianBlur(radius=1.4))
    mask = Image.new("L", bg_img.size, 150)
    mdraw = ImageDraw.Draw(mask)
    mdraw.rectangle([0, 586, 1376, 768], fill=0)
    mdraw.rectangle([0, 0, 1376, 95], fill=25)
    final_bg = Image.composite(bg_blur, bg_img, mask)

    final_bg = final_bg.resize((1280, 714), Image.Resampling.LANCZOS)
    final_bg.save(OUT_DIR / "bakery_bg.png")
    final_bg.save("/tmp/verify_bakery_bg.jpg", quality=92)


def extract_plan_b_assets():
    """
    Slice 1024x1024 2x2 Plan B sprite sheet into:
      - patron_luna.png  (top-left, max 256x256)
      - patron_mugi.png  (top-right, max 256x256)
      - event_yarn_ball.png (bottom-left, max 192x192)
      - icon_shop_sign.png  (bottom-right, max 192x192)
    """
    src = RAW_DIR / "plan_b_sprites_sheet.jpg"
    if not src.exists():
        raise FileNotFoundError(f"Missing Plan B sprite sheet: {src}")
    img = Image.open(src).convert("RGB")
    w, h = img.size
    mx, my = w // 2, h // 2

    specs = [
        ("patron_luna", (0, 0, mx, my), 256, 86),
        ("patron_mugi", (mx, 0, w, my), 256, 86),
        ("event_yarn_ball", (0, my, mx, h), 192, 86),
        ("icon_shop_sign", (mx, my, w, h), 192, 86),
    ]

    verify = Image.new("RGBA", (880, 260), (22, 30, 46, 255))
    draw = ImageDraw.Draw(verify)
    report = []

    for idx, (name, box, max_dim, webp_q) in enumerate(specs):
        cell = img.crop(box)
        rgba = floodfill_remove_bg(
            np.array(cell),
            bg_dist_thresh=30.0,
            decontam_thresh=110.0,
            keep_main_only=True,
        )
        bbox = rgba.getbbox()
        if bbox:
            rgba = rgba.crop(bbox)

        if name == "event_yarn_ball":
            # Punch out tiny enclosed white hole inside the decorative bottom-left yarn curl loop
            arr_y = np.array(rgba)
            yh, yw = arr_y.shape[:2]
            yy, xx = np.mgrid[0:yh, 0:yw]
            rgb_y = arr_y[:, :, :3].astype(np.float32)
            luma_y = 0.299 * rgb_y[:, :, 0] + 0.587 * rgb_y[:, :, 1] + 0.114 * rgb_y[:, :, 2]
            sat_y = rgb_y.max(axis=2) - rgb_y.min(axis=2)
            hole = (xx < yw * 0.30) & (yy > yh * 0.60) & (luma_y > 225) & (sat_y < 24)
            arr_y[hole, 3] = 0
            rgba = Image.fromarray(arr_y, mode="RGBA")

        scale = min(1.0, float(max_dim) / max(rgba.size))
        if scale < 1.0:
            new_sz = (
                max(1, int(round(rgba.width * scale))),
                max(1, int(round(rgba.height * scale))),
            )
            rgba = rgba.resize(new_sz, Image.Resampling.LANCZOS)

        png_path = PNG_DIR / f"{name}.png"
        rgba.save(png_path)
        kb = png_path.stat().st_size / 1024.0
        report.append((name, rgba.size, round(kb, 1)))

        # Place on dark verification canvas to check zero white halo
        px = 20 + idx * 215 + (190 - rgba.width) // 2
        py = 36 + (190 - rgba.height) // 2
        thumb = rgba.copy()
        thumb.thumbnail((184, 184), Image.Resampling.LANCZOS)
        px = 20 + idx * 215 + (190 - thumb.width) // 2
        py = 44 + (184 - thumb.height) // 2
        verify.alpha_composite(thumb, (px, py))
        draw.text((24 + idx * 215, 14), f"{name} ({kb:.1f}KB)", fill=(255, 232, 168, 255))

    verify.convert("RGB").save("/tmp/verify_plan_b_assets.jpg", quality=92)
    print("Plan B assets extracted:", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan-b", action="store_true", help="Extract only 3.0 Plan B 2x2 sprite sheet")
    args = parser.parse_args()
    if args.plan_b:
        extract_plan_b_assets()
    else:
        meta = extract_desserts()
        extract_mascot_and_tools()
        build_clean_bakery_backdrop()
        extract_plan_b_assets()
        with open(OUT_DIR / "sprites_meta.json", "w") as f:
            json.dump(meta, f, indent=2)
        print("Extraction complete!")
