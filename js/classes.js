// Skipsklasser: seks linjer (personell, frakt, gruvedrift, droner, jagere og
// krigsskip) i fem nivåer. Hver linje gir en bonus, og formen på skipet gir
// egne fordeler (se RF.hullTraits). Alle skip kan kjøpes når man har råd,
// uten å eie skipet før i linjen.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});

  // Fargene på skroget. Sivile skip er beige, passasjerskip lyse,
  // droneskip grønngrå og militære skip blågrå.
  const PAL = {
    civ: null,
    pax: {
      hull: { base: ['#a9a69e', '#85827a', '#5a5850'], deck: ['#e8e6df', '#c9c6bd', '#94918a'], spine: ['#f6f4ee', '#dcd9d0', '#a8a59c'] },
      tones: { light: ['#f2f0ea', '#cfccc3', '#98958d'], mid: ['#dedbd2', '#b5b2a9', '#7f7c74'], dark: ['#aeaba2', '#86837b', '#57554e'] },
    },
    dro: {
      hull: { base: ['#7d8078', '#62655e', '#40423d'], deck: ['#aeb2a6', '#8f9388', '#62665c'], spine: ['#c6cabd', '#a6aa9d', '#767a6e'] },
      tones: { light: ['#d0d4c6', '#a9ad9f', '#77796d'], mid: ['#bbbfb1', '#95998b', '#66695e'], dark: ['#94988b', '#707466', '#494b42'] },
    },
    mil: {
      hull: { base: ['#6c7379', '#52585e', '#34383d'], deck: ['#9aa2aa', '#7a828a', '#50565d'], spine: ['#b4bcc4', '#949ca4', '#687078'] },
      tones: { light: ['#c3cad1', '#9ba3ab', '#687079'], mid: ['#aab2ba', '#858d95', '#5a6168'], dark: ['#848c94', '#646b72', '#40454b'] },
    },
  };

  // Linjene og bonusen hver av dem gir. apply endrer egenskapene til skipet.
  RF.LINES = {
    pax: {
      name: 'Personnel', color: '#f0d27a', pal: PAL.pax,
      bonus: '+30 % shield, 20 % less fuel use',
      apply(st) { st.shieldMax *= 1.3; st.fuelMul *= 0.8; },
    },
    frt: {
      name: 'Freight', color: '#5fc1e8', pal: PAL.civ,
      bonus: '+25 % cargo space, +10 % engine thrust',
      apply(st) { st.hold = Math.round(st.hold * 1.25); st.thrustMul *= 1.1; },
    },
    min: {
      name: 'Mining', color: '#e8a54a', pal: PAL.civ,
      bonus: '+25 % laser and drill power, +25 % processing speed, +25 % collector beam pull',
      apply(st) { st.laserMul *= 1.25; st.proc *= 1.25; st.tractorMul *= 1.25; },
    },
    dro: {
      name: 'Drones', color: '#b58cf0', pal: PAL.dro,
      bonus: 'Each drone bay holds two small drones, and drones work 25 % faster',
      apply(st) { st.bayPer = 2; st.bays = st.bayS * 2 + st.hangars * 2 + st.clamps; st.droneMul *= 1.25; },
    },
    fig: {
      name: 'Fighters', color: '#f07a6a', pal: PAL.mil,
      bonus: '+50 % turning force, 40 % faster turn rate, guns fire 25 % faster',
      apply(st) { st.torqueMul *= 1.5; st.maxW *= 1.4; st.gunRateMul *= 1.25; },
    },
    war: {
      name: 'Warships', color: '#9fb4c8', pal: PAL.mil,
      bonus: '+40 % shield, 20 % less hull damage, guns fire 10 % faster',
      apply(st) { st.shieldMax *= 1.4; st.dmgMul *= 0.8; st.gunRateMul *= 1.1; },
    },
  };
  RF.LINE_ORDER = ['pax', 'frt', 'min', 'dro', 'fig', 'war'];
  RF.TIER_NAMES = ['I', 'II', 'III', 'IV', 'V'];

  // Symmetrisk oppsett: rader [x, midt, side1, side2, ...] gir moduler på
  // y = 0, ±1, ±2 ... Lett å lese og alltid speilet.
  function sym(rows) {
    const L = [];
    for (const r of rows) {
      const x = r[0];
      if (r[1]) L.push([r[1], x, 0]);
      for (let i = 2; i < r.length; i++) if (r[i]) { L.push([r[i], x, -(i - 1)]); L.push([r[i], x, i - 1]); }
    }
    return L;
  }
  const rep = (n, x0, row) => Array.from({ length: n }, (_, i) => [x0 + i, ...row]);

  // [id, linje, nivå, navn, klasse, pris, beskrivelse, oppsett]
  const NEW = [
    ['lark', 'pax', 1, 'Lark P-2', 'Shuttle', 6000, 'Pilot plus two passengers. Taxi between stations.',
      sym([[0, 'thruster', 'rcs'], [1, 'fuel', 'airlock'], [2, 'cabin', 'frame'], [3, 'cockpit']])],
    ['ferrier', 'pax', 2, 'Ferrier P-10', 'Ferry', 18000, 'Ten seats, shield bow and airlocks on both sides.',
      sym([[0, 'thruster', 'thruster'], [1, 'fuel', 'fuel'], [2, 'lifesup', 'cabin', 'rcs'], [3, 'cabin', 'frame', 'airlock'], [4, 'shield', 'cabin'], [5, 'cockpit', 'light']])],
    ['coach', 'pax', 3, 'Coachliner P-80', 'Liner', 55000, 'Habitat block well away from the engines, and clamps for two shuttles.',
      sym([[0, 'thruster2', 'thruster2'], [1, 'fuel', 'fuel'], [2, 'reactor', 'fuel'], [3, 'frame', 'droneclamp'], [4, 'lifesup', 'hab', 'airlock'], [5, 'hab', 'hab'], [6, 'hab', 'frame', 'airlock'], [7, 'shield', 'hab', 'rcs'], [8, 'cockpit', 'light']])],
    ['tide', 'pax', 4, 'Tidewater P-290', 'Passenger liner', 160000, 'Long spine, six airlocks and three life-support cores.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel'], [2, 'reactor', 'fuel', 'rcs'], [3, 'frame', 'droneclamp'], [4, 'frame'], [5, 'lifesup', 'hab', 'hab', 'hab'], [6, 'hab', 'hab', 'hab', 'airlock'], [7, 'hab', 'hab', 'frame', 'hab'], [8, 'lifesup', 'hab', 'hab', 'airlock'], [9, 'hab', 'frame', 'hab', 'hab'], [10, 'lifesup', 'hab', 'hab', 'airlock'], [11, 'shield', 'shield', 'armor'], [12, 'cockpit', 'light']])],
    ['ark', 'pax', 5, 'Arkhaven P-1000', 'Colony ship', 450000, 'Carries a whole settlement: awake crew in the middle, colonists in cryo berths on the flanks.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel', 'fuel'], [2, 'reactor', 'fuel', 'fuel', 'rcs'], [3, 'reactor', 'frame'], [4, 'frame'], [5, 'frame'],
        [6, 'lifesup', 'hab', 'hab', 'cryo', 'cryo'], [7, 'hab', 'hab', 'hab', 'cryo', 'airlock'], [8, 'lifesup', 'hab', 'hab', 'cryo', 'cryo'], [9, 'lifesup', 'hangar', 'hab', 'cryo', 'cryo'], [10, 'hab', 'hangar', 'hab', 'cryo', 'airlock'],
        [11, 'lifesup', 'hab', 'hab', 'cryo', 'cryo'], [12, 'lifesup', 'hab', 'hab', 'cryo', 'cryo'], [13, 'hab', 'hab', 'hab', 'cryo', 'airlock'], [14, 'shield', 'shield', 'armor', 'armor', 'rcs'], [15, 'cockpit', 'armor', 'light2']])],
    ['dart', 'frt', 1, 'Dart F-1', 'Courier', 5000, 'Fast little parcel ship with a collector beam.',
      sym([[0, 'thruster', 'thruster'], [1, 'fuel', 'rcs'], [2, 'cargo', 'cargo'], [3, 'cockpit', 'frame'], [4, 'tractor']])],
    ['oxcart', 'frt', 2, 'Oxcart F-2', 'Hauler', 8000, 'Slow, cheap and roomy. Ore runs and cargo jobs.',
      sym([[0, 'thruster', 'thruster'], [1, 'fuel', 'fuel'], [2, 'cargo2', 'cargo2'], [3, 'cargo2', 'cargo2', 'rcs'], [4, 'cockpit', 'cargo'], [5, 'tractor']])],
    ['caravan', 'frt', 3, 'Caravan F-3', 'Freighter', 30000, 'Large holds, its own processor and a harpoon.',
      sym([[0, 'thruster2', 'thruster2', 'thruster'], [1, 'fuel', 'fuel', 'rcs'], [2, 'refinery', 'cargo2', 'cargo2'], [3, 'cargo2', 'cargo2', 'cargo2'], [4, 'cargo2', 'cargo2', 'cargo'], [5, 'frame', 'shield', 'rcs'], [6, 'cockpit', 'tractor'], [7, 'anchor']])],
    ['longhaul', 'frt', 4, 'Longhaul F-4', 'Container ship', 80000, 'Open spine with container racks on both sides, and clamps for two cargo drones.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'droneclamp'], ...rep(7, 3, ['frame', 'cargo2', 'cargo2', 'cargo2']), [10, 'frame', 'tractor', 'rcs'], [11, 'cockpit']])],
    ['stonewain', 'frt', 5, 'Stonewain F-5', 'Bulk carrier', 220000, "Moves a station's worth of goods. Loader drones.",
      sym([[0, 'thruster2', 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'reactor', 'fuel'], [3, 'frame', 'frame', 'droneclamp'], ...rep(4, 4, ['frame', 'cargo2', 'cargo2', 'cargo2', 'cargo2']),
        [8, 'lifesup', 'frame', 'frame', 'frame', 'airlock'], ...rep(4, 9, ['frame', 'cargo2', 'cargo2', 'cargo2', 'cargo2']), [13, 'shield', 'dronebay', 'tractor', 'rcs'], [14, 'cockpit', 'shield']])],
    ['pickaxe', 'min', 2, 'Pickaxe M-2', 'Prospector', 9000, 'Laser, drill and a small processor.',
      sym([[0, null, 'thruster'], [1, 'frame', 'fuel'], [2, 'refinery', 'cargo'], [3, 'cockpit', 'frame', 'light'], [4, 'laser', 'drill']])],
    ['quarry', 'min', 5, 'Quarrymother M-5', 'Mining barge', 180000, 'Mobile refinery with drills, lasers and drone wings.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'refinery', 'refinery', 'cargo2'], [3, 'refinery', 'cargo2', 'cargo2', 'cargo2'], [4, 'cargo2', 'cargo2', 'cargo2', 'dronebay'],
        [5, 'cargo2', 'cargo2', 'cargo2', 'dronebay'], [6, 'dronebay', 'shield', 'cargo2', 'rcs'], [7, 'frame', 'frame', 'cargo2', 'anchor2'], [8, 'cockpit', 'armor', 'frame', 'tractor'], [9, 'laser3', 'drill', 'drill', 'laser2']])],
    ['spindle', 'dro', 1, 'Spindle D-1', 'Drone tender', 7000, 'One drone bay and a sensor dish.',
      sym([[0, 'thruster', 'thruster'], [1, 'fuel', 'rcs'], [2, 'dronebay', 'frame'], [3, 'cockpit', 'navcomp']])],
    ['warren', 'dro', 2, 'Warren D-2', 'Drone ship', 20000, 'Bays around a sensor core, and a gun in the bow.',
      sym([[0, 'thruster2', 'thruster'], [1, 'fuel', 'fuel'], [2, 'dronebay', 'dronebay'], [3, 'navcomp', 'dronebay', 'rcs'], [4, 'cockpit', 'shield'], [5, 'cannon']])],
    ['hivekeep', 'dro', 3, 'Hivekeep D-3', 'Drone carrier', 60000, 'Bays open outward on both flanks.',
      sym([[0, 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'dronebay', 'dronebay'], [3, 'frame', 'dronebay', 'dronebay'], [4, 'navcomp', 'dronebay', 'dronebay'], [5, 'shield', 'armor', 'rcs'], [6, 'cockpit', 'cannon']])],
    ['brood', 'dro', 4, 'Broodhall D-4', 'Hangar carrier', 140000, 'Two hangar decks and a row of drone bays.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel'], [2, 'reactor', 'frame', 'rcs'], ...rep(6, 3, ['frame', 'hangar', 'dronebay']), [9, 'navcomp', 'shield', 'armor'], [10, 'cockpit', 'cannon', 'rcs']])],
    ['skyvault', 'dro', 5, 'Skyvault D-5', 'Supercarrier', 400000, 'Four flight decks. Launches whole swarms of drones.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'reactor', 'fuel', 'fuel'],
        ...rep(9, 3, ['frame', 'hangar', 'hangar', 'dronebay']).map((r, i) => (i % 3 === 1 ? [r[0], 'lifesup', ...r.slice(2)] : r)),
        [12, 'navcomp', 'shield', 'shield', 'armor', 'rcs'], [13, 'cockpit', 'armor', 'cannon', 'cannon'], [14, 'cannon']])],
    ['gadfly', 'fig', 1, 'Gadfly L-1', 'Light fighter', 10000, 'Two guns right beside the cockpit and a big engine.',
      sym([[0, 'thruster2', 'rcs'], [1, 'fuel', 'cannon'], [2, 'cockpit']])],
    ['needle', 'fig', 2, 'Needle L-2', 'Interceptor', 16000, 'Thrusters at both ends turn it very fast.',
      sym([[0, 'thruster2', 'thruster'], [1, 'fuel', 'rcs'], [2, 'fuel'], [3, 'shield', 'cannon'], [4, 'cockpit', 'rcs'], [5, 'cannon']])],
    ['brawler', 'fig', 3, 'Brawler H-3', 'Heavy fighter', 30000, 'Armored bow and four guns.',
      sym([[0, 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'rcs'], [2, 'shield', 'armor', 'cannon'], [3, 'cockpit', 'armor2', 'rcs'], [4, 'cannon', 'cannon']])],
    ['cudgel', 'fig', 4, 'Cudgel H-4', 'Strike craft', 45000, 'Rocket pods on the wings. Hits big targets.',
      sym([[0, 'thruster2', 'thruster2', 'rcs'], [1, 'fuel', 'fuel', 'rocket'], [2, 'shield', 'armor2', 'frame', 'rocket'], [3, 'frame', 'armor2', 'rcs'], [4, 'cockpit', 'cannon'], [5, 'rocket']])],
    ['vigil', 'war', 2, 'Vigil K-2', 'Corvette', 40000, 'Patrol ship. The bridge sits behind the armor.',
      sym([[0, 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'shield', 'cannon'], [3, 'cockpit', 'armor', 'cannon'], [4, 'armor2', 'armor2'], [5, 'rocket']])],
    ['rampart', 'war', 3, 'Rampart K-3', 'Frigate', 90000, 'Escort with drones and a sensor core.',
      sym([[0, 'thruster2', 'thruster2', 'thruster'], [1, 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'shield', 'cannon'], [3, 'lifesup', 'dronebay', 'armor'], [4, 'cockpit', 'shield', 'cannon'], [5, 'navcomp', 'armor2', 'armor2'], [6, 'armor2', 'rocket'], [7, 'cannon']])],
    ['grimtide', 'war', 4, 'Grimtide K-4', 'Destroyer', 200000, 'Lance in the bow, heavy mass drivers on both flanks.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'reactor', 'shield', 'cannon'], [3, 'frame', 'lifesup', 'armor', 'armor2'], [4, 'frame', 'dronebay', 'cannon'], [5, 'cockpit', 'shield', 'armor2', 'armor2'],
        [6, 'navcomp', 'armor2', 'cannon'], [7, 'frame', 'armor2', 'rocket']]).concat([['lance', 8, -1], ['cannon2', 3, 4], ['cannon2', 3, -5]])],
    ['thunder', 'war', 5, 'Thunderhold K-5', 'Battlecruiser', 520000, 'A lance in the bow, heavy guns and missile batteries, hangars and armor all round.',
      sym([[0, 'thruster2', 'thruster2', 'thruster2', 'thruster2'], [1, 'fuel', 'fuel', 'fuel', 'fuel', 'rcs'], [2, 'reactor', 'reactor', 'fuel', 'shield', 'cannon'], [3, 'reactor', 'frame', 'lifesup', 'armor2', 'armor2'], [4, 'frame', 'hangar', 'dronebay', 'cannon'],
        [5, 'frame', 'hangar', 'dronebay', 'armor2', 'armor2'], [6, 'lifesup', 'shield', 'armor', 'cannon'], [7, 'cockpit', 'navcomp', 'shield', 'armor2', 'armor2'], [8, 'frame', 'frame', 'rocket', 'cannon'], [9, 'shield', 'armor', null, 'armor2'],
        [10, 'frame', 'rocket', 'cannon'], [11, 'frame', null, 'armor2'], [12, null, null, 'armor2']]).concat([['lance', 12, -1], ['cannon2', 5, 5], ['cannon2', 5, -6], ['rocket2', 7, 5], ['rocket2', 7, -6]])],
  ];

  // De tre skipene som fantes fra før, er gruveskip.
  Object.assign(RF.HULLS.hopper, { line: 'min', tier: 1, cls: 'Starter', len: 12 });
  Object.assign(RF.HULLS.graver, { line: 'min', tier: 3, cls: 'Miner', len: 40 });
  Object.assign(RF.HULLS.fjell, { line: 'min', tier: 4, cls: 'Heavy miner', len: 90 });

  // Hvor lange skipene er i virkeligheten (meter). Små skip har rutene sine
  // på 2,4 m, store skip får større ruter (se hullScale i modules.js).
  const LEN = {lark: 10, ferrier: 24, coach: 60, tide: 180, ark: 450, dart: 12, oxcart: 24, caravan: 60, longhaul: 220, stonewain: 500, pickaxe: 18, quarry: 300, spindle: 12, warren: 30, hivekeep: 70, brood: 200, skyvault: 450, gadfly: 10, needle: 20, brawler: 26, cudgel: 32, vigil: 55, rampart: 110, grimtide: 300, thunder: 800};

  for (const [id, line, tier, name, cls, cost, desc, layout] of NEW) {
    let mx = 0, my = 0;
    for (const [, x, y] of layout) { mx = Math.max(mx, x); my = Math.max(my, Math.abs(y)); }
    // Litt plass rundt skroget til utstyr man kjøper senere.
    RF.HULLS[id] = { name, cost, desc, layout, line, tier, cls, w: mx + 2, h: 2 * my + 3, unlock: 0, len: LEN[id] };
  }
  // Målestokken: ønsket lengde delt på lengden rutene gir.
  for (const id in RF.HULLS) {
    const H = RF.HULLS[id];
    let x0 = 99, x1 = -99;
    for (const [t, x] of H.layout) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + (RF.MODULES[t].size || 1) - 1); }
    H.scale = H.len ? Math.max(1, H.len / ((x1 - x0 + 1) * RF.CELL)) : 1;
  }

  RF.hullLine = (hullId) => RF.LINES[(RF.HULLS[hullId] && RF.HULLS[hullId].line) || 'min'];

  // --- Fordeler fra formen på skipet ---
  // Regnes ut fra hvor modulene sitter, så to skip med samme utstyr kan
  // oppføre seg ulikt. Gjelder også når man bygger om skipet selv.
  const ARMOR = new Set(['armor', 'armor2', 'shield']);
  RF.hullTraits = (layout) => {
    const out = [];
    if (!layout.length) return out;
    let x0 = Infinity, x1 = -Infinity, ymax = 0;
    for (const m of layout) { x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); ymax = Math.max(ymax, Math.abs(m.y)); }
    const len = x1 - x0 + 1, span = 2 * ymax + 1;
    const occ = new Set(layout.map((m) => m.x + ',' + m.y));
    // Pansret baug: panser eller skjold i den fremste tredjedelen.
    const front = x1 - Math.max(1, Math.floor(len / 3));
    const bow = layout.filter((m) => ARMOR.has(m.t) && m.x > front).length;
    if (bow >= 2) out.push({ id: 'bow', name: 'Armored bow', desc: 'Hits from the front do 30 % less damage' });
    // Styredyser ytterst: på vingetuppene eller helt foran/bak.
    const tips = layout.filter((m) => m.t === 'rcs' && (Math.abs(m.y) >= ymax && ymax >= 1 || m.x === x0 || m.x >= x1 - 1)).length;
    if (tips >= 2) out.push({ id: 'tips', name: 'Wingtip thrusters', desc: '+20 % turning force' });
    // Smal og lang: lite treghet sidelengs, snur og sidestyrer lett.
    if (span <= 5 && len >= span * 1.2) out.push({ id: 'slim', name: 'Slim hull', desc: '+20 % turn rate and strafing' });
    // Broen inne i skroget: moduler på alle fire sider av cockpiten.
    const c = layout.find((m) => m.t === 'cockpit');
    if (c && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => occ.has(c.x + dx + ',' + (c.y + dy))))
      out.push({ id: 'bridge', name: 'Protected bridge', desc: 'The cockpit takes half damage' });
    // Motorene langt fra passasjerene, med tanker og reaktor imellom.
    const hab = layout.filter((m) => m.t === 'hab' || m.t === 'cabin');
    if (hab.length) {
      const rear = Math.min(...hab.map((m) => m.x));
      const eng = Math.max(...layout.filter((m) => RF.MODULES[m.t].thrust).map((m) => m.x), -99);
      if (rear - eng >= 3) out.push({ id: 'decks', name: 'Shielded decks', desc: 'Tanks and reactor between engines and decks: passenger modules take 40 % less damage' });
    }
    // Åpen ryggrad med last på sidene: raskere lasting.
    const pods = layout.filter((m) => m.t === 'cargo' || m.t === 'cargo2');
    if (pods.length >= 6 && pods.filter((m) => [[0, 1], [0, -1]].some(([dx, dy]) => !occ.has(m.x + dx + ',' + (m.y + dy)))).length >= pods.length / 3)
      out.push({ id: 'racks', name: 'Side racks', desc: 'Buys and sells 10 % better at the market (faster loading)' });
    return out;
  };

  // Bruk linjebonus og formfordeler på egenskapene til et skip.
  RF.applyClass = (st, hullId, layout) => {
    Object.assign(st, { fuelMul: 1, thrustMul: 1, laserMul: 1, tractorMul: 1, droneMul: 1, torqueMul: 1, gunRateMul: 1, dmgMul: 1, bowMul: 1, bridgeMul: 1, deckMul: 1, strafeMul: 1, tradeMul: 1 });
    const line = RF.hullLine(hullId);
    st.line = line;
    line.apply(st);
    st.traits = RF.hullTraits(layout);
    for (const t of st.traits) {
      if (t.id === 'bow') st.bowMul = 0.7;
      if (t.id === 'tips') st.torqueMul *= 1.2;
      if (t.id === 'slim') { st.maxW *= 1.2; st.strafeMul *= 1.2; }
      if (t.id === 'bridge') st.bridgeMul = 0.5;
      if (t.id === 'decks') st.deckMul = 0.6;
      if (t.id === 'racks') st.tradeMul = 1.1;
    }
    st.maxW = Math.min(st.maxW, 4);
    return st;
  };
})();
