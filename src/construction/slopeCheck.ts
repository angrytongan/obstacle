import * as THREE from "three";
import type { RollerParams } from "../obstacles/roller";
import { DEFAULT_SOIL_PROFILE } from "./soil";

export interface SlopeCheckResult {
  maxAngleDeg: number;
  safeAngleDeg: number;
  safe: boolean;
}

/**
 * Steepest tangent angle, in degrees, of the roller's sine profile
 * y = (height/2)(1 - cos(2*pi*periods*x/length)), i.e. max|dy/dx| = height *
 * pi * periods / length (reached where the sine term peaks at 1). Shared by
 * both the soil-stability check below and {@link checkRollerRideability} —
 * it's the same geometric quantity, just compared against two different
 * thresholds for two different reasons.
 */
function maxSlopeAngleDeg(params: RollerParams): number {
  const maxSlope = (params.height * Math.PI * params.periods) / params.length;
  return THREE.MathUtils.radToDeg(Math.atan(maxSlope));
}

/**
 * Whether the roller's steepest tangent exceeds a stand-in "angle of repose"
 * for a compacted, unretained earthen mound — i.e. whether the *dirt* would
 * stay put, not whether a bike can ride it (see {@link checkRollerRideability}
 * for that).
 */
export function checkRollerSlope(
  params: RollerParams,
  soil = DEFAULT_SOIL_PROFILE,
): SlopeCheckResult {
  const maxAngleDeg = maxSlopeAngleDeg(params);
  return {
    maxAngleDeg,
    safeAngleDeg: soil.safeSlopeAngleDeg,
    safe: maxAngleDeg <= soil.safeSlopeAngleDeg,
  };
}

export interface RideabilityCheckResult {
  maxAngleDeg: number;
  maxRideableAngleDeg: number;
  ridable: boolean;
}

/**
 * Max takeoff angle a roller stays comfortably rollable at, rather than
 * reading as a launch ramp — research/rollers.md's length:height ratio table
 * (Lee McCormack) cites ~38° at a 10:2.5 ratio as the steepest real example on
 * record, so anything steeper than that counts as unridable here.
 */
export const MAX_RIDEABLE_ANGLE_DEG = 38;

/**
 * Whether a bike can comfortably ride the roller's steepest tangent, independent
 * of construction method (earthen and timber builds share the same underlying
 * sine profile) — distinct from {@link checkRollerSlope}'s soil-stability check,
 * which only applies to the earthen method's loose fill.
 */
export function checkRollerRideability(params: RollerParams): RideabilityCheckResult {
  const maxAngleDeg = maxSlopeAngleDeg(params);
  return {
    maxAngleDeg,
    maxRideableAngleDeg: MAX_RIDEABLE_ANGLE_DEG,
    ridable: maxAngleDeg <= MAX_RIDEABLE_ANGLE_DEG,
  };
}
