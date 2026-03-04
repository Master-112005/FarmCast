#pragma once

#include <Arduino.h>

namespace topic_builder {

static constexpr const char* TOPIC_PREFIX = "devices";

inline String telemetry(const String& deviceId) {
  return String(TOPIC_PREFIX) + "/" + deviceId + "/telemetry";
}

inline String heartbeat(const String& deviceId) {
  return String(TOPIC_PREFIX) + "/" + deviceId + "/heartbeat";
}

inline String ota(const String& deviceId) {
  return String(TOPIC_PREFIX) + "/" + deviceId + "/ota";
}

inline String wifiUpdate(const String& deviceId) {
  return String(TOPIC_PREFIX) + "/" + deviceId + "/wifi/update";
}

inline String systemReset(const String& deviceId) {
  return String(TOPIC_PREFIX) + "/" + deviceId + "/system/reset";
}

}  // namespace topic_builder
