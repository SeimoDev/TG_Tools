import { defineStore } from "pinia";
import type { TelegramConfig } from "@tg-tools/shared";
import { authStatus, initAuth, logout, sendCode, signIn, submitPassword } from "../services/api";

const STORAGE_KEY = "tg.api.config";

type ProxyForm = NonNullable<TelegramConfig["proxy"]>;

interface ConfigForm extends TelegramConfig {
  proxy: ProxyForm;
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

export const useAuthStore = defineStore("auth", {
  state: (): AuthState => ({
    config: defaultConfig(),
    authorized: false,
    me: undefined,
    phoneCodeHash: "",
    needPassword: false,
    warning: undefined,
    usingSecureStorage: false,
    loading: false
  }),
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
      try {
        this.saveConfig();
        await initAuth(this.config);
        await this.fetchStatus();
      } finally {
        this.loading = false;
      }
    },
    async fetchStatus() {
      const status = await authStatus();
      this.authorized = status.authorized;
      this.me = status.me;
      this.warning = status.warning;
      this.usingSecureStorage = status.usingSecureStorage;
    },
    async requestCode(phone: string) {
      const result = await sendCode(phone);
      this.phoneCodeHash = result.phoneCodeHash;
    },
    async submitCode(phone: string, code: string) {
      const result = await signIn(phone, code, this.phoneCodeHash);
      this.needPassword = result.status === "PASSWORD_REQUIRED";
      if (result.status === "OK") {
        this.needPassword = false;
        this.phoneCodeHash = "";
        await this.fetchStatus();
      }
    },
    async submit2FA(password: string) {
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
    }
  }
});
