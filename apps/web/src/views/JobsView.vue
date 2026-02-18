<template>
  <section class="card">
    <div class="card-head">
      <h2>任务中心</h2>
      <button class="ghost" @click="load">刷新</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="jobs-grid">
      <JobCard v-for="job in jobs" :key="job.jobId" :job="job" />
    </div>

    <div class="card" v-if="activeJob">
      <h3>当前任务详情: {{ activeJob.jobId }}</h3>
      <p>状态: {{ activeJob.status }}</p>
      <table class="entity-table">
        <thead>
          <tr>
            <th>标题</th>
            <th>类型</th>
            <th>结果</th>
            <th>错误码</th>
            <th>错误信息</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in activeJob.results" :key="`${item.id}-${item.ok}`">
            <td>{{ item.title }}</td>
            <td>{{ item.type }}</td>
            <td>{{ item.ok ? "成功" : "失败" }}</td>
            <td>{{ item.errorCode || "-" }}</td>
            <td>{{ item.errorMessage || "-" }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { BatchJobResult } from "@tg-tools/shared";
import JobCard from "../components/JobCard.vue";
import { getJob, listJobs } from "../services/api";
import { toErrorMessage } from "../utils/error";

const route = useRoute();

const jobs = ref<BatchJobResult[]>([]);
const activeJob = ref<BatchJobResult | null>(null);
const error = ref("");

let timer: number | undefined;

const load = async () => {
  error.value = "";
  try {
    const list = await listJobs();
    jobs.value = list.items;

    const jobId = typeof route.query.jobId === "string" ? route.query.jobId : "";
    if (jobId) {
      activeJob.value = await getJob(jobId);
    }
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

onMounted(async () => {
  await load();
  timer = window.setInterval(() => {
    void load();
  }, 3000);
});

onUnmounted(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>
