export function bindInput({ canvas, flap, reset, toggleFullscreen }) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault(); flap();
    }
    if (e.code === 'KeyR') reset();
    if (e.code === 'KeyF') toggleFullscreen();
  }, { passive: false });
  canvas.addEventListener('pointerdown', flap);
  canvas.addEventListener('dblclick', (e) => { e.preventDefault(); /* não faz nada */ }, { passive: false });
}

export function toggleFullscreenFor(canvas) {
  const el = document.fullscreenElement;
  if (!el) canvas.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
  else document.exitFullscreen?.().catch?.(() => {});
}
