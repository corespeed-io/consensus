import { useEffect, useRef, useState } from 'react';
import type { Source } from './api';
import { MIN_FOR_SHARES } from './format';
import { useI18n } from './i18n';

/** Eases a number toward its target so counts roll instead of jumping when a source is switched. */
function useTween(target: number, ms = 600): number {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      cur.current = target;
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      cur.current = from + (target - from) * (1 - Math.pow(1 - k, 3));
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const R = 74;
const W = 22;
const C = 2 * Math.PI * R;

/**
 * Counted opinions by platform: one ring, one arc per selected source, in that platform's own colour (Reddit
 * orange, X black, Rednote red). The colours here mean platforms only; answers are told apart by their labels.
 */
export function SourceRing({ parts, total }: { parts: { source: Source; count: number }[]; total: number }) {
  const { t, tp, num, pct } = useI18n();
  const shown = useTween(total);
  const [tip, setTip] = useState<{ source: Source; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const live = parts.filter((p) => p.count > 0);
  const gap = live.length > 1 ? 2.5 : 0;
  const sum = live.reduce((a, p) => a + p.count, 0) || 1;
  const label = `${num(total)} ${tp('donut_unit', total)}: ${parts.map((p) => `${t(`src_${p.source}`)} ${num(p.count)}`).join(', ')}`;
  const place = (e: React.PointerEvent, source: Source) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setTip({ source, x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const tipPart = tip ? parts.find((p) => p.source === tip.source) : undefined;
  let start = 0;
  const arcs = live.map((p) => {
    const len = (p.count / sum) * C;
    const arc = { ...p, seg: Math.max(0, len - gap), off: start };
    start += len;
    return arc;
  });
  return (
    <div className="ring" ref={box} onPointerLeave={() => setTip(null)}>
      <svg viewBox="0 0 200 200" role="img" aria-label={label}>
        <circle cx="100" cy="100" r={R} fill="none" className="ring-track" strokeWidth={W} />
        <g transform="rotate(-90 100 100)">
          {arcs.map((a) => (
            <g key={a.source} onPointerMove={(e) => place(e, a.source)} onPointerDown={(e) => place(e, a.source)}>
              {/* X is black: on the dark theme a light edge keeps its arc visible without changing its colour. */}
              {a.source === 'x' && <circle cx="100" cy="100" r={R} fill="none" className="ring-edge" strokeWidth={W + 3} strokeDasharray={`${a.seg} ${C}`} strokeDashoffset={-a.off} />}
              <circle cx="100" cy="100" r={R} fill="none" className={`ring-seg src-${a.source}`} strokeWidth={W} strokeDasharray={`${a.seg} ${C}`} strokeDashoffset={-a.off} />
            </g>
          ))}
        </g>
      </svg>
      <div className="ring-center" aria-hidden="true">
        <strong>{num(Math.round(shown))}</strong>
        <span>{tp('donut_unit', total)}</span>
      </div>
      {tip && tipPart && (
        <div className={`ring-tip ${tip.x > (box.current?.clientWidth ?? 200) * 0.55 ? 'flip' : ''}`} style={{ left: tip.x, top: tip.y }} role="tooltip">
          <i className={`src-${tipPart.source}`} />
          <span className="rt-title">{t(`src_${tipPart.source}`)}</span>
          <span className="rt-num">{total >= MIN_FOR_SHARES ? `${pct(tipPart.count / sum)} · ${num(tipPart.count)}` : num(tipPart.count)}</span>
        </div>
      )}
    </div>
  );
}
