import ScoreTable from "./ScoreTable";
import type { ScoreEntry } from "../lib/highscores";

export default function StartScreen({
  name,
  onName,
  scores,
  onStart,
  muted,
  onToggleMute,
}: {
  name: string;
  onName: (v: string) => void;
  scores: ScoreEntry[];
  onStart: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-gradient-to-b from-dusk-950/70 via-dusk-950/55 to-dusk-950/85 px-4 py-6 backdrop-blur-[3px] sm:items-center">
      <div className="anim-rise glass w-full max-w-md rounded-3xl p-5 sm:p-6">
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-2 text-2xl">
            <span className="anim-floaty">💌</span>
            <span className="anim-beat">💗</span>
            <span className="anim-floaty" style={{ animationDelay: "0.8s" }}>
              🌹
            </span>
          </div>
          <p className="text-[11px] font-extrabold tracking-[0.35em] text-rose-200/70 uppercase">An endless love run</p>
          <h1 className="title-shimmer mt-1 text-4xl leading-tight font-extrabold sm:text-5xl">Run to</h1>
          <h1 className="-mt-1 font-script text-5xl text-rose-300 drop-shadow-[0_4px_18px_rgba(255,80,140,0.55)] sm:text-6xl">
            Anjali
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-rose-100/70">
            Sprint across the sunset city, dodge the traffic of fate and collect every heart. She's waiting at the end
            of each chapter.
          </p>
        </div>

        <button
          onClick={onStart}
          className="btn-love mt-5 w-full rounded-2xl py-3.5 text-lg font-extrabold tracking-wide text-white uppercase"
        >
          ▶ Start running
        </button>
        <p className="mt-1.5 text-center text-[11px] font-semibold text-white/40">
          press <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">Space</span> to start
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-semibold text-white/70">
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <p className="mb-1 text-[10px] tracking-widest text-rose-200/70 uppercase">Keyboard</p>
            <p>Space / ↑ / W — jump (×2 for double)</p>
            <p>↓ / S — slide under</p>
            <p>P / Esc — pause</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">
            <p className="mb-1 text-[10px] tracking-widest text-rose-200/70 uppercase">Touch</p>
            <p>Tap top — jump</p>
            <p>Tap bottom / swipe down — slide</p>
            <p>Use the on-screen pads</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold text-white/60">
          <div className="rounded-lg bg-white/5 py-1.5">💗 +20</div>
          <div className="rounded-lg bg-white/5 py-1.5">🌹 ×2 love</div>
          <div className="rounded-lg bg-white/5 py-1.5">🔒 shield</div>
          <div className="rounded-lg bg-white/5 py-1.5">💃 +bonus</div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <label className="text-[11px] font-bold tracking-widest text-rose-200/70 uppercase" htmlFor="runner">
            You
          </label>
          <input
            id="runner"
            value={name}
            onChange={(e) => onName(e.target.value.slice(0, 14))}
            placeholder="Your name"
            className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-semibold text-white placeholder-white/30 outline-none focus:border-rose-300/60"
          />
          <button
            onClick={onToggleMute}
            className="btn-ghost grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base"
            aria-label="Toggle sound"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        </div>

        <div className="mt-4">
          <ScoreTable scores={scores} compact />
        </div>
      </div>
    </div>
  );
}
