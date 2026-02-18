import axios from "axios";
import type {
  BatchExecuteRequest,
  BatchJobResult,
  BatchPreviewRequest,
  BatchPreviewResponse,
  EntitySortBy,
  EntityType,
  PagedResult,
  SortOrder,
  TelegramConfig,
  EntityItem
} from "@tg-tools/shared";

export interface AuthStatusResponse {
  authorized: boolean;
  me?: {
    id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    phone?: string;
  };
  usingSecureStorage: boolean;
  warning?: string;
}

export type QrLoginResponse =
  | {
      status: "WAITING";
      qrToken: string;
      qrLink: string;
      expiresAt: string;
    }
  | { status: "OK" }
  | { status: "PASSWORD_REQUIRED" };

const baseURL = import.meta.env.VITE_API_BASE || "http://localhost:3000";

export const api = axios.create({
  baseURL,
  timeout: 30_000
});

export const initAuth = async (config: TelegramConfig) => {
  const { data } = await api.post("/api/auth/init", config);
  return data;
};

export const sendCode = async (phone: string): Promise<{ phoneCodeHash: string }> => {
  const { data } = await api.post("/api/auth/send-code", { phone });
  return data;
};

export const signIn = async (
  phone: string,
  code: string,
  phoneCodeHash: string
): Promise<{ status: "OK" | "PASSWORD_REQUIRED" }> => {
  const { data } = await api.post("/api/auth/sign-in", { phone, code, phoneCodeHash });
  return data;
};

export const submitPassword = async (password: string): Promise<{ status: "OK" }> => {
  const { data } = await api.post("/api/auth/password", { password });
  return data;
};

export const startQrLogin = async (): Promise<QrLoginResponse> => {
  const { data } = await api.post("/api/auth/qr/start");
  return data;
};

export const pollQrLogin = async (): Promise<QrLoginResponse> => {
  const { data } = await api.get("/api/auth/qr/status");
  return data;
};

export const authStatus = async (): Promise<AuthStatusResponse> => {
  const { data } = await api.get("/api/auth/status");
  return data;
};

export const logout = async (): Promise<void> => {
  await api.post("/api/auth/logout");
};

export const fetchEntities = async (params: {
  type: EntityType;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: EntitySortBy;
  sortOrder?: SortOrder;
}): Promise<PagedResult<EntityItem>> => {
  const { data } = await api.get("/api/entities", { params });
  return data;
};

export const createPreview = async (payload: BatchPreviewRequest): Promise<BatchPreviewResponse> => {
  const { data } = await api.post("/api/ops/preview", payload);
  return data;
};

export const executeBatch = async (payload: BatchExecuteRequest): Promise<{ jobId: string }> => {
  const { data } = await api.post("/api/ops/execute", payload);
  return data;
};

export const getJob = async (jobId: string): Promise<BatchJobResult> => {
  const { data } = await api.get(`/api/ops/${jobId}`);
  return data;
};

export const listJobs = async (): Promise<{ items: BatchJobResult[] }> => {
  const { data } = await api.get("/api/ops");
  return data;
};

export const previewDeletedContacts = async (): Promise<BatchPreviewResponse> => {
  const { data } = await api.post("/api/cleanup/deleted/preview");
  return data;
};

export const executeDeletedContacts = async (previewToken: string): Promise<{ jobId: string }> => {
  const { data } = await api.post("/api/cleanup/deleted/execute", { previewToken });
  return data;
};

export const previewNonFriendChats = async (): Promise<BatchPreviewResponse> => {
  const { data } = await api.post("/api/cleanup/non-friends/preview");
  return data;
};

export const executeNonFriendChats = async (previewToken: string): Promise<{ jobId: string }> => {
  const { data } = await api.post("/api/cleanup/non-friends/execute", { previewToken });
  return data;
};

export const previewBotChats = async (): Promise<BatchPreviewResponse> => {
  const { data } = await api.post("/api/cleanup/bots/preview");
  return data;
};

export const executeBotChats = async (previewToken: string): Promise<{ jobId: string }> => {
  const { data } = await api.post("/api/cleanup/bots/execute", { previewToken });
  return data;
};
