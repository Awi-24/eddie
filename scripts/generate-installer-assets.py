"""Generate retro-themed NSIS installer BMP assets for ez.down."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "windows" / "installer"
LOGO = ROOT / "src" / "assets" / "logo.png"

BG = (255, 255, 255)
PANEL = (244, 244, 244)
BLACK = (0, 0, 0)
ACCENT = (26, 26, 26)


def draw_header() -> None:
    img = Image.new("RGB", (150, 57), PANEL)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 149, 56), outline=BLACK, width=2)
    draw.rectangle((146, 54, 149, 56), fill=BLACK)
    draw.text((14, 19), "ez.down", fill=BLACK)
    img.save(OUT / "header.bmp", format="BMP")


def draw_sidebar() -> None:
    img = Image.new("RGB", (164, 314), BG)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, 163, 313), outline=BLACK, width=2)
    draw.rectangle((10, 12, 153, 88), fill=ACCENT, outline=BLACK, width=2)
    draw.rectangle((150, 310, 163, 313), fill=BLACK)

    if LOGO.exists():
        logo = Image.open(LOGO).convert("RGBA")
        logo = logo.resize((72, 72), Image.Resampling.LANCZOS)
        x, y = 46, 110
        img.paste(logo, (x, y), logo)

    draw.text((22, 200), "WYSIWYG", fill=BLACK)
    draw.text((22, 218), "Markdown", fill=BLACK)
    draw.text((22, 236), "editor", fill=BLACK)
    img.save(OUT / "sidebar.bmp", format="BMP")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_header()
    draw_sidebar()
    print(f"Wrote {OUT / 'header.bmp'} and {OUT / 'sidebar.bmp'}")


if __name__ == "__main__":
    main()
