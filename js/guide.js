// Veileder for nye spillere: én oppgave om gangen i et lite kort under
// skippanelet, med en pil i skjermkanten mot målet. Stegene følger det
// grunnleggende i spillet: ut av stasjonen, til steinene, skjær løs en bit,
// samle malmen og selg den. Kan slås av i pausemenyen.
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const Gd = (RF.Guide = {});

  // Tekstene finnes i to utgaver: for tastatur og for berøring.
  const STEPS = [
    { id: 'undock', title: 'Leave the station',
      pc: 'Press UNDOCK at the bottom of the station screen.', touch: 'Tap UNDOCK at the bottom of the station screen.' },
    { id: 'fly', title: 'Fly to the asteroids',
      pc: 'Follow the yellow ASTEROIDS arrow. W = thrust, A/D = turn, S = brake. Or click next to a rock and the autopilot flies there.',
      touch: 'Follow the yellow ASTEROIDS arrow. Push the stick to fly, or tap next to a rock and the autopilot flies there.' },
    { id: 'cut', title: 'Cut a piece loose',
      pc: 'Hold the mouse on a rock (or aim and hold Space). Keep the laser on one line until it cuts through.',
      touch: 'Press and hold on a rock. Keep the laser on one line until it cuts through.' },
    { id: 'collect', title: 'Collect the ore',
      pc: 'Press F to open the scoop and fly slowly into the loose pieces.',
      touch: 'Tap COLLECT to open the scoop and fly slowly into the loose pieces.' },
    { id: 'sell', title: 'Sell it at the station',
      pc: 'Follow the green arrow home, fly into the ring at the docking arm and press T. Then sell under Market.',
      touch: 'Follow the green arrow home, fly into the ring at the docking arm and tap DOCK. Then sell under Market.' },
  ];
  Gd.STEPS = STEPS;

  const st = () => RF.game.guide;
  Gd.active = () => { const g = st(); return !!(g && g.on && g.step < STEPS.length); };
  Gd.current = () => (Gd.active() ? STEPS[st().step] : null);
  Gd.start = (game) => { game.guide = { on: true, step: 0, t: 0 }; };
  Gd.toggle = (game) => {
    if (!game.guide) Gd.start(game);
    else game.guide.on = !game.guide.on;
    if (game.guide.on && game.guide.step >= STEPS.length) game.guide.step = 0;
  };

  function next(game) {
    const g = game.guide;
    g.step++;
    g.t = 0;
    RF.Audio.blip(780, 0.08, 'triangle', 0.08);
    setTimeout(() => RF.Audio.blip(1170, 0.12, 'triangle', 0.07), 90);
    if (g.step >= STEPS.length) game.msg('Well done! Next: better gear in Equipment, contracts, and the scanner (N)', RF.HUD_COLORS.ok);
    game.save();
  }

  // Hendelser fra spillet (en bit er skåret løs, malm er solgt).
  Gd.event = (game, what) => {
    const s = Gd.current();
    if (!s) return;
    if ((s.id === 'cut' && what === 'cut') || (s.id === 'sell' && what === 'sold')) next(game);
  };

  // Nærmeste asteroidefelt (midten av feltet).
  function nearestField(game) {
    const sb = game.ship.body;
    let best = null, bd = Infinity;
    for (const f of game.sys.def.fields) {
      const d = G.len(f.cx - sb.x, f.cy - sb.y);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  Gd.update = (dt, game) => {
    const s = Gd.current();
    if (!s) return;
    const g = game.guide, ship = game.ship, sb = ship.body;
    g.t += dt;
    if (s.id === 'undock' && !ship.docked) next(game);
    else if (s.id === 'fly') {
      // Framme når en stor nok stein er nær.
      const near = game.sys.world.bodies.some((o) => o.kind === 'rock' && o.radius > 5 && G.len(o.x - sb.x, o.y - sb.y) < o.radius + sb.radius + 90);
      if (near) next(game);
    } else if (s.id === 'collect') {
      if (RF.cargoMass(ship.s) > 0.01 || ship.processing.length) next(game);
    } else if (s.id === 'cut') {
      // Har man allerede malm om bord, er man forbi dette steget.
      if (RF.cargoMass(ship.s) > 0.01) { g.step++; next(game); }
    }
  };

  // Målet for steget: brukes til en pil i skjermkanten.
  Gd.target = (game) => {
    const s = Gd.current();
    if (!s || game.ship.docked) return null;
    if (s.id === 'fly') { const f = nearestField(game); return f && { x: f.cx, y: f.cy, label: 'Asteroids', color: '#e3a03a' }; }
    return null;
  };

  // Kortet under skippanelet.
  Gd.draw = (ctx, R, game, x, y, wMax) => {
    const s = Gd.current();
    if (!s || game.ship.docked || game.dead) return 0;
    const text = game.touchUI ? s.touch : s.pc;
    const W = Math.min(wMax, 300);
    ctx.font = '400 12px "Saira Condensed", "Arial Narrow", sans-serif';
    // Bryt teksten i linjer.
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > W - 20 && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const H = 26 + lines.length * 14;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 3);
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.guide.t * 3);
    ctx.fillStyle = 'rgba(12,11,9,0.82)';
    ctx.fillRect(x, y, W, H);
    ctx.fillStyle = `rgba(227,160,58,${0.7 + 0.3 * pulse})`;
    ctx.fillRect(x, y, 3, H);
    ctx.font = '700 10px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = '#e3a03a';
    ctx.fillText(`NEXT STEP ${game.guide.step + 1}/${STEPS.length}`, x + 10, y + 13);
    ctx.font = '700 13px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = '#e6dfcd';
    ctx.textAlign = 'right';
    ctx.fillText(s.title.toUpperCase(), x + W - 8, y + 13);
    ctx.textAlign = 'left';
    ctx.font = '400 12px "Saira Condensed", "Arial Narrow", sans-serif';
    ctx.fillStyle = '#cfc7b3';
    lines.forEach((l, i) => ctx.fillText(l, x + 10, y + 30 + i * 14));
    ctx.restore();
    return H;
  };

  // Hvilken knapp som bør blinke (på mobil og i verktøylinja på PC).
  Gd.highlight = (game) => {
    const s = Gd.current();
    if (!s || game.ship.docked) return null;
    if (s.id === 'collect') return game.ship.stats.tractors.length ? 'collect' : 'scoop';
    return null;
  };

  // Kort tekst øverst i stasjonsmenyen.
  Gd.stationTip = (game) => {
    const s = Gd.current();
    if (!s) return '';
    if (s.id === 'undock') return 'New here? Tap <b>Undock</b> below and fly out to the asteroids. Mine, collect the ore and sell it back here.';
    if (s.id === 'sell') return RF.cargoMass(game.ship.s) > 0.01 ? 'Sell your ore: tap <b>Sell the whole cargo</b> under Market.' : '';
    return '';
  };
})();
