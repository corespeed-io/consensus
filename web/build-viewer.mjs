// Builds the viewer into one self-contained HTML file and locks it down with a Content-Security-Policy:
// scripts only by hash, no network requests (connect-src 'none'), fonts only from inside the page, images only from the X, Reddit and
// Rednote CDNs.
// The result data is a non-executable JSON block, filled in later by skills/consensus/scripts/consensus.mjs.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { build } from "vite";

const OUT = "skills/consensus/viewer/consensus-viewer.html";
const SLOT = '<script type="application/json" id="consensus-result">null</script>';

await build({ configFile: "vite.config.ts", mode: "viewer", logLevel: "warn" });
let html = readFileSync(".viewer-build/index.html", "utf8");
if (!html.includes(SLOT)) throw new Error("the data slot is missing from the built page");

const hashes = [];
for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  const [, attrs, body] = m;
  if (/type="application\/json"/.test(attrs) || /\bsrc=/.test(attrs)) continue;
  hashes.push(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
}
const csp = [
  "default-src 'none'",
  `script-src ${hashes.join(" ")}`,
  "style-src 'unsafe-inline'",
  // The Geist font is built into the page as a data: URL; nothing is fetched.
  "font-src data:",
  "img-src data: https://pbs.twimg.com https://abs.twimg.com https://*.redd.it https://*.redditstatic.com https://*.redditmedia.com https://*.xhscdn.com https://*.rednotecdn.com",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");
html = html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
// The page carries the Geist font, so it carries the font's licence too (SIL OFL 1.1 asks for this in every copy).
const ofl = readFileSync("web/src/app/fonts/Geist-OFL.txt", "utf8").replace(/-{2,}/g, (m) => "=".repeat(m.length)).trim();
html = html.replace("<head>", `<head>\n    <!--\n    Geist Sans, built into this page:\n${ofl}\n    -->`);
mkdirSync("skills/consensus/viewer", { recursive: true });
writeFileSync(OUT, html);
rmSync(".viewer-build", { recursive: true, force: true });
console.log(`viewer: ${OUT} (${Math.round(html.length / 1024)} KB, ${hashes.length} inline scripts hashed)`);
