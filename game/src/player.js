// The thief: movement, sneaking, sprinting, and the noise they make.
// Speed is a choice with a cost: sneak slow and quiet, walk normally, or
// sprint loud and easy to spot. The world hears the difference.

import {
  PLAYER_RADIUS, SNEAK_SPEED, SPRINT_SPEED, WALK_SPEED,
  HEAR_SNEAK, HEAR_SPRINT, HEAR_WALK, angleTo, dist,
} from './config.js';
import { moveWithCollision } from './vision.js';

/** Build the player at the level's start tile. */
export function makePlayer(start) {
  return {
    x: start.x,
    y: start.y,
    facing: Math.PI / 2,
    radius: PLAYER_RADIUS,
    sneaking: false,
    sprinting: false,
    moving: false,
    speed: 0,
    stepTimer: 0,
    stepSide: 0,
  };
}

/** How loud the player is right now (radius guards can hear). */
export function playerNoiseRadius(player) {
  if (!player.moving) return 0;
  if (player.sneaking) return HEAR_SNEAK;
  if (player.sprinting) return HEAR_SPRINT;
  return HEAR_WALK;
}

/**
 * Step the player from the current input. input is {mx, my} in -1..1 plus
 * sneak/sprint flags. Returns true while the player is moving.
 */
export function stepPlayer(world, player, input, dt) {
  let mx = input.mx;
  let my = input.my;
  const length = Math.sqrt(mx * mx + my * my);
  if (length > 1) { mx /= length; my /= length; }
  player.sneaking = !!input.sneak;
  player.sprinting = !!input.sprint && !input.sneak;
  const speed = player.sneaking ? SNEAK_SPEED : player.sprinting ? SPRINT_SPEED : WALK_SPEED;
  player.moving = length > 0.05;
  player.speed = player.moving ? speed : 0;
  if (!player.moving) return false;
  const nx = player.x + mx * speed * dt;
  const ny = player.y + my * speed * dt;
  const next = moveWithCollision(world, player.x, player.y, nx, ny, player.radius);
  player.x = next.x;
  player.y = next.y;
  player.facing = angleTo(0, 0, mx, my);
  // Footstep timing: faster steps while sprinting, slow while sneaking.
  player.stepTimer -= dt * (player.sprinting ? 2.1 : player.sneaking ? 0.7 : 1.3);
  if (player.stepTimer <= 0) {
    player.stepTimer = 0.42;
    player.stepSide = 1 - player.stepSide;
    world.events.push({ type: 'footstep', x: player.x, y: player.y, loud: player.sprinting });
  }
  return true;
}

/** Distance from the player to a point (used for loot and door prompts). */
export function playerDistanceTo(player, x, y) {
  return dist(player.x, player.y, x, y);
}
