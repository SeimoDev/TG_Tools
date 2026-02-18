import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { detectPreferredLocale, useUiStore } from "../src/stores/ui";

describe("ui locale", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("loads locale from localStorage", () => {
    localStorage.setItem("tg.ui.locale", "ja");
    const ui = useUiStore();
    ui.loadLocale();
    expect(ui.locale).toBe("ja");
  });

  it("normalizes browser locale when storage is empty", () => {
    const languageGetter = vi.spyOn(window.navigator, "language", "get").mockReturnValue("zh-HK");
    const languagesGetter = vi.spyOn(window.navigator, "languages", "get").mockReturnValue([]);

    expect(detectPreferredLocale()).toBe("zh-TW");

    languageGetter.mockRestore();
    languagesGetter.mockRestore();
  });

  it("persists locale when setLocale is called", () => {
    const ui = useUiStore();
    ui.setLocale("en");
    expect(localStorage.getItem("tg.ui.locale")).toBe("en");
  });
});
