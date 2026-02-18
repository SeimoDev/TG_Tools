import axios from "axios";
import { i18n } from "../plugins/i18n";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

const tryMapKeyword = (message: string): { key: string; params?: Record<string, string | number> } | undefined => {
  const normalized = message.toLowerCase();

  const floodWaitMatch = message.match(/FLOOD_WAIT_(\d+)/i);
  if (floodWaitMatch) {
    return {
      key: "errors.floodWait",
      params: { seconds: Number(floodWaitMatch[1]) || 0 }
    };
  }

  if (message.includes("FLOOD_WAIT")) {
    return {
      key: "errors.floodWait",
      params: { seconds: 0 }
    };
  }

  if (
    normalized.includes("auth_key_unregistered") ||
    normalized.includes("session_revoked") ||
    normalized.includes("user_deactivated") ||
    normalized.includes("unauthorized") ||
    normalized.includes("not authorized") ||
    normalized.includes("\u5f53\u524d\u672a\u767b\u5f55")
  ) {
    return { key: "errors.unauthorized" };
  }

  if (normalized.includes("client_not_ready")) {
    return { key: "errors.clientNotReady" };
  }

  if (
    normalized.includes("network error") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("econnrefused") ||
    normalized.includes("enotfound") ||
    normalized.includes("network")
  ) {
    return { key: "errors.network" };
  }

  if (normalized.includes("timeout") || normalized.includes("timed out") || normalized.includes("econnaborted")) {
    return { key: "errors.timeout" };
  }

  return undefined;
};

const mapCode = (code: string, message: string): string | undefined => {
  if (code === "VALIDATION_ERROR") {
    return "errors.validation";
  }

  if (code === "INTERNAL_ERROR") {
    return "errors.internal";
  }

  if (code === "HTTP_ERROR") {
    const keyword = tryMapKeyword(message);
    return keyword?.key ?? "errors.http";
  }

  return undefined;
};

const t = (key: string, params?: Record<string, string | number>): string => {
  if (params) {
    return i18n.global.t(key, params) as string;
  }

  return i18n.global.t(key) as string;
};

export const localizeError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const payload = (error.response?.data as ApiErrorPayload | undefined) ?? {};
    const message = payload.message || error.message || "";
    const code = payload.error || "";

    if (code) {
      const codeKey = mapCode(code, message);
      if (codeKey) {
        return t(codeKey);
      }
    }

    const mappedByMessage = tryMapKeyword(message);
    if (mappedByMessage) {
      return t(mappedByMessage.key, mappedByMessage.params);
    }

    return message || t("errors.unknown");
  }

  if (error instanceof Error) {
    const mapped = tryMapKeyword(error.message);
    if (mapped) {
      return t(mapped.key, mapped.params);
    }
    return error.message || t("errors.unknown");
  }

  if (typeof error === "string") {
    const mapped = tryMapKeyword(error);
    if (mapped) {
      return t(mapped.key, mapped.params);
    }
    return error;
  }

  return t("errors.unknown");
};
