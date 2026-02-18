import { localizeError } from "./errorI18n";

export const toErrorMessage = (error: unknown): string => {
  return localizeError(error);
};
