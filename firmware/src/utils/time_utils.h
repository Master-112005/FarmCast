#pragma once

#include <Arduino.h>

namespace time_utils {

bool isDue(uint32_t nowMs, uint32_t lastMs, uint32_t intervalMs);
uint64_t millis64();

}  // namespace time_utils
