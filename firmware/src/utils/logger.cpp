#include "logger.h"

namespace {

LogLevel g_level = LogLevel::Info;

const char* levelToString(LogLevel level) {
  switch (level) {
    case LogLevel::Error:
      return "ERROR";
    case LogLevel::Warn:
      return "WARN";
    case LogLevel::Info:
      return "INFO";
    case LogLevel::Debug:
      return "DEBUG";
    default:
      return "LOG";
  }
}

void emit(LogLevel level, const char* tag, const String& message) {
  if (static_cast<uint8_t>(level) > static_cast<uint8_t>(g_level)) {
    return;
  }

  Serial.printf("[%lu][%s][%s] %s\n",
                static_cast<unsigned long>(millis()),
                levelToString(level),
                tag,
                message.c_str());
}

}  // namespace

namespace logger {

void begin(LogLevel level) { g_level = level; }

void setLevel(LogLevel level) { g_level = level; }

LogLevel level() { return g_level; }

void error(const char* tag, const String& message) {
  emit(LogLevel::Error, tag, message);
}

void warn(const char* tag, const String& message) {
  emit(LogLevel::Warn, tag, message);
}

void info(const char* tag, const String& message) {
  emit(LogLevel::Info, tag, message);
}

void debug(const char* tag, const String& message) {
  emit(LogLevel::Debug, tag, message);
}

}  // namespace logger
