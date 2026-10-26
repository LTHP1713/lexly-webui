import type { ReactNode, SVGProps } from 'react';

/**
 * Small inline line-icon set (24×24, stroke = currentColor), so the app needs no icon library.
 * Icons are decorative by default (`aria-hidden`); give the surrounding control an accessible name.
 */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number | string;
}

function Icon({ size = 24, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  );
}

/** Scales of justice. */
export function ScalesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4v16M8 20h8M5 7h14" />
      <circle cx="12" cy="4" r="0.6" fill="currentColor" />
      <path d="M5 7 2.5 13M5 7l2.5 6M2.5 13h5a2.5 2.5 0 0 1-5 0Z" />
      <path d="m19 7-2.5 6M19 7l2.5 6M16.5 13h5a2.5 2.5 0 0 1-5 0Z" />
    </Icon>
  );
}

/** Open statute book. */
export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.5C10.5 5.2 8 4.5 3.5 4.5v13c4.5 0 7 .7 8.5 2 1.5-1.3 4-2 8.5-2v-13c-4.5 0-7 .7-8.5 2Z" />
      <path d="M12 6.5v13" />
      <path d="M6 8.5c1.5.1 2.8.4 3.8.9M6 11.5c1.5.1 2.8.4 3.8.9M18 8.5c-1.5.1-2.8.4-3.8.9" />
    </Icon>
  );
}

/** Classical courthouse façade. */
export function CourthouseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 9.5 12 4.5l9 5H3Z" />
      <path d="M6 12v5.5M10 12v5.5M14 12v5.5M18 12v5.5" />
      <path d="M4.5 17.5h15M3 20.5h18" />
    </Icon>
  );
}

/** Question paper / checklist. */
export function ChecklistIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 3h6v3H9z" />
      <path d="m8 10.5 1.5 1.5L12 9.5M14 11h2.5" />
      <path d="m8 15.5 1.5 1.5 2.5-2.5M14 16h2.5" />
    </Icon>
  );
}

/** Legal document / judgment. */
export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6.5 3.5h8L18 7v13.5H6.5Z" />
      <path d="M14.5 3.5V7H18" />
      <path d="M9 11h6M9 14h6M9 17h3.5" />
    </Icon>
  );
}

/** Study notes: a page with lines and a folded corner, distinct from the legal `DocumentIcon`. */
export function NotesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5.5 4.5h10l3 3v12h-13Z" />
      <path d="M8.5 9h7M8.5 12h7M8.5 15h4" />
      <path d="M15.5 4.5v3h3" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </Icon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3 19.5c.7-3.2 3.1-5 6-5s5.3 1.8 6 5" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.8c1.8.6 3.1 2.2 3.5 4.7" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Icon>
  );
}

export function LogOutIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 4.5h4.5v15H14" />
      <path d="m10 8-4 4 4 4M6 12h9" />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.5v2" />
    </Icon>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 5.7c.6-.1 1.3-.2 2-.2 6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.6 3.4M6.4 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.6 4.6-1.4" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3.5 3.5 17 17" />
    </Icon>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.2" r="0.6" fill="currentColor" />
    </Icon>
  );
}

export function LightbulbIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z" />
    </Icon>
  );
}

/** The AI mark (the logo's spark) as a line icon: the tutor's icon in nav and cards. */
export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3c.4 5.6 2.3 8.5 9 9-6.7.5-8.6 3.4-9 9-.4-5.6-2.3-8.5-9-9 6.7-.5 8.6-3.4 9-9Z" />
    </Icon>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 7h15M10 4h4M6.5 7l1 12.5h9l1-12.5" />
      <path d="M10 11v5M14 11v5" />
    </Icon>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4.5h-4.5" />
    </Icon>
  );
}

export function PenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </Icon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4ZM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
    </Icon>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
    </Icon>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Icon>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M19 12H5m6-6-6 6 6 6" />
    </Icon>
  );
}
