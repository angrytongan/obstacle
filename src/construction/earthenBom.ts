import type { RollerParams } from "../obstacles/roller";
import { rollerProfilePoints, rollerWidthAt } from "../obstacles/roller";
import { DEFAULT_SOIL_PROFILE } from "./soil";

export interface EarthenBom {
  compactedFillVolumeM3: number;
  looseFillVolumeM3: number;
  geotextileFabricAreaM2: number;
}

/** Trapezoidal integration of cross-sectional area y(x)*width(x) along the roller's
 * own profile samples — mirrors buildRollerGeometry's tapered strips so the two
 * (BOM volume and 3D mesh) can't drift apart. */
function fillVolume(params: RollerParams): number {
  const points = rollerProfilePoints(params);
  let volume = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const area1 = y1 * rollerWidthAt(x1, params);
    const area2 = y2 * rollerWidthAt(x2, params);
    volume += ((area1 + area2) / 2) * (x2 - x1);
  }
  return volume;
}

export function calculateRollerEarthenBom(
  params: RollerParams,
  soil = DEFAULT_SOIL_PROFILE,
): EarthenBom {
  const compactedFillVolumeM3 = fillVolume(params);
  return {
    compactedFillVolumeM3,
    looseFillVolumeM3: compactedFillVolumeM3 * soil.compactionWasteFactor,
    geotextileFabricAreaM2: params.length * ((params.widthStart + params.widthEnd) / 2),
  };
}
