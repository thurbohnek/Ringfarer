// Tegning av moduler og modulære skip (spiller, arbeidsskip, vrak og i
// skipsbyggeren). Hver modul tegnes i en rute på CELL meter med +x forover.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});
  const G = RF.G;
  const CELL = RF.CELL;
  const h = CELL / 2;

  const C = {
    hi: '#d3d5d6', light: '#b4b8bb', mid: '#83888d', dark: '#44484c', darker: '#26292c', black: '#131516',
    yellow: '#e2b43a', red: '#b8352a', glass: ['#9ed6e8', '#2c6b86', '#0b2430'],
  };

  function plate(ctx, top, bot, inset = 0.06) {
    const g = ctx.createLinearGradient(-h, -h, h, h);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(-h + inset, -h + inset, CELL - inset * 2, CELL - inset * 2);
    // Avfaset kant: lys oppe til venstre, mørk nede til høyre.
    ctx.lineWidth = 0.08;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(-h + inset, h - inset); ctx.lineTo(-h + inset, -h + inset); ctx.lineTo(h - inset, -h + inset); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.moveTo(h - inset, -h + inset); ctx.lineTo(h - inset, h - inset); ctx.lineTo(-h + inset, h - inset); ctx.stroke();
  }

  function bolts(ctx, r = 0.85) {
    ctx.fillStyle = 'rgba(20,22,24,0.7)';
    for (const [x, y] of [[-r, -r], [r, -r], [r, r], [-r, r]]) {
      ctx.beginPath(); ctx.arc(x, y, 0.09, 0, Math.PI * 2); ctx.fill();
    }
  }

  function hazard(ctx, x, y, w, hh) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, hh); ctx.clip();
    ctx.fillStyle = C.yellow;
    ctx.fillRect(x, y, w, hh);
    ctx.fillStyle = C.black;
    for (let i = -4; i < 8; i++) {
      const sx = x + i * 0.36;
      ctx.beginPath(); ctx.moveTo(sx, y + hh); ctx.lineTo(sx + 0.18, y + hh); ctx.lineTo(sx + 0.18 + hh, y); ctx.lineTo(sx + hh, y); ctx.fill();
    }
    ctx.restore();
  }

  function circle(ctx, x, y, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 0.08; ctx.stroke(); }
  }

  function barrel(ctx, y, w, len, col) {
    ctx.fillStyle = col || C.darker;
    ctx.fillRect(0, y - w / 2, len, w);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, y - w / 2, len, w * 0.25);
  }

  const DRAW = {
    cockpit(ctx) {
      plate(ctx, C.hi, C.mid);
      ctx.beginPath();
      ctx.moveTo(-0.1, -0.85); ctx.lineTo(h - 0.05, -0.55); ctx.lineTo(h - 0.05, 0.55); ctx.lineTo(-0.1, 0.85); ctx.closePath();
      const g = ctx.createLinearGradient(-0.1, -0.8, h, 0.8);
      g.addColorStop(0, C.glass[0]); g.addColorStop(0.45, C.glass[1]); g.addColorStop(1, C.glass[2]);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = C.darker; ctx.lineWidth = 0.14; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0.55, -0.7); ctx.lineTo(0.55, 0.7); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.moveTo(0.9, -0.45); ctx.lineTo(0.7, -0.6); ctx.stroke();
      hazard(ctx, -h + 0.15, -0.35, 0.35, 0.7);
      bolts(ctx);
    },
    frame(ctx) {
      ctx.fillStyle = 'rgba(30,33,36,0.85)';
      ctx.fillRect(-h + 0.1, -h + 0.1, CELL - 0.2, CELL - 0.2);
      ctx.strokeStyle = C.light; ctx.lineWidth = 0.2;
      ctx.strokeRect(-h + 0.2, -h + 0.2, CELL - 0.4, CELL - 0.4);
      ctx.lineWidth = 0.12;
      ctx.beginPath(); ctx.moveTo(-h + 0.2, -h + 0.2); ctx.lineTo(h - 0.2, h - 0.2); ctx.moveTo(h - 0.2, -h + 0.2); ctx.lineTo(-h + 0.2, h - 0.2); ctx.stroke();
      circle(ctx, 0, 0, 0.18, C.mid);
    },
    armor(ctx) {
      plate(ctx, C.hi, C.mid);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-0.75, -0.75, 1.5, 1.5);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 0.06;
      ctx.strokeRect(-0.75, -0.75, 1.5, 1.5);
      hazard(ctx, -h + 0.1, h - 0.45, 0.6, 0.3);
      bolts(ctx);
    },
    armor2(ctx) {
      plate(ctx, C.mid, C.dark);
      hazard(ctx, -h + 0.1, -0.2, CELL - 0.2, 0.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.08;
      ctx.strokeRect(-0.95, -0.95, 1.9, 1.9);
      bolts(ctx, 0.95); bolts(ctx, 0.55);
    },
    shield(ctx) {
      plate(ctx, C.light, C.dark);
      const g = ctx.createRadialGradient(-0.2, -0.2, 0.05, 0, 0, 0.85);
      g.addColorStop(0, '#dff6ff'); g.addColorStop(0.5, '#3f9fd0'); g.addColorStop(1, '#0d2c40');
      circle(ctx, 0, 0, 0.8, g, C.darker);
      circle(ctx, 0, 0, 0.3, 'rgba(160,230,255,0.9)');
      bolts(ctx);
    },
    thruster(ctx) {
      plate(ctx, C.light, C.dark);
      ctx.fillStyle = C.darker;
      ctx.beginPath(); ctx.moveTo(-h, -0.95); ctx.lineTo(-0.1, -0.6); ctx.lineTo(-0.1, 0.6); ctx.lineTo(-h, 0.95); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.mid; ctx.lineWidth = 0.08;
      for (const x of [-0.9, -0.55, -0.25]) { ctx.beginPath(); ctx.moveTo(x, -0.75); ctx.lineTo(x, 0.75); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 4; i++) ctx.fillRect(0.2, -0.7 + i * 0.4, 0.8, 0.18);
    },
    thruster2(ctx) {
      plate(ctx, C.mid, C.darker);
      for (const y of [-0.6, 0.6]) {
        ctx.fillStyle = C.black;
        ctx.beginPath(); ctx.moveTo(-h, y - 0.55); ctx.lineTo(0, y - 0.35); ctx.lineTo(0, y + 0.35); ctx.lineTo(-h, y + 0.55); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = C.mid; ctx.lineWidth = 0.08; ctx.stroke();
      }
      hazard(ctx, 0.35, -h + 0.15, 0.4, CELL - 0.3);
    },
    rcs(ctx) {
      plate(ctx, C.light, C.mid);
      ctx.fillStyle = C.darker;
      for (const [x, y] of [[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9], [-0.9, 0.9]]) ctx.fillRect(x - 0.22, y - 0.22, 0.44, 0.44);
      ctx.fillStyle = C.yellow;
      ctx.fillRect(-0.3, -0.3, 0.6, 0.6);
      ctx.fillStyle = C.darker;
      ctx.fillRect(-0.15, -0.15, 0.3, 0.3);
    },
    fuel(ctx) {
      plate(ctx, C.mid, C.dark);
      ctx.fillStyle = '#e4e6e7';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-1, -0.7, 2, 1.4, 0.7) : ctx.rect(-1, -0.7, 2, 1.4); ctx.fill();
      ctx.fillStyle = C.red;
      ctx.fillRect(-0.2, -0.7, 0.35, 1.4);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.moveTo(-0.9, 0.35); ctx.lineTo(0.9, 0.35); ctx.stroke();
    },
    cargo(ctx) {
      plate(ctx, '#c9b98e', '#8d7d55');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.1;
      for (let x = -0.9; x <= 0.95; x += 0.36) { ctx.beginPath(); ctx.moveTo(x, -1); ctx.lineTo(x, 1); ctx.stroke(); }
      ctx.fillStyle = C.darker;
      ctx.fillRect(-0.3, -0.25, 0.6, 0.5);
      bolts(ctx);
    },
    cargo2(ctx) {
      plate(ctx, C.light, C.dark);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = -0.95; x <= 0.9; x += 0.48) ctx.fillRect(x, -1, 0.22, 2);
      hazard(ctx, -h + 0.12, -h + 0.12, CELL - 0.24, 0.3);
      hazard(ctx, -h + 0.12, h - 0.42, CELL - 0.24, 0.3);
    },
    refinery(ctx) {
      plate(ctx, C.dark, C.darker);
      const g = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.75);
      g.addColorStop(0, '#ffe6a0'); g.addColorStop(0.4, '#ff8a2a'); g.addColorStop(1, '#3a1606');
      circle(ctx, 0, 0, 0.72, g, C.black);
      ctx.strokeStyle = C.mid; ctx.lineWidth = 0.18;
      ctx.beginPath(); ctx.moveTo(-h, -0.8); ctx.lineTo(-0.6, -0.8); ctx.moveTo(h, 0.8); ctx.lineTo(0.6, 0.8); ctx.stroke();
    },
    laser(ctx, m, tier = 1) {
      plate(ctx, C.mid, C.dark);
      const w = 0.4 + tier * 0.1;
      barrel(ctx, 0, w, h + 0.05);
      ctx.fillStyle = C.darker;
      ctx.fillRect(-0.9, -0.7, 0.9, 1.4);
      const col = ['#ff9a3c', '#ff4a3a', '#be6eff', '#78ffdc'][tier - 1];
      circle(ctx, h - 0.1, 0, w * 0.45, col);
      if (tier >= 3) {
        ctx.strokeStyle = C.yellow; ctx.lineWidth = 0.1;
        for (const x of [0.25, 0.55, 0.85]) { ctx.beginPath(); ctx.moveTo(x, -w / 2 - 0.08); ctx.lineTo(x, w / 2 + 0.08); ctx.stroke(); }
      }
      if (tier >= 4) {
        ctx.fillStyle = col;
        ctx.fillRect(0.2, -0.75, 1, 0.12); ctx.fillRect(0.2, 0.63, 1, 0.12);
      }
    },
    tractor(ctx) {
      plate(ctx, C.light, C.mid);
      ctx.fillStyle = C.darker;
      ctx.fillRect(0.3, -0.95, 0.85, 1.9);
      ctx.strokeStyle = C.mid; ctx.lineWidth = 0.08;
      for (let y = -0.8; y <= 0.8; y += 0.27) { ctx.beginPath(); ctx.moveTo(0.35, y); ctx.lineTo(1.1, y); ctx.stroke(); }
      circle(ctx, -0.35, 0, 0.5, null, '#6fe0bd');
      circle(ctx, -0.35, 0, 0.22, '#6fe0bd');
    },
    cannon(ctx) {
      plate(ctx, C.mid, C.darker);
      barrel(ctx, -0.4, 0.3, h + 0.35);
      barrel(ctx, 0.4, 0.3, h + 0.35);
      ctx.fillStyle = C.dark;
      ctx.fillRect(-0.9, -0.8, 1.1, 1.6);
      hazard(ctx, -0.8, -0.15, 0.9, 0.3);
    },
    rocket(ctx) {
      plate(ctx, C.light, C.mid);
      ctx.fillStyle = C.darker;
      ctx.fillRect(-0.95, -0.95, 1.9, 1.9);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        circle(ctx, -0.55 + i * 0.55, -0.35 + j * 0.7, 0.2, '#0b0c0d');
        circle(ctx, -0.55 + i * 0.55, -0.35 + j * 0.7, 0.1, C.red);
      }
    },
    anchor(ctx, m, big) {
      plate(ctx, C.mid, C.dark);
      circle(ctx, -0.4, 0, big ? 0.75 : 0.6, C.darker, C.light);
      circle(ctx, -0.4, 0, 0.2, C.mid);
      ctx.fillStyle = '#d8d2c0';
      ctx.beginPath(); ctx.moveTo(h + 0.1, 0); ctx.lineTo(0.35, -0.4); ctx.lineTo(0.5, 0); ctx.lineTo(0.35, 0.4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C.black; ctx.lineWidth = 0.06; ctx.stroke();
      if (big) hazard(ctx, -h + 0.1, h - 0.4, CELL - 0.2, 0.28);
    },
    light(ctx, m, big) {
      plate(ctx, C.mid, C.dark);
      const lens = (y) => {
        const g = ctx.createRadialGradient(h - 0.3, y, 0, h - 0.3, y, 0.4);
        g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#c8b67a');
        ctx.fillStyle = C.darker;
        ctx.fillRect(h - 0.75, y - 0.42, 0.65, 0.84);
        circle(ctx, h - 0.3, y, 0.32, g);
      };
      if (big) { lens(-0.5); lens(0.5); } else lens(0);
      bolts(ctx);
    },
    dronebay(ctx) {
      plate(ctx, C.light, C.mid);
      hazard(ctx, -1, -1, 2, 0.28);
      hazard(ctx, -1, 0.72, 2, 0.28);
      ctx.fillStyle = C.darker;
      ctx.fillRect(-0.8, -0.6, 1.6, 1.2);
      ctx.strokeStyle = C.mid; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.moveTo(0, -0.6); ctx.lineTo(0, 0.6); ctx.stroke();
    },
  };

  // Tegn én modul sentrert i (0,0). m kan være null i butikken (uskadd).
  RF.drawModule = (ctx, t, m) => {
    switch (t) {
      case 'laser': DRAW.laser(ctx, m, 1); break;
      case 'laser2': DRAW.laser(ctx, m, 2); break;
      case 'laser3': DRAW.laser(ctx, m, 3); break;
      case 'laser4': DRAW.laser(ctx, m, 4); break;
      case 'anchor2': DRAW.anchor(ctx, m, true); break;
      case 'light2': DRAW.light(ctx, m, true); break;
      default: (DRAW[t] || DRAW.frame)(ctx, m);
    }
    if (m) {
      const f = m.hp / RF.MODULES[t].hp;
      if (f < 0.6) {
        const g = ctx.createRadialGradient(0.2, 0.1, 0, 0.2, 0.1, 1.3);
        g.addColorStop(0, `rgba(12,8,4,${0.9 * (1 - f)})`);
        g.addColorStop(1, 'rgba(40,20,10,0)');
        ctx.fillStyle = g;
        ctx.fillRect(-h, -h, CELL, CELL);
      }
      if (f < 0.3) {
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.moveTo(-0.9, -0.3); ctx.lineTo(-0.2, 0.1); ctx.lineTo(0.1, -0.5); ctx.lineTo(0.8, 0.4); ctx.stroke();
        circle(ctx, 0.1, -0.5, 0.12, '#ff7a2a');
      }
    }
  };

  // Mørk underplate så modulene flyter sammen til ett skrog.
  function underplate(ctx, layout) {
    ctx.fillStyle = '#16181a';
    for (const m of layout) ctx.fillRect(m.lx - h - 0.08, m.ly - h - 0.08, CELL + 0.16, CELL + 0.16);
  }

  const P = RF.Renderer.prototype;

  P.drawModular = function (obj, time) {
    const ctx = this.ctx, b = obj.body, L = obj.layout;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    // Skygge under skroget.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (const m of L) ctx.fillRect(m.lx - h + 0.5, m.ly - h + 0.5, CELL, CELL);
    underplate(ctx, L);
    for (const m of L) {
      ctx.save();
      ctx.translate(m.lx, m.ly);
      RF.drawModule(ctx, m.t, m);
      ctx.restore();
    }
    // Skitt over det hele.
    const pat = this.grimePattern();
    if (pat.setTransform) pat.setTransform(new DOMMatrix().scale(0.08));
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = pat;
    for (const m of L) ctx.fillRect(m.lx - h, m.ly - h, CELL, CELL);
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  // Flammer, dyser, navigasjonslys og skjold.
  P.drawModularFx = function (obj, time) {
    const ctx = this.ctx, b = obj.body, fx = obj.fx, L = obj.layout;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.a);
    ctx.globalCompositeOperation = 'lighter';
    const flame = (x, y, dx, dy, len, wid) => {
      if (len < 0.15) return;
      const ex = x + dx * len, ey = y + dy * len;
      const g = ctx.createLinearGradient(x, y, ex, ey);
      g.addColorStop(0, 'rgba(235,245,255,0.95)');
      g.addColorStop(0.25, 'rgba(120,180,255,0.75)');
      g.addColorStop(1, 'rgba(40,80,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - dy * wid, y + dx * wid);
      ctx.quadraticCurveTo(ex - dy * wid * 0.4, ey + dx * wid * 0.4, ex, ey);
      ctx.quadraticCurveTo(ex + dy * wid * 0.4, ey - dx * wid * 0.4, x + dy * wid, y - dx * wid);
      ctx.closePath();
      ctx.fill();
    };
    const fl = fx.main * (0.85 + Math.random() * 0.3);
    let maxY = -1e9, minY = 1e9, minX = 1e9;
    for (const m of L) {
      maxY = Math.max(maxY, m.ly); minY = Math.min(minY, m.ly); minX = Math.min(minX, m.lx);
      if (m.t === 'thruster' || m.t === 'thruster2') {
        const big = m.t === 'thruster2';
        const ys = big ? [m.ly - 0.6, m.ly + 0.6] : [m.ly];
        for (const y of ys) {
          flame(m.lx - h, y, -1, 0, (big ? 4 : 3) + fl * (big ? 14 : 10), big ? 0.55 : 0.8);
          if (fl > 0.05) {
            const g = ctx.createRadialGradient(m.lx - h, y, 0, m.lx - h, y, 2 + fl * 2);
            g.addColorStop(0, `rgba(140,190,255,${0.5 * fl})`);
            g.addColorStop(1, 'rgba(60,120,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(m.lx - h, y, 2 + fl * 2, 0, Math.PI * 2); ctx.fill();
          }
        }
      } else if (m.t === 'rcs') {
        flame(m.lx + 0.9, m.ly, 1, 0, fx.retro * 2.5, 0.2);
        flame(m.lx, m.ly - 0.9, 0, -1, fx.right * 2.2 + (m.ly > 0 ? fx.rotL : fx.rotR) * 1.8, 0.18);
        flame(m.lx, m.ly + 0.9, 0, 1, fx.left * 2.2 + (m.ly < 0 ? fx.rotR : fx.rotL) * 1.8, 0.18);
      }
    }
    const blink = (time * 1.2 + (obj.blinkOff || 0)) % 1 < 0.12;
    const light = (x, y, col, r) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    light(minX, minY - h, 'rgba(255,60,50,0.9)', 1.2);
    light(minX, maxY + h, 'rgba(60,255,120,0.9)', 1.2);
    if (blink) light(minX - h, 0, 'rgba(255,245,230,1)', 2.2);
    if (obj.shieldFlash > 0.01) {
      const a = obj.shieldFlash, R = b.radius + 2.5;
      const sg = ctx.createRadialGradient(0, 0, R * 0.7, 0, 0, R);
      sg.addColorStop(0, 'rgba(90,200,255,0)');
      sg.addColorStop(0.85, `rgba(90,200,255,${0.22 * a})`);
      sg.addColorStop(1, `rgba(170,230,255,${0.65 * a})`);
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      const hd = obj.shieldHitDir || 0;
      ctx.strokeStyle = `rgba(200,240,255,${a})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, R - 0.3, hd - 0.5, hd + 0.5); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  };

  // Laserstråler. obj.beams: [{ lx, ly, len, hit, color, w }] i lokale koordinater.
  P.drawBeams = function (obj) {
    const ctx = this.ctx, b = obj.body;
    if (!obj.beams || !obj.beams.length) return;
    const d = b.dirWorld(1, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const B of obj.beams) {
      const p0 = b.toWorld(B.lx, B.ly);
      const p1 = { x: p0.x + d.x * B.len, y: p0.y + d.y * B.len };
      const flick = 0.75 + Math.random() * 0.25;
      ctx.strokeStyle = `rgba(${B.color},${0.35 * flick})`;
      ctx.lineWidth = B.w * 3.5;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.strokeStyle = `rgba(255,240,215,${0.9 * flick})`;
      ctx.lineWidth = B.w;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      if (B.hit) {
        const r = 3 + Math.random() * 1.5;
        const g = ctx.createRadialGradient(B.hit.x, B.hit.y, 0, B.hit.x, B.hit.y, r);
        g.addColorStop(0, 'rgba(255,255,230,1)');
        g.addColorStop(0.3, `rgba(${B.color},0.7)`);
        g.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(B.hit.x, B.hit.y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';
  };

  // Lyskjegler fra lysmodulene: [{ lx, ly, range }].
  RF.lightSources = (obj) => {
    const out = [];
    for (const m of obj.layout) {
      const D = RF.MODULES[m.t];
      if (D.light && !RF.isBlocked(obj.layout, m)) out.push({ lx: m.lx + h, ly: m.ly, range: D.light });
    }
    return out;
  };

  P.drawHaze = function (obj) {
    const ctx = this.ctx, b = obj.body;
    ctx.globalCompositeOperation = 'lighter';
    for (const Ls of obj._lights || []) {
      const n = b.toWorld(Ls.lx, Ls.ly);
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Ls.range);
      g.addColorStop(0, 'rgba(255,236,200,0.12)');
      g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.arc(n.x, n.y, Ls.range, b.a - 0.4, b.a + 0.4); ctx.closePath(); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };
})();
