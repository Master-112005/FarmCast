#pragma once

#include <Arduino.h>

class Scheduler {
 public:
  explicit Scheduler(uint32_t intervalMs = 1000);

  bool isDue(uint32_t nowMs) const;
  void markRun(uint32_t nowMs);

 private:
  uint32_t intervalMs_;
  uint32_t lastRunMs_;
};
