"""Generate NSIS installer BMP assets for ez.down (retro B/W/G palette)."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "windows" / "installer"
LOGO = ROOT / "src" / "assets" / "logo.png"

WHITE = (255, 255, 255)
PANEL = (244, 244, 244)
BLACK = (0, 0, 0)
MUTED = (110, 110, 110)

SIDEBAR_SIZE = (164, 314)
HEADER_SIZE = (150, 57)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    fonts_dir = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
    names = (
        ["segoeuib.ttf", "arialbd.ttf", "calibrib.ttf"]
        if bold
        else ["segoeui.ttf", "arial.ttf", "calibri.ttf"]
    )
    for name in names:
        path = fonts_dir / name
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def paste_logo(base: Image.Image, box: tuple[int, int, int, int]) -> None:
    if not LOGO.exists():
        return
    x0, y0, x1, y1 = box
    size = min(x1 - x0, y1 - y0)
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.resize((size, size), Image.Resampling.LANCZOS)
    x = x0 + (x1 - x0 - size) // 2
    y = y0 + (y1 - y0 - size) // 2
    layer = base.convert("RGBA")
    layer.paste(logo, (x, y), logo)
    base.paste(layer.convert("RGB"))


def draw_retro_border(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    draw.rectangle((0, 0, w - 1, h - 1), outline=BLACK, width=2)
    draw.rectangle((w - 4, h - 4, w - 1, h - 1), fill=BLACK)


def text_size(
    draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont
) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    y: int,
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int],
    width: int,
) -> None:
    tw, _ = text_size(draw, text, font)
    draw.text(((width - tw) // 2, y), text, fill=fill, font=font)


def draw_header() -> None:
    w, h = HEADER_SIZE
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)
    draw_retro_border(draw, w, h)
    draw.line((2, h - 4, w - 5, h - 4), fill=BLACK, width=2)

    paste_logo(img, (10, 8, 52, 50))

    title_font = load_font(17, bold=True)
    sub_font = load_font(11)
    draw.text((58, 13), "ez.down", fill=BLACK, font=title_font)
    draw.text((58, 34), "Setup", fill=MUTED, font=sub_font)

    img.save(OUT / "header.bmp", format="BMP")


def draw_sidebar() -> None:
    w, h = SIDEBAR_SIZE
    img = Image.new("RGB", (w, h), PANEL)
    draw = ImageDraw.Draw(img)
    draw_retro_border(draw, w, h)

    paste_logo(img, (38, 56, 126, 144))

    draw.line((42, 158, w - 42, 158), fill=BLACK, width=2)

    title_font = load_font(15, bold=True)
    sub_font = load_font(11)
    draw_centered_text(draw, 172, "ez.down", title_font, BLACK, w)
    draw_centered_text(draw, 194, "WYSIWYG Markdown", sub_font, MUTED, w)
    draw_centered_text(draw, 210, "editor", sub_font, MUTED, w)

    img.save(OUT / "sidebar.bmp", format="BMP")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_header()
    draw_sidebar()
    print(f"Wrote {OUT / 'header.bmp'} and {OUT / 'sidebar.bmp'}")


if __name__ == "__main__":
    main()
