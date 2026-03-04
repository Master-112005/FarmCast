#include "heartbeat_loop.h"

#include "../utils/logger.h"

namespace {
const char* TAG = "HeartbeatLoop";
}

HeartbeatLoop::HeartbeatLoop(const JsonBuilder& jsonBuilder,
                             MqttService& mqttService,
                             const FirmwareInfo& firmwareInfo,
                             uint32_t intervalMs)
    : jsonBuilder_(jsonBuilder),
      mqttService_(mqttService),
      firmwareInfo_(firmwareInfo),
      scheduler_(intervalMs),
      lastPublishMs_(0) {}

bool HeartbeatLoop::loop(uint32_t nowMs,
                         bool wifiConnected,
                         bool mqttConnected,
                         bool authenticated,
                         bool otaInProgress) {
  if (!scheduler_.isDue(nowMs)) {
    return false;
  }

  if (!mqttService_.isConnected()) {
    return false;
  }

  String event = "heartbeat";
  event += wifiConnected ? "|wifi:1" : "|wifi:0";
  event += mqttConnected ? "|mqtt:1" : "|mqtt:0";
  event += authenticated ? "|auth:1" : "|auth:0";
  event += otaInProgress ? "|ota:1" : "|ota:0";

  const String payload = jsonBuilder_.buildStatus(
      true, String(firmwareInfo_.version), event, ESP.getFreeHeap());

  const bool ok = mqttService_.publishHeartbeat(payload, false);
  scheduler_.markRun(nowMs);

  if (!ok) {
    logger::warn(TAG, "Heartbeat publish failed");
    return false;
  }

  lastPublishMs_ = nowMs;
  return true;
}

uint32_t HeartbeatLoop::lastPublishMs() const { return lastPublishMs_; }
