import { randomUUID } from "node:crypto";
import type { BatchAction, BatchJobResult, BatchResultItem, EntityItem } from "@tg-tools/shared";

export const createJob = (action: BatchAction, items: EntityItem[]): BatchJobResult => ({
  jobId: randomUUID(),
  action,
  status: "PENDING",
  total: items.length,
  successCount: 0,
  failedCount: 0,
  startedAt: new Date().toISOString(),
  results: []
});

export const aggregateResults = (job: BatchJobResult, results: BatchResultItem[], failed = false): BatchJobResult => {
  const successCount = results.filter((item) => item.ok).length;
  const failedCount = results.length - successCount;

  return {
    ...job,
    status: failed ? "FAILED" : "DONE",
    successCount,
    failedCount,
    finishedAt: new Date().toISOString(),
    results
  };
};
