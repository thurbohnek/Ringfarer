// Nyheter for spillerne: et kort sammendrag av hver oppdatering, på engelsk.
// Vises på tittelskjermen første gang spillet startes etter en oppdatering.
// Nyeste først. v må være lik første del av RF_VERSION i index.html.
//
// I tillegg sjekker spillet i bakgrunnen om en nyere versjon er lagt ut, og
// viser da et lite varsel i hjørnet (se RF.checkForUpdate).
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});

  RF.NEWS = [
    {
      v: 'v0.13.0', date: '2026-09-30', title: 'Light, gates and calmer drones',
      items: [
        'New lighting: the sun lights everything and rocks cast shadows away from it. Lamps add light, so overlapping beams look natural, and the beams have soft edges.',
        'Every system has a capital gate far from the station, big enough for battlecruisers. Ships too wide for the small gate are told so.',
        'Flying through a gate looks right: the part of the ship that has gone through disappears into the event horizon.',
        'Drones fit their bays, all have a small headlight and fly calmly instead of spinning around.',
        'Dust drifts in space and streaks past when you fly fast, so you can see that you are moving.',
        'Small loose rocks are round, lumpy stones instead of squares, and lasers, cannons and rockets can break them. Minerals become ore, plain rock turns to dust in the laser.',
      ],
    },
    {
      v: 'v0.12.0', date: '2026-09-30', title: 'Ships at their real size',
      items: [
        'Ships now have real sizes: fighters 10 to 30 m, frigates about 110 m, destroyers 300 m and the battlecruiser 800 m.',
        'Big ships are heavy and slow to turn. A battlecruiser needs about a minute to turn around.',
        'New big weapons and gear that take 2×2 or 3×3 slots: heavy mass driver, siege driver, missile battery, lance, capital engine and more.',
        'Big ships hold position next to the station instead of using the docking arm.',
      ],
    },
    {
      v: 'v0.11.0', date: '2026-09-29', title: 'Drones and passengers',
      items: [
        'Drones come in three sizes. Small ones live in drone bays, medium ones in hangar decks and large ones on docking clamps outside the hull.',
        'Bay doors open and close. Drones fly out, and dock back in when you call them home.',
        'New drones: collector, guard, heavy miner, cargo drone and crew shuttles.',
        'Passenger contracts, and crew changes out to freighters that only a shuttle drone can reach.',
        'A note like this one after every update, and a small notice when a new version is ready.',
      ],
    },
    {
      v: 'v0.10.0', date: '2026-09-29', title: 'Ship classes',
      items: [
        '28 ships in six lines: personnel, freight, mining, drones, fighters and warships.',
        'Each line has a bonus, and the shape of the ship gives extra advantages.',
        'Any ship can be bought as long as you can afford it.',
      ],
    },
    {
      v: 'v0.9.6', date: '2026-09-29', title: 'Cleaner mining',
      items: [
        'The laser vaporizes loose bits of plain rock. Minerals still come loose as ore.',
        'Ore can bump the ship without pushing it, and the shield pushes small rocks away.',
      ],
    },
  ];

  // Nyheter spilleren ikke har sett ennå (maks tre versjoner).
  RF.unseenNews = (seen) => {
    if (!seen) return RF.NEWS.slice(0, 1);
    const i = RF.NEWS.findIndex((n) => n.v === seen);
    return (i < 0 ? RF.NEWS : RF.NEWS.slice(0, i)).slice(0, 3);
  };

  // Hent index.html på nytt (forbi mellomlageret) og les versjonsnummeret.
  // Gir null hvis det ikke går (for eksempel når spillet kjøres fra en fil).
  RF.checkForUpdate = async () => {
    if (!/^https?:$/.test(location.protocol)) return null;
    try {
      const r = await fetch(location.pathname + '?vcheck=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      const m = /RF_VERSION\s*=\s*'([^']+)'/.exec(await r.text());
      return m ? m[1] : null;
    } catch (_) {
      return null;
    }
  };
})();
