<template>
  <div v-if="open" class="modal-mask">
    <div class="modal-card">
      <h3>{{ title }}</h3>
      <p class="summary">{{ summary }}</p>
      <p class="hint">请输入 <strong>{{ confirmText }}</strong> 以确认执行</p>
      <input v-model="value" class="modal-input" :placeholder="confirmText" />
      <div class="actions">
        <button type="button" class="ghost" @click="$emit('cancel')" :disabled="busy">取消</button>
        <button type="button" class="danger" @click="$emit('confirm')" :disabled="!canConfirm || busy">
          {{ busy ? "执行中..." : "确认执行" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    summary: string;
    confirmText?: string;
    busy?: boolean;
  }>(),
  {
    confirmText: "CONFIRM",
    busy: false
  }
);

defineEmits<{
  confirm: [];
  cancel: [];
}>();

const value = ref("");

const canConfirm = computed(() => value.value.trim() === props.confirmText);

watch(
  () => props.open,
  (open) => {
    if (open) {
      value.value = "";
    }
  }
);
</script>
