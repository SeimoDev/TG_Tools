export type EntityType = "friend" | "group" | "channel" | "non_friend_chat" | "bot_chat";

export type EntitySortBy = "title" | "last_used_at";
export type SortOrder = "asc" | "desc";

export interface ProxyConfig {
  enabled: boolean;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface TelegramConfig {
  apiId: number;
  apiHash: string;
  proxy?: ProxyConfig;
}

export interface AuthInitResult {
  ok: boolean;
  hasSavedSession: boolean;
  usingSecureStorage: boolean;
  warning?: string;
}

export interface AccountProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
}

export interface DashboardProfile {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  phone?: string;
  avatarDataUrl?: string;
  avatarUpdatedAt?: string;
}

export interface DashboardEntityStats {
  friendsTotal: number;
  deletedContactsTotal: number;
  groupsTotal: number;
  channelsTotal: number;
  botChatsTotal: number;
  nonFriendChatsTotal: number;
  dialogsTotal: number;
}

export interface DashboardJobStats {
  recentJobsTotal: number;
  runningJobs: number;
  doneJobs: number;
  failedJobs: number;
  successItemsTotal: number;
  failedItemsTotal: number;
}

export interface DashboardPreviewStats {
  activePreviewTokens: number;
  activePreviewTargets: number;
}

export interface DashboardSystemStats {
  usingSecureStorage: boolean;
  proxyEnabled: boolean;
  proxyHost?: string;
  proxyPort?: number;
  clientReady: boolean;
  fetchedAt: string;
}

export interface DashboardResponse {
  authorized: boolean;
  profile?: DashboardProfile;
  stats?: {
    entities: DashboardEntityStats;
    jobs: DashboardJobStats;
    previews: DashboardPreviewStats;
  };
  system: DashboardSystemStats;
  warning?: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EntityItem {
  id: string;
  accessHash?: string;
  type: EntityType;
  title: string;
  username?: string;
  isDeleted?: boolean;
  lastUsedAt?: string;
}

export type BatchAction =
  | "DELETE_FRIENDS"
  | "LEAVE_GROUPS"
  | "UNSUBSCRIBE_CHANNELS"
  | "CLEANUP_DELETED_CONTACTS"
  | "CLEANUP_NON_FRIEND_CHATS"
  | "CLEANUP_BOT_CHATS";

export interface BatchPreviewRequest {
  action: BatchAction;
  entities: EntityItem[];
}

export interface BatchPreviewResponse {
  previewToken: string;
  total: number;
  items: EntityItem[];
  warnings: string[];
  expiresAt: string;
}

export interface BatchExecuteRequest {
  action: BatchAction;
  previewToken: string;
}

export type JobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface BatchResultItem {
  id: string;
  title: string;
  type: EntityType;
  ok: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface BatchJobResult {
  jobId: string;
  action: BatchAction;
  status: JobStatus;
  total: number;
  successCount: number;
  failedCount: number;
  startedAt: string;
  finishedAt?: string;
  results: BatchResultItem[];
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  details?: unknown;
}
