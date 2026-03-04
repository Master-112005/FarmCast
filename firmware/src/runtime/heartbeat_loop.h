#pragma once

#include <Arduino.h>

#include "../domain/firmware_info.h"
#include "../infrastructure/json_builder.h"
#include "../services/mqtt_service.h"
#include "scheduler.h"

class HeartbeatLoop {
 public:
  HeartbeatLoop(const JsonBuilder& jsonBuilder,
                MqttService& mqttService,
                const FirmwareInfo& firmwareInfo,
                uint32_t intervalMs);

  bool loop(uint32_t nowMs,
            bool wifiConnected,
            bool mqttConnected,
            bool authenticated,
            bool otaInProgress);

  uint32_t lastPublishMs() const;

 private:
  const JsonBuilder& jsonBuilder_;
  MqttService& mqttService_;
  const FirmwareInfo& firmwareInfo_;

  Scheduler scheduler_;
  uint32_t lastPublishMs_;
};
