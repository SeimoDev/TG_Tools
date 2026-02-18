<template>
  <section class="card login-grid">
    <div>
      <h2>Telegram API 配置</h2>
      <p class="muted">`api_id / api_hash` 在前端本地保存。初始化后可继续登录流程。</p>

      <div class="form-grid">
        <label>
          API ID
          <input v-model.number="auth.config.apiId" type="number" min="1" placeholder="123456" />
        </label>
        <label>
          API Hash
          <input v-model="auth.config.apiHash" type="text" placeholder="your_api_hash" />
        </label>
      </div>

      <h3>代理（可选，SOCKS5）</h3>
      <label class="inline-toggle">
        <input v-model="auth.config.proxy.enabled" type="checkbox" />
        启用代理
      </label>

      <div class="form-grid" v-if="auth.config.proxy.enabled">
        <label>
          Host
          <input v-model="auth.config.proxy.host" type="text" placeholder="127.0.0.1" />
        </label>
        <label>
          Port
          <input v-model.number="auth.config.proxy.port" type="number" min="1" placeholder="1080" />
        </label>
        <label>
          Username
          <input v-model="auth.config.proxy.username" type="text" placeholder="optional" />
        </label>
        <label>
          Password
          <input v-model="auth.config.proxy.password" type="password" placeholder="optional" />
        </label>
      </div>

      <button class="primary" :disabled="!configValid || auth.loading" @click="onInit">
        {{ auth.loading ? "初始化中..." : "初始化客户端" }}
      </button>
      <p class="muted" v-if="auth.warning">警告: {{ auth.warning }}</p>
    </div>

    <div>
      <h2>登录流程</h2>
      <div class="form-grid">
        <label>
          手机号
          <input v-model="phone" type="text" placeholder="+8613800000000" />
        </label>
      </div>

      <div class="form-row">
        <button class="primary" :disabled="!phone" @click="onSendCode">发送验证码</button>
      </div>

      <div class="form-grid" v-if="auth.phoneCodeHash">
        <label>
          验证码
          <input v-model="code" type="text" placeholder="12345" />
        </label>
      </div>

      <div class="form-row" v-if="auth.phoneCodeHash && !auth.needPassword">
        <button class="danger" :disabled="!code" @click="onSignIn">提交验证码登录</button>
      </div>

      <div class="form-row qr-actions">
        <button class="ghost" @click="onStartQrLogin">二维码登录</button>
      </div>

      <div class="qr-panel" v-if="qrDataUrl">
        <img :src="qrDataUrl" alt="Telegram QR Login" class="qr-image" />
        <p class="muted">请在手机 Telegram 中扫描并确认登录</p>
        <p class="muted" v-if="qrExpiresAt">二维码过期时间：{{ formatTime(qrExpiresAt) }}</p>
      </div>

      <div v-if="auth.needPassword" class="form-grid">
        <label>
          二步验证密码
          <input v-model="password" type="password" placeholder="2FA password" />
        </label>
      </div>

      <div class="form-row" v-if="auth.needPassword">
        <button class="danger" :disabled="!password" @click="onSubmitPassword">提交二步验证</button>
      </div>

      <div class="form-row" v-if="auth.authorized">
        <button class="ghost" @click="onLogout">退出登录</button>
      </div>

      <p class="success" v-if="auth.authorized">已登录: {{ auth.me?.firstName || auth.me?.username || auth.me?.id }}</p>
      <p class="error" v-if="error">{{ error }}</p>
      <p class="success" v-if="message">{{ message }}</p>
    </div>
  </section>
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
