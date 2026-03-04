/**
 * ActionButtons.jsx
 * FarmCast – Grouped Action Controls (Enterprise / SaaS)
 *
 * Responsibilities:
 * - Render grouped action buttons
 * - Emit action intent safely
 * - Protect destructive actions with confirmation
 *
 * ❌ No backend logic
 * ❌ No routing
 * ❌ No auth logic
 */

import React from "react";
import PropTypes from "prop-types";

/* ======================================================
   DEFAULT ACTIONS (SAFE PRESET)
====================================================== */

const DEFAULT_ACTIONS = [
  { id: "sendMail", label: "Send to Mail", icon: "mail", variant: "primary" },
  { id: "screenshot", label: "Screenshot", icon: "photo_camera", variant: "secondary" },
  { id: "edit", label: "Edit", icon: "edit", variant: "warning" },
  { id: "delete", label: "Delete", icon: "delete", variant: "danger", confirm: true },
];

/* ======================================================
   VARIANT → CLASS MAP (DESIGN SYSTEM)
====================================================== */

const VARIANT_CLASS_MAP = {
  primary: "fc-btn fc-btn--primary",
  secondary: "fc-btn fc-btn--secondary",
  warning: "fc-btn fc-btn--warning",
  danger: "fc-btn fc-btn--danger",
  neutral: "fc-btn fc-btn--neutral",
};

/* ======================================================
   COMPONENT
====================================================== */

const ActionButtons = ({
  actions = DEFAULT_ACTIONS,
  onAction,
  disabledActions = [],
  isLoading = false,
}) => {
  const handleAction = (action) => {
    if (
      isLoading ||
      disabledActions.includes(action.id)
    ) {
      return;
    }

    if (action.confirm) {
      const confirmed = window.confirm(
        `Are you sure you want to ${action.label.toLowerCase()}?`
      );
      if (!confirmed) return;
    }

    try {
      onAction(action.id);
    } catch (err) {
      // Defensive: prevent UI crash
      console.error(
        "❌ ActionButtons error:",
        err
      );
    }
  };

  return (
    <div
      className="fc-action-group"
      role="group"
      aria-label="Action buttons"
    >
      {actions.map((action) => {
        const isDisabled =
          isLoading ||
          disabledActions.includes(action.id);

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => handleAction(action)}
            disabled={isDisabled}
            className={
              VARIANT_CLASS_MAP[action.variant] ||
              VARIANT_CLASS_MAP.neutral
            }
            aria-label={action.label}
          >
            <span
              className="material-icons"
              aria-hidden="true"
            >
              {action.icon || "help_outline"}
            </span>

            <span>
              {isLoading
                ? "Processing…"
                : action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ======================================================
   PROPTYPES
====================================================== */

ActionButtons.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string,
      variant: PropTypes.oneOf([
        "primary",
        "secondary",
        "warning",
        "danger",
        "neutral",
      ]),
      confirm: PropTypes.bool,
    })
  ),
  onAction: PropTypes.func.isRequired,
  disabledActions: PropTypes.arrayOf(
    PropTypes.string
  ),
  isLoading: PropTypes.bool,
};

export default ActionButtons;
