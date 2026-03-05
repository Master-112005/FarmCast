import React from "react";
import PropTypes from "prop-types";
import ProfileButton from "../navigation/ProfileButton";



const Topbar = ({
  userName = "User",
  onLogout,
  onProfile,
  onOpenNotifications,
  hasNotificationSignal = false,
  centerContent = null,
}) => {
  const brand = "FarmCast";

  

  return (
    <header
      className="fc-topbar"
      role="banner"
      aria-label="Application Header"
    >
      
      <div className="fc-topbar__brand" aria-label={brand}>
        <img
          className="fc-topbar__brand-logo"
          src="/farmcast-logo.png"
          alt="FarmCast logo"
          loading="eager"
          onError={(event) => {
            event.currentTarget.src =
              "/profile-placeholder.svg";
          }}
        />
        <span className="fc-topbar__brand-text">
          {brand}
        </span>
      </div>

      
      <div className="fc-topbar__center">
        {centerContent}
      </div>

      
      <div className="fc-topbar__actions">
        <div className="fc-topbar__icon-actions">
          <button
            type="button"
            className={`fc-btn fc-btn--neutral fc-btn--icon fc-topbar__icon-btn ${
              hasNotificationSignal ? "has-signal" : ""
            }`}
            aria-label="Notifications"
            onClick={onOpenNotifications}
          >
            <span
              className="material-icons"
              aria-hidden="true"
            >
              notifications
            </span>
          </button>

        </div>
        <ProfileButton
          userName={userName}
          onProfile={onProfile}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
};

Topbar.propTypes = {
  userName: PropTypes.string,
  onLogout: PropTypes.func.isRequired,
  onProfile: PropTypes.func.isRequired,
  onOpenNotifications: PropTypes.func,
  hasNotificationSignal: PropTypes.bool,
  centerContent: PropTypes.node,
};

export default Topbar;
