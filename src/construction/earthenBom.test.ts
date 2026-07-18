import { describe, expect, it } from "vitest";
import { calculateRollerEarthenBom } from "./earthenBom";
import { ROLLER_DEFAULTS } from "../obstacles/roller";

describe("calculateRollerEarthenBom", () => {
  it("computes compacted fill volume as cross-section area * width", () => {
    // Area under one full period of (h/2)(1-cos(2*pi*x/L)) over [0,L] is (h/2)*L.
    const expectedArea = (ROLLER_DEFAULTS.height / 2) * ROLLER_DEFAULTS.length;
    const bom = calculateRollerEarthenBom(ROLLER_DEFAULTS);
    expect(bom.compactedFillVolumeM3).toBeCloseTo(expectedArea * ROLLER_DEFAULTS.width, 2);
  });

  it("applies the soil profile's compaction waste factor to get loose fill volume", () => {
    const bom = calculateRollerEarthenBom(ROLLER_DEFAULTS, {
      safeSlopeAngleDeg: 34,
      compactionWasteFactor: 1.5,
    });
    expect(bom.looseFillVolumeM3).toBeCloseTo(bom.compactedFillVolumeM3 * 1.5, 5);
  });

  it("sizes geotextile fabric to the footprint rectangle", () => {
    const bom = calculateRollerEarthenBom(ROLLER_DEFAULTS);
    expect(bom.geotextileFabricAreaM2).toBeCloseTo(
      ROLLER_DEFAULTS.length * ROLLER_DEFAULTS.width,
      5,
    );
  });
});
