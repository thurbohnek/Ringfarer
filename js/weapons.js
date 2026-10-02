// Prosjektiler: kanonkuler, raketter og ankerkroken. De flyr med egen fart og
// treffer det første de krysser (stråle-test langs banen hvert steg).
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;
  const CELL = RF.CELL;

  const W = (RF.Weapons = { list: [], traces: [], now: 0 });

  W.reset = () => { W.list = []; W.traces = []; };

  // Tuppen av tårnet og retningen det sikter.
  function launchFrom(ship, m) {
    const { p, d } = ship.muzzle(m, CELL * 1.1);
    const v = ship.body.pointVel(p.x, p.y);
    return { p, d, v };
  }

  // Et enkelt prosjektil fra et datastyrt skip (pirater).
  W.shoot = (p, game) => {
    W.list.push(Object.assign({ type: 'shell', life: 2.6 }, p));
  };

  // Kanonene: hver har sin egen takt. Maskinkanonen spruter lette kuler,
  // massedriveren tunge, og railkanonen lades opp mellom skuddene (raskere
  // med reaktor) og skyter en kule som går gjennom flere mål. Rekylen dytter
  // skipet.
  W.updateGuns = (ship, fire, dt, game) => {
    const st = ship.stats;
    const snd = { auto: 0, slug: 0, rail: 0 };
    for (const g of st.guns) {
      const m = g.m;
      m._cd = Math.max(0, (m._cd || 0) - dt);
      const rate = g.rate * (st.gunRateMul || 1);
      if (g.kind === 'rail') {
        m._charge = Math.min(1, (m._charge || 0) + dt * rate * (1 + 0.35 * (st.power || 0)));
        if (!fire || m._charge < 1 || !m.onTarget) continue;
        m._charge = 0;
      } else {
        if (!fire || m._cd > 0 || !m.onTarget) continue;
        m._cd = 1 / rate;
      }
      const { p, d: d0, v } = launchFrom(ship, m);
      let d = d0;
      if (g.spread) { const a = Math.atan2(d.y, d.x) + G.rand(-g.spread, g.spread); d = { x: Math.cos(a), y: Math.sin(a) }; }
      // Større kanoner og større skip skyter tyngre prosjektiler.
      const gm = st.gunMul || 1;
      const mass = g.mass * gm, pow = (g.pow || RF.MODULES[m.t].pow || 1) * Math.sqrt(gm);
      const sh = { type: 'shell', kind: g.kind, x: p.x, y: p.y, vx: v.x + d.x * g.speed, vy: v.y + d.y * g.speed, mass, pow, owner: ship.body,
        life: g.kind === 'rail' ? 0.45 : g.kind === 'auto' ? 1.1 : 1.2 + pow * 0.2 };
      if (g.dmg) sh.dmg = g.dmg * gm;
      if (g.pierce) { sh.pierce = g.pierce; sh.skip = []; }
      W.list.push(sh);
      ship.body.applyImpulse(-d.x * mass * g.speed, -d.y * mass * g.speed, p.x, p.y);
      const ang = Math.atan2(d.y, d.x);
      if (g.kind === 'rail') {
        game.particles.burst(p.x, p.y, 16, { type: 'glow', dir: ang, spread: 0.25, sMin: 20, sMax: 80, color: '#9fe8ff', zMin: 0.2, zMax: 0.5, lMin: 0.05, lMax: 0.2, vx: v.x, vy: v.y });
        game.shake = Math.min(1, game.shake + 0.25);
        snd.rail++;
      } else {
        game.particles.burst(p.x, p.y, g.kind === 'auto' ? 2 : 6, { type: 'glow', dir: ang, spread: 0.4, sMin: 10, sMax: 40, color: '#ffd28a', zMin: 0.15, zMax: g.kind === 'auto' ? 0.25 : 0.4, lMin: 0.04, lMax: 0.12, vx: v.x, vy: v.y });
        if (g.kind === 'auto') snd.auto++; else snd.slug++;
      }
    }
    if (snd.slug) RF.Audio.gun(0.8);
    if (snd.auto) RF.Audio.auto(Math.min(1, 0.6 + snd.auto * 0.2));
    if (snd.rail) RF.Audio.rail(1);
  };
  // Eldre navn (testene bruker det).
  W.fireGuns = (ship, game) => W.updateGuns(ship, true, 0, game);

  W.fireRocket = (ship, game) => {
    const st = ship.stats;
    if (!st.rockets.length) { game.msg('The ship has no rocket launcher', RF.HUD_COLORS.amber); return; }
    if (ship.rocketCd > 0) return;
    if ((ship.s.ammo || 0) <= 0) { game.msg('Out of rockets. Restock at a station', RF.HUD_COLORS.amber); return; }
    // Med lås flyr raketten mot målet uansett hvor tårnet peker.
    const lock = RF.Combat && RF.Combat.locked(game) ? RF.Combat.lock.target : null;
    const ready = lock ? st.rockets : st.rockets.filter((r) => r.m.onTarget);
    if (!ready.length) { game.msg('Target is outside the rocket launcher arc', RF.HUD_COLORS.amber); return; }
    ship.rocketCd = 0.6;
    ship.s.ammo--;
    const L = ready[ship.s.ammo % ready.length];
    const { p, d, v } = launchFrom(ship, L.m);
    const pow = (RF.MODULES[L.m.t].pow || 1) * Math.sqrt(st.gunMul || 1);
    W.list.push({ type: 'rocket', x: p.x, y: p.y, vx: v.x + d.x * 25, vy: v.y + d.y * 25, dx: d.x, dy: d.y, life: 8, owner: ship.body, arm: 0.25 * Math.sqrt(pow), pow,
      seeker: true, target: lock ? lock.body : null, locked: !!lock, turn: L.turn || 2.2, burn: 6 });
    RF.Audio.rocket();
  };

  // Ankerkrok: skytes ut på en wire. Fester seg i det den treffer.
  W.fireHarpoon = (ship, game) => {
    if (ship.anchor || ship.harpoon) { ship.releaseAnchor(game); return; }
    const st = ship.stats;
    if (!st.anchors.length) { game.msg('The ship has no harpoon launcher', RF.HUD_COLORS.amber); return; }
    const inArc = st.anchors.filter((a) => a.m.onTarget);
    if (!inArc.length) { game.msg('Target is outside the harpoon arc', RF.HUD_COLORS.amber); return; }
    const A = inArc.reduce((a, b) => (b.range > a.range ? b : a));
    const { p, d, v } = launchFrom(ship, A.m);
    const h = { type: 'harpoon', x: p.x, y: p.y, vx: v.x + d.x * 70, vy: v.y + d.y * 70, life: 10, owner: ship.body, ship, mod: A.m, range: A.range, winch: A.winch };
    ship.harpoon = h;
    W.list.push(h);
    RF.Audio.blip(140, 0.12, 'square', 0.1);
  };

  W.explode = (x, y, game, pow) => explode(x, y, game, pow);
  function explode(x, y, game, pow = 1) {
    const R = 22 * Math.sqrt(pow), sp = Math.min(3, Math.sqrt(pow));
    const ws = game.sys.world;
    for (const o of ws.bodies.slice()) {
      if (o.dead || o.isStatic) continue;
      const dx = o.x - x, dy = o.y - y;
      const dl = G.len(dx, dy) || 1;
      const ux = dx / dl, uy = dy / dl;
      let d = Math.max(0.5, dl - o.radius * 0.5);
      // Steiner av voksler: mål avstanden til overflaten, ikke til midten.
      let hx = null, hy = null;
      if (o.vox) {
        if (dl > R + o.radius) continue;
        if (RF.Vox.contains(o, x, y)) { hx = x; hy = y; d = 0.5; }
        else {
          const h = ws.raycast(x, y, ux, uy, dl + o.radius, (b) => b === o);
          if (!h) continue;
          hx = h.x; hy = h.y; d = Math.max(0.5, h.t);
        }
      }
      if (d > R) continue;
      const k = 1 - d / R;
      const J = 5e5 * k * pow;
      if (hx != null) o.applyImpulse(ux * J, uy * J, hx, hy);
      else o.applyImpulse(ux * J, uy * J, o.x - ux * o.radius * 0.3, o.y - uy * o.radius * 0.3);
      if (o.vox) {
        // Slå ut et krater der smellet treffer.
        if (d < R * 0.45) {
          const kk = 1 - d / (R * 0.45);
          RF.Vox.blast(o, hx + ux * 1.2, hy + uy * 1.2, (1.5 + 4 * kk) * sp, G.randInt(3, 5), game, 8);
          if (!o.dead) {
            o.stress += 2.5 * kk * pow;
            if (o.stress >= o.integrity) RF.Vox.crack(o, { x: hx, y: hy }, { x: ux, y: uy }, game);
          }
        }
      } else if (o.rubble) {
        // Runde klumper: smellet knuser dem (kanon og raketter bryr seg ikke om hardheten).
        RF.Vox.hitRubble(o, 6 * k * pow, 9, { x: ux, y: uy }, game, false);
      } else if (o.ship) {
        o.ship.takeImpact(0, x, y, game, 90 * k * pow);
      } else if (o.npc) {
        o.npc.takeImpact((12 * k + 3) * pow, x, y, game);
      }
    }
    game.particles.burst(x, y, 60, { type: 'glow', sMin: 5, sMax: 40, color: '#ffb050', zMin: 0.3, zMax: 0.9, lMin: 0.3, lMax: 0.9 });
    game.particles.burst(x, y, 40, { sMin: 10, sMax: 60, color: '#ffe0a0', zMin: 0.2, zMax: 0.5, lMin: 0.3, lMax: 0.8 });
    game.particles.burst(x, y, 30, { type: 'smoke', sMin: 2, sMax: 10, color: '#6a645a', zMin: 2, zMax: 4, grow: 5, lMin: 1.5, lMax: 3.5 });
    RF.Audio.boom(Math.min(1, 0.55 + 0.25 * pow) * RF.Audio.near(x, y, 1200));
    const sb = game.ship.body;
    const dist = G.len(sb.x - x, sb.y - y);
    game.shake = Math.min(1, game.shake + Math.max(0, 1 - dist / 200));
  }

  function hitShell(p, hit, game) {
    const o = hit.body;
    const rvx = p.vx - o.vx, rvy = p.vy - o.vy;
    o.applyImpulse(rvx * p.mass, rvy * p.mass, hit.x, hit.y);
    game.particles.burst(hit.x, hit.y, 10, { dir: Math.atan2(hit.ny, hit.nx), spread: 1.2, sMin: 5, sMax: 25, color: '#ffd28a', zMin: 0.15, zMax: 0.35, lMin: 0.2, lMax: 0.5 });
    const d = { x: p.vx / (G.len(p.vx, p.vy) || 1), y: p.vy / (G.len(p.vx, p.vy) || 1) };
    const pow = p.pow || 1;
    if (o.kind === 'rock' && o.vox) {
      // Kuler bryr seg ikke om hardheten: de slår løs biter uansett.
      RF.Vox.blast(o, hit.x + d.x * 0.5, hit.y + d.y * 0.5, Math.min(9, 1.4 * Math.pow(pow, 0.7)), G.randInt(1, 2 + Math.floor(pow)), game, 3);
      game.laserDust(hit);
      if (!o.dead) {
        o.stress += 0.35 * pow;
        if (o.stress >= o.integrity) RF.Vox.crack(o, hit, d, game);
      }
    } else if (o.rubble) {
      RF.Vox.hitRubble(o, 0.9 * pow, 9, d, game, false);
      game.laserDust(hit);
    } else if (o.npc) {
      if (o.npc.T.hostile) o.npc.burn(p.dmg || 9 * pow, game, hit.x, hit.y);
      else o.npc.takeImpact(p.dmg ? 20 : 6 * pow, hit.x, hit.y, game);
    } else if (o.ship) {
      o.ship.takeImpact(0, hit.x, hit.y, game, p.dmg || 12 * pow);
    }
  }

  function hitHarpoon(p, hit, game) {
    const ship = p.ship, o = hit.body;
    if (o.kind === 'gate') { p.dead = true; ship.harpoon = null; game.msg('The hook bounces off the gate', RF.HUD_COLORS.amber); return; }
    const mp = ship.mountOf(p.mod);
    const la = { x: mp.lx, y: mp.ly };
    const a = ship.body.toWorld(la.x, la.y);
    const rope = { A: ship.body, la, B: o, lb: o.toLocal(hit.x, hit.y), length: G.len(hit.x - a.x, hit.y - a.y) + 0.5 };
    game.sys.world.ropes.push(rope);
    ship.anchor = { rope, module: p.mod, range: p.range, winch: p.winch };
    ship.harpoon = null;
    p.dead = true;
    game.particles.burst(hit.x, hit.y, 12, { sMin: 3, sMax: 12, color: '#ffd28a', zMin: 0.15, zMax: 0.3 });
    RF.Audio.thud(0.4, true);
    const what = o.kind === 'rock' || o.kind === 'ore' ? (o.comet ? 'the comet' : 'the rock') : o.kind === 'station' ? 'the station' : 'the target';
    game.msg(`Hook attached to ${what}. Winch in or tow`, RF.HUD_COLORS.ok);
  }

  W.update = (dt, game) => {
    const ws = game.sys.world;
    for (const p of W.list) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.type === 'flare') {
        // Fakler: glødende, varme biter som driver vekk og kjøles ned.
        p.heat -= dt * 0.55;
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (Math.random() < 0.7) game.particles.add({ type: 'glow', x: p.x, y: p.y, vx: p.vx * 0.6 + G.rand(-3, 3), vy: p.vy * 0.6 + G.rand(-3, 3), life: 0.5, size: 1.2, color: '#ffcf70' });
        if (p.life <= 0 || p.heat <= 0) p.dead = true;
        continue;
      }
      if (p.type === 'rocket') {
        if (p.seeker && RF.Combat) RF.Combat.guide(p, dt, game);
        else {
          const sp = G.len(p.vx, p.vy);
          if (sp < 140) { p.vx += p.dx * 60 * dt; p.vy += p.dy * 60 * dt; }
        }
        p.arm -= dt;
        if (p.fuse) { explode(p.x, p.y, game, p.pow); p.dead = true; continue; }
        if (Math.random() < 0.8) game.particles.add({ type: 'smoke', x: p.x, y: p.y, vx: -p.dx * 10 + G.rand(-2, 2), vy: -p.dy * 10 + G.rand(-2, 2), life: 1.2, size: 0.5, grow: 1.5, color: p.hostile ? '#9a6a5a' : '#8a8478' });
      }
      if (p.type === 'harpoon') {
        const mp0 = p.ship.mountOf(p.mod);
        const a = p.ship.body.toWorld(mp0.lx, mp0.ly);
        if (G.len(p.x - a.x, p.y - a.y) > p.range || p.life <= 0) {
          p.dead = true;
          p.ship.harpoon = null;
          game.msg('The hook missed', RF.HUD_COLORS.amber);
          continue;
        }
      }
      // Stasjonsskjoldet stopper skudd som kommer utenfra.
      const st = game.sys.station, SR = RF.Stations ? RF.Stations.shieldR(st) : 0;
      if (SR && p.type !== 'harpoon') {
        const ds = G.len(p.x - st.x, p.y - st.y);
        if (p.outside == null) p.outside = ds > SR;
        if (p.outside && ds < SR) {
          p.dead = true;
          const fx = st.shieldFx || (st.shieldFx = { hits: [], zaps: [], zapT: 0 });
          fx.hits.push({ a: Math.atan2(p.y - st.y, p.x - st.x), t: game.time, s: p.type === 'rocket' ? 1 : 0.5 });
          game.particles.burst(p.x, p.y, 8, { type: 'glow', sMin: 2, sMax: 10, color: '#8fd8ff', zMin: 0.2, zMax: 0.4, lMin: 0.2, lMax: 0.5 });
          continue;
        }
      }
      const sp = G.len(p.vx, p.vy);
      const step = sp * dt;
      if (step > 0) {
        // Kuler og raketter flyr forbi løse malmbiter (kroken kan fortsatt treffe dem).
        const ux = p.vx / sp, uy = p.vy / sp;
        const filt = (o) => o !== p.owner && !o.ghost && (o.kind !== 'ore' || p.type === 'harpoon') && !(p.skip && p.skip.includes(o));
        let hit = ws.raycast(p.x, p.y, ux, uy, step, filt);
        // Railkula går gjennom flere mål før den stopper.
        while (hit && p.pierce > 0 && p.type === 'shell') {
          hitShell(p, hit, game);
          p.pierce--;
          p.skip.push(hit.body);
          hit = ws.raycast(p.x, p.y, ux, uy, step, filt);
        }
        if (p.kind === 'rail') W.traces.push({ x0: p.x, y0: p.y, x1: hit ? hit.x : p.x + p.vx * dt, y1: hit ? hit.y : p.y + p.vy * dt, t: game.time, w: Math.sqrt(p.pow) });
        if (hit) {
          if (p.type === 'shell') { hitShell(p, hit, game); p.dead = true; continue; }
          if (p.type === 'rocket') { if (p.arm <= 0 || hit.body.kind !== 'ship') { explode(hit.x, hit.y, game, p.pow); p.dead = true; continue; } }
          if (p.type === 'harpoon') { hitHarpoon(p, hit, game); continue; }
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        if (p.type === 'rocket') explode(p.x, p.y, game, p.pow);
        p.dead = true;
      }
    }
    if (W.list.some((p) => p.dead)) W.list = W.list.filter((p) => !p.dead);
    W.traces = W.traces.filter((t) => game.time - t.t < 0.5);
    W.now = game.time;
  };

  W.draw = (ctx, px) => {
    ctx.globalCompositeOperation = 'lighter';
    // Sporet etter railkula: en lysende strek som blekner.
    for (const t of W.traces) {
      const k = 1 - (W.now - t.t) / 0.5;
      if (k <= 0) continue;
      ctx.strokeStyle = `rgba(150,230,255,${0.5 * k})`;
      ctx.lineWidth = Math.max(0.4, px * 5 * k) * t.w;
      ctx.beginPath(); ctx.moveTo(t.x0, t.y0); ctx.lineTo(t.x1, t.y1); ctx.stroke();
      ctx.strokeStyle = `rgba(235,250,255,${0.9 * k})`;
      ctx.lineWidth = Math.max(0.15, px * 1.6) * t.w;
      ctx.stroke();
    }
    for (const p of W.list) {
      if (p.type === 'flare') {
        const r = 1.6 + p.heat * 0.6;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2);
        g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(0.3, 'rgba(255,200,90,0.8)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'shell' && p.kind === 'rail') {
        ctx.fillStyle = 'rgba(230,250,255,1)';
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.3, px * 2.5), 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'shell') {
        // Piratkuler er røde og har lengre spor, så man ser dem komme.
        const tr = p.color ? 0.045 : p.kind === 'auto' || p.kind === 'pd' ? 0.03 : 0.02;
        ctx.strokeStyle = p.color ? `rgba(${p.color},0.95)` : 'rgba(255,220,150,0.9)';
        ctx.lineWidth = Math.max(0.2, px * (p.color ? 2.6 : p.kind === 'auto' || p.kind === 'pd' ? 1.3 : 2));
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * tr, p.y - p.vy * tr); ctx.stroke();
      } else if (p.type === 'rocket') {
        const a = Math.atan2(p.dy, p.dx);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = p.hostile ? '#8a5a4e' : '#c9c4b6';
        ctx.fillRect(-1.2, -0.3, 2.4, 0.6);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(0.8, -0.3, 0.5, 0.6);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(-1.4, 0, 0, -1.4, 0, 2.2);
        g.addColorStop(0, 'rgba(255,230,160,1)');
        g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(-1.4, 0, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (p.type === 'harpoon') {
        const mp1 = p.ship.mountOf(p.mod);
        const a = p.ship.body.toWorld(mp1.lx, mp1.ly);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = '#8f8878';
        ctx.lineWidth = Math.max(0.15, px);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#d8d2c0';
        ctx.beginPath(); ctx.arc(p.x, p.y, 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };
})();
