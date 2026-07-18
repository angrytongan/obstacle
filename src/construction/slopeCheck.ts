import * as THREE from "three";
import type { RollerParams } from "../obstacles/roller";
import { DEFAULT_SOIL_PROFILE } from "./soil";

export interface SlopeCheckResult {
  maxAngleDeg: number;
  safeAngleDeg: number;
  safe: boolean;
}

/**
 * Steepest tangent angle of the roller's sine profile
 * y = (height/2)(1 - cos(2*pi*periods*x/length)), i.e. max|dy/dx| = height *
 * pi * periods / length (reached where the sine term peaks at 1).
 */
export function checkRollerSlope(
  params: RollerParams,
  soil = DEFAULT_SOIL_PROFILE,
): SlopeCheckResult {
  const maxSlope = (params.height * Math.PI * params.periods) / params.length;
  const maxAngleDeg = THREE.MathUtils.radToDeg(Math.atan(maxSlope));
  return {
    maxAngleDeg,
    safeAngleDeg: soil.safeSlopeAngleDeg,
    safe: maxAngleDeg <= soil.safeSlopeAngleDeg,
  };
}
