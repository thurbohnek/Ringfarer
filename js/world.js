// Materialer, varer, stjernesystemer, stasjoner og porter.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  // density er flatetetthet i kg/m² (2D-verden), grade er andelen av råmassen
  // som blir ferdig vare etter prosessering om bord. hard er hvor sterk laser
  // som trengs (1–4). Harde steiner kan også knuses med kanon og raketter.
  RF.MATERIALS = {
    kondritt: { name: 'Kondritt', product: 'jern', density: 1500, grade: 0.35, hard: 1,
      base: '#6f655b', dark: '#3a332d', light: '#a09282' },
    silikat: { name: 'Silikat', product: 'silisium', density: 1400, grade: 0.4, hard: 1,
      base: '#9c8a6a', dark: '#54472f', light: '#d8c59c' },
    karbon: { name: 'Karbonkondritt', product: 'grafitt', density: 1100, grade: 0.5, hard: 1,
      base: '#2e2c2f', dark: '#121113', light: '#5e5a62' },
    is: { name: 'Is', product: 'vann', density: 750, grade: 0.85, hard: 1,
      base: '#9aa6ad', dark: '#3e464c', light: '#e4ecf0' },
    metall: { name: 'Nikkel-jern', product: 'nikkel', density: 2600, grade: 0.6, hard: 2,
      base: '#5f6873', dark: '#2a3038', light: '#b7c2cf' },
    kobber: { name: 'Kobbermalm', product: 'kobber', density: 2300, grade: 0.3, hard: 2,
      base: '#3f7a66', dark: '#1b3a30', light: '#86d4b4', vein: '#e0874a' },
    titan: { name: 'Titanmalm', product: 'titan', density: 2200, grade: 0.25, hard: 3,
      base: '#aeb3b8', dark: '#63686e', light: '#f2f4f6' },
    gull: { name: 'Gullførende kvarts', product: 'gull', density: 3000, grade: 0.08, hard: 3,
      base: '#4d4330', dark: '#221c10', light: '#8f8058', vein: '#ffd04a' },
    naquadah: { name: 'Naquadah-malm', product: 'naquadah', density: 3400, grade: 0.25, hard: 4,
      base: '#2c323d', dark: '#141820', light: '#4a5465', vein: '#5dffc8' },
    trinium: { name: 'Triniumkrystall', product: 'trinium', density: 2000, grade: 0.12, hard: 4,
      base: '#5a2f7a', dark: '#2a1238', light: '#c29ae6', vein: '#f0c8ff', crystal: true },
  };

  // Vrakdeler fra skip som er slått i stykker. Kan samles inn og selges som skrap.
  RF.MATERIALS.skrap = { name: 'Vrakdeler', product: 'skrap', density: 900, grade: 0.6, hard: 1,
    base: '#6d6a60', dark: '#2a2824', light: '#b8b2a2' };

  RF.PRODUCTS = {
    jern: { name: 'Jern', price: 42, color: '#c79a6b' },
    silisium: { name: 'Silisium', price: 55, color: '#d8c59c' },
    grafitt: { name: 'Grafitt', price: 35, color: '#8a868e' },
    vann: { name: 'Vannis', price: 30, color: '#9fd8ff' },
    nikkel: { name: 'Nikkel-jern', price: 96, color: '#b7c2cf' },
    kobber: { name: 'Kobber', price: 150, color: '#e0874a' },
    titan: { name: 'Titan', price: 380, color: '#e8ecef' },
    gull: { name: 'Gull', price: 2600, color: '#ffd04a' },
    naquadah: { name: 'Naquadah', price: 1150, color: '#5dffc8' },
    trinium: { name: 'Trinium', price: 3800, color: '#e0b0ff' },
    skrap: { name: 'Skrapmetall', price: 60, color: '#a39c8c' },
  };

  // Asteroidetyper. core = kjernen under et islag, vein = årer av et annet
  // mineral som dukker opp i noen av bitene.
  RF.ROCK_TYPES = {
    kondritt: { mat: 'kondritt' },
    silikat: { mat: 'silikat' },
    karbon: { mat: 'karbon', vein: 'is', veinP: 0.12 },
    is: { mat: 'is' },
    metall: { mat: 'metall', vein: 'kobber', veinP: 0.15 },
    kobber: { mat: 'kobber' },
    titan: { mat: 'titan' },
    gull: { mat: 'gull', vein: 'gull', veinP: 0 },
    naquadah: { mat: 'naquadah' },
    trinium: { mat: 'trinium' },
    iskledd: { mat: 'is', core: { metall: 0.4, kobber: 0.3, titan: 0.2, gull: 0.1 }, coreFrac: 0.45 },
  };

  // Største bit (m²) som får plass i inntaket og kan prosesseres.
  RF.ORE_MAX_AREA = 4.5;
  // Biter under dette blir bare støv.
  RF.DUST_AREA = 0.22;

  RF.SYSTEMS = [
    {
      id: 'midgard',
      name: 'Midgard',
      blurb: 'Hjemsystemet. Rolig asteroidebelte med jern og nikkel.',
      sky: { deep: '#020409', neb: ['#1c3358', '#3a2150', '#123a4a'], star: '#ffd9a0', starDir: -2.3 },
      planet: { color: '#3f6fa8', band: '#6aa0d8', r: 0.26, x: 0.82, y: 0.78, ring: false },
      station: { id: 'midgard', name: 'Midgard Verft', x: 0, y: 0, a: 0,
        prices: { jern: 1.0, nikkel: 1.05, vann: 1.1, naquadah: 1.15, titan: 1.1, trinium: 1.2, skrap: 1.2 } },
      npcs: { drone: 3, hauler: 1 },
      gate: { x: 900, y: -1100, a: Math.PI * 0.6 },
      glyphs: [0, 3, 5, 1, 6, 2, 4],
      fields: [
        { cx: 700, cy: 650, rx: 900, ry: 420, rot: 0.3, count: 62, rMin: 3, rMax: 26, drift: 1.2,
          types: { kondritt: 0.3, silikat: 0.2, karbon: 0.15, metall: 0.2, iskledd: 0.1, kobber: 0.05 } },
        { cx: -900, cy: -500, rx: 450, ry: 300, rot: -0.6, count: 22, rMin: 2.5, rMax: 16, drift: 1.0,
          types: { kondritt: 0.5, silikat: 0.3, karbon: 0.2 } },
      ],
      comets: 0,
    },
    {
      id: 'vanaheim',
      name: 'Vanaheim',
      blurb: 'Handelspost. Kometer med rent is suser gjennom systemet.',
      sky: { deep: '#020605', neb: ['#12433d', '#1e3a5c', '#0f2a2a'], star: '#cfe8ff', starDir: 0.7 },
      planet: { color: '#b58a52', band: '#e0c08a', r: 0.42, x: 0.18, y: 0.2, ring: true },
      station: { id: 'vanaheim', name: 'Vanaheim Handelspost', x: 0, y: 0, a: Math.PI,
        prices: { jern: 1.25, nikkel: 1.2, vann: 0.7, naquadah: 1.0, kobber: 1.25, grafitt: 1.3, gull: 1.1 } },
      npcs: { drone: 1, hauler: 2 },
      gate: { x: -1200, y: 700, a: -0.4 },
      glyphs: [2, 6, 1, 4, 0, 5, 3],
      fields: [
        { cx: 1100, cy: -300, rx: 700, ry: 500, rot: 0.9, count: 38, rMin: 3, rMax: 20, drift: 1.6,
          types: { is: 0.25, iskledd: 0.25, metall: 0.2, kobber: 0.15, titan: 0.1, silikat: 0.05 } },
      ],
      comets: 7,
    },
    {
      id: 'muspel',
      name: 'Muspelheim',
      blurb: 'Farlig. Tett felt i rask bevegelse, men rikt på naquadah.',
      sky: { deep: '#070203', neb: ['#5a1a10', '#3a0f22', '#6a3a10'], star: '#ff9a5a', starDir: 1.9 },
      planet: { color: '#7a2a1a', band: '#d8642a', r: 0.3, x: 0.75, y: 0.22, ring: false },
      station: { id: 'muspel', name: 'Surtr Borestasjon', x: 0, y: 0, a: -Math.PI / 2,
        prices: { jern: 1.3, nikkel: 1.35, vann: 2.6, naquadah: 0.9, silisium: 1.4, titan: 0.9 } },
      npcs: { drone: 2, hauler: 1 },
      gate: { x: 700, y: 1100, a: -Math.PI * 0.35 },
      glyphs: [5, 1, 4, 6, 3, 0, 2],
      fields: [
        { cx: 1300, cy: -200, rx: 800, ry: 700, rot: 0.2, count: 70, rMin: 2.5, rMax: 22, drift: 7,
          stream: { x: -1, y: 0.35 }, types: { naquadah: 0.18, gull: 0.14, trinium: 0.08, titan: 0.15, metall: 0.25, karbon: 0.2 } },
        { cx: -700, cy: -900, rx: 500, ry: 400, rot: 0.2, count: 26, rMin: 2.5, rMax: 18, drift: 3,
          types: { metall: 0.35, kobber: 0.25, gull: 0.15, titan: 0.15, naquadah: 0.1 } },
      ],
      comets: 0,
    },
  ];

  RF.systemById = (id) => RF.SYSTEMS.find((s) => s.id === id);
  RF.stationById = (id) => RF.SYSTEMS.find((s) => s.station.id === id);

  RF.GATE_R = 16;

  // Lager en asteroide (eller en malmbit hvis den er liten nok).
  // extra: { core, coreArea, vein, veinP } fra asteroidetypen.
  RF.makeRock = (verts, mat, o, extra) => {
    const M = RF.MATERIALS[mat];
    const b = new RF.Body(verts, M.density, Object.assign({ restitution: mat === 'is' ? 0.12 : 0.22, friction: 0.6 }, o));
    b.mat = mat;
    if (extra) {
      if (extra.core) { b.core = extra.core; b.coreArea = extra.coreArea; }
      if (extra.vein) { b.vein = extra.vein; b.veinP = extra.veinP || 0; }
    }
    RF.classifyRock(b);
    b.stress = 0;
    b.heat = 0;
    // Toppunktet for fasettene (kantete lys og skygge), som andel av radien.
    b.apex = { x: G.rand(-0.25, 0.25), y: G.rand(-0.25, 0.25) };
    b.shade = Array.from({ length: 12 }, () => G.rand(-0.12, 0.12));
    const r = b.radius;
    b.craters = [];
    const nc = b.kind === 'ore' ? 0 : G.randInt(Math.min(2, Math.floor(r / 6)), Math.min(7, 1 + Math.floor(r / 4)));
    for (let i = 0; i < nc; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() * r * 0.5;
      b.craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: r * G.rand(0.07, 0.16), e: G.rand(0.6, 1), rot: Math.random() * 3 });
    }
    b.veins = [];
    const veinMat = M.vein ? mat : b.vein;
    if (veinMat && b.kind === 'rock') {
      const nv = Math.max(2, Math.floor(r / 3));
      for (let i = 0; i < nv; i++) {
        const pts = [];
        let x = G.rand(-r, r) * 0.6, y = G.rand(-r, r) * 0.6, a = Math.random() * 6.28;
        for (let k = 0; k < 4; k++) {
          pts.push({ x, y });
          a += G.rand(-1, 1);
          x += Math.cos(a) * r * 0.28; y += Math.sin(a) * r * 0.28;
        }
        b.veins.push(pts);
      }
      b.veinColor = RF.MATERIALS[veinMat].vein || RF.MATERIALS[veinMat].light;
    }
    return b;
  };

  RF.classifyRock = (b) => {
    // Islaget er borte: nå ligger kjernen bar.
    if (b.core && b.area <= b.coreArea) {
      b.mat = b.core;
      b.core = null;
      b.density = RF.MATERIALS[b.mat].density;
      b.mass = b.area * b.density;
      b.I = G.polyInertia(b.verts) * b.density;
      b.invMass = 1 / b.mass;
      b.invI = 1 / b.I;
    }
    b.kind = b.area <= RF.ORE_MAX_AREA ? 'ore' : 'rock';
    const hard = RF.MATERIALS[b.mat].hard;
    // Hvor mye laservarme (sekunder ved effekt 1) før steinen sprekker.
    b.integrity = (0.8 + 0.12 * Math.sqrt(b.area)) * hard;
  };

  // Lag en ny stein av en bestemt type.
  RF.spawnRockType = (world, type, r, o, lumpy) => {
    const T = RF.ROCK_TYPES[type];
    // Kometer er klumpete og runde i omrisset, vanlige asteroider kantete.
    let shape = lumpy ? G.rockShape(r, G.randInt(12, 16)) : G.shardShape(r, RF.MATERIALS[T.mat].crystal);
    const extra = {};
    if (T.core) {
      extra.core = G.weighted(T.core);
      extra.coreArea = Math.abs(G.polyArea(shape)) * T.coreFrac;
    }
    if (T.vein) { extra.vein = T.vein; extra.veinP = T.veinP; }
    const rock = RF.makeRock(shape, T.mat, o, extra);
    rock.rockType = type;
    world.add(rock);
    return rock;
  };

  function makeGateBodies(g) {
    const R = RF.GATE_R;
    const out = [];
    for (const s of [-1, 1]) {
      const b = new RF.Body(G.box(-3, s * R - 2.6, 3, s * R + 2.6), 0,
        { x: g.x, y: g.y, a: g.a, kind: 'gate', restitution: 0.3 });
      out.push(b);
    }
    return out;
  }

  function makeStationBodies(st) {
    // Nav, dokkingsarm, to solpanel-master med paneler, og antennemast.
    const parts = [
      G.regular(38, 8, Math.PI / 8),
      G.box(36, -8, 96, 8),
      G.box(-5, 30, 5, 44),
      G.box(-40, 44, 40, 110),
      G.box(-5, -44, 5, -30),
      G.box(-40, -110, 40, -44),
      G.box(-74, -4, -36, 4),
    ];
    return parts.map((v) => new RF.Body(v, 0, { x: st.x, y: st.y, a: st.a, kind: 'station', restitution: 0.3, friction: 0.7 }));
  }

  // Dokkingspunktet ligger ute ved enden av dokkingsarmen.
  RF.dockPoint = (st) => {
    const cs = Math.cos(st.a), sn = Math.sin(st.a);
    const lx = 116, ly = 0;
    return { x: st.x + lx * cs - ly * sn, y: st.y + lx * sn + ly * cs, a: st.a + Math.PI };
  };

  function spawnField(world, f, avoid) {
    const cs = Math.cos(f.rot), sn = Math.sin(f.rot);
    const placed = avoid.slice();
    for (let i = 0; i < f.count; i++) {
      let tries = 0, x, y, r;
      do {
        const t = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random());
        const lx = Math.cos(t) * d * f.rx, ly = Math.sin(t) * d * f.ry;
        x = f.cx + lx * cs - ly * sn;
        y = f.cy + lx * sn + ly * cs;
        // Mange små, få store.
        r = f.rMin + (f.rMax - f.rMin) * Math.pow(Math.random(), 2.4);
        tries++;
      } while (tries < 20 && placed.some((p) => G.len(p.x - x, p.y - y) < p.r + r + 6));
      placed.push({ x, y, r });
      const type = G.weighted(f.types);
      let vx = G.rand(-f.drift, f.drift), vy = G.rand(-f.drift, f.drift);
      if (f.stream) { vx += f.stream.x * f.drift * 1.4; vy += f.stream.y * f.drift * 1.4; }
      RF.spawnRockType(world, type, r, { x, y, a: Math.random() * 6.28, vx, vy, w: G.rand(-0.25, 0.25) * (6 / (r + 3)) });
    }
  }

  function spawnComet(world, sys, near) {
    const ang = Math.random() * Math.PI * 2;
    const dist = near ? G.rand(900, 1600) : G.rand(1800, 2600);
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
    // Fart på tvers av systemet, omtrent mot sentrum med avvik.
    const dir = ang + Math.PI + G.rand(-0.5, 0.5);
    const sp = G.rand(12, 24);
    const r = G.rand(18, 32);
    // Noen kometer har en verdifull kjerne under isen.
    const type = Math.random() < 0.45 ? 'iskledd' : 'is';
    const c = RF.spawnRockType(world, type, r,
      { x, y, a: Math.random() * 6.28, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, w: G.rand(-0.1, 0.1) }, true);
    c.comet = true;
    // Kometer er grå og gropete, med mange kratre.
    c.craters = [];
    for (let i = 0; i < G.randInt(9, 15); i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * c.radius * 0.7;
      c.craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: c.radius * G.rand(0.05, 0.2), e: G.rand(0.55, 1), rot: Math.random() * 3 });
    }
    return c;
  }

  // Et levende stjernesystem med egen fysikkverden. Tilstanden beholdes når
  // spilleren reiser videre, så asteroider man har knust er fortsatt knust.
  RF.createSystemState = (def) => {
    const world = new RF.PhysicsWorld();
    const station = Object.assign({}, def.station);
    station.bodies = makeStationBodies(station);
    station.bodies.forEach((b) => world.add(b));
    const gate = Object.assign({ state: 'idle', t: 0, chevrons: 0, dest: null, incoming: false }, def.gate);
    gate.bodies = makeGateBodies(gate);
    gate.bodies.forEach((b) => world.add(b));
    // Hold stasjonen og porten fri for stein ved start.
    const avoid = [{ x: station.x, y: station.y, r: 260 }, { x: gate.x, y: gate.y, r: 140 }];
    for (const f of def.fields) spawnField(world, f, avoid);
    const st = { def, world, station, gate, time: 0 };
    for (let i = 0; i < def.comets; i++) spawnComet(world, def, i < 2);
    st.respawnComet = (near) => spawnComet(world, def, near);
    return st;
  };
})();
