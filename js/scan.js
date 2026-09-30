// Skanner og verdi: hva en stein eller en løs bit består av, og hva
// mineralene i den er verdt. Skanneren (tasten N) sender ut en puls. Steiner
// pulsen når, viser hva de inneholder en stund (farget ring og merkelapp).
// Holder man musen over en bit (eller låser siktet på den), vises innholdet.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const Scan = (RF.Scan = {});

  Scan.SHOW = 45; // sekunder en skannet stein viser innholdet
  Scan.SPEED = 1100; // m/s for pulsen
  Scan.COOLDOWN = 3;

  // Pris per tonn produkt der man er nå (stasjonen i systemet).
  function price(game, prod) {
    const st = game.sys && game.sys.def && game.sys.def.station;
    try { if (st && game.sellPrice) return game.sellPrice(st.id, prod); } catch (_) { /* faller tilbake */ }
    return RF.PRODUCTS[prod].price;
  }

  // Innholdet i en bit: masse per materiale og hva mineralene er verdt.
  // Gråstein har ingen verdi (laseren fordamper den). Lagres til formen endres.
  Scan.composition = (b, game) => {
    const key = b.vox ? b.loops : b.mat;
    const c = b._comp;
    if (c && c.key === key && c.mass === b.mass && game.time - c.t < 5) return c;
    const MATS = RF.Vox.MATS;
    const w = {};
    if (b.vox) {
      const V = b.vox;
      for (let k = 0; k < V.f.length; k++) {
        if (V.f[k] < RF.Vox.TH) continue;
        const mk = MATS[V.m[k]];
        w[mk] = (w[mk] || 0) + RF.MATERIALS[mk].density;
      }
    } else w[b.mat] = 1;
    let tot = 0;
    for (const k in w) tot += w[k];
    const yieldMul = (game.ship && game.ship.stats.yield) || 1;
    const items = [];
    let value = 0;
    for (const k in w) {
      const M = RF.MATERIALS[k];
      const mass = (b.mass * w[k]) / (tot || 1);
      const v = M.stone ? 0 : (mass / 1000) * M.grade * yieldMul * price(game, M.product);
      value += v;
      items.push({ mat: k, name: M.name, mass, frac: w[k] / (tot || 1), value: v, stone: !!M.stone });
    }
    items.sort((a, c2) => c2.value - a.value || c2.mass - a.mass);
    const best = items.find((x) => !x.stone && x.value > 0) || null;
    return (b._comp = { key, mass: b.mass, t: game.time, items, value, best });
  };

  Scan.range = (ship) => ship.stats.scanRange || 700;

  Scan.pulse = (game) => {
    const ship = game.ship, b = ship.body;
    if (ship.docked) return;
    if (game.scan && game.time - game.scan.t0 < Scan.COOLDOWN) {
      game.msg('Scanner recharging', RF.HUD_COLORS.amber);
      return;
    }
    game.scan = { x: b.x, y: b.y, t0: game.time, R: Scan.range(ship), r: 0, found: 0, value: 0, done: false };
    RF.Audio.blip(880, 0.12, 'sine', 0.08);
    setTimeout(() => RF.Audio.blip(1320, 0.18, 'sine', 0.05), 120);
  };

  // Pulsen brer seg utover. Hver stein den passerer, blir skannet.
  Scan.update = (dt, game) => {
    const S = game.scan;
    if (!S || S.done) return;
    const r0 = S.r;
    S.r = Math.min(S.R, (game.time - S.t0) * Scan.SPEED);
    for (const o of game.sys.world.bodies) {
      if (o.dead || (o.kind !== 'rock' && o.kind !== 'ore')) continue;
      const d = G.len(o.x - S.x, o.y - S.y) - o.radius;
      if (d > S.r || d <= r0 - o.radius * 2) continue;
      if (o.scanT && game.time - o.scanT < 0.5) continue;
      o.scanT = game.time;
      if (o.kind === 'ore') continue;
      const c = Scan.composition(o, game);
      if (c.value > 1) { S.found++; S.value += c.value; }
    }
    if (S.r >= S.R) {
      S.done = true;
      game.msg(S.found ? `Scan: ${S.found} rock${S.found > 1 ? 's' : ''} with minerals, about ${Scan.fmtCr(S.value)}` : 'Scan: no minerals in range', S.found ? RF.HUD_COLORS.ok : RF.HUD_COLORS.amber);
    }
  };

  Scan.scanned = (o, game) => o.scanT != null && game.time - o.scanT < Scan.SHOW;

  Scan.fmtCr = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M cr' : v >= 1e4 ? Math.round(v / 1000) + 'k cr' : Math.round(v).toLocaleString('en-US') + ' cr');
  Scan.fmtMass = (kg) => (kg >= 1e6 ? (kg / 1e6).toFixed(1) + ' kt' : kg >= 1000 ? (kg / 1000).toFixed(kg < 1e4 ? 1 : 0) + ' t' : Math.round(kg) + ' kg');

  // Fargen på det mest verdifulle mineralet.
  Scan.colorOf = (mat) => {
    const M = RF.MATERIALS[mat];
    return (RF.PRODUCTS[M.product] && RF.PRODUCTS[M.product].color) || M.mark || M.vein || M.light;
  };

  // I verden (under lyset): pulsringen og en farget ring rundt skannede steiner.
  Scan.drawWorld = (ctx, game, px) => {
    const S = game.scan;
    if (S && !S.done) {
      const a = 1 - S.r / S.R;
      ctx.strokeStyle = `rgba(120,230,210,${0.15 + 0.5 * a})`;
      ctx.lineWidth = px * 3;
      ctx.beginPath(); ctx.arc(S.x, S.y, S.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = `rgba(120,230,210,${0.08 * a})`;
      ctx.lineWidth = px * 18;
      ctx.beginPath(); ctx.arc(S.x, S.y, Math.max(0, S.r - px * 10), 0, Math.PI * 2); ctx.stroke();
    }
    for (const o of game.sys.world.bodies) {
      if (o.dead || o.kind !== 'rock' || !Scan.scanned(o, game)) continue;
      const c = Scan.composition(o, game);
      if (!c.best) continue;
      const age = game.time - o.scanT, fade = Math.min(1, (Scan.SHOW - age) / 6);
      ctx.strokeStyle = Scan.colorOf(c.best.mat);
      ctx.globalAlpha = 0.5 * fade;
      ctx.lineWidth = px * 1.5;
      ctx.setLineDash([px * 6, px * 5]);
      ctx.beginPath(); ctx.arc(o.x, o.y, o.radius + px * 8, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  };

  // Trenger mineralet en sterkere laser enn skipet har?
  const needs = (mat, game) => {
    const hard = RF.MATERIALS[mat].hard, tier = game.ship.stats.maxTier || 0;
    return hard > tier ? ` · needs laser T${hard}` : '';
  };

  // En liten merkelapp: navn, masse, innhold og verdi.
  function label(ctx, x, y, lines, color, alpha) {
    ctx.font = '600 11px "Saira Condensed", "Arial Narrow", sans-serif';
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l.t).width);
    const h = lines.length * 14 + 6;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(12,11,9,0.78)';
    ctx.fillRect(x, y, w + 14, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 2, h);
    lines.forEach((l, i) => {
      ctx.fillStyle = l.c || '#e8e0cc';
      ctx.fillText(l.t, x + 8, y + 15 + i * 14);
    });
    ctx.globalAlpha = 1;
  }

  // Fart i forhold til skipet og hvor fort biten snurrer.
  function motion(o, game) {
    const sb = game.ship.body;
    const rv = G.len(o.vx - sb.vx, o.vy - sb.vy), spin = Math.abs(o.w) * 57.3;
    if (rv < 1 && spin < 3) return null;
    const hold = game.ship.nav && game.ship.nav.hold && game.ship.nav.body === o;
    return { t: `Moving ${rv.toFixed(1)} m/s · spin ${spin.toFixed(0)}°/s${rv > 2 && !hold ? ' · B to match' : ''}`, c: rv > 4 || spin > 12 ? '#e3a03a' : '#b8b09c' };
  }

  function describe(o, game, full) {
    const c = Scan.composition(o, game);
    const mv = o.kind === 'rock' ? motion(o, game) : null;
    const main = RF.MATERIALS[o.mat];
    const what = o.kind === 'ore' ? main.name : o.debris ? 'Loose rock' : o.comet ? 'Comet' : 'Asteroid';
    const lines = [{ t: `${what} · ${Scan.fmtMass(c.mass)}`, c: '#ffffff' }];
    if (o.kind === 'ore') {
      lines.push({ t: main.stone ? 'Plain rock, no value' : `Worth about ${Scan.fmtCr(c.value)}`, c: main.stone ? '#8f887a' : '#95c46a' });
      return { lines, color: main.stone ? '#8f887a' : Scan.colorOf(o.mat) };
    }
    if (mv) lines.push(mv);
    if (!full) {
      lines.push({ t: `${main.name}. Scan (N) to see minerals`, c: '#8f887a' });
      return { lines, color: '#8f887a' };
    }
    const minerals = c.items.filter((x) => !x.stone && x.frac >= 0.005);
    if (!minerals.length) lines.push({ t: `${main.name}, no minerals`, c: '#8f887a' });
    for (const x of minerals.slice(0, 3)) {
      lines.push({ t: `${x.name} ${Math.max(1, Math.round(x.frac * 100))} % · ${Scan.fmtCr(x.value)}${needs(x.mat, game)}`, c: Scan.colorOf(x.mat) });
    }
    if (minerals.length) lines.push({ t: `Total about ${Scan.fmtCr(c.value)}`, c: '#95c46a' });
    return { lines, color: c.best ? Scan.colorOf(c.best.mat) : '#8f887a' };
  }

  // På skjermen (i HUD-en): merkelapper ved skannede steiner, og en
  // merkelapp ved biten under musen eller den man har låst siktet på.
  Scan.drawHud = (ctx, R, game) => {
    const cam = game.cam, z = cam.zoom;
    const toS = (x, y) => ({ x: R.w / 2 + (x - cam.x) * z, y: R.h / 2 + (y - cam.y) * z });
    const hover = Scan.hoverBody(game);
    const shown = [];
    for (const o of game.sys.world.bodies) {
      if (o.dead || o.kind !== 'rock' || o === hover || !Scan.scanned(o, game)) continue;
      const c = Scan.composition(o, game);
      if (!c.best) continue;
      const p = toS(o.x, o.y);
      if (p.x < -50 || p.y < -50 || p.x > R.w + 50 || p.y > R.h + 50) continue;
      shown.push({ o, c, p });
    }
    shown.sort((a, b) => b.c.value - a.c.value);
    for (const s of shown.slice(0, 8)) {
      const age = game.time - s.o.scanT, fade = Math.min(1, (Scan.SHOW - age) / 6, age * 3);
      const r = s.o.radius * z + 10;
      const col = Scan.colorOf(s.c.best.mat);
      label(ctx, s.p.x + r * 0.7, s.p.y - r * 0.7 - 20, [
        { t: `${s.c.best.name} · ${Scan.fmtCr(s.c.value)}${needs(s.c.best.mat, game)}`, c: col },
      ], col, 0.9 * fade);
    }
    if (hover) {
      const p = toS(hover.x, hover.y);
      const sb = game.ship.body, rvx = hover.vx - sb.vx, rvy = hover.vy - sb.vy, rv = G.len(rvx, rvy);
      if (rv > 1 && hover.kind === 'rock') {
        // Pil: hvor biten er på vei i forhold til skipet (lengden viser farten).
        const r0 = hover.radius * z + 6, L = Math.min(90, 14 + rv * 7);
        const ux = rvx / rv, uy = rvy / rv;
        const x0 = p.x + ux * r0, y0 = p.y + uy * r0, x1 = x0 + ux * L, y1 = y0 + uy * L;
        ctx.strokeStyle = rv > 4 ? 'rgba(227,160,58,0.9)' : 'rgba(230,223,205,0.7)';
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + ux * 7, y1 + uy * 7); ctx.lineTo(x1 - uy * 5, y1 + ux * 5); ctx.lineTo(x1 + uy * 5, y1 - ux * 5); ctx.closePath(); ctx.fill();
      }
      const d = describe(hover, game, hover.kind !== 'rock' || hover.debris || Scan.scanned(hover, game));
      const r = hover.radius * z;
      label(ctx, Math.min(R.w - 190, p.x + r * 0.7 + 14), Math.max(40, p.y - r * 0.7 - 10), d.lines, d.color, 0.95);
    }
  };

  // Biten under musepekeren (PC), eller den man har låst siktet på.
  Scan.hoverBody = (game) => {
    const ship = game.ship;
    if (ship.docked || game.dead) return null;
    if (game.aimLock && !game.aimLock.body.dead) {
      const b = game.aimLock.body;
      return b.kind === 'rock' || b.kind === 'ore' ? b : null;
    }
    const P = RF.Input.pointer;
    if (!P.has || P.type !== 'mouse' || !game.pickBody || !game.aim) return null;
    const b = game.pickBody(game.aim.x, game.aim.y);
    return b && (b.kind === 'rock' || b.kind === 'ore') ? b : null;
  };
})();
