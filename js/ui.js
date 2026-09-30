// DOM-paneler: tittel, stasjon (marked, verksted, utstyr, verft, droner,
// oppdrag), oppringing av porten, pause, hjelp og vrakskjerm.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  let game, root, touchRoot;
  let open = null;
  let tab = 'marked';
  // Siste kjøp eller salg av utstyr, for å vise hva som skjedde.
  let fitFx = null;
  let gearCat = 'Mining';
  let yardLine = null;

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kr = (n) => Math.round(n).toLocaleString('en-US') + ' cr';
  const t1 = (n, d = 1) => n.toFixed(d);
  const tonn = (n) => t1(n) + ' t';

  // Syv portsymboler tegnet som enkle SVG-streker.
  const GLYPHS = [
    'M4 20 L12 4 L20 20 Z', 'M4 12 H20 M12 4 V20', 'M5 5 L19 19 M19 5 L5 19 M12 3 V8',
    'M12 3 A9 9 0 1 1 11.9 3 M12 8 V16', 'M4 6 H20 L4 18 H20', 'M6 4 V20 M6 12 L18 4 M6 12 L18 20',
    'M12 3 L20 12 L12 21 L4 12 Z M12 9 V15',
  ];
  const glyph = (i) => `<svg viewBox="0 0 24 24" class="glyph" aria-hidden="true"><path d="${GLYPHS[i]}"/></svg>`;

  function show(name, html) {
    open = name;
    root.innerHTML = html;
    root.hidden = false;
    root.dataset.panel = name;
    game.paused = game.state === 'play' && !game.ship.docked && (name === 'pause' || name === 'help');
    const first = root.querySelector('[data-autofocus]');
    if (first) first.focus({ preventScroll: true });
  }

  // Svak børstet-stål-tekstur til panelene: fine vannrette striper og litt
  // flekker, så lav kontrast at teksten alltid er lett å lese.
  function brushedSteel() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    for (let y = 0; y < 256; y++) {
      x.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#000000';
      x.globalAlpha = Math.random() * 0.035;
      x.fillRect(0, y, 256, 1);
    }
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() < 0.6 ? '#000000' : '#ffffff';
      x.globalAlpha = Math.random() * 0.06;
      x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 3, 1);
    }
    return c;
  }

  const UI = {
    isOpen: () => open !== null,
    closeAll() {
      open = null;
      game.paused = false;
      root.hidden = true;
      root.innerHTML = '';
    },

    init(g) {
      game = g;
      root = $('#panel');
      touchRoot = $('#touch');
      root.addEventListener('click', onClick);
      try {
        document.documentElement.style.setProperty('--noise', `url(${brushedSteel().toDataURL()})`);
      } catch (_) { /* uten tekstur går også fint */ }
      RF.Input.bindTouch(touchRoot);
      RF.Input.bindStick($('#stick'), $('#stick .base'), $('#stick .knob'));
      $('#tc-more').addEventListener('pointerdown', (e) => { e.preventDefault(); $('#tc-drawer').hidden = !$('#tc-drawer').hidden; });
      $('#tc-drawer').addEventListener('pointerup', () => { setTimeout(() => { $('#tc-drawer').hidden = true; }, 120); });
      if (game.touchUI) UI.setTouch(true);
      window.addEventListener('touchstart', () => { if (!game.touchUI) UI.setTouch(true); }, { passive: true });
      UI.openTitle();
      startUpdateWatch();
    },

    setTouch(on) {
      game.touchUI = on;
      document.body.classList.toggle('touch', on);
    },

    tick() {
      if (game.touchUI && game.ship) {
        const sh = game.ship;
        const act = game.action;
        const ctx = $('#tc-ctx');
        ctx.hidden = !act;
        const label = act === 'dock' ? 'DOCK' : act === 'dial' ? 'DIAL GATE' : act === 'tow' ? 'TOW' : '';
        if (ctx.textContent !== label) ctx.textContent = label;
        $('#tc-tractor').classList.toggle('on', sh.tractor.on);
        $('#tc-light').classList.toggle('on', sh.lightOn);
        $('#tc-winch').hidden = !sh.anchor;
        $('#tc-winchout').hidden = !sh.anchor;
        const fire = $('#tc-fire');
        const fl = RF.TOOL_NAMES[sh.tool].toUpperCase() + (sh.tool === 'rakett' ? ' ' + sh.s.ammo : '') + (sh.tool === 'anker' && (sh.anchor || sh.harpoon) ? ' RELEASE' : '');
        if (fire.textContent !== fl) fire.textContent = fl;
        document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === sh.tool));
      }
      touchRoot.hidden = !game.touchUI || game.state !== 'play' || UI.isOpen();
    },

    openTitle() {
      const cont = game.hasSave();
      const news = RF.unseenNews(seenNews());
      const newsHtml = news.length ? `<section class="news" aria-label="What's new">
            ${news.map((n) => `<h3>What's new in ${esc(n.v)} · ${esc(n.title)}</h3><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}
          </section>` : '';
      show('title', `
        <div class="title-card">
          <p class="eyebrow">Mining · hauling · the ring gate</p>
          <h1>Ringfarer</h1>
          <p class="lede">Fit out your own mining ship. Drill, blast and tunnel through asteroids, tow comets on a cable,
          send out drones and travel through the ancient ring gate. Everything runs on real physics, and your ship can lose parts when it gets hit.</p>
          <nav class="menu">
            <button class="menu-item primary" data-act="test" data-autofocus><b>Test everything</b><span>Fully equipped ship, unlimited credits</span></button>
            ${cont ? '<button class="menu-item" data-act="continue"><b>Continue</b><span>Pick up where you left off</span></button>' : ''}
            <button class="menu-item" data-act="new"><b>New career</b><span>Start small with a Skiff MK-I</span></button>
            <button class="menu-item" data-act="help"><b>Controls</b><span>Keys, touch and tips</span></button>
          </nav>
          ${newsHtml}
          <p class="version num">Version ${esc(RF.VERSION)} · <button class="linkbtn" data-act="news">All updates</button></p>
        </div>`);
    },

    openNews() {
      markNewsSeen();
      show('help', `
        <div class="card plate help-card"><div class="hazard"></div>
          <div class="card-head"><h2>Updates</h2><button class="btn ghost" data-act="title">✕ Close</button></div>
          <section class="news">${RF.NEWS.map((n) => `<h3>${esc(n.v)} · ${esc(n.title)} <span class="muted small">${esc(n.date)}</span></h3><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('')}</section>
        </div>`);
    },

    openHelp() {
      const back = game.state === 'play' ? 'close' : 'title';
      show('help', `
        <div class="card plate help-card"><div class="hazard"></div>
          <div class="card-head"><h2>Controls and tips</h2><button class="btn ghost" data-act="${back}">✕ Close</button></div>
          ${keyList()}
          <h3>How it works</h3>
          <ul class="tips">
            <li><b>Aiming:</b> tools sit in mounts on the edge of the hull and turn toward where you tap or point. Each turret reaches a little over 90° either way. The crosshair turns green when at least one turret can reach the target.</li>
            <li><b>Tap to move:</b> a short tap on empty space (for example next to an asteroid) sets a target. The ship flies there and stops, and follows the rock if the target is next to one. Steering yourself switches the autopilot off. The autopilot flies straight unless the ship has a <b>navigation computer</b> (Equipment → Tools): then it plots a course around asteroids, stations and ships.</li>
            <li><b>Choose the heading:</b> press and hold on empty space until the target ring appears, then drag toward where the nose should point when the ship arrives. A green arrow shows the heading.</li>
            <li><b>Turn in place:</b> press on your ship and drag. The ship turns to face your finger without moving anywhere.</li>
            <li><b>Camera:</b> drag the screen to look around. The ship always stays on screen. Tap your ship (or ⋯ → Center camera, key O) to center again.</li>
            <li><b>Firing:</b> press and hold on a rock to aim at it and use the tool. The aim follows the rock. The trigger at the bottom right (or Space) fires at the current aim. Lasers, drills and guns pass straight through loose ore chunks.</li>
            <li><b>Touch:</b> the stick is the circle at the bottom left: drag to turn, drag far out to thrust.</li>
            <li><b>Brake:</b> BRAKE (or S) uses every engine to stop the ship along the direction it is actually moving, wherever the nose points.</li>
            <li><b>Caves:</b> rocks are made of small pieces. The laser breaks off chunks that fit the hole they leave, so you can tunnel into big asteroids and fly inside. Some big asteroids already have a cave. Rockets blast big craters.</li>
            <li><b>Zoom:</b> pinch with two fingers, or use the mouse wheel or + and −.</li>
            <li><b>Hardness:</b> every rock type has a hardness from 1 to 4. The laser must be at least that tier. Cannons and rockets break anything.</li>
            <li><b>Ice crust:</b> some asteroids and comets have ice on the outside and a valuable mineral inside.</li>
            <li><b>Harpoon:</b> fires a hook on a cable that sticks to whatever it hits. Winch in to land, or thrust and tow the comet wherever you like.</li>
            <li><b>Damage:</b> modules that get hit take damage and can break off. Lose the cockpit and the ship is lost. Salvage can be pulled in with the tractor and sold as scrap.</li>
            <li><b>Equipment:</b> at a station you buy lasers, drill heads, cannons, rockets, harpoons, lights, cargo space and more. It is fitted automatically where there is room on the hull and shows on the ship. Need more room? Buy a bigger ship at the shipyard.</li>
            <li><b>Drones:</b> drones come in three sizes. Small ones live in drone bays, medium ones in hangar decks and large ones on docking clamps outside the hull. Press K to launch them: the doors open and they fly out. Press K again to call them home, and they fly back and dock. Mining and collector drones bring ore, repair drones fix the ship, guard drones burn rocks heading for you, cargo drones sell goods at the station and shuttles fly passengers and crew to the station or to other ships.</li>
            <li><b>Passengers:</b> fit passenger cabins or habitat modules (and life support for more than a handful) and take passenger contracts. Passengers leave when you dock at their station, or a shuttle drone can fly them over. Crew changes out to freighters need a shuttle drone.</li>
          </ul>
          <div class="row"><button class="btn primary" data-act="${back}" data-autofocus>Back</button></div>
        </div>`);
    },

    openPause() {
      const act = game.missions.filter((m) => m.status === 'aktiv');
      show('pause', `
        <div class="card plate narrow"><div class="hazard"></div>
          <h2>Pause</h2>
          ${act.length ? `<h3>Active contracts</h3><ul class="plain">${act.map((m) => `<li>${esc(RF.missionShort(m))} <span class="reward num">${kr(m.reward)}</span></li>`).join('')}</ul>` : ''}
          <div class="col">
            <button class="btn primary" data-act="close" data-autofocus>Resume</button>
            <button class="btn" data-act="help">Controls</button>
            <button class="btn" data-act="money">Give me 1,000,000 cr</button>
            <button class="btn" data-act="mute">${RF.Audio.muted ? 'Sound on' : 'Sound off'}</button>
            <button class="btn" data-act="touch">${game.touchUI ? 'Hide touch controls' : 'Show touch controls'}</button>
            <button class="btn ghost" data-act="quit">Main menu</button>
          </div>
        </div>`);
    },

    openDead() {
      const fee = Math.min(game.credits, 300 + Math.round(game.credits * 0.1));
      show('dead', `
        <div class="card plate narrow danger"><div class="hazard"></div>
          <p class="eyebrow">The cockpit is gone</p>
          <h2>Ship lost</h2>
          <p>Your escape pod was picked up. The insurance rebuilds the ship from the last blueprint at
          ${esc(RF.stationName(game.lastStation))}.</p>
          <p class="muted">Deductible ${kr(fee)}. Cargo, haul contracts and drones that were out are lost.</p>
          <div class="row"><button class="btn primary" data-act="respawn" data-autofocus>Take the new ship</button></div>
        </div>`);
    },

    openDial() {
      const here = game.sys.def.id;
      const rows = RF.SYSTEMS.filter((s) => s.id !== here).map((s) => `
        <button class="dest" data-act="dial" data-id="${s.id}">
          <span class="glyphs">${s.glyphs.map(glyph).join('')}</span>
          <span class="dest-name">${esc(s.name)}</span>
          <span class="muted">${esc(s.blurb)}</span>
        </button>`).join('');
      show('dial', `
        <div class="card plate"><div class="hazard"></div>
          <p class="eyebrow">Dial device · ${esc(game.sys.def.name)}</p>
          <h2>Choose an address</h2>
          <div class="dests">${rows}</div>
          <p class="muted small">When seven chevrons lock, a vortex bursts out in front of the gate. Stay clear of it, then fly in from the front.</p>
          <div class="row"><button class="btn ghost" data-act="close">Cancel</button></div>
        </div>`);
    },

    openStation() {
      if (open !== 'station') tab = 'marked';
      renderStation();
    },
  };

  function keyList() {
    const k = (keys, what) => `<div class="k"><span>${keys.map((x) => `<kbd>${x}</kbd>`).join('')}</span><span>${what}</span></div>`;
    return `<div class="keys">
      ${k(['W'], 'Main engine')}
      ${k(['S'], 'Brake (stops along your heading of travel)')}
      ${k(['A', 'D'], 'Turn')}
      ${k(['Q', 'E'], 'Strafe')}
      ${k(['1', '2', '3', '4'], 'Laser, cannon, rocket, harpoon')}
      ${k(['Mouse'], 'Aim. Click empty space: move there. Click and hold a rock: fire')}
      ${k(['Hold', 'Drag'], 'On empty space: move there and face the drag direction')}
      ${k(['Ship', 'Drag'], 'Turn the ship in place')}
      ${k(['Drag'], 'Move the camera (also right mouse button)')}
      ${k(['O'], 'Center camera on the ship')}
      ${k(['Space'], 'Use the tool')}
      ${k(['X'], 'Fire / release harpoon')}
      ${k(['C', 'V'], 'Winch in / pay out cable')}
      ${k(['F'], 'Tractor beam on/off')}
      ${k(['K'], 'Launch / recall drones')}
      ${k(['N'], 'Scan for minerals (hover a rock to see what it holds)')}
      ${k(['B'], 'Hold position next to the asteroid (steer with A/D, B again to release)')}
      ${k(['L'], 'Work lights on/off')}
      ${k(['Z'], 'Flight assist')}
      ${k(['T', 'G'], 'Dock / dial the gate')}
      ${k(['+', '−'], 'Zoom (or mouse wheel)')}
      ${k(['Esc'], 'Pause')}
    </div>`;
  }

  // ---------- Stasjonen ----------

  // Små ikoner til fanene.
  const ICONS = {
    marked: 'M4 7h16l-1.5 11h-13z M8 7V5h8v2 M9 11v4 M15 11v4',
    verksted: 'M14 4a4 4 0 0 0-3.8 5.2L4 15.4 6.6 18l6.2-6.2A4 4 0 0 0 18 8l-2.5 2.5-2-2L16 6a4 4 0 0 0-2-2z',
    utstyr: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M19 5l-2 2 M7 17l-2 2',
    verft: 'M3 13l4-6h10l4 6-4 5H7z M9 10h6 M8 13h8',
    droner: 'M8 12h8 M12 9v6 M5 6a2 2 0 1 0 0 .1 M19 6a2 2 0 1 0 0 .1 M5 18a2 2 0 1 0 0 .1 M19 18a2 2 0 1 0 0 .1 M7 8l3 3 M17 8l-3 3 M7 16l3-3 M17 16l-3-3',
    oppdrag: 'M7 4h10v16H7z M9 8h6 M9 12h6 M9 16h4',
  };
  const icon = (id) => `<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="${ICONS[id]}"/></svg>`;

  function renderStation() {
    const ship = game.ship, s = ship.s, st = ship.docked;
    if (!st) return;
    const tabs = [['marked', 'Market'], ['verksted', 'Repairs'], ['utstyr', 'Equipment'], ['verft', 'Shipyard'], ['droner', 'Drones'], ['oppdrag', 'Contracts']];
    let body = '';
    if (tab === 'marked') body = marketTab(st);
    else if (tab === 'verksted') body = repairTab();
    else if (tab === 'utstyr') body = gearTab();
    else if (tab === 'verft') body = yardTab();
    else if (tab === 'droner') body = droneTab();
    else body = missionsTab(st);
    const scroll = root.querySelector('.tab-body');
    const y = scroll ? scroll.scrollTop : 0;
    const pct = (a, b) => Math.round((a / (b || 1)) * 100);
    const chip = (label, val, f) => `<span class="chip"><span>${label}</span><b class="num">${val}</b>${f != null ? `<i style="width:${Math.max(0, Math.min(100, f))}%"></i>` : ''}</span>`;
    show('station', `
      <div class="card plate station"><div class="hazard"></div>
        <header class="st-head">
          <div class="st-title">
            <p class="eyebrow">Docked · ${esc(game.sys.def.name)} · ${esc(RF.HULLS[s.hull].name)}</p>
            <h2>${esc(st.name)}</h2>
          </div>
          <div class="wallet"><span class="num">${Math.floor(game.credits).toLocaleString('en-US')}</span><span class="muted">credits${game.testMode ? ' · unlimited' : ''}</span>
            <button class="btn sm ghost" data-act="money">+1M</button></div>
        </header>
        <div class="chips">
          ${chip('Cargo', `${t1(RF.cargoMass(s))} / ${ship.stats.hold} t`, pct(RF.cargoMass(s), ship.stats.hold))}
          ${chip('Hull', pct(ship.hullFrac(), 1) + ' %', pct(ship.hullFrac(), 1))}
          ${chip('Fuel', pct(s.fuel, ship.stats.fuelCap) + ' %', pct(s.fuel, ship.stats.fuelCap))}
          ${chip('Rockets', `${s.ammo}/${ship.stats.rocketCap}`, pct(s.ammo, ship.stats.rocketCap))}
        </div>
        <div class="st-main">
          <nav class="tabs" role="tablist">
            ${tabs.map(([id, name]) => `<button role="tab" class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-id="${id}" aria-selected="${tab === id}">${icon(id)}<span>${name}</span></button>`).join('')}
          </nav>
          <div class="tab-body">${body}</div>
        </div>
        <footer class="st-foot"><button class="btn primary" data-act="undock" data-autofocus>Undock</button></footer>
        ${toastHtml()}
      </div>`);
    const nb = root.querySelector('.tab-body');
    if (nb) nb.scrollTop = y;
    if (tab === 'utstyr') drawGear();
    if (tab === 'verft') drawYard();
    if (fitFx) animateFit();
  }

  // Et vindu som glir inn og viser hvor på skipet delen ble montert eller tatt av.
  function toastHtml() {
    if (!fitFx || performance.now() - fitFx.t0 > FIT_SECS * 1000) return '';
    const buy = fitFx.kind === 'buy';
    return `<div class="toast ${buy ? 'ok' : 'bad'}" role="status">
      <canvas id="toast-ship" aria-hidden="true"></canvas>
      <div><b>${buy ? '✓ ' + esc(fitFx.name) + ' fitted' : esc(fitFx.name) + ' removed'}</b>
      <span>${buy ? '−' + kr(fitFx.cost) + ' · marked in green on your ship' : '+' + kr(fitFx.cost) + ' · marked in red on your ship'}</span></div>
    </div>`;
  }

  // Skipsbildet i utstyrsfanen kan zoomes (knapper, musehjul, knip) og flyttes (dra).
  const gearView = { zoom: 1, cx: null, cy: null };
  const FIT_SECS = 7;

  function currentHl() {
    if (!fitFx) return null;
    const sec = (performance.now() - fitFx.t0) / 1000;
    return { x: fitFx.x, y: fitFx.y, kind: fitFx.kind, sec, steady: sec > FIT_SECS };
  }

  function redrawGear() {
    const cv = $('#gear-canvas'), tc = $('#toast-ship');
    if (cv) RF.drawShipPreview(cv, game.ship, currentHl(), gearView);
    if (tc) RF.drawShipPreview(tc, game.ship, currentHl());
    const z = $('#gear-zoom');
    if (z) z.textContent = Math.round(gearView.zoom * 100) + ' %';
  }

  // Zoom rundt et punkt på lerretet (skjermkoordinater i lerretet).
  function zoomGear(f, mx, my) {
    const cv = $('#gear-canvas');
    if (!cv || !cv._view) return;
    const v = cv._view;
    const nz = G.clamp(gearView.zoom * f, 1, 8);
    if (mx == null) { mx = v.W / 2; my = v.H / 2; }
    const wx = v.cx + (mx - v.W / 2) / v.k, wy = v.cy + (my - v.H / 2) / v.k;
    const nk = v.fit * nz;
    gearView.zoom = nz;
    gearView.cx = wx - (mx - v.W / 2) / nk;
    gearView.cy = wy - (my - v.H / 2) / nk;
    if (nz === 1) gearView.cx = gearView.cy = null;
    redrawGear();
  }

  function bindGearCanvas(cv) {
    if (cv._bound) return;
    cv._bound = true;
    const pts = new Map();
    let pinch0 = 0;
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomGear(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignorer */ }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const v = cv._view;
      if (pts.size === 1 && v && gearView.zoom > 1) {
        gearView.cx = v.cx - (e.clientX - p.x) / v.k;
        gearView.cy = v.cy - (e.clientY - p.y) / v.k;
        redrawGear();
      }
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const r = cv.getBoundingClientRect();
        if (pinch0 > 0) zoomGear(d / pinch0, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        pinch0 = d;
      }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch0 = 0; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
  }

  let fitAnim = 0;
  function animateFit() {
    cancelAnimationFrame(fitAnim);
    const row = root.querySelector(`[data-act="gearbuy"][data-id="${fitFx.id}"]`);
    if (row && performance.now() - fitFx.t0 < 300) {
      const li = row.closest('li');
      if (li) li.classList.add('flash');
    }
    // Er skipsbildet forstørret, flyttes det så den nye delen synes.
    if (gearView.zoom > 1 && performance.now() - fitFx.t0 < 300) {
      const L = game.ship.s.layout;
      if (L.length) {
        gearView.cx = fitFx.x * RF.CELL - (L[0].x * RF.CELL - L[0].lx);
        gearView.cy = fitFx.y * RF.CELL - (L[0].y * RF.CELL - L[0].ly);
      }
    }
    const step = () => {
      if (!fitFx) return;
      const hl = currentHl();
      redrawGear();
      if (!hl.steady) fitAnim = requestAnimationFrame(step);
      else { const el = root.querySelector('.toast'); if (el) el.classList.add('gone'); }
    };
    fitAnim = requestAnimationFrame(step);
  }

  function marketTab(st) {
    const s = game.ship.s;
    const free = game.ship.holdFree();
    const rows = Object.keys(RF.PRODUCTS).map((k) => {
      const P = RF.PRODUCTS[k];
      const sell = game.sellPrice(st.id, k), buy = game.buyPrice(st.id, k);
      const have = s.cargo[k];
      const canBuy = Math.min(free, game.credits / buy);
      return `<tr>
        <td><span class="dot" style="background:${P.color}"></span>${esc(P.name)}</td>
        <td class="num" data-l="Aboard">${tonn(have)}</td>
        <td class="num" data-l="Sell cr/t">${sell}</td>
        <td class="num" data-l="Buy cr/t">${buy}</td>
        <td class="acts">
          <button class="btn sm" data-act="sell" data-id="${k}" ${have < 0.005 ? 'disabled' : ''}>Sell all</button>
          <button class="btn sm ghost" data-act="buy" data-id="${k}" ${canBuy < 1 ? 'disabled' : ''}>Buy 1 t</button>
        </td></tr>`;
    }).join('');
    const mc = s.missionCargo.length
      ? `<p class="muted small">Contract cargo aboard: ${s.missionCargo.map((c) => `${esc(c.name)} (${c.mass} t)`).join(', ')}</p>` : '';
    let total = 0;
    for (const k in s.cargo) total += s.cargo[k] * game.sellPrice(st.id, k);
    return `<div class="table-wrap"><table>
      <thead><tr><th>Goods</th><th class="num">Aboard</th><th class="num">Sell cr/t</th><th class="num">Buy cr/t</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      ${mc}
      <div class="row"><button class="btn" data-act="sellall" ${total < 1 ? 'disabled' : ''}>Sell the whole cargo (${kr(total)})</button></div>`;
  }

  function missingModules() {
    const s = game.ship.s;
    const have = new Set(s.layout.map((m) => m.x + ',' + m.y));
    return (s.blueprint || []).filter((m) => !have.has(m.x + ',' + m.y));
  }

  function repairCosts() {
    const ship = game.ship, s = ship.s, st = ship.stats;
    let rep = 0, dmg = 0;
    for (const m of s.layout) { const miss = RF.MODULES[m.t].hp - m.hp; if (miss > 0.5) { rep += miss * 6; dmg++; } }
    const lost = missingModules();
    const rebuild = lost.reduce((a, m) => a + RF.MODULES[m.t].cost, 0);
    // Drivstoff koster mindre per kilo jo større skipet er (kjøpes i bulk).
    const fuel = ((st.fuelCap - s.fuel) * 0.9) / (st.scale || 1) ** 2;
    const ammo = (st.rocketCap - s.ammo) * 120;
    return { rep: Math.ceil(rep), dmg, lost, rebuild, fuel: Math.ceil(fuel), ammo };
  }

  function repairTab() {
    const c = repairCosts();
    const row = (label, val, cost, act) => `<tr><td>${label}</td><td class="num">${val}</td>
      <td class="acts"><button class="btn sm" data-act="${act}" ${cost <= 0 || game.credits < 1 ? 'disabled' : ''}>${cost > 0 ? 'Fix · ' + kr(cost) : 'OK'}</button></td></tr>`;
    const lostList = c.lost.length ? `<p class="muted small">Lost modules: ${c.lost.map((m) => esc(RF.MODULES[m.t].name)).join(', ')}</p>` : '';
    return `<div class="table-wrap"><table><tbody>
      ${row('Damaged modules', c.dmg, c.rep, 'rep-hull')}
      ${row('Lost modules (rebuild from blueprint)', c.lost.length, c.rebuild, 'rep-lost')}
      ${row('Fuel', Math.round((game.ship.s.fuel / (game.ship.stats.fuelCap || 1)) * 100) + ' %', c.fuel, 'rep-fuel')}
      ${row('Rockets', game.ship.s.ammo + ' / ' + game.ship.stats.rocketCap, c.ammo, 'rep-ammo')}
      </tbody></table></div>
      ${lostList}
      <p class="muted small">The blueprint is the ship as it was when you last left a station or changed equipment.</p>
      <div class="row"><button class="btn" data-act="rep-all" ${c.rep + c.rebuild + c.fuel + c.ammo <= 0 ? 'disabled' : ''}>Fix everything (${kr(c.rep + c.rebuild + c.fuel + c.ammo)})</button></div>`;
  }

  // ---------- Utstyr ----------
  // Utstyr kjøpes her og monteres automatisk der det er plass på skroget.
  // Alt som er montert synes på skipet.

  function gearTab() {
    const ship = game.ship, s = ship.s, st = ship.stats;
    const g = RF.layoutGeometry(s.layout);
    const full = ship.dryMass + st.fuelCap + st.hold * 1000;
    const warn = st.blocked.map((m) => `${RF.MODULES[m.t].name} ${RF.MODULES[m.t].mount ? 'has no free edge to point out of' : 'has no open space behind it'}`);
    if (!st.thrusters.length) warn.push('No engine with a clear exhaust');
    const count = {};
    for (const m of s.layout) count[m.t] = (count[m.t] || 0) + 1;
    const B = RF.hullBounds(s.hull);
    const cells = (B.x1 - B.x0 + 1) * (B.y1 - B.y0 + 1);
    const cats = [...new Set(Object.values(RF.MODULES).filter((m) => !m.unique).map((m) => m.cat))];
    if (!cats.includes(gearCat)) gearCat = cats[0];
    const chips = cats.map((c) => `<button class="catchip ${c === gearCat ? 'on' : ''}" data-act="gearcat" data-id="${esc(c)}">${esc(c)}</button>`).join('');
    const items = Object.keys(RF.MODULES).filter((k) => RF.MODULES[k].cat === gearCat && !RF.MODULES[k].unique).map((k) => {
      const M = RF.MODULES[k], n = count[k] || 0;
      return `<li class="gear-card mission">
        <div class="gc-top"><canvas class="pal-ico" data-mod="${k}" width="56" height="56"></canvas>
          <div class="gc-name"><b>${esc(M.name)}</b><span class="num reward">${kr(M.cost)}</span></div></div>
        <p class="muted small">${esc(M.desc)}</p>
        <div class="gc-foot"><span class="fitted ${n ? 'on' : ''}">${n ? 'Fitted: ' + n : 'Not fitted'}</span>
          <span class="gc-btns"><button class="btn sm ghost" data-act="gearsell" data-id="${k}" ${n ? '' : 'disabled'}>Sell one</button>
          <button class="btn sm primary" data-act="gearbuy" data-id="${k}" ${game.credits < M.cost ? 'disabled' : ''}>Buy and fit</button></span></div></li>`;
    }).join('');
    const list = `<nav class="catchips">${chips}</nav><ul class="gear-grid">${items}</ul>`;
    return `
      <div class="gear-top">
        <div class="gear-view">
          <canvas id="gear-canvas" aria-label="Your ship with all its equipment. Scroll, pinch or use the buttons to zoom, drag to move."></canvas>
          <div class="gv-btns">
            <button class="btn sm" data-act="gearzoom" data-id="in" aria-label="Zoom in">+</button>
            <button class="btn sm" data-act="gearzoom" data-id="out" aria-label="Zoom out">−</button>
            <button class="btn sm ghost" data-act="gearzoom" data-id="fit">Fit</button>
          </div>
          <span id="gear-zoom" class="gv-zoom num">100 %</span>
        </div>
        <div class="ed-side">
          <p class="small">Equipment is fitted automatically where there is room on the hull. Tools and weapons go on the edge pointing out, engines at the back. Everything you buy shows on the ship.</p>
          <dl class="stats">
            <dt>Hull space</dt><dd class="num">${s.layout.length} / ${cells} slots</dd>
            <dt>Dry mass</dt><dd class="num">${t1(ship.dryMass / 1000)} t</dd>
            <dt>Size</dt><dd class="num">about ${Math.round(ship.body.radius * 2)} m</dd>
            <dt>Thrust</dt><dd class="num">${Math.round(st.thrust / 1000)} kN</dd>
            <dt>Acceleration</dt><dd class="num">${t1(st.thrust / (ship.dryMass + st.fuelCap))} / ${t1(st.thrust / full)} m/s² (full)</dd>
            <dt>Cargo hold</dt><dd class="num">${st.hold} t</dd>
            <dt>Shield</dt><dd class="num">${st.shieldMax}</dd>
            <dt>Lasers / drills</dt><dd class="num">${st.lasers.length} / ${st.drills.length}</dd>
            <dt>Weapons</dt><dd class="num">${st.guns.length} cannon, ${st.rockets.length} rocket</dd>
            <dt>Drone bays</dt><dd class="num">${st.bays}</dd>
            ${st.pax + st.cryo ? `<dt>Passengers</dt><dd class="num">${st.paxCap}${st.pax > st.life ? ' (needs life support)' : ''}</dd>` : ''}
            <dt>Class</dt><dd class="num">${esc(st.line.name)}</dd>
          </dl>
          ${warn.length ? `<ul class="warn">${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
      ${list}`;
  }

  function drawGear() {
    const cv = $('#gear-canvas');
    if (cv) { bindGearCanvas(cv); redrawGear(); }
    document.querySelectorAll('.pal-ico').forEach((c) => {
      const x = c.getContext('2d');
      const k = c.width / (RF.CELL * 2.2);
      x.setTransform(k, 0, 0, k, c.width / 2 - RF.CELL * 0.35 * k, c.height / 2);
      x.clearRect(-5, -5, 10, 10);
      RF.drawModule(x, c.dataset.mod, null);
    });
  }

  function buyGear(id) {
    const ship = game.ship, s = ship.s, M = RF.MODULES[id];
    if (game.credits < M.cost) { game.msg('You cannot afford it', RF.HUD_COLORS.danger); return; }
    const m = RF.autoPlace(s.layout, s.hull, id);
    if (!m) { game.msg('No room on the hull. Sell something, or buy a bigger ship at the shipyard', RF.HUD_COLORS.amber); renderStation(); return; }
    game.credits -= M.cost;
    s.layout.push(m, ...(m.parts || []));
    delete m.parts;
    game.msg(`${M.name} fitted`, RF.HUD_COLORS.ok);
    fitFx = { kind: 'buy', id, x: m.x, y: m.y, name: M.name, cost: M.cost, t0: performance.now() };
    afterEdit();
  }

  function sellGear(id) {
    const ship = game.ship, s = ship.s, M = RF.MODULES[id];
    const m = RF.autoRemove(s.layout, id);
    if (!m) { game.msg('Cannot remove it without the ship falling apart', RF.HUD_COLORS.amber); return; }
    const parts = RF.partsOf(s.layout, m);
    s.layout = s.layout.filter((o) => o !== m && !parts.includes(o));
    const got = Math.round(M.cost * 0.7 * (m.hp / M.hp));
    game.credits += got;
    game.msg(`Sold ${M.name.toLowerCase()} for ${kr(got)}`, RF.HUD_COLORS.ok);
    fitFx = { kind: 'sell', id, x: m.x, y: m.y, name: M.name, cost: got, t0: performance.now() };
    afterEdit();
  }

  function afterEdit() {
    const ship = game.ship;
    ship.rebuild();
    const dp = game.parkPoint(ship.docked);
    Object.assign(ship.body, { x: dp.x, y: dp.y, a: dp.a, vx: 0, vy: 0, w: 0 });
    ship.s.blueprint = ship.s.layout.map((m) => ({ t: m.t, x: m.x, y: m.y }));
    game.save();
    RF.Audio.blip(620, 0.06, 'square', 0.08);
    renderStation();
  }

  // ---------- Oppdateringer ----------
  // Hvilke nyheter spilleren har sett (versjonen lagres i nettleseren).
  const NEWS_KEY = 'ringfarer-news-seen';
  function seenNews() { try { return localStorage.getItem(NEWS_KEY); } catch (_) { return null; } }
  function markNewsSeen() { try { localStorage.setItem(NEWS_KEY, RF.NEWS[0].v); } catch (_) { /* ikke så farlig */ } }

  // Se etter en nyere versjon hvert tredje minutt, og når fanen blir synlig
  // igjen. Varselet er lite og ligger under radaren, så det ikke er i veien.
  function startUpdateWatch() {
    const cur = RF.VERSION.split(' ')[0];
    let shown = null;
    const check = async () => {
      const v = await RF.checkForUpdate();
      if (!v) return;
      const nv = v.split(' ')[0];
      if (nv === cur || nv === shown) return;
      shown = nv;
      let el = $('#update-note');
      if (!el) {
        el = document.createElement('div');
        el.id = 'update-note';
        el.setAttribute('role', 'status');
        document.body.appendChild(el);
        el.addEventListener('click', (e) => {
          const b = e.target.closest('button');
          if (!b) return;
          if (b.dataset.u === 'close') { el.hidden = true; return; }
          if (game.state === 'play') game.save();
          location.reload();
        });
      }
      el.innerHTML = `<span><b>Update ${esc(nv)} is ready</b><small>Reload to play it. Your game is saved.</small></span>
        <button class="btn sm primary" data-u="reload">Reload</button><button class="x" data-u="close" aria-label="Hide">✕</button>`;
      el.hidden = false;
    };
    setTimeout(check, 20000);
    setInterval(check, 180000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }

  // ---------- Verft ----------

  // Egenskapene til et skip slik det leveres fra verftet (med klassebonus).
  const yardShips = {};
  function yardShip(id) {
    if (!yardShips[id]) yardShips[id] = new RF.Ship(RF.newShipState(id));
    return yardShips[id];
  }

  // Tid for å snu skipet en halv runde: aksellerer og bremser rotasjonen,
  // med høyeste dreiefart maxW.
  function turnTime(alpha, maxW) {
    const th = Math.PI;
    return Math.sqrt(th * alpha) <= maxW ? 2 * Math.sqrt(th / alpha) : th / maxW + maxW / alpha;
  }

  function yardTab() {
    const cur = game.ship.s.hull;
    const tv = game.tradeInValue();
    if (!yardLine) yardLine = (RF.HULLS[cur].line) || 'min';
    const chips = RF.LINE_ORDER.map((k) => `<button class="catchip ${k === yardLine ? 'on' : ''}" data-act="yardline" data-id="${k}" style="--lc:${RF.LINES[k].color}">${esc(RF.LINES[k].name)}</button>`).join('');
    const L = RF.LINES[yardLine];
    const ids = Object.keys(RF.HULLS).filter((id) => RF.HULLS[id].line === yardLine).sort((a, b) => RF.HULLS[a].tier - RF.HULLS[b].tier);
    const cards = ids.map((id) => {
      const H = RF.HULLS[id], sh = yardShip(id), st = sh.stats, lay = sh.s.layout;
      let x0 = 99, x1 = -99, ym = 0;
      for (const m of lay) { x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); ym = Math.max(ym, Math.abs(m.y)); }
      const sc = RF.hullScale(id);
      const size = `${Math.round((x1 - x0 + 1) * RF.CELL * sc)} × ${Math.round((2 * ym + 1) * RF.CELL * sc)} m`;
      const price = H.cost - tv;
      const mine = id === cur;
      const facts = [
        ['Size', size], ['Mass', t1(sh.body.mass / 1000) + ' t'],
        ['Accel', t1(st.thrust / sh.body.mass) + ' m/s²'], ['Turn 180°', t1(turnTime(st.torque / sh.body.I, st.maxW)) + ' s'],
        ['Shield', st.shieldMax],
      ];
      if (st.hold) facts.push(['Cargo', st.hold + ' t']);
      if (st.paxCap) facts.push(['People', st.paxCap]);
      if (st.bays) facts.push(['Drones', st.bays]);
      if (st.guns.length || st.rockets.length) facts.push(['Weapons', st.guns.length + st.rockets.length]);
      if (st.lasers.length + st.drills.length) facts.push(['Mining tools', st.lasers.length + st.drills.length]);
      const traits = st.traits.map((t) => `<span class="trait" title="${esc(t.desc)}"><b>${esc(t.name)}</b> ${esc(t.desc)}</span>`).join('');
      return `<li class="mission yard-card ${mine ? 'mine' : ''}" style="--lc:${L.color}">
        <canvas class="yard-ship" data-hull="${id}" aria-label="${esc(H.name)}"></canvas>
        <div class="yc-body">
          <div class="yc-head"><span class="yc-tier">Tier ${RF.TIER_NAMES[(H.tier || 1) - 1]} · ${esc(H.cls || '')}</span><b>${esc(H.name)}</b></div>
          <p class="muted small">${esc(H.desc)}</p>
          <dl class="yc-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd class="num">${v}</dd></div>`).join('')}</dl>
          ${traits ? `<div class="traits">${traits}</div>` : ''}
          <div class="gc-foot"><span class="num reward">${kr(H.cost)}</span>
          <button class="btn sm ${mine ? '' : 'primary'}" data-act="buyhull" data-id="${id}" ${mine || game.credits < price ? 'disabled' : ''}>${mine ? 'Your ship' : price >= 0 ? 'Buy · ' + kr(price) : 'Trade · get ' + kr(-price)}</button></div>
        </div></li>`;
    }).join('');
    return `<nav class="catchips">${chips}</nav>
      <div class="line-bonus" style="--lc:${L.color}"><b>${esc(L.name)} bonus</b><span>${esc(L.bonus)}</span></div>
      <p class="small muted">Any ship can be bought as long as you can afford it. Trade-in value of your ship with all modules: <b class="num">${kr(tv)}</b>. Cargo is moved over as far as there is room.</p>
      <ul class="yard-grid">${cards}</ul>`;
  }

  // Tegn skipene i verftet ett og ett, så menyen ikke henger.
  function drawYard() {
    const list = [...document.querySelectorAll('canvas.yard-ship')];
    let i = 0;
    const next = () => {
      if (i >= list.length || tab !== 'verft') return;
      const cv = list[i++];
      if (cv.isConnected) RF.drawShipPreview(cv, yardShip(cv.dataset.hull), null, { zoom: 0.92 });
      requestAnimationFrame(next);
    };
    requestAnimationFrame(next);
  }

  // ---------- Droner ----------

  const TRIP = 180000; // 3 minutter

  function droneTab() {
    const ship = game.ship, s = ship.s, st = ship.stats;
    const now = Date.now();
    const slots = RF.fitDrones(s.layout, st, s.drones).slots;
    const where = { bay: 'drone bay', hangar: 'hangar deck', clamp: 'docking clamp' };
    const list = slots.map(({ d, kind }) => {
      const i = s.drones.indexOf(d);
      const T = RF.DRONE_TYPES[d.type];
      let status = 'Aboard in the ' + where[kind];
      let btn = T.trip ? `<button class="btn sm" data-act="trip" data-id="${i}">Send on expedition (3 min)</button>` : '';
      if (d.trip) {
        const left = d.trip.end - now;
        if (left > 0) { status = `On expedition, back in ${Math.ceil(left / 60000)} min`; btn = ''; }
        else { status = 'Back from expedition'; btn = `<button class="btn sm primary" data-act="tripdone" data-id="${i}">Collect</button>`; }
      }
      return `<li class="mission"><div><span class="tag">${RF.DRONE_SIZES[T.size]} · ${RF.DRONE_ROLES[T.role]}</span><b>${esc(T.name)}</b><span class="muted">${esc(status)}</span></div>
        <div class="m-side">${btn}<button class="btn sm ghost" data-act="selldrone" data-id="${i}" ${d.trip ? 'disabled' : ''}>Sell</button></div></li>`;
    }).join('');
    const room = `Drone bays: <b>${st.bayS}</b>${st.bayPer > 1 ? ' (two small drones each)' : ''} · hangar decks: <b>${st.hangars}</b> · docking clamps: <b>${st.clamps}</b>`;
    const buy = ['S', 'M', 'L'].map((z) => {
      const items = Object.keys(RF.DRONE_TYPES).filter((k) => RF.DRONE_TYPES[k].size === z).map((k) => {
        const T = RF.DRONE_TYPES[k];
        const fits = RF.fitDrones(s.layout, st, s.drones.concat([{ type: k }])).ok;
        const need = z === 'S' ? 'a free drone bay or hangar deck' : z === 'M' ? 'a free hangar deck or docking clamp' : 'a free docking clamp';
        return `<li class="mission"><div><span class="tag">${RF.DRONE_SIZES[T.size]} · ${RF.DRONE_ROLES[T.role]}</span><b>${esc(T.name)}</b><span class="muted">${esc(T.desc)}</span>
          ${fits ? '' : `<span class="muted small">Needs ${need}.</span>`}</div>
          <div class="m-side"><button class="btn sm" data-act="buydrone" data-id="${k}" ${!fits || game.credits < T.cost ? 'disabled' : ''}>${!fits ? 'No room' : 'Buy · ' + kr(T.cost)}</button></div></li>`;
      }).join('');
      return `<h3>${RF.DRONE_SIZES[z]} drones</h3><ul class="missions">${items}</ul>`;
    }).join('');
    return `<p class="small">${room}. Drones aboard: <b>${s.drones.length}</b>.
      ${st.bays ? 'Launch them with K (or ⋯ → Drones on touch). Press again to call them home: they fly back and dock.' : 'Buy a drone bay, hangar deck or docking clamp under Equipment to make room for drones.'}</p>
      <ul class="missions">${list || '<li class="muted">No drones yet.</li>'}</ul>
      ${buy}
      <p class="muted small">Small drones live inside drone bays or hangar decks, medium ones in a hangar deck or on a clamp, large ones on a docking clamp outside the hull. On an expedition a small drone heads to distant fields and comes back with ore or payment. About one in ten never returns.</p>`;
  }

  function tripResult(d) {
    const s = game.ship.s;
    if (Math.random() < 0.1) {
      s.drones = s.drones.filter((x) => x !== d);
      game.msg('The drone never came back from its expedition', RF.HUD_COLORS.danger);
      return;
    }
    d.trip = null;
    if (d.type === 'gruve' || d.type === 'gleaner') {
      const prod = G.pick(['jern', 'silisium', 'nikkel', 'kobber', 'vann', 'titan']);
      const t = G.rand(3, 9);
      const room = Math.max(0, game.ship.holdFree());
      const take = Math.min(t, room);
      s.cargo[prod] += take;
      const rest = (t - take) * RF.PRODUCTS[prod].price;
      if (rest > 0) game.credits += rest;
      game.msg(`The drone came back with ${tonn(t)} of ${RF.PRODUCTS[prod].name.toLowerCase()}${rest > 0 ? ' (the rest was sold)' : ''}`, RF.HUD_COLORS.ok);
    } else {
      const pay = Math.round(G.rand(900, 2200));
      game.credits += pay;
      game.msg(`The drone repaired other ships and earned ${kr(pay)}`, RF.HUD_COLORS.ok);
    }
  }

  // ---------- Oppdrag ----------

  function missionsTab(st) {
    const active = game.missions.filter((m) => m.status === 'aktiv');
    const offers = game.boards[st.id] || [];
    const s = game.ship.s;
    const activeHtml = active.length ? active.map((m) => {
      let btn = '';
      if (m.type === 'levering' && m.to === st.id) {
        const ok = s.cargo[m.product] >= m.amount - 1e-6;
        btn = `<button class="btn sm primary" data-act="deliver" data-id="${m.id}" ${ok ? '' : 'disabled'}>${ok ? 'Deliver' : 'Missing ' + tonn(m.amount - s.cargo[m.product])}</button>`;
      }
      return `<li class="mission"><div><b>${esc(RF.missionShort(m))}</b><span class="muted">${esc(RF.missionDetail(m))}</span></div>
        <div class="m-side"><span class="num reward">${kr(m.reward)}</span>${btn}
        <button class="btn sm ghost" data-act="abandon" data-id="${m.id}">Abandon</button></div></li>`;
    }).join('') : '<li class="muted">No active contracts.</li>';
    const free = game.ship.holdFree();
    const seats = game.paxFree(), cap = game.ship.stats.paxCap || 0;
    const offerHtml = offers.map((m) => {
      const needs = m.type === 'frakt' ? m.mass : 0;
      const people = m.type === 'crew' || (m.type === 'pax' && m.from === st.id) ? m.n : 0;
      const block = active.length >= 3 ? 'Max 3 active' : needs > free + 1e-6 ? 'Not enough room'
        : m.type === 'pax' && m.n > cap ? `Needs ${m.n} seats` : people > seats ? `Needs ${people} free seats` : '';
      const tag = m.type === 'frakt' ? (m.fragile ? `<span class="tag warn">Fragile · max ${m.maxDv} m/s</span>` : '<span class="tag">Haul</span>')
        : m.type === 'pax' ? `<span class="tag">${m.pickup ? 'Pickup' : 'Passengers'} · ${m.n}</span>` : m.type === 'crew' ? `<span class="tag warn">Crew change · needs a shuttle drone</span>` : '<span class="tag ok">Delivery</span>';
      return `<li class="mission"><div>${tag}<b>${esc(RF.missionShort(m))}</b><span class="muted">${esc(RF.missionDetail(m))}</span></div>
        <div class="m-side"><span class="num reward">${kr(m.reward)}</span>
        <button class="btn sm" data-act="accept" data-id="${m.id}" ${block ? 'disabled' : ''}>${block || 'Accept'}</button></div></li>`;
    }).join('');
    const seatInfo = cap ? `<p class="small">Passenger seats: <b>${cap - seats}</b> taken of <b>${cap}</b>.</p>` : '<p class="small muted">This ship has no passenger seats. Passenger cabins and habitat modules are under Equipment → Passengers.</p>';
    return `<h3>Active</h3><ul class="missions">${activeHtml}</ul><h3>Contract board</h3>${seatInfo}<ul class="missions">${offerHtml}</ul>`;
  }

  // ---------- Klikk ----------

  function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    RF.Audio.start();
    const act = el.dataset.act, id = el.dataset.id;
    const ship = game.ship;
    const s = ship && ship.s;
    const st = ship && ship.docked;
    switch (act) {
      case 'new': markNewsSeen(); game.start(false); UI.openStation(); break;
      case 'test': markNewsSeen(); game.start(false, true); UI.openStation(); break;
      case 'continue': markNewsSeen(); game.start(true); UI.openStation(); break;
      case 'news': UI.openNews(); break;
      case 'help': UI.openHelp(); break;
      case 'title': UI.openTitle(); break;
      case 'close':
        if (ship && ship.docked) UI.openStation(); else UI.closeAll();
        break;
      case 'mute': RF.Audio.setMuted(!RF.Audio.muted); UI.openPause(); break;
      case 'touch': UI.setTouch(!game.touchUI); UI.openPause(); break;
      case 'quit': game.save(); game.state = 'title'; location.reload(); break;
      case 'money': game.giveMoney(); if (game.ship && game.ship.docked) renderStation(); else UI.openPause(); break;
      case 'respawn': game.respawn(); break;
      case 'dial': game.dial(id); break;
      case 'undock': game.undock(); break;
      case 'tab': { tab = id; const tb = root.querySelector('.tab-body'); if (tb) tb.scrollTop = 0; renderStation(); break; }
      case 'gearcat': gearCat = id; renderStation(); break;
      case 'yardline': yardLine = id; renderStation(); break;
      case 'gearzoom':
        if (id === 'fit') { gearView.zoom = 1; gearView.cx = gearView.cy = null; redrawGear(); } else zoomGear(id === 'in' ? 1.4 : 1 / 1.4);
        break;
      case 'gearbuy': buyGear(id); break;
      case 'gearsell': sellGear(id); break;
      case 'sell': {
        const amt = s.cargo[id];
        const got = amt * game.sellPrice(st.id, id);
        game.credits += got;
        s.cargo[id] = 0;
        game.msg(`Sold ${tonn(amt)} of ${RF.PRODUCTS[id].name.toLowerCase()} for ${kr(got)}`, RF.HUD_COLORS.ok);
        after();
        break;
      }
      case 'sellall': {
        let got = 0;
        for (const k in s.cargo) { got += s.cargo[k] * game.sellPrice(st.id, k); s.cargo[k] = 0; }
        game.credits += got;
        game.msg(`Sold the whole cargo for ${kr(got)}`, RF.HUD_COLORS.ok);
        after();
        break;
      }
      case 'buy': {
        const p = game.buyPrice(st.id, id);
        if (game.credits >= p && ship.holdFree() >= 1) { game.credits -= p; s.cargo[id] += 1; }
        after();
        break;
      }
      case 'rep-hull': case 'rep-lost': case 'rep-fuel': case 'rep-ammo': case 'rep-all':
        repair(act.slice(4));
        after();
        break;
      case 'buyhull':
        if (game.buyHull(id)) { game.msg(`You now fly the ${RF.HULLS[id].name}`, RF.HUD_COLORS.ok); RF.Audio.blip(740, 0.2, 'triangle', 0.12); }
        renderStation();
        break;
      case 'buydrone': {
        const T = RF.DRONE_TYPES[id];
        if (game.credits >= T.cost && RF.fitDrones(s.layout, ship.stats, s.drones.concat([{ type: id }])).ok) { game.credits -= T.cost; s.drones.push({ type: id }); }
        after();
        break;
      }
      case 'selldrone': {
        const d = s.drones[Number(id)];
        if (d && !d.trip) { game.credits += RF.DRONE_TYPES[d.type].cost * 0.6; s.drones.splice(Number(id), 1); }
        after();
        break;
      }
      case 'trip': { const d = s.drones[Number(id)]; if (d) d.trip = { end: Date.now() + TRIP / (ship.stats.droneMul || 1) }; after(); break; }
      case 'tripdone': { const d = s.drones[Number(id)]; if (d && d.trip && Date.now() >= d.trip.end) tripResult(d); after(); break; }
      case 'accept': {
        const board = game.boards[st.id];
        const m = board.find((x) => x.id === Number(id));
        if (!m) break;
        m.status = 'aktiv';
        game.boards[st.id] = board.filter((x) => x !== m);
        game.missions.push(m);
        if (m.type === 'frakt') s.missionCargo.push({ missionId: m.id, name: m.goods, mass: m.mass });
        // Passasjerer og mannskap går om bord med en gang hvis de er her.
        if ((m.type === 'pax' || m.type === 'crew') && m.from === st.id) { const k = Math.min(m.wait, game.paxFree()); m.wait -= k; m.aboard += k; }
        game.msg('Contract accepted: ' + RF.missionTitle(m), RF.HUD_COLORS.gate);
        after();
        break;
      }
      case 'deliver': {
        const m = game.missions.find((x) => x.id === Number(id));
        if (!m || s.cargo[m.product] < m.amount - 1e-6) break;
        s.cargo[m.product] = Math.max(0, s.cargo[m.product] - m.amount);
        game.credits += m.reward;
        m.status = 'fullført';
        game.missions = game.missions.filter((x) => x.status === 'aktiv');
        game.msg(`Contract complete (+${kr(m.reward)})`, RF.HUD_COLORS.ok);
        after();
        break;
      }
      case 'abandon': {
        const m = game.missions.find((x) => x.id === Number(id));
        if (!m) break;
        game.missions = game.missions.filter((x) => x !== m);
        s.missionCargo = s.missionCargo.filter((c) => c.missionId !== m.id);
        game.msg('Contract abandoned', RF.HUD_COLORS.amber);
        after();
        break;
      }
    }
  }

  function after() {
    game.ship.updateMass();
    game.save();
    renderStation();
  }

  // Betal for så mye som man har råd til.
  function repair(what) {
    const ship = game.ship, s = ship.s, st = ship.stats;
    const items = what === 'all' ? ['hull', 'lost', 'fuel', 'ammo'] : [what];
    for (const it of items) {
      if (it === 'hull') {
        for (const m of s.layout) {
          const miss = RF.MODULES[m.t].hp - m.hp;
          const pts = Math.min(miss, game.credits / 6);
          m.hp += pts; game.credits -= pts * 6;
        }
      } else if (it === 'lost') {
        for (const m of missingModules()) {
          const c = RF.MODULES[m.t].cost;
          if (game.credits < c) break;
          game.credits -= c;
          s.layout.push({ t: m.t, x: m.x, y: m.y, hp: RF.MODULES[m.t].hp });
        }
        // Moduler som ikke henger sammen ennå (fordi pengene tok slutt) refunderes.
        for (const m of RF.disconnected(s.layout)) { game.credits += RF.MODULES[m.t].cost; s.layout = s.layout.filter((x) => x !== m); }
        ship.rebuild();
        const dp = RF.dockPoint(ship.docked);
        Object.assign(ship.body, { x: dp.x, y: dp.y, a: dp.a, vx: 0, vy: 0, w: 0 });
      } else if (it === 'fuel') {
        const kg = Math.min(st.fuelCap - s.fuel, game.credits / 0.9);
        s.fuel += kg; game.credits -= kg * 0.9;
      } else if (it === 'ammo') {
        while (s.ammo < ship.stats.rocketCap && game.credits >= 120) { s.ammo++; game.credits -= 120; }
      }
    }
    ship.refreshStats();
    game.credits = Math.max(0, game.credits);
    RF.Audio.blip(440, 0.1, 'triangle', 0.1);
  }

  RF.UI = UI;
})();
