import { useRef } from "react";
import { useLab } from "../store";
import type { SimSnapshot } from "../types";

/** Last snapshot that produced `key`. A new step() object with the same paint key is ignored. */
export function useSnapshotForKey(key: string): SimSnapshot {
  const box = useRef<{ key: string; snap: SimSnapshot } | null>(null);
  if (box.current?.key !== key) {
    box.current = { key, snap: useLab.getState().snapshot };
  }
  return box.current.snap;
}
