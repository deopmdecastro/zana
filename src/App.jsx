// import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
// import { queryClientInstance } from '@/lib/query-client'
const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';


import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { CartProvider } from '@/lib/CartContext';

// Layouts
import StoreLayout from './components/layout/StoreLayout';
import AdminLayout from './components/layout/AdminLayout';

// Pages
import Home from '@/pages/Home';
import Catalog from '@/pages/Catalog';
import ProductDetail from '@/pages/ProductDetail';
import Cart from '@/pages/Cart';
import Checkout from '@/pages/Checkout';
import About from '@/pages/About';
import Blog from '@/pages/Blog';
import BlogPostPage from '@/pages/BlogPostPage';
import Contact from '@/pages/Contact';
import WishlistPage from '@/pages/Wishlist';
import Account from '@/pages/Account';

// Admin
import Dashboard from '@/pages/admin/Dashboard';
import AdminProducts from '@/pages/admin/Products';
import AdminOrders from '@/pages/admin/Orders';
import AdminCustomers from '@/pages/admin/Customers';
import BlogAdmin from '@/pages/admin/BlogAdmin';

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
          <Router>
            <AuthenticatedApp />
          </Router>
  {/* <Toaster /> */}
        </CartProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App