import { lazy } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RedirectIfAuthenticated, RootRedirect } from '@/auth/RedirectIfAuthenticated';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireRole } from '@/auth/RequireRole';
import { AppLayout } from '@/components/AppLayout';
import { ChangePasswordPage } from '@/pages/auth/ChangePasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ActsPage } from '@/pages/content/ActsPage';
import { CaseLawDetailPage } from '@/pages/content/CaseLawDetailPage';
import { CaseLawsPage } from '@/pages/content/CaseLawsPage';
import { SearchPage } from '@/pages/content/SearchPage';
import { SectionDetailPage } from '@/pages/content/SectionDetailPage';
import { SectionsPage } from '@/pages/content/SectionsPage';
import { HomePage } from '@/pages/home/HomePage';
import { NotFoundFrame, NotFoundPage } from '@/pages/NotFoundPage';
import { PracticePage } from '@/pages/PracticePage';
import { ProfilePage } from '@/pages/ProfilePage';

// One chunk per role area (plan §3.1), so other roles never download it.
const AdminCaseLawsPage = lazy(() => import('@/pages/admin/AdminCaseLawsPage').then((m) => ({ default: m.AdminCaseLawsPage })));
const AdminCaseLawFormPage = lazy(() =>
  import('@/pages/admin/AdminCaseLawFormPage').then((m) => ({ default: m.AdminCaseLawFormPage })),
);
const AdminCaseLawContentPage = lazy(() =>
  import('@/pages/admin/AdminCaseLawContentPage').then((m) => ({ default: m.AdminCaseLawContentPage })),
);

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
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
          <Route path="/change-password" element={<ChangePasswordPage />} />

          {/* Library: every role */}
          <Route path="/acts" element={<ActsPage />} />
          <Route path="/acts/:actId" element={<SectionsPage />} />
          <Route path="/sections/:sectionId" element={<SectionDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/caselaws" element={<CaseLawsPage />} />
          <Route path="/caselaws/:caseLawId" element={<CaseLawDetailPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* S_STUDENT */}
          <Route
            element={
              <RequireRole roles={['S_STUDENT']}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/practice" element={<PracticePage />} />
          </Route>

          {/* SUPERADMIN */}
          <Route
            element={
              <RequireRole roles={['SUPERADMIN']}>
                <Outlet />
              </RequireRole>
            }
          >
            <Route path="/admin" element={<Navigate to="/admin/caselaws" replace />} />
            <Route path="/admin/caselaws" element={<AdminCaseLawsPage />} />
            <Route path="/admin/caselaws/new" element={<AdminCaseLawFormPage />} />
            <Route path="/admin/caselaws/:caseLawId" element={<AdminCaseLawFormPage />} />
            <Route path="/admin/caselaws/:caseLawId/content" element={<AdminCaseLawContentPage />} />
          </Route>
        </Route>
        <Route element={<NotFoundFrame />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
