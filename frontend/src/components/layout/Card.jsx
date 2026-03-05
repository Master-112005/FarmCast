"use strict";

import React, { memo } from "react";
import PropTypes from "prop-types";



const VARIANT_CLASS_MAP = {
  default: "fc-card",
  success: "fc-card fc-card--success",
  warning: "fc-card fc-card--warning",
  error: "fc-card fc-card--error",
  neutral: "fc-card fc-card--neutral",
};



const Card = ({
  title = "",
  subtitle = "",
  children = null,

  footer = null,
  actions = [],

  variant = "default",
  isLoading = false,
  ariaLabel = "Content section",
}) => {
  const cardClass =
    VARIANT_CLASS_MAP[variant] ||
    VARIANT_CLASS_MAP.default;

  return (
    <section
      className={cardClass}
      aria-label={ariaLabel}
      aria-busy={isLoading}
    >
      
      {(title || subtitle) && (
        <header className="fc-card__header">
          {title && (
            <h2 className="fc-card__title">
              {title}
            </h2>
          )}

          {subtitle && (
            <p className="fc-card__subtitle">
              {subtitle}
            </p>
          )}
        </header>
      )}

      
      <div className="fc-card__body">
        {isLoading ? (
          <div
            className="fc-card__loading"
            role="status"
            aria-live="polite"
          >
            <span
              className="fc-loader"
              aria-hidden="true"
            />
            <span>Loading…</span>
          </div>
        ) : (
          children
        )}
      </div>

      
      {(footer || actions.length > 0) && (
        <footer className="fc-card__footer">
          {footer && (
            <div className="fc-card__footer-text">
              {footer}
            </div>
          )}

          {actions.length > 0 && (
            <div className="fc-card__actions">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`fc-btn ${
                    action.variant
                      ? `fc-btn--${action.variant}`
                      : "fc-btn--neutral"
                  }`}
                  aria-label={action.label}
                >
                  {action.icon && (
                    <span
                      className="material-icons"
                      aria-hidden="true"
                    >
                      {action.icon}
                    </span>
                  )}

                  <span>{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </footer>
      )}
    </section>
  );
};



Card.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  children: PropTypes.node,

  footer: PropTypes.node,

  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
      icon: PropTypes.string,
      variant: PropTypes.oneOf([
        "primary",
        "success",
        "warning",
        "danger",
        "neutral",
      ]),
      disabled: PropTypes.bool,
    })
  ),

  variant: PropTypes.oneOf([
    "default",
    "success",
    "warning",
    "error",
    "neutral",
  ]),

  isLoading: PropTypes.bool,
  ariaLabel: PropTypes.string,
};



export default memo(Card);
