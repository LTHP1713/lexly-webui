import { useAuth } from '@/auth/AuthContext';

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Logged in</h1>
      <p>Welcome{user ? `, ${user.email}` : ''}. This is a placeholder — later prompts build this out.</p>
      <button type="button" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
