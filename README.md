# Consensus, CoreSpeed edition

Ask your AI agent "what do people think about X?" and get a cited answer from
real public posts on Reddit, X and, when you pick it, Rednote (Xiaohongshu).
Your agent reads the posts through CoreSpeed's built-in **Social Media Scrape**
capability, the `social__*` tools of the [CoreSpeed](https://corespeed.io) MCP
server, and sorts them with its own model. Then it shows the result in the
original Consensus interface: the answers people give, how many posts in each
source's sample give each, the reasons behind them, and a link to every post.

This is an agent **skill** plus a **static viewer**. There is no server to run,
no second model to configure, and no scraping or proxy account to buy.

What you need, and what you do not:

- **You need** a CoreSpeed account, your agent signed in to the CoreSpeed MCP
  server, and the social capability on for you. CoreSpeed lists it as "Social
  media research" in Dashboard → Tools. Only you change that setting; the skill
  never does.
- **You do not need** a third-party scraping service, separate X, Reddit or
  Rednote API keys, or a connected social media account. CoreSpeed reads
  public data on its own supplier accounts; nothing logs in as you.

> Based on [Consensus](https://github.com/Straitly-ai/consensus) by Straitly,
> released under the MIT licence. The sorting method and the interface come from
> that project. This edition is maintained by CoreSpeed and is not endorsed by
> the original authors. The original README is in
> [docs/upstream-README.md](docs/upstream-README.md).

![The viewer on desktop](docs/images/viewer-desktop.png)

## How it works

```mermaid
flowchart LR
  U[You: what do people think about ...?] --> A[Your agent + Consensus skill]
  A -- social__* tools for the sources you picked:\nReddit, X, Rednote --> C[CoreSpeed MCP:\nSocial Media Scrape]
  C -- public posts --> A
  A -- sorts every post with its own model --> R[consensus-result.json]
  R -- consensus.mjs render --> V[consensus-*.html: the Consensus viewer]
```

1. When the skill starts, the agent lists the `social__*` tools its CoreSpeed
   connection exposes and reads each tool's live description and schema,
   including its rate. It plans from those, not from a fixed list.
2. It picks the sources: the ones you name, or Reddit and X. It plans one
   counted budget of requests and shows you the sources, the split and the
   credits before the first call.
3. It calls the CoreSpeed social tools through the MCP connection it already
   has. CoreSpeed is the only data source; it needs no TwitterAPI.io, Serper,
   Oxylabs, Reddit or Xiaohongshu account.
4. It sorts every post with the Consensus rubric: an answer option, Other, no
   answer, or spam. A post that only mentions something is not a vote.
5. It writes `consensus-result.json` once, in your language: every sorted post
   with its link, plus coverage per source, usage, and the queries it ran.
6. `consensus.mjs render` checks the file and builds one self-contained HTML
   page. You open it from disk; it fetches nothing and runs no model.

## Sources

| Source | CoreSpeed tools | Rate stated on 2026-10-14 |
| --- | --- | ---: |
| Reddit | `social__reddit_search`, `social__reddit_post_comments` | 1.5 credits |
| X | `social__x_search`, `social__x_post_comments` | 1.5 credits |
| Rednote (小红书) | `social__xiaohongshu_search_notes`, `social__xiaohongshu_note_comments` | 15 credits |

Reddit and X are the default. Rednote is used only when you ask for it. Each
source is reported as its own sample. LinkedIn is not supported: CoreSpeed has
no LinkedIn post search, and the skill will not substitute profile search,
another provider or a signed-in browser.

## Install

You need an agent that loads skills (Claude Code, Codex, Cursor, OpenClaw,
Hermes, or the Claude app) and a CoreSpeed connection. Node.js 18+ is needed
only for the viewer step.

**1. Connect CoreSpeed** (skip this if your agent already lists `social__*`
tools). This is the only sign-in: one CoreSpeed connection, no social media
accounts. Give your agent the official setup line:

```text
set up https://corespeed.io/SKILL.md (read it raw, e.g. with curl)
```

Or, in Claude Code, add the server yourself and sign in with `/mcp`:

```bash
claude mcp add corespeed https://api.corespeed.io/mcp --transport http --scope user
```

A free CoreSpeed account works: https://app.corespeed.io/sign-up. "Social
media research" must be on for you at https://app.corespeed.io/tools; if the
`social__*` tools are missing while other CoreSpeed tools are there, that is
the usual cause. Never paste an API key into a chat. Headless agents use a key
in an environment variable, as the official setup describes.

**2. Add the skill.**

- With the skills CLI: `npx skills add corespeed-io/consensus --skill consensus -g -y`
- Or copy the folder `skills/consensus` to your agent's user-level skills folder:

| Agent | Folder |
| --- | --- |
| Claude Code | `~/.claude/skills/consensus/` |
| Codex and most others | `~/.agents/skills/consensus/` |
| Cursor | `~/.cursor/skills/consensus/` |
| Claude app | Customize → Skills → Upload a ZIP whose root is the `consensus` folder |

```bash
git clone https://github.com/corespeed-io/consensus.git
mkdir -p ~/.claude/skills && cp -R consensus/skills/consensus ~/.claude/skills/
```

**3. Ask.** For example: "Why do developers switch from Cursor to Claude
Code?", "Is a standing desk worth it? Reddit only, last 6 months.", or
"小红书上大家怎么评价 Claude Code？ Include Rednote."

## Cost

Each social tool states its price in its description, and rates differ by
source. On 2026-10-14 the Reddit and X tools stated **1.5 credits** per
successful request and the Rednote tools **15 credits**. Failed requests are
never charged. The agent reads the live rate of every tool it plans to use, so
these numbers can change without a new skill version.

The skill plans **one total budget of requests**, retries and later pages
included. The depth sets it: Quick 8, Standard 14, Deep 30 (Deep asks first).
The sources you pick share that total; adding a source never adds requests.
Before the first call the agent tells you the sources, the requests per source
and the credits the cap can cost at the live rates. A plan with Rednote waits
for your OK, because its rate is ten times higher.

| Standard (14 requests) | Reddit | X | Rednote | Credits at most |
| --- | ---: | ---: | ---: | ---: |
| Reddit + X (default) | 9 | 5 | – | 21 |
| Reddit + X + Rednote | 5 | 4 | 5 | 88.5 |
| Rednote only | – | – | 14 | 210 |

These are estimates from the stated rates. A request that times out or drops
its connection may already have run and been charged. The result records
those as charge-unknown, and the page shows the cost as a range. The exact
charges are in your CoreSpeed Activity log.

The CoreSpeed Free plan includes 3,000 credits per 90 days
([pricing](https://corespeed.io/pricing)). Your agent's own model usage is
separate and depends on your agent.

## The example

[`skills/consensus/examples/`](skills/consensus/examples/) holds real runs. The
main one asks **"Would you still buy the product if you knew the ad was
AI-generated?"** (asked as 知道一条广告是 AI 做的，你还会买吗？), on Reddit, X and
Rednote, for the 12 months to 2026-10-14:

- 113 CoreSpeed requests. 111 succeeded: Reddit 53 and X 26 at 1.5 credits,
  Rednote 32 at 15, so 598.5 credits at the stated rates. Two more Rednote
  requests failed with an upstream error, which is not charged. No request had
  an unknown outcome.
- 1,217 posts read, 99 dropped before sorting, 1,118 sorted, **162 opinions
  counted**, each from a different author.

| Answer (of 162 opinions counted in this sample) | Reddit | X | Rednote | All |
| --- | ---: | ---: | ---: | ---: |
| Not if AI shows the product itself | 15 | 4 | 48 | 67 |
| Won't buy, or less likely to | 26 | 14 | 10 | 50 |
| Depends on how AI is used | 7 | 1 | 16 | 24 |
| Still buys; judges the product | 3 | 1 | 17 | 21 |

The largest group objects when AI stands in for the product itself: clothes on
AI models, AI food photos, AI demos. About a quarter would still buy, if AI is
used honestly or because the product, not the ad, decides. Another 61 posts
spoke only of trust, and 304 were promotion or off-topic (mostly sellers of
AI ads on X); neither is counted as an answer, and the page says so. Rednote
supplies over half the counted opinions, mostly about clothing on shopping
apps, and the searches and threads read lean towards people who object; the
page lists that bias per source. It is one report, in English; the interface
around it also comes in 简体中文, 日本語 and 한국어.

Two earlier runs are kept as well:

- "Why do developers switch from Cursor to Claude Code?" on Reddit and X: 14
  successful requests (21 to 25.5 credits, since 3 lost the connection and
  were retried), 45 opinions counted. Its labels were revised once, from the
  same posts, when the rubric moved to one vote per author per thread (49 to
  45); the page records this.
- "小红书上，Cursor 和 Claude Code 大家选哪个？" on Rednote only, in Chinese: 3
  requests (45 credits), 23 opinions counted.

![The Rednote example, in Chinese](docs/images/viewer-rednote-zh.png)

All are recorded snapshots, not live results.

## What the viewer shows

The original Consensus results screen: the answer donut, a "why" summary per
answer, themes that filter the posts, and every post with its author, date,
score and a link to the original. CoreSpeed additions:

- source switches narrow the whole page to the sources you tick. They only
  filter posts already in the file: nothing is fetched, nothing is charged,
  and a source the run did not collect is never shown as having results;
- counts per source, and every share labelled as a share of the opinions
  counted in the selected sources' sample;
- below 15 counted opinions, shares are hidden and the sample is called thin;
- the interface in English, 简体中文, 日本語 and 한국어, from dictionaries built
  into the page. Switching costs no model tokens. The report itself stays in
  the one language your agent wrote it in, and the page says so when the two
  differ; posts are always shown as written;
- light and dark themes, in Vercel's Geist type with a light sky-blue accent;
- a panel lists what was read, what it cost, the queries run, and the limits;
- there is no search box: the page is a snapshot, so follow-ups go through
  your agent.

The page is locked down: scripts run only by hash, it makes no network
requests, images load only from X, Reddit and Rednote's image domains, and
every link must be an `https://` X, Reddit or Rednote post link that matches
its post id.

<img src="docs/images/viewer-mobile.png" alt="The viewer on a phone" width="300">

## Helper commands

`skills/consensus/scripts/consensus.mjs` is optional and offline. It never
calls CoreSpeed or a model.

```bash
node consensus.mjs validate consensus-result.json   # check the file, print counts and cost
node consensus.mjs render consensus-result.json --open   # build and open the viewer page
node consensus.mjs ingest social__x_search saved-result.json   # turn a saved tool result into evidence rows
```

`validate` checks structure, labels, verbatim quotes, link form against each
post id, the window, and the usage arithmetic. It cannot prove a post still
exists; only the agent's own reads show that.

## Develop

```bash
npm install
npm run test:skill        # skill tests (node:test): normalizers on recorded payloads, validation, hostile input
npx tsc --noEmit -p web   # type-check the viewer
npm run viewer:dev        # dev server; open /?data=/cursor-to-claude-code.json
npm run viewer:build      # rebuild skills/consensus/viewer/consensus-viewer.html
```

Rebuild the viewer after changing anything in `web/` or
`skills/consensus/scripts/result.mjs`, and commit the built file. Skill users
never build anything.

| Path | What it is |
| --- | --- |
| `skills/consensus/` | The skill: `SKILL.md`, references, the helper scripts, the built viewer, the example |
| `web/` | The original Consensus interface, adapted as the viewer |
| `test/skill/` | Skill tests and the recorded CoreSpeed payloads they use |
| `src/`, `netlify/`, `scripts/` | The original Consensus server pipeline, unchanged. This edition does not use it; it needs its own provider keys |

## Limits

- **A sample, not a survey.** Search ranking decides what is read, and people
  who post are not everyone. The skill tells the agent never to report
  population shares or market share, and `validate` rejects a summary that
  reads like one.
- **Reddit coverage is partial.** A comments request returns about 8 comments.
  The skill reads the top comments of a few threads and does not open nested
  "load more" replies.
- **X search is passed through as typed.** In testing, `since:`, `lang:en` and
  plain AND-ed words were honoured. One query with an OR group of quoted
  phrases returned 20 posts, and none of them contained the phrases. The skill
  checks each post's date and words itself.
- **Pages are large.** An X page is 43,000 to 68,000 characters, so a Deep
  run fills a lot of agent context.
- **English only by default** for Reddit and X posts. Rednote posts are mostly
  Chinese.
- **Rednote shows only the start of a note in search** (about 60
  characters), and there is no tool for a note's full text. Comments are
  complete. Note links need their `xsec_token`, and Rednote may ask readers to
  sign in to open them. The next comment page (`cursor`) was not tested live.
- **No LinkedIn.** See Sources.

## Licence

MIT. See [LICENSE](LICENSE); the original copyright notice is kept unchanged.

The viewer embeds the Geist Sans font by Vercel, under the SIL Open Font
License 1.1. Its licence is in
[`skills/consensus/viewer/GEIST-FONT-LICENSE.txt`](skills/consensus/viewer/GEIST-FONT-LICENSE.txt)
and inside every rendered page. Readers whose browser cannot use it see the
system font instead.

Platform marks label where each post came from. The Reddit and X marks come
from Font Awesome Free (icons under CC BY 4.0). The Rednote (小红书) wordmark
comes from Simple Icons (CC0 1.0). Each mark is a trademark of its owner.
