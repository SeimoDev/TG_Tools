import { createPinia } from "pinia";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { DashboardResponse } from "@tg-tools/shared";
import LoginView from "../src/views/LoginView.vue";
import { useAuthStore } from "../src/stores/auth";
import { i18n, vuetify } from "./testUtils";

const createDashboard = (): DashboardResponse => ({
  authorized: true,
  profile: {
    id: "100",
    displayName: "Alice",
    username: "alice",
    phone: "123456"
  },
  stats: {
    entities: {
      friendsTotal: 12,
      deletedContactsTotal: 2,
      groupsTotal: 3,
      channelsTotal: 4,
      botChatsTotal: 5,
      nonFriendChatsTotal: 6,
      dialogsTotal: 30
    },
    jobs: {
      recentJobsTotal: 7,
      runningJobs: 1,
      doneJobs: 5,
      failedJobs: 1,
      successItemsTotal: 20,
      failedItemsTotal: 4
    },
    previews: {
      activePreviewTokens: 2,
      activePreviewTargets: 8
    }
  },
  system: {
    usingSecureStorage: true,
    proxyEnabled: true,
    proxyHost: "127.0.0.1",
    proxyPort: 7890,
    clientReady: true,
    fetchedAt: new Date().toISOString()
  }
});

describe("LoginView dashboard", () => {
  it("renders dashboard profile and stats when authorized", () => {
    i18n.global.locale.value = "en";

    const pinia = createPinia();
    const auth = useAuthStore(pinia);
    auth.authorized = true;
    auth.dashboard = createDashboard();

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia, i18n, vuetify],
        stubs: {
          RouterLink: true
        }
      }
    });

    expect(wrapper.text()).toContain("Account Dashboard");
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).toContain("Friends");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("Proxy");
  });

  it("refreshes dashboard with force=true", async () => {
    i18n.global.locale.value = "en";

    const pinia = createPinia();
    const auth = useAuthStore(pinia);
    auth.authorized = true;
    auth.dashboard = createDashboard();

    const spy = vi.spyOn(auth, "loadDashboard").mockResolvedValue(createDashboard());

    const wrapper = mount(LoginView, {
      global: {
        plugins: [pinia, i18n, vuetify],
        stubs: {
          RouterLink: true
        }
      }
    });

    await wrapper.get('[data-test="dashboard-refresh-btn"]').trigger("click");

    expect(spy).toHaveBeenCalledWith(true);
  });
});
