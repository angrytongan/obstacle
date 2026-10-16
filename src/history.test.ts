import { describe, expect, it } from "vitest";
import { createHistory, pushHistory, redoHistory, undoHistory } from "./history";

describe("history", () => {
  it("starts with empty past and future", () => {
    const h = createHistory(1);
    expect(h).toEqual({ past: [], present: 1, future: [] });
  });

  it("pushHistory moves the old present into past and sets the new present", () => {
    const h = pushHistory(createHistory(1), 2);
    expect(h).toEqual({ past: [1], present: 2, future: [] });
  });

  it("pushHistory clears future, invalidating any pending redo", () => {
    let h = createHistory(1);
    h = pushHistory(h, 2);
    h = undoHistory(h);
    expect(h.future).toEqual([2]);
    h = pushHistory(h, 3);
    expect(h).toEqual({ past: [1], present: 3, future: [] });
  });

  it("undoHistory is a no-op when past is empty", () => {
    const h = createHistory(1);
    expect(undoHistory(h)).toEqual(h);
  });

  it("redoHistory is a no-op when future is empty", () => {
    const h = createHistory(1);
    expect(redoHistory(h)).toEqual(h);
  });

  it("undo then redo round-trips back to the same present", () => {
    let h = createHistory(1);
    h = pushHistory(h, 2);
    h = pushHistory(h, 3);
    h = undoHistory(h);
    expect(h.present).toBe(2);
    h = redoHistory(h);
    expect(h.present).toBe(3);
  });

  it("walks back through multiple past entries in order", () => {
    let h = createHistory(1);
    h = pushHistory(h, 2);
    h = pushHistory(h, 3);
    h = undoHistory(h);
    h = undoHistory(h);
    expect(h).toEqual({ past: [], present: 1, future: [2, 3] });
  });

  it("walks forward through multiple future entries in order", () => {
    let h = createHistory(1);
    h = pushHistory(h, 2);
    h = pushHistory(h, 3);
    h = undoHistory(h);
    h = undoHistory(h);
    h = redoHistory(h);
    h = redoHistory(h);
    expect(h).toEqual({ past: [1, 2], present: 3, future: [] });
  });
});
