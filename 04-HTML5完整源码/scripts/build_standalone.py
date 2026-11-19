#!/usr/bin/env python3
"""
Bundle index.html, styles.css, audio.js, game.js, and all processed WebP assets
into a single 100% self-contained standalone HTML file.
"""
import base64
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

    # Replace all processed asset URLs across CSS, HTML, and JS with inline base64 data URIs
    asset_files = sorted((ROOT / "assets/processed").glob("*.webp"), key=lambda p: len(p.name), reverse=True)
    replacements = {f"assets/processed/{p.name}": data_uri(f"assets/processed/{p.name}") for p in asset_files}

    for rel, uri in replacements.items():
        css = css.replace(rel, uri)
        html = html.replace(rel, uri)
        game_js = game_js.replace(rel, uri)

    html = html.replace('<link rel="stylesheet" href="styles.css" />', f"<style>\n{css}\n</style>")
    html = html.replace('<script src="audio.js"></script>', f"<script>\n{audio_js}\n</script>")
    html = html.replace('<script src="physics_shapes.js"></script>', f"<script>\n{shapes_js}\n</script>")
    html = html.replace('<script src="physics.js"></script>', f"<script>\n{physics_js}\n</script>")
    html = html.replace('<script src="game.js"></script>', f"<script>\n{game_js}\n</script>")

    out_path = REPO_ROOT / "hoshi-kissa-bakery.html"
    out_path.write_text(html, encoding="utf-8")
    print(f"Built standalone HTML: {out_path} ({out_path.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
