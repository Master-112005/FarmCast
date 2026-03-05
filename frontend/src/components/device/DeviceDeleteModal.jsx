import React, { useEffect } from "react";
import PropTypes from "prop-types";

const resolveDeviceName = (device) =>
  device?.deviceName || device?.name || "Unnamed device";

const resolveDeviceCode = (device) =>
  device?.deviceId || device?.deviceCode || device?.id || "-";

const USB_DELETE_STEPS = Object.freeze([
  {
    key: "request_usb",
    label: "USB permission",
  },
  {
    key: "connect_usb",
    label: "USB connected",
  },
  {
    key: "verify_firmware",
    label: "Firmware verified",
  },
  {
    key: "pre_delete",
    label: "Backend pre-delete",
  },
  {
    key: "factory_reset",
    label: "Factory reset sent",
  },
  {
    key: "finalize_delete",
    label: "Finalize deletion",
  },
  {
    key: "completed",
    label: "Completed",
  },
]);

const CLOUD_DELETE_STEPS = Object.freeze([
  {
    key: "pre_delete",
    label: "Backend pre-delete",
  },
  {
    key: "finalize_delete",
    label: "Finalize deletion",
  },
  {
    key: "completed",
    label: "Completed",
  },
]);

const DeviceDeleteModal = ({
  isOpen = false,
  device = null,
  isSubmitting = false,
  progressStep = "",
  flowMode = "cloud",
  error = "",
  showUsbOption = true,
  onClose,
  onConfirmCloudDelete,
  onConfirmUsbDelete,
}) => {
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

  if (!isOpen) return null;

  const steps = flowMode === "usb"
    ? USB_DELETE_STEPS
    : CLOUD_DELETE_STEPS;

  return (
    <div
      className="fc-modal fc-device-delete-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fc-device-delete-title"
    >
      <div className="fc-modal__content fc-device-delete-modal__content">
        <header className="fc-device-delete-modal__header">
          <div className="fc-device-delete-modal__title-wrap">
            <span
              className="material-icons fc-device-delete-modal__icon"
              aria-hidden="true"
            >
              warning
            </span>
            <div>
              <h2
                id="fc-device-delete-title"
                className="fc-device-delete-modal__title"
              >
                Delete Device
              </h2>
              <p className="fc-device-delete-modal__subtitle">
                This action cannot be undone.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="fc-btn fc-btn--neutral fc-btn--icon"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close delete confirmation"
          >
            <span className="material-icons" aria-hidden="true">
              close
            </span>
          </button>
        </header>

        {error ? (
          <div className="fc-alert fc-alert--error">{error}</div>
        ) : null}

        <div className="fc-device-delete-modal__details">
          <div className="fc-device-delete-modal__detail">
            <span className="fc-label">Device Name</span>
            <strong>{resolveDeviceName(device)}</strong>
          </div>
          <div className="fc-device-delete-modal__detail">
            <span className="fc-label">Device ID</span>
            <strong className="fc-mono">
              {resolveDeviceCode(device)}
            </strong>
          </div>
        </div>

        <p className="fc-device-delete-modal__note">
          Delete now works even when the device is offline. USB delete is
          optional when you also want to trigger immediate on-device
          FACTORY_RESET.
        </p>

        <ul className="fc-device-delete-modal__progress">
          {steps.map((entry) => (
            <li
              key={entry.key}
              className={
                progressStep === entry.key
                  ? "is-current"
                  : ""
              }
            >
              {entry.label}
            </li>
          ))}
        </ul>

        <footer className="fc-device-delete-modal__actions">
          <button
            type="button"
            className="fc-btn fc-btn--neutral"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="fc-btn fc-btn--danger"
            onClick={onConfirmCloudDelete}
            disabled={isSubmitting}
          >
            <span className="material-icons" aria-hidden="true">
              {isSubmitting ? "hourglass_top" : "delete"}
            </span>
            {isSubmitting
              ? "Processing..."
              : "Delete Now"}
          </button>
          {showUsbOption ? (
            <button
              type="button"
              className="fc-btn fc-btn--neutral"
              onClick={onConfirmUsbDelete}
              disabled={
                isSubmitting ||
                typeof onConfirmUsbDelete !== "function"
              }
            >
              Delete via USB
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
};

DeviceDeleteModal.propTypes = {
  isOpen: PropTypes.bool,
  device: PropTypes.object,
  isSubmitting: PropTypes.bool,
  progressStep: PropTypes.string,
  flowMode: PropTypes.oneOf([
    "cloud",
    "usb",
  ]),
  error: PropTypes.string,
  showUsbOption: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onConfirmCloudDelete: PropTypes.func.isRequired,
  onConfirmUsbDelete: PropTypes.func,
};

export default DeviceDeleteModal;
