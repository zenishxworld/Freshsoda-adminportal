import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProtectedRouteAdmin } from './components/ProtectedRouteAdmin';
import { ProtectedRouteDriver } from './components/ProtectedRouteDriver';
import { DashboardLayout } from './layouts/DashboardLayout';
import { DriverLayout } from './layouts/DriverLayout';

// Admin Pages
import { LoginPage } from './pages/tailadmin/LoginPage';
import { DashboardPage } from './pages/tailadmin/DashboardPage';
import { WarehouseStockPage } from './pages/tailadmin/WarehouseStockPage';
import { AssignStockPage } from './pages/tailadmin/AssignStockPage';
import { RoutesPage } from './pages/tailadmin/RoutesPage';
import { DriversPage } from './pages/tailadmin/DriversPage';
import { ShopsPage } from './pages/tailadmin/ShopsPage';
import { ExpensesPage } from './pages/tailadmin/ExpensesPage';
import { ReportsPage } from './pages/tailadmin/ReportsPage';
import { SettingsPage } from './pages/tailadmin/SettingsPage';
import { ManageProductsPage } from './pages/tailadmin/ManageProductsPage';

// Driver Pages
import DriverDashboard from './pages/driver/DriverDashboard';
import StartRoute from './pages/driver/StartRoute';
import ShopBilling from './pages/driver/ShopBilling';
import Summary from './pages/driver/Summary';
import AddProduct from './pages/driver/AddProduct';
import BillHistory from './pages/driver/BillHistory';

// Root redirect component - TEMPORARY: Direct to admin for testing
const RootRedirect: React.FC = () => {
  // Skip authentication, go directly to admin portal
  return <Navigate to="/admin" replace />;

  /*
  const { role, loading } = useAuth();

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

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  } else if (role === 'driver') {
    return <Navigate to="/driver/start-route" replace />;
  }

  return <Navigate to="/login" replace />;
  */
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
                <Route path="/drivers" element={<DriversPage />} />
                <Route path="/shops" element={<ShopsPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/reports" element={<ReportsPage />} />
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
              <Route path="/start-route" element={<StartRoute />} />
              <Route path="/shop-billing" element={<ShopBilling />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/add-product" element={<AddProduct />} />
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

