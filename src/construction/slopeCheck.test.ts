import { describe, expect, it } from "vitest";
import { checkRollerSlope } from "./slopeCheck";
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
});
