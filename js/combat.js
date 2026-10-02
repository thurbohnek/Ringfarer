// Kamp: målsøking for raketter (varmesøkende), lås på mål, nærforsvar som
// skyter ned missiler og droner, og fakler som lurer fiendens søkere.
// Alt virker ut fra hva skipet har montert:
//   rakettkaster  -> varmesøkende raketter (missilbatteriet har bedre søker)
//   ildleder      -> låser raskere og lenger unna, tårnene sikter foran målet
//   nærforsvar    -> skyter selv på missiler og stikkere innen rekkevidde
//   fakkelkaster  -> slipper fakler når et fiendtlig missil kommer nær
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const C = (RF.Combat = {});

  C.lock = { target: null, t: 0, tone: 0, was: false };
  C.flareCd = 0;
  C.warned = new Set();

  C.reset = () => { C.lock = { target: null, t: 0, tone: 0, was: false }; C.flareCd = 0; C.warned = new Set(); };

  const hostiles = (game) => game.sys.npcs.filter((n) => n.T.hostile && n.active && !n.dead);

  // Hvor varm noe er for en varmesøker. Motoren på full kraft lyser mest.
  C.heatOf = (o) => {
    if (o.type === 'flare') return o.heat;
    const fx = o.npc ? o.npc.fx : o.ship ? o.ship.fx : null;
    return 0.5 + (fx ? fx.main * 0.8 + fx.retro * 0.3 : 0);
  };

  C.locked = (game) => {
    const L = C.lock, st = game.ship.stats;
    return !!(L.target && !L.target.dead && L.target.active && st.seek && L.t >= st.seek.time);
  };

  // Søkeren velger det varmeste i synsfeltet foran seg (varme delt på avstand).
  // Hver fakkel får én sjanse til å lure et missil.
  function pickHeat(p, game) {
    const hx = p.dx, hy = p.dy;
    const cands = [];
    if (p.hostile) {
      const sh = game.ship;
      if (!sh.docked && !game.dead) cands.push(sh.body);
      for (const f of RF.Weapons.list) if (f.type === 'flare' && !f.dead) cands.push(f);
    } else {
      for (const n of hostiles(game)) cands.push(n.body);
    }
    let best = null, bs = 0;
    for (const o of cands) {
      const dx = o.x - p.x, dy = o.y - p.y, d = G.len(dx, dy) || 1;
      if (d > 900) continue;
      const cur = o === p.target;
      // Uten lås ser søkeren bare rett fram.
      const cone = cur ? 1.5 : p.hostile || p.locked ? 1 : 0.4;
      if ((dx * hx + dy * hy) / d < Math.cos(cone)) continue;
      if (o.type === 'flare') {
        p.seen = p.seen || [];
        if (!p.seen.includes(o)) { p.seen.push(o); if (Math.random() < 0.7) o.fools = (o.fools || []).concat([p]); }
        if (!(o.fools && o.fools.includes(p))) continue;
      }
      const sc = (C.heatOf(o) / (d + 40)) * (cur ? 1.3 : 1);
      if (sc > bs) { bs = sc; best = o; }
    }
    return best;
  }

  // Styring i rommet: ingen vinger, så raketten snur seg og skyver dit den
  // relative farten mot målet skal endres (sikter mot der målet vil være).
  C.guide = (p, dt, game) => {
    p.retT = (p.retT || 0) - dt;
    if (p.retT <= 0) {
      p.retT = 0.2;
      const alt = pickHeat(p, game);
      const keep = p.target && !p.target.dead && p.target.type !== 'flare';
      // En låst rakett holder på målet sitt så lenge det lever, med mindre en
      // fakkel lurer den. Ellers tar søkeren det varmeste den ser.
      if (p.locked && keep) { if (alt && alt.type === 'flare') p.target = alt; }
      else if (alt) p.target = alt;
      else if (p.target && p.target.dead) p.target = null;
    }
    const t = p.target;
    let ax = p.dx, ay = p.dy;
    if (t && !t.dead) {
      const rx = t.x - p.x, ry = t.y - p.y, d = G.len(rx, ry) || 1;
      const rvx = (t.vx || 0) - p.vx, rvy = (t.vy || 0) - p.vy;
      const closing = Math.max(25, -(rx * rvx + ry * rvy) / d);
      const tt = Math.min(4, d / closing);
      const lx = rx + rvx * tt, ly = ry + rvy * tt, ll = G.len(lx, ly) || 1;
      // Ønsket fart i forhold til målet: rett mot treffpunktet.
      const wx = (lx / ll) * 160 + rvx, wy = (ly / ll) * 160 + rvy;
      const wl = G.len(wx, wy);
      if (wl > 1) { ax = wx / wl; ay = wy / wl; }
      const r = (t.radius || 1.5) + 2.5;
      if (d < r && p.arm <= 0) p.fuse = true;
      if (t.type === 'flare' && d < 6) p.fuse = true;
    }
    // Snu nesen mot ønsket retning, med begrenset dreiefart.
    const cur = Math.atan2(p.dy, p.dx), want = Math.atan2(ay, ax);
    const na = cur + G.clamp(G.wrapAngle(want - cur), -p.turn * dt, p.turn * dt);
    p.dx = Math.cos(na); p.dy = Math.sin(na);
    p.burn -= dt;
    // Uten mål flyr den rett fram som før (til 140 m/s), med mål brenner den ut.
    if (p.burn > 0 && (t || G.len(p.vx, p.vy) < 140)) { p.vx += p.dx * 75 * dt; p.vy += p.dy * 75 * dt; }
  };

  // Lås: hold siktet på en pirat med raketter valgt. Tonen går fortere til
  // den ligger fast når låsen er klar.
  function updateLock(dt, game, hold) {
    const ship = game.ship, st = ship.stats, L = C.lock, sb = ship.body;
    const aim = game.aim;
    // Hvilken pirat siktet er nærmest (for ildlederen også).
    let best = null, bd = Infinity;
    for (const n of hostiles(game)) {
      const b = n.body;
      const da = G.len(b.x - aim.x, b.y - aim.y) - b.radius;
      const dist = G.len(b.x - sb.x, b.y - sb.y);
      const ang = Math.abs(G.wrapAngle(Math.atan2(b.y - sb.y, b.x - sb.x) - Math.atan2(aim.y - sb.y, aim.x - sb.x)));
      const sc = Math.min(da, ang * dist);
      if (sc < bd) { bd = sc; best = { n, dist, ok: da < 60 || ang < 0.25 }; }
    }
    ship.lead = best && best.ok && best.dist < 900 ? best.n.body : null;
    const can = ship.tool === 'rakett' && st.rockets.length && st.seek && ship.s.ammo > 0;
    const tgt = can && best && best.ok && best.dist < st.seek.lock ? best.n : null;
    if (tgt !== L.target) { L.target = tgt; L.t = 0; L.was = false; }
    if (!hold) L.shot = false;
    if (!tgt) return;
    L.t += dt;
    L.tone -= dt;
    const done = L.t >= st.seek.time;
    if (done && !L.was) { L.was = true; RF.Audio.blip(1250, 0.12, 'sine', 0.07); L.tone = 0.45; game.msg(`Locked on ${tgt.name}`, RF.HUD_COLORS.danger); }
    // Trykk og hold på piraten: raketten går av når låsen er klar.
    if (hold && done && !L.shot && ship.rocketCd <= 0) { L.shot = true; RF.Weapons.fireRocket(ship, game); }
    if (L.tone <= 0) {
      if (done) { RF.Audio.blip(1250, 0.06, 'sine', 0.04); L.tone = 0.45; }
      else { RF.Audio.blip(760, 0.04, 'sine', 0.04); L.tone = 0.16; }
    }
  }

  // Nærforsvaret: hvert tårn velger selv det farligste innen rekkevidde.
  function updatePD(dt, game) {
    const ship = game.ship, st = ship.stats, b = ship.body;
    if (!st.pds.length) return;
    const W = RF.Weapons;
    for (const pd of st.pds) {
      const m = pd.m;
      m._cd = Math.max(0, (m._cd || 0) - dt);
      const mp = ship.mountOf(m);
      const o = b.toWorld(mp.lx, mp.ly);
      const R = pd.range * Math.sqrt(b.s);
      // Fiendtlige missiler først, så stikkere, så raidere på kloss hold.
      let tgt = null, td = Infinity, isMis = false;
      for (const p of W.list) {
        if (p.type !== 'rocket' || !p.hostile || p.dead) continue;
        const d = G.len(p.x - o.x, p.y - o.y);
        if (d < R && d < td) { td = d; tgt = p; isMis = true; }
      }
      if (!tgt) {
        for (const n of hostiles(game)) {
          const d = G.len(n.body.x - o.x, n.body.y - o.y) * (n.type === 'stinger' ? 1 : 1.5);
          if (d < R && d < td) { td = d; tgt = n.body; }
        }
      }
      const cur = m.aimA != null ? m.aimA : mp.a;
      let want = mp.a;
      if (tgt) {
        const tt = td / 500;
        const al = b.toLocal(tgt.x + ((tgt.vx || 0) - b.vx) * tt, tgt.y + ((tgt.vy || 0) - b.vy) * tt);
        want = Math.atan2(al.y - mp.ly, al.x - mp.lx);
      }
      const diff = G.wrapAngle(want - mp.a);
      m.inArc = Math.abs(diff) <= RF.TURRET_ARC;
      const target = mp.a + G.clamp(diff, -RF.TURRET_ARC, RF.TURRET_ARC);
      m.aimA = cur + G.clamp(G.wrapAngle(target - cur), -9 * dt, 9 * dt);
      m.onTarget = !!tgt && m.inArc && Math.abs(G.wrapAngle(want - m.aimA)) < 0.1;
      if (!m.onTarget || m._cd > 0) continue;
      m._cd = 1 / pd.rate;
      const { p, d } = ship.muzzle(m, RF.CELL * 0.8);
      const v = b.pointVel(p.x, p.y);
      const a = Math.atan2(d.y, d.x) + G.rand(-0.03, 0.03);
      W.list.push({ type: 'shell', kind: 'pd', x: p.x, y: p.y, vx: v.x + Math.cos(a) * 500, vy: v.y + Math.sin(a) * 500, mass: 0.6, pow: 0.22, life: R / 480, owner: b });
      if (Math.random() < 0.5) RF.Audio.auto(0.35);
      // Et missil i lufta treffes med en viss sjanse per skudd.
      if (isMis && Math.random() < 0.16) {
        tgt.dead = true;
        game.particles.burst(tgt.x, tgt.y, 20, { type: 'glow', sMin: 5, sMax: 30, color: '#ffb050', zMin: 0.2, zMax: 0.5, lMin: 0.2, lMax: 0.5, vx: tgt.vx, vy: tgt.vy });
        game.particles.burst(tgt.x, tgt.y, 10, { type: 'smoke', sMin: 2, sMax: 6, color: '#6a645a', zMin: 1, zMax: 2, grow: 3, lMin: 0.8, lMax: 1.6 });
        RF.Audio.boom(0.35 * RF.Audio.near(tgt.x, tgt.y, 900));
        game.msg('Point defense shot down a missile', RF.HUD_COLORS.ok);
      }
    }
  }

  // Fakler: slippes av seg selv når et missil er på vei inn (eller med J).
  C.dropFlares = (game, manual) => {
    const ship = game.ship, s = ship.s, b = ship.body;
    if (!ship.stats.flareCap) { if (manual) game.msg('The ship has no flare launcher', RF.HUD_COLORS.amber); return false; }
    if ((s.flares || 0) <= 0) { if (manual) game.msg('Out of flares. Restock at a station', RF.HUD_COLORS.amber); return false; }
    if (C.flareCd > 0) return false;
    s.flares--;
    C.flareCd = 1.4;
    for (let i = 0; i < 3; i++) {
      const a = b.a + Math.PI + G.rand(-1.2, 1.2), sp = G.rand(10, 22);
      RF.Weapons.list.push({ type: 'flare', x: b.x + Math.cos(a) * b.radius * 0.6, y: b.y + Math.sin(a) * b.radius * 0.6, vx: b.vx + Math.cos(a) * sp, vy: b.vy + Math.sin(a) * sp, heat: 3, life: 5 });
    }
    RF.Audio.blip(320, 0.12, 'triangle', 0.08);
    game.msg(`Flares out (${s.flares} left)`, RF.HUD_COLORS.amber);
    return true;
  };

  function updateThreats(dt, game) {
    const ship = game.ship, b = ship.body;
    C.flareCd = Math.max(0, C.flareCd - dt);
    let close = false;
    for (const p of RF.Weapons.list) {
      if (p.type !== 'rocket' || !p.hostile || p.dead) continue;
      if (!C.warned.has(p)) { C.warned.add(p); game.msg('Missile incoming!', RF.HUD_COLORS.danger); RF.Audio.alarm(); }
      if (p.target === b && G.len(p.x - b.x, p.y - b.y) < 260) close = true;
    }
    if (close) C.dropFlares(game, false);
    if (C.warned.size > 30) C.warned = new Set([...C.warned].filter((p) => !p.dead));
  }

  C.update = (dt, game, hold) => {
    updateLock(dt, game, hold);
    updatePD(dt, game);
    updateThreats(dt, game);
  };

  // Piratene kan skyte varmesøkende missiler (farlige systemer har flere).
  C.enemyMissile = (n, game) => {
    const b = n.body;
    const nose = b.toWorld(n.noseX + 1, 0), d = b.dirWorld(1, 0);
    RF.Weapons.list.push({ type: 'rocket', hostile: true, x: nose.x, y: nose.y, vx: b.vx + d.x * 20, vy: b.vy + d.y * 20, dx: d.x, dy: d.y, life: 10, owner: b, arm: 0.4, pow: 0.6,
      seeker: true, target: game.ship.body, locked: true, turn: 1.9, burn: 7 });
    if (game.sys === n.sys) RF.Audio.rocket();
  };

  // Lås-symbol rundt målet og røde ringer rundt fiendtlige missiler.
  C.drawWorld = (ctx, game, px) => {
    const L = C.lock, t = game.time;
    if (L.target && L.target.active && !L.target.dead) {
      const b = L.target.body, st = game.ship.stats;
      const f = G.clamp(L.t / (st.seek ? st.seek.time : 1), 0, 1), done = f >= 1;
      const r = b.radius + 4 + (1 - f) * 10;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(done ? 0 : t * 2);
      ctx.strokeStyle = done ? 'rgba(255,80,60,0.95)' : 'rgba(255,190,80,0.85)';
      ctx.lineWidth = Math.max(0.2, px * (done ? 2.2 : 1.5));
      const k = r * 0.45;
      for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(r - k, -r); ctx.lineTo(r, -r); ctx.lineTo(r, -r + k); ctx.stroke();
      }
      ctx.restore();
      if (done) {
        ctx.save();
        ctx.translate(b.x, b.y + r + 12 * px);
        ctx.scale(px, px);
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,90,70,0.95)';
        ctx.fillText('LOCK', 0, 0);
        ctx.restore();
      }
    }
    for (const p of RF.Weapons.list) {
      if (p.type !== 'rocket' || !p.hostile || p.dead) continue;
      const on = Math.sin(t * 14) > 0;
      ctx.strokeStyle = on ? 'rgba(255,70,60,0.9)' : 'rgba(255,70,60,0.35)';
      ctx.lineWidth = Math.max(0.2, px * 1.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3, px * 9), 0, Math.PI * 2); ctx.stroke();
    }
  };
})();
