// Instrumentpanel tegnet rett på lerretet. Holdes lite, så skjermen er fri
// til det man faktisk gjør: små felt i hjørnene, radar som kan forstørres ved
// trykk, og et skadediagram av skipet i stedet for mange stolper.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  const C = {
    text: '#e6dfcd', muted: '#958d7b', gate: '#6cc4e0', amber: '#e3a03a', danger: '#e2553d', ok: '#95c46a',
    naq: '#6fe0bd', phosphor: '#9fdc8a',
  };
  const F = {
    label: '600 11px "Saira Condensed", "Arial Narrow", ui-sans-serif, sans-serif',
    title: '700 13px "Saira Condensed", "Arial Narrow", ui-sans-serif, sans-serif',
    stencil: '400 15px "Saira Stencil One", "Saira Condensed", Impact, sans-serif',
    num: '400 12px "Share Tech Mono", ui-monospace, Menlo, monospace',
  };
  RF.HUD_COLORS = C;

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

  function edgeMarker(ctx, game, R, wx, wy, label, color) {
    const s = R.toScreen(game.cam, wx, wy);
    const touch = game.touchUI;
    // Rammen må alltid ha skjermens midtpunkt godt innenfor.
    const ml = 26, mr = touch ? 60 : 26, mt = 50, mb = touch ? Math.min(200, R.h * 0.3) : 80;
    const inside = s.x > ml && s.x < R.w - mr && s.y > mt && s.y < R.h - mb;
    if (inside) return;
    const ship = game.ship.body;
    const dist = G.len(wx - ship.x, wy - ship.y);
    const cx = R.w / 2, cy = R.h / 2;
    const dx = s.x - cx, dy = s.y - cy;
    const kx = dx > 0 ? (R.w - mr - cx) / dx : dx < 0 ? (ml - cx) / dx : Infinity;
    const ky = dy > 0 ? (R.h - mb - cy) / dy : dy < 0 ? (mt - cy) / dy : Infinity;
    const k = Math.min(kx, ky);
    const ex = cx + dx * k, ey = cy + dy * k;
    const a = Math.atan2(dy, dx);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-3, -4.5); ctx.lineTo(-3, 4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = F.label;
    ctx.textAlign = Math.cos(a) > 0.3 ? 'right' : Math.cos(a) < -0.3 ? 'left' : 'center';
    const tx = ex - Math.cos(a) * 12, ty = ey - Math.sin(a) * 12;
    ctx.fillText(label.toUpperCase() + ' ' + fmtDist(dist), tx, ty + 4);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function radar(ctx, game, x, y, r) {
    const ship = game.ship.body, range = r > 60 ? 2200 : 1200;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#3a3226';
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b0a08'; ctx.lineWidth = 1.5; ctx.stroke();
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
      if (b.kind === 'rock') {
        const M = RF.MATERIALS[b.mat];
        ctx.fillStyle = M.vein || M.light;
        const s = G.clamp(b.radius * k * 1.6, 1, 3.5);
        ctx.fillRect(x + dx - s / 2, y + dy - s / 2, s, s);
      } else if (b.kind === 'ore' || b.kind === 'wreck') {
        ctx.fillStyle = b.kind === 'wreck' ? C.amber : C.naq;
        ctx.fillRect(x + dx, y + dy, 1, 1);
      } else if (b.kind === 'npc') {
        ctx.fillStyle = '#e6dfcd';
        ctx.fillRect(x + dx - 1, y + dy - 1, 2, 2);
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
    if (!ship.docked && !game.dead && RF.Scan) RF.Scan.drawHud(ctx, R, game);
    if (!ship.docked) {
      edgeMarker(ctx, game, R, game.sys.station.x, game.sys.station.y, game.sys.station.name, C.ok);
      // Har man panorert bort fra skipet, viser en pil hvor det er.
      if (game.camOff.x || game.camOff.y) edgeMarker(ctx, game, R, b.x, b.y, 'Your ship', '#ffffff');
      for (const g of RF.gatesOf(game.sys)) edgeMarker(ctx, game, R, g.x, g.y, g.name || 'Gate', C.gate);
    }

    // Øverst til venstre: ett lite panel med alt om skipet.
    // Linje 1: system og kreditter. Linje 2: fire tynne målere. Linje 3: fart.
    const name = game.sys.def.name.toUpperCase();
    const cred = Math.floor(game.credits).toLocaleString('en-US') + ' cr';
    const hf = ship.hullFrac();
    const damaged = hf < 0.999;
    const PW = 176, PH = ship.anchor ? 74 : 62;
    panel(ctx, 8, top, PW + (damaged ? 44 : 0), PH, 0.82);
    ctx.font = F.label;
    ctx.fillStyle = C.text;
    ctx.fillText(name, 16, top + 15);
    ctx.font = F.num;
    ctx.fillStyle = C.amber;
    ctx.textAlign = 'right';
    ctx.fillText(cred, 8 + PW - 8, top + 15);
    ctx.textAlign = 'left';
    const cm = RF.cargoMass(s);
    const bars = [
      ['HULL', hf, hpColor(hf)],
      ['SHLD', ship.shield / (st.shieldMax || 1), C.gate],
      ['FUEL', s.fuel / (st.fuelCap || 1), s.fuel < st.fuelCap * 0.15 ? C.danger : C.amber],
      ['CARGO', cm / (st.hold || 1), '#c9a24a'],
    ];
    const bw = (PW - 16 - 3 * 6) / 4;
    bars.forEach(([lbl, f, col], i) => {
      const x = 16 + i * (bw + 6), y = top + 22;
      ctx.fillStyle = '#0c0b09';
      ctx.fillRect(x, y + 10, bw, 4);
      ctx.fillStyle = col;
      ctx.fillRect(x, y + 10, bw * G.clamp(f, 0, 1), 4);
      ctx.font = '600 9px "Saira Condensed", "Arial Narrow", sans-serif';
      ctx.fillStyle = C.muted;
      ctx.fillText(lbl, x, y + 7);
    });
    ctx.font = F.num;
    ctx.fillStyle = C.text;
    ctx.fillText(spd.toFixed(1) + ' m/s', 16, top + 53);
    ctx.font = F.label;
    ctx.fillStyle = ship.fa ? C.gate : C.amber;
    const assist = 'ASSIST ' + ['OFF', 'ROT', 'FULL'][ship.fa];
    ctx.fillText(assist, 84, top + 53);
    if (ship.nav && ship.nav.hold) {
      ctx.fillStyle = C.ok;
      ctx.fillText('HOLD', 84 + ctx.measureText(assist).width + 8, top + 53);
    }
    const active = game.missions.filter((m) => m.status === 'aktiv').length;
    if (active) {
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      ctx.fillText(active + ' JOB' + (active > 1 ? 'S' : ''), 8 + PW - 8, top + 53);
      ctx.textAlign = 'left';
    }
    if (ship.anchor) {
      ctx.fillStyle = C.ok;
      ctx.fillText('CABLE ' + ship.anchor.rope.length.toFixed(0) + ' M', 16, top + 67);
    }
    // Skadekart bare når noe er skadet.
    if (damaged) damageMap(ctx, ship, 8 + PW + 4, top + 6, 34, PH - 12);

    // Verktøylinje nederst på PC. På mobil er verktøyene knapper.
    if (!touch && !ship.docked) {
      const have = { laser: st.lasers.length, kanon: st.guns.length, rakett: st.rockets.length, anker: st.anchors.length };
      const tw = 84, gap = 6, total = RF.TOOLS.length * tw + (RF.TOOLS.length - 1) * gap;
      let x = w / 2 - total / 2;
      const y = h - 32;
      RF.TOOLS.forEach((t, i) => {
        const sel = ship.tool === t;
        panel(ctx, x, y, tw, 24, sel ? 0.95 : 0.55);
        ctx.font = F.label;
        ctx.fillStyle = !have[t] ? '#5a554a' : sel ? C.amber : C.text;
        let lbl = `${i + 1} ${RF.TOOL_NAMES[t].toUpperCase()}`;
        if (t === 'rakett' && have[t]) lbl += ` ${s.ammo}`;
        if (t === 'laser' && have[t]) lbl += ` T${st.maxTier}`;
        ctx.fillText(lbl, x + 10, y + 16);
        x += tw + gap;
      });
    }

    // Radar: liten, forstørres ved trykk.
    const rr = game.radarBig ? Math.min(120, Math.min(w, h) * 0.28) : 38;
    radar(ctx, game, w - rr - 12, top + rr + 4, rr);

    // Handlingshint.
    if (game.prompt) {
      ctx.font = F.title;
      const tw = ctx.measureText(game.prompt).width + 22;
      const py = touch ? h - 190 : h - 66;
      panel(ctx, w / 2 - tw / 2, py - 15, tw, 24, 0.9);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.amber;
      ctx.fillText(game.prompt, w / 2, py + 2);
      ctx.textAlign = 'left';
    }

    // Meldinger øverst på midten, små og korte.
    ctx.textAlign = 'center';
    ctx.font = F.title;
    const my = touch ? top + 96 : top + 18;
    game.messages.slice(-2).forEach((m, i) => {
      ctx.globalAlpha = Math.min(1, m.t) * 0.95;
      ctx.fillStyle = '#000';
      ctx.fillText(m.text, w / 2 + 1, my + i * 17 + 1);
      ctx.fillStyle = m.color || C.text;
      ctx.fillText(m.text, w / 2, my + i * 17);
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
