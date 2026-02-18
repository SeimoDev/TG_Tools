import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ConfirmModal from "../src/components/ConfirmModal.vue";
import { vuetify } from "./testUtils";

describe("ConfirmModal", () => {
  it("enables confirm button only when phrase matches", async () => {
    const wrapper = mount(ConfirmModal, {
      attachTo: document.body,
      props: {
        open: true,
        title: "danger",
        summary: "summary",
        confirmText: "CONFIRM"
      },
      global: {
        plugins: [vuetify]
      }
    });

    await nextTick();

    const input = document.body.querySelector('[data-test="confirm-input"] input') as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const findConfirmButton = () => {
      return Array.from(document.body.querySelectorAll("button")).find((button) => {
        return button.textContent?.includes("确认执行");
      }) as HTMLButtonElement | undefined;
    };

    const confirmButtonBefore = findConfirmButton();
    expect(confirmButtonBefore).toBeTruthy();
    expect(confirmButtonBefore?.disabled).toBe(true);

    input!.value = "CONFIRM";
    input!.dispatchEvent(new Event("input"));
    await nextTick();

    const confirmButtonAfter = findConfirmButton();
    expect(confirmButtonAfter).toBeTruthy();
    expect(confirmButtonAfter?.disabled).toBe(false);

    wrapper.unmount();
  });
});
