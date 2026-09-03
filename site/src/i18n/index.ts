import en from './en.json';

// Every interface string lives in a locale file under src/i18n/, never in a component.
// Adding a language means adding one JSON file with the same keys and listing it here.
export type Lang = 'en';
export type Dict = Record<string, string>;
export const DICTS: Record<Lang, Dict> = { en };
export const DEFAULT_LANG: Lang = 'en';

export const t = (key: string, lang: Lang = DEFAULT_LANG): string => DICTS[lang][key] ?? DICTS[DEFAULT_LANG][key] ?? key;

export function currentLang(): Lang {
  return DEFAULT_LANG;
}
