import { Sfx } from "./audio";
import { paletteFor, type Palette } from "./palettes";

export type Phase = "menu" | "playing" | "paused" | "gameover";

export interface HudData {
  score: number;
  distance: number;
  lives: number;
  maxLives: number;
  multiplier: number;
  multiplierT: number;
  combo: number;
  chapter: number;
  chapterName: string;
  progress: number;
  toAnjali: number;
  shield: boolean;
  speed: number;
  best: number;
  hearts: number;
}

export interface RunResult {
  score: number;
  distance: number;
  chapter: number;
  hearts: number;
  maxCombo: number;
}

export interface EngineCallbacks {
  onPhase: (p: Phase) => void;
  onGameOver: (r: RunResult) => void;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.78);
  ctx.bezierCurveTo(x - s * 1.15, y - s * 0.15, x - s * 0.58, y - s * 1.06, x, y - s * 0.42);
  ctx.bezierCurveTo(x + s * 0.58, y - s * 1.06, x + s * 1.15, y - s * 0.15, x, y + s * 0.78);
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* entities                                                            */
/* ------------------------------------------------------------------ */
type ObKind = "bench" | "crate" | "hydrant" | "gate" | "bird" | "puddle";

interface Obstacle {
  kind: ObKind;
  x: number;
  y: number; // top
  w: number;
  h: number;
  t: number;
  dead: boolean;
  passed: boolean;
}

type PickKind = "heart" | "rose" | "shield";
interface Pickup {
  kind: PickKind;
  x: number;
  y: number;
  t: number;
  dead: boolean;
}

type PKind = "dust" | "heart" | "spark" | "petal" | "ring" | "star";
interface Particle {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  rot: number;
  vr: number;
  grav: number;
  color: string;
}

interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

const OB_SPECS: Record<ObKind, { w: number; h: number; off: number }> = {
  bench: { w: 96, h: 58, off: 0 },
  crate: { w: 56, h: 56, off: 0 },
  hydrant: { w: 38, h: 68, off: 0 },
  puddle: { w: 156, h: 22, off: 0 },
  gate: { w: 62, h: 132, off: 210 }, // off = top height above ground
  bird: { w: 58, h: 38, off: 124 },
};

const PLAYER_W = 40;
const PLAYER_H = 104;
const SLIDE_H = 50;
const GRAVITY = 2950;
const JUMP_V = -1090;
const JUMP2_V = -940;
/** metres per second at speedK = 1 — keeps pacing identical on every screen size */
const METRES_PER_K = 45;

/* ------------------------------------------------------------------ */
/* engine                                                              */
/* ------------------------------------------------------------------ */
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: EngineCallbacks;
  sfx = new Sfx();

  phase: Phase = "menu";
  hud: HudData = {
    score: 0,
    distance: 0,
    lives: 3,
    maxLives: 3,
    multiplier: 1,
    multiplierT: 0,
    combo: 0,
    chapter: 1,
    chapterName: "Golden Dusk",
    progress: 0,
    toAnjali: 0,
    shield: false,
    speed: 0,
    best: 0,
    hearts: 0,
  };

  /* view */
  private dpr = 1;
  private VW = 900;
  private VH = 520;
  private scale = 1;
  private groundY = 380;
  private baseX = 200;

  /* time */
  private raf = 0;
  private lastTs = 0;
  private acc = 0;
  private time = 0;
  private elapsed = 0;
  private hitStop = 0;
  private restartLock = 0;

  /* world */
  private worldX = 0;
  private distance = 0;
  private score = 0;
  private scoreFloat = 0;
  private speedK = 0.56;
  private speedMul = 1;
  private speed = 500;
  private nextSpawnX = 0;
  private roseTimer = 14;
  private shieldTimer = 26;
  private heartsCollected = 0;
  private maxCombo = 0;
  private comboTimer = 0;
  private multTimer = 0;

  /* chapter */
  private chapter = 1;
  private chapterStart = 0;
  private chapterTarget = 460;
  private palette: Palette = paletteFor(1);

  /* fx */
  private trauma = 0;
  private shx = 0;
  private shy = 0;
  private flash = 0;
  private flashColor = "255,255,255";
  private banner = { t: 0, title: "", sub: "" };

  /* entities */
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];

  private player = {
    x: 200,
    y: 380,
    vy: 0,
    onGround: true,
    jumps: 0,
    sliding: false,
    slideHold: false,
    slideT: 0,
    slideCd: 0,
    hugging: false,
    coyote: 0,
    jumpBuf: 0,
    runPhase: 0,
    invuln: 0,
    shield: false,
    sx: 1,
    sy: 1,
    rot: 0,
    dead: false,
    lean: 0,
  };

  private reunion = {
    active: false,
    phase: "in" as "in" | "hug" | "out",
    t: 0,
    ax: 0,
    hugged: false,
  };

  /* backdrop caches */
  private stars: { x: number; y: number; r: number; p: number }[] = [];
  private hillsFar: number[] = [];
  private hillsNear: number[] = [];
  private buildings: { x: number; w: number; h: number; win: number[] }[] = [];
  private props: { x: number; kind: number; s: number }[] = [];
  private flowers: { x: number; h: number; c: number }[] = [];
  private clouds: { x: number; y: number; s: number; sp: number }[] = [];
  private ambientPetals: Particle[] = [];
  private skyGrad: CanvasGradient | null = null;
  private groundGrad: CanvasGradient | null = null;
  private orbGrad: CanvasGradient | null = null;
  private vignette: CanvasGradient | null = null;

  private keys = new Set<string>();
  private pointerActive = false;
  private pointerStartY = 0;
  private pointerSwiped = false;
  private ro: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, cb: EngineCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    this.cb = cb;

    this.resize();
    this.buildBackdrop();
    this.resetRun(true);

    this.ro = new ResizeObserver(() => {
      this.resize();
      this.buildBackdrop();
    });
    if (canvas.parentElement) this.ro.observe(canvas.parentElement);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);

    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  /* ---------------- view ---------------- */
  private resize() {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth || window.innerWidth;
    const h = parent?.clientHeight || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(w * this.dpr));
    this.canvas.height = Math.max(1, Math.round(h * this.dpr));
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";

    const target = w < 560 ? 560 : w < 900 ? 780 : 980;
    this.scale = w / target;
    this.VW = target;
    this.VH = h / this.scale;
    this.groundY = this.VH - Math.min(this.VH * 0.26, 190);
    this.groundY = Math.min(Math.max(this.groundY, PLAYER_H + 120), this.VH - 26);
    this.baseX = this.VW * 0.24;
    if (!this.reunion.active) this.player.x = this.baseX;
    if (this.player.onGround) this.player.y = this.groundY;
  }

  private buildBackdrop() {
    const { VW, VH } = this;
    const p = this.palette;
    const band = VW * 2;

    this.stars = [];
    const count = Math.round(150 * p.starDensity);
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * band,
        y: Math.random() * this.groundY * 0.72,
        r: rand(0.7, 2.1),
        p: Math.random() * Math.PI * 2,
      });
    }

    this.hillsFar = [];
    this.hillsNear = [];
    const steps = Math.ceil(band / 40);
    for (let i = 0; i < steps; i++) {
      // periodic so the wrap-around seam is invisible
      const a = (i / steps) * Math.PI * 2;
      this.hillsFar.push(70 + Math.sin(a * 3) * 34 + Math.sin(a * 7 + 1) * 16);
      this.hillsNear.push(48 + Math.sin(a * 5 + 2) * 26 + Math.cos(a * 2) * 14);
    }

    this.buildings = [];
    let bx = 0;
    while (bx < band) {
      const w = rand(46, 96);
      const h = rand(70, 230);
      const win: number[] = [];
      const cols = Math.max(1, Math.floor(w / 20));
      const rows = Math.max(1, Math.floor(h / 26));
      for (let c = 0; c < cols; c++)
        for (let r2 = 0; r2 < rows; r2++) if (Math.random() < 0.42) win.push(c * 20 + 7, r2 * 26 + 12);
      this.buildings.push({ x: bx, w, h, win });
      bx += w + rand(8, 26);
    }

    this.props = [];
    let px = 0;
    while (px < band) {
      this.props.push({ x: px, kind: Math.random() < 0.55 ? 0 : Math.random() < 0.6 ? 1 : 2, s: rand(0.8, 1.25) });
      px += rand(180, 340);
    }

    this.flowers = [];
    let fx = 0;
    while (fx < band) {
      this.flowers.push({ x: fx, h: rand(10, 26), c: (Math.random() * 3) | 0 });
      fx += rand(24, 70);
    }

    this.clouds = [];
    for (let i = 0; i < 6; i++)
      this.clouds.push({ x: Math.random() * band, y: rand(40, this.groundY * 0.5), s: rand(0.7, 1.6), sp: rand(4, 12) });

    this.ambientPetals = [];
    for (let i = 0; i < 18; i++) this.ambientPetals.push(this.makePetal(Math.random() * VW, Math.random() * VH));

    const ctx = this.ctx;
    const sg = ctx.createLinearGradient(0, 0, 0, this.groundY);
    sg.addColorStop(0, p.skyTop);
    sg.addColorStop(0.52, p.skyMid);
    sg.addColorStop(1, p.skyBottom);
    this.skyGrad = sg;

    const gg = ctx.createLinearGradient(0, this.groundY, 0, VH);
    gg.addColorStop(0, p.groundTop);
    gg.addColorStop(1, p.groundBottom);
    this.groundGrad = gg;

    const orbR = 150;
    const og = ctx.createRadialGradient(0, 0, 6, 0, 0, orbR);
    og.addColorStop(0, p.orb);
    og.addColorStop(0.16, p.orb);
    og.addColorStop(0.3, this.hexA(p.orbGlow, 0.55));
    og.addColorStop(1, this.hexA(p.orbGlow, 0));
    this.orbGrad = og;

    const vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.32, VW / 2, VH / 2, Math.max(VW, VH) * 0.78);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(10,2,20,0.55)");
    this.vignette = vg;
  }

  private hexA(hex: string, a: number) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------------- lifecycle ---------------- */
  private setPhase(p: Phase) {
    if (this.phase === p) return;
    this.phase = p;
    this.cb.onPhase(p);
  }

  setBest(v: number) {
    this.hud.best = v;
  }

  setMuted(m: boolean) {
    this.sfx.setMuted(m);
  }

  private resetRun(initial = false) {
    this.obstacles.length = 0;
    this.pickups.length = 0;
    this.particles.length = 0;
    this.floaters.length = 0;
    this.worldX = 0;
    this.distance = 0;
    this.score = 0;
    this.scoreFloat = 0;
    this.elapsed = 0;
    this.speedK = 0.56;
    this.speedMul = 1;
    this.chapter = 1;
    this.chapterStart = 0;
    this.chapterTarget = 460;
    this.palette = paletteFor(1);
    this.heartsCollected = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.multTimer = 0;
    this.roseTimer = 12;
    this.shieldTimer = 24;
    this.trauma = 0;
    this.flash = 0;
    this.banner.t = 0;
    this.reunion.active = false;
    this.reunion.phase = "in";
    this.reunion.hugged = false;
    this.reunion.t = 0;
    this.nextSpawnX = this.VW + 420;

    const p = this.player;
    p.x = this.baseX;
    p.y = this.groundY;
    p.vy = 0;
    p.onGround = true;
    p.jumps = 0;
    p.sliding = false;
    p.slideHold = false;
    p.slideT = 0;
    p.slideCd = 0;
    p.hugging = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.invuln = 0;
    p.shield = false;
    p.sx = 1;
    p.sy = 1;
    p.rot = 0;
    p.dead = false;
    p.lean = 0;

    this.hud.score = 0;
    this.hud.distance = 0;
    this.hud.lives = 3;
    this.hud.multiplier = 1;
    this.hud.multiplierT = 0;
    this.hud.combo = 0;
    this.hud.chapter = 1;
    this.hud.chapterName = this.palette.name;
    this.hud.progress = 0;
    this.hud.toAnjali = this.chapterTarget;
    this.hud.shield = false;
    this.hud.hearts = 0;
    if (!initial) this.buildBackdrop();
  }

  start() {
    this.sfx.unlock();
    this.resetRun();
    this.setPhase("playing");
    this.sfx.ui();
    this.banner.t = 1;
    this.banner.title = "GO!";
    this.banner.sub = "Anjali is waiting 💗";
    // a welcoming arc of hearts so the very first seconds feel great
    this.addHeartArc(this.VW * 0.72, 6, 150, 300);
    this.pickups.push({ kind: "heart", x: this.VW * 0.55, y: this.groundY - 70, t: 0, dead: false });
  }

  pause() {
    if (this.phase !== "playing") return;
    this.setPhase("paused");
  }

  resume() {
    if (this.phase !== "paused") return;
    this.lastTs = performance.now();
    this.setPhase("playing");
  }

  togglePause() {
    if (this.phase === "playing") this.pause();
    else if (this.phase === "paused") this.resume();
  }

  toMenu() {
    this.resetRun();
    this.setPhase("menu");
  }

  /* ---------------- input ---------------- */
  private typing() {
    const el = document.activeElement;
    return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.typing()) return;
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "w", "s", "p"].includes(k)) e.preventDefault();
    if (this.keys.has(k)) return;
    this.keys.add(k);

    if (k === "escape" || k === "p") {
      if (this.phase === "playing" || this.phase === "paused") this.togglePause();
      return;
    }
    if (this.phase === "menu") {
      if (k === " " || k === "enter" || k === "arrowup" || k === "w") this.start();
      return;
    }
    if (this.phase === "gameover") {
      if ((k === " " || k === "enter" || k === "r") && this.restartLock <= 0) this.start();
      return;
    }
    if (this.phase === "paused") {
      if (k === " " || k === "enter") this.resume();
      return;
    }
    if (k === " " || k === "arrowup" || k === "w") this.jump();
    if (k === "arrowdown" || k === "s") this.setSlide(true);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === "arrowdown" || k === "s") this.setSlide(false);
    if ((k === " " || k === "arrowup" || k === "w") && this.player.vy < -260) this.player.vy *= 0.55; // variable jump
  };

  private onBlur = () => {
    this.keys.clear();
    this.setSlide(false);
    this.pause();
  };

  private onVisibility = () => {
    if (document.hidden) this.pause();
  };

  private onPointerDown = (e: PointerEvent) => {
    this.sfx.unlock();
    if (this.phase !== "playing") return;
    this.pointerActive = true;
    this.pointerSwiped = false;
    this.pointerStartY = e.clientY;
    const rect = this.canvas.getBoundingClientRect();
    const ly = (e.clientY - rect.top) / rect.height;
    if (ly > 0.68) {
      this.setSlide(true);
      this.pointerSwiped = true;
    } else {
      this.jump();
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointerActive || this.pointerSwiped) return;
    const dy = e.clientY - this.pointerStartY;
    if (dy > 42) {
      this.setSlide(true);
      this.pointerSwiped = true;
    }
  };

  private onPointerUp = () => {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    this.setSlide(false);
  };

  jump() {
    if (this.phase !== "playing" || this.player.dead || this.reunion.phase === "hug") return;
    const p = this.player;
    if (p.sliding) {
      p.sliding = false;
      p.slideT = 0;
      p.slideCd = 0.05;
    }
    const grounded = p.onGround || p.coyote > 0;
    if (grounded || p.jumps < 2) {
      const first = grounded;
      p.vy = first ? JUMP_V : JUMP2_V;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuf = 0;
      p.jumps = first ? 1 : p.jumps + 1;
      p.sx = 0.82;
      p.sy = 1.24;
      if (first) {
        this.sfx.jump();
        this.burst(p.x, this.groundY, 8, "dust", this.palette.accent);
      } else {
        this.sfx.doubleJump();
        this.ringAt(p.x, p.y - 44, "#ffd9e8");
        this.burst(p.x, p.y - 30, 10, "heart", "#ff5f8f");
      }
      this.trauma = Math.min(1, this.trauma + (first ? 0.08 : 0.14));
    } else {
      // buffer the press so it fires the instant we touch down
      p.jumpBuf = 0.13;
    }
  }

  setSlide(on: boolean) {
    const p = this.player;
    p.slideHold = on;
    if (this.phase !== "playing" || p.dead) return;
    if (on && !p.sliding && p.slideCd <= 0) {
      p.sliding = true;
      p.slideT = 0;
      if (!p.onGround) p.vy = Math.max(p.vy, 700); // fast fall
      else {
        this.sfx.slide();
        this.burst(p.x - 14, this.groundY, 10, "dust", this.palette.accent);
      }
      p.sx = 1.2;
      p.sy = 0.82;
    }
  }

  /* ---------------- loop ---------------- */
  private loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (ts - this.lastTs) / 1000;
    this.lastTs = ts;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);
    this.time += dt;

    if (this.phase === "playing") {
      if (this.hitStop > 0) {
        this.hitStop -= dt;
      } else {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= 1 / 120 && steps < 8) {
          this.step(1 / 120);
          this.acc -= 1 / 120;
          steps++;
        }
        if (steps >= 8) this.acc = 0;
      }
    } else if (this.phase === "menu") {
      this.menuStep(dt);
    } else if (this.phase === "gameover") {
      this.deathStep(dt);
    }

    // shake decay always
    const tr = this.trauma * this.trauma;
    const sAmp = 26 * tr;
    this.shx = (Math.random() * 2 - 1) * sAmp;
    this.shy = (Math.random() * 2 - 1) * sAmp * 0.7;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
    this.flash = Math.max(0, this.flash - dt * 2.1);
    if (this.banner.t > 0) this.banner.t = Math.max(0, this.banner.t - dt * 0.62);
    if (this.restartLock > 0) this.restartLock -= dt;

    this.render();
  };

  private menuStep(dt: number) {
    this.speed = this.VW * 0.34;
    this.worldX += this.speed * dt;
    this.player.runPhase += dt * 13;
    this.player.y = this.groundY;
    this.player.sx += (1 - this.player.sx) * 0.2;
    this.player.sy += (1 - this.player.sy) * 0.2;
    if (Math.random() < dt * 14) this.spawnParticle("dust", this.player.x - 10, this.groundY, rand(-90, -20), rand(-60, -10), 0.5, rand(2, 5), this.palette.accent);
    this.updateParticles(dt);
    this.updateAmbient(dt);
  }

  private deathStep(dt: number) {
    const p = this.player;
    p.vy += GRAVITY * 0.7 * dt;
    p.y += p.vy * dt;
    p.rot += dt * 5.5;
    if (p.y > this.groundY + 260) p.y = this.groundY + 260;
    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateAmbient(dt);
  }

  private difficulty() {
    return clamp(this.elapsed / 105, 0, 1);
  }

  private step(dt: number) {
    const p = this.player;
    this.elapsed += dt;

    /* speed */
    const d = this.difficulty();
    const target = 0.56 + d * 0.62;
    this.speedK += (target - this.speedK) * Math.min(1, dt * 0.9);
    this.speedMul += (1 - this.speedMul) * Math.min(1, dt * 1.6);
    if (this.reunion.active) {
      if (this.reunion.phase === "hug") this.speedMul = Math.max(0, this.speedMul - dt * 2.6);
      if (this.reunion.phase === "out") this.speedMul = Math.min(1, this.speedMul + dt * 0.9);
    }
    this.speed = this.VW * this.speedK * this.speedMul;

    /* world scroll & distance */
    this.worldX += this.speed * dt;
    const metres = this.speedK * this.speedMul * dt * METRES_PER_K;
    this.distance += metres;
    this.scoreFloat += metres * 1.0;

    /* timers */
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.hud.combo = 0;
    }
    if (this.multTimer > 0) {
      this.multTimer -= dt;
      if (this.multTimer <= 0) this.hud.multiplier = 1;
    }
    if (p.invuln > 0) p.invuln -= dt;

    /* player physics */
    p.vy += GRAVITY * (p.sliding && !p.onGround ? 1.35 : 1) * dt;
    p.vy = Math.min(p.vy, 2400);
    p.y += p.vy * dt;
    if (p.y >= this.groundY) {
      if (!p.onGround) {
        // landing
        p.sx = 1.25;
        p.sy = 0.76;
        this.trauma = Math.min(1, this.trauma + 0.06);
        this.sfx.land();
        this.burst(p.x, this.groundY, 8, "dust", this.palette.accent);
      }
      p.y = this.groundY;
      p.vy = 0;
      p.onGround = true;
      p.jumps = 0;
      p.coyote = 0.1;
    } else {
      p.onGround = false;
      if (p.coyote > 0) p.coyote -= dt;
    }
    if (p.jumpBuf > 0) {
      p.jumpBuf -= dt;
      if (p.onGround) {
        p.jumpBuf = 0;
        this.jump();
      }
    }
    p.sx += (1 - p.sx) * Math.min(1, dt * 13);
    p.sy += (1 - p.sy) * Math.min(1, dt * 13);
    p.runPhase += dt * (10 + this.speedK * 9);
    p.lean = lerp(p.lean, p.onGround ? 0.06 + this.speedK * 0.08 : clamp(p.vy / 2600, -0.22, 0.3), Math.min(1, dt * 9));

    if (p.slideCd > 0) p.slideCd -= dt;
    if (p.sliding) {
      p.slideT += dt;
      if (p.onGround && Math.random() < dt * 40)
        this.spawnParticle("dust", p.x - 22, this.groundY, rand(-260, -80), rand(-90, -20), 0.45, rand(2, 6), this.palette.accent);
      if (!p.slideHold && p.slideT > 0.26) {
        p.sliding = false;
        p.slideCd = 0.08;
      }
      if (p.slideT > 1.2) {
        p.sliding = false;
        p.slideCd = 0.3;
      }
    } else if (p.slideHold && p.onGround && p.slideCd <= 0) {
      // holding the slide key keeps you low (with a small breather between slides)
      p.sliding = true;
      p.slideT = 0;
      p.sx = 1.18;
      p.sy = 0.84;
    }

    /* reunion sequence takes over spawning */
    if (this.reunion.active) this.updateReunion(dt);
    else {
      this.updateSpawner(dt);
      if (this.distance - this.chapterStart >= this.chapterTarget) this.beginReunion();
    }

    /* entities */
    const dx = this.speed * dt;
    for (const o of this.obstacles) {
      o.x -= dx;
      o.t += dt;
      if (o.kind === "bird") o.x -= dx * 0.22;
      if (o.x < -260) o.dead = true;
    }
    for (const k of this.pickups) {
      k.x -= dx;
      k.t += dt;
      if (k.x < -120) k.dead = true;
    }

    if (!p.dead && !this.reunion.active) this.collide();
    else if (!p.dead) this.collectOnly();

    if (this.obstacles.length && this.obstacles.some((o) => o.dead)) this.obstacles = this.obstacles.filter((o) => !o.dead);
    if (this.pickups.length && this.pickups.some((k) => k.dead)) this.pickups = this.pickups.filter((k) => !k.dead);

    this.updateParticles(dt);
    this.updateFloaters(dt);
    this.updateAmbient(dt);

    /* hud */
    this.score = Math.floor(this.scoreFloat);
    this.hud.score = this.score;
    this.hud.distance = Math.floor(this.distance);
    this.hud.progress = clamp((this.distance - this.chapterStart) / this.chapterTarget, 0, 1);
    this.hud.toAnjali = Math.max(0, Math.ceil(this.chapterTarget - (this.distance - this.chapterStart)));
    this.hud.multiplierT = this.multTimer > 0 ? this.multTimer / 9 : 0;
    this.hud.shield = p.shield;
    this.hud.speed = clamp((this.speedK - 0.5) / 0.7, 0, 1);
    this.hud.chapter = this.chapter;
    this.hud.chapterName = this.palette.name;
    this.hud.hearts = this.heartsCollected;
  }

  /* ---------------- spawning ---------------- */
  private updateSpawner(dt: number) {
    this.roseTimer -= dt;
    this.shieldTimer -= dt;
    this.nextSpawnX -= this.speed * dt;
    if (this.nextSpawnX <= this.VW) {
      const gapSec = lerp(1.5, 0.86, this.difficulty()) * rand(0.92, 1.22);
      this.nextSpawnX = this.VW + this.speed * gapSec;
      this.spawnPattern();
    }
  }

  private addOb(kind: ObKind, x: number) {
    const s = OB_SPECS[kind];
    const y = kind === "gate" ? this.groundY - s.off : kind === "bird" ? this.groundY - s.off : this.groundY - s.h;
    this.obstacles.push({ kind, x, y, w: s.w, h: s.h, t: 0, dead: false, passed: false });
  }

  private addHeartArc(x: number, count: number, peak: number, spread: number) {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const y = this.groundY - 60 - Math.sin(t * Math.PI) * peak;
      this.pickups.push({ kind: "heart", x: x + t * spread, y, t: i * 0.12, dead: false });
    }
  }

  private addHeartLine(x: number, count: number, height: number) {
    for (let i = 0; i < count; i++)
      this.pickups.push({ kind: "heart", x: x + i * 62, y: this.groundY - height, t: i * 0.1, dead: false });
  }

  private spawnPattern() {
    const x = this.VW + 260;
    const d = this.difficulty();
    const roll = Math.random();
    const groundKinds: ObKind[] = ["bench", "crate", "hydrant", "puddle"];

    if (roll < 0.24) {
      this.addOb(pick(groundKinds), x);
      if (Math.random() < 0.75) this.addHeartArc(x - 60, 5, 150, 230);
    } else if (roll < 0.4) {
      this.addOb(pick(groundKinds), x);
      this.addOb(pick(groundKinds), x + rand(170, 230));
      if (Math.random() < 0.6) this.addHeartArc(x - 30, 6, 185, 300);
    } else if (roll < 0.56) {
      this.addOb("gate", x);
      this.addHeartLine(x - 40, 4, 44);
    } else if (roll < 0.7) {
      this.addOb("bird", x);
      if (Math.random() < 0.5) this.addHeartLine(x - 120, 3, 40);
      else this.addHeartArc(x - 220, 4, 170, 170);
    } else if (roll < 0.82 && d > 0.25) {
      this.addOb("gate", x);
      this.addOb(pick(groundKinds), x + rand(300, 380));
      this.addHeartLine(x - 40, 3, 44);
    } else if (roll < 0.92 && d > 0.4) {
      this.addOb("bird", x);
      this.addOb(pick(groundKinds), x + rand(320, 420));
      this.addHeartArc(x + 180, 4, 150, 150);
    } else {
      this.addHeartArc(x, 7, 210, 360);
    }

    if (this.roseTimer <= 0) {
      this.roseTimer = rand(16, 24);
      this.pickups.push({ kind: "rose", x: x + rand(120, 260), y: this.groundY - rand(120, 210), t: 0, dead: false });
    }
    if (this.shieldTimer <= 0) {
      this.shieldTimer = rand(26, 38);
      this.pickups.push({ kind: "shield", x: x + rand(140, 300), y: this.groundY - rand(80, 190), t: 0, dead: false });
    }
  }

  /* ---------------- collisions ---------------- */
  private playerBox() {
    const p = this.player;
    const h = p.sliding ? SLIDE_H : PLAYER_H;
    const w = p.sliding ? PLAYER_W + 26 : PLAYER_W;
    return { x: p.x - w / 2, y: p.y - h, w, h };
  }

  private collectOnly() {
    const b = this.playerBox();
    for (const k of this.pickups) {
      if (k.dead) continue;
      if (Math.abs(k.x - (b.x + b.w / 2)) < 34 + b.w / 2 && Math.abs(k.y - (b.y + b.h / 2)) < 34 + b.h / 2)
        this.grab(k);
    }
  }

  private collide() {
    const b = this.playerBox();
    const p = this.player;
    for (const o of this.obstacles) {
      if (o.dead) continue;
      const ox = o.x - o.w / 2 + 5;
      const ow = o.w - 10;
      if (b.x < ox + ow && b.x + b.w > ox && b.y < o.y + o.h - 3 && b.y + b.h > o.y + 3) {
        this.hurt(o);
        break;
      }
      if (!o.passed && o.x < p.x - 30) {
        o.passed = true;
        this.scoreFloat += 6;
      }
    }
    this.collectOnly();
  }

  private grab(k: Pickup) {
    k.dead = true;
    const p = this.player;
    if (k.kind === "heart") {
      this.heartsCollected++;
      this.hud.combo++;
      this.comboTimer = 2.4;
      this.maxCombo = Math.max(this.maxCombo, this.hud.combo);
      const comboBonus = 1 + Math.floor(this.hud.combo / 5) * 0.5;
      const gain = Math.round(20 * this.hud.multiplier * comboBonus);
      this.scoreFloat += gain;
      this.sfx.collect(this.hud.combo);
      this.burst(k.x, k.y, 7, "heart", "#ff5f8f");
      this.floaters.push({
        x: k.x,
        y: k.y - 18,
        vy: -70,
        life: 0.9,
        max: 0.9,
        text: `+${gain}`,
        color: "#ffd9e8",
        size: 24,
      });
      if (this.hud.combo > 0 && this.hud.combo % 5 === 0) {
        this.floaters.push({
          x: p.x,
          y: this.groundY - 190,
          vy: -46,
          life: 1.2,
          max: 1.2,
          text: `COMBO x${this.hud.combo}!`,
          color: this.palette.accent,
          size: 30,
        });
        this.trauma = Math.min(1, this.trauma + 0.14);
        this.ringAt(p.x, p.y - 52, this.palette.accent);
      }
      this.trauma = Math.min(1, this.trauma + 0.02);
    } else if (k.kind === "rose") {
      this.hud.multiplier = Math.min(4, this.hud.multiplier * 2);
      this.multTimer = 9;
      this.sfx.power();
      this.burst(k.x, k.y, 18, "petal", "#ff3d7f");
      this.ringAt(k.x, k.y, "#ff9ec4");
      this.flash = 0.35;
      this.flashColor = "255,120,170";
      this.trauma = Math.min(1, this.trauma + 0.2);
      this.floaters.push({
        x: k.x,
        y: k.y - 22,
        vy: -60,
        life: 1.3,
        max: 1.3,
        text: `LOVE x${this.hud.multiplier}`,
        color: "#ff9ec4",
        size: 30,
      });
    } else {
      this.player.shield = true;
      this.sfx.shield();
      this.burst(k.x, k.y, 14, "star", "#ffd166");
      this.ringAt(k.x, k.y, "#ffd166");
      this.floaters.push({
        x: k.x,
        y: k.y - 22,
        vy: -60,
        life: 1.2,
        max: 1.2,
        text: "LOCKET!",
        color: "#ffd166",
        size: 26,
      });
    }
  }

  private hurt(o: Obstacle) {
    const p = this.player;
    if (p.invuln > 0) return;
    o.dead = true;
    this.hud.combo = 0;
    this.hud.multiplier = 1;
    this.multTimer = 0;

    if (p.shield) {
      p.shield = false;
      p.invuln = 1.0;
      this.sfx.shield();
      this.burst(o.x, o.y + o.h / 2, 20, "star", "#ffd166");
      this.ringAt(p.x, p.y - 50, "#ffd166");
      this.trauma = Math.min(1, this.trauma + 0.45);
      this.hitStop = 0.06;
      this.floaters.push({ x: p.x, y: p.y - 130, vy: -60, life: 1, max: 1, text: "SAVED!", color: "#ffd166", size: 28 });
      return;
    }

    this.hud.lives--;
    p.invuln = 1.7;
    this.speedMul = 0.5;
    this.trauma = 1;
    this.hitStop = 0.13;
    this.flash = 0.6;
    this.flashColor = "255,70,90";
    this.sfx.hit();
    this.burst(o.x, o.y + o.h / 2, 22, "spark", "#ff5f6d");
    this.burst(p.x, p.y - 50, 10, "heart", "#ff2d5f");
    this.floaters.push({ x: p.x, y: p.y - 140, vy: -70, life: 1.1, max: 1.1, text: "OUCH!", color: "#ff8fa3", size: 30 });

    if (this.hud.lives <= 0) this.gameOver();
  }

  private gameOver() {
    const p = this.player;
    p.dead = true;
    p.vy = -700;
    this.trauma = 1;
    this.flash = 0.8;
    this.flashColor = "255,120,150";
    this.restartLock = 0.55;
    this.sfx.gameOver();
    this.burst(p.x, p.y - 50, 30, "heart", "#ff3d7f");
    this.setPhase("gameover");
    this.cb.onGameOver({
      score: Math.floor(this.scoreFloat),
      distance: Math.floor(this.distance),
      chapter: this.chapter,
      hearts: this.heartsCollected,
      maxCombo: this.maxCombo,
    });
  }

  /* ---------------- reunion ---------------- */
  private beginReunion() {
    this.reunion.active = true;
    this.reunion.phase = "in";
    this.reunion.t = 0;
    this.reunion.ax = this.VW + 120;
    this.reunion.hugged = false;
    // clear the road ahead — obstacles poof into hearts
    for (const o of this.obstacles) {
      this.burst(o.x, o.y + o.h / 2, 6, "heart", "#ff9ec4");
      o.dead = true;
    }
    this.banner.t = 1;
    this.banner.title = "ANJALI AHEAD!";
    this.banner.sub = "Run to her 💗";
  }

  private updateReunion(dt: number) {
    const r = this.reunion;
    const p = this.player;
    r.t += dt;
    p.hugging = r.phase === "hug";
    const targetX = this.baseX + Math.min(230, this.VW * 0.3);

    if (r.phase === "in") {
      r.ax -= this.speed * dt;
      if (Math.random() < dt * 20) this.spawnParticle("petal", rand(0, this.VW), -20, rand(-40, -10), rand(40, 90), 4, rand(6, 12), this.palette.petal);
      if (r.ax <= targetX) {
        r.ax = targetX;
        r.phase = "hug";
        r.t = 0;
      }
    } else if (r.phase === "hug") {
      // world halts, boy closes the gap
      p.x = lerp(p.x, r.ax - 62, Math.min(1, dt * 4.5));
      if (!r.hugged && r.t > 0.55) {
        r.hugged = true;
        const bonus = 300 + this.chapter * 200;
        this.scoreFloat += bonus;
        this.sfx.reunion();
        this.flash = 0.9;
        this.flashColor = "255,190,220";
        this.trauma = 0.85;
        this.hitStop = 0.05;
        for (let i = 0; i < 46; i++) {
          const a = rand(0, Math.PI * 2);
          const sp = rand(120, 560);
          this.spawnParticle("heart", (p.x + r.ax) / 2, this.groundY - 90, Math.cos(a) * sp, Math.sin(a) * sp - 120, rand(0.9, 1.8), rand(7, 16), pick(["#ff3d7f", "#ff9ec4", "#ffd166", "#fff0f5"]));
        }
        this.ringAt((p.x + r.ax) / 2, this.groundY - 90, "#ffd9e8");
        this.banner.t = 1;
        this.banner.title = `CHAPTER ${this.chapter} COMPLETE`;
        this.banner.sub = `+${bonus} love points`;
        this.floaters.push({
          x: (p.x + r.ax) / 2,
          y: this.groundY - 210,
          vy: -46,
          life: 1.6,
          max: 1.6,
          text: `+${bonus}`,
          color: "#ffd9e8",
          size: 36,
        });
        // refill a life as a reward
        if (this.hud.lives < this.hud.maxLives) this.hud.lives++;
      }
      if (r.hugged && Math.random() < dt * 26)
        this.spawnParticle("heart", (p.x + r.ax) / 2 + rand(-40, 40), this.groundY - 110, rand(-60, 60), rand(-160, -70), 1.4, rand(6, 13), pick(["#ff3d7f", "#ff9ec4", "#ffd166"]));
      if (r.t > 2.1) {
        r.phase = "out";
        r.t = 0;
        this.chapter++;
        this.chapterStart = this.distance;
        this.chapterTarget = 460 + (this.chapter - 1) * 170;
        this.palette = paletteFor(this.chapter);
        this.buildBackdrop();
        this.flash = 0.7;
        this.flashColor = "255,230,240";
        this.banner.t = 1;
        this.banner.title = this.palette.name;
        this.banner.sub = `Chapter ${this.chapter} — she runs ahead!`;
      }
    } else {
      // out
      r.ax += (this.speed * 0.55 + 260) * dt;
      p.x = lerp(p.x, this.baseX, Math.min(1, dt * 3));
      if (Math.random() < dt * 12)
        this.spawnParticle("heart", r.ax, this.groundY - 80, rand(-80, -20), rand(-90, -30), 1.1, rand(5, 10), "#ff9ec4");
      if (r.ax > this.VW + 160 && r.t > 1.1) {
        r.active = false;
        this.nextSpawnX = this.VW + 400;
      }
    }
  }

  /* ---------------- particles ---------------- */
  private makePetal(x: number, y: number): Particle {
    return {
      kind: "petal",
      x,
      y,
      vx: rand(-40, -8),
      vy: rand(14, 40),
      life: 999,
      max: 999,
      size: rand(5, 11),
      rot: rand(0, 6.28),
      vr: rand(-2, 2),
      grav: 0,
      color: this.palette.petal,
    };
  }

  private spawnParticle(kind: PKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string) {
    if (this.particles.length > 340) return;
    this.particles.push({
      kind,
      x,
      y,
      vx,
      vy,
      life,
      max: life,
      size,
      rot: rand(0, 6.28),
      vr: rand(-8, 8),
      grav: kind === "dust" ? -40 : kind === "heart" ? 260 : kind === "spark" ? 900 : kind === "star" ? 300 : 120,
      color,
    });
  }

  private burst(x: number, y: number, n: number, kind: PKind, color: string) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = kind === "dust" ? rand(40, 190) : rand(90, 430);
      this.spawnParticle(kind, x, y, Math.cos(a) * sp - (kind === "dust" ? 120 : 0), Math.sin(a) * sp - 60, rand(0.35, 0.95), rand(3, kind === "heart" ? 13 : 7), color);
    }
  }

  private ringAt(x: number, y: number, color: string) {
    this.particles.push({ kind: "ring", x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 14, rot: 0, vr: 0, grav: 0, color });
  }

  private updateParticles(dt: number) {
    const arr = this.particles;
    const scroll = this.phase === "playing" || this.phase === "menu" ? this.speed * dt * 0.24 : 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      const p = arr[i];
      p.life -= dt;
      if (p.life <= 0) {
        arr.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt - scroll;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind !== "ring") {
        p.vx *= 1 - Math.min(0.5, dt * 1.6);
      }
    }
  }

  private updateFloaters(dt: number) {
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 1 - Math.min(0.5, dt * 1.2);
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
  }

  private updateAmbient(dt: number) {
    const drift = this.speed * 0.06;
    for (const p of this.ambientPetals) {
      p.x += (p.vx - drift) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.y > this.VH + 20 || p.x < -30) {
        p.x = rand(0, this.VW) + this.VW * 0.15;
        p.y = -20;
        p.color = this.palette.petal;
      }
    }
  }

  /* ---------------- rendering ---------------- */
  private render() {
    const ctx = this.ctx;
    const { VW, VH } = this;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    ctx.save();
    ctx.translate(this.shx, this.shy);

    this.drawSky();
    this.drawStars();
    this.drawOrb();
    this.drawClouds();
    this.drawHills();
    this.drawSkyline();
    this.drawProps();
    this.drawGround();
    this.drawAmbientPetals();
    this.drawPickups();
    this.drawObstacles();
    if (this.reunion.active) this.drawAnjali(this.reunion.ax, this.groundY);
    else if (this.phase === "menu") this.drawAnjali(this.VW * 0.84, this.groundY);
    this.drawPlayer();
    this.drawParticles();
    this.drawFloaters();
    this.drawForeground();
    if (this.hud.speed > 0.45 && this.phase === "playing") this.drawSpeedLines();

    ctx.restore();

    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, VW, VH);
    }
    if (this.flash > 0.01) {
      ctx.fillStyle = `rgba(${this.flashColor},${this.flash * 0.55})`;
      ctx.fillRect(0, 0, VW, VH);
    }
    this.drawBanner();
  }

  private drawSky() {
    const ctx = this.ctx;
    ctx.fillStyle = this.skyGrad ?? this.palette.skyMid;
    ctx.fillRect(0, 0, this.VW, this.groundY + 2);
  }

  private drawStars() {
    if (!this.stars.length) return;
    const ctx = this.ctx;
    const band = this.VW * 2;
    const off = (this.worldX * 0.03) % band;
    ctx.fillStyle = "#fff";
    for (const s of this.stars) {
      let x = s.x - off;
      if (x < -10) x += band;
      if (x > this.VW + 10) continue;
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(this.time * 1.7 + s.p));
      ctx.globalAlpha = tw * 0.9;
      ctx.fillRect(x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  private drawOrb() {
    const ctx = this.ctx;
    const p = this.palette;
    const x = this.VW * 0.74;
    const y = this.groundY * 0.32;
    ctx.save();
    ctx.translate(x, y);
    if (this.orbGrad) {
      ctx.fillStyle = this.orbGrad;
      ctx.fillRect(-150, -150, 300, 300);
    }
    ctx.fillStyle = p.orb;
    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    if (p.moon) {
      ctx.fillStyle = this.hexA(p.orbGlow, 0.25);
      ctx.beginPath();
      ctx.arc(-13, -9, 8, 0, Math.PI * 2);
      ctx.arc(12, 8, 6, 0, Math.PI * 2);
      ctx.arc(4, -16, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawClouds() {
    const ctx = this.ctx;
    const band = this.VW * 2;
    ctx.fillStyle = this.palette.cloud;
    for (const c of this.clouds) {
      let x = (c.x - this.worldX * 0.05 - this.time * c.sp) % band;
      if (x < -220) x += band;
      if (x > this.VW + 220) continue;
      const s = c.s;
      ctx.beginPath();
      ctx.ellipse(x, c.y, 62 * s, 17 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x + 40 * s, c.y - 8 * s, 40 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.ellipse(x - 44 * s, c.y + 4 * s, 34 * s, 11 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawHillLayer(heights: number[], factor: number, color: string, baseLift: number) {
    const ctx = this.ctx;
    const n = heights.length;
    if (!n) return;
    const step = 40;
    const total = n * step;
    const shift = ((this.worldX * factor) % total + total) % total;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-80, this.groundY + 4);
    const start = Math.floor(shift / step) - 1;
    for (let i = start; ; i++) {
      const x = i * step - shift;
      const idx = ((i % n) + n) % n;
      ctx.lineTo(x, this.groundY - baseLift - heights[idx]);
      if (x > this.VW + step) break;
    }
    ctx.lineTo(this.VW + 80, this.groundY + 4);
    ctx.closePath();
    ctx.fill();
  }

  private drawHills() {
    this.drawHillLayer(this.hillsFar, 0.09, this.palette.hillFar, 40);
    this.drawHillLayer(this.hillsNear, 0.16, this.palette.hillNear, 12);
  }

  private drawSkyline() {
    const ctx = this.ctx;
    const band = this.VW * 2;
    const off = (this.worldX * 0.3) % band;
    ctx.fillStyle = this.palette.skyline;
    for (const b of this.buildings) {
      let x = b.x - off;
      if (x < -b.w - 4) x += band;
      if (x > this.VW + 4) continue;
      ctx.fillRect(x, this.groundY - b.h, b.w, b.h);
    }
    ctx.fillStyle = this.palette.window;
    ctx.globalAlpha = 0.75;
    for (const b of this.buildings) {
      let x = b.x - off;
      if (x < -b.w - 4) x += band;
      if (x > this.VW + 4) continue;
      for (let i = 0; i < b.win.length; i += 2) {
        const wx = x + b.win[i];
        const wy = this.groundY - b.h + b.win[i + 1];
        if (wx < -4 || wx > this.VW + 4) continue;
        ctx.fillRect(wx, wy, 5, 7);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawProps() {
    const ctx = this.ctx;
    const band = this.VW * 2;
    const off = (this.worldX * 0.58) % band;
    for (const pr of this.props) {
      let x = pr.x - off;
      if (x < -80) x += band;
      if (x > this.VW + 80) continue;
      const g = this.groundY;
      if (pr.kind === 0) {
        // tree
        const h = 90 * pr.s;
        ctx.fillStyle = this.hexA(this.palette.hillNear, 0.95);
        ctx.fillRect(x - 4 * pr.s, g - h * 0.45, 8 * pr.s, h * 0.45);
        ctx.beginPath();
        ctx.arc(x, g - h * 0.62, 26 * pr.s, 0, Math.PI * 2);
        ctx.arc(x - 20 * pr.s, g - h * 0.5, 18 * pr.s, 0, Math.PI * 2);
        ctx.arc(x + 20 * pr.s, g - h * 0.52, 20 * pr.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = this.hexA(this.palette.petal, 0.5);
        ctx.beginPath();
        ctx.arc(x + 8 * pr.s, g - h * 0.75, 9 * pr.s, 0, Math.PI * 2);
        ctx.arc(x - 14 * pr.s, g - h * 0.66, 6 * pr.s, 0, Math.PI * 2);
        ctx.fill();
      } else if (pr.kind === 1) {
        // lamp post with warm glow
        const h = 130 * pr.s;
        ctx.strokeStyle = this.hexA(this.palette.skyline, 1);
        ctx.lineWidth = 5 * pr.s;
        ctx.beginPath();
        ctx.moveTo(x, g);
        ctx.lineTo(x, g - h);
        ctx.lineTo(x + 22 * pr.s, g - h);
        ctx.stroke();
        ctx.fillStyle = this.palette.window;
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(x + 22 * pr.s, g - h + 6 * pr.s, 7 * pr.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.14;
        ctx.beginPath();
        ctx.arc(x + 22 * pr.s, g - h + 6 * pr.s, 30 * pr.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // heart-shaped balloon bunch
        const h = 150 * pr.s;
        ctx.strokeStyle = this.hexA(this.palette.skyline, 0.8);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, g);
        ctx.quadraticCurveTo(x + 10, g - h * 0.5, x + 4, g - h);
        ctx.stroke();
        const bob = Math.sin(this.time * 1.4 + pr.x) * 6;
        ctx.fillStyle = this.hexA(this.palette.petal, 0.9);
        heartPath(ctx, x + 4, g - h + bob, 15 * pr.s);
        ctx.fill();
      }
    }
  }

  private drawGround() {
    const ctx = this.ctx;
    const { VW, VH, groundY } = this;
    ctx.fillStyle = this.groundGrad ?? this.palette.groundTop;
    ctx.fillRect(0, groundY, VW, VH - groundY + 2);

    // road band
    const roadH = Math.min(74, (VH - groundY) * 0.6);
    ctx.fillStyle = this.palette.road;
    ctx.fillRect(0, groundY, VW, roadH);
    ctx.fillStyle = this.hexA(this.palette.roadLine, 0.55);
    ctx.fillRect(0, groundY, VW, 3);

    // dashes
    const dashW = 46;
    const gap = 44;
    const off = this.worldX % (dashW + gap);
    ctx.fillStyle = this.hexA(this.palette.roadLine, 0.35);
    for (let x = -off; x < VW; x += dashW + gap) ctx.fillRect(x, groundY + roadH * 0.55, dashW, 4);
  }

  private drawForeground() {
    const ctx = this.ctx;
    const { VW, VH, groundY } = this;
    const band = VW * 2;
    const off = (this.worldX * 1.35) % band;
    const baseY = VH - (VH - groundY) * 0.1;
    const colors = [this.palette.petal, this.palette.accent, "#ffffff"];
    for (const f of this.flowers) {
      let x = f.x - off;
      if (x < -30) x += band;
      if (x > VW + 30) continue;
      const sway = Math.sin(this.time * 2.4 + f.x * 0.03) * 3;
      ctx.strokeStyle = "rgba(20,6,34,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + sway, baseY - f.h * 0.6, x + sway * 1.6, baseY - f.h);
      ctx.stroke();
      ctx.fillStyle = this.hexA(colors[f.c] ?? "#fff", 0.8);
      ctx.beginPath();
      ctx.arc(x + sway * 1.6, baseY - f.h, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // dark grass edge
    ctx.fillStyle = "rgba(12,3,24,0.75)";
    ctx.fillRect(0, VH - 14, VW, 16);
  }

  private drawSpeedLines() {
    const ctx = this.ctx;
    const n = 12;
    const a = (this.hud.speed - 0.45) * 0.5;
    ctx.strokeStyle = `rgba(255,255,255,${a * 0.5})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const seed = (i * 97) % 100;
      const y = ((seed / 100) * this.groundY * 0.92) | 0;
      const len = 60 + ((seed * 3) % 120);
      const x = (this.VW - ((this.worldX * (1.4 + (seed % 5) * 0.2) + seed * 40) % (this.VW + 400))) | 0;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
  }

  private drawAmbientPetals() {
    const ctx = this.ctx;
    for (const p of this.ambientPetals) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawObstacles() {
    const ctx = this.ctx;
    const p = this.palette;
    for (const o of this.obstacles) {
      const x = o.x;
      const y = o.y;
      ctx.save();
      // ground shadow
      if (o.kind !== "bird" && o.kind !== "gate") {
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.beginPath();
        ctx.ellipse(x, this.groundY + 6, o.w * 0.55, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      switch (o.kind) {
        case "bench": {
          ctx.fillStyle = "#7b3f2a";
          rr(ctx, x - o.w / 2, y, o.w, 14, 5);
          ctx.fill();
          ctx.fillStyle = "#96502f";
          rr(ctx, x - o.w / 2, y + 16, o.w, 10, 4);
          ctx.fill();
          ctx.fillStyle = "#40243a";
          ctx.fillRect(x - o.w / 2 + 8, y + 26, 9, o.h - 26);
          ctx.fillRect(x + o.w / 2 - 17, y + 26, 9, o.h - 26);
          ctx.fillStyle = this.hexA(p.accent, 0.35);
          ctx.fillRect(x - o.w / 2, y, o.w, 3);
          break;
        }
        case "crate": {
          ctx.fillStyle = "#8a5a33";
          rr(ctx, x - o.w / 2, y, o.w, o.h, 7);
          ctx.fill();
          ctx.strokeStyle = "#5e3a1f";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x - o.w / 2 + 4, y + 4);
          ctx.lineTo(x + o.w / 2 - 4, y + o.h - 4);
          ctx.moveTo(x + o.w / 2 - 4, y + 4);
          ctx.lineTo(x - o.w / 2 + 4, y + o.h - 4);
          ctx.stroke();
          ctx.fillStyle = "#ff5f8f";
          heartPath(ctx, x, y + o.h * 0.45, 9);
          ctx.fill();
          break;
        }
        case "hydrant": {
          ctx.fillStyle = "#e2455c";
          rr(ctx, x - o.w / 2, y + 8, o.w, o.h - 8, 8);
          ctx.fill();
          ctx.fillStyle = "#ff7d8f";
          rr(ctx, x - o.w / 2 - 5, y + 20, o.w + 10, 10, 4);
          ctx.fill();
          rr(ctx, x - 7, y, 14, 12, 5);
          ctx.fill();
          break;
        }
        case "puddle": {
          ctx.fillStyle = this.hexA(p.accent, 0.25);
          ctx.beginPath();
          ctx.ellipse(x, y + o.h, o.w / 2, o.h * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(120,200,255,0.5)";
          ctx.beginPath();
          ctx.ellipse(x, y + o.h, o.w / 2 - 8, o.h * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.beginPath();
          ctx.ellipse(x - o.w * 0.18, y + o.h - 3, 14, 3.4, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case "gate": {
          // hanging festive banner: slide under
          ctx.fillStyle = "#3b1a4f";
          ctx.fillRect(x - 4, 0, 8, y);
          ctx.fillStyle = "#ff3d7f";
          rr(ctx, x - o.w / 2, y, o.w, o.h, 8);
          ctx.fill();
          ctx.fillStyle = this.hexA(p.accent, 0.9);
          rr(ctx, x - o.w / 2 + 6, y + 8, o.w - 12, o.h - 16, 6);
          ctx.fill();
          ctx.fillStyle = "#ff3d7f";
          heartPath(ctx, x, y + o.h * 0.42, 15);
          ctx.fill();
          // tassels
          ctx.fillStyle = "#ffd166";
          for (let i = 0; i < 4; i++) {
            const tx = x - o.w / 2 + 8 + i * ((o.w - 16) / 3);
            const wob = Math.sin(this.time * 6 + i) * 3;
            ctx.beginPath();
            ctx.moveTo(tx, y + o.h);
            ctx.lineTo(tx + 5, y + o.h);
            ctx.lineTo(tx + 2.5 + wob, y + o.h + 14);
            ctx.closePath();
            ctx.fill();
          }
          break;
        }
        case "bird": {
          const flap = Math.sin(o.t * 16);
          ctx.fillStyle = "#2b1440";
          ctx.beginPath();
          ctx.ellipse(x, y + o.h / 2, o.w * 0.36, o.h * 0.34, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - 4, y + o.h / 2);
          ctx.quadraticCurveTo(x - 26, y + o.h / 2 - 22 * flap, x - 40, y + o.h / 2 - 6 * flap);
          ctx.quadraticCurveTo(x - 24, y + o.h / 2 + 6, x - 4, y + o.h / 2 + 4);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x + 2, y + o.h / 2);
          ctx.quadraticCurveTo(x + 22, y + o.h / 2 - 20 * flap, x + 36, y + o.h / 2 - 4 * flap);
          ctx.quadraticCurveTo(x + 20, y + o.h / 2 + 6, x + 2, y + o.h / 2 + 4);
          ctx.fill();
          ctx.fillStyle = "#ffd166";
          ctx.beginPath();
          ctx.moveTo(x + o.w * 0.34, y + o.h * 0.45);
          ctx.lineTo(x + o.w * 0.56, y + o.h * 0.52);
          ctx.lineTo(x + o.w * 0.34, y + o.h * 0.6);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(x + o.w * 0.22, y + o.h * 0.4, 3.2, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  private drawPickups() {
    const ctx = this.ctx;
    for (const k of this.pickups) {
      const bob = Math.sin(this.time * 3.4 + k.t * 3) * 6;
      const y = k.y + bob;
      ctx.save();
      ctx.translate(k.x, y);
      const pulse = 1 + Math.sin(this.time * 6 + k.t * 4) * 0.07;
      ctx.scale(pulse, pulse);
      if (k.kind === "heart") {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = "#ff9ec4";
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#ff3d7f";
        heartPath(ctx, 0, 0, 13);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.ellipse(-4.5, -5, 3.2, 4.6, -0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (k.kind === "rose") {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#ff5f8f";
        ctx.beginPath();
        ctx.arc(0, 0, 27, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#3fa06a";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(0, 26);
        ctx.stroke();
        ctx.fillStyle = "#3fa06a";
        ctx.beginPath();
        ctx.ellipse(9, 16, 9, 5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e01f52";
        ctx.beginPath();
        ctx.arc(0, -2, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff5f8f";
        ctx.beginPath();
        ctx.arc(-3, -4, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff9ec4";
        ctx.beginPath();
        ctx.arc(1, -6, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffd166";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -14, 8, Math.PI * 0.15, Math.PI * 0.85, true);
        ctx.stroke();
        ctx.fillStyle = "#ffd166";
        heartPath(ctx, 0, 2, 14);
        ctx.fill();
        ctx.fillStyle = "#fff6d8";
        heartPath(ctx, 0, 1, 7);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const t = clamp(p.life / p.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = p.kind === "ring" ? t * 0.8 : t;
      if (p.kind === "ring") {
        const r = p.size + (1 - t) * 90;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * t + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "heart") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        heartPath(ctx, 0, 0, p.size * (0.5 + t * 0.7));
        ctx.fill();
      } else if (p.kind === "spark") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
        ctx.stroke();
      } else if (p.kind === "petal") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "star") {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.size * (0.6 + t * 0.6);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const a2 = a + Math.PI / 5;
          ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
          ctx.lineTo(Math.cos(a2) * s * 0.45, Math.sin(a2) * s * 0.45);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = t * 0.55;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + (1 - t) * 0.9), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawFloaters() {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      const t = clamp(f.life / f.max, 0, 1);
      const pop = 1 + (1 - t) * 0.12;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.7);
      ctx.translate(f.x, f.y);
      ctx.scale(pop, pop);
      ctx.font = `800 ${f.size}px "Baloo 2", system-ui, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(24,6,40,0.85)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawBanner() {
    const b = this.banner;
    if (b.t <= 0) return;
    const ctx = this.ctx;
    const t = b.t;
    const inT = clamp((1 - t) * 6, 0, 1);
    const alpha = t > 0.75 ? inT : Math.min(1, t / 0.35);
    const y = this.VH * 0.3 - (1 - inT) * 30;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    const scale = 0.9 + inT * 0.1 + Math.sin(this.time * 6) * 0.008;
    ctx.translate(this.VW / 2, y);
    ctx.scale(scale, scale);
    ctx.font = `800 ${Math.min(58, this.VW * 0.07)}px "Baloo 2", system-ui, sans-serif`;
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(24,6,40,0.9)";
    ctx.strokeText(b.title, 0, 0);
    const g = ctx.createLinearGradient(0, -40, 0, 20);
    g.addColorStop(0, "#fff");
    g.addColorStop(1, this.palette.accent);
    ctx.fillStyle = g;
    ctx.fillText(b.title, 0, 0);
    if (b.sub) {
      ctx.font = `600 ${Math.min(28, this.VW * 0.034)}px "Baloo 2", system-ui, sans-serif`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(24,6,40,0.85)";
      ctx.strokeText(b.sub, 0, 38);
      ctx.fillStyle = "#ffd9e8";
      ctx.fillText(b.sub, 0, 38);
    }
    ctx.restore();
  }

  /* ---------------- characters ---------------- */
  private limb(
    x: number,
    y: number,
    a1: number,
    l1: number,
    a2: number,
    l2: number,
    color: string,
    w: number,
    shoe?: string,
  ) {
    const ctx = this.ctx;
    const kx = x + Math.sin(a1) * l1;
    const ky = y + Math.cos(a1) * l1;
    const ex = kx + Math.sin(a2) * l2;
    const ey = ky + Math.cos(a2) * l2;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(kx, ky);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (shoe) {
      ctx.fillStyle = shoe;
      ctx.beginPath();
      ctx.ellipse(ex + Math.sin(a2 + 1.2) * 5, ey + 2, 9, 5.5, a2 * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    return { ex, ey };
  }

  private drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;

    // shadow
    const air = clamp((this.groundY - p.y) / 220, 0, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - air * 0.75)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, this.groundY + 6, 26 * (1 - air * 0.35), 7 * (1 - air * 0.35), 0, 0, Math.PI * 2);
    ctx.fill();

    const blink = p.invuln > 0 && Math.floor(this.time * 22) % 2 === 0;
    if (blink && !p.dead) return;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.sx, p.sy);
    ctx.rotate(p.dead ? p.rot : p.lean * 0.5);

    if (p.shield) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(this.time * 7) * 0.1;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -52, 42, 62, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = "#ffd166";
      ctx.fill();
      ctx.restore();
    }

    const skin = "#f3b57f";
    const shirt = "#33e0c2";
    const shirtDark = "#1cb69c";
    const shorts = "#28356b";
    const hair = "#241726";
    const shoe = "#ff5f8f";
    const ph = p.runPhase;

    if (p.sliding && !p.dead) {
      /* ---- slide pose ---- */
      ctx.rotate(-0.05);
      // trailing scarf
      ctx.strokeStyle = "#ff5f8f";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-6, -34);
      ctx.quadraticCurveTo(-40, -40 + Math.sin(this.time * 18) * 6, -74, -26 + Math.sin(this.time * 14) * 8);
      ctx.stroke();
      // legs forward
      this.limb(-4, -22, 1.35, 26, 1.5, 24, shorts, 13, shoe);
      this.limb(-6, -20, 1.05, 24, 1.45, 22, "#33305e", 12, shoe);
      // torso lying back
      ctx.save();
      ctx.translate(-8, -26);
      ctx.rotate(-1.15);
      ctx.fillStyle = shirt;
      rr(ctx, -15, -12, 34, 28, 12);
      ctx.fill();
      ctx.fillStyle = shirtDark;
      rr(ctx, -15, 4, 34, 10, 6);
      ctx.fill();
      ctx.restore();
      // arm braced back
      this.limb(-18, -30, -2.0, 20, -1.7, 18, skin, 9);
      // head
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(16, -40, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.arc(14, -44, 14.6, Math.PI * 0.95, Math.PI * 2.15);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, -46);
      ctx.quadraticCurveTo(-14, -54, -16, -38);
      ctx.quadraticCurveTo(-4, -42, 2, -38);
      ctx.fill();
      ctx.fillStyle = "#1b1226";
      ctx.beginPath();
      ctx.arc(22, -40, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,120,150,0.45)";
      ctx.beginPath();
      ctx.arc(15, -34, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    /* ---- run / air pose ---- */
    const running = p.onGround && !p.dead && !p.hugging;
    const bob = running ? Math.abs(Math.cos(ph)) * 3 : p.hugging ? Math.sin(this.time * 7) * 2 : 0;
    const hipY = -46 - bob;
    const shY = -78 - bob;
    const headY = -95 - bob;

    let legA1: number, legA2: number, legB1: number, legB2: number;
    let armA1: number, armA2: number, armB1: number, armB2: number;
    if (running) {
      legA1 = Math.sin(ph) * 0.92;
      legA2 = legA1 - 0.35 - Math.max(0, Math.sin(ph + 1.3)) * 0.85;
      legB1 = Math.sin(ph + Math.PI) * 0.92;
      legB2 = legB1 - 0.35 - Math.max(0, Math.sin(ph + Math.PI + 1.3)) * 0.85;
      armA1 = -Math.sin(ph) * 0.9;
      armA2 = armA1 + 0.85;
      armB1 = -Math.sin(ph + Math.PI) * 0.9;
      armB2 = armB1 + 0.85;
    } else if (p.hugging) {
      // arms open wide, up on tiptoes for the reunion
      legA1 = 0.16;
      legA2 = 0.1;
      legB1 = -0.16;
      legB2 = -0.1;
      armA1 = 1.35 + Math.sin(this.time * 7) * 0.05;
      armA2 = 1.5;
      armB1 = 1.15 + Math.sin(this.time * 7) * 0.05;
      armB2 = 1.35;
    } else if (p.dead) {
      legA1 = 0.85;
      legA2 = 1.5;
      legB1 = -0.5;
      legB2 = -1.15;
      armA1 = 2.5;
      armA2 = 2.85;
      armB1 = -2.5;
      armB2 = -2.9;
    } else {
      const rising = p.vy < 0;
      legA1 = rising ? 0.8 : 0.5;
      legA2 = rising ? -0.25 : 0.95;
      legB1 = rising ? -0.35 : -0.65;
      legB2 = rising ? -0.95 : -0.25;
      armA1 = rising ? 2.45 : 1.95;
      armA2 = armA1 + 0.3;
      armB1 = rising ? -2.2 : -1.7;
      armB2 = armB1 - 0.3;
    }

    // scarf (behind)
    const wave = Math.sin(this.time * 16) * 7;
    ctx.strokeStyle = "#ff5f8f";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, shY + 4);
    ctx.quadraticCurveTo(-34, shY - 8 + wave, -62, shY + 4 - wave * 0.6);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ff9ec4";
    ctx.beginPath();
    ctx.moveTo(-4, shY + 10);
    ctx.quadraticCurveTo(-28, shY + 12 - wave * 0.6, -50, shY + 22 + wave * 0.5);
    ctx.stroke();

    // back limbs
    this.limb(-2, hipY, legB1, 25, legB2, 25, "#33305e", 13, "#e0446f");
    this.limb(-2, shY, armB1, 20, armB2, 18, "#e0a370", 9);

    // torso
    ctx.fillStyle = shirt;
    rr(ctx, -16, shY - 2, 32, hipY - shY + 12, 13);
    ctx.fill();
    ctx.fillStyle = shirtDark;
    rr(ctx, -16, hipY - 4, 32, 14, 7);
    ctx.fill();
    ctx.fillStyle = shorts;
    rr(ctx, -17, hipY - 2, 34, 16, 8);
    ctx.fill();

    // front limbs
    this.limb(2, hipY, legA1, 25, legA2, 25, shorts, 13, shoe);
    const hand = this.limb(2, shY, armA1, 20, armA2, 18, skin, 9);

    // bouquet in the front hand
    ctx.save();
    ctx.translate(hand.ex, hand.ey);
    ctx.rotate(-0.5 + Math.sin(ph) * 0.15);
    ctx.strokeStyle = "#3fa06a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(0, -12);
    ctx.moveTo(0, -2);
    ctx.lineTo(-7, -12);
    ctx.moveTo(0, -2);
    ctx.lineTo(7, -12);
    ctx.stroke();
    ctx.fillStyle = "#ff2d5f";
    ctx.beginPath();
    ctx.arc(0, -15, 5, 0, Math.PI * 2);
    ctx.arc(-8, -14, 4.2, 0, Math.PI * 2);
    ctx.arc(8, -14, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff9ec4";
    ctx.beginPath();
    ctx.arc(0, -16, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(2, headY, 15, 0, Math.PI * 2);
    ctx.fill();
    // hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(2, headY - 2, 15.4, Math.PI * 1.02, Math.PI * 2.1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-12, headY - 6);
    ctx.quadraticCurveTo(-26, headY - 14, -22, headY + 2);
    ctx.quadraticCurveTo(-14, headY - 4, -8, headY - 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, headY - 12);
    ctx.quadraticCurveTo(20, headY - 20, 14, headY - 2);
    ctx.fill();
    // face
    ctx.fillStyle = "#1b1226";
    ctx.beginPath();
    ctx.arc(9, headY - 1, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1226";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8, headY + 5, 4.5, 0.1, Math.PI * 0.85);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,120,150,0.4)";
    ctx.beginPath();
    ctx.arc(0, headY + 5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawAnjali(x: number, groundY: number) {
    const ctx = this.ctx;
    const r = this.reunion;
    const t = this.time;
    const hugging = r.phase === "hug" && r.hugged;
    const running = r.phase === "out";
    const ph = t * 14;

    // glow
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(t * 3) * 0.05;
    ctx.fillStyle = "#ff9ec4";
    ctx.beginPath();
    ctx.ellipse(x, groundY - 60, 62, 84, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, groundY + 6, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, groundY);
    ctx.scale(-1, 1); // face left toward the boy
    if (hugging) ctx.rotate(0.08);

    const skin = "#f0b07a";
    const dress = "#ff2d6f";
    const dressLight = "#ff7aa8";
    const hair = "#1d1220";

    // dupatta flowing behind
    const wave = Math.sin(t * 8) * 9;
    ctx.strokeStyle = "rgba(255,160,200,0.85)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-6, -70);
    ctx.quadraticCurveTo(-40, -76 + wave, -72, -46 - wave);
    ctx.stroke();

    // legs
    if (running) {
      this.limb(-2, -40, Math.sin(ph) * 0.7, 20, Math.sin(ph) * 0.7 - 0.5, 20, skin, 10, "#ffd166");
      this.limb(2, -40, Math.sin(ph + Math.PI) * 0.7, 20, Math.sin(ph + Math.PI) * 0.7 - 0.5, 20, skin, 10, "#ffd166");
    } else {
      ctx.strokeStyle = skin;
      ctx.lineWidth = 10;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-6, -40);
      ctx.lineTo(-6, -6);
      ctx.moveTo(6, -40);
      ctx.lineTo(6, -6);
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.ellipse(-6, -4, 8, 5, 0, 0, Math.PI * 2);
      ctx.ellipse(6, -4, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // dress (lehenga)
    const flare = running ? 6 + Math.sin(ph) * 4 : 2 + Math.sin(t * 3) * 2;
    ctx.fillStyle = dress;
    ctx.beginPath();
    ctx.moveTo(-14, -74);
    ctx.lineTo(14, -74);
    ctx.quadraticCurveTo(24 + flare, -50, 30 + flare, -26);
    ctx.quadraticCurveTo(0, -18, -30 - flare, -26);
    ctx.quadraticCurveTo(-24 - flare, -50, -14, -74);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dressLight;
    ctx.beginPath();
    ctx.moveTo(-30 - flare, -26);
    ctx.quadraticCurveTo(0, -18, 30 + flare, -26);
    ctx.quadraticCurveTo(0, -30, -30 - flare, -26);
    ctx.fill();
    // gold trim
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-29 - flare, -27);
    ctx.quadraticCurveTo(0, -19, 29 + flare, -27);
    ctx.stroke();

    // choli / blouse
    ctx.fillStyle = "#ffd166";
    rr(ctx, -13, -96, 26, 26, 10);
    ctx.fill();

    // arms
    if (hugging) {
      this.limb(-8, -92, 1.35, 18, 1.5, 16, skin, 8);
      this.limb(8, -92, 1.15, 18, 1.32, 16, skin, 8);
    } else if (running) {
      this.limb(-6, -92, -Math.sin(ph) * 0.75, 17, -Math.sin(ph) * 0.75 + 0.75, 15, skin, 8);
      this.limb(6, -92, Math.sin(ph) * 0.75, 17, Math.sin(ph) * 0.75 + 0.75, 15, skin, 8);
    } else {
      // one arm waving high, the other resting
      const w = Math.sin(t * 9) * 0.45;
      this.limb(-8, -92, 2.85, 17, 3.15 + w, 16, skin, 8);
      this.limb(9, -92, -0.28, 17, -0.12, 15, skin, 8);
    }

    // head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -112, 15, 0, Math.PI * 2);
    ctx.fill();
    // long hair
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -114, 15.6, Math.PI * 0.96, Math.PI * 2.12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-13, -118);
    ctx.quadraticCurveTo(-26, -100, -20 - wave * 0.2, -64);
    ctx.quadraticCurveTo(-10, -74, -8, -108);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(13, -118);
    ctx.quadraticCurveTo(24, -100, 18, -70);
    ctx.quadraticCurveTo(8, -80, 8, -108);
    ctx.fill();
    // flower in hair
    ctx.fillStyle = "#fff0f5";
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(-11 + Math.cos(a) * 4.5, -122 + Math.sin(a) * 4.5, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(-11, -122, 2.6, 0, Math.PI * 2);
    ctx.fill();
    // bindi + face
    ctx.fillStyle = "#e01f52";
    ctx.beginPath();
    ctx.arc(-3, -118, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b1226";
    ctx.beginPath();
    ctx.arc(-8, -112, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1b1226";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-7, -106, 4.5, 0.15, Math.PI * 0.9);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,120,150,0.45)";
    ctx.beginPath();
    ctx.arc(-13, -107, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // floating hearts above her
    const n = hugging ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = t * 1.6 + i * 2.1;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(a * 2) * 0.25;
      ctx.fillStyle = "#ff9ec4";
      heartPath(ctx, x + Math.sin(a) * 26, groundY - 150 - ((t * 30 + i * 40) % 60), 8 + Math.sin(a) * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
