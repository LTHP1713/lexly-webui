import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/AppLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ActsPage } from '@/pages/content/ActsPage';
import { CaseLawDetailPage } from '@/pages/content/CaseLawDetailPage';
import { CaseLawsPage } from '@/pages/content/CaseLawsPage';
import { SearchPage } from '@/pages/content/SearchPage';
import { SectionDetailPage } from '@/pages/content/SectionDetailPage';
import { SectionsPage } from '@/pages/content/SectionsPage';
import { HomePage } from '@/pages/home/HomePage';
import { PracticePage } from '@/pages/PracticePage';
import { ProfilePage } from '@/pages/ProfilePage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<HomePage />} />
          <Route path="/acts" element={<ActsPage />} />
          <Route path="/acts/:actId" element={<SectionsPage />} />
          <Route path="/sections/:sectionId" element={<SectionDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/caselaws" element={<CaseLawsPage />} />
          <Route path="/caselaws/:caseLawId" element={<CaseLawDetailPage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
