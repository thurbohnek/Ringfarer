// Asteroider og kometer bygget av et rutenett av noder (voksler). Hver node har
// en fyllgrad (0–1), et mineral og en tone. Omrisset finnes med marching
// squares, og kollisjonsformen er mange små konvekse biter. Det gjør at man kan
// bore huler og tunneler, og at en bit som løsner passer nøyaktig i hullet den
// etterlater. Steiner deler seg bare når en del faktisk mister kontakten.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const TH = 0.5;
  const MATS = Object.keys(RF.MATERIALS);
  const MI = {};
  MATS.forEach((k, i) => (MI[k] = i));
  const DENS = MATS.map((k) => RF.MATERIALS[k].density);
  const HARD = MATS.map((k) => RF.MATERIALS[k].hard);
  const Vox = (RF.Vox = { MATS, MI, TH });

  // --- Støy ---
  function hash(i, j, seed) {
    let h = (i * 374761393 + j * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(i, j, seed), b = hash(i + 1, j, seed), c = hash(i, j + 1, seed), d = hash(i + 1, j + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed, oct = 3) {
    let s = 0, amp = 0.5, f = 1, tot = 0;
    for (let k = 0; k < oct; k++) {
      s += amp * vnoise(x * f, y * f, seed + k * 17);
      tot += amp; amp *= 0.5; f *= 2.03;
    }
    return s / tot;
  }
  Vox.fbm = fbm;

  function grid(NX, NY, s, ox, oy) {
    const n = NX * NY;
    return { NX, NY, s, ox, oy, f: new Float32Array(n), m: new Uint8Array(n), t: new Uint8Array(n), dirty: true };
  }

  // Kanter i en rute: [hjørne a, hjørne b] i fast retning (lav indeks -> høy).
  const EDGES = [[0, 1], [1, 2], [3, 2], [0, 3]];
  function edgeId(q, k0, NX) {
    if (q === 0) return 2 * k0;
    if (q === 1) return 2 * (k0 + 1) + 1;
    if (q === 2) return 2 * (k0 + NX);
    return 2 * k0 + 1;
  }

  // Bygg kollisjonsbiter, omriss, masse og treghetsmoment fra rutenettet.
  // Flytter origo til tyngdepunktet. Returnerer false hvis steinen er tom.
  function rebuild(b) {
    const V = b.vox, { NX, NY, s, f, m } = V;
    const parts = [];
    const nextOf = new Map(), ptOf = new Map();
    let M = 0, Mx = 0, My = 0, Io = 0, area = 0;
    const addPart = (verts, d) => {
      const A = G.polyArea(verts);
      if (A < 1e-4) return;
      const c = G.polyCentroid(verts);
      M += A * d; Mx += c.x * A * d; My += c.y * A * d;
      Io += G.polyInertia(verts) * d;
      area += A;
      parts.push({ verts, cx: c.x, cy: c.y });
    };
    const vs = [0, 0, 0, 0], px = [0, 0, 0, 0], py = [0, 0, 0, 0], ks = [0, 0, 0, 0];
    for (let j = 0; j < NY - 1; j++) {
      let run = -1, rd = 0;
      const y0 = V.oy + j * s, y1 = y0 + s;
      for (let i = 0; i < NX; i++) {
        const k0 = j * NX + i;
        let full = false;
        if (i < NX - 1) {
          ks[0] = k0; ks[1] = k0 + 1; ks[2] = k0 + NX + 1; ks[3] = k0 + NX;
          for (let q = 0; q < 4; q++) vs[q] = f[ks[q]];
          full = vs[0] >= TH && vs[1] >= TH && vs[2] >= TH && vs[3] >= TH;
        }
        if (full) {
          if (run < 0) run = i;
          rd += (DENS[m[ks[0]]] + DENS[m[ks[1]]] + DENS[m[ks[2]]] + DENS[m[ks[3]]]) * 0.25;
          continue;
        }
        if (run >= 0) {
          const x0 = V.ox + run * s, x1 = V.ox + i * s;
          addPart([{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], rd / (i - run));
          run = -1; rd = 0;
        }
        if (i >= NX - 1) break;
        if (vs[0] < TH && vs[1] < TH && vs[2] < TH && vs[3] < TH) continue;
        const x0 = V.ox + i * s, x1 = x0 + s;
        px[0] = x0; px[1] = x1; px[2] = x1; px[3] = x0;
        py[0] = y0; py[1] = y0; py[2] = y1; py[3] = y1;
        const poly = [], cr = [];
        let dsum = 0, dn = 0;
        for (let q = 0; q < 4; q++) {
          if (vs[q] >= TH) {
            poly.push({ x: px[q], y: py[q] }); cr.push(-1);
            dsum += DENS[m[ks[q]]]; dn++;
          }
          const q2 = (q + 1) & 3;
          if ((vs[q] >= TH) !== (vs[q2] >= TH)) {
            const ca = EDGES[q][0], cb = EDGES[q][1];
            const t = (TH - vs[ca]) / (vs[cb] - vs[ca]);
            const x = px[ca] + (px[cb] - px[ca]) * t, y = py[ca] + (py[cb] - py[ca]) * t;
            const id = edgeId(q, k0, NX);
            poly.push({ x, y }); cr.push(id);
            ptOf.set(id, { x, y });
          }
        }
        addPart(poly, dsum / dn);
        for (let q = 0, n = poly.length; q < n; q++) {
          const a1 = cr[q], a2 = cr[(q + 1) % n];
          if (a1 >= 0 && a2 >= 0) nextOf.set(a1, a2);
        }
      }
    }
    if (area < 0.02 || M <= 0) return false;

    const loops = [];
    const seen = new Set();
    for (const start of nextOf.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      let e = start, guard = 0;
      while (e !== undefined && !seen.has(e) && guard++ < 200000) {
        seen.add(e);
        loop.push(ptOf.get(e));
        e = nextOf.get(e);
      }
      if (loop.length >= 3) loops.push(loop);
    }

    const cx = Mx / M, cy = My / M;
    const I = Math.max(Io - M * (cx * cx + cy * cy), M * 0.01);
    for (const p of parts) {
      let r = 0;
      for (const v of p.verts) { v.x -= cx; v.y -= cy; }
      p.cx -= cx; p.cy -= cy;
      for (const v of p.verts) r = Math.max(r, (v.x - p.cx) ** 2 + (v.y - p.cy) ** 2);
      p.r = Math.sqrt(r);
      p.radius = p.r;
      p.normals = [];
      for (let i = 0, n = p.verts.length; i < n; i++) {
        const a = p.verts[i], c = p.verts[(i + 1) % n];
        const ex = c.x - a.x, ey = c.y - a.y, l = G.len(ex, ey) || 1;
        p.normals.push({ x: ey / l, y: -ex / l });
      }
      p.wv = p.verts.map(() => ({ x: 0, y: 0 }));
      p.wn = p.verts.map(() => ({ x: 0, y: 0 }));
      p.stamp = -1;
    }
    let rad = 0;
    const all = [];
    for (const l of loops) for (const p of l) { p.x -= cx; p.y -= cy; all.push(p); rad = Math.max(rad, p.x * p.x + p.y * p.y); }
    V.ox -= cx; V.oy -= cy;
    b.shiftOrigin(cx, cy);
    if (b.craters) for (const c of b.craters) { c.x -= cx; c.y -= cy; }
    const ws = RF.game && RF.game.sys && RF.game.sys.world;
    if (ws) for (const r of ws.ropes) {
      if (r.B === b) { r.lb.x -= cx; r.lb.y -= cy; }
      if (r.A === b) { r.la.x -= cx; r.la.y -= cy; }
    }

    let hull = G.convexHull(all);
    if (hull.length < 3) hull = G.box(-0.3, -0.3, 0.3, 0.3);
    b.verts = hull.map((p) => ({ x: p.x, y: p.y }));
    b.normals = [];
    for (let i = 0, n = b.verts.length; i < n; i++) {
      const a = b.verts[i], c = b.verts[(i + 1) % n];
      const ex = c.x - a.x, ey = c.y - a.y, l = G.len(ex, ey) || 1;
      b.normals.push({ x: ey / l, y: -ex / l });
    }
    b.wv = []; b.wn = [];
    b.parts = parts;
    b.loops = loops;
    b.radius = Math.sqrt(rad) + 0.05;
    b.area = area;
    b.density = M / area;
    b.mass = b.baseMass = M;
    b.I = b.baseI = I;
    b.invMass = 1 / M;
    b.invI = 1 / I;
    // Mest vanlige mineral bestemmer navnet på steinen.
    const cnt = new Float32Array(MATS.length);
    for (let k = 0; k < f.length; k++) if (f[k] >= TH) cnt[m[k]]++;
    let best = 0;
    for (let i = 1; i < cnt.length; i++) if (cnt[i] > cnt[best]) best = i;
    b.mat = MATS[best];
    // Hvor stor del av steinen som er gråstein (uten verdi).
    let stoneN = 0, allN = 0;
    for (let i = 0; i < cnt.length; i++) { allN += cnt[i]; if (RF.MATERIALS[MATS[i]].stone) stoneN += cnt[i]; }
    b.stoneFrac = allN ? stoneN / allN : 1;
    b.kind = 'rock';
    b.integrity = (1.5 + 0.25 * Math.sqrt(area)) * RF.MATERIALS[b.mat].hard;
    V.dirty = true;
    V.facets = null;
    return true;
  }
  Vox.rebuild = rebuild;

  // Sammenhengende grupper av faste noder (8 naboer, samme som marching squares).
  function components(V) {
    const { NX, NY, f } = V;
    const lab = new Int32Array(NX * NY).fill(-1);
    const comps = [], stack = [];
    for (let k = 0; k < NX * NY; k++) {
      if (f[k] < TH || lab[k] >= 0) continue;
      const c = [];
      lab[k] = comps.length;
      stack.push(k);
      while (stack.length) {
        const q = stack.pop();
        c.push(q);
        const i = q % NX, j = (q / NX) | 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j + dj;
          if (jj < 0 || jj >= NY) continue;
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            if ((!di && !dj) || ii < 0 || ii >= NX) continue;
            const kk = jj * NX + ii;
            if (f[kk] >= TH && lab[kk] < 0) { lab[kk] = comps.length; stack.push(kk); }
          }
        }
      }
      comps.push(c);
    }
    return comps;
  }

  function makeBody(V, o) {
    const b = new RF.Body(G.box(-0.5, -0.5, 0.5, 0.5), 1000, {
      x: o.x, y: o.y, a: o.a, vx: o.vx, vy: o.vy, w: o.w, kind: 'rock',
      restitution: o.restitution != null ? o.restitution : 0.22, friction: 0.6,
    });
    b.vox = V;
    b.stress = 0;
    b.heat = 0;
    b._chip = 0;
    b.craters = o.craters || [];
    b.veins = [];
    b.world = o.world;
    return rebuild(b) ? b : null;
  }

  // Ny stein av noen av nodene til pb, på nøyaktig samme sted i verden.
  function sub(pb, nodes) {
    const P = pb.vox, NX0 = P.NX, s = P.s;
    const inSet = new Uint8Array(P.f.length);
    for (const k of nodes) inSet[k] = 1;
    const list = nodes.slice();
    // Ta med de halvfulle nabonodene så ytterkanten beholder formen sin.
    for (const k of nodes) {
      for (const kk of [k - 1, k + 1, k - NX0, k + NX0]) {
        if (kk >= 0 && kk < P.f.length && !inSet[kk] && P.f[kk] > 0 && P.f[kk] < TH) { inSet[kk] = 2; list.push(kk); }
      }
    }
    let i0 = 1e9, i1 = -1, j0 = 1e9, j1 = -1;
    for (const k of list) {
      const i = k % NX0, j = (k / NX0) | 0;
      if (i < i0) i0 = i; if (i > i1) i1 = i;
      if (j < j0) j0 = j; if (j > j1) j1 = j;
    }
    const NX = i1 - i0 + 3, NY = j1 - j0 + 3;
    const V = grid(NX, NY, s, P.ox + (i0 - 1) * s, P.oy + (j0 - 1) * s);
    for (const k of list) {
      const i = k % NX0, j = (k / NX0) | 0;
      const kk = (j - j0 + 1) * NX + (i - i0 + 1);
      V.f[kk] = P.f[k]; V.m[kk] = P.m[k]; V.t[kk] = P.t[k];
    }
    const x0 = V.ox, x1 = V.ox + NX * s, y0 = V.oy, y1 = V.oy + NY * s;
    const craters = (pb.craters || []).filter((c) => c.x > x0 && c.x < x1 && c.y > y0 && c.y < y1).map((c) => Object.assign({}, c));
    const b = makeBody(V, { x: pb.x, y: pb.y, a: pb.a, vx: pb.vx, vy: pb.vy, w: pb.w, restitution: pb.restitution, craters, world: pb.world });
    if (b) {
      b.debris = true; // løsnet fra en større stein
      b.rockType = pb.rockType;
      b.comet = pb.comet && b.area > 150;
    }
    return b;
  }

  // Små biter blir vanlige malmbiter (konvekse) som kan trekkes inn.
  function toOre(vb) {
    const pts = [];
    for (const l of vb.loops) for (const p of l) pts.push(p);
    let hull = G.convexHull(pts);
    if (hull.length < 3) return null;
    const A = G.polyArea(hull);
    if (A > RF.ORE_MAX_AREA * 0.97) {
      const k = Math.sqrt((RF.ORE_MAX_AREA * 0.97) / A);
      hull = hull.map((p) => ({ x: p.x * k, y: p.y * k }));
    }
    // Små biter blir ujevne, avrundede klumper (ikke firkanter) med samme
    // areal og omtrent samme proporsjoner som biten som løsnet.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of hull) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const asp = G.clamp(Math.sqrt((x1 - x0 + 0.1) / (y1 - y0 + 0.1)), 0.6, 1.6);
    let blob = G.rockShape(1, G.randInt(9, 12)).map((p) => ({ x: p.x * asp, y: p.y / asp }));
    const k = Math.sqrt(Math.min(G.polyArea(hull), RF.ORE_MAX_AREA * 0.97) / G.polyArea(blob));
    blob = blob.map((p) => ({ x: p.x * k, y: p.y * k }));
    hull = blob.length >= 3 ? blob : hull;
    const o = RF.makeRock(hull, vb.mat, { x: vb.x, y: vb.y, a: vb.a, vx: vb.vx, vy: vb.vy, w: vb.w });
    o.kind = 'ore';
    o.world = vb.world;
    return o;
  }

  // Små løse steiner (under RUBBLE_AREA) blir avrundede klumper i stedet for
  // grove biter av rutenettet (som ble firkantede). Laser, kanon og raketter
  // knuser dem (se Vox.hitRubble).
  function makeBlob(area, mat, o) {
    const n = G.randInt(10, 15);
    const asp = G.rand(0.7, 1.4);
    let blob = G.rockShape(1, n).map((p) => ({ x: p.x * asp, y: p.y / asp }));
    const k = Math.sqrt(area / G.polyArea(blob));
    blob = blob.map((p) => ({ x: p.x * k, y: p.y * k }));
    const b = RF.makeRock(blob, mat, o);
    b.rubble = b.kind === 'rock';
    b.debris = true;
    return b;
  }
  Vox.makeBlob = makeBlob;

  function toRubble(vb) {
    const o = makeBlob(vb.area, vb.mat, { x: vb.x, y: vb.y, a: vb.a, vx: vb.vx, vy: vb.vy, w: vb.w });
    o.world = vb.world;
    return o;
  }

  // Knus en klump i mindre biter. Mineraler blir malm, gråstein fra laseren
  // fordamper (som bitene laseren slår løs fra store steiner).
  Vox.breakRubble = (t, d, game, byLaser) => {
    if (t.dead) return [];
    t.dead = true;
    const stone = !!RF.MATERIALS[t.mat].stone;
    // Gråstein i laseren: små klumper fordamper, store deler seg i to eller tre.
    // Ellers: biter på malmstørrelse (inntil 18), resten blir mindre klumper.
    let n;
    if (byLaser && stone) n = t.area > 120 ? 2 : 0;
    else n = G.clamp(Math.ceil(t.area / (RF.ORE_MAX_AREA * 0.9)), 2, 18);
    const out = [];
    for (let i = 0; i < n; i++) {
      const area = Math.min((t.area / n) * G.rand(0.8, 1.2), t.area / n > RF.ORE_MAX_AREA ? Infinity : RF.ORE_MAX_AREA * 0.97);
      if (area < RF.DUST_AREA) continue;
      const a = (i / n) * Math.PI * 2 + G.rand(-0.4, 0.4), r = Math.sqrt(t.area) * 0.3;
      const sp = G.rand(0.6, 2.2);
      const o = makeBlob(area, t.mat, {
        x: t.x + Math.cos(a) * r, y: t.y + Math.sin(a) * r, a: Math.random() * 6.28,
        vx: t.vx + Math.cos(a) * sp - (d ? d.x : 0) * 0.5, vy: t.vy + Math.sin(a) * sp - (d ? d.y : 0) * 0.5, w: G.rand(-0.8, 0.8),
      });
      o.world = t.world;
      if (byLaser && RF.isStone(o)) continue;
      t.world.add(o);
      out.push(o);
    }
    if (game && t.world === game.sys.world) {
      const M = RF.MATERIALS[t.mat];
      game.particles.burst(t.x, t.y, 18, { type: 'smoke', sMin: 1, sMax: 6, color: M.light, zMin: 0.6, zMax: 1.6, grow: 2, lMin: 0.8, lMax: 2, vx: t.vx, vy: t.vy });
      game.particles.burst(t.x, t.y, 12, { type: 'debris', sMin: 2, sMax: 8, color: M.base, zMin: 0.2, zMax: 0.5, lMin: 0.8, lMax: 2, vx: t.vx, vy: t.vy });
      RF.Audio.thud(0.3, true);
    }
    return out;
  };

  // Løse biter av nesten bare gråstein knuses av laseren i stedet for å
  // skjæres bit for bit. Ellers vanlig skjæring (Vox.laser).
  Vox.isJunk = (t) => t.debris && !t.dead && (t.rubble ? !!RF.MATERIALS[t.mat].stone : t.vox && t.area < 600 && t.stoneFrac > 0.985);
  // drill = borehoder, som maler løs biter (Vox.laser). Laserstrålen skjærer.
  Vox.beam = (t, hit, d, power, tier, dt, game, drill) => {
    if (t.vox && !Vox.isJunk(t)) return drill ? Vox.laser(t, hit, d, power, tier, dt, game) : Vox.cut(t, hit, d, power, tier, dt, game);
    return Vox.hitRubble(t, dt * power * 0.8 * (Vox.isJunk(t) ? 3 : 1), tier, d, game, true);
  };

  // Laser, bor, kanon eller rakett mot en klump. stress = hvor mye den tåler.
  // Gir mineralet hvis det er for hardt for laseren.
  Vox.hitRubble = (t, amount, tier, d, game, byLaser) => {
    const hard = RF.MATERIALS[t.mat].hard;
    if (byLaser && tier < hard) return t.mat;
    t.stress = (t.stress || 0) + amount / Math.sqrt(hard);
    t.heat = Math.min(1, (t.heat || 0) + amount * 0.5);
    if (t.stress >= t.integrity) Vox.breakRubble(t, d, game, byLaser);
    return null;
  };

  function dust(b, game, n = 5) {
    if (!game || b.world !== game.sys.world) return;
    game.particles.burst(b.x, b.y, n, { type: 'debris', sMin: 1, sMax: 4, color: RF.MATERIALS[b.mat].light, zMin: 0.2, zMax: 0.5, lMin: 0.6, lMax: 1.4, vx: b.vx, vy: b.vy });
  }

  // Mens skjærestrålen jobber, beholder løse biter formen sin (så de passer
  // i hullet de kom fra) ned til CUT_MIN m². Mindre biter av gråstein blir
  // støv, mindre biter av mineral blir malm.
  const CUT_MIN = 10;
  let keepShape = false;
  const isStoneMat = (mat) => !!RF.MATERIALS[mat].stone;

  function finalize(nb, game) {
    if (nb.area < RF.DUST_AREA) { dust(nb, game); return null; }
    if (keepShape) {
      if (nb.area >= CUT_MIN) { nb.world.add(nb); return nb; }
      if (isStoneMat(nb.mat)) { dust(nb, game, 8); return null; }
      const o = toOre(nb);
      if (o) nb.world.add(o);
      return o;
    }
    if (nb.area <= RF.ORE_MAX_AREA) {
      const o = toOre(nb);
      if (!o) return null;
      nb.world.add(o);
      return o;
    }
    if (nb.area < RF.RUBBLE_AREA) {
      const o = toRubble(nb);
      nb.world.add(o);
      return o;
    }
    nb.world.add(nb);
    return nb;
  }

  // Legg en løs stein ut i verden, delt i sine sammenhengende biter.
  function emit(nb, game) {
    const comps = components(nb.vox);
    const out = [];
    if (comps.length === 1) {
      const o = finalize(nb, game);
      if (o) out.push(o);
      return out;
    }
    for (const c of comps) {
      const q = sub(nb, c);
      if (!q) continue;
      const o = finalize(q, game);
      if (o) out.push(o);
    }
    return out;
  }

  // Etter en endring: del av alt som ikke lenger henger sammen med resten.
  Vox.settle = (b, game) => {
    const comps = components(b.vox);
    const made = [];
    if (!comps.length) { b.dead = true; return made; }
    if (comps.length > 1) {
      comps.sort((x, y) => y.length - x.length);
      for (let c = 1; c < comps.length; c++) {
        const nb = sub(b, comps[c]);
        for (const k of comps[c]) b.vox.f[k] = 0;
        if (nb) { const o = finalize(nb, game); if (o) made.push(o); }
      }
    }
    if (!rebuild(b)) { b.dead = true; return made; }
    if (keepShape) {
      if (b.area < CUT_MIN) {
        b.dead = true;
        if (isStoneMat(b.mat)) dust(b, game, 8);
        else { const o = toOre(b); if (o) { b.world.add(o); made.push(o); } }
      }
      return made;
    }
    if (b.area <= RF.ORE_MAX_AREA) {
      b.dead = true;
      if (b.area >= RF.DUST_AREA) {
        const o = toOre(b);
        if (o) { b.world.add(o); made.push(o); }
      } else dust(b, game);
    } else if (b.area < RF.RUBBLE_AREA) {
      // Det som er igjen av steinen er så lite at det blir en rund klump.
      b.dead = true;
      const o = toRubble(b);
      b.world.add(o);
      made.push(o);
    }
    return made;
  };

  function detach(b, nodes, game) {
    if (!nodes.length) return [];
    const nb = sub(b, nodes);
    for (const k of nodes) b.vox.f[k] = 0;
    return nb ? emit(nb, game) : [];
  }

  // Nodene innenfor en ujevn sirkel rundt (cx,cy) i lokale koordinater.
  function collect(V, cx, cy, R, test) {
    const { NX, NY, s, f } = V;
    const i0 = Math.max(1, Math.floor((cx - R - V.ox) / s)), i1 = Math.min(NX - 2, Math.ceil((cx + R - V.ox) / s));
    const j0 = Math.max(1, Math.floor((cy - R - V.oy) / s)), j1 = Math.min(NY - 2, Math.ceil((cy + R - V.oy) / s));
    const out = [];
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * NX + i;
        if (f[k] <= 0.02) continue;
        const dx = V.ox + i * s - cx, dy = V.oy + j * s - cy;
        if (test(dx, dy, Math.sqrt(dx * dx + dy * dy), k)) out.push(k);
      }
    }
    return out;
  }

  function nearestSolid(V, cx, cy, R, ok) {
    let best = -1, bd = R * R;
    collect(V, cx, cy, R, (dx, dy, d, k) => {
      if (V.f[k] >= TH && (!ok || ok(k)) && d * d < bd) { bd = d * d; best = k; }
      return false;
    });
    return best;
  }

  function dirLocal(b, d) {
    const cs = Math.cos(-b.a), sn = Math.sin(-b.a);
    return { x: d.x * cs - d.y * sn, y: d.x * sn + d.y * cs };
  }

  // Mineralet der strålen treffer.
  Vox.matAt = (b, x, y, dx, dy) => {
    const V = b.vox;
    const l = b.toLocal(x + dx * V.s * 0.4, y + dy * V.s * 0.4);
    const k = nearestSolid(V, l.x, l.y, V.s * 2);
    return k >= 0 ? MATS[V.m[k]] : b.mat;
  };

  // Fyllgraden i et lokalt punkt (bilineært mellom nodene).
  Vox.sample = (V, lx, ly) => {
    const gx = (lx - V.ox) / V.s, gy = (ly - V.oy) / V.s;
    const i = Math.floor(gx), j = Math.floor(gy);
    if (i < 0 || j < 0 || i >= V.NX - 1 || j >= V.NY - 1) return 0;
    const fx = gx - i, fy = gy - j, k = j * V.NX + i, f = V.f;
    return f[k] * (1 - fx) * (1 - fy) + f[k + 1] * fx * (1 - fy) + f[k + V.NX] * (1 - fx) * fy + f[k + V.NX + 1] * fx * fy;
  };

  Vox.contains = (b, px, py) => {
    const l = b.toLocal(px, py);
    return Vox.sample(b.vox, l.x, l.y) >= TH;
  };

  function kickPieces(b, made, fn) {
    let px = 0, py = 0;
    for (const o of made) {
      const v0x = o.vx, v0y = o.vy;
      fn(o);
      px += (o.vx - v0x) * o.mass; py += (o.vy - v0y) * o.mass;
    }
    if (!b.dead && b.mass > 0) { b.vx -= px / b.mass; b.vy -= py / b.mass; }
  }

  // Gråstein som løsner i strålen fordamper: malm av gråstein og små klumper.
  const smallStone = (o) => RF.isStone(o) || (o.rubble && o.area < 60 && RF.MATERIALS[o.mat].stone);
  function vaporize(made, game) {
    return made.filter((o) => {
      if (!smallStone(o)) return true;
      o.dead = true;
      if (game && o.world === game.sys.world) game.particles.burst(o.x, o.y, 6, { type: 'smoke', sMin: 1, sMax: 4, color: RF.MATERIALS[o.mat].light, zMin: 0.5, zMax: 1, grow: 1.5, lMin: 0.6, lMax: 1.4, vx: o.vx, vy: o.vy });
      return false;
    });
  }

  // Laseren slår løs en bit der den treffer. Biten har nøyaktig formen til
  // hullet den etterlater. Mineraler som er for harde for laseren blir stående.
  Vox.chip = (b, hit, d, game, R, tier = 9) => {
    const V = b.vox;
    R = Math.max(R, V.s * 0.75);
    const hl = b.toLocal(hit.x, hit.y), dl = dirLocal(b, d);
    const cx = hl.x + dl.x * R * 0.45, cy = hl.y + dl.y * R * 0.45;
    const ph = Math.random() * 6.28, a1 = G.rand(0.1, 0.28), a2 = G.rand(0.05, 0.18);
    const soft = (k) => HARD[V.m[k]] <= tier;
    let nodes = collect(V, cx, cy, R * 1.5, (dx, dy, dist, k) => {
      if (!soft(k)) return false;
      const th = Math.atan2(dy, dx);
      return dist <= R * (1 + a1 * Math.sin(2 * th + ph) + a2 * Math.sin(3 * th + ph * 1.7));
    });
    if (!nodes.some((k) => V.f[k] >= TH)) {
      const k = nearestSolid(V, hl.x, hl.y, R * 2.2, soft);
      if (k < 0) return false;
      nodes = [k];
    }
    // Småbiter av gråstein fordamper i strålen. Bare mineraler løsner som malm.
    const made = vaporize(detach(b, nodes, game), game);
    const side = Math.random() < 0.5 ? -1 : 1;
    kickPieces(b, made, (o) => {
      const k = G.rand(1.2, 3.2), sk = G.rand(0.4, 1.6) * side;
      o.vx += -d.x * k - d.y * sk; o.vy += -d.y * k + d.x * sk;
      o.w += G.rand(-1.5, 1.5) / (1 + o.radius);
    });
    vaporize(Vox.settle(b, game), game);
    b.stress = Math.min(b.stress, (b.integrity || 1) * 0.95);
    if (game && b.world === game.sys.world) {
      const M = RF.MATERIALS[b.mat];
      const ang = Math.atan2(-d.y, -d.x);
      game.particles.burst(hit.x, hit.y, 12, { sMin: 4, sMax: 16, dir: ang, spread: 1.1, color: '#ffc070', zMin: 0.15, zMax: 0.35, lMin: 0.2, lMax: 0.6 });
      game.particles.burst(hit.x, hit.y, 14, { type: 'smoke', sMin: 1, sMax: 6, dir: ang, spread: 1.3, color: M.light, zMin: 0.8, zMax: 1.8, grow: 2.5, lMin: 1.2, lMax: 3, vx: b.vx, vy: b.vy });
      game.particles.burst(hit.x, hit.y, 10, { type: 'debris', sMin: 2, sMax: 9, dir: ang, spread: 1.2, color: M.base, zMin: 0.15, zMax: 0.4, lMin: 1, lMax: 2.5, vx: b.vx, vy: b.vy });
      RF.Audio.thud(0.16, true);
    }
    return true;
  };

  // En sprekk går fra treffpunktet inn i steinen. Går den tvers gjennom,
  // faller steinen i to deler som passer sammen. Store steiner får bare en revne.
  Vox.crack = (b, hit, d, game) => {
    const V = b.vox, s = V.s;
    const hl = b.toLocal(hit.x, hit.y), dl = dirLocal(b, d);
    const ang0 = Math.atan2(dl.y, dl.x) + G.rand(-0.35, 0.35);
    const full = b.area < 1200;
    const L = full ? b.radius * 2.6 : b.radius * G.rand(0.35, 0.8);
    const pts = [{ x: hl.x - Math.cos(ang0) * s * 2, y: hl.y - Math.sin(ang0) * s * 2 }];
    let x = pts[0].x, y = pts[0].y, ang = ang0;
    const step = s * 1.6;
    for (let t = 0; t < L; t += step) {
      ang += G.rand(-0.28, 0.28);
      ang = ang0 + G.clamp(G.wrapAngle(ang - ang0), -0.6, 0.6);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push({ x, y });
    }
    const w = s * 0.72;
    for (let n = 0; n < pts.length - 1; n++) {
      const a = pts[n], c = pts[n + 1];
      const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      const ex = c.x - a.x, ey = c.y - a.y, el = ex * ex + ey * ey || 1;
      for (const k of collect(V, mx, my, step * 0.5 + w + s, (dx, dy) => {
        const px = mx + dx - a.x, py = my + dy - a.y;
        const t = G.clamp((px * ex + py * ey) / el, 0, 1);
        return G.len(px - ex * t, py - ey * t) <= w;
      })) V.f[k] = 0;
    }
    const made = Vox.settle(b, game);
    const nl = { x: -Math.sin(ang0), y: Math.cos(ang0) };
    const wn = { x: nl.x * Math.cos(b.a) - nl.y * Math.sin(b.a), y: nl.x * Math.sin(b.a) + nl.y * Math.cos(b.a) };
    const kick = G.rand(0.5, 1.2);
    kickPieces(b, made, (o) => {
      const side = (o.x - b.x) * wn.x + (o.y - b.y) * wn.y >= 0 ? 1 : -1;
      const share = b.mass / (b.mass + o.mass);
      o.vx += wn.x * side * kick * share; o.vy += wn.y * side * kick * share;
    });
    b.stress = 0;
    if (game && b.world === game.sys.world) {
      const M = RF.MATERIALS[b.mat];
      for (const p of pts) {
        if (Math.random() > 0.5) continue;
        const wp = b.toWorld(p.x, p.y);
        game.particles.burst(wp.x, wp.y, 3, { type: 'smoke', sMin: 0.5, sMax: 3, color: M.light, zMin: 0.8, zMax: 2, grow: 2, lMin: 1, lMax: 3, vx: b.vx, vy: b.vy });
      }
      game.particles.burst(hit.x, hit.y, 24, { sMin: 5, sMax: 20, color: '#ffd08a', zMin: 0.2, zMax: 0.5, lMin: 0.3, lMax: 0.9 });
      RF.Audio.thud(0.6);
      if (made.some((o) => o.kind === 'rock')) game.msg(b.comet ? 'The comet split apart' : 'The asteroid split apart', RF.HUD_COLORS.amber);
      else if (!full) game.msg('A crack runs through the rock', RF.HUD_COLORS.amber);
    }
    return made;
  };

  // Et smell (kule eller rakett) slår ut et krater. Det som løsner blir
  // noen få biter som til sammen fyller krateret.
  Vox.blast = (b, wx, wy, R, nSeeds, game, force = 6) => {
    const V = b.vox;
    const c = b.toLocal(wx, wy);
    const ph = Math.random() * 6.28;
    let nodes = collect(V, c.x, c.y, R * 1.3, (dx, dy, dist) => dist <= R * (0.85 + 0.25 * Math.sin(3 * Math.atan2(dy, dx) + ph)));
    if (!nodes.some((k) => V.f[k] >= TH)) {
      const k = nearestSolid(V, c.x, c.y, R * 2);
      if (k < 0) return [];
      nodes = [k];
    }
    const seeds = [];
    for (let i = 0; i < nSeeds; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R;
      seeds.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, g: [] });
    }
    for (const k of nodes) {
      const x = V.ox + (k % V.NX) * V.s, y = V.oy + ((k / V.NX) | 0) * V.s;
      let best = seeds[0], bd = Infinity;
      for (const sd of seeds) { const dd = (sd.x - x) ** 2 + (sd.y - y) ** 2; if (dd < bd) { bd = dd; best = sd; } }
      best.g.push(k);
    }
    const all = [];
    for (const sd of seeds) if (sd.g.length) all.push(...detach(b, sd.g, game));
    kickPieces(b, all, (o) => {
      const dx = o.x - wx, dy = o.y - wy, l = G.len(dx, dy) || 1;
      const k = force * G.rand(0.4, 1) / Math.sqrt(1 + o.area / 4);
      o.vx += (dx / l) * k; o.vy += (dy / l) * k;
      o.w += G.rand(-2, 2) / (1 + o.radius);
    });
    all.push(...Vox.settle(b, game));
    return all;
  };

  // Laseren varmer opp og slår løs biter. Returnerer mineralet hvis det er for hardt.
  Vox.laser = (t, hit, d, power, tier, dt, game) => {
    const mat = Vox.matAt(t, hit.x, hit.y, d.x, d.y);
    const hard = RF.MATERIALS[mat].hard;
    if (tier < hard) return mat;
    t.stress += dt * power * 0.8;
    t._chip = (t._chip || 0) + (dt * power) / Math.sqrt(hard);
    if (t._chip >= 0.38) {
      t._chip = 0;
      Vox.chip(t, hit, d, game, 0.8 + 0.12 * tier, tier);
    }
    if (!t.dead && t.stress >= t.integrity) Vox.crack(t, hit, d, game);
    return null;
  };

  // Skjærestråle: strålen fordamper en smal renne der den treffer, og går
  // dypere jo lenger den holdes der. Ingen biter slås løs. En bit løsner først
  // når kuttene går helt rundt den, og den har da nøyaktig formen på hullet.
  // Gråstein blir til røyk. Mineral som skjæres bort, samles opp og kommer ut
  // som små malmbiter. Mineraler som er for harde for laseren stopper strålen.
  Vox.cut = (t, hit, d, power, tier, dt, game) => {
    const V = t.vox, s = V.s, f = V.f, m = V.m;
    const mat = Vox.matAt(t, hit.x, hit.y, d.x, d.y);
    const hard = RF.MATERIALS[mat].hard;
    if (tier < hard) return mat;
    const hl = t.toLocal(hit.x, hit.y), dl = dirLocal(t, d);
    // Rennen: fra litt foran treffpunktet og ett steg inn i steinen.
    const ax = hl.x - dl.x * s * 0.3, ay = hl.y - dl.y * s * 0.3;
    const bx = hl.x + dl.x * s * 1.1, by = hl.y + dl.y * s * 1.1;
    const w = s * 0.5, ex = bx - ax, ey = by - ay, el = ex * ex + ey * ey;
    // Fyll per sekund. Store noder (store steiner) tar lengre tid.
    const rate = (power * 3) / Math.sqrt(hard) / Math.max(0.8, s);
    let crossed = false, removed = false;
    const acc = t._cutOre || (t._cutOre = {});
    for (const k of collect(V, (ax + bx) / 2, (ay + by) / 2, s * 0.8 + w, () => true)) {
      const hk = HARD[m[k]];
      if (hk > tier) continue;
      const px = V.ox + (k % V.NX) * s - ax, py = V.oy + ((k / V.NX) | 0) * s - ay;
      const u = G.clamp((px * ex + py * ey) / el, 0, 1);
      const dist = G.len(px - ex * u, py - ey * u);
      if (dist > w) continue;
      const take = Math.min(f[k], (rate * dt * (1 - (0.5 * dist) / w)) / Math.sqrt(hk));
      if (take <= 0) continue;
      const was = f[k];
      f[k] -= take;
      removed = true;
      if (was >= TH && f[k] < TH) crossed = true;
      const mk = MATS[m[k]];
      if (!RF.MATERIALS[mk].stone) acc[mk] = (acc[mk] || 0) + take * s * s;
    }
    if (!removed) {
      // Ingenting igjen i rennen her: grip nærmeste faste node litt lenger inn.
      const k = nearestSolid(V, bx, by, s * 2, (q) => HARD[m[q]] <= tier);
      if (k >= 0) { f[k] = Math.max(0, f[k] - rate * dt); if (f[k] < TH) crossed = true; }
    }
    t.heat = Math.min(1, (t.heat || 0) + dt * 3);
    t._cutT = (t._cutT || 0) + dt;
    t._cutDirty = t._cutDirty || crossed || removed;
    // Bygg omriss og kollisjon på nytt av og til mens det skjæres.
    if (t._cutDirty && (crossed || t._cutT > 0.12)) {
      t._cutT = 0; t._cutDirty = false;
      keepShape = true;
      let made;
      try { made = Vox.settle(t, game); } finally { keepShape = false; }
      // Løse biter glir bare litt fra hverandre, de passer fortsatt sammen.
      kickPieces(t, made.filter((o) => o.vox), (o) => {
        const dx = o.x - t.x, dy = o.y - t.y, l = G.len(dx, dy) || 1;
        o.vx += (dx / l) * 0.15; o.vy += (dy / l) * 0.15;
      });
      if (made.some((o) => o.vox) && game && t.world === game.sys.world) {
        RF.Audio.thud(0.25, true);
        game.msg('A piece has been cut loose', RF.HUD_COLORS.ok);
      }
    }
    // Mineral som er skåret bort, kommer ut som små malmbiter.
    for (const mk in acc) {
      if (acc[mk] < 3 || t.dead) continue;
      const area = Math.min(acc[mk], RF.ORE_MAX_AREA * 0.9);
      acc[mk] -= area;
      const shape = G.rockShape(Math.sqrt(area / Math.PI), G.randInt(7, 10));
      const k = Math.sqrt(area / Math.max(0.01, Math.abs(G.polyArea(shape))));
      const o = RF.makeRock(shape.map((p) => ({ x: p.x * k, y: p.y * k })), mk, {
        x: hit.x - d.x * 1.2, y: hit.y - d.y * 1.2, a: Math.random() * 6.28,
        vx: t.vx - d.x * G.rand(0.8, 1.8) + G.rand(-0.5, 0.5), vy: t.vy - d.y * G.rand(0.8, 1.8) + G.rand(-0.5, 0.5), w: G.rand(-1, 1),
      });
      o.kind = 'ore';
      o.world = t.world;
      t.world.add(o);
    }
    if (game && t.world === game.sys.world && Math.random() < dt * 14) {
      const M = RF.MATERIALS[mat];
      const ang = Math.atan2(-d.y, -d.x);
      game.particles.burst(hit.x, hit.y, 3, { sMin: 4, sMax: 14, dir: ang, spread: 0.9, color: '#ffc070', zMin: 0.15, zMax: 0.3, lMin: 0.15, lMax: 0.45 });
      game.particles.burst(hit.x, hit.y, 1, { type: 'smoke', sMin: 1, sMax: 4, dir: ang, spread: 1, color: M.light, zMin: 0.6, zMax: 1.4, grow: 2, lMin: 0.8, lMax: 2, vx: t.vx, vy: t.vy });
    }
    return null;
  };

  // --- Lag nye steiner ---

  function sdConvex(poly, x, y) {
    // Positiv inni, negativ utenfor (tilnærmet utenfor, godt nok her).
    let d = Infinity;
    for (let i = 0, n = poly.length; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const ex = b.x - a.x, ey = b.y - a.y, l = G.len(ex, ey) || 1;
      const nx = ey / l, ny = -ex / l;
      const s = nx * (a.x - x) + ny * (a.y - y);
      if (s < d) d = s;
    }
    return d;
  }

  function carve(V, cx, cy, R) {
    const { NX, NY, s, f } = V;
    const i0 = Math.max(1, Math.floor((cx - R - s - V.ox) / s)), i1 = Math.min(NX - 2, Math.ceil((cx + R + s - V.ox) / s));
    const j0 = Math.max(1, Math.floor((cy - R - s - V.oy) / s)), j1 = Math.min(NY - 2, Math.ceil((cy + R + s - V.oy) / s));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const k = j * NX + i;
        const d = G.len(V.ox + i * s - cx, V.oy + j * s - cy);
        const v = G.clamp(0.5 + (d - R) / s, 0, 1);
        if (v < f[k]) f[k] = v;
      }
    }
  }

  function paint(V, test, mi) {
    const { NX, NY, s } = V;
    for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) {
      if (test(V.ox + i * s, V.oy + j * s)) V.m[j * NX + i] = mi;
    }
  }

  // type: nøkkel i RF.ROCK_TYPES. opts: { lumpy, cave, comet }
  Vox.generate = (world, type, r, o, opts = {}) => {
    const T = RF.ROCK_TYPES[type];
    const seed = (Math.random() * 1e6) | 0;
    const s = G.clamp(r / 24, 0.7, 3.2);
    const crystal = RF.MATERIALS[T.mat].crystal;
    const base = opts.lumpy ? G.rockShape(r, G.randInt(12, 16)) : G.shardShape(r, crystal);
    const shapes = [{ v: base, x: 0, y: 0 }];
    const nl = opts.lumpy ? G.randInt(1, 3) : G.randInt(0, 2);
    for (let i = 0; i < nl; i++) {
      const a = Math.random() * 6.28, dd = r * G.rand(0.35, 0.6), rr = r * G.rand(0.35, 0.6);
      shapes.push({ v: opts.lumpy ? G.rockShape(rr, 10) : G.shardShape(rr, crystal), x: Math.cos(a) * dd, y: Math.sin(a) * dd });
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const sh of shapes) for (const p of sh.v) {
      x0 = Math.min(x0, p.x + sh.x); x1 = Math.max(x1, p.x + sh.x);
      y0 = Math.min(y0, p.y + sh.y); y1 = Math.max(y1, p.y + sh.y);
    }
    const pad = s * 2 + r * 0.12;
    x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const NX = Math.ceil((x1 - x0) / s) + 1, NY = Math.ceil((y1 - y0) / s) + 1;
    const V = grid(NX, NY, s, x0, y0);
    V.m.fill(MI[T.mat]);
    const rough = r * (opts.lumpy ? 0.16 : 0.09), sc = 1 / Math.max(3, r * 0.35);
    for (let j = 1; j < NY - 1; j++) {
      for (let i = 1; i < NX - 1; i++) {
        const x = x0 + i * s, y = y0 + j * s;
        let sd = -Infinity;
        for (const sh of shapes) sd = Math.max(sd, sdConvex(sh.v, x - sh.x, y - sh.y));
        sd += (fbm(x * sc, y * sc, seed) - 0.5) * 2 * rough;
        const k = j * NX + i;
        V.f[k] = G.clamp(0.5 + sd / s, 0, 1);
        // Tone: store flekker og finkornet struktur.
        const tn = fbm(x / 3.2, y / 3.2, seed + 7, 3) * 0.75 + hash(i, j, seed) * 0.25;
        V.t[k] = G.clamp(Math.round(tn * 255), 0, 255);
      }
    }
    // Innslag av andre mineraler: klumper og årer.
    for (const mat in T.blobs || {}) {
      const n = Math.max(1, Math.round(T.blobs[mat] * 22 * G.rand(0.6, 1.4)));
      for (let q = 0; q < n; q++) {
        const a = Math.random() * 6.28, dd = Math.sqrt(Math.random()) * r * 0.85;
        const bx = Math.cos(a) * dd, by = Math.sin(a) * dd, br = r * G.rand(0.1, 0.24), sd2 = seed + q * 31;
        paint(V, (x, y) => G.len(x - bx, y - by) < br * (0.7 + 0.6 * fbm(x / br * 2, y / br * 2, sd2)), MI[mat]);
      }
    }
    for (const mat in T.veins || {}) {
      const n = Math.max(1, Math.round(T.veins[mat] * 30 * G.rand(0.6, 1.4)));
      const w = Math.max(s * 0.7, r * 0.045);
      for (let q = 0; q < n; q++) {
        let x = G.rand(-r, r) * 0.7, y = G.rand(-r, r) * 0.7, a = Math.random() * 6.28;
        const segs = [];
        for (let k = 0; k < 6; k++) {
          const nx = x + Math.cos(a) * r * 0.2, ny = y + Math.sin(a) * r * 0.2;
          segs.push([x, y, nx, ny]);
          x = nx; y = ny; a += G.rand(-0.8, 0.8);
        }
        paint(V, (px, py) => segs.some(([ax, ay, bx, by]) => {
          const ex = bx - ax, ey = by - ay, t = G.clamp(((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey), 0, 1);
          return G.len(px - ax - ex * t, py - ay - ey * t) < w;
        }), MI[mat]);
      }
    }
    if (T.core) {
      const cm = G.weighted(T.core);
      const cr = r * Math.sqrt(T.coreFrac);
      paint(V, (x, y) => G.len(x, y) < cr * (0.8 + 0.4 * fbm(x / cr * 1.5, y / cr * 1.5, seed + 3)), MI[cm]);
    }
    // Kratre som gir innhakk i kanten.
    const nEdge = G.randInt(1, 2 + Math.floor(r / 12));
    for (let q = 0; q < nEdge; q++) {
      const a = Math.random() * 6.28, d = r * G.rand(0.85, 1.05);
      carve(V, Math.cos(a) * d, Math.sin(a) * d, r * G.rand(0.12, 0.28));
    }
    // Naturlig hule i store steiner: en tunnel inn til et kammer.
    if (opts.cave) {
      let a = Math.random() * 6.28;
      let x = Math.cos(a) * r * 1.2, y = Math.sin(a) * r * 1.2;
      let dir = a + Math.PI + G.rand(-0.3, 0.3);
      const tw = G.rand(11, 13.5), len = r * G.rand(0.9, 1.25);
      for (let t = 0; t < len; t += 3) {
        carve(V, x, y, tw);
        dir += G.rand(-0.18, 0.18);
        x += Math.cos(dir) * 3; y += Math.sin(dir) * 3;
      }
      carve(V, x, y, tw * G.rand(1.3, 1.7));
    }
    // Kratre i overflaten (tegnes som groper).
    const craters = [];
    const nc = opts.comet ? G.randInt(5, 9) : G.randInt(Math.min(2, Math.floor(r / 8)), Math.min(8, 1 + Math.floor(r / 6)));
    for (let q = 0; q < nc; q++) {
      const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r * 0.7;
      craters.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: r * G.rand(0.04, opts.comet ? 0.14 : 0.12), e: G.rand(0.6, 1), rot: Math.random() * 3 });
    }
    // Hold kanten av rutenettet tom.
    for (let i = 0; i < NX; i++) { V.f[i] = 0; V.f[(NY - 1) * NX + i] = 0; }
    for (let j = 0; j < NY; j++) { V.f[j * NX] = 0; V.f[j * NX + NX - 1] = 0; }
    const b = makeBody(V, Object.assign({}, o, { craters, world, restitution: T.mat === 'is' ? 0.12 : 0.22 }));
    if (!b) return null;
    // Fjern løse småbiter som støyen kan lage i kanten.
    const comps = components(V);
    if (comps.length > 1) {
      comps.sort((p, q) => q.length - p.length);
      for (let c = 1; c < comps.length; c++) for (const k of comps[c]) V.f[k] = 0;
      rebuild(b);
    }
    b.rockType = type;
    b.comet = !!opts.comet;
    b.cave = !!opts.cave;
    world.add(b);
    return b;
  };
})();
