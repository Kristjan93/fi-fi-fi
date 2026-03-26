# /// script
# requires-python = ">=3.12"
# dependencies = ["Pillow", "numpy", "pillow-avif-plugin"]
# ///
"""
Process ESRI hillshade into a styled terrain image.

Pure elevation shading — white background for mix-blend-mode: multiply.

Run: uv run scripts/process-terrain.py
"""

import os
import numpy as np
from PIL import Image, ImageFilter
import pillow_avif  # noqa: F401

# ── Load ─────────────────────────────────────────────────

hillshade = Image.open("public/assets/raw-hillshade.png").convert("L")
mask = Image.open("public/assets/raw-mask.png").convert("L")

w, h = hillshade.size
print(f"Loaded: {w}x{h}")

img = np.array(hillshade, dtype=np.float32) / 255.0
mask_arr = np.array(mask) > 128

# ── Invert ───────────────────────────────────────────────

img = 1.0 - img

# ── Levels ───────────────────────────────────────────────

land = img[mask_arr]
p_low = np.percentile(land, 2)
p_high = np.percentile(land, 98)
img = np.clip((img - p_low) / (p_high - p_low), 0, 1)

# ── S-curve for midtone separation ───────────────────────

def s_curve(x: np.ndarray, strength: float = 0.7) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-(x - 0.5) * 5 * strength))

img = s_curve(img, strength=0.7)

# ── Compress range ───────────────────────────────────────

max_dark = 0.50
img = img * max_dark

# ── Ocean = pure white ───────────────────────────────────

img[~mask_arr] = 0.0

# ── Un-invert ────────────────────────────────────────────

img = 1.0 - img

# ── Clarity + sharpening ─────────────────────────────────

terrain = Image.fromarray((img * 255).astype(np.uint8), mode="L")
terrain = terrain.filter(ImageFilter.UnsharpMask(radius=15, percent=25, threshold=3))
terrain = terrain.filter(ImageFilter.UnsharpMask(radius=1.5, percent=35, threshold=2))

# ── Save ─────────────────────────────────────────────────

rgb = terrain.convert("RGB")

rgb.save("public/assets/iceland-map.avif", "AVIF", quality=80, speed=4)
avif_kb = os.path.getsize("public/assets/iceland-map.avif") / 1024

rgb.save("public/assets/iceland-map.webp", "WEBP", quality=92)
webp_kb = os.path.getsize("public/assets/iceland-map.webp") / 1024

print(f"AVIF: {avif_kb:.0f} KB | WebP: {webp_kb:.0f} KB")
print(f"Terrain: {max_dark:.0%} intensity")
