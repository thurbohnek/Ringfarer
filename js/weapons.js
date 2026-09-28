// Prosjektiler: kanonkuler, raketter og ankerkroken. De flyr med egen fart og
// treffer det første de krysser (stråle-test langs banen hvert steg).
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;
  const CELL = RF.CELL;

  const W = (RF.Weapons = { list: [] });

  W.reset = () => { W.list = []; };

  // Tuppen av tårnet og retningen det sikter.
  function launchFrom(ship, m) {
    const { p, d } = ship.muzzle(m, CELL * 1.1);
    const v = ship.body.pointVel(p.x, p.y);
    return { p, d, v };
  }

  // Kanon: hver massedriver skyter et tungt prosjektil. Rekylen dytter skipet.
  W.fireGuns = (ship, game) => {
    const st = ship.stats;
    if (!st.guns.length || ship.gunCd > 0) return;
    ship.gunCd = 1 / st.guns[0].rate;
    for (const g of st.guns) {
      if (!g.m.onTarget) continue;
      const { p, d, v } = launchFrom(ship, g.m);
      W.list.push({ type: 'shell', x: p.x, y: p.y, vx: v.x + d.x * g.speed, vy: v.y + d.y * g.speed, mass: g.mass, life: 1.2, owner: ship.body });
      ship.body.applyImpulse(-d.x * g.mass * g.speed, -d.y * g.mass * g.speed, p.x, p.y);
      game.particles.burst(p.x, p.y, 6, { type: 'glow', dir: Math.atan2(d.y, d.x), spread: 0.4, sMin: 10, sMax: 40, color: '#ffd28a', zMin: 0.2, zMax: 0.4, lMin: 0.05, lMax: 0.15, vx: v.x, vy: v.y });
    }
    RF.Audio.thud(0.25, true);
  };

  W.fireRocket = (ship, game) => {
    const st = ship.stats;
    if (!st.rockets.length) { game.msg('Skipet har ingen rakettkaster', RF.HUD_COLORS.amber); return; }
    if (ship.rocketCd > 0) return;
    if ((ship.s.ammo || 0) <= 0) { game.msg('Tomt for raketter. Fyll på ved en stasjon', RF.HUD_COLORS.amber); return; }
    ship.rocketCd = 0.6;
    ship.s.ammo--;
    const ready = st.rockets.filter((r) => r.m.onTarget);
    if (!ready.length) { ship.s.ammo++; game.msg('Siktepunktet er utenfor rakettkasterens sektor', RF.HUD_COLORS.amber); return; }
    const L = ready[ship.s.ammo % ready.length];
    const { p, d, v } = launchFrom(ship, L.m);
    W.list.push({ type: 'rocket', x: p.x, y: p.y, vx: v.x + d.x * 25, vy: v.y + d.y * 25, dx: d.x, dy: d.y, life: 7, owner: ship.body, arm: 0.25 });
    RF.Audio.thud(0.35, true);
  };

  // Ankerkrok: skytes ut på en wire. Fester seg i det den treffer.
  W.fireHarpoon = (ship, game) => {
    if (ship.anchor || ship.harpoon) { ship.releaseAnchor(game); return; }
    const st = ship.stats;
    if (!st.anchors.length) { game.msg('Skipet har ingen ankerkaster', RF.HUD_COLORS.amber); return; }
    const inArc = st.anchors.filter((a) => a.m.onTarget);
    if (!inArc.length) { game.msg('Siktepunktet er utenfor ankerkasterens sektor', RF.HUD_COLORS.amber); return; }
    const A = inArc.reduce((a, b) => (b.range > a.range ? b : a));
    const { p, d, v } = launchFrom(ship, A.m);
    const h = { type: 'harpoon', x: p.x, y: p.y, vx: v.x + d.x * 70, vy: v.y + d.y * 70, life: 10, owner: ship.body, ship, mod: A.m, range: A.range, winch: A.winch };
    ship.harpoon = h;
    W.list.push(h);
    RF.Audio.blip(140, 0.12, 'square', 0.1);
  };

  function explode(x, y, game, owner) {
    const R = 22;
    const ws = game.sys.world;
    for (const o of ws.bodies.slice()) {
      if (o.dead || o.isStatic) continue;
      const dx = o.x - x, dy = o.y - y;
      const d = Math.max(0.5, G.len(dx, dy) - o.radius * 0.5);
      if (d > R) continue;
      const k = 1 - d / R;
      const J = 5e5 * k;
      const ux = dx / (G.len(dx, dy) || 1), uy = dy / (G.len(dx, dy) || 1);
      o.applyImpulse(ux * J, uy * J, o.x - ux * o.radius * 0.3, o.y - uy * o.radius * 0.3);
      if (o.kind === 'rock') {
        const hit = { x: o.x - ux * o.radius * 0.6, y: o.y - uy * o.radius * 0.6, nx: -ux, ny: -uy, body: o };
        if (o.area < 900 || k > 0.6) game.crackRock(o, hit, { x: ux, y: uy });
        else for (let i = 0; i < 3; i++) if (!o.dead && o.kind === 'rock') game.chipRock(o, hit, { x: ux, y: uy });
      } else if (o.ship) {
        o.ship.takeImpact(0, x, y, game, 90 * k);
      } else if (o.npc) {
        o.npc.takeImpact(12 * k + 3, x, y, game);
      }
    }
    game.particles.burst(x, y, 60, { type: 'glow', sMin: 5, sMax: 40, color: '#ffb050', zMin: 0.3, zMax: 0.9, lMin: 0.3, lMax: 0.9 });
    game.particles.burst(x, y, 40, { sMin: 10, sMax: 60, color: '#ffe0a0', zMin: 0.2, zMax: 0.5, lMin: 0.3, lMax: 0.8 });
    game.particles.burst(x, y, 30, { type: 'smoke', sMin: 2, sMax: 10, color: '#6a645a', zMin: 2, zMax: 4, grow: 5, lMin: 1.5, lMax: 3.5 });
    RF.Audio.thud(1);
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
    if (o.kind === 'rock') {
      // Kuler bryr seg ikke om hardheten: de slår løs biter uansett.
      o.stress += 0.35;
      if (o.stress >= o.integrity) game.crackRock(o, hit, d);
      else if (Math.random() < 0.55) game.chipRock(o, hit, d);
      else game.laserDust(hit);
    } else if (o.npc) {
      o.npc.takeImpact(6, hit.x, hit.y, game);
    } else if (o.ship) {
      o.ship.takeImpact(0, hit.x, hit.y, game, 12);
    }
  }

  function hitHarpoon(p, hit, game) {
    const ship = p.ship, o = hit.body;
    if (o.kind === 'gate') { p.dead = true; ship.harpoon = null; game.msg('Kroken preller av porten', RF.HUD_COLORS.amber); return; }
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
    const what = o.kind === 'rock' || o.kind === 'ore' ? (o.comet ? 'kometen' : 'steinen') : o.kind === 'station' ? 'stasjonen' : 'målet';
    game.msg(`Kroken sitter i ${what}. Vinsj inn eller slep`, RF.HUD_COLORS.ok);
  }

  W.update = (dt, game) => {
    const ws = game.sys.world;
    for (const p of W.list) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.type === 'rocket') {
        const sp = G.len(p.vx, p.vy);
        if (sp < 140) { p.vx += p.dx * 60 * dt; p.vy += p.dy * 60 * dt; }
        p.arm -= dt;
        if (Math.random() < 0.8) game.particles.add({ type: 'smoke', x: p.x, y: p.y, vx: -p.dx * 10 + G.rand(-2, 2), vy: -p.dy * 10 + G.rand(-2, 2), life: 1.2, size: 0.5, grow: 1.5, color: '#8a8478' });
      }
      if (p.type === 'harpoon') {
        const mp0 = p.ship.mountOf(p.mod);
        const a = p.ship.body.toWorld(mp0.lx, mp0.ly);
        if (G.len(p.x - a.x, p.y - a.y) > p.range || p.life <= 0) {
          p.dead = true;
          p.ship.harpoon = null;
          game.msg('Kroken bommet', RF.HUD_COLORS.amber);
          continue;
        }
      }
      const sp = G.len(p.vx, p.vy);
      const step = sp * dt;
      if (step > 0) {
        const hit = ws.raycast(p.x, p.y, p.vx / sp, p.vy / sp, step, (o) => o !== p.owner && !o.ghost);
        if (hit) {
          if (p.type === 'shell') { hitShell(p, hit, game); p.dead = true; continue; }
          if (p.type === 'rocket') { if (p.arm <= 0 || hit.body.kind !== 'ship') { explode(hit.x, hit.y, game); p.dead = true; continue; } }
          if (p.type === 'harpoon') { hitHarpoon(p, hit, game); continue; }
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) {
        if (p.type === 'rocket') explode(p.x, p.y, game);
        p.dead = true;
      }
    }
    if (W.list.some((p) => p.dead)) W.list = W.list.filter((p) => !p.dead);
  };

  W.draw = (ctx, px) => {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of W.list) {
      if (p.type === 'shell') {
        ctx.strokeStyle = 'rgba(255,220,150,0.9)';
        ctx.lineWidth = Math.max(0.3, px * 2);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.stroke();
      } else if (p.type === 'rocket') {
        const a = Math.atan2(p.dy, p.dx);
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#c9c4b6';
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
