// Stasjoner som vokser: hver stasjon får erfaring (XP) av handelen spilleren
// gjør der (salg, kjøp, fullførte oppdrag) og av penger spilleren investerer
// direkte. Nye nivåer gir bedre priser, billigere service, et sterkere skjold
// og nye deler på stasjonen (boligmoduler, ring, forsvarstårn, større
// solpaneler).
(function () {
  'use strict';
  const RF = window.RF, G = RF.G;
  const S = (RF.Stations = {});

  // XP som trengs for hvert nivå (nivå 1 er utgangspunktet).
  S.LEVELS = [0, 20000, 60000, 150000, 350000];
  S.MAX = S.LEVELS.length;
  S.NAMES = ['Outpost', 'Station', 'Hub', 'Port', 'Citadel'];

  // Hva hvert nivå gir (vises i stasjonsfanen).
  S.PERKS = [
    'Basic services',
    'Habitat pods. Prices 2 % better, service 5 % cheaper, shield 270 m',
    'Rotating hab ring. Prices 4 % better, service 10 % cheaper, shield 300 m',
    'Defense turrets on the pods. Faster point defense. Prices 6 % better, service 15 % cheaper, shield 330 m',
    'Extended solar wings and beacon. Prices 8 % better, service 20 % cheaper, shield 360 m',
  ];

  const game = () => RF.game;
  S.xp = (id) => (game().stationXP && game().stationXP[id]) || 0;
  S.level = (id) => {
    const x = S.xp(id);
    let L = 1;
    for (let i = 1; i < S.LEVELS.length; i++) if (x >= S.LEVELS[i]) L = i + 1;
    return L;
  };
  // Hvor langt mot neste nivå (0–1), og hvor mye som mangler.
  S.progress = (id) => {
    const L = S.level(id), x = S.xp(id);
    if (L >= S.MAX) return { f: 1, need: 0 };
    const a = S.LEVELS[L - 1], b = S.LEVELS[L];
    return { f: (x - a) / (b - a), need: Math.ceil(b - x) };
  };

  S.priceMul = (id) => 1 + 0.02 * (S.level(id) - 1);
  S.serviceMul = (id) => 1 - 0.05 * (S.level(id) - 1);
  S.shieldR = (st) => 240 + 30 * (S.level(st.id) - 1);
  S.zapCd = (st) => (S.level(st.id) >= 4 ? 0.12 : 0.25);

  // Handel og oppdrag gir stasjonen XP. Ved nytt nivå: melding og nye deler.
  S.gain = (id, cr) => {
    const g = game();
    if (!(cr > 0)) return;
    g.stationXP = g.stationXP || {};
    const before = S.level(id);
    g.stationXP[id] = S.xp(id) + cr;
    const after = S.level(id);
    if (after > before) {
      const def = RF.stationById(id);
      g.msg(`${def.station.name} grew to level ${after}: ${S.NAMES[after - 1]}!`, RF.HUD_COLORS.ok);
      RF.Audio.blip(660, 0.15, 'triangle', 0.12);
      setTimeout(() => RF.Audio.blip(990, 0.25, 'triangle', 0.1), 150);
      const sys = g.systems && g.systems[def.id];
      if (sys) S.sync(sys);
    }
  };

  // Kollisjonslegemer for delene som kommer med nivåene. Legges til (og
  // fjernes) i fysikkverdenen når nivået endres.
  S.sync = (sys) => {
    const st = sys.station, L = S.level(st.id);
    if (st._lvl === L) return;
    st._lvl = L;
    const ws = sys.world;
    const old = st.extra || [];
    for (const b of old) b.dead = true;
    ws.bodies = ws.bodies.filter((b) => !old.includes(b));
    st.bodies = st.bodies.filter((b) => !old.includes(b));
    st.extra = [];
    const parts = [];
    if (L >= 2) for (const [x, y] of S.podPos()) parts.push(G.regular(11, 8, Math.PI / 8).map((p) => ({ x: p.x + x, y: p.y + y })));
    if (L >= 5) { parts.push(G.box(-40, 110, 40, 140)); parts.push(G.box(-40, -140, 40, -110)); }
    for (const v of parts) {
      const b = new RF.Body(v, 0, { x: st.x, y: st.y, a: st.a, kind: 'station', restitution: 0.3, friction: 0.7 });
      st.extra.push(b);
      st.bodies.push(b);
      ws.add(b);
    }
  };
  // Boligmodulene står på skrå, unna dokkingsarmen og lasteporten.
  S.podPos = () => [[62, 62], [-62, 62], [-62, -62], [62, -62]];

  // Delene tegnes i stasjonens egne koordinater (kalles fra drawStation).
  S.drawExtras = (ctx, st, game, px, under) => {
    const L = S.level(st.id), t = game.time;
    if (L < 2) return;
    if (under) {
      // Ring rundt navet (nivå 3), roterer sakte.
      if (L >= 3) {
        ctx.save();
        ctx.rotate(-t * 0.08);
        ctx.strokeStyle = '#4a463e'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#2a2722'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 53, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 47, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          ctx.fillStyle = i % 2 ? '#ffd9a0' : '#9fd8ff';
          ctx.globalAlpha = 0.7;
          ctx.fillRect(Math.cos(a) * 50 - 0.8, Math.sin(a) * 50 - 0.8, 1.6, 1.6);
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      // Forlengede solpaneler (nivå 5).
      if (L >= 5) {
        for (const s of [-1, 1]) {
          const y0 = s > 0 ? 112 : -140;
          ctx.fillStyle = '#10161f';
          ctx.fillRect(-40, y0, 80, 28);
          ctx.strokeStyle = '#2d4460'; ctx.lineWidth = Math.max(0.25, px);
          for (let x = -40; x <= 40; x += 8) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + 28); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(-40, y0 + 14); ctx.lineTo(40, y0 + 14); ctx.stroke();
          ctx.fillStyle = '#4e4a41'; ctx.fillRect(-3, y0, 6, 28);
          ctx.strokeStyle = '#1a1814'; ctx.lineWidth = Math.max(0.4, px * 1.5);
          ctx.strokeRect(-40, y0, 80, 28);
        }
      }
      // Stag fra navet ut til boligmodulene.
      ctx.strokeStyle = '#3e3a33'; ctx.lineWidth = 5;
      for (const [x, y] of S.podPos()) { ctx.beginPath(); ctx.moveTo(x * 0.45, y * 0.45); ctx.lineTo(x, y); ctx.stroke(); }
      return;
    }
    // Boligmoduler med vinduer, og forsvarstårn fra nivå 4.
    for (const [x, y] of S.podPos()) {
      ctx.save();
      ctx.translate(x, y);
      const pod = G.regular(11, 8, Math.PI / 8);
      ctx.beginPath(); pod.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
      const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 12);
      g.addColorStop(0, '#a8a296'); g.addColorStop(1, '#4a463e');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#141310'; ctx.lineWidth = Math.max(0.4, px * 1.5); ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        ctx.fillStyle = (i + Math.floor(t * 0.3 + x)) % 4 ? '#ffd9a0' : '#3a3630';
        ctx.fillRect(Math.cos(a) * 7.5 - 0.7, Math.sin(a) * 7.5 - 0.7, 1.4, 1.4);
      }
      if (L >= 4) {
        // Tårnet sikter mot det nærforsvaret sist skjøt på, ellers sakte rundt.
        const fx = st.shieldFx, z = fx && fx.zaps && fx.zaps[fx.zaps.length - 1];
        let a = t * 0.4 + x;
        if (z) {
          const cs = Math.cos(-st.a), sn = Math.sin(-st.a), dx = z.x - st.x, dy = z.y - st.y;
          a = Math.atan2(dx * sn + dy * cs - y, dx * cs - dy * sn - x);
        }
        ctx.fillStyle = '#2a2722';
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.rotate(a);
        ctx.fillStyle = '#6a655a'; ctx.fillRect(0, -1, 8, 2);
        ctx.fillStyle = '#e2553d'; ctx.fillRect(7, -0.6, 1.4, 1.2);
      }
      ctx.restore();
    }
    // Fyr på toppen av navet (nivå 5).
    if (L >= 5) {
      const on = Math.sin(t * 3) > 0.6;
      ctx.fillStyle = on ? 'rgba(255,90,70,0.95)' : 'rgba(120,40,30,0.8)';
      ctx.beginPath(); ctx.arc(0, -16, 2, 0, Math.PI * 2); ctx.fill();
    }
  };
})();
