#include "ota_service.h"

#include <HTTPClient.h>
#include <Update.h>
#include <WiFiClientSecure.h>
#include <esp_task_wdt.h>
#include <mbedtls/sha256.h>

#include "../utils/logger.h"

namespace {

const char* TAG = "OtaService";

String normalizeHex(const String& input) {
  String normalized;
  normalized.reserve(input.length());

  for (size_t i = 0; i < input.length(); ++i) {
    const char c = input[i];
    if (isxdigit(static_cast<unsigned char>(c))) {
      normalized += static_cast<char>(tolower(c));
    }
  }

  return normalized;
}

String toHex(const uint8_t* bytes, size_t length) {
  static constexpr char HEX_CHARS[] = "0123456789abcdef";
  String out;
  out.reserve(length * 2);

  for (size_t i = 0; i < length; ++i) {
    out += HEX_CHARS[(bytes[i] >> 4) & 0x0F];
    out += HEX_CHARS[bytes[i] & 0x0F];
  }

  return out;
}

int nextVersionPart(const String& version,
                    int& startIndex,
                    bool& foundAny) {
  String token;
  token.reserve(8);

  while (startIndex < static_cast<int>(version.length()) &&
         version[startIndex] == '.') {
    ++startIndex;
  }

  while (startIndex < static_cast<int>(version.length()) &&
         isdigit(static_cast<unsigned char>(version[startIndex]))) {
    foundAny = true;
    token += version[startIndex];
    ++startIndex;
  }

  while (startIndex < static_cast<int>(version.length()) &&
         version[startIndex] != '.') {
    ++startIndex;
  }

  if (token.isEmpty()) {
    return 0;
  }

  return token.toInt();
}

}  // namespace

OtaService::OtaService(const JsonBuilder& jsonBuilder,
                       MqttService& mqttService,
                       const FirmwareInfo& firmwareInfo,
                       uint32_t rebootDelayMs)
    : jsonBuilder_(jsonBuilder),
      mqttService_(mqttService),
      firmwareInfo_(firmwareInfo),
      rebootDelayMs_(rebootDelayMs),
      pendingCommand_(),
      commandPending_(false),
      updateInProgress_(false),
      rebootPending_(false),
      rebootAtMs_(0) {}

void OtaService::enqueueFromPayload(const String& payload) {
  OtaCommandPayload command;
  if (!jsonBuilder_.parseOtaCommand(payload, command)) {
    logger::warn(TAG, "Invalid OTA message payload");
    publishOtaEvent("ota_invalid_payload");
    return;
  }

  if (compareVersions(String(firmwareInfo_.version), command.version) >= 0) {
    logger::info(TAG, "Skipping OTA: target version is not newer");
    publishOtaEvent("ota_skipped_version");
    return;
  }

  pendingCommand_ = command;
  commandPending_ = true;

  logger::info(TAG, "OTA command queued for version " + command.version);
  publishOtaEvent("ota_queued");
}

void OtaService::loop(uint32_t nowMs, bool wifiConnected) {
  if (rebootPending_ && nowMs >= rebootAtMs_) {
    logger::warn(TAG, "Rebooting after successful OTA");
    ESP.restart();
    return;
  }

  if (!commandPending_ || updateInProgress_) {
    return;
  }

  if (!wifiConnected) {
    return;
  }

  updateInProgress_ = true;
  publishOtaEvent("ota_started");

  String checksum;
  String error;
  const bool ok = downloadAndApply(pendingCommand_, checksum, error);

  if (!ok) {
    logger::error(TAG, "OTA failed: " + error);
    publishOtaEvent("ota_failed");
    commandPending_ = false;
    updateInProgress_ = false;
    return;
  }

  logger::info(TAG, "OTA written successfully. SHA256=" + checksum);
  publishOtaEvent("ota_applied");

  commandPending_ = false;
  updateInProgress_ = false;
  rebootPending_ = true;
  rebootAtMs_ = nowMs + rebootDelayMs_;
}

bool OtaService::isUpdateInProgress() const { return updateInProgress_; }

bool OtaService::isRebootPending() const { return rebootPending_; }

int OtaService::compareVersions(const String& currentVersion,
                                const String& targetVersion) const {
  int currentIndex = 0;
  int targetIndex = 0;

  for (int i = 0; i < 4; ++i) {
    bool currentFound = false;
    bool targetFound = false;

    const int currentPart =
        nextVersionPart(currentVersion, currentIndex, currentFound);
    const int targetPart =
        nextVersionPart(targetVersion, targetIndex, targetFound);

    if (targetPart > currentPart) {
      return -1;
    }
    if (targetPart < currentPart) {
      return 1;
    }

    if (!currentFound && !targetFound) {
      break;
    }
  }

  return 0;
}

bool OtaService::downloadAndApply(const OtaCommandPayload& command,
                                  String& checksumOut,
                                  String& errorOut) {
  if (!command.url.startsWith("https://")) {
    errorOut = "OTA URL must use HTTPS";
    return false;
  }

  const String expectedChecksum = normalizeHex(command.checksum);
  if (expectedChecksum.isEmpty()) {
    errorOut = "Missing OTA checksum";
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, command.url)) {
    errorOut = "Failed to start OTA HTTP request";
    return false;
  }

  http.setTimeout(15000);
  const int httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    errorOut = "OTA HTTP error: " + String(httpCode);
    http.end();
    return false;
  }

  const int contentLength = http.getSize();
  if (!Update.begin(contentLength > 0 ? contentLength : UPDATE_SIZE_UNKNOWN)) {
    errorOut = "Insufficient space for OTA";
    http.end();
    return false;
  }

  Stream* stream = http.getStreamPtr();

  mbedtls_sha256_context shaCtx;
  mbedtls_sha256_init(&shaCtx);
  mbedtls_sha256_starts_ret(&shaCtx, 0);

  uint8_t buffer[1024];
  int remaining = contentLength;

  while (http.connected() && (remaining > 0 || remaining == -1)) {
    const size_t available = stream->available();
    if (available == 0) {
      delay(1);
      esp_task_wdt_reset();
      continue;
    }

    const size_t chunkSize = min(available, sizeof(buffer));
    const size_t readCount = stream->readBytes(buffer, chunkSize);
    if (readCount == 0) {
      continue;
    }

    if (Update.write(buffer, readCount) != readCount) {
      mbedtls_sha256_free(&shaCtx);
      Update.abort();
      http.end();
      errorOut = "Failed while writing OTA image";
      return false;
    }

    mbedtls_sha256_update_ret(&shaCtx, buffer, readCount);

    if (remaining > 0) {
      remaining -= static_cast<int>(readCount);
    }

    esp_task_wdt_reset();
    yield();
  }

  uint8_t digest[32] = {0};
  mbedtls_sha256_finish_ret(&shaCtx, digest);
  mbedtls_sha256_free(&shaCtx);

  checksumOut = toHex(digest, sizeof(digest));
  if (normalizeHex(checksumOut) != expectedChecksum) {
    Update.abort();
    http.end();
    errorOut = "OTA checksum mismatch";
    return false;
  }

  if (!Update.end(true)) {
    http.end();
    errorOut = "Update end failed";
    return false;
  }

  if (!Update.isFinished()) {
    http.end();
    errorOut = "Update incomplete";
    return false;
  }

  http.end();
  return true;
}

void OtaService::publishOtaEvent(const String& event) {
  if (!mqttService_.isConnected()) {
    return;
  }

  const String payload = jsonBuilder_.buildStatus(
      true, String(firmwareInfo_.version), event, ESP.getFreeHeap());

  mqttService_.publishHeartbeat(payload, false);
}
