// The three heists: hand-designed maps, patrol routes, cameras and loot.
// Map legend (each row is exactly 32 tiles, 18 rows):
//   # wall   . floor   s shadow floor (dark, safer)   C crate (cover, blocks sight)
//   G glass case (cover)   D locked door (lockpick)   L loot   B bonus loot
//   E exit   P player start
// Guards and cameras are placed by tile coordinates below each map.

import { TILE, tileCenter } from './config.js';

function parseMap(rows, theme) {
  const walls = [];
  const crates = [];
  const cases = [];
  const doors = [];
  const shadow = [];
  const loot = [];
  const bonus = [];
  let exit = null;
  let player = null;
  for (let row = 0; row < rows.length; row += 1) {
    for (let col = 0; col < rows[row].length; col += 1) {
      const ch = rows[row][col];
      const c = tileCenter(col, row);
      if (ch === '#') walls.push({ col, row });
      else if (ch === 'C') crates.push({ col, row, x: c.x, y: c.y });
      else if (ch === 'G') cases.push({ col, row, x: c.x, y: c.y });
      else if (ch === 'D') doors.push({ col, row, x: c.x, y: c.y, open: false });
      else if (ch === 's') shadow.push({ col, row });
      else if (ch === 'L') loot.push({ col, row, x: c.x, y: c.y, taken: false, kind: theme.lootKind });
      else if (ch === 'B') bonus.push({ col, row, x: c.x, y: c.y, taken: false, kind: 'bonus' });
      else if (ch === 'E') exit = { col, row, x: c.x, y: c.y };
      else if (ch === 'P') player = { col, row, x: c.x, y: c.y };
    }
  }
  return { walls, crates, cases, doors, shadow, loot, bonus, exit, player };
}

function guardDef(waypoints, pauseSeconds) {
  return { waypoints: waypoints.map(([col, row]) => tileCenter(col, row)), pauseSeconds: pauseSeconds ?? 1.4 };
}

function cameraDef(col, row, baseAngleDeg, sweepDeg, periodSeconds) {
  const c = tileCenter(col, row);
  return { x: c.x, y: c.y, baseAngle: (baseAngleDeg * Math.PI) / 180, sweep: (sweepDeg * Math.PI) / 180, period: periodSeconds };
}

export const LEVELS = [
  {
    id: 1,
    name: 'The Gilded Gallery',
    place: 'Museum of Fine Larceny',
    theme: { lootKind: 'painting', lootLabel: 'paintings', floorTint: '#2b2f3a' },
    parSeconds: 150,
    tools: { coins: 3, emp: 2, lockpicks: 1 },
    map: parseMap([
      '################################',
      '#P....s....#.........#....L....#',
      '#.....s....#.........#.........#',
      '#..C..s....#.C.....C.#.....C...#',
      '#.....s....D.........D.........#',
      '#.....s....#.........#.........#',
      '#..s..s...L#.....s...#.....s...#',
      '###.####.#######.#########.#####',
      '#..........#.........#.........#',
      '#..L.......#.........#....B....#',
      '#..........#.........#.........#',
      '#..s.......D.....s...D.....s...#',
      '#..s.......#.....s...#.....s..C#',
      '#..s.......#.....s...#.....s...#',
      '#..s.......#.....s...#.....s...#',
      '#.....C....#..C......#.......E.#',
      '#..............................#',
      '################################'
    ], { lootKind: 'painting' }),
    guards: [
      guardDef([[4, 2], [9, 2], [9, 5], [4, 5]]),
      guardDef([[24, 9], [29, 9], [29, 13], [24, 13]]),
    ],
    cameras: [
      cameraDef(15, 1, 90, 70, 5),
      cameraDef(24, 8, 180, 60, 6),
    ],
  },
  {
    id: 2,
    name: 'The Iron Vault',
    place: 'Meridian Bank, after hours',
    theme: { lootKind: 'gold', lootLabel: 'gold bars', floorTint: '#2e2b33' },
    parSeconds: 180,
    tools: { coins: 3, emp: 2, lockpicks: 2 },
    map: parseMap([
      '################################',
      '#P....s....#.........#....L....#',
      '#.....s....#..G......#.........#',
      '#..C..s....#.........D....C....#',
      '#.....s....D........C#.........#',
      '#.....s....#.........#....L....#',
      '#.....s....#.....s...#.....s...#',
      '###.####.#######.#########.#####',
      '#..........#.........#.........#',
      '#..L.......#..C...G..#....B....#',
      '#..........#.........#.........#',
      '#..s.......D.....s...D.....s...#',
      '#..s.......#.....s...#.....s...#',
      '#..s.......#.....s...#.....s...#',
      '#..s.......#.....s...#.....s...#',
      '#....C.....#.........#.......E.#',
      '#..............................#',
      '################################'
    ], { lootKind: 'gold' }),
    guards: [
      guardDef([[4, 2], [9, 2], [9, 5], [4, 5]]),
      guardDef([[17, 9], [22, 9], [22, 13], [17, 13]]),
      guardDef([[25, 2], [29, 2], [29, 5], [25, 5]], 1.0),
    ],
    cameras: [
      cameraDef(13, 1, 90, 80, 5),
      cameraDef(16, 8, 90, 60, 7),
      cameraDef(29, 11, 180, 70, 6),
    ],
  },
  {
    id: 3,
    name: 'The Starlight Penthouse',
    place: 'Casino Royale Suite, 41st floor',
    theme: { lootKind: 'jewel', lootLabel: 'jewels', floorTint: '#332b33' },
    parSeconds: 210,
    tools: { coins: 4, emp: 2, lockpicks: 2 },
    map: parseMap([
      '################################',
      '#P....s....#.........#....L....#',
      '#.....s....#..G......#.........#',
      '#..C..s.C..#.........#.....C...#',
      '#.....s....D........CD.........#',
      '#.....s....#.........#....L....#',
      '#..s..s...L#.....s...#.....s...#',
      '###.####.#######.#########.#####',
      '#..........#.........#.........#',
      '#..L.......#..C...G..#.....B...#',
      '#..........#.........#.........#',
      '#..s.......D.....s...D.....s...#',
      '#..s.......#.....s...#.....s..C#',
      '#..s.......#.....s...#.....s...#',
      '#..s.......#.....s...#.....s...#',
      '#..C.......#.........#.......E.#',
      '#..............................#',
      '################################'
    ], { lootKind: 'jewel' }),
    guards: [
      guardDef([[4, 2], [9, 2], [9, 5], [4, 5]]),
      guardDef([[17, 9], [22, 9], [22, 13], [17, 13]]),
      guardDef([[25, 2], [29, 2], [29, 5], [25, 5]], 1.0),
      guardDef([[9, 10], [13, 10], [13, 14], [9, 14]]),
    ],
    cameras: [
      cameraDef(14, 1, 90, 80, 5),
      cameraDef(24, 8, 180, 60, 6),
      cameraDef(16, 8, 0, 70, 7),
    ],
  },
];

/** Total loot (required, not counting bonus) across all levels. */
export function totalLoot() {
  return LEVELS.reduce((sum, level) => sum + level.map.loot.length, 0);
}

export { TILE };
