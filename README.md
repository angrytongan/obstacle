# obstacle

Browser app for planning real-world mountain bike obstacle builds: pick a
type (roller, berm, kicker), tweak its parameters, choose a construction
method, and see a live bill of materials and CAD-style dimension lines
alongside the 3D shape.

Standalone: no terrain, no trail, no persistence — just one obstacle at a
time. Currently only the roller's earthen construction method is
implemented — see [docs/status.md](docs/status.md) for what's built and
[docs/features.md](docs/features.md) for the other type/method
combinations still to come.

## Running

```
npm install
npm run dev        # start the dev server
npm test           # run tests
npm run lint        # lint
npm run typecheck   # type-check
```

## Stack

Vite + TypeScript + Three.js, no framework, no backend. `src/obstacles/`
holds pure geometry builders (one file per obstacle type, each a parametric
`THREE.BufferGeometry` centered on its own footprint); `src/construction/`
holds construction-method reference data and per-method bill-of-materials /
soundness-check calculations; `src/dimensions/` holds CAD-style dimension
line builders; `src/main.ts` wires up the scene, camera, lighting, and the
type/method/parameter UI. `research/` holds source notes for the
real-world dimensions/ratios/standards the calculations are based on.
