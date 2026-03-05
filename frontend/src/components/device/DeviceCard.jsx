import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import PropTypes from "prop-types";
import DeviceMap from "./DeviceMap";



const STATUS_LABEL = {
  active: "fc-status fc-status--active",
  inactive: "fc-status fc-status--inactive",
  maintenance: "fc-status fc-status--warning",
  offline: "fc-status fc-status--neutral",
};

const TRUST_BADGE = {
  trusted: "fc-badge fc-badge--success",
  unverified: "fc-badge fc-badge--warning",
  compromised: "fc-badge fc-badge--danger",
};



const formatTimestamp = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString();
};



const DeviceCard = ({
  deviceUuid, // internal only (never displayed)
  deviceId,
  deviceName,
  deviceType,
  firmwareVersion,
  connectivityType,
  deviceStatus,
  trustLevel,
  lastSeenAt,
  cropType,
  soilType,
  canEdit = false,
  canDelete = false,
  onEdit,
  onDelete,
  isDeleting = false,
  isSelected = false,
  onSelect,
  showMapToggle = false,
  latitude = null,
  longitude = null,
}) => {
  const [isMapView, setIsMapView] =
    useState(false);

  const isSelectable =
    typeof onSelect === "function";

  useEffect(() => {
    setIsMapView(false);
  }, [deviceUuid]);

  const hasMapCoordinates = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    );
  }, [latitude, longitude]);

  const mapDevice = useMemo(
    () => ({
      id: String(deviceUuid),
      deviceId,
      deviceName,
      device_type: deviceType,
      device_status: deviceStatus,
      trust_level: trustLevel,
      lastSeenAt,
      latitude: Number(latitude),
      longitude: Number(longitude),
    }),
    [
      deviceUuid,
      deviceId,
      deviceName,
      deviceType,
      deviceStatus,
      trustLevel,
      lastSeenAt,
      latitude,
      longitude,
    ]
  );

  const handleToggleMap = (event) => {
    event.stopPropagation();
    setIsMapView((prev) => !prev);
  };

  return (
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <section
      className={`fc-card fc-device-card-shell ${
        isSelected ? "is-selected" : ""
      }`}
      aria-label={`Device ${deviceName}`}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      aria-pressed={
        isSelectable ? isSelected : undefined
      }
      onClick={
        isSelectable ? onSelect : undefined
      }
      onKeyDown={
        isSelectable
          ? (event) => {
              if (
                event.target !==
                event.currentTarget
              ) {
                return;
              }

              if (
                event.key === "Enter" ||
                event.key === " "
              ) {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      
      <header className="fc-card__header fc-device-card__header">
        <div className="fc-device-card__title-wrap">
          <h2 className="fc-card__title">
            {deviceName}
          </h2>

          <span
            className={
              TRUST_BADGE[trustLevel] ||
              "fc-badge fc-badge--neutral"
            }
            role="status"
            aria-label={`Trust level: ${trustLevel}`}
          >
            {trustLevel || "unknown"}
          </span>
        </div>

        {showMapToggle && (
          <button
            type="button"
            className="fc-btn fc-btn--neutral fc-device-card__map-toggle"
            onClick={handleToggleMap}
            aria-pressed={isMapView}
          >
            <span className="material-icons" aria-hidden="true">
              {isMapView ? "arrow_back" : "map"}
            </span>
            {isMapView
              ? "Back"
              : "View on map"}
          </button>
        )}
      </header>

      
      {isMapView ? (
        hasMapCoordinates ? (
          <div className="fc-device-card__map">
            <DeviceMap devices={[mapDevice]} />
          </div>
        ) : (
          <div
            className="fc-alert fc-alert--neutral"
            role="status"
          >
            Location coordinates are unavailable for this
            device.
          </div>
        )
      ) : (
        <dl className="fc-metadata">
          <div className="fc-meta-row">
            <dt className="fc-label">Device ID</dt>
            <dd className="fc-meta-value fc-mono">
              {deviceId}
            </dd>
          </div>

          <div className="fc-meta-row">
            <dt className="fc-label">Type</dt>
            <dd className="fc-meta-value">
              {deviceType}
            </dd>
          </div>

          <div className="fc-meta-row">
            <dt className="fc-label">Firmware</dt>
            <dd className="fc-meta-value">
              {firmwareVersion || "-"}
            </dd>
          </div>

          <div className="fc-meta-row">
            <dt className="fc-label">Connectivity</dt>
            <dd className="fc-meta-value">
              {connectivityType}
            </dd>
          </div>

          <div className="fc-meta-row">
            <dt className="fc-label">Status</dt>
            <dd
              className={
                STATUS_LABEL[deviceStatus] ||
                "fc-status fc-status--neutral"
              }
            >
              {deviceStatus || "unknown"}
            </dd>
          </div>

          <div className="fc-meta-row">
            <dt className="fc-label">Last Seen</dt>
            <dd className="fc-meta-value">
              {formatTimestamp(lastSeenAt)}
            </dd>
          </div>

          {cropType && (
            <div className="fc-meta-row">
              <dt className="fc-label">Crop</dt>
              <dd className="fc-meta-value">
                {cropType}
              </dd>
            </div>
          )}

          {soilType && (
            <div className="fc-meta-row">
              <dt className="fc-label">Soil</dt>
              <dd className="fc-meta-value">
                {soilType}
              </dd>
            </div>
          )}
        </dl>
      )}

      
      {!isMapView && (canEdit || canDelete) && (
        <footer className="fc-card__actions">
          {canEdit && (
            <button
              type="button"
              className="fc-btn fc-btn--secondary"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(deviceUuid);
              }}
              aria-label="Edit device"
            >
              <span
                className="material-icons"
                aria-hidden="true"
              >
                edit
              </span>
              Edit
            </button>
          )}

          {canDelete && (
            <button
              type="button"
              className="fc-btn fc-btn--danger"
              disabled={isDeleting}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(deviceUuid);
              }}
              aria-label="Delete device"
              aria-busy={isDeleting}
            >
              <span
                className="material-icons"
                aria-hidden="true"
              >
                {isDeleting ? "hourglass_top" : "delete"}
              </span>
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </footer>
      )}
    </section>
  );
};



DeviceCard.propTypes = {
  deviceUuid: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  deviceId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired,
  deviceName: PropTypes.string.isRequired,
  deviceType: PropTypes.string.isRequired,
  firmwareVersion: PropTypes.string,
  connectivityType: PropTypes.string.isRequired,
  deviceStatus: PropTypes.oneOf([
    "active",
    "inactive",
    "maintenance",
    "offline",
  ]).isRequired,
  trustLevel: PropTypes.oneOf([
    "trusted",
    "unverified",
    "compromised",
  ]).isRequired,
  lastSeenAt: PropTypes.string,
  cropType: PropTypes.string,
  soilType: PropTypes.string,
  canEdit: PropTypes.bool,
  canDelete: PropTypes.bool,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  isDeleting: PropTypes.bool,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
  showMapToggle: PropTypes.bool,
  latitude: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
  longitude: PropTypes.oneOfType([
    PropTypes.number,
    PropTypes.string,
  ]),
};

export default DeviceCard;
