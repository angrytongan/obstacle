import { describe, expect, it } from "vitest";
import { checkRollerRideability, checkRollerSlope } from "./slopeCheck";
import { ROLLER_DEFAULTS } from "../obstacles/roller";

describe("checkRollerSlope", () => {
  it("passes a gentle default roller (10:1-ish length:height)", () => {
    const result = checkRollerSlope(ROLLER_DEFAULTS);
    expect(result.safe).toBe(true);
    expect(result.maxAngleDeg).toBeLessThan(result.safeAngleDeg);
  });

  it("flags a roller too tall for its length as unsafe", () => {
    const result = checkRollerSlope({ ...ROLLER_DEFAULTS, height: 2, length: 3 });
    expect(result.safe).toBe(false);
    expect(result.maxAngleDeg).toBeGreaterThan(result.safeAngleDeg);
  });

  it("scales the steepness with periods (more humps in the same length = steeper)", () => {
    const one = checkRollerSlope({ ...ROLLER_DEFAULTS, periods: 1 });
    const three = checkRollerSlope({ ...ROLLER_DEFAULTS, periods: 3 });
    expect(three.maxAngleDeg).toBeGreaterThan(one.maxAngleDeg);
  });

  it("keeps the same steepness when periods and length scale together (same periods/length ratio)", () => {
    const base = checkRollerSlope({ ...ROLLER_DEFAULTS, periods: 1, length: 3 });
    const scaled = checkRollerSlope({ ...ROLLER_DEFAULTS, periods: 4, length: 12 });
    expect(base.safe).toBe(true);
    expect(scaled.safe).toBe(true);
    expect(scaled.maxAngleDeg).toBeCloseTo(base.maxAngleDeg, 10);
  });
});

describe("checkRollerRideability", () => {
  it("matches research/rollers.md's takeoff-angle table for a 10:1 ratio (default-ish roller)", () => {
    const result = checkRollerRideability({ ...ROLLER_DEFAULTS, height: 0.3, length: 3, periods: 1 });
    expect(result.maxAngleDeg).toBeGreaterThanOrEqual(14);
    expect(result.maxAngleDeg).toBeLessThanOrEqual(18);
    expect(result.ridable).toBe(true);
  });

  it("matches research/rollers.md's steepest cited example (10:2.5 ratio, ~38°) as right at the limit", () => {
    const result = checkRollerRideability({ ...ROLLER_DEFAULTS, height: 0.75, length: 3, periods: 1 });
    expect(result.maxAngleDeg).toBeCloseTo(38, 0);
  });

  it("flags a roller steeper than the steepest example on record as unridable", () => {
    const result = checkRollerRideability({ ...ROLLER_DEFAULTS, height: 1.2, length: 3, periods: 1 });
    expect(result.maxAngleDeg).toBeGreaterThan(result.maxRideableAngleDeg);
    expect(result.ridable).toBe(false);
  });

  it("passes the app's own defaults", () => {
    const result = checkRollerRideability(ROLLER_DEFAULTS);
    expect(result.ridable).toBe(true);
  });
});
