<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="onDialogUpdate">
    <v-card>
      <v-card-title class="text-h6">{{ title }}</v-card-title>
      <v-card-text>
        <p class="mb-3">{{ summary }}</p>
        <v-alert type="warning" class="mb-4">此操作不可恢复，请确认后继续。</v-alert>
        <p class="text-body-2 mb-2">请输入 <strong>{{ confirmText }}</strong> 以确认执行</p>
        <v-text-field v-model="value" :placeholder="confirmText" data-test="confirm-input" />
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn variant="text" :disabled="busy" @click="$emit('cancel')">取消</v-btn>
        <v-btn color="error" :disabled="!canConfirm || busy" @click="$emit('confirm')">
          {{ busy ? "执行中..." : "确认执行" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
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

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const value = ref("");

const canConfirm = computed(() => value.value.trim() === props.confirmText);

const onDialogUpdate = (next: boolean) => {
  if (!next) {
    emit("cancel");
  }
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      value.value = "";
    }
  }
);
</script>
