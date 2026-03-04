/**
 * ViewSwitch.jsx
 * FarmCast - Workspace Navigation Switch
 *
 * Responsibilities:
 * - Toggle between Device, Predictor, and Community views
 * - Show Admin view entry for admins
 * - Reflect current ViewContext state
 * - Switch workspace safely without routing
 *
 * No business logic
 * No auth logic
 * No backend logic
 * No routing logic
 */

import React from "react";
import PropTypes from "prop-types";
import { useView } from "../../context/ViewContext";
import { useAuth } from "../../context/AuthContext";

/* ======================================================
   COMPONENT
====================================================== */

const ViewSwitch = ({ disabled = false }) => {
  const { view, setView, VIEWS } = useView();
  const { role } = useAuth();

  const isDeviceView = view === VIEWS.DEVICE;
  const isPredictorView = view === VIEWS.PREDICTOR;
  const isCommunityView =
    view === VIEWS.COMMUNITY;
  const isAdminView = view === VIEWS.ADMIN;
  const canAccessAdmin = role === "admin";

  /* ---------------- HANDLERS ---------------- */

  const goToDevice = () => {
    if (!isDeviceView && !disabled) {
      setView(VIEWS.DEVICE);
    }
  };

  const goToPredictor = () => {
    if (!isPredictorView && !disabled) {
      setView(VIEWS.PREDICTOR);
    }
  };

  const goToAdmin = () => {
    if (
      canAccessAdmin &&
      !isAdminView &&
      !disabled
    ) {
      setView(VIEWS.ADMIN);
    }
  };

  const goToCommunity = () => {
    if (
      !isCommunityView &&
      !disabled
    ) {
      setView(VIEWS.COMMUNITY);
    }
  };


  /* ======================================================
     UI
  ====================================================== */

  return (
    <div
      className="fc-view-switch"
      role="tablist"
      aria-label="Workspace view switch"
    >
      <button
        type="button"
        role="tab"
        aria-selected={isDeviceView}
        onClick={goToDevice}
        disabled={disabled || isDeviceView}
        className={`fc-view-switch__btn ${
          isDeviceView ? "is-active" : ""
        }`}
      >
        <span>Devices</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={isPredictorView}
        onClick={goToPredictor}
        disabled={disabled || isPredictorView}
        className={`fc-view-switch__btn ${
          isPredictorView ? "is-active" : ""
        }`}
      >
        <span>Predictor</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={isCommunityView}
        onClick={goToCommunity}
        disabled={disabled || isCommunityView}
        className={`fc-view-switch__btn ${
          isCommunityView ? "is-active" : ""
        }`}
      >
        <span>Community</span>
      </button>

      {canAccessAdmin && (
        <button
          type="button"
          role="tab"
          aria-selected={isAdminView}
          onClick={goToAdmin}
          disabled={disabled || isAdminView}
          className={`fc-view-switch__btn fc-view-switch__btn--admin ${
            isAdminView ? "is-active" : ""
          }`}
        >
          <span>Admin View</span>
        </button>
      )}

    </div>
  );
};

ViewSwitch.propTypes = {
  disabled: PropTypes.bool,
};

export default ViewSwitch;
