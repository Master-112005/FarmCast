"use strict";

import api from "./api";
import { ENDPOINTS } from "../utils/constants";

const BAUD_RATE = 115200;
const LINE_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 3000;
const BOOT_DRAIN_TIMEOUT_MS = 1200;
const BOOT_DRAIN_IDLE_MS = 120;
const FIRMWARE_INFO_ATTEMPTS = 3;
const FIRMWARE_INFO_READ_TIMEOUT_MS = 2500;
const FIRMWARE_INFO_RETRY_DELAY_MS = 250;
const PROVISION_ACK_TIMEOUT_MS = 2500;
const FACTORY_RESET_ACK_TIMEOUT_MS = 4000;
const FACTORY_RESET_SETTLE_MS = 600;
const PROVISION_APPLY_SETTLE_MS = 700;
const ONLINE_TIMEOUT_MS = 180000;
const ONLINE_POLL_INTERVAL_MS = 3000;

class ProvisioningError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ProvisioningError";
    this.code = code;
    this.status = status;
  }
}

const fail = (code, message, status) => {
  return new ProvisioningError(code, message, status);
};

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const cancelReaderSafely = async (
  reader,
  timeoutMs = 150
) => {
  if (!reader) {
    return;
  }

  try {
    await Promise.race([
      reader.cancel().catch(() => {}),
      delay(timeoutMs),
    ]);
  } catch {
    // no-op
  }
};

const releaseControlSignals = async (
  session
) => {
  if (!session?.port?.setSignals) {
    return;
  }

  try {
    await session.port.setSignals({
      dataTerminalReady: false,
      requestToSend: false,
    });
  } catch {
    // no-op
  }
};

const ensureSerialApi = () => {
  if (
    typeof navigator === "undefined" ||
    !navigator.serial
  ) {
    throw fail(
      "SERIAL_UNSUPPORTED",
      "Web Serial API is not supported in this browser."
    );
  }
};

const sanitizeLine = (value) =>
  String(value || "").replace(/\r/g, "").trim();

const drainBootText = async (
  port,
  {
    timeoutMs = BOOT_DRAIN_TIMEOUT_MS,
    idleMs = BOOT_DRAIN_IDLE_MS,
  } = {}
) => {
  if (!port?.readable) {
    return;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    let hadData = false;
    let reader = null;

    try {
      reader = port.readable.getReader();
      const result = await Promise.race([
        reader.read(),
        delay(idleMs).then(() => null),
      ]);

      if (result === null) {
        await cancelReaderSafely(reader);
      } else if (
        result &&
        result.done !== true &&
        result.value &&
        result.value.length > 0
      ) {
        hadData = true;
      }
    } catch {
      // no-op
    } finally {
      if (reader) {
        try {
          reader.releaseLock();
        } catch {
          // no-op
        }
      }
    }

    if (!hadData) {
      break;
    }
  }
};

const toMilliseconds = (value) => {
  const ts = new Date(value || "").getTime();
  return Number.isFinite(ts) ? ts : 0;
};

export const requestPort = async () => {
  ensureSerialApi();

  try {
    return await navigator.serial.requestPort();
  } catch (error) {
    if (error?.name === "NotFoundError") {
      throw fail(
        "SERIAL_PERMISSION_DENIED",
        "USB serial permission was denied."
      );
    }

    throw fail(
      "SERIAL_REQUEST_FAILED",
      "Unable to access USB serial port."
    );
  }
};

export const openPort = async (
  port,
  options = {}
) => {
  ensureSerialApi();

  if (!port || typeof port.open !== "function") {
    throw fail(
      "SERIAL_PORT_INVALID",
      "Invalid USB serial port selected."
    );
  }

  const onDisconnect =
    typeof options.onDisconnect === "function"
      ? options.onDisconnect
      : null;
  const resetDeviceOnConnect =
    options.resetDeviceOnConnect !== false;

  try {
    await port.open({ baudRate: BAUD_RATE });
  } catch {
    throw fail(
      "SERIAL_OPEN_FAILED",
      "Unable to open USB serial connection."
    );
  }

  if (resetDeviceOnConnect) {
    try {
      await port.setSignals({
        dataTerminalReady: false,
        requestToSend: false,
      });
    } catch {
      await port.close().catch(() => {});
      throw fail(
        "SERIAL_SIGNAL_FAILED",
        "Unable to configure serial control signals."
      );
    }

    await delay(100);

    try {
      await port.setSignals({
        dataTerminalReady: true,
        requestToSend: true,
      });
    } catch {
      await port.close().catch(() => {});
      throw fail(
        "SERIAL_SIGNAL_FAILED",
        "Unable to assert serial control signals."
      );
    }

    await delay(800);
  } else {
    // Keep existing runtime state for flows (delete/reset) that do not
    // require an auto-reset pulse on connect.
    await delay(120);
  }

  if (!port.readable || !port.writable) {
    await port.close().catch(() => {});
    throw fail(
      "SERIAL_STREAM_UNAVAILABLE",
      "USB serial streams are not available."
    );
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const disconnectHandler = (event) => {
    if (event?.target !== port) {
      return;
    }

    if (onDisconnect) {
      onDisconnect(
        fail(
          "SERIAL_DISCONNECTED",
          "USB device disconnected."
        )
      );
    }
  };

  navigator.serial.addEventListener(
    "disconnect",
    disconnectHandler
  );

  // Drain buffered boot/debug noise before issuing command handshake.
  await drainBootText(
    port,
    resetDeviceOnConnect
      ? undefined
      : {
          timeoutMs: 500,
          idleMs: 80,
        }
  );

  return {
    port,
    decoder,
    encoder,
    lineBuffer: "",
    activeReader: null,
    disconnectHandler,
    closed: false,
  };
};

export const closePort = async (session) => {
  if (!session || session.closed) {
    return;
  }

  session.closed = true;

  try {
    if (
      session.disconnectHandler &&
      typeof navigator !== "undefined" &&
      navigator.serial
    ) {
      navigator.serial.removeEventListener(
        "disconnect",
        session.disconnectHandler
      );
    }
  } catch {
    // no-op
  }

  const activeReader = session.activeReader;
  session.activeReader = null;
  if (activeReader) {
    await cancelReaderSafely(activeReader);

    try {
      activeReader.releaseLock();
    } catch {
      // no-op
    }
  }

  await releaseControlSignals(session);
  await delay(80);

  try {
    await session.port.close();
  } catch {
    // no-op
  }
};

export const writeLine = async (
  session,
  line
) => {
  if (
    !session ||
    session.closed ||
    !session.port?.writable
  ) {
    throw fail(
      "SERIAL_NOT_READY",
      "USB serial connection is not ready."
    );
  }

  let writer = null;

  try {
    writer = session.port.writable.getWriter();
    const payload = `${String(line || "")}\n`;
    await Promise.race([
      writer.write(session.encoder.encode(payload)),
      delay(WRITE_TIMEOUT_MS).then(() => {
        throw fail(
          "SERIAL_WRITE_TIMEOUT",
          "Timed out while sending data to device."
        );
      }),
    ]);
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    throw fail(
      "SERIAL_WRITE_FAILED",
      "Failed to send data to USB device."
    );
  } finally {
    try {
      writer.releaseLock();
    } catch {
      // no-op
    }
  }
};

export const readLine = async (
  session,
  timeoutMs = LINE_TIMEOUT_MS
) => {
  if (
    !session ||
    session.closed ||
    !session.port?.readable
  ) {
    throw fail(
      "SERIAL_NOT_READY",
      "USB serial connection is not ready."
    );
  }

  if (session.activeReader) {
    throw fail(
      "SERIAL_READER_BUSY",
      "Another serial read is already in progress."
    );
  }

  const reader = session.port.readable.getReader();
  session.activeReader = reader;

  try {
    const startedAt = Date.now();

    for (;;) {
      const newlineIdx =
        session.lineBuffer.indexOf("\n");
      if (newlineIdx >= 0) {
        const raw = session.lineBuffer.slice(
          0,
          newlineIdx
        );
        session.lineBuffer = session.lineBuffer.slice(
          newlineIdx + 1
        );
        return sanitizeLine(raw);
      }

      const remainingMs =
        timeoutMs - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        throw fail(
          "SERIAL_READ_TIMEOUT",
          "Timed out waiting for device response."
        );
      }

      let timer = null;
      let timedOut = false;
      let result;

      try {
        const timeoutPromise = new Promise(
          (_, reject) => {
            timer = setTimeout(() => {
              timedOut = true;
              reject(
                fail(
                  "SERIAL_READ_TIMEOUT",
                  "Timed out waiting for device response."
                )
              );
            }, remainingMs);
          }
        );

        result = await Promise.race([
          reader.read(),
          timeoutPromise,
        ]);
      } catch (error) {
        if (timedOut) {
          await cancelReaderSafely(reader);
        }

        if (error instanceof ProvisioningError) {
          throw error;
        }

        throw fail(
          "SERIAL_READ_FAILED",
          "Failed while reading serial data."
        );
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }

      if (result.done) {
        throw fail(
          "SERIAL_DISCONNECTED",
          "USB serial stream closed."
        );
      }

      session.lineBuffer += session.decoder.decode(
        result.value,
        {
          stream: true,
        }
      );
    }
  } finally {
    if (session.activeReader === reader) {
      session.activeReader = null;
    }

    try {
      reader.releaseLock();
    } catch {
      // no-op
    }
  }
};

const parseStrictJsonLine = (line) => {
  const raw = sanitizeLine(line);
  if (!raw.startsWith("{")) {
    throw fail(
      "HANDSHAKE_INVALID",
      "Invalid firmware response."
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw fail(
      "SERIAL_INVALID_JSON",
      "Device returned malformed JSON."
    );
  }
};

const readFirstJsonLine = async (
  session,
  timeoutMs = LINE_TIMEOUT_MS
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.max(
      50,
      deadline - Date.now()
    );
    const line = await readLine(
      session,
      remaining
    );
    const raw = sanitizeLine(line);

    if (!raw) {
      continue;
    }

    if (!raw.startsWith("{")) {
      // Ignore non-JSON boot/debug lines.
      continue;
    }

    return parseStrictJsonLine(raw);
  }

  throw fail(
    "HANDSHAKE_TIMEOUT",
    "Timed out waiting for firmware response."
  );
};

const readProvisioningAck = async (
  session,
  timeoutMs = PROVISION_ACK_TIMEOUT_MS
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.max(
      50,
      deadline - Date.now()
    );

    let line = "";
    try {
      line = await readLine(session, remaining);
    } catch (error) {
      if (
        error?.code === "SERIAL_DISCONNECTED"
      ) {
        // Device may reboot quickly after applying payload.
        return "rebooted";
      }

      if (error?.code === "SERIAL_READ_TIMEOUT") {
        return "none";
      }
      throw error;
    }

    const raw = sanitizeLine(line);
    if (!raw || !raw.startsWith("{")) {
      continue;
    }

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      continue;
    }

    if (payload?.accepted === true) {
      return "accepted";
    }

    if (payload?.accepted === false) {
      throw fail(
        "DEVICE_ACK_REJECTED",
        payload?.error
          ? `Device rejected provisioning payload: ${payload.error}`
          : "Device rejected provisioning payload."
      );
    }
  }

  return "none";
};

export const getFirmwareInfo = async (
  session
) => {
  let lastError = null;

  for (
    let attempt = 1;
    attempt <= FIRMWARE_INFO_ATTEMPTS;
    attempt += 1
  ) {
    try {
      await writeLine(session, "GET_FIRMWARE_INFO");
      const payload = await readFirstJsonLine(
        session,
        FIRMWARE_INFO_READ_TIMEOUT_MS
      );
      const firmwareVersion = String(
        payload?.firmwareVersion || ""
      ).trim();

      if (!firmwareVersion) {
        throw fail(
          "HANDSHAKE_INVALID",
          "Firmware version missing."
        );
      }

      return { firmwareVersion };
    } catch (error) {
      lastError = error;

      if (
        error?.code === "SERIAL_DISCONNECTED" ||
        error?.code === "SERIAL_NOT_READY"
      ) {
        throw error;
      }

      if (attempt < FIRMWARE_INFO_ATTEMPTS) {
        await delay(FIRMWARE_INFO_RETRY_DELAY_MS);
      }
    }
  }

  if (lastError instanceof ProvisioningError) {
    throw lastError;
  }

  throw fail(
    "HANDSHAKE_FAILED",
    "Firmware handshake failed."
  );
};

const normalizeApiError = (error) => {
  if (error?.status === 401) {
    return fail(
      "AUTH_EXPIRED",
      "Session expired. Please log in again.",
      401
    );
  }

  if (error?.status === 409) {
    return fail(
      "DEVICE_ALREADY_PROVISIONED",
      "Device is already provisioned.",
      409
    );
  }

  if (error?.status === 400) {
    return fail(
      "PROVISION_VALIDATION_FAILED",
      error?.message ||
        "Provisioning request validation failed.",
      400
    );
  }

  return fail(
    "BACKEND_PROVISION_FAILED",
    error?.message ||
      "Provisioning request failed.",
    error?.status
  );
};

const normalizeDeleteApiError = (
  error,
  fallbackCode,
  fallbackMessage
) => {
  if (error?.status === 401) {
    return fail(
      "AUTH_EXPIRED",
      "Session expired. Please log in again.",
      401
    );
  }

  if (error?.status === 403) {
    return fail(
      "DEVICE_DELETE_FORBIDDEN",
      "You are not allowed to delete this device.",
      403
    );
  }

  if (error?.status === 404) {
    return fail(
      "DEVICE_NOT_FOUND",
      "Device not found.",
      404
    );
  }

  return fail(
    fallbackCode,
    error?.message || fallbackMessage,
    error?.status
  );
};

const normalizeDeviceApiBaseUrl = (
  apiBaseUrl
) => {
  const raw = String(apiBaseUrl || "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(
      raw,
      typeof window !== "undefined"
        ? window.location.origin
        : undefined
    );
    const pathname = parsed.pathname.replace(
      /\/+$/,
      ""
    );
    const withoutApiSuffix = pathname.replace(
      /\/api\/v\d+$/i,
      ""
    );
    return `${parsed.protocol}//${parsed.host}${withoutApiSuffix}`;
  } catch {
    return "";
  }
};

const inferDeviceApiBaseUrl = () => {
  const normalized = normalizeDeviceApiBaseUrl(
    api?.defaults?.baseURL
  );
  try {
    const parsed = new URL(normalized);
    const host = String(
      parsed.hostname || ""
    ).toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1"
    ) {
      return "";
    }
  } catch {
    return "";
  }
  return normalized;
};

const inferMqttHostFromApiBaseUrl = (
  apiBaseUrl
) => {
  try {
    const parsed = new URL(apiBaseUrl);
    const host = String(parsed.hostname || "").trim();
    if (!host) {
      return "";
    }

    const normalizedHost = host.toLowerCase();
    if (
      normalizedHost === "localhost" ||
      normalizedHost === "127.0.0.1" ||
      normalizedHost === "::1"
    ) {
      return "";
    }

    return host;
  } catch {
    return "";
  }
};

export const claimDevice = async ({
  deviceName,
}) => {
  try {
    const response = await api.post(
      `${ENDPOINTS.DEVICES}/provision`,
      {
        deviceName,
      }
    );

    const payload = response?.data;
    const deviceId = String(
      payload?.deviceId || ""
    ).trim();
    const deviceSecret = String(
      payload?.deviceSecret || ""
    );
    const backendApiBaseUrl =
      normalizeDeviceApiBaseUrl(
        payload?.deviceApiBaseUrl
      );
    const inferredApiBaseUrl =
      inferDeviceApiBaseUrl();
    const deviceApiBaseUrl =
      backendApiBaseUrl || inferredApiBaseUrl;
    const backendMqttHost = String(
      payload?.deviceMqttHost || ""
    ).trim();
    const deviceMqttHost =
      backendMqttHost ||
      inferMqttHostFromApiBaseUrl(
        deviceApiBaseUrl
      );

    if (!deviceId || !deviceSecret) {
      throw fail(
        "PROVISION_SECRET_MISSING",
        "Provisioning material was not issued by backend."
      );
    }

    return {
      id: payload?.id || null,
      deviceId,
      deviceName:
        payload?.deviceName || deviceName,
      deviceSecret,
      deviceApiBaseUrl,
      deviceMqttHost,
    };
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    throw normalizeApiError(error);
  }
};

export const sendProvisioningPayload = async (
  session,
  {
    deviceId,
    ssid,
    password,
    deviceSecret,
    apiBaseUrl = "",
    mqttHost = "",
  }
) => {
  if (
    !deviceId ||
    !ssid ||
    !password ||
    !deviceSecret
  ) {
    throw fail(
      "PROVISION_INPUT_INVALID",
      "Missing device identity, WiFi credentials, or device secret."
    );
  }

  const payload = JSON.stringify({
    deviceId,
    ssid,
    password,
    deviceSecret,
    ...(String(apiBaseUrl || "").trim()
      ? {
          apiBaseUrl: normalizeDeviceApiBaseUrl(
            apiBaseUrl
          ),
        }
      : {}),
    ...(String(mqttHost || "").trim()
      ? { mqttHost: String(mqttHost).trim() }
      : {}),
  });

  await writeLine(session, payload);
  const ackResult = await readProvisioningAck(
    session,
    PROVISION_ACK_TIMEOUT_MS
  );

  if (ackResult === "none") {
    throw fail(
      "PROVISION_APPLY_UNCONFIRMED",
      "Device did not confirm provisioning payload. Reconnect USB and retry."
    );
  }

  // Ensure ESP32 control lines are deasserted before reboot sequence completes.
  await releaseControlSignals(session);
  await delay(PROVISION_APPLY_SETTLE_MS);
};

const readFactoryResetAck = async (
  session,
  timeoutMs = FACTORY_RESET_ACK_TIMEOUT_MS
) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const remaining = Math.max(
      50,
      deadline - Date.now()
    );

    let line = "";
    try {
      line = await readLine(session, remaining);
    } catch (error) {
      if (
        error?.code === "SERIAL_DISCONNECTED"
      ) {
        return "rebooted";
      }

      if (error?.code === "SERIAL_READ_TIMEOUT") {
        return "none";
      }

      throw error;
    }

    const raw = sanitizeLine(line);
    if (!raw || !raw.startsWith("{")) {
      continue;
    }

    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      continue;
    }

    if (payload?.status === "resetting") {
      return "resetting";
    }
  }

  return "none";
};

export const sendFactoryResetCommand = async (
  session
) => {
  await writeLine(session, "FACTORY_RESET");
  const ackResult = await readFactoryResetAck(
    session,
    FACTORY_RESET_ACK_TIMEOUT_MS
  );

  if (ackResult === "none") {
    throw fail(
      "FACTORY_RESET_UNCONFIRMED",
      "Device did not confirm factory reset command."
    );
  }

  await releaseControlSignals(session);
  await delay(FACTORY_RESET_SETTLE_MS);
};

export const preDeleteDevice = async (
  deviceId
) => {
  if (!deviceId) {
    throw fail(
      "DEVICE_ID_REQUIRED",
      "Device ID required for delete flow."
    );
  }

  try {
    const response = await api.delete(
      `${ENDPOINTS.DEVICES}/${encodeURIComponent(deviceId)}/pre-delete`
    );
    return response?.data || null;
  } catch (error) {
    throw normalizeDeleteApiError(
      error,
      "PRE_DELETE_FAILED",
      "Unable to start secure delete."
    );
  }
};

export const finalizeDeleteDevice = async (
  deviceId
) => {
  if (!deviceId) {
    throw fail(
      "DEVICE_ID_REQUIRED",
      "Device ID required for delete flow."
    );
  }

  try {
    const response = await api.post(
      `${ENDPOINTS.DEVICES}/${encodeURIComponent(deviceId)}/finalize-delete`
    );
    return response?.data || null;
  } catch (error) {
    throw normalizeDeleteApiError(
      error,
      "FINALIZE_DELETE_FAILED",
      "Unable to finalize secure delete."
    );
  }
};

export const runBackendDeleteFlow = async ({
  deviceId,
  onProgress,
}) => {
  const progress =
    typeof onProgress === "function"
      ? onProgress
      : () => {};

  try {
    progress("pre_delete");
    await preDeleteDevice(deviceId);

    progress("finalize_delete");
    await finalizeDeleteDevice(deviceId);

    progress("completed");
    return { deleted: true };
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    throw fail(
      "DELETE_FAILED",
      error?.message ||
        "Unable to delete device."
    );
  }
};

export const runSecureDeleteFlow = async ({
  deviceId,
  onProgress,
}) => {
  const progress =
    typeof onProgress === "function"
      ? onProgress
      : () => {};

  let session = null;

  try {
    progress("request_usb");
    const port = await requestPort();

    progress("connect_usb");
    session = await openPort(port, {
      resetDeviceOnConnect: false,
    });

    progress("verify_firmware");
    await getFirmwareInfo(session);

    progress("pre_delete");
    await preDeleteDevice(deviceId);

    progress("factory_reset");
    await sendFactoryResetCommand(session);

    await closePort(session);
    session = null;

    progress("finalize_delete");
    await finalizeDeleteDevice(deviceId);

    progress("completed");
    return { deleted: true };
  } catch (error) {
    if (error instanceof ProvisioningError) {
      throw error;
    }

    throw fail(
      "SECURE_DELETE_FAILED",
      error?.message ||
        "Secure delete flow failed."
    );
  } finally {
    await closePort(session);
  }
};

export const getDeviceStatus = async (
  identifier
) => {
  try {
    const response = await api.get(
      `${ENDPOINTS.DEVICES}/${encodeURIComponent(identifier)}/status`
    );
    return response?.data || null;
  } catch (error) {
    if (error?.status === 401) {
      throw fail(
        "AUTH_EXPIRED",
        "Session expired. Please log in again.",
        401
      );
    }

    throw fail(
      "STATUS_LOOKUP_FAILED",
      error?.message ||
        "Unable to read device status.",
      error?.status
    );
  }
};

export const waitUntilOnline = async (
  identifier,
  options = {}
) => {
  const timeoutMs =
    Number(options.timeoutMs) || ONLINE_TIMEOUT_MS;
  const intervalMs =
    Number(options.intervalMs) ||
    ONLINE_POLL_INTERVAL_MS;
  const onPoll =
    typeof options.onPoll === "function"
      ? options.onPoll
      : null;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await getDeviceStatus(
      identifier
    );
    const lastSeenMs = toMilliseconds(
      status?.lastSeenAt
    );
    const seenRecently =
      lastSeenMs > 0 &&
      Date.now() - lastSeenMs < 30_000;
    const isOnline =
      status?.online === true || seenRecently;

    if (onPoll) {
      onPoll({
        status,
        isOnline,
      });
    }

    if (isOnline) {
      return {
        ...status,
        online: true,
      };
    }

    await new Promise((resolve) => {
      setTimeout(resolve, intervalMs);
    });
  }

  throw fail(
    "ONLINE_CONFIRMATION_TIMEOUT",
    "Device did not come online in the expected time window."
  );
};

export const runProvisioningFlow = async ({
  session,
  firmwareInfo,
  deviceName,
  ssid,
  password,
  onProgress,
}) => {
  const progress =
    typeof onProgress === "function"
      ? onProgress
      : () => {};

  if (
    !firmwareInfo ||
    !String(
      firmwareInfo.firmwareVersion || ""
    ).trim()
  ) {
    throw fail(
      "DEVICE_INFO_INVALID",
      "Firmware verification is required before provisioning."
    );
  }

  progress("claiming_device");
  progress("generating_secure_credentials");

  const claim = await claimDevice({
    deviceName,
  });

  progress("sending_credentials_to_device");
  await sendProvisioningPayload(session, {
    deviceId: claim.deviceId,
    ssid,
    password,
    deviceSecret: claim.deviceSecret,
    apiBaseUrl: claim.deviceApiBaseUrl,
    mqttHost: claim.deviceMqttHost,
  });
  claim.deviceSecret = "";

  await closePort(session);

  progress("connecting_wifi");
  progress("authenticating_cloud");

  const lookupId = claim.id || claim.deviceId;
  const finalStatus = await waitUntilOnline(
    lookupId
  );

  return {
    id: claim.id,
    deviceId: claim.deviceId,
    deviceName: claim.deviceName,
    online: finalStatus.online === true,
    status: finalStatus,
  };
};

export { ProvisioningError };
