import { describe, expect, it, vi, afterEach } from "vitest";
import { getFloodWaitSeconds, isAuthError, retryWithFloodWait } from "../src/utils/telegramRetry.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("telegramRetry", () => {
  it("extracts flood wait seconds", () => {
    expect(getFloodWaitSeconds({ message: "FLOOD_WAIT_12" })).toBe(12);
    expect(getFloodWaitSeconds({ seconds: 3 })).toBe(3);
  });

  it("retries once on flood wait", async () => {
    vi.useFakeTimers();
    let count = 0;

    const promise = retryWithFloodWait(async () => {
      count += 1;
      if (count === 1) {
        const err = new Error("FLOOD_WAIT_1") as Error & { seconds?: number };
        err.seconds = 1;
        throw err;
      }

      return "ok";
    });

    await vi.advanceTimersByTimeAsync(1000);
    await expect(promise).resolves.toBe("ok");
    expect(count).toBe(2);
  });

  it("detects auth errors", () => {
    expect(isAuthError({ message: "AUTH_KEY_UNREGISTERED" })).toBe(true);
    expect(isAuthError({ message: "OTHER" })).toBe(false);
  });
});
