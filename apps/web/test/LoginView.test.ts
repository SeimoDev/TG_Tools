import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import LoginView from "../src/views/LoginView.vue";
import { vuetify } from "./testUtils";

describe("LoginView", () => {
  it("disables init button until api config is valid", async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createPinia(), vuetify]
      }
    });

    const initButton = wrapper.get('[data-test="init-btn"]');
    expect(initButton.attributes("disabled")).toBeDefined();

    const apiIdInput = wrapper.get('[data-test="api-id"] input');
    const apiHashInput = wrapper.get('[data-test="api-hash"] input');

    await apiIdInput.setValue("123456");
    await apiHashInput.setValue("abcde12345");

    expect(initButton.attributes("disabled")).toBeUndefined();
  });
});
