import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import LoginView from "../src/views/LoginView.vue";

describe("LoginView", () => {
  it("disables init button until api config is valid", async () => {
    const wrapper = mount(LoginView, {
      global: {
        plugins: [createPinia()]
      }
    });

    const initButton = wrapper.findAll("button.primary")[0];
    expect(initButton.attributes("disabled")).toBeDefined();

    const inputs = wrapper.findAll("input");
    await inputs[0].setValue("123456");
    await inputs[1].setValue("abcde12345");

    expect(initButton.attributes("disabled")).toBeUndefined();
  });
});
