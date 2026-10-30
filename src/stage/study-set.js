import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ANCHORS, TARGET_HEIGHT } from "/src/study-layout.mjs";
import { drawAi, drawClock, drawLaptop, drawPaper, drawPhone } from "/src/stage/screens.js";

const FURN = "assets/models/furniture";

const PROP = {
  floor: `${FURN}/floorFull.glb`,
  wall: `${FURN}/wall.glb`,
  window: `${FURN}/wallWindow.glb`,
  bed: `${FURN}/bedSingle.glb`,
  shelf: `${FURN}/bookcaseOpen.glb`,
  books: `${FURN}/books.glb`,
  plant: `${FURN}/pottedPlant.glb`,
  rug: `${FURN}/rugRectangle.glb`,
  desk: `${FURN}/desk.glb`,
  chair: `${FURN}/chairDesk.glb`,
  lamp: `${FURN}/lampRoundTable.glb`,
  laptop: `${FURN}/laptop.glb`,
  pillow: `${FURN}/pillowBlue.glb`,
  side: `${FURN}/sideTable.glb`,
};

export async function buildStudy(scene, bundle) {
  scene.background = new THREE.Color(0x10141c);
  addLights(scene);
  addShell(scene);

  const gltfLoader = new GLTFLoader();
  const cache = new Map();
  const loadProp = async (url) => {
    if (!cache.has(url)) cache.set(url, gltfLoader.loadAsync(`/${url}`));
    const gltf = await cache.get(url);
    return gltf.scene.clone(true);
  };

  const arch = 1.65;
  const deskScale = 2.05;
  const tile = arch;

  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      await place(await loadProp(PROP.floor), scene, {
        x: ix * tile,
        z: iz * tile,
        scale: arch,
      });
    }
  }

  await place(await loadProp(PROP.wall), scene, { x: -tile, z: -1.5 * tile, scale: arch });
  await place(await loadProp(PROP.window), scene, { x: 0, z: -1.5 * tile, scale: arch });
  await place(await loadProp(PROP.wall), scene, { x: tile, z: -1.5 * tile, scale: arch });
  await place(await loadProp(PROP.wall), scene, {
    x: -1.5 * tile,
    z: -tile,
    scale: arch,
    rotY: Math.PI / 2,
  });
  await place(await loadProp(PROP.wall), scene, {
    x: -1.5 * tile,
    z: 0,
    scale: arch,
    rotY: Math.PI / 2,
  });
  await place(await loadProp(PROP.wall), scene, {
    x: 1.5 * tile,
    z: -tile,
    scale: arch,
    rotY: -Math.PI / 2,
  });
  await place(await loadProp(PROP.wall), scene, {
    x: 1.5 * tile,
    z: 0,
    scale: arch,
    rotY: -Math.PI / 2,
  });

  await place(await loadProp(PROP.bed), scene, { x: -1.35, z: -0.15, scale: 1.05, rotY: Math.PI / 2 });
  await place(await loadProp(PROP.pillow), scene, { x: -1.35, z: -1.15, scale: 1.3, rotY: 0.2 });
  await place(await loadProp(PROP.shelf), scene, { x: 1.55, z: -1.25, scale: arch });
  await place(await loadProp(PROP.books), scene, { x: 1.55, y: 0.55 * arch, z: -1.22, scale: arch });
  await place(await loadProp(PROP.plant), scene, { x: 1.85, z: -0.35, scale: arch });
  await place(await loadProp(PROP.rug), scene, { x: 0.05, y: 0.02, z: 0.35, scale: 1.15 });
  await place(await loadProp(PROP.side), scene, { x: -1.7, z: 0.55, scale: arch, rotY: Math.PI / 2 });

  const desk = await place(await loadProp(PROP.desk), scene, {
    x: 0.02,
    z: 0.12,
    scale: deskScale,
    rotY: Math.PI,
  });
  await place(await loadProp(PROP.chair), scene, {
    x: 0.05,
    z: 0.95,
    scale: deskScale * 0.92,
    rotY: Math.PI,
  });
  const lamp = await place(await loadProp(PROP.lamp), scene, {
    x: -0.48,
    y: 0.384 * deskScale,
    z: -0.02,
    scale: deskScale,
  });
  await place(await loadProp(PROP.laptop), scene, {
    x: 0.05,
    y: 0.384 * deskScale,
    z: 0.22,
    scale: deskScale * 0.92,
    rotY: Math.PI,
  });
  await place(await loadProp(PROP.books), scene, {
    x: 0.42,
    y: 0.384 * deskScale,
    z: 0.08,
    scale: deskScale * 0.7,
    rotY: 0.4,
  });

  const lampPos = new THREE.Box3().setFromObject(lamp).getCenter(new THREE.Vector3());
  const bulb = new THREE.PointLight(0xffc98a, 6.5, 7.5, 2);
  bulb.position.set(lampPos.x, lampPos.y + 0.18, lampPos.z);
  scene.add(bulb);
  const spot = new THREE.SpotLight(0xffd7a4, 18, 8, 0.85, 0.45, 1);
  spot.position.copy(bulb.position);
  spot.target.position.set(0.05, 0.9, 0.55);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  scene.add(spot);
  scene.add(spot.target);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xf4f1e4 }),
  );
  moon.position.set(0.15, 1.85, -2.85);
  scene.add(moon);

  const screens = buildScreens();
  scene.add(screens.laptop.mesh, screens.phone.mesh, screens.paper.mesh, screens.clock.mesh, screens.ai.mesh);

  const phoneBody = new THREE.Mesh(
    new THREE.BoxGeometry(ANCHORS.phone.width + 0.03, ANCHORS.phone.height + 0.04, 0.02),
    new THREE.MeshLambertMaterial({ color: 0x242b30 }),
  );
  phoneBody.position.set(0, 0, -0.018);
  screens.phone.mesh.add(phoneBody);

  const student = await loadStudent(bundle.characters[0]);
  scene.add(student.pivot);
  scene.add(student.shadow);

  const deskRest = desk.position.clone();

  return {
    apply(frame) {
      student.apply(frame.poses.student);
      desk.position.x = deskRest.x + (frame.shake || 0);
      desk.position.y = deskRest.y + Math.abs(frame.shake || 0) * 0.25;
      screens.update(frame.screens, frame);
    },
  };
}

function addLights(scene) {
  scene.add(new THREE.AmbientLight(0x8ea4c2, 0.22));
  scene.add(new THREE.HemisphereLight(0x1c2438, 0x2a2118, 0.35));
  const windowFill = new THREE.DirectionalLight(0x9eb7e6, 0.55);
  windowFill.position.set(-0.4, 2.4, -3.2);
  scene.add(windowFill);
  const rim = new THREE.DirectionalLight(0xffe0bf, 0.35);
  rim.position.set(1.5, 2.2, 2.4);
  scene.add(rim);
  // Student faces −Z; this light sits with the close camera and lifts the face.
  const faceFill = new THREE.DirectionalLight(0xfff3e0, 1.05);
  faceFill.position.set(-0.15, 1.75, -1.7);
  scene.add(faceFill);
}

function addShell(scene) {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 32),
    new THREE.MeshLambertMaterial({ color: 0x14110e }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.04;
  ground.receiveShadow = true;
  scene.add(ground);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 14),
    new THREE.MeshLambertMaterial({ color: 0x161820, side: THREE.DoubleSide }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 2.35;
  scene.add(ceiling);
}

async function place(root, scene, { x = 0, y = 0, z = 0, scale = 1, rotY = 0 }) {
  stylize(root);
  root.scale.setScalar(scale);
  root.rotation.y = rotY;
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const centerX = (box.min.x + box.max.x) / 2;
  const centerZ = (box.min.z + box.max.z) / 2;
  root.position.x += x - centerX;
  root.position.y += y - box.min.y;
  root.position.z += z - centerZ;
  scene.add(root);
  return root;
}

function stylize(root) {
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const source = Array.isArray(obj.material) ? obj.material : [obj.material];
    const next = source.map((mat) => {
      const name = mat?.name || "";
      const color = mat?.color ? mat.color.clone() : new THREE.Color(0xffffff);
      if (name === "lamp") return new THREE.MeshBasicMaterial({ color: 0xffe7b0 });
      if (name === "glass") {
        return new THREE.MeshLambertMaterial({
          color: 0x8fb7e8,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      }
      return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    });
    obj.material = Array.isArray(obj.material) ? next : next[0];
  });
}

function makeScreen(anchor, draw, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size[0];
  canvas.height = size[1];
  const ctx = canvas.getContext("2d", { alpha: true });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(anchor.width, anchor.height),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.FrontSide }),
  );
  mesh.position.set(anchor.position[0], anchor.position[1], anchor.position[2]);
  mesh.rotation.order = "YXZ";
  mesh.rotation.y = anchor.rotationY || 0;
  mesh.rotation.x = anchor.rotationX || 0;
  mesh.renderOrder = 3;
  return { mesh, canvas, ctx, tex, draw, key: "" };
}

function buildScreens() {
  const laptop = makeScreen(ANCHORS.laptop, drawLaptop, [800, 1240]);
  const phone = makeScreen(ANCHORS.phone, drawPhone, [540, 960]);
  const paper = makeScreen(ANCHORS.paper, drawPaper, [640, 840]);
  const clock = makeScreen(ANCHORS.clock, (ctx, w, h) => drawClock(ctx, w, h), [512, 512]);
  clock.mesh.material.transparent = true;
  const ai = makeScreen(ANCHORS.ai, drawAi, [900, 560]);
  ai.mesh.visible = false;
  drawClock(clock.ctx, clock.canvas.width, clock.canvas.height);
  clock.tex.needsUpdate = true;
  return {
    laptop,
    phone,
    paper,
    clock,
    ai,
    update(state, frame) {
      const time = frame.t;
      const jumping = frame.poses?.student?.clip === "jump";
      paper.mesh.visible = frame.shot?.type !== "closeup" || jumping;
      laptop.mesh.visible = state.laptop.mode !== "dim";
      paint(laptop, state.laptop, `${state.laptop.mode}:${Math.round((state.laptop.progress || 0) * 16)}`);
      paint(phone, state.phone, `${state.phone.mode}:${state.phone.flash ? 1 : 0}`);
      paint(paper, state.paper, state.paper.mode);
      ai.mesh.visible = Boolean(state.ai.visible);
      if (state.ai.visible) {
        ai.mesh.position.y = ANCHORS.ai.position[1] + Math.sin(time * 2.4) * 0.025;
        paint(ai, state.ai, "ai");
      }
    },
  };
}

function paint(screen, state, key) {
  if (screen.key === key) return;
  screen.key = key;
  screen.draw(screen.ctx, screen.canvas.width, screen.canvas.height, state);
  screen.tex.needsUpdate = true;
}

async function loadStudent(spec) {
  const fbx = new FBXLoader();
  const url = (value) => (value.startsWith("/") ? value : `/${value}`);
  const root = await fbx.loadAsync(url(spec.model));
  const clips = {};
  for (const [name, file] of Object.entries(spec.clips || {})) {
    const anim = await fbx.loadAsync(url(file));
    const clip = anim.animations[0];
    if (!clip) throw new Error(`動畫 ${name} 沒有 clip`);
    clip.name = name;
    retargetTracks(clip);
    clips[name] = clip;
  }

  const tex = await new THREE.TextureLoader().loadAsync(url(spec.skin));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.frustumCulled = false;
    obj.material = new THREE.MeshLambertMaterial({
      map: tex,
      color: 0xffffff,
      side: THREE.FrontSide,
    });
  });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = box.max.y - box.min.y || 1;
  const fitted = TARGET_HEIGHT / height;
  root.scale.multiplyScalar(fitted);
  root.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(root);
  root.position.x -= (grounded.min.x + grounded.max.x) / 2;
  root.position.z -= (grounded.min.z + grounded.max.z) / 2;
  root.position.y -= grounded.min.y;
  root.updateMatrixWorld(true);
  const fittedBox = new THREE.Box3().setFromObject(root);
  console.log(
    `student feet box y ${fittedBox.min.y.toFixed(2)}..${fittedBox.max.y.toFixed(2)} x ${fittedBox.min.x.toFixed(2)}..${fittedBox.max.x.toFixed(2)} z ${fittedBox.min.z.toFixed(2)}..${fittedBox.max.z.toFixed(2)}`,
  );

  const pivot = new THREE.Group();
  pivot.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const actions = {};
  for (const [name, clip] of Object.entries(clips)) {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = true;
    actions[name] = action;
  }

  const bones = {};
  root.traverse((obj) => {
    if (obj.isBone) bones[obj.name] = obj;
  });
  const head = bones.Head || bones.head;
  const mouth = buildMouth();
  if (head) {
    head.add(mouth);
    // Head-local units from the skinned face: lips sit near (0.04, 0.24, 0.50).
    mouth.position.set(0.042, 0.238, 0.52);
  } else {
    root.add(mouth);
    mouth.position.set(0, TARGET_HEIGHT * 0.86, 0.12);
  }

  const names = Object.keys(bones).join(",");
  const clipInfo = Object.entries(clips)
    .map(([name, clip]) => `${name}:${clip.duration.toFixed(2)}`)
    .join(" ");
  console.log(
    `student height=${TARGET_HEIGHT} raw=${height.toFixed(3)} scale=${fitted.toFixed(3)} bones=${names} clips=${clipInfo}`,
  );
  for (const clip of Object.values(clips)) {
    const missing = [];
    for (const track of clip.tracks) {
      const node = track.name.replace(/\.(position|quaternion|scale)$/, "");
      if (!bones[node] && !missing.includes(node)) missing.push(node);
    }
    if (missing.length) console.log(`clip ${clip.name} missing bones ${missing.join(",")}`);
  }

  const shadow = makeShadow();
  let current = null;

  return {
    pivot,
    shadow,
    apply(pose) {
      const clipName = clips[pose.clip] ? pose.clip : "idle";
      if (current !== clipName) {
        mixer.stopAllAction();
        const action = actions[clipName];
        action.reset().play();
        current = clipName;
      }
      const dur = clips[clipName].duration || 1;
      let local = pose.clipTime || 0;
      if (pose.once) local = Math.min(Math.max(0, local), Math.max(0, dur - 0.04));
      else local = ((local % dur) + dur) % dur;
      mixer.setTime(local);
      if (head) {
        const extra = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(pose.headPitch || 0, pose.headYaw || 0, 0, "YXZ"),
        );
        head.quaternion.multiply(extra);
      }
      const open = pose.mouth || 0;
      mouth.visible = open > 0.05;
      mouth.position.set(0.042, 0.232 - open * 0.02, 0.528);
      mouth.scale.set(1.2, 0.18 + open * 0.95, 0.4);
      const arm = bones.RightArm;
      const armL = bones.LeftArm;
      if (arm) arm.rotation.x += pose.reach || 0;
      if (armL) armL.rotation.x += (pose.reach || 0) * 0.85;
      pivot.position.set(pose.position[0], pose.position[1], pose.position[2]);
      pivot.rotation.set(0, pose.yaw || 0, 0);
      const lift = Math.max(0, pose.position[1]);
      shadow.position.set(pose.position[0], 0.025, pose.position[2]);
      const s = Math.max(0.45, 1.05 - lift);
      shadow.scale.set(s, s, s);
    },
  };
}

function retargetTracks(clip) {
  for (const track of clip.tracks) {
    const parts = track.name.split("|");
    track.name = parts[parts.length - 1];
  }
}

function buildMouth() {
  const group = new THREE.Group();
  const lip = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x14080a }),
  );
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.046, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xd24a58 }),
  );
  inner.position.z = 0.018;
  group.add(lip, inner);
  group.visible = false;
  return group;
}

function makeShadow() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const g = canvas.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(0,0,0,0.45)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.025;
  return mesh;
}
