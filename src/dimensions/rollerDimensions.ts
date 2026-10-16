import * as THREE from "three";
import type { RollerParams } from "../obstacles/roller";
import { rollerWidthAt } from "../obstacles/roller";
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
 * centered-footprint local space as buildRollerGeometry. Width tapers along
 * the length (widthStart at x=0, widthEnd at x=length), so it gets two
 * dimension lines, one per end, instead of one. Height is anchored at the
 * first crest (x = length/(2*periods)) rather than an edge, since the
 * roller's edges are always at y=0 — the height param is only actually
 * reached there. Each dimension sits on a different side of the footprint
 * (length: -Z, width-start: -X, width-end: +X, height: +Z) so none overlap.
 */
export function buildRollerDimensions(params: RollerParams): RollerDimension[] {
  const { length, height, widthStart, widthEnd, periods } = params;
  const halfLength = length / 2;
  const halfWidthStart = widthStart / 2;
  const halfWidthEnd = widthEnd / 2;
  const crestX = length / (2 * periods) - halfLength;
  const crestHalfWidth = rollerWidthAt(length / (2 * periods), params) / 2;

  const lengthDim = buildLinearDimension(
    new THREE.Vector3(-halfLength, 0, -halfWidthStart),
    new THREE.Vector3(halfLength, 0, -halfWidthEnd),
    new THREE.Vector3(0, 0, -1),
    OFFSET_DISTANCE,
  );
  const widthStartDim = buildLinearDimension(
    new THREE.Vector3(-halfLength, 0, -halfWidthStart),
    new THREE.Vector3(-halfLength, 0, halfWidthStart),
    new THREE.Vector3(-1, 0, 0),
    OFFSET_DISTANCE,
  );
  const widthEndDim = buildLinearDimension(
    new THREE.Vector3(halfLength, 0, -halfWidthEnd),
    new THREE.Vector3(halfLength, 0, halfWidthEnd),
    new THREE.Vector3(1, 0, 0),
    OFFSET_DISTANCE,
  );
  const heightDim = buildLinearDimension(
    new THREE.Vector3(crestX, 0, crestHalfWidth),
    new THREE.Vector3(crestX, height, crestHalfWidth),
    new THREE.Vector3(0, 0, 1),
    OFFSET_DISTANCE,
  );

  return [
    { ...lengthDim, text: formatMeters(length) },
    { ...widthStartDim, text: formatMeters(widthStart) },
    { ...widthEndDim, text: formatMeters(widthEnd) },
    { ...heightDim, text: formatMeters(height) },
  ];
}
