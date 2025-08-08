# Voa Passarinho (HTML5 Canvas)

Voa Passarinho is a modern, modular Flappy‑Bird‑style game built with plain HTML, CSS and ES Modules. Fully responsive, fullscreen, and packed with subtle visual effects and improved physics.

## Features
- Fullscreen, HiDPI rendering with devicePixelRatio scaling
- Parallax sky with clouds and multi‑layer mountains
- Day–night cycle, dynamic weather (clear/rain/snow)
- Pseudo‑3D pipes with shadows and highlights
- Ground perspective bands and ambient vignette
- Particle effects (wing bursts, score sparks, rain splashes)
- Smoothed physics: gravity, drag, terminal velocity caps, adaptive jump
- Motion cues: wing flaps, rotation easing, trail and screen shake
- Local storage best score

## Controls
- Space / Arrow Up / W / Click or tap: flap
- R: reset
- F or double‑click: toggle fullscreen

## Run locally
Just open `index.html` in a modern browser. No build step required.

If running from a local HTTP server (optional), any simple server works.

## Project structure
- `index.html` — minimal page shell and canvas host.
- `styles.css` — layout and background baseline.
- `src/` — ES modules:
  - `main.js` — boot, resize wiring, main loop.
  - `game.js` — game state, physics, scoring, collisions.
  - `render.js` — all drawing, scaling, particles, weather.
  - `input.js` — input bindings and fullscreen helper.
  - `math.js`, `state.js` — small shared utilities/constants.

## Notes
- The game auto‑scales to your window size and caps extreme dt spikes.
- Weather cycles automatically. Best score is saved in `localStorage`.

## License
MIT
