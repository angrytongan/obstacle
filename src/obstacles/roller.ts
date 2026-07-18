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

/** Sine-wave hump profile, centered on X and Z, base sitting at Y=0. */
export function buildRollerGeometry(params: RollerParams): THREE.BufferGeometry {
  const { length, height, width, periods } = params;
  const segments = SEGMENTS_PER_PERIOD * periods;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 1; i <= segments; i++) {
    const x = (i / segments) * length;
    const y = (height / 2) * (1 - Math.cos((2 * Math.PI * periods * x) / length));
    shape.lineTo(x, y);
  }
  shape.lineTo(length, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  return centerFootprint(geometry);
}
