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
  let ranking = JSON.parse(localStorage.getItem('flap_ranking') || '[]');
  // Shake
  let shake = 0;
  // Physics
  const phys = { drag: 0.04, vMaxDown: 10, vMaxUp: -9 };

  function recalc() {
    ({ W, H, s, dpr, groundH } = renderer.size);
    
    // Adaptive bird position based on screen width
    bird.x = Math.min(140 * s, W * 0.25);
    bird.r = Math.max(10 * s, 8 * s);
    bird.gravity = 0.5 * s;
    bird.jump = -8.8 * s;
    
    // Physics scaling
    phys.vMaxDown = 10 * s;
    phys.vMaxUp = -9 * s;
    
    // Pipe scaling with aspect ratio considerations
    const aspectRatio = W / H;
    pipe.w = Math.max(45 * s, 35 * s);
    
    // Adjust gap based on screen size and orientation
    if (aspectRatio < 0.7) { // Portrait
      pipe.gap = Math.max(130 * s, 110 * s);
    } else if (aspectRatio > 1.5) { // Landscape
      pipe.gap = Math.max(140 * s, 120 * s);
    } else { // Square-ish
      pipe.gap = Math.max(135 * s, 115 * s);
    }
    
    pipe.minTop = Math.max(50 * s, 40 * s);
    pipe.speed = 2.6 * Math.max(0.8, Math.min(1.2, s));
    
    // Spawn timing based on screen width
    pipe.spawnMs = Math.max(1200, 1350 - (W - 400) * 0.5);
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

    // Aumenta a velocidade dos canos conforme o tempo de jogo
  if (state === State.Playing) {
      // A cada segundo, aumenta um pouco a velocidade (máx. 2x inicial)
      const tempoSegundos = ts / 1000;
      pipe.speed = pipeBase.speed * Math.min(2, 1 + tempoSegundos * 0.015);
    }

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
      if (state === State.GameOver) {
        // Atualiza ranking se ainda não foi salvo para este score
        if (score > 0 && (ranking.length === 0 || ranking[0] !== score)) {
          ranking.push(score);
          ranking = Array.from(new Set(ranking)).sort((a, b) => b - a).slice(0, 5);
          localStorage.setItem('flap_ranking', JSON.stringify(ranking));
        }
        const gy = H - groundH;
        if (bird.y + bird.r < gy) { bird.vy += bird.gravity * t; bird.y += bird.vy * t; bird.rot = Math.min(1.2, bird.rot + 0.035 * t); } else { bird.y = gy - bird.r; }
        bird.wingPhase += 0.05 * t;
      }
    }

    renderer.drawPipes(pipes, pipe, H, groundH, s); renderer.drawParticles(); renderer.drawBirdTrail(bird, s); renderer.drawBird(bird, s, H, groundH); renderer.drawGround(pipe.speed); renderer.drawPipeGroundShadows(pipes, pipe, H, groundH, s); renderer.drawWeather(); renderer.drawVignette(); ctx.restore();
    renderer.updateParticles(dt); renderer.updateWeather(dt);

    // UI
    const fontSize = Math.max(16 * s, 14);
    const smallFont = Math.max(12 * s, 11);
    const titleFont = Math.max(24 * s, 20);
    
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = `${Math.round(fontSize)}px system-ui, Arial`;
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 12 * s, 26 * s);
    ctx.textAlign = 'right';
    ctx.fillText(`Best: ${best}`, W - 12 * s, 26 * s);
    
    ctx.textAlign = 'center';
    // Card animado para menus (só aparece em Ready ou GameOver)
    if (state === State.Ready || state === State.GameOver) {
      let cardY = H * 0.25;
      let cardH = state === State.GameOver ? 220 * s + ranking.length * 18 * s : 160 * s;
      let cardW = Math.min(340 * s, W * 0.9);
      let cardX = (W - cardW) / 2;
      // Animação de entrada (fade, bounce e escala)
      let tMenu = Math.min(1, Math.abs(Math.sin(ts / 400)) * 0.7 + 0.3);
      let scale = 0.98 + 0.04 * Math.sin(ts / 320);
      ctx.save();
      ctx.globalAlpha = 0.92 * tMenu;
      ctx.translate(W/2, cardY + cardH/2);
      ctx.scale(scale, scale);
      ctx.translate(-W/2, -(cardY + cardH/2));
      // Sombra destacada
      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 28 * s;
      // Card com gradiente
      let grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      grad.addColorStop(0, '#e3f6ff');
      grad.addColorStop(0.5, '#d0eaff');
      grad.addColorStop(1, '#b3e6ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cardX + 18 * s, cardY);
      ctx.lineTo(cardX + cardW - 18 * s, cardY);
      ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + 18 * s);
      ctx.lineTo(cardX + cardW, cardY + cardH - 18 * s);
      ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - 18 * s, cardY + cardH);
      ctx.lineTo(cardX + 18 * s, cardY + cardH);
      ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - 18 * s);
      ctx.lineTo(cardX, cardY + 18 * s);
      ctx.quadraticCurveTo(cardX, cardY, cardX + 18 * s, cardY);
      ctx.closePath();
      ctx.fill();
      // Bordas animadas com gradiente
      let borderGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      borderGrad.addColorStop(0, '#4fc3f7');
      borderGrad.addColorStop(0.5, '#81d4fa');
      borderGrad.addColorStop(1, '#00bcd4');
      ctx.lineWidth = 4 * s + Math.abs(Math.sin(ts/300))*2;
      ctx.strokeStyle = borderGrad;
      ctx.stroke();
      // Efeito de brilho nas bordas
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.08 * Math.abs(Math.sin(ts/200));
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      ctx.restore();
      // Ícone do pássaro no topo do card
      ctx.save();
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(W/2, cardY + 22 * s, 16 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd84d';
      ctx.fill();
      ctx.lineWidth = 2 * s;
      ctx.strokeStyle = '#ffb300';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W/2 + 6 * s, cardY + 18 * s, 5 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(W/2 + 8 * s, cardY + 18 * s, 2.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      ctx.restore();
      // Conteúdo do card
      ctx.save();
      ctx.textAlign = 'center';
      if (state === State.Ready) {
        ctx.fillStyle = '#1a3a4a';
        ctx.font = `bold ${Math.round(titleFont)}px system-ui, Arial`;
        ctx.fillText('Voa Passarinho', W/2, cardY + 54 * s);
        ctx.font = `${Math.round(smallFont)}px system-ui, Arial`;
        ctx.fillStyle = '#2d5c7f';
        ctx.fillText('Toque / Espaço para começar', W/2, cardY + 86 * s);
        ctx.fillText('Passe pelos canos para pontuar', W/2, cardY + 114 * s);
        ctx.fillText('Teclas: R reinicia • F tela cheia', W/2, cardY + 142 * s);
      }
      if (state === State.GameOver) {
        ctx.fillStyle = '#b8002f';
        ctx.font = `bold ${Math.round(titleFont + 4)}px system-ui, Arial`;
        ctx.fillText('Game Over', W/2, cardY + 54 * s);
        ctx.font = `${Math.round(smallFont + 2)}px system-ui, Arial`;
        ctx.fillStyle = '#2d5c7f';
        ctx.fillText('Clique/tecla para reiniciar', W/2, cardY + 86 * s);
        ctx.font = `bold ${Math.round(smallFont + 2)}px system-ui, Arial`;
        ctx.fillStyle = '#1a3a4a';
        ctx.fillText('Ranking dos melhores:', W/2, cardY + 116 * s);
        ctx.font = `${Math.round(smallFont + 1)}px system-ui, Arial`;
        ranking.forEach((val, idx) => {
          ctx.fillStyle = idx === 0 ? '#ff9800' : '#2d5c7f';
          ctx.fillText(`${idx + 1}º - ${val} pontos`, W/2, cardY + (136 + idx * 18) * s);
        });
      }
      ctx.restore();
  }
  }

  return { bird, pipe, pipes: () => pipes, state: () => state, recalc, hardReset, flap, update };
}
