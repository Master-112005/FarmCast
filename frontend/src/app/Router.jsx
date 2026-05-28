"use strict";

import React, { memo } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";



import { useAuth } from "../context/AuthContext";



import AuthLayout from "../auth/AuthLayout";
import LoginPage from "../auth/LoginPage";
import RegisterPage from "../auth/RegisterPage";



import DashboardShell from "./DashboardShell";



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



const Router = () => {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>

        

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

        

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardShell />
            </ProtectedRoute>
          }
        />

        

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
