#pragma once

#include <Arduino.h>
#include <Preferences.h>

class DeviceIdentityService {
 public:
  DeviceIdentityService();

  bool begin();

  String getDeviceId();
  String generateDeviceId() const;

  bool isProvisioned();
  bool markProvisioned(bool provisioned);

  bool hasWifiCredentials();
  bool hasDeviceSecret();

  String getWifiSsid();
  String getWifiPassword();
  String getDeviceSecret();
  String getApiBaseUrl();
  String getMqttHost();

  bool setDeviceId(const String& deviceId);
  bool setWifiCredentials(const String& ssid,
                          const String& password);
  bool setDeviceSecret(const String& secret);
  bool setApiBaseUrl(const String& apiBaseUrl);
  bool setMqttHost(const String& mqttHost);

  void clearProvisioningData();
  bool clearAllData();

  bool isFactoryResetRequested();
  void requestFactoryReset();
  void clearFactoryResetRequest();

 private:
  bool ensureReady();
  bool ensureDeviceId();
  bool provisioningMaterialsPresent();
  bool isValidDeviceId(const String& deviceId) const;

  String readString(const char* key);
  bool writeString(const char* key, const String& value);

  bool readBool(const char* key, bool defaultValue = false);
  bool writeBool(const char* key, bool value);

  Preferences preferences_;
  bool ready_;
  String cachedDeviceId_;
};
