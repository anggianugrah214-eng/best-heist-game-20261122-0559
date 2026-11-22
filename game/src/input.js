// Input: keyboard and mouse, turned into one small frame of intent.
// WASD / arrows move, Shift sneaks, X sprints, Space or click throws a
// coin, E interacts, Q fires the EMP, P or Esc pauses, R restarts, M mutes.

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

/** Build an input state bound to the canvas. Callbacks fire on edges. */
export function makeInput(canvas, hooks) {
  const keys = new Set();
  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    sprint: false,
    interact: false,
    emp: false,
    coinTarget: null,
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
  };

  function recompute() {
    let mx = 0;
    let my = 0;
    for (const code of keys) {
      const dir = MOVE_KEYS[code];
      if (dir) { mx += dir[0]; my += dir[1]; }
    }
    input.mx = mx;
    input.my = my;
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.sprint = keys.has('KeyX');
  }

  function canvasPos(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    recompute();
    if (event.code === 'KeyE') input.interact = true;
    if (event.code === 'KeyQ') input.emp = true;
    if (event.code === 'Space') { event.preventDefault(); hooks.onCoinKey(); }
    if (event.code === 'KeyP' || event.code === 'Escape') hooks.onPause();
    if (event.code === 'KeyR') hooks.onRestart();
    if (event.code === 'KeyM') hooks.onMute();
    if (event.code === 'KeyH') hooks.onHelp();
    if (event.code === 'Enter') hooks.onConfirm();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    recompute();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    recompute();
  });

  canvas.addEventListener('mousemove', (event) => {
    const pos = canvasPos(event);
    input.mouseX = pos.x;
    input.mouseY = pos.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const pos = canvasPos(event);
    input.mouseX = pos.x;
    input.mouseY = pos.y;
    input.mouseDown = true;
    hooks.onClick(pos.x, pos.y, event.button);
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  /** Edge-triggered flags are consumed once per frame by the game loop. */
  input.consumeEdges = () => {
    const edges = { interact: input.interact, emp: input.emp, coinTarget: input.coinTarget };
    input.interact = false;
    input.emp = false;
    input.coinTarget = null;
    return edges;
  };

  /** Queue a coin throw at a point (from a mouse click or the Space key). */
  input.queueCoinThrow = (x, y) => { input.coinTarget = { x, y }; };

  return input;
}
