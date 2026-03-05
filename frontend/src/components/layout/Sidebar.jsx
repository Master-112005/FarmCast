import React from "react";
import PropTypes from "prop-types";



const BASE_NAV_ITEMS = [
  {
    view: "device",
    label: "Devices",
    icon: "devices",
  },
  {
    view: "predictor",
    label: "Predictor",
    icon: "analytics",
  },
  {
    view: "community",
    label: "Community",
    icon: "forum",
  },
  {
    view: "profile",
    label: "Profile",
    icon: "person",
  },
];



const Sidebar = ({
  collapsed = false,
  open = false,
  isOverlay = false,
  onToggleCollapse,
  onClose,
  onNavigate,
  canAccessAdmin = false,
  onLogout,
  activeView = "device",
}) => {
  const navItems = canAccessAdmin
    ? [
        ...BASE_NAV_ITEMS,
        {
          view: "admin",
          label: "Admin",
          icon: "shield",
        },
      ]
    : BASE_NAV_ITEMS;

  const navigateTo = (nextView) => {
    if (typeof onNavigate === "function") {
      onNavigate(nextView);
    }
  };

  return (
    <aside
      className={`fc-sidebar ${
        collapsed ? "fc-sidebar--collapsed" : ""
      }`}
      aria-label="Primary navigation"
    >
      
      <div className="fc-sidebar__header">
        <span className="fc-sidebar__brand">
          {collapsed ? "FC" : "FarmCast"}
        </span>

        {!isOverlay && onToggleCollapse && (
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

        {isOverlay && open && (
          <button
            type="button"
            onClick={onClose}
            className="fc-btn fc-btn--icon fc-sidebar__close"
            aria-label="Close sidebar"
          >
            <span className="material-icons">
              close
            </span>
          </button>
        )}
      </div>

      
      <nav className="fc-sidebar__nav" role="navigation">
        {navItems.map((item) => {
          const isActive = activeView === item.view;

          return (
            <button
              key={item.view}
              type="button"
              className={`fc-sidebar__link ${
                isActive ? "is-active" : ""
              }`}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              onClick={() => navigateTo(item.view)}
            >
              <span className="material-icons">
                {item.icon}
              </span>
              {!collapsed && (
                <span className="fc-sidebar__label">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      
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
  open: PropTypes.bool,
  isOverlay: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  onClose: PropTypes.func,
  onNavigate: PropTypes.func,
  canAccessAdmin: PropTypes.bool,
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
