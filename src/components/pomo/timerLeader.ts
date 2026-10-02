// Cross-tab single-writer election for the pomo timer.
//
// All tabs render the shared timer, but only one tab (the lock holder) runs the
// automatic phase-completion side effects (saving sessions, starting splashes).
// The Web Locks API releases automatically when a tab closes, so a waiting tab
// is promoted without any heartbeat.

let isOwner = false;

export function isTimerOwner(): boolean {
  return isOwner;
}

/**
 * Request the exclusive pomo-owner lock for this tab's lifetime. `onChange` is
 * called (with `true`) when the lock is granted. Resolves to a never-settling
 * promise while held so the lock is only released when the tab closes.
 */
export function initTimerLeadership(onChange: (owner: boolean) => void): void {
  navigator.locks
    .request("unitrack:pomo-owner", { mode: "exclusive" }, () => {
      isOwner = true;
      onChange(true);
      return new Promise<void>(() => {});
    })
    .catch(() => {
      /* lock request aborted (e.g. tab teardown) — nothing to do */
    });
}
