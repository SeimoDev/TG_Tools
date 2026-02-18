import axios from "axios";

export const toErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    return message || error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};
