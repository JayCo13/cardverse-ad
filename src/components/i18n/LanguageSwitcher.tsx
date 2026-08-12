'use client';

import { useLocalization } from '@/context/LocalizationContext';
import type { AdminLocale } from '@/utils/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocalization();
  return (
    <select
      aria-label="Language"
      value={locale}
      onChange={(event) => setLocale(event.target.value as AdminLocale)}
      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
    >
      <option value="en-US">English</option>
      <option value="vi-VN">Tiếng Việt</option>
      <option value="ja-JP">日本語</option>
    </select>
  );
}
