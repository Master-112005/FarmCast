#pragma once

#include <Arduino.h>

#include "../services/gps_service.h"
#include "../services/mqtt_service.h"
#include "../services/soil_sensor_service.h"
#include "scheduler.h"

class TelemetryLoop {
 public:
  TelemetryLoop(SoilSensorService& soilSensor,
                GpsService& gpsService,
                MqttService& mqttService,
                uint32_t intervalMs);

  bool loop(uint32_t nowMs);

  bool hasPublishedSinceBoot() const;
  uint32_t lastPublishMs() const;
  uint32_t publishCount() const;

 private:
  SoilSensorService& soilSensor_;
  GpsService& gpsService_;
  MqttService& mqttService_;

  Scheduler scheduler_;

  bool publishedSinceBoot_;
  uint32_t lastPublishMs_;
  uint32_t publishCount_;
};