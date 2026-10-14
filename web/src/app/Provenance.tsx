import { computeStats } from '../../../skills/consensus/scripts/result.mjs';
import { useI18n, type I18n } from './i18n';
import { CoreSpeedMark, RednoteMark, RedditMark, XMark } from './icons';

/** A result file (skills/consensus/references/result-format.md). Only fields the viewer reads are typed. */
export interface ResultFile {
  format: string;
  question: string;
  /** The language the report text is written in (BCP 47). Posts keep their own language. */
  language?: string;
  question_type: string;
  summary: string;
  created_at: string;
  window: { since: string | null; until: string | null };
  sources: ('reddit' | 'x' | 'rednote')[];
  options: { id: string; title: string; description?: string; why?: string; quotes?: { post: string; text: string }[] }[];
  other?: { why?: string; also_mentioned?: { title: string; count: number }[] };
  themes?: { id: string; title: string; description?: string }[];
  posts: { id: string; source: 'reddit' | 'x' | 'rednote'; kind?: string; url: string; text: string; author: string; created_at?: string; score?: number; community?: string; label: string; strength: number; themes?: string[] }[];
  coverage: {
    posts_read?: number;
    dropped_before_sorting?: { count: number; reasons?: string[] };
    reddit?: { searches?: number; threads_found?: number; threads_read?: number; comment_pages?: number; comments_read?: number; comments_total?: number };
    x?: { searches?: number; pages?: number; posts_returned?: number; posts_kept?: number; reply_threads?: number };
    rednote?: { searches?: number; pages?: number; notes_returned?: number; notes_kept?: number; comment_pages?: number; comments_read?: number };
    notes?: string[];
  };
  usage: {
    requests: number;
    failed?: number;
    credits_per_request: number;
    rates?: Record<string, number>;
    budget?: number;
    budget_by_source?: Partial<Record<'reddit' | 'x' | 'rednote', number>>;
    truncated?: number;
    by_tool?: Record<string, number>;
    failures?: Record<string, number>;
    unknown_charge?: number;
    unknown_by_tool?: Record<string, number>;
  };
  queries?: { tool: string; args?: Record<string, unknown>; result?: string; items?: number }[];
  analysis?: { by?: string; model?: string };
  limits?: string[];
}

/** A validator warning as { code, params } plus its English text, so it can be shown in the reader's language. */
export interface Issue {
  code: string;
  params: Record<string, string | number>;
  text: string;
}

const short = (tool: string) => tool.replace(/^mcp__\w+?__/, '');

/** One validator warning in the interface language. An unknown code falls back to the English text. */
function issueText(i: I18n, issue: Issue, titleOf: (label: string) => string): string {
  const p = issue.params ?? {};
  switch (issue.code) {
    case 'other_heavy':
      return i.t('issue_other_heavy', { pct: i.pct(Number(p.share) || 0) });
    case 'thread_option':
      return i.t('issue_thread_option', { ...p, title: titleOf(String(p.label)) });
    case 'over_budget':
    case 'funnel_mismatch':
    case 'funnel_unrecorded':
    case 'thin':
    case 'small_option':
    case 'theme_small':
    case 'long_description':
    case 'long_quote':
    case 'author_thread':
    case 'author_total':
    case 'thread_total':
    case 'missing_date':
    case 'avatar_unsafe':
    case 'empty_poll':
      return i.t(`issue_${issue.code}`, p);
    default:
      return issue.text;
  }
}

/** Where the numbers came from: what was read, what it cost, what it cannot tell. Every value is from the file. */
export function Provenance({ result: r, issues }: { result: ResultFile; issues: Issue[] }) {
  const i = useI18n();
  const { t, tp, num } = i;
  const s = computeStats(r);
  const cov = r.coverage ?? {};
  const lang = r.language || undefined;
  const since = i.day(r.window?.since);
  const until = i.day(r.window?.until) ?? t('window_until_now');
  const failed = r.usage.failed ?? 0;
  const titleOf = (label: string) => (label === 'other' ? t('other') : r.options.find((o) => o.id === label)?.title ?? label);
  const sources = i.list(r.sources.map((x) => t(`src_${x}`)));
  const rate = (tool: string) => r.usage.rates?.[tool] ?? r.usage.rates?.[short(tool)] ?? r.usage.credits_per_request;
  const split = r.usage.budget_by_source ? Object.entries(r.usage.budget_by_source).map(([x, n]) => `${t(`src_${x}`)} ${num(n ?? 0)}`).join(' · ') : '';
  const window = since ? t('window_range', { since, until }) : t('window_any');
  const failures = r.usage.failures && Object.keys(r.usage.failures).length ? Object.entries(r.usage.failures).map(([k, n]) => `${k} × ${num(n)}`).join(', ') : '';
  const reasons = cov.dropped_before_sorting?.reasons ?? [];
  return (
    <section className="provenance" aria-label={t('prov_aria')}>
      <div className="prov-grid">
        <div className="prov-block">
          <h2 className="eyebrow">{t('what_title')}</h2>
          <p>{t('what_body', { sources, window, date: i.date(r.created_at) })}</p>
          {r.analysis?.by && (
            <p className="muted small">
              {t('analysis_by', { by: r.analysis.model ? `${r.analysis.by} (${r.analysis.model})` : r.analysis.by })}
            </p>
          )}
          <ol className="funnel" aria-label={t('funnel_aria')}>
            <li>
              <b>{num(s.read)}</b> {t('funnel_read')}
            </li>
            {s.dropped > 0 && (
              <li title={reasons.join('; ')}>
                <b>{num(s.dropped)}</b> {t('funnel_dropped')}
              </li>
            )}
            <li>
              <b>{num(s.sorted)}</b> {t('funnel_sorted')}
            </li>
            <li>
              <b>{num(s.spam)}</b> {t('funnel_spam')}
            </li>
            <li>
              <b>{num(s.none)}</b> {t('funnel_none')}
            </li>
            <li className="on">
              <b>{num(s.counted)}</b> {t('funnel_counted')}
            </li>
          </ol>
        </div>

        <div className="prov-block">
          <h2 className="eyebrow">{t('coverage_title')}</h2>
          <ul className="prov-list">
            {cov.reddit && (
              <li>
                <span className="src-name">
                  <RedditMark size={13} /> Reddit
                </span>
                <span className="kv">
                  {t('cov_searches', { n: cov.reddit.searches ?? 0 })} · {t('cov_threads', { n: cov.reddit.threads_read ?? 0 })}
                  {cov.reddit.comments_read != null && <> · {cov.reddit.comments_total ? t('cov_comments_of', { n: cov.reddit.comments_read, total: cov.reddit.comments_total }) : t('cov_comments', { n: cov.reddit.comments_read })}</>}
                </span>
              </li>
            )}
            {cov.x && (
              <li>
                <span className="src-name">
                  <XMark size={11} /> X
                </span>
                <span className="kv">
                  {t('cov_searches', { n: cov.x.searches ?? 0 })} · {t('cov_pages', { n: cov.x.pages ?? 0 })}
                  {cov.x.posts_returned != null && <> · {t('cov_returned', { n: cov.x.posts_returned })}</>}
                  {cov.x.posts_kept != null && <> · {t('cov_kept', { n: cov.x.posts_kept })}</>}
                </span>
              </li>
            )}
            {cov.rednote && (
              <li>
                <span className="src-name">
                  <RednoteMark size={13} /> {t('src_rednote')}
                </span>
                <span className="kv">
                  {t('cov_searches', { n: cov.rednote.searches ?? 0 })} · {t('cov_pages', { n: cov.rednote.pages ?? 0 })}
                  {cov.rednote.notes_returned != null && <> · {t('cov_notes', { n: cov.rednote.notes_returned })}</>}
                  {cov.rednote.notes_kept != null && <> · {t('cov_kept', { n: cov.rednote.notes_kept })}</>}
                  {cov.rednote.comments_read != null && <> · {t('cov_comments', { n: cov.rednote.comments_read })}</>}
                </span>
              </li>
            )}
            {reasons.length > 0 && (
              <li>
                {t('cov_dropped')} <span lang={lang}>{reasons.join('; ')}</span>
              </li>
            )}
            {(cov.notes ?? []).map((n) => (
              <li key={n} lang={lang}>
                {n}
              </li>
            ))}
          </ul>
        </div>

        <div className="prov-block">
          <h2 className="eyebrow cs-heading">
            <CoreSpeedMark size={10} />
            {t('usage_title')}
          </h2>
          <p className="cost-line">{s.mixedRates ? t('cost_line_mixed', { requests: r.usage.requests, credits: s.credits }) : t('cost_line', { requests: r.usage.requests, rate: r.usage.credits_per_request, credits: s.credits })}</p>
          {r.usage.budget ? <p className="muted small">{t('budget', { budget: r.usage.budget })}</p> : null}
          {split ? <p className="muted small">{t('budget_split', { split })}</p> : null}
          {s.unknownCharge > 0 && <p className="cost-line upper">{tp('cost_upper', s.unknownCharge, { max: s.creditsMax })}</p>}
          {r.usage.by_tool && (
            <ul className="prov-list tools">
              {Object.entries(r.usage.by_tool).map(([tool, n]) => (
                <li key={tool}>
                  <code>{short(tool)}</code> {num(n)}
                  {s.mixedRates ? ` × ${num(rate(tool))}` : ''}
                </li>
              ))}
            </ul>
          )}
          {failed > 0 && <p className="muted small">{t('failed_line', { count: failed, details: failures || '–' })}</p>}
          {r.usage.truncated ? <p className="muted small">{t('truncated_line', { count: r.usage.truncated })}</p> : null}
          <p className="muted small">{t('estimate_note')}</p>
        </div>

        <div className="prov-block">
          <h2 className="eyebrow">{t('limits_title')}</h2>
          <ul className="prov-list">
            {(r.limits ?? []).map((l) => (
              <li key={l} lang={lang}>
                {l}
              </li>
            ))}
            <li>{t('verbatim_note')}</li>
            <li>{t('link_note')}</li>
            {issues.map((w, n) => (
              <li key={`${w.code}-${n}`} className="check">
                <b>{t('check_prefix')}</b> {issueText(i, w, titleOf)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {r.queries && r.queries.length > 0 && (
        <details className="queries">
          <summary>{t('queries', { count: r.queries.length })}</summary>
          <ol>
            {r.queries.map((q, n) => (
              <li key={n}>
                <code>{short(q.tool)}</code> <span className="q-args">{JSON.stringify(q.args ?? {})}</span>
                <span className="muted">
                  {' '}
                  → {q.result ?? 'ok'}
                  {q.items != null ? `, ${t('query_items', { count: q.items })}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <p className="follow-up">{t('follow_up')}</p>
    </section>
  );
}
