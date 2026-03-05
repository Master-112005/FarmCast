import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import Card from "../layout/Card";
import UserProfile from "../profile/UserProfile";
import {
  getAdminUsers,
  deleteAdminUser,
  getAdminUserPredictionHistory,
} from "../../services/adminService";

const formatPredictionType = (value) => {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();

  if (!normalized) return "Prediction";

  return normalized
    .split("_")
    .map(
      (token) =>
        token.charAt(0).toUpperCase() +
        token.slice(1)
    )
    .join(" ");
};

const formatHistoryTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
};

const AdminPanel = ({
  searchQuery = "",
  onChatUser,
  onStatsChange,
}) => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingUserId, setDeletingUserId] =
    useState(null);
  const [actionError, setActionError] =
    useState("");
  const [actionSuccess, setActionSuccess] =
    useState("");
  const [predictionHistory, setPredictionHistory] =
    useState([]);
  const [
    predictionHistoryLoading,
    setPredictionHistoryLoading,
  ] = useState(false);
  const [
    predictionHistoryError,
    setPredictionHistoryError,
  ] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      setLoading(true);
      setError("");

      const response = await getAdminUsers();

      if (!isMounted) return;

      if (!response?.success) {
        setError(
          response?.error ||
            "Unable to load user overview."
        );
        setLoading(false);
        return;
      }

      const list = Array.isArray(response.data)
        ? response.data
        : [];

      setUsers(list);
      if (list.length > 0) {
        setSelectedUserId((prev) => prev || list[0].id);
      }
      setLoading(false);
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedQuery = String(searchQuery || "")
    .trim()
    .toLowerCase();

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return users;

    return users.filter((user) => {
      const searchableText = [
        user?.name,
        user?.email,
        user?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        normalizedQuery
      );
    });
  }, [users, normalizedQuery]);

  const selectedUser = useMemo(
    () =>
      filteredUsers.find(
        (user) => user.id === selectedUserId
      ) || null,
    [filteredUsers, selectedUserId]
  );

  const totals = useMemo(() => {
    const totalUsers = users.length;
    const totalDevices = users.reduce((sum, user) => {
      const count =
        user.deviceCount ??
        user.devices?.length ??
        0;
      return sum + count;
    }, 0);

    return { totalUsers, totalDevices };
  }, [users]);

  useEffect(() => {
    if (typeof onStatsChange === "function") {
      onStatsChange(totals);
    }
  }, [onStatsChange, totals]);

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }

    const hasSelected = filteredUsers.some(
      (user) => user.id === selectedUserId
    );

    if (!hasSelected) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  useEffect(() => {
    let isMounted = true;

    const loadPredictionHistory = async () => {
      if (!selectedUserId) {
        setPredictionHistory([]);
        setPredictionHistoryError("");
        setPredictionHistoryLoading(false);
        return;
      }

      setPredictionHistoryLoading(true);
      setPredictionHistoryError("");

      const response =
        await getAdminUserPredictionHistory(
          selectedUserId,
          12
        );

      if (!isMounted) return;

      if (!response?.success) {
        setPredictionHistory([]);
        setPredictionHistoryError(
          response?.error ||
            "Unable to load prediction history."
        );
        setPredictionHistoryLoading(false);
        return;
      }

      const list = Array.isArray(response.data)
        ? response.data
        : [];

      setPredictionHistory(list);
      setPredictionHistoryLoading(false);
    };

    loadPredictionHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedUserId]);

  const handleDeleteUser = async () => {
    if (!selectedUser?.id || deletingUserId) return;

    const deletionMessage = window.prompt(
      `Enter the message to send to ${selectedUser.email || "this user"} before deletion:`
    );

    if (deletionMessage === null) return;

    const normalizedMessage = String(
      deletionMessage
    ).trim();

    if (normalizedMessage.length < 5) {
      setActionError(
        "Deletion message must be at least 5 characters."
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedUser.name || "this user"} permanently?`
    );

    if (!confirmed) return;

    setActionError("");
    setActionSuccess("");
    setDeletingUserId(selectedUser.id);

    const response = await deleteAdminUser(
      selectedUser.id,
      normalizedMessage
    );

    if (!response?.success) {
      setActionError(
        response?.error ||
          "Unable to delete user."
      );
      setDeletingUserId(null);
      return;
    }

    const remainingUsers = users.filter(
      (user) => user.id !== selectedUser.id
    );

    const notificationDelivered =
      response?.data?.notification?.delivered === true;
    const notificationAttempted =
      response?.data?.notification?.attempted === true;

    setUsers(remainingUsers);
    setSelectedUserId(remainingUsers[0]?.id || null);
    if (notificationAttempted && notificationDelivered) {
      setActionSuccess(
        "User deleted and notification email sent."
      );
    } else if (
      notificationAttempted &&
      !notificationDelivered
    ) {
      const notificationReason =
        response?.data?.notification?.message;
      setActionSuccess(
        notificationReason
          ? `User deleted, but notification email failed: ${notificationReason}`
          : "User deleted, but notification email could not be delivered."
      );
    } else {
      setActionSuccess(
        "User deleted successfully."
      );
    }
    setDeletingUserId(null);
  };

  return (
    <section className="fc-admin-panel" aria-label="Admin overview">
      <div className="fc-admin-panel__grid">
        <div className="fc-admin-panel__left">
          <Card
            title="User Directory"
            subtitle="Select a user to view device counts and profile"
          >
            {loading ? (
              <div className="fc-loading" aria-busy="true">
                Loading users...
              </div>
            ) : error ? (
              <div className="fc-alert fc-alert--error">{error}</div>
            ) : users.length === 0 ? (
              <div className="fc-empty-state">
                <span className="material-icons" aria-hidden="true">
                  group
                </span>
                <p className="fc-empty">No users found.</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="fc-empty-state">
                <span className="material-icons" aria-hidden="true">
                  search_off
                </span>
                <p className="fc-empty">
                  No users match your search.
                </p>
              </div>
            ) : (
              <ul className="fc-admin-user-list" aria-label="Users">
                {filteredUsers.map((user) => {
                  const deviceCount =
                    user.deviceCount ?? user.devices?.length ?? 0;
                  const isActive = user.id === selectedUserId;

                  return (
                    <li key={user.id}>
                      <button
                        type="button"
                        className={`fc-admin-user ${
                          isActive ? "is-active" : ""
                        }`}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        <div className="fc-admin-user__meta">
                          <span className="fc-admin-user__name">
                            {user.name || "Unnamed user"}
                          </span>
                          <span className="fc-admin-user__email">
                            {user.email || "-"}
                          </span>
                        </div>
                        <span className="fc-admin-user__devices">
                          {deviceCount} devices
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="Prediction History"
            subtitle={
              selectedUser
                ? `Recent predictions for ${selectedUser.name || "selected user"}`
                : "Select a user to view prediction history"
            }
          >
            {!selectedUser ? (
              <div className="fc-empty-state">
                <span className="material-icons" aria-hidden="true">
                  timeline
                </span>
                <p className="fc-empty">
                  Select a user to view prediction history.
                </p>
              </div>
            ) : predictionHistoryLoading ? (
              <div className="fc-loading" aria-busy="true">
                Loading prediction history...
              </div>
            ) : predictionHistoryError ? (
              <div className="fc-alert fc-alert--error">
                {predictionHistoryError}
              </div>
            ) : predictionHistory.length === 0 ? (
              <div className="fc-empty-state">
                <span className="material-icons" aria-hidden="true">
                  insights
                </span>
                <p className="fc-empty">
                  No prediction history found for this user.
                </p>
              </div>
            ) : (
              <ul
                className="fc-admin-history-list"
                aria-label="User prediction history"
              >
                {predictionHistory.map((entry) => {
                  const status = String(
                    entry?.status || "success"
                  ).toLowerCase();
                  const statusClass =
                    status === "failed"
                      ? "fc-badge fc-badge--danger"
                      : "fc-badge fc-badge--success";
                  const typeClass = `fc-admin-history-item__type fc-admin-history-item__type--${String(
                    entry?.predictionType || ""
                  ).toLowerCase()}`;

                  return (
                    <li
                      key={entry?.id || `${entry?.createdAt}-${entry?.predictionType}`}
                      className="fc-admin-history-item"
                    >
                      <div className="fc-admin-history-item__header">
                        <span className={typeClass}>
                          {formatPredictionType(
                            entry?.predictionType
                          )}
                        </span>
                        <span className={statusClass}>
                          {status}
                        </span>
                      </div>
                      <p className="fc-admin-history-item__summary">
                        {entry?.summary ||
                          "Prediction completed."}
                      </p>
                      <div className="fc-admin-history-item__meta">
                        <span>
                          {formatHistoryTime(
                            entry?.createdAt
                          )}
                        </span>
                        {entry?.requestId ? (
                          <span className="fc-mono">
                            {entry.requestId}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="fc-admin-panel__detail">
          {actionSuccess && (
            <div className="fc-alert fc-alert--success">
              {actionSuccess}
            </div>
          )}
          {actionError && (
            <div className="fc-alert fc-alert--error">
              {actionError}
            </div>
          )}
          {selectedUser ? (
            <>
              <UserProfile
                name={selectedUser.name}
                email={selectedUser.email}
                phone={selectedUser.phone}
                address={selectedUser.address}
                fieldSize={selectedUser.fieldSize}
                profileImage={selectedUser.profileImage}
                devices={selectedUser.devices || []}
                showLinkedDevices
                extraActions={
                  <div className="fc-admin-panel__actions">
                    <button
                      type="button"
                      className="fc-btn fc-btn--secondary"
                      disabled={Boolean(deletingUserId)}
                      onClick={() =>
                        typeof onChatUser === "function" &&
                        onChatUser(selectedUser)
                      }
                    >
                      <span className="material-icons" aria-hidden="true">
                        chat
                      </span>
                      Chat with user
                    </button>
                    <button
                      type="button"
                      className="fc-btn fc-btn--danger"
                      disabled={Boolean(deletingUserId)}
                      onClick={handleDeleteUser}
                    >
                      <span className="material-icons" aria-hidden="true">
                        delete
                      </span>
                      {deletingUserId === selectedUser.id
                        ? "Deleting..."
                        : "Delete user"}
                    </button>
                  </div>
                }
              />
            </>
          ) : (
            <div className="fc-empty-state">
              <span className="material-icons" aria-hidden="true">
                person_search
              </span>
              <p className="fc-empty">
                Select a user to view details.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

AdminPanel.propTypes = {
  searchQuery: PropTypes.string,
  onChatUser: PropTypes.func,
  onStatsChange: PropTypes.func,
};

export default AdminPanel;


