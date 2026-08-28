import type { RollerParams } from "../obstacles/roller";
import { buildRollerTimberFrame, groupPostsByLength, type PostGroup } from "./rollerTimberFrame";
import { TIMBER_STOCK } from "./timberStock";

export interface TimberBom {
  railCount: number;
  /** Total fabricated curved rail sections across all rails (4 * periods per rail). */
  railSectionCount: number;
  /** Total curved (arc) length across all rails, in meters. */
  railLinearMetersM: number;
  /** Every post, grouped by its total length (above-ground + embedment) — posts vary by
   * height, so unlike rails/decking this is listed exactly, not averaged into one row. */
  postGroups: PostGroup[];
  deckingBoardCount: number;
  /** 150x28mm decking board stock, with a waste factor for offcuts/trimming. */
  deckingBoardLinearMetersM: number;
}

/** Timber-framed roller BOM: rail/post/decking-board counts and lengths from the same frame
 * layout the 3D builder uses (rollerTimberFrame.ts). */
export function calculateRollerTimberBom(
  params: RollerParams,
  centerRail: boolean,
  additionalPostsPerSection: number,
): TimberBom {
  const frame = buildRollerTimberFrame(params, centerRail, additionalPostsPerSection);
  const { boardWasteFactor } = TIMBER_STOCK;

  const railCount = frame.railZOffsets.length;
  // Each board's "length" as purchased is its span across the width (Z), not its 150mm
  // face width (X) — see rollerTimberFrame.ts's deckingBoards layout.
  const deckingBoardLinearMetersM =
    frame.deckingBoards.reduce((total, board) => total + board.size[2], 0) * boardWasteFactor;

  return {
    railCount,
    railSectionCount: frame.sectionsPerRail * railCount,
    railLinearMetersM: frame.railArcLengthM * railCount,
    postGroups: groupPostsByLength(frame.posts),
    deckingBoardCount: frame.deckingBoards.length,
    deckingBoardLinearMetersM,
  };
}
