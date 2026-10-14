// The viewer prints many result fields as text and adds up usage counts. A malformed file must be refused with an
// error, never crash the validator, never render a blank page, and never produce a negative or invented cost.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStats, toViewerState, validateResult } from "../../skills/consensus/scripts/result.mjs";
import { clone, sampleResult } from "./sample.mjs";

const errorsFor = (mutate) => {
  const r = clone(sampleResult());
  mutate(r);
  return validateResult(r).errors;
};

test("text the viewer prints must be text", () => {
  const cases = {
    limits: (r) => (r.limits = [{ bad: 1 }]),
    "coverage.notes": (r) => (r.coverage.notes = ["ok", 3]),
    "coverage.dropped_before_sorting": (r) => (r.coverage.dropped_before_sorting = { count: 1, reasons: [null] }),
    queries: (r) => (r.queries = [null]),
    "queries tool": (r) => (r.queries = [{ tool: 5 }]),
    "queries args": (r) => (r.queries = [{ tool: "social__x_search", args: "x" }]),
    analysis: (r) => (r.analysis = { by: { name: "x" } }),
    "other.why": (r) => (r.other = { why: 5 }),
    "other.also_mentioned": (r) => (r.other = { also_mentioned: [{ title: 1, count: 1 }] }),
    "post community": (r) => (r.posts[0].community = { name: "r/x" }),
    "post author_name": (r) => (r.posts[0].author_name = 7),
    "post replies": (r) => (r.posts[0].replies = "many"),
  };
  for (const [name, mutate] of Object.entries(cases)) assert.ok(errorsFor(mutate).length > 0, `${name} should be refused`);
});

test("a post id that is not text is an error, not a crash", () => {
  for (const id of [12345, null, { x: 1 }]) {
    let errors;
    assert.doesNotThrow(() => (errors = errorsFor((r) => (r.posts[0].id = id))));
    assert.ok(errors.some((e) => /posts\[0\]/.test(e)), String(id));
  }
});

test("usage counts are whole, non-negative numbers, so the cost can never go negative", () => {
  const negative = errorsFor((r) => {
    r.usage.requests = 3;
    r.usage.rates = { social__x_search: 1.5, social__xiaohongshu_search_notes: 15 };
    r.usage.by_tool = { social__x_search: 10, social__xiaohongshu_search_notes: -7 };
  });
  assert.ok(negative.some((e) => /usage\.by_tool/.test(e)));
  assert.ok(errorsFor((r) => (r.usage.by_tool = { social__x_search: 1.5, social__reddit_search: 1.5 })).some((e) => /usage\.by_tool/.test(e)));
  assert.ok(errorsFor((r) => (r.usage.failures = { timeout: -1 })).some((e) => /usage\.failures/.test(e)));
  assert.ok(errorsFor((r) => (r.coverage.reddit = { searches: -1 })).some((e) => /coverage\.reddit/.test(e)));
});

test("a valid file always maps to viewer state, and its cost is never negative", () => {
  const r = sampleResult();
  assert.deepEqual(validateResult(r).errors, []);
  assert.doesNotThrow(() => toViewerState(r));
  assert.ok(computeStats(r).credits >= 0);
});
