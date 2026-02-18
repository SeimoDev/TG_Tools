import { wait } from "./wait.js";

export const isFloodWaitError = (error: unknown): error is { seconds: number } => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { seconds?: unknown; message?: unknown; errorMessage?: unknown };
  if (typeof candidate.seconds === "number" && Number.isFinite(candidate.seconds)) {
    return true;
  }

  const msg = String(candidate.errorMessage ?? candidate.message ?? "");
  return msg.includes("FLOOD_WAIT");
};

export const getFloodWaitSeconds = (error: unknown): number => {
  if (error && typeof error === "object") {
    const candidate = error as { seconds?: unknown; message?: unknown; errorMessage?: unknown };

    if (typeof candidate.seconds === "number" && Number.isFinite(candidate.seconds)) {
      return Math.max(1, Math.ceil(candidate.seconds));
    }

    const msg = String(candidate.errorMessage ?? candidate.message ?? "");
    const match = msg.match(/FLOOD_WAIT_(\d+)/);
    if (match) {
      return Math.max(1, Number(match[1]));
    }
  }

  return 1;
};

export const retryWithFloodWait = async <T>(fn: () => Promise<T>): Promise<T> => {
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isFloodWaitError(error)) {
        throw error;
      }

      const seconds = getFloodWaitSeconds(error);
      await wait(seconds * 1000);
    }
  }
};

export const isAuthError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { message?: unknown; errorMessage?: unknown };
  const msg = String(candidate.errorMessage ?? candidate.message ?? "");

  return (
    msg.includes("AUTH_KEY_UNREGISTERED") ||
    msg.includes("SESSION_REVOKED") ||
    msg.includes("SESSION_EXPIRED") ||
    msg.includes("USER_DEACTIVATED")
  );
};

export const normalizeError = (error: unknown): { code: string; message: string } => {
  if (error instanceof Error) {
    const anyErr = error as Error & { errorMessage?: string };
    return {
      code: anyErr.errorMessage ?? error.name,
      message: error.message
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: String(error)
  };
};
