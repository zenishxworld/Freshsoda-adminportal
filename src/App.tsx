import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRouteAdmin } from './components/ProtectedRouteAdmin';
import { ProtectedRouteDriver } from './components/ProtectedRouteDriver';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DriverLayout } from './layouts/DriverLayout';
import { isWithinAuthGracePeriod } from './lib/utils';

// Admin Pages
import { LoginPage } from './pages/tailadmin/LoginPage';
import { DashboardPage } from './pages/tailadmin/DashboardPage';
import { WarehouseStockPage } from './pages/tailadmin/WarehouseStockPage';
import { AssignStockPage } from './pages/tailadmin/AssignStockPage';
import { RoutesPage } from './pages/tailadmin/RoutesPage';
import { ShopsPage } from './pages/tailadmin/ShopsPage';
import { ExpensesPage } from './pages/tailadmin/ExpensesPage';
import { ReportsPage } from './pages/tailadmin/ReportsPage';
import { SettingsPage } from './pages/tailadmin/SettingsPage';
import { ManageProductsPage } from './pages/tailadmin/ManageProductsPage';
import EndRouteApprovalPage from './pages/tailadmin/EndRouteApprovalPage';

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import StartRouteAssigned from './pages/driver/StartRouteAssigned';
import ShopBilling from './pages/driver/ShopBilling';
import Summary from './pages/driver/Summary';
import BillHistory from './pages/driver/BillHistory';

// Root redirect component - Role-based redirect after authentication
const RootRedirect: React.FC = () => {
  const { role, loading, user } = useAuth();
  const gracefulRole = isWithinAuthGracePeriod() ? (localStorage.getItem('fs_role') as 'admin' | 'driver' | null) : null;

  // If not authenticated, redirect to login immediately (no loading spinner)
  if (!user && !loading) {
    if (gracefulRole === 'admin') return <Navigate to="/admin" replace />;
    if (gracefulRole === 'driver') return <Navigate to="/driver/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  // If authenticated but still loading role, show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-body">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated but no role, redirect to login
  if (!role) {
    if (gracefulRole === 'admin') return <Navigate to="/admin" replace />;
    if (gracefulRole === 'driver') return <Navigate to="/driver/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  // Role-based redirect for authenticated users
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  } else if (role === 'driver') {
    return <Navigate to="/driver/dashboard" replace />;
  }

  // Fallback for invalid role
  return <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Root Route - Role-based redirect */}
      <Route path="/" element={<RootRedirect />} />

      {/* Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRouteAdmin>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/warehouse" element={<WarehouseStockPage />} />
                <Route path="/manage-products" element={<ManageProductsPage />} />
                <Route path="/assign-stock" element={<AssignStockPage />} />
                <Route path="/routes" element={<RoutesPage />} />
                <Route path="/shops" element={<ShopsPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/end-route" element={<EndRouteApprovalPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRouteAdmin>
        }
      />

      {/* Driver Routes */}
      <Route
        path="/driver/*"
        element={
          <ProtectedRouteDriver>
            <Routes>
              <Route path="/" element={<Navigate to="/driver/dashboard" replace />} />
              <Route path="/dashboard" element={<DriverDashboard />} />
              <Route path="/start-route" element={<StartRouteAssigned />} />
              <Route path="/shop-billing" element={<ShopBilling />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/bill-history" element={<BillHistory />} />
            </Routes>
          </ProtectedRouteDriver>
        }
      />

      {/* Fallback - redirect to root */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

