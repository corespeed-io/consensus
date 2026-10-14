import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import messages from './messages.json';

/*
 * Interface text in four languages. The dictionaries are static and ship inside the viewer bundle, so switching
 * language never calls a model or the network. Only interface text is translated: the report (question, summary,
 * answers, themes) stays in the language the agent wrote it in, and posts stay verbatim.
 */
export const LOCALES = ['en', 'zh', 'ja', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];
export type MessageKey = keyof (typeof messages)['en'];
type Dict = Partial<Record<string, string>>;

/** Each language named in itself, so a reader finds theirs whatever is showing. */
export const NATIVE_NAME: Record<Locale, string> = { en: 'English', zh: '简体中文', ja: '日本語', ko: '한국어' };
/** The html lang value: zh is Simplified Chinese, so CJK fonts pick the right glyphs. */
export const HTML_LANG: Record<Locale, string> = { en: 'en', zh: 'zh-Hans', ja: 'ja', ko: 'ko' };
/** The tag handed to Intl for dates, numbers and plurals. */
const INTL: Record<Locale, string> = { en: 'en', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR' };
export const STORAGE_KEY = 'consensus.locale';
const DICTS = messages as Record<Locale, Dict>;

/** Maps a BCP 47 tag to a supported locale: any Chinese tag to zh (the only Chinese dictionary), else by language. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  const base = String(tag ?? '').trim().toLowerCase().split(/[-_]/)[0];
  return (LOCALES as readonly string[]).includes(base!) ? (base as Locale) : null;
}

function readStored(): Locale | null {
  try {
    return matchLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage blocked (sandboxed frame, some file:// setups, privacy modes)
  }
}

function store(l: Locale): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, l);
    return true;
  } catch {
    return false;
  }
}

/** ?lang= first (shareable), then the reader's saved choice, then the browser's languages, then English. */
export function detectLocale(): Locale {
  let fromUrl: Locale | null = null;
  try {
    fromUrl = matchLocale(new URLSearchParams(window.location.search).get('lang'));
  } catch {
    /* no usable URL */
  }
  if (fromUrl) return fromUrl;
  const saved = readStored();
  if (saved) return saved;
  const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  for (const l of langs) {
    const m = matchLocale(l);
    if (m) return m;
  }
  return 'en';
}

type Params = Record<string, string | number | null | undefined>;

/** Looks a key up in the locale, then English; a key missing from both shows as itself so the gap is visible. */
export function lookup(locale: Locale, key: string): string {
  return DICTS[locale]?.[key] ?? DICTS.en[key] ?? key;
}

/** The plural form for `count` in this locale (Intl rules), falling back to `_other`, then English. */
export function pluralKey(locale: Locale, key: string, count: number): string {
  const rule = new Intl.PluralRules(INTL[locale]).select(count);
  for (const k of [`${key}_${rule}`, `${key}_other`]) if (DICTS[locale]?.[k] != null) return k;
  const en = new Intl.PluralRules('en').select(count);
  return DICTS.en[`${key}_${en}`] != null ? `${key}_${en}` : `${key}_other`;
}

export function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

export interface I18n {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** False when the browser refused storage: the choice then lasts until the page is closed. */
  persisted: boolean;
  t: (key: MessageKey | string, params?: Params) => string;
  /** Plural-aware: picks `${key}_one`, `${key}_other`, ... for `count` (also passed as {count}). */
  tp: (key: string, count: number, params?: Params) => string;
  /** Like t, but placeholders may be React nodes (links, code). */
  tx: (key: MessageKey | string, parts: Record<string, ReactNode>) => ReactNode;
  num: (n: number) => string;
  compact: (n: number | null | undefined) => string;
  pct: (share: number) => string;
  date: (iso: string | null | undefined) => string;
  /** A YYYY-MM-DD window bound, read in UTC so it never shifts by a day. */
  day: (ymd: string | null | undefined) => string | null;
  dateTime: (iso: string | null | undefined) => string;
  language: (tag: string) => string;
  list: (items: string[]) => string;
}

export function makeI18n(locale: Locale, setLocale: (l: Locale) => void = () => {}, persisted = true): I18n {
  const tag = INTL[locale];
  const nf = new Intl.NumberFormat(tag);
  const cf = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 });
  const pf = new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: 0 });
  const df = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric' });
  const dfUtc = new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const dtf = new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' });
  const lf = new Intl.ListFormat(tag, { style: 'long', type: 'conjunction' });
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([tag], { type: 'language' });
  } catch {
    names = null;
  }
  const fill = (text: string, params: Params = {}) =>
    text.replace(/\{(\w+)\}/g, (m, k: string) => {
      const v = params[k];
      if (v == null) return m;
      return typeof v === 'number' ? nf.format(v) : v;
    });
  const valid = (iso: string | null | undefined) => (iso && !Number.isNaN(Date.parse(iso)) ? new Date(iso) : null);
  return {
    locale,
    setLocale,
    persisted,
    t: (key, params) => fill(lookup(locale, key), params),
    tp: (key, count, params) => fill(lookup(locale, pluralKey(locale, key, count)), { count, ...params }),
    tx: (key, parts) => {
      const text = lookup(locale, key);
      const out: ReactNode[] = [];
      let last = 0;
      for (const m of text.matchAll(/\{(\w+)\}/g)) {
        out.push(text.slice(last, m.index));
        out.push(<Fragment key={`${m[1]}-${m.index}`}>{parts[m[1]!] ?? m[0]}</Fragment>);
        last = m.index! + m[0].length;
      }
      out.push(text.slice(last));
      return out;
    },
    num: (n) => nf.format(n),
    compact: (n) => cf.format(n ?? 0),
    pct: (share) => (share > 0 && share < 0.005 ? `<${pf.format(0.01)}` : pf.format(share)),
    date: (iso) => {
      const d = valid(iso);
      return d ? df.format(d) : '';
    },
    day: (ymd) => (ymd && /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? dfUtc.format(new Date(`${ymd}T00:00:00Z`)) : null),
    dateTime: (iso) => {
      const d = valid(iso);
      return d ? dtf.format(d) : '';
    },
    language: (code) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    },
    list: (items) => lf.format(items),
  };
}

const Ctx = createContext<I18n>(makeI18n('en'));

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(() => initial ?? detectLocale());
  const [persisted, setPersisted] = useState(true);
  const setLocale = (l: Locale) => {
    setLocaleState(l);
    setPersisted(store(l));
  };
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[locale];
  }, [locale]);
  const value = useMemo(() => makeI18n(locale, setLocale, persisted), [locale, persisted]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** A native <select>: keyboard, screen readers and mobile pickers work without extra code. */
export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="lang-select">
      <span className="sr-only">{t('language')}</span>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">
        <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3.6 9h16.8M3.6 15h16.8M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3" />
      </svg>
      <select value={locale} onChange={(e) => setLocale(matchLocale(e.target.value) ?? 'en')} aria-label={t('language')}>
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={HTML_LANG[l]}>
            {NATIVE_NAME[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
