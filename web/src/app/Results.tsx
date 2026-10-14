import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, SearchX, X as XIcon } from 'lucide-react';
import { SOURCE_ORDER, type Post, type PollOption, type Source, type Theme } from './api';
import { Donut } from './Donut';
import { alpha, headline, MIN_FOR_SHARES, optionColor } from './format';
import { useI18n } from './i18n';
import { SourceIcon } from './icons';
import { cleanPostText } from './postText';
import { PostRow } from './Posts';
import type { SearchState } from './useSearch';
import { useMedia } from './useMedia';

/*
 * The original Consensus results screen, kept for a finished snapshot: no live search, no leads tab. Interface text
 * comes from the static dictionaries; the question, answers, reasons and themes are the report's own words and carry
 * its language (`reportLang`) so screen readers and fonts treat them correctly.
 */
type Sort = 'relevance' | 'score' | 'new';
/** `picked` value for the "All opinions" view: every counted opinion, across options. */
const ALL = '*';
const SORTS: { id: Sort; key: string }[] = [
  { id: 'relevance', key: 'sort_relevance' },
  { id: 'score', key: 'sort_score' },
  { id: 'new', key: 'sort_new' },
];

/** A finished poll that should be read as rough: few opinions, mostly Other, a single real answer, or backend flags. */
export function isThin(s: SearchState): boolean {
  const poll = s.poll;
  if (s.phase !== 'done' || !poll || poll.total_opinions === 0) return false;
  if (s.done?.status === 'thin' || (s.done?.quality?.flags?.length ?? 0) > 0) return true;
  const real = poll.options.filter((o) => !o.is_other && o.count > 0);
  const other = poll.options.find((o) => o.is_other);
  return real.length <= 1 || (other?.percent ?? 0) >= 60;
}

/** Relevance (on-topic x stance x engagement) when present; otherwise rank. */
const relevance = (p: Post) => (p as Post & { relevance?: number }).relevance ?? p.rank;
const sorters: Record<Sort, (a: Post, b: Post) => number> = {
  relevance: (a, b) => relevance(b) - relevance(a) || b.score - a.score,
  score: (a, b) => b.score - a.score || b.rank - a.rank,
  new: (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
};

/** The title and description a reader sees: "Other" is interface text; every other answer is the report's. */
function useOptionText() {
  const { t } = useI18n();
  return (o: PollOption | undefined) => (o ? { title: o.is_other ? t('other') : o.title, description: o.description || (o.is_other ? t('other_desc') : ''), own: !o.is_other } : { title: '', description: '', own: false });
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const { t, num } = useI18n();
  if (pages <= 1) return null;
  const nums: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  return (
    <nav className="pager" aria-label={t('pages')}>
      <button className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('prev_page')} data-tip={t('prev')}>
        <ChevronLeft size={16} />
      </button>
      {nums.map((n, i) =>
        n === '…' ? (
          <span key={`e${i}`} className="pager-gap">
            …
          </span>
        ) : (
          <button key={n} className={`pager-num ${n === page ? 'on' : ''}`} onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>
            {num(n)}
          </button>
        ),
      )}
      <button className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('next_page')} data-tip={t('next')}>
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

function SortMenu({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open]);
  const label = t(SORTS.find((x) => x.id === value)!.key);
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="chip-btn sort-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <ArrowUpDown size={14} className="sort-ic" aria-hidden="true" />
        <span className="chip-label">
          <span className="sort-pre">{t('sort')} </span>
          {label}
        </span>
        <ChevronDown size={14} className="chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu right" role="menu">
          {SORTS.map(({ id, key }) => (
            <button key={id} className="menu-item" role="menuitemradio" aria-checked={value === id} onClick={() => (onChange(id), setOpen(false))}>
              {t(key)}
              {value === id && <Check size={15} className="menu-check" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend({ options, selected, onSelect, hovered, onHover, total, reportLang }: { options: PollOption[]; selected: string | null; onSelect: (id: string) => void; hovered: string | null; onHover: (id: string | null) => void; total: number; reportLang?: string }) {
  const { t, num, pct } = useI18n();
  const text = useOptionText();
  const shares = total >= MIN_FOR_SHARES;
  return (
    <div className="legend" role="listbox" aria-label={t('answers')}>
      {options.map((o) => {
        const c = optionColor(o.id);
        const on = o.id === selected;
        const { title, description, own } = text(o);
        return (
          <button
            key={o.id}
            role="option"
            aria-selected={on}
            className={`legend-row ${on ? 'on' : ''} ${hovered === o.id ? 'hot' : ''}`}
            style={{ ['--c' as string]: c, ['--ct' as string]: alpha(c, 0.14) }}
            onClick={() => onSelect(o.id)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(o.id)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
            title={description}
          >
            <span className="dot" />
            <span className="legend-title" lang={own ? reportLang : undefined}>
              {title}
            </span>
            <span className="legend-pct">{shares && o.count ? pct(o.count / Math.max(1, total)) : ''}</span>
            <span className="legend-count">{num(o.count)}</span>
          </button>
        );
      })}
      <button type="button" role="option" aria-selected={!selected} className={`legend-row legend-all ${!selected ? 'on' : ''}`} onClick={() => onSelect(ALL)}>
        <span className="dot" />
        <span className="legend-title">{t('all_opinions')}</span>
        <span className="legend-total">{num(total)}</span>
      </button>
    </div>
  );
}

/**
 * Keeps a box at the tallest height it has reached, so switching answers never pulls the page up under the
 * reader. A user action (new `reset` value) lets it size freely again.
 */
function useNoShrink<T extends HTMLElement>(reset?: unknown) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    el.style.minHeight = '';
    let max = 0;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      if (h > max + 0.5) {
        max = h;
        el.style.minHeight = `${h}px`;
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [reset]);
  return ref;
}

/** Themes behind the selected answer (or every answer in All): specific arguments, ranked by how many voters make them. */
function Themes({ themes, option, all, posts, active, onPick, reportLang }: { themes: Theme[]; option: PollOption | undefined; all?: Set<string>; posts: Record<string, Post>; active: string | null; onPick: (id: string | null) => void; reportLang?: string }) {
  const { t, num } = useI18n();
  if (!option && !all) return null;
  const inScope = (id: string) => {
    const o = posts[id]?.option;
    return !!o && (option ? o === option.id : all!.has(o));
  };
  // Counted from the loaded posts, the same set the list filters on, so a row's count always equals the list it opens.
  const rows = themes
    .map((th) => ({ th, n: th.post_ids.reduce((a, id) => a + (inScope(id) ? 1 : 0), 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);
  if (!rows.length) return null;
  const max = rows[0]!.n;
  // One short example for the open theme, from a voter in scope (the theme's own quotes first, then its best post).
  const example = (th: Theme) => {
    const q = th.quotes.find((x) => inScope(x.post_id));
    const p = posts[q?.post_id ?? th.post_ids.find(inScope) ?? ''];
    if (!p) return null;
    const raw = cleanPostText(q?.text || (p.thread_title && p.text.startsWith(p.thread_title) ? p.text.slice(p.thread_title.length) : p.text) || p.text).replace(/\s+/g, ' ');
    const text = raw.length > 180 ? `${raw.slice(0, 180).replace(/\s+\S*$/, '')}…` : raw;
    return { text, source: p.source, who: p.source === 'reddit' ? `u/${p.author.handle}` : p.source === 'x' ? `@${p.author.handle}` : p.author.name || p.author.handle };
  };
  const c = option ? optionColor(option.id) : 'var(--ink-2)';
  return (
    <section className={`themes ${option ? '' : 'all'}`} style={{ ['--c' as string]: c }} aria-label={t('themes_label')}>
      <div className="why-label">{t('themes_label')}</div>
      <ul>
        {rows.map(({ th, n }) => {
          const on = active === th.id;
          const ex = on ? example(th) : null;
          return (
            <li key={th.id}>
              <button type="button" className={on ? 'on' : ''} aria-pressed={on} aria-expanded={on} onClick={() => onPick(on ? null : th.id)} title={th.description}>
                <span className="th-top">
                  <span className="th-title" lang={reportLang}>
                    {th.title}
                  </span>
                  <span className="th-n">{num(n)}</span>
                </span>
                <span className="th-bar">
                  <span style={{ width: `${Math.max(4, (100 * n) / max)}%` }} />
                </span>
                {ex && (
                  <span className="th-quote">
                    <span className="th-quote-text">“{ex.text}”</span>
                    <span className="th-quote-by">
                      <SourceIcon source={ex.source} size={12} />
                      {ex.who}
                    </span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Why({ option, summary, reportLang }: { option: PollOption | undefined; summary: string | undefined; reportLang?: string }) {
  const { t } = useI18n();
  const text = useOptionText()(option);
  const c = optionColor(option?.id);
  return (
    <section className="why" style={{ ['--c' as string]: c, ['--ct' as string]: alpha(c, option ? 0.13 : 0) }}>
      <div className="why-label">{option ? t('why_label', { option: text.title }) : t('why_generic')}</div>
      {summary ? (
        <blockquote className="why-quote" key={summary} lang={reportLang}>
          “{summary}”
        </blockquote>
      ) : (
        <p className="why-none" key={option?.id} lang={text.own || option?.description ? reportLang : undefined}>
          {text.description || ' '}
        </p>
      )}
    </section>
  );
}

/**
 * Source switches. They narrow what this page shows to posts the run already collected: no fetch, no model, no
 * credits. Only sources the run collected appear, so a source never looks as if it had results it does not have.
 */
function SourceSwitch({ collected, active, counts, onToggle }: { collected: Source[]; active: Set<Source>; counts: Record<Source, number>; onToggle: (s: Source) => void }) {
  const { t, num } = useI18n();
  return (
    <fieldset className="source-switch" aria-describedby="source-switch-hint">
      <legend>{t('sources_label')}</legend>
      <div className="ss-row">
        {collected.map((s) => {
          const on = active.has(s);
          const last = on && active.size === 1;
          return (
            <label key={s} className={`ss-chip ${on ? 'on' : ''} ${last ? 'locked' : ''}`} title={last ? t('source_keep') : undefined}>
              <input type="checkbox" checked={on} onChange={() => !last && onToggle(s)} aria-disabled={last || undefined} />
              <SourceIcon source={s} size={14} />
              <span className="ss-name">{t(`src_${s}`)}</span>
              <span className="ss-n">{num(counts[s] ?? 0)}</span>
            </label>
          );
        })}
      </div>
      <p className="ss-hint" id="source-switch-hint">
        {t('sources_hint')}
      </p>
    </fieldset>
  );
}

/** Counts per answer and source: each source is its own sample, so the columns are read side by side. */
function BySource({ options, collected, active, reportLang }: { options: PollOption[]; collected: Source[]; active: Set<Source>; reportLang?: string }) {
  const { t, num } = useI18n();
  const text = useOptionText();
  const totals = Object.fromEntries(collected.map((s) => [s, options.reduce((a, o) => a + (o.by_source[s] ?? 0), 0)])) as Record<Source, number>;
  return (
    <div className="by-source">
      <table>
        <caption>{t('by_source_title')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('by_source_answer')}</th>
            {collected.map((s) => (
              <th scope="col" key={s} className={active.has(s) ? '' : 'off'}>
                <SourceIcon source={s} size={12} /> {t(`src_${s}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options.map((o) => {
            const tt = text(o);
            return (
              <tr key={o.id}>
                <th scope="row" style={{ ['--c' as string]: optionColor(o.id) }}>
                  <span className="dot" aria-hidden="true" />
                  <span lang={tt.own ? reportLang : undefined}>{tt.title}</span>
                </th>
                {collected.map((s) => (
                  <td key={s} className={active.has(s) ? '' : 'off'}>
                    {num(o.by_source[s] ?? 0)}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr className="total">
            <th scope="row">{t('by_source_total')}</th>
            {collected.map((s) => (
              <td key={s} className={active.has(s) ? '' : 'off'}>
                {num(totals[s])}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="by-source-note">{t('by_source_note')}</p>
    </div>
  );
}

function Caption({ state, shown, sources }: { state: SearchState; shown: number; sources: string | null }) {
  const i = useI18n();
  const poll = state.poll!;
  const read = poll.scanned?.total || poll.pool?.collected || 0;
  const savedOn = state.meta?.saved_at ? i.date(state.meta.saved_at) : null;
  return (
    <p className="caption">
      <span className="cap-text">
        {sources ? i.t('caption_filtered', { shown, counted: poll.total_opinions, sources }) : i.tp('caption_counted', poll.total_opinions, { counted: poll.total_opinions, read })}
        {savedOn && <span className="cap-time"> · {i.t('caption_snapshot', { date: savedOn })}</span>}
      </span>
    </p>
  );
}

export function Results({ state, query, tools, reportLang }: { state: SearchState; query: string; tools?: React.ReactNode; reportLang?: string }) {
  const i = useI18n();
  const { t, num } = i;
  const optionText = useOptionText();
  const desktop = useMedia('(min-width: 1100px)');
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const collected = useMemo(() => SOURCE_ORDER.filter((x) => state.meta?.sources?.includes(x)), [state.meta?.sources]);
  const [active, setActive] = useState<Set<Source>>(() => new Set(collected));
  const [sort, setSort] = useState<Sort>('relevance');
  const [page, setPage] = useState(1);
  const [themeId, setThemeId] = useState<string | null>(null);
  const listTop = useRef<HTMLDivElement>(null);

  const poll = state.poll;
  const filtered = active.size < collected.length;
  // Counts follow the selected sources; colours follow the option id, so a filter never repaints an answer.
  const allOptions = (poll?.options ?? []).filter((o) => !(o.is_other && o.count === 0));
  const options = allOptions.map((o) => ({ ...o, count: collected.reduce((a, x) => a + (active.has(x) ? o.by_source[x] ?? 0 : 0), 0) })).filter((o) => !(o.is_other && o.count === 0));
  const perSource = Object.fromEntries(collected.map((x) => [x, allOptions.reduce((a, o) => a + (o.by_source[x] ?? 0), 0)])) as Record<Source, number>;
  const activeNames = i.list(collected.filter((x) => active.has(x)).map((x) => t(`src_${x}`)));
  const toggle = (x: Source) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(x)) next.delete(x);
      else next.add(x);
      return next.size ? next : prev;
    });
    setPage(1);
    setThemeId(null);
  };
  // null = "All opinions". Before the reader picks, the first answer with votes is shown.
  const allView = picked === ALL;
  const selected = allView ? null : picked && options.some((o) => o.id === picked) ? picked : options.find((o) => o.count > 0)?.id ?? options[0]?.id ?? null;
  const option = options.find((o) => o.id === selected);
  const optionIds = useMemo(() => new Set(options.map((o) => o.id)), [options.map((o) => o.id).join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const inView = (p: Post) => active.has(p.source) && (selected ? p.option === selected : !!p.option && optionIds.has(p.option));
  const legendBox = useNoShrink<HTMLDivElement>(picked);
  const whyBox = useNoShrink<HTMLDivElement>(picked);

  const allPosts = useMemo(() => Object.values(state.posts), [state.postsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  /** Posts from the selected sources only: what the themes count and the list shows. */
  const activePosts = useMemo(() => Object.fromEntries(allPosts.filter((p) => active.has(p.source)).map((p) => [p.id, p])), [allPosts, active]);
  const theme = themeId ? state.themes.find((x) => x.id === themeId) ?? null : null;
  const themeSet = useMemo(() => (theme ? new Set(theme.post_ids) : null), [theme]);
  const list = useMemo(() => allPosts.filter((p) => inView(p) && (!themeSet || themeSet.has(p.id))).sort(sorters[sort]), [allPosts, active, selected, optionIds, sort, themeSet]); // eslint-disable-line react-hooks/exhaustive-deps

  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(list.length / pageSize));
  const cur = Math.min(page, pages);
  const listKey = `${[...active].join()}-${selected ?? ALL}-${sort}-${themeId}-${cur}`;
  const shown = list.slice((cur - 1) * pageSize, cur * pageSize);
  const go = (p: number) => {
    setPage(p);
    const el = listTop.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const select = (id: string) => {
    // Clicking the answer already shown opens every opinion; clicking All (or an answer) narrows again.
    setPicked(id !== ALL && id === selected ? ALL : id);
    setThemeId(null);
    setPage(1);
  };

  const title = headline(query || state.meta?.query || '');

  if (state.phase === 'error')
    return (
      <div className="state-panel">
        <AlertCircle size={28} aria-hidden="true" />
        <h2>{t('error_title')}</h2>
        <p lang="en">{state.error?.message}</p>
      </div>
    );

  if (!poll || poll.total_opinions === 0)
    return (
      <div className="state-panel">
        <SearchX size={28} aria-hidden="true" />
        <h2>{t('none_title')}</h2>
        <p>{t('none_body', { question: title })}</p>
      </div>
    );

  const allTotal = options.reduce((a, o) => a + o.count, 0);
  const optText = optionText(option);

  return (
    <div className="results">
      <aside className="poll-col">
        <div className="q-head">
          <div className="eyebrow">{t('question')}</div>
          {tools && <div className="q-tools">{tools}</div>}
        </div>
        <h1 className="q-title" lang={reportLang}>
          {title}
        </h1>
        <Caption state={state} shown={allTotal} sources={filtered ? activeNames : null} />
        {collected.length > 1 && <SourceSwitch collected={collected} active={active} counts={perSource} onToggle={toggle} />}
        <div className="poll-viz">
          <div className="donut-wrap">
            <Donut slices={options.map((o) => ({ id: o.id, title: optionText(o).title, count: o.count }))} total={allTotal} selected={selected} onSelect={select} hovered={hovered} onHover={setHovered} />
          </div>
          <div className="legend-box" ref={legendBox}>
            <p className="sample-note">
              {allTotal === 0
                ? t('source_empty', { sources: activeNames })
                : allTotal < MIN_FOR_SHARES
                  ? t('sample_thin', { count: allTotal })
                  : active.size > 1
                    ? t('sample_shares_multi', { count: allTotal, sources: activeNames })
                    : t('sample_shares', { count: allTotal })}
            </p>
            <Legend options={options} selected={selected} onSelect={select} hovered={hovered} onHover={setHovered} total={allTotal} reportLang={reportLang} />
          </div>
        </div>
        {!allView && (
          <div ref={whyBox}>
            <Why option={option} summary={selected ? state.reasons[selected]?.summary : undefined} reportLang={reportLang} />
          </div>
        )}
        {collected.length > 1 && <BySource options={allOptions} collected={collected} active={active} reportLang={reportLang} />}
        <Themes
          themes={state.themes}
          posts={activePosts}
          option={option}
          all={allView ? optionIds : undefined}
          active={themeId}
          reportLang={reportLang}
          onPick={(id) => {
            setThemeId(id);
            setPage(1);
            if (id && !desktop) listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
        {poll.other_breakdown && poll.other_breakdown.length > 0 && (
          <p className="also-mentioned">
            <span className="muted">{t('also_mentioned')} </span>
            <span lang={reportLang}>
              {poll.other_breakdown.slice(0, 6).map((b, n) => (
                <span key={b.title}>
                  {n > 0 && ', '}
                  {b.title} <span className="muted">({num(b.count)})</span>
                </span>
              ))}
            </span>
          </p>
        )}
        {isThin(state) && (
          <p className="thin-note" role="note">
            {t('thin_note')}
          </p>
        )}
      </aside>

      <section className="posts-col" key="posts" ref={listTop}>
        <div className={`eyebrow posts-eyebrow ${theme ? 'crumbed' : ''}`}>
          {option ? (
            <>
              <span className="eyebrow-pre">{t('posts_saying')}</span>
              <span style={{ ['--c' as string]: optionColor(option.id) }} className="eyebrow-opt dotted" lang={optText.own ? reportLang : undefined}>
                {optText.title}
              </span>
            </>
          ) : (
            <span className="eyebrow-opt">{t('all_opinions')}</span>
          )}
          {theme && (
            <>
              <ChevronRight size={13} className="crumb-sep" aria-hidden="true" />
              <span className="crumb-theme" title={theme.title} lang={reportLang}>
                {theme.title}
              </span>
              <button type="button" className="icon-btn crumb-clear" onClick={() => (setThemeId(null), setPage(1))} aria-label={t('clear_filter', { theme: theme.title })} data-tip={t('clear_filter_tip')}>
                <XIcon size={14} />
              </button>
            </>
          )}
        </div>
        <div className="toolbar">
          <span className="muted toolbar-count">{t('showing', { from: list.length ? (cur - 1) * pageSize + 1 : 0, to: (cur - 1) * pageSize + shown.length, total: list.length })}</span>
          <SortMenu value={sort} onChange={(s) => (setSort(s), setPage(1))} />
        </div>

        <div className="post-list" key={listKey}>
          {shown.length ? (
            shown.map((p) => {
              const tag = allView ? options.find((o) => o.id === p.option) : undefined;
              const tt = optionText(tag);
              return (
                <PostRow
                  key={p.id}
                  post={p}
                  community={p.community ? state.communities[p.community] : undefined}
                  author={p.source === 'reddit' ? state.authors[p.author.handle] : undefined}
                  tag={tag ? { title: tt.title, color: optionColor(tag.id), lang: tt.own ? reportLang : undefined } : undefined}
                />
              );
            })
          ) : (
            <p className="list-empty">{t('list_empty_all')}</p>
          )}
        </div>

        <div className="list-foot">
          <span className="muted">{list.length ? t('showing', { from: (cur - 1) * pageSize + 1, to: (cur - 1) * pageSize + shown.length, total: list.length }) : ' '}</span>
          <Pager page={cur} pages={pages} onPage={go} />
        </div>
      </section>
    </div>
  );
}
