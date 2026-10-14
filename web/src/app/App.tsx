import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, Languages } from 'lucide-react';
import { toViewerState, validateResult } from '../../../skills/consensus/scripts/result.mjs';
import { download, headline, slug, toCsv } from './format';
import { I18nProvider, LanguageSelect, matchLocale, NATIVE_NAME, useI18n } from './i18n';
import { LogoMark } from './icons';
import { Provenance, type Issue, type ResultFile } from './Provenance';
import { Results } from './Results';
import { ThemeProvider, ThemeSwitch } from './theme';
import type { SearchState } from './useSearch';
import './app.css';
import './viewer.css';

/*
 * The Consensus results screen as a static viewer (CoreSpeed edition). A host agent collects posts through its
 * CoreSpeed MCP connection, sorts them with its own model, and writes a result file; `consensus.mjs render` embeds
 * that file in this page. Nothing here searches, calls a model, or fetches data in a built page.
 */
const REPO = 'https://github.com/corespeed-io/consensus';
const CORESPEED = 'https://corespeed.io/?utm_source=consensus&utm_medium=viewer&utm_campaign=consensus_skill';

type Loaded = { kind: 'none' } | { kind: 'invalid'; errors: string[] } | { kind: 'ok'; result: ResultFile; state: SearchState; issues: Issue[] };

function readEmbedded(): unknown {
  const el = document.getElementById('consensus-result');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent || 'null');
  } catch {
    return { __unreadable: true };
  }
}

function load(raw: unknown): Loaded {
  if (raw == null) return { kind: 'none' };
  if ((raw as { __unreadable?: boolean }).__unreadable) return { kind: 'invalid', errors: ['The embedded result is not valid JSON.'] };
  const v = validateResult(raw);
  if (v.errors.length) return { kind: 'invalid', errors: v.errors };
  const issues = v.issues.map((x, i) => ({ ...x, text: v.warnings[i] ?? '' }));
  return { kind: 'ok', result: raw as ResultFile, state: toViewerState(raw) as unknown as SearchState, issues };
}

/** Dev only: `npm run viewer:dev` then /?data=/examples/<file>.json (same-origin paths only). */
function useResult(): Loaded {
  const embedded = useMemo(() => load(readEmbedded()), []);
  const [dev, setDev] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV || embedded.kind !== 'none') return;
    const path = new URLSearchParams(location.search).get('data');
    if (!path || !/^\/[\w./-]+\.json$/.test(path) || path.includes('..')) return;
    fetch(path)
      .then((r) => r.json())
      .then((j) => setDev(load(j)))
      .catch(() => setDev({ kind: 'invalid', errors: [`Could not load ${path}`] }));
  }, [embedded.kind]);
  return dev ?? embedded;
}

/** CSV keeps the file's own labels and text: it is data for a spreadsheet, not interface text. */
function exportCsv(r: ResultFile) {
  const titles = Object.fromEntries(r.options.map((o) => [o.id, o.title]));
  const rows = [['answer', 'label', 'strength', 'source', 'author', 'community', 'text', 'score', 'url', 'created_at']];
  for (const p of r.posts) rows.push([titles[p.label] ?? p.label, p.label, String(p.strength), p.source, p.author, p.community ?? '', p.text, String(p.score ?? ''), p.url, p.created_at ?? '']);
  download(`${slug(r.question)}.csv`, toCsv(rows));
}

/** Upstream's sponsor strip slot, now an honest attribution: what CoreSpeed did for this page. */
function PoweredStrip() {
  const { t } = useI18n();
  return (
    <a className="powered" href={CORESPEED} target="_blank" rel="noopener noreferrer" aria-label={t('strip_aria')}>
      <span className="pw-by">
        <span className="pw-pre">{t('strip_pre')}</span>
        <b className="pw-name">CoreSpeed</b>
      </span>
      <span className="pw-mid">
        <span className="pw-offer">{t('strip_offer')}</span>
        <span className="pw-note">{t('strip_note')}</span>
      </span>
      <span className="pw-cta">
        {t('strip_cta')} <ArrowRight size={14} aria-hidden="true" />
      </span>
    </a>
  );
}

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  const { t, tx } = useI18n();
  return (
    <div className="canvas">
      <div className="sky" aria-hidden="true" />
      <PoweredStrip />
      <div className="app">
        <header className="topbar">
          <div className="topbar-in">
            <span className="wordmark" aria-label="Consensus">
              <LogoMark className="wordmark-logo" size={22} />
              <span className="wordmark-full">Consensus</span>
            </span>
            <span className="edition-tag">{t('edition')}</span>
            <span className="top-actions">
              {right}
              <LanguageSelect />
              <ThemeSwitch />
            </span>
          </div>
        </header>
        <main>{children}</main>
        <footer className="viewer-foot">
          <p>
            {tx('foot_made', {
              skill: <a href={REPO}>{t('foot_skill')}</a>,
              consensus: <a href="https://github.com/Straitly-ai/consensus">Consensus</a>,
            })}
          </p>
          <p>{tx('foot_run', { corespeed: <a href={CORESPEED}>CoreSpeed</a> })}</p>
        </footer>
      </div>
    </div>
  );
}

/**
 * The report is written once, in one language (result.language). The interface can be switched; when it differs
 * from the report, say so plainly instead of pretending the page is translated.
 */
function ReportLanguageNote({ language }: { language?: string }) {
  const i = useI18n();
  if (language && matchLocale(language) === i.locale) return null;
  return (
    <p className="lang-note" role="note" aria-label={i.t('report_lang_aria')}>
      <Languages size={15} aria-hidden="true" />
      <span>{language ? i.t('report_lang_note', { language: i.language(language), ui: NATIVE_NAME[i.locale] }) : i.t('report_lang_unknown')}</span>
    </p>
  );
}

function App() {
  const loaded = useResult();
  const i = useI18n();
  const { t, tp, tx } = i;
  useEffect(() => {
    if (loaded.kind === 'ok') document.title = `${headline(loaded.result.question)} · Consensus`;
  }, [loaded]);

  if (loaded.kind === 'none')
    return (
      <Shell>
        <div className="state-panel">
          <h2>{t('empty_title')}</h2>
          <p>
            {tx('empty_body', {
              file: <code>consensus-result.json</code>,
              command: <code>node scripts/consensus.mjs render consensus-result.json --open</code>,
            })}
          </p>
        </div>
      </Shell>
    );
  if (loaded.kind === 'invalid')
    return (
      <Shell>
        <div className="state-panel invalid">
          <h2>{t('invalid_title')}</h2>
          <p>{t('invalid_body')}</p>
          <p className="muted small">{t('invalid_details')}</p>
          <ul className="error-list" lang="en">
            {loaded.errors.slice(0, 30).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      </Shell>
    );

  const { result, state } = loaded;
  const lang = result.language || undefined;
  return (
    <Shell right={<span className="snapshot-tag">{t('snapshot', { date: i.date(result.created_at) })}</span>}>
      {result.summary && (
        <section className="summary-band" aria-label={t('summary_aria')}>
          <p lang={lang}>{result.summary}</p>
          <span className="summary-meta">{tp('summary_meta', state.poll?.total_opinions ?? 0)}</span>
          <ReportLanguageNote language={lang} />
        </section>
      )}
      {!result.summary && <ReportLanguageNote language={lang} />}
      <Results
        state={state}
        query={result.question}
        reportLang={lang}
        tools={
          <button className="icon-btn tool" onClick={() => exportCsv(result)} data-tip={t('csv_tip')} aria-label={t('csv')}>
            <Download size={16} />
          </button>
        }
      />
      <Provenance result={result} issues={loaded.issues} />
    </Shell>
  );
}

export default function Root() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </I18nProvider>
  );
}
