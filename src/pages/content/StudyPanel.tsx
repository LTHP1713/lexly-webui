/**
 * Building blocks of the study panel shared by the section and case law screens: scroll-tracked
 * "On this page" navigation, reading progress, the insight rail and tone-coloured document parts.
 * Layout classes live in StudyPanel.module.css; each page supplies its own tone classes. Hooks and
 * text helpers are in studyPanelModel.ts.
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';
import { textLines, type StudyPart } from './studyPanelModel';
import sp from './StudyPanel.module.css';

/** How far through the document the reader has scrolled, 0–100. */
export function ReadingProgress({ docRef }: { docRef: RefObject<HTMLDivElement | null> }) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    function update() {
      const doc = docRef.current;
      if (!doc) return;
      const rect = doc.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight * 0.6;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const next = atBottom || scrollable <= 0 ? 100 : (-rect.top / scrollable) * 100;
      setPercent(Math.round(Math.max(0, Math.min(100, next))));
    }
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [docRef]);

  return (
    <div>
      <p className={sp.sideHeading}>
        Reading progress <span className={sp.progressValue}>{percent}%</span>
      </p>
      <span className={sp.progressTrack} aria-hidden="true">
        <span className={sp.progressFill} style={{ width: `${percent}%` }} />
      </span>
    </div>
  );
}

// ---------- Navigation ----------

/**
 * Sidebar list from 1024px, sticky chip bar below it. Links scroll in place instead of changing the
 * URL hash: a hash navigation would push a history entry without the router `state`, losing the
 * "Back to …" target.
 */
export function OnThisPage({
  parts,
  active,
  onJump,
  variant,
}: {
  parts: StudyPart[];
  active: string;
  onJump: (id: string) => void;
  variant: 'sidebar' | 'chips';
}) {
  const navRef = useRef<HTMLElement>(null);

  // Keep the active chip visible in the horizontally scrolling bar.
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>('[aria-current="location"]');
    if (variant !== 'chips' || !nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: link.offsetLeft - 16, behavior: 'smooth' });
  }, [active, variant]);

  function handleClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    onJump(id);
  }

  return (
    <nav ref={navRef} aria-label="On this page" className={variant === 'chips' ? sp.chips : sp.toc}>
      {variant === 'sidebar' && <p className={sp.sideHeading}>On this page</p>}
      <ul className={variant === 'chips' ? sp.chipList : sp.tocList}>
        {parts.map((part) => (
          <li key={part.id}>
            <a
              href={`#${part.id}`}
              className={`${variant === 'chips' ? sp.chip : sp.tocLink} ${part.toneClass}`}
              aria-current={active === part.id ? 'location' : undefined}
              onClick={(event) => handleClick(event, part.id)}
            >
              <span className={sp.toneDot} aria-hidden="true" />
              {part.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ---------- Insights (right panel; inline above the text on smaller screens) ----------

export interface InsightCard {
  toneClass: string;
  /** A number, or an icon for parts that aren't counted. */
  count: ReactNode;
  text: string;
  /** The part id the card jumps to. */
  target: string;
}

export function Insights({
  stats,
  cards,
  onJump,
}: {
  stats: [label: string, value: string][];
  cards: InsightCard[];
  onJump: (id: string) => void;
}) {
  return (
    <div>
      {stats.length > 0 && (
        <dl className={sp.stats}>
          {stats.map(([label, value]) => (
            <div key={label} className={sp.statRow}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {cards.length > 0 && (
        <ul className={sp.insightCards}>
          {cards.map((card) => (
            <li key={card.target}>
              <button type="button" className={`${sp.insightCard} ${card.toneClass}`} onClick={() => onJump(card.target)}>
                <span className={sp.insightCount} aria-hidden={typeof card.count !== 'number'}>
                  {card.count}
                </span>
                <span className={sp.insightText}>{card.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Document parts ----------

export function DocPart({
  id,
  title,
  toneClass,
  note,
  children,
}: {
  id: string;
  title: string;
  toneClass: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} tabIndex={-1} className={`${sp.part} ${toneClass}`}>
      <header className={sp.partHeader}>
        <h2 id={headingId} className={sp.partTitle}>
          <span className={sp.toneDot} aria-hidden="true" />
          {title}
        </h2>
        {note && <p className={sp.partNote}>{note}</p>}
      </header>
      {children}
    </section>
  );
}

// ---------- Text rendering ----------

const BULLET_LINE = /^[•\-–*]\s+(.*)$/;
/** "Promisor: the person who…" — a short leading label worth emphasising. */
const LABELLED_LINE = /^([A-Z][A-Za-z /'-]{0,28}):\s+(\S.*)$/;

/** Explanations: newline-separated paragraphs, with consecutive "• …" lines grouped into a list. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ({ kind: 'p'; text: string } | { kind: 'ul'; items: string[] })[] = [];
  for (const line of textLines(text)) {
    const bullet = BULLET_LINE.exec(line);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.kind === 'ul') last.items.push(bullet[1]);
      else blocks.push({ kind: 'ul', items: [bullet[1]] });
    } else {
      blocks.push({ kind: 'p', text: line });
    }
  }

  return (
    <div className={`${sp.richText} ${className ?? ''}`}>
      {blocks.map((block, index) =>
        block.kind === 'ul' ? (
          <ul key={index}>
            {block.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index}>
            <LabelledLine text={block.text} />
          </p>
        ),
      )}
    </div>
  );
}

function LabelledLine({ text }: { text: string }) {
  const match = LABELLED_LINE.exec(text);
  if (!match) return <>{text}</>;
  return (
    <>
      <strong className={sp.inlineLabel}>{match[1]}:</strong> {match[2]}
    </>
  );
}
