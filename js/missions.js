// Oppdrag: frakt (last fra A til B, noen ganger skjør), levering av råvarer,
// passasjerer (fra stasjon til stasjon, eller hentes på en annen stasjon) og
// mannskapsbytte ut til et frakteskip (bare med en skyttel-drone).
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  const GOODS = [
    { name: 'Medical supplies', fragile: 0.7 },
    { name: 'Spare parts', fragile: 0.1 },
    { name: 'Research samples', fragile: 0.8 },
    { name: 'Hydroponics modules', fragile: 0.4 },
    { name: 'Mail and parcels', fragile: 0.2 },
    { name: 'Reactor rods', fragile: 0.9, bonus: 1.4 },
    { name: 'Cryo-stored embryos', fragile: 1, bonus: 1.6 },
  ];

  let nextId = 1;

  RF.stationName = (id) => RF.stationById(id).station.name;

  // haulers: navnene på frakteskipene i systemet (til mannskapsbytte).
  RF.genMission = (fromId, haulers = []) => {
    const others = RF.SYSTEMS.filter((s) => s.station.id !== fromId).map((s) => s.station.id);
    const risky = (id) => (id === 'muspel' ? 1.45 : 1);
    const r = Math.random();
    if (r < 0.2) {
      // Passasjerer herfra til en annen stasjon.
      const to = G.pick(others);
      const n = G.pick([2, 3, 4, 6, 8, 12, 20, 30, 40]);
      const reward = Math.round(((150 + n * 70) * risky(to)) / 10) * 10;
      return { id: nextId++, type: 'pax', from: fromId, to, n, wait: n, aboard: 0, moved: 0, reward, status: 'tilbud' };
    }
    if (r < 0.28) {
      // Passasjerer som venter på en annen stasjon og skal hit.
      const from = G.pick(others);
      const n = G.pick([2, 4, 6, 10, 16]);
      const reward = Math.round(((260 + n * 95) * risky(from)) / 10) * 10;
      return { id: nextId++, type: 'pax', from, to: fromId, n, wait: n, aboard: 0, moved: 0, reward, status: 'tilbud', pickup: true };
    }
    if (r < 0.36 && haulers.length) {
      const n = G.randInt(2, 6);
      const reward = Math.round((350 + n * 110) / 10) * 10;
      return { id: nextId++, type: 'crew', from: fromId, to: fromId, ship: G.pick(haulers), n, wait: n, aboard: 0, moved: 0, reward, status: 'tilbud' };
    }
    if (r < 0.7) {
      const g = G.pick(GOODS);
      const to = G.pick(others);
      const mass = G.randInt(2, 8);
      const fragile = Math.random() < g.fragile;
      const maxDv = fragile ? G.pick([3, 4, 5]) : 0;
      let reward = (260 + mass * 48) * risky(to) * risky(fromId) * (g.bonus || 1) * (fragile ? 1.4 + (5 - maxDv) * 0.15 : 1);
      reward = Math.round(reward / 10) * 10;
      return { id: nextId++, type: 'frakt', from: fromId, to, goods: g.name, mass, fragile, maxDv, reward, status: 'tilbud' };
    }
    const prod = G.weighted({ jern: 0.2, silisium: 0.14, grafitt: 0.1, vann: 0.15, nikkel: 0.15, kobber: 0.12, titan: 0.08, gull: 0.03, naquadah: 0.03 });
    const price = RF.PRODUCTS[prod].price;
    const amount = price > 1000 ? G.pick([0.5, 1, 1.5]) : price > 300 ? G.randInt(1, 3) : G.randInt(3, 9);
    const to = Math.random() < 0.6 ? fromId : G.pick(others);
    const P = RF.PRODUCTS[prod];
    const reward = Math.round((P.price * amount * 1.7 * risky(to) + 120) / 10) * 10;
    return { id: nextId++, type: 'levering', from: fromId, to, product: prod, amount, reward, status: 'tilbud' };
  };

  RF.missionTitle = (m) => {
    if (m.type === 'frakt') return `Haul ${m.mass} t of ${m.goods.toLowerCase()}`;
    if (m.type === 'pax') return m.pickup ? `Pick up ${m.n} passengers at ${RF.stationName(m.from)}` : `Fly ${m.n} passengers`;
    if (m.type === 'crew') return `Crew change: ${m.n} crew to the ${m.ship}`;
    return `Deliver ${m.amount} t of ${RF.PRODUCTS[m.product].name.toLowerCase()}`;
  };

  RF.missionShort = (m) => (m.type === 'crew' ? RF.missionTitle(m) : `${RF.missionTitle(m)} → ${RF.stationName(m.to)}`);

  RF.missionDetail = (m) => {
    const to = RF.stationById(m.to);
    const where = `${to.station.name} (${to.name})`;
    if (m.type === 'pax') {
      const from = RF.stationById(m.from);
      const state = m.status === 'aktiv' ? ` Waiting: ${m.wait} · aboard: ${m.aboard} · delivered: ${m.moved}.` : '';
      if (m.wait > 0 && m.from !== m.to && (m.pickup || m.status !== 'aktiv'))
        return `They wait at ${from.station.name} (${from.name}). They board when you dock there, or a shuttle drone can fetch them. Then bring them to ${where}.${state}`;
      return `They leave the ship when you dock at ${where}, or when a shuttle drone flies them over.${state}`;
    }
    if (m.type === 'crew') {
      return `The crew board now. The ${m.ship} flies around ${RF.stationById(m.from).name}. Only a crew shuttle drone can take them over: fly close and launch it.${m.status === 'aktiv' ? ` Aboard: ${m.aboard} · delivered: ${m.moved}.` : ''}`;
    }
    if (m.type === 'frakt') {
      let s = `Loaded now, delivered automatically when you dock at ${where}.`;
      if (m.fragile) s += ` Fragile cargo: a single impact above ${m.maxDv} m/s destroys it.`;
      return s;
    }
    return `Mine and process it yourself, or buy it cheap elsewhere. Deliver at ${where}.`;
  };

  RF.setMissionIdBase = (n) => { nextId = Math.max(nextId, n + 1); };
})();
