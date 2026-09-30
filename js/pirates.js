// Pirater: når spilleren har verdifull last og er et stykke fra stasjonen,
// kan en gruppe raidere og stikkerdroner dukke opp. Jo mer lasten er verdt,
// og jo farligere systemet er, jo større sjanse. Nær stasjonen er man trygg.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const P = (RF.Pirates = {});

  const CHECK = 15; // sekunder mellom hver sjekk
  const SAFE = 600; // avstand fra stasjonen der de ikke angriper
  const COOLDOWN = 150; // pause etter et angrep
  // Hvor farlig hvert system er (0–1).
  const DANGER = { midgard: 0.35, vanaheim: 0.6, muspel: 1 };

  P.danger = (sys) => (sys.def.danger != null ? sys.def.danger : DANGER[sys.def.id] != null ? DANGER[sys.def.id] : 0.5);
  P.dangerText = (def) => {
    const d = def.danger != null ? def.danger : DANGER[def.id] != null ? DANGER[def.id] : 0.5;
    return d < 0.45 ? 'Low' : d < 0.8 ? 'Medium' : 'High';
  };

  // Hva lasten om bord er verdt (varer i lasterommet og malm som prosesseres).
  P.cargoValue = (game) => {
    const ship = game.ship, st = game.sys.def.station.id;
    let v = 0;
    for (const k in ship.s.cargo) if (ship.s.cargo[k] > 0 && RF.PRODUCTS[k]) v += ship.s.cargo[k] * game.sellPrice(st, k);
    for (const p of ship.processing) {
      const M = RF.MATERIALS[p.mat];
      if (M && RF.PRODUCTS[M.product]) v += (p.mass / 1000) * M.grade * game.sellPrice(st, M.product);
    }
    return v;
  };

  P.active = (game) => game.sys.npcs.filter((n) => n.T.hostile && n.active && !n.dead);

  P.reset = () => { P.t = 0; P.last = -1e9; };
  P.reset();

  P.update = (dt, game) => {
    const ship = game.ship, sb = ship.body, sys = game.sys;
    if (ship.docked || game.dead) return;
    P.t += dt;
    if (P.t < CHECK) return;
    P.t = 0;
    if (P.active(game).length || game.time - P.last < COOLDOWN) return;
    if (G.len(sb.x - sys.station.x, sb.y - sys.station.y) < SAFE) return;
    const value = P.cargoValue(game);
    if (value < 2000) return;
    const chance = P.danger(sys) * G.clamp((value - 2000) / 25000, 0.08, 1) * 0.45;
    if (Math.random() < chance) P.spawn(game, value);
  };

  // En gruppe dukker opp et stykke unna, fra motsatt side av stasjonen.
  P.spawn = (game, value = 10000) => {
    const sys = game.sys, sb = game.ship.body, st = sys.station;
    const away = Math.atan2(sb.y - st.y, sb.x - st.x) + G.rand(-1.1, 1.1);
    const x0 = sb.x + Math.cos(away) * 850, y0 = sb.y + Math.sin(away) * 850;
    const big = value > 15000 || P.danger(sys) > 0.8;
    const group = big ? ['raider', 'stinger', 'stinger'] : Math.random() < 0.5 ? ['raider'] : ['stinger', 'stinger'];
    group.forEach((type, i) => {
      const n = new RF.NPC(type, sys);
      n.index = i;
      n.state = 'attack';
      n.timer = 0;
      const a = away + (i - 1) * 0.25;
      const x = x0 + Math.cos(a + Math.PI / 2) * i * 30, y = y0 + Math.sin(a + Math.PI / 2) * i * 30;
      const toward = Math.atan2(sb.y - y, sb.x - x);
      n.spawnAt(x, y, toward, sb.vx + Math.cos(toward) * 22, sb.vy + Math.sin(toward) * 22);
      sys.npcs.push(n);
    });
    P.last = game.time;
    game.msg(`Warning: ${group.length > 1 ? 'raiders' : 'a raider'} inbound! They are after your cargo`, RF.HUD_COLORS.danger);
    game.msg('Fight back, or run for the station', RF.HUD_COLORS.amber);
    RF.Audio.alarm();
  };
})();
