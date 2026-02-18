import { describe, expect, it } from "vitest";
import { formatDateTime } from "../src/utils/dateTime";

describe("dateTime", () => {
  it("formats with locale", () => {
    const iso = "2026-01-02T03:04:05.000Z";
    const enText = formatDateTime(iso, "en");
    const jaText = formatDateTime(iso, "ja");

    expect(enText).toBeTruthy();
    expect(jaText).toBeTruthy();
    expect(enText).not.toBe(jaText);
  });

  it("returns null for invalid dates", () => {
    expect(formatDateTime("invalid-date", "en")).toBeNull();
  });
});
