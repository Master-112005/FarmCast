/**
 * DashboardShell.jsx
 * ------------------------------------------------------
 * FarmCast – Persistent SaaS Application Shell
 *
 * Tier: 1 (Application Frame)
 *
 * Responsibilities:
 * - Hosts the persistent application shell
 * - Provides a stable mount point for the workspace engine
 * - Contains NO routing logic
 * - Contains NO business logic
 * - Contains NO data fetching
 *
 * Guarantees:
 * - Layout never unmounts after login
 * - Workspace swaps do not trigger reload
 * - Predictable rendering tree
 */

"use strict";

import React, { memo } from "react";

/* ======================================================
   CORE LAYOUT ENGINE
====================================================== */

import Workspace from "../pages/Workspace";
import LoginSplash from "../components/layout/LoginSplash";
import { useAuth } from "../context/AuthContext";

/* ======================================================
   COMPONENT
====================================================== */

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
