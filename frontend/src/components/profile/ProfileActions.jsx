import React from "react";
import PropTypes from "prop-types";



const confirmAction = (message, action) => {
  const ok = window.confirm(message);
  if (ok) action();
};



const ProfileActions = ({
  currentUserRole = "user",
  onEdit,
  onExport,
  onLogout,
  onDelete,
  isLoading = false,
}) => {
  const isDisabled = isLoading;
  const canDelete =
    currentUserRole === "admin" ||
    currentUserRole === "user";

  return (
    <section
      className="fc-card"
      aria-label="Profile actions"
    >
      
      <header className="fc-card__header">
        <h2 className="fc-card__title">
          Profile Actions
        </h2>
      </header>

      
      <div className="fc-card__actions fc-card__actions--stacked">

        {/* Edit Profile */}
        <button
          type="button"
          className="fc-btn fc-btn--secondary"
          disabled={isDisabled}
          onClick={onEdit}
          aria-label="Edit profile"
        >
          <span
            className="material-icons"
            aria-hidden="true"
          >
            edit
          </span>
          Edit Profile
        </button>

        {/* Export Profile */}
        <button
          type="button"
          className="fc-btn fc-btn--primary"
          disabled={isDisabled}
          onClick={onExport}
          aria-label="Export profile data"
        >
          <span
            className="material-icons"
            aria-hidden="true"
          >
            file_download
          </span>
          Export Data
        </button>

        {/* Logout */}
        <button
          type="button"
          className="fc-btn fc-btn--neutral"
          disabled={isDisabled}
          onClick={() =>
            confirmAction(
              "Are you sure you want to log out?",
              onLogout
            )
          }
          aria-label="Logout"
        >
          <span
            className="material-icons"
            aria-hidden="true"
          >
            logout
          </span>
          Logout
        </button>

        {/* Delete Account (Admin only) */}
        {canDelete && (
          <button
            type="button"
            className="fc-btn fc-btn--danger"
            disabled={isDisabled}
            onClick={() =>
              confirmAction(
                "This will permanently delete the user profile and all associated data. This action cannot be undone. Continue?",
                onDelete
              )
            }
            aria-label="Delete user profile"
            aria-busy={isLoading}
          >
            <span
              className="material-icons"
              aria-hidden="true"
            >
              delete
            </span>
            {isLoading ? "Deleting…" : "Delete Profile"}
          </button>
        )}
      </div>

      
      {isLoading && (
        <div
          className="fc-loading"
          role="status"
          aria-live="polite"
        >
          <span className="fc-loader" aria-hidden />
          Processing profile action…
        </div>
      )}
    </section>
  );
};



ProfileActions.propTypes = {
  currentUserRole: PropTypes.oneOf([
    "admin",
    "user",
    "guest",
  ]),
  onEdit: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default ProfileActions;
