// Offline normalizers: one saved CoreSpeed social__* result -> evidence rows in the result-file post shape
// (without label and strength, which your agent adds). Shapes were read from live results on 2026-10-14 (Reddit, X,
// and three Rednote calls); any missing field means the item is skipped, never guessed. No network, no dependencies.

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === "string" && v.length ? v : null);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const iso = (v) => {
  const s = str(v);
  const t = s ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");
};
/** Tweet ids are 64-bit: only digit strings, never numbers. */
const tweetId = (v) => (typeof v === "string" && /^\d{5,25}$/.test(v) ? v : null);
const handleOk = (h) => typeof h === "string" && /^[A-Za-z0-9_]{1,15}$/.test(h);

/**
 * CoreSpeed's public docs (corespeed.io/docs/social) say a clipped response "ends with an explicit truncation
 * notice". The exact wording is not a contract, so any last line after the JSON that mentions truncation counts.
 */
const TRUNCATION_NOTE = /\n[^\n]*truncat[^\n]*\s*$/i;

/** The payload inside a saved result: the bare tool text, or a whole CallToolResult. */
export function unwrap(raw) {
  let text = raw;
  try {
    const outer = JSON.parse(raw);
    if (obj(outer) && Array.isArray(outer.content)) {
      if (outer.isError) return { error: outer.content.map((c) => c?.text ?? "").join("") || "isError", data: undefined, truncated: false };
      text = outer.content.filter((c) => c?.type === "text").map((c) => c.text).join("");
    } else if (obj(outer) || Array.isArray(outer)) return { data: outer, truncated: false };
  } catch {
    /* not JSON as a whole: maybe clipped tool text */
  }
  try {
    return { data: JSON.parse(text), truncated: false };
  } catch {
    /* clipped, or not JSON at all */
  }
  const note = TRUNCATION_NOTE.exec(text);
  if (!note) return { data: undefined, truncated: false };
  try {
    return { data: JSON.parse(text.slice(0, note.index)), truncated: true };
  } catch {
    return { data: undefined, truncated: true };
  }
}

function xRow(t, handle, extra = {}) {
  const id = tweetId(t.tweet_id) ?? tweetId(t.id) ?? tweetId(t.rest_id);
  const text = str(t.text) ?? str(t.display_text);
  if (!id || !text || !handleOk(handle) || /^RT @\w+:/.test(text)) return null;
  const conv = tweetId(t.conversation_id);
  return {
    id: `x_${id}`,
    source: "x",
    kind: extra.kind ?? (conv && conv !== id ? "reply" : "post"),
    url: `https://x.com/${handle}/status/${id}`,
    text,
    author: handle,
    ...(str(extra.name) ? { author_name: extra.name } : {}),
    ...(str(extra.avatar) ? { author_avatar: extra.avatar.replace("_normal.", "_bigger.") } : {}),
    created_at: iso(t.created_at),
    score: num(t.favorites) ?? num(t.likes) ?? 0,
    replies: num(t.replies) ?? 0,
    ...(extra.parent ? { parent_text: extra.parent } : {}),
  };
}

function redditAuthor(info) {
  const name = str(obj(info)?.name);
  return name && name !== "[deleted]" ? name : "[deleted]";
}
const redditLink = (permalink) => (str(permalink) && permalink.startsWith("/r/") ? `https://www.reddit.com${permalink}` : null);

/** Rednote ids seen live: 24 hex characters for notes, comments and note authors; 29 for commenters. */
const xhsId = (v) => (typeof v === "string" && /^[0-9A-Za-z]{8,40}$/.test(v) ? v : null);
/** Rednote times are Unix seconds (note.timestamp, comment.time). */
const fromSeconds = (v) => (typeof v === "number" && v > 1e9 && v < 1e11 ? new Date(v * 1000).toISOString().replace(/\.\d{3}Z$/, "Z") : null);
const XHS_NOTE_LINK = /^https:\/\/www\.xiaohongshu\.com\/explore\/([0-9A-Za-z]{8,40})(?:\?[^#\s]*)?$/;
/**
 * A note's public link. Without its xsec_token, Rednote shows "this note cannot be viewed" (checked 2026-10-14), so
 * the token from the search result is kept. Readers may still be asked to sign in.
 */
function xhsNoteLink(id, token) {
  const base = `https://www.xiaohongshu.com/explore/${id}`;
  return str(token) ? `${base}?xsec_token=${encodeURIComponent(token)}` : base;
}

/**
 * Normalizes one result. Returns { rows, raw, dropped, truncated, next, error }. `since`/`until` (YYYY-MM-DD,
 * inclusive) drop posts outside the window. Rows are deduped by id within the payload.
 */
export function normalizePayload(tool, rawText, { since, until, noteUrl, noteTitle } = {}) {
  const name = String(tool).replace(/^mcp__[^_]+__/, "");
  const { data, truncated, error } = unwrap(rawText);
  const out = { rows: [], raw: 0, dropped: 0, truncated, next: null, error: error ?? null };
  if (error || data === undefined) {
    if (!error) out.error = truncated ? "the payload was truncated and could not be parsed" : "the payload is not JSON";
    return out;
  }
  const lo = since ? Date.parse(`${since}T00:00:00Z`) : -Infinity;
  const hi = until ? Date.parse(`${until}T00:00:00Z`) + 86_400_000 : Infinity;
  const seen = new Set();
  const push = (row) => {
    if (!row || seen.has(row.id)) return void out.dropped++;
    const t = row.created_at ? Date.parse(row.created_at) : NaN;
    if (!Number.isNaN(t) && (t < lo || t >= hi)) return void out.dropped++;
    seen.add(row.id);
    out.rows.push(row);
  };

  if (name === "social__x_search") {
    const items = arr(obj(data)?.timeline);
    out.raw = items.length;
    for (const it of items) {
      const t = obj(it);
      if (!t || (t.type !== undefined && t.type !== "tweet")) {
        out.dropped++;
        continue;
      }
      const info = obj(t.user_info);
      push(xRow(t, str(t.screen_name) ?? str(info?.screen_name), { name: info?.name, avatar: info?.avatar }));
    }
    out.next = str(obj(data)?.next_cursor);
  } else if (name === "social__x_post_comments") {
    const root = obj(data);
    const rootHandle = str(obj(root?.author)?.screen_name);
    const rootId = tweetId(root?.id) ?? tweetId(root?.tweet_id);
    const threadUrl = rootHandle && handleOk(rootHandle) && rootId ? `https://x.com/${rootHandle}/status/${rootId}` : null;
    const parent = str(root?.text)?.replace(/\s+/g, " ").slice(0, 240);
    const items = arr(root?.thread);
    out.raw = items.length;
    for (const it of items) {
      const t = obj(it);
      const a = obj(t?.author);
      const h = str(a?.screen_name);
      // The root author's own follow-ups are their thread, not answers.
      if (!t || h === rootHandle) {
        out.dropped++;
        continue;
      }
      const row = xRow(t, h, { kind: "reply", name: a?.name, avatar: a?.image, parent });
      if (row && threadUrl) row.thread_url = threadUrl;
      push(row);
    }
    // Seen live on 2026-10-14: some reply pages carry a top-level `cursor` for the next page, some none.
    out.next = str(root?.cursor) ?? str(root?.next_cursor);
  } else if (name === "social__reddit_search") {
    const children = arr(obj(data)?.children);
    out.raw = children.length;
    for (const c of children) {
      const p = obj(obj(c)?.post);
      const id = str(p?.id);
      const url = redditLink(p?.permalink);
      const title = str(p?.postTitle) ?? str(p?.title);
      if (!p || !id?.startsWith("t3_") || !url || !title) {
        out.dropped++;
        continue;
      }
      const body = str(obj(p.content)?.markdown) ?? "";
      push({
        id,
        source: "reddit",
        kind: "thread",
        url,
        text: `${title}\n${body}`.trim(),
        author: redditAuthor(p.authorInfo),
        created_at: iso(p.createdAt),
        score: num(p.score) ?? 0,
        replies: num(p.commentCount) ?? 0,
        thread_title: title,
        thread_url: url,
        community: str(obj(p.subreddit)?.prefixedName),
      });
    }
    const page = obj(obj(data)?.pageInfo);
    out.next = page?.hasNextPage === true ? str(page.endCursor) : null;
  } else if (name === "social__reddit_post_comments") {
    const info = obj(obj(data)?.postInfoById);
    if (!info) {
      out.error = "postInfoById is null: the post was removed or does not exist";
      return out;
    }
    const title = str(info.title);
    const community = str(obj(info.subreddit)?.prefixedName);
    const bodies = new Map();
    let threadUrl = null;
    for (const tr of arr(obj(info.commentForest)?.trees)) {
      const tree = obj(tr);
      const more = obj(tree?.more);
      if (more) {
        if (tree.depth === 0 && str(more.cursor)) out.next = more.cursor;
        continue;
      }
      const n = obj(tree?.node);
      if (!n) continue;
      out.raw++;
      const id = str(n.id);
      const url = redditLink(n.permalink);
      const body = str(obj(n.content)?.markdown);
      const author = redditAuthor(n.authorInfo);
      if (!id?.startsWith("t1_") || !url || !body || body === "[deleted]" || body === "[removed]" || author === "AutoModerator") {
        out.dropped++;
        continue;
      }
      threadUrl ??= url.replace(/[^/]+\/?$/, "");
      bodies.set(id, body);
      const parent = str(tree.parentId) ? bodies.get(tree.parentId) : null;
      push({
        id,
        source: "reddit",
        kind: "comment",
        url,
        text: body,
        author,
        created_at: iso(n.createdAt),
        score: num(n.score) ?? 0,
        replies: num(tree.childCount) ?? 0,
        ...(title ? { thread_title: title } : {}),
        community,
        ...(parent ? { parent_text: parent.replace(/\s+/g, " ").slice(0, 240) } : {}),
      });
    }
    for (const r of out.rows) if (threadUrl) r.thread_url = threadUrl;
    if (obj(obj(info.commentForest)?.pageInfo)?.hasNextPage !== true) out.next = null;
  } else if (name === "social__xiaohongshu_search_notes") {
    const d = obj(data);
    if (d?.success === false || (typeof d?.code === "number" && d.code !== 0)) {
      out.error = `Rednote answered code ${d?.code}: ${str(d?.msg) ?? "no message"}`;
      return out;
    }
    const items = arr(obj(d?.data)?.items);
    out.raw = items.length;
    for (const it of items) {
      const n = obj(obj(it)?.note);
      // Ads carry their note under `ads`, not `note`: promotion is never evidence.
      const id = xhsId(n?.id);
      const user = obj(n?.user);
      const title = str(n?.title)?.trim() || null;
      const desc = str(n?.desc)?.trim() || "";
      const text = [title, desc].filter(Boolean).join("\n");
      if (!n || !id || !xhsId(user?.userid) || !text) {
        out.dropped++;
        continue;
      }
      const url = xhsNoteLink(id, n.xsec_token);
      push({
        id: `xhs_${id}`,
        source: "rednote",
        kind: "note",
        url,
        text,
        // Search returns only the start of a note's body (about 60 characters, seen live).
        excerpt: true,
        author: user.userid,
        ...(str(user.nickname) ? { author_name: user.nickname } : {}),
        ...(str(user.images) ? { author_avatar: user.images } : {}),
        created_at: fromSeconds(n.timestamp),
        score: num(n.liked_count) ?? 0,
        replies: num(n.comments_count) ?? 0,
        ...(title ? { thread_title: title } : {}),
        thread_url: url,
      });
    }
    // Later pages: the same keyword and filters, the next page, and both ids from the first page (seen live: page 2
    // echoed the same pair and returned new notes).
    const page = num(d?.next_page);
    out.next = page && str(d?.search_id) && str(d?.search_session_id) ? JSON.stringify({ page, search_id: d.search_id, search_session_id: d.search_session_id }) : null;
  } else if (name === "social__xiaohongshu_note_comments") {
    const d = obj(data);
    if (d?.success === false || (typeof d?.code === "number" && d.code !== 0)) {
      out.error = `Rednote answered code ${d?.code}: ${str(d?.msg) ?? "no message"}`;
      return out;
    }
    const body = obj(d?.data);
    const list = arr(body?.comments);
    // A comment has no link of its own: it cites its note. Pass the note's link from the search (it carries the
    // xsec_token the page needs) with --note-url; otherwise the bare note link is used.
    const noteId = xhsId(list.map((c) => obj(c)?.note_id).find(xhsId));
    const given = str(noteUrl)?.match(XHS_NOTE_LINK);
    const link = given && (!noteId || given[1] === noteId) ? noteUrl : noteId ? xhsNoteLink(noteId) : null;
    const row = (c, parent) => {
      const id = xhsId(c?.id);
      const user = obj(c?.user);
      const text = str(c?.content)?.trim();
      if (!id || !link || !text || !xhsId(user?.userid) || c.hidden === true || c.invalid === true) return null;
      return {
        id: `xhsc_${id}`,
        source: "rednote",
        kind: "comment",
        url: link,
        text,
        author: user.userid,
        ...(str(user.nickname) ? { author_name: user.nickname } : {}),
        ...(str(user.images) ? { author_avatar: user.images } : {}),
        created_at: fromSeconds(c.time),
        score: num(c.like_count) ?? 0,
        replies: num(c.sub_comment_count) ?? 0,
        ...(str(noteTitle) ? { thread_title: noteTitle } : {}),
        thread_url: link,
        ...(parent ? { parent_text: parent.replace(/\s+/g, " ").slice(0, 240) } : {}),
      };
    };
    for (const c of list) {
      const top = obj(c);
      out.raw++;
      push(row(top, null));
      // Each top-level comment arrives with its first reply or two; more replies need their own cursor (not followed).
      for (const sub of arr(top?.sub_comments)) {
        out.raw++;
        push(row(obj(sub), str(top?.content)));
      }
    }
    // The next page: pass this cursor back (it is a JSON string Rednote made; send it unchanged).
    out.next = body?.has_more === true && str(body?.cursor) ? body.cursor : null;
  } else {
    out.error = `unsupported tool ${tool}; use social__x_search, social__x_post_comments, social__reddit_search, social__reddit_post_comments, social__xiaohongshu_search_notes or social__xiaohongshu_note_comments`;
  }
  return out;
}
