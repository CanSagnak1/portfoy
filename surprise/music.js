// Müzik: surprise/audio/music.mp3 varsa onu çalar; yoksa WebAudio ile sakin bir piyano arpej'i üretir.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI -> Hz

const CHORDS = [
  { bass: 48, notes: [60, 64, 67, 71] }, // Cmaj7
  { bass: 45, notes: [57, 60, 64, 67] }, // Am7
  { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { bass: 43, notes: [55, 59, 62, 64] }, // G6
];

function createSynth() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // basit reverb: üretilmiş gürültü impulse
  const len = ctx.sampleRate * 3;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.45;
  verb.connect(wet).connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  dry.connect(master);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  lp.connect(dry);
  lp.connect(verb);

  function pluck(freq, when, vel = 0.2, dur = 2.4) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vel, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(lp);
    o1.start(when); o2.start(when);
    o1.stop(when + dur + 0.1); o2.stop(when + dur + 0.1);
  }

  const beat = 60 / 68 / 2; // sekizlik nota
  let step = 0;
  let next = 0;
  let timer = null;
  const pattern = [0, 1, 2, 3, 2, 1, 2, 3];

  function schedule() {
    while (next < ctx.currentTime + 0.4) {
      const bar = Math.floor(step / 8) % CHORDS.length;
      const s = step % 8;
      const ch = CHORDS[bar];
      if (s === 0) pluck(NOTE(ch.bass), next, 0.28, 3.2);
      pluck(NOTE(ch.notes[pattern[s]]), next, 0.14 + (s % 2 === 0 ? 0.04 : 0), 2.2);
      // ara sıra yüksek melodi notası
      if (s === 4 && bar % 2 === 1) pluck(NOTE(ch.notes[3] + 12), next + beat * 0.5, 0.09, 2.6);
      next += beat;
      step++;
    }
  }

  return {
    start() {
      ctx.resume();
      next = ctx.currentTime + 0.1;
      timer = setInterval(schedule, 100);
      schedule();
      master.gain.linearRampToValueAtTime(0.55, ctx.currentTime + 3);
    },
    setMuted(m) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(m ? 0 : 0.55, ctx.currentTime + 0.4);
    },
  };
}

export async function createMusic() {
  // Kendi müzik dosyanı surprise/audio/music.mp3 olarak koyarsan o çalınır
  let hasFile = false;
  try {
    const r = await fetch('surprise/audio/music.mp3', { method: 'HEAD' });
    hasFile = r.ok;
  } catch (e) { /* file:// ya da dosya yok */ }

  if (hasFile) {
    const a = new Audio('surprise/audio/music.mp3');
    a.loop = true;
    a.volume = 0.8;
    return {
      start() { a.play().catch(() => {}); },
      setMuted(m) { a.muted = m; },
    };
  }
  try {
    return createSynth();
  } catch (e) {
    return { start() {}, setMuted() {} };
  }
}
