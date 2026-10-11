"use client";

import { useEffect, useRef, useState } from "react";

// Share of the remaining gap the ring closes each frame: higher stays closer to the dot
const RING_FOLLOW = 0.45;
// Ring grows and fills with marker over anything clickable
const INTERACTIVE = 'a, button, [role="button"], [role="menuitem"], [role="tab"], label, select, summary, .rf-btn, [data-cursor="hover"]';
// Text entry keeps the native I-beam; the custom cursor steps aside
const TEXT_ENTRY =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="button"]):not([type="submit"]):not([type="file"]), textarea, [contenteditable="true"]';

/** Ink dot plus a trailing ring. Mouse and pen only; off for touch and reduced motion. */
export default function AnimatedCursor() {
  const [enabled, setEnabled] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !reduced.matches);
    update();
    fine.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const layer = layerRef.current;
    if (!dot || !ring || !layer) return;

    const root = document.documentElement;
    root.classList.add("rf-cursor-on");

    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let frame = 0;

    const tick = () => {
      pos.x += (target.x - pos.x) * RING_FOLLOW;
      pos.y += (target.y - pos.y) * RING_FOLLOW;
      ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      // Stop once settled; the next move restarts the loop
      frame = Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 0.1 ? requestAnimationFrame(tick) : 0;
    };

    const setState = (state: string | null) => {
      if (state) layer.dataset.state = state;
      else delete layer.dataset.state;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      target.x = e.clientX;
      target.y = e.clientY;
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      if (layer.dataset.hidden) {
        // Re-entering: jump the ring instead of sweeping across the page
        pos.x = target.x;
        pos.y = target.y;
        ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
        delete layer.dataset.hidden;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onOver = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest(TEXT_ENTRY)) setState("text");
      else if (el?.closest(INTERACTIVE)) setState("hover");
      else setState(null);
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      layer.dataset.pressed = "true";
      if (layer.dataset.state === "text") return;
      const ripple = document.createElement("span");
      ripple.className = "rf-cursor-ripple";
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
      layer.appendChild(ripple);
    };
    const onUp = () => delete layer.dataset.pressed;

    // Leaving the window, or moving into an iframe
    const onOut = (e: MouseEvent) => {
      if (!e.relatedTarget) layer.dataset.hidden = "true";
    };

    layer.dataset.hidden = "true";
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseout", onOut);
    window.addEventListener("blur", onUp);

    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("rf-cursor-on");
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("blur", onUp);
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <div ref={layerRef} className="rf-cursor" aria-hidden="true">
      <div ref={ringRef} className="rf-cursor-ring">
        <span />
      </div>
      <div ref={dotRef} className="rf-cursor-dot">
        <span />
      </div>
    </div>
  );
}
