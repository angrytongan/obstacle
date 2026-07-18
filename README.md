# obstacle

Browser gallery for visualising mountain bike obstacles — pick a type (roller,
berm, kicker), tweak its parameters, and see it rendered live in 3D.

Standalone: no terrain, no trail, no persistence — just one obstacle at a
time.

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
`THREE.BufferGeometry` centered on its own footprint); `src/main.ts` wires up
the scene, camera, lighting, and the type/parameter UI.
