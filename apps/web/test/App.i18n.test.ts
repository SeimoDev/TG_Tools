import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import App from "../src/App.vue";
import { router } from "../src/router";
import { useAuthStore } from "../src/stores/auth";
import { useUiStore } from "../src/stores/ui";
import { i18n, vuetify } from "./testUtils";

describe("App i18n", () => {
  it("shows only login nav when unauthorized", async () => {
    localStorage.clear();
    i18n.global.locale.value = "en";

    await router.push("/login");
    await router.isReady();

    const pinia = createPinia();
    const auth = useAuthStore(pinia);
    auth.authorized = false;

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n, router, vuetify]
      }
    });

    expect(wrapper.text()).toContain(i18n.global.t("nav.login"));
    expect(wrapper.text()).not.toContain(i18n.global.t("nav.friends"));
  });

  it("updates navigation labels when locale changes", async () => {
    localStorage.clear();
    localStorage.setItem("tg.ui.locale", "en");
    i18n.global.locale.value = "en";

    await router.push("/login");
    await router.isReady();

    const pinia = createPinia();
    const auth = useAuthStore(pinia);
    auth.authorized = true;

    const wrapper = mount(App, {
      global: {
        plugins: [pinia, i18n, router, vuetify]
      }
    });

    expect(wrapper.text()).toContain(i18n.global.t("nav.friends"));

    const ui = useUiStore(pinia);
    ui.setLocale("ja");
    await nextTick();
    await nextTick();

    expect(wrapper.text()).toContain(i18n.global.t("nav.friends"));
  });
});
