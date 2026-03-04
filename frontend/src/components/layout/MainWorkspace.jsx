/**
 * MainWorkspace.jsx
 * ------------------------------------------------------
 * FarmCast – Enterprise Workspace Engine (SaaS-grade)
 *
 * Responsibilities:
 * - Persistent application layout
 * - Sidebar + Topbar composition
 * - State-driven workspace rendering
 *
 * GUARANTEES:
 * - No routing logic
 * - No URL-based navigation
 * - No business logic
 * - No data fetching
 */

"use strict";

import React, { memo } from "react";
import PropTypes from "prop-types";

/* ===================== LAYOUT ===================== */
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ViewSwitch from "../navigation/ViewSwitch";

/* =====================================================
   COMPONENT
===================================================== */

const MainWorkspace = memo(
  ({
    sidebarCollapsed = false,
    showSidebar = false,
    onToggleSidebar,
    onLogout,
    onProfile,
    onOpenNotifications,
    hasNotificationSignal = false,
    userName = "Farmer",
    activeView = "device",
    headerAside = null,
    children,
  }) => {
    const isCommunityView =
      activeView === "community";

    const shellClassName = showSidebar
      ? sidebarCollapsed
        ? "fc-app-shell fc-app-shell--collapsed"
        : "fc-app-shell"
      : "fc-app-shell fc-app-shell--no-sidebar";

    return (
      <div className={shellClassName}>

        {/* ================= SIDEBAR ================= */}
        {showSidebar && (
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={onToggleSidebar}
            onLogout={onLogout}
            activeView={activeView}
          />
        )}

        {/* ================= MAIN ================= */}
        <div
          className={`fc-main ${
            isCommunityView
              ? "fc-main--community"
              : ""
          }`.trim()}
        >

          {/* ================= TOPBAR ================= */}
          <Topbar
            userName={userName}
            onLogout={onLogout}
            onProfile={onProfile}
            onOpenNotifications={onOpenNotifications}
            hasNotificationSignal={hasNotificationSignal}
            centerContent={<ViewSwitch />}
          />

          {/* ================= CONTENT ================= */}
          <div
            className={`fc-content ${
              isCommunityView
                ? "fc-content--community"
                : ""
            }`.trim()}
          >
            {headerAside ? (
              <div className="fc-content__header fc-content__header--with-aside">
                <div className="fc-content__header-aside">
                  {headerAside}
                </div>
              </div>
            ) : null}

            <main
              className={`fc-workspace ${
                isCommunityView
                  ? "fc-workspace--community"
                  : ""
              }`.trim()}
              role="main"
              aria-label="Application Workspace"
            >
              {children}
            </main>
          </div>

        </div>
      </div>
    );
  }
);

MainWorkspace.displayName = "MainWorkspace";

export default MainWorkspace;

MainWorkspace.propTypes = {
  sidebarCollapsed: PropTypes.bool,
  showSidebar: PropTypes.bool,
  onToggleSidebar: PropTypes.func,
  onLogout: PropTypes.func.isRequired,
  onProfile: PropTypes.func.isRequired,
  onOpenNotifications: PropTypes.func,
  hasNotificationSignal: PropTypes.bool,
  userName: PropTypes.string,
  activeView: PropTypes.oneOf([
    "device",
    "predictor",
    "community",
    "profile",
    "admin",
  ]),
  headerAside: PropTypes.node,
  children: PropTypes.node,
};
