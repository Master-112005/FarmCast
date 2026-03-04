#include "time_utils.h"

namespace {

uint64_t g_rolloverOffset = 0;
uint32_t g_lastMillis = 0;

}  // namespace

namespace time_utils {

bool isDue(uint32_t nowMs, uint32_t lastMs, uint32_t intervalMs) {
  if (lastMs == 0) {
    return true;
  }
  return static_cast<uint32_t>(nowMs - lastMs) >= intervalMs;
}

uint64_t millis64() {
  const uint32_t now = millis();
  if (now < g_lastMillis) {
    g_rolloverOffset += (1ULL << 32);
  }
  g_lastMillis = now;
  return g_rolloverOffset + now;
}

}  // namespace time_utils
