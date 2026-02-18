<template>
  <div class="table-scroll">
    <v-table density="comfortable">
      <thead>
        <tr>
          <th class="text-left" style="width: 44px">
            <v-checkbox-btn :model-value="allChecked" @update:model-value="toggleAll" />
          </th>
          <th class="text-left">标题</th>
          <th class="text-left">ID</th>
          <th class="text-left">用户名</th>
          <th class="text-left">最后使用时间</th>
          <th class="text-left">状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in items" :key="item.id">
          <td>
            <v-checkbox-btn :model-value="selectedIds.has(item.id)" @update:model-value="toggleOne(item.id)" />
          </td>
          <td>{{ item.title }}</td>
          <td><code>{{ item.id }}</code></td>
          <td>{{ item.username || "-" }}</td>
          <td>{{ formatLastUsed(item.lastUsedAt) }}</td>
          <td>
            <v-chip :color="statusColor(item)" size="small" label>
              {{ statusText(item) }}
            </v-chip>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="6" class="text-center text-medium-emphasis py-6">暂无数据</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { EntityItem } from "@tg-tools/shared";

const props = defineProps<{
  items: EntityItem[];
  selectedIds: Set<string>;
}>();

const emit = defineEmits<{
  update: [Set<string>];
}>();

const allChecked = computed(() => props.items.length > 0 && props.items.every((item) => props.selectedIds.has(item.id)));

const statusText = (item: EntityItem) => {
  if (item.type === "bot_chat") {
    return "Bot";
  }

  if (item.type === "non_friend_chat") {
    return "非好友";
  }

  return item.isDeleted ? "已注销" : "正常";
};

const statusColor = (item: EntityItem) => {
  if (item.type === "bot_chat") {
    return "info";
  }

  if (item.type === "non_friend_chat") {
    return "warning";
  }

  return item.isDeleted ? "warning" : "success";
};

const formatLastUsed = (lastUsedAt?: string) => {
  if (!lastUsedAt) {
    return "-";
  }

  const timestamp = Date.parse(lastUsedAt);
  if (Number.isNaN(timestamp)) {
    return "-";
  }

  return new Date(timestamp).toLocaleString();
};

const toggleAll = (checked: boolean) => {
  const next = new Set(props.selectedIds);

  for (const item of props.items) {
    if (checked) {
      next.add(item.id);
    } else {
      next.delete(item.id);
    }
  }

  emit("update", next);
};

const toggleOne = (id: string) => {
  const next = new Set(props.selectedIds);

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }

  emit("update", next);
};
</script>
