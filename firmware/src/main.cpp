#include <Arduino.h>

#include "core/device_context.h"
#include "utils/logger.h"

DeviceContext g_deviceContext;









void setup() {

  Serial.begin(115200);
  delay(50);

  logger::info("Main", "Boot sequence start");


  g_deviceContext.begin();

  logger::info("Main", "Boot sequence complete");
}









void loop() {
  g_deviceContext.loop();


  delay(1);
}