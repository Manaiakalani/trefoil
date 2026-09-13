# trefoil

[Live](https://manaiakalani.github.io/trefoil/) · [MIT](LICENSE)

A live 3D rainbow trefoil — one loop, three crossings. Drag it, recast it as a word, or drop a logo. Same candy studio.

![Rainbow trefoil in the white studio](docs/social.png)

![Studio demo](docs/demo.gif)

![Word recast as candy letters](docs/word.png)

![Mark recast as a candy logo](docs/mark.png)

## Quick start

```bash
git clone https://github.com/Manaiakalani/trefoil.git
cd trefoil
npm install
npm run dev
```

Open http://localhost:5173/

```bash
npm run build
npm run preview
npm run smoke
```

Needs Node 22+.

## How it works

The knot is a tube along the Wikipedia trefoil curve, then a `TubeGeometry` in [Three.js](https://threejs.org/):

```
x = sin t + 2 sin 2t
y = cos t − 2 cos 2t
z = −sin 3t
```

Eight uses `(2 + cos 2t) · (cos 3t, sin 3t)` with `z = sin 4t`. Cinq is the `(2, 5)` torus knot. Vertex colors walk the candy spectrum; Word and Mark trace a silhouette and extrude it to the same tube diameter.

[Trefoil knot](https://en.wikipedia.org/wiki/Trefoil_knot) · [Figure-eight knot](https://en.wikipedia.org/wiki/Figure-eight_knot_(mathematics)) · [Cinquefoil knot](https://en.wikipedia.org/wiki/Cinquefoil_knot) · [TubeGeometry](https://threejs.org/docs/#api/en/geometries/TubeGeometry)

## Controls

| Action | |
| --- | --- |
| Play / pause | Space, or the round button |
| Scrub | Rainbow strip, or ← → |
| Spectrum | Top-right slider, or `[` `]` |
| Knot / word / mark | `K` / `W` / `M` |
| Trefoil / eight / cinq | `T` / `E` / `C` |
| Speed | `1` `2` `3` for ½×, 1×, 1½× |
| Copy link | `L` |
| Save frame, GLB, or STL | Save menu, or `S` for a frame |
| Reset camera | `0` or double-click |
| Hide chrome | `H` |
| Keys | `?` |

URL query `t`, `hue`, `speed`, `subject`, `knot`, and `text` persist the view.

## Deploy

Static Vite app. GitHub Pages builds from `main`.

```bash
npm run build
```

## Rights

This repository is original WebGL. It does not include third-party video, rips, or stills from anyone else’s clip. Poster, Open Graph, and demo frames are captured from the live studio. Keep reference media of your own off this tree.

## Security

No server, no accounts, no stored uploads. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) for the code and original assets in this repository.
