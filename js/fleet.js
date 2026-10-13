// Flåte, kjempeskip og tyngre pirater.
//   - Flåte (plan 12): kjøp eskortejagere og gruvelektere som følger deg.
//     Ordrer: følg, utvinn (lekteren skjærer stein og sender malmen over) og
//     forsvar (jagerne angriper pirater nær deg).
//   - Kjempeskipet (15): byen Hearthold seiler sakte rundt i Midgard. Man kan
//     dokke i hekken: marked, verft, flåte og mannskap.
//   - Tyngre pirater (38): kanonskip med fakler og nærforsvar, og en
//     piratbase i Muspelheim som sender ut raidere.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const F = (RF.Fleet = {});
  const game = () => RF.game;

  // ---------- Nye fartøytyper ----------
  const T = RF.NPC_TYPES, L = RF.NPC_LAYOUTS;
  L.escort = [['thruster', 0, 0], ['frame', 1, -1], ['cockpit', 1, 0], ['frame', 1, 1], ['cannon', 2, 0], ['rcs', 1, -2], ['rcs', 1, 2], ['armor', 2, -1], ['armor', 2, 1]];
  L.barge = [['thruster2', 0, -1], ['thruster2', 0, 1], ['cargo2', 1, -1], ['cockpit', 1, 0], ['cargo2', 1, 1], ['frame', 2, -1], ['laser2', 2, 0], ['frame', 2, 1], ['tractor', 3, 0], ['rcs', 2, -2], ['rcs', 2, 2]];
  L.gunship = [['thruster2', 0, -1], ['thruster2', 0, 1], ['frame', 1, -1], ['armor', 1, 0], ['frame', 1, 1], ['cannon', 2, -1], ['cockpit', 2, 0], ['cannon', 2, 1], ['armor', 3, 0], ['rcs', 2, -2], ['rcs', 2, 2], ['rocket', 1, -2], ['rocket', 1, 2]];
  L.pbase = [['cockpit', 0, 0], ['armor', 1, 0], ['armor', -1, 0], ['armor', 0, 1], ['armor', 0, -1], ['armor', 1, 1], ['armor', -1, 1], ['armor', 1, -1], ['armor', -1, -1],
    ['cannon', 2, 0], ['cannon', -2, 0], ['cannon', 0, 2], ['cannon', 0, -2], ['shield', 2, 1], ['shield', -2, -1], ['fuel', 2, -1], ['fuel', -2, 1]];
  T.escort = { name: 'Escort', mass: 6000, thrust: 260e3, torque: 0.7e6, hull: 120, maxSpeed: 46, fleet: true, range: 110, gun: { cd: 0.45, speed: 170, mass: 2.2, pow: 0.9 } };
  T.barge = { name: 'Mining barge', mass: 16000, thrust: 420e3, torque: 1.6e6, hull: 200, maxSpeed: 34, fleet: true, scale: 0.9 };
  T.gunship = { name: 'Gunship', mass: 20000, thrust: 560e3, torque: 2.4e6, hull: 330, maxSpeed: 36, hostile: true, bounty: 1800,
    range: 150, gun: { cd: 0.32, speed: 175, mass: 4, pow: 1.2 } };
  T.pbase = { name: 'Raider base', mass: 6e6, thrust: 1, torque: 1, hull: 1600, maxSpeed: 0, hostile: true, bounty: 15000, static: true,
    range: 500, gun: { cd: 0.28, speed: 190, mass: 6, pow: 1.4 }, scale: 2.4 };

  F.TYPES = {
    escort: { name: 'Escort fighter', short: 'Escort', cost: 18000, desc: 'A small, fast gunship. On Defend it attacks raiders near you.' },
    barge: { name: 'Mining barge', short: 'Barge', cost: 24000, desc: 'Cuts rocks with a heavy laser and sends the ore over to your hold.' },
  };
  F.ORDERS = { follow: 'Follow', mine: 'Mine', defend: 'Defend' };
  F.MAX = 3;
  const list = () => RF.Career.get().fleet;

  // ---------- Kjøp og ordrer ----------
  F.buy = (type) => {
    const g = game(), D = F.TYPES[type];
    if (list().length >= F.MAX) { g.msg(`Your fleet is full (${F.MAX} ships)`, RF.HUD_COLORS.amber); return; }
    if (g.credits < D.cost) { g.msg('Not enough credits', RF.HUD_COLORS.amber); return; }
    g.credits -= D.cost;
    const n = list().length + 1;
    list().push({ type, name: `${D.short} ${['Alpha', 'Bravo', 'Charlie'][n - 1] || n}`, order: type === 'barge' ? 'mine' : 'defend' });
    g.msg(`${D.name} joined your fleet`, RF.HUD_COLORS.ok);
  };
  F.sell = (i) => { const g = game(), m = list()[i]; if (!m) return; list().splice(i, 1); g.credits += Math.round(F.TYPES[m.type].cost * 0.6); despawnAll(); };
  F.setOrder = (i, o) => { const m = list()[i]; if (m) m.order = o; };
  F.cycleAll = () => {
    const g = game(), L2 = list();
    if (!L2.length) { g.msg('You have no fleet. Buy ships under Fleet at a station', RF.HUD_COLORS.amber); return; }
    const keys = Object.keys(F.ORDERS), next = keys[(keys.indexOf(L2[0].order) + 1) % keys.length];
    for (const m of L2) m.order = next;
    g.msg(`Fleet order: ${F.ORDERS[next]}`, RF.HUD_COLORS.gate);
  };

  // Fanen på stasjonen.
  F.tab = (st, esc, kr) => {
    const L2 = list();
    const ships = L2.length ? L2.map((m, i) => `<li class="mission"><div><b>${esc(m.name)}</b><span class="muted">${esc(F.TYPES[m.type].name)}</span></div>
      <div class="m-side">${Object.keys(F.ORDERS).map((o) => `<button class="btn sm ${m.order === o ? 'primary' : 'ghost'}" data-act="forder" data-id="${i}:${o}">${F.ORDERS[o]}</button>`).join('')}
      <button class="btn sm ghost" data-act="fsell" data-id="${i}">Sell · ${kr(Math.round(F.TYPES[m.type].cost * 0.6))}</button></div></li>`).join('') : '<li class="muted small">No ships yet.</li>';
    const shop = Object.keys(F.TYPES).map((k) => `<li class="mission"><div><b>${esc(F.TYPES[k].name)}</b><span class="muted">${esc(F.TYPES[k].desc)}</span></div>
      <div class="m-side"><span class="num reward">${kr(F.TYPES[k].cost)}</span><button class="btn sm primary" data-act="fbuy" data-id="${k}" ${L2.length >= F.MAX ? 'disabled' : ''}>Buy</button></div></li>`).join('');
    return `<p class="small">Up to ${F.MAX} ships fly with you. Give orders here, or in flight with Fleet in the More menu (key <kbd>,</kbd>), which switches the order for the whole fleet.</p>
      <h3>Your fleet</h3><ul class="missions">${ships}</ul><h3>For sale</h3><ul class="missions">${shop}</ul>`;
  };

  // ---------- Flåten i rommet ----------
  const live = new Map(); // indeks i lista -> NPC
  function despawnAll() {
    for (const n of live.values()) { n.despawn(); n.sys.npcs = n.sys.npcs.filter((x) => x !== n); }
    live.clear();
  }
  F.reset = () => despawnAll();

  function sync(g) {
    const L2 = list();
    // Skip i et annet system (etter porten) eller som ikke finnes lenger.
    for (const [i, n] of [...live]) {
      if (n.sys !== g.sys || !L2[i] || L2[i]._n !== n) { n.despawn(); n.sys.npcs = n.sys.npcs.filter((x) => x !== n); live.delete(i); }
    }
    // Nye skip settes ut først når du er ute i rommet.
    if (g.ship.docked || g.dead || g.landing) return;
    L2.forEach((m, i) => {
      if (live.has(i)) return;
      const n = new RF.NPC(m.type, g.sys);
      n.fleet = m; n.name = m.name; m._n = n;
      n.pal = null;
      const sb = g.ship.body, a = sb.a + Math.PI + (i - 1) * 0.5, r = sb.radius + n.body.radius + 30 + i * 25;
      n.spawnAt(sb.x + Math.cos(a) * r, sb.y + Math.sin(a) * r, sb.a, sb.vx, sb.vy);
      n.safeUntil = g.time + 3;
      n.state = 'fleet';
      g.sys.npcs.push(n);
      live.set(i, n);
    });
  }

  F.update = (n, dt, g) => {
    const m = n.fleet, b = n.body, sb = g.ship.body, i = list().indexOf(m);
    n.beams = [];
    // Plass i formasjonen bak skipet (eller ved stasjonen når du er dokket).
    const anchor = g.ship.docked ? g.sys.station : sb;
    const back = anchor.a + Math.PI + (i - 1) * 0.55;
    const R0 = (g.ship.docked ? 260 : 45 + sb.radius) + i * 22;
    const fx = anchor.x + Math.cos(back) * R0, fy = anchor.y + Math.sin(back) * R0;
    const avx = anchor.vx || 0, avy = anchor.vy || 0;
    if (m.order === 'defend' || n.type === 'escort') {
      // Nærmeste pirat innen 600 m fra deg.
      let tgt = null, td = 600;
      for (const p of g.sys.npcs) {
        if (!p.T.hostile || !p.active || p.dead) continue;
        const d = Math.hypot(p.body.x - sb.x, p.body.y - sb.y);
        if (d < td) { td = d; tgt = p; }
      }
      if (tgt && (m.order === 'defend' || td < 250)) { attack(n, tgt, dt, g); return; }
    }
    if (m.order === 'mine' && n.type === 'barge' && !g.ship.docked) { mine(n, dt, g); return; }
    n.steer(dt, fx, fy, avx, avy, anchor.a, n.T.maxSpeed);
  };

  function attack(n, tgt, dt, g) {
    const b = n.body, t = tgt.body, T2 = n.T;
    n.orbA = (n.orbA || Math.random() * 6) + dt * 0.5;
    const R = T2.range || 110;
    const dx = t.x - b.x, dy = t.y - b.y, dist = Math.hypot(dx, dy) || 1;
    const gun = T2.gun || { cd: 0.5, speed: 160, mass: 2, pow: 0.8 };
    const tt = dist / gun.speed;
    const aimA = Math.atan2(dy + (t.vy - b.vy) * tt, dx + (t.vx - b.vx) * tt);
    n.steer(dt, t.x + Math.cos(n.orbA) * R, t.y + Math.sin(n.orbA) * R, t.vx, t.vy, dist < 400 ? aimA : null, T2.maxSpeed);
    n.gunCd = (n.gunCd || 0) - dt;
    if (dist < 380 && n.gunCd <= 0 && Math.abs(G.wrapAngle(aimA - b.a)) < 0.15) {
      n.gunCd = gun.cd * G.rand(0.8, 1.2);
      const nose = b.toWorld(n.noseX + 0.6, 0), d = b.dirWorld(1, 0);
      RF.Weapons.shoot({ x: nose.x, y: nose.y, vx: b.vx + d.x * gun.speed, vy: b.vy + d.y * gun.speed, mass: gun.mass, pow: gun.pow, owner: b, color: '130,220,255' }, g);
      RF.Audio.gun(0.3 * RF.Audio.near(nose.x, nose.y, 700));
    }
  }

  // Lekteren: legger seg ved en myk stein nær deg og skjærer i den. Løse
  // malmbiter nær lekteren sendes over til lasterommet ditt.
  function mine(n, dt, g) {
    const b = n.body, sb = g.ship.body;
    let t = n._rock;
    if (!t || t.dead || t.kind !== 'rock' || Math.hypot(t.x - sb.x, t.y - sb.y) > 900) {
      t = null; let bd = 900;
      for (const o of g.sys.world.bodies) {
        if (o.kind !== 'rock' || o.dead || !o.vox || o.radius < 5 || o.radius > 40) continue;
        if (RF.MATERIALS[o.mat].hard > 2) continue;
        const d = Math.hypot(o.x - sb.x, o.y - sb.y);
        if (d < bd) { bd = d; t = o; }
      }
      n._rock = t;
    }
    if (!t) { n.steer(dt, sb.x - 80, sb.y - 80, sb.vx, sb.vy, null, n.T.maxSpeed); return; }
    const dx = b.x - t.x, dy = b.y - t.y, d = Math.hypot(dx, dy) || 1;
    const stand = t.radius + n.noseX + 14;
    const px = t.x + (dx / d) * stand, py = t.y + (dy / d) * stand;
    const face = Math.atan2(t.y - b.y, t.x - b.x);
    n.steer(dt, px, py, t.vx, t.vy, face, 22);
    if (d < stand + 10 && Math.abs(G.wrapAngle(face - b.a)) < 0.2) {
      const o = b.toWorld(n.noseX, 0), dir = b.dirWorld(1, 0);
      const hit = g.sys.world.raycast(o.x, o.y, dir.x, dir.y, 60, (x) => x === t);
      if (hit) {
        RF.Vox.beam(t, hit, dir, 1.8, 2, dt, g);
        n.beams.push({ lx: n.noseX / (n.scale || 1), ly: 0, a: 0, len: hit.t / (n.scale || 1), hit, color: '255,120,70', w: 0.5 });
      }
    }
    // Malm nær lekteren sendes over.
    n._xfer = (n._xfer || 0) + dt;
    if (n._xfer > 0.5) {
      n._xfer = 0;
      for (const o of g.sys.world.bodies) {
        if (o.kind !== 'ore' || o.dead) continue;
        if (Math.hypot(o.x - b.x, o.y - b.y) > 45) continue;
        if (g.ship.holdFree() - g.ship.procProduct() <= 0.02) break;
        o._tractorFrom = sb;
        g.tryIntake(o);
      }
    }
  }

  // ---------- Kjempeskipet ----------
  RF.CITY = { id: 'c:midgard', name: 'Hearthold', world: 'Hearthold', kind: 'City ship', isCity: true, R: 70, x: 0, y: 0, a: 0,
    blurb: 'A flying city of 200 000 people. It sails slowly around Midgard and is home to the biggest shipyard and fleet office in the systems.',
    prices: { jern: 1.25, nikkel: 1.25, kobber: 1.2, titan: 1.3, gull: 1.2, vann: 1.3, silisium: 1.2, gass: 1.2, naquadah: 1.15 } };
  {
    const sbi = RF.stationById;
    RF.stationById = (id) => (id === RF.CITY.id ? { id: 'midgard', name: 'Midgard', station: RF.CITY, city: true } : sbi(id));
  }
  L.city = RF.HULLS.ark ? RF.HULLS.ark.layout.map((r) => r.slice()) : L.hauler;
  T.city = { name: 'Hearthold', mass: 4e7, thrust: 1, torque: 1, hull: 1e9, maxSpeed: 4, scale: (RF.HULLS.ark ? RF.HULLS.ark.scale : 1) * 1.6 };
  F.cityNpc = null;
  function updateCity(dt, g) {
    if (g.sys.def.id !== 'midgard') return;
    let n = g.sys._city;
    if (!n) {
      n = g.sys._city = new RF.NPC('city', g.sys);
      n.name = 'Hearthold'; n.city = true; n.state = 'city'; n.pal = null;
      const st = g.sys.station;
      // Banen går godt unna stasjonen og asteroidefeltene.
      n.cx = st.x - 3800; n.cy = st.y + 2000; n.cr = 1200; n.ca = Math.random() * 6.28;
      n.spawnAt(n.cx + Math.cos(n.ca) * n.cr, n.cy + Math.sin(n.ca) * n.cr, n.ca + Math.PI / 2, 0, 0);
      g.sys.npcs.push(n);
    }
    // Seiler rundt en stor sirkel, sakte (3 m/s).
    const b = n.body, w = 3 / n.cr;
    n.ca += w * dt;
    const tx = n.cx + Math.cos(n.ca) * n.cr, ty = n.cy + Math.sin(n.ca) * n.cr;
    b.vx = (tx - b.x) * 0.5 + -Math.sin(n.ca) * 3; b.vy = (ty - b.y) * 0.5 + Math.cos(n.ca) * 3;
    b.a = n.ca + Math.PI / 2; b.w = 0;
    // Dokkingsringen sitter bak hekken.
    const back = b.toWorld(-(b.radius * 0.95) / (n.scale || 1) * 0 - 0, 0);
    const aft = { x: b.x - Math.cos(b.a) * (b.radius + 40), y: b.y - Math.sin(b.a) * (b.radius + 40) };
    Object.assign(RF.CITY, { x: aft.x, y: aft.y, a: b.a + Math.PI, vx: b.vx, vy: b.vy });
    void back;
  }
  F.cityHere = () => game().sys.def.id === 'midgard' && game().sys._city;

  // ---------- Pirater: kanonskip og base ----------
  F.updateBase = (n, dt, g) => {
    const b = n.body, sb = g.ship.body;
    b.vx = 0; b.vy = 0; b.w = 0;
    if (n.home) { b.x = n.home.x; b.y = n.home.y; }
    const dx = sb.x - b.x, dy = sb.y - b.y, dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    b.a += G.clamp(G.wrapAngle(want - b.a), -0.9 * dt, 0.9 * dt);
    n.gunCd = (n.gunCd || 0) - dt;
    const gun = n.T.gun;
    if (!g.ship.docked && dist < n.T.range && n.gunCd <= 0 && Math.abs(G.wrapAngle(want - b.a)) < 0.3) {
      n.gunCd = gun.cd;
      for (const side of [-1, 1]) {
        const nose = b.toWorld(n.noseX / (n.scale || 1), side * 2), d = b.dirWorld(1, 0);
        RF.Weapons.shoot({ x: nose.x, y: nose.y, vx: d.x * gun.speed, vy: d.y * gun.speed, mass: gun.mass, pow: gun.pow, owner: b, color: '255,110,80' }, g);
      }
      RF.Audio.gun(0.4 * RF.Audio.near(b.x, b.y, 900));
    }
    // Sender ut raidere når du er i nærheten.
    n.raidT = (n.raidT == null ? 20 : n.raidT) - dt;
    if (dist < 1800 && n.raidT <= 0 && RF.Pirates.active(g).length < 4) {
      n.raidT = G.rand(60, 90);
      RF.Pirates.spawn(g, 30000);
      g.msg('The raider base launches fighters!', RF.HUD_COLORS.danger);
    }
  };
  function updateBaseSpawn(dt, g) {
    if (g.sys.def.id !== 'muspel') return;
    const sys = g.sys;
    if (sys._base && !sys._base.dead && sys.npcs.includes(sys._base)) return;
    sys._baseT = (sys._baseT == null ? 0 : sys._baseT) - dt;
    if (sys._baseT > 0) return;
    sys._baseT = 1200;
    const f = sys.def.fields[1] || sys.def.fields[0];
    const n = new RF.NPC('pbase', sys);
    n.name = 'Raider base'; n.state = 'attack';
    n.home = { x: f.cx - 200, y: f.cy - 650 };
    n.spawnAt(n.home.x, n.home.y, 0, 0, 0);
    sys.npcs.push(n);
    sys._base = n;
  }
  // Kanonskipet slipper fakler mot rakettene dine og skyter dem ned.
  function pirateDefense(dt, g) {
    const W = RF.Weapons;
    for (const n of g.sys.npcs) {
      if (n.type !== 'gunship' || !n.active || n.dead) continue;
      n.flareCd = (n.flareCd || 0) - dt; n.pdCd = (n.pdCd || 0) - dt;
      for (const p of W.list) {
        if (p.type !== 'rocket' || p.hostile || p.dead) continue;
        const d = Math.hypot(p.x - n.body.x, p.y - n.body.y);
        if (d < 260 && n.flareCd <= 0 && (n.flares == null ? (n.flares = 3) : n.flares) > 0) {
          n.flares--; n.flareCd = 2;
          for (let i = 0; i < 3; i++) {
            const a = n.body.a + Math.PI + G.rand(-1.2, 1.2), sp = G.rand(10, 22);
            W.list.push({ type: 'flare', pirate: true, x: n.body.x, y: n.body.y, vx: n.body.vx + Math.cos(a) * sp, vy: n.body.vy + Math.sin(a) * sp, heat: 3, life: 5 });
          }
        }
        if (d < 160 && n.pdCd <= 0) {
          n.pdCd = 0.12;
          if (Math.random() < 0.12) { p.dead = true; g.particles.burst(p.x, p.y, 14, { type: 'glow', sMin: 5, sMax: 25, color: '#ffb050', zMin: 0.2, zMax: 0.5, lMin: 0.2, lMax: 0.5 }); }
        }
      }
    }
  }

  F.tick = (dt, g) => {
    sync(g);
    updateCity(dt, g);
    updateBaseSpawn(dt, g);
    pirateDefense(dt, g);
  };
})();
