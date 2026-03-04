#pragma once

#include <Arduino.h>

enum class DeviceState : uint8_t {
  PROVISIONING = 0,
  CONNECTING_WIFI,
  AUTHENTICATING,
  ONLINE,
};

struct DeviceRuntimeState {
  bool wifiConnected = false;
  bool mqttConnected = false;
  bool authenticated = false;
  bool otaInProgress = false;

  uint32_t lastTelemetryPublishMs = 0;
  uint32_t lastStatusPublishMs = 0;
  uint32_t lastHeapLogMs = 0;
};
