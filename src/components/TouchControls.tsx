import { useEffect, useRef, useState } from "react";
import type { GameEngine } from "../game/engine";

export default function TouchControls({
  engineRef,
  visible,
}: {
  engineRef: React.RefObject<GameEngine | null>;
  visible: boolean;
}) {
  const [touch, setTouch] = useState(false);
  const jumpRef = useRef<HTMLButtonElement>(null);
  const slideRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setTouch(mq.matches || "ontouchstart" in window);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  if (!touch) return null;

  const press = (el: HTMLElement | null, on: boolean) => el?.classList.toggle("is-active", on);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between px-5 pb-6 transition-opacity duration-200 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button
        ref={slideRef}
        className="touch-pad pointer-events-auto grid h-24 w-24 place-items-center rounded-full text-white"
        onPointerDown={(e) => {
          e.preventDefault();
          engineRef.current?.setSlide(true);
          press(slideRef.current, true);
        }}
        onPointerUp={() => {
          engineRef.current?.setSlide(false);
          press(slideRef.current, false);
        }}
        onPointerLeave={() => {
          engineRef.current?.setSlide(false);
          press(slideRef.current, false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="text-2xl leading-none">⬇︎</span>
        <span className="mt-1 text-[10px] font-extrabold tracking-widest">SLIDE</span>
      </button>
      <button
        ref={jumpRef}
        className="touch-pad pointer-events-auto grid h-28 w-28 place-items-center rounded-full text-white"
        onPointerDown={(e) => {
          e.preventDefault();
          engineRef.current?.jump();
          press(jumpRef.current, true);
        }}
        onPointerUp={() => press(jumpRef.current, false)}
        onPointerLeave={() => press(jumpRef.current, false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="text-2xl leading-none">⬆︎</span>
        <span className="mt-1 text-[10px] font-extrabold tracking-widest">JUMP</span>
      </button>
    </div>
  );
}
