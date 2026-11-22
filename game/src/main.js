// Velvet Midnight — the entry point. Owns the game loop, the screen flow
// (title, intro, play, pause, level-complete, busted, victory) and the
// ?shot= modes the screenshots are taken from.

import { VIEW_H, VIEW_W } from './config.js';
import { LEVELS } from './levels.js';
import { makeWorld, stepWorld, STATUS_BUSTED, STATUS_LEVEL_COMPLETE, STATUS_VICTORY } from './world.js';
import { makeInput } from './input.js';
import {
  SCREEN_BUSTED, SCREEN_HELP, SCREEN_INTRO, SCREEN_LEVEL_COMPLETE,
  SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY, render,
} from './render.js';
import { ensureAudio, playCameraBeep, playEventSound, toggleMute } from './audio.js';
import { stageShot } from './shots.js';
import { cameraSeesPlayer } from './cameras.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') || 1);

const game = {
  world: makeWorld(0, 0, seed),
  screen: SCREEN_TITLE,
  best: 0,
  paused: false,
  introTimer: 0,
  totalScore: 0,
  levelIndex: 0,
  cameraBeepTimer: 0,
};

function setScreen(screen) {
  game.screen = screen;
  if (screen === SCREEN_INTRO) game.introTimer = 0;
  announce();
}

function announce() {
  if (!statusLine) return;
  const world = game.world;
  const messages = {
    [SCREEN_TITLE]: 'Velvet Midnight. Press Enter to begin the heist.',
    [SCREEN_INTRO]: `${world.def.name}. Pocket all ${world.lootTotal} ${world.def.theme.lootLabel}, then reach the exit.`,
    [SCREEN_PLAY]: `Playing ${world.def.name}. Loot ${world.lootCollected} of ${world.lootTotal}. Alarm ${Math.round(world.alarm)} percent.`,
    [SCREEN_PAUSED]: 'Paused.',
    [SCREEN_LEVEL_COMPLETE]: 'Clean getaway. Press Enter for the next heist.',
    [SCREEN_BUSTED]: 'Busted. Press R to try again.',
    [SCREEN_VICTORY]: `The perfect heist. Final score ${world.score}.`,
  };
  statusLine.textContent = messages[game.screen] || '';
}

function startLevel(index, totalScore) {
  game.levelIndex = index;
  game.totalScore = totalScore;
  game.world = makeWorld(index, totalScore, seed);
  game.paused = false;
  setScreen(SCREEN_INTRO);
}

function startGame() {
  ensureAudio();
  startLevel(0, 0);
}

const input = makeInput(canvas, {
  onCoinKey: () => {
    if (game.screen !== SCREEN_PLAY || game.paused) return;
    const player = game.world.player;
    const range = 280;
    const tx = player.x + Math.cos(player.facing) * range;
    const ty = player.y + Math.sin(player.facing) * range;
    input.queueCoinThrow(tx, ty);
  },
  onPause: () => {
    if (game.screen === SCREEN_PLAY) {
      game.paused = !game.paused;
      setScreen(game.paused ? SCREEN_PAUSED : SCREEN_PLAY);
    } else if (game.screen === SCREEN_PAUSED) {
      game.paused = false;
      setScreen(SCREEN_PLAY);
    }
  },
  onRestart: () => {
    if (game.screen === SCREEN_PLAY || game.screen === SCREEN_PAUSED || game.screen === SCREEN_BUSTED) {
      startLevel(game.levelIndex, game.totalScore);
    } else if (game.screen === SCREEN_VICTORY || game.screen === SCREEN_LEVEL_COMPLETE) {
      startGame();
    }
  },
  onMute: () => { toggleMute(); },
  onHelp: () => {
    if (game.screen === SCREEN_HELP) setScreen(SCREEN_TITLE);
    else if (game.screen === SCREEN_TITLE) setScreen(SCREEN_HELP);
  },
  onConfirm: () => {
    ensureAudio();
    if (game.screen === SCREEN_TITLE || game.screen === SCREEN_HELP) startGame();
    else if (game.screen === SCREEN_INTRO) setScreen(SCREEN_PLAY);
    else if (game.screen === SCREEN_LEVEL_COMPLETE) {
      startLevel(game.levelIndex + 1, game.world.score);
    }
  },
  onClick: (x, y, button) => {
    ensureAudio();
    if (game.screen === SCREEN_TITLE || game.screen === SCREEN_HELP) { startGame(); return; }
    if (game.screen === SCREEN_INTRO) { setScreen(SCREEN_PLAY); return; }
    if (game.screen === SCREEN_LEVEL_COMPLETE) { startLevel(game.levelIndex + 1, game.world.score); return; }
    if (game.screen === SCREEN_BUSTED) { startLevel(game.levelIndex, game.totalScore); return; }
    if (game.screen === SCREEN_VICTORY) { startGame(); return; }
    if (game.screen !== SCREEN_PLAY || game.paused) return;
    // In play, a click throws a coin at the clicked point (right-click too).
    if (button === 0 || button === 2) input.queueCoinThrow(x, y);
  },
});

// --- Shot mode: stage one deterministic scene and hold it still. ---
let shotMode = false;
if (shotName) {
  shotMode = true;
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  game.screen = stageShot(shotName, game);
  announce();
} else {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
}

let lastTime = performance.now();
let beepAccumulator = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (!shotMode) {
    if (game.screen === SCREEN_INTRO) {
      game.introTimer += dt;
      if (game.introTimer > 2.6) setScreen(SCREEN_PLAY);
    } else if (game.screen === SCREEN_PLAY && !game.paused) {
      const edges = input.consumeEdges();
      const frameInput = {
        mx: input.mx,
        my: input.my,
        sneak: input.sneak,
        sprint: input.sprint,
        interact: edges.interact,
        emp: edges.emp,
        coinTarget: edges.coinTarget,
      };
      stepWorld(game.world, frameInput, dt);
      for (const event of game.world.events) playEventSound(event);
      // Camera beeps while a camera is actively spotting the thief.
      const spotted = game.world.cameras.some((c) => cameraSeesPlayer(game.world, c, game.world.player));
      beepAccumulator += dt;
      if (spotted && beepAccumulator > 0.5) {
        beepAccumulator = 0;
        playCameraBeep();
      }
      if (game.world.status === STATUS_BUSTED) {
        game.best = Math.max(game.best, game.world.score);
        setScreen(SCREEN_BUSTED);
      } else if (game.world.status === STATUS_LEVEL_COMPLETE) {
        game.best = Math.max(game.best, game.world.score);
        setScreen(SCREEN_LEVEL_COMPLETE);
      } else if (game.world.status === STATUS_VICTORY) {
        game.best = Math.max(game.best, game.world.score);
        setScreen(SCREEN_VICTORY);
      }
    } else if (game.screen === SCREEN_PLAY && game.paused) {
      input.consumeEdges();
    }
  }

  render(ctx, game.world, game.screen, game);
  requestAnimationFrame(frame);
}

announce();
requestAnimationFrame(frame);

// Expose a little state for headless playtests (no network, no side effects).
window.__velvetMidnight = {
  game,
  startLevel,
  startGame,
};
