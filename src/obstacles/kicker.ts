import * as THREE from "three";
import { centerFootprint } from "./util";

export interface KickerParams {
  height: number;
  lipAngleDeg: number;
  width: number;
}

export const KICKER_DEFAULTS: KickerParams = {
  height: 0.6,
  lipAngleDeg: 35,
  width: 1.2,
};

const SEGMENTS = 24;

/**
 * Takeoff ramp only (no gap/landing) — a circular arc tangent to the ground
 * at the base and to lipAngle at the top, radius derived from height so the
 * two stay geometrically consistent instead of being independent knobs.
 * Directional (flat base, rising to the lip): centered on X/Z, base at Y=0.
 */
export function buildKickerGeometry(params: KickerParams): THREE.BufferGeometry {
  const { height, lipAngleDeg, width } = params;
  const lipAngle = THREE.MathUtils.degToRad(lipAngleDeg);
  const radius = height / (1 - Math.cos(lipAngle));
  const length = radius * Math.sin(lipAngle);

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (let i = 1; i <= SEGMENTS; i++) {
    const t = (i / SEGMENTS) * lipAngle;
    shape.lineTo(radius * Math.sin(t), radius * (1 - Math.cos(t)));
  }
  shape.lineTo(length, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  return centerFootprint(geometry);
}
