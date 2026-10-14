#!/usr/bin/env node
// Consensus skill helper. Optional, offline, no dependencies, Node.js 18+.
// It never calls CoreSpeed or any model: your agent does the reading and the thinking.
//
//   node consensus.mjs validate <result.json>            check a result file; print counts
//   node consensus.mjs render <result.json> [-o out.html] [--open]
//                                                        check it, then write the self-contained viewer page
//   node consensus.mjs ingest <tool> <payload.json> [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--skip ledger.jsonl]
//                             [--note-url <link> --note-title <title>]   (Rednote comments: the note they belong to)
//                                                        turn one saved social__* result into evidence rows (JSONL)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { computeStats, scriptSafeJson, slugify, SOURCES, validateResult } from "./result.mjs";
import { normalizePayload } from "./normalize.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const VIEWER = join(here, "..", "viewer", "consensus-viewer.html");
const PLACEHOLDER = '<script type="application/json" id="consensus-result">null</script>';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === "--open") flags.open = true;
  else if (a === "-o" || a === "--out") flags.out = rest[++i];
  else if (a.startsWith("--")) flags[a.slice(2)] = rest[++i];
  else args.push(a);
}

function fail(msg, code = 1) {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
}

function load(path) {
  if (!path) fail("Give the path of a result file, e.g. consensus-result.json");
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    fail(`Cannot read ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    fail(`${path} is not valid JSON: ${e.message}`);
  }
}

function report(r, v) {
  for (const w of v.warnings) process.stdout.write(`warning  ${w}\n`);
  if (v.errors.length) {
    for (const e of v.errors) process.stdout.write(`error    ${e}\n`);
    process.stdout.write(`\n${v.errors.length} error(s). Fix them and run again.\n`);
    return false;
  }
  const s = v.stats;
  process.stdout.write(`\n${r.question}\n`);
  process.stdout.write(`${s.counted} opinions counted from ${s.sorted} posts sorted (${s.spam} removed as spam or off-topic, ${s.none} gave no answer); ${s.read} posts read.\n`);
  const used = SOURCES.filter((x) => r.sources.includes(x));
  for (const o of s.options) {
    if (o.is_other && !o.count) continue;
    const share = s.thin ? "" : `${String(o.share).padStart(5)}% of counted  `;
    process.stdout.write(`  ${String(o.count).padStart(4)}  ${share}${o.title}  (${used.map((x) => `${x} ${o[x]}`).join(", ")})\n`);
  }
  if (s.thin) process.stdout.write("  Fewer than 15 opinions: shares are not meaningful; read these as anecdotes.\n");
  if (used.length > 1) {
    process.stdout.write("Each source is its own sample. Report them side by side; a combined share mixes different audiences.\n");
    for (const x of used) process.stdout.write(`  ${x.padEnd(8)} ${s.bySource[x].counted} counted of ${s.bySource[x].read} sorted\n`);
  }
  if (s.mixedRates) process.stdout.write(`CoreSpeed: ${s.requests} successful requests at each tool's stated rate = ${s.credits} credits (estimate; the Activity log has the exact charges).\n`);
  else process.stdout.write(`CoreSpeed: ${s.requests} successful requests x ${r.usage.credits_per_request} = ${s.credits} credits (estimate; the Activity log has the exact charges).\n`);
  if (s.unknownCharge) process.stdout.write(`  ${s.unknownCharge} request(s) timed out or lost the connection; their charge is unknown, so the cost is at most ${s.creditsMax} credits.\n`);
  process.stdout.write("Checked: structure, labels, verbatim quotes, and link form against each post id. Not checked: that the posts still exist.\n");
  return true;
}

function openFile(file) {
  const cmd = process.platform === "darwin" ? ["open", [file]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : ["xdg-open", [file]];
  try {
    const child = spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" });
    child.on("error", () => process.stdout.write(`Could not open a browser here. Open this file yourself: ${file}\n`));
    child.unref();
  } catch {
    process.stdout.write(`Could not open a browser here. Open this file yourself: ${file}\n`);
  }
}

switch (cmd) {
  case "validate": {
    const r = load(args[0]);
    process.exit(report(r, validateResult(r)) ? 0 : 1);
    break;
  }
  case "render": {
    const r = load(args[0]);
    const v = validateResult(r);
    if (!report(r, v)) process.exit(1);
    if (!existsSync(VIEWER)) fail(`The viewer template is missing: ${VIEWER}`);
    const template = readFileSync(VIEWER, "utf8");
    if (!template.includes(PLACEHOLDER)) fail("The viewer template has no data slot; rebuild it with `npm run viewer:build`.");
    const out = resolve(flags.out ?? join(dirname(resolve(args[0])), `consensus-${slugify(r.question)}.html`));
    writeFileSync(out, template.replace(PLACEHOLDER, () => `<script type="application/json" id="consensus-result">${scriptSafeJson(r)}</script>`));
    process.stdout.write(`\nViewer written: ${out}\n`);
    if (flags.open) openFile(out);
    break;
  }
  case "ingest": {
    const [tool, file] = args;
    if (!tool || !file) fail("Usage: consensus.mjs ingest <tool> <payload.json> [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--skip ledger.jsonl] [--note-url <link>] [--note-title <title>]");
    const skip = new Set();
    if (flags.skip && existsSync(flags.skip))
      for (const line of readFileSync(flags.skip, "utf8").split("\n"))
        try {
          if (line.trim()) skip.add(JSON.parse(line).id);
        } catch {
          /* ignore a bad line */
        }
    let raw;
    try {
      raw = readFileSync(file, "utf8");
    } catch (e) {
      fail(`Cannot read ${file}: ${e.message}`);
    }
    const res = normalizePayload(tool, raw, { since: flags.since, until: flags.until, noteUrl: flags["note-url"], noteTitle: flags["note-title"] });
    if (res.error) process.stderr.write(`${tool}: ${res.error}\n`);
    for (const row of res.rows) if (!skip.has(row.id)) process.stdout.write(`${JSON.stringify(row)}\n`);
    process.stderr.write(`${tool}: ${res.rows.length} rows (${res.raw} items in the payload, ${res.dropped} dropped${res.truncated ? ", payload was TRUNCATED" : ""}${res.next ? `, next cursor: ${res.next}` : ""})\n`);
    break;
  }
  case "stats": {
    const r = load(args[0]);
    const v = validateResult(r);
    if (v.errors.length) process.exit(report(r, v) ? 0 : 1);
    process.stdout.write(`${JSON.stringify(computeStats(r), null, 2)}\n`);
    break;
  }
  default:
    process.stdout.write(
      [
        "Consensus skill helper (offline; never calls CoreSpeed or a model)",
        "",
        "  node consensus.mjs validate <result.json>",
        "  node consensus.mjs render <result.json> [-o out.html] [--open]",
        "  node consensus.mjs stats <result.json>",
        "  node consensus.mjs ingest <tool> <payload.json> [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--skip ledger.jsonl]",
        "",
      ].join("\n"),
    );
    process.exit(cmd ? 2 : 0);
}
