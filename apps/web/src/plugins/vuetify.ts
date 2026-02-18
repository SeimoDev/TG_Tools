import "vuetify/styles";
import { createVuetify } from "vuetify";

const md2Light = {
  dark: false,
  colors: {
    background: "#f4f7fb",
    surface: "#ffffff",
    "surface-variant": "#eaf0f7",
    primary: "#1565c0",
    secondary: "#5e92f3",
    success: "#2e7d32",
    info: "#0277bd",
    warning: "#ef6c00",
    error: "#b00020"
  }
};

const md2Dark = {
  dark: true,
  colors: {
    background: "#111827",
    surface: "#1f2937",
    "surface-variant": "#2b394d",
    primary: "#90caf9",
    secondary: "#5e92f3",
    success: "#81c784",
    info: "#4fc3f7",
    warning: "#ffb74d",
    error: "#ef9a9a"
  }
};

export const vuetify = createVuetify({
  theme: {
    defaultTheme: "md2Light",
    themes: {
      md2Light,
      md2Dark
    }
  },
  defaults: {
    global: {
      ripple: true
    },
    VCard: {
      rounded: "lg",
      elevation: 2
    },
    VBtn: {
      rounded: "pill",
      style: "text-transform:none; letter-spacing:0.01em;"
    },
    VTextField: {
      variant: "outlined",
      density: "comfortable",
      hideDetails: "auto",
      color: "primary"
    },
    VSelect: {
      variant: "outlined",
      density: "comfortable",
      hideDetails: "auto",
      color: "primary"
    },
    VTextarea: {
      variant: "outlined",
      density: "comfortable",
      hideDetails: "auto",
      color: "primary"
    },
    VAlert: {
      variant: "tonal"
    },
    VChip: {
      size: "small"
    }
  }
});
