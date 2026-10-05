import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { mapServerFieldError, validateRegister, type FieldErrors } from '@/auth/validation';
import styles from './AuthForm.module.css';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const errorId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validateRegister({ email, password, fullName });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSubmitting(true);
    try {
      await register({ email, password, fullName });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        const mapped = mapServerFieldError(err.message);
        if (mapped) {
          setFieldErrors(mapped);
        } else {
          setFormError(err.message);
        }
      } else if (err instanceof ApiError) {
        // Covers EMAIL_ALREADY_EXISTS and anything else the backend returns.
        setFormError(err.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Get started with Lexly.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              className={`${styles.input} ${fieldErrors.fullName ? styles.inputInvalid : ''}`}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? 'fullName-error' : undefined}
            />
            {fieldErrors.fullName && (
              <p id="fullName-error" className={styles.fieldError}>
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              className={`${styles.input} ${fieldErrors.email ? styles.inputInvalid : ''}`}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" className={styles.fieldError}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              className={`${styles.input} ${fieldErrors.password ? styles.inputInvalid : ''}`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" className={styles.fieldError}>
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div role="alert" aria-live="polite">
            {formError && (
              <p id={errorId} className={styles.banner}>
                {formError}
              </p>
            )}
          </div>

          <button type="submit" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className={styles.footer}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
