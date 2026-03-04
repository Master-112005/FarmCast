/**
 * DeviceView.jsx
 * ------------------------------------------------------
 * FarmCast - Device & Field Monitoring Workspace
 *
 * Tier: 1 (Mission Critical UI Container)
 *
 * Responsibilities:
 * - Display & manage farm devices
 * - Visualize device location & field data
 * - Present soil, fertilizer & water insights
 *
 * Rules:
 * - No routing logic
 * - No auth mutation
 * - No backend business logic
 */

"use strict";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

/* ======================================================
   COMPONENTS
====================================================== */

import Card from "../components/layout/Card";
import DeviceManager from "../components/device/DeviceManager";
import DeviceFormModal from "../components/device/DeviceFormModal";
import DeviceDeleteModal from "../components/device/DeviceDeleteModal";
import DeviceMap from "../components/device/DeviceMap";
import SoilDataCard from "../components/results/SoilDataCard";
import FertilizerRecommendation from "../components/results/FertilizerRecommendation";
import WaterRecommendation from "../components/results/WaterRecommendation";

/* ======================================================
   SERVICES
====================================================== */

import {
  getDevices,
  addDevice,
  updateDevice,
  getLiveDeviceData,
} from "../services/deviceService";
import {
  runBackendDeleteFlow,
  runSecureDeleteFlow,
} from "../services/deviceProvisioning";

/* ======================================================
   CONTEXT
====================================================== */

import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

/* ======================================================
   CONSTANTS
====================================================== */

const EMPTY_MESSAGE =
  "No devices found. Add your first FarmCast device to begin.";

const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

/* ======================================================
   DEVICE VIEW
====================================================== */

const DeviceView = () => {
  /* ---------------- AUTH ---------------- */

  const { isAuthenticated, role } = useAuth();
  const { socket } = useSocket();

  /* ---------------- STATE ---------------- */

  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] =
    useState(null);

  const [soilData, setSoilData] = useState(null);
  const [fertilizer, setFertilizer] = useState(null);
  const [water, setWater] = useState(null);
  const [telemetryLoading, setTelemetryLoading] =
    useState(false);
  const [telemetryError, setTelemetryError] =
    useState("");
  const [activeAlerts, setActiveAlerts] = useState(
    []
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deviceModal, setDeviceModal] =
    useState({
      isOpen: false,
      mode: "add",
      deviceId: null,
      device: null,
    });
  const [
    deviceModalSubmitting,
    setDeviceModalSubmitting,
  ] = useState(false);
  const [deviceModalError, setDeviceModalError] =
    useState("");
  const [deleteModal, setDeleteModal] =
    useState({
      isOpen: false,
      deviceId: null,
      device: null,
    });
  const [
    deleteModalSubmitting,
    setDeleteModalSubmitting,
  ] = useState(false);
  const [deleteModalError, setDeleteModalError] =
    useState("");
  const [deleteModalProgress, setDeleteModalProgress] =
    useState("");
  const [deleteModalFlowMode, setDeleteModalFlowMode] =
    useState("cloud");
  const [deletingDeviceId, setDeletingDeviceId] =
    useState(null);
  const selectedDeviceIdRef = useRef(null);

  useEffect(() => {
    selectedDeviceIdRef.current =
      selectedDevice?.id || null;
  }, [selectedDevice?.id]);

  /* ======================================================
     LOAD DEVICES
  ====================================================== */

  const loadDevices = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    try {
      const response = await getDevices();

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Unable to load devices"
        );
      }

      const list = Array.isArray(
        response.data
      )
        ? response.data
        : [];

      setDevices(list);
      setSelectedDevice((prev) => {
        if (list.length === 0) return null;
        if (!prev?.id) return list[0];

        const matched = list.find(
          (item) => item.id === prev.id
        );
        return matched || list[0];
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  /* ======================================================
     DEVICE CRUD
  ====================================================== */

  const openAddDeviceModal = () => {
    if (role !== "admin" && role !== "user") {
      return setError(
        "You are not authorized to add devices."
      );
    }

    setDeviceModalError("");
    setDeviceModal({
      isOpen: true,
      mode: "add",
      deviceId: null,
      device: null,
    });
  };

  const openEditDeviceModal = (id, device) => {
    const sourceDevice =
      device ||
      devices.find((entry) => entry.id === id) ||
      selectedDevice ||
      null;

    setDeviceModalError("");
    setDeviceModal({
      isOpen: true,
      mode: "edit",
      deviceId: id,
      device: sourceDevice,
    });
  };

  const closeDeviceModal = () => {
    if (deviceModalSubmitting) return;

    setDeviceModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const handleSubmitDeviceModal = async (
    values
  ) => {
    setError("");
    setDeviceModalError("");
    setDeviceModalSubmitting(true);

    try {
      let response;

      if (
        deviceModal.mode === "edit" &&
        deviceModal.deviceId
      ) {
        response = await updateDevice(
          deviceModal.deviceId,
          {
            name: values.name,
            wifiSsid: values.wifiSsid,
            wifiPassword: values.wifiPassword,
          }
        );
      } else {
        response = await addDevice({
          name: values.name,
          type: values.type,
        });
      }

      if (!response?.success) {
        throw new Error(
          response?.error ||
            "Unable to save device."
        );
      }

      await loadDevices();
      setDeviceModal((prev) => ({
        ...prev,
        isOpen: false,
      }));
    } catch (err) {
      const message =
        err?.message ||
        "Unable to save device.";
      setDeviceModalError(message);
      setError(message);
    } finally {
      setDeviceModalSubmitting(false);
    }
  };

  const openDeleteDeviceModal = (
    id,
    device
  ) => {
    if (role !== "admin" && role !== "user") {
      return setError(
        "You are not authorized to delete devices."
      );
    }

    setDeleteModalError("");
    setDeleteModalProgress("");
    setDeleteModalFlowMode("cloud");
    setDeleteModal({
      isOpen: true,
      deviceId: id,
      device:
        device ||
        devices.find((entry) => entry.id === id) ||
        null,
    });
  };

  const closeDeleteDeviceModal = () => {
    if (deleteModalSubmitting) return;

    setDeleteModalProgress("");
    setDeleteModalFlowMode("cloud");
    setDeleteModal((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const handleConfirmDeleteDevice = async () => {
    if (!deleteModal.deviceId) return;

    setError("");
    setDeleteModalError("");
    try {
      setDeleteModalFlowMode("cloud");
      setDeletingDeviceId(deleteModal.deviceId);
      setDeleteModalSubmitting(true);
      setDeleteModalProgress("pre_delete");
      await runBackendDeleteFlow({
        deviceId: deleteModal.deviceId,
        onProgress: (step) => {
          setDeleteModalProgress(step);
        },
      });

      if (
        selectedDevice?.id ===
        deleteModal.deviceId
      ) {
        setSelectedDevice(null);
      }

      await loadDevices();
      setDeleteModalProgress("completed");
      setDeleteModal((prev) => ({
        ...prev,
        isOpen: false,
      }));
    } catch (err) {
      const message =
        err?.message ||
        "Unable to delete device.";
      setDeleteModalError(message);
      setError(message);
    } finally {
      setDeleteModalSubmitting(false);
      setDeletingDeviceId(null);
      setDeleteModalProgress("");
      setDeleteModalFlowMode("cloud");
    }
  };

  const handleConfirmDeleteDeviceViaUsb =
    async () => {
      if (!deleteModal.deviceId) return;

      setError("");
      setDeleteModalError("");
      try {
        setDeleteModalFlowMode("usb");
        setDeletingDeviceId(deleteModal.deviceId);
        setDeleteModalSubmitting(true);
        setDeleteModalProgress("request_usb");
        await runSecureDeleteFlow({
          deviceId: deleteModal.deviceId,
          onProgress: (step) => {
            setDeleteModalProgress(step);
          },
        });

        if (
          selectedDevice?.id ===
          deleteModal.deviceId
        ) {
          setSelectedDevice(null);
        }

        await loadDevices();
        setDeleteModalProgress("completed");
        setDeleteModal((prev) => ({
          ...prev,
          isOpen: false,
        }));
      } catch (err) {
        const message =
          err?.message ||
          "Unable to delete device.";
        setDeleteModalError(message);
        setError(message);
      } finally {
        setDeleteModalSubmitting(false);
        setDeletingDeviceId(null);
        setDeleteModalProgress("");
        setDeleteModalFlowMode("cloud");
      }
    };

  /* ======================================================
     TELEMETRY (LIVE)
  ====================================================== */

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleDeviceUpdate = (data) => {
      if (!data?.deviceId) return;

      const measuredAt =
        data.timestamp ||
        new Date().toISOString();
      const measuredAtDate = new Date(measuredAt);
      const measuredAtIso = Number.isNaN(
        measuredAtDate.getTime()
      )
        ? new Date().toISOString()
        : measuredAtDate.toISOString();
      const soilTemp = toFiniteNumber(
        data.temperature
      );
      const soilMoisture = toFiniteNumber(
        data.moisture
      );
      const latitude = toFiniteNumber(
        data.latitude ?? data.lat
      );
      const longitude = toFiniteNumber(
        data.longitude ?? data.lng
      );

      setDevices((prev) =>
        prev.map((device) =>
          device.id === data.deviceId
            ? {
                ...device,
                lastSeenAt: measuredAt,
                latitude:
                  latitude ?? device.latitude,
                longitude:
                  longitude ?? device.longitude,
              }
            : device
        )
      );

      setSelectedDevice((prev) =>
        prev && prev.id === data.deviceId
          ? {
              ...prev,
              lastSeenAt: measuredAt,
              latitude:
                latitude ?? prev.latitude,
              longitude:
                longitude ?? prev.longitude,
            }
          : prev
      );

      if (
        selectedDeviceIdRef.current &&
        selectedDeviceIdRef.current !== data.deviceId
      ) {
        return;
      }

      setTelemetryLoading(false);
      setTelemetryError("");
      setSoilData((prev) => ({
        ...(prev || {}),
        soilTemp,
        soilMoisture,
        latitude,
        longitude,
        measuredAt: measuredAtIso,
        sensorQuality:
          prev?.sensorQuality || "good",
      }));
    };

    const handleAlertNew = (alert) => {
      if (!alert?.deviceId || !alert?.type) return;

      setActiveAlerts((prev) => {
        const match = prev.findIndex((entry) =>
          alert.alertId
            ? entry.alertId === alert.alertId
            : entry.deviceId === alert.deviceId &&
              entry.type === alert.type
        );

        if (match >= 0) {
          const next = [...prev];
          next[match] = {
            ...next[match],
            ...alert,
            resolved: false,
          };
          return next;
        }

        return [
          {
            ...alert,
            resolved: false,
          },
          ...prev,
        ].slice(0, 20);
      });

      if (alert.type === "DEVICE_OFFLINE") {
        setDevices((prev) =>
          prev.map((device) =>
            device.id === alert.deviceId
              ? {
                  ...device,
                  status: "offline",
                  isOnline: false,
                }
              : device
          )
        );

        setSelectedDevice((prev) =>
          prev && prev.id === alert.deviceId
            ? {
                ...prev,
                status: "offline",
                isOnline: false,
              }
            : prev
        );
      }
    };

    const handleAlertResolved = (alert) => {
      if (!alert?.deviceId || !alert?.type) return;

      setActiveAlerts((prev) =>
        prev.filter((entry) => {
          if (
            alert.alertId &&
            entry.alertId === alert.alertId
          ) {
            return false;
          }

          if (
            entry.deviceId === alert.deviceId &&
            entry.type === alert.type
          ) {
            return false;
          }

          return true;
        })
      );

      if (alert.type === "DEVICE_OFFLINE") {
        setDevices((prev) =>
          prev.map((device) =>
            device.id === alert.deviceId
              ? {
                  ...device,
                  status:
                    device.status === "offline"
                      ? "active"
                      : device.status,
                  isOnline: true,
                }
              : device
          )
        );

        setSelectedDevice((prev) =>
          prev && prev.id === alert.deviceId
            ? {
                ...prev,
                status:
                  prev.status === "offline"
                    ? "active"
                    : prev.status,
                isOnline: true,
              }
            : prev
        );
      }
    };

    socket.on("device:update", handleDeviceUpdate);
    socket.on("alert:new", handleAlertNew);
    socket.on(
      "alert:resolved",
      handleAlertResolved
    );

    return () => {
      socket.off("device:update", handleDeviceUpdate);
      socket.off("alert:new", handleAlertNew);
      socket.off(
        "alert:resolved",
        handleAlertResolved
      );
    };
  }, [socket]);

  useEffect(() => {
    if (!selectedDevice?.id) {
      setSoilData(null);
      setFertilizer(null);
      setWater(null);
      setTelemetryError("");
      return;
    }

    const loadTelemetry = async () => {
      setTelemetryLoading(true);
      setTelemetryError("");

      const response = await getLiveDeviceData(
        selectedDevice.id
      );

      if (!response?.success) {
        setTelemetryError(
          response?.error ||
            "Unable to load device telemetry."
        );
        setTelemetryLoading(false);
        return;
      }

      const payload = response.data || {};
      setSoilData(payload.soilData || null);
      const latestLatitude = toFiniteNumber(
        payload?.soilData?.latitude
      );
      const latestLongitude = toFiniteNumber(
        payload?.soilData?.longitude
      );

      if (
        latestLatitude !== null &&
        latestLongitude !== null
      ) {
        setDevices((prev) =>
          prev.map((device) =>
            device.id === selectedDevice.id
              ? {
                  ...device,
                  latitude: latestLatitude,
                  longitude: latestLongitude,
                }
              : device
          )
        );

        setSelectedDevice((prev) =>
          prev && prev.id === selectedDevice.id
            ? {
                ...prev,
                latitude: latestLatitude,
                longitude: latestLongitude,
              }
            : prev
        );
      }

      setFertilizer(
        payload.recommendations?.fertilizer || null
      );
      setWater(payload.recommendations?.water || null);

      setTelemetryLoading(false);
    };

    loadTelemetry();
  }, [selectedDevice]);

  /* ======================================================
     UI STATES
  ====================================================== */

  if (loading) {
    return (
      <div
        className="fc-loading"
        aria-busy="true"
      >
        Loading devices...
      </div>
    );
  }

  /* ======================================================
     UI RENDER
  ====================================================== */

  return (
    <div className="device-grid">
      {error && (
        <div
          className="fc-alert fc-alert--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {activeAlerts.length > 0 && (
        <div
          className="fc-alert fc-alert--error"
          role="status"
        >
          Active alerts ({activeAlerts.length}):{" "}
          {activeAlerts
            .slice(0, 3)
            .map((alert) =>
              `${alert.type} on ${alert.deviceId}`
            )
            .join(" | ")}
        </div>
      )}

      <div className="device-grid__main">
        <Card
          title="My Devices"
          subtitle="Connected FarmCast field devices"
          actions={[]}
        >
          {devices.length === 0 ? (
            <p className="fc-empty">
              {EMPTY_MESSAGE}
            </p>
          ) : (
            <DeviceManager
              devices={devices}
              selectedId={selectedDevice?.id}
              deletingDeviceId={deletingDeviceId}
              onSelect={setSelectedDevice}
              onAdd={openAddDeviceModal}
              onEdit={openEditDeviceModal}
              onDelete={openDeleteDeviceModal}
              allowManageActions={false}
              showSelectorBar
              showHeader={false}
              showAddButton={false}
              currentUserRole={role}
            />
          )}
        </Card>
      </div>

      <div className="device-grid__map">
        <Card
          title="Field and Weather Map"
          subtitle="Live device location and nearby conditions"
        >
          <DeviceMap
            devices={devices}
            selectedDevice={selectedDevice}
          />
        </Card>
      </div>

      <div className="device-grid__insights">
        <div className="device-grid__insight-card device-grid__insight-card--soil">
          <Card title="Soil Status">
            {telemetryLoading ? (
              <div
                className="fc-loading"
                aria-busy="true"
              >
                Loading soil telemetry...
              </div>
            ) : soilData ? (
              <SoilDataCard {...soilData} />
            ) : (
              <p className="fc-empty">
                {telemetryError ||
                  "No soil telemetry available for this device."}
              </p>
            )}
          </Card>
        </div>

        <div className="device-grid__insight-card device-grid__insight-card--fertilizer">
          <Card title="Fertilizer Recommendation">
            <FertilizerRecommendation
              {...(fertilizer || {})}
              isLoading={telemetryLoading}
            />
          </Card>
        </div>

        <div className="device-grid__insight-card device-grid__insight-card--water">
          <Card title="Water Recommendation">
            <WaterRecommendation
              {...(water || {})}
              isLoading={telemetryLoading}
            />
          </Card>
        </div>
      </div>

      <DeviceFormModal
        isOpen={deviceModal.isOpen}
        mode={deviceModal.mode}
        device={deviceModal.device}
        isSubmitting={deviceModalSubmitting}
        error={deviceModalError}
        onClose={closeDeviceModal}
        onSubmit={handleSubmitDeviceModal}
      />

      <DeviceDeleteModal
        isOpen={deleteModal.isOpen}
        device={deleteModal.device}
        isSubmitting={deleteModalSubmitting}
        progressStep={deleteModalProgress}
        flowMode={deleteModalFlowMode}
        error={deleteModalError}
        onClose={closeDeleteDeviceModal}
        onConfirmCloudDelete={
          handleConfirmDeleteDevice
        }
        onConfirmUsbDelete={
          handleConfirmDeleteDeviceViaUsb
        }
      />
    </div>
  );
};

export default DeviceView;


