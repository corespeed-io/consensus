# CoreSpeed payload fixtures

These files are real CoreSpeed MCP results, recorded on 2026-10-14 from the
production endpoint (`https://api.corespeed.io/mcp`) and trimmed to a few
items each. They hold public X, Reddit and Rednote posts. The Rednote files drop
`debug_info`, `debug_id` and the `onebox` card (an opaque token, an id and a
search-assistant card, none of them posts); every other field is as returned. Only the unit tests use them.
The app never shows them as search results.

| File | Tool and arguments |
| --- | --- |
| `x_search.json` | `social__x_search` `{ keyword: 'cursor "claude code" switched', search_type: "Top" }` (first 4 tweets) |
| `x_post_comments.json` | `social__x_post_comments` on a tweet with 30 replies (first 4 replies) |
| `reddit_search_posts.json` | `social__reddit_search` `{ query: "cursor vs claude code", search_type: "post", sort: "RELEVANCE", time_range: "year", need_format: true }` (first 3 posts) |
| `reddit_post_comments.json` | `social__reddit_post_comments` `{ post_id: "t3_1x3r2hw", need_format: true }` (full first page) |
| `xiaohongshu_search_p1.json` | `social__xiaohongshu_search_notes` `{ keyword: "Claude Code 和 Cursor", page: 1, sort_type: "general" }` (6 of 20 items: 4 titled notes, 1 untitled note, 1 ad) |
| `xiaohongshu_search_p2.json` | the same search, `page: 2` with page 1's `search_id` and `search_session_id` (first 2 notes) |
| `xiaohongshu_note_comments.json` | `social__xiaohongshu_note_comments` `{ note_id: "6ac70dba000000000a023d25", sort_strategy: "like_count" }` (first 4 comments, each with its loaded reply) |
| `result_err_bogus.json` | `social__reddit_post_comments` on a post id that does not exist: success with `postInfoById: null` |
| `result_err_schema.json` | `social__reddit_search` with an invalid `search_type`: `isError` input validation |
| `result_err_xpost.json` | `social__x_post` with `tweet_id: "1"`: `isError` with `structuredContent.error.code = upstream_error` |

The X, Reddit and Rednote files hold the tool's text content, parsed as JSON. The
`result_*` files hold the whole MCP `CallToolResult`.
