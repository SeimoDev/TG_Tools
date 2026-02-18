<template>
  <section class="card">
    <div class="card-head">
      <h2>{{ title }}</h2>
      <div class="tools">
        <input v-model="search" type="text" placeholder="搜索标题/用户名/ID" @keyup.enter="onSearch" />
        <button class="ghost" :disabled="busy" @click="onSearch">
          {{ busy ? "刷新中..." : "查询" }}
        </button>
      </div>
    </div>

    <div class="list-loading" v-if="busy">
      <span class="spinner" aria-hidden="true"></span>
      <span>列表刷新中...</span>
    </div>

    <p class="muted" v-if="selectedCount > 0">已选择 {{ selectedCount }} 项（跨页保留）</p>

    <EntityTable :items="items" :selected-ids="selectedIds" @update="onSelectionUpdate" />

    <div class="table-footer">
      <p>共 {{ total }} 条，当前第 {{ page }} 页，每页 {{ pageSize }} 条</p>
      <div class="tools">
        <label class="page-size-control">
          每页
          <select v-model.number="pageSize" :disabled="busy">
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
          条
        </label>
        <button class="ghost" :disabled="busy || page <= 1" @click="prevPage">上一页</button>
        <button class="ghost" :disabled="busy || page * pageSize >= total" @click="nextPage">下一页</button>
      </div>
    </div>

    <div class="actions">
      <button class="danger" :disabled="selectedCount === 0 || busy" @click="onPreview">
        {{ actionLabel }}（{{ selectedCount }}）
      </button>
      <RouterLink class="ghost link-btn" :to="`/jobs`">查看任务中心</RouterLink>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="previewWarnings.length > 0" class="muted">{{ previewWarnings.join("；") }}</p>
  </section>

  <ConfirmModal
    :open="confirmOpen"
    title="危险操作确认"
    :summary="`即将执行 ${actionLabel}，目标数量：${pendingCount}`"
    confirm-text="CONFIRM"
    :busy="busy"
    @cancel="confirmOpen = false"
    @confirm="onExecute"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import type { BatchAction, BatchPreviewResponse, EntityItem, EntityType } from "@tg-tools/shared";
import { createPreview, executeBatch, fetchEntities } from "../services/api";
import ConfirmModal from "../components/ConfirmModal.vue";
import EntityTable from "../components/EntityTable.vue";
import { toErrorMessage } from "../utils/error";

const props = defineProps<{
  type: EntityType;
  action: BatchAction;
  title: string;
  actionLabel: string;
}>();

const router = useRouter();

const items = ref<EntityItem[]>([]);
const selectedById = ref<Record<string, EntityItem>>({});
const search = ref("");
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const busy = ref(false);
const error = ref("");
const previewWarnings = ref<string[]>([]);

const confirmOpen = ref(false);
const pendingPreview = ref<BatchPreviewResponse | null>(null);

const selectedIds = computed(() => new Set(Object.keys(selectedById.value)));
const selectedItems = computed(() => Object.values(selectedById.value));
const selectedCount = computed(() => selectedItems.value.length);
const pendingCount = computed(() => pendingPreview.value?.total ?? 0);

const clearError = () => {
  error.value = "";
};

const load = async () => {
  clearError();
  busy.value = true;

  try {
    const data = await fetchEntities({
      type: props.type,
      page: page.value,
      pageSize: pageSize.value,
      search: search.value
    });

    items.value = data.items;
    total.value = data.total;

    const refreshedSelection = { ...selectedById.value };
    for (const item of data.items) {
      if (refreshedSelection[item.id]) {
        refreshedSelection[item.id] = item;
      }
    }
    selectedById.value = refreshedSelection;
  } catch (e) {
    error.value = toErrorMessage(e);
  } finally {
    busy.value = false;
  }
};

const onSearch = async () => {
  page.value = 1;
  await load();
};

const prevPage = async () => {
  if (page.value <= 1) {
    return;
  }

  page.value -= 1;
  await load();
};

const nextPage = async () => {
  if (page.value * pageSize.value >= total.value) {
    return;
  }

  page.value += 1;
  await load();
};

const onSelectionUpdate = (next: Set<string>) => {
  const updated: Record<string, EntityItem> = {};

  for (const id of next) {
    const currentPageItem = items.value.find((item) => item.id === id);
    if (currentPageItem) {
      updated[id] = currentPageItem;
      continue;
    }

    const cached = selectedById.value[id];
    if (cached) {
      updated[id] = cached;
    }
  }

  selectedById.value = updated;
};

const onPreview = async () => {
  clearError();
  busy.value = true;
  try {
    const preview = await createPreview({
      action: props.action,
      entities: selectedItems.value
    });

    pendingPreview.value = preview;
    previewWarnings.value = preview.warnings;
    confirmOpen.value = true;
  } catch (e) {
    error.value = toErrorMessage(e);
  } finally {
    busy.value = false;
  }
};

const onExecute = async () => {
  if (!pendingPreview.value) {
    return;
  }

  busy.value = true;
  clearError();

  try {
    const result = await executeBatch({
      action: props.action,
      previewToken: pendingPreview.value.previewToken
    });

    confirmOpen.value = false;
    pendingPreview.value = null;

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

watch(
  pageSize,
  async () => {
    page.value = 1;
    await load();
  }
);

watch(
  () => props.type,
  async () => {
    items.value = [];
    total.value = 0;
    page.value = 1;
    pageSize.value = 20;
    search.value = "";
    selectedById.value = {};
    previewWarnings.value = [];
    pendingPreview.value = null;
    confirmOpen.value = false;
    await load();
  }
);

onMounted(load);
</script>
