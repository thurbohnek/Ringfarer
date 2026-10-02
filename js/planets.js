// Planeter: hver planet har en romhavn man kan lande på. I rommet ligger en
// nedstigningskorridor (ring med innflygingslys) i retningen der planeten
// står på himmelen. Flyr man sakte inn i ringen og trykker T, går skipet ned
// gjennom atmosfæren (planeten vokser, plasma rundt skipet, skyer, så havna).
// Å ta av igjen koster drivstoff etter hvor sterk tyngdekraften er.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const P = (RF.Planets = {});

  P.COLOR = '#b9a3ff';

  // Drivstoff for å komme opp i bane igjen. Sterkere tyngdekraft koster mer.
  P.takeoffFuel = (ship, port) => ship.stats.fuelCap * (0.04 + 0.1 * port.g);
  P.takeoffPct = (ship, port) => Math.ceil((P.takeoffFuel(ship, port) / (ship.stats.fuelCap || 1)) * 100);

  P.start = (L, game) => {
    L.seed = Math.random() * 1000;
    RF.Audio.reentry(L.dur, L.dir === 'up');
  };

  // --- Planetbildet (laget én gang per planet) ---
  const texCache = {};
  function rng(seed) { let x = seed; return () => ((x = (x * 16807) % 2147483647) / 2147483647); }
  P.texture = (port, pl) => {
    if (texCache[port.id]) return texCache[port.id];
    const N = 512, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d'), r = rng(port.id.length * 977 + 13);
    x.fillStyle = pl.color; x.fillRect(0, 0, N, N);
    if (pl.type === 'gas') {
      // Bånd med virvler.
      for (let i = 0; i < 26; i++) {
        const y = r() * N, hgt = 6 + r() * 40;
        x.fillStyle = r() < 0.5 ? pl.band : 'rgba(80,50,25,0.5)';
        x.globalAlpha = 0.25 + r() * 0.4;
        x.fillRect(0, y, N, hgt);
      }
      for (let i = 0; i < 40; i++) {
        x.globalAlpha = 0.25; x.fillStyle = pl.atmo;
        x.beginPath(); x.ellipse(r() * N, r() * N, 8 + r() * 30, 3 + r() * 8, 0, 0, Math.PI * 2); x.fill();
      }
    } else if (pl.type === 'lava') {
      // Mørk skorpe med glødende sprekker og lavasjøer.
      for (let i = 0; i < 70; i++) {
        x.globalAlpha = 0.5; x.fillStyle = r() < 0.5 ? '#2a1610' : '#4a2618';
        x.beginPath(); x.arc(r() * N, r() * N, 10 + r() * 50, 0, Math.PI * 2); x.fill();
      }
      x.globalAlpha = 0.9; x.strokeStyle = pl.band; x.lineWidth = 2;
      for (let i = 0; i < 40; i++) {
        let px = r() * N, py = r() * N;
        x.beginPath(); x.moveTo(px, py);
        for (let j = 0; j < 6; j++) { px += (r() - 0.5) * 50; py += (r() - 0.5) * 50; x.lineTo(px, py); }
        x.stroke();
      }
      for (let i = 0; i < 12; i++) {
        x.globalAlpha = 0.8; x.fillStyle = '#ff8a3a';
        x.beginPath(); x.arc(r() * N, r() * N, 4 + r() * 16, 0, Math.PI * 2); x.fill();
      }
    } else {
      // Hav med øyer og skyer.
      for (let i = 0; i < 26; i++) {
        x.globalAlpha = 0.95; x.fillStyle = r() < 0.6 ? '#5c7d48' : '#8a7f55';
        const cx = r() * N, cy = r() * N;
        x.beginPath();
        for (let j = 0; j < 9; j++) { const a = (j / 9) * Math.PI * 2, rr = 8 + r() * 34; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        x.fill();
      }
      for (let i = 0; i < 60; i++) {
        x.globalAlpha = 0.35 + r() * 0.3; x.fillStyle = '#f4f8ff';
        x.beginPath(); x.ellipse(r() * N, r() * N, 10 + r() * 40, 4 + r() * 12, r() * 3, 0, Math.PI * 2); x.fill();
      }
    }
    x.globalAlpha = 1;
    texCache[port.id] = c;
    return c;
  };

  // Et lite bilde av planeten (til fanen i havna).
  P.portrait = (port, pl, size = 180) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d'), R = size * 0.42, m = size / 2;
    x.save();
    x.beginPath(); x.arc(m, m, R, 0, Math.PI * 2); x.clip();
    x.drawImage(P.texture(port, pl), m - R, m - R, R * 2, R * 2);
    const g = x.createRadialGradient(m - R * 0.4, m - R * 0.4, R * 0.2, m, m, R);
    g.addColorStop(0, 'rgba(255,255,255,0.08)'); g.addColorStop(0.7, 'rgba(0,0,0,0.1)'); g.addColorStop(1, 'rgba(0,0,0,0.75)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    x.restore();
    x.strokeStyle = pl.atmo; x.globalAlpha = 0.6; x.lineWidth = 3;
    x.beginPath(); x.arc(m, m, R + 1, 0, Math.PI * 2); x.stroke();
    return c.toDataURL();
  };

  // --- Korridoren i rommet ---
  P.drawWorld = (ctx, game, px) => {
    const pt = game.sys.port;
    if (!pt) return;
    const t = game.time, pl = game.sys.def.planet;
    const ca = Math.cos(pt.a), sa = Math.sin(pt.a);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Innflygingslys som løper mot planeten.
    for (let i = 0; i < 7; i++) {
      const d = pt.R + 40 + i * 55;
      const on = ((t * 2.2 - i * 0.35) % 2.45 + 2.45) % 2.45 < 0.35;
      for (const s of [-1, 1]) {
        const x = pt.x + ca * d - sa * s * 26, y = pt.y + sa * d + ca * s * 26;
        ctx.fillStyle = on ? 'rgba(220,200,255,0.95)' : 'rgba(150,120,230,0.35)';
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, px * (on ? 3 : 2)), 0, Math.PI * 2); ctx.fill();
      }
    }
    // Ringen, stiplet og sakte roterende.
    ctx.strokeStyle = 'rgba(185,163,255,0.55)';
    ctx.lineWidth = Math.max(0.6, px * 2);
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -t * 6;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    const g = ctx.createRadialGradient(pt.x, pt.y, pt.R * 0.2, pt.x, pt.y, pt.R);
    g.addColorStop(0, 'rgba(185,163,255,0)'); g.addColorStop(1, 'rgba(185,163,255,0.12)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.R, 0, Math.PI * 2); ctx.fill();
    // Piler mot planeten.
    ctx.strokeStyle = 'rgba(220,205,255,0.7)';
    ctx.lineWidth = Math.max(0.6, px * 2.2);
    for (let i = 0; i < 3; i++) {
      const f = ((t * 0.6 + i / 3) % 1), d = -pt.R * 0.6 + f * pt.R * 1.2;
      ctx.globalAlpha = Math.sin(f * Math.PI);
      const cx = pt.x + ca * d, cy = pt.y + sa * d, k = 14;
      ctx.beginPath();
      ctx.moveTo(cx - ca * k - sa * k, cy - sa * k + ca * k);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx - ca * k + sa * k, cy - sa * k - ca * k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Navnet under ringen (samme størrelse på skjermen uansett zoom).
    ctx.save();
    ctx.translate(pt.x, pt.y + pt.R + 16 * px);
    ctx.scale(px, px);
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(205,190,255,0.9)';
    ctx.fillText(`DESCENT TO ${pt.world.toUpperCase()}`, 0, 0);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(205,190,255,0.6)';
    ctx.fillText(`${pt.name} · ${pt.g} g`, 0, 15);
    ctx.restore();
    void pl;
  };

  // --- Turen gjennom atmosfæren (tegnes over alt, i skjermkoordinater) ---
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const bump = (d, a, b) => (d <= a || d >= b ? 0 : Math.sin(((d - a) / (b - a)) * Math.PI));

  P.drawOverlay = (R, game) => {
    const L = game.landing;
    if (!L) return;
    const ctx = R.ctx, w = R.w, h = R.h;
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const k = G.clamp(L.t / L.dur, 0, 1);
    const down = L.dir === 'down';
    // d: 0 = i bane, 1 = på bakken.
    const d = down ? ease(G.clamp((L.t - 0.6) / (L.dur - 1.2), 0, 1)) : 1 - ease(G.clamp((L.t - 0.2) / (L.dur - 1.2), 0, 1));
    const alpha = down ? G.clamp((L.t - 0.15) / 0.8, 0, 1) : 1 - G.clamp((k - 0.78) / 0.22, 0, 1);
    if (alpha <= 0) return;
    const pt = L.port, pl = game.sys.def.planet;
    const m = Math.min(w, h), cx = w / 2, cy = h / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, w, h);
    // Planeten vokser til den fyller skjermen.
    const Rp = m * 0.42 * Math.exp(d * 6.5);
    const tex = P.texture(pt, pl);
    const shake = bump(d, 0.2, 0.75) * 4;
    const sx = cx + G.rand(-shake, shake), sy = cy + G.rand(-shake, shake);
    ctx.save();
    ctx.beginPath(); ctx.arc(sx, sy, Rp, 0, Math.PI * 2); ctx.clip();
    // Teksturen gjentas når den er forstørret mye, så den ikke blir grøtete.
    const T = Rp * 2;
    ctx.drawImage(tex, sx - T / 2, sy - T / 2, T, T);
    // Lys og skygge.
    const sh = ctx.createRadialGradient(sx - Rp * 0.35, sy - Rp * 0.35, Rp * 0.1, sx, sy, Rp);
    sh.addColorStop(0, 'rgba(255,255,255,0.06)'); sh.addColorStop(0.75, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,0,0,0.7)');
    ctx.fillStyle = sh; ctx.fillRect(sx - Rp, sy - Rp, Rp * 2, Rp * 2);
    ctx.restore();
    // Atmosfæren: tynn rand først, så farges hele skjermen.
    ctx.strokeStyle = pl.atmo; ctx.globalAlpha = alpha * 0.5; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(sx, sy, Rp + 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = alpha * G.clamp((d - 0.3) * 1.2, 0, 0.38);
    ctx.fillStyle = pl.atmo; ctx.fillRect(0, 0, w, h);
    // Skylag som suser forbi.
    const cl = bump(d, 0.55, 0.95);
    if (cl > 0) {
      const r = rng(Math.floor(L.seed) + 7);
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, off = r();
        const f = ((d - 0.55) * 2.5 + off) % 1;
        const rr = f * m * 1.4, size = 30 + f * m * 0.8;
        ctx.globalAlpha = alpha * cl * (1 - f) * 0.8;
        ctx.fillStyle = pl.type === 'lava' ? '#5a3a30' : '#eef3f8';
        ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, size, size * 0.55, a, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Bakken og havna: landingsplass med lys som vokser fram.
    const gr = G.clamp((d - 0.78) / 0.22, 0, 1);
    if (gr > 0) {
      ctx.globalAlpha = alpha * gr;
      ctx.fillStyle = pl.type === 'gas' ? '#c9b48a' : pl.type === 'lava' ? '#2a1a14' : '#36503a';
      ctx.fillRect(0, 0, w, h);
      const pr = m * (0.18 + 0.32 * gr);
      ctx.fillStyle = '#5a5e64';
      ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#e3a03a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, pr * 0.8, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.fillStyle = (i + Math.floor(game.time * 6)) % 4 ? '#ffd9a0' : '#8fd8ff';
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * pr * 0.92, cy + Math.sin(a) * pr * 0.92, 3, 0, Math.PI * 2); ctx.fill();
      }
      // Byen rundt: lysprikker.
      const r = rng(31);
      for (let i = 0; i < 160; i++) {
        const a = r() * Math.PI * 2, rr = pr * 1.1 + r() * m * 0.7;
        ctx.fillStyle = r() < 0.7 ? 'rgba(255,217,160,0.8)' : 'rgba(159,216,255,0.8)';
        ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2, 2);
      }
    }
    // Plasma rundt skipet ved innkomsten.
    const pz = bump(d, 0.22, 0.72);
    const sR = 22;
    if (pz > 0) {
      const r = rng(Math.floor(L.seed));
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2, off = r();
        const f = ((L.t * (down ? 1.6 : -1.6) + off) % 1 + 1) % 1;
        const r0 = sR + f * m * 0.6, r1 = r0 + 20 + f * 60;
        ctx.globalAlpha = alpha * pz * (1 - f) * 0.7;
        ctx.strokeStyle = r() < 0.6 ? '#ff8a3a' : '#ffd090';
        ctx.lineWidth = 1.5 + r() * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
      }
      const gl = ctx.createRadialGradient(cx, cy, sR * 0.5, cx, cy, sR * 3.2);
      gl.addColorStop(0, `rgba(255,220,170,${0.85 * pz})`); gl.addColorStop(0.35, `rgba(255,120,40,${0.75 * pz})`); gl.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(cx, cy, sR * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    // Skipet sett ovenfra, midt på skjermen.
    ctx.globalAlpha = alpha * (1 - gr * 0.0);
    drawShipIcon(ctx, cx, cy, sR, d);
    // Tekst.
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(230,223,205,0.9)';
    const title = down ? (d > 0.97 ? `LANDING AT ${pt.name.toUpperCase()}` : `DESCENDING TO ${pt.world.toUpperCase()}`) : `CLIMBING TO ORBIT ABOVE ${pt.world.toUpperCase()}`;
    ctx.fillText(title, cx, 40);
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(230,223,205,0.7)';
    const alt = Math.round((1 - d) * 140);
    const spd = (bump(d, 0, 1) * 7.6).toFixed(1);
    ctx.fillText(`ALTITUDE ${alt} km · ${spd} km/s · ${pt.g} g`, cx, 60);
    ctx.restore();
  };

  // Enkel silhuett av skipet: mørk form med lys i kanten.
  function drawShipIcon(ctx, cx, cy, r, d) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = '#1b1c1f';
    ctx.strokeStyle = d > 0.25 && d < 0.75 ? '#ffd2a0' : '#9aa0a8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, r * 0.6); ctx.lineTo(-r * 0.45, 0); ctx.lineTo(-r * 0.7, -r * 0.6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffb060';
    ctx.beginPath(); ctx.arc(-r * 0.5, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
})();
