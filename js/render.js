// All tegning: bakgrunn, verden, skip, lys og partikler. HUD ligger i hud.js.
//
// Rekkefølge per bilde:
//   1. bakgrunn (himmel, sol, planet, stjerner)
//   2. faste ting i verden (port, stasjon, stein, røyk, skip) og svevende støv
//   3. mørke over alt, med hull der det er lys (arbeidslys, motorer, laser …)
//   4. ting som lyser selv (flammer, laser, horisont, gnister)
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  // --- Partikler ---
  class Particles {
    constructor(max = 1600) { this.list = []; this.max = max; }
    add(p) {
      if (this.list.length >= this.max) this.list.shift();
      p.life = p.max = p.life || 1;
      this.list.push(p);
    }
    burst(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = (o.dir != null ? o.dir + G.rand(-o.spread, o.spread) : Math.random() * 6.283);
        const sp = G.rand(o.sMin || 2, o.sMax || 10);
        this.add({
          type: o.type || 'spark', x, y,
          vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp + (o.vy || 0),
          life: G.rand(o.lMin || 0.3, o.lMax || 0.9), size: G.rand(o.zMin || 0.2, o.zMax || 0.6),
          color: o.color || '#ffcf80', grow: o.grow || 0,
        });
      }
    }
    update(dt) {
      let dead = false;
      for (const p of this.list) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.life -= dt;
        p.size += p.grow * dt;
        if (p.type === 'smoke') { p.vx *= 1 - dt * 0.25; p.vy *= 1 - dt * 0.25; p.grow *= 1 - dt * 0.4; }
        if (p.life <= 0) dead = true;
      }
      if (dead) this.list = this.list.filter((p) => p.life > 0);
    }
  }
  RF.Particles = Particles;

  const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

  // --- Tekstur: støy til slitt metall ---
  function noiseCanvas(size, seed, dark, light) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < size * size * 0.5; i++) {
      const px = rnd() * size, py = rnd() * size;
      x.fillStyle = rnd() < 0.5 ? dark : light;
      x.globalAlpha = rnd() * 0.5;
      x.fillRect(px, py, 1 + rnd() * 1.5, 1);
    }
    // Riper.
    x.globalAlpha = 0.25;
    x.strokeStyle = light;
    for (let i = 0; i < 10; i++) {
      x.beginPath();
      const px = rnd() * size, py = rnd() * size;
      x.moveTo(px, py);
      x.lineTo(px + rnd() * 20 - 10, py + rnd() * 6 - 3);
      x.stroke();
    }
    return c;
  }
  RF.noiseCanvas = noiseCanvas;

  // Malingsvarianter for skip. Slitt, rustent metall.
  RF.PAINTS = {
    player: { hull: ['#a39c8c', '#666256', '#2a2823'], plate: 'rgba(28,26,22,0.55)', accent: '#c48a2c', glass: ['#b9e6ee', '#3b8aa0', '#0c2a33'], rust: 'rgba(120,60,25,0.45)' },
    drone: { hull: ['#b89c52', '#7a6530', '#352b14'], plate: 'rgba(30,26,14,0.55)', accent: '#2a2a2a', glass: ['#ffd9a0', '#a0641e', '#2a1604'], rust: 'rgba(110,50,20,0.5)' },
    hauler: { hull: ['#94604a', '#5e3829', '#261510'], plate: 'rgba(24,14,10,0.55)', accent: '#d9cba4', glass: ['#b9e6ee', '#3b8aa0', '#0c2a33'], rust: 'rgba(60,30,15,0.5)' },
  };

  // --- Bakgrunn ---
  function makeStars(n, seed) {
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = rnd();
      out.push({ x: rnd() * 2048, y: rnd() * 2048, r: 0.4 + rnd() * 1.1, a: 0.2 + rnd() * 0.6,
        c: t < 0.1 ? '#ffd6a8' : t < 0.2 ? '#bcd8ff' : '#ffffff' });
    }
    return out;
  }

  function makeNebula(sky) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = sky.deep;
    x.fillRect(0, 0, 512, 512);
    let seed = sky.neb.join('').length * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 22; i++) {
      const cx = rnd() * 512, cy = rnd() * 512, r = 60 + rnd() * 200;
      const col = sky.neb[i % sky.neb.length];
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, col + '28');
      g.addColorStop(1, col + '00');
      x.fillStyle = g;
      x.fillRect(0, 0, 512, 512);
    }
    return c;
  }

  // Svevende støv i flere dybder (parallaks rundt 1 = i samme plan som skipet).
  function makeMotes(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const par = G.rand(0.55, 1.35);
      out.push({ x: Math.random() * 1600, y: Math.random() * 1600, par, s: G.rand(0.6, 1.9) * par,
        vx: G.rand(-3, 3), vy: G.rand(-3, 3), a: G.rand(0.25, 0.7), warm: Math.random() < 0.3 });
    }
    return out;
  }

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.layers = [
        { stars: makeStars(260, 11), par: 0.04 },
        { stars: makeStars(150, 23), par: 0.1 },
        { stars: makeStars(60, 37), par: 0.22 },
      ];
      this.motes = makeMotes(170);
      this.nebulae = {};
      this.light = document.createElement('canvas');
      this.lctx = this.light.getContext('2d');
      this.grime = null;
      this.resize();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.dpr = dpr;
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.floor(this.w * dpr);
      this.canvas.height = Math.floor(this.h * dpr);
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      // Lyskartet trenger ikke full oppløsning, lys er mykt uansett.
      this.ls = 0.5;
      this.light.width = Math.ceil(this.w * this.ls);
      this.light.height = Math.ceil(this.h * this.ls);
    }

    toScreen(cam, x, y) {
      return { x: (x - cam.x) * cam.zoom + this.w / 2, y: (y - cam.y) * cam.zoom + this.h / 2 };
    }

    grimePattern() {
      if (!this.grime) {
        this.grime = this.ctx.createPattern(noiseCanvas(96, 4242, '#000000', '#d8cfb8'), 'repeat');
      }
      return this.grime;
    }

    drawBackground(game) {
      const { ctx, w, h, dpr } = this;
      const cam = game.cam, def = game.sys.def, sky = def.sky;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = sky.deep;
      ctx.fillRect(0, 0, w, h);

      let neb = this.nebulae[def.id];
      if (!neb) neb = this.nebulae[def.id] = makeNebula(sky);
      const size = Math.max(w, h) * 1.6;
      const nx = -((cam.x * 0.01) % size) - size * 0.3, ny = -((cam.y * 0.01) % size) - size * 0.3;
      ctx.globalAlpha = 0.8;
      ctx.drawImage(neb, nx, ny, size, size);
      ctx.drawImage(neb, nx + size, ny, size, size);
      ctx.drawImage(neb, nx, ny + size, size, size);
      ctx.drawImage(neb, nx + size, ny + size, size, size);
      ctx.globalAlpha = 1;

      // Solen ligger uendelig langt unna i retning starDir.
      const sd = sky.starDir;
      const sx = w / 2 + Math.cos(sd) * Math.max(w, h) * 0.62, sy = h / 2 + Math.sin(sd) * Math.max(w, h) * 0.62;
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.4);
      sg.addColorStop(0, sky.star + 'aa');
      sg.addColorStop(0.03, sky.star + '33');
      sg.addColorStop(0.25, sky.star + '0a');
      sg.addColorStop(1, sky.star + '00');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      // Planet i bakgrunnen, dempet.
      const pl = def.planet;
      const pr = Math.min(w, h) * pl.r;
      const px = pl.x * w - cam.x * 0.02, py = pl.y * h - cam.y * 0.02;
      const lx = Math.cos(sd), ly = Math.sin(sd);
      ctx.globalAlpha = 0.6;
      if (pl.ring) {
        ctx.save();
        ctx.translate(px, py); ctx.rotate(-0.35); ctx.scale(1, 0.28);
        ctx.strokeStyle = pl.band + '44'; ctx.lineWidth = pr * 0.35;
        ctx.beginPath(); ctx.arc(0, 0, pr * 1.75, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
      const pg = ctx.createRadialGradient(px + lx * pr * 0.5, py + ly * pr * 0.5, pr * 0.1, px, py, pr);
      pg.addColorStop(0, pl.band);
      pg.addColorStop(0.55, pl.color);
      pg.addColorStop(1, '#030407');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
      ctx.globalAlpha = 0.12; ctx.strokeStyle = pl.band; ctx.lineWidth = pr * 0.06;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath(); ctx.ellipse(px, py + i * pr * 0.26, pr * 1.1, pr * 0.06, -0.1, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(px + lx * pr, py + ly * pr, px - lx * pr, py - ly * pr);
      shade.addColorStop(0, 'rgba(0,0,0,0.1)');
      shade.addColorStop(0.5, 'rgba(0,0,0,0.45)');
      shade.addColorStop(1, 'rgba(0,0,0,0.95)');
      ctx.fillStyle = shade; ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      ctx.restore();
      ctx.globalAlpha = 0.6;
      if (pl.ring) {
        ctx.save();
        ctx.translate(px, py); ctx.rotate(-0.35); ctx.scale(1, 0.28);
        ctx.strokeStyle = pl.band + '55'; ctx.lineWidth = pr * 0.35;
        ctx.beginPath(); ctx.arc(0, 0, pr * 1.75, 0, Math.PI); ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // Stjerner i tre parallaks-lag.
      for (const L of this.layers) {
        const ox = -cam.x * L.par, oy = -cam.y * L.par;
        for (const s of L.stars) {
          let x = (s.x + ox) % 2048, y = (s.y + oy) % 2048;
          if (x < 0) x += 2048;
          if (y < 0) y += 2048;
          for (let tx = x; tx < w; tx += 2048) {
            for (let ty = y; ty < h; ty += 2048) {
              ctx.globalAlpha = s.a;
              ctx.fillStyle = s.c;
              ctx.fillRect(tx, ty, s.r, s.r);
            }
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    drawMotes(game, dt) {
      const { ctx, w, h, dpr } = this;
      const cam = game.cam, z = cam.zoom;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const T = 1600;
      for (const m of this.motes) {
        m.x += m.vx * dt * 0.2; m.y += m.vy * dt * 0.2;
        // Parallaks i forhold til verden: støvet ligger litt foran eller bak skipet.
        let x = (m.x - cam.x * z * m.par * 0.35) % T, y = (m.y - cam.y * z * m.par * 0.35) % T;
        if (x < 0) x += T;
        if (y < 0) y += T;
        for (let tx = x; tx < w; tx += T) {
          for (let ty = y; ty < h; ty += T) {
            ctx.globalAlpha = m.a;
            ctx.fillStyle = m.warm ? '#d8c3a0' : '#b9c0c8';
            ctx.beginPath(); ctx.arc(tx, ty, m.s, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    worldTransform(ctx, game, scale) {
      const { w, h } = this, cam = game.cam, z = cam.zoom;
      ctx.setTransform(scale * z, 0, 0, scale * z, scale * (w / 2 - cam.x * z), scale * (h / 2 - cam.y * z));
    }

    draw(game, dt = 1 / 60) {
      const { ctx, w, h } = this;
      const cam = game.cam;
      this.drawBackground(game);
      const z = cam.zoom;
      this.worldTransform(ctx, game, this.dpr);
      this.px = 1 / z; // én skjermpiksel i meter
      const view = { x0: cam.x - w / 2 / z - 80, x1: cam.x + w / 2 / z + 80, y0: cam.y - h / 2 / z - 80, y1: cam.y + h / 2 / z + 80 };
      const vis = (x, y, r) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;
      this.vis = vis;
      const sys = game.sys;
      const sunDir = sys.def.sky.starDir;
      const ship = game.ship;
      const shipLive = ship && !game.dead;

      // 2. Faste ting.
      this.drawGateRing(sys.gate, game.time, vis);
      this.drawStation(sys.station, game, vis);
      for (const b of sys.world.bodies) {
        if ((b.kind === 'rock' || b.kind === 'ore') && vis(b.x, b.y, b.radius)) this.drawRock(b, sunDir);
      }
      this.drawParticles(game.particles, vis, 'solid');
      for (const r of sys.world.ropes) this.drawRope(r);
      for (const b of sys.world.bodies) {
        if (b.kind === 'wreck' && vis(b.x, b.y, b.radius)) this.drawModular({ body: b, layout: b.modules }, game.time);
      }
      for (const n of sys.npcs || []) if (n.active && vis(n.body.x, n.body.y, 40)) this.drawModular(n, game.time);
      if (shipLive) {
        ship._lights = ship.lightOn && !ship.docked ? RF.lightSources(ship) : [];
        this.drawModular(ship, game.time);
      }
      this.drawMotes(game, dt);

      // 3. Mørke med lys.
      this.drawLighting(game);

      // 4. Selvlysende.
      this.worldTransform(ctx, game, this.dpr);
      this.drawGateGlow(sys.gate, game.time, vis);
      this.drawStationLights(sys.station, game, vis);
      for (const b of sys.world.bodies) {
        if (b.heat > 0.02 && b.hitX != null && vis(b.hitX, b.hitY, 10)) this.drawHeat(b);
      }
      if (shipLive && !ship.docked) this.drawHaze(ship);
      for (const n of sys.npcs || []) {
        if (!n.active || !vis(n.body.x, n.body.y, 60)) continue;
        this.drawHaze(n);
        this.drawModularFx(n, game.time);
        this.drawBeams(n);
      }
      if (shipLive) {
        if (ship.tractor.on && !ship.docked) this.drawTractor(ship, game.time);
        this.drawModularFx(ship, game.time);
        this.drawBeams(ship);
      }
      RF.Weapons.draw(ctx, this.px);
      this.drawParticles(game.particles, vis, 'glow');
    }

    // Mørket legges over alt, og lyskildene "skjærer" hull i det.
    drawLighting(game) {
      const L = this.lctx, ls = this.ls, sys = game.sys, ship = game.ship;
      L.setTransform(1, 0, 0, 1, 0, 0);
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, this.light.width, this.light.height);
      L.fillStyle = 'rgba(1,2,6,0.72)';
      L.fillRect(0, 0, this.light.width, this.light.height);
      L.globalCompositeOperation = 'destination-out';
      this.worldTransform(L, game, ls);
      const vis = this.vis;

      const glow = (x, y, r, a) => {
        if (!vis(x, y, r)) return;
        const g = L.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${a})`);
        g.addColorStop(0.5, `rgba(0,0,0,${a * 0.45})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        L.fillStyle = g;
        L.beginPath(); L.arc(x, y, r, 0, Math.PI * 2); L.fill();
      };
      const cone = (x, y, dir, half, r, a) => {
        for (const [k, f] of [[1.5, 0.35], [1, 1]]) {
          const g = L.createRadialGradient(x, y, 0, x, y, r);
          g.addColorStop(0, `rgba(0,0,0,${a * f})`);
          g.addColorStop(0.6, `rgba(0,0,0,${a * f * 0.6})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          L.fillStyle = g;
          L.beginPath(); L.moveTo(x, y); L.arc(x, y, r, dir - half * k, dir + half * k); L.closePath(); L.fill();
        }
      };
      const shipLights = (o) => {
        const b = o.body;
        glow(b.x, b.y, b.radius + 10, 0.5);
        for (const Ls of o._lights || []) {
          const n = b.toWorld(Ls.lx, Ls.ly);
          cone(n.x, n.y, b.a, 0.42, Ls.range, 0.95);
        }
        if (o.fx.main > 0.05) {
          for (const m of o.layout) {
            if (m.t !== 'thruster' && m.t !== 'thruster2') continue;
            const t = b.toWorld(m.lx - RF.CELL, m.ly);
            glow(t.x, t.y, 8 + o.fx.main * 18, 0.7 * o.fx.main);
          }
        }
        const d = b.dirWorld(1, 0);
        for (const B of o.beams || []) {
          const n = b.toWorld(B.lx, B.ly);
          for (let s = 0; s < B.len; s += 14) glow(n.x + d.x * s, n.y + d.y * s, 7, 0.35);
          if (B.hit) glow(B.hit.x, B.hit.y, 18, 1);
        }
      };

      if (ship && !game.dead) shipLights(ship);
      for (const n of sys.npcs || []) if (n.active) shipLights(n);
      for (const p of RF.Weapons.list) if (p.type === 'rocket') glow(p.x, p.y, 20, 0.8);

      const st = sys.station;
      glow(st.x, st.y, 230, 0.55);
      const dp = RF.dockPoint(st);
      glow(dp.x, dp.y, 50, 0.6);
      const g = sys.gate;
      const open = g.state === 'open' || g.state === 'kawoosh' || g.state === 'closing';
      if (open) glow(g.x, g.y, 90, 0.9);
      else glow(g.x, g.y, 40, 0.25 + g.chevrons * 0.05);
      let n = 0;
      for (const p of game.particles.list) {
        if (p.type !== 'glow' && p.type !== 'spark') continue;
        if (++n > 80) break;
        glow(p.x, p.y, 4 + p.size * 6, 0.5 * (p.life / p.max));
      }
      for (const b of sys.world.bodies) if (b.heat > 0.05 && b.hitX != null) glow(b.hitX, b.hitY, 8 + b.heat * 10, b.heat);

      const { ctx, dpr } = this;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.light, 0, 0, this.w, this.h);
    }

    // Kantete stein: fasetter fra et toppunkt ut til hver kant, hver med sin
    // egen lysstyrke etter hvordan flaten vender mot sola.
    drawRock(b, sunDir) {
      const ctx = this.ctx, M = RF.MATERIALS[b.mat];
      const rgb = M._rgb || (M._rgb = {
        base: hexRgb(M.base), dark: hexRgb(M.dark), light: hexRgb(M.light),
      });
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      const v = b.verts, n = v.length, r = b.radius;
      let ax = b.apex ? b.apex.x * r : 0, ay = b.apex ? b.apex.y * r : 0;
      if (b.kind === 'ore' || !b.containsPoint(b.toWorld(ax, ay).x, b.toWorld(ax, ay).y)) { ax = 0; ay = 0; }
      const la = sunDir - b.a, lx = Math.cos(la), ly = Math.sin(la);
      for (let i = 0; i < n; i++) {
        const p = v[i], q = v[(i + 1) % n];
        const nn = b.normals[i];
        let k = 0.5 + 0.5 * (nn.x * lx + nn.y * ly) + (b.shade ? b.shade[i % b.shade.length] : 0);
        k = G.clamp(k, 0, 1);
        const c = k < 0.5 ? mix(rgb.dark, rgb.base, k * 2) : mix(rgb.base, rgb.light, (k - 0.5) * 2);
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.lineWidth = this.px;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
      if (b.craters.length || b.veins.length || b.core) {
        ctx.save();
        ctx.clip();
        for (const c of b.craters) {
          ctx.fillStyle = M.dark + '88';
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = M.light + '33';
          ctx.beginPath(); ctx.arc(c.x - lx * c.r * 0.3, c.y - ly * c.r * 0.3, c.r * 0.7, 0, Math.PI * 2); ctx.fill();
        }
        if (b.veins.length) {
          ctx.strokeStyle = (b.veinColor || M.vein || M.light) + 'bb';
          ctx.lineWidth = Math.max(0.3, r * 0.045);
          ctx.lineJoin = 'miter';
          for (const vn of b.veins) {
            ctx.beginPath();
            ctx.moveTo(vn[0].x, vn[0].y);
            for (let i = 1; i < vn.length; i++) ctx.lineTo(vn[i].x, vn[i].y);
            ctx.stroke();
          }
        }
        // Et islag med en mørk kjerne som skimter gjennom.
        if (b.core) {
          const C2 = RF.MATERIALS[b.core];
          const cr = Math.sqrt(b.coreArea / Math.PI);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, cr * 1.3);
          g.addColorStop(0, C2.base + '66');
          g.addColorStop(1, C2.base + '00');
          ctx.fillStyle = g;
          ctx.fillRect(-r, -r, r * 2, r * 2);
        }
        ctx.restore();
      }
      ctx.strokeStyle = b.kind === 'ore' ? M.light + 'aa' : '#0b0a09';
      ctx.lineWidth = this.px * (b.kind === 'ore' ? 1.4 : 1.2);
      ctx.stroke();
      if (M.crystal || (b.kind === 'ore' && M.vein)) {
        ctx.fillStyle = (M.vein || M.light) + '30';
        ctx.fill();
      }
      ctx.restore();

      // Små malmbiter får en markør så de synes når man zoomer ut.
      if (b.kind === 'ore' && b.radius < this.px * 3) {
        ctx.fillStyle = (M.vein || M.light) + 'aa';
        ctx.beginPath(); ctx.arc(b.x, b.y, this.px * 1.8, 0, Math.PI * 2); ctx.fill();
      }
    }

    drawHeat(b) {
      const ctx = this.ctx;
      const hr = 1.5 + b.heat * 3.5;
      const hg = ctx.createRadialGradient(b.hitX, b.hitY, 0, b.hitX, b.hitY, hr);
      hg.addColorStop(0, `rgba(255,240,200,${0.9 * b.heat})`);
      hg.addColorStop(0.35, `rgba(255,140,40,${0.6 * b.heat})`);
      hg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(b.hitX, b.hitY, hr, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    drawRope(r) {
      const ctx = this.ctx;
      const a = r.A.toWorld(r.la.x, r.la.y), b = r.B.toWorld(r.lb.x, r.lb.y);
      const slack = Math.max(0, r.length - (r.dist || 0));
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      // Slakk kabel bukter seg litt.
      const nx = -(b.y - a.y), ny = b.x - a.x, nl = G.len(nx, ny) || 1;
      const bend = Math.min(6, slack * 0.4);
      ctx.strokeStyle = '#1b1a17';
      ctx.lineWidth = Math.max(0.35, this.px * 2.2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx + (nx / nl) * bend, my + (ny / nl) * bend, b.x, b.y); ctx.stroke();
      ctx.strokeStyle = '#8f8878';
      ctx.lineWidth = Math.max(0.15, this.px);
      ctx.setLineDash([0.6, 0.5]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Ankerklo.
      ctx.fillStyle = '#6f685a';
      ctx.beginPath(); ctx.arc(b.x, b.y, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1b1a17'; ctx.lineWidth = 0.2; ctx.stroke();
    }

    drawTractor(ship, time) {
      const ctx = this.ctx;
      ctx.globalCompositeOperation = 'lighter';
      for (const o of ship.tractor.targets) {
        const ip = o._tractorFrom || ship.body;
        const gr = ctx.createLinearGradient(ip.x, ip.y, o.x, o.y);
        gr.addColorStop(0, 'rgba(120,255,210,0.5)');
        gr.addColorStop(1, 'rgba(120,255,210,0.05)');
        ctx.strokeStyle = gr;
        ctx.lineWidth = Math.max(0.8, Math.sqrt(o.area) * 1.2);
        ctx.setLineDash([1.2, 1.4]);
        ctx.lineDashOffset = -time * 10;
        ctx.beginPath(); ctx.moveTo(ip.x, ip.y); ctx.lineTo(o.x, o.y); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'source-over';
    }

    drawStation(st, game, vis) {
      if (!vis(st.x, st.y, 130)) return;
      const ctx = this.ctx, t = game.time;
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.a);
      const px = this.px;
      const pat = this.grimePattern();
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.35));
      const grime = (x, y, w, h) => {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = pat;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      };

      // Solpanel-master og paneler.
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#3a3731';
        ctx.fillRect(-5, s > 0 ? 30 : -44, 10, 14);
        const y0 = s > 0 ? 44 : -110;
        ctx.fillStyle = '#10161f';
        ctx.fillRect(-40, y0, 80, 66);
        ctx.strokeStyle = '#2d4460';
        ctx.lineWidth = Math.max(0.25, px);
        for (let x = -40; x <= 40; x += 8) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 66); ctx.stroke(); }
        for (let y = 0; y <= 66; y += 11) { ctx.beginPath(); ctx.moveTo(-40, y0 + y); ctx.lineTo(40, y0 + y); ctx.stroke(); }
        // Noen døde celler.
        ctx.fillStyle = '#07090c';
        ctx.fillRect(-32, y0 + 11, 8, 11); ctx.fillRect(16, y0 + 33, 8, 11);
        ctx.fillStyle = '#4e4a41';
        ctx.fillRect(-3, y0, 6, 66);
        ctx.strokeStyle = '#1a1814'; ctx.lineWidth = Math.max(0.4, px * 1.5);
        ctx.strokeRect(-40, y0, 80, 66);
      }
      // Antennemast med parabol og lasteport for arbeidsskipene.
      ctx.fillStyle = '#4a463e';
      ctx.fillRect(-74, -4, 38, 8);
      grime(-74, -4, 38, 8);
      ctx.fillStyle = '#6e695e';
      ctx.beginPath(); ctx.ellipse(-78, 0, 5, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1814'; ctx.lineWidth = Math.max(0.3, px); ctx.stroke();

      // Dokkingsarm.
      ctx.fillStyle = '#58534a';
      ctx.fillRect(36, -8, 60, 16);
      grime(36, -8, 60, 16);
      ctx.fillStyle = '#2e2b26';
      for (let x = 42; x < 94; x += 9) ctx.fillRect(x, -8, 3, 16);
      // Varselstriper ved dokkingsbukta.
      ctx.save();
      ctx.beginPath(); ctx.rect(86, -8, 8, 16); ctx.clip();
      ctx.fillStyle = '#b88a2a';
      for (let y = -16; y < 16; y += 4) { ctx.beginPath(); ctx.moveTo(86, y); ctx.lineTo(94, y + 8); ctx.lineTo(94, y + 10); ctx.lineTo(86, y + 2); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#6a655a';
      ctx.fillRect(94, -14, 6, 28);
      ctx.fillRect(94, -14, 14, 4);
      ctx.fillRect(94, 10, 14, 4);
      const lc = game.dockReady ? '80,255,150' : '255,190,80';
      ctx.strokeStyle = `rgba(${lc},0.5)`;
      ctx.lineWidth = Math.max(0.3, px * 1.2);
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.arc(116, 0, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);

      // Nav.
      const hub = G.regular(38, 8, Math.PI / 8);
      ctx.beginPath();
      hub.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      const hg = ctx.createRadialGradient(-10, -10, 4, 0, 0, 40);
      hg.addColorStop(0, '#9c968a');
      hg.addColorStop(0.7, '#57534a');
      hg.addColorStop(1, '#2c2a25');
      ctx.fillStyle = hg;
      ctx.fill();
      ctx.save(); ctx.clip(); grime(-40, -40, 80, 80);
      ctx.strokeStyle = 'rgba(15,14,12,0.7)'; ctx.lineWidth = Math.max(0.3, px);
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 + (i / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 16, Math.sin(a) * 16); ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#141310';
      ctx.lineWidth = Math.max(0.4, px * 1.5);
      ctx.stroke();
      ctx.save();
      ctx.rotate(t * 0.05);
      ctx.strokeStyle = '#26241f';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#1b1a17';
      ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
      const dg = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
      dg.addColorStop(0, '#d7e6e0');
      dg.addColorStop(0.5, '#4d8a92');
      dg.addColorStop(1, '#122a30');
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    drawStationLights(st, game, vis) {
      if (!vis(st.x, st.y, 130)) return;
      const ctx = this.ctx, t = game.time;
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.a);
      ctx.globalCompositeOperation = 'lighter';
      const lc = game.dockReady ? '80,255,150' : '255,190,80';
      for (let i = 0; i < 5; i++) {
        const on = ((t * 3 - i * 0.4) % 2) < 0.6;
        ctx.fillStyle = `rgba(${lc},${on ? 0.95 : 0.2})`;
        ctx.beginPath(); ctx.arc(100 + i * 4, -12, 0.9, 0, Math.PI * 2); ctx.arc(100 + i * 4, 12, 0.9, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.rotate(t * 0.05);
      ctx.fillStyle = 'rgba(255,205,130,0.85)';
      for (let i = 0; i < 24; i++) {
        if ((i * 7) % 5 === 0) continue;
        const a = (i / 24) * Math.PI * 2;
        ctx.fillRect(Math.cos(a) * 25 - 0.6, Math.sin(a) * 25 - 0.6, 1.2, 1.2);
      }
      ctx.restore();
      if ((t % 1.6) < 0.2) {
        ctx.fillStyle = 'rgba(255,70,60,0.95)';
        for (const p of G.regular(38, 8, Math.PI / 8)) { ctx.beginPath(); ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2); ctx.fill(); }
      }
      // Lasteporten for arbeidsskipene blinker gult.
      if ((t % 2) < 1) {
        ctx.fillStyle = 'rgba(255,190,60,0.9)';
        ctx.beginPath(); ctx.arc(-92, -7, 1, 0, Math.PI * 2); ctx.arc(-92, 7, 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    drawGateRing(g, time, vis) {
      if (!vis(g.x, g.y, 60)) return;
      const ctx = this.ctx, R = RF.GATE_R, depth = R * 0.34;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.a);
      ctx.save();
      ctx.scale(depth / R, 1);
      ctx.lineWidth = 4.6;
      ctx.strokeStyle = '#3b3a37';
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#6f6c64';
      ctx.beginPath(); ctx.arc(0, 0, R - 1.6, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#1e1d1a';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 39; i++) {
        const a = (i / 39) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (R - 1.8), Math.sin(a) * (R - 1.8));
        ctx.lineTo(Math.cos(a) * (R + 1.8), Math.sin(a) * (R + 1.8));
        ctx.stroke();
      }
      ctx.restore();
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * depth, Math.sin(a) * R);
        ctx.fillStyle = '#5a4128';
        ctx.beginPath(); ctx.moveTo(-1.6, -1.2); ctx.lineTo(1.6, -1.2); ctx.lineTo(0, 1.4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(120,200,255,0.3)';
      ctx.lineWidth = Math.max(0.3, this.px);
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(depth + 4, 0); ctx.lineTo(depth + 40, 0); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    drawGateGlow(g, time, vis) {
      if (!vis(g.x, g.y, 60)) return;
      const ctx = this.ctx, R = RF.GATE_R, depth = R * 0.34;
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.a);
      const open = g.state === 'open' || g.state === 'kawoosh' || g.state === 'closing';
      if (open) {
        let a = 1;
        if (g.state === 'closing') a = Math.max(0, 1 - g.t / 0.6);
        const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
        hg.addColorStop(0, `rgba(210,245,255,${0.95 * a})`);
        hg.addColorStop(0.5, `rgba(80,170,255,${0.85 * a})`);
        hg.addColorStop(1, `rgba(20,70,200,${0.8 * a})`);
        ctx.save();
        ctx.scale(depth / R, 1);
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.arc(0, 0, R - 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const rr = ((time * 4 + i * 3.2) % 16) / 16;
          ctx.strokeStyle = `rgba(200,240,255,${0.35 * (1 - rr) * a})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(Math.sin(time * 1.3 + i) * 0.8, 0, rr * (R - 1.5), 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.8);
        glow.addColorStop(0, `rgba(90,180,255,${0.35 * a})`);
        glow.addColorStop(1, 'rgba(90,180,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, R * 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      if (g.state === 'kawoosh') {
        const k = Math.sin(Math.min(1, g.t / RF.KAWOOSH_TIME) * Math.PI);
        const L = RF.KAWOOSH_LEN * k;
        ctx.globalCompositeOperation = 'lighter';
        const kg = ctx.createRadialGradient(L * 0.35, 0, 0, L * 0.35, 0, L * 0.7 + 4);
        kg.addColorStop(0, 'rgba(255,255,255,0.95)');
        kg.addColorStop(0.4, 'rgba(120,200,255,0.8)');
        kg.addColorStop(1, 'rgba(40,110,255,0)');
        ctx.fillStyle = kg;
        ctx.beginPath(); ctx.ellipse(L * 0.45, 0, L * 0.55 + 2, R * 0.85, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      for (let i = 0; i < 9; i++) {
        const lit = i < 7 && (g.chevrons > i || open);
        if (!lit) continue;
        const a = -Math.PI / 2 + (i / 9) * Math.PI * 2;
        ctx.save();
        ctx.translate(Math.cos(a) * depth, Math.sin(a) * R);
        ctx.fillStyle = '#ffb04a';
        ctx.beginPath(); ctx.moveTo(-1.6, -1.2); ctx.lineTo(1.6, -1.2); ctx.lineTo(0, 1.4); ctx.closePath(); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createRadialGradient(0, 0, 0, 0, 0, 4);
        lg.addColorStop(0, 'rgba(255,170,60,0.8)');
        lg.addColorStop(1, 'rgba(255,120,20,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // pass 'solid' = røyk og steinbiter (blir opplyst), 'glow' = gnister og glød.
    drawParticles(P, vis, pass) {
      const ctx = this.ctx;
      for (const p of P.list) {
        const solid = p.type === 'smoke' || p.type === 'debris';
        if ((pass === 'solid') !== solid) continue;
        if (!vis(p.x, p.y, 10)) continue;
        const k = Math.max(0, p.life / p.max);
        if (p.type === 'smoke') {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = k * 0.4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'debris') {
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
          ctx.stroke();
          if (p.type === 'glow') {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  RF.Renderer = Renderer;
})();
