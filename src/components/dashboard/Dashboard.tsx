/**
 * Building blocks of the role homes (UI spec UR.1, UR.3): the sky hero card, pastel placards that
 * open a screen, the dark action card, segment bars and a sparkline. Each card loads on its own:
 * pass `state` and a failing card shows its own error without blanking the page (§0.3).
 */
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { CardState } from './cardState';
import { errorMessage } from '@/api/errors';
import { LexlySpark } from '@/components/brand/Logo';
import { SparkIcon } from '@/components/icons/Icons';
import styles from './Dashboard.module.css';

export type PlacardTone = 'lavender' | 'mint' | 'cream';

function CardProblem({ state, label }: { state: CardState; label: string }) {
  if (state.status === 'loading') {
    return (
      <span role="status" className={styles.cardLoading}>
        <span className={styles.visuallyHidden}>Loading {label}…</span>
        <span className={styles.skeletonLine} aria-hidden="true" />
        <span className={styles.skeletonLineShort} aria-hidden="true" />
      </span>
    );
  }
  if (state.status === 'error') {
    return (
      <span role="alert" className={styles.cardError}>
        {errorMessage(state.error)}{' '}
        <button type="button" className={styles.linkButton} onClick={state.retry}>
          Try again
        </button>
      </span>
    );
  }
  return null;
}

/** Page header of a home: the context line (optional) and the H1. */
export function DashboardHeader({ eyebrow, title, actions }: { eyebrow?: string; title: string; actions?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div>
        {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
        <h1 className={styles.title}>{title}</h1>
      </div>
      {actions}
    </header>
  );
}

/** A row of the home: the first child takes ~40 %, the second the rest; they stack on narrow screens. */
export function DashboardRow({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function HeroCard({
  id,
  title,
  value,
  sub,
  action,
  state = { status: 'ready' },
  children,
}: {
  id: string;
  title: string;
  value?: ReactNode;
  sub?: ReactNode;
  action?: { to: string; label: string };
  state?: CardState;
  children?: ReactNode;
}) {
  return (
    <section className={styles.hero} aria-labelledby={id}>
      <div className={styles.heroHead}>
        <div className={styles.heroText}>
          <h2 id={id} className={styles.heroTitle}>
            {title}
          </h2>
          {state.status === 'ready' && value !== undefined && <p className={styles.heroValue}>{value}</p>}
          {state.status === 'ready' && sub && <p className={styles.heroSub}>{sub}</p>}
        </div>
        {action && (
          <Link to={action.to} className={styles.pillLink}>
            {action.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {state.status === 'ready' ? children : <CardProblem state={state} label={title} />}
    </section>
  );
}

/** The group of three placards with its heading. */
export function PlacardGroup({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.placardGroup} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <ul className={styles.placards}>{children}</ul>
    </section>
  );
}

/**
 * A pastel card that is one link to a screen. Must sit inside a `PlacardGroup`. After an error it
 * is not a link, because its Try again button must not sit inside an anchor (or navigate away).
 */
export function Placard({
  to,
  tone,
  value,
  label,
  action,
  icon: PlacardIcon,
  state = { status: 'ready' },
}: {
  to: string;
  tone: PlacardTone;
  value: ReactNode;
  label: string;
  action: string;
  icon: ComponentType<{ size?: number }>;
  state?: CardState;
}) {
  const className = `${styles.placard} ${styles[`placard_${tone}`]}`;
  const content = (
    <>
      {state.status === 'ready' ? (
        <span className={styles.placardValue}>{value}</span>
      ) : (
        <CardProblem state={state} label={label} />
      )}
      <span className={styles.placardLabel}>{label}</span>
      <span className={styles.placardFoot}>
        <span className={styles.iconChip} aria-hidden="true">
          <PlacardIcon size={20} />
        </span>
        <span className={styles.placardAction}>
          {action} <span aria-hidden="true">→</span>
        </span>
      </span>
    </>
  );
  return (
    <li className={styles.placardItem}>
      {state.status === 'error' ? (
        <div className={className}>{content}</div>
      ) : (
        <Link to={to} className={className}>
          {content}
        </Link>
      )}
    </li>
  );
}

/** The table side of the second row: a heading, an optional "see all" link, and the content. */
export function DashboardSection({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className={styles.tableSection} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
        {more && (
          <Link to={more.to} className={styles.moreLink}>
            {more.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * The dark card with the role's main call to action; `pill` is the word drawn in an outlined pill.
 * `ai` marks a tutor card: the spark on the pill's corner and in the button.
 */
export function ActionCard({
  id,
  before,
  pill,
  after,
  text,
  to,
  label,
  ai = false,
}: {
  id: string;
  before: string;
  pill: string;
  after?: string;
  text: string;
  to: string;
  label: string;
  ai?: boolean;
}) {
  return (
    <section className={styles.action} aria-labelledby={id}>
      <h2 id={id} className={styles.actionTitle}>
        {before}{' '}
        <span className={styles.actionPill}>
          {pill}
          {ai && <LexlySpark size="0.55em" className={styles.pillSpark} />}
        </span>
        {after ? (/^[?!.,]/.test(after) ? after : ` ${after}`) : ''}
      </h2>
      <p className={styles.actionText}>{text}</p>
      <Link to={to} className={styles.actionButton}>
        {ai && <SparkIcon size={18} />}
        {label}
      </Link>
      <svg className={styles.actionArt} width="170" height="120" viewBox="0 0 170 120" aria-hidden="true">
        <rect x="40" y="20" width="120" height="80" rx="12" transform="rotate(-12 100 60)" />
        <rect x="20" y="34" width="120" height="80" rx="12" transform="rotate(-4 80 74)" />
      </svg>
    </section>
  );
}

/** The black chip that leads a table row (initials or a code). */
export function RowChip({ children }: { children: ReactNode }) {
  return (
    <span className={styles.rowChip} aria-hidden="true">
      {children}
    </span>
  );
}

export interface Segment {
  value: number;
  /** For the legend and the accessible label. */
  label: string;
  tone: 'blue' | 'ink' | 'grey';
}

/** A horizontal bar split into segments, with its meaning in `aria-label` and, optionally, a legend. */
export function SegmentBar({ segments, label, legend = false }: { segments: Segment[]; label: string; legend?: boolean }) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0);
  return (
    <>
      <div role="img" aria-label={label} className={styles.segmentBar}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => (
              <span key={s.label} className={styles[`segment_${s.tone}`]} style={{ flexGrow: s.value }} />
            ))}
      </div>
      {legend && (
        <ul className={styles.legend} aria-hidden="true">
          {segments.map((s) => (
            <li key={s.label}>
              <span className={`${styles.legendSwatch} ${styles[`segment_${s.tone}`]}`} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** A legend for several segment bars that share the same tones (decorative: each bar has its own label). */
export function Legend({ items }: { items: { label: string; tone: Segment['tone'] }[] }) {
  return (
    <ul className={styles.legend} aria-hidden="true">
      {items.map((item) => (
        <li key={item.label}>
          <span className={`${styles.legendSwatch} ${styles[`segment_${item.tone}`]}`} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A small line chart of a series (oldest first); the caller describes it in `label`. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 560;
  const height = 110;
  const max = Math.max(0, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const y = (v: number) => (max > 0 ? height - 6 - (v / max) * (height - 16) : height - 6);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className={styles.sparkline}>
      <path d={`M0 ${height - 1}H${width}`} className={styles.sparkBase} />
      {values.length > 0 && <polyline points={points} className={styles.sparkLine} />}
      {last >= 0 && <circle cx={last * step} cy={y(values[last])} r="5" className={styles.sparkDot} />}
    </svg>
  );
}
