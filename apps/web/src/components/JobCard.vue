<template>
  <v-card>
    <v-card-title class="card-title-row">
      <span class="text-subtitle-1">{{ job.action }}</span>
      <v-chip :color="statusColor" label>{{ job.status }}</v-chip>
    </v-card-title>
    <v-card-text class="text-body-2">
      <p class="mb-1">ID: <code>{{ job.jobId }}</code></p>
      <p class="mb-1">成功 {{ job.successCount }} / 失败 {{ job.failedCount }} / 总计 {{ job.total }}</p>
      <p class="mb-1">开始: {{ format(job.startedAt) }}</p>
      <p class="mb-3" v-if="job.finishedAt">结束: {{ format(job.finishedAt) }}</p>
      <v-btn variant="outlined" size="small" @click="download">导出 JSON</v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BatchJobResult } from "@tg-tools/shared";

const props = defineProps<{
  job: BatchJobResult;
}>();

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

const format = (value: string) => new Date(value).toLocaleString();

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
