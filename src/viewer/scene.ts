import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { BimElement, Discipline } from "../model/types";
import type { Clash } from "../model/clash";
import { SIZE_X, SIZE_Z, FLOORS, STOREY } from "../model/building";

/**
 * The three.js layer, kept imperative behind a small API so React never
 * re-renders on camera moves. Mirrors how viewer extensions are structured on
 * top of an embedded 3D component: the host owns the scene, the UI calls in.
 */

const DISCIPLINE_MATERIAL: Record<Discipline, { color: number; opacity: number }> = {
  structural: { color: 0x9aa5b1, opacity: 1 },
  architecture: { color: 0xd7dde6, opacity: 0.28 },
  mep: { color: 0x2f9e77, opacity: 1 },
};

const MEP_DUCT_COLOR = 0x4c8dff;
const CLASH_A = 0xe2564a; // structural/arch side
const CLASH_B = 0xf5b544; // mep side

type Handles = {
  mesh: THREE.Mesh;
  edges: THREE.LineSegments;
  baseColor: number;
  baseOpacity: number;
  baseEdgeOpacity: number;
};

export class BimScene {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private raf = 0;
  private handles = new Map<string, Handles>();
  private clashMarker: THREE.Mesh | null = null;
  private highlighted: string[] = [];
  private clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), Infinity);
  private flyTarget: { pos: THREE.Vector3; look: THREE.Vector3; t: number } | null = null;
  private grid!: THREE.GridHelper;

  init(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.camera.position.set(SIZE_X * 1.15, FLOORS * STOREY * 1.35, SIZE_Z * 1.9);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(SIZE_X / 2, (FLOORS * STOREY) / 2.4, SIZE_Z / 2);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.52;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x445266, 1.15);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(30, 50, 20);
    this.scene.add(dir);

    this.grid = new THREE.GridHelper(90, 45, 0x2a3442, 0x1c2430);
    this.grid.position.set(SIZE_X / 2, -0.01, SIZE_Z / 2);
    this.scene.add(this.grid);

    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      if (this.flyTarget) {
        const { pos, look } = this.flyTarget;
        this.flyTarget.t = Math.min(1, this.flyTarget.t + 0.035);
        const k = 1 - Math.pow(1 - this.flyTarget.t, 3); // ease-out
        this.camera.position.lerp(pos, k * 0.14);
        this.controls.target.lerp(look, k * 0.14);
        if (this.flyTarget.t >= 1) this.flyTarget = null;
      }
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  setTheme(light: boolean) {
    this.renderer.setClearColor(light ? 0xe9edf4 : 0x0c121a, 1);
    (this.grid.material as THREE.Material & { color?: THREE.Color }).opacity = light ? 0.5 : 1;
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  build(elements: BimElement[]) {
    for (const el of elements) {
      const size = [
        el.box.max[0] - el.box.min[0],
        el.box.max[1] - el.box.min[1],
        el.box.max[2] - el.box.min[2],
      ] as const;
      const center = [
        (el.box.min[0] + el.box.max[0]) / 2,
        (el.box.min[1] + el.box.max[1]) / 2,
        (el.box.min[2] + el.box.max[2]) / 2,
      ] as const;

      const spec = DISCIPLINE_MATERIAL[el.discipline];
      const color = el.type === "duct" ? MEP_DUCT_COLOR : spec.color;

      const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const material = new THREE.MeshStandardMaterial({
        color,
        transparent: spec.opacity < 1,
        opacity: spec.opacity,
        roughness: 0.85,
        metalness: 0.05,
        clippingPlanes: [this.clipPlane],
        clipShadows: true,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(center[0], center[1], center[2]);
      mesh.userData.id = el.id;
      this.scene.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: 0x0b0f16,
          transparent: true,
          opacity: el.discipline === "architecture" ? 0.12 : 0.35,
          clippingPlanes: [this.clipPlane],
        }),
      );
      edges.position.copy(mesh.position);
      this.scene.add(edges);

      this.handles.set(el.id, {
        mesh,
        edges,
        baseColor: color,
        baseOpacity: spec.opacity,
        baseEdgeOpacity: el.discipline === "architecture" ? 0.12 : 0.35,
      });
    }
  }

  setDisciplineVisible(elements: BimElement[], discipline: Discipline, visible: boolean) {
    for (const el of elements) {
      if (el.discipline !== discipline) continue;
      const h = this.handles.get(el.id);
      if (h) {
        h.mesh.visible = visible;
        h.edges.visible = visible;
      }
    }
  }

  /** Cut everything above `height` (world y); null clears the section. */
  setSection(height: number | null) {
    this.clipPlane.constant = height ?? Infinity;
  }

  clearClashHighlight() {
    // Ghosting touches every element, so restore the whole model.
    for (const h of this.handles.values()) {
      const m = h.mesh.material as THREE.MeshStandardMaterial;
      m.color.setHex(h.baseColor);
      m.emissive.setHex(0x000000);
      m.opacity = h.baseOpacity;
      m.transparent = h.baseOpacity < 1;
      m.needsUpdate = true; // `transparent` toggles need a program refresh
      (h.edges.material as THREE.LineBasicMaterial).opacity = h.baseEdgeOpacity;
    }
    this.highlighted = [];
    if (this.clashMarker) {
      this.scene.remove(this.clashMarker);
      this.clashMarker.geometry.dispose();
      (this.clashMarker.material as THREE.Material).dispose();
      this.clashMarker = null;
    }
  }

  focusClash(clash: Clash) {
    this.clearClashHighlight();

    const paint = (id: string, hex: number) => {
      const h = this.handles.get(id);
      if (!h) return;
      const m = h.mesh.material as THREE.MeshStandardMaterial;
      m.color.setHex(hex);
      m.emissive.setHex(hex);
      m.emissiveIntensity = 0.35;
      m.opacity = 1;
      this.highlighted.push(id);
    };
    // Ghost the rest of the model so the pair reads through floors/walls —
    // the "isolate with ghosted context" a coordination review expects.
    const pair = new Set([clash.a.id, clash.b.id]);
    for (const [id, h] of this.handles) {
      if (pair.has(id)) continue;
      const m = h.mesh.material as THREE.MeshStandardMaterial;
      m.transparent = true;
      m.opacity = 0.07;
      m.needsUpdate = true; // `transparent` toggles need a program refresh
      (h.edges.material as THREE.LineBasicMaterial).opacity = 0.04;
    }

    paint(clash.a.id, CLASH_A);
    paint(clash.b.id, CLASH_B);

    // Translucent red box over the overlap region itself.
    const clamp = (v: number) => Math.min(Math.max(v, 0.3), 4);
    const sx = clamp(clash.overlap.max[0] - clash.overlap.min[0]);
    const sy = clamp(clash.overlap.max[1] - clash.overlap.min[1]);
    const sz = clamp(clash.overlap.max[2] - clash.overlap.min[2]);
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(sx * 1.4, sy * 1.4, sz * 1.4),
      new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    marker.position.set(clash.center[0], clash.center[1], clash.center[2]);
    this.scene.add(marker);
    this.clashMarker = marker;

    // Fly the camera to a three-quarter view of the clash.
    const look = new THREE.Vector3(...clash.center);
    const pos = look.clone().add(new THREE.Vector3(7, 4.5, 7));
    this.flyTarget = { pos, look, t: 0 };
  }

  resetView() {
    this.clearClashHighlight();
    this.flyTarget = {
      pos: new THREE.Vector3(SIZE_X * 1.15, FLOORS * STOREY * 1.35, SIZE_Z * 1.9),
      look: new THREE.Vector3(SIZE_X / 2, (FLOORS * STOREY) / 2.4, SIZE_Z / 2),
      t: 0,
    };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    for (const h of this.handles.values()) {
      h.mesh.geometry.dispose();
      (h.mesh.material as THREE.Material).dispose();
      h.edges.geometry.dispose();
      (h.edges.material as THREE.Material).dispose();
    }
    this.handles.clear();
    this.renderer.dispose();
  }
}
