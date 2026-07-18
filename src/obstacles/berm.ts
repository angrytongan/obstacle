import * as THREE from "three";
import { centerFootprint } from "./util";

export interface BermParams {
  radius: number;
  sweepAngleDeg: number;
  bankAngleDeg: number;
  width: number;
}

export const BERM_DEFAULTS: BermParams = {
  radius: 4,
  sweepAngleDeg: 90,
  bankAngleDeg: 25,
  width: 1.5,
};

const SEGMENTS = 32;

/**
 * Banked turn: a flat tilted cross-section (inner edge at ground, outer edge
 * raised by width * tan(bankAngle)) swept along a circular arc. Centered on
 * X/Z, base at Y=0. Only banks toward one side — no direction flag.
 */
export function buildBermGeometry(params: BermParams): THREE.BufferGeometry {
  const { radius, sweepAngleDeg, bankAngleDeg, width } = params;
  const sweep = THREE.MathUtils.degToRad(sweepAngleDeg);
  const bank = THREE.MathUtils.degToRad(bankAngleDeg);
  const outerHeight = width * Math.tan(bank);

  const positions: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const theta = -sweep / 2 + (i / SEGMENTS) * sweep;
    for (const j of [0, 1]) {
      const r = radius + (j - 0.5) * width;
      positions.push(r * Math.sin(theta), j * outerHeight, r * Math.cos(theta));
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, b, d, a, d, c);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return centerFootprint(geometry);
}
