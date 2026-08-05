export default function PauseOverlay({
  score,
  distance,
  chapter,
  onResume,
  onRestart,
  onMenu,
}: {
  score: number;
  distance: number;
  chapter: number;
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-dusk-950/70 px-4 backdrop-blur-[3px]">
      <div className="anim-pop glass w-full max-w-xs rounded-3xl p-6 text-center">
        <div className="text-3xl">⏸️</div>
        <h2 className="mt-1 text-2xl font-extrabold text-white">Caught your breath?</h2>
        <p className="mt-1 text-sm text-rose-100/70">Anjali is still waiting, don't be late.</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Score", score.toLocaleString()],
            ["Distance", `${distance}m`],
            ["Chapter", String(chapter)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-white/10 bg-white/5 py-2">
              <p className="text-[10px] font-bold tracking-widest text-rose-200/60 uppercase">{k}</p>
              <p className="text-sm font-extrabold text-white">{v}</p>
            </div>
          ))}
        </div>

        <button onClick={onResume} className="btn-love mt-5 w-full rounded-2xl py-3 font-extrabold text-white uppercase">
          Resume
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={onRestart} className="btn-ghost rounded-2xl py-2.5 text-sm font-bold text-white">
            Restart
          </button>
          <button onClick={onMenu} className="btn-ghost rounded-2xl py-2.5 text-sm font-bold text-white">
            Menu
          </button>
        </div>
        <p className="mt-3 text-[11px] font-semibold text-white/35">Space / P to resume</p>
      </div>
    </div>
  );
}
