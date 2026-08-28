/**
 * Minimal metric dimensional-timber stock catalog for timber-framed construction — a small
 * fixed set of sizes, not a full engineered range. Generic across obstacle types (not
 * roller-specific) so berm/kicker timber methods can reuse it later.
 *
 * Decking is solid timber boards, not plywood — plywood isn't weather-resistant enough for
 * an outdoor trail feature. Boards run transverse to the rails (across the width) with a
 * small gap between them for drainage/expansion, same as any outdoor timber deck.
 *
 * deckingBoardWidthM/ThicknessM: a standard real decking board size (150x28mm).
 * deckingBoardGapM: 5mm — the low end of the commonly recommended 5-10mm board gap range
 * for outdoor timber decking drainage/expansion.
 * maxUnsupportedDeckSpanM: max gap between adjacent rails before a 28mm decking board spans
 * too far unsupported — 400mm, the published spacing for 28mm softwood decking boards.
 * Source: https://gripdeck.co.uk/joist-spacing/
 *
 * postEmbedmentDepthM: posts extend this far below grade, into the ground, so the structure
 * can't shift sideways — a fixed 600mm, not derived from a load calculation, but a plenty-deep
 * stake depth for a trail feature this size (a roller, not a building).
 */
export const TIMBER_STOCK = {
  postSizeM: { width: 0.07, depth: 0.045 }, // 70x45mm — posts holding the rails up
  railSizeM: { width: 0.09, depth: 0.045 }, // 90x45mm — curved rails, see rollerTimberFrame.ts
  deckingBoardWidthM: 0.15,
  deckingBoardThicknessM: 0.028,
  deckingBoardGapM: 0.005,
  maxUnsupportedDeckSpanM: 0.4,
  boardWasteFactor: 1.1, // trade allowance for offcuts/trimming boards to fit
  postEmbedmentDepthM: 0.6,
};
