import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildRollerGeometry, ROLLER_DEFAULTS, type RollerParams } from "./obstacles/roller";
import { buildBermGeometry, BERM_DEFAULTS, type BermParams } from "./obstacles/berm";
import { buildKickerGeometry, KICKER_DEFAULTS, type KickerParams } from "./obstacles/kicker";

type ObstacleType = "roller" | "berm" | "kicker";

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
const slidersEl = document.getElementById("sliders")!;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe9f0);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
camera.position.set(5, 4, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true;
viewport.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.3, 0);
controls.enableDamping = true;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentParams: any = { ...OBSTACLES.roller.defaults };

function rebuildObstacle(type: ObstacleType): void {
  const geometry = OBSTACLES[type].build(currentParams);
  obstacleMesh.geometry.dispose();
  obstacleMesh.geometry = geometry;
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
    });

    row.append(label, input);
    slidersEl.append(row);
  }
}

function selectType(type: ObstacleType): void {
  currentParams = { ...OBSTACLES[type].defaults };
  renderSliders(type);
  rebuildObstacle(type);
}

typeSelect.addEventListener("change", () => selectType(typeSelect.value as ObstacleType));
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
