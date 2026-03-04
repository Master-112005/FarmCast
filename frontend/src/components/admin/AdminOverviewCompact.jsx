/**
 * AdminOverviewCompact.jsx
 * ------------------------------------------------------
 * FarmCast - Compact admin summary for workspace header
 */

import React from "react";
import PropTypes from "prop-types";

const toServiceState = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "online" ||
    normalized === "ok" ||
    normalized === "up" ||
    normalized === "healthy"
  ) {
    return "online";
  }

  return "offline";
};

const AdminOverviewCompact = ({
  totalUsers = 0,
  activeUsers = 0,
  totalDevices = 0,
  activeDevices = 0,
  backendStatus = "offline",
  backendMessage = "",
  mlStatus = "offline",
  mlMessage = "",
  checkedAt = null,
  isExpanded = false,
  searchQuery = "",
  onSearchQueryChange,
}) => {
  const rootClassName = [
    "fc-admin-overview-compact",
    isExpanded ? "fc-admin-overview-compact--expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const backendState = toServiceState(backendStatus);
  const mlState = toServiceState(mlStatus);

  return (
    <aside
      className={rootClassName}
      aria-label="Admin overview summary"
    >
      <div className="fc-admin-overview-compact__top">
        <div className="fc-admin-overview-compact__head">
          <p className="fc-admin-overview-compact__title">
            Admin Overview
          </p>
          <p className="fc-admin-overview-compact__subtitle">
            Overview of users and devices
          </p>
        </div>

        {isExpanded ? (
          <div
            className="fc-admin-overview-compact__search"
            role="search"
            aria-label="Search users"
          >
            <span
              className="material-icons fc-admin-overview-compact__search-icon"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              className="fc-input fc-admin-overview-compact__search-input"
              placeholder="Search users"
              value={searchQuery}
              onChange={(event) =>
                typeof onSearchQueryChange === "function" &&
                onSearchQueryChange(event.target.value)
              }
              aria-label="Search users"
            />
          </div>
        ) : null}
      </div>

      <div className="fc-admin-overview-compact__stats">
        <div className="fc-admin-overview-compact__stat">
          <span className="fc-admin-overview-compact__label">
            Active Users
          </span>
          <span className="fc-admin-overview-compact__value">
            {activeUsers}
          </span>
        </div>
        <div className="fc-admin-overview-compact__stat">
          <span className="fc-admin-overview-compact__label">
            Active Devices
          </span>
          <span className="fc-admin-overview-compact__value">
            {activeDevices}
          </span>
        </div>
        <div className="fc-admin-overview-compact__stat">
          <span className="fc-admin-overview-compact__label">
            Total Users
          </span>
          <span className="fc-admin-overview-compact__value">
            {totalUsers}
          </span>
        </div>
        <div className="fc-admin-overview-compact__stat">
          <span className="fc-admin-overview-compact__label">
            Total Devices
          </span>
          <span className="fc-admin-overview-compact__value">
            {totalDevices}
          </span>
        </div>
      </div>

      {isExpanded ? (
        <div className="fc-admin-overview-compact__services">
          <div
            className="fc-admin-overview-compact__service"
            title={backendMessage || "Backend service"}
          >
            <span
              className="fc-admin-overview-compact__service-name"
            >
              Backend
            </span>
            <span
              className="fc-admin-overview-compact__service-state"
            >
              <span
                className={`fc-admin-overview-compact__status-dot ${
                  backendState === "online"
                    ? "is-online"
                    : "is-offline"
                }`}
                aria-hidden="true"
              />
              <span>
                {backendState === "online"
                  ? "Online"
                  : "Offline"}
              </span>
            </span>
          </div>

          <div
            className="fc-admin-overview-compact__service"
            title={mlMessage || "ML model service"}
          >
            <span
              className="fc-admin-overview-compact__service-name"
            >
              ML Model
            </span>
            <span
              className="fc-admin-overview-compact__service-state"
            >
              <span
                className={`fc-admin-overview-compact__status-dot ${
                  mlState === "online"
                    ? "is-online"
                    : "is-offline"
                }`}
                aria-hidden="true"
              />
              <span>
                {mlState === "online"
                  ? "Online"
                  : "Offline"}
              </span>
            </span>
          </div>

          {checkedAt ? (
            <span className="fc-admin-overview-compact__checked-at">
              Updated{" "}
              {new Date(checkedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
};

AdminOverviewCompact.propTypes = {
  totalUsers: PropTypes.number,
  activeUsers: PropTypes.number,
  totalDevices: PropTypes.number,
  activeDevices: PropTypes.number,
  backendStatus: PropTypes.string,
  backendMessage: PropTypes.string,
  mlStatus: PropTypes.string,
  mlMessage: PropTypes.string,
  checkedAt: PropTypes.string,
  isExpanded: PropTypes.bool,
  searchQuery: PropTypes.string,
  onSearchQueryChange: PropTypes.func,
};

export default AdminOverviewCompact;
