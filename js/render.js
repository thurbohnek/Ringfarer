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
      for (const n of sys.npcs || []) if (n.active && vis(n.body.x, n.body.y, 30)) this.drawShipHull(n, RF.PAINTS[n.T.paint], n.T.scale, game.time, sunDir);
      if (shipLive) this.drawShipHull(ship, RF.PAINTS.player, 1, game.time, sunDir);
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
      if (shipLive && ship.lightOn && !ship.docked) this.drawBeamHaze(ship, 1, ship.stats.light);
      for (const n of sys.npcs || []) {
        if (!n.active || !vis(n.body.x, n.body.y, 60)) continue;
        this.drawBeamHaze(n, n.T.scale, 60);
        this.drawShipFx(n, n.T.scale, game.time);
        this.drawLaser(n, n.T.scale);
      }
      if (shipLive) {
        if (ship.tractor.on && !ship.docked) this.drawTractor(ship, game.time);
        this.drawShipFx(ship, 1, game.time);
        this.drawLaser(ship, 1);
      }
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
      const shipLights = (o, scale, range, lightOn) => {
        const b = o.body;
        glow(b.x, b.y, 16 * scale, 0.5);
        if (lightOn) {
          const n = b.toWorld(RF.SHIP_NOSE.x * scale, 0);
          cone(n.x, n.y, b.a, 0.42, range, 0.95);
        }
        if (o.fx.main > 0.05) {
          const t = b.toWorld(-9 * scale, 0);
          glow(t.x, t.y, (8 + o.fx.main * 22) * scale, 0.8 * o.fx.main);
        }
        if (o.laser && o.laser.on) {
          const n = b.toWorld(RF.SHIP_NOSE.x * scale, 0), d = b.dirWorld(1, 0);
          for (let s = 0; s < o.laser.len; s += 12) glow(n.x + d.x * s, n.y + d.y * s, 7, 0.35);
          if (o.laser.hit) glow(o.laser.hit.x, o.laser.hit.y, 18, 1);
        }
      };

      if (ship && !game.dead) shipLights(ship, 1, ship.stats.light, ship.lightOn && !ship.docked);
      for (const n of sys.npcs || []) if (n.active) shipLights(n, n.T.scale, 60, true);

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

    drawRock(b, sunDir) {
      const ctx = this.ctx, M = RF.MATERIALS[b.mat];
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      const v = b.verts;
      ctx.beginPath();
      ctx.moveTo(v[0].x, v[0].y);
      for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
      ctx.closePath();
      ctx.fillStyle = M.base;
      ctx.fill();
      const r = b.radius;
      const la = sunDir - b.a, lx = Math.cos(la), ly = Math.sin(la);
      const g = ctx.createLinearGradient(lx * r, ly * r, -lx * r, -ly * r);
      g.addColorStop(0, M.light + 'dd');
      g.addColorStop(0.45, M.light + '00');
      g.addColorStop(0.6, M.dark + '00');
      g.addColorStop(1, M.dark + 'ee');
      ctx.fillStyle = g;
      ctx.fill();
      if (b.craters.length || b.veins.length) {
        ctx.save();
        ctx.clip();
        for (const c of b.craters) {
          ctx.fillStyle = M.dark + '99';
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = M.light + '44';
          ctx.beginPath(); ctx.arc(c.x - lx * c.r * 0.25, c.y - ly * c.r * 0.25, c.r * 0.75, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = M.dark + '88';
          ctx.beginPath(); ctx.arc(c.x - lx * c.r * 0.12, c.y - ly * c.r * 0.12, c.r * 0.7, 0, Math.PI * 2); ctx.fill();
        }
        if (b.veins.length) {
          ctx.strokeStyle = M.vein + '99';
          ctx.lineWidth = Math.max(0.35, r * 0.05);
          ctx.lineJoin = 'round';
          for (const vn of b.veins) {
            ctx.beginPath();
            ctx.moveTo(vn[0].x, vn[0].y);
            for (let i = 1; i < vn.length; i++) ctx.lineTo(vn[i].x, vn[i].y);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
      ctx.strokeStyle = b.kind === 'ore' ? M.light + 'aa' : M.dark;
      ctx.lineWidth = this.px * (b.kind === 'ore' ? 1.4 : 1.2);
      ctx.stroke();
      if (b.kind === 'ore' && M.vein) {
        ctx.fillStyle = M.vein + '44';
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

    // Skroget. obj trenger body, fx, scars; paint fra RF.PAINTS; scale 1 = spillerens skip.
    drawShipHull(obj, paint, scale, time, sunDir) {
      const ctx = this.ctx, b = obj.body;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.scale(scale, scale);

      // Motorgondoler.
      for (const s of [-1, 1]) {
        const y0 = s * 1.7, y1 = s * 4.1;
        const top = Math.min(y0, y1), hh = Math.abs(y1 - y0);
        const ng = ctx.createLinearGradient(0, top, 0, top + hh);
        ng.addColorStop(0, '#4a4740');
        ng.addColorStop(1, '#1d1c19');
        ctx.fillStyle = ng;
        ctx.fillRect(-8.2, top, 6.8, hh);
        ctx.fillStyle = '#2a2824';
        for (let x = -7.6; x < -2; x += 1.2) ctx.fillRect(x, top, 0.25, hh);
        ctx.fillStyle = '#6d6a60';
        ctx.fillRect(-8.2, top, 1.1, hh);
        ctx.fillStyle = '#1a1917';
        ctx.fillRect(-8.5, s * 2.9 - 0.85, 0.6, 1.7);
      }

      const hull = [[8.6, 0], [6.6, 1.5], [4.6, 3.3], [0, 3.9], [-4.4, 4.5], [-7.2, 3.1], [-7.2, -3.1], [-4.4, -4.5], [0, -3.9], [4.6, -3.3], [6.6, -1.5]];
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(hull[0][0], hull[0][1]);
        for (let i = 1; i < hull.length; i++) ctx.lineTo(hull[i][0], hull[i][1]);
        ctx.closePath();
      };
      path();
      const la = sunDir - b.a;
      const hg = ctx.createLinearGradient(Math.cos(la) * 7, Math.sin(la) * 7, -Math.cos(la) * 7, -Math.sin(la) * 7);
      hg.addColorStop(0, paint.hull[0]);
      hg.addColorStop(0.5, paint.hull[1]);
      hg.addColorStop(1, paint.hull[2]);
      ctx.fillStyle = hg;
      ctx.fill();

      ctx.save();
      ctx.clip();
      // Skitt og slitasje.
      const pat = this.grimePattern();
      if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.09));
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = pat;
      ctx.fillRect(-9, -5, 18, 10);
      ctx.globalAlpha = 1;
      // Tykke pansrede plater langs ryggen.
      ctx.fillStyle = paint.plate;
      ctx.beginPath();
      ctx.moveTo(6.2, 0.9); ctx.lineTo(-6.6, 1.6); ctx.lineTo(-6.6, -1.6); ctx.lineTo(6.2, -0.9);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,245,220,0.06)';
      ctx.fillRect(-6.4, -1.5, 12, 0.35);
      // Platekanter og nagler.
      ctx.strokeStyle = 'rgba(12,11,9,0.75)';
      ctx.lineWidth = 0.14;
      const seams = [2.4, -0.8, -3.6];
      for (const x of seams) { ctx.beginPath(); ctx.moveTo(x, -4.6); ctx.lineTo(x - 0.4, 4.6); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(4.5, 2.2); ctx.lineTo(-5.5, 3.1); ctx.moveTo(4.5, -2.2); ctx.lineTo(-5.5, -3.1); ctx.stroke();
      ctx.fillStyle = 'rgba(220,210,185,0.45)';
      for (const x of seams) {
        for (let y = -3.8; y <= 3.8; y += 0.65) {
          if (Math.abs(y) < 1.7) continue;
          ctx.beginPath(); ctx.arc(x + 0.18 - y * 0.04, y, 0.07, 0, Math.PI * 2); ctx.fill();
        }
      }
      // Rustrenner som renner bakover fra skjøtene.
      for (const x of seams) {
        for (const y of [-2.8, 2.6, -1.9, 3.3]) {
          const rg = ctx.createLinearGradient(x, 0, x - 2.2, 0);
          rg.addColorStop(0, paint.rust);
          rg.addColorStop(1, 'rgba(120,60,25,0)');
          ctx.fillStyle = rg;
          ctx.fillRect(x - 2.2, y - 0.12, 2.2, 0.24);
        }
      }
      // Falmede varselstriper.
      ctx.fillStyle = paint.accent;
      ctx.globalAlpha = 0.75;
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          const x = -1.8 + i * 0.9;
          ctx.moveTo(x, s * 3.35); ctx.lineTo(x + 0.45, s * 3.35); ctx.lineTo(x + 0.9, s * 4.3); ctx.lineTo(x + 0.45, s * 4.3);
          ctx.closePath(); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // Sot bak ved motorene.
      const sg = ctx.createRadialGradient(-7.5, 0, 0, -7.5, 0, 5);
      sg.addColorStop(0, 'rgba(8,7,6,0.8)');
      sg.addColorStop(1, 'rgba(8,7,6,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(-9, -5, 8, 10);
      // Arr etter støt.
      for (const sc of obj.scars) {
        const g = ctx.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, sc.r);
        g.addColorStop(0, 'rgba(10,8,6,0.95)');
        g.addColorStop(0.5, 'rgba(60,32,18,0.6)');
        g.addColorStop(1, 'rgba(60,32,18,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sc.x, sc.y, sc.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      path();
      ctx.strokeStyle = '#0d0c0a';
      ctx.lineWidth = Math.max(0.14, (this.px * 1.3) / scale);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.18)';
      ctx.lineWidth = 0.18;
      ctx.stroke();

      // Cockpit med ramme.
      ctx.beginPath();
      ctx.moveTo(7.4, 0); ctx.lineTo(5.7, 1.25); ctx.lineTo(3.3, 1.35); ctx.lineTo(3.3, -1.35); ctx.lineTo(5.7, -1.25);
      ctx.closePath();
      const cg = ctx.createLinearGradient(7.4, -1.3, 3.3, 1.3);
      cg.addColorStop(0, paint.glass[0]);
      cg.addColorStop(0.4, paint.glass[1]);
      cg.addColorStop(1, paint.glass[2]);
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = '#26241f';
      ctx.lineWidth = 0.3;
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5.7, 1.25); ctx.lineTo(5.7, -1.25); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.moveTo(6.6, -0.4); ctx.lineTo(5.9, -0.7); ctx.stroke();

      // Lyskaster og laseremitter i nesen.
      ctx.fillStyle = '#1a1917';
      ctx.beginPath(); ctx.arc(8.1, 0, 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = obj.laser && obj.laser.on ? '#ffd9a0' : '#3a3730';
      ctx.beginPath(); ctx.arc(8.2, 0, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Flammer, navigasjonslys og skjold (tegnes etter mørket).
    drawShipFx(obj, scale, time) {
      const ctx = this.ctx, b = obj.body, fx = obj.fx;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.scale(scale, scale);
      ctx.globalCompositeOperation = 'lighter';
      const flame = (x, y, dx, dy, len, wid, hot) => {
        if (len < 0.15) return;
        const ex = x + dx * len, ey = y + dy * len;
        const g = ctx.createLinearGradient(x, y, ex, ey);
        g.addColorStop(0, hot ? 'rgba(255,240,215,0.95)' : 'rgba(235,225,210,0.8)');
        g.addColorStop(0.25, hot ? 'rgba(120,170,255,0.75)' : 'rgba(170,190,220,0.5)');
        g.addColorStop(1, 'rgba(40,70,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(x - dy * wid, y + dx * wid);
        ctx.quadraticCurveTo(ex - dy * wid * 0.4, ey + dx * wid * 0.4, ex, ey);
        ctx.quadraticCurveTo(ex + dy * wid * 0.4, ey - dx * wid * 0.4, x + dy * wid, y - dx * wid);
        ctx.closePath();
        ctx.fill();
      };
      const fl = fx.main * (0.85 + Math.random() * 0.3);
      for (const s of [-1, 1]) {
        flame(-8.4, s * 2.9, -1, 0, 3 + fl * 11, 1.0, true);
        if (fl > 0.05) {
          const hg = ctx.createRadialGradient(-8.5, s * 2.9, 0, -8.5, s * 2.9, 3 + fl * 3);
          hg.addColorStop(0, `rgba(140,180,255,${0.5 * fl})`);
          hg.addColorStop(1, 'rgba(60,120,255,0)');
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(-8.5, s * 2.9, 3 + fl * 3, 0, Math.PI * 2); ctx.fill();
        }
        flame(5.2, s * 3.1, 0.6, s * 0.35, fx.retro * 4.5, 0.45, false);
      }
      flame(1, 4.0, 0, 1, fx.left * 3, 0.35, false);
      flame(1, -4.0, 0, -1, fx.right * 3, 0.35, false);
      flame(6.2, -2.4, 0, -1, fx.rotR * 2.6, 0.3, false);
      flame(-5.8, 4.2, 0, 1, fx.rotR * 2.6, 0.3, false);
      flame(6.2, 2.4, 0, 1, fx.rotL * 2.6, 0.3, false);
      flame(-5.8, -4.2, 0, -1, fx.rotL * 2.6, 0.3, false);

      const blink = (time * 1.2 + (obj.blinkOff || 0)) % 1 < 0.12;
      const light = (x, y, col, r) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      };
      light(-4.2, -4.4, 'rgba(255,60,50,0.9)', 1.2);
      light(-4.2, 4.4, 'rgba(60,255,120,0.9)', 1.2);
      if (blink) light(-7.3, 0, 'rgba(255,245,230,1)', 2.2);

      if (obj.shieldFlash > 0.01) {
        const a = obj.shieldFlash;
        ctx.save();
        ctx.scale(1, 0.68);
        const sg = ctx.createRadialGradient(0, 0, 8, 0, 0, 12.5);
        sg.addColorStop(0, 'rgba(90,200,255,0)');
        sg.addColorStop(0.8, `rgba(90,200,255,${0.25 * a})`);
        sg.addColorStop(1, `rgba(170,230,255,${0.7 * a})`);
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(0, 0, 12.5, 0, Math.PI * 2); ctx.fill();
        const hd = obj.shieldHitDir || 0;
        ctx.strokeStyle = `rgba(200,240,255,${a})`;
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.arc(0, 0, 12.2, hd - 0.6, hd + 0.6); ctx.stroke();
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }

    // Svakt lysende kjegle, som lys gjennom støv.
    drawBeamHaze(obj, scale, range) {
      const ctx = this.ctx, b = obj.body;
      const n = b.toWorld(RF.SHIP_NOSE.x * scale, 0);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, range);
      g.addColorStop(0, 'rgba(255,236,200,0.14)');
      g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.arc(n.x, n.y, range, b.a - 0.4, b.a + 0.4); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }

    drawTractor(ship, time) {
      const ctx = this.ctx;
      const ip = ship.body.toWorld(RF.SHIP_NOSE.x + 1.2, 0);
      ctx.globalCompositeOperation = 'lighter';
      for (const o of ship.tractor.targets) {
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

    drawLaser(obj, scale) {
      const L = obj.laser;
      if (!L || !L.on) return;
      const ctx = this.ctx, b = obj.body;
      const p0 = b.toWorld(RF.SHIP_NOSE.x * scale - 0.8, 0);
      const d = b.dirWorld(1, 0);
      const p1 = { x: p0.x + d.x * (L.len + 0.8), y: p0.y + d.y * (L.len + 0.8) };
      ctx.globalCompositeOperation = 'lighter';
      const flick = 0.75 + Math.random() * 0.25;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(255,120,40,${0.35 * flick})`;
      ctx.lineWidth = 1.6 * scale;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,230,180,${0.9 * flick})`;
      ctx.lineWidth = 0.45 * scale;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      if (L.hit) {
        const r = 3 + Math.random() * 1.5;
        const g = ctx.createRadialGradient(L.hit.x, L.hit.y, 0, L.hit.x, L.hit.y, r);
        g.addColorStop(0, 'rgba(255,255,230,1)');
        g.addColorStop(0.3, 'rgba(255,170,60,0.7)');
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(L.hit.x, L.hit.y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.lineCap = 'butt';
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
