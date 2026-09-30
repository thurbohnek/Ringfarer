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
      v: 'v0.17.2', date: '2026-09-30', title: 'Steadier cutting, faster collecting',
      items: [
        'Asteroids no longer flicker or jump while you cut them, and a piece cut loose no longer shows up in two places.',
        'Pieces that come loose glide apart calmly instead of jostling the rock they came from.',
        'The tractor beam pulls ore in much faster. Ore is taken in as long as your cargo hold has room, and ore processing is faster.',
        'When the hold is full, the tractor lets go and tells you, instead of holding chunks in front of the intake.',
      ],
    },
    {
      v: 'v0.17.1', date: '2026-09-30', title: 'Zoom on the star map',
      items: [
        'Zoom the star map with the mouse wheel, pinch or the + and − buttons, and drag to move around.',
        'Center on ship and Show all buttons.',
        'Zoomed in, the station, gates and ships are drawn at their real size, and scanned rocks show their mineral and value.',
      ],
    },
    {
      v: 'v0.17.0', date: '2026-09-30', title: 'Raiders, star map and moving rocks',
      items: [
        'Raiders: carry valuable cargo far from a station and raiders or stinger drones may come for it. Fight back for a bounty, send out guard drones, or run for the station.',
        'Star map (Tab or ⋯ → Star map): this system seen from above, and every system with its danger and what the station pays well for.',
        'Some rocks now race and spin through the fields. Point at one to see its speed, and press B to match it and hold position.',
        'The cutting beam has its own sound, and a piece breaking loose cracks and rumbles.',
      ],
    },
    {
      v: 'v0.16.0', date: '2026-09-30', title: 'Scanner, values and hold position',
      items: [
        'Press N (or SCAN) to send out a scanner pulse. Rocks with minerals get a colored ring and a label with what they are worth.',
        'Point at a rock or a loose piece to see what it holds and roughly what it is worth. It also tells you if you need a stronger laser.',
        'Press B to hold position next to an asteroid. The ship follows the rock while you cut. A/D turns the ship, B again or thrusting releases it.',
        'New module: Deep scanner, which reaches 2 km instead of 700 m.',
      ],
    },
    {
      v: 'v0.15.0', date: '2026-09-30', title: 'The laser is a cutting beam',
      items: [
        'The mining laser now cuts a thin groove instead of knocking out chunks. Hold it on a line and it slices through the rock.',
        'Pieces only come loose when your cuts go all the way around them, and they fit the hole they came from.',
        'Minerals show clearly in the rock as colored, glinting veins. Cut around them, then cut into the mineral to get ore.',
        'Rock you cut away turns to vapor. Mineral you cut away comes out as ore.',
      ],
    },
    {
      v: 'v0.14.2', date: '2026-09-30', title: 'Less rubble, smoother mining',
      items: [
        'Loose chunks of plain rock break up quickly in the laser, and small bits turn to dust right away.',
        'When too much loose rock piles up, the pieces furthest away crumble to dust.',
        'Mining runs smoother: small rocks and ore are drawn faster.',
        'Fixed a dark shadow left behind where pieces had broken off an asteroid.',
      ],
    },
    {
      v: 'v0.14.1', date: '2026-09-30', title: 'Drones use the bay doors',
      items: [
        'Drones fly home to their own bay door, hover over it while it opens, and sink down into the ship.',
        'Launching works the other way: the drone rises up out of the open bay before it flies off.',
        'Mining and collector drones unload by dropping into their bay and coming straight back out.',
        'Your own drones are drawn above your ship, so they no longer vanish behind the hull.',
      ],
    },
    {
      v: 'v0.14.0', date: '2026-09-30', title: 'A real gate, and a closer look',
      items: [
        'The gate is a built machine: heavy hull plates, a symbol track that spins while dialing, nine chevron clamps that lock with a spark, stabilizer thrusters and a control platform.',
        'Opening a gate is violent: the ring charges up with arcs, the vortex blasts out with a flash, shock waves and a spray of sparks, and the event horizon ripples and shimmers.',
        'Zoom in until your ship fills the whole screen. Your own ship is drawn sharper so it holds up close.',
        'Pan much further away from your ship. An arrow at the edge shows where it is.',
      ],
    },
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
