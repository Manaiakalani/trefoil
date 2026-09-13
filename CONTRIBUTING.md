# Contributing

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173/

```bash
npm run build
npm run preview
```

## Project shape

| Path | Role |
| --- | --- |
| `src/main.js` | App shell: film vs live, URL, keys, uploads |
| `src/scene.js` | Three.js studio |
| `src/contours.js` | Silhouette tracing for words and marks |
| `public/source.mp4` | Original film |
| `.github/workflows/pages.yml` | GitHub Pages build |

Live 3D is loaded only when Live is opened.

## Pull requests

Keep changes scoped. Match the existing sentence-case chrome and the white candy studio. Do not add analytics, accounts, or a backend without an issue first.

## Security

See [SECURITY.md](SECURITY.md). Do not commit secrets, `.env` files, or large binaries besides the film and demo GIF.
