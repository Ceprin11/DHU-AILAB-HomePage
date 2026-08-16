import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import { PageMotion } from '@/components/motion/MotionPrimitives';

export default function Layout() {
  const location = useLocation();
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1 overflow-x-clip">
        <AnimatePresence mode="wait" initial={false}>
          <PageMotion key={location.pathname}>
            <Outlet />
          </PageMotion>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}
