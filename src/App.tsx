import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { CompaniesPage } from './pages/CompaniesPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { DiscoverPage } from './pages/DiscoverPage.tsx';
import { GrowthPage } from './pages/GrowthPage.tsx';
import { InternshipDetailPage } from './pages/InternshipDetailPage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { NewsPage } from './pages/NewsPage.tsx';
import { NotificationsPage } from './pages/NotificationsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { SkillMatcherPage } from './pages/SkillMatcherPage.tsx';
import { TrackerPage } from './pages/TrackerPage.tsx';
import { TransparencyPage } from './pages/TransparencyPage.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6FA] flex items-center justify-center text-sm text-[#64748B]">
        Loading workspace...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/internships/:id" element={<InternshipDetailPage />} />
          <Route path="/skills" element={<SkillMatcherPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/companies" element={<CompaniesPage />} />
          <Route path="/transparency" element={<TransparencyPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tracker"
            element={
              <ProtectedRoute>
                <TrackerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/growth"
            element={
              <ProtectedRoute>
                <GrowthPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
