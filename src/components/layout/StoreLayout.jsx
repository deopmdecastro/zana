import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { trackPageView } from '@/lib/analytics';
import SupportChatWidget from '@/components/support/SupportChatWidget';
import CookieConsent from '@/components/CookieConsent';

export default function StoreLayout() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + (location.search ?? ''));
  }, [location.pathname, location.search]);

  return (
    <div className="h-[var(--app-height,100vh)] overflow-hidden flex flex-col">
      <Navbar />
      <div className="flex-1 overflow-y-auto overflow-x-hidden canvas-scroll">
        <main>
          <Outlet />
        </main>
        <Footer />
      </div>
      <SupportChatWidget />
      <CookieConsent />
    </div>
  );
}
