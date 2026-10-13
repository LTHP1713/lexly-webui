import type { ReactNode } from 'react';

/**
 * Original inline-SVG scene for the auth screens: a law student at a desk (book stack, open
 * book, laptop) ringed by a dashed orbit of study vignettes — Bare Acts, the court, an advocate,
 * scales, case law, graduation and practice. People are drawn faceless with a neutral haircut and
 * outfit so the scene reads as any student. Lexly palette only; purely decorative (`aria-hidden`).
 *
 * `compact` crops to the student at the desk and drops the orbit, for phones.
 */

const NAVY = '#13294b';
const NAVY_SOFT = '#1f3a66';
const NAVY_DEEP = '#0e1f3a';
const IVORY = '#f8f5ee';
const SAND = '#e6d5b3';
const SAND_DEEP = '#cdb48a';
const GOLD = '#b8924a';
const GOLD_SOFT = '#f3ead6';
const LEAF = '#e4d3b0';
const RULE = '#d2c8b4';
const FAINT = '#d6cfbf';
const HAIR = '#1c2538';
const SKIN = '#ecc19c';
const WOOD = '#8a5a35';
const WOOD_DEEP = '#6b4428';
const SERIF = "Georgia, 'Times New Roman', serif";

/** Leafy sprig; `flip` mirrors it. */
function Sprig({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} fill={LEAF}>
      <path d="M0 0c-2-22 2-42 14-60" stroke={SAND_DEEP} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="-6" cy="-16" rx="5" ry="12" transform="rotate(-30 -6 -16)" />
      <ellipse cx="12" cy="-24" rx="5" ry="12" transform="rotate(35 12 -24)" />
      <ellipse cx="0" cy="-38" rx="5" ry="11" transform="rotate(-25 0 -38)" />
      <ellipse cx="17" cy="-48" rx="4.5" ry="10" transform="rotate(30 17 -48)" />
    </g>
  );
}

function Vignette({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="58" fill={GOLD_SOFT} />
      {children}
    </g>
  );
}

/** Tiny outline icons scattered around the orbit. */
function FaintIcons() {
  return (
    <g stroke={FAINT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g transform="translate(300 42)">
        <path d="M0-8c-4-3-10-4-16-4v20c6 0 12 1 16 4 4-3 10-4 16-4v-20c-6 0-12 1-16 4ZM0-8v20" />
      </g>
      <g transform="translate(528 42)">
        <path d="M-16-6 0-16l16 10ZM-12-2v14M-4-2v14M4-2v14M12-2v14M-16 14h32" />
      </g>
      {[
        [40, 206],
        [784, 206],
        [410, 592],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M0-12v24M-8 12h16M-12-8h24M-12-8l-5 10M-12-8l5 10M12-8l-5 10M12-8l5 10" />
          <path d="M-17 2h10a5 4 0 0 1-10 0ZM7 2h10a5 4 0 0 1-10 0Z" />
        </g>
      ))}
      <g transform="translate(44 452)">
        <rect x="-9" y="-12" width="18" height="24" rx="2" />
        <path d="M-5-12v24" />
      </g>
    </g>
  );
}

function Orbit() {
  return (
    <>
      <ellipse
        cx="410"
        cy="318"
        rx="330"
        ry="250"
        fill="none"
        stroke={SAND_DEEP}
        strokeWidth="2"
        strokeDasharray="10 12"
        strokeLinecap="round"
      />
      <FaintIcons />

      {/* Court */}
      <Vignette x={410} y={68}>
        <Sprig x={-44} y={36} scale={0.6} flip />
        <Sprig x={44} y={36} scale={0.6} />
        <rect x="-50" y="32" width="100" height="6" rx="1" fill={SAND_DEEP} />
        <rect x="-44" y="26" width="88" height="6" rx="1" fill={SAND} />
        <rect x="-36" y="-6" width="72" height="32" fill={NAVY} />
        {[-34, -15, 4, 23].map((cx) => (
          <rect key={cx} x={cx} y="-6" width="11" height="32" fill="#efe3c8" />
        ))}
        <rect x="-42" y="-14" width="84" height="8" fill={SAND} />
        <path d="M-46-14 0-38l46 24Z" fill="#efe3c8" stroke={SAND_DEEP} strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M-24-18 0-30l24 12Z" fill="none" stroke={SAND_DEEP} strokeWidth="1.2" strokeLinejoin="round" />
      </Vignette>

      {/* Bare Acts */}
      <Vignette x={177} y={141}>
        <rect x="-44" y="22" width="78" height="14" rx="2" fill={SAND} />
        <rect x="-44" y="25" width="6" height="8" fill={IVORY} />
        <g transform="rotate(-10)">
          <rect x="-24" y="-40" width="56" height="74" rx="3" fill={IVORY} stroke={RULE} />
          <rect x="-32" y="-44" width="58" height="76" rx="4" fill={NAVY} />
          <rect x="-32" y="-44" width="8" height="76" rx="3" fill={NAVY_DEEP} />
          <text x="1" y="-10" textAnchor="middle" fontFamily={SERIF} fontSize="13" fill={GOLD} letterSpacing="1">
            BARE
          </text>
          <text x="1" y="8" textAnchor="middle" fontFamily={SERIF} fontSize="13" fill={GOLD} letterSpacing="1">
            ACTS
          </text>
          <path d="M6 32v16l5-5 5 5V32Z" fill={GOLD} />
        </g>
      </Vignette>

      {/* Advocate at the podium */}
      <Vignette x={643} y={141}>
        <Sprig x={42} y={34} scale={0.55} />
        <path d="M-30 30c0-26 13-42 30-42s30 16 30 42Z" fill={NAVY} />
        <path d="M-10-12 0 0l10-12Z" fill="#ffffff" />
        <rect x="-4" y="-6" width="3.5" height="16" rx="1" fill="#ffffff" />
        <rect x="0.5" y="-6" width="3.5" height="16" rx="1" fill="#ffffff" />
        <path d="M-14-26c0-12 6-19 14-19s14 7 14 19v5c0 3-3 3-4 0l-1-5h-18l-1 5c-1 3-4 3-4 0Z" fill={HAIR} />
        <ellipse cx="0" cy="-24" rx="10.5" ry="12" fill={SKIN} />
        <path d="M-12-27c-1-11 5-17 12-17 8 0 13 6 12 15-2-2-4-5-4-7-2 3-6 4-9 4 1-1 2-3 2-4-3 4-8 7-13 9Z" fill={HAIR} />
        <rect x="-40" y="22" width="80" height="8" rx="2" fill={WOOD} />
        <rect x="-32" y="30" width="64" height="18" fill="#a3805a" />
        <rect x="22" y="-58" width="36" height="22" rx="11" fill="#ffffff" stroke={NAVY} strokeWidth="1.5" />
        <path d="M30-37l-5 8 10-6" fill="#ffffff" stroke={NAVY} strokeWidth="1.5" strokeLinejoin="round" />
        {[32, 40, 48].map((cx) => (
          <circle key={cx} cx={cx} cy="-47" r="2" fill={NAVY} />
        ))}
      </Vignette>

      {/* Scales */}
      <Vignette x={80} y={318}>
        <Sprig x={-30} y={44} scale={0.5} flip />
        <rect x="-2" y="-28" width="4" height="54" fill="#7a5a3a" />
        <path d="M-18 32h36l-5-7h-26Z" fill="#7a5a3a" />
        <rect x="-40" y="-25" width="80" height="4" rx="2" fill={GOLD} />
        <circle cx="0" cy="-30" r="4" fill={GOLD} />
        <path d="M-36-22-46 4M-36-22-26 4M36-22 26 4M36-22 46 4" stroke="#8a6a4a" strokeWidth="1.2" />
        <path d="M-48 4h24a12 8 0 0 1-24 0ZM24 4h24a12 8 0 0 1-24 0Z" fill={GOLD} />
      </Vignette>

      {/* Case law */}
      <Vignette x={740} y={318}>
        <g transform="rotate(4)">
          <rect x="-34" y="-46" width="60" height="82" rx="3" fill="#ffffff" stroke={RULE} />
          <text x="-4" y="-28" textAnchor="middle" fontFamily={SERIF} fontSize="9.5" fill={NAVY}>
            CASE LAW
          </text>
          <path d="M-26-16h42M-26-8h42M-26 0h42M-26 8h30M-26 16h36" stroke={RULE} strokeWidth="1.6" />
        </g>
        <rect x="4" y="36" width="34" height="6" rx="2" fill={WOOD_DEEP} />
        <rect x="9" y="31" width="24" height="5" rx="1.5" fill={WOOD} />
        <g transform="translate(18 18) rotate(35)">
          <rect x="6" y="-3" width="36" height="6" rx="3" fill="#9a6a42" />
          <rect x="-8" y="-14" width="16" height="28" rx="3" fill={WOOD_DEEP} />
          <rect x="-8" y="-9" width="16" height="3" fill={GOLD} />
          <rect x="-8" y="6" width="16" height="3" fill={GOLD} />
        </g>
      </Vignette>

      {/* Graduation */}
      <Vignette x={177} y={495}>
        <Sprig x={-40} y={40} scale={0.55} flip />
        <rect x="-38" y="16" width="76" height="14" rx="2" fill={NAVY_SOFT} />
        <rect x="-42" y="18" width="6" height="10" fill={IVORY} />
        <rect x="-34" y="2" width="68" height="14" rx="2" fill={SAND} />
        <path d="M-20-10v12q20 10 40 0v-12Z" fill={NAVY} />
        <path d="M0-32 42-16 0 0l-42-16Z" fill="#1c3254" />
        <circle cx="0" cy="-16" r="2.5" fill={GOLD} />
        <path d="M0-16l30 6v20" stroke={GOLD} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M27 10h6l2 10h-10Z" fill={GOLD} />
      </Vignette>

      {/* Practice */}
      <Vignette x={643} y={495}>
        <g transform="rotate(-5)">
          <rect x="-32" y="-44" width="58" height="82" rx="3" fill="#ffffff" stroke={RULE} />
          <text x="-3" y="-26" textAnchor="middle" fontFamily={SERIF} fontSize="9" fill={NAVY}>
            PRACTICE
          </text>
          {[-14, 2, 18].map((y) => (
            <g key={y}>
              <rect x="-24" y={y - 5} width="9" height="9" rx="1.5" fill="none" stroke={NAVY_SOFT} strokeWidth="1.4" />
              <path d={`M-9 ${y}h26`} stroke={RULE} strokeWidth="1.6" />
            </g>
          ))}
          <path d="M-23-14l3 4 7-9" stroke={GOLD} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform="translate(34 2) rotate(25)">
          <rect x="-3" y="-34" width="6" height="54" rx="3" fill={NAVY} />
          <rect x="-3" y="-34" width="6" height="8" rx="2" fill={GOLD} />
          <path d="M-3 20l3 9 3-9Z" fill={GOLD} />
        </g>
      </Vignette>
    </>
  );
}

export function AuthIllustration({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox={compact ? '206 146 418 316' : '0 0 820 620'}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {!compact && <Orbit />}

      {/* Soft backdrop behind the student */}
      <path
        d="M410 168c84 0 164 52 172 132 8 72-34 122-172 122S230 372 238 300c8-80 88-132 172-132Z"
        fill={GOLD_SOFT}
        fillOpacity="0.85"
      />
      <Sprig x={268} y={336} scale={1.1} flip />
      <Sprig x={574} y={326} scale={1.1} />

      {/* Student — faceless, chin-length hair, plain sweater over a collared shirt */}
      <rect x="398" y="236" width="24" height="50" rx="8" fill={SKIN} />
      <path d="M316 424c0-88 42-142 94-144 52 2 94 56 94 144Z" fill={NAVY} />
      <path d="M384 282 410 306l26-24-8-7-18 16-18-16Z" fill="#ffffff" />
      <path d="M394 290 410 312l16-22" stroke={NAVY_SOFT} strokeWidth="3" fill="none" strokeLinejoin="round" />
      <g transform="translate(0 10)">
        <path d="M372 216c-2-36 16-60 40-60s42 22 40 58l-2 18c-2 4-6 4-8 0l-2-12h-56l-2 12c-2 4-6 4-8 0Z" fill={HAIR} />
        <ellipse cx="410" cy="218" rx="31" ry="35" fill={SKIN} />
        <path
          d="M374 214c-4-34 14-56 38-56 26 0 42 20 38 50-6-6-10-14-12-20-6 8-16 12-26 12 4-4 6-8 6-12-10 10-26 20-44 26Z"
          fill={HAIR}
        />
        <path d="M394 162c2-10 12-15 21-11-6 2-9 6-9 11ZM418 158c6-7 17-5 21 2-6-2-12 0-15 4Z" fill={HAIR} />
      </g>

      {/* Desk */}
      <path d="M236 402h360l16 26H220Z" fill="#dcc6a1" />
      <rect x="220" y="428" width="392" height="10" rx="2" fill="#c9ad80" />

      {/* Writing arm (behind the book stack) */}
      <path d="M334 330c-12 40-6 70 30 86" stroke={NAVY} strokeWidth="26" strokeLinecap="round" fill="none" />

      {/* Book stack */}
      {[
        { y: 324, x: 240, label: 'CONSTITUTION' },
        { y: 350, x: 246, label: 'CRIMINAL LAW' },
        { y: 376, x: 238, label: 'CIVIL LAW' },
      ].map(({ y, x, label }) => (
        <g key={label}>
          <rect x={x - 6} y={y + 3} width="100" height="20" rx="2" fill={IVORY} stroke={RULE} />
          <rect x={x + 2} y={y} width="96" height="26" rx="3" fill={NAVY} />
          <path d={`M${x + 10} ${y + 2}v22M${x + 90} ${y + 2}v22`} stroke={GOLD} strokeWidth="1.5" />
          <text x={x + 50} y={y + 17} textAnchor="middle" fontFamily={SERIF} fontSize="9" fill={GOLD_SOFT} letterSpacing="0.4">
            {label}
          </text>
        </g>
      ))}

      {/* Other arm, then the laptop in front of it */}
      <path d="M488 330c10 30 6 56-20 74" stroke={NAVY} strokeWidth="26" strokeLinecap="round" fill="none" />
      <rect x="448" y="300" width="116" height="104" rx="8" fill="#bcc1c9" />
      <circle cx="506" cy="352" r="9" fill="#e4e6ea" />
      <path d="M440 404h132l8 8H432Z" fill="#a3a9b3" />

      {/* Pen cup */}
      <path d="M582 370l-5-20M590 370l4-22" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M586 370l-1-18" stroke={NAVY_SOFT} strokeWidth="3" strokeLinecap="round" />
      <rect x="574" y="368" width="24" height="34" rx="4" fill={NAVY} />

      {/* Open book */}
      <path d="M346 420l112-8 112 8 8 34-120-6-120 6Z" fill={NAVY} />
      <path d="M352 418l104-6v34l-110 6Z" fill="#ffffff" />
      <path d="M460 412l104 6 6 34-110-6Z" fill="#ffffff" />
      <path d="M458 412v34" stroke={RULE} strokeWidth="1.5" />
      <path d="M362 428h82M360 436h84M358 444h60M472 424h82M474 432h84M476 440h64" stroke={RULE} strokeWidth="1.6" strokeLinecap="round" />
      <rect x="474" y="427" width="58" height="6" rx="1" fill={GOLD} fillOpacity="0.4" />

      {/* Writing hand + pen */}
      <path d="M368 420l20-32" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
      <path d="M366 423l2-3" stroke={GOLD} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="370" cy="418" rx="13" ry="9" fill={SKIN} />
    </svg>
  );
}
