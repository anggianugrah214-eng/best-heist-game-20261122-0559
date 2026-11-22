// Guard behaviour: patrol, suspicion, chase, search and return.
// A guard is a little state machine. Its cone colour and width follow its
// state, so the player can always read how much trouble they are in.

import {
  GUARD_VIEW_HALF_ANGLE, GUARD_VIEW_RANGE, SPOT_DECAY, SPOT_RATE,
  WALK_SPEED, angleTo, clamp, dist,
} from './config.js';
import { hasLineOfSight, moveWithCollision, spotRate } from './vision.js';

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALARMED = 'alarmed';
export const GUARD_SEARCH = 'search';
export const GUARD_RETURN = 'return';

const PATROL_SPEED = 62;
const CHASE_SPEED = 150;
const INVESTIGATE_SPEED = 105;
const RETURN_SPEED = 85;
const LOSE_SIGHT_SECONDS = 3.0;
const SEARCH_SECONDS = 3.0;
const SUSPICIOUS_SECONDS = 1.2;

/** Build a guard from a level definition. */
export function makeGuard(def, index) {
  const start = def.waypoints[0];
  return {
    id: index,
    x: start.x,
    y: start.y,
    facing: Math.PI / 2,
    state: GUARD_CALM,
    waypointIndex: 1,
    pauseTimer: 0,
    spot: 0,
    lastSeenX: start.x,
    lastSeenY: start.y,
    loseSightTimer: 0,
    searchTimer: 0,
    suspiciousTimer: 0,
    scanAngle: 0,
    waypoints: def.waypoints,
    pauseSeconds: def.pauseSeconds,
  };
}

/** Cone half-angle for a state: alarmed guards stare narrow and hard. */
export function guardConeHalfAngle(guard) {
  if (guard.state === GUARD_ALARMED) return GUARD_VIEW_HALF_ANGLE * 0.72;
  if (guard.state === GUARD_SUSPICIOUS) return GUARD_VIEW_HALF_ANGLE * 0.85;
  return GUARD_VIEW_HALF_ANGLE;
}

/** Cone colour name for a state, used by the renderer and the HUD. */
export function guardStateColour(guard) {
  if (guard.state === GUARD_ALARMED) return '#d93b3b';
  if (guard.state === GUARD_SUSPICIOUS || guard.state === GUARD_SEARCH) return '#d98a2b';
  return '#3e6b8f';
}

/** Step one guard for dt seconds. Returns 'spotted' while it sees the thief. */
export function stepGuard(world, guard, player, dt, events) {
  const rate = spotRate(world, guard, GUARD_VIEW_RANGE, guardConeHalfAngle(guard), player, SPOT_RATE);
  const seeing = rate > 0;
  if (seeing) {
    guard.spot = clamp(guard.spot + rate * dt, 0, 1);
    guard.lastSeenX = player.x;
    guard.lastSeenY = player.y;
    guard.loseSightTimer = 0;
  } else {
    guard.spot = clamp(guard.spot - SPOT_DECAY * dt, 0, 1);
    guard.loseSightTimer += dt;
  }

  if (guard.state === GUARD_CALM) {
    if (guard.spot >= 1) {
      becomeAlarmed(guard, events);
    } else if (guard.spot > 0.35) {
      guard.state = GUARD_SUSPICIOUS;
      guard.suspiciousTimer = SUSPICIOUS_SECONDS;
    } else {
      patrolStep(world, guard, dt);
    }
  } else if (guard.state === GUARD_SUSPICIOUS) {
    guard.suspiciousTimer -= dt;
    faceToward(guard, guard.lastSeenX, guard.lastSeenY, dt);
    if (guard.spot >= 1) {
      becomeAlarmed(guard, events);
    } else if (guard.suspiciousTimer <= 0) {
      if (guard.spot > 0.05) {
        guard.state = GUARD_SEARCH;
        guard.searchTimer = SEARCH_SECONDS;
      } else {
        guard.state = GUARD_RETURN;
      }
    }
  } else if (guard.state === GUARD_ALARMED) {
    chaseStep(world, guard, player, dt);
    if (guard.spot >= 1 && seeing) {
      guard.lastSeenX = player.x;
      guard.lastSeenY = player.y;
    }
    if (!seeing && guard.loseSightTimer > LOSE_SIGHT_SECONDS) {
      guard.state = GUARD_SEARCH;
      guard.searchTimer = SEARCH_SECONDS;
    }
  } else if (guard.state === GUARD_SEARCH) {
    searchStep(world, guard, dt);
    if (guard.spot >= 1) becomeAlarmed(guard, events);
  } else if (guard.state === GUARD_RETURN) {
    returnStep(world, guard, dt);
    if (guard.spot >= 1) becomeAlarmed(guard, events);
  }
  return seeing;
}

function becomeAlarmed(guard, events) {
  if (guard.state !== GUARD_ALARMED) {
    guard.state = GUARD_ALARMED;
    events.push({ type: 'alarm', x: guard.x, y: guard.y });
  }
}

/** Walk the patrol loop, pausing at each waypoint and looking around. */
function patrolStep(world, guard, dt) {
  if (guard.pauseTimer > 0) {
    guard.pauseTimer -= dt;
    guard.facing += Math.sin(world.time * 0.8 + guard.id) * 0.12 * dt;
    return;
  }
  const target = guard.waypoints[guard.waypointIndex];
  if (moveToward(world, guard, target.x, target.y, PATROL_SPEED, dt)) {
    guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
    guard.pauseTimer = guard.pauseSeconds;
  }
}

/** Chase the thief's last seen position, re-aiming while the chase is hot. */
function chaseStep(world, guard, player, dt) {
  const targetX = guard.spot > 0.4 ? player.x : guard.lastSeenX;
  const targetY = guard.spot > 0.4 ? player.y : guard.lastSeenY;
  moveToward(world, guard, targetX, targetY, CHASE_SPEED, dt);
}

/** Walk to the last seen spot, then stand and scan the room. */
function searchStep(world, guard, dt) {
  if (dist(guard.x, guard.y, guard.lastSeenX, guard.lastSeenY) > 14) {
    moveToward(world, guard, guard.lastSeenX, guard.lastSeenY, INVESTIGATE_SPEED, dt);
    return;
  }
  guard.searchTimer -= dt;
  guard.scanAngle += dt * 1.6;
  guard.facing = guard.scanAngle;
  if (guard.searchTimer <= 0) guard.state = GUARD_RETURN;
}

/** Walk back to the nearest patrol waypoint, then resume the route. */
function returnStep(world, guard, dt) {
  let best = guard.waypoints[0];
  let bestDist = Infinity;
  let bestIndex = 0;
  for (let i = 0; i < guard.waypoints.length; i += 1) {
    const d = dist(guard.x, guard.y, guard.waypoints[i].x, guard.waypoints[i].y);
    if (d < bestDist) { bestDist = d; best = guard.waypoints[i]; bestIndex = i; }
  }
  if (moveToward(world, guard, best.x, best.y, RETURN_SPEED, dt)) {
    guard.waypointIndex = (bestIndex + 1) % guard.waypoints.length;
    guard.state = GUARD_CALM;
  }
}

/** Turn toward a point at a limited turn rate (guards do not snap around). */
function faceToward(guard, x, y, dt) {
  const wanted = angleTo(guard.x, guard.y, x, y);
  let diff = wanted - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = clamp(diff, -2.6 * dt, 2.6 * dt);
  guard.facing += step;
}

/** Move toward a point; true when arrived. Slides along walls. */
function moveToward(world, guard, tx, ty, speed, dt) {
  const d = dist(guard.x, guard.y, tx, ty);
  if (d < 6) return true;
  const vx = ((tx - guard.x) / d) * speed * dt;
  const vy = ((ty - guard.y) / d) * speed * dt;
  const next = moveWithCollision(world, guard.x, guard.y, guard.x + vx, guard.y + vy, 13);
  // If a wall blocks the direct line, slide: try the dominant axis alone.
  if (next.x === guard.x && next.y === guard.y && Math.abs(vx) > 0.01 && Math.abs(vy) > 0.01) {
    const alt = Math.abs(vx) > Math.abs(vy)
      ? moveWithCollision(world, guard.x, guard.y, guard.x + vx, guard.y, 13)
      : moveWithCollision(world, guard.x, guard.y, guard.x, guard.y + vy, 13);
    guard.x = alt.x;
    guard.y = alt.y;
  } else {
    guard.x = next.x;
    guard.y = next.y;
  }
  guard.facing = angleTo(guard.x, guard.y, tx, ty);
  return d < 10;
}

/** A guard catches the thief on touch, in any state. */
export function guardTouchesPlayer(guard, player) {
  return dist(guard.x, guard.y, player.x, player.y) < 26;
}

/** Can this guard see the thief right now (used by the HUD and the alarm)? */
export function guardSeesPlayer(world, guard, player) {
  return spotRate(world, guard, GUARD_VIEW_RANGE, guardConeHalfAngle(guard), player, 1) > 0;
}

export { hasLineOfSight, WALK_SPEED };
