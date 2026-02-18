import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BatchJobResult } from "@tg-tools/shared";
import { JOB_RETENTION_COUNT } from "../config.js";

interface JobRow {
  id: string;
  action: string;
  status: string;
  total: number;
  success_count: number;
  failed_count: number;
  started_at: string;
  finished_at: string | null;
  results_json: string;
}

export class JobStore {
  private readonly dataDir = path.resolve(process.cwd(), "data");
  private readonly sqlitePath = path.resolve(this.dataDir, "jobs.sqlite");
  private readonly jsonPath = path.resolve(this.dataDir, "jobs.json");
  private db: DatabaseSync | null = null;

  constructor() {
    mkdirSync(this.dataDir, { recursive: true });

    try {
      this.db = new DatabaseSync(this.sqlitePath);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          total INTEGER NOT NULL,
          success_count INTEGER NOT NULL,
          failed_count INTEGER NOT NULL,
          started_at TEXT NOT NULL,
          finished_at TEXT,
          results_json TEXT NOT NULL
        );
      `);
    } catch {
      this.db = null;
      this.ensureJsonFallback();
    }
  }

  upsert(job: BatchJobResult): void {
    if (this.db) {
      const stmt = this.db.prepare(`
        INSERT INTO jobs(
          id, action, status, total, success_count, failed_count, started_at, finished_at, results_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          action = excluded.action,
          status = excluded.status,
          total = excluded.total,
          success_count = excluded.success_count,
          failed_count = excluded.failed_count,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          results_json = excluded.results_json
      `);

      stmt.run(
        job.jobId,
        job.action,
        job.status,
        job.total,
        job.successCount,
        job.failedCount,
        job.startedAt,
        job.finishedAt ?? null,
        JSON.stringify(job.results)
      );

      this.trimSqlite();
      return;
    }

    const jobs = this.readJsonJobs();
    const idx = jobs.findIndex((item) => item.jobId === job.jobId);
    if (idx >= 0) {
      jobs[idx] = job;
    } else {
      jobs.push(job);
    }

    jobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const trimmed = jobs.slice(0, JOB_RETENTION_COUNT);
    writeFileSync(this.jsonPath, JSON.stringify(trimmed, null, 2), "utf-8");
  }

  getById(jobId: string): BatchJobResult | null {
    if (this.db) {
      const stmt = this.db.prepare(`SELECT * FROM jobs WHERE id = ? LIMIT 1`);
      const row = stmt.get(jobId) as unknown as JobRow | undefined;
      return row ? this.rowToJob(row) : null;
    }

    const jobs = this.readJsonJobs();
    return jobs.find((item) => item.jobId === jobId) ?? null;
  }

  listRecent(limit = JOB_RETENTION_COUNT): BatchJobResult[] {
    if (this.db) {
      const stmt = this.db.prepare(`
        SELECT * FROM jobs
        ORDER BY datetime(started_at) DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit) as unknown as JobRow[];
      return rows.map((row) => this.rowToJob(row));
    }

    return this.readJsonJobs().slice(0, limit);
  }

  private rowToJob(row: JobRow): BatchJobResult {
    return {
      jobId: row.id,
      action: row.action as BatchJobResult["action"],
      status: row.status as BatchJobResult["status"],
      total: row.total,
      successCount: row.success_count,
      failedCount: row.failed_count,
      startedAt: row.started_at,
      finishedAt: row.finished_at ?? undefined,
      results: JSON.parse(row.results_json)
    };
  }

  private trimSqlite() {
    if (!this.db) {
      return;
    }

    this.db.exec(`
      DELETE FROM jobs
      WHERE id NOT IN (
        SELECT id FROM jobs ORDER BY datetime(started_at) DESC LIMIT ${JOB_RETENTION_COUNT}
      )
    `);
  }

  private ensureJsonFallback() {
    try {
      readFileSync(this.jsonPath, "utf-8");
    } catch {
      writeFileSync(this.jsonPath, "[]", "utf-8");
    }
  }

  private readJsonJobs(): BatchJobResult[] {
    this.ensureJsonFallback();
    const raw = readFileSync(this.jsonPath, "utf-8");
    try {
      return JSON.parse(raw) as BatchJobResult[];
    } catch {
      return [];
    }
  }
}
