import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { Permission } from './types';
import { useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoading } from './components/ui/States';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import ProductDetails from './pages/ProductDetails';
import Categories from './pages/Categories';
import Suppliers from './pages/Suppliers';
import Stock from './pages/Stock';
import Orders from './pages/Orders';
import OrderForm from './pages/OrderForm';
import OrderDetails from './pages/OrderDetails';
import Notifications from './pages/Notifications';
import Users from './pages/Users';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Forbidden from './pages/Forbidden';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-navy-950">
        <PageLoading label="Restoring your session" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-navy-950">
        <PageLoading label="Loading SmartStock" />
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/new" element={<ProductForm />} />
        <Route path="/products/:id" element={<ProductDetails />} />
        <Route path="/products/:id/edit" element={<ProductForm />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/stock" element={<Stock />} />
        <Route
          path="/orders"
          element={
            <RequirePermission permission="order:read">
              <Orders />
            </RequirePermission>
          }
        />
        <Route
          path="/orders/new"
          element={
            <RequirePermission permission="order:write">
              <OrderForm />
            </RequirePermission>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequirePermission permission="order:read">
              <OrderDetails />
            </RequirePermission>
          }
        />
        <Route
          path="/orders/:id/edit"
          element={
            <RequirePermission permission="order:write">
              <OrderForm />
            </RequirePermission>
          }
        />
        <Route path="/notifications" element={<Notifications />} />
        <Route
          path="/reports"
          element={
            <RequirePermission permission="analytics:read">
              <Reports />
            </RequirePermission>
          }
        />
        <Route
          path="/users"
          element={
            <RequirePermission permission="user:manage">
              <Users />
            </RequirePermission>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route path="/403" element={<Forbidden />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
