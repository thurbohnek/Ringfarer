// Spillets kjerne: løkke, kamera, skade, gruvedrift, porter, dokking og lagring.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;
  const Input = RF.Input;
  const Audio = RF.Audio;

  // Vises på startskjermen, så man ser hvilken versjon man spiller.
  RF.VERSION = window.RF_VERSION || 'ukjent';
  RF.KAWOOSH_TIME = 1.3;
  RF.KAWOOSH_LEN = 36;
  const STEP = 1 / 120;
  const SAVE_KEY = 'ringfarer.lagring.v2';
  const DIAL_RANGE = 450;
  const DOCK_RANGE = 22;
  const DOCK_SPEED = 3.5;
  const TOW_COST = 400;

  const game = {
    state: 'title',
    time: 0,
    credits: 600,
    missions: [],
    boards: {},
    priceMod: {},
    systems: {},
    sys: null,
    ship: null,
    cam: { x: 0, y: 0, zoom: 3 },
    shake: 0,
    particles: new RF.Particles(),
    messages: [],
    prompt: '',
    action: null,
    dockReady: false,
    dead: false,
    deadT: 0,
    lastStation: 'midgard',
    touchUI: false,
    paused: false,
    flash: 0,
    testMode: false,
    radarBig: false,
  };
  RF.game = game;

  game.msg = (text, color) => {
    game.messages.push({ text, color, t: 3.5 });
    if (game.messages.length > 4) game.messages.shift();
  };

  // --- Systemer ---
  game.getSystem = (id) => {
    if (!game.systems[id]) {
      const st = RF.createSystemState(RF.systemById(id));
      st.world.onImpact = onImpact;
      st.world.shouldCollide = (A, B) => !(A.kind === 'gate' && B.kind === 'gate');
      RF.spawnNPCs(st);
      game.systems[id] = st;
    }
    return game.systems[id];
  };

  function enterSystem(id) {
    game.sys = game.getSystem(id);
    const ws = game.sys.world;
    if (!ws.bodies.includes(game.ship.body)) ws.add(game.ship.body);
    game.ship.body.dead = false;
  }

  function removeShipFromWorld() {
    const ws = game.sys.world;
    ws.bodies = ws.bodies.filter((b) => b !== game.ship.body);
  }

  // --- Priser ---
  game.sellPrice = (stationId, prod) => {
    const def = RF.stationById(stationId);
    const mod = (game.priceMod[stationId] && game.priceMod[stationId][prod]) || 1;
    return Math.round(RF.PRODUCTS[prod].price * (def.station.prices[prod] || 1) * mod);
  };
  game.buyPrice = (stationId, prod) => Math.round(game.sellPrice(stationId, prod) * 1.2);

  function refreshPrices(stationId) {
    const m = {};
    for (const k in RF.PRODUCTS) m[k] = G.rand(0.92, 1.08);
    game.priceMod[stationId] = m;
  }

  function refreshBoard(stationId) {
    const b = (game.boards[stationId] = (game.boards[stationId] || []).filter((m) => m.status === 'tilbud'));
    while (b.length < 4) b.push(RF.genMission(stationId));
  }

  // --- Ny karriere / lagring ---
  // test = true gir en million kreditter, så alt kan prøves med en gang.
  game.newCareer = (test) => {
    game.testMode = !!test;
    game.credits = test ? 1000000 : 1500;
    game.missions = [];
    game.boards = {};
    game.systems = {};
    game.priceMod = {};
    game.lastStation = 'midgard';
    RF.Weapons.reset();
    // I testmodus starter man med et skip som har alt utstyret om bord.
    const st = test ? RF.newShipState('fjell', RF.TEST_LAYOUT) : RF.newShipState('hopper');
    if (test) st.drones = [{ type: 'gruve' }, { type: 'rep' }];
    game.ship = new RF.Ship(st);
    spawnDocked('midgard');
    game.msg(test ? 'Testmodus: fullt utstyrt skip, alt er åpent og pengene tar aldri slutt' : 'Velkommen om bord i Hoppeskip MK-I', RF.HUD_COLORS.gate);
    game.save();
  };

  // Testing: gi penger når som helst. I testmodus fylles kontoen opp igjen
  // automatisk, så ingenting stopper på grunn av penger.
  game.giveMoney = (n = 1000000) => {
    game.credits += n;
    game.msg(`+${n.toLocaleString('nb-NO')} kr til testing`, RF.HUD_COLORS.ok);
    game.save();
  };
  game.topUp = () => {
    if (game.testMode && game.credits < 500000) game.credits += 1000000;
  };

  game.save = () => {
    const s = game.ship.s;
    const data = {
      v: 2, credits: game.credits, ship: {
        hull: s.hull, layout: s.layout.map((m) => ({ t: m.t, x: m.x, y: m.y, hp: m.hp })), blueprint: s.blueprint,
        fuel: s.fuel, ammo: s.ammo, cargo: s.cargo, missionCargo: s.missionCargo, drones: s.drones,
      },
      missions: game.missions.filter((m) => m.status === 'aktiv'),
      lastStation: game.lastStation, fa: game.ship.fa, test: game.testMode,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (_) { /* lagring utilgjengelig */ }
  };

  game.hasSave = () => {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; }
  };

  game.load = () => {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (_) { data = null; }
    if (!data || data.v !== 2) return game.newCareer();
    const s = RF.newShipState(data.ship.hull);
    Object.assign(s, data.ship);
    s.cargo = Object.assign(RF.emptyCargo(), data.ship.cargo);
    s.drones = data.ship.drones || [];
    game.credits = data.credits;
    game.testMode = !!data.test;
    game.missions = data.missions || [];
    RF.setMissionIdBase(game.missions.reduce((a, m) => Math.max(a, m.id), 0));
    game.lastStation = data.lastStation || 'midgard';
    game.boards = {};
    game.systems = {};
    game.priceMod = {};
    RF.Weapons.reset();
    game.ship = new RF.Ship(s);
    game.ship.fa = data.fa != null ? data.fa : 1;
    spawnDocked(game.lastStation);
    game.msg('Karrieren er lastet inn', RF.HUD_COLORS.gate);
  };

  // Bytt til et nytt skip. Det gamle tas i innbytte.
  game.tradeInValue = () => {
    const s = game.ship.s;
    return Math.round((RF.layoutValue(s.layout) + RF.HULLS[s.hull].cost) * 0.6);
  };

  game.buyHull = (hullId) => {
    const H = RF.HULLS[hullId];
    const price = H.cost - game.tradeInValue();
    if (game.credits < price) return false;
    game.credits -= price;
    const old = game.ship.s;
    const ns = RF.newShipState(hullId);
    ns.missionCargo = old.missionCargo;
    const hold = RF.layoutStats(ns.layout).hold;
    let room = hold - ns.missionCargo.reduce((a, m) => a + m.mass, 0);
    for (const k in old.cargo) { const take = Math.max(0, Math.min(old.cargo[k], room)); ns.cargo[k] = take; room -= take; }
    const bays = RF.layoutStats(ns.layout).bays;
    ns.drones = old.drones.slice(0, bays);
    const st = game.ship.docked;
    const fa = game.ship.fa;
    game.ship = new RF.Ship(ns);
    game.ship.fa = fa;
    game.ship.docked = st;
    const dp = RF.dockPoint(st);
    Object.assign(game.ship.body, { x: dp.x, y: dp.y, a: dp.a });
    game.fitZoom();
    game.save();
    return true;
  };

  // Zoom slik at skipet fyller en fornuftig del av skjermen.
  game.fitZoom = () => {
    const r = game.ship.body.radius;
    game.cam.zoom = G.clamp((game.touchUI ? 42 : 64) / r, 1.2, 7);
  };

  function spawnDocked(stationId) {
    const def = RF.stationById(stationId);
    game.sys = game.getSystem(def.id);
    const st = game.sys.station;
    const dp = RF.dockPoint(st);
    const b = game.ship.body;
    b.x = dp.x; b.y = dp.y; b.a = dp.a; b.vx = b.vy = b.w = 0;
    game.cam.x = b.x; game.cam.y = b.y;
    game.dead = false;
    game.fitZoom();
    dock(true);
  }

  // --- Dokking ---
  function dock(silent) {
    const ship = game.ship, st = game.sys.station;
    ship.releaseAnchor(game);
    game.recallDronesNow();
    removeShipFromWorld();
    ship.docked = st;
    ship.tractor.on = false;
    const dp = RF.dockPoint(st);
    Object.assign(ship.body, { x: dp.x, y: dp.y, a: dp.a, vx: 0, vy: 0, w: 0 });
    game.lastStation = st.id;
    refreshPrices(st.id);
    refreshBoard(st.id);
    // Fraktoppdrag leveres automatisk.
    for (const m of game.missions) {
      if (m.status === 'aktiv' && m.type === 'frakt' && m.to === st.id) {
        m.status = 'fullført';
        ship.s.missionCargo = ship.s.missionCargo.filter((c) => c.missionId !== m.id);
        game.credits += m.reward;
        game.msg(`Levert: ${m.goods} (+${m.reward} kr)`, RF.HUD_COLORS.ok);
        Audio.blip(660, 0.15, 'triangle', 0.12);
        Audio.blip(880, 0.2, 'triangle', 0.1);
      }
    }
    game.missions = game.missions.filter((m) => m.status === 'aktiv');
    ship.updateMass();
    game.save();
    if (!silent) Audio.thud(0.3);
    RF.UI.openStation();
  }

  game.undock = () => {
    const ship = game.ship, st = ship.docked;
    if (!st) return;
    ship.docked = null;
    const dp = RF.dockPoint(st);
    const out = { x: Math.cos(st.a), y: Math.sin(st.a) };
    const b = ship.body;
    const off = 8 + b.radius;
    b.x = dp.x + out.x * off; b.y = dp.y + out.y * off;
    b.vx = out.x * 2; b.vy = out.y * 2; b.w = 0;
    ship.s.blueprint = ship.s.layout.map((m) => ({ t: m.t, x: m.x, y: m.y }));
    enterSystem(game.sys.def.id);
    RF.UI.closeAll();
    game.save();
  };

  // --- Skade og støt ---
  function onImpact(c, J, vn0) {
    const ship = game.ship, sb = ship && ship.body;
    const p = c.points[0];
    for (const o of [c.A, c.B]) {
      if (o.npc && o.npc.active) {
        const dv = J * o.invMass;
        if (dv > 2 && G.len(p.x - game.cam.x, p.y - game.cam.y) < 600) {
          game.particles.burst(p.x, p.y, Math.min(20, Math.floor(dv * 2)), { sMin: 3, sMax: 8 + dv, color: '#ffd28a', zMin: 0.15, zMax: 0.35 });
        }
        o.npc.takeImpact(dv, p.x, p.y, game);
      }
    }
    if (sb && (c.A === sb || c.B === sb)) {
      const other = c.A === sb ? c.B : c.A;
      const dv = J * sb.invMass;
      if (dv < 0.5) return;
      const dmg = ship.takeImpact(dv, p.x, p.y, game);
      // Skjør last tåler bare små støt.
      for (const m of game.missions) {
        if (m.status === 'aktiv' && m.type === 'frakt' && m.fragile && dv > m.maxDv) {
          m.status = 'feilet';
          ship.s.missionCargo = ship.s.missionCargo.filter((x) => x.missionId !== m.id);
          ship.updateMass();
          game.msg(`${m.goods} ble ødelagt i støtet (${dv.toFixed(1)} m/s)`, RF.HUD_COLORS.danger);
        }
      }
      game.missions = game.missions.filter((m) => m.status !== 'feilet');
      if (dv > 1.2) {
        const n = Math.min(40, Math.floor(dv * 3));
        game.particles.burst(p.x, p.y, n, { sMin: 3, sMax: 8 + dv * 2, color: '#ffd28a', zMin: 0.15, zMax: 0.4 });
        game.particles.burst(p.x, p.y, Math.floor(n / 3), { type: 'smoke', sMin: 0.5, sMax: 3, color: '#7d8490', zMin: 0.8, zMax: 1.6, grow: 2, lMin: 0.6, lMax: 1.4 });
        Audio.thud(Math.min(1, dv / 10));
        game.shake = Math.min(1, game.shake + dv / 10);
      }
      if (dmg > 0.5) game.msg(`Skrogskade −${Math.ceil(dmg)} (${dv.toFixed(1)} m/s)`, RF.HUD_COLORS.danger);
      else if (dv > 2 && ship.shield > 0) game.msg(`Skjoldet tok støtet (${dv.toFixed(1)} m/s)`, RF.HUD_COLORS.gate);
      if (other.kind === 'ore' && dv < 1) return;
      return;
    }
    // Stein mot stein: støv hvis det er nær nok til å se.
    const rel = -vn0;
    if (rel > 1.5 && sb && G.len(p.x - sb.x, p.y - sb.y) < 500) {
      const M = RF.MATERIALS[c.A.mat || c.B.mat || 'kondritt'];
      game.particles.burst(p.x, p.y, Math.min(20, Math.floor(rel * 2)),
        { type: 'smoke', sMin: 0.5, sMax: rel, color: M ? M.light : '#888', zMin: 0.5, zMax: 1.5, grow: 1.5, lMin: 0.6, lMax: 1.5 });
      const d = G.len(p.x - sb.x, p.y - sb.y);
      Audio.thud(Math.min(0.6, rel / 12) * Math.max(0, 1 - d / 500));
    }
  }

  // --- Sikting ---
  // Trykker man på en stein (eller et annet legeme), låses siktet til det
  // punktet på steinen og følger den mens den driver og snurrer. På mobil blir
  // siktet stående der man sist trykket, også etter at fingeren er løftet.
  function pickBody(x, y) {
    const tol = 14 / game.cam.zoom;
    let best = null, bd = Infinity;
    for (const b of game.sys.world.bodies) {
      if (b.dead || b === game.ship.body || b.ghost) continue;
      if (b.kind !== 'rock' && b.kind !== 'ore' && b.kind !== 'wreck' && b.kind !== 'npc') continue;
      const d = G.len(b.x - x, b.y - y);
      if (d > b.radius + tol) continue;
      if (b.containsPoint(x, y)) return b;
      // Små biter: godta et trykk like ved.
      if (b.radius < 4 && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function updateAim() {
    const P = Input.pointer, R = RF.renderer, ship = game.ship;
    if (!P.has || ship.docked) {
      game.aim = ship.body.toWorld(ship.noseX + 80, 0);
      game.aimLock = null;
      return;
    }
    const wp = { x: game.cam.x + (P.x - R.w / 2) / game.cam.zoom, y: game.cam.y + (P.y - R.h / 2) / game.cam.zoom };
    // Nytt trykk (også et kort trykk som var over før denne rammen).
    if (P.presses !== game._aimPress) {
      game._aimPress = P.presses;
      const w0 = { x: game.cam.x + (P.x0 - R.w / 2) / game.cam.zoom, y: game.cam.y + (P.y0 - R.h / 2) / game.cam.zoom };
      const b = pickBody(w0.x, w0.y);
      game.aimLock = b ? { body: b, l: b.toLocal(w0.x, w0.y) } : null;
      game.aimWorld = w0;
    }
    // Drar man fingeren/musa bort mens man holder, følger siktet fingeren.
    if (P.down && game.aimLock && G.len(P.x - P.x0, P.y - P.y0) > 30) game.aimLock = null;
    if (!P.down && P.type === 'mouse' && game.aimLock && G.len(P.x - P.x0, P.y - P.y0) > 6) game.aimLock = null;
    const L = game.aimLock;
    if (L && L.body.dead) game.aimLock = null;
    if (game.aimLock) {
      const b = L.body;
      // Punktet på steinen kan ha blitt boret bort. Sikt da mot midten.
      const p = b.toWorld(L.l.x, L.l.y);
      game.aim = b.vox && !b.containsPoint(p.x, p.y) && G.len(L.l.x, L.l.y) > b.radius ? { x: b.x, y: b.y } : p;
    } else if (P.down || P.type === 'mouse') {
      game.aim = wp;
      game.aimWorld = wp;
    } else game.aim = game.aimWorld || wp;
  }

  // --- Gruvedrift ---
  // Steinene er bygget av voksler (voxel.js). Laseren slår løs biter som passer
  // i hullet de etterlater, og sprekker deler steinen der den faktisk sprekker.
  game.chipRock = (t, hit, d) => RF.Vox.chip(t, hit, d, game, 1);
  game.crackRock = (t, hit, d) => RF.Vox.crack(t, hit, d, game);

  // Gnister og steinstøv som velter ut der laseren brenner.
  game.laserDust = (h) => {
    const t = h.body;
    if (Math.random() < 0.6) game.particles.burst(h.x, h.y, 1, { sMin: 3, sMax: 12, dir: Math.atan2(h.ny, h.nx), spread: 1.2, color: '#ffb060', zMin: 0.12, zMax: 0.3, lMin: 0.15, lMax: 0.45 });
    if (t && t.mat && Math.random() < 0.55) {
      const a = Math.atan2(h.ny, h.nx) + G.rand(-1, 1), sp = G.rand(0.8, 4);
      game.particles.add({ type: 'smoke', x: h.x, y: h.y, vx: t.vx + Math.cos(a) * sp, vy: t.vy + Math.sin(a) * sp, life: G.rand(1.5, 3.5), size: G.rand(0.4, 0.9), grow: G.rand(1.2, 2.2), color: RF.MATERIALS[t.mat].light });
    }
  };

  game.tryIntake = (o) => {
    const ship = game.ship;
    if (ship.holdFree() <= 0.02) {
      if (!game._fullWarn || game.time - game._fullWarn > 4) {
        game._fullWarn = game.time;
        game.msg('Lasterommet er fullt', RF.HUD_COLORS.amber);
      }
      return;
    }
    if (ship.procMass() > 25000) return;
    o.dead = true;
    ship.processing.push({ mat: o.kind === 'wreck' ? 'skrap' : o.mat, mass: o.mass });
    ship.updateMass();
    const ip = o._tractorFrom || ship.body;
    game.particles.burst(ip.x, ip.y, 8, { type: 'glow', sMin: 1, sMax: 4, color: '#7dffd2', zMin: 0.15, zMax: 0.3, lMin: 0.2, lMax: 0.5, vx: ship.body.vx, vy: ship.body.vy });
    Audio.blip(520, 0.06, 'sine', 0.08);
  };

  game.onProcessed = (p) => {
    const M = RF.MATERIALS[p.mat];
    if (p.made > 0.005) game.msg(`+${p.made.toFixed(2).replace('.', ',')} t ${RF.PRODUCTS[M.product].name}`, RF.PRODUCTS[M.product].color);
    game.ship.updateMass();
  };

  // --- Tap av moduler og vrakdeler ---

  // Lager vrakdeler av en liste moduler. Moduler som ikke henger sammen blir
  // hver sin del. from er legemet de falt av (for posisjon og fart).
  game.spawnWreck = (mods, from) => {
    if (!mods.length) return;
    for (const cl of RF.clusters(mods)) {
      // Posisjonen til klyngen i verden før geometrien regnes om.
      const pts = cl.map((m) => from.toWorld(m.lx != null ? m.lx : 0, m.ly != null ? m.ly : 0));
      const g = RF.layoutGeometry(cl);
      const c = cl.reduce((a, m, i) => ({ x: a.x + pts[i].x * RF.MODULES[m.t].mass, y: a.y + pts[i].y * RF.MODULES[m.t].mass }), { x: 0, y: 0 });
      c.x /= g.dryMass; c.y /= g.dryMass;
      const v = from.pointVel(c.x, c.y);
      const w = new RF.Body(G.box(-1, -1, 1, 1), 1, { kind: 'wreck', restitution: 0.2, friction: 0.5, x: c.x, y: c.y, a: from.a });
      w.setRaw(g.verts, g.mass, g.I);
      w.vx = v.x + G.rand(-2, 2); w.vy = v.y + G.rand(-2, 2); w.w = from.w + G.rand(-0.6, 0.6);
      w.modules = cl;
      w.mat = 'skrap';
      game.sys.world.add(w);
    }
  };

  // Moduler med 0 hp faller av. Deler som ikke lenger henger sammen med
  // cockpiten driver bort som vrak. Mistes cockpiten, er skipet tapt.
  game.loseModules = (ship, dead) => {
    const s = ship.s, b = ship.body;
    const lostCockpit = dead.some((m) => m.t === 'cockpit');
    for (const m of dead) {
      const p = b.toWorld(m.lx, m.ly);
      game.particles.burst(p.x, p.y, 30, { sMin: 4, sMax: 25, color: '#ffcf80', zMin: 0.2, zMax: 0.5, lMin: 0.3, lMax: 1, vx: b.vx, vy: b.vy });
      game.particles.burst(p.x, p.y, 14, { type: 'smoke', sMin: 1, sMax: 5, color: '#5d5a52', zMin: 1, zMax: 2.5, grow: 3, lMin: 1, lMax: 2.5, vx: b.vx, vy: b.vy });
      game.msg(`Mistet ${RF.MODULES[m.t].name.toLowerCase()}`, RF.HUD_COLORS.danger);
    }
    Audio.thud(0.9);
    game.shake = Math.min(1, game.shake + 0.6);
    s.layout = s.layout.filter((m) => !dead.includes(m));
    const loose = lostCockpit ? s.layout.slice() : RF.disconnected(s.layout);
    s.layout = s.layout.filter((m) => !loose.includes(m));
    game.spawnWreck(dead.map((m) => Object.assign({}, m, { hp: 1 })).concat(loose), b);
    if (loose.length && !lostCockpit) game.msg(`${loose.length} modul${loose.length > 1 ? 'er' : ''} brakk av`, RF.HUD_COLORS.danger);
    if (lostCockpit) { destroyShip(); return; }
    ship.rebuild();
    if (ship.anchor && ship.anchor.lost) ship.releaseAnchor(game);
  };

  // --- Egne droner ---
  game.launchDrones = () => {
    const ship = game.ship;
    const ready = ship.s.drones.filter((d) => !d.trip && !d.out);
    if (!ready.length) {
      const out = game.sys.npcs.filter((n) => n.owner === ship);
      if (out.length) { for (const n of out) n.state = 'recall'; game.msg('Dronene kalles tilbake', RF.HUD_COLORS.gate); }
      else game.msg(ship.stats.bays ? 'Ingen droner om bord. Kjøp på en stasjon' : 'Skipet har ingen dronehangar', RF.HUD_COLORS.amber);
      return;
    }
    const bays = ship.s.layout.filter((m) => m.t === 'dronebay');
    ready.forEach((d, i) => {
      const n = new RF.NPC(d.type === 'rep' ? 'repair' : 'helper', game.sys);
      n.owner = ship;
      n.data = d;
      d.out = true;
      const m = bays[i % bays.length];
      const p = ship.body.toWorld(m.lx, m.ly + (m.ly >= 0 ? 4 : -4));
      n.spawnAt(p.x, p.y, ship.body.a, ship.body.vx, ship.body.vy);
      n.state = 'seek';
      game.sys.npcs.push(n);
    });
    game.msg(`${ready.length} drone${ready.length > 1 ? 'r' : ''} sendt ut`, RF.HUD_COLORS.gate);
  };

  game.droneHome = (n) => {
    n.despawn();
    n.data.out = false;
    game.sys.npcs = game.sys.npcs.filter((x) => x !== n);
  };

  game.droneLost = (n) => {
    const s = game.ship.s;
    s.drones = s.drones.filter((d) => d !== n.data);
    game.sys.npcs = game.sys.npcs.filter((x) => x !== n);
    game.msg(`${n.name} gikk tapt`, RF.HUD_COLORS.danger);
  };

  // Alle droner inn i hangaren med en gang (ved dokking og portreiser).
  game.recallDronesNow = () => {
    for (const n of game.sys.npcs.filter((x) => x.owner)) {
      if (n.data) {
        // Leverer malmen den har med seg.
        for (const c of n.load || []) game.ship.processing.push(c);
        n.load = [];
      }
      game.droneHome(n);
    }
  };

  // --- Porten ---
  game.dial = (destId) => {
    const g = game.sys.gate;
    if (g.state !== 'idle') return;
    g.state = 'dialing';
    g.t = 0;
    g.chevrons = 0;
    g.dest = destId;
    g.incoming = false;
    RF.UI.closeAll();
    game.msg(`Ringer ${RF.systemById(destId).name} …`, RF.HUD_COLORS.gate);
  };

  function updateGate(dt) {
    const g = game.sys.gate;
    const R = RF.GATE_R;
    g.t += dt;
    if (g.state === 'dialing') {
      const ch = Math.min(7, Math.floor(g.t / 0.62));
      if (ch > g.chevrons) { g.chevrons = ch; Audio.chevron(ch); }
      if (g.chevrons >= 7 && g.t > 7 * 0.62 + 0.4) { g.state = 'kawoosh'; g.t = 0; Audio.kawoosh(); }
    } else if (g.state === 'kawoosh') {
      // Alt som er foran porten i virvelen blir fordampet.
      const k = Math.sin(Math.min(1, g.t / RF.KAWOOSH_TIME) * Math.PI);
      const L = RF.KAWOOSH_LEN * k;
      const cs = Math.cos(g.a), sn = Math.sin(g.a);
      for (const b of game.sys.world.bodies) {
        if (b.isStatic || b.dead) continue;
        const dx = b.x - g.x, dy = b.y - g.y;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        const ex = (lx - L * 0.45) / (L * 0.55 + 2), ey = ly / (R * 0.85);
        if (lx > 0 && ex * ex + ey * ey < 1) {
          if (b === game.ship.body) {
            if (!game._kawooshHit) {
              game._kawooshHit = true;
              game.ship.shield = 0;
              game.ship.takeImpact(0, b.x - cs * 3, b.y - sn * 3, game, 120);
              b.vx += cs * 12; b.vy += sn * 12;
              game.msg('Truffet av virvelen fra porten!', RF.HUD_COLORS.danger);
              game.shake = 1;
              Audio.thud(1);
            }
          } else if (b.npc) {
            b.npc.explode(game);
          } else {
            b.dead = true;
            game.particles.burst(b.x, b.y, 10, { type: 'glow', sMin: 2, sMax: 8, color: '#9fd8ff', zMin: 0.2, zMax: 0.5 });
          }
        }
      }
      if (g.t >= RF.KAWOOSH_TIME) {
        g.state = 'open'; g.t = 0; game._kawooshHit = false;
        // Et arbeidsskip som kommer hjem gjennom porten.
        if (g.arrival) {
          const n = g.arrival;
          g.arrival = null;
          n.spawnAt(g.x + Math.cos(g.a) * 8, g.y + Math.sin(g.a) * 8, g.a, Math.cos(g.a) * 8, Math.sin(g.a) * 8);
          n.state = 'toStation';
          n.timer = 0;
        }
      }
    } else if (g.state === 'open') {
      if (g.t > (g.incoming ? 5 : 38)) { g.state = 'closing'; g.t = 0; }
    } else if (g.state === 'closing') {
      if (g.t > 0.6) { g.state = 'idle'; g.chevrons = 0; g.t = 0; g.incoming = false; g.dialedBy = null; }
    }

    // Reise gjennom horisonten, bare forfra og bare utgående.
    const b = game.ship.body;
    const cs = Math.cos(g.a), sn = Math.sin(g.a);
    const dx = b.x - g.x, dy = b.y - g.y;
    const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
    if (g.state === 'open' && !g.incoming && game._gatePrevLx > 0 && lx <= 0 && Math.abs(ly) < R - 2) {
      transit(g, lx, ly);
      game._gatePrevLx = undefined;
      return;
    }
    game._gatePrevLx = lx;
  }

  // Et arbeidsskip forsvinner gjennom porten og kommer tilbake senere.
  game.npcTransit = (npc, g) => {
    npc.despawn();
    npc.state = 'away';
    npc.timer = G.rand(50, 110);
    g.t = Math.max(g.t, 30); // porten lukker seg snart etterpå
    g.dialedBy = null;
    if (game.sys === npc.sys) {
      game.particles.burst(g.x, g.y, 20, { type: 'glow', sMin: 2, sMax: 10, color: '#9fd8ff', zMin: 0.2, zMax: 0.5 });
      Audio.thud(0.4, true);
    }
  };

  // Et arbeidsskip ringer inn fra et annet system.
  game.npcArrival = (npc) => {
    const g = npc.sys.gate;
    if (g.state !== 'idle') return false;
    g.state = 'dialing'; g.t = 0; g.chevrons = 0; g.incoming = true; g.dest = null;
    g.arrival = npc;
    const sb = game.ship.body;
    if (game.sys === npc.sys && G.len(sb.x - g.x, sb.y - g.y) < 600) game.msg('Innkommende ormehull! Hold deg unna forsiden av porten', RF.HUD_COLORS.danger);
    return true;
  };

  function transit(g, lx, ly) {
    const ship = game.ship, b = ship.body;
    ship.releaseAnchor(game);
    game.recallDronesNow();
    RF.Weapons.reset();
    const cs = Math.cos(g.a), sn = Math.sin(g.a);
    const vlx = b.vx * cs + b.vy * sn, vly = -b.vx * sn + b.vy * cs;
    const al = b.a - g.a;
    removeShipFromWorld();
    g.state = 'closing';
    g.t = 0;
    const dest = game.getSystem(g.dest);
    const dg = dest.gate;
    dg.state = 'open'; dg.t = 0; dg.incoming = true; dg.chevrons = 7;
    // Rotasjon 180° i portens ramme: inn forfra her, ut forfra der.
    const nlx = 3 - lx, nly = -ly;
    const dcs = Math.cos(dg.a), dsn = Math.sin(dg.a);
    b.x = dg.x + nlx * dcs - nly * dsn;
    b.y = dg.y + nlx * dsn + nly * dcs;
    const nvx = -vlx, nvy = -vly;
    b.vx = nvx * dcs - nvy * dsn;
    b.vy = nvx * dsn + nvy * dcs;
    b.a = dg.a + al + Math.PI;
    enterSystem(dest.def.id);
    game.cam.x = b.x; game.cam.y = b.y;
    game.flash = 1;
    game.particles.list = [];
    ship.tractor.targets = [];
    Audio.kawoosh();
    game.msg(`Ankommet ${dest.def.name}`, RF.HUD_COLORS.gate);
    game.msg(dest.def.blurb, RF.HUD_COLORS.muted || '#8398b3');
    game._gatePrevLx = undefined;
  }

  // --- Død og nødslep ---
  function destroyShip() {
    const b = game.ship.body;
    game.dead = true;
    game.deadT = 0;
    game.ship.releaseAnchor(game);
    removeShipFromWorld();
    game.particles.burst(b.x, b.y, 80, { sMin: 5, sMax: 40, color: '#ffcf80', zMin: 0.2, zMax: 0.6, lMin: 0.5, lMax: 1.6, vx: b.vx, vy: b.vy });
    game.particles.burst(b.x, b.y, 40, { type: 'glow', sMin: 2, sMax: 18, color: '#ff8a3a', zMin: 0.4, zMax: 1, lMin: 0.4, lMax: 1.2, vx: b.vx, vy: b.vy });
    game.particles.burst(b.x, b.y, 40, { type: 'smoke', sMin: 1, sMax: 10, color: '#6d6f78', zMin: 1.5, zMax: 3, grow: 4, lMin: 1.2, lMax: 3, vx: b.vx, vy: b.vy });
    game.particles.burst(b.x, b.y, 30, { type: 'debris', sMin: 3, sMax: 20, color: '#8e9aab', zMin: 0.4, zMax: 1.2, lMin: 2, lMax: 5, vx: b.vx, vy: b.vy });
    Audio.thud(1);
    Audio.thud(0.8, true);
    game.shake = 1;
  }

  // Forsikringen bygger skipet opp igjen etter siste tegning.
  game.respawn = () => {
    const s = game.ship.s;
    const fee = Math.min(game.credits, 300 + Math.round(game.credits * 0.1));
    game.credits -= fee;
    game.missions = game.missions.filter((m) => m.type !== 'frakt');
    const fa = game.ship.fa;
    const ns = RF.newShipState(s.hull);
    ns.layout = s.blueprint.map((m) => ({ t: m.t, x: m.x, y: m.y, hp: RF.MODULES[m.t].hp }));
    ns.blueprint = s.blueprint;
    ns.drones = s.drones.filter((d) => !d.out);
    const st = RF.layoutStats(ns.layout);
    ns.fuel = st.fuelCap;
    ns.ammo = st.rocketCap;
    RF.Weapons.reset();
    game.ship = new RF.Ship(ns);
    game.ship.fa = fa;
    RF.UI.closeAll();
    spawnDocked(game.lastStation);
    game.msg(`Nytt skrog fra forsikringen. Egenandel ${fee} kr`, RF.HUD_COLORS.amber);
    return fee;
  };

  function towHome() {
    if (game.credits < TOW_COST) { game.msg('Du har ikke råd til slep', RF.HUD_COLORS.danger); return; }
    game.credits -= TOW_COST;
    const st = game.sys.station;
    game.msg(`Slept til ${st.name} (−${TOW_COST} kr)`, RF.HUD_COLORS.amber);
    game.ship.s.fuel = Math.max(game.ship.s.fuel, 5);
    dock();
  }

  // --- Oppdatering ---
  function updateCamera(dt) {
    const b = game.ship.body, cam = game.cam;
    const look = Math.min(RF.renderer.w, RF.renderer.h) * 0.22 / cam.zoom;
    let tx = b.x + b.vx * 0.9, ty = b.y + b.vy * 0.9;
    const dx = tx - b.x, dy = ty - b.y, dl = G.len(dx, dy);
    if (dl > look) { tx = b.x + (dx / dl) * look; ty = b.y + (dy / dl) * look; }
    const k = 1 - Math.exp(-dt * 4);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    if (game.shake > 0) {
      const s = game.shake * 6 / cam.zoom;
      cam.x += G.rand(-s, s);
      cam.y += G.rand(-s, s);
      game.shake = Math.max(0, game.shake - dt * 2.5);
    }
  }

  function cleanupWorld() {
    const sys = game.sys, ws = sys.world;
    let comets = 0, ore = 0;
    for (const b of ws.bodies) {
      if (b.isStatic || b.kind === 'ship' || b.dead) continue;
      const d = G.len(b.x, b.y);
      if (b.comet) comets++;
      if (b.kind === 'ore') ore++;
      if (d > 3600) {
        if (b.comet || b.kind === 'ore') { b.dead = true; continue; }
        // Steiner som driver ut kommer inn igjen på motsatt side.
        b.x = -b.x * 0.95; b.y = -b.y * 0.95;
      }
      if (b.heat > 0) b.heat = Math.max(0, b.heat - 0.02);
    }
    if (comets < sys.def.comets) sys.respawnComet(false);
    // Hold antallet løse malmbiter nede.
    if (ore > 260) {
      const sb = game.ship.body;
      const list = ws.bodies.filter((b) => b.kind === 'ore').sort((a, c) => G.len(c.x - sb.x, c.y - sb.y) - G.len(a.x - sb.x, a.y - sb.y));
      for (let i = 0; i < ore - 240; i++) list[i].dead = true;
    }
  }

  function updateFlight(dt, inp) {
    const ship = game.ship;
    ship.fly(inp, dt, game);
    ship.gunCd = Math.max(0, ship.gunCd - dt);
    ship.rocketCd = Math.max(0, ship.rocketCd - dt);
    // Valgt verktøy brukes så lenge avtrekkeren holdes inne.
    const fire = inp.fire || Input.pointer.down;
    ship.updateTurrets(game.aim, dt);
    ship.updateLasers(fire && ship.tool === 'laser', dt, game);
    if (fire && ship.tool === 'kanon') RF.Weapons.fireGuns(ship, game);
    ship.updateTractor(dt, game);
    ship.updateProcessing(dt, game);
    ship.updateShield(dt);
    ship.updateAnchor(inp.winch, inp.winchOut, dt, game);
    ship.updateMass();
  }

  function updatePrompts() {
    const ship = game.ship, b = ship.body, sys = game.sys;
    game.prompt = '';
    game.action = null;
    game.dockReady = false;
    if (ship.docked || game.dead) return;
    const dp = RF.dockPoint(sys.station);
    const dd = G.len(b.x - dp.x, b.y - dp.y);
    const spd = G.len(b.vx, b.vy);
    if (dd < DOCK_RANGE) {
      if (spd < DOCK_SPEED) {
        game.dockReady = true;
        game.prompt = `[T] Dokk ved ${sys.station.name}`;
        game.action = 'dock';
      } else {
        game.prompt = `Senk farten for å dokke (${spd.toFixed(1)} > ${DOCK_SPEED} m/s)`;
      }
      return;
    }
    if (dd < 180) {
      game.prompt = 'Fly inn i den stiplede ringen ved enden av dokkingsarmen';
      return;
    }
    const g = sys.gate;
    const gd = G.len(b.x - g.x, b.y - g.y);
    if (gd < DIAL_RANGE) {
      if (g.state === 'idle') { game.prompt = '[G] Ring porten'; game.action = 'dial'; }
      else if (g.state === 'dialing') game.prompt = `Låser chevron ${g.chevrons + 1} av 7 …`;
      else if (g.state === 'kawoosh') game.prompt = 'Hold avstand foran porten!';
      else if (g.state === 'open' && !g.incoming) game.prompt = `Porten er åpen til ${RF.systemById(g.dest).name}: fly inn forfra`;
      return;
    }
    if (ship.s.fuel <= 0) { game.prompt = `[R] Nødslep til ${sys.station.name} (${TOW_COST} kr)`; game.action = 'tow'; }
  }

  game.selectTool = (t) => {
    const ship = game.ship;
    ship.tool = t;
    const st = ship.stats;
    const have = { laser: st.lasers.length, kanon: st.guns.length, rakett: st.rockets.length, anker: st.anchors.length }[t];
    game.msg(`Verktøy: ${RF.TOOL_NAMES[t]}${have ? '' : ' (ikke montert)'}`, have ? RF.HUD_COLORS.gate : RF.HUD_COLORS.amber);
    Audio.blip(500, 0.04, 'square', 0.06);
  };

  function handleKeys() {
    if (Input.hit('KeyM')) {
      Audio.setMuted(!Audio.muted);
      game.msg(Audio.muted ? 'Lyd av' : 'Lyd på');
    }
    if (Input.hit('Escape') || Input.hit('KeyP')) {
      if (RF.UI.isOpen()) {
        if (!game.ship.docked && !game.dead) RF.UI.closeAll();
      } else if (!game.dead) RF.UI.openPause();
      return;
    }
    if (Input.hit('KeyH')) { RF.UI.openHelp(); return; }
    if (RF.UI.isOpen() || game.dead) return;
    const ship = game.ship;
    if (Input.hit('KeyZ')) {
      ship.fa = (ship.fa + 1) % 3;
      game.msg('Flygeassistent: ' + ['av (ren Newton)', 'demper rotasjon', 'full (bremser også fart)'][ship.fa], RF.HUD_COLORS.gate);
    }
    if (Input.hit('KeyX')) RF.Weapons.fireHarpoon(ship, game);
    if (Input.hit('KeyK')) game.launchDrones();
    const tools = { Digit1: 'laser', Digit2: 'kanon', Digit3: 'rakett', Digit4: 'anker' };
    for (const k in tools) if (Input.hit(k)) game.selectTool(tools[k]);
    if (Input.hit('ToolNext')) game.selectTool(RF.TOOLS[(RF.TOOLS.indexOf(ship.tool) + 1) % RF.TOOLS.length]);
    // Engangsbruk av verktøy ved trykk.
    if (Input.hit('Space') || Input.hit('Fire')) {
      if (ship.tool === 'rakett') RF.Weapons.fireRocket(ship, game);
      if (ship.tool === 'anker') RF.Weapons.fireHarpoon(ship, game);
    }
    if (Input.hit('KeyL')) {
      ship.lightOn = !ship.lightOn;
      Audio.blip(ship.lightOn ? 900 : 600, 0.04, 'square', 0.06);
    }
    if (Input.hit('KeyF')) {
      ship.tractor.on = !ship.tractor.on;
      Audio.blip(ship.tractor.on ? 300 : 200, 0.08, 'sine', 0.1);
    }
    if (Input.hit('Equal') || Input.hit('NumpadAdd')) game.cam.zoom = Math.min(10, game.cam.zoom * 1.25);
    if (Input.hit('Minus') || Input.hit('NumpadSubtract')) game.cam.zoom = Math.max(0.25, game.cam.zoom / 1.25);
    const act = Input.hit('Interact') || Input.hit('Enter');
    if ((Input.hit('KeyT') || act) && game.action === 'dock') dock();
    else if ((Input.hit('KeyG') || act) && game.action === 'dial') RF.UI.openDial();
    else if ((Input.hit('KeyR') || act) && game.action === 'tow') towHome();
  }

  function update(dt) {
    game.time += dt;
    const ship = game.ship;
    const inp = RF.UI.isOpen() || game.dead || ship.docked ? { thrust: 0, turn: 0, strafe: 0, laser: false } : Input.state();
    if (!ship.docked && !game.dead) updateFlight(dt, inp);
    else if (ship.docked) ship.updateShield(dt);
    for (const n of game.sys.npcs.slice()) n.update(dt, game);
    RF.Weapons.update(dt, game);
    updateGate(dt);
    game.sys.world.step(dt);
  }

  let last = 0, acc = 0, frameN = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (game.state !== 'play') { last = ts; return; }
    let dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    // Siktepunktet i verden: der musen eller fingeren er, ellers rett frem.
    if (game.ship) updateAim();
    handleKeys();
    if (!game.paused) {
      acc += dt;
      while (acc >= STEP) { update(STEP); acc -= STEP; }
      game.particles.update(dt);
      if (++frameN % 30 === 0) cleanupWorld();
      const ship = game.ship;
      // Røyk og gnister fra et skadet skip.
      if (!game.dead && !ship.docked) {
        const b = ship.body;
        // Røyk og gnister fra skadde moduler.
        for (const m of ship.s.layout) {
          const f = m.hp / RF.MODULES[m.t].hp;
          if (f < 0.5 && Math.random() < (0.5 - f) * 0.25) {
            const p = b.toWorld(m.lx, m.ly);
            game.particles.add({ type: 'smoke', x: p.x, y: p.y, vx: b.vx + G.rand(-1, 1), vy: b.vy + G.rand(-1, 1), life: G.rand(0.8, 1.6), size: 0.8, grow: 2.2, color: '#5d626c' });
          }
          if (f < 0.25 && Math.random() < 0.04) {
            const p = b.toWorld(m.lx, m.ly);
            game.particles.burst(p.x, p.y, 4, { sMin: 2, sMax: 8, color: '#ffd28a', zMin: 0.1, zMax: 0.25, lMin: 0.1, lMax: 0.4, vx: b.vx, vy: b.vy });
          }
        }
        // Dråper av motorplasma fra hver motor.
        if (ship.fx.main > 0.1) {
          const d = b.dirWorld(-1, 0);
          for (const t of ship.stats.thrusters) {
            if (Math.random() > ship.fx.main * 0.7) continue;
            const p = b.toWorld(t.m.lx - RF.CELL, t.m.ly);
            game.particles.add({ type: 'glow', x: p.x, y: p.y, vx: b.vx + d.x * 30 + G.rand(-2, 2), vy: b.vy + d.y * 30 + G.rand(-2, 2), life: 0.25, size: 0.25, color: '#7fb8ff' });
          }
        }
        for (const B of ship.beams) if (B.hit) game.laserDust(B.hit);
        // Halen til kometene peker bort fra sola.
        const sd = game.sys.def.sky.starDir + Math.PI;
        for (const c of game.sys.world.bodies) {
          if (!c.comet || G.len(c.x - game.cam.x, c.y - game.cam.y) > 900) continue;
          if (Math.random() < 0.3) {
            const a = Math.random() * 6.28, r = c.radius * 0.9;
            game.particles.add({ type: 'smoke', x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: c.vx * 0.6 + Math.cos(sd) * 6 + G.rand(-1.5, 1.5), vy: c.vy * 0.6 + Math.sin(sd) * 6 + G.rand(-1.5, 1.5), life: G.rand(2, 4), size: c.radius * 0.12, grow: 1.5, color: '#9aa3a9' });
          }
          // Småstein og grus som følger kometen.
          if (Math.random() < 0.5) {
            const a = Math.random() * 6.28, r = c.radius * G.rand(1, 1.8);
            game.particles.add({ type: 'debris', x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: c.vx + G.rand(-1.5, 1.5), vy: c.vy + G.rand(-1.5, 1.5), life: G.rand(4, 8), size: G.rand(0.2, 0.9), color: G.pick(['#5d6166', '#7c8186', '#3f4347']) });
          }
        }
      }
      if (game.dead) {
        game.deadT += dt;
        if (game.deadT > 1.6 && !RF.UI.isOpen()) RF.UI.openDead();
      }
      updatePrompts();
      if (!game.dead) updateCamera(dt);
      for (const m of game.messages) m.t -= dt;
      game.messages = game.messages.filter((m) => m.t > 0);
      game.flash = Math.max(0, game.flash - dt * 1.5);
      Audio.update(ship.docked || game.dead ? 0 : Math.max(ship.fx.main, ship.fx.retro * 0.6, (ship.fx.left + ship.fx.right) * 0.4),
        ship.laser.on && !game.dead, ship.tractor.on && !ship.docked && !game.dead, !!ship.laser.hit);
    }
    game.topUp();
    Input.endFrame();
    RF.renderer.draw(game, dt);
    if (!game.dead) RF.drawHUD(RF.renderer, game);
    if (game.flash > 0) {
      const c = RF.renderer.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = `rgba(200,235,255,${game.flash})`;
      c.fillRect(0, 0, RF.renderer.canvas.width, RF.renderer.canvas.height);
    }
    RF.UI.tick();
  }

  game.start = (cont, test) => {
    Audio.start();
    if (cont) game.load(); else game.newCareer(test);
    game.state = 'play';
  };

  game.boot = () => {
    const canvas = document.getElementById('game');
    RF.renderer = new RF.Renderer(canvas);
    window.addEventListener('resize', () => RF.renderer.resize());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      game.cam.zoom = G.clamp(game.cam.zoom * f, 0.25, 10);
    }, { passive: false });
    game.touchUI = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    // Knip med to fingre for å zoome.
    RF.Input.onPinch = (f) => { game.cam.zoom = G.clamp(game.cam.zoom * f, 0.25, 10); };
    // Sikt med musen eller fingeren. Trykk på radaren gjør den stor eller liten.
    RF.Input.bindAim(canvas, (e) => {
      const rb = game._radarHit;
      if (rb && G.len(e.clientX - rb.x, e.clientY - rb.y) < rb.r + 8) { game.radarBig = !game.radarBig; return true; }
      return game.state !== 'play' || RF.UI.isOpen();
    });
    if (game.touchUI) game.cam.zoom = 2;
    RF.UI.init(game);
    // Et levende bakgrunnsbilde bak tittelskjermen.
    game.ship = new RF.Ship(RF.newShipState('graver'));
    game.sys = game.getSystem('midgard');
    const b = game.ship.body;
    b.x = 420; b.y = 260; b.a = 0.4;
    game.cam.x = b.x; game.cam.y = b.y;
    RF.renderer.draw(game);
    requestAnimationFrame((ts) => { last = ts; frame(ts); });
    // Tegn tittelbakgrunnen jevnlig så asteroidene beveger seg.
    const idle = () => {
      if (game.state === 'play') return;
      game.time += 1 / 60;
      game.sys.world.step(1 / 60);
      game.cam.x += 0.15;
      RF.renderer.draw(game);
      requestAnimationFrame(idle);
    };
    requestAnimationFrame(idle);
  };
})();
