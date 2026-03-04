#pragma once

#include <Arduino.h>

class WifiService {
 public:
  explicit WifiService(uint32_t reconnectIntervalMs);

  void setCredentials(const String& ssid,
                      const String& password);

  void begin();
  void loop(uint32_t nowMs);
  void stop();

  bool isConnected() const;
  String ipAddress() const;

 private:
  void connect(uint32_t nowMs);

  String ssid_;
  String password_;
  uint32_t reconnectIntervalMs_;
  uint32_t lastConnectAttemptMs_;
};
