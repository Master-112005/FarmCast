#pragma once

#include <Arduino.h>

#include "../domain/device_state.h"
#include "../domain/firmware_info.h"

namespace system_boot {

void initializeSerial(uint32_t baudRate);
void initializeWatchdog(uint8_t timeoutSeconds);
void feedWatchdog();

String bootReason();
void logBootInfo(const FirmwareInfo& info);

DeviceState resolveInitialDeviceState(bool provisioned);
const char* toString(DeviceState state);

[[noreturn]] void enterDeepSleep(uint32_t sleepSeconds);

}  // namespace system_boot
