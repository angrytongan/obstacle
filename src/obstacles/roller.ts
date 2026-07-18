import * as THREE from "three";
import { centerFootprint } from "./util";

export interface RollerParams {
  length: number;
  height: number;
  width: number;
  periods: number;
}

export const ROLLER_DEFAULTS: RollerParams = {
  length: 3,
  height: 0.4,
  width: 1,
  periods: 1,
};

const SEGMENTS_PER_PERIOD = 24;

/** Sine-wave hump profile points from (0,0) to (length,0), used by both the 3D geometry and the earthen BOM's cross-sectional area so the two never drift apart. */
export function rollerProfilePoints(params: RollerParams): [number, number][] {
  const { length, height, periods } = params;
  const segments = SEGMENTS_PER_PERIOD * periods;
  const points: [number, number][] = [[0, 0]];
  for (let i = 1; i <= segments; i++) {
    const x = (i / segments) * length;
    const y = (height / 2) * (1 - Math.cos((2 * Math.PI * periods * x) / length));
    points.push([x, y]);
  }
  points.push([length, 0]);
  return points;
}

/** Sine-wave hump profile, centered on X and Z, base sitting at Y=0. */
export function buildRollerGeometry(params: RollerParams): THREE.BufferGeometry {
  const points = rollerProfilePoints(params);
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) {
    shape.lineTo(x, y);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: params.width, bevelEnabled: false });
  return centerFootprint(geometry);
}
