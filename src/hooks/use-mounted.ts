"use client";

import { useSyncExternalStore } from "react";

// Returns true once the component has mounted on the client. Useful for
// gating renders that depend on persisted (localStorage) state to avoid
// hydration mismatches. Uses useSyncExternalStore (the React-blessed pattern
// for reading external mutable state without effect-driven setState).
const emptySubscribe = () => () => {};
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false // server snapshot
  );
}
