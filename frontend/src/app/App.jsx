import React from "react";
import PropTypes from "prop-types";

import AppProviders from "./AppProviders";
import Router from "./Router";



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



class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {








    console.error("🚨 FarmCast Application Crash", {
      error,
      componentStack: info?.componentStack,
    });
  }

  handleReload = () => {

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



const App = () => {
  return (
    <ErrorBoundary>
      <AppProviders>
        {








}
        <Router />
      </AppProviders>
    </ErrorBoundary>
  );
};

export default App;
