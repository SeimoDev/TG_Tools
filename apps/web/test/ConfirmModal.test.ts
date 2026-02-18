import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ConfirmModal from "../src/components/ConfirmModal.vue";
import { i18n, vuetify } from "./testUtils";

describe("ConfirmModal", () => {
  it("enables confirm button only when phrase matches", async () => {
    i18n.global.locale.value = "en";

    const wrapper = mount(ConfirmModal, {
      attachTo: document.body,
      props: {
        open: true,
        title: "danger",
        summary: "summary",
        confirmText: "CONFIRM"
      },
      global: {
        plugins: [i18n, vuetify]
      }
    });

    await nextTick();

    const input = document.body.querySelector('[data-test="confirm-input"] input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const confirmButtonBefore = document.body.querySelector('[data-test="confirm-submit-btn"]') as HTMLButtonElement | null;
    expect(confirmButtonBefore).toBeTruthy();
    expect(confirmButtonBefore?.disabled).toBe(true);

    input!.value = "CONFIRM";
    input!.dispatchEvent(new Event("input"));
    await nextTick();

    const confirmButtonAfter = document.body.querySelector('[data-test="confirm-submit-btn"]') as HTMLButtonElement | null;
    expect(confirmButtonAfter).toBeTruthy();
    expect(confirmButtonAfter?.disabled).toBe(false);

    wrapper.unmount();
  });
});
