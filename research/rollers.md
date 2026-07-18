# Rollers

Sources:
- https://trailism.com/roller-and-drain-design/
- https://velosolutions.com/velosolutions-pump-track-standards/

## Shape

- Sine wave profile, not a Brachistochrone curve ("too peaky" per Trailism) — sine is easy to generate and reproduce in dirt/wood/concrete/asphalt.
- No flat spots on the curve itself (tables are the only exception) — speed comes from continuously changing radius.
- "Most crests are very close to the same height" regardless of whether the section is net uphill/downhill — keeps potential energy consistent and avoids dead (no-pump) spots.

## Height : Length ratio (Lee McCormack)

Ratio is length : height, e.g. `10:1` = 3m long, 0.3m tall (the ratio is unitless, so it applies directly in metric).

| Ratio | Height (3m length) | Approx takeoff angle |
|-------|----------------------|-----------------------|
| 10:1   | ~0.3m  | 14–17° |
| 10:1.5 | ~0.46m | — |
| 10:2   | ~0.61m | — |
| 10:2.5 | ~0.76m | ~38° |

Default/most common: **10:1**. Trailism's original (imperial) formula for a 12"-tall, 10ft-long roller: `y = 6 * sin(x / 19.0985)` (inches) — one **full sine period** spans the whole 10ft length (`19.0985 * 2π ≈ 120in = 10ft`), not a half-period/single hump. Converted to metric (0.3m-tall, ~3.05m-long): `y = 0.152 * sin(x / 0.485)` (metres).

Generalizes to: `y = (height/2) * sin(x / k)` where `k = length / (2π)`, so one full sine period (crest, back to zero, trough, back to zero) spans the roller's length — this is what lets successive rollers tile end-to-end into a continuous pump-track sequence.

## Spacing (Velosolutions standard)

- Minimum 3m between rollers.
- First roller before/after a turn must be ≥1m from the end of the turn (Velosolutions house standard: 1.5m).
- Roller height should scale with spacing (bigger gap → allowed to be bigger) but no strict proportionality given.

## Rider/geometry constraints

- Leave ≥20% spare wheelbase on the up/down ramp of a roller if it's going to be jumped/landed on (reference bike: 66cm dirt jump bike, 1.07m wheelbase).
- Round off transitions to avoid pedal strikes, especially for low-BB bikes (strider bikes called out specifically).

## Speed context (for simulation)

- Typical pump-track speed: 13–19 km/h, spikes to ~24 km/h.
- Pro speed: 32+ km/h.
- At 27 km/h with a 17° takeoff, a 3m crest-to-crest gap is clearable; typical small-double gaps at 13–19 km/h are 0.9–1.8m.

## Relevance to maketrail

- Roller obstacle params: `length`, `height` (or `ratio`), derive sine profile procedurally with the formula above.
- Spacing/height-consistency rules are candidate **simulation lint checks**: flag rollers <3m apart, or a roller whose crest height breaks the "same height as neighbors" rule.
- See [[simulation]] for how takeoff angle + speed feed into flagging "jump too far/short".
