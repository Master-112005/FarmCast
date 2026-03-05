#pragma once

#include <Arduino.h>

namespace firmware_config {

static constexpr uint32_t SERIAL_BAUD_RATE = 115200;
static constexpr uint8_t WATCHDOG_TIMEOUT_SECONDS = 12;

static constexpr const char* WIFI_SSID = "Farmcast";
static constexpr const char* WIFI_PASSWORD = "1234567890";
static constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 6000;

// Local backend running on laptop hotspot gateway.
static constexpr const char* API_BASE_URL = "http://192.168.137.1:5000";
static constexpr const char* DEVICE_AUTH_PATH = "/api/v1/devices/auth";

static constexpr uint16_t AUTH_HTTP_TIMEOUT_MS = 5000;
static constexpr uint32_t AUTH_RETRY_INITIAL_MS = 4000;
static constexpr uint32_t AUTH_RETRY_MAX_MS = 60000;
static constexpr uint32_t AUTH_TOKEN_REFRESH_SKEW_MS = 60000;
static constexpr uint32_t AUTH_FALLBACK_TOKEN_TTL_SEC = 3600;
static constexpr uint8_t AUTH_MAX_CONSECUTIVE_401 = 3;

// 🔥 IMPORTANT: Since we're using HTTP (not HTTPS)
static constexpr bool ALLOW_INSECURE_TLS = true;

// You are using Docker Mosquitto locally on port 1883
// If device must connect to your local broker, change host:

static constexpr const char* MQTT_HOST = "192.168.137.1";
static constexpr uint16_t MQTT_PORT = 1883;

static constexpr bool MQTT_USE_TLS = false;
static constexpr bool MQTT_TLS_INSECURE = true;
static constexpr uint16_t MQTT_KEEP_ALIVE_SECONDS = 30;
static constexpr uint32_t MQTT_RECONNECT_INTERVAL_MS = 5000;
static constexpr uint32_t MQTT_RECONNECT_MAX_MS = 60000;

static constexpr uint32_t TELEMETRY_INTERVAL_MS = 60000;
static constexpr uint32_t HEARTBEAT_INTERVAL_MS = 30000;
static constexpr uint32_t MEMORY_LOG_INTERVAL_MS = 60000;

static constexpr uint32_t OTA_REBOOT_DELAY_MS = 2000;

static constexpr bool DEEP_SLEEP_ENABLED = false;
static constexpr uint32_t DEEP_SLEEP_SECONDS = 300;
static constexpr uint32_t DEEP_SLEEP_GRACE_MS = 1200;

static constexpr int PIN_SOIL_MOISTURE = 34;
static constexpr int PIN_TEMPERATURE = 35;
static constexpr int PIN_BATTERY = 32;

static constexpr int ADC_MOISTURE_DRY = 3200;
static constexpr int ADC_MOISTURE_WET = 1400;

// Basic linear conversion for analog temperature sensor.
static constexpr float TEMP_MV_AT_0C = 500.0f;
static constexpr float TEMP_MV_PER_C = 10.0f;
static constexpr bool TEMP_ALLOW_NEGATIVE = false;

// Battery divider ratio: V_bat = V_adc * ratio.
static constexpr float BATTERY_DIVIDER_RATIO = 2.0f;

// GPS
static constexpr bool GPS_ENABLED = true;
static constexpr int GPS_RX_PIN = 16;
static constexpr int GPS_TX_PIN = 17;
static constexpr uint32_t GPS_BAUD = 9600;

// Logging level: 0=error, 1=warn, 2=info, 3=debug
static constexpr uint8_t LOG_LEVEL = 2;

}  // namespace firmware_config
