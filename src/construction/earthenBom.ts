import type { RollerParams } from "../obstacles/roller";
import { rollerProfilePoints } from "../obstacles/roller";
import { DEFAULT_SOIL_PROFILE } from "./soil";

export interface EarthenBom {
  compactedFillVolumeM3: number;
  looseFillVolumeM3: number;
  geotextileFabricAreaM2: number;
}

/** Shoelace formula on the roller's own profile polygon (closed, base at y=0). */
function polygonArea(points: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export function calculateRollerEarthenBom(
  params: RollerParams,
  soil = DEFAULT_SOIL_PROFILE,
): EarthenBom {
  const crossSectionAreaM2 = polygonArea(rollerProfilePoints(params));
  const compactedFillVolumeM3 = crossSectionAreaM2 * params.width;
  return {
    compactedFillVolumeM3,
    looseFillVolumeM3: compactedFillVolumeM3 * soil.compactionWasteFactor,
    geotextileFabricAreaM2: params.length * params.width,
  };
}
