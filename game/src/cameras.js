// Security cameras: wall-mounted, sweeping their cone back and forth.
// A camera that spots the thief fills the alarm fast. An EMP pulse knocks
// every camera dark for a few seconds — the thief's window to slip past.

import { CAMERA_VIEW_HALF_ANGLE, CAMERA_VIEW_RANGE, SPOT_RATE } from './config.js';
import { spotRate } from './vision.js';

/** Build a camera from a level definition. */
export function makeCamera(def, index) {
  return {
    id: index,
    x: def.x,
    y: def.y,
    baseAngle: def.baseAngle,
    sweep: def.sweep,
    period: def.period,
    facing: def.baseAngle,
    disabledTimer: 0,
    spot: 0,
  };
}

/** Current sweep angle: a smooth sine sweep around the base angle. */
export function cameraFacing(camera, time) {
  const phase = (time / camera.period) * Math.PI * 2;
  return camera.baseAngle + Math.sin(phase) * camera.sweep;
}

/** Step one camera for dt seconds. Returns true while it sees the thief. */
export function stepCamera(world, camera, player, dt) {
  camera.facing = cameraFacing(camera, world.time);
  if (camera.disabledTimer > 0) {
    camera.disabledTimer -= dt;
    camera.spot = 0;
    return false;
  }
  const rate = spotRate(world, camera, CAMERA_VIEW_RANGE, CAMERA_VIEW_HALF_ANGLE, player, SPOT_RATE * 1.15);
  const seeing = rate > 0;
  camera.spot = seeing ? 1 : 0;
  return seeing;
}

/** Is this camera currently dark (EMP'd)? */
export function cameraIsDark(camera) {
  return camera.disabledTimer > 0;
}

/** Can this camera see the thief right now (used by the HUD)? */
export function cameraSeesPlayer(world, camera, player) {
  if (camera.disabledTimer > 0) return false;
  return spotRate(world, camera, CAMERA_VIEW_RANGE, CAMERA_VIEW_HALF_ANGLE, player, 1) > 0;
}
