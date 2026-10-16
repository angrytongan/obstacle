import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildRollerGeometry, ROLLER_DEFAULTS, type RollerParams } from "./obstacles/roller";
import { buildBermGeometry, BERM_DEFAULTS, type BermParams } from "./obstacles/berm";
import { buildKickerGeometry, KICKER_DEFAULTS, type KickerParams } from "./obstacles/kicker";
import { checkRollerRideability, checkRollerSlope } from "./construction/slopeCheck";
import { calculateRollerEarthenBom } from "./construction/earthenBom";
import {
  buildRailGeometry,
  buildRailOutlineGeometry,
  buildRollerTimberFrame,
  type TimberMember,
} from "./construction/rollerTimberFrame";
import { calculateRollerTimberBom } from "./construction/rollerTimberBom";
import { TIMBER_STOCK } from "./construction/timberStock";
import { buildRollerDimensions } from "./dimensions/rollerDimensions";
import { renderPartDrawing } from "./drawings/renderPartDrawing";
import { allRollerTimberPartDrawings } from "./drawings/rollerTimberPartDrawings";
import { createHistory, pushHistory, redoHistory, undoHistory, type History } from "./history";

type ObstacleType = "roller" | "berm" | "kicker";
type ConstructionMethod = "earthen" | "timber" | "hybrid" | "metal";

const CONSTRUCTION_METHOD_LABELS: Record<ConstructionMethod, string> = {
  earthen: "Earthen",
  timber: "Timber-framed",
  hybrid: "Hybrid (timber core, dirt cap)",
  metal: "Metal-framed",
};
const ALL_CONSTRUCTION_METHODS = Object.keys(CONSTRUCTION_METHOD_LABELS) as ConstructionMethod[];

// Which construction methods are actually implemented per obstacle type — everything else
// still shows in the dropdown, just disabled, so the eventual shape of the feature is visible.
const IMPLEMENTED_METHODS: Record<ObstacleType, ConstructionMethod[]> = {
  roller: ["earthen", "timber"],
  berm: [],
  kicker: [],
};

const BOM_DISCLAIMER =
  "Planning estimate only — not a substitute for a qualified builder's or engineer's assessment.";

const BOM_INFO = {
  geotextile:
    "Permeable fabric laid under the fill to stop it mixing into the subgrade and to aid drainage.",
  slopeConstraint:
    "Max safe unretained slope is OSHA's Type C soil limit (34°, i.e. 1.5:1) — 29 CFR 1926 Subpart P, Appendix B. A conservative stand-in for soil angle of repose, not a site-specific geotechnical assessment.",
  timberRails:
    "Curved 90x45mm rails following the roller's profile the full length, each built from 4-per-period quarter-sine-wave sections (a real curved/laminated beam can't easily bend through a full sine wave in one piece).",
  timberPosts:
    "70x45mm posts holding the rails up off the ground, embedded 600mm into it so the structure can't shift sideways — see the \"Posts\" section for how many.",
  timberCenterRail:
    "An optional third rail down the centreline, for extra support under wide decking spans — published spacing for 28mm softwood decking boards (the size used here) puts the safe unsupported span at ~400mm, so turn this on once the gap between the two edge rails exceeds that.",
  timberDecking:
    "150x28mm solid timber decking boards (not plywood — plywood isn't weather-resistant enough outdoors) laid transverse to the rails with a 5mm gap between each for drainage/expansion, screwed to the tops of the rails.",
  timberAdditionalPostsPerSection:
    "Every rail section boundary always gets a post — that's where two rail sections join, and a joint needs support regardless. This adds this many more, equally spaced, within each section.",
  timberRailOutline:
    "Draws a wireframe outline of each rail — its 4 long edges, plus a rectangle at every section's start and end — so individual rails and their fabricated sections are easy to pick out.",
};

function infoIcon(tooltip: string): string {
  return `<button type="button" class="info-icon" data-tooltip="${tooltip}" aria-label="More info">i</button>`;
}

// Which obstacle types have dimension lines built — roller only for now (see docs).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DIMENSION_BUILDERS: Partial<Record<ObstacleType, (params: any) => ReturnType<typeof buildRollerDimensions>>> = {
  roller: buildRollerDimensions,
};

interface SliderSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

interface ObstacleSpec<P> {
  defaults: P;
  sliders: SliderSpec[];
  build: (params: P) => THREE.BufferGeometry;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OBSTACLES: Record<ObstacleType, ObstacleSpec<any>> = {
  roller: {
    defaults: ROLLER_DEFAULTS,
    sliders: [
      { key: "length", label: "Length (m)", min: 1, max: 12, step: 0.1 },
      { key: "height", label: "Height (m)", min: 0.1, max: 1.5, step: 0.05 },
      { key: "widthStart", label: "Width at start (m)", min: 0.5, max: 3, step: 0.1 },
      { key: "widthEnd", label: "Width at end (m)", min: 0.5, max: 3, step: 0.1 },
      { key: "periods", label: "Periods", min: 1, max: 5, step: 1 },
    ],
    build: (p: RollerParams) => buildRollerGeometry(p),
  },
  berm: {
    defaults: BERM_DEFAULTS,
    sliders: [
      { key: "radius", label: "Radius (m)", min: 1.5, max: 10, step: 0.25 },
      { key: "sweepAngleDeg", label: "Sweep angle (°)", min: 15, max: 180, step: 5 },
      { key: "bankAngleDeg", label: "Bank angle (°)", min: 5, max: 45, step: 1 },
      { key: "width", label: "Width (m)", min: 0.5, max: 3, step: 0.1 },
    ],
    build: (p: BermParams) => buildBermGeometry(p),
  },
  kicker: {
    defaults: KICKER_DEFAULTS,
    sliders: [
      { key: "height", label: "Height (m)", min: 0.2, max: 1.5, step: 0.05 },
      { key: "lipAngleDeg", label: "Lip angle (°)", min: 10, max: 60, step: 1 },
      { key: "width", label: "Width (m)", min: 0.5, max: 3, step: 0.1 },
    ],
    build: (p: KickerParams) => buildKickerGeometry(p),
  },
};

const viewport = document.getElementById("viewport")!;
const typeSelect = document.getElementById("type-select") as HTMLSelectElement;
const methodSelect = document.getElementById("method-select") as HTMLSelectElement;
const slidersEl = document.getElementById("sliders")!;
const rideabilityWarningEl = document.getElementById("rideability-warning")!;
const methodOptionsEl = document.getElementById("method-options")!;
const resetBtn = document.getElementById("reset-btn")!;
const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
const drawingsListEl = document.getElementById("drawings-list")!;
const bomContainerEl = document.getElementById("bom-container")!;
const tooltipEl = document.getElementById("tooltip")!;

// A single shared tooltip, positioned from the hovered/focused icon's actual screen
// rect and appended outside #panel (see index.html) so #panel's overflow-y:auto can't
// clip it — delegated on document since .info-icon elements are recreated on every
// renderBom() call.
function showTooltip(icon: HTMLElement): void {
  const text = icon.dataset.tooltip;
  if (!text) return;
  tooltipEl.textContent = text;
  const rect = icon.getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
  tooltipEl.style.top = `${rect.top}px`;
  tooltipEl.classList.add("visible");
}
function hideTooltip(): void {
  tooltipEl.classList.remove("visible");
}
for (const [showEvent, hideEvent] of [
  ["mouseover", "mouseout"],
  ["focusin", "focusout"],
] as const) {
  document.addEventListener(showEvent, (e) => {
    const icon = (e.target as HTMLElement).closest<HTMLElement>(".info-icon");
    if (icon) showTooltip(icon);
  });
  document.addEventListener(hideEvent, (e) => {
    if ((e.target as HTMLElement).closest(".info-icon")) hideTooltip();
  });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe9f0);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 4, 6);

// preserveDrawingBuffer: the browser's print rasterizer runs async, not synced to the render
// loop — without this, printing the "3D view" tab can capture a just-cleared framebuffer and
// print a blank canvas instead of the last rendered frame.
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0);
controls.zoomToCursor = true; // built-in OrbitControls option — scroll-zoom centers on the pointer

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-6, 8, 4);
sun.castShadow = true;
scene.add(ambient, sun);

// polygonOffset pushes the ground's rasterized depth back slightly (no vertex movement) so
// coplanar geometry at true y=0 — the dimension lines below — renders cleanly on top instead of
// z-fighting, without needing to lift those lines off their real position to fake the fix.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({
    color: 0x6b8f5a,
    flatShading: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const material = new THREE.MeshStandardMaterial({
  color: 0xc94f4f,
  flatShading: true,
  side: THREE.DoubleSide, // ponytail: sidesteps verifying triangle winding on the hand-built berm mesh
});
const obstacleMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
obstacleMesh.castShadow = true;
scene.add(obstacleMesh);

// Timber-framed construction: an open post/rail/deck structure (see rollerTimberFrame.ts)
// shown instead of the solid mound mesh above — posts reuse one shared unit-cube geometry,
// scaled/positioned per post, since the member count involved doesn't need instancing.
// One material per component (not a single shared one) so each can be wireframe-toggled
// independently — see the "Wireframe" checkboxes in renderMethodControls.
function makeTimberMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xc9a066,
    flatShading: true,
    side: THREE.DoubleSide, // decking is a single-sided ruled strip, visible from underneath too
  });
}
const postsMaterial = makeTimberMaterial();
const railsMaterial = makeTimberMaterial();
// polygonOffset pushes the rail's own rasterized depth back slightly (no vertex movement,
// same technique the ground plane uses) so the rail-outline overlay below — which sits
// exactly coincident with this mesh's own surface — renders cleanly on top instead of
// z-fighting with it.
railsMaterial.polygonOffset = true;
railsMaterial.polygonOffsetFactor = 1;
railsMaterial.polygonOffsetUnits = 1;
const deckingMaterial = makeTimberMaterial();
const unitBoxGeometry = new THREE.BoxGeometry(1, 1, 1);
const structureGroup = new THREE.Group();
scene.add(structureGroup);

// One persistent group per component so its "Show" checkbox can just flip `.visible` — same
// as wireframe toggling a material property, no rebuildStructure() needed on toggle.
const postsGroup = new THREE.Group();
const railsGroup = new THREE.Group();
const deckingGroup = new THREE.Group();
structureGroup.add(postsGroup, railsGroup, deckingGroup);

// A wireframe outline of each rail's own full surface (buildRailOutlineGeometry — the 4 long
// corner edges plus a cap rectangle at every section boundary, see rebuildStructure) — a
// separate group/material from railsGroup/railsMaterial since it's an on-demand inspection
// overlay, not a structural member, and toggled by its own "Outline" checkbox rather than the
// "Show" checkboxes. Off by default, same reasoning as the wireframe checkboxes.
const railOutlineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
const railOutlinesGroup = new THREE.Group();
railOutlinesGroup.visible = false;
structureGroup.add(railOutlinesGroup);

const dimensionsGroup = new THREE.Group();
scene.add(dimensionsGroup);

// Per-component toggles for the timber structure — reads/writes the persistent material/
// group objects directly (see makeTimberMaterial and postsGroup/railsGroup/deckingGroup
// above), so no separate state or a rebuildStructure() call is needed on toggle, just a
// property flip (material.wireframe, or group.visible for "Show"). Declared here (rather than
// nearer renderCheckboxRowGroup, its only other reader) since AppState below needs it too.
const COMPONENT_TOGGLES: { id: string; label: string; material: THREE.MeshStandardMaterial; group: THREE.Group }[] = [
  { id: "rails", label: "Rails", material: railsMaterial, group: railsGroup },
  { id: "posts", label: "Posts", material: postsMaterial, group: postsGroup },
  { id: "decking", label: "Decking", material: deckingMaterial, group: deckingGroup },
];

/** Everything undo/redo/localStorage cares about — the caller owns applying one back (see
 * applyState) and reading one off the live app (see snapshot). `wireframe`/`show` are keyed by
 * COMPONENT_TOGGLES id since those two toggle groups live directly on Three.js
 * materials/groups, not their own `let`s. */
interface AppState {
  type: ObstacleType;
  method: ConstructionMethod;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any;
  centerRail: boolean;
  additionalPostsPerSection: number;
  railOutline: boolean;
  wireframe: Record<string, boolean>;
  show: Record<string, boolean>;
}

const STORAGE_KEY = "obstacle-app-state";

function defaultToggles(value: boolean): Record<string, boolean> {
  return Object.fromEntries(COMPONENT_TOGGLES.map((t) => [t.id, value]));
}

const DEFAULT_APP_STATE: AppState = {
  type: "roller",
  method: "earthen",
  params: { ...OBSTACLES.roller.defaults },
  centerRail: false,
  additionalPostsPerSection: 0, // none extra by default, just the always-present boundary posts
  railOutline: false,
  wireframe: defaultToggles(false),
  show: defaultToggles(true),
};

/** Reads persisted app state back, merged field-by-field over today's defaults rather than
 * trusted outright — a future field addition/removal, or corrupted/foreign JSON (try/catch),
 * then just falls back to that field's default instead of crashing or leaving it undefined.
 * Returns DEFAULT_APP_STATE outright if nothing's saved yet. */
function loadInitialState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_APP_STATE;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any = JSON.parse(raw);
    const type: ObstacleType = parsed.type in OBSTACLES ? parsed.type : DEFAULT_APP_STATE.type;
    return {
      type,
      method: parsed.method ?? DEFAULT_APP_STATE.method,
      params: { ...OBSTACLES[type].defaults, ...parsed.params },
      centerRail: parsed.centerRail ?? DEFAULT_APP_STATE.centerRail,
      additionalPostsPerSection: parsed.additionalPostsPerSection ?? DEFAULT_APP_STATE.additionalPostsPerSection,
      railOutline: parsed.railOutline ?? DEFAULT_APP_STATE.railOutline,
      wireframe: { ...DEFAULT_APP_STATE.wireframe, ...parsed.wireframe },
      show: { ...DEFAULT_APP_STATE.show, ...parsed.show },
    };
  } catch {
    return DEFAULT_APP_STATE;
  }
}

let historyState: History<AppState> = createHistory(loadInitialState());

// Live/draft view of the current control values — mutated directly during a slider drag for
// instant preview, then folded into historyState as one step by commit() on drag release.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentParams: any = { ...historyState.present.params };
let currentMethod: ConstructionMethod = historyState.present.method;
let currentCenterRail = historyState.present.centerRail;
let currentAdditionalPostsPerSection = historyState.present.additionalPostsPerSection;

function rebuildObstacle(type: ObstacleType): void {
  const geometry = OBSTACLES[type].build(currentParams);
  obstacleMesh.geometry.dispose();
  obstacleMesh.geometry = geometry;
}

// Explicit disposer over exactly what the last rebuild created (same pattern as
// disposeDimensions below).
let disposeStructure: (() => void) | null = null;

/** Toggles between the solid mound mesh (earthen, and every not-yet-timber-built method)
 * and the open post/rail/deck structure (timber) — see rollerTimberFrame.ts for the layout. */
function rebuildStructure(type: ObstacleType, method: ConstructionMethod): void {
  disposeStructure?.();
  disposeStructure = null;
  obstacleMesh.visible = true;
  if (type !== "roller" || method !== "timber") return;

  obstacleMesh.visible = false;
  const params = currentParams as RollerParams;
  const frame = buildRollerTimberFrame(params, currentCenterRail, currentAdditionalPostsPerSection);

  const addBoxMeshes = (members: TimberMember[], material: THREE.Material, group: THREE.Group): THREE.Mesh[] =>
    members.map((member) => {
      const mesh = new THREE.Mesh(unitBoxGeometry, material);
      mesh.scale.set(...member.size);
      mesh.position.set(...member.position);
      mesh.rotation.z = member.rotationZ ?? 0;
      mesh.castShadow = true;
      group.add(mesh);
      return mesh;
    });

  const postMeshes = addBoxMeshes(frame.posts, postsMaterial, postsGroup);
  const deckingMeshes = addBoxMeshes(frame.deckingBoards, deckingMaterial, deckingGroup);

  const railGeometries = frame.railZOffsets.map((z) => buildRailGeometry(params, z));
  const railMeshes = railGeometries.map((geometry) => {
    const mesh = new THREE.Mesh(geometry, railsMaterial);
    mesh.castShadow = true;
    railsGroup.add(mesh);
    return mesh;
  });

  const railOutlineGeometries = frame.railZOffsets.map((z) => buildRailOutlineGeometry(params, z));
  const railOutlineMeshes = railOutlineGeometries.map((geometry) => {
    const lines = new THREE.LineSegments(geometry, railOutlineMaterial);
    railOutlinesGroup.add(lines);
    return lines;
  });

  disposeStructure = () => {
    for (const mesh of postMeshes) postsGroup.remove(mesh);
    for (const mesh of deckingMeshes) deckingGroup.remove(mesh);
    for (const mesh of railMeshes) railsGroup.remove(mesh);
    for (const geometry of railGeometries) geometry.dispose();
    for (const lines of railOutlineMeshes) railOutlinesGroup.remove(lines);
    for (const geometry of railOutlineGeometries) geometry.dispose();
  };
}

const LABEL_FONT_PX = 48;
// Target on-screen text height in pixels — with sizeAttenuation:false (see createLabelSprite)
// the sprite's screen size no longer depends on camera distance, so this is a real pixel size,
// not a world size. Ported from ../half-pipe (and ../kicker) — labels growing/shrinking as the
// camera dollied in/out read as a bug once those apps fixed it.
const LABEL_PIXEL_HEIGHT = 28;

/** A camera-facing text billboard drawn on a canvas texture — always in-scene, redrawn every frame with the rest of the WebGL canvas, so there's no separate DOM overlay that can get out of sync. */
function createLabelSprite(text: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${LABEL_FONT_PX}px sans-serif`;
  const paddingX = 16;
  canvas.width = ctx.measureText(text).width + paddingX * 2;
  canvas.height = LABEL_FONT_PX * 1.4;

  ctx.font = `${LABEL_FONT_PX}px sans-serif`; // reset after resize, which clears context state
  ctx.fillStyle = "#ffffffcc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#222222";
  ctx.textBaseline = "middle";
  ctx.fillText(text, paddingX, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  // sizeAttenuation:false keeps the sprite's on-screen size constant regardless of camera
  // distance (three.js's own vertex shader cancels distance out of the projected size when this
  // is off) — the label shouldn't grow as the camera dollies in.
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, sizeAttenuation: false }));
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const labelHeight = (LABEL_PIXEL_HEIGHT * 2 * Math.tan(vFov / 2)) / viewport.clientHeight;
  sprite.scale.set((labelHeight * canvas.width) / canvas.height, labelHeight, 1);
  return sprite;
}

// Explicit disposer over exactly what the last rebuild created.
let disposeDimensions: (() => void) | null = null;

function rebuildDimensions(type: ObstacleType): void {
  disposeDimensions?.();
  disposeDimensions = null;

  const build = DIMENSION_BUILDERS[type];
  if (!build) return;

  const groups: THREE.Group[] = [];
  const sprites: THREE.Sprite[] = [];
  for (const dim of build(currentParams)) {
    dimensionsGroup.add(dim.group);
    groups.push(dim.group);

    const sprite = createLabelSprite(dim.text);
    sprite.position.copy(dim.labelPosition);
    dimensionsGroup.add(sprite);
    sprites.push(sprite);
  }

  disposeDimensions = () => {
    for (const group of groups) {
      // Only the plain Line geometries we build ourselves — not ArrowHelper's internal
      // line/cone, which Three.js shares as static geometry across every ArrowHelper
      // instance, so disposing it here would break arrows everywhere.
      for (const child of group.children) {
        if (child instanceof THREE.Line) child.geometry.dispose();
      }
      dimensionsGroup.remove(group);
    }
    for (const sprite of sprites) {
      sprite.material.map?.dispose();
      sprite.material.dispose();
      dimensionsGroup.remove(sprite);
    }
  };
}

function renderRollerEarthenStatusBadge(params: RollerParams): string {
  const slope = checkRollerSlope(params);
  return `
    <span class="bom-status ${slope.safe ? "safe" : "unsafe"}">
      ${slope.safe ? "Slope OK" : "Too steep"}: ${slope.maxAngleDeg.toFixed(1)}° (max safe ${slope.safeAngleDeg}°)
      ${infoIcon(BOM_INFO.slopeConstraint)}
    </span>
  `;
}

function renderRollerEarthenBomRows(params: RollerParams): string {
  const bom = calculateRollerEarthenBom(params);
  const fillTooltip = `Order this much loose fill — it settles to ${bom.compactedFillVolumeM3.toFixed(2)} m³ once compacted in place (includes a 20% waste factor).`;

  return `
    <tr><td><span class="bom-label">Fill material</span> ${infoIcon(fillTooltip)}</td><td class="bom-qty">${bom.looseFillVolumeM3.toFixed(2)} m³</td><td>—</td><td>Compacted fill</td></tr>
    <tr><td><span class="bom-label">Geotextile fabric</span> ${infoIcon(BOM_INFO.geotextile)}</td><td class="bom-qty">${bom.geotextileFabricAreaM2.toFixed(2)} m²</td><td>—</td><td>Non-woven geotextile fabric</td></tr>
  `;
}

function renderRollerTimberStatusBadge(params: RollerParams): string {
  const bom = calculateRollerTimberBom(params, currentCenterRail, currentAdditionalPostsPerSection);
  return `<span class="bom-status safe">${bom.railCount} rails, ${bom.railSectionCount} sections ${infoIcon(BOM_INFO.timberRails)}</span>`;
}

function renderRollerTimberBomRows(params: RollerParams): string {
  const bom = calculateRollerTimberBom(params, currentCenterRail, currentAdditionalPostsPerSection);
  const avgRailSectionMm = Math.round((bom.railLinearMetersM / bom.railSectionCount) * 1000);
  const embedmentMm = Math.round(TIMBER_STOCK.postEmbedmentDepthM * 1000);

  const postRows = bom.postGroups
    .map(
      ({ totalLengthM, count }) =>
        `<tr><td><span class="bom-label">Post</span> ${infoIcon(BOM_INFO.timberPosts)}</td><td class="bom-qty">${count}</td><td>${Math.round(totalLengthM * 1000)}mm (incl. ${embedmentMm}mm embedded), 70x45mm</td><td>Structural timber</td></tr>`,
    )
    .join("");

  const deckingRows = bom.deckingBoardGroups
    .map(
      ({ totalLengthM, count }) =>
        `<tr><td><span class="bom-label">Decking board</span> ${infoIcon(BOM_INFO.timberDecking)}</td><td class="bom-qty">${count}</td><td>150x28mm, ${Math.round(totalLengthM * 1000)}mm</td><td>Solid timber decking board</td></tr>`,
    )
    .join("");

  return `
    <tr><td><span class="bom-label">Rail section</span> ${infoIcon(BOM_INFO.timberRails)}</td><td class="bom-qty">${bom.railSectionCount}</td><td>~${avgRailSectionMm}mm curved, 90x45mm</td><td>Structural timber (curved/laminated)</td></tr>
    ${postRows}
    ${deckingRows}
  `;
}

function renderBom(type: ObstacleType, method: ConstructionMethod): void {
  if (type !== "roller" || (method !== "earthen" && method !== "timber")) {
    bomContainerEl.innerHTML = `<p class="bom-unavailable">No bill of materials yet for ${CONSTRUCTION_METHOD_LABELS[method].toLowerCase()} ${type}s.</p>`;
    return;
  }

  const params = currentParams as RollerParams;
  const statusBadge = method === "earthen" ? renderRollerEarthenStatusBadge(params) : renderRollerTimberStatusBadge(params);
  const rows = method === "earthen" ? renderRollerEarthenBomRows(params) : renderRollerTimberBomRows(params);
  bomContainerEl.innerHTML = `
    ${statusBadge}
    <table id="bom-table">
      <thead><tr><th>Part</th><th>Qty</th><th>Dimensions</th><th>Material</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="bom-disclaimer">${BOM_DISCLAIMER}</p>
  `;
  for (const icon of bomContainerEl.querySelectorAll<HTMLElement>(".info-icon")) {
    // Safari doesn't focus a button on click by default; force it so the delegated
    // focusin listener (which shows the tooltip) fires on click too, not just hover.
    icon.addEventListener("click", () => icon.focus());
  }
}

/** Rebuilds the "2D drawings" tab: one labeled, dimensioned SVG per distinct timber part type
 * (see drawings/rollerTimberPartDrawings.ts) — cheap enough to redo on every param change, tab
 * visible or not, same as renderBom. Earthen has nothing to draw (no framing to expose, same
 * reasoning rebuildStructure uses for the 3D view). */
function rebuildPartDrawings(type: ObstacleType, method: ConstructionMethod): void {
  if (type !== "roller" || method !== "timber") {
    const reason = type === "roller" && method === "earthen" ? "no framing to draw" : "not built yet";
    drawingsListEl.innerHTML = `<p class="bom-unavailable">No 2D drawings for ${CONSTRUCTION_METHOD_LABELS[method].toLowerCase()} ${type}s — ${reason}.</p>`;
    return;
  }

  drawingsListEl.innerHTML = "";
  const params = currentParams as RollerParams;
  for (const part of allRollerTimberPartDrawings(params, currentCenterRail, currentAdditionalPostsPerSection)) {
    const card = document.createElement("div");
    card.className = "drawing-card";
    const heading = document.createElement("h3");
    heading.textContent = part.title;
    card.append(heading, renderPartDrawing(part));
    drawingsListEl.append(card);
  }
}

function renderMethodOptions(type: ObstacleType): void {
  const implemented = IMPLEMENTED_METHODS[type];
  methodSelect.innerHTML = "";
  for (const method of ALL_CONSTRUCTION_METHODS) {
    const option = document.createElement("option");
    option.value = method;
    const isImplemented = implemented.includes(method);
    option.disabled = !isImplemented;
    option.textContent = isImplemented
      ? CONSTRUCTION_METHOD_LABELS[method]
      : `${CONSTRUCTION_METHOD_LABELS[method]} — not yet implemented`;
    methodSelect.append(option);
  }
  currentMethod = implemented[0] ?? ALL_CONSTRUCTION_METHODS[0];
  methodSelect.value = currentMethod;
}

function renderCheckboxRowGroup(heading: string, idPrefix: string, checked: (id: string) => boolean): string {
  return `
    <div class="method-option-row method-option-heading">${heading}</div>
    ${COMPONENT_TOGGLES.map(
      ({ id, label }) => `
        <label class="method-option-row wireframe-row">
          <input type="checkbox" id="${idPrefix}-${id}" ${checked(id) ? "checked" : ""} />
          ${label}
        </label>
      `,
    ).join("")}
  `;
}

const ADDITIONAL_POSTS_PER_SECTION_MIN = 0;
const ADDITIONAL_POSTS_PER_SECTION_MAX = 4;

/** Construction-method-specific option controls, distinct from the generic per-obstacle-type
 * sliders — currently the roller timber method's centre-rail toggle (see
 * rollerTimberFrame.ts's `centerRail` param), its rail "Outline" checkbox
 * (`buildRailOutlineGeometry` — an inspection aid, not a structural member, so it isn't part
 * of COMPONENT_TOGGLES below), its additional-posts-per-section slider (on top of the
 * always-present mandatory boundary posts), and its per-component wireframe/show toggles.
 * Empty for every other type/method. */
function renderMethodControls(type: ObstacleType, method: ConstructionMethod): void {
  methodOptionsEl.innerHTML = "";
  if (type !== "roller" || method !== "timber") return;

  methodOptionsEl.innerHTML = `
    <label class="method-option-row">
      <input type="checkbox" id="center-rail-toggle" ${currentCenterRail ? "checked" : ""} />
      Centre rail ${infoIcon(BOM_INFO.timberCenterRail)}
    </label>
    <div class="method-option-row method-option-heading">Rails</div>
    <label class="method-option-row">
      <input type="checkbox" id="rail-outline-toggle" ${railOutlinesGroup.visible ? "checked" : ""} />
      Outline ${infoIcon(BOM_INFO.timberRailOutline)}
    </label>
    <div class="method-option-row method-option-heading">Posts</div>
    <div class="slider-row">
      <label>
        <span>Additional posts per section ${infoIcon(BOM_INFO.timberAdditionalPostsPerSection)}</span>
        <span id="additional-posts-per-section-value">${currentAdditionalPostsPerSection}</span>
      </label>
      <input type="range" id="additional-posts-per-section" min="${ADDITIONAL_POSTS_PER_SECTION_MIN}" max="${ADDITIONAL_POSTS_PER_SECTION_MAX}" step="1" value="${currentAdditionalPostsPerSection}" />
    </div>
    ${renderCheckboxRowGroup("Wireframe", "wireframe", (id) => COMPONENT_TOGGLES.find((t) => t.id === id)!.material.wireframe)}
    ${renderCheckboxRowGroup("Show", "show", (id) => COMPONENT_TOGGLES.find((t) => t.id === id)!.group.visible)}
  `;
  const centerRailCheckbox = methodOptionsEl.querySelector<HTMLInputElement>("#center-rail-toggle")!;
  centerRailCheckbox.addEventListener("change", () => {
    currentCenterRail = centerRailCheckbox.checked;
    rebuildStructure(type, method);
    renderBom(type, method);
    rebuildPartDrawings(type, method);
    commit();
  });

  const railOutlineCheckbox = methodOptionsEl.querySelector<HTMLInputElement>("#rail-outline-toggle")!;
  railOutlineCheckbox.addEventListener("change", () => {
    railOutlinesGroup.visible = railOutlineCheckbox.checked;
    commit();
  });

  const additionalPostsPerSectionInput = methodOptionsEl.querySelector<HTMLInputElement>("#additional-posts-per-section")!;
  const additionalPostsPerSectionValue = methodOptionsEl.querySelector<HTMLElement>("#additional-posts-per-section-value")!;
  additionalPostsPerSectionInput.addEventListener("input", () => {
    currentAdditionalPostsPerSection = Number(additionalPostsPerSectionInput.value);
    additionalPostsPerSectionValue.textContent = additionalPostsPerSectionInput.value;
    rebuildStructure(type, method);
    renderBom(type, method);
    rebuildPartDrawings(type, method);
  });
  additionalPostsPerSectionInput.addEventListener("change", commit);

  for (const icon of methodOptionsEl.querySelectorAll<HTMLElement>(".info-icon")) {
    // Safari doesn't focus a button on click by default; force it so the delegated
    // focusin listener (which shows the tooltip) fires on click too, not just hover.
    icon.addEventListener("click", () => icon.focus());
  }

  for (const { id, material, group } of COMPONENT_TOGGLES) {
    const wireframeCheckbox = methodOptionsEl.querySelector<HTMLInputElement>(`#wireframe-${id}`)!;
    wireframeCheckbox.addEventListener("change", () => {
      material.wireframe = wireframeCheckbox.checked;
      commit();
    });
    const showCheckbox = methodOptionsEl.querySelector<HTMLInputElement>(`#show-${id}`)!;
    showCheckbox.addEventListener("change", () => {
      group.visible = showCheckbox.checked;
      commit();
    });
  }
}

/** Warns regardless of construction method — the roller's steepness comes from its own
 * length/height/periods sliders, not from how it's built. Hidden entirely when ridable or
 * not a roller, rather than always showing a "you're fine" badge, since this is a warning,
 * not a status readout (unlike the earthen tab's soil-stability badge). */
function renderRideabilityWarning(type: ObstacleType): void {
  if (type !== "roller") {
    rideabilityWarningEl.hidden = true;
    return;
  }
  const result = checkRollerRideability(currentParams as RollerParams);
  rideabilityWarningEl.hidden = result.ridable;
  if (!result.ridable) {
    rideabilityWarningEl.innerHTML = `Too steep to ride: ${result.maxAngleDeg.toFixed(1)}° (max rideable ~${result.maxRideableAngleDeg}°) ${infoIcon("Steepest tangent of the roller's own profile exceeds the steepest real-world roller example on record (research/rollers.md, ~38° at a 10:2.5 length:height ratio) — reduce height, increase length, or lower periods.")}`;
    // Safari doesn't focus a button on click by default; force it so the delegated
    // document-level tooltip handler (which reacts to focus) also opens on click.
    rideabilityWarningEl.querySelector<HTMLElement>(".info-icon")?.addEventListener("click", function () {
      this.focus();
    });
  }
}

function renderSliders(type: ObstacleType): void {
  slidersEl.innerHTML = "";
  for (const spec of OBSTACLES[type].sliders) {
    const row = document.createElement("div");
    row.className = "slider-row";

    const label = document.createElement("label");
    const valueSpan = document.createElement("span");
    valueSpan.textContent = String(currentParams[spec.key]);
    label.append(spec.label, valueSpan);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(currentParams[spec.key]);
    input.addEventListener("input", () => {
      currentParams[spec.key] = Number(input.value);
      valueSpan.textContent = input.value;
      rebuildObstacle(type);
      rebuildStructure(type, currentMethod);
      rebuildDimensions(type);
      renderBom(type, currentMethod);
      rebuildPartDrawings(type, currentMethod);
      renderRideabilityWarning(type);
    });
    input.addEventListener("change", commit);

    row.append(label, input);
    slidersEl.append(row);
  }
}

function selectType(type: ObstacleType): void {
  currentParams = { ...OBSTACLES[type].defaults };
  renderSliders(type);
  rebuildObstacle(type);
  rebuildDimensions(type);
  renderMethodOptions(type);
  renderMethodControls(type, currentMethod);
  rebuildStructure(type, currentMethod);
  renderBom(type, currentMethod);
  rebuildPartDrawings(type, currentMethod);
  renderRideabilityWarning(type);
}

function resetParams(): void {
  const type = typeSelect.value as ObstacleType;
  currentParams = { ...OBSTACLES[type].defaults };
  renderSliders(type);
  rebuildObstacle(type);
  rebuildStructure(type, currentMethod);
  rebuildDimensions(type);
  renderBom(type, currentMethod);
  rebuildPartDrawings(type, currentMethod);
  renderRideabilityWarning(type);
}

// --- Undo/redo + persistence ---

function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** Reads every live control value into one AppState — the counterpart to applyState below. */
function snapshot(): AppState {
  return {
    type: typeSelect.value as ObstacleType,
    method: currentMethod,
    params: { ...currentParams },
    centerRail: currentCenterRail,
    additionalPostsPerSection: currentAdditionalPostsPerSection,
    railOutline: railOutlinesGroup.visible,
    wireframe: Object.fromEntries(COMPONENT_TOGGLES.map(({ id, material }) => [id, material.wireframe])),
    show: Object.fromEntries(COMPONENT_TOGGLES.map(({ id, group }) => [id, group.visible])),
  };
}

function updateHistoryButtons(): void {
  undoBtn.disabled = historyState.past.length === 0;
  redoBtn.disabled = historyState.future.length === 0;
}

/** Folds the current live values into history as one undo step, and persists them. Call after
 * a control change completes (slider release, select/checkbox change, reset). */
function commit(): void {
  historyState = pushHistory(historyState, snapshot());
  saveState(historyState.present);
  updateHistoryButtons();
}

/** Syncs the live variables + every toggle-carrying material/group + the whole DOM to a
 * historical (or persisted, or default) state, then fully re-renders. Used by boot, undo, and
 * redo. Toggles are applied to their materials/groups *before* renderMethodControls runs, so
 * its checkboxes' `checked` attributes (which read those objects directly) reflect the
 * restored state rather than whatever was live before. */
function applyState(state: AppState): void {
  currentParams = { ...state.params };
  currentCenterRail = state.centerRail;
  currentAdditionalPostsPerSection = state.additionalPostsPerSection;

  typeSelect.value = state.type;
  renderMethodOptions(state.type); // resets currentMethod to that type's first implemented method
  if (IMPLEMENTED_METHODS[state.type].includes(state.method)) {
    currentMethod = state.method;
    methodSelect.value = state.method;
  }

  railOutlinesGroup.visible = state.railOutline;
  for (const { id, material, group } of COMPONENT_TOGGLES) {
    material.wireframe = state.wireframe[id] ?? false;
    group.visible = state.show[id] ?? true;
  }

  renderSliders(state.type);
  renderMethodControls(state.type, currentMethod);
  rebuildObstacle(state.type);
  rebuildStructure(state.type, currentMethod);
  rebuildDimensions(state.type);
  renderBom(state.type, currentMethod);
  rebuildPartDrawings(state.type, currentMethod);
  renderRideabilityWarning(state.type);
  updateHistoryButtons();
}

function undo(): void {
  historyState = undoHistory(historyState);
  applyState(historyState.present);
  saveState(historyState.present);
}

function redo(): void {
  historyState = redoHistory(historyState);
  applyState(historyState.present);
  saveState(historyState.present);
}

window.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
  event.preventDefault();
  if (event.shiftKey) redo();
  else undo();
});

undoBtn.addEventListener("click", undo);
redoBtn.addEventListener("click", redo);

typeSelect.addEventListener("change", () => {
  selectType(typeSelect.value as ObstacleType);
  commit();
});
methodSelect.addEventListener("change", () => {
  currentMethod = methodSelect.value as ConstructionMethod;
  renderMethodControls(typeSelect.value as ObstacleType, currentMethod);
  rebuildStructure(typeSelect.value as ObstacleType, currentMethod);
  renderBom(typeSelect.value as ObstacleType, currentMethod);
  rebuildPartDrawings(typeSelect.value as ObstacleType, currentMethod);
  commit();
});
resetBtn.addEventListener("click", () => {
  resetParams();
  commit();
});

const tabButtons = Array.from(document.querySelectorAll<HTMLButtonElement>(".tab-btn"));
for (const tabButton of tabButtons) {
  tabButton.addEventListener("click", () => {
    for (const btn of tabButtons) {
      const selected = btn === tabButton;
      btn.setAttribute("aria-selected", String(selected));
      document.getElementById(btn.getAttribute("aria-controls")!)!.hidden = !selected;
    }
  });
}

applyState(historyState.present);

function resize(): void {
  const { clientWidth, clientHeight } = viewport;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight);
}
window.addEventListener("resize", resize);
resize();

function animate(): void {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
