// The world: one level's live state and the rules that step it forward.
// The world owns the player, the guards, the cameras, the loot, the alarm
// meter and the score, and answers one question every frame: what happened?

import {
  ALARM_BUSTED, ALARM_DRAIN, ALARM_FILL_CAMERA, ALARM_FILL_GUARD,
  COIN_NOISE_RADIUS, SCORE_BONUS, SCORE_GHOST, SCORE_LOOT,
  SCORE_TIME_BONUS_PER_SECOND, TILE, clamp, dist, makeRng,
} from './config.js';
import { LEVELS } from './levels.js';
import { makePlayer, playerNoiseRadius, stepPlayer } from './player.js';
import {
  GUARD_ALARMED, GUARD_CALM, GUARD_SUSPICIOUS, guardTouchesPlayer, makeGuard, stepGuard,
} from './guards.js';
import { cameraSeesPlayer, makeCamera, stepCamera } from './cameras.js';
import { fireEmp, makeTools, nearestLockedDoor, startLockpick, stepCoin, stepLockpick, throwCoin } from './tools.js';
import { inShadow } from './vision.js';

export const STATUS_PLAYING = 'playing';
export const STATUS_BUSTED = 'busted';
export const STATUS_LEVEL_COMPLETE = 'level-complete';
export const STATUS_VICTORY = 'victory';

/** Build a fresh world for a level (index 0..2). */
export function makeWorld(levelIndex, totalScore, rngSeed) {
  const def = LEVELS[levelIndex];
  const map = def.map;
  const rng = makeRng(rngSeed ?? 1);
  const world = {
    levelIndex,
    def,
    rng,
    time: 0,
    status: STATUS_PLAYING,
    statusTimer: 0,
    score: totalScore,
    levelScore: 0,
    alarm: 0,
    maxAlarm: 0,
    lootCollected: 0,
    lootTotal: map.loot.length,
    bonusCollected: 0,
    events: [],
    shake: 0,
    hint: '',
    hintTimer: 0,
    player: makePlayer(map.player),
    guards: def.guards.map((g, i) => makeGuard(g, i)),
    cameras: def.cameras.map((c, i) => makeCamera(c, i)),
    tools: makeTools(def.tools),
    doors: map.doors,
    loot: map.loot.map((item) => ({ ...item })),
    bonus: map.bonus.map((item) => ({ ...item })),
    exit: map.exit,
    wallSet: new Set(map.walls.map((w) => w.col + ',' + w.row)),
    crateSet: new Set(map.crates.map((c) => c.col + ',' + c.row)),
    caseSet: new Set(map.cases.map((c) => c.col + ',' + c.row)),
    shadowSet: new Set(map.shadow.map((s) => s.col + ',' + s.row)),
    doorByKey: new Map(map.doors.map((d) => [d.col + ',' + d.row, d])),
    crates: map.crates,
    cases: map.cases,
    ghost: true,
  };
  return world;
}

/** Advance the world one step. actions holds edge-triggered inputs for this step. */
export function stepWorld(world, input, dt) {
  if (world.status !== STATUS_PLAYING) {
    world.statusTimer += dt;
    return;
  }
  world.time += dt;
  world.events.length = 0;

  // --- Tools (edge-triggered) ---
  if (input.emp) fireEmp(world, world.tools);
  if (input.coinTarget) throwCoin(world, world.tools, input.coinTarget.x, input.coinTarget.y);
  if (input.interact) useInteract(world);

  stepPlayer(world, world.player, input, dt);
  stepCoin(world, world.tools, dt);
  stepLockpick(world, world.tools, dt);

  // --- Hearing: a moving thief draws nearby calm guards to investigate. ---
  const noise = playerNoiseRadius(world.player);
  if (noise > 0) {
    for (const guard of world.guards) {
      if (guard.state !== GUARD_CALM) continue;
      if (dist(guard.x, guard.y, world.player.x, world.player.y) < noise + 30) {
        investigateNoise(world, guard, world.player.x, world.player.y);
      }
    }
  }

  // --- Guards and cameras ---
  let anyoneSees = false;
  let guardSpotting = false;
  let cameraSpotting = false;
  for (const guard of world.guards) {
    const seeing = stepGuard(world, guard, world.player, dt, world.events);
    if (seeing && guard.spot > 0.25) { anyoneSees = true; guardSpotting = true; }
    if (guardTouchesPlayer(guard, world.player)) {
      bustWorld(world, 'A guard grabbed you in the dark.');
      return;
    }
  }
  for (const camera of world.cameras) {
    if (stepCamera(world, camera, world.player, dt)) { anyoneSees = true; cameraSpotting = true; }
  }

  // --- Alarm meter: fills under eyes, drains in the dark. ---
  let fill = 0;
  if (guardSpotting) fill += ALARM_FILL_GUARD;
  if (cameraSpotting) fill += ALARM_FILL_CAMERA;
  if (fill > 0) {
    world.alarm = clamp(world.alarm + fill * dt, 0, ALARM_BUSTED);
    world.shake = Math.max(world.shake, cameraSpotting ? 3 : 2);
  } else {
    world.alarm = clamp(world.alarm - ALARM_DRAIN * dt, 0, ALARM_BUSTED);
  }
  world.maxAlarm = Math.max(world.maxAlarm, world.alarm);
  if (world.maxAlarm > 50) world.ghost = false;
  if (world.alarm >= ALARM_BUSTED) {
    bustWorld(world, 'The alarm hit full — the building locked down.');
    return;
  }

  // --- Coin ring draws guards to the clink. ---
  const coin = world.tools.coin;
  if (coin && coin.ringing) {
    for (const guard of world.guards) {
      if (guard.state === GUARD_CALM && dist(guard.x, guard.y, coin.x, coin.y) < COIN_NOISE_RADIUS) {
        investigateNoise(world, guard, coin.x, coin.y);
      }
    }
  }

  // --- Exit: open only once every painting, bar or jewel is pocketed. ---
  if (input.interact) {
    // (interact was already handled above; the exit check lives there too)
  }
  if (world.hintTimer > 0) world.hintTimer -= dt;
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 14);
}

/** E key / click: grab loot, pick a lock, or slip out the exit. */
function useInteract(world) {
  const player = world.player;
  // Grab the nearest loot in reach.
  for (const item of [...world.loot, ...world.bonus]) {
    if (item.taken) continue;
    if (dist(player.x, player.y, item.x, item.y) < 46) {
      item.taken = true;
      const points = item.kind === 'bonus' ? SCORE_BONUS : SCORE_LOOT;
      world.levelScore += points;
      world.score += points;
      if (item.kind === 'bonus') world.bonusCollected += 1;
      else world.lootCollected += 1;
      world.events.push({ type: 'pickup', x: item.x, y: item.y, bonus: item.kind === 'bonus' });
      return;
    }
  }
  // Pick the nearest locked door in reach.
  const door = nearestLockedDoor(world, 52);
  if (door) {
    if (world.tools.lockpicks > 0) {
      startLockpick(world, world.tools, door);
      world.events.push({ type: 'pick-start', x: door.x, y: door.y });
    } else {
      setHint(world, 'Locked — no lockpicks left.');
    }
    return;
  }
  // Slip out the exit once the loot is all pocketed.
  if (dist(player.x, player.y, world.exit.x, world.exit.y) < 52) {
    if (world.lootCollected >= world.lootTotal) {
      completeLevel(world);
    } else {
      setHint(world, `The getaway is shut — ${world.lootTotal - world.lootCollected} ${world.def.theme.lootLabel} still inside.`);
    }
  }
}

/** A guard heard something: go look, quietly at first. */
function investigateNoise(world, guard, x, y) {
  guard.state = GUARD_SUSPICIOUS;
  guard.lastSeenX = x;
  guard.lastSeenY = y;
  guard.suspiciousTimer = 1.0;
  world.events.push({ type: 'heard', x: guard.x, y: guard.y });
}

/** The level is done: time bonus, ghost bonus, and on to the next heist. */
function completeLevel(world) {
  const timeBonus = Math.max(0, Math.round((world.def.parSeconds - world.time) * SCORE_TIME_BONUS_PER_SECOND));
  const ghostBonus = world.ghost ? SCORE_GHOST : 0;
  world.levelScore += timeBonus + ghostBonus;
  world.score += timeBonus + ghostBonus;
  world.timeBonus = timeBonus;
  world.ghostBonus = ghostBonus;
  world.status = world.levelIndex >= LEVELS.length - 1 ? STATUS_VICTORY : STATUS_LEVEL_COMPLETE;
  world.statusTimer = 0;
  world.events.push({ type: 'level-complete', x: world.player.x, y: world.player.y });
}

/** Caught: the run ends here, with a reason. */
function bustWorld(world, reason) {
  world.status = STATUS_BUSTED;
  world.statusTimer = 0;
  world.bustReason = reason;
  world.events.push({ type: 'busted', x: world.player.x, y: world.player.y });
  world.shake = 8;
}

function setHint(world, text) {
  world.hint = text;
  world.hintTimer = 3;
}

/** Is the thief standing in a shadow tile right now? */
export function playerInShadow(world) {
  return inShadow(world, world.player.x, world.player.y);
}

/** Highest current alert among guards and cameras, for the HUD. */
export function currentAlert(world) {
  for (const guard of world.guards) {
    if (guard.state === GUARD_ALARMED) return 'ALARMED';
  }
  for (const camera of world.cameras) {
    if (cameraSeesPlayer(world, camera, world.player)) return 'SPOTTED';
  }
  for (const guard of world.guards) {
    if (guard.state === GUARD_SUSPICIOUS) return 'SUSPICIOUS';
  }
  return 'CALM';
}

export { TILE };
