# trefoil

A 16:9 studio for the rainbow trefoil knot: the original film, pixel-for-pixel, and a live WebGL reconstruction you can turn in your hands.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build
npm run preview
```

## Views

- **Film** — the source clip at 1920×1080, 60 fps, 22.883s. This is the pixel-perfect path.
- **Live** — a 3D trefoil fitted to that clip. Drag to orbit. Spectrum still shifts the candy colors.

## Controls

| Action | |
| --- | --- |
| Play / pause | Space, or the round button |
| Scrub | Rainbow strip, or ← → |
| Spectrum | Top-right slider, or `[` `]` |
| Film / live | `F` / `L`, or the labels |
| Speed | `1` `2` `3` for ½×, 1×, 1½× |
| Save frame | `S` |
| Reset camera | `0` or double-click (live) |
| Hide chrome | `H` |
| Full screen | Full screen button |
| Keys | `?` |

Drag on the live knot to turn it. URL query `mode`, `t`, `hue`, and `speed` persist the view.

## Deploy

Static Vite app. `public/source.mp4` is the original film.

```bash
npm run build
npx vercel --yes
```

GitHub Pages builds from `main` via `.github/workflows/pages.yml` (`base` `/trefoil/`).

## Source

The film is the user-supplied clip. Live mode is a trefoil tube (Wikipedia hypotrochoid) with poses fitted per-frame against that film. Geometry, hue, and glow follow the source; they will not be pixel-identical in live view.
