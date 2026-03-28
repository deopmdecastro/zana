import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import { trackPageView } from '@/lib/analytics';

export default function StoreLayout() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + (location.search ?? ''));
  }, [location.pathname, location.search]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
