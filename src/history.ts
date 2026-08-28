export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Commits a new present. Clears future — a new edit invalidates any pending redo. */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  return { past: [...history.past, history.present], present: next, future: [] };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const present = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present, future: [history.present, ...history.future] };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [present, ...rest] = history.future;
  return { past: [...history.past, history.present], present, future: rest };
}
