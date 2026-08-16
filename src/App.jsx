import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Members from '@/pages/Members';
import Notifications from '@/pages/Notifications';
import Awards from '@/pages/Awards';
import Activities from '@/pages/Activities';
import Videos from '@/pages/Videos';
import Join from '@/pages/Join';
import QAPage from '@/pages/QAPage';
import Resources from '@/pages/Resources';
import Admin from '@/pages/Admin';
import AdminLogin from '@/pages/AdminLogin';
import ClubLife from '@/pages/ClubLife';
import AIGuide from '@/pages/AIGuide';
import { Skeleton } from '@/components/ui/skeleton';
// Add page imports here

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
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/members" element={<Members />} />
        <Route path="/ai-guide" element={<AIGuide />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/awards" element={<Awards />} />
        <Route path="/activities" element={<Activities />} />
        <Route path="/videos" element={<Videos />} />
        <Route path="/join" element={<Join />} />
        <Route path="/qa" element={<QAPage />} />
        <Route path="/resources" element={<Resources />} />
        <Route path="/club-life" element={<ClubLife />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
