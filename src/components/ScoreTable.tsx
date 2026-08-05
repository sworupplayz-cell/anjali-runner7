import type { ScoreEntry } from "../lib/highscores";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ScoreTable({
  scores,
  highlightId,
  max = 8,
  compact = false,
}: {
  scores: ScoreEntry[];
  highlightId?: string | null;
  max?: number;
  compact?: boolean;
}) {
  const rows = scores.slice(0, max);
  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-extrabold tracking-[0.2em] text-rose-200/70 uppercase">Hall of Love</h3>
        <span className="text-[11px] font-semibold text-white/40">local high scores</span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-sm text-white/45">
          No runs yet — be the first to reach Anjali 💗
        </div>
      ) : (
        <ol className={`scroll-thin space-y-1 overflow-y-auto pr-1 ${compact ? "max-h-40" : "max-h-56"}`}>
          {rows.map((s, i) => {
            const hot = s.id === highlightId;
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-colors ${
                  hot
                    ? "border-rose-300/70 bg-rose-400/20 text-white shadow-[0_0_24px_-6px_rgba(255,99,150,0.8)]"
                    : "border-white/8 bg-white/5 text-white/85"
                }`}
              >
                <span className="w-6 text-center text-xs font-bold text-white/50">{MEDALS[i] ?? i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                <span className="hidden text-[11px] font-semibold text-rose-200/60 sm:inline">
                  {s.distance}m · ch{s.chapter}
                </span>
                <span className="w-16 text-right font-extrabold tabular-nums text-amber-200">
                  {s.score.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
