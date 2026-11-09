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
  let maxReachError = 0;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x101112, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
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
    const root = group(parent); round(root, [.88, .62, .19], [0, 0, -.055], .1, violet);
    round(root, [.8, .54, .07], [0, .025, .048], .065, dark);
    round(root, [.9, .45, .12], [0, -.105, .105], .085, lilac);
    curve(root, [[-.36, .04, .169], [-.12, -.015, .17], [.12, -.015, .17], [.36, .04, .169]], .008, pearl);
    for (let i = 0; i < 16; i++) rod(root, [-.35 + i * .047, -.265, .17], [-.33 + i * .047, -.265, .17], .004, ceramic);
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) rod(root, [side * .39, -.23 + i * .054, .165], [side * .39, -.21 + i * .054, .165], .004, ceramic);
    round(root, [.24, .17, .06], [.34, -.065, .19], .05, violet); ball(root, [.039, .039, .012], [.36, -.065, .225], gold); return root;
  }
  function character(parent: THREE.Object3D) {
    const root = group(parent), unit = 1.75;
    const cream = new THREE.MeshPhysicalMaterial({ color: 0xf4d9df, metalness: .12, roughness: .32, clearcoat: .8 });
    const rose = new THREE.MeshPhysicalMaterial({ color: 0xb56e94, metalness: .35, roughness: .3, clearcoat: 1 });
    const screen = new THREE.MeshStandardMaterial({ color: 0x191821, roughness: .2 });
    const lit = new THREE.MeshStandardMaterial({ color: 0xffc6df, emissive: 0xa43d78, emissiveIntensity: .6 });
    materials.push(cream, rose, screen, lit);
    const robotBox = (parent: THREE.Object3D, size: V3, position: V3, mat: Material, radius: number) =>
      mesh(parent, new RoundedBoxGeometry(...size.map(v => v * unit) as V3, 2, Math.min(radius, ...size.map(v => v / 3)) * unit), mat, position.map(v => v * unit) as V3);
    const feet: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const foot = group(root); feet.push(foot);
      mesh(foot, new THREE.CylinderGeometry(.07 * unit, .075 * unit, .31 * unit, 10), rose, [side * .2 * unit, .315 * unit, 0]);
      robotBox(foot, [.25, .12, .38], [side * .2, .07, .055], cream, .05);
    }
    robotBox(root, [.67, .42, .56], [0, .63, 0], rose, .12);
    robotBox(root, [.22, .09, .035], [0, .66, .3], cream, .02);
    const headRestY = 1.09 * unit, head = group(root, [0, headRestY, 0]);
    robotBox(head, [1.1, .75, .76], [0, 0, 0], cream, .2);
    robotBox(head, [.88, .48, .07], [0, 0, .395], screen, .14);
    const pupils = group(head), eyes: THREE.Mesh[] = [];
    for (const side of [-1, 1]) eyes.push(robotBox(pupils, [.095, .16, .025], [side * .2, .055, .44], lit, .035));
    const mouth = group(head, [0, -.12 * unit, .44 * unit]);
    robotBox(mouth, [.15, .025, .02], [0, -.015, 0], lit, .008);
    for (const side of [-1, 1]) robotBox(mouth, [.075, .025, .02], [side * .095, .005, 0], lit, .008).rotation.z = side * .55;
    mesh(head, new THREE.CylinderGeometry(.025 * unit, .025 * unit, .17 * unit, 8), rose, [0, .45 * unit, 0]);
    mesh(head, new THREE.SphereGeometry(.065 * unit, 12, 8), lit, [0, .56 * unit, 0]);
    const hands: THREE.Group[] = [], armSegments: THREE.Mesh[][] = [];
    for (const side of [-1, 1]) {
      const hand = group(root); hands.push(hand);
      robotBox(hand, [.19, .15, .21], [0, 0, 0], rose, .055);
      armSegments.push([
        robotBox(root, [.15, .29, .17], [0, 0, 0], cream, .055),
        robotBox(root, [.15, .29, .17], [0, 0, 0], cream, .055),
      ]);
      if (side === -1) robotBox(hand, [.11, .085, .025], [0, .055, .11], lit, .02);
    }
    function poseArm(index: number, target: V3, _bendUp = false) {
      const side = index === 0 ? -1 : 1, shoulder: V3 = [side * .41 * unit, .73 * unit, 0];
      const origin = new THREE.Vector3(...shoulder), direction = new THREE.Vector3(...target).sub(origin);
      maxReachError = Math.max(maxReachError, direction.length() - 1.039);
      const distance = THREE.MathUtils.clamp(direction.length(), .04, 1.039);
      direction.normalize();
      const endpoint = origin.clone().addScaledVector(direction, distance);
      const bend = new THREE.Vector3(side * .75, -.85, -.12);
      bend.addScaledVector(direction, -bend.dot(direction)).normalize();
      const joint = origin.clone().addScaledVector(direction, distance / 2).addScaledVector(bend, Math.sqrt(.52 ** 2 - (distance / 2) ** 2));
      [[origin, joint], [joint, endpoint]].forEach(([a, b], j) => {
        const segment = armSegments[index][j];
        segment.position.copy(a).add(b).multiplyScalar(.5);
        segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      });
      hands[index].position.copy(endpoint); hands[index].rotation.set(0, 0, 0);
    }
    poseArm(0, [-.75, .72, .15]); poseArm(1, [.75, .72, .15]);
    function lookAtPoint(world: V3) {
      root.updateWorldMatrix(true, false);
      const target = root.worldToLocal(new THREE.Vector3(...world)).sub(head.position);
      const yaw = THREE.MathUtils.clamp(Math.atan2(target.x, Math.max(.5, target.z)) * .34, -.28, .28);
      const pitch = THREE.MathUtils.clamp(Math.atan2(-target.y, Math.hypot(target.x, target.z)) * .16, -.1, .14);
      head.rotation.set(pitch, yaw, -yaw * .04); pupils.position.set(yaw * .075, -pitch * .045, 0);
    }
    return { root, head, headRestY, eyes, hands, feet, poseArm, lookAtPoint };
  }
  function receipt(parent: THREE.Object3D, width = .55, height = .85) {
    const root = group(parent), shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0);
    for (let i = 0; i <= 10; i++) shape.lineTo(width / 2 - width * i / 10, height - (i % 2) * .035);
    shape.closePath(); const sheet = mesh(root, new THREE.ShapeGeometry(shape, 8), paper), positions = sheet.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getY(i) / height * Math.PI) * .07);
    sheet.geometry.computeVertexNormals(); check(root, [0, height * .76, .065], .7, violet);
    for (let i = 0; i < 4; i++) { const y = height * .17 + i * .095; round(root, [width * (i === 3 ? .35 : .58), .012, .008], [-.025, y, Math.sin(y / height * Math.PI) * .07 + .009], .004, ink); }
    return root;
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
  const holdAt = (index: number, object: THREE.Object3D, point: V3) => {
    stage.updateMatrixWorld(true);
    const position = object.localToWorld(new THREE.Vector3(...point));
    companion.root.worldToLocal(position);
    companion.poseArm(index, [position.x, position.y, position.z], true);
  };
  const worldPoint = (point: V3): V3 => { companion.root.updateWorldMatrix(true, false); const p = companion.root.localToWorld(new THREE.Vector3(...point)); return [p.x, p.y, p.z]; };
  const walk = (phase: number) => {
    companion.feet.forEach((foot, index) => { foot.position.y = phase < 0 ? 0 : Math.max(0, Math.sin(phase * TAU + index * Math.PI)) * .1; });
    contactShadows[0].position.x = companion.root.position.x; contactShadows[0].position.z = companion.root.position.z;
  };
  const cycle = kind === 'hero' ? 10 : 7;
  let stillTime = 4.6;
  if (kind === 'hero') {
    companion.root.position.set(-1.12, 0, .05); companion.root.rotation.y = .12;
    const purse = wallet(companion.root); purse.position.set(-.18, .75, .82);
    const payment = card(stage), machine = terminal(stage); machine.root.position.set(1.29, 0, -.05); machine.root.rotation.y = -.1;
    const slip = receipt(stage); slip.position.set(1.24, .68, .43);
    const home: V3 = [-.03, 1.0, .86], cleared: V3 = [-.03, 1.28, .86], lifted: V3 = [.35, 1.28, .86], tap: V3 = [.98, 1.1, .56];
    const cardGrip: V3 = [.465, 0, .06], receiptGrip: V3 = [-.21, .4, .19];
    timers.push((time) => {
      const t = time % 10, approach = ease((t - 1.5) / 1.7) * (1 - ease((t - 8.6) / 1.4));
      companion.root.position.set(-1.12 + approach, 0, .05 + approach * .13);
      companion.head.position.x = -approach * .34;
      walk(t >= 1.5 && t < 3.2 ? (t - 1.5) / 1.7 : t >= 8.6 ? (t - 8.6) / 1.4 : -1);
      companion.poseArm(0, [-.80, .72, .81]);
      const homeWorld = worldPoint(home), clearWorld = worldPoint(cleared), liftWorld = worldPoint(lifted); let target = homeWorld;
      if (t < .9) target = blend(homeWorld, clearWorld, t / .9);
      else if (t < 1.5) target = blend(clearWorld, liftWorld, (t - .9) / .6);
      else if (t < 2.2) target = liftWorld;
      else if (t < 3.4) target = blend(liftWorld, tap, (t - 2.2) / 1.2);
      else if (t < 4.7) target = tap;
      else if (t < 5.4) target = blend(tap, liftWorld, (t - 4.7) / .7);
      else if (t < 5.8) target = liftWorld;
      else if (t < 6.1) target = blend(liftWorld, clearWorld, (t - 5.8) / .3);
      else if (t < 6.6) target = blend(clearWorld, homeWorld, (t - 6.1) / .5);
      payment.position.set(...target); payment.rotation.set(0, .12, 0);
      holdAt(1, payment, cardGrip); companion.hands[1].rotation.y = payment.rotation.y - companion.root.rotation.y;
      const receive = ease((t - 7.5) / 1.1);
      slip.scale.y = (.03 + .97 * ease((t - 4.1) / 1.3)) * (1 - ease((t - 9.1) / .9));
      slip.position.set(...blend([1.24, .68, .45], worldPoint([1.12, .77, .65]), receive)); slip.rotation.z = receive * -.08;
      if (t > 7.3) {
        holdAt(1, slip, receiptGrip);
        if (t > 9.1) {
          const p = companion.hands[1].position;
          companion.poseArm(1, blend([p.x, p.y, p.z], [home[0] + cardGrip[0], home[1], home[2] + cardGrip[2]], (t - 9.1) / .9));
        }
      } else if (t > 6.6) {
        stage.updateMatrixWorld(true);
        const destination = companion.root.worldToLocal(slip.localToWorld(new THREE.Vector3(...receiptGrip)));
        companion.poseArm(1, blend([home[0] + cardGrip[0], home[1], home[2] + cardGrip[2]], [destination.x, destination.y, destination.z], (t - 6.6) / .7));
      }
      machine.lamp.material = t > 3.4 && t < 6 ? green : lilac;
      companion.lookAtPoint(t < 6.6 ? target : [slip.position.x, slip.position.y + .45, slip.position.z]);
    });
  } else if (kind === 'wallet') {
    companion.root.position.set(.85, 0, .4); companion.root.rotation.y = -.1;
    const purse = wallet(stage); purse.position.set(-.85, .8, .5); purse.scale.setScalar(1.6);
    const payment = card(stage); payment.scale.setScalar(1.35);
    timers.push((time) => {
      const lift = .5 - .5 * Math.cos((time % 7) / 7 * TAU);
      payment.position.set(-1.12, 1.2 + lift * .40, .65);
      holdAt(0, payment, [.4, .13, .14]); companion.poseArm(1, [.67, .92, .2]);
      companion.lookAtPoint([payment.position.x, payment.position.y, payment.position.z]); walk(-1);
    }); stillTime = 3.5;
  } else if (kind === 'policy') {
    companion.root.position.set(-1.05, 0, .1); companion.root.scale.setScalar(.95); companion.root.rotation.y = .14;
    const station = group(stage, [1.25, 0, .1]); round(station, [1.1, .23, .92], [0, .13, 0], .11, lilac);
    round(station, [.85, .74, .65], [0, .59, 0], .17, ceramic); round(station, [.63, .08, .045], [0, .65, .342], .035, dark);
    const approved = check(station, [0, .38, .337], .8, violet), lock = group(station, [0, 1.55, 0]);
    round(lock, [.84, .7, .42], [0, 0, 0], .17, lilac); ball(lock, [.065, .065, .012], [0, .055, .219], ceramic);
    round(lock, [.055, .13, .025], [0, -.025, .216], .025, ceramic);
    const shackle = group(lock, [-.25, .29, 0]); curve(shackle, [[0, 0, 0], [0, .33, 0], [.25, .5, 0], [.5, .33, 0], [.5, 0, 0]], .065, ceramic);
    const payment = card(stage);
    timers.push((time) => {
      const t = time % 7, present = ease((t - .8) / 1.5) * (1 - ease((t - 4.8) / 1.7)), open = ease((t - 2.5) / .7) * (1 - ease((t - 4.5) / .8));
      companion.root.position.set(-1.05 + present * .60, 0, .1 + present * .15);
      walk(t >= .8 && t < 2.3 ? (t - .8) / 1.5 : t >= 4.8 && t < 6.5 ? (t - 4.8) / 1.7 : -1);
      payment.position.set(...blend(worldPoint([.65, 1.25, .55]), [1.08, 1.1, .67], present)); payment.rotation.set(0, .1, 0);
      holdAt(1, payment, [-.38, .13, .19]); companion.poseArm(0, [-.65, 1.02, .25]);
      shackle.rotation.y = -open * .9; shackle.position.y = .29 + open * .15; approved.scale.setScalar(.8 + open * .12); approved.visible = t > 2.3 && t < 5.2;
      companion.lookAtPoint(blend([payment.position.x, payment.position.y, payment.position.z], [1.25, 1.7, .1], open));
    }); stillTime = 3.6;
  } else {
    companion.root.position.set(.85, 0, .25); companion.root.scale.setScalar(.95); companion.root.rotation.y = -.14;
    const printer = group(stage, [-.85, 0, .45]); printer.rotation.y = -.12;
    round(printer, [1.45, .85, 1.1], [0, .55, 0], .22, ceramic); round(printer, [1.34, .13, 1], [0, .17, 0], .065, violet);
    round(printer, [1.2, .12, .72], [0, 1, -.08], .055, pearl); round(printer, [1.01, .07, .08], [0, 1.068, .2], .03, dark);
    round(printer, [.92, .045, .05], [0, .5, .56], .018, pearl); ball(printer, [.06, .025, .06], [.47, 1.074, -.24], lilac); ball(printer, [.021, .01, .021], [.47, 1.1, -.24], green);
    for (let i = 0; i < 5; i++) round(printer, [.24, .018, .012], [.35, .64 + i * .045, .55], .006, pearl);
    const slip = receipt(stage, .82, 1.14); slip.rotation.set(-.2, -.12, 0);
    for (const x of [-.5, .5]) for (const z of [-.32, .32]) ball(printer, [.1, .1, .1], [x, .08, z], dark);
    timers.push((time) => {
      const t = time % 7, feed = ease(t / 3), take = ease((t - 3.3) / 1.2), reset = ease((t - 5.8) / 1.2);
      const approach = ease((t - 1.3) / 1.3) * (1 - ease((t - 5.2) / 1.5));
      companion.root.position.set(.85 - approach * .15, 0, .25 + approach * .2);
      walk(t >= 1.3 && t < 2.6 ? (t - 1.3) / 1.3 : t >= 5.2 && t < 6.7 ? (t - 5.2) / 1.5 : -1);
      slip.scale.y = (.1 + feed * .9) * (1 - reset);
      slip.position.set(...blend([-.874, 1.08, .648], worldPoint([-1.45, 1.21, .65]), take));
      slip.rotation.set(-.2 * (1 - take), -.12, -.035 * take);
      const rest: V3 = [-.65, 1.02, .25], raised: V3 = [-.9, 1.3, .35];
      if (t < 1.6) companion.poseArm(0, blend(rest, raised, (t - .8) / .8), true);
      else {
        stage.updateMatrixWorld(true);
        const grip = companion.root.worldToLocal(slip.localToWorld(new THREE.Vector3(.51, .5, .19)));
        const reach = blend(raised, [grip.x, grip.y, grip.z], (t - 1.6) / 1.3);
        companion.poseArm(0, blend(reach, rest, reset), true);
      }
      companion.poseArm(1, [.65, 1.02, .25]);
      companion.lookAtPoint([slip.position.x, slip.position.y + .6 * slip.scale.y, slip.position.z]);
    }); stillTime = 4.1;
  }
  function update(time: number) {
    maxReachError = 0;
    timers.forEach(animate => animate(time)); companion.head.position.y = companion.headRestY + Math.sin(time * 1.5) * .018;
    const blink = Math.pow(Math.max(0, Math.cos(time * 1.17)), 60); companion.eyes.forEach(eye => { eye.scale.y = 1 - blink * .92; });
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
    shadowMaterial.dispose(); shadowTexture.dispose(); environmentMap.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
  return Object.assign(dispose, { renderPose: (time: number) => { update(time); renderer.render(scene, camera); return { maxReachError }; } });
}
