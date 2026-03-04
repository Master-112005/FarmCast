/**
 * AdminView.jsx
 * ------------------------------------------------------
 * FarmCast - Dedicated Admin Workspace
 *
 * Responsibilities:
 * - Host admin-only tools
 */

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";

import AdminOverviewCompact from "../components/admin/AdminOverviewCompact";
import AdminPanel from "../components/admin/AdminPanel";
import { getAdminOverview } from "../services/adminService";
import { pingApi } from "../services/api";

const AdminView = ({
  searchQuery = "",
  onSearchQueryChange,
  totalUsers = 0,
  totalDevices = 0,
  onAdminChat,
  onAdminStatsChange,
}) => {
  const [overviewApiAvailable, setOverviewApiAvailable] =
    useState(true);
  const [overview, setOverview] = useState({
    totalUsers: Number(totalUsers) || 0,
    activeUsers: Number(totalUsers) || 0,
    totalDevices: Number(totalDevices) || 0,
    activeDevices: 0,
    backendStatus: "offline",
    backendMessage: "Backend service unavailable",
    mlStatus: "offline",
    mlMessage: "Model service unavailable",
    checkedAt: null,
  });

  useEffect(() => {
    setOverview((previous) => ({
      ...previous,
      totalUsers: Number(totalUsers) || previous.totalUsers || 0,
      totalDevices:
        Number(totalDevices) || previous.totalDevices || 0,
      activeUsers:
        previous.activeUsers ||
        Number(totalUsers) ||
        0,
    }));
  }, [totalUsers, totalDevices]);

  useEffect(() => {
    let isMounted = true;

    const loadOverview = async () => {
      const healthPayload = await pingApi();
      const response = overviewApiAvailable
        ? await getAdminOverview()
        : null;

      const backendHealthStatus = String(
        healthPayload?.status || ""
      )
        .trim()
        .toLowerCase();
      const backendIsOnline =
        backendHealthStatus === "ok" ||
        backendHealthStatus === "online";
      const healthTimestamp =
        healthPayload?.timestamp || null;

      if (!isMounted) {
        return;
      }

      if (
        response?.success === false &&
        (response?.status === 404 ||
          response?.code === "RESOURCE_NOT_FOUND")
      ) {
        setOverviewApiAvailable(false);
        setOverview((previous) => ({
          ...previous,
          totalUsers:
            Number(totalUsers) ||
            previous.totalUsers ||
            0,
          activeUsers:
            Number(totalUsers) ||
            previous.activeUsers ||
            0,
          totalDevices:
            Number(totalDevices) ||
            previous.totalDevices ||
            0,
          backendStatus: backendIsOnline
            ? "online"
            : "offline",
          backendMessage: backendIsOnline
            ? "Backend service reachable"
            : "Backend service unavailable",
          mlStatus: "offline",
          mlMessage:
            "ML status unavailable on this backend version",
          checkedAt:
            healthTimestamp || new Date().toISOString(),
        }));
        return;
      }

      if (!response) {
        setOverview((previous) => ({
          ...previous,
          backendStatus: backendIsOnline
            ? "online"
            : "offline",
          backendMessage: backendIsOnline
            ? "Backend service reachable"
            : "Backend service unavailable",
          checkedAt:
            healthTimestamp || new Date().toISOString(),
        }));
        return;
      }

      if (!response?.success) {
        setOverview((previous) => ({
          ...previous,
          backendStatus: backendIsOnline
            ? "online"
            : "offline",
          backendMessage: backendIsOnline
            ? "Backend service reachable"
            : response?.error ||
              "Backend service unavailable",
          mlStatus: "offline",
          mlMessage: response?.error || "Model service unavailable",
          checkedAt:
            healthTimestamp || new Date().toISOString(),
        }));
        return;
      }

      const data = response.data || {};

      setOverview({
        totalUsers: Number(data.totalUsers) || 0,
        activeUsers:
          Number(data.activeUsers) ||
          Number(data.totalUsers) ||
          0,
        totalDevices: Number(data.totalDevices) || 0,
        activeDevices:
          Number(data.activeDevices) || 0,
        backendStatus: backendIsOnline
          ? "online"
          : String(
              data.backendStatus || "offline"
            ).toLowerCase(),
        backendMessage: backendIsOnline
          ? "Backend service reachable"
          : data.backendMessage ||
            "Backend service unavailable",
        mlStatus:
          String(data.mlStatus || "offline").toLowerCase(),
        mlMessage:
          data.mlMessage || "Model service unavailable",
        checkedAt:
          data.checkedAt ||
          healthTimestamp ||
          new Date().toISOString(),
      });
    };

    loadOverview();
    const intervalId = window.setInterval(
      loadOverview,
      8000
    );

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [overviewApiAvailable, totalUsers, totalDevices]);

  const compactStats = useMemo(
    () => ({
      totalUsers:
        Number(overview.totalUsers) ||
        Number(totalUsers) ||
        0,
      activeUsers:
        Number(overview.activeUsers) ||
        Number(totalUsers) ||
        0,
      totalDevices:
        Number(overview.totalDevices) ||
        Number(totalDevices) ||
        0,
      activeDevices:
        Number(overview.activeDevices) || 0,
      backendStatus: overview.backendStatus,
      backendMessage: overview.backendMessage,
      mlStatus: overview.mlStatus,
      mlMessage: overview.mlMessage,
      checkedAt: overview.checkedAt,
    }),
    [overview, totalUsers, totalDevices]
  );

  return (
    <section className="admin-view" aria-label="Admin workspace">
      <div className="admin-view__overview-wrap">
        <AdminOverviewCompact
          totalUsers={compactStats.totalUsers}
          activeUsers={compactStats.activeUsers}
          totalDevices={compactStats.totalDevices}
          activeDevices={compactStats.activeDevices}
          backendStatus={compactStats.backendStatus}
          backendMessage={compactStats.backendMessage}
          mlStatus={compactStats.mlStatus}
          mlMessage={compactStats.mlMessage}
          checkedAt={compactStats.checkedAt}
          isExpanded
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
        />
      </div>
      <AdminPanel
        searchQuery={searchQuery}
        onChatUser={onAdminChat}
        onStatsChange={onAdminStatsChange}
      />
    </section>
  );
};

AdminView.propTypes = {
  searchQuery: PropTypes.string,
  onSearchQueryChange: PropTypes.func,
  totalUsers: PropTypes.number,
  totalDevices: PropTypes.number,
  onAdminChat: PropTypes.func,
  onAdminStatsChange: PropTypes.func,
};

export default AdminView;



