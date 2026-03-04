/**
 * PredictButton.jsx
 * FarmCast - ML Prediction Trigger Button (Enterprise / SaaS)
 *
 * Responsibilities:
 * - Trigger prediction action
 * - Provide clear loading & disabled feedback
 *
 * No business logic
 * No backend logic
 * No routing
 */

import React from "react";
import PropTypes from "prop-types";

/* ======================================================
   STYLE MAP (DESIGN SYSTEM ONLY)
====================================================== */

const VARIANT_CLASS_MAP = {
  primary: "fc-btn fc-btn--primary",
  secondary: "fc-btn fc-btn--secondary",
  danger: "fc-btn fc-btn--danger",
};

/* ======================================================
   COMPONENT
====================================================== */

const PredictButton = ({
  label = "Run Prediction",
  loadingLabel = "Predicting...",
  onPredict,
  disabled = false,
  isLoading = false,
  variant = "primary",
  showIcon = true,
}) => {
  const isDisabled = disabled || isLoading;

  const handleClick = () => {
    if (isDisabled) return;

    try {
      onPredict();
    } catch (err) {
      // Defensive: prevent UI crash
      console.error("PredictButton error:", err);
    }
  };

  return (
    <button
      type="button"
      className={
        VARIANT_CLASS_MAP[variant] ||
        VARIANT_CLASS_MAP.primary
      }
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={label}
      aria-busy={isLoading}
    >
      {showIcon && (
        <span
          className="material-icons"
          aria-hidden="true"
        >
          {isLoading ? "hourglass_top" : "analytics"}
        </span>
      )}

      {/* LABEL */}
      <span>
        {isLoading ? loadingLabel : label}
      </span>

      {/* LOADER */}
      {isLoading && (
        <span
          className="fc-loader"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

/* ======================================================
   PROPTYPES
====================================================== */

PredictButton.propTypes = {
  label: PropTypes.string,
  loadingLabel: PropTypes.string,
  onPredict: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  isLoading: PropTypes.bool,
  variant: PropTypes.oneOf([
    "primary",
    "secondary",
    "danger",
  ]),
  showIcon: PropTypes.bool,
};

export default PredictButton;
