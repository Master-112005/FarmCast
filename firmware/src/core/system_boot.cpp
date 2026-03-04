#include "system_boot.h"

#include <esp_idf_version.h>
#include <esp_sleep.h>
#include <esp_system.h>
#include <esp_task_wdt.h>

#include "../utils/logger.h"

namespace {

const char* TAG = "SystemBoot";

const char* resetReasonToString(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:
      return "POWERON";
    case ESP_RST_EXT:
      return "EXT";
    case ESP_RST_SW:
      return "SW";
    case ESP_RST_PANIC:
      return "PANIC";
    case ESP_RST_INT_WDT:
      return "INT_WDT";
    case ESP_RST_TASK_WDT:
      return "TASK_WDT";
    case ESP_RST_WDT:
      return "WDT";
    case ESP_RST_DEEPSLEEP:
      return "DEEPSLEEP";
    case ESP_RST_BROWNOUT:
      return "BROWNOUT";
    case ESP_RST_SDIO:
      return "SDIO";
    default:
      return "UNKNOWN";
  }
}

const char* deviceStateToString(DeviceState state) {
  switch (state) {
    case DeviceState::PROVISIONING:
      return "PROVISIONING";
    case DeviceState::CONNECTING_WIFI:
      return "CONNECTING_WIFI";
    case DeviceState::AUTHENTICATING:
      return "AUTHENTICATING";
    case DeviceState::ONLINE:
      return "ONLINE";
    default:
      return "UNKNOWN";
  }
}

}  // namespace

namespace system_boot {

void initializeSerial(uint32_t baudRate) {
  Serial.begin(baudRate);
  delay(100);
}

void initializeWatchdog(uint8_t timeoutSeconds) {
#if ESP_IDF_VERSION_MAJOR >= 5
  const esp_task_wdt_config_t cfg = {
      .timeout_ms = static_cast<uint32_t>(timeoutSeconds) * 1000U,
      .idle_core_mask = 0,
      .trigger_panic = true,
  };
  esp_task_wdt_init(&cfg);
#else
  esp_task_wdt_init(timeoutSeconds, true);
#endif

  esp_task_wdt_add(nullptr);
}

void feedWatchdog() { esp_task_wdt_reset(); }

String bootReason() {
  return String(resetReasonToString(esp_reset_reason()));
}

void logBootInfo(const FirmwareInfo& info) {
  logger::info(TAG,
               String("Booting firmware ") + info.version + " build " +
                   info.buildDate + " " + info.buildTime +
                   " reset=" + bootReason());
}

DeviceState resolveInitialDeviceState(bool provisioned) {
  if (!provisioned) {
    logger::warn(TAG,
                 "Provisioning data missing. Entering provisioning mode.");
    return DeviceState::PROVISIONING;
  }

  return DeviceState::CONNECTING_WIFI;
}

const char* toString(DeviceState state) {
  return deviceStateToString(state);
}

[[noreturn]] void enterDeepSleep(uint32_t sleepSeconds) {
  logger::info(TAG,
               "Entering deep sleep for " + String(sleepSeconds) + "s");

  esp_sleep_enable_timer_wakeup(
      static_cast<uint64_t>(sleepSeconds) * 1000000ULL);

  Serial.flush();
  esp_deep_sleep_start();

  while (true) {
    delay(10);
  }
}

}  // namespace system_boot
