import { defineStore } from "pinia";

export type ThemeMode = "system" | "light" | "dark";
export type LocaleCode = "zh-CN" | "zh-TW" | "ja" | "en";

const THEME_KEY = "tg.ui.themeMode";
const LOCALE_KEY = "tg.ui.locale";

interface UiState {
  themeMode: ThemeMode;
  locale: LocaleCode;
}

const isBrowser = () => typeof window !== "undefined";

const normalizeLocale = (value?: string | null): LocaleCode => {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "en";
  }

  if (normalized.startsWith("zh-hant") || normalized.startsWith("zh-tw") || normalized.startsWith("zh-hk")) {
    return "zh-TW";
  }

  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }

  if (normalized.startsWith("ja")) {
    return "ja";
  }

  return "en";
};

export const detectPreferredLocale = (): LocaleCode => {
  if (!isBrowser()) {
    return "en";
  }

  const stored = localStorage.getItem(LOCALE_KEY);
  if (stored === "zh-CN" || stored === "zh-TW" || stored === "ja" || stored === "en") {
    return stored;
  }

  const browserLocale = navigator.languages?.[0] || navigator.language;
  return normalizeLocale(browserLocale);
};

export const useUiStore = defineStore("ui", {
  state: (): UiState => ({
    themeMode: "system",
    locale: detectPreferredLocale()
  }),
  actions: {
    loadThemeMode() {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "system" || stored === "light" || stored === "dark") {
        this.themeMode = stored;
      }
    },
    setThemeMode(mode: ThemeMode) {
      this.themeMode = mode;
      localStorage.setItem(THEME_KEY, mode);
    },
    loadLocale() {
      this.locale = detectPreferredLocale();
    },
    setLocale(locale: LocaleCode) {
      this.locale = locale;
      localStorage.setItem(LOCALE_KEY, locale);
    }
  }
});
