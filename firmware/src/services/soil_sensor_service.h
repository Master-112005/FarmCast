#pragma once

#include <Arduino.h>

struct SoilReading {
  float moisture = NAN;
  float temperature = NAN;
  bool valid = false;
};

class SoilSensorService {
 public:
  SoilSensorService(int moisturePin,
                    int temperaturePin,
                    int dryAdc,
                    int wetAdc,
                    float tempMvAt0,
                    float tempMvPerC,
                    bool allowNegativeTemperature);

  void begin();

 SoilReading read() const;

 private:
  bool isAdc1Pin(int pin) const;
  int mapMoisturePercentage(int raw) const;

  int moisturePin_;
  int temperaturePin_;
  int dryAdc_;
  int wetAdc_;
  float tempMvAt0_;
  float tempMvPerC_;
  bool allowNegativeTemperature_;
  bool initialized_;
};
