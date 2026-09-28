// DOM-paneler: tittel, stasjon (marked, verksted, utstyr, verft, droner,
// oppdrag), oppringing av porten, pause, hjelp og vrakskjerm.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;

  let game, root, touchRoot;
  let open = null;
  let tab = 'marked';

  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const kr = (n) => Math.round(n).toLocaleString('nb-NO') + ' kr';
  const t1 = (n, d = 1) => n.toFixed(d).replace('.', ',');
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
        const label = act === 'dock' ? 'DOKK' : act === 'dial' ? 'RING PORT' : act === 'tow' ? 'SLEP' : '';
        if (ctx.textContent !== label) ctx.textContent = label;
        $('#tc-tractor').classList.toggle('on', sh.tractor.on);
        $('#tc-light').classList.toggle('on', sh.lightOn);
        $('#tc-winch').hidden = !sh.anchor;
        $('#tc-winchout').hidden = !sh.anchor;
        const fire = $('#tc-fire');
        const fl = RF.TOOL_NAMES[sh.tool].toUpperCase() + (sh.tool === 'rakett' ? ' ' + sh.s.ammo : '') + (sh.tool === 'anker' && (sh.anchor || sh.harpoon) ? ' LØS' : '');
        if (fire.textContent !== fl) fire.textContent = fl;
        document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === sh.tool));
      }
      touchRoot.hidden = !game.touchUI || game.state !== 'play' || UI.isOpen();
    },

    openTitle() {
      const cont = game.hasSave();
      show('title', `
        <div class="card title-card">
          <p class="eyebrow">Gruvedrift · frakt · ringporten</p>
          <p class="version num">Versjon ${esc(RF.VERSION)}</p>
          <h1>Ringfarer</h1>
          <p class="lede">Bygg ditt eget gruveskip modul for modul. Bor, skyt og spreng deg gjennom asteroider,
          slep kometer etter en wire, send ut droner, og reis gjennom den eldgamle ringporten.
          Alt følger ekte fysikk, og skipet kan miste deler når det blir truffet.</p>
          <div class="row">
            <button class="btn primary" data-act="test" data-autofocus>Test alt</button>
            ${cont ? '<button class="btn" data-act="continue">Fortsett</button>' : ''}
            <button class="btn" data-act="new">Ny karriere</button>
            <button class="btn ghost" data-act="help">Kontroller</button>
          </div>
          <p class="muted small">«Test alt» gir ubegrenset med penger: kontoen fylles opp av seg selv, så du kan handle, kjøpe alle skip, moduler og droner og prøve alt. Ingenting er låst. I pausemenyen og på stasjonen kan du også når som helst gi deg selv 1 000 000 kr.</p>
          ${keyList()}
        </div>`);
    },

    openHelp() {
      const back = game.state === 'play' ? 'close' : 'title';
      show('help', `
        <div class="card plate help-card"><div class="hazard"></div>
          <div class="card-head"><h2>Kontroller og tips</h2><button class="btn ghost" data-act="${back}">✕ Lukk</button></div>
          ${keyList()}
          <h3>Slik fungerer det</h3>
          <ul class="tips">
            <li><b>Sikting:</b> verktøyene sitter i festepunkter på skrogets kant og dreier mot der du trykker eller peker. Hvert tårn når litt over 90° hver vei fra kanten det sitter på. Trådkorset er grønt når minst ett tårn når målet.</li>
            <li><b>Fly dit du trykker:</b> et kort trykk på tomt rom (for eksempel ved siden av en asteroide) setter et mål. Skipet flyr dit og stopper der, og følger steinen hvis målet ligger ved en. Styrer du selv, slås autopiloten av.</li>
            <li><b>Kamera:</b> dra på skjermen for å se deg rundt. Skipet blir alltid værende på skjermen. Trykk på skipet ditt (eller ⋯ → Sentrer kamera, tasten O) for å sentrere igjen.</li>
            <li><b>Skyte:</b> trykk og hold på en stein for å sikte på den og bruke verktøyet. Siktet følger steinen. Hold fingeren stille på tomt rom et øyeblikk for å skyte dit. Avtrekkeren nede til høyre skyter mot siktet.</li>
            <li><b>Mobil:</b> styrespaken er sirkelen nede til venstre: dra for å snu, dra langt ut for å gi gass.</li>
            <li><b>Brems:</b> BREMS (eller S) bruker alle motorene til å stoppe skipet i den retningen det faktisk beveger seg, uansett hvor nesen peker.</li>
            <li><b>Huler:</b> steinene er bygget av små biter. Laseren slår løs biter som passer i hullet de etterlater, så du kan bore tunneler og fly inn i store asteroider. Noen store asteroider har allerede en hule. Raketter slår ut store krater.</li>
            <li><b>Zoom:</b> knip med to fingre på mobil, musehjul eller + og − på PC.</li>
            <li><b>Knapper på mobil:</b> de små knappene bytter verktøy, ⋯ har lys, flygeassistent, droner og pause.</li>
            <li><b>Hardhet:</b> hver bergart har en hardhet fra 1 til 4. Laseren må ha minst samme nivå. Kanon og raketter knuser alt.</li>
            <li><b>Islag:</b> noen asteroider og kometer har is utenpå og et verdifullt mineral inni.</li>
            <li><b>Anker:</b> kroken skytes ut på en wire og fester seg i det den treffer. Vinsj inn for å lande, eller gi gass og slep kometen dit du vil.</li>
            <li><b>Skade:</b> modulene som blir truffet tar skade og kan falle av. Mister du cockpiten, er skipet tapt. Vrakdeler kan samles inn med traktoren og selges som skrap.</li>
            <li><b>Utstyr:</b> på stasjonen kjøper du lasere, borehoder, kanoner, raketter, anker, lys, lasterom og mer. Det monteres automatisk der det er plass på skroget og synes på skipet. Trenger du mer plass, kjøper du et større skip på verftet.</li>
            <li><b>Droner:</b> kjøp en dronehangar og en drone. Gruvedronen borer og leverer malm til deg, reparasjonsdronen reparerer skipet. De kan også sendes på tokt fra stasjonen.</li>
          </ul>
          <div class="row"><button class="btn primary" data-act="${back}" data-autofocus>Tilbake</button></div>
        </div>`);
    },

    openPause() {
      const act = game.missions.filter((m) => m.status === 'aktiv');
      show('pause', `
        <div class="card plate narrow"><div class="hazard"></div>
          <h2>Pause</h2>
          ${act.length ? `<h3>Aktive oppdrag</h3><ul class="plain">${act.map((m) => `<li>${esc(RF.missionShort(m))} <span class="reward num">${kr(m.reward)}</span></li>`).join('')}</ul>` : ''}
          <div class="col">
            <button class="btn primary" data-act="close" data-autofocus>Fortsett</button>
            <button class="btn" data-act="help">Kontroller</button>
            <button class="btn" data-act="money">Gi meg 1 000 000 kr</button>
            <button class="btn" data-act="mute">${RF.Audio.muted ? 'Slå på lyd' : 'Slå av lyd'}</button>
            <button class="btn" data-act="touch">${game.touchUI ? 'Skjul berøringskontroller' : 'Vis berøringskontroller'}</button>
            <button class="btn ghost" data-act="quit">Til tittelskjermen</button>
          </div>
        </div>`);
    },

    openDead() {
      const fee = Math.min(game.credits, 300 + Math.round(game.credits * 0.1));
      show('dead', `
        <div class="card plate narrow danger"><div class="hazard"></div>
          <p class="eyebrow">Cockpiten er borte</p>
          <h2>Skipet er tapt</h2>
          <p>Redningskapselen ble plukket opp. Forsikringen bygger skipet opp igjen etter siste tegning ved
          ${esc(RF.stationName(game.lastStation))}.</p>
          <p class="muted">Egenandel ${kr(fee)}. Last, fraktoppdrag og droner som var ute, er tapt.</p>
          <div class="row"><button class="btn primary" data-act="respawn" data-autofocus>Ta over nytt skip</button></div>
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
          <p class="eyebrow">Oppringingsenhet · ${esc(game.sys.def.name)}</p>
          <h2>Velg adresse</h2>
          <div class="dests">${rows}</div>
          <p class="muted small">Når sju chevroner er låst, skyter en virvel ut foran porten. Hold deg unna den, og fly så inn forfra.</p>
          <div class="row"><button class="btn ghost" data-act="close">Avbryt</button></div>
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
      ${k(['W'], 'Hovedmotor')}
      ${k(['S'], 'Brems (stopper i fartsretningen)')}
      ${k(['A', 'D'], 'Drei skipet')}
      ${k(['Q', 'E'], 'Sidestyring')}
      ${k(['1', '2', '3', '4'], 'Velg laser, kanon, rakett, anker')}
      ${k(['Mus'], 'Sikt. Klikk på tomt rom: fly dit. Klikk og hold på stein: skyt')}
      ${k(['Dra'], 'Flytt kameraet (også høyre musknapp)')}
      ${k(['O'], 'Sentrer kameraet på skipet')}
      ${k(['Mellomrom'], 'Bruk verktøyet')}
      ${k(['X'], 'Skyt ut / løsne ankeret')}
      ${k(['C', 'V'], 'Vinsj inn / gi ut wire')}
      ${k(['F'], 'Traktorstråle av/på')}
      ${k(['K'], 'Send ut / kall inn droner')}
      ${k(['L'], 'Arbeidslys av/på')}
      ${k(['Z'], 'Flygeassistent')}
      ${k(['T', 'G'], 'Dokk / ring porten')}
      ${k(['+', '−'], 'Zoom (eller musehjul)')}
      ${k(['Esc'], 'Pause')}
    </div>`;
  }

  // ---------- Stasjonen ----------

  function renderStation() {
    const ship = game.ship, s = ship.s, st = ship.docked;
    if (!st) return;
    const tabs = [['marked', 'Marked'], ['verksted', 'Verksted'], ['utstyr', 'Utstyr'], ['verft', 'Verft'], ['droner', 'Droner'], ['oppdrag', 'Oppdrag']];
    let body = '';
    if (tab === 'marked') body = marketTab(st);
    else if (tab === 'verksted') body = repairTab();
    else if (tab === 'utstyr') body = gearTab();
    else if (tab === 'verft') body = yardTab();
    else if (tab === 'droner') body = droneTab();
    else body = missionsTab(st);
    const scroll = root.querySelector('.tab-body');
    const y = scroll ? scroll.scrollTop : 0;
    show('station', `
      <div class="card plate station"><div class="hazard"></div>
        <header class="st-head">
          <div>
            <p class="eyebrow">Dokket · ${esc(game.sys.def.name)} · ${esc(RF.HULLS[s.hull].name)}</p>
            <h2>${esc(st.name)}</h2>
          </div>
          <div class="wallet-wrap">
            <div class="wallet"><span class="num">${Math.floor(game.credits).toLocaleString('nb-NO')}</span><span class="muted">kreditter${game.testMode ? ' · ubegrenset' : ''}</span></div>
            <button class="btn sm ghost" data-act="money">+1 000 000 kr</button>
          </div>
        </header>
        <div class="hold-line">
          <span>Last ${tonn(RF.cargoMass(s))} / ${ship.stats.hold} t</span>
          <span>Skrog ${Math.round(ship.hullFrac() * 100)} %</span>
          <span>Drivstoff ${Math.round((s.fuel / (ship.stats.fuelCap || 1)) * 100)} %</span>
          <span>Raketter ${s.ammo}/${ship.stats.rocketCap}</span>
        </div>
        <nav class="tabs" role="tablist">
          ${tabs.map(([id, name]) => `<button role="tab" class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-id="${id}" aria-selected="${tab === id}">${name}</button>`).join('')}
        </nav>
        <div class="tab-body">${body}</div>
        <footer class="row end"><button class="btn primary" data-act="undock" data-autofocus>Forlat stasjonen</button></footer>
      </div>`);
    const nb = root.querySelector('.tab-body');
    if (nb) nb.scrollTop = y;
    if (tab === 'utstyr') drawGear();
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
        <td class="num" data-l="Om bord">${tonn(have)}</td>
        <td class="num" data-l="Selg kr/t">${sell}</td>
        <td class="num" data-l="Kjøp kr/t">${buy}</td>
        <td class="acts">
          <button class="btn sm" data-act="sell" data-id="${k}" ${have < 0.005 ? 'disabled' : ''}>Selg alt</button>
          <button class="btn sm ghost" data-act="buy" data-id="${k}" ${canBuy < 1 ? 'disabled' : ''}>Kjøp 1 t</button>
        </td></tr>`;
    }).join('');
    const mc = s.missionCargo.length
      ? `<p class="muted small">Oppdragslast om bord: ${s.missionCargo.map((c) => `${esc(c.name)} (${c.mass} t)`).join(', ')}</p>` : '';
    let total = 0;
    for (const k in s.cargo) total += s.cargo[k] * game.sellPrice(st.id, k);
    return `<div class="table-wrap"><table>
      <thead><tr><th>Vare</th><th class="num">Om bord</th><th class="num">Selg kr/t</th><th class="num">Kjøp kr/t</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      ${mc}
      <div class="row"><button class="btn" data-act="sellall" ${total < 1 ? 'disabled' : ''}>Selg hele lasten (${kr(total)})</button></div>`;
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
    const fuel = (st.fuelCap - s.fuel) * 0.9;
    const ammo = (st.rocketCap - s.ammo) * 120;
    return { rep: Math.ceil(rep), dmg, lost, rebuild, fuel: Math.ceil(fuel), ammo };
  }

  function repairTab() {
    const c = repairCosts();
    const row = (label, val, cost, act) => `<tr><td>${label}</td><td class="num">${val}</td>
      <td class="acts"><button class="btn sm" data-act="${act}" ${cost <= 0 || game.credits < 1 ? 'disabled' : ''}>${cost > 0 ? 'Fiks · ' + kr(cost) : 'OK'}</button></td></tr>`;
    const lostList = c.lost.length ? `<p class="muted small">Tapte moduler: ${c.lost.map((m) => esc(RF.MODULES[m.t].name)).join(', ')}</p>` : '';
    return `<div class="table-wrap"><table><tbody>
      ${row('Skadde moduler', c.dmg + ' stk', c.rep, 'rep-hull')}
      ${row('Tapte moduler (bygg opp etter tegningen)', c.lost.length + ' stk', c.rebuild, 'rep-lost')}
      ${row('Drivstoff', Math.round((game.ship.s.fuel / (game.ship.stats.fuelCap || 1)) * 100) + ' %', c.fuel, 'rep-fuel')}
      ${row('Raketter', game.ship.s.ammo + ' / ' + game.ship.stats.rocketCap, c.ammo, 'rep-ammo')}
      </tbody></table></div>
      ${lostList}
      <p class="muted small">Tegningen er skipet slik det var sist du forlot en stasjon eller endret utstyret.</p>
      <div class="row"><button class="btn" data-act="rep-all" ${c.rep + c.rebuild + c.fuel + c.ammo <= 0 ? 'disabled' : ''}>Fiks alt (${kr(c.rep + c.rebuild + c.fuel + c.ammo)})</button></div>`;
  }

  // ---------- Utstyr ----------
  // Utstyr kjøpes her og monteres automatisk der det er plass på skroget.
  // Alt som er montert synes på skipet.

  function gearTab() {
    const ship = game.ship, s = ship.s, st = ship.stats;
    const g = RF.layoutGeometry(s.layout);
    const full = g.dryMass + st.fuelCap + st.hold * 1000;
    const warn = st.blocked.map((m) => `${RF.MODULES[m.t].name} ${RF.MODULES[m.t].mount ? 'har ingen fri kant å peke ut av' : 'har ikke åpen plass bak seg'}`);
    if (!st.thrusters.length) warn.push('Ingen motor med fri eksos');
    const count = {};
    for (const m of s.layout) count[m.t] = (count[m.t] || 0) + 1;
    const B = RF.hullBounds(s.hull);
    const cells = (B.x1 - B.x0 + 1) * (B.y1 - B.y0 + 1);
    const cats = [...new Set(Object.values(RF.MODULES).filter((m) => !m.unique).map((m) => m.cat))];
    const list = cats.map((c) => `<h3>${esc(c)}</h3><ul class="missions">${Object.keys(RF.MODULES).filter((k) => RF.MODULES[k].cat === c && !RF.MODULES[k].unique).map((k) => {
      const M = RF.MODULES[k], n = count[k] || 0;
      return `<li class="mission gear"><canvas class="pal-ico" data-mod="${k}" width="56" height="56"></canvas>
        <div><b>${esc(M.name)}</b><span class="muted">${esc(M.desc)}</span>
        <span class="muted small num">Om bord: ${n}</span></div>
        <div class="m-side"><span class="num reward">${kr(M.cost)}</span>
          <button class="btn sm" data-act="gearbuy" data-id="${k}" ${game.credits < M.cost ? 'disabled' : ''}>Kjøp og monter</button>
          <button class="btn sm ghost" data-act="gearsell" data-id="${k}" ${n ? '' : 'disabled'}>Selg én</button></div></li>`;
    }).join('')}</ul>`).join('');
    return `
      <div class="gear-top">
        <canvas id="gear-canvas" aria-label="Skipet ditt med alt utstyret"></canvas>
        <div class="ed-side">
          <p class="small">Utstyret monteres automatisk der det er plass på skroget. Verktøy og våpen settes i kanten og peker ut, motorer bakerst. Alt du kjøper synes på skipet.</p>
          <dl class="stats">
            <dt>Plass på skroget</dt><dd class="num">${s.layout.length} / ${cells} ruter</dd>
            <dt>Tørrvekt</dt><dd class="num">${t1(g.dryMass / 1000)} t</dd>
            <dt>Skyvekraft</dt><dd class="num">${Math.round(st.thrust / 1000)} kN</dd>
            <dt>Akselerasjon</dt><dd class="num">${t1(st.thrust / (g.dryMass + st.fuelCap))} / ${t1(st.thrust / full)} m/s² (full)</dd>
            <dt>Lasterom</dt><dd class="num">${st.hold} t</dd>
            <dt>Skjold</dt><dd class="num">${st.shieldMax}</dd>
            <dt>Laser / bor</dt><dd class="num">${st.lasers.length} / ${st.drills.length}</dd>
            <dt>Våpen</dt><dd class="num">${st.guns.length} kanon, ${st.rockets.length} rakett</dd>
            <dt>Droneplasser</dt><dd class="num">${st.bays}</dd>
          </dl>
          ${warn.length ? `<ul class="warn">${warn.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
      ${list}`;
  }

  function drawGear() {
    const cv = $('#gear-canvas');
    if (cv) RF.drawShipPreview(cv, game.ship);
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
    if (game.credits < M.cost) { game.msg('Du har ikke råd', RF.HUD_COLORS.danger); return; }
    const m = RF.autoPlace(s.layout, s.hull, id);
    if (!m) { game.msg('Ikke plass på skroget. Selg noe, eller kjøp et større skip på verftet', RF.HUD_COLORS.amber); renderStation(); return; }
    game.credits -= M.cost;
    s.layout.push(m);
    game.msg(`${M.name} montert`, RF.HUD_COLORS.ok);
    afterEdit();
  }

  function sellGear(id) {
    const ship = game.ship, s = ship.s, M = RF.MODULES[id];
    const m = RF.autoRemove(s.layout, id);
    if (!m) { game.msg('Kan ikke ta den av uten at skipet faller fra hverandre', RF.HUD_COLORS.amber); return; }
    s.layout = s.layout.filter((o) => o !== m);
    const got = Math.round(M.cost * 0.7 * (m.hp / M.hp));
    game.credits += got;
    game.msg(`Solgte ${M.name.toLowerCase()} for ${kr(got)}`, RF.HUD_COLORS.ok);
    afterEdit();
  }

  function afterEdit() {
    const ship = game.ship;
    ship.rebuild();
    const dp = RF.dockPoint(ship.docked);
    Object.assign(ship.body, { x: dp.x, y: dp.y, a: dp.a, vx: 0, vy: 0, w: 0 });
    ship.s.blueprint = ship.s.layout.map((m) => ({ t: m.t, x: m.x, y: m.y }));
    game.save();
    RF.Audio.blip(620, 0.06, 'square', 0.08);
    renderStation();
  }

  // ---------- Verft ----------

  function yardTab() {
    const cur = game.ship.s.hull;
    const tv = game.tradeInValue();
    return `<p class="small">Innbytteverdi for skipet ditt med alle moduler: <b class="num">${kr(tv)}</b>. Lasten flyttes over så langt det er plass.</p>
      <ul class="missions">${Object.keys(RF.HULLS).map((id) => {
        const H = RF.HULLS[id];
        const L = RF.defaultLayout(id);
        const st = RF.layoutStats(L);
        const g = RF.layoutGeometry(L);
        const price = H.cost - tv;
        const mine = id === cur;
        return `<li class="mission"><div><b>${esc(H.name)}</b>
          <span class="muted">${esc(H.desc)}</span>
          <span class="muted small num">Rutenett ${H.w}×${H.h} · ${L.length} moduler · ${t1(g.dryMass / 1000)} t · last ${st.hold} t · ${Math.round(st.thrust / 1000)} kN</span></div>
          <div class="m-side"><span class="num reward">${kr(H.cost)}</span>
          <button class="btn sm" data-act="buyhull" data-id="${id}" ${mine || game.credits < price ? 'disabled' : ''}>${mine ? 'Ditt skip' : price >= 0 ? 'Kjøp · ' + kr(price) : 'Bytt · få ' + kr(-price)}</button></div></li>`;
      }).join('')}</ul>`;
  }

  // ---------- Droner ----------

  const TRIP = 180000; // 3 minutter

  function droneTab() {
    const ship = game.ship, s = ship.s, bays = ship.stats.bays;
    const now = Date.now();
    const list = s.drones.map((d, i) => {
      const T = RF.DRONE_TYPES[d.type];
      let status = 'Om bord', btn = `<button class="btn sm" data-act="trip" data-id="${i}">Send på tokt (3 min)</button>`;
      if (d.trip) {
        const left = d.trip.end - now;
        if (left > 0) { status = `På tokt, tilbake om ${Math.ceil(left / 60000)} min`; btn = ''; }
        else { status = 'Tilbake fra tokt'; btn = `<button class="btn sm primary" data-act="tripdone" data-id="${i}">Hent resultat</button>`; }
      }
      return `<li class="mission"><div><b>${esc(T.name)}</b><span class="muted">${esc(status)}</span></div>
        <div class="m-side">${btn}<button class="btn sm ghost" data-act="selldrone" data-id="${i}" ${d.trip ? 'disabled' : ''}>Selg</button></div></li>`;
    }).join('');
    const free = bays - s.drones.length;
    return `<p class="small">Dronehangarer på skipet: <b>${bays}</b>. Droner om bord: <b>${s.drones.length}</b>.
      ${bays ? 'Send dem ut i rommet med K (eller ⋯ → Droner på mobil).' : 'Kjøp en dronehangar under Utstyr for å ha plass til droner.'}</p>
      <ul class="missions">${list || '<li class="muted">Ingen droner ennå.</li>'}</ul>
      <h3>Kjøp drone</h3>
      <ul class="missions">${Object.keys(RF.DRONE_TYPES).map((k) => {
        const T = RF.DRONE_TYPES[k];
        return `<li class="mission"><div><b>${esc(T.name)}</b><span class="muted">${esc(T.desc)}</span></div>
          <div class="m-side"><button class="btn sm" data-act="buydrone" data-id="${k}" ${free <= 0 || game.credits < T.cost ? 'disabled' : ''}>${free <= 0 ? 'Ingen ledig hangar' : 'Kjøp · ' + kr(T.cost)}</button></div></li>`;
      }).join('')}</ul>
      <p class="muted small">På tokt drar dronen til fjerne felt og kommer tilbake med malm eller betaling. Omtrent én av ti kommer ikke tilbake.</p>`;
  }

  function tripResult(d) {
    const s = game.ship.s;
    if (Math.random() < 0.1) {
      s.drones = s.drones.filter((x) => x !== d);
      game.msg('Dronen kom aldri tilbake fra toktet', RF.HUD_COLORS.danger);
      return;
    }
    d.trip = null;
    if (d.type === 'gruve') {
      const prod = G.pick(['jern', 'silisium', 'nikkel', 'kobber', 'vann', 'titan']);
      const t = G.rand(3, 9);
      const room = Math.max(0, game.ship.holdFree());
      const take = Math.min(t, room);
      s.cargo[prod] += take;
      const rest = (t - take) * RF.PRODUCTS[prod].price;
      if (rest > 0) game.credits += rest;
      game.msg(`Dronen kom tilbake med ${tonn(t)} ${RF.PRODUCTS[prod].name.toLowerCase()}${rest > 0 ? ' (resten solgt)' : ''}`, RF.HUD_COLORS.ok);
    } else {
      const pay = Math.round(G.rand(900, 2200));
      game.credits += pay;
      game.msg(`Dronen reparerte andre skip og tjente ${kr(pay)}`, RF.HUD_COLORS.ok);
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
        btn = `<button class="btn sm primary" data-act="deliver" data-id="${m.id}" ${ok ? '' : 'disabled'}>${ok ? 'Lever' : 'Mangler ' + tonn(m.amount - s.cargo[m.product])}</button>`;
      }
      return `<li class="mission"><div><b>${esc(RF.missionShort(m))}</b><span class="muted">${esc(RF.missionDetail(m))}</span></div>
        <div class="m-side"><span class="num reward">${kr(m.reward)}</span>${btn}
        <button class="btn sm ghost" data-act="abandon" data-id="${m.id}">Avbryt</button></div></li>`;
    }).join('') : '<li class="muted">Ingen aktive oppdrag.</li>';
    const free = game.ship.holdFree();
    const offerHtml = offers.map((m) => {
      const needs = m.type === 'frakt' ? m.mass : 0;
      const block = active.length >= 3 ? 'Maks 3 aktive' : needs > free + 1e-6 ? 'For lite plass' : '';
      const tag = m.type === 'frakt' ? (m.fragile ? `<span class="tag warn">Skjør · maks ${m.maxDv} m/s</span>` : '<span class="tag">Frakt</span>') : '<span class="tag ok">Levering</span>';
      return `<li class="mission"><div>${tag}<b>${esc(RF.missionShort(m))}</b><span class="muted">${esc(RF.missionDetail(m))}</span></div>
        <div class="m-side"><span class="num reward">${kr(m.reward)}</span>
        <button class="btn sm" data-act="accept" data-id="${m.id}" ${block ? 'disabled' : ''}>${block || 'Ta oppdraget'}</button></div></li>`;
    }).join('');
    return `<h3>Aktive</h3><ul class="missions">${activeHtml}</ul><h3>Oppslagstavla</h3><ul class="missions">${offerHtml}</ul>`;
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
      case 'new': game.start(false); UI.openStation(); break;
      case 'test': game.start(false, true); UI.openStation(); break;
      case 'continue': game.start(true); UI.openStation(); break;
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
      case 'gearbuy': buyGear(id); break;
      case 'gearsell': sellGear(id); break;
      case 'sell': {
        const amt = s.cargo[id];
        const got = amt * game.sellPrice(st.id, id);
        game.credits += got;
        s.cargo[id] = 0;
        game.msg(`Solgte ${tonn(amt)} ${RF.PRODUCTS[id].name.toLowerCase()} for ${kr(got)}`, RF.HUD_COLORS.ok);
        after();
        break;
      }
      case 'sellall': {
        let got = 0;
        for (const k in s.cargo) { got += s.cargo[k] * game.sellPrice(st.id, k); s.cargo[k] = 0; }
        game.credits += got;
        game.msg(`Solgte hele lasten for ${kr(got)}`, RF.HUD_COLORS.ok);
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
        if (game.buyHull(id)) { game.msg(`Du flyr nå ${RF.HULLS[id].name}`, RF.HUD_COLORS.ok); RF.Audio.blip(740, 0.2, 'triangle', 0.12); }
        renderStation();
        break;
      case 'buydrone': {
        const T = RF.DRONE_TYPES[id];
        if (game.credits >= T.cost && s.drones.length < ship.stats.bays) { game.credits -= T.cost; s.drones.push({ type: id }); }
        after();
        break;
      }
      case 'selldrone': {
        const d = s.drones[Number(id)];
        if (d && !d.trip) { game.credits += RF.DRONE_TYPES[d.type].cost * 0.6; s.drones.splice(Number(id), 1); }
        after();
        break;
      }
      case 'trip': { const d = s.drones[Number(id)]; if (d) d.trip = { end: Date.now() + TRIP }; after(); break; }
      case 'tripdone': { const d = s.drones[Number(id)]; if (d && d.trip && Date.now() >= d.trip.end) tripResult(d); after(); break; }
      case 'accept': {
        const board = game.boards[st.id];
        const m = board.find((x) => x.id === Number(id));
        if (!m) break;
        m.status = 'aktiv';
        game.boards[st.id] = board.filter((x) => x !== m);
        game.missions.push(m);
        if (m.type === 'frakt') s.missionCargo.push({ missionId: m.id, name: m.goods, mass: m.mass });
        game.msg('Oppdrag tatt: ' + RF.missionTitle(m), RF.HUD_COLORS.gate);
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
        game.msg(`Oppdrag fullført (+${kr(m.reward)})`, RF.HUD_COLORS.ok);
        after();
        break;
      }
      case 'abandon': {
        const m = game.missions.find((x) => x.id === Number(id));
        if (!m) break;
        game.missions = game.missions.filter((x) => x !== m);
        s.missionCargo = s.missionCargo.filter((c) => c.missionId !== m.id);
        game.msg('Oppdraget ble avbrutt', RF.HUD_COLORS.amber);
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
