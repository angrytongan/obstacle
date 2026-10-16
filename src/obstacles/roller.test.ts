import { describe, expect, it } from "vitest";
import { buildRollerGeometry, ROLLER_DEFAULTS } from "./roller";

describe("buildRollerGeometry", () => {
  it("centers the footprint on X/Z and sits on Y=0", () => {
    const geometry = buildRollerGeometry(ROLLER_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect(box.min.x).toBeCloseTo(-ROLLER_DEFAULTS.length / 2, 5);
    expect(box.max.x).toBeCloseTo(ROLLER_DEFAULTS.length / 2, 5);
    expect(box.min.z).toBeCloseTo(-ROLLER_DEFAULTS.widthStart / 2, 5);
    expect(box.max.z).toBeCloseTo(ROLLER_DEFAULTS.widthStart / 2, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("reaches the configured height at its crest", () => {
    const geometry = buildRollerGeometry(ROLLER_DEFAULTS);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(ROLLER_DEFAULTS.height, 2);
  });

  it("adds more geometry detail for more periods", () => {
    const one = buildRollerGeometry({ ...ROLLER_DEFAULTS, periods: 1 });
    const three = buildRollerGeometry({ ...ROLLER_DEFAULTS, periods: 3 });
    expect(three.getAttribute("position").count).toBeGreaterThan(one.getAttribute("position").count);
  });

  it("tapers the width linearly between widthStart and widthEnd", () => {
    const geometry = buildRollerGeometry({ ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 2.5 });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    // Widest end (2.5) sets the overall Z extent; narrowest end (0.5) is well inside it.
    expect(box.max.z - box.min.z).toBeCloseTo(2.5, 5);
  });
});
