#pragma once

namespace device_identity {

// Data is stored in NVS. Enable ESP32 NVS encryption/flash encryption in
// production builds so identity and secrets are encrypted at rest.

// NVS namespace and keys. Keep keys short to respect NVS constraints.
static constexpr const char* NVS_NAMESPACE = "fc_device";
static constexpr const char* KEY_DEVICE_ID = "device_id";
static constexpr const char* KEY_DEVICE_SECRET = "dev_secret";
static constexpr const char* KEY_WIFI_SSID = "wifi_ssid";
static constexpr const char* KEY_WIFI_PASSWORD = "wifi_pass";
static constexpr const char* KEY_PROVISIONED = "provisioned";
static constexpr const char* KEY_FACTORY_RESET = "f_reset";
static constexpr const char* KEY_API_BASE_URL = "api_url";
static constexpr const char* KEY_MQTT_HOST = "mqtt_host";

// Device identity format: fc-XXXXXXXX where X is [A-Z0-9].
static constexpr const char* DEVICE_ID_PREFIX = "fc-";
static constexpr uint8_t DEVICE_ID_RANDOM_LENGTH = 8;
static constexpr uint8_t DEVICE_ID_TOTAL_LENGTH = 11;

}  // namespace device_identity
