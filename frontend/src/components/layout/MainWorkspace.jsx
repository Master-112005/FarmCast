"use strict";

import React, { memo } from "react";
import PropTypes from "prop-types";


import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ViewSwitch from "../navigation/ViewSwitch";



const MainWorkspace = memo(
  ({
    sidebarCollapsed = false,
    sidebarOpen = false,
    showSidebar = true,
    isOverlaySidebar = false,
    onToggleSidebar,
    onCloseSidebar,
    onNavigate,
    canAccessAdmin = false,
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

    const shellClassName = [
      "fc-app-shell",
      !showSidebar
        ? "fc-app-shell--no-sidebar"
        : "",
      showSidebar &&
      !isOverlaySidebar &&
      sidebarCollapsed
        ? "fc-app-shell--collapsed"
        : "",
      showSidebar && isOverlaySidebar
        ? "fc-app-shell--overlay"
        : "",
      showSidebar &&
      isOverlaySidebar &&
      sidebarOpen
        ? "fc-app-shell--sidebar-open"
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={shellClassName}>

        {showSidebar &&
          isOverlaySidebar &&
          sidebarOpen && (
            <button
              type="button"
              className="fc-sidebar-backdrop"
              onClick={onCloseSidebar}
              aria-label="Close navigation menu"
            />
          )}

        {showSidebar && (
          <Sidebar
            collapsed={sidebarCollapsed}
            open={sidebarOpen}
            isOverlay={isOverlaySidebar}
            onToggleCollapse={onToggleSidebar}
            onClose={onCloseSidebar}
            onNavigate={onNavigate}
            canAccessAdmin={canAccessAdmin}
            onLogout={onLogout}
            activeView={activeView}
          />
        )}

        
        <div
          className={`fc-main ${
            isCommunityView
              ? "fc-main--community"
              : ""
          }`.trim()}
        >

          
          <Topbar
            userName={userName}
            onLogout={onLogout}
            onProfile={onProfile}
            onToggleSidebar={onToggleSidebar}
            showSidebarToggle={showSidebar}
            isSidebarOpen={
              isOverlaySidebar
                ? sidebarOpen
                : !sidebarCollapsed
            }
            onOpenNotifications={onOpenNotifications}
            hasNotificationSignal={hasNotificationSignal}
            centerContent={<ViewSwitch />}
          />

          
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
  sidebarOpen: PropTypes.bool,
  showSidebar: PropTypes.bool,
  isOverlaySidebar: PropTypes.bool,
  onToggleSidebar: PropTypes.func,
  onCloseSidebar: PropTypes.func,
  onNavigate: PropTypes.func,
  canAccessAdmin: PropTypes.bool,
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
