// The viewer's interface text: four static dictionaries, built into the page. These checks keep them complete and
// consistent, keep every key the code asks for present, and keep the built page free of network and copied assets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const messages = JSON.parse(readFileSync(new URL("../../web/src/app/i18n/messages.json", import.meta.url), "utf8"));
const LOCALES = ["en", "zh", "ja", "ko"];
const INTL = { en: "en", zh: "zh-CN", ja: "ja-JP", ko: "ko-KR" };
const holes = (s) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const PLURAL = /_(zero|one|two|few|many|other)$/;
const bases = (dict) => new Set(Object.keys(dict).map((k) => k.replace(PLURAL, "")));

test("exactly four locales, each with the same base keys", () => {
  assert.deepEqual(Object.keys(messages).sort(), [...LOCALES].sort());
  const en = bases(messages.en);
  for (const l of LOCALES) assert.deepEqual([...bases(messages[l])].sort(), [...en].sort(), `${l} keys differ from en`);
});

test("plural keys carry every form the locale's plural rules need (Intl.PluralRules)", () => {
  for (const l of LOCALES) {
    const needs = new Intl.PluralRules(INTL[l]).resolvedOptions().pluralCategories;
    const plural = new Set(Object.keys(messages.en).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, "")));
    for (const base of plural) for (const cat of needs) assert.ok(messages[l][`${base}_${cat}`] != null, `${l}: ${base}_${cat} is missing`);
  }
});

test("every string is non-empty and has the same placeholders as English", () => {
  for (const l of LOCALES)
    for (const [k, v] of Object.entries(messages[l])) {
      assert.equal(typeof v, "string", `${l}.${k}`);
      assert.ok(v.trim().length > 0, `${l}.${k} is empty`);
      const enKey = messages.en[k] != null ? k : `${k.replace(PLURAL, "")}_other`;
      assert.deepEqual(holes(v), holes(messages.en[enKey]), `${l}.${k} placeholders differ from en`);
    }
});

test("translations are real: CJK locales are not English copies", () => {
  for (const l of ["zh", "ja", "ko"]) {
    const same = Object.keys(messages.en).filter((k) => messages[l][k] === messages.en[k] && /[a-z]{4}/i.test(messages.en[k].replace(/\{\w+\}|CoreSpeed|Consensus|Reddit|CSV|MIT|Straitly|X\b/g, "")));
    assert.deepEqual(same, [], `${l} has untranslated strings`);
  }
});

test("every key the viewer code asks for exists, and every key is used", () => {
  const dir = new URL("../../web/src/app/", import.meta.url);
  const code = [...readdirSync(dir).filter((f) => f.endsWith(".tsx")), "i18n/index.tsx"].map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");
  const used = new Set([...code.matchAll(/\b(?:t|tp|tx|i\.t|i\.tp|i\.tx)\(\s*'([a-z0-9_]+)'/g)].map((m) => m[1]));
  for (const m of code.matchAll(/key: '([a-z0-9_]+)'/g)) used.add(m[1]);
  const all = bases(messages.en);
  for (const k of used) assert.ok(all.has(k), `the code uses "${k}", which no dictionary has`);
  // Keys built at run time: src_<source>, open_<source>, issue_<code>.
  const dynamic = /^(src_|open_|issue_)/;
  const unused = [...all].filter((k) => !used.has(k) && !dynamic.test(k));
  assert.deepEqual(unused, [], "dictionary keys no code uses");
  for (const s of ["reddit", "x", "rednote"]) {
    assert.ok(all.has(`src_${s}`));
    assert.ok(all.has(`open_${s}`));
  }
});

test("every validator issue code has interface text", () => {
  const src = readFileSync(new URL("../../skills/consensus/scripts/result.mjs", import.meta.url), "utf8");
  const codes = new Set([...src.matchAll(/note\("([a-z_]+)"/g)].map((m) => m[1]));
  assert.ok(codes.size >= 14);
  for (const c of codes) assert.ok(messages.en[`issue_${c}`] != null, `issue_${c} has no text`);
});

test("the built viewer: four dictionaries inside, no network, no web fonts", () => {
  const html = readFileSync(new URL("../../skills/consensus/viewer/consensus-viewer.html", import.meta.url), "utf8");
  for (const l of LOCALES) assert.ok(html.includes(messages[l].sources_hint), `${l} dictionary is in the bundle`);
  const csp = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] ?? "";
  assert.match(csp, /connect-src 'none'/);
  assert.doesNotMatch(csp, /font-src|fonts\.g/);
  assert.match(csp, /img-src data: [^;]*xhscdn\.com[^;]*rednotecdn\.com/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  assert.doesNotMatch(html, /<link [^>]*href="https?:/, "no external stylesheet or preconnect");
  assert.doesNotMatch(html, /XMLHttpRequest|new WebSocket|sendBeacon|EventSource/);
});
