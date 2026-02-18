import cors from "cors";
import express from "express";
import { z } from "zod";
import type {
  BatchAction,
  BatchExecuteRequest,
  BatchPreviewRequest,
  DashboardJobStats,
  DashboardResponse,
  TelegramConfig
} from "@tg-tools/shared";
import { BatchService } from "./services/batchService.js";
import { TelegramService } from "./services/telegramService.js";
import { JobStore } from "./store/jobStore.js";
import { PreviewStore } from "./store/previewStore.js";
import { HttpError } from "./utils/httpError.js";

const telegramService = new TelegramService();
const previewStore = new PreviewStore();
const jobStore = new JobStore();
const batchService = new BatchService(telegramService, previewStore, jobStore);

const telegramConfigSchema = z.object({
  apiId: z.coerce.number().int().positive(),
  apiHash: z.string().min(5),
  proxy: z
    .object({
      enabled: z.boolean().default(false),
      host: z.string().default(""),
      port: z.coerce.number().int().positive().default(1080),
      username: z.string().optional(),
      password: z.string().optional()
    })
    .optional()
});

const sendCodeSchema = z.object({
  phone: z.string().min(5)
});

const signInSchema = z.object({
  phone: z.string().min(5),
  code: z.string().min(3),
  phoneCodeHash: z.string().min(2)
});

const passwordSchema = z.object({
  password: z.string().min(1)
});

const dashboardQuerySchema = z.object({
  force: z.enum(["0", "1"]).optional().default("0")
});

const entitiesQuerySchema = z.object({
  type: z.enum(["friend", "group", "channel", "non_friend_chat", "bot_chat"]),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(["title", "last_used_at"]).optional().default("title"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("asc")
});

const batchPreviewSchema = z.object({
  action: z.enum([
    "DELETE_FRIENDS",
    "LEAVE_GROUPS",
    "UNSUBSCRIBE_CHANNELS",
    "CLEANUP_DELETED_CONTACTS",
    "CLEANUP_NON_FRIEND_CHATS",
    "CLEANUP_BOT_CHATS"
  ]),
  entities: z.array(
    z.object({
      id: z.string().min(1),
      accessHash: z.string().optional(),
      type: z.enum(["friend", "group", "channel", "non_friend_chat", "bot_chat"]),
      title: z.string().min(1),
      username: z.string().optional(),
      isDeleted: z.boolean().optional(),
      lastUsedAt: z.string().optional()
    })
  )
});

const batchExecuteSchema = z.object({
  action: z.enum([
    "DELETE_FRIENDS",
    "LEAVE_GROUPS",
    "UNSUBSCRIBE_CHANNELS",
    "CLEANUP_DELETED_CONTACTS",
    "CLEANUP_NON_FRIEND_CHATS",
    "CLEANUP_BOT_CHATS"
  ]),
  previewToken: z.string().min(1)
});

export const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "tg-tools-server" });
});

app.post("/api/auth/init", async (req, res, next) => {
  try {
    const payload = telegramConfigSchema.parse(req.body) as TelegramConfig;
    const result = await telegramService.init(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/send-code", async (req, res, next) => {
  try {
    const payload = sendCodeSchema.parse(req.body);
    const result = await telegramService.sendCode(payload.phone);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/sign-in", async (req, res, next) => {
  try {
    const payload = signInSchema.parse(req.body);
    const result = await telegramService.signIn(payload.phone, payload.code, payload.phoneCodeHash);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/password", async (req, res, next) => {
  try {
    const payload = passwordSchema.parse(req.body);
    const result = await telegramService.signInWithPassword(payload.password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/qr/start", async (_req, res, next) => {
  try {
    const result = await telegramService.startQrLogin();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/qr/status", async (_req, res, next) => {
  try {
    const result = await telegramService.pollQrLogin();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/status", async (_req, res, next) => {
  try {
    const result = await telegramService.status();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/dashboard", async (req, res, next) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const snapshot = await telegramService.getDashboardSnapshot(query.force === "1");

    if (!snapshot.authorized) {
      const response: DashboardResponse = {
        authorized: false,
        system: snapshot.system,
        warning: snapshot.warning
      };

      res.json(response);
      return;
    }

    const recentJobs = jobStore.listRecent();
    const jobsStats: DashboardJobStats = {
      recentJobsTotal: recentJobs.length,
      runningJobs: recentJobs.filter((job) => job.status === "RUNNING").length,
      doneJobs: recentJobs.filter((job) => job.status === "DONE").length,
      failedJobs: recentJobs.filter((job) => job.status === "FAILED").length,
      successItemsTotal: recentJobs.reduce((sum, job) => sum + job.successCount, 0),
      failedItemsTotal: recentJobs.reduce((sum, job) => sum + job.failedCount, 0)
    };

    const response: DashboardResponse = {
      authorized: true,
      profile: snapshot.profile,
      stats: {
        entities: snapshot.entityStats ?? {
          friendsTotal: 0,
          deletedContactsTotal: 0,
          groupsTotal: 0,
          channelsTotal: 0,
          botChatsTotal: 0,
          nonFriendChatsTotal: 0,
          dialogsTotal: 0
        },
        jobs: jobsStats,
        previews: previewStore.getStats()
      },
      system: snapshot.system,
      warning: snapshot.warning
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", async (_req, res, next) => {
  try {
    await telegramService.logout();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/entities", async (req, res, next) => {
  try {
    const query = entitiesQuerySchema.parse(req.query);
    const result = await telegramService.listEntities(
      query.type,
      query.search,
      query.page,
      query.pageSize,
      query.sortBy,
      query.sortOrder
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/ops/preview", (req, res, next) => {
  try {
    const payload = batchPreviewSchema.parse(req.body) as BatchPreviewRequest;
    const result = batchService.createPreview(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/ops/execute", (req, res, next) => {
  try {
    const payload = batchExecuteSchema.parse(req.body) as BatchExecuteRequest;
    const result = batchService.execute(payload);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/ops/:jobId", (req, res, next) => {
  try {
    const result = batchService.getJob(req.params.jobId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/api/ops", (_req, res, next) => {
  try {
    res.json({ items: batchService.listRecentJobs() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cleanup/deleted/preview", async (_req, res, next) => {
  try {
    const result = await batchService.createDeletedContactsPreview();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/cleanup/deleted/execute", (req, res, next) => {
  try {
    const payload = z
      .object({
        previewToken: z.string().min(1)
      })
      .parse(req.body);

    const result = batchService.execute({
      action: "CLEANUP_DELETED_CONTACTS" satisfies BatchAction,
      previewToken: payload.previewToken
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/cleanup/non-friends/preview", async (_req, res, next) => {
  try {
    const result = await batchService.createNonFriendChatsPreview();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/cleanup/non-friends/execute", (req, res, next) => {
  try {
    const payload = z
      .object({
        previewToken: z.string().min(1)
      })
      .parse(req.body);

    const result = batchService.execute({
      action: "CLEANUP_NON_FRIEND_CHATS" satisfies BatchAction,
      previewToken: payload.previewToken
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/cleanup/bots/preview", async (_req, res, next) => {
  try {
    const result = await batchService.createBotChatsPreview();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.post("/api/cleanup/bots/execute", (req, res, next) => {
  try {
    const payload = z
      .object({
        previewToken: z.string().min(1)
      })
      .parse(req.body);

    const result = batchService.execute({
      action: "CLEANUP_BOT_CHATS" satisfies BatchAction,
      previewToken: payload.previewToken
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "请求参数校验失败。",
      details: error.flatten()
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: "HTTP_ERROR",
      message: error.message,
      details: error.details
    });
    return;
  }

  const unknown = error as Error;
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: unknown?.message || "服务器内部错误"
  });
});
