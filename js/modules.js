// Moduler og skipsskrog. Et skip er et rutenett av moduler (én modul per
// rute). Massen, tyngdepunktet, treghetsmomentet og kollisjonsformen regnes
// ut fra modulene, så et skip med tunge motorer bak oppfører seg annerledes
// enn et med lasten foran.
//
// Rutenett: x er fremover, y er styrbord. Én rute er CELL meter.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  const CELL = (RF.CELL = 2.4);

  // Kategori brukes i butikken. mount: verktøy som festes i et festepunkt på
  // skrogets kant og peker utover (kan dreie mot siktepunktet).
  // face: 'aft' = motoren trenger en åpen rute rett bak seg.
  // unlock: progresjonsnivå som skal kreves senere. Alt er åpent i denne versjonen.
  RF.MODULES = {
    cockpit: { name: 'Cockpit', cat: 'Struktur', mass: 4000, hp: 90, cost: 0, unique: true, shield: 40, unlock: 0,
      desc: 'Pilotens plass. Mistes den, er skipet tapt. Har en liten skjoldgenerator.' },
    frame: { name: 'Skrogramme', cat: 'Struktur', mass: 900, hp: 60, cost: 120, unlock: 0,
      desc: 'Lett fagverk som binder moduler sammen.' },
    armor: { name: 'Panserplate', cat: 'Beskyttelse', mass: 3200, hp: 240, cost: 450, unlock: 0,
      desc: 'Tåler mye. Sett den der skipet ofte blir truffet.' },
    armor2: { name: 'Tungpanser', cat: 'Beskyttelse', mass: 5600, hp: 480, cost: 1200, unlock: 1,
      desc: 'Dobbelt så sterkt som en panserplate, men tungt.' },
    shield: { name: 'Skjoldgenerator', cat: 'Beskyttelse', mass: 2200, hp: 70, cost: 1600, shield: 90, unlock: 1,
      desc: 'Et skjold som tar støtet før skroget. Lades opp igjen av seg selv.' },
    thruster: { name: 'Hovedmotor', cat: 'Motor', mass: 1800, hp: 70, cost: 500, thrust: 190e3, face: 'aft', unlock: 0,
      desc: 'Skyver skipet fremover. Eksosen trenger fri bane bakover.' },
    thruster2: { name: 'Tung motor', cat: 'Motor', mass: 3400, hp: 100, cost: 1900, thrust: 460e3, face: 'aft', unlock: 1,
      desc: 'Mye skyvekraft for store skip og tung last.' },
    rcs: { name: 'Styredyser', cat: 'Motor', mass: 700, hp: 50, cost: 350, rcs: 70e3, unlock: 0,
      desc: 'Dreier skipet, sideforflytning og brems. Virker best langt fra tyngdepunktet.' },
    fuel: { name: 'Drivstofftank', cat: 'Motor', mass: 800, hp: 45, cost: 300, fuel: 3000, unlock: 0,
      desc: 'Rommer 3 tonn drivstoff. Tom tank betyr ingen hovedmotor.' },
    cargo: { name: 'Lastecontainer', cat: 'Last', mass: 1100, hp: 70, cost: 400, hold: 8, unlock: 0,
      desc: '8 tonn lasterom.' },
    cargo2: { name: 'Stor lastebinge', cat: 'Last', mass: 2000, hp: 110, cost: 1300, hold: 20, unlock: 1,
      desc: '20 tonn lasterom med forsterkede vegger.' },
    refinery: { name: 'Prosessor', cat: 'Gruvedrift', mass: 3000, hp: 70, cost: 1500, proc: 1500, unlock: 1,
      desc: 'Prosesserer malm raskere og gir 15 % mer ferdig vare.' },
    laser: { name: 'Borelaser', cat: 'Gruvedrift', mass: 1400, hp: 50, cost: 600, mount: true, unlock: 0,
      laser: { power: 1, tier: 1, range: 200, color: '255,150,60' },
      desc: 'Skjærer løs biter av myk stein (hardhet 1).' },
    laser2: { name: 'Tung borelaser', cat: 'Gruvedrift', mass: 2600, hp: 70, cost: 2400, mount: true, unlock: 1,
      laser: { power: 1.8, tier: 2, range: 230, color: '255,70,50' },
      desc: 'Klarer metall og kobber (hardhet 2).' },
    laser3: { name: 'Plasmaskjærer', cat: 'Gruvedrift', mass: 3600, hp: 80, cost: 6500, mount: true, unlock: 2,
      laser: { power: 3, tier: 3, range: 260, color: '190,110,255' },
      desc: 'Skjærer titan og gull (hardhet 3).' },
    laser4: { name: 'Fasekutter', cat: 'Gruvedrift', mass: 4800, hp: 90, cost: 14000, mount: true, unlock: 3,
      laser: { power: 4.5, tier: 4, range: 280, color: '120,255,220' },
      desc: 'Det eneste som skjærer naquadah og trinium (hardhet 4).' },
    tractor: { name: 'Traktorstråle og inntak', cat: 'Gruvedrift', mass: 1500, hp: 60, cost: 700, tractor: 70e3, mount: true, unlock: 0,
      desc: 'Trekker malmbiter og vrakdeler inn og prosesserer dem.' },
    cannon: { name: 'Massedriver', cat: 'Våpen', mass: 1600, hp: 60, cost: 1400, mount: true, unlock: 1,
      gun: { rate: 4, speed: 450, mass: 20 },
      desc: 'Skyter tunge prosjektiler. Slår løs biter også av hard stein.' },
    rocket: { name: 'Rakettkaster', cat: 'Våpen', mass: 1800, hp: 50, cost: 2200, mount: true, unlock: 1, ammo: 6,
      desc: 'Sprengraketter som knuser hva som helst. 6 raketter, fylles på stasjonen.' },
    anchor: { name: 'Ankerkaster', cat: 'Verktøy', mass: 1300, hp: 60, cost: 1200, mount: true, unlock: 0,
      anchor: { range: 120, winch: 4 },
      desc: 'Skyter ut en krok på wire som fester seg i det den treffer. Slep kometer, hold deg fast.' },
    anchor2: { name: 'Tungt anker', cat: 'Verktøy', mass: 2400, hp: 80, cost: 2800, mount: true, unlock: 1,
      anchor: { range: 250, winch: 8 },
      desc: 'Lengre wire og sterkere vinsj.' },
    light: { name: 'Arbeidslys', cat: 'Verktøy', mass: 300, hp: 30, cost: 250, mount: true, light: 110, unlock: 0,
      desc: 'Lyser opp 110 meter forover.' },
    light2: { name: 'Flomlys', cat: 'Verktøy', mass: 700, hp: 40, cost: 900, mount: true, light: 200, unlock: 1,
      desc: 'Lyser opp 200 meter forover.' },
    dronebay: { name: 'Dronehangar', cat: 'Verktøy', mass: 2500, hp: 80, cost: 2500, bay: 1, unlock: 1,
      desc: 'Plass til én drone: gruvedrone eller reparasjonsdrone.' },
  };

  RF.DRONE_TYPES = {
    gruve: { name: 'Gruvedrone', cost: 1500, desc: 'Borer i myk stein nær skipet og leverer malmen til deg.' },
    rep: { name: 'Reparasjonsdrone', cost: 2000, desc: 'Flyr rundt skipet og reparerer skadde moduler.' },
  };

  // Skipsskrog: hvor stort rutenettet er, og hva som følger med.
  RF.HULLS = {
    hopper: {
      name: 'Hoppeskip MK-I', cost: 0, w: 6, h: 5, unlock: 0,
      desc: 'Lite enmannsskip. Billig å fly, lite plass.',
      layout: [
        ['thruster', 0, -1], ['thruster', 0, 1], ['fuel', 1, -1], ['frame', 1, 0], ['rcs', 1, 1],
        ['cargo', 2, -1], ['frame', 2, 0], ['cargo', 2, 1],
        ['frame', 3, -1], ['cockpit', 3, 0], ['frame', 3, 1], ['light', 3, 2],
        ['tractor', 4, -1], ['laser', 4, 0], ['anchor', 4, 1],
      ],
    },
    graver: {
      name: 'Graver G-2', cost: 14000, w: 8, h: 7, unlock: 1,
      desc: 'Mellomstort gruveskip med prosessor, våpen, skjold og dronehangar.',
      layout: [
        ['thruster2', 0, -1], ['thruster', 0, 0], ['thruster2', 0, 1],
        ['fuel', 1, -1], ['refinery', 1, 0], ['fuel', 1, 1],
        ['rcs', 2, -2], ['cargo2', 2, -1], ['cargo', 2, 0], ['cargo2', 2, 1], ['rcs', 2, 2],
        ['cargo', 3, -1], ['frame', 3, 0], ['cargo', 3, 1],
        ['dronebay', 4, -1], ['frame', 4, 0], ['shield', 4, 1],
        ['anchor', 5, -2], ['cargo', 5, -1], ['cockpit', 5, 0], ['frame', 5, 1], ['light', 5, 2],
        ['tractor', 6, -1], ['laser2', 6, 0], ['cannon', 6, 1],
      ],
    },
    fjell: {
      name: 'Fjellbryter T-3', cost: 48000, w: 9, h: 11, unlock: 2,
      desc: 'Tungt industriskip. Knuser alt og tar enorme mengder last.',
      layout: [
        ['light2', 4, -5],
        ['armor', 3, -4], ['frame', 4, -4], ['rocket', 5, -4],
        ['rcs', 2, -3], ['frame', 3, -3], ['frame', 4, -3], ['frame', 5, -3], ['anchor2', 6, -3],
        ['thruster2', 0, -2], ['fuel', 1, -2], ['cargo2', 2, -2], ['cargo', 3, -2], ['rcs', 4, -2], ['frame', 5, -2], ['frame', 6, -2], ['tractor', 7, -2],
        ['thruster2', 0, -1], ['fuel', 1, -1], ['cargo2', 2, -1], ['cargo2', 3, -1], ['dronebay', 4, -1], ['armor', 5, -1], ['frame', 6, -1], ['frame', 7, -1], ['laser2', 8, -1],
        ['thruster', 0, 0], ['refinery', 1, 0], ['refinery', 2, 0], ['cargo2', 3, 0], ['frame', 4, 0], ['shield', 5, 0], ['shield', 6, 0], ['cockpit', 7, 0], ['laser3', 8, 0],
        ['thruster2', 0, 1], ['fuel', 1, 1], ['cargo2', 2, 1], ['cargo2', 3, 1], ['dronebay', 4, 1], ['armor', 5, 1], ['frame', 6, 1], ['frame', 7, 1], ['laser2', 8, 1],
        ['thruster2', 0, 2], ['fuel', 1, 2], ['cargo2', 2, 2], ['cargo', 3, 2], ['rcs', 4, 2], ['frame', 5, 2], ['frame', 6, 2], ['tractor', 7, 2],
        ['rcs', 2, 3], ['frame', 3, 3], ['frame', 4, 3], ['frame', 5, 3], ['cannon', 6, 3],
        ['armor', 3, 4], ['frame', 4, 4], ['rocket', 5, 4],
        ['light2', 4, 5],
      ],
    },
  };

  // Små oppsett for de datastyrte skipene.
  RF.NPC_LAYOUTS = {
    drone: [['thruster', 0, 0], ['cockpit', 1, 0], ['laser', 2, 0], ['rcs', 1, 1], ['tractor', 2, -1], ['frame', 1, -1], ['light', 2, 1]],
    hauler: [
      ['thruster2', 0, -1], ['thruster2', 0, 1], ['thruster', 0, 0], ['fuel', 1, -1], ['fuel', 1, 1], ['frame', 1, 0],
      ['cargo2', 2, -1], ['cargo2', 2, 0], ['cargo2', 2, 1], ['cargo2', 3, -1], ['cargo2', 3, 0], ['cargo2', 3, 1],
      ['rcs', 3, -2], ['rcs', 3, 2], ['armor', 4, -1], ['cockpit', 4, 0], ['armor', 4, 1], ['light', 5, 0],
    ],
    helper: [['thruster', 0, 0], ['cockpit', 1, 0], ['laser', 2, 0], ['rcs', 1, 1]],
    repair: [['thruster', 0, 0], ['cockpit', 1, 0], ['light', 2, 0], ['rcs', 1, -1]],
  };
  RF.layoutFrom = (list) => list.map(([t, x, y]) => ({ t, x, y, hp: RF.MODULES[t].hp }));

  // Rutenettets grenser for et skrog. Cockpiten ligger på rad 0.
  RF.hullBounds = (hullId) => {
    const H = RF.HULLS[hullId];
    const half = Math.floor(H.h / 2);
    return { x0: 0, x1: H.w - 1, y0: -half, y1: H.h - 1 - half };
  };

  RF.defaultLayout = (hullId) =>
    RF.HULLS[hullId].layout.map(([t, x, y]) => ({ t, x, y, hp: RF.MODULES[t].hp }));

  const key = (x, y) => x + ',' + y;

  // Moduler som ikke henger sammen med cockpiten (4-naboskap).
  RF.disconnected = (layout) => {
    const map = new Map(layout.map((m) => [key(m.x, m.y), m]));
    const start = layout.find((m) => m.t === 'cockpit');
    const seen = new Set();
    if (start) {
      const q = [start];
      seen.add(start);
      while (q.length) {
        const m = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = map.get(key(m.x + dx, m.y + dy));
          if (n && !seen.has(n)) { seen.add(n); q.push(n); }
        }
      }
    }
    return layout.filter((m) => !seen.has(m));
  };

  // Deler en liste moduler i sammenhengende klynger.
  RF.clusters = (mods) => {
    const map = new Map(mods.map((m) => [key(m.x, m.y), m]));
    const seen = new Set(), out = [];
    for (const s of mods) {
      if (seen.has(s)) continue;
      const c = [s], q = [s];
      seen.add(s);
      while (q.length) {
        const m = q.pop();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = map.get(key(m.x + dx, m.y + dy));
          if (n && !seen.has(n)) { seen.add(n); q.push(n); c.push(n); }
        }
      }
      out.push(c);
    }
    return out;
  };

  // Retningene et verktøy kan peke: 0 = forover, 1 = styrbord, 2 = bakover, 3 = babord.
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  RF.DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

  // Et festepunkt er en kant av skroget med tom plass utenfor. Verktøyet
  // peker ut den veien, helst forover, så til sidene, og til slutt bakover.
  RF.mountDir = (layout, m) => {
    const occ = new Set(layout.map((o) => o.x + ',' + o.y));
    for (const d of [0, 3, 1, 2]) {
      const [dx, dy] = DIRS[d];
      if (!occ.has(m.x + dx + ',' + (m.y + dy))) return d;
    }
    return -1;
  };

  // Verktøy uten fri kant, eller motor uten åpen rute bak, virker ikke.
  RF.isBlocked = (layout, m) => {
    const D = RF.MODULES[m.t];
    if (D.face === 'aft') return layout.some((o) => o.x === m.x - 1 && o.y === m.y);
    if (D.mount) { m.dir = RF.mountDir(layout, m); return m.dir < 0; }
    return false;
  };

  // Geometri og masse for et sett moduler. Posisjonene blir relative til
  // tyngdepunktet (lx, ly), som er det fysikken bruker som origo.
  RF.layoutGeometry = (layout, extraMass = 0) => {
    let M = 0, cx = 0, cy = 0;
    for (const m of layout) {
      const mm = RF.MODULES[m.t].mass;
      M += mm; cx += m.x * CELL * mm; cy += m.y * CELL * mm;
    }
    cx /= M; cy /= M;
    let I = 0;
    const pts = [];
    const h = CELL / 2;
    for (const m of layout) {
      const mm = RF.MODULES[m.t].mass;
      m.lx = m.x * CELL - cx;
      m.ly = m.y * CELL - cy;
      I += mm * (m.lx * m.lx + m.ly * m.ly + (CELL * CELL) / 6);
      pts.push({ x: m.lx - h, y: m.ly - h }, { x: m.lx + h, y: m.ly - h }, { x: m.lx + h, y: m.ly + h }, { x: m.lx - h, y: m.ly + h });
    }
    // Ekstra masse (last, drivstoff) fordeles jevnt, så den bare skalerer I.
    const total = M + extraMass;
    return { mass: total, I: I * (total / M), com: { x: cx, y: cy }, verts: G.convexHull(pts), dryMass: M };
  };

  // Sum av alt modulene gjør for skipet.
  RF.layoutStats = (layout) => {
    const st = {
      thrust: 0, thrusters: [], rcs: 0, rcsList: [], fuelCap: 0, hold: 0, shieldMax: 0, proc: 800, yield: 1,
      lasers: [], guns: [], rockets: [], anchors: [], tractors: [], lights: [], bays: 0, hpMax: 0, hp: 0, blocked: [],
    };
    for (const m of layout) {
      const D = RF.MODULES[m.t];
      st.hpMax += D.hp;
      st.hp += m.hp;
      const blocked = RF.isBlocked(layout, m);
      if (blocked) st.blocked.push(m);
      // Skadde moduler virker dårligere.
      const eff = 0.35 + 0.65 * (m.hp / D.hp);
      if (D.thrust && !blocked) { st.thrusters.push({ m, F: D.thrust * eff }); st.thrust += D.thrust * eff; }
      if (D.rcs) { st.rcsList.push({ m, F: D.rcs * eff }); st.rcs += D.rcs * eff; }
      if (D.fuel) st.fuelCap += D.fuel;
      if (D.hold) st.hold += D.hold;
      if (D.shield) st.shieldMax += D.shield;
      if (D.proc) { st.proc += D.proc; st.yield += 0.15; }
      if (D.laser && !blocked) st.lasers.push({ m, ...D.laser, power: D.laser.power * eff });
      if (D.gun && !blocked) st.guns.push({ m, ...D.gun });
      if (D.ammo && !blocked) st.rockets.push({ m });
      if (D.anchor && !blocked) st.anchors.push({ m, ...D.anchor });
      if (D.tractor && !blocked) st.tractors.push({ m, F: D.tractor * eff });
      if (D.light && !blocked) st.lights.push({ m, range: D.light });
      if (D.bay) st.bays += D.bay;
    }
    st.rocketCap = st.rockets.length * 6;
    return st;
  };

  RF.layoutValue = (layout) => layout.reduce((s, m) => s + RF.MODULES[m.t].cost, 0);
})();
