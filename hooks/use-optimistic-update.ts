"use client";

import { useOptimistic, useState, useTransition } from "react";

/** What a Server Action reports back: no error means the server did it. */
export type UpdateOutcome = { error: string | null };

const UNEXPECTED_FAILURE = "Something went wrong. Nothing was changed; try again shortly.";

/**
 * One way to do an optimistic update: apply the change on screen at once, let the
 * server confirm it, roll back if it refuses or fails, and report why.
 *
 * Use it only for changes the Administrator can undo. `state` is the server's truth;
 * once the action settles and the server data is refreshed, it replaces the optimistic copy.
 */
export function useOptimisticUpdate<State, Change>(state: State, apply: (current: State, change: Change) => State) {
  const [value, applyOptimistically] = useOptimistic(state, apply);
  const [pending, startTransition] = useTransition();
  const [refusal, setRefusal] = useState<{ change: Change; reason: string } | null>(null);

  function run(change: Change, perform: () => Promise<UpdateOutcome>) {
    setRefusal(null);
    startTransition(async () => {
      applyOptimistically(change);

      let outcome: UpdateOutcome;
      try {
        outcome = await perform();
      } catch {
        outcome = { error: UNEXPECTED_FAILURE };
      }

      // The optimistic copy rolls back by itself when this transition ends.
      if (outcome.error) startTransition(() => setRefusal({ change, reason: outcome.error as string }));
    });
  }

  return { value, pending, refusal, run };
}
