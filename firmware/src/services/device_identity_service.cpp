#include "device_identity_service.h"

#include <cstring>
#include <esp_system.h>

#include "../../include/device_identity.h"
#include "../utils/logger.h"

namespace {
const char* TAG = "DeviceIdentity";
const char* kAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const uint8_t kAlphabetLength = 36;
}  // namespace

DeviceIdentityService::DeviceIdentityService()
    : preferences_(),
      ready_(false),
      cachedDeviceId_() {}

bool DeviceIdentityService::begin() {
  if (ready_) {
    return true;
  }

  if (!preferences_.begin(device_identity::NVS_NAMESPACE, false)) {
    logger::error(TAG, "Unable to open NVS namespace");
    return false;
  }

  ready_ = true;

  // Device identity is generated exactly once and then reused forever,
  // unless full NVS is explicitly wiped outside firmware policy.
  if (!ensureDeviceId()) {
    return false;
  }

  if (!preferences_.isKey(device_identity::KEY_PROVISIONED)) {
    preferences_.putBool(device_identity::KEY_PROVISIONED, false);
  }

  return true;
}

String DeviceIdentityService::getDeviceId() {
  if (!ensureReady()) {
    return String();
  }

  if (cachedDeviceId_.isEmpty()) {
    ensureDeviceId();
  }

  return cachedDeviceId_;
}

String DeviceIdentityService::generateDeviceId() const {
  String randomPart;
  randomPart.reserve(device_identity::DEVICE_ID_RANDOM_LENGTH);

  for (uint8_t i = 0; i < device_identity::DEVICE_ID_RANDOM_LENGTH; ++i) {
    const uint32_t raw = esp_random();
    randomPart += kAlphabet[raw % kAlphabetLength];
  }

  return String(device_identity::DEVICE_ID_PREFIX) + randomPart;
}

bool DeviceIdentityService::isProvisioned() {
  if (!ensureReady()) {
    return false;
  }

  const bool persistedFlag =
      readBool(device_identity::KEY_PROVISIONED, false);
  const bool materialsPresent = provisioningMaterialsPresent();

  // Keep NVS state internally consistent: flag cannot remain true without
  // required provisioning materials.
  if (persistedFlag && !materialsPresent) {
    writeBool(device_identity::KEY_PROVISIONED, false);
    return false;
  }

  return persistedFlag && materialsPresent;
}

bool DeviceIdentityService::markProvisioned(bool provisioned) {
  if (!ensureReady()) {
    return false;
  }

  if (!provisioned) {
    return writeBool(device_identity::KEY_PROVISIONED, false);
  }

  if (!provisioningMaterialsPresent()) {
    writeBool(device_identity::KEY_PROVISIONED, false);
    return false;
  }

  return writeBool(device_identity::KEY_PROVISIONED, true);
}

bool DeviceIdentityService::hasWifiCredentials() {
  if (!ensureReady()) {
    return false;
  }

  const String ssid = readString(device_identity::KEY_WIFI_SSID);
  const String password = readString(device_identity::KEY_WIFI_PASSWORD);
  return ssid.length() > 0 && password.length() > 0;
}

bool DeviceIdentityService::hasDeviceSecret() {
  if (!ensureReady()) {
    return false;
  }

  const String secret = readString(device_identity::KEY_DEVICE_SECRET);
  return secret.length() > 0;
}

String DeviceIdentityService::getWifiSsid() {
  if (!ensureReady()) {
    return String();
  }

  return readString(device_identity::KEY_WIFI_SSID);
}

String DeviceIdentityService::getWifiPassword() {
  if (!ensureReady()) {
    return String();
  }

  return readString(device_identity::KEY_WIFI_PASSWORD);
}

String DeviceIdentityService::getDeviceSecret() {
  if (!ensureReady()) {
    return String();
  }

  return readString(device_identity::KEY_DEVICE_SECRET);
}

String DeviceIdentityService::getApiBaseUrl() {
  if (!ensureReady()) {
    return String();
  }

  return readString(device_identity::KEY_API_BASE_URL);
}

String DeviceIdentityService::getMqttHost() {
  if (!ensureReady()) {
    return String();
  }

  return readString(device_identity::KEY_MQTT_HOST);
}

uint16_t DeviceIdentityService::getMqttPort() {
  if (!ensureReady()) {
    return 0;
  }

  return preferences_.getUShort(device_identity::KEY_MQTT_PORT, 0);
}

bool DeviceIdentityService::setDeviceId(const String& deviceId) {
  if (!ensureReady()) {
    return false;
  }

  if (!isValidDeviceId(deviceId)) {
    return false;
  }

  if (!writeString(device_identity::KEY_DEVICE_ID, deviceId)) {
    return false;
  }

  cachedDeviceId_ = deviceId;
  return true;
}

bool DeviceIdentityService::setWifiCredentials(const String& ssid,
                                               const String& password) {
  if (!ensureReady()) {
    return false;
  }

  if (ssid.isEmpty() || password.isEmpty()) {
    return false;
  }

  const bool ssidStored =
      writeString(device_identity::KEY_WIFI_SSID, ssid);
  const bool passwordStored =
      writeString(device_identity::KEY_WIFI_PASSWORD, password);
  return ssidStored && passwordStored;
}

bool DeviceIdentityService::setDeviceSecret(const String& secret) {
  if (!ensureReady()) {
    return false;
  }

  if (secret.isEmpty()) {
    return false;
  }

  return writeString(device_identity::KEY_DEVICE_SECRET, secret);
}

bool DeviceIdentityService::setApiBaseUrl(const String& apiBaseUrl) {
  if (!ensureReady()) {
    return false;
  }

  String normalized = apiBaseUrl;
  normalized.trim();
  if (normalized.isEmpty()) {
    return false;
  }

  return writeString(device_identity::KEY_API_BASE_URL, normalized);
}

bool DeviceIdentityService::setMqttHost(const String& mqttHost) {
  if (!ensureReady()) {
    return false;
  }

  String normalized = mqttHost;
  normalized.trim();
  if (normalized.isEmpty()) {
    return false;
  }

  return writeString(device_identity::KEY_MQTT_HOST, normalized);
}

bool DeviceIdentityService::setMqttPort(uint16_t mqttPort) {
  if (!ensureReady() || mqttPort == 0) {
    return false;
  }

  return preferences_.putUShort(
             device_identity::KEY_MQTT_PORT,
             mqttPort
         ) == sizeof(uint16_t);
}

void DeviceIdentityService::clearProvisioningData() {
  if (!ensureReady()) {
    return;
  }

  preferences_.remove(device_identity::KEY_WIFI_SSID);
  preferences_.remove(device_identity::KEY_WIFI_PASSWORD);
  preferences_.remove(device_identity::KEY_DEVICE_SECRET);
  preferences_.remove(device_identity::KEY_API_BASE_URL);
  preferences_.remove(device_identity::KEY_MQTT_HOST);
  preferences_.remove(device_identity::KEY_MQTT_PORT);
  preferences_.putBool(device_identity::KEY_PROVISIONED, false);
}

bool DeviceIdentityService::clearAllData() {
  if (!ensureReady()) {
    return false;
  }

  cachedDeviceId_ = "";
  return preferences_.clear();
}

bool DeviceIdentityService::isFactoryResetRequested() {
  if (!ensureReady()) {
    return false;
  }

  return readBool(device_identity::KEY_FACTORY_RESET, false);
}

void DeviceIdentityService::requestFactoryReset() {
  if (!ensureReady()) {
    return;
  }

  writeBool(device_identity::KEY_FACTORY_RESET, true);
}

void DeviceIdentityService::clearFactoryResetRequest() {
  if (!ensureReady()) {
    return;
  }

  writeBool(device_identity::KEY_FACTORY_RESET, false);
}

bool DeviceIdentityService::ensureReady() {
  if (ready_) {
    return true;
  }

  return begin();
}

bool DeviceIdentityService::ensureDeviceId() {
  if (!preferences_.isKey(device_identity::KEY_DEVICE_ID)) {
    const String generated = generateDeviceId();
    if (!writeString(device_identity::KEY_DEVICE_ID, generated)) {
      logger::error(TAG, "Failed to persist generated deviceId");
      return false;
    }
    cachedDeviceId_ = generated;
    logger::info(TAG, "Generated immutable deviceId");
    return true;
  }

  const String existing = readString(device_identity::KEY_DEVICE_ID);
  if (existing.isEmpty()) {
    logger::error(TAG, "Stored deviceId is empty");
    return false;
  }

  cachedDeviceId_ = existing;

  if (!isValidDeviceId(cachedDeviceId_)) {
    logger::warn(TAG,
                 "Stored deviceId format is invalid; preserving stored value");
  }

  return true;
}

bool DeviceIdentityService::provisioningMaterialsPresent() {
  return hasWifiCredentials() && hasDeviceSecret();
}

bool DeviceIdentityService::isValidDeviceId(const String& deviceId) const {
  if (deviceId.length() != device_identity::DEVICE_ID_TOTAL_LENGTH) {
    return false;
  }

  if (!deviceId.startsWith(device_identity::DEVICE_ID_PREFIX)) {
    return false;
  }

  for (uint8_t i = strlen(device_identity::DEVICE_ID_PREFIX);
       i < deviceId.length();
       ++i) {
    const char ch = deviceId[i];
    const bool upperAlpha = ch >= 'A' && ch <= 'Z';
    const bool digit = ch >= '0' && ch <= '9';
    if (!upperAlpha && !digit) {
      return false;
    }
  }

  return true;
}

String DeviceIdentityService::readString(const char* key) {
  return preferences_.getString(key, "");
}

bool DeviceIdentityService::writeString(const char* key,
                                        const String& value) {
  return preferences_.putString(key, value) > 0;
}

bool DeviceIdentityService::readBool(const char* key, bool defaultValue) {
  return preferences_.getBool(key, defaultValue);
}

bool DeviceIdentityService::writeBool(const char* key, bool value) {
  return preferences_.putBool(key, value);
}
