// Rednote (Xiaohongshu) support, checked against three real CoreSpeed payloads recorded on 2026-10-14
// (fixtures/README.md), plus the source-selection rules every source shares.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePayload, unwrap } from "../../skills/consensus/scripts/normalize.mjs";
import { computeStats, linkProblem, safeLink, threadKey, toViewerState, validateResult } from "../../skills/consensus/scripts/result.mjs";
import { sampleResult } from "./sample.mjs";

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const search = () => normalizePayload("social__xiaohongshu_search_notes", fx("xiaohongshu_search_p1.json"));
const NOTE = "6ac70dba000000000a023d25";

test("rednote search: notes become rows; the ad is dropped; ids, dates and counts come from the payload", () => {
  const r = search();
  assert.equal(r.error, null);
  assert.equal(r.raw, 6);
  assert.equal(r.rows.length, 5);
  assert.equal(r.dropped, 1, "the ad item has no `note` and is never evidence");
  const n = r.rows.find((x) => x.id === `xhs_${NOTE}`);
  assert.equal(n.source, "rednote");
  assert.equal(n.kind, "note");
  assert.equal(n.thread_title, "为什么已经很少听到cursor了？");
  assert.ok(n.text.startsWith("为什么已经很少听到cursor了？\n上周一个做后端的朋友"));
  assert.equal(n.excerpt, true, "search gives only the start of the body");
  assert.equal(n.created_at, "2026-10-08T03:27:55Z", "timestamp is Unix seconds");
  assert.equal(n.score, 246);
  assert.equal(n.replies, 274);
  assert.match(n.author, /^[0-9a-f]{24}$/);
  assert.equal(n.author_name, "俊哥儿乐____");
  assert.match(n.author_avatar, /^https:\/\/sns-avatar-[a-z]+\.xhscdn\.com\//);
});

test("rednote search: the link keeps the note's xsec_token (without it the page says the note cannot be viewed)", () => {
  const n = search().rows.find((x) => x.id === `xhs_${NOTE}`);
  assert.match(n.url, new RegExp(`^https://www\\.xiaohongshu\\.com/explore/${NOTE}\\?xsec_token=[^&#\\s]+$`));
  assert.equal(n.thread_url, n.url);
  assert.equal(linkProblem(n), null);
});

test("rednote search: an untitled note is kept, with its body as the text and no title", () => {
  const n = search().rows.find((x) => x.id === "xhs_6999cda0000000000a03f29b");
  assert.ok(n);
  assert.equal(n.thread_title, undefined);
  assert.ok(n.text.startsWith("极限二选一，Cursor or Claude Code"));
});

test("rednote search: the next page pairs page 2 with this search's own search_id and search_session_id", () => {
  const p1 = JSON.parse(fx("xiaohongshu_search_p1.json"));
  const next = JSON.parse(search().next);
  assert.deepEqual(next, { page: 2, search_id: p1.search_id, search_session_id: p1.search_session_id });
  // Recorded live: page 2, sent with that pair, echoed the same pair and returned new notes.
  const p2raw = JSON.parse(fx("xiaohongshu_search_p2.json"));
  assert.equal(p2raw.search_id, p1.search_id);
  assert.equal(p2raw.search_session_id, p1.search_session_id);
  assert.equal(p2raw.page, 2);
  const p2 = normalizePayload("social__xiaohongshu_search_notes", fx("xiaohongshu_search_p2.json"));
  assert.equal(p2.rows.length, 2);
  const ids1 = new Set(search().rows.map((x) => x.id));
  for (const row of p2.rows) assert.ok(!ids1.has(row.id), "page 2 brings new notes");
  assert.equal(JSON.parse(p2.next).page, 3);
});

test("rednote comments: top-level comments and their loaded replies, cited to the note with its token", () => {
  const noteUrl = search().rows.find((x) => x.id === `xhs_${NOTE}`).url;
  const r = normalizePayload("social__xiaohongshu_note_comments", fx("xiaohongshu_note_comments.json"), { noteUrl, noteTitle: "为什么已经很少听到cursor了？" });
  assert.equal(r.error, null);
  assert.equal(r.raw, 8, "4 comments, each with 1 reply loaded");
  assert.equal(r.rows.length, 8);
  const top = r.rows[0];
  assert.equal(top.id, "xhsc_6ac715a5000000001001eca1");
  assert.equal(top.kind, "comment");
  assert.equal(top.text, "我还在用啊，不用梯子不封号，很好用很方便啊");
  assert.equal(top.url, noteUrl, "a comment has no link of its own");
  assert.equal(top.thread_url, noteUrl);
  assert.equal(top.thread_title, "为什么已经很少听到cursor了？");
  assert.equal(top.created_at, "2026-10-08T04:01:42Z");
  assert.equal(top.score, 31);
  assert.match(top.author, /^[0-9a-f]{29}$/, "commenter ids are 29 characters, unlike note authors");
  assert.match(top.author_avatar, /^https:\/\/sns-avatar-[a-z]+\.rednotecdn\.com\//);
  const reply = r.rows[1];
  assert.equal(reply.parent_text, top.text);
  for (const row of r.rows) assert.equal(linkProblem(row), null);
  // has_more with a cursor: the next page passes it back unchanged (a JSON string Rednote made).
  assert.deepEqual(Object.keys(JSON.parse(r.next)).sort(), ["contextId", "cursor", "index", "pageArea"]);
});

test("rednote comments: without --note-url the bare note link is used; a link for another note is ignored", () => {
  const bare = normalizePayload("social__xiaohongshu_note_comments", fx("xiaohongshu_note_comments.json"));
  assert.equal(bare.rows[0].url, `https://www.xiaohongshu.com/explore/${NOTE}`);
  const wrong = normalizePayload("social__xiaohongshu_note_comments", fx("xiaohongshu_note_comments.json"), { noteUrl: "https://www.xiaohongshu.com/explore/6a2c48480000000007029d60?xsec_token=x" });
  assert.equal(wrong.rows[0].url, `https://www.xiaohongshu.com/explore/${NOTE}`);
});

test("rednote: an empty page, an error code, an isError result and a clipped payload", () => {
  const empty = JSON.parse(fx("xiaohongshu_note_comments.json"));
  empty.data.comments = [];
  empty.data.has_more = false;
  const e = normalizePayload("social__xiaohongshu_note_comments", JSON.stringify(empty));
  assert.deepEqual([e.rows.length, e.raw, e.next, e.error], [0, 0, null, null]);

  const failed = JSON.parse(fx("xiaohongshu_search_p1.json"));
  failed.success = false;
  failed.code = 1;
  failed.msg = "x";
  assert.match(normalizePayload("social__xiaohongshu_search_notes", JSON.stringify(failed)).error, /code 1/);

  const isError = JSON.stringify({ content: [{ type: "text", text: "Input validation error: keyword" }], isError: true });
  assert.match(normalizePayload("social__xiaohongshu_search_notes", isError).error, /Input validation error/);

  // A made-up notice: the public docs promise a truncation notice, not its wording.
  const clipped = fx("xiaohongshu_search_p1.json").slice(0, 4000) + "\n(output truncated here)";
  const c = normalizePayload("social__xiaohongshu_search_notes", clipped);
  assert.equal(c.truncated, true);
  assert.equal(c.rows.length, 0);
  assert.equal(unwrap(clipped).truncated, true);
});

test("rednote links: only well-formed note links on www.xiaohongshu.com, with matching ids", () => {
  const ok = { source: "rednote", id: `xhs_${NOTE}`, url: `https://www.xiaohongshu.com/explore/${NOTE}?xsec_token=abc` };
  assert.equal(linkProblem(ok), null);
  for (const url of [
    `http://www.xiaohongshu.com/explore/${NOTE}`,
    `https://xiaohongshu.com.evil.example/explore/${NOTE}`,
    `https://www.xiaohongshu.com/explore/${NOTE}/../../x`,
    `javascript:alert(1)//www.xiaohongshu.com/explore/${NOTE}`,
    `https://www.xiaohongshu.com/explore/6a2c48480000000007029d60`,
  ])
    assert.ok(linkProblem({ ...ok, url }), url);
  const comment = { source: "rednote", id: "xhsc_6ac715a5000000001001eca1", url: ok.url, thread_url: ok.url };
  assert.equal(linkProblem(comment), null);
  assert.match(linkProblem({ ...comment, thread_url: undefined }), /needs thread_url/);
  assert.match(linkProblem({ ...comment, thread_url: "https://www.xiaohongshu.com/explore/6a2c48480000000007029d60" }), /must be its note's link/);
  assert.match(linkProblem({ ...ok, id: "rn_1" }), /xhs_/);
  assert.equal(safeLink("https://sns-avatar-qc.rednotecdn.com/avatar/x.jpg", ["rednotecdn.com"]), "https://sns-avatar-qc.rednotecdn.com/avatar/x.jpg");
});

test("rednote thread key ignores the link token, so one note is one thread for the per-author rule", () => {
  const a = { source: "rednote", url: `https://www.xiaohongshu.com/explore/${NOTE}?xsec_token=a`, thread_url: `https://www.xiaohongshu.com/explore/${NOTE}?xsec_token=a` };
  const b = { ...a, url: `https://www.xiaohongshu.com/explore/${NOTE}?xsec_token=b`, thread_url: undefined };
  assert.equal(threadKey(a), threadKey(b));
});

/** The sample result with three Rednote posts added from the real fixtures. */
function threeSources() {
  const r = sampleResult();
  const notes = search().rows;
  const comments = normalizePayload("social__xiaohongshu_note_comments", fx("xiaohongshu_note_comments.json"), { noteUrl: notes.find((x) => x.id === `xhs_${NOTE}`).url }).rows;
  r.sources = ["reddit", "x", "rednote"];
  r.posts.push({ ...notes[0], label: "both", strength: 2 }, { ...comments[0], label: "cost", strength: 2 }, { ...comments[2], label: "none", strength: 0 });
  r.usage = { ...r.usage, requests: 5, budget: 14, budget_by_source: { reddit: 5, x: 4, rednote: 5 }, rates: { social__xiaohongshu_search_notes: 15, social__xiaohongshu_note_comments: 15 }, by_tool: { ...r.usage.by_tool, social__xiaohongshu_search_notes: 1, social__xiaohongshu_note_comments: 1 } };
  r.coverage.rednote = { searches: 1, pages: 1, notes_returned: 5, notes_kept: 5, comment_pages: 1, comments_read: 8 };
  return r;
}

test("three sources: valid, counted per source, each tool at its own stated rate", () => {
  const r = threeSources();
  const v = validateResult(r);
  assert.deepEqual(v.errors, []);
  const s = computeStats(r);
  assert.deepEqual(s.bySource.rednote, { read: 3, counted: 2 });
  assert.equal(s.bySource.reddit.counted + s.bySource.x.counted + s.bySource.rednote.counted, s.counted);
  // 3 Reddit/X requests at 1.5 + 2 Rednote requests at 15.
  assert.equal(s.credits, 3 * 1.5 + 2 * 15);
  assert.equal(s.mixedRates, true);
  const both = s.options.find((o) => o.id === "both");
  assert.equal(both.rednote, 1);
});

test("three sources: unknown-charge requests are priced at their tool's rate, or the highest rate when not known", () => {
  const r = threeSources();
  r.usage.failed = 2;
  r.usage.unknown_charge = 2;
  assert.equal(computeStats(r).creditsMax, computeStats(r).credits + 2 * 15, "unattributed unknowns take the highest rate");
  r.usage.unknown_by_tool = { social__x_search: 1, social__xiaohongshu_search_notes: 1 };
  assert.equal(computeStats(r).creditsMax, computeStats(r).credits + 1.5 + 15);
  r.usage.unknown_by_tool = { social__x_search: 3 };
  assert.ok(validateResult(r).errors.some((e) => /unknown_by_tool/.test(e)));
});

test("selected sources: one fixed budget is split, never multiplied", () => {
  const r = threeSources();
  r.usage.budget_by_source = { reddit: 14, x: 14, rednote: 14 };
  assert.ok(validateResult(r).errors.some((e) => /must add up to the total budget \(14\)/.test(e)));
  r.usage.budget_by_source = { reddit: 7, x: 7 };
  assert.deepEqual(validateResult(r).errors, []);
  r.usage.budget_by_source = { reddit: 7, linkedin: 7 };
  assert.ok(validateResult(r).errors.some((e) => /budget_by_source/.test(e)));
  const two = sampleResult();
  two.usage.budget_by_source = { reddit: 7, x: 4, rednote: 3 };
  assert.ok(validateResult(two).errors.some((e) => /not in sources/.test(e)), "a source that was not selected cannot get budget");
});

test("selected sources: a post from a source the run did not select is an error; unknown sources are refused", () => {
  const r = sampleResult();
  r.posts.push({ ...search().rows[0], label: "none", strength: 0 });
  assert.ok(validateResult(r).errors.some((e) => /"rednote" is not in sources/.test(e)));
  const li = sampleResult();
  li.sources = ["reddit", "linkedin"];
  assert.ok(validateResult(li).errors.some((e) => /^sources:/.test(e)));
  const dup = sampleResult();
  dup.sources = ["reddit", "x", "x"];
  assert.ok(validateResult(dup).errors.some((e) => /twice/.test(e)));
});

test("viewer state: per-source counts for every option, Rednote kinds, safe links only", () => {
  const st = toViewerState(threeSources(), Date.parse("2026-10-14T12:00:00Z") / 1000);
  for (const o of st.poll.options) assert.deepEqual(Object.keys(o.by_source).sort(), ["reddit", "rednote", "x"]);
  const sum = st.poll.options.reduce((a, o) => a + o.by_source.rednote, 0);
  assert.equal(sum, 2);
  const note = Object.values(st.posts).find((p) => p.source === "rednote" && p.kind === "opener");
  assert.ok(note, "a note renders like a thread opener: title in bold, then the excerpt");
  assert.equal(note.excerpt, true);
  assert.equal(note.author.profile_url, null, "no profile link is guessed for Rednote");
  assert.match(note.url, /^https:\/\/www\.xiaohongshu\.com\/explore\//);
  assert.deepEqual(st.meta.sources, ["reddit", "x", "rednote"]);
});

test("the recorded Rednote example validates, and its one warning is disclosed in its limits", () => {
  const r = JSON.parse(readFileSync(new URL("../../skills/consensus/examples/rednote-cursor-vs-claude-code.json", import.meta.url), "utf8"));
  const v = validateResult(r);
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.issues.map((x) => x.code), ["thread_option"]);
  assert.ok(r.limits.some((l) => l.includes("6 票")), "the limits name the dominant thread");
  assert.equal(r.language, "zh-CN");
  assert.deepEqual(r.sources, ["rednote"]);
  const s = computeStats(r);
  assert.deepEqual([s.counted, s.read, s.credits, s.creditsMax], [23, 60, 45, 45]);
});
