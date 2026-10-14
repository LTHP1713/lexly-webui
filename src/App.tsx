import { lazy, useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthContext';
import { RedirectIfAuthenticated, RootRedirect } from '@/auth/RedirectIfAuthenticated';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireRole } from '@/auth/RequireRole';
import { AppLayout } from '@/components/AppLayout';
import { clearOnUserChange, createQueryClient } from '@/lib/queryClient';
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

// Role areas load lazily (plan §3.1), so other roles never download them.
const AdminHomePage = lazy(() => import('@/pages/admin/AdminHomePage').then((m) => ({ default: m.AdminHomePage })));
const CollegesPage = lazy(() => import('@/pages/admin/colleges/CollegesPage').then((m) => ({ default: m.CollegesPage })));
const CollegeDetailPage = lazy(() =>
  import('@/pages/admin/colleges/CollegeDetailPage').then((m) => ({ default: m.CollegeDetailPage })),
);
const AdminActsPage = lazy(() => import('@/pages/admin/acts/AdminActsPage').then((m) => ({ default: m.AdminActsPage })));
const AdminActDetailPage = lazy(() =>
  import('@/pages/admin/acts/AdminActDetailPage').then((m) => ({ default: m.AdminActDetailPage })),
);
const AdminSectionPage = lazy(() =>
  import('@/pages/admin/acts/AdminSectionPage').then((m) => ({ default: m.AdminSectionPage })),
);
const ImportPage = lazy(() => import('@/pages/admin/ImportPage').then((m) => ({ default: m.ImportPage })));
const AdminCaseLawsPage = lazy(() => import('@/pages/admin/AdminCaseLawsPage').then((m) => ({ default: m.AdminCaseLawsPage })));
const AdminCaseLawFormPage = lazy(() =>
  import('@/pages/admin/AdminCaseLawFormPage').then((m) => ({ default: m.AdminCaseLawFormPage })),
);
const AdminCaseLawContentPage = lazy(() =>
  import('@/pages/admin/AdminCaseLawContentPage').then((m) => ({ default: m.AdminCaseLawContentPage })),
);
const AuditLogPage = lazy(() => import('@/pages/audit/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const CollegeHomePage = lazy(() => import('@/pages/college/CollegeHomePage').then((m) => ({ default: m.CollegeHomePage })));
const UsersPage = lazy(() => import('@/pages/college/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const UserDetailPage = lazy(() => import('@/pages/college/users/UserDetailPage').then((m) => ({ default: m.UserDetailPage })));
const UsersImportPage = lazy(() =>
  import('@/pages/college/users/UsersImportPage').then((m) => ({ default: m.UsersImportPage })),
);
const SubjectsPage = lazy(() => import('@/pages/college/subjects/SubjectsPage').then((m) => ({ default: m.SubjectsPage })));
const SubjectDetailPage = lazy(() =>
  import('@/pages/college/subjects/SubjectDetailPage').then((m) => ({ default: m.SubjectDetailPage })),
);
const ProfessorHomePage = lazy(() =>
  import('@/pages/professor/ProfessorHomePage').then((m) => ({ default: m.ProfessorHomePage })),
);
const StudentHomePage = lazy(() => import('@/pages/student/StudentHomePage').then((m) => ({ default: m.StudentHomePage })));

function App() {
  // One client per app instance (tests mount several); emptied whenever the user changes.
  const [queryClient] = useState(createQueryClient);
  useEffect(() => clearOnUserChange(queryClient), [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
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
              <Route path="/admin" element={<AdminHomePage />} />
              <Route path="/admin/colleges" element={<CollegesPage />} />
              <Route path="/admin/colleges/:collegeId" element={<CollegeDetailPage />} />
              <Route path="/admin/acts" element={<AdminActsPage />} />
              <Route path="/admin/acts/:actId" element={<AdminActDetailPage />} />
              <Route path="/admin/sections/:sectionId" element={<AdminSectionPage />} />
              <Route path="/admin/import" element={<ImportPage />} />
              <Route path="/admin/caselaws" element={<AdminCaseLawsPage />} />
              <Route path="/admin/caselaws/new" element={<AdminCaseLawFormPage />} />
              <Route path="/admin/caselaws/:caseLawId" element={<AdminCaseLawFormPage />} />
              <Route path="/admin/caselaws/:caseLawId/content" element={<AdminCaseLawContentPage />} />
              <Route path="/admin/audit" element={<AuditLogPage scope="all" />} />
            </Route>

            {/* C_ADMIN */}
            <Route
              element={
                <RequireRole roles={['C_ADMIN']}>
                  <Outlet />
                </RequireRole>
              }
            >
              <Route path="/college" element={<CollegeHomePage />} />
              <Route path="/college/users" element={<UsersPage />} />
              <Route path="/college/users/import" element={<UsersImportPage />} />
              <Route path="/college/users/:userId" element={<UserDetailPage />} />
              <Route path="/college/subjects" element={<SubjectsPage />} />
              <Route path="/college/subjects/:subjectId" element={<SubjectDetailPage />} />
              <Route path="/college/audit" element={<AuditLogPage scope="college" />} />
            </Route>

            {/* C_PROFESSOR */}
            <Route
              element={
                <RequireRole roles={['C_PROFESSOR']}>
                  <Outlet />
                </RequireRole>
              }
            >
              <Route path="/professor" element={<ProfessorHomePage />} />
            </Route>

            {/* C_STUDENT */}
            <Route
              element={
                <RequireRole roles={['C_STUDENT']}>
                  <Outlet />
                </RequireRole>
              }
            >
              <Route path="/student" element={<StudentHomePage />} />
            </Route>
          </Route>
          <Route element={<NotFoundFrame />}>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
