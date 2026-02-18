<template>
  <v-card>
    <v-card-title class="card-title-row flex-wrap">
      <span class="text-h6">{{ title }}</span>
      <div class="d-flex flex-wrap align-center ga-2" style="margin-left: auto">
        <v-select
          v-if="supportsLastUsedSort"
          v-model="sortBy"
          :items="sortByOptions"
          item-title="label"
          item-value="value"
          label="排序字段"
          density="compact"
          style="min-width: 150px"
        />
        <v-select
          v-if="supportsLastUsedSort"
          v-model="sortOrder"
          :items="sortOrderOptions"
          item-title="label"
          item-value="value"
          label="排序方向"
          density="compact"
          style="min-width: 130px"
        />
        <v-text-field
          v-model="search"
          label="搜索标题/用户名/ID"
          density="compact"
          style="min-width: 240px"
          @keyup.enter="onSearch"
        />
        <v-btn color="primary" variant="tonal" :loading="busy" :disabled="busy" @click="onSearch">查询</v-btn>
      </div>
    </v-card-title>

    <v-card-text>
      <v-progress-linear v-if="busy" indeterminate color="primary" class="mb-4" />

      <v-alert v-if="selectedCount > 0" type="info" class="mb-4">已选择 {{ selectedCount }} 项（跨页保留）</v-alert>

      <EntityTable :items="items" :selected-ids="selectedIds" @update="onSelectionUpdate" />

      <div class="d-flex flex-wrap justify-space-between align-center ga-3 mt-4">
        <p class="text-body-2 text-medium-emphasis mb-0">共 {{ total }} 条，当前第 {{ page }} 页，每页 {{ pageSize }} 条</p>

        <div class="d-flex flex-wrap align-center ga-2">
          <v-select v-model="pageSize" :items="pageSizeOptions" label="每页" style="max-width: 120px" />
          <v-btn variant="outlined" :disabled="busy || page <= 1" @click="prevPage">上一页</v-btn>
          <v-btn variant="outlined" :disabled="busy || page * pageSize >= total" @click="nextPage">下一页</v-btn>
        </div>
      </div>

      <div class="d-flex flex-wrap justify-space-between align-center ga-2 mt-4">
        <v-btn color="error" :disabled="selectedCount === 0 || busy" @click="onPreview">
          {{ actionLabel }}（{{ selectedCount }}）
        </v-btn>

        <v-btn variant="text" :to="`/jobs`">查看任务中心</v-btn>
      </div>

      <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
      <v-alert v-if="previewWarnings.length > 0" type="warning" class="mt-4">{{ previewWarnings.join("；") }}</v-alert>
    </v-card-text>
  </v-card>

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
import { useRouter } from "vue-router";
import type { BatchAction, BatchPreviewResponse, EntityItem, EntitySortBy, EntityType, SortOrder } from "@tg-tools/shared";
import { createPreview, executeBatch, fetchEntities } from "../services/api";
import ConfirmModal from "../components/ConfirmModal.vue";
import EntityTable from "../components/EntityTable.vue";
import { toErrorMessage } from "../utils/error";

const props = defineProps<{
  type: EntityType;
  action: BatchAction;
  title: string;
  actionLabel: string;
  supportsLastUsedSort?: boolean;
  defaultSortBy?: EntitySortBy;
  defaultSortOrder?: SortOrder;
}>();

const router = useRouter();

const items = ref<EntityItem[]>([]);
const selectedById = ref<Record<string, EntityItem>>({});
const search = ref("");
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const pageSizeOptions = [20, 50, 100];
const sortByOptions = [
  { label: "名称", value: "title" },
  { label: "最后使用时间", value: "last_used_at" }
] as const;
const sortOrderOptions = [
  { label: "降序", value: "desc" },
  { label: "升序", value: "asc" }
] as const;
const busy = ref(false);
const error = ref("");
const previewWarnings = ref<string[]>([]);

const confirmOpen = ref(false);
const pendingPreview = ref<BatchPreviewResponse | null>(null);

const supportsLastUsedSort = computed(() => Boolean(props.supportsLastUsedSort));

const resolveSortBy = (): EntitySortBy => props.defaultSortBy ?? (supportsLastUsedSort.value ? "last_used_at" : "title");
const resolveSortOrder = (): SortOrder => props.defaultSortOrder ?? (supportsLastUsedSort.value ? "desc" : "asc");

const sortBy = ref<EntitySortBy>(resolveSortBy());
const sortOrder = ref<SortOrder>(resolveSortOrder());

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
      search: search.value,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value
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

watch(pageSize, async () => {
  page.value = 1;
  await load();
});

watch([sortBy, sortOrder], async () => {
  page.value = 1;
  await load();
});

watch(
  () => props.type,
  async () => {
    items.value = [];
    total.value = 0;
    page.value = 1;
    pageSize.value = 20;
    sortBy.value = resolveSortBy();
    sortOrder.value = resolveSortOrder();
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
