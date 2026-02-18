<template>
  <table class="entity-table">
    <thead>
      <tr>
        <th>
          <input type="checkbox" :checked="allChecked" @change="toggleAll" />
        </th>
        <th>标题</th>
        <th>ID</th>
        <th>用户名</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in items" :key="item.id">
        <td>
          <input type="checkbox" :checked="selectedIds.has(item.id)" @change="toggleOne(item.id)" />
        </td>
        <td>{{ item.title }}</td>
        <td>{{ item.id }}</td>
        <td>{{ item.username || "-" }}</td>
        <td>{{ item.isDeleted ? "已注销" : "正常" }}</td>
      </tr>
      <tr v-if="items.length === 0">
        <td colspan="5" class="empty">暂无数据</td>
      </tr>
    </tbody>
  </table>
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

const toggleAll = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
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
