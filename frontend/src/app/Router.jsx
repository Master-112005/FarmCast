/**
 * Router.jsx
 * ------------------------------------------------------
 * FarmCast – Enterprise Routing Kernel
 *
 * Tier: 0 (Application Navigation Core)
 *
 * Responsibilities:
 * - Auth-gated routing
 * - Public-only auth routes
 * - Default route enforcement
 * - Centralized navigation safety
 *
 * Constraints:
 * - No UI styling
 * - No business logic
 * - No backend logic
 */

"use strict";

import React, { memo } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

/* ======================================================
   CONTEXT
====================================================== */

import { useAuth } from "../context/AuthContext";

/* ======================================================
   AUTH PAGES
====================================================== */

import AuthLayout from "../auth/AuthLayout";
import LoginPage from "../auth/LoginPage";
import RegisterPage from "../auth/RegisterPage";

/* ======================================================
   APP PAGES
====================================================== */

import DashboardShell from "./DashboardShell";

/* ======================================================
   LOADING UI (FAIL-SAFE)
====================================================== */

const AppLoadingScreen = () => (
  <div
    className="app-loading-screen"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <p>Loading application…</p>
  </div>
);

/* ======================================================
   ROUTE GUARDS
====================================================== */

/**
 * Blocks access when user is not authenticated
 */
const ProtectedRoute = memo(({ children }) => {
  const { bootstrapping, isAuthenticated } = useAuth();

  if (bootstrapping === true) {
    return <AppLoadingScreen />;
  }

  if (isAuthenticated !== true) {
    return <Navigate to="/login" replace />;
  }

  return children;
});

ProtectedRoute.displayName = "ProtectedRoute";

/**
 * Prevents authenticated users from opening login/register
 */
const PublicOnlyRoute = memo(({ children }) => {
  const { bootstrapping, isAuthenticated } = useAuth();

  if (bootstrapping === true) {
    return <AppLoadingScreen />;
  }

  if (isAuthenticated === true) {
    return <Navigate to="/" replace />;
  }

  return children;
});

PublicOnlyRoute.displayName = "PublicOnlyRoute";

/* ======================================================
   ROUTER
====================================================== */

const Router = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>

        {/* ================= PUBLIC ================= */}

        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <AuthLayout>
                <LoginPage />
              </AuthLayout>
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <AuthLayout>
                <RegisterPage />
              </AuthLayout>
            </PublicOnlyRoute>
          }
        />

        {/* ================= APPLICATION ================= */}

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />

        {/* ================= FALLBACK ================= */}

        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
};

export default Router;
