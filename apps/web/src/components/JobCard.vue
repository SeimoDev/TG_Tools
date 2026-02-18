<template>
  <v-card>
    <v-card-title class="card-title-row">
      <span class="text-subtitle-1">{{ actionLabel }}</span>
      <v-chip :color="statusColor" label>{{ statusLabel }}</v-chip>
    </v-card-title>
    <v-card-text class="text-body-2">
      <p class="mb-1">{{ t("jobs.jobId") }}: <code>{{ job.jobId }}</code></p>
      <p class="mb-1">{{ t("jobs.summary", { success: job.successCount, failed: job.failedCount, total: job.total }) }}</p>
      <p class="mb-1">{{ t("jobs.startedAt", { time: format(job.startedAt) }) }}</p>
      <p class="mb-3" v-if="job.finishedAt">{{ t("jobs.finishedAt", { time: format(job.finishedAt) }) }}</p>
      <v-btn variant="outlined" size="small" @click="download">{{ t("jobs.exportJson") }}</v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { BatchJobResult } from "@tg-tools/shared";
import { formatDateTime } from "../utils/dateTime";

const props = defineProps<{
  job: BatchJobResult;
}>();

const { t, locale } = useI18n();

const withFallback = (key: string, fallback: string) => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const actionLabel = computed(() => withFallback(`jobs.actions.${props.job.action}`, props.job.action));
const statusLabel = computed(() => withFallback(`jobs.statuses.${props.job.status}`, props.job.status));

const statusColor = computed(() => {
  if (props.job.status === "DONE") {
    return "success";
  }

  if (props.job.status === "FAILED") {
    return "error";
  }

  if (props.job.status === "RUNNING") {
    return "warning";
  }

  return "info";
});

const format = (value: string) => formatDateTime(value, locale.value) ?? t("common.na");

const download = () => {
  const blob = new Blob([JSON.stringify(props.job, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `job-${props.job.jobId}.json`;
  a.click();
  URL.revokeObjectURL(href);
};
</script>
