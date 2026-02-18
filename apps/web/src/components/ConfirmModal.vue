<template>
  <v-dialog :model-value="open" max-width="480" @update:model-value="onDialogUpdate">
    <v-card>
      <v-card-title class="text-h6">{{ title }}</v-card-title>
      <v-card-text>
        <p class="mb-3">{{ summary }}</p>
        <v-alert type="warning" class="mb-4">{{ t("common.warningIrreversible") }}</v-alert>
        <p class="text-body-2 mb-2">{{ t("common.confirmInputHint", { text: confirmText }) }}</p>
        <v-text-field v-model="value" :placeholder="confirmText" data-test="confirm-input" />
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn data-test="confirm-cancel-btn" variant="text" :disabled="busy" @click="$emit('cancel')">{{ t("common.cancel") }}</v-btn>
        <v-btn data-test="confirm-submit-btn" color="error" :disabled="!canConfirm || busy" @click="$emit('confirm')">
          {{ busy ? t("common.executing") : t("common.confirmExecute") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

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

const { t } = useI18n();
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
