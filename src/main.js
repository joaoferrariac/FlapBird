import { createRenderer } from './render.js';
import { bindInput, toggleFullscreenFor } from './input.js';
import { createGame } from './game.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const game = createGame(renderer);

// Resize handling and recalc world sizes
renderer.resize(() => {
  game.recalc();
  game.hardReset();
});

// Handle orientation changes and viewport resizes
window.addEventListener('resize', () => {
  setTimeout(() => {
    renderer.resize(() => {
      game.recalc();
      game.hardReset();
    });
  }, 100);
});

// Handle visual viewport changes on mobile
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    setTimeout(() => {
      renderer.resize(() => {
        game.recalc();
        game.hardReset();
      });
    }, 100);
  });
}

// Input bindings
bindInput({
  canvas,
  flap: () => game.flap(),
  reset: () => game.hardReset(),
  toggleFullscreen: () => toggleFullscreenFor(canvas),
});

// Main loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(48, now - last);
  last = now;
  game.update(now, dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
