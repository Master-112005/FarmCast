/**
 * ProfileButton.jsx
 * FarmCast - Profile Navigation Control
 *
 * Responsibilities:
 * - Navigate user to Profile view
 * - Optionally expose logout intent
 *
 * No auth logic
 * No backend logic
 */

import React from "react";
import PropTypes from "prop-types";

/* ======================================================
   COMPONENT
====================================================== */

const ProfileButton = ({
  userName = "User",
  showName = true,
  onLogout,
  onProfile,
}) => {
  const handleProfileClick = () => {
    if (typeof onProfile === "function") {
      onProfile();
    }
  };

  return (
    <div className="fc-profile-button">
      {/* PROFILE */}
      <button
        type="button"
        onClick={handleProfileClick}
        className="fc-btn fc-btn--neutral"
        aria-label="Go to profile"
      >
        <span
          className="material-icons"
          aria-hidden="true"
        >
          account_circle
        </span>

        {showName && (
          <span className="fc-profile-button__name">
            {userName}
          </span>
        )}
      </button>

      {/* LOGOUT (OPTIONAL) */}
      {typeof onLogout === "function" && (
        <button
          type="button"
          onClick={onLogout}
          className="fc-btn fc-btn--danger"
          aria-label="Logout"
        >
          <span
            className="material-icons"
            aria-hidden="true"
          >
            logout
          </span>
        </button>
      )}
    </div>
  );
};

ProfileButton.propTypes = {
  userName: PropTypes.string,
  showName: PropTypes.bool,
  onLogout: PropTypes.func,
  onProfile: PropTypes.func.isRequired,
};

export default ProfileButton;
