/**
 * UserProfile.jsx
 * FarmCast - Enterprise Read-Only User Profile
 *
 * Responsibilities:
 * - Display user identity & farm info
 * - Provide optional account actions
 *
 * No editing
 * No backend calls
 * No routing
 */

import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import { ENV } from "../../utils/constants";
import ActionButtons from "../buttons/ActionButtons";
import DeviceManager from "../device/DeviceManager";

/* ======================================================
   CONSTANTS
====================================================== */

const DEFAULT_PROFILE_IMAGE =
  "/profile-placeholder.svg";

/* ======================================================
   HELPERS
====================================================== */

const isAbsoluteUrl = (value) =>
  /^(https?:|data:|blob:)/i.test(value);

const resolveProfileImage = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_PROFILE_IMAGE;
  }

  if (isAbsoluteUrl(value)) {
    return value;
  }

  const apiBase = ENV.API_BASE_URL || "";
  const base = apiBase.replace(/\/api\/?$/, "");
  if (!base) return value;

  const normalized = value.startsWith("/")
    ? value
    : `/${value}`;

  return `${base}${normalized}`;
};

const noop = () => {};

/* ======================================================
   COMPONENT
====================================================== */

const UserProfile = ({
  name,
  phone,
  email,
  address,
  fieldSize,
  profileImage,
  devices = [],
  showLinkedDevices = false,
  onEdit,
  onAccountAction,
  extraActions,
}) => {
  const canShowAccountActions =
    typeof onAccountAction === "function";
  const hasHeaderActions =
    typeof onEdit === "function" ||
    Boolean(extraActions);
  const [selectedLinkedDeviceId, setSelectedLinkedDeviceId] =
    useState(null);

  const linkedDevices = useMemo(() => {
    if (!Array.isArray(devices)) return [];

    return devices.map((device, index) => {
      const fallbackId =
        device?.deviceId ||
        device?.deviceCode ||
        `linked-device-${index + 1}`;

      return {
        ...device,
        id: device?.id || fallbackId,
      };
    });
  }, [devices]);

  useEffect(() => {
    if (linkedDevices.length === 0) {
      setSelectedLinkedDeviceId(null);
      return;
    }

    const hasSelection = linkedDevices.some(
      (device) =>
        device?.id === selectedLinkedDeviceId
    );

    if (!hasSelection) {
      setSelectedLinkedDeviceId(
        linkedDevices[0]?.id || null
      );
    }
  }, [linkedDevices, selectedLinkedDeviceId]);

  const handleImageError = (event) => {
    if (
      event.currentTarget.src.includes(
        DEFAULT_PROFILE_IMAGE
      )
    ) {
      return;
    }

    event.currentTarget.src =
      DEFAULT_PROFILE_IMAGE;
  };

  return (
    <section
      className="fc-card"
      aria-label="User profile"
    >
      {/* ================= HEADER ================= */}
      <header
        className={`fc-card__header ${
          hasHeaderActions
            ? "fc-card__header--spaced"
            : ""
        }`}
      >
        <h2 className="fc-card__title">
          User Profile
        </h2>
        {hasHeaderActions && (
          <div className="fc-card__actions">
            {typeof onEdit === "function" && (
              <button
                type="button"
                className="fc-btn fc-btn--secondary"
                onClick={onEdit}
              >
                <span className="material-icons" aria-hidden="true">
                  edit
                </span>
                Edit Profile
              </button>
            )}
            {extraActions ? (
              <div className="fc-card__actions-slot">
                {extraActions}
              </div>
            ) : null}
          </div>
        )}
      </header>

      {/* ================= IDENTITY ================= */}
      <div className="fc-profile-header">
        <img
          src={resolveProfileImage(profileImage)}
          alt={`${name || "User"} profile`}
          loading="lazy"
          className="fc-profile-avatar"
          onError={handleImageError}
        />

        <div className="fc-profile-identity">
          <p className="fc-profile-name">
            {name || "-"}
          </p>
          <p className="fc-profile-meta">
            {email || "-"}
          </p>
          <p className="fc-profile-meta">
            {phone || "-"}
          </p>
        </div>
      </div>

      {/* ================= FARM INFO ================= */}
      <div className="fc-profile-section">
        <div className="fc-meta-row">
          <span className="fc-label">Address</span>
          <span className="fc-meta-value">
            {address || "-"}
          </span>
        </div>

        <div className="fc-meta-row">
          <span className="fc-label">Field Size</span>
          <span className="fc-meta-value">
            {fieldSize != null ? fieldSize : "-"}
          </span>
        </div>
      </div>

      {showLinkedDevices && (
        <div className="fc-profile-section">
          <h3 className="fc-section-title">
            Linked Devices
          </h3>

          {Array.isArray(devices) &&
          devices.length > 0 ? (
            <div
              className="fc-linked-devices-manager"
              aria-label="Linked devices"
            >
              <DeviceManager
                devices={linkedDevices}
                selectedId={selectedLinkedDeviceId}
                onSelect={(device) =>
                  setSelectedLinkedDeviceId(
                    device?.id || null
                  )
                }
                currentUserRole="guest"
                allowManageActions={false}
                showSelectorBar
                showHeader={false}
                showAddButton={false}
                showMapToggle
                onAdd={noop}
                onEdit={noop}
                onDelete={noop}
              />
            </div>
          ) : (
            <div
              className="fc-alert fc-alert--neutral"
              role="status"
            >
              No devices linked
            </div>
          )}
        </div>
      )}

      {canShowAccountActions && (
        <div className="fc-profile-section">
          <h3 className="fc-section-title">
            Account Actions
          </h3>
          <p className="fc-meta">
            Security and session management
          </p>
          <ActionButtons
            actions={[
              {
                id: "logout",
                label: "Logout",
                icon: "logout",
                variant: "neutral",
              },
              {
                id: "deleteAccount",
                label: "Delete Account",
                icon: "delete_forever",
                variant: "danger",
                confirm: true,
              },
            ]}
            onAction={onAccountAction}
          />
        </div>
      )}

    </section>
  );
};

/* ======================================================
   PROP TYPES
====================================================== */

UserProfile.propTypes = {
  name: PropTypes.string,
  phone: PropTypes.string,
  email: PropTypes.string,
  address: PropTypes.string,
  fieldSize: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  profileImage: PropTypes.string,
  devices: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      deviceName: PropTypes.string,
      name: PropTypes.string,
      device_type: PropTypes.string,
      type: PropTypes.string,
    })
  ),
  showLinkedDevices: PropTypes.bool,
  onEdit: PropTypes.func,
  onAccountAction: PropTypes.func,
  extraActions: PropTypes.node,
};

export default UserProfile;


