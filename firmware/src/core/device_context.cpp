#include "device_context.h"

#include <Arduino.h>
#include <ArduinoJson.h>

#include "../../include/build_info.h"
#include "../../include/config.h"
#include "../../include/topics.h"
#include "system_boot.h"
#include "../utils/logger.h"
#include "../utils/time_utils.h"

namespace {
const char* TAG = "DeviceContext";
}  // namespace

DeviceContext::DeviceContext()
    : firmwareInfo_{FW_VERSION, FW_BUILD_DATE, FW_BUILD_TIME},
      lifecycleState_(DeviceState::PROVISIONING),
      runtimeState_(),
      deviceIdentityService_(),
      deviceId_(),
      provisioningRxBuffer_(),
      jsonBuilder_(),
      httpClient_(firmware_config::AUTH_HTTP_TIMEOUT_MS,
                  firmware_config::ALLOW_INSECURE_TLS),
      wifiService_(firmware_config::WIFI_RECONNECT_INTERVAL_MS),
      authService_(httpClient_,
                   jsonBuilder_,
                   firmware_config::API_BASE_URL,
                   firmware_config::DEVICE_AUTH_PATH,
                   firmware_config::AUTH_RETRY_INITIAL_MS,
                   firmware_config::AUTH_RETRY_MAX_MS,
                   firmware_config::AUTH_TOKEN_REFRESH_SKEW_MS,
                   firmware_config::AUTH_FALLBACK_TOKEN_TTL_SEC,
                   firmware_config::AUTH_MAX_CONSECUTIVE_401),
      mqttService_(firmware_config::MQTT_HOST,
                   firmware_config::MQTT_PORT,
                   firmware_config::MQTT_USE_TLS,
                   firmware_config::MQTT_TLS_INSECURE,
                   firmware_config::MQTT_KEEP_ALIVE_SECONDS,
                   firmware_config::MQTT_RECONNECT_INTERVAL_MS,
                   firmware_config::MQTT_RECONNECT_MAX_MS,
                   jsonBuilder_),
      soilSensorService_(firmware_config::PIN_SOIL_MOISTURE,
                         firmware_config::PIN_TEMPERATURE,
                         firmware_config::ADC_MOISTURE_DRY,
                         firmware_config::ADC_MOISTURE_WET,
                         firmware_config::TEMP_MV_AT_0C,
                         firmware_config::TEMP_MV_PER_C,
                         firmware_config::TEMP_ALLOW_NEGATIVE),
      batteryService_(firmware_config::PIN_BATTERY,
                      firmware_config::BATTERY_DIVIDER_RATIO),
      gpsService_(Serial2,
                  firmware_config::GPS_ENABLED,
                  firmware_config::GPS_RX_PIN,
                  firmware_config::GPS_TX_PIN,
                  firmware_config::GPS_BAUD),
      otaService_(jsonBuilder_,
                  mqttService_,
                  firmwareInfo_,
                  firmware_config::OTA_REBOOT_DELAY_MS),
      telemetryLoop_(soilSensorService_,
                     gpsService_,
                     mqttService_,
                     firmware_config::TELEMETRY_INTERVAL_MS),
      heartbeatLoop_(jsonBuilder_,
                     mqttService_,
                     firmwareInfo_,
                     firmware_config::HEARTBEAT_INTERVAL_MS),
      deepSleepAtMs_(0) {}

void DeviceContext::begin() {
  system_boot::initializeSerial(firmware_config::SERIAL_BAUD_RATE);

  logger::begin(static_cast<LogLevel>(firmware_config::LOG_LEVEL));
  system_boot::initializeWatchdog(firmware_config::WATCHDOG_TIMEOUT_SECONDS);
  system_boot::logBootInfo(firmwareInfo_);

  if (!deviceIdentityService_.begin()) {
    enterProvisioningMode("identity service init failed");
    return;
  }

  deviceId_ = deviceIdentityService_.getDeviceId();
  const String persistedApiBaseUrl =
      deviceIdentityService_.getApiBaseUrl();
  const String persistedMqttHost =
      deviceIdentityService_.getMqttHost();

  if (persistedApiBaseUrl.length() > 0) {
    authService_.setApiBaseUrl(persistedApiBaseUrl);
    logger::info(TAG, String("Using provisioned API base URL: ") + persistedApiBaseUrl);
  } else {
    authService_.setApiBaseUrl(String(firmware_config::API_BASE_URL));
  }

  if (persistedMqttHost.length() > 0) {
    mqttService_.setBrokerHost(persistedMqttHost);
    logger::info(TAG, String("Using provisioned MQTT host: ") + persistedMqttHost);
  } else {
    mqttService_.setBrokerHost(String(firmware_config::MQTT_HOST));
  }

  if (deviceIdentityService_.isFactoryResetRequested()) {
    logger::warn(TAG, "Factory reset flag detected during boot. Wiping identity data.");
    deviceIdentityService_.clearAllData();
    deviceId_ = deviceIdentityService_.getDeviceId();
  }

  lifecycleState_ =
      system_boot::resolveInitialDeviceState(deviceIdentityService_.isProvisioned());
  logger::info(TAG, String("Lifecycle state: ") + system_boot::toString(lifecycleState_));

  soilSensorService_.begin();
  batteryService_.begin();
  gpsService_.begin();

  if (lifecycleState_ == DeviceState::PROVISIONING) {
    enterProvisioningMode("provisioning data incomplete");
    return;
  }

  wifiService_.setCredentials(deviceIdentityService_.getWifiSsid(),
                              deviceIdentityService_.getWifiPassword());
  authService_.setCredentials(deviceId_, deviceIdentityService_.getDeviceSecret());
  mqttService_.setDeviceId(deviceId_);

  wifiService_.begin();

  mqttService_.begin();
  configureMqttTopics();
  mqttService_.setOtaHandler(DeviceContext::handleOtaPayload, this);
  mqttService_.setWifiUpdateHandler(DeviceContext::handleWifiUpdatePayload, this);
}

void DeviceContext::loop() {
  const uint32_t nowMs = millis();
  system_boot::feedWatchdog();

  // Always service USB serial commands so firmware verification can run
  // even when the device is already provisioned and online.
  handleProvisioning();

  if (lifecycleState_ == DeviceState::PROVISIONING) {
    applyFactoryResetIfRequested();
    return;
  }

  applyFactoryResetIfRequested();

  gpsService_.loop();
  wifiService_.loop(nowMs);

  const bool wifiConnected = wifiService_.isConnected();

  authService_.loop(nowMs, wifiConnected);
  String pendingAuthWifiSsid;
  String pendingAuthWifiPassword;
  if (authService_.consumeWifiUpdate(pendingAuthWifiSsid,
                                     pendingAuthWifiPassword)) {
    applyWifiCredentialsUpdate(pendingAuthWifiSsid,
                               pendingAuthWifiPassword,
                               "auth_response");
    return;
  }

  if (authService_.consumeFactoryResetSignal()) {
    factoryReset("auth_required_threshold_reached");
    return;
  }

  const bool tokenValid = authService_.hasValidToken(nowMs);
  mqttService_.loop(nowMs, wifiConnected, authService_.token(), tokenValid);

  if (mqttService_.consumeAuthRejectedSignal()) {
    logger::warn(TAG,
                 "MQTT auth rejected token. Triggering immediate auth refresh.");
    authService_.clearSession();
    mqttService_.disconnect();
  }

  otaService_.loop(nowMs, wifiConnected);

  bool telemetryPublished = false;
  if (!otaService_.isUpdateInProgress() && !otaService_.isRebootPending()) {
    telemetryPublished = telemetryLoop_.loop(nowMs);
  }

  heartbeatLoop_.loop(nowMs,
                      wifiConnected,
                      mqttService_.isConnected(),
                      authService_.isAuthenticated(),
                      otaService_.isUpdateInProgress());

  runtimeState_.wifiConnected = wifiConnected;
  runtimeState_.mqttConnected = mqttService_.isConnected();
  runtimeState_.authenticated = authService_.isAuthenticated();
  runtimeState_.otaInProgress = otaService_.isUpdateInProgress();

  if (telemetryPublished) {
    runtimeState_.lastTelemetryPublishMs = telemetryLoop_.lastPublishMs();
  }

  runtimeState_.lastStatusPublishMs = heartbeatLoop_.lastPublishMs();

  updateLifecycleState(runtimeState_.wifiConnected,
                       runtimeState_.authenticated,
                       runtimeState_.mqttConnected);

  maybeLogHeap(nowMs);
  maybeEnterDeepSleep(nowMs, telemetryPublished);
}

void DeviceContext::handleOtaPayload(const String& payload, void* context) {
  if (!context) {
    return;
  }

  DeviceContext* self = static_cast<DeviceContext*>(context);
  self->onOtaPayload(payload);
}

void DeviceContext::onOtaPayload(const String& payload) {
  otaService_.enqueueFromPayload(payload);
}

void DeviceContext::handleWifiUpdatePayload(const String& payload, void* context) {
  if (!context) {
    return;
  }

  DeviceContext* self = static_cast<DeviceContext*>(context);
  self->onWifiUpdatePayload(payload);
}

void DeviceContext::onWifiUpdatePayload(const String& payload) {
  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    logger::warn(TAG, "Rejected WiFi update: invalid_json");
    return;
  }

  const char* ssid = doc["ssid"];
  const char* password = doc["password"];

  if (!ssid || !password || ssid[0] == '\0' || password[0] == '\0') {
    logger::warn(TAG, "Rejected WiFi update: missing_fields");
    return;
  }

  const String nextSsid = String(ssid);
  const String nextPassword = String(password);
  applyWifiCredentialsUpdate(nextSsid, nextPassword, "mqtt");
}

void DeviceContext::applyWifiCredentialsUpdate(const String& nextSsid,
                                               const String& nextPassword,
                                               const String& source) {
  const String currentSsid = deviceIdentityService_.getWifiSsid();
  const String currentPassword = deviceIdentityService_.getWifiPassword();

  if (nextSsid == currentSsid && nextPassword == currentPassword) {
    logger::info(TAG,
                 "WiFi update ignored: credentials unchanged source=" + source);
    return;
  }

  if (!deviceIdentityService_.setWifiCredentials(nextSsid, nextPassword)) {
    logger::error(TAG, "Failed persisting WiFi credentials update");
    return;
  }

  logger::warn(TAG, "WiFi credentials updated. source=" + source + " reconnecting...");

  mqttService_.disconnect();
  authService_.clearSession();
  wifiService_.stop();
  wifiService_.setCredentials(nextSsid, nextPassword);
  wifiService_.begin();
}

void DeviceContext::sendFirmwareInfo() {
  JsonDocument doc;
  doc["firmwareVersion"] = firmwareInfo_.version;
  doc["state"] = system_boot::toString(lifecycleState_);
  serializeJson(doc, Serial);
  Serial.println();
  Serial.flush();
}

void DeviceContext::sendProvisioningAck(bool accepted, const String& error) {
  JsonDocument ack;
  ack["accepted"] = accepted;
  if (!accepted && error.length() > 0) {
    ack["error"] = error;
  }

  serializeJson(ack, Serial);
  Serial.println();
  Serial.flush();
}

void DeviceContext::handleProvisioning() {
  while (Serial.available()) {
    const int next = Serial.read();
    if (next < 0) {
      return;
    }

    const char ch = static_cast<char>(next);

    if (ch == '\r') {
      continue;
    }

    if (ch != '\n') {
      if (provisioningRxBuffer_.length() < 1024) {
        provisioningRxBuffer_ += ch;
      } else {
        provisioningRxBuffer_ = "";
      }
      continue;
    }

    String command = provisioningRxBuffer_;
    provisioningRxBuffer_ = "";
    command.trim();

    if (command.length() == 0) {
      continue;
    }

    if (command.equals("GET_FIRMWARE_INFO")) {
      sendFirmwareInfo();
      return;
    }

    if (command.equals("FACTORY_RESET")) {
      handleFactoryReset();
      return;
    }

    if (command.startsWith("{")) {
      if (lifecycleState_ != DeviceState::PROVISIONING) {
        sendProvisioningAck(false, "not_in_provisioning_mode");
        return;
      }
      handleProvisionPayload(command);
      return;
    }
  }
}

void DeviceContext::handleProvisionPayload(const String& payload) {
  JsonDocument doc;
  const DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    sendProvisioningAck(false, "invalid_json");
    return;
  }

  const char* ssid = doc["ssid"];
  const char* password = doc["password"];
  const char* secret = doc["deviceSecret"];
  const char* deviceId = doc["deviceId"];
  const char* apiBaseUrl = doc["apiBaseUrl"];
  const char* mqttHost = doc["mqttHost"];

  if (!ssid || !password || !secret || !deviceId) {
    sendProvisioningAck(false, "missing_fields");
    return;
  }

  if (ssid[0] == '\0' || password[0] == '\0' || secret[0] == '\0' ||
      deviceId[0] == '\0') {
    sendProvisioningAck(false, "empty_fields");
    return;
  }

  const bool deviceIdSaved =
      deviceIdentityService_.setDeviceId(String(deviceId));
  const bool wifiSaved =
      deviceIdentityService_.setWifiCredentials(String(ssid), String(password));
  const bool secretSaved =
      deviceIdentityService_.setDeviceSecret(String(secret));
  const bool apiBaseUrlSaved =
      deviceIdentityService_.setApiBaseUrl(
          String(apiBaseUrl && apiBaseUrl[0] != '\0'
                     ? apiBaseUrl
                     : firmware_config::API_BASE_URL));
  const bool mqttHostSaved =
      deviceIdentityService_.setMqttHost(
          String(mqttHost && mqttHost[0] != '\0'
                     ? mqttHost
                     : firmware_config::MQTT_HOST));
  const bool marked =
      deviceIdentityService_.markProvisioned(true);

  if (!deviceIdSaved || !wifiSaved || !secretSaved || !apiBaseUrlSaved ||
      !mqttHostSaved || !marked) {
    deviceIdentityService_.clearProvisioningData();
    sendProvisioningAck(false, "persist_failed");
    return;
  }

  sendProvisioningAck(true);

  delay(500);
  ESP.restart();
}

void DeviceContext::handleFactoryReset() {
  logger::warn(TAG, "USB FACTORY_RESET command received");
  logger::warn(TAG, "SECURITY_EVENT USB_FACTORY_RESET_TRIGGERED");

  mqttService_.disconnect();
  wifiService_.stop();
  authService_.clearCredentials();

  // Secure delete flow keeps immutable device identity but removes all
  // provisioning materials, forcing deterministic return to provisioning.
  deviceIdentityService_.clearProvisioningData();
  wifiService_.setCredentials(String(), String());
  mqttService_.setDeviceId(String());
  provisioningRxBuffer_ = "";
  runtimeState_ = DeviceRuntimeState{};
  lifecycleState_ = DeviceState::PROVISIONING;

  JsonDocument response;
  response["status"] = "resetting";
  serializeJson(response, Serial);
  Serial.println();
  Serial.flush();

  delay(500);
  ESP.restart();
}

void DeviceContext::applyFactoryResetIfRequested() {
  if (!deviceIdentityService_.isFactoryResetRequested()) {
    return;
  }

  factoryReset("factory_reset_requested_flag");
}

void DeviceContext::factoryReset(const String& reason) {
  logger::warn(TAG, String("SECURITY_EVENT FACTORY_RESET_TRIGGERED reason=") + reason);
  logger::error(TAG, String("Factory reset initiated. reason=") + reason);

  if (mqttService_.isConnected()) {
    JsonDocument eventDoc;
    eventDoc["event"] = "factory_reset";
    eventDoc["deviceId"] = deviceId_;
    eventDoc["timestamp"] = millis();
    String payload;
    serializeJson(eventDoc, payload);
    mqttService_.publishSystemReset(payload);
  }

  mqttService_.disconnect();
  wifiService_.stop();

  const bool identityCleared = deviceIdentityService_.clearAllData();
  if (!identityCleared) {
    logger::error(TAG, "Factory reset failed to clear identity namespace");
  }

  authService_.clearCredentials();
  mqttService_.setDeviceId(String());
  wifiService_.setCredentials(String(), String());
  deviceId_ = "";
  provisioningRxBuffer_ = "";
  runtimeState_ = DeviceRuntimeState{};
  deepSleepAtMs_ = 0;
  lifecycleState_ = DeviceState::PROVISIONING;

  delay(1000);
  ESP.restart();
}

void DeviceContext::enterProvisioningMode(const String& reason) {
  lifecycleState_ = DeviceState::PROVISIONING;
  deepSleepAtMs_ = 0;

  runtimeState_.wifiConnected = false;
  runtimeState_.mqttConnected = false;
  runtimeState_.authenticated = false;
  runtimeState_.otaInProgress = false;

  logger::warn(TAG, String("Entering provisioning mode: ") + reason);
}

void DeviceContext::configureMqttTopics() {
  if (deviceId_.length() == 0) {
    return;
  }

  mqttService_.configureTopics(
      topic_builder::telemetry(deviceId_),
      topic_builder::heartbeat(deviceId_),
      topic_builder::ota(deviceId_),
      topic_builder::wifiUpdate(deviceId_),
      topic_builder::systemReset(deviceId_));
}

void DeviceContext::updateLifecycleState(bool wifiConnected,
                                         bool authenticated,
                                         bool mqttConnected) {
  if (lifecycleState_ == DeviceState::PROVISIONING) {
    return;
  }

  DeviceState next = DeviceState::CONNECTING_WIFI;

  if (!wifiConnected) {
    next = DeviceState::CONNECTING_WIFI;
  } else if (!authenticated || !mqttConnected) {
    next = DeviceState::AUTHENTICATING;
  } else {
    next = DeviceState::ONLINE;
  }

  if (next != lifecycleState_) {
    lifecycleState_ = next;
    logger::info(TAG,
                 String("Lifecycle state -> ") + system_boot::toString(lifecycleState_));
  }
}

void DeviceContext::maybeLogHeap(uint32_t nowMs) {
  if (!time_utils::isDue(nowMs,
                         runtimeState_.lastHeapLogMs,
                         firmware_config::MEMORY_LOG_INTERVAL_MS)) {
    return;
  }

  runtimeState_.lastHeapLogMs = nowMs;

  logger::info(TAG,
               "Heap free=" + String(ESP.getFreeHeap()) +
                   " min=" + String(ESP.getMinFreeHeap()) +
                   " state=" + system_boot::toString(lifecycleState_) +
                   " wifi=" + (runtimeState_.wifiConnected ? "1" : "0") +
                   " mqtt=" + (runtimeState_.mqttConnected ? "1" : "0"));
}

void DeviceContext::maybeEnterDeepSleep(uint32_t nowMs,
                                        bool telemetryPublished) {
  if (!firmware_config::DEEP_SLEEP_ENABLED) {
    return;
  }

  if (lifecycleState_ == DeviceState::PROVISIONING) {
    return;
  }

  if (otaService_.isUpdateInProgress() || otaService_.isRebootPending()) {
    return;
  }

  if (telemetryPublished) {
    deepSleepAtMs_ = nowMs + firmware_config::DEEP_SLEEP_GRACE_MS;
  }

  if (deepSleepAtMs_ == 0 || nowMs < deepSleepAtMs_) {
    return;
  }

  if (!telemetryLoop_.hasPublishedSinceBoot()) {
    return;
  }

  if (mqttService_.isConnected()) {
    const String payload = jsonBuilder_.buildStatus(
        true, String(firmwareInfo_.version), "sleeping", ESP.getFreeHeap());
    mqttService_.publishHeartbeat(payload, true);
  }

  system_boot::enterDeepSleep(firmware_config::DEEP_SLEEP_SECONDS);
}
