import { useEffect, useRef, type MutableRefObject } from "react";
import { BimScene } from "../viewer/scene";
import type { BimElement } from "../model/types";

/**
 * Owns the canvas + BimScene lifecycle. The scene is imperative (camera loop
 * outside React); the app talks to it through `sceneRef`.
 */
export function Viewer({
  sceneRef,
  elements,
  theme,
}: {
  sceneRef: MutableRefObject<BimScene | null>;
  elements: BimElement[];
  theme: "dark" | "light";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const scene = new BimScene();
    scene.init(canvas);
    scene.build(elements);
    scene.setTheme(document.documentElement.dataset.theme === "light");
    sceneRef.current = scene;

    const resize = () => scene.resize(wrap.clientWidth, wrap.clientHeight);
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // The model is immutable for the app's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  useEffect(() => {
    sceneRef.current?.setTheme(theme === "light");
  }, [theme, sceneRef]);

  return (
    <div ref={wrapRef} className="viewer">
      <canvas ref={canvasRef} className="viewer__canvas" />
    </div>
  );
}
