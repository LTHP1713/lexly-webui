import type { ReactNode } from 'react';
import styles from './ui.module.css';

interface BaseProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  maxLength?: number;
}

/** Shared label / hint / counter / error plumbing; the error and hint are linked via `aria-describedby`. */
function FieldShell({
  id,
  label,
  error,
  hint,
  required,
  maxLength,
  length,
  children,
}: Omit<BaseProps, 'value' | 'onChange'> & { length: number; children: (describedBy: string | undefined) => ReactNode }) {
  const describedBy =
    [hint ? `${id}-hint` : null, maxLength ? `${id}-count` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required}> (required)</span>}
      </label>
      {hint && (
        <span id={`${id}-hint`} className={styles.hint}>
          {hint}
        </span>
      )}
      {children(describedBy)}
      {maxLength && (
        <span id={`${id}-count`} className={styles.counter}>
          {length}/{maxLength}
        </span>
      )}
      {error && (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  type = 'text',
  inputClassName,
  ...props
}: BaseProps & { type?: 'text' | 'email' | 'url' | 'date'; list?: string; inputClassName?: string }) {
  const { id, value, onChange, error, required, maxLength, list } = props;
  return (
    <FieldShell {...props} length={value.length}>
      {(describedBy) => (
        <input
          id={id}
          type={type}
          className={inputClassName ? `${styles.input} ${inputClassName}` : styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          list={list}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
        />
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  rows = 3,
  inputClassName,
  readOnly,
  ...props
}: BaseProps & { rows?: number; inputClassName?: string; readOnly?: boolean }) {
  const { id, value, onChange, error, required, maxLength } = props;
  return (
    <FieldShell {...props} length={value.length}>
      {(describedBy) => (
        <textarea
          id={id}
          className={inputClassName ? `${styles.textarea} ${inputClassName}` : styles.textarea}
          readOnly={readOnly}
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
        />
      )}
    </FieldShell>
  );
}
