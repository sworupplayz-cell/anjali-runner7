import ScoreTable from "./ScoreTable";
import type { ScoreEntry } from "../lib/highscores";
import type { RunResult } from "../game/engine";

export default function GameOverScreen({
  result,
  scores,
  highlightId,
  rank,
  name,
  onName,
  onRestart,
  onMenu,
}: {
  result: RunResult;
  scores: ScoreEntry[];
  highlightId: string | null;
  rank: number;
  name: string;
  onName: (v: string) => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  const isTop = rank >= 0 && rank < 3;
  const madeBoard = rank >= 0;
  const line = isTop
    ? "Fate stumbled, but your love is legendary."
    : madeBoard
      ? "So close — she almost heard your footsteps."
      : "The city got in the way. Try once more?";

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-dusk-950/72 px-4 py-6 backdrop-blur-[3px] sm:items-center">
      <div className="anim-rise glass w-full max-w-md rounded-3xl p-5 sm:p-6">
        <div className="text-center">
          <div className="text-3xl anim-floaty">💔</div>
          <h2 className="mt-1 text-3xl font-extrabold text-white">
            Missed her<span className="font-script text-rose-300">…</span>
          </h2>
          <p className="mt-1 text-sm text-rose-100/70">{line}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-rose-200/20 bg-gradient-to-br from-rose-500/15 to-fuchsia-500/10 p-4 text-center">
          <p className="text-[10px] font-bold tracking-[0.25em] text-rose-200/70 uppercase">Love points</p>
          <p className="text-5xl leading-none font-extrabold tabular-nums text-white drop-shadow-[0_4px_16px_rgba(255,90,150,0.5)]">
            {result.score.toLocaleString()}
          </p>
          {madeBoard && (
            <p className="mt-1.5 inline-block rounded-full bg-amber-300/90 px-3 py-0.5 text-[11px] font-extrabold tracking-wide text-amber-950 uppercase anim-pop">
              {rank === 0 ? "🏆 New best run!" : `#${rank + 1} on the board`}
            </p>
          )}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            ["🏃 Dist", `${result.distance}m`],
            ["📖 Ch.", String(result.chapter)],
            ["💗 Hearts", String(result.hearts)],
            ["🔥 Combo", `×${result.maxCombo}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/5 py-2">
              <p className="text-[9px] font-bold tracking-wider text-rose-200/60 uppercase">{k}</p>
              <p className="text-sm font-extrabold text-white">{v}</p>
            </div>
          ))}
        </div>

        {madeBoard && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-widest text-rose-200/70 uppercase">Name</span>
            <input
              value={name}
              onChange={(e) => onName(e.target.value.slice(0, 14))}
              placeholder="Runner"
              className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-semibold text-white placeholder-white/30 outline-none focus:border-rose-300/60"
            />
          </div>
        )}

        <button
          onClick={onRestart}
          className="btn-love mt-4 w-full rounded-2xl py-3.5 text-lg font-extrabold tracking-wide text-white uppercase"
        >
          ↻ Run again
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={onMenu} className="btn-ghost rounded-2xl py-2.5 text-sm font-bold text-white">
            Main menu
          </button>
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/5 text-[11px] font-semibold text-white/45">
            Space to restart
          </div>
        </div>

        <div className="mt-4">
          <ScoreTable scores={scores} highlightId={highlightId} compact />
        </div>
      </div>
    </div>
  );
}
