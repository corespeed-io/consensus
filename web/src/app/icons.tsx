import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReddit, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import type { Source } from './api';

export const RedditMark = ({ size = 16 }: { size?: number }) => <FontAwesomeIcon icon={faReddit} style={{ width: size, height: size, color: '#FF4500' }} />;
export const XMark = ({ size = 15 }: { size?: number }) => <FontAwesomeIcon icon={faXTwitter} style={{ width: size, height: size }} />;

/** The Consensus mark: three bars, same artwork as the favicon, drawn in the current text colour. */
export const LogoMark = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="4 4 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M6 26h4V12H6v14zm8 0h4V6h-4v20zm8 0h4v-8h-4v8z" />
  </svg>
);

/** Rednote: an original mark (a red tile with a folded note), not the platform's logo. */
export const RednoteMark = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect width="16" height="16" rx="4" fill="#E8333F" />
    <path d="M4.5 4h5l2 2v6h-7z" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M6.3 8h3.4M6.3 10h2.4" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export function SourceIcon({ source, size = 14 }: { source: Source; size?: number }) {
  if (source === 'reddit') return <RedditMark size={size} />;
  if (source === 'x') return <XMark size={Math.round(size * 0.85)} />;
  return <RednoteMark size={size} />;
}
