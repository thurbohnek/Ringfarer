// Datastyrte skip. De flyr med samme fysikk som spilleren: skyvekraft,
// dreiemoment og treghet, ingen snarveier.
//   - Gruvedroner borer i asteroider, henter malmbitene og leverer dem
//     gjennom lasteporten bak på stasjonen.
//   - Frakteskip går mellom stasjonen og porten, ringer opp andre systemer
//     og reiser gjennom. Senere kommer de tilbake gjennom porten.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  RF.NPC_TYPES = {
    drone: { name: 'Mining drone', mass: 11000, thrust: 190e3, torque: 0.55e6, hull: 60, maxSpeed: 16 },
    hauler: { name: 'Freighter', mass: 70000, thrust: 820e3, torque: 7e6, hull: 180, maxSpeed: 28 },
    // Spillerens egne droner.
    helper: { name: 'Mining drone', mass: 5000, thrust: 110e3, torque: 0.35e6, hull: 40, maxSpeed: 20, own: true },
    repair: { name: 'Repair drone', mass: 4500, thrust: 110e3, torque: 0.35e6, hull: 40, maxSpeed: 22, own: true },
    // Spillerens droner i tre størrelser. scale = hvor mye mindre de tegnes
    // og er enn et vanlig skip bygget av de samme modulene.
    mite: { name: 'Mite', mass: 1500, thrust: 60e3, torque: 0.05e6, hull: 30, maxSpeed: 22, own: true, scale: 0.34, laser: { power: 0.6, tier: 1 }, cargo: 2500 },
    mender: { name: 'Mender', mass: 1500, thrust: 60e3, torque: 0.05e6, hull: 30, maxSpeed: 24, own: true, scale: 0.34 },
    gleaner: { name: 'Gleaner', mass: 1800, thrust: 70e3, torque: 0.06e6, hull: 35, maxSpeed: 24, own: true, scale: 0.34, cargo: 3000 },
    burrower: { name: 'Burrower', mass: 5000, thrust: 170e3, torque: 0.3e6, hull: 80, maxSpeed: 20, own: true, scale: 0.48, laser: { power: 1.4, tier: 2 }, cargo: 6000 },
    picket: { name: 'Picket', mass: 4000, thrust: 190e3, torque: 0.3e6, hull: 100, maxSpeed: 34, own: true, scale: 0.48 },
    tern: { name: 'Tern', mass: 4500, thrust: 170e3, torque: 0.3e6, hull: 70, maxSpeed: 30, own: true, scale: 0.48 },
    porter: { name: 'Porter', mass: 12000, thrust: 360e3, torque: 1.1e6, hull: 150, maxSpeed: 28, own: true, scale: 0.62 },
    ferryman: { name: 'Ferryman', mass: 13000, thrust: 380e3, torque: 1.2e6, hull: 150, maxSpeed: 28, own: true, scale: 0.62 },
  };

  // Lasteporten ligger bak antennemasten, på motsatt side av dokkingsarmen.
  // Skipene går inn og ut langs antenneaksen: først til et ytre punkt, så sakte inn.
  RF.hangarPoint = (st, dist = 95) => {
    const cs = Math.cos(st.a), sn = Math.sin(st.a);
    return { x: st.x - dist * cs, y: st.y - dist * sn };
  };
  const STATION_CLEAR = 135; // radius rundt stasjonen som skipene ruter utenom

  let nextName = 1;
  const d0 = (n, P) => G.len(P.outer.x - n.body.x, P.outer.y - n.body.y);

  class NPC {
    constructor(type, sys) {
      this.type = type;
      this.T = RF.NPC_TYPES[type];
      this.sys = sys;
      this.name = `${this.T.name} ${String(nextName++).padStart(2, '0')}`;
      this.layout = RF.layoutFrom(RF.NPC_LAYOUTS[type]);
      const g = RF.layoutGeometry(this.layout);
      // Droner er mindre utgaver: form, treghet og tegning skaleres.
      const sc = (this.scale = this.T.scale || 0);
      const k = sc || 1;
      this.body = new RF.Body(G.box(-1, -1, 1, 1), 1, { kind: 'npc', restitution: 0.18, friction: 0.45 });
      this.body.setRaw(g.verts.map((p) => ({ x: p.x * k, y: p.y * k })), this.T.mass, g.I * (this.T.mass / g.mass) * k * k);
      this.body.npc = this;
      this.k = this.body.radius / 8; // størrelse i forhold til spillerens første skip
      this.noseX = (this.layout.reduce((a, m) => Math.max(a, m.lx), 0) + RF.CELL / 2) * k;
      const lm = this.layout.find((m) => m.t === 'laser' || m.t === 'laser2');
      this.laserY = lm ? lm.ly * k : 0;
      this.halfW = (this.layout.reduce((a, m) => Math.max(a, Math.abs(m.ly)), 0) + RF.CELL / 2) * k;
      this._lights = RF.lightSources(this).map((l) => Object.assign(l, { lx: l.lx * k, ly: l.ly * k }));
      this.beams = [];
      this.fx = { main: 0, retro: 0, left: 0, right: 0, rotL: 0, rotR: 0 };
      this.laser = { on: false, hit: null, len: 0 };
      this.scars = [];
      this.shieldFlash = 0;
      this.blinkOff = Math.random();
      this.hull = this.T.hull;
      this.cargo = 0;
      this.active = false;
      this.state = 'hangar';
      this.timer = G.rand(3, 25);
      this.target = null;
      this.chipT = 0;
    }

    spawnAt(x, y, a, vx = 0, vy = 0) {
      const b = this.body;
      b.x = x; b.y = y; b.a = a; b.vx = vx; b.vy = vy; b.w = 0;
      b.dead = false;
      this.sys.world.add(b);
      this.active = true;
    }

    despawn() {
      this.active = false;
      this.laser.on = false;
      // Merk som død også, i tilfelle vi er midt i et fysikksteg.
      this.body.dead = true;
      const ws = this.sys.world;
      ws.bodies = ws.bodies.filter((o) => o !== this.body);
    }

    // Autopilot: fly til (tx,ty) og kom fram med målets fart (tvx,tvy).
    // Med face satt peker nesen dit, og sidedyser og bremsemotor tar resten.
    // Hvis rett linje til målet går gjennom stasjonen, fly via et punkt på siden.
    routeAround(tx, ty) {
      const b = this.body, st = this.sys.station, R = STATION_CLEAR + 10 * this.k;
      const dsx = b.x - st.x, dsy = b.y - st.y;
      const ex = tx - b.x, ey = ty - b.y, el = ex * ex + ey * ey || 1;
      const t = G.clamp(-(dsx * ex + dsy * ey) / el, 0, 1);
      const cx = dsx + ex * t, cy = dsy + ey * t;
      const cd = G.len(cx, cy), dr = G.len(dsx, dsy), tr = G.len(tx - st.x, ty - st.y);
      // Ruten går utenom sonen, eller bare streifer den der den starter eller slutter.
      if (cd >= R || (cd >= R * 0.75 && (dr < R || tr < R))) return { x: tx, y: ty };
      if (dr < R - 5) {
        // Innenfor sonen og linjen går inn i stasjonen: rett ut igjen, litt mot målets side.
        const ux = dsx / (dr || 1), uy = dsy / (dr || 1);
        const side = ux * ey - uy * ex > 0 ? 1 : -1;
        return { x: st.x + (ux - uy * side * 0.6) * (R + 40), y: st.y + (uy + ux * side * 0.6) * (R + 40) };
      }
      const nx = cd > 1 ? cx / cd : -ey / Math.sqrt(el), ny = cd > 1 ? cy / cd : ex / Math.sqrt(el);
      return { x: st.x + nx * (R + 45), y: st.y + ny * (R + 45) };
    }

    steer(dt, tx, ty, tvx = 0, tvy = 0, face = null, maxSpeed = this.T.maxSpeed) {
      const b = this.body, T = this.T;
      if (!this.docking) {
        const w = this.routeAround(tx, ty);
        if (w.x !== tx || w.y !== ty) { tx = w.x; ty = w.y; tvx = 0; tvy = 0; face = null; maxSpeed = Math.min(maxSpeed, 20); }
      }
      let dx = tx - b.x, dy = ty - b.y;
      const dist = G.len(dx, dy);
      const acc = T.thrust / b.mass;
      const sp = Math.min(maxSpeed, Math.sqrt(2 * acc * 0.45 * Math.max(0, dist - 1)));
      let ux = dist > 0.01 ? dx / dist : 0, uy = dist > 0.01 ? dy / dist : 0;

      // Unnamanøver: tre stråler (midt og begge sider av skroget) langs ønsket kurs.
      let sp2 = sp;
      const look = Math.min(dist, 30 + G.len(b.vx, b.vy) * 4);
      if (look > 5) {
        const half = 5 * this.k;
        let hit = null;
        for (const off of [0, -half, half]) {
          const ox = b.x + ux * 10 * this.k - uy * off, oy = b.y + uy * 10 * this.k + ux * off;
          const h = this.sys.world.raycast(ox, oy, ux, uy, look,
            (o) => o !== b && o.kind !== 'ore' && o !== this.target && o.radius > 2 && !(this.owner && o === this.owner.body) && !(o.npc && o.npc.owner));
          if (h && (!hit || h.t < hit.t)) hit = h;
        }
        if (hit) {
          const o = hit.body;
          const side = (o.x - b.x) * uy - (o.y - b.y) * ux > 0 ? 1 : -1;
          const k = G.clamp(1 - hit.t / look, 0.3, 1);
          const c = Math.cos(k * 1.3), s2 = Math.sin(k * 1.3) * side;
          const nx = ux * c + uy * s2, ny = uy * c - ux * s2;
          ux = nx; uy = ny;
          sp2 = Math.min(sp, 4 + hit.t * 0.25);
        }
      }

      const dvx = tvx + ux * sp2 - b.vx, dvy = tvy + uy * sp2 - b.vy;
      const dvm = G.len(dvx, dvy);
      const heading = face != null ? face : dvm > 0.4 ? Math.atan2(dvy, dvx) : b.a;
      const err = G.wrapAngle(heading - b.a);
      const targetW = G.clamp(err * 2.2, -1.4, 1.4);
      const torque = G.clamp((targetW - b.w) * b.I * 5, -T.torque, T.torque);
      b.w += torque * b.invI * dt;

      const fwd = b.dirWorld(1, 0), right = b.dirWorld(0, 1);
      const want = Math.min(1, (dvm * b.mass) / (T.thrust * 0.6));
      let main = 0, retro = 0, strafe = 0;
      const af = (dvx * fwd.x + dvy * fwd.y) / (dvm || 1), ar = (dvx * right.x + dvy * right.y) / (dvm || 1);
      if (face == null) {
        if (Math.cos(err) > 0.9) main = want;
        strafe = G.clamp(ar * want * 2, -1, 1);
      } else {
        if (af > 0) main = af * want; else retro = -af * want;
        strafe = G.clamp(ar * want * 2, -1, 1);
      }
      const F = main * T.thrust - retro * T.thrust * 0.4;
      const Fs = strafe * T.thrust * 0.3;
      b.vx += ((fwd.x * F + right.x * Fs) / b.mass) * dt;
      b.vy += ((fwd.y * F + right.y * Fs) / b.mass) * dt;
      const fx = this.fx;
      fx.main = G.lerp(fx.main, main, 0.2);
      fx.retro = G.lerp(fx.retro, retro, 0.2);
      fx.left = G.lerp(fx.left, strafe < 0 ? -strafe : 0, 0.2);
      fx.right = G.lerp(fx.right, strafe > 0 ? strafe : 0, 0.2);
      fx.rotL = G.lerp(fx.rotL, torque < 0 ? -torque / T.torque : 0, 0.2);
      fx.rotR = G.lerp(fx.rotR, torque > 0 ? torque / T.torque : 0, 0.2);
      return dist;
    }

    update(dt, game) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2);
      if (this.T.own && !this.active) { this.updateOwnHidden(dt, game); return; }
      if (!this.active) {
        this.timer -= dt;
        if (this.timer <= 0 && this.state === 'hangar') this.leaveHangar();
        if (this.timer <= 0 && this.state === 'away' && game.npcArrival(this)) this.state = 'arriving';
        return;
      }
      this.laser.on = false;
      this.laser.hit = null;
      this.beams = [];
      if (this.T.own) { this.updateOwn(dt, game); this.setBeam(); return; }
      const st = this.sys.station;
      this.docking = this.state === 'undock' || this.state === 'dockIn';
      if (this.state === 'undock') {
        const o = RF.hangarPoint(st, 160);
        const d = this.steer(dt, o.x, o.y, 0, 0, st.a + Math.PI, 6);
        if (d < 12) { this.state = this.type === 'drone' ? 'seek' : 'toGate'; this.timer = 0; }
        return;
      }
      if (this.state === 'return') {
        const o = RF.hangarPoint(st, 160);
        const d = this.steer(dt, o.x, o.y, 0, 0, null, this.T.maxSpeed);
        if (d < 14 && G.len(this.body.vx, this.body.vy) < 3) this.state = 'dockIn';
        return;
      }
      if (this.state === 'dockIn') {
        const h = RF.hangarPoint(st);
        const d = this.steer(dt, h.x, h.y, 0, 0, st.a, 4);
        if (d < 5) this.enterHangar(this.type === 'drone' ? 18 : G.rand(25, 45));
        return;
      }
      if (this.type === 'drone') this.updateDrone(dt, game);
      else this.updateHauler(dt, game);
      this.setBeam();
    }

    setBeam() {
      if (this.laser.on) this.beams = [{ lx: this.noseX, ly: this.laserY, len: Math.max(0, this.laser.len), hit: this.laser.hit, color: this.beamColor || '255,150,60', w: 0.35 }];
    }

    // Bor i steinen t med en enkel laser. Returnerer true hvis den traff.
    drill(t, dt, game) {
      const b = this.body, ws = this.sys.world;
      const nose = b.toWorld(this.noseX, this.laserY), dir = b.dirWorld(1, 0);
      const hit = ws.raycast(nose.x, nose.y, dir.x, dir.y, 80, (o) => o !== b && o.kind !== 'npc' && o.kind !== 'ship' && o.kind !== 'ore');
      this.laser.on = true;
      this.laser.len = hit ? hit.t : 80;
      if (!hit || hit.body !== t) return false;
      this.laser.hit = hit;
      t.heat = Math.min(1, (t.heat || 0) + dt * 2);
      t.hitX = hit.x; t.hitY = hit.y;
      if (game.sys === this.sys && Math.random() < 0.4) game.laserDust(hit);
      const L = this.T.laser || { power: 0.6, tier: 1 };
      if (t.vox) RF.Vox.laser(t, hit, dir, L.power * (this.owner ? this.owner.stats.droneMul || 1 : 1), L.tier, dt, game);
      return true;
    }

    // ---------------- Spillerens droner ----------------
    // Luken eller klemmen dronen bor i: punkt inne i skipet, åpningen utenfor,
    // og retningen ut. Alt i verdenskoordinater.
    dockPose() {
      const ob = this.owner.body, m = this.dockM, L = this.owner.s.layout;
      let dir = this.dockKind === 'clamp' ? (m.cdir >= 0 ? m.cdir : 3) : RF.clampDir(L, m);
      if (dir < 0) dir = m.ly >= 0 ? 1 : 3; // luke i dekket: løft ut mot nærmeste side
      const a = RF.DIR_ANGLE[dir], cx = Math.cos(a), cy = Math.sin(a);
      const C = RF.CELL;
      let inner, outer;
      if (this.dockKind === 'clamp') {
        const S = ob.s;
        const off = C / 2 + (this.halfW + 0.2) / S;
        inner = { x: m.lx + cx * off, y: m.ly + cy * off };
        outer = { x: inner.x + (cx * 7) / S, y: inner.y + (cy * 7) / S };
      } else {
        inner = { x: m.lx, y: m.ly };
        const clear = Math.max(C * 1.2, this.distToEdge(m, cx, cy)) + (this.body.radius + 3) / ob.s;
        outer = { x: m.lx + cx * clear, y: m.ly + cy * clear };
      }
      const wi = ob.toWorld(inner.x, inner.y), wo = ob.toWorld(outer.x, outer.y);
      return { inner: wi, outer: wo, out: ob.dirWorld(cx, cy), outA: ob.a + a, dockA: this.dockKind === 'clamp' ? ob.a : ob.a + a + Math.PI };
    }

    // Hvor langt det er fra modulen til kanten av skroget i retningen ut.
    distToEdge(m, cx, cy) {
      const occ = new Set(this.owner.s.layout.map((o) => o.x + ',' + o.y));
      let n = 0;
      while (n < 20 && occ.has(m.x + Math.round(cx) * (n + 1) + ',' + (m.y + Math.round(cy) * (n + 1)))) n++;
      return (n + 0.5) * RF.CELL;
    }

    recall() {
      if (this.state === 'prelaunch') { this.game && this.game.droneHome(this); this.state = 'home'; return; }
      if (this.state === 'inStation') return; // kommer når den er ferdig på stasjonen
      if (this.state !== 'enter') this.state = 'recall';
    }

    // Last som dronen har med seg når den kommer hjem (eller blir borte).
    returnLoad(game, lost) {
      const owner = this.owner;
      if (!owner) return;
      if (!lost) for (const c of this.load || []) owner.processing.push(c);
      this.load = [];
      this.cargo = 0;
      if (this.goods) {
        // Varer som ikke ble solgt, går tilbake i lasterommet.
        if (!lost) for (const k in this.goods) owner.s.cargo[k] = (owner.s.cargo[k] || 0) + this.goods[k];
        this.goods = null;
      }
      for (const x of this.carry || []) {
        if (x.dir === 'drop') { if (!lost) x.m.aboard += x.k; }
        else if (!lost) x.m.aboard += x.k; // hentet folk går om bord
        else x.m.wait += x.k;
      }
      this.carry = [];
      owner.updateMass();
    }

    // Dronen er inne i skipet (venter på luken) eller inne på stasjonen.
    updateOwnHidden(dt, game) {
      this.game = game;
      this.timer -= dt;
      if (this.state === 'prelaunch') {
        game.holdDoor(this.dockM);
        const m = this.dockM;
        if (this.timer > 0 || (this.dockKind !== 'clamp' && (m.door || 0) < 0.9)) return;
        const P = this.dockPose(), ob = this.owner.body;
        const a = this.dockKind === 'clamp' ? ob.a : P.outA;
        const v = ob.pointVel(P.inner.x, P.inner.y);
        this.spawnAt(P.inner.x, P.inner.y, a, v.x, v.y);
        this.body.w = ob.w;
        this.state = 'launch';
        this.timer = 0;
        if (this.dockKind === 'clamp') RF.Audio.blip(240, 0.08, 'square', 0.06);
        return;
      }
      if (this.state === 'inStation') {
        if (this.timer > 0) return;
        this.atStation(game);
        const st = this.sys.station, h = RF.hangarPoint(st), out = st.a + Math.PI;
        this.spawnAt(h.x, h.y, out, Math.cos(out) * 1.5, Math.sin(out) * 1.5);
        this.state = 'leaveStation';
      }
    }

    // Spillerens droner: ut av luken, jobben sin, og inn igjen.
    updateOwn(dt, game) {
      this.game = game;
      const b = this.body, owner = this.owner, ob = owner.body;
      this.timer += dt;
      this.docking = false;
      if (this.state === 'launch') {
        const P = this.dockPose();
        game.holdDoor(this.dockM);
        this.docking = true;
        const v = ob.pointVel(P.outer.x, P.outer.y);
        const d = this.steer(dt, P.outer.x, P.outer.y, v.x, v.y, this.dockKind === 'clamp' ? ob.a : P.outA, 6);
        if (d < 1.5 || this.timer > 8) { this.state = 'work'; this.timer = 0; this.startWork(game); }
        return;
      }
      if (this.state === 'recall') {
        const P = this.dockPose();
        const v = ob.pointVel(P.outer.x, P.outer.y);
        const d = this.steer(dt, P.outer.x, P.outer.y, v.x, v.y, d0(this, P) < 25 ? P.dockA : null, 30);
        if (d < 2.5 && G.len(b.vx - v.x, b.vy - v.y) < 2) { this.state = 'enter'; this.timer = 0; }
        return;
      }
      if (this.state === 'enter') {
        const P = this.dockPose();
        game.holdDoor(this.dockM);
        this.docking = true;
        const v = ob.pointVel(P.inner.x, P.inner.y);
        // Inn gjennom åpningen: først rett mot luken, så sakte inn.
        const doorOpen = this.dockKind === 'clamp' || (this.dockM.door || 0) > 0.9;
        const tgt = doorOpen ? P.inner : P.outer;
        const dd = G.len(tgt.x - this.body.x, tgt.y - this.body.y);
        const d = this.steer(dt, tgt.x, tgt.y, v.x, v.y, P.dockA, doorOpen ? (dd > 5 ? 7 : 2.5) : 4);
        if (doorOpen && d < 1.4 && G.len(b.vx - v.x, b.vy - v.y) < 1.2) {
          if (this.dockKind === 'clamp') RF.Audio.blip(200, 0.1, 'square', 0.07);
          game.droneHome(this);
        }
        if (this.timer > 25) game.droneHome(this);
        return;
      }
      if (this.state === 'toStation' || this.state === 'intoStation' || this.state === 'leaveStation') { this.stationRun(dt, game); return; }
      if (this.state === 'toShip') { this.shipRun(dt, game); return; }
      const R = this.role;
      if (R === 'repair') this.doRepair(dt, game);
      else if (R === 'mine') this.doMine(dt, game, true);
      else if (R === 'collect') this.doMine(dt, game, false);
      else if (R === 'guard') this.doGuard(dt, game);
      else this.recall();
    }

    // Oppgaver som bestemmes idet dronen er ute av luken.
    startWork(game) {
      const owner = this.owner, s = owner.s;
      if (this.role === 'cargo') {
        // Tar med de mest verdifulle varene, opp til det dronen rommer.
        let room = this.spec.hold;
        this.goods = {};
        const prods = Object.keys(s.cargo).filter((k) => s.cargo[k] > 0.01).sort((a, b) => RF.PRODUCTS[b].price - RF.PRODUCTS[a].price);
        let tot = 0;
        for (const k of prods) {
          const t = Math.min(s.cargo[k], room);
          if (t <= 0.01) continue;
          this.goods[k] = t; s.cargo[k] -= t; room -= t; tot += t;
        }
        owner.updateMass();
        if (tot <= 0.01) { this.goods = null; game.msg(`${this.name}: nothing in the hold to sell`, RF.HUD_COLORS.amber); this.recall(); return; }
        game.msg(`${this.name} is taking ${tot.toFixed(1)} t to ${this.sys.station.name}`, RF.HUD_COLORS.gate);
        this.state = 'toStation';
        return;
      }
      if (this.role === 'pax') {
        const st = this.sys.station, cap = this.spec.pax;
        const act = game.missions.filter((m) => m.status === 'aktiv');
        // Til stasjonen: folk som skal av her, og folk som venter her.
        this.carry = [];
        let left = cap;
        for (const m of act) {
          if (m.type !== 'pax' || m.to !== st.id || m.aboard <= 0 || left <= 0) continue;
          const k = Math.min(m.aboard, left);
          m.aboard -= k; left -= k;
          this.carry.push({ m, k, dir: 'drop' });
        }
        const busy = (m) => this.sys.npcs.some((n) => n !== this && n.owner && n.claim === m);
        const pick = act.find((m) => m.type === 'pax' && m.from === st.id && m.wait > 0 && !busy(m));
        const waiting = !!pick && game.paxFree() > 0;
        if (waiting) this.claim = pick;
        if (this.carry.length || waiting) {
          const n = this.carry.reduce((a, x) => a + x.k, 0);
          game.msg(`${this.name} is flying ${n ? n + ' passengers' : 'out'} to ${st.name}${waiting ? ' to pick up passengers' : ''}`, RF.HUD_COLORS.gate);
          this.state = 'toStation';
          return;
        }
        // Ut til et frakteskip med nytt mannskap.
        for (const m of act) {
          if (m.type !== 'crew' || m.aboard <= 0 || busy(m)) continue;
          const tgt = this.sys.npcs.find((n) => n.type === 'hauler' && n.name === m.ship && n.active);
          if (!tgt) continue;
          const k = Math.min(m.aboard, cap);
          m.aboard -= k;
          this.carry = [{ m, k, dir: 'drop' }];
          this.claim = m;
          this.targetShip = tgt;
          this.state = 'toShip';
          this.timer = 0;
          game.msg(`${this.name} is taking ${k} crew to the ${m.ship}`, RF.HUD_COLORS.gate);
          return;
        }
        const crewWait = act.find((m) => m.type === 'crew' && m.aboard > 0);
        game.msg(crewWait ? `The ${crewWait.ship} is not in this system right now` : `${this.name}: nobody to fly anywhere right now`, RF.HUD_COLORS.amber);
        this.recall();
      }
    }

    // Tur til stasjonen i systemet: inn gjennom lasteporten og ut igjen.
    stationRun(dt, game) {
      const st = this.sys.station;
      if (this.state === 'toStation') {
        const o = RF.hangarPoint(st, 160);
        const d = this.steer(dt, o.x, o.y, 0, 0, null, this.T.maxSpeed);
        if (d < 14 && G.len(this.body.vx, this.body.vy) < 3) this.state = 'intoStation';
        return;
      }
      if (this.state === 'intoStation') {
        this.docking = true;
        const h = RF.hangarPoint(st);
        const d = this.steer(dt, h.x, h.y, 0, 0, st.a, 4);
        if (d < 5) { this.despawn(); this.state = 'inStation'; this.timer = 3; }
        return;
      }
      // Ut av lasteporten, så hjem.
      this.docking = true;
      const o = RF.hangarPoint(st, 160);
      const d = this.steer(dt, o.x, o.y, 0, 0, st.a + Math.PI, 6);
      if (d < 12) this.state = 'recall';
    }

    // Det som skjer inne på stasjonen: selge varer, slippe av og ta med folk.
    atStation(game) {
      const st = this.sys.station;
      if (this.goods) {
        let sum = 0, t = 0;
        for (const k in this.goods) { sum += game.sellPrice(st.id, k) * this.goods[k]; t += this.goods[k]; }
        sum = Math.round(sum);
        game.credits += sum;
        game.msg(`${this.name} sold ${t.toFixed(1)} t at ${st.name} for ${sum.toLocaleString('en-US')} cr`, RF.HUD_COLORS.ok);
        this.goods = null;
      }
      if (this.role === 'pax') {
        const drops = (this.carry || []).filter((x) => x.dir === 'drop');
        if (drops.length) game.dropPax(st.id, drops, 'Shuttle delivered');
        const picks = game.pickPax(st.id, this.spec.pax, false);
        this.carry = picks.map((x) => ({ m: x.m, k: x.k, dir: 'pick' }));
        const n = picks.reduce((a, x) => a + x.k, 0);
        if (n) game.msg(`${this.name} picked up ${n} passenger${n > 1 ? 's' : ''}`, RF.HUD_COLORS.gate);
      }
    }

    // Skyttel ut til et annet skip: legg seg inntil, vent litt, og fly hjem.
    shipRun(dt, game) {
      const t = this.targetShip, b = this.body;
      if (!t || !t.active) { game.msg(`The ${this.carry[0] ? this.carry[0].m.ship : 'ship'} left before the shuttle got there`, RF.HUD_COLORS.amber); this.recall(); return; }
      const tb = t.body;
      const side = tb.toWorld(0, (tb.radius + this.body.radius + 4) * (this.index % 2 ? 1 : -1));
      const d = this.steer(dt, side.x, side.y, tb.vx, tb.vy, null, this.T.maxSpeed);
      const close = d < 4 && G.len(b.vx - tb.vx, b.vy - tb.vy) < 2;
      this.hold = close ? (this.hold || 0) + dt : 0;
      if (this.hold > 2) {
        game.dropPax(null, this.carry, 'Crew transferred');
        this.carry = [];
        this.hold = 0;
        this.recall();
      }
      if (this.timer > 120) this.recall();
    }

    doRepair(dt, game) {
      const b = this.body, owner = this.owner, ob = owner.body;
      const m = owner.mostDamaged();
      if (!m) { this.idleNear(dt); return; }
      const mp = ob.toWorld(m.lx, m.ly);
      const side = ob.toWorld(m.lx, m.ly + (m.ly >= 0 ? 5 : -5));
      const face = Math.atan2(mp.y - b.y, mp.x - b.x);
      const v = ob.pointVel(side.x, side.y);
      const d = this.steer(dt, side.x, side.y, v.x, v.y, face, 15);
      if (d < 4) {
        const D = RF.MODULES[m.t];
        m.hp = Math.min(D.hp, m.hp + 6 * dt * (owner.stats.droneMul || 1));
        this.laser.on = true;
        this.laser.len = G.len(mp.x - b.x, mp.y - b.y) - this.noseX;
        this.laser.hit = null;
        this.beamColor = '120,255,160';
        if (Math.random() < 0.3) game.particles.burst(mp.x, mp.y, 2, { type: 'glow', sMin: 1, sMax: 4, color: '#9dffb0', zMin: 0.1, zMax: 0.25, lMin: 0.2, lMax: 0.5, vx: ob.vx, vy: ob.vy });
        if (Math.random() < 0.05) owner.refreshStats();
      }
    }

    // Venter på sin plass ved siden av skipet.
    idleNear(dt) {
      const ob = this.owner.body;
      const p = ob.toWorld(-this.owner.noseX * 0.3, (ob.radius + 8 + this.index * 4) * (this.index % 2 ? 1 : -1));
      const v = ob.pointVel(p.x, p.y);
      return this.steer(dt, p.x, p.y, v.x, v.y, null, 30);
    }

    // Gruvedrone (bor og samler) eller innsamler (bare samler løs malm).
    doMine(dt, game, drills) {
      const b = this.body, owner = this.owner, ob = owner.body, ws = this.sys.world;
      const cap = this.T.cargo || 3000;
      if (this.sub === 'deliver' || this.cargo >= cap) {
        this.sub = 'deliver';
        const p = ob.toWorld(-owner.noseX - 6, 0);
        const v = ob.pointVel(p.x, p.y);
        const d = this.steer(dt, p.x, p.y, v.x, v.y, null, 30);
        if (d < ob.radius * 0.5 + 10) {
          for (const c of this.load || []) owner.processing.push(c);
          if (this.cargo > 0) game.msg(`${this.name} delivered ${(this.cargo / 1000).toFixed(1)} t of ore`, RF.HUD_COLORS.ok);
          owner.updateMass();
          this.load = []; this.cargo = 0; this.sub = 'seek';
        }
        return;
      }
      // Samle løse malmbiter i nærheten først.
      let ore = null, bd = drills ? 90 : 260;
      for (const o of ws.bodies) {
        if (o.kind !== 'ore' || o.dead || G.len(o.x - ob.x, o.y - ob.y) > 320) continue;
        const d = G.len(o.x - b.x, o.y - b.y);
        if (d < bd) { bd = d; ore = o; }
      }
      if (ore && (!drills || this.sub !== 'mine' || this.timer > 6)) {
        const face = Math.atan2(ore.y - b.y, ore.x - b.x);
        this.steer(dt, ore.x - Math.cos(face) * 3, ore.y - Math.sin(face) * 3, ore.vx, ore.vy, bd < 25 ? face : null, 14);
        const nose = b.toWorld(this.noseX + 0.5, 0);
        if (G.len(ore.x - nose.x, ore.y - nose.y) < 2.5 + Math.sqrt(ore.area)) {
          ore.dead = true;
          this.cargo += ore.mass;
          (this.load = this.load || []).push({ mat: ore.mat, mass: ore.mass });
        }
        return;
      }
      if (!drills) {
        if (this.cargo > 0 && this.timer > 5) this.sub = 'deliver';
        this.idleNear(dt);
        return;
      }
      const tier = this.T.laser ? this.T.laser.tier : 1;
      if (this.sub !== 'mine' || !this.target || this.target.dead) {
        const near = ws.bodies.filter((o) => o.kind === 'rock' && RF.MATERIALS[o.mat].hard <= tier && o.area < 2500 && G.len(o.x - ob.x, o.y - ob.y) < 300);
        near.sort((p, q) => G.len(p.x - b.x, p.y - b.y) - G.len(q.x - b.x, q.y - b.y));
        this.target = near[0] || null;
        this.sub = this.target ? 'mine' : 'idle';
        this.timer = 0;
      }
      if (this.sub === 'idle') { this.idleNear(dt); if (this.timer > 3) this.sub = 'seek'; return; }
      const t = this.target;
      const dx = b.x - t.x, dy = b.y - t.y, d = G.len(dx, dy) || 1;
      const stand = t.radius + 8;
      const face = Math.atan2(t.y - b.y, t.x - b.x);
      this.steer(dt, t.x + (dx / d) * stand, t.y + (dy / d) * stand, t.vx, t.vy, d < stand + 30 ? face : null, 16);
      if (d < stand + 10 && Math.abs(G.wrapAngle(face - b.a)) < 0.25) this.drill(t, dt, game);
      if (this.timer > 12) { this.timer = 0; this.sub = 'seek'; }
    }

    // Vaktdrone: ligger foran skipet og brenner småstein og vrakbiter som er
    // på vei mot det.
    doGuard(dt, game) {
      const b = this.body, owner = this.owner, ob = owner.body, ws = this.sys.world;
      this.gT = (this.gT || 0) - dt;
      if (this.gT <= 0) {
        this.gT = 0.25;
        let best = null, bt = 8;
        for (const o of ws.bodies) {
          if (o.dead || o.ghost || !(o.kind === 'rock' && o.radius < 6) && !(o.kind === 'wreck')) continue;
          const rx = o.x - ob.x, ry = o.y - ob.y;
          if (rx * rx + ry * ry > 170 * 170) continue;
          const ux = o.vx - ob.vx, uy = o.vy - ob.vy, uu = ux * ux + uy * uy;
          const rv = rx * ux + ry * uy;
          if (rv >= 0 || uu < 0.25) continue;
          const t = -rv / uu;
          if (t > bt) continue;
          const miss = G.len(rx + ux * t, ry + uy * t);
          if (miss < ob.radius + o.radius + 4) { bt = t; best = o; }
        }
        this.threat = best;
      }
      const v = G.len(ob.vx, ob.vy);
      const dir = v > 2 ? Math.atan2(ob.vy, ob.vx) : ob.a;
      const R = ob.radius + 14;
      const sd = (this.index % 2 ? 1 : -1) * 0.55;
      const post = { x: ob.x + Math.cos(dir + sd) * R, y: ob.y + Math.sin(dir + sd) * R };
      const t = this.threat;
      if (!t || t.dead) { this.steer(dt, post.x, post.y, ob.vx, ob.vy, dir, 36); return; }
      const face = Math.atan2(t.y - b.y, t.x - b.x);
      this.steer(dt, post.x, post.y, ob.vx, ob.vy, face, 36);
      const dist = G.len(t.x - b.x, t.y - b.y);
      if (dist < 130 && Math.abs(G.wrapAngle(face - b.a)) < 0.3) {
        this.laser.on = true;
        this.laser.len = dist - this.noseX;
        this.laser.hit = { x: t.x, y: t.y };
        this.beamColor = '255,90,80';
        t.heat = Math.min(1, (t.heat || 0) + dt * 2.5);
        if (t.heat >= 0.8) {
          // Knus biten til støv.
          t.dead = true;
          game.particles.burst(t.x, t.y, 14, { type: 'smoke', sMin: 1, sMax: 5, color: RF.MATERIALS[t.mat] ? RF.MATERIALS[t.mat].light : '#999', zMin: 0.6, zMax: 1.4, grow: 2, lMin: 0.8, lMax: 1.8, vx: t.vx, vy: t.vy });
          game.particles.burst(t.x, t.y, 10, { sMin: 3, sMax: 10, color: '#ffb080', zMin: 0.15, zMax: 0.35, lMin: 0.2, lMax: 0.5 });
          this.threat = null;
        }
      }
    }

    leaveHangar() {
      const st = this.sys.station;
      const h = RF.hangarPoint(st);
      const out = st.a + Math.PI;
      this.spawnAt(h.x, h.y, out, Math.cos(out) * 1.5, Math.sin(out) * 1.5);
      this.state = 'undock';
      this.timer = 0;
    }

    goHome() {
      this.state = 'return';
      this.target = null;
    }

    updateDrone(dt, game) {
      const b = this.body, st = this.sys.station;
      const ws = this.sys.world;
      this.timer += dt;
      if (this.state === 'seek') {
        const cands = ws.bodies.filter((o) => o.kind === 'rock' && RF.MATERIALS[o.mat].hard <= 1 && o.area > 40 && o.area < 2500 && G.len(o.x - st.x, o.y - st.y) < 1900);
        if (!cands.length) { this.goHome(); return; }
        cands.sort((p, q) => G.len(p.x - b.x, p.y - b.y) - G.len(q.x - b.x, q.y - b.y));
        this.target = cands[Math.floor(Math.random() * Math.min(5, cands.length))];
        this.state = 'approach';
        this.timer = 0;
      } else if (this.state === 'approach' || this.state === 'mine') {
        const t = this.target;
        if (!t || t.dead || t.kind !== 'rock') { this.state = 'collect'; this.timer = 0; return; }
        const dx = b.x - t.x, dy = b.y - t.y, d = G.len(dx, dy) || 1;
        const stand = t.radius + 20;
        const px = t.x + (dx / d) * stand, py = t.y + (dy / d) * stand;
        const face = Math.atan2(t.y - b.y, t.x - b.x);
        const dist = this.steer(dt, px, py, t.vx, t.vy, this.state === 'mine' || d < stand + 40 ? face : null);
        if (this.state === 'approach') {
          if (dist < 8 && G.len(b.vx - t.vx, b.vy - t.vy) < 2) { this.state = 'mine'; this.timer = 0; }
          if (this.timer > 60) this.state = 'seek';
          return;
        }
        // Bor når nesen peker mot steinen.
        if (Math.abs(G.wrapAngle(face - b.a)) < 0.2) this.drill(t, dt, game);
        if (this.timer > 12) { this.state = 'collect'; this.timer = 0; }
      } else if (this.state === 'collect') {
        if (this.cargo >= 9000) { this.goHome(); return; }
        let best = null, bd = 160;
        for (const o of ws.bodies) {
          if (o.kind !== 'ore' || o.dead) continue;
          const d = G.len(o.x - b.x, o.y - b.y);
          if (d < bd) { bd = d; best = o; }
        }
        if (!best) {
          if (this.timer > 4) {
            if (this.cargo > 2500) this.goHome();
            else this.state = 'seek';
          }
          return;
        }
        this.timer = 0;
        const face = Math.atan2(best.y - b.y, best.x - b.x);
        const nose = b.toWorld(this.noseX + 1, 0);
        this.steer(dt, best.x - Math.cos(face) * 7, best.y - Math.sin(face) * 7, best.vx, best.vy, bd < 40 ? face : null, 12);
        if (G.len(best.x - nose.x, best.y - nose.y) < 4 + Math.sqrt(best.area)) {
          best.dead = true;
          this.cargo += best.mass;
        }
      }
    }

    updateHauler(dt, game) {
      const b = this.body, st = this.sys.station, g = this.sys.gate;
      const cs = Math.cos(g.a), sn = Math.sin(g.a);
      this.timer += dt;
      if (this.state === 'toGate') {
        const wx = g.x + cs * 140, wy = g.y + sn * 140;
        const dist = this.steer(dt, wx, wy, 0, 0, null, 30);
        if (dist < 15 && G.len(b.vx, b.vy) < 2) { this.state = 'waitGate'; this.timer = 0; }
      } else if (this.state === 'waitGate') {
        this.steer(dt, g.x + cs * 140, g.y + sn * 140, 0, 0, g.a + Math.PI);
        if (g.state === 'idle' && this.timer > 3) {
          const others = RF.SYSTEMS.filter((s) => s.id !== this.sys.def.id);
          g.state = 'dialing'; g.t = 0; g.chevrons = 0; g.incoming = false;
          g.dest = G.pick(others).id;
          g.dialedBy = this;
          this.state = 'dialing';
          if (game.sys === this.sys) game.msg(`${this.name} is dialing ${RF.systemById(g.dest).name}`, RF.HUD_COLORS.muted);
        }
      } else if (this.state === 'dialing') {
        this.steer(dt, g.x + cs * 140, g.y + sn * 140, 0, 0, g.a + Math.PI);
        if (g.state === 'open' && !g.incoming && g.dialedBy === this) this.state = 'transit';
        else if (g.state === 'idle') this.state = 'waitGate';
      } else if (this.state === 'transit') {
        // Rett inn i horisonten forfra.
        const dx = b.x - g.x, dy = b.y - g.y;
        const lx = dx * cs + dy * sn, ly = -dx * sn + dy * cs;
        this.steer(dt, g.x - cs * 30, g.y - sn * 30, -cs * 8, -sn * 8, g.a + Math.PI, 10);
        if (lx <= 0 && Math.abs(ly) < RF.GATE_R - 2 && g.state === 'open') {
          game.npcTransit(this, g);
          return;
        }
        if (g.state !== 'open') this.state = 'waitGate';
      } else if (this.state === 'toStation') {
        this.goHome();
      }
    }

    enterHangar(wait) {
      this.despawn();
      this.state = 'hangar';
      this.timer = wait;
      this.cargo = 0;
      this.hull = Math.min(this.T.hull, this.hull + 40);
    }

    takeImpact(dv, px, py, game) {
      if (dv < 3) return;
      const dmg = Math.pow(dv - 3, 1.5) * 3;
      this.hull -= dmg;
      this.shieldFlash = Math.min(1, dmg / 30);
      // Skaden vises på modulen nærmest treffpunktet.
      const loc = this.body.toLocal(px, py);
      let near = this.layout[0], nd = 1e9;
      for (const m of this.layout) { const d = G.len(m.lx - loc.x, m.ly - loc.y); if (d < nd) { nd = d; near = m; } }
      near.hp = Math.max(1, near.hp - dmg);
      if (this.hull <= 0) this.explode(game);
    }

    explode(game) {
      const b = this.body;
      if (game.sys === this.sys) {
        game.particles.burst(b.x, b.y, 50, { sMin: 5, sMax: 30, color: '#ffcf80', zMin: 0.2, zMax: 0.6, lMin: 0.5, lMax: 1.4, vx: b.vx, vy: b.vy });
        game.particles.burst(b.x, b.y, 30, { type: 'smoke', sMin: 1, sMax: 8, color: '#5d5a52', zMin: 1.5, zMax: 3, grow: 3, lMin: 1.2, lMax: 3, vx: b.vx, vy: b.vy });
        game.particles.burst(b.x, b.y, 20, { type: 'debris', sMin: 3, sMax: 15, color: '#8a8e92', zMin: 0.3, zMax: 1, lMin: 2, lMax: 5, vx: b.vx, vy: b.vy });
        game.spawnWreck(this.layout.filter(() => Math.random() < 0.4).map((m) => ({ t: m.t, x: m.x, y: m.y, hp: 1 })), b);
        RF.Audio.thud(0.9);
        game.msg(`${this.name} was destroyed`, RF.HUD_COLORS.danger);
      }
      this.despawn();
      this.state = 'hangar';
      this.timer = G.rand(60, 120); // et nytt skip bygges på stasjonen
      this.hull = this.T.hull;
      for (const m of this.layout) m.hp = RF.MODULES[m.t].hp;
      this.cargo = 0;
      if (this.T.own) { this.state = 'lost'; game.droneLost(this); }
    }
  }

  RF.NPC = NPC;

  RF.spawnNPCs = (sys) => {
    sys.npcs = [];
    const n = sys.def.npcs || {};
    for (const type in n) for (let i = 0; i < n[type]; i++) sys.npcs.push(new NPC(type, sys));
  };
})();
