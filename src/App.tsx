import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RedirectIfAuthenticated } from '@/auth/RedirectIfAuthenticated';
import { RequireAdmin } from '@/auth/RequireAdmin';
import { RequireAuth } from '@/auth/RequireAuth';
import { AppLayout } from '@/components/AppLayout';
import { AdminCaseLawContentPage } from '@/pages/admin/AdminCaseLawContentPage';
import { AdminCaseLawFormPage } from '@/pages/admin/AdminCaseLawFormPage';
import { AdminCaseLawsPage } from '@/pages/admin/AdminCaseLawsPage';
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
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthenticated>
              <RegisterPage />
            </RedirectIfAuthenticated>
          }
        />
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
          <Route
            path="/admin/caselaws"
            element={
              <RequireAdmin>
                <AdminCaseLawsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/caselaws/new"
            element={
              <RequireAdmin>
                <AdminCaseLawFormPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/caselaws/:caseLawId"
            element={
              <RequireAdmin>
                <AdminCaseLawFormPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/caselaws/:caseLawId/content"
            element={
              <RequireAdmin>
                <AdminCaseLawContentPage />
              </RequireAdmin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
