# CoreSpeed social tools: what Consensus uses

Facts below come from CoreSpeed's public docs (corespeed.io/docs/social and
corespeed.io/docs/reference/errors), its live `tools/list`, and real calls made
on 2026-10-14. Treat the tool schemas your client shows as the authority. If a
field is missing, skip the item; never invent it.

Your client may prefix the names. Claude Code shows `social__x_search` as
`mcp__corespeed__social__x_search`. Some clients defer tool loading; then search
for `corespeed social` to load them.

## Cost

Each tool states its rate in its description. On 2026-10-14 the four Reddit
and X tools said "Cost: 1.5 credits per successful request. Failures never
charge.", and the four `social__xiaohongshu_*` tools said 15 credits per
successful request. The public docs (corespeed.io/docs/social and
corespeed.io/pricing) gave the same two rates that day. Read the descriptions
again before a run, because the rate there is the live rate. Record each tool's
rate in `usage.rates` when the run mixes rates. A page clipped by
`max_characters` is still a successful request, so it is charged.

Plans on corespeed.io/pricing (checked 2026-10-14): Free has 3,000 credits per
90 days. Pro is $20 per month with 10,000 credits. Quote credits in reports, not
dollars, unless the user asks.

## social__x_search

Arguments: `keyword` (required), `search_type` (`Top` default, `Latest`,
`Media`, `People`, `Lists`), `cursor`, `max_characters`.

The keyword goes to X search as typed. In live samples, `since:YYYY-MM-DD`,
`lang:en`, AND-ed words and `(a OR b)` groups of single words were honoured,
and `-filter:retweets` was accepted. An OR group of several quoted phrases
(`("better than cursor" OR "over cursor" OR ...)`) returned 20 posts and none
contained any of the phrases, so keep queries simple. These are samples, not
guarantees. Check each post's date and words yourself. `Latest` results in one
sample were not in date order.

A page held 9 to 20 posts in testing and was up to about 70,000 characters of
JSON, most of it media metadata.

```text
{ status, next_cursor, prev_cursor,
  timeline: [ { type: "tweet", tweet_id: "2041912159190577403", screen_name,
                text, created_at: "Wed Apr 08 16:12:50 +0000 2026", lang,
                favorites, replies, retweets, quotes, bookmarks, views: "479",
                conversation_id,
                user_info: { screen_name, name, followers_count, verified, avatar },
                entities, media } ] }
```

- Link: `https://x.com/{screen_name}/status/{tweet_id}`.
- A reply has `conversation_id` different from `tweet_id`.
- `views` is a string. `tweet_id` is a string; never treat it as a number.
- The next page: pass `next_cursor` back as `cursor`. The cursor is at the END of
  the JSON, so a page clipped by `max_characters` loses it.

## social__x_post_comments

Arguments: `tweet_id` (numeric string), `cursor`, `max_characters`.

The root post's fields sit at the top level. The replies are in `thread[]`. In
live samples, a post with 30 replies returned 27, and one with 21 replies
returned 21. A `cursor` field may or may not be present.

```text
{ id, text, display_text, created_at, likes, replies, retweets, views,
  conversation_id, status, author: { screen_name, name, blue_verified, image },
  thread: [ { id, text, display_text, created_at, likes, replies, retweets,
              quotes, views, conversation_id, author: { screen_name, name, ... } } ] }
```

- Replies by the root author are usually the rest of their own thread (links,
  plugs), not answers.
- `text` starts with the @mentions of the reply chain; `display_text` drops
  them. Store `text` (it is what the post says); judge length on `display_text`.
- Link: `https://x.com/{author.screen_name}/status/{id}`.

## social__reddit_search

Arguments: `query` (required; AND, OR, NOT, quotes and field filters),
`search_type` (`post` default, `community`, `comment`, `media`, `people`),
`sort` (`RELEVANCE`, `HOT`, `TOP`, `NEW`, `COMMENTS`), `time_range` (`all`,
`year`, `month`, `week`, `day`, `hour`; posts and media only), `after`,
`need_format`, `max_characters`.

Always pass `need_format: true`. The payload is smaller and flat. A page held 7
posts and about 18,000 characters.

```text
{ children: [ { post: { id: "t3_1x3r2hw", postTitle, permalink, url, score,
                         commentCount, createdAt: "2026-10-12T03:11:48.009000+0000",
                         content: { markdown },
                         subreddit: { prefixedName: "r/cursor", subscribersCount },
                         authorInfo: { name } } } ],
  pageInfo: { endCursor, hasNextPage } }
```

- Link: `https://www.reddit.com{permalink}`. For a link post, `url` is the
  outside link, not the thread.
- Next page: `after: pageInfo.endCursor`.
- `search_type: "comment"` returned 6 comments a page in a live sample. Most
  were old and off-topic, and `permalink` was null. Prefer post search, then
  read comments.

## social__reddit_post_comments

Arguments: `post_id` (`t3_...` or bare), `after`, `sort_type` (`CONFIDENCE`
default, `TOP`, `NEW`, `HOT`, `CONTROVERSIAL`, `OLD`, `RANDOM`), `need_format`,
`max_characters`.

Pass `sort_type: "TOP"` and `need_format: true`. A page returns about 8 comments
(a live 89-comment thread gave 8), about 17,000 characters. A full thread is
many requests, so read a sample.

```text
{ postInfoById: { id, title, commentCount,
    subreddit: { prefixedName },
    commentForest: {
      trees: [ { depth: 0, childCount,
                 node: { id: "t1_pfdweev", createdAt, score, permalink,
                         content: { markdown }, authorInfo: { name } } },
               { depth: 0, more: { count: 74, cursor: "commenttree:..." } } ],
      pageInfo: { commentCount, hasNextPage } } } }
```

- Link: `https://www.reddit.com{node.permalink}`.
- Parent: `parentId` names the comment it answers; it is absent on top-level
  comments. Read short replies ("Yes", "This") with their parent.
- Count of comments on the thread: `postInfoById.commentCount` (Reddit's own
  total). Use it for `coverage.reddit.comments_total`.
- Next page: pass the `more.cursor` of the entry with `depth: 0` as `after`.
  This was verified live. Deeper `more` entries are nested replies; this skill
  does not follow them, so say so in the coverage notes.
- A removed or unknown post answers `{"postInfoById": null}`. This is not an
  error result, so it is likely charged. Count it and move on.
- Skip `[deleted]` and `[removed]` bodies and `AutoModerator`.

## Rednote (Xiaohongshu)

Checked on 2026-10-14 against three live calls (search page 1, search page 2,
one comment page), plus the tools' schemas and the public docs. Rate: 15
credits per successful request, for every `social__xiaohongshu_*` tool.

### social__xiaohongshu_search_notes

Arguments: `keyword` (required), `page` (from 1), `search_id` and
`search_session_id` (pass back what the first page returned, on every later
page), `sort_type` (`general` default, `time_descending`,
`popularity_descending`, `comment_descending`, `collect_descending`,
`english_preferred`), `note_type` (`不限` all, `视频笔记` video, `普通笔记`
image, `直播笔记` live), `time_filter` (`不限` any, `一天内` 24 h, `一周内` 7 days,
`半年内` 6 months), `ai_mode` (0 or 1), `source`, `max_characters`.

A page held 20 items (19 notes and 1 ad) and about 100,000 characters.

```text
{ success, code: 0, msg, search_id, search_session_id, page, next_page,
  data: { items: [ { model_type: "note",
                     note: { id: "6ac70dba000000000a023d25", title, desc,
                             timestamp (Unix seconds), liked_count,
                             comments_count, collected_count, xsec_token,
                             type: "normal" | "video",
                             user: { userid, nickname, images, red_id } } },
                   { model_type: "ads", ads: { ... } } ],
          onebox: { ... } } }
```

- `desc` is only the start of the note (about 60 characters). Sort on the
  title and that start, and mark the post `"excerpt": true`. There is no tool
  for a note's full text.
- Some notes have no `title`; use `desc` alone.
- Skip `ads` items and the `onebox` card: they are not posts.
- Next page: the same keyword and filters, `page: next_page`, and the
  `search_id` and `search_session_id` of the first page. Seen live: page 2
  echoed the same pair and returned 19 new notes.
- `time_filter` has no "year" step. For a 12-month window, use `不限` and drop
  notes older than the window yourself, by `timestamp`.
- Link: `https://www.xiaohongshu.com/explore/{id}?xsec_token={xsec_token}`.
  Without the token, the page says the note cannot be viewed. With it, readers
  may still be asked to sign in to Rednote.

### social__xiaohongshu_note_comments

Arguments: exactly one of `note_id` or `share_text`, `cursor`, `index`,
`sort_strategy` (`default`, `latest_v2`, `like_count`), `pageArea`
(`UNFOLDED` default, `FOLDED`), `max_characters`.

Pass `sort_strategy: "like_count"`. A page held 10 top-level comments, each
with its first reply, in about 24,000 characters.

```text
{ success, code: 0,
  data: { comments: [ { id, note_id, content, time (Unix seconds), like_count,
                        sub_comment_count, ip_location,
                        user: { userid, nickname, images },
                        sub_comments: [ { id, content, time, like_count, user,
                                          target_comment: { id, user } } ] } ],
          comment_count, comment_count_l1, has_more, cursor } }
```

- A comment has no public link of its own: cite its note's link, with the
  token from the search, and set `thread_url` to the same link.
- Commenter `userid`s are 29 characters, unlike the 24 of note authors, so a
  note's author cannot be matched among its commenters by id. One account that
  replies to many comments under a note is usually its author; those replies
  are their own thread, not answers.
- Next page: pass `cursor` back unchanged (a JSON string). This was not tested
  live.
- A note id that does not exist still answers and still bills. Use only ids
  from your own search results.

`social__xiaohongshu_profile` and `social__xiaohongshu_user_notes` also exist.
This skill does not need them.

### Rednote posts in the result file

| Field | Note | Comment |
| --- | --- | --- |
| `source` | `"rednote"` | `"rednote"` |
| `kind` | `"note"` | `"comment"` |
| `id` | `xhs_<note.id>` | `xhsc_<comment.id>` |
| `url` | the note link with its token | the note's link (a comment has none) |
| `thread_url` | the same link | the note's link (required) |
| `thread_title` | `note.title`, if any | the note's title |
| `text` | the title, a new line, then `desc` | `content` |
| `excerpt` | `true` | – |
| `author` / `author_name` | `user.userid` / `user.nickname` | the same, for the commenter |
| `created_at` | `timestamp` (seconds) | `time` (seconds) |
| `score` / `replies` | `liked_count` / `comments_count` | `like_count` / `sub_comment_count` |
| `parent_text` | – | for a reply, the comment it answers |

`consensus.mjs ingest social__xiaohongshu_search_notes <file>` and
`ingest social__xiaohongshu_note_comments <file> --note-url <the note's link>
--note-title <its title>` build these rows for you.

## Errors

Check `isError` on every result before reading it.

| What you see | Meaning | What to do |
| --- | --- | --- |
| `Input validation error: ...` | An argument broke the schema. Not charged. | Fix the argument; do not count it. |
| `structuredContent.error.code` = `upstream_error` (with `status`) | The data supplier refused this request. Not charged. | Skip this page; note it in coverage. |
| `rate_limited` (may carry `retry_after_seconds`) | Too many requests. | Wait, retry once, then skip. |
| `upstream_unreachable`, `upstream_response_invalid`, `timeout` | Supplier down or slow. | Retry once, then skip. |
| `payment_required` | The organization is out of credits. | Stop. Tell the user to add credits at https://app.corespeed.io/billing. Report what you have so far, marked partial. |
| `key_spend_limit_exceeded` | The key hit its monthly cap. | Stop. Point to https://app.corespeed.io/keys. |
| `org_suspended`, HTTP 403 | The account is paused. | Stop. Point to https://app.corespeed.io. |
| HTTP 401 on every call | The sign-in did not finish, or the key is wrong. | Stop. Re-run the client's CoreSpeed sign-in. |
| `Tool ... not found` (JSON-RPC -32602), or the tools are missing | The tool is not on this caller's surface. Possible causes: no server configured, sign-in not finished, tools not loaded yet by the client, or Social media research turned off. | Check which: are other CoreSpeed tools (`memory__*`) present? Then send the user to the matching fix (SKILL.md, "Before you start"). Turning it on is at https://app.corespeed.io/tools. |
| Text that is not whole JSON and ends with a note about truncation | The page was clipped at `max_characters`. Charged. | Use what is readable; the cursor is gone. Count it as truncated. Next time, ask for a smaller page or raise `max_characters`. |
| A timeout or dropped connection (`ECONNRESET`), with no result at all | The request may have run, and may have been charged. 3 of 17 calls in one run on 2026-10-14. | Count it against the budget; record it in `usage.unknown_charge`; retry once only if the budget has room. |

The billing-hold and session refusals put a JSON envelope in the text itself,
for example `{"error":{"code":"payment_required",...}}`. Read the `code`
there.

## Speed

Calls took 4 to 8 seconds each in testing. Run independent calls in parallel
when your client allows it, but keep it to about 4 at a time.
