import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, type Phase, type RunResult } from "./game/engine";
import Hud from "./components/Hud";
import StartScreen from "./components/StartScreen";
import PauseOverlay from "./components/PauseOverlay";
import GameOverScreen from "./components/GameOverScreen";
import TouchControls from "./components/TouchControls";
import {
  addScore,
  bestOf,
  loadMuted,
  loadName,
  loadScores,
  renameScore,
  saveMuted,
  saveName,
  type ScoreEntry,
} from "./lib/highscores";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [result, setResult] = useState<RunResult | null>(null);
  const [scores, setScores] = useState<ScoreEntry[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [rank, setRank] = useState(-1);
  const [name, setName] = useState("");
  const [muted, setMuted] = useState(false);

  const nameRef = useRef("");
  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  /* boot: restore local data */
  useEffect(() => {
    const list = loadScores();
    setScores(list);
    setName(loadName());
    setMuted(loadMuted());
  }, []);

  const handleGameOver = useCallback((r: RunResult) => {
    setResult(r);
    const display = nameRef.current.trim() || "Runner";
    const res = addScore({
      name: display,
      score: r.score,
      distance: r.distance,
      chapter: r.chapter,
      hearts: r.hearts,
    });
    setScores(res.list);
    setEntryId(res.rank >= 0 ? res.id : null);
    setRank(res.rank);
    engineRef.current?.setBest(bestOf(res.list));
  }, []);

  /* create the engine once */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const eng = new GameEngine(canvas, {
      onPhase: (p) => setPhase(p),
      onGameOver: handleGameOver,
    });
    engineRef.current = eng;
    eng.setBest(bestOf(loadScores()));
    eng.setMuted(loadMuted());
    return () => {
      eng.destroy();
      engineRef.current = null;
    };
  }, [handleGameOver]);

  const start = useCallback(() => {
    setResult(null);
    setEntryId(null);
    setRank(-1);
    engineRef.current?.start();
  }, []);

  const toMenu = useCallback(() => {
    setResult(null);
    setEntryId(null);
    setRank(-1);
    engineRef.current?.toMenu();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      saveMuted(next);
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const changeName = useCallback(
    (v: string) => {
      setName(v);
      saveName(v);
      if (entryId) setScores(renameScore(entryId, v.trim() || "Runner"));
    },
    [entryId],
  );

  const playing = phase === "playing";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-dusk-950">
      {/* game surface */}
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* soft screen edges for a cohesive frame */}
      <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_140px_rgba(20,4,38,0.75)]" />

      <Hud
        engineRef={engineRef}
        visible={playing || phase === "paused"}
        muted={muted}
        onPause={() => engineRef.current?.pause()}
        onToggleMute={toggleMute}
      />

      <TouchControls engineRef={engineRef} visible={playing} />

      {phase === "menu" && (
        <StartScreen
          name={name}
          onName={changeName}
          scores={scores}
          onStart={start}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {phase === "paused" && (
        <PauseOverlay
          score={engineRef.current?.hud.score ?? 0}
          distance={engineRef.current?.hud.distance ?? 0}
          chapter={engineRef.current?.hud.chapter ?? 1}
          onResume={() => engineRef.current?.resume()}
          onRestart={start}
          onMenu={toMenu}
        />
      )}

      {phase === "gameover" && result && (
        <GameOverScreen
          result={result}
          scores={scores}
          highlightId={entryId}
          rank={rank}
          name={name}
          onName={changeName}
          onRestart={start}
          onMenu={toMenu}
        />
      )}
    </div>
  );
}
