"use strict";

import React from "react";
import PropTypes from "prop-types";



import { AuthProvider } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";
import { ViewProvider } from "../context/ViewContext";

const isProd = import.meta.env.MODE === "production";



class ProviderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error(
      "[AppProviders] Crash:",
      error,
      info
    );
  }

  render() {
    if (this.state.hasError) {
      // Fail closed in production, fail loud in dev
      if (!isProd) {
        return (
          <pre style={{ color: "red" }}>
            AppProviders crashed. Check console.
          </pre>
        );
      }
      return null;
    }

    return this.props.children;
  }
}



/**
 * Provider order is STRICT and intentional:
 *
 * 1. AuthProvider
 * 2. SocketProvider
 * 3. ViewProvider
 */
const AppProviders = ({ children }) => {
  if (children === undefined || children === null) {
    if (!isProd) {
      throw new Error(
        "❌ AppProviders requires children. Check App.jsx composition."
      );
    }
    return null;
  }

  return (
    <ProviderErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <ViewProvider>
            {children}
          </ViewProvider>
        </SocketProvider>
      </AuthProvider>
    </ProviderErrorBoundary>
  );
};

AppProviders.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AppProviders;
