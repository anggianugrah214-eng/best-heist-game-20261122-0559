// Screenshot scenes for ?shot=start|play|alert|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, so the frame
// is what a short game really looks like and the same seed always gives the
// same frame. The cover (start) is the title over a live level; play is a
// mid-heist moment with cones, loot and the alarm meter in one frame; alert
// is the chase at high alarm; end is the victory screen.

import { TILE } from './config.js';
import { makeWorld, stepWorld } from './world.js';
import { SCREEN_BUSTED, SCREEN_LEVEL_COMPLETE, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { GUARD_ALARMED, GUARD_SUSPICIOUS } from './guards.js';

const STEP = 1 / 60;
const IDLE = { mx: 0, my: 0, sneak: false, sprint: false, interact: false, emp: false, coinTarget: null };

/** Step the world N times at a fixed dt. */
function run(world, steps, input) {
  for (let i = 0; i < steps; i += 1) stepWorld(world, input || IDLE, STEP);
}

/** Steer along a scripted sneak path (tile waypoints) toward the first loot. */
function sneakPathInput(world, waypoints) {
  const player = world.player;
  const target = waypoints[0];
  if (!target) return IDLE;
  const tx = target.col * TILE + TILE / 2;
  const ty = target.row * TILE + TILE / 2;
  const dx = tx - player.x;
  const dy = ty - player.y;
  if (Math.hypot(dx, dy) < 12) {
    waypoints.shift();
    return sneakPathInput(world, waypoints);
  }
  const mx = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
  const my = Math.abs(dy) > 12 ? Math.sign(dy) : 0;
  return { mx, my, sneak: true, sprint: false, interact: false, emp: false, coinTarget: null };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Any unknown name is the start scene.
 */
export function stageShot(name, game) {
  if (name === 'play') return stagePlay(game);
  if (name === 'alert') return stageAlert(game);
  if (name === 'end') return stageEnd(game);
  return stageStart(game);
}

/** Title over a live level: the thief sneaks down the shadow strip toward the first painting. */
function stageStart(game) {
  game.world = makeWorld(0, 0, 1);
  const path = [
    { col: 6, row: 1 },
    { col: 6, row: 5 },
    { col: 10, row: 5 },
    { col: 10, row: 6 },
  ];
  for (let i = 0; i < 5 / STEP; i += 1) {
    stepWorld(game.world, sneakPathInput(game.world, path), STEP);
  }
  game.world.alarm = 12;
  return SCREEN_TITLE;
}

/** Mid-heist: thief in cover by the vault wing, a guard's cone sweeping past,
 *  a camera cone overhead, one painting pocketed, alarm at a third. */
function stagePlay(game) {
  const world = makeWorld(0, 0, 1);
  game.world = world;
  // One painting already pocketed.
  world.loot[0].taken = true;
  world.lootCollected = 1;
  world.levelScore = 500;
  world.score = 500;
  // The thief crouches in the shadow strip by the east wing, facing the gold.
  world.player.x = 25 * TILE + 20;
  world.player.y = 5 * TILE + 20;
  world.player.facing = Math.PI / 2;
  world.player.sneaking = true;
  // The east guard is suspicious, sniffing around the same wing.
  const guard = world.guards[1];
  guard.x = 24 * TILE + 20;
  guard.y = 9 * TILE + 20;
  guard.state = GUARD_SUSPICIOUS;
  guard.suspiciousTimer = 1.0;
  guard.lastSeenX = world.player.x;
  guard.lastSeenY = world.player.y;
  guard.spot = 0.55;
  guard.facing = -Math.PI / 2;
  // The west guard patrols on, calm.
  run(world, Math.round(1.2 / STEP), { ...IDLE, sneak: true });
  world.alarm = 32;
  world.maxAlarm = 32;
  return SCREEN_PLAY;
}

/** The chase: a guard is on the thief, the camera has spotted them too,
 *  and the alarm meter is nearly full. */
function stageAlert(game) {
  const world = makeWorld(0, 0, 1);
  game.world = world;
  world.loot[0].taken = true;
  world.loot[1].taken = true;
  world.lootCollected = 2;
  world.levelScore = 1000;
  world.score = 1000;
  // The thief is cornered in the east wing, sprinting for the corridor.
  world.player.x = 26 * TILE + 20;
  world.player.y = 10 * TILE + 20;
  world.player.facing = Math.PI;
  world.player.sprinting = true;
  // The east guard is in full chase, closing in.
  const guard = world.guards[1];
  guard.x = 26 * TILE + 20;
  guard.y = 13 * TILE + 20;
  guard.state = GUARD_ALARMED;
  guard.spot = 1;
  guard.lastSeenX = world.player.x;
  guard.lastSeenY = world.player.y;
  guard.facing = -Math.PI / 2;
  // The west guard heard the commotion and is coming to look.
  const other = world.guards[0];
  other.state = GUARD_SUSPICIOUS;
  other.suspiciousTimer = 1.2;
  other.lastSeenX = world.player.x;
  other.lastSeenY = world.player.y;
  other.spot = 0.6;
  // The east camera has the thief in its cone.
  const camera = world.cameras[1];
  camera.facing = Math.atan2(world.player.y - camera.y, world.player.x - camera.x);
  camera.spot = 1;
  run(world, Math.round(0.5 / STEP), IDLE);
  world.alarm = 84;
  world.maxAlarm = 84;
  world.shake = 2;
  return SCREEN_PLAY;
}

/** The payoff: all three heists done, the victory screen over the penthouse. */
function stageEnd(game) {
  const world = makeWorld(2, 7400, 1);
  game.world = world;
  world.loot.forEach((item) => { item.taken = true; });
  world.lootCollected = world.lootTotal;
  world.levelScore = 2450;
  world.score = 9850;
  world.time = 168;
  world.timeBonus = 168;
  world.ghostBonus = 500;
  world.status = 'victory';
  world.player.x = 28 * TILE + 20;
  world.player.y = 15 * TILE + 20;
  run(world, Math.round(0.8 / STEP), IDLE);
  return SCREEN_VICTORY;
}

export { SCREEN_BUSTED, SCREEN_LEVEL_COMPLETE };
