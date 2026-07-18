import { describe, expect, it } from "vitest";
import { calculateRollerEarthenBom } from "./earthenBom";
import { ROLLER_DEFAULTS } from "../obstacles/roller";

describe("calculateRollerEarthenBom", () => {
  it("computes compacted fill volume as cross-section area * width, for a constant width", () => {
    // Area under one full period of (h/2)(1-cos(2*pi*x/L)) over [0,L] is (h/2)*L.
    const expectedArea = (ROLLER_DEFAULTS.height / 2) * ROLLER_DEFAULTS.length;
    const bom = calculateRollerEarthenBom(ROLLER_DEFAULTS);
    expect(bom.compactedFillVolumeM3).toBeCloseTo(expectedArea * ROLLER_DEFAULTS.widthStart, 2);
  });

  it("computes the same fill volume for an asymmetric taper with the same average width", () => {
    // Roller height profile is symmetric about its midpoint (integer periods), so tapered
    // volume reduces to base area * average width — same as the constant-width case above.
    const expectedArea = (ROLLER_DEFAULTS.height / 2) * ROLLER_DEFAULTS.length;
    const bom = calculateRollerEarthenBom({ ...ROLLER_DEFAULTS, widthStart: 0.4, widthEnd: 1.6 });
    expect(bom.compactedFillVolumeM3).toBeCloseTo(expectedArea * 1.0, 2);
  });

  it("applies the soil profile's compaction waste factor to get loose fill volume", () => {
    const bom = calculateRollerEarthenBom(ROLLER_DEFAULTS, {
      safeSlopeAngleDeg: 34,
      compactionWasteFactor: 1.5,
    });
    expect(bom.looseFillVolumeM3).toBeCloseTo(bom.compactedFillVolumeM3 * 1.5, 5);
  });

  it("sizes geotextile fabric to the footprint trapezoid (length * average width)", () => {
    const bom = calculateRollerEarthenBom({ ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 1.5 });
    expect(bom.geotextileFabricAreaM2).toBeCloseTo(ROLLER_DEFAULTS.length * 1.0, 5);
  });
});
