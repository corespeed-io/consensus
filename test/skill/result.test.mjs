import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, linkProblem, quoteInText, safeLink, scriptSafeJson, toViewerState, validateResult } from "../../skills/consensus/scripts/result.mjs";
import { clone, sampleResult } from "./sample.mjs";

const errorsOf = (r) => validateResult(r).errors;

test("the sample result is valid and its counts follow the labels", () => {
  const v = validateResult(sampleResult());
  assert.deepEqual(v.errors, []);
  const s = v.stats;
  assert.equal(s.sorted, 11);
  assert.equal(s.spam, 1);
  assert.equal(s.none, 2);
  assert.equal(s.counted, 8);
  const by = Object.fromEntries(s.options.map((o) => [o.id, o]));
  assert.equal(by.quality.count, 3);
  assert.equal(by.quality.reddit, 2);
  assert.equal(by.quality.x, 1);
  assert.equal(by.cost.count, 3);
  assert.equal(by.both.count, 1);
  assert.equal(by.other.count, 1);
  assert.equal(by.quality.share, 37.5);
  assert.equal(s.credits, 4.5);
  assert.equal(s.read, 40);
  assert.ok(s.thin, "8 opinions is a thin sample");
  assert.ok(v.warnings.some((w) => /only 8 opinions/.test(w)));
  assert.ok(v.warnings.some((w) => /"Uses both" has 1 vote/.test(w)));
});

test("population and market-share claims in the summary are refused", () => {
  for (const summary of ["72% of developers prefer Claude Code.", "Claude Code is winning market share.", "60 % of users switched"]) {
    const r = sampleResult();
    r.summary = summary;
    assert.ok(errorsOf(r).some((e) => e.startsWith("summary:")), summary);
  }
});

test("links: only well-formed https X and Reddit post links that match the post id", () => {
  const bad = [
    ["x", "x_2041912159190577403", "javascript:alert(1)"],
    ["x", "x_2041912159190577403", "http://x.com/MahamDev/status/2041912159190577403"],
    ["x", "x_2041912159190577403", "https://x.com.evil.test/MahamDev/status/2041912159190577403"],
    ["x", "x_2041912159190577403", "https://x.com/MahamDev/status/1111111111111111111"],
    ["x", "x_2041912159190577403", "https://x.com/Maham Dev/status/2041912159190577403"],
    ["x", "x_2041912159190577403", "data:text/html,<script>alert(1)</script>"],
    ["reddit", "t1_pfdweev", "https://www.reddit.com/r/cursor/comments/1x3r2hw/slug/zzzzzzz/"],
    ["reddit", "t1_pfdweev", "https://evil.test/r/cursor/comments/1x3r2hw/slug/pfdweev/"],
    ["reddit", "t3_1x3r2hw", "https://www.reddit.com/r/cursor/comments/aaaaaaa/slug/"],
    ["reddit", "x_1", "https://www.reddit.com/r/cursor/comments/1x3r2hw/"],
  ];
  for (const [source, id, url] of bad) assert.ok(linkProblem({ source, id, url }), `${url} should be refused`);
  assert.equal(linkProblem({ source: "x", id: "x_2041912159190577403", url: "https://x.com/MahamDev/status/2041912159190577403" }), null);
  assert.equal(linkProblem({ source: "x", id: "x_2041912159190577403", url: "https://twitter.com/MahamDev/status/2041912159190577403?s=20" }), null);
  assert.equal(linkProblem({ source: "reddit", id: "t1_pfdweev", url: "https://www.reddit.com/r/cursor/comments/1x3r2hw/anyone_still_using/pfdweev/" }), null);
  assert.equal(linkProblem({ source: "reddit", id: "t3_1x3r2hw", url: "https://old.reddit.com/r/cursor/comments/1x3r2hw/" }), null);
});

test("a result with a javascript: link is refused as a whole", () => {
  const r = sampleResult();
  r.posts[0].url = "javascript:alert(document.cookie)";
  assert.ok(errorsOf(r).some((e) => /posts\[0\].*url/.test(e)));
});

test("safeLink only passes https links on the allowed hosts", () => {
  assert.equal(safeLink("javascript:alert(1)", ["x.com"]), null);
  assert.equal(safeLink("https://pbs.twimg.com.evil.test/a.jpg", ["twimg.com"]), null);
  assert.equal(safeLink("http://pbs.twimg.com/a.jpg", ["twimg.com"]), null);
  assert.equal(safeLink("https://pbs.twimg.com/a.jpg", ["twimg.com"]), "https://pbs.twimg.com/a.jpg");
  assert.equal(safeLink(" https://x.com/a/status/12345 ", ["x.com"]), "https://x.com/a/status/12345");
});

test("quotes must be verbatim (curly quotes, markdown and marked cuts are tolerated)", () => {
  const text = "I’ve been using **Claude Code** for months, and honestly the agent loop is just better than Cursor's.";
  assert.ok(quoteInText("I've been using Claude Code for months", text));
  assert.ok(quoteInText("I’ve been using Claude Code … the agent loop is just better", text));
  assert.ok(!quoteInText("the agent loop is far better", text));
  assert.ok(!quoteInText("the agent loop is just better … I’ve been using", text), "pieces must be in order");
  const r = sampleResult();
  r.options[0].quotes = [{ post: "t1_pfdweev", text: "Claude Code is perfect and Cursor is dead" }];
  assert.ok(errorsOf(r).some((e) => /not found verbatim/.test(e)));
  r.options[0].quotes = [{ post: "t1_pffdt4y", text: "the quality is so good" }];
  assert.ok(errorsOf(r).some((e) => /labelled "cost", not "quality"/.test(e)));
});

test("labels, strengths and theme references are checked", () => {
  let r = sampleResult();
  r.posts[0].label = "unknown";
  assert.ok(errorsOf(r).some((e) => /label: must be one of/.test(e)));
  r = sampleResult();
  r.posts[0].strength = 0;
  assert.ok(errorsOf(r).some((e) => /a vote needs strength 1 to 3/.test(e)));
  r = sampleResult();
  r.posts[5].strength = 2;
  assert.ok(errorsOf(r).some((e) => /none and spam take strength 0/.test(e)));
  r = sampleResult();
  r.posts[0].themes = ["nope"];
  assert.ok(errorsOf(r).some((e) => /unknown theme/.test(e)));
  r = sampleResult();
  r.posts.push(clone(r.posts[0]));
  assert.ok(errorsOf(r).some((e) => /listed twice/.test(e)));
  r = sampleResult();
  r.options.push({ id: "other", title: "x" });
  assert.ok(errorsOf(r).some((e) => /reserved/.test(e)));
});

test("usage arithmetic must be honest", () => {
  let r = sampleResult();
  r.usage.requests = 20;
  r.usage.budget = 14;
  assert.ok(errorsOf(r).some((e) => /exceeds the budget/.test(e)));
  r = sampleResult();
  r.usage.by_tool.social__x_search = 5;
  assert.ok(errorsOf(r).some((e) => /adds up to 7, but requests is 3/.test(e)));
});

test("posts outside the stated window are refused", () => {
  const r = sampleResult();
  r.window.since = "2026-09-01";
  // The fixture's first tweet is from 2026-04-08.
  assert.ok(errorsOf(r).some((e) => /x_2041912159190577403.*before the window/.test(e)));
});

test("viewer state: counts, shares, colours and order follow the labels", () => {
  const r = sampleResult();
  const st = toViewerState(r, Date.parse("2026-10-14T12:00:00Z") / 1000);
  const s = computeStats(r);
  assert.equal(st.poll.total_opinions, s.counted);
  assert.equal(Object.keys(st.posts).length, s.counted, "only counted opinions are listed");
  const sum = st.poll.options.reduce((a, o) => a + o.count, 0);
  assert.equal(sum, s.counted, "the donut equals the list");
  assert.equal(st.poll.options.at(-1).id, "other", "Other is last");
  assert.deepEqual(
    st.poll.options.map((o) => [o.title, o.count, o.percent]),
    [
      ["Better results", 3, 37.5],
      ["Better value", 3, 37.5],
      ["Uses both", 1, 12.5],
      ["Other", 1, 12.5],
    ],
  );
  assert.equal(st.options[0].id, "o0", "internal ids keep upstream's colour order");
  assert.equal(st.reasons.o0.points[0].post_id, "t1_pfdweev");
  assert.equal(st.themes[0].count, 3);
  assert.equal(st.poll.pool.removed_spam, 1);
  assert.equal(st.poll.pool.no_stance, 2);
  assert.equal(st.done.status, "thin");
  assert.equal(st.meta.cached, true, "a snapshot, never a live run");
  assert.ok(st.done.quality.flags.includes("thin_pool"));
});

test("viewer state drops avatars that are not https images on X or Reddit hosts", () => {
  const r = sampleResult();
  r.posts[9].author_avatar = "javascript:alert(1)";
  r.posts[0].author_avatar = "https://evil.test/a.png";
  const st = toViewerState(r);
  assert.equal(st.posts[r.posts[9].id].author.avatar, null);
  assert.equal(st.authors[r.posts[0].author], undefined);
});

test("scriptSafeJson cannot end its script element and round-trips", () => {
  const nasty = { a: "</script><script>alert(1)</script>", b: "<!-- x -->", c: "line sep ", d: "&amp; <img src=x onerror=alert(1)>" };
  const s = scriptSafeJson(nasty);
  assert.ok(!/<\/script/i.test(s));
  assert.ok(!s.includes("<!--"));
  assert.ok(!s.includes("<"));
  assert.ok(!s.includes(" ") && !s.includes(" "));
  assert.deepEqual(JSON.parse(s), nasty);
});

test("the funnel must reconcile: read = dropped before sorting + sorted", () => {
  const r = sampleResult();
  r.coverage.posts_read = 40;
  let v = validateResult(r);
  assert.ok(v.warnings.some((w) => /29 posts were read but not sorted/.test(w)));
  r.coverage.dropped_before_sorting = { count: 29, reasons: ["29 off-topic"] };
  v = validateResult(r);
  assert.ok(!v.warnings.some((w) => /posts_read|read but not sorted/.test(w)));
  assert.equal(v.stats.dropped, 29);
  assert.equal(v.stats.read, 40);
  r.coverage.dropped_before_sorting.count = 5;
  assert.ok(validateResult(r).warnings.some((w) => /posts_read \(40\) is not dropped_before_sorting \(5\) \+ posts sorted \(11\)/.test(w)));
  r.coverage.dropped_before_sorting = { count: -1 };
  assert.ok(validateResult(r).errors.some((e) => /dropped_before_sorting/.test(e)));
});

test("rubric limits a reader would notice come back as warnings", () => {
  const r = sampleResult();
  r.options[1].description = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen";
  r.themes.push({ id: "lonely", title: "Lonely theme" });
  r.posts[2].themes = ["lonely"];
  const w = validateResult(r).warnings;
  assert.ok(w.some((x) => /"Better value": description is over 15 words/.test(x)));
  assert.ok(w.some((x) => /theme "Lonely theme" has 1 counted post/.test(x)));
  // t1_pfdweev and t1_pffd9ad: different authors; give them one author in one thread.
  r.posts[1].author = r.posts[0].author;
  assert.ok(validateResult(r).warnings.some((x) => /has 2 votes in one thread/.test(x)));
});

test("one thread dominating the sample is flagged; the real example is not", async () => {
  const { readFileSync } = await import("node:fs");
  const real = JSON.parse(readFileSync(new URL("../../skills/consensus/examples/cursor-to-claude-code.json", import.meta.url), "utf8"));
  const v = validateResult(real);
  assert.deepEqual(v.errors, []);
  // Its only warning is the honest one: 17 requests sent (3 retries after connection resets) against a budget of 14.
  assert.deepEqual(v.warnings, ["usage: 17 requests were sent (successful + failed, retries included), over the budget of 14"]);
  assert.equal(v.stats.credits, 21);
  assert.equal(v.stats.creditsMax, 25.5);
  assert.equal(v.stats.counted, 45);
  // Put every X-search "stayed" vote (8) into the one reply thread that already holds 9 votes (3 of them "stayed"):
  // 17 of 45 overall (over a third) and 11 of 16 "stayed" votes (over half).
  const seed = "https://x.com/indiemark_/status/2081841086696177803";
  const skewed = clone(real);
  for (const p of skewed.posts) if (p.source === "x" && !p.thread_url && p.label === "stayed") p.thread_url = seed;
  const w = validateResult(skewed).warnings;
  assert.ok(w.some((x) => x.includes(`one thread supplies 17 of 45 counted opinions (${seed})`)), w.join("\n"));
  assert.ok(w.some((x) => x.includes(`one thread supplies 11 of the 16 votes for "stayed"`)), w.join("\n"));
});

test("cost: the budget counts every request sent, and transport failures widen the cost to a range", () => {
  const r = sampleResult();
  r.usage = { requests: 3, failed: 2, unknown_charge: 1, credits_per_request: 1.5, budget: 4, by_tool: { social__reddit_search: 1, social__reddit_post_comments: 1, social__x_search: 1 } };
  const v = validateResult(r);
  assert.deepEqual(v.errors, []);
  assert.equal(v.stats.sent, 5);
  assert.equal(v.stats.credits, 4.5);
  assert.equal(v.stats.creditsMax, 6);
  assert.ok(v.warnings.some((w) => /5 requests were sent .* over the budget of 4/.test(w)));
  r.usage.unknown_charge = 3;
  assert.ok(validateResult(r).errors.some((e) => /unknown_charge/.test(e)), "unknown_charge cannot exceed failed");
});
