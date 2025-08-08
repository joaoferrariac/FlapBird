import { clamp, lerp, TAU } from './math.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 400, H = 600, dpr = 1, s = 1;
  let groundH = 80, groundX = 0;
  const base = { W: 400, H: 600 };

  // scene layers
  let clouds = [], mountains = [];
  let weather = 'clear', droplets = [], flakes = [], weatherT = 0;
  let timeOfDay = 0;
  let particles = [];
  let shake = 0;

  function recalcScaled() {
    // Base scaling factor from height
    s = H / base.H;
    
    // Adjust scaling for extreme aspect ratios
    const aspectRatio = W / H;
    
    // For very wide screens (landscape), limit scaling to prevent elements becoming too large
    if (aspectRatio > 1.8) {
      s = Math.min(s, W / (base.W * 1.5));
    }
    
    // For very tall screens (portrait), ensure minimum scaling
    if (aspectRatio < 0.6) {
      s = Math.max(s, Math.min(W / base.W, H / (base.H * 1.2)));
    }
    
    // Ensure reasonable bounds
    s = Math.max(0.5, Math.min(3.0, s));
    
    groundH = Math.max(60 * s, 48 * s);
  }

  function resize(resetCb) {
    dpr = Math.min(2.5, window.devicePixelRatio || 1);
    
    // Get actual viewport dimensions
    const vw = Math.max(320, window.innerWidth);
    const vh = Math.max(480, window.innerHeight);
    
    // For mobile devices, account for browser UI
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Use visual viewport if available (modern browsers)
      if (window.visualViewport) {
        W = Math.max(320, window.visualViewport.width);
        H = Math.max(480, window.visualViewport.height);
      } else {
        W = vw;
        H = Math.max(480, vh * 0.95); // Account for mobile browser UI
      }
    } else {
      W = vw;
      H = vh;
    }
    
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    recalcScaled();
    resetCb?.();
  }

  function newCloud(randomX = false, speedBase = 1) {
    const sc = 0.6 + Math.random() * 1.2;
    const y = Math.random() * (H * 0.5);
    const x = randomX ? Math.random() * W : W + 60 * sc;
    const speed = (0.2 + Math.random() * 0.35) * speedBase;
    return { x, y, sc, speed };
  }

  function initClouds(speedBase) {
    const count = Math.round(6 + (W * H) / (900 * 900) * 6);
    clouds = Array.from({ length: count }).map(() => newCloud(true, speedBase));
  }

  function initMountains() {
    const layers = 3;
    mountains = [];
    for (let i = 0; i < layers; i++) {
      const h = H * (0.18 + i * 0.08);
      const speed = 0.15 * (i + 1);
      const color = `hsl(${120 - i * 10}, 30%, ${50 - i * 10}%)`;
      const pts = generateMountainPath(h, 6 + i * 2);
      mountains.push({ h, speed, color, x: 0, pts });
    }
  }

  function generateMountainPath(height, peaks) {
    const pts = [];
    const baseY = H - groundH - height;
    for (let i = 0; i <= peaks; i++) {
      const x = (i / peaks) * W;
      const y = baseY + Math.sin(i * 1.2) * (height * 0.3) + (Math.random() - 0.5) * (height * 0.2);
      pts.push({ x, y });
    }
    return pts;
  }

  function setWeather(w) {
    weather = w; droplets = []; flakes = []; weatherT = 0;
    if (w === 'rain') initRain();
    if (w === 'snow') initSnow();
  }

  function setRandomWeather() {
    const r = Math.random();
    setWeather(r < 0.7 ? 'clear' : (r < 0.85 ? 'rain' : 'snow'));
  }

  function initRain() {
    const n = Math.round(80 * s);
    for (let i = 0; i < n; i++) {
      droplets.push({ x: Math.random() * W, y: Math.random() * H, vx: -1.2 * s, vy: 8 * s + Math.random() * 6 * s, len: 8 * s + Math.random() * 8 * s });
    }
  }

  function initSnow() {
    const n = Math.round(60 * s);
    for (let i = 0; i < n; i++) {
      flakes.push({ x: Math.random() * W, y: Math.random() * H, vx: (-0.6 + Math.random() * 1.2) * s, vy: 1.5 * s + Math.random() * 1.2 * s, r: 1 * s + Math.random() * 1.5 * s, a: Math.random() * TAU });
    }
  }

  function emitFlap(bird, pipeSpeed) {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (TAU * i) / n + (Math.random() - 0.5) * 0.5;
      const sp = 1.2 * s + Math.random() * (2.2 * s);
      particles.push({ x: bird.x - bird.r * 0.6, y: bird.y + bird.r * 0.2, vx: -Math.abs(Math.cos(a) * sp) - pipeSpeed * 0.4, vy: Math.sin(a) * sp * 0.6, life: 420 + Math.random() * 200, age: 0, r: 2.5 * s + Math.random() * 2 * s, color: 'rgba(255,255,255,0.8)' });
    }
  }

  function emitScoreBurst(px, py) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU; const sp = 2 * s + Math.random() * 3 * s;
      particles.push({ x: px, y: py, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 600, age: 0, r: 2 * s + Math.random() * 2 * s, color: `hsla(${Math.floor(40 + Math.random() * 40)}, 90%, 60%, 0.9)` });
    }
  }

  function updateParticles(dt) {
    const t = dt / 16.67;
    for (const p of particles) { p.age += dt; p.x += p.vx * t; p.y += p.vy * t; p.vy += 0.02 * s * t; }
    particles = particles.filter(p => p.age < p.life);
  }

  function updateWeather(dt) {
    const t = dt / 16.67; weatherT += dt;
    if (weatherT > 20000) { setRandomWeather(); weatherT = 0; }
    if (weather === 'rain') {
      for (const d of droplets) {
        d.x += d.vx * t * 1.2; d.y += d.vy * t * 1.2;
        if (d.y > H - groundH) { particles.push({ x: d.x, y: H - groundH - 1, vx: (Math.random()-0.5)*0.6, vy: -0.8, life: 180, age: 0, r: 1.6 * s, color: 'rgba(180,210,255,0.7)' }); d.x = Math.random() * W; d.y = -10; }
        if (d.x < -10) d.x = W + 10;
      }
    } else if (weather === 'snow') {
      for (const f of flakes) { f.x += Math.sin(f.a + f.y * 0.01) * 0.3 * t + f.vx * t; f.y += f.vy * t; f.a += 0.02 * t; if (f.y > H - groundH) { f.x = Math.random() * W; f.y = -10; } }
    }
  }

  function drawSky(ts) {
    timeOfDay = (timeOfDay + (1 / (40 * 60))) % 1;
    const day = Math.cos(timeOfDay * TAU) * 0.5 + 0.5;
    const top = `hsl(${200 - 30 * (1 - day)}, 90%, ${70 - 45 * (1 - day)}%)`;
    const mid = `hsl(${195 - 25 * (1 - day)}, 90%, ${80 - 40 * (1 - day)}%)`;
    const bot = `hsl(${190 - 20 * (1 - day)}, 90%, ${92 - 30 * (1 - day)}%)`;
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, top); bg.addColorStop(0.6, mid); bg.addColorStop(1, bot);
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const r = 50 * s, cx = W - r * 2.2, cy = r * 1.8;
    const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.4);
    if (day > 0.25) g.addColorStop(0, `rgba(255,255,210,${0.7 + 0.3 * day})`);
    else g.addColorStop(0, `rgba(210,220,255,0.7)`);
    g.addColorStop(1, 'rgba(255,255,210,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.4, 0, TAU); ctx.fill();
  }

  function drawCloud(c, speedBase) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(c.sc * s, c.sc * s);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU); ctx.arc(20, -6, 16, 0, TAU);
    ctx.arc(-18, -8, 16, 0, TAU); ctx.arc(8, 6, 18, 0, TAU);
    ctx.fill(); ctx.restore();
  }

  function updateClouds(dt, speedBase) {
    const t = dt / 16.67;
    for (const c of clouds) { c.x -= c.speed * t; if (c.x < -80 * c.sc * s) { const r = newCloud(false, speedBase); Object.assign(c, r); } }
  }

  function drawMountains() {
    for (const m of mountains) {
      m.x = (m.x - m.speed) % W; ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.moveTo(-W + m.x, H); for (const p of m.pts) ctx.lineTo(p.x + m.x - W, p.y); ctx.lineTo(W + m.x - W, H); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(m.x, H); for (const p of m.pts) ctx.lineTo(p.x + m.x, p.y); ctx.lineTo(W + m.x, H); ctx.closePath(); ctx.fill();
    }
  }

  function drawGround(pipeSpeed) {
    const y = H - groundH; const gg = ctx.createLinearGradient(0, y, 0, H);
    gg.addColorStop(0, '#c9f0ff'); gg.addColorStop(1, '#e6fbff'); ctx.fillStyle = gg; ctx.fillRect(0, y, W, groundH);
    groundX = (groundX - pipeSpeed * 0.9) % (64 * s); const bands = 12;
    for (let i = 0; i < bands; i++) { const t0 = i / bands, t1 = (i + 1) / bands; const y0 = y + t0 * groundH; const y1 = y + t1 * groundH; const shift0 = groundX * (0.3 + 0.7 * t0); const shift1 = groundX * (0.3 + 0.7 * t1); ctx.fillStyle = i % 2 === 0 ? '#7ddf70' : '#6ed462'; ctx.beginPath(); ctx.moveTo(-80 * s + shift0, y0); ctx.lineTo(W + 80 * s + shift0, y0); ctx.lineTo(W + 120 * s + shift1, y1); ctx.lineTo(-120 * s + shift1, y1); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, y - 2 * s, W, 2 * s);
  }

  function drawPipes(pipes, pipe, H, groundH, s) {
    for (const p of pipes) {
      const g = ctx.createLinearGradient(p.x, 0, p.x + pipe.w, 0);
      g.addColorStop(0, '#27ae60'); g.addColorStop(0.5, '#2ecc71'); g.addColorStop(1, '#1f8f50');
      ctx.fillStyle = g; ctx.strokeStyle = '#187a44'; ctx.lineWidth = 2 * s;
      const by = H - groundH - p.bottom; const capH = 10 * s;
      ctx.fillRect(p.x, 0, pipe.w, p.top); ctx.fillRect(p.x, by, pipe.w, p.bottom);
      ctx.strokeRect(p.x + 0.5, 0.5, pipe.w - 1, p.top - 1); ctx.strokeRect(p.x + 0.5, by + 0.5, pipe.w - 1, p.bottom - 1);
      ctx.fillStyle = '#239b56'; ctx.fillRect(p.x - 4 * s, p.top - capH, pipe.w + 8 * s, capH); ctx.fillRect(p.x - 4 * s, by, pipe.w + 8 * s, capH);
      const dx = 6 * s, dy = 3 * s; ctx.fillStyle = '#1e7746';
      ctx.beginPath(); ctx.moveTo(p.x + pipe.w, 0); ctx.lineTo(p.x + pipe.w + dx, dy); ctx.lineTo(p.x + pipe.w + dx, p.top + dy); ctx.lineTo(p.x + pipe.w, p.top); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x + pipe.w, by); ctx.lineTo(p.x + pipe.w + dx, by + dy); ctx.lineTo(p.x + pipe.w + dx, by + p.bottom + dy); ctx.lineTo(p.x + pipe.w, by + p.bottom); ctx.closePath(); ctx.fill();
      const hl = ctx.createLinearGradient(p.x, 0, p.x + 8 * s, 0); hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(p.x, 0, 8 * s, p.top); ctx.fillRect(p.x, by, 8 * s, p.bottom);
    }
  }

  function drawPipeGroundShadows(pipes, pipe, H, groundH, s) {
    const gy = H - groundH;
    for (const p of pipes) {
      const by = H - groundH - p.bottom; if (p.bottom > 0) {
        const cx = p.x + pipe.w * 0.5 + 10 * s; const cy = gy + 6 * s; const rw = pipe.w * 0.9 + 18 * s; const rh = 5.5 * s;
        const grad = ctx.createRadialGradient(cx, cy, rh * 0.2, cx, cy, rw); grad.addColorStop(0, 'rgba(0,0,0,0.22)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(cx, cy, rw, rh, 0, 0, TAU); ctx.fill();
      }
    }
  }

  function drawBird(bird, s, H, groundH) {
    ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(bird.rot);
    const rg = ctx.createRadialGradient(-bird.r * 0.4, -bird.r * 0.4, bird.r * 0.3, 0, 0, bird.r * 1.1); rg.addColorStop(0, '#ffd84d'); rg.addColorStop(1, '#ffb300');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, TAU); ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.stroke();
    const wingAngle = Math.sin(bird.wingPhase) * 0.7; ctx.save(); ctx.translate(-bird.r * 0.25, bird.r * 0.1); ctx.rotate(wingAngle); ctx.fillStyle = '#f1b600'; ctx.beginPath(); ctx.ellipse(0, 0, bird.r * 0.9, bird.r * 0.55, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bird.r * 0.35, -bird.r * 0.35, bird.r * 0.35, 0, TAU); ctx.fill(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bird.r * 0.45, -bird.r * 0.35, bird.r * 0.18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8c00'; ctx.beginPath(); ctx.moveTo(bird.r * 0.9, 0); ctx.lineTo(bird.r * 1.5, -0.25 * bird.r); ctx.lineTo(bird.r * 0.9, 0.25 * bird.r); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffa600'; ctx.beginPath(); ctx.moveTo(-bird.r * 0.9, 0); ctx.lineTo(-bird.r * 1.5, -bird.r * 0.2); ctx.lineTo(-bird.r * 1.5, bird.r * 0.2); ctx.closePath(); ctx.fill(); ctx.restore();
    const gy = H - groundH; const dist = Math.max(0, gy - (bird.y + bird.r)); const alpha = Math.max(0, Math.min(0.35, 0.35 * (1 - dist / (H * 0.6)))); if (alpha > 0.01) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(bird.x, gy + 6 * s, 14 * s, 4.5 * s, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  }

  function drawBirdTrail(bird, s) {
    const sp = Math.abs(bird.vy); if (sp < 4 * s) return; const n = 3;
    for (let i = 1; i <= n; i++) { const k = i / (n + 1); const y = bird.y - bird.vy * 0.06 * k; ctx.globalAlpha = 0.08 * (1 - k); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(bird.x - 2 * s * k, y, 10 * s * (1 - k * 0.2), 3.2 * s, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }

  function drawParticles() {
    for (const p of particles) { const k = 1 - p.age / p.life; ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, k); ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.8 + 0.4 * k), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  }

  function drawWeather() {
    if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(100,140,255,0.65)'; ctx.lineWidth = 1 * dpr; for (const d of droplets) { ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.vx * 2, d.y + d.len); ctx.stroke(); }
    } else if (weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (const f of flakes) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); }
    }
  }

  function drawVignette() {
    const grd = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.3, W/2, H/2, Math.max(W,H)*0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  }

  return {
    get ctx(){ return ctx; },
    get size(){ return { W, H, s, dpr, groundH }; },
    get clouds(){ return clouds; },
    get particles(){ return particles; },
    get shake(){ return shake; }, set shake(v){ shake = v; },
    resize,
    initClouds,
    initMountains,
    setWeather, setRandomWeather,
    emitFlap, emitScoreBurst,
    updateParticles, updateWeather,
  newCloud, updateClouds,
  drawSky, drawCloud, drawMountains, drawGround, drawPipes, drawPipeGroundShadows,
    drawBird, drawBirdTrail, drawParticles, drawWeather, drawVignette,
  };
}
