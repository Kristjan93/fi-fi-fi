# /// script
# requires-python = ">=3.12"
# dependencies = ["Pillow", "numpy", "pillow-avif-plugin"]
# ///
"""
Render route SVG paths as transparent overlay images.

Each route becomes its own image file — just the line on a transparent
background, same dimensions as the terrain. Stack as <img> layers in HTML.

Input:  src/map/iceland.svg (reads route <path> elements)
Output: public/assets/route-{id}.webp + .avif

Run: uv run scripts/render-routes.py
"""

import os
import re
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw
import pillow_avif  # noqa: F401

# ── Parse SVG for route paths ────────────────────────────

tree = ET.parse("src/map/iceland.svg")
root = tree.getroot()
ns = {"svg": "http://www.w3.org/2000/svg"}

# Get viewBox dimensions
vb = root.get("viewBox", "0 0 1920 1080").split()
vb_w, vb_h = int(vb[2]), int(vb[3])

# Output at same scale as terrain (3x for crisp zoom)
SCALE = 3
out_w, out_h = vb_w * SCALE, vb_h * SCALE

# Find route paths
routes = root.findall(".//{http://www.w3.org/2000/svg}path[@class='route']")
if not routes:
    # Try without namespace
    routes = [el for el in root.iter() if el.get("class") == "route"]

print(f"Found {len(routes)} route(s) in SVG")
print(f"Output size: {out_w}x{out_h}")

# ── Parse SVG path d attribute into points ───────────────

def parse_svg_path(d: str) -> list[tuple[float, float]]:
    """Extract coordinate pairs from an SVG path d attribute.
    Handles M, L, C (cubic bezier) commands — samples curves into points."""
    points = []
    # Split into commands
    tokens = re.findall(r'[MLCmlcQqSsZz]|[-+]?\d*\.?\d+', d)

    i = 0
    cx, cy = 0.0, 0.0
    cmd = 'M'

    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1

        if cmd in ('M', 'L'):
            cx, cy = float(tokens[i]), float(tokens[i+1])
            points.append((cx, cy))
            i += 2
            if cmd == 'M':
                cmd = 'L'  # implicit lineto after moveto
        elif cmd == 'C':
            # Cubic bezier: sample into line segments
            x1 = float(tokens[i]); y1 = float(tokens[i+1])
            x2 = float(tokens[i+2]); y2 = float(tokens[i+3])
            x3 = float(tokens[i+4]); y3 = float(tokens[i+5])
            # Sample the bezier curve
            steps = 20
            for t_i in range(1, steps + 1):
                t = t_i / steps
                u = 1 - t
                x = u*u*u*cx + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3
                y = u*u*u*cy + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
                points.append((x, y))
            cx, cy = x3, y3
            i += 6
        elif cmd == 'Z' or cmd == 'z':
            break
        else:
            i += 1  # skip unknown

    return points

# ── Render each route ────────────────────────────────────

# Line style — match the reference: navy blue, ~2px at 1x (6px at 3x)
LINE_COLOR = (26, 26, 92, 255)  # #1a1a5c with full alpha
LINE_WIDTH = 5  # at 3x scale

for route_el in routes:
    route_id = route_el.get("data-route", "unknown")
    d = route_el.get("d", "")

    if not d:
        print(f"  {route_id}: no path data, skipping")
        continue

    points = parse_svg_path(d)
    if len(points) < 2:
        print(f"  {route_id}: too few points ({len(points)}), skipping")
        continue

    # Scale points from viewBox coords to output pixels
    scaled = [(x * SCALE, y * SCALE) for x, y in points]

    # Draw on transparent canvas
    img = Image.new("RGBA", (out_w, out_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.line(scaled, fill=LINE_COLOR, width=LINE_WIDTH, joint="curve")

    # Save
    img.save(f"public/assets/route-{route_id}.webp", "WEBP", quality=90)
    webp_kb = os.path.getsize(f"public/assets/route-{route_id}.webp") / 1024

    img.save(f"public/assets/route-{route_id}.avif", "AVIF", quality=80, speed=4)
    avif_kb = os.path.getsize(f"public/assets/route-{route_id}.avif") / 1024

    print(f"  {route_id}: {len(points)} points → AVIF {avif_kb:.0f} KB, WebP {webp_kb:.0f} KB")
