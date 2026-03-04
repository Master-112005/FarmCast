#pragma once

#include <Arduino.h>

enum class LogLevel : uint8_t {
  Error = 0,
  Warn = 1,
  Info = 2,
  Debug = 3,
};

namespace logger {

void begin(LogLevel level);
void setLevel(LogLevel level);
LogLevel level();

void error(const char* tag, const String& message);
void warn(const char* tag, const String& message);
void info(const char* tag, const String& message);
void debug(const char* tag, const String& message);

}  // namespace logger
