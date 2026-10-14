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
  assert.deepEqual(v.errors, []);
  assert.deepEqual(v.warnings, []);
  assert.equal(r.language, "en");
  assert.equal(r.question, "Would you still buy the product if you knew the ad was AI-generated?");
  assert.deepEqual(r.sources, ["reddit", "x", "rednote"]);
  const s = computeStats(r);
  assert.equal(s.counted, 162);
  assert.ok(s.counted >= 133, "at least 100 more than the first 33-opinion version");
  assert.equal(s.read, 1217);
  assert.deepEqual({ reddit: s.bySource.reddit.counted, x: s.bySource.x.counted, rednote: s.bySource.rednote.counted }, { reddit: 51, x: 20, rednote: 91 });
  assert.deepEqual(Object.fromEntries(s.options.filter((o) => o.count).map((o) => [o.id, o.count])), { "not-if-shows-product": 67, "wont-buy": 50, depends: 24, "still-buy": 21 });
  // 111 successful requests at each tool's stated rate (Reddit and X 1.5, Rednote 15); 2 Rednote tool errors, which
  // are never charged, and no request with an unknown outcome, so there is no range.
  assert.equal(s.credits, 598.5);
  assert.equal(s.creditsMax, 598.5);
  assert.equal(r.usage.requests, 111);
  assert.equal(r.usage.failed, 2);
  assert.equal(r.usage.unknown_charge, 0);
});

test("the AI-ad showcase: one vote per author, and trust-only posts are not counted as answers", () => {
  const r = ex("ai-ads-would-you-still-buy.json");
  const votes = r.posts.filter((p) => !["none", "spam"].includes(p.label));
  const authors = new Set(votes.map((p) => `${p.source}:${p.author}`));
  assert.equal(authors.size, votes.length);
  const trustOnly = r.posts.find((p) => p.id === "t1_p84xe98");
  assert.equal(trustOnly.label, "none", "\"I lose respect for brands…\" says nothing about buying");
  assert.ok(r.coverage.notes.some((n) => /Trust without a buying statement is not counted/.test(n)));
  for (const o of r.options) for (const q of o.quotes) assert.ok(q.text.trim().split(/\s+/).length <= 25, q.text);
});
