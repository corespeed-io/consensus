// The recorded examples ship with the skill, so they must stay valid and match what the README says about them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeStats, validateResult } from "../../skills/consensus/scripts/result.mjs";

const ex = (f) => JSON.parse(readFileSync(new URL(`../../skills/consensus/examples/${f}`, import.meta.url), "utf8"));

test("every example validates with no errors", () => {
  for (const f of ["ai-ads-would-you-still-buy.json", "cursor-to-claude-code.json", "rednote-cursor-vs-claude-code.json"]) assert.deepEqual(validateResult(ex(f)).errors, [], f);
});

test("the AI-ad showcase: one English report, three sources, counts and cost as the README states", () => {
  const r = ex("ai-ads-would-you-still-buy.json");
  const v = validateResult(r);
  assert.deepEqual(v.warnings, []);
  assert.equal(r.language, "en");
  assert.equal(r.question, "Would you still buy the product if you knew the ad was AI-generated?");
  assert.deepEqual(r.sources, ["reddit", "x", "rednote"]);
  const s = computeStats(r);
  assert.equal(s.counted, 33);
  assert.equal(s.read, 391);
  assert.deepEqual({ reddit: s.bySource.reddit.counted, x: s.bySource.x.counted, rednote: s.bySource.rednote.counted }, { reddit: 8, x: 15, rednote: 10 });
  assert.deepEqual(Object.fromEntries(s.options.filter((o) => o.count).map((o) => [o.id, o.count])), { "wont-buy": 20, "not-if-shows-product": 9, depends: 2, "still-buy": 2 });
  // 18 Reddit and 14 X requests at 1.5, 5 Rednote requests at 15; nothing failed, so there is no range.
  assert.equal(s.credits, 123);
  assert.equal(s.creditsMax, 123);
  assert.equal(r.usage.requests, 37);
  assert.equal(r.usage.failed, 0);
});

test("the AI-ad showcase: one vote per author, and trust-only posts are not counted as answers", () => {
  const r = ex("ai-ads-would-you-still-buy.json");
  const votes = r.posts.filter((p) => !["none", "spam"].includes(p.label));
  const authors = new Set(votes.map((p) => `${p.source}:${p.author}`));
  assert.equal(authors.size, votes.length);
  const trustOnly = r.posts.find((p) => p.id === "t1_p84xe98");
  assert.equal(trustOnly.label, "none", "\"I lose respect for brands…\" says nothing about buying");
  assert.ok(r.coverage.notes.some((n) => /Trust without a buying statement is not counted/.test(n)));
});
