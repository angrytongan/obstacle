# obstacle

Browser gallery that visualises mountain bike obstacles: pick a type, adjust
its parameters via sliders, see it live in 3D. Standalone — no terrain, no
trail, no persistence (deliberate: see decision below).

## Stack

Vite + TypeScript + Three.js, no framework, no backend, Vitest, ESLint (flat
config, `typescript-eslint` recommended). `npm run dev` / `build` / `test` /
`lint` / `typecheck`.

## Decisions

- **Standalone geometry code.** The obstacle geometry builders are written
  fresh for this app, kept independent on purpose.
- **3D view only**, no 2D top-down view — there's no terrain to place
  obstacles on, so a 2D view has nothing to add here.
- **Params reset to type defaults on switching obstacle type** — no
  per-type state persisted while the page is open.
- Obstacle mesh material uses `THREE.DoubleSide` (see `src/main.ts`) so the
  hand-built berm mesh renders regardless of triangle winding — a ponytail
  simplification, not a bug fix if the berm ever looks inside-out.

## Status

Three obstacle types built, each a pure geometry builder in
`src/obstacles/` with its own defaults/param ranges wired into
`src/main.ts`'s generic slider UI:

- `roller.ts` — sine-wave hump profile (`length`/`height`/`width`/`periods`),
  built via `THREE.Shape` + `ExtrudeGeometry`.
- `berm.ts` — banked turn: a flat tilted cross-section swept along a
  circular arc (`radius`/`sweepAngleDeg`/`bankAngleDeg`/`width`), hand-built
  `BufferGeometry` (no stdlib extrude-along-arc primitive exists). Only
  banks toward one side, no direction flag.
- `kicker.ts` — takeoff ramp only, no linked gap/landing. Radius is derived
  from `height`/`lipAngleDeg` (tangent-circle arc), not an independent
  param, so the two stay geometrically consistent.

All three share `src/obstacles/util.ts`'s `centerFootprint` — centers
geometry on X/Z via bounding box, leaves Y untouched so the base sits at 0.

Scene (`src/main.ts`): `PerspectiveCamera` + `OrbitControls`, ambient +
raking directional light with shadows, a flat ground plane, flat-shaded
solid-color materials (schematic style, no textures).

## Not built

Kicker landing/gap, berm mirroring, obstacle directionality indicators,
terrain, trail, difficulty simulation — out of scope for this app.
