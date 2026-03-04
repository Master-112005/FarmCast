#pragma once

#include <Arduino.h>
#include <HardwareSerial.h>
#include <TinyGPS++.h>

class GpsService {
 public:
  GpsService(HardwareSerial& serial,
             bool enabled,
             int rxPin,
             int txPin,
             uint32_t baud);

  void begin();
  void loop();

  bool hasFix() const;
  double getLatitude() const;
  double getLongitude() const;
  uint32_t getSatelliteCount() const;
  float getHdop() const;

 private:
  void resetFix();  // Added for industrial stability control

  HardwareSerial& serial_;
  TinyGPSPlus gps_;

  bool enabled_;
  int rxPin_;
  int txPin_;
  uint32_t baud_;

  bool hasFix_;
  double latitude_;
  double longitude_;
  uint32_t satelliteCount_;
  float hdop_;

  // -------- Industrial Stability Fields --------
  uint32_t bootTimeMs_;
  uint8_t stableCounter_;
  uint8_t invalidCounter_;
  uint32_t lastDataTimestampMs_;
};