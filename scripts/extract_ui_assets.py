#!/usr/bin/env python3
"""
Extract 16 storybook UI icons (into 512x512 4x4 ui_atlas.png) and 3 UI banner/stage
assets (ui_title_plaque.png, ui_patron_stage.png, ui_serve_bell.png) from the two
token-efficient sprite sheets, with clean alpha matting and interior-hole knockout.
"""
import json
import shutil
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
PNG_DIR = REPO_ROOT / "02-游戏素材-精修透明PNG"
RAW_DIR = REPO_ROOT / "03-游戏素材-原始原图与WebP"
MINIGAME_ASSETS = REPO_ROOT / "05-微信小游戏版本" / "assets"

ICON_NAMES = [
    ["mode_chef", "mode_rush", "mode_zen", "icon_shop"],
    ["icon_book", "icon_trophy", "icon_stardust", "icon_coin"],
    ["icon_bgm", "icon_sfx", "icon_help", "icon_home"],
    ["icon_restart", "icon_gift", "icon_launcher", "icon_paw_guide"],
]


def remove_white_bg_and_holes(
    rgb: np.ndarray,
    bg_dist_thresh: float = 24.0,
    decontam_thresh: float = 95.0,
    punch_pure_white_holes: bool = False,
    protect_box_norm: tuple | None = None,
) -> Image.Image:
    """
    Floodfill remove outer white background with edge color decontamination,
    and optionally knock out enclosed pure-white holes (#FFFFFF loops/handles/rings)
    outside `protect_box_norm` (x0, y0, x1, y1 in 0..1).
    """
    h, w, _ = rgb.shape
    arr = rgb.astype(np.float32)

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

    if punch_pure_white_holes:
        # Enclosed pure neutral white regions (e.g. ring center, handle loops, chain links)
        sat = arr.max(axis=2) - arr.min(axis=2)
        min_ch = arr.min(axis=2)
        if bg_dist_thresh >= 60.0:
            pure_white = (arr[:, :, 0] > 238.0) & (arr[:, :, 1] > 220.0) & (arr[:, :, 2] > 155.0) & (~visited)
        else:
            pure_white = (min_ch > 245.0) & (sat < 7.0) & (~visited)
        if protect_box_norm is not None:
            px0 = int(protect_box_norm[0] * w)
            py0 = int(protect_box_norm[1] * h)
            px1 = int(protect_box_norm[2] * w)
            py1 = int(protect_box_norm[3] * h)
            pure_white[py0:py1, px0:px1] = False

        # Find connected components of pure_white that are enclosed holes (>= 12 px)
        hole_vis = np.zeros((h, w), dtype=bool)
        for sy in range(h):
            for sx in range(w):
                if pure_white[sy, sx] and not hole_vis[sy, sx]:
                    comp = [(sy, sx)]
                    hole_vis[sy, sx] = True
                    cq = deque([(sy, sx)])
                    while cq:
                        cy, cx = cq.popleft()
                        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                            if 0 <= ny < h and 0 <= nx < w and not hole_vis[ny, nx]:
                                if pure_white[ny, nx] or (dist[ny, nx] < 18.0 and sat[ny, nx] < 9.0 and not visited[ny, nx]):
                                    if protect_box_norm is not None and (px0 <= nx < px1 and py0 <= ny < py1):
                                        continue
                                    hole_vis[ny, nx] = True
                                    cq.append((ny, nx))
                                    comp.append((ny, nx))
                    if len(comp) >= 10:
                        for py, px in comp:
                            visited[py, px] = True

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
            a = np.clip((d - bg_dist_thresh * 0.45) / (decontam_thresh - bg_dist_thresh * 0.45), 0.10, 1.0)
            alpha[y, x] = a * 255.0
            arr[y, x] = np.clip((arr[y, x] - (1.0 - a) * bg_color) / max(a, 0.25), 0, 255)

    for y, x in zip(*np.where(ring2)):
        d = dist[y, x]
        if d < decontam_thresh * 0.72:
            a = np.clip(d / (decontam_thresh * 0.72), 0.55, 1.0)
            alpha[y, x] = min(alpha[y, x], a * 255.0)
            arr[y, x] = np.clip((arr[y, x] - (1.0 - a) * bg_color) / max(a, 0.45), 0, 255)

    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode="L")
    alpha_blur = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.5))
    a_np = np.array(alpha_blur, dtype=np.float32)
    interior = (~bg_mask) & (~edge_fg) & (~ring2)
    a_np[interior] = 255.0
    a_np[bg_mask] = 0.0

    rgba = np.dstack([np.clip(arr, 0, 255).astype(np.uint8), a_np.astype(np.uint8)])
    return Image.fromarray(rgba, mode="RGBA")


def save_quantized_png(img: Image.Image, dest: Path, colors: int = 256):
    q = img.quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(dest, optimize=True)


def main():
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--icons-src", required=True)
    parser.add_argument("--banners-src", required=True)
    args = parser.parse_args()

    PNG_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    MINIGAME_ASSETS.mkdir(parents=True, exist_ok=True)

    shutil.copyfile(args.icons_src, RAW_DIR / "ui_icons_sheet.jpg")
    shutil.copyfile(args.banners_src, RAW_DIR / "ui_banners_sheet.jpg")

    icons_img = Image.open(args.icons_src).convert("RGB")
    iw, ih = icons_img.size
    cw, ch = iw // 4, ih // 4

    hole_icons = {
        "mode_rush",
        "mode_zen",
        "icon_trophy",
        "icon_stardust",
        "icon_bgm",
        "icon_restart",
        "icon_launcher",
    }
    # Protect inner clock face of mode_rush so only top ring/wings holes are punched
    protect_boxes = {
        "mode_rush": (0.28, 0.34, 0.72, 0.80),
    }

    cell_size = 128
    atlas = Image.new("RGBA", (cell_size * 4, cell_size * 4), (0, 0, 0, 0))
    atlas_meta = {}

    for r in range(4):
        for c in range(4):
            name = ICON_NAMES[r][c]
            crop = icons_img.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            is_stardust = name == "icon_stardust"
            rgba = remove_white_bg_and_holes(
                np.array(crop),
                bg_dist_thresh=66.0 if is_stardust else 24.0,
                decontam_thresh=135.0 if is_stardust else 92.0,
                punch_pure_white_holes=(name in hole_icons),
                protect_box_norm=protect_boxes.get(name),
            )
            bbox = rgba.getbbox()
            if bbox:
                rgba = rgba.crop(bbox)

            # Fit into (cell_size - 10) centered in cell_size x cell_size
            target_max = cell_size - 10
            scale = min(1.0, target_max / max(rgba.size))
            nw = max(1, int(round(rgba.width * scale)))
            nh = max(1, int(round(rgba.height * scale)))
            resized = rgba.resize((nw, nh), Image.Resampling.LANCZOS)

            # Save individual refined PNG in 02 archive
            resized.save(PNG_DIR / f"{name}.png")

            ox = c * cell_size + (cell_size - nw) // 2
            oy = r * cell_size + (cell_size - nh) // 2
            atlas.alpha_composite(resized, (ox, oy))
            atlas_meta[name] = {
                "x": c * cell_size,
                "y": r * cell_size,
                "w": cell_size,
                "h": cell_size,
            }

    atlas.save(PNG_DIR / "ui_atlas.png")
    save_quantized_png(atlas, MINIGAME_ASSETS / "ui_atlas.png", colors=256)

    # Extract 3 banner/stage elements from ui_banners_sheet
    banners_img = Image.open(args.banners_src).convert("RGB")
    bw, bh = banners_img.size

    banner_specs = [
        # (name, crop_box, max_w, max_h, punch_holes, protect_box)
        ("ui_title_plaque", (0, 0, bw, int(bh * 0.555)), 560, 290, True, (0.13, 0.24, 0.87, 0.74)),
        ("ui_patron_stage", (0, int(bh * 0.56), int(bw * 0.515), bh), 240, 180, False, None),
        ("ui_serve_bell", (int(bw * 0.54), int(bh * 0.55), bw, bh), 168, 168, False, None),
    ]

    extracted_banners = []
    for name, box, max_w, max_h, punch, pbox in banner_specs:
        sub = banners_img.crop(box)
        rgba = remove_white_bg_and_holes(
            np.array(sub),
            bg_dist_thresh=24.0,
            decontam_thresh=92.0,
            punch_pure_white_holes=punch,
            protect_box_norm=pbox,
        )
        bbox = rgba.getbbox()
        if bbox:
            rgba = rgba.crop(bbox)
        scale = min(1.0, max_w / rgba.width, max_h / rgba.height)
        nw = max(1, int(round(rgba.width * scale)))
        nh = max(1, int(round(rgba.height * scale)))
        resized = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
        resized.save(PNG_DIR / f"{name}.png")
        save_quantized_png(resized, MINIGAME_ASSETS / f"{name}.png", colors=256)
        extracted_banners.append((name, resized))

    # Build dark checkerboard verification preview
    verify = Image.new("RGBA", (960, 760), (24, 30, 46, 255))
    vdraw = ImageDraw.Draw(verify)
    for gy in range(0, 760, 24):
        for gx in range(0, 960, 24):
            if ((gx // 24) + (gy // 24)) % 2 == 1:
                vdraw.rectangle([gx, gy, gx + 23, gy + 23], fill=(32, 40, 60, 255))

    verify.alpha_composite(atlas, (24, 24))
    vdraw.rectangle([24, 24, 24 + 512, 24 + 512], outline=(100, 220, 255, 160), width=1)

    by = 24
    for name, bimg in extracted_banners:
        thumb = bimg.copy()
        thumb.thumbnail((380, 220), Image.Resampling.LANCZOS)
        verify.alpha_composite(thumb, (560, by))
        vdraw.text((560, by + thumb.height + 4), f"{name} ({bimg.width}x{bimg.height})", fill=(255, 232, 168, 255))
        by += thumb.height + 28

    verify.convert("RGB").save("/tmp/verify_new_ui_assets.jpg", quality=94)

    for fn in ["ui_atlas.png", "ui_title_plaque.png", "ui_patron_stage.png", "ui_serve_bell.png"]:
        p = MINIGAME_ASSETS / fn
        print(f"Saved {fn}: {p.stat().st_size / 1024:.1f} KB")
    print("Atlas keys:", json.dumps(list(atlas_meta.keys())))


if __name__ == "__main__":
    main()
