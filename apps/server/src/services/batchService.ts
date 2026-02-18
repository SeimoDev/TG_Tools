import type {
  BatchAction,
  BatchExecuteRequest,
  BatchJobResult,
  BatchPreviewRequest,
  BatchPreviewResponse,
  BatchResultItem,
  EntityItem
} from "@tg-tools/shared";
import { DEFAULT_BATCH_DELAY_MS } from "../config.js";
import { HttpError } from "../utils/httpError.js";
import { aggregateResults, createJob } from "../utils/jobHelpers.js";
import { isAuthError, normalizeError } from "../utils/telegramRetry.js";
import { wait } from "../utils/wait.js";
import { TelegramService } from "./telegramService.js";
import { JobStore } from "../store/jobStore.js";
import { PreviewStore } from "../store/previewStore.js";

export class BatchService {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly telegramService: TelegramService,
    private readonly previewStore: PreviewStore,
    private readonly jobStore: JobStore
  ) {}

  createPreview(request: BatchPreviewRequest): BatchPreviewResponse {
    const { action, entities } = request;

    if (!Array.isArray(entities) || entities.length === 0) {
      throw new HttpError(400, "预览目标不能为空。");
    }

    const warnings: string[] = [];

    const filtered = entities.filter((item) => {
      const actionType = this.expectedEntityType(action);
      const keep = item.type === actionType || action === "CLEANUP_DELETED_CONTACTS";
      if (!keep) {
        warnings.push(`已忽略 ${item.title}：类型与动作 ${action} 不匹配。`);
      }
      return keep;
    });

    if (filtered.length === 0) {
      throw new HttpError(400, "没有可执行的目标，请检查选择项。", warnings);
    }

    return this.previewStore.create(action, filtered, warnings);
  }

  async createDeletedContactsPreview(): Promise<BatchPreviewResponse> {
    const deleted = await this.telegramService.previewDeletedFriends();
    return this.previewStore.create("CLEANUP_DELETED_CONTACTS", deleted);
  }

  execute(request: BatchExecuteRequest): { jobId: string } {
    const { action, previewToken } = request;

    let items: EntityItem[];
    try {
      items = this.previewStore.consume(previewToken, action);
    } catch (error) {
      throw new HttpError(400, "预览 token 无效或已过期。", error);
    }

    const job = createJob(action, items);
    this.jobStore.upsert(job);

    this.enqueue(async () => {
      await this.runJob(job, items);
    });

    return { jobId: job.jobId };
  }

  getJob(jobId: string): BatchJobResult {
    const job = this.jobStore.getById(jobId);
    if (!job) {
      throw new HttpError(404, `任务 ${jobId} 不存在。`);
    }

    return job;
  }

  listRecentJobs() {
    return this.jobStore.listRecent();
  }

  private enqueue(task: () => Promise<void>) {
    this.queue = this.queue.then(task).catch(() => {
      // swallow queue errors to keep queue alive
    });
  }

  private async runJob(seed: BatchJobResult, items: EntityItem[]) {
    const running: BatchJobResult = {
      ...seed,
      status: "RUNNING"
    };
    this.jobStore.upsert(running);

    const results: BatchResultItem[] = [];

    try {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];

        try {
          await this.runAction(seed.action, item);
          results.push({
            id: item.id,
            title: item.title,
            type: item.type,
            ok: true
          });
        } catch (error) {
          const normalized = normalizeError(error);
          results.push({
            id: item.id,
            title: item.title,
            type: item.type,
            ok: false,
            errorCode: normalized.code,
            errorMessage: normalized.message
          });

          if (isAuthError(error)) {
            throw error;
          }
        }

        if (i < items.length - 1) {
          await wait(DEFAULT_BATCH_DELAY_MS);
        }
      }

      this.jobStore.upsert(aggregateResults(running, results));
    } catch (error) {
      const failed = aggregateResults(running, results, true);
      this.jobStore.upsert(failed);
    }
  }

  private async runAction(action: BatchAction, item: EntityItem) {
    if (action === "DELETE_FRIENDS" || action === "CLEANUP_DELETED_CONTACTS") {
      await this.telegramService.deleteFriend(item);
      return;
    }

    if (action === "LEAVE_GROUPS") {
      await this.telegramService.leaveGroup(item);
      return;
    }

    if (action === "UNSUBSCRIBE_CHANNELS") {
      await this.telegramService.unsubscribeChannel(item);
      return;
    }

    throw new HttpError(400, `不支持的动作: ${action}`);
  }

  private expectedEntityType(action: BatchAction) {
    if (action === "DELETE_FRIENDS" || action === "CLEANUP_DELETED_CONTACTS") {
      return "friend";
    }

    if (action === "LEAVE_GROUPS") {
      return "group";
    }

    return "channel";
  }
}
