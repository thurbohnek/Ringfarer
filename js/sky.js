// Himmelen bak spillet: stjernehimmel med et svakt melkeveibånd, en sol med
// blending, og en planet som er lyssatt fra sola (dag- og nattside,
// atmosfære, skyer eller bånd, og ringer med planetens skygge på).
// Bildene lages én gang per system og gjenbrukes.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const fbm = RF.Vox.fbm;

  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sstep = (a, b, x) => { const t = G.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // --- Stjernehimmel ---
  function makeSky(w, h, sky, seed) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.fillStyle = '#010204';
    x.fillRect(0, 0, w, h);
    // Melkeveien: et bredt, svakt bånd med støvstriper, laget i lav oppløsning.
    const q = 4, lw = Math.ceil(w / q), lh = Math.ceil(h / q);
    const low = document.createElement('canvas');
    low.width = lw; low.height = lh;
    const lx = low.getContext('2d');
    const id = lx.createImageData(lw, lh), d = id.data;
    const ang = seed * 0.7 + 0.5, ca = Math.cos(ang), sa = Math.sin(ang);
    const tint = hex(sky.neb[0]), tint2 = hex(sky.neb[1] || sky.neb[0]);
    for (let j = 0; j < lh; j++) {
      for (let i = 0; i < lw; i++) {
        const u = (i - lw / 2) / lw, v = (j - lh / 2) / lh;
        const across = u * sa - v * ca, along = u * ca + v * sa;
        const band = Math.exp(-(across * across) / 0.018);
        const n = fbm(along * 5 + seed, across * 5, 91 + seed, 4);
        const dust = sstep(0.45, 0.7, fbm(along * 9, across * 14 + seed, 17 + seed, 4));
        let k = band * (0.35 + 0.9 * n) * (1 - 0.75 * dust);
        k += 0.05 * fbm(u * 3, v * 3, 5 + seed, 3);
        const col = mix([200, 205, 220], mix(tint, tint2, n), 0.55);
        const o = (j * lw + i) * 4;
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2];
        d[o + 3] = G.clamp(k * 70, 0, 255);
      }
    }
    lx.putImageData(id, 0, 0);
    x.imageSmoothingEnabled = true;
    x.drawImage(low, 0, 0, w, h);
    // Stjerner: mange svake, tettere i båndet, noen få klare med glød.
    let s = seed * 7919 + 13;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const n = Math.round((w * h) / 900);
    for (let i = 0; i < n; i++) {
      const px = rnd() * w, py = rnd() * h;
      const u = px / w - 0.5, v = py / h - 0.5;
      const across = u * sa - v * ca;
      const inBand = Math.exp(-(across * across) / 0.02);
      if (rnd() > 0.35 + 0.65 * inBand) continue;
      const t = rnd();
      const col = t < 0.08 ? '255,210,170' : t < 0.18 ? '190,215,255' : t < 0.22 ? '255,190,150' : '255,255,255';
      const b = Math.pow(rnd(), 3);
      x.fillStyle = `rgba(${col},${0.25 + b * 0.75})`;
      const r = 0.5 + b * 1.2;
      x.fillRect(px, py, r, r);
      if (b > 0.94) {
        const g = x.createRadialGradient(px, py, 0, px, py, 3.5);
        g.addColorStop(0, `rgba(${col},0.35)`);
        g.addColorStop(1, `rgba(${col},0)`);
        x.fillStyle = g;
        x.beginPath(); x.arc(px, py, 3.5, 0, Math.PI * 2); x.fill();
      }
    }
    return c;
  }

  // --- Planet ---
  // type: 'ocean' (jordlik), 'gas' (gasskjempe med bånd), 'lava' (glødende).
  function makePlanet(pl, sunDir, seed) {
    const R = pl.ring ? 230 : 300;
    const ringOut = pl.ring ? 2.05 : 1.08;
    const W = Math.ceil(R * ringOut * 2) + 8, H = pl.ring ? Math.ceil(R * 2.3) : W;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data;
    const cx = W / 2, cy = H / 2;
    let L = [Math.cos(sunDir), Math.sin(sunDir), 0.45];
    const ll = Math.hypot(...L); L = L.map((v) => v / ll);
    const base = hex(pl.color), band = hex(pl.band);
    const atm = hex(pl.atmo || '#8fb8ff');
    const tilt = -0.35, incl = 0.26, ct = Math.cos(tilt), st = Math.sin(tilt);
    const ringCol = hex(pl.ringColor || pl.band);
    const put = (o, col, a) => {
      const ia = d[o + 3] / 255, na = a + ia * (1 - a);
      if (na <= 0) return;
      for (let k = 0; k < 3; k++) d[o + k] = (col[k] * a + d[o + k] * ia * (1 - a)) / na;
      d[o + 3] = na * 255;
    };
    const ringAt = (px, py, front) => {
      if (!pl.ring) return;
      const u = px * ct + py * st, v = -px * st + py * ct;
      const rho = Math.hypot(u, v / incl);
      if (rho < R * 1.28 || rho > R * 2.0) return null;
      const z = (v / incl) * Math.sqrt(1 - incl * incl);
      if ((z > 0) !== front) return null;
      const f = (rho - R * 1.28) / (R * 0.72);
      let dens = 0.55 + 0.45 * Math.sin(f * 40 + fbm(f * 20, 1, seed, 2) * 6);
      if (f > 0.55 && f < 0.6) dens *= 0.15; // Cassini-gap
      dens *= sstep(0, 0.05, f) * sstep(1, 0.9, f);
      // Planetens skygge på ringen.
      const P = [u, (v / incl) * incl, z];
      const Pw = [P[0] * ct - P[1] * st, P[0] * st + P[1] * ct, P[2]];
      const t = -(Pw[0] * L[0] + Pw[1] * L[1] + Pw[2] * L[2]);
      const d2 = Pw[0] * Pw[0] + Pw[1] * Pw[1] + Pw[2] * Pw[2] - t * t;
      const shade = t > 0 && d2 < R * R ? 0.12 : 1;
      return [mix(ringCol, [240, 230, 210], 0.3 * f).map((v) => v * shade), dens * 0.8];
    };
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const px = i - cx, py = j - cy, o = (j * W + i) * 4;
        const r2 = px * px + py * py;
        const back = ringAt(px, py, false);
        if (back) put(o, back[0], back[1]);
        if (r2 < R * R) {
          const nx = px / R, ny = py / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
          const lat = Math.asin(G.clamp(ny, -1, 1)), lon = Math.atan2(nx, nz);
          let col;
          if (pl.type === 'gas') {
            const turb = fbm(lon * 3, lat * 9, seed, 4);
            const b = Math.sin(lat * 14 + turb * 3.2) * 0.5 + 0.5;
            col = mix(base, band, b);
            col = mix(col, [245, 235, 215], sstep(0.62, 0.9, fbm(lon * 6, lat * 20, seed + 3, 3)) * 0.35);
          } else if (pl.type === 'lava') {
            const hgt = fbm(lon * 2.2, lat * 2.2, seed, 5);
            const crack = 1 - Math.abs(fbm(lon * 5, lat * 5, seed + 9, 4) - 0.5) * 2;
            col = mix([28, 20, 18], base, hgt);
            col = mix(col, [255, 120, 40], sstep(0.82, 0.97, crack) * 0.9);
          } else {
            const hgt = fbm(lon * 1.8 + seed, lat * 1.8, seed, 5);
            const land = sstep(0.5, 0.53, hgt);
            const ocean = mix([10, 30, 70], [30, 80, 140], sstep(0.3, 0.5, hgt));
            const ground = mix([70, 95, 45], [150, 125, 80], sstep(0.55, 0.72, hgt));
            col = mix(ocean, ground, land);
            col = mix(col, [235, 240, 245], sstep(1.15, 1.3, Math.abs(lat)));
            const cloud = sstep(0.55, 0.75, fbm(lon * 3 + 5, lat * 4, seed + 21, 5));
            col = mix(col, [245, 248, 250], cloud * 0.85);
          }
          const lit = nx * L[0] + ny * L[1] + nz * L[2];
          const day = sstep(-0.12, 0.35, lit);
          let k = 0.02 + day * (0.35 + 0.65 * Math.max(0, lit));
          col = col.map((v) => v * k);
          // Atmosfære: lysere mot kanten på dagsiden.
          const rim = Math.pow(1 - nz, 2.5) * sstep(-0.3, 0.3, lit);
          col = mix(col, atm, rim * (pl.type === 'lava' ? 0.3 : 0.75));
          put(o, col, 1);
        } else if (r2 < (R * 1.06) * (R * 1.06) && pl.type !== 'lava') {
          // Tynn dis utenfor kanten, bare på siden mot sola.
          const rr = Math.sqrt(r2), f = 1 - (rr - R) / (R * 0.06);
          const lit = (px * L[0] + py * L[1]) / rr;
          const a = Math.pow(f, 2) * sstep(-0.2, 0.6, lit) * 0.8;
          if (a > 0.01) put(o, atm, a);
        }
        const front = ringAt(px, py, true);
        if (front) put(o, front[0], front[1]);
      }
    }
    x.putImageData(img, 0, 0);
    return { cv: c, R, W, H };
  }

  const P = RF.Renderer.prototype;
  const cache = {};

  P.drawBackground = function (game) {
    const { ctx, w, h, dpr } = this;
    const cam = game.cam, def = game.sys.def, sky = def.sky;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const seed = def.id.length * 3 + def.id.charCodeAt(0) % 7;
    // Himmelen er litt større enn skjermen og flytter seg nesten ikke (den er langt unna).
    const key = def.id + ':' + w + 'x' + h;
    let S = cache[key];
    if (!S) {
      for (const k in cache) if (k.startsWith(def.id + ':')) delete cache[k];
      S = cache[key] = { sky: makeSky(Math.ceil(w + 160), Math.ceil(h + 160), sky, seed) };
    }
    const sx0 = -80 + G.clamp(-cam.x * 0.01, -70, 70), sy0 = -80 + G.clamp(-cam.y * 0.01, -70, 70);
    ctx.drawImage(S.sky, sx0, sy0);

    // Sola: liten, hvit kjerne og stor, svak blending.
    const sd = sky.starDir, D = Math.max(w, h);
    const sx = w / 2 + Math.cos(sd) * D * 0.55, sy = h / 2 + Math.sin(sd) * D * 0.55;
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, D * 0.7);
    halo.addColorStop(0, sky.star + '55');
    halo.addColorStop(0.06, sky.star + '22');
    halo.addColorStop(0.3, sky.star + '08');
    halo.addColorStop(1, sky.star + '00');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, 34);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.25, 'rgba(255,250,235,0.9)');
    core.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(sx, sy, 34, 0, Math.PI * 2); ctx.fill();
    // Svak vannrett lysstripe fra optikken.
    const streak = ctx.createLinearGradient(sx - D * 0.4, sy, sx + D * 0.4, sy);
    streak.addColorStop(0, 'rgba(180,200,255,0)');
    streak.addColorStop(0.5, 'rgba(200,215,255,0.18)');
    streak.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(sx - D * 0.4, sy - 1.5, D * 0.8, 3);
    ctx.globalCompositeOperation = 'source-over';

    // Planeten ligger også langt unna og flytter seg bare litt.
    const pl = def.planet;
    if (!S.planet) S.planet = makePlanet(pl, sd, seed);
    const Pn = S.planet;
    const pr = Math.min(w, h) * pl.r;
    const k = pr / Pn.R;
    const px = pl.x * w - G.clamp(cam.x * 0.004, -30, 30), py = pl.y * h - G.clamp(cam.y * 0.004, -30, 30);
    ctx.drawImage(Pn.cv, px - (Pn.W / 2) * k, py - (Pn.H / 2) * k, Pn.W * k, Pn.H * k);

    // Stjerner i nærmere lag gir følelse av fart når man flyr.
    for (const Lr of this.layers) {
      const ox = -cam.x * Lr.par, oy = -cam.y * Lr.par;
      for (const s of Lr.stars) {
        let x = (s.x + ox) % 2048, y = (s.y + oy) % 2048;
        if (x < 0) x += 2048;
        if (y < 0) y += 2048;
        for (let tx = x; tx < w; tx += 2048) {
          for (let ty = y; ty < h; ty += 2048) {
            ctx.globalAlpha = s.a * 0.6;
            ctx.fillStyle = s.c;
            ctx.fillRect(tx, ty, s.r * 0.8, s.r * 0.8);
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  };
})();
