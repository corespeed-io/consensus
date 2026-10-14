// Offline normalizers against real CoreSpeed payloads recorded on 2026-10-14 (fixtures/README.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizePayload, unwrap } from "../../skills/consensus/scripts/normalize.mjs";

const fx = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

test("x_search: ids, links, dates and counts come straight from the payload", () => {
  const r = normalizePayload("social__x_search", fx("x_search.json"));
  assert.equal(r.error, null);
  assert.equal(r.raw, 4);
  assert.equal(r.rows.length, 4);
  const first = r.rows[0];
  assert.equal(first.id, "x_2041912159190577403");
  assert.equal(first.url, "https://x.com/MahamDev/status/2041912159190577403");
  assert.equal(first.source, "x");
  assert.equal(first.kind, "post");
  assert.equal(first.created_at, "2026-04-08T16:12:50Z");
  assert.equal(first.score, 9);
  assert.match(first.author_avatar, /^https:\/\/pbs\.twimg\.com\/.*_bigger\./);
  assert.ok(r.next, "the next cursor is kept");
});

test("x_search: the client prefix is accepted and the window drops old posts", () => {
  const all = normalizePayload("mcp__corespeed__social__x_search", fx("x_search.json"));
  const recent = normalizePayload("social__x_search", fx("x_search.json"), { since: "2026-09-01" });
  assert.ok(recent.rows.length < all.rows.length);
  for (const row of recent.rows) assert.ok(row.created_at >= "2026-09-01");
});

test("x_post_comments: replies get the root as parent; the root author's own thread is not an answer", () => {
  const r = normalizePayload("social__x_post_comments", fx("x_post_comments.json"));
  assert.equal(r.raw, 4);
  for (const row of r.rows) {
    assert.equal(row.kind, "reply");
    assert.notEqual(row.author, "aiwithmayank");
    assert.ok(row.parent_text.length > 0);
    assert.match(row.url, /^https:\/\/x\.com\/\w+\/status\/\d+$/);
  }
});

test("reddit_search: threads use the permalink, never the outbound url", () => {
  const r = normalizePayload("social__reddit_search", fx("reddit_search_posts.json"));
  assert.equal(r.rows.length, 3);
  const t = r.rows[0];
  assert.equal(t.id, "t3_1x3r2hw");
  assert.equal(t.kind, "thread");
  assert.equal(t.url, "https://www.reddit.com/r/cursor/comments/1x3r2hw/anyone_still_using_cursor_next_to_claude_code/");
  assert.equal(t.community, "r/cursor");
  assert.equal(t.replies, 89);
  assert.ok(t.text.startsWith("Anyone still using Cursor next to Claude Code?"));
  assert.ok(r.next);
});

test("reddit_post_comments: 8 comments, parents linked, the depth-0 more cursor is the next page", () => {
  const r = normalizePayload("social__reddit_post_comments", fx("reddit_post_comments.json"));
  assert.equal(r.raw, 8);
  assert.equal(r.rows.length, 8);
  const reply = r.rows.find((x) => x.id === "t1_pffd9ad");
  assert.ok(reply.parent_text.startsWith("I am this close to cancel"));
  assert.equal(reply.url, "https://www.reddit.com/r/cursor/comments/1x3r2hw/anyone_still_using_cursor_next_to_claude_code/pffd9ad/");
  assert.equal(reply.thread_url, "https://www.reddit.com/r/cursor/comments/1x3r2hw/anyone_still_using_cursor_next_to_claude_code/");
  assert.match(r.next, /^commenttree:/);
});

test("a removed post (postInfoById null) is reported, not invented", () => {
  const r = normalizePayload("social__reddit_post_comments", fx("result_err_bogus.json"));
  assert.equal(r.rows.length, 0);
  assert.match(r.error, /removed or does not exist/);
});

test("isError results come back as errors", () => {
  const schema = normalizePayload("social__reddit_search", fx("result_err_schema.json"));
  assert.match(schema.error, /Input validation error/);
  const upstream = normalizePayload("social__x_post", fx("result_err_xpost.json"));
  assert.match(upstream.error, /upstream error/);
});

test("a truncated payload is flagged and nothing is guessed from it", () => {
  // A made-up notice: the public docs promise a truncation notice, not its wording.
  const text = fx("x_search.json").slice(0, 5000) + "\n(output truncated here)";
  const r = normalizePayload("social__x_search", text);
  assert.equal(r.truncated, true);
  assert.equal(r.rows.length, 0);
  assert.match(r.error, /truncated/);
  assert.equal(unwrap(text).truncated, true);
});

test("a whole payload whose last value mentions truncation is not mistaken for a clipped one", () => {
  const whole = JSON.stringify({ timeline: [], note: "nothing\ntruncated" });
  assert.equal(unwrap(whole).truncated, false);
  assert.equal(unwrap("not json at all").truncated, false);
});

test("tweet ids stay strings: a numeric id is refused, not rounded", () => {
  const payload = JSON.stringify({ timeline: [{ type: "tweet", tweet_id: 2041912159190577403, screen_name: "a", text: "a b c d e", created_at: "Wed Apr 08 16:12:50 +0000 2026" }] });
  assert.equal(normalizePayload("social__x_search", payload).rows.length, 0);
});

test("handles that could break a link are refused", () => {
  const payload = JSON.stringify({ timeline: [{ type: "tweet", tweet_id: "12345678", screen_name: "evil/../x", text: "one two three four five" }] });
  assert.equal(normalizePayload("social__x_search", payload).rows.length, 0);
});

test("x_post_comments: replies carry the root post as thread_url; a top-level cursor is the next page", () => {
  const r = normalizePayload("social__x_post_comments", fx("x_post_comments.json"));
  for (const row of r.rows) assert.equal(row.thread_url, "https://x.com/aiwithmayank/status/2027343277998149689");
  assert.equal(r.next, null, "the recorded page has no cursor");
  // The independent run on 2026-10-14 saw reply pages with a top-level `cursor` (an X timeline cursor).
  const withCursor = JSON.parse(fx("x_post_comments.json"));
  withCursor.cursor = "DAAKCgABHUk8iw5__0kLAAIAAAEI";
  assert.equal(normalizePayload("social__x_post_comments", JSON.stringify(withCursor)).next, "DAAKCgABHUk8iw5__0kLAAIAAAEI");
});
