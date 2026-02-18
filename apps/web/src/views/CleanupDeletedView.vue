<template>
  <section class="card">
    <div class="card-head">
      <h2>批量清理已注销账号</h2>
      <button class="primary" :disabled="busy" @click="onPreview">
        {{ busy ? "加载中..." : "扫描已注销联系人" }}
      </button>
    </div>

    <p class="muted" v-if="preview">检测到 {{ preview.total }} 个已注销账号。</p>

    <EntityTable :items="preview?.items || []" :selected-ids="allSelected" @update="noop" />

    <div class="actions">
      <button class="danger" :disabled="!preview || preview.total === 0 || busy" @click="confirmOpen = true">
        一键清理已注销账号
      </button>
      <RouterLink class="ghost link-btn" to="/jobs">查看任务中心</RouterLink>
    </div>

    <p class="error" v-if="error">{{ error }}</p>
  </section>

  <ConfirmModal
    :open="confirmOpen"
    title="确认清理已注销账号"
    :summary="`将删除 ${preview?.total || 0} 个已注销联系人。`"
    confirm-text="CONFIRM"
    :busy="busy"
    @cancel="confirmOpen = false"
    @confirm="onExecute"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import type { BatchPreviewResponse } from "@tg-tools/shared";
import ConfirmModal from "../components/ConfirmModal.vue";
import EntityTable from "../components/EntityTable.vue";
import { executeDeletedContacts, previewDeletedContacts } from "../services/api";
import { toErrorMessage } from "../utils/error";

const router = useRouter();

const preview = ref<BatchPreviewResponse | null>(null);
const confirmOpen = ref(false);
const busy = ref(false);
const error = ref("");

const allSelected = computed(() => {
  return new Set((preview.value?.items || []).map((item) => item.id));
});

const noop = () => {
  // cleanup page always selects all deleted contacts
};

const onPreview = async () => {
  error.value = "";
  busy.value = true;
  try {
    preview.value = await previewDeletedContacts();
  } catch (e) {
    error.value = toErrorMessage(e);
  } finally {
    busy.value = false;
  }
};

const onExecute = async () => {
  if (!preview.value) {
    return;
  }

  error.value = "";
  busy.value = true;

  try {
    const result = await executeDeletedContacts(preview.value.previewToken);
    confirmOpen.value = false;

    await router.push({
      path: "/jobs",
      query: { jobId: result.jobId }
    });
  } catch (e) {
    error.value = toErrorMessage(e);
  } finally {
    busy.value = false;
  }
};
</script>
