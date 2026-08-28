import * as THREE from "three";
import { centerFootprint } from "./util";

export interface RollerParams {
  length: number;
  height: number;
  widthStart: number;
  widthEnd: number;
  periods: number;
}

export const ROLLER_DEFAULTS: RollerParams = {
  length: 3,
  height: 0.3,
  widthStart: 1,
  widthEnd: 1,
  periods: 1,
};

const SEGMENTS_PER_PERIOD = 24;

/** Sine-wave hump height at an arbitrary length position — shared by the profile sampler
 * below and by anything else (e.g. timber rib placement) that needs the height at a
 * specific x rather than the fixed render-resolution samples. */
export function rollerHeightAt(x: number, params: RollerParams): number {
  const { length, height, periods } = params;
  return (height / 2) * (1 - Math.cos((2 * Math.PI * periods * x) / length));
}

/** Slope (dy/dx) of the height profile at an arbitrary length position — the derivative of
 * {@link rollerHeightAt}, same formula slopeCheck.ts's steepest-tangent check is derived
 * from, generalized here to an arbitrary x instead of just the steepest point. Used to tilt
 * timber decking boards to the local tangent (see rollerTimberFrame.ts). */
export function rollerSlopeAt(x: number, params: RollerParams): number {
  const { length, height, periods } = params;
  return ((height * Math.PI * periods) / length) * Math.sin((2 * Math.PI * periods * x) / length);
}

/** Sine-wave hump profile points from (0,0) to (length,0), used by both the 3D geometry and the earthen BOM's cross-sectional area so the two never drift apart. */
export function rollerProfilePoints(params: RollerParams): [number, number][] {
  const { length, periods } = params;
  const segments = SEGMENTS_PER_PERIOD * periods;
  const points: [number, number][] = [[0, 0]];
  for (let i = 1; i <= segments; i++) {
    const x = (i / segments) * length;
    points.push([x, rollerHeightAt(x, params)]);
  }
  points.push([length, 0]);
  return points;
}

/** Local width at a length position, linearly tapered between widthStart (x=0) and widthEnd
 * (x=length) — shared with the earthen BOM's fill-volume integration so the two never drift apart. */
export function rollerWidthAt(x: number, params: RollerParams): number {
  const { length, widthStart, widthEnd } = params;
  return widthStart + (widthEnd - widthStart) * (x / length);
}

type Rail = (x: number, y: number, halfWidth: number) => [number, number, number];

/** One ruled-surface quad strip between two rails, one quad per profile segment. */
function addQuadStrip(
  positions: number[],
  indices: number[],
  points: [number, number][],
  params: RollerParams,
  railA: Rail,
  railB: Rail,
): void {
  const base = positions.length / 3;
  for (const [x, y] of points) {
    const halfWidth = rollerWidthAt(x, params) / 2;
    positions.push(...railA(x, y, halfWidth), ...railB(x, y, halfWidth));
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = base + i * 2;
    const b = a + 1;
    const c = base + (i + 1) * 2;
    const d = c + 1;
    indices.push(a, b, d, a, d, c);
  }
}

/**
 * Tapered sine-wave hump, centered on X and Z, base sitting at Y=0. Hand-built
 * (not THREE.ExtrudeGeometry, which can't vary its extrusion depth) as four ruled
 * quad strips — top surface, bottom, left wall, right wall — each running the
 * length of the profile. Winding isn't normalized between strips, same as
 * berm.ts's hand-built mesh (see main.ts's DoubleSide material).
 */
export function buildRollerGeometry(params: RollerParams): THREE.BufferGeometry {
  const points = rollerProfilePoints(params);
  const positions: number[] = [];
  const indices: number[] = [];

  const top: Rail = (x, y, hw) => [x, y, -hw];
  const topRight: Rail = (x, y, hw) => [x, y, hw];
  const bottomLeft: Rail = (x, _y, hw) => [x, 0, -hw];
  const bottomRight: Rail = (x, _y, hw) => [x, 0, hw];

  addQuadStrip(positions, indices, points, params, top, topRight); // top surface
  addQuadStrip(positions, indices, points, params, bottomLeft, bottomRight); // bottom
  addQuadStrip(positions, indices, points, params, top, bottomLeft); // left wall
  addQuadStrip(positions, indices, points, params, topRight, bottomRight); // right wall

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return centerFootprint(geometry);
}
