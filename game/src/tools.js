// The thief's tools, each with a cost: a thrown coin, an EMP pulse and a
// lockpick. Every use is limited per level, so the player spends them
// where they matter most.

import { COIN_THROW_RANGE, EMP_DURATION, LOCKPICK_SECONDS, dist } from './config.js';

/** Build the tool belt for a level (counts come from the level definition). */
export function makeTools(def) {
  return {
    coins: def.coins,
    emp: def.emp,
    lockpicks: def.lockpicks,
    coin: null, // the coin in flight / ringing on the floor, or null
    lockpicking: null, // {door, progress} while a lock is being picked
  };
}

/** Throw a coin toward (tx,ty). Returns false when none are left. */
export function throwCoin(world, tools, tx, ty) {
  if (tools.coins <= 0 || tools.coin) return false;
  const player = world.player;
  const d = dist(player.x, player.y, tx, ty);
  const range = Math.min(d, COIN_THROW_RANGE);
  const angle = Math.atan2(ty - player.y, tx - player.x);
  tools.coins -= 1;
  tools.coin = {
    startX: player.x,
    startY: player.y,
    x: player.x,
    y: player.y,
    targetX: player.x + Math.cos(angle) * range,
    targetY: player.y + Math.sin(angle) * range,
    t: 0,
    flightSeconds: 0.45,
    ringTimer: 0,
    ringing: false,
  };
  world.events.push({ type: 'coin-throw', x: player.x, y: player.y });
  return true;
}

/** Step the thrown coin: it arcs to its target, then rings and draws guards. */
export function stepCoin(world, tools, dt) {
  const coin = tools.coin;
  if (!coin) return;
  if (!coin.ringing) {
    coin.t += dt / coin.flightSeconds;
    const t = Math.min(coin.t, 1);
    coin.x = coin.startX + (coin.targetX - coin.startX) * t;
    coin.y = coin.startY + (coin.targetY - coin.startY) * t;
    if (coin.t >= 1) {
      coin.ringing = true;
      coin.ringTimer = 2.2;
      world.events.push({ type: 'coin-ring', x: coin.x, y: coin.y });
    }
    return;
  }
  coin.ringTimer -= dt;
  if (coin.ringTimer <= 0) tools.coin = null;
}

/** Fire an EMP: every camera goes dark for EMP_DURATION. */
export function fireEmp(world, tools) {
  if (tools.emp <= 0) return false;
  tools.emp -= 1;
  for (const camera of world.cameras) camera.disabledTimer = EMP_DURATION;
  world.events.push({ type: 'emp', x: world.player.x, y: world.player.y });
  return true;
}

/** Start picking a locked door the player stands next to. */
export function startLockpick(world, tools, door) {
  if (tools.lockpicks <= 0 || tools.lockpicking) return false;
  tools.lockpicking = { door, progress: 0 };
  return true;
}

/** Step an in-progress lockpick; opens the door when the channel finishes. */
export function stepLockpick(world, tools, dt) {
  const job = tools.lockpicking;
  if (!job) return;
  // Moving away or letting go of the door cancels the pick.
  const player = world.player;
  if (dist(player.x, player.y, job.door.x, job.door.y) > 52) {
    tools.lockpicking = null;
    return;
  }
  job.progress += dt / LOCKPICK_SECONDS;
  if (job.progress >= 1) {
    job.door.open = true;
    tools.lockpicks -= 1;
    tools.lockpicking = null;
    world.events.push({ type: 'unlock', x: job.door.x, y: job.door.y });
  }
}

/** The nearest locked door within reach of the player, or null. */
export function nearestLockedDoor(world, maxDistance) {
  let best = null;
  let bestDist = maxDistance;
  for (const door of world.doors) {
    if (door.open) continue;
    const d = dist(world.player.x, world.player.y, door.x, door.y);
    if (d < bestDist) { bestDist = d; best = door; }
  }
  return best;
}
