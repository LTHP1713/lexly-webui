import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
