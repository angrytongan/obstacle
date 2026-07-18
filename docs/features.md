# Feature backlog

Not-yet-built features and known gaps. Check [decisions.md](decisions.md) for the scope/design reasoning behind an item before starting it. When an item is built, remove it from here and describe it in [status.md](status.md) instead.

## Construction methods

- [ ] Timber-framed, hybrid, and metal-framed construction methods (any
      obstacle type) — these need a real dimensional-timber/steel stock
      catalog and published span tables, and should render actual
      structural geometry (posts/joists/decking), not just a BOM (see
      decisions.md).
- [ ] Berm and kicker construction methods entirely (`IMPLEMENTED_METHODS`
      in `src/main.ts` lists none for either yet).
- [ ] Soil-type selection (currently one conservative default).

## Dimension lines

- [ ] Dimension lines for berm/kicker.
- [ ] An angular-dimension variant (sweep/bank/lip angles) —
      `dimensionLine.ts` only handles linear measurements so far.

## Obstacles

- [ ] Kicker landing/gap piece.
- [ ] Berm mirroring (direction flag).
- [ ] Obstacle directionality indicators.

## Out of scope for this app

Terrain, trail, difficulty simulation — see the sibling maketrail project.
