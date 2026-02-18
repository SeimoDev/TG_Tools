<template>
  <v-row v-if="auth.authorized">
    <v-col cols="12" lg="9">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
          <span class="text-h6">{{ t("auth.dashboardTitle") }}</span>
          <v-btn
            data-test="dashboard-refresh-btn"
            variant="tonal"
            color="primary"
            :loading="dashboardRefreshing"
            :disabled="dashboardRefreshing"
            @click="onRefreshDashboard"
          >
            {{ t("auth.refreshDashboard") }}
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-skeleton-loader v-if="auth.dashboardLoading && !auth.dashboard" type="image, article, article, article" />

          <template v-else>
            <div class="profile-header mb-4">
              <v-avatar size="72" color="primary" variant="tonal">
                <v-img v-if="profileAvatar" :src="profileAvatar" :alt="t('auth.avatarAlt')" />
                <span v-else class="avatar-fallback">{{ avatarFallback }}</span>
              </v-avatar>

              <div class="profile-meta">
                <p class="profile-name">{{ profileDisplayName }}</p>
                <p class="profile-sub">@{{ profileUsername || t("common.na") }}</p>
                <p class="profile-sub">{{ t("auth.profileId") }}: <code>{{ profileId }}</code></p>
                <p class="profile-sub">{{ t("auth.profilePhone") }}: {{ profilePhone }}</p>
              </div>
            </div>

            <v-row>
              <v-col cols="12">
                <h3 class="section-title">{{ t("auth.sectionEntities") }}</h3>
              </v-col>
              <v-col v-for="item in entityCards" :key="item.label" cols="6" sm="4" lg="3">
                <div class="stat-card">
                  <p class="stat-label">{{ item.label }}</p>
                  <p class="stat-value">{{ item.value }}</p>
                </div>
              </v-col>
            </v-row>

            <v-row class="mt-1">
              <v-col cols="12">
                <h3 class="section-title">{{ t("auth.sectionJobs") }}</h3>
              </v-col>
              <v-col v-for="item in jobCards" :key="item.label" cols="6" sm="4" lg="3">
                <div class="stat-card">
                  <p class="stat-label">{{ item.label }}</p>
                  <p class="stat-value">{{ item.value }}</p>
                </div>
              </v-col>
            </v-row>

            <v-row class="mt-1">
              <v-col cols="12">
                <h3 class="section-title">{{ t("auth.sectionPreviews") }}</h3>
              </v-col>
              <v-col v-for="item in previewCards" :key="item.label" cols="6" sm="4" lg="3">
                <div class="stat-card">
                  <p class="stat-label">{{ item.label }}</p>
                  <p class="stat-value">{{ item.value }}</p>
                </div>
              </v-col>
            </v-row>

            <v-row class="mt-1">
              <v-col cols="12">
                <h3 class="section-title">{{ t("auth.sectionSystem") }}</h3>
              </v-col>
              <v-col cols="12" md="6">
                <div class="dashboard-item">
                  <p class="dashboard-label">{{ t("auth.storageLabel") }}</p>
                  <p class="dashboard-value">{{ dashboardSystem?.usingSecureStorage ? t("auth.storageSecure") : t("auth.storageFile") }}</p>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="dashboard-item">
                  <p class="dashboard-label">{{ t("auth.proxyLabel") }}</p>
                  <p class="dashboard-value">{{ proxyDisplay }}</p>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="dashboard-item">
                  <p class="dashboard-label">{{ t("auth.clientLabel") }}</p>
                  <p class="dashboard-value">{{ dashboardSystem?.clientReady ? t("auth.clientReady") : t("auth.clientPending") }}</p>
                </div>
              </v-col>
              <v-col cols="12" md="6">
                <div class="dashboard-item">
                  <p class="dashboard-label">{{ t("auth.fetchedAtLabel") }}</p>
                  <p class="dashboard-value">{{ fetchedAtText }}</p>
                </div>
              </v-col>
            </v-row>

            <div class="dashboard-actions mt-4">
              <v-btn color="primary" to="/friends">{{ t("common.enterManagement") }}</v-btn>
              <v-btn variant="outlined" to="/jobs">{{ t("common.viewJobs") }}</v-btn>
            </div>
          </template>

          <v-alert v-if="auth.warning" type="warning" class="mt-4">{{ auth.warning }}</v-alert>
          <v-alert v-if="auth.dashboardError" type="error" class="mt-4">{{ auth.dashboardError }}</v-alert>
          <v-alert v-if="error" type="error" class="mt-4">{{ error }}</v-alert>
          <v-alert v-if="message" type="info" class="mt-4">{{ message }}</v-alert>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" lg="3">
      <v-card>
        <v-card-title class="text-h6">{{ t("auth.sessionActions") }}</v-card-title>
        <v-card-text>
          <v-btn color="error" block :loading="actionLoading" @click="onLogout">{{ t("common.logout") }}</v-btn>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>

  <v-row v-else>
    <v-col cols="12" md="6">
      <v-card>
        <v-card-title class="text-h6">{{ t("auth.apiConfigTitle") }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            {{ t("auth.apiConfigHint") }}
          </p>

          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="auth.config.apiId"
                type="number"
                min="1"
                :label="t('auth.apiIdLabel')"
                placeholder="123456"
                data-test="api-id"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="auth.config.apiHash"
                :label="t('auth.apiHashLabel')"
                placeholder="your_api_hash"
                data-test="api-hash"
              />
            </v-col>
          </v-row>

          <v-divider class="my-2" />

          <v-switch v-model="auth.config.proxy.enabled" :label="t('auth.proxyEnabled')" color="primary" />

          <v-row v-if="auth.config.proxy.enabled">
            <v-col cols="12" sm="6">
              <v-text-field v-model="auth.config.proxy.host" :label="t('auth.proxyHostLabel')" placeholder="127.0.0.1" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="auth.config.proxy.port" type="number" min="1" :label="t('auth.proxyPortLabel')" placeholder="1080" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="auth.config.proxy.username" :label="t('auth.proxyUsernameLabel')" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="auth.config.proxy.password" type="password" :label="t('auth.proxyPasswordLabel')" />
            </v-col>
          </v-row>

          <v-btn
            color="primary"
            block
            class="auth-action-btn mt-4"
            :loading="auth.loading"
            :disabled="!configValid || auth.loading"
            @click="onInit"
            data-test="init-btn"
          >
            {{ t("auth.verifyConnectivity") }}
          </v-btn>

          <v-alert v-if="auth.clientReady" type="success" class="mt-4">{{ t("auth.connectivityReady") }}</v-alert>
          <v-alert v-else-if="auth.autoInitError" type="error" class="mt-4">{{ auth.autoInitError }}</v-alert>
          <v-alert v-if="auth.warning" type="warning" class="mt-4">{{ auth.warning }}</v-alert>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card>
        <v-card-title class="text-h6">{{ t("auth.loginFlowTitle") }}</v-card-title>
        <v-card-text>
          <v-alert v-if="!canStartLogin" type="info" class="mb-3">{{ t("auth.loginBlockedHint") }}</v-alert>

          <v-text-field v-model="phone" :label="t('auth.phoneLabel')" placeholder="+8613800000000" :disabled="!canStartLogin || actionLoading" />

          <div class="login-action-row mt-3 mb-3">
            <v-btn
              color="primary"
              class="login-action-btn auth-action-btn"
              block
              size="large"
              :loading="actionLoading"
              :disabled="!canStartLogin || !phone || actionLoading"
              @click="onSendCode"
            >
              {{ t("auth.sendCode") }}
            </v-btn>
            <v-btn
              variant="outlined"
              class="login-action-btn auth-action-btn"
              block
              size="large"
              :loading="pollingQr"
              :disabled="!canStartLogin || actionLoading"
              @click="onStartQrLogin"
            >
              {{ t("auth.qrLogin") }}
            </v-btn>
          </div>

          <v-text-field
            v-if="auth.phoneCodeHash"
            v-model="code"
            :label="t('auth.codeLabel')"
            placeholder="12345"
            :disabled="actionLoading"
          />

          <v-btn
            v-if="auth.phoneCodeHash && !auth.needPassword"
            color="primary"
            variant="outlined"
            block
            class="mb-3 auth-action-btn"
            :disabled="!code || actionLoading"
            :loading="actionLoading"
            @click="onSignIn"
          >
            {{ t("auth.submitCodeLogin") }}
          </v-btn>

          <v-card v-if="qrDataUrl" variant="tonal" class="mb-4">
            <v-card-text>
              <v-img :src="qrDataUrl" :alt="t('auth.qrLogin')" max-width="240" class="mx-auto mb-3" />
              <p class="text-body-2 text-medium-emphasis mb-1">{{ t("auth.qrScanHint") }}</p>
              <p class="text-caption text-medium-emphasis" v-if="qrExpiresAt">{{ t("auth.qrExpiresAt", { time: formatTime(qrExpiresAt) }) }}</p>
            </v-card-text>
          </v-card>

          <v-text-field
            v-if="auth.needPassword"
            v-model="password"
            type="password"
            :label="t('auth.passwordLabel')"
            :disabled="actionLoading"
          />

          <v-btn
            v-if="auth.needPassword"
            color="primary"
            block
            class="mt-3 mb-3 auth-action-btn"
            :disabled="!password || actionLoading"
            :loading="actionLoading"
            @click="onSubmitPassword"
          >
            {{ t("auth.submitPassword") }}
          </v-btn>

          <v-alert v-if="error" type="error" class="mt-3">{{ error }}</v-alert>
          <v-alert v-if="message" type="info" class="mt-3">{{ message }}</v-alert>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import QRCode from "qrcode";
import { computed, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "../stores/auth";
import { pollQrLogin, startQrLogin, type QrLoginResponse } from "../services/api";
import { formatDateTime } from "../utils/dateTime";
import { toErrorMessage } from "../utils/error";

const auth = useAuthStore();
const { t, locale } = useI18n();

const phone = ref("");
const code = ref("");
const password = ref("");
const error = ref("");
const message = ref("");
const qrDataUrl = ref("");
const qrExpiresAt = ref("");
const actionLoading = ref(false);
const pollingQr = ref(false);
const dashboardRefreshing = ref(false);

let qrTimer: number | undefined;

const configValid = computed(() => auth.configValid);
const canStartLogin = computed(() => auth.clientReady && !auth.loading);

const dashboardProfile = computed(() => auth.dashboard?.profile);
const dashboardStats = computed(() => auth.dashboard?.stats);
const dashboardSystem = computed(() => auth.dashboard?.system);

const profileDisplayName = computed(() => dashboardProfile.value?.displayName || auth.me?.firstName || auth.me?.username || auth.me?.id || t("common.na"));
const profileUsername = computed(() => dashboardProfile.value?.username || auth.me?.username || "");
const profileId = computed(() => dashboardProfile.value?.id || auth.me?.id || t("common.na"));
const profilePhone = computed(() => dashboardProfile.value?.phone || auth.me?.phone || t("common.na"));
const profileAvatar = computed(() => dashboardProfile.value?.avatarDataUrl || "");
const avatarFallback = computed(() => {
  const value = profileDisplayName.value.trim();
  return value ? value.charAt(0).toUpperCase() : "?";
});

const entityCards = computed(() => {
  const entities = dashboardStats.value?.entities;
  return [
    { label: t("auth.stat.friendsTotal"), value: entities?.friendsTotal ?? 0 },
    { label: t("auth.stat.deletedContactsTotal"), value: entities?.deletedContactsTotal ?? 0 },
    { label: t("auth.stat.groupsTotal"), value: entities?.groupsTotal ?? 0 },
    { label: t("auth.stat.channelsTotal"), value: entities?.channelsTotal ?? 0 },
    { label: t("auth.stat.botChatsTotal"), value: entities?.botChatsTotal ?? 0 },
    { label: t("auth.stat.nonFriendChatsTotal"), value: entities?.nonFriendChatsTotal ?? 0 },
    { label: t("auth.stat.dialogsTotal"), value: entities?.dialogsTotal ?? 0 }
  ];
});

const jobCards = computed(() => {
  const jobs = dashboardStats.value?.jobs;
  return [
    { label: t("auth.stat.recentJobsTotal"), value: jobs?.recentJobsTotal ?? 0 },
    { label: t("auth.stat.runningJobs"), value: jobs?.runningJobs ?? 0 },
    { label: t("auth.stat.doneJobs"), value: jobs?.doneJobs ?? 0 },
    { label: t("auth.stat.failedJobs"), value: jobs?.failedJobs ?? 0 },
    { label: t("auth.stat.successItemsTotal"), value: jobs?.successItemsTotal ?? 0 },
    { label: t("auth.stat.failedItemsTotal"), value: jobs?.failedItemsTotal ?? 0 }
  ];
});

const previewCards = computed(() => {
  const previews = dashboardStats.value?.previews;
  return [
    { label: t("auth.stat.activePreviewTokens"), value: previews?.activePreviewTokens ?? 0 },
    { label: t("auth.stat.activePreviewTargets"), value: previews?.activePreviewTargets ?? 0 }
  ];
});

const fetchedAtText = computed(() => {
  if (!dashboardSystem.value?.fetchedAt) {
    return t("common.na");
  }

  return formatTime(dashboardSystem.value.fetchedAt);
});

const proxyDisplay = computed(() => {
  if (!dashboardSystem.value?.proxyEnabled) {
    return t("auth.proxyDisabled");
  }

  const host = dashboardSystem.value.proxyHost || t("common.na");
  const port = dashboardSystem.value.proxyPort || t("common.na");
  return `${host}:${port}`;
});

const clearFeedback = () => {
  error.value = "";
  message.value = "";
};

const stopQrPolling = () => {
  if (qrTimer) {
    window.clearInterval(qrTimer);
    qrTimer = undefined;
  }
  pollingQr.value = false;
};

const applyQrResponse = async (result: QrLoginResponse) => {
  if (result.status === "WAITING") {
    qrExpiresAt.value = result.expiresAt;
    qrDataUrl.value = await QRCode.toDataURL(result.qrLink, {
      width: 240,
      margin: 1
    });
    return;
  }

  if (result.status === "PASSWORD_REQUIRED") {
    auth.needPassword = true;
    stopQrPolling();
    message.value = t("auth.warningNeedPasswordAfterQr");
    return;
  }

  await auth.fetchStatus();
  auth.needPassword = false;
  qrDataUrl.value = "";
  qrExpiresAt.value = "";
  stopQrPolling();
  message.value = t("auth.qrLoginSuccess");
};

const startQrPolling = () => {
  stopQrPolling();
  pollingQr.value = true;

  qrTimer = window.setInterval(async () => {
    if (auth.authorized) {
      stopQrPolling();
      return;
    }

    try {
      const status = await pollQrLogin();
      if (!pollingQr.value) {
        return;
      }
      await applyQrResponse(status);
    } catch (e) {
      stopQrPolling();
      error.value = toErrorMessage(e);
    }
  }, 2000);
};

const formatTime = (value: string) => {
  return formatDateTime(value, locale.value) ?? t("common.na");
};

const runAction = async (action: () => Promise<void>) => {
  actionLoading.value = true;
  try {
    await action();
  } finally {
    actionLoading.value = false;
  }
};

const onInit = async () => {
  clearFeedback();
  try {
    await auth.initClient();
    message.value = auth.authorized ? t("auth.sessionRestored") : t("auth.loginReady");
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

const onSendCode = async () => {
  clearFeedback();
  await runAction(async () => {
    try {
      await auth.requestCode(phone.value.trim());
      message.value = t("auth.codeSent");
    } catch (e) {
      error.value = toErrorMessage(e);
    }
  });
};

const onSignIn = async () => {
  clearFeedback();
  await runAction(async () => {
    try {
      await auth.submitCode(phone.value.trim(), code.value.trim());
      if (auth.needPassword) {
        message.value = t("auth.passwordRequired");
      } else {
        message.value = t("auth.loginSuccess");
      }
    } catch (e) {
      error.value = toErrorMessage(e);
    }
  });
};

const onStartQrLogin = async () => {
  clearFeedback();
  auth.needPassword = false;
  password.value = "";
  await runAction(async () => {
    try {
      const result = await startQrLogin();
      await applyQrResponse(result);

      if (result.status === "WAITING") {
        message.value = t("auth.qrCreated");
        startQrPolling();
      }
    } catch (e) {
      error.value = toErrorMessage(e);
    }
  });
};

const onSubmitPassword = async () => {
  clearFeedback();
  await runAction(async () => {
    try {
      await auth.submit2FA(password.value);
      qrDataUrl.value = "";
      qrExpiresAt.value = "";
      stopQrPolling();
      message.value = t("auth.loginSuccess");
    } catch (e) {
      error.value = toErrorMessage(e);
    }
  });
};

const onRefreshDashboard = async () => {
  clearFeedback();
  dashboardRefreshing.value = true;
  try {
    await auth.loadDashboard(true);
    message.value = t("auth.dashboardRefreshed");
  } catch (e) {
    error.value = toErrorMessage(e);
  } finally {
    dashboardRefreshing.value = false;
  }
};

const onLogout = async () => {
  clearFeedback();
  await runAction(async () => {
    try {
      await auth.doLogout();
      qrDataUrl.value = "";
      qrExpiresAt.value = "";
      stopQrPolling();
      message.value = t("auth.loggedOut");
      code.value = "";
      password.value = "";
    } catch (e) {
      error.value = toErrorMessage(e);
    }
  });
};

onUnmounted(() => {
  stopQrPolling();
});
</script>

<style scoped>
.login-action-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  align-items: center;
}

.login-action-btn {
  min-width: 0;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-meta {
  min-width: 0;
}

.profile-name {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.profile-sub {
  margin: 2px 0;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.72);
}

.avatar-fallback {
  font-size: 24px;
  font-weight: 700;
}

.section-title {
  margin: 6px 0;
  font-size: 15px;
  font-weight: 600;
}

.stat-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  padding: 12px;
  height: 100%;
  background: rgba(var(--v-theme-surface-variant), 0.2);
}

.stat-label {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.stat-value {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.1;
}

.dashboard-item {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  padding: 12px;
  background: rgba(var(--v-theme-surface-variant), 0.25);
}

.dashboard-label {
  margin: 0 0 6px;
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.68);
}

.dashboard-value {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
}

.dashboard-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 600px) {
  .login-action-row {
    flex-direction: column;
  }

  .profile-header {
    align-items: flex-start;
  }
}
</style>
