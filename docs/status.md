# Status

What's built and how. Update this after each completed feature — check [features.md](features.md) for what isn't built yet.

## Obstacles

Three obstacle types built, each a pure geometry builder in
`src/obstacles/` with its own defaults/param ranges wired into
`src/main.ts`'s generic slider UI:

- `roller.ts` — sine-wave hump profile (`length`/`height`/`widthStart`/
  `widthEnd`/`periods`), width linearly tapered along the length. Hand-built
  `BufferGeometry` (four ruled quad strips: top, bottom, left wall, right
  wall — `ExtrudeGeometry` can't vary its extrusion depth, which a taper
  needs), not `THREE.Shape`/`ExtrudeGeometry` as before. `rollerWidthAt(x,
  params)` is the shared taper lerp, reused by the earthen BOM's fill-volume
  integration and by the dimension-line builder.
- `berm.ts` — banked turn: a flat tilted cross-section swept along a
  circular arc (`radius`/`sweepAngleDeg`/`bankAngleDeg`/`width`), hand-built
  `BufferGeometry` (no stdlib extrude-along-arc primitive exists). Only
  banks toward one side, no direction flag.
- `kicker.ts` — takeoff ramp only, no linked gap/landing. Radius is derived
  from `height`/`lipAngleDeg` (tangent-circle arc), not an independent
  param, so the two stay geometrically consistent.

All three share `src/obstacles/util.ts`'s `centerFootprint` — centers
geometry on X/Z via bounding box, leaves Y untouched so the base sits at 0.

A "Reset to defaults" button (`#reset-btn`) below the sliders calls
`resetParams()` — the same param reset `selectType` does on switching
obstacle type, but keeps the current construction method selection rather
than also re-running `renderMethodOptions`.

## Scene

`src/main.ts`: `PerspectiveCamera` + `OrbitControls` (no damping — rotate/
pan/zoom all stop instantly), ambient + raking directional light with
shadows, a flat ground plane, flat-shaded solid-color materials (schematic
style, no textures).

`index.html` layout: an `.app-header` (bike icon, title, "in development"
pill, GitHub link) matching maketrail's header, above an `.app` flex row
holding the `#panel` (options) and `#viewport` (3D view) cards.

## Deployment

`.github/workflows/deploy.yml`: on push to `main` (or manual
`workflow_dispatch`), runs lint/typecheck/test/build then publishes
`dist/` to GitHub Pages via `actions/deploy-pages`. `vite.config.ts` sets
`base: "/obstacle/"` to match the project-Pages subpath. Requires the
repo's Settings → Pages → Source set to "GitHub Actions" (one-time, not
done by the workflow itself).

## Construction / BOM

`src/construction/`, all pure functions, tested. Only the roller's earthen
method is implemented.

- `soil.ts` — `DEFAULT_SOIL_PROFILE` (safe slope angle, compaction waste
  factor), see [decisions.md](decisions.md) for sourcing.
- `slopeCheck.ts` — `checkRollerSlope`: the roller's sine profile's
  steepest tangent angle (`height * pi * periods / length`, i.e. where the
  sine derivative peaks) compared against the soil profile's safe angle.
- `earthenBom.ts` — `calculateRollerEarthenBom`: compacted fill volume via
  trapezoidal integration of cross-sectional area (`y(x) * rollerWidthAt(x,
  params)`) along the roller's own profile samples (`rollerProfilePoints`,
  shared with the 3D geometry builder so the two can't drift apart) —
  needed once width tapers along the length, since volume is no longer a
  constant cross-section × width; loose fill via the waste factor;
  geotextile fabric area as the footprint trapezoid (`length * average
  width`). Returns both `compactedFillVolumeM3` and `looseFillVolumeM3` —
  the BOM UI only shows the latter as an orderable line (see decisions.md).
- Wired into `src/main.ts`'s BOM panel, which keeps the current 3D shape
  unchanged for earthen construction (no framing members to expose — see
  decisions.md) and recalculates on every parameter/method change.
- Every BOM line item and the slope constraint badge has an info icon
  (`infoIcon()`/`BOM_INFO` in `src/main.ts`) — hover or click opens a
  tooltip explaining what the item is or, for the slope constraint, citing
  its source. See decisions.md's "Tooltip UI" for the tooltip's
  architecture.

## Dimension lines

`src/dimensions/`, pure geometry functions, tested; DOM-touching label
creation lives in `src/main.ts` only. Roller only.

- `dimensionLine.ts` — `buildLinearDimension(start, end, offsetDir,
  offsetDistance)`: two extension lines from the measured points out to an
  offset dimension line, with two `ArrowHelper`s trimmed to just their
  cone (`headLength` ≈ arrow `length`) pointing outward at each end.
  Returns `{ group, labelPosition }` — no text/DOM involved, so it's
  testable in Node like the obstacle/construction modules.
- `rollerDimensions.ts` — `buildRollerDimensions`: composes four linear
  dimensions (length/width-start/width-end/height), one per side of the
  footprint so none overlap — width gets two dimensions, one per end,
  since it tapers. Height is anchored at the roller's first crest
  (`x = length/(2*periods)`) rather than an edge, since the roller's
  edges are always at `y=0` — the `height` param is only actually reached
  there.
- `src/main.ts`'s `createLabelSprite` draws each label onto an offscreen
  `<canvas>` (text + a translucent white background) and wraps it as a
  `THREE.Sprite` via `CanvasTexture`. `rebuildDimensions` keeps an
  explicit disposer over exactly what it created on the last call —
  disposing each sprite's texture/material and removing it from the
  scene, and disposing only the `THREE.Line` geometries it created (never
  the geometry inside an `ArrowHelper`, which Three.js shares as static
  geometry across every `ArrowHelper` instance app-wide; disposing it
  there would break arrows everywhere, not just the ones being replaced).
- Dimension geometry sits 0.01m above the ground plane to avoid z-fighting
  with the terrain.
