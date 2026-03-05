"use strict";

import React, { memo } from "react";
import PropTypes from "prop-types";
import DeviceCard from "./DeviceCard";



const normalizeDevice = (device) => ({
  id: device?.id ?? "",
  deviceId:
    device?.deviceId ||
    device?.deviceCode ||
    device?.id ||
    "N/A",
  deviceName:
    device?.deviceName ||
    device?.name ||
    "Unnamed Device",

  deviceType:
    device?.deviceType ||
    device?.device_type ||
    device?.type ||
    "Unknown",

  firmwareVersion:
    device?.firmwareVersion ||
    device?.firmware_version ||
    "—",

  connectivityType:
    device?.connectivityType ||
    "unknown",

  deviceStatus:
    device?.deviceStatus ||
    device?.device_status ||
    device?.status ||
    "offline",

  trustLevel:
    device?.trustLevel ||
    device?.trust_level ||
    "unverified",

  lastSeenAt: device?.lastSeenAt || null,
  cropType:
    device?.cropType ||
    device?.crop_type ||
    null,

  soilType: device?.soilType || null,
});



const DeviceManager = ({
  devices = [],
  currentUserRole = "guest",
  selectedId = null,
  deletingDeviceId = null,
  allowManageActions = true,
  showSelectorBar = false,
  showHeader = true,
  showAddButton = true,
  showMapToggle = false,
  title = "Device Manager",
  addButtonLabel = "Add Device",
  addButtonIcon = "add",
  addEmptyButtonLabel = "Add your first device",
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}) => {
  /* ---------------- RBAC ---------------- */

  const canAdd =
    currentUserRole === "admin" ||
    currentUserRole === "user";

  const canEdit = canAdd && allowManageActions;
  const canDelete =
    (currentUserRole === "admin" ||
      currentUserRole === "user") &&
    allowManageActions;
  const canShowAdd = canAdd && showAddButton;

  const normalizedDevices = devices.map((raw) => ({
    raw,
    device: normalizeDevice(raw),
  }));

  const selectedEntry =
    normalizedDevices.find(
      (entry) => entry.device.id === selectedId
    ) || normalizedDevices[0] || null;

  const renderDeviceCard = (
    entry,
    isSelected,
    enableSelection = true
  ) => {
    if (!entry?.device) return null;

    const { raw, device } = entry;

    return (
      <DeviceCard
        key={device.id}
        deviceUuid={device.id}
        deviceId={device.deviceId}
        deviceName={device.deviceName}
        deviceType={device.deviceType}
        firmwareVersion={device.firmwareVersion}
        connectivityType={device.connectivityType}
        deviceStatus={device.deviceStatus}
        trustLevel={device.trustLevel}
        lastSeenAt={device.lastSeenAt}
        cropType={device.cropType}
        soilType={device.soilType}
        canEdit={canEdit}
        canDelete={canDelete}
        isDeleting={deletingDeviceId === device.id}
        isSelected={isSelected}
        showMapToggle={showMapToggle}
        latitude={
          device.latitude ??
          device.lat ??
          raw?.latitude ??
          raw?.lat ??
          null
        }
        longitude={
          device.longitude ??
          device.lng ??
          raw?.longitude ??
          raw?.lng ??
          null
        }
        onSelect={
          enableSelection &&
          typeof onSelect === "function"
            ? () => onSelect(raw)
            : undefined
        }
        onEdit={(id) => onEdit(id, device)}
        onDelete={(id) => onDelete(id, device)}
      />
    );
  };

  /* ---------------- RENDER ---------------- */

  return (
    <section
      className="fc-device-manager"
      aria-label="Device manager"
    >
      
      {(showHeader || canShowAdd) && (
        <header className="fc-device-manager__header">
          {showHeader && (
            <h3 className="fc-section-title">
              {title}
            </h3>
          )}

          {canShowAdd && (
            <button
              type="button"
              className="fc-btn fc-btn--primary"
              onClick={onAdd}
              aria-label="Add new device"
            >
              <span
                className="material-icons"
                aria-hidden="true"
              >
                {addButtonIcon}
              </span>
              {addButtonLabel}
            </button>
          )}
        </header>
      )}

      
      {devices.length > 0 ? (
        showSelectorBar ? (
          <div className="fc-device-manager__selector-layout">
            <div
              className="fc-device-selector"
              role="tablist"
              aria-label="Device selector"
            >
              {normalizedDevices.map((entry) => {
                const { raw, device } = entry;
                const isActive =
                  selectedEntry?.device?.id ===
                  device.id;

                return (
                  <button
                    key={device.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`fc-device-selector__item ${
                      isActive ? "is-active" : ""
                    }`}
                    data-status={device.deviceStatus}
                    onClick={() =>
                      typeof onSelect === "function" &&
                      onSelect(raw)
                    }
                  >
                    <span className="fc-device-selector__name">
                      {device.deviceName}
                    </span>
                    <span className="fc-device-selector__meta">
                      {device.deviceStatus}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedEntry &&
              renderDeviceCard(
                selectedEntry,
                false,
                false
              )}
          </div>
        ) : (
          <div className="fc-device-grid">
            {normalizedDevices.map((entry) =>
              renderDeviceCard(
                entry,
                selectedId === entry.device.id
              )
            )}
          </div>
        )
      ) : (
        <div
          className="fc-empty-state"
          role="status"
          aria-live="polite"
        >
          <span
            className="material-icons"
            aria-hidden="true"
          >
            devices_other
          </span>

          <p>No devices are currently registered.</p>

          {canShowAdd && (
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              onClick={onAdd}
            >
              {addEmptyButtonLabel}
            </button>
          )}
        </div>
      )}
    </section>
  );
};



DeviceManager.propTypes = {
  devices: PropTypes.array,

  currentUserRole: PropTypes.oneOf([
    "admin",
    "user",
    "guest",
  ]),

  selectedId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  deletingDeviceId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  allowManageActions: PropTypes.bool,
  showSelectorBar: PropTypes.bool,
  showHeader: PropTypes.bool,
  showAddButton: PropTypes.bool,
  showMapToggle: PropTypes.bool,
  title: PropTypes.string,
  addButtonLabel: PropTypes.string,
  addButtonIcon: PropTypes.string,
  addEmptyButtonLabel: PropTypes.string,

  onSelect: PropTypes.func,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};



export default memo(DeviceManager);
