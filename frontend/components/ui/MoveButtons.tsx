"use client";

import { ArrowUp, ArrowDown } from "lucide-react";

/** Return a copy of `list` with the item at `index` swapped one step in `direction`. */
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type Props = {
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
};

/** Up/down reorder buttons for editor cards. Clicks don't toggle the card's accordion. */
export default function MoveButtons({ index, count, onMove }: Props) {
  const buttonClass =
    "p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition disabled:opacity-20 disabled:cursor-not-allowed";
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onMove(-1); }}
        disabled={index <= 0}
        className={buttonClass}
        title="Move up"
        aria-label="Move up"
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onMove(1); }}
        disabled={index >= count - 1}
        className={buttonClass}
        title="Move down"
        aria-label="Move down"
      >
        <ArrowDown size={14} />
      </button>
    </>
  );
}
