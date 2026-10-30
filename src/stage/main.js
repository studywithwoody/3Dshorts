import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { evaluate as evaluatePets } from "/src/playback.mjs";
import { evaluate as evaluateStudy } from "/src/study-playback.mjs";
import { buildStudy } from "/src/stage/study-set.js";

const params = new URLSearchParams(location.search);
const defaultFormat = params.get("format") === "png" ? "image/png" : "image/jpeg";
const defaultQuality = Number(params.get("quality") || "0.93");

const bundle = await fetch("/episode.json").then((res) => {
  if (!res.ok) throw new Error(`episode.json ${res.status}`);
  return res.json();
});

const width = bundle.width;
const height = bundle.height;

const canvas = document.getElementById("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(1);
renderer.setSize(width, height, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const isStudy = bundle.scene === "study";
const evaluate = isStudy ? evaluateStudy : evaluatePets;
renderer.setClearColor(isStudy ? 0x10141c : 0x8ecaf0, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, width / height, 0.05, 80);

if (!isStudy) buildSet(scene);

const capture = document.createElement("canvas");
capture.width = width;
capture.height = height;
const ctx = capture.getContext("2d", { alpha: false });

let current = null;
let study = null;
const pets = [];

function buildSet(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(48, 28, 18),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          vec3 n = normalize(vPos);
          float h = n.y;
          vec3 top = vec3(0.45, 0.72, 0.95);
          vec3 mid = vec3(0.62, 0.84, 0.98);
          vec3 hor = vec3(1.00, 0.84, 0.64);
          vec3 col = mix(hor, mid, smoothstep(-0.04, 0.28, h));
          col = mix(col, top, smoothstep(0.12, 0.75, h));
          vec3 sunDir = normalize(vec3(0.55, 0.42, -0.45));
          float sun = pow(max(dot(n, sunDir), 0.0), 90.0);
          col += vec3(1.0, 0.86, 0.55) * sun;
          gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
        }
      `,
    }),
  );
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4 }),
  );
  sun.position.set(6.5, 9.5, -9);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshLambertMaterial({ color: 0x5aaa42 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const patch = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 40),
    new THREE.MeshLambertMaterial({ color: 0x8ed15f }),
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.012;
  patch.receiveShadow = true;
  patch.material.polygonOffset = true;
  patch.material.polygonOffsetFactor = -2;
  patch.material.polygonOffsetUnits = -2;
  scene.add(patch);

  const hemi = new THREE.HemisphereLight(0xd7ecff, 0x7dae58, 0.95);
  scene.add(hemi);
  scene.add(new THREE.AmbientLight(0xfff4e4, 0.38));

  const key = new THREE.DirectionalLight(0xfff0d2, 2.35);
  key.position.set(4.2, 8.2, 5.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.4;
  key.shadow.camera.far = 24;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.035;
  scene.add(key);
  scene.add(key.target);
  key.target.position.set(0, 0.4, 0);

  const fill = new THREE.DirectionalLight(0xd5e6ff, 0.85);
  fill.position.set(-4.5, 3.2, 4.2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffd7a8, 0.7);
  rim.position.set(-1.5, 4.5, -4.5);
  scene.add(rim);

  const flowerColors = [0xff7b8c, 0xffd15c, 0xfff6ea, 0xd2a6ff, 0xff9d4a, 0x9ad7ff];
  const flowerSpots = [
    [-1.7, 0.85],
    [1.72, 0.7],
    [-1.85, -0.35],
    [1.9, -0.45],
    [-1.15, -1.7],
    [1.2, -1.75],
    [0.05, -1.9],
    [-2.15, 1.15],
  ];
  scene.userData.flowers = flowerSpots.map(([x, z], i) => {
    const flower = makeFlower(flowerColors[i % flowerColors.length]);
    flower.position.set(x, 0, z);
    flower.scale.setScalar(0.85 + (i % 3) * 0.12);
    scene.add(flower);
    return flower;
  });

  const bushMat = (color) =>
    new THREE.MeshLambertMaterial({ color, flatShading: true });
  const bushes = [
    [-2.05, -1.35, 0.52, 0x3d9444],
    [2.0, -1.45, 0.48, 0x2f8640],
    [0.15, -2.15, 0.42, 0x57a84a],
    [-2.3, 0.55, 0.36, 0x34843c],
    [2.25, 0.4, 0.38, 0x459848],
  ];
  for (const [x, z, s, color] of bushes) {
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), bushMat(color));
    bush.scale.set(s, s * 0.72, s);
    bush.position.set(x, s * 0.55, z);
    bush.castShadow = true;
    bush.receiveShadow = true;
    scene.add(bush);
  }

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 18, 14),
    new THREE.MeshLambertMaterial({ color: 0xff4b4b }),
  );
  ball.castShadow = true;
  scene.add(ball);
  scene.userData.ball = ball;

  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.145, 0.028, 8, 16),
    new THREE.MeshLambertMaterial({ color: 0xfff2f0 }),
  );
  stripe.rotation.y = 0.4;
  ball.add(stripe);
}

function makeFlower(color) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.034, 0.32, 5),
    new THREE.MeshLambertMaterial({ color: 0x3c8c3a }),
  );
  stem.position.y = 0.16;
  stem.castShadow = true;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 7, 6),
    new THREE.MeshLambertMaterial({ color }),
  );
  head.position.y = 0.36;
  head.castShadow = true;
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 6, 5),
    new THREE.MeshLambertMaterial({ color: 0xffe7a0 }),
  );
  center.position.set(0, 0.4, 0.04);
  group.add(stem, head, center);
  return group;
}

function makeShadow() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, "rgba(30, 50, 20, 0.45)");
  grad.addColorStop(1, "rgba(30, 50, 20, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.25),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 2;
  return mesh;
}

class Pet {
  constructor(spec, gltf) {
    this.id = spec.id;
    this.pivot = new THREE.Group();
    this.pivot.rotation.order = "YXZ";
    this.squash = new THREE.Group();
    this.pivot.add(this.squash);
    this.model = gltf.scene;
    this.squash.add(this.model);
    this.model.scale.setScalar(spec.scale ?? 1);
    this.model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    this.model.position.y -= box.min.y - 0.002;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.clips = Object.fromEntries(gltf.animations.map((clip) => [clip.name, clip]));
    this.actions = {};
    for (const [name, clip] of Object.entries(this.clips)) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
      this.actions[name] = action;
    }
    this.model.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.metalness = 0;
        if ("roughness" in mat) mat.roughness = 0.92;
        if (mat.map) {
          mat.map.magFilter = THREE.NearestFilter;
          mat.map.minFilter = THREE.NearestFilter;
          mat.map.generateMipmaps = false;
          mat.map.needsUpdate = true;
        }
      }
    });
    this.model.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(this.model);
    const size = fitted.getSize(new THREE.Vector3());
    console.log(
      `pet ${spec.id} height=${size.y.toFixed(2)} width=${size.x.toFixed(2)} clips=${Object.keys(this.clips).join(",")}`,
    );
    this.shadow = makeShadow();
    this.current = null;
  }

  apply(pose) {
    const clipName = this.clips[pose.clip] ? pose.clip : "idle";
    if (this.current !== clipName) {
      this.mixer.stopAllAction();
      const action = this.actions[clipName];
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.play();
      this.current = clipName;
    }
    const dur = this.clips[clipName].duration || 1;
    let local = pose.clipTime;
    if (!Number.isFinite(local)) local = 0;
    local = ((local % dur) + dur) % dur;
    this.mixer.setTime(local);
    this.pivot.position.set(pose.position[0], pose.position[1], pose.position[2]);
    this.pivot.rotation.set(pose.lean || 0, pose.yaw || 0, 0);
    this.squash.scale.set(pose.scale[0], pose.scale[1], pose.scale[2]);
    const lift = Math.max(0, pose.position[1]);
    const shadowScale = Math.max(0.38, 1.05 - lift * 1.35);
    this.shadow.position.set(pose.position[0], 0.02, pose.position[2]);
    this.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    this.shadow.material.opacity = Math.max(0.2, 0.9 - lift * 1.1);
  }
}

function wrapText(text, maxWidth) {
  const lines = [];
  let current = "";
  for (const ch of text) {
    const next = current + ch;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = ch;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function drawCaption(caption) {
  if (!caption?.text) return;
  const family = caption.family || "Nunito";
  const size = caption.size || 118;
  const maxWidth = caption.maxWidth || width * 0.86;
  ctx.save();
  ctx.font = `700 ${size}px "${family}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  const lines = wrapText(caption.text, maxWidth);
  const y0 = Math.round(height * (caption.y ?? 0.86));
  const gap = Math.round(size * 1.18);
  const pop = caption.pop || 1;
  ctx.translate(width / 2, y0);
  ctx.scale(pop, pop);
  ctx.lineWidth = Math.max(10, Math.round(size * 0.16));
  ctx.strokeStyle = "rgba(12, 16, 24, 0.82)";
  ctx.fillStyle = "#ffffff";
  lines.forEach((line, index) => {
    const y = (index - (lines.length - 1) / 2) * gap;
    ctx.strokeText(line, 0, y);
    ctx.fillText(line, 0, y);
  });
  ctx.restore();
}

function drawLogo(overlay) {
  if (!overlay || overlay.kind !== "logo") return;
  ctx.save();
  ctx.fillStyle = "rgba(6, 8, 16, 0.78)";
  ctx.fillRect(0, 0, width, height);
  const color = overlay.color || "#F6C453";
  const cx = width / 2;
  const cy = Math.round(height * 0.4);
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#1a140c";
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * 78, Math.sin(a) * 78);
    const b = a + Math.PI / 4;
    ctx.lineTo(Math.cos(b) * 22, Math.sin(b) * 22);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  let size = 92;
  const name = overlay.name || "AI 學習平台";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f7fbff";
  do {
    ctx.font = `700 ${size}px "Noto Sans TC", sans-serif`;
    size -= 4;
  } while (size > 48 && ctx.measureText(name).width > 920);
  ctx.fillText(name, cx, cy + 210);
  ctx.restore();
}

function applyFrame(t) {
  current = evaluate(bundle, t);
  if (study) {
    study.apply(current);
  } else {
    for (const pet of pets) pet.apply(current.poses[pet.id]);
    const ball = scene.userData.ball;
    ball.position.set(current.ball.position[0], current.ball.position[1], current.ball.position[2]);
    ball.scale.set(current.ball.scale[0], current.ball.scale[1], current.ball.scale[2]);
    scene.userData.flowers.forEach((flower, i) => {
      flower.rotation.z = Math.sin(t * 1.6 + i) * 0.08;
    });
  }
  camera.fov = current.camera.fov;
  camera.updateProjectionMatrix();
  camera.position.set(
    current.camera.position[0],
    current.camera.position[1],
    current.camera.position[2],
  );
  camera.lookAt(
    current.camera.lookAt[0],
    current.camera.lookAt[1],
    current.camera.lookAt[2],
  );
  renderer.render(scene, camera);
}

window.__seek = (t) => {
  applyFrame(t);
};

window.__capture = (fmt) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(renderer.domElement, 0, 0, width, height);
  drawLogo(current?.overlay);
  drawCaption(current?.caption);
  const format = fmt || defaultFormat;
  if (format === "image/png") return capture.toDataURL("image/png");
  return capture.toDataURL("image/jpeg", defaultQuality);
};

const font = isStudy
  ? new FontFace("Noto Sans TC", "url(/assets/fonts/NotoSansTC-700.ttf)", {
      weight: "700",
      style: "normal",
    })
  : new FontFace("Nunito", "url(/assets/fonts/Nunito.ttf)", {
      weight: "200 1000",
      style: "normal",
    });
document.fonts.add(font);

try {
  await font.load();
  if (isStudy) {
    await document.fonts.load('700 64px "Noto Sans TC"');
    study = await buildStudy(scene, bundle);
  } else {
    await document.fonts.load("800 118px Nunito");
    const loader = new GLTFLoader();
    for (const spec of bundle.characters) {
      const url = spec.model.startsWith("/") ? spec.model : `/${spec.model}`;
      const gltf = await loader.loadAsync(url);
      const pet = new Pet(spec, gltf);
      scene.add(pet.pivot);
      scene.add(pet.shadow);
      pets.push(pet);
    }
    window.__pets = pets;
  }
  applyFrame(0);
  window.__READY = true;
  console.log(
    `stage ready ${width}x${height} shots=${bundle.shots.length} duration=${bundle.duration}`,
  );
} catch (err) {
  console.error(err);
  window.__ERROR = err?.stack || err?.message || String(err);
}
