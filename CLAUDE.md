# obstacle

Browser app for planning real-world mountain bike obstacle builds: pick a
type, adjust its parameters via sliders, choose a construction method, and
see the 3D shape plus a live bill of materials and soundness check. Every
change is undoable and the last state survives a reload (localStorage).
Standalone — no terrain, no trail, no saved *projects* (deliberate: see
[docs/decisions.md](docs/decisions.md)).

## Decisions

[docs/decisions.md](docs/decisions.md) — scope/architecture decisions
(construction methods, BOM precision/sourcing, dimension lines, tooltip
UI). Check this before assuming how something should work.

## Feature backlog

[docs/features.md](docs/features.md) — not-yet-built features and known
gaps. Check here for what's next; once an item is built, remove it from
there and describe it in [docs/status.md](docs/status.md) instead.

## Stack

Vite + TypeScript + Three.js, no framework, no backend, Vitest, ESLint (flat
config, `typescript-eslint` recommended). `npm run dev` / `build` / `test` /
`lint` / `typecheck`.

## Status

[docs/status.md](docs/status.md) — what's built and how (obstacle
geometry, construction/BOM, dimension lines, tooltip UI). Update this
after each completed feature.
