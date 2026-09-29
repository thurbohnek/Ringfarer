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
    cockpit: { name: 'Cockpit', cat: 'Structure', mass: 4000, hp: 90, cost: 0, unique: true, shield: 40, unlock: 0,
      desc: 'The pilot seat. Lose it and the ship is lost. Has a small shield generator.' },
    frame: { name: 'Hull frame', cat: 'Structure', mass: 900, hp: 60, cost: 120, unlock: 0,
      desc: 'Light truss that ties modules together.' },
    armor: { name: 'Armor plate', cat: 'Protection', mass: 3200, hp: 240, cost: 450, unlock: 0,
      desc: 'Takes a beating. Put it where the ship gets hit most.' },
    armor2: { name: 'Heavy armor', cat: 'Protection', mass: 5600, hp: 480, cost: 1200, unlock: 1,
      desc: 'Twice as strong as an armor plate, but heavy.' },
    shield: { name: 'Shield generator', cat: 'Protection', mass: 2200, hp: 70, cost: 1600, shield: 90, unlock: 1,
      desc: 'A shield that takes the hit before the hull. Recharges by itself.' },
    thruster: { name: 'Main engine', cat: 'Engines', mass: 1800, hp: 70, cost: 500, thrust: 190e3, face: 'aft', unlock: 0,
      desc: 'Pushes the ship forward. The exhaust needs a clear path aft.' },
    thruster2: { name: 'Heavy engine', cat: 'Engines', mass: 3400, hp: 100, cost: 1900, thrust: 460e3, face: 'aft', unlock: 1,
      desc: 'Lots of thrust for big ships and heavy cargo.' },
    rcs: { name: 'Maneuvering thrusters', cat: 'Engines', mass: 700, hp: 50, cost: 350, rcs: 70e3, unlock: 0,
      desc: 'Turning, strafing and braking. Work best far from the center of mass.' },
    fuel: { name: 'Fuel tank', cat: 'Engines', mass: 800, hp: 45, cost: 300, fuel: 3000, unlock: 0,
      desc: 'Holds 3 tonnes of fuel. Empty tanks mean no main engine.' },
    cargo: { name: 'Cargo container', cat: 'Cargo', mass: 1100, hp: 70, cost: 400, hold: 8, unlock: 0,
      desc: '8 tonnes of cargo space.' },
    cargo2: { name: 'Large cargo bay', cat: 'Cargo', mass: 2000, hp: 110, cost: 1300, hold: 20, unlock: 1,
      desc: '20 tonnes of cargo space with reinforced walls.' },
    refinery: { name: 'Ore processor', cat: 'Mining', mass: 3000, hp: 70, cost: 1500, proc: 1500, unlock: 1,
      desc: 'Processes ore faster and yields 15 % more product.' },
    laser: { name: 'Mining laser', cat: 'Mining', mass: 1400, hp: 50, cost: 600, mount: true, unlock: 0,
      laser: { power: 1, tier: 1, range: 200, color: '255,150,60' },
      desc: 'Cuts chunks off soft rock (hardness 1).' },
    laser2: { name: 'Heavy mining laser', cat: 'Mining', mass: 2600, hp: 70, cost: 2400, mount: true, unlock: 1,
      laser: { power: 1.8, tier: 2, range: 230, color: '255,70,50' },
      desc: 'Handles metal and copper ore (hardness 2).' },
    laser3: { name: 'Plasma cutter', cat: 'Mining', mass: 3600, hp: 80, cost: 6500, mount: true, unlock: 2,
      laser: { power: 3, tier: 3, range: 260, color: '190,110,255' },
      desc: 'Cuts titanium and gold (hardness 3).' },
    laser4: { name: 'Phase cutter', cat: 'Mining', mass: 4800, hp: 90, cost: 14000, mount: true, unlock: 3,
      laser: { power: 4.5, tier: 4, range: 280, color: '120,255,220' },
      desc: 'The only thing that cuts naquadah and trinium (hardness 4).' },
    drill: { name: 'Drill head', cat: 'Mining', mass: 2200, hp: 110, cost: 1800, mount: true, unlock: 0,
      drill: { power: 2.2, tier: 2, range: 3.4 },
      desc: 'Spiked drill drum on an arm. Grinds into rock it is pressed against (hardness 2). Fires with the laser button.' },
    tractor: { name: 'Tractor beam and intake', cat: 'Mining', mass: 1500, hp: 60, cost: 700, tractor: 70e3, mount: true, unlock: 0,
      desc: 'Pulls in ore chunks and salvage and processes them.' },
    cannon: { name: 'Mass driver', cat: 'Weapons', mass: 1600, hp: 60, cost: 1400, mount: true, unlock: 1,
      gun: { rate: 4, speed: 450, mass: 20 },
      desc: 'Fires heavy slugs. Breaks chunks off even hard rock.' },
    rocket: { name: 'Rocket launcher', cat: 'Weapons', mass: 1800, hp: 50, cost: 2200, mount: true, unlock: 1, ammo: 6,
      desc: 'Explosive rockets that crack anything. 6 rockets, restocked at stations.' },
    anchor: { name: 'Harpoon launcher', cat: 'Tools', mass: 1300, hp: 60, cost: 1200, mount: true, unlock: 0,
      anchor: { range: 120, winch: 4 },
      desc: 'Fires a hook on a cable that sticks to whatever it hits. Tow comets or hold on.' },
    anchor2: { name: 'Heavy harpoon', cat: 'Tools', mass: 2400, hp: 80, cost: 2800, mount: true, unlock: 1,
      anchor: { range: 250, winch: 8 },
      desc: 'Longer cable and a stronger winch.' },
    light: { name: 'Work light', cat: 'Tools', mass: 300, hp: 30, cost: 250, mount: true, light: 110, unlock: 0,
      desc: 'Lights up 110 meters ahead.' },
    light2: { name: 'Floodlight', cat: 'Tools', mass: 700, hp: 40, cost: 900, mount: true, light: 200, unlock: 1,
      desc: 'Lights up 200 meters ahead.' },
    navcomp: { name: 'Navigation computer', cat: 'Tools', mass: 400, hp: 40, cost: 3500, nav: true, unlock: 2,
      desc: 'Lets the autopilot plot a course around asteroids, stations and ships on the way to the target.' },
    cabin: { name: 'Passenger cabin', cat: 'Passengers', mass: 700, hp: 60, cost: 600, pax: 2, unlock: 0,
      desc: 'Seats for 2 passengers with windows along the side.' },
    hab: { name: 'Habitat module', cat: 'Passengers', mass: 1600, hp: 90, cost: 1800, pax: 10, unlock: 1,
      desc: 'Pressurized deck with bunks and room for 10 passengers.' },
    cryo: { name: 'Cryo berths', cat: 'Passengers', mass: 2000, hp: 70, cost: 3500, cryo: 30, unlock: 2,
      desc: '30 colonists asleep in cryo pods. Needs power but no life support.' },
    lifesup: { name: 'Life support', cat: 'Passengers', mass: 900, hp: 50, cost: 1200, life: 120, unlock: 0,
      desc: 'Air, water and heat for 120 people. Passengers beyond what life support can carry do not count.' },
    airlock: { name: 'Airlock', cat: 'Passengers', mass: 600, hp: 70, cost: 500, locks: 1, unlock: 0,
      desc: 'Docking hatch. Passengers board and leave through airlocks.' },
    reactor: { name: 'Reactor', cat: 'Engines', mass: 4200, hp: 120, cost: 5000, power: 1, unlock: 2,
      desc: 'Extra power: +40 shield, faster shield recharge and 8 % stronger lasers.' },
    hangar: { name: 'Hangar deck', cat: 'Tools', mass: 3600, hp: 140, cost: 6000, bay: 2, unlock: 2,
      desc: 'Flight deck for one medium drone or two small ones. The deck doors open when drones launch or land.' },
    dronebay: { name: 'Drone bay', cat: 'Tools', mass: 2500, hp: 80, cost: 2500, bay: 1, unlock: 1,
      desc: 'Room for one small drone. The doors open when it launches and when it comes home.' },
    droneclamp: { name: 'Docking clamp', cat: 'Tools', mass: 1800, hp: 90, cost: 3000, unlock: 1,
      desc: 'Holds one medium or large drone on the outside of the hull. Needs a free side facing out.' },
  };

  // Droner i tre størrelser. Små bor i dronerom, mellomstore i hangardekk
  // (eller på en klemme), store sitter på en dokkingklemme utenpå skroget.
  // npc = hvilken fartøytype i npc.js som flyr ut.
  RF.DRONE_SIZES = { S: 'Small', M: 'Medium', L: 'Large' };
  RF.DRONE_ROLES = { mine: 'Mining', repair: 'Repair', collect: 'Collecting', guard: 'Guard', cargo: 'Cargo', pax: 'Personnel' };
  RF.DRONE_TYPES = {
    gruve: { name: 'Mite mining drone', size: 'S', role: 'mine', npc: 'mite', cost: 1500, trip: true,
      desc: 'Drills soft rock near the ship and brings the ore home.' },
    rep: { name: 'Mender repair drone', size: 'S', role: 'repair', npc: 'mender', cost: 2000, trip: true,
      desc: 'Flies around the ship and welds damaged modules.' },
    gleaner: { name: 'Gleaner collector drone', size: 'S', role: 'collect', npc: 'gleaner', cost: 1800, trip: true,
      desc: 'Picks up loose ore around the ship and brings it in. Does not drill.' },
    burrow: { name: 'Burrower heavy mining drone', size: 'M', role: 'mine', npc: 'burrower', cost: 7000,
      desc: 'Heavy laser that also cuts metal and copper ore (hardness 2). Carries 6 t.' },
    picket: { name: 'Picket guard drone', size: 'M', role: 'guard', npc: 'picket', cost: 6500,
      desc: 'Stays close to the ship and burns small rocks and debris on a collision course with it.' },
    tern: { name: 'Tern crew shuttle', size: 'M', role: 'pax', npc: 'tern', cost: 9000, pax: 8,
      desc: 'Carries up to 8 people to and from the station in this system, or out to another ship. You do not have to dock.' },
    porter: { name: 'Porter cargo drone', size: 'L', role: 'cargo', npc: 'porter', cost: 15000, hold: 25,
      desc: 'Takes up to 25 t of goods from your hold to the station in this system, sells it there and flies back.' },
    ferryman: { name: 'Ferryman passenger lander', size: 'L', role: 'pax', npc: 'ferryman', cost: 18000, pax: 30,
      desc: 'Carries up to 30 people to and from the station in this system, or out to another ship.' },
  };

  // Hvor dronene bor om bord. Store droner på klemmer, mellomstore i hangarer
  // (ellers på en klemme), små i dronerom (ellers to i en hangar).
  // Gir { ok, slots: [{ d, m, kind }] } der m er modulen dronen hører til.
  RF.fitDrones = (layout, st, drones) => {
    const per = st.bayPer || 1;
    const bays = layout.filter((m) => m.t === 'dronebay').map((m) => ({ m, left: per }));
    const hangars = layout.filter((m) => m.t === 'hangar').map((m) => ({ m, left: 2 }));
    const clamps = layout.filter((m) => m.t === 'droneclamp' && RF.clampDir(layout, m) >= 0).map((m) => ({ m, left: 1 }));
    const order = { L: 0, M: 1, S: 2 };
    const list = drones.slice().sort((a, b) => order[RF.DRONE_TYPES[a.type].size] - order[RF.DRONE_TYPES[b.type].size]);
    const slots = [];
    let ok = true;
    const used = [];
    const take = (arr, need, kind, d) => {
      // Droner på klemmer trenger plass: ingen annen klemme i bruk rett ved siden av.
      const s = arr.find((x) => x.left >= need && (kind !== 'clamp' || !used.some((u) => u.cdir === x.m.cdir && Math.max(Math.abs(u.x - x.m.x), Math.abs(u.y - x.m.y)) <= 2)));
      if (!s) return false;
      if (kind === 'clamp') used.push(s.m);
      s.left -= need;
      slots.push({ d, m: s.m, kind });
      return true;
    };
    for (const d of list) {
      const z = RF.DRONE_TYPES[d.type].size;
      const done = z === 'L' ? take(clamps, 1, 'clamp', d)
        : z === 'M' ? take(hangars, 2, 'hangar', d) || take(clamps, 1, 'clamp', d)
          : take(bays, 1, 'bay', d) || take(hangars, 1, 'hangar', d);
      if (!done) ok = false;
    }
    return { ok, slots };
  };

  // Klemmen trenger en fri side ut mot rommet, helst til siden.
  RF.clampDir = (layout, m) => {
    const occ = new Set(layout.map((o) => o.x + ',' + o.y));
    for (const d of [3, 1, 2, 0]) {
      const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]][d];
      if (!occ.has(m.x + dx + ',' + (m.y + dy))) return d;
    }
    return -1;
  };

  // Skipsskrog: hvor stort rutenettet er, og hva som følger med.
  RF.HULLS = {
    hopper: {
      name: 'Skiff MK-I', cost: 0, w: 6, h: 5, unlock: 0,
      desc: 'Small one-person ship. Cheap to fly, little room.',
      layout: [
        ['thruster', 0, -1], ['thruster', 0, 1], ['fuel', 1, -1], ['frame', 1, 0], ['rcs', 1, 1],
        ['cargo', 2, -1], ['frame', 2, 0], ['cargo', 2, 1],
        ['frame', 3, -1], ['cockpit', 3, 0], ['frame', 3, 1], ['light', 3, 2],
        ['tractor', 4, -1], ['laser', 4, 0], ['anchor', 4, 1],
      ],
    },
    graver: {
      name: 'Excavator G-2', cost: 14000, w: 8, h: 7, unlock: 1,
      desc: 'Mid-size mining ship with processor, weapons, shield and a drone bay.',
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
      name: 'Rockbreaker T-3', cost: 48000, w: 9, h: 11, unlock: 2,
      desc: 'Heavy industrial ship. Crushes anything and hauls huge loads.',
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

  // Testskip: Fjellbryter med én av hver modultype (og flere av de viktigste),
  // slik at alt utstyret kan prøves med en gang.
  RF.TEST_LAYOUT = [
    ['light', 3, -5], ['light2', 4, -5],
    ['armor', 3, -4], ['frame', 4, -4], ['rocket', 5, -4],
    ['rcs', 2, -3], ['frame', 3, -3], ['frame', 4, -3], ['frame', 5, -3], ['anchor2', 6, -3], ['laser', 7, -3],
    ['thruster2', 0, -2], ['fuel', 1, -2], ['cargo2', 2, -2], ['cargo', 3, -2], ['rcs', 4, -2], ['frame', 5, -2], ['frame', 6, -2], ['tractor', 7, -2],
    ['thruster2', 0, -1], ['fuel', 1, -1], ['cargo2', 2, -1], ['cargo2', 3, -1], ['dronebay', 4, -1], ['armor2', 5, -1], ['frame', 6, -1], ['frame', 7, -1], ['laser4', 8, -1],
    ['thruster', 0, 0], ['refinery', 1, 0], ['refinery', 2, 0], ['cargo2', 3, 0], ['frame', 4, 0], ['shield', 5, 0], ['shield', 6, 0], ['cockpit', 7, 0], ['laser3', 8, 0],
    ['thruster2', 0, 1], ['fuel', 1, 1], ['cargo2', 2, 1], ['cargo2', 3, 1], ['dronebay', 4, 1], ['armor2', 5, 1], ['frame', 6, 1], ['frame', 7, 1], ['laser2', 8, 1],
    ['thruster2', 0, 2], ['fuel', 1, 2], ['cargo2', 2, 2], ['cargo', 3, 2], ['rcs', 4, 2], ['frame', 5, 2], ['frame', 6, 2], ['tractor', 7, 2],
    ['rcs', 2, 3], ['frame', 3, 3], ['frame', 4, 3], ['frame', 5, 3], ['cannon', 6, 3], ['anchor', 7, 3],
    ['armor', 3, 4], ['frame', 4, 4], ['rocket', 5, 4],
    ['light2', 4, 5],
  ];

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
    // Spillerens droner (tegnes forminsket, se scale i npc.js).
    mite: [['thruster', 0, 0], ['cockpit', 1, 0], ['laser', 2, 0], ['rcs', 1, 1], ['rcs', 1, -1]],
    mender: [['thruster', 0, 0], ['cockpit', 1, 0], ['light', 2, 0], ['rcs', 1, -1], ['rcs', 1, 1]],
    gleaner: [['thruster', 0, 0], ['cargo', 1, 0], ['cockpit', 2, 0], ['tractor', 3, 0], ['rcs', 1, -1], ['rcs', 1, 1]],
    burrower: [['thruster', 0, 0], ['cargo', 1, -1], ['cockpit', 1, 0], ['cargo', 1, 1], ['laser2', 2, 0], ['rcs', 2, -1], ['rcs', 2, 1]],
    picket: [['thruster', 0, 0], ['shield', 1, 0], ['cockpit', 2, 0], ['cannon', 3, 0], ['rcs', 2, -1], ['rcs', 2, 1], ['armor', 1, -1], ['armor', 1, 1]],
    tern: [['thruster', 0, 0], ['cabin', 1, 0], ['cockpit', 2, 0], ['airlock', 1, -1], ['airlock', 1, 1], ['light', 3, 0]],
    porter: [['thruster', 0, -1], ['thruster', 0, 1], ['frame', 0, 0], ['cargo2', 1, -1], ['cargo2', 1, 0], ['cargo2', 1, 1], ['cargo2', 2, -1], ['cockpit', 2, 0], ['cargo2', 2, 1], ['tractor', 3, 0]],
    ferryman: [['thruster', 0, -1], ['thruster', 0, 1], ['lifesup', 0, 0], ['hab', 1, -1], ['hab', 1, 0], ['hab', 1, 1], ['airlock', 2, -1], ['cockpit', 2, 0], ['airlock', 2, 1], ['light', 3, 0]],
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
      lasers: [], drills: [], guns: [], rockets: [], anchors: [], tractors: [], lights: [], bays: 0, hpMax: 0, hp: 0, blocked: [],
      pax: 0, cryo: 0, life: 6, locks: 0, power: 0, bayS: 0, hangars: 0, clamps: 0, bayPer: 1,
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
      if (D.drill && !blocked) st.drills.push({ m, ...D.drill, power: D.drill.power * eff });
      if (D.gun && !blocked) st.guns.push({ m, ...D.gun });
      if (D.ammo && !blocked) st.rockets.push({ m });
      if (D.anchor && !blocked) st.anchors.push({ m, ...D.anchor });
      if (D.tractor && !blocked) st.tractors.push({ m, F: D.tractor * eff });
      if (D.light && !blocked) st.lights.push({ m, range: D.light });
      if (m.t === 'dronebay') st.bayS++;
      if (m.t === 'hangar') st.hangars++;
      if (m.t === 'droneclamp') { m.cdir = RF.clampDir(layout, m); if (m.cdir >= 0) st.clamps++; }
      if (D.nav) st.navcomp = true;
      if (D.pax) st.pax += D.pax;
      if (D.cryo) st.cryo += D.cryo;
      if (D.life) st.life += D.life;
      if (D.locks) st.locks += D.locks;
      if (D.power) st.power += D.power;
    }
    // Cockpiten holder liv i et lite mannskap. Flere passasjerer krever livsopprettholdelse.
    st.paxCap = Math.min(st.pax, st.life) + st.cryo;
    st.shieldMax += st.power * 40;
    st.rocketCap = st.rockets.length * 6;
    st.bays = st.bayS * st.bayPer + st.hangars * 2 + st.clamps;
    return st;
  };

  // --- Automatisk montering (butikken) ---
  // Finn beste ledige rute for en ny modul: inntil skipet, innenfor skroget,
  // uten å sperre eller snu verktøy og motorer som allerede sitter der.
  const FWD_TOOLS = new Set(['laser', 'laser2', 'laser3', 'laser4', 'drill', 'cannon', 'light', 'light2']);
  RF.autoPlace = (layout, hull, t) => {
    const B = RF.hullBounds(hull), D = RF.MODULES[t];
    const occ = new Set(layout.map((m) => key(m.x, m.y)));
    const before = layout.map((m) => [RF.isBlocked(layout, m), m.dir]);
    const cy = layout.reduce((a, m) => a + m.y, 0) / (layout.length || 1);
    let best = null, bs = -Infinity;
    for (let x = B.x0; x <= B.x1; x++) {
      for (let y = B.y0; y <= B.y1; y++) {
        if (occ.has(key(x, y))) continue;
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => occ.has(key(x + dx, y + dy))).length;
        if (!nb) continue;
        const m = { t, x, y, hp: D.hp };
        const L2 = layout.concat([m]);
        if (RF.isBlocked(L2, m)) continue;
        let bad = false;
        for (let i = 0; i < layout.length && !bad; i++) {
          const o = layout[i];
          const bl = RF.isBlocked(L2, o);
          if ((!before[i][0] && bl) || (RF.MODULES[o.t].mount && o.dir !== before[i][1])) bad = true;
        }
        if (bad) continue;
        let sc = 0;
        if (D.mount) {
          if (FWD_TOOLS.has(t)) sc += (m.dir === 0 ? 100 : m.dir === 2 ? -50 : 30) + x * 6 - Math.abs(y - cy) * 2;
          else sc += (m.dir === 1 || m.dir === 3 ? 60 : m.dir === 0 ? 40 : 0) + x * 2;
        } else if (D.face === 'aft') sc += -x * 20 - Math.abs(y - cy);
        else if (t === 'rcs') sc += Math.abs(y - cy) * 6 + Math.abs(x - B.x1 / 2) * 2;
        else if (t === 'armor' || t === 'armor2') sc += (4 - nb) * 10 + x * 2;
        else sc += nb * 12 - Math.abs(y - cy) * 2 - Math.abs(x - B.x1 / 2);
        if (sc > bs) { bs = sc; best = m; }
      }
    }
    // Sett retningene tilbake slik de var.
    for (const m of layout) RF.isBlocked(layout, m);
    return best;
  };

  // Ta bort én modul av en type uten at resten av skipet faller fra hverandre.
  RF.autoRemove = (layout, t) => {
    for (let i = layout.length - 1; i >= 0; i--) {
      const m = layout[i];
      if (m.t !== t || RF.MODULES[t].unique) continue;
      const rest = layout.filter((o) => o !== m);
      if (!RF.disconnected(rest).length) return m;
    }
    return null;
  };

  // Testskipet: Fjellbryter med alt som er, pluss to borehoder og navigasjonsdatamaskin.
  RF.testLayout = () => {
    const L = RF.layoutFrom(RF.TEST_LAYOUT);
    for (const t of ['drill', 'drill', 'navcomp', 'hangar', 'droneclamp', 'droneclamp']) {
      const m = RF.autoPlace(L, 'fjell', t);
      if (m) L.push(m);
    }
    return L;
  };

  RF.layoutValue = (layout) => layout.reduce((s, m) => s + RF.MODULES[m.t].cost, 0);
})();
