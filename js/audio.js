// Syntetisert lyd med Web Audio. Ingen lydfiler trengs.
(function () {
  'use strict';
  const RF = (window.RF = window.RF || {});

  const A = { ctx: null, muted: false };
  let master, engineGain, engineFilter, laserGain, laserOsc, tractorGain, noiseBuf, cutGain, cutFilter, cutHiss;

  function noise(sec) {
    const b = A.ctx.createBuffer(1, A.ctx.sampleRate * sec, A.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  A.start = () => {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (_) { return; }
    const c = A.ctx;
    master = c.createGain();
    master.gain.value = A.muted ? 0 : 0.6;
    master.connect(c.destination);
    noiseBuf = noise(2);

    // Motor: filtrert støy.
    const en = c.createBufferSource();
    en.buffer = noiseBuf; en.loop = true;
    engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 180;
    engineGain = c.createGain(); engineGain.gain.value = 0;
    en.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
    en.start();

    // Laser: sagtann gjennom båndpass.
    laserOsc = c.createOscillator();
    laserOsc.type = 'sawtooth'; laserOsc.frequency.value = 96;
    const lf = c.createBiquadFilter();
    lf.type = 'bandpass'; lf.frequency.value = 900; lf.Q.value = 3;
    laserGain = c.createGain(); laserGain.gain.value = 0;
    laserOsc.connect(lf); lf.connect(laserGain); laserGain.connect(master);
    laserOsc.start();

    // Traktor: lav summing.
    const to = c.createOscillator();
    to.type = 'sine'; to.frequency.value = 58;
    const to2 = c.createOscillator();
    to2.type = 'triangle'; to2.frequency.value = 117;
    tractorGain = c.createGain(); tractorGain.gain.value = 0;
    to.connect(tractorGain); to2.connect(tractorGain); tractorGain.connect(master);
    to.start(); to2.start();

    // Skjærestrålen: et jevnt sus (båndfiltrert støy) med knitring oppå.
    // Tonen går opp når strålen skjærer i hardere mineraler.
    const cs = c.createBufferSource();
    cs.buffer = noiseBuf; cs.loop = true;
    cutFilter = c.createBiquadFilter();
    cutFilter.type = 'bandpass'; cutFilter.frequency.value = 2200; cutFilter.Q.value = 1.4;
    cutGain = c.createGain(); cutGain.gain.value = 0;
    cs.connect(cutFilter); cutFilter.connect(cutGain); cutGain.connect(master);
    const ch = c.createBufferSource();
    ch.buffer = noiseBuf; ch.loop = true; ch.playbackRate.value = 0.37;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 5200;
    cutHiss = c.createGain(); cutHiss.gain.value = 0;
    ch.connect(hp); hp.connect(cutHiss); cutHiss.connect(master);
    cs.start(); ch.start();
  };

  // cut: 0 = strålen skjærer ikke. hard = hardheten der den skjærer (1–4),
  // mineral = skjærer i mineral (ikke gråstein).
  A.updateCut = (cut, hard = 1, mineral = false) => {
    if (!A.ctx || !cutGain) return;
    const t = A.ctx.currentTime;
    const flutter = 0.75 + Math.random() * 0.5;
    cutGain.gain.setTargetAtTime(cut ? 0.12 * flutter : 0, t, cut ? 0.04 : 0.12);
    cutFilter.frequency.setTargetAtTime(1500 + hard * 550 + (mineral ? 900 : 0) + Math.random() * 300, t, 0.05);
    cutHiss.gain.setTargetAtTime(cut ? (mineral ? 0.06 : 0.025) * (Math.random() < 0.3 ? 2.2 : 1) : 0, t, 0.02);
  };

  // En bit knekker løs: et skarpt knepp, et knirk og en dump rumling.
  // size 0..1 (liten til stor bit).
  A.crack = (size = 0.5) => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const snap = c.createBufferSource();
    snap.buffer = noiseBuf;
    const sf = c.createBiquadFilter();
    sf.type = 'highpass'; sf.frequency.value = 2600;
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.5, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    snap.connect(sf); sf.connect(sg); sg.connect(master);
    snap.start(t, Math.random()); snap.stop(t + 0.1);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420 - size * 180, t + 0.02);
    o.frequency.exponentialRampToValueAtTime(90 - size * 30, t + 0.4 + size * 0.3);
    const of = c.createBiquadFilter();
    of.type = 'lowpass'; of.frequency.value = 900;
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.07, t + 0.05);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.45 + size * 0.3);
    o.connect(of); of.connect(og); og.connect(master);
    o.start(t); o.stop(t + 0.8 + size * 0.3);
    setTimeout(() => A.thud(0.25 + size * 0.5, false), 40);
  };

  // Alarm: to toner som veksler, for fiender på vei.
  A.alarm = () => {
    if (!A.ctx) return;
    for (let i = 0; i < 4; i++) setTimeout(() => A.blip(i % 2 ? 620 : 880, 0.16, 'square', 0.06), i * 190);
  };

  A.setMuted = (m) => {
    A.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.6, A.ctx.currentTime, 0.05);
  };

  A.update = (engine, laser, tractor, laserHit) => {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    engineGain.gain.setTargetAtTime(Math.min(1, engine) * 0.5, t, 0.08);
    engineFilter.frequency.setTargetAtTime(160 + engine * 420, t, 0.1);
    laserGain.gain.setTargetAtTime(laser ? (laserHit ? 0.16 : 0.08) : 0, t, 0.03);
    laserOsc.frequency.setTargetAtTime(laserHit ? 86 + Math.random() * 20 : 110, t, 0.02);
    tractorGain.gain.setTargetAtTime(tractor ? 0.09 : 0, t, 0.1);
  };

  // Kort støyutbrudd. strength 0..1.
  A.thud = (strength, bright) => {
    if (!A.ctx || strength < 0.02) return;
    const c = A.ctx, t = c.currentTime;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = bright ? 2400 : 300 + strength * 900;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.min(1, strength) * 0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + strength * 0.5);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + 1);
  };

  A.blip = (freq, dur = 0.08, type = 'square', vol = 0.12) => {
    if (!A.ctx) return;
    const c = A.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
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
    const f = c.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + 2);
  };

  RF.Audio = A;
})();
