"""Generate PWA icons for Habitracker.

Renders a flame mark (the streak symbol) on a dark rounded background
at every size the manifest declares. Run once to refresh assets.
"""

import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw

BG = "#0d1117"
FLAME_OUTER = "#1f8a3a"
FLAME_INNER = "#39d353"

FLAME_SVG = f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path fill="{FLAME_OUTER}" d="
    M50 6
    Q 56 22 66 32
    Q 78 44 80 60
    Q 82 82 60 90
    Q 50 93 40 90
    Q 18 82 20 60
    Q 22 44 34 32
    Q 44 22 50 6 Z"/>
  <path fill="{FLAME_INNER}" d="
    M50 44
    Q 55 54 61 62
    Q 68 73 60 84
    Q 50 90 40 84
    Q 32 73 39 62
    Q 45 54 50 44 Z"/>
</svg>
"""


def render_flame(size: int) -> Image.Image:
    png_bytes = cairosvg.svg2png(
        bytestring=FLAME_SVG.encode("utf-8"),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def render(size: int, maskable: bool = False) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    if maskable:
        draw.rectangle([0, 0, size, size], fill=BG)
        flame_size = int(size * 0.55)
    else:
        radius = int(size * 0.22)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
        flame_size = int(size * 0.7)

    flame = render_flame(flame_size)
    offset = ((size - flame_size) // 2, (size - flame_size) // 2)
    canvas.paste(flame, offset, flame)
    return canvas


def main() -> None:
    out = Path("icons")
    out.mkdir(exist_ok=True)
    sizes = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, False),
        "favicon-32.png": (32, False),
    }
    for filename, (size, maskable) in sizes.items():
        img = render(size, maskable=maskable)
        img.save(out / filename, optimize=True)
        print(f"  wrote {out / filename}  ({size}x{size}{', maskable' if maskable else ''})")


if __name__ == "__main__":
    main()
