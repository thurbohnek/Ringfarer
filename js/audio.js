// Syntetisert lyd med Web Audio. Ingen lydfiler trengs.
//
// Alt går gjennom en kompressor før høyttaleren, så mange lyder samtidig ikke
// skurrer. Hver kort lyd tones inn over noen millisekunder (ellers klikker
// det). Lyder langt unna skipet blir svakere (A.near).
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});

  const A = { ctx: null, muted: false };
  // Lydstyrken (0–1) huskes i nettleseren.
  let VOL = 0.7;
  try { const v = parseFloat(localStorage.getItem('rf-volume')); if (v >= 0 && v <= 1) VOL = v; } catch (_) { /* standard */ }
  A.volume = () => VOL;
  A.setVolume = (v) => {
    VOL = Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    try { localStorage.setItem('rf-volume', String(VOL)); } catch (_) { /* ikke så farlig */ }
    if (master && !A.muted) master.gain.setTargetAtTime(VOL, A.ctx.currentTime, 0.05);
    A.blip(660, 0.08, 'sine', 0.1);
  };
  let master, comp, noiseBuf, brownBuf;
  // Vedvarende lyder: motor, sidedyser, laser, traktor og skjærestråle.
  let engGain, engFilter, humGain, hum, rcsGain;
  let laserGain, laserFilter;
  let tractorGain, cutGain, cutFilter, cutHiss, cutT = 0;

  function noise(sec, brown) {
    const c = A.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }

  function loopSrc(buf, rate = 1) {
    const s = A.ctx.createBufferSource();
    s.buffer = buf; s.loop = true; s.playbackRate.value = rate;
    s.start();
    return s;
  }

  function filt(type, freq, q = 0.7) {
    const f = A.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    return f;
  }

  function gain(v = 0) {
    const g = A.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  // Omhylning: tone inn på a sekunder og dø ut til t + dur.
  function env(g, t, vol, dur, a = 0.006) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  A.start = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (_) { return; }
    const c = A.ctx;
    comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    // Begrenser helt til slutt: ingenting kommer over taket, selv med mange
    // eksplosjoner på en gang.
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.1;
    master = gain(A.muted ? 0 : VOL);
    master.connect(comp); comp.connect(lim); lim.connect(c.destination);
    noiseBuf = noise(2, false);
    brownBuf = noise(3, true);

    // Hovedmotor: dyp rumling (brun støy) og en lav brumming som stiger med kraften.
    engFilter = filt('lowpass', 120, 0.8);
    engGain = gain();
    loopSrc(brownBuf).connect(engFilter); engFilter.connect(engGain); engGain.connect(master);
    hum = c.createOscillator(); hum.type = 'sine'; hum.frequency.value = 42;
    humGain = gain(); hum.connect(humGain); humGain.connect(master); hum.start();

    // Sidedyser: korte, lyse pust.
    const rcsFilter = filt('bandpass', 1800, 0.9);
    rcsGain = gain();
    loopSrc(noiseBuf, 0.8).connect(rcsFilter); rcsFilter.connect(rcsGain); rcsGain.connect(master);

    // Laser: to svakt forstemte toner med litt vibrato, mykt filtrert.
    const la = c.createOscillator(); la.type = 'triangle'; la.frequency.value = 220;
    const lb = c.createOscillator(); lb.type = 'sine'; lb.frequency.value = 331;
    const vib = c.createOscillator(); vib.frequency.value = 5.5;
    const vibAmt = gain(3); vib.connect(vibAmt); vibAmt.connect(la.frequency); vibAmt.connect(lb.frequency);
    laserFilter = filt('lowpass', 1400, 0.7);
    laserGain = gain();
    la.connect(laserFilter); lb.connect(laserFilter); laserFilter.connect(laserGain); laserGain.connect(master);
    la.start(); lb.start(); vib.start();

    // Traktor: lav, rund summing.
    const t1 = c.createOscillator(); t1.type = 'sine'; t1.frequency.value = 58;
    const t2 = c.createOscillator(); t2.type = 'sine'; t2.frequency.value = 87.5;
    tractorGain = gain();
    t1.connect(tractorGain); t2.connect(tractorGain); tractorGain.connect(master);
    t1.start(); t2.start();

    // Skjærestrålen: sus (båndfiltrert støy) og svak knitring oppå.
    cutFilter = filt('bandpass', 2200, 1.2);
    cutGain = gain();
    loopSrc(noiseBuf).connect(cutFilter); cutFilter.connect(cutGain); cutGain.connect(master);
    const hp = filt('highpass', 5200);
    cutHiss = gain();
    loopSrc(noiseBuf, 0.37).connect(hp); hp.connect(cutHiss); cutHiss.connect(master);
  };

  A.setMuted = (m) => {
    A.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : VOL, A.ctx.currentTime, 0.05);
  };

  // Hvor sterkt noe høres ut fra avstanden til skipet (1 nær, 0 langt unna).
  A.near = (x, y, range = 900) => {
    const g = RF.game, sb = g && g.ship && g.ship.body;
    if (!sb) return 1;
    const d = Math.hypot(x - sb.x, y - sb.y);
    return Math.max(0, 1 - d / range) ** 1.5;
  };

  // engine 0..1 (hovedmotor), laser og tractor av/på, laserHit = strålen
  // treffer noe, rcs 0..1 = sidedyser og snudyser.
  A.update = (engine, laser, tractor, laserHit, rcs = 0) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime, e = Math.min(1, engine);
    engGain.gain.setTargetAtTime(e * 0.4, t, 0.12);
    engFilter.frequency.setTargetAtTime(90 + e * 260, t, 0.15);
    humGain.gain.setTargetAtTime(e * 0.12, t, 0.15);
    hum.frequency.setTargetAtTime(38 + e * 22, t, 0.2);
    rcsGain.gain.setTargetAtTime(Math.min(1, rcs) * 0.05, t, 0.03);
    laserGain.gain.setTargetAtTime(laser ? (laserHit ? 0.05 : 0.035) : 0, t, 0.05);
    laserFilter.frequency.setTargetAtTime(laserHit ? 1900 : 1200, t, 0.08);
    tractorGain.gain.setTargetAtTime(tractor ? 0.06 : 0, t, 0.15);
  };

  // cut: strålen skjærer nå. hard = hardheten der den skjærer (1–4),
  // mineral = skjærer i mineral (ikke gråstein). Knitringen endres bare noen
  // ganger i sekundet, så den ikke skraper.
  A.updateCut = (cut, hard = 1, mineral = false) => {
    if (!A.ctx || !cutGain) return;
    const t = A.ctx.currentTime;
    if (!cut) {
      cutGain.gain.setTargetAtTime(0, t, 0.1);
      cutHiss.gain.setTargetAtTime(0, t, 0.1);
      return;
    }
    if (t - cutT < 0.07) return;
    cutT = t;
    const flutter = 0.8 + Math.random() * 0.4;
    cutGain.gain.setTargetAtTime(0.1 * flutter, t, 0.06);
    cutFilter.frequency.setTargetAtTime(1500 + hard * 500 + (mineral ? 800 : 0) + Math.random() * 250, t, 0.08);
    cutHiss.gain.setTargetAtTime((mineral ? 0.05 : 0.02) * (Math.random() < 0.25 ? 1.8 : 1), t, 0.04);
  };

  // Dunk: støy gjennom et filter, og en lav tone under når det er kraftig.
  // bright = lysere (metall og stein som treffer).
  A.thud = (strength, bright) => {
    if (!A.ctx || strength < 0.02) return;
    const c = A.ctx, t = c.currentTime, s = Math.min(1, strength);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = filt('lowpass', bright ? 2000 : 250 + s * 700);
    const g = gain();
    env(g, t, s * 0.6, 0.2 + s * 0.45);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + 1);
    if (s > 0.3) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(bright ? 140 : 90, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.25 + s * 0.3);
      const og = gain();
      env(og, t, s * 0.35, 0.3 + s * 0.35);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 0.8);
    }
  };

  // Kort tone, for menyer og beskjeder. Firkant og sagtann dempes med et filter.
  A.blip = (freq, dur = 0.08, type = 'square', vol = 0.12) => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = gain();
    const harsh = type === 'square' || type === 'sawtooth';
    env(g, t, vol * (harsh ? 0.55 : 1), dur);
    if (harsh) {
      const f = filt('lowpass', Math.min(4000, freq * 5));
      o.connect(f); f.connect(g);
    } else o.connect(g);
    g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  };

  // Massedriver: et tungt smell med et slag nedover i tone. v = styrke 0..1.
  A.gun = (v = 1) => {
    if (!A.ctx || v < 0.03) return;
    const c = A.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = filt('bandpass', 900, 0.8);
    const g = gain(); env(g, t, 0.45 * v, 0.14, 0.002);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + 0.2);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const og = gain(); env(og, t, 0.4 * v, 0.22, 0.002);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + 0.3);
  };

  // Rakett skytes ut: et sus som stiger.
  A.rocket = () => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuf;
    const f = filt('bandpass', 400, 1.5);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    const g = gain(); env(g, t, 0.35, 0.8, 0.03);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random()); src.stop(t + 0.9);
  };

  // Eksplosjon: et dypt drønn og en lang, dempet rumling. s = styrke 0..1.
  A.boom = (s = 1) => {
    if (!A.ctx || s < 0.03) return;
    const c = A.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = brownBuf;
    const f = filt('lowpass', 900, 0.7);
    f.frequency.setValueAtTime(1600, t);
    f.frequency.exponentialRampToValueAtTime(120, t + 1.4);
    const g = gain(); env(g, t, 0.9 * s, 1.6, 0.004);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 1.2); src.stop(t + 1.8);
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1);
    const og = gain(); env(og, t, 0.6 * s, 1.1, 0.004);
    o.connect(og); og.connect(master);
    o.start(t); o.stop(t + 1.2);
  };

  // Malm tas inn: en liten, myk «plopp».
  A.pickup = () => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.07);
    const g = gain(); env(g, t, 0.07, 0.12);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.15);
  };

  // Chevron som låser seg: tung klunk + tone.
  A.chevron = (i) => {
    A.thud(0.5, false);
    A.blip(220 + i * 30, 0.25, 'triangle', 0.1);
  };

  A.kawoosh = () => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = filt('bandpass', 200, 1.2);
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    const g = gain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 2);
    A.boom(0.5);
  };

  // En bit knekker løs: et skarpt knepp, et knirk og en dump rumling.
  // size 0..1 (liten til stor bit).
  A.crack = (size = 0.5) => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const snap = c.createBufferSource();
    snap.buffer = noiseBuf;
    const sf = filt('highpass', 2600);
    const sg = gain(); env(sg, t, 0.4, 0.06, 0.002);
    snap.connect(sf); sf.connect(sg); sg.connect(master);
    snap.start(t, Math.random()); snap.stop(t + 0.1);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420 - size * 180, t + 0.02);
    o.frequency.exponentialRampToValueAtTime(90 - size * 30, t + 0.4 + size * 0.3);
    const of = filt('lowpass', 800);
    const og = gain(); env(og, t + 0.01, 0.06, 0.45 + size * 0.3, 0.04);
    o.connect(of); of.connect(og); og.connect(master);
    o.start(t); o.stop(t + 0.8 + size * 0.3);
    setTimeout(() => A.thud(0.25 + size * 0.5, false), 40);
  };

  // Alarm: to toner som veksler, for fiender på vei.
  A.alarm = () => {
    if (!A.ctx) return;
    for (let i = 0; i < 4; i++) setTimeout(() => A.blip(i % 2 ? 620 : 880, 0.16, 'triangle', 0.08), i * 190);
  };

  // Måler på utgangen (brukes i tester): gir en AnalyserNode.
  A.tap = () => {
    if (!A.ctx) return null;
    const an = A.ctx.createAnalyser();
    an.fftSize = 2048;
    comp.connect(an);
    return an;
  };

  RF.Audio = A;
})();
