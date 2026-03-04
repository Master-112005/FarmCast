#include "gps_service.h"
#include <cmath>
#include "../utils/logger.h"

namespace {
const char* TAG = "GpsService";

constexpr uint32_t kDefaultGpsBaud = 9600;

// Practical field tuning (Farm-ready)
constexpr int kMinSatellitesForFix = 3;
constexpr float kMaxHdopForFix = 4.0f;

// Stability tuning
constexpr uint8_t kRequiredStableCycles = 3;
constexpr uint8_t kAllowedInvalidCyclesBeforeLoss = 5;

// Warmup time (30 seconds)
constexpr uint32_t kWarmupDurationMs = 30000;

// UART safety
constexpr size_t kMaxBytesPerLoop = 512;

// Timeout detection
constexpr uint32_t kDataTimeoutMs = 5000;
}

GpsService::GpsService(HardwareSerial& serial,
                       bool enabled,
                       int rxPin,
                       int txPin,
                       uint32_t baud)
    : serial_(serial),
      gps_(),
      enabled_(enabled),
      rxPin_(rxPin),
      txPin_(txPin),
      baud_(baud),
      hasFix_(false),
      latitude_(NAN),
      longitude_(NAN),
      satelliteCount_(0),
      hdop_(NAN),
      bootTimeMs_(0),
      stableCounter_(0),
      invalidCounter_(0),
      lastDataTimestampMs_(0) {}

void GpsService::begin() {
  if (!enabled_) {
    logger::warn(TAG, "GPS disabled by config");
    return;
  }

  const uint32_t serialBaud = baud_ == 0 ? kDefaultGpsBaud : baud_;
  serial_.begin(serialBaud, SERIAL_8N1, rxPin_, txPin_);

  bootTimeMs_ = millis();

  logger::info(TAG, "GPS initialized (industrial mode)");
}

void GpsService::loop() {
  if (!enabled_) return;

  size_t bytesProcessed = 0;

  while (serial_.available() > 0 && bytesProcessed < kMaxBytesPerLoop) {
    gps_.encode(static_cast<char>(serial_.read()));
    bytesProcessed++;
    lastDataTimestampMs_ = millis();
  }

  // Detect GPS signal timeout
  if (millis() - lastDataTimestampMs_ > kDataTimeoutMs) {
    if (hasFix_) {
      logger::warn(TAG, "GPS signal timeout");
    }
    resetFix();
    return;
  }

  if (!gps_.location.isUpdated()) return;

  const bool locationValid = gps_.location.isValid();
  const bool satellitesValid = gps_.satellites.isValid();
  const bool hdopValid = gps_.hdop.isValid();

  const double latitude = gps_.location.lat();
  const double longitude = gps_.location.lng();
  const uint32_t satellites =
      satellitesValid ? gps_.satellites.value() : 0;
  const float hdop =
      hdopValid ? static_cast<float>(gps_.hdop.hdop()) : NAN;

  const bool basicValid =
      locationValid &&
      satellitesValid &&
      hdopValid &&
      std::isfinite(latitude) &&
      std::isfinite(longitude);

  const bool qualityValid =
      basicValid &&
      satellites >= kMinSatellitesForFix &&
      hdop < kMaxHdopForFix;

  const bool inWarmup =
      (millis() - bootTimeMs_) < kWarmupDurationMs;

  bool acceptFix = false;

  if (qualityValid) {
    stableCounter_++;
    invalidCounter_ = 0;

    if (stableCounter_ >= kRequiredStableCycles || inWarmup) {
      acceptFix = true;
    }
  } else {
    stableCounter_ = 0;
    invalidCounter_++;
  }

  if (!acceptFix) {
    if (invalidCounter_ >= kAllowedInvalidCyclesBeforeLoss) {
      if (hasFix_) {
        logger::warn(TAG, "GPS fix lost (quality drop)");
      }
      resetFix();
    }
    return;
  }

  const bool newlyAcquired = !hasFix_;

  hasFix_ = true;
  latitude_ = latitude;
  longitude_ = longitude;
  satelliteCount_ = satellites;
  hdop_ = hdop;

  if (newlyAcquired) {
    Serial.println("GPS FIX ACQUIRED");
    logger::info(TAG, "GPS stable fix acquired");
  }

  Serial.printf("LAT: %.6f\n", latitude_);
  Serial.printf("LNG: %.6f\n", longitude_);
  Serial.printf("SATELLITES: %u\n", satelliteCount_);
  Serial.printf("HDOP: %.2f\n", hdop_);
}

void GpsService::resetFix() {
  hasFix_ = false;
  latitude_ = NAN;
  longitude_ = NAN;
  satelliteCount_ = 0;
  hdop_ = NAN;
}

bool GpsService::hasFix() const {
  return hasFix_;
}

double GpsService::getLatitude() const {
  return hasFix_ ? latitude_ : NAN;
}

double GpsService::getLongitude() const {
  return hasFix_ ? longitude_ : NAN;
}

uint32_t GpsService::getSatelliteCount() const {
  return satelliteCount_;
}

float GpsService::getHdop() const {
  return hdop_;
}