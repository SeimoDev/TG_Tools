import { vuetify } from "../src/plugins/vuetify";
import { i18n } from "../src/plugins/i18n";

if (!("visualViewport" in window)) {
  Object.defineProperty(window, "visualViewport", {
    writable: true,
    value: {
      width: 1024,
      height: 768,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }
  });
}

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })
  });
}

if (!("ResizeObserver" in window)) {
  class MockResizeObserver {
    observe() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: MockResizeObserver
  });
}

export { i18n };
export { vuetify };
