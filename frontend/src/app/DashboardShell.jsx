"use strict";

import React, { memo } from "react";



import Workspace from "../pages/Workspace";
import LoginSplash from "../components/layout/LoginSplash";
import { useAuth } from "../context/AuthContext";



const DashboardShell = memo(() => {
  const { showWelcome, clearWelcome } = useAuth();

  return (
    <div
      className="fc-dashboard-shell"
      role="application"
      aria-label="FarmCast Dashboard"
    >
      <LoginSplash
        visible={showWelcome}
        onDone={clearWelcome}
      />
      <Workspace />
    </div>
  );
});

DashboardShell.displayName = "DashboardShell";

export default DashboardShell;
