import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import JobCard from "../src/components/JobCard.vue";
import { vuetify } from "./testUtils";

describe("JobCard", () => {
  it("renders job summary", () => {
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
        plugins: [vuetify]
      }
    });

    expect(wrapper.text()).toContain("DELETE_FRIENDS");
    expect(wrapper.text()).toContain("成功 8 / 失败 2 / 总计 10");
  });
});
