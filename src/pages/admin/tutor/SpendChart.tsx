import { useState, type KeyboardEvent } from 'react';
import type { AiUsageDay } from '@/api/tutor';
import { formatCount } from '@/lib/format';
import { formatUsd } from '@/pages/tutor/tutorFormat';
import { formatLongDate, formatShortDate, niceMax } from './spendRange';
import adminStyles from './TutorAdmin.module.css';

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 12, right: 8, bottom: 28, left: 64 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const TICKS = 4;
const X_LABELS = 6;

/** A bar with 4 px rounded top corners, anchored square on the baseline. */
function barPath(x: number, width: number, height: number): string {
  const bottom = PAD.top + PLOT_H;
  const top = bottom - height;
  const r = Math.min(4, width / 2, height);
  return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`;
}

function tooltipText(day: AiUsageDay): string {
  return `${formatLongDate(day.date)} · ${formatUsd(day.cost)} · ${formatCount(day.questions)} ${day.questions === 1 ? 'question' : 'questions'}`;
}

/**
 * The daily cost as bars, drawn by hand in SVG (no chart library, plan F6.3). Hovering a day, or
 * focusing the chart and moving with ←/→ (Home/End), shows its date, cost and questions; the
 * same rows are available as a table beside it.
 */
export function SpendChart({ days, label }: { days: AiUsageDay[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...days.map((d) => d.cost)));
  const band = days.length ? PLOT_W / days.length : PLOT_W;
  const gap = Math.min(2, band * 0.25);
  const barWidth = Math.max(band - gap, 0.5);
  const y = (cost: number) => (max > 0 ? (cost / max) * PLOT_H : 0);
  const step = Math.max(1, Math.ceil(days.length / X_LABELS));
  const activeDay = active !== null ? days[active] : undefined;

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (!days.length) return;
    const last = days.length - 1;
    const current = active ?? last;
    const next =
      event.key === 'ArrowRight'
        ? Math.min(current + 1, last)
        : event.key === 'ArrowLeft'
          ? Math.max(current - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  return (
    <div className={adminStyles.chart}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className={adminStyles.chartSvg}
        role="img"
        aria-label={label}
        aria-describedby="spend-chart-help"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? (days.length ? days.length - 1 : null))}
        onBlur={() => setActive(null)}
        onMouseLeave={() => setActive(null)}
      >
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const value = (max / TICKS) * i;
          const lineY = PAD.top + PLOT_H - (PLOT_H / TICKS) * i;
          return (
            <g key={i} aria-hidden="true">
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={lineY} y2={lineY} className={adminStyles.gridLine} />
              {(max > 0 || i === 0) && (
                <text x={PAD.left - 6} y={lineY + 4} textAnchor="end" className={adminStyles.axisText}>
                  {formatUsd(value)}
                </text>
              )}
            </g>
          );
        })}
        {days.map((day, i) => {
          const x = PAD.left + i * band + gap / 2;
          const height = y(day.cost);
          return (
            <g key={day.date} aria-hidden="true">
              {height > 0 && (
                <path
                  d={barPath(x, barWidth, height)}
                  className={i === active ? adminStyles.barActive : adminStyles.bar}
                />
              )}
              {/* The hit target spans the whole day's band, taller and wider than the bar. */}
              <rect
                x={PAD.left + i * band}
                y={PAD.top}
                width={band}
                height={PLOT_H}
                className={i === active ? adminStyles.hitActive : adminStyles.hit}
                onMouseEnter={() => setActive(i)}
              />
              {i % step === 0 && (
                <text x={x + barWidth / 2} y={HEIGHT - 8} textAnchor="middle" className={adminStyles.axisText}>
                  {formatShortDate(day.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p id="spend-chart-help" className={adminStyles.chartHelp}>
        Hover a day, or focus the chart and use the arrow keys, to see its cost.
      </p>
      <p role="status" aria-live="polite" className={adminStyles.tooltipLine}>
        {activeDay ? tooltipText(activeDay) : ''}
      </p>
      {activeDay && active !== null && (
        <div
          className={adminStyles.tooltip}
          aria-hidden="true"
          style={{
            left: `${((PAD.left + (active + 0.5) * band) / WIDTH) * 100}%`,
            top: `${((PAD.top + PLOT_H - y(activeDay.cost)) / HEIGHT) * 100}%`,
          }}
        >
          <strong>{formatLongDate(activeDay.date)}</strong>
          <span>{formatUsd(activeDay.cost)}</span>
          <span>
            {formatCount(activeDay.questions)} {activeDay.questions === 1 ? 'question' : 'questions'}
          </span>
        </div>
      )}
    </div>
  );
}
