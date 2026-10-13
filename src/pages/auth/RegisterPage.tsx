import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { mapServerFieldError, validateRegister, type FieldErrors } from '@/auth/validation';
import { AlertIcon, MailIcon, UserIcon } from '@/components/icons/Icons';
import { AuthField, PasswordField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { describeAuthError, focusFirstError, isEmailTaken } from './authForm';
import styles from './AuthForm.module.css';

const FIELD_ORDER = ['fullName', 'email', 'password'];

export function RegisterPage() {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);
    setEmailTaken(false);

    const errors = validateRegister({ email, password, fullName });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, FIELD_ORDER);
      return;
    }

    setIsSubmitting(true);
    try {
      // Registration signs the user straight in (AuthContext stores the returned tokens), and the
      // route's RedirectIfAuthenticated guard then sends them to the Dashboard.
      await register({ email, password, fullName });
    } catch (err) {
      const mapped = err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? mapServerFieldError(err.message) : undefined;
      if (mapped) {
        setFieldErrors(mapped);
        focusFirstError(mapped, FIELD_ORDER);
      } else {
        setEmailTaken(isEmailTaken(err));
        setFormError(describeAuthError(err, 'register'));
      }
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className={styles.title}>Start your journey with Lexly</h1>
      <p className={styles.subtitle}>Build stronger legal knowledge, one topic at a time.</p>

      <form className={styles.form} onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <AuthField
          id="fullName"
          name="fullName"
          label="Full name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Your full name"
          icon={<UserIcon size={20} />}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.fullName}
        />

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
          autoComplete="new-password"
          placeholder="Create a password"
          hint="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        <div role="alert" className={styles.alertRegion}>
          {formError && (
            <p className={styles.banner}>
              <AlertIcon size={20} />
              <span>
                {formError}
                {emailTaken && (
                  <>
                    {' '}
                    <Link to="/login">Sign in instead</Link>
                  </>
                )}
              </span>
            </p>
          )}
        </div>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting && <span className={styles.spinner} aria-hidden="true" />}
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className={styles.switch}>
        Already have an account?
        <Link to="/login" className={styles.switchLink}>
          Sign In
        </Link>
      </p>
    </AuthLayout>
  );
}
