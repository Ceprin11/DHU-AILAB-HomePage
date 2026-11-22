import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { Suspense } from 'react';
import lazyWithRetry from '@/lib/lazy-with-retry';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import { Skeleton } from '@/components/ui/skeleton';
import { domAnimation, LazyMotion } from 'framer-motion';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const Members = lazyWithRetry(() => import('@/pages/Members'));
const Notifications = lazyWithRetry(() => import('@/pages/Notifications'));
const Awards = lazyWithRetry(() => import('@/pages/Awards'));
const Activities = lazyWithRetry(() => import('@/pages/Activities'));
const Videos = lazyWithRetry(() => import('@/pages/Videos'));
const Join = lazyWithRetry(() => import('@/pages/Join'));
const Recruit = lazyWithRetry(() => import('@/pages/Recruit'));
const QAPage = lazyWithRetry(() => import('@/pages/QAPage'));
const Resources = lazyWithRetry(() => import('@/pages/Resources'));
const Admin = lazyWithRetry(() => import('@/pages/Admin'));
const AdminLogin = lazyWithRetry(() => import('@/pages/AdminLogin'));
const ClubLife = lazyWithRetry(() => import('@/pages/ClubLife'));
const Gallery = lazyWithRetry(() => import('@/pages/Gallery'));
const Contribute = lazyWithRetry(() => import('@/pages/Contribute'));
const AIGuide = lazyWithRetry(() => import('@/pages/AIGuide'));
const MemberCenter = lazyWithRetry(() => import('@/pages/MemberCenter'));
const MemberPasswordChange = lazyWithRetry(() => import('@/pages/MemberPasswordChange'));

const PageLoading = () => (
  <div className="page-shell page-section" role="status" aria-live="polite">
    <span className="sr-only">页面加载中</span>
    <Skeleton className="h-3 w-28" />
    <Skeleton className="mt-5 h-10 w-full max-w-lg" />
    <Skeleton className="mt-4 h-4 w-full max-w-xl" />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex min-h-[100dvh] items-center justify-center bg-background" role="status" aria-live="polite">
        <div className="w-full max-w-xs space-y-4 px-8">
          <span className="sr-only">网站加载中</span>
          <Skeleton className="mx-auto h-10 w-28 rounded-xl" />
          <Skeleton className="mx-auto h-3 w-48" />
          <Skeleton className="mx-auto h-3 w-36" />
        </div>
      </div>
    );
  }

  // Render the main app
  return (
    <Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/member-login" element={<Navigate to="/admin-login" replace />} />
      <Route path="/member-password" element={<MemberPasswordChange />} />
      <Route path="/member-center" element={<MemberCenter />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/members" element={<Members />} />
        <Route path="/ai-guide" element={<AIGuide />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/awards" element={<Awards />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/join" element={<Join />} />
        <Route path="/recruit" element={<Recruit />} />
        <Route path="/recruit/:cohort" element={<Recruit />} />
        <Route path="/recruit/:cohort/:slug" element={<Recruit />} />
        <Route path="/recruit/:cohort/submissions/:submissionId" element={<Recruit />} />
        <Route path="/qa" element={<QAPage />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/club-life" element={<ClubLife />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contribute" element={<Navigate to="/contribute/material" replace />} />
        <Route path="/contribute/material" element={<Contribute type="material" />} />
        <Route path="/contribute/qa" element={<Contribute type="qa" />} />
        <Route path="/contribute/award" element={<Contribute type="award" />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <LazyMotion features={domAnimation} strict>
          <Router>
            <AppErrorBoundary>
              <ScrollToTop />
              <AuthenticatedApp />
            </AppErrorBoundary>
          </Router>
          <Toaster />
        </LazyMotion>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
