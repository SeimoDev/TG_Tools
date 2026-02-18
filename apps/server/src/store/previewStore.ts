import { randomUUID } from "node:crypto";
import type { BatchAction, BatchPreviewResponse, EntityItem } from "@tg-tools/shared";
import { PREVIEW_TOKEN_TTL_MS } from "../config.js";

interface PreviewSnapshot {
  action: BatchAction;
  items: EntityItem[];
  createdAt: number;
  expiresAt: number;
  warnings: string[];
}

export class PreviewStore {
  private readonly snapshots = new Map<string, PreviewSnapshot>();

  create(action: BatchAction, items: EntityItem[], warnings: string[] = []): BatchPreviewResponse {
    this.cleanupExpired();

    const now = Date.now();
    const token = randomUUID();
    const expiresAt = now + PREVIEW_TOKEN_TTL_MS;

    this.snapshots.set(token, {
      action,
      items,
      warnings,
      createdAt: now,
      expiresAt
    });

    return {
      previewToken: token,
      total: items.length,
      items,
      warnings,
      expiresAt: new Date(expiresAt).toISOString()
    };
  }

  consume(token: string, expectedAction: BatchAction): EntityItem[] {
    this.cleanupExpired();

    const entry = this.snapshots.get(token);
    if (!entry) {
      throw new Error("PREVIEW_TOKEN_INVALID");
    }

    if (entry.action !== expectedAction) {
      throw new Error("PREVIEW_ACTION_MISMATCH");
    }

    this.snapshots.delete(token);
    return entry.items;
  }

  get(token: string): PreviewSnapshot | undefined {
    this.cleanupExpired();
    return this.snapshots.get(token);
  }

  private cleanupExpired() {
    const now = Date.now();
    for (const [key, value] of this.snapshots.entries()) {
      if (value.expiresAt <= now) {
        this.snapshots.delete(key);
      }
    }
  }
}
