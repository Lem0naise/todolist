import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useGuest } from "./useGuestMode";
import { useGuestPomoSessions } from "./useGuestPomoSessions";
import { useLocalCache } from "./useLocalCache";
import type { PomoSession } from "../components/pomo/usePomoData";
import { aggregateTaskSpent, type TaskSpent } from "../components/pomo/spent";
import type { Todo } from "../components/todos/utils";

/**
 * Per-task work totals, sourced from Convex when authenticated and from
 * localStorage in guest mode. Sessions without a task id are ignored.
 */
export function useTaskSpent(
  todos: Todo[] | null | undefined,
): Map<string, TaskSpent> {
  const { isGuest } = useGuest();
  const live = useQuery(api.pomo.list);
  const cached = useLocalCache<PomoSession[]>("pomo:sessions", live);
  const guest = useGuestPomoSessions(isGuest);

  return useMemo(
    () =>
      aggregateTaskSpent(todos, isGuest ? guest.sessions : (cached ?? [])),
    [todos, isGuest, guest.sessions, cached],
  );
}
