<template>
  <v-app>
    <v-app-bar color="surface" density="comfortable" elevation="1">
      <v-app-bar-nav-icon v-if="display.mdAndUp.value" @click="drawer = !drawer">
        <span class="material-symbols-rounded">menu</span>
      </v-app-bar-nav-icon>

      <v-toolbar-title class="text-subtitle-1 font-weight-medium">TG Tools</v-toolbar-title>

      <v-chip class="mr-2" :color="auth.authorized ? 'success' : 'warning'" size="small" label>
        {{ auth.authorized ? "已登录" : "未登录" }}
      </v-chip>

      <v-spacer />

      <v-menu>
        <template #activator="{ props }">
          <v-btn v-bind="props" variant="text" class="text-none">
            <span class="material-symbols-rounded nav-icon">palette</span>
            {{ themeModeLabel }}
          </v-btn>
        </template>

        <v-list density="compact">
          <v-list-subheader>主题模式</v-list-subheader>
          <v-list-item
            v-for="option in themeOptions"
            :key="option.value"
            :active="ui.themeMode === option.value"
            @click="ui.setThemeMode(option.value)"
          >
            <template #prepend>
              <span class="material-symbols-rounded nav-icon">{{ option.icon }}</span>
            </template>
            <v-list-item-title>{{ option.label }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

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
            <v-list-item-title>{{ auth.authorized ? "账号已连接" : "尚未登录" }}</v-list-item-title>
          </v-list-item>
          <v-list-item :disabled="!auth.authorized" @click="onLogout">
            <template #prepend>
              <span class="material-symbols-rounded nav-icon">logout</span>
            </template>
            <v-list-item-title>退出登录</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-app-bar>

    <v-navigation-drawer v-if="display.mdAndUp.value" v-model="drawer" width="272">
      <div class="pa-4">
        <div class="text-subtitle-1 font-weight-medium">TG Tools</div>
        <div class="text-caption text-medium-emphasis">Telegram 批量管理</div>
      </div>

      <v-divider />

      <v-list nav density="comfortable" class="py-2">
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :active="route.path === item.to"
          @click="onNavigate(item.to)"
        >
          <template #prepend>
            <span class="material-symbols-rounded nav-icon">{{ item.icon }}</span>
          </template>
          <v-list-item-title>{{ item.label }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid class="app-main-container">
        <div class="page-stack">
          <RouterView />
        </div>
      </v-container>
    </v-main>

    <v-bottom-navigation v-if="!display.mdAndUp.value" class="mobile-bottom-nav" grow>
      <v-btn
        v-for="item in navItems"
        :key="item.to"
        :active="route.path === item.to"
        @click="onNavigate(item.to)"
      >
        <span class="material-symbols-rounded">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { useDisplay, useTheme } from "vuetify";
import { useAuthStore } from "./stores/auth";
import { useUiStore, type ThemeMode } from "./stores/ui";

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { to: "/login", label: "登录", icon: "settings" },
  { to: "/friends", label: "好友", icon: "person" },
  { to: "/groups", label: "群组", icon: "groups" },
  { to: "/channels", label: "频道", icon: "campaign" },
  { to: "/bots", label: "Bot", icon: "smart_toy" },
  { to: "/non-friend-chats", label: "非好友私聊", icon: "chat" },
  { to: "/cleanup-deleted", label: "清理", icon: "auto_delete" },
  { to: "/cleanup-non-friends", label: "清私聊", icon: "delete_sweep" },
  { to: "/jobs", label: "任务", icon: "task_alt" }
];

const themeOptions: Array<{ value: ThemeMode; label: string; icon: string }> = [
  { value: "system", label: "跟随系统", icon: "brightness_auto" },
  { value: "light", label: "浅色", icon: "light_mode" },
  { value: "dark", label: "暗色", icon: "dark_mode" }
];

const drawer = ref(true);
const mediaQuery = ref<MediaQueryList | null>(null);

const route = useRoute();
const router = useRouter();
const display = useDisplay();
const theme = useTheme();

const auth = useAuthStore();
const ui = useUiStore();

const accountName = computed(() => {
  if (!auth.authorized) {
    return "访客";
  }

  return auth.me?.firstName || auth.me?.username || auth.me?.id || "账号";
});

const themeModeLabel = computed(() => {
  return themeOptions.find((option) => option.value === ui.themeMode)?.label ?? "主题";
});

const applyTheme = () => {
  const isSystemDark = mediaQuery.value?.matches ?? false;

  if (ui.themeMode === "light") {
    theme.global.name.value = "md2Light";
    return;
  }

  if (ui.themeMode === "dark") {
    theme.global.name.value = "md2Dark";
    return;
  }

  theme.global.name.value = isSystemDark ? "md2Dark" : "md2Light";
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

  mediaQuery.value = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.value.addEventListener("change", applyTheme);
  applyTheme();

  try {
    await auth.fetchStatus();
  } catch {
    // ignore status failure before init
  }
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
  () => display.mdAndUp.value,
  (isDesktop) => {
    if (isDesktop) {
      drawer.value = true;
    }
  }
);
</script>
