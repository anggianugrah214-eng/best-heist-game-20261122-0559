// Vision: line of sight through the map, cone tests and shadow checks.
// A guard or camera only ever "sees" the thief when all three hold:
// inside the cone's range and angle, and with a clear line of sight.

import { TILE, angleDiff, clamp } from './config.js';

/** Is the tile at (col,row) solid for sight and movement? Doors block sight until opened. */
export function isSolidTile(world, col, row) {
  if (col < 0 || col >= 32 || row < 0 || row >= 18) return true;
  if (world.wallSet.has(col + ',' + row)) return true;
  if (world.crateSet.has(col + ',' + row)) return true;
  if (world.caseSet.has(col + ',' + row)) return true;
  const door = world.doorByKey.get(col + ',' + row);
  if (door && !door.open) return true;
  return false;
}

/** Is the pixel point (x,y) inside a shadow tile? */
export function inShadow(world, x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  return world.shadowSet.has(col + ',' + row);
}

/**
 * Clear line of sight between two pixel points: sample along the segment and
 * fail on the first solid tile. Cheap and good enough for 40px tiles.
 */
export function hasLineOfSight(world, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(length / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (isSolidTile(world, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

/** Is the target inside a vision cone (range + half-angle + line of sight)? */
export function inCone(world, ox, oy, facing, range, halfAngle, tx, ty) {
  const dx = tx - ox;
  const dy = ty - oy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > range) return false;
  if (distance < 1) return true;
  const angle = Math.atan2(dy, dx);
  if (angleDiff(angle, facing) > halfAngle) return false;
  return hasLineOfSight(world, ox, oy, tx, ty);
}

/**
 * How fast a watcher fills its "spotted" meter on the thief right now:
 * 0 when the thief is out of the cone, up to SPOT_RATE at point blank.
 * Sneaking and shadow slow it; sprinting speeds it up.
 */
export function spotRate(world, watcher, range, halfAngle, player, baseRate) {
  const dx = player.x - watcher.x;
  const dy = player.y - watcher.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance > range) return 0;
  const angle = Math.atan2(dy, dx);
  if (angleDiff(angle, watcher.facing) > halfAngle) return 0;
  if (!hasLineOfSight(world, watcher.x, watcher.y, player.x, player.y)) return 0;
  const closeness = 1 - clamp(distance / range, 0, 1) * 0.65;
  let factor = closeness;
  if (player.sneaking) factor *= 0.45;
  if (player.sprinting) factor *= 1.6;
  if (inShadow(world, player.x, player.y)) factor *= 0.38;
  return baseRate * factor;
}

/**
 * Circle-vs-solid-tiles collision: try moving to (nx,ny) and slide along
 * walls instead of sticking. Returns the resolved position.
 */
export function moveWithCollision(world, x, y, nx, ny, radius) {
  let px = x;
  let py = y;
  // Move one axis at a time so the circle slides along walls.
  if (!circleHitsSolid(world, nx, py, radius)) px = nx;
  if (!circleHitsSolid(world, px, ny, radius)) py = ny;
  return { x: px, y: py };
}

function circleHitsSolid(world, x, y, radius) {
  const minCol = Math.floor((x - radius) / TILE);
  const maxCol = Math.floor((x + radius) / TILE);
  const minRow = Math.floor((y - radius) / TILE);
  const maxRow = Math.floor((y + radius) / TILE);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      if (!isSolidTile(world, col, row)) continue;
      const closestX = clamp(x, col * TILE, col * TILE + TILE);
      const closestY = clamp(y, row * TILE, row * TILE + TILE);
      const dx = x - closestX;
      const dy = y - closestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}
