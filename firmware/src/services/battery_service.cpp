#include "battery_service.h"

#include <Arduino.h>

BatteryService::BatteryService(int pin, float dividerRatio)
    : pin_(pin), dividerRatio_(dividerRatio) {}

void BatteryService::begin() { pinMode(pin_, INPUT); }

float BatteryService::readVoltage() const {
  const int mv = analogReadMilliVolts(pin_);
  return (static_cast<float>(mv) / 1000.0f) * dividerRatio_;
}
