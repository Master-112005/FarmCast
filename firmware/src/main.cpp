#include <Arduino.h>

#include "core/device_context.h"
#include "utils/logger.h"

DeviceContext g_deviceContext;

/**
 * @brief Arduino setup() – system entry point
 *
 * Responsibilities:
 *  - Initialize serial logging
 *  - Initialize device context
 *  - Leave all domain logic to DeviceContext
 */
void setup() {
  // Ensure USB serial is ready (important for ESP32 power-on logs)
  Serial.begin(115200);
  delay(50);

  logger::info("Main", "Boot sequence start");

  // Initialize full device lifecycle
  g_deviceContext.begin();

  logger::info("Main", "Boot sequence complete");
}

/**
 * @brief Arduino loop() – cooperative scheduler
 *
 * Responsibilities:
 *  - Call device context loop
 *  - Yield to ESP32 RTOS
 *  - Prevent watchdog starvation
 */
void loop() {
  g_deviceContext.loop();

  // Yield to WiFi / TCP / FreeRTOS
  delay(1);
}