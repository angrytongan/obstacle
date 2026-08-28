import { describe, expect, it } from "vitest";
import { buildRailGeometry, buildRailOutlineGeometry, buildRollerTimberFrame, groupPostsByLength } from "./rollerTimberFrame";
import { ROLLER_DEFAULTS, rollerHeightAt, rollerProfilePoints, rollerSlopeAt, rollerWidthAt } from "../obstacles/roller";
import { TIMBER_STOCK } from "./timberStock";

describe("buildRollerTimberFrame", () => {
  it("has two rails without a center rail, three with one", () => {
    const withoutCenter = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    const withCenter = buildRollerTimberFrame(ROLLER_DEFAULTS, true, 2);
    expect(withoutCenter.railZOffsets).toHaveLength(2);
    expect(withCenter.railZOffsets).toHaveLength(3);
    expect(withCenter.railZOffsets).toContain(0);
  });

  it("splits each period into 4 quarter-sine sections", () => {
    const one = buildRollerTimberFrame({ ...ROLLER_DEFAULTS, periods: 1 }, false, 2);
    const three = buildRollerTimberFrame({ ...ROLLER_DEFAULTS, periods: 3 }, false, 2);
    expect(one.sectionsPerRail).toBe(4);
    expect(three.sectionsPerRail).toBe(12);
  });

  it("always puts a mandatory post at every interior section boundary, even with zero additional posts", () => {
    // 4 sections => boundaries at 0, 0.75, 1.5, 2.25, 3 — the two ends (height 0) are skipped,
    // leaving the 3 interior boundaries (joints where two rail sections meet) as posts.
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 0);
    const xsPerRail = frame.posts.length / frame.railZOffsets.length;
    expect(xsPerRail).toBe(3);
    const xs = frame.posts
      .filter((post) => post.position[2] === frame.railZOffsets[0])
      .map((post) => post.position[0] + ROLLER_DEFAULTS.length / 2)
      .sort((a, b) => a - b);
    expect(xs).toEqual([0.75, 1.5, 2.25]);
  });

  it("keeps every mandatory boundary post no matter how many additional posts are added", () => {
    const boundaryXs = [0.75, 1.5, 2.25];
    for (const additionalPostsPerSection of [0, 1, 3]) {
      const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, additionalPostsPerSection);
      const xs = frame.posts
        .filter((post) => post.position[2] === frame.railZOffsets[0])
        .map((post) => post.position[0] + ROLLER_DEFAULTS.length / 2);
      for (const boundaryX of boundaryXs) {
        expect(xs.some((x) => Math.abs(x - boundaryX) < 1e-9)).toBe(true);
      }
    }
  });

  it("adds additionalPostsPerSection extra posts to a section, equally spaced between its boundaries", () => {
    const additionalPostsPerSection = 2;
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, additionalPostsPerSection);
    const xs = frame.posts
      .filter((post) => post.position[2] === frame.railZOffsets[0])
      .map((post) => post.position[0] + ROLLER_DEFAULTS.length / 2)
      .sort((a, b) => a - b);
    // Section [0.75, 1.5] (well clear of the low-height ends, so nothing here gets caught by
    // the MIN_RAIL_HEIGHT_M safety net) should get 2 extra posts at 0.75 + span/3 and
    // 0.75 + 2*span/3, on top of its own two mandatory boundary posts.
    const [x0, x1] = [0.75, 1.5];
    const span = x1 - x0;
    for (const x of [x0 + span / 3, x0 + (2 * span) / 3]) {
      expect(xs.some((actual) => Math.abs(actual - x) < 1e-9)).toBe(true);
    }
  });

  it("adds more posts per rail as additionalPostsPerSection increases", () => {
    const sparse = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 0);
    const dense = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 4);
    expect(dense.posts.length).toBeGreaterThan(sparse.posts.length);
  });

  it("keeps edge rails within the footprint at the narrowest point", () => {
    const frame = buildRollerTimberFrame({ ...ROLLER_DEFAULTS, widthStart: 0.6, widthEnd: 2 }, false, 2);
    const [left, right] = frame.railZOffsets;
    expect(right).toBeLessThanOrEqual(0.3);
    expect(left).toBeCloseTo(-right, 10);
  });

  it("computes a longer rail arc length for a taller roller", () => {
    const low = buildRollerTimberFrame({ ...ROLLER_DEFAULTS, height: 0.2 }, false, 2);
    const high = buildRollerTimberFrame({ ...ROLLER_DEFAULTS, height: 1.2 }, false, 2);
    expect(high.railArcLengthM).toBeGreaterThan(low.railArcLengthM);
  });

  it("tiles decking boards at most deckingBoardWidthM wide, covering the full length", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    let coveredLength = 0;
    for (const board of frame.deckingBoards) {
      expect(board.size[0]).toBeGreaterThan(0);
      expect(board.size[0]).toBeLessThanOrEqual(TIMBER_STOCK.deckingBoardWidthM + 1e-9);
      coveredLength += board.size[0];
    }
    // Last board is trimmed to fit, so boards' widths alone (excluding gaps) never exceed the length.
    expect(coveredLength).toBeLessThanOrEqual(ROLLER_DEFAULTS.length + 1e-9);
    const lastBoard = frame.deckingBoards[frame.deckingBoards.length - 1];
    const lastBoardEndX = lastBoard.position[0] + lastBoard.size[0] / 2 + ROLLER_DEFAULTS.length / 2;
    expect(lastBoardEndX).toBeCloseTo(ROLLER_DEFAULTS.length, 5);
  });

  it("sizes each decking board's thickness and width to match the roller profile", () => {
    const params = { ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 1.5 };
    const frame = buildRollerTimberFrame(params, false, 2);
    for (const board of frame.deckingBoards) {
      expect(board.size[1]).toBeCloseTo(TIMBER_STOCK.deckingBoardThicknessM, 10);
      const centerX = board.position[0] + params.length / 2;
      expect(board.size[2]).toBeCloseTo(rollerWidthAt(centerX, params), 10);
    }
  });

  it("tilts each decking board to the curve's local tangent, top face one rail-depth + board-thickness above the profile height", () => {
    const params = { ...ROLLER_DEFAULTS, widthStart: 0.5, widthEnd: 1.5 };
    const frame = buildRollerTimberFrame(params, false, 2);
    for (const board of frame.deckingBoards) {
      const centerX = board.position[0] + params.length / 2;
      expect(board.rotationZ).toBeCloseTo(Math.atan(rollerSlopeAt(centerX, params)), 10);

      // The board's top-face center (offset from its own center by half its thickness,
      // rotated) should land one rail depth + one board thickness above the curve's height at
      // this x — the deck sits on top of the (ground-clearance-raised) rail, see
      // railTopHeightAt in rollerTimberFrame.ts.
      const topOffsetY = (board.size[1] / 2) * Math.cos(board.rotationZ!);
      const expectedTop = rollerHeightAt(centerX, params) + TIMBER_STOCK.railSizeM.depth + TIMBER_STOCK.deckingBoardThicknessM;
      expect(board.position[1] + topOffsetY).toBeCloseTo(expectedTop, 10);
    }
  });

  it("keeps posts unrotated", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    for (const post of frame.posts) {
      expect(post.rotationZ ?? 0).toBe(0);
    }
  });

  it("sizes posts to the roller's own height at that x, plus the embedment depth", () => {
    // The crest (x = length/2, centered x = 0) is always a mandatory section boundary post,
    // even with zero additional posts.
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 0);
    const crestPost = frame.posts.find((post) => Math.abs(post.position[0]) < 1e-9)!;
    expect(crestPost.size[1]).toBeCloseTo(ROLLER_DEFAULTS.height + TIMBER_STOCK.postEmbedmentDepthM, 10);
  });

  it("sizes every post to the roller's own height at its x plus the embedment depth, and centers it half the embedment below grade", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    for (const post of frame.posts) {
      const x = post.position[0] + ROLLER_DEFAULTS.length / 2;
      const aboveGround = rollerHeightAt(x, ROLLER_DEFAULTS);
      expect(post.size[1]).toBeCloseTo(aboveGround + TIMBER_STOCK.postEmbedmentDepthM, 10);
      // Bottom (position - size/2) should sit at -postEmbedmentDepthM; top (position + size/2)
      // should sit at the roller's own height — i.e. the rail's underside never dips below grade.
      expect(post.position[1] - post.size[1] / 2).toBeCloseTo(-TIMBER_STOCK.postEmbedmentDepthM, 10);
      expect(post.position[1] + post.size[1] / 2).toBeCloseTo(aboveGround, 10);
    }
  });
});

describe("groupPostsByLength", () => {
  it("groups posts sharing a (rounded) total length into one entry, longest first", () => {
    const frame = buildRollerTimberFrame(ROLLER_DEFAULTS, false, 2);
    const groups = groupPostsByLength(frame.posts);
    expect(groups.reduce((total, g) => total + g.count, 0)).toBe(frame.posts.length);
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1].totalLengthM).toBeGreaterThanOrEqual(groups[i].totalLengthM);
    }
    // The crest post and its mirror (same x-symmetric height) should be grouped together.
    expect(groups.some((g) => g.count > 1)).toBe(true);
  });
});

describe("buildRailGeometry", () => {
  it("closes the tube with a flat end cap at each end, on top of the side/top/bottom strips", () => {
    const geometry = buildRailGeometry(ROLLER_DEFAULTS, 0);
    const segments = rollerProfilePoints(ROLLER_DEFAULTS).length - 1;
    const sideTriangleIndices = segments * 4 * 2 * 3; // 4 quads/segment * 2 triangles/quad * 3 indices/triangle
    const capTriangleIndices = 2 * 2 * 3; // 2 caps * 2 triangles/cap * 3 indices/triangle
    expect(geometry.index!.count).toBe(sideTriangleIndices + capTriangleIndices);
  });

  it("keeps the rail's bounding box unchanged by the end caps — they're flush with the existing end vertices, not new geometry sticking out", () => {
    const geometry = buildRailGeometry(ROLLER_DEFAULTS, 0);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const { railSizeM } = TIMBER_STOCK;
    expect(box.max.z - box.min.z).toBeCloseTo(railSizeM.width, 5);
    expect(box.max.x - box.min.x).toBeCloseTo(ROLLER_DEFAULTS.length, 5);
  });
});

describe("buildRailOutlineGeometry", () => {
  it("draws the 4 long edges plus a cap rectangle at every section boundary, including the rail's own two ends", () => {
    const geometry = buildRailOutlineGeometry(ROLLER_DEFAULTS, 0);
    const pointCount = rollerProfilePoints(ROLLER_DEFAULTS).length;
    const boundaryCount = 4 * ROLLER_DEFAULTS.periods + 1;
    const longEdgePositions = 4 * (pointCount - 1) * 2 * 3; // 4 corners * segments * 2 endpoints * 3 coords
    const capPositions = boundaryCount * 4 * 2 * 3; // 1 cap per boundary * 4 edges * 2 endpoints * 3 coords
    expect(geometry.getAttribute("position").count * 3).toBe(longEdgePositions + capPositions);
  });

  it("matches the rail mesh's own bounding box", () => {
    const outline = buildRailOutlineGeometry(ROLLER_DEFAULTS, 0);
    const rail = buildRailGeometry(ROLLER_DEFAULTS, 0);
    outline.computeBoundingBox();
    rail.computeBoundingBox();
    const outlineBox = outline.boundingBox!;
    const railBox = rail.boundingBox!;
    expect(outlineBox.min.x).toBeCloseTo(railBox.min.x, 5);
    expect(outlineBox.max.x).toBeCloseTo(railBox.max.x, 5);
    expect(outlineBox.min.y).toBeCloseTo(railBox.min.y, 5);
    expect(outlineBox.max.y).toBeCloseTo(railBox.max.y, 5);
    expect(outlineBox.min.z).toBeCloseTo(railBox.min.z, 5);
    expect(outlineBox.max.z).toBeCloseTo(railBox.max.z, 5);
  });

  it("puts a cap rectangle at the rail's own start and end (x=0 and x=length), unlike section-boundary-only outlining", () => {
    const geometry = buildRailOutlineGeometry(ROLLER_DEFAULTS, 0);
    const position = geometry.getAttribute("position").array;
    const xsAtStart: number[] = [];
    const xsAtEnd: number[] = [];
    const halfLength = ROLLER_DEFAULTS.length / 2;
    for (let i = 0; i < position.length; i += 3) {
      const x = position[i];
      if (Math.abs(x + halfLength) < 1e-4) xsAtStart.push(x);
      if (Math.abs(x - halfLength) < 1e-4) xsAtEnd.push(x);
    }
    expect(xsAtStart.length).toBeGreaterThan(0);
    expect(xsAtEnd.length).toBeGreaterThan(0);
  });
});
