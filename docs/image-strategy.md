# Image Strategy — FI Mountain Huts Map

> Reference doc for sourcing/generating images for the Iceland interactive map.
> The map uses hillshade terrain on a warm paper background (`#ddd8cf`) with `mix-blend-mode: multiply`. Images need to feel like they belong on a muted, cartographic surface, not a glossy travel brochure.

---

## 1. Items Needing Images

Images serve two roles on this map: **marker icons** (visible at the overview zoom level, replacing or augmenting the current dot markers) and **detail panel thumbnails** (shown inside the detail panel when a location is zoomed in).

### 1.1 Huts (16)

These are FI-owned mountain huts and shelters. They need both a marker icon (consistent hut symbol) and a small thumbnail for the detail panel.

| # | Name | Region | Notes |
|---|------|--------|-------|
| 1 | Landmannalaugar | Highlands | Large hut complex, hot spring |
| 2 | Hrafntinnusker | Highlands | High-altitude, often snowbound |
| 3 | Alftavatn | Highlands | Lakeside, Laugavegur trail |
| 4 | Hvanngil | Highlands | Small shelter, Laugavegur |
| 5 | Emstrur | Highlands | Laugavegur trail |
| 6 | Thorsmork/Langidalur | South | Valley, end of Laugavegur |
| 7 | Fimmvorduhals/Baldvinsskali | South | Between glaciers |
| 8 | Hvitarnes | Highlands | Kjalvegur trail |
| 9 | Thverbrekknnamuli | Highlands | Kjalvegur trail |
| 10 | Thjofadalir | Highlands | Remote, Kjalvegur |
| 11 | Hagavatn | Highlands | Near Langjokull |
| 12 | Hloduvellir | Highlands | Near Langjokull |
| 13 | Nyidalur | Highlands | Central highlands |
| 14 | Hornbjargsviti | Westfjords | Lighthouse keeper's house |
| 15 | Nordurfjordur/Valgeirsstadir | Westfjords | Hornstrandir |
| 16 | Saeluhusid a Mosfellsheidi | Southwest | Near Reykjavik, day hike |

### 1.2 Trails (7)

Trails are rendered as route overlays on the map (already handled by the SVG/WebP route pipeline). They need a small thumbnail or icon for the detail panel and/or nav list.

| # | Name | Length | Notes |
|---|------|--------|-------|
| 1 | Laugavegurinn | 54 km | Most famous Icelandic trek |
| 2 | Fimmvorduhals | ~25 km | Thorsmork to Skogar |
| 3 | Tindfjallahringur | ~30 km | Loop around Tindfjallajokull |
| 4 | Kjalvegur | ~55 km | Ancient highland route |
| 5 | Langjokuslseidir | varies | Routes around Langjokull |
| 6 | Sprengisandsleid | ~200 km | Central desert crossing |
| 7 | Hornstrandir | varies | Westfjords wilderness |

### 1.3 Attractions (17)

Points of interest along or near trails. Need a small thumbnail for the detail panel. Some may also get a distinct marker icon if they differ visually from hut markers.

| # | Name | Type | Near |
|---|------|------|------|
| 1 | Heitar laugar | Hot springs | Landmannalaugar |
| 2 | Litrikar liparitfjoll | Rhyolite mountains | Landmannalaugar |
| 3 | Fridland ad Fjallabaki | Nature reserve | Landmannalaugar |
| 4 | Hrafntinnuhraunssvaedid | Obsidian field | Hrafntinnusker |
| 5 | Ishellar | Ice caves | Hrafntinnusker |
| 6 | Alftaskard | Mountain pass | Alftavatn |
| 7 | Markarfljotsgljufur | Canyon | Emstrur |
| 8 | Valahnukur | Viewpoint peak | Thorsmork |
| 9 | Stakkholtsja | Canyon | Thorsmork |
| 10 | Nauthusagil | Ravine | Thorsmork |
| 11 | Magni og Modi | Eruption craters | Fimmvorduhals |
| 12 | Hagavatn | Glacial lake | Langjokull |
| 13 | Hlodufell | Tuya / table mountain | Langjokull |
| 14 | Tungnafellsjokull | Glacier | Central highlands |
| 15 | Hornbjarg | Sea cliffs | Hornstrandir |
| 16 | Arctic fox viewing | Wildlife | Hornstrandir |
| 17 | Krossneslaug | Hot spring by ocean | Westfjords |

### 1.4 Summary

| Category | Count | Marker icon | Detail thumbnail |
|----------|-------|-------------|------------------|
| Huts | 16 | Yes (shared icon) | Yes (individual) |
| Trails | 7 | No (route overlay) | Yes (individual) |
| Attractions | 17 | Yes (category icons) | Yes (individual) |
| **Total** | **40** | ~18 icons | ~40 thumbnails |

---

## 2. Image Approach Options

### 2.1 Marker Icons: SVG/CSS, Not Photos

**Recommendation: Hand-drawn-style SVG icons, not photographs.**

Marker icons appear at 10-20px on the map at overview zoom. Photos are unreadable at that size. The current map uses simple CSS dots (`.marker__dot` -- 10px circles). The upgrade path is small SVG icons that match the cartographic aesthetic:

- **Huts**: A simple peaked-roof cabin silhouette. One icon, reused for all 16.
- **Hot springs**: Wavy steam lines rising from a pool.
- **Viewpoints/peaks**: A small triangle or peak symbol.
- **Canyons/ravines**: A V-shaped notch.
- **Geology (rhyolite, obsidian, lava)**: A crystal/rock symbol.
- **Wildlife**: A small fox silhouette (only used once).
- **Glacier**: An ice cap shape.

These should be inline SVG or a small SVG sprite. No image loading, zero network cost, scales perfectly at any zoom level. Color: `currentColor` so they inherit the map's `--map-text` value.

**Where to get them:**
- Draw them by hand in Figma/Inkscape (5-10 simple shapes, 30 min total)
- Use an open-source icon set as a starting point: [Maki by Mapbox](https://labs.mapbox.com/maki-icons/) (CC0, designed for maps) or [Temaki](https://ideditor.github.io/temaki/docs/) (map-specific supplement)
- Generate with an AI image tool then trace to SVG (overkill for simple icons)

### 2.2 Detail Panel Thumbnails: The Main Challenge

When a user zooms to a location, the detail panel shows a text description. Adding a small thumbnail image (roughly 200-300px wide, displayed at ~160px) would give each location a visual identity. These images need to:

- Work at small sizes (thumbnail, not hero)
- Match the warm/muted palette (or be desaturated to fit)
- Feel consistent as a set
- Load fast (performance-first site)

**Technical constraints:**
- Format: AVIF (same as terrain -- all evergreen browsers support it since 2022)
- Size target: 200-300px wide source, displayed at ~160px, AVIF quality 60-70 should keep each file under 10-15 KB
- Loading: `loading="lazy"` + `decoding="async"` since they are below the fold and inside panels that start hidden

#### Option A: Photographs (Free Sources)

| Source | License | Quality for Iceland | Notes |
|--------|---------|---------------------|-------|
| **Wikimedia Commons** | CC-BY-SA / public domain | Excellent for well-known spots | Many Iceland hiking photos. Must check individual license per image. |
| **Unsplash** | Unsplash License (free, no attribution required) | Good for popular locations | Tends toward glossy travel photography -- would need desaturation/filter. |
| **Flickr Creative Commons** | CC-BY or CC-BY-SA | Very good for obscure huts | Icelandic hiking community shares extensively. Best source for individual FI huts. |
| **Pexels** | Pexels License (free) | Limited for specific huts | Better for generic landscapes than named locations. |
| **FI's own site (fi.is)** | Permission needed | Authentic | FI publishes photos of their own huts. Would need to ask. Best for authenticity. |

**Verdict:** Wikimedia Commons and Flickr CC are the best sources for *specific* named huts and trails. Unsplash works for generic landscape/attraction shots but would need post-processing to match the muted palette.

**Post-processing to match the map aesthetic:**
Apply a consistent CSS filter to all thumbnails in the detail panel:
```css
.map__detail-thumb {
  filter: grayscale(0.3) contrast(0.9) sepia(0.15);
  border-radius: 4px;
}
```
This pulls glossy photos toward the warm, muted map palette without needing to edit each file. Alternatively, batch-process with ImageMagick before shipping:
```sh
magick input.jpg -modulate 95,70,100 -fill '#ddd8cf' -colorize 10% -quality 65 output.avif
```

#### Option B: AI-Generated Illustrations

Generate consistent, stylized illustrations rather than photographs. This guarantees visual consistency and avoids licensing complexity. The images would look like they were drawn for the map rather than pulled from a stock photo site.

| Tool | Free Tier | Quality | Style Control | Best For |
|------|-----------|---------|---------------|----------|
| **Stable Diffusion (local)** | Completely free (run locally) | Very good with right model | Excellent (LoRA, style transfer) | Full control, batch generation, custom style |
| **DALL-E 3 (via ChatGPT)** | ChatGPT Plus includes it | Good | Moderate | Quick one-offs, good at composition |
| **Ideogram** | 10 free/day | Good for text + design | Good | Stylized, graphic illustration |
| **Leonardo.ai** | 150 free tokens/day | Good | Good (fine-tuning available) | Consistent style across batch |
| **Bing Image Creator** | Free (Microsoft account) | Moderate | Limited | Quick, no cost |
| **Midjourney** | No free tier (paid) | Excellent | Very good | Best overall quality, but costs money |

**Verdict:** Stable Diffusion (local) is the best option for this project. Free, fully controllable, and you can lock a consistent style via a LoRA or a fixed prompt suffix. If you do not want to run it locally, Leonardo.ai's free tier is enough for 42 images over a few days.

#### Option C: Hybrid -- SVG Vignettes

Instead of photographs or AI illustrations, create simple monochrome vignettes that feel like cartographic symbols scaled up. Think: the small illustrations you see in the margins of high-end hiking guidebooks or on old Ordnance Survey maps. A mountain ridgeline silhouette for Hornbjarg. A simplified cabin for each hut. Steam curls for hot springs.

These could be hand-drawn SVG or AI-generated and traced to SVG. They would integrate most naturally with the map's aesthetic since they are the same medium (vector, monochrome, cartographic).

**Verdict:** This is the most aesthetically coherent option but the most labor-intensive if done by hand. AI generation + auto-trace is a viable shortcut.

### 2.3 Recommended Approach

**Markers: SVG icons** (Section 2.1). Small set of ~8 reusable category symbols. Inline SVG, zero network cost.

**Detail thumbnails: AI-generated monochrome illustrations** (Option C/B hybrid). Use Stable Diffusion or Leonardo.ai to generate ink-wash or engraving-style illustrations for each location, then apply a consistent warm tint via CSS or batch processing. This gives:
- Consistent style (locked prompt template)
- Authenticity (custom illustrations feel more "FI" than stock photos)
- Small file size (monochrome/limited palette compresses extremely well in AVIF)
- No licensing concerns

If AI generation proves too slow or inconsistent for specific huts, supplement with Wikimedia/Flickr CC photos run through the desaturation pipeline.

---

## 3. Image Generation Prompts

All prompts below are designed for Stable Diffusion (SDXL or SD 1.5 with an appropriate model) or DALL-E 3 / Leonardo.ai. They share a common style suffix that locks the aesthetic.

### 3.1 Style Suffix (Append to All Prompts)

```
Style: monochrome ink wash illustration on off-white paper. Muted warm tones,
sepia-tinted. Loose brushwork with visible paper texture. No sharp outlines.
Feels like a field sketch from a mountaineer's journal. Color palette restricted
to warm greys, raw umber, and faint ochre. No saturated colors. No text or
labels. Square composition, simple background fading to white at edges.
Atmospheric, understated, not dramatic.
```

This suffix produces images that:
- Blend naturally with the `#ddd8cf` paper background via `mix-blend-mode: multiply`
- Look like they were drawn specifically for this map
- Compress well (limited palette = small AVIF)
- Read clearly at thumbnail size (ink wash has high contrast shapes)

### 3.2 Hut Thumbnails

**Template -- use for all 16 huts, varying the setting description:**

```
A small Icelandic mountain hut in [SETTING]. [DETAILS]. The hut is modest,
with a corrugated metal roof and dark walls, typical of Icelandic highland
shelters. A few hiking poles lean against the entrance. The landscape is vast
and empty around it. [STYLE SUFFIX]
```

| Hut | Setting | Details |
|-----|---------|---------|
| Landmannalaugar | a broad valley surrounded by colorful rhyolite hills | Steam rising from a nearby hot spring. Green moss patches on dark lava |
| Hrafntinnusker | a high exposed plateau covered in patchy snow | Strong wind suggested by cloud streaks. Stark, minimal landscape |
| Alftavatn | the shore of a calm highland lake | Gentle hills reflected in still water. A few tufts of grass |
| Hvanngil | a sheltered ravine between two ridges | A small stream running past. Compact, intimate setting |
| Emstrur | a wide dark sand flat with distant glaciers | Sparse vegetation. The hut is tiny against the vast emptiness |
| Thorsmork/Langidalur | a green valley floor surrounded by steep mountains | Birch scrub and wildflowers. Lush compared to the highlands |
| Fimmvorduhals/Baldvinsskali | a high mountain pass between two glaciers | Snow patches nearby. The hut sits on a rocky ridge |
| Hvitarnes | a gentle highland plateau near a river | Rolling terrain, soft light. Classic interior highland feel |
| Thverbrekknnamuli | a remote highland moor | Flat terrain stretching to distant mountains. Solitary |
| Thjofadalir | a hidden valley among dark mountains | Narrow valley, dramatic peaks above. The name means "thieves' valleys" |
| Hagavatn | near a milky glacial lake below a glacier | Turquoise-grey water. Moraines and glacial debris |
| Hloduvellir | the vast Sprengisandur desert | Endless grey-brown sand and gravel. The most isolated feeling |
| Nyidalur | a sheltered oasis in the central highlands | A green patch surrounded by barren highland desert |
| Hornbjargsviti | a clifftop above the Arctic sea | A converted lighthouse keeper's dwelling. Dramatic sea cliffs below |
| Nordurfjordur/Valgeirsstadir | a remote fjord in the Westfjords | Steep green hillsides dropping to the sea. No road access |
| Saeluhusid a Mosfellsheidi | a gentle moorland close to Reykjavik | Heather and moss. Low clouds. An easy walk from civilization |

### 3.3 Trail Thumbnails

**Template -- use for all 7 trails, varying the landscape:**

```
A narrow hiking trail winding through [LANDSCAPE]. No people visible. The path
is a thin worn line through the terrain, marked by occasional [MARKERS]. The
perspective is from a hillside looking along the trail as it disappears into
the distance. [STYLE SUFFIX]
```

| Trail | Landscape | Markers |
|-------|-----------|---------|
| Laugavegurinn | colorful rhyolite hills transitioning to green valleys, with steam vents and black sand | wooden stakes with yellow tips |
| Fimmvorduhals | a high ridge between two ice caps, with fresh lava fields and snow patches | cairns on the rocky ground |
| Tindfjallahringur | a circuit around a small ice-capped mountain, with views across highland rivers | small rock cairns |
| Kjalvegur | a wide gravelly highland plateau, with distant table mountains and a faint river | ancient stone waymarkers |
| Langjokuslseidir | rolling terrain at the edge of a vast white glacier, with black volcanic sand | vehicle tracks in the sand |
| Sprengisandsleid | an immense featureless grey desert stretching to the horizon under heavy clouds | widely spaced poles |
| Hornstrandir | dramatic coastal cliffs and steep green hillsides above the Arctic sea | no markers, just a faint path |

### 3.4 Attraction Thumbnails

These are more varied, so prompts are grouped by type with individual items listed.

#### Hot Springs / Geothermal

```
A natural hot spring pool in the Icelandic highlands. Steam rising gently from
the surface of pale blue-green water. Rough volcanic rock edges, patches of
bright green moss. No people, no built structures. Quiet, primal atmosphere.
[STYLE SUFFIX]
```

**Use for:** Heitar laugar (Landmannalaugar hot springs)

```
A small concrete pool built into a grassy coastal hillside, overlooking a vast
grey ocean. Steam rising. Utterly remote and elemental. [STYLE SUFFIX]
```

**Use for:** Krossneslaug

#### Geological Features

```
[FEATURE DESCRIPTION]. Geological, almost abstract in its textures. The scale
is grand but the mood is quiet. [STYLE SUFFIX]
```

| Attraction | Feature Description |
|------------|---------------------|
| Litrikar liparitfjoll | Rounded rhyolite mountain ridges striped in rust, ochre, pale green, and lavender. Patches of snow in the gullies. The colors are muted but still visible through the warm monochrome wash |
| Hrafntinnuhraunssvaedid | A field of black obsidian chunks, glassy and angular, scattered across grey volcanic soil. Faint reflections on the obsidian surfaces |
| Ishellar | The dark entrance to an ice cave in a glacier, with pale blue ice visible inside. Black volcanic ground leading to the opening |
| Hlodufell | A flat-topped table mountain (tuya) rising abruptly from a plain, its steep sides showing columnar basalt. Formed under a glacier |
| Tungnafellsjokull | A distant glacier cap sitting on a dark highland mountain, clouds wrapped around its flanks |

#### Canyons and Ravines

```
[CANYON DESCRIPTION]. The walls are dark volcanic rock, layered and textured.
A thin stream or river at the bottom. The scale dwarfs everything. Seen from
above or from the rim. [STYLE SUFFIX]
```

| Attraction | Canyon Description |
|------------|-------------------|
| Markarfljotsgljufur | A vast canyon cutting through dark highlands. The river far below is a thin grey-green thread. The canyon walls are 200 meters deep, striated and ancient |
| Stakkholtsja | A narrow slot canyon with vertical walls, a thin waterfall at the far end catching faint light. Mossy walls, intimate scale |
| Nauthusagil | A hidden ravine, almost a crack in the earth, with a chain bolted to the wall for scrambling. Ferns and moss. A secret passage |

#### Viewpoints and Passes

```
[VIEW DESCRIPTION]. The perspective emphasizes the vastness of the landscape
below. A solitary figure would be ant-sized. [STYLE SUFFIX]
```

| Attraction | View Description |
|------------|-----------------|
| Alftaskard | A high mountain pass with sweeping views down to a highland lake. The trail is a thin switchback line ascending the slope |
| Valahnukur | The summit of a small pointed peak, looking down at a braided glacial river system winding through a vast green valley |

#### Volcanic / Eruption

```
Two symmetrical volcanic craters on a high barren ridge, surrounded by fresh
dark lava rock with patches of red and orange mineral staining. Snow on the
ground around them. Recent eruption site feel, raw and primordial. [STYLE SUFFIX]
```

**Use for:** Magni og Modi

#### Lake

```
A milky glacial lake at the base of a glacier tongue. The water is pale
turquoise-grey. Moraines of dark gravel surround it. The glacier is cracked and
retreating. Desolate, beautiful. [STYLE SUFFIX]
```

**Use for:** Hagavatn

#### Nature Reserve

```
A sweeping highland valley seen from a high vantage point. The landscape is a
patchwork of dark lava, green moss, pale rhyolite ridges, and winding rivers.
No buildings, no roads. The word "reserve" made physical -- land protected and
untouched. [STYLE SUFFIX]
```

**Use for:** Fridland ad Fjallabaki

#### Sea Cliffs

```
Towering vertical sea cliffs plunging into the North Atlantic. Thousands of
seabirds nesting on narrow ledges. The ocean is dark and rough below. The
cliff face is layered basalt, weathered by centuries. Hornbjarg, the
northernmost point of Iceland. [STYLE SUFFIX]
```

**Use for:** Hornbjarg cliffs

#### Wildlife

```
An Arctic fox in its summer coat (brown-grey), trotting across a green
hillside. Small, compact, alert. The landscape is coastal Westfjords -- steep
grassy slopes above the sea. The fox is the only living thing in frame.
[STYLE SUFFIX]
```

**Use for:** Arctic fox viewing

---

## 4. Prompt Summary Table

Quick reference: which prompt to use for each item.

| # | Item | Prompt Template |
|---|------|-----------------|
| **Huts** | | |
| 1-16 | All 16 huts | Section 3.2 hut template + per-hut setting |
| **Trails** | | |
| 17-23 | All 7 trails | Section 3.3 trail template + per-trail landscape |
| **Attractions** | | |
| 24 | Heitar laugar | Hot springs (highland) |
| 25 | Litrikar liparitfjoll | Geological -- rhyolite |
| 26 | Fridland ad Fjallabaki | Nature reserve |
| 27 | Hrafntinnuhraunssvaedid | Geological -- obsidian |
| 28 | Ishellar | Geological -- ice cave |
| 29 | Alftaskard | Viewpoint -- pass |
| 30 | Markarfljotsgljufur | Canyon |
| 31 | Valahnukur | Viewpoint -- peak |
| 32 | Stakkholtsja | Canyon -- slot |
| 33 | Nauthusagil | Canyon -- ravine |
| 34 | Magni og Modi | Volcanic craters |
| 35 | Hagavatn | Lake |
| 36 | Hlodufell | Geological -- tuya |
| 37 | Tungnafellsjokull | Geological -- glacier |
| 38 | Hornbjarg | Sea cliffs |
| 39 | Arctic fox viewing | Wildlife |
| 40 | Krossneslaug | Hot springs (coastal) |

---

## 5. Production Pipeline

Once images are generated or sourced, the processing pipeline is:

```sh
# 1. Batch resize + warm-tone filter (ImageMagick)
for f in raw-thumbs/*.png; do
  magick "$f" \
    -resize 300x300^ -gravity center -extent 300x300 \
    -modulate 95,60,100 \
    -fill '#ddd8cf' -colorize 8% \
    "processed/$(basename "$f" .png).png"
done

# 2. Convert to AVIF (using avifenc or ImageMagick)
for f in processed/*.png; do
  avifenc "$f" --min 30 --max 45 -s 4 \
    "public/assets/thumbs/$(basename "$f" .png).avif"
done
```

**Target file sizes:** 8-15 KB per thumbnail at 300px wide, AVIF quality ~40.

**CSS for display:**
```css
.map__detail-thumb {
  width: 160px;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
  filter: grayscale(0.2) sepia(0.1);
  opacity: 0.85;
}
```

**HTML in detail panel:**
```html
<div class="map__detail" data-location="lml">
  <img class="map__detail-thumb" src="/assets/thumbs/landmannalaugar.avif"
       alt="Skali Landmannalaugar" loading="lazy" decoding="async" width="160" height="160" />
  <span class="map__detail-label">Halendi</span>
  <h3 class="map__detail-name">Landmannalaugar</h3>
  <p class="map__detail-info">...</p>
</div>
```

---

## 6. Marker Icon Sprite

A single inline SVG block with symbol definitions, referenced via `<use>`:

```html
<!-- In index.html, hidden -->
<svg style="display:none">
  <symbol id="icon-hut" viewBox="0 0 24 24">
    <!-- Simple peaked-roof cabin -->
    <path d="M12 2L3 12h3v8h12v-8h3L12 2z" fill="none" stroke="currentColor"
          stroke-width="1.5" stroke-linejoin="round"/>
  </symbol>
  <symbol id="icon-spring" viewBox="0 0 24 24">
    <!-- Steam rising from pool -->
    <path d="M6 20c0-3 4-3 4-6s-4-3-4-6M12 20c0-3 4-3 4-6s-4-3-4-6M18 20c0-3 4-3 4-6"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </symbol>
  <!-- ... more symbols -->
</svg>

<!-- In marker -->
<span class="marker__icon">
  <svg width="14" height="14"><use href="#icon-hut"/></svg>
</span>
```

These are rough placeholders — the SVG paths are not production-ready. Final icons should be drawn or sourced from [Maki](https://labs.mapbox.com/maki-icons/) / [Temaki](https://ideditor.github.io/temaki/docs/) and refined to match the map's stroke weight and feel.

---

## 7. Decision Log

| Decision | Rationale |
|----------|-----------|
| AI-generated ink wash illustrations over stock photos | Consistent style, no licensing, compresses well, matches cartographic aesthetic |
| AVIF-only for thumbnails | Same rationale as terrain: all evergreen browsers since 2022, ~30-50% smaller than WebP |
| SVG icons for map markers, not raster | Scales at any zoom level, zero network cost, inherits color |
| CSS filter for tonal consistency | Cheaper than editing each image; can be tweaked globally |
| 300px source, 160px display | 2x density for retina, keeps AVIF files under 15 KB |
| Square aspect ratio for thumbnails | Simplifies layout, works in detail panel without complex responsive sizing |
| `loading="lazy"` + `decoding="async"` | Thumbnails are below fold and inside hidden panels; no reason to block page load |
