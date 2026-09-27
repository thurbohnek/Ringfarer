// Tastatur og berøringskontroller samlet i én tilstand.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});

  const keys = new Set();
  const pressed = new Set(); // tast trykket ned denne rammen
  const touch = { retro: 0, sl: 0, sr: 0, laser: 0, winch: 0, aim: null, aimThrust: 0 };

  const Input = {
    keys, touch,
    down: (k) => keys.has(k),
    hit: (k) => pressed.has(k),
    endFrame: () => pressed.clear(),
    press: (k) => pressed.add(k),
    state() {
      const d = (k) => keys.has(k);
      const thrust = (d('KeyW') || d('ArrowUp') ? 1 : 0) - (d('KeyS') || d('ArrowDown') || touch.retro ? 1 : 0);
      const turn = (d('KeyD') || d('ArrowRight') ? 1 : 0) - (d('KeyA') || d('ArrowLeft') ? 1 : 0);
      const strafe = (d('KeyE') || touch.sr ? 1 : 0) - (d('KeyQ') || touch.sl ? 1 : 0);
      return {
        thrust, turn, strafe,
        laser: d('Space') || !!touch.laser,
        winch: d('KeyC') || !!touch.winch,
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
    root.querySelectorAll('[data-tap]').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressed.add(el.dataset.tap);
      });
      el.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  };

  // Styrespak: legg tommelen hvor som helst i feltet og dra. Retningen du
  // drar er retningen skipet skal peke; drar du langt, gir det gass.
  Input.bindStick = (zone, base, knob) => {
    let id = null, ox = 0, oy = 0;
    const R = 64;
    const place = (x, y, kx, ky) => {
      const r = zone.getBoundingClientRect();
      base.style.transform = `translate(${x - r.left - 70}px, ${y - r.top - 70}px)`;
      knob.style.transform = `translate(${kx - r.left - 28}px, ${ky - r.top - 28}px)`;
    };
    const move = (e) => {
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      place(ox, oy, ox + dx, oy + dy);
      if (d > 14) {
        touch.aim = Math.atan2(dy, dx);
        touch.aimThrust = Math.max(0, Math.min(1, (d - 30) / (R - 30)));
      } else {
        touch.aim = null;
        touch.aimThrust = 0;
      }
      zone.classList.toggle('thrust', touch.aimThrust > 0);
    };
    zone.addEventListener('pointerdown', (e) => {
      if (id !== null) return;
      e.preventDefault();
      id = e.pointerId;
      const r = zone.getBoundingClientRect();
      ox = Math.min(Math.max(e.clientX, r.left + 70), r.right - 70);
      oy = Math.min(Math.max(e.clientY, r.top + 70), r.bottom - 70);
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
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  };

  RF.Input = Input;
})();
