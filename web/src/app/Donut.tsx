import { useEffect, useRef, useState } from 'react';
import { optionColor } from './format';
import { useI18n } from './i18n';

/** Eases a number toward its target so live counts roll instead of jumping. */
export function useTween(target: number, ms = 700): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  const cur = useRef(target);
  useEffect(() => {
    from.current = cur.current;
    if (from.current === target) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      cur.current = target;
      setV(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      cur.current = from.current + (target - from.current) * e;
      setV(cur.current);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export interface Slice {
  id: string;
  title: string;
  count: number;
}

// Ring geometry in the 200x200 viewBox: stroke is ~15% of the outer diameter, so the hole stays wide on phones.
const R = 74;
const W = 26;
const W_ON = W + 5;
const W_HOT = W + 3;
const C = 2 * Math.PI * R;
/** Hole diameter as a share of the donut box at the widest (selected) stroke. Used by CSS as --hole. */
export const HOLE = (2 * R - W_ON) / 200;

/** Fits the center number inside the hole: 100cqi is the padded hole width; serif digits ~0.6em, separators ~0.3em. */
function centerSize(text: string, max = 42): string {
  const em = [...text].reduce((a, ch) => a + (/[0-9]/.test(ch) ? 0.6 : 0.3), 0);
  return `min(${max}px, ${(96 / Math.max(1.8, em)).toFixed(1)}cqi, 56cqi)`;
}

export function Donut({
  slices,
  total,
  selected,
  onSelect,
  hovered,
  onHover,
}: {
  slices: Slice[];
  total: number;
  selected: string | null;
  onSelect: (id: string) => void;
  hovered?: string | null;
  onHover?: (id: string | null) => void;
}) {
  const { num, pct, tp } = useI18n();
  const label = tp('donut_unit', total);
  const shown = useTween(total);
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(tapTimer.current), []);
  const sum = slices.reduce((a, s) => a + s.count, 0) || 1;
  const gap = slices.filter((s) => s.count > 0).length > 1 ? 2.2 : 0;
  const place = (e: React.PointerEvent, id: string) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setTip({ id, x: e.clientX - r.left, y: e.clientY - r.top });
    onHover?.(id);
  };
  const clear = () => {
    setTip(null);
    onHover?.(null);
  };
  const tipSlice = tip ? slices.find((s) => s.id === tip.id) : undefined;
  const w = box.current?.clientWidth ?? 300;
  const centerText = num(Math.round(shown));
  let start = 0;
  return (
    <div className="donut" ref={box} onPointerLeave={(e) => e.pointerType === 'mouse' && clear()}>
      <svg viewBox="0 0 200 200" role="img" aria-label={`${num(total)} ${label}`}>
        <circle cx="100" cy="100" r={R} fill="none" className="donut-track" strokeWidth={W} />
        <g transform="rotate(-90 100 100)">
          {slices.map((s) => {
            const len = (s.count / sum) * C;
            const seg = Math.max(0, len - gap);
            const off = start;
            start += len;
            const on = selected === s.id;
            const hot = hovered === s.id;
            return (
              <circle
                key={s.id}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                style={{ stroke: optionColor(s.id) }}
                strokeWidth={on ? W_ON : hot ? W_HOT : W}
                strokeDasharray={`${seg} ${C}`}
                strokeDashoffset={-off}
                className={`donut-seg ${on ? 'on' : ''} ${hot ? 'hot' : ''} ${selected && !on && !hot ? 'dim' : ''}`}
                onPointerMove={(e) => e.pointerType === 'mouse' && place(e, s.id)}
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse') return;
                  place(e, s.id);
                  clearTimeout(tapTimer.current);
                  tapTimer.current = setTimeout(clear, 1800);
                }}
                onClick={() => onSelect(s.id)}
              />
            );
          })}
        </g>
      </svg>
      <div className="donut-center" style={{ ['--hole' as string]: HOLE }}>
        <div className="donut-hole">
          <strong style={{ fontSize: centerSize(centerText) }}>{centerText}</strong>
          <span>{label}</span>
        </div>
      </div>
      {tip && tipSlice && (
        <div
          className={`donut-tip ${tip.x > w * 0.55 ? 'flip' : ''}`}
          style={{ left: tip.x, top: tip.y, ['--c' as string]: optionColor(tipSlice.id) }}
          role="tooltip"
        >
          <i />
          <span className="dt-title">{tipSlice.title}</span>
          <span className="dt-num">
            {pct(tipSlice.count / sum)} · {num(tipSlice.count)}
          </span>
        </div>
      )}
    </div>
  );
}
