<template>
  <v-app>
    <v-app-bar color="surface" density="comfortable" elevation="1">
      <v-app-bar-nav-icon v-if="display.mdAndUp.value" @click="drawer = !drawer">
        <span class="material-symbols-rounded">menu</span>
      </v-app-bar-nav-icon>

      <v-toolbar-title class="text-subtitle-1 font-weight-medium">{{ t("nav.title") }}</v-toolbar-title>

      <v-chip class="mr-2" :color="auth.authorized ? 'success' : 'warning'" size="small" label>
        {{ auth.authorized ? t("common.loggedIn") : t("common.notLoggedIn") }}
      </v-chip>

      <v-spacer />

      <v-btn
        href="https://github.com/SeimoDev/TG_Tools"
        target="_blank"
        rel="noopener noreferrer"
        variant="text"
        class="text-none mr-2"
      >
        <svg class="github-logo mr-1" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.33c-2.24.49-2.71-1.08-2.71-1.08-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.81.06 1.24.83 1.24.83.72 1.24 1.89.88 2.35.67.07-.52.28-.88.5-1.08-1.79-.2-3.68-.9-3.68-3.98 0-.88.31-1.6.82-2.17-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.83a7.62 7.62 0 0 1 4 0c1.53-1.05 2.2-.83 2.2-.83.44 1.1.16 1.92.08 2.12.51.57.82 1.29.82 2.17 0 3.09-1.89 3.77-3.69 3.98.29.25.55.73.55 1.47l-.01 2.18c0 .21.14.46.55.38A8 8 0 0 0 8 0Z"
            fill="currentColor"
          />
        </svg>
        GitHub
      </v-btn>

      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none">
            <span class="material-symbols-rounded nav-icon">palette</span>
            {{ themeModeLabel }}
          </v-btn>
        </template>

        <v-list density="compact">
          <v-list-subheader>{{ t("theme.title") }}</v-list-subheader>
          <v-list-item
            v-for="option in themeOptions"
            :key="option.value"
            :active="ui.themeMode === option.value"
            @click="ui.setThemeMode(option.value)"
          >
            <template #prepend>
              <span class="material-symbols-rounded nav-icon">{{ option.icon }}</span>
            </template>
            <v-list-item-title>{{ t(option.labelKey) }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-select
        v-if="!display.mdAndUp.value"
        v-model="selectedLocale"
        :items="localeSelectItems"
        item-title="label"
        item-value="value"
        :label="t('locale.title')"
        density="compact"
        variant="outlined"
        hide-details
        class="locale-select mr-2"
      />

      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none">
            <span class="material-symbols-rounded nav-icon">account_circle</span>
            {{ accountName }}
          </v-btn>
        </template>

        <v-list density="compact">
          <v-list-item>
            <template #prepend>
              <span class="material-symbols-rounded nav-icon">badge</span>
            </template>
            <v-list-item-title>{{ auth.authorized ? t("auth.accountConnected") : t("auth.accountDisconnected") }}</v-list-item-title>
          </v-list-item>
          <v-list-item :disabled="!auth.authorized" @click="onLogout">
            <template #prepend>
              <span class="material-symbols-rounded nav-icon">logout</span>
            </template>
            <v-list-item-title>{{ t("common.logout") }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer v-if="display.mdAndUp.value" v-model="drawer" width="272">
      <div class="pa-4">
        <div class="text-subtitle-1 font-weight-medium">{{ t("nav.title") }}</div>
        <div class="text-caption text-medium-emphasis">{{ t("nav.subtitle") }}</div>
      </div>

      <v-divider />

      <v-list nav density="comfortable" class="py-2">
        <v-list-item
          v-for="item in visibleNavItems"
          :key="item.to"
          :active="route.path === item.to"
          @click="onNavigate(item.to)"
        >
          <template #prepend>
            <span class="material-symbols-rounded nav-icon">{{ item.icon }}</span>
          </template>
          <v-list-item-title>{{ t(item.labelKey) }}</v-list-item-title>
        </v-list-item>
      </v-list>

      <v-divider />

      <div class="drawer-locale">
        <v-select
          v-model="selectedLocale"
          :items="localeSelectItems"
          item-title="label"
          item-value="value"
          :label="t('locale.title')"
          density="compact"
          variant="outlined"
          hide-details
        />
      </div>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="app-main-container">
        <div class="page-stack">
          <RouterView />
        </div>
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="!display.mdAndUp.value" class="mobile-bottom-nav">
      <v-btn
        v-for="item in visibleNavItems"
        :key="item.to"
        :active="route.path === item.to"
        @click="onNavigate(item.to)"
      >
        <span class="material-symbols-rounded">{{ item.icon }}</span>
        <span>{{ t(item.labelKey) }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { RouterView, useRoute, useRouter } from "vue-router";
import { useDisplay, useTheme } from "vuetify";
import { useAuthStore } from "./stores/auth";
import { useUiStore, type LocaleCode, type ThemeMode } from "./stores/ui";

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: "/login", labelKey: "nav.login", icon: "settings" },
  { to: "/friends", labelKey: "nav.friends", icon: "person" },
  { to: "/groups", labelKey: "nav.groups", icon: "groups" },
  { to: "/channels", labelKey: "nav.channels", icon: "campaign" },
  { to: "/bots", labelKey: "nav.bots", icon: "smart_toy" },
  { to: "/non-friend-chats", labelKey: "nav.nonFriendChats", icon: "chat" },
  { to: "/cleanup-deleted", labelKey: "nav.cleanupDeleted", icon: "auto_delete" },
  { to: "/jobs", labelKey: "nav.jobs", icon: "task_alt" }
];

const themeOptions: Array<{ value: ThemeMode; labelKey: string; icon: string }> = [
  { value: "system", labelKey: "theme.system", icon: "brightness_auto" },
  { value: "light", labelKey: "theme.light", icon: "light_mode" },
  { value: "dark", labelKey: "theme.dark", icon: "dark_mode" }
];

const localeOptions: Array<{ value: LocaleCode; labelKey: string }> = [
  { value: "zh-CN", labelKey: "locale.zhCN" },
  { value: "zh-TW", labelKey: "locale.zhTW" },
  { value: "ja", labelKey: "locale.ja" },
  { value: "en", labelKey: "locale.en" }
];

const drawer = ref(true);
const mediaQuery = ref<MediaQueryList | null>(null);

const route = useRoute();
const router = useRouter();
const display = useDisplay();
const theme = useTheme();
const { t, locale } = useI18n();

const auth = useAuthStore();
const ui = useUiStore();

const visibleNavItems = computed(() => {
  if (auth.authorized) {
    return navItems;
  }

  return navItems.filter((item) => item.to === "/login");
});

const accountName = computed(() => {
  if (!auth.authorized) {
    return t("common.guest");
  }

  return auth.me?.firstName || auth.me?.username || auth.me?.id || t("common.account");
});

const themeModeLabel = computed(() => {
  const option = themeOptions.find((item) => item.value === ui.themeMode);
  return option ? t(option.labelKey) : t("theme.title");
});

const localeSelectItems = computed(() => {
  return localeOptions.map((option) => ({
    value: option.value,
    label: t(option.labelKey)
  }));
});

const selectedLocale = computed<LocaleCode>({
  get: () => ui.locale,
  set: (next) => {
    ui.setLocale(next);
  }
});

const applyThemeName = (name: "md2Light" | "md2Dark") => {
  if (typeof theme.change === "function") {
    theme.change(name);
    return;
  }

  theme.global.name.value = name;
};

const applyTheme = () => {
  const isSystemDark = mediaQuery.value?.matches ?? false;

  if (ui.themeMode === "light") {
    applyThemeName("md2Light");
    return;
  }

  if (ui.themeMode === "dark") {
    applyThemeName("md2Dark");
    return;
  }

  applyThemeName(isSystemDark ? "md2Dark" : "md2Light");
};

const applyLocale = () => {
  locale.value = ui.locale;
};

const onNavigate = async (to: string) => {
  if (route.path !== to) {
    await router.push(to);
  }
};

const onLogout = async () => {
  await auth.doLogout();
  if (route.path !== "/login") {
    await router.push("/login");
  }
};

onMounted(async () => {
  auth.loadConfig();
  ui.loadThemeMode();
  ui.loadLocale();
  applyLocale();

  mediaQuery.value = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.value.addEventListener("change", applyTheme);
  applyTheme();

  await auth.autoInitIfConfigured();
});

onUnmounted(() => {
  mediaQuery.value?.removeEventListener("change", applyTheme);
});

watch(
  () => ui.themeMode,
  () => {
    applyTheme();
  }
);

watch(
  () => ui.locale,
  () => {
    applyLocale();
  }
);

watch(
  () => display.mdAndUp.value,
  (isDesktop) => {
    if (isDesktop) {
      drawer.value = true;
    }
  }
);
</script>

<style scoped>
.locale-select {
  width: 136px;
}

.drawer-locale {
  padding: 12px 16px 16px;
}

.mobile-bottom-nav {
  overflow-x: auto;
  overflow-y: hidden;
  justify-content: flex-start;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
}

.mobile-bottom-nav :deep(.v-btn) {
  flex: 0 0 auto;
  min-width: 96px;
  scroll-snap-align: start;
}

.github-logo {
  width: 18px;
  height: 18px;
  display: inline-block;
}
</style>
