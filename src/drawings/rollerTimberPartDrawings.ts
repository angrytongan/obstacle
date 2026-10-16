import type { RollerParams } from "../obstacles/roller";
import { rollerHeightAt } from "../obstacles/roller";
import { buildRollerTimberFrame, groupMembersByLength } from "../construction/rollerTimberFrame";
import { TIMBER_STOCK } from "../construction/timberStock";
import type { Point } from "./svgDimension";

export interface DimensionSpec {
  start: Point;
  end: Point;
  offsetDir: Point;
  offsetDistance: number;
  text: string;
}

/** One anchored, top-down stack of text lines — a single block per part, not one independent
 * position per line, so the renderer (which alone knows the font size these get drawn at) can
 * space the lines by that font size and guarantee they don't overlap. */
export interface LabelBlock {
  anchor: Point;
  lines: string[];
}

export interface PartDrawing {
  title: string;
  outline: Point[][];
  dimensions: DimensionSpec[];
  labels: LabelBlock;
}

function formatMm(valueMm: number): string {
  return `${Math.round(valueMm)}mm`;
}

// How far a dimension line sits off the outline — a fixed fraction of the part's own bounding
// size, so differently-scaled parts (a curved rail section vs. a post's cross-section) each get
// proportionally sensible spacing. Same factors half-pipe's halfPipePartDrawings.ts uses.
const OFFSET_FACTOR = 0.12;
const LABEL_OFFSET_FACTOR = OFFSET_FACTOR * 3;

/**
 * One box-shaped part, drawn as a length x height rectangle (its own face/elevation view) with
 * the third dimension (thickness — out of this view's plane) called out as a text label.
 * Ported from half-pipe's halfPipePartDrawings.ts (`rectanglePartDrawing`), generic over any
 * box part.
 */
function rectanglePartDrawing(title: string, lengthMm: number, heightMm: number, thicknessMm: number): PartDrawing {
  const halfLength = lengthMm / 2;
  const halfHeight = heightMm / 2;
  const corners: Point[] = [
    [-halfLength, -halfHeight],
    [halfLength, -halfHeight],
    [halfLength, halfHeight],
    [-halfLength, halfHeight],
  ];
  const maxExtent = Math.max(lengthMm, heightMm);
  const offsetDistance = maxExtent * OFFSET_FACTOR;

  return {
    title,
    outline: [corners],
    dimensions: [
      { start: corners[0], end: corners[1], offsetDir: [0, -1], offsetDistance, text: formatMm(lengthMm) },
      { start: corners[1], end: corners[2], offsetDir: [1, 0], offsetDistance, text: formatMm(heightMm) },
    ],
    labels: { anchor: [0, -halfHeight - maxExtent * LABEL_OFFSET_FACTOR], lines: [`Thickness: ${formatMm(thicknessMm)}`] },
  };
}

/**
 * One real quarter-sine-wave rail section's curve — the first one, x from 0 to
 * length/(4*periods) — not an idealized/averaged shape, since a curve can't be "averaged" the
 * way a straight length can (see rollerTimberFrame.ts: by symmetry there are at most 2 distinct
 * section shapes per period; only this one is drawn, noted in the labels). Outline is the top
 * curve (rollerHeightAt samples) and a parallel bottom curve offset straight down by the rail's
 * own depth — matching how buildRailGeometry represents the rail's cross-section (constant
 * vertical thickness, not curve-normal).
 */
export function railSectionPartDrawing(params: RollerParams): PartDrawing {
  const { railSizeM } = TIMBER_STOCK;
  const quarterLength = params.length / (4 * params.periods);
  const sampleCount = 16;
  const top: Point[] = Array.from({ length: sampleCount + 1 }, (_, i) => {
    const x = (i / sampleCount) * quarterLength;
    return [x * 1000, rollerHeightAt(x, params) * 1000];
  });
  const bottom: Point[] = top.map(([x, y]) => [x, y - railSizeM.depth * 1000]);
  const outline = [...top, ...[...bottom].reverse()];

  const xs = outline.map(([x]) => x);
  const ys = outline.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const maxExtent = Math.max(maxX - minX, maxY - minY);
  const offsetDistance = maxExtent * OFFSET_FACTOR;

  return {
    title: "Rail section",
    outline: [outline],
    dimensions: [
      // Material sits toward -X of x=maxX (the curve's rightmost point is also its tallest),
      // so +X points away from it.
      { start: [maxX, minY], end: [maxX, maxY], offsetDir: [1, 0], offsetDistance, text: formatMm(maxY - minY) },
      // Material sits above y=minY everywhere (the curve only touches it at x=minX), so -Y
      // points away from it.
      { start: [minX, minY], end: [maxX, minY], offsetDir: [0, -1], offsetDistance, text: formatMm(maxX - minX) },
    ],
    labels: {
      anchor: [minX + (maxX - minX) / 2, minY - maxExtent * LABEL_OFFSET_FACTOR],
      lines: [
        `Width: ${formatMm(railSizeM.width * 1000)}`,
        `1 of ${params.periods * 4} sections per rail (first quarter shown — see parts list for the average)`,
      ],
    },
  };
}

/** Posts vary in height along the curve (see rollerTimberFrame.ts) — unlike rail sections,
 * every distinct post length gets its own drawing (see groupMembersByLength), not an average,
 * so the quantity and exact cut length for each is always listed. */
export function postPartDrawings(params: RollerParams, centerRail: boolean, additionalPostsPerSection: number): PartDrawing[] {
  const frame = buildRollerTimberFrame(params, centerRail, additionalPostsPerSection);
  const { postSizeM, postEmbedmentDepthM } = TIMBER_STOCK;
  return groupMembersByLength(frame.posts, 1).map(({ totalLengthM, count }) => {
    const drawing = rectanglePartDrawing(
      `Post — ${count}x`,
      totalLengthM * 1000,
      postSizeM.width * 1000,
      postSizeM.depth * 1000,
    );
    drawing.labels.lines.push(`Includes ${Math.round(postEmbedmentDepthM * 1000)}mm embedded in the ground`);
    return drawing;
  });
}

/** Decking boards vary in span (their length across the width) when the roller tapers — same
 * treatment as posts: grouped and listed exactly (see groupMembersByLength), not averaged, so
 * every distinct board span gets its own drawing. One drawing when the roller doesn't taper
 * (every board shares the same span). */
export function deckingBoardPartDrawings(params: RollerParams, centerRail: boolean, additionalPostsPerSection: number): PartDrawing[] {
  const frame = buildRollerTimberFrame(params, centerRail, additionalPostsPerSection);
  const { deckingBoardWidthM, deckingBoardThicknessM } = TIMBER_STOCK;
  return groupMembersByLength(frame.deckingBoards, 2).map(({ totalLengthM, count }) =>
    rectanglePartDrawing(`Decking board — ${count}x`, totalLengthM * 1000, deckingBoardWidthM * 1000, deckingBoardThicknessM * 1000),
  );
}

export function allRollerTimberPartDrawings(params: RollerParams, centerRail: boolean, additionalPostsPerSection: number): PartDrawing[] {
  return [
    railSectionPartDrawing(params),
    ...postPartDrawings(params, centerRail, additionalPostsPerSection),
    ...deckingBoardPartDrawings(params, centerRail, additionalPostsPerSection),
  ];
}
