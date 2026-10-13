// Instrumentpanel tegnet rett på lerretet. Holdes lite, så skjermen er fri
// til det man faktisk gjør: små felt i hjørnene, radar som kan forstørres ved
// trykk, og et skadediagram av skipet i stedet for mange stolper.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  const C = {
    text: '#e8f0ff', muted: '#8fa3bf', gate: '#4fd1ff', amber: '#ffc35a', danger: '#ff5d6c', ok: '#5be3a6',
    naq: '#6fe0bd', phosphor: '#9fdc8a',
  };
  const F = {
    label: '600 11px "Saira Condensed", "Arial Narrow", ui-sans-serif, sans-serif',
    title: '700 13px "Saira Condensed", "Arial Narrow", ui-sans-serif, sans-serif',
    stencil: '400 15px "Saira Stencil One", "Saira Condensed", Impact, sans-serif',
    num: '400 12px "Share Tech Mono", ui-monospace, Menlo, monospace',
  };
  RF.HUD_COLORS = C;
  const iconCache = {};
  const iconPath = (id, d) => iconCache[id] || (iconCache[id] = new Path2D(d));

  const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');

  let metal = null;
  function rivet(ctx, x, y) {
    const g = ctx.createRadialGradient(x - 0.8, y - 0.8, 0.2, x, y, 2.4);
    g.addColorStop(0, '#bdb5a2');
    g.addColorStop(0.5, '#6e675a');
    g.addColorStop(1, '#1a1815');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fill();
  }

  function platePath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.moveTo(x + 6, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - 6); ctx.lineTo(x + w - 6, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + 6);
    ctx.closePath();
  }

  // Liten stålplate med avfaset kant.
  function panel(ctx, x, y, w, h, alpha = 0.82) {
    if (!metal) metal = ctx.createPattern(RF.noiseCanvas(128, 777, '#000000', '#e8dcc0'), 'repeat');
    ctx.save();
    ctx.globalAlpha = alpha;
    platePath(ctx, x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#3a3832');
    g.addColorStop(1, '#1c1b18');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    ctx.globalAlpha = alpha * 0.3;
    ctx.fillStyle = metal;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    ctx.strokeStyle = '#0b0a08';
    ctx.lineWidth = 1.5;
    platePath(ctx, x, y, w, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,238,205,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1.5, y + h - 1.5); ctx.lineTo(x + 1.5, y + 6.5); ctx.lineTo(x + 6.5, y + 1.5); ctx.lineTo(x + w - 1.5, y + 1.5); ctx.stroke();
    rivet(ctx, x + w - 5, y + 5);
    rivet(ctx, x + 5, y + h - 5);
  }

  // Lett, gjennomsiktig flate med tynn kant (i stedet for tunge stålplater).
  function glass(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,26,0.62)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,180,255,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function miniBar(ctx, x, y, w, label, frac, color, text) {
    ctx.font = F.label;
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y + 7);
    const bx = x + 18;
    ctx.fillStyle = '#0c0b09';
    ctx.fillRect(bx, y, w, 6);
    ctx.fillStyle = color;
    ctx.fillRect(bx, y, w * G.clamp(frac, 0, 1), 6);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, y, w * G.clamp(frac, 0, 1), 2);
    ctx.font = F.num;
    ctx.fillStyle = C.text;
    ctx.fillText(text, bx + w + 5, y + 7);
  }

  const hpColor = (f) => (f > 0.66 ? C.ok : f > 0.33 ? C.amber : C.danger);

  // Skadediagram: hver modul som en rute, farget etter hvor hel den er.
  // Moduler som er borte (finnes i tegningen, men ikke på skipet) vises som omriss.
  function damageMap(ctx, ship, x, y, maxW, maxH) {
    const s = ship.s;
    const bp = s.blueprint || [];
    const all = bp.concat(s.layout);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const m of all) { x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y); }
    const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
    const c = Math.max(4, Math.min(11, Math.floor(Math.min(maxW / rows, maxH / cols))));
    // Nesen peker opp i diagrammet.
    const at = (m) => ({ px: x + (m.y - y0) * c, py: y + (x1 - m.x) * c });
    const have = new Set(s.layout.map((m) => m.x + ',' + m.y + m.t));
    for (const m of bp) {
      if (have.has(m.x + ',' + m.y + m.t)) continue;
      const p = at(m);
      ctx.strokeStyle = 'rgba(226,85,61,0.75)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.px + 0.5, p.py + 0.5, c - 2, c - 2);
    }
    for (const m of s.layout) {
      const p = at(m);
      const f = m.hp / RF.MODULES[m.t].hp;
      ctx.fillStyle = hpColor(f);
      ctx.globalAlpha = 0.35 + 0.65 * f;
      ctx.fillRect(p.px, p.py, c - 1, c - 1);
      ctx.globalAlpha = 1;
      if (m.t === 'cockpit') { ctx.fillStyle = '#0c0b09'; ctx.fillRect(p.px + c / 2 - 1.5, p.py + c / 2 - 1.5, 3, 3); }
    }
    return { w: rows * c, h: cols * c };
  }

  // from = punktet avstanden måles fra (standard: skipet). textDy flytter teksten.
  function edgeMarker(ctx, game, R, wx, wy, label, color, from, textDy = 0) {
    const s = R.toScreen(game.cam, wx, wy);
    const touch = game.touchUI;
    // Rammen må alltid ha skjermens midtpunkt godt innenfor.
    // På mobil holdes pilene unna knappene (nede, og langs høyre kant liggende).
    const portrait = touch && R.h > R.w;
    // På høykant ligger panel, veileder og meldinger øverst: pilene under dem.
    const hb = game._hudBottom || 80;
    const ml = 22, mr = touch ? (portrait ? 24 : 110) : 26, mt = portrait ? Math.max(120, hb + 44) : touch ? 64 : 84, mb = touch ? (portrait ? Math.min(250, R.h * 0.32) : 76) : 80;
    const inside = s.x > ml && s.x < R.w - mr && s.y > mt && s.y < R.h - mb;
    if (inside) return;
    const ship = from || game.ship.body;
    const dist = G.len(wx - ship.x, wy - ship.y);
    const cx = R.w / 2, cy = R.h / 2;
    const dx = s.x - cx, dy = s.y - cy;
    const kx = dx > 0 ? (R.w - mr - cx) / dx : dx < 0 ? (ml - cx) / dx : Infinity;
    const ky = dy > 0 ? (R.h - mb - cy) / dy : dy < 0 ? (mt - cy) / dy : Infinity;
    const k = Math.min(kx, ky);
    let ex = cx + dx * k, ey = cy + dy * k;
    // Ikke oppå panelet og veilederen øverst til venstre: skyv pila nedover.
    if (ex < (game._hudRight || 200) + 20 && ey < hb + 8) ey = hb + 14;
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-3, -4.5); ctx.lineTo(-3, 4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = '600 10px "Saira Condensed", "Arial Narrow", ui-sans-serif, sans-serif';
    ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
    const tx = ex - Math.cos(a) * 12, ty = ey - Math.sin(a) * 12;
    // Navn som ville havnet oppå hverandre, flyttes ned en linje.
    const text = label.toUpperCase() + ' ' + fmtDist(dist), tw = ctx.measureText(text).width;
    const al = ctx.textAlign, lx = al === 'right' ? tx - tw : al === 'center' ? tx - tw / 2 : tx;
    let y = ty + 4 + textDy;
    const used = game._mk || (game._mk = []);
    for (let k = 0; k < 4 && used.some((u) => lx < u.x + u.w && lx + tw > u.x && Math.abs(y - u.y) < 11); k++) y += 12;
    used.push({ x: lx, y, w: tw });
    ctx.fillText(text, tx, y);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function radar(ctx, game, x, y, r) {
    const ship = game.ship.body, range = r > 60 ? 2200 : 1200;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = 'rgba(230,223,205,0.18)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6,14,8,0.92)';
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = 'rgba(159,220,138,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.5, 0, Math.PI * 2); ctx.stroke();
    const sw = (game.time * 1.4) % (Math.PI * 2);
    if (ctx.createConicGradient) {
      const sg = ctx.createConicGradient(sw, x, y);
      sg.addColorStop(0, 'rgba(159,220,138,0.22)');
      sg.addColorStop(0.08, 'rgba(159,220,138,0)');
      sg.addColorStop(1, 'rgba(159,220,138,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const k = r / range;
    for (const b of game.sys.world.bodies) {
      const dx = (b.x - ship.x) * k, dy = (b.y - ship.y) * k;
      if (dx * dx + dy * dy > r * r) continue;
      if (b.kind === 'rock' && b.comet) {
        ctx.fillStyle = '#9fdcff';
        ctx.beginPath(); ctx.arc(x + dx, y + dy, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === 'rock') {
        const M = RF.MATERIALS[b.mat];
        ctx.fillStyle = M.vein || M.light;
        const s = G.clamp(b.radius * k * 1.6, 1, 3.5);
        ctx.fillRect(x + dx - s / 2, y + dy - s / 2, s, s);
      } else if (b.kind === 'ore' || b.kind === 'wreck') {
        ctx.fillStyle = b.kind === 'wreck' ? C.amber : C.naq;
        ctx.fillRect(x + dx, y + dy, 1, 1);
      } else if (b.kind === 'npc') {
        const hostile = b.npc && b.npc.T.hostile;
        ctx.fillStyle = hostile ? C.danger : '#e6dfcd';
        const s2 = hostile ? 3.5 : 2;
        ctx.fillRect(x + dx - s2 / 2, y + dy - s2 / 2, s2, s2);
      }
    }
    const st = game.sys.station;
    ctx.fillStyle = C.ok;
    ctx.fillRect(x + (st.x - ship.x) * k - 2.5, y + (st.y - ship.y) * k - 2.5, 5, 5);
    ctx.strokeStyle = C.gate;
    ctx.lineWidth = 1.5;
    for (const g of RF.gatesOf(game.sys)) {
      ctx.beginPath(); ctx.arc(x + (g.x - ship.x) * k, y + (g.y - ship.y) * k, g.key === 'gate2' ? 5.5 : 3.5, 0, Math.PI * 2); ctx.stroke();
    }
    // Nedstigningskorridoren til planeten: en liten ruter.
    const pt = game.sys.port;
    if (pt) {
      const px2 = x + (pt.x - ship.x) * k, py2 = y + (pt.y - ship.y) * k;
      ctx.strokeStyle = RF.Planets.COLOR;
      ctx.beginPath(); ctx.moveTo(px2, py2 - 4); ctx.lineTo(px2 + 4, py2); ctx.lineTo(px2, py2 + 4); ctx.lineTo(px2 - 4, py2); ctx.closePath(); ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ship.a);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-2.5, 2.5); ctx.lineTo(-2.5, -2.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    game._radarHit = { x, y, r };
  }

  RF.drawHUD = (R, game) => {
    const ctx = R.ctx, w = R.w, h = R.h, dpr = R.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'alphabetic';
    const ship = game.ship, b = ship.body, s = ship.s, st = ship.stats;
    const touch = game.touchUI;
    const top = 8;
    const spd = G.len(b.vx, b.vy);

    // Fartsvektor: en tynn stiplet linje fra skipet.
    if (!game.dead && !ship.docked && spd > 0.4) {
      const sp = R.toScreen(game.cam, b.x, b.y);
      const off = b.radius * game.cam.zoom + 8;
      const L = Math.min(off + 110, off + 16 + spd * 2.5);
      ctx.strokeStyle = 'rgba(227,160,58,0.55)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(sp.x + (b.vx / spd) * off, sp.y + (b.vy / spd) * off);
      ctx.lineTo(sp.x + (b.vx / spd) * L, sp.y + (b.vy / spd) * L);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Trådkors der man sikter. Grønt når minst ett tårn når dit.
    const P = RF.Input.pointer;
    // Trådkorset står der siktet faktisk er (også når det er låst til en stein).
    if (!ship.docked && !game.dead && P.has && game.aim && (!touch || P.down || game.aimLock || game.aimWorld)) {
      const ok = ship.s.layout.some((m) => m.onTarget);
      const X = R.w / 2 + (game.aim.x - game.cam.x) * game.cam.zoom, Y = R.h / 2 + (game.aim.y - game.cam.y) * game.cam.zoom;
      ctx.strokeStyle = ok ? 'rgba(149,196,106,0.9)' : 'rgba(226,85,61,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X, Y, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(X - 15, Y); ctx.lineTo(X - 5, Y); ctx.moveTo(X + 5, Y); ctx.lineTo(X + 15, Y);
      ctx.moveTo(X, Y - 15); ctx.lineTo(X, Y - 5); ctx.moveTo(X, Y + 5); ctx.lineTo(X, Y + 15);
      ctx.stroke();
      // Låst mål: hjørneklammer rundt trådkorset.
      if (game.aimLock) {
        const q = 20, c = 6;
        ctx.beginPath();
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          ctx.moveTo(X + sx * q, Y + sy * (q - c)); ctx.lineTo(X + sx * q, Y + sy * q); ctx.lineTo(X + sx * (q - c), Y + sy * q);
        }
        ctx.stroke();
      }
    }
    game._mk = [];
    if (!ship.docked && !game.dead && RF.Scan) RF.Scan.drawHud(ctx, R, game);
    if (!ship.docked) {
      edgeMarker(ctx, game, R, game.sys.station.x, game.sys.station.y, game.sys.station.name, C.ok);
      // Har man panorert bort fra skipet, viser en pil hvor det er.
      if (game.camFree) edgeMarker(ctx, game, R, b.x, b.y, 'Your ship', '#ffffff', game.cam, 16);
      // Kapitalporten er for store skip: pila vises bare for dem, eller når den er nær.
      for (const g of RF.gatesOf(game.sys)) {
        if (g.key === 'gate2' && b.radius < 30 && G.len(g.x - b.x, g.y - b.y) > 1500) continue;
        edgeMarker(ctx, game, R, g.x, g.y, g.name || 'Gate', C.gate);
      }
      const gt = RF.Guide && RF.Guide.target(game);
      if (gt) edgeMarker(ctx, game, R, gt.x, gt.y, gt.label, gt.color);
      if (game.sys.port) edgeMarker(ctx, game, R, game.sys.port.x, game.sys.port.y, game.sys.port.world, RF.Planets.COLOR);
      for (const n of game.sys.npcs) {
        if (!n.T.hostile || !n.active || n.dead) continue;
        edgeMarker(ctx, game, R, n.body.x, n.body.y, n.T.name, C.danger);
      }
      // Skrog-linje over piratene som er på skjermen.
      for (const n of game.sys.npcs) {
        if (!n.T.hostile || !n.active || n.dead) continue;
        const p = R.toScreen(game.cam, n.body.x, n.body.y);
        if (p.x < 0 || p.y < 0 || p.x > R.w || p.y > R.h) continue;
        const bw = 30, yy = p.y - n.body.radius * game.cam.zoom - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(p.x - bw / 2 - 1, yy - 1, bw + 2, 5);
        ctx.fillStyle = C.danger; ctx.fillRect(p.x - bw / 2, yy, bw * G.clamp(n.hull / n.T.hull, 0, 1), 3);
      }
    }

    // Øverst til venstre: et lett, gjennomsiktig panel med tall på alt.
    //   MIDGARD                1,500 cr
    //   HULL 100 %      SHIELD 100 %     (hver med en tynn stolpe under)
    //   FUEL  72 %      CARGO 3/16 t
    //   12.4 m/s   [HOLD] [DRIFT] [2 JOBS]
    const name = game.sys.def.name.toUpperCase();
    const cred = Math.floor(game.credits).toLocaleString('en-US') + ' cr';
    const hf = ship.hullFrac();
    const damaged = hf < 0.999;
    // På mobil: et lite panel med fire korte målere på én rad.
    const PW = touch ? 172 : 206, PH = (touch ? 58 : 88) + (ship.anchor ? 13 : 0);
    const x0 = 8, y0 = top;
    glass(ctx, x0, y0, PW, PH);
    ctx.font = F.label;
    ctx.fillStyle = C.text;
    ctx.fillText(name, x0 + 9, y0 + 15);
    ctx.font = F.num;
    ctx.fillStyle = C.amber;
    ctx.textAlign = 'right';
    ctx.fillText(cred, x0 + PW - 9, y0 + 15);
    ctx.textAlign = 'left';
    const cm = RF.cargoMass(s);
    const fuelF = s.fuel / (st.fuelCap || 1), shF = ship.shield / (st.shieldMax || 1), cargoF = cm / (st.hold || 1);
    const pctT = (f) => Math.round(G.clamp(f, 0, 1) * 100) + ' %';
    const meters = [
      ['HULL', hf, hpColor(hf), pctT(hf)],
      ['SHIELD', shF, C.gate, st.shieldMax ? pctT(shF) : '—'],
      ['FUEL', fuelF, fuelF < 0.15 ? C.danger : C.amber, pctT(fuelF)],
      ['CARGO', cargoF, cargoF > 0.95 ? C.danger : '#c9a24a', cm.toFixed(cm < 10 ? 1 : 0) + '/' + st.hold + 't'],
    ];
    const cw = (PW - 18 - 10) / 2;
    if (touch) {
      const w4 = (PW - 18 - 18) / 4;
      meters.forEach(([lbl, f, col], i) => {
        const x = x0 + 9 + i * (w4 + 6), y = y0 + 22;
        ctx.font = '600 8.5px "Saira Condensed", "Arial Narrow", sans-serif';
        ctx.fillStyle = col === C.danger || (i < 3 && f < 0.25) ? C.danger : C.muted;
        ctx.fillText(lbl === 'SHIELD' ? 'SHLD' : lbl, x, y + 7);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, y + 11, w4, 3);
        ctx.fillStyle = col;
        ctx.fillRect(x, y + 11, w4 * G.clamp(f, 0, 1), 3);
      });
    } else meters.forEach(([lbl, f, col, val], i) => {
      const x = x0 + 9 + (i % 2) * (cw + 10), y = y0 + 23 + Math.floor(i / 2) * 23;
      ctx.font = '600 9px "Saira Condensed", "Arial Narrow", sans-serif';
      ctx.fillStyle = C.muted;
      ctx.fillText(lbl, x, y + 8);
      ctx.font = '400 10px "Share Tech Mono", ui-monospace, monospace';
      ctx.fillStyle = col === C.danger ? C.danger : C.text;
      ctx.textAlign = 'right';
      ctx.fillText(val, x + cw, y + 8);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y + 12, cw, 3);
      ctx.fillStyle = col;
      ctx.fillRect(x, y + 12, cw * G.clamp(f, 0, 1), 3);
    });
    // Fart og tilstander (bare de som ikke er vanlige vises).
    let tx = x0 + 9;
    const ty = y0 + (touch ? 50 : 80);
    ctx.font = '400 12px "Share Tech Mono", ui-monospace, monospace';
    ctx.fillStyle = C.text;
    const spdT = spd.toFixed(1) + ' m/s';
    ctx.fillText(spdT, tx, ty);
    tx += ctx.measureText(spdT).width + 8;
    const tag = (t, col) => {
      ctx.font = '700 9px "Saira Condensed", "Arial Narrow", sans-serif';
      const tw = ctx.measureText(t).width + 8;
      ctx.strokeStyle = col; ctx.globalAlpha = 0.85; ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, ty - 9.5, tw, 12);
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.fillText(t, tx + 4, ty);
      tx += tw + 4;
    };
    if (ship.nav && ship.nav.hold) tag('HOLD', C.ok);
    else if (ship.nav) tag('AUTOPILOT', C.gate);
    if (ship.fa === 0) tag('DRIFT', C.amber);
    else if (ship.fa === 2) tag('AUTO-BRAKE', C.gate);
    const active = game.missions.filter((m) => m.status === 'aktiv').length;
    if (active && tx < x0 + PW - 40) tag(active + (active > 1 ? ' JOBS' : ' JOB'), C.muted);
    if (ship.anchor) {
      ctx.font = F.label;
      ctx.fillStyle = C.ok;
      ctx.fillText('CABLE ' + ship.anchor.rope.length.toFixed(0) + ' M', x0 + 9, y0 + PH - 4);
    }
    // Lasteluken: liten merkelapp rett under panelet.
    if (ship.scoop && ship.scoop.on && !ship.docked) {
      ctx.font = F.label;
      const fullH = ship.holdFree() - ship.procProduct() <= 0.02;
      ctx.fillStyle = fullH ? C.amber : C.ok;
      ctx.fillText(fullH ? 'SCOOP OPEN · HOLD FULL' : ship.scoop.open < 1 ? 'SCOOP OPENING…' : 'SCOOP OPEN', x0 + 4, y0 + PH + 13);
    }
    // Skadekart bare når noe er skadet.
    if (damaged) { glass(ctx, x0 + PW + 4, y0, 44, PH); damageMap(ctx, ship, x0 + PW + 9, y0 + 6, 34, PH - 12); }
    // Veilederen: neste oppgave under panelet.
    const scoopLbl = ship.scoop && ship.scoop.on && !ship.docked ? 18 : 0;
    const guideH = RF.Guide ? RF.Guide.draw(ctx, R, game, x0, y0 + PH + 6 + scoopLbl, Math.min(touch ? 250 : 270, w - 16)) : 0;
    // Hvor langt ned og ut panelområdet går (pilene i kanten holder seg unna).
    game._hudBottom = y0 + PH + scoopLbl + (guideH ? guideH + 6 : 0);
    game._hudRight = x0 + Math.max(PW + (damaged ? 48 : 0), guideH ? Math.min(touch ? 250 : 270, w - 16) : 0);

    // Verktøylinje nederst på PC: små ikonbrikker med tasten. Bare det valgte
    // verktøyet viser navnet. Til høyre: samlestrålen eller lasteluken (F).
    // På mobil er verktøyene knapper.
    if (!touch && !ship.docked) {
      const have = { laser: st.lasers.length + st.drills.length, kanon: st.guns.length, rakett: st.rockets.length, anker: st.anchors.length };
      const ICON = { laser: 'laser', kanon: 'cannon', rakett: 'rocket', anker: 'hook' };
      // Verktøy skipet ikke har, vises ikke.
      const chips = RF.TOOLS.filter((t) => have[t] || ship.tool === t).map((t) => {
        const i = RF.TOOLS.indexOf(t);
        const sel = ship.tool === t;
        let lbl = sel ? RF.TOOL_NAMES[t].toUpperCase() : '';
        if (t === 'rakett' && have[t]) lbl += (lbl ? ' ' : '') + s.ammo;
        if (t === 'laser' && have[t] && sel) lbl += ` T${st.maxTier}`;
        return { key: String(i + 1), icon: ICON[t], lbl, sel, dim: !have[t] };
      });
      const hasT = st.tractors.length > 0;
      const colOn = hasT ? ship.tractor.on : !!(ship.scoop && ship.scoop.on);
      chips.push({ gap: true });
      const hint = RF.Guide && RF.Guide.highlight(game);
      chips.push({ key: 'F', icon: hasT ? 'collect' : 'scoop', lbl: colOn ? (hasT ? 'COLLECT' : 'SCOOP') : hint ? 'PRESS F' : '', sel: colOn || !!hint, dim: false, on: true });
      ctx.font = F.label;
      const H = 22;
      for (const c of chips) c.w = c.gap ? 8 : 38 + (c.lbl ? ctx.measureText(c.lbl).width + 6 : 0);
      const total = chips.reduce((a, c) => a + c.w + (c.gap ? 0 : 4), -4);
      let x = w / 2 - total / 2;
      const y = h - 30;
      for (const c of chips) {
        if (c.gap) { x += c.w; continue; }
        glass(ctx, x, y, c.w, H);
        if (c.sel) { ctx.fillStyle = c.on ? C.ok : C.amber; ctx.fillRect(x + 4, y + H - 2, c.w - 8, 2); }
        const col = c.dim ? '#5a554a' : c.sel ? (c.on ? C.ok : C.amber) : C.text;
        ctx.fillStyle = C.muted;
        ctx.font = '600 9px "Share Tech Mono", ui-monospace, monospace';
        ctx.fillText(c.key, x + 5, y + 14);
        const ic = RF.UI_ICONS && RF.UI_ICONS[c.icon];
        if (ic) {
          const P = iconPath(c.icon, ic);
          ctx.save(); ctx.translate(x + 15, y + 3); ctx.scale(16 / 24, 16 / 24);
          ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.stroke(P); ctx.restore();
        }
        if (c.lbl) { ctx.font = F.label; ctx.fillStyle = col; ctx.fillText(c.lbl, x + 36, y + 15); }
        x += c.w + 4;
      }
    }

    // Radar: liten, forstørres ved trykk.
    const rr = game.radarBig ? Math.min(120, Math.min(w, h) * 0.28) : 38;
    radar(ctx, game, w - rr - 12, top + rr + 4, rr);

    // Handlingshint.
    // På mobil uten tastenavnet (knappen over avtrekkeren gjør det samme).
    // På mobil viser knappen (DOCK, LAND …) det samme, så da trengs ikke teksten.
    if (game.prompt && !(touch && game.action)) {
      const txt = touch ? game.prompt.replace(/^\[[^\]]+\]\s*/, '') : game.prompt;
      ctx.font = F.label;
      const tw = ctx.measureText(txt).width + 18;
      const py = touch ? (h > w ? h - 150 : h - 24) : h - 50;
      glass(ctx, w / 2 - tw / 2, py - 13, tw, 20);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.amber;
      ctx.fillText(txt, w / 2, py + 1);
      ctx.textAlign = 'left';
    }

    // Meldinger øverst på midten, små og korte.
    ctx.textAlign = 'center';
    ctx.font = touch ? F.label : F.title;
    // På mobil midt mellom panelet og radaren, så de ikke går oppi dem.
    // På høykant under panelet.
    const port = touch && h > w;
    const my = port ? (game._hudBottom || 100) + 16 : top + 18, mx = port ? w / 2 : touch ? (196 + (w - 96)) / 2 : w / 2, lh = touch ? 14 : 17;
    const baseFont = ctx.font;
    game.messages.slice(-2).forEach((m, i) => {
      // Lange meldinger krymper litt, så de får plass på smale skjermer.
      ctx.font = baseFont;
      if (ctx.measureText(m.text).width > w - 24) ctx.font = '600 10px "Saira Condensed", "Arial Narrow", sans-serif';
      ctx.globalAlpha = Math.min(1, m.t) * 0.95;
      ctx.fillStyle = '#000';
      ctx.fillText(m.text, mx + 1, my + i * lh + 1);
      ctx.fillStyle = m.color || C.text;
      ctx.fillText(m.text, mx, my + i * lh);
    });
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';

    // Rød kant når skroget er kritisk.
    if (hf < 0.3 && !game.dead) {
      const a = 0.18 + 0.12 * Math.sin(game.time * 6);
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(255,40,30,0)');
      g.addColorStop(1, `rgba(255,40,30,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  };
})();
