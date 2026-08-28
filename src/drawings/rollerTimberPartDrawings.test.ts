import { describe, expect, it } from "vitest";
import {
  allRollerTimberPartDrawings,
  averageMemberLength,
  deckingBoardPartDrawing,
  postPartDrawings,
  railSectionPartDrawing,
} from "./rollerTimberPartDrawings";
import { buildRollerTimberFrame, groupPostsByLength, type TimberMember } from "../construction/rollerTimberFrame";
import { ROLLER_DEFAULTS } from "../obstacles/roller";
import { TIMBER_STOCK } from "../construction/timberStock";

describe("averageMemberLength", () => {
  it("matches a hand-computed mean", () => {
    const members: TimberMember[] = [
      { position: [0, 0, 0], size: [1, 2, 3] },
      { position: [0, 0, 0], size: [1, 4, 9] },
    ];
    expect(averageMemberLength(members, 1)).toBeCloseTo(3, 10);
    expect(averageMemberLength(members, 2)).toBeCloseTo(6, 10);
  });
});

describe("railSectionPartDrawing", () => {
  it("spans one quarter-period in mm, and the rail's own depth vertically at each x", () => {
    const drawing = railSectionPartDrawing(ROLLER_DEFAULTS);
    const xs = drawing.outline[0].map(([x]) => x);
    const quarterLengthMm = (ROLLER_DEFAULTS.length / (4 * ROLLER_DEFAULTS.periods)) * 1000;
    expect(Math.max(...xs)).toBeCloseTo(quarterLengthMm, 5);
    expect(Math.min(...xs)).toBeCloseTo(0, 5);

    // At the very start (x=0), the roller's height is 0, so the section's own vertical extent
    // there is exactly the rail's own depth.
    const startTop = drawing.outline[0][0];
    const startBottom = drawing.outline[0][drawing.outline[0].length - 1];
    expect(startTop[1] - startBottom[1]).toBeCloseTo(TIMBER_STOCK.railSizeM.depth * 1000, 5);
  });
});

describe("postPartDrawings / deckingBoardPartDrawing", () => {
  it("returns one drawing per distinct post length, matching groupPostsByLength", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    const groups = groupPostsByLength(frame.posts);
    const drawings = postPartDrawings(ROLLER_DEFAULTS, false, 2);
    expect(drawings).toHaveLength(groups.length);
    drawings.forEach((drawing, i) => {
      const lengthMm = drawing.outline[0][1][0] - drawing.outline[0][0][0];
      expect(lengthMm).toBeCloseTo(groups[i].totalLengthM * 1000, 5);
      expect(drawing.title).toContain(`${groups[i].count}x`);
    });
  });

  it("notes the embedment depth on every post drawing", () => {
    const drawings = postPartDrawings(ROLLER_DEFAULTS, false, 2);
    for (const drawing of drawings) {
      expect(drawing.labels.lines.some((l) => l.includes("embedded"))).toBe(true);
    }
  });

  it("notes the decking average only when the roller's width tapers", () => {
    const flat = deckingBoardPartDrawing({ ...ROLLER_DEFAULTS, widthStart: 1, widthEnd: 1 }, false, 2);
    const tapered = deckingBoardPartDrawing({ ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 1.5 }, false, 2);
    expect(flat.labels.lines.some((l) => l.includes("average"))).toBe(false);
    expect(tapered.labels.lines.some((l) => l.includes("average"))).toBe(true);
  });
});

describe("allRollerTimberPartDrawings", () => {
  it("returns rail section, one drawing per post-length group, then decking board", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    const postGroupCount = groupPostsByLength(frame.posts).length;
    const drawings = allRollerTimberPartDrawings(ROLLER_DEFAULTS, false, 2);
    expect(drawings[0].title).toBe("Rail section");
    expect(drawings[drawings.length - 1].title).toBe("Decking board");
    expect(drawings).toHaveLength(2 + postGroupCount);
  });
});
