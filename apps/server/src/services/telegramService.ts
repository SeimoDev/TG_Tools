import bigInt from "big-integer";
import { Api, TelegramClient } from "telegram";
import { LogLevel, Logger } from "telegram/extensions/Logger";
import { StringSession } from "telegram/sessions";
import type {
  AccountProfile,
  AuthInitResult,
  DashboardEntityStats,
  DashboardProfile,
  DashboardSystemStats,
  EntityItem,
  EntitySortBy,
  EntityType,
  PagedResult,
  SortOrder,
  TelegramConfig
} from "@tg-tools/shared";
import { HttpError } from "../utils/httpError.js";
import { retryWithFloodWait } from "../utils/telegramRetry.js";
import { SessionStore } from "./sessionStore.js";

interface StatusResult {
  authorized: boolean;
  me?: AccountProfile;
  usingSecureStorage: boolean;
  warning?: string;
}

interface DashboardSnapshot {
  authorized: boolean;
  profile?: DashboardProfile;
  entityStats?: DashboardEntityStats;
  system: DashboardSystemStats;
  warning?: string;
}

interface AvatarCacheEntry {
  photoKey: string;
  dataUrl: string;
  updatedAt: string;
  expiresAt: number;
}

interface QrTokenState {
  token: Buffer;
  expiresAt: number;
}

interface QrWaitingResponse {
  status: "WAITING";
  qrToken: string;
  qrLink: string;
  expiresAt: string;
}

type QrLoginResponse = QrWaitingResponse | { status: "OK" } | { status: "PASSWORD_REQUIRED" };

const normalizeText = (value: string) => value.trim().toLowerCase();
const getTelegramErrorMessage = (error: unknown): string => {
  const err = error as { errorMessage?: string; message?: string } | undefined;
  return String(err?.errorMessage ?? err?.message ?? "");
};

class TelegramServiceLogger extends Logger {
  override canSend(level: LogLevel): boolean {
    if (level === LogLevel.ERROR) {
      return false;
    }

    return super.canSend(level);
  }
}

const isPasswordRequiredError = (error: unknown): boolean => {
  return getTelegramErrorMessage(error).includes("SESSION_PASSWORD_NEEDED");
};

const normalizeConfig = (config: TelegramConfig): TelegramConfig => ({
  ...config,
  apiId: Number(config.apiId),
  apiHash: config.apiHash.trim(),
  proxy: config.proxy
    ? {
        ...config.proxy,
        enabled: Boolean(config.proxy.enabled),
        host: (config.proxy.host || "").trim(),
        port: Number(config.proxy.port),
        username: config.proxy.username?.trim(),
        password: config.proxy.password ?? ""
      }
    : undefined
});

const configEquals = (left: TelegramConfig | null, right: TelegramConfig): boolean => {
  if (!left) {
    return false;
  }

  const leftProxy = left.proxy;
  const rightProxy = right.proxy;

  return (
    Number(left.apiId) === Number(right.apiId) &&
    (left.apiHash || "").trim() === (right.apiHash || "").trim() &&
    Boolean(leftProxy?.enabled) === Boolean(rightProxy?.enabled) &&
    (leftProxy?.host || "").trim() === (rightProxy?.host || "").trim() &&
    Number(leftProxy?.port || 0) === Number(rightProxy?.port || 0) &&
    (leftProxy?.username || "").trim() === (rightProxy?.username || "").trim() &&
    (leftProxy?.password || "") === (rightProxy?.password || "")
  );
};

const toTitle = (firstName?: string | null, lastName?: string | null, username?: string | null, fallback = "Unknown") => {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || username || fallback;
};

const toIsoDate = (value: unknown): string | undefined => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }

  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  if (value && typeof value === "object") {
    const maybeDate = value as { toJSDate?: () => Date };
    if (typeof maybeDate.toJSDate === "function") {
      const converted = maybeDate.toJSDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted.toISOString();
      }
    }
  }

  return undefined;
};

export class TelegramService {
  private static readonly AVATAR_CACHE_TTL_MS = 10 * 60 * 1000;

  private config: TelegramConfig | null = null;
  private client: TelegramClient | null = null;
  private session = new StringSession("");
  private sessionStore = new SessionStore();
  private usingSecureStorage = false;
  private storageWarning: string | undefined;
  private qrTokenState: QrTokenState | null = null;
  private avatarCache = new Map<string, AvatarCacheEntry>();

  async init(config: TelegramConfig): Promise<AuthInitResult> {
    const normalizedConfig = normalizeConfig(config);

    if (!normalizedConfig.apiId || !normalizedConfig.apiHash) {
      throw new HttpError(400, "apiId 和 apiHash 不能为空。");
    }

    // Avoid resetting QR login flow when frontend remounts/HMR triggers init with identical config.
    if (this.client && configEquals(this.config, normalizedConfig)) {
      await this.client.connect();
      const authorized = await this.client.checkAuthorization();

      if (authorized) {
        await this.persistSession();
      }

      return {
        ok: true,
        hasSavedSession: Boolean(this.session.save()),
        usingSecureStorage: this.usingSecureStorage,
        warning: this.storageWarning
      };
    }

    if (this.client) {
      try {
        // Use destroy() instead of disconnect(): disconnect keeps GramJS update loop alive.
        await this.client.destroy();
      } catch {
        // ignore stale connection cleanup errors
      }
    }

    this.config = normalizedConfig;

    const loaded = await this.sessionStore.load();
    this.session = new StringSession(loaded.session || "");
    this.usingSecureStorage = loaded.usingSecureStorage;
    this.storageWarning = loaded.warning;

    const proxy = this.buildProxyConfig(this.config);

    this.client = new TelegramClient(this.session, this.config.apiId, this.config.apiHash, {
      connectionRetries: 5,
      baseLogger: new TelegramServiceLogger(LogLevel.INFO),
      // GramJS does not allow SSL/WSS transport with SOCKS/MT proxies.
      useWSS: !proxy,
      proxy
    });
    this.client.onError = async (error) => {
      const message = getTelegramErrorMessage(error);
      if (message.includes("TIMEOUT")) {
        // Update-loop timeout is transient; reconnect is automatic.
        return;
      }

      // Keep non-timeout errors visible after suppressing GramJS default error printing.
      console.error(error);
    };
    this.qrTokenState = null;

    await this.client.connect();

    const authorized = await this.client.checkAuthorization();

    if (authorized) {
      await this.persistSession();
    }

    return {
      ok: true,
      hasSavedSession: Boolean(loaded.session),
      usingSecureStorage: this.usingSecureStorage,
      warning: this.storageWarning
    };
  }

  async sendCode(phone: string): Promise<{ phoneCodeHash: string }> {
    const client = this.getClientOrThrow();
    const credentials = this.getApiCredentials();

    await client.connect();

    const result = await retryWithFloodWait(() => client.sendCode(credentials, phone.trim()));

    return {
      phoneCodeHash: result.phoneCodeHash
    };
  }

  async signIn(phone: string, code: string, phoneCodeHash: string): Promise<{ status: "OK" | "PASSWORD_REQUIRED" }> {
    const client = this.getClientOrThrow();

    await client.connect();

    try {
      await retryWithFloodWait(() =>
        client.invoke(
          new Api.auth.SignIn({
            phoneNumber: phone.trim(),
            phoneCode: code.trim(),
            phoneCodeHash: phoneCodeHash.trim()
          })
        )
      );

      await this.persistSession();
      return { status: "OK" };
    } catch (error) {
      const message = String((error as { errorMessage?: string; message?: string }).errorMessage ?? (error as Error).message);
      if (message.includes("SESSION_PASSWORD_NEEDED")) {
        return { status: "PASSWORD_REQUIRED" };
      }
      throw error;
    }
  }

  async signInWithPassword(password: string): Promise<{ status: "OK" }> {
    const client = this.getClientOrThrow();
    const credentials = this.getApiCredentials();

    await client.connect();

    await retryWithFloodWait(() =>
      client.signInWithPassword(credentials, {
        password: async () => password,
        onError: (error) => {
          throw error;
        }
      })
    );

    await this.persistSession();
    this.qrTokenState = null;

    return { status: "OK" };
  }

  async startQrLogin(): Promise<QrLoginResponse> {
    const client = this.getClientOrThrow();
    await client.connect();

    if (await client.checkAuthorization()) {
      await this.persistSession();
      this.qrTokenState = null;
      return { status: "OK" };
    }

    let tokenState: QrTokenState | null;
    try {
      tokenState = await this.exportQrToken();
    } catch (error) {
      if (isPasswordRequiredError(error)) {
        this.qrTokenState = null;
        return { status: "PASSWORD_REQUIRED" };
      }
      throw error;
    }

    if (!tokenState) {
      this.qrTokenState = null;
      return { status: "OK" };
    }

    this.qrTokenState = tokenState;
    return this.toQrWaitingResponse(tokenState);
  }

  async pollQrLogin(): Promise<QrLoginResponse> {
    const client = this.getClientOrThrow();
    await client.connect();

    if (await client.checkAuthorization()) {
      await this.persistSession();
      this.qrTokenState = null;
      return { status: "OK" };
    }

    let tokenState = this.qrTokenState;
    if (!tokenState || Date.now() >= tokenState.expiresAt - 5000) {
      try {
        tokenState = await this.exportQrToken();
      } catch (error) {
        if (isPasswordRequiredError(error)) {
          this.qrTokenState = null;
          return { status: "PASSWORD_REQUIRED" };
        }
        throw error;
      }

      if (!tokenState) {
        this.qrTokenState = null;
        return { status: "OK" };
      }
      this.qrTokenState = tokenState;
      return this.toQrWaitingResponse(tokenState);
    }

    try {
      const result = await retryWithFloodWait(() =>
        client.invoke(
          new Api.auth.ImportLoginToken({
            token: tokenState.token
          })
        )
      );

      const resolved = await this.resolveLoginTokenResult(result);
      if (resolved.status === "OK") {
        this.qrTokenState = null;
        return { status: "OK" };
      }

      this.qrTokenState = resolved.state;
      return this.toQrWaitingResponse(resolved.state);
    } catch (error) {
      const message = String((error as { errorMessage?: string; message?: string }).errorMessage ?? (error as Error).message);

      if (message.includes("SESSION_PASSWORD_NEEDED")) {
        return { status: "PASSWORD_REQUIRED" };
      }

      if (message.includes("TIMEOUT")) {
        return this.toQrWaitingResponse(tokenState);
      }

      if (message.includes("AUTH_TOKEN_EXPIRED") || message.includes("AUTH_TOKEN_INVALID")) {
        let refreshed: QrTokenState | null;
        try {
          refreshed = await this.exportQrToken();
        } catch (refreshError) {
          if (isPasswordRequiredError(refreshError)) {
            this.qrTokenState = null;
            return { status: "PASSWORD_REQUIRED" };
          }
          throw refreshError;
        }

        if (!refreshed) {
          this.qrTokenState = null;
          return { status: "OK" };
        }
        this.qrTokenState = refreshed;
        return this.toQrWaitingResponse(refreshed);
      }

      throw error;
    }
  }

  async status(): Promise<StatusResult> {
    const client = this.client;

    if (!client) {
      return {
        authorized: false,
        usingSecureStorage: this.usingSecureStorage,
        warning: this.storageWarning
      };
    }

    await client.connect();
    const authorized = await client.checkAuthorization();

    if (!authorized) {
      return {
        authorized: false,
        usingSecureStorage: this.usingSecureStorage,
        warning: this.storageWarning
      };
    }

    const me = await client.getMe();

    const profile: AccountProfile = {
      id: String(me.id),
      firstName: me.firstName,
      lastName: me.lastName,
      username: me.username,
      phone: me.phone
    };

    return {
      authorized: true,
      me: profile,
      usingSecureStorage: this.usingSecureStorage,
      warning: this.storageWarning
    };
  }

  async getDashboardSnapshot(forceAvatar: boolean): Promise<DashboardSnapshot> {
    const client = this.client;
    const warnings: string[] = [];

    if (!client) {
      return {
        authorized: false,
        system: this.buildSystemStats(false),
        warning: this.storageWarning
      };
    }

    try {
      await client.connect();
    } catch (error) {
      warnings.push(`客户端连接失败：${(error as Error).message}`);
      return {
        authorized: false,
        system: this.buildSystemStats(false),
        warning: this.joinWarnings(warnings)
      };
    }

    const authorized = await client.checkAuthorization();
    if (!authorized) {
      return {
        authorized: false,
        system: this.buildSystemStats(true),
        warning: this.storageWarning
      };
    }

    let profile: DashboardProfile | undefined;

    try {
      const me = await client.getMe();
      profile = {
        id: String(me.id),
        displayName: toTitle(me.firstName, me.lastName, me.username, String(me.id)),
        firstName: me.firstName ?? undefined,
        lastName: me.lastName ?? undefined,
        username: me.username ?? undefined,
        phone: me.phone ?? undefined
      };

      const avatar = await this.loadAvatarData(client, me, forceAvatar);
      if (avatar.warning) {
        warnings.push(avatar.warning);
      } else {
        profile.avatarDataUrl = avatar.avatarDataUrl;
        profile.avatarUpdatedAt = avatar.avatarUpdatedAt;
      }
    } catch (error) {
      warnings.push(`账户信息获取失败：${(error as Error).message}`);
    }

    let friendsTotal = 0;
    let deletedContactsTotal = 0;

    try {
      const contactsResult = await retryWithFloodWait(() =>
        client.invoke(
          new Api.contacts.GetContacts({
            hash: bigInt.zero
          })
        )
      );

      const users = (contactsResult as { users?: Api.TypeUser[] }).users ?? [];
      for (const user of users) {
        if (!(user instanceof Api.User) || !user.contact) {
          continue;
        }
        friendsTotal += 1;
        if (user.deleted) {
          deletedContactsTotal += 1;
        }
      }
    } catch (error) {
      warnings.push(`联系人统计失败：${(error as Error).message}`);
    }

    let groupsTotal = 0;
    let channelsTotal = 0;
    let botChatsTotal = 0;
    let nonFriendChatsTotal = 0;
    let dialogsTotal = 0;

    try {
      const dialogs = await retryWithFloodWait(() => client.getDialogs({}));
      dialogsTotal = dialogs.length;

      for (const dialog of dialogs) {
        const entity = dialog.entity;
        if (!entity) {
          continue;
        }

        if (entity instanceof Api.Chat) {
          groupsTotal += 1;
          continue;
        }

        if (entity instanceof Api.Channel) {
          if (entity.megagroup || entity.gigagroup) {
            groupsTotal += 1;
          } else {
            channelsTotal += 1;
          }
          continue;
        }

        if (entity instanceof Api.User) {
          if (!entity.self && entity.bot) {
            botChatsTotal += 1;
          }

          if (!entity.self && !entity.contact && !entity.bot) {
            nonFriendChatsTotal += 1;
          }
        }
      }
    } catch (error) {
      warnings.push(`会话统计失败：${(error as Error).message}`);
    }

    const entityStats: DashboardEntityStats = {
      friendsTotal,
      deletedContactsTotal,
      groupsTotal,
      channelsTotal,
      botChatsTotal,
      nonFriendChatsTotal,
      dialogsTotal
    };

    return {
      authorized: true,
      profile,
      entityStats,
      system: this.buildSystemStats(true),
      warning: this.joinWarnings(warnings)
    };
  }

  async logout(): Promise<void> {
    const client = this.client;

    if (client) {
      try {
        await client.invoke(new Api.auth.LogOut());
      } catch {
        // ignore logout errors and continue cleanup
      }

      try {
        // Ensure update loop stops; disconnect() alone may keep reconnect loop running.
        await client.destroy();
      } catch {
        // ignore destroy errors
      }
    }

    await this.sessionStore.clear();
    this.client = null;
    this.session = new StringSession("");
    this.qrTokenState = null;
    this.avatarCache.clear();
  }

  async listEntities(
    type: EntityType,
    search: string,
    page: number,
    pageSize: number,
    sortBy: EntitySortBy,
    sortOrder: SortOrder
  ): Promise<PagedResult<EntityItem>> {
    const client = await this.requireAuthorizedClient();

    let items: EntityItem[] = [];

    if (type === "friend") {
      items = await this.fetchFriends(client);
    }

    if (type === "group" || type === "channel") {
      const [groups, channels] = await this.fetchDialogs(client);
      items = type === "group" ? groups : channels;
    }

    if (type === "non_friend_chat") {
      items = await this.fetchNonFriendPrivateChats(client);
    }

    if (type === "bot_chat") {
      items = await this.fetchBotPrivateChats(client);
    }

    const normalized = normalizeText(search || "");
    const filtered = normalized
      ? items.filter((item) => {
          return (
            item.title.toLowerCase().includes(normalized) ||
            item.username?.toLowerCase().includes(normalized) ||
            item.id.toLowerCase().includes(normalized)
          );
        })
      : items;

    const sorted = this.sortEntities(filtered, sortBy, sortOrder);

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
    const start = (safePage - 1) * safePageSize;

    return {
      items: sorted.slice(start, start + safePageSize),
      total: sorted.length,
      page: safePage,
      pageSize: safePageSize
    };
  }

  async previewDeletedFriends(): Promise<EntityItem[]> {
    const client = await this.requireAuthorizedClient();
    const friends = await this.fetchFriends(client);
    return friends.filter((item) => item.isDeleted);
  }

  async previewNonFriendPrivateChats(): Promise<EntityItem[]> {
    const client = await this.requireAuthorizedClient();
    return this.fetchNonFriendPrivateChats(client);
  }

  async previewBotPrivateChats(): Promise<EntityItem[]> {
    const client = await this.requireAuthorizedClient();
    const chats = await this.fetchBotPrivateChats(client);
    return this.sortEntities(chats, "last_used_at", "desc");
  }

  async deleteFriend(target: EntityItem): Promise<void> {
    const client = await this.requireAuthorizedClient();
    const accessHash = target.accessHash;

    if (!accessHash) {
      throw new HttpError(400, `好友 ${target.title} 缺少 accessHash，无法删除。`);
    }

    await retryWithFloodWait(() =>
      client.invoke(
        new Api.contacts.DeleteContacts({
          id: [
            new Api.InputUser({
              userId: bigInt(target.id),
              accessHash: bigInt(accessHash)
            })
          ]
        })
      )
    );
  }

  async leaveGroup(target: EntityItem): Promise<void> {
    const client = await this.requireAuthorizedClient();
    const accessHash = target.accessHash;

    if (accessHash) {
      await retryWithFloodWait(() =>
        client.invoke(
          new Api.channels.LeaveChannel({
            channel: new Api.InputChannel({
              channelId: bigInt(target.id),
              accessHash: bigInt(accessHash)
            })
          })
        )
      );
      return;
    }

    await retryWithFloodWait(() =>
      client.invoke(
        new Api.messages.DeleteChatUser({
          chatId: bigInt(target.id),
          userId: new Api.InputUserSelf()
        })
      )
    );
  }

  async unsubscribeChannel(target: EntityItem): Promise<void> {
    const client = await this.requireAuthorizedClient();
    const accessHash = target.accessHash;

    if (!accessHash) {
      throw new HttpError(400, `频道 ${target.title} 缺少 accessHash，无法退订。`);
    }

    await retryWithFloodWait(() =>
      client.invoke(
        new Api.channels.LeaveChannel({
          channel: new Api.InputChannel({
            channelId: bigInt(target.id),
            accessHash: bigInt(accessHash)
          })
        })
      )
    );
  }

  async clearNonFriendPrivateChat(target: EntityItem): Promise<void> {
    await this.clearPrivateChat(target);
  }

  async clearBotPrivateChat(target: EntityItem): Promise<void> {
    await this.clearPrivateChat(target);
  }

  private async clearPrivateChat(target: EntityItem): Promise<void> {
    const client = await this.requireAuthorizedClient();
    const peer = await this.resolveInputPeerUser(client, target);

    let offset = 0;
    let retries = 0;

    do {
      const result = await retryWithFloodWait(() =>
        client.invoke(
          new Api.messages.DeleteHistory({
            peer,
            maxId: 0,
            revoke: true,
            justClear: false
          })
        )
      );

      offset = (result as Api.messages.AffectedHistory).offset || 0;
      retries += 1;
    } while (offset > 0 && retries < 50);
  }

  private getClientOrThrow(): TelegramClient {
    if (!this.client) {
      throw new HttpError(400, "请先初始化 Telegram API 配置。调用 /api/auth/init。");
    }

    return this.client;
  }

  private getApiCredentials() {
    if (!this.config) {
      throw new HttpError(400, "缺少 Telegram API 配置，请先调用 /api/auth/init。");
    }

    return {
      apiId: this.config.apiId,
      apiHash: this.config.apiHash
    };
  }

  private async persistSession() {
    const session = this.session.save();
    const saved = await this.sessionStore.save(session);
    this.usingSecureStorage = saved.usingSecureStorage;
    this.storageWarning = saved.warning;
  }

  private async exportQrToken(): Promise<QrTokenState | null> {
    const client = this.getClientOrThrow();
    const credentials = this.getApiCredentials();

    const result = await retryWithFloodWait(() =>
      client.invoke(
        new Api.auth.ExportLoginToken({
          apiId: Number(credentials.apiId),
          apiHash: credentials.apiHash,
          exceptIds: []
        })
      )
    );

    const resolved = await this.resolveLoginTokenResult(result);
    if (resolved.status === "OK") {
      return null;
    }

    return resolved.state;
  }

  private async resolveLoginTokenResult(
    result: Api.auth.TypeLoginToken
  ): Promise<{ status: "WAITING"; state: QrTokenState } | { status: "OK" }> {
    if (result instanceof Api.auth.LoginToken) {
      return {
        status: "WAITING",
        state: {
          token: result.token,
          expiresAt: Number(result.expires) * 1000
        }
      };
    }

    if (result instanceof Api.auth.LoginTokenSuccess) {
      await this.persistSession();
      return { status: "OK" };
    }

    if (result instanceof Api.auth.LoginTokenMigrateTo) {
      const client = this.getClientOrThrow();
      const withSwitchDc = client as unknown as { _switchDC: (dcId: number) => Promise<void> };
      await withSwitchDc._switchDC(result.dcId);

      const migrated = await retryWithFloodWait(() =>
        client.invoke(
          new Api.auth.ImportLoginToken({
            token: result.token
          })
        )
      );

      return this.resolveLoginTokenResult(migrated);
    }

    throw new HttpError(500, "二维码登录返回了未知结果。");
  }

  private toQrWaitingResponse(tokenState: QrTokenState): QrWaitingResponse {
    const qrToken = tokenState.token.toString("base64url");
    return {
      status: "WAITING",
      qrToken,
      qrLink: `tg://login?token=${qrToken}`,
      expiresAt: new Date(tokenState.expiresAt).toISOString()
    };
  }

  private buildSystemStats(clientReady: boolean): DashboardSystemStats {
    const proxyEnabled = Boolean(this.config?.proxy?.enabled);

    return {
      usingSecureStorage: this.usingSecureStorage,
      proxyEnabled,
      proxyHost: proxyEnabled ? this.config?.proxy?.host : undefined,
      proxyPort: proxyEnabled ? Number(this.config?.proxy?.port) : undefined,
      clientReady,
      fetchedAt: new Date().toISOString()
    };
  }

  private async loadAvatarData(
    client: TelegramClient,
    me: Api.User,
    forceAvatar: boolean
  ): Promise<{ avatarDataUrl?: string; avatarUpdatedAt?: string; warning?: string }> {
    const accountId = String(me.id);
    const photoKey = this.getPhotoKey(me);

    if (!photoKey) {
      this.avatarCache.delete(accountId);
      return {};
    }

    const cached = this.avatarCache.get(accountId);
    const now = Date.now();

    if (!forceAvatar && cached && cached.photoKey === photoKey && cached.expiresAt > now) {
      return {
        avatarDataUrl: cached.dataUrl,
        avatarUpdatedAt: cached.updatedAt
      };
    }

    try {
      const downloaded = await retryWithFloodWait(() =>
        client.downloadProfilePhoto("me", {
          isBig: false
        })
      );

      if (!downloaded || typeof downloaded === "string" || !Buffer.isBuffer(downloaded)) {
        return {};
      }

      const dataUrl = `data:image/jpeg;base64,${downloaded.toString("base64")}`;
      const updatedAt = new Date().toISOString();

      this.avatarCache.set(accountId, {
        photoKey,
        dataUrl,
        updatedAt,
        expiresAt: now + TelegramService.AVATAR_CACHE_TTL_MS
      });

      return {
        avatarDataUrl: dataUrl,
        avatarUpdatedAt: updatedAt
      };
    } catch (error) {
      return {
        warning: `头像获取失败：${(error as Error).message}`
      };
    }
  }

  private getPhotoKey(me: Api.User): string | undefined {
    const photo = me.photo as { photoId?: unknown } | undefined;
    if (!photo || typeof photo !== "object" || !photo.photoId) {
      return undefined;
    }

    return String(photo.photoId);
  }

  private joinWarnings(warnings: string[]): string | undefined {
    const normalized = [this.storageWarning, ...warnings].filter(Boolean) as string[];
    return normalized.length > 0 ? normalized.join("；") : undefined;
  }

  private buildProxyConfig(config: TelegramConfig) {
    if (!config.proxy?.enabled) {
      return undefined;
    }

    return {
      ip: config.proxy.host,
      port: Number(config.proxy.port),
      socksType: 5 as const,
      username: config.proxy.username,
      password: config.proxy.password
    };
  }

  private async requireAuthorizedClient(): Promise<TelegramClient> {
    const client = this.getClientOrThrow();
    await client.connect();

    const authorized = await client.checkAuthorization();
    if (!authorized) {
      throw new HttpError(401, "当前未登录，请先完成 Telegram 登录。");
    }

    return client;
  }

  private async fetchFriends(client: TelegramClient): Promise<EntityItem[]> {
    const result = await retryWithFloodWait(() =>
      client.invoke(
        new Api.contacts.GetContacts({
          hash: bigInt.zero
        })
      )
    );

    const users = (result as { users?: Api.TypeUser[] }).users ?? [];
    const mapped: EntityItem[] = [];

    for (const user of users) {
      if (!(user instanceof Api.User)) {
        continue;
      }

      if (!user.contact) {
        continue;
      }

      const id = String(user.id);
      const accessHash = user.accessHash ? String(user.accessHash) : undefined;

      mapped.push({
        id,
        accessHash,
        type: "friend",
        title: toTitle(user.firstName, user.lastName, user.username, id),
        username: user.username ?? undefined,
        isDeleted: Boolean(user.deleted)
      });
    }

    return mapped;
  }

  private async fetchDialogs(client: TelegramClient): Promise<[EntityItem[], EntityItem[]]> {
    const dialogs = await retryWithFloodWait(() => client.getDialogs({}));

    const groups: EntityItem[] = [];
    const channels: EntityItem[] = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;

      if (!entity) {
        continue;
      }

      if (entity instanceof Api.Chat) {
        groups.push({
          id: String(entity.id),
          type: "group",
          title: entity.title || String(entity.id)
        });
        continue;
      }

      if (entity instanceof Api.Channel) {
        const id = String(entity.id);
        const accessHash = entity.accessHash ? String(entity.accessHash) : undefined;
        const item: EntityItem = {
          id,
          accessHash,
          type: entity.megagroup || entity.gigagroup ? "group" : "channel",
          title: entity.title || id,
          username: entity.username ?? undefined
        };

        if (item.type === "group") {
          groups.push(item);
        } else {
          channels.push(item);
        }
      }
    }

    return [groups, channels];
  }

  private async fetchNonFriendPrivateChats(client: TelegramClient): Promise<EntityItem[]> {
    const dialogs = await retryWithFloodWait(() => client.getDialogs({}));
    const nonFriends: EntityItem[] = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;

      if (!(entity instanceof Api.User)) {
        continue;
      }

      if (entity.self || entity.contact || entity.bot) {
        continue;
      }

      nonFriends.push({
        id: String(entity.id),
        accessHash: entity.accessHash ? String(entity.accessHash) : undefined,
        type: "non_friend_chat",
        title: toTitle(entity.firstName, entity.lastName, entity.username, String(entity.id)),
        username: entity.username ?? undefined,
        isDeleted: Boolean(entity.deleted),
        lastUsedAt: this.getDialogLastUsedAt(dialog)
      });
    }

    return nonFriends;
  }

  private async fetchBotPrivateChats(client: TelegramClient): Promise<EntityItem[]> {
    const dialogs = await retryWithFloodWait(() => client.getDialogs({}));
    const bots: EntityItem[] = [];

    for (const dialog of dialogs) {
      const entity = dialog.entity;

      if (!(entity instanceof Api.User)) {
        continue;
      }

      if (entity.self || !entity.bot) {
        continue;
      }

      bots.push({
        id: String(entity.id),
        accessHash: entity.accessHash ? String(entity.accessHash) : undefined,
        type: "bot_chat",
        title: toTitle(entity.firstName, entity.lastName, entity.username, String(entity.id)),
        username: entity.username ?? undefined,
        isDeleted: Boolean(entity.deleted),
        lastUsedAt: this.getDialogLastUsedAt(dialog)
      });
    }

    return bots;
  }

  private getDialogLastUsedAt(dialog: unknown): string | undefined {
    if (!dialog || typeof dialog !== "object") {
      return undefined;
    }

    const maybeDialog = dialog as { date?: unknown };
    return toIsoDate(maybeDialog.date);
  }

  private sortEntities(items: EntityItem[], sortBy: EntitySortBy, sortOrder: SortOrder): EntityItem[] {
    const direction = sortOrder === "asc" ? 1 : -1;

    return [...items].sort((a, b) => {
      if (sortBy === "last_used_at") {
        const aHas = Boolean(a.lastUsedAt);
        const bHas = Boolean(b.lastUsedAt);

        if (aHas !== bHas) {
          return aHas ? -1 : 1;
        }

        const aTime = a.lastUsedAt ? Date.parse(a.lastUsedAt) : 0;
        const bTime = b.lastUsedAt ? Date.parse(b.lastUsedAt) : 0;

        if (aTime !== bTime) {
          return (aTime - bTime) * direction;
        }
      }

      return a.title.localeCompare(b.title, "zh-CN", { sensitivity: "base" }) * direction;
    });
  }

  private async resolveInputPeerUser(client: TelegramClient, target: EntityItem): Promise<Api.InputPeerUser> {
    if (target.accessHash) {
      return new Api.InputPeerUser({
        userId: bigInt(target.id),
        accessHash: bigInt(target.accessHash)
      });
    }

    try {
      const inputPeer = await client.getInputEntity(bigInt(target.id));
      if (inputPeer instanceof Api.InputPeerUser) {
        return inputPeer;
      }
    } catch {
      // ignore and throw a friendly error below
    }

    throw new HttpError(400, `私聊 ${target.title} 缺少 accessHash，无法清理聊天记录。`);
  }
}
