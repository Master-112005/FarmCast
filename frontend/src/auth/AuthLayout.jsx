/**
 * AuthLayout.jsx
 * FarmCast – Authentication Layout Shell (Enterprise Hardened)
 *
 * Responsibilities:
 * - Provide a consistent, isolated layout for auth pages
 * - Visually separate auth flow from main application
 * - Act as a safe wrapper (no business logic)
 *
 * ❌ No routing logic
 * ❌ No backend logic
 * ❌ No state management
 */

import React, { memo } from "react";
import PropTypes from "prop-types";

/* ======================================================
   AUTH LAYOUT
====================================================== */

const AuthLayout = ({ children }) => {
  // Defensive guard: prevent silent blank screens
  if (!children) {
    if (import.meta.env.MODE !== "production") {
      console.warn("⚠️ AuthLayout rendered without children");
    }
    return null;
  }

  return (
    <div className="auth-layout" role="presentation">
      <div
        className="auth-layout-content"
        aria-label="Authentication"
      >
        {/* Branding Slot (optional via CSS background/logo) */}
        <div className="auth-brand" aria-hidden="true" />

        {/* Auth Page */}
        <section className="auth-container">
          {children}
        </section>
      </div>
    </div>
  );
};

AuthLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default memo(AuthLayout);
