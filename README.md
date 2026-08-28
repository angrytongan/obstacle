# obstacle

Browser app for planning real-world mountain bike obstacle builds: pick a
type (roller, berm, kicker), tweak its parameters, choose a construction
method, and see the 3D shape alongside CAD-style dimension lines, a 2D
per-part drawings tab, and a bill-of-materials tab.

Standalone: no terrain, no trail, no persistence — just one obstacle at a
time. Currently only the roller's earthen and timber-framed construction
methods are implemented — see [docs/status.md](docs/status.md) for what's
built and [docs/features.md](docs/features.md) for the other type/method
combinations still to come.

## Running

```
npm install
npm run dev        # start the dev server
npm test           # run tests
npm run lint        # lint
npm run typecheck   # type-check
```

## Deployment

Pushes to `main` build and publish to GitHub Pages via
`.github/workflows/deploy.yml` (lint/typecheck/test gate the build; the
GitHub Pages source must be set to "GitHub Actions" in repo settings).

## Stack

Vite + TypeScript + Three.js, no framework, no backend. `src/obstacles/`
holds pure geometry builders (one file per obstacle type, each a parametric
`THREE.BufferGeometry` centered on its own footprint); `src/construction/`
holds construction-method reference data and per-method bill-of-materials /
soundness-check calculations; `src/dimensions/` holds CAD-style 3D
dimension line builders; `src/drawings/` holds the 2D per-part shop
drawing engine (ported from the sibling `../half-pipe` app, which shares
this pattern with `../kicker`); `src/main.ts` wires up the scene, camera,
lighting, the tabbed 3D-view/2D-drawings/bill-of-materials layout, and the
type/method/parameter UI. `research/` holds source notes for the
real-world dimensions/ratios/standards the calculations are based on.
