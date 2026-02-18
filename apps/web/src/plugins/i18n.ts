import { createI18n } from "vue-i18n";
import en from "../locales/en";
import ja from "../locales/ja";
import zhCN from "../locales/zh-CN";
import zhTW from "../locales/zh-TW";
import { detectPreferredLocale, type LocaleCode } from "../stores/ui";

const messages = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  en
} as const;

export const i18n = createI18n({
  legacy: false,
  locale: detectPreferredLocale(),
  fallbackLocale: "en",
  messages
});

export const isSupportedLocale = (value: string): value is LocaleCode => {
  return value === "zh-CN" || value === "zh-TW" || value === "ja" || value === "en";
};
