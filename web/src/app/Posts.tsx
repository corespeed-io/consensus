import { memo, useState } from 'react';
import { ArrowBigUp, ArrowUpRight, Heart, MessageCircle, MessageSquare, Repeat2 } from 'lucide-react';
import type { AuthorProfile, Community, Post } from './api';
import { useI18n } from './i18n';
import { RedditMark, SourceIcon } from './icons';
import { cleanPostText } from './postText';

/*
 * One post, verbatim. Interface text around it (metrics, dates, buttons) follows the reader's language; the post's
 * own words never change. dir="auto" lets right-to-left posts lay out correctly whatever the interface language.
 */

function Img({ src, className, fallback, bg, lazy }: { src: string | null | undefined; className: string; fallback: React.ReactNode; bg?: string | null; lazy?: boolean }) {
  const [bad, setBad] = useState(false);
  const style = bg ? { background: bg } : undefined;
  if (!src || bad)
    return (
      <span className={`${className} fallback`} style={style}>
        {fallback}
      </span>
    );
  return <img className={className} src={src} alt="" decoding="async" loading={lazy ? 'lazy' : undefined} referrerPolicy="no-referrer" onError={() => setBad(true)} style={style} />;
}

function Letter({ name, color }: { name: string; color?: string | null }) {
  const ch = name.replace(/^(r\/|u\/|@)/, '').trim()[0]?.toUpperCase() ?? '?';
  return (
    <span className="letter" style={{ color: color ? '#fff' : undefined }}>
      {ch}
    </span>
  );
}

/** Reddit's default Snoo for a user, picked by the same name hash the backend uses so a user's fallback never changes. */
function defaultSnoo(handle: string): string {
  let h = 0;
  for (const c of handle.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `https://www.redditstatic.com/avatars/defaults/v2/avatar_default_${h % 8}.png`;
}

const deletedUser = (h: string) => !h || h === '[deleted]' || h === '[removed]';

/** Reddit rows show the commenter's snoovatar (or their default Snoo); X rows show the author photo. */
export function PostIcon({ post, author }: { post: Post; author?: AuthorProfile }) {
  if (post.source === 'reddit') {
    const h = post.author.handle;
    if (deletedUser(h))
      return (
        <span className="post-icon snoo fallback">
          <RedditMark size={22} />
        </span>
      );
    const snoo = defaultSnoo(h);
    const src = author?.avatar || post.author.avatar || snoo;
    // Keyed by src so a late real avatar swaps in; a broken one falls back to the default Snoo.
    return <Img key={src} src={src} className="post-icon snoo" lazy fallback={src === snoo ? <RedditMark size={22} /> : <img className="snoo-fb" src={snoo} alt="" loading="lazy" referrerPolicy="no-referrer" />} />;
  }
  return <Img src={post.author.avatar} className="post-icon" fallback={<Letter name={post.author.name || post.author.handle} />} />;
}

/** The subreddit as a small tag next to the author: tiny community icon (or the Reddit mark) plus its name. */
function SubTag({ name, community }: { name: string; community?: Community }) {
  return (
    <span className="by-sub sub-tag" title={name}>
      <Img src={community?.icon} className="sub-ic" lazy bg={community?.color ?? '#FF4500'} fallback={<RedditMark size={12} />} />
      <span className="sub-name">{name}</span>
    </span>
  );
}

/** The post's own date, absolute: a snapshot read months later must not say "3d ago". */
function PostDate({ iso }: { iso: string | null }) {
  const { date, dateTime } = useI18n();
  if (!iso) return null;
  return (
    <time className="by-sub by-age" dateTime={iso} title={dateTime(iso)}>
      {date(iso)}
    </time>
  );
}

function Byline({ post, community }: { post: Post; community?: Community }) {
  const { tp, compact } = useI18n();
  if (post.source === 'reddit') {
    const h = post.author.handle;
    return (
      <div className="byline">
        <strong className="by-main">{deletedUser(h) ? '[deleted]' : `u/${h}`}</strong>
        {post.community && <SubTag name={post.community} community={community} />}
        <PostDate iso={post.created_at} />
      </div>
    );
  }
  if (post.source === 'rednote')
    return (
      <div className="byline">
        <strong className="by-main">{post.author.name || post.author.handle}</strong>
        <PostDate iso={post.created_at} />
      </div>
    );
  return (
    <div className="byline">
      <strong className="by-main">{post.author.name || `@${post.author.handle}`}</strong>
      {post.author.name && <span className="by-sub by-handle">@{post.author.handle}</span>}
      {post.author.followers ? <span className="by-sub by-followers">{tp('followers', post.author.followers, { count: compact(post.author.followers) })}</span> : null}
      <PostDate iso={post.created_at} />
    </div>
  );
}

/** A metric with its name for screen readers and a tooltip; the icon alone is decoration. */
function Metric({ name, value, children }: { name: string; value: string; children: React.ReactNode }) {
  return (
    <span data-tip={name}>
      <span aria-hidden="true">{children}</span> <span className="sr-only">{name}: </span>
      {value}
    </span>
  );
}

export function Engagement({ post }: { post: Post }) {
  const { t, compact } = useI18n();
  if (post.source === 'reddit')
    return (
      <div className="engage">
        <Metric name={t('upvotes')} value={compact(post.score)}>
          <ArrowBigUp size={16} />
        </Metric>
        <Metric name={t('replies')} value={compact(post.replies ?? 0)}>
          <MessageSquare size={14} />
        </Metric>
      </div>
    );
  return (
    <div className="engage">
      <Metric name={t('likes')} value={compact(post.score)}>
        <Heart size={14} />
      </Metric>
      <Metric name={t('replies')} value={compact(post.replies ?? 0)}>
        <MessageCircle size={14} />
      </Metric>
      {post.source === 'x' && post.reposts != null && (
        <Metric name={t('reposts')} value={compact(post.reposts)}>
          <Repeat2 size={15} />
        </Metric>
      )}
    </div>
  );
}

function cleanText(post: Post) {
  // Thread openers arrive as "title\nbody"; show the title once, in bold.
  if (post.kind === 'opener' && post.thread_title && post.text.startsWith(post.thread_title)) {
    return { title: cleanPostText(post.thread_title), body: cleanPostText(post.text.slice(post.thread_title.length)) };
  }
  return { title: null, body: cleanPostText(post.text) };
}

export const PostRow = memo(function PostRow({
  post,
  community,
  author,
  tag,
}: {
  post: Post;
  community?: Community;
  author?: AuthorProfile;
  /** The answer this post counts toward, shown in the All opinions view. */
  tag?: { title: string; color: string; lang?: string };
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { title, body } = cleanText(post);
  const flat = body.replace(/\s+/g, ' ');
  const long = (title?.length ?? 0) + flat.length > 260;
  const where = t(`open_${post.source}`);
  return (
    <article className="post">
      <PostIcon post={post} author={author} />
      <div className="post-main">
        <div className="post-top">
          <Byline post={post} community={community} />
          <a className="post-src" href={post.url} target="_blank" rel="noreferrer" data-tip={where} aria-label={where}>
            <SourceIcon source={post.source} size={post.source === 'x' ? 15 : 16} />
            <ArrowUpRight size={15} className="post-ext" aria-hidden="true" />
          </a>
        </div>
        <div className={`post-text ${open ? 'open' : ''}`} dir="auto">
          {title && <strong className="post-title">{title} </strong>}
          {open ? body : flat}
          {post.excerpt && (
            <span className="excerpt-mark" title={t('excerpt_tip')}>
              {' '}…<span className="sr-only"> ({t('excerpt_tip')})</span>
            </span>
          )}
        </div>
        {long && (
          <button className="link-btn more" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? t('show_less') : t('show_more')}
          </button>
        )}
        <div className="post-foot">
          <Engagement post={post} />
          <div className="post-tags">
            {tag && (
              <span className="opt-tag" style={{ ['--c' as string]: tag.color }} title={tag.title}>
                <i />
                <span lang={tag.lang}>{tag.title}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});
