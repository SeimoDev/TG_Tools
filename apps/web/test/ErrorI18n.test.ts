import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { i18n } from "./testUtils";
import { toErrorMessage } from "../src/utils/error";

describe("error i18n", () => {
  it("maps backend validation error code", () => {
    i18n.global.locale.value = "en";

    const error = new AxiosError("Bad Request", undefined, undefined, undefined, {
      data: {
        error: "VALIDATION_ERROR",
        message: "invalid params"
      }
    } as any);

    expect(toErrorMessage(error)).toBe("Request validation failed.");
  });

  it("maps flood wait keyword and keeps seconds", () => {
    i18n.global.locale.value = "en";
    const message = toErrorMessage(new Error("FLOOD_WAIT_12"));
    expect(message).toContain("12");
  });

  it("falls back to original message for non-mapped errors", () => {
    i18n.global.locale.value = "en";
    expect(toErrorMessage(new Error("SOME_UNKNOWN_ERROR"))).toBe("SOME_UNKNOWN_ERROR");
  });
});
