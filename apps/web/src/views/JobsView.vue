<template>
  <v-card>
    <v-card-title class="card-title-row">
      <span class="text-h6">任务中心</span>
      <v-btn variant="tonal" color="primary" :loading="loading" @click="load">刷新</v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="error" type="error" class="mb-4">{{ error }}</v-alert>

      <v-row>
        <v-col v-for="job in jobs" :key="job.jobId" cols="12" md="6" xl="4">
          <JobCard :job="job" />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <v-card v-if="activeJob">
    <v-card-title class="text-h6">当前任务详情: {{ activeJob.jobId }}</v-card-title>
    <v-card-text>
      <v-chip :color="activeStatusColor" label class="mb-4">状态: {{ activeJob.status }}</v-chip>
      <div class="table-scroll">
        <v-table density="comfortable">
          <thead>
            <tr>
              <th class="text-left">标题</th>
              <th class="text-left">类型</th>
              <th class="text-left">结果</th>
              <th class="text-left">错误码</th>
              <th class="text-left">错误信息</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in activeJob.results" :key="`${item.id}-${item.ok}`">
              <td>{{ item.title }}</td>
              <td>{{ item.type }}</td>
              <td>
                <v-chip :color="item.ok ? 'success' : 'error'" size="small" label>
                  {{ item.ok ? "成功" : "失败" }}
                </v-chip>
              </td>
              <td>{{ item.errorCode || "-" }}</td>
              <td>{{ item.errorMessage || "-" }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import type { BatchJobResult } from "@tg-tools/shared";
import JobCard from "../components/JobCard.vue";
import { getJob, listJobs } from "../services/api";
import { toErrorMessage } from "../utils/error";

const route = useRoute();

const jobs = ref<BatchJobResult[]>([]);
const activeJob = ref<BatchJobResult | null>(null);
const error = ref("");
const loading = ref(false);

let timer: number | undefined;

const activeStatusColor = computed(() => {
  if (!activeJob.value) {
    return "info";
  }

  if (activeJob.value.status === "DONE") {
    return "success";
  }

  if (activeJob.value.status === "FAILED") {
    return "error";
  }

  if (activeJob.value.status === "RUNNING") {
    return "warning";
  }

  return "info";
});

const load = async () => {
  error.value = "";
  loading.value = true;

  try {
    const list = await listJobs();
    jobs.value = list.items;

    const jobId = typeof route.query.jobId === "string" ? route.query.jobId : "";
    if (jobId) {
      activeJob.value = await getJob(jobId);
    } else {
      activeJob.value = null;
    }
  } catch (e) {
    error.value = toErrorMessage(e);
  } finally {
    loading.value = false;
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
