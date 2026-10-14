// Consensus result files: validation and the numbers the viewer shows.
// Plain JavaScript (ES2022), no dependencies. `consensus.mjs` and the viewer both use this file, so the counts a
// user reads in the viewer are the ones `validate` printed.
//
// Everything in a result file is untrusted: post text and names come from public social media. Nothing here builds
// HTML. Links pass only if they are https links of the expected X or Reddit form, and they must match the post id.
// These checks test form and consistency. They cannot prove a post exists; only a live read can.

export const FORMAT = "consensus-result/1";
const OPTION_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const RESERVED = new Set(["other", "none", "spam"]);
const LABELS_EXTRA = ["other", "none", "spam"];
const TYPES = new Set(["yes_no", "a_vs_b", "best_x", "open"]);
/** A BCP 47 language tag for the language the report text is written in (posts keep their own language). */
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/;
/** Sources the skill can collect from with CoreSpeed social tools. Each run uses the ones the user picked. */
export const SOURCES = ["reddit", "x", "rednote"];
const SOURCE_SET = new Set(SOURCES);

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
const isTime = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
const isTextList = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");

// ---------------------------------------------------------------- links

const X_STATUS = /^https:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\/?(?:\?[^#\s]*)?$/;
const REDDIT_THREAD = /^https:\/\/(?:www\.|old\.)?reddit\.com\/r\/([A-Za-z0-9_]{2,21})\/comments\/([a-z0-9]{3,12})(?:\/[^/?#\s]*)?\/?(?:\?[^#\s]*)?$/;
const REDDIT_COMMENT = /^https:\/\/(?:www\.|old\.)?reddit\.com\/r\/([A-Za-z0-9_]{2,21})\/comments\/([a-z0-9]{3,12})\/[^/?#\s]*\/([a-z0-9]{3,12})\/?(?:\?[^#\s]*)?$/;
/** A Rednote (Xiaohongshu) note page. Comments have no public link of their own, so a comment links to its note. */
const XHS_NOTE = /^https:\/\/www\.xiaohongshu\.com\/(?:explore|discovery\/item)\/([0-9A-Za-z]{16,32})\/?(?:\?[^#\s]*)?$/;
const XHS_ID = /^[0-9A-Za-z]{8,40}$/;

/** Why this post's link is not acceptable, or null. Checks form and id match only. */
export function linkProblem(post) {
  const url = post?.url;
  if (typeof post?.id !== "string") return "the post id must be text";
  if (typeof url !== "string") return "url is missing";
  if (url.length > 2048) return "url is too long";
  if (post.source === "x") {
    const m = url.match(X_STATUS);
    if (!m) return "url is not an https://x.com/<handle>/status/<id> link";
    if (post.id !== `x_${m[2]}`) return `url status id ${m[2]} does not match post id ${post.id}`;
    return null;
  }
  if (post.source === "reddit") {
    if (post.id?.startsWith("t3_")) {
      const m = url.match(REDDIT_THREAD);
      if (!m) return "url is not an https://www.reddit.com/r/<sub>/comments/<id>/ thread link";
      if (`t3_${m[2]}` !== post.id) return `url thread id ${m[2]} does not match post id ${post.id}`;
      return null;
    }
    if (post.id?.startsWith("t1_")) {
      const m = url.match(REDDIT_COMMENT);
      if (!m) return "url is not an https://www.reddit.com/r/<sub>/comments/<post>/<slug>/<comment>/ link";
      if (`t1_${m[3]}` !== post.id) return `url comment id ${m[3]} does not match post id ${post.id}`;
      return null;
    }
    return "reddit post id must start with t3_ (thread) or t1_ (comment)";
  }
  if (post.source === "rednote") {
    const m = url.match(XHS_NOTE);
    if (!m) return "url is not an https://www.xiaohongshu.com/explore/<note_id> link";
    if (post.id?.startsWith("xhs_")) {
      if (post.id !== `xhs_${m[1]}`) return `url note id ${m[1]} does not match post id ${post.id}`;
      return null;
    }
    if (post.id?.startsWith("xhsc_")) {
      if (!XHS_ID.test(post.id.slice(5))) return "a Rednote comment id is xhsc_<comment_id>";
      const t = typeof post.thread_url === "string" ? post.thread_url.match(XHS_NOTE) : null;
      if (!t) return "a Rednote comment needs thread_url, the https://www.xiaohongshu.com/explore/<note_id> link of its note";
      if (t[1] !== m[1]) return "a Rednote comment's url must be its note's link (thread_url)";
      return null;
    }
    return "rednote post id must start with xhs_ (note) or xhsc_ (comment)";
  }
  return "source must be reddit, x or rednote";
}

/** Only https links to the expected hosts ever reach an href or src. Anything else becomes null. */
export function safeLink(url, hosts) {
  if (typeof url !== "string" || url.length > 2048) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  return hosts.some((d) => h === d || h.endsWith(`.${d}`)) ? u.href : null;
}
const POST_HOSTS = ["x.com", "twitter.com", "reddit.com", "xiaohongshu.com"];
// Rednote avatars, seen live on 2026-10-14: note authors on xhscdn.com, commenters on rednotecdn.com.
const IMAGE_HOSTS = ["twimg.com", "redd.it", "redditstatic.com", "redditmedia.com", "xhscdn.com", "rednotecdn.com"];

// ---------------------------------------------------------------- quotes

/** Lower-case, straight quotes, no markdown marks, single spaces: how a quote is compared with its post. */
export function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/[*_`>#~\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** True when every piece of the quote (split at "…" or "...") appears in the post text, in order. */
export function quoteInText(quote, text) {
  const hay = normalizeText(text);
  const pieces = String(quote ?? "")
    .split(/…|\.\.\./)
    .map((p) => normalizeText(p).replace(/^["']|["']$/g, "").trim())
    .filter((p) => p.length > 0);
  if (!pieces.length) return false;
  let from = 0;
  for (const p of pieces) {
    const at = hay.indexOf(p, from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

// ---------------------------------------------------------------- validation

/**
 * Checks a parsed result file. Returns { errors, warnings, issues, stats }. Errors make the file unusable; warnings
 * are shown to the user (thin samples, an option with one vote). `issues` holds the same warnings as { code, params }
 * so the viewer can show them in its own interface language; `warnings` stays English for the agent and the CLI.
 */
export function validateResult(r) {
  const errors = [];
  const warnings = [];
  const issues = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  const note = (code, params, text) => {
    warnings.push(text);
    issues.push({ code, params });
  };
  if (!isObj(r)) return { errors: ["the file is not a JSON object"], warnings, issues, stats: null };

  if (r.format !== FORMAT) err("format", `must be "${FORMAT}"`);
  if (!isStr(r.question)) err("question", "is required");
  else if (r.question.length > 400) err("question", "is longer than 400 characters");
  if (!TYPES.has(r.question_type)) err("question_type", "must be yes_no, a_vs_b, best_x or open");
  if (!isStr(r.summary)) err("summary", "is required: one or two sentences, worded as a sample");
  else if (/\b\d{1,3}(\.\d+)?\s?% of (all |the )?(developers|users|people|customers|americans|everyone|engineers|the market)\b|\bmarket share\b/i.test(r.summary))
    err("summary", "reads as a population claim; say \"of the opinions counted in this sample\" instead");
  if (!isTime(r.created_at)) err("created_at", "must be an ISO 8601 time");
  if (r.language != null && (typeof r.language !== "string" || !LANGUAGE.test(r.language))) err("language", 'must be a language tag such as "en", "zh-CN", "ja" or "ko"');
  if (!isObj(r.window)) err("window", "is required ({ since, until }, each YYYY-MM-DD or null)");
  else {
    for (const k of ["since", "until"]) if (r.window[k] != null && !isDay(r.window[k])) err(`window.${k}`, "must be YYYY-MM-DD or null");
    if (isDay(r.window.since) && isDay(r.window.until) && r.window.since > r.window.until) err("window", "since is after until");
  }
  const sources = Array.isArray(r.sources) ? r.sources : [];
  if (!sources.length || sources.some((s) => !SOURCE_SET.has(s))) err("sources", 'must list the sources collected: "reddit", "x" and/or "rednote"');
  else if (new Set(sources).size !== sources.length) err("sources", "lists a source twice");

  // options
  const options = Array.isArray(r.options) ? r.options : [];
  if (!options.length) err("options", "needs at least one answer");
  if (options.length > 8) err("options", "has more than 8 answers; fold the smallest into Other");
  const optionIds = new Set();
  options.forEach((o, i) => {
    const p = `options[${i}]`;
    if (!isObj(o)) return err(p, "must be an object");
    if (typeof o.id !== "string" || !OPTION_ID.test(o.id)) err(`${p}.id`, "must be lowercase letters, digits, - or _ (up to 32)");
    else if (RESERVED.has(o.id)) err(`${p}.id`, `"${o.id}" is reserved`);
    else if (optionIds.has(o.id)) err(`${p}.id`, `"${o.id}" is used twice`);
    else optionIds.add(o.id);
    if (!isStr(o.title)) err(`${p}.title`, "is required");
    else if (o.title.length > 80) err(`${p}.title`, "is longer than 80 characters");
    if (o.description != null && typeof o.description !== "string") err(`${p}.description`, "must be text");
    if (o.why != null && typeof o.why !== "string") err(`${p}.why`, "must be text");
    if (o.quotes != null && !Array.isArray(o.quotes)) err(`${p}.quotes`, "must be a list");
  });

  // themes
  const themes = Array.isArray(r.themes) ? r.themes : [];
  if (r.themes != null && !Array.isArray(r.themes)) err("themes", "must be a list");
  const themeIds = new Set();
  themes.forEach((t, i) => {
    const p = `themes[${i}]`;
    if (!isObj(t)) return err(p, "must be an object");
    if (typeof t.id !== "string" || !OPTION_ID.test(t.id)) err(`${p}.id`, "must be lowercase letters, digits, - or _");
    else if (themeIds.has(t.id)) err(`${p}.id`, `"${t.id}" is used twice`);
    else themeIds.add(t.id);
    if (!isStr(t.title)) err(`${p}.title`, "is required");
  });

  // posts
  const posts = Array.isArray(r.posts) ? r.posts : [];
  if (!posts.length) err("posts", "is empty: list every post you sorted");
  const byId = new Map();
  const labels = new Set([...optionIds, ...LABELS_EXTRA]);
  posts.forEach((q, i) => {
    const p = `posts[${i}]`;
    if (!isObj(q)) return err(p, "must be an object");
    const at = isStr(q.id) ? `${p} (${q.id})` : p;
    if (!isStr(q.id)) err(`${p}.id`, "is required");
    else if (byId.has(q.id)) err(`${at}.id`, "is listed twice");
    else byId.set(q.id, q);
    if (q.source === "x" && !/^x_\d{5,25}$/.test(q.id ?? "")) err(`${at}.id`, "an X post id is x_<tweet_id>");
    if (q.source === "x" && q.kind != null && !["post", "reply"].includes(q.kind)) err(`${at}.kind`, "an X post is post or reply");
    if (q.source === "reddit" && q.kind != null && !["thread", "comment"].includes(q.kind)) err(`${at}.kind`, "a Reddit post is thread or comment");
    if (q.source === "rednote" && q.kind != null && !["note", "comment"].includes(q.kind)) err(`${at}.kind`, "a Rednote post is note or comment");
    if (SOURCE_SET.has(q.source) && sources.length && !sources.includes(q.source)) err(`${at}.source`, `"${q.source}" is not in sources; list every source the posts came from`);
    const lp = linkProblem(q);
    if (lp) err(`${at}.url`, lp);
    if (!isStr(q.text)) err(`${at}.text`, "is required");
    else if (q.text.length > 20_000) err(`${at}.text`, "is longer than 20,000 characters; cut it");
    if (!isStr(q.author)) err(`${at}.author`, "is required (the handle)");
    if (q.created_at != null && !isTime(q.created_at)) err(`${at}.created_at`, "must be an ISO 8601 date or time");
    if (q.created_at == null) note("missing_date", { id: String(q.id ?? i) }, `${at}.created_at: is missing; the post cannot be checked against the window`);
    if (q.score != null && !Number.isFinite(q.score)) err(`${at}.score`, "must be a number");
    if (q.excerpt != null && typeof q.excerpt !== "boolean") err(`${at}.excerpt`, "must be true or false");
    for (const k of ["author_name", "author_avatar", "community", "thread_title", "thread_url", "parent_text", "kind"]) if (q[k] != null && typeof q[k] !== "string") err(`${at}.${k}`, "must be text");
    if (q.replies != null && !Number.isFinite(q.replies)) err(`${at}.replies`, "must be a number");
    if (q.author_avatar != null && !safeLink(q.author_avatar, IMAGE_HOSTS)) note("avatar_unsafe", { id: String(q.id ?? i) }, `${at}.author_avatar: is not an https image from X, Reddit or Rednote; it will not be shown`);
    if (!labels.has(q.label)) err(`${at}.label`, `must be one of: ${[...labels].join(", ")}`);
    const voted = optionIds.has(q.label) || q.label === "other";
    if (!Number.isInteger(q.strength) || q.strength < 0 || q.strength > 3) err(`${at}.strength`, "must be 0, 1, 2 or 3");
    else if (voted && q.strength === 0) err(`${at}.strength`, "a vote needs strength 1 to 3");
    else if (!voted && q.strength !== 0) err(`${at}.strength`, "none and spam take strength 0");
    if (q.themes != null) {
      if (!Array.isArray(q.themes)) err(`${at}.themes`, "must be a list of theme ids");
      else for (const t of q.themes) if (!themeIds.has(t)) err(`${at}.themes`, `unknown theme "${t}"`);
    }
    // Window: the post's own date must fall inside it (one day of slack for time zones).
    if (isTime(q.created_at) && isObj(r.window)) {
      const t = Date.parse(q.created_at);
      if (isDay(r.window.since) && t < Date.parse(`${r.window.since}T00:00:00Z`) - 86_400_000) err(`${at}.created_at`, `is before the window (${r.window.since})`);
      if (isDay(r.window.until) && t >= Date.parse(`${r.window.until}T00:00:00Z`) + 2 * 86_400_000) err(`${at}.created_at`, `is after the window (${r.window.until})`);
    }
  });

  // quotes must come from posts with that option's label
  options.forEach((o, i) => {
    (Array.isArray(o?.quotes) ? o.quotes : []).forEach((qt, j) => {
      const p = `options[${i}].quotes[${j}]`;
      if (!isObj(qt) || !isStr(qt.post) || !isStr(qt.text)) return err(p, "needs { post, text }");
      const post = byId.get(qt.post);
      if (!post) return err(`${p}.post`, `no post has id ${qt.post}`);
      if (post.label !== o.id) err(`${p}.post`, `post ${qt.post} is labelled "${post.label}", not "${o.id}"`);
      if (!quoteInText(qt.text, post.text)) err(`${p}.text`, `is not found verbatim in post ${qt.post}`);
    });
  });

  // usage: honest arithmetic
  const u = r.usage;
  if (!isObj(u)) err("usage", "is required ({ requests, failed, credits_per_request, budget })");
  else {
    if (!Number.isInteger(u.requests) || u.requests < 0) err("usage.requests", "must be a whole number");
    if (u.failed != null && (!Number.isInteger(u.failed) || u.failed < 0)) err("usage.failed", "must be a whole number");
    if (u.unknown_charge != null && (!Number.isInteger(u.unknown_charge) || u.unknown_charge < 0 || u.unknown_charge > (Number(u.failed) || 0)))
      err("usage.unknown_charge", "must be a whole number no larger than failed");
    if (typeof u.credits_per_request !== "number" || u.credits_per_request < 0) err("usage.credits_per_request", "must be the rate from the tool descriptions (e.g. 1.5)");
    if (u.budget != null && Number.isInteger(u.requests) && u.requests > u.budget) err("usage.requests", `exceeds the budget of ${u.budget}`);
    if (u.rates != null) {
      if (!isObj(u.rates) || Object.values(u.rates).some((v) => typeof v !== "number" || !(v >= 0))) err("usage.rates", "must map each tool to the rate its description states, e.g. { \"social__xiaohongshu_search_notes\": 15 }");
    }
    if (u.unknown_by_tool != null) {
      const vals = isObj(u.unknown_by_tool) ? Object.values(u.unknown_by_tool) : null;
      if (!vals || vals.some((v) => !Number.isInteger(v) || v < 0)) err("usage.unknown_by_tool", "must map tools to whole numbers");
      else if (vals.reduce((a, b) => a + b, 0) > (Number(u.unknown_charge) || 0)) err("usage.unknown_by_tool", "adds up to more than unknown_charge");
    }
    if (u.budget_by_source != null) {
      const ok = isObj(u.budget_by_source) && Object.entries(u.budget_by_source).every(([k, v]) => SOURCE_SET.has(k) && Number.isInteger(v) && v >= 0);
      if (!ok) err("usage.budget_by_source", 'must map sources ("reddit", "x", "rednote") to whole numbers of requests');
      else if (Number.isInteger(u.budget) && Object.values(u.budget_by_source).reduce((a, b) => a + b, 0) !== u.budget) err("usage.budget_by_source", `must add up to the total budget (${u.budget}): the split divides one budget, it never adds to it`);
      else if (Object.keys(u.budget_by_source).some((k) => !sources.includes(k))) err("usage.budget_by_source", "names a source that is not in sources");
    }
    // Counts are whole, non-negative numbers: a negative or fractional count would make a negative or false cost.
    if (u.by_tool != null && (!isObj(u.by_tool) || Object.values(u.by_tool).some((n) => !Number.isInteger(n) || n < 0))) err("usage.by_tool", "must map tools to whole numbers of successful requests");
    if (u.failures != null && (!isObj(u.failures) || Object.values(u.failures).some((n) => !Number.isInteger(n) || n < 0))) err("usage.failures", "must map error codes to whole numbers");
    if (isObj(u.by_tool) && Number.isInteger(u.requests)) {
      const sum = Object.values(u.by_tool).reduce((a, b) => a + (Number(b) || 0), 0);
      if (sum !== u.requests) err("usage.by_tool", `adds up to ${sum}, but requests is ${u.requests}`);
    }
  }
  if (!isObj(r.coverage)) err("coverage", "is required");
  else {
    if (r.coverage.notes != null && !isTextList(r.coverage.notes)) err("coverage.notes", "must be a list of sentences");
    const d = r.coverage.dropped_before_sorting;
    if (d != null && (!isObj(d) || !Number.isInteger(d.count) || d.count < 0 || (d.reasons != null && !isTextList(d.reasons))))
      err("coverage.dropped_before_sorting", "must be { count, reasons: [...] } with a whole-number count and sentences as reasons");
    for (const src of SOURCES) {
      const c = r.coverage[src];
      if (c != null && (!isObj(c) || Object.values(c).some((n) => !Number.isInteger(n) || n < 0))) err(`coverage.${src}`, "must map each count to a whole number");
    }
    if (r.coverage.posts_read != null && (!Number.isInteger(r.coverage.posts_read) || r.coverage.posts_read < 0)) err("coverage.posts_read", "must be a whole number");
  }
  // Everything the viewer prints as text must be text, or the page would fail to render.
  if (r.limits != null && !isTextList(r.limits)) err("limits", "must be a list of sentences");
  if (r.other != null && !isObj(r.other)) err("other", "must be { why, also_mentioned }");
  else if (r.other?.why != null && typeof r.other.why !== "string") err("other.why", "must be text");
  if (r.other?.also_mentioned != null && (!Array.isArray(r.other.also_mentioned) || r.other.also_mentioned.some((b) => !isObj(b) || !isStr(b.title) || !Number.isInteger(b.count) || b.count < 0)))
    err("other.also_mentioned", "must be a list of { title, count }");
  if (r.queries != null && (!Array.isArray(r.queries) || r.queries.some((q) => !isObj(q) || !isStr(q.tool) || (q.args != null && !isObj(q.args)) || (q.result != null && typeof q.result !== "string") || (q.items != null && (!Number.isInteger(q.items) || q.items < 0)))))
    err("queries", "must be a list of { tool, args, result, items }");
  if (r.analysis != null && (!isObj(r.analysis) || ["by", "model"].some((k) => r.analysis[k] != null && typeof r.analysis[k] !== "string"))) err("analysis", "must be { by, model } as text");

  if (errors.length) return { errors, warnings, issues, stats: null };
  const stats = computeStats(r);
  if (Number.isInteger(r.usage.budget) && stats.sent > r.usage.budget)
    note("over_budget", { sent: stats.sent, budget: r.usage.budget }, `usage: ${stats.sent} requests were sent (successful + failed, retries included), over the budget of ${r.usage.budget}`);
  // The funnel must add up: posts read = dropped before sorting + posts sorted.
  const dropped = r.coverage.dropped_before_sorting?.count;
  if (Number.isInteger(r.coverage.posts_read) && Number.isInteger(dropped) && r.coverage.posts_read !== dropped + posts.length)
    note("funnel_mismatch", { read: r.coverage.posts_read, dropped, sorted: posts.length }, `coverage: posts_read (${r.coverage.posts_read}) is not dropped_before_sorting (${dropped}) + posts sorted (${posts.length})`);
  if (Number.isInteger(r.coverage.posts_read) && dropped == null && r.coverage.posts_read > posts.length)
    note("funnel_unrecorded", { count: r.coverage.posts_read - posts.length }, `coverage: ${r.coverage.posts_read - posts.length} posts were read but not sorted; record them in dropped_before_sorting`);
  // Limits the rubric sets that a reader would notice.
  const voted = posts.filter((q) => optionIds.has(q.label) || q.label === "other");
  for (const t of themes) {
    const n = voted.filter((q) => Array.isArray(q.themes) && q.themes.includes(t.id)).length;
    if (n < 3) note("theme_small", { title: t.title, count: n }, `theme "${t.title}" has ${n} counted post(s); the rubric asks for at least 3`);
  }
  options.forEach((o) => {
    if (typeof o.description === "string" && o.description.trim().split(/\s+/).length > 15) note("long_description", { title: o.title }, `option "${o.title}": description is over 15 words`);
    for (const qt of Array.isArray(o.quotes) ? o.quotes : []) if (String(qt.text).trim().split(/\s+/).length > 25) note("long_quote", { title: o.title }, `option "${o.title}": a quote is over 25 words`);
  });
  const perThread = new Map();
  const perAuthor = new Map();
  const byThread = new Map();
  for (const q of voted) {
    const thread = threadKey(q);
    if (thread) {
      const t = byThread.get(thread) ?? { n: 0, byLabel: new Map() };
      t.n++;
      t.byLabel.set(q.label, (t.byLabel.get(q.label) ?? 0) + 1);
      byThread.set(thread, t);
    }
    if (q.author === "[deleted]") continue;
    const who = `${q.source}:${q.author}`;
    perAuthor.set(who, (perAuthor.get(who) ?? 0) + 1);
    if (thread) perThread.set(`${who}|${thread}`, (perThread.get(`${who}|${thread}`) ?? 0) + 1);
  }
  // Sampling skew: one thread (a Reddit thread, or the replies under one X post) supplying a large share.
  const labelCount = new Map();
  for (const q of voted) labelCount.set(q.label, (labelCount.get(q.label) ?? 0) + 1);
  for (const [thread, t] of byThread) {
    if (voted.length >= 10 && t.n / voted.length > 1 / 3) note("thread_total", { count: t.n, total: voted.length, thread }, `one thread supplies ${t.n} of ${voted.length} counted opinions (${thread}); say so in the limits`);
    for (const [label, n] of t.byLabel) {
      const total = labelCount.get(label) ?? 0;
      if (total >= 6 && n / total > 0.5) note("thread_option", { count: n, total, label, thread }, `one thread supplies ${n} of the ${total} votes for "${label}" (${thread}); say so in the limits`);
    }
  }
  for (const [k, n] of perThread) if (n > 1) note("author_thread", { author: k.split("|")[0], count: n }, `${k.split("|")[0]} has ${n} votes in one thread; the rubric counts one vote per author per thread`);
  for (const [k, n] of perAuthor) if (n > 2) note("author_total", { author: k, count: n }, `${k} has ${n} votes; the rubric allows at most two per author`);
  if (stats.counted === 0) note("empty_poll", {}, "no post is labelled with an answer: the viewer will show an empty poll");
  else if (stats.counted < 15) note("thin", { count: stats.counted }, `only ${stats.counted} opinions counted: the viewer shows counts and marks the sample as thin`);
  for (const row of stats.options) if (!row.is_other && row.count < 2) note("small_option", { title: row.title, count: row.count }, `option "${row.title}" has ${row.count} vote(s); fold it into Other`);
  const other = stats.options.find((o) => o.is_other);
  if (other && stats.counted >= 15 && other.count / stats.counted > 0.3)
    note("other_heavy", { share: other.count / stats.counted }, `Other holds ${Math.round((100 * other.count) / stats.counted)}% of counted opinions; check for a missing answer`);
  return { errors, warnings, issues, stats };
}

/** The thread a vote came from: a Reddit thread, or the X post whose replies were read. X search results have none. */
export function threadKey(q) {
  // A Rednote link carries a per-reader token; the note is the thread, so compare links without their query.
  if (q.source === "rednote") return String(q.thread_url || q.url || "").replace(/[?#].*$/, "") || null;
  if (typeof q.thread_url === "string" && q.thread_url) return q.thread_url;
  if (q.source === "reddit" && q.kind === "comment" && typeof q.url === "string") return q.url.replace(/[a-z0-9]+\/?$/, "");
  if (q.source === "reddit" && q.kind === "thread") return q.url;
  if (q.source === "x" && q.kind === "reply" && q.parent_text) return `replies to: ${String(q.parent_text).slice(0, 60)}`;
  return null;
}

// ---------------------------------------------------------------- numbers

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

/** The rate a tool's description states: `usage.rates[tool]`, else the run's `credits_per_request`. */
function rateOf(u, tool) {
  const name = String(tool).replace(/^mcp__\w+?__/, "");
  const r = isObj(u.rates) ? (u.rates[tool] ?? u.rates[name]) : undefined;
  return typeof r === "number" ? r : u.credits_per_request;
}
const cents = (n) => Math.round(n * 100) / 100;

/** Counts from the labels. Shares are of opinions counted in this sample, nothing more. */
export function computeStats(r) {
  const opts = [...r.options.map((o) => ({ id: o.id, title: o.title, is_other: false })), { id: "other", title: "Other", is_other: true }];
  const rows = opts.map((o) => ({ ...o, count: 0, ...Object.fromEntries(SOURCES.map((x) => [x, 0])) }));
  const byId = new Map(rows.map((o) => [o.id, o]));
  const bySource = Object.fromEntries(SOURCES.map((x) => [x, { read: 0, counted: 0 }]));
  let spam = 0;
  let none = 0;
  for (const p of r.posts) {
    if (bySource[p.source]) bySource[p.source].read++;
    if (p.label === "spam") spam++;
    else if (p.label === "none") none++;
    else {
      const row = byId.get(p.label);
      row.count++;
      row[p.source]++;
      if (bySource[p.source]) bySource[p.source].counted++;
    }
  }
  const counted = rows.reduce((a, o) => a + o.count, 0);
  for (const o of rows) o.share = pct(o.count, counted);
  const u = r.usage;
  const requests = u.requests;
  // Credits: each tool at its own stated rate when by_tool is given (Rednote and X differ), else one rate for all.
  const credits = isObj(u.by_tool) ? Object.entries(u.by_tool).reduce((a, [tool, n]) => a + (Number(n) || 0) * rateOf(u, tool), 0) : requests * u.credits_per_request;
  // A request that failed in transport may have been charged. Known tools at their rate; the rest at the highest rate.
  const unknownCharge = Number(u.unknown_charge) || 0;
  const known = isObj(u.unknown_by_tool) ? Object.entries(u.unknown_by_tool) : [];
  const knownN = known.reduce((a, [, n]) => a + (Number(n) || 0), 0);
  const maxRate = Math.max(u.credits_per_request, ...(isObj(u.rates) ? Object.values(u.rates).filter((v) => typeof v === "number") : []));
  const unknownCredits = known.reduce((a, [tool, n]) => a + (Number(n) || 0) * rateOf(u, tool), 0) + Math.max(0, unknownCharge - knownN) * maxRate;
  return {
    counted,
    sorted: r.posts.length,
    spam,
    none,
    dropped: Number(r.coverage?.dropped_before_sorting?.count) || 0,
    read: Math.max(r.posts.length + (Number(r.coverage?.dropped_before_sorting?.count) || 0), Number(r.coverage?.posts_read) || 0),
    options: rows,
    bySource,
    requests,
    sent: requests + (Number(u.failed) || 0),
    unknownCharge,
    credits: cents(credits),
    creditsMax: cents(credits + unknownCredits),
    mixedRates: isObj(u.rates) && Object.values(u.rates).some((v) => v !== u.credits_per_request),
    thin: counted < 15,
  };
}

// ---------------------------------------------------------------- viewer state

/** Leading @mentions and t.co short links, as upstream Consensus stripped them from X posts. */
export const cleanTweet = (t) =>
  String(t ?? "")
    .replace(/^(?:@\w+\s*)+/, "")
    .replace(/https?:\/\/t\.co\/\w+/g, "")
    .trim();

const DIRECT = { 3: 1, 2: 0.7, 1: 0.25, 0: 0 };
/** Public profile pages. A Rednote author is identified by user id; the display name is author_name. */
const PROFILE = {
  x: (h) => `https://x.com/${h}`,
  reddit: (h) => `https://www.reddit.com/user/${h}`,
  // Rednote: commenter ids (29 characters) differ from profile ids, so no profile link is made.
};
const toEpoch = (iso) => (isTime(iso) ? Date.parse(iso) / 1000 : null);
const isoSec = (iso) => (isTime(iso) ? new Date(Date.parse(iso)).toISOString().replace(/\.\d{3}Z$/, "Z") : null);

/**
 * The state the original Consensus results screen renders (its SearchState), built from a valid result file.
 * Internal option ids are o0, o1, ... in file order, because the original UI colours options by that number.
 */
export function toViewerState(r, now = Date.now() / 1000) {
  const stats = computeStats(r);
  const internal = new Map(r.options.map((o, i) => [o.id, `o${i}`]));
  internal.set("other", "other");
  const optionOf = (label) => internal.get(label) ?? null;
  const since = isDay(r.window?.since) ? Date.parse(`${r.window.since}T00:00:00Z`) / 1000 : 0;
  const until = isDay(r.window?.until) ? Date.parse(`${r.window.until}T00:00:00Z`) / 1000 + 86_400 : now;

  // Upstream's ranking: how clearly a post answers (strength), engagement, and recency inside the window.
  const recency = (t) => (t ? Math.max(0.35, Math.pow(0.5, (now - t) / (548 * 86_400))) : 0.6);
  const relevanceOf = (p, t) => {
    let fresh = 0.5;
    if (t) {
      const end = Math.min(now, until);
      fresh = since > 0 && end > since ? 0.3 + 0.7 * Math.max(0, Math.min(1, (t - since) / (end - since))) : Math.pow(0.5, Math.max(0, now - t) / (548 * 86_400));
    }
    const eng = Math.min(1, Math.log1p(Math.max(0, p.score ?? 0)) / Math.log1p(1000));
    return Math.round((0.55 * (DIRECT[p.strength] ?? 0) + 0.2 * fresh + 0.25 * eng) * 1000) / 1000;
  };

  const posts = {};
  const authors = {};
  for (const p of r.posts) {
    if (!(r.options.some((o) => o.id === p.label) || p.label === "other")) continue;
    const t = toEpoch(p.created_at);
    const url = safeLink(p.url, POST_HOSTS);
    if (!url) continue;
    const avatar = safeLink(p.author_avatar, IMAGE_HOSTS);
    const handle = String(p.author).replace(/^(u\/|@)/, "").slice(0, 64);
    if (p.source === "reddit" && avatar) authors[handle] = { avatar };
    const kind = p.source === "rednote" ? (p.kind === "comment" ? "comment" : "opener") : p.kind === "thread" ? "opener" : p.kind === "reply" ? "reply" : p.source === "x" ? "post" : "comment";
    posts[p.id] = {
      id: p.id,
      source: p.source,
      kind,
      depth: kind === "opener" ? -1 : 0,
      // As upstream's backend did for X: leading @mentions and t.co links carry no stance. Quotes are checked against
      // the raw text in validateResult; only the display is cleaned.
      text: p.source === "x" ? cleanTweet(String(p.text)) || String(p.text) : String(p.text),
      url,
      thread_title: typeof p.thread_title === "string" ? p.thread_title : null,
      thread_url: safeLink(p.thread_url, POST_HOSTS),
      community: typeof p.community === "string" ? p.community : null,
      created_at: isoSec(p.created_at),
      score: Number.isFinite(p.score) ? p.score : 0,
      replies: Number.isFinite(p.replies) ? p.replies : 0,
      author: {
        handle,
        name: typeof p.author_name === "string" ? p.author_name.slice(0, 80) : null,
        profile_url: safeLink(PROFILE[p.source]?.(encodeURIComponent(handle)), POST_HOSTS),
        avatar: p.source === "reddit" ? null : avatar,
        followers: null,
      },
      option: optionOf(p.label),
      strength: p.strength,
      intent: null,
      rank: Math.round(p.strength * (1 + Math.log1p(Math.max(0, p.score ?? 0))) * recency(t) * 100) / 100,
      relevance: relevanceOf(p, t),
      themes: Array.isArray(p.themes) ? p.themes : [],
      excerpt: p.excerpt === true,
    };
  }

  const shown = Object.values(posts);
  const counted = shown.length;
  const all = [...r.options.map((o, i) => ({ id: `o${i}`, title: o.title, description: o.description ?? "", is_other: false })), { id: "other", title: "Other", description: isStr(r.other?.why) ? r.other.why : "", is_other: true }];
  const pollOptions = all
    .map((o, index) => {
      const mine = shown.filter((p) => p.option === o.id);
      const by_source = Object.fromEntries(SOURCES.map((x) => [x, mine.filter((p) => p.source === x).length]));
      return { id: o.id, index, title: o.title, description: o.description, is_other: o.is_other, count: mine.length, percent: pct(mine.length, counted), weighted_percent: pct(mine.length, counted), by_source, intents: { looking: 0, switching: 0, frustrated: 0, just_bought: 0 }, leads: 0 };
    })
    .sort((a, b) => Number(a.is_other) - Number(b.is_other) || b.count - a.count);
  const redditPosts = r.posts.filter((p) => p.source === "reddit").length;
  const xKept = r.posts.filter((p) => p.source === "x").length;
  const threads = new Set(shown.filter((p) => p.source === "reddit").map((p) => p.thread_url ?? p.url.replace(/\/[a-z0-9]+\/?$/, "/")));
  const poll = {
    final: true,
    total_opinions: counted,
    options: pollOptions,
    sources: {
      reddit: { threads: Number(r.coverage?.reddit?.threads_read) || threads.size, opinions: shown.filter((p) => p.source === "reddit").length },
      x: { posts: xKept, opinions: shown.filter((p) => p.source === "x").length },
      rednote: { notes: r.posts.filter((p) => p.source === "rednote" && p.kind !== "comment").length, opinions: shown.filter((p) => p.source === "rednote").length },
    },
    leads: { total: 0, looking: 0, switching: 0, frustrated: 0, just_bought: 0 },
    pool: { collected: r.posts.length, sorted: r.posts.length, unsorted: 0, removed_spam: stats.spam, no_stance: stats.none, duplicates: 0, author_capped: 0 },
    other_breakdown: (Array.isArray(r.other?.also_mentioned) ? r.other.also_mentioned : []).filter((b) => isStr(b?.title)).map((b) => ({ title: b.title, count: Number(b.count) || 0 })),
    scanned: { total: stats.read, reddit_threads: Number(r.coverage?.reddit?.threads_read) || threads.size, reddit_posts: redditPosts, x_fetched: Math.max(xKept, Number(r.coverage?.x?.posts_returned) || 0), x_kept: xKept },
  };

  const reasons = {};
  r.options.forEach((o, i) => {
    const id = `o${i}`;
    const points = (Array.isArray(o.quotes) ? o.quotes : []).map((q) => posts[q.post] && { text: "", quote: String(q.text), post_id: q.post, url: posts[q.post].url }).filter(Boolean);
    if (isStr(o.why) || points.length) reasons[id] = { option_id: id, summary: isStr(o.why) ? o.why : "", points };
  });
  if (isStr(r.other?.why)) reasons.other = { option_id: "other", summary: r.other.why, points: [] };

  const themes = (Array.isArray(r.themes) ? r.themes : [])
    .map((t) => {
      const ps = shown.filter((p) => p.themes.includes(t.id)).sort((a, b) => b.rank - a.rank);
      const by_option = {};
      const by_option_source = {};
      for (const p of ps) {
        by_option[p.option] = (by_option[p.option] ?? 0) + 1;
        by_option_source[p.option] ??= { reddit: 0, x: 0 };
        by_option_source[p.option][p.source]++;
      }
      return {
        id: t.id,
        title: t.title,
        description: t.description ?? "",
        option_ids: Object.keys(by_option),
        count: ps.length,
        percent: pct(ps.length, counted),
        by_option,
        by_option_source,
        by_source: Object.fromEntries(SOURCES.map((x) => [x, ps.filter((p) => p.source === x).length])),
        post_ids: ps.map((p) => p.id),
        // A thread opener's text starts with its title; the example quote is the body.
        quotes: ps.slice(0, 3).map((p) => ({ post_id: p.id, url: p.url, text: (p.kind === "opener" && p.thread_title && p.text.startsWith(p.thread_title) ? p.text.slice(p.thread_title.length).trim() : p.text).slice(0, 220), source: p.source, author: p.author.handle })),
      };
    })
    .filter((t) => t.count > 0);

  const flags = [];
  if (counted < 15) flags.push("thin_pool");
  else if (counted < 60) flags.push("small_pool");
  const other = pollOptions.find((o) => o.is_other);
  if (counted && other && other.count / counted >= 0.6) flags.push("other_heavy");
  return {
    phase: "done",
    meta: { id: slugify(r.question), query: r.question, since: r.window?.since ?? null, until: r.window?.until ?? null, sources: r.sources, cached: true, saved_at: r.created_at },
    progress: null,
    options: all.map(({ id, title, description, is_other }) => ({ id, title, description, is_other })),
    poll,
    posts,
    postsVersion: 1,
    reasons,
    themes,
    authors,
    communities: {},
    done: { id: slugify(r.question), status: counted === 0 ? "empty" : counted < 15 ? "thin" : "ok", total_ms: 0, quality: { flags } },
    error: null,
    stats,
  };
}

export function slugify(q) {
  return (
    String(q ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "consensus"
  );
}

/** JSON that is safe inside a <script> element: no "</script>", no "<!--", no line separators. */
export function scriptSafeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
