/**
 * Sidebar.jsx
 * FarmCast – Enterprise Navigation Sidebar (SaaS-grade)
 *
 * Responsibilities:
 * - Primary application navigation
 * - Sidebar collapse/expand
 * - Emit logout intent
 *
 * ❌ No routing logic
 * ❌ No auth logic
 * ❌ No backend logic
 */

import React from "react";
import PropTypes from "prop-types";

/* ======================================================
   NAV CONFIG (LOCKED TO ROUTER)
====================================================== */

const NAV_ITEMS = [
  {
    view: "device", // DeviceView (DEFAULT)
    label: "Devices",
    icon: "devices",
  },
  {
    view: "predictor",
    label: "Predictor",
    icon: "analytics",
  },
  {
    view: "profile",
    label: "Profile",
    icon: "person",
  },
];

/* ======================================================
   COMPONENT
====================================================== */

const Sidebar = ({
  collapsed = false,
  onToggleCollapse,
  onLogout,
  activeView = "device",
}) => {
  return (
    <aside
      className={`fc-sidebar ${
        collapsed ? "fc-sidebar--collapsed" : ""
      }`}
      aria-label="Primary navigation"
    >
      {/* ================= HEADER ================= */}
      <div className="fc-sidebar__header">
        <span className="fc-sidebar__brand">
          {collapsed ? "FC" : "FarmCast"}
        </span>

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="fc-btn fc-btn--icon"
            aria-label="Toggle sidebar"
            aria-expanded={!collapsed}
          >
            <span className="material-icons">
              {collapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        )}
      </div>

      {/* ================= NAV ================= */}
      <nav className="fc-sidebar__nav" role="navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.view;

          return (
            <div
              key={item.view}
              className={`fc-sidebar__link ${
                isActive ? "is-active" : ""
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="material-icons">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="fc-sidebar__label">
                  {item.label}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* ================= FOOTER ================= */}
      <div className="fc-sidebar__footer">
        <button
          type="button"
          onClick={onLogout}
          className="fc-btn fc-btn--danger fc-btn--block"
          aria-label="Logout"
        >
          <span className="material-icons">logout</span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

Sidebar.propTypes = {
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  onLogout: PropTypes.func.isRequired,
  activeView: PropTypes.oneOf([
    "device",
    "predictor",
    "community",
    "profile",
    "admin",
  ]),
};

export default Sidebar;
