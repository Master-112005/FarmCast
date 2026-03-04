/**
 * App.jsx
 * FarmCast – Root Application Shell (CRITICAL)
 *
 * Responsibilities:
 * - Global error isolation (last line of defense)
 * - Provider orchestration
 * - Routing delegation
 *
 * GUARANTEES:
 * ❌ No UI business logic
 * ❌ No API calls
 * ❌ No CSS imports
 */

import React from "react";
import PropTypes from "prop-types";

import AppProviders from "./AppProviders";
import Router from "./Router";

/* ======================================================
   ERROR FALLBACK UI (SAFE, MINIMAL, ACCESSIBLE)
====================================================== */

const ErrorFallback = ({ onReload }) => (
  <div
    className="fc-card mx-auto mt-24 max-w-md text-center"
    role="alert"
    aria-live="assertive"
  >
    <h1 className="text-xl font-semibold text-gray-800 mb-3">
      Something went wrong
    </h1>

    <p className="text-sm text-gray-600 mb-6">
      An unexpected error occurred.  
      Please reload the application to continue.
    </p>

    <button
      type="button"
      className="fc-btn fc-btn--primary mx-auto"
      onClick={onReload}
      aria-label="Reload application"
    >
      Reload Application
    </button>
  </div>
);

ErrorFallback.propTypes = {
  onReload: PropTypes.func.isRequired,
};

/* ======================================================
   GLOBAL ERROR BOUNDARY
====================================================== */

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    /**
     * Centralized crash reporting hook
     * Replace console.error with:
     * - Sentry
     * - LogRocket
     * - Datadog
     * when moving to production
     */
    console.error("🚨 FarmCast Application Crash", {
      error,
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {
    // Hard reset is safest at root-level failure
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
};

/* ======================================================
   ROOT APPLICATION
====================================================== */

const App = () => {
  return (
    <ErrorBoundary>
      <AppProviders>
        {/*
          Router decides:
          - Auth vs App shell
          - Protected routes
          - Auth-only pages

          ViewContext decides:
          - Default Device view
          - Predictor/Profile switching
        */}
        <Router />
      </AppProviders>
    </ErrorBoundary>
  );
};

export default App;
