import { defineStore } from "pinia";
import type { DashboardResponse, TelegramConfig } from "@tg-tools/shared";
import { authStatus, fetchDashboard, initAuth, logout, sendCode, signIn, submitPassword } from "../services/api";
import { toErrorMessage } from "../utils/error";

const STORAGE_KEY = "tg.api.config";
const AVATAR_CACHE_PREFIX = "tg.dashboard.avatar.";

type ProxyForm = NonNullable<TelegramConfig["proxy"]>;

interface ConfigForm extends TelegramConfig {
  proxy: ProxyForm;
}

interface AvatarCacheRecord {
  avatarDataUrl: string;
  avatarUpdatedAt?: string;
}

interface AuthState {
  config: ConfigForm;
  authorized: boolean;
  me?: {
    id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
  };
  phoneCodeHash: string;
  needPassword: boolean;
  warning?: string;
  usingSecureStorage: boolean;
  loading: boolean;
  initialized: boolean;
  initializedConfigKey: string;
  autoInitError?: string;
  dashboard?: DashboardResponse;
  dashboardLoading: boolean;
  dashboardError?: string;
}

const defaultConfig = (): ConfigForm => ({
  apiId: 0,
  apiHash: "",
  proxy: {
    enabled: false,
    host: "127.0.0.1",
    port: 1080,
    username: "",
    password: ""
  }
});

const configSignature = (config: ConfigForm) => {
  const normalized = {
    apiId: Number(config.apiId) || 0,
    apiHash: config.apiHash.trim(),
    proxy: {
      enabled: Boolean(config.proxy.enabled),
      host: (config.proxy.host || "").trim(),
      port: Number(config.proxy.port) || 0,
      username: (config.proxy.username || "").trim(),
      password: config.proxy.password || ""
    }
  };

  return JSON.stringify(normalized);
};

const isConfigValid = (config: ConfigForm) => {
  if (!(Number(config.apiId) > 0) || config.apiHash.trim().length < 5) {
    return false;
  }

  if (!config.proxy.enabled) {
    return true;
  }

  return Boolean(config.proxy.host.trim()) && Number(config.proxy.port) > 0;
};

const avatarStorageKey = (accountId: string) => `${AVATAR_CACHE_PREFIX}${accountId}`;

const readAvatarCache = (accountId: string): AvatarCacheRecord | undefined => {
  try {
    const raw = localStorage.getItem(avatarStorageKey(accountId));
    if (!raw) {
      return undefined;
    }

    const parsed = JSON.parse(raw) as AvatarCacheRecord;
    if (!parsed.avatarDataUrl) {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
};

const writeAvatarCache = (accountId: string, data: AvatarCacheRecord) => {
  localStorage.setItem(avatarStorageKey(accountId), JSON.stringify(data));
};

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    config: defaultConfig(),
    authorized: false,
    me: undefined,
    phoneCodeHash: "",
    needPassword: false,
    warning: undefined,
    usingSecureStorage: false,
    loading: false,
    initialized: false,
    initializedConfigKey: "",
    autoInitError: undefined,
    dashboard: undefined,
    dashboardLoading: false,
    dashboardError: undefined
  }),
  getters: {
    configValid: (state) => isConfigValid(state.config),
    clientReady(state): boolean {
      return state.initialized && state.initializedConfigKey === configSignature(state.config);
    }
  },
  actions: {
    loadConfig() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw) as Partial<ConfigForm>;
        this.config = {
          ...defaultConfig(),
          ...parsed,
          proxy: {
            ...defaultConfig().proxy,
            ...(parsed.proxy ?? {})
          }
        };
      } catch {
        this.config = defaultConfig();
      }
    },
    saveConfig() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    },
    async initClient() {
      this.loading = true;
      this.autoInitError = undefined;

      try {
        this.saveConfig();
        await initAuth(this.config);
        this.initialized = true;
        this.initializedConfigKey = configSignature(this.config);
        await this.fetchStatus();
      } catch (error) {
        this.initialized = false;
        this.initializedConfigKey = "";
        this.autoInitError = toErrorMessage(error);
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async autoInitIfConfigured() {
      if (!this.configValid) {
        this.initialized = false;
        this.initializedConfigKey = "";
        return false;
      }

      // Prevent redundant /api/auth/init calls on route remount/HMR.
      if (this.clientReady) {
        await this.fetchStatus();
        return true;
      }

      try {
        await this.initClient();
        return true;
      } catch {
        return false;
      }
    },
    async fetchStatus() {
      const status = await authStatus();
      this.authorized = status.authorized;
      this.me = status.me;
      this.warning = status.warning;
      this.usingSecureStorage = status.usingSecureStorage;

      if (this.authorized) {
        await this.loadDashboard(false).catch(() => undefined);
      } else {
        this.dashboard = undefined;
        this.dashboardError = undefined;
      }
    },
    async loadDashboard(force = false) {
      if (!this.clientReady) {
        this.dashboard = undefined;
        this.dashboardError = undefined;
        return undefined;
      }

      this.dashboardLoading = true;
      this.dashboardError = undefined;

      try {
        const dashboard = await fetchDashboard(force);

        if (dashboard.profile?.id) {
          if (dashboard.profile.avatarDataUrl) {
            writeAvatarCache(dashboard.profile.id, {
              avatarDataUrl: dashboard.profile.avatarDataUrl,
              avatarUpdatedAt: dashboard.profile.avatarUpdatedAt
            });
          } else {
            const cached = readAvatarCache(dashboard.profile.id);
            if (cached) {
              dashboard.profile.avatarDataUrl = cached.avatarDataUrl;
              dashboard.profile.avatarUpdatedAt ??= cached.avatarUpdatedAt;
            }
          }
        }

        this.dashboard = dashboard;
        if (dashboard.warning) {
          this.warning = dashboard.warning;
        }

        return dashboard;
      } catch (error) {
        this.dashboardError = toErrorMessage(error);
        throw error;
      } finally {
        this.dashboardLoading = false;
      }
    },
    async requestCode(phone: string) {
      if (!this.clientReady) {
        throw new Error("CLIENT_NOT_READY");
      }

      const result = await sendCode(phone);
      this.phoneCodeHash = result.phoneCodeHash;
    },
    async submitCode(phone: string, code: string) {
      if (!this.clientReady) {
        throw new Error("CLIENT_NOT_READY");
      }

      const result = await signIn(phone, code, this.phoneCodeHash);
      this.needPassword = result.status === "PASSWORD_REQUIRED";
      if (result.status === "OK") {
        this.needPassword = false;
        this.phoneCodeHash = "";
        await this.fetchStatus();
      }
    },
    async submit2FA(password: string) {
      if (!this.clientReady) {
        throw new Error("CLIENT_NOT_READY");
      }

      await submitPassword(password);
      this.needPassword = false;
      this.phoneCodeHash = "";
      await this.fetchStatus();
    },
    async doLogout() {
      await logout();
      this.authorized = false;
      this.me = undefined;
      this.needPassword = false;
      this.phoneCodeHash = "";
      this.initialized = false;
      this.initializedConfigKey = "";
      this.dashboard = undefined;
      this.dashboardError = undefined;
    }
  }
});
