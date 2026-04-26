# App Icon System

## Canonical source

`icon-192.png` / `icon-512.png` are the canonical raster icons. Export them from your design source at 192 and 512 px.

`app-icon.svg` is an SVG approximation (green bg + emoji). It is **not** used at runtime — keep it only as a template reference.

## Files

| File | Size | Used by |
|---|---|---|
| `favicon-16.png` | 16×16 | Browser tab |
| `favicon-32.png` | 32×32 | Browser tab |
| `apple-touch-icon.png` | 180×180 | iOS home-screen icon |
| `icon-192.png` | 192×192 | App header `<img>`; PWA manifest (`any`) |
| `icon-512.png` | 512×512 | PWA manifest (`any`) |
| `icon-512-maskable.png` | 512×512 | PWA manifest (`maskable`) |
| `app-icon.svg` | scalable | Template/reference only — not referenced at runtime |
| `icon-192.svg` | scalable | Legacy template — not referenced at runtime |
| `icon-512.svg` | scalable | Legacy template — not referenced at runtime |

## Maskable icon

`icon-512-maskable.png` must keep all meaningful artwork inside the central safe area
(roughly a circle inscribed in the 512×512 canvas, ~66% of the diameter).
The outer 17% on each side may be cropped by the OS.

## Updating icons

1. Edit `app-icon.svg`.
2. Export PNGs at the required sizes (see table above).
3. Replace the corresponding `.png` files.
4. Bump `CACHE_NAME` in `public/sw.js` (current: `cucina-vue-v7`).
5. Verify `public/manifest.webmanifest` and `index.html` reference the correct filenames.
