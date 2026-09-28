// Tastatur og berøringskontroller samlet i én tilstand.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});

  const keys = new Set();
  const pressed = new Set(); // tast trykket ned denne rammen
  const touch = { retro: 0, sl: 0, sr: 0, fire: 0, winch: 0, winchOut: 0, aim: null, aimThrust: 0 };
  let pinching = false;

  const Input = {
    keys, touch,
    down: (k) => keys.has(k),
    hit: (k) => pressed.has(k),
    endFrame: () => pressed.clear(),
    press: (k) => pressed.add(k),
    state() {
      const d = (k) => keys.has(k);
      const thrust = d('KeyW') || d('ArrowUp') ? 1 : 0;
      // Brems stopper skipet i fartsretningen, uansett hvor nesen peker.
      const brake = d('KeyS') || d('ArrowDown') || !!touch.retro;
      const turn = (d('KeyD') || d('ArrowRight') ? 1 : 0) - (d('KeyA') || d('ArrowLeft') ? 1 : 0);
      const strafe = (d('KeyE') || touch.sr ? 1 : 0) - (d('KeyQ') || touch.sl ? 1 : 0);
      return {
        thrust, turn, strafe, brake,
        fire: d('Space') || !!touch.fire,
        winch: d('KeyC') || !!touch.winch,
        winchOut: d('KeyV') || !!touch.winchOut,
        aim: turn === 0 ? touch.aim : null,
        aimThrust: touch.aimThrust,
      };
    },
  };

  const GAME_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    for (const k in touch) touch[k] = 0;
    touch.aim = null;
  });

  // Knapper med data-hold="navn" holdes inne, data-tap="Kode" gir ett trykk.
  Input.bindTouch = (root) => {
    root.querySelectorAll('[data-hold]').forEach((el) => {
      const name = el.dataset.hold;
      const on = (e) => {
        e.preventDefault();
        touch[name] = 1;
        if (el.dataset.tap) pressed.add(el.dataset.tap);
        el.classList.add('on');
        if (el.setPointerCapture && e.pointerId != null) {
          try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignorer */ }
        }
      };
      const off = (e) => {
        e.preventDefault();
        touch[name] = 0;
        el.classList.remove('on');
      };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    root.querySelectorAll('[data-tap]:not([data-hold])').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressed.add(el.dataset.tap);
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  };

  // Styrespak: legg tommelen hvor som helst i feltet og dra. Retningen du
  // drar er retningen skipet skal peke; drar du langt, gir det gass.
  // Styrespaken står fast i sirkelen nede til venstre. Retningen man drar
  // snur skipet, drar man langt ut gir den gass.
  Input.bindStick = (zone, base, knob) => {
    let id = null, ox = 0, oy = 0;
    const R = 64;
    const center = () => {
      const r = zone.getBoundingClientRect();
      ox = r.left + r.width / 2; oy = r.top + r.height / 2;
    };
    // Sokkel og knott står midt i sirkelen (CSS); knotten flyttes relativt.
    const place = (kx, ky) => { knob.style.transform = `translate(${kx - ox}px, ${ky - oy}px)`; };
    const rest = () => { knob.style.transform = ''; };
    const move = (e) => {
      if (pinching) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      place(ox + dx, oy + dy);
      if (d > 12) {
        touch.aim = Math.atan2(dy, dx);
        touch.aimThrust = Math.max(0, Math.min(1, (d - 34) / (R - 34)));
      } else {
        touch.aim = null;
        touch.aimThrust = 0;
      }
      zone.classList.toggle('thrust', touch.aimThrust > 0);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      e.stopPropagation();
      id = e.pointerId;
      center();
      zone.classList.add('active');
      try { zone.setPointerCapture(id); } catch (_) { /* ignorer */ }
      move(e);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      e.preventDefault();
      move(e);
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      touch.aim = null;
      touch.aimThrust = 0;
      zone.classList.remove('active', 'thrust');
      rest();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  };

  // Knip med to fingre for å zoome (ikke når fingrene står på knapper).
  const isButton = (t) => t && t.closest && t.closest('button, #panel');
  let pinch0 = 0;
  const pdist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2 && !isButton(e.touches[0].target) && !isButton(e.touches[1].target)) {
      pinching = true;
      pinch0 = pdist(e);
      pointer.down = false;
      pointer.id = null;
      touch.aim = null;
      touch.aimThrust = 0;
    }
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!pinching || e.touches.length < 2) return;
    const d = pdist(e);
    if (pinch0 > 0 && Input.onPinch) Input.onPinch(d / pinch0);
    pinch0 = d;
  }, { passive: true });
  window.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinching = false; }, { passive: true });

  // Musen eller en finger på skjermen utenfor styrespaken og knappene.
  // Spillet avgjør hva et trykk betyr (se game.js): kort trykk = fly dit
  // eller lås siktet, dra = flytt kameraet, hold = sikt og skyt.
  // panX/panY samler opp hvor langt pekeren er dratt siden forrige ramme.
  // taps: korte trykk som er sluppet, { x, y } i skjermpunkter.
  const pointer = (Input.pointer = {
    x: 0, y: 0, x0: 0, y0: 0, t0: 0, has: false, down: false, id: null, type: 'mouse', presses: 0,
    moved: false, button: 0, panX: 0, panY: 0, taps: [],
  });
  Input.bindAim = (canvas, onTapFirst) => {
    let lx = 0, ly = 0;
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' || e.pointerId === pointer.id) {
        pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true;
      }
      if (e.pointerId === pointer.id && pointer.down && !pinching) {
        if (Math.hypot(e.clientX - pointer.x0, e.clientY - pointer.y0) > 12) pointer.moved = true;
        pointer.panX += e.clientX - lx; pointer.panY += e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (onTapFirst && onTapFirst(e)) return;
      if (pinching || pointer.id !== null) return;
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true;
      pointer.x0 = lx = e.clientX; pointer.y0 = ly = e.clientY;
      pointer.t0 = performance.now();
      pointer.type = e.pointerType || 'mouse';
      pointer.button = e.button || 0;
      pointer.moved = false;
      pointer.panX = pointer.panY = 0;
      pointer.down = true;
      pointer.id = e.pointerId;
      pointer.presses++;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignorer */ }
    });
    const up = (e) => {
      if (e.pointerId !== pointer.id) return;
      if (!pointer.moved && !pinching && pointer.button === 0 && performance.now() - pointer.t0 < 320) {
        pointer.taps.push({ x: pointer.x0, y: pointer.y0, press: pointer.presses });
      }
      pointer.down = false;
      pointer.id = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  };

  RF.Input = Input;
})();
