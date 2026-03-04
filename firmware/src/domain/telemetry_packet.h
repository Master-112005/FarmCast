#pragma once

#include <Arduino.h>

struct TelemetryPacket {
  String deviceId;
  double latitude = NAN;
  double longitude = NAN;
  float moisture = NAN;
  float temperature = NAN;
  uint32_t timestamp = 0;
  bool gpsValid = false;
  bool soilValid = false;
};
