import { describe, expect, it } from "vitest";
import {
  allRollerTimberPartDrawings,
  deckingBoardPartDrawings,
  postPartDrawings,
  railSectionPartDrawing,
} from "./rollerTimberPartDrawings";
import { buildRollerTimberFrame, groupMembersByLength } from "../construction/rollerTimberFrame";
import { ROLLER_DEFAULTS } from "../obstacles/roller";
import { TIMBER_STOCK } from "../construction/timberStock";

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

describe("postPartDrawings / deckingBoardPartDrawings", () => {
  it("returns one drawing per distinct post length, matching groupMembersByLength", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    const groups = groupMembersByLength(frame.posts, 1);
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

  it("returns one decking board drawing when the roller's width doesn't taper", () => {
    const flat = deckingBoardPartDrawings({ ...ROLLER_DEFAULTS, widthStart: 1, widthEnd: 1 }, false, 2);
    expect(flat).toHaveLength(1);
  });

  it("returns one drawing per distinct decking board span when the roller's width tapers, matching groupMembersByLength", () => {
    const params = { ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 1.5 };
    const frame = buildRollerTimberFrame(params, false, 2);
    const groups = groupMembersByLength(frame.deckingBoards, 2);
    const drawings = deckingBoardPartDrawings(params, false, 2);
    expect(drawings.length).toBeGreaterThan(1);
    expect(drawings).toHaveLength(groups.length);
    drawings.forEach((drawing, i) => {
      const lengthMm = drawing.outline[0][1][0] - drawing.outline[0][0][0];
      expect(lengthMm).toBeCloseTo(groups[i].totalLengthM * 1000, 5);
      expect(drawing.title).toContain(`${groups[i].count}x`);
    });
  });
});

describe("allRollerTimberPartDrawings", () => {
  it("returns rail section, one drawing per post-length group, then one per decking-span group", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    const postGroupCount = groupMembersByLength(frame.posts, 1).length;
    const deckingGroupCount = groupMembersByLength(frame.deckingBoards, 2).length;
    const drawings = allRollerTimberPartDrawings(ROLLER_DEFAULTS, false, 2);
    expect(drawings[0].title).toBe("Rail section");
    expect(drawings[drawings.length - 1].title).toContain("Decking board");
    expect(drawings).toHaveLength(1 + postGroupCount + deckingGroupCount);
  });
});
