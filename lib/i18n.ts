import { en } from './locales/en';
import { hi } from './locales/hi';
import { ml } from './locales/ml';
import { ru } from './locales/ru';
import { es } from './locales/es';
import { fr } from './locales/fr';
import { pt } from './locales/pt';
import { de } from './locales/de';
import { ja } from './locales/ja';
import { ar } from './locales/ar';

export type Language = 'en' | 'hi' | 'ml' | 'ru' | 'es' | 'fr' | 'pt' | 'de' | 'ja' | 'ar';

export const LANGUAGES: { code: Language; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
];

const translations = {
  en,
  hi,
  ml,
  ru,
  es,
  fr,
  pt,
  de,
  ja,
  ar,
};

export function getTranslation(lang: Language) {
  return translations[lang] || translations.en;
}

export function t(key: keyof typeof en, lang: Language = 'en'): string {
  const translation = getTranslation(lang);
  return (translation as any)[key] || (en as any)[key] || key;
}
