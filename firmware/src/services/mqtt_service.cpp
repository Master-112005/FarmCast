#include "mqtt_service.h"

#include <Arduino.h>
#include <math.h>

#include "../utils/logger.h"

namespace {
const char* TAG = "MqttService";
}

MqttService* MqttService::instance_ = nullptr;

MqttService::MqttService(const char* host,
                         uint16_t port,
                         bool useTls,
                         bool tlsInsecure,
                         uint16_t keepAliveSeconds,
                         uint32_t reconnectInitialMs,
                         uint32_t reconnectMaxMs,
                         const JsonBuilder& jsonBuilder)
    : host_(host ? String(host) : String()),
      port_(port),
      useTls_(useTls),
      tlsInsecure_(tlsInsecure),
      keepAliveSeconds_(keepAliveSeconds),
      reconnectInitialMs_(reconnectInitialMs),
      reconnectMaxMs_(reconnectMaxMs),
      deviceId_(),
      jsonBuilder_(jsonBuilder),
      plainClient_(),
      tlsClient_(),
      client_(plainClient_),
      telemetryTopic_(),
      heartbeatTopic_(),
      otaTopic_(),
      wifiUpdateTopic_(),
      systemResetTopic_(),
      otaHandler_(nullptr),
      otaHandlerContext_(nullptr),
      wifiUpdateHandler_(nullptr),
      wifiUpdateHandlerContext_(nullptr),
      reconnectDelayMs_(reconnectInitialMs),
      nextReconnectAtMs_(0),
      authRejectedSignal_(false) {}

void MqttService::setBrokerHost(const String& host) {
  String normalized = host;
  normalized.trim();
  if (normalized.isEmpty()) {
    return;
  }

  host_ = normalized;
  client_.setServer(host_.c_str(), port_);
}

void MqttService::setDeviceId(const String& deviceId) {
  deviceId_ = deviceId;
}

const String& MqttService::deviceId() const {
  return deviceId_;
}

void MqttService::begin() {
  if (useTls_) {
    if (tlsInsecure_) {
      tlsClient_.setInsecure();
    }
    client_.setClient(tlsClient_);
  } else {
    client_.setClient(plainClient_);
  }

  client_.setServer(host_.c_str(), port_);
  client_.setKeepAlive(keepAliveSeconds_);
  client_.setBufferSize(1024);

  instance_ = this;
  client_.setCallback(MqttService::onMessage);
}

void MqttService::configureTopics(const String& telemetryTopic,
                                  const String& heartbeatTopic,
                                  const String& otaTopic,
                                  const String& wifiUpdateTopic,
                                  const String& systemResetTopic) {
  telemetryTopic_ = telemetryTopic;
  heartbeatTopic_ = heartbeatTopic;
  otaTopic_ = otaTopic;
  wifiUpdateTopic_ = wifiUpdateTopic;
  systemResetTopic_ = systemResetTopic;
}

void MqttService::setOtaHandler(OtaMessageHandler handler, void* context) {
  otaHandler_ = handler;
  otaHandlerContext_ = context;
}

void MqttService::setWifiUpdateHandler(WifiUpdateMessageHandler handler,
                                       void* context) {
  wifiUpdateHandler_ = handler;
  wifiUpdateHandlerContext_ = context;
}

void MqttService::loop(uint32_t nowMs,
                       bool wifiConnected,
                       const String& jwtToken,
                       bool tokenValid) {
  if (!wifiConnected || !tokenValid) {
    if (client_.connected()) {
      client_.disconnect();
      logger::warn(TAG, "MQTT disconnected due to WiFi/token state");
    }
    return;
  }

  if (client_.connected()) {
    client_.loop();
    return;
  }

  if (nextReconnectAtMs_ != 0 && nowMs < nextReconnectAtMs_) {
    return;
  }

  connect(nowMs, jwtToken);
}

bool MqttService::isConnected() {
  return client_.connected();
}

void MqttService::disconnect() {
  if (client_.connected()) {
    client_.disconnect();
  }
  nextReconnectAtMs_ = 0;
  reconnectDelayMs_ = reconnectInitialMs_;
  authRejectedSignal_ = false;
}

bool MqttService::consumeAuthRejectedSignal() {
  const bool signaled = authRejectedSignal_;
  authRejectedSignal_ = false;
  return signaled;
}

//
// ✅ INDUSTRIAL TELEMETRY PUBLISH (FIXED)
//
bool MqttService::publishTelemetry(const TelemetryPacket& packet) {
  if (!client_.connected()) {
    return false;
  }

  // Device identity must match
  if (packet.deviceId.length() == 0 || packet.deviceId != deviceId_) {
    logger::warn(TAG, "Telemetry packet deviceId mismatch");
    return false;
  }

  // 🔥 Sanitize NAN values before JSON build
  TelemetryPacket sanitized = packet;

  if (isnan(sanitized.latitude)) {
    sanitized.latitude = 0.0;
  }

  if (isnan(sanitized.longitude)) {
    sanitized.longitude = 0.0;
  }

  if (isnan(sanitized.moisture)) {
    sanitized.moisture = 0.0f;
  }

  if (isnan(sanitized.temperature)) {
    sanitized.temperature = 0.0f;
  }

  const String payload = jsonBuilder_.buildTelemetry(sanitized);

  if (payload.length() == 0) {
    logger::error(TAG, "JsonBuilder returned empty payload");
    return false;
  }

  const bool ok =
      client_.publish(telemetryTopic_.c_str(), payload.c_str(), false);

  if (!ok) {
    logger::warn(TAG, "MQTT publish failed");
  }

  return ok;
}

bool MqttService::publishHeartbeat(const String& payload, bool retained) {
  if (!client_.connected()) {
    return false;
  }

  return client_.publish(heartbeatTopic_.c_str(), payload.c_str(), retained);
}

bool MqttService::publishSystemReset(const String& payload) {
  if (!client_.connected() || systemResetTopic_.isEmpty()) {
    return false;
  }

  return client_.publish(systemResetTopic_.c_str(), payload.c_str(), false);
}

bool MqttService::connect(uint32_t nowMs, const String& jwtToken) {
  if (deviceId_.length() == 0) {
    logger::error(TAG, "Missing deviceId. MQTT connect aborted.");
    return false;
  }

  String clientId = String("mqtt-") + deviceId_;
  const String lastWill = "{\"online\":false,\"event\":\"offline\"}";

  logger::info(TAG, "Attempting MQTT connect...");
  logger::info(TAG, "Broker: " + host_ + ":" + String(port_));
  logger::info(TAG, "ClientId: " + clientId);
  logger::info(TAG, "Username (deviceId): " + deviceId_);
  logger::info(TAG, "JWT length: " + String(jwtToken.length()));

  const bool ok = client_.connect(clientId.c_str(),
                                  deviceId_.c_str(),
                                  jwtToken.c_str(),
                                  heartbeatTopic_.c_str(),
                                  1,
                                  true,
                                  lastWill.c_str());

  if (!ok) {
    if (client_.state() == 4 || client_.state() == 5) {
      authRejectedSignal_ = true;
    }

    logger::warn(TAG,
                 "MQTT connect failed, rc=" + String(client_.state()) +
                     " retryIn=" + String(reconnectDelayMs_));

    nextReconnectAtMs_ = nowMs + reconnectDelayMs_;
    reconnectDelayMs_ = reconnectDelayMs_ >= reconnectMaxMs_ / 2
                            ? reconnectMaxMs_
                            : reconnectDelayMs_ * 2;
    return false;
  }

  reconnectDelayMs_ = reconnectInitialMs_;
  nextReconnectAtMs_ = 0;

  logger::info(TAG, "MQTT connected. Subscribing command topics");

  if (!client_.subscribe(otaTopic_.c_str(), 1)) {
    logger::error(TAG, "Failed to subscribe OTA topic");
  }

  if (!wifiUpdateTopic_.isEmpty() &&
      !client_.subscribe(wifiUpdateTopic_.c_str(), 1)) {
    logger::error(TAG, "Failed to subscribe WiFi update topic");
  }

  return true;
}

void MqttService::onMessage(char* topic,
                            uint8_t* payload,
                            unsigned int length) {
  if (!instance_) {
    return;
  }
  instance_->handleMessage(topic, payload, length);
}

void MqttService::handleMessage(char* topic,
                                uint8_t* payload,
                                unsigned int length) {
  String topicStr = topic ? String(topic) : String();
  String payloadStr;
  payloadStr.reserve(length + 1);

  for (unsigned int i = 0; i < length; ++i) {
    payloadStr += static_cast<char>(payload[i]);
  }

  if (topicStr == otaTopic_) {
    logger::info(TAG, "OTA command received");
    if (otaHandler_) {
      otaHandler_(payloadStr, otaHandlerContext_);
    }
    return;
  }

  if (topicStr == wifiUpdateTopic_) {
    logger::info(TAG, "WiFi update command received");
    if (wifiUpdateHandler_) {
      wifiUpdateHandler_(payloadStr, wifiUpdateHandlerContext_);
    }
    return;
  }

  logger::debug(TAG, "MQTT message ignored for topic: " + topicStr);
}
