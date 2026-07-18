import { describe, expect, it } from "vitest";
import { buildBermGeometry, BERM_DEFAULTS } from "./berm";
import * as THREE from "three";

describe("buildBermGeometry", () => {
  it("centers the footprint on X/Z and sits on Y=0", () => {
    const geometry = buildBermGeometry(BERM_DEFAULTS);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect((box.min.x + box.max.x) / 2).toBeCloseTo(0, 5);
    expect((box.min.z + box.max.z) / 2).toBeCloseTo(0, 5);
    expect(box.min.y).toBeCloseTo(0, 5);
  });

  it("raises the outer edge by width * tan(bankAngle)", () => {
    const geometry = buildBermGeometry(BERM_DEFAULTS);
    geometry.computeBoundingBox();
    const expectedHeight =
      BERM_DEFAULTS.width * Math.tan(THREE.MathUtils.degToRad(BERM_DEFAULTS.bankAngleDeg));
    expect(geometry.boundingBox!.max.y).toBeCloseTo(expectedHeight, 5);
  });
});
