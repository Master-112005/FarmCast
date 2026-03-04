#include "wifi_service.h"

#include <WiFi.h>

#include "../utils/logger.h"

namespace {
const char* TAG = "WiFiService";
}

WifiService::WifiService(uint32_t reconnectIntervalMs)
    : ssid_(),
      password_(),
      reconnectIntervalMs_(reconnectIntervalMs),
      lastConnectAttemptMs_(0) {}

void WifiService::setCredentials(const String& ssid,
                                 const String& password) {
  ssid_ = ssid;
  password_ = password;
}

void WifiService::begin() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.disconnect(true);

  connect(millis());
}

void WifiService::loop(uint32_t nowMs) {
  if (isConnected()) {
    return;
  }

  if (lastConnectAttemptMs_ == 0 ||
      static_cast<uint32_t>(nowMs - lastConnectAttemptMs_) >=
          reconnectIntervalMs_) {
    connect(nowMs);
  }
}

void WifiService::stop() {
  WiFi.disconnect(true);
  lastConnectAttemptMs_ = 0;
}

bool WifiService::isConnected() const {
  return WiFi.status() == WL_CONNECTED;
}

String WifiService::ipAddress() const {
  return isConnected() ? WiFi.localIP().toString() : String("0.0.0.0");
}

void WifiService::connect(uint32_t nowMs) {
  lastConnectAttemptMs_ = nowMs;

  if (ssid_.length() == 0) {
    logger::error(TAG, "Missing WiFi SSID");
    return;
  }

  logger::info(TAG, "Connecting to WiFi...");
  logger::info(TAG, String("SSID: ") + ssid_);

  WiFi.begin(ssid_.c_str(), password_.c_str());

  uint32_t startAttempt = millis();

  // Wait up to 10 seconds for connection
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startAttempt < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    logger::info(TAG, "WiFi connected");
    logger::info(TAG, String("IP: ") + WiFi.localIP().toString());
  } else {
    logger::error(TAG, "WiFi connection failed");
  }
}
