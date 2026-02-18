import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import ConfirmModal from "../src/components/ConfirmModal.vue";

describe("ConfirmModal", () => {
  it("enables confirm button only when phrase matches", async () => {
    const wrapper = mount(ConfirmModal, {
      props: {
        open: true,
        title: "danger",
        summary: "summary",
        confirmText: "CONFIRM"
      }
    });

    const buttons = wrapper.findAll("button");
    const confirmButton = buttons[1];
    expect(confirmButton.attributes("disabled")).toBeDefined();

    await wrapper.find("input").setValue("CONFIRM");
    expect(confirmButton.attributes("disabled")).toBeUndefined();
  });
});
