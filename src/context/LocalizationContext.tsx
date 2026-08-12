'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { adminTranslations, type AdminLocale, type AdminTranslationKey } from '@/utils/i18n';

const STORAGE_KEY = 'cardverse-admin-locale';

type LocalizationContextValue = {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (key: AdminTranslationKey, variables?: Record<string, string | number>) => string;
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

function browserLocale(): AdminLocale {
  const language = navigator.language.toLowerCase();
  if (language.startsWith('vi')) return 'vi-VN';
  if (language.startsWith('ja')) return 'ja-JP';
  return 'en-US';
}

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<AdminLocale>('en-US');

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const selected = stored === 'vi-VN' || stored === 'ja-JP' || stored === 'en-US'
      ? stored
      : browserLocale();
    document.documentElement.lang = selected;
    const frame = window.requestAnimationFrame(() => updateLocale(selected));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setLocale = useCallback((nextLocale: AdminLocale) => {
    updateLocale(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    document.documentElement.lang = nextLocale;
  }, []);

  const t = useCallback((key: AdminTranslationKey, variables?: Record<string, string | number>) => {
    let value: string = adminTranslations[locale][key] || adminTranslations['en-US'][key];
    for (const [name, replacement] of Object.entries(variables || {})) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used within LocalizationProvider');
  return context;
}
