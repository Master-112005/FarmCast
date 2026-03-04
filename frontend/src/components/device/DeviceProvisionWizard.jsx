"use strict";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  closePort,
  getFirmwareInfo,
  openPort,
  requestPort,
  runProvisioningFlow,
} from "../../services/deviceProvisioning";

const INITIAL_FORM = Object.freeze({
  deviceName: "",
  ssid: "",
  password: "",
});

const PROGRESS_STEPS = Object.freeze([
  {
    key: "claiming_device",
    label: "Claiming device...",
  },
  {
    key: "generating_secure_credentials",
    label: "Generating secure credentials...",
  },
  {
    key: "sending_credentials_to_device",
    label: "Sending credentials to device...",
  },
  {
    key: "connecting_wifi",
    label: "Connecting to WiFi...",
  },
  {
    key: "authenticating_cloud",
    label: "Authenticating with cloud...",
  },
]);

const VERIFY_GUARD_TIMEOUT_MS = 15000;
const VERIFY_UI_WATCHDOG_MS = 18000;
const DeviceProvisionWizard = ({
  isOpen = false,
  onClose,
  onProvisioned,
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const sessionRef = useRef(null);
  const mountedRef = useRef(true);
  const verifyStartedAtRef = useRef(0);

  const [step, setStep] = useState(1);
  const [connectionStatus, setConnectionStatus] =
    useState("idle");
  const [verificationStatus, setVerificationStatus] =
    useState("idle");
  const [provisioningStatus, setProvisioningStatus] =
    useState("idle");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [currentProgress, setCurrentProgress] =
    useState(PROGRESS_STEPS[0].key);
  const [statusHint, setStatusHint] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetState = useCallback(() => {
    setStep(1);
    setConnectionStatus("idle");
    setVerificationStatus("idle");
    setProvisioningStatus("idle");
    setErrorMessage("");
    setDeviceInfo(null);
    setForm(INITIAL_FORM);
    setCurrentProgress(PROGRESS_STEPS[0].key);
    setStatusHint("");
  }, []);

  const safeCloseSession = useCallback(async () => {
    const session = sessionRef.current;
    sessionRef.current = null;
    await closePort(session);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetState();
      return undefined;
    }

    safeCloseSession();
    return undefined;
  }, [isOpen, resetState, safeCloseSession]);

  useEffect(() => {
    if (verificationStatus !== "verifying") {
      return undefined;
    }

    let active = true;
    let rafId = 0;
    const tick = () => {
      if (!active || !mountedRef.current) {
        return;
      }

      const startedAt =
        verifyStartedAtRef.current;

      // Verification already completed (success or error path).
      // Avoid stale watchdog transitions after state updates race.
      if (!startedAt || startedAt <= 0) {
        return;
      }

      const elapsed = Date.now() - startedAt;
      if (elapsed >= VERIFY_UI_WATCHDOG_MS) {
        setConnectionStatus((prev) =>
          prev === "connecting" ? "error" : prev
        );
        setVerificationStatus("error");
        setProvisioningStatus("error");
        setErrorMessage(
          "Firmware verification timed out. Reconnect device and try again."
        );
        safeCloseSession().catch(() => {});
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [verificationStatus, safeCloseSession]);

  const busy = useMemo(() => {
    return (
      connectionStatus === "connecting" ||
      verificationStatus === "verifying" ||
      provisioningStatus === "running"
    );
  }, [
    connectionStatus,
    verificationStatus,
    provisioningStatus,
  ]);

  const validateForm = useMemo(() => {
    const deviceNameOk =
      form.deviceName.trim().length >= 2 &&
      form.deviceName.trim().length <= 100;
    const ssidOk = form.ssid.trim().length >= 1;
    const passwordOk =
      form.password.trim().length >= 8;

    return {
      deviceNameOk,
      ssidOk,
      passwordOk,
      isValid:
        deviceNameOk && ssidOk && passwordOk,
    };
  }, [form]);

  const handleServiceError = useCallback(
    async (error) => {
      if (!mountedRef.current) {
        return;
      }

      if (error?.code === "AUTH_EXPIRED") {
        await safeCloseSession();
        logout();
        navigate("/login", { replace: true });
        return;
      }

      setProvisioningStatus("error");
      setErrorMessage(
        error?.message ||
          "Provisioning failed unexpectedly."
      );
    },
    [logout, navigate, safeCloseSession]
  );

  const verifyFirmware = useCallback(
    async (session) => {
      setVerificationStatus("verifying");
      verifyStartedAtRef.current = Date.now();
      setErrorMessage("");
      setStep(2);
      let guardTimer = null;

      try {
        const info = await Promise.race([
          getFirmwareInfo(session),
          new Promise((_, reject) => {
            guardTimer = setTimeout(() => {
              reject(
                new Error(
                  "Firmware verification timed out."
                )
              );
            }, VERIFY_GUARD_TIMEOUT_MS);
          }),
        ]);

        if (!mountedRef.current) {
          return;
        }

        setDeviceInfo(info);
        setVerificationStatus("verified");
        verifyStartedAtRef.current = 0;

        setStep(3);
        setProvisioningStatus("idle");
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setVerificationStatus("error");
        verifyStartedAtRef.current = 0;
        setProvisioningStatus("error");
        setErrorMessage(
          error?.message ||
            "Firmware handshake failed."
        );

        safeCloseSession().catch(() => {});
      } finally {
        if (guardTimer) {
          clearTimeout(guardTimer);
        }
      }
    },
    [safeCloseSession]
  );

  const handleConnectDevice = useCallback(async () => {
    setConnectionStatus("connecting");
    setErrorMessage("");

    await safeCloseSession();

    try {
      const port = await requestPort();
      const session = await openPort(port, {
        onDisconnect: (error) => {
          if (!mountedRef.current) {
            return;
          }

          setConnectionStatus("error");
          setVerificationStatus("error");
          setProvisioningStatus("error");
          setErrorMessage(
            error?.message ||
              "USB device disconnected."
          );
        },
      });

      sessionRef.current = session;
      setConnectionStatus("connected");
      setStep(2);

      await verifyFirmware(session);
    } catch (error) {
      setConnectionStatus("error");
      setErrorMessage(
        error?.message ||
          "Unable to connect to device."
      );
    }
  }, [safeCloseSession, verifyFirmware]);

  const handleRetryVerification =
    useCallback(async () => {
      const session = sessionRef.current;
      if (!session) {
        setErrorMessage(
          "Connect the device again before retrying."
        );
        setStep(1);
        return;
      }

      await verifyFirmware(session);
    }, [verifyFirmware]);

  const handleProvision = useCallback(
    async (event) => {
      event.preventDefault();

      if (!validateForm.isValid) {
        setErrorMessage(
          "Please complete all required fields."
        );
        return;
      }

      const session = sessionRef.current;
      if (!session) {
        setErrorMessage(
          "USB device is not connected."
        );
        setStep(1);
        return;
      }

      setProvisioningStatus("running");
      setErrorMessage("");
      setStep(4);
      setCurrentProgress(
        PROGRESS_STEPS[0].key
      );
      setStatusHint("");

      try {
        const result = await runProvisioningFlow({
          session,
          firmwareInfo: deviceInfo,
          deviceName: form.deviceName.trim(),
          ssid: form.ssid.trim(),
          password: form.password,
          onProgress: (state) => {
            if (!mountedRef.current) {
              return;
            }

            setCurrentProgress(state);

            if (state === "connecting_wifi") {
              setStatusHint(
                "Waiting for device to join WiFi..."
              );
            } else if (
              state ===
              "authenticating_cloud"
            ) {
              setStatusHint(
                "Waiting for cloud authentication..."
              );
            }
          },
        });

        if (!mountedRef.current) {
          return;
        }

        await safeCloseSession();
        setProvisioningStatus("success");
        setStep(5);
        setStatusHint(
          "Device confirmed online."
        );

        if (typeof onProvisioned === "function") {
          onProvisioned(result);
        }
      } catch (error) {
        await handleServiceError(error);
      }
    },
    [
      deviceInfo,
      form,
      handleServiceError,
      onProvisioned,
      safeCloseSession,
      validateForm.isValid,
    ]
  );

  const handleClose = useCallback(async () => {
    if (busy) {
      return;
    }

    await safeCloseSession();
    if (typeof onClose === "function") {
      onClose();
    }
  }, [busy, onClose, safeCloseSession]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fc-modal fc-provision-wizard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fc-provision-title"
    >
      <div className="fc-modal__content fc-provision-wizard__content">
        <header className="fc-provision-wizard__header">
          <div>
            <h2 id="fc-provision-title">
              USB Device Provisioning
            </h2>
            <p>
              Secure onboarding via Web Serial.
            </p>
          </div>

          <button
            type="button"
            className="fc-btn fc-btn--neutral"
            onClick={handleClose}
            disabled={busy}
          >
            Close
          </button>
        </header>

        <ol className="fc-provision-wizard__steps">
          <li
            className={
              step >= 1 ? "is-active" : ""
            }
          >
            Connect Device
          </li>
          <li
            className={
              step >= 2 ? "is-active" : ""
            }
          >
            Firmware Verification
          </li>
          <li
            className={
              step >= 3 ? "is-active" : ""
            }
          >
            Configuration
          </li>
          <li
            className={
              step >= 4 ? "is-active" : ""
            }
          >
            Provisioning
          </li>
          <li
            className={
              step >= 5 ? "is-active" : ""
            }
          >
            Online Confirmation
          </li>
        </ol>

        {errorMessage ? (
          <div
            className="fc-alert fc-alert--error"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <section className="fc-provision-wizard__panel">
          {step === 1 && (
            <div className="fc-provision-wizard__connect">
              <span
                className="material-icons fc-provision-wizard__usb-icon"
                aria-hidden="true"
              >
                usb
              </span>
              <p>
                Connect device via USB and allow
                serial access.
              </p>
              <button
                type="button"
                className="fc-btn fc-btn--primary"
                onClick={handleConnectDevice}
                disabled={busy}
              >
                {connectionStatus ===
                "connecting"
                  ? "Connecting..."
                  : "Connect Device"}
              </button>
            </div>
          )}

          {step >= 2 && (
            <div className="fc-provision-wizard__verification">
              <h3>Firmware Verification</h3>
              <p className="fc-provision-wizard__meta">
                Status:{" "}
                <strong>
                  {verificationStatus}
                </strong>
              </p>

              {deviceInfo ? (
                <dl className="fc-provision-wizard__info">
                  <div>
                    <dt>Firmware</dt>
                    <dd>
                      {
                        deviceInfo.firmwareVersion
                      }
                    </dd>
                  </div>
                </dl>
              ) : null}

              <button
                type="button"
                className="fc-btn fc-btn--neutral"
                onClick={handleRetryVerification}
                disabled={busy}
              >
                Re-check Firmware
              </button>
            </div>
          )}

          {step >= 3 &&
            deviceInfo &&
            (
              <form
                className="fc-form fc-provision-wizard__form"
                onSubmit={handleProvision}
              >
                <div className="fc-form-section">
                  <label
                    className="fc-label"
                    htmlFor="fc-provision-device-name"
                  >
                    Device Name
                  </label>
                  <input
                    id="fc-provision-device-name"
                    className="fc-input"
                    type="text"
                    value={form.deviceName}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        deviceName:
                          event.target.value,
                      }))
                    }
                    disabled={busy}
                    required
                  />
                </div>

                <div className="fc-form-section">
                  <label
                    className="fc-label"
                    htmlFor="fc-provision-ssid"
                  >
                    WiFi SSID
                  </label>
                  <input
                    id="fc-provision-ssid"
                    className="fc-input"
                    type="text"
                    value={form.ssid}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        ssid:
                          event.target.value,
                      }))
                    }
                    disabled={busy}
                    required
                  />
                </div>

                <div className="fc-form-section">
                  <label
                    className="fc-label"
                    htmlFor="fc-provision-password"
                  >
                    WiFi Password
                  </label>
                  <input
                    id="fc-provision-password"
                    className="fc-input"
                    type="password"
                    value={form.password}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        password:
                          event.target.value,
                      }))
                    }
                    disabled={busy}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="fc-btn fc-btn--primary"
                  disabled={
                    busy ||
                    !validateForm.isValid
                  }
                >
                  {provisioningStatus ===
                  "running"
                    ? "Provisioning..."
                    : "Start Provisioning"}
                </button>
              </form>
            )}

          {step >= 4 && (
            <div className="fc-provision-wizard__progress">
              <h3>Provisioning Progress</h3>
              <ul>
                {PROGRESS_STEPS.map((entry) => (
                  <li
                    key={entry.key}
                    className={
                      currentProgress ===
                      entry.key
                        ? "is-current"
                        : ""
                    }
                  >
                    {entry.label}
                  </li>
                ))}
              </ul>
              {statusHint ? (
                <p className="fc-provision-wizard__hint">
                  {statusHint}
                </p>
              ) : null}
            </div>
          )}

          {step === 5 &&
            provisioningStatus ===
              "success" && (
              <div className="fc-provision-wizard__success">
                <h3>Device Online</h3>
                <p>
                  Device was provisioned and is
                  now online.
                </p>
                <button
                  type="button"
                  className="fc-btn fc-btn--success"
                  onClick={handleClose}
                >
                  Done
                </button>
              </div>
            )}
        </section>

        {provisioningStatus === "error" &&
        !busy ? (
          <footer className="fc-provision-wizard__footer">
            <button
              type="button"
              className="fc-btn fc-btn--neutral"
              onClick={handleConnectDevice}
            >
              Retry
            </button>
          </footer>
        ) : null}
      </div>
    </div>
  );
};

DeviceProvisionWizard.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onProvisioned: PropTypes.func,
};

export default DeviceProvisionWizard;
