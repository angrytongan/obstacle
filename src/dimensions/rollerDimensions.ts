import * as THREE from "three";
import type { RollerParams } from "../obstacles/roller";
import { buildLinearDimension, type LinearDimension } from "./dimensionLine";

const OFFSET_DISTANCE = 0.4;

export interface RollerDimension extends LinearDimension {
  text: string;
}

function formatMeters(value: number): string {
  return `${value.toFixed(1)} m`;
}

/**
 * Length/width/height dimension lines for a roller, in the same
 * centered-footprint local space as buildRollerGeometry. Height is anchored
 * at the first crest (x = length/(2*periods)) rather than an edge, since
 * the roller's edges are always at y=0 — the height param is only actually
 * reached there. Each dimension sits on a different side of the footprint
 * (length: -Z, width: +X, height: +Z) so none of them overlap.
 */
export function buildRollerDimensions(params: RollerParams): RollerDimension[] {
  const { length, height, width, periods } = params;
  const halfLength = length / 2;
  const halfWidth = width / 2;
  const crestX = length / (2 * periods) - halfLength;

  const lengthDim = buildLinearDimension(
    new THREE.Vector3(-halfLength, 0, -halfWidth),
    new THREE.Vector3(halfLength, 0, -halfWidth),
    new THREE.Vector3(0, 0, -1),
    OFFSET_DISTANCE,
  );
  const widthDim = buildLinearDimension(
    new THREE.Vector3(halfLength, 0, -halfWidth),
    new THREE.Vector3(halfLength, 0, halfWidth),
    new THREE.Vector3(1, 0, 0),
    OFFSET_DISTANCE,
  );
  const heightDim = buildLinearDimension(
    new THREE.Vector3(crestX, 0, halfWidth),
    new THREE.Vector3(crestX, height, halfWidth),
    new THREE.Vector3(0, 0, 1),
    OFFSET_DISTANCE,
  );

  return [
    { ...lengthDim, text: formatMeters(length) },
    { ...widthDim, text: formatMeters(width) },
    { ...heightDim, text: formatMeters(height) },
  ];
}
