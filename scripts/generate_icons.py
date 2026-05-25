"""Generate PWA icons for Habitracker.

Produces a set of PNG icons (and a maskable variant) from a single
GitHub-contribution-graph–inspired design. Run once to refresh assets.
"""

from PIL import Image, ImageDraw

# GitHub dark theme contribution colors
COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"]
BG = "#0d1117"
RING = "#21262d"

# 5x5 pattern (level 0-4)
PATTERN = [
    [1, 0, 2, 0, 1],
    [2, 3, 4, 3, 2],
    [3, 4, 4, 4, 3],
    [2, 3, 4, 3, 2],
    [1, 0, 2, 0, 1],
]


def render(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Background (rounded square, or full square for maskable safe area)
    if maskable:
        # Maskable icons must fill the entire canvas; OS clips to its mask.
        draw.rectangle([0, 0, size, size], fill=BG)
        # Pattern occupies the inner 80% safe zone
        safe = int(size * 0.8)
        offset = (size - safe) // 2
    else:
        radius = int(size * 0.22)
        draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)
        safe = int(size * 0.78)
        offset = (size - safe) // 2

    # 5x5 grid inside the safe area
    cell_gap = max(1, safe // 40)
    cell_size = (safe - cell_gap * 4) // 5

    for row in range(5):
        for col in range(5):
            x = offset + col * (cell_size + cell_gap)
            y = offset + row * (cell_size + cell_gap)
            level = PATTERN[row][col]
            color = COLORS[level]
            r = max(1, cell_size // 5)
            draw.rounded_rectangle(
                [x, y, x + cell_size - 1, y + cell_size - 1],
                radius=r,
                fill=color,
            )

    return img


def main() -> None:
    sizes = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-maskable-512.png": (512, True),
        "apple-touch-icon.png": (180, False),
        "favicon-32.png": (32, False),
    }
    for filename, (size, maskable) in sizes.items():
        img = render(size, maskable=maskable)
        img.save(f"icons/{filename}", optimize=True)
        print(f"  wrote icons/{filename}  ({size}x{size}{', maskable' if maskable else ''})")


if __name__ == "__main__":
    main()
