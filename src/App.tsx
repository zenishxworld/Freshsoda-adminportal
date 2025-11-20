import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
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

function App() {
  // TODO: Replace with actual authentication logic
  const isAuthenticated = true;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />

        {/* Protected Routes */}
        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/warehouse" element={<WarehouseStockPage />} />
                  <Route path="/assign-stock" element={<AssignStockPage />} />
                  <Route path="/routes" element={<RoutesPage />} />
                  <Route path="/drivers" element={<DriversPage />} />
                  <Route path="/shops" element={<ShopsPage />} />
                  <Route path="/expenses" element={<ExpensesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </DashboardLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
