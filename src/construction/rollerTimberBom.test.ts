import { describe, expect, it } from "vitest";
import { calculateRollerTimberBom } from "./rollerTimberBom";
import { buildRollerTimberFrame, groupMembersByLength } from "./rollerTimberFrame";
import { ROLLER_DEFAULTS } from "../obstacles/roller";
import { TIMBER_STOCK } from "./timberStock";

describe("calculateRollerTimberBom", () => {
  it("adds a third rail's worth of sections/length and posts when centerRail is on", () => {
    const without = calculateRollerTimberBom(ROLLER_DEFAULTS, false, 2);
    const withCenter = calculateRollerTimberBom(ROLLER_DEFAULTS, true, 2);
    expect(withCenter.railCount).toBe(without.railCount + 1);
    expect(withCenter.railSectionCount).toBeGreaterThan(without.railSectionCount);
    expect(withCenter.railLinearMetersM).toBeGreaterThan(without.railLinearMetersM);
    const totalPosts = (bom: { postGroups: { count: number }[] }) => bom.postGroups.reduce((sum, g) => sum + g.count, 0);
    expect(totalPosts(withCenter)).toBeGreaterThan(totalPosts(without));
  });

  it("matches the frame layout's grouped post lengths/counts and rail section count", () => {
    const bom = calculateRollerTimberBom(ROLLER_DEFAULTS, false, 2);
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    expect(bom.postGroups).toEqual(groupMembersByLength(frame.posts, 1));
    expect(bom.railSectionCount).toBe(frame.sectionsPerRail * frame.railZOffsets.length);
  });

  it("packs more posts per rail as additionalPostsPerSection increases", () => {
    const sparse = calculateRollerTimberBom(ROLLER_DEFAULTS, false, 1);
    const dense = calculateRollerTimberBom(ROLLER_DEFAULTS, false, 4);
    const totalPosts = (bom: { postGroups: { count: number }[] }) => bom.postGroups.reduce((sum, g) => sum + g.count, 0);
    expect(totalPosts(dense)).toBeGreaterThan(totalPosts(sparse));
  });

  it("matches the frame layout's decking board count", () => {
    const bom = calculateRollerTimberBom(ROLLER_DEFAULTS, false, 2);
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    expect(bom.deckingBoardCount).toBe(frame.deckingBoards.length);
  });

  it("sums decking board spans (their length across the width) with the waste factor applied", () => {
    const params = { ...ROLLER_DEFAULTS, widthStart: 1, widthEnd: 1 };
    const bom = calculateRollerTimberBom(params, false, 2);
    const frame = buildRollerTimberFrame(params, false, 2);
    const rawTotal = frame.deckingBoards.reduce((sum, board) => sum + board.size[2], 0);
    expect(bom.deckingBoardLinearMetersM).toBeCloseTo(rawTotal * TIMBER_STOCK.boardWasteFactor, 5);
  });

  it("matches the frame layout's grouped decking board spans/counts, one group when untapered", () => {
    const params = { ...ROLLER_DEFAULTS, widthStart: 1, widthEnd: 1 };
    const bom = calculateRollerTimberBom(params, false, 2);
    const frame = buildRollerTimberFrame(params, false, 2);
    expect(bom.deckingBoardGroups).toEqual(groupMembersByLength(frame.deckingBoards, 2));
    expect(bom.deckingBoardGroups).toHaveLength(1);
  });

  it("splits decking boards into multiple groups when the roller's width tapers", () => {
    const params = { ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 2.5 };
    const bom = calculateRollerTimberBom(params, false, 2);
    expect(bom.deckingBoardGroups.length).toBeGreaterThan(1);
    expect(bom.deckingBoardGroups.reduce((sum, g) => sum + g.count, 0)).toBe(bom.deckingBoardCount);
  });

  it("includes the embedment depth in every post group's total length", () => {
    const bom = calculateRollerTimberBom(ROLLER_DEFAULTS, false, 2);
    for (const group of bom.postGroups) {
      expect(group.totalLengthM).toBeGreaterThan(TIMBER_STOCK.postEmbedmentDepthM);
    }
  });
});
