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

## Undo/redo + persistence

`src/history.ts` (ported from `../kicker`, see decisions.md) — a generic,
immutable `History<T> = { past, present, future }` with
`createHistory`/`pushHistory`/`undoHistory`/`redoHistory`, tested in
`history.test.ts`.

`src/main.ts`'s `AppState` is everything the sliders/selects/checkboxes
control — `type`, `method`, `params`, `centerRail`,
`additionalPostsPerSection`, `railOutline`, and `wireframe`/`show`
(`Record<string, boolean>` keyed by `COMPONENT_TOGGLES` id, since those two
toggle groups live directly on Three.js materials/groups rather than their
own `let`s). `historyState: History<AppState>` starts from
`loadInitialState()` — `localStorage.getItem("obstacle-app-state")`,
`JSON.parse`d and merged field-by-field over `DEFAULT_APP_STATE` in a
try/catch (a corrupted blob, or one missing a since-added field, falls
back per-field rather than crashing), or `DEFAULT_APP_STATE` outright if
nothing's saved yet.

`currentParams`/`currentMethod`/`currentCenterRail`/
`currentAdditionalPostsPerSection` are a live/draft view seeded from
`historyState.present` — mutated directly on every slider `input` tick for
instant preview, same as before this feature. `commit()` folds the live
values (via `snapshot()`, which also reads `railOutlinesGroup.visible` and
each `COMPONENT_TOGGLES` entry's `material.wireframe`/`group.visible` off
the Three.js objects directly) into `historyState` and
`localStorage.setItem`s it — called after every discrete change completes:
a slider's `change` event (fires once on drag release, not per-tick, so a
whole drag is one undo step), `type-select`/`method-select` `change`,
`reset-btn` click, and every timber-method checkbox's `change` (centre
rail, rail outline, per-component wireframe/show).

`undo()`/`redo()` call `undoHistory`/`redoHistory` then `applyState()` —
the restore path also used at boot (`applyState(historyState.present)`
replaces the old unconditional `selectType("roller")`) — which sets the
live variables and every toggle-carrying material/group *before*
re-rendering controls (so restored checkboxes show correctly), restores
`type`/`method` (`renderMethodOptions` normally resets to the type's first
implemented method, so `applyState` overrides back to the historical
method if it's still implemented for that type), then re-runs the full
existing rebuild chain. `#undo-btn`/`#redo-btn` (`.history-buttons` in
`#panel`, disabled when their side of history is empty) and a ported
`Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` keyboard shortcut both call `undo()`/
`redo()` directly.

Switching obstacle type or construction method is itself one undo step —
unlike `../half-pipe`/`../kicker`, which only ever have one shape, so this
didn't arise there. "Reset to defaults" and switching obstacle type still
only reset `params`, not centre-rail/wireframe/show/outline (unchanged
from before this feature) — but the reset/switch itself is now a committed
history step like any other change.

## Scene

`src/main.ts`: `PerspectiveCamera` + `OrbitControls` (no damping — rotate/
pan/zoom all stop instantly, `zoomToCursor = true` so scroll-zoom centers on
the pointer rather than the orbit target — same as `../half-pipe`/
`../kicker`), ambient + raking directional light with
shadows, a flat ground plane, flat-shaded solid-color materials (schematic
style, no textures). The ground plane's material sets `polygonOffset`
(pushes its rasterized depth back slightly, no vertex movement) so
coplanar geometry at true y=0 — the dimension lines — renders cleanly on
top instead of z-fighting; see "Dimension lines" below.

`index.html` layout: an `.app-header` (bike icon, title, "in development"
pill, GitHub link) matching maketrail's header, above an `.app` flex row
holding the `#panel` (options) card and a `.main-tabs` card. `.main-tabs`
holds three tabs — "3D view" (`#viewport`), "2D drawings", "Bill of
materials" — same tab-bar pattern (and tab-click JS, a generic ARIA
`role="tab"`/`aria-selected`/`hidden` toggle loop) as the sibling
`../half-pipe` and `../kicker` apps, ported verbatim since it's already
generic. See "2D drawings" and "Construction / BOM" below for the other
two tabs' content.

## Deployment

`.github/workflows/deploy.yml`: on push to `main` (or manual
`workflow_dispatch`), runs lint/typecheck/test/build then publishes
`dist/` to GitHub Pages via `actions/deploy-pages`. `vite.config.ts` sets
`base: "/obstacle/"` to match the project-Pages subpath. Requires the
repo's Settings → Pages → Source set to "GitHub Actions" (one-time, not
done by the workflow itself).

## Construction / BOM

`src/construction/`, all pure functions, tested. The roller's earthen and
timber-framed methods are implemented. The "Bill of materials" tab is a
`<table id="bom-table">` (`Part | Qty | Dimensions | Material` columns,
one row per part type — same shape `../half-pipe`/`../kicker` use for
their own bill-of-materials tab), not the `<dl>` this app used before —
each `Part` cell keeps its own info icon (unlike the sibling apps' plain
tables, which have no per-row citations, just one disclaimer line).
`renderBom` in `src/main.ts` builds the whole tab: a status badge (slope
check for earthen, rail/section counts for timber) above the table.

- `soil.ts` — `DEFAULT_SOIL_PROFILE` (safe slope angle, compaction waste
  factor), see [decisions.md](decisions.md) for sourcing.
- `slopeCheck.ts` — the roller's sine profile's steepest tangent angle
  (`height * pi * periods / length`, i.e. where the sine derivative peaks)
  feeds two independent checks: `checkRollerSlope` compares it against the
  soil profile's safe angle (earthen only, shown in the BOM tab's status
  badge), and `checkRollerRideability` compares it against
  `MAX_RIDEABLE_ANGLE_DEG` (38°, from `research/rollers.md`'s steepest cited
  real-world example) to flag the roller itself as too steep to comfortably
  ride, regardless of construction method. `renderRideabilityWarning` in
  `src/main.ts` renders this as a `#rideability-warning` banner below the
  sliders (only for roller, only when unridable — hidden otherwise, unlike
  the always-visible BOM status badges), refreshed on every slider change,
  type switch, and reset.
- `earthenBom.ts` — `calculateRollerEarthenBom`: compacted fill volume via
  trapezoidal integration of cross-sectional area (`y(x) * rollerWidthAt(x,
  params)`) along the roller's own profile samples (`rollerProfilePoints`,
  shared with the 3D geometry builder so the two can't drift apart) —
  needed once width tapers along the length, since volume is no longer a
  constant cross-section × width; loose fill via the waste factor;
  geotextile fabric area as the footprint trapezoid (`length * average
  width`). Returns both `compactedFillVolumeM3` and `looseFillVolumeM3` —
  the BOM UI only shows the latter as an orderable line (see decisions.md).
- Wired into the "Bill of materials" tab, which keeps the current 3D shape
  unchanged for earthen construction (no framing members to expose — see
  decisions.md) and recalculates on every parameter/method change.
- Every BOM line item and the slope constraint badge has an info icon
  (`infoIcon()`/`BOM_INFO` in `src/main.ts`) — hover or click opens a
  tooltip explaining what the item is or, for the slope constraint, citing
  its source. See decisions.md's "Tooltip UI" for the tooltip's
  architecture.
- `timberStock.ts` — the metric dimensional-timber catalog (post, rail, and
  decking board sizes; decking board gap; max unsupported deck span; post
  embedment depth), doc-commented with its sources — see decisions.md.
- `rollerTimberFrame.ts` — `buildRollerTimberFrame(params, centerRail,
  additionalPostsPerSection)`: lays out posts and decking boards (plain
  `TimberMember` box data, not `THREE.*`, with an optional `rotationZ` for
  tilt). `postXPositions` always places one mandatory post at every
  quarter-sine section boundary (a joint where two curved rail pieces
  meet needs support regardless of any setting), plus
  `additionalPostsPerSection` more per section, equally spaced strictly
  between each pair of consecutive boundaries — `0` is just the mandatory
  boundary posts, `1` adds a midpoint to every section. Decking boards are
  tiled transverse to the rails at a fixed width+gap pitch (last board trimmed to fit), each
  tilted to the curve's local tangent (`rollerSlopeAt` from `roller.ts`,
  the height profile's derivative) so it sits flush with the rails' slope
  instead of lying flat/horizontal. Rails sit one rail-depth *above* the
  roller's own `rollerHeightAt` (`railTopHeightAt`, internal to this
  module), so the rail's *underside* — not its top — touches the ground
  where the roller's profile does (both ends), which is what keeps the
  rail from penetrating below grade; posts reach up to that underside and
  then continue `postEmbedmentDepthM` (600mm) further down into the
  ground so the structure can't shift sideways — a post's total length is
  `rollerHeightAt(x) + postEmbedmentDepthM`. Decking boards' top surface
  sits on top of the rail in turn (`railTopHeightAt(x) +
  deckingBoardThicknessM`), which means it's `railSizeM.depth +
  deckingBoardThicknessM` above the nominal `height` everywhere, not
  matching it exactly the way earthen's mound does — the structure's own
  thickness has to go somewhere above the ground. `groupMembersByLength`
  groups posts (or decking boards) by their (rounded) length along a given
  axis, longest first — posts genuinely only have a handful of distinct
  lengths (the height profile repeats every period, and every rail's posts
  at the same x share it); shared by the BOM calculator and the 2D
  drawings so neither groups differently from the other. `buildRailGeometry`
  builds one rail's curved box-beam
  `BufferGeometry` at a given fixed Z offset — four ruled strips (top/
  bottom/left/right) plus a flat triangulated cap at each end closing the
  tube, so the rail doesn't read as a hollow shell viewed end-on.
  `buildRailOutlineGeometry` builds a companion `THREE.LineSegments`
  geometry purely for the "Outline" checkbox below — the 4 long corner
  edges (sampled at the same resolution as the mesh, so it lines up
  exactly) plus a cap rectangle at *every* quarter-sine section boundary,
  including the rail's own two ends, so each fabricated section's start
  and end are visible individually. Shared by the BOM calculator and
  `src/main.ts`'s 3D structure builder — see decisions.md for the
  rail/post/decking design.
- `rollerTimberBom.ts` — `calculateRollerTimberBom(params, centerRail,
  additionalPostsPerSection)`: rail count/section count/curved length,
  `postGroups` and `deckingBoardGroups` (every distinct post length, and
  every distinct decking board span across the width, each with how many
  members share it — not averaged, unlike rail sections, since the parts
  list should list every one), plus decking board count/linear meters
  (summed, with a waste factor) from the frame layout above. Both
  `postGroups`/`deckingBoardGroups` come from the same
  `groupMembersByLength(members, axis)` in `rollerTimberFrame.ts` (axis 1
  for posts' height, axis 2 for decking boards' width-spanning length) —
  a decking board's span is continuous under a width taper, so a tapered
  roller's boards mostly end up one group each (rounded to the nearest mm),
  while an untapered one collapses to a single group since every board
  shares the same span.
- Wired into the "Bill of materials" tab (same table + info-icon +
  disclaimer structure as earthen — see below) and into the 3D view:
  `rebuildStructure` hides the solid mound mesh and renders the posts and
  decking boards (shared unit-cube `BoxGeometry`, scaled/positioned per
  member) plus the rails (`buildRailGeometry`, one `BufferGeometry` per
  rail). Posts, rails, and decking each get their own `MeshStandardMaterial`
  instance (not one shared material) purely so each can be
  wireframe-toggled independently, and their own persistent `THREE.Group`
  (`postsGroup`/`railsGroup`/`deckingGroup`, children of `structureGroup`)
  so each can be shown/hidden independently by flipping the group's
  `.visible`. `renderMethodControls` (`#method-options` in `index.html`) —
  shown only for roller + timber — renders a "Centre rail" checkbox
  (toggles a third centreline rail on/off, triggers a full
  `rebuildStructure`; unchecked by default), a "Rails" section with an
  "Outline" checkbox (flips the persistent `railOutlinesGroup`'s
  `.visible` — no rebuild needed, its `buildRailOutlineGeometry`-based
  `LineSegments` are already kept current by every `rebuildStructure`;
  unchecked by default), a "Posts"
  section with an "Additional posts per section" range slider (0–4,
  default 0, drives
  `currentAdditionalPostsPerSection`/`additionalPostsPerSection` above —
  a full `rebuildStructure`/`renderBom`/`rebuildPartDrawings` on change,
  same as the centre-rail checkbox), three "Wireframe" checkboxes
  (unchecked by default — a `THREE.Material`'s own default), and three
  "Show" checkboxes (checked by default — a `THREE.Group`'s own default),
  one per component
  (rails/posts/decking) for each — the wireframe/show checkboxes just flip
  a material or group property directly with no rebuild needed.

## 2D drawings

The "2D drawings" tab shows one labeled, dimensioned SVG per distinct
timber part type (roller + timber only — earthen has no framing to draw,
same reasoning `rebuildStructure` uses for the 3D view; berm/kicker show
the usual "not built yet" placeholder). `src/drawings/`, ported from
`../half-pipe/src/drawings/` — that engine is already generic over any
part shape, not half-pipe-specific:

- **`svgDimension.ts`**'s `buildLinearDimension2D` is `dimensionLine.ts`'s
  CAD-style dimension (extension lines + offset dimension line +
  outward-pointing arrowheads + label position), rebuilt for flat 2D
  points instead of Three.js `Vector3`/`Line`/`ArrowHelper` — ported
  verbatim, zero half-pipe coupling.
- **`renderPartDrawing.ts`** turns one `PartDrawing` (`title`, `outline:
  Point[][]`, `dimensions: DimensionSpec[]`, `labels: LabelBlock`) into a
  standalone auto-fit `<svg>` — arrow length/width, font size, and label
  clearance are all fractions of that drawing's own bounding diagonal, so
  a small part's arrows aren't a large part's arrows. Ported verbatim
  except its `PartDrawing` import, which now comes from
  `rollerTimberPartDrawings.ts` instead of half-pipe's own part-drawing
  module.
- **`rollerTimberPartDrawings.ts`** — the `PartDrawing`/`DimensionSpec`/
  `LabelBlock` interfaces (mirrors half-pipe's) and `rectanglePartDrawing`
  (a length × height box, third dimension as a text label — also ported)
  plus three obstacle-specific drawings, each derived straight from
  `buildRollerTimberFrame` so they can't drift from the 3D view:
  - `railSectionPartDrawing` — one real quarter-sine section's curve (the
    first, x from 0 to `length/(4*periods)`), not an idealized shape — a
    curve can't be "averaged" the way a straight length can. By symmetry
    there are up to 2 distinct section shapes per period; only this one is
    drawn, noted in its labels. Outline is the top curve
    (`rollerHeightAt` samples) plus a parallel bottom curve offset down by
    the rail's own depth, matching how `buildRailGeometry` represents the
    rail (constant vertical thickness, not curve-normal).
  - `postPartDrawings` — one `rectanglePartDrawing` per distinct post
    length (`groupMembersByLength(posts, 1)`, shared with the BOM), titled
    `"Post — {count}x"` and noting the embedded portion in its labels —
    posts are listed exactly, not averaged, unlike rail sections above.
  - `deckingBoardPartDrawings` — same treatment as posts: one
    `rectanglePartDrawing` per distinct board span
    (`groupMembersByLength(deckingBoards, 2)`, shared with the BOM), titled
    `"Decking board — {count}x"`. One drawing when the roller's width
    doesn't taper (every board shares the same span); more (often one
    each) when it does — replaced an earlier single-drawing-at-the-average
    design once tapered decking needed every distinct span called out, not
    just one representative number (see decisions.md).
  - `allRollerTimberPartDrawings(params, centerRail, additionalPostsPerSection)` —
    rail section, then one drawing per post-length group, then one
    drawing per decking-board-span group, in that order.
- `rebuildPartDrawings` in `src/main.ts` rebuilds `#drawings-list` (one
  `.drawing-card` per part: an `<h3>` title plus the rendered `<svg>`) on
  every parameter/method/centre-rail/posts-per-section change, same
  "cheap enough to redo unconditionally" reasoning the BOM tab uses.

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
  `THREE.Sprite` via `CanvasTexture`, with `sizeAttenuation: false` on the
  sprite material so its on-screen size stays constant regardless of
  camera distance (ported from `../half-pipe`/`../kicker`, which worked
  this out first — labels growing/shrinking as the camera dollied in/out
  read as a bug). `LABEL_PIXEL_HEIGHT` is a target size in screen pixels,
  not world meters; the actual `sprite.scale` is derived from it each call
  via the camera's vertical FOV and the viewport's current
  `clientHeight`, the standard conversion for what a given pixel height
  should be in the `scale` units `sizeAttenuation: false` expects.
  `rebuildDimensions` keeps an explicit disposer over exactly what it
  created on the last call —
  disposing each sprite's texture/material and removing it from the
  scene, and disposing only the `THREE.Line` geometries it created (never
  the geometry inside an `ArrowHelper`, which Three.js shares as static
  geometry across every `ArrowHelper` instance app-wide; disposing it
  there would break arrows everywhere, not just the ones being replaced).
- Dimension geometry sits at its true position (y=0 for ground-level
  dimensions) — the ground plane's own material uses `polygonOffset`
  (`polygonOffsetFactor`/`polygonOffsetUnits: 1`, see Scene above) to
  dodge z-fighting instead, so dimension lines don't need to be lifted
  off their real position to fake the fix (an earlier version lifted
  `dimensionsGroup` 0.01m, which meant every ground-level dimension line
  was measuring 1cm off).

## Printing

No print button or PDF export — this is the browser's native print (Cmd/Ctrl+P), styled by
`index.html`'s `@media print` block (ported from `../half-pipe`, which worked out these rules
first — `../kicker` has the same behavior via inline Tailwind `print:` utility classes instead
of a dedicated block). Whichever tab is currently active is what prints; the other two
tab-panels are already `hidden` by the tab-switching code in `src/main.ts`, and the print block
unconditionally hides the app header, options panel, and tab bar on top of that — so the
printed page is just that one tab's content.

The 2D drawings tab gets the most specific treatment: `#drawings-list` drops from its on-screen
CSS Grid to plain `display: block` for print — page fragmentation (`break-inside`,
`break-after`) inside a Grid container is inconsistently supported across browsers, and no
amount of tuning row/gap sizing on top of a grid fixed the card-drift half-pipe saw first: plain
block flow is the best-supported fragmentation context. Pagination is `break-inside: avoid`
(keeps each card's heading and svg together) plus `break-after: page` on every card except the
last (`:not(:last-child)`, so there's no trailing blank page) — both paired with their legacy
`page-break-*` equivalents for older print engines. Deliberately *not* sized to fill the page:
`vh` in print is relative to the paper size, not the actual printable area (paper size minus the
browser's own print margins), so a fixed-`vh` card/svg height would oversize every card by the
same mismatch and drift further page after page — rendering the svg at its natural on-screen
width/aspect-ratio avoids needing to know the printable area's exact height at all. Drawing
colors are forced to black-on-white regardless of the app's theme (paper has no dark mode).

The 3D view tab prints in its on-screen colors as-is — it's a visual reference, not a
fabrication drawing, so nothing forces it to line art. The `WebGLRenderer` is constructed with
`preserveDrawingBuffer: true` for this reason: without it, the browser's print rasterizer (which
runs async, not synced to the render loop) can capture a cleared framebuffer and print a blank
canvas instead of the last rendered frame.

The bill-of-materials tab has no printing-specific CSS — `#bom-container` is un-clipped
(`position: static`, `overflow: visible`) so the table flows across pages via the browser's
default table-printing behavior, same as any plain HTML table.
