// Spillerens skip, bygget av moduler (se modules.js): motorer, flygeassistent,
// verktøy (laser, kanon, raketter, anker), traktorstråle, prosessering,
// drivstoff, last og skade per modul.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;
  const CELL = RF.CELL;

  // Eksoshastighet for drivstofforbruk: kg/s = kraft / VE.
  const VE = 25000;

  RF.TOOLS = ['laser', 'kanon', 'rakett', 'anker'];
  RF.TURRET_ARC = 1.9; // hvor langt et tårn kan dreie hver vei fra retningen det peker ut (rad)
  RF.TOOL_NAMES = { laser: 'Laser', kanon: 'Cannon', rakett: 'Rocket', anker: 'Harpoon' };

  RF.emptyCargo = () => {
    const c = {};
    for (const k in RF.PRODUCTS) c[k] = 0;
    return c;
  };

  RF.newShipState = (hull = 'hopper', layout) => {
    layout = layout || RF.defaultLayout(hull);
    const st = RF.layoutStats(layout);
    return {
      hull,
      layout,
      blueprint: layout.map((m) => ({ t: m.t, x: m.x, y: m.y })),
      fuel: st.fuelCap,
      ammo: st.rocketCap,
      cargo: RF.emptyCargo(),
      missionCargo: [],
      drones: [],
    };
  };

  RF.cargoMass = (s) => {
    let t = 0;
    for (const k in s.cargo) t += s.cargo[k];
    for (const m of s.missionCargo) t += m.mass;
    return t; // tonn
  };

  class Ship {
    constructor(state) {
      this.s = state;
      this.body = new RF.Body(G.box(-1, -1, 1, 1), 1, { kind: 'ship', restitution: 0.18, friction: 0.45 });
      this.body.ship = this;
      this.fa = 1; // 0 = av, 1 = rotasjon, 2 = full
      this.fx = { main: 0, retro: 0, left: 0, right: 0, rotL: 0, rotR: 0 };
      this.tool = 'laser';
      this.beams = [];
      this.laser = { on: false, hit: null };
      this.tractor = { on: false, targets: [] };
      this.processing = [];
      this.shieldFlash = 0;
      this.shieldHitDir = 0;
      this.shieldDelay = 0;
      this.gunCd = 0;
      this.rocketCd = 0;
      this.docked = null;
      this.lightOn = true;
      this.anchor = null; // { rope, winch, range }
      this.harpoon = null;
      this.com = null;
      this.rebuild();
      this.shield = this.stats.shieldMax;
    }

    get layout() { return this.s.layout; }
    get scars() { return []; }

    // Regn ut masse, form og egenskaper på nytt etter at moduler er lagt til,
    // fjernet eller skadet. Skipet flytter seg ikke i verden.
    rebuild() {
      const s = this.s;
      const L = s.layout;
      const extra = this.extraMass();
      const g = RF.layoutGeometry(L, extra);
      if (this.com) this.body.shiftOrigin(g.com.x - this.com.x, g.com.y - this.com.y);
      this.com = g.com;
      this.body.setRaw(g.verts, g.mass, g.I);
      this.dryMass = g.dryMass;
      this.refreshStats();
      s.fuel = Math.min(s.fuel, this.stats.fuelCap);
      s.ammo = Math.min(s.ammo || 0, this.stats.rocketCap);
      this.shield = Math.min(this.shield || 0, this.stats.shieldMax);
      this.noseX = L.reduce((a, m) => Math.max(a, m.lx), 0) + CELL / 2;
      if (this.anchor && !this.anchorModuleAlive()) this.anchor.lost = true;
      this.updateMass();
    }

    // Egenskaper fra modulene. Skadde moduler virker dårligere, så dette
    // regnes ut på nytt etter hver skade.
    refreshStats() {
      const st = (this.stats = RF.layoutStats(this.s.layout));
      // Dreiemoment fra styredysene vokser med avstanden fra tyngdepunktet.
      st.torque = 0.25e6;
      for (const r of st.rcsList) st.torque += r.F * Math.max(CELL, G.len(r.m.lx, r.m.ly));
      st.strafe = 30e3 + st.rcs * 0.8;
      st.retro = 40e3 + st.rcs * 1.4;
      st.maxW = 1.8;
      st.light = st.lights.reduce((a, l) => Math.max(a, l.range), 0);
      st.anchorRange = st.anchors.reduce((a, l) => Math.max(a, l.range), 0);
      st.tractor = st.tractors.reduce((a, t) => a + t.F, 0);
      st.maxTier = st.lasers.reduce((a, l) => Math.max(a, l.tier), 0);
      return st;
    }

    anchorModuleAlive() {
      return this.anchor && this.s.layout.includes(this.anchor.module);
    }

    procMass() {
      let m = 0;
      for (const p of this.processing) m += p.mass;
      return m;
    }

    extraMass() {
      return this.s.fuel + RF.cargoMass(this.s) * 1000 + this.procMass();
    }

    updateMass() {
      this.body.setMass(this.dryMass + this.extraMass());
    }

    holdFree() {
      return this.stats.hold - RF.cargoMass(this.s);
    }

    // Verdens-posisjon for fronten (eller baksiden) av en modul.
    modPoint(m, side = 1) {
      return this.body.toWorld(m.lx + (side * CELL) / 2, m.ly);
    }

    // input: { thrust, turn, strafe, aim, aimThrust }
    fly(input, dt) {
      const b = this.body, s = this.s, st = this.stats;
      const fwd = b.dirWorld(1, 0), right = b.dirWorld(0, 1);
      const hasFuel = s.fuel > 0;
      let main = 0, retro = 0, strafe = 0, torque = 0;
      if (input.thrust > 0) main = input.thrust;
      else if (input.thrust < 0) retro = -input.thrust;
      strafe = input.strafe;

      const maxT = st.torque;
      if (input.aim != null) {
        const err = G.wrapAngle(input.aim - b.a);
        // Snu så fort som mulig, men begynn å bremse rotasjonen i tide ut fra
        // hvor kraftige styredysene er, så skipet stopper på pilen uten å
        // svinge forbi og tilbake.
        const alpha = maxT / b.I;
        const wStop = Math.sqrt(2 * alpha * 0.55 * Math.abs(err));
        const target = Math.sign(err) * Math.min(input.maxW ? Math.min(st.maxW, input.maxW) : st.maxW, wStop, Math.abs(err) * 2.2);
        torque = G.clamp((target - b.w) * b.I * 10, -maxT, maxT);
        if (input.aimThrust > 0 && Math.cos(err) > 0.8) main = input.aimThrust;
      } else if (input.turn !== 0) {
        if (this.fa > 0) {
          const target = input.turn * st.maxW;
          torque = G.clamp((target - b.w) * b.I * 6, -maxT, maxT);
        } else torque = input.turn * maxT;
      } else if (this.fa > 0 || input.brake || input.accel) {
        torque = G.clamp(-b.w * b.I * 5, -maxT, maxT);
        if (Math.abs(b.w) < 0.002) torque = 0;
      }

      // Brems: alle motorer og styredyser jobber mot farten, så skipet
      // stopper langs den veien det faktisk beveger seg (ikke bare rygger).
      let brakeF = 0;
      if (input.brake) {
        main = 0; retro = 0; strafe = 0;
        const sp = G.len(b.vx, b.vy);
        if (sp > 0.02) {
          brakeF = Math.min(Math.max(st.retro + st.strafe, (st.thrust || 0) * 0.6), (sp / 0.25) * b.mass);
          // Hvilke dyser som lyser: etter hvordan farten ligger i forhold til skipet.
          const vf = (b.vx * fwd.x + b.vy * fwd.y) / sp, vr = (b.vx * right.x + b.vy * right.y) / sp;
          retro = Math.abs(vf);
          strafe = -vr;
        }
      }
      // Autopilot: ønsket akselerasjon i verden. Hovedmotoren brukes når nesen
      // peker omtrent dit, ellers dysene (like sterke som bremsen).
      let accF = null;
      if (input.accel && hasFuel) {
        main = 0; retro = 0; strafe = 0;
        const ax = input.accel.x, ay = input.accel.y, al = G.len(ax, ay);
        if (al > 0.01) {
          const ux = ax / al, uy = ay / al;
          const cf = ux * fwd.x + uy * fwd.y, cr = ux * right.x + uy * right.y;
          const cap = Math.max(st.retro + st.strafe, (st.thrust || 0) * 0.6);
          const F = Math.min(al * b.mass, cf > 0.8 ? Math.max(st.thrust || 0, cap) : cap);
          accF = { x: ux * F, y: uy * F, F };
          if (cf > 0) main = Math.min(1, (cf * F) / (st.thrust || 1)); else retro = Math.min(1, -cf);
          strafe = G.clamp(cr, -1, 1);
        }
      }
      if (!accF && !input.brake && this.fa === 2 && input.thrust === 0 && input.strafe === 0 && !(input.aimThrust > 0)) {
        if (G.len(b.vx, b.vy) > 0.03) {
          const ax = -b.vx * 0.9, ay = -b.vy * 0.9;
          const af = ax * fwd.x + ay * fwd.y, ar = ax * right.x + ay * right.y;
          const m = b.mass;
          if (af > 0) main = Math.min(1, (af * m) / (st.thrust || 1));
          else retro = Math.min(1, (-af * m) / st.retro);
          strafe = G.clamp((ar * m) / st.strafe, -1, 1);
        }
      }
      if (!hasFuel) { main = 0; retro *= 0.2; strafe *= 0.2; }

      // Hver motor skyver der den sitter. En motor som sitter skjevt gir dreiemoment.
      let Fx = 0, Tq = 0;
      for (const t of st.thrusters) {
        const F = t.F * main;
        Fx += F;
        Tq += -t.m.ly * F;
      }
      Fx -= retro * st.retro;
      const Fy = strafe * st.strafe;
      if (accF) {
        b.vx += (accF.x / b.mass) * dt;
        b.vy += (accF.y / b.mass) * dt;
        Tq = 0;
      } else if (brakeF > 0) {
        const sp = G.len(b.vx, b.vy) || 1;
        b.vx -= (b.vx / sp) * (brakeF / b.mass) * dt;
        b.vy -= (b.vy / sp) * (brakeF / b.mass) * dt;
      } else {
        b.vx += ((fwd.x * Fx + right.x * Fy) / b.mass) * dt;
        b.vy += ((fwd.y * Fx + right.y * Fy) / b.mass) * dt;
      }
      b.w += (torque + Tq) * b.invI * dt;

      const use = (accF ? accF.F : brakeF > 0 ? brakeF : main * st.thrust + retro * st.retro + Math.abs(strafe) * st.strafe + Math.abs(torque) * 0.05) / VE;
      s.fuel = Math.max(0, s.fuel - use * dt);

      const fx = this.fx;
      fx.main = G.lerp(fx.main, main, 0.3);
      fx.retro = G.lerp(fx.retro, retro, 0.3);
      fx.left = G.lerp(fx.left, strafe < 0 ? -strafe : 0, 0.3);
      fx.right = G.lerp(fx.right, strafe > 0 ? strafe : 0, 0.3);
      fx.rotL = G.lerp(fx.rotL, torque < 0 ? -torque / maxT : 0, 0.3);
      fx.rotR = G.lerp(fx.rotR, torque > 0 ? torque / maxT : 0, 0.3);
    }

    // Punktet på skrogkanten der et verktøy sitter, og hvilken vei det peker
    // ut (lokal vinkel). Verktøy uten fri kant har dir -1 og virker ikke.
    mountOf(m) {
      const d = m.dir >= 0 ? m.dir : 0;
      const a = RF.DIR_ANGLE[d];
      return { lx: m.lx + Math.cos(a) * CELL * 0.35, ly: m.ly + Math.sin(a) * CELL * 0.35, a };
    }

    // Tårnene dreier mot siktepunktet innenfor sin sektor (litt over 90° hver
    // vei fra retningen de peker ut). Lys, traktor og borehoder står fast.
    updateTurrets(aim, dt) {
      const b = this.body;
      const al = b.toLocal(aim.x, aim.y);
      for (const m of this.s.layout) {
        const D = RF.MODULES[m.t];
        if (!D.mount || m.dir < 0) continue;
        const mp = this.mountOf(m);
        if (D.light || D.tractor || D.drill) { m.aimA = mp.a; m.inArc = true; continue; }
        const want = Math.atan2(al.y - mp.ly, al.x - mp.lx);
        const diff = G.wrapAngle(want - mp.a);
        m.inArc = Math.abs(diff) <= RF.TURRET_ARC;
        const target = mp.a + G.clamp(diff, -RF.TURRET_ARC, RF.TURRET_ARC);
        const cur = m.aimA != null ? m.aimA : mp.a;
        const step = G.clamp(G.wrapAngle(target - cur), -5 * dt, 5 * dt);
        m.aimA = cur + step;
        m.onTarget = m.inArc && Math.abs(G.wrapAngle(want - m.aimA)) < 0.08;
      }
    }

    // Verdens-punkt og retning for tuppen av et tårn.
    muzzle(m, len = CELL * 0.9) {
      const mp = this.mountOf(m);
      const a = m.aimA != null ? m.aimA : mp.a;
      const p = this.body.toWorld(mp.lx + Math.cos(a) * len, mp.ly + Math.sin(a) * len);
      const d = this.body.dirWorld(Math.cos(a), Math.sin(a));
      return { p, d, lx: mp.lx + Math.cos(a) * len, ly: mp.ly + Math.sin(a) * len, a };
    }

    // Borelaserne skyter mot siktepunktet fra hvert sitt tårn.
    updateLasers(on, dt, game) {
      const b = this.body, st = this.stats;
      this.laser.on = false;
      this.laser.hit = null;
      this.beams = [];
      for (const Dr of st.drills) Dr.m.active = false;
      if (!on) return;
      let hardMat = null, bit = false;
      // Borehodene maler i steinen rett foran seg.
      for (const Dr of st.drills) {
        const mp = this.mountOf(Dr.m);
        Dr.m.active = true;
        const o = b.toWorld(mp.lx, mp.ly), d = b.dirWorld(Math.cos(mp.a), Math.sin(mp.a));
        const hit = game.sys.world.raycast(o.x, o.y, d.x, d.y, Dr.range, (x) => x !== b && !x.ghost && (x.kind !== 'ore' || RF.isStone(x)));
        Dr.m.touch = hit ? hit.t : null;
        if (!hit) continue;
        const t = hit.body;
        if (RF.isStone(t)) { t.heat = 1; this.burnStone(t, game); continue; }
        if (t.kind === 'ore' || t.kind === 'wreck') {
          t.applyForce(d.x * 40000, d.y * 40000, t.x, t.y, dt);
          continue;
        }
        if (!t.vox) continue;
        if (Math.random() < 0.5) game.particles.burst(hit.x, hit.y, 2, { type: 'debris', sMin: 2, sMax: 7, dir: Math.atan2(-d.y, -d.x), spread: 1.6, color: RF.MATERIALS[t.mat].light, zMin: 0.15, zMax: 0.4, lMin: 0.5, lMax: 1.4, vx: t.vx, vy: t.vy });
        const tooHard = RF.Vox.laser(t, hit, d, Dr.power, Dr.tier, dt, game);
        if (tooHard) hardMat = tooHard; else bit = true;
      }
      for (const L of st.lasers) {
        if (!L.m.onTarget) continue;
        const { p: o, d, lx, ly, a } = this.muzzle(L.m);
        // Løse mineralbiter stopper ikke strålen, den går rett gjennom dem.
        // Småstein av gråstein treffes og fordamper.
        const hit = game.sys.world.raycast(o.x, o.y, d.x, d.y, L.range, (x) => x !== b && !x.ghost && (x.kind !== 'ore' || RF.isStone(x)));
        this.beams.push({ lx, ly, a, len: hit ? hit.t : L.range, hit, color: L.color, w: 0.35 + L.tier * 0.12 });
        this.laser.on = true;
        if (!hit) continue;
        if (!this.laser.hit) this.laser.hit = hit;
        const t = hit.body;
        if (RF.isStone(t)) {
          t.heat = Math.min(1, (t.heat || 0) + dt * 5);
          if (t.heat >= 0.6) this.burnStone(t, game);
          continue;
        }
        if (t.kind === 'ore' || t.kind === 'wreck') {
          // Løse biter dyttes ut av strålen så de ikke står i veien.
          const side = (t.x - o.x) * -d.y + (t.y - o.y) * d.x >= 0 ? 1 : -1;
          const F = 60000 * L.power;
          t.applyForce(d.x * F * 0.6 - d.y * side * F, d.y * F * 0.6 + d.x * side * F, t.x, t.y, dt);
          t.heat = Math.min(1, (t.heat || 0) + dt * 1.5);
          t.hitX = hit.x; t.hitY = hit.y;
          // De minste fordamper.
          if (t.kind === 'ore' && t.area < 0.9 && t.heat > 0.8) {
            t.dead = true;
            game.particles.burst(t.x, t.y, 8, { type: 'smoke', sMin: 1, sMax: 4, color: RF.MATERIALS[t.mat].light, zMin: 0.5, zMax: 1, grow: 1.5, lMin: 0.8, lMax: 1.6, vx: t.vx, vy: t.vy });
          }
          continue;
        }
        if (t.kind !== 'rock') continue;
        t.applyImpulse(d.x * 900 * L.power * dt, d.y * 900 * L.power * dt, hit.x, hit.y);
        t.heat = Math.min(1, (t.heat || 0) + dt * 2);
        t.hitX = hit.x; t.hitY = hit.y;
        // Mineralet der strålen treffer avgjør om laseren biter.
        const tooHard = t.vox ? RF.Vox.laser(t, hit, d, L.power, L.tier, dt, game) : null;
        if (tooHard) hardMat = tooHard; else bit = true;
      }
      // Varsle bare når ingen av laserne biter.
      if (hardMat && !bit && (!game._hardWarn || game.time - game._hardWarn > 5)) {
        const M = RF.MATERIALS[hardMat];
        game._hardWarn = game.time;
        game.msg(`${M.name} is too hard (${M.hard}). Needs a stronger laser, cannon or rockets`, RF.HUD_COLORS.amber);
      }
    }

    burnStone(t, game) {
      t.dead = true;
      game.particles.burst(t.x, t.y, 8, { type: 'smoke', sMin: 1, sMax: 4, color: RF.MATERIALS[t.mat].light, zMin: 0.5, zMax: 1, grow: 1.5, lMin: 0.8, lMax: 1.6, vx: t.vx, vy: t.vy });
    }

    releaseAnchor(game) {
      if (this.harpoon) { this.harpoon.dead = true; this.harpoon = null; }
      if (!this.anchor) return;
      const ws = game.sys.world;
      ws.ropes = ws.ropes.filter((r) => r !== this.anchor.rope);
      this.anchor = null;
      RF.Audio.blip(180, 0.1, 'square', 0.08);
    }

    updateAnchor(winchIn, winchOut, dt, game) {
      const A = this.anchor;
      if (!A) return;
      if (A.lost || A.rope.B.dead || !game.sys.world.ropes.includes(A.rope)) {
        this.releaseAnchor(game);
        game.msg('The harpoon lost its grip', RF.HUD_COLORS.amber);
        return;
      }
      const cur = A.rope.dist || A.rope.length;
      if (winchIn) A.rope.length = Math.max(0.6, Math.min(A.rope.length, cur) - A.winch * dt);
      if (winchOut) A.rope.length = Math.min(A.range, A.rope.length + A.winch * dt);
    }

    // Traktorstråle: trekker malm og vrakdeler mot nærmeste inntak. Kraften
    // virker like mye tilbake på skipet (Newtons tredje lov).
    updateTractor(dt, game) {
      const T = this.tractor, b = this.body, st = this.stats;
      T.targets = [];
      if (!T.on || !st.tractors.length) return;
      const intakes = st.tractors.map((t) => { const mp = this.mountOf(t.m); return b.toWorld(mp.lx + Math.cos(mp.a) * 2.2, mp.ly + Math.sin(mp.a) * 2.2); });
      const fwd = b.dirWorld(1, 0);
      const range = 150;
      const cands = [];
      for (const o of game.sys.world.bodies) {
        const small = o.kind === 'ore' || (o.kind === 'wreck' && o.modules.length <= 2);
        if (!small || o.dead || o.ghost) continue;
        let best = null, bd = 1e9;
        for (const ip of intakes) {
          const d = G.len(o.x - ip.x, o.y - ip.y);
          if (d < bd) { bd = d; best = ip; }
        }
        if (bd > range) continue;
        const cosA = ((o.x - best.x) * fwd.x + (o.y - best.y) * fwd.y) / (bd || 1);
        if (bd > 30 && cosA < 0.6) continue;
        cands.push({ o, dist: bd, ip: best });
      }
      cands.sort((p, q) => p.dist - q.dist);
      const n = Math.min(4 + st.tractors.length * 2, cands.length);
      for (let i = 0; i < n; i++) {
        const { o, dist, ip } = cands[i];
        const ux = (ip.x - o.x) / (dist || 1), uy = (ip.y - o.y) / (dist || 1);
        const want = Math.min(14, dist * 0.45 + 0.5);
        const rv = b.pointVel(o.x, o.y);
        let fx = (rv.x + ux * want - o.vx) * o.mass * 2.5, fy = (rv.y + uy * want - o.vy) * o.mass * 2.5;
        const fl = G.len(fx, fy), cap = st.tractor / n;
        if (fl > cap) { fx *= cap / fl; fy *= cap / fl; }
        o.applyForce(fx, fy, o.x, o.y, dt);
        b.applyForce(-fx, -fy, ip.x, ip.y, dt);
        o.w *= 1 - Math.min(1, dt * 2);
        o._tractorFrom = ip;
        T.targets.push(o);
        if (dist < 4.5 + Math.sqrt(o.area)) {
          if (G.len(o.vx - rv.x, o.vy - rv.y) < 5) game.tryIntake(o);
        }
      }
    }

    updateProcessing(dt, game) {
      if (!this.processing.length) return;
      const p = this.processing[0];
      const take = Math.min(this.stats.proc * dt, p.mass);
      p.mass -= take;
      const M = RF.MATERIALS[p.mat];
      const out = (take * M.grade * this.stats.yield) / 1000;
      const add = Math.min(out, Math.max(0, this.holdFree()));
      this.s.cargo[M.product] += add;
      p.made = (p.made || 0) + add;
      if (p.mass <= 0.01) {
        this.processing.shift();
        game.onProcessed(p);
      }
    }

    // Skjoldet dytter småstein og løse malmbiter unna skroget. Feltet virker
    // bare på biten, ikke tilbake på skipet. Malm som traktorstrålen trekker
    // inn, slipper gjennom.
    updateDeflector(dt, game) {
      if (!(this.shield > 0) || this.docked) return;
      const b = this.body, reach = 5, H = RF.CELL * 0.7;
      const mods = this.s.layout;
      for (const o of game.sys.world.bodies) {
        if (o === b || o.dead || o.ghost || o.isStatic) continue;
        if (!(o.kind === 'ore' ? !this.tractor.on : RF.isSmallRock(o))) continue;
        const cd = G.len(o.x - b.x, o.y - b.y);
        if (cd > b.radius + o.radius + reach + 25) continue;
        const l = b.toLocal(o.x, o.y);
        let best = null, bd = Infinity;
        for (const m of mods) {
          if (m.lx == null) continue;
          const d = G.len(l.x - m.lx, l.y - m.ly);
          if (d < bd) { bd = d; best = m; }
        }
        if (!best) continue;
        const gap = bd - H - o.radius;
        if (gap > reach + 25) continue;
        const nl = { x: (l.x - best.lx) / (bd || 1), y: (l.y - best.ly) / (bd || 1) };
        const n = b.dirWorld(nl.x, nl.y);
        const pv = b.pointVel(o.x, o.y);
        const vn = (o.vx - pv.x) * n.x + (o.vy - pv.y) * n.y;
        // Feltet rekker lenger ut jo fortere biten nærmer seg.
        const R2 = reach + Math.max(0, -vn) * 0.5;
        if (gap > R2) continue;
        const want = 1.5 + (R2 - Math.max(0, gap)) * 0.4;
        if (vn >= want) continue;
        const dv = Math.min(want - vn, dt * 150);
        o.vx += n.x * dv; o.vy += n.y * dv;
        o.w *= 1 - Math.min(1, dt * 2);
        if (want - vn > 1.5) {
          this.shieldFlash = Math.max(this.shieldFlash, 0.3);
          this.shieldHitDir = Math.atan2(l.y, l.x);
        }
      }
    }

    updateShield(dt) {
      if (this.shieldDelay > 0) this.shieldDelay -= dt;
      else this.shield = Math.min(this.stats.shieldMax, this.shield + dt * Math.max(4, this.stats.shieldMax * 0.07));
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.5);
    }

    // dv er fartsendringen skipet fikk i støtet (m/s). Skaden havner på
    // modulene nærmest treffpunktet. Returnerer total skade.
    takeImpact(dv, px, py, game, force = 0) {
      const loc = this.body.toLocal(px, py);
      this.shieldHitDir = Math.atan2(loc.y, loc.x);
      if (dv < 1.6 && !force) return 0;
      let dmg = force || Math.pow(dv - 1.6, 1.55) * 2.3;
      if (this.shield > 0) {
        const absorbed = Math.min(this.shield, dmg);
        this.shield -= absorbed;
        dmg -= absorbed;
        this.shieldFlash = Math.min(1, 0.4 + absorbed / 30);
      }
      this.shieldDelay = 3;
      if (dmg <= 0) return 0;
      this.damageAt(loc.x, loc.y, dmg, game);
      return dmg;
    }

    damageAt(lx, ly, dmg, game) {
      const near = this.s.layout
        .map((m) => ({ m, d: G.len(m.lx - lx, m.ly - ly) }))
        .sort((a, b) => a.d - b.d)
        .filter((e, i) => i === 0 || e.d < CELL * 1.6)
        .slice(0, 3);
      const w = [0.7, 0.18, 0.12].slice(0, near.length);
      const sum = w.reduce((a, b) => a + b, 0);
      const dead = [];
      near.forEach((e, i) => {
        e.m.hp -= (dmg * w[i]) / sum;
        if (e.m.hp <= 0) dead.push(e.m);
      });
      if (dead.length) game.loseModules(this, dead);
      else this.refreshStats();
    }

    // Modulen med minst igjen av hp i forhold til maks.
    mostDamaged() {
      let best = null, bf = 1;
      for (const m of this.s.layout) {
        const f = m.hp / RF.MODULES[m.t].hp;
        if (f < bf - 0.001) { bf = f; best = m; }
      }
      return best;
    }

    hullFrac() {
      return this.stats.hp / this.stats.hpMax;
    }
  }

  RF.Ship = Ship;
})();
