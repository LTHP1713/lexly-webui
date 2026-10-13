/**
 * Styling convention for this app: CSS Modules (plain CSS, scoped per-file via `*.module.css`)
 * — no UI kit. Later pages should follow this same pattern: colocate a `<PageName>.module.css`
 * (or a shared one, like `AuthForm.module.css` here) next to the component.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { mapServerFieldError, validateLogin, type FieldErrors } from '@/auth/validation';
import { AlertIcon, MailIcon } from '@/components/icons/Icons';
import { AuthField, PasswordField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { describeAuthError, focusFirstError } from './authForm';
import styles from './AuthForm.module.css';

export function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, ['email', 'password']);
      return;
    }

    setIsSubmitting(true);
    try {
      // On success the route's RedirectIfAuthenticated guard sends the user to the Dashboard.
      await login({ email, password });
    } catch (err) {
      const mapped = err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? mapServerFieldError(err.message) : undefined;
      if (mapped) {
        setFieldErrors(mapped);
      } else {
        setFormError(describeAuthError(err, 'login'));
      }
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.subtitle}>Continue your legal learning journey.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <AuthField
          id="email"
          name="email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="you@example.com"
          icon={<MailIcon size={20} />}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />

        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        <div role="alert" className={styles.alertRegion}>
          {formError && (
            <p className={styles.banner}>
              <AlertIcon size={20} />
              <span>{formError}</span>
            </p>
          )}
        </div>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting && <span className={styles.spinner} aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className={styles.switch}>
        New to Lexly?
        <Link to="/register" className={styles.switchLink}>
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
