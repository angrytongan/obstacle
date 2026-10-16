# Design decisions

Scope/architecture decisions, so they don't need re-asking each session. Update this file when a decision changes rather than leaving it stale.

## Scope

- **Standalone geometry code.** The obstacle geometry builders are written
  fresh for this app, kept independent on purpose — no shared code with
  the sibling maketrail project.
- **3D view only**, no 2D top-down view — there's no terrain to place
  obstacles on, so a 2D view has nothing to add here. This doesn't cover
  the "2D drawings" tab (see status.md): those are per-part shop drawings
  (one rail section, one post, one decking board — not the whole
  assembled roller), not a site/plan view — a different thing this
  decision was never about.
- **Params reset to type defaults on switching obstacle type** — no
  per-type state persisted while the page is open (switching roller→berm→
  roller doesn't bring your roller tweaks back). A "Reset to defaults"
  button does the same for the current type without switching. Distinct
  from the undo/redo + localStorage feature below, which persists the
  *whole app's* one current state across a reload, not a separate memory
  per type.
- **Undo/redo + localStorage persistence, ported from `../kicker`'s design**
  (not `../half-pipe`'s older one) — a single `AppState` (type, method,
  params, centre-rail, additional-posts-per-section, rail outline, and
  every component's wireframe/show toggle) is both the one thing saved to
  `localStorage` and the history's "present" (`src/history.ts`'s generic,
  immutable `{ past, present, future }`, also ported from kicker verbatim).
  Half-pipe instead keeps a separate mutable `HistoryStack` class and an
  independent `persistControls()` blob that has to be kept in sync by
  convention — kicker's single-source-of-truth version has fewer moving
  parts, so this app follows it. Switching obstacle type or construction
  method is itself one undo step (unlike the sibling apps, which only ever
  have one shape to begin with) — `applyState` restores a past type+method
  combo by re-running `renderMethodOptions` (which normally resets to that
  type's first implemented method) and then overriding back to the
  historical method if it's still implemented for that type. A slider drag
  stays one undo step, not one per tick, the same way as the sibling apps:
  the `input` event updates the live preview only, a sibling `change`
  listener (fires once on release) calls `commit()`.
- **Deployed to GitHub Pages**, not a custom host — a static Vite build
  with no backend needs nothing more. Pushes to `main` build and deploy
  automatically via `.github/workflows/deploy.yml`, gated on
  lint/typecheck/test passing first.

## Obstacle geometry

- Obstacle mesh material uses `THREE.DoubleSide` (see `src/main.ts`) so
  hand-built meshes (berm, roller) render regardless of triangle winding —
  a ponytail simplification, not a bug fix if one of them ever looks
  inside-out.
- **Roller width tapers along its length** (`widthStart`/`widthEnd`, not a
  single `width`), so a real roller can be built narrower at one end than
  the other. This is why `roller.ts` is hand-built `BufferGeometry` (four
  ruled quad strips) rather than `THREE.Shape` + `ExtrudeGeometry` — extrude
  can't vary its depth along the path.
- **A separate "too steep to ride" warning exists alongside the earthen
  soil-stability check**, not reusing it — `checkRollerSlope`'s 34°
  threshold is OSHA's soil angle of repose (whether the *dirt* stays put),
  which only makes sense for the earthen method and isn't a rideability
  limit. `checkRollerRideability` (`slopeCheck.ts`) compares the same
  steepest-tangent-angle formula against `MAX_RIDEABLE_ANGLE_DEG` (38°)
  instead — the steepest real-world example `research/rollers.md`'s
  length:height ratio table cites (10:2.5 ratio, Lee McCormack). That table
  was cross-checked against the formula before picking the threshold: a
  10:1 ratio (this app's default-ish shape) predicts 14–17° in the table
  and the formula gives 17.4°; the 10:2.5 ratio predicts ~38° and the
  formula gives 38.1° — close enough to trust the formula as the same
  quantity the research calls "takeoff angle". Applies to both construction
  methods (the roller's steepness comes from its own params, not how it's
  built), rendered as a warning banner below the sliders
  (`#rideability-warning`/`renderRideabilityWarning` in `src/main.ts`) —
  hidden when ridable, unlike the BOM tab's always-visible status badges,
  since this is meant to interrupt, not report a steady-state number.

## Construction method / BOM

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
- **BOM shows one orderable "Fill material" line**, not separate
  "compacted fill" and "loose fill to source" lines — two parallel lines
  read as two separate materials with no clear answer to "which do I
  order". The compacted design volume (`compactedFillVolumeM3`, still
  returned by `calculateRollerEarthenBom`) is folded into that line's
  tooltip as context instead.
- **Research notes are copied into this repo** (`research/`), not shared
  by reference with maketrail — only the notes actually relevant to what's
  built so far (currently just `rollers.md`); pull in more
  (e.g. `build-plans.md` for timber kicker/skinny builds) when their
  obstacle type/method is actually implemented, not speculatively.
- **Timber-framed roller is curved rails on posts**, not a ladder-frame rib
  structure and not horizontal cross members of any kind: two (or three,
  see below) continuous 90x45mm rails follow the roller's own height
  profile the full length, each fabricated from 4-per-period **quarter-sine-
  wave sections** (`buildRollerTimberFrame`/`buildRailGeometry` in
  `rollerTimberFrame.ts`) — a curved/laminated beam can't easily bend
  through a full sine wave in one piece, but each quarter (zero-to-crest or
  crest-to-zero) is a single-curvature-sign arc a real builder can fabricate
  as one piece. 70x45mm posts hold each rail up directly (no bottom plate
  or cap board connecting left/right posts).
- **Every rail section boundary always gets a post — that's not
  configurable** — a joint where two curved rail pieces meet needs
  support regardless of anything the user picks, so `postXPositions`
  places one there unconditionally. The user-facing "Additional posts per
  section" slider (0–4, default 0 — just the mandatory boundary posts)
  only controls how many *more* go in, equally spaced strictly between
  each pair of consecutive boundaries. `1` adds a midpoint to every
  section (the app's original fixed scheme, since dropped as the
  default); higher values pack more in. This went through two earlier, wrong readings before landing
  here: first a *per-section* density (`1` meant one post per section,
  several per rail, with no post guaranteed at any particular joint), then
  a *per-rail total* with no mandatory joints at all (so `1` could land
  anywhere, not necessarily on a joint) — both dropped once it became
  clear the actual requirement was "a joint is never left unsupported,
  and the slider only adds to that," not a plain density or count.
- **Posts are embedded 600mm into the ground**
  (`postEmbedmentDepthM` in `timberStock.ts`) so the structure can't shift
  sideways — a fixed constant, not a load calculation, chosen as "plenty
  deep" for a trail feature this size rather than derived from a frost-line
  or soil-bearing table the way the earthen method's slope angle is. Every
  post's total length is `rollerHeightAt(x) + postEmbedmentDepthM`; its
  center shifts down by half the embedment depth accordingly (see
  `buildRollerTimberFrame`'s post loop) so the *above-ground* portion still
  reaches exactly the rail's underside.
- **Posts and decking boards are both listed exactly in the parts list and
  2D drawings, not averaged** — `groupMembersByLength(members, axis)` in
  `rollerTimberFrame.ts` groups either by their (rounded) length along a
  given `size` axis (1 for posts' height, 2 for decking boards'
  width-spanning length) and lists every distinct length with its own
  count, shared by `rollerTimberBom.ts` (`postGroups`/
  `deckingBoardGroups`) and `rollerTimberPartDrawings.ts`
  (`postPartDrawings`/`deckingBoardPartDrawings`, both plural) so neither
  can group differently from the other. Posts come in only a handful of
  truly distinct lengths (the height profile repeats every period, and
  every rail's posts at a given x share the same height); decking boards
  collapse to one group when the roller's width doesn't taper (every board
  shares the same span) and split into more — often one-each — under a
  taper, since a board's span is a continuous function of its position.
  Decking boards were originally averaged (see below), the same as rail
  sections — that held up until a tapered roller needed every distinct
  board span called out for cutting, not one representative number, so
  decking was moved onto the exact-listing path posts already used. Rail
  sections stay averaged: unlike a board's span (a plain number), a
  section's *shape* is a curve that can't be "averaged" the way a length
  can, and grouping the curve itself would mean reworking
  `rollerTimberFrame.ts`'s data shape for comparatively little payoff (by
  symmetry there are at most 2 distinct section shapes per period anyway).
- **Edge rails run straight in Z (don't follow the width taper)** — inset
  half a rail-width from the *narrowest* point of the footprint
  (`edgeRailZOffset` in `rollerTimberFrame.ts`), so a rail never sticks out
  past the deck edge anywhere along the length. A real curved/laminated
  beam bending in one plane (height) is a normal build; also bowing it
  sideways to track a width taper is a much harder physical build, so this
  app doesn't model it — the decking simply overhangs the rails a bit more
  at the wider end, same as a real picnic-table-style overhang.
  `widthStart`/`widthEnd` still taper the visible mound/decking footprint
  as before.
- **Centre rail is a manual on/off toggle, unchecked by default**
  (`currentCenterRail` in `src/main.ts`, shown as a checkbox only for
  roller + timber), not an automatic width threshold — the app doesn't
  try to guess when one is needed. Its tooltip cites the 400mm
  max-unsupported-deck-span number as guidance for when to turn it on,
  without an automated safety check enforcing it (unlike the earthen
  method's slope check — this was a deliberate scope call, not an
  oversight). Unlike the wireframe/show toggles below, it isn't
  checked by default — adding a rail is a structural change worth an
  explicit opt-in, not a view preference.
- **Decking is solid timber boards, not plywood** — plywood isn't
  weather-resistant enough for an outdoor trail feature. `deckingBoards` in
  `rollerTimberFrame.ts` tiles rigid (not curved) 150x28mm boards transverse
  to the rails, with a small 5mm gap between boards for drainage/expansion —
  a standard practice for any outdoor timber deck, real or trail feature.
  The last board in the run is trimmed to fit the remaining length, same as
  cutting a real board to fit. Rendered as plain boxes (`TimberMember`s)
  reusing the same unit-cube `BoxGeometry` as posts, not a curved surface —
  only the rails beneath the decking are curved, each board itself is a
  straight rigid piece.
- **Each decking board is tilted to the rail's local tangent** (`rotationZ`
  on `TimberMember`, `rollerSlopeAt` in `roller.ts` — the derivative of the
  height profile, same formula `slopeCheck.ts`'s steepest-tangent check is
  built from, generalized to an arbitrary x), not laid flat/horizontal — a
  board screwed to sloped rails follows their slope, so adjacent boards'
  edges meet along the curve instead of stepping like a staircase. The
  board's center is offset below its own top face by half its thickness
  *projected* onto Y (`(thickness/2) * cos(tilt)`, not just `thickness/2`),
  so the top face — the actual riding surface — touches the curve's height
  at the board's center, not the untilted box center.
- **The rail's *underside*, not its top, traces the roller's own height
  profile** (`railTopHeightAt` = `rollerHeightAt(x) + railSizeM.depth`,
  internal to `rollerTimberFrame.ts`) — the rail sits `railSizeM.depth`
  *above* the nominal profile, not the deck-thickness *below* it as an
  earlier version had it. That earlier version pinned the rail's *top* to
  the profile, which put the rail's own depth underground wherever the
  profile reaches 0 (both ends) — visible as the rails penetrating the
  ground plane. Posts reach from the ground up to the rail's (raised)
  underside, so a post's height is now just `rollerHeightAt(x)` exactly.
  The deck sits on top of the rail in turn, so its own top — the actual
  rideable surface — is `railSizeM.depth + deckingBoardThicknessM` above
  the nominal `height` everywhere, not matching it exactly the way the
  earthen method's mound does: the structure's own thickness has to sit
  somewhere above the ground it's built on, same as a real timber ramp.
  This ignores the extra sliver a tilted board's own slope adds between
  its flat underside and the curved rail beneath it — a few mm at most
  against a roller that's tens of cm to a couple meters tall, not worth
  chasing.
- `timberStock.ts`'s `maxUnsupportedDeckSpanM` (400mm) is the published
  joist/support spacing for 28mm softwood decking boards (the size used
  here) — see https://gripdeck.co.uk/joist-spacing/. No published span
  table exists for curved timber trail ramps specifically, so this is a
  conservative proxy standard, same as `soil.ts`'s OSHA citation for the
  earthen method. The rest of `timberStock.ts` is a small fixed metric
  catalog (70x45mm posts, 90x45mm rails, 150x28mm decking boards) — matches
  the app's meter-based params throughout, not a full engineered size
  range, and kept generic (not roller-specific) for berm/kicker's timber
  methods to reuse later.
- **Rails stand on edge** — `railSizeM` is `{ width: 0.045, depth: 0.09 }`,
  i.e. the 90mm face is vertical and the 45mm face is horizontal. A rail
  bends under vertical load (rider weight, gravity), and bending stiffness
  goes with the *cube* of the depth in the bending direction — standing the
  longer face vertical (like a joist) resists that bending far better than
  laying it flat would. Only `railSizeM` changed; `postSizeM` stays as-is
  since posts see mostly axial/embedment load, not bending along their
  length.
- **Roller length maxes out at 12m** (`main.ts`'s slider spec), up from an
  earlier 8m cap — checked against `slopeCheck.ts`'s steepest-tangent
  formula (`maxSlope = height * π * periods / length`) before raising it:
  the formula only depends on the `periods/length` *ratio*, so a period-4,
  12m roller has the exact same steepest tangent (and so the same
  slope-safety verdict) as the period-1, 3m default — raising the length
  cap doesn't on its own risk producing an unsafe slope that wasn't already
  reachable at the old cap, since periods and length still have independent
  slider ranges. `slopeCheck.test.ts` locks this invariant in.
- **Timber method hides the solid mound mesh and shows the open post/rail/
  deck structure instead** (`rebuildStructure` in `src/main.ts`) — unlike
  earthen, which keeps the plain hump mesh since dirt has no frame to
  expose. Posts and decking boards reuse one shared unit-cube `BoxGeometry`,
  scaled/positioned per member, rather than a distinct geometry per member —
  the member counts involved don't need instancing. Rails are their own
  curved `BufferGeometry` each (`buildRailGeometry`), since unlike posts/
  decking they aren't uniform boxes.
- **Posts, rails, and decking each get their own material instance**
  (`postsMaterial`/`railsMaterial`/`deckingMaterial` in `src/main.ts`), not
  one shared timber material — purely so each can be wireframe-toggled
  independently via the per-component checkboxes in `renderMethodControls`.
  "Wireframe" checkboxes default unchecked (a `THREE.Material`'s own
  `wireframe` default, `false`) — solid is the sensible default view, wireframe is an inspection aid you opt into.
- **Posts, rails, and decking also each get their own persistent
  `THREE.Group`** (`postsGroup`/`railsGroup`/`deckingGroup`, always children
  of `structureGroup`) so each can be shown/hidden independently — the
  "Show" checkboxes just flip a group's `.visible` (checked = visible,
  matching a `THREE.Group`'s own default, so they default to checked),
  same "no rebuild needed" pattern as the wireframe checkboxes flipping a
  material property. Named "Show" rather than "Hide" so checked reads as
  the positive/default state.
- **Rails get their own on-demand wireframe outline overlay** (a "Rails"
  section, "Outline" checkbox), separate from the wireframe/show toggles
  above — `buildRailOutlineGeometry` draws exactly two things: the 4 long
  corner edges (sampled at the same resolution as `buildRailGeometry`'s
  own mesh, so it lines up exactly), each a continuous polyline the
  rail's full length, and a cap rectangle at *every* quarter-sine section
  boundary — including the rail's own two ends — so each fabricated
  section's start and end are individually visible, not just the whole
  rail's. Built explicitly (hand-drawn line positions) rather than via
  `THREE.EdgesGeometry` on the rail mesh, after two earlier attempts with
  EdgesGeometry both fell short: EdgesGeometry only ever exposes the
  *whole rail's* two ends as "hard" cap edges — there's nothing in the
  mesh topology marking an individual section's boundary — and its
  curvature-angle threshold also flagged some of the smooth top/bottom
  face's own internal seams as spurious extra edges near the steepest
  parts of the curve. Building the exact lines wanted, rather than
  inferring them from a generic edge-angle heuristic, avoids both
  problems at once. (An even earlier version hand-built rectangles at
  only the *interior* boundaries, meant to mark section joins
  specifically before "outline the whole rail" became the actual ask.)
  Its own `railOutlinesGroup`/`railOutlineMaterial` (a plain black
  `THREE.LineBasicMaterial`, distinct from both the tan timber color and
  the red used for CAD dimension lines) are kept current by every
  `rebuildStructure` regardless of whether the checkbox is checked, same
  "always build, just toggle visibility" reasoning as the Show checkboxes
  — unlike those, though, this isn't in `COMPONENT_TOGGLES`, since it's a
  rails-only inspection aid, not a per-component (rails/posts/decking)
  pattern. Off by default, same reasoning as wireframe.
- **`railsMaterial` sets `polygonOffset`** (`polygonOffsetFactor`/
  `polygonOffsetUnits: 1`, same technique the ground plane uses for
  dimension lines) so the rail-outline overlay above — which sits exactly
  coincident with the rail mesh's own surface everywhere along its
  length, not just at a few points — renders cleanly on top instead of
  z-fighting with it.

## Tabs / 2D drawings / bill of materials

- **Three tabs — "3D view", "2D drawings", "Bill of materials" — matching
  the sibling `../half-pipe`/`../kicker` apps' own labels**, not this
  app's own wording for the same ideas, so all three apps present the
  same shape. The bill of materials used to live as a `<dl>` in the left
  options panel (`#bom`); it's now its own tab (`#bom-container`), and
  the options panel no longer shows any BOM content.
- **The bill-of-materials table keeps this app's existing per-row info
  icons** (citing OSHA/APA/GripDeck sources — see "Construction method /
  BOM" above), unlike the sibling apps' plain tables (just one disclaimer
  line, no per-row citations) — this app has leaned on citing sources
  throughout, and dropping them would lose real content, not just markup.
- **Parts whose real size varies report exact per-length grouping, not an
  average — except rail sections.** This was originally an average for
  every varying part (chosen for less implementation work than exact
  grouping; half-pipe does the latter for its own BOM, where every part
  sharing a row is dimensionally identical), with posts as the one
  exception once it turned out they only ever come in a handful of
  genuinely distinct lengths (see "Timber-framed roller is curved rails on
  posts" above), making exact grouping barely more work than averaging.
  Decking boards later moved onto the same exact path once a tapered
  roller's "one average board length" stopped being good enough — real
  cut lists need every distinct span, not a representative number (see
  "Posts and decking boards are both listed exactly" above). Rail sections
  are the one part still averaged: a section's shape is a curve, not a
  plain length, so "exact grouping" would mean comparing curves, not
  numbers — the existing "planning estimate, not a substitute for a
  qualified builder's assessment" disclaimer covers this remaining
  approximation.
- **The 2D drawings engine (`src/drawings/`) is ported from
  `../half-pipe/src/drawings/`**, not reinvented — `svgDimension.ts` and
  `renderPartDrawing.ts` were already generic (no half-pipe-specific
  logic in either), so only the `PartDrawing` import path changes, from
  half-pipe's own part-drawing module to this app's
  `rollerTimberPartDrawings.ts`. See status.md's "2D drawings" section for
  what's actually drawn.
- **Printing (Cmd/Ctrl+P, no in-app print button) is also ported from
  `../half-pipe`'s `@media print` block**, not just the 2D drawings tab
  specifically — the block unconditionally hides the header/panel/tab-bar
  regardless of which tab is active, so it inherently covers all three
  tabs at once. This also meant adding `preserveDrawingBuffer: true` to
  the `WebGLRenderer` (half-pipe has it, `../kicker` doesn't and has no
  print docs either) so the "3D view" tab doesn't print a blank canvas —
  the print rasterizer runs async and can otherwise capture a
  just-cleared framebuffer. See status.md's "Printing" section.

## Dimension lines

- **CAD-style** (extension lines + arrowheads + a text label), not simple
  floating labels — built from `THREE.Line` + `THREE.ArrowHelper` (both
  stdlib). Roller only for now — the underlying builder
  (`src/dimensions/dimensionLine.ts`) is generic over any two points/axis
  so berm/kicker can reuse it later for their linear measurements, but
  there's no angular-dimension variant yet (sweep/bank/lip angles), since
  nothing needs one.
- **Dimension lines sit at their true position, not lifted off the ground
  to dodge z-fighting** — ported from `../half-pipe`/`../kicker`, which
  fixed this first: an earlier version lifted `dimensionsGroup` 0.01m
  above y=0, which meant every ground-level dimension line was measuring
  1cm away from what it actually dimensioned — a real accuracy bug, not
  just a rendering nit. The ground plane's material now sets
  `polygonOffset`/`polygonOffsetFactor`/`polygonOffsetUnits: 1` instead,
  which biases the ground's *rasterized* depth back slightly without
  moving any actual geometry, so coplanar lines at true y=0 render
  cleanly on top without themselves needing to move.
- **Labels are canvas-texture sprites, not a `CSS2DRenderer` DOM overlay.**
  The first attempt used `CSS2DRenderer`/`CSS2DObject` (HTML labels
  positioned over the WebGL canvas each frame); it left ghost labels
  behind after orbiting/zooming that a more careful explicit-disposer
  rewrite still didn't fix, so the DOM-overlay approach itself was
  dropped rather than chased further. Sprites live inside the same scene
  as everything else and are billboarded automatically by Three.js
  (`THREE.Sprite` always faces the camera) — one render pipeline, fully
  redrawn every frame, no separate DOM lifecycle to keep in sync.
- **Label sprites use `sizeAttenuation: false`, so their on-screen size
  doesn't shrink/grow with camera distance** — ported from `../half-pipe`/
  `../kicker`, which fixed this same "label size changes as you zoom"
  issue first. `LABEL_PIXEL_HEIGHT` (a screen-pixel target, not a world
  size) is converted to the `scale` value `sizeAttenuation: false` expects
  using the camera's vertical FOV and the viewport's `clientHeight` — the
  standard formula for that conversion, not something specific to this
  app. Recomputed on every `createLabelSprite` call (i.e. on every
  parameter change, since that's when dimensions rebuild), not on window
  resize specifically — same gap the sibling apps also have; a label's
  on-screen size only goes stale between a resize and the next param
  change, not egregious enough to special-case.

## Tooltip UI

- **Tooltip is a single shared `#tooltip` element appended directly to
  `<body>`** (`index.html`), positioned in JS from the hovered/focused
  icon's `getBoundingClientRect()` (`showTooltip`/`hideTooltip` in
  `src/main.ts`, delegated via `mouseover`/`mouseout`/`focusin`/`focusout`
  on `document` since `.info-icon` elements are recreated on every
  `renderBom()` call) — **not** a `::after` pseudo-element anchored inside
  the icon. `#panel` needs `overflow-y: auto` to scroll, and any ancestor
  with non-visible overflow clips an absolutely-positioned descendant that
  pops outside its bounds regardless of z-index; `position: fixed` on the
  shared tooltip escapes that entirely.
- One line of JS forces focus on click, since Safari doesn't focus a
  clicked `<button>` by default and the delegated `focusin` listener is
  what makes click show the tooltip.
- Visibility is a `visibility` class toggle only, no `opacity`/fade —
  `opacity` on an element forces its whole subtree to composite at that
  alpha, so a fade would make the tooltip itself look translucent while
  animating. For the same reason, muted/dim label text (`.bom-label`)
  must never be an *ancestor* of an info icon — wrap only the label text
  in the dim styling, not the `<dt>` that also contains the icon, or the
  tooltip would inherit the dim ancestor's opacity as its own compositing
  alpha regardless of its own background color.
- These three failure modes (opacity-fade, ancestor-opacity, overflow-clip)
  were each found and fixed in turn before landing on the current
  approach — worth reading in full before touching tooltip CSS again.
