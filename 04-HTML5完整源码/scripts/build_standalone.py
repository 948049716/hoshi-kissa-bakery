#!/usr/bin/env python3
"""
Bundle index.html, styles.css, audio.js, physics_shapes.js, physics.js, game.js,
and all processed WebP assets into a single 100% self-contained offline HTML file
with automatic asset deduplication to keep the standalone bundle compact.
"""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent


def data_uri(rel_path: str) -> str:
    p = ROOT / rel_path
    raw = p.read_bytes()
    b64 = base64.b64encode(raw).decode("ascii")
    ext = p.suffix.lower().lstrip(".")
    mime = "image/webp" if ext == "webp" else f"image/{ext}"
    return f"data:{mime};base64,{b64}"


def build():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")
    audio_js = (ROOT / "audio.js").read_text(encoding="utf-8")
    shapes_js = (ROOT / "physics_shapes.js").read_text(encoding="utf-8")
    physics_js = (ROOT / "physics.js").read_text(encoding="utf-8")
    game_js = (ROOT / "game.js").read_text(encoding="utf-8")

    asset_files = sorted((ROOT / "assets/processed").glob("*.webp"), key=lambda p: len(p.name), reverse=True)
    shared_assets = {}

    for p in asset_files:
        rel = f"assets/processed/{p.name}"
        uri = data_uri(rel)

        # Inline CSS references directly (CSS cannot read JS globals)
        if rel in css:
            css = css.replace(rel, uri)

        html_cnt = html.count(rel)
        js_cnt = game_js.count(rel)
        if html_cnt + js_cnt == 0:
            continue

        # Deduplicate assets referenced 2+ times across HTML/JS via a single shared map
        if html_cnt + js_cnt >= 2:
            key = p.name
            shared_assets[key] = uri
            html = html.replace(f'src="{rel}"', f'src="" data-hoshi-asset="{key}"')
            game_js = game_js.replace(f"'{rel}'", f"window.__HOSHI_ASSETS__['{key}']")
            game_js = game_js.replace(f'"{rel}"', f'window.__HOSHI_ASSETS__["{key}"]')
        else:
            html = html.replace(rel, uri)
            game_js = game_js.replace(rel, uri)

    hydrate_script = ""
    if shared_assets:
        hydrate_script = (
            "<script>\n"
            f"window.__HOSHI_ASSETS__={json.dumps(shared_assets, separators=(',', ':'))};\n"
            "document.querySelectorAll('img[data-hoshi-asset]').forEach(function(el){"
            "var k=el.getAttribute('data-hoshi-asset');"
            "if(window.__HOSHI_ASSETS__[k]) el.src=window.__HOSHI_ASSETS__[k];"
            "});\n"
            "</script>\n  "
        )

    html = html.replace('<link rel="stylesheet" href="styles.css" />', f"<style>\n{css}\n</style>")
    html = html.replace('<script src="audio.js"></script>', f"{hydrate_script}<script>\n{audio_js}\n</script>")
    html = html.replace('<script src="physics_shapes.js"></script>', f"<script>\n{shapes_js}\n</script>")
    html = html.replace('<script src="physics.js"></script>', f"<script>\n{physics_js}\n</script>")
    html = html.replace('<script src="game.js"></script>', f"<script>\n{game_js}\n</script>")

    out_path = REPO_ROOT / "hoshi-kissa-bakery.html"
    out_path.write_text(html, encoding="utf-8")
    size_kb = out_path.stat().st_size / 1024
    print(f"Built standalone HTML: {out_path} ({size_kb:.1f} KB / {size_kb / 1024:.2f} MB, deduplicated: {len(shared_assets)} assets)")


if __name__ == "__main__":
    build()
