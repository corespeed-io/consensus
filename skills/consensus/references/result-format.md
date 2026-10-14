# consensus-result.json

The file you write after sorting. The viewer and `scripts/consensus.mjs` read it.
Do not put counts or percentages in it: they are computed from the post labels,
so the numbers always match the posts listed.

## Example (trimmed)

```json
{
  "format": "consensus-result/1",
  "question": "Why do developers switch from Cursor to Claude Code?",
  "question_type": "open",
  "summary": "In this sample, most counted opinions credit Claude Code's results on larger tasks; cost and Cursor's editor UX pull the other way.",
  "created_at": "2026-10-14T09:12:00Z",
  "language": "en",
  "window": { "since": "2025-10-14", "until": null },
  "sources": ["reddit", "x"],
  "options": [
    {
      "id": "quality",
      "title": "Better results on real tasks",
      "description": "Says Claude Code gets more done or writes better code.",
      "why": "People say Opus in Claude Code finishes multi-file changes with less hand-holding.",
      "quotes": [{ "post": "t1_pfdweev", "text": "opus 5.5 is way better" }]
    }
  ],
  "other": { "why": "Some moved to other tools instead.", "also_mentioned": [{ "title": "Codex", "count": 2 }] },
  "themes": [{ "id": "big-refactors", "title": "Handles big refactors", "description": "Finishes multi-file changes without hand-holding." }],
  "posts": [
    {
      "id": "t1_pfdweev",
      "source": "reddit",
      "kind": "comment",
      "url": "https://www.reddit.com/r/cursor/comments/1x3r2hw/anyone_still_using_cursor_next_to_claude_code/pfdweev/",
      "text": "I am this close to cancel my sub to cursor for claude code, opus 5.5 is way better...",
      "author": "nariver1",
      "created_at": "2026-10-12T04:33:41Z",
      "score": 18,
      "replies": 8,
      "thread_title": "Anyone still using Cursor next to Claude Code?",
      "community": "r/cursor",
      "label": "quality",
      "strength": 3,
      "themes": ["big-refactors"]
    }
  ],
  "coverage": {
    "posts_read": 142,
    "dropped_before_sorting": { "count": 41, "reasons": ["20 X results with no mention of Cursor", "11 Reddit comments deleted or under five words"] },
    "reddit": { "searches": 3, "threads_found": 19, "threads_read": 5, "comment_pages": 6, "comments_read": 48, "comments_total": 312 },
    "x": { "searches": 4, "pages": 4, "posts_returned": 78, "posts_kept": 41, "reply_threads": 1 },
    "notes": ["Reddit: top comments of 5 threads; replies behind \"load more\" not opened."]
  },
  "usage": { "requests": 14, "failed": 0, "credits_per_request": 1.5, "budget": 14, "truncated": 0, "by_tool": { "social__reddit_search": 3, "social__reddit_post_comments": 6, "social__x_search": 4, "social__x_post_comments": 1 } },
  "queries": [{ "tool": "social__reddit_search", "args": { "query": "Cursor or Claude Code?", "time_range": "year" }, "result": "ok", "items": 7 }],
  "analysis": { "by": "host agent", "model": "the model you run on, if known" },
  "limits": ["English posts only.", "X Top results only."]
}
```

## Fields

**Top level** (required unless marked optional)

| Field | Rule |
| --- | --- |
| `format` | Always `"consensus-result/1"`. |
| `question` | The user's question. |
| `question_type` | `yes_no`, `a_vs_b`, `best_x` or `open`. |
| `summary` | One or two sentences, worded as a sample ("In this sample, ..."). |
| `created_at` | When you finished, ISO 8601. |
| `language` | Optional, expected: the language tag of the report text you wrote (`"en"`, `"zh-CN"`, `"ja"`, `"ko"`, ...). One report, one language. Posts and quotes keep their own language. The viewer uses this to tell readers when its interface language differs from the report. |
| `window` | `since` and `until` as `YYYY-MM-DD` or `null`. |
| `sources` | The sources this run collected, as picked before collection: any of `"reddit"`, `"x"`, `"rednote"`. Every post's `source` must be listed. |
| `options` | 1 to 8 answers. `id` is short, lowercase, letters/digits/`-`/`_`, and not `other`, `none` or `spam`. Order: most votes first. |
| `options[].why` | One or two sentences on the reasons. Optional but expected. |
| `options[].quotes` | 0 to 3 `{ post, text }`. `post` is a post id with this option's label; `text` is verbatim from that post (cuts marked `…`). |
| `other` | Optional. `why`, and `also_mentioned` names folded into Other with their counts. |
| `themes` | 0 to 12 `{ id, title, description }`. |
| `posts` | Every post you sorted, including `none` and `spam`, so the funnel is auditable. |
| `coverage` | What you read (definitions below); `notes` are plain sentences shown in the viewer. |
| `usage` | `requests` = successful CoreSpeed requests; `failed` = failed requests, retries included; `unknown_charge` = how many of those failed in transport (timeout, dropped connection), so may have been charged; `budget` = most requests the whole run may send, all sources together, retries included; `credits_per_request` = the rate from the tool descriptions; `truncated`; `by_tool` (successful only). Optional: `rates` = each tool's stated rate when tools differ (Rednote states 15, Reddit and X 1.5); `budget_by_source` = how the one budget was split (it must add up to `budget`); `unknown_by_tool` = which tools the unknown-charge requests went to. |
| `queries` | Optional, recommended: every call with its arguments and outcome. |
| `analysis` | Optional: who sorted the posts. |
| `limits` | Plain sentences on what this read cannot tell. |

**Each post**

| Field | Rule |
| --- | --- |
| `id` | X: `x_<tweet_id>`. Reddit thread: `t3_<id>`. Reddit comment: `t1_<id>`. Rednote note: `xhs_<note_id>`. Rednote comment: `xhsc_<comment_id>`. |
| `source` | `reddit`, `x` or `rednote`. |
| `kind` | `thread`, `comment` (Reddit); `post`, `reply` (X); `note`, `comment` (Rednote). |
| `url` | The real post link from the payload. X: `https://x.com/<screen_name>/status/<tweet_id>`. Reddit: `https://www.reddit.com<permalink>`. Rednote: `https://www.xiaohongshu.com/explore/<note_id>`; a Rednote comment uses its note's link. |
| `text` | Verbatim text (you may cut the end of a long post). |
| `author` | Handle without `u/` or `@`. Rednote: the user id (the nickname goes in `author_name`). |
| `author_name`, `author_avatar` | Optional, from the payload. |
| `created_at` | The post's own date (ISO 8601). |
| `score` | Reddit score or X likes. |
| `replies`, `thread_title`, `community`, `parent_text` | Optional context. |
| `thread_url` | The thread the post came from: the Reddit thread link, for an X reply the link of the post it replies to, for a Rednote comment its note's link (required there). Expected on comments and replies; `validate` uses it for the per-author and one-thread checks. |
| `label` | An option `id`, `other`, `none` or `spam`. |
| `strength` | 1 to 3 for an option or `other`; 0 for `none` and `spam`. |
| `themes` | Optional theme ids the post argues. |

The counting unit is a post with a vote (an option or `other`). The rubric
limits votes per author (one per thread, two overall); everything else counts
once.

`node scripts/consensus.mjs validate consensus-result.json` lists every
problem. `render` runs the same checks before it builds the viewer.

**Coverage fields**

| Field | Meaning |
| --- | --- |
| `posts_read` | Every post and comment that came back from the tools you called. |
| `dropped_before_sorting` | `{ count, reasons }`: posts you removed before sorting (duplicates, out of window, deleted, too short, never on the subject). `posts_read` should equal `count` plus the number of `posts`. |
| `reddit.searches`, `threads_found` | Reddit searches run, and distinct threads they returned. |
| `reddit.threads_read`, `comment_pages` | Threads whose comments you read, and comment requests made. |
| `reddit.comments_read` | Comments returned across those pages. |
| `reddit.comments_total` | The sum of Reddit's own `commentCount` for the threads read: what a full read would cover. |
| `x.searches`, `x.pages` | X searches and result pages. |
| `x.posts_returned` | Posts returned by X searches (not counting replies). |
| `x.posts_kept` | Of those, posts that passed the on-topic, date and spam checks. |
| `x.reply_threads`, `x.replies_read` | Posts whose replies you read, and replies returned. |
| `rednote.searches`, `rednote.pages` | Rednote note searches and result pages. |
| `rednote.notes_returned`, `rednote.notes_kept` | Notes the searches returned, and those that passed the on-topic, date and spam checks. |
| `rednote.comment_pages`, `rednote.comments_read` | Comment requests made, and comments returned. |

Each source is its own sample. The viewer shows counts per source and lets the
reader narrow the view to one source; it never fetches anything.

## What `validate` checks

Errors stop `render`. Warnings are printed, shown in the viewer's Limits panel,
and should be fixed or explained in `limits`.

| Check | Level |
| --- | --- |
| Required fields, types, `format`, dates, window order, `sources` | error |
| Option ids (shape, reserved names, duplicates); 1 to 8 options; titles up to 80 characters | error |
| Post ids by source (`x_<id>`, `t3_`, `t1_`, `xhs_`, `xhsc_`), no duplicates, `kind` matches source, `source` listed in `sources` | error |
| Each link is `https`, on x.com/twitter.com, reddit.com or www.xiaohongshu.com, in post-link form, and its id matches the post id (a Rednote comment: its link is its note's, the same as `thread_url`) | error |
| `language` is a language tag | error |
| Labels name an option, `other`, `none` or `spam`; strength 1 to 3 for votes, 0 otherwise; theme ids exist | error |
| Post dates fall inside the window (one day of slack) | error |
| Quotes appear verbatim in a post with that option's label | error |
| `usage`: whole numbers; `requests` ≤ `budget`; `by_tool` adds up to `requests`; `unknown_charge` ≤ `failed`; `rates` are numbers; `budget_by_source` adds up to `budget` and names only listed sources | error |
| Requests sent (`requests` + `failed`) over `budget` | warning |
| `summary` reads like a population or market-share claim | error |
| `dropped_before_sorting` shape | error |
| Funnel: `posts_read` = dropped + sorted | warning |
| Fewer than 15 opinions counted (viewer hides shares) | warning |
| An option with fewer than 2 votes; Other over 30% | warning |
| A theme with fewer than 3 counted posts | warning |
| An option description over 15 words; a quote over 25 words | warning |
| An author with more than one vote in a thread, or more than two overall | warning |
| One thread supplies over a third of all votes, or over half of one option's votes (6+) | warning |
| Missing `created_at` | warning |

Not checked: whether a post still exists or says the same today, whether a
label is right, and whether the coverage numbers match what the tools
returned. Those rest on the agent's own reads.
