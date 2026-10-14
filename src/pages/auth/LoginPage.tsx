/**
 * Styling convention for this app: CSS Modules (plain CSS, scoped per-file via `*.module.css`)
 * — no UI kit. Later pages should follow this same pattern: colocate a `<PageName>.module.css`
 * (or a shared one, like `AuthForm.module.css` here) next to the component.
 */
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { mapServerFieldError, validateCollegeLogin, validateLogin, type FieldErrors } from '@/auth/validation';
import { AlertIcon, CourthouseIcon, MailIcon, UserIcon } from '@/components/icons/Icons';
import { AuthField, PasswordField } from './AuthField';
import { AuthLayout } from './AuthLayout';
import { describeAuthError, describeEndReason, focusFirstError } from './authForm';
import styles from './AuthForm.module.css';

type LoginTab = 'email' | 'college';

const TABS: { id: LoginTab; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'college', label: 'College' },
];

/** Only the tab name is remembered, never credentials (plan §9.1). */
const TAB_STORAGE_KEY = 'lexly.loginTab';

function readStoredTab(): LoginTab {
  try {
    return localStorage.getItem(TAB_STORAGE_KEY) === 'college' ? 'college' : 'email';
  } catch {
    return 'email';
  }
}

function storeTab(tab: LoginTab) {
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    // Storage unavailable; the tab just isn't remembered.
  }
}

/**
 * `/login` with two modes (UI spec F1.1): **Email** for SUPERADMIN, C_ADMIN and S_STUDENT, and
 * **College** (college code + roll no. / employee ID) for C_PROFESSOR and C_STUDENT. Exactly one
 * shape is sent. On success the route's `RedirectIfAuthenticated` decides where to go.
 */
export function LoginPage() {
  const { login, endReason, acknowledgeEndReason } = useAuth();

  const [tab, setTab] = useState<LoginTab>(readStoredTab);
  const [email, setEmail] = useState('');
  const [collegeCode, setCollegeCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Why the previous session ended, shown once (and not after a deliberate logout).
  const [endMessage] = useState(() => describeEndReason(endReason));
  const tabRefs = useRef<Record<LoginTab, HTMLButtonElement | null>>({ email: null, college: null });

  useEffect(() => {
    acknowledgeEndReason();
  }, [acknowledgeEndReason]);

  /** Switching keeps the password and clears field errors (UI spec F1.1). */
  function selectTab(next: LoginTab, focus = false) {
    if (next === tab) return;
    setTab(next);
    storeTab(next);
    setFieldErrors({});
    setFormError(null);
    if (focus) tabRefs.current[next]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((t) => t.id === tab);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    selectTab(TABS[next].id, true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    const errors =
      tab === 'email' ? validateLogin({ email, password }) : validateCollegeLogin({ collegeCode, loginId, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      focusFirstError(errors, tab === 'email' ? ['email', 'password'] : ['collegeCode', 'loginId', 'password']);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(
        tab === 'email'
          ? { email: email.trim(), password }
          : { collegeCode: collegeCode.trim().toUpperCase(), loginId: loginId.trim(), password },
      );
    } catch (err) {
      const mapped = err instanceof ApiError && err.code === 'VALIDATION_ERROR' ? mapServerFieldError(err.message) : undefined;
      if (mapped) {
        setFieldErrors(mapped);
      } else {
        setFormError(describeAuthError(err, tab === 'email' ? 'login' : 'college-login'));
      }
      setIsSubmitting(false);
    }
  }

  const banner = formError ?? (isSubmitting ? null : endMessage);

  return (
    <AuthLayout>
      <h1 className={styles.title}>Welcome back</h1>
      <p className={styles.subtitle}>Continue your legal learning journey.</p>

      <div role="tablist" aria-label="Sign in with" className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(node) => {
              tabRefs.current[t.id] = node;
            }}
            type="button"
            role="tab"
            id={`login-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="login-panel"
            tabIndex={tab === t.id ? 0 : -1}
            className={styles.tab}
            onClick={() => selectTab(t.id)}
            onKeyDown={handleTabKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        id="login-panel"
        role="tabpanel"
        aria-labelledby={`login-tab-${tab}`}
        className={styles.form}
        onSubmit={handleSubmit}
        noValidate
        aria-busy={isSubmitting}
      >
        {tab === 'email' ? (
          <AuthField
            id="email"
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="you@example.com"
            icon={<MailIcon size={20} />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
          />
        ) : (
          <>
            <AuthField
              id="collegeCode"
              name="collegeCode"
              label="College code"
              autoComplete="organization"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. NLSIU"
              icon={<CourthouseIcon size={20} />}
              value={collegeCode}
              onChange={(event) => setCollegeCode(event.target.value.toUpperCase())}
              error={fieldErrors.collegeCode}
            />
            <AuthField
              id="loginId"
              name="loginId"
              label="Roll no. or employee ID"
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              icon={<UserIcon size={20} />}
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              error={fieldErrors.loginId}
            />
          </>
        )}

        <PasswordField
          id="password"
          name="password"
          label="Password"
          autoComplete="current-password"
          placeholder="Your password"
          hint={tab === 'college' ? 'First time? Your password is your roll no. or employee ID.' : undefined}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        <div role="alert" className={styles.alertRegion}>
          {banner && (
            <p className={styles.banner}>
              <AlertIcon size={20} />
              <span>{banner}</span>
            </p>
          )}
        </div>

        <button type="submit" className={styles.submit} disabled={isSubmitting}>
          {isSubmitting && <span className={styles.spinner} aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {tab === 'email' ? (
        <p className={styles.switch}>
          New to Lexly?
          <Link to="/register" className={styles.switchLink}>
            Create an account
          </Link>
        </p>
      ) : (
        <p className={styles.switch}>Don&rsquo;t have your login details? Ask your college administrator.</p>
      )}
    </AuthLayout>
  );
}
