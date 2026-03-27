import React, { Suspense, lazy } from 'react';
// import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
// import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';


import PageLoader from '@/components/ui/page-loader';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { CartProvider } from '@/lib/CartContext';

const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageNotFound = lazy(() => import('./lib/PageNotFound'));

// Layouts
const StoreLayout = lazy(() => import('@/components/layout/StoreLayout'));
const AdminLayout = lazy(() => import('@/components/layout/AdminLayout'));

// Pages
const Home = lazy(() => import('@/pages/Home'));
const Catalog = lazy(() => import('@/pages/Catalog'));
const ProductDetail = lazy(() => import('@/pages/ProductDetail'));
const Cart = lazy(() => import('@/pages/Cart'));
const Checkout = lazy(() => import('@/pages/Checkout'));
const About = lazy(() => import('@/pages/About'));
const Blog = lazy(() => import('@/pages/Blog'));
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage'));
const Contact = lazy(() => import('@/pages/Contact'));
const WishlistPage = lazy(() => import('@/pages/Wishlist'));
const Account = lazy(() => import('@/pages/Account'));

// Admin
const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('@/pages/admin/Products'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminCustomers = lazy(() => import('@/pages/admin/Customers'));
const BlogAdmin = lazy(() => import('@/pages/admin/BlogAdmin'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <span className="font-heading text-xl tracking-[0.3em] text-primary">ZANA</span>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Store Layout */}
      <Route element={<StoreLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/catalogo" element={<Catalog />} />
        <Route path="/produto/:id" element={<ProductDetail />} />
        <Route path="/carrinho" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/sobre" element={<About />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:id" element={<BlogPostPage />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="/favoritos" element={<WishlistPage />} />
        <Route path="/conta" element={<Account />} />
      </Route>

      {/* Admin Layout */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/produtos" element={<AdminProducts />} />
        <Route path="/admin/encomendas" element={<AdminOrders />} />
        <Route path="/admin/clientes" element={<AdminCustomers />} />
        <Route path="/admin/blog" element={<BlogAdmin />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <CartProvider>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader label="A carregar..." />}>
              <AuthenticatedApp />
            </Suspense>
          </Router>
  {/* <Toaster /> */}
        </CartProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
