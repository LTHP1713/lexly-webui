import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  getSection,
  listSections,
  type KeyLegalTerm,
  type ProvisionMeaning,
  type SectionDetail,
  type SectionException,
  type SectionIllustration,
  type SectionSummary,
} from '@/api/content';
import { LightbulbIcon } from '@/components/icons/Icons';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useRecordLearningActivity } from '@/hooks/useHomeData';
import type { SectionLinkState } from './navigation';
import { DocPart, Insights, OnThisPage, ReadingProgress, RichText, type InsightCard } from './StudyPanel';
import { textLines, usePartNavigation, wordCount, type StudyPart } from './studyPanelModel';
import styles from './Content.module.css';
import s from './SectionDetail.module.css';
import sp from './StudyPanel.module.css';

type BackTo = NonNullable<SectionLinkState['backTo']>;

interface ActRef {
  id: string;
  title: string;
}

/** The act's ordered sections — `undefined` while unknown (no act context, loading or failed). */
type ActSectionsState = { status: 'loading' | 'error' | 'success'; sections: SectionSummary[] | undefined };

interface Neighbours {
  prev: SectionSummary | null;
  next: SectionSummary | null;
  /** 1-based place in the act; null until the act's section list has loaded. */
  position: number | null;
  total: number | null;
}

/** `prev`/`next` come with the section; the act's section list only adds the "n of N" count. */
function neighboursOf(section: SectionDetail, sections: SectionSummary[] | undefined): Neighbours {
  const index = sections?.findIndex((item) => item.id === section.id) ?? -1;
  const place = sections && index >= 0 ? { position: index + 1, total: sections.length } : { position: null, total: null };
  return { prev: section.prev, next: section.next, ...place };
}

function actOf(section: SectionDetail | undefined): ActRef | null {
  return section?.actId ? { id: section.actId, title: section.actTitle ?? 'This Act' } : null;
}

function actPath(act: ActRef) {
  return `/acts/${encodeURIComponent(act.id)}`;
}

export function SectionDetailPage() {
  const { sectionId = '' } = useParams();
  // Optional "Back to …" hint (e.g. search results); the act itself comes from the response.
  const backTo = (useLocation().state as SectionLinkState | null)?.backTo ?? null;
  const query = useApiQuery(`section:${sectionId}`, () => getSection(sectionId));
  // Opening a readable section feeds Continue Learning + Bare Acts Progress (no-op until the API exists).
  useRecordLearningActivity(
    'SECTION',
    query.status === 'success' ? query.data.id : null,
  );

  // Moving to another section keeps this page mounted; start it at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sectionId]);

  // While the next section loads, keep the current one on screen (dimmed) instead of a blank state.
  const shown = query.status === 'success' ? query.data : query.status === 'loading' ? query.staleData : undefined;
  const busy = query.status === 'loading';

  // Loaded once per act (not per section) for the sidebar and the "n of N" count.
  const act = actOf(shown);
  const actQuery = useApiQuery(act ? `act-sections:${act.id}` : null, () => listSections(act?.id ?? ''));
  const actSections: ActSectionsState = {
    status: actQuery.status === 'idle' ? 'error' : actQuery.status,
    sections:
      actQuery.status === 'success' ? actQuery.data : actQuery.status === 'loading' ? actQuery.staleData : undefined,
  };

  return (
    <>
      <SectionBreadcrumb
        act={act}
        current={shown ? (shown.sectionNumber ? `Section ${shown.sectionNumber}` : 'Section') : null}
        backTo={backTo && act && backTo.to === actPath(act) ? null : backTo}
      />

      {busy && !shown && (
        <div className={sp.narrow}>
          <h1 className={styles.title}>Loading section…</h1>
          <LoadingState label="Loading section" lines={5} />
        </div>
      )}
      {query.status === 'error' && (
        <div className={sp.narrow}>
          <h1 className={styles.title}>Section unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </div>
      )}
      {shown && (
        <FullSection
          section={shown}
          act={act}
          actSections={actSections}
          backTo={backTo}
          pager={<SectionPager neighbours={neighboursOf(shown, actSections.sections)} backTo={backTo} />}
          busy={busy}
        />
      )}
    </>
  );
}

/**
 * Bare Acts / {act} / Section n — from the response, so it is the same however the page was
 * opened. A "Back to …" hint from router state (e.g. search results) is added when it points
 * somewhere the trail doesn't already cover.
 */
function SectionBreadcrumb({ act, current, backTo }: { act: ActRef | null; current: string | null; backTo: BackTo | null }) {
  return (
    <nav aria-label="Breadcrumb" className={`${styles.breadcrumb} ${sp.breadcrumb}`}>
      <ol className={sp.crumbs}>
        <li>
          <Link to="/acts">Bare Acts</Link>
        </li>
        {act && (
          <li>
            <Link to={actPath(act)}>{act.title}</Link>
          </li>
        )}
        {current && (
          <li>
            <span aria-current="page">{current}</span>
          </li>
        )}
      </ol>
      {backTo && backTo.to !== '/acts' && (
        <Link to={backTo.to} className={sp.backHint}>
          ← Back to {backTo.label}
        </Link>
      )}
    </nav>
  );
}

// ---------- Full section ----------

type Tone = 'terms' | 'clauses' | 'illustrations' | 'exceptions' | 'simple' | 'plain';

const TONE_CLASS: Record<Tone, string> = {
  terms: s.toneTerms,
  clauses: s.toneClauses,
  illustrations: s.toneIllustrations,
  exceptions: s.toneExceptions,
  simple: s.toneSimple,
  plain: s.tonePlain,
};

const CLAUSE_LINE = /^\(([a-z0-9]{1,6})\)\s*(.*)$/i;

function readingMinutes(section: SectionDetail): number {
  const text = [
    section.bodyText,
    section.inSimpleWords ?? '',
    ...section.provisionMeaning.map((m) => `${m.title} ${m.explanation}`),
    ...section.illustrations.map((i) => i.text),
    ...section.exceptions.flatMap((e) => [e.title, e.explanation, ...e.illustrations.map((i) => i.text)]),
    ...section.keyLegalTerms.map((t) => `${t.term} ${t.definition}`),
  ].join(' ');
  return Math.max(1, Math.round(wordCount(text) / 200));
}

/** Router state for links to another section: carries the "Back to …" hint along, if any. */
function linkState(backTo: BackTo | null): SectionLinkState | undefined {
  return backTo ? { backTo } : undefined;
}

function FullSection({
  section,
  act,
  actSections,
  backTo,
  pager,
  busy,
}: {
  section: SectionDetail;
  act: ActRef | null;
  actSections: ActSectionsState;
  backTo: BackTo | null;
  pager: ReactNode;
  busy: boolean;
}) {
  const number = section.sectionNumber ? `Section ${section.sectionNumber}` : 'Section';
  const hasTerms = section.keyLegalTerms.length > 0 && section.bodyText.trim() !== '';
  const [mode, setMode] = useState<'read' | 'study'>('study');
  const docRef = useRef<HTMLDivElement>(null);

  const part = (id: string, label: string, tone: Tone): StudyPart => ({ id, label, toneClass: TONE_CLASS[tone] });
  const parts: StudyPart[] = [
    section.bodyText.trim() && part('bare-text', 'Bare Act text', 'plain'),
    section.inSimpleWords && part('simple-words', 'In simple words', 'simple'),
    section.provisionMeaning.length > 0 && part('clause-meaning', 'Clause by clause', 'clauses'),
    section.illustrations.length > 0 && part('illustrations', 'Illustrations', 'illustrations'),
    section.exceptions.length > 0 && part('exceptions', 'Exceptions', 'exceptions'),
    section.keyLegalTerms.length > 0 && part('key-terms', 'Key legal terms', 'terms'),
  ].filter((item): item is StudyPart => Boolean(item));

  const { active, jump } = usePartNavigation(parts);

  const insights = (
    <SectionInsights
      section={section}
      words={wordCount(section.bodyText)}
      minutes={readingMinutes(section)}
      clauseCount={section.bodyText.split('\n').filter((line) => CLAUSE_LINE.test(line.trim())).length}
      onJump={jump}
    />
  );

  return (
    <article className={`${sp.panel} ${busy ? sp.busy : ''}`} aria-busy={busy}>
      <aside className={sp.left} aria-label="Section navigation">
        <div className={sp.sideSticky}>
          <ReadingProgress docRef={docRef} />
          {parts.length >= 2 && <OnThisPage parts={parts} active={active} onJump={jump} variant="sidebar" />}
          {act && <ActSections act={act} state={actSections} currentId={section.id} backTo={backTo} />}
        </div>
      </aside>

      <div ref={docRef} className={sp.doc}>
        <div className={sp.docTop}>
          <p className={sp.docMeta}>
            {act ? `${act.title} · ${number}` : number}
          </p>
          {hasTerms && <ModeToggle mode={mode} onChange={setMode} />}
        </div>
        <h1 className={sp.title}>{section.title ?? number}</h1>

        <div className={sp.inlineInsights}>{insights}</div>

        {parts.length >= 2 && <OnThisPage parts={parts} active={active} onJump={jump} variant="chips" />}

        {section.bodyText.trim() && (
          <DocPart id="bare-text" title="Bare Act text" toneClass={TONE_CLASS.plain} note="The section as enacted">
            <BareText text={section.bodyText} terms={mode === 'study' ? section.keyLegalTerms : []} />
          </DocPart>
        )}

        {section.inSimpleWords && (
          <DocPart id="simple-words" title="In simple words" toneClass={TONE_CLASS.simple}>
            <div className={sp.callout}>
              <LightbulbIcon size={20} className={sp.calloutIcon} />
              <RichText text={section.inSimpleWords} />
            </div>
          </DocPart>
        )}

        {section.provisionMeaning.length > 0 && (
          <DocPart
            id="clause-meaning"
            title="Clause by clause"
            toneClass={TONE_CLASS.clauses}
            note="What each part of the section means"
          >
            <ClauseList clauses={section.provisionMeaning} />
          </DocPart>
        )}

        {section.illustrations.length > 0 && (
          <DocPart
            id="illustrations"
            title="Illustrations"
            toneClass={TONE_CLASS.illustrations}
            note="The section applied to facts"
          >
            <IllustrationList illustrations={section.illustrations} />
          </DocPart>
        )}

        {section.exceptions.length > 0 && (
          <DocPart
            id="exceptions"
            title="Exceptions"
            toneClass={TONE_CLASS.exceptions}
            note="Where the general rule gives way"
          >
            <ExceptionList exceptions={section.exceptions} />
          </DocPart>
        )}

        {section.keyLegalTerms.length > 0 && (
          <DocPart id="key-terms" title="Key legal terms" toneClass={TONE_CLASS.terms} note="Words to know for this section">
            <TermList terms={section.keyLegalTerms} />
          </DocPart>
        )}

        {pager}
      </div>

      <aside className={sp.right} aria-label="Section insights">
        <div className={sp.sideSticky}>{insights}</div>
      </aside>
    </article>
  );
}

// ---------- Navigation ----------

/** Every section of this one's act, current one marked — like a folder tree. */
function ActSections({
  act,
  state,
  currentId,
  backTo,
}: {
  act: ActRef;
  state: ActSectionsState;
  currentId: string;
  backTo: BackTo | null;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const sections = state.sections;

  // Bring the current section into view inside the sidebar (never scrolls the page).
  useEffect(() => {
    const list = listRef.current;
    const scroller = list?.closest<HTMLElement>(`.${sp.sideSticky}`);
    const current = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !current) return;
    const offset = current.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (offset < 0 || offset > scroller.clientHeight - 40) {
      scroller.scrollTop += offset - scroller.clientHeight / 3;
    }
  }, [sections, currentId]);

  return (
    <div className={s.actBlock}>
      <p className={sp.sideHeading}>In this Act</p>
      <p className={s.actTitle}>
        <Link to={actPath(act)} className={s.actTitleLink}>
          {act.title}
        </Link>
      </p>
      {!sections && state.status === 'loading' && <p className={sp.sideNote}>Loading sections…</p>}
      {!sections && state.status === 'error' && <p className={sp.sideNote}>Couldn’t load the other sections.</p>}
      {sections && (
        <ul ref={listRef} className={s.actList}>
          {sections.map((item) => (
            <li key={item.id}>
              <Link
                to={`/sections/${encodeURIComponent(item.id)}`}
                state={linkState(backTo)}
                className={s.actLink}
                aria-current={item.id === currentId ? 'page' : undefined}
              >
                <span className={s.actNumber}>§ {item.sectionNumber}</span>
                <span className={s.actName}>{item.title ?? `Section ${item.sectionNumber}`}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Previous / Next in the act's natural section order, from the section response. */
function SectionPager({ neighbours, backTo }: { neighbours: Neighbours; backTo: BackTo | null }) {
  if (!neighbours.prev && !neighbours.next) return null;
  const { prev, next, position, total } = neighbours;

  return (
    <nav aria-label="Previous and next sections" className={s.pager}>
      {/* A count, not a section number: inserted sections such as "19A" shift the two apart. */}
      {position !== null && (
        <p className={s.pagerPosition}>
          {position} of {total} sections in this Act
        </p>
      )}
      <div className={s.pagerLinks}>
        {prev ? <PagerLink item={prev} direction="prev" backTo={backTo} /> : <span aria-hidden="true" />}
        {next ? <PagerLink item={next} direction="next" backTo={backTo} /> : <span aria-hidden="true" />}
      </div>
    </nav>
  );
}

function PagerLink({
  item,
  direction,
  backTo,
}: {
  item: SectionSummary;
  direction: 'prev' | 'next';
  backTo: BackTo | null;
}) {
  return (
    <Link
      to={`/sections/${encodeURIComponent(item.id)}`}
      state={linkState(backTo)}
      rel={direction}
      className={`${s.pagerLink} ${direction === 'next' ? s.pagerNext : ''}`}
    >
      <span className={s.pagerDirection}>{direction === 'prev' ? '← Previous section' : 'Next section →'}</span>
      <span className={s.pagerTitle}>
        <span className={s.pagerNumber}>§ {item.sectionNumber}</span>
        <span className={s.pagerName}>{item.title ?? `Section ${item.sectionNumber}`}</span>
      </span>
    </Link>
  );
}

function ModeToggle({ mode, onChange }: { mode: 'read' | 'study'; onChange: (mode: 'read' | 'study') => void }) {
  return (
    <div className={s.modeToggle} role="group" aria-label="Reading mode">
      <button type="button" aria-pressed={mode === 'read'} onClick={() => onChange('read')}>
        Read
      </button>
      <button
        type="button"
        aria-pressed={mode === 'study'}
        onClick={() => onChange('study')}
        title="Highlights key legal terms in the Act text"
      >
        Study
      </button>
    </div>
  );
}

// ---------- Insights (right panel; inline above the text on smaller screens) ----------

function SectionInsights({
  section,
  words,
  minutes,
  clauseCount,
  onJump,
}: {
  section: SectionDetail;
  words: number;
  minutes: number;
  clauseCount: number;
  onJump: (id: string) => void;
}) {
  const stats: [string, string][] = [
    ['Reading time', `${minutes} min`],
    ['Words in the Act', `${words} w`],
    ...(clauseCount > 0 ? ([['Clauses', String(clauseCount)]] as [string, string][]) : []),
  ];

  const n = (count: number, one: string, many: string) => (count === 1 ? one : many);
  const terms = section.keyLegalTerms.length;
  const clauses = section.provisionMeaning.length;
  const illustrations = section.illustrations.length;
  const exceptions = section.exceptions.length;
  const cards: InsightCard[] = [];
  if (terms > 0) {
    cards.push({
      toneClass: TONE_CLASS.terms,
      count: terms,
      text: `Key ${n(terms, 'term', 'terms')}. Highlighted in Study mode; hover or tap one for its meaning.`,
      target: 'key-terms',
    });
  }
  if (clauses > 0) {
    cards.push({
      toneClass: TONE_CLASS.clauses,
      count: clauses,
      text: `${n(clauses, 'Clause', 'Clauses')} explained in plain words.`,
      target: 'clause-meaning',
    });
  }
  if (illustrations > 0) {
    cards.push({
      toneClass: TONE_CLASS.illustrations,
      count: illustrations,
      text: `${n(illustrations, 'Illustration', 'Illustrations')} applying the section to facts.`,
      target: 'illustrations',
    });
  }
  if (exceptions > 0) {
    cards.push({
      toneClass: TONE_CLASS.exceptions,
      count: exceptions,
      text: `${n(exceptions, 'Exception', 'Exceptions')} where the general rule gives way.`,
      target: 'exceptions',
    });
  }
  if (section.inSimpleWords) {
    cards.push({
      toneClass: TONE_CLASS.simple,
      count: <LightbulbIcon size={16} />,
      text: 'The whole section summed up in simple words.',
      target: 'simple-words',
    });
  }

  return <Insights stats={stats} cards={cards} onJump={onJump} />;
}

// ---------- Key-term highlighting ----------

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "Signify" also matches "signifies"; "Promise" matches "promises"; multi-word terms match as phrases. */
function variantPattern(variant: string) {
  const words = variant.trim().split(/\s+/).map(escapeRegExp);
  const last = words.pop() ?? '';
  const lastPattern = /y$/i.test(last) ? `${last.slice(0, -1)}(?:y|ies|ied|ying)` : `${last}(?:s|es|d|ed|ing)?`;
  return [...words, lastPattern].join('\\s+');
}

function buildTermMatcher(terms: KeyLegalTerm[]) {
  const entries = terms
    .flatMap((term) =>
      term.term
        .split('/')
        .map((variant) => variant.trim())
        .filter((variant) => variant.length > 2)
        .map((variant) => ({ term, pattern: variantPattern(variant) })),
    )
    // Longest first, so "Promisee" wins over "Promise" and "Voidable" over "Void".
    .sort((a, b) => b.pattern.length - a.pattern.length);
  if (entries.length === 0) return null;
  const regex = new RegExp(`\\b(?:${entries.map((entry) => `(${entry.pattern})`).join('|')})\\b`, 'gi');
  return { regex, entries };
}

/** Wraps the first mention of each key term in the text (tracked in `seen`); later mentions stay plain to keep it calm. */
function highlightTerms(text: string, matcher: ReturnType<typeof buildTermMatcher>, seen: Set<KeyLegalTerm>): ReactNode {
  if (!matcher) return text;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(matcher.regex)) {
    const entryIndex = match.slice(1).findIndex((group) => group !== undefined);
    const term = matcher.entries[entryIndex]?.term;
    if (!term || seen.has(term) || match.index === undefined) continue;
    seen.add(term);
    nodes.push(text.slice(cursor, match.index));
    nodes.push(
      <TermMark key={match.index} term={term}>
        {match[0]}
      </TermMark>,
    );
    cursor = match.index + match[0].length;
  }
  nodes.push(text.slice(cursor));
  return nodes;
}

/** A highlighted term with its definition in a popover (hover, focus or tap; Escape closes it). */
function TermMark({ term, children }: { term: KeyLegalTerm; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const tipRef = useRef<HTMLSpanElement>(null);

  // Keep the popover inside the viewport: shift it sideways on narrow screens, and open it upwards
  // when there's no room below (the mobile tab bar covers the bottom ~4rem).
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || !tip) return;
    tip.style.setProperty('--shift', '0px');
    delete tip.dataset.place;
    if (tip.getBoundingClientRect().bottom > window.innerHeight - 72) tip.dataset.place = 'top';
    const rect = tip.getBoundingClientRect();
    const margin = 12;
    let shift = 0;
    if (rect.right > window.innerWidth - margin) shift = window.innerWidth - margin - rect.right;
    if (rect.left + shift < margin) shift = margin - rect.left;
    tip.style.setProperty('--shift', `${shift}px`);
  }, [open]);

  return (
    <span className={s.termWrap} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {/* A focusable <mark>, not a <button>: buttons render inline-block, which makes the
          highlight as tall as the line and stops it wrapping with neighbouring punctuation. */}
      <mark
        tabIndex={0}
        className={`${s.termMark} ${open ? s.termMarkOpen : ''}`}
        aria-describedby={tipId}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {children}
      </mark>
      <span ref={tipRef} id={tipId} role="tooltip" className={s.termTip} hidden={!open}>
        <span className={s.termTipTitle}>{term.term}</span>
        {term.definition}
      </span>
    </span>
  );
}

// ---------- Text rendering ----------

/** Statute text: clause lines such as "(a) When one person…" get a hanging clause label. */
function BareText({ text, terms }: { text: string; terms: KeyLegalTerm[] }) {
  const matcher = terms.length > 0 ? buildTermMatcher(terms) : null;
  const seen = new Set<KeyLegalTerm>();
  return (
    <div className={s.bareText}>
      {textLines(text).map((line, index) => {
        const clause = CLAUSE_LINE.exec(line);
        return clause ? (
          <p key={index} className={s.bareClause}>
            <span className={s.bareClauseLabel}>({clause[1]})</span>
            <span>{highlightTerms(clause[2], matcher, seen)}</span>
          </p>
        ) : (
          <p key={index}>{highlightTerms(line, matcher, seen)}</p>
        );
      })}
    </div>
  );
}

// ---------- Study content blocks ----------

function ClauseList({ clauses }: { clauses: ProvisionMeaning[] }) {
  return (
    <ol className={s.clauseList}>
      {clauses.map((clause, index) => (
        <li key={`${clause.clause}-${index}`} className={s.clause}>
          {clause.clause && <span className={s.clauseTag}>{clause.clause}</span>}
          <div className={s.clauseBody}>
            <h3 className={sp.itemTitle}>{clause.title}</h3>
            <RichText text={clause.explanation} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function IllustrationList({ illustrations, nested }: { illustrations: SectionIllustration[]; nested?: boolean }) {
  return (
    <ol className={`${s.illustrationList} ${nested ? s.illustrationListNested : ''}`}>
      {illustrations.map((illustration, index) => (
        <li key={index} className={s.illustration}>
          <p className={s.illustrationMeta}>
            <span className={s.illustrationLabel}>
              Illustration{illustrations.length > 1 ? ` ${index + 1}` : ''}
            </span>
            <SourceTag hypothetical={illustration.hypothetical} />
          </p>
          <RichText text={illustration.text} className={nested ? s.nestedText : undefined} />
        </li>
      ))}
    </ol>
  );
}

/** Students must be able to tell the Act's own illustrations from Lexly's teaching examples. */
function SourceTag({ hypothetical }: { hypothetical: boolean }) {
  return hypothetical ? (
    <span className={s.tag} title="Written by Lexly to explain the section; not part of the Act">
      Hypothetical
    </span>
  ) : (
    <span className={`${s.tag} ${s.tagAct}`} title="Printed in the Act">
      From the Act
    </span>
  );
}

function ExceptionList({ exceptions }: { exceptions: SectionException[] }) {
  return (
    <ol className={s.exceptionList}>
      {exceptions.map((exception, index) => (
        <li key={index} className={s.exception}>
          <h3 className={sp.itemTitle}>
            {exceptions.length > 1 && <span className={s.exceptionNumber}>{index + 1}.</span>}
            {exception.title}
          </h3>
          <RichText text={exception.explanation} />
          {exception.illustrations.length > 0 && <IllustrationList illustrations={exception.illustrations} nested />}
        </li>
      ))}
    </ol>
  );
}

function TermList({ terms }: { terms: KeyLegalTerm[] }) {
  return (
    <dl className={s.termList}>
      {terms.map((term, index) => (
        <div key={`${term.term}-${index}`} className={s.term}>
          <dt>{term.term}</dt>
          <dd>{term.definition}</dd>
        </div>
      ))}
    </dl>
  );
}
