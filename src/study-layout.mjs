/**
 * Shared room anchors. The stage places meshes here; the shot evaluator
 * aims cameras at the same points. Units are meters after furniture scale.
 *
 * Student stands on +Z, looking toward the desk on −Z, so a camera with a
 * smaller Z sees the face. Wide coverage sits in the front-right corner.
 */

export const TARGET_HEIGHT = 1.56;
export const EYE_Y = 1.38;
export const DESK_TOP = 0.384 * 2.05;

export const STUDENT_HOME = {
  position: [0.02, 0, 0.72],
  rotationY: Math.PI,
};

export const CAMERAS = {
  wide: { fov: 54, position: [1.05, 1.58, 2.95], lookAt: [-0.4, 0.98, -0.45] },
  logo: { fov: 46, position: [1.55, 1.62, -0.55], lookAt: [0.0, 1.12, 0.35] },
  close: { fov: 28, distance: 2.25, side: 0.22, lift: 0.04, lookDown: 0.02 },
  jump: { fov: 40, position: [1.25, 1.28, -1.35], lookAt: [0.05, 0.95, 0.35] },
};

/** Cameras on the +Z side of each screen so the front face (readable text) fills the shot. */
export const OTS = {
  laptop: { fov: 28, position: [0.95, 1.28, 1.82], lookAt: [0.58, 1.12, 0.4] },
  phone: { fov: 32, position: [0.42, 1.12, 1.32], lookAt: [0.48, 0.98, 0.5] },
  paper: { fov: 52, position: [0.0, 1.16, -0.72], lookAt: [0.02, 1.02, 0.28] },
  ai: { fov: 32, position: [0.25, 1.32, 1.55], lookAt: [0.72, 1.26, 0.08] },
};

/** Screen planes. rotationX/Y match a PlaneGeometry that faces +Z before rotation. */
export const ANCHORS = {
  laptop: {
    position: [0.58, DESK_TOP + 0.34, 0.4],
    rotationX: -0.22,
    rotationY: 0.28,
    width: 0.4,
    height: 0.62,
    distance: 0.78,
    fov: 30,
    side: 0.14,
    lift: 0.04,
  },
  phone: {
    position: [0.48, DESK_TOP + 0.11, 0.48],
    rotationX: -1.02,
    rotationY: 0.15,
    width: 0.2,
    height: 0.36,
    distance: 0.58,
    fov: 30,
    side: 0.05,
    lift: 0.06,
  },
  paper: {
    position: [0.02, DESK_TOP + 0.24, 0.28],
    rotationX: -0.32,
    rotationY: Math.PI,
    width: 0.4,
    height: 0.5,
    distance: 0.72,
    fov: 28,
    side: 0.02,
    lift: 0.08,
  },
  ai: {
    position: [0.78, 1.28, 0.05],
    rotationX: -0.12,
    rotationY: -0.55,
    width: 0.58,
    height: 0.4,
    distance: 0.85,
    fov: 30,
    side: 0.0,
    lift: 0.02,
  },
  clock: {
    position: [-1.15, 1.78, -2.18],
    rotationX: 0,
    rotationY: 0,
    width: 0.52,
    height: 0.52,
    distance: 1.4,
    fov: 28,
    side: 0,
    lift: 0,
  },
};

export function planeNormal(anchor) {
  const rx = anchor.rotationX || 0;
  const ry = anchor.rotationY || 0;
  const cr = Math.cos(rx);
  const sr = Math.sin(rx);
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  return [cr * sy, -sr, cr * cy];
}

export function screenCamera(anchor) {
  const n = planeNormal(anchor);
  const dist = anchor.distance ?? 0.8;
  const side = anchor.side ?? 0;
  const lift = anchor.lift ?? 0;
  const right = [-n[2], 0, n[0]];
  const rl = Math.hypot(right[0], right[2]) || 1;
  const p = anchor.position;
  return {
    fov: anchor.fov ?? 30,
    position: [
      p[0] + n[0] * dist + (right[0] / rl) * side,
      p[1] + n[1] * dist + lift,
      p[2] + n[2] * dist + (right[2] / rl) * side,
    ],
    lookAt: [p[0], p[1], p[2]],
  };
}
