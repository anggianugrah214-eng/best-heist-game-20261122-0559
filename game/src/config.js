// Shared tuning and palette for Velvet Midnight, a top-down heist game.
// Every number that shapes how the game feels lives here so the other
// modules can stay about behaviour, not magic constants.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;

// --- Player movement (pixels per second) ---
export const PLAYER_RADIUS = 12;
export const WALK_SPEED = 168;
export const SNEAK_SPEED = 92;
export const SPRINT_SPEED = 248;

// --- Vision and hearing ---
export const GUARD_VIEW_RANGE = 235;
export const GUARD_VIEW_HALF_ANGLE = 0.56; // radians, ~32 degrees each side
export const CAMERA_VIEW_RANGE = 250;
export const CAMERA_VIEW_HALF_ANGLE = 0.42;
export const SHADOW_SPOT_FACTOR = 0.38; // how much slower a hidden thief is seen
export const SNEAK_SPOT_FACTOR = 0.45;
export const SPRINT_SPOT_FACTOR = 1.6;
export const SPOT_RATE = 1.35; // detection per second at point-blank, full light
export const SPOT_DECAY = 0.55; // detection lost per second while unseen
export const HEAR_WALK = 62; // guards hear walking this close
export const HEAR_SPRINT = 125;
export const HEAR_SNEAK = 22;
export const COIN_NOISE_RADIUS = 300;

// --- Alarm meter (0..100) ---
export const ALARM_FILL_GUARD = 26; // per second while a guard is spotting you
export const ALARM_FILL_CAMERA = 34; // per second while a camera is spotting you
export const ALARM_DRAIN = 7; // per second while nobody sees you
export const ALARM_BUSTED = 100;

// --- Tools ---
export const COIN_THROW_RANGE = 280;
export const EMP_DURATION = 6; // seconds cameras stay dark
export const LOCKPICK_SECONDS = 1.2;

// --- Scoring ---
export const SCORE_LOOT = 500;
export const SCORE_BONUS = 250;
export const SCORE_GHOST = 500; // finishing a level with the alarm never over 50
export const SCORE_TIME_BONUS_PER_SECOND = 4;

// --- Colours ---
export const PALETTE = {
  floorA: '#2b2f3a',
  floorB: '#262a34',
  floorEdge: '#1d2029',
  shadowFloorA: '#1c2130',
  shadowFloorB: '#181d2a',
  wallTop: '#4a5165',
  wallFace: '#2e3342',
  wallEdge: '#171a23',
  crate: '#6b4f2a',
  crateTop: '#8a6a3c',
  caseGlass: '#3d5a74',
  caseFrame: '#c9a227',
  lootGlow: '#ffd94a',
  exitGlow: '#39d98a',
  playerCloak: '#2b2f45',
  playerHood: '#7b5cff',
  guardCalm: '#3e6b8f',
  guardSuspicious: '#d98a2b',
  guardAlarmed: '#d93b3b',
  coneCalm: 'rgba(255, 214, 90, 0.20)',
  coneSuspicious: 'rgba(255, 150, 40, 0.28)',
  coneAlarmed: 'rgba(255, 60, 60, 0.34)',
  cameraCone: 'rgba(255, 80, 90, 0.22)',
  cameraOff: 'rgba(120, 130, 150, 0.10)',
  hudBg: 'rgba(10, 12, 20, 0.72)',
  text: '#f2ead8',
  muted: '#a9b0c2',
};

/** Deterministic random stream (mulberry32) so shot scenes replay exactly. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamp a number into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Angle from (ax,ay) to (bx,by). */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Centre of a tile, in pixels. */
export function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}
