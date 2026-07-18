/**
 * Single conservative default soil profile — no soil-type picker yet.
 *
 * safeSlopeAngleDeg: OSHA's Type C soil maximum stable unretained slope
 * (1.5:1, i.e. 34°) — the most conservative of OSHA's three excavation soil
 * classes, per 29 CFR 1926 Subpart P, Appendix B. Used here as a stand-in
 * "angle of repose" ceiling for a compacted, unretained earthen mound.
 *
 * compactionWasteFactor: loose fill typically needs to be ~15-25% more than
 * the final compacted volume to account for compaction settling; 1.2 (20%)
 * is a mid-range published figure for general soil/fill material.
 */
export const DEFAULT_SOIL_PROFILE = {
  safeSlopeAngleDeg: 34,
  compactionWasteFactor: 1.2,
};
