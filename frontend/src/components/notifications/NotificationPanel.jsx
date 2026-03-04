/**
 * NotificationPanel.jsx
 * ------------------------------------------------------
 * FarmCast - Notification Drawer (UI-only)
 */

import React from "react";
import PropTypes from "prop-types";

const formatNotificationTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NotificationPanel = ({
  isOpen,
  onClose,
  notifications = [],
  onOpenChatFromNotification,
  onClearNotifications,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fc-modal" role="dialog" aria-modal="true">
      <div className="fc-modal__content fc-notifications">
        <header className="fc-notifications__header">
          <h2 className="fc-notifications__title">Notifications</h2>
          <div className="fc-notifications__actions">
            {notifications.length > 0 ? (
              <button
                type="button"
                className="fc-btn fc-btn--neutral"
                onClick={onClearNotifications}
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              className="fc-btn fc-btn--neutral fc-btn--icon"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <span className="material-icons" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </header>

        <div className="fc-notifications__body">
          {notifications.length === 0 ? (
            <div className="fc-empty-state">
              <span className="material-icons" aria-hidden="true">
                notifications_none
              </span>
              <p className="fc-empty">No notifications yet.</p>
            </div>
          ) : (
            <ul className="fc-notifications__list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className="fc-notification-item"
                    onClick={() =>
                      typeof onOpenChatFromNotification ===
                        "function" &&
                      onOpenChatFromNotification(notification)
                    }
                  >
                    <span
                      className="material-icons fc-notification-item__icon"
                      aria-hidden="true"
                    >
                      chat
                    </span>
                    <span className="fc-notification-item__content">
                      <span className="fc-notification-item__title">
                        New message from{" "}
                        {notification.fromName || "User"}
                      </span>
                      <span className="fc-notification-item__text">
                        {notification.text || "Open chat to view message"}
                      </span>
                    </span>
                    <span className="fc-notification-item__time">
                      {formatNotificationTime(
                        notification.createdAt
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

NotificationPanel.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      fromUserId: PropTypes.string,
      fromName: PropTypes.string,
      text: PropTypes.string,
      createdAt: PropTypes.string,
    })
  ),
  onOpenChatFromNotification: PropTypes.func,
  onClearNotifications: PropTypes.func,
};

export default NotificationPanel;
