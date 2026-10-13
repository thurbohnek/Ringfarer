// Karrieren: alt som bygger seg opp over tid.
//   - markedet: prisene driver sakte, og salg/kjøp flytter dem (plan 4)
//   - kostnader: havneavgift ved dokking (11)
//   - rangering og titler (25), logg med statistikk (29)
//   - nasjoner med omdømme som gir bedre priser og oppdrag (13)
//   - mannskap med ferdigheter (26)
//   - historieoppdrag i flere steg (24)
//   - romvær: solstormer (34)
//   - vrak å berge og nødsignal med slep (23, 28)
//   - våpenvarme (39), tidsakselerasjon (33)
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const C = (RF.Career = {});
  const game = () => RF.game;

  // ---------- Tilstand ----------
  C.fresh = () => ({
    stats: { earned: 0, mined: 0, sold: 0, distance: 0, rocks: 0, pirates: 0, missions: 0, jumps: 0, landings: 0, salvaged: 0, rescues: 0, time: 0 },
    xp: 0, rep: { midgard: 0, vanaheim: 0, muspel: 0 },
    crew: [], story: { step: 0, count: 0 }, fleet: [], market: {},
  });
  C.get = () => { const g = game(); if (!g.career) g.career = C.fresh(); return g.career; };
  C.stat = (k, n = 1) => { const c = C.get(); c.stats[k] = (c.stats[k] || 0) + n; };

  // ---------- Rangering ----------
  C.RANKS = [
    [0, 'Rookie'], [400, 'Prospector'], [1500, 'Miner'], [4000, 'Veteran miner'], [10000, 'Hauler captain'],
    [25000, 'Commander'], [60000, 'Ringfarer'],
  ];
  C.rank = () => { const x = C.get().xp; let r = 0; for (let i = 0; i < C.RANKS.length; i++) if (x >= C.RANKS[i][0]) r = i; return r; };
  C.title = () => C.RANKS[C.rank()][1];
  C.addXp = (n) => {
    const before = C.rank();
    C.get().xp += n;
    const after = C.rank();
    if (after > before) {
      game().msg(`Promoted to ${C.RANKS[after][1]}! Better contracts pay ${after * 5} % more`, RF.HUD_COLORS.ok);
      RF.Audio.blip(660, 0.15, 'triangle', 0.1);
      setTimeout(() => RF.Audio.blip(990, 0.25, 'triangle', 0.09), 140);
    }
  };
  C.rewardMul = (placeId) => (1 + 0.05 * C.rank()) * (1 + C.rep(placeId) / 200);

  // ---------- Nasjoner ----------
  C.NATIONS = {
    midgard: { name: 'Midgard Union', color: '#5be3a6' },
    vanaheim: { name: 'Vanir Compact', color: '#4fd1ff' },
    muspel: { name: 'Surtr Combine', color: '#ff8a5c' },
  };
  C.nationOf = (placeId) => { const d = RF.stationById(placeId); return d ? d.id : 'midgard'; };
  C.rep = (placeId) => C.get().rep[C.nationOf(placeId)] || 0;
  C.repName = (r) => (r >= 80 ? 'Honored' : r >= 50 ? 'Trusted' : r >= 20 ? 'Friendly' : r <= -30 ? 'Hostile' : 'Neutral');
  C.addRep = (nation, n) => {
    const c = C.get();
    const before = C.repName(c.rep[nation] || 0);
    c.rep[nation] = G.clamp((c.rep[nation] || 0) + n, -100, 100);
    const after = C.repName(c.rep[nation]);
    if (after !== before) game().msg(`${C.NATIONS[nation].name}: you are now ${after}`, C.NATIONS[nation].color);
  };
  // Prisfordel: opptil 8 % bedre ved høyt omdømme.
  C.priceMul = (placeId) => 1 + 0.08 * (C.rep(placeId) / 100);

  // ---------- Markedet ----------
  // Hver vare har en faktor rundt 1 per handelssted. Den driver sakte (tilfeldig,
  // men trekkes mot 1), og det man selger mye av, blir billigere en stund.
  C.factor = (placeId, prod) => {
    const m = C.get().market;
    const f = m[placeId] && m[placeId][prod];
    return f == null ? 1 : f;
  };
  function driftMarket(dt) {
    const c = C.get();
    c._mt = (c._mt || 0) + dt;
    if (c._mt < 5) return;
    const k = c._mt / 60; c._mt = 0;
    for (const id of RF.placeIds()) {
      const m = c.market[id] || (c.market[id] = {});
      for (const p in RF.PRODUCTS) {
        let f = m[p] == null ? G.rand(0.9, 1.1) : m[p];
        f += (1 - f) * 0.15 * k + G.rand(-0.06, 0.06) * Math.sqrt(k);
        m[p] = G.clamp(f, 0.55, 1.7);
      }
    }
    // Av og til: mangel eller overflod et sted.
    if (Math.random() < 0.004) {
      const id = G.pick(RF.placeIds()), p = G.pick(Object.keys(RF.PRODUCTS));
      const up = Math.random() < 0.6;
      c.market[id][p] = up ? 1.6 : 0.6;
      game().msg(`Market news: ${up ? 'shortage' : 'glut'} of ${RF.PRODUCTS[p].name.toLowerCase()} at ${RF.stationName(id)}`, RF.HUD_COLORS.gate);
    }
  }
  C.onSell = (placeId, prod, tonnes, cr) => {
    const m = C.get().market[placeId] || (C.get().market[placeId] = {});
    m[prod] = G.clamp((m[prod] || 1) * (1 - Math.min(0.3, tonnes / 120)), 0.55, 1.7);
    C.stat('sold', tonnes); C.stat('earned', cr);
    C.addXp(cr / 100);
    C.addRep(C.nationOf(placeId), Math.min(3, cr / 4000));
  };
  C.onBuy = (placeId, prod, tonnes) => {
    const m = C.get().market[placeId] || (C.get().market[placeId] = {});
    m[prod] = G.clamp((m[prod] || 1) * (1 + Math.min(0.2, tonnes / 150)), 0.55, 1.7);
  };
  C.trend = (placeId, prod) => { const f = C.factor(placeId, prod); return f > 1.08 ? 'up' : f < 0.92 ? 'down' : ''; };

  C.missionDone = (m, placeId) => {
    C.stat('missions'); C.stat('earned', m.reward || 0);
    C.addXp(50 + (m.reward || 0) / 80);
    C.addRep(C.nationOf(placeId || m.to), 5);
  };

  // ---------- Dokking: avgift, lønn, historie ----------
  C.dockFee = (ship, place) => Math.round((5 + (ship.dryMass / 1000) * 0.04) * (place && place.isPort ? 1.5 : 1));
  C.onDock = (place) => {
    const g = game(), ship = g.ship, c = C.get();
    const fee = C.dockFee(ship, place);
    const wages = c.crew.reduce((a, m) => a + m.wage, 0);
    const pay = Math.min(g.credits, fee + wages);
    g.credits -= pay;
    if (pay > 0) g.msg(`Docking fee ${fee} cr${wages ? ` · crew wages ${wages} cr` : ''}`, RF.HUD_COLORS.muted);
    if (place.isPort) C.stat('landings');
    C.story.event('dock', place.id);
    C.salvageCheck(true);
    // Nye folk å ansette på dette stedet.
    if (!c.hire || c.hire.at !== place.id) c.hire = { at: place.id, list: [0, 1, 2].map(() => C.newCrew()) };
  };

  // ---------- Mannskap ----------
  C.ROLES = {
    pilot: { name: 'Pilot', what: 'Turns and maneuvers faster' },
    engineer: { name: 'Engineer', what: 'Repairs modules in flight and cools the weapons' },
    geologist: { name: 'Geologist', what: 'Scans further and gets more out of the ore' },
    gunner: { name: 'Gunner', what: 'Guns fire faster and rockets lock sooner' },
  };
  const FIRST = ['Ada', 'Bram', 'Cira', 'Dov', 'Eira', 'Fenn', 'Gry', 'Halv', 'Isa', 'Joar', 'Kaia', 'Lenn', 'Mira', 'Nils', 'Oda', 'Per', 'Runa', 'Siv', 'Tor', 'Una', 'Vidar', 'Yrsa'];
  const LAST = ['Holm', 'Strand', 'Berg', 'Lie', 'Vik', 'Dahl', 'Moe', 'Sand', 'Aas', 'Lund', 'Haug', 'Bakke', 'Rud', 'Foss'];
  C.newCrew = () => {
    const role = G.pick(Object.keys(C.ROLES)), skill = G.pick([1, 1, 2, 2, 3]);
    return { name: G.pick(FIRST) + ' ' + G.pick(LAST), role, skill, wage: 20 + skill * 25 + G.randInt(0, 15) };
  };
  C.crewCap = (ship) => 2 + Math.floor((ship.stats.pax || 0) / 4);
  C.hire = (i) => {
    const g = game(), c = C.get(), h = c.hire && c.hire.list[i];
    if (!h) return;
    if (c.crew.length >= C.crewCap(g.ship)) { g.msg('No free bunks. Fit a passenger cabin for more crew', RF.HUD_COLORS.amber); return; }
    const fee = h.wage * 5;
    if (g.credits < fee) { g.msg('Not enough credits for the signing fee', RF.HUD_COLORS.amber); return; }
    g.credits -= fee;
    c.crew.push(h);
    c.hire.list.splice(i, 1);
    g.ship.refreshStats();
    g.msg(`${h.name} (${C.ROLES[h.role].name}) joined the crew`, RF.HUD_COLORS.ok);
  };
  C.fire = (i) => { const c = C.get(); const m = c.crew.splice(i, 1)[0]; if (m) { game().ship.refreshStats(); game().msg(`${m.name} left the crew`, RF.HUD_COLORS.muted); } };
  // Ferdighetene virker på skipets verdier (kalles fra Ship.refreshStats).
  C.applyCrew = (st) => {
    const g = game(); if (!g || !g.career) return;
    for (const m of g.career.crew) {
      const k = m.skill;
      if (m.role === 'pilot') { st.torque *= 1 + 0.12 * k; st.strafe *= 1 + 0.08 * k; }
      else if (m.role === 'geologist') { st.scanRange *= 1 + 0.25 * k; st.yield += 0.05 * k; }
      else if (m.role === 'gunner') { st.gunRateMul = (st.gunRateMul || 1) * (1 + 0.08 * k); if (st.seek) st.seek.time *= 1 - 0.1 * k; }
      else if (m.role === 'engineer') { st.repairRate = (st.repairRate || 0) + 0.6 * k; st.cooling = (st.cooling || 0) + 0.06 * k; }
    }
  };

  // ---------- Historie ----------
  const STORY = [
    { title: 'A strange signal', text: 'The shipyard picked up an odd signal from the belt. Scan the asteroids (N) and find a rock with minerals.', check: (e, d) => e === 'scanFound', reward: 1500 },
    { title: 'The survey ship', text: 'The signal came from a survey ship that went to Vanaheim. Dial the gate and land at Vanir Cloud City to ask around.', check: (e, d) => e === 'dock' && d === 'p:vanaheim', reward: 3000 },
    { title: 'The lost probe', text: 'Its probe is drifting in Vanaheim and sending a distress call. Harpoon it and tow it to the Vanaheim Trading Post.', check: (e, d) => e === 'rescue' && d === 'story', reward: 5000 },
    { title: 'Raiders on the trail', text: 'The probe logs show raiders in Muspelheim. Go there and destroy two raiders.', check: (e, d) => e === 'pirate' && d === 'muspel', need: 2, reward: 6000 },
    { title: 'The core sample', text: 'The survey ship hid a core sample at Eldhjarta Colony. Land there to collect it.', check: (e, d) => e === 'dock' && d === 'p:muspel', reward: 12000 },
  ];
  C.STORY = STORY;
  C.story = {
    current: () => { const s = C.get().story; return s.step < STORY.length ? STORY[s.step] : null; },
    event: (e, d) => {
      const s = C.get().story, cur = STORY[s.step];
      if (!cur || !cur.check(e, d)) return;
      s.count = (s.count || 0) + 1;
      if (cur.need && s.count < cur.need) { game().msg(`Story: ${s.count}/${cur.need}`, RF.HUD_COLORS.gate); return; }
      s.step++; s.count = 0;
      const g = game();
      g.credits += cur.reward;
      C.addXp(cur.reward / 50);
      g.msg(`Story complete: ${cur.title} (+${cur.reward.toLocaleString('en-US')} cr)`, RF.HUD_COLORS.ok);
      if (s.step >= STORY.length) g.msg('You found the survey ship\'s secret. Title earned: Pathfinder', RF.HUD_COLORS.ok);
      RF.Audio.blip(523, 0.12, 'triangle', 0.1); setTimeout(() => RF.Audio.blip(784, 0.2, 'triangle', 0.1), 130);
    },
  };

  // ---------- Vrak og nødsignal ----------
  // Vrak ligger i feltene og kan slepes til stasjonen for bergingslønn.
  // Nødsignal: et skip som har gitt opp, med en belønning for å slepe det inn.
  function makeDerelict(sys, x, y, types, flag) {
    const layout = RF.layoutFrom(types.map(([t, gx, gy]) => [t, gx, gy]));
    const g = RF.layoutGeometry(layout);
    const w = new RF.Body(G.box(-1, -1, 1, 1), 1, { kind: 'wreck', restitution: 0.2, friction: 0.5, x, y, a: Math.random() * 6.28 });
    w.setRaw(g.verts, g.mass, g.I);
    w.vx = G.rand(-0.5, 0.5); w.vy = G.rand(-0.5, 0.5); w.w = G.rand(-0.1, 0.1);
    w.modules = layout; w.mat = 'skrap';
    Object.assign(w, flag || {});
    sys.world.add(w);
    return w;
  }
  const DERELICT = [['thruster', 0, 0], ['cargo', 1, 0], ['frame', 1, 1], ['cockpit', 2, 0], ['armor', 2, 1], ['cargo', 1, -1]];
  const PROBE = [['thruster', 0, 0], ['scanner', 1, 0], ['cockpit', 2, 0]];
  C.onSystem = (sys) => {
    if (sys._derelicts) return;
    sys._derelicts = true;
    for (const f of sys.def.fields) {
      const a = Math.random() * 6.28;
      makeDerelict(sys, f.cx + Math.cos(a) * f.rx * 0.6, f.cy + Math.sin(a) * f.ry * 0.6, DERELICT, { salvage: true });
    }
  };
  C.salvageValue = (w) => Math.round(w.modules.reduce((a, m) => a + RF.MODULES[m.t].cost, 0) * 0.25);
  // Er et slept vrak nær stasjonen? Da betales det ut.
  C.salvageCheck = (docked) => {
    const g = game(), st = g.sys.station;
    for (const o of g.sys.world.bodies) {
      if (o.dead || o.kind !== 'wreck' || !(o.salvage || o.distress)) continue;
      if (G.len(o.x - st.x, o.y - st.y) > 380) continue;
      o.dead = true;
      if (g.ship.anchor && g.ship.anchor.rope.B === o) g.ship.releaseAnchor(g);
      if (o.distress) {
        const r = o.distress.reward;
        g.credits += r; C.stat('rescues'); C.addXp(r / 40); C.addRep(g.sys.def.id, 8);
        g.msg(`Rescued the ${o.distress.name}! Reward ${r.toLocaleString('en-US')} cr`, RF.HUD_COLORS.ok);
        if (o.distress.story) C.story.event('rescue', 'story');
      } else {
        const v = C.salvageValue(o);
        g.credits += v; C.stat('salvaged'); C.addXp(v / 60);
        g.msg(`Salvage delivered: ${v.toLocaleString('en-US')} cr`, RF.HUD_COLORS.ok);
      }
      RF.Audio.pickup();
    }
  };
  function updateDistress(dt) {
    const g = game(), c = C.get(), sys = g.sys;
    sys._distT = (sys._distT == null ? G.rand(90, 200) : sys._distT) - dt;
    const has = sys.world.bodies.some((o) => o.distress && !o.dead);
    // Historien: sonden i Vanaheim.
    const cur = C.story.current();
    if (cur && cur.title === 'The lost probe' && sys.def.id === 'vanaheim' && !sys.world.bodies.some((o) => o.distress && o.distress.story && !o.dead)) {
      const f = sys.def.fields[0];
      makeDerelict(sys, f.cx + 300, f.cy - 200, PROBE, { distress: { name: 'survey probe', reward: 800, story: true } });
      g.msg('Distress beacon: the lost survey probe', RF.HUD_COLORS.danger);
    }
    if (has || sys._distT > 0 || g.ship.docked) return;
    sys._distT = G.rand(240, 420);
    const st = sys.station, a = Math.random() * 6.28, d = G.rand(1300, 2200);
    const names = ['hauler Grey Heron', 'skiff Little Wren', 'tug Iron Mule', 'courier Blue Finch'];
    const reward = G.pick([900, 1200, 1600, 2200]);
    makeDerelict(sys, st.x + Math.cos(a) * d, st.y + Math.sin(a) * d, DERELICT, { distress: { name: G.pick(names), reward } });
    g.msg('Distress beacon detected! A disabled ship needs a tow to the station', RF.HUD_COLORS.danger);
    RF.Audio.blip(880, 0.1, 'sine', 0.06); setTimeout(() => RF.Audio.blip(880, 0.1, 'sine', 0.06), 250);
    void c;
  }

  // ---------- Romvær ----------
  // En solstorm varsles 20 s før, varer et halvt minutt: skjoldet tappes,
  // skanneren er forstyrret, og skjermen får et oransje skjær.
  function updateWeather(dt) {
    const g = game(), sys = g.sys;
    const W = sys.weather || (sys.weather = { t: G.rand(180, 360), state: 'calm' });
    W.t -= dt;
    if (W.state === 'calm' && W.t <= 0) { W.state = 'warn'; W.t = 20; g.msg('Solar storm in 20 seconds! Shields will be drained, scanner jammed', RF.HUD_COLORS.amber); RF.Audio.alarm(); }
    else if (W.state === 'warn' && W.t <= 0) { W.state = 'storm'; W.t = 30; g.msg('Solar storm!', RF.HUD_COLORS.danger); }
    else if (W.state === 'storm') {
      const sh = g.ship;
      if (!sh.docked) { sh.shield = Math.max(0, sh.shield - sh.stats.shieldMax * 0.03 * dt); sh.shieldDelay = 1; }
      if (W.t <= 0) { W.state = 'calm'; W.t = G.rand(240, 480); g.msg('The solar storm has passed', RF.HUD_COLORS.ok); }
    }
  }
  C.storm = () => { const W = game().sys.weather; return W && W.state === 'storm' ? 1 : 0; };

  // ---------- Varme ----------
  C.heat = (ship, n) => { ship.heat = Math.min(1.25, (ship.heat || 0) + n); };
  function updateHeat(dt) {
    const sh = game().ship, st = sh.stats;
    const cool = (0.16 + 0.05 * (st.power || 0) + (st.cooling || 0)) * dt;
    sh.heat = Math.max(0, (sh.heat || 0) - cool);
    if (!sh.overheat && sh.heat >= 1) { sh.overheat = true; game().msg('Weapons overheated! Wait for them to cool down', RF.HUD_COLORS.danger); RF.Audio.blip(220, 0.25, 'sawtooth', 0.06); }
    if (sh.overheat && sh.heat < 0.45) { sh.overheat = false; game().msg('Weapons cooled down', RF.HUD_COLORS.ok); }
    // Ingeniører reparerer litt hele tiden.
    if (st.repairRate) {
      const m = sh.mostDamaged && sh.mostDamaged();
      if (m) { m.hp = Math.min(RF.MODULES[m.t].hp, m.hp + st.repairRate * dt); sh._repT = (sh._repT || 0) + dt; if (sh._repT > 2) { sh._repT = 0; sh.refreshStats(); } }
    }
  }

  // ---------- Hovedløkka ----------
  C.update = (dt, game_) => {
    const g = game(), c = C.get();
    c.stats.time += dt;
    if (!g.ship.docked && !g.dead) {
      const b = g.ship.body;
      c.stats.distance += Math.hypot(b.vx, b.vy) * dt / 1000;
      updateHeat(dt);
      updateDistress(dt);
      updateWeather(dt);
      C.salvageCheck(false);
    }
    driftMarket(dt);
    // Tidsakselerasjon slås av når noe farlig skjer.
    if (g.timeScale > 1 && (g.ship.docked || RF.Pirates.active(g).length || C.storm())) { g.timeScale = 1; g.msg('Time back to normal', RF.HUD_COLORS.amber); }
    void game_;
  };

  // Tidsakselerasjon: 1 → 2 → 4 → 1.
  C.cycleTime = () => {
    const g = game();
    if (g.ship.docked || RF.Pirates.active(g).length) { g.msg('Time acceleration is not possible now', RF.HUD_COLORS.amber); return; }
    g.timeScale = (g.timeScale || 1) >= 4 ? 1 : (g.timeScale || 1) * 2;
    g.msg(g.timeScale > 1 ? `Time ×${g.timeScale}` : 'Time normal', RF.HUD_COLORS.gate);
  };

  // ---------- Lagring til fil ----------
  C.exportSave = () => {
    const g = game(); g.save();
    let txt = '';
    try { txt = localStorage.getItem(C.SAVE_KEY) || ''; } catch (_) { /* tom */ }
    if (!txt) { g.msg('Nothing to export', RF.HUD_COLORS.amber); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = `ringfarer-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    g.msg('Save file downloaded', RF.HUD_COLORS.ok);
  };
  C.SAVE_KEY = 'ringfarer.lagring.v2';
  C.importSave = (key = C.SAVE_KEY) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      f.text().then((txt) => {
        try { const d = JSON.parse(txt); if (!d || d.v !== 2) throw new Error('bad'); localStorage.setItem(key, txt); location.reload(); }
        catch (_) { game().msg('That file is not a Ringfarer save', RF.HUD_COLORS.danger); }
      });
    };
    inp.click();
  };
})();
