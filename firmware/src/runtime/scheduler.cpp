#include "scheduler.h"

Scheduler::Scheduler(uint32_t intervalMs)
    : intervalMs_(intervalMs), lastRunMs_(0) {}

bool Scheduler::isDue(uint32_t nowMs) const {
  if (lastRunMs_ == 0) {
    return true;
  }

  return static_cast<uint32_t>(nowMs - lastRunMs_) >= intervalMs_;
}

void Scheduler::markRun(uint32_t nowMs) { lastRunMs_ = nowMs; }
