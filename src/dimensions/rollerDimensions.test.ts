import { describe, expect, it } from "vitest";
import { buildRollerDimensions } from "./rollerDimensions";
import { ROLLER_DEFAULTS } from "../obstacles/roller";

describe("buildRollerDimensions", () => {
  it("returns one dimension each for length, width, and height, labeled to one decimal", () => {
    const dims = buildRollerDimensions(ROLLER_DEFAULTS);
    expect(dims).toHaveLength(3);
    expect(dims.map((d) => d.text)).toEqual(["3.0 m", "1.0 m", "0.4 m"]);
  });

  it("anchors the height dimension at the midpoint for a single-period roller", () => {
    const dims = buildRollerDimensions(ROLLER_DEFAULTS);
    const heightDim = dims[2];
    // labelPosition.x should sit at the crest (x=0 for periods=1), not at a footprint edge.
    expect(heightDim.labelPosition.x).toBeCloseTo(0, 5);
  });

  it("anchors the height dimension at the first crest for a multi-period roller", () => {
    const dims = buildRollerDimensions({ ...ROLLER_DEFAULTS, periods: 2 });
    const heightDim = dims[2];
    // crestX = length/(2*periods) - length/2 = 3/4 - 1.5 = -0.75
    expect(heightDim.labelPosition.x).toBeCloseTo(-0.75, 5);
  });
});
