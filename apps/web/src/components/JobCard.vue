<template>
  <div class="job-card">
    <div class="head">
      <h4>{{ job.action }}</h4>
      <span class="badge" :class="job.status.toLowerCase()">{{ job.status }}</span>
    </div>
    <p>ID: {{ job.jobId }}</p>
    <p>成功 {{ job.successCount }} / 失败 {{ job.failedCount }} / 总计 {{ job.total }}</p>
    <p>开始: {{ format(job.startedAt) }}</p>
    <p v-if="job.finishedAt">结束: {{ format(job.finishedAt) }}</p>
    <button type="button" class="ghost" @click="download">导出 JSON</button>
  </div>
</template>

<script setup lang="ts">
import type { BatchJobResult } from "@tg-tools/shared";

const props = defineProps<{
  job: BatchJobResult;
}>();

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
