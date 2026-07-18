import { describe, expect, it } from "vitest";
import { buildKickerGeometry, KICKER_DEFAULTS } from "./kicker";

describe("buildKickerGeometry", () => {
  it("centers the footprint on X/Z and sits on Y=0", () => {
    const geometry = buildKickerGeometry(KICKER_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("reaches the configured height at the lip", () => {
    const geometry = buildKickerGeometry(KICKER_DEFAULTS);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.max.y).toBeCloseTo(KICKER_DEFAULTS.height, 2);
  });

  it("has the configured width along Z", () => {
    const geometry = buildKickerGeometry(KICKER_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    expect(box.max.z - box.min.z).toBeCloseTo(KICKER_DEFAULTS.width, 5);
  });
});
