<template>
  <v-card>
    <v-card-title class="card-title-row">
      <span class="text-h6">一键清理非好友私聊记录</span>
      <v-btn color="primary" :loading="busy" :disabled="busy" @click="onPreview">扫描非好友私聊</v-btn>
    </v-card-title>

    <v-card-text>
      <v-progress-linear v-if="busy" indeterminate color="primary" class="mb-4" />

      <v-alert v-if="preview" type="info" class="mb-4">检测到 {{ preview.total }} 个非好友私聊会话。</v-alert>

      <EntityTable :items="preview?.items || []" :selected-ids="allSelected" @update="noop" />

      <div class="d-flex flex-wrap justify-space-between align-center ga-2 mt-4">
        <v-btn color="error" :disabled="!preview || preview.total === 0 || busy" @click="confirmOpen = true">
          一键清理全部非好友私聊
        </v-btn>
        <v-btn variant="text" to="/jobs">查看任务中心</v-btn>
      </div>

      <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
    </v-card-text>
  </v-card>

  <ConfirmModal
    :open="confirmOpen"
    title="确认清理非好友私聊记录"
    :summary="`将清理 ${preview?.total || 0} 个非好友私聊会话的聊天记录。`"
    confirm-text="CONFIRM"
    :busy="busy"
    @cancel="confirmOpen = false"
    @confirm="onExecute"
  />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import type { BatchPreviewResponse } from "@tg-tools/shared";
import ConfirmModal from "../components/ConfirmModal.vue";
import EntityTable from "../components/EntityTable.vue";
import { executeNonFriendChats, previewNonFriendChats } from "../services/api";
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
  // one-click cleanup page always selects all scanned conversations
};

const onPreview = async () => {
  error.value = "";
  busy.value = true;
  try {
    preview.value = await previewNonFriendChats();
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
    const result = await executeNonFriendChats(preview.value.previewToken);
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
