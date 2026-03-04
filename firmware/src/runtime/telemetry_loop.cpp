#include "telemetry_loop.h"

#include "../domain/telemetry_packet.h"
#include "../utils/logger.h"
#include "../utils/time_utils.h"

namespace {
const char* TAG = "TelemetryLoop";

// Stale thresholds (industrial tuning)
constexpr uint32_t kGpsStaleThresholdMs = 10000;
constexpr uint32_t kSoilStaleThresholdMs = 10000;
}

TelemetryLoop::TelemetryLoop(SoilSensorService& soilSensor,
                             GpsService& gpsService,
                             MqttService& mqttService,
                             uint32_t intervalMs)
    : soilSensor_(soilSensor),
      gpsService_(gpsService),
      mqttService_(mqttService),
      scheduler_(intervalMs),
      publishedSinceBoot_(false),
      lastPublishMs_(0),
      publishCount_(0) {}

bool TelemetryLoop::loop(uint32_t nowMs) {
  if (!scheduler_.isDue(nowMs)) {
    return false;
  }

  if (!mqttService_.isConnected()) {
    scheduler_.markRun(nowMs);
    return false;
  }

  // ---------------------------
  // Read Sensors
  // ---------------------------

  const SoilReading soilReading = soilSensor_.read();
  const bool gpsValid = gpsService_.hasFix();
  const bool soilValid = soilReading.valid;

  // Backend contract only accepts telemetry with both validity flags true.
  if (!gpsValid || !soilValid) {
    scheduler_.markRun(nowMs);
    logger::warn(TAG,
                 "Telemetry skipped (INVALID) gps=" +
                     String(gpsValid ? 1 : 0) +
                     " soil=" +
                     String(soilValid ? 1 : 0));
    return false;
  }

  // ---------------------------
  // Build Telemetry Packet
  // ---------------------------

  TelemetryPacket packet;
  packet.deviceId = mqttService_.deviceId();

  packet.latitude = gpsService_.getLatitude();
  packet.longitude = gpsService_.getLongitude();

  packet.moisture = soilReading.moisture;
  packet.temperature = soilReading.temperature;

  packet.timestamp =
      static_cast<uint32_t>(time_utils::millis64() / 1000ULL);

  packet.gpsValid = gpsValid;
  packet.soilValid = soilValid;

  // ---------------------------
  // Publish Valid Telemetry
  // ---------------------------

  const bool ok = mqttService_.publishTelemetry(packet);
  scheduler_.markRun(nowMs);

  if (!ok) {
    logger::warn(TAG, "Telemetry publish failed");
    return false;
  }

  publishCount_++;
  publishedSinceBoot_ = true;
  lastPublishMs_ = nowMs;

  // ---------------------------
  // Intelligent Logging
  // ---------------------------

  logger::info(TAG,
               "Telemetry OK | moisture=" +
                   String(packet.moisture, 2) +
                   " temp=" +
                   String(packet.temperature, 2) +
                   " lat=" +
                   String(packet.latitude, 6) +
                   " lng=" +
                   String(packet.longitude, 6));

  return true;
}

bool TelemetryLoop::hasPublishedSinceBoot() const {
  return publishedSinceBoot_;
}

uint32_t TelemetryLoop::lastPublishMs() const {
  return lastPublishMs_;
}

uint32_t TelemetryLoop::publishCount() const {
  return publishCount_;
}
