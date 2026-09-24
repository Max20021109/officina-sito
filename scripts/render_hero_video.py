#!/usr/bin/env python3
"""
Genera assets/video/hero.mp4: un loop ambientale astratto (ingranaggio che
ruota, scintille, scansione diagnostica) da usare nell'hero finche' non
arriva un video vero girato in officina. Stessa logica visiva del canvas
JS di riserva (js/main.js), ma qui e' un file video reale e autoconclusivo:
nessuna dipendenza da script a runtime, nessun asset esterno scaricato.
"""
import math
import random
import subprocess
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

W, H = 1600, 900
FPS = 24
DURATION = 8.0
FRAMES = int(FPS * DURATION)

BG = (11, 13, 16)
ACCENT = (220, 38, 38)
SPARK_WARM = (255, 196, 120)

OUT_DIR = Path("/tmp/hero_frames")
FINAL_DIR = Path(__file__).resolve().parent.parent / "assets" / "video"


def draw_gear(draw: ImageDraw.ImageDraw, cx, cy, r, angle, alpha):
    teeth = 14
    pts = []
    for i in range(teeth):
        a0 = (i / teeth) * 2 * math.pi + angle
        a1 = a0 + (2 * math.pi / teeth) / 2
        r_outer, r_inner = r, r * 0.88
        pts.append((cx + math.cos(a0) * r_inner, cy + math.sin(a0) * r_inner))
        pts.append((cx + math.cos(a0) * r_outer, cy + math.sin(a0) * r_outer))
        pts.append((cx + math.cos(a1) * r_outer, cy + math.sin(a1) * r_outer))
        pts.append((cx + math.cos(a1) * r_inner, cy + math.sin(a1) * r_inner))
    draw.polygon(pts, outline=ACCENT + (alpha,), width=2)
    draw.ellipse([cx - r * 0.34, cy - r * 0.34, cx + r * 0.34, cy + r * 0.34],
                 outline=ACCENT + (alpha,), width=2)


def draw_grid(img: Image.Image, offset):
    """Griglia prospettica leggera, stessa idea del CSS .hero__grid esistente."""
    draw = ImageDraw.Draw(img, "RGBA")
    spacing = 46
    alpha = 14
    # linee orizzontali con leggero effetto prospettico (piu' dense verso il basso)
    y = -spacing + (offset % spacing)
    while y < H:
        draw.line([(0, y), (W, y)], fill=(255, 255, 255, alpha))
        y += spacing
    x = -spacing + (offset % spacing)
    while x < W:
        draw.line([(x, 0), (x, H)], fill=(255, 255, 255, alpha))
        x += spacing


def spark_positions(n_frames):
    """Precalcola le particelle (scintille) per l'intero loop, deterministico."""
    random.seed(7)
    origin = (W * 0.60, H * 0.66)
    particles = []
    t = 0.0
    spawn_every = 4  # frame
    for f in range(n_frames):
        if f % spawn_every == 0:
            particles.append({
                "born": f,
                "x": origin[0] + random.uniform(-18, 18),
                "y": origin[1] + random.uniform(-8, 8),
                "vx": random.uniform(-24, 24),
                "vy": random.uniform(-95, -55),
                "max_life": random.uniform(0.8, 1.4),
            })
    return particles


def main():
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    FINAL_DIR.mkdir(parents=True, exist_ok=True)

    particles = spark_positions(FRAMES)

    for f in range(FRAMES):
        t = f / FPS
        img = Image.new("RGB", (W, H), BG)

        # bagliore centrale pulsante (replica .hero__glow)
        glow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow_layer)
        pulse = 0.55 + 0.30 * (0.5 + 0.5 * math.sin(t / 6 * 2 * math.pi))
        gr = int(min(W, H) * 0.34)
        gcx, gcy = int(W * 0.5), int(H * 0.40)
        gd.ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr],
                   fill=ACCENT + (int(70 * pulse),))
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(60))
        img.paste(Image.alpha_composite(img.convert("RGBA"), glow_layer).convert("RGB"))

        draw_grid(img, offset=int(t * 8))

        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(layer, "RGBA")

        # ingranaggio che ruota, in alto a destra
        draw_gear(draw, cx=W * 0.80, cy=H * 0.30, r=min(W, H) * 0.30,
                  angle=(t * 0.10), alpha=46)

        # scansione diagnostica: banda orizzontale che scende in loop
        cycle = 4.2
        p = (t % cycle) / cycle
        sy = int(H * p)
        band = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bd = ImageDraw.Draw(band)
        for dy in range(-60, 60):
            fade = max(0, 1 - abs(dy) / 60)
            bd.line([(0, sy + dy), (W, sy + dy)], fill=ACCENT + (int(26 * fade),))
        layer = Image.alpha_composite(layer, band)
        draw = ImageDraw.Draw(layer, "RGBA")

        # scintille attive in questo frame
        for p_ in particles:
            age = (f - p_["born"]) / FPS
            life = age / p_["max_life"]
            if age < 0 or life >= 1:
                continue
            x = p_["x"] + p_["vx"] * age
            y = p_["y"] + p_["vy"] * age + 60 * age * age
            alpha = int(255 * (1 - life))
            size = 2.6 * (1 - life * 0.4)
            color = SPARK_WARM if life < 0.4 else ACCENT
            draw.ellipse([x - size, y - size, x + size, y + size],
                         fill=color + (alpha,))

        out = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
        out.save(OUT_DIR / f"f{f:04d}.png")

    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(FPS),
        "-i", str(OUT_DIR / "f%04d.png"),
        "-vf", "format=yuv420p",
        "-c:v", "libx264", "-crf", "24", "-preset", "medium",
        "-movflags", "+faststart",
        str(FINAL_DIR / "hero.mp4"),
    ], check=True)

    # anche un poster/frame statico per il fallback <img>/poster del <video>
    Image.open(OUT_DIR / "f0000.png").save(FINAL_DIR.parent / "img" / "hero-poster.jpg", quality=82)

    print("OK", FINAL_DIR / "hero.mp4")


if __name__ == "__main__":
    main()
