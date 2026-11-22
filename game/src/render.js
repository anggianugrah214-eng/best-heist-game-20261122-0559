// Rendering: the whole look of the game on one canvas — the room, the
// vision cones, the loot, the HUD with its alarm meter and minimap, and
// every screen from the title to the victory lap.

import {
  CAMERA_VIEW_HALF_ANGLE, CAMERA_VIEW_RANGE, GUARD_VIEW_RANGE, PALETTE,
  TILE, VIEW_H, VIEW_W, clamp,
} from './config.js';
import { currentAlert, playerInShadow } from './world.js';
import { guardConeHalfAngle, guardStateColour } from './guards.js';
import { cameraIsDark } from './cameras.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_HELP = 'help';
export const SCREEN_INTRO = 'intro';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL_COMPLETE = 'level-complete';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_VICTORY = 'victory';

const TITLE_FONT = '700 84px Georgia, "Times New Roman", serif';
const HEADING_FONT = '700 44px Georgia, "Times New Roman", serif';
const BODY_FONT = '16px system-ui, -apple-system, "Segoe UI", sans-serif';
const SMALL_FONT = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
const HUD_FONT = '600 15px system-ui, -apple-system, "Segoe UI", sans-serif';
const BIG_HUD_FONT = '700 17px system-ui, -apple-system, "Segoe UI", sans-serif';

/** Draw the whole frame for the current screen. */
export function render(ctx, world, screen, ui) {
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (world.shake > 0.2) {
    const s = world.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawFloor(ctx, world);
  drawExit(ctx, world);
  drawLoot(ctx, world);
  drawDoors(ctx, world);
  drawCratesAndCases(ctx, world);
  drawWalls(ctx, world);
  drawCameraCones(ctx, world);
  drawGuardCones(ctx, world);
  drawCoin(ctx, world);
  drawCameras(ctx, world);
  drawGuards(ctx, world);
  drawPlayer(ctx, world);
  ctx.restore();

  drawHud(ctx, world, screen);
  drawMinimap(ctx, world);
  drawHint(ctx, world);
  drawLockpick(ctx, world);

  if (screen === SCREEN_TITLE) drawTitle(ctx, world, ui);
  else if (screen === SCREEN_HELP) drawHelp(ctx, world);
  else if (screen === SCREEN_INTRO) drawIntro(ctx, world);
  else if (screen === SCREEN_PAUSED) drawPaused(ctx);
  else if (screen === SCREEN_LEVEL_COMPLETE) drawLevelComplete(ctx, world);
  else if (screen === SCREEN_BUSTED) drawBusted(ctx, world);
  else if (screen === SCREEN_VICTORY) drawVictory(ctx, world);
  drawInteractPrompt(ctx, world, screen);
}

/* ---------------- The room ---------------- */

function drawFloor(ctx, world) {
  for (let row = 0; row < 18; row += 1) {
    for (let col = 0; col < 32; col += 1) {
      const x = col * TILE;
      const y = row * TILE;
      const shadow = world.shadowSet.has(col + ',' + row);
      const wall = world.wallSet.has(col + ',' + row);
      if (wall) continue;
      const even = (col + row) % 2 === 0;
      ctx.fillStyle = shadow ? (even ? PALETTE.shadowFloorA : PALETTE.shadowFloorB)
        : (even ? PALETTE.floorA : PALETTE.floorB);
      ctx.fillRect(x, y, TILE, TILE);
      if (shadow) {
        ctx.fillStyle = 'rgba(90, 120, 200, 0.10)';
        ctx.fillRect(x, y, TILE, TILE);
      }
    }
  }
  // Soft rug in the middle of each strip, for a lived-in look.
  ctx.fillStyle = 'rgba(120, 40, 60, 0.16)';
  ctx.fillRect(3 * TILE, 8 * TILE, 7 * TILE, 7 * TILE);
  ctx.fillStyle = 'rgba(40, 90, 120, 0.14)';
  ctx.fillRect(13 * TILE, 8 * TILE, 7 * TILE, 7 * TILE);
  ctx.fillStyle = 'rgba(120, 90, 30, 0.13)';
  ctx.fillRect(23 * TILE, 8 * TILE, 7 * TILE, 7 * TILE);
}

function drawWalls(ctx, world) {
  for (const wall of world.def.map.walls) {
    const x = wall.col * TILE;
    const y = wall.row * TILE;
    ctx.fillStyle = PALETTE.wallFace;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PALETTE.wallTop;
    ctx.fillRect(x, y, TILE, 6);
    ctx.fillStyle = PALETTE.wallEdge;
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
    ctx.fillRect(x, y, 2, TILE);
  }
}

function drawCratesAndCases(ctx, world) {
  for (const crate of world.crates) {
    const x = crate.col * TILE;
    const y = crate.row * TILE;
    ctx.fillStyle = PALETTE.crate;
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = PALETTE.crateTop;
    ctx.fillRect(x + 3, y + 3, TILE - 6, 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + TILE - 3, y + TILE - 3);
    ctx.moveTo(x + TILE - 3, y + 3);
    ctx.lineTo(x + 3, y + TILE - 3);
    ctx.stroke();
  }
  for (const glass of world.cases) {
    const x = glass.col * TILE;
    const y = glass.row * TILE;
    ctx.fillStyle = PALETTE.caseFrame;
    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.fillStyle = PALETTE.caseGlass;
    ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x + 10, y + 10, 6, TILE - 20);
  }
}

function drawDoors(ctx, world) {
  for (const door of world.doors) {
    const x = door.col * TILE;
    const y = door.row * TILE;
    if (door.open) {
      ctx.fillStyle = 'rgba(20, 24, 34, 0.9)';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.strokeStyle = PALETTE.exitGlow;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      continue;
    }
    ctx.fillStyle = '#3a2f22';
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + TILE / 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(201, 162, 39, 0.9)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOCKED', x + TILE / 2, y + TILE - 6);
  }
}

function drawLoot(ctx, world) {
  const pulse = 0.75 + Math.sin(world.time * 3) * 0.25;
  for (const item of [...world.loot, ...world.bonus]) {
    if (item.taken) continue;
    const glow = item.kind === 'bonus' ? 'rgba(120, 220, 255, 0.35)' : 'rgba(255, 217, 74, 0.35)';
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 22 * pulse + 6, 0, Math.PI * 2);
    ctx.fill();
    if (item.kind === 'painting') drawPainting(ctx, item);
    else if (item.kind === 'gold') drawGold(ctx, item);
    else if (item.kind === 'jewel') drawJewel(ctx, item);
    else drawBonusGem(ctx, item);
  }
}

function drawPainting(ctx, item) {
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(item.x - 13, item.y - 10, 26, 20);
  ctx.fillStyle = '#7b2d3b';
  ctx.fillRect(item.x - 10, item.y - 7, 20, 14);
  ctx.fillStyle = '#e8c85a';
  ctx.beginPath();
  ctx.arc(item.x - 3, item.y - 1, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2d5a7b';
  ctx.fillRect(item.x + 2, item.y + 2, 6, 4);
}

function drawGold(ctx, item) {
  ctx.fillStyle = '#ffd94a';
  ctx.fillRect(item.x - 12, item.y - 2, 24, 8);
  ctx.fillStyle = '#e8b93a';
  ctx.fillRect(item.x - 9, item.y - 9, 18, 8);
  ctx.fillStyle = '#fff3b0';
  ctx.fillRect(item.x - 9, item.y - 9, 18, 3);
}

function drawJewel(ctx, item) {
  ctx.fillStyle = '#7ee7ff';
  ctx.beginPath();
  ctx.moveTo(item.x, item.y - 12);
  ctx.lineTo(item.x + 10, item.y);
  ctx.lineTo(item.x, item.y + 12);
  ctx.lineTo(item.x - 10, item.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(item.x, item.y - 12);
  ctx.lineTo(item.x + 5, item.y - 2);
  ctx.lineTo(item.x - 5, item.y - 2);
  ctx.closePath();
  ctx.fill();
}

function drawBonusGem(ctx, item) {
  ctx.fillStyle = '#b78cff';
  ctx.beginPath();
  ctx.moveTo(item.x, item.y - 9);
  ctx.lineTo(item.x + 8, item.y);
  ctx.lineTo(item.x, item.y + 9);
  ctx.lineTo(item.x - 8, item.y);
  ctx.closePath();
  ctx.fill();
}

function drawExit(ctx, world) {
  const exit = world.exit;
  const open = world.lootCollected >= world.lootTotal;
  const pulse = open ? 0.6 + Math.sin(world.time * 4) * 0.4 : 0.25;
  ctx.fillStyle = `rgba(57, 217, 138, ${0.25 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.arc(exit.x, exit.y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = open ? '#39d98a' : '#2a7a52';
  ctx.fillRect(exit.x - 14, exit.y - 16, 28, 32);
  ctx.fillStyle = '#0b1f16';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', exit.x, exit.y - 20);
  ctx.fillStyle = '#eafff3';
  ctx.beginPath();
  ctx.moveTo(exit.x - 6, exit.y - 6);
  ctx.lineTo(exit.x + 6, exit.y);
  ctx.lineTo(exit.x - 6, exit.y + 6);
  ctx.closePath();
  ctx.fill();
}

/* ---------------- Cones, guards, cameras, player ---------------- */

function drawCone(ctx, x, y, facing, range, halfAngle, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, facing - halfAngle, facing + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = fill.replace(/0\.\d+\)$/, '0.55)');
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGuardCones(ctx, world) {
  for (const guard of world.guards) {
    const half = guardConeHalfAngle(guard);
    let fill = PALETTE.coneCalm;
    if (guard.state === 'alarmed') fill = PALETTE.coneAlarmed;
    else if (guard.state === 'suspicious' || guard.state === 'search') fill = PALETTE.coneSuspicious;
    drawCone(ctx, guard.x, guard.y, guard.facing, GUARD_VIEW_RANGE, half, fill);
  }
}

function drawCameraCones(ctx, world) {
  for (const camera of world.cameras) {
    const fill = cameraIsDark(camera) ? PALETTE.cameraOff : PALETTE.cameraCone;
    drawCone(ctx, camera.x, camera.y, camera.facing, CAMERA_VIEW_RANGE, CAMERA_VIEW_HALF_ANGLE, fill);
  }
}

function drawGuards(ctx, world) {
  for (const guard of world.guards) {
    const colour = guardStateColour(guard);
    // Body
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(guard.x, guard.y + 10, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dfe6f2';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick
    ctx.strokeStyle = '#0e1420';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y);
    ctx.lineTo(guard.x + Math.cos(guard.facing) * 16, guard.y + Math.sin(guard.facing) * 16);
    ctx.stroke();
    // Spot meter over the head while the guard is noticing you.
    if (guard.spot > 0.05 && guard.spot < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(guard.x - 14, guard.y - 26, 28, 5);
      ctx.fillStyle = guard.spot > 0.6 ? '#ff5a4a' : '#ffd65a';
      ctx.fillRect(guard.x - 13, guard.y - 25, 26 * guard.spot, 3);
    }
    // Alert marks: above the head, or below it when the guard patrols near
    // the top of the room so the mark never collides with the HUD bar.
    const markY = guard.y < 112 ? guard.y + 34 : guard.y - 30;
    if (guard.state === 'alarmed') {
      ctx.fillStyle = '#ff5a4a';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', guard.x, markY);
    } else if (guard.state === 'suspicious' || guard.state === 'search') {
      ctx.fillStyle = '#ffb347';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', guard.x, markY);
    }
  }
}

function drawCameras(ctx, world) {
  for (const camera of world.cameras) {
    const dark = cameraIsDark(camera);
    ctx.fillStyle = dark ? '#5a6272' : '#c23b4a';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dark ? '#2a2f3a' : '#ffd65a';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(camera.facing) * 4, camera.y + Math.sin(camera.facing) * 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (dark) {
      ctx.fillStyle = '#9aa4b5';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('OFFLINE', camera.x, camera.y - 14);
    } else if (camera.spot > 0) {
      ctx.fillStyle = '#ff5a4a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPOTTED', camera.x, camera.y - 14);
    }
  }
}

function drawCoin(ctx, world) {
  const coin = world.tools.coin;
  if (!coin) return;
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a87f1f';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (coin.ringing) {
    const r = 14 + Math.sin(world.time * 10) * 6;
    ctx.strokeStyle = 'rgba(255, 217, 74, 0.7)';
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPlayer(ctx, world) {
  const player = world.player;
  const shadow = playerInShadow(world);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 9, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Cloak
  ctx.fillStyle = shadow ? '#23263a' : PALETTE.playerCloak;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.sneaking ? 10 : 12, 0, Math.PI * 2);
  ctx.fill();
  // Hood
  ctx.fillStyle = PALETTE.playerHood;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 7, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick
  ctx.strokeStyle = '#e8e4ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.facing) * 13, player.y + Math.sin(player.facing) * 13);
  ctx.stroke();
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(232, 228, 255, 0.85)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAK', player.x, player.y - 18);
  }
  if (world.tools.lockpicking) {
    ctx.fillStyle = '#ffd65a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PICKING…', player.x, player.y - 18);
  }
}

/* ---------------- HUD, minimap, prompts ---------------- */

function drawHud(ctx, world, screen) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, 46);
  ctx.fillStyle = PALETTE.text;
  ctx.font = BIG_HUD_FONT;
  ctx.textAlign = 'left';
  ctx.fillText(`${world.levelIndex + 1} · ${world.def.name}`, 14, 29);
  ctx.font = HUD_FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`TIME ${formatTime(world.time)}`, 300, 29);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`SCORE ${world.score}`, 430, 29);
  ctx.fillText(`LOOT ${world.lootCollected}/${world.lootTotal}`, 560, 29);
  if (world.bonusCollected > 0) {
    ctx.fillStyle = '#b78cff';
    ctx.fillText(`+${world.bonusCollected} BONUS`, 650, 29);
  }

  // Alarm meter
  const meterX = 800;
  const meterW = 220;
  ctx.fillStyle = '#0a0c14';
  ctx.fillRect(meterX - 2, 12, meterW + 4, 22);
  const alarmRatio = clamp(world.alarm / 100, 0, 1);
  const alarmColour = world.alarm > 70 ? '#ff3b30' : world.alarm > 35 ? '#ff9f2e' : '#ffd65a';
  ctx.fillStyle = alarmColour;
  ctx.fillRect(meterX, 14, meterW * alarmRatio, 18);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(meterX - 2, 12, meterW + 4, 22);
  ctx.fillStyle = PALETTE.text;
  ctx.font = HUD_FONT;
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', meterX - 62, 29);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(world.alarm)}%`, meterX + meterW + 52, 29);

  // Alert indicator
  const alert = currentAlert(world);
  const alertColour = alert === 'ALARMED' ? '#ff3b30' : alert === 'SPOTTED' ? '#ff5a4a' : alert === 'SUSPICIOUS' ? '#ff9f2e' : '#7ee787';
  ctx.fillStyle = alertColour;
  ctx.font = BIG_HUD_FONT;
  ctx.textAlign = 'right';
  ctx.fillText(alert, VIEW_W - 14, 29);

  // Tools row under the bar
  ctx.fillStyle = PALETTE.muted;
  ctx.font = HUD_FONT;
  ctx.textAlign = 'left';
  const t = world.tools;
  ctx.fillText(`COIN ${t.coins}   EMP ${t.emp}   PICK ${t.lockpicks}`, 14, 66);
  ctx.fillStyle = PALETTE.muted;
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · SHIFT sneak · X sprint · SPACE coin · E use · Q EMP · P pause', VIEW_W - 14, 66);
}

function drawMinimap(ctx, world) {
  const scale = 200 / (32 * TILE);
  const mw = 32 * TILE * scale;
  const mh = 18 * TILE * scale;
  const mx = VIEW_W - mw - 12;
  const my = VIEW_H - mh - 12;
  ctx.fillStyle = 'rgba(8, 10, 18, 0.8)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
  for (const wall of world.def.map.walls) {
    ctx.fillStyle = '#4a5165';
    ctx.fillRect(mx + wall.col * TILE * scale, my + wall.row * TILE * scale, TILE * scale, TILE * scale);
  }
  for (const door of world.doors) {
    ctx.fillStyle = door.open ? '#39d98a' : '#c9a227';
    ctx.fillRect(mx + door.col * TILE * scale, my + door.row * TILE * scale, TILE * scale, TILE * scale);
  }
  for (const item of [...world.loot, ...world.bonus]) {
    if (item.taken) continue;
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(mx + item.x * scale - 2, my + item.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#39d98a';
  ctx.fillRect(mx + world.exit.x * scale - 3, my + world.exit.y * scale - 3, 6, 6);
  for (const camera of world.cameras) {
    ctx.fillStyle = cameraIsDark(camera) ? '#5a6272' : '#ff5a4a';
    ctx.beginPath();
    ctx.arc(mx + camera.x * scale, my + camera.y * scale, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const guard of world.guards) {
    ctx.fillStyle = guardStateColour(guard);
    ctx.beginPath();
    ctx.arc(mx + guard.x * scale, my + guard.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + world.player.x * scale, my + world.player.y * scale, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7b5cff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHint(ctx, world) {
  if (world.hintTimer <= 0 || !world.hint) return;
  ctx.fillStyle = 'rgba(10, 12, 20, 0.8)';
  const w = ctx.measureText(world.hint).width + 28;
  ctx.fillRect((VIEW_W - w) / 2, VIEW_H - 84, w, 30);
  ctx.fillStyle = '#ffd65a';
  ctx.font = HUD_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(world.hint, VIEW_W / 2, VIEW_H - 64);
}

function drawLockpick(ctx, world) {
  const job = world.tools.lockpicking;
  if (!job) return;
  const w = 90;
  const x = job.door.x - w / 2;
  const y = job.door.y - 34;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 2, y - 2, w + 4, 10);
  ctx.fillStyle = '#ffd65a';
  ctx.fillRect(x, y, w * clamp(job.progress, 0, 1), 6);
}

function drawInteractPrompt(ctx, world, screen) {
  if (screen !== SCREEN_PLAY) return;
  const player = world.player;
  let text = null;
  for (const item of [...world.loot, ...world.bonus]) {
    if (!item.taken && Math.hypot(player.x - item.x, player.y - item.y) < 46) {
      text = item.kind === 'bonus' ? 'E — Pocket the bonus gem' : `E — Grab the ${item.kind}`;
      break;
    }
  }
  if (!text) {
    const door = world.doors.find((d) => !d.open && Math.hypot(player.x - d.x, player.y - d.y) < 52);
    if (door) text = world.tools.lockpicks > 0 ? 'E — Pick the lock' : 'Locked door — no lockpicks';
  }
  if (!text && Math.hypot(player.x - world.exit.x, player.y - world.exit.y) < 52) {
    text = world.lootCollected >= world.lootTotal ? 'E — Slip out the getaway' : `E — Getaway shut: ${world.lootTotal - world.lootCollected} ${world.def.theme.lootLabel} left`;
  }
  if (!text) return;
  ctx.fillStyle = 'rgba(10, 12, 20, 0.85)';
  const w = ctx.measureText(text).width + 28;
  ctx.fillRect((VIEW_W - w) / 2, VIEW_H - 130, w, 30);
  ctx.fillStyle = '#eafff3';
  ctx.font = HUD_FONT;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, VIEW_H - 110);
}

/* ---------------- Screens ---------------- */

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(6, 8, 16, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function drawTitle(ctx, world, ui) {
  dim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = '600 20px Georgia, serif';
  ctx.fillText('A QUIET GAME OF LOUD CONSEQUENCES', VIEW_W / 2, 190);
  ctx.fillStyle = PALETTE.text;
  ctx.font = TITLE_FONT;
  ctx.fillText('VELVET', VIEW_W / 2, 280);
  ctx.fillText('MIDNIGHT', VIEW_W / 2, 360);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Three heists. One thief. No alarms, if you are good.', VIEW_W / 2, 410);
  ctx.fillStyle = '#ffd65a';
  ctx.font = BIG_HUD_FONT;
  const blink = Math.sin(world.time * 3) > -0.2;
  if (blink) ctx.fillText('PRESS ENTER OR CLICK TO BEGIN', VIEW_W / 2, 480);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = BODY_FONT;
  ctx.fillText('WASD move · SHIFT sneak · X sprint · SPACE throw a coin · E grab / pick / exit · Q EMP · H help', VIEW_W / 2, 530);
  if (ui.best > 0) {
    ctx.fillStyle = '#ffd94a';
    ctx.fillText(`Best score so far: ${ui.best}`, VIEW_W / 2, 565);
  }
}

function drawHelp(ctx, world) {
  dim(ctx, 0.78);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = HEADING_FONT;
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 130);
  const lines = [
    'You are the thief. Pocket every painting, gold bar or jewel, then slip out the green exit.',
    '',
    'WASD / arrows — move        SHIFT — sneak (slow, quiet, hard to spot in shadow)',
    'X — sprint (fast, loud)     SPACE or click — throw a coin to lure a guard away',
    'E — grab loot, pick a lock, slip out      Q — EMP pulse: cameras go dark for 6 seconds',
    'P / Esc — pause      R — restart the level      M — mute',
    '',
    'Guards patrol with vision cones. Yellow is calm, orange is suspicious, red is chasing.',
    'Cameras sweep their cones. A camera that sees you fills the alarm fast.',
    'The alarm meter fills when you are seen and drains when you hide. At 100%, you are busted.',
    'Dark shadow tiles hide you. Crates and cases block sight. A coin clink pulls guards away.',
    'Finish with the alarm under 50% for a Ghost bonus. Beat the par time for a time bonus.',
  ];
  ctx.font = BODY_FONT;
  ctx.fillStyle = PALETTE.muted;
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 180 + i * 30));
  ctx.fillStyle = '#ffd65a';
  ctx.font = BIG_HUD_FONT;
  ctx.fillText('PRESS H OR CLICK TO RETURN', VIEW_W / 2, 640);
}

function drawIntro(ctx, world) {
  dim(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = '600 22px Georgia, serif';
  ctx.fillText(`HEIST ${world.levelIndex + 1} OF 3`, VIEW_W / 2, 250);
  ctx.fillStyle = PALETTE.text;
  ctx.font = HEADING_FONT;
  ctx.fillText(world.def.name, VIEW_W / 2, 310);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(world.def.place, VIEW_W / 2, 350);
  ctx.fillStyle = PALETTE.text;
  ctx.font = BODY_FONT;
  ctx.fillText(`Pocket all ${world.lootTotal} ${world.def.theme.lootLabel}, then reach the green exit. Par time ${formatTime(world.def.parSeconds)}.`, VIEW_W / 2, 400);
  ctx.fillStyle = '#ffd65a';
  ctx.font = BIG_HUD_FONT;
  ctx.fillText('PRESS ANY KEY TO BEGIN', VIEW_W / 2, 460);
}

function drawPaused(ctx) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.text;
  ctx.font = HEADING_FONT;
  ctx.fillText('PAUSED', VIEW_W / 2, 330);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = BODY_FONT;
  ctx.fillText('P or Esc to resume · R to restart the level', VIEW_W / 2, 380);
}

function drawLevelComplete(ctx, world) {
  dim(ctx, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#39d98a';
  ctx.font = HEADING_FONT;
  ctx.fillText('CLEAN GETAWAY', VIEW_W / 2, 240);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '22px Georgia, serif';
  ctx.fillText(`${world.def.name} — all ${world.lootTotal} ${world.def.theme.lootLabel} pocketed`, VIEW_W / 2, 290);
  ctx.font = BODY_FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(`Time ${formatTime(world.time)}  ·  Time bonus +${world.timeBonus || 0}  ·  Ghost bonus +${world.ghostBonus || 0}`, VIEW_W / 2, 340);
  ctx.fillStyle = '#ffd94a';
  ctx.font = BIG_HUD_FONT;
  ctx.fillText(`LEVEL SCORE ${world.levelScore}   ·   TOTAL SCORE ${world.score}`, VIEW_W / 2, 390);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('PRESS ENTER FOR THE NEXT HEIST', VIEW_W / 2, 450);
}

function drawBusted(ctx, world) {
  dim(ctx, 0.66);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4a';
  ctx.font = HEADING_FONT;
  ctx.fillText('BUSTED!', VIEW_W / 2, 280);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '20px Georgia, serif';
  ctx.fillText(world.bustReason || 'The heist is over.', VIEW_W / 2, 330);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = BODY_FONT;
  ctx.fillText(`You pocketed ${world.lootCollected} of ${world.lootTotal} ${world.def.theme.lootLabel} before the lights came on.`, VIEW_W / 2, 375);
  ctx.fillStyle = '#ffd65a';
  ctx.font = BIG_HUD_FONT;
  ctx.fillText('PRESS R TO TRY AGAIN', VIEW_W / 2, 440);
}

function drawVictory(ctx, world) {
  dim(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = '600 22px Georgia, serif';
  ctx.fillText('ALL THREE HEISTS COMPLETE', VIEW_W / 2, 200);
  ctx.fillStyle = PALETTE.text;
  ctx.font = TITLE_FONT;
  ctx.fillText('THE PERFECT', VIEW_W / 2, 300);
  ctx.fillText('HEIST', VIEW_W / 2, 380);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = '20px Georgia, serif';
  ctx.fillText('Museum, bank, penthouse — and not a single alarm that mattered.', VIEW_W / 2, 430);
  ctx.fillStyle = '#ffd94a';
  ctx.font = BIG_HUD_FONT;
  ctx.fillText(`FINAL SCORE ${world.score}`, VIEW_W / 2, 490);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('PRESS R TO RUN IT ALL AGAIN', VIEW_W / 2, 550);
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}
