import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const KEYTAR_SERVICE = "tg-tools";
const KEYTAR_ACCOUNT = "telegram-session";

export interface SessionLoadResult {
  session: string;
  usingSecureStorage: boolean;
  warning?: string;
}

export class SessionStore {
  private readonly fallbackFilePath: string;
  private keytarModule: {
    getPassword: (service: string, account: string) => Promise<string | null>;
    setPassword: (service: string, account: string, password: string) => Promise<void>;
    deletePassword: (service: string, account: string) => Promise<boolean>;
  } | null = null;
  private keytarResolved = false;

  constructor() {
    this.fallbackFilePath = path.resolve(process.cwd(), "data", "session.json");
  }

  async load(): Promise<SessionLoadResult> {
    const keytar = this.tryGetKeytar();

    if (keytar) {
      const session = (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT)) ?? "";
      return {
        session,
        usingSecureStorage: true
      };
    }

    try {
      const raw = await readFile(this.fallbackFilePath, "utf-8");
      const parsed = JSON.parse(raw) as { session?: string };
      return {
        session: parsed.session ?? "",
        usingSecureStorage: false,
        warning: "keytar 不可用，已回退为本地文件存储会话。"
      };
    } catch {
      return {
        session: "",
        usingSecureStorage: false,
        warning: "keytar 不可用，已回退为本地文件存储会话。"
      };
    }
  }

  async save(session: string): Promise<SessionLoadResult> {
    const keytar = this.tryGetKeytar();

    if (keytar) {
      await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, session);
      return {
        session,
        usingSecureStorage: true
      };
    }

    await mkdir(path.dirname(this.fallbackFilePath), { recursive: true });
    await writeFile(this.fallbackFilePath, JSON.stringify({ session }, null, 2), "utf-8");
    return {
      session,
      usingSecureStorage: false,
      warning: "keytar 不可用，已回退为本地文件存储会话。"
    };
  }

  async clear(): Promise<void> {
    const keytar = this.tryGetKeytar();

    if (keytar) {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      return;
    }

    await rm(this.fallbackFilePath, { force: true });
  }

  private tryGetKeytar() {
    if (this.keytarResolved) {
      return this.keytarModule;
    }

    this.keytarResolved = true;

    try {
      this.keytarModule = require("keytar");
    } catch {
      this.keytarModule = null;
    }

    return this.keytarModule;
  }
}
