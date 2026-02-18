<template>
  <div class="app-shell">
    <aside class="sidebar">
      <h1>TG Tools</h1>
      <p class="subtitle">Telegram 批量管理</p>
      <nav>
        <RouterLink to="/login">登录配置</RouterLink>
        <RouterLink to="/friends">好友</RouterLink>
        <RouterLink to="/groups">群组</RouterLink>
        <RouterLink to="/channels">频道</RouterLink>
        <RouterLink to="/cleanup-deleted">清理已注销</RouterLink>
        <RouterLink to="/jobs">任务中心</RouterLink>
      </nav>
      <div class="profile">
        <p>状态: {{ auth.authorized ? "已登录" : "未登录" }}</p>
        <p v-if="auth.me">账号: {{ auth.me.firstName || auth.me.username || auth.me.id }}</p>
      </div>
    </aside>

    <main class="content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();

onMounted(async () => {
  auth.loadConfig();
  try {
    await auth.fetchStatus();
  } catch {
    // ignore status failure before init
  }
});
</script>
