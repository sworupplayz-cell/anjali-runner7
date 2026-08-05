import { useEffect, useRef } from "react";
import type { GameEngine } from "../game/engine";

interface Props {
  engineRef: React.RefObject<GameEngine | null>;
  visible: boolean;
  muted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

export default function Hud({ engineRef, visible, muted, onPause, onToggleMute }: Props) {
  const score = useRef<HTMLSpanElement>(null);
  const dist = useRef<HTMLSpanElement>(null);
  const best = useRef<HTMLSpanElement>(null);
  const chapter = useRef<HTMLSpanElement>(null);
  const toAnjali = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const barM = useRef<HTMLDivElement>(null);
  const barHead = useRef<HTMLDivElement>(null);
  const combo = useRef<HTMLDivElement>(null);
  const mult = useRef<HTMLDivElement>(null);
  const shield = useRef<HTMLDivElement>(null);
  const lives = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastScore = -1;
    let lastLives = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const eng = engineRef.current;
      if (!eng) return;
      const h = eng.hud;
      if (score.current && h.score !== lastScore) {
        score.current.textContent = h.score.toLocaleString();
        lastScore = h.score;
      }
      if (dist.current) dist.current.textContent = `${h.distance} m`;
      if (best.current) best.current.textContent = h.best.toLocaleString();
      if (chapter.current) chapter.current.textContent = `Ch. ${h.chapter} · ${h.chapterName}`;
      if (toAnjali.current) toAnjali.current.textContent = `${h.toAnjali} m to Anjali`;
      const pct = `${(h.progress * 100).toFixed(1)}%`;
      if (bar.current) bar.current.style.width = pct;
      if (barM.current) barM.current.style.width = pct;
      if (barHead.current) barHead.current.style.left = `${(h.progress * 100).toFixed(1)}%`;
      if (combo.current) {
        const on = h.combo >= 2;
        combo.current.style.opacity = on ? "1" : "0";
        combo.current.style.transform = on ? "scale(1)" : "scale(0.8)";
        if (on) combo.current.textContent = `COMBO ×${h.combo}`;
      }
      if (mult.current) {
        const on = h.multiplier > 1;
        mult.current.style.opacity = on ? "1" : "0";
        mult.current.style.transform = on ? "scale(1)" : "scale(0.8)";
        if (on) mult.current.textContent = `LOVE ×${h.multiplier} · ${Math.ceil(h.multiplierT * 9)}s`;
      }
      if (shield.current) {
        shield.current.style.opacity = h.shield ? "1" : "0";
        shield.current.style.transform = h.shield ? "scale(1)" : "scale(0.8)";
      }
      if (lives.current && h.lives !== lastLives) {
        lastLives = h.lives;
        const kids = lives.current.children;
        for (let i = 0; i < kids.length; i++) {
          const el = kids[i] as HTMLElement;
          const alive = i < h.lives;
          el.style.opacity = alive ? "1" : "0.22";
          el.style.filter = alive ? "none" : "grayscale(1)";
          el.style.transform = alive ? "scale(1)" : "scale(0.82)";
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engineRef]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-0 z-20 select-none px-3 pt-3 transition-opacity duration-300 sm:px-5 sm:pt-4 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto flex w-full max-w-4xl items-start justify-between gap-2">
        {/* score */}
        <div className="rounded-2xl border border-white/15 bg-black/35 px-3 py-2 backdrop-blur-md sm:px-4">
          <div className="flex items-baseline gap-1.5">
            <span ref={score} className="text-2xl leading-none font-extrabold tabular-nums text-white sm:text-3xl">
              0
            </span>
            <span className="text-[10px] font-bold tracking-widest text-rose-200/80 uppercase">pts</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-rose-100/70">
            <span ref={dist}>0 m</span>
            <span className="text-white/25">|</span>
            <span className="text-amber-200/80">
              best <span ref={best}>0</span>
            </span>
          </div>
        </div>

        {/* progress to anjali */}
        <div className="mt-1 hidden min-w-0 flex-1 flex-col items-center gap-1 sm:flex">
          <span ref={chapter} className="text-[11px] font-bold tracking-wider text-rose-100/80 uppercase">
            Ch. 1
          </span>
          <div className="relative h-3 w-full max-w-xs overflow-visible rounded-full border border-white/15 bg-black/40">
            <div
              ref={bar}
              className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-rose-400 to-amber-300 transition-[width] duration-100"
              style={{ width: "0%" }}
            />
            <div
              ref={barHead}
              className="absolute -top-1.5 -ml-2.5 text-base leading-none transition-[left] duration-100"
              style={{ left: "0%" }}
            >
              🏃
            </div>
            <div className="absolute -top-2 -right-1 text-lg leading-none anim-beat">💃</div>
          </div>
          <span ref={toAnjali} className="text-[11px] font-semibold text-white/60">
            0 m to Anjali
          </span>
        </div>

        {/* lives + buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <div ref={lives} className="flex items-center gap-1 rounded-2xl border border-white/15 bg-black/35 px-2.5 py-1.5 backdrop-blur-md">
              <span className="text-lg leading-none transition-all duration-200">❤️</span>
              <span className="text-lg leading-none transition-all duration-200">❤️</span>
              <span className="text-lg leading-none transition-all duration-200">❤️</span>
            </div>
            <button
              onClick={onToggleMute}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/35 text-base backdrop-blur-md active:scale-95"
              aria-label="Toggle sound"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={onPause}
              className="pointer-events-auto grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/35 text-base backdrop-blur-md active:scale-95"
              aria-label="Pause"
            >
              ⏸️
            </button>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div
              ref={combo}
              className="rounded-full bg-gradient-to-r from-amber-300 to-rose-400 px-2.5 py-0.5 text-[11px] font-extrabold text-rose-950 opacity-0 transition-all duration-150"
            >
              COMBO
            </div>
            <div
              ref={mult}
              className="rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white opacity-0 transition-all duration-150"
            >
              LOVE ×2
            </div>
            <div
              ref={shield}
              className="rounded-full bg-gradient-to-r from-amber-200 to-amber-400 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-950 opacity-0 transition-all duration-150"
            >
              🔒 LOCKET
            </div>
          </div>
        </div>
      </div>

      {/* compact mobile progress */}
      <div className="mx-auto mt-2 flex w-full max-w-4xl items-center gap-2 sm:hidden">
        <div className="relative h-2.5 flex-1 rounded-full border border-white/15 bg-black/40">
          <div
            ref={barM}
            className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-rose-400 to-amber-300"
            style={{ width: "0%" }}
          />
          <div className="absolute -top-2 -right-1 text-base leading-none anim-beat">💃</div>
        </div>
      </div>
    </div>
  );
}
