// The CLI end to end: render a hostile but valid result into the viewer page and read the data back out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hostileResult, sampleResult } from "./sample.mjs";

const CLI = fileURLToPath(new URL("../../skills/consensus/scripts/consensus.mjs", import.meta.url));
const SLOT = /<script type="application\/json" id="consensus-result">([\s\S]*?)<\/script>/;

function tmp() {
  return mkdtempSync(join(tmpdir(), "consensus-test-"));
}

test("render embeds hostile text as inert data and the page reads it back unchanged", () => {
  const dir = tmp();
  const input = hostileResult();
  writeFileSync(join(dir, "consensus-result.json"), JSON.stringify(input));
  const out = join(dir, "out.html");
  const log = execFileSync(process.execPath, [CLI, "render", join(dir, "consensus-result.json"), "-o", out], { encoding: "utf8" });
  assert.match(log, /Viewer written/);
  const html = readFileSync(out, "utf8");
  const m = html.match(SLOT);
  assert.ok(m, "the data slot is present");
  assert.ok(!/<\/script/i.test(m[1]) && !m[1].includes("<"), "no markup can start inside the data block");
  assert.deepEqual(JSON.parse(m[1]), input, "the page gets exactly the file");
  // Only the viewer's own scripts run: the CSP pins them by hash and forbids network requests.
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'sha256-[^']+'( 'sha256-[^']+')*;/);
  assert.doesNotMatch(csp, /unsafe-inline[^;]*script|script-src[^;]*unsafe/);
  assert.match(csp, /connect-src 'none'/);
});

test("render refuses an invalid file and writes nothing", () => {
  const dir = tmp();
  const r = sampleResult();
  r.posts[0].url = "javascript:alert(1)";
  writeFileSync(join(dir, "bad.json"), JSON.stringify(r));
  const res = spawnSync(process.execPath, [CLI, "render", join(dir, "bad.json"), "-o", join(dir, "bad.html")], { encoding: "utf8" });
  assert.equal(res.status, 1);
  assert.match(res.stdout, /error\s+posts\[0\]/);
  assert.throws(() => readFileSync(join(dir, "bad.html")));
});

test("validate prints counts and says what it cannot check", () => {
  const dir = tmp();
  writeFileSync(join(dir, "r.json"), JSON.stringify(sampleResult()));
  const out = execFileSync(process.execPath, [CLI, "validate", join(dir, "r.json")], { encoding: "utf8" });
  assert.match(out, /8 opinions counted from 11 posts sorted/);
  assert.match(out, /3 successful requests x 1\.5 = 4\.5 credits/);
  assert.match(out, /Not checked: that the posts still exist/);
  assert.match(out, /Fewer than 15 opinions/);
});

test("ingest turns a saved payload into evidence rows and skips ones already in the ledger", () => {
  const dir = tmp();
  const fixture = fileURLToPath(new URL("./fixtures/reddit_post_comments.json", import.meta.url));
  writeFileSync(join(dir, "ledger.jsonl"), `${JSON.stringify({ id: "t1_pfdweev" })}\n`);
  const res = spawnSync(process.execPath, [CLI, "ingest", "social__reddit_post_comments", fixture, "--skip", join(dir, "ledger.jsonl")], { encoding: "utf8" });
  assert.equal(res.status, 0);
  const rows = res.stdout.trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(rows.length, 7);
  assert.ok(!rows.some((r) => r.id === "t1_pfdweev"));
  assert.match(res.stderr, /next cursor: commenttree:/);
});

test("validate states the cost range when some requests have an unknown charge", () => {
  const dir = tmp();
  const r = sampleResult();
  r.usage.failed = 1;
  r.usage.unknown_charge = 1;
  writeFileSync(join(dir, "r.json"), JSON.stringify(r));
  const out = execFileSync(process.execPath, [CLI, "validate", join(dir, "r.json")], { encoding: "utf8" });
  assert.match(out, /3 successful requests x 1\.5 = 4\.5 credits/);
  assert.match(out, /1 request\(s\) timed out or lost the connection; their charge is unknown, so the cost is at most 6 credits/);
});
