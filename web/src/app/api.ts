import type { Poll as V3Poll, PollOption as V3PollOption, Post as V3Post, Reason, Theme as V3Theme, V3Source } from '../../../src/v3/types';

// The viewer makes no network calls: these are the shapes of the results screen's data, as the original Consensus
// pipeline streamed them. The CoreSpeed edition builds them from a result file (skills/consensus/scripts/result.mjs),
// and adds Rednote as a third source.
export type Source = V3Source | 'rednote';
export const SOURCE_ORDER: Source[] = ['reddit', 'x', 'rednote'];
export type Post = Omit<V3Post, 'source'> & { source: Source; /** Only the start of the text (Rednote search). */ excerpt?: boolean };
export type PollOption = Omit<V3PollOption, 'by_source'> & { by_source: Record<Source, number> };
export type Poll = Omit<V3Poll, 'options'> & { options: PollOption[] };
export type Theme = Omit<V3Theme, 'by_source'> & { by_source: Record<Source, number> };
export type { Reason, V3Source };
export type Intent = 'looking' | 'switching' | 'frustrated' | 'just_bought';

export interface PlanOption {
  id: string;
  title: string;
  description: string;
  is_other: boolean;
}
export interface Progress {
  stage: string;
  elapsed_ms: number;
  reddit: { threads: number; posts: number; done: boolean };
  x: { posts: number; done: boolean };
  sorted: number;
  pool: number;
}
export interface Meta {
  id: string;
  query: string;
  since: string | null;
  until: string | null;
  sources: Source[];
  cached: boolean;
  /** When the result was made (a saved snapshot, never a live run). */
  saved_at?: string;
}
export interface Community {
  icon: string | null;
  color: string | null;
  subscribers: number | null;
  url: string;
}
export interface AuthorProfile {
  avatar?: string | null;
  karma?: number | null;
  name?: string | null;
}
export interface Done {
  id: string;
  status: 'ok' | 'thin' | 'empty';
  reason?: 'off_topic' | string;
  total_ms: number;
  timing?: Record<string, number>;
  /** Sanity flags (e.g. "thin_pool", "other_heavy"); empty when the poll looks healthy. */
  quality?: { flags?: string[] };
}
