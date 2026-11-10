import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { SceneKind } from './AnatomyScene';

type V3 = [number, number, number];
type Material = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial;
const TAU = Math.PI * 2;
const ease = (v: number) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const blend = (a: V3, b: V3, t: number): V3 => a.map((v, i) => THREE.MathUtils.lerp(v, b[i], ease(t))) as V3;

export function mountCeramicScene(host: HTMLDivElement, kind: SceneKind, onReady: () => void, onUnavailable: () => void, stillPose?: number) {
  let receiptPhase = 'idle';
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x101112, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3.1, 3.1, 2.6, -2.6, .1, 70);
  camera.position.set(5.5, 4.4, 11);
  camera.lookAt(kind === 'hero' ? -.15 : 0, kind === 'hero' ? .74 : .88, 0);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, .045);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = .55;
  environment.dispose(); pmrem.dispose();
  const materials: Material[] = [];
  const material = (color: string, roughness = .3, metalness = 0, extra = {}) => {
    const value = new THREE.MeshPhysicalMaterial({ color, roughness, metalness, clearcoat: .4, clearcoatRoughness: .25, ...extra });
    materials.push(value); return value;
  };
  const ceramic = material('#ffffff', .25), pearl = material('#d8d5e1', .32), lilac = material('#c6b5ef', .34), violet = material('#806697', .43);
  const dark = material('#181b25', .4, .02), lens = material('#111723', .27, 0, { clearcoat: .8 });
  const gold = material('#d8d5e8', .34, .2), ink = material('#797086', .65);
  const paper = material('#ffffff', .78, 0, { clearcoat: 0, side: THREE.DoubleSide });
  const green = material('#eee8ff', .35, 0, { emissive: '#c6b5ef', emissiveIntensity: .3 });
  scene.add(new THREE.HemisphereLight(0xf7edff, 0x55465e, .8));
  const key = new THREE.DirectionalLight(0xfff3df, 2.6);
  key.position.set(-3, 9, 5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -5; key.shadow.camera.right = 5; key.shadow.camera.top = 6; key.shadow.camera.bottom = -4;
  key.shadow.normalBias = .035; key.shadow.bias = -.00015; key.shadow.radius = 5; scene.add(key);
  const rim = new THREE.DirectionalLight(0xcdbbff, 2); rim.position.set(4, 4, -5); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xe3ecff, .4); fill.position.set(2, 3, 7); scene.add(fill);
  const stage = new THREE.Group(); scene.add(stage);
  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = 128; shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d')!;
  const shadowGradient = shadowContext.createRadialGradient(64, 64, 6, 64, 64, 64);
  shadowGradient.addColorStop(0, 'rgba(0,0,0,.6)'); shadowGradient.addColorStop(.35, 'rgba(0,0,0,.35)'); shadowGradient.addColorStop(1, 'rgba(0,0,0,0)');
  shadowContext.fillStyle = shadowGradient; shadowContext.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false });
  const contactPositions: Record<SceneKind, V3[]> = { hero: [[-1.7, 0, -.16], [-.85, 0, -.03], [.05, 0, .2], [1.25, 0, -.04]], wallet: [[-.6, 0, 0], [.307, 0, .267]], policy: [[-.45, 0, .2], [.85, 0, -.04]], receipt: [[.25, 0, .2], [-.7, 0, .2], [.95, 0, .04]] };
  const contactShadows: THREE.Mesh[] = [];
  for (const position of contactPositions[kind]) {
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), shadowMaterial);
    contact.rotation.x = -Math.PI / 2; contact.position.set(...position); contact.position.y = -.025; scene.add(contact); contactShadows.push(contact);
  }
  const mesh = (parent: THREE.Object3D, geometry: THREE.BufferGeometry, mat: Material, position: V3 = [0, 0, 0]) => {
    const item = new THREE.Mesh(geometry, mat); item.position.set(...position); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  };
  const round = (parent: THREE.Object3D, size: V3, pos: V3, radius: number, mat: Material) => {
    if (radius <= size[2] * .49) return mesh(parent, new RoundedBoxGeometry(...size, 5, radius), mat, pos);
    const [w, h, d] = size, bevel = Math.min(d * .22, radius * .25), r = Math.min(radius, w / 2, h / 2) - bevel;
    const x = w / 2 - bevel, y = h / 2 - bevel, shape = new THREE.Shape();
    shape.moveTo(-x + r, -y); shape.lineTo(x - r, -y); shape.quadraticCurveTo(x, -y, x, -y + r);
    shape.lineTo(x, y - r); shape.quadraticCurveTo(x, y, x - r, y); shape.lineTo(-x + r, y);
    shape.quadraticCurveTo(-x, y, -x, y - r); shape.lineTo(-x, -y + r); shape.quadraticCurveTo(-x, -y, -x + r, -y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 12, steps: 1 });
    geometry.translate(0, 0, -d / 2 + bevel); return mesh(parent, geometry, mat, pos);
  };
  const ball = (parent: THREE.Object3D, size: V3, pos: V3, mat: Material) => { const item = mesh(parent, new THREE.SphereGeometry(1, 40, 28), mat, pos); item.scale.set(...size); return item; };
  const rod = (parent: THREE.Object3D, a: V3, b: V3, radius: number, mat: Material) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const item = mesh(parent, new THREE.CylinderGeometry(radius, radius, 1, 24), mat);
    item.position.copy(start.add(end).multiplyScalar(.5)); item.scale.y = delta.length(); item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return item;
  };
  const curve = (parent: THREE.Object3D, points: V3[], radius: number, mat: Material) => mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 32, radius, 10, false), mat);
  const group = (parent: THREE.Object3D, position: V3 = [0, 0, 0]) => { const value = new THREE.Group(); value.position.set(...position); parent.add(value); return value; };
  const check = (parent: THREE.Object3D, position: V3, scale = 1, mat = violet) => {
    const mark = group(parent, position); curve(mark, [[-.12, 0, 0], [-.025, -.085, 0], [.15, .13, 0]], .025, mat); mark.scale.setScalar(scale); return mark;
  };
  function card(parent: THREE.Object3D) {
    const root = group(parent); round(root, [.6, .39, .055], [0, 0, 0], .055, lilac);
    round(root, [.58, .075, .006], [0, .09, -.03], .008, violet);
    round(root, [.13, .105, .007], [-.16, .015, .031], .02, gold);
    for (let i = 0; i < 3; i++) rod(root, [-.205, -.014 + i * .03, .036], [-.115, -.014 + i * .03, .036], .003, violet);
    rod(root, [-.16, -.03, .036], [-.16, .06, .036], .003, violet);
    for (let i = 0; i < 3; i++) round(root, [.07, .012, .006], [-.15 + i * .1, -.12, .032], .005, ceramic);
    ball(root, [.042, .042, .008], [.18, .08, .033], ceramic); ball(root, [.042, .042, .008], [.225, .08, .034], pearl); return root;
  }
  function wallet(parent: THREE.Object3D) {
    const root = group(parent); round(root, [.88, .54, .07], [0, 0, -.085], .1, violet);
    round(root, [.8, .46, .012], [0, .015, -.044], .065, dark);
    round(root, [.9, .45, .08], [0, -.105, .105], .085, lilac);
    for (const side of [-1, 1]) round(root, [.045, .39, .18], [side * .405, -.11, .015], .018, violet);
    round(root, [.80, .045, .18], [0, -.295, .015], .018, violet);
    curve(root, [[-.36, .04, .169], [-.12, -.015, .17], [.12, -.015, .17], [.36, .04, .169]], .008, pearl);
    for (let i = 0; i < 16; i++) rod(root, [-.35 + i * .047, -.265, .17], [-.33 + i * .047, -.265, .17], .004, ceramic);
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) rod(root, [side * .39, -.23 + i * .054, .165], [side * .39, -.21 + i * .054, .165], .004, ceramic);
    round(root, [.24, .17, .06], [.34, -.065, .19], .05, violet); ball(root, [.039, .039, .012], [.36, -.065, .225], gold); return root;
  }
  function character(parent: THREE.Object3D) {
    const root = group(parent), unit = .95; root.name = 'robot';
    const cream = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: .03, roughness: .3, clearcoat: .8 });
    const outfit = new THREE.MeshPhysicalMaterial({ color: 0xc6b5ef, metalness: .08, roughness: .34, clearcoat: .65 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x191821, roughness: .2 });
    const lit = new THREE.MeshStandardMaterial({ color: 0xf4efff, emissive: 0x9985cf, emissiveIntensity: .6 });
    materials.push(cream, outfit, screen, lit);
    const robotBox = (parent: THREE.Object3D, size: V3, position: V3, mat: Material, radius: number) =>
      mesh(parent, new RoundedBoxGeometry(...size.map(v => v * unit) as V3, 5, Math.min(radius, ...size.map(v => v / 3)) * unit), mat, position.map(v => v * unit) as V3);
    const feet: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const foot = group(root); feet.push(foot);
      mesh(foot, new THREE.CylinderGeometry(.07 * unit, .075 * unit, .31 * unit, 10), outfit, [side * .2 * unit, .315 * unit, 0]);
      robotBox(foot, [.25, .12, .38], [side * .2, .07, .055], cream, .05);
    }
    const body = group(root);
    robotBox(body, [.67, .42, .56], [0, .63, 0], outfit, .12);
    robotBox(body, [.22, .09, .035], [0, .66, .3], cream, .02);
    robotBox(body, [.24, .08, .24], [0, .855, 0], cream, .035);
    const headRestY = 1.23 * unit, head = group(body, [0, headRestY, 0]); head.name = 'head';
    robotBox(head, [1.02, .75, .76], [0, 0, 0], cream, .2);
    robotBox(head, [.84, .48, .07], [0, 0, .395], screen, .14);
    const pupils = group(head), eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) eyes.push(robotBox(pupils, [.095, .16, .025], [side * .2, .055, .44], lit, .035));
    const mouth = group(head, [0, -.12 * unit, .44 * unit]);
    robotBox(mouth, [.15, .025, .02], [0, -.015, 0], lit, .008);
    for (const side of [-1, 1]) robotBox(mouth, [.075, .025, .02], [side * .095, .005, 0], lit, .008).rotation.z = side * .55;
    mesh(head, new THREE.CylinderGeometry(.025 * unit, .025 * unit, .17 * unit, 8), outfit, [0, .45 * unit, 0]);
    mesh(head, new THREE.SphereGeometry(.065 * unit, 12, 8), lit, [0, .56 * unit, 0]);
    const pocketSide = kind === 'receipt' ? -1 : 1;
    const pocket = group(body, [pocketSide * .28, .46, -.32]); pocket.visible = false;
    round(pocket, [.28, .23, .035], [0, 0, 0], .035, outfit);
    round(pocket, [.28, .20, .035], [0, -.015, -.10], .035, outfit);
    for (const side of [-1, 1]) round(pocket, [.025, .19, .10], [side * .127, -.015, -.05], .01, outfit);
    round(pocket, [.25, .025, .10], [0, -.105, -.05], .01, outfit);
    const hands: THREE.Group[] = [], sleeves: THREE.Group[] = [], armJoints: THREE.Vector3[][] = [];
    const sleeveLength = .32;
    for (const side of [-1, 1]) {
      const sleeve = group(body, [side * .41 * unit, .73 * unit, 0]); sleeves.push(sleeve);
      round(sleeve, [.145, .265, .16], [0, -.12, 0], .055, cream);
      const hand = group(sleeve, [0, -sleeveLength, 0]); hands.push(hand);
      round(hand, [.15, .13, .17], [0, .015, 0], .05, outfit);
      for (const finger of [-1, 1]) round(hand, [.055, .075, .10], [finger * .035, -.045, .025], .024, cream);
    }
    function poseSleeve(index: number, direction: V3) {
      const aim = new THREE.Vector3(...direction).normalize();
      sleeves[index].quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim);
      const origin = sleeves[index].position.clone();
      armJoints[index] = [origin, origin.clone().addScaledVector(aim, sleeveLength)];
    }
    poseSleeve(0, [-.12, -1, .12]); poseSleeve(1, [.12, -1, .12]);
    function lookAtPoint(world: V3) {
      root.updateWorldMatrix(true, false);
      const target = body.worldToLocal(new THREE.Vector3(...world)).sub(head.position);
      const yaw = THREE.MathUtils.clamp(Math.atan2(target.x, target.z), -.65, .65);
      const pitch = THREE.MathUtils.clamp(Math.atan2(-target.y, Math.hypot(target.x, target.z)) * .42, -.2, .34);
      head.rotation.set(pitch, yaw, -yaw * .04); pupils.position.set(yaw * .075, -pitch * .045, 0);
    }
    return { root, body, head, headRestY, eyes, hands, feet, armJoints, poseSleeve, lookAtPoint, mouth };
  }
  function receipt(parent: THREE.Object3D, width = .55, height = .85) {
    const root = group(parent), shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
    for (let i = 0; i <= 10; i++) shape.lineTo(width / 2 - width * i / 10, height - (i % 2) * .035);
    shape.closePath(); const sheet = mesh(root, new THREE.ShapeGeometry(shape, 8), paper), positions = sheet.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getY(i) / height * Math.PI) * height * .08);
    sheet.geometry.computeVertexNormals(); check(root, [0, height * .76, height * .08 + .008], Math.min(.7, width * 1.8), violet);
    for (let i = 0; i < 4; i++) { const y = height * (.14 + i * .14); round(root, [width * (i === 3 ? .35 : .58), .012, .008], [-.025, y, Math.sin(y / height * Math.PI) * height * .08 + .009], .004, ink); }
    return root;
  }
  function paperFeed(slip: THREE.Group, level: number) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -level);
    const finishes: Material[] = [];
    slip.traverse(object => {
      if (object instanceof THREE.Mesh) {
        const finish = (object.material as Material).clone();
        finish.clippingPlanes = [plane]; finish.clipShadows = true;
        object.material = finish; finishes.push(finish); materials.push(finish);
      }
    });
    return (feeding: boolean) => { plane.constant = feeding ? -level : 100; };
  }
  type Agent = ReturnType<typeof character>;
  const companion = character(stage), agents: Agent[] = [companion];
  const timers: ((time: number) => void)[] = [];
  const idleLeft: V3 = [-.12, -1, .12], idleRight: V3 = [.12, -1, .12];
  let contactGap: number | null = null, contact = false, printedHeight = 0, concealedFraction: number | null = null;
  let paperOwner: 'printer' | 'agent' | 'bag' | 'tray' | null = null;
  const vector = (value: THREE.Vector3): V3 => [value.x, value.y, value.z];
  const palm = (agent: Agent, index: number) => { agent.root.updateWorldMatrix(true, true); return agent.hands[index].getWorldPosition(new THREE.Vector3()); };
  const placeHeld = (object: THREE.Object3D, agent: Agent, index: number, grip: V3, yaw: number) => {
    object.rotation.set(0, yaw, 0);
    object.position.copy(palm(agent, index)).sub(new THREE.Vector3(...grip).multiplyScalar(agent.root.scale.x).applyEuler(object.rotation));
  };
  const path = (time: number, keys: [number, V3][]) => {
    for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) return blend(keys[i - 1][1], keys[i][1], (time - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
    return keys[keys.length - 1][1];
  };
  const face = (agent: Agent, time: number) => {
    const blink = Math.pow(Math.max(0, Math.cos(time * 1.17)), 60);
    agent.eyes.forEach(eye => { eye.scale.y = (1 - blink * .92) * .82; });
    agent.mouth.scale.set(1, 1.18, 1);
    agent.mouth.rotation.z = 0;
    agent.head.position.y = agent.headRestY + Math.sin(time * 1.3) * .008;
  };
  function openContainer(parent: THREE.Object3D, center: V3, width: number, height: number, depth: number) {
    const root = group(parent, center); root.name = 'wallet';
    round(root, [width, height, .035], [0, 0, -depth / 2], .055, violet);
    round(root, [width, height, .035], [0, 0, depth / 2], .055, lilac);
    for (const side of [-1, 1]) round(root, [.035, height - .025, depth], [side * (width / 2 - .0175), 0, 0], .012, violet);
    round(root, [width - .035, .035, depth], [0, -height / 2 + .0175, 0], .012, violet);
    for (let i = 0; i < 9; i++) round(root, [.025, .008, .006], [-width * .36 + i * width * .09, -height * .36, depth / 2 + .020], .003, ceramic);
    round(root, [.13, .10, .025], [width * .28, -.02, depth / 2 + .025], .025, violet);
    ball(root, [.023, .023, .008], [width * .28, -.02, depth / 2 + .043], pearl);
    return root;
  }
  function readerAt(cardAtContact: THREE.Group, cardScale: number, machine: THREE.Group, machineAnchor: V3) {
    const halfDepth = .055 * cardScale / 2;
    const plane = cardAtContact.position.z - halfDepth;
    const reader = group(stage, [cardAtContact.position.x, cardAtContact.position.y, plane - .035]); reader.name = 'reader';
    round(reader, [.20, .16, .07], [0, 0, 0], .035, pearl);
    round(reader, [.17, .13, .008], [0, 0, .039], .025, lilac);
    // The exposed reader face is the actual contact plane.
    const faceZ = plane + .008;
    for (let i = 0; i < 2; i++) curve(reader, [[-.015 + i * .026, -.035, .045], [.008 + i * .026, 0, .045], [-.015 + i * .026, .035, .045]], .004, ceramic);
    const start = machine.localToWorld(new THREE.Vector3(...machineAnchor));
    rod(stage, vector(start), [reader.position.x + .07, reader.position.y, reader.position.z - .01], .036, pearl);
    return { root: reader, plane: faceZ };
  }
  function apiMachine() {
    const root = group(stage, [1.25, 0, -.04]); root.name = 'terminal';
    round(root, [.62, 1.14, .54], [0, .66, 0], .13, ceramic);
    round(root, [.61, .11, .52], [0, .095, 0], .045, violet);
    round(root, [.49, .32, .04], [0, .96, .284], .05, lens);
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 120;
    const context = canvas.getContext('2d')!; context.fillStyle = '#11131b'; context.fillRect(0, 0, 240, 120);
    context.fillStyle = '#ffffff'; context.font = '500 54px monospace'; context.textAlign = 'center'; context.fillText('API', 120, 80);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    mesh(root, new THREE.PlaneGeometry(.41, .205), material('#ffffff', .5, 0, { map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: .2 }), [0, .96, .307]);
    round(root, [.32, .035, .04], [0, .42, .286], .012, dark);
    round(root, [.42, .035, .24], [0, .16, .35], .012, pearl);
    round(root, [.42, .12, .035], [0, .205, .455], .015, lilac);
    for (let i = 0; i < 4; i++) round(root, [.27, .012, .008], [0, .54 + i * .044, .277], .005, pearl);
    const lamp = ball(root, [.023, .023, .012], [.21, .69, .28], lilac);
    return { root, lamp };
  }
  const cycle = kind === 'hero' ? 8 : kind === 'wallet' ? 8 : kind === 'policy' ? 7 : 10;
  let stillTime = 2.6;
  if (kind === 'hero') {
    companion.root.position.set(.05, 0, .20); companion.root.rotation.y = .28; companion.root.scale.setScalar(.72);
    const waitingA = character(stage), waitingB = character(stage); agents.push(waitingA, waitingB);
    waitingA.root.position.set(-.85, 0, -.03); waitingA.root.scale.setScalar(.68);
    waitingB.root.position.set(-1.70, 0, -.16); waitingB.root.scale.setScalar(.66);
    const machine = apiMachine(), payment = card(stage), cardScale = .5 * .72;
    payment.name = 'payment-card'; payment.scale.setScalar(cardScale);
    const rest: V3 = [.30, -.60, .74], tap: V3 = [.65, .12, .75], grip: V3 = [-.23, .02, -.035];
    companion.poseSleeve(1, tap); placeHeld(payment, companion, 1, grip, 0);
    const reader = readerAt(payment, cardScale, machine.root, [-.28, .53, .06]);
    const contactCorrection = reader.plane - (payment.position.z - .055 * cardScale / 2);
    const slip = receipt(stage, .22, .28); slip.name = 'active-paper'; const feedBase: V3 = [1.25, .42, .265];
    const clipping = paperFeed(slip, feedBase[1]);
    const stored = receipt(stage, .22, .28); stored.position.set(1.25, .175, .365); stored.name = 'stored-paper';
    timers.push((time) => {
      const t = time % cycle, reach = ease((t - .7) / 1.3) * (1 - ease((t - 3.4) / 1.1));
      companion.poseSleeve(0, idleLeft); companion.poseSleeve(1, blend(rest, tap, reach));
      placeHeld(payment, companion, 1, grip, 0); payment.position.z = Math.max(payment.position.z + contactCorrection * reach, reader.plane + .055 * cardScale / 2);
      contactGap = payment.position.z - .055 * cardScale / 2 - reader.plane;
      contact = t >= 2 && t <= 3.4; machine.lamp.material = contact ? green : lilac;
      companion.lookAtPoint([reader.root.position.x, reader.root.position.y + .12, reader.root.position.z]); face(companion, t);
      [waitingA, waitingB].forEach((agent, index) => {
        const glance = .5 - .5 * Math.cos((t / cycle + index * .28) * TAU);
        agent.root.rotation.y = .66 - glance * .48;
        agent.poseSleeve(0, idleLeft); agent.poseSleeve(1, idleRight);
        agent.lookAtPoint(glance > .45 ? [5.5, 2.8, 11] : [.8, .85, .1]); face(agent, t + index * 1.8);
      });
      const feed = ease((t - 2.25) / 1.3), drop = ease((t - 5.9) / .9);
      printedHeight = .28 * feed; clipping(t < 5.9); slip.visible = t >= 2.25 && t < 6.8;
      slip.position.set(feedBase[0], feedBase[1] - .28 * (1 - feed), feedBase[2]);
      if (t >= 5.9) slip.position.lerp(new THREE.Vector3(1.25, .175, .365), drop);
      stored.visible = t < 5.9 || t >= 6.8;
      paperOwner = t < 5.9 ? 'printer' : 'tray'; receiptPhase = t < 2 ? 'approach-reader' : t < 3.4 ? 'card-contact-and-print' : t < 5.9 ? 'receipt-ready' : 'receipt-in-tray';
    });
  } else if (kind === 'wallet') {
    companion.root.position.set(-.60, 0, 0);
    const x = .68, homeY = -.10, homeZ = Math.sqrt(1 - x * x - homeY * homeY);
    const grip: V3 = [-.245, .14, -.035];
    companion.poseSleeve(1, [x, homeY, homeZ]);
    const payment = card(stage); payment.name = 'payment-card'; payment.scale.setScalar(.75); placeHeld(payment, companion, 1, grip, 0);
    const lip = payment.position.y + .045;
    const purse = openContainer(stage, [payment.position.x, lip - .17, payment.position.z], .55, .34, .12); purse.name = 'wallet';
    curve(stage, [[-.37, .77, .30], [-.14, .65, .22], [payment.position.x - .21, lip - .02, payment.position.z - .04]], .022, lilac);
    timers.push((time) => {
      const t = time % cycle, lift = ease((t - .7) / 1.5) * (1 - ease((t - 5) / 1.8));
      const y = THREE.MathUtils.lerp(homeY, .70, lift), z = Math.sqrt(1 - x * x - y * y);
      companion.body.position.z = .32 * (homeZ - z);
      companion.poseSleeve(0, idleLeft); companion.poseSleeve(1, [x, y, z]);
      placeHeld(payment, companion, 1, grip, 0);
      const bottom = payment.position.y - .39 * .75 / 2;
      concealedFraction = THREE.MathUtils.clamp((lip - bottom) / (.39 * .75), 0, 1);
      companion.lookAtPoint([payment.position.x, payment.position.y + .10, payment.position.z]);
      companion.head.rotation.set(.06, -.08, -.05); face(companion, t);
      receiptPhase = t < 2.2 ? 'extract-from-wallet' : t < 5 ? 'card-clear-of-wallet' : t < 6.8 ? 'return-inside-wallet' : 'card-inside-wallet';
    }); stillTime = 3.1;
  } else if (kind === 'policy') {
    companion.root.position.set(-.45, 0, .20); companion.root.rotation.y = .22; companion.root.scale.setScalar(.9);
    const station = group(stage, [.85, 0, -.04]); station.name = 'policy';
    round(station, [.64, .12, .52], [0, .09, 0], .05, lilac); round(station, [.54, .52, .42], [0, .40, 0], .09, ceramic);
    const lock = group(station, [0, .98, 0]); round(lock, [.50, .42, .26], [0, 0, 0], .085, lilac);
    ball(lock, [.035, .035, .008], [0, .035, .138], ceramic); round(lock, [.025, .065, .012], [0, -.005, .14], .01, ceramic);
    const shackle = group(lock, [-.145, .18, 0]); curve(shackle, [[0, -.16, 0], [0, .25, 0], [.145, .34, 0], [.29, .25, 0], [.29, 0, 0]], .04, ceramic);
    const approval = check(station, [0, .36, .217], .60, violet);
    const payment = card(stage), cardScale = .5 * .9; payment.name = 'payment-card'; payment.scale.setScalar(cardScale);
    const rest: V3 = [.30, -.60, .74], tap: V3 = [.65, .12, .75], grip: V3 = [-.23, .02, -.035];
    companion.poseSleeve(1, tap); placeHeld(payment, companion, 1, grip, 0);
    const reader = readerAt(payment, cardScale, station, [-.24, .47, .04]);
    const correction = reader.plane - (payment.position.z - .055 * cardScale / 2);
    timers.push((time) => {
      const t = time % cycle, reach = ease((t - .5) / 1.2) * (1 - ease((t - 4) / 1.1)), open = ease((t - 2.05) / .7) * (1 - ease((t - 5.4) / .7));
      companion.poseSleeve(0, idleLeft); companion.poseSleeve(1, blend(rest, tap, reach)); placeHeld(payment, companion, 1, grip, 0); payment.position.z = Math.max(payment.position.z + correction * reach, reader.plane + .055 * cardScale / 2);
      contactGap = payment.position.z - .055 * cardScale / 2 - reader.plane; contact = t >= 1.7 && t <= 4;
      shackle.position.y = .18 + open * .105; shackle.rotation.y = open * .80; approval.visible = open > .2;
      companion.lookAtPoint([reader.root.position.x, reader.root.position.y + .15, reader.root.position.z]); face(companion, t);
      receiptPhase = t < 1.7 ? 'approach-reader' : t < 2.05 ? 'card-contact' : t < 4 ? 'lock-open-after-contact' : 'withdraw-card';
    }); stillTime = 2.7;
  } else {
    companion.root.position.set(.25, 0, .20); companion.root.scale.setScalar(.9);
    const reach: V3 = [-.75, .25, Math.sqrt(1 - .75 * .75 - .25 * .25)], store: V3 = [-.75, -.12, Math.sqrt(1 - .75 * .75 - .12 * .12)];
    const rest: V3 = [-.15, -.3, .94], grip: V3 = [.15, .29, .035];
    companion.poseSleeve(0, reach);
    const slip = receipt(stage, .22, .29); slip.name = 'active-paper'; slip.scale.setScalar(.9); placeHeld(slip, companion, 0, grip, 0);
    const feedBase = slip.position.clone(), clipping = paperFeed(slip, feedBase.y);
    const printer = group(stage, [feedBase.x - .25, 0, feedBase.z - .12]); printer.name = 'printer';
    round(printer, [.88, .30, .62], [0, .22, 0], .10, ceramic); round(printer, [.82, .07, .56], [0, .08, 0], .03, violet);
    round(printer, [.76, .05, .49], [0, .395, -.015], .025, pearl); round(printer, [.34, .025, .065], [.25, feedBase.y, .12], .01, dark);
    ball(printer, [.025, .012, .025], [-.26, .425, -.15], green);
    companion.root.rotation.y = Math.PI; companion.poseSleeve(0, store); placeHeld(slip, companion, 0, grip, Math.PI);
    const storedAt = slip.position.clone();
    const bag = openContainer(stage, [storedAt.x, .25, storedAt.z], .44, .50, .12); bag.name = 'bag';
    curve(bag, [[-.12, .24, .075], [-.12, .34, .12], [.12, .34, .12], [.12, .24, .075]], .018, violet);
    const kept = receipt(stage, .22, .29); kept.name = 'stored-paper'; kept.scale.setScalar(.9); kept.position.copy(storedAt); kept.rotation.y = Math.PI;
    timers.push((time) => {
      const t = time % cycle, turn = ease((t - 3.5) / 1.8) * (1 - ease((t - 8) / 1.4));
      companion.root.rotation.y = Math.PI * turn; companion.poseSleeve(1, idleRight);
      companion.poseSleeve(0, path(t, [[0, rest], [.9, rest], [1.8, [-.65, .3, .70]], [2.6, reach], [5.3, reach], [6.3, store], [6.8, store], [7.6, [-.65, .40, .65]], [9.4, [-.65, .40, .65]], [10, rest]]));
      const feed = ease(t / 1.8); printedHeight = .29 * .9 * feed; clipping(t < 2.6); slip.visible = t < 6.8;
      if (t < 2.6) { slip.position.copy(feedBase); slip.position.y -= .29 * .9 * (1 - feed); slip.rotation.y = 0; }
      else placeHeld(slip, companion, 0, grip, companion.root.rotation.y);
      kept.visible = t < 3.5 || t >= 6.8;
      companion.lookAtPoint(t < 3.5 ? [feedBase.x, feedBase.y + .25, feedBase.z] : [storedAt.x, .65, storedAt.z]); face(companion, t);
      paperOwner = t < 2.6 ? 'printer' : t < 6.8 ? 'agent' : 'bag'; receiptPhase = t < 2.6 ? 'print-outward' : t < 5.3 ? 'grasp-and-turn' : t < 6.8 ? 'place-in-bag' : 'stored-in-bag';
    }); stillTime = 3;
  }
  function update(time: number) {
    contact = false; contactGap = null; concealedFraction = null; printedHeight = 0; paperOwner = null;
    timers.forEach(animate => animate(time));
  }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, alive = true, unavailable = false, frame = 0, elapsed = 0, last = performance.now();
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
    const aspect = width / height, halfHeight = kind === 'hero' ? 1.48 : 1.55;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); update(stillPose ?? (motion.matches ? stillTime : elapsed)); renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibility = new IntersectionObserver(entries => { visible = entries[entries.length - 1]?.isIntersecting ?? false; last = performance.now(); }, { threshold: .01 }); visibility.observe(host);
  const draw = (now: number) => {
    if (!alive) return; frame = requestAnimationFrame(draw);
    if (!visible || unavailable || document.hidden || motion.matches || stillPose !== undefined) { last = now; return; }
    elapsed = (elapsed + Math.min((now - last) / 1000, .06)) % (cycle * 100); last = now; update(elapsed); renderer.render(scene, camera);
  };
  const changeMotion = () => { update(stillPose ?? (motion.matches ? stillTime : elapsed)); renderer.render(scene, camera); };
  const contextLost = (event: Event) => { event.preventDefault(); unavailable = true; onUnavailable(); };
  const contextRestored = () => { unavailable = false; resize(); onReady(); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  renderer.domElement.addEventListener('webglcontextrestored', contextRestored);
  motion.addEventListener('change', changeMotion); resize(); onReady(); frame = requestAnimationFrame(draw);
  const dispose = () => {
    alive = false; cancelAnimationFrame(frame); resizeObserver.disconnect(); visibility.disconnect(); motion.removeEventListener('change', changeMotion);
    scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); materials.forEach(value => { value.map?.dispose(); value.dispose(); });
    renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.domElement.removeEventListener('webglcontextrestored', contextRestored);
    shadowMaterial.dispose(); shadowTexture.dispose(); environmentMap.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
  return Object.assign(dispose, { renderPose: (time: number) => { update(time); renderer.render(scene, camera); return { receiptPhase, cycle, agentCount: agents.length, contact, cardReaderGap: contactGap, concealedFraction, printedHeight, paperOwner, sleeveLengths: agents.flatMap(agent => agent.armJoints.map(([a, b]) => a.distanceTo(b))), limbDesign: 'single-sleeve', palette: 'white-black-light-purple', clouds: 0 }; } });
}
