/** Tiny WebAudio SFX engine — no assets, all synthesized. */
type Wave = OscillatorType;

export class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  private init() {
    if (this.ac) return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ac = new Ctor();
      this.master = this.ac.createGain();
      this.master.gain.value = 0.26;
      this.master.connect(this.ac.destination);
    } catch {
      this.ac = null;
    }
  }

  unlock() {
    this.init();
    if (this.ac && this.ac.state === "suspended") void this.ac.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.26;
  }

  private tone(
    freq: number,
    dur: number,
    opts: { type?: Wave; vol?: number; to?: number; delay?: number; attack?: number } = {},
  ) {
    if (this.muted) return;
    this.init();
    const ac = this.ac;
    const master = this.master;
    if (!ac || !master) return;
    const t0 = ac.currentTime + (opts.delay ?? 0);
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    const vol = (opts.vol ?? 0.5) * 0.6;
    const atk = opts.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.4, delay = 0, filterFreq = 900) {
    if (this.muted) return;
    this.init();
    const ac = this.ac;
    const master = this.master;
    if (!ac || !master) return;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = filterFreq;
    const g = ac.createGain();
    g.gain.value = vol * 0.5;
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(ac.currentTime + delay);
  }

  jump() {
    this.tone(360, 0.18, { type: "triangle", vol: 0.5, to: 720 });
  }
  doubleJump() {
    this.tone(520, 0.2, { type: "triangle", vol: 0.45, to: 980 });
    this.tone(780, 0.14, { type: "sine", vol: 0.25, delay: 0.03 });
  }
  land() {
    this.noise(0.12, 0.3, 0, 520);
  }
  slide() {
    this.noise(0.3, 0.28, 0, 1600);
  }
  collect(combo: number) {
    const steps = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const f = steps[Math.min(steps.length - 1, combo % steps.length)];
    this.tone(f, 0.13, { type: "sine", vol: 0.42 });
    this.tone(f * 2, 0.09, { type: "sine", vol: 0.16, delay: 0.02 });
  }
  power() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, 0.16, { type: "triangle", vol: 0.34, delay: i * 0.055 }),
    );
  }
  hit() {
    this.tone(220, 0.28, { type: "sawtooth", vol: 0.5, to: 70 });
    this.noise(0.2, 0.4, 0, 700);
  }
  shield() {
    this.tone(880, 0.18, { type: "square", vol: 0.22, to: 300 });
  }
  reunion() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      this.tone(f, 0.5, { type: "sine", vol: 0.36, delay: i * 0.085 }),
    );
    [261.63, 329.63, 392].forEach((f, i) => this.tone(f, 0.9, { type: "triangle", vol: 0.16, delay: i * 0.085 }));
  }
  gameOver() {
    [523.25, 415.3, 349.23, 261.63].forEach((f, i) =>
      this.tone(f, 0.4, { type: "triangle", vol: 0.38, delay: i * 0.13 }),
    );
  }
  ui() {
    this.tone(660, 0.09, { type: "square", vol: 0.16 });
  }
}
