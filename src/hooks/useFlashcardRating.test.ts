import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  setters: [] as ReturnType<typeof vi.fn>[],
  cleanups: [] as (() => void)[],
}));

// Exercise the async lifecycle, immediate tap lock, and unmount guard.
vi.mock("react", () => ({
  useState: (initial: unknown) => {
    const setter = vi.fn();
    harness.setters.push(setter);
    return [initial, setter];
  },
  useRef: (current: unknown) => ({ current }),
  useEffect: (effect: () => () => void) => harness.cleanups.push(effect()),
}));

import { useFlashcardRating } from "./useFlashcardRating";

beforeEach(() => {
  harness.setters = [];
  harness.cleanups = [];
});

function pendingSave() {
  let resolve!: (saved: boolean) => void;
  const promise = new Promise<boolean>((done) => { resolve = done; });
  return { save: vi.fn(() => promise), resolve };
}

function actions(save: () => Promise<boolean>, isLastCard = false) {
  return { save, advance: vi.fn(), rollback: vi.fn(), complete: vi.fn(), isLastCard };
}

describe("flashcard rating feedback", () => {
  it("shows the next card before a slow save and blocks duplicate taps", async () => {
    const hook = useFlashcardRating();
    const pending = pendingSave();
    const review = actions(pending.save);
    const request = hook.submitRating(review);
    expect(review.advance).toHaveBeenCalledOnce();
    expect(harness.setters[0]).toHaveBeenCalledWith(true);
    await hook.submitRating(review);
    expect(pending.save).toHaveBeenCalledOnce();
    expect(review.advance).toHaveBeenCalledOnce();
    pending.resolve(true);
    await request;
    expect(review.rollback).not.toHaveBeenCalled();
    expect(review.complete).not.toHaveBeenCalled();
    expect(harness.setters[0]).toHaveBeenLastCalledWith(false);
  });

  it.each(["reported", "rejected"])("restores the rated card after a %s failure and allows retry", async (failure) => {
    const hook = useFlashcardRating();
    const review = actions(failure === "reported"
      ? vi.fn(async () => false)
      : vi.fn(async () => { throw new Error("Network unavailable"); }));
    await hook.submitRating(review);
    expect(review.rollback).toHaveBeenCalledOnce();
    expect(harness.setters[1]).toHaveBeenLastCalledWith(true);
    const retry = actions(vi.fn(async () => true));
    await hook.submitRating(retry);
    expect(retry.save).toHaveBeenCalledOnce();
    expect(harness.setters[1]).toHaveBeenLastCalledWith(false);
  });

  it("only completes the last card after confirmed persistence", async () => {
    const hook = useFlashcardRating();
    const pending = pendingSave();
    const review = actions(pending.save, true);
    const request = hook.submitRating(review);
    expect(review.advance).not.toHaveBeenCalled();
    expect(review.complete).not.toHaveBeenCalled();
    pending.resolve(true);
    await request;
    expect(review.complete).toHaveBeenCalledOnce();
  });

  it("does not complete a session when its last review fails", async () => {
    const review = actions(async () => false, true);
    await useFlashcardRating().submitRating(review);
    expect(review.complete).not.toHaveBeenCalled();
    expect(review.rollback).toHaveBeenCalledOnce();
  });

  it.each([true, false])("ignores a save result after leaving the view: %s", async (saved) => {
    const hook = useFlashcardRating();
    const pending = pendingSave();
    const review = actions(pending.save, true);
    const request = hook.submitRating(review);
    harness.cleanups.forEach((cleanup) => cleanup());
    harness.setters.forEach((setter) => setter.mockClear());
    pending.resolve(saved);
    await request;
    expect(review.complete).not.toHaveBeenCalled();
    expect(review.rollback).not.toHaveBeenCalled();
    harness.setters.forEach((setter) => expect(setter).not.toHaveBeenCalled());
  });
});
