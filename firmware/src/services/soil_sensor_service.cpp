#include "soil_sensor_service.h"

#include <Arduino.h>
#include <cmath>

#include "../utils/logger.h"

namespace {
const char* TAG = "SoilSensorService";
constexpr int kAdcMin = 0;
constexpr int kAdcMax = 4095;
constexpr int kMoistureSamples = 8;
constexpr int kTemperatureSamples = 4;
constexpr int kFloatingHighThreshold = 4090;
constexpr int kFloatingLowThreshold = 5;
constexpr int kStableSpanThreshold = 6;
constexpr int kMinRequiredVariance = 1;
constexpr int kNoisyFloatingSpanThreshold = 700;
constexpr float kTemperatureMaxC = 125.0f;
}

SoilSensorService::SoilSensorService(int moisturePin,
                                     int temperaturePin,
                                     int dryAdc,
                                     int wetAdc,
                                     float tempMvAt0,
                                     float tempMvPerC,
                                     bool allowNegativeTemperature)
    : moisturePin_(moisturePin),
      temperaturePin_(temperaturePin),
      dryAdc_(dryAdc),
      wetAdc_(wetAdc),
      tempMvAt0_(tempMvAt0),
      tempMvPerC_(tempMvPerC),
      allowNegativeTemperature_(allowNegativeTemperature),
      initialized_(false) {}

void SoilSensorService::begin() {
  if (!isAdc1Pin(moisturePin_) || !isAdc1Pin(temperaturePin_)) {
    logger::error(TAG,
                  "Invalid ADC pins. ESP32 ADC1 requires pins 32-39. moisturePin=" +
                      String(moisturePin_) + " temperaturePin=" + String(temperaturePin_));
    initialized_ = false;
    return;
  }

  pinMode(moisturePin_, INPUT);
  pinMode(temperaturePin_, INPUT);

  // Full-scale input range for ESP32 ADC.
  analogSetPinAttenuation(moisturePin_, ADC_11db);
  analogSetPinAttenuation(temperaturePin_, ADC_11db);
  analogReadResolution(12);  // 0-4095
  initialized_ = true;
}

SoilReading SoilSensorService::read() const {
  SoilReading reading;

  if (!initialized_) {
    logger::warn(TAG, "Soil sensor read skipped because service is not initialized");
    return reading;
  }

  int moistureMin = kAdcMax;
  int moistureMax = kAdcMin;
  long sum = 0;

  for (int i = 0; i < kMoistureSamples; i++) {
    const int raw = analogRead(moisturePin_);

    if (raw < kAdcMin || raw > kAdcMax) {
      logger::warn(TAG, "Moisture ADC out of range: " + String(raw));
      return reading;
    }

    sum += raw;
    moistureMin = min(moistureMin, raw);
    moistureMax = max(moistureMax, raw);
  }

  const int raw = static_cast<int>(sum / kMoistureSamples);
  const int span = moistureMax - moistureMin;

  const bool floatingHigh =
      raw >= kFloatingHighThreshold && span <= kStableSpanThreshold;
  const bool floatingLow = raw <= kFloatingLowThreshold;
  const bool floatingNoisy = span >= kNoisyFloatingSpanThreshold;
  const bool missingVariance = span < kMinRequiredVariance;
  if (floatingHigh || floatingLow || floatingNoisy || missingVariance) {
    logger::warn(TAG,
                 "Moisture input appears floating/invalid. raw=" + String(raw) +
                     " span=" + String(span));
    return reading;
  }

  const float moisture = static_cast<float>(mapMoisturePercentage(raw));

  long temperatureMvSum = 0;
  for (int i = 0; i < kTemperatureSamples; i++) {
    const int mv = analogReadMilliVolts(temperaturePin_);
    if (mv < 0) {
      logger::warn(TAG, "Temperature mV read invalid: " + String(mv));
      return reading;
    }
    temperatureMvSum += mv;
  }

  if (std::fabs(tempMvPerC_) < 0.0001f) {
    logger::error(TAG, "Temperature calibration invalid: tempMvPerC is zero");
    return reading;
  }

  const float avgMv = static_cast<float>(temperatureMvSum) /
                      static_cast<float>(kTemperatureSamples);
  const float temperature = (avgMv - tempMvAt0_) / tempMvPerC_;

  if (!std::isfinite(temperature) || temperature > kTemperatureMaxC) {
    logger::warn(TAG,
                 "Temperature value out of supported range: " +
                     String(temperature, 2));
    return reading;
  }

  if (!allowNegativeTemperature_ && temperature < 0.0f) {
    logger::warn(
        TAG,
        "Negative temperature not supported by current sensor profile");
    return reading;
  }

  Serial.printf("SOIL ADC RAW: %d\n", raw);
  Serial.printf("SOIL MOISTURE: %.2f\n", moisture);
  Serial.printf("SOIL TEMP: %.2f\n", temperature);

  reading.moisture = moisture;
  reading.temperature = temperature;
  reading.valid = true;
  return reading;
}

bool SoilSensorService::isAdc1Pin(int pin) const {
  return pin >= 32 && pin <= 39;
}

int SoilSensorService::mapMoisturePercentage(int raw) const {
  if (raw >= 3500) return 0;
  if (raw >= 3200) return 10;
  if (raw >= 2800) return 25;
  if (raw >= 2400) return 50;
  if (raw >= 2000) return 70;
  if (raw >= 1700) return 85;
  if (raw >= 1400) return 95;
  return 100;
}
