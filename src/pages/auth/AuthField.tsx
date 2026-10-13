import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { EyeIcon, EyeOffIcon, LockIcon } from '@/components/icons/Icons';
import styles from './AuthForm.module.css';

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Persistent guidance under the input (e.g. password rules); hidden while an error shows. */
  hint?: string;
  error?: string;
  /** Rendered inside the input box after the input — the password reveal button. */
  trailing?: ReactNode;
}

/**
 * Labelled input for the auth forms: real `<label>` above the box, decorative leading icon, and
 * the error (or hint) linked through `aria-describedby` so screen readers announce it with the field.
 */
export function AuthField({ id, label, icon, hint, error, trailing, ...inputProps }: AuthFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={`${styles.control} ${error ? styles.controlInvalid : ''}`}>
        {icon && <span className={styles.controlIcon}>{icon}</span>}
        <input
          id={id}
          className={styles.input}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {trailing}
      </div>
      {error ? (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className={styles.hint}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

type PasswordFieldProps = Omit<AuthFieldProps, 'type' | 'icon' | 'trailing'>;

/** `AuthField` with a lock icon and a show/hide toggle. Toggling never clears or moves the value. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      {...props}
      type={visible ? 'text' : 'password'}
      icon={<LockIcon size={20} />}
      spellCheck={false}
      autoCapitalize="off"
      trailing={
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setVisible((v) => !v)}
          aria-label="Show password"
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          aria-controls={props.id}
        >
          {visible ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
        </button>
      }
    />
  );
}
