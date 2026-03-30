import React, { Suspense, lazy } from 'react';
// import { Toaster } from '@/components/ui/toaster'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
// import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import zanaLogo from '@/img/zana_logo_primary.svg';
import ImageWithFallback from '@/components/ui/image-with-fallback';


import PageLoader from '@/components/ui/page-loader';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { CartProvider } from '@/lib/CartContext';
import RequireAdmin from '@/lib/RequireAdmin';

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
		const Support = lazy(() => import('@/pages/Support'));
		const Contact = lazy(() => import('@/pages/Contact'));
		const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
		const CookiesPolicy = lazy(() => import('@/pages/CookiesPolicy'));
			const Terms = lazy(() => import('@/pages/Terms'));
      const NewsletterUnsubscribe = lazy(() => import('@/pages/NewsletterUnsubscribe'));
			const WishlistPage = lazy(() => import('@/pages/Wishlist'));
			const Account = lazy(() => import('@/pages/Account'));
      const Appointments = lazy(() => import('@/pages/Appointments'));
      const MyAppointments = lazy(() => import('@/pages/MyAppointments'));

	// Admin
	const Dashboard = lazy(() => import('@/pages/admin/Dashboard'));
	const AdminProducts = lazy(() => import('@/pages/admin/Products'));
	const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
	const AdminCustomers = lazy(() => import('@/pages/admin/Customers'));
		const AdminLogs = lazy(() => import('@/pages/admin/Logs'));
		const SupportAdmin = lazy(() => import('@/pages/admin/SupportAdmin'));
		const AdminSuppliers = lazy(() => import('@/pages/admin/Suppliers'));
		const AdminPurchases = lazy(() => import('@/pages/admin/Purchases'));
		const AdminInventory = lazy(() => import('@/pages/admin/Inventory'));
		const AdminReports = lazy(() => import('@/pages/admin/Reports'));
		const AdminFinance = lazy(() => import('@/pages/admin/Finance'));
    const LoyaltyAdmin = lazy(() => import('@/pages/admin/LoyaltyAdmin'));
		const AdminCoupons = lazy(() => import('@/pages/admin/Coupons'));
		const AdminSalesTargets = lazy(() => import('@/pages/admin/SalesTargets'));
		const AdminCashClosures = lazy(() => import('@/pages/admin/CashClosures'));
		const AdminReviews = lazy(() => import('@/pages/admin/ReviewsAdmin'));
    const AdminAppointments = lazy(() => import('@/pages/admin/AppointmentsAdmin'));
	const ContentLayout = lazy(() => import('@/pages/admin/ContentLayout'));
	const SettingsLayout = lazy(() => import('@/pages/admin/SettingsLayout'));
	const LandingAdmin = lazy(() => import('@/pages/admin/LandingAdmin'));
	const PaymentSettingsAdmin = lazy(() => import('@/pages/admin/PaymentSettingsAdmin'));
  const ShippingSettingsAdmin = lazy(() => import('@/pages/admin/ShippingSettingsAdmin'));
  const BackupSettingsAdmin = lazy(() => import('@/pages/admin/BackupSettingsAdmin'));
		const BlogAdmin = lazy(() => import('@/pages/admin/BlogAdmin'));
		const BlogCommentsAdmin = lazy(() => import('@/pages/admin/BlogCommentsAdmin'));
		const AboutAdmin = lazy(() => import('@/pages/admin/AboutAdmin'));
			const InstagramAdmin = lazy(() => import('@/pages/admin/InstagramAdmin'));
			const FAQAdmin = lazy(() => import('@/pages/admin/FAQAdmin'));
      const BrandingAdmin = lazy(() => import('@/pages/admin/BrandingAdmin'));
      const MarketingAdmin = lazy(() => import('@/pages/admin/MarketingAdmin'));

const FAQPage = lazy(() => import('@/pages/FAQ'));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <ImageWithFallback
            src={zanaLogo}
            alt="Zana"
            className="h-12 w-auto"
            loading="eager"
            iconClassName="w-12 h-12 text-primary/40"
          />
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
	        <Route path="/suporte" element={<Support />} />
	        <Route path="/contacto" element={<Contact />} />
	        <Route path="/politica-privacidade" element={<PrivacyPolicy />} />
	        <Route path="/cookies" element={<CookiesPolicy />} />
	        <Route path="/termos" element={<Terms />} />
          <Route path="/newsletter/unsubscribe" element={<NewsletterUnsubscribe />} />
		        <Route path="/faq" element={<FAQPage />} />
	        <Route path="/favoritos" element={<WishlistPage />} />
	        <Route path="/conta" element={<Account />} />
          <Route path="/conta/marcacoes" element={<MyAppointments />} />
          <Route path="/marcacoes" element={<Appointments />} />
	      </Route>

      {/* Admin Layout */}
	      <Route
	        element={(
	          <RequireAdmin>
	            <AdminLayout />
	          </RequireAdmin>
	        )}
	      >
	        <Route path="/admin" element={<Dashboard />} />
	        <Route path="/admin/produtos" element={<AdminProducts />} />
	        <Route path="/admin/encomendas" element={<AdminOrders />} />
		        <Route path="/admin/clientes" element={<AdminCustomers />} />
		        <Route path="/admin/suporte" element={<SupportAdmin />} />
		        <Route path="/admin/logs" element={<AdminLogs />} />
	        <Route path="/admin/blog" element={<Navigate to="/admin/conteudo/blog" replace />} />
		        <Route path="/admin/conteudo" element={<ContentLayout />}>
		          <Route index element={<Navigate to="landing" replace />} />
		          <Route path="landing" element={<LandingAdmin />} />
		          <Route path="blog" element={<BlogAdmin />} />
		          <Route path="blog-comentarios" element={<BlogCommentsAdmin />} />
		          <Route path="sobre" element={<AboutAdmin />} />
		          <Route path="instagram" element={<InstagramAdmin />} />
		          <Route path="faq" element={<FAQAdmin />} />
              <Route path="branding" element={<BrandingAdmin />} />
              <Route path="marketing" element={<MarketingAdmin />} />
		        </Route>
		        <Route path="/admin/definicoes" element={<SettingsLayout />}>
		          <Route index element={<Navigate to="pagamentos" replace />} />
		          <Route path="pagamentos" element={<PaymentSettingsAdmin />} />
              <Route path="envios" element={<ShippingSettingsAdmin />} />
              <Route path="backup" element={<BackupSettingsAdmin />} />
		        </Route>
	        <Route path="/admin/fornecedores" element={<AdminSuppliers />} />
	        <Route path="/admin/compras" element={<AdminPurchases />} />
	        <Route path="/admin/inventario" element={<AdminInventory />} />
	        <Route path="/admin/relatorios" element={<AdminReports />} />
	        <Route path="/admin/financeiro" element={<AdminFinance />} />
	        <Route path="/admin/cupons" element={<AdminCoupons />} />
          <Route path="/admin/pontos" element={<LoyaltyAdmin />} />
          <Route path="/admin/marcacoes" element={<AdminAppointments />} />
	        <Route path="/admin/metas-vendas" element={<AdminSalesTargets />} />
	        <Route path="/admin/fecho-de-caixa" element={<AdminCashClosures />} />
	        <Route path="/admin/avaliacoes" element={<AdminReviews />} />
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
          <Toaster richColors closeButton position="top-right" />
        </CartProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
