import { clamp } from './math.js';
import { State } from './state.js';

export function createGame(renderer) {
  const { ctx, size, clouds, particles } = renderer;
  let { W, H, s, dpr, groundH } = renderer.size;

  // Bird
  const bird = { x: 80, y: 300, r: 12, vy: 0, gravity: 0.5, jump: -8.8, rot: 0, wingPhase: 0 };
  // Pipes
  let pipes = []; const pipeBase = { speed: 2.6, w: 60, gap: 140, minTop: 56, spawnMs: 1350 }; const pipe = { ...pipeBase };
  let lastSpawn = 0;
  // Score
  let score = 0, best = Number(localStorage.getItem('flap_best') || 0);
  // Shake
  let shake = 0;
  // Physics
  const phys = { drag: 0.04, vMaxDown: 10, vMaxUp: -9 };

  function recalc() {
    ({ W, H, s, dpr, groundH } = renderer.size);
    bird.x = Math.min(140 * s, W * 0.28); bird.r = 12 * s; bird.gravity = 0.5 * s; bird.jump = -8.8 * s; phys.vMaxDown = 10 * s; phys.vMaxUp = -9 * s;
    pipe.w = Math.max(48 * s, 40 * s); pipe.gap = Math.max(120 * s, 100 * s); pipe.minTop = Math.max(56 * s, 44 * s); pipe.speed = 2.6 * Math.max(0.9, s); pipe.spawnMs = 1350;
  }

  function spawnPipe() {
    const usableH = H - groundH; const maxTop = usableH - pipe.gap - pipe.minTop;
    const top = Math.floor(Math.random() * (maxTop - pipe.minTop + 1)) + pipe.minTop; const bottom = usableH - top - pipe.gap;
    pipes.push({ x: W + 10, top, bottom, passed: false });
  }

  function circleRectCollide(cx, cy, r, rx, ry, rw, rh) {
    const testX = Math.max(rx, Math.min(cx, rx + rw)); const testY = Math.max(ry, Math.min(cy, ry + rh)); const dx = cx - testX; const dy = cy - testY; return (dx*dx + dy*dy) <= r*r;
  }

  function emitFlap(){ renderer.emitFlap(bird, pipe.speed); }
  function emitScoreBurst(){ renderer.emitScoreBurst(bird.x + 6 * s, bird.y); }

  let state = State.Ready;

  function hardReset() {
    pipes = []; renderer.particles.length = 0; score = 0; lastSpawn = 0; renderer.shake = 0; bird.vy = 0; bird.rot = 0; bird.y = H * 0.45; renderer.initClouds(pipe.speed); renderer.initMountains(); renderer.setRandomWeather(); state = State.Ready;
  }

  function flap() {
    if (state === State.Ready) state = State.Playing;
    if (state === State.Playing) { const fallBonus = Math.max(0, bird.vy) * 0.35; bird.vy = bird.jump - fallBonus; bird.wingPhase += 1.2; emitFlap(); }
    else if (state === State.GameOver) hardReset();
  }

  function update(ts, dt) {
    ({ W, H, s, dpr, groundH } = renderer.size);
    ctx.clearRect(0, 0, W, H);

    // shake
    const t = dt / 16.67; if (renderer.shake > 0) renderer.shake = Math.max(0, renderer.shake - 0.6 * s * t);
    const offsetX = (Math.random() - 0.5) * renderer.shake; const offsetY = (Math.random() - 0.5) * renderer.shake; ctx.save(); ctx.translate(offsetX, offsetY);

    // background
    renderer.drawSky(ts); renderer.drawMountains(); renderer.updateClouds(dt, pipe.speed); for (const c of renderer.clouds) renderer.drawCloud(c, pipe.speed);

    if (state === State.Playing) {
      bird.vy += bird.gravity * t; bird.vy *= Math.max(0.0, 1 - phys.drag * t); bird.vy = Math.min(phys.vMaxDown, Math.max(phys.vMaxUp, bird.vy));
      bird.y += bird.vy * t; bird.wingPhase += 0.28 * t + Math.max(0, -bird.vy * 0.02);
      const rTarget = Math.max(-0.5, Math.min(1.1, bird.vy / (10 * s))); bird.rot += (rTarget - bird.rot) * 0.15 * t;

      if (ts - lastSpawn > pipe.spawnMs) { spawnPipe(); lastSpawn = ts; }
      for (const p of pipes) p.x -= pipe.speed * t; pipes = pipes.filter(p => p.x + pipe.w > -10);

      for (const p of pipes) {
        if (!p.passed && p.x + pipe.w < bird.x) {
          p.passed = true; score++; emitScoreBurst(); if (score > best) { best = score; localStorage.setItem('flap_best', String(best)); }
          if (score % 4 === 0 && pipe.gap > 96 * s) pipe.gap -= 3 * s; if (score % 5 === 0) pipe.speed += 0.08 * s;
        }
      }

      const usableH = H - groundH;
      for (const p of pipes) {
        if (circleRectCollide(bird.x, bird.y, bird.r, p.x, 0, pipe.w, p.top) || circleRectCollide(bird.x, bird.y, bird.r, p.x, usableH - p.bottom, pipe.w, p.bottom)) {
          state = State.GameOver; renderer.shake = 6 * s; break;
        }
      }
      if (bird.y - bird.r <= 0 || bird.y + bird.r >= usableH) { state = State.GameOver; renderer.shake = 6 * s; }
    } else {
      if (state === State.Ready) { bird.y += Math.sin(ts / 250) * 0.6 * s; const rTargetIdle = Math.sin(ts / 400) * 0.15; bird.rot += (rTargetIdle - bird.rot) * 0.1 * t; bird.wingPhase += 0.15 * t; }
      if (state === State.GameOver) { const gy = H - groundH; if (bird.y + bird.r < gy) { bird.vy += bird.gravity * t; bird.y += bird.vy * t; bird.rot = Math.min(1.2, bird.rot + 0.035 * t); } else { bird.y = gy - bird.r; } bird.wingPhase += 0.05 * t; }
    }

    renderer.drawPipes(pipes, pipe, H, groundH, s); renderer.drawParticles(); renderer.drawBirdTrail(bird, s); renderer.drawBird(bird, s, H, groundH); renderer.drawGround(pipe.speed); renderer.drawPipeGroundShadows(pipes, pipe, H, groundH, s); renderer.drawWeather(); renderer.drawVignette(); ctx.restore();
    renderer.updateParticles(dt); renderer.updateWeather(dt);

    // UI
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.font = `${Math.round(22 * s)}px system-ui, Arial`; ctx.textAlign = 'left'; ctx.fillText(`Score: ${score}`, 12 * s, 26 * s); ctx.textAlign = 'right'; ctx.fillText(`Best: ${best}`, W - 12 * s, 26 * s);
    ctx.textAlign = 'center';
    if (state === State.Ready) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `bold ${Math.round(32 * s)}px system-ui, Arial`; ctx.fillText('Toque / Espaço para começar', W/2, H*0.35); ctx.font = `${Math.round(16 * s)}px system-ui, Arial`; ctx.fillText('Passe pelos canos para pontuar', W/2, H*0.35 + 26 * s); ctx.fillText('Teclas: R reinicia • F tela cheia', W/2, H*0.35 + 46 * s); }
    if (state === State.GameOver) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `bold ${Math.round(38 * s)}px system-ui, Arial`; ctx.fillText('Game Over', W/2, H*0.35); ctx.font = `${Math.round(18 * s)}px system-ui, Arial`; ctx.fillText('Clique/tecla para reiniciar', W/2, H*0.35 + 28 * s); }
  }

  return { bird, pipe, pipes: () => pipes, state: () => state, recalc, hardReset, flap, update };
}
