import type { AuthorProfile, Community, Done, Meta, PlanOption, Poll, Post, Progress, Reason, Theme } from './api';

// The results screen's state. Upstream Consensus filled it from a live search stream; the CoreSpeed edition viewer
// fills it once from a saved result file, so only the finished phase is used.
export type Phase = 'connecting' | 'streaming' | 'done' | 'error';

export interface SearchState {
  phase: Phase;
  meta: Meta | null;
  progress: Progress | null;
  options: PlanOption[];
  poll: Poll | null;
  posts: Record<string, Post>;
  postsVersion: number;
  reasons: Record<string, Reason>;
  themes: Theme[];
  authors: Record<string, AuthorProfile>;
  communities: Record<string, Community>;
  done: Done | null;
  error: { status: number; code: string; message: string } | null;
}
