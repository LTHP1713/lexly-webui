import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { getCaseLaw, type CaseIssue, type CaseLawDetail } from '@/api/caselaws';
import { ArrowRightIcon, ScalesIcon } from '@/components/icons/Icons';
import { ErrorState, LoadingState } from '@/components/QueryStates';
import { useApiQuery } from '@/hooks/useApiQuery';
import { useRecordLearningActivity } from '@/hooks/useHomeData';
import { caseTypeLabel, outcomeLabel, partyLabel } from './caseLawLabels';
import { ImportanceBadge } from './ImportanceBadge';
import type { SectionLinkState } from './navigation';
import { DocPart, Insights, OnThisPage, ReadingProgress, RichText, type InsightCard } from './StudyPanel';
import { usePartNavigation, wordCount, type StudyPart } from './studyPanelModel';
import styles from './Content.module.css';
import cl from './CaseLawDetail.module.css';
import sp from './StudyPanel.module.css';

type BackTo = NonNullable<SectionLinkState['backTo']>;

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

function formatDecidedOn(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function decidedYear(value: string | null): string | null {
  return value && /^\d{4}/.test(value) ? value.slice(0, 4) : null;
}

/** Only http(s) links are rendered — never `javascript:` or other schemes from data. */
function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/** From this many issues on, each issue collapses (the first one starts open). */
const COLLAPSIBLE_ISSUES_FROM = 3;

/** Where "Case Laws" in the trail goes: back to the filtered list the reader came from, if any. */
function isCaseLawList(to: string) {
  return to === '/caselaws' || to.startsWith('/caselaws?');
}

export function CaseLawDetailPage() {
  const { caseLawId = '' } = useParams();
  const backTo = (useLocation().state as SectionLinkState | null)?.backTo ?? null;
  const query = useApiQuery(`caselaw:${caseLawId}`, () => getCaseLaw(caseLawId));
  useRecordLearningActivity(
    'CASE_LAW',
    query.status === 'success' ? query.data.id : null,
  );

  // Moving to another case (e.g. from a section and back) keeps this page mounted; start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [caseLawId]);

  return (
    <>
      <CaseBreadcrumb current={query.status === 'success' ? query.data.citation || 'Case' : null} backTo={backTo} />

      {query.status === 'loading' && (
        <div className={sp.narrow}>
          <h1 className={styles.title}>Loading case law…</h1>
          <LoadingState label="Loading case law" lines={5} />
        </div>
      )}
      {query.status === 'error' && (
        <div className={sp.narrow}>
          <h1 className={styles.title}>Case law unavailable</h1>
          <ErrorState error={query.error} onRetry={query.retry} />
        </div>
      )}
      {query.status === 'success' && <FullCaseLaw caseLaw={query.data} />}
    </>
  );
}

/**
 * Case Laws / {citation}. "Case Laws" returns to the list the reader came from (with its filters);
 * any other origin (a section, search results) gets a "Back to …" hint as well.
 */
function CaseBreadcrumb({ current, backTo }: { current: string | null; backTo: BackTo | null }) {
  const listTo = backTo && isCaseLawList(backTo.to) ? backTo.to : '/caselaws';
  return (
    <nav aria-label="Breadcrumb" className={`${styles.breadcrumb} ${sp.breadcrumb}`}>
      <ol className={sp.crumbs}>
        <li>
          <Link to={listTo}>Case Laws</Link>
        </li>
        {current && (
          <li>
            <span aria-current="page">{current}</span>
          </li>
        )}
      </ol>
      {backTo && !isCaseLawList(backTo.to) && (
        <Link to={backTo.to} className={sp.backHint}>
          ← Back to {backTo.label}
        </Link>
      )}
    </nav>
  );
}

// ---------- Full case ----------

type Tone = 'background' | 'issues' | 'arguments' | 'holding' | 'ratio' | 'obiter' | 'provisions' | 'principles' | 'sections';

const TONE_CLASS: Record<Tone, string> = {
  background: cl.toneBackground,
  issues: cl.toneIssues,
  arguments: cl.toneArguments,
  holding: cl.toneHolding,
  ratio: cl.toneRatio,
  obiter: cl.toneObiter,
  provisions: cl.toneProvisions,
  principles: cl.tonePrinciples,
  sections: cl.toneSections,
};

function readingMinutes(caseLaw: CaseLawDetail): number {
  const text = [
    caseLaw.onlineSummary ?? '',
    caseLaw.background ?? '',
    ...caseLaw.issues.flatMap((issue) => [issue.question, issue.reasoning ?? '', issue.finding ?? '']),
    ...Object.values(caseLaw.arguments).flat(),
    caseLaw.finalHolding?.summary ?? '',
    ...caseLaw.ratioDecidendi,
    ...caseLaw.obiterDicta,
    ...caseLaw.importantProvisions.map((p) => `${p.law} ${p.provision} ${p.relevance ?? ''}`),
    ...caseLaw.legalPrinciples.map((p) => `${p.title} ${p.explanation}`),
  ].join(' ');
  return Math.max(1, Math.round(wordCount(text) / 200));
}

function FullCaseLaw({ caseLaw }: { caseLaw: CaseLawDetail }) {
  const docRef = useRef<HTMLDivElement>(null);
  const pdfUrl = safeExternalUrl(caseLaw.sourcePdfUrl);
  const argumentGroups = Object.entries(caseLaw.arguments);
  const sectionBackTo: BackTo = { to: `/caselaws/${caseLaw.id}`, label: 'case law' };

  const part = (id: string, label: string, tone: Tone): StudyPart => ({ id, label, toneClass: TONE_CLASS[tone] });
  const parts: StudyPart[] = [
    caseLaw.background && part('background', 'Background', 'background'),
    caseLaw.issues.length > 0 && part('issues', 'Issues', 'issues'),
    argumentGroups.length > 0 && part('arguments', 'Arguments', 'arguments'),
    caseLaw.finalHolding && part('holding', 'Final Holding', 'holding'),
    caseLaw.ratioDecidendi.length > 0 && part('ratio', 'Ratio Decidendi', 'ratio'),
    caseLaw.obiterDicta.length > 0 && part('obiter', 'Obiter Dicta', 'obiter'),
    caseLaw.importantProvisions.length > 0 && part('provisions', 'Important Provisions', 'provisions'),
    caseLaw.legalPrinciples.length > 0 && part('principles', 'Legal Principles', 'principles'),
    caseLaw.relatedSections.length > 0 && part('related-sections', 'Related Sections', 'sections'),
  ].filter((item): item is StudyPart => Boolean(item));

  const { active, jump } = usePartNavigation(parts);
  const insights = <CaseInsights caseLaw={caseLaw} onJump={jump} />;
  const kind = caseLaw.caseType ? caseTypeLabel(caseLaw.caseType) : 'Case law';
  const year = decidedYear(caseLaw.decidedOn);

  return (
    <article className={sp.panel}>
      <aside className={sp.left} aria-label="Case navigation">
        <div className={sp.sideSticky}>
          <ReadingProgress docRef={docRef} />
          {parts.length >= 2 && <OnThisPage parts={parts} active={active} onJump={jump} variant="sidebar" />}
          {caseLaw.relatedSections.length > 0 && (
            <div className={cl.sideBlock}>
              <p className={sp.sideHeading}>Sections interpreted</p>
              <ul className={cl.sideList}>
                {caseLaw.relatedSections.map((section) => (
                  <li key={section.id}>
                    <Link
                      to={`/sections/${encodeURIComponent(section.id)}`}
                      state={{ backTo: sectionBackTo } satisfies SectionLinkState}
                      className={cl.sideLink}
                    >
                      <span className={cl.sideNumber}>§ {section.sectionNumber}</span>
                      <span className={cl.sideName}>{section.title ?? `Section ${section.sectionNumber}`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </aside>

      <div ref={docRef} className={sp.doc}>
        <div className={sp.docTop}>
          <p className={sp.docMeta}>
            {year ? `${kind} · ${year}` : kind}
            <ImportanceBadge importance={caseLaw.importance} />
          </p>
        </div>
        <h1 className={sp.title}>{caseLaw.title}</h1>
        {caseLaw.onlineSummary && <p className={cl.lede}>{caseLaw.onlineSummary}</p>}

        <CaseFacts
          rows={[
            ['Citation', caseLaw.citation],
            ['Court', caseLaw.court],
            ['Decided', formatDecidedOn(caseLaw.decidedOn)],
            ['Case number', caseLaw.caseNumber],
            ['Bench', caseLaw.bench],
            ['Judges', caseLaw.judges],
            ['Jurisdiction', caseLaw.jurisdiction],
            ['Case type', caseLaw.caseType && caseTypeLabel(caseLaw.caseType)],
          ]}
        />

        <div className={sp.inlineInsights}>{insights}</div>

        {parts.length >= 2 && <OnThisPage parts={parts} active={active} onJump={jump} variant="chips" />}

        {parts.length === 0 && <p className={cl.empty}>A detailed analysis of this case isn't available yet.</p>}

        {caseLaw.background && (
          <DocPart id="background" title="Background" toneClass={TONE_CLASS.background} note="What led to the case">
            <RichText text={caseLaw.background} />
          </DocPart>
        )}

        {caseLaw.issues.length > 0 && (
          <DocPart id="issues" title="Issues" toneClass={TONE_CLASS.issues} note="The questions the court had to answer">
            <Issues issues={caseLaw.issues} />
          </DocPart>
        )}

        {argumentGroups.length > 0 && (
          <DocPart id="arguments" title="Arguments" toneClass={TONE_CLASS.arguments} note="What each side argued">
            {/* Groups stay in the order the keys arrive — the backend already sorts them for display. */}
            <div className={cl.parties}>
              {argumentGroups.map(([party, list]) => (
                <section key={party} className={cl.party} aria-label={`${partyLabel(party)} arguments`}>
                  <h3 className={cl.partyName}>{partyLabel(party)}</h3>
                  <ol className={cl.argumentList}>
                    {list.map((argument, index) => (
                      <li key={index}>{argument}</li>
                    ))}
                  </ol>
                </section>
              ))}
            </div>
          </DocPart>
        )}

        {caseLaw.finalHolding && (
          <DocPart id="holding" title="Final Holding" toneClass={TONE_CLASS.holding} note="What the court decided">
            <div className={sp.callout}>
              <ScalesIcon size={20} className={sp.calloutIcon} />
              <div className={cl.holdingBody}>
                {caseLaw.finalHolding.outcome && (
                  <p className={cl.outcome}>
                    <span className={cl.outcomeLabel}>Outcome</span>
                    <span className={cl.outcomeBadge}>{outcomeLabel(caseLaw.finalHolding.outcome)}</span>
                  </p>
                )}
                {caseLaw.finalHolding.summary && <RichText text={caseLaw.finalHolding.summary} />}
              </div>
            </div>
          </DocPart>
        )}

        {caseLaw.ratioDecidendi.length > 0 && (
          <DocPart
            id="ratio"
            title="Ratio Decidendi"
            toneClass={TONE_CLASS.ratio}
            note={
              <>
                <span className={`${cl.tag} ${cl.tagBinding}`}>Binding</span> The reasoning the decision rests on. It
                binds lower courts.
              </>
            }
          >
            <Propositions items={caseLaw.ratioDecidendi} variant="ratio" />
          </DocPart>
        )}

        {caseLaw.obiterDicta.length > 0 && (
          <DocPart
            id="obiter"
            title="Obiter Dicta"
            toneClass={TONE_CLASS.obiter}
            note={
              <>
                <span className={`${cl.tag} ${cl.tagPersuasive}`}>Not binding</span> Remarks made in passing. They can
                persuade later courts but do not bind them.
              </>
            }
          >
            <Propositions items={caseLaw.obiterDicta} variant="obiter" />
          </DocPart>
        )}

        {caseLaw.importantProvisions.length > 0 && (
          <DocPart
            id="provisions"
            title="Important Provisions"
            toneClass={TONE_CLASS.provisions}
            note="The law the judgment turns on"
          >
            <ul className={cl.provisions}>
              {caseLaw.importantProvisions.map((provision, index) => (
                <li key={index} className={cl.provision}>
                  <p className={cl.provisionHead}>
                    <span className={cl.provisionTag}>{provision.provision}</span>
                    <span className={cl.provisionLaw}>{provision.law}</span>
                  </p>
                  {provision.relevance && <p className={cl.provisionRelevance}>{provision.relevance}</p>}
                </li>
              ))}
            </ul>
          </DocPart>
        )}

        {caseLaw.legalPrinciples.length > 0 && (
          <DocPart
            id="principles"
            title="Legal Principles"
            toneClass={TONE_CLASS.principles}
            note="Principles to take away from the case"
          >
            <dl className={cl.principles}>
              {caseLaw.legalPrinciples.map((principle, index) => (
                <div key={index} className={cl.principle}>
                  <dt>{principle.title}</dt>
                  <dd>{principle.explanation}</dd>
                </div>
              ))}
            </dl>
          </DocPart>
        )}

        {caseLaw.relatedSections.length > 0 && (
          <DocPart
            id="related-sections"
            title="Related Sections"
            toneClass={TONE_CLASS.sections}
            note="Bare Act sections this case interprets"
          >
            <ul className={cl.sectionLinks}>
              {caseLaw.relatedSections.map((section) => (
                <li key={section.id}>
                  <Link
                    to={`/sections/${encodeURIComponent(section.id)}`}
                    state={{ backTo: sectionBackTo } satisfies SectionLinkState}
                    className={cl.sectionLink}
                  >
                    <span className={cl.sectionNumber}>§ {section.sectionNumber}</span>
                    <span className={cl.sectionName}>{section.title ?? `Section ${section.sectionNumber}`}</span>
                    <ArrowRightIcon size={16} className={cl.sectionArrow} />
                  </Link>
                </li>
              ))}
            </ul>
          </DocPart>
        )}

        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className={cl.judgmentLink}>
            <span className={cl.judgmentLabel}>Source</span>
            <span className={cl.judgmentTitle}>Read the full judgment (opens in a new tab)</span>
          </a>
        )}
      </div>

      <aside className={sp.right} aria-label="Case insights">
        <div className={sp.sideSticky}>{insights}</div>
      </aside>
    </article>
  );
}

/** Case metadata as a <dl>; rows with a null/blank value are skipped (never "null" or an empty row). */
function CaseFacts({ rows }: { rows: [label: string, value: string | null | undefined][] }) {
  const present = rows.filter((row): row is [string, string] => Boolean(row[1]?.trim()));
  if (present.length === 0) return null;
  return (
    <dl className={cl.facts}>
      {present.map(([label, value]) => (
        <div key={label} className={cl.fact}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- Insights ----------

function CaseInsights({ caseLaw, onJump }: { caseLaw: CaseLawDetail; onJump: (id: string) => void }) {
  const n = (count: number, one: string, many: string) => (count === 1 ? one : many);
  const decided = formatDecidedOn(caseLaw.decidedOn);
  const stats: [string, string][] = [
    ['Reading time', `${readingMinutes(caseLaw)} min`],
    ...(decided ? ([['Decided', decided]] as [string, string][]) : []),
    ...(caseLaw.issues.length > 0 ? ([['Issues', String(caseLaw.issues.length)]] as [string, string][]) : []),
  ];

  const parties = Object.keys(caseLaw.arguments).map(partyLabel);
  const argumentCount = Object.values(caseLaw.arguments).flat().length;
  const cards: InsightCard[] = [];
  const add = (tone: Tone, count: ReactNode, text: string, target: string) =>
    cards.push({ toneClass: TONE_CLASS[tone], count, text, target });

  if (caseLaw.issues.length > 0) {
    add('issues', caseLaw.issues.length, `${n(caseLaw.issues.length, 'Issue', 'Issues')} the court answered, with its reasoning.`, 'issues');
  }
  if (argumentCount > 0) {
    add('arguments', argumentCount, `${n(argumentCount, 'Argument', 'Arguments')} from ${listJoin(parties)}.`, 'arguments');
  }
  if (caseLaw.finalHolding) {
    add('holding', <ScalesIcon size={16} />, 'The outcome and what the court ordered.', 'holding');
  }
  if (caseLaw.ratioDecidendi.length > 0) {
    add('ratio', caseLaw.ratioDecidendi.length, `Binding ${n(caseLaw.ratioDecidendi.length, 'proposition', 'propositions')}: the ratio decidendi.`, 'ratio');
  }
  if (caseLaw.obiterDicta.length > 0) {
    add('obiter', caseLaw.obiterDicta.length, `${n(caseLaw.obiterDicta.length, 'Remark', 'Remarks')} made in passing (obiter, not binding).`, 'obiter');
  }
  if (caseLaw.importantProvisions.length > 0) {
    add('provisions', caseLaw.importantProvisions.length, `${n(caseLaw.importantProvisions.length, 'Provision', 'Provisions')} of law the judgment turns on.`, 'provisions');
  }
  if (caseLaw.legalPrinciples.length > 0) {
    add('principles', caseLaw.legalPrinciples.length, `Legal ${n(caseLaw.legalPrinciples.length, 'principle', 'principles')} to take away.`, 'principles');
  }

  return <Insights stats={stats} cards={cards} onJump={onJump} />;
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ---------- Content blocks ----------

function Issues({ issues }: { issues: CaseIssue[] }) {
  const collapsible = issues.length >= COLLAPSIBLE_ISSUES_FROM;
  return (
    <ol className={cl.issues}>
      {issues.map((issue, index) => {
        const heading = (
          <>
            <span className={cl.issueLabel}>Issue {index + 1}</span>
            <span className={cl.issueQuestion}>{issue.question}</span>
          </>
        );
        return (
          <li key={issue.issueNumber} className={cl.issue}>
            {collapsible ? (
              <details open={index === 0} className={cl.issueDetails}>
                <summary className={cl.issueHead}>{heading}</summary>
                <IssueBody issue={issue} />
              </details>
            ) : (
              <>
                <h3 className={cl.issueHead}>{heading}</h3>
                <IssueBody issue={issue} />
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function IssueBody({ issue }: { issue: CaseIssue }) {
  if (!issue.reasoning && !issue.finding) return null;
  return (
    <dl className={cl.issueBody}>
      {issue.reasoning && (
        <div>
          <dt className={cl.issueTerm}>Reasoning</dt>
          <dd>
            <RichText text={issue.reasoning} />
          </dd>
        </div>
      )}
      {issue.finding && (
        <div className={cl.finding}>
          <dt className={cl.issueTerm}>Finding</dt>
          <dd>
            <RichText text={issue.finding} />
          </dd>
        </div>
      )}
    </dl>
  );
}

/** Ratio (binding, solid) and obiter (persuasive, dashed + italic) as numbered propositions. */
function Propositions({ items, variant }: { items: string[]; variant: 'ratio' | 'obiter' }) {
  return (
    <ol className={`${cl.propositions} ${variant === 'ratio' ? cl.ratio : cl.obiter}`}>
      {items.map((item, index) => (
        <li key={index} className={cl.proposition}>
          <span className={cl.propositionNumber} aria-hidden="true">
            {index + 1}
          </span>
          <RichText text={item} />
        </li>
      ))}
    </ol>
  );
}
