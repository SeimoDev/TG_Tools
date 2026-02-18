import { defineStore } from "pinia";

export type ThemeMode = "system" | "light" | "dark";

const THEME_KEY = "tg.ui.themeMode";

interface UiState {
  themeMode: ThemeMode;
}

export const useUiStore = defineStore("ui", {
  state: (): UiState => ({
    themeMode: "system"
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
    }
  }
});
