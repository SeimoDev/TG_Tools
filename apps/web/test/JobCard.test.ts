import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import JobCard from "../src/components/JobCard.vue";
import { i18n, vuetify } from "./testUtils";

describe("JobCard", () => {
  it("renders job summary", () => {
    i18n.global.locale.value = "en";

    const wrapper = mount(JobCard, {
      props: {
        job: {
          jobId: "job-1",
          action: "DELETE_FRIENDS",
          status: "DONE",
          total: 10,
          successCount: 8,
          failedCount: 2,
          startedAt: "2026-01-01T00:00:00.000Z",
          finishedAt: "2026-01-01T00:01:00.000Z",
          results: []
        }
      },
      global: {
        plugins: [i18n, vuetify]
      }
    });

    expect(wrapper.text()).toContain("Delete Friends");
    expect(wrapper.text()).toContain("Success 8 / Failed 2 / Total 10");
  });
});
