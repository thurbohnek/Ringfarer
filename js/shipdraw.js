// Tegning av moduler og modulære skip (spiller, arbeidsskip, vrak og i
// skipsbyggeren). Hver modul tegnes i en rute på CELL meter med +x forover.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;
  const CELL = RF.CELL;
  const h = CELL / 2;

  const C = {
    hi: '#d3d5d6', light: '#b4b8bb', mid: '#83888d', dark: '#44484c', darker: '#26292c', black: '#131516',
    yellow: '#e2b43a', red: '#b8352a', glass: ['#9ed6e8', '#2c6b86', '#0b2430'],
  };

  function bolts(ctx, r = 0.85) {
    ctx.fillStyle = 'rgba(20,22,24,0.7)';
    for (const [x, y] of [[-r, -r], [r, -r], [r, r], [-r, r]]) {
      ctx.beginPath(); ctx.arc(x, y, 0.09, 0, Math.PI * 2); ctx.fill();
    }
  }

  function hazard(ctx, x, y, w, hh) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = C.black;
    for (let i = -4; i < 8; i++) {
      const sx = x + i * 0.36;
      ctx.beginPath(); ctx.moveTo(sx, y + hh); ctx.lineTo(sx + 0.18, y + hh); ctx.lineTo(sx + 0.18 + hh, y); ctx.lineTo(sx + hh, y); ctx.fill();
    }
    ctx.restore();
  }

  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.08; ctx.stroke(); }
  }

  // ---------- Skroget i flukt ----------
  // I flukt tegnes ikke klossene. Rutene slås sammen til én skrogform med
  // avfasede hjørner, stålplater og detaljer der modulene sitter, og
  // verktøyene sitter som tårn i festepunktene på kanten.

  // Omrisset av alle rutene som lukkede løkker (i lokale meter).
  function hullLoops(L) {
    if (!L.length) return [];
    const ox = L[0].lx - L[0].x * CELL, oy = L[0].ly - L[0].y * CELL;
    const occ = new Set(L.map((m) => m.x + ',' + m.y));
    const edges = new Map();
    const add = (x1, y1, x2, y2) => edges.set(x1 + ',' + y1, [x2, y2]);
    for (const m of L) {
      const x = m.x, y = m.y;
      // Kanter i fast omløpsretning, bare der naboen mangler.
      if (!occ.has(x + ',' + (y - 1))) add(x - 0.5, y - 0.5, x + 0.5, y - 0.5);
      if (!occ.has(x + 1 + ',' + y)) add(x + 0.5, y - 0.5, x + 0.5, y + 0.5);
      if (!occ.has(x + ',' + (y + 1))) add(x + 0.5, y + 0.5, x - 0.5, y + 0.5);
      if (!occ.has(x - 1 + ',' + y)) add(x - 0.5, y + 0.5, x - 0.5, y - 0.5);
    }
    const loops = [];
    while (edges.size) {
      const [startKey] = edges.keys();
      let [cx, cy] = startKey.split(',').map(Number);
      const pts = [];
      let guard = 0;
      while (guard++ < 4000) {
        const k = cx + ',' + cy;
        const nx = edges.get(k);
        if (!nx) break;
        edges.delete(k);
        pts.push([cx, cy]);
        [cx, cy] = nx;
      }
      // Fjern punkter midt på rette strekk.
      const simp = pts.filter((p, i) => {
        const a = pts[(i - 1 + pts.length) % pts.length], c = pts[(i + 1) % pts.length];
        return (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]) !== 0;
      });
      // Avfas hjørnene: utoverbøyde hjørner kuttes mer enn innoverbøyde.
      const out = [];
      for (let i = 0; i < simp.length; i++) {
        const a = simp[(i - 1 + simp.length) % simp.length], p = simp[i], c = simp[(i + 1) % simp.length];
        const cross = (p[0] - a[0]) * (c[1] - p[1]) - (p[1] - a[1]) * (c[0] - p[0]);
        const k = cross > 0 ? 0.32 : 0.12;
        const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lc = Math.hypot(c[0] - p[0], c[1] - p[1]);
        const ka = Math.min(k, la / 2) / la, kc = Math.min(k, lc / 2) / lc;
        out.push([p[0] + (a[0] - p[0]) * ka, p[1] + (a[1] - p[1]) * ka]);
        out.push([p[0] + (c[0] - p[0]) * kc, p[1] + (c[1] - p[1]) * kc]);
      }
      loops.push(out.map(([x, y]) => ({ x: x * CELL + ox, y: y * CELL + oy })));
    }
    return loops;
  }

  function hullOf(obj) {
    const L = obj.layout;
    const key = L.map((m) => m.t[0] + m.x + ',' + m.y + ':' + (m.lx || 0).toFixed(2)).join('|');
    if (obj._hullKey !== key) { obj._hullKey = key; obj._hull = hullLoops(L); }
    return obj._hull;
  }

  function tracePath(ctx, loops, dx = 0, dy = 0) {
    ctx.beginPath();
    for (const lp of loops) {
      lp.forEach((p, i) => (i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)));
      ctx.closePath();
    }
  }

  // ---------- Utseende: tunge moduler med avfasede plater ----------
  // Hver modul er en lys stålblokk med avrundede ytterhjørner, skråkant, rister,
  // bolter og små merkelapper. Mellom blokkene synes den mørke rammen under.
  // Verktøyene sitter i festeringer på kanten og er store nok til å kjennes igjen.

  function rr(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, hh, r);
    else ctx.rect(x, y, w, hh);
  }

  // Åttekant med ulike avfasinger i hjørnene (tl, tr, br, bl).
  function octPath(ctx, x, y, w, hh, c) {
    ctx.beginPath();
    ctx.moveTo(x + c[0], y); ctx.lineTo(x + w - c[1], y); ctx.lineTo(x + w, y + c[1]);
    ctx.lineTo(x + w, y + hh - c[2]); ctx.lineTo(x + w - c[2], y + hh); ctx.lineTo(x + c[3], y + hh);
    ctx.lineTo(x, y + hh - c[3]); ctx.lineTo(x, y + c[0]); ctx.closePath();
  }

  // Skråkant: lys oppe til venstre, mørk nede til høyre (tegnes innenfor formen).
  function bevelPath(ctx, path, x, y, w, hh, k = 1, lw = 0.3) {
    const g = ctx.createLinearGradient(x, y, x + w, y + hh);
    g.addColorStop(0, `rgba(255,255,255,${0.75 * k})`);
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.6 * k})`);
    ctx.save();
    path(); ctx.clip();
    ctx.strokeStyle = g; ctx.lineWidth = lw;
    path(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(10,11,12,0.85)'; ctx.lineWidth = 0.05;
    path(); ctx.stroke();
  }
  function bevel(ctx, x, y, w, hh, r, k, lw) {
    bevelPath(ctx, () => rr(ctx, x, y, w, hh, r), x, y, w, hh, k, lw);
  }

  const TONES = {
    light: ['#dcdfe1', '#b3b8bb', '#80868a'],
    mid: ['#c2c6c9', '#979ca0', '#63686c'],
    dark: ['#8f9498', '#686d71', '#3f4346'],
  };

  // Selve blokken: en åttekant, mest avfaset der den vender ut mot rommet.
  // Mellom blokkene synes rammen i de små rutene i hjørnene.
  function block(ctx, exp, tone = 'light') {
    const g = 0.09, R = 0.8, r = 0.42;
    const c = [exp.n && exp.w ? R : r, exp.n && exp.e ? R : r, exp.s && exp.e ? R : r, exp.s && exp.w ? R : r];
    const x0 = -h + g, w = CELL - 2 * g;
    const path = () => octPath(ctx, x0, x0, w, w, c);
    // Litt skygge under blokken gir dybde.
    ctx.save(); ctx.translate(0.14, 0.14); path(); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
    const t = TONES[tone];
    const gr = ctx.createLinearGradient(-h, -h, h, h);
    gr.addColorStop(0, t[0]); gr.addColorStop(0.55, t[1]); gr.addColorStop(1, t[2]);
    path(); ctx.fillStyle = gr; ctx.fill();
    bevelPath(ctx, path, x0, x0, w, w, 1, 0.34);
  }

  // Opphøyd plate inni blokken.
  function panel(ctx, x, y, w, hh, tone = 'light', r = 0.14) {
    const c = TONES[tone];
    const gr = ctx.createLinearGradient(x, y, x + w, y + hh);
    gr.addColorStop(0, c[0]); gr.addColorStop(1, c[2]);
    rr(ctx, x, y, w, hh, r);
    ctx.fillStyle = gr;
    ctx.fill();
    bevel(ctx, x, y, w, hh, r, 0.8, 0.16);
  }

  // Rist med vannrette spalter (≡).
  function grille(ctx, x, y, w, n, gap = 0.2) {
    for (let i = 0; i < n; i++) {
      const yy = y + i * gap;
      ctx.fillStyle = '#1b1d20';
      rr(ctx, x, yy, w, gap * 0.5, 0.04); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x + 0.03, yy + gap * 0.5, w - 0.06, 0.03);
    }
  }

  function label(ctx, x, y, w = 0.34, hh = 0.2) {
    ctx.fillStyle = '#16171a';
    ctx.fillRect(x - 0.03, y - 0.03, w + 0.06, hh + 0.06);
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = '#16171a';
    ctx.fillRect(x + w * 0.3, y + hh * 0.3, w * 0.4, hh * 0.4);
  }

  function bolt(ctx, x, y, r = 0.08) {
    circle(ctx, x, y, r, '#50555a');
    circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.4, 'rgba(255,255,255,0.5)');
  }

  function dome(ctx, x, y, r = 0.22) {
    circle(ctx, x, y, r + 0.07, '#2a2c30');
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#d8ecff'); g.addColorStop(1, '#6f8fae');
    circle(ctx, x, y, r, g);
  }

  function glassGrad(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, '#9fd3ea'); g.addColorStop(0.25, '#2e6680'); g.addColorStop(0.7, '#0d2533'); g.addColorStop(1, '#04121a');
    return g;
  }

  // Detaljer for hver modultype, tegnet i ruten sentrert i (0,0), +x forover.
  const ART = {
    cockpit(ctx, exp) {
      block(ctx, exp, 'light');
      ctx.beginPath();
      ctx.moveTo(-0.55, -0.88); ctx.lineTo(0.45, -0.8);
      ctx.quadraticCurveTo(1.12, -0.55, 1.12, 0); ctx.quadraticCurveTo(1.12, 0.55, 0.45, 0.8);
      ctx.lineTo(-0.55, 0.88); ctx.quadraticCurveTo(-0.8, 0, -0.55, -0.88);
      ctx.closePath();
      ctx.fillStyle = '#26292d'; ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = glassGrad(ctx, -0.5, -0.8, 1, 0.8);
      ctx.fillRect(-1, -1, 2.3, 2);
      ctx.strokeStyle = '#2a2d31'; ctx.lineWidth = 0.1;
      for (const x of [-0.1, 0.45]) { ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x, 1); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-0.6, 0); ctx.lineTo(1.2, 0); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.07;
      ctx.beginPath(); ctx.moveTo(0.7, -0.55); ctx.quadraticCurveTo(0.95, -0.35, 1.0, -0.1); ctx.stroke();
      circle(ctx, -0.35, -0.45, 0.06, '#ffd27a'); circle(ctx, -0.35, 0.45, 0.06, '#7affc8');
      ctx.restore();
      ctx.strokeStyle = '#141619'; ctx.lineWidth = 0.08; ctx.stroke();
    },
    frame(ctx, exp) {
      block(ctx, exp, 'mid');
      panel(ctx, -0.62, -0.62, 1.24, 1.24, 'light');
      grille(ctx, -0.4, -0.34, 0.8, 4, 0.2);
      for (const [x, y] of [[-0.85, -0.85], [0.85, -0.85], [0.85, 0.85], [-0.85, 0.85]]) bolt(ctx, x, y);
    },
    armor(ctx, exp) {
      block(ctx, exp, 'light');
      ctx.beginPath();
      ctx.moveTo(-0.55, -0.8); ctx.lineTo(0.55, -0.8); ctx.lineTo(0.8, -0.55); ctx.lineTo(0.8, 0.55); ctx.lineTo(0.55, 0.8);
      ctx.lineTo(-0.55, 0.8); ctx.lineTo(-0.8, 0.55); ctx.lineTo(-0.8, -0.55); ctx.closePath();
      const g = ctx.createLinearGradient(-0.8, -0.8, 0.8, 0.8);
      g.addColorStop(0, '#e7e9ea'); g.addColorStop(1, '#8a9094');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 0.06; ctx.stroke();
      grille(ctx, -0.3, 0.2, 0.6, 2, 0.18);
      label(ctx, -0.5, -0.55);
      for (const [x, y] of [[-0.6, -0.1], [0.6, -0.1]]) bolt(ctx, x, y);
    },
    armor2(ctx, exp) {
      block(ctx, exp, 'mid');
      panel(ctx, -0.85, -0.85, 1.7, 0.75, 'light');
      panel(ctx, -0.85, 0.1, 1.7, 0.75, 'light');
      grille(ctx, -0.5, -0.65, 1, 2, 0.2);
      hazard(ctx, -0.6, 0.35, 1.2, 0.22);
      for (const [x, y] of [[-0.95, -0.95], [0.95, -0.95], [0.95, 0.95], [-0.95, 0.95]]) bolt(ctx, x, y);
    },
    shield(ctx, exp) {
      block(ctx, exp, 'mid');
      circle(ctx, 0, 0, 0.88, '#2b2e32');
      circle(ctx, 0, 0, 0.8, '#7d848a');
      const g = ctx.createRadialGradient(-0.25, -0.25, 0.05, 0, 0, 0.66);
      g.addColorStop(0, '#f0fbff'); g.addColorStop(0.45, '#56b6e6'); g.addColorStop(1, '#0c2c42');
      circle(ctx, 0, 0, 0.64, g, '#10151a');
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; bolt(ctx, Math.cos(a) * 0.73, Math.sin(a) * 0.73, 0.05); }
    },
    thruster(ctx, exp) {
      block(ctx, exp, 'mid');
      panel(ctx, -0.9, -0.75, 0.9, 1.5, 'dark');
      grille(ctx, -0.8, -0.6, 0.7, 6, 0.2);
      panel(ctx, 0.15, -0.6, 0.75, 1.2, 'light');
      label(ctx, 0.35, -0.12);
    },
    thruster2(ctx, exp) {
      block(ctx, exp, 'dark');
      panel(ctx, -0.95, -0.95, 1.1, 1.9, 'mid');
      grille(ctx, -0.85, -0.8, 0.9, 8, 0.2);
      hazard(ctx, 0.35, -0.9, 0.35, 1.8);
    },
    rcs(ctx, exp) {
      block(ctx, exp, 'light');
      for (const [x, y] of [[-0.78, -0.78], [0.78, -0.78], [0.78, 0.78], [-0.78, 0.78]]) {
        circle(ctx, x, y, 0.26, '#2a2d31');
        circle(ctx, x, y, 0.14, '#0d0e10');
      }
      circle(ctx, 0, 0, 0.5, '#3a3d41');
      circle(ctx, 0, 0, 0.4, C.yellow);
      circle(ctx, 0, 0, 0.18, '#1a1b1e');
    },
    fuel(ctx, exp) {
      block(ctx, exp, 'mid');
      for (const y of [-0.5, 0.5]) {
        const g = ctx.createRadialGradient(-0.25, y - 0.18, 0.05, 0, y, 0.5);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cfd3d6'); g.addColorStop(1, '#7c8286');
        rr(ctx, -0.95, y - 0.44, 1.9, 0.88, 0.44);
        ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = '#1c1e21'; ctx.lineWidth = 0.06; ctx.stroke();
        ctx.fillStyle = C.red; ctx.fillRect(0.2, y - 0.42, 0.18, 0.84);
      }
    },
    cargo(ctx, exp) {
      block(ctx, exp, 'light');
      panel(ctx, -0.82, -0.82, 1.64, 1.64, 'mid');
      ctx.strokeStyle = 'rgba(20,22,24,0.55)'; ctx.lineWidth = 0.09;
      for (let x = -0.55; x <= 0.56; x += 0.275) { ctx.beginPath(); ctx.moveTo(x, -0.7); ctx.lineTo(x, 0.7); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.04;
      for (let x = -0.5; x <= 0.61; x += 0.275) { ctx.beginPath(); ctx.moveTo(x, -0.7); ctx.lineTo(x, 0.7); ctx.stroke(); }
      label(ctx, 0.4, 0.5);
    },
    cargo2(ctx, exp) {
      block(ctx, exp, 'mid');
      panel(ctx, -0.9, -0.62, 1.8, 1.24, 'light');
      ctx.fillStyle = 'rgba(20,22,24,0.45)';
      for (let x = -0.75; x <= 0.7; x += 0.3) ctx.fillRect(x, -0.5, 0.12, 1);
      hazard(ctx, -0.9, -0.95, 1.8, 0.22);
      hazard(ctx, -0.9, 0.73, 1.8, 0.22);
    },
    refinery(ctx, exp) {
      block(ctx, exp, 'mid');
      panel(ctx, -0.85, -0.85, 1.7, 1.7, 'dark');
      rr(ctx, -0.65, -0.55, 1.3, 1.1, 0.12);
      ctx.fillStyle = '#150d08'; ctx.fill();
      for (let i = 0; i < 4; i++) { ctx.fillStyle = '#5a2a10'; ctx.fillRect(-0.55 + i * 0.3, -0.45, 0.16, 0.9); }
      label(ctx, -0.75, 0.65);
    },
    dronebay(ctx, exp) {
      block(ctx, exp, 'light');
      rr(ctx, -0.85, -0.85, 1.7, 1.7, 0.2);
      ctx.fillStyle = '#2a2c30'; ctx.fill();
      hazard(ctx, -0.8, -0.8, 1.6, 0.2);
      hazard(ctx, -0.8, 0.6, 1.6, 0.2);
      ctx.fillStyle = '#151618'; ctx.fillRect(-0.7, -0.5, 1.4, 1.0);
      ctx.strokeStyle = '#4b4f54'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(0, -0.5); ctx.lineTo(0, 0.5); ctx.stroke();
      circle(ctx, 0, 0, 0.12, '#7affc8');
    },
    // Verktøy: blokken med en festering. Selve verktøyet tegnes for seg (dreier).
    mount(ctx, exp, m) {
      block(ctx, exp, 'mid');
      panel(ctx, -0.75, -0.75, 1.5, 1.5, 'light');
      grille(ctx, -0.45, -0.28, 0.5, 3, 0.2);
      const a = RF.DIR_ANGLE[m.dir >= 0 ? m.dir : 0];
      const px = Math.cos(a) * CELL * 0.35, py = Math.sin(a) * CELL * 0.35;
      circle(ctx, px, py, 0.72, '#1d1f22');
      circle(ctx, px, py, 0.62, '#6b7176', '#16181a');
      for (let i = 0; i < 6; i++) { const b = (i / 6) * Math.PI * 2; bolt(ctx, px + Math.cos(b) * 0.52, py + Math.sin(b) * 0.52, 0.05); }
    },
  };

  // Hvilke sider av en modul som vender ut mot rommet.
  function exposure(occ, m) {
    return {
      n: !occ.has(m.x + ',' + (m.y - 1)), s: !occ.has(m.x + ',' + (m.y + 1)),
      e: !occ.has(m.x + 1 + ',' + m.y), w: !occ.has(m.x - 1 + ',' + m.y),
    };
  }

  function moduleArt(ctx, m, exp) {
    const D = RF.MODULES[m.t];
    if (D.mount) ART.mount(ctx, exp, m);
    else (ART[m.t] || ART.frame)(ctx, exp, m);
    // Skader: sot og sprekker.
    const f = m.hp / D.hp;
    if (f < 0.6) {
      const g = ctx.createRadialGradient(0.2, 0.1, 0, 0.2, 0.1, 1.4);
      g.addColorStop(0, `rgba(12,8,4,${0.9 * (1 - f)})`);
      g.addColorStop(1, 'rgba(40,20,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-h, -h, CELL, CELL);
    }
    if (f < 0.3) {
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 0.09;
      ctx.beginPath(); ctx.moveTo(-0.9, -0.3); ctx.lineTo(-0.2, 0.1); ctx.lineTo(0.1, -0.5); ctx.lineTo(0.8, 0.4); ctx.stroke();
    }
  }

  // Motorklokker stikker ut bak skroget.
  function nozzle(ctx, m) {
    const big = m.t === 'thruster2';
    const ys = big ? [-0.55, 0.55] : [0];
    for (const y of ys) {
      const w0 = big ? 0.36 : 0.55, w1 = big ? 0.52 : 0.82, L = big ? 1.1 : 1.2;
      const x0 = m.lx - h + 0.1, x1 = m.lx - h - L;
      ctx.beginPath();
      ctx.moveTo(x0, m.ly + y - w0);
      ctx.quadraticCurveTo((x0 + x1) / 2, m.ly + y - w0 * 1.02, x1, m.ly + y - w1);
      ctx.lineTo(x1, m.ly + y + w1);
      ctx.quadraticCurveTo((x0 + x1) / 2, m.ly + y + w0 * 1.02, x0, m.ly + y + w0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, m.ly + y - w1, 0, m.ly + y + w1);
      g.addColorStop(0, '#3a3e42'); g.addColorStop(0.3, '#c8ccd0'); g.addColorStop(0.55, '#8a9095'); g.addColorStop(1, '#2a2d31');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#111314'; ctx.lineWidth = 0.07; ctx.stroke();
      ctx.fillStyle = '#6a7076';
      ctx.fillRect(x0 - 0.35, m.ly + y - w0 * 1.15, 0.14, w0 * 2.3);
      ctx.beginPath(); ctx.ellipse(x1, m.ly + y, 0.14, w1 * 0.92, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0c0e10'; ctx.fill();
    }
  }

  // Lysende kupler langs kantene (som på bildene): hvor de sitter.
  const DOMES = { frame: 2, armor: 2, armor2: 2, cargo: 1, cargo2: 2, fuel: 1, refinery: 1, shield: 1, dronebay: 1, rcs: 0, cockpit: 0 };
  function domeSpots(occ, m) {
    const n = DOMES[m.t];
    if (!n) return [];
    const exp = exposure(occ, m), out = [];
    const along = n === 2 ? [-0.5, 0.5] : [0];
    const k = h - 0.36;
    if (exp.n) for (const t of along) out.push({ x: m.lx + t, y: m.ly - k });
    if (exp.s) for (const t of along) out.push({ x: m.lx + t, y: m.ly + k });
    if (exp.e) for (const t of along) out.push({ x: m.lx + k, y: m.ly + t });
    if (exp.w) for (const t of along) out.push({ x: m.lx - k, y: m.ly + t });
    return out;
  }

  // Ferdig tegnet skip (uten tårn) i et eget lerret, laget på nytt når
  // oppsettet endrer seg eller en modul blir skadet.
  const PPM = 26;
  function artOf(obj) {
    const L = obj.layout;
    const key = L.map((m) => m.t + m.x + ',' + m.y + ':' + (m.lx || 0).toFixed(2) + ':' + (m.ly || 0).toFixed(2) + ':' + m.dir + ':' +
      (m.hp / RF.MODULES[m.t].hp < 0.3 ? 2 : m.hp / RF.MODULES[m.t].hp < 0.6 ? 1 : 0)).join('|');
    if (obj._art && obj._art.key === key) return obj._art;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of L) {
      x0 = Math.min(x0, m.lx); x1 = Math.max(x1, m.lx); y0 = Math.min(y0, m.ly); y1 = Math.max(y1, m.ly);
    }
    const pad = h + 1.6;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const ppm = Math.min(PPM, 2048 / Math.max(x1 - x0, y1 - y0));
    const cw = Math.ceil((x1 - x0) * ppm), ch = Math.ceil((y1 - y0) * ppm);
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const ctx = cv.getContext('2d');
    ctx.setTransform(ppm, 0, 0, ppm, -x0 * ppm, -y0 * ppm);
    const occ = new Set(L.map((m) => m.x + ',' + m.y));
    // Mørk ramme under blokkene (synes i fugene).
    const loops = hullLoops(L);
    tracePath(ctx, loops);
    ctx.fillStyle = '#222428';
    ctx.fill('evenodd');
    ctx.strokeStyle = '#0d0e10'; ctx.lineWidth = 0.1; ctx.stroke();
    for (const m of L) if (m.t === 'thruster' || m.t === 'thruster2') nozzle(ctx, m);
    const domes = [];
    for (const m of L) {
      ctx.save();
      ctx.translate(m.lx, m.ly);
      moduleArt(ctx, m, exposure(occ, m));
      ctx.restore();
      for (const d of domeSpots(occ, m)) { dome(ctx, d.x, d.y); domes.push(d); }
    }
    // Koblingsstykker over fugene mellom modulene.
    for (const m of L) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (!occ.has(m.x + dx + ',' + (m.y + dy))) continue;
        if ((m.x + m.y) % 2 && dy) continue;
        const cx = m.lx + dx * h, cy = m.ly + dy * h;
        ctx.save(); ctx.translate(cx, cy); if (dy) ctx.rotate(Math.PI / 2);
        rr(ctx, -0.3, -0.42, 0.6, 0.84, 0.1);
        ctx.fillStyle = '#4a4e53'; ctx.fill();
        bevel(ctx, -0.3, -0.42, 0.6, 0.84, 0.1, 1, 0.1);
        bolt(ctx, 0, -0.22, 0.06); bolt(ctx, 0, 0.22, 0.06);
        ctx.restore();
      }
    }
    // Skygge: samme form, helt mørk.
    const sh = document.createElement('canvas');
    sh.width = cw; sh.height = ch;
    const sx = sh.getContext('2d');
    sx.drawImage(cv, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = '#000';
    sx.fillRect(0, 0, cw, ch);
    obj._art = { key, cv, sh, x0, y0, w: cw / ppm, h: ch / ppm, domes };
    return obj._art;
  }

  // Verktøyene i festepunktene. Tegnes hver ramme fordi de dreier.
  function tool(ctx, m, time) {
    const D = RF.MODULES[m.t];
    if (m.dir == null || m.dir < 0) return;
    const ma = RF.DIR_ANGLE[m.dir];
    const px = m.lx + Math.cos(ma) * CELL * 0.35, py = m.ly + Math.sin(ma) * CELL * 0.35;
    const a = m.aimA != null ? m.aimA : ma;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    const housing = (r, tone = 'light') => {
      const c = TONES[tone];
      const g = ctx.createRadialGradient(-r * 0.4, -r * 0.4, 0.05, 0, 0, r);
      g.addColorStop(0, c[0]); g.addColorStop(0.6, c[1]); g.addColorStop(1, c[2]);
      circle(ctx, 0, 0, r, g, '#141619');
    };
    const tube = (y, w, len, col = '#3b3f44') => {
      const g = ctx.createLinearGradient(0, y - w / 2, 0, y + w / 2);
      g.addColorStop(0, '#1e2023'); g.addColorStop(0.35, col); g.addColorStop(0.5, '#9aa0a5'); g.addColorStop(1, '#16181b');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - w / 2, len, w);
      ctx.strokeStyle = '#0e0f11'; ctx.lineWidth = 0.05;
      ctx.strokeRect(0, y - w / 2, len, w);
    };
    if (D.laser) {
      const tier = D.laser.tier, col = ['#ff9a3c', '#ff4a3a', '#be6eff', '#78ffdc'][tier - 1];
      const w = 0.34 + tier * 0.06, len = 1.7 + tier * 0.2;
      tube(0, w, len);
      if (tier >= 2) for (let x = 0.7; x < len - 0.2; x += 0.3) { ctx.fillStyle = '#2a2d31'; ctx.fillRect(x, -w / 2 - 0.08, 0.14, w + 0.16); }
      ctx.fillStyle = '#26292d'; ctx.fillRect(len - 0.25, -w / 2 - 0.1, 0.3, w + 0.2);
      circle(ctx, len + 0.05, 0, w * 0.42, col);
      housing(0.6, 'light');
      circle(ctx, 0.1, 0, 0.22, '#2a2d31');
      circle(ctx, 0.1, 0, 0.12, col);
    } else if (D.gun) {
      tube(-0.26, 0.26, 2.3); tube(0.26, 0.26, 2.3);
      for (const y of [-0.26, 0.26]) { ctx.fillStyle = '#1c1e21'; ctx.fillRect(2.15, y - 0.19, 0.3, 0.38); }
      rr(ctx, -0.65, -0.6, 1.2, 1.2, 0.2);
      ctx.fillStyle = '#8f959a'; ctx.fill();
      bevel(ctx, -0.65, -0.6, 1.2, 1.2, 0.2, 1, 0.16);
      hazard(ctx, -0.5, -0.1, 0.8, 0.2);
    } else if (D.ammo) {
      rr(ctx, -0.6, -0.72, 1.6, 1.44, 0.18);
      ctx.fillStyle = '#b3b8bc'; ctx.fill();
      bevel(ctx, -0.6, -0.72, 1.6, 1.44, 0.18, 1, 0.16);
      for (const y of [-0.4, 0, 0.4]) {
        circle(ctx, 0.85, y, 0.16, '#101113');
        circle(ctx, 0.85, y, 0.09, C.red);
      }
      grille(ctx, -0.45, -0.4, 0.7, 4, 0.22);
    } else if (D.anchor) {
      const big = m.t === 'anchor2';
      housing(big ? 0.66 : 0.56, 'mid');
      circle(ctx, 0, 0, 0.3, '#2a2d31');
      circle(ctx, 0, 0, 0.22, '#c9a14a');
      if (!m.fired) {
        tube(0, 0.18, 1.3, '#6f757a');
        ctx.fillStyle = '#d8d2c0';
        ctx.beginPath(); ctx.moveTo(1.75, 0); ctx.lineTo(1.1, -0.42); ctx.lineTo(1.25, 0); ctx.lineTo(1.1, 0.42); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#141619'; ctx.lineWidth = 0.05; ctx.stroke();
      }
    } else if (D.light) {
      const big = m.t === 'light2';
      rr(ctx, -0.4, big ? -0.75 : -0.45, 1.0, big ? 1.5 : 0.9, 0.16);
      ctx.fillStyle = '#4a4e53'; ctx.fill();
      bevel(ctx, -0.4, big ? -0.75 : -0.45, 1.0, big ? 1.5 : 0.9, 0.16, 1, 0.12);
      for (const y of big ? [-0.38, 0.38] : [0]) {
        const g = ctx.createRadialGradient(0.45, y, 0, 0.45, y, 0.34);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#fff2cc'); g.addColorStop(1, '#b09a5c');
        circle(ctx, 0.45, y, 0.3, g, '#141619');
      }
    } else if (D.tractor) {
      rr(ctx, -0.4, -0.75, 0.9, 1.5, 0.2);
      ctx.fillStyle = '#6d7378'; ctx.fill();
      bevel(ctx, -0.4, -0.75, 0.9, 1.5, 0.2, 1, 0.12);
      ctx.beginPath(); ctx.ellipse(0.55, 0, 0.3, 0.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1b2a25'; ctx.fill();
      ctx.strokeStyle = '#6fe0bd'; ctx.lineWidth = 0.08; ctx.stroke();
      circle(ctx, 0.55, 0, 0.16, '#6fe0bd');
    } else if (D.drill) {
      // Arm ut til en piggete trommel som snurrer når den borer.
      tube(0, 0.5, 1.3, '#555a5f');
      rr(ctx, -0.5, -0.55, 0.9, 1.1, 0.18);
      ctx.fillStyle = '#9ba1a6'; ctx.fill();
      bevel(ctx, -0.5, -0.55, 0.9, 1.1, 0.18, 1, 0.12);
      ctx.save();
      ctx.translate(1.75, 0);
      const spin = m.spin || 0;
      ctx.rotate(spin);
      ctx.fillStyle = '#26282b';
      const n = 12;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const b = (i / n) * Math.PI * 2;
        ctx.lineTo(Math.cos(b - 0.12) * 0.72, Math.sin(b - 0.12) * 0.72);
        ctx.lineTo(Math.cos(b) * 1.05, Math.sin(b) * 1.05);
        ctx.lineTo(Math.cos(b + 0.12) * 0.72, Math.sin(b + 0.12) * 0.72);
      }
      ctx.closePath(); ctx.fill();
      const g = ctx.createRadialGradient(-0.25, -0.25, 0.05, 0, 0, 0.78);
      g.addColorStop(0, '#6a6f74'); g.addColorStop(1, '#1f2124');
      circle(ctx, 0, 0, 0.76, g, '#0e0f11');
      for (let i = 0; i < 8; i++) {
        const b = (i / 8) * Math.PI * 2 + 0.2;
        circle(ctx, Math.cos(b) * 0.5, Math.sin(b) * 0.5, 0.1, '#3f4347');
        circle(ctx, Math.cos(b) * 0.5 - 0.03, Math.sin(b) * 0.5 - 0.03, 0.04, 'rgba(255,255,255,0.4)');
      }
      circle(ctx, 0, 0, 0.26, '#8d9398', '#141619');
      ctx.restore();
    }
    ctx.restore();
  }

  // Tegn én modul sentrert i (0,0), til butikken. m kan være null.
  RF.drawModule = (ctx, t, m) => {
    const mm = { t, x: 0, y: 0, lx: 0, ly: 0, dir: 0, aimA: 0, hp: m ? m.hp : RF.MODULES[t].hp };
    moduleArt(ctx, mm, { n: true, s: true, e: true, w: true });
    if (RF.MODULES[t].mount) tool(ctx, mm, 0);
  };

  let glowCv = null;
  function glowSprite() {
    if (glowCv) return glowCv;
    glowCv = document.createElement('canvas');
    glowCv.width = glowCv.height = 64;
    const x = glowCv.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(235,245,255,0.95)');
    g.addColorStop(0.2, 'rgba(170,210,255,0.55)');
    g.addColorStop(1, 'rgba(90,150,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return glowCv;
  }

  // Bilde av skipet i butikken (nesen mot høyre), med alt utstyret.
  RF.drawShipPreview = (cv, ship) => {
    const obj = { layout: ship.s.layout };
    const art = artOf(obj);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 320, H = cv.clientHeight || 240;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
    bg.addColorStop(0, '#16202b'); bg.addColorStop(1, '#05070a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(120,160,200,0.08)'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    const k = Math.min(W / art.w, H / art.h) * 0.94;
    ctx.translate(W / 2, H / 2);
    ctx.scale(k, k);
    ctx.translate(-(art.x0 + art.w / 2), -(art.y0 + art.h / 2));
    ctx.globalAlpha = 0.5;
    ctx.drawImage(art.sh, art.x0 + 0.8, art.y0 + 0.8, art.w, art.h);
    ctx.globalAlpha = 1;
    ctx.drawImage(art.cv, art.x0, art.y0, art.w, art.h);
    for (const m of obj.layout) {
      if (!RF.MODULES[m.t].mount) continue;
      const keep = m.aimA;
      m.aimA = null;
      tool(ctx, m, 0);
      m.aimA = keep;
    }
    ctx.globalCompositeOperation = 'lighter';
    const spr = glowSprite();
    for (const d of art.domes) ctx.drawImage(spr, d.x - 0.9, d.y - 0.9, 1.8, 1.8);
    ctx.globalCompositeOperation = 'source-over';
  };

  const P = RF.Renderer.prototype;

  P.drawModular = function (obj, time) {
    const ctx = this.ctx, b = obj.body, L = obj.layout;
    if (!L || !L.length) return;
    const art = artOf(obj);
    ctx.save();
    ctx.translate(b.x, b.y);
    // Skygge ut fra sola.
    const sd = (this._sunDir || 0) + Math.PI;
    ctx.save();
    ctx.translate(Math.cos(sd) * 1.1, Math.sin(sd) * 1.1);
    ctx.rotate(b.a);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(art.sh, art.x0, art.y0, art.w, art.h);
    ctx.restore();
    ctx.rotate(b.a);
    ctx.drawImage(art.cv, art.x0, art.y0, art.w, art.h);
    for (const m of L) if (RF.MODULES[m.t].anchor) m.fired = !!((obj.anchor && obj.anchor.module === m) || (obj.harpoon && obj.harpoon.mod === m));
    for (const m of L) if (RF.MODULES[m.t].mount) tool(ctx, m, time);
    ctx.restore();
  };

  // Flammer, dyser, navigasjonslys og skjold.
  P.drawModularFx = function (obj, time) {
    const ctx = this.ctx, b = obj.body, fx = obj.fx, L = obj.layout;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.globalCompositeOperation = 'lighter';
    const flame = (x, y, dx, dy, len, wid) => {
      if (len < 0.15) return;
      const ex = x + dx * len, ey = y + dy * len;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, 'rgba(235,245,255,0.95)');
      g.addColorStop(0.25, 'rgba(120,180,255,0.75)');
      g.addColorStop(1, 'rgba(40,80,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - dy * wid, y + dx * wid);
      ctx.quadraticCurveTo(ex - dy * wid * 0.4, ey + dx * wid * 0.4, ex, ey);
      ctx.quadraticCurveTo(ex + dy * wid * 0.4, ey - dx * wid * 0.4, x + dy * wid, y - dx * wid);
      ctx.closePath();
      ctx.fill();
    };
    const fl = fx.main * (0.85 + Math.random() * 0.3);
    let maxY = -1e9, minY = 1e9, minX = 1e9;
    for (const m of L) {
      maxY = Math.max(maxY, m.ly); minY = Math.min(minY, m.ly); minX = Math.min(minX, m.lx);
      if (m.t === 'thruster' || m.t === 'thruster2') {
        const big = m.t === 'thruster2';
        const ys = big ? [m.ly - 0.6, m.ly + 0.6] : [m.ly];
        for (const y of ys) {
          flame(m.lx - h, y, -1, 0, (big ? 4 : 3) + fl * (big ? 14 : 10), big ? 0.55 : 0.8);
          if (fl > 0.05) {
            const g = ctx.createRadialGradient(m.lx - h, y, 0, m.lx - h, y, 2 + fl * 2);
            g.addColorStop(0, `rgba(140,190,255,${0.5 * fl})`);
            g.addColorStop(1, 'rgba(60,120,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(m.lx - h, y, 2 + fl * 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (m.t === 'rcs') {
        flame(m.lx + 0.9, m.ly, 1, 0, fx.retro * 2.5, 0.2);
        flame(m.lx, m.ly - 0.9, 0, -1, fx.right * 2.2 + (m.ly > 0 ? fx.rotL : fx.rotR) * 1.8, 0.18);
        flame(m.lx, m.ly + 0.9, 0, 1, fx.left * 2.2 + (m.ly < 0 ? fx.rotR : fx.rotL) * 1.8, 0.18);
      }
    }
    // Kuplene langs kantene og lysende deler lyser.
    const art = obj._art;
    if (art) {
      const spr = glowSprite();
      for (const d of art.domes) ctx.drawImage(spr, d.x - 0.9, d.y - 0.9, 1.8, 1.8);
    }
    for (const m of L) {
      if (m.t === 'refinery') {
        const k = 0.55 + 0.45 * Math.sin(time * 3 + m.x * 1.7);
        ctx.fillStyle = `rgba(255,${110 + 50 * k},30,${0.55 * k})`;
        for (let i = 0; i < 4; i++) ctx.fillRect(m.lx - 0.55 + i * 0.3, m.ly - 0.45, 0.16, 0.9);
      } else if (m.t === 'shield' && obj.shield > 0) {
        const g = ctx.createRadialGradient(m.lx, m.ly, 0, m.lx, m.ly, 1.1);
        g.addColorStop(0, 'rgba(120,210,255,0.35)'); g.addColorStop(1, 'rgba(60,160,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.lx, m.ly, 1.1, 0, Math.PI * 2); ctx.fill();
      } else if (m.t === 'thruster' || m.t === 'thruster2') {
        const big = m.t === 'thruster2';
        for (const y of big ? [-0.55, 0.55] : [0]) {
          const x = m.lx - h - (big ? 1.1 : 1.2);
          const g = ctx.createRadialGradient(x, m.ly + y, 0, x, m.ly + y, big ? 0.7 : 0.95);
          g.addColorStop(0, `rgba(200,230,255,${0.45 + fx.main * 0.5})`); g.addColorStop(1, 'rgba(80,140,255,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, m.ly + y, big ? 0.7 : 0.95, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    const blink = (time * 1.2 + (obj.blinkOff || 0)) % 1 < 0.12;
    const light = (x, y, col, r) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    light(minX, minY - h, 'rgba(255,60,50,0.9)', 1.2);
    light(minX, maxY + h, 'rgba(60,255,120,0.9)', 1.2);
    if (blink) light(minX - h, 0, 'rgba(255,245,230,1)', 2.2);
    if (obj.shieldFlash > 0.01) {
      const a = obj.shieldFlash, R = b.radius + 2.5;
      const sg = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
      sg.addColorStop(0, 'rgba(90,200,255,0)');
      sg.addColorStop(0.85, `rgba(90,200,255,${0.22 * a})`);
      sg.addColorStop(1, `rgba(170,230,255,${0.65 * a})`);
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      const hd = obj.shieldHitDir || 0;
      ctx.strokeStyle = `rgba(200,240,255,${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, R - 0.3, hd - 0.5, hd + 0.5); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  };

  // Laserstråler. obj.beams: [{ lx, ly, len, hit, color, w }] i lokale koordinater.
  P.drawBeams = function (obj) {
    const ctx = this.ctx, b = obj.body;
    if (!obj.beams || !obj.beams.length) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const B of obj.beams) {
      const d = b.dirWorld(Math.cos(B.a || 0), Math.sin(B.a || 0));
      const p0 = b.toWorld(B.lx, B.ly);
      const p1 = { x: p0.x + d.x * B.len, y: p0.y + d.y * B.len };
      const flick = 0.75 + Math.random() * 0.25;
      ctx.strokeStyle = `rgba(${B.color},${0.35 * flick})`;
      ctx.lineWidth = B.w * 3.5;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,215,${0.9 * flick})`;
      ctx.lineWidth = B.w;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      if (B.hit) {
        const r = 3 + Math.random() * 1.5;
        const g = ctx.createRadialGradient(B.hit.x, B.hit.y, 0, B.hit.x, B.hit.y, r);
        g.addColorStop(0, 'rgba(255,255,230,1)');
        g.addColorStop(0.3, `rgba(${B.color},0.7)`);
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(B.hit.x, B.hit.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';
  };

  // Lyskjegler fra lysmodulene: [{ lx, ly, a, range }] i lokale koordinater.
  RF.lightSources = (obj) => {
    const out = [];
    for (const m of obj.layout) {
      const D = RF.MODULES[m.t];
      if (!D.light || RF.isBlocked(obj.layout, m)) continue;
      const a = RF.DIR_ANGLE[m.dir];
      out.push({ lx: m.lx + Math.cos(a) * CELL * 0.8, ly: m.ly + Math.sin(a) * CELL * 0.8, a, range: D.light });
    }
    return out;
  };

  // Svak lysdis i kjeglen, så lyset kan anes i støvet.
  P.drawHaze = function (obj) {
    const ctx = this.ctx, b = obj.body;
    ctx.globalCompositeOperation = 'lighter';
    for (const Ls of obj._lights || []) {
      const n = b.toWorld(Ls.lx, Ls.ly);
      const dir = b.a + Ls.a;
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Ls.range);
      g.addColorStop(0, 'rgba(255,236,200,0.05)');
      g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.arc(n.x, n.y, Ls.range, dir - 0.5, dir + 0.5); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };
})();
