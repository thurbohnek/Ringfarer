// Stiv-legeme-fysikk for konvekse polygoner: SAT-kollisjon med
// kontaktpunkt-klipping, sekvensielle impulser med restitusjon og friksjon,
// og posisjonskorreksjon. Kraft påføres utenfra som impuls (F*dt) før step().
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  let nextId = 1;

  class Body {
    constructor(verts, density, o = {}) {
      this.id = nextId++;
      this.x = o.x || 0;
      this.y = o.y || 0;
      this.a = o.a || 0;
      this.vx = o.vx || 0;
      this.vy = o.vy || 0;
      this.w = o.w || 0;
      this.restitution = o.restitution != null ? o.restitution : 0.25;
      this.friction = o.friction != null ? o.friction : 0.5;
      this.kind = o.kind || 'rock';
      this.density = density;
      this.isStatic = !(density > 0);
      this.dead = false;
      // Målestokk: lokale koordinater ganges med s i verden. Store skip
      // tegnes og regnes i sine egne ruter, men er s ganger større.
      this.s = 1;
      this.wv = [];
      this.wn = [];
      this.setShape(verts);
    }

    // verts er i kroppens lokale koordinater. Flytter origo til tyngdepunktet
    // uten at noe hopper i verden, og regner ut masse og treghetsmoment.
    setShape(verts) {
      if (G.polyArea(verts) < 0) verts = verts.slice().reverse();
      const c = G.polyCentroid(verts);
      const cs = Math.cos(this.a), sn = Math.sin(this.a);
      const ox = c.x * cs - c.y * sn, oy = c.x * sn + c.y * cs;
      this.x += ox;
      this.y += oy;
      this.vx += -this.w * oy;
      this.vy += this.w * ox;
      this.verts = verts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
      this.area = G.polyArea(this.verts);
      this.radius = G.polyRadius(this.verts);
      this.normals = [];
      for (let i = 0, n = this.verts.length; i < n; i++) {
        const a = this.verts[i], b = this.verts[(i + 1) % n];
        const ex = b.x - a.x, ey = b.y - a.y;
        const l = G.len(ex, ey) || 1;
        this.normals.push({ x: ey / l, y: -ex / l });
      }
      if (this.isStatic) {
        this.mass = Infinity; this.invMass = 0; this.I = Infinity; this.invI = 0;
      } else {
        this.mass = this.area * this.density;
        this.I = G.polyInertia(this.verts) * this.density;
        this.invMass = 1 / this.mass;
        this.invI = 1 / this.I;
      }
      this.baseMass = this.mass;
      this.baseI = this.I;
      return { x: c.x, y: c.y };
    }

    // For legemer satt sammen av moduler (skip): verts er allerede relative
    // til tyngdepunktet, og masse og treghetsmoment er regnet ut på forhånd.
    setRaw(verts, mass, I, s = 1) {
      if (G.polyArea(verts) < 0) verts = verts.slice().reverse();
      this.s = s;
      this.verts = verts.map((p) => ({ x: p.x, y: p.y }));
      this.area = G.polyArea(this.verts) * s * s;
      this.radius = G.polyRadius(this.verts) * s;
      this.normals = [];
      for (let i = 0, n = this.verts.length; i < n; i++) {
        const a = this.verts[i], b = this.verts[(i + 1) % n];
        const ex = b.x - a.x, ey = b.y - a.y;
        const l = G.len(ex, ey) || 1;
        this.normals.push({ x: ey / l, y: -ex / l });
      }
      this.wv = [];
      this.wn = [];
      this.isStatic = false;
      this.mass = this.baseMass = mass;
      this.I = this.baseI = I;
      this.invMass = 1 / mass;
      this.invI = 1 / I;
    }

    // Flytt origo til lokalpunktet (lx,ly) uten at noe flytter seg i verden.
    shiftOrigin(lx, ly) {
      lx *= this.s; ly *= this.s;
      const cs = Math.cos(this.a), sn = Math.sin(this.a);
      const ox = lx * cs - ly * sn, oy = lx * sn + ly * cs;
      this.x += ox;
      this.y += oy;
      this.vx += -this.w * oy;
      this.vy += this.w * ox;
    }

    // Brukes av skipet når last og drivstoff endrer massen.
    setMass(m) {
      if (this.isStatic) return;
      this.I = this.baseI * (m / this.baseMass);
      this.mass = m;
      this.invMass = 1 / m;
      this.invI = 1 / this.I;
    }

    updateWorld() {
      const cs = Math.cos(this.a), sn = Math.sin(this.a);
      const n = this.verts.length;
      if (this.wv.length !== n) {
        this.wv = this.verts.map(() => ({ x: 0, y: 0 }));
        this.wn = this.verts.map(() => ({ x: 0, y: 0 }));
      }
      for (let i = 0; i < n; i++) {
        const p = this.verts[i], q = this.normals[i], s = this.s;
        this.wv[i].x = this.x + (p.x * cs - p.y * sn) * s;
        this.wv[i].y = this.y + (p.x * sn + p.y * cs) * s;
        this.wn[i].x = q.x * cs - q.y * sn;
        this.wn[i].y = q.x * sn + q.y * cs;
      }
    }

    toWorld(lx, ly) {
      const cs = Math.cos(this.a), sn = Math.sin(this.a), s = this.s;
      return { x: this.x + (lx * cs - ly * sn) * s, y: this.y + (lx * sn + ly * cs) * s };
    }

    toLocal(px, py) {
      const cs = Math.cos(this.a), sn = Math.sin(this.a);
      const dx = (px - this.x) / this.s, dy = (py - this.y) / this.s;
      return { x: dx * cs + dy * sn, y: -dx * sn + dy * cs };
    }

    // Retning i lokale akser -> verden (uten translasjon).
    dirWorld(lx, ly) {
      const cs = Math.cos(this.a), sn = Math.sin(this.a);
      return { x: lx * cs - ly * sn, y: lx * sn + ly * cs };
    }

    pointVel(px, py) {
      return { x: this.vx - this.w * (py - this.y), y: this.vy + this.w * (px - this.x) };
    }

    applyImpulse(jx, jy, px, py) {
      if (this.isStatic) return;
      this.vx += jx * this.invMass;
      this.vy += jy * this.invMass;
      this.w += this.invI * ((px - this.x) * jy - (py - this.y) * jx);
    }

    applyForce(fx, fy, px, py, dt) {
      this.applyImpulse(fx * dt, fy * dt, px, py);
    }

    containsPoint(px, py) {
      if (this.vox) return RF.Vox.contains(this, px, py);
      const l = this.toLocal(px, py);
      for (let i = 0; i < this.verts.length; i++) {
        const v = this.verts[i], n = this.normals[i];
        if ((l.x - v.x) * n.x + (l.y - v.y) * n.y > 0) return false;
      }
      return true;
    }
  }

  // --- Kollisjon (SAT + klipping, som i Box2D Lite) ---

  function maxSeparation(A, B) {
    let best = -Infinity, bi = 0;
    for (let i = 0; i < A.wv.length; i++) {
      const n = A.wn[i], v = A.wv[i];
      let si = Infinity;
      for (let j = 0; j < B.wv.length; j++) {
        const d = n.x * (B.wv[j].x - v.x) + n.y * (B.wv[j].y - v.y);
        if (d < si) si = d;
      }
      if (si > best) { best = si; bi = i; }
    }
    return [best, bi];
  }

  function clipSegment(pts, nx, ny, off) {
    const out = [];
    const d0 = nx * pts[0].x + ny * pts[0].y - off;
    const d1 = nx * pts[1].x + ny * pts[1].y - off;
    if (d0 <= 0) out.push(pts[0]);
    if (d1 <= 0) out.push(pts[1]);
    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      out.push({ x: pts[0].x + (pts[1].x - pts[0].x) * t, y: pts[0].y + (pts[1].y - pts[0].y) * t });
    }
    return out;
  }

  function collide(A, B) {
    const [sepA, eA] = maxSeparation(A, B);
    if (sepA > 0) return null;
    const [sepB, eB] = maxSeparation(B, A);
    if (sepB > 0) return null;

    let ref, inc, ri, flip;
    if (sepB > sepA * 0.95 + 0.01) { ref = B; inc = A; ri = eB; flip = true; }
    else { ref = A; inc = B; ri = eA; flip = false; }

    const n = ref.wn[ri];
    let ii = 0, md = Infinity;
    for (let i = 0; i < inc.wn.length; i++) {
      const d = n.x * inc.wn[i].x + n.y * inc.wn[i].y;
      if (d < md) { md = d; ii = i; }
    }
    const i2 = (ii + 1) % inc.wv.length;
    let seg = [{ x: inc.wv[ii].x, y: inc.wv[ii].y }, { x: inc.wv[i2].x, y: inc.wv[i2].y }];

    const v1 = ref.wv[ri], v2 = ref.wv[(ri + 1) % ref.wv.length];
    let tx = v2.x - v1.x, ty = v2.y - v1.y;
    const tl = G.len(tx, ty) || 1;
    tx /= tl; ty /= tl;

    seg = clipSegment(seg, -tx, -ty, -(tx * v1.x + ty * v1.y));
    if (seg.length < 2) return null;
    seg = clipSegment(seg, tx, ty, tx * v2.x + ty * v2.y);
    if (seg.length < 2) return null;

    const points = [];
    for (const p of seg) {
      const s = n.x * (p.x - v1.x) + n.y * (p.y - v1.y);
      if (s <= 0) points.push({ x: p.x - n.x * s * 0.5, y: p.y - n.y * s * 0.5, depth: -s });
    }
    if (!points.length) return null;
    return { A, B, nx: flip ? -n.x : n.x, ny: flip ? -n.y : n.y, points };
  }

  // Legemer satt sammen av mange konvekse biter (steiner av voksler).
  function partWorld(b, p, stamp) {
    if (p.stamp === stamp) return p;
    p.stamp = stamp;
    const cs = Math.cos(b.a), sn = Math.sin(b.a);
    for (let i = 0; i < p.verts.length; i++) {
      const v = p.verts[i], q = p.normals[i];
      p.wv[i].x = b.x + v.x * cs - v.y * sn;
      p.wv[i].y = b.y + v.x * sn + v.y * cs;
      p.wn[i].x = q.x * cs - q.y * sn;
      p.wn[i].y = q.x * sn + q.y * cs;
    }
    p.x = b.x + p.cx * cs - p.cy * sn;
    p.y = b.y + p.cx * sn + p.cy * cs;
    return p;
  }

  // Rutenett over bitene til et sammensatt legeme (i dets egne koordinater),
  // så vi bare ser på bitene i nærheten. Lages på nytt når bitene endres.
  function partGrid(A) {
    const g = A._pgrid;
    if (g && g.parts === A.parts) return g;
    let maxR = 0, x0 = Infinity, y0 = Infinity;
    for (const p of A.parts) { if (p.r > maxR) maxR = p.r; if (p.cx < x0) x0 = p.cx; if (p.cy < y0) y0 = p.cy; }
    const cs = Math.max(1.5, maxR * 2), cells = new Map();
    for (const p of A.parts) {
      const k = Math.floor((p.cx - x0) / cs) * 65536 + Math.floor((p.cy - y0) / cs);
      let c = cells.get(k);
      if (!c) cells.set(k, (c = []));
      c.push(p);
    }
    return (A._pgrid = { parts: A.parts, x0, y0, cs, maxR, cells });
  }

  // Bitene av A som kan røre B.
  function nearShapes(A, B, stamp) {
    if (!A.parts) return [A];
    const l = A.toLocal(B.x, B.y);
    const out = [];
    const test = (p) => {
      const dx = p.cx - l.x, dy = p.cy - l.y, rr = p.r + B.radius;
      if (dx * dx + dy * dy <= rr * rr) out.push(p);
    };
    if (A.parts.length < 24) for (const p of A.parts) test(p);
    else {
      const g = partGrid(A), R = B.radius + g.maxR;
      const i0 = Math.floor((l.x - R - g.x0) / g.cs), i1 = Math.floor((l.x + R - g.x0) / g.cs);
      const j0 = Math.floor((l.y - R - g.y0) / g.cs), j1 = Math.floor((l.y + R - g.y0) / g.cs);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > A.parts.length) for (const p of A.parts) test(p);
      else for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const c = g.cells.get(i * 65536 + j);
        if (c) for (const p of c) test(p);
      }
    }
    // To store sammensatte legemer: sjekk mot det konvekse omrisset til B.
    if (B.parts && out.length > 24) {
      const cs = Math.cos(A.a), sn = Math.sin(A.a);
      const keep = [];
      for (const p of out) {
        const wx = A.x + p.cx * cs - p.cy * sn, wy = A.y + p.cx * sn + p.cy * cs;
        const q = B.toLocal(wx, wy);
        let sep = -Infinity;
        for (let i = 0; i < B.verts.length; i++) {
          const v = B.verts[i], n = B.normals[i];
          sep = Math.max(sep, n.x * (q.x - v.x) + n.y * (q.y - v.y));
        }
        if (sep <= p.r) keep.push(p);
      }
      out.length = 0;
      out.push(...keep);
    }
    for (const p of out) partWorld(A, p, stamp);
    return out;
  }

  function collideCompound(A, B, stamp, out) {
    const sa = nearShapes(A, B, stamp);
    if (!sa.length) return;
    const sb = nearShapes(B, A, stamp);
    const pair = { n: 0 };
    for (const x of sa) {
      for (const y of sb) {
        const rr = x.radius + y.radius, dx = y.x - x.x, dy = y.y - x.y;
        if (dx * dx + dy * dy > rr * rr) continue;
        const c = collide(x, y);
        if (!c) continue;
        c.A = A; c.B = B; c.pair = pair;
        out.push(c);
      }
    }
  }

  class World {
    constructor() {
      this.bodies = [];
      this.contacts = [];
      this.iterations = 8;
      this.ropes = []; // { A, la, B, lb, length } — trekker bare, som en kabel
      this.onImpact = null; // (contact, J, vn0) => void
      this.shouldCollide = null; // (A, B) => bool
      // (A, B) => 0 | 1 | 2: 1 = A skyves ikke av B, 2 = B skyves ikke av A.
      // Brukes så små malmbiter kan treffe skipet uten å flytte det.
      this.oneWay = null;
      this.stamp = 0;
    }

    add(b) { this.bodies.push(b); return b; }

    remove(b) { b.dead = true; }

    step(dt) {
      const bodies = this.bodies;
      this.stamp++;
      for (const b of bodies) b.updateWorld();

      // Bred fase: sorter og feie langs x (nesten sortert fra forrige steg).
      for (let i = 1; i < bodies.length; i++) {
        const b = bodies[i], k = b.x - b.radius;
        let j = i - 1;
        while (j >= 0 && bodies[j].x - bodies[j].radius > k) { bodies[j + 1] = bodies[j]; j--; }
        bodies[j + 1] = b;
      }
      const contacts = (this.contacts = []);
      for (let i = 0; i < bodies.length; i++) {
        const A = bodies[i];
        if (A.dead || A.ghost) continue;
        const maxX = A.x + A.radius;
        for (let j = i + 1; j < bodies.length; j++) {
          const B = bodies[j];
          if (B.x - B.radius > maxX) break;
          if (B.dead || B.ghost || (A.isStatic && B.isStatic)) continue;
          const rr = A.radius + B.radius;
          const dx = B.x - A.x, dy = B.y - A.y;
          if (dx * dx + dy * dy > rr * rr) continue;
          if (this.shouldCollide && !this.shouldCollide(A, B)) continue;
          if (A.parts || B.parts) { collideCompound(A, B, this.stamp, contacts); continue; }
          const c = collide(A, B);
          if (c) contacts.push(c);
        }
      }

      // Forbered kontakter.
      for (const c of contacts) {
        const { A, B, nx, ny } = c;
        const tx = -ny, ty = nx;
        const e = (A.restitution + B.restitution) * 0.5;
        const mu = Math.sqrt(A.friction * B.friction);
        c.mu = mu;
        c.vn0 = 0;
        const ow = this.oneWay ? this.oneWay(A, B) : 0;
        c.imA = ow === 1 ? 0 : A.invMass; c.iiA = ow === 1 ? 0 : A.invI;
        c.imB = ow === 2 ? 0 : B.invMass; c.iiB = ow === 2 ? 0 : B.invI;
        for (const p of c.points) {
          p.rAx = p.x - A.x; p.rAy = p.y - A.y;
          p.rBx = p.x - B.x; p.rBy = p.y - B.y;
          const rnA = p.rAx * ny - p.rAy * nx, rnB = p.rBx * ny - p.rBy * nx;
          const rtA = p.rAx * ty - p.rAy * tx, rtB = p.rBx * ty - p.rBy * tx;
          p.mN = 1 / (c.imA + c.imB + c.iiA * rnA * rnA + c.iiB * rnB * rnB);
          p.mT = 1 / (c.imA + c.imB + c.iiA * rtA * rtA + c.iiB * rtB * rtB);
          const dvx = B.vx - B.w * p.rBy - A.vx + A.w * p.rAy;
          const dvy = B.vy + B.w * p.rBx - A.vy - A.w * p.rAx;
          const vn = dvx * nx + dvy * ny;
          p.bias = vn < -0.6 ? -e * vn : 0;
          p.jn = 0; p.jt = 0;
          if (vn < c.vn0) c.vn0 = vn;
        }
      }

      // Kabler (ankeret): forbered.
      this.ropes = this.ropes.filter((r) => !r.A.dead && !r.B.dead);
      for (const r of this.ropes) {
        const pa = r.A.toWorld(r.la.x, r.la.y), pb = r.B.toWorld(r.lb.x, r.lb.y);
        const dx = pb.x - pa.x, dy = pb.y - pa.y;
        const dist = G.len(dx, dy) || 1e-6;
        r.dist = dist;
        r.active = dist > r.length;
        r.jn = 0;
        if (!r.active) continue;
        r.nx = dx / dist; r.ny = dy / dist;
        r.rAx = pa.x - r.A.x; r.rAy = pa.y - r.A.y;
        r.rBx = pb.x - r.B.x; r.rBy = pb.y - r.B.y;
        const rnA = r.rAx * r.ny - r.rAy * r.nx, rnB = r.rBx * r.ny - r.rBy * r.nx;
        r.mN = 1 / (r.A.invMass + r.B.invMass + r.A.invI * rnA * rnA + r.B.invI * rnB * rnB);
        r.bias = (0.15 * (dist - r.length)) / dt;
      }

      // Sekvensielle impulser.
      for (let it = 0; it < this.iterations; it++) {
        for (const r of this.ropes) {
          if (!r.active) continue;
          const { A, B, nx, ny } = r;
          const dvx = B.vx - B.w * r.rBy - A.vx + A.w * r.rAy;
          const dvy = B.vy + B.w * r.rBx - A.vy - A.w * r.rAx;
          const vn = dvx * nx + dvy * ny;
          let dj = r.mN * (-vn - r.bias);
          const j0 = r.jn;
          r.jn = Math.min(j0 + dj, 0);
          dj = r.jn - j0;
          const Px = dj * nx, Py = dj * ny;
          A.vx -= Px * A.invMass; A.vy -= Py * A.invMass;
          A.w -= A.invI * (r.rAx * Py - r.rAy * Px);
          B.vx += Px * B.invMass; B.vy += Py * B.invMass;
          B.w += B.invI * (r.rBx * Py - r.rBy * Px);
        }
        for (const c of contacts) {
          const { A, B, nx, ny } = c;
          const tx = -ny, ty = nx;
          for (const p of c.points) {
            let dvx = B.vx - B.w * p.rBy - A.vx + A.w * p.rAy;
            let dvy = B.vy + B.w * p.rBx - A.vy - A.w * p.rAx;
            const vn = dvx * nx + dvy * ny;
            let dj = p.mN * (-vn + p.bias);
            const j0 = p.jn;
            p.jn = Math.max(j0 + dj, 0);
            dj = p.jn - j0;
            let Px = dj * nx, Py = dj * ny;
            A.vx -= Px * c.imA; A.vy -= Py * c.imA;
            A.w -= c.iiA * (p.rAx * Py - p.rAy * Px);
            B.vx += Px * c.imB; B.vy += Py * c.imB;
            B.w += c.iiB * (p.rBx * Py - p.rBy * Px);

            dvx = B.vx - B.w * p.rBy - A.vx + A.w * p.rAy;
            dvy = B.vy + B.w * p.rBx - A.vy - A.w * p.rAx;
            const vt = dvx * tx + dvy * ty;
            let djt = p.mT * -vt;
            const maxF = c.mu * p.jn;
            const t0 = p.jt;
            p.jt = G.clamp(t0 + djt, -maxF, maxF);
            djt = p.jt - t0;
            Px = djt * tx; Py = djt * ty;
            A.vx -= Px * c.imA; A.vy -= Py * c.imA;
            A.w -= c.iiA * (p.rAx * Py - p.rAy * Px);
            B.vx += Px * c.imB; B.vy += Py * c.imB;
            B.w += c.iiB * (p.rBx * Py - p.rBy * Px);
          }
        }
      }

      if (this.onImpact) {
        // Kontakter mellom de samme to legemene regnes som ett støt.
        const seen = new Set();
        for (const c of contacts) {
          let J = 0;
          for (const p of c.points) J += p.jn;
          if (c.pair) {
            if (seen.has(c.pair)) continue;
            seen.add(c.pair);
            let best = c, bj = J, vn0 = c.vn0;
            J = 0;
            for (const d of contacts) {
              if (d.pair !== c.pair) continue;
              let j = 0;
              for (const p of d.points) j += p.jn;
              J += j;
              if (j > bj) { bj = j; best = d; }
              if (d.vn0 < vn0) vn0 = d.vn0;
            }
            if (J > 0) this.onImpact(best, J, vn0);
            continue;
          }
          if (J > 0) this.onImpact(c, J, c.vn0);
        }
      }

      // Posisjonskorreksjon mot inntrengning. Mange kontakter mellom de samme
      // to legemene deler på korreksjonen så de ikke skyves for langt.
      for (const c of contacts) if (c.pair) c.pair.n++;
      for (const c of contacts) {
        const { A, B, nx, ny } = c;
        const im = c.imA + c.imB;
        if (im <= 0) continue;
        let depth = 0;
        for (const p of c.points) depth = Math.max(depth, p.depth);
        const share = c.pair ? 1 / Math.sqrt(c.pair.n) : 1;
        const corr = (Math.max(depth - 0.03, 0) * 0.45 * share) / im;
        A.x -= nx * corr * c.imA; A.y -= ny * corr * c.imA;
        B.x += nx * corr * c.imB; B.y += ny * corr * c.imB;
      }

      // Integrer posisjon.
      for (const b of bodies) {
        if (b.isStatic) continue;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.a += b.w * dt;
      }

      if (bodies.some((b) => b.dead)) this.bodies = bodies.filter((b) => !b.dead);
    }

    // Stråle fra (ox,oy) i retning (dx,dy) (normalisert). Returnerer nærmeste treff.
    raycast(ox, oy, dx, dy, maxLen, filter) {
      let best = null;
      for (const b of this.bodies) {
        if (b.dead || (filter && !filter(b))) continue;
        const cx = b.x - ox, cy = b.y - oy;
        const along = cx * dx + cy * dy;
        if (along < -b.radius || along > maxLen + b.radius) continue;
        const perp = Math.abs(cx * dy - cy * dx);
        if (perp > b.radius) continue;
        if (b.parts) {
          const h = rayParts(b, ox, oy, dx, dy, maxLen);
          if (h && (!best || h.t < best.t)) best = h;
          continue;
        }
        b.updateWorld();
        let tIn = 0, tOut = maxLen, ni = -1;
        let miss = false;
        for (let i = 0; i < b.wv.length; i++) {
          const n = b.wn[i], v = b.wv[i];
          const denom = n.x * dx + n.y * dy;
          const num = n.x * (v.x - ox) + n.y * (v.y - oy);
          if (Math.abs(denom) < 1e-9) {
            if (num < 0) { miss = true; break; }
            continue;
          }
          const t = num / denom;
          if (denom < 0) { if (t > tIn) { tIn = t; ni = i; } }
          else if (t < tOut) tOut = t;
          if (tIn > tOut) { miss = true; break; }
        }
        if (miss || ni < 0) continue;
        if (!best || tIn < best.t) {
          best = { body: b, t: tIn, x: ox + dx * tIn, y: oy + dy * tIn, nx: b.wn[ni].x, ny: b.wn[ni].y };
        }
      }
      return best;
    }
  }

  // Stråle mot et sammensatt legeme, i legemets egne koordinater.
  function rayParts(b, ox, oy, dx, dy, maxLen) {
    const o = b.toLocal(ox, oy);
    const cs = Math.cos(-b.a), sn = Math.sin(-b.a);
    const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
    let best = null;
    for (const p of b.parts) {
      const cx = p.cx - o.x, cy = p.cy - o.y;
      const along = cx * lx + cy * ly;
      if (along < -p.r || along > maxLen + p.r) continue;
      if (Math.abs(cx * ly - cy * lx) > p.r) continue;
      let tIn = 0, tOut = maxLen, ni = -1, miss = false;
      for (let i = 0; i < p.verts.length; i++) {
        const n = p.normals[i], v = p.verts[i];
        const denom = n.x * lx + n.y * ly;
        const num = n.x * (v.x - o.x) + n.y * (v.y - o.y);
        if (Math.abs(denom) < 1e-9) { if (num < 0) { miss = true; break; } continue; }
        const t = num / denom;
        if (denom < 0) { if (t > tIn) { tIn = t; ni = i; } }
        else if (t < tOut) tOut = t;
        if (tIn > tOut) { miss = true; break; }
      }
      if (miss || ni < 0) continue;
      if (!best || tIn < best.t) best = { t: tIn, n: p.normals[ni] };
    }
    if (!best) return null;
    const wn = b.dirWorld(best.n.x, best.n.y);
    return { body: b, t: best.t, x: ox + dx * best.t, y: oy + dy * best.t, nx: wn.x, ny: wn.y };
  }

  RF.Body = Body;
  RF.PhysicsWorld = World;
})();
