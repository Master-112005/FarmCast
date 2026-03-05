import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

const DEVICE_TYPE_OPTIONS = [
  {
    value: "soil_sensor",
    label: "Soil Sensor",
  },
  {
    value: "weather_sensor",
    label: "Weather Sensor",
  },
  {
    value: "multi_sensor",
    label: "Multi Sensor",
  },
];

const resolveDeviceName = (device) =>
  device?.deviceName || device?.name || "";

const resolveDeviceCode = (device) =>
  device?.deviceId || device?.deviceCode || device?.id || "-";

const resolveDeviceType = (device) => {
  const rawType = String(
    device?.deviceType || device?.device_type || device?.type || "soil_sensor"
  ).toLowerCase();

  if (rawType.includes("weather")) return "weather_sensor";
  if (rawType.includes("multi")) return "multi_sensor";
  return "soil_sensor";
};

const DeviceFormModal = ({
  isOpen = false,
  mode = "add",
  device = null,
  isSubmitting = false,
  error = "",
  onClose,
  onSubmit,
}) => {
  const [deviceName, setDeviceName] = useState("");
  const [deviceType, setDeviceType] = useState("soil_sensor");
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");

  const isEditMode = mode === "edit";

  useEffect(() => {
    if (!isOpen) return;

    setDeviceName(
      isEditMode
        ? resolveDeviceName(device)
        : ""
    );
    setDeviceType(
      isEditMode
        ? resolveDeviceType(device)
        : "soil_sensor"
    );
    setWifiSsid("");
    setWifiPassword("");
  }, [isOpen, isEditMode, device]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      if (isSubmitting) return;
      if (typeof onClose === "function") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, isSubmitting, onClose]);

  const nextWifiSsid = wifiSsid.trim();
  const wifiUpdateRequested =
    nextWifiSsid.length > 0 ||
    wifiPassword.length > 0;
  const wifiCredentialsValid =
    !wifiUpdateRequested ||
    (nextWifiSsid.length > 0 &&
      wifiPassword.length >= 8);

  const canSubmit = useMemo(
    () =>
      deviceName.trim().length > 0 &&
      !isSubmitting &&
      (!isEditMode || wifiCredentialsValid),
    [
      deviceName,
      isSubmitting,
      isEditMode,
      wifiCredentialsValid,
    ]
  );

  const handleBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;
    if (isSubmitting) return;
    if (typeof onClose === "function") onClose();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;

    if (typeof onSubmit === "function") {
      const payload = {
        name: deviceName.trim(),
      };

      if (!isEditMode) {
        payload.type = deviceType;
      }

      if (isEditMode && wifiUpdateRequested) {
        payload.wifiSsid = nextWifiSsid;
        payload.wifiPassword = wifiPassword;
      }

      onSubmit({
        ...payload,
      });
    }
  };

  if (!isOpen) return null;

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */
    <div
      className={`fc-modal fc-device-modal ${
        isEditMode ? "is-edit" : "is-add"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fc-device-modal-title"
      onClick={handleBackdropClick}
    >
      <div className="fc-modal__content fc-device-modal__content">
        <header className="fc-device-modal__header">
          <div className="fc-device-modal__title-wrap">
            <span
              className="material-icons fc-device-modal__icon"
              aria-hidden="true"
            >
              {isEditMode ? "tune" : "sensors"}
            </span>
            <h2 id="fc-device-modal-title" className="fc-device-modal__title">
              {isEditMode ? "Edit Device" : "Add Device"}
            </h2>
            <p className="fc-device-modal__subtitle">
              {isEditMode
                ? "Update the selected device details."
                : "Register a new FarmCast field device."}
            </p>
          </div>

          <button
            type="button"
            className="fc-btn fc-btn--neutral fc-btn--icon"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close device form"
          >
            <span className="material-icons" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        {error ? (
          <div className="fc-alert fc-alert--error">{error}</div>
        ) : null}

        <form className="fc-form fc-device-modal__form" onSubmit={handleSubmit}>
          {isEditMode ? (
            <div className="fc-device-modal__grid">
              <div className="fc-form-section">
                <span className="fc-label">Device ID</span>
                <div className="fc-device-modal__readonly-value fc-mono">
                  {resolveDeviceCode(device)}
                </div>
              </div>

              <div className="fc-form-section">
                <label className="fc-label" htmlFor="fc-device-name">
                  Device Name
                </label>
                <input
                  id="fc-device-name"
                  className="fc-input"
                  type="text"
                  placeholder="e.g. North Plot Sensor"
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>
          ) : (
            <div className="fc-device-modal__grid">
              <div className="fc-form-section">
                <label className="fc-label" htmlFor="fc-device-name">
                  Device Name
                </label>
                <input
                  id="fc-device-name"
                  className="fc-input"
                  type="text"
                  placeholder="e.g. North Plot Sensor"
                  value={deviceName}
                  onChange={(event) => setDeviceName(event.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="fc-form-section">
                <label className="fc-label" htmlFor="fc-device-type">
                  Device Type
                </label>
                <select
                  id="fc-device-type"
                  className="fc-select"
                  value={deviceType}
                  onChange={(event) => setDeviceType(event.target.value)}
                  disabled={isSubmitting}
                >
                  {DEVICE_TYPE_OPTIONS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {isEditMode ? (
            <div className="fc-form-section fc-device-modal__wifi">
              <p className="fc-label fc-device-modal__wifi-title">
                WiFi Credentials
              </p>
              <div className="fc-device-modal__grid">
                <div className="fc-form-section">
                  <label className="fc-label" htmlFor="fc-device-wifi-ssid">
                    WiFi SSID
                  </label>
                  <input
                    id="fc-device-wifi-ssid"
                    className="fc-input"
                    type="text"
                    placeholder="e.g. FarmNet_2.4G"
                    value={wifiSsid}
                    onChange={(event) =>
                      setWifiSsid(event.target.value)
                    }
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                </div>

                <div className="fc-form-section">
                  <label
                    className="fc-label"
                    htmlFor="fc-device-wifi-password"
                  >
                    WiFi Password
                  </label>
                  <input
                    id="fc-device-wifi-password"
                    className="fc-input"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={wifiPassword}
                    onChange={(event) =>
                      setWifiPassword(event.target.value)
                    }
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <footer className="fc-device-modal__actions">
            <button
              type="button"
              className="fc-btn fc-btn--neutral"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="fc-btn fc-btn--primary"
              disabled={!canSubmit}
            >
              {isSubmitting
                ? isEditMode
                  ? "Saving..."
                  : "Adding..."
                : isEditMode
                  ? "Save Changes"
                  : "Add Device"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

DeviceFormModal.propTypes = {
  isOpen: PropTypes.bool,
  mode: PropTypes.oneOf(["add", "edit"]),
  device: PropTypes.object,
  isSubmitting: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default DeviceFormModal;
