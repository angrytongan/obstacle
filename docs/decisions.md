# Design decisions

Scope/architecture decisions, so they don't need re-asking each session. Update this file when a decision changes rather than leaving it stale.

## Scope

- **Standalone geometry code.** The obstacle geometry builders are written
  fresh for this app, kept independent on purpose — no shared code with
  the sibling maketrail project.
- **3D view only**, no 2D top-down view — there's no terrain to place
  obstacles on, so a 2D view has nothing to add here.
- **Params reset to type defaults on switching obstacle type** — no
  per-type state persisted while the page is open. A "Reset to defaults"
  button does the same for the current type without switching.

## Obstacle geometry

- Obstacle mesh material uses `THREE.DoubleSide` (see `src/main.ts`) so the
  hand-built berm mesh renders regardless of triangle winding — a ponytail
  simplification, not a bug fix if the berm ever looks inside-out.

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

## Dimension lines

- **CAD-style** (extension lines + arrowheads + a text label), not simple
  floating labels — built from `THREE.Line` + `THREE.ArrowHelper` (both
  stdlib). Roller only for now — the underlying builder
  (`src/dimensions/dimensionLine.ts`) is generic over any two points/axis
  so berm/kicker can reuse it later for their linear measurements, but
  there's no angular-dimension variant yet (sweep/bank/lip angles), since
  nothing needs one.
- **Labels are canvas-texture sprites, not a `CSS2DRenderer` DOM overlay.**
  The first attempt used `CSS2DRenderer`/`CSS2DObject` (HTML labels
  positioned over the WebGL canvas each frame); it left ghost labels
  behind after orbiting/zooming that a more careful explicit-disposer
  rewrite still didn't fix, so the DOM-overlay approach itself was
  dropped rather than chased further. Sprites live inside the same scene
  as everything else and are billboarded automatically by Three.js
  (`THREE.Sprite` always faces the camera) — one render pipeline, fully
  redrawn every frame, no separate DOM lifecycle to keep in sync.

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
