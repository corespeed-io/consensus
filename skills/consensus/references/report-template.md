# Report template

Fill this in. Keep the headings. Delete a section only when it has nothing in it,
and say so in one line. Every number must come from your labelled evidence.
Every link must be a post you actually read.

Write the report once, in the report language (the user's, unless they asked
for another), and translate the headings too. Quotes stay verbatim in their
own language. Keep only the source columns for sources this run collected.

```markdown
# <The question, as the user asked it>

> **In this sample:** <one or two sentences: the answer most counted posts give,
> how clear the split is, and the biggest caveat.>
>
> <N> opinions counted from <M> posts read on <the sources collected>, <date
> range of the posts>. A sample of public posts, not a survey.

## What people say

| Answer | Reddit | X | Rednote | All selected | Share of all selected |
| --- | ---: | ---: | ---: | ---: | ---: |
| <Option title> | <n> | <n> | <n> | <n> | <n / N, whole %> |
| Other | <n> | <n> | <n> | <n> | <%> |
| **Total counted** | **<n>** | **<n>** | **<n>** | **<N>** | 100% |

<Each source is its own sample: read the columns side by side. The last two
columns pool the selected sources; call that "of the opinions counted across
the selected sources", never a share of people. If N < 15, drop the share
column and write "Too few opinions for shares; read these as anecdotes." If one
source holds > 80% of the votes, say so.>

## Why

### <Option title> (<n>)

<One or two sentences: the reasons that come up most.>

- "<verbatim quote, 25 words at most>" — u/<author>, r/<sub>, <YYYY-MM-DD>, <score> upvotes · [source](<url>)
- "<quote>" — @<handle> on X, <YYYY-MM-DD>, <likes> likes · [source](<url>)

<repeat per option, largest first; Other last, with "also mentioned: A (n), B (n)">

## Recurring themes

| Theme | Posts | Mostly from |
| --- | ---: | --- |
| <specific claim> | <n> | <option(s)> |

## Worth knowing

<2 to 4 bullets: the strongest minority view, real disagreements, anything that
changed over time, signs of brigading or promotion you removed.>

## Sources and coverage

- Window: <since> to <until, or "today">. Post language: <English>. Report
  language: <the one you wrote in>.
- Sources: <the ones picked, and who picked them: the user, or the default>.
- Reddit: <k> searches, <t> threads read, <c> of about <C> comments read (top
  comments first; replies behind "load more" not opened).
- X: <q> searches, <p> result pages, <x> posts returned, <y> kept after on-topic,
  date and spam filters; replies read under <r> posts.
- Rednote: <s> searches, <p> result pages, <n> notes returned, <k> kept;
  comments read under <c> notes.
- Posts read <M> → removed as spam or off-topic <s> → no answer <a> → counted <N>.
- Problems: <failed requests and codes / truncated pages / budget stop / "none">.

## Cost

Per tool: <successful requests> × <its stated rate> credits, summed:
**<total> credits** (rates from the tool descriptions on <date>; Rednote tools
stated 15, Reddit and X 1.5). Budget: <B> requests in total, split <Reddit
b1 / X b2 / Rednote b3>, retries included. <F> failed requests: tool errors are
not charged; <U> timed out or lost the connection, so their charge is unknown
and the cost is at most <total + those requests at their rate> credits. These
are estimates; exact charges are in the CoreSpeed Activity log.

## Limits of this read

- Search ranking decides what is read: these are the posts Reddit and X search
  return for these queries, not a random sample of people.
- People who post online are not everyone. Loud or recent views can be
  over-represented; quiet satisfied users rarely post.
- <Reddit: top comments of a few threads only.> <X: Top results, English only.>
  <Rednote: first result pages only; mostly Chinese-language notes.>
- <Anything specific to this run.>

<details><summary>Method and queries</summary>

Queries: <list each query and tool>. Threads read: <titles with links>.
Sorting followed the Consensus rubric: a post counts only if its own words
answer the question; mentions, news and promotion do not count.

</details>

---
Made with the Consensus skill (CoreSpeed edition), based on
[Consensus](https://github.com/Straitly-ai/consensus) by Straitly (MIT).
Public posts read through [CoreSpeed](https://corespeed.io) Social Media Scrape.
```

## Wording rules

- Say "of counted opinions in this sample", "posts", "people who posted".
  Never "X% of developers", "most users", "the market", "market share".
- Shares only when N ≥ 15. Round to whole percent. Show the counts beside them.
- Quotes are verbatim. Mark cuts with "…". Never merge two posts into one quote.
- Dates are the post's own date (`YYYY-MM-DD`), not the day you read it.
- If a source returned nothing, say so plainly; do not fill the gap from memory.
- If CoreSpeed stopped the run (credits, cap, sign-in), title the report
  "Partial read" and say what is missing.
