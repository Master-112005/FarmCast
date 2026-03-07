#include "telemetry_loop.h"

#include "../domain/telemetry_packet.h"
#include "../utils/logger.h"
#include "../utils/time_utils.h"

namespace {
const char* TAG = "TelemetryLoop";
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

  // Publish telemetry whenever soil data is valid.
  // GPS fix may be unavailable in indoor/obstructed environments.
  if (!soilValid) {
    scheduler_.markRun(nowMs);
    logger::warn(TAG,
                 "Telemetry skipped (INVALID_SOIL) gps=" +
                     String(gpsValid ? 1 : 0));
    return false;
  }

  // ---------------------------
  // Build Telemetry Packet
  // ---------------------------

  TelemetryPacket packet;
  packet.deviceId = mqttService_.deviceId();

  if (gpsValid) {
    packet.latitude = gpsService_.getLatitude();
    packet.longitude = gpsService_.getLongitude();
  } else {
    packet.latitude = NAN;
    packet.longitude = NAN;
  }

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
                   " gps=" +
                   String(gpsValid ? 1 : 0));

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
