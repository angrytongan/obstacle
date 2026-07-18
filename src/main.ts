import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildRollerGeometry, ROLLER_DEFAULTS, type RollerParams } from "./obstacles/roller";
import { buildBermGeometry, BERM_DEFAULTS, type BermParams } from "./obstacles/berm";
import { buildKickerGeometry, KICKER_DEFAULTS, type KickerParams } from "./obstacles/kicker";
import { checkRollerSlope } from "./construction/slopeCheck";
import { calculateRollerEarthenBom } from "./construction/earthenBom";
import { buildRollerDimensions } from "./dimensions/rollerDimensions";

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
  roller: ["earthen"],
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
      { key: "length", label: "Length (m)", min: 1, max: 8, step: 0.1 },
      { key: "height", label: "Height (m)", min: 0.1, max: 1.5, step: 0.05 },
      { key: "width", label: "Width (m)", min: 0.5, max: 3, step: 0.1 },
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
const resetBtn = document.getElementById("reset-btn")!;
const bomEl = document.getElementById("bom")!;
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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(-6, 8, 4);
sun.castShadow = true;
scene.add(ambient, sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x6b8f5a, flatShading: true }),
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

const dimensionsGroup = new THREE.Group();
dimensionsGroup.position.y = 0.01; // lifted off the ground plane to avoid z-fighting with it
scene.add(dimensionsGroup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentParams: any = { ...OBSTACLES.roller.defaults };
let currentMethod: ConstructionMethod = "earthen";

function rebuildObstacle(type: ObstacleType): void {
  const geometry = OBSTACLES[type].build(currentParams);
  obstacleMesh.geometry.dispose();
  obstacleMesh.geometry = geometry;
}

const LABEL_FONT_PX = 48;
const LABEL_WORLD_HEIGHT = 0.25; // meters

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
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
  sprite.scale.set((LABEL_WORLD_HEIGHT * canvas.width) / canvas.height, LABEL_WORLD_HEIGHT, 1);
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

function renderBom(type: ObstacleType, method: ConstructionMethod): void {
  if (type !== "roller" || method !== "earthen") {
    bomEl.innerHTML = `<p class="bom-unavailable">No bill of materials yet for ${CONSTRUCTION_METHOD_LABELS[method].toLowerCase()} ${type}s.</p>`;
    return;
  }

  const params = currentParams as RollerParams;
  const slope = checkRollerSlope(params);
  const bom = calculateRollerEarthenBom(params);
  const fillTooltip = `Order this much loose fill — it settles to ${bom.compactedFillVolumeM3.toFixed(2)} m³ once compacted in place (includes a 20% waste factor).`;

  bomEl.innerHTML = `
    <h2>Bill of materials</h2>
    <span class="bom-status ${slope.safe ? "safe" : "unsafe"}">
      ${slope.safe ? "Slope OK" : "Too steep"}: ${slope.maxAngleDeg.toFixed(1)}° (max safe ${slope.safeAngleDeg}°)
      ${infoIcon(BOM_INFO.slopeConstraint)}
    </span>
    <dl>
      <dt><span class="bom-label">Fill material</span> ${infoIcon(fillTooltip)}</dt><dd>${bom.looseFillVolumeM3.toFixed(2)} m³</dd>
      <dt><span class="bom-label">Geotextile fabric</span> ${infoIcon(BOM_INFO.geotextile)}</dt><dd>${bom.geotextileFabricAreaM2.toFixed(2)} m²</dd>
    </dl>
    <p class="bom-disclaimer">${BOM_DISCLAIMER}</p>
  `;
  for (const icon of bomEl.querySelectorAll<HTMLElement>(".info-icon")) {
    // Safari doesn't focus a button on click by default; force it so the delegated
    // focusin listener (which shows the tooltip) fires on click too, not just hover.
    icon.addEventListener("click", () => icon.focus());
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
      rebuildDimensions(type);
      renderBom(type, currentMethod);
    });

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
  renderBom(type, currentMethod);
}

function resetParams(): void {
  const type = typeSelect.value as ObstacleType;
  currentParams = { ...OBSTACLES[type].defaults };
  renderSliders(type);
  rebuildObstacle(type);
  rebuildDimensions(type);
  renderBom(type, currentMethod);
}

typeSelect.addEventListener("change", () => selectType(typeSelect.value as ObstacleType));
methodSelect.addEventListener("change", () => {
  currentMethod = methodSelect.value as ConstructionMethod;
  renderBom(typeSelect.value as ObstacleType, currentMethod);
});
resetBtn.addEventListener("click", resetParams);
selectType("roller");

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
