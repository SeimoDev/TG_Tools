<template>
  <v-row>
    <v-col cols="12" md="6">
      <v-card>
        <v-card-title class="text-h6">Telegram API 配置</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">`api_id / api_hash` 在前端本地保存。初始化后可继续登录流程。</p>

          <v-row>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model.number="auth.config.apiId"
                type="number"
                min="1"
                label="API ID"
                placeholder="123456"
                data-test="api-id"
              />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                v-model="auth.config.apiHash"
                label="API Hash"
                placeholder="your_api_hash"
                data-test="api-hash"
              />
            </v-col>
          </v-row>

          <v-divider class="my-2" />

          <v-switch v-model="auth.config.proxy.enabled" label="启用代理（SOCKS5）" color="primary" />

          <v-row v-if="auth.config.proxy.enabled">
            <v-col cols="12" sm="6">
              <v-text-field v-model="auth.config.proxy.host" label="Host" placeholder="127.0.0.1" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model.number="auth.config.proxy.port" type="number" min="1" label="Port" placeholder="1080" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="auth.config.proxy.username" label="Username" placeholder="optional" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="auth.config.proxy.password" type="password" label="Password" placeholder="optional" />
            </v-col>
          </v-row>

          <v-btn
            color="primary"
            block
            :loading="auth.loading"
            :disabled="!configValid || auth.loading"
            @click="onInit"
            data-test="init-btn"
          >
            初始化客户端
          </v-btn>

          <v-alert v-if="auth.warning" type="warning" class="mt-4">{{ auth.warning }}</v-alert>
        </v-card-text>
      </v-card>
    </v-col>

    <v-col cols="12" md="6">
      <v-card>
        <v-card-title class="text-h6">登录流程</v-card-title>
        <v-card-text>
          <v-text-field v-model="phone" label="手机号" placeholder="+8613800000000" />

          <v-row>
            <v-col cols="12" sm="6">
              <v-btn color="primary" block :disabled="!phone" @click="onSendCode">发送验证码</v-btn>
            </v-col>
            <v-col cols="12" sm="6">
              <v-btn variant="outlined" block @click="onStartQrLogin">二维码登录</v-btn>
            </v-col>
          </v-row>

          <v-text-field v-if="auth.phoneCodeHash" v-model="code" label="验证码" placeholder="12345" />

          <v-btn
            v-if="auth.phoneCodeHash && !auth.needPassword"
            color="primary"
            variant="outlined"
            block
            class="mb-3"
            :disabled="!code"
            @click="onSignIn"
          >
            提交验证码登录
          </v-btn>

          <v-card v-if="qrDataUrl" variant="tonal" class="mb-4">
            <v-card-text>
              <v-img :src="qrDataUrl" alt="Telegram QR Login" max-width="240" class="mx-auto mb-3" />
              <p class="text-body-2 text-medium-emphasis mb-1">请在手机 Telegram 中扫描并确认登录</p>
              <p class="text-caption text-medium-emphasis" v-if="qrExpiresAt">二维码过期时间：{{ formatTime(qrExpiresAt) }}</p>
            </v-card-text>
          </v-card>

          <v-text-field v-if="auth.needPassword" v-model="password" type="password" label="二步验证密码" placeholder="2FA password" />

          <v-btn
            v-if="auth.needPassword"
            color="primary"
            block
            class="mb-3"
            :disabled="!password"
            @click="onSubmitPassword"
          >
            提交二步验证
          </v-btn>

          <v-btn v-if="auth.authorized" variant="text" block @click="onLogout">退出登录</v-btn>

          <v-alert v-if="auth.authorized" type="success" class="mt-3">
            已登录: {{ auth.me?.firstName || auth.me?.username || auth.me?.id }}
          </v-alert>
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
import { useAuthStore } from "../stores/auth";
import { pollQrLogin, startQrLogin, type QrLoginResponse } from "../services/api";
import { toErrorMessage } from "../utils/error";

const auth = useAuthStore();

const phone = ref("");
const code = ref("");
const password = ref("");
const error = ref("");
const message = ref("");
const qrDataUrl = ref("");
const qrExpiresAt = ref("");

let qrTimer: number | undefined;

const configValid = computed(() => Number(auth.config.apiId) > 0 && auth.config.apiHash.trim().length >= 5);

const clearFeedback = () => {
  error.value = "";
  message.value = "";
};

const stopQrPolling = () => {
  if (qrTimer) {
    window.clearInterval(qrTimer);
    qrTimer = undefined;
  }
};

const applyQrResponse = async (result: QrLoginResponse) => {
  if (result.status === "WAITING") {
    qrExpiresAt.value = result.expiresAt;
    qrDataUrl.value = await QRCode.toDataURL(result.qrLink, {
      width: 240,
      margin: 1
    });
    auth.needPassword = false;
    return;
  }

  if (result.status === "PASSWORD_REQUIRED") {
    auth.needPassword = true;
    stopQrPolling();
    message.value = "扫码确认后需要二步验证，请输入密码";
    return;
  }

  await auth.fetchStatus();
  auth.needPassword = false;
  qrDataUrl.value = "";
  qrExpiresAt.value = "";
  stopQrPolling();
  message.value = "二维码登录成功";
};

const startQrPolling = () => {
  stopQrPolling();
  qrTimer = window.setInterval(async () => {
    if (auth.authorized) {
      stopQrPolling();
      return;
    }

    try {
      const status = await pollQrLogin();
      await applyQrResponse(status);
    } catch (e) {
      stopQrPolling();
      error.value = toErrorMessage(e);
    }
  }, 2000);
};

const formatTime = (value: string) => {
  return new Date(value).toLocaleString();
};

const onInit = async () => {
  clearFeedback();
  try {
    await auth.initClient();
    message.value = "客户端初始化完成";
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

const onSendCode = async () => {
  clearFeedback();
  try {
    await auth.requestCode(phone.value);
    message.value = "验证码已发送";
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

const onSignIn = async () => {
  clearFeedback();
  try {
    await auth.submitCode(phone.value, code.value);
    if (auth.needPassword) {
      message.value = "账号已开启二步验证，请输入密码";
    } else {
      message.value = "登录成功";
    }
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

const onStartQrLogin = async () => {
  clearFeedback();
  try {
    const result = await startQrLogin();
    await applyQrResponse(result);

    if (result.status === "WAITING") {
      message.value = "二维码已生成，请扫码确认";
      startQrPolling();
    }
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

const onSubmitPassword = async () => {
  clearFeedback();
  try {
    await auth.submit2FA(password.value);
    qrDataUrl.value = "";
    qrExpiresAt.value = "";
    stopQrPolling();
    message.value = "登录成功";
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

const onLogout = async () => {
  clearFeedback();
  try {
    await auth.doLogout();
    qrDataUrl.value = "";
    qrExpiresAt.value = "";
    stopQrPolling();
    message.value = "已退出登录";
  } catch (e) {
    error.value = toErrorMessage(e);
  }
};

onUnmounted(() => {
  stopQrPolling();
});
</script>
