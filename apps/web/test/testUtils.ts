import { createVuetify } from "vuetify";

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

export const vuetify = createVuetify();
