import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { errorMessage, ErrorCode } from '@/api/errors';
import { useAuth } from '@/auth/AuthContext';
import { homeFor } from '@/auth/roles';
import {
  CHANGE_PASSWORD_FIELDS as FIELDS,
  mapChangePasswordErrors,
  validateChangePassword,
  type FieldErrors,
} from '@/auth/validation';
import { flash } from '@/components/flash';
import { AlertIcon } from '@/components/icons/Icons';
import { PasswordField } from './AuthField';
import { focusFirstError } from './authForm';
import styles from './AuthForm.module.css';
import page from './ChangePasswordPage.module.css';

/**
 * `/change-password` (UI spec F1.2): forced while `mustChangePassword` is set (the shell hides
 * everything but Log out), voluntary from Profile. Success always ends on another page with a toast.
 */
export function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  // Fixed at mount: the flag clears the moment the change succeeds.
  const [forced] = useState(() => user?.mustChangePassword === true);

  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field: (typeof FIELDS)[number]) => (event: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const errors = validateChangePassword(values, user?.loginId ?? null);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, [...FIELDS]);
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      flash(forced ? 'Password updated.' : "Password updated. You've been signed out on other devices.");
      navigate(forced ? homeFor(user?.role ?? null) : '/profile', { replace: true });
    } catch (err) {
      const mapped =
        err instanceof ApiError && err.code === ErrorCode.VALIDATION_ERROR ? mapChangePasswordErrors(err.message) : null;
      if (mapped) {
        setFieldErrors(mapped);
        focusFirstError(mapped, [...FIELDS]);
      } else {
        setFormError(errorMessage(err));
      }
      setIsSubmitting(false);
    }
  }

  return (
    <div className={page.page}>
      {!forced && (
        <nav aria-label="Breadcrumb" className={page.breadcrumb}>
          <Link to="/profile">Profile</Link> <span aria-hidden="true">/</span> Change password
        </nav>
      )}
      <h1 className={styles.title}>{forced ? 'Set a new password' : 'Change password'}</h1>
      {forced && (
        <p className={styles.subtitle}>For your security, choose a new password before you continue.</p>
      )}

      <form className={`${styles.form} ${page.card}`} onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <PasswordField
          id="currentPassword"
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
          hint={forced ? 'This is the password you just signed in with.' : undefined}
          value={values.currentPassword}
          onChange={set('currentPassword')}
          error={fieldErrors.currentPassword}
        />
        <PasswordField
          id="newPassword"
          name="newPassword"
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={values.newPassword}
          onChange={set('newPassword')}
          error={fieldErrors.newPassword}
        />
        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={set('confirmPassword')}
          error={fieldErrors.confirmPassword}
        />

        <div role="alert" className={styles.alertRegion}>
          {formError && (
            <p className={styles.banner}>
              <AlertIcon size={20} />
              <span>{formError}</span>
            </p>
          )}
        </div>

        <div className={page.actions}>
          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting && <span className={styles.spinner} aria-hidden="true" />}
            {isSubmitting ? 'Saving…' : 'Save password'}
          </button>
          {!forced && (
            <Link to="/profile" className={page.cancel}>
              Cancel
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
