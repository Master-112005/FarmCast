#pragma once

#include <Arduino.h>

class BatteryService {
 public:
  BatteryService(int pin, float dividerRatio);

  void begin();
  float readVoltage() const;

 private:
  int pin_;
  float dividerRatio_;
};
