import api from "./api";
import { ENDPOINTS, LIMITS } from "../utils/constants";



const REQUEST_TIMEOUT =
  LIMITS?.REQUEST_TIMEOUT_MS ?? 15000;



const ok = (data, status) => ({
  success: true,
  data,
  status,
});

const fail = (error) => ({
  success: false,
  error: error?.message || "Device request failed",
  status: error?.status,
  code: error?.code,
});



const execute = async (requestFn) => {
  try {
    const response = await requestFn();
    return ok(response.data, response.status);
  } catch (error) {
    return fail(error);
  }
};



const normalizeType = (value) => {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("weather")) return "weather_sensor";
  if (raw.includes("multi")) return "multi_sensor";
  if (raw.includes("soil")) return "soil_sensor";

  return "soil_sensor";
};

const normalizeCreatePayload = (payload) => ({
  name: payload?.name || payload?.deviceName || "New Device",
  type: normalizeType(
    payload?.type || payload?.deviceType
  ),
});

const normalizeUpdatePayload = (payload) => {
  const normalized = {
    name: payload?.name || payload?.deviceName,
    status: payload?.status || payload?.deviceStatus,
  };

  const wifiSsid = String(
    payload?.wifiSsid || payload?.ssid || ""
  ).trim();
  const wifiPassword =
    typeof payload?.wifiPassword === "string"
      ? payload.wifiPassword
      : typeof payload?.password === "string"
        ? payload.password
        : "";

  if (wifiSsid.length > 0 || wifiPassword.length > 0) {
    normalized.wifiSsid = wifiSsid;
    normalized.wifiPassword = wifiPassword;
  }

  return normalized;
};







export const getDevices = () =>
  execute(() => api.get(ENDPOINTS.DEVICES));




export const getDeviceById = (deviceId) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }

  return execute(() =>
    api.get(`${ENDPOINTS.DEVICES}/${deviceId}`)
  );
};






export const addDevice = (devicePayload) => {
  if (!devicePayload) {
    return fail({ message: "Device payload required" });
  }

  return execute(() =>
    api.post(
      ENDPOINTS.DEVICES,
      normalizeCreatePayload(devicePayload)
    )
  );
};




export const updateDevice = (
  deviceId,
  updatePayload
) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }
  if (!updatePayload) {
    return fail({
      message: "Update payload required",
    });
  }

  const normalized = normalizeUpdatePayload(updatePayload);

  return execute(() =>
    api.put(
      `${ENDPOINTS.DEVICES}/${deviceId}`,
      normalized
    )
  );
};





export const deleteDevice = (deviceId) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }

  return execute(() =>
    api.delete(`${ENDPOINTS.DEVICES}/${deviceId}`)
  );
};




export const preDeleteDevice = (deviceId) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }

  return execute(() =>
    api.delete(
      `${ENDPOINTS.DEVICES}/${deviceId}/pre-delete`
    )
  );
};




export const finalizeDeleteDevice = (deviceId) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }

  return execute(() =>
    api.post(
      `${ENDPOINTS.DEVICES}/${deviceId}/finalize-delete`
    )
  );
};







export const getLiveDeviceData = (deviceId) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }

  return execute(() =>
    api.get(
      `${ENDPOINTS.DEVICES}/${deviceId}/live`,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};




export const getLatestSoilRecord = (deviceId) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }

  return execute(() =>
    api.get(`${ENDPOINTS.SOIL}/latest/${deviceId}`)
  );
};





export const syncDeviceData = (
  deviceId,
  payload
) => {
  if (!deviceId) {
    return fail({ message: "Device ID required" });
  }
  if (!payload) {
    return fail({ message: "Payload required" });
  }

  return execute(() =>
    api.patch(
      `${ENDPOINTS.DEVICES}/sync/${deviceId}`,
      payload,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};
