# obstacle

Browser app for planning real-world mountain bike obstacle builds: pick a
type, adjust its parameters via sliders, choose a construction method, and
see the 3D shape plus a live bill of materials and soundness check.
Standalone — no terrain, no trail, no persistence (deliberate: see decision
below).

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
- **Construction method is a separate axis from obstacle type**: earthen,
  timber-framed, hybrid (timber core + dirt cap), metal-framed. Not every
  method is implemented for every type — the dropdown always lists all four
  per type, with unimplemented ones shown disabled as "— not yet
  implemented" (`IMPLEMENTED_METHODS` in `src/main.ts`), so the eventual
  shape of the feature is visible before it's built out.
- **BOM precision is "engineered cut list", grounded in published
  references** (span tables / standards), not invented numbers or bare
  rules of thumb — see each construction module's doc comment for its
  source. Always paired with a fixed disclaimer
  (`BOM_DISCLAIMER` in `src/main.ts`): a planning estimate, not a
  substitute for a qualified builder's/engineer's sign-off.
- **BOM updates live** on every parameter change (not on-demand) — chosen
  deliberately, unlike maketrail's on-demand trail simulation, since the
  calculations here are cheap.
- **Soil profile is a single conservative default**, no soil-type picker
  yet (`src/construction/soil.ts`): OSHA Type C's 34° safe unretained slope
  angle (29 CFR 1926 Subpart P, Appendix B) as the angle-of-repose ceiling,
  and a 20% compaction/waste factor (loose-vs-compacted fill volume).
- **Research notes are copied into this repo** (`research/`), not shared
  by reference with maketrail — only the notes actually relevant to what's
  built so far (currently just `rollers.md`); pull in more
  (e.g. `build-plans.md` for timber kicker/skinny builds) when their
  obstacle type/method is actually implemented, not speculatively.

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

**Construction / BOM** (`src/construction/`, all pure functions, tested):
only the roller's earthen method is implemented.

- `soil.ts` — `DEFAULT_SOIL_PROFILE` (safe slope angle, compaction waste
  factor), see decisions above for sourcing.
- `slopeCheck.ts` — `checkRollerSlope`: the roller's sine profile's
  steepest tangent angle (`height * pi * periods / length`, i.e. where the
  sine derivative peaks) compared against the soil profile's safe angle.
- `earthenBom.ts` — `calculateRollerEarthenBom`: compacted fill volume via
  the shoelace formula on the roller's own profile polygon (exported from
  `roller.ts` as `rollerProfilePoints`, shared with the 3D geometry builder
  so the two can't drift apart) × width; loose fill via the waste factor;
  geotextile fabric area as the footprint rectangle.
- Wired into `src/main.ts`'s BOM panel, which keeps the current 3D shape
  unchanged for earthen construction (no framing members to expose — see
  decisions above) and recalculates on every parameter/method change.

## Not built

- Timber-framed, hybrid, and metal-framed construction methods (any
  obstacle type) — these need a real dimensional-timber/steel stock
  catalog and published span tables, and (per decision above) should
  render actual structural geometry (posts/joists/decking), not just a
  BOM.
- Berm and kicker construction methods entirely (`IMPLEMENTED_METHODS` in
  `src/main.ts` lists none for either yet).
- Soil-type selection (currently one conservative default).
- Kicker landing/gap, berm mirroring, obstacle directionality indicators,
  terrain, trail, difficulty simulation — out of scope for this app.
