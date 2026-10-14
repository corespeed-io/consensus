# Sorting rubric

Adapted from the prompts in the open-source Consensus pipeline by Straitly
(github.com/Straitly-ai/consensus, MIT): `src/v3/sort.ts` and `src/v3/themes.ts`.
Upstream ran them on a separate model. Here you, the host agent, apply them.

## 1. Write the answer options

Read a spread of the collected posts first (top comments from several threads,
plus the most-liked X posts). Then write the options: the distinct answers
people actually give.

Pick the question type, then follow its rule:

- **Yes/no** ("is X worth it", "will X happen", "should I", "is B worth
  switching to from A"): the two plain sides ("Worth it" / "Not worth it"),
  plus at most ONE middle option, only if many posts take it, naming its
  condition ("Only if your employer pays"). A reason or a flavour of a side is
  not an option ("Too expensive" is a reason for "Not worth it"). "Not worth
  it, use C instead" is a vote for "Not worth it".
- **A vs B**: "A is better", "B is better", plus at most one middle option
  ("Use both") only if many posts take it. A third product is an option only
  if MANY posts say "neither, use C".
- **Best X / which / who / where**: 4 to 7 options, one per specific named
  pick, the most recommended first. Count posts that recommend it, not posts
  that mention it. All options are the same kind of thing. If the question
  names a place, every pick is in that place.
- **Why / how / open** ("why do people switch from A to B"): the options are
  the main distinct reasons people give, 3 to 6 of them, each a concrete
  claim ("Better results on large refactors"), mutually exclusive enough that
  a post has one MAIN reason. Posts that give several reasons count for the
  first or strongest one; the themes (step 4) catch the rest.

"Many" means at least 4 posts and at least 10% of counted opinions.

Every option:

- answers the question as asked, taking its premise as given;
- has real support in the posts, ordered most to least common;
- is 1 to 6 words, plain and neutral, with a one-sentence description (15
  words at most) that says what it means, not why it is right;
- is not "Other", "Mixed", "It depends" or "Personal preference". Other is
  added for you.

Treat spellings of one name as one subject (YC = Y Combinator, CC = Claude
Code).

## 2. Sort every post

THE TEST: if you asked this poster the question, what would they answer, judging
ONLY from what they wrote here (and the comment or post it replies to)? If you
can tell, it is a vote. If you cannot tell, it is N. Being about the same topic
is NOT a vote.

Buckets:

- **An option**: the post answers that way, in words or by clear implication.
  Under "is X worth it", "cancelled it, total waste of money" is "Not worth
  it". Under "A vs B", "switched from A to B and never looked back" is B. A
  short reply counts when the comment it answers makes the lean clear.
- **O (Other)**: a clear answer of the same kind that no option captures.
  Vague complaints, "none", or takes on the whole category are N, not O.
- **N (no answer)**: on-topic posts that do not answer THIS question; general
  praise or criticism that does not answer what was asked; news, stats,
  facts; tips; questions; jokes; "agreed", "this", "lol"; mixed views with no
  lean. A thread opener that only asks the question is N. An opener that also
  states the poster's own verdict or experience ("switched last month, never
  going back") is a vote like any other post.
- **S (remove)**: spam, ads, giveaways, bots, link drops, self-promotion ("we
  built", "check out my", "DM me"), brand or staff accounts promoting their
  own product, affiliate listicles, posts about a different thing that only
  shares a word, and the wrong place or subject.

More rules:

- MENTION IS NOT A VOTE. Naming a pick as one of several to "check out" is N.
  It is a vote only when the poster says it is the best, their favourite, what
  they chose and liked, or what they recommend over others.
- ANNOUNCEMENTS ARE NOT VOTES. Launches, "applications open", "just got
  accepted" with no judgement, and hype from the subject's own account are S
  or N.
- Under A vs B, "A is overrated" is not a vote for B unless they say B (or the
  alternative) is better or that they chose B.
- A ranked list that names the poster's own top choice is a vote for their #1.
- If a post picks several options, use the first it names.
- One vote per author per thread. When someone replies several times in one
  thread, count their clearest post and label the others N. Across threads, an
  author gets at most two votes. A thread is a Reddit thread, the replies under
  one X post, or a Rednote note with its comments. The same person on two
  platforms cannot be matched, so count them separately.
- Judge a post in its own language. Never translate a post to sort it, and keep
  its quote verbatim.
- Be strict. When in doubt between an option and N, choose N. A wrong vote is
  much worse than a missed one.

Strength, for options and O: 3 = clear answer with a reason or first-hand
experience; 2 = clear answer; 1 = implied but unmistakable. Use 0 for N and S.
Rank strength-1 votes last; upstream found them right only about a quarter of
the time.

## 3. Fold and recount

- An option with fewer than 2 votes, or under 3% of counted opinions, moves to
  Other. List folded names under "also mentioned in Other".
- At most 6 options on screen (8 for long-tail "best X"). The smallest go to
  Other.
- If Other holds more than 30% of counted opinions, look at it again: either
  posts really lean to an existing option, or a real new option is missing
  (4 or more posts with the same new answer). Fix that, then recount.
- Recount from the final labels. The numbers in the report must equal the
  labelled posts you list.

## 4. Themes: the reasons behind the answers

Themes are specific, repeated claims ("Opus handles big refactors without
hand-holding", "Cursor's tab completion is still unmatched"). They are
multi-label: one post can carry several, and a theme can come from voters of
more than one option.

- Write 4 to 10 themes from the counted opinions, sampled across options so
  small sides get their own themes.
- Title 3 to 9 words, as people would say it; one neutral sentence of
  description.
- Each theme needs at least 3 posts that make it (2 in a thin sample, and say
  so).
- No generic themes ("Good experience"). No themes about spam or news.
- Tag a post only when its own words make that argument.

## 5. Why people chose each answer

For each option, write one or two plain sentences (40 words at most) naming
the reasons that come up most. Then pick 2 or 3 posts that show them best and
quote them verbatim (25 words at most each), with the link. If you shorten a
quote, mark the cut with "…". Never put words in a poster's mouth.
