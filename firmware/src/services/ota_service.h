#pragma once

#include <Arduino.h>

#include "../domain/firmware_info.h"
#include "../infrastructure/json_builder.h"
#include "mqtt_service.h"

class OtaService {
 public:
  OtaService(const JsonBuilder& jsonBuilder,
             MqttService& mqttService,
             const FirmwareInfo& firmwareInfo,
             uint32_t rebootDelayMs);

  void enqueueFromPayload(const String& payload);
  void loop(uint32_t nowMs, bool wifiConnected);

  bool isUpdateInProgress() const;
  bool isRebootPending() const;

 private:
  int compareVersions(const String& currentVersion,
                      const String& targetVersion) const;
  bool downloadAndApply(const OtaCommandPayload& command,
                        String& checksumOut,
                        String& errorOut);
  void publishOtaEvent(const String& event);

  const JsonBuilder& jsonBuilder_;
  MqttService& mqttService_;
  const FirmwareInfo& firmwareInfo_;
  uint32_t rebootDelayMs_;

  OtaCommandPayload pendingCommand_;
  bool commandPending_;

  bool updateInProgress_;
  bool rebootPending_;
  uint32_t rebootAtMs_;
};
