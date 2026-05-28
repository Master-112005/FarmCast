import React, { memo } from "react";
import PropTypes from "prop-types";



const AuthLayout = ({ children }) => {

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
        {}
        <div className="auth-brand" aria-hidden="true" />

        {}
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
