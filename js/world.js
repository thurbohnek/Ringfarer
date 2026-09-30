// Materialer, varer, stjernesystemer, stasjoner og porter.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  // density er flatetetthet i kg/m² (2D-verden), grade er andelen av råmassen
  // som blir ferdig vare etter prosessering om bord. hard er hvor sterk laser
  // som trengs (1–4). Harde steiner kan også knuses med kanon og raketter.
  RF.MATERIALS = {
    kondritt: { stone: true, name: 'Chondrite', product: 'jern', density: 1500, grade: 0.35, hard: 1,
      base: '#817a71', dark: '#3e3a35', light: '#b3aa9e' },
    silikat: { stone: true, name: 'Silicate', product: 'silisium', density: 1400, grade: 0.4, hard: 1,
      base: '#978b79', dark: '#4d443a', light: '#c9bba4' },
    karbon: { stone: true, name: 'Carbonaceous chondrite', product: 'grafitt', density: 1100, grade: 0.5, hard: 1,
      base: '#4a4745', dark: '#1f1e1d', light: '#6f6a65' },
    is: { name: 'Ice', product: 'vann', density: 750, grade: 0.85, hard: 1,
      base: '#b9c0c3', dark: '#636a6e', light: '#e8ecec', mark: '#dff4ff' },
    metall: { name: 'Nickel-iron', product: 'nikkel', density: 2600, grade: 0.6, hard: 2,
      base: '#83817c', dark: '#3f3d39', light: '#bab5ac', mark: '#a9c2dc' },
    kobber: { name: 'Copper ore', product: 'kobber', density: 2300, grade: 0.3, hard: 2,
      base: '#6d7268', dark: '#353930', light: '#a0a493', vein: '#b87a4a' },
    titan: { name: 'Titanium ore', product: 'titan', density: 2200, grade: 0.25, hard: 3,
      base: '#a09e99', dark: '#5a5853', light: '#d4d1c9', mark: '#eef3f8' },
    gull: { name: 'Gold-bearing quartz', product: 'gull', density: 3000, grade: 0.08, hard: 3,
      base: '#6c6352', dark: '#322c20', light: '#9f9075', vein: '#d9b44a' },
    naquadah: { name: 'Naquadah ore', product: 'naquadah', density: 3400, grade: 0.25, hard: 4,
      base: '#454a50', dark: '#1d2024', light: '#6a6f75', vein: '#4fd9a8' },
    trinium: { name: 'Trinium crystal', product: 'trinium', density: 2000, grade: 0.12, hard: 4,
      base: '#5f5268', dark: '#2c2331', light: '#907f99', vein: '#caa6e0', crystal: true },
  };

  // stone = vanlig gråstein. Små biter av den fordamper i laseren. Is og
  // mineralene (nikkel-jern og hardere) blir liggende som malm.
  RF.isStone = (o) => o.kind === 'ore' && !!(RF.MATERIALS[o.mat] && RF.MATERIALS[o.mat].stone);

  // De minste steinene: skjoldet dytter dem unna, og autopiloten styrer ikke
  // rundt dem.
  RF.isSmallRock = (o) => o.kind === 'rock' && o.radius < 3.5;

  // Frossen gass i kometene. Blir drivstoff rett på tanken; det som ikke får
  // plass, lagres som flyktige stoffer man kan selge.
  RF.MATERIALS.gass = { name: 'Frozen volatiles', product: 'gass', density: 600, grade: 0.8, hard: 1, fuel: true,
    base: '#a9c9c4', dark: '#4f6a67', light: '#dff7f2', mark: '#8fffe0', vein: '#bfffee' };

  // Vrakdeler fra skip som er slått i stykker. Kan samles inn og selges som skrap.
  RF.MATERIALS.skrap = { name: 'Salvage', product: 'skrap', density: 900, grade: 0.6, hard: 1,
    base: '#6d6a60', dark: '#2a2824', light: '#b8b2a2' };

  RF.PRODUCTS = {
    jern: { name: 'Iron', price: 42, color: '#c79a6b' },
    silisium: { name: 'Silicon', price: 55, color: '#d8c59c' },
    grafitt: { name: 'Graphite', price: 35, color: '#8a868e' },
    vann: { name: 'Water ice', price: 30, color: '#9fd8ff' },
    nikkel: { name: 'Nickel-iron', price: 96, color: '#b7c2cf' },
    kobber: { name: 'Copper', price: 150, color: '#e0874a' },
    titan: { name: 'Titanium', price: 380, color: '#e8ecef' },
    gull: { name: 'Gold', price: 2600, color: '#ffd04a' },
    naquadah: { name: 'Naquadah', price: 1150, color: '#5dffc8' },
    trinium: { name: 'Trinium', price: 3800, color: '#e0b0ff' },
    skrap: { name: 'Scrap metal', price: 60, color: '#a39c8c' },
    gass: { name: 'Volatiles', price: 75, color: '#8fffe0' },
  };

  // Asteroidetyper. blobs = klumper av andre mineraler, veins = årer,
  // core = kjernen under et islag. Tallene er omtrentlig andel.
  RF.ROCK_TYPES = {
    kondritt: { mat: 'kondritt', blobs: { silikat: 0.12, karbon: 0.06 }, veins: { metall: 0.05 } },
    silikat: { mat: 'silikat', blobs: { kondritt: 0.14 }, veins: { metall: 0.03 } },
    karbon: { mat: 'karbon', blobs: { is: 0.14, kondritt: 0.08 } },
    is: { mat: 'is', blobs: { karbon: 0.1 } },
    metall: { mat: 'metall', blobs: { kondritt: 0.1 }, veins: { kobber: 0.1 } },
    kobber: { mat: 'kobber', blobs: { metall: 0.12, silikat: 0.08 } },
    titan: { mat: 'titan', blobs: { silikat: 0.12, metall: 0.06 } },
    gull: { mat: 'gull', blobs: { silikat: 0.15 } },
    naquadah: { mat: 'naquadah', blobs: { metall: 0.12 }, veins: { trinium: 0.03 } },
    trinium: { mat: 'trinium', blobs: { silikat: 0.15 } },
    iskledd: { mat: 'is', blobs: { karbon: 0.08 }, core: { metall: 0.4, kobber: 0.3, titan: 0.2, gull: 0.1 }, coreFrac: 0.4 },
    // Kometer: is (vann) med lommer av frossen gass (drivstoff), noen med en
    // verdifull kjerne under isen.
    komet: { mat: 'is', blobs: { gass: 0.26, karbon: 0.08 } },
    kometkjerne: { mat: 'is', blobs: { gass: 0.2, karbon: 0.06 }, core: { metall: 0.4, kobber: 0.3, titan: 0.2, gull: 0.1 }, coreFrac: 0.35 },
  };

  // Største bit (m²) som får plass i inntaket og kan prosesseres.
  RF.ORE_MAX_AREA = 4.5;
  // Biter under dette blir bare støv.
  RF.DUST_AREA = 0.22;
  // Løse steiner under dette (m²) blir runde klumper (se voxel.js).
  RF.RUBBLE_AREA = 140;

  RF.SYSTEMS = [
    {
      id: 'midgard',
      name: 'Midgard',
      blurb: 'Home system. A calm asteroid belt with iron and nickel.',
      sky: { deep: '#020409', neb: ['#1c3358', '#3a2150', '#123a4a'], star: '#ffd9a0', starDir: -2.3 },
      planet: { type: 'ocean', color: '#3f6fa8', band: '#6aa0d8', atmo: '#8fc0ff', r: 0.55, x: 0.95, y: 1.0, ring: false },
      station: { id: 'midgard', name: 'Midgard Shipyard', x: 0, y: 0, a: 0,
        prices: { jern: 1.0, nikkel: 1.05, vann: 1.1, naquadah: 1.15, titan: 1.1, trinium: 1.2, skrap: 1.2, gass: 1.1 } },
      npcs: { drone: 3, hauler: 1 },
      gate: { x: 900, y: -1100, a: Math.PI * 0.6 },
      glyphs: [0, 3, 5, 1, 6, 2, 4],
      fields: [
        { cx: 700, cy: 650, rx: 900, ry: 420, rot: 0.3, count: 48, rMin: 5, rMax: 42, drift: 1.2, giants: 3,
          types: { kondritt: 0.3, silikat: 0.2, karbon: 0.15, metall: 0.2, iskledd: 0.1, kobber: 0.05 } },
        { cx: -900, cy: -500, rx: 450, ry: 300, rot: -0.6, count: 18, rMin: 4, rMax: 30, drift: 1.0, giants: 1,
          types: { kondritt: 0.5, silikat: 0.3, karbon: 0.2 } },
      ],
      comets: 2,
    },
    {
      id: 'vanaheim',
      name: 'Vanaheim',
      blurb: 'Trading post. Comets of clean ice race through the system.',
      sky: { deep: '#020605', neb: ['#12433d', '#1e3a5c', '#0f2a2a'], star: '#cfe8ff', starDir: 0.7 },
      planet: { type: 'gas', color: '#a8844f', band: '#e3cfa5', atmo: '#f0dcb0', ringColor: '#cbb996', r: 0.3, x: 0.2, y: 0.24, ring: true },
      station: { id: 'vanaheim', name: 'Vanaheim Trading Post', x: 0, y: 0, a: Math.PI,
        prices: { jern: 1.25, nikkel: 1.2, vann: 0.7, naquadah: 1.0, kobber: 1.25, grafitt: 1.3, gull: 1.1, gass: 0.8 } },
      npcs: { drone: 1, hauler: 2 },
      gate: { x: -1200, y: 700, a: -0.4 },
      glyphs: [2, 6, 1, 4, 0, 5, 3],
      fields: [
        { cx: 1100, cy: -300, rx: 700, ry: 500, rot: 0.9, count: 32, rMin: 5, rMax: 36, drift: 1.6, giants: 2,
          types: { is: 0.25, iskledd: 0.25, metall: 0.2, kobber: 0.15, titan: 0.1, silikat: 0.05 } },
      ],
      comets: 7,
    },
    {
      id: 'muspel',
      name: 'Muspelheim',
      blurb: 'Dangerous. A dense, fast-moving field, but rich in naquadah.',
      sky: { deep: '#070203', neb: ['#5a1a10', '#3a0f22', '#6a3a10'], star: '#ff9a5a', starDir: 1.9 },
      planet: { type: 'lava', color: '#6a3a2a', band: '#d8642a', atmo: '#ff9a5a', r: 0.34, x: 0.82, y: 0.18, ring: false },
      station: { id: 'muspel', name: 'Surtr Drilling Station', x: 0, y: 0, a: -Math.PI / 2,
        prices: { jern: 1.3, nikkel: 1.35, vann: 2.6, naquadah: 0.9, silisium: 1.4, titan: 0.9, gass: 1.7 } },
      npcs: { drone: 2, hauler: 1 },
      gate: { x: 700, y: 1100, a: -Math.PI * 0.35 },
      glyphs: [5, 1, 4, 6, 3, 0, 2],
      fields: [
        { cx: 1300, cy: -200, rx: 800, ry: 700, rot: 0.2, count: 56, rMin: 4, rMax: 34, drift: 7,
          stream: { x: -1, y: 0.35 }, types: { naquadah: 0.18, gull: 0.14, trinium: 0.08, titan: 0.15, metall: 0.25, karbon: 0.2 } },
        { cx: -700, cy: -900, rx: 500, ry: 400, rot: 0.2, count: 22, rMin: 4, rMax: 32, drift: 3, giants: 2,
          types: { metall: 0.35, kobber: 0.25, gull: 0.15, titan: 0.15, naquadah: 0.1 } },
      ],
      comets: 2,
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

  // Lag en ny stein av en bestemt type (bygget av voksler, se voxel.js).
  RF.spawnRockType = (world, type, r, o, opts) => RF.Vox.generate(world, type, r, o, opts || {});

  function makeGateBodies(g) {
    const R = g.R, k = R / RF.GATE_R;
    const out = [];
    for (const s of [-1, 1]) {
      const b = new RF.Body(G.box(-3 * k, s * R - 2.6 * k, 3 * k, s * R + 2.6 * k), 0,
        { x: g.x, y: g.y, a: g.a, kind: 'gate', restitution: 0.3 });
      b.gate = g;
      out.push(b);
    }
    return out;
  }

  // Kapitalporten: en stor ring for skip som ikke får plass i den vanlige.
  RF.BIG_GATE_R = 420;
  RF.gatesOf = (sys) => [sys.gate, sys.gate2].filter(Boolean);

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
      let w = G.rand(-0.25, 0.25) * (6 / (r + 3));
      // Noen steiner farter og snurrer gjennom feltet. Man må matche farten
      // for å skjære i dem. En svak trekkraft mot midten av feltet holder dem
      // i banen, så de svinger fram og tilbake i stedet for å forsvinne.
      const lx0 = (x - f.cx) * cs + (y - f.cy) * sn, ly0 = -(x - f.cx) * sn + (y - f.cy) * cs;
      const inner = (lx0 / f.rx) ** 2 + (ly0 / f.ry) ** 2 < 0.5;
      let orbit = null;
      if (!f.stream && r < 28 && inner && Math.random() < (f.movers != null ? f.movers : 0.45)) {
        const sp = G.rand(3, 8), a = Math.random() * Math.PI * 2;
        vx += Math.cos(a) * sp; vy += Math.sin(a) * sp;
        w = (Math.random() < 0.5 ? -1 : 1) * G.rand(0.12, 0.45) * (8 / (r + 4));
        const A = 0.5 * Math.min(f.rx, f.ry);
        orbit = { cx: f.cx, cy: f.cy, k: (sp / A) ** 2 };
      }
      const b = RF.spawnRockType(world, type, r, { x, y, a: Math.random() * 6.28, vx, vy, w });
      if (b && orbit) b.orbit = orbit;
    }
    // Noen få kjemper man kan bore seg inn i. Noen har allerede en hule.
    for (let i = 0; i < (f.giants || 0); i++) {
      let x, y, r, tries = 0;
      do {
        const t = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 0.8;
        const lx = Math.cos(t) * d * f.rx, ly = Math.sin(t) * d * f.ry;
        x = f.cx + lx * cs - ly * sn;
        y = f.cy + lx * sn + ly * cs;
        r = G.rand(70, 105);
        tries++;
      } while (tries < 60 && placed.some((p) => G.len(p.x - x, p.y - y) < p.r + r + 30));
      placed.push({ x, y, r });
      const type = G.weighted(f.types);
      RF.spawnRockType(world, type, r, { x, y, a: Math.random() * 6.28, vx: G.rand(-0.3, 0.3), vy: G.rand(-0.3, 0.3), w: G.rand(-0.01, 0.01) },
        { cave: i === 0 || Math.random() < 0.5 });
    }
  }

  function spawnComet(world, sys, near) {
    const ang = Math.random() * Math.PI * 2;
    const dist = near ? G.rand(900, 1600) : G.rand(1800, 2600);
    const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
    // Fart på tvers av systemet, omtrent mot sentrum med avvik.
    const dir = ang + Math.PI + G.rand(-0.5, 0.5);
    const sp = G.rand(12, 24);
    const r = G.rand(34, 60);
    // Noen kometer har en verdifull kjerne under isen.
    const type = Math.random() < 0.4 ? 'kometkjerne' : 'komet';
    // Kometer er grå og gropete, med mange kratre.
    return RF.spawnRockType(world, type, r,
      { x, y, a: Math.random() * 6.28, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, w: G.rand(-0.1, 0.1) }, { lumpy: true, comet: true });
  }

  // Et levende stjernesystem med egen fysikkverden. Tilstanden beholdes når
  // spilleren reiser videre, så asteroider man har knust er fortsatt knust.
  RF.createSystemState = (def) => {
    const world = new RF.PhysicsWorld();
    const station = Object.assign({}, def.station);
    station.bodies = makeStationBodies(station);
    station.bodies.forEach((b) => world.add(b));
    const gate = Object.assign({ state: 'idle', t: 0, chevrons: 0, dest: null, incoming: false, R: RF.GATE_R, key: 'gate', name: 'Gate' }, def.gate);
    gate.bodies = makeGateBodies(gate);
    gate.bodies.forEach((b) => world.add(b));
    // Kapitalporten står et godt stykke unna, på motsatt side av stasjonen.
    const ga = Math.atan2(gate.y - station.y, gate.x - station.x) + Math.PI * 0.8;
    const gate2 = Object.assign({ state: 'idle', t: 0, chevrons: 0, dest: null, incoming: false, R: RF.BIG_GATE_R, key: 'gate2', name: 'Capital gate',
      x: station.x + Math.cos(ga) * 3200, y: station.y + Math.sin(ga) * 3200, a: ga }, def.gate2);
    gate2.bodies = makeGateBodies(gate2);
    gate2.bodies.forEach((b) => world.add(b));
    // Hold stasjonen og portene fri for stein ved start.
    const avoid = [{ x: station.x, y: station.y, r: 260 }, { x: gate.x, y: gate.y, r: 140 }, { x: gate2.x, y: gate2.y, r: gate2.R + 400 }];
    for (const f of def.fields) spawnField(world, f, avoid);
    const st = { def, world, station, gate, gate2, time: 0 };
    for (let i = 0; i < def.comets; i++) spawnComet(world, def, i < 2);
    st.respawnComet = (near) => spawnComet(world, def, near);
    return st;
  };
})();
