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
  let emotion = 0;
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
  camera.lookAt(0, 1.35, 0);
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
  const ceramic = material('#fffaf3', .25), pearl = material('#d8d5e1', .32), lilac = material('#c6b5ef', .34), violet = material('#806697', .43);
  const dark = material('#181b25', .4, .02), lens = material('#111723', .27, 0, { clearcoat: .8 });
  const gold = material('#dfca9a', .34, .6), ink = material('#797086', .65);
  const paper = material('#fffdf4', .78, 0, { clearcoat: 0, side: THREE.DoubleSide });
  const green = material('#c1d9c0', .35, 0, { emissive: '#93af8f', emissiveIntensity: .15 });
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
  const contactPositions: Record<SceneKind, V3[]> = { hero: [[-1.12, 0, .05], [1.29, 0, -.05]], wallet: [[.5, 0, .22], [-.85, 0, .5]], policy: [[-1.05, 0, .1], [1.25, 0, .1]], receipt: [[.85, 0, .25], [-.85, 0, .45]] };
  const contactShadows: THREE.Mesh[] = [];
  for (const position of contactPositions[kind]) {
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.9), shadowMaterial);
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
    const root = group(parent); round(root, [.88, .62, .07], [0, 0, -.085], .1, violet);
    round(root, [.8, .54, .012], [0, .025, -.044], .065, dark);
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
    const cream = new THREE.MeshPhysicalMaterial({ color: 0xffeee5, metalness: .03, roughness: .3, clearcoat: .8 });
    const rose = new THREE.MeshPhysicalMaterial({ color: 0xc890a2, metalness: .08, roughness: .34, clearcoat: .65 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x191821, roughness: .2 });
    const lit = new THREE.MeshStandardMaterial({ color: 0xffc6df, emissive: 0xa43d78, emissiveIntensity: .6 });
    materials.push(cream, rose, screen, lit);
    const robotBox = (parent: THREE.Object3D, size: V3, position: V3, mat: Material, radius: number) =>
      mesh(parent, new RoundedBoxGeometry(...size.map(v => v * unit) as V3, 5, Math.min(radius, ...size.map(v => v / 3)) * unit), mat, position.map(v => v * unit) as V3);
    const feet: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const foot = group(root); feet.push(foot);
      mesh(foot, new THREE.CylinderGeometry(.07 * unit, .075 * unit, .31 * unit, 10), rose, [side * .2 * unit, .315 * unit, 0]);
      robotBox(foot, [.25, .12, .38], [side * .2, .07, .055], cream, .05);
    }
    robotBox(root, [.67, .42, .56], [0, .63, 0], rose, .12);
    robotBox(root, [.22, .09, .035], [0, .66, .3], cream, .02);
    robotBox(root, [.24, .08, .24], [0, .855, 0], cream, .035);
    const headRestY = 1.23 * unit, head = group(root, [0, headRestY, 0]); head.name = 'head';
    robotBox(head, [1.02, .75, .76], [0, 0, 0], cream, .2);
    robotBox(head, [.84, .48, .07], [0, 0, .395], screen, .14);
    const pupils = group(head), eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) eyes.push(robotBox(pupils, [.095, .16, .025], [side * .2, .055, .44], lit, .035));
    const mouth = group(head, [0, -.12 * unit, .44 * unit]);
    robotBox(mouth, [.15, .025, .02], [0, -.015, 0], lit, .008);
    for (const side of [-1, 1]) robotBox(mouth, [.075, .025, .02], [side * .095, .005, 0], lit, .008).rotation.z = side * .55;
    mesh(head, new THREE.CylinderGeometry(.025 * unit, .025 * unit, .17 * unit, 8), rose, [0, .45 * unit, 0]);
    mesh(head, new THREE.SphereGeometry(.065 * unit, 12, 8), lit, [0, .56 * unit, 0]);
    const pocketSide = kind === 'receipt' ? -1 : 1;
    const pocket = group(root, [pocketSide * .28, .46, -.32]); pocket.visible = kind === 'receipt';
    round(pocket, [.28, .23, .035], [0, 0, 0], .035, rose);
    round(pocket, [.28, .20, .035], [0, -.015, -.10], .035, rose);
    for (const side of [-1, 1]) round(pocket, [.025, .19, .10], [side * .127, -.015, -.05], .01, rose);
    round(pocket, [.25, .025, .10], [0, -.105, -.05], .01, rose);
    const hands: THREE.Group[] = [], sleeves: THREE.Group[] = [], armJoints: THREE.Vector3[][] = [];
    const sleeveLength = .32;
    for (const side of [-1, 1]) {
      const sleeve = group(root, [side * .41 * unit, .73 * unit, 0]); sleeves.push(sleeve);
      round(sleeve, [.145, .265, .16], [0, -.12, 0], .055, cream);
      const hand = group(sleeve, [0, -sleeveLength, 0]); hands.push(hand);
      round(hand, [.15, .13, .17], [0, .015, 0], .05, rose);
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
      const target = root.worldToLocal(new THREE.Vector3(...world)).sub(head.position);
      const yaw = THREE.MathUtils.clamp(Math.atan2(target.x, target.z), -.65, .65);
      const pitch = THREE.MathUtils.clamp(Math.atan2(-target.y, Math.hypot(target.x, target.z)) * .42, -.2, .34);
      head.rotation.set(pitch, yaw, -yaw * .04); pupils.position.set(yaw * .075, -pitch * .045, 0);
    }
    return { root, head, headRestY, eyes, hands, feet, armJoints, poseSleeve, lookAtPoint, mouth };
  }
  function receipt(parent: THREE.Object3D, width = .55, height = .85) {
    const root = group(parent), shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
    for (let i = 0; i <= 10; i++) shape.lineTo(width / 2 - width * i / 10, height - (i % 2) * .035);
    shape.closePath(); const sheet = mesh(root, new THREE.ShapeGeometry(shape, 8), paper), positions = sheet.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getY(i) / height * Math.PI) * height * .08);
    sheet.geometry.computeVertexNormals(); check(root, [0, height * .76, .065], .7, violet);
    for (let i = 0; i < 4; i++) { const y = height * .17 + i * .095; round(root, [width * (i === 3 ? .35 : .58), .012, .008], [-.025, y, Math.sin(y / height * Math.PI) * height * .08 + .009], .004, ink); }
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
  function terminal(parent: THREE.Object3D) {
    const root = group(parent); round(root, [1.05, 1.95, .78], [0, 1.08, 0], .19, ceramic);
    round(root, [.92, .13, .7], [0, .12, 0], .065, violet);
    round(root, [.8, .58, .075], [0, 1.56, .4], .1, pearl); round(root, [.69, .46, .06], [0, 1.57, .446], .07, lens);
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 192;
    const context = canvas.getContext('2d')!; context.fillStyle = '#121722'; context.fillRect(0, 0, 384, 192);
    context.fillStyle = '#f3eaff'; context.font = '500 72px monospace'; context.textAlign = 'center'; context.fillText('API', 192, 120);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const display = material('#ffffff', .5, 0, { map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: .3 });
    mesh(root, new THREE.PlaneGeometry(.58, .3), display, [0, 1.57, .479]);
    round(root, [.46, .34, .06], [0, 1.01, .42], .08, lilac);
    for (let i = 0; i < 3; i++) curve(root, [[-.07 + i * .045, .96 - i * .022, .457], [-.035 + i * .045, 1.01, .461], [-.07 + i * .045, 1.06 + i * .022, .457]], .008, ceramic);
    round(root, [.63, .055, .035], [0, .67, .412], .022, dark);
    for (let i = 0; i < 5; i++) round(root, [.36, .022, .016], [-.055, .27 + i * .052, .401], .01, pearl);
    const lamp = ball(root, [.035, .035, .016], [.32, .42, .41], lilac);
    for (const x of [-.35, .35]) for (const z of [-.22, .22]) round(root, [.14, .13, .14], [x, .04, z], .055, dark);
    return { root, lamp };
  }

  const companion = character(stage), timers: ((time: number) => void)[] = [];
  const worldPoint = (point: V3): V3 => { companion.root.updateWorldMatrix(true, false); const p = companion.root.localToWorld(new THREE.Vector3(...point)); return [p.x, p.y, p.z]; };
  const palmPoint = (index: number) => { companion.root.updateWorldMatrix(true, true); return companion.hands[index].getWorldPosition(new THREE.Vector3()); };
  const placeInPalm = (object: THREE.Object3D, index: number, grip: V3, yaw = 0) => {
    object.rotation.set(0, companion.root.rotation.y + yaw, 0);
    object.position.copy(palmPoint(index)).sub(new THREE.Vector3(...grip).applyEuler(object.rotation));
  };
  const path = (time: number, keys: [number, V3][]) => {
    for (let i = 1; i < keys.length; i++) if (time <= keys[i][0]) return blend(keys[i - 1][1], keys[i][1], (time - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]));
    return keys[keys.length - 1][1];
  };
  const restLeft: V3 = [-.10, -1, .12], restRight: V3 = [.10, -1, .12];
  const spriteMaterials: THREE.SpriteMaterial[] = [];
  const bubbleCanvas = document.createElement('canvas'); bubbleCanvas.width = 256; bubbleCanvas.height = 192;
  const bubbleContext = bubbleCanvas.getContext('2d')!;
  bubbleContext.fillStyle = '#fff8f0'; bubbleContext.beginPath(); bubbleContext.roundRect(20, 16, 216, 130, 60); bubbleContext.fill();
  bubbleContext.beginPath(); bubbleContext.arc(67, 153, 15, 0, TAU); bubbleContext.arc(47, 179, 7, 0, TAU); bubbleContext.fill();
  bubbleContext.strokeStyle = '#af8194'; bubbleContext.lineWidth = 10; bubbleContext.lineCap = 'round'; bubbleContext.lineJoin = 'round';
  bubbleContext.beginPath();
  if (kind === 'wallet') { bubbleContext.roundRect(89, 48, 80, 62, 12); bubbleContext.moveTo(139, 69); bubbleContext.lineTo(170, 69); bubbleContext.lineTo(170, 91); bubbleContext.lineTo(139, 91); bubbleContext.closePath(); }
  else if (kind === 'receipt') { bubbleContext.moveTo(91, 52); bubbleContext.lineTo(165, 52); bubbleContext.lineTo(165, 113); bubbleContext.lineTo(91, 113); bubbleContext.closePath(); bubbleContext.moveTo(108, 72); bubbleContext.lineTo(147, 72); bubbleContext.moveTo(108, 91); bubbleContext.lineTo(136, 91); }
  else if (kind === 'policy') { bubbleContext.moveTo(91, 78); bubbleContext.lineTo(117, 102); bubbleContext.lineTo(166, 53); }
  else { for (const x of [93, 128, 163]) { bubbleContext.moveTo(x + 5, 80); bubbleContext.arc(x, 80, 5, 0, TAU); } }
  bubbleContext.stroke();
  const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas); bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  const bubbleMaterial = new THREE.SpriteMaterial({ map: bubbleTexture, transparent: true, depthWrite: false, toneMapped: false }); spriteMaterials.push(bubbleMaterial);
  const thought = new THREE.Sprite(bubbleMaterial); thought.scale.set(.66, .50, 1); stage.add(thought);
  const mood = (time: number, pleased: number) => {
    emotion = pleased; companion.mouth.scale.set(1 + pleased * .12, 1 + pleased * .30, 1);
    thought.position.set(companion.root.position.x - .32, 2.03 + Math.sin(time * .8) * .025, companion.root.position.z);
    thought.material.opacity = .68 + pleased * .26;
    companion.feet.forEach(foot => { foot.position.y = 0; });
    contactShadows[0].position.x = companion.root.position.x; contactShadows[0].position.z = companion.root.position.z;
  };
  const cycle = kind === 'receipt' ? 10 : 8;
  let stillTime = 3.5;
  if (kind === 'hero') {
    const machine = terminal(stage); machine.root.name = 'terminal'; machine.root.scale.setScalar(.75); machine.root.position.set(.84, 0, .08);
    const purse = wallet(companion.root); purse.name = 'wallet'; purse.scale.setScalar(.48); purse.position.set(-.25, .47, .39);
    const tucked = card(purse); tucked.scale.setScalar(.70); tucked.position.set(0, .23, .016);
    const payment = card(stage); payment.scale.setScalar(.50);
    timers.push((time) => {
      const t = time % cycle, present = ease((t - .8) / 1.4) * (1 - ease((t - 5.5) / 1.6));
      companion.root.position.set(-.52 + present * .32, 0, .22); companion.root.rotation.y = .06 + present * .12;
      companion.poseSleeve(0, [-.12, -.65, .75]);
      companion.poseSleeve(1, blend([.18, -.85, .49], [.14, .16, .98], present));
      placeInPalm(payment, 1, [-.17, .02, -.04]);
      machine.lamp.material = present > .9 ? green : lilac;
      companion.lookAtPoint([.84, 1.0, .45]); mood(t, present); receiptPhase = 'card-presented';
    });
  } else if (kind === 'wallet') {
    const purse = wallet(companion.root); purse.name = 'wallet'; purse.position.set(0, .48, .43); purse.scale.setScalar(.68);
    const payment = card(purse); payment.scale.setScalar(.78); payment.position.set(-.04, .22, .014);
    timers.push((time) => {
      const t = time % cycle, inspect = .5 - .5 * Math.cos(t / cycle * TAU);
      companion.root.position.set(0, 0, .2); companion.root.rotation.y = -.12 + inspect * .15;
      companion.poseSleeve(0, [-.12, -.40, .91]); companion.poseSleeve(1, [.12, -.40, .91]);
      purse.rotation.x = -.04 * inspect; payment.position.y = .22 + .035 * inspect;
      companion.lookAtPoint(worldPoint([0, .65, .95])); mood(t, inspect); receiptPhase = 'wallet-check';
    });
  } else if (kind === 'policy') {
    const station = group(stage, [.83, 0, .02]); station.name = 'policy'; station.scale.setScalar(.74);
    round(station, [1.1, .23, .92], [0, .13, 0], .11, lilac); round(station, [.85, .74, .65], [0, .59, 0], .17, ceramic);
    round(station, [.63, .08, .045], [0, .65, .342], .035, dark);
    const approved = check(station, [0, .38, .337], .8, violet), lock = group(station, [0, 1.55, 0]);
    round(lock, [.84, .7, .42], [0, 0, 0], .17, lilac); ball(lock, [.065, .065, .012], [0, .055, .219], ceramic); round(lock, [.055, .13, .025], [0, -.025, .216], .025, ceramic);
    const shackle = group(lock, [-.25, .29, 0]); curve(shackle, [[0, 0, 0], [0, .33, 0], [.25, .5, 0], [.5, .33, 0], [.5, 0, 0]], .065, ceramic);
    const payment = card(stage); payment.scale.setScalar(.5);
    timers.push((time) => {
      const t = time % cycle, present = ease((t - .8) / 1.4) * (1 - ease((t - 5.4) / 1.6)), open = ease((t - 2.5) / .8) * (1 - ease((t - 5) / .8));
      companion.root.position.set(-.45 + present * .18, 0, .28); companion.root.rotation.y = .16;
      companion.poseSleeve(0, restLeft); companion.poseSleeve(1, blend([.18, -.85, .49], [.14, .16, .98], present));
      placeInPalm(payment, 1, [-.17, .02, -.04]);
      shackle.rotation.y = -open * .8; shackle.position.y = .29 + open * .14; approved.visible = open > .2;
      companion.lookAtPoint([.83, 1.2, .1]); mood(t, open); receiptPhase = 'policy-check';
    });
  } else {
    companion.root.position.set(.42, 0, .55); companion.root.rotation.y = -.25;
    const receiptRest: V3 = [0, .08, .997];
    const ready: V3 = [-.65, .3, .70], reach: V3 = [-.94, .32, .10], back: V3 = [0, 0, -1];
    companion.poseSleeve(0, reach);
    const grip: V3 = [-.10, .29, .055];
    const feedBase = palmPoint(0).sub(new THREE.Vector3(...grip).applyAxisAngle(new THREE.Vector3(0, 1, 0), -.25));
    const printer = group(stage, [feedBase.x - .12, 0, feedBase.z - .12]); printer.name = 'printer';
    round(printer, [.88, .40, .68], [0, .25, 0], .12, ceramic); round(printer, [.82, .09, .62], [0, .09, 0], .04, violet);
    round(printer, [.76, .07, .52], [0, .47, -.02], .035, pearl); round(printer, [.52, .035, .07], [.08, .516, .12], .015, dark);
    for (const x of [-.30, .30]) for (const z of [-.22, .22]) ball(printer, [.055, .055, .055], [x, .055, z], dark);
    ball(printer, [.03, .015, .03], [.29, .515, -.15], green);
    const slip = receipt(stage, .22, .29); slip.name = 'active-paper'; const clipFeed = paperFeed(slip, feedBase.y);
    const stored = receipt(companion.root, .22, .29); stored.name = 'stored-paper'; stored.position.set(-.2895, .4035, -.375); stored.visible = true;
    timers.push((time) => {
      const t = time % cycle, turn = ease((t - 4.3) / 1.4) * (1 - ease((t - 8.2) / 1.4));
      companion.root.position.set(.42 + turn * .16, 0, .55); companion.root.rotation.y = -.25 - turn * 2.05;
      companion.poseSleeve(1, restRight);
      companion.poseSleeve(0, path(t, [[0, receiptRest], [1.2, receiptRest], [2, ready], [2.8, reach], [4.3, reach], [5.1, [-.75, .1, -.65]], [5.8, back], [6.6, back], [7.4, [-.28, -.5, -.82]], [8.1, receiptRest], [10, receiptRest]]));
      const feed = ease(t / 1.7);
      clipFeed(t < 2.8); slip.visible = t < 6.6;
      if (t < 2.8) { slip.position.copy(feedBase); slip.position.y -= .29 * (1 - feed); slip.rotation.set(0, -.25, 0); }
      else placeInPalm(slip, 0, grip);
      stored.visible = t < 4.3 || t >= 6.6;
      companion.lookAtPoint(t < 4.3 ? [feedBase.x, feedBase.y + .29, feedBase.z] : worldPoint([0, 1.0, 2]));
      mood(t, ease((t - 2.8) / 1.5)); receiptPhase = t < 2.8 ? 'printing' : t < 5.8 ? 'taking-to-pocket' : 'stored';
    }); stillTime = 3.5;
  }
  function update(time: number) {

    timers.forEach(animate => animate(time)); companion.head.position.y = companion.headRestY + Math.sin(time * 1.5) * .018;
    const blink = Math.pow(Math.max(0, Math.cos(time * 1.17)), 60); companion.eyes.forEach(eye => { eye.scale.y = (1 - blink * .92) * (1 - emotion * .16); });
  }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true, alive = true, unavailable = false, frame = 0, elapsed = 0, last = performance.now();
  const resize = () => {
    const width = host.clientWidth, height = host.clientHeight; if (!width || !height) return;
    const aspect = width / height, halfHeight = kind === 'hero' ? 2.12 : 1.95;
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); update(stillPose ?? (motion.matches ? stillTime : elapsed)); renderer.render(scene, camera);
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const visibility = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? false; last = performance.now(); }, { threshold: .01 }); visibility.observe(host);
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
    spriteMaterials.forEach(value => value.dispose()); bubbleTexture.dispose(); shadowMaterial.dispose(); shadowTexture.dispose(); environmentMap.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
  return Object.assign(dispose, { renderPose: (time: number) => { update(time); renderer.render(scene, camera); return { receiptPhase, bodyYaw: companion.root.rotation.y, headYaw: companion.head.rotation.y, sleeveLengths: companion.armJoints.map(([a, b]) => a.distanceTo(b)), sleeveCount: 2, limbDesign: 'single-sleeve' }; } });
}
