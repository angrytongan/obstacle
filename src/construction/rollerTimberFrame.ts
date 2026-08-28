import * as THREE from "three";
import type { RollerParams } from "../obstacles/roller";
import { rollerHeightAt, rollerProfilePoints, rollerSlopeAt, rollerWidthAt } from "../obstacles/roller";
import { TIMBER_STOCK } from "./timberStock";

/** A timber member: a box centered at `position` with the given `size` (x/y/z extents,
 * measured before rotation), optionally tilted `rotationZ` radians around the Z (width)
 * axis — used by decking boards to follow the rail's local tangent, posts stay vertical
 * (`rotationZ` omitted/0). Plain data, not THREE.* — the 3D builder and the BOM calculator
 * both derive their counts/lengths from the same layout so they can't drift apart. */
export interface TimberMember {
  position: [number, number, number];
  size: [number, number, number];
  rotationZ?: number;
}

export interface RollerTimberFrame {
  /** Fixed Z offset of each rail — two edge rails, plus a center one when requested. */
  railZOffsets: number[];
  posts: TimberMember[];
  /** Flat transverse decking boards resting on top of the rails — see decking board layout
   * comment on {@link buildRollerTimberFrame}. */
  deckingBoards: TimberMember[];
  /** Quarter-sine-wave sections per rail (4 * periods) — each one a separate fabricated
   * curved piece in the real build, see decisions.md. */
  sectionsPerRail: number;
  /** Curved (arc) length of one rail, in meters — every rail follows the same height
   * profile, just at a different fixed Z, so this is the same for all of them. */
  railArcLengthM: number;
}

// A post below this height has nothing meaningful to hold up — real builds don't frame
// the zero-height ends either, the decking just tapers to grade unsupported there.
const MIN_RAIL_HEIGHT_M = 0.05;
const ARC_LENGTH_SAMPLES_PER_SECTION = 8;

/** X positions of the quarter-sine-wave section joints: 4 per period, evenly spaced. */
function quarterSineBoundaries(params: RollerParams): number[] {
  const sections = 4 * params.periods;
  return Array.from({ length: sections + 1 }, (_, i) => (i / sections) * params.length);
}

/** Post X positions: one mandatory post at *every* quarter-sine section boundary — a joint
 * where two curved rail pieces meet always needs a support, so this isn't optional — plus
 * `additionalPostsPerSection` more, equally spaced strictly between each pair of consecutive
 * boundaries (so they never duplicate a boundary post). `additionalPostsPerSection === 0`
 * means just the mandatory boundary posts; `1` adds a midpoint to every section (the app's
 * original fixed scheme); higher values pack more in. The very last boundary is added
 * explicitly, since the loop below only ever contributes its section's own *left* boundary. */
function postXPositions(params: RollerParams, additionalPostsPerSection: number): number[] {
  const boundaries = quarterSineBoundaries(params);
  const xs = new Set<number>();
  for (let i = 0; i < boundaries.length - 1; i++) {
    const x0 = boundaries[i];
    const span = boundaries[i + 1] - x0;
    xs.add(x0);
    for (let k = 1; k <= additionalPostsPerSection; k++) {
      xs.add(x0 + (k / (additionalPostsPerSection + 1)) * span);
    }
  }
  xs.add(boundaries[boundaries.length - 1]);
  return [...xs].sort((a, b) => a - b);
}

function sectionArcLengthM(x0: number, x1: number, params: RollerParams): number {
  let total = 0;
  let prevX = x0;
  let prevY = rollerHeightAt(x0, params);
  for (let i = 1; i <= ARC_LENGTH_SAMPLES_PER_SECTION; i++) {
    const x = x0 + ((x1 - x0) * i) / ARC_LENGTH_SAMPLES_PER_SECTION;
    const y = rollerHeightAt(x, params);
    total += Math.hypot(x - prevX, y - prevY);
    prevX = x;
    prevY = y;
  }
  return total;
}

/** Height of the rail's top surface — one rail depth *above* the roller's own profile height,
 * so the rail's *bottom* lands exactly on the roller's own profile (0 at both ends, where the
 * mound would meet the ground) instead of the rail's top landing there. The rail — not the
 * (thinner) decking above it — is the structure's actual lowest point almost everywhere, since
 * posts hold it up off the ground; putting the rail's own underside on the ground curve is what
 * keeps it from penetrating below grade the way it did when the *top* was pinned there instead
 * (the rail's own depth then had nowhere to go but underground). This does mean the deck's own
 * top — the real rideable surface — now sits a constant `railSizeM.depth + deckingBoardThicknessM`
 * above the nominal `height`, everywhere, rather than matching it exactly the way the earthen
 * method's mound does: a real ramp's structural thickness has to go somewhere, and a few cm
 * against a roller a few tens of cm to a couple meters tall isn't worth chasing away. Ignores
 * the small extra gap a tilted board's own slope would add for the same reason. */
function railTopHeightAt(x: number, params: RollerParams): number {
  return rollerHeightAt(x, params) + TIMBER_STOCK.railSizeM.depth;
}

/** [xStart, xEnd] of each decking board along the length: fixed board width + gap pitch,
 * tiled from x=0, with the last board trimmed to fit the remaining length — same as cutting
 * the last real board to fit rather than forcing an even spacing. */
function deckingBoardSpans(params: RollerParams): [number, number][] {
  const { deckingBoardWidthM, deckingBoardGapM } = TIMBER_STOCK;
  const pitch = deckingBoardWidthM + deckingBoardGapM;
  const spans: [number, number][] = [];
  for (let x = 0; x < params.length; x += pitch) {
    spans.push([x, Math.min(x + deckingBoardWidthM, params.length)]);
  }
  return spans;
}

/** Fixed Z offset for the two edge rails: inset half a rail-width from the *narrowest*
 * point of the (possibly tapered) footprint, so a straight-in-Z rail never sticks out past
 * the deck edge anywhere along the length — see decisions.md for why rails run straight
 * rather than also bowing sideways to follow the width taper. */
function edgeRailZOffset(params: RollerParams): number {
  const narrowestWidth = Math.min(params.widthStart, params.widthEnd);
  return narrowestWidth / 2 - TIMBER_STOCK.railSizeM.width / 2;
}

/**
 * Timber rib-and-deck frame as curved rails: two (or three, with `centerRail`) continuous
 * rails follow the roller's own height profile the full length — each rail's *underside*
 * (not its top) traces `rollerHeightAt`, so it touches the ground exactly where the roller's
 * own profile does (both ends) instead of dipping below grade — each fabricated from
 * 4*periods quarter-sine-wave sections, held up by a mandatory post at every section boundary
 * plus `additionalPostsPerSection` more per section (see {@link postXPositions}) — no
 * horizontal cross members, posts land directly under the rails they support, reaching up to
 * the rail's (raised) underside, then continuing `postEmbedmentDepthM` further down into the
 * ground so the structure can't shift sideways. Flat decking boards (real timber, not
 * plywood — not weather-resistant enough outdoors) sit on top of the rails, transverse to
 * them, tiled along the length with a small gap between each for drainage/expansion — their
 * top surface sits `railSizeM.depth + deckingBoardThicknessM` above the nominal `height`
 * everywhere (see {@link railTopHeightAt}), rather than matching it exactly the way the
 * earthen method's mound does, since the structure's own thickness has to sit somewhere above
 * the ground it's built on. See timberStock.ts for the stock sizes and decisions.md for why
 * this shape was chosen.
 */
export function buildRollerTimberFrame(
  params: RollerParams,
  centerRail: boolean,
  additionalPostsPerSection: number,
): RollerTimberFrame {
  const { postSizeM, deckingBoardThicknessM, postEmbedmentDepthM } = TIMBER_STOCK;
  const edgeOffset = edgeRailZOffset(params);
  const railZOffsets = centerRail ? [-edgeOffset, 0, edgeOffset] : [-edgeOffset, edgeOffset];

  const posts: TimberMember[] = [];
  for (const x of postXPositions(params, additionalPostsPerSection)) {
    const aboveGroundHeight = rollerHeightAt(x, params);
    if (aboveGroundHeight < MIN_RAIL_HEIGHT_M) continue;

    // Posts run from postEmbedmentDepthM below grade up to the rail's underside (which is
    // exactly rollerHeightAt(x), see railTopHeightAt) — the total length is what you'd
    // actually buy/cut, the center position accounts for the post no longer being centered
    // on the above-ground portion alone.
    const postHeight = Math.max(aboveGroundHeight, 0.01) + postEmbedmentDepthM;
    const centerY = aboveGroundHeight / 2 - postEmbedmentDepthM / 2;
    const centeredX = x - params.length / 2;
    for (const z of railZOffsets) {
      posts.push({
        position: [centeredX, centerY, z],
        size: [postSizeM.depth, postHeight, postSizeM.width],
      });
    }
  }

  const deckingBoards: TimberMember[] = deckingBoardSpans(params).map(([xStart, xEnd]) => {
    const centerX = (xStart + xEnd) / 2;
    // The board's top rests one board-thickness above the rail's own top (see
    // railTopHeightAt) — not directly on rollerHeightAt — so it stays seated on the rail
    // after the rail's own ground-clearance shift, rather than sinking into it.
    const deckTop = railTopHeightAt(centerX, params) + deckingBoardThicknessM;
    // Tilt the board around Z to the curve's local tangent (see rollerSlopeAt) rather than
    // laying it flat — a real board screwed to the rails follows their slope, not the
    // horizontal, so consecutive boards' edges meet along the curve instead of stepping.
    const rotationZ = Math.atan(rollerSlopeAt(centerX, params));
    // The board's center sits below its own top face by half its thickness *projected*
    // onto Y (cos of the tilt), so the top face — not the untilted center — touches
    // deckTop at this x.
    const centerY = deckTop - (deckingBoardThicknessM / 2) * Math.cos(rotationZ);
    return {
      position: [centerX - params.length / 2, centerY, 0],
      size: [xEnd - xStart, deckingBoardThicknessM, rollerWidthAt(centerX, params)],
      rotationZ,
    };
  });

  const boundaries = quarterSineBoundaries(params);
  let railArcLengthM = 0;
  for (let i = 0; i < boundaries.length - 1; i++) {
    railArcLengthM += sectionArcLengthM(boundaries[i], boundaries[i + 1], params);
  }

  return { railZOffsets, posts, deckingBoards, sectionsPerRail: boundaries.length - 1, railArcLengthM };
}

export interface PostGroup {
  /** Total post length in meters, above-ground portion plus postEmbedmentDepthM. */
  totalLengthM: number;
  count: number;
}

/** Groups posts by their (rounded, to absorb float noise) total length, longest first — posts
 * genuinely do come in only a handful of distinct lengths (the roller's height profile repeats
 * every period, and left/right/center rail posts at the same x always match), so listing every
 * post individually would just repeat the same few lengths over and over. Shared by the parts
 * list (rollerTimberBom.ts) and the 2D drawings (rollerTimberPartDrawings.ts) so neither can
 * group differently from the other. */
export function groupPostsByLength(posts: TimberMember[]): PostGroup[] {
  const countByLengthMm = new Map<number, number>();
  for (const post of posts) {
    const lengthMm = Math.round(post.size[1] * 1000);
    countByLengthMm.set(lengthMm, (countByLengthMm.get(lengthMm) ?? 0) + 1);
  }
  return [...countByLengthMm.entries()]
    .map(([lengthMm, count]) => ({ totalLengthM: lengthMm / 1000, count }))
    .sort((a, b) => b.totalLengthM - a.totalLengthM);
}

/**
 * One curved rail as a solid box-beam following the roller's height profile — offset up by
 * one rail depth ({@link railTopHeightAt}) so the rail's own *underside* touches the ground
 * where the roller's profile does, rather than the rail's top pinning there and the rail's
 * full depth going underground — at a fixed Z offset, in the same centered coordinate frame
 * as {@link buildRollerGeometry}. Four ruled strips (top/bottom/left/right), same technique
 * as the roller mesh itself, just at a constant width instead of the tapered one, plus two
 * flat end caps closing the tube at both ends (unlike the roller mound, which never needs
 * end caps since its own top/bottom strips already meet at y=0 there) — without them the rail
 * reads as a hollow shell when viewed end-on or through a gap.
 */
export function buildRailGeometry(params: RollerParams, zOffset: number): THREE.BufferGeometry {
  const { railSizeM } = TIMBER_STOCK;
  const halfWidth = railSizeM.width / 2;
  const points = rollerProfilePoints(params);
  const positions: number[] = [];
  const indices: number[] = [];

  for (const [x] of points) {
    const y = railTopHeightAt(x, params);
    const cx = x - params.length / 2;
    positions.push(
      cx,
      y,
      zOffset - halfWidth,
      cx,
      y,
      zOffset + halfWidth,
      cx,
      y - railSizeM.depth,
      zOffset - halfWidth,
      cx,
      y - railSizeM.depth,
      zOffset + halfWidth,
    );
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    const quad = (o1: number, o2: number) => indices.push(a + o1, a + o2, b + o2, a + o1, b + o2, b + o1);
    quad(0, 1); // top
    quad(2, 3); // bottom
    quad(0, 2); // -z side
    quad(1, 3); // +z side
  }
  // End caps: close the tube at both ends (each is just the 4 vertices at that one sample,
  // split into 2 triangles) so the rail doesn't look hollow end-on.
  const addCap = (base: number) => indices.push(base, base + 1, base + 3, base, base + 3, base + 2);
  addCap(0);
  addCap((points.length - 1) * 4);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A `THREE.LineSegments`-compatible wireframe outline of one whole rail: the 4 long corner
 * edges (top-left/top-right/bottom-left/bottom-right, each a continuous polyline sampled at
 * the same resolution as {@link buildRailGeometry} so it lines up with the mesh exactly),
 * plus a cap rectangle at *every* quarter-sine section boundary — including the rail's own
 * two ends — so each fabricated section's start and end are visible individually, not just
 * the whole rail's.
 *
 * Built explicitly rather than via `THREE.EdgesGeometry` on the rail mesh: EdgesGeometry only
 * ever exposes the *whole rail's* two ends as cap edges (there's nothing else in the mesh
 * topology marking an individual section's boundary), and its curvature-angle threshold also
 * flags some of the smooth top/bottom face's own internal seams as "hard" edges near the
 * steepest parts of the curve — spurious lines this explicit version never generates, since
 * it only ever draws exactly the 4 long edges and the boundary caps, nothing else.
 */
export function buildRailOutlineGeometry(params: RollerParams, zOffset: number): THREE.BufferGeometry {
  const { railSizeM } = TIMBER_STOCK;
  const halfWidth = railSizeM.width / 2;
  const positions: number[] = [];

  const cornersAt = (x: number): [number, number, number][] => {
    const top = railTopHeightAt(x, params);
    const bottom = top - railSizeM.depth;
    const cx = x - params.length / 2;
    return [
      [cx, top, zOffset - halfWidth],
      [cx, top, zOffset + halfWidth],
      [cx, bottom, zOffset + halfWidth],
      [cx, bottom, zOffset - halfWidth],
    ];
  };

  const points = rollerProfilePoints(params);
  const cornersByX = points.map(([x]) => cornersAt(x));
  for (let corner = 0; corner < 4; corner++) {
    for (let i = 0; i < cornersByX.length - 1; i++) {
      positions.push(...cornersByX[i][corner], ...cornersByX[i + 1][corner]);
    }
  }

  for (const x of quarterSineBoundaries(params)) {
    const corners = cornersAt(x);
    for (let i = 0; i < corners.length; i++) {
      positions.push(...corners[i], ...corners[(i + 1) % corners.length]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}
