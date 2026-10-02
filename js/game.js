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
    camOff: { x: 0, y: 0 },
    // Fritt kamera: et punkt i verden kameraet står stille over (etter at man
    // har panorert). null = kameraet følger skipet.
    camFree: null,
    pointerMode: null,
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
    // Samme melding to ganger på rad forlenger bare den som vises.
    const last = game.messages[game.messages.length - 1];
    if (last && last.text === text && last.t > 0) { last.t = 3.5; return; }
    game.messages.push({ text, color, t: 3.5 });
    if (game.messages.length > 4) game.messages.shift();
  };

  // --- Systemer ---
  game.getSystem = (id) => {
    if (!game.systems[id]) {
      const st = RF.createSystemState(RF.systemById(id));
      st.world.onImpact = onImpact;
      // Egne droner flyr fritt inn og ut av skipet sitt.
      st.world.shouldCollide = (A, B) => !(A.kind === 'gate' && B.kind === 'gate') &&
        // Nylig skåret løs: ikke kollider med steinen biten kom fra, eller med søsken.
        !(A.sib && game.time < A.sib.until && (A.sib.body === B || (B.sib && B.sib.body === A.sib.body))) &&
        !(B.sib && game.time < B.sib.until && B.sib.body === A) &&
        !(A.npc && A.npc.owner && A.npc.owner.body === B) && !(B.npc && B.npc.owner && B.npc.owner.body === A) &&
        // og ut og inn av stasjonens trafikk uten å kræsje i de andre dronene.
        !(A.npc && B.npc && (A.npc.owner || B.npc.owner));
      // Malmbiter kan treffe skip, men dytter dem ikke.
      const heavy = (o) => o.kind === 'ship' || !!o.npc;
      st.world.oneWay = (A, B) => (B.kind === 'ore' && heavy(A) ? 1 : A.kind === 'ore' && heavy(B) ? 2 : 0);
      RF.spawnNPCs(st);
      game.systems[id] = st;
      RF.Stations.sync(st);
    }
    return game.systems[id];
  };

  function enterSystem(id) {
    // Pirater følger ikke etter gjennom porten.
    if (game.sys && game.sys.npcs) for (const n of game.sys.npcs.filter((x) => x.T.hostile)) n.leave(game);
    game.sys = game.getSystem(id);
    if (game.followShip) game.followShip(true);
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
    return Math.round(RF.PRODUCTS[prod].price * (def.station.prices[prod] || 1) * mod * tradeMul() * RF.Stations.priceMul(stationId));
  };
  // Større stasjoner selger også billigere (prisfordelen virker begge veier).
  game.buyPrice = (stationId, prod) => {
    const k = tradeMul() * RF.Stations.priceMul(stationId);
    return Math.round((game.sellPrice(stationId, prod) * 1.2) / (k * k));
  };
  // Fraktskip med lasteracker på sidene handler litt bedre.
  const tradeMul = () => (game.ship && game.ship.stats && game.ship.stats.tradeMul) || 1;

  function refreshPrices(stationId) {
    const m = {};
    for (const k in RF.PRODUCTS) m[k] = G.rand(0.92, 1.08);
    game.priceMod[stationId] = m;
  }

  function refreshBoard(stationId) {
    const b = (game.boards[stationId] = (game.boards[stationId] || []).filter((m) => m.status === 'tilbud'));
    const sys = game.systems[stationId];
    const haulers = sys ? sys.npcs.filter((n) => n.type === 'hauler').map((n) => n.name) : [];
    while (b.length < 5) b.push(RF.genMission(stationId, haulers));
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
    game.stationXP = {};
    game.lastStation = 'midgard';
    RF.Weapons.reset();
    if (RF.Combat) RF.Combat.reset();
    // I testmodus starter man med et skip som har alt utstyret om bord.
    const st = test ? RF.newShipState('fjell', RF.testLayout()) : RF.newShipState('hopper');
    if (test) {
      // Én av hver drone som får plass om bord.
      const all = ['porter', 'tern', 'picket', 'gruve', 'rep', 'gleaner', 'burrow', 'ferryman'].map((type) => ({ type }));
      st.drones = RF.fitDrones(st.layout, RF.applyClass(RF.layoutStats(st.layout), st.hull, st.layout), all).slots.map((x) => x.d);
    }
    game.ship = new RF.Ship(st);
    spawnDocked('midgard');
    game.msg(test ? 'Test mode: fully equipped ship, everything unlocked and the money never runs out' : 'Welcome aboard the Skiff MK-I', RF.HUD_COLORS.gate);
    game.save();
  };

  // Testing: gi penger når som helst. I testmodus fylles kontoen opp igjen
  // automatisk, så ingenting stopper på grunn av penger.
  game.giveMoney = (n = 1000000) => {
    game.credits += n;
    game.msg(`+${n.toLocaleString('en-US')} cr for testing`, RF.HUD_COLORS.ok);
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
        fuel: s.fuel, ammo: s.ammo, flares: s.flares, cargo: s.cargo, missionCargo: s.missionCargo, drones: s.drones,
      },
      missions: game.missions.filter((m) => m.status === 'aktiv'),
      lastStation: game.lastStation, fa: game.ship.fa, test: game.testMode, stationXP: game.stationXP || {},
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
    s.drones = (data.ship.drones || []).filter((d) => RF.DRONE_TYPES[d.type]).map((d) => Object.assign(d, { out: false }));
    game.credits = data.credits;
    game.testMode = !!data.test;
    game.missions = data.missions || [];
    // Eldre lagringer har norske varenavn på oppdragene.
    const OLD = { 'Medisinsk forsyning': 'Medical supplies', 'Reservedeler': 'Spare parts', 'Forskningsprøver': 'Research samples',
      'Hydrokultur-moduler': 'Hydroponics modules', 'Post og pakker': 'Mail and parcels', 'Reaktorstaver': 'Reactor rods',
      'Kryolagrede embryoer': 'Cryo-stored embryos' };
    for (const m of game.missions) if (OLD[m.goods]) m.goods = OLD[m.goods];
    for (const c of s.missionCargo || []) if (OLD[c.name]) c.name = OLD[c.name];
    RF.setMissionIdBase(game.missions.reduce((a, m) => Math.max(a, m.id), 0));
    game.lastStation = data.lastStation || 'midgard';
    game.stationXP = data.stationXP || {};
    game.boards = {};
    game.systems = {};
    game.priceMod = {};
    RF.Weapons.reset();
    if (RF.Combat) RF.Combat.reset();
    game.ship = new RF.Ship(s);
    game.ship.fa = data.fa != null ? data.fa : 1;
    spawnDocked(game.lastStation);
    game.msg('Career loaded', RF.HUD_COLORS.gate);
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
    const fit = RF.fitDrones(ns.layout, RF.applyClass(RF.layoutStats(ns.layout), hullId, ns.layout), old.drones);
    ns.drones = fit.slots.map((x) => x.d);
    const left = old.drones.length - ns.drones.length;
    if (left > 0) { game.credits += left * 800; game.msg(`${left} drone${left > 1 ? 's' : ''} did not fit and were sold`, RF.HUD_COLORS.amber); }
    const st = game.ship.docked;
    const fa = game.ship.fa;
    game.ship = new RF.Ship(ns);
    game.ship.fa = fa;
    game.ship.docked = st;
    const dp = parkPoint(st);
    Object.assign(game.ship.body, { x: dp.x, y: dp.y, a: dp.a });
    game.fitZoom();
    game.save();
    return true;
  };

  // Hvor langt man kan zoome inn: minst så skipet fyller hele skjermen.
  game.maxZoom = () => {
    const R = RF.renderer, r = game.ship ? game.ship.body.radius : 8;
    return Math.max(10, Math.min(R.w, R.h) / (r * 1.1));
  };

  // Zoom slik at skipet fyller en fornuftig del av skjermen.
  game.fitZoom = () => {
    const r = game.ship.body.radius;
    game.cam.zoom = G.clamp((game.touchUI ? 42 : 64) / r, 0.03, 7);
  };

  function spawnDocked(stationId) {
    const def = RF.stationById(stationId);
    game.sys = game.getSystem(def.id);
    const st = game.sys.station;
    const dp = parkPoint(st);
    const b = game.ship.body;
    b.x = dp.x; b.y = dp.y; b.a = dp.a; b.vx = b.vy = b.w = 0;
    game.cam.x = b.x; game.cam.y = b.y;
    game.dead = false;
    game.fitZoom();
    dock(true);
  }

  // Der skipet ligger når det er dokket. Lange skip legges lenger ut, så
  // baugen ikke stikker inn i dokkingarmen.
  game.parkPoint = (st) => parkPoint(st);
  function parkPoint(st) {
    const dp = RF.dockPoint(st), out = Math.max(0, (game.ship.noseX || 0) * game.ship.body.s - 7);
    return { x: dp.x + Math.cos(st.a) * out, y: dp.y + Math.sin(st.a) * out, a: dp.a };
  }

  // --- Dokking ---
  function dock(silent) {
    const ship = game.ship, st = game.sys.station;
    ship.releaseAnchor(game);
    game.recallDronesNow();
    removeShipFromWorld();
    ship.docked = st;
    ship.nav = null;
    game.followShip(true);
    ship.tractor.on = false;
    if (ship.scoop) ship.scoop.on = false;
    const dp = parkPoint(st);
    Object.assign(ship.body, { x: dp.x, y: dp.y, a: dp.a, vx: 0, vy: 0, w: 0 });
    game.lastStation = st.id;
    refreshPrices(st.id);
    refreshBoard(st.id);
    // Passasjerer går av og på.
    game.dropPax(st.id, null, 'Passengers delivered');
    const picked = game.pickPax(st.id, Infinity, true).reduce((a, x) => a + x.k, 0);
    if (picked) game.msg(`${picked} passenger${picked > 1 ? 's' : ''} boarded`, RF.HUD_COLORS.gate);
    // Fraktoppdrag leveres automatisk.
    for (const m of game.missions) {
      if (m.status === 'aktiv' && m.type === 'frakt' && m.to === st.id) {
        m.status = 'fullført';
        ship.s.missionCargo = ship.s.missionCargo.filter((c) => c.missionId !== m.id);
        game.credits += m.reward;
        RF.Stations.gain(st.id, m.reward);
        game.msg(`Delivered: ${m.goods} (+${m.reward} cr)`, RF.HUD_COLORS.ok);
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
      // Malm dytter ikke skipet og gjør ingen skade.
      if (other.kind === 'ore') return;
      const dv = J * sb.invMass;
      if (dv < 0.5) return;
      const dmg = ship.takeImpact(dv, p.x, p.y, game);
      // Skjør last tåler bare små støt.
      for (const m of game.missions) {
        if (m.status === 'aktiv' && m.type === 'frakt' && m.fragile && dv > m.maxDv) {
          m.status = 'feilet';
          ship.s.missionCargo = ship.s.missionCargo.filter((x) => x.missionId !== m.id);
          ship.updateMass();
          game.msg(`${m.goods} was destroyed in the impact (${dv.toFixed(1)} m/s)`, RF.HUD_COLORS.danger);
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
      if (dmg > 0.5) game.msg(`Hull damage −${Math.ceil(dmg)} (${dv.toFixed(1)} m/s)`, RF.HUD_COLORS.danger);
      else if (dv > 2 && ship.shield > 0) game.msg(`Shield absorbed the impact (${dv.toFixed(1)} m/s)`, RF.HUD_COLORS.gate);
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
  game.pickBody = (x, y) => pickBody(x, y);
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

  // Hva et trykk på skjermen betyr (game.pointerMode):
  //  - trykk på en stein: siktet låses til steinen, verktøyet brukes mens man holder
  //  - kort trykk på tomt rom: skipet flyr dit og stopper (autopilot)
  //  - dra: flytt kameraet (skipet blir alltid værende på skjermen)
  //  - hold stille på tomt rom: sikt og skyt dit
  //  - trykk på eget skip: kameraet sentreres igjen
  // Høyre- eller midtknappen på musa drar alltid kameraet.
  const HOLD_MS = 350;
  const toWorld = (sx, sy) => ({ x: game.cam.x + (sx - RF.renderer.w / 2) / game.cam.zoom, y: game.cam.y + (sy - RF.renderer.h / 2) / game.cam.zoom });

  function updateAim() {
    const P = Input.pointer, ship = game.ship;
    if (!P.has || ship.docked) {
      game.aim = ship.body.toWorld(ship.noseX + 80, 0);
      game.aimLock = null;
      game.pointerMode = null;
      P.taps.length = 0;
      return;
    }
    const wp = toWorld(P.x, P.y);
    // Nytt trykk (også et kort trykk som var over før denne rammen).
    if (P.presses !== game._aimPress) {
      game._aimPress = P.presses;
      const w0 = toWorld(P.x0, P.y0);
      if (P.button !== 0) game.pointerMode = 'pan';
      else if (ship.body.containsPoint(w0.x, w0.y)) game.pointerMode = 'ship';
      else {
        const b = pickBody(w0.x, w0.y);
        if (b) {
          game.aimLock = { body: b, l: b.toLocal(w0.x, w0.y) };
          game.pointerMode = 'aim';
          Input.press('Fire');
        } else game.pointerMode = 'pending';
      }
    }
    const mode = game.pointerMode;
    if (P.down) {
      const w0 = toWorld(P.x0, P.y0);
      if (mode === 'pending') {
        if (P.moved) game.pointerMode = 'pan';
        else if (performance.now() - P.t0 > HOLD_MS) {
          // Hold fingeren: målet settes her. Dra videre for å velge hvilken
          // vei skipet skal peke når det er fremme.
          game.pointerMode = 'navset';
          game.setNav(w0.x, w0.y);
        }
      } else if (mode === 'aim' && game.aimLock && P.moved && G.len(P.x - P.x0, P.y - P.y0) > 30) game.aimLock = null;
      else if (mode === 'ship' && P.moved) {
        // Trykk på skipet og dra: skipet snur seg dit uten å flytte seg.
        game.pointerMode = 'rotate';
        ship.nav = { x: ship.body.x, y: ship.body.y, body: null, l: null, arrived: true, rotate: true, heading: ship.body.a };
      }
      if (game.pointerMode === 'navset' && ship.nav && G.len(P.x - P.x0, P.y - P.y0) > 18) {
        ship.nav.heading = Math.atan2(P.y - P.y0, P.x - P.x0);
      } else if (game.pointerMode === 'rotate' && ship.nav) {
        const sp = RF.renderer.toScreen(game.cam, ship.body.x, ship.body.y);
        if (G.len(P.x - sp.x, P.y - sp.y) > 12) ship.nav.heading = Math.atan2(P.y - sp.y, P.x - sp.x);
      }
    }
    // Kameraet følger fingeren når man drar.
    // Kameraet løsner fra skipet og blir stående der man slipper det.
    if (game.pointerMode === 'pan' && (P.panX || P.panY)) {
      if (!game.camFree) game.camFree = { x: game.cam.x, y: game.cam.y };
      game.camFree.x -= P.panX / game.cam.zoom;
      game.camFree.y -= P.panY / game.cam.zoom;
      game.cam.x -= P.panX / game.cam.zoom;
      game.cam.y -= P.panY / game.cam.zoom;
    }
    P.panX = P.panY = 0;
    // Korte trykk: fly dit, eller sentrer kameraet.
    while (P.taps.length) {
      const t = P.taps.shift();
      if (t.press !== game._aimPress) continue;
      const w = toWorld(t.x, t.y);
      if (mode === 'ship') game.followShip();
      else if (mode === 'pending') game.setNav(w.x, w.y);
    }
    const L = game.aimLock;
    if (L && L.body.dead) game.aimLock = null;
    if (game.aimLock) {
      const b = L.body;
      game.aim = b.toWorld(L.l.x, L.l.y);
    } else if ((P.down && game.pointerMode === 'aim') || (P.type === 'mouse' && game.pointerMode !== 'pan')) {
      game.aim = wp;
      game.aimWorld = wp;
    } else game.aim = game.aimWorld || ship.body.toWorld(ship.noseX + 80, 0);
  }

  // Hold posisjon: skipet ligger stille der det er. Er det en stein i
  // nærheten, følger skipet steinen (også når den driver eller snur seg), så
  // man kan skjære i ro. A/D snur skipet, W/S/Q/E eller B igjen slipper.
  game.toggleHold = () => {
    const ship = game.ship, b = ship.body;
    if (ship.docked || game.dead) return;
    if (ship.nav && ship.nav.hold) {
      ship.nav = null;
      game.msg('Hold released', RF.HUD_COLORS.amber);
      Audio.blip(500, 0.05, 'sine', 0.06);
      return;
    }
    // Steinen man peker på eller har låst siktet på, ellers den nærmeste.
    const hv = RF.Scan.hoverBody(game);
    let near = null, nd = 150;
    if (hv && hv.kind === 'rock' && hv.radius >= 4 && G.len(hv.x - b.x, hv.y - b.y) - hv.radius - b.radius < 250) near = hv;
    else for (const o of game.sys.world.bodies) {
      if (o.kind !== 'rock' || o.dead || o.radius < 4) continue;
      const d = G.len(o.x - b.x, o.y - b.y) - o.radius - b.radius;
      if (d < nd) { nd = d; near = o; }
    }
    // Snurrer steinen, holder skipet avstand og retning i rommet og lar steinen
    // snurre foran seg (som en dreiebenk). Ellers følger det steinens rotasjon.
    const spin = near && Math.abs(near.w) > 0.05;
    ship.nav = { x: b.x, y: b.y, body: near, l: near && !spin ? near.toLocal(b.x, b.y) : null, off: spin ? { x: b.x - near.x, y: b.y - near.y } : null,
      arrived: true, hold: true, heading: b.a, headRel: near && !spin ? b.a - near.a : 0 };
    const rv = near ? G.len(near.vx - b.vx, near.vy - b.vy) : 0;
    game.msg(near ? `Holding position at the asteroid${rv > 1 ? ', matching its speed' : ''}. B to release` : 'Holding position. B to release', RF.HUD_COLORS.ok);
    Audio.blip(760, 0.06, 'sine', 0.07);
  };

  // Autopilot: fly til et punkt og stopp der. Ligger punktet like ved en
  // stein, følger målet steinen mens den driver.
  game.setNav = (x, y, heading = null) => {
    const ship = game.ship;
    let near = null, nd = 40;
    for (const b of game.sys.world.bodies) {
      if (b.kind !== 'rock' || b.dead) continue;
      const d = G.len(b.x - x, b.y - y) - b.radius;
      if (d < nd) { nd = d; near = b; }
    }
    ship.nav = { x, y, body: near, l: near ? near.toLocal(x, y) : null, arrived: false, heading };
    game.msg('Moving to target', RF.HUD_COLORS.gate);
    Audio.blip(700, 0.05, 'sine', 0.06);
  };

  game.navPoint = () => {
    const N = game.ship.nav;
    if (!N) return null;
    if (N.body && N.body.dead) N.body = null;
    if (N.body && N.off) return { x: N.body.x + N.off.x, y: N.body.y + N.off.y };
    return N.body ? N.body.toWorld(N.l.x, N.l.y) : { x: N.x, y: N.y };
  };

  // Ønsket akselerasjon mot målet: full fart mot det, og bremsing i tide.
  // Hva som ligger i veien mellom to punkter: tre parallelle stråler (midt i
  // skipet og ved begge sider). Løse malmbiter og egne droner teller ikke.
  function blockedPath(ax, ay, bx, by, R) {
    const ws = game.sys.world, sb = game.ship.body;
    const dx = bx - ax, dy = by - ay, L = G.len(dx, dy);
    if (L < 1) return null;
    const ux = dx / L, uy = dy / L, px = -uy, py = ux;
    const skip = (o) => o === sb || o.ghost || o.dead || o.kind === 'ore' || RF.isSmallRock(o) || (o.npc && o.npc.own);
    const w = R + 6; // litt margin utenfor skroget
    let best = null;
    for (const off of [0, w, -w, w / 2, -w / 2]) {
      const h = ws.raycast(ax + px * off, ay + py * off, ux, uy, L, (o) => !skip(o));
      // Treff helt inntil målet (når målet ligger ved en stein) teller ikke.
      if (h && h.t < L - R * 1.5 && (!best || h.t < best.t)) best = h;
    }
    // Små steiner kan gli mellom strålene: sjekk avstanden fra ruten til dem.
    for (const o of ws.bodies) {
      if (o.radius > 20 || o.isStatic || skip(o)) continue;
      const cx = o.x - ax, cy = o.y - ay;
      const t = cx * ux + cy * uy;
      if (t < 0 || t > L - R * 1.5) continue;
      if (Math.abs(cx * uy - cy * ux) > o.radius + w) continue;
      const tt = Math.max(0, t - o.radius);
      if (!best || tt < best.t) best = { body: o, t: tt, x: ax + ux * tt, y: ay + uy * tt };
    }
    return best;
  }

  // Omkretsen til hindringen (hele stasjonen og porten regnes som én ting).
  function obstacleCircle(o) {
    const st = game.sys.station, gt = game.sys.gate;
    if (o.kind === 'station') return { x: st.x, y: st.y, r: RF.Stations.level(st.id) >= 5 ? 150 : 125 };
    if (o.kind === 'gate') { const gg = o.gate || gt; return { x: gg.x, y: gg.y, r: gg.R + 6 }; }
    return { x: o.x, y: o.y, r: o.radius };
  }

  // Et punkt rundt hindringen som kan nås i rett linje, og som gir kortest vei
  // videre til målet. Siden man valgte sist foretrekkes, så ruten ikke vingler.
  function detour(from, to, R, prevSide) {
    const h = blockedPath(from.x, from.y, to.x, to.y, R);
    if (!h) return null;
    const c = obstacleCircle(h.body);
    const clear = c.r + R + 20;
    const base = Math.atan2(from.y - c.y, from.x - c.x);
    let best = null;
    for (let k = 1; k <= 9; k++) {
      for (const side of [1, -1]) {
        const a = base + side * k * 0.35;
        const w = { x: c.x + Math.cos(a) * clear, y: c.y + Math.sin(a) * clear, side };
        if (blockedPath(from.x, from.y, w.x, w.y, R)) continue;
        let cost = G.len(w.x - from.x, w.y - from.y) + G.len(to.x - w.x, to.y - w.y);
        if (prevSide && side !== prevSide) cost *= 1.25;
        if (!best || cost < best.cost) best = Object.assign(w, { cost });
      }
      if (best) break;
    }
    return best;
  }

  function navInput(inp) {
    const ship = game.ship, b = ship.body, N = ship.nav, st = ship.stats;
    // I testmodus styrer autopiloten unna hindringer på alle skip, også uten
    // navigasjonsdatamaskin.
    const navc = st.navcomp || game.testMode;
    const p = game.navPoint();
    let tvx = 0, tvy = 0;
    if (N.body && N.off) { tvx = N.body.vx; tvy = N.body.vy; }
    else if (N.body) { const v = N.body.pointVel(p.x, p.y); tvx = v.x; tvy = v.y; }
    N.x = p.x; N.y = p.y;
    let dx = p.x - b.x, dy = p.y - b.y;
    const d = G.len(dx, dy) || 1e-6;
    const rvx = b.vx - tvx, rvy = b.vy - tvy;
    const aB = Math.max(st.retro + st.strafe, (st.thrust || 0) * 0.6) / b.mass;
    let vd = Math.min(45, Math.sqrt(2 * aB * 0.55 * Math.max(0, d - 0.6)));
    const R = b.radius;
    // Unnamanøver: med navigasjonsdatamaskin styrer autopiloten rundt steiner,
    // stasjonen og andre skip. Ruten sjekkes på nytt sju ganger i sekundet.
    if (!N.rotate && d > R * 2) {
      N.check = (N.check || 0) - 1;
      if (N.check <= 0) {
        N.check = 18;
        if (navc) {
          if (N.via && G.len(N.via.x - b.x, N.via.y - b.y) < R + 10) N.via = null;
          if (!blockedPath(b.x, b.y, p.x, p.y, R)) N.via = null;
          else if (!N.via || blockedPath(b.x, b.y, N.via.x, N.via.y, R)) {
            const w = detour({ x: b.x, y: b.y }, p, R, N.via ? N.via.side : N.side);
            if (w && !N.via && !N.planned) { N.planned = true; game.msg('Course plotted around an obstacle', RF.HUD_COLORS.gate); }
            if (w) N.side = w.side;
            N.via = w;
          }
          // Hvor nær er nærmeste hindring? Nær steiner snur ikke skipet fort,
          // for da feier tuppen av skroget inn i dem.
          let minC = Infinity;
          for (const o of game.sys.world.bodies) {
            if (o === b || o.ghost || o.dead || o.kind === 'ore' || RF.isSmallRock(o) || (o.npc && o.npc.own)) continue;
            const c = G.len(o.x - b.x, o.y - b.y) - o.radius - R;
            if (c < minC) minC = c;
          }
          N.clear = minC;
          // Fartsgrense: kan skipet stoppe før det den faktisk driver mot?
          const sp = G.len(rvx, rvy);
          N.safeV = Infinity;
          if (sp > 2) {
            const look = (sp * sp) / (2 * aB) * 1.6 + R + 40;
            const h = blockedPath(b.x, b.y, b.x + (rvx / sp) * look, b.y + (rvy / sp) * look, R);
            N.safeT = h ? h.t : Infinity;
            if (h) N.safeV = Math.sqrt(2 * aB * 0.5 * Math.max(0, h.t - R - 8));
          }
        } else if (!N.warned && blockedPath(b.x, b.y, p.x, p.y, R)) {
          N.warned = true;
          game.msg('Obstacle ahead. A navigation computer lets the autopilot steer around it', RF.HUD_COLORS.amber);
        }
      }
      if (N.via && navc) {
        dx = N.via.x - b.x; dy = N.via.y - b.y;
        vd = Math.min(vd, 25);
      }
      // Fartsgrensen gjelder ikke når skipet allerede flyr rett mot et
      // omveispunkt som er sjekket og fritt (ellers kryper det langs steinen).
      const rs = G.len(rvx, rvy), dd = G.len(dx, dy) || 1;
      const onCourse = N.via && rs > 0.5 && (rvx * dx + rvy * dy) / (rs * dd) > 0.9 && N.safeT > dd + R;
      if (navc && N.safeV != null && !onCourse) vd = Math.min(vd, Math.max(1.5, N.safeV));
    } else N.via = null;
    const dl = G.len(dx, dy) || 1e-6;
    const ax = ((dx / dl) * vd - rvx) * 2.5, ay = ((dy / dl) * vd - rvy) * 2.5;
    if (!N.arrived && !N.rotate && d < 2 && G.len(rvx, rvy) < 0.5) {
      N.arrived = true;
      game.msg('Arrived', RF.HUD_COLORS.ok);
    }
    // På vei: nesen i fartsretningen. I lav fart peker nesen dit skipet skal
    // akselerere, og etter hvert som farten øker tar fartsretningen over.
    // Nær målet: den retningen spilleren valgte.
    const near = navc && N.clear != null && N.clear < 20;
    // Nær en hindring snur skipet bare sakte (tuppen av skroget maks 2,5 m/s).
    const hx = rvx + (dx / dl) * 3, hy = rvy + (dy / dl) * 3;
    let aim = d > 30 && !N.arrived && !N.rotate ? Math.atan2(hy, hx) : N.heading != null ? N.heading : null;
    if (N.hold) aim = N.body && !N.off ? N.body.a + N.headRel : N.heading;
    const maxW = near || N.hold ? Math.max(0.1, 2.5 / R) : null;
    const out = Object.assign({}, inp, { accel: { x: ax, y: ay }, aim, aimThrust: 0, maxW });
    if (N.hold) out.turn = 0;
    return out;
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

  game.toggleScoop = () => {
    const ship = game.ship, S = ship.scoop || (ship.scoop = { on: false, open: 0, caught: 0 });
    S.on = !S.on;
    Audio.thud(0.25, false);
    Audio.blip(S.on ? 260 : 180, 0.18, 'triangle', 0.08);
    game.msg(S.on ? 'Cargo scoop open. Fly slowly into the ore to catch it (U or F to close)' : 'Cargo scoop closed', S.on ? RF.HUD_COLORS.ok : RF.HUD_COLORS.gate);
  };

  game.tryIntake = (o) => {
    const ship = game.ship;
    // Malmen tas inn så lenge det den blir til får plass i lasterommet.
    // (Før stoppet inntaket når 25 t ventet på prosessering, og bitene
    // hopet seg opp foran innsamleren.)
    if (ship.holdFree() - ship.procProduct() <= 0.02) {
      if (!game._fullWarn || game.time - game._fullWarn > 4) {
        game._fullWarn = game.time;
        game.msg('Cargo hold is full', RF.HUD_COLORS.amber);
      }
      return;
    }
    o.dead = true;
    ship.processing.push({ mat: o.kind === 'wreck' ? 'skrap' : o.mat, mass: o.mass });
    ship.updateMass();
    const ip = o._tractorFrom || ship.body;
    game.particles.burst(ip.x, ip.y, 8, { type: 'glow', sMin: 1, sMax: 4, color: '#7dffd2', zMin: 0.15, zMax: 0.3, lMin: 0.2, lMax: 0.5, vx: ship.body.vx, vy: ship.body.vy });
    Audio.pickup();
  };

  game.onProcessed = (p) => {
    const M = RF.MATERIALS[p.mat];
    if (p.fuel > 1) game.msg(`+${Math.round(p.fuel)} kg fuel`, RF.PRODUCTS[M.product].color);
    if (p.made > 0.005) game.msg(`+${p.made.toFixed(2)} t ${RF.PRODUCTS[M.product].name}`, RF.PRODUCTS[M.product].color);
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
    // En stor modul tar med seg sine egne ruter.
    dead = dead.concat(...dead.map((m) => RF.partsOf(s.layout, m)));
    const lostCockpit = dead.some((m) => m.t === 'cockpit');
    for (const m of dead) {
      const p = b.toWorld(m.lx, m.ly);
      game.particles.burst(p.x, p.y, 30, { sMin: 4, sMax: 25, color: '#ffcf80', zMin: 0.2, zMax: 0.5, lMin: 0.3, lMax: 1, vx: b.vx, vy: b.vy });
      game.particles.burst(p.x, p.y, 14, { type: 'smoke', sMin: 1, sMax: 5, color: '#5d5a52', zMin: 1, zMax: 2.5, grow: 3, lMin: 1, lMax: 2.5, vx: b.vx, vy: b.vy });
      if (m.t !== 'part') game.msg(`Lost ${RF.MODULES[m.t].name.toLowerCase()}`, RF.HUD_COLORS.danger);
    }
    Audio.boom(0.7);
    game.shake = Math.min(1, game.shake + 0.6);
    s.layout = s.layout.filter((m) => !dead.includes(m));
    const loose = lostCockpit ? s.layout.slice() : RF.disconnected(s.layout);
    s.layout = s.layout.filter((m) => !loose.includes(m));
    game.spawnWreck(dead.map((m) => Object.assign({}, m, { hp: 1 })).concat(loose), b);
    if (loose.length && !lostCockpit) game.msg(`${loose.length} module${loose.length > 1 ? 's' : ''} broke off`, RF.HUD_COLORS.danger);
    if (lostCockpit) { destroyShip(); return; }
    ship.rebuild();
    if (ship.anchor && ship.anchor.lost) ship.releaseAnchor(game);
  };

  // --- Egne droner ---
  // Hvor hver drone bor om bord (dronerom, hangardekk eller klemme).
  game.droneSlots = () => {
    const ship = game.ship;
    return RF.fitDrones(ship.s.layout, ship.stats, ship.s.drones).slots;
  };

  // Luker åpnes når en drone skal ut eller inn, og lukker seg etterpå.
  game.holdDoor = (m) => { if (m) m.doorUntil = game.time + 0.5; };
  function updateDoors(dt) {
    for (const m of game.ship.s.layout) {
      if (m.t !== 'dronebay' && m.t !== 'hangar') continue;
      const want = (m.doorUntil || 0) > game.time ? 1 : 0;
      m.door = G.clamp((m.door || 0) + Math.sign(want - (m.door || 0)) * dt * 1.8, 0, 1);
    }
  }

  game.launchDrones = () => {
    const ship = game.ship;
    const slots = game.droneSlots();
    const ready = slots.filter((x) => !x.d.trip && !x.d.out);
    // Er noen ute, kalles de hjem. Ellers sendes alle ut.
    const out = game.sys.npcs.filter((n) => n.owner === ship);
    if (out.length) { for (const n of out) n.recall(); game.msg('Recalling drones', RF.HUD_COLORS.gate); return; }
    if (!ready.length) {
      game.msg(ship.stats.bays ? 'No drones aboard. Buy one at a station' : 'The ship has no drone bay, hangar or docking clamp', RF.HUD_COLORS.amber);
      return;
    }
    ready.forEach((x, i) => {
      const T = RF.DRONE_TYPES[x.d.type];
      const n = new RF.NPC(T.npc, game.sys, RF.droneFit(ship.body.s, x.kind, T.npc));
      n.owner = ship;
      n.data = x.d;
      n.role = T.role;
      n.spec = T;
      n.dockM = x.m;
      n.dockKind = x.kind;
      n.index = i;
      x.d.out = true;
      // Små og mellomstore venter til luken er åpen. Etter hverandre fra samme luke.
      n.state = 'prelaunch';
      n.timer = x.kind === 'clamp' ? 0.2 + i * 0.15 : 0.7 + i * 0.45;
      game.holdDoor(x.m);
      game.sys.npcs.push(n);
    });
    game.msg(`${ready.length} drone${ready.length > 1 ? 's' : ''} launching`, RF.HUD_COLORS.gate);
  };

  game.droneHome = (n) => {
    n.despawn();
    n.returnLoad(game);
    n.data.out = false;
    game.sys.npcs = game.sys.npcs.filter((x) => x !== n);
  };

  game.droneLost = (n) => {
    const s = game.ship.s;
    n.returnLoad(game, true);
    s.drones = s.drones.filter((d) => d !== n.data);
    game.sys.npcs = game.sys.npcs.filter((x) => x !== n);
    game.msg(`${n.name} was lost`, RF.HUD_COLORS.danger);
  };

  // Alle droner inn i hangaren med en gang (ved dokking og portreiser).
  game.recallDronesNow = () => {
    for (const n of game.sys.npcs.filter((x) => x.owner)) game.droneHome(n);
  };

  // --- Passasjerer ---
  const paxMissions = () => game.missions.filter((m) => m.status === 'aktiv' && (m.type === 'pax' || m.type === 'crew'));
  game.paxAboard = () => paxMissions().reduce((a, m) => a + m.aboard, 0);
  game.paxFree = () => Math.max(0, (game.ship.stats.paxCap || 0) - game.paxAboard());

  game.completeMission = (m, how) => {
    m.status = 'fullført';
    game.credits += m.reward;
    if (game.ship.docked) RF.Stations.gain(game.ship.docked.id, m.reward);
    game.msg(`${how}: ${RF.missionTitle(m)} (+${m.reward} cr)`, RF.HUD_COLORS.ok);
    Audio.blip(660, 0.15, 'triangle', 0.12);
    Audio.blip(880, 0.2, 'triangle', 0.1);
  };

  // Folk går av på stasjonen. list = [{ m, k }] fra en drone, ellers alle om bord.
  game.dropPax = (stationId, list, how) => {
    let n = 0;
    const items = list || paxMissions().filter((m) => m.type === 'pax' && m.to === stationId && m.aboard > 0).map((m) => ({ m, k: m.aboard }));
    for (const { m, k } of items) {
      if (!list) m.aboard -= k;
      m.moved += k;
      n += k;
      if (m.moved >= m.n) game.completeMission(m, how);
    }
    return n;
  };

  // Folk som venter på stasjonen går om bord (så langt det er plass).
  game.pickPax = (stationId, max, commit) => {
    const out = [];
    let free = Math.min(max, game.paxFree());
    for (const m of paxMissions()) {
      if (m.type !== 'pax' || m.from !== stationId || m.wait <= 0 || free <= 0) continue;
      const k = Math.min(m.wait, free);
      m.wait -= k;
      free -= k;
      if (commit) m.aboard += k;
      out.push({ m, k });
    }
    return out;
  };

  // --- Porten ---
  game.dial = (destId) => {
    const g = game.activeGate || game.sys.gate;
    if (g.state !== 'idle') return;
    g.state = 'dialing';
    g.t = 0;
    g.chevrons = 0;
    g.dest = destId;
    g.incoming = false;
    RF.UI.closeAll();
    game.msg(`Dialing ${RF.systemById(destId).name} …`, RF.HUD_COLORS.gate);
  };

  function updateGate(dt) {
    for (const g of RF.gatesOf(game.sys)) updateOneGate(g, dt);
  }

  function updateOneGate(g, dt) {
    const R = g.R, gk = R / RF.GATE_R;
    g.t += dt;
    if (g.state === 'dialing') {
      const ch = Math.min(7, Math.floor(g.t / 0.62));
      // Symbolsporet snurrer fram og tilbake mellom hver chevron.
      g.spin = (g.spin || 0) + dt * (g.chevrons % 2 ? -1.4 : 1.4);
      const cs0 = Math.cos(g.a), sn0 = Math.sin(g.a), gk0 = R / RF.GATE_R;
      const near = G.len(game.ship.body.x - g.x, game.ship.body.y - g.y) < 900 * gk0;
      if (ch > g.chevrons) {
        g.chevrons = ch; Audio.chevron(ch);
        // Gnister der chevronen låser.
        const a = -Math.PI / 2 + ((ch - 1) / 9) * Math.PI * 2;
        const lx = Math.cos(a) * (RF.GATE_R + 2.4) * 0.34 * gk0, ly = Math.sin(a) * (RF.GATE_R + 2.4) * gk0;
        if (near) game.particles.burst(g.x + lx * cs0 - ly * sn0, g.y + lx * sn0 + ly * cs0, 14, { type: 'glow', sMin: 3 * gk0, sMax: 14 * gk0, color: '#ffb04a', zMin: 0.1, zMax: 0.3, lMin: 0.2, lMax: 0.6 });
      }
      if (g.chevrons >= 7 && g.t > 7 * 0.62 + 0.4) {
        g.state = 'kawoosh'; g.t = 0; Audio.kawoosh();
        // Åpningen: sjokkbølger, en sky av blå gnister forover, lysglimt og risting.
        g.waves = [{ t0: game.time }, { t0: game.time + 0.25 }, { t0: game.time + 0.55 }];
        if (near) {
          for (let i = 0; i < 90; i++) {
            const sp = G.rand(20, 110) * Math.sqrt(gk0), da = G.rand(-0.7, 0.7);
            const vx = Math.cos(g.a + da) * sp, vy = Math.sin(g.a + da) * sp;
            const off = G.rand(-1, 1) * g.R * 0.8;
            game.particles.burst(g.x - sn0 * off, g.y + cs0 * off, 1, { type: 'glow', sMin: 4, sMax: 12, color: i % 3 ? '#8fd0ff' : '#e8f8ff', zMin: 0.2, zMax: 0.6, lMin: 0.5, lMax: 1.4, vx, vy });
          }
          const dd = G.len(game.ship.body.x - g.x, game.ship.body.y - g.y) / gk0;
          game.flash = Math.max(game.flash || 0, G.clamp(1 - dd / 700, 0.15, 0.7));
          game.shake = Math.min(1, game.shake + G.clamp(1 - dd / 500, 0.2, 1));
        }
      }
    } else if (g.state === 'kawoosh') {
      // Alt som er foran porten i virvelen blir fordampet.
      const k = Math.sin(Math.min(1, g.t / RF.KAWOOSH_TIME) * Math.PI);
      const L = RF.KAWOOSH_LEN * k * gk;
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
              game.msg('Hit by the gate vortex!', RF.HUD_COLORS.danger);
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
      if (g.t > 0.6) { g.state = 'idle'; g.chevrons = 0; g.t = 0; g.incoming = false; g.dialedBy = null; g.warnedWide = false; }
    }

    // Reise gjennom horisonten, bare forfra og bare utgående.
    const b = game.ship.body;
    const cs = Math.cos(g.a), sn = Math.sin(g.a);
    const dx = b.x - g.x, dy = b.y - g.y;
    const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
    // Skipet må få plass mellom sidene i ringen.
    const half = Math.min(b.radius * 0.55, R * 0.8);
    if (g.state === 'open' && !g.incoming && g.prevLx > 0 && lx <= 0 && Math.abs(ly) + half < R) {
      transit(g, lx, ly);
      g.prevLx = undefined;
      return;
    }
    if (g.state === 'open' && !g.incoming && g.prevLx > 0 && lx <= 0 && Math.abs(ly) < R && !g.warnedWide) {
      g.warnedWide = true;
      game.msg(g.key === 'gate' ? 'The ship is too wide for this gate. Use the capital gate' : 'The ship is too wide for this gate', RF.HUD_COLORS.danger);
    }
    g.prevLx = lx;
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
    if (game.sys === npc.sys && G.len(sb.x - g.x, sb.y - g.y) < 600) game.msg('Incoming wormhole! Stay clear of the front of the gate', RF.HUD_COLORS.danger);
    return true;
  };

  function transit(g, lx, ly) {
    const ship = game.ship, b = ship.body;
    ship.releaseAnchor(game);
    game.recallDronesNow();
    RF.Weapons.reset();
    if (RF.Combat) RF.Combat.reset();
    const cs = Math.cos(g.a), sn = Math.sin(g.a);
    const vlx = b.vx * cs + b.vy * sn, vly = -b.vx * sn + b.vy * cs;
    const al = b.a - g.a;
    removeShipFromWorld();
    g.state = 'closing';
    g.t = 0;
    const dest = game.getSystem(g.dest);
    const dg = dest[g.key] || dest.gate;
    const gk = g.R / RF.GATE_R;
    dg.state = 'open'; dg.t = 0; dg.incoming = true; dg.chevrons = 7;
    // Rotasjon 180° i portens ramme: inn forfra her, ut forfra der.
    const nlx = 3 * gk - lx, nly = -ly;
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
    game.msg(`Arrived at ${dest.def.name}`, RF.HUD_COLORS.gate);
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
    Audio.boom(1);
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
    ns.fuel = 1e12; // fylt opp, se Ship.rebuild
    ns.ammo = st.rocketCap;
    ns.flares = st.flareCap;
    RF.Weapons.reset();
    if (RF.Combat) RF.Combat.reset();
    game.ship = new RF.Ship(ns);
    game.ship.fa = fa;
    RF.UI.closeAll();
    spawnDocked(game.lastStation);
    game.msg(`New hull from the insurance. Deductible ${fee} cr`, RF.HUD_COLORS.amber);
    return fee;
  };

  function towHome() {
    if (game.credits < TOW_COST) { game.msg('You cannot afford a tow', RF.HUD_COLORS.danger); return; }
    game.credits -= TOW_COST;
    const st = game.sys.station;
    game.msg(`Towed to ${st.name} (−${TOW_COST} cr)`, RF.HUD_COLORS.amber);
    game.ship.s.fuel = Math.max(game.ship.s.fuel, 5);
    dock();
  }

  // --- Oppdatering ---
  // Kameraet følger skipet igjen (knappen «Follow ship», tasten O eller trykk
  // på skipet).
  game.followShip = (quiet) => {
    const was = !!game.camFree;
    game.camFree = null;
    game.camOff.x = game.camOff.y = 0;
    if (was && !quiet) game.msg('Camera follows the ship', RF.HUD_COLORS.gate);
  };

  function updateCamera(dt) {
    const b = game.ship.body, cam = game.cam, R = RF.renderer;
    if (game.camFree) {
      // Fritt kamera: står stille over punktet, innenfor systemet.
      const F = game.camFree, st = game.sys.station, lim = 9000;
      const d = G.len(F.x - st.x, F.y - st.y);
      if (d > lim) { F.x = st.x + ((F.x - st.x) / d) * lim; F.y = st.y + ((F.y - st.y) / d) * lim; }
      const k = 1 - Math.exp(-dt * 12);
      cam.x += (F.x - cam.x) * k;
      cam.y += (F.y - cam.y) * k;
      cam.bx = cam.x; cam.by = cam.y;
      if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 2.5);
      return;
    }
    // Hvor langt kameraet kan flyttes bort fra skipet: halvannen skjerm i hver
    // retning. Er skipet utenfor bildet, viser en pil i kanten hvor det er.
    const mx = (R.w * 1.5) / cam.zoom, my = (R.h * 1.5) / cam.zoom;
    const off = game.camOff;
    off.x = G.clamp(off.x, -mx, mx);
    off.y = G.clamp(off.y, -my, my);
    const panned = off.x || off.y;
    const look = panned ? 0 : Math.min(R.w, R.h) * 0.22 / cam.zoom;
    let tx = b.x + b.vx * 0.9, ty = b.y + b.vy * 0.9;
    const dx = tx - b.x, dy = ty - b.y, dl = G.len(dx, dy);
    if (dl > look) { tx = b.x + (dl ? (dx / dl) * look : 0); ty = b.y + (dl ? (dy / dl) * look : 0); }
    tx += off.x; ty += off.y;
    const k = 1 - Math.exp(-dt * 4);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
    cam.x = G.clamp(cam.x, b.x - mx, b.x + mx);
    cam.y = G.clamp(cam.y, b.y - my, b.y + my);
    cam.bx = cam.x; cam.by = cam.y; // uten risting (til støvstripene)
    if (game.shake > 0) {
      const s = game.shake * 6 / cam.zoom;
      cam.x += G.rand(-s, s);
      cam.y += G.rand(-s, s);
      game.shake = Math.max(0, game.shake - dt * 2.5);
    }
  }

  // Stasjonsskjold: en boble som bremser og dytter bort steiner, kometer,
  // malm og vrak før de treffer stasjonen. Skip og droner slipper gjennom.
  // Løs gråstein innenfor skjoldet brennes bort av nærforsvarslasere.
  RF.STATION_SHIELD = { R: 240, inner: 150 };
  function updateStationShield(dt) {
    const st = game.sys.station, S = { R: RF.Stations.shieldR(st), inner: RF.STATION_SHIELD.inner };
    const fx = st.shieldFx || (st.shieldFx = { hits: [], zaps: [], zapT: 0 });
    fx.zapT -= dt;
    for (const o of game.sys.world.bodies) {
      if (o.dead || o.isStatic || o.kind === 'ship' || o.kind === 'npc' || o.kind === 'gate') continue;
      const dx = o.x - st.x, dy = o.y - st.y, d = G.len(dx, dy) - o.radius;
      if (d > S.R) continue;
      const nx = dx / (G.len(dx, dy) || 1), ny = dy / (G.len(dx, dy) || 1);
      // Nærforsvar: små biter av gråstein brennes bort.
      if (RF.Vox.isJunk(o) && o.area < 200 && fx.zapT <= 0) {
        fx.zapT = RF.Stations.zapCd(st);
        fx.zaps.push({ x: o.x, y: o.y, t: game.time });
        o.dead = true;
        game.particles.burst(o.x, o.y, 10, { type: 'smoke', sMin: 1, sMax: 3 + o.radius * 0.4, color: RF.MATERIALS[o.mat].light, zMin: 0.6, zMax: 1.4, grow: 2, lMin: 0.8, lMax: 1.8, vx: o.vx, vy: o.vy });
        if (Audio.near(o.x, o.y, 700) > 0.05) Audio.blip(900, 0.05, 'sine', 0.03 * Audio.near(o.x, o.y, 700));
        continue;
      }
      const vr = o.vx * nx + o.vy * ny; // fart ut fra stasjonen (negativ = på vei inn)
      const p = G.clamp((S.R - d) / (S.R - S.inner), 0, 1);
      // Bremser farten innover og dytter svakt ut, sterkere jo dypere inn.
      if (vr < 0) {
        const k = Math.min(1, dt * (1.5 + 10 * p * p));
        o.vx -= nx * vr * k; o.vy -= ny * vr * k;
      }
      o.vx += nx * (2 + 10 * p) * p * dt; o.vy += ny * (2 + 10 * p) * p * dt;
      // Glimt i skjoldet der noe treffer.
      if (vr < -1.2 && (!o._shT || game.time - o._shT > 1.2)) {
        o._shT = game.time;
        fx.hits.push({ a: Math.atan2(ny, nx), t: game.time, s: Math.min(1, -vr / 12 + o.radius / 60) });
        const v = Audio.near(o.x, o.y, 900);
        if (v > 0.05) Audio.thud(0.2 * v, true);
      }
    }
    fx.hits = fx.hits.filter((h) => game.time - h.t < 1.2);
    fx.zaps = fx.zaps.filter((z) => game.time - z.t < 0.25);
  }

  // Løs gråstein (biter uten verdi som har løsnet) smuldrer bort når det blir
  // for mye av den, eller når den er langt unna. Da holder spillet farten.
  const JUNK_MAX = 28, JUNK_FAR = 1400;
  function crumble(b, seen) {
    b.dead = true;
    if (seen) {
      const M = RF.MATERIALS[b.mat];
      game.particles.burst(b.x, b.y, 8 + Math.min(20, b.radius * 2), { type: 'smoke', sMin: 1, sMax: 3 + b.radius * 0.5, color: M.light, zMin: 0.6, zMax: 1.4, grow: 2, lMin: 1, lMax: 2.5, vx: b.vx, vy: b.vy });
      game.particles.burst(b.x, b.y, 6, { type: 'debris', sMin: 1, sMax: 4, color: M.base, zMin: 0.2, zMax: 0.5, lMin: 0.6, lMax: 1.4, vx: b.vx, vy: b.vy });
    }
  }

  function cleanupWorld() {
    const sys = game.sys, ws = sys.world, sb = game.ship.body;
    // Det som synes på skjermen nå (med litt margin).
    const R = RF.renderer, cam = game.cam;
    const viewR = (R ? G.len(R.w, R.h) / 2 / cam.zoom : 600) + 40;
    const seen = (b) => G.len(b.x - cam.x, b.y - cam.y) < viewR + b.radius;
    const junk = [];
    let comets = 0, ore = 0;
    for (const b of ws.bodies) {
      if (b.isStatic || b.kind === 'ship' || b.dead) continue;
      const d = G.len(b.x, b.y);
      if (b.comet) comets++;
      if (b.kind === 'ore') ore++;
      if (RF.Vox.isJunk(b)) {
        const ds = G.len(b.x - sb.x, b.y - sb.y);
        if (d > 3600 || (ds > JUNK_FAR && !seen(b))) { crumble(b, false); continue; }
        junk.push({ b, ds, on: seen(b) });
      }
      if (d > 3600) {
        if (b.comet || b.kind === 'ore') { b.dead = true; continue; }
        // Steiner som driver ut kommer inn igjen på motsatt side.
        b.x = -b.x * 0.95; b.y = -b.y * 0.95;
      }
      if (b.heat > 0) b.heat = Math.max(0, b.heat - 0.02);
    }
    if (comets < sys.def.comets) sys.respawnComet(false);
    // For mye løs gråstein: det som ikke synes og er lengst unna går først.
    // Det som synes smuldrer opp i støv, litt om gangen.
    if (junk.length > JUNK_MAX) {
      junk.sort((a, c) => (a.on - c.on) || (c.ds - a.ds));
      let n = junk.length - JUNK_MAX, shown = 0;
      for (let i = 0; i < junk.length && n > 0; i++) {
        if (junk[i].on && ++shown > 6) break;
        crumble(junk[i].b, junk[i].on);
        n--;
      }
    }
    // Hold antallet løse malmbiter nede.
    if (ore > 150) {
      const sb = game.ship.body;
      const list = ws.bodies.filter((b) => b.kind === 'ore').sort((a, c) => G.len(c.x - sb.x, c.y - sb.y) - G.len(a.x - sb.x, a.y - sb.y));
      for (let i = 0; i < ore - 130; i++) list[i].dead = true;
    }
  }

  function updateFlight(dt, inp) {
    const ship = game.ship;
    ship.fly(inp, dt, game);
    ship.gunCd = Math.max(0, ship.gunCd - dt);
    ship.rocketCd = Math.max(0, ship.rocketCd - dt);
    // Valgt verktøy brukes så lenge avtrekkeren holdes inne.
    const fire = inp.fire || (Input.pointer.down && game.pointerMode === 'aim');
    ship.updateTurrets(game.aim, dt);
    ship.updateLasers(fire && ship.tool === 'laser', dt, game);
    RF.Weapons.updateGuns(ship, fire && ship.tool === 'kanon', dt, game);
    RF.Combat.update(dt, game, Input.pointer.down && game.pointerMode === 'aim');
    ship.updateTractor(dt, game);
    ship.updateScoop(dt, game);
    ship.updateProcessing(dt, game);
    ship.updateDeflector(dt, game);
    updateDoors(dt);
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
    let dd = G.len(b.x - dp.x, b.y - dp.y);
    const spd = G.len(b.vx, b.vy);
    // Store skip passer ikke i dokkingarmen. De legger seg ved stasjonen, og
    // folk og last går over med skyttel.
    const big = b.radius > 30;
    if (big) dd = G.len(b.x - sys.station.x, b.y - sys.station.y) - b.radius - 150 < 150 ? 0 : 1e9;
    if (dd < DOCK_RANGE) {
      if (spd < DOCK_SPEED) {
        game.dockReady = true;
        game.prompt = big ? `[T] Hold position at ${sys.station.name} (shuttles take you aboard)` : `[T] Dock at ${sys.station.name}`;
        game.action = 'dock';
      } else {
        game.prompt = `Slow down to dock (${spd.toFixed(1)} > ${DOCK_SPEED} m/s)`;
      }
      return;
    }
    if (dd < 180) {
      game.prompt = 'Fly into the dashed ring at the end of the docking arm';
      return;
    }
    // Nærmeste port (vanlig eller kapitalport).
    let g = null, gd = Infinity;
    for (const x of RF.gatesOf(sys)) {
      const d = G.len(b.x - x.x, b.y - x.y) - (x.R - RF.GATE_R) * 1.5;
      if (d < gd) { gd = d; g = x; }
    }
    game.activeGate = g;
    if (g && gd < DIAL_RANGE) {
      if (g.state === 'idle') { game.prompt = `[G] Dial the ${g.key === 'gate2' ? 'capital gate' : 'gate'}`; game.action = 'dial'; }
      else if (g.state === 'dialing') game.prompt = `Locking chevron ${g.chevrons + 1} of 7 …`;
      else if (g.state === 'kawoosh') game.prompt = 'Keep clear of the gate!';
      else if (g.state === 'open' && !g.incoming) game.prompt = `Gate open to ${RF.systemById(g.dest).name}: fly in from the front`;
      return;
    }
    if (ship.s.fuel <= 0) { game.prompt = `[R] Emergency tow to ${sys.station.name} (${TOW_COST} cr)`; game.action = 'tow'; }
  }

  game.selectTool = (t) => {
    const ship = game.ship;
    ship.tool = t;
    const st = ship.stats;
    const have = { laser: st.lasers.length + st.drills.length, kanon: st.guns.length, rakett: st.rockets.length, anker: st.anchors.length }[t];
    game.msg(`Tool: ${RF.TOOL_NAMES[t]}${have ? '' : ' (not fitted)'}`, have ? RF.HUD_COLORS.gate : RF.HUD_COLORS.amber);
    Audio.blip(500, 0.04, 'square', 0.06);
  };

  function handleKeys() {
    if (Input.hit('KeyM')) {
      Audio.setMuted(!Audio.muted);
      game.msg(Audio.muted ? 'Sound off' : 'Sound on');
    }
    if (Input.hit('Escape') || Input.hit('KeyP')) {
      if (RF.UI.isOpen()) {
        if (!game.ship.docked && !game.dead) RF.UI.closeAll();
      } else if (!game.dead) RF.UI.openPause();
      return;
    }
    if (Input.hit('KeyH')) { RF.UI.openHelp(); return; }
    if (Input.hit('Tab')) {
      if (RF.UI.current() === 'map') { if (game.ship.docked) RF.UI.openStation(); else RF.UI.closeAll(); }
      else if (!RF.UI.isOpen() && !game.dead) RF.UI.openMap();
      return;
    }
    if (RF.UI.isOpen() || game.dead) return;
    if (Input.hit('Recenter') || Input.hit('Home') || Input.hit('KeyO')) game.followShip();
    const ship = game.ship;
    if (Input.hit('KeyZ')) {
      ship.fa = (ship.fa + 1) % 3;
      game.msg('Flight assist: ' + ['off (pure Newton)', 'damps rotation', 'full (also brakes speed)'][ship.fa], RF.HUD_COLORS.gate);
    }
    if (Input.hit('KeyX')) RF.Weapons.fireHarpoon(ship, game);
    if (Input.hit('KeyJ')) RF.Combat.dropFlares(game, true);
    if (Input.hit('KeyK')) game.launchDrones();
    if (Input.hit('KeyN')) RF.Scan.pulse(game);
    if (Input.hit('KeyB')) game.toggleHold();
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
    // F: traktorstrålen hvis skipet har en, ellers lasteluken foran.
    if (Input.hit('KeyF')) {
      if (ship.stats.tractors.length) {
        ship.tractor.on = !ship.tractor.on;
        Audio.blip(ship.tractor.on ? 300 : 200, 0.08, 'sine', 0.1);
      } else game.toggleScoop();
    }
    if (Input.hit('KeyU')) game.toggleScoop();
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
    let inp = RF.UI.isOpen() || game.dead || ship.docked ? { thrust: 0, turn: 0, strafe: 0, laser: false } : Input.state();
    // Autopiloten flyr til målet til man styrer selv.
    // Hold posisjon: A/D (eller styrespaken) snur skipet uten å slippe.
    const N0 = ship.nav;
    if (N0 && N0.hold && !ship.docked && !game.dead) {
      if (inp.turn) {
        const k = inp.turn * dt * 0.6;
        if (N0.body && !N0.off) N0.headRel += k; else N0.heading += k;
        inp = Object.assign({}, inp, { turn: 0 });
      }
      if (inp.aim != null) {
        if (N0.body && !N0.off) N0.headRel = inp.aim - N0.body.a; else N0.heading = inp.aim;
        inp = Object.assign({}, inp, { aim: null });
      }
    }
    if (ship.nav && !ship.docked && !game.dead) {
      if (inp.thrust || inp.turn || inp.strafe || inp.brake || inp.aim != null) {
        game.msg(ship.nav.hold ? 'Hold released' : 'Autopilot off', RF.HUD_COLORS.amber);
        ship.nav = null;
      } else if (!RF.UI.isOpen()) inp = navInput(inp);
    }
    if (!ship.docked && !game.dead) updateFlight(dt, inp);
    else if (ship.docked) ship.updateShield(dt);
    for (const n of game.sys.npcs.slice()) n.update(dt, game);
    RF.Weapons.update(dt, game);
    RF.Scan.update(dt, game);
    RF.Pirates.update(dt, game);
    updateStationShield(dt);
    // Steiner i bane gjennom feltet trekkes svakt mot midten av det.
    for (const o of game.sys.world.bodies) {
      const O = o.orbit;
      if (!O || o.dead) continue;
      o.vx -= O.k * (o.x - O.cx) * dt;
      o.vy -= O.k * (o.y - O.cy) * dt;
    }
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
          // Fint støv og gass som slipper ut på solsiden og blåses bakover.
          if (Math.random() < 0.35) {
            const a = sd + Math.PI + G.rand(-1.1, 1.1), r = c.radius * 0.95;
            game.particles.add({ type: 'debris', x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, vx: c.vx + Math.cos(sd) * G.rand(3, 8) + G.rand(-1, 1), vy: c.vy + Math.sin(sd) * G.rand(3, 8) + G.rand(-1, 1), life: G.rand(2, 5), size: G.rand(0.15, 0.4), color: G.pick(['#cfe6f0', '#e8f4f8', '#b8d4de']) });
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
      const idle = ship.docked || game.dead, fx = ship.fx;
      Audio.update(idle ? 0 : Math.max(fx.main, fx.retro * 0.6),
        ship.laser.on && !game.dead, ship.tractor.on && !ship.docked && !game.dead, !!ship.laser.hit,
        idle || ship.nav ? 0 : Math.min(1, (fx.left + fx.right) * 0.6 + (fx.rotL + fx.rotR) * 0.3));
      const cut = game._cut && game.time - game._cut.t < 0.12 && !game.dead;
      Audio.updateCut(cut, cut ? game._cut.hard : 1, cut && game._cut.mineral);
    }
    game.topUp();
    // Knappen «Follow ship» vises bare når kameraet står fritt.
    const fb = game._followBtn || (game._followBtn = document.getElementById('cam-follow'));
    if (fb) {
      const want = !!game.camFree && game.state === 'play' && !RF.UI.isOpen() && !game.ship.docked && !game.dead;
      if (fb.hidden === want) {
        fb.hidden = !want;
        fb.classList.toggle('touch', !!game.touchUI);
      }
    }
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
      game.cam.zoom = G.clamp(game.cam.zoom * f, 0.02, game.maxZoom());
    }, { passive: false });
    game.touchUI = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    // Knip med to fingre for å zoome.
    RF.Input.onPinch = (f) => { game.cam.zoom = G.clamp(game.cam.zoom * f, 0.02, game.maxZoom()); };
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
